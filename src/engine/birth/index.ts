/** Nascimento (Fase 2): sorteio, efeitos ao longo da carreira, revelação dos traços e mudança. */
export { birthAttributeBonus, birthPotentialBonus, birthScore, drawBirth, maxBirthRerolls } from './draw';
export {
  activeBirth,
  birthRaceProfile,
  birthTrainingFactor,
  hasTrait,
  interiorWeighs,
  isDebutRound,
  livesInInterior,
  longRaceWeight,
  sponsorSatisfactionBonus,
  sponsorValueFactor,
  traitEffect,
} from './effects';
export { moveEventFor, relocate } from './move';
export { revealTraits, revealTriggers, startPositionChange, type RevealContext } from './reveal';
