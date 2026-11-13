import type { CareerState, RaceEntryResult, RoundRecord } from '@/domain/schemas';

export interface CareerStats {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  dnfs: number;
  bestFinish: number | null;
  titles: number;
  overtakes: number;
}

export interface DriverRoundResult {
  season: number;
  year: number;
  record: RoundRecord;
  entry: RaceEntryResult;
}

/** Todas as etapas disputadas por um piloto, das temporadas antigas até a atual. */
export function driverRoundResults(career: CareerState, driverId: string): DriverRoundResult[] {
  const seasons = [
    ...career.history.map((h) => ({ season: h.season, year: h.year, rounds: h.rounds })),
    { season: career.season, year: career.year, rounds: career.rounds },
  ];
  const out: DriverRoundResult[] = [];
  for (const s of seasons) {
    for (const record of s.rounds) {
      const entry = record.race.entries.find((e) => e.driverId === driverId);
      if (entry) out.push({ season: s.season, year: s.year, record, entry });
    }
  }
  return out;
}

export function computeCareerStats(career: CareerState, driverId: string): CareerStats {
  const results = driverRoundResults(career, driverId);
  const finished = results.filter((r) => r.entry.status === 'finished');
  return {
    starts: results.length,
    wins: finished.filter((r) => r.entry.position === 1).length,
    podiums: finished.filter((r) => r.entry.position <= 3).length,
    poles: results.filter((r) => r.entry.grid === 1).length,
    fastestLaps: results.filter((r) => r.record.race.fastestLap?.driverId === driverId).length,
    points: results.reduce((sum, r) => sum + r.entry.points, 0),
    dnfs: results.filter((r) => r.entry.status === 'dnf').length,
    bestFinish: finished.length ? Math.min(...finished.map((r) => r.entry.position)) : null,
    titles: career.history.filter((h) => h.championDriverId === driverId).length,
    overtakes: results.reduce((sum, r) => sum + r.entry.overtakes, 0),
  };
}
