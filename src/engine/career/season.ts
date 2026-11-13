/**
 * Fim de temporada: avaliação da meta, reputação, propostas de contrato,
 * evolução das equipes e início da temporada seguinte.
 */
import type { CareerState, Driver, SeasonSummary, Team } from '@/domain/schemas';
import { CHAMPIONSHIP_NAME } from '@/data/rules';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { computeDriverStandings, computeTeamStandings } from '../championship/standings';
import { hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { buildCalendar } from './createCareer';
import { developDriver } from './development';
import { pushMessages } from './inbox';
import { fullName, getPlayer, getTeam, isSeasonComplete } from './selectors';

/** A pré-temporada equivale a 2 ciclos de treino. */
const OFFSEASON_TRAINING_CYCLES = 2;

export interface SeasonOutcome {
  playerPosition: number;
  playerPoints: number;
  wins: number;
  podiums: number;
  target: number;
  objectiveMet: boolean;
  reputationBefore: number;
  reputationAfter: number;
  championDriverId: string;
  championTeamId: string;
}

/**
 * Variação de reputação: 3 pontos por posição acima ou abaixo da meta, mais
 * 2 por vitória e 1 por pódio. Limitada entre 0 e 100.
 */
export function computeSeasonOutcome(career: CareerState): SeasonOutcome {
  const player = getPlayer(career);
  const team = getTeam(career, player.teamId ?? '');
  const drivers = computeDriverStandings(career.rounds, career.drivers);
  const teams = computeTeamStandings(career.rounds, career.teams);
  const me = drivers.find((s) => s.driverId === player.id);
  if (!me) throw new Error('Jogador fora da classificação.');
  const delta = 3 * (team.driverTarget - me.position) + 2 * me.wins + me.podiums;
  return {
    playerPosition: me.position,
    playerPoints: me.points,
    wins: me.wins,
    podiums: me.podiums,
    target: team.driverTarget,
    objectiveMet: me.position <= team.driverTarget,
    reputationBefore: career.reputation,
    reputationAfter: Math.max(0, Math.min(100, Math.round(career.reputation + delta))),
    championDriverId: drivers[0]?.driverId ?? '',
    championTeamId: teams[0]?.teamId ?? '',
  };
}

export interface ContractOffer {
  teamId: string;
  isCurrentTeam: boolean;
  reason: string;
}

const teamStrength = (t: Team) => (t.kart.engine + t.kart.chassis) / 2;

/**
 * Propostas para a próxima temporada. Uma equipe faz proposta se a posição
 * final do jogador for no máximo a meta dela + 2, mais 1 posição de tolerância
 * a cada 25 pontos de reputação. A equipe atual renova se o jogador não ficou
 * mais de 6 posições abaixo da meta. As equipes de entrada sempre oferecem
 * vaga, para que o jogador nunca fique sem kart.
 */
export function getContractOffers(career: CareerState): ContractOffer[] {
  if (!isSeasonComplete(career)) return [];
  const outcome = computeSeasonOutcome(career);
  const player = getPlayer(career);
  const tolerance = 2 + Math.floor(outcome.reputationAfter / 25);
  const weakestStrength = Math.min(...career.teams.map(teamStrength));
  const offers: ContractOffer[] = [];

  for (const team of [...career.teams].sort((a, b) => teamStrength(b) - teamStrength(a))) {
    const isCurrent = team.id === player.teamId;
    if (isCurrent) {
      if (outcome.playerPosition <= team.driverTarget + 6) {
        offers.push({ teamId: team.id, isCurrentTeam: true, reason: 'A equipe quer renovar o contrato.' });
      }
      continue;
    }
    if (outcome.playerPosition <= team.driverTarget + tolerance) {
      offers.push({ teamId: team.id, isCurrentTeam: false, reason: `Seus resultados (${outcome.playerPosition}º) chamaram a atenção da equipe.` });
    } else if (teamStrength(team) <= weakestStrength + 3) {
      offers.push({ teamId: team.id, isCurrentTeam: false, reason: 'A equipe procura pilotos jovens para desenvolver.' });
    }
  }
  return offers;
}

/**
 * Evolução das equipes: quem termina acima da posição esperada atrai
 * patrocínio e melhora o kart; quem termina abaixo perde verba. São até 2
 * pontos por temporada em motor e chassi. A meta de cada equipe é então
 * recalculada pela nova ordem de forças.
 */
export function evolveTeams(teams: readonly Team[], career: CareerState): Team[] {
  const standings = computeTeamStandings(career.rounds, teams);
  const expectedOrder = [...teams].sort((a, b) => teamStrength(b) - teamStrength(a)).map((t) => t.id);
  const clampKart = (v: number) => Math.max(40, Math.min(95, v));
  const evolved = teams.map((team) => {
    const expected = expectedOrder.indexOf(team.id) + 1;
    const actual = standings.find((s) => s.teamId === team.id)?.position ?? expected;
    const delta = Math.max(-2, Math.min(2, Math.round((expected - actual) / 2)));
    return {
      ...team,
      kart: {
        engine: clampKart(team.kart.engine + delta),
        chassis: clampKart(team.kart.chassis + delta),
        reliability: clampKart(team.kart.reliability + Math.sign(delta)),
      },
    };
  });
  const TARGETS = [3, 3, 6, 6, 10, 10, 13, 13, 16, 16];
  const newOrder = [...evolved].sort((a, b) => teamStrength(b) - teamStrength(a)).map((t) => t.id);
  return evolved.map((t) => ({ ...t, driverTarget: TARGETS[newOrder.indexOf(t.id)] ?? 16 }));
}

export function archiveSeason(career: CareerState): SeasonSummary {
  const outcome = computeSeasonOutcome(career);
  const player = getPlayer(career);
  const standings = computeDriverStandings(career.rounds, career.drivers);
  return {
    season: career.season,
    year: career.year,
    championDriverId: outcome.championDriverId,
    championTeamId: outcome.championTeamId,
    playerTeamId: player.teamId ?? '',
    playerPosition: outcome.playerPosition,
    playerPoints: outcome.playerPoints,
    objectiveTarget: outcome.target,
    objectiveMet: outcome.objectiveMet,
    driverStandings: standings.map((s) => ({ driverId: s.driverId, teamId: s.teamId, position: s.position, points: s.points, wins: s.wins })),
    driverNames: Object.fromEntries(career.drivers.map((d) => [d.id, fullName(d)])),
    rounds: career.rounds,
  };
}

export function startNextSeason(career: CareerState, chosenTeamId: string): CareerState {
  if (!isSeasonComplete(career)) throw new Error('A temporada ainda não terminou.');
  const offers = getContractOffers(career);
  if (!offers.some((o) => o.teamId === chosenTeamId)) throw new Error('Não há proposta desta equipe.');

  const outcome = computeSeasonOutcome(career);
  const summary = archiveSeason(career);
  const player = getPlayer(career);
  const oldTeamId = player.teamId;
  let drivers: Driver[] = career.drivers.map((d) => ({ ...d }));

  // Transferência: o piloto mais fraco da nova equipe ocupa a vaga deixada pelo jogador.
  if (chosenTeamId !== oldTeamId) {
    const teammates = drivers
      .filter((d) => d.teamId === chosenTeamId && !d.isPlayer)
      .sort((a, b) => overallRating(a.attributes) - overallRating(b.attributes));
    const swapped = teammates[0];
    drivers = drivers.map((d) => {
      if (d.isPlayer) return { ...d, teamId: chosenTeamId };
      if (swapped && d.id === swapped.id) return { ...d, teamId: oldTeamId };
      return d;
    });
  }

  const nextSeason = career.season + 1;
  const nextYear = career.year + 1;
  drivers = drivers.map((d) => {
    const aged: Driver = { ...d, age: d.age + 1, trainingFocus: d.isPlayer ? d.trainingFocus : chooseAiTrainingFocus(d.attributes) };
    if (!aged.teamId && !aged.isPlayer) return aged;
    return developDriver(aged, hashSeed(career.seed, career.season, 'offseason', d.id), OFFSEASON_TRAINING_CYCLES).driver;
  });

  const teams = evolveTeams(career.teams, career);
  const newPlayer = drivers.find((d) => d.isPlayer);
  if (!newPlayer) throw new Error('Jogador desapareceu na transição de temporada.');
  const newTeam = teams.find((t) => t.id === chosenTeamId);
  if (!newTeam) throw new Error('Equipe escolhida não existe.');
  const calendar = buildCalendar(career.seed, nextSeason, nextYear);
  const champion = career.drivers.find((d) => d.id === outcome.championDriverId);

  const next: CareerState = {
    ...career,
    season: nextSeason,
    year: nextYear,
    reputation: outcome.reputationAfter,
    drivers,
    teams,
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    playerSeasonStartAttributes: { ...newPlayer.attributes },
    history: [...career.history, summary],
  };
  const date = calendar[0]?.date ?? `${nextYear}-01-01`;
  return {
    ...next,
    inbox: pushMessages(career.inbox, [
      {
        id: `s${nextSeason}-start`,
        date,
        category: 'season',
        title: `Temporada ${nextYear}`,
        body: `${champion ? fullName(champion) : 'O campeão'} conquistou o título de ${career.year}. Você terminou em ${outcome.playerPosition}º (meta: ${outcome.target}º). Sua reputação foi de ${outcome.reputationBefore} para ${outcome.reputationAfter}. Nesta temporada do ${CHAMPIONSHIP_NAME} você corre pela ${newTeam.name}, com meta de terminar entre os ${newTeam.driverTarget} primeiros.`,
      },
    ]),
  };
}
