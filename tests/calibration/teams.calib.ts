/** Relatório da economia das equipes: resultado previsto por categoria e força, com a estrutura padrão. */
import { test } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { TEAM_ECONOMY } from '@/data/management';
import { CATEGORIES, buildCategoryField, createManagedTeam, getPlayer, rankTeams, teamBudgetForecast } from '../engineApi';
import { botCareer } from '../helpers';

test('economia das equipes', () => {
  const base = botCareer(7);
  const player = { ...getPlayer(base), teamId: null, role: null };
  console.log('\ncategoria           força  receitas (patroc/vagas/prêmio)        despesas (pilotos/téc/oper/inst/pesq)                resultado  % da operação');
  for (const category of CATEGORIES) {
    const field = buildCategoryField(category.id, 7, 1);
    const world: CareerState = { ...base, mode: 'executive', categoryId: category.id, teams: field.teams, drivers: [player, ...field.drivers] };
    for (const rank of [0, 3, 6, 9]) {
      const team = rankTeams(field.teams)[rank]!;
      const management = createManagedTeam(world, team.id, { position: 'owner', salary: 0, purchasePrice: 0 });
      const f = teamBudgetForecast({ ...world, management });
      const k = (v: number) => `${Math.round(v / 1000)}k`.padStart(8);
      console.log(`${category.shortName.padEnd(20)} ${rank}  ${k(f.income.sponsors ?? 0)}${k(f.income.seats ?? 0)}${k(f.income.prize ?? 0)}   ${k(f.expenses.drivers ?? 0)}${k(f.expenses.staff ?? 0)}${k(f.expenses.operations ?? 0)}${k(f.expenses.facilities ?? 0)}${k(f.expenses.research ?? 0)}   ${k(f.net)}  ${Math.round((f.net / TEAM_ECONOMY[category.id].operations) * 100)}%`);
    }
  }
}, 60_000);
