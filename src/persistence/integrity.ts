/**
 * Verificações de integridade que o schema sozinho não cobre: referências
 * entre entidades, unicidade e coerência entre calendário, resultados e
 * progresso da temporada.
 */
import type { CareerState } from '@/domain/schemas';
import { TRACKS } from '@/data/tracks';

export function validateCareerIntegrity(career: CareerState): string[] {
  const problems: string[] = [];
  const teamIds = new Set(career.teams.map((t) => t.id));
  const driverIds = new Set(career.drivers.map((d) => d.id));
  const trackIds = new Set(TRACKS.map((t) => t.id));

  if (teamIds.size !== career.teams.length) problems.push('Equipes com id duplicado.');
  if (driverIds.size !== career.drivers.length) problems.push('Pilotos com id duplicado.');

  const players = career.drivers.filter((d) => d.isPlayer);
  if (players.length !== 1 || players[0]?.id !== career.playerDriverId) problems.push('Deve existir exatamente um piloto do jogador.');
  if (!players[0]?.teamId) problems.push('O jogador precisa ter equipe.');

  for (const d of career.drivers) {
    if (d.teamId !== null && !teamIds.has(d.teamId)) problems.push(`Piloto ${d.id} aponta para equipe inexistente ${d.teamId}.`);
  }
  for (const t of career.teams) {
    const count = career.drivers.filter((d) => d.teamId === t.id).length;
    if (count !== 2) problems.push(`Equipe ${t.id} tem ${count} pilotos (esperado: 2).`);
  }

  career.calendar.forEach((e, i) => {
    if (e.round !== i + 1) problems.push(`Etapa fora de ordem no calendário: ${e.round}.`);
    if (!trackIds.has(e.trackId)) problems.push(`Pista desconhecida no calendário: ${e.trackId}.`);
  });

  if (career.nextRoundIndex > career.calendar.length) problems.push('Progresso da temporada além do calendário.');
  if (career.rounds.length !== career.nextRoundIndex) problems.push('Número de resultados não bate com o progresso da temporada.');
  career.rounds.forEach((r, i) => {
    if (r.round !== i + 1) problems.push(`Resultado da etapa ${r.round} fora de ordem.`);
    if (r.season !== career.season) problems.push(`Resultado da etapa ${r.round} pertence a outra temporada.`);
    const positions = r.race.entries.map((e) => e.position);
    if (new Set(positions).size !== positions.length) problems.push(`Posições duplicadas na etapa ${r.round}.`);
    for (const e of r.race.entries) {
      if (!driverIds.has(e.driverId)) problems.push(`Resultado da etapa ${r.round} com piloto inexistente ${e.driverId}.`);
      if (!teamIds.has(e.teamId)) problems.push(`Resultado da etapa ${r.round} com equipe inexistente ${e.teamId}.`);
    }
  });

  if (career.weekend) {
    const expectedRound = career.calendar[career.nextRoundIndex]?.round;
    if (career.weekend.round !== expectedRound) problems.push('Fim de semana em andamento não corresponde à próxima etapa.');
    if (career.weekend.phase !== 'practice' && !career.weekend.practice) problems.push('Fim de semana sem resultado de treino.');
    if (career.weekend.phase === 'race' && !career.weekend.qualifying) problems.push('Fim de semana sem classificação.');
  }

  career.history.forEach((h, i) => {
    if (h.season !== i + 1) problems.push(`Histórico de temporadas fora de ordem: ${h.season}.`);
  });
  if (career.history.length !== career.season - 1) problems.push('Histórico de temporadas incompleto.');

  return problems;
}
