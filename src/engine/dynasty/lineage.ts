/**
 * Linhagem da dinastia (Fase 6): a conta das conquistas de cada personagem, que a sucessão grava na
 * linhagem quando a geração termina.
 */
import type { SeasonSummary } from '@/domain/schemas';

/** Títulos e vitórias de um personagem como piloto, a partir das temporadas arquivadas. */
export function drivingRecord(seasons: readonly SeasonSummary[], driverId: string): { titles: number; wins: number } {
  let titles = 0;
  let wins = 0;
  for (const s of seasons) {
    if (s.mode !== 'driver') continue;
    const row = s.driverStandings.find((d) => d.driverId === driverId);
    if (!row) continue;
    wins += row.wins;
    if (row.position === 1) titles += 1;
  }
  return { titles, wins };
}
