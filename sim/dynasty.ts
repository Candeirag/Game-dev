/**
 * A dinastia no simulador (Fase 6): depois das temporadas da amostra, a carreira de cada semente
 * continua até a 2ª geração, e a seção 11 do relatório compara as duas.
 *
 * A 1ª geração segue como piloto até SIM_DYNASTY.RETIRE_AGE, faz o ano de transição, vira dirigente
 * (compra uma equipe se o caixa permitir, aceita um cargo ou acompanha de fora) e passa o comando em
 * vida quando um filho com carreira de piloto chega a HEIR_RACING_AGE; sem filho piloto, aos
 * HANDOVER_AGE anos (o parente jovem herda). Morrer antes também abre a sucessão. O robô escolhe o
 * herdeiro e a vaga dele pelo que se vê (`botChooseHeir`: entre os filhos que já correm; o parente
 * jovem só sem filho piloto), e a 2ª geração corre até RETIRE_AGE ou, no máximo, GEN2_MAX_SEASONS
 * temporadas, aceitando a proposta da equipe da família quando ela está no degrau mais alto ao
 * alcance (`OfferPreference.familyTeam`). O bônus de talento do simulador vale para o piloto de cada
 * geração (`heirTakesOver`).
 *
 * Nada aqui sorteia: são as decisões do robô (`policy.ts`) sobre a API pública do motor. Em cada
 * fechamento e em cada sucessão, a carreira passa pela conferência de integridade e pelo formato do
 * save; um estado inválido para a simulação com a semente e a temporada.
 */
import {
  CareerStateSchema,
  RELATIVE_PATHS,
  TRANSITION_ROLES,
  type CareerState,
  type HeirOption,
  type RelativePath,
  type Succession,
  type TransitionRole,
} from '@/domain/schemas';
import { CATEGORIES, getCategory } from '@/data/categories';
import type { KartTestVerdict } from '@/data/heritage';
import * as engine from '@/engine';
import { validateCareerIntegrity } from '@/persistence/integrity';
import {
  botChooseHeir,
  botExecutiveOffseason,
  botHeirScore,
  botOffseason,
  botSuccession,
  botTraining,
  botWantsHandover,
  playExecutiveRound,
  playRound,
  resolvePending,
  withTalent,
  type Choices,
  type LifePolicy,
} from './policy';
import type { SeasonSample } from './run';

/** A política do robô na dinastia: as idades e os limites da amostra (política do robô, não regra do jogo). */
export const SIM_DYNASTY = {
  /** Idade em que cada geração pendura o capacete (a do robô de sempre). */
  RETIRE_AGE: 36,
  /** Passa o comando em vida quando um filho com carreira de piloto chega a esta idade. */
  HEIR_RACING_AGE: 18,
  /** Sem filho piloto, passa o comando a esta idade (o parente jovem herda). */
  HANDOVER_AGE: 60,
  /** A 2ª geração corre no máximo estas temporadas na amostra (ou até RETIRE_AGE, o que vier antes). */
  GEN2_MAX_SEASONS: 22,
  /** Passos (temporadas, sucessões) de uma dinastia antes de o simulador desistir dela: um laço sem fim é defeito. */
  MAX_STEPS: 200,
} as const;

/** A política de vida do robô na dinastia, com as escolhas de corrida do simulador. */
export function dynastyPolicy(choices: Choices): LifePolicy {
  return {
    retireAge: SIM_DYNASTY.RETIRE_AGE,
    heir: 'driver',
    heirChoice: 'outlook',
    buyTeam: true,
    transitionFirst: true,
    familyTeamFirst: true,
    handoverAge: SIM_DYNASTY.HANDOVER_AGE,
    handoverHeirAge: SIM_DYNASTY.HEIR_RACING_AGE,
    choices,
  };
}

/* ------------------------------------------------------------------ */
/* Amostras                                                            */
/* ------------------------------------------------------------------ */

/** Uma temporada de piloto de uma geração da família. */
export interface DynastySeason {
  /** Idade durante a temporada. */
  age: number;
  tier: number;
  position: number;
  wins: number;
  title: boolean;
  /** Correu pela equipe da família (a participação de 100% na equipe do contrato). */
  familyTeam: boolean;
}

/**
 * Como a vida de piloto de uma geração terminou na amostra: pendurou o capacete, morreu (de idade ou
 * num acidente) ou chegou ao limite de temporadas da amostra (só a 2ª geração).
 */
export type GenerationEnd = 'retired' | 'death' | 'accident' | 'limit';

export interface GenerationSample {
  /** Idade e degrau na primeira temporada como piloto da família. */
  startAge: number;
  startTier: number;
  /** Temporadas completas como piloto da família, na ordem (as da 1ª geração começam pelas da amostra). */
  seasons: DynastySeason[];
  end: GenerationEnd;
}

/** O herdeiro que o robô escolheu, como a tela da sucessão o mostrava. */
export interface HeirSample {
  kind: 'child' | 'relative';
  age: number;
  /** Degrau em que corria na escolha (0: não corria) e temporadas de carreira própria até ali. */
  tier: number;
  ownSeasons: number;
  /** Traços de nascença que já se sabiam e os ainda ocultos. */
  revealed: number;
  hidden: number;
  kartTest: KartTestVerdict | null;
  /** A pontuação do robô (`botHeirScore`). */
  score: number;
  seat: engine.HeirSeat;
  /** As vagas que estavam ao alcance dele. */
  seats: engine.HeirSeat[];
}

export interface SuccessionSample {
  cause: Succession['cause'];
  /** Idade de quem passou a família adiante. */
  formerAge: number;
  estate: number;
  tax: number;
  siblingsShare: number;
  /** O que ficou para o herdeiro: o patrimônio menos o imposto e a parte dos irmãos. */
  inherited: number;
  /** Filhos na sucessão, os que tinham carreira de piloto e os que fizeram o teste no kart. */
  children: number;
  racingChildren: number;
  kartTests: number;
  /** Traços de nascença dos filhos: quantos já se sabiam na hora da escolha, de quantos. */
  childTraitsRevealed: number;
  childTraits: number;
  heir: HeirSample;
  /** Parentes novos (os filhos que não herdaram), por caminho. */
  relatives: Record<RelativePath, number>;
}

/** O que a 1ª geração fez depois de parar de correr: o papel do ano de transição e as temporadas em cada situação. */
export interface AfterDrivingSample {
  transition: TransitionRole | null;
  transitionSeasons: number;
  owner: number;
  principal: number;
  none: number;
}

export interface DynastySample {
  gen1: GenerationSample;
  /** null: a carreira não chegou à 2ª geração. */
  gen2: GenerationSample | null;
  succession: SuccessionSample | null;
  afterDriving: AfterDrivingSample;
}

/** Confere a carreira: integridade e formato do save. Lança erro com o que estiver errado. */
function checkCareer(career: CareerState): void {
  const problems = validateCareerIntegrity(career);
  const parsed = CareerStateSchema.safeParse(career);
  const issues = parsed.success ? [] : parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (problems.length > 0 || issues.length > 0) throw new Error(`estado inválido: ${[...problems, ...issues].join('; ')}`);
}

const fromSeasonSample = (s: SeasonSample): DynastySeason => ({
  age: s.age,
  tier: s.tier,
  position: s.position,
  wins: s.wins,
  title: s.title,
  familyTeam: false,
});

/** A temporada de piloto que acabou de fechar. */
function closedSeason(career: CareerState): DynastySeason {
  const off = career.offseason;
  if (!off) throw new Error('Temporada sem fechamento.');
  return {
    age: engine.getPlayer(career).age,
    tier: getCategory(career.categoryId).tier,
    position: off.playerPosition,
    wins: off.wins,
    title: off.playerPosition === 1,
    familyTeam: engine.racesForFamilyTeam(career),
  };
}

function countRelatives(career: CareerState, before: number): Record<RelativePath, number> {
  const fresh = career.dynasty.relatives.slice(before);
  return Object.fromEntries(RELATIVE_PATHS.map((path) => [path, fresh.filter((r) => r.path === path).length])) as Record<RelativePath, number>;
}

/** A sucessão como foi: o que a família tinha, o que se sabia do herdeiro e o que ele recebeu. */
function successionSample(before: CareerState, after: CareerState, heir: HeirOption, seat: engine.HeirSeat): SuccessionSample {
  const succession = before.succession;
  if (!succession) throw new Error('Sucessão sem registro.');
  const outlook = engine.heirOutlook(before, heir);
  const child = heir.childId ? before.family.children.find((c) => c.id === heir.childId) : undefined;
  const racing = child?.racing ?? heir.racing;
  const children = before.family.children;
  const traits = children.flatMap((c) => c.birthTraits);
  // O registro de quem saiu guarda o patrimônio passado adiante, já sem o imposto e a parte dos irmãos.
  const inherited = after.dynasty.lineage[after.dynasty.lineage.length - 2]?.netWorthPassed ?? 0;
  return {
    cause: succession.cause,
    formerAge: engine.getPlayer(before).age,
    estate: succession.estate,
    tax: succession.tax,
    siblingsShare: Math.max(0, Math.round(succession.estate - succession.tax - inherited)),
    inherited,
    children: children.length,
    racingChildren: children.filter((c) => c.stage === 'racing' && c.driver !== null && c.racing !== null).length,
    kartTests: children.filter((c) => c.kartTest !== null).length,
    childTraitsRevealed: traits.filter((t) => t.revealedSeason !== null).length,
    childTraits: traits.length,
    heir: {
      kind: heir.kind === 'child' ? 'child' : 'relative',
      age: outlook.age,
      tier: outlook.tier ?? 0,
      ownSeasons: racing?.seasons.length ?? 0,
      revealed: outlook.revealed.length,
      hidden: outlook.hidden,
      kartTest: outlook.kartTest?.verdict ?? null,
      score: botHeirScore(outlook),
      seat,
      seats: engine
        .heirSeatOptions(before, heir.id)
        .filter((o) => o.available)
        .map((o) => o.id),
    },
    relatives: countRelatives(after, before.dynasty.relatives.length),
  };
}

/** Uma temporada da 1ª geração fora das pistas, no fechamento: no ano de transição, dona de equipe, chefe contratada ou sem equipe. */
function countAfterDriving(after: AfterDrivingSample, career: CareerState): void {
  if (career.transition?.season === career.season) after.transitionSeasons++;
  else if (career.management?.position === 'owner') after.owner++;
  else if (career.management) after.principal++;
  else after.none++;
}

/**
 * O herdeiro assume: a escolha do robô na sucessão e o bônus de talento do simulador, que vale para o
 * piloto de cada geração (o da semente o recebe na criação; o herdeiro, ao assumir o carro). O bônus
 * representa um jogador que decide melhor que o robô, e é o mesmo jogador que segue com o herdeiro.
 */
export function heirTakesOver(career: CareerState, policy: LifePolicy, talent: number): CareerState {
  return withTalent(botSuccession(career, policy), talent);
}

/** De onde a dinastia continua: as temporadas da amostra, a idade de estreia, as escolhas e o talento do simulador. */
export interface DynastyStart {
  /** As temporadas da amostra, que abrem a vida de piloto da 1ª geração. */
  firstSeasons: readonly SeasonSample[];
  startAge: number;
  choices: Choices;
  /** Bônus de talento (`withTalent`): vale também para o herdeiro, ao assumir o carro. */
  talent: number;
}

/**
 * Continua a carreira da semente a partir de onde a amostra parou (o fechamento da última temporada
 * pedida, com as decisões pendentes resolvidas, ou uma sucessão aberta) até o fim da 2ª geração.
 * `onStep`, se houver, vê a carreira a cada passo (o começo, cada decisão e o fim): só lê, para os
 * testes conferirem.
 */
export function continueDynasty(seed: number, start: CareerState, from: DynastyStart, onStep?: (career: CareerState) => void): DynastySample {
  const { firstSeasons, startAge, choices, talent } = from;
  const policy = dynastyPolicy(choices);
  const gen1: GenerationSample = { startAge, startTier: firstSeasons[0]?.tier ?? 1, seasons: firstSeasons.map(fromSeasonSample), end: 'limit' };
  let gen2: GenerationSample | null = null;
  let succession: SuccessionSample | null = null;
  const afterDriving: AfterDrivingSample = { transition: null, transitionSeasons: 0, owner: 0, principal: 0, none: 0 };
  let c = start;
  try {
    for (let step = 0; ; step++) {
      if (step > SIM_DYNASTY.MAX_STEPS) throw new Error(`a dinastia não terminou em ${SIM_DYNASTY.MAX_STEPS} passos`);
      onStep?.(c);
      const gen: GenerationSample = c.dynasty.generation >= 2 && gen2 ? gen2 : gen1;

      if (c.succession) {
        // Quem morre correndo encerra a vida de piloto da geração ali.
        if (c.mode === 'driver') gen.end = c.succession.cause === 'accident' ? 'accident' : 'death';
        if (gen === gen2) break; // a 2ª geração morreu: a amostra acaba aqui
        const choice = botChooseHeir(c);
        const heir = c.succession.heirs.find((h) => h.id === choice?.heirId);
        if (!choice || !heir) throw new Error('sucessão sem herdeiro que possa correr');
        const before = c;
        c = heirTakesOver(c, policy, talent);
        checkCareer(c);
        succession = successionSample(before, c, heir, choice.seat);
        gen2 = { startAge: engine.getPlayer(c).age, startTier: getCategory(c.categoryId).tier, seasons: [], end: 'limit' };
        continue;
      }

      if (c.mode === 'driver') {
        if (c.nextRoundIndex < c.calendar.length) {
          c = botTraining(c);
          while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playRound(c, choices);
          // Um acidente fatal no meio do ano: a temporada incompleta não conta.
          if (!c.offseason) continue;
          checkCareer(c);
          gen.seasons.push(closedSeason(c));
          if (c.succession) continue;
          c = resolvePending(c, choices.eventChoice);
        }
        const age = engine.getPlayer(c).age;
        if (gen === gen2) {
          if (age >= SIM_DYNASTY.RETIRE_AGE || gen.seasons.length >= SIM_DYNASTY.GEN2_MAX_SEASONS) {
            gen.end = age >= SIM_DYNASTY.RETIRE_AGE ? 'retired' : 'limit';
            onStep?.(c);
            break;
          }
        } else if (age >= SIM_DYNASTY.RETIRE_AGE) {
          gen1.end = 'retired';
          c = engine.retireFromDriving(c);
          continue;
        }
        const next = botOffseason(c, { familyTeam: policy.familyTeamFirst });
        c = engine.startNextSeason(next.career, next.offerId);
        continue;
      }

      // Fora das pistas (só a 1ª geração): a temporada como dirigente e o fechamento.
      if (c.nextRoundIndex < c.calendar.length) {
        while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playExecutiveRound(c, choices);
        checkCareer(c);
        countAfterDriving(afterDriving, c);
        if (c.succession) continue;
      }
      if (botWantsHandover(c, policy)) {
        c = engine.beginHandover(resolvePending(c));
        continue;
      }
      c = botExecutiveOffseason(c, policy);
      if (c.transition && !afterDriving.transition) afterDriving.transition = c.transition.role;
    }
  } catch (error) {
    // A semente e a temporada reproduzem o defeito.
    throw new Error(
      `A dinastia da semente ${seed} falhou na temporada ${c.season} (${c.dynasty.generation}ª geração): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return { gen1, gen2, succession, afterDriving };
}

/* ------------------------------------------------------------------ */
/* Agregados                                                           */
/* ------------------------------------------------------------------ */

/** Uma geração em todas as carreiras. */
export interface GenerationStats {
  careers: number;
  /** Temporadas completas como piloto, em média por carreira. */
  seasonsPerCareer: number;
  averageStartAge: number;
  averageStartTier: number;
  averageHighestTier: number;
  /** Carreiras por degrau mais alto alcançado (índice 0 = degrau 1). */
  highestTier: number[];
  /** Parcela das carreiras que chegou aos monopostos (4º degrau ou mais) e ao topo. */
  formulaShare: number;
  topShare: number;
  titlesPerCareer: number;
  winsPerCareer: number;
  maxTitles: number;
  /** Parcela das temporadas com título. */
  titleSeasonShare: number;
}

/** Quem herdou as pistas: um filho ou uma filha que já corria, ou o parente jovem. */
export type HeirKind = HeirSample['kind'];
export const HEIR_KINDS = ['child', 'relative'] as const satisfies readonly HeirKind[];

/** O que a comparação pela semente põe lado a lado nas duas gerações da mesma carreira. */
export const PAIRED_MEASURES = ['tier', 'titles', 'wins', 'topSeasons'] as const;
export type PairedMeasure = (typeof PAIRED_MEASURES)[number];

/** Carreiras em que a 2ª geração ficou acima da 1ª numa medida, igual ou abaixo. */
export interface PairedCount {
  more: number;
  same: number;
  less: number;
}

/** Medianas da herança num grupo de sucessões. */
export interface InheritanceStats {
  successions: number;
  estate: number;
  tax: number;
  siblingsShare: number;
  inherited: number;
}

export interface DynastyStats {
  careers: number;
  /** Carreiras que chegaram à 2ª geração: herdeiro filho ou filha que já corria, ou o parente jovem (sem filho piloto). */
  reached: number;
  childHeir: number;
  relativeHeir: number;
  /** Sucessões em que o parente jovem herdou com um filho piloto na família (a política do robô não deixa: tem de dar zero). */
  relativeOverRacingChild: number;
  /** Como a 1ª geração passou a família adiante, e com que idade em média. */
  causes: Record<Succession['cause'], number>;
  averageFormerAge: number;
  gen1: GenerationStats;
  gen2: GenerationStats;
  /**
   * A 2ª geração por quem herdou. O parente jovem nasce na sucessão, com potencial próprio, sem herança
   * de traços nem teste no kart: só os filhos herdeiros medem as regras da dinastia.
   */
  gen2ByHeir: Record<HeirKind, GenerationStats>;
  /**
   * Comparação pareada pela semente (carreiras com as duas gerações), em cada medida: degrau mais alto,
   * títulos, vitórias e temporadas no topo. `pairedChild`, só nas carreiras em que um filho herdou.
   */
  paired: Record<PairedMeasure, PairedCount>;
  pairedChild: Record<PairedMeasure, PairedCount>;
  /** Medianas da herança, por quem herdou (com o parente herdeiro, o motor não dá parte aos filhos). */
  inheritance: Record<HeirKind, InheritanceStats>;
  /**
   * De onde o herdeiro largou, e em quantas sucessões cada vaga estava ao alcance. `current` conta
   * também o parente jovem, que não corria: `relativeCurrent` diz quantos (largam numa equipe do kart
   * regional).
   */
  seats: Record<engine.HeirSeat, number> & { relativeCurrent: number; topAvailable: number; familyAvailable: number };
  /** Os filhos herdeiros na hora da escolha (médias; do parente jovem não se sabe nada). */
  heir: { heirs: number; age: number; tier: number; ownSeasons: number; revealed: number; hidden: number; kartTested: number };
  /** A família na sucessão: filhos por família, famílias sem filhos, filhos com carreira, testes no kart e traços conhecidos. */
  family: {
    childrenPerFamily: number;
    childless: number;
    racingChildrenPerFamily: number;
    children: number;
    kartTests: number;
    traitsRevealed: number;
    traits: number;
  };
  relatives: Record<RelativePath, number>;
  /** Papel do ano de transição da 1ª geração (`none`: não fez). */
  transition: Record<TransitionRole, number> & { none: number };
  /** Temporadas da 1ª geração depois de parar de correr, em média por carreira. */
  afterDriving: { transition: number; owner: number; principal: number; none: number };
  /** Temporadas da 2ª geração pela equipe da família, e em quantas carreiras. */
  familyTeam: { seasons: number; careers: number };
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => (values.length ? sum(values) / values.length : 0);
/** Mediana pelo posto mais próximo, como os percentis do relatório. */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length / 2) - 1)] ?? 0;
}

/** O degrau mais alto em que a geração correu (o da estreia conta, mesmo sem temporada completa). */
export const highestTierOf = (gen: GenerationSample) => Math.max(gen.startTier, ...gen.seasons.map((s) => s.tier));

const TOP_TIER = Math.max(...CATEGORIES.map((c) => c.tier));

/** O valor de uma geração numa medida da comparação pela semente. */
export function pairedValue(gen: GenerationSample, measure: PairedMeasure): number {
  switch (measure) {
    case 'tier':
      return highestTierOf(gen);
    case 'titles':
      return gen.seasons.filter((s) => s.title).length;
    case 'wins':
      return sum(gen.seasons.map((s) => s.wins));
    case 'topSeasons':
      return gen.seasons.filter((s) => s.tier >= TOP_TIER).length;
  }
}

function pairedCounts(dynasties: readonly { gen1: GenerationSample; gen2: GenerationSample }[]): Record<PairedMeasure, PairedCount> {
  const count = (measure: PairedMeasure): PairedCount => {
    const deltas = dynasties.map((d) => pairedValue(d.gen2, measure) - pairedValue(d.gen1, measure));
    return { more: deltas.filter((x) => x > 0).length, same: deltas.filter((x) => x === 0).length, less: deltas.filter((x) => x < 0).length };
  };
  return Object.fromEntries(PAIRED_MEASURES.map((measure) => [measure, count(measure)])) as Record<PairedMeasure, PairedCount>;
}

function inheritanceStats(successions: readonly SuccessionSample[]): InheritanceStats {
  return {
    successions: successions.length,
    estate: median(successions.map((s) => s.estate)),
    tax: median(successions.map((s) => s.tax)),
    siblingsShare: median(successions.map((s) => s.siblingsShare)),
    inherited: median(successions.map((s) => s.inherited)),
  };
}

export function generationStats(gens: readonly GenerationSample[]): GenerationStats {
  const highest = gens.map(highestTierOf);
  const titles = gens.map((g) => g.seasons.filter((s) => s.title).length);
  const seasons = gens.flatMap((g) => g.seasons);
  return {
    careers: gens.length,
    seasonsPerCareer: mean(gens.map((g) => g.seasons.length)),
    averageStartAge: mean(gens.map((g) => g.startAge)),
    averageStartTier: mean(gens.map((g) => g.startTier)),
    averageHighestTier: mean(highest),
    highestTier: CATEGORIES.map((category) => highest.filter((tier) => tier === category.tier).length),
    formulaShare: gens.length ? highest.filter((tier) => tier >= 4).length / gens.length : 0,
    topShare: gens.length ? highest.filter((tier) => tier >= TOP_TIER).length / gens.length : 0,
    titlesPerCareer: mean(titles),
    winsPerCareer: mean(gens.map((g) => sum(g.seasons.map((s) => s.wins)))),
    maxTitles: Math.max(0, ...titles),
    titleSeasonShare: seasons.length ? seasons.filter((s) => s.title).length / seasons.length : 0,
  };
}

export function dynastyStats(dynasties: readonly DynastySample[]): DynastyStats {
  const reached = dynasties.filter((d): d is DynastySample & { gen2: GenerationSample } => d.gen2 !== null);
  const reachedBy = (kind: HeirKind) => reached.filter((d) => d.succession?.heir.kind === kind);
  const successions = dynasties.flatMap((d) => d.succession ?? []);
  const successionsBy = (kind: HeirKind) => successions.filter((s) => s.heir.kind === kind);
  const heirs = successions.map((s) => s.heir);
  const childHeirs = heirs.filter((h) => h.kind === 'child');
  const transitions = dynasties.map((d) => d.afterDriving.transition);
  const byHeir = <T>(build: (kind: HeirKind) => T) => Object.fromEntries(HEIR_KINDS.map((kind) => [kind, build(kind)])) as Record<HeirKind, T>;
  return {
    careers: dynasties.length,
    reached: reached.length,
    childHeir: childHeirs.length,
    relativeHeir: heirs.length - childHeirs.length,
    relativeOverRacingChild: successions.filter((s) => s.heir.kind === 'relative' && s.racingChildren > 0).length,
    causes: {
      handover: successions.filter((s) => s.cause === 'handover').length,
      death: successions.filter((s) => s.cause === 'death').length,
      accident: successions.filter((s) => s.cause === 'accident').length,
    },
    averageFormerAge: mean(successions.map((s) => s.formerAge)),
    gen1: generationStats(dynasties.map((d) => d.gen1)),
    gen2: generationStats(reached.map((d) => d.gen2)),
    gen2ByHeir: byHeir((kind) => generationStats(reachedBy(kind).map((d) => d.gen2))),
    paired: pairedCounts(reached),
    pairedChild: pairedCounts(reachedBy('child')),
    inheritance: byHeir((kind) => inheritanceStats(successionsBy(kind))),
    seats: {
      current: heirs.filter((h) => h.seat === 'current').length,
      top: heirs.filter((h) => h.seat === 'top').length,
      family: heirs.filter((h) => h.seat === 'family').length,
      relativeCurrent: heirs.filter((h) => h.seat === 'current' && h.kind === 'relative').length,
      topAvailable: heirs.filter((h) => h.seats.includes('top')).length,
      familyAvailable: heirs.filter((h) => h.seats.includes('family')).length,
    },
    heir: {
      heirs: childHeirs.length,
      age: mean(childHeirs.map((h) => h.age)),
      tier: mean(childHeirs.map((h) => h.tier)),
      ownSeasons: mean(childHeirs.map((h) => h.ownSeasons)),
      revealed: mean(childHeirs.map((h) => h.revealed)),
      hidden: mean(childHeirs.map((h) => h.hidden)),
      kartTested: childHeirs.filter((h) => h.kartTest !== null).length,
    },
    family: {
      childrenPerFamily: mean(successions.map((s) => s.children)),
      childless: successions.filter((s) => s.children === 0).length,
      racingChildrenPerFamily: mean(successions.map((s) => s.racingChildren)),
      children: sum(successions.map((s) => s.children)),
      kartTests: sum(successions.map((s) => s.kartTests)),
      traitsRevealed: sum(successions.map((s) => s.childTraitsRevealed)),
      traits: sum(successions.map((s) => s.childTraits)),
    },
    relatives: Object.fromEntries(RELATIVE_PATHS.map((path) => [path, sum(successions.map((s) => s.relatives[path]))])) as Record<RelativePath, number>,
    transition: {
      ...(Object.fromEntries(TRANSITION_ROLES.map((role) => [role, transitions.filter((t) => t === role).length])) as Record<TransitionRole, number>),
      none: transitions.filter((t) => t === null).length,
    },
    afterDriving: {
      transition: mean(dynasties.map((d) => d.afterDriving.transitionSeasons)),
      owner: mean(dynasties.map((d) => d.afterDriving.owner)),
      principal: mean(dynasties.map((d) => d.afterDriving.principal)),
      none: mean(dynasties.map((d) => d.afterDriving.none)),
    },
    familyTeam: {
      seasons: sum(reached.map((d) => d.gen2.seasons.filter((s) => s.familyTeam).length)),
      careers: reached.filter((d) => d.gen2.seasons.some((s) => s.familyTeam)).length,
    },
  };
}
