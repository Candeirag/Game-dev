/**
 * Classificação. Dois formatos, conforme a categoria:
 *
 * - Sessão única: cada piloto faz três tentativas lançadas com pneus novos e a
 *   melhor volta válida define o grid.
 * - Eliminatória (F1): três fases. A cada fase, cada piloto faz duas
 *   tentativas e o quarto mais lento do grid inicial é eliminado, ficando com
 *   as posições do fundo. A fase final decide as primeiras posições.
 *
 * Uma tentativa com erro é invalidada. Depois da sessão, punições de grid
 * herdadas de corridas anteriores deslocam os punidos para trás.
 */
import type { Driver, QualifyingApproach, QualifyingEntry, QualifyingResult, SessionWeather, Team, Track, WeekendModifiers } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { QUALIFYING_ATTEMPTS } from '@/data/rules';
import { createRng, gaussian, hashSeed, type Rng } from '../rng';
import { QUALIFYING_APPROACH_EFFECTS, SIM } from './constants';
import { conditionEffects, errorProbability, expectedLapTime, lapNoiseSigma } from './performance';

export interface QualifyingParticipant {
  driver: Driver;
  team: Team;
  approach: QualifyingApproach;
  modifiers: WeekendModifiers;
}

export type QualifyingCategory = Pick<CategoryDefinition, 'lapTimeFactor' | 'carFactor' | 'qualifyingFormat'>;

/**
 * Uma volta de classificação é feita no limite, então o risco de erro é
 * bem maior que o de uma volta de corrida: 4 vezes o risco de uma volta normal.
 */
const QUALIFYING_ERROR_MULTIPLIER = 4;
const KNOCKOUT_ATTEMPTS_PER_SEGMENT = 2;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function attemptLap(
  p: QualifyingParticipant,
  rng: Rng,
  track: Track,
  weather: SessionWeather,
  category: QualifyingCategory,
  evolutionStep: number,
): number | null {
  const effects = QUALIFYING_APPROACH_EFFECTS[p.approach];
  const cond = conditionEffects(p.driver.condition, p.driver.injury);
  const expected = expectedLapTime({
    attributes: p.driver.attributes,
    car: p.team.car,
    track,
    weather,
    setupScore: p.modifiers.setupScore,
    tyreWear: 0,
    paceModifier: effects.pace + cond.pace - p.modifiers.qualifyingBonus - SIM.TRACK_EVOLUTION_PER_ATTEMPT * evolutionStep,
    lapTimeFactor: category.lapTimeFactor,
    carFactor: category.carFactor,
  });
  const sigma = lapNoiseSigma(p.driver.attributes, weather, 0) * SIM.QUALIFYING_NOISE_FACTOR * cond.noise;
  const lapTime = expected * (1 + gaussian(rng) * sigma);
  const pError = errorProbability(p.driver.attributes, weather, 0) * QUALIFYING_ERROR_MULTIPLIER * effects.error * cond.error;
  return rng.next() < pError ? null : round3(lapTime);
}

interface Row {
  p: QualifyingParticipant;
  attempts: (number | null)[];
  /** Voltas válidas da última fase disputada, em ordem crescente. */
  valid: number[];
  eliminatedIn?: 'Q1' | 'Q2';
}

/** Ordena pela melhor volta; em caso de empate, pela segunda melhor; por fim, pelo id (determinístico). */
function byLapTimes(x: Row, y: Row): number {
  const n = Math.max(x.valid.length, y.valid.length, 1);
  for (let i = 0; i < n; i++) {
    const a = x.valid[i] ?? Infinity;
    const b = y.valid[i] ?? Infinity;
    if (a !== b) return a - b;
  }
  return x.p.driver.id.localeCompare(y.p.driver.id);
}

export function simulateQualifying(
  participants: readonly QualifyingParticipant[],
  track: Track,
  weather: SessionWeather,
  sessionSeed: number,
  category: QualifyingCategory = { lapTimeFactor: 1, carFactor: 1, qualifyingFormat: 'single' },
  gridPenalties: Readonly<Record<string, number>> = {},
): QualifyingResult {
  // Cada piloto tem a própria sequência de sorte, usada ao longo de toda a sessão.
  const rngs = new Map(participants.map((p) => [p.driver.id, createRng(hashSeed(sessionSeed, p.driver.id))]));
  const rngOf = (id: string) => rngs.get(id) ?? createRng(hashSeed(sessionSeed, id));
  let ordered: Row[];

  if (category.qualifyingFormat === 'single') {
    ordered = participants.map((p) => {
      const attempts = Array.from({ length: QUALIFYING_ATTEMPTS }, (_, i) => attemptLap(p, rngOf(p.driver.id), track, weather, category, i));
      return { p, attempts, valid: attempts.filter((t): t is number => t !== null).sort((a, b) => a - b) };
    });
    ordered.sort(byLapTimes);
  } else {
    const cut = Math.floor(participants.length / 4);
    const active: Row[] = participants.map((p) => ({ p, attempts: [], valid: [] }));
    const eliminated: Row[] = [];
    (['Q1', 'Q2', 'Q3'] as const).forEach((segment, segmentIndex) => {
      for (const row of active) {
        const laps = Array.from({ length: KNOCKOUT_ATTEMPTS_PER_SEGMENT }, (_, i) =>
          attemptLap(row.p, rngOf(row.p.driver.id), track, weather, category, segmentIndex * KNOCKOUT_ATTEMPTS_PER_SEGMENT + i),
        );
        row.attempts.push(...laps);
        row.valid = laps.filter((t): t is number => t !== null).sort((a, b) => a - b);
      }
      active.sort(byLapTimes);
      if (segment !== 'Q3' && cut > 0 && active.length > cut) {
        const out = active.splice(active.length - cut, cut).map((row) => ({ ...row, eliminatedIn: segment }));
        eliminated.unshift(...out);
      }
    });
    ordered = [...active, ...eliminated];
  }

  // Punições de grid: o punido cai o número de posições devido; em caso de empate, fica atrás.
  const penalized = ordered
    .map((row, index) => {
      const drop = gridPenalties[row.p.driver.id] ?? 0;
      return { row, drop, key: index + drop + (drop > 0 ? 0.5 : 0), index };
    })
    .sort((a, b) => a.key - b.key || a.index - b.index);

  const entries: QualifyingEntry[] = penalized.map(({ row, drop }, index) => ({
    driverId: row.p.driver.id,
    teamId: row.p.team.id,
    approach: row.p.approach,
    attempts: row.attempts,
    bestLap: row.valid[0] ?? null,
    position: index + 1,
    ...(row.eliminatedIn ? { eliminatedIn: row.eliminatedIn } : {}),
    gridPenalty: drop,
  }));
  return { weather, entries };
}
