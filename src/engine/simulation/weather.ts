/**
 * Geração do clima de cada etapa.
 *
 * Regra: o clima de um fim de semana nasce de uma única "frente" climática.
 * As três sessões (treino, classificação, corrida) derivam dessa frente com
 * correlação alta, então o clima muda de forma plausível ao longo do fim de
 * semana: um sábado seco pode virar um domingo úmido, mas é raro sair do sol
 * pleno para o temporal.
 *
 * Técnica: a frente é uma variável normal latente z. Cada sessão usa
 * z_s = ρ·z + √(1−ρ²)·ε, que continua sendo normal padrão. A sessão tem chuva
 * quando Φ(z_s) < chance de chuva. Isso garante que a frequência de chuva de
 * cada sessão seja exatamente a climatologia da pista, sem o viés que uma
 * soma simples com corte em 0 e 1 causaria.
 */
import type { EventWeather, SessionWeather, Track, WeatherCondition } from '@/domain/schemas';
import { createRng, gaussian, uniform, type Rng } from '../rng';

/** Correlação entre a frente climática e cada sessão. */
const SESSION_CORRELATION = 0.92;
/** Fração da chance de chuva que vira pista encharcada; o resto é pista úmida. */
const WET_SHARE_OF_RAIN = 0.55;

/** Função de distribuição da normal padrão (aproximação de Abramowitz-Stegun, erro < 1e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function sessionWeather(rng: Rng, front: number, track: Track): SessionWeather {
  const z = SESSION_CORRELATION * front + Math.sqrt(1 - SESSION_CORRELATION ** 2) * gaussian(rng);
  const value = normalCdf(z);
  let condition: WeatherCondition = 'dry';
  let wetness = 0;
  if (value < track.rainChance * WET_SHARE_OF_RAIN) {
    condition = 'wet';
    wetness = uniform(rng, 0.75, 1);
  } else if (value < track.rainChance) {
    condition = 'damp';
    wetness = uniform(rng, 0.3, 0.55);
  }
  // Chuva esfria o asfalto: até 12 °C a menos com a pista encharcada.
  const trackTemp = Math.round(track.baseTrackTemp + gaussian(rng) * 3 - wetness * 12);
  return { condition, wetness: Math.round(wetness * 100) / 100, trackTemp };
}

export function generateEventWeather(seed: number, track: Track): EventWeather {
  const rng = createRng(seed);
  const front = gaussian(rng);
  return {
    practice: sessionWeather(rng, front, track),
    qualifying: sessionWeather(rng, front, track),
    race: sessionWeather(rng, front, track),
  };
}
