/**
 * Verificações de integridade que o schema sozinho não cobre: referências
 * entre entidades, unicidade e coerência entre calendário, resultados,
 * contrato e progresso da temporada.
 */
import type { CareerState } from '@/domain/schemas';
import { CATEGORIES } from '@/data/categories';
import { TRACKS } from '@/data/tracks';

export function validateCareerIntegrity(career: CareerState): string[] {
  const problems: string[] = [];
  const teamIds = new Set(career.teams.map((t) => t.id));
  const driverIds = new Set(career.drivers.map((d) => d.id));
  const trackIds = new Set(TRACKS.map((t) => t.id));
  const category = CATEGORIES.find((c) => c.id === career.categoryId);

  if (teamIds.size !== career.teams.length) problems.push('Equipes com id duplicado.');
  if (driverIds.size !== career.drivers.length) problems.push('Pilotos com id duplicado.');

  const players = career.drivers.filter((d) => d.isPlayer);
  const player = players[0];
  if (players.length !== 1 || player?.id !== career.playerDriverId) problems.push('Deve existir exatamente um piloto do jogador.');
  if (!player?.teamId) problems.push('O jogador precisa ter equipe.');
  if (player && player.role !== 'first' && player.role !== 'second') problems.push('O jogador precisa ser piloto titular.');

  for (const d of career.drivers) {
    if (d.teamId !== null && !teamIds.has(d.teamId)) problems.push(`Piloto ${d.id} aponta para equipe inexistente ${d.teamId}.`);
    if ((d.teamId === null) !== (d.role === null)) problems.push(`Piloto ${d.id} tem equipe e papel incoerentes.`);
  }
  for (const t of career.teams) {
    const lineup = career.drivers.filter((d) => d.teamId === t.id);
    const race = lineup.filter((d) => d.role !== 'reserve').length;
    const reserves = lineup.length - race;
    if (race !== 2) problems.push(`Equipe ${t.id} tem ${race} pilotos titulares (esperado: 2).`);
    if (reserves > 1) problems.push(`Equipe ${t.id} tem ${reserves} reservas (máximo: 1).`);
  }

  // Contrato do jogador.
  if (player && career.contract.teamId !== player.teamId) problems.push('O contrato não corresponde à equipe do jogador.');
  if (career.contract.categoryId !== career.categoryId) problems.push('O contrato não corresponde à categoria atual.');
  if (player && career.contract.role !== player.role) problems.push('O papel do jogador não corresponde ao contrato.');
  if (career.contract.endSeason < career.contract.startSeason) problems.push('Contrato com datas invertidas.');

  if (!category) problems.push(`Categoria desconhecida: ${career.categoryId}.`);
  else if (career.calendar.length !== category.rounds) problems.push('Calendário com número de etapas diferente do da categoria.');
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
    for (const e of career.weekend.entrants) {
      if (!driverIds.has(e.driverId) || !teamIds.has(e.teamId)) problems.push('Fim de semana com inscrito inexistente.');
    }
    if (career.offseason) problems.push('Fim de semana em andamento durante o fechamento da temporada.');
  }

  // Fechamento: existe exatamente quando a temporada acabou.
  const seasonOver = career.nextRoundIndex >= career.calendar.length && career.weekend === null;
  if (career.status === 'active' && seasonOver !== (career.offseason !== null)) problems.push('Fechamento de temporada incoerente com o progresso.');

  for (const event of career.pendingEvents) {
    for (const choice of event.choices) {
      const total = choice.outcomes.reduce((sum, o) => sum + o.probability, 0);
      if (Math.abs(total - 1) > 0.001) problems.push(`Evento ${event.id}: as probabilidades da escolha "${choice.id}" não somam 1.`);
    }
  }

  for (const value of [career.finance.cash, career.finance.fixedIncome, career.finance.equityFund, career.reputation]) {
    if (!Number.isFinite(value)) problems.push('Valor numérico inválido nas finanças ou na reputação.');
  }

  career.history.forEach((h, i) => {
    if (h.season !== i + 1) problems.push(`Histórico de temporadas fora de ordem: ${h.season}.`);
  });
  if (career.history.length !== career.season - 1) problems.push('Histórico de temporadas incompleto.');

  return problems;
}
