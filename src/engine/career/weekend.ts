/**
 * Fluxo do fim de semana de corrida: treino livre, classificação e corrida.
 * Cada função recebe o estado da carreira e devolve um novo estado, sem
 * modificar o original. A UI só chama estas funções; ela nunca aplica regras.
 */
import type {
  CareerState,
  PracticeProgram,
  QualifyingApproach,
  RoundRecord,
  TrainingFocus,
  TrainingIntensity,
  WeekendState,
} from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { getTrack, raceLaps, referenceLapTime } from '@/data/tracks';
import { chooseAiPracticeProgram, chooseAiQualifyingApproach } from '../ai/decisions';
import { hashSeed } from '../rng';
import { simulatePractice } from '../simulation/practice';
import { simulateQualifying } from '../simulation/qualifying';
import {
  buildStrategyOptions,
  createRaceSim,
  finalizeRace,
  gridDropsFromRace,
  isRaceFinished,
  simulateRemainingRace,
  type RaceContext,
  type RaceSimState,
  type StrategyOption,
  type StrategyPlan,
} from '../simulation/race';
import { checkFatalAccident } from '../dynasty/succession';
import { applyExecutiveRoundEffects, closeExecutiveSeason } from '../management/executive';
import { isUnavailable } from './condition';
import { moveInvestment, type InvestmentMove } from './economy';
import { closeSeason } from './offseason';
import { applyRoundEffects } from './roundEffects';
import { driverMap, getPlayer, getTeam, teamMap } from './selectors';

function requireWeekend(career: CareerState, phase: WeekendState['phase']) {
  const weekend = career.weekend;
  if (!weekend) throw new Error('Nenhum fim de semana em andamento.');
  if (weekend.phase !== phase) throw new Error(`Fase atual é "${weekend.phase}", esperado "${phase}".`);
  const event = career.calendar.find((e) => e.round === weekend.round);
  if (!event) throw new Error(`Etapa ${weekend.round} não está no calendário.`);
  return { weekend, event, track: getTrack(event.trackId), category: getCategory(career.categoryId) };
}

export function sessionSeed(career: CareerState, round: number, session: string): number {
  return hashSeed(career.seed, career.season, round, session);
}

export function setTrainingFocus(career: CareerState, focus: TrainingFocus): CareerState {
  return { ...career, drivers: career.drivers.map((d) => (d.id === career.playerDriverId ? { ...d, trainingFocus: focus } : d)) };
}

export function setTrainingIntensity(career: CareerState, intensity: TrainingIntensity): CareerState {
  return { ...career, trainingIntensity: intensity };
}

/** Aplica ou resgata dinheiro de um investimento. */
export function invest(career: CareerState, move: InvestmentMove): CareerState {
  return { ...career, finance: moveInvestment(career.finance, move.product, move.amount) };
}

/** O jogador pode disputar a próxima etapa? Se não, por quê. */
export function playerAvailability(career: CareerState): { available: boolean; reason: 'injury' | 'ban' | null; canRest: boolean } {
  const player = getPlayer(career);
  if (career.license.banRounds > 0) return { available: false, reason: 'ban', canRest: false };
  if (isUnavailable(player)) return { available: false, reason: 'injury', canRest: false };
  return { available: true, reason: null, canRest: player.injury !== null };
}

/**
 * Abre o fim de semana e define quem corre: os titulares disponíveis e, no
 * lugar de quem está lesionado ou suspenso, o reserva da equipe. Com lesão
 * leve, o jogador pode escolher descansar (`rest`) e ceder a vaga.
 */
export function startWeekend(career: CareerState, options: { rest?: boolean } = {}): CareerState {
  if (career.status !== 'active') throw new Error('A carreira está encerrada.');
  if (career.succession) throw new Error('Escolha o herdeiro antes de continuar.');
  if (career.weekend) throw new Error('Já existe um fim de semana em andamento.');
  if (career.pendingEvents.length > 0) throw new Error('Resolva as decisões pendentes antes do fim de semana.');
  const event = career.calendar[career.nextRoundIndex];
  if (!event) throw new Error('A temporada já terminou.');

  // No modo dirigente, o jogador não corre: a etapa é disputada só pelos pilotos das equipes.
  const availability = playerAvailability(career);
  const playerParticipates = career.mode === 'driver' && availability.available && !(options.rest && availability.canRest);
  const entrants: WeekendState['entrants'] = [];
  for (const team of career.teams) {
    const reserve = career.drivers.find((d) => d.teamId === team.id && d.role === 'reserve');
    let reserveUsed = false;
    for (const driver of career.drivers.filter((d) => d.teamId === team.id && d.role !== 'reserve')) {
      const out = driver.isPlayer ? !playerParticipates : isUnavailable(driver);
      if (!out) entrants.push({ driverId: driver.id, teamId: team.id });
      else if (reserve && !reserveUsed && !isUnavailable(reserve)) {
        entrants.push({ driverId: reserve.id, teamId: team.id });
        reserveUsed = true;
      }
    }
  }
  return { ...career, weekend: { round: event.round, phase: 'practice', practice: null, qualifying: null, entrants, playerParticipates } };
}

/**
 * Pilotos cujas decisões de treino e classificação são do jogador: ele mesmo
 * ou, no modo dirigente, os dois pilotos da equipe que ele comanda.
 */
function directedByPlayer(career: CareerState, driver: { isPlayer: boolean; teamId: string | null }): boolean {
  return driver.isPlayer || (career.mode === 'executive' && career.management !== null && driver.teamId === career.management.teamId);
}

function entrantDrivers(career: CareerState, weekend: WeekendState) {
  const drivers = driverMap(career);
  return weekend.entrants.map((e) => {
    const driver = drivers[e.driverId];
    if (!driver) throw new Error(`Piloto ${e.driverId} não existe.`);
    return { driver, team: getTeam(career, e.teamId) };
  });
}

export function runPractice(career: CareerState, playerProgram: PracticeProgram): CareerState {
  const { weekend, event, track, category } = requireWeekend(career, 'practice');
  const participants = entrantDrivers(career, weekend).map(({ driver, team }) => ({
    driver,
    team,
    program: directedByPlayer(career, driver) ? playerProgram : chooseAiPracticeProgram(driver.attributes, track),
  }));
  const practice = simulatePractice(participants, track, event.weather.practice, sessionSeed(career, weekend.round, 'practice'), category);
  return { ...career, weekend: { ...weekend, phase: 'qualifying', practice } };
}

export function runQualifying(career: CareerState, playerApproach: QualifyingApproach): CareerState {
  const { weekend, event, track, category } = requireWeekend(career, 'qualifying');
  const practice = weekend.practice;
  if (!practice) throw new Error('Treino livre não foi disputado.');
  const weather = event.weather.qualifying;
  const participants = entrantDrivers(career, weekend).map(({ driver, team }) => {
    const entry = practice.entries.find((e) => e.driverId === driver.id);
    if (!entry) throw new Error(`Piloto ${driver.id} sem resultado de treino.`);
    return { driver, team, approach: directedByPlayer(career, driver) ? playerApproach : chooseAiQualifyingApproach(driver.attributes, weather), modifiers: entry.modifiers };
  });
  const qualifying = simulateQualifying(participants, track, weather, sessionSeed(career, weekend.round, 'qualifying'), category, career.gridPenalties);
  return { ...career, weekend: { ...weekend, phase: 'race', qualifying } };
}

export function buildRaceContext(career: CareerState): RaceContext {
  const event = career.calendar.find((e) => e.round === career.weekend?.round);
  if (!event) throw new Error('Nenhuma etapa em andamento.');
  return { track: getTrack(event.trackId), category: getCategory(career.categoryId), drivers: driverMap(career), teams: teamMap(career), rivalries: career.relations.rivalries };
}

/** Estratégias de pneus disponíveis para o jogador nesta corrida. */
export function playerStrategyOptions(career: CareerState): StrategyOption[] {
  const { event, track, category } = requireWeekend(career, 'race');
  const player = getPlayer(career);
  return buildStrategyOptions(category.race, track, raceLaps(track, category), referenceLapTime(track, category), player.attributes, event.weather.race.wetness);
}

export function createWeekendRace(career: CareerState, playerPlan?: StrategyPlan): RaceSimState {
  const { weekend, event } = requireWeekend(career, 'race');
  const { practice, qualifying } = weekend;
  if (!practice || !qualifying) throw new Error('Treino e classificação precisam ser disputados antes da corrida.');
  const grid = qualifying.entries.map((q) => {
    const p = practice.entries.find((e) => e.driverId === q.driverId);
    if (!p) throw new Error(`Piloto ${q.driverId} sem resultado de treino.`);
    return { driverId: q.driverId, teamId: q.teamId, modifiers: p.modifiers, ...(q.driverId === career.playerDriverId && playerPlan ? { plan: playerPlan } : {}) };
  });
  return createRaceSim(grid, buildRaceContext(career), event.weather.race, sessionSeed(career, weekend.round, 'race'), career.playerDriverId);
}

/**
 * Encerra o fim de semana: grava o resultado oficial, aplica os efeitos da
 * etapa sobre todos os sistemas e avança o calendário. Na última etapa, faz
 * também o fechamento da temporada.
 */
export function completeWeekend(career: CareerState, race: RaceSimState): CareerState {
  const { weekend, event, category } = requireWeekend(career, 'race');
  if (!isRaceFinished(race)) throw new Error('A corrida ainda não terminou.');
  if (race.seed !== sessionSeed(career, weekend.round, 'race')) throw new Error('A corrida não pertence a esta etapa.');
  const { practice, qualifying } = weekend;
  if (!practice || !qualifying) throw new Error('Fim de semana incompleto.');

  const record: RoundRecord = { season: career.season, round: weekend.round, trackId: event.trackId, date: event.date, practice, qualifying, race: finalizeRace(race, category) };
  const withResult: CareerState = { ...career, rounds: [...career.rounds, record], weekend: null, nextRoundIndex: career.nextRoundIndex + 1 };
  const drops = gridDropsFromRace(race);
  if (career.mode === 'executive') {
    const next = applyExecutiveRoundEffects(withResult, record, drops);
    return next.nextRoundIndex >= next.calendar.length ? closeExecutiveSeason(next) : next;
  }
  const effects = applyRoundEffects(withResult, record, drops);
  const next = effects.nextRoundIndex >= effects.calendar.length ? closeSeason(effects) : effects;
  const injured = record.race.entries.find((e) => e.driverId === career.playerDriverId)?.injured ?? false;
  return checkFatalAccident(next, record.season, record.round, injured);
}

/**
 * Simula a etapa inteira sem o jogador no carro: lesionado, suspenso,
 * descansando ou, no modo dirigente, no pit wall. O dirigente escolhe o
 * programa de treino e a abordagem de classificação dos pilotos da equipe.
 */
export function simulateAbsentWeekend(career: CareerState, choices: { program?: PracticeProgram; approach?: QualifyingApproach } = {}): CareerState {
  const c = prepareAbsentWeekend(career, choices);
  const race = simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), { mode: 'balanced', auto: true });
  return completeWeekend(c, race);
}

/**
 * Leva uma etapa sem o jogador no carro até a hora da corrida (treino e
 * classificação). Quem quer assistir à corrida usa isto e depois simula as
 * voltas com as mesmas entradas de simulateAbsentWeekend; o resultado é igual.
 */
export function prepareAbsentWeekend(career: CareerState, choices: { program?: PracticeProgram; approach?: QualifyingApproach } = {}): CareerState {
  if (!career.weekend || career.weekend.playerParticipates) throw new Error('O jogador participa desta etapa.');
  let c = career;
  if (c.weekend?.phase === 'practice') c = runPractice(c, choices.program ?? 'setup');
  if (c.weekend?.phase === 'qualifying') c = runQualifying(c, choices.approach ?? 'balanced');
  return c;
}
