import type { RaceEntryResult } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';

export type PointsRules = Pick<CategoryDefinition, 'points' | 'polePoints' | 'fastestLapPoints' | 'fastestLapTop10Only'>;

/**
 * Pontos de um piloto em uma etapa, conforme as regras da categoria:
 * - posição de chegada, apenas para quem terminou;
 * - bônus da pole position (largou em 1º), mesmo que não termine;
 * - bônus da volta mais rápida, apenas para quem terminou (e, em algumas
 *   categorias, só se chegou entre os dez primeiros).
 */
export function pointsFor(entry: Omit<RaceEntryResult, 'points'>, fastestLapDriverId: string | null, rules: PointsRules): number {
  let points = 0;
  if (entry.status === 'finished') {
    points += rules.points[entry.position - 1] ?? 0;
    const eligible = !rules.fastestLapTop10Only || entry.position <= 10;
    if (entry.driverId === fastestLapDriverId && eligible) points += rules.fastestLapPoints;
  }
  if (entry.grid === 1) points += rules.polePoints;
  return points;
}

export function scoreRaceEntries(
  entries: readonly Omit<RaceEntryResult, 'points'>[],
  fastestLapDriverId: string | null,
  rules: PointsRules,
): RaceEntryResult[] {
  return entries.map((entry) => ({ ...entry, points: pointsFor(entry, fastestLapDriverId, rules) }));
}
