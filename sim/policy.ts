/**
 * O robô: a política simples que joga carreiras no lugar do jogador.
 *
 * É a mesma para o simulador (`npm run sim`), para os testes (`tests/helpers.ts`) e para os
 * relatórios de `npm run calibrate`. Ele só chama a API pública do motor, como a interface faz,
 * e nunca sorteia nada: com a mesma semente e a mesma política, a carreira é sempre igual.
 *
 * Mexer em qualquer decisão daqui muda os valores gravados em `tests/golden/simulation.json`
 * e a linha de base do simulador. Se for de propósito, regrave e explique no PR.
 */
import type { CareerState, PracticeProgram, QualifyingApproach, RaceMode } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import * as engine from '@/engine';

export interface Choices {
  program?: PracticeProgram;
  approach?: QualifyingApproach;
  mode?: RaceMode;
  /** Índice da escolha em cada evento pendente (padrão: a primeira). */
  eventChoice?: number;
}

/**
 * Bônus de talento: pontos somados a todos os atributos treináveis (e metade disso ao
 * potencial) do piloto do jogador. Representa um jogador que decide melhor que o robô:
 * 0 = mediano, 4 = bom, 8 = excelente.
 */
export function withTalent(career: CareerState, talent: number): CareerState {
  if (talent === 0) return career;
  const drivers = career.drivers.map((d) => {
    if (!d.isPlayer) return d;
    const attributes = { ...d.attributes };
    for (const key of engine.TRAINABLE_ATTRIBUTES) attributes[key] = Math.min(99, attributes[key] + talent);
    return { ...d, attributes, potential: Math.min(99, d.potential + talent / 2) };
  });
  return { ...career, drivers, playerSeasonStartAttributes: { ...drivers.find((d) => d.isPlayer)!.attributes } };
}

/** Resolve todos os eventos pendentes com a escolha de índice dado. */
export function resolvePending(career: CareerState, choiceIndex = 0): CareerState {
  let c = career;
  while (c.pendingEvents.length > 0) {
    const event = c.pendingEvents[0]!;
    const choice = event.choices[Math.min(choiceIndex, event.choices.length - 1)]!;
    c = engine.resolveEvent(c, event.id, choice.id).career;
  }
  return c;
}

/** Joga uma etapa inteira com o piloto automático. */
export function playRound(career: CareerState, choices: Choices = {}): CareerState {
  let c = engine.startWeekend(resolvePending(career, choices.eventChoice));
  if (!c.weekend!.playerParticipates) return engine.simulateAbsentWeekend(c);
  c = engine.runPractice(c, choices.program ?? 'setup');
  c = engine.runQualifying(c, choices.approach ?? 'balanced');
  const race = engine.simulateRemainingRace(engine.createWeekendRace(c), engine.buildRaceContext(c), { mode: choices.mode ?? 'balanced', auto: true });
  return engine.completeWeekend(c, race);
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
  const offers = (career.offseason?.offers ?? []).filter((o) => engine.canAcceptOffer(career, o));
  if (offers.length === 0) throw new Error('Nenhuma proposta aceitável (a rede de segurança deveria existir).');
  const strength = (categoryId: CareerState['categoryId'], teamId: string) => {
    const ranked = engine.rankTeams(engine.teamsOfCategory(career, categoryId));
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
  const p = engine.getPlayer(career);
  const a = p.attributes;
  if (p.potential - a.pace > 4) return engine.setTrainingFocus(career, 'speed');
  const groups = {
    racecraft: (a.racecraft + a.defending + a.overtaking) / 3,
    consistency: (a.consistency + a.focus) / 2,
    tyres: a.tyreManagement,
    wet: a.wetSkill,
  } as const;
  const weakest = (Object.entries(groups) as [keyof typeof groups, number][]).sort((x, y) => x[1] - y[1])[0]![0];
  return engine.setTrainingFocus(career, weakest);
}

/** Joga uma carreira por várias temporadas com o robô. Chama `onSeasonEnd` no fechamento de cada uma. */
export function playCareer(career: CareerState, seasons: number, choices: Choices = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  for (let i = 0; i < seasons; i++) {
    c = playSeason(botTraining(c), choices);
    onSeasonEnd?.(c);
    c = engine.startNextSeason(c, pickBestOffer(c));
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Vida inteira (piloto → dirigente → sucessão)                        */
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
  return engine.resolveSuccession(
    career,
    pick.id,
    pick === driver && (preferDriver || !manager) ? 'driver' : pick.canManage && !(preferDriver && pick.canDrive) ? 'executive' : 'driver',
  );
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
    if (engine.getPlayer(c).age >= (policy.retireAge ?? 36)) return engine.retireFromDriving(resolvePending(c));
    return engine.startNextSeason(resolvePending(c), pickBestOffer(c));
  }
  while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playExecutiveRound(c, policy.choices);
  onSeasonEnd?.(c);
  if (c.succession) return botSuccession(c, policy);
  if (policy.handoverAge !== undefined && engine.getPlayer(c).age >= policy.handoverAge) return botSuccession(engine.beginHandover(resolvePending(c)), policy);
  return botExecutiveOffseason(c, policy);
}

export function playLife(career: CareerState, seasons: number, policy: LifePolicy = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  // Cada chamada avança no máximo uma temporada; sucessões e aposentadorias são passos extras.
  for (let guard = 0; guard < seasons * 3 && c.season < career.season + seasons; guard++) c = playLifeSeason(c, policy, onSeasonEnd);
  return c;
}
