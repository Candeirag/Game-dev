/**
 * Lances decisivos (Fase 4): quantos acontecem por corrida, quanto cada opção dá certo, se a chance
 * mostrada bate com o que acontece e quanto vale cada postura.
 *
 * As carreiras são jogadas pelo robô padrão (o estilo do piloto decide os lances). Em cada etapa, a
 * MESMA corrida é corrida de novo com cada postura, sem mexer na carreira: assim a comparação é
 * entre decisões, e não entre carreiras que tomaram rumos diferentes.
 *
 *   CALIBRATE=1 npx vitest run tests/calibration/moments.calib.ts --reporter=verbose
 *   (SEEDS=12 SEASONS=6 mudam o tamanho da amostra)
 */
import { describe, expect, it } from 'vitest';
import type { CareerState, MomentRecord } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { botMomentChoice } from '../../sim/policy';
import { botCareer, botOffseason, botTraining, resolvePending } from '../helpers';
import {
  buildRaceContext,
  completeWeekend,
  createWeekendRace,
  finalizeRace,
  isRaceFinished,
  overallRating,
  runPractice,
  runQualifying,
  simulateAbsentWeekend,
  startNextSeason,
  startWeekend,
  stepRaceLap,
  type MomentChoice,
  type RaceMoment,
  type RaceSimState,
} from '../engineApi';

/**
 * 'smart' é o jogador que lê os números: arrisca com 60% de chance ou mais, aceita a opção moderada
 * com 45% e, sem isso, fica na segura. Só existe aqui, para medir quanto vale decidir bem.
 */
const POLICIES = ['style', 'safe', 'bold', 'smart'] as const;
type Policy = (typeof POLICIES)[number];

function choose(moment: RaceMoment, policy: Policy): MomentChoice | null {
  if (policy === 'style') return null;
  if (policy !== 'smart') return botMomentChoice(moment, policy);
  const pick =
    moment.options.find((o) => o.risk === 2 && o.chance >= 0.6) ??
    [...moment.options].filter((o) => o.risk === 1 && o.chance >= 0.45).sort((a, b) => b.chance - a.chance)[0] ??
    [...moment.options].sort((a, b) => a.risk - b.risk || b.chance - a.chance)[0]!;
  return { option: pick.id, ...(moment.suggestedCompound ? { compound: moment.suggestedCompound } : {}) };
}

interface RaceSample {
  category: string;
  talent: number;
  edge: number;
  finished: boolean;
  position: number;
  points: number;
  damage: number;
  penalty: number;
  moments: MomentRecord[];
  /** Posições ganhas (positivo) ou perdidas na volta de cada lance (abandono conta −6). */
  swings: number[];
}

function runRace(career: CareerState, policy: Policy): { race: RaceSimState; swings: number[] } {
  const context = buildRaceContext(career);
  let race = createWeekendRace(career);
  const swings: number[] = [];
  const place = () => race.cars.filter((x) => x.status === 'running').findIndex((x) => x.driverId === race.playerDriverId);
  while (!isRaceFinished(race)) {
    const moment = race.pendingMoment;
    const before = place();
    const done = race.moments.length;
    race = stepRaceLap(race, context, { mode: 'balanced', pit: null, auto: true, moment: moment ? choose(moment, policy) : null });
    if (race.moments.length > done) {
      const after = place();
      swings.push(after < 0 ? -6 : before - after);
    }
  }
  return { race, swings };
}

function play(seed: number, talent: number, seasons: number, out: Record<Policy, RaceSample[]>): void {
  let career: CareerState = botCareer(seed, talent);
  for (let s = 0; s < seasons && career.status === 'active' && career.mode === 'driver'; s++) {
    career = botTraining(career);
    while (career.nextRoundIndex < career.calendar.length) {
      let c = startWeekend(resolvePending(career));
      if (!c.weekend!.playerParticipates) {
        career = simulateAbsentWeekend(c);
        continue;
      }
      c = runQualifying(runPractice(c, 'setup'), 'balanced');
      const category = getCategory(c.categoryId);
      const player = c.drivers.find((d) => d.id === c.playerDriverId)!;
      const edge = overallRating(player.attributes) - category.field.driverLevel;
      let official: RaceSimState | null = null;
      for (const policy of POLICIES) {
        const { race, swings } = runRace(c, policy);
        if (policy === 'style') official = race;
        const entry = finalizeRace(race, category).entries.find((e) => e.driverId === c.playerDriverId)!;
        out[policy].push({
          category: category.id,
          talent,
          edge,
          finished: entry.status === 'finished',
          position: entry.position,
          points: entry.points,
          damage: entry.damage,
          penalty: entry.penaltySeconds,
          moments: race.moments,
          swings,
        });
      }
      career = completeWeekend(c, official!);
    }
    career = resolvePending(career);
    if (!career.offseason) break;
    const next = botOffseason(career);
    career = startNextSeason(next.career, next.offerId);
  }
}

const pct = (n: number, d: number) => (d === 0 ? '   -' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

describe('lances decisivos', () => {
  it('relatório de calibragem', () => {
    const seeds = Array.from({ length: Number(process.env.SEEDS ?? 12) }, (_, i) => 101 + i);
    const seasons = Number(process.env.SEASONS ?? 6);
    const out: Record<Policy, RaceSample[]> = { style: [], safe: [], bold: [], smart: [] };
    for (const talent of [0, 4, 8]) for (const seed of seeds) play(seed, talent, seasons, out);

    console.log(`\n${out.style.length} corridas, cada uma corrida com as quatro posturas`);
    console.log('postura   posição   pontos   abandonos   dano médio   punição média (s)   lances/corrida');
    for (const policy of POLICIES) {
      const all = out[policy];
      console.log(
        `${policy.padEnd(8)}  ${avg(all.map((r) => r.position))
          .toFixed(2)
          .padStart(6)}   ${avg(all.map((r) => r.points))
          .toFixed(2)
          .padStart(
            6,
          )}   ${pct(all.filter((r) => !r.finished).length, all.length)}        ${avg(all.map((r) => r.damage)).toFixed(3)}        ${avg(all.map((r) => r.penalty)).toFixed(2)}                ${avg(all.filter((r) => r.finished).map((r) => r.moments.length)).toFixed(2)}`,
      );
    }
    console.log('\npor categoria (posição média de cada postura):');
    for (const category of [...new Set(out.style.map((r) => r.category))]) {
      const line = POLICIES.map((p) => `${p} ${avg(out[p].filter((r) => r.category === category).map((r) => r.position)).toFixed(2)}`).join(' · ');
      const done = out.style.filter((r) => r.category === category && r.finished);
      const counts = [0, 1, 2, 3, 4, 5].map((n) => done.filter((r) => r.moments.length === n).length);
      console.log(
        `  ${category.padEnd(20)} ${String(out.style.filter((r) => r.category === category).length).padStart(4)} corridas · ${line} · lances 0..5: ${counts.join(' ')}`,
      );
    }

    for (const policy of POLICIES) {
      const all = out[policy];
      const records = all.flatMap((r) => r.moments.map((m, i) => ({ m, swing: r.swings[i] ?? 0, edge: r.edge, talent: r.talent })));
      console.log(`\n===== ${policy}: ${records.length} lances =====`);
      console.log('lance.opção            vezes   deu certo   chance mostrada   posições (certo / errado / média)   rodou  tocou  abandonou  punido');
      for (const key of [...new Set(records.map((r) => `${r.m.kind}.${r.m.option}`))].sort()) {
        const list = records.filter((r) => `${r.m.kind}.${r.m.option}` === key);
        const won = list.filter((r) => r.m.success);
        const lost = list.filter((r) => !r.m.success);
        console.log(
          `${key.padEnd(22)} ${String(list.length).padStart(5)}   ${pct(won.length, list.length)}        ${(100 * avg(list.map((r) => r.m.chance))).toFixed(0).padStart(3)}%             ${avg(
            won.map((r) => r.swing),
          )
            .toFixed(2)
            .padStart(5)} / ${avg(lost.map((r) => r.swing))
            .toFixed(2)
            .padStart(5)} / ${avg(list.map((r) => r.swing))
            .toFixed(2)
            .padStart(
              5,
            )}             ${pct(list.filter((r) => r.m.outcome === 'spin').length, list.length)}   ${pct(list.filter((r) => r.m.contact).length, list.length)}   ${pct(list.filter((r) => r.m.outcome === 'retired').length, list.length)}      ${pct(list.filter((r) => r.m.penaltySeconds > 0).length, list.length)}`,
        );
      }
      console.log('vantagem sobre o grid   lances   deu certo   chance mostrada');
      for (const [label, lo, hi] of [
        ['abaixo de -8', -99, -8],
        ['-8 a -3', -8, -3],
        ['-3 a +3', -3, 3],
        ['+3 a +8', 3, 8],
        ['acima de +8', 8, 99],
      ] as const) {
        const list = records.filter((r) => r.edge >= lo && r.edge < hi);
        console.log(
          `${label.padEnd(22)} ${String(list.length).padStart(6)}   ${pct(list.filter((r) => r.m.success).length, list.length)}        ${(100 * avg(list.map((r) => r.m.chance))).toFixed(0).padStart(3)}%`,
        );
      }
    }
    expect(out.style.length).toBeGreaterThan(0);
  }, 900_000);
});

/* ------------------------------------------------------------------ */
/* Monopostos e pneus: corridas avulsas por categoria                  */
/* ------------------------------------------------------------------ */

import type { CategoryId } from '@/domain/schemas';
import { tyreCliff } from '@/engine/simulation/performance';
import { DRY, raceSetup } from '../raceSetup';

describe('pneus e lances por categoria', () => {
  it('relatório de calibragem', () => {
    const races = Number(process.env.RACES ?? 30);
    for (const categoryId of ['kart-regional', 'kart-international', 'f4', 'f3', 'f2', 'f1'] as CategoryId[]) {
      const category = getCategory(categoryId);
      const tracks = [...new Set(category.trackIds)].slice(0, 5);
      const kinds = new Map<string, { n: number; won: number; chance: number }>();
      const perRace: number[] = [];
      let cars = 0;
      let pastCliff = 0;
      let lapsPastCliff = 0;
      let stops = 0;
      let dnf = 0;
      let rulePenalty = 0;
      const position: Record<Policy, number[]> = { style: [], safe: [], bold: [], smart: [] };
      for (const trackId of tracks) {
        const setup = raceSetup(categoryId, trackId);
        for (let seed = 1; seed <= races; seed++) {
          for (const policy of POLICIES) {
            let race = setup.start(seed * 7919 + tracks.indexOf(trackId) * 104729 + 3, DRY);
            const over = new Set<string>();
            while (!isRaceFinished(race)) {
              const moment = race.pendingMoment;
              race = stepRaceLap(race, setup.ctx, { mode: 'balanced', pit: null, auto: true, moment: moment ? choose(moment, policy) : null });
              if (policy === 'style')
                for (const car of race.cars) {
                  if (car.status === 'running' && car.tyre.wear >= tyreCliff(car.tyre.compound)) {
                    over.add(car.driverId);
                    lapsPastCliff++;
                  }
                }
            }
            const result = finalizeRace(race, category);
            const entry = result.entries.find((e) => e.driverId === setup.playerId)!;
            position[policy].push(entry.position);
            if (policy !== 'style') continue;
            perRace.push(race.moments.length);
            for (const m of race.moments) {
              const key = `${m.kind}.${m.option}`;
              const k = kinds.get(key) ?? { n: 0, won: 0, chance: 0 };
              kinds.set(key, { n: k.n + 1, won: k.won + (m.success ? 1 : 0), chance: k.chance + m.chance });
            }
            cars += race.cars.length;
            pastCliff += over.size;
            stops += race.cars.reduce((sum, c) => sum + c.pitStops, 0);
            dnf += race.cars.filter((c) => c.status === 'dnf').length;
            rulePenalty += result.entries.filter((e) => e.penaltySeconds >= 30).length;
          }
        }
      }
      const n = perRace.length;
      console.log(`\n===== ${categoryId}: ${n} corridas em ${tracks.length} pistas =====`);
      console.log(
        `pneus: ${pct(pastCliff, cars)} dos carros passaram do penhasco em algum momento (${(lapsPastCliff / Math.max(1, cars)).toFixed(2)} voltas por carro) · paradas por carro ${(stops / cars).toFixed(2)} · abandonos ${pct(dnf, cars)} · punição dos dois compostos ${rulePenalty}`,
      );
      console.log(
        `lances por corrida: ${avg(perRace).toFixed(2)} · distribuição 0..5: ${[0, 1, 2, 3, 4, 5].map((k) => perRace.filter((x) => x === k).length).join(' ')}`,
      );
      console.log(`posição do jogador: ${POLICIES.map((p) => `${p} ${avg(position[p]).toFixed(2)}`).join(' · ')}`);
      for (const key of [...kinds.keys()].sort()) {
        const k = kinds.get(key)!;
        console.log(`  ${key.padEnd(22)} ${String(k.n).padStart(4)}   certo ${pct(k.won, k.n)}   chance ${((100 * k.chance) / k.n).toFixed(0)}%`);
      }
    }
    expect(true).toBe(true);
  }, 900_000);
});
