/**
 * Vida depois das pistas: o modo dirigente.
 *
 * Quando o jogador pendura o capacete, a carreira não acaba. O personagem
 * continua no automobilismo como investidor, chefe de equipe contratado ou
 * dono de equipe, e o campeonato segue sendo simulado etapa a etapa pelo mesmo
 * motor de corrida. O piloto do jogador permanece na lista de pilotos, sem
 * equipe: é o "personagem", que envelhece e um dia passa o bastão.
 *
 * Fluxo de uma temporada como dirigente:
 *   etapa → applyExecutiveRoundEffects (finanças pessoais, pilotos, caixa e
 *   pesquisa da equipe, eventos) → ... → closeExecutiveSeason (avaliação,
 *   prêmios, impostos, família, mortalidade, propostas e mercado) →
 *   startExecutiveSeason (aplica a decisão do jogador e monta o novo ano).
 */
import type {
  CareerState,
  CategoryId,
  Driver,
  DriverCandidate,
  ExecutiveOffseason,
  InboxMessage,
  JobOffer,
  ManagedTeam,
  RoundRecord,
  SeasonSummary,
  StaffMember,
  Team,
  TeamListing,
} from '@/domain/schemas';
import { ASSET_RULES, LIFESTYLE_RULES } from '@/data/assets';
import { CATEGORIES, getCategory, type CategoryDefinition } from '@/data/categories';
import { MANAGEMENT, TEAM_ECONOMY, teamValue } from '@/data/management';
import { TEAM_TARGETS } from '@/data/teams';
import { computeDriverStandings, computeTeamStandings } from '../championship/standings';
import { conditionAfterRace, recoverInjury, rollInjury } from '../career/condition';
import { buildCalendar } from '../career/createCareer';
import { developAfterRound, developDriver } from '../career/development';
import { closeSeasonFinance, post } from '../career/economy';
import { pushMessages } from '../career/inbox';
import { runAiMarket, teamsOfCategory } from '../career/market';
import {
  DEBT_SETTLEMENT_REPUTATION,
  REPUTATION,
  archiveSeason,
  compactRound,
  evolveTeams,
  isRegulationChange,
  positionPrestige,
  trimHistory,
  winter,
} from '../career/offseason';
import { familyDriverIds, formerCharacterIds, fullName, getPlayer } from '../career/selectors';
import { closeFamilyYear, planChildSeason } from '../dynasty/family';
import { beginSeasonFamily } from '../dynasty/familyEvents';
import { checkMortality } from '../dynasty/succession';
import { closeAssetsYear, liquidateAssets, settleAssetsRound } from '../economy/assets';
import { createRng, gaussian, hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { buildCategoryField, generateDriver, generateReserve, rankTeams } from '../world/generation';
import { managementRoundEvent } from './events';
import {
  buildSponsorOffers,
  buildStaffMarket,
  createManagedTeam,
  driverTerms,
  fieldRatings,
  staffSalary,
  managedTeam,
  normalizeAllocation,
  ownedTeamValue,
  principalRating,
  requireManagement,
  settleTeamRound,
  staffRating,
  syncManagedTeam,
} from './team';
import { money } from '../career/selectors';
import { categoryRef } from '@/domain/categoryNames';
import { counted } from '@/domain/text';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
/** Venda forçada da equipe por dívida: 90% do valor de mercado. */
const FORCED_SALE_DISCOUNT = 0.9;

/* ------------------------------------------------------------------ */
/* Aposentadoria das pistas                                            */
/* ------------------------------------------------------------------ */

/**
 * Tira o jogador do carro. O reserva da equipe assume a vaga (se não houver
 * reserva, um piloto é contratado às pressas), para o grid continuar com dois
 * carros por equipe.
 */
export function vacatePlayerSeat(career: CareerState): CareerState {
  const player = getPlayer(career);
  const { teamId, role } = player;
  if (!teamId || !role) return career;
  let drivers = career.drivers.map((d) => (d.id === player.id ? { ...d, teamId: null, role: null, contractEnd: 0, injury: null } : d));
  const reserve = drivers.find((d) => d.teamId === teamId && d.role === 'reserve');
  if (reserve) {
    drivers = drivers.map((d) => (d.id === reserve.id ? { ...d, role, contractEnd: Math.max(career.season, d.contractEnd) } : d));
  } else {
    const ranked = rankTeams(career.teams);
    const team = ranked.find((t) => t.id === teamId);
    if (team) {
      const substitute = generateReserve(
        getCategory(career.categoryId),
        team,
        ranked.indexOf(team),
        hashSeed(career.seed, 'substitute', career.nextRoundIndex),
        career.season,
        new Set(drivers.map(fullName)),
      );
      drivers = [...drivers, { ...substitute, id: `${substitute.id}-sub${career.nextRoundIndex}`, role, contractEnd: career.season }];
    }
  }
  const gridPenalties = { ...career.gridPenalties };
  delete gridPenalties[player.id];
  return { ...career, drivers, gridPenalties };
}

function seasonDate(career: CareerState): string {
  return career.calendar[Math.min(career.calendar.length - 1, Math.max(0, career.nextRoundIndex - 1))]?.date ?? `${career.year}-01-01`;
}

/**
 * Aposentadoria como piloto. No fechamento da temporada, o jogador passa
 * direto ao fechamento como dirigente, com propostas de cargos e equipes à
 * venda. No meio da temporada, o reserva assume e o jogador acompanha o resto
 * do campeonato de fora.
 */
export function retireFromDriving(career: CareerState): CareerState {
  if (career.mode !== 'driver') throw new Error('Você já se aposentou das pistas.');
  if (career.weekend) throw new Error('Termine o fim de semana antes de se aposentar.');
  if (career.succession) throw new Error('Resolva a sucessão primeiro.');
  const player = getPlayer(career);
  const message: InboxMessage = {
    id: `s${career.season}-retired`,
    date: seasonDate(career),
    category: 'season',
    title: 'Aposentadoria das pistas',
    body: `${fullName(player)} pendurou o capacete aos ${player.age} anos. A carreira continua fora do carro: você pode investir, aceitar o comando de uma equipe, comprar ou fundar a sua e acompanhar a carreira dos filhos.`,
  };
  const state = convertToExecutive(career);
  return { ...state, inbox: pushMessages(state.inbox, [message]) };
}

/**
 * Passa a carreira para o modo dirigente. Se a temporada já estava fechada, o
 * fechamento de piloto vira o de dirigente (com o resumo do ano guardado para
 * o arquivo). Usada pela aposentadoria e pela sucessão.
 */
export function convertToExecutive(career: CareerState): CareerState {
  if (career.mode === 'executive') return career;
  const summary = career.offseason ? archiveSeason(career) : null;
  let state = vacatePlayerSeat({ ...career, status: 'active' });
  state = {
    ...state,
    mode: 'executive',
    offseason: null,
    academy: null,
    sponsors: [],
    marketInterest: {},
    pendingEvents: state.pendingEvents.filter((e) => e.category === 'family'),
    license: { ...state.license, banRounds: 0 },
  };
  if (summary)
    state = {
      ...state,
      executiveOffseason: buildExecutiveOffseason(state, summary, {
        teamPosition: null,
        target: null,
        objectiveMet: null,
        prize: 0,
        profit: 0,
        dismissed: false,
        notes: [],
      }),
    };
  return state;
}

/**
 * Custo de vida de referência do personagem (antes do padrão de vida). Como
 * piloto, é o da categoria em que corre. Fora das pistas, acompanha o
 * prestígio dele: o da categoria mais alta cuja nota-base de reputação ele já
 * alcança. Um ex-campeão do Grand Prix Mundial não passa a viver com o custo do kart só por
 * acompanhar o kart.
 */
export function livingCostBase(career: CareerState): number {
  if (career.mode === 'driver') return getCategory(career.categoryId).economy.living;
  let living = 0;
  for (const category of CATEGORIES) {
    if (living === 0 || career.reputation >= (REPUTATION.TIER_BASE[category.tier] ?? 0)) living = Math.max(living, category.economy.living);
  }
  return living;
}

/* ------------------------------------------------------------------ */
/* Etapa                                                               */
/* ------------------------------------------------------------------ */

export function applyExecutiveRoundEffects(input: CareerState, record: RoundRecord, gridDrops: Readonly<Record<string, number>>): CareerState {
  let career = input;
  const { season } = career;
  const round = record.round;
  const share = 1 / Math.max(1, career.calendar.length);
  const messages: InboxMessage[] = [];
  const msg = (id: string, kind: InboxMessage['category'], title: string, body: string) =>
    messages.push({ id: `s${season}-r${round}-${id}`, date: record.date, category: kind, title, body });

  /* 1. Finanças pessoais: salário de chefe de equipe, custo de vida, patrimônio e família. */
  let finance = career.finance;
  const m0 = career.management;
  if (m0 && m0.position === 'principal') finance = post(finance, season, round, 'salary', m0.salary * share, 'Salário de chefe de equipe');
  finance = post(finance, season, round, 'living', -livingCostBase(career) * LIFESTYLE_RULES[finance.lifestyle].cost * share, 'Custo de vida');
  career = { ...career, finance };
  career = { ...career, finance: settleAssetsRound(career, round) };

  /* 2. Condição e lesões de todos os pilotos; punições de grid. */
  const drivers: Driver[] = career.drivers.map((d) => {
    if (!d.teamId) return d;
    const e = record.race.entries.find((x) => x.driverId === d.id) ?? null;
    const target = career.teams.find((t) => t.id === d.teamId)?.driverTarget ?? 10;
    const condition = d.role === 'reserve' && !e ? d.condition : conditionAfterRace(d.condition, e, target);
    let injury = recoverInjury(d.injury, !e);
    if (e?.injured) injury = rollInjury(hashSeed(career.seed, season, round, 'injury', d.id));
    return { ...d, condition, injury };
  });
  career = { ...career, drivers, gridPenalties: { ...gridDrops } };

  /* 3. Evolução dos pilotos. Os da equipe do jogador ganham com o simulador, o engenheiro-chefe e o comando. */
  career = { ...career, drivers: developAfterRound(career.drivers, career.seed, season, round, 1).drivers };
  const m1 = career.management;
  if (m1) {
    const confidence = (staffRating(m1, 'chiefEngineer') - 60) / 40;
    const morale = (principalRating(career) - 60) / 40;
    career = {
      ...career,
      drivers: career.drivers.map((d) => {
        if (d.teamId !== m1.teamId) return d;
        const trained =
          m1.facilities.simulator > 0
            ? developDriver(d, hashSeed(career.seed, season, round, 'simulator', d.id), 1, m1.facilities.simulator * MANAGEMENT.SIMULATOR_DRIVER_DEV).driver
            : d;
        return {
          ...trained,
          condition: {
            ...trained.condition,
            confidence: round1(clamp(trained.condition.confidence + confidence)),
            morale: round1(clamp(trained.condition.morale + morale)),
          },
        };
      }),
    };
  }

  /* 4. Caixa e pesquisa da equipe. */
  const winner = career.drivers.find((d) => d.id === record.race.entries[0]?.driverId);
  if (career.management) {
    const result = settleTeamRound(career, record);
    career = { ...career, management: result.management, teams: result.teams };
    for (const item of result.messages) msg(item.id, item.category, item.title, item.body);
    const team = managedTeam(career);
    const mine = record.race.entries.filter((e) => e.teamId === result.management.teamId);
    const position = computeTeamStandings(career.rounds, career.teams, career.adjustments).find((s) => s.teamId === result.management.teamId)?.position ?? 10;
    const lines = mine.map((e) => {
      const d = career.drivers.find((x) => x.id === e.driverId);
      return `${d ? fullName(d) : 'Piloto'}: ${e.status === 'finished' ? `${e.position}º (largou em ${e.grid}º), ${counted(e.points, 'ponto', 'pontos')}` : 'abandonou'}`;
    });
    msg(
      'race',
      'race',
      `Etapa ${round}: resultado da ${team?.name ?? 'equipe'}`,
      `${lines.join('. ')}. Vencedor: ${winner ? fullName(winner) : '-'}. A equipe é a ${position}ª no campeonato (meta: ${result.management.boardTarget}ª). Caixa: ${money(career, result.management.budget)}.`,
    );
  } else {
    msg('race', 'race', `Etapa ${round}`, `Vencedor: ${winner ? fullName(winner) : '-'}. Você acompanha o campeonato de fora.`);
  }
  career = { ...career, inbox: pushMessages(career.inbox, messages) };

  /* 5. Eventos de gestão. */
  const event = managementRoundEvent(career, record);
  if (event) career = { ...career, pendingEvents: [...career.pendingEvents, event] };
  return career;
}

/* ------------------------------------------------------------------ */
/* Fechamento da temporada                                             */
/* ------------------------------------------------------------------ */

export function executiveSummary(career: CareerState): SeasonSummary {
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const teams = computeTeamStandings(career.rounds, career.teams, career.adjustments);
  const m = career.management;
  const team = managedTeam(career);
  const mine = m ? teams.find((t) => t.teamId === m.teamId) : undefined;
  return {
    season: career.season,
    year: career.year,
    categoryId: career.categoryId,
    championDriverId: standings[0]?.driverId ?? '',
    championTeamId: teams[0]?.teamId ?? '',
    playerTeamId: team?.id ?? '',
    playerTeamName: team?.name ?? 'Sem equipe',
    playerPosition: mine?.position ?? 1,
    playerPoints: mine?.points ?? 0,
    objectiveTarget: m?.boardTarget ?? 1,
    objectiveMet: m && mine ? mine.position <= m.boardTarget : true,
    driverStandings: standings.map((s) => ({ driverId: s.driverId, teamId: s.teamId, position: s.position, points: s.points, wins: s.wins })),
    driverNames: Object.fromEntries(career.drivers.map((d) => [d.id, fullName(d)])),
    teamColors: Object.fromEntries(career.teams.map((t) => [t.id, t.color])),
    rounds: career.rounds.map(compactRound),
    mode: 'executive',
  };
}

/** Prestígio do dirigente no mercado: reputação mais o retrospecto das três últimas temporadas no comando. */
export function executiveStanding(career: CareerState): number {
  const record = career.executiveLog.slice(-3).reduce((sum, l) => sum + (l.position <= l.target ? 4 : -3), 0);
  return career.reputation + record;
}

/**
 * Propostas para comandar uma equipe. Cada equipe exige um prestígio mínimo,
 * maior nas categorias de cima e nas equipes mais fortes: base da categoria
 * (a mesma escala da reputação) + 1,5 por posição na ordem de forças − 8. De
 * cada uma das três categorias mais altas em que alguém aceita o jogador, vem a
 * proposta da equipe mais forte.
 */
export function buildJobOffers(career: CareerState): JobOffer[] {
  const standing = executiveStanding(career);
  const offers: JobOffer[] = [];
  for (const category of [...CATEGORIES].sort((a, b) => b.tier - a.tier)) {
    if (offers.length >= 3) break;
    const ranked = rankTeams(teamsOfCategory(career, category.id));
    const rank = ranked.findIndex(
      (team, r) =>
        standing >= (REPUTATION.TIER_BASE[category.tier] ?? 0) + (9 - r) * 1.5 - 8 &&
        !(career.management?.teamId === team.id && career.management.categoryId === category.id),
    );
    const team = ranked[rank];
    if (!team) continue;
    offers.push({
      id: `job-s${career.season}-${category.id}-${team.id}`,
      categoryId: category.id,
      teamId: team.id,
      teamName: team.name,
      rank,
      salary: Math.round(lerp(TEAM_ECONOMY[category.id].principalSalary, rank / 9) / 1000) * 1000,
      target: Math.min(10, rank + 2),
    });
  }
  return offers;
}

/** Equipes à venda: em cada categoria, as duas mais fracas e uma do meio do grid. */
export function buildTeamListings(career: CareerState): TeamListing[] {
  const listings: TeamListing[] = [];
  for (const category of CATEGORIES) {
    const ranked = rankTeams(teamsOfCategory(career, category.id));
    for (const rank of [5, 8, 9]) {
      const team = ranked[rank];
      if (!team || (career.management?.teamId === team.id && career.management.categoryId === category.id)) continue;
      const variation = 0.95 + (hashSeed(career.seed, career.season, 'listing', team.id) % 11) / 100;
      // O preço inclui o caixa com que a equipe é entregue.
      const cashOnHand = TEAM_ECONOMY[category.id].operations * MANAGEMENT.STARTING_BUDGET;
      listings.push({
        id: `sale-s${career.season}-${category.id}-${team.id}`,
        categoryId: category.id,
        teamId: team.id,
        teamName: team.name,
        rank,
        price: Math.round((teamValue(category.id, rank) * variation + cashOnHand) / 1000) * 1000,
      });
    }
  }
  return listings;
}

/** Custo de fundar uma equipe em uma categoria. */
export function foundingCost(categoryId: CategoryId): number {
  const economy = TEAM_ECONOMY[categoryId];
  return Math.round(economy.value[1] * MANAGEMENT.FOUNDING_COST + economy.operations * MANAGEMENT.STARTING_BUDGET);
}

/**
 * Pilotos disponíveis para a equipe na próxima temporada: os atuais, os que
 * ficam livres, três estreantes e os filhos do jogador com carreira na mesma
 * categoria (ou prontos para subir a ela).
 *
 * Quanto melhor o piloto, mais ele custa: no Grand Prix Mundial, o salário pedido cresce com
 * a nota; nas categorias de base, é o piloto que paga, e os melhores pagam
 * menos (de 105% a 65% do preço de tabela da vaga; ver driverTerms). Um piloto só aceita se a
 * equipe estiver à altura da ambição dele.
 */
export function buildDriverCandidates(career: CareerState): DriverCandidate[] {
  const m = career.management;
  if (!m) return [];
  const category = getCategory(m.categoryId);
  const ranked = rankTeams(career.teams);
  const rank = Math.max(
    0,
    ranked.findIndex((t) => t.id === m.teamId),
  );
  const nextSeason = career.season + 1;
  const attractiveness = m.reputation + (staffRating(m, 'sportingDirector') - 60) * 0.3;
  const grid = fieldRatings(career);
  // Idade-limite: no Grand Prix Mundial, quem chega aos 38 se aposenta; nas outras, vale a idade máxima da categoria.
  const tooOld = (ageNextSeason: number) => (category.tier === 7 ? ageNextSeason >= 38 : ageNextSeason > category.field.maxAge + 1);
  const candidate = (driver: Driver, origin: DriverCandidate['origin'], inWorld: boolean, childId: string | null): DriverCandidate => {
    const t = driverTerms(m.categoryId, rank, driver, grid);
    const family = origin === 'child';
    const age = driver.age + (inWorld ? 1 : 0);
    const willing = !tooOld(age) && (family || origin === 'rookie' || attractiveness + (origin === 'current' ? 18 : 8) >= t.ambition);
    return {
      driverId: driver.id,
      name: fullName(driver),
      age,
      rating: t.rating,
      origin,
      salary: family ? 0 : t.salary,
      seatFee: family ? 0 : t.seatFee,
      years: 1 + (hashSeed(career.seed, 'deal', driver.id, nextSeason) % 2),
      willing,
      driver: inWorld ? null : driver,
      childId,
    };
  };

  const list: DriverCandidate[] = [];
  const childByDriver = new Map(career.family.children.filter((c) => c.driver).map((c) => [c.driver?.id ?? '', c]));
  for (const d of career.drivers.filter((x) => x.teamId === m.teamId))
    list.push(candidate(d, childByDriver.has(d.id) ? 'child' : 'current', true, childByDriver.get(d.id)?.id ?? null));
  const former = formerCharacterIds(career);
  const free = career.drivers
    .filter(
      (d) =>
        !d.isPlayer &&
        !former.has(d.id) &&
        d.teamId !== m.teamId &&
        (d.teamId === null || d.role === 'reserve' || d.contractEnd <= career.season) &&
        !tooOld(d.age + 1),
    )
    .sort((a, b) => overallRating(b.attributes) - overallRating(a.attributes))
    .slice(0, 8);
  for (const d of free) list.push(candidate(d, 'market', true, null));
  const usedNames = new Set(career.drivers.map(fullName));
  for (let i = 0; i < 3; i++) {
    const id = `${category.id}-s${nextSeason}-cand-${i}`;
    list.push(
      candidate(
        generateDriver({
          id,
          seed: hashSeed(career.seed, 'driver', id),
          category,
          teamRank: 2 + i * 3,
          teamId: null,
          role: 'second',
          season: nextSeason,
          usedNames,
          rookie: true,
        }),
        'rookie',
        false,
        null,
      ),
    );
  }
  for (const child of career.family.children) {
    if (child.stage !== 'racing' || !child.driver || !child.racing || career.drivers.some((d) => d.id === child.driver?.id)) continue;
    const childTier = getCategory(child.racing.categoryId).tier;
    const ready = child.driver.age >= category.requirements.minAge && Math.floor(child.driver.attributes.experience) >= category.requirements.minExperience;
    if (childTier === category.tier || (childTier === category.tier - 1 && ready)) list.push(candidate(child.driver, 'child', false, child.id));
  }
  return list;
}

function defaultLineup(career: CareerState, candidates: readonly DriverCandidate[]): string[] {
  const m = career.management;
  if (!m) return [];
  const current = career.drivers
    .filter((d) => d.teamId === m.teamId && d.role !== 'reserve')
    // Primeiro piloto na frente; entre iguais, a ordem de chegada (um comparador que ignora o segundo
    // argumento dá ordens diferentes de um motor de JavaScript para outro).
    .sort((a, b) => Number(b.role === 'first') - Number(a.role === 'first'))
    .map((d) => d.id);
  const willing = candidates.filter((c) => c.willing);
  const lineup = current.filter((id) => willing.some((c) => c.driverId === id));
  for (const c of [...willing].sort((a, b) => b.rating - a.rating)) {
    if (lineup.length >= 2) break;
    if (!lineup.includes(c.driverId)) lineup.push(c.driverId);
  }
  return lineup.slice(0, 2);
}

type Evaluation = Pick<ExecutiveOffseason, 'teamPosition' | 'target' | 'objectiveMet' | 'prize' | 'profit' | 'dismissed' | 'notes'>;

export function buildExecutiveOffseason(career: CareerState, summary: SeasonSummary, evaluation: Evaluation): ExecutiveOffseason {
  const keepsTeam = career.management !== null && !evaluation.dismissed;
  const candidates = keepsTeam ? buildDriverCandidates(career) : [];
  return {
    summary,
    ...evaluation,
    jobOffers: buildJobOffers(career),
    listings: buildTeamListings(career),
    candidates,
    lineup: keepsTeam ? defaultLineup(career, candidates) : [],
    sponsorOffers: keepsTeam && career.management ? buildSponsorOffers(career.seed, career.season, career.management) : [],
  };
}

/** Equipe técnica na virada do ano: a experiência muda as notas, e contratos vencidos são renovados ou perdidos. */
function staffYearEnd(career: CareerState, m: ManagedTeam, notes: string[]): StaffMember[] {
  const staff: StaffMember[] = [];
  for (const person of m.staff) {
    const rng = createRng(hashSeed(career.seed, career.season, 'staff-year', person.id));
    const rating = Math.round(clamp(person.rating + gaussian(rng) * 1.5, 30, 97));
    if (person.contractEnd <= career.season) {
      // Profissional muito acima do nível da equipe tende a aceitar proposta de fora.
      if (rating - m.reputation > 15 && rng.next() < 0.5) {
        notes.push(`${person.name} não renovou e deixou a equipe. A função fica vaga até você contratar alguém.`);
        continue;
      }
      // Na renovação, o salário volta ao valor de mercado da nota atual (sem reajuste acumulado).
      staff.push({ ...person, rating, contractEnd: career.season + 2, salary: staffSalary(m.categoryId, rating, person.role) });
    } else {
      staff.push({ ...person, rating });
    }
  }
  return staff;
}

export function closeExecutiveSeason(career: CareerState): CareerState {
  if (career.executiveOffseason) return career;
  const { season } = career;
  const rounds = career.calendar.length;
  const date = career.calendar[rounds - 1]?.date ?? `${career.year}-12-01`;
  const category = getCategory(career.categoryId);
  const teamStandings = computeTeamStandings(career.rounds, career.teams, career.adjustments);
  const driverStandings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const summary = executiveSummary(career);
  const notes: string[] = [];
  let finance = career.finance;
  let reputation = career.reputation;
  let management = career.management;
  let executiveLog = career.executiveLog;
  const evaluation: Evaluation = { teamPosition: null, target: null, objectiveMet: null, prize: 0, profit: 0, dismissed: false, notes };

  if (management) {
    const team = managedTeam(career);
    const position = teamStandings.find((s) => s.teamId === management?.teamId)?.position ?? 10;
    const target = management.boardTarget;
    const met = position <= target;
    const economy = TEAM_ECONOMY[management.categoryId];
    const profit = Object.entries(management.ledger).reduce((sum, [key, value]) => sum + (key === 'owner' ? 0 : value), 0);
    const prize = Math.round(lerp(economy.prize, (position - 1) / 9));
    notes.push(
      `A ${team?.name ?? 'equipe'} terminou em ${position}º no campeonato de equipes (meta: ${target}º). Resultado do ano: ${money(career, profit)}. Prêmio para a próxima temporada: ${money(career, prize)}.`,
    );

    // Patrocinadores: quem viu a equipe muito abaixo do combinado sai; contratos vencidos só renovam com a meta cumprida.
    let brokenDeals = 0;
    const sponsors = management.sponsors
      .filter((s) => {
        if (position > s.targetPosition + 2) {
          notes.push(
            `${s.name} rompeu o patrocínio: queria a equipe entre as ${s.targetPosition} primeiras. A quebra de contrato arranha a reputação da equipe.`,
          );
          brokenDeals += 1;
          return false;
        }
        if (s.endSeason <= season && position > s.targetPosition) {
          notes.push(`${s.name} não renovou o patrocínio.`);
          return false;
        }
        return true;
      })
      .map((s) => (s.endSeason <= season ? { ...s, endSeason: season + 1 } : s));

    const teamReputation = Math.round(
      clamp(
        management.reputation +
          (92 - (position - 1) * 8 - management.reputation) * MANAGEMENT.REPUTATION_SPEED * (0.8 + principalRating(career) / 250) -
          brokenDeals * MANAGEMENT.BROKEN_SPONSOR_REPUTATION,
      ),
    );
    let budget = management.budget;
    // Advertência: ficar duas ou mais posições abaixo da meta, ou fechar o ano no vermelho.
    let strikes = met && budget >= 0 ? 0 : management.strikes + (position > target + 1 || budget < 0 ? 1 : 0);
    if (management.position === 'owner') {
      strikes = 0;
      if (budget < 0) {
        finance = post(finance, season, rounds, 'team', budget, 'Cobertura do prejuízo da equipe');
        notes.push(`A equipe fechou o ano com ${money(career, -budget)} de saldo negativo, cobertos com o seu dinheiro.`);
        budget = 0;
      }
    } else {
      if (met) {
        const bonus = Math.round(management.salary * MANAGEMENT.TARGET_BONUS);
        finance = post(finance, season, rounds, 'bonus', bonus, 'Bônus por meta cumprida');
        notes.push(`A diretoria pagou ${money(career, bonus)} de bônus pela meta cumprida.`);
      }
      // Equipe de terceiros: os donos retiram o lucro que passa da reserva e cobrem o prejuízo.
      const reserve = Math.round(economy.operations * MANAGEMENT.STARTING_BUDGET);
      if (budget > reserve * 2) {
        notes.push(`Os donos da equipe retiraram ${money(career, budget - reserve * 2)} de lucro acumulado.`);
        budget = reserve * 2;
      } else if (budget < 0) {
        notes.push(`Os donos cobriram ${money(career, -budget)} de prejuízo e cobraram explicações.`);
        budget = Math.round(reserve * 0.5);
      }
    }
    if (strikes >= MANAGEMENT.MAX_STRIKES) {
      evaluation.dismissed = true;
      notes.push(`Depois de ${MANAGEMENT.MAX_STRIKES} temporadas abaixo do esperado, a diretoria demitiu você.`);
    } else if (strikes > 0) {
      notes.push('A diretoria avisou: mais uma temporada abaixo do esperado e você será demitido.');
    }
    // Reputação do dirigente: mesma escala do piloto, com a posição da equipe convertida para a escala de 20 carros.
    const prestige = (REPUTATION.TIER_BASE[category.tier] ?? 0) + positionPrestige(position * 2 - 1);
    reputation = Math.round(clamp(reputation + (prestige - reputation) * 0.3));
    management = {
      ...management,
      budget,
      prize,
      strikes,
      reputation: teamReputation,
      sponsors,
      staff: staffYearEnd(career, management, notes),
      previousPosition: position,
    };
    executiveLog = [...executiveLog, { season, categoryId: management.categoryId, teamName: team?.name ?? '', position, target, profit }].slice(-40);
    Object.assign(evaluation, { teamPosition: position, target, objectiveMet: met, prize, profit });
  } else {
    // Fora dos holofotes, a fama diminui devagar.
    reputation = Math.max(0, reputation - 1);
  }
  if (career.family.partner?.background === 'media') reputation = Math.min(100, reputation + 1);

  // Patrimônio, imposto e família.
  const assets = closeAssetsYear({ ...career, finance });
  notes.push(...assets.notes);
  const closed = closeSeasonFinance({ ...career, finance: assets.finance });
  let personal = closed.finance;
  let teams = career.teams;

  // Dívida pessoal acima de dois anos de custo de vida: os credores executam os bens; se não bastar,
  // a equipe própria é vendida à força; e só o que ainda sobrar é perdoado, com dano à reputação.
  const ceiling = livingCostBase(career) * 2;
  if (personal.cash < -ceiling) {
    const liquidation = liquidateAssets(personal, season, rounds, -personal.cash - ceiling);
    personal = liquidation.finance;
    if (liquidation.raised > 0)
      notes.push(`Para cobrir a sua dívida, os credores executaram ${money(career, liquidation.raised)} do seu patrimônio (${liquidation.sold.join(', ')}).`);
    if (personal.cash < -ceiling && management && management.position === 'owner') {
      const team = managedTeam(career);
      const proceeds = Math.round(ownedTeamValue({ ...career, management }) * FORCED_SALE_DISCOUNT);
      personal = post(personal, season, rounds, 'assets', proceeds, `Venda forçada da equipe ${team?.name ?? ''}`);
      notes.push(`Sem ter como pagar o que deve, você foi obrigado a vender a ${team?.name ?? 'equipe'} por ${money(career, proceeds)}.`);
      teams = normalizeFieldDevelopment({ ...career, management });
      management = null;
    }
    if (personal.cash < -ceiling) {
      const forgiven = Math.round(-personal.cash - ceiling);
      personal = { ...personal, cash: -ceiling };
      reputation = Math.max(0, reputation - DEBT_SETTLEMENT_REPUTATION);
      notes.push(
        `Acordo com credores: ${money(career, forgiven)} da sua dívida foram perdoados, ao custo de ${DEBT_SETTLEMENT_REPUTATION} pontos de reputação.`,
      );
    }
  }
  const worldResults: Record<string, { position: number; wins: number; driver: Driver; teamName: string }> = {};
  for (const child of career.family.children) {
    const driver = career.drivers.find((d) => d.id === child.driver?.id && d.teamId);
    const standing = driver ? driverStandings.find((s) => s.driverId === driver.id) : undefined;
    if (driver && standing)
      worldResults[driver.id] = {
        position: standing.position,
        wins: standing.wins,
        driver: { ...driver, teamId: null, role: null },
        teamName: career.teams.find((t) => t.id === driver.teamId)?.name ?? '',
      };
  }
  const family = closeFamilyYear(career, worldResults, new Set(Object.keys(worldResults)));

  let state: CareerState = { ...career, teams, finance: personal, reputation, management, executiveLog, family: family.family };
  state = syncManagedTeam(state);
  const champion = career.drivers.find((d) => d.id === driverStandings[0]?.driverId);
  const messages: InboxMessage[] = [
    {
      id: `s${season}-end`,
      date,
      category: 'season',
      title: `Fim da temporada ${career.year}`,
      body: `${champion ? fullName(champion) : 'O líder da tabela'} venceu ${categoryRef(category.id, 'the')}. ${notes.join(' ')} Imposto de renda do ano: ${money(career, closed.report.tax)}. Veja as decisões para a próxima temporada na tela Carreira.`,
    },
  ];
  if (family.notes.length > 0) messages.push({ id: `s${season}-family`, date, category: 'family', title: 'A família neste ano', body: family.notes.join(' ') });
  state = { ...state, inbox: pushMessages(state.inbox, messages), executiveOffseason: buildExecutiveOffseason(state, summary, evaluation) };
  return checkMortality(state);
}

/* ------------------------------------------------------------------ */
/* Decisões do fechamento                                              */
/* ------------------------------------------------------------------ */

function requireOffseason(career: CareerState): ExecutiveOffseason {
  if (career.mode !== 'executive' || !career.executiveOffseason) throw new Error('A temporada ainda não terminou.');
  if (career.succession) throw new Error('Resolva a sucessão primeiro.');
  return career.executiveOffseason;
}

/** Define a dupla de pilotos da próxima temporada: [primeiro, segundo]. */
export function setLineup(career: CareerState, driverIds: readonly string[]): CareerState {
  const off = requireOffseason(career);
  if (driverIds.length > 2 || new Set(driverIds).size !== driverIds.length) throw new Error('Escolha até dois pilotos diferentes.');
  for (const id of driverIds) {
    const c = off.candidates.find((x) => x.driverId === id);
    if (!c) throw new Error('Piloto indisponível.');
    if (!c.willing) throw new Error(`${c.name} não aceita correr pela sua equipe.`);
  }
  return { ...career, executiveOffseason: { ...off, lineup: [...driverIds] } };
}

export function acceptTeamSponsor(career: CareerState, sponsorId: string): CareerState {
  const off = requireOffseason(career);
  const m = requireManagement(career);
  const sponsor = off.sponsorOffers.find((s) => s.id === sponsorId);
  if (!sponsor) throw new Error('Proposta de patrocínio indisponível.');
  if (m.sponsors.length >= MANAGEMENT.SPONSOR_SLOTS)
    throw new Error(`A equipe só tem espaço para ${MANAGEMENT.SPONSOR_SLOTS} patrocinadores. Dispense um antes.`);
  return {
    ...career,
    management: { ...m, sponsors: [...m.sponsors, sponsor] },
    executiveOffseason: { ...off, sponsorOffers: off.sponsorOffers.filter((s) => s.id !== sponsorId) },
  };
}

export function dropTeamSponsor(career: CareerState, sponsorId: string): CareerState {
  const m = requireManagement(career);
  return { ...career, management: { ...m, sponsors: m.sponsors.filter((s) => s.id !== sponsorId) } };
}

/** Deixa a equipe no fechamento: o dono a vende (com imposto sobre o ganho); o chefe contratado pede demissão. */
export function leaveTeam(career: CareerState): CareerState {
  const off = requireOffseason(career);
  const m = requireManagement(career);
  const team = managedTeam(career);
  let finance = career.finance;
  const rounds = career.calendar.length;
  let note: string;
  if (m.position === 'owner') {
    const proceeds = ownedTeamValue(career);
    finance = post(finance, career.season, rounds, 'assets', proceeds, `Venda da equipe ${team?.name ?? ''}`);
    finance = post(
      finance,
      career.season,
      rounds,
      'tax',
      -Math.max(0, Math.round((proceeds - m.purchasePrice) * ASSET_RULES.CAPITAL_GAINS_TAX)),
      'Imposto sobre ganho de capital',
    );
    note = `Você vendeu a ${team?.name ?? 'equipe'} por ${money(career, proceeds)}.`;
  } else {
    note = `Você deixou o comando da ${team?.name ?? 'equipe'}.`;
  }
  const state: CareerState = { ...career, finance, teams: normalizeFieldDevelopment(career), management: null };
  return {
    ...state,
    executiveOffseason: {
      ...off,
      candidates: [],
      lineup: [],
      sponsorOffers: [],
      notes: [...off.notes, note],
      jobOffers: buildJobOffers(state),
      listings: buildTeamListings(state),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Nova temporada                                                      */
/* ------------------------------------------------------------------ */

export type ExecutivePlan =
  | { kind: 'continue' }
  | { kind: 'spectate' }
  | { kind: 'job'; offerId: string }
  | { kind: 'buy'; listingId: string }
  | { kind: 'found'; categoryId: CategoryId; name: string; color: string };

/**
 * Acerto de fim de ano do desenvolvimento, quando o jogador dirige uma equipe.
 * Como todas as equipes evoluíram durante a temporada, a média dessa evolução
 * é descontada de todas (o regulamento e a concorrência "consomem" o ganho), e
 * o que a equipe do jogador ganhou acima da média perde 30%. Sem equipe
 * administrada, não há o que acertar. Usada na virada do ano e sempre que o
 * jogador deixa a equipe (venda, demissão, sucessão), para os ganhos do ano
 * não ficarem embutidos nos carros.
 */
export function normalizeFieldDevelopment(career: CareerState): Team[] {
  const m = career.management;
  if (!m) return career.teams;
  const gains = Object.values(m.fieldGains);
  const mean = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const limit = (v: number) => clamp(round1(v), 40, 97);
  const carry = (now: number, base: number, shift: number) => {
    const excess = now - base - shift;
    return base + (excess > 0 ? excess * MANAGEMENT.CARRY_OVER : excess);
  };
  return career.teams.map((t) => {
    if (t.id === m.teamId) {
      return {
        ...t,
        car: {
          engine: limit(carry(t.car.engine, m.baseCar.engine, mean)),
          chassis: limit(carry(t.car.chassis, m.baseCar.chassis, mean)),
          reliability: limit(carry(t.car.reliability, m.baseCar.reliability, 0)),
        },
      };
    }
    return { ...t, car: { ...t.car, engine: limit(t.car.engine - mean), chassis: limit(t.car.chassis - mean) } };
  });
}

/**
 * Evolução das equipes na virada do ano. As rivais seguem a regra de sempre
 * (ganham ou perdem até 2 pontos pelo resultado). A equipe do jogador não
 * recebe esse ajuste: o carro dela é o que a pesquisa construiu.
 */
function evolveTeamsExecutive(career: CareerState): Team[] {
  const m = career.management;
  const normalized = normalizeFieldDevelopment(career);
  const evolved = evolveTeams(normalized, career);
  if (!m) return evolved;
  const mine = normalized.find((t) => t.id === m.teamId);
  const teams = evolved.map((t) => (mine && t.id === mine.id ? { ...t, car: mine.car } : t));
  const order = rankTeams(teams).map((t) => t.id);
  return teams.map((t) => ({ ...t, driverTarget: TEAM_TARGETS[order.indexOf(t.id)] ?? 16 }));
}

function validTeamName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 3 || clean.length > 28) throw new Error('O nome da equipe deve ter de 3 a 28 caracteres.');
  return clean;
}

export function startExecutiveSeason(career: CareerState, plan: ExecutivePlan): CareerState {
  const off = requireOffseason(career);
  if (career.pendingEvents.length > 0) throw new Error('Resolva as decisões pendentes antes de começar a temporada.');
  const player = getPlayer(career);
  const nextSeason = career.season + 1;
  const nextYear = career.year + 1;
  const previous = off.dismissed ? null : career.management;
  const news: string[] = [];
  let finance = career.finance;

  if (plan.kind === 'continue' && !previous) throw new Error('Você não tem equipe para comandar.');
  if (plan.kind !== 'continue' && previous)
    throw new Error(previous.position === 'owner' ? 'Venda a sua equipe antes de mudar de rumo.' : 'Deixe o comando da equipe atual antes de mudar de rumo.');

  // Categoria e equipe de destino.
  let categoryId = career.categoryId;
  let targetTeamId: string | null = null;
  let options: Parameters<typeof createManagedTeam>[2] | null = null;
  let founding: { name: string; color: string } | null = null;
  if (plan.kind === 'job') {
    const offer = off.jobOffers.find((o) => o.id === plan.offerId);
    if (!offer) throw new Error('Proposta não encontrada.');
    categoryId = offer.categoryId;
    targetTeamId = offer.teamId;
    options = { position: 'principal', salary: offer.salary, purchasePrice: 0 };
    news.push(
      `Você é o novo chefe de equipe da ${offer.teamName}, com salário de ${money(career, offer.salary)} por temporada. Meta: terminar entre as ${offer.target} primeiras.`,
    );
  } else if (plan.kind === 'buy') {
    const listing = off.listings.find((l) => l.id === plan.listingId);
    if (!listing) throw new Error('Equipe não está à venda.');
    // Quem já é sócio paga só a parte que falta: a participação é absorvida na compra.
    const stake = finance.stakes.find((x) => x.teamId === listing.teamId && x.categoryId === listing.categoryId);
    const price = Math.max(0, listing.price - (stake?.value ?? 0));
    if (price > finance.cash) throw new Error('Saldo em caixa insuficiente para comprar a equipe.');
    finance = post(finance, career.season, career.calendar.length, 'team', -price, `Compra da equipe ${listing.teamName}`);
    if (stake) {
      finance = { ...finance, stakes: finance.stakes.filter((x) => x.id !== stake.id) };
      news.push(
        `A sua participação de ${Math.round(stake.share * 100)}% na ${listing.teamName} entrou no negócio: você pagou ${money(career, price)} pelo restante.`,
      );
    }
    categoryId = listing.categoryId;
    targetTeamId = listing.teamId;
    options = { position: 'owner', salary: 0, purchasePrice: listing.price };
    if (!stake) news.push(`Você comprou a ${listing.teamName} por ${money(career, listing.price)}.`);
  } else if (plan.kind === 'found') {
    const cost = foundingCost(plan.categoryId);
    if (!/^#[0-9a-fA-F]{6}$/.test(plan.color)) throw new Error('Cor inválida.');
    const name = validTeamName(plan.name);
    if (cost > finance.cash) throw new Error('Saldo em caixa insuficiente para fundar a equipe.');
    finance = post(finance, career.season, career.calendar.length, 'team', -cost, `Fundação da equipe ${name}`);
    categoryId = plan.categoryId;
    founding = { name, color: plan.color };
    options = { position: 'owner', salary: 0, purchasePrice: cost, founded: true };
    news.push(`Você fundou a ${name}, que estreia ${categoryRef(categoryId, 'em')}. A inscrição e o equipamento custaram ${money(career, cost)}.`);
  }
  const category: CategoryDefinition = getCategory(categoryId);

  // Grid da nova temporada.
  let teams: Team[];
  let others: Driver[];
  const newcomers = new Set<string>();
  const former = formerCharacterIds(career);
  const worldChildIds = new Set(career.family.children.map((c) => c.driver?.id).filter((id): id is string => !!id && career.drivers.some((d) => d.id === id)));
  let lineup: DriverCandidate[] = [];
  if (categoryId === career.categoryId) {
    teams = evolveTeamsExecutive(career);
    if (isRegulationChange(career.seed, career.season, career.categoryId))
      news.push(`Regulamento técnico novo ${categoryRef(category.id, 'em')}: as rivais refizeram o projeto e a ordem de forças entre elas pode ter mudado.`);
    if (plan.kind === 'continue' && previous) {
      lineup = off.lineup.map((id) => off.candidates.find((c) => c.driverId === id)).filter((c): c is DriverCandidate => c !== undefined);
      if (lineup.length !== 2) throw new Error('Escolha os dois pilotos da equipe para a próxima temporada.');
      const reserved = lineup.map((c) => {
        const driver = c.driver ?? career.drivers.find((d) => d.id === c.driverId);
        if (!driver) throw new Error('Piloto escolhido não existe mais.');
        if (c.driver) newcomers.add(c.driverId);
        return { ...driver, contractEnd: nextSeason + c.years - 1 };
      });
      const keep = new Set(lineup.map((c) => c.driverId));
      const pool = career.drivers.filter((d) => !former.has(d.id) && (!worldChildIds.has(d.id) || keep.has(d.id)));
      const market = runAiMarket(career, pool, teams, { teamId: '', role: 'first' }, nextSeason, { teamId: previous.teamId, drivers: reserved });
      others = market.drivers;
      news.push(...market.news);
    } else {
      const pool = career.drivers.filter((d) => !former.has(d.id) && !worldChildIds.has(d.id));
      const market = runAiMarket(career, pool, teams, { teamId: '', role: 'first' }, nextSeason);
      others = market.drivers;
      news.push(...market.news);
    }
  } else {
    const field = buildCategoryField(categoryId, career.seed, nextSeason, new Set([fullName(player)]));
    teams = field.teams;
    others = field.drivers;
    for (const d of others) newcomers.add(d.id);
  }

  if (founding) {
    // A equipe nova ocupa a inscrição da mais fraca do grid e herda o equipamento dela, um pouco pior.
    const weakest = rankTeams(teams)[teams.length - 1];
    if (!weakest) throw new Error('Categoria sem equipes.');
    const id = `own-${hashSeed(career.seed, 'team', nextSeason).toString(16)}`;
    const initials = founding.name
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase();
    const team: Team = {
      ...weakest,
      id,
      name: founding.name,
      shortName: (initials.length >= 2 ? initials : founding.name.toUpperCase()).slice(0, 3),
      color: founding.color,
      affiliation: null,
      car: {
        engine: Math.max(40, weakest.car.engine - 1),
        chassis: Math.max(40, weakest.car.chassis - 1),
        reliability: Math.max(40, weakest.car.reliability - 2),
      },
    };
    teams = teams.map((t) => (t.id === weakest.id ? team : t));
    others = others.map((d) => (d.teamId === weakest.id ? { ...d, teamId: id } : d));
    targetTeamId = id;
  }

  const drivers = [{ ...player }, ...others].map((d) => (newcomers.has(d.id) ? d : winter(d, career.seed, career.season)));
  const calendar = buildCalendar(career.seed, nextSeason, nextYear, category);
  const date = calendar[0]?.date ?? `${nextYear}-03-01`;

  let state: CareerState = {
    ...career,
    season: nextSeason,
    year: nextYear,
    categoryId,
    drivers,
    teams,
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    adjustments: [],
    gridPenalties: {},
    finance,
    relations: { ...career.relations, rivalries: {} },
    pendingEvents: [],
    offseason: null,
    executiveOffseason: null,
    management: null,
    history: trimHistory([...career.history, off.summary], familyDriverIds(career)),
  };

  // Gestão: continua (com a virada de ano), começa em outra equipe ou não existe.
  if (plan.kind === 'continue' && previous) {
    const rank = Math.max(
      0,
      rankTeams(teams).findIndex((t) => t.id === previous.teamId),
    );
    const car = teams.find((t) => t.id === previous.teamId)?.car ?? previous.baseCar;
    const deals: ManagedTeam['deals'] = {};
    for (const c of lineup) deals[c.driverId] = { salary: c.salary, seatFee: c.seatFee, endSeason: nextSeason + c.years - 1 };
    for (const d of drivers.filter((x) => x.teamId === previous.teamId && x.role === 'reserve')) deals[d.id] = { salary: 0, seatFee: 0, endSeason: nextSeason };
    const zero = { aero: 0, chassis: 0, engine: 0, suspension: 0, manufacturing: 0 };
    state = {
      ...state,
      management: {
        ...previous,
        boardTarget: Math.min(10, rank + 2),
        baseCar: { ...car },
        // O contador de melhorias e o gasto do ano zeram; a pesquisa em andamento continua de onde parou.
        development: { ...previous.development, allocation: normalizeAllocation(previous.categoryId, previous.development.allocation), gains: zero, spent: 0 },
        fieldGains: {},
        ledger: {},
        deals,
        staffMarket: buildStaffMarket(career.seed, nextSeason, previous.categoryId, previous.reputation),
      },
    };
  } else if (options && targetTeamId) {
    state = { ...state, management: createManagedTeam(state, targetTeamId, options) };
  }
  state = syncManagedTeam(state);

  // Filhos: quem corre pela equipe do jogador fica no campeonato; os demais seguem a carreira por fora.
  const managed = state.management;
  const teamName = managedTeam(state)?.name ?? '';
  const teamRank = managed
    ? Math.max(
        0,
        rankTeams(state.teams).findIndex((t) => t.id === managed.teamId),
      )
    : 0;
  const childNotes: string[] = [];
  const children = state.family.children.map((child) => {
    const id = child.driver?.id;
    if (!id || !child.racing || child.stage !== 'racing') return child;
    const inLineup = managed !== null && state.drivers.some((d) => d.id === id && d.teamId === managed.teamId);
    if (inLineup && managed) return { ...child, racing: { ...child.racing, categoryId: managed.categoryId, teamName, teamRank, familyCost: 0, stalled: 0 } };
    if (worldChildIds.has(id)) {
      const planned = planChildSeason(child, career);
      if (planned.note) childNotes.push(planned.note);
      return planned.child;
    }
    return child;
  });
  state = { ...state, family: { ...state.family, children } };

  const messages: InboxMessage[] = [
    {
      id: `s${nextSeason}-start`,
      date,
      category: 'season',
      title: `Temporada ${nextYear}: ${category.shortName}`,
      body: managed
        ? `Você comanda a ${teamName} ${categoryRef(category.id, 'em')}. Meta: terminar entre as ${managed.boardTarget} primeiras equipes. Caixa da equipe: ${money(career, managed.budget)}.`
        : `Você acompanha ${categoryRef(category.id, 'the')} sem cargo em nenhuma equipe. As propostas voltam a aparecer no fim da temporada.`,
    },
  ];
  if (news.length > 0) messages.push({ id: `s${nextSeason}-market`, date, category: 'contract', title: 'Movimentações', body: news.join(' ') });
  if (childNotes.length > 0)
    messages.push({ id: `s${nextSeason}-children`, date, category: 'family', title: 'Carreira dos filhos', body: childNotes.join(' ') });
  return beginSeasonFamily({ ...state, inbox: pushMessages(career.inbox, messages) });
}
