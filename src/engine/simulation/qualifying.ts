/**
 * Classificação: cada piloto faz algumas tentativas lançadas com pneus novos.
 * A melhor volta válida define o grid. Uma tentativa com erro é invalidada.
 */
import type { Driver, QualifyingApproach, QualifyingEntry, QualifyingResult, SessionWeather, Team, Track, WeekendModifiers } from '@/domain/schemas';
import { QUALIFYING_ATTEMPTS } from '@/data/rules';
import { createRng, gaussian, hashSeed } from '../rng';
import { QUALIFYING_APPROACH_EFFECTS, SIM } from './constants';
import { errorProbability, expectedLapTime, lapNoiseSigma } from './performance';

export interface QualifyingParticipant {
  driver: Driver;
  team: Team;
  approach: QualifyingApproach;
  modifiers: WeekendModifiers;
}

/**
 * Uma volta de classificação é feita no limite, então o risco de erro é
 * bem maior que o de uma volta de corrida: 4 vezes o risco de uma volta normal.
 */
const QUALIFYING_ERROR_MULTIPLIER = 4;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function simulateQualifying(
  participants: readonly QualifyingParticipant[],
  track: Track,
  weather: SessionWeather,
  sessionSeed: number,
): QualifyingResult {
  const raw = participants.map(({ driver, team, approach, modifiers }) => {
    const rng = createRng(hashSeed(sessionSeed, driver.id));
    const effects = QUALIFYING_APPROACH_EFFECTS[approach];
    const attempts: (number | null)[] = [];
    for (let attempt = 0; attempt < QUALIFYING_ATTEMPTS; attempt++) {
      const expected = expectedLapTime({
        attributes: driver.attributes,
        kart: team.kart,
        track,
        weather,
        setupScore: modifiers.setupScore,
        tyreWear: 0,
        paceModifier: effects.pace - modifiers.qualifyingBonus - SIM.TRACK_EVOLUTION_PER_ATTEMPT * attempt,
      });
      const sigma = lapNoiseSigma(driver.attributes, weather, 0) * SIM.QUALIFYING_NOISE_FACTOR;
      const lapTime = expected * (1 + gaussian(rng) * sigma);
      const pError = errorProbability(driver.attributes, weather, 0) * QUALIFYING_ERROR_MULTIPLIER * effects.error;
      attempts.push(rng.next() < pError ? null : round3(lapTime));
    }
    const valid = attempts.filter((t): t is number => t !== null).sort((a, b) => a - b);
    return { driver, team, approach, attempts, valid };
  });

  // Ordena pela melhor volta e, em caso de empate, pela segunda melhor. Quem não marcou
  // tempo vai para o fim do grid, ordenado pelo id para manter o resultado determinístico.
  raw.sort((x, y) => {
    for (let i = 0; i < QUALIFYING_ATTEMPTS; i++) {
      const a = x.valid[i] ?? Infinity;
      const b = y.valid[i] ?? Infinity;
      if (a !== b) return a - b;
    }
    return x.driver.id.localeCompare(y.driver.id);
  });

  const entries: QualifyingEntry[] = raw.map((r, index) => ({
    driverId: r.driver.id,
    teamId: r.team.id,
    approach: r.approach,
    attempts: r.attempts,
    bestLap: r.valid[0] ?? null,
    position: index + 1,
  }));
  return { weather, entries };
}
