/**
 * Treino livre. Cada piloto completa uma série de voltas seguindo um programa
 * de trabalho. O resultado mais importante não é o tempo, e sim os
 * modificadores do fim de semana (acerto, preparação para a classificação e
 * gestão de pneus) que o programa escolhido produz.
 */
import type { Driver, PracticeEntry, PracticeProgram, PracticeResult, SessionWeather, Team, Track, WeekendModifiers } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { PRACTICE_LAPS } from '@/data/rules';
import { createRng, gaussian, hashSeed } from '../rng';
import { PRACTICE_PROGRAM_EFFECTS } from './constants';
import { conditionEffects, errorProbability, expectedLapTime, lapNoiseSigma, tyreWearPerLap } from './performance';

export interface PracticeParticipant {
  driver: Driver;
  team: Team;
  program: PracticeProgram;
}

/**
 * Desvio do resultado do acerto: nem todo trabalho de box dá certo. Com 0,2,
 * cerca de dois terços dos fins de semana ficam a ±0,2 da média do piloto,
 * o que equivale a uns ±0,07 s por volta: a mesma ordem de grandeza da
 * diferença de talento no pelotão da frente.
 */
const SETUP_NOISE = 0.2;
/** Uma volta com erro no treino é descartada (piloto aborta a volta). */
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Qualidade do acerto (0 a 1). Pilotos experientes e de boa leitura dão um
 * retorno melhor aos mecânicos, e um bom chassi tem uma janela de acerto mais
 * ampla. O programa "setup" soma o maior bônus.
 */
export function computeSetupScore(driver: Driver, team: Team, program: PracticeProgram, noise: number): number {
  const a = driver.attributes;
  const feedback = (a.experience * 0.45 + a.racecraft * 0.35 + team.car.chassis * 0.2) / 100;
  // Base fixa de 0,2: qualquer equipe chega a um acerto razoável. O retorno do piloto
  // vale até 0,35 e define a diferença entre um acerto bom e um ótimo.
  const raw = 0.2 + feedback * 0.35 + PRACTICE_PROGRAM_EFFECTS[program].setupBonus + noise * SETUP_NOISE;
  return round3(Math.min(1, Math.max(0, raw)));
}

export function simulatePractice(
  participants: readonly PracticeParticipant[],
  track: Track,
  weather: SessionWeather,
  sessionSeed: number,
  category: Pick<CategoryDefinition, 'lapTimeFactor' | 'carFactor'> = { lapTimeFactor: 1, carFactor: 1 },
): PracticeResult {
  const entries: PracticeEntry[] = participants.map(({ driver, team, program }) => {
    // Cada piloto tem a própria sequência de sorte: a escolha de um não altera a dos outros.
    const rng = createRng(hashSeed(sessionSeed, driver.id));
    const effects = PRACTICE_PROGRAM_EFFECTS[program];
    const cond = conditionEffects(driver.condition, driver.injury);
    const setupScore = computeSetupScore(driver, team, program, gaussian(rng));
    const modifiers: WeekendModifiers = {
      setupScore,
      qualifyingBonus: effects.qualifyingBonus,
      tyreWearFactor: effects.tyreWearFactor,
    };

    let bestLap = Infinity;
    let tyreWear = 0;
    for (let lap = 0; lap < PRACTICE_LAPS; lap++) {
      // O acerto evolui durante a sessão: começa cru e chega ao valor final.
      const sessionSetup = setupScore * ((lap + 1) / PRACTICE_LAPS);
      const expected = expectedLapTime({
        attributes: driver.attributes,
        car: team.car,
        track,
        weather,
        setupScore: sessionSetup,
        tyreWear,
        paceModifier: cond.pace,
        ...category,
      });
      const sigma = lapNoiseSigma(driver.attributes, weather, 0) * cond.noise;
      const lapTime = expected * (1 + gaussian(rng) * sigma);
      const aborted = rng.next() < errorProbability(driver.attributes, weather, 0) * cond.error;
      if (!aborted) bestLap = Math.min(bestLap, lapTime);
      tyreWear += tyreWearPerLap(driver.attributes, track, weather, 1, modifiers.tyreWearFactor);
    }
    // Garantia: se todas as voltas foram abortadas (praticamente impossível), usa a volta esperada.
    if (!Number.isFinite(bestLap)) {
      bestLap = expectedLapTime({ attributes: driver.attributes, car: team.car, track, weather, setupScore, tyreWear: 0, paceModifier: 0, ...category });
    }
    return { driverId: driver.id, teamId: team.id, program, bestLap: round3(bestLap), lapsCompleted: PRACTICE_LAPS, modifiers };
  });

  entries.sort((x, y) => x.bestLap - y.bestLap);
  return { weather, entries };
}
