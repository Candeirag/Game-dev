/**
 * Relatório de balanceamento (não é teste de regressão): simula várias
 * temporadas completas e imprime estatísticas agregadas. Execute com
 * `npm run calibrate` depois de mexer em constantes ou dados.
 */
import { test } from 'vitest';
import type { TrainingFocus } from '@/domain/schemas';
import { driverStandings, fullName, setTrainingFocus } from '@/engine';
import { newCareer, playSeason, type Choices } from '../helpers';

const SEEDS = 20;

test('relatório de balanceamento', () => {
  const champions: Record<string, number> = {};
  const perDriver: Record<string, { grid: number; finish: number; wins: number; n: number }> = {};
  let overtakes = 0, dnfs = 0, errors = 0, races = 0, wet = 0, damp = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const career = playSeason(newCareer(seed));
    const standings = driverStandings(career);
    const champion = career.drivers.find((d) => d.id === standings[0]?.driverId);
    if (champion) champions[fullName(champion)] = (champions[fullName(champion)] ?? 0) + 1;
    for (const r of career.rounds) {
      races++;
      if (r.race.weather.condition === 'wet') wet++;
      if (r.race.weather.condition === 'damp') damp++;
      for (const e of r.race.entries) {
        overtakes += e.overtakes; errors += e.errors; if (e.status === 'dnf') dnfs++;
        const a = (perDriver[e.driverId] ??= { grid: 0, finish: 0, wins: 0, n: 0 });
        a.grid += e.grid; a.finish += e.position; a.n++; if (e.position === 1) a.wins++;
      }
    }
  }
  console.log('Campeões:', champions);
  console.log(`Por corrida: ${(overtakes / races).toFixed(1)} ultrapassagens, ${(errors / races).toFixed(1)} erros, ${(dnfs / races).toFixed(2)} abandonos`);
  console.log(`Clima das corridas: ${wet} com chuva, ${damp} úmidas, de ${races}`);
  const rows = Object.entries(perDriver).sort((a, b) => a[1].finish - b[1].finish);
  for (const [id, a] of rows) console.log(`${id.padEnd(10)} grid ${(a.grid / a.n).toFixed(1).padStart(5)}  chegada ${(a.finish / a.n).toFixed(1).padStart(5)}  vitórias ${a.wins}`);

  const variants: [string, Choices, TrainingFocus][] = [
    ['padrão', {}, 'balanced'],
    ['treino de velocidade', {}, 'speed'],
    ['ataque na classificação', { approach: 'attack' }, 'speed'],
    ['corrida agressiva', { mode: 'aggressive' }, 'speed'],
    ['corrida conservadora', { mode: 'conservative' }, 'speed'],
  ];
  for (const [name, choices, focus] of variants) {
    let pos = 0, pts = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = driverStandings(playSeason(setTrainingFocus(newCareer(seed), focus), choices)).find((x) => x.driverId === 'player');
      pos += s?.position ?? 0; pts += s?.points ?? 0;
    }
    console.log(`Jogador (${name}): posição média ${(pos / SEEDS).toFixed(2)}, pontos ${(pts / SEEDS).toFixed(1)}`);
  }
}, 300_000);
