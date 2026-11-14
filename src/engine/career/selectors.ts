/** Consultas puras sobre o estado da carreira. Usadas pela UI e pelo próprio motor. */
import type { CareerState, ChampionshipEvent, Driver, Team } from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { computeDriverStandings, computeTeamStandings } from '../championship/standings';

export function getPlayer(career: CareerState): Driver {
  const player = career.drivers.find((d) => d.id === career.playerDriverId);
  if (!player) throw new Error('Piloto do jogador não encontrado no save.');
  return player;
}

export function getTeam(career: CareerState, teamId: string): Team {
  const team = career.teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`Equipe não encontrada: ${teamId}`);
  return team;
}

export function getPlayerTeam(career: CareerState): Team {
  const player = getPlayer(career);
  if (!player.teamId) throw new Error('O jogador está sem equipe.');
  return getTeam(career, player.teamId);
}

export function getCareerCategory(career: CareerState): CategoryDefinition {
  return getCategory(career.categoryId);
}

/** Companheiro de equipe titular do jogador (null se a vaga estiver vazia). */
export function getTeammate(career: CareerState): Driver | null {
  const player = getPlayer(career);
  return career.drivers.find((d) => d.teamId === player.teamId && d.id !== player.id && d.role !== 'reserve') ?? null;
}

export function getReserve(career: CareerState, teamId: string): Driver | null {
  return career.drivers.find((d) => d.teamId === teamId && d.role === 'reserve') ?? null;
}

export function getNextEvent(career: CareerState): ChampionshipEvent | null {
  return career.calendar[career.nextRoundIndex] ?? null;
}

export function getCurrentEvent(career: CareerState): ChampionshipEvent | null {
  if (!career.weekend) return null;
  return career.calendar.find((e) => e.round === career.weekend?.round) ?? null;
}

/** Pilotos titulares (com vaga de corrida) da categoria atual. */
export function getRaceDrivers(career: CareerState): Driver[] {
  return career.drivers.filter((d) => d.teamId !== null && d.role !== 'reserve');
}

export function driverMap(career: CareerState): Record<string, Driver> {
  return Object.fromEntries(career.drivers.map((d) => [d.id, d]));
}

export function teamMap(career: CareerState): Record<string, Team> {
  return Object.fromEntries(career.teams.map((t) => [t.id, t]));
}

export function isSeasonComplete(career: CareerState): boolean {
  return career.nextRoundIndex >= career.calendar.length && career.weekend === null;
}

export function driverStandings(career: CareerState) {
  return computeDriverStandings(career.rounds, career.drivers, career.adjustments);
}

export function teamStandings(career: CareerState) {
  return computeTeamStandings(career.rounds, career.teams, career.adjustments);
}

/**
 * Pilotos da família: todos os personagens que o jogador já controlou e os
 * filhos que correm. O arquivo de temporadas antigas guarda os resultados
 * deles por inteiro.
 */
export function familyDriverIds(career: CareerState): Set<string> {
  const ids = new Set(career.dynasty.lineage.map((l) => l.driverId));
  ids.add(career.playerDriverId);
  for (const child of career.family.children) if (child.driver) ids.add(child.driver.id);
  return ids;
}

export function fullName(driver: Pick<Driver, 'firstName' | 'lastName'>): string {
  return `${driver.firstName} ${driver.lastName}`;
}

export function trackName(trackId: string): string {
  return getTrack(trackId).name;
}

export function teamKey(categoryId: string, teamId: string): string {
  return `${categoryId}:${teamId}`;
}
