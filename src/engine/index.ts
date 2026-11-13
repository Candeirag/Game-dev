/** API pública do motor do jogo. A UI e a store importam apenas daqui. */
export * from './career/createCareer';
export * from './career/weekend';
export * from './career/season';
export * from './career/selectors';
export * from './career/stats';
export * from './career/development';
export { TRAINING_GROUPS, TRAINABLE_ATTRIBUTES } from './career/training';
export * from './championship/points';
export * from './championship/standings';
export {
  createRaceSim,
  stepRaceLap,
  simulateRemainingRace,
  finalizeRace,
  isRaceFinished,
  gapToLeader,
  type RaceCar,
  type RaceSimState,
  type RaceContext,
} from './simulation/race';
export { overallRating, driverPaceRating, kartRating } from './simulation/performance';
export { createRng, hashSeed } from './rng';
