/**
 * Morte e sucessão.
 *
 * A carreira é da família, não de uma pessoa. Quando o personagem morre (de
 * idade ou, raramente, em um acidente) ou decide passar o comando, o jogo abre
 * uma sucessão: o jogador escolhe um herdeiro e o caminho dele.
 *
 * - Como piloto: um filho (ou parente jovem) com carreira em andamento vira o
 *   novo piloto do jogador, na categoria e na equipe em que já corria.
 * - Como dirigente: um herdeiro adulto assume o patrimônio e, se a família for
 *   dona de uma equipe, o comando dela.
 *
 * O patrimônio passa ao herdeiro com imposto; os irmãos recebem uma parte. Há
 * sempre ao menos um parente jovem que corre, para o save nunca ficar sem
 * continuação.
 *
 * Desde a Fase 6, a sucessão também cuida da família que fica: o herdeiro que é filho (ou o parente
 * jovem piloto) ganha um nascimento próprio, com os talentos e defeitos que herdou; os outros filhos
 * viram parentes com caminho próprio (`relatives.ts`); quem passa o comando em vida segue vivo como
 * dono, investidor ou aposentado (podem ser vários: quem assumiu também pode passar o comando em
 * vida); e o herdeiro piloto pode começar na equipe em que já corria, numa equipe da frente paga pela
 * família ou na equipe da família (`heirSeatOptions`).
 */
import type {
  Academy,
  CareerState,
  CategoryId,
  Child,
  ChildRacing,
  Contract,
  Driver,
  DriverAttributes,
  Elder,
  HeirOption,
  InboxMessage,
  LineageEntry,
  SeasonSummary,
  Succession,
  Team,
  TeamStake,
} from '@/domain/schemas';
import { FAMILY_TEAM, HEIR_START } from '@/config/balance';
import { ASSET_RULES } from '@/data/assets';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { CATEGORY_HUB } from '@/data/hubs';
import { CHILD_FIRST_NAMES, FAMILY, getTrait } from '@/data/family';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { F1_TEAM_NAMES, TEAM_TARGETS, f1TeamId } from '@/data/teams';
import { buildCalendar } from '../career/createCareer';
import { netWorth, post } from '../career/economy';
import { pushMessages } from '../career/inbox';
import { updateMarketInterest } from '../career/market';
import { archiveSeason, trimHistory } from '../career/offseason';
import { familyDriverIds, fullName, getPlayer } from '../career/selectors';
import { activeBirth } from '../birth/effects';
import { addSeasonStartStoryEvents } from '../story/select';
import { emptyStory } from '../story/memory';
import {
  buildExecutiveOffseason,
  buildJobOffers,
  convertToExecutive,
  executiveSummary,
  normalizeFieldDevelopment,
  vacatePlayerSeat,
} from '../management/executive';
import { ownedTeamValue } from '../management/team';
import { createRng, hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { buildCategoryField, generateDriver, rankTeams } from '../world/generation';
import { computeDriverStandings } from '../championship/standings';
import { childSummary, closeFamilyYear, emptyFamily } from './family';
import { beginSeasonFamily } from './familyEvents';
import { ensureHeritage, heirBirth } from './heritage';
import { drivingRecord, lastRaceTeam } from './lineage';
import { businessSponsor, elderAfterHandover, refreshElders, relativeFromChild } from './relatives';
import { categoryRef } from '@/domain/categoryNames';
import { joinList } from '@/domain/text';
import { money } from '../career/selectors';
import { recordSeasonTrend } from '../career/trend';

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

export function mortalityRisk(age: number): number {
  return FAMILY.MORTALITY.find((band) => age <= band.upTo)?.risk ?? 0.3;
}

/** Patrimônio que entra na sucessão: o pessoal mais a equipe própria. */
export function estateValue(career: CareerState): number {
  return netWorth(career.finance) + ownedTeamValue(career);
}

/** Atualiza, no fim de cada temporada, o registro do personagem atual na linhagem. */
export function touchLineage(career: CareerState): CareerState {
  const category = getCategory(career.categoryId);
  const lineage = career.dynasty.lineage.map((entry, index, all) => {
    if (index !== all.length - 1) return entry;
    const best = entry.bestCategoryId ? getCategory(entry.bestCategoryId).tier : 0;
    return {
      ...entry,
      peakReputation: Math.max(entry.peakReputation, career.reputation),
      bestCategoryId: career.mode === 'driver' && category.tier > best ? category.id : entry.bestCategoryId,
    };
  });
  return { ...career, dynasty: { ...career.dynasty, lineage } };
}

/* ------------------------------------------------------------------ */
/* Abertura da sucessão                                                */
/* ------------------------------------------------------------------ */

function relativeHeirs(career: CareerState): HeirOption[] {
  const former = getPlayer(career);
  const rng = createRng(hashSeed(career.seed, career.season, 'relative'));
  const category = getCategory('kart-regional');
  const young = generateDriver({
    id: `dyn-rel-g${career.dynasty.generation + 1}-s${career.season}`,
    seed: hashSeed(career.seed, career.season, 'relative-driver'),
    category,
    teamRank: 5,
    teamId: null,
    role: 'second',
    season: career.season + 1,
    usedNames: new Set(),
    rookie: true,
  });
  const firstName = CHILD_FIRST_NAMES[Math.floor(rng.next() * CHILD_FIRST_NAMES.length)] ?? 'Alex';
  const driver: Driver = {
    ...young,
    firstName,
    lastName: former.lastName,
    nationality: former.nationality,
    age: 15,
    potential: Math.round(80 + rng.next() * 8),
    teamId: null,
    role: null,
    contractEnd: 0,
  };
  const racing: ChildRacing = {
    categoryId: category.id,
    teamName: '',
    teamRank: 5,
    reputation: 5,
    license: [],
    academy: null,
    seasons: [],
    stalled: 0,
    familyCost: 0,
  };
  const adultName = `${CHILD_FIRST_NAMES[Math.floor(rng.next() * CHILD_FIRST_NAMES.length)] ?? 'Sam'} ${former.lastName}`;
  return [
    {
      id: 'relative-driver',
      kind: 'relative',
      name: fullName(driver),
      age: driver.age,
      description: `Sobrinho(a) de ${former.firstName}, promessa do kart regional. Assume a carreira nas pistas do começo.`,
      canDrive: true,
      canManage: false,
      childId: null,
      driver,
      racing,
    },
    {
      id: 'relative-adult',
      kind: 'relative',
      name: adultName,
      age: Math.max(28, former.age - 6),
      description: `Irmã(o) de ${former.firstName}. Não corre, mas pode cuidar do patrimônio e dos negócios da família.`,
      canDrive: false,
      canManage: true,
      childId: null,
      driver: null,
      racing: null,
    },
  ];
}

function childHeir(child: Child): HeirOption {
  const traits = child.traits.map((t) => getTrait(t).name.toLowerCase()).join(', ');
  const canDrive = child.stage === 'racing' && child.driver !== null && child.racing !== null;
  const canManage = child.age >= FAMILY.ADULT_AGE;
  const limits =
    !canDrive && !canManage ? ` Tem ${child.age} anos (mínimo ${FAMILY.ADULT_AGE} para assumir os negócios) e não corre: precisa de um tutor até lá.` : '';
  return {
    id: child.id,
    kind: 'child',
    name: fullName(child),
    age: child.age,
    description: `Filho(a): ${childSummary(child)}. Perfil: ${traits}.${limits}`,
    canDrive,
    canManage,
    childId: child.id,
    driver: null,
    racing: null,
  };
}

export function beginSuccession(original: CareerState, cause: 'death' | 'accident' | 'handover'): CareerState {
  if (original.succession) return original;
  // Fase 6: filhos de saves antigos ganham os traços de nascença antes da escolha do herdeiro.
  const career = ensureHeritage(original);
  const former = getPlayer(career);
  const estate = estateValue(career);
  const rate = cause === 'handover' ? ASSET_RULES.HANDOVER_TAX : ASSET_RULES.INHERITANCE_TAX;
  const tax = Math.max(0, Math.round((estate - ASSET_RULES.INHERITANCE_EXEMPT) * rate));
  const heirs: HeirOption[] = career.family.children.map(childHeir);
  const partner = career.family.partner;
  if (partner)
    heirs.push({
      id: 'partner',
      kind: 'partner',
      name: `${partner.firstName} ${partner.lastName}`,
      age: partner.age,
      description: `${partner.married ? 'Cônjuge' : 'Companheiro(a)'} de ${former.firstName}. Pode cuidar dos negócios e dos filhos até um deles assumir.`,
      canDrive: false,
      canManage: true,
      childId: null,
      driver: null,
      racing: null,
    });
  heirs.push(...relativeHeirs(career));

  // Morte no meio da temporada de piloto: o reserva assume o carro.
  let state = career.mode === 'driver' && !career.offseason ? vacatePlayerSeat(career) : career;
  const date = state.calendar[Math.min(state.calendar.length - 1, Math.max(0, state.nextRoundIndex - 1))]?.date ?? `${state.year}-01-01`;
  const title = cause === 'handover' ? 'Passagem de comando' : `Luto na família ${former.lastName}`;
  const body =
    cause === 'handover'
      ? `${fullName(former)} decidiu passar o comando da família. Escolha quem assume.`
      : cause === 'accident'
        ? `${fullName(former)} não resistiu aos ferimentos do acidente. O automobilismo está de luto. A história da família continua com quem você escolher.`
        : `${fullName(former)} morreu aos ${former.age} anos. A história da família continua com quem você escolher.`;
  const message: InboxMessage = { id: `s${state.season}-succession`, date, category: 'family', title, body };
  state = {
    ...state,
    weekend: null,
    pendingEvents: [],
    inbox: pushMessages(state.inbox, [message]),
    succession: { cause, year: state.year, formerName: fullName(former), estate, tax, heirs },
  };
  return state;
}

/**
 * Quem passou o comando em vida envelhece e segue a mesma tábua de mortalidade, cada um com o seu
 * sorteio (`elder-mortality`, pelo id). Ao morrer, sai da família com uma mensagem; a equipe ou as
 * participações de que cuidava continuam da família. Antes, o papel de cada um é posto em dia com o
 * que a família ainda tem (`refreshElders`). Sem ninguém nesse papel (a primeira geração), nada é
 * sorteado e a carreira volta como veio.
 */
export function checkElderMortality(original: CareerState): CareerState {
  if (original.succession) return original;
  const career = refreshElders(original);
  const { elders } = career.dynasty;
  if (elders.length === 0) return career;
  const date = career.calendar[career.calendar.length - 1]?.date ?? `${career.year}-12-01`;
  const living: Elder[] = [];
  const messages: InboxMessage[] = [];
  for (const elder of elders) {
    const age = career.year - elder.bornYear;
    const roll = createRng(hashSeed(career.seed, career.season, 'elder-mortality', elder.driverId)).next();
    if (roll >= mortalityRisk(age)) {
      living.push(elder);
      continue;
    }
    const keeps = elder.teamName !== null && career.finance.stakes.some((s) => s.teamName === elder.teamName);
    const legacy = keeps ? ` A participação na ${elder.teamName} segue com a família.` : '';
    messages.push({
      id: `s${career.season}-elder-${elder.driverId}`,
      date,
      category: 'family',
      title: `Luto na família ${career.dynasty.surname}`,
      body: `${elder.name}, que passou o comando da família em vida, morreu aos ${age} anos.${legacy}`,
    });
  }
  if (messages.length === 0) return career;
  return { ...career, dynasty: { ...career.dynasty, elders: living }, inbox: pushMessages(career.inbox, messages) };
}

/** Sorteio anual de mortalidade, feito no fechamento de cada temporada (de quem passou o comando e, depois, do personagem). */
export function checkMortality(original: CareerState): CareerState {
  if (original.succession) return original;
  const career = checkElderMortality(original);
  const player = getPlayer(career);
  const roll = createRng(hashSeed(career.seed, career.season, 'mortality', player.id)).next();
  return roll < mortalityRisk(player.age) ? beginSuccession(career, 'death') : career;
}

/** Uma lesão grave sofrida em corrida pode, raramente, ser fatal. */
export function checkFatalAccident(career: CareerState, season: number, round: number, injuredInRace: boolean): CareerState {
  if (career.mode !== 'driver' || career.succession || !injuredInRace) return career;
  const player = getPlayer(career);
  if (player.injury?.severity !== 'serious') return career;
  const roll = createRng(hashSeed(career.seed, season, round, 'fatal', player.id)).next();
  return roll < FAMILY.FATAL_ACCIDENT_CHANCE ? beginSuccession(career, 'accident') : career;
}

/** Passagem de comando em vida: só no fechamento de uma temporada como dirigente. */
export function beginHandover(career: CareerState): CareerState {
  if (career.mode !== 'executive' || !career.executiveOffseason)
    throw new Error('A passagem de comando é feita no fechamento de uma temporada, depois da aposentadoria das pistas.');
  return beginSuccession(career, 'handover');
}

export function cancelHandover(career: CareerState): CareerState {
  if (career.succession?.cause !== 'handover') throw new Error('Não há passagem de comando em aberto.');
  return { ...career, succession: null };
}

/* ------------------------------------------------------------------ */
/* Escolha do herdeiro                                                 */
/* ------------------------------------------------------------------ */

const NON_DRIVER_ATTRIBUTES: DriverAttributes = {
  pace: 40,
  consistency: 40,
  overtaking: 40,
  defending: 40,
  focus: 40,
  racecraft: 40,
  tyreManagement: 40,
  wetSkill: 40,
  experience: 0,
};

function academyFor(racing: ChildRacing, season: number): Academy | null {
  if (!racing.academy) return null;
  const index = F1_TEAM_NAMES.findIndex((name) => racing.academy === `Academia ${name}`);
  if (index < 0) return null;
  return { f1TeamId: f1TeamId(index), name: racing.academy, joinedSeason: season, supportShare: FAMILY.ACADEMY_SHARE, targetPosition: 6, strikes: 0 };
}

/** De onde o herdeiro piloto larga na primeira temporada (Fase 6). */
export type HeirSeat = 'current' | 'top' | 'family';

/** Uma opção de vaga para o herdeiro piloto, para a tela da sucessão e para o robô. */
export interface HeirSeatOption {
  id: HeirSeat;
  /** Equipe e força dela no grid da temporada seguinte (0 = a melhor); null quando a opção não existe. */
  teamName: string | null;
  rank: number | null;
  /** O que a vaga custa na primeira temporada (na equipe da frente, paga na hora da sucessão). */
  seatCost: number | null;
  available: boolean;
  /** Por que a opção não está disponível (null: está). */
  reason: string | null;
}

/**
 * O que fica com o herdeiro: o caixa depois do imposto e da parte dos irmãos (que só existe quando o
 * herdeiro é um dos filhos).
 */
function inheritanceSplit(career: CareerState, succession: Succession, option: HeirOption): { siblingsShare: number; cash: number } {
  const siblings = option.kind === 'child' ? career.family.children.filter((c) => c.id !== option.childId).length : 0;
  const siblingsShare = Math.round(Math.max(0, succession.estate - succession.tax) * ASSET_RULES.SIBLING_SHARE * Math.min(3, siblings));
  return { siblingsShare, cash: career.finance.cash - succession.tax - siblingsShare };
}

/**
 * O estado em que o herdeiro assume. Pelas pistas, no meio da temporada (acidente), o ano dos filhos
 * fecha antes, para o herdeiro chegar com a temporada dele concluída: ali a temporada em curso é
 * abandonada. Nos negócios, o ano segue e a família fecha o ano normalmente, no fim da temporada.
 */
function successionStage(career: CareerState, path: 'driver' | 'executive'): CareerState {
  const state: CareerState = { ...career, succession: null };
  const midSeason = !state.offseason && !state.executiveOffseason;
  return midSeason && path === 'driver' ? { ...state, family: closeFamilyYear(state).family } : state;
}

/**
 * A temporada interrompida por um acidente, arquivada como de piloto de quem saiu: a equipe pela qual
 * correu (a das etapas), a posição, os pontos e a meta dele até ali. Até a Fase 6 ela era arquivada
 * sem equipe e em 1º lugar.
 */
function interruptedSeason(state: CareerState, driverId: string): SeasonSummary {
  const summary: SeasonSummary = { ...executiveSummary(state), mode: 'driver' };
  const team = state.teams.find((t) => t.id === lastRaceTeam(state.rounds, driverId));
  const row = summary.driverStandings.find((s) => s.driverId === driverId);
  if (!team || !row) return summary;
  return {
    ...summary,
    playerTeamId: team.id,
    playerTeamName: team.name,
    playerPosition: row.position,
    playerPoints: row.points,
    objectiveTarget: team.driverTarget,
    objectiveMet: row.position <= team.driverTarget,
  };
}

function heirCareer(state: CareerState, option: HeirOption): { child: Child | undefined; driver: Driver | null; racing: ChildRacing | null } {
  const child = option.childId ? state.family.children.find((c) => c.id === option.childId) : undefined;
  return { child, driver: child?.driver ?? option.driver, racing: child?.racing ?? option.racing };
}

interface SeatPlan {
  option: HeirSeatOption;
  /** O grid da temporada seguinte (com a equipe da família, quando é ela). */
  teams: Team[];
  drivers: Driver[];
  team: Team | null;
  rank: number;
  /** A vaga paga na hora (a da equipe da frente) e a que o contrato do primeiro ano cobra. */
  upfront: number;
  contractSeat: number;
}

const roundSeat = (value: number) => Math.round(value / 500) * 500;

/**
 * A equipe da família, se houver: a que o personagem comanda como dono ou uma de que a família tem
 * 100% (a que ficou com quem passou o comando em vida), de preferência na categoria dada. A comandada
 * vem com o carro do fim do ano e o ganho da pesquisa acertado como na virada do ano
 * (`normalizeFieldDevelopment`: a média do campo sai e a equipe própria leva só parte do que passou da
 * média). A das participações, que ninguém da família desenvolveu, vem do grid novo (`field`) como as
 * rivais ou, fundada pela família e sem inscrição nele, das equipes do campeonato acompanhado; null
 * em `team` se não estiver em nenhum dos dois.
 */
function familyTeam(state: CareerState, categoryId: CategoryId, field: readonly Team[]): { name: string; categoryId: CategoryId; team: Team | null } | null {
  const teams = normalizeFieldDevelopment(state);
  const m = state.management;
  const candidates: { name: string; categoryId: CategoryId; team: Team | null }[] = [];
  const own = m?.position === 'owner' ? teams.find((t) => t.id === m.teamId) : undefined;
  if (m && own) candidates.push({ name: own.name, categoryId: m.categoryId, team: own });
  for (const stake of state.finance.stakes) {
    if (stake.share < 1) continue;
    const fresh = stake.categoryId === categoryId ? field.find((t) => t.id === stake.teamId) : undefined;
    const followed = stake.categoryId === state.categoryId ? teams.find((t) => t.id === stake.teamId) : undefined;
    candidates.push({ name: stake.teamName, categoryId: stake.categoryId, team: fresh ?? followed ?? null });
  }
  return candidates.find((c) => c.categoryId === categoryId) ?? candidates[0] ?? null;
}

/**
 * Onde o herdeiro corre e quanto paga, em cada opção:
 * - `current`: na força da equipe em que já corria (como sempre foi);
 * - `top`: numa equipe da frente (HEIR_START.TOP_SEAT_RANK), com ágio sobre a tabela, paga na hora com
 *   o patrimônio herdado, que tem de cobrir a vaga e uma reserva para viver. Só existe para herdeiros
 *   (a primeira geração nunca começa numa equipe boa) e onde as vagas são vendidas;
 * - `family`: pela equipe da família (`familyTeam`), se ela é da categoria do herdeiro. A equipe entra
 *   no grid novo com o mesmo id, nome e cor e o carro acertado da virada do ano; sem inscrição nele,
 *   ocupa a da mais fraca. A meta de cada equipe segue a nova ordem de forças. A vaga custa
 *   FAMILY_TEAM.SEAT_SHARE da tabela.
 */
function seatPlan(state: CareerState, heirDriver: Driver, heirRacing: ChildRacing, seat: HeirSeat, cash: number): SeatPlan {
  const category: CategoryDefinition = getCategory(heirRacing.categoryId);
  const field = buildCategoryField(category.id, state.seed, state.season + 1, new Set([fullName(heirDriver)]));
  let teams = field.teams;
  let drivers = field.drivers;
  const unavailable = (reason: string, teamName: string | null = null, rank: number | null = null, seatCost: number | null = null): SeatPlan => ({
    option: { id: seat, teamName, rank, seatCost, available: false, reason },
    teams,
    drivers,
    team: null,
    rank: 0,
    upfront: 0,
    contractSeat: 0,
  });

  let familyId: string | null = null;
  if (seat === 'family') {
    const family = familyTeam(state, category.id, teams);
    if (!family) return unavailable('A família não é dona de uma equipe.');
    if (family.categoryId !== category.id)
      return unavailable(`A ${family.name} corre ${categoryRef(family.categoryId, 'em')}, não ${categoryRef(category.id, 'em')}.`, family.name);
    const own = family.team;
    if (!own) return unavailable(`A ${family.name} não tem inscrição ${categoryRef(category.id, 'em')} na próxima temporada.`, family.name);
    familyId = own.id;
    if (teams.some((t) => t.id === own.id)) {
      teams = teams.map((t) => (t.id === own.id ? own : t));
    } else {
      const weakest = rankTeams(teams)[teams.length - 1];
      if (!weakest) throw new Error('Categoria sem equipes.');
      teams = teams.map((t) => (t.id === weakest.id ? own : t));
      drivers = drivers.map((d) => (d.teamId === weakest.id ? { ...d, teamId: own.id } : d));
    }
    const order = rankTeams(teams).map((t) => t.id);
    teams = teams.map((t) => ({ ...t, driverTarget: TEAM_TARGETS[order.indexOf(t.id)] ?? t.driverTarget }));
  }
  const ranked = rankTeams(teams);
  const last = ranked.length - 1;
  const rank =
    seat === 'current'
      ? Math.min(last, heirRacing.teamRank)
      : seat === 'top'
        ? Math.min(last, HEIR_START.TOP_SEAT_RANK)
        : ranked.findIndex((t) => t.id === familyId);
  const team = ranked[rank];
  if (!team) throw new Error('Categoria sem equipes.');
  const table = lerp(category.economy.seatCost, rank / 9);
  const plan = (seatCost: number, upfront: number): SeatPlan => ({
    option: { id: seat, teamName: team.name, rank, seatCost, available: true, reason: null },
    teams,
    drivers,
    team,
    rank,
    upfront,
    contractSeat: seatCost - upfront,
  });

  if (seat === 'current') return plan(roundSeat(table), 0);
  if (seat === 'family') return plan(roundSeat(table * FAMILY_TEAM.SEAT_SHARE), 0);
  const price = roundSeat(table * (1 + HEIR_START.TOP_SEAT_PREMIUM));
  if (category.economy.seatCost[0] <= 0)
    return unavailable(`As vagas ${categoryRef(category.id, 'de')} não são vendidas: as equipes escolhem pelo talento.`, team.name, rank);
  if (heirRacing.teamRank <= HEIR_START.TOP_SEAT_RANK) return unavailable('Já corre numa das equipes da frente.', team.name, rank, price);
  const reserve = Math.round(HEIR_START.TOP_SEAT_RESERVE * category.economy.living);
  if (cash < price + reserve)
    return unavailable(
      `O patrimônio herdado (${money(state, cash)}) não cobre a vaga de ${money(state, price)} e a reserva de ${money(state, reserve)} para viver.`,
      team.name,
      rank,
      price,
    );
  return plan(price, price);
}

/**
 * As opções de vaga de um herdeiro piloto na sucessão aberta: a equipe em que já corria, uma equipe
 * da frente paga pela família e a equipe da família. Vazio para quem não corre.
 */
export function heirSeatOptions(career: CareerState, heirId: string): HeirSeatOption[] {
  const succession = career.succession;
  if (!succession) throw new Error('Não há sucessão em aberto.');
  const option = succession.heirs.find((h) => h.id === heirId);
  if (!option) throw new Error('Herdeiro não encontrado.');
  if (!option.canDrive) return [];
  const state = successionStage(career, 'driver');
  const { driver, racing } = heirCareer(state, option);
  if (!driver || !racing) return [];
  const { cash } = inheritanceSplit(state, succession, option);
  return (['current', 'top', 'family'] as const).map((seat) => seatPlan(state, driver, racing, seat, cash).option);
}

export function resolveSuccession(career: CareerState, heirId: string, path: 'driver' | 'executive', seat: HeirSeat = 'current'): CareerState {
  const succession = career.succession;
  if (!succession) throw new Error('Não há sucessão em aberto.');
  const option = succession.heirs.find((h) => h.id === heirId);
  if (!option) throw new Error('Herdeiro não encontrado.');
  if (path === 'driver' && !option.canDrive) throw new Error('Este herdeiro não tem carreira de piloto.');
  if (path === 'executive' && !option.canManage) throw new Error('Este herdeiro ainda não pode assumir os negócios.');
  if (path === 'executive' && seat !== 'current') throw new Error('A escolha da vaga vale só para quem segue nas pistas.');

  const former = getPlayer(career);
  const midSeason = !career.offseason && !career.executiveOffseason;
  let state = successionStage(career, path);
  const { child, driver: heirDriver, racing: heirRacing } = heirCareer(state, option);
  const generation = state.dynasty.generation + 1;
  const heirDriverId = heirDriver?.id ?? `dyn-${option.id}-g${generation}-s${state.season}`;
  // Fase 6: o filho (nos dois caminhos) e o parente jovem piloto ganham um nascimento próprio, com os
  // talentos e defeitos que já tinham; o do antecessor fica na linhagem. Assim `activeBirth` passa a
  // valer para o herdeiro sem mudar quem lê o nascimento.
  const formerBirth = activeBirth(state);
  const birth = child || (option.kind === 'relative' && option.driver) ? heirBirth(state, option, heirDriverId) : state.birth;

  // Herança: imposto e parte dos irmãos (só quando o herdeiro é um dos filhos).
  const round = state.calendar.length;
  const { siblingsShare } = inheritanceSplit(state, succession, option);
  let finance = post(
    state.finance,
    state.season,
    round,
    'inheritance',
    -succession.tax,
    succession.cause === 'handover' ? 'Imposto sobre a doação' : 'Imposto de herança',
  );
  finance = post(finance, state.season, round, 'inheritance', -siblingsShare, 'Parte dos irmãos na herança');
  state = { ...state, finance };

  // Linhagem: quem sai leva os traços de nascença e o nome do parceiro; quem entra, o caminho. Numa
  // sucessão no meio do ano (acidente), a temporada interrompida conta para quem saiu como as outras
  // (o degrau e as vitórias, como os pódios no placar), menos o título: ela não terminou.
  const peak = Math.max(...state.dynasty.lineage.map((l) => l.peakReputation), state.reputation);
  const closing = state.offseason ? archiveSeason(state) : state.executiveOffseason?.summary;
  const record = drivingRecord([...state.history, ...(closing ? [closing] : [])], former.id);
  const partialWins = midSeason ? (computeDriverStandings(state.rounds, state.drivers, state.adjustments).find((s) => s.driverId === former.id)?.wins ?? 0) : 0;
  const partner = state.family.partner;
  const lineage: LineageEntry[] = (midSeason ? touchLineage(state) : state).dynasty.lineage.map((entry, index, all) =>
    index === all.length - 1
      ? {
          ...entry,
          toSeason: state.season,
          endReason: succession.cause,
          titles: record.titles,
          wins: record.wins + partialWins,
          peakReputation: Math.max(entry.peakReputation, state.reputation),
          netWorthPassed: Math.round(succession.estate - succession.tax - siblingsShare),
          traits: formerBirth?.traits ?? entry.traits,
          partnerName: partner ? `${partner.firstName} ${partner.lastName}` : null,
        }
      : entry,
  );
  // Quem assume os negócios no meio do ano dirige o resto da temporada: ela já é dele.
  const newEntry = (driverId: string, name: string, age: number, year: number, fromSeason = state.season + 1): LineageEntry => ({
    generation,
    driverId,
    name,
    bornYear: year - age,
    fromSeason,
    toSeason: null,
    endReason: null,
    bestCategoryId: null,
    titles: 0,
    wins: 0,
    peakReputation: 0,
    netWorthPassed: null,
    traits: [],
    partnerName: null,
    path,
  });

  // Parentes: quando o herdeiro é um dos filhos, os outros seguem caminho próprio e ficam na árvore.
  // Com outro herdeiro (o parceiro ou um parente), os filhos continuam na família de quem os cria.
  // As idades dos filhos já são as do ano seguinte quando o ano da família fechou.
  const ageYear = midSeason && path === 'executive' ? state.year : state.year + 1;
  const newRelatives =
    option.kind === 'child' ? state.family.children.filter((c) => c.id !== option.childId).map((c) => relativeFromChild(state, c, ageYear)) : [];
  const notes: string[] = [];
  if (newRelatives.length > 0)
    notes.push(
      `Quem não herdou a carreira segue caminho próprio: ${joinList(newRelatives.map((r) => `${r.firstName} (${RELATIVE_PATH_INFO[r.path].label.toLowerCase()})`))}.`,
    );

  // Quem passa o comando em vida segue vivo e entra na lista dos que passaram o comando: no controle
  // da equipe, se ela vira participação porque o herdeiro vai para as pistas; senão, nas
  // participações ou longe das pistas. Quem já estava nessa lista continua nela (só sai ao morrer,
  // pela tábua de mortalidade), também quando o personagem morre.
  const m = state.management;
  const ownedTeamName = m?.position === 'owner' ? (state.teams.find((t) => t.id === m.teamId)?.name ?? 'Equipe da família') : null;
  const elder: Elder | null = succession.cause === 'handover' ? elderAfterHandover(state, former, path === 'driver' ? ownedTeamName : null) : null;
  if (elder?.role === 'investor') notes.push(`${elder.name} segue cuidando das participações da família.`);
  if (elder?.role === 'retired') notes.push(`${elder.name} deixa a linha de frente e passa a acompanhar a família de longe.`);
  const dynasty = (entry: LineageEntry) => ({
    ...state.dynasty,
    generation,
    lineage: [...lineage, entry],
    relatives: [...state.dynasty.relatives, ...newRelatives],
    elders: elder ? [...state.dynasty.elders, elder] : state.dynasty.elders,
  });

  // O herdeiro filho começa a própria família. O parceiro que assume deixa de ser parceiro de alguém, e
  // o parceiro do personagem anterior não passa a ser de um sobrinho ou de um irmão (até a Fase 6, o
  // parente que assumia ficava com ele, o que a árvore da família tornaria visível); os filhos
  // continuam com quem os cria.
  const family = option.kind === 'child' ? emptyFamily() : { ...state.family, partner: null };
  const inheritedNote = `Patrimônio recebido: ${money(career, succession.estate - succession.tax - siblingsShare)} (imposto de ${money(career, succession.tax)}${siblingsShare > 0 ? `; ${money(career, siblingsShare)} para os irmãos` : ''}).`;

  if (path === 'executive') {
    state = convertToExecutive(state);
    const base: Driver = heirDriver ?? {
      id: heirDriverId,
      firstName: option.name.split(' ')[0] ?? option.name,
      lastName: option.name.split(' ').slice(1).join(' ') || former.lastName,
      nationality: former.nationality,
      age: Math.max(10, option.age),
      teamId: null,
      role: null,
      contractEnd: 0,
      condition: { ...NEUTRAL_CONDITION },
      injury: null,
      isPlayer: false,
      attributes: { ...NON_DRIVER_ATTRIBUTES },
      potential: 40,
      trainingFocus: 'balanced',
    };
    // Um filho que corria pela equipe da família deixa o carro para assumir o comando.
    const inWorld = state.drivers.find((d) => d.id === base.id);
    // Quem correu nesta temporada fica na lista (sem equipe) até ela ser arquivada: os resultados apontam para ele.
    const raced = state.rounds.some((r) => r.race.entries.some((e) => e.driverId === former.id));
    let drivers = raced
      ? state.drivers.map((d) => (d.id === former.id ? { ...d, isPlayer: false, teamId: null, role: null, contractEnd: 0, injury: null } : d))
      : state.drivers.filter((d) => d.id !== former.id);
    if (inWorld) {
      drivers = drivers.map((d) => (d.id === base.id ? { ...d, isPlayer: true } : d));
      state = vacatePlayerSeat({ ...state, drivers, playerDriverId: base.id });
    } else {
      state = {
        ...state,
        drivers: [{ ...base, isPlayer: true, teamId: null, role: null, contractEnd: 0, age: Math.max(10, option.age) }, ...drivers],
        playerDriverId: base.id,
      };
    }
    const keepsTeam = state.management?.position === 'owner';
    const reputation = heirRacing ? Math.max(heirRacing.reputation, Math.round(peak * FAMILY.NAME_PRESTIGE)) : Math.round(state.reputation * 0.5);
    state = {
      ...state,
      reputation,
      // O cargo de chefe contratado não é herdado; ao deixá-lo, os ganhos do ano das equipes são acertados.
      teams: keepsTeam ? state.teams : normalizeFieldDevelopment(state),
      management: keepsTeam ? state.management : null,
      executiveLog: [],
      license: { history: heirRacing?.license ?? [], penaltyPoints: 0, banRounds: 0 },
      relations: { teamTrust: 50, teammate: 50, rivalries: {}, rivalryLog: [] },
      // A memória das histórias é do personagem: o herdeiro começa a dele (Fase 5); o ano de
      // transição também (Fase 6: o herdeiro tem o dele, quando parar de correr).
      story: emptyStory(base.id),
      transition: null,
      family,
      birth,
      dynasty: dynasty(newEntry(base.id, option.name, option.age, state.year, midSeason ? state.season : state.season + 1)),
    };
    if (state.executiveOffseason) {
      // O fechamento é refeito para o novo personagem: propostas de cargo pelo prestígio dele e,
      // se a equipe ficou na família, a lista de pilotos sem o próprio herdeiro.
      const off = state.executiveOffseason;
      const evaluation = {
        teamPosition: off.teamPosition,
        target: off.target,
        objectiveMet: off.objectiveMet,
        prize: off.prize,
        profit: off.profit,
        dismissed: false,
        notes: off.notes,
      };
      state = keepsTeam
        ? { ...state, executiveOffseason: { ...buildExecutiveOffseason(state, off.summary, evaluation), sponsorOffers: off.sponsorOffers } }
        : { ...state, executiveOffseason: { ...off, dismissed: false, jobOffers: buildJobOffers(state), candidates: [], lineup: [], sponsorOffers: [] } };
    }
    const date = state.calendar[Math.min(state.calendar.length - 1, Math.max(0, state.nextRoundIndex - 1))]?.date ?? `${state.year}-01-01`;
    return {
      ...state,
      inbox: pushMessages(state.inbox, [
        {
          id: `s${state.season}-heir-g${generation}`,
          date,
          category: 'family',
          title: `${option.name} assume a família`,
          body: [`${option.name} passa a cuidar do patrimônio${keepsTeam ? ' e da equipe' : ''} da família ${former.lastName}.`, inheritedNote, ...notes].join(
            ' ',
          ),
        },
      ]),
    };
  }

  /* ---------------- Herdeiro piloto: nova temporada, na categoria dele ---------------- */
  if (!heirDriver || !heirRacing) throw new Error('Este herdeiro não tem carreira de piloto.');
  const plan = seatPlan(state, heirDriver, heirRacing, seat, state.finance.cash);
  const team = plan.team;
  if (!plan.option.available || !team) throw new Error(plan.option.reason ?? 'Vaga indisponível.');
  const summary: SeasonSummary = state.executiveOffseason?.summary ?? (state.offseason ? archiveSeason(state) : interruptedSeason(state, former.id));
  const nextSeason = state.season + 1;
  const nextYear = state.year + 1;
  const category = getCategory(heirRacing.categoryId);
  notes.unshift(inheritedNote);

  // A equipe da família fica com gestores contratados: vira uma participação de 100%, que paga dividendos.
  if (m && m.position === 'owner') {
    const owned = state.teams.find((t) => t.id === m.teamId);
    const stake: TeamStake = {
      id: `stake-${m.categoryId}-${m.teamId}`,
      teamId: m.teamId,
      teamName: owned?.name ?? 'Equipe da família',
      categoryId: m.categoryId,
      share: 1,
      cost: m.purchasePrice,
      value: ownedTeamValue(state),
      lastPosition: m.previousPosition ?? m.boardTarget,
      lastDividend: 0,
    };
    state = { ...state, finance: { ...state.finance, stakes: [...state.finance.stakes.filter((s) => s.id !== stake.id), stake] } };
    notes.push(
      elder?.role === 'owner' && succession.cause === 'handover'
        ? `A ${stake.teamName} continua sob o controle de ${elder.name}, com gestores contratados no dia a dia; os dividendos seguem para a família.`
        : `A ${stake.teamName} segue com gestores contratados; a família continua dona e recebe os dividendos.`,
    );
  }
  // A vaga na equipe da frente é paga na hora, com o patrimônio herdado.
  if (plan.upfront > 0) {
    state = { ...state, finance: post(state.finance, state.season, round, 'seat', -plan.upfront, `Vaga na ${team.name}`) };
  }

  const rank = plan.rank;
  const t = rank / 9;
  const lead = category.field.driverLevel + category.field.driverSpread * (0.5 - t) + 1;
  const role: 'first' | 'second' = overallRating(heirDriver.attributes) >= lead ? 'first' : 'second';
  const player: Driver = {
    ...heirDriver,
    isPlayer: true,
    teamId: team.id,
    role,
    contractEnd: nextSeason,
    condition: { ...NEUTRAL_CONDITION },
    injury: null,
    trainingFocus: 'balanced',
    age: option.kind === 'child' ? heirDriver.age : heirDriver.age + 1,
  };
  const drivers = [player, ...plan.drivers.filter((d) => !(d.teamId === team.id && d.role === role))];
  const terms = HEIR_START.CONTRACT;
  const win = Math.round(category.economy.winBonus * (terms.WIN_BONUS[0] - terms.WIN_BONUS[1] * t));
  const salary = Math.round((lerp(category.economy.salary, t) * terms.SALARY_SHARE) / 1000) * 1000;
  const seatCost = plan.contractSeat;
  const contract: Contract = {
    teamId: team.id,
    categoryId: category.id,
    role,
    startSeason: nextSeason,
    endSeason: nextSeason,
    salary,
    seatCost,
    bonuses: {
      win,
      podium: Math.round(win * terms.PODIUM_SHARE),
      point: Math.round(win * terms.POINT_SHARE),
      title: win * terms.TITLE_MULTIPLIER,
    },
    clauses: { releaseFee: 0, performanceTarget: null },
  };
  const calendar = buildCalendar(state.seed, nextSeason, nextYear, category);
  const date = calendar[0]?.date ?? `${nextYear}-03-01`;
  const nextDynasty = dynasty(newEntry(player.id, fullName(player), player.age, nextYear));
  // Um parente nos negócios patrocina o herdeiro que corre.
  const backing = businessSponsor({ ...state, dynasty: nextDynasty }, category.id, nextSeason, nextYear);
  if (backing) notes.push(`A ${backing.name} apoia a carreira com ${money(career, backing.perSeason)} por temporada.`);

  let next: CareerState = {
    ...state,
    status: 'active',
    mode: 'driver',
    season: nextSeason,
    year: nextYear,
    categoryId: category.id,
    playerDriverId: player.id,
    reputation: Math.max(heirRacing.reputation, Math.round(peak * FAMILY.NAME_PRESTIGE)),
    drivers,
    teams: plan.teams,
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    adjustments: [],
    gridPenalties: {},
    playerSeasonStartAttributes: { ...player.attributes },
    trainingIntensity: 'normal',
    contract,
    finance: { ...state.finance, seasonTotals: {} },
    sponsors: backing ? [backing] : [],
    academy: category.tier < 7 ? academyFor(heirRacing, nextSeason) : null,
    // O contrato com o investidor, a vaquinha e o trabalho paralelo eram do piloto que saiu; o herdeiro mora no polo do campeonato dele.
    hub: { id: CATEGORY_HUB[category.id], arrivedSeason: 0 },
    investor: null,
    crowdfund: null,
    sideJob: 'none',
    noDoorSeasons: 0,
    license: { history: heirRacing.license, penaltyPoints: 0, banRounds: 0 },
    relations: { teamTrust: 50, teammate: 50, rivalries: {}, rivalryLog: [] },
    // A memória das histórias é do personagem: o herdeiro começa a dele (Fase 5); o ano de transição
    // também (Fase 6: o herdeiro tem o dele, quando parar de correr).
    story: emptyStory(player.id),
    transition: null,
    marketInterest: {},
    pendingEvents: [],
    offseason: null,
    executiveOffseason: null,
    executiveLog: [],
    management: null,
    history: trimHistory([...state.history, summary], familyDriverIds(state)),
    seasonTrend: recordSeasonTrend(state),
    family,
    birth,
    dynasty: nextDynasty,
  };
  next = { ...next, marketInterest: updateMarketInterest(next, 1) };
  next = addSeasonStartStoryEvents(next);
  const seatNote =
    seat === 'top'
      ? `A família pagou ${money(career, plan.upfront)} pela vaga desta primeira temporada.`
      : seat === 'family'
        ? seatCost > 0
          ? `A equipe da família cobra ${money(career, seatCost)} pela vaga.`
          : 'A equipe da família não cobra a vaga.'
        : `A vaga custa ${money(career, seatCost)} por temporada.`;
  const messages: InboxMessage[] = [
    {
      id: `s${nextSeason}-heir-g${generation}`,
      date,
      category: 'family',
      title: `${fullName(player)} continua a história`,
      body: `${fullName(player)}, ${player.age} anos, é agora o piloto da família ${former.lastName}: corre ${categoryRef(category.id, 'the')} pela ${team.name}, como ${role === 'first' ? 'primeiro' : 'segundo'} piloto. ${seatNote} ${notes.join(' ')}`,
    },
  ];
  if (seat === 'family')
    messages.push({
      id: `s${nextSeason}-heir-favoritism`,
      date,
      category: 'media',
      title: 'Favorecimento?',
      body: `${fullName(player)} vai correr pela ${team.name}, a equipe da família. Nos boxes e na imprensa, já se fala em favorecimento: cada resultado vai ser medido contra o do companheiro de equipe.`,
    });
  return beginSeasonFamily({ ...next, inbox: pushMessages(state.inbox, messages) });
}
