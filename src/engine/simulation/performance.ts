/**
 * Modelo de desempenho: converte atributos, kart, pista e clima em tempo de
 * volta, chance de erro e desgaste de pneus. São funções puras, sem sorte; o
 * ruído é aplicado por quem chama, usando o RNG da sessão.
 */
import type { DriverAttributes, KartPerformance, SessionWeather, Track } from '@/domain/schemas';
import { SIM } from './constants';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Nota de ritmo do piloto (0 a 100) nas condições da sessão.
 *
 * No seco, a velocidade domina (64%), mas consistência, inteligência de
 * corrida, concentração e experiência também contam: ritmo de volta não é só
 * velocidade bruta. Com a pista molhada, a nota de chuva substitui até 60% do total,
 * proporcionalmente à umidade.
 */
export function driverPaceRating(a: DriverAttributes, weather: SessionWeather): number {
  const dry =
    a.pace * 0.64 + a.consistency * 0.1 + a.racecraft * 0.1 + a.focus * 0.08 + a.experience * 0.08;
  const wetShare = 0.6 * weather.wetness;
  return dry * (1 - wetShare) + a.wetSkill * wetShare;
}

/** Nota do kart na pista: média de motor e chassi, ponderada pelo traçado. */
export function kartRating(kart: KartPerformance, track: Track): number {
  return kart.engine * track.powerSensitivity + kart.chassis * (1 - track.powerSensitivity);
}

export interface LapContext {
  attributes: DriverAttributes;
  kart: KartPerformance;
  track: Track;
  weather: SessionWeather;
  /** Qualidade do acerto do fim de semana, de 0 a 1. */
  setupScore: number;
  /** Desgaste atual dos pneus, de 0 a 1. */
  tyreWear: number;
  /** Ajuste percentual do modo ou da abordagem (negativo = mais rápido). */
  paceModifier: number;
}

/** Tempo de volta esperado, sem ruído, em segundos. */
export function expectedLapTime(ctx: LapContext): number {
  const base = ctx.track.baseLapTime * (1 + SIM.WET_LAP_PENALTY * ctx.weather.wetness);
  const driverLoss = (100 - driverPaceRating(ctx.attributes, ctx.weather)) * SIM.DRIVER_RATING_TIME_FACTOR;
  const kartLoss = (100 - kartRating(ctx.kart, ctx.track)) * SIM.KART_RATING_TIME_FACTOR;
  const setupGain = clamp(ctx.setupScore, 0, 1) * SIM.SETUP_MAX_GAIN;
  const tyreLoss = SIM.TYRE_WEAR_TIME_PENALTY * clamp(ctx.tyreWear, 0, 1) ** 2;
  return base * (1 + driverLoss + kartLoss - setupGain + tyreLoss + ctx.paceModifier);
}

/**
 * Desvio-padrão do ruído da volta, como fração do tempo de volta. Depende da
 * consistência e, com o passar da corrida, do cansaço (concentração baixa).
 * A pista molhada amplia a irregularidade de todos.
 */
export function lapNoiseSigma(a: DriverAttributes, weather: SessionWeather, raceProgress: number): number {
  const base = SIM.NOISE_BASE + (100 - a.consistency) * SIM.NOISE_PER_CONSISTENCY_POINT;
  const fatigue = (100 - a.focus) * SIM.FATIGUE_PER_FOCUS_POINT * clamp(raceProgress, 0, 1);
  return (base + fatigue) * (1 + SIM.WET_NOISE_MULTIPLIER * weather.wetness);
}

/** Chance de erro na volta, antes do multiplicador do modo de pilotagem. */
export function errorProbability(a: DriverAttributes, weather: SessionWeather, raceProgress: number): number {
  const consistencyRisk = (100 - a.consistency) * SIM.ERROR_PER_CONSISTENCY_POINT;
  const focusRisk = (100 - a.focus) * SIM.ERROR_PER_FOCUS_POINT * clamp(raceProgress, 0, 1);
  const wetRisk = SIM.ERROR_WET_EXTRA * weather.wetness * (1 - a.wetSkill / 100);
  return SIM.ERROR_BASE + consistencyRisk + focusRisk + wetRisk;
}

/** Chance de quebra mecânica por volta. */
export function mechanicalFailureProbability(kart: KartPerformance): number {
  return (100 - kart.reliability) ** 2 * SIM.MECHANICAL_FAILURE_FACTOR;
}

/**
 * Desgaste de pneu por volta. Uma boa gestão (100) desgasta 30% menos que o
 * piloto médio; uma gestão ruim (0) desgasta 30% mais.
 */
export function tyreWearPerLap(
  a: DriverAttributes,
  track: Track,
  weather: SessionWeather,
  modeMultiplier: number,
  weekendFactor: number,
): number {
  const skillFactor = 1.3 - (a.tyreManagement / 100) * 0.6;
  const wetFactor = 1 - (1 - SIM.WET_TYRE_WEAR_MULTIPLIER) * weather.wetness;
  return SIM.TYRE_WEAR_PER_LAP * track.tyreWear * skillFactor * wetFactor * modeMultiplier * weekendFactor;
}

/** Nota geral do piloto (0 a 100), usada só para exibição e para decisões da IA. */
export function overallRating(a: DriverAttributes): number {
  return (
    a.pace * 0.25 +
    a.consistency * 0.12 +
    a.overtaking * 0.1 +
    a.defending * 0.08 +
    a.focus * 0.1 +
    a.racecraft * 0.12 +
    a.tyreManagement * 0.08 +
    a.wetSkill * 0.05 +
    a.experience * 0.1
  );
}
