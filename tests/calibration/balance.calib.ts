/**
 * Relatório de balanceamento (não é teste de regressão): simula carreiras
 * inteiras com um robô e imprime estatísticas agregadas. Execute com
 * `npm run calibrate` depois de mexer em constantes ou dados.
 *
 * O "talento" do robô soma pontos aos atributos e representa um jogador que
 * decide melhor: 0 = mediano, 4 = bom, 8 = excelente.
 */
import { test } from 'vitest';
import { getCategory, getPlayer, getRaceDrivers, netWorth, overallRating } from '../engineApi';
import { botCareer, playCareer } from '../helpers';

const SEASONS = 14;
const SEEDS = [1, 2, 3, 4];

interface RaceStats { races: number; laps: number; sc: number; vsc: number; red: number; pits: number; penalised: number; dnf: number; injuries: number; overtakes: number; errors: number; orders: number; cars: number; champions: Set<string>; drift: number[] }

test('relatório de balanceamento', () => {
  const stats: Record<string, RaceStats> = {};
  console.log('\n=== Trajetórias (categoria e posição final; entre parênteses: nota geral, patrimônio) ===');
  for (const talent of [0, 4, 8]) {
    for (const seed of SEEDS) {
      const path: string[] = [];
      let f1Age = 0;
      playCareer(botCareer(seed, talent), SEASONS, { approach: 'attack' }, (c) => {
        const category = getCategory(c.categoryId);
        const p = getPlayer(c);
        if (category.id === 'f1' && !f1Age) f1Age = p.age;
        path.push(`${category.shortName.replace('Kart ', 'K').slice(0, 4)}${c.offseason?.playerPosition}${c.academy ? 'a' : ''}(${Math.round(overallRating(p.attributes))},${Math.round(netWorth(c.finance) / 1000)}k)`);
        const s = (stats[category.id] ??= { races: 0, laps: 0, sc: 0, vsc: 0, red: 0, pits: 0, penalised: 0, dnf: 0, injuries: 0, overtakes: 0, errors: 0, orders: 0, cars: 0, champions: new Set(), drift: [] });
        s.champions.add(c.offseason?.championDriverId ?? '');
        const ai = getRaceDrivers(c).filter((d) => !d.isPlayer).map((d) => overallRating(d.attributes));
        s.drift.push(ai.reduce((a, b) => a + b, 0) / ai.length - category.field.driverLevel);
        for (const r of c.rounds) {
          s.races++; s.laps += r.race.totalLaps; s.sc += r.race.safetyCars; s.vsc += r.race.virtualSafetyCars; s.red += r.race.redFlags; s.orders += r.race.teamOrders.length;
          for (const e of r.race.entries) { s.cars++; s.pits += e.pitStops; if (e.penaltySeconds > 0) s.penalised++; if (e.status === 'dnf') s.dnf++; if (e.injured) s.injuries++; s.overtakes += e.overtakes; s.errors += e.errors; }
        }
      });
      console.log(`talento ${talent}, semente ${seed}, F1 aos ${f1Age || '-'}: ${path.join(' ')}`);
    }
  }
  console.log('\n=== Corridas por categoria (médias por corrida) ===');
  for (const [id, s] of Object.entries(stats)) {
    const per = (v: number) => (v / s.races).toFixed(2);
    const drift = s.drift.reduce((a, b) => a + b, 0) / s.drift.length;
    console.log(`${getCategory(id as never).shortName.padEnd(18)} ${String(s.races).padStart(3)} corridas, ${per(s.laps)} voltas | safety car ${per(s.sc)}, virtual ${per(s.vsc)}, vermelha ${per(s.red)} | paradas por carro ${(s.pits / s.cars).toFixed(2)} | punidos ${per(s.penalised)}, abandonos ${per(s.dnf)}, lesões ${per(s.injuries)} | ultrapassagens ${per(s.overtakes)}, erros ${per(s.errors)}, ordens de equipe ${per(s.orders)} | nível da IA em relação ao projetado ${drift >= 0 ? '+' : ''}${drift.toFixed(1)}`);
  }
}, 900_000);
