/**
 * Relatório das equipes (não é teste de regressão): para cada categoria e
 * força, com a estrutura padrão de quem assume a equipe,
 * - o resultado previsto do ano e quanto ele representa do valor da equipe;
 * - quanto o carro evolui por temporada (ritmo normal e agressivo, esforço
 *   dividido por igual entre as áreas abertas), comparado à evolução das rivais.
 */
import { test } from 'vitest';
import type { CareerState, ManagedTeam } from '@/domain/schemas';
import { TEAM_ECONOMY, teamValue } from '@/data/management';
import { CATEGORIES, advanceResearch, buildCategoryField, createManagedTeam, getPlayer, rankTeams, teamBudgetForecast } from '../engineApi';
import { botCareer } from '../helpers';

/** Ganho médio de (motor + chassi) / 2 por temporada, em regime (média das 4 últimas de 6 temporadas). */
function carGainPerSeason(start: ManagedTeam, rounds: number): number {
  let m = start;
  let total = 0;
  for (let season = 0; season < 6; season++) {
    let car = { engine: 60, chassis: 60, reliability: 60 };
    m = { ...m, development: { ...m.development, gains: { aero: 0, chassis: 0, engine: 0, suspension: 0, manufacturing: 0 } } };
    for (let round = 0; round < rounds; round++) {
      const step = advanceResearch(m, car);
      m = step.management;
      car = step.car;
    }
    if (season >= 2) total += (car.engine - 60 + car.chassis - 60) / 2;
  }
  return total / 4;
}

test('equipes: resultado previsto e ritmo de desenvolvimento, por categoria e força', () => {
  const base = botCareer(7);
  const player = { ...getPlayer(base), teamId: null, role: null };
  const k = (v: number) => `${Math.round(v / 1000).toLocaleString('pt-BR')}k`.padStart(9);
  console.log('\ncategoria           força   receitas  despesas  resultado  % operação  % valor | carro/ano: normal  agressivo  rivais');
  for (const category of CATEGORIES) {
    const field = buildCategoryField(category.id, 7, 1);
    const world: CareerState = { ...base, mode: 'executive', categoryId: category.id, teams: field.teams, drivers: [player, ...field.drivers] };
    for (const rank of [0, 3, 6, 9]) {
      const team = rankTeams(field.teams)[rank]!;
      const management = createManagedTeam(world, team.id, { position: 'owner', salary: 0, purchasePrice: 0 });
      const f = teamBudgetForecast({ ...world, management });
      const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
      const normal = carGainPerSeason(management, category.rounds);
      const high = carGainPerSeason({ ...management, development: { ...management.development, spend: 'high' } }, category.rounds);
      console.log(`${category.shortName.padEnd(20)} ${rank}    ${k(sum(f.income))} ${k(sum(f.expenses))} ${k(f.net)}  ${String(Math.round((f.net / TEAM_ECONOMY[category.id].operations) * 100)).padStart(6)}%   ${((f.net / teamValue(category.id, rank)) * 100).toFixed(1).padStart(6)}% |            ${normal.toFixed(2).padStart(5)}      ${high.toFixed(2).padStart(5)}   ${TEAM_ECONOMY[category.id].fieldDevelopment.toFixed(2)}`);
    }
  }
}, 60_000);
