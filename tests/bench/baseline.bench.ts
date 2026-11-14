/**
 * Medições de desempenho de referência (não é teste de regressão). Imprime os
 * tempos de corrida, de temporada, de gravação e da classificação em escala
 * usados no plano técnico (docs/PLANO_ARQUITETURA_FASE3.md, seção 3.3).
 *
 * Execute com `npm run bench`.
 */
import { test } from 'vitest';
import { CareerStateSchema, type CareerState, type RoundRecord } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { applyRoundEffects } from '@/engine/career/roundEffects';
import { generateEvents } from '@/engine/events/engine';
import { createRng, hashSeed } from '@/engine/rng';
import { checksumOf } from '@/persistence/checksum';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { createEnvelope, parseEnvelope } from '@/persistence/saveService';
import {
  buildRaceContext, closeSeason, completeWeekend, computeDriverStandings, createWeekendRace, driverStandings, finalizeRace, generateOffers,
  runPractice, runQualifying, simulateRemainingRace, startNextSeason, startWeekend, updateMarketInterest,
} from '../engineApi';
import { NOW, botCareer, botTraining, pickBestOffer, playSeason, resolvePending } from '../helpers';
import { raceSetup } from '../raceSetup';

const AUTO = { mode: 'balanced', auto: true } as const;
const lines: string[] = [];
const ms = (f: () => void, n = 1) => {
  const t = performance.now();
  for (let i = 0; i < n; i++) f();
  return (performance.now() - t) / n;
};
const log = (label: string, value: number | string, unit = 'ms') => lines.push(`${label.padEnd(60)} ${typeof value === 'number' ? value.toFixed(3) : value} ${unit}`);

test('medições de referência', () => {
  // Corrida avulsa, por categoria.
  for (const id of ['kart-regional', 'f3', 'f1'] as const) {
    const setup = raceSetup(id);
    simulateRemainingRace(setup.start(1), setup.ctx, AUTO);
    let laps = 0;
    const time = ms(() => { laps = simulateRemainingRace(setup.start(7), setup.ctx, AUTO).currentLap; }, 30);
    log(`corrida ${id} (${laps} voltas, 20 carros)`, time);
    log('  por volta', (time / laps) * 1000, 'µs');
  }
  const N = 200_000;
  log('hashSeed + createRng', (ms(() => { for (let i = 0; i < N; i++) createRng(hashSeed(123456, i & 63, 'f1-s1-3-first')).next(); }) / N) * 1e6, 'ns por sorteio');

  // Carreira do robô até completar uma temporada de F1.
  let career: CareerState = botCareer(2, 8);
  let complete = career;
  const seasons: string[] = [];
  for (let i = 0; i < 16; i++) {
    const categoryId = career.categoryId;
    const t0 = performance.now();
    complete = playSeason(botTraining(career), { approach: 'attack' });
    const t1 = performance.now();
    career = startNextSeason(complete, pickBestOffer(complete));
    seasons.push(`${getCategory(categoryId).shortName.replace('Kart ', 'K')}:${(t1 - t0).toFixed(0)}+${(performance.now() - t1).toFixed(0)}`);
    if (categoryId === 'f1') break;
  }
  log('temporada + virada por categoria', seasons.join(' '), 'ms');

  // Save.
  log('tamanho do save (JSON compacto)', JSON.stringify(complete).length / 1024, 'KB');
  const slices = Object.entries(complete).map(([k, v]) => [k, JSON.stringify(v).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
  log('  maiores fatias', slices.map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}KB`).join(', '), '');
  log('  uma etapa / só a narração', `${(JSON.stringify(complete.rounds[0]).length / 1024).toFixed(1)}KB / ${(JSON.stringify(complete.rounds[0]?.race.events).length / 1024).toFixed(1)}KB`, '');
  log('JSON.stringify', ms(() => JSON.stringify(complete), 10));
  log('checksum (serialização canônica + hash)', ms(() => checksumOf(complete), 10));
  log('validateCareerIntegrity', ms(() => validateCareerIntegrity(complete), 10));
  log('validação Zod do save inteiro', ms(() => CareerStateSchema.safeParse(complete), 10));
  log('gravação automática completa', ms(() => parseEnvelope(JSON.parse(JSON.stringify(createEnvelope(complete, NOW)))), 10));

  // Sistemas por etapa, no meio de uma temporada de F1.
  let mid = botTraining(startNextSeason(complete, pickBestOffer(complete)));
  for (let i = 0; i < 6; i++) {
    const w = runQualifying(runPractice(startWeekend(resolvePending(mid)), 'setup'), 'balanced');
    mid = completeWeekend(w, simulateRemainingRace(createWeekendRace(w), buildRaceContext(w), AUTO));
  }
  mid = resolvePending(mid);
  log('driverStandings (20 pilotos, 6 etapas)', ms(() => driverStandings(mid), 200));
  log('updateMarketInterest', ms(() => updateMarketInterest(mid), 50));
  log('treino + classificação', ms(() => runQualifying(runPractice(startWeekend(mid), 'setup'), 'balanced'), 20));
  const w = runQualifying(runPractice(startWeekend(mid), 'setup'), 'balanced');
  const event = w.calendar[w.nextRoundIndex];
  const weekend = w.weekend;
  if (!event || !weekend?.practice || !weekend.qualifying) throw new Error('Fim de semana incompleto na medição.');
  const race = simulateRemainingRace(createWeekendRace(w), buildRaceContext(w), AUTO);
  const record: RoundRecord = { season: w.season, round: weekend.round, trackId: event.trackId, date: event.date, practice: weekend.practice, qualifying: weekend.qualifying, race: finalizeRace(race, getCategory(w.categoryId)) };
  const withResult: CareerState = { ...w, rounds: [...w.rounds, record], weekend: null, nextRoundIndex: w.nextRoundIndex + 1 };
  log('applyRoundEffects (todos os sistemas pós-etapa)', ms(() => applyRoundEffects(withResult, record, {}), 20));
  log('  generateEvents', ms(() => generateEvents(withResult, record, record.round), 50));
  log('generateOffers', ms(() => generateOffers(complete, complete.reputation, 'expired', 5), 20));
  log('closeSeason', ms(() => closeSeason({ ...complete, offseason: null }), 10));
  log('startNextSeason', ms(() => startNextSeason(complete, pickBestOffer(complete)), 10));

  // Escala: classificação com resultados sintéticos.
  const base = complete.rounds[0];
  const entry = base?.race.entries[0];
  if (!base || !entry) throw new Error('Sem etapa de referência.');
  for (const [drivers, rounds] of [[20, 14], [40, 24], [200, 24], [400, 30]] as const) {
    const synthetic: RoundRecord[] = Array.from({ length: rounds }, (_, r) => ({
      ...base,
      round: r + 1,
      race: { ...base.race, events: [], entries: Array.from({ length: drivers }, (_, i) => ({ ...entry, driverId: `d${(i + r) % drivers}`, teamId: `t${i % 10}`, position: i + 1, grid: i + 1 })) },
    }));
    log(`computeDriverStandings (${drivers} pilotos, ${rounds} etapas)`, ms(() => computeDriverStandings(synthetic, []), 5));
  }

  console.log(`\n${lines.join('\n')}\n`);
}, 900_000);
