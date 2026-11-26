/** API pública do motor do jogo. A UI e a store importam apenas daqui. */
export * from './career/createCareer';
export * from './career/weekend';
export * from './career/offseason';
export * from './career/selectors';
export * from './career/stats';
export * from './career/development';
export * from './career/condition';
export * from './career/contracts';
export * from './career/license';
export * from './career/sponsors';
export { ECONOMY, netWorth, incomeTax, stocksValue, seasonRunningCosts, type InvestmentMove, type InvestmentProduct } from './career/economy';
export * from './career/hubs';
export * from './career/paths';
export * from './economy/assets';
export * from './economy/summary';
export * from './dynasty/family';
export { familySeasonEvents, beginSeasonFamily } from './dynasty/familyEvents';
export * from './dynasty/succession';
export * from './dynasty/heritage';
export * from './dynasty/relatives';
export * from './dynasty/lineage';
export * from './dynasty/transition';
export * from './management/team';
export * from './management/executive';
export { MANAGEMENT_EVENT_CHANCE } from './management/events';
export * from './tutorial';
export { MARKET, reachableCategories, teamsOfCategory, updateMarketInterest, targetInterest } from './career/market';
export { RELATION_RULES } from './career/roundEffects';
export { TRAINING_GROUPS, TRAINABLE_ATTRIBUTES } from './career/training';
export * from './championship/points';
export * from './championship/standings';
export { resolveEvent, EVENT_RULES, type EventResolution } from './events/engine';
export * from './story';
export * from './simulation/race';
export * from './broadcast';
export { TYRES, RACE } from './simulation/constants';
export {
  overallRating,
  driverPaceRating,
  carRating,
  conditionEffects,
  tyreCliff,
  tyrePaceLoss,
  tyreState,
  type TyreState,
} from './simulation/performance';
export { rankTeams, teamStrength, buildCategoryField } from './world/generation';
export { createRng, hashSeed, randomSeed, textHash, textHash01 } from './rng';
export { recordSeasonTrend, seasonTrendPoint } from './career/trend';
export * from './birth';
