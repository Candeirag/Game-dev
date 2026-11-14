/**
 * Motor de corrida. Não depende da interface nem do estado da carreira:
 * basta um RaceContext (pista, categoria, pilotos, equipes) e um grid.
 */
export * from './types';
export { createRaceSim, stepRaceLap, simulateRemainingRace, isRaceFinished, gapToLeader } from './step';
export { finalizeRace, gridDropsFromRace } from './finalize';
export { buildStrategyOptions, chooseAiStrategy, bestCompoundFor, decidePit, type StrategyOption } from './strategy';
export { buildWetnessProfile, conditionFor } from './weatherProfile';
