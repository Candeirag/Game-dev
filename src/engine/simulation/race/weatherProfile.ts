/**
 * Evolução do clima durante a corrida.
 *
 * Nas categorias em que o clima pode mudar, a umidade da pista de cada volta é
 * definida antes da largada, a partir da semente da corrida. Há no máximo uma
 * virada por corrida:
 * - Largada seca: a chuva chega com probabilidade de 45% da chance de chuva da
 *   pista, entre 15% e 80% da prova, e a pista molha de 12% a 20% por volta.
 * - Largada molhada: em 55% dos casos a chuva para e a pista seca de 4% a 9%
 *   por volta, a partir de algum ponto da primeira metade da prova.
 * A previsão mostrada ao jogador indica a volta aproximada, com erro de até
 * três voltas: é informação útil, mas não é certeza.
 */
import type { SessionWeather, Track } from '@/domain/schemas';
import { createRng, hashSeed } from '../../rng';
import type { WeatherForecast } from './types';

const RAIN_ARRIVAL_SHARE = 0.45;
const DRYING_CHANCE = 0.55;

export function buildWetnessProfile(
  seed: number,
  track: Track,
  start: SessionWeather,
  totalLaps: number,
  changing: boolean,
): { wetnessByLap: number[]; forecast: WeatherForecast } {
  const profile = Array.from({ length: totalLaps + 1 }, () => start.wetness);
  if (!changing) return { wetnessByLap: profile, forecast: { kind: 'stable', aroundLap: null } };

  const rng = createRng(hashSeed(seed, 'weather-profile'));
  const eventRoll = rng.next();
  const lapRoll = rng.next();
  const targetRoll = rng.next();
  const rateRoll = rng.next();
  const fuzz = Math.round((rng.next() - 0.5) * 6);

  if (start.wetness < 0.1) {
    if (eventRoll >= track.rainChance * RAIN_ARRIVAL_SHARE) return { wetnessByLap: profile, forecast: { kind: 'stable', aroundLap: null } };
    const onset = Math.max(2, Math.floor(totalLaps * (0.15 + 0.65 * lapRoll)));
    const target = 0.35 + 0.6 * targetRoll;
    const rate = 0.12 + 0.08 * rateRoll;
    for (let lap = onset; lap <= totalLaps; lap++) profile[lap] = Math.min(target, start.wetness + rate * (lap - onset + 1));
    return { wetnessByLap: round(profile), forecast: { kind: 'rain', aroundLap: clampLap(onset + fuzz, totalLaps) } };
  }

  if (eventRoll >= DRYING_CHANCE) return { wetnessByLap: profile, forecast: { kind: 'stable', aroundLap: null } };
  const onset = Math.max(1, Math.floor(totalLaps * (0.1 + 0.4 * lapRoll)));
  const rate = 0.04 + 0.05 * rateRoll;
  for (let lap = onset; lap <= totalLaps; lap++) profile[lap] = Math.max(0, start.wetness - rate * (lap - onset + 1));
  return { wetnessByLap: round(profile), forecast: { kind: 'drying', aroundLap: clampLap(onset + fuzz, totalLaps) } };
}

const round = (values: number[]) => values.map((v) => Math.round(v * 1000) / 1000);
const clampLap = (lap: number, totalLaps: number) => Math.max(1, Math.min(totalLaps, lap));

export function conditionFor(wetness: number): SessionWeather['condition'] {
  return wetness >= 0.6 ? 'wet' : wetness >= 0.15 ? 'damp' : 'dry';
}
