/**
 * Montagem de um cartão (`PendingEvent`) a partir dos dados: escolhe a variante de texto ainda não
 * vista, troca os marcadores pelos nomes do momento, traduz os efeitos por tamanho em efeitos do
 * save e, nos passos de cadeia, acrescenta o efeito que agenda o passo seguinte.
 */
import { STORY_EVENTS } from '@/config/balance';
import type { Effect, EventChoice, PendingEvent, StoryPerson } from '@/domain/schemas';
import type { StoryCardSpec, StoryChainSpec, StoryChoice, StoryDelay, StoryEffect, StoryOutcome } from '@/domain/storyEvents';
import { fullName } from '../career/selectors';
import { hashSeed, type Rng } from '../rng';
import { generateChild } from '../dynasty/family';
import type { StoryBindings } from './bindings';
import { allHold } from './conditions';
import type { StoryContext } from './context';
import { concreteEffects, personSnapshot } from './effects';
import { hasSeen } from './memory';
import { renderText } from './text';

/** Chave da variante na memória: `evento#2`, `cadeia:padaria:retribuicao#0`. */
export const variantKey = (cardKey: string, index: number) => `${cardKey}#${index}`;
export const chainCardKey = (chainId: string, stepId: string) => `chain:${chainId}:${stepId}`;

/** Variantes ainda não vistas por este personagem. */
export function unseenVariants(ctx: StoryContext, cardKey: string, spec: StoryCardSpec): number[] {
  const out: number[] = [];
  spec.variants.forEach((_v, i) => {
    if (!hasSeen(ctx.story, variantKey(cardKey, i))) out.push(i);
  });
  return out;
}

/** Quando o passo agendado pode sair: depois de tantas etapas, ou na temporada seguinte. */
export function scheduleAfter(season: number, round: number, delay: StoryDelay): { season: number; round: number } {
  const d = STORY_EVENTS.DELAYS[delay];
  return d.seasons > 0 ? { season: season + d.seasons, round: 0 } : { season, round: round + d.rounds };
}

function probabilities(outcomes: readonly StoryOutcome[], b: StoryBindings): number[] {
  const fixed = outcomes.map((o) => (o.odds === 'rest' ? 0 : o.odds === 'academy' ? (b.academy?.chance ?? 0) : STORY_EVENTS.ODDS[o.odds]));
  const rest = Math.max(0, 1 - fixed.reduce((s, p) => s + p, 0));
  const restCount = outcomes.filter((o) => o.odds === 'rest').length;
  return outcomes.map((o, i) => (o.odds === 'rest' ? rest / Math.max(1, restCount) : (fixed[i] ?? 0)));
}

/** A escolha aparece agora? (condições e, para pagar o aporte, caixa para isso). */
function choiceAvailable(ctx: StoryContext, choice: StoryChoice, b: StoryBindings): boolean {
  if (!allHold(ctx, choice.requires)) return false;
  const pays = choice.outcomes.some((o) => o.effects.some((e) => e.e === 'payCashCall'));
  return !pays || (b.cashCall?.canPay ?? false);
}

/** O traço ou a aptidão que libera a escolha (para a tela mostrar). */
function unlockOf(choice: StoryChoice): EventChoice['unlock'] {
  for (const c of choice.requires ?? []) {
    if (c.c === 'trait') return { kind: 'trait', id: c.trait };
    if (c.c === 'aptitude') return { kind: 'aptitude', id: c.aptitude, level: c.level };
  }
  return undefined;
}

export interface CardSource {
  /** Chave do cartão na memória (o id do evento, ou `chain:<cadeia>:<passo>`). */
  key: string;
  spec: StoryCardSpec;
  chain?: StoryChainSpec;
}

/**
 * Pessoas que o cartão vai guardar (efeitos `meet`), já com nome: o texto do próprio cartão pode
 * citá-las (`{pessoa:chave}`) antes de elas entrarem na memória.
 */
function withNewPeople(ctx: StoryContext, b: StoryBindings, source: CardSource): StoryBindings {
  const persons: Record<string, StoryPerson> = { ...b.persons };
  for (const choice of source.spec.choices)
    for (const outcome of choice.outcomes)
      for (const effect of outcome.effects) {
        if (effect.e !== 'meet' || persons[effect.key]) continue;
        const person = personSnapshot(ctx, b, effect);
        if (person) persons[effect.key] = source.chain && person.chainId === null ? { ...person, chainId: source.chain.id } : person;
      }
  return { ...b, persons };
}

/**
 * O bebê de um cartão que faz nascer um filho (efeito `child`, Fase 6), sorteado antes do texto para
 * o cartão poder citá-lo (`{bebe}`). Sorteio próprio por cartão e momento ('story-child'), que não
 * mexe nos sorteios do cartão.
 */
function withNewBaby(ctx: StoryContext, b: StoryBindings, source: CardSource): StoryBindings {
  const born = source.spec.choices.some((c) => c.outcomes.some((o) => o.effects.some((e) => e.e === 'child')));
  if (!born || b.baby) return b;
  const seed = hashSeed(ctx.career.seed, 'story-child', source.key, ctx.career.season, ctx.round);
  return { ...b, baby: generateChild(ctx.career, seed) };
}

function outcomeEffects(ctx: StoryContext, b: StoryBindings, source: CardSource, choice: StoryChoice, outcome: StoryOutcome, label: string): Effect[] {
  const effects = outcome.effects.flatMap((e: StoryEffect) => concreteEffects(ctx, b, e, label, source.key));
  if (source.chain && outcome.next) {
    const next = outcome.next === 'end' ? null : outcome.next.step;
    const notBefore =
      outcome.next === 'end' ? { season: ctx.career.season, round: ctx.round } : scheduleAfter(ctx.career.season, ctx.round, outcome.next.delay);
    effects.push({ type: 'storyChain', chainId: source.chain.id, step: source.spec.id, choice: choice.id, next, notBefore });
  }
  return effects;
}

/** Monta o cartão com a variante `variant`. Devolve null se sobrar menos de duas escolhas. */
export function instantiateCard(ctx: StoryContext, bindings: StoryBindings, source: CardSource, variant: number): PendingEvent | null {
  const text = source.spec.variants[variant];
  if (!text) return null;
  const b = withNewBaby(ctx, withNewPeople(ctx, bindings, source), source);
  const title = renderText(text.title, ctx, b);
  const choices: EventChoice[] = [];
  for (const choice of source.spec.choices) {
    const words = text.choices[choice.id];
    if (!words || !choiceAvailable(ctx, choice, b)) continue;
    const odds = probabilities(choice.outcomes, b);
    const unlock = unlockOf(choice);
    choices.push({
      id: choice.id,
      label: renderText(words.label, ctx, b),
      description: '',
      outcomes: choice.outcomes.map((outcome, i) => ({
        probability: odds[i] ?? 0,
        text: renderText(words.outcomes[i] ?? '', ctx, b),
        effects: outcomeEffects(ctx, b, source, choice, outcome, title),
      })),
      ...(unlock ? { unlock } : {}),
    });
  }
  if (choices.length < 2) return null;
  const speakerKey = source.spec.speaker;
  const speaker = speakerKey ? b.persons[speakerKey] : undefined;
  const idKey = source.chain ? `${source.chain.id}-${source.spec.id}` : source.spec.id;
  return {
    id: `s${ctx.career.season}-r${ctx.round}-${idKey}`,
    definitionId: source.chain ? `story:${source.chain.id}:${source.spec.id}` : `story:${source.spec.id}`,
    category: source.spec.category,
    season: ctx.career.season,
    round: ctx.round,
    title,
    body: renderText(text.body, ctx, b),
    choices,
    storyKey: variantKey(source.key, variant),
    ...(source.chain ? { chain: { id: source.chain.id, title: source.chain.title } } : {}),
    ...(speaker ? { speaker: { name: fullName(speaker), role: speaker.role } } : {}),
  };
}

/** Uma variante não vista, sorteada. */
export function pickVariant(rng: Rng, unseen: readonly number[]): number | undefined {
  return unseen[Math.floor(rng.next() * unseen.length)];
}
