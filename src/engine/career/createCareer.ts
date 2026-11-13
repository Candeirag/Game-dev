import { CAREER_SCHEMA_VERSION, type AttributeKey, type CareerState, type ChampionshipEvent, type Driver } from '@/domain/schemas';
import { AI_DRIVERS, ROOKIE_SEAT_DRIVER } from '@/data/drivers';
import {
  CHAMPIONSHIP_NAME,
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
import { ROOKIE_TEAM_IDS, TEAMS } from '@/data/teams';
import { CALENDAR_DATES, TRACKS } from '@/data/tracks';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { hashSeed } from '../rng';
import { generateEventWeather } from '../simulation/weather';
import { TRAINABLE_ATTRIBUTES } from './training';

export const PLAYER_DRIVER_ID = 'player';

export interface NewCareerInput {
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  background: PlayerBackground;
  bonus: Partial<Record<AttributeKey, number>>;
  teamId: string;
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
  return problems;
}

export function buildCalendar(careerSeed: number, season: number, year: number): ChampionshipEvent[] {
  return TRACKS.map((track, index) => ({
    round: index + 1,
    trackId: track.id,
    date: `${year}-${CALENDAR_DATES[index] ?? '01-01'}`,
    weather: generateEventWeather(hashSeed(careerSeed, season, index + 1, 'weather'), track),
  }));
}

export function createCareer(input: NewCareerInput, seed: number, now: string): CareerState {
  const problems = validateNewCareerInput(input);
  if (problems.length) throw new Error(problems.join(' '));

  const background = PLAYER_BACKGROUNDS.find((b) => b.id === input.background);
  if (!background) throw new Error('Perfil inválido.');

  const attributes = { ...background.attributes };
  for (const key of TRAINABLE_ATTRIBUTES) attributes[key] += input.bonus[key] ?? 0;

  const player: Driver = {
    id: PLAYER_DRIVER_ID,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationality: input.nationality,
    age: input.age,
    teamId: input.teamId,
    isPlayer: true,
    attributes,
    potential: background.potential,
    trainingFocus: 'balanced',
  };

  const displacedId = ROOKIE_SEAT_DRIVER[input.teamId];
  const aiDrivers: Driver[] = AI_DRIVERS.map((d) => ({
    ...d,
    attributes: { ...d.attributes },
    teamId: d.id === displacedId ? null : d.teamId,
    trainingFocus: chooseAiTrainingFocus(d.attributes),
  }));

  const team = TEAMS.find((t) => t.id === input.teamId);
  if (!team) throw new Error('Equipe inválida.');
  const year = FIRST_SEASON_YEAR;
  const calendar = buildCalendar(seed, 1, year);
  const firstDate = calendar[0]?.date ?? `${year}-01-01`;

  return {
    schemaVersion: CAREER_SCHEMA_VERSION,
    id: `career-${seed.toString(16)}`,
    createdAt: now,
    updatedAt: now,
    seed,
    season: 1,
    year,
    playerDriverId: PLAYER_DRIVER_ID,
    reputation: STARTING_REPUTATION,
    drivers: [player, ...aiDrivers],
    teams: TEAMS.map((t) => ({ ...t, kart: { ...t.kart } })),
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    playerSeasonStartAttributes: { ...attributes },
    history: [],
    inbox: [
      {
        id: 's1-welcome',
        date: firstDate,
        category: 'team',
        title: `Bem-vindo à ${team.name}`,
        body: `Você é o novo piloto da ${team.name} no ${CHAMPIONSHIP_NAME} de ${year}. A equipe espera que você termine o campeonato entre os ${team.driverTarget} primeiros. Escolha um programa de treino no painel e prepare-se para a etapa de abertura.`,
      },
    ],
  };
}
