import type { CareerState, PracticeProgram, QualifyingApproach, RaceMode } from '@/domain/schemas';
import {
  buildRaceContext,
  completeWeekend,
  createCareer,
  createWeekendRace,
  runPractice,
  runQualifying,
  simulateRemainingRace,
  startWeekend,
  type NewCareerInput,
} from '@/engine';

export const NOW = '2026-11-13T12:00:00.000Z';

export const DEFAULT_INPUT: NewCareerInput = {
  firstName: 'Ana',
  lastName: 'Teste',
  nationality: 'BR',
  age: 15,
  background: 'natural',
  bonus: { pace: 4, consistency: 4 },
  teamId: 'cerrado',
};

export function newCareer(seed = 12345, input: Partial<NewCareerInput> = {}): CareerState {
  return createCareer({ ...DEFAULT_INPUT, ...input }, seed, NOW);
}

export interface Choices {
  program?: PracticeProgram;
  approach?: QualifyingApproach;
  mode?: RaceMode;
}

export function playRound(career: CareerState, choices: Choices = {}): CareerState {
  let c = startWeekend(career);
  c = runPractice(c, choices.program ?? 'setup');
  c = runQualifying(c, choices.approach ?? 'balanced');
  const race = simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), choices.mode ?? 'balanced');
  return completeWeekend(c, race);
}

export function playSeason(career: CareerState, choices: Choices = {}): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playRound(c, choices);
  return c;
}
