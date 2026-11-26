/**
 * Sorteio dos cartões de cada etapa (Fase 5).
 *
 * 1. Quantos: de 1 a 3, pelos pesos de STORY_EVENTS.PER_ROUND.
 * 2. Passos de cadeia vencidos (prazo cumprido e condição valendo) entram primeiro, até
 *    STORY_EVENTS.MAX_CHAIN_STEPS_PER_ROUND, e contam no total.
 * 3. O resto sai por sorteio: primeiro a categoria (peso de STORY_EVENTS.CATEGORY_WEIGHTS entre as
 *    que têm cartão possível), depois o evento dentro dela (frequência, e peso extra para quem reage
 *    à corrida). Entram no sorteio os eventos avulsos com variante nova, os passos iniciais das
 *    cadeias que ainda não aconteceram e a proposta de patrocínio.
 *
 * Numa mesma leva sai no máximo um cartão que faz nascer filho (Fase 6).
 *
 * Nenhuma variante sai duas vezes para o mesmo personagem: ela entra na memória (`seen`) quando o
 * cartão é criado. Se o catálogo não tiver mais nada que sirva, a etapa fica com menos cartões
 * (o simulador conta essas etapas na seção 10).
 *
 * Uma cadeia adormecida (esperando algo de longo prazo) não ocupa vaga no limite de cadeias.
 *
 * Sorteios com nome próprio: 'story-round' (quantos e quais), 'story-variant' (qual texto),
 * 'story-team' (a "outra equipe" de um cartão), 'story-person' (nome de pessoa nova),
 * 'story-sponsor' e 'story-offer' (patrocinador).
 */
import { STORY_EVENTS } from '@/config/balance';
import type { CareerState, PendingEvent, RoundRecord } from '@/domain/schemas';
import type { StoryCardSpec, StoryCategory, StoryChainSpec, StoryFrequency } from '@/domain/storyEvents';
import { STORY_CATEGORIES } from '@/domain/storyEvents';
import { STORY_CHAINS, STORY_EVENT_CATALOG } from '@/data/events';
import { compareText } from '@/domain/text';
import { createRng, hashSeed, type Rng } from '../rng';
import { resolveNeeds } from './bindings';
import { allHold } from './conditions';
import { buildContext, type StoryContext } from './context';
import { bringsBaby } from '../dynasty/family';
import { type CardSource, chainCardKey, instantiateCard, makesChild, pickVariant, unseenVariants } from './instantiate';
import { activeChains, findChain, isDue, lastAppearance, markSeen } from './memory';
import { canOfferSponsor, sponsorOfferCard } from './sponsorOffer';

interface Candidate {
  /** O que sai do sorteio depois que o cartão é escolhido (ou falha): o evento, a cadeia ou a proposta. */
  id: string;
  category: StoryCategory;
  weight: number;
  build(rng: Rng): { event: PendingEvent; key: string } | null;
}

const isReactive = (spec: StoryCardSpec) => spec.when.some((c) => c.c === 'race' || c.c === 'notRace');

function weightOf(spec: StoryCardSpec, frequency: StoryFrequency): number {
  return STORY_EVENTS.EVENT_WEIGHTS[frequency] * (isReactive(spec) ? STORY_EVENTS.REACTIVE_BOOST : 1);
}

/** Tenta montar um cartão a partir dos dados (condições, vínculos e uma variante não vista). */
function cardCandidate(ctx: StoryContext, source: CardSource): ((rng: Rng) => { event: PendingEvent; key: string } | null) | null {
  if (!allHold(ctx, source.spec.when)) return null;
  const unseen = unseenVariants(ctx, source.key, source.spec);
  if (unseen.length === 0) return null;
  const bindings = resolveNeeds(ctx, source.spec.needs, source.key);
  if (!bindings) return null;
  return (rng) => {
    const variant = pickVariant(rng, unseen);
    if (variant === undefined) return null;
    const event = instantiateCard(ctx, bindings, source, variant);
    return event?.storyKey ? { event, key: event.storyKey } : null;
  };
}

/**
 * Cadeias que ocupam espaço agora: as que têm passo agendado ou com condição valendo. Uma cadeia
 * adormecida (o prazo venceu, mas o passo espera algo de longo prazo, como chegar ao topo) não
 * conta para o limite de STORY_EVENTS.MAX_ACTIVE_CHAINS.
 */
function busyChains(ctx: StoryContext): number {
  let busy = 0;
  for (const state of activeChains(ctx.story)) {
    const spec = STORY_CHAINS.find((c) => c.id === state.id)?.steps.find((s) => s.id === state.next);
    const waiting = !isDue(state.notBefore, ctx.career.season, ctx.round);
    if (waiting || (spec && allHold(ctx, spec.when))) busy++;
  }
  return busy;
}

/**
 * Marca de `taken` para "esta leva já tem um bebê": `roomForChild` só olha a fila de eventos, que
 * ainda não tem os cartões da leva, e dois cartões de filho na mesma etapa fariam nascer dois bebês
 * com o mesmo id (o segundo não existiria).
 */
const babyTaken = 'story-child';

function eventCandidates(ctx: StoryContext, taken: ReadonlySet<string>): Candidate[] {
  const out: Candidate[] = [];
  const { story, career } = ctx;
  for (const spec of STORY_EVENT_CATALOG) {
    if (taken.has(spec.id) || (taken.has(babyTaken) && makesChild(spec))) continue;
    const last = lastAppearance(story, spec.id, career.season);
    if (last !== null && (spec.oncePerSeason || ctx.round - last < STORY_EVENTS.EVENT_SPACING)) continue;
    const build = cardCandidate(ctx, { key: spec.id, spec });
    if (build) out.push({ id: spec.id, category: spec.category, weight: weightOf(spec, spec.frequency), build });
  }
  // Passos iniciais de cadeias que ainda não aconteceram com este personagem.
  const startedThisRound = [...taken].filter((k) => k.startsWith('chain:') && !findChain(story, k.slice('chain:'.length))).length;
  if (busyChains(ctx) + startedThisRound < STORY_EVENTS.MAX_ACTIVE_CHAINS) {
    for (const chain of STORY_CHAINS) {
      if (findChain(story, chain.id) || taken.has(`chain:${chain.id}`)) continue;
      const spec = chain.steps.find((s) => s.id === chain.start);
      if (!spec) continue;
      const build = cardCandidate(ctx, { key: chainCardKey(chain.id, spec.id), spec, chain });
      if (build) out.push({ id: `chain:${chain.id}`, category: spec.category, weight: weightOf(spec, spec.frequency ?? 'normal'), build });
    }
  }
  if (!taken.has('sponsor-offer') && ctx.round > 0 && canOfferSponsor(ctx))
    out.push({
      id: 'sponsor-offer',
      category: 'money',
      weight: STORY_EVENTS.EVENT_WEIGHTS.normal,
      build: (rng) => sponsorOfferCard(ctx, hashSeed(career.seed, career.season, ctx.round, 'story-offer', Math.floor(rng.next() * 1e9))),
    });
  return out;
}

function pickWeighted<T extends { weight: number }>(rng: Rng, items: readonly T[]): T | undefined {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = rng.next() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function cardCount(rng: Rng): number {
  const weights = STORY_EVENTS.PER_ROUND;
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll < 0) return i + 1;
  }
  return weights.length;
}

/** Passos de cadeia com prazo vencido e condição valendo, em ordem de prazo. */
function dueChainSteps(ctx: StoryContext): { chain: StoryChainSpec; spec: StoryCardSpec }[] {
  const out: { chain: StoryChainSpec; spec: StoryCardSpec; at: { season: number; round: number } }[] = [];
  for (const state of activeChains(ctx.story)) {
    if (!state.next || !isDue(state.notBefore, ctx.career.season, ctx.round)) continue;
    const chain = STORY_CHAINS.find((c) => c.id === state.id);
    const spec = chain?.steps.find((s) => s.id === state.next);
    if (chain && spec) out.push({ chain, spec, at: state.notBefore });
  }
  return out.sort((a, b) => a.at.season - b.at.season || a.at.round - b.at.round || compareText(a.chain.id, b.chain.id));
}

/** Gera os cartões de um momento (etapa `round`, ou 0 no começo da temporada) e os guarda na memória. */
function generate(career: CareerState, record: RoundRecord | null, round: number, target: number, rng: Rng, opts: { sponsorFirst: boolean }): CareerState {
  const ctx = buildContext(career, record, round);
  const cards: PendingEvent[] = [];
  const keys: string[] = [];
  const taken = new Set<string>();
  const add = (built: { event: PendingEvent; key: string } | null, takenKey: string) => {
    if (!built || career.pendingEvents.some((e) => e.id === built.event.id) || cards.some((e) => e.id === built.event.id)) return false;
    cards.push(built.event);
    keys.push(built.key);
    taken.add(takenKey);
    if (bringsBaby(built.event)) taken.add(babyTaken);
    return true;
  };

  if (opts.sponsorFirst && canOfferSponsor(ctx)) add(sponsorOfferCard(ctx, hashSeed(career.seed, career.season, round, 'story-offer')), 'sponsor-offer');

  let chainSteps = 0;
  for (const { chain, spec } of dueChainSteps(ctx)) {
    if (chainSteps >= STORY_EVENTS.MAX_CHAIN_STEPS_PER_ROUND || cards.length >= target) break;
    const build = cardCandidate(ctx, { key: chainCardKey(chain.id, spec.id), spec, chain });
    if (build && add(build(rng), `chain:${chain.id}`)) chainSteps++;
  }

  while (cards.length < target) {
    const candidates = eventCandidates(ctx, taken);
    if (candidates.length === 0) break;
    const categories = STORY_CATEGORIES.filter((c) => candidates.some((x) => x.category === c)).map((c) => ({
      category: c,
      weight: STORY_EVENTS.CATEGORY_WEIGHTS[c],
    }));
    const category = pickWeighted(rng, categories)?.category;
    const pick = pickWeighted(
      rng,
      candidates.filter((c) => c.category === category),
    );
    if (!pick) break;
    if (!add(pick.build(rng), pick.id)) taken.add(pick.id);
  }

  if (cards.length === 0) return career;
  return markSeen({ ...career, pendingEvents: [...career.pendingEvents, ...cards] }, keys, round);
}

/** Os cartões depois de uma etapa: de 1 a 3. Só no modo piloto. */
export function addRoundStoryEvents(career: CareerState, record: RoundRecord, round: number): CareerState {
  if (career.mode !== 'driver') return career;
  const rng = createRng(hashSeed(career.seed, career.season, round, 'story-round'));
  return generate(career, record, round, cardCount(rng), rng, { sponsorFirst: false });
}

/**
 * Os cartões do começo da temporada (etapa 0): a proposta de patrocínio, se o piloto atrai uma, e
 * até STORY_EVENTS.SEASON_START_CARDS cartões de pré-temporada ou passos de cadeia agendados para
 * a virada do ano.
 */
export function addSeasonStartStoryEvents(career: CareerState): CareerState {
  if (career.mode !== 'driver') return career;
  const rng = createRng(hashSeed(career.seed, career.season, 0, 'story-round'));
  const ctx = buildContext(career, null, 0);
  const offer = canOfferSponsor(ctx) ? 1 : 0;
  return generate(career, null, 0, offer + STORY_EVENTS.SEASON_START_CARDS, rng, { sponsorFirst: true });
}

/**
 * Cartões das histórias que ficaram sem resposta na virada do ano. Eles passam para a temporada nova
 * (o texto já está na memória e não pode sumir sem ser lido), mas sem os efeitos presos ao campeonato
 * que acabou: pontos tirados ou devolvidos numa etapa dele e punição de grid. Os cartões do catálogo
 * antigo, de saves anteriores à Fase 5, saem como saíam.
 */
export function carriedOverCards(pending: readonly PendingEvent[]): PendingEvent[] {
  return pending
    .filter((e) => e.storyKey !== undefined)
    .map((e) => ({
      ...e,
      choices: e.choices.map((c) => ({
        ...c,
        outcomes: c.outcomes.map((o) => ({ ...o, effects: o.effects.filter((x) => x.type !== 'pointsAdjustment' && x.type !== 'gridPenalty') })),
      })),
    }));
}

/**
 * Monta um cartão específico agora, sem sorteio de quantidade nem de categoria (testes e
 * ferramentas): `cardKey` é o id de um evento avulso ou `chain:<cadeia>:<passo>`. Usa a primeira
 * variante não vista (ou `variant`). Devolve null se a condição ou um vínculo não vale.
 */
export function storyCardFor(career: CareerState, record: RoundRecord | null, round: number, cardKey: string, variant?: number): PendingEvent | null {
  const ctx = buildContext(career, record, round);
  let source: CardSource | null = null;
  if (cardKey.startsWith('chain:')) {
    const [, chainId, stepId] = cardKey.split(':');
    const chain = STORY_CHAINS.find((c) => c.id === chainId);
    const spec = chain?.steps.find((s) => s.id === stepId);
    if (chain && spec) source = { key: cardKey, spec, chain };
  } else {
    const spec = STORY_EVENT_CATALOG.find((e) => e.id === cardKey);
    if (spec) source = { key: cardKey, spec };
  }
  if (!source || !allHold(ctx, source.spec.when)) return null;
  const bindings = resolveNeeds(ctx, source.spec.needs, source.key);
  const index = variant ?? unseenVariants(ctx, source.key, source.spec)[0];
  if (!bindings || index === undefined) return null;
  return instantiateCard(ctx, bindings, source, index);
}
