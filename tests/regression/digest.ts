/**
 * Resumo numérico de uma carreira, para travar o comportamento da simulação.
 *
 * Joga carreiras com semente fixa e, depois de cada etapa e de cada virada de temporada, registra
 * o que importa (resultado da corrida, pontos, finanças, reputação) e um hash do estado inteiro.
 * Textos por extenso (mensagens, notícias, rótulos) ficam de fora do hash: mudar uma frase não é
 * mudar o jogo.
 *
 * O mesmo resumo serviu para conferir a reformulação visual: rodado no código de antes dela e no
 * de depois, deu os mesmos números (ver tests/golden/README.md).
 */
import { readFileSync } from 'node:fs';
import type { CareerState } from '@/domain/schemas';
import { cyrb53 } from '@/persistence/checksum';
import { importCareer } from '@/persistence/saveService';
import { driverStandings, getCategory, getPlayer, netWorth, startNextSeason, teamStandings } from '../engineApi';
import { botCareer, botTraining, pickBestOffer, playRound } from '../helpers';

export interface Checkpoint {
  label: string;
  category: string;
  season: number;
  round: number;
  cash: number;
  netWorth: number;
  reputation: number;
  position: number | null;
  points: number;
  /** Pontos de cada piloto e de cada equipe, e o resultado da última corrida. */
  standings: string;
  teams: string;
  lastRace: string;
  seasonTotals: string;
  /** Hash do estado inteiro da carreira, sem as frases. */
  hash: string;
}

/** Mantém números, booleanos e textos sem espaço (ids, opções, datas); frases viram um marcador. */
function withoutSentences(value: unknown): unknown {
  if (typeof value === 'string') return /\s/.test(value) ? '§' : value;
  if (Array.isArray(value)) return value.map(withoutSentences);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, inner]) => [key, withoutSentences(inner)]),
    );
  }
  return value;
}

export function checkpoint(label: string, career: CareerState): Checkpoint {
  const player = getPlayer(career);
  const me = driverStandings(career).find((s) => s.driverId === player.id);
  const last = career.rounds[career.rounds.length - 1];
  return {
    label,
    category: career.categoryId,
    season: career.season,
    round: career.rounds.length,
    cash: career.finance.cash,
    netWorth: Math.round(netWorth(career.finance)),
    reputation: Math.round(career.reputation * 1000) / 1000,
    position: me?.position ?? null,
    points: me?.points ?? 0,
    standings: driverStandings(career)
      .slice(0, 20)
      .map((s) => `${s.driverId}:${s.points}`)
      .join(','),
    teams: teamStandings(career)
      .map((s) => `${s.teamId}:${s.points}`)
      .join(','),
    lastRace: last ? last.race.entries.map((e) => `${e.driverId}:${e.position}:${e.points}:${e.status}`).join(',') : '',
    seasonTotals: Object.entries(career.finance.seasonTotals)
      .sort()
      .map(([key, value]) => `${key}:${Math.round(value)}`)
      .join(','),
    hash: cyrb53(JSON.stringify(withoutSentences(career))),
  };
}

/** Joga o que falta da temporada com o robô, registrando um ponto de conferência por etapa. */
function playOut(career: CareerState, tag: string, log: Checkpoint[]): CareerState {
  let c = botTraining(career);
  while (c.nextRoundIndex < c.calendar.length) {
    c = playRound(c);
    log.push(checkpoint(`${tag} · ${getCategory(c.categoryId).shortName} · temporada ${c.season} · etapa ${c.rounds.length}`, c));
  }
  return c;
}

/**
 * As carreiras de referência:
 * - A: robô talentoso, cinco temporadas a partir do kart regional (passa pelo kart nacional e
 *   pelo internacional e chega à Fórmula 4), com todas as viradas de temporada;
 * - C: save de monopostos gravado no meio de uma temporada de Fórmula 2, jogado até o fim do ano
 *   (boxes, compostos, combustível, safety car, ordens de equipe).
 */
export function referenceCheckpoints(): Checkpoint[] {
  const log: Checkpoint[] = [];
  let a = botCareer(20260311, 9);
  for (let i = 0; i < 5; i++) {
    a = playOut(a, 'A', log);
    a = startNextSeason(a, pickBestOffer(a));
    log.push(checkpoint(`A · virada para a temporada ${a.season} (${getCategory(a.categoryId).shortName})`, a));
  }
  const c = importCareer(readFileSync('tests/fixtures/v2/formula-mid-season.json', 'utf8'));
  log.push(checkpoint('C · save aberto', c));
  playOut(c, 'C', log);
  return log;
}
