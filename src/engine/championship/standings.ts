/**
 * Classificação do campeonato.
 *
 * A classificação nunca é armazenada: ela é sempre recalculada a partir dos
 * resultados das etapas. Com uma única fonte de verdade, pontos e posições não
 * têm como ficar inconsistentes com os resultados salvos. Decisões de
 * comissários (ajustes de pontos) são lançamentos separados, somados aqui.
 */
import type { Driver, PointsAdjustment, RaceEntryResult, RoundRecord, Team } from '@/domain/schemas';
import { compareText } from '@/domain/text';

export interface DriverStanding {
  position: number;
  driverId: string;
  teamId: string | null;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  dnfs: number;
  bestFinish: number | null;
  /** Resultado em cada etapa disputada, na ordem do calendário. */
  results: (RaceEntryResult | null)[];
}

export interface TeamStanding {
  position: number;
  teamId: string;
  points: number;
  wins: number;
  podiums: number;
}

/** Desempate por "countback": mais vitórias; depois mais 2º lugares; e assim por diante. */
function countbackCompare(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function finishCounts(results: readonly (RaceEntryResult | null)[]): number[] {
  const counts: number[] = [];
  for (const r of results) {
    if (r && r.status === 'finished') counts[r.position - 1] = (counts[r.position - 1] ?? 0) + 1;
  }
  return counts;
}

export function computeDriverStandings(
  rounds: readonly RoundRecord[],
  drivers: readonly Driver[],
  adjustments: readonly PointsAdjustment[] = [],
): DriverStanding[] {
  const ids = new Set<string>();
  // Reservas só entram na classificação se tiverem corrido.
  for (const d of drivers) if (d.teamId && d.role !== 'reserve') ids.add(d.id);
  for (const r of rounds) for (const e of r.race.entries) ids.add(e.driverId);

  const rows = [...ids].map((driverId) => {
    const results = rounds.map((r) => r.race.entries.find((e) => e.driverId === driverId) ?? null);
    const raced = results.filter((r): r is RaceEntryResult => r !== null);
    const finished = raced.filter((r) => r.status === 'finished');
    const lastTeam = [...raced].reverse()[0]?.teamId ?? null;
    return {
      position: 0,
      driverId,
      teamId: drivers.find((d) => d.id === driverId)?.teamId ?? lastTeam,
      points: raced.reduce((sum, r) => sum + r.points, 0) + adjustments.filter((x) => x.driverId === driverId).reduce((sum, x) => sum + x.points, 0),
      wins: finished.filter((r) => r.position === 1).length,
      podiums: finished.filter((r) => r.position <= 3).length,
      poles: raced.filter((r) => r.grid === 1).length,
      dnfs: raced.filter((r) => r.status === 'dnf').length,
      bestFinish: finished.length ? Math.min(...finished.map((r) => r.position)) : null,
      results,
      counts: finishCounts(results),
    };
  });

  rows.sort((a, b) => b.points - a.points || countbackCompare(a.counts, b.counts) || compareText(a.driverId, b.driverId));
  return rows.map(({ counts: _counts, ...row }, index) => ({ ...row, position: index + 1 }));
}

export function computeTeamStandings(rounds: readonly RoundRecord[], teams: readonly Team[], adjustments: readonly PointsAdjustment[] = []): TeamStanding[] {
  const rows = teams.map((team) => {
    const entries = rounds.flatMap((r) => r.race.entries.filter((e) => e.teamId === team.id));
    return {
      position: 0,
      teamId: team.id,
      points: entries.reduce((sum, e) => sum + e.points, 0) + adjustments.filter((x) => x.teamId === team.id).reduce((sum, x) => sum + x.points, 0),
      wins: entries.filter((e) => e.status === 'finished' && e.position === 1).length,
      podiums: entries.filter((e) => e.status === 'finished' && e.position <= 3).length,
      counts: finishCounts(entries),
    };
  });
  rows.sort((a, b) => b.points - a.points || countbackCompare(a.counts, b.counts) || compareText(a.teamId, b.teamId));
  return rows.map(({ counts: _counts, ...row }, index) => ({ ...row, position: index + 1 }));
}
