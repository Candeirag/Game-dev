/**
 * Retrato de cada temporada fechada, para os gráficos pequenos da interface (evolução dos
 * atributos e do caixa). É só registro: nenhuma regra do jogo lê `seasonTrend`, e nada aqui
 * sorteia ou decide.
 */
import { HISTORY_LIMITS } from '@/config/balance';
import type { CareerState, SeasonTrendPoint } from '@/domain/schemas';
import { overallRating } from '../simulation/performance';
import { netWorth } from './economy';
import { getPlayer } from './selectors';

/** O retrato da temporada que está terminando, tirado antes de o ano virar. */
export function seasonTrendPoint(career: CareerState): SeasonTrendPoint {
  const player = getPlayer(career);
  const driving = career.mode === 'driver';
  return {
    season: career.season,
    year: career.year,
    driverId: player.id,
    attributes: driving ? { ...player.attributes } : null,
    overall: driving ? overallRating(player.attributes) : null,
    cash: Math.round(career.finance.cash),
    netWorth: Math.round(netWorth(career.finance)),
  };
}

/** A lista com o retrato da temporada atual no fim; guarda só as mais recentes. */
export function recordSeasonTrend(career: CareerState): SeasonTrendPoint[] {
  const kept = career.seasonTrend.filter((point) => point.season !== career.season);
  return [...kept, seasonTrendPoint(career)].slice(-HISTORY_LIMITS.SEASON_TREND);
}
