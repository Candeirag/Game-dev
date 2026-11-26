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
 */
import type {
  Academy,
  CareerState,
  Child,
  ChildRacing,
  Contract,
  Driver,
  DriverAttributes,
  HeirOption,
  InboxMessage,
  LineageEntry,
  SeasonSummary,
  TeamStake,
} from '@/domain/schemas';
import { ASSET_RULES } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { CATEGORY_HUB } from '@/data/hubs';
import { CHILD_FIRST_NAMES, FAMILY, getTrait } from '@/data/family';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { buildCalendar } from '../career/createCareer';
import { netWorth, post } from '../career/economy';
import { pushMessages } from '../career/inbox';
import { updateMarketInterest } from '../career/market';
import { archiveSeason, trimHistory } from '../career/offseason';
import { familyDriverIds, fullName, getPlayer } from '../career/selectors';
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
import { childSummary, closeFamilyYear, emptyFamily } from './family';
import { beginSeasonFamily } from './familyEvents';
import { ensureHeritage } from './heritage';
import { categoryRef } from '@/domain/categoryNames';
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

/** Títulos e vitórias de um personagem como piloto, a partir das temporadas arquivadas. */
function drivingRecord(seasons: readonly SeasonSummary[], driverId: string): { titles: number; wins: number } {
  let titles = 0;
  let wins = 0;
  for (const s of seasons) {
    if (s.mode !== 'driver') continue;
    const row = s.driverStandings.find((d) => d.driverId === driverId);
    if (!row) continue;
    wins += row.wins;
    if (row.position === 1) titles += 1;
  }
  return { titles, wins };
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

/** Sorteio anual de mortalidade, feito no fechamento de cada temporada. */
export function checkMortality(career: CareerState): CareerState {
  if (career.succession) return career;
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

export function resolveSuccession(career: CareerState, heirId: string, path: 'driver' | 'executive'): CareerState {
  const succession = career.succession;
  if (!succession) throw new Error('Não há sucessão em aberto.');
  const option = succession.heirs.find((h) => h.id === heirId);
  if (!option) throw new Error('Herdeiro não encontrado.');
  if (path === 'driver' && !option.canDrive) throw new Error('Este herdeiro não tem carreira de piloto.');
  if (path === 'executive' && !option.canManage) throw new Error('Este herdeiro ainda não pode assumir os negócios.');

  const former = getPlayer(career);
  let state: CareerState = { ...career, succession: null };

  // No meio da temporada (acidente), fecha o ano dos filhos para o herdeiro chegar com a temporada dele concluída.
  // Só no caminho das pistas: ali a temporada em curso é abandonada. No dos negócios, o ano
  // segue e a família fecha o ano normalmente, no fim da temporada.
  const midSeason = !state.offseason && !state.executiveOffseason;
  if (midSeason && path === 'driver') state = { ...state, family: closeFamilyYear(state).family };
  const child = option.childId ? state.family.children.find((c) => c.id === option.childId) : undefined;
  const heirDriver = child?.driver ?? option.driver;
  const heirRacing = child?.racing ?? option.racing;

  // Herança: imposto e parte dos irmãos (só quando o herdeiro é um dos filhos).
  const round = state.calendar.length;
  let finance = post(
    state.finance,
    state.season,
    round,
    'inheritance',
    -succession.tax,
    succession.cause === 'handover' ? 'Imposto sobre a doação' : 'Imposto de herança',
  );
  const siblings = option.kind === 'child' ? state.family.children.filter((c) => c.id !== option.childId).length : 0;
  const siblingsShare = Math.round(Math.max(0, succession.estate - succession.tax) * ASSET_RULES.SIBLING_SHARE * Math.min(3, siblings));
  finance = post(finance, state.season, round, 'inheritance', -siblingsShare, 'Parte dos irmãos na herança');
  state = { ...state, finance };

  // Linhagem.
  const peak = Math.max(...state.dynasty.lineage.map((l) => l.peakReputation), state.reputation);
  const closing = state.offseason ? archiveSeason(state) : state.executiveOffseason?.summary;
  const record = drivingRecord([...state.history, ...(closing ? [closing] : [])], former.id);
  const lineage: LineageEntry[] = state.dynasty.lineage.map((entry, index, all) =>
    index === all.length - 1
      ? {
          ...entry,
          toSeason: state.season,
          endReason: succession.cause,
          titles: record.titles,
          wins: record.wins,
          peakReputation: Math.max(entry.peakReputation, state.reputation),
          netWorthPassed: Math.round(succession.estate - succession.tax - siblingsShare),
        }
      : entry,
  );
  const generation = state.dynasty.generation + 1;
  const newEntry = (driverId: string, name: string, age: number, year: number): LineageEntry => ({
    generation,
    driverId,
    name,
    bornYear: year - age,
    fromSeason: state.season + 1,
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
  const family = option.kind === 'child' ? emptyFamily() : { ...state.family, partner: option.kind === 'partner' ? null : state.family.partner };
  const inheritedNote = `Patrimônio recebido: ${money(career, succession.estate - succession.tax - siblingsShare)} (imposto de ${money(career, succession.tax)}${siblingsShare > 0 ? `; ${money(career, siblingsShare)} para os irmãos` : ''}).`;

  if (path === 'executive') {
    state = convertToExecutive(state);
    const base: Driver = heirDriver ?? {
      id: `dyn-${option.id}-g${generation}-s${state.season}`,
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
      // A memória das histórias é do personagem: o herdeiro começa a dele (Fase 5).
      story: emptyStory(base.id),
      family,
      dynasty: { ...state.dynasty, generation, lineage: [...lineage, newEntry(base.id, option.name, option.age, state.year)] },
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
          body: `${option.name} passa a cuidar do patrimônio${keepsTeam ? ' e da equipe' : ''} da família ${former.lastName}. ${inheritedNote}`,
        },
      ]),
    };
  }

  /* ---------------- Herdeiro piloto: nova temporada, na categoria dele ---------------- */
  if (!heirDriver || !heirRacing) throw new Error('Este herdeiro não tem carreira de piloto.');
  const summary: SeasonSummary = state.executiveOffseason?.summary ?? (state.offseason ? archiveSeason(state) : { ...executiveSummary(state), mode: 'driver' });
  const nextSeason = state.season + 1;
  const nextYear = state.year + 1;
  const category = getCategory(heirRacing.categoryId);
  const notes: string[] = [inheritedNote];

  // A equipe da família fica com gestores contratados: vira uma participação de 100%, que paga dividendos.
  const m = state.management;
  if (m && m.position === 'owner') {
    const team = state.teams.find((t) => t.id === m.teamId);
    const stake: TeamStake = {
      id: `stake-${m.categoryId}-${m.teamId}`,
      teamId: m.teamId,
      teamName: team?.name ?? 'Equipe da família',
      categoryId: m.categoryId,
      share: 1,
      cost: m.purchasePrice,
      value: ownedTeamValue(state),
      lastPosition: m.previousPosition ?? m.boardTarget,
      lastDividend: 0,
    };
    state = { ...state, finance: { ...state.finance, stakes: [...state.finance.stakes.filter((s) => s.id !== stake.id), stake] } };
    notes.push(`A ${stake.teamName} segue com gestores contratados; a família continua dona e recebe os dividendos.`);
  }

  const field = buildCategoryField(category.id, state.seed, nextSeason, new Set([fullName(heirDriver)]));
  const ranked = rankTeams(field.teams);
  const rank = Math.min(ranked.length - 1, heirRacing.teamRank);
  const team = ranked[rank];
  if (!team) throw new Error('Categoria sem equipes.');
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
  const drivers = [player, ...field.drivers.filter((d) => !(d.teamId === team.id && d.role === role))];
  const win = Math.round(category.economy.winBonus * (1.2 - 0.7 * t));
  const salary = Math.round((lerp(category.economy.salary, t) * 0.7) / 1000) * 1000;
  const seatCost = Math.round(lerp(category.economy.seatCost, t) / 500) * 500;
  const contract: Contract = {
    teamId: team.id,
    categoryId: category.id,
    role,
    startSeason: nextSeason,
    endSeason: nextSeason,
    salary,
    seatCost,
    bonuses: { win, podium: Math.round(win * 0.35), point: Math.round(win * 0.02), title: win * 5 },
    clauses: { releaseFee: 0, performanceTarget: null },
  };
  const calendar = buildCalendar(state.seed, nextSeason, nextYear, category);
  const date = calendar[0]?.date ?? `${nextYear}-03-01`;

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
    teams: field.teams,
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
    sponsors: [],
    academy: category.tier < 7 ? academyFor(heirRacing, nextSeason) : null,
    // O contrato com o investidor, a vaquinha e o trabalho paralelo eram do piloto que saiu; o herdeiro mora no polo do campeonato dele.
    hub: { id: CATEGORY_HUB[category.id], arrivedSeason: 0 },
    investor: null,
    crowdfund: null,
    sideJob: 'none',
    noDoorSeasons: 0,
    license: { history: heirRacing.license, penaltyPoints: 0, banRounds: 0 },
    relations: { teamTrust: 50, teammate: 50, rivalries: {}, rivalryLog: [] },
    // A memória das histórias é do personagem: o herdeiro começa a dele (Fase 5).
    story: emptyStory(player.id),
    marketInterest: {},
    pendingEvents: [],
    offseason: null,
    executiveOffseason: null,
    executiveLog: [],
    management: null,
    history: trimHistory([...state.history, summary], familyDriverIds(state)),
    seasonTrend: recordSeasonTrend(state),
    family,
    dynasty: { ...state.dynasty, generation, lineage: [...lineage, newEntry(player.id, fullName(player), player.age, nextYear)] },
  };
  next = { ...next, marketInterest: updateMarketInterest(next, 1) };
  next = addSeasonStartStoryEvents(next);
  const message: InboxMessage = {
    id: `s${nextSeason}-heir-g${generation}`,
    date,
    category: 'family',
    title: `${fullName(player)} continua a história`,
    body: `${fullName(player)}, ${player.age} anos, é agora o piloto da família ${former.lastName}: corre ${categoryRef(category.id, 'the')} pela ${team.name}, como ${role === 'first' ? 'primeiro' : 'segundo'} piloto. A vaga custa ${money(career, seatCost)} por temporada. ${notes.join(' ')}`,
  };
  return beginSeasonFamily({ ...next, inbox: pushMessages(state.inbox, [message]) });
}
