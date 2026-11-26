/**
 * Herança e teste no kart (Fase 6).
 *
 * Cada filho nasce com talentos e defeitos de nascença, como o fundador: parte vem do pai ou da mãe
 * (o nascimento ativo), parte é sorteada. Eles agem desde o começo (a evolução de quem aprende
 * rápido ou devagar, por exemplo), mas ficam ocultos até alguém ver a criança pilotar: o teste no
 * kart da adolescência revela alguns, e cada temporada de carreira própria pode revelar mais um.
 * Tudo isso acontece antes da escolha do herdeiro: na sucessão, o jogador escolhe pelo que já se
 * sabe (`heirOutlook`), e o herdeiro piloto recebe um nascimento próprio (`heirBirth`).
 *
 * Os sorteios têm nomes próprios (`child-heritage`, `kart-test`, `child-trait-reveal`,
 * `heir-aptitudes`, `relative-heritage`) e não consomem números de nenhum sorteio que já existia.
 * Os números estão em HERITAGE (`src/config/balance.ts`).
 */
import { BIRTH, HERITAGE } from '@/config/balance';
import {
  APTITUDE_KEYS,
  type Aptitudes,
  type Birth,
  type BirthTrait,
  type CareerState,
  type CategoryId,
  type Child,
  type HeirOption,
  type InboxMessage,
  type KartTestDepth,
  type TraitId,
} from '@/domain/schemas';
import { BIRTH_TRAITS, HOMETOWNS } from '@/data/birth';
import { getCategory } from '@/data/categories';
import { FAMILY } from '@/data/family';
import { KART_TEST_VERDICT_INFO, type KartTestVerdict } from '@/data/heritage';
import { joinList } from '@/domain/text';
import { activeBirth, traitEffect } from '../birth/effects';
import { fillTraits, type TraitComposition } from '../birth/draw';
import { pushMessages } from '../career/inbox';
import { createRng, gaussian, hashSeed, type Rng } from '../rng';

const heritageComposition: TraitComposition = { talents: HERITAGE.TALENTS, defects: HERITAGE.DEFECTS, extra: HERITAGE.EXTRA_TRAITS };

const countKind = (ids: readonly TraitId[], kind: 'talent' | 'defect') => ids.filter((id) => BIRTH_TRAITS[id].kind === kind).length;

/* ------------------------------------------------------------------ */
/* Herança                                                             */
/* ------------------------------------------------------------------ */

/**
 * Os traços do pai ou da mãe que passam para o filho: cada um com HERITAGE.INHERIT_CHANCE, na
 * ordem dos traços do pai ou da mãe, com um número do gerador por traço (sempre consumido). Um
 * traço só passa se ainda couber o mínimo de talentos e defeitos da composição.
 */
export function inheritTraits(parentTraits: readonly BirthTrait[], rng: Rng): TraitId[] {
  const total = heritageComposition.talents + heritageComposition.defects + heritageComposition.extra;
  const chosen: TraitId[] = [];
  for (const trait of parentTraits) {
    const roll = rng.next();
    if (roll >= HERITAGE.INHERIT_CHANCE) continue;
    if (chosen.includes(trait.id) || chosen.includes(BIRTH_TRAITS[trait.id].opposite)) continue;
    const next = [...chosen, trait.id];
    const missing = Math.max(0, heritageComposition.talents - countKind(next, 'talent')) + Math.max(0, heritageComposition.defects - countKind(next, 'defect'));
    if (next.length + missing > total) continue;
    chosen.push(trait.id);
  }
  return chosen;
}

/**
 * Os talentos e defeitos de nascença de um filho: os herdados (ver `inheritTraits`) e o resto
 * sorteado com a mesma lógica do nascimento, até a composição de HERITAGE. Sem repetição, sem os
 * dois lados de um par, com pelo menos um talento e um defeito, todos ocultos.
 */
export function drawHeritageTraits(parentTraits: readonly BirthTrait[], seed: number): BirthTrait[] {
  const rng = createRng(seed);
  return fillTraits(rng, inheritTraits(parentTraits, rng), heritageComposition);
}

/** Os traços de nascença de um filho: os gravados ou, num filho de save antigo, os que ele herda. */
export function heritageTraitsFor(career: CareerState, child: Pick<Child, 'id' | 'birthTraits'>): BirthTrait[] {
  if (child.birthTraits.length > 0) return child.birthTraits;
  return drawHeritageTraits(activeBirth(career)?.traits ?? [], hashSeed(career.seed, 'child-heritage', child.id));
}

/**
 * Dá os traços de nascença aos filhos que ainda não têm (os de saves anteriores à versão 10), com a
 * mesma semente de um filho que nasce agora. Roda no começo de cada temporada, no fechamento do ano
 * da família e na abertura da sucessão.
 */
export function ensureHeritage(career: CareerState): CareerState {
  if (career.family.children.every((c) => c.birthTraits.length > 0)) return career;
  const children = career.family.children.map((c) => (c.birthTraits.length > 0 ? c : { ...c, birthTraits: heritageTraitsFor(career, c) }));
  return { ...career, family: { ...career.family, children } };
}

/** Multiplicador da evolução de um filho pelos traços de nascença (aprende rápido ou devagar). */
export function childTrainingFactor(child: Pick<Child, 'birthTraits'>): number {
  return child.birthTraits.reduce((factor, t) => factor * (traitEffect(t.id).training ?? 1), 1);
}

/**
 * O mesmo multiplicador para os filhos que correm no campeonato do jogador (na equipe do dirigente,
 * por exemplo): por id de piloto, só os diferentes de 1. Lá a evolução é a das etapas
 * (`developAfterRound` e o simulador da equipe); na carreira por fora, é a de `closeChildSeason`.
 */
export function familyTrainingFactors(career: CareerState): Readonly<Record<string, number>> {
  const factors: Record<string, number> = {};
  for (const child of career.family.children) {
    if (!child.driver) continue;
    const factor = childTrainingFactor(child);
    if (factor !== 1) factors[child.driver.id] = factor;
  }
  return factors;
}

/* ------------------------------------------------------------------ */
/* Teste no kart                                                       */
/* ------------------------------------------------------------------ */

/** O filho está na idade do teste no kart (da idade do teste até a véspera da carreira) e ainda não fez. */
export function canTakeKartTest(child: Child): boolean {
  return (
    child.kartTest === null &&
    (child.stage === 'child' || child.stage === 'karting') &&
    child.age >= HERITAGE.KART_TEST_AGE &&
    child.age < FAMILY.CAREER_START_AGE
  );
}

/** O veredito dos instrutores para uma diferença ao tempo de referência (em segundos). */
export function kartTestVerdict(gap: number): KartTestVerdict {
  const bands = HERITAGE.KART_TEST_VERDICTS;
  if (gap <= bands.outstanding) return 'outstanding';
  if (gap <= bands.promising) return 'promising';
  if (gap <= bands.average) return 'average';
  return 'limited';
}

/** Diferença ao tempo de referência: teto, anos de kart e o acaso do dia, em três casas, nunca negativa. */
function kartTestGap(child: Child, rng: Rng): number {
  const g = HERITAGE.KART_TEST_GAP;
  const raw = g.BASE + (g.REFERENCE_TALENT - child.talent) * g.PER_TALENT_POINT - child.kartYears * g.PER_KART_YEAR + gaussian(rng) * g.SD;
  return Math.max(0, Math.round(raw * 1000) / 1000);
}

/** "Gênio na chuva (talento)". */
const traitLabel = (id: TraitId) => `${BIRTH_TRAITS[id].name} (${BIRTH_TRAITS[id].kind === 'talent' ? 'talento' : 'defeito'})`;

/**
 * O teste no kart de um filho: a diferença ao tempo de referência dos instrutores e os traços
 * ocultos que ele revela (HERITAGE.KART_TEST_REVEALS, em ordem sorteada). Cada filho faz o teste
 * uma vez: de novo, nada muda. Manda uma mensagem à caixa com o resultado.
 */
export function applyKartTest(career: CareerState, childId: string, depth: KartTestDepth, season: number = career.season): CareerState {
  const child = career.family.children.find((c) => c.id === childId);
  if (!child || child.kartTest !== null) return career;
  const rng = createRng(hashSeed(career.seed, 'kart-test', childId));
  const gap = kartTestGap(child, rng);
  const hidden = heritageTraitsFor(career, child)
    .filter((t) => t.revealedSeason === null)
    .map((t) => t.id);
  const revealed: TraitId[] = [];
  for (let i = 0; i < HERITAGE.KART_TEST_REVEALS[depth] && hidden.length > 0; i++) {
    const [id] = hidden.splice(Math.floor(rng.next() * hidden.length), 1);
    if (id) revealed.push(id);
  }
  const birthTraits = heritageTraitsFor(career, child).map((t) => (revealed.includes(t.id) ? { ...t, revealedSeason: season, revealedRound: 0 } : t));
  const tested: Child = { ...child, birthTraits, kartTest: { season, depth, gap, revealed } };
  const verdict = KART_TEST_VERDICT_INFO[kartTestVerdict(gap)];
  const found =
    revealed.length > 0
      ? `Ficou claro o que ${child.firstName} traz de nascença: ${joinList(revealed.map(traitLabel))}.`
      : `O teste não deixou claro nenhum talento ou defeito de nascença de ${child.firstName}.`;
  const message: InboxMessage = {
    id: `s${season}-kart-test-${childId}`,
    date: career.calendar[0]?.date ?? `${career.year}-01-01`,
    category: 'family',
    title: `Teste no kart: ${child.firstName}`,
    body: `${child.firstName} fez o teste ${depth === 'full' ? 'completo' : 'rápido'} e ficou a +${gap.toFixed(3)} s do tempo de referência dos instrutores. Veredito: ${verdict.label.toLowerCase()}. ${verdict.comment} ${found}`,
  };
  return {
    ...career,
    family: { ...career.family, children: career.family.children.map((c) => (c.id === childId ? tested : c)) },
    inbox: pushMessages(career.inbox, [message]),
  };
}

/* ------------------------------------------------------------------ */
/* Revelação nas temporadas de carreira própria                        */
/* ------------------------------------------------------------------ */

/**
 * No fechamento de uma temporada de carreira própria (por fora ou no campeonato do jogador), um
 * traço oculto pode aparecer (HERITAGE.SEASON_REVEAL_CHANCE). Devolve o filho e a nota do
 * fechamento do ano (vazia se nada apareceu).
 */
export function revealSeasonTrait(child: Child, career: CareerState): { child: Child; note: string } {
  const hidden = child.birthTraits.filter((t) => t.revealedSeason === null);
  if (hidden.length === 0) return { child, note: '' };
  const rng = createRng(hashSeed(career.seed, career.season, 'child-trait-reveal', child.id));
  if (rng.next() >= HERITAGE.SEASON_REVEAL_CHANCE) return { child, note: '' };
  const trait = hidden[Math.floor(rng.next() * hidden.length)];
  if (!trait) return { child, note: '' };
  const round = Math.max(0, career.calendar.length);
  const birthTraits = child.birthTraits.map((t) => (t.id === trait.id ? { ...t, revealedSeason: career.season, revealedRound: round } : t));
  const info = BIRTH_TRAITS[trait.id];
  return {
    child: { ...child, birthTraits },
    note: `Na temporada, ${child.firstName} mostrou ${info.kind === 'talent' ? 'um talento' : 'um defeito'} de nascença: ${info.name}.`,
  };
}

/* ------------------------------------------------------------------ */
/* O que se sabe de um herdeiro e o nascimento dele                    */
/* ------------------------------------------------------------------ */

/**
 * Avaliação dos treinadores sobre o teto de um filho. Só existe depois de
 * pelo menos um ano de kart (com investimento) ou com a carreira em andamento:
 * antes disso, ninguém viu a criança pilotar.
 */
export function childScoutReport(child: Child): string | null {
  if (child.stage !== 'racing' && child.kartYears < HERITAGE.SCOUT_MIN_KART_YEARS) return null;
  const bands = HERITAGE.SCOUT_BANDS;
  if (child.talent >= bands.outstanding) return 'Fora de série';
  if (child.talent >= bands.veryPromising) return 'Muito promissor';
  if (child.talent >= bands.promising) return 'Promissor';
  if (child.talent >= bands.average) return 'Mediano';
  return 'Limitado';
}

/** Os traços de um parente jovem que herda a carreira sem ser filho: todos sorteados, sem herança. */
function relativeTraits(career: CareerState, driverId: string): BirthTrait[] {
  return drawHeritageTraits([], hashSeed(career.seed, 'relative-heritage', driverId));
}

/** O que se sabe de um herdeiro: público, para a tela da sucessão e para o robô. */
export interface HeirOutlook {
  heirId: string;
  age: number;
  /** Talentos e defeitos já revelados, na ordem dos traços. */
  revealed: readonly { id: TraitId; kind: 'talent' | 'defect' }[];
  /** Quantos traços de nascença ainda estão ocultos. */
  hidden: number;
  /** O teste no kart, se o herdeiro fez. */
  kartTest: { depth: KartTestDepth; gap: number; verdict: KartTestVerdict } | null;
  /** Avaliação dos treinadores (null: ninguém viu pilotar). */
  scout: string | null;
  /** Categoria (e o degrau dela) e equipe em que corre agora (null: não corre). */
  categoryId: CategoryId | null;
  tier: number | null;
  teamName: string | null;
}

export function heirOutlook(career: CareerState, heir: HeirOption): HeirOutlook {
  const child = heir.childId ? career.family.children.find((c) => c.id === heir.childId) : undefined;
  const racing = child ? (child.stage === 'racing' ? child.racing : null) : heir.racing;
  const traits = child ? heritageTraitsFor(career, child) : heir.driver ? relativeTraits(career, heir.driver.id) : [];
  const revealed = traits.filter((t) => t.revealedSeason !== null).map((t) => ({ id: t.id, kind: BIRTH_TRAITS[t.id].kind }));
  const test = child?.kartTest ?? null;
  return {
    heirId: heir.id,
    age: child?.age ?? heir.age,
    revealed,
    hidden: traits.length - revealed.length,
    kartTest: test ? { depth: test.depth, gap: test.gap, verdict: kartTestVerdict(test.gap) } : null,
    scout: child ? childScoutReport(child) : null,
    categoryId: racing?.categoryId ?? null,
    tier: racing ? getCategory(racing.categoryId).tier : null,
    teamName: racing?.teamName ? racing.teamName : null,
  };
}

/** O que fica no lugar das profissões dos pais no nascimento de quem herdou a carreira da família. */
const heirParents = 'dinastia';

/**
 * O nascimento é de quem herdou a carreira da família (`heirBirth`), não de um fundador sorteado: a
 * tela troca as profissões dos pais pela família da dinastia.
 */
export function isHeirBirth(birth: Birth): boolean {
  return birth.origin === 'racer-parent' && birth.parents.mother === heirParents && birth.parents.father === heirParents;
}

/**
 * O nascimento de um herdeiro que assume a família: filho de ex-piloto, nascido na capital (na
 * cidade do antecessor, se ele era de lá), sem economias nem ajuda (o patrimônio vem pela herança),
 * com os traços de nascença que já tinha (com as marcas de revelação) e as aptidões puxadas em
 * parte das do antecessor (HERITAGE.APTITUDE_PARENT_WEIGHT), com o acaso de cada um.
 *
 * `driverId` é o id de piloto do herdeiro; quando ele ainda não corre (um filho que assume os
 * negócios), quem chama passa o id que ele vai ter.
 *
 * Só o filho (nos dois caminhos) e o parente jovem piloto têm nascimento de herdeiro. O parceiro e o
 * parente adulto não são de sangue nem pilotos: não ganham talentos e defeitos de nascença (lança
 * erro, e a sucessão deixa o nascimento como está).
 */
export function heirBirth(career: CareerState, heir: HeirOption, driverId?: string): Birth {
  const child = heir.kind === 'child' && heir.childId ? career.family.children.find((c) => c.id === heir.childId) : undefined;
  if (!child && !(heir.kind === 'relative' && heir.driver)) throw new Error('Só o filho e o parente jovem piloto têm nascimento de herdeiro.');
  const id = driverId ?? child?.driver?.id ?? heir.driver?.id;
  if (!id) throw new Error('O herdeiro ainda não tem id de piloto.');
  const predecessor = activeBirth(career);
  const capital = HOMETOWNS.find((h) => h.region === 'capital');
  if (!capital) throw new Error('Nenhuma cidade da capital.');
  const hometownId = predecessor?.region === 'capital' ? predecessor.hometownId : capital.id;
  const rng = createRng(hashSeed(career.seed, 'heir-aptitudes', id));
  const weight = HERITAGE.APTITUDE_PARENT_WEIGHT;
  const aptitudes = Object.fromEntries(
    APTITUDE_KEYS.map((key) => {
      const parent = predecessor?.aptitudes[key] ?? BIRTH.APTITUDE_MEAN;
      const value = Math.round(weight * parent + (1 - weight) * BIRTH.APTITUDE_MEAN + gaussian(rng) * HERITAGE.APTITUDE_SD);
      return [key, Math.min(HERITAGE.APTITUDE_MAX, Math.max(HERITAGE.APTITUDE_MIN, value))];
    }),
  ) as Aptitudes;
  return {
    driverId: id,
    origin: 'racer-parent',
    rerolls: 0,
    hometownId,
    region: 'capital',
    parents: { mother: heirParents, father: heirParents },
    savings: 0,
    support: { perSeason: 0, seasons: 0 },
    aptitudes,
    traits: child ? heritageTraitsFor(career, child) : relativeTraits(career, id),
    movedSeason: null,
  };
}
