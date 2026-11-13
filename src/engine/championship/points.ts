import type { RaceEntryResult } from '@/domain/schemas';
import { FASTEST_LAP_POINTS, POLE_POSITION_POINTS, RACE_POINTS } from '@/data/rules';

/**
 * Pontos de um piloto em uma etapa:
 * - posição de chegada (tabela RACE_POINTS), apenas para quem terminou;
 * - +1 pela pole position (largou em 1º), mesmo que não termine;
 * - +1 pela volta mais rápida, apenas para quem terminou.
 */
export function pointsFor(entry: Omit<RaceEntryResult, 'points'>, fastestLapDriverId: string | null): number {
  let points = 0;
  if (entry.status === 'finished') {
    points += RACE_POINTS[entry.position - 1] ?? 0;
    if (entry.driverId === fastestLapDriverId) points += FASTEST_LAP_POINTS;
  }
  if (entry.grid === 1) points += POLE_POSITION_POINTS;
  return points;
}

export function scoreRaceEntries(
  entries: readonly Omit<RaceEntryResult, 'points'>[],
  fastestLapDriverId: string | null,
): RaceEntryResult[] {
  return entries.map((entry) => ({ ...entry, points: pointsFor(entry, fastestLapDriverId) }));
}
