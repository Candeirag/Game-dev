/**
 * Ritmo em pista livre: o tempo de volta que um carro faria agora, sem ruído, sem tráfego e sem
 * incidentes. É a mesma conta que a simulação da volta usa antes de sortear o ruído; os lances
 * decisivos e o rádio do engenheiro a usam para comparar dois carros.
 */
import type { RaceMode, SessionWeather } from '@/domain/schemas';
import type { RaceRules } from '@/data/categories';
import { RACE_MODE_EFFECTS, TYRES } from '../constants';
import { conditionEffects, damagePenalty, expectedLapTime, fuelPenalty, tyreConditionEffect, type ConditionEffects } from '../performance';
import { neutralRaceProfile, type DriverRaceProfile, type MomentCarry, type RaceCar, type RaceContext } from './types';
import { conditionFor } from './weatherProfile';

/**
 * Efeito de estar com o pneu errado para a pista, com o que um lance pode aliviar: `grip` menor que
 * 1 encolhe a perda de ritmo e o risco extra (quem "acha aderência" na chuva com pneu de seco).
 */
export function tyreGripEffect(car: Pick<RaceCar, 'tyre'>, wetness: number, grip = 1): { pace: number; error: number; wear: number } {
  const effect = tyreConditionEffect(car.tyre.compound, wetness);
  return { pace: effect.pace * grip, error: 1 + (effect.error - 1) * grip, wear: effect.wear };
}

/** O efeito de lance em vigor nesta volta para o carro do jogador, ou null. */
export function activeCarry(carry: MomentCarry | null, lap: number): MomentCarry | null {
  return carry && lap >= carry.fromLap && lap <= carry.untilLap ? carry : null;
}

export interface PaceInput {
  car: RaceCar;
  mode: RaceMode;
  cond: ConditionEffects;
  profile: DriverRaceProfile;
  wetness: number;
  rules: RaceRules;
  totalLaps: number;
  /** Efeito de lance em vigor (só o carro do jogador). */
  carry?: MomentCarry | null;
}

/** Soma dos ajustes percentuais do tempo de volta (negativo = mais rápido), sem o desgaste do pneu. */
export function paceModifier({ car, mode, cond, profile, wetness, rules, totalLaps, carry }: PaceInput): number {
  return (
    RACE_MODE_EFFECTS[mode].pace +
    TYRES[car.tyre.compound].pace +
    cond.pace +
    tyreGripEffect(car, wetness, carry?.grip ?? 1).pace +
    (rules.fuel ? fuelPenalty(car.fuel, totalLaps) : 0) +
    damagePenalty(car.damage) +
    profile.pace +
    profile.wetPace * wetness +
    (carry?.pace ?? 0)
  );
}

/** Tempo de volta em pista livre do carro, no estado em que ele está, com a umidade dada. */
export function cleanAirLapTime(car: RaceCar, ctx: RaceContext, wetness: number, totalLaps: number, trackTemp: number, mode: RaceMode = 'balanced'): number {
  const driver = ctx.drivers[car.driverId];
  const team = ctx.teams[car.teamId];
  if (!driver || !team) return Number.POSITIVE_INFINITY;
  const weather: SessionWeather = { condition: conditionFor(wetness), wetness, trackTemp };
  return expectedLapTime({
    attributes: driver.attributes,
    car: team.car,
    track: ctx.track,
    weather,
    setupScore: car.modifiers.setupScore,
    tyreWear: car.tyre.wear,
    compound: car.tyre.compound,
    paceModifier: paceModifier({
      car,
      mode,
      cond: conditionEffects(driver.condition, driver.injury),
      profile: ctx.profiles?.[car.driverId] ?? neutralRaceProfile(),
      wetness,
      rules: ctx.category.race,
      totalLaps,
    }),
    lapTimeFactor: ctx.category.lapTimeFactor,
    carFactor: ctx.category.carFactor,
  });
}
