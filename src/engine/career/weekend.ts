/**
 * Fluxo do fim de semana de corrida: treino livre, classificação e corrida.
 * Cada função recebe o estado da carreira e devolve um novo estado, sem
 * modificar o original. A UI só chama estas funções; ela nunca aplica regras.
 */
import type {
  CareerState,
  InboxMessage,
  PracticeProgram,
  QualifyingApproach,
  RaceResult,
  RoundRecord,
  TrainingFocus,
} from '@/domain/schemas';
import { ATTRIBUTE_LABELS, TRAINING_FOCUS_LABELS } from '@/domain/labels';
import { getTrack } from '@/data/tracks';
import { chooseAiPracticeProgram, chooseAiQualifyingApproach } from '../ai/decisions';
import { computeDriverStandings } from '../championship/standings';
import { hashSeed } from '../rng';
import { simulatePractice } from '../simulation/practice';
import { simulateQualifying } from '../simulation/qualifying';
import { createRaceSim, finalizeRace, isRaceFinished, type RaceContext, type RaceSimState } from '../simulation/race';
import { developAfterRound, type AttributeDelta } from './development';
import { pushMessages } from './inbox';
import { driverMap, fullName, getActiveDrivers, getPlayer, getTeam, teamMap } from './selectors';

function requireWeekend(career: CareerState, phase: 'practice' | 'qualifying' | 'race') {
  const weekend = career.weekend;
  if (!weekend) throw new Error('Nenhum fim de semana em andamento.');
  if (weekend.phase !== phase) throw new Error(`Fase atual é "${weekend.phase}", esperado "${phase}".`);
  const event = career.calendar.find((e) => e.round === weekend.round);
  if (!event) throw new Error(`Etapa ${weekend.round} não está no calendário.`);
  return { weekend, event, track: getTrack(event.trackId) };
}

export function sessionSeed(career: CareerState, round: number, session: string): number {
  return hashSeed(career.seed, career.season, round, session);
}

export function setTrainingFocus(career: CareerState, focus: TrainingFocus): CareerState {
  return {
    ...career,
    drivers: career.drivers.map((d) => (d.id === career.playerDriverId ? { ...d, trainingFocus: focus } : d)),
  };
}

export function startWeekend(career: CareerState): CareerState {
  if (career.weekend) throw new Error('Já existe um fim de semana em andamento.');
  const event = career.calendar[career.nextRoundIndex];
  if (!event) throw new Error('A temporada já terminou.');
  return { ...career, weekend: { round: event.round, phase: 'practice', practice: null, qualifying: null } };
}

export function runPractice(career: CareerState, playerProgram: PracticeProgram): CareerState {
  const { weekend, event, track } = requireWeekend(career, 'practice');
  const participants = getActiveDrivers(career).map((driver) => ({
    driver,
    team: getTeam(career, driver.teamId ?? ''),
    program: driver.isPlayer ? playerProgram : chooseAiPracticeProgram(driver.attributes, track),
  }));
  const practice = simulatePractice(participants, track, event.weather.practice, sessionSeed(career, weekend.round, 'practice'));
  return { ...career, weekend: { ...weekend, phase: 'qualifying', practice } };
}

export function runQualifying(career: CareerState, playerApproach: QualifyingApproach): CareerState {
  const { weekend, event, track } = requireWeekend(career, 'qualifying');
  const practice = weekend.practice;
  if (!practice) throw new Error('Treino livre não foi disputado.');
  const weather = event.weather.qualifying;
  const participants = getActiveDrivers(career).map((driver) => {
    const entry = practice.entries.find((e) => e.driverId === driver.id);
    if (!entry) throw new Error(`Piloto ${driver.id} sem resultado de treino.`);
    return {
      driver,
      team: getTeam(career, driver.teamId ?? ''),
      approach: driver.isPlayer ? playerApproach : chooseAiQualifyingApproach(driver.attributes, weather),
      modifiers: entry.modifiers,
    };
  });
  const qualifying = simulateQualifying(participants, track, weather, sessionSeed(career, weekend.round, 'qualifying'));
  return { ...career, weekend: { ...weekend, phase: 'race', qualifying } };
}

export function buildRaceContext(career: CareerState): RaceContext {
  const event = career.calendar.find((e) => e.round === career.weekend?.round);
  if (!event) throw new Error('Nenhuma etapa em andamento.');
  return { track: getTrack(event.trackId), drivers: driverMap(career), teams: teamMap(career) };
}

export function createWeekendRace(career: CareerState): RaceSimState {
  const { weekend, event, track } = requireWeekend(career, 'race');
  const { practice, qualifying } = weekend;
  if (!practice || !qualifying) throw new Error('Treino e classificação precisam ser disputados antes da corrida.');
  const grid = qualifying.entries.map((q) => {
    const p = practice.entries.find((e) => e.driverId === q.driverId);
    if (!p) throw new Error(`Piloto ${q.driverId} sem resultado de treino.`);
    return { driverId: q.driverId, teamId: q.teamId, modifiers: p.modifiers };
  });
  return createRaceSim(grid, track, event.weather.race, sessionSeed(career, weekend.round, 'race'), career.playerDriverId);
}

function formatDelta(delta: AttributeDelta): string {
  return Object.entries(delta)
    .filter(([, v]) => (v ?? 0) >= 0.05)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, v]) => `${ATTRIBUTE_LABELS[k as keyof typeof ATTRIBUTE_LABELS]} +${(v ?? 0).toFixed(1)}`)
    .join(', ');
}

function raceMessages(career: CareerState, record: RoundRecord, delta: AttributeDelta | undefined): InboxMessage[] {
  const player = getPlayer(career);
  const team = getTeam(career, player.teamId ?? '');
  const track = getTrack(record.trackId);
  const entry = record.race.entries.find((e) => e.driverId === player.id);
  const winner = record.race.entries[0];
  const winnerDriver = career.drivers.find((d) => d.id === winner?.driverId);
  const standings = computeDriverStandings(career.rounds, career.drivers);
  const playerStanding = standings.find((s) => s.driverId === player.id);
  const messages: InboxMessage[] = [];

  if (entry) {
    const result =
      entry.status === 'finished'
        ? `Você terminou em ${entry.position}º, largando de ${entry.grid}º, e somou ${entry.points} ponto(s).`
        : `Você abandonou na volta ${entry.lapsCompleted + 1}, depois de largar em ${entry.grid}º.`;
    messages.push({
      id: `s${record.season}-r${record.round}-race`,
      date: record.date,
      category: 'race',
      title: `Etapa ${record.round}: ${track.name}`,
      body: `${result} Vencedor: ${winnerDriver ? fullName(winnerDriver) : '-'}. No campeonato, você é o ${playerStanding?.position ?? '-'}º, com ${playerStanding?.points ?? 0} pontos.`,
    });

    // Reação da equipe: comparação com a meta da temporada.
    const target = team.driverTarget;
    let reaction: string;
    if (entry.status === 'dnf' && entry.dnfReason !== 'mechanical') {
      reaction = 'O chefe de equipe lembra que só pontua quem termina a corrida. Erros custam caro no campeonato.';
    } else if (entry.status === 'dnf') {
      reaction = 'A equipe assume a culpa pela quebra e promete revisar o motor antes da próxima etapa.';
    } else if (entry.position <= Math.max(1, target - 2)) {
      reaction = 'A equipe está empolgada: um resultado acima do que o kart costuma entregar.';
    } else if (entry.position <= target) {
      reaction = 'Um resultado sólido, dentro do que a equipe espera.';
    } else {
      reaction = `A equipe esperava mais. A meta é terminar a temporada entre os ${target} primeiros.`;
    }
    messages.push({ id: `s${record.season}-r${record.round}-team`, date: record.date, category: 'team', title: `${team.name}: avaliação da etapa`, body: reaction });
  }

  if (delta) {
    const summary = formatDelta(delta);
    messages.push({
      id: `s${record.season}-r${record.round}-training`,
      date: record.date,
      category: 'training',
      title: `Relatório de evolução (${TRAINING_FOCUS_LABELS[player.trainingFocus]})`,
      body: summary ? `Evolução após a etapa: ${summary}.` : 'Você está perto do seu potencial nos atributos treinados; os ganhos foram mínimos.',
    });
  }
  return messages;
}

/**
 * Encerra o fim de semana: grava o resultado oficial, aplica a evolução dos
 * pilotos, gera as mensagens e avança o calendário.
 */
export function completeWeekend(career: CareerState, race: RaceSimState): CareerState {
  const { weekend, event } = requireWeekend(career, 'race');
  if (!isRaceFinished(race)) throw new Error('A corrida ainda não terminou.');
  if (race.seed !== sessionSeed(career, weekend.round, 'race')) throw new Error('A corrida não pertence a esta etapa.');
  const { practice, qualifying } = weekend;
  if (!practice || !qualifying) throw new Error('Fim de semana incompleto.');

  const result: RaceResult = finalizeRace(race);
  const record: RoundRecord = {
    season: career.season,
    round: weekend.round,
    trackId: event.trackId,
    date: event.date,
    practice,
    qualifying,
    race: result,
  };

  const withResult: CareerState = { ...career, rounds: [...career.rounds, record], weekend: null, nextRoundIndex: career.nextRoundIndex + 1 };
  const { drivers, deltas } = developAfterRound(withResult.drivers, career.seed, career.season, weekend.round);
  const developed: CareerState = { ...withResult, drivers };
  const messages = raceMessages(developed, record, deltas[career.playerDriverId]);

  if (developed.nextRoundIndex >= developed.calendar.length) {
    messages.push({
      id: `s${career.season}-end`,
      date: event.date,
      category: 'season',
      title: 'Fim de temporada',
      body: 'A temporada terminou. Veja o resumo no painel, avalie as propostas das equipes e comece a próxima temporada.',
    });
  }
  return { ...developed, inbox: pushMessages(developed.inbox, messages) };
}
