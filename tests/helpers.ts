import type { CareerState, PracticeProgram, QualifyingApproach, RaceMode } from '@/domain/schemas';
import * as engine from './engineApi';
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

/* ------------------------------------------------------------------ */
/* Fase 3: vida inteira (piloto → dirigente → sucessão)                */
/* ------------------------------------------------------------------ */

export interface LifePolicy {
  /** Idade em que o robô pendura o capacete. */
  retireAge?: number;
  /** Na sucessão, prefere um herdeiro que corra (padrão) ou um que só administre. */
  heir?: 'driver' | 'executive';
  /** Compra uma equipe se o dinheiro em caixa cobrir o preço com folga. */
  buyTeam?: boolean;
  /** Como dirigente, passa o comando em vida ao chegar a esta idade. */
  handoverAge?: number;
  choices?: Choices;
}

/** Joga uma etapa no modo dirigente (o jogador não corre). */
export function playExecutiveRound(career: CareerState, choices: Choices = {}): CareerState {
  const c = engine.startWeekend(resolvePending(career, choices.eventChoice));
  return engine.simulateAbsentWeekend(c, { program: choices.program ?? 'setup', approach: choices.approach ?? 'balanced' });
}

/** Decisão do robô no fechamento de uma temporada como dirigente. */
export function botExecutiveOffseason(career: CareerState, policy: LifePolicy = {}): CareerState {
  let c = resolvePending(career, policy.choices?.eventChoice);
  const off = c.executiveOffseason;
  if (!off) throw new Error('Sem fechamento de dirigente.');
  if (c.management && !off.dismissed) {
    // Preenche as cotas de patrocínio com as propostas mais altas.
    for (const offer of [...off.sponsorOffers].sort((a, b) => b.perSeason - a.perSeason)) {
      if ((c.management?.sponsors.length ?? 3) < 3) c = engine.acceptTeamSponsor(c, offer.id);
    }
    return engine.startExecutiveSeason(c, { kind: 'continue' });
  }
  if (policy.buyTeam) {
    const affordable = off.listings.filter((l) => l.price <= c.finance.cash * 0.6).sort((a, b) => b.price - a.price)[0];
    if (affordable) return engine.startExecutiveSeason(c, { kind: 'buy', listingId: affordable.id });
  }
  const job = off.jobOffers[0];
  if (job) return engine.startExecutiveSeason(c, { kind: 'job', offerId: job.id });
  return engine.startExecutiveSeason(c, { kind: 'spectate' });
}

/** Escolha do robô em uma sucessão. */
export function botSuccession(career: CareerState, policy: LifePolicy = {}): CareerState {
  const heirs = career.succession?.heirs ?? [];
  const preferDriver = (policy.heir ?? 'driver') === 'driver';
  const driver = heirs.find((h) => h.kind === 'child' && h.canDrive) ?? heirs.find((h) => h.canDrive);
  const manager = heirs.find((h) => h.kind === 'child' && h.canManage) ?? heirs.find((h) => h.kind === 'partner') ?? heirs.find((h) => h.canManage);
  const pick = preferDriver ? (driver ?? manager) : (manager ?? driver);
  if (!pick) throw new Error('Sucessão sem herdeiro.');
  return engine.resolveSuccession(career, pick.id, pick === driver && (preferDriver || !manager) ? 'driver' : pick.canManage && !(preferDriver && pick.canDrive) ? 'executive' : 'driver');
}

/**
 * Joga uma temporada completa de uma "vida": corre enquanto é piloto,
 * aposenta-se na idade definida, dirige ou acompanha depois, e resolve as
 * sucessões que aparecerem. Devolve o estado no começo da temporada seguinte.
 */
export function playLifeSeason(career: CareerState, policy: LifePolicy = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  if (c.succession) return botSuccession(c, policy);
  if (c.mode === 'driver') {
    c = botTraining(c);
    while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playRound(c, policy.choices);
    onSeasonEnd?.(c);
    if (c.succession) return botSuccession(c, policy);
    if (getPlayer(c).age >= (policy.retireAge ?? 36)) return engine.retireFromDriving(resolvePending(c));
    return startNextSeason(resolvePending(c), pickBestOffer(c));
  }
  while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playExecutiveRound(c, policy.choices);
  onSeasonEnd?.(c);
  if (c.succession) return botSuccession(c, policy);
  if (policy.handoverAge !== undefined && getPlayer(c).age >= policy.handoverAge) return botSuccession(engine.beginHandover(resolvePending(c)), policy);
  return botExecutiveOffseason(c, policy);
}

export function playLife(career: CareerState, seasons: number, policy: LifePolicy = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  // Cada chamada avança no máximo uma temporada; sucessões e aposentadorias são passos extras.
  for (let guard = 0; guard < seasons * 3 && c.season < career.season + seasons; guard++) c = playLifeSeason(c, policy, onSeasonEnd);
  return c;
}
