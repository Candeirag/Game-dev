import type { RaceEntryResult, RaceResult } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { scoreRaceEntries } from '../../championship/points';
import { RACE, TYRES } from '../constants';
import { conditionFor } from './weatherProfile';
import { isRaceFinished } from './step';
import type { RaceSimState } from './types';

/**
 * Converte uma corrida encerrada no resultado oficial.
 *
 * As punições em tempo são somadas ao tempo final e a classificação é
 * refeita. Nas categorias com a regra dos dois compostos, quem não a cumpriu
 * em corrida seca recebe 30 s. Depois vêm os abandonos, em ordem de voltas
 * completadas.
 */
export function finalizeRace(state: RaceSimState, category: CategoryDefinition): RaceResult {
  if (!isRaceFinished(state)) throw new Error('A corrida ainda não terminou.');
  const dryRace = state.wetnessByLap.slice(1, state.currentLap + 1).every((w) => conditionFor(w) === 'dry');

  const finishers = state.cars
    .filter((c) => c.status === 'running')
    .map((car) => {
      const usedRain = car.compoundsUsed.some((c) => TYRES[c].rain);
      const brokeCompoundRule = category.race.mandatoryTwoCompounds && dryRace && !usedRain && new Set(car.compoundsUsed).size < 2;
      const penaltySeconds = car.penaltySeconds + (brokeCompoundRule ? RACE.COMPOUND_RULE_PENALTY : 0);
      return { car, penaltySeconds, finalTime: car.totalTime + penaltySeconds };
    })
    .sort((a, b) => a.finalTime - b.finalTime);
  const retired = state.cars.filter((c) => c.status === 'dnf');

  const unscored: Omit<RaceEntryResult, 'points'>[] = [
    ...finishers.map(({ car, penaltySeconds, finalTime }) => ({ car, penaltySeconds, totalTime: Math.round(finalTime * 1000) / 1000, status: 'finished' as const })),
    ...retired.map((car) => ({ car, penaltySeconds: car.penaltySeconds, totalTime: car.totalTime, status: 'dnf' as const })),
  ].map(({ car, penaltySeconds, totalTime, status }, index) => ({
    driverId: car.driverId,
    teamId: car.teamId,
    position: index + 1,
    grid: car.grid,
    status,
    ...(car.dnfReason ? { dnfReason: car.dnfReason } : {}),
    lapsCompleted: car.lapsCompleted,
    totalTime,
    bestLap: car.bestLap,
    overtakes: car.overtakes,
    errors: car.errors,
    pitStops: car.pitStops,
    penaltySeconds,
    penaltyPoints: car.penaltyPoints,
    damage: Math.round(car.damageTotal * 100) / 100,
    injured: car.injured,
  }));

  return {
    weather: state.weather,
    totalLaps: state.currentLap,
    entries: scoreRaceEntries(unscored, state.fastestLap?.driverId ?? null, category),
    fastestLap: state.fastestLap,
    events: state.events,
    safetyCars: state.safetyCars,
    virtualSafetyCars: state.virtualSafetyCars,
    redFlags: state.redFlags,
    teamOrders: state.teamOrders,
  };
}

/** Posições a perder no próximo grid, por piloto, em consequência desta corrida. */
export function gridDropsFromRace(state: RaceSimState): Record<string, number> {
  const drops: Record<string, number> = {};
  for (const car of state.cars) if (car.gridDropNext > 0) drops[car.driverId] = car.gridDropNext;
  return drops;
}
