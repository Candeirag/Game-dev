/**
 * Simulador sem interface: cria carreiras, joga com o robô (`sim/policy.ts`) e mede o que
 * interessa para o equilíbrio do jogo. É o que `npm run sim` executa e o que cada fase usa para
 * comparar o antes e o depois de uma mudança de regra.
 *
 * Tudo aqui é determinístico: a carreira da semente N é sempre a mesma, do perfil do piloto ao
 * último resultado. Por isso o relatório de duas execuções com os mesmos argumentos é idêntico,
 * e uma diferença entre duas versões do código é sempre efeito do código.
 */
import type { CareerState, CategoryId, Offer } from '@/domain/schemas';
import { CATEGORIES, getCategory } from '@/data/categories';
import type { PlayerBackground } from '@/data/rules';
import * as engine from '@/engine';
import { botTraining, pickBestOffer, playRound, resolvePending, withTalent, type Choices } from './policy';

/** Data fixa de criação das carreiras: o relógio não entra na simulação. */
const CREATED_AT = '2027-01-01T00:00:00.000Z';

export interface SimOptions {
  /** Quantas carreiras (uma por semente, a partir de `firstSeed`). */
  seeds: number;
  /** Temporadas jogadas em cada carreira. */
  seasons: number;
  firstSeed: number;
  /** Bônus de talento do piloto (0 = o robô puro; ver `withTalent`). */
  talent: number;
}

export const DEFAULT_SIM_OPTIONS: SimOptions = { seeds: 50, seasons: 15, firstSeed: 1, talent: 0 };

/**
 * A política simples do simulador, num lugar só: treino de acerto, classificação e corrida
 * equilibradas (com o engenheiro automático), primeira opção em cada evento, a melhor proposta
 * que der para aceitar no fim do ano e o treino escolhido por `botTraining`.
 */
export const SIM_CHOICES: Choices = { program: 'setup', approach: 'balanced', mode: 'balanced', eventChoice: 0 };

/**
 * A população da amostra, congelada de propósito: os perfis, as idades e as equipes de estreia
 * entre os quais cada semente sorteia o seu piloto. Se uma fase acrescentar um perfil ou uma
 * equipe de entrada ao jogo, estas listas NÃO acompanham sozinhas: os 50 pilotos da linha de base
 * continuam os mesmos, e os relatórios de fases diferentes continuam comparáveis. Mexer aqui é
 * trocar a linha de base (regrave `docs/simulador/` e diga no PR).
 */
export const SIM_POPULATION = {
  backgrounds: ['natural', 'technical', 'fighter'],
  ages: [14, 15, 16, 17],
  teamIds: ['horizonte', 'cerrado', 'garagem'],
} as const satisfies { backgrounds: readonly PlayerBackground[]; ages: readonly number[]; teamIds: readonly string[] };

/** Como o piloto conseguiu a vaga de uma temporada: a inicial ou o tipo da proposta aceita. */
export type SeatOrigin = 'initial' | Offer['kind'];

/**
 * Por que o piloto ficou só com a rede de segurança: nenhuma equipe fez proposta; havia proposta
 * e o que faltou foi dinheiro para bancar a vaga; ou faltou outro requisito (licença, reputação,
 * experiência, idade).
 */
export type NoSeatCause = 'no-offer' | 'money' | 'requirements';

export interface SeasonSample {
  /** Temporada da carreira (1 = a de estreia). */
  season: number;
  categoryId: CategoryId;
  tier: number;
  /** Idade do piloto durante a temporada. */
  age: number;
  /** Posição final no campeonato. */
  position: number;
  wins: number;
  podiums: number;
  title: boolean;
  /** Dinheiro em caixa depois do fechamento do ano (impostos, juros e rendimentos já lançados). */
  cash: number;
  netWorth: number;
  reputation: number;
  /** Nota geral do piloto ao fim da temporada. */
  overall: number;
  /** Etapas em que o piloto não correu (lesão ou suspensão). */
  roundsMissed: number;
  seat: SeatOrigin;
  /** Só nas temporadas disputadas pela rede de segurança: o motivo. */
  noSeatCause: NoSeatCause | null;
  /** Propostas de equipes para o ano seguinte, sem contar a rede de segurança: quantas vieram e quantas o piloto podia aceitar. */
  offersMade: number;
  offers: number;
}

export interface CareerProfile {
  background: PlayerBackground;
  age: number;
  teamId: string;
}

export interface CareerSample {
  seed: number;
  profile: CareerProfile;
  seasons: SeasonSample[];
  /** 'completed' = jogou todas as temporadas pedidas; 'succession' = a carreira passou a um herdeiro antes disso. */
  ended: 'completed' | 'succession';
}

/**
 * Perfil do piloto de cada semente: perfil inicial, idade e equipe de estreia variam com a
 * semente, para a amostra cobrir os começos possíveis. Os pontos livres vão sempre para
 * velocidade e consistência, como faria um jogador que lê as descrições.
 */
export function profileForSeed(seed: number): CareerProfile {
  const rng = engine.createRng(engine.hashSeed(seed, 'sim-profile'));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)] as T;
  return { background: pick(SIM_POPULATION.backgrounds), age: pick(SIM_POPULATION.ages), teamId: pick(SIM_POPULATION.teamIds) };
}

export function createSimCareer(seed: number, talent = 0): CareerState {
  const profile = profileForSeed(seed);
  const career = engine.createCareer(
    { firstName: 'Piloto', lastName: `Semente ${seed}`, nationality: 'BR', bonus: { pace: 4, consistency: 4 }, ...profile },
    seed,
    CREATED_AT,
  );
  return withTalent(career, talent);
}

/** Propostas de equipes no fechamento (sem a rede de segurança) e, se nenhuma serve, o que faltou. */
function seatMarket(career: CareerState): { made: number; acceptable: number; cause: NoSeatCause | null } {
  const offers = (career.offseason?.offers ?? []).filter((o) => o.kind !== 'fallback');
  const acceptable = offers.filter((o) => engine.canAcceptOffer(career, o)).length;
  if (acceptable > 0) return { made: offers.length, acceptable, cause: null };
  if (offers.length === 0) return { made: 0, acceptable: 0, cause: 'no-offer' };
  // Faltou só dinheiro em pelo menos uma proposta: com caixa, o piloto teria a vaga.
  const onlyMoney = offers.some((o) =>
    engine
      .offerRequirements(career, o)
      .filter((r) => !r.met)
      .every((r) => r.key === 'finance'),
  );
  return { made: offers.length, acceptable: 0, cause: onlyMoney ? 'money' : 'requirements' };
}

function sampleSeason(career: CareerState, index: number, seat: SeatOrigin, noSeatCause: NoSeatCause | null): SeasonSample {
  const offseason = career.offseason;
  if (!offseason) throw new Error('Temporada sem fechamento.');
  const player = engine.getPlayer(career);
  const category = getCategory(career.categoryId);
  const market = seatMarket(career);
  return {
    season: index,
    categoryId: category.id,
    tier: category.tier,
    age: player.age,
    position: offseason.playerPosition,
    wins: offseason.wins,
    podiums: offseason.podiums,
    title: offseason.playerPosition === 1,
    cash: career.finance.cash,
    netWorth: Math.round(engine.netWorth(career.finance)),
    reputation: career.reputation,
    overall: engine.overallRating(player.attributes),
    roundsMissed: career.rounds.filter((r) => !r.race.entries.some((e) => e.driverId === player.id)).length,
    seat,
    noSeatCause: seat === 'fallback' ? noSeatCause : null,
    offersMade: market.made,
    offers: market.acceptable,
  };
}

/** Joga uma carreira com o robô e devolve uma linha por temporada disputada. */
export function simulateCareer(seed: number, options: Pick<SimOptions, 'seasons' | 'talent'>): CareerSample {
  const profile = profileForSeed(seed);
  const seasons: SeasonSample[] = [];
  let index = 1;
  try {
    let career = createSimCareer(seed, options.talent);
    let seat: SeatOrigin = 'initial';
    let cause: NoSeatCause | null = null;
    for (; index <= options.seasons; index++) {
      career = botTraining(career);
      while (career.nextRoundIndex < career.calendar.length && !career.succession) career = playRound(career, SIM_CHOICES);
      // Um acidente fatal no meio do ano encerra a amostra sem contar a temporada incompleta.
      if (!career.offseason) return { seed, profile, seasons, ended: 'succession' };
      // As decisões que a última etapa deixou pendentes são resolvidas antes de fechar as contas e
      // escolher a proposta, como faz o jogador.
      if (!career.succession) career = resolvePending(career, SIM_CHOICES.eventChoice);
      seasons.push(sampleSeason(career, index, seat, cause));
      if (career.succession) return { seed, profile, seasons, ended: 'succession' };
      if (index === options.seasons) break;
      const offerId = pickBestOffer(career);
      seat = career.offseason?.offers.find((o) => o.id === offerId)?.kind ?? 'fallback';
      cause = seat === 'fallback' ? seatMarket(career).cause : null;
      career = engine.startNextSeason(career, offerId);
    }
    return { seed, profile, seasons, ended: 'completed' };
  } catch (error) {
    // Uma carreira que quebra tem de dizer qual foi: é com a semente que se reproduz o defeito.
    throw new Error(`A carreira da semente ${seed} falhou na temporada ${index}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/* ------------------------------------------------------------------ */
/* Agregados                                                           */
/* ------------------------------------------------------------------ */

export interface CategoryStats {
  categoryId: CategoryId;
  tier: number;
  /** Temporadas disputadas na categoria, somando todas as carreiras. */
  seasons: number;
  /** Carreiras que passaram pela categoria. */
  careers: number;
  averagePosition: number;
  medianPosition: number;
  bestPosition: number;
  /** Fração das temporadas terminadas entre os três primeiros. */
  top3Share: number;
  titles: number;
}

export interface CashStats {
  season: number;
  careers: number;
  p10: number;
  median: number;
  p90: number;
  /** Fração das carreiras com o caixa negativo no fim da temporada. */
  negativeShare: number;
  medianNetWorth: number;
}

export interface ArrivalStats {
  categoryId: CategoryId;
  tier: number;
  /** Carreiras que chegaram ao degrau. */
  careers: number;
  share: number;
  averageAge: number;
  minAge: number;
  maxAge: number;
  /** Temporada da carreira, em média, em que o piloto estreou no degrau. */
  averageSeason: number;
}

export interface SimSummary {
  options: SimOptions;
  careers: number;
  seasonsPlayed: number;
  averageStartAge: number;
  byCategory: CategoryStats[];
  cashBySeason: CashStats[];
  arrivals: ArrivalStats[];
  top: { categoryId: CategoryId; careers: number; share: number };
  /** Carreiras por degrau mais alto alcançado (índice 0 = degrau 1). */
  highestTier: number[];
  titles: { total: number; perCareer: number; max: number; none: number; one: number; two: number; threeOrMore: number };
  /**
   * Temporadas em que o piloto só correu graças à rede de segurança, e por quê: nenhuma equipe
   * fez proposta (`noOffer`), havia proposta e faltou dinheiro (`money`) ou faltou outro requisito
   * (`requirements`).
   */
  noSeat: { seasons: number; perCareer: number; careers: number; share: number; noOffer: number; money: number; requirements: number };
  /** Temporadas em que o piloto desceu de degrau (por proposta ou pela rede de segurança). */
  demotions: { seasons: number; perCareer: number; careers: number };
  /** Maior sequência de temporadas no mesmo degrau, em média por carreira. */
  longestStay: number;
  roundsMissedPerSeason: number;
  /** Carreiras que passaram a um herdeiro (morte ou acidente) antes de completar as temporadas pedidas. */
  interrupted: number;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => (values.length ? sum(values) / values.length : 0);

/** Percentil pelo método do posto mais próximo (0,5 = mediana). */
export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] ?? 0;
}

function longestStay(seasons: readonly SeasonSample[]): number {
  let best = 0;
  let run = 0;
  seasons.forEach((s, i) => {
    run = i > 0 && seasons[i - 1]?.tier === s.tier ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function summarize(samples: readonly CareerSample[], options: SimOptions): SimSummary {
  const all = samples.flatMap((s) => s.seasons);
  const careers = samples.length;
  const share = (count: number) => (careers ? count / careers : 0);

  const byCategory = CATEGORIES.flatMap((category): CategoryStats[] => {
    const rows = all.filter((s) => s.categoryId === category.id);
    if (rows.length === 0) return [];
    const positions = rows.map((s) => s.position);
    return [
      {
        categoryId: category.id,
        tier: category.tier,
        seasons: rows.length,
        careers: samples.filter((c) => c.seasons.some((s) => s.categoryId === category.id)).length,
        averagePosition: mean(positions),
        medianPosition: percentile(positions, 0.5),
        bestPosition: Math.min(...positions),
        top3Share: rows.filter((s) => s.position <= 3).length / rows.length,
        titles: rows.filter((s) => s.title).length,
      },
    ];
  });

  const cashBySeason = Array.from({ length: options.seasons }, (_, i): CashStats | null => {
    const rows = all.filter((s) => s.season === i + 1);
    if (rows.length === 0) return null;
    const cash = rows.map((s) => s.cash);
    return {
      season: i + 1,
      careers: rows.length,
      p10: percentile(cash, 0.1),
      median: percentile(cash, 0.5),
      p90: percentile(cash, 0.9),
      negativeShare: rows.filter((s) => s.cash < 0).length / rows.length,
      medianNetWorth: percentile(
        rows.map((s) => s.netWorth),
        0.5,
      ),
    };
  }).filter((row): row is CashStats => row !== null);

  const arrivals = CATEGORIES.flatMap((category): ArrivalStats[] => {
    const firsts = samples.flatMap((c) => c.seasons.find((s) => s.categoryId === category.id) ?? []);
    if (firsts.length === 0) return [];
    const ages = firsts.map((s) => s.age);
    return [
      {
        categoryId: category.id,
        tier: category.tier,
        careers: firsts.length,
        share: share(firsts.length),
        averageAge: mean(ages),
        minAge: Math.min(...ages),
        maxAge: Math.max(...ages),
        averageSeason: mean(firsts.map((s) => s.season)),
      },
    ];
  });

  const topCategory = CATEGORIES.reduce((top, c) => (c.tier > top.tier ? c : top));
  const reachedTop = samples.filter((c) => c.seasons.some((s) => s.categoryId === topCategory.id)).length;
  const highestTier = CATEGORIES.map((category) => samples.filter((c) => Math.max(0, ...c.seasons.map((s) => s.tier)) === category.tier).length);

  const titlesPerCareer = samples.map((c) => c.seasons.filter((s) => s.title).length);
  const noSeatPerCareer = samples.map((c) => c.seasons.filter((s) => s.seat === 'fallback').length);
  const demotionsPerCareer = samples.map((c) => c.seasons.filter((s, i) => i > 0 && s.tier < (c.seasons[i - 1]?.tier ?? s.tier)).length);

  return {
    options,
    careers,
    seasonsPlayed: all.length,
    averageStartAge: mean(samples.map((c) => c.profile.age)),
    byCategory,
    cashBySeason,
    arrivals,
    top: { categoryId: topCategory.id, careers: reachedTop, share: share(reachedTop) },
    highestTier,
    titles: {
      total: sum(titlesPerCareer),
      perCareer: mean(titlesPerCareer),
      max: Math.max(0, ...titlesPerCareer),
      none: titlesPerCareer.filter((n) => n === 0).length,
      one: titlesPerCareer.filter((n) => n === 1).length,
      two: titlesPerCareer.filter((n) => n === 2).length,
      threeOrMore: titlesPerCareer.filter((n) => n >= 3).length,
    },
    noSeat: {
      seasons: sum(noSeatPerCareer),
      perCareer: mean(noSeatPerCareer),
      careers: noSeatPerCareer.filter((n) => n > 0).length,
      share: share(noSeatPerCareer.filter((n) => n > 0).length),
      noOffer: all.filter((s) => s.noSeatCause === 'no-offer').length,
      money: all.filter((s) => s.noSeatCause === 'money').length,
      requirements: all.filter((s) => s.noSeatCause === 'requirements').length,
    },
    demotions: { seasons: sum(demotionsPerCareer), perCareer: mean(demotionsPerCareer), careers: demotionsPerCareer.filter((n) => n > 0).length },
    longestStay: mean(samples.map((c) => longestStay(c.seasons))),
    roundsMissedPerSeason: mean(all.map((s) => s.roundsMissed)),
    interrupted: samples.filter((c) => c.ended === 'succession').length,
  };
}

export interface SimResult {
  samples: CareerSample[];
  summary: SimSummary;
}

/** Roda todas as carreiras pedidas. `onCareer` recebe o progresso (para a linha de comando). */
export function runSimulation(options: SimOptions, onCareer?: (done: number, total: number) => void): SimResult {
  const samples: CareerSample[] = [];
  for (let i = 0; i < options.seeds; i++) {
    samples.push(simulateCareer(options.firstSeed + i, options));
    onCareer?.(i + 1, options.seeds);
  }
  return { samples, summary: summarize(samples, options) };
}
