import type { CareerState, PracticeProgram, QualifyingApproach, RaceMode } from '@/domain/schemas';
import {
  buildRaceContext,
  canAcceptOffer,
  completeWeekend,
  createCareer,
  createWeekendRace,
  getCategory,
  getPlayer,
  rankTeams,
  resolveEvent,
  runPractice,
  runQualifying,
  setTrainingFocus,
  simulateAbsentWeekend,
  simulateRemainingRace,
  startNextSeason,
  startWeekend,
  teamsOfCategory,
  TRAINABLE_ATTRIBUTES,
  type NewCareerInput,
} from './engineApi';

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

/**
 * Carreira para simulações longas: foco de treino em velocidade e, opcionalmente,
 * um bônus de talento (pontos somados a todos os atributos treináveis e ao
 * potencial), que representa um jogador que decide melhor que o robô.
 */
export function botCareer(seed: number, talent = 0): CareerState {
  const c = setTrainingFocus(newCareer(seed), 'speed');
  if (talent === 0) return c;
  const drivers = c.drivers.map((d) => {
    if (!d.isPlayer) return d;
    const attributes = { ...d.attributes };
    for (const key of TRAINABLE_ATTRIBUTES) attributes[key] = Math.min(99, attributes[key] + talent);
    return { ...d, attributes, potential: Math.min(99, d.potential + talent / 2) };
  });
  return { ...c, drivers, playerSeasonStartAttributes: { ...drivers.find((d) => d.isPlayer)!.attributes } };
}

export interface Choices {
  program?: PracticeProgram;
  approach?: QualifyingApproach;
  mode?: RaceMode;
  /** Índice da escolha em cada evento pendente (padrão: a primeira). */
  eventChoice?: number;
}

/** Resolve todos os eventos pendentes com a escolha de índice dado. */
export function resolvePending(career: CareerState, choiceIndex = 0): CareerState {
  let c = career;
  while (c.pendingEvents.length > 0) {
    const event = c.pendingEvents[0]!;
    const choice = event.choices[Math.min(choiceIndex, event.choices.length - 1)]!;
    c = resolveEvent(c, event.id, choice.id).career;
  }
  return c;
}

/** Joga uma etapa inteira com o piloto automático. */
export function playRound(career: CareerState, choices: Choices = {}): CareerState {
  let c = startWeekend(resolvePending(career, choices.eventChoice));
  if (!c.weekend!.playerParticipates) return simulateAbsentWeekend(c);
  c = runPractice(c, choices.program ?? 'setup');
  c = runQualifying(c, choices.approach ?? 'balanced');
  const race = simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), { mode: choices.mode ?? 'balanced', auto: true });
  return completeWeekend(c, race);
}

export function playSeason(career: CareerState, choices: Choices = {}): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playRound(c, choices);
  return c;
}

/**
 * Política do robô para o fim de temporada: aceita a melhor proposta que
 * consegue cumprir. Prefere a categoria mais alta e, dentro dela, a equipe
 * mais forte.
 */
export function pickBestOffer(career: CareerState): string {
  const offers = (career.offseason?.offers ?? []).filter((o) => canAcceptOffer(career, o));
  if (offers.length === 0) throw new Error('Nenhuma proposta aceitável (a rede de segurança deveria existir).');
  const strength = (categoryId: CareerState['categoryId'], teamId: string) => {
    const ranked = rankTeams(teamsOfCategory(career, categoryId));
    return ranked.length - ranked.findIndex((t) => t.id === teamId);
  };
  // Dentro da categoria, a equipe mais forte entre as que querem mesmo o piloto (interesse ≥ 60);
  // sem nenhuma assim, a de maior interesse. Evita assinar com uma equipe exigente demais.
  const keen = (o: (typeof offers)[number]) => (o.interest >= 60 || o.kind === 'continue' ? 1 : 0);
  offers.sort(
    (a, b) =>
      getCategory(b.categoryId).tier - getCategory(a.categoryId).tier ||
      keen(b) - keen(a) ||
      (keen(a) ? strength(b.categoryId, b.teamId) - strength(a.categoryId, a.teamId) : b.interest - a.interest),
  );
  return offers[0]!.id;
}

/**
 * Política de treino do robô: velocidade enquanto houver margem (mais de 4
 * pontos até o potencial); depois, o grupo de atributos mais fraco.
 */
export function botTraining(career: CareerState): CareerState {
  const p = getPlayer(career);
  const a = p.attributes;
  if (p.potential - a.pace > 4) return setTrainingFocus(career, 'speed');
  const groups = { racecraft: (a.racecraft + a.defending + a.overtaking) / 3, consistency: (a.consistency + a.focus) / 2, tyres: a.tyreManagement, wet: a.wetSkill } as const;
  const weakest = (Object.entries(groups) as [keyof typeof groups, number][]).sort((x, y) => x[1] - y[1])[0]![0];
  return setTrainingFocus(career, weakest);
}

/** Joga uma carreira por várias temporadas com o robô. Chama `onSeasonEnd` no fechamento de cada uma. */
export function playCareer(career: CareerState, seasons: number, choices: Choices = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  for (let i = 0; i < seasons; i++) {
    c = playSeason(botTraining(c), choices);
    onSeasonEnd?.(c);
    c = startNextSeason(c, pickBestOffer(c));
  }
  return c;
}
