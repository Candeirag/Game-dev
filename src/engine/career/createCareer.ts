import {
  CAREER_SCHEMA_VERSION,
  type AttributeKey,
  type Birth,
  type CareerState,
  type ChampionshipEvent,
  type Contract,
  type Driver,
  type DriverAttributes,
} from '@/domain/schemas';
import { CATEGORY_HUB } from '@/data/hubs';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { AI_DRIVERS, NEUTRAL_CONDITION, ROOKIE_SEAT_DRIVER } from '@/data/drivers';
import {
  FIRST_SEASON_YEAR,
  NATIONALITIES,
  PLAYER_BACKGROUNDS,
  PLAYER_BONUS_MAX_PER_ATTRIBUTE,
  PLAYER_BONUS_POINTS,
  PLAYER_MAX_AGE,
  PLAYER_MIN_AGE,
  STARTING_REPUTATION,
  type PlayerBackground,
} from '@/data/rules';
import { ROOKIE_TEAM_IDS, initialTeams } from '@/data/teams';
import { calendarDates, getTrack } from '@/data/tracks';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { hashSeed } from '../rng';
import { generateEventWeather } from '../simulation/weather';
import { generateReserve, rankTeams } from '../world/generation';
import { emptyFamily } from '../dynasty/family';
import { emptyFinance } from './economy';
import { updateMarketInterest } from './market';
import { fullName } from './selectors';
import { familySupport } from './sponsors';
import { TRAINABLE_ATTRIBUTES } from './training';
import { categoryRef } from '@/domain/categoryNames';
import { currencyForNationality, formatMoney } from '@/domain/money';
import { BIRTH } from '@/config/balance';
import { HOMETOWNS } from '@/data/birth';
import { birthAttributeBonus, birthPotentialBonus, drawBirth, maxBirthRerolls } from '../birth/draw';

export const PLAYER_DRIVER_ID = 'player';

export interface NewCareerInput {
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  background: PlayerBackground;
  bonus: Partial<Record<AttributeKey, number>>;
  /** Equipe escolhida. Quem nasce no interior não escolhe: começa na equipe menor do regional. */
  teamId: string;
  /**
   * Qual sorteio do nascimento vale (Fase 2): 0 é o primeiro; cada "sortear de novo" soma 1. O
   * nascimento sai da semente da carreira e deste número (ver `drawBirth`).
   */
  birthAttempt?: number;
}

/** Valida a criação do piloto e devolve a lista de problemas (vazia se estiver tudo certo). */
export function validateNewCareerInput(input: NewCareerInput): string[] {
  const problems: string[] = [];
  if (!input.firstName.trim()) problems.push('Informe o nome do piloto.');
  if (!input.lastName.trim()) problems.push('Informe o sobrenome do piloto.');
  if (input.firstName.trim().length > 20 || input.lastName.trim().length > 24) problems.push('Nome muito longo.');
  if (!NATIONALITIES.some((n) => n.code === input.nationality)) problems.push('Nacionalidade inválida.');
  if (!Number.isInteger(input.age) || input.age < PLAYER_MIN_AGE || input.age > PLAYER_MAX_AGE) {
    problems.push(`A idade deve estar entre ${PLAYER_MIN_AGE} e ${PLAYER_MAX_AGE} anos.`);
  }
  if (!PLAYER_BACKGROUNDS.some((b) => b.id === input.background)) problems.push('Perfil inválido.');
  if (!ROOKIE_TEAM_IDS.includes(input.teamId)) problems.push('Esta equipe não tem vaga para estreantes.');
  let total = 0;
  for (const [key, value] of Object.entries(input.bonus)) {
    if (!TRAINABLE_ATTRIBUTES.includes(key as AttributeKey)) problems.push(`Atributo não pode receber bônus: ${key}.`);
    if (!Number.isInteger(value) || (value ?? 0) < 0 || (value ?? 0) > PLAYER_BONUS_MAX_PER_ATTRIBUTE) {
      problems.push(`Bônus inválido em ${key}.`);
    }
    total += value ?? 0;
  }
  if (total > PLAYER_BONUS_POINTS) problems.push(`No máximo ${PLAYER_BONUS_POINTS} pontos de bônus.`);
  const attempt = input.birthAttempt ?? 0;
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > maxBirthRerolls()) problems.push('Sorteio de nascimento inválido.');
  return problems;
}

export function buildCalendar(
  careerSeed: number,
  season: number,
  year: number,
  category: CategoryDefinition = getCategory('kart-regional'),
): ChampionshipEvent[] {
  const dates = calendarDates(year, category.rounds);
  return category.trackIds.slice(0, category.rounds).map((trackId, index) => ({
    round: index + 1,
    trackId,
    date: dates[index] ?? `${year}-01-01`,
    weather: generateEventWeather(hashSeed(careerSeed, season, index + 1, 'weather'), getTrack(trackId)),
  }));
}

/**
 * Atributos do piloto no primeiro dia: o perfil escolhido, os pontos livres e o que o corpo e a
 * mente de nascença somam (ou tiram). A tela de criação mostra a mesma conta.
 */
export function playerStartingAttributes(input: Pick<NewCareerInput, 'background' | 'bonus'>, aptitudes: Birth['aptitudes'] | null): DriverAttributes {
  const background = PLAYER_BACKGROUNDS.find((b) => b.id === input.background) ?? PLAYER_BACKGROUNDS[0];
  if (!background) throw new Error('Perfil inválido.');
  const attributes = { ...background.attributes };
  for (const key of TRAINABLE_ATTRIBUTES) attributes[key] += input.bonus[key] ?? 0;
  if (aptitudes) {
    for (const [key, value] of Object.entries(birthAttributeBonus(aptitudes)) as [AttributeKey, number][]) {
      attributes[key] = Math.min(100, Math.max(0, attributes[key] + value));
    }
  }
  return attributes;
}

/** A frase sobre o dinheiro da família na mensagem de boas-vindas. */
function familyHelpText(birth: Birth, currency: ReturnType<typeof currencyForNationality>): string {
  const town = HOMETOWNS.find((h) => h.id === birth.hometownId);
  const help =
    birth.support.seasons > 0
      ? `a família ajuda com ${formatMoney(birth.support.perSeason, currency)} por ano ${birth.support.seasons === 1 ? 'na primeira temporada' : `nas ${birth.support.seasons} primeiras temporadas`}.`
      : 'a família não tem como ajudar.';
  const interior =
    birth.region === 'interior'
      ? ` Morar em ${town?.name ?? 'cidade do interior'} custa viagens a cada etapa; a mudança para São Paulo vai ser assunto em breve.`
      : '';
  return `${help}${interior}`;
}

/** Desconto no custo da vaga para o estreante: as equipes de entrada apostam em jovens. */
const ROOKIE_SEAT_DISCOUNT = 0.25;

export function createCareer(input: NewCareerInput, seed: number, now: string): CareerState {
  const problems = validateNewCareerInput(input);
  if (problems.length) throw new Error(problems.join(' '));
  // A semente vai para o save e entra em todos os sorteios: tem de ser um inteiro de 32 bits sem sinal.
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`Semente inválida: ${seed}.`);

  const background = PLAYER_BACKGROUNDS.find((b) => b.id === input.background);
  if (!background) throw new Error('Perfil inválido.');
  const category = getCategory('kart-regional');

  // Nascimento: a família, o corpo e a mente e os traços ocultos saem da semente da carreira.
  const birth = drawBirth(seed, input.birthAttempt ?? 0, PLAYER_DRIVER_ID);
  const teamId = birth.region === 'interior' ? BIRTH.INTERIOR_TEAM_ID : input.teamId;
  const attributes = playerStartingAttributes(input, birth.aptitudes);

  const player: Driver = {
    id: PLAYER_DRIVER_ID,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationality: input.nationality,
    age: input.age,
    teamId,
    role: 'second',
    contractEnd: 1,
    isPlayer: true,
    attributes,
    potential: Math.min(100, background.potential + birthPotentialBonus(birth.aptitudes)),
    trainingFocus: 'balanced',
    condition: { ...NEUTRAL_CONDITION },
    injury: null,
  };

  // O estreante que cede a vaga ao jogador vira o reserva da equipe.
  const displacedId = ROOKIE_SEAT_DRIVER[teamId];
  const aiDrivers: Driver[] = AI_DRIVERS.map((d) => ({
    ...d,
    attributes: { ...d.attributes },
    condition: { ...d.condition },
    role: d.id === displacedId ? 'reserve' : d.role,
    trainingFocus: chooseAiTrainingFocus(d.attributes),
  }));

  const teams = initialTeams('kart-regional');
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error('Equipe inválida.');
  const ranked = rankTeams(teams);
  const usedNames = new Set([fullName(player), ...aiDrivers.map(fullName)]);
  const reserves = ranked.filter((t) => t.id !== teamId).map((t) => generateReserve(category, t, ranked.indexOf(t), seed, 1, usedNames));

  const rank = ranked.findIndex((t) => t.id === team.id);
  const [seatTop, seatBottom] = category.economy.seatCost;
  const seatCost = Math.round(((seatTop + (seatBottom - seatTop) * (rank / 9)) * (1 - ROOKIE_SEAT_DISCOUNT)) / 500) * 500;
  const contract: Contract = {
    teamId: team.id,
    categoryId: category.id,
    role: 'second',
    startSeason: 1,
    endSeason: 1,
    salary: 0,
    seatCost,
    bonuses: { win: 0, podium: 0, point: 0, title: 0 },
    clauses: { releaseFee: 0, performanceTarget: null },
  };

  const year = FIRST_SEASON_YEAR;
  const calendar = buildCalendar(seed, 1, year, category);
  const firstDate = calendar[0]?.date ?? `${year}-01-01`;

  const career: CareerState = {
    schemaVersion: CAREER_SCHEMA_VERSION,
    id: `career-${seed.toString(16)}`,
    createdAt: now,
    updatedAt: now,
    seed,
    season: 1,
    year,
    status: 'active',
    mode: 'driver',
    categoryId: category.id,
    playerDriverId: PLAYER_DRIVER_ID,
    reputation: STARTING_REPUTATION,
    drivers: [player, ...aiDrivers, ...reserves],
    teams,
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    adjustments: [],
    gridPenalties: {},
    playerSeasonStartAttributes: { ...attributes },
    trainingIntensity: 'normal',
    contract,
    finance: emptyFinance(birth.savings),
    sponsors: birth.support.seasons > 0 ? [familySupport(birth.support.perSeason, birth.support.seasons)] : [],
    academy: null,
    license: { history: [], penaltyPoints: 0, banRounds: 0 },
    relations: { teamTrust: 50, teammate: 50, rivalries: {}, rivalryLog: [] },
    marketInterest: {},
    pendingEvents: [],
    eventLog: [],
    offseason: null,
    history: [],
    seasonTrend: [],
    family: emptyFamily(),
    dynasty: {
      generation: 1,
      surname: player.lastName,
      lineage: [
        {
          generation: 1,
          driverId: player.id,
          name: fullName(player),
          bornYear: year - player.age,
          fromSeason: 1,
          toSeason: null,
          endReason: null,
          bestCategoryId: category.id,
          titles: 0,
          wins: 0,
          peakReputation: STARTING_REPUTATION,
          netWorthPassed: null,
        },
      ],
    },
    management: null,
    executiveOffseason: null,
    executiveLog: [],
    succession: null,
    tutorial: { done: [], dismissed: false },
    birth,
    hub: { id: CATEGORY_HUB[category.id], arrivedSeason: 1 },
    investor: null,
    crowdfund: null,
    sideJob: 'none',
    noDoorSeasons: 0,
    inbox: [
      {
        id: 's1-welcome',
        date: firstDate,
        category: 'team',
        title: `Bem-vindo à ${team.name}`,
        body: `Você é o novo piloto da ${team.name} ${categoryRef(category.id, 'em')} de ${year}. A equipe espera que você termine o campeonato entre os ${team.driverTarget} primeiros. A vaga custa ${formatMoney(seatCost, currencyForNationality(input.nationality))} por temporada, pagos em parcelas por etapa; ${familyHelpText(birth, currencyForNationality(input.nationality))} Escolha o programa de treino no painel e prepare-se para a etapa de abertura.`,
      },
    ],
  };
  return { ...career, marketInterest: updateMarketInterest(career, 1) };
}
