/**
 * Modelo de desempenho: converte atributos, kart, pista e clima em tempo de
 * volta, chance de erro e desgaste de pneus. São funções puras, sem sorte; o
 * ruído é aplicado por quem chama, usando o RNG da sessão.
 */
import { TYRE_CURVE } from '@/config/balance';
import type { CarPerformance, Condition, DriverAttributes, Injury, SessionWeather, Track, TyreCompound } from '@/domain/schemas';
import { CONDITION, RACE, SIM, TYRES } from './constants';

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
  const dry = a.pace * 0.64 + a.consistency * 0.1 + a.racecraft * 0.1 + a.focus * 0.08 + a.experience * 0.08;
  const wetShare = 0.6 * weather.wetness;
  return dry * (1 - wetShare) + a.wetSkill * wetShare;
}

/** Nota do equipamento na pista: média de motor e chassi, ponderada pelo traçado. */
export function carRating(car: CarPerformance, track: Track): number {
  return car.engine * track.powerSensitivity + car.chassis * (1 - track.powerSensitivity);
}

export interface LapContext {
  attributes: DriverAttributes;
  car: CarPerformance;
  track: Track;
  weather: SessionWeather;
  /** Fator da categoria sobre o tempo de referência da pista (padrão 1). */
  lapTimeFactor?: number;
  /** Peso do equipamento na categoria (padrão 1). */
  carFactor?: number;
  /** Qualidade do acerto do fim de semana, de 0 a 1. */
  setupScore: number;
  /** Desgaste atual dos pneus, de 0 a 1. */
  tyreWear: number;
  /** Composto em uso (define a curva de desgaste). Sem ele, vale a curva do médio. */
  compound?: TyreCompound;
  /** Ajuste percentual do modo ou da abordagem (negativo = mais rápido). */
  paceModifier: number;
}

/** Tempo de volta esperado, sem ruído, em segundos. */
export function expectedLapTime(ctx: LapContext): number {
  const base = ctx.track.baseLapTime * (ctx.lapTimeFactor ?? 1) * (1 + SIM.WET_LAP_PENALTY * ctx.weather.wetness);
  const driverLoss = (100 - driverPaceRating(ctx.attributes, ctx.weather)) * SIM.DRIVER_RATING_TIME_FACTOR;
  const kartLoss = (100 - carRating(ctx.car, ctx.track)) * SIM.KART_RATING_TIME_FACTOR * (ctx.carFactor ?? 1);
  const setupGain = clamp(ctx.setupScore, 0, 1) * SIM.SETUP_MAX_GAIN;
  const tyreLoss = tyrePaceLoss(ctx.compound ?? 'medium', ctx.tyreWear);
  return base * (1 + driverLoss + kartLoss - setupGain + tyreLoss + ctx.paceModifier);
}

/**
 * Desvio-padrão do ruído da volta, como fração do tempo de volta. Depende da
 * consistência e, com o passar da corrida, do cansaço (concentração baixa).
 * A pista molhada amplia a irregularidade de todos. `fatigueFactor` multiplica o
 * cansaço (o físico de nascença nas provas longas; 1 para os demais).
 */
export function lapNoiseSigma(a: DriverAttributes, weather: SessionWeather, raceProgress: number, fatigueFactor = 1): number {
  const base = SIM.NOISE_BASE + (100 - a.consistency) * SIM.NOISE_PER_CONSISTENCY_POINT;
  const fatigue = (100 - a.focus) * SIM.FATIGUE_PER_FOCUS_POINT * clamp(raceProgress, 0, 1) * fatigueFactor;
  return (base + fatigue) * (1 + SIM.WET_NOISE_MULTIPLIER * weather.wetness);
}

/** Chance de erro na volta, antes do multiplicador do modo de pilotagem. `fatigueFactor` como em lapNoiseSigma. */
export function errorProbability(a: DriverAttributes, weather: SessionWeather, raceProgress: number, fatigueFactor = 1): number {
  const consistencyRisk = (100 - a.consistency) * SIM.ERROR_PER_CONSISTENCY_POINT;
  const focusRisk = (100 - a.focus) * SIM.ERROR_PER_FOCUS_POINT * clamp(raceProgress, 0, 1) * fatigueFactor;
  const wetRisk = SIM.ERROR_WET_EXTRA * weather.wetness * (1 - a.wetSkill / 100);
  return SIM.ERROR_BASE + consistencyRisk + focusRisk + wetRisk;
}

/** Chance de quebra mecânica por volta. */
export function mechanicalFailureProbability(car: CarPerformance): number {
  return (100 - car.reliability) ** 2 * SIM.MECHANICAL_FAILURE_FACTOR;
}

/**
 * Quanto o piloto gasta de pneu: uma boa gestão (100) desgasta 30% menos que o
 * piloto médio; uma gestão ruim (0) desgasta 30% mais.
 */
export function tyreManagementFactor(a: DriverAttributes): number {
  return TYRE_CURVE.MANAGEMENT_WORST - (a.tyreManagement / 100) * TYRE_CURVE.MANAGEMENT_RANGE;
}

/** Desgaste de pneu por volta (o acumulado vai de 0, novo, a 1, na lona). */
export function tyreWearPerLap(a: DriverAttributes, track: Track, weather: SessionWeather, modeMultiplier: number, weekendFactor: number): number {
  const wetFactor = 1 - (1 - SIM.WET_TYRE_WEAR_MULTIPLIER) * weather.wetness;
  return SIM.TYRE_WEAR_PER_LAP * track.tyreWear * tyreManagementFactor(a) * wetFactor * modeMultiplier * weekendFactor;
}

/** Desgaste a partir do qual o composto "cai do penhasco". */
export function tyreCliff(compound: TyreCompound): number {
  return TYRE_CURVE.COMPOUNDS[compound].cliff;
}

/**
 * Perda de ritmo do pneu, em fração do tempo de volta, no ponto da vida em que ele está. A curva
 * tem três trechos: o pneu novo perde o pico de aderência logo nas primeiras voltas (pouco), fica
 * quase estável por quase toda a vida e, passado o penhasco do composto, perde segundos por volta.
 */
export function tyrePaceLoss(compound: TyreCompound, wear: number): number {
  const curve = TYRE_CURVE.COMPOUNDS[compound];
  const w = clamp(wear, 0, 1);
  const fade = curve.fade * Math.min(1, w / TYRE_CURVE.FADE_BY);
  const plateau = curve.plateau * clamp((w - TYRE_CURVE.FADE_BY) / (curve.cliff - TYRE_CURVE.FADE_BY), 0, 1);
  const drop = curve.drop * (Math.max(0, w - curve.cliff) / (1 - curve.cliff));
  return fade + plateau + drop;
}

/** Estado do pneu para a tela e para o rádio: sempre texto junto da cor. */
export type TyreState = 'new' | 'good' | 'worn' | 'limit' | 'gone';

export function tyreState(compound: TyreCompound, wear: number): TyreState {
  const cliff = tyreCliff(compound);
  if (wear >= cliff) return 'gone';
  if (wear >= cliff - TYRE_CURVE.LIMIT_MARGIN) return 'limit';
  if (wear < TYRE_CURVE.FADE_BY) return 'new';
  return wear < cliff * TYRE_CURVE.GOOD_UNTIL ? 'good' : 'worn';
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

/* ------------------------------------------------------------------ */
/* Fase 2: condição do piloto, compostos, combustível e dano           */
/* ------------------------------------------------------------------ */

export interface ConditionEffects {
  /** Ajuste percentual no tempo de volta (negativo = mais rápido). */
  pace: number;
  /** Multiplicador do ruído de volta. */
  noise: number;
  /** Multiplicador da chance de erro. */
  error: number;
  /** Ajuste no logit das disputas de posição. */
  attack: number;
}

/**
 * Converte fase, confiança, moral e lesão em efeitos na pista. Com tudo em 50
 * e sem lesão, os efeitos são neutros: o piloto rende exatamente o que os
 * atributos dizem.
 */
export function conditionEffects(condition: Condition, injury: Injury | null): ConditionEffects {
  const racingInjured = injury !== null;
  return {
    pace: ((50 - condition.form) / 50) * CONDITION.FORM_PACE + (racingInjured ? CONDITION.INJURY_PACE : 0),
    noise: 1 + ((50 - condition.morale) / 50) * CONDITION.MORALE_NOISE,
    error: (1 + ((50 - condition.confidence) / 50) * CONDITION.CONFIDENCE_ERROR) * (racingInjured ? CONDITION.INJURY_ERROR : 1),
    attack: ((condition.confidence - 50) / 50) * CONDITION.CONFIDENCE_ATTACK,
  };
}

/**
 * Perda de tempo (fração da volta) e risco extra por usar o pneu errado para a
 * umidade da pista. É somada à perda-base da pista molhada, que vale para todos.
 *
 * - Pneus de pista seca: perdem aderência rapidamente a partir de 8% de umidade
 *   (6% de perda com 30%, 18% com 60%) e multiplicam o risco de erro.
 * - Intermediário: ideal entre 15% e 65%; superaquece no seco e não escoa água
 *   suficiente na chuva forte.
 * - Chuva: ideal acima de 50%; no seco, é lento e se desmancha.
 * - Kart: o pneu é escolhido antes da largada e não há troca; o efeito da
 *   pista molhada já está na perda-base.
 */
export function tyreConditionEffect(compound: TyreCompound, wetness: number): { pace: number; error: number; wear: number } {
  if (compound === 'kart') return { pace: 0, error: 1, wear: 1 };
  if (!TYRES[compound].rain) {
    const excess = Math.max(0, wetness - 0.08);
    return { pace: excess * 0.22 + excess ** 2 * 0.25, error: 1 + 5 * excess, wear: 1 };
  }
  if (compound === 'intermediate') {
    if (wetness < 0.15) return { pace: 0.025, error: 1, wear: 3 };
    if (wetness > 0.65) return { pace: (wetness - 0.65) * 0.2, error: 1 + (wetness - 0.65) * 2, wear: 1 };
    return { pace: 0, error: 1, wear: 1 };
  }
  const dryness = Math.max(0, 0.5 - wetness);
  return { pace: dryness * 0.09, error: 1, wear: 1 + dryness * 3 };
}

/** Perda pelo peso do combustível: proporcional ao que resta no tanque. */
export function fuelPenalty(fuelLaps: number, totalLaps: number): number {
  return (RACE.FUEL_FULL_TANK_PENALTY * Math.max(0, fuelLaps)) / totalLaps;
}

export function damagePenalty(damage: number): number {
  return Math.min(1, damage) * RACE.DAMAGE_TIME_PENALTY;
}
