/**
 * Saúde do mundo no longo prazo (não é teste de regressão): 60 temporadas de
 * um campeonato acompanhado de fora, por categoria. Mostra, por década, o
 * nível e a idade dos pilotos, a força dos carros e a variedade de campeões.
 * Serve para ver se o mercado de pilotos e a evolução das equipes se mantêm
 * estáveis ou se inflam, envelhecem ou congelam.
 */
import { test } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import * as engine from '../engineApi';
import { newCareer, playExecutiveRound, resolvePending } from '../helpers';

function spectator(seed: number, categoryId: CareerState['categoryId']): CareerState {
  const base = newCareer(seed);
  const category = engine.getCategory(categoryId);
  const field = engine.buildCategoryField(categoryId, seed, 1);
  const player = { ...engine.getPlayer(base), teamId: null, role: null, age: 20 };
  return {
    ...base,
    mode: 'executive',
    categoryId,
    teams: field.teams,
    drivers: [player, ...field.drivers],
    calendar: engine.buildCalendar(seed, 1, base.year, category),
    sponsors: [],
    finance: { ...base.finance, cash: 50_000_000 },
    tutorial: { done: [], dismissed: true },
  };
}

test('mundo: 60 temporadas por categoria', () => {
  for (const categoryId of ['kart-regional', 'f3', 'f1'] as const) {
    const category = engine.getCategory(categoryId);
    let c = spectator(5, categoryId);
    const champions: string[] = [];
    const championTeams: string[] = [];
    console.log(`\n=== ${category.name} (nível projetado ${category.field.driverLevel}, idades ${category.field.minAge} a ${category.field.maxAge}) ===`);
    console.log(
      'temporada  nota: média  mín  máx | idade: média  máx | carro: melhor  pior  média | campeões distintos na década (pilotos / equipes) | livres',
    );
    for (let season = 1; season <= 60; season++) {
      while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
      if (c.succession) c = engine.resolveSuccession(c, 'relative-adult', 'executive');
      const off = c.executiveOffseason!;
      champions.push(off.summary.championDriverId);
      championTeams.push(off.summary.championTeamId);
      if (season === 1 || season % 10 === 0) {
        const race = engine.getRaceDrivers(c);
        const ratings = race.map((d) => engine.overallRating(d.attributes));
        const ages = race.map((d) => d.age);
        const cars = c.teams.map((t) => (t.car.engine + t.car.chassis) / 2);
        const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        console.log(
          `${String(season).padStart(6)}       ${avg(ratings).toFixed(1)}  ${Math.min(...ratings).toFixed(0)}  ${Math.max(...ratings).toFixed(0)} |        ${avg(ages).toFixed(1)}  ${Math.max(...ages)} |        ${Math.max(...cars).toFixed(1)}  ${Math.min(...cars).toFixed(1)}  ${avg(cars).toFixed(1)} |      ${new Set(champions.slice(-10)).size} / ${new Set(championTeams.slice(-10)).size}                                 | ${c.drivers.filter((d) => !d.teamId && !d.isPlayer).length}`,
        );
      }
      c = engine.startExecutiveSeason(resolvePending(c), { kind: 'spectate' });
    }
    const titles = new Map<string, number>();
    for (const id of championTeams) titles.set(id, (titles.get(id) ?? 0) + 1);
    console.log(`títulos de equipes em 60 temporadas: ${[...titles.values()].sort((a, b) => b - a).join(', ')} (${titles.size} equipes campeãs)`);
  }
}, 3_600_000);
