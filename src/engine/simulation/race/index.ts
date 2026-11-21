/**
 * Motor de corrida. Não depende da interface nem do estado da carreira:
 * basta um RaceContext (pista, categoria, pilotos, equipes) e um grid.
 */
export * from './types';
export { createRaceSim, stepRaceLap, simulateRemainingRace, isRaceFinished, gapToLeader } from './step';
export { finalizeRace, gridDropsFromRace } from './finalize';
export {
  buildStrategyOptions,
  chooseAiStrategy,
  bestCompoundFor,
  decidePit,
  baseWearPerLap,
  compoundLifeLaps,
  pitWindow,
  type StrategyOption,
  type PitWindow,
} from './strategy';
export { chooseByStyle, drivingStyle, drivingStyleScore, upcomingMoment, type DrivingStyle } from './moments';
export { cleanAirLapTime } from './pace';
export { stressedCorner } from './radio';
export { buildWetnessProfile, conditionFor } from './weatherProfile';
