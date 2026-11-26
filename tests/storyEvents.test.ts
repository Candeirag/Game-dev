/**
 * Validador dos dados dos eventos encadeados (Fase 5): confere, nos arquivos de `src/data/events`,
 * tudo o que o motor supõe e o TypeScript não vê.
 *
 * - Condições: traços, aptidões, marcas da etapa, faixas e degraus que existem.
 * - Referências: toda marca lida é deixada por alguma escolha (e toda marca deixada é lida por
 *   alguém); toda pessoa citada é guardada por um efeito `meet`; todo perfil de patrocinador existe.
 * - Vínculos e marcadores: todo `{marcador}` é conhecido e tem o vínculo declarado; todo alvo de
 *   efeito (rival, outro, patrocinador, equipe) também.
 * - Escolhas e desfechos: de duas a três escolhas, chances que fecham 100%, um texto por desfecho.
 * - Cadeias sem ponta solta: passo inicial existe, todo passo é alcançável, todo desfecho termina a
 *   cadeia ou aponta para um passo que existe, nada anda em círculo, pelo menos 3 passos num
 *   caminho, e marca e pessoa que um passo exige são criadas em todos os caminhos até ele.
 * - Texto: nenhum se repete no catálogo inteiro (cada variante sai no máximo uma vez por
 *   personagem, então texto único no catálogo = texto único na carreira).
 * - Volume: pelo menos 80 eventos avulsos e 10 cadeias de 3 ou mais passos.
 *
 * Cada `it` junta todos os problemas que encontrou e mostra a lista inteira de uma vez.
 */
import { describe, expect, it } from 'vitest';
import { APTITUDE_KEYS, ATTRIBUTE_KEYS, TRAIT_IDS } from '@/domain/schemas';
import {
  AGE_STAGES,
  ATTITUDE_LEVELS,
  RACE_TAGS,
  SEASON_PARTS,
  SPONSOR_PERSONALITIES,
  STANDING_LEVELS,
  STAT_LEVELS,
  STORY_CASH_LEVELS,
  STORY_CATEGORIES,
  STORY_DELAYS,
  STORY_FREQUENCIES,
  STORY_HAS,
  STORY_ODDS,
  STORY_STATS,
  type StoryCardSpec,
  type StoryChainSpec,
  type StoryCondition,
  type StoryEffect,
  type StoryNeed,
} from '@/domain/storyEvents';
import { SPONSOR_PROFILES, STORY_CHAINS, STORY_EVENT_CATALOG } from '@/data/events';
import { placeholderPattern } from '@/engine/story/text';

/* ---------------- O que existe ---------------- */

interface Card {
  /** Onde o cartão está, para as mensagens: "evento toque-sofrido" ou "cadeia padaria, passo inicio". */
  where: string;
  spec: StoryCardSpec;
  chain?: StoryChainSpec;
}

const cards: Card[] = [
  ...STORY_EVENT_CATALOG.map((spec) => ({ where: `evento ${spec.id}`, spec })),
  ...STORY_CHAINS.flatMap((chain) => chain.steps.map((spec) => ({ where: `cadeia ${chain.id}, passo ${spec.id}`, spec, chain }))),
];

const allEffects = (spec: StoryCardSpec): StoryEffect[] => spec.choices.flatMap((c) => c.outcomes.flatMap((o) => o.effects));
const allConditions = (spec: StoryCardSpec): StoryCondition[] => [...spec.when, ...spec.choices.flatMap((c) => c.requires ?? [])];

/** Marcadores sempre disponíveis (sem vínculo). `{sobrenome}` é o da família (Fase 6). */
const FREE_PLACEHOLDERS = new Set(['nome', 'piloto', 'equipe', 'categoria', 'pista', 'cidade', 'ano', 'sobrenome']);
/** Marcador → vínculos que o liberam. */
const BOUND_PLACEHOLDERS: Readonly<Record<string, readonly StoryNeed[]>> = {
  companheiro: ['teammate'],
  rival: ['rival', 'newRival'],
  outro: ['other', 'ahead'],
  lider: ['leader'],
  patrocinador: ['sponsor', 'unhappySponsor'],
  equipeInteressada: ['interestedTeam'],
  outraEquipe: ['otherTeam'],
  pontos: ['roundPoints'],
  valor: ['cashCall'],
  academia: ['academy'],
  equipeTopo: ['academy'],
  chance: ['academy'],
  meta: ['academy'],
};
const PERSON_PLACEHOLDERS = new Set(['pessoa', 'primeiro', 'org']);
const CATEGORY_LINKS = new Set(['the', 'de', 'em', 'a', 'para', 'por']);
const SPONSOR_PLACEHOLDERS = new Set([...FREE_PLACEHOLDERS, 'patrocinador', 'valor', 'bonus', 'meta', 'ate']);
const NEEDS = new Set<string>([
  'teammate',
  'rival',
  'newRival',
  'other',
  'ahead',
  'leader',
  'sponsor',
  'unhappySponsor',
  'interestedTeam',
  'otherTeam',
  'roundPoints',
  'cashCall',
  'academy',
]);
/** Vínculos que só existem depois de uma corrida (não servem no começo da temporada). */
const RACE_NEEDS = new Set<string>(['newRival', 'other', 'ahead', 'roundPoints']);

const placeholders = (text: string) => [...text.matchAll(placeholderPattern)].map((m) => ({ raw: m[0], name: m[2] ?? '', arg: m[3] }));

/** Pessoas guardadas por efeitos `meet` em todo o catálogo. */
const metAnywhere = new Set(cards.flatMap((c) => allEffects(c.spec).flatMap((e) => (e.e === 'meet' ? [e.key] : []))));
/** Marcas deixadas e lidas em todo o catálogo. */
const flagsSet = new Set(cards.flatMap((c) => allEffects(c.spec).flatMap((e) => (e.e === 'flag' && !e.clear ? [e.flag] : []))));
const flagsRead = new Set(cards.flatMap((c) => allConditions(c.spec).flatMap((x) => (x.c === 'flag' || x.c === 'noFlag' ? [x.flag] : []))));

const has = (spec: StoryCardSpec, ...needs: StoryNeed[]) => needs.some((n) => spec.needs?.includes(n));
/** O cartão só sai da segunda geração em diante (quem veio antes existe na linhagem): Fase 6. */
const fromSecondGeneration = (spec: StoryCardSpec) =>
  spec.when.some((c) => (c.c === 'generation' && (c.min ?? 1) >= 2) || (c.c === 'has' && (c.what === 'famousParent' || c.what === 'familyTeam')));
/** O cartão faz nascer um filho (efeito `child`, Fase 6). */
const bornHere = (spec: StoryCardSpec) => allEffects(spec).some((e) => e.e === 'child');
const personNeed = (spec: StoryCardSpec, key: string) => spec.needs?.includes(`person:${key}`) ?? false;
const metHere = (spec: StoryCardSpec, key: string) => allEffects(spec).some((e) => e.e === 'meet' && e.key === key);

/* ---------------- Conferências de um cartão ---------------- */

function checkCondition(where: string, c: StoryCondition, problems: string[]): void {
  const bad = (what: string) => problems.push(`${where}: condição ${c.c} com ${what}.`);
  switch (c.c) {
    case 'tier':
    case 'careerSeason':
    case 'generation': {
      const lo = 1;
      const hi = c.c === 'tier' ? 7 : 99;
      for (const v of [c.min, c.max]) if (v !== undefined && (!Number.isInteger(v) || v < lo || v > hi)) bad(`valor fora de ${lo} a ${hi} (${v})`);
      if (c.min !== undefined && c.max !== undefined && c.min > c.max) bad('mínimo maior que o máximo');
      if (c.min === undefined && c.max === undefined) bad('nem mínimo nem máximo');
      break;
    }
    case 'age':
      for (const v of [c.from, c.to]) if (v !== undefined && !AGE_STAGES.includes(v)) bad(`fase da vida desconhecida (${v})`);
      if (c.from && c.to && AGE_STAGES.indexOf(c.from) > AGE_STAGES.indexOf(c.to)) bad('fase inicial depois da final');
      if (!c.from && !c.to) bad('nem início nem fim');
      break;
    case 'season':
      if (!SEASON_PARTS.includes(c.part)) bad(`parte da temporada desconhecida (${c.part})`);
      break;
    case 'race':
    case 'notRace':
      if (!RACE_TAGS.includes(c.tag)) bad(`marca de etapa desconhecida (${c.tag})`);
      break;
    case 'standing':
      for (const v of [c.in, c.out]) if (v !== undefined && !STANDING_LEVELS.includes(v)) bad(`faixa desconhecida (${v})`);
      if (!c.in && !c.out) bad('nem faixa de dentro nem de fora');
      break;
    case 'stat':
      if (!STORY_STATS.includes(c.stat)) bad(`indicador desconhecido (${c.stat})`);
      if (!STAT_LEVELS.includes(c.level)) bad(`faixa desconhecida (${c.level})`);
      break;
    case 'cash':
      for (const v of [c.atLeast, c.atMost]) if (v !== undefined && !STORY_CASH_LEVELS.includes(v)) bad(`faixa de caixa desconhecida (${v})`);
      if (!c.atLeast && !c.atMost) bad('nem mínimo nem máximo');
      break;
    case 'trait':
      if (!TRAIT_IDS.includes(c.trait)) bad(`traço desconhecido (${c.trait})`);
      break;
    case 'aptitude':
      if (!APTITUDE_KEYS.includes(c.aptitude)) bad(`aptidão desconhecida (${c.aptitude})`);
      break;
    case 'hub':
      if (!['sao-paulo', 'italia', 'inglaterra'].includes(c.hub)) bad(`polo desconhecido (${c.hub})`);
      break;
    case 'has':
    case 'lacks':
      if (!STORY_HAS.includes(c.what)) bad(`item desconhecido (${c.what})`);
      break;
    case 'flag':
    case 'noFlag':
      if (!flagsSet.has(c.flag)) bad(`a marca "${c.flag}", que nenhuma escolha deixa`);
      break;
    case 'attitude':
      if (!ATTITUDE_LEVELS.includes(c.level)) bad(`faixa de atitude desconhecida (${c.level})`);
      if (!metAnywhere.has(c.key)) bad(`a pessoa "${c.key}", que nenhum efeito guarda`);
      break;
    case 'person':
    case 'noPerson':
    case 'onGrid':
    case 'personAtTeam':
      if (!metAnywhere.has(c.key)) bad(`a pessoa "${c.key}", que nenhum efeito guarda`);
      break;
    case 'region':
      if (c.region !== 'capital' && c.region !== 'interior') bad(`região desconhecida (${c.region})`);
      break;
  }
}

function checkEffect(card: Card, e: StoryEffect, problems: string[]): void {
  const { spec, where } = card;
  const bad = (what: string) => problems.push(`${where}: efeito ${e.e} ${what}.`);
  const sizeOk = (size: number, max = 3) => Number.isInteger(size) && size !== 0 && Math.abs(size) <= max;
  const driverTarget = (who: string, key?: string) => {
    if (who === 'rival' && !has(spec, 'rival', 'newRival')) bad('mira o rival sem o vínculo rival/newRival');
    if (who === 'other' && !has(spec, 'other', 'ahead')) bad('mira o outro piloto sem o vínculo other/ahead');
    if (who === 'teammate' && !has(spec, 'teammate')) bad('mira o companheiro sem o vínculo teammate');
    if (who === 'leader' && !has(spec, 'leader')) bad('mira o líder sem o vínculo leader');
    if (who === 'person' && (!key || (!personNeed(spec, key) && !metHere(spec, key)))) bad(`mira a pessoa "${key ?? ''}" sem o vínculo person:${key ?? ''}`);
  };
  switch (e.e) {
    case 'stat':
      if (!STORY_STATS.includes(e.stat)) bad(`com indicador desconhecido (${e.stat})`);
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      break;
    case 'cash':
    case 'car':
    case 'seatCost':
    case 'releaseFee':
    case 'relationship':
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      break;
    case 'rivalry':
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      driverTarget(e.who, e.key);
      break;
    case 'sponsorMood':
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      if (e.who === 'bound' && !has(spec, 'sponsor', 'unhappySponsor')) bad('mira o patrocinador vinculado sem o vínculo sponsor/unhappySponsor');
      break;
    case 'dropSponsor':
      if (!has(spec, 'sponsor', 'unhappySponsor')) bad('sem o vínculo sponsor/unhappySponsor');
      break;
    case 'interest':
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      if (e.team === 'interested' && !has(spec, 'interestedTeam')) bad('mira a equipe interessada sem o vínculo interestedTeam');
      if (e.team === 'other' && !has(spec, 'otherTeam')) bad('mira a outra equipe sem o vínculo otherTeam');
      if (e.team === 'person' && (!e.key || (!personNeed(spec, e.key) && !metHere(spec, e.key)))) bad(`mira a equipe da pessoa "${e.key ?? ''}" sem o vínculo`);
      break;
    case 'grid':
      if (!sizeOk(e.size) || e.size < 0) bad(`com tamanho inválido (${e.size})`);
      if (e.who !== 'player') driverTarget(e.who);
      break;
    case 'penaltyPoints':
      if (!sizeOk(e.size) || e.size < 0) bad(`com tamanho inválido (${e.size})`);
      break;
    case 'losePoints':
      if (!has(spec, 'roundPoints')) bad('sem o vínculo roundPoints');
      break;
    case 'attribute':
      if (!ATTRIBUTE_KEYS.includes(e.attribute)) bad(`com atributo desconhecido (${e.attribute})`);
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      break;
    case 'injury':
      if (!e.description.trim()) bad('sem descrição');
      break;
    case 'payCashCall':
    case 'splitCashCall':
      if (!has(spec, 'cashCall')) bad('sem o vínculo cashCall');
      break;
    case 'joinAcademy':
      if (!has(spec, 'academy')) bad('sem o vínculo academy');
      break;
    case 'sponsor':
      if (!SPONSOR_PROFILES.some((p) => p.id === e.profile)) bad(`com perfil de patrocinador que não existe (${e.profile})`);
      break;
    case 'flag':
      if (!/^[a-z0-9-]+$/.test(e.flag)) bad(`com nome de marca fora do padrão (${e.flag}: letras minúsculas, números e hífen)`);
      if (!e.clear && !flagsRead.has(e.flag)) bad(`deixa a marca "${e.flag}", que nenhuma condição lê`);
      break;
    case 'meet': {
      if (!/^[a-z0-9-]+$/.test(e.key)) bad(`com chave de pessoa fora do padrão (${e.key})`);
      if (!e.role.trim()) bad('sem papel');
      if (e.attitude !== undefined && !sizeOk(e.attitude)) bad(`com atitude inválida (${e.attitude})`);
      if ((e.from === 'rival' || e.from === 'newRival') && !has(spec, e.from === 'rival' ? 'rival' : 'newRival'))
        bad(`guarda o ${e.from} sem o vínculo ${e.from}`);
      if (e.from === 'other' && !has(spec, 'other', 'ahead')) bad('guarda o outro piloto sem o vínculo other/ahead');
      if (e.from === 'teammate' && !has(spec, 'teammate')) bad('guarda o companheiro sem o vínculo teammate');
      if (e.from === 'stranger' && !e.org?.trim()) bad('guarda alguém de fora das pistas sem dizer onde ele trabalha (org)');
      break;
    }
    case 'attitude':
      if (!sizeOk(e.size)) bad(`com tamanho inválido (${e.size})`);
      if (!personNeed(spec, e.key) && !metHere(spec, e.key)) bad(`mexe com a pessoa "${e.key}" sem o vínculo person:${e.key}`);
      break;
    case 'joinTeam':
      if (!personNeed(spec, e.key) && !metHere(spec, e.key)) bad(`mexe com a pessoa "${e.key}" sem o vínculo person:${e.key}`);
      if (e.team === 'interested' && !has(spec, 'interestedTeam')) bad('sem o vínculo interestedTeam');
      if (e.team === 'other' && !has(spec, 'otherTeam')) bad('sem o vínculo otherTeam');
      break;
    case 'child':
      if (!spec.when.some((c) => c.c === 'has' && c.what === 'roomForChild')) bad('faz nascer um filho sem a condição has roomForChild');
      break;
    case 'follow': {
      if (!personNeed(spec, e.key) && !metHere(spec, e.key)) bad(`mexe com a pessoa "${e.key}" sem o vínculo person:${e.key}`);
      const drivers = cards.flatMap((c) => allEffects(c.spec)).filter((x) => x.e === 'meet' && x.key === e.key);
      if (drivers.some((x) => x.e === 'meet' && (x.from === 'stranger' || x.from === 'teamBoss')))
        bad(`marca "${e.key}" para acompanhar a carreira, mas ele não é piloto`);
      break;
    }
  }
}

function checkCard(card: Card, problems: string[]): void {
  const { spec, where, chain } = card;
  const bad = (what: string) => problems.push(`${where}: ${what}.`);
  if (!STORY_CATEGORIES.includes(spec.category)) bad(`categoria desconhecida (${spec.category})`);
  if (!/^[a-z0-9-]+$/.test(spec.id)) bad('id fora do padrão (letras minúsculas, números e hífen)');
  for (const need of spec.needs ?? []) {
    if (need.startsWith('person:')) {
      if (!metAnywhere.has(need.slice(7))) bad(`pede a pessoa "${need.slice(7)}", que nenhum efeito guarda`);
    } else if (!NEEDS.has(need)) bad(`vínculo desconhecido (${need})`);
  }
  if (new Set(spec.needs ?? []).size !== (spec.needs ?? []).length) bad('vínculo repetido');
  const startOfSeason = spec.when.some((c) => c.c === 'season' && c.part === 'start');
  if (startOfSeason && (spec.needs ?? []).some((n) => RACE_NEEDS.has(n)))
    bad('é de começo de temporada, mas pede um vínculo que só existe depois de uma corrida');
  if (startOfSeason && spec.when.some((c) => c.c === 'race' || c.c === 'notRace')) bad('é de começo de temporada, mas olha a corrida');
  if (spec.speaker && !personNeed(spec, spec.speaker)) bad(`fala pela pessoa "${spec.speaker}" sem o vínculo person:${spec.speaker}`);
  for (const c of allConditions(spec)) checkCondition(where, c, problems);

  // Escolhas: de duas a três, sempre (mesmo com todas as opções de traço abertas), e pelo menos duas sem condição.
  const ids = spec.choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) bad('id de escolha repetido');
  if (spec.choices.length < 2 || spec.choices.length > 3) bad(`tem ${spec.choices.length} escolhas (são duas ou três)`);
  if (spec.choices.filter((c) => !c.requires?.length).length < 2) bad('tem menos de duas escolhas sempre disponíveis');
  if (spec.choices[0]?.requires?.length) bad('a primeira escolha tem condição (a primeira é a "natural", a que o robô do simulador escolhe)');
  for (const choice of spec.choices) {
    const odds = choice.outcomes.map((o) => o.odds);
    for (const o of odds) if (!STORY_ODDS.includes(o)) bad(`escolha ${choice.id}: chance desconhecida (${o})`);
    if (choice.outcomes.length === 0 || choice.outcomes.length > 3) bad(`escolha ${choice.id}: tem ${choice.outcomes.length} desfechos (um a três)`);
    if (choice.outcomes.length === 1 && odds[0] !== 'sure') bad(`escolha ${choice.id}: desfecho único precisa ser "sure"`);
    if (choice.outcomes.length > 1 && odds.includes('sure')) bad(`escolha ${choice.id}: "sure" com outros desfechos`);
    if (choice.outcomes.length > 1 && odds.filter((o) => o === 'rest').length !== 1)
      bad(`escolha ${choice.id}: desfechos sorteados precisam de exatamente um "rest"`);
    if (odds.includes('academy') && !has(spec, 'academy')) bad(`escolha ${choice.id}: chance "academy" sem o vínculo academy`);
    const fixed = odds.filter((o) => o === 'likely' || o === 'even' || o === 'unlikely');
    const sum = fixed.reduce((s, o) => s + (o === 'likely' ? 0.75 : o === 'even' ? 0.5 : 0.3), 0);
    if (sum >= 1) bad(`escolha ${choice.id}: as chances fixas passam de 100%`);
    for (const outcome of choice.outcomes) {
      for (const e of outcome.effects) checkEffect(card, e, problems);
      if (chain) {
        if (outcome.next === undefined) bad(`escolha ${choice.id}: desfecho de passo de cadeia sem "next" (o passo seguinte ou 'end')`);
        else if (outcome.next !== 'end') {
          const target = outcome.next.step;
          if (!chain.steps.some((s) => s.id === target)) bad(`escolha ${choice.id}: aponta para o passo "${target}", que não existe`);
          if (!STORY_DELAYS.includes(outcome.next.delay)) bad(`escolha ${choice.id}: prazo desconhecido (${outcome.next.delay})`);
        }
      } else if (outcome.next !== undefined) bad(`escolha ${choice.id}: evento avulso com "next" (só passos de cadeia andam)`);
    }
  }

  // Variantes: cada uma com o texto de todas as escolhas e um texto por desfecho.
  if (spec.variants.length === 0) bad('sem variante de texto');
  spec.variants.forEach((v, i) => {
    const keys = Object.keys(v.choices).sort();
    if (keys.join(',') !== [...ids].sort().join(','))
      bad(`variante ${i}: textos de escolha (${keys.join(', ')}) não batem com as escolhas (${ids.join(', ')})`);
    for (const choice of spec.choices) {
      const words = v.choices[choice.id];
      if (!words) continue;
      if (words.outcomes.length !== choice.outcomes.length)
        bad(`variante ${i}, escolha ${choice.id}: ${words.outcomes.length} textos para ${choice.outcomes.length} desfechos`);
      if (!words.label.trim()) bad(`variante ${i}, escolha ${choice.id}: rótulo vazio`);
    }
    for (const text of [v.title, v.body, ...Object.values(v.choices).flatMap((c) => [c.label, ...c.outcomes])]) {
      if (!text.trim()) bad(`variante ${i}: texto vazio`);
      if (/\{[^}]*\{|\}[^{]*\}/.test(text.replace(placeholderPattern, ''))) bad(`variante ${i}: chave solta em "${text}"`);
      if (/[{}]/.test(text.replace(placeholderPattern, ''))) bad(`variante ${i}: marcador mal escrito em "${text}"`);
      for (const p of placeholders(text)) {
        if (p.name === 'categoria') {
          if (p.arg && !CATEGORY_LINKS.has(p.arg)) bad(`variante ${i}: ligação de categoria desconhecida em ${p.raw}`);
        } else if (FREE_PLACEHOLDERS.has(p.name)) {
          if (p.arg) bad(`variante ${i}: ${p.raw} não leva argumento`);
        } else if (p.name === 'antecessor') {
          if (p.arg) bad(`variante ${i}: ${p.raw} não leva argumento`);
          if (!fromSecondGeneration(spec)) bad(`variante ${i}: ${p.raw} num cartão que pode sair na primeira geração (sem generation min 2 nem famousParent)`);
        } else if (p.name === 'bebe') {
          if (p.arg) bad(`variante ${i}: ${p.raw} não leva argumento`);
          if (!bornHere(spec)) bad(`variante ${i}: ${p.raw} num cartão que não faz nascer um filho`);
        } else if (p.name in BOUND_PLACEHOLDERS) {
          if (!has(spec, ...(BOUND_PLACEHOLDERS[p.name] ?? []))) bad(`variante ${i}: ${p.raw} sem o vínculo ${(BOUND_PLACEHOLDERS[p.name] ?? []).join('/')}`);
        } else if (PERSON_PLACEHOLDERS.has(p.name)) {
          if (!p.arg || (!personNeed(spec, p.arg) && !metHere(spec, p.arg))) bad(`variante ${i}: ${p.raw} sem o vínculo person:${p.arg ?? ''}`);
        } else bad(`variante ${i}: marcador desconhecido ${p.raw}`);
      }
    }
  });
}

/* ---------------- Cadeias ---------------- */

interface PathState {
  steps: string[];
  flags: Set<string>;
  people: Set<string>;
}

/** Todos os caminhos do passo inicial ao fim (as cadeias são pequenas e sem ciclo). */
function chainPaths(chain: StoryChainSpec, problems: string[]): PathState[] {
  const paths: PathState[] = [];
  const walk = (stepId: string, state: PathState) => {
    const step = chain.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (state.steps.includes(stepId)) {
      problems.push(`cadeia ${chain.id}: anda em círculo (${[...state.steps, stepId].join(' → ')}).`);
      return;
    }
    // O que o passo exige precisa ter sido criado antes, neste caminho (ou no próprio passo).
    const here = { ...state, steps: [...state.steps, stepId] };
    for (const c of step.when)
      if (c.c === 'flag' && !state.flags.has(c.flag) && !STORY_EVENT_CATALOG.some((e) => allEffects(e).some((x) => x.e === 'flag' && x.flag === c.flag)))
        problems.push(`cadeia ${chain.id}, passo ${stepId}: exige a marca "${c.flag}", que o caminho ${here.steps.join(' → ')} não deixa.`);
    for (const need of step.needs ?? [])
      if (need.startsWith('person:') && !state.people.has(need.slice(7)) && stepId !== chain.start)
        problems.push(`cadeia ${chain.id}, passo ${stepId}: pede a pessoa "${need.slice(7)}", que o caminho ${here.steps.join(' → ')} não guarda.`);
    for (const choice of step.choices)
      for (const outcome of choice.outcomes) {
        const flags = new Set(state.flags);
        const people = new Set(state.people);
        for (const e of outcome.effects) {
          if (e.e === 'flag' && !e.clear) flags.add(e.flag);
          if (e.e === 'meet') people.add(e.key);
        }
        const next = { steps: here.steps, flags, people };
        if (outcome.next === undefined) continue;
        if (outcome.next === 'end') paths.push(next);
        else walk(outcome.next.step, next);
      }
  };
  walk(chain.start, { steps: [], flags: new Set(), people: new Set() });
  return paths;
}

function checkChain(chain: StoryChainSpec, problems: string[]): PathState[] {
  const bad = (what: string) => problems.push(`cadeia ${chain.id}: ${what}.`);
  if (!/^[a-z0-9-]+$/.test(chain.id)) bad('id fora do padrão');
  if (!chain.title.trim() || !chain.summary.trim()) bad('sem nome ou sem resumo');
  const ids = chain.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) bad('id de passo repetido');
  const start = chain.steps.find((s) => s.id === chain.start);
  if (!start) {
    bad(`o passo inicial "${chain.start}" não existe`);
    return [];
  }
  if (start.frequency !== undefined && !STORY_FREQUENCIES.includes(start.frequency)) bad(`frequência desconhecida no passo inicial (${start.frequency})`);
  for (const s of chain.steps) if (s.id !== chain.start && s.frequency !== undefined) bad(`o passo ${s.id} tem frequência, mas só o inicial entra no sorteio`);
  const paths = chainPaths(chain, problems);
  const reached = new Set(paths.flatMap((p) => p.steps));
  for (const id of ids) if (!reached.has(id)) bad(`o passo "${id}" nunca é alcançado a partir do inicial`);
  if (paths.length === 0) bad('nenhum caminho chega ao fim');
  return paths;
}

/* ---------------- Testes ---------------- */

describe('dados dos eventos encadeados (Fase 5)', () => {
  it('ids únicos: eventos, cadeias e perfis de patrocinador', () => {
    const problems: string[] = [];
    const dup = (label: string, list: readonly string[]) => {
      const seen = new Set<string>();
      for (const id of list) {
        if (seen.has(id)) problems.push(`${label} repetido: ${id}.`);
        seen.add(id);
      }
    };
    dup(
      'id de evento',
      STORY_EVENT_CATALOG.map((e) => e.id),
    );
    dup(
      'id de cadeia',
      STORY_CHAINS.map((c) => c.id),
    );
    dup(
      'id de perfil de patrocinador',
      SPONSOR_PROFILES.map((p) => p.id),
    );
    dup(
      'nome de patrocinador',
      SPONSOR_PROFILES.map((p) => p.name),
    );
    expect(problems).toEqual([]);
  });

  it('cada cartão: condições, vínculos, marcadores, escolhas, desfechos e variantes', () => {
    const problems: string[] = [];
    for (const card of cards) checkCard(card, problems);
    for (const e of STORY_EVENT_CATALOG)
      if (!STORY_FREQUENCIES.includes(e.frequency)) problems.push(`evento ${e.id}: frequência desconhecida (${e.frequency}).`);
    expect(problems).toEqual([]);
  });

  it('referências: toda marca lida é deixada por alguém, e toda marca deixada é lida', () => {
    const problems: string[] = [];
    for (const flag of flagsRead) if (!flagsSet.has(flag)) problems.push(`A marca "${flag}" é lida, mas nenhuma escolha a deixa.`);
    for (const flag of flagsSet) if (!flagsRead.has(flag)) problems.push(`A marca "${flag}" é deixada, mas nenhuma condição a lê.`);
    expect(problems).toEqual([]);
  });

  it('referências: toda pessoa citada é guardada, e quem cita pessoa de outra cadeia pede o vínculo', () => {
    const problems: string[] = [];
    for (const card of cards) {
      const used = new Set<string>();
      for (const need of card.spec.needs ?? []) if (need.startsWith('person:')) used.add(need.slice(7));
      for (const key of used) if (!metAnywhere.has(key)) problems.push(`${card.where}: a pessoa "${key}" não é guardada por nenhum efeito.`);
    }
    // Uma pessoa guardada é usada por alguém (ou pelo próprio cartão que a guarda).
    for (const key of metAnywhere) {
      const usedElsewhere = cards.some((c) => personNeed(c.spec, key));
      if (!usedElsewhere) problems.push(`A pessoa "${key}" é guardada, mas nenhum cartão a pede depois.`);
    }
    expect(problems).toEqual([]);
  });

  it('cadeias sem ponta solta: alcançáveis, terminam, sem círculo e com marca e pessoa criadas no caminho', () => {
    const problems: string[] = [];
    for (const chain of STORY_CHAINS) checkChain(chain, problems);
    expect(problems).toEqual([]);
  });

  it('nenhum texto se repete no catálogo inteiro (eventos, cadeias, patrocinadores e lesões)', () => {
    const texts = new Map<string, string[]>();
    const add = (text: string, where: string) => texts.set(text, [...(texts.get(text) ?? []), where]);
    for (const card of cards) {
      card.spec.variants.forEach((v, i) => {
        const at = `${card.where}, variante ${i}`;
        add(v.title, `${at} (título)`);
        add(v.body, `${at} (corpo)`);
        for (const [id, c] of Object.entries(v.choices)) {
          add(c.label, `${at}, escolha ${id}`);
          c.outcomes.forEach((o, j) => {
            add(o, `${at}, escolha ${id}, desfecho ${j}`);
          });
        }
      });
      for (const e of allEffects(card.spec)) if (e.e === 'injury') add(e.description, `${card.where} (lesão)`);
    }
    for (const chain of STORY_CHAINS) add(chain.title, `cadeia ${chain.id} (nome)`);
    for (const p of SPONSOR_PROFILES) for (const [k, text] of Object.entries(p.pitch)) add(text, `patrocinador ${p.id} (${k})`);
    const repeated = [...texts].filter(([, where]) => where.length > 1).map(([text, where]) => `"${text}" em ${where.join(' e ')}`);
    expect(repeated).toEqual([]);
  });

  it('perfis de patrocinador: porte, valor, exigência, personalidade e marcadores da proposta', () => {
    const problems: string[] = [];
    for (const p of SPONSOR_PROFILES) {
      const bad = (what: string) => problems.push(`patrocinador ${p.id}: ${what}.`);
      if (![1, 2, 3].includes(p.tier)) bad(`porte inválido (${p.tier})`);
      if (!['low', 'fair', 'high', 'premium'].includes(p.value)) bad(`faixa de valor desconhecida (${p.value})`);
      if (!['easy', 'normal', 'hard'].includes(p.demand)) bad(`exigência desconhecida (${p.demand})`);
      if (!SPONSOR_PERSONALITIES.includes(p.personality)) bad(`personalidade desconhecida (${p.personality})`);
      if (!p.name.trim() || !p.sector.trim()) bad('sem nome ou ramo');
      for (const [k, text] of Object.entries(p.pitch)) {
        if (!text.trim()) bad(`texto vazio (${k})`);
        for (const ph of placeholders(text)) {
          if (ph.name === 'categoria' ? ph.arg !== undefined && !CATEGORY_LINKS.has(ph.arg) : !SPONSOR_PLACEHOLDERS.has(ph.name) || ph.arg)
            bad(`marcador não permitido na proposta: ${ph.raw} (${k})`);
        }
      }
      const usedByChain = cards.some((c) => allEffects(c.spec).some((e) => e.e === 'sponsor' && e.profile === p.id));
      if (p.chainOnly && !usedByChain) bad('é só de cadeia, mas nenhuma cadeia o usa');
    }
    expect(problems).toEqual([]);
  });

  it('volume: pelo menos 80 eventos avulsos e 10 cadeias de 3 ou mais passos', () => {
    const problems: string[] = [];
    const longChains = STORY_CHAINS.filter((chain) => Math.max(0, ...chainPaths(chain, []).map((p) => p.steps.length)) >= 3);
    expect(STORY_EVENT_CATALOG.length).toBeGreaterThanOrEqual(80);
    expect(longChains.length, problems.join(' ')).toBeGreaterThanOrEqual(10);
  });

  it('as cinco categorias têm cartões, e a pista é a que tem mais; vida pessoal tem peso baixo no sorteio', () => {
    const count = (cat: string) => cards.filter((c) => c.spec.category === cat).length;
    for (const cat of STORY_CATEGORIES) expect(count(cat), cat).toBeGreaterThan(0);
    for (const cat of STORY_CATEGORIES) if (cat !== 'track') expect(count('track'), `pista × ${cat}`).toBeGreaterThanOrEqual(count(cat));
  });

  it('talentos e defeitos nos eventos: o esquentado parte para cima, o carismático responde melhor à imprensa', () => {
    const traitChoices = cards.flatMap((c) => c.spec.choices.filter((ch) => ch.requires?.some((r) => r.c === 'trait' && r.trait === 'hothead')).map(() => c));
    expect(traitChoices.length).toBeGreaterThanOrEqual(3);
    const charisma = cards.filter((c) =>
      c.spec.choices.some((ch) => ch.requires?.some((r) => r.c === 'aptitude' && r.aptitude === 'charisma' && r.level === 'high')),
    );
    expect(charisma.length).toBeGreaterThanOrEqual(3);
    // Cada traço revelado abre pelo menos uma escolha em algum lugar.
    const traits = new Set(cards.flatMap((c) => c.spec.choices.flatMap((ch) => (ch.requires ?? []).flatMap((r) => (r.c === 'trait' ? [r.trait] : [])))));
    expect(traits.size).toBeGreaterThanOrEqual(8);
  });

  it('os perfis de patrocinador dão para 15 temporadas sem repetir: vários por porte', () => {
    for (const tier of [1, 2, 3]) expect(SPONSOR_PROFILES.filter((p) => p.tier === tier && !p.chainOnly).length, `porte ${tier}`).toBeGreaterThanOrEqual(10);
  });
});

describe('dados dos cartões da dinastia (Fase 6)', () => {
  const events = STORY_EVENT_CATALOG;
  const variantsOf = (id: string) => events.find((e) => e.id === id)?.variants.length ?? 0;

  it('filhos que nascem pela vida pessoal: pelo menos dois eventos raros (peso baixo), com três variantes ou mais', () => {
    const births = events.filter((e) => bornHere(e));
    expect(births.length).toBeGreaterThanOrEqual(2);
    for (const e of births) {
      expect(e.category, e.id).toBe('personal');
      expect(e.frequency, e.id).toBe('rare');
      expect(e.variants.length, e.id).toBeGreaterThanOrEqual(3);
      // A escolha natural (a primeira) faz o filho nascer.
      expect(
        e.choices[0]?.outcomes.every((o) => o.effects.some((x) => x.e === 'child')),
        e.id,
      ).toBe(true);
      // E sempre dá para deixar para depois: alguma escolha não faz nascer ninguém.
      expect(
        e.choices.some((c) => c.outcomes.every((o) => !o.effects.some((x) => x.e === 'child'))),
        e.id,
      ).toBe(true);
    }
    // Nenhuma cadeia faz nascer filho: o bebê é sempre de um cartão avulso.
    expect(STORY_CHAINS.flatMap((c) => c.steps).filter(bornHere)).toEqual([]);
  });

  it('imprensa e sobrenome: pelo menos seis eventos de carreira só da segunda geração', () => {
    const press = events.filter((e) => e.category === 'career' && fromSecondGeneration(e));
    expect(press.length).toBeGreaterThanOrEqual(6);
    for (const e of press) expect(e.variants.length, e.id).toBeGreaterThanOrEqual(2);
  });

  it('favorecimento: pelo menos três cartões de quem corre pela equipe da família', () => {
    const favoritism = events.filter((e) => e.when.some((c) => c.c === 'has' && c.what === 'familyTeam'));
    expect(favoritism.length).toBeGreaterThanOrEqual(3);
  });

  it('os cartões que presumem pais pobres e anônimos ficam na primeira geração', () => {
    for (const id of ['pais-brigam-por-dinheiro', 'irmao-quer-correr', 'mudanca-de-casa', 'bicho-de-estimacao']) {
      const spec = events.find((e) => e.id === id);
      expect(spec, id).toBeDefined();
      expect(
        spec?.when.some((c) => c.c === 'generation' && c.max === 1),
        id,
      ).toBe(true);
      expect(variantsOf(id), id).toBeGreaterThan(0);
    }
  });

  it('da segunda geração em diante, nenhum cartão fala de pai e mãe anônimos (um deles é o antecessor, que pode ter morrido)', () => {
    const parents = /\b(sua mãe|seu pai|seus pais|os pais aceitam)\b/i;
    const firstOnly = (spec: StoryCardSpec) => spec.when.some((c) => c.c === 'generation' && c.max === 1);
    const problems: string[] = [];
    for (const card of cards) {
      if (firstOnly(card.spec)) continue;
      card.spec.variants.forEach((v, i) => {
        const texts = [v.title, v.body, ...Object.values(v.choices).flatMap((c) => [c.label, ...c.outcomes])];
        for (const text of texts) if (parents.test(text)) problems.push(`${card.where}, variante ${i}: "${text}"`);
      });
    }
    expect(problems).toEqual([]);
  });
});
