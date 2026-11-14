import { describe, expect, it } from 'vitest';
import type { TyreCompound } from '@/domain/schemas';
import { CATEGORIES, getCategory } from '@/data/categories';
import { getTrack, raceLaps, referenceLapTime } from '@/data/tracks';
import {
  RACE,
  TYRES,
  bestCompoundFor,
  buildStrategyOptions,
  buildWetnessProfile,
  decidePit,
  finalizeRace,
  isRaceFinished,
  simulateRemainingRace,
  stepRaceLap,
  type RaceSimState,
} from '@/engine';
import { fuelPenalty, tyreCliffPenalty, tyreConditionEffect } from '@/engine/simulation/performance';
import { simulateQualifying } from '@/engine/simulation/qualifying';
import { DRY, NEUTRAL_MODIFIERS, WET, raceSetup } from './raceSetup';

const AUTO = { mode: 'balanced', auto: true } as const;
const f1 = raceSetup('f1', 'abu-dhabi');
const f1Rules = getCategory('f1').race;

function runUntil(state: RaceSimState, setup: typeof f1, predicate: (s: RaceSimState) => boolean): RaceSimState {
  let s = state;
  while (!isRaceFinished(s) && !predicate(s)) s = stepRaceLap(s, setup.ctx, AUTO);
  return s;
}

describe('pneus, combustível e clima', () => {
  it('o composto macio é mais rápido e desgasta mais que o duro', () => {
    expect(TYRES.soft.pace).toBeLessThan(TYRES.medium.pace);
    expect(TYRES.medium.pace).toBeLessThan(TYRES.hard.pace);
    expect(TYRES.soft.wear).toBeGreaterThan(TYRES.hard.wear);
  });

  it('pneu errado para a pista custa caro; o pneu certo não custa nada', () => {
    expect(tyreConditionEffect('medium', 0).pace).toBe(0);
    expect(tyreConditionEffect('medium', 0.6).pace).toBeGreaterThan(0.1);
    expect(tyreConditionEffect('medium', 0.6).error).toBeGreaterThan(2);
    expect(tyreConditionEffect('intermediate', 0.4).pace).toBe(0);
    expect(tyreConditionEffect('intermediate', 0).pace).toBeGreaterThan(0);
    expect(tyreConditionEffect('wet', 0.9).pace).toBe(0);
    expect(tyreConditionEffect('wet', 0).pace).toBeGreaterThan(0.03);
    expect(tyreConditionEffect('kart', 1)).toEqual({ pace: 0, error: 1, wear: 1 });
  });

  it('a escolha de composto segue a umidade', () => {
    expect(TYRES[bestCompoundFor(f1Rules, 0)].rain).toBe(false);
    expect(bestCompoundFor(f1Rules, 0.4)).toBe('intermediate');
    expect(bestCompoundFor(f1Rules, 0.9)).toBe('wet');
    expect(bestCompoundFor(getCategory('f3').race, 0.5)).toBe('wet');
  });

  it('o penhasco do pneu e o peso do combustível deixam a volta mais lenta', () => {
    expect(tyreCliffPenalty('medium', 0.7)).toBe(0);
    expect(tyreCliffPenalty('medium', 0.95)).toBeGreaterThan(0.01);
    expect(tyreCliffPenalty('kart', 0.95)).toBe(0);
    expect(fuelPenalty(60, 60)).toBeCloseTo(RACE.FUEL_FULL_TANK_PENALTY, 6);
    expect(fuelPenalty(0, 60)).toBe(0);
  });

  it('o perfil de clima é determinístico, fica entre 0 e 1 e só muda nas categorias com clima variável', () => {
    const spa = getTrack('spa');
    expect(buildWetnessProfile(5, spa, DRY, 44, true)).toEqual(buildWetnessProfile(5, spa, DRY, 44, true));
    let rainy = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { wetnessByLap, forecast } = buildWetnessProfile(seed, spa, DRY, 44, true);
      expect(wetnessByLap).toHaveLength(45);
      for (const w of wetnessByLap) expect(w >= 0 && w <= 1).toBe(true);
      if (forecast.kind === 'rain') rainy++;
    }
    // Chuva chega em ~45% × chance de chuva da pista (0,45 em Spa → ~20% das corridas secas).
    expect(rainy / 300).toBeGreaterThan(0.12);
    expect(rainy / 300).toBeLessThan(0.3);
    expect(buildWetnessProfile(5, spa, WET, 20, false).wetnessByLap.every((w) => w === WET.wetness)).toBe(true);
  });
});

describe('estratégia', () => {
  const track = getTrack('abu-dhabi');
  const category = getCategory('f1');
  const laps = raceLaps(track, category);
  const attributes = f1.drivers[0]!.attributes;
  const options = buildStrategyOptions(category.race, track, laps, referenceLapTime(track, category), attributes, 0);

  it('na F1 seca, todas as opções usam dois compostos e cobrem a corrida inteira', () => {
    expect(options.length).toBeGreaterThanOrEqual(2);
    for (const o of options) {
      const compounds = [o.plan.startCompound, ...o.plan.stops.map((s) => s.compound)];
      expect(new Set(compounds).size).toBeGreaterThanOrEqual(2);
      expect(o.plan.stops.every((s) => s.lap > 1 && s.lap < laps)).toBe(true);
    }
    expect([...options].sort((a, b) => a.estimatedLoss - b.estimatedLoss)).toEqual(options);
  });

  it('com pista molhada, a única opção é largar com pneu de chuva', () => {
    const wet = buildStrategyOptions(category.race, track, laps, 90, attributes, 0.9);
    expect(wet).toHaveLength(1);
    expect(wet[0]!.plan.startCompound).toBe('wet');
  });

  it('no kart não há paradas', () => {
    const kart = getCategory('kart-regional');
    const o = buildStrategyOptions(kart.race, getTrack('vale-do-sol'), 22, 48, attributes, 0);
    expect(o).toHaveLength(1);
    expect(o[0]!.plan).toEqual({ startCompound: 'kart', stops: [] });
  });

  it('a decisão de box reage a pneu errado, dano e neutralização', () => {
    const car = f1.start(1).cars[0]!;
    const base = { lap: 10, totalLaps: laps, wetness: 0, neutralized: false, needsSecondCompound: true };
    expect(decidePit({ ...car, plan: [{ lap: 25, compound: 'hard' }] }, f1Rules, base)).toBeNull();
    expect(decidePit(car, f1Rules, { ...base, wetness: 0.5 })).toBe('intermediate');
    expect(decidePit({ ...car, damage: 0.5 }, f1Rules, base)).not.toBeNull();
    expect(decidePit({ ...car, plan: [{ lap: 16, compound: 'hard' }], tyre: { ...car.tyre, age: 9 } }, f1Rules, { ...base, neutralized: true })).toBe('hard');
    expect(decidePit({ ...car, plan: [{ lap: 10, compound: 'hard' }] }, f1Rules, base)).toBe('hard');
    expect(decidePit(car, f1Rules, { ...base, lap: 1 })).toBeNull();
    expect(decidePit(car, getCategory('kart-regional').race, base)).toBeNull();
  });
});

describe('corrida de F1', () => {
  it('é determinística', () => {
    const a = simulateRemainingRace(f1.start(11), f1.ctx, AUTO);
    const b = simulateRemainingRace(f1.start(11), f1.ctx, AUTO);
    expect(a).toEqual(b);
  });

  it('mantém as invariantes do resultado oficial em várias corridas', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const state = simulateRemainingRace(f1.start(seed), f1.ctx, AUTO);
      const result = finalizeRace(state, f1.ctx.category);
      expect(result.entries).toHaveLength(20);
      expect(new Set(result.entries.map((e) => e.driverId)).size).toBe(20);
      expect(result.entries.map((e) => e.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      const finishers = result.entries.filter((e) => e.status === 'finished');
      for (let i = 1; i < finishers.length; i++) expect(finishers[i]!.totalTime).toBeGreaterThanOrEqual(finishers[i - 1]!.totalTime);
      const firstDnf = result.entries.findIndex((e) => e.status === 'dnf');
      if (firstDnf >= 0) expect(result.entries.slice(firstDnf).every((e) => e.status === 'dnf')).toBe(true);
      for (const car of state.cars) {
        expect(car.fuel).toBeGreaterThanOrEqual(0);
        expect(car.tyre.wear).toBeLessThanOrEqual(1);
        expect(Number.isFinite(car.totalTime)).toBe(true);
      }
      // A IA cumpre a regra dos dois compostos e administra o combustível.
      expect(result.entries.filter((e) => e.dnfReason === 'fuel')).toHaveLength(0);
      for (const car of state.cars.filter((c) => c.status === 'running')) expect(new Set(car.compoundsUsed).size).toBeGreaterThanOrEqual(2);
      expect(finishers.every((e) => e.pitStops >= 1)).toBe(true);
      expect(result.entries.reduce((s, e) => s + e.points, 0)).toBeLessThanOrEqual(102);
    }
  });

  it('as punições em tempo entram no tempo final e reordenam a classificação', () => {
    let checked = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const state = simulateRemainingRace(f1.start(seed), f1.ctx, AUTO);
      const result = finalizeRace(state, f1.ctx.category);
      for (const entry of result.entries.filter((e) => e.status === 'finished' && e.penaltySeconds > 0)) {
        const car = state.cars.find((c) => c.driverId === entry.driverId)!;
        expect(entry.totalTime).toBeCloseTo(car.totalTime + entry.penaltySeconds, 2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('parada pedida pelo jogador troca o composto e custa o tempo do pit lane', () => {
    let s = f1.start(21);
    for (let i = 0; i < 5; i++) s = stepRaceLap(s, f1.ctx, { mode: 'balanced', skipPlannedStop: true });
    const before = s.cars.find((c) => c.driverId === f1.playerId)!;
    const other: TyreCompound = before.tyre.compound === 'hard' ? 'medium' : 'hard';
    s = stepRaceLap(s, f1.ctx, { mode: 'balanced', pit: other });
    const after = s.cars.find((c) => c.driverId === f1.playerId)!;
    expect(after.pitStops).toBe(before.pitStops + 1);
    expect(after.tyre).toEqual({ compound: other, wear: 0, age: 0 });
    expect(after.compoundsUsed).toContain(other);
    if (s.neutralization.type === 'none') expect(after.lastLap! - before.lastLap!).toBeGreaterThan(f1Rules.pitLaneLoss * 0.9);
    expect(s.events.some((e) => e.type === 'pit' && e.driverId === f1.playerId)).toBe(true);
  });

  it('sem parar e com um só composto, o jogador leva a punição da regra dos dois compostos', () => {
    let state = f1.start(4, DRY, { startCompound: 'hard', stops: [] });
    while (!isRaceFinished(state)) state = stepRaceLap(state, f1.ctx, { mode: 'conservative' });
    const car = state.cars.find((c) => c.driverId === f1.playerId)!;
    if (car.status === 'running' && car.compoundsUsed.length === 1) {
      const entry = finalizeRace(state, f1.ctx.category).entries.find((e) => e.driverId === f1.playerId)!;
      expect(entry.penaltySeconds).toBeGreaterThanOrEqual(RACE.COMPOUND_RULE_PENALTY);
    } else {
      // Uma bandeira vermelha troca os pneus de todos: a regra passa a estar cumprida.
      expect(state.redFlags > 0 || car.status === 'dnf').toBe(true);
    }
  });

  it('atacar a corrida inteira sem poupar acaba com o combustível; o piloto automático chega ao fim', () => {
    let empty = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = f1.start(seed);
      while (!isRaceFinished(s)) s = stepRaceLap(s, f1.ctx, { mode: 'aggressive' });
      const manual = s.cars.find((c) => c.driverId === f1.playerId)!;
      // Só conta quando não houve neutralização longa, que economiza combustível.
      if (manual.dnfReason === 'fuel') empty++;
      const auto = simulateRemainingRace(f1.start(seed), f1.ctx, { mode: 'aggressive', auto: true }).cars.find((c) => c.driverId === f1.playerId)!;
      expect(auto.dnfReason).not.toBe('fuel');
    }
    expect(empty).toBeGreaterThan(0);
  });

  it('atrás do safety car ninguém ultrapassa na pista e o pelotão se reagrupa', () => {
    const start = runUntil(f1.start(1), f1, (s) => s.neutralization.type === 'sc');
    expect(start.neutralization.type).toBe('sc');
    const spreadBefore = start.cars.filter((c) => c.status === 'running').slice(-1)[0]!.totalTime - start.cars[0]!.totalTime;
    let s = start;
    let scLaps = 0;
    while (s.neutralization.type === 'sc' && !isRaceFinished(s)) {
      const orderBefore = s.cars.filter((c) => c.status === 'running').map((c) => c.driverId);
      const overtakesBefore = s.cars.reduce((sum, c) => sum + c.overtakes, 0);
      const next = stepRaceLap(s, f1.ctx, AUTO);
      const pitted = new Set(next.events.filter((e) => e.lap === next.currentLap && e.type === 'pit').map((e) => e.driverId));
      const stillRunning = new Set(next.cars.filter((c) => c.status === 'running').map((c) => c.driverId));
      const keep = (ids: string[]) => ids.filter((id) => !pitted.has(id) && stillRunning.has(id));
      expect(keep(next.cars.map((c) => c.driverId))).toEqual(keep(orderBefore));
      expect(next.cars.reduce((sum, c) => sum + c.overtakes, 0)).toBe(overtakesBefore);
      s = next;
      scLaps++;
    }
    expect(scLaps).toBeGreaterThanOrEqual(2);
    const running = s.cars.filter((c) => c.status === 'running');
    expect(running.slice(-1)[0]!.totalTime - running[0]!.totalTime).toBeLessThan(spreadBefore);
    expect(s.events.some((e) => e.type === 'safetyCar')).toBe(true);
  });

  it('sob safety car virtual as posições ficam congeladas', () => {
    let s = runUntil(f1.start(6), f1, (x) => x.neutralization.type === 'vsc');
    expect(s.neutralization.type).toBe('vsc');
    const order = s.cars.filter((c) => c.status === 'running').map((c) => c.driverId);
    s = stepRaceLap(s, f1.ctx, AUTO);
    const pitted = new Set(s.events.filter((e) => e.lap === s.currentLap && e.type === 'pit').map((e) => e.driverId));
    const running = new Set(s.cars.filter((c) => c.status === 'running').map((c) => c.driverId));
    const keep = (ids: string[]) => ids.filter((id) => !pitted.has(id) && running.has(id));
    expect(keep(s.cars.map((c) => c.driverId))).toEqual(keep(order));
  });

  it('bandeira vermelha: reagrupa, repara e relarga parado; no fim da prova, encerra', () => {
    const restarted = runUntil(f1.start(2), f1, (s) => s.restart === 'standing');
    expect(restarted.restart).toBe('standing');
    expect(restarted.redFlags).toBe(1);
    const running = restarted.cars.filter((c) => c.status === 'running');
    expect(running.every((c) => c.damage === 0 && c.tyre.age === 0)).toBe(true);
    expect(running.slice(-1)[0]!.totalTime - running[0]!.totalTime).toBeLessThan(running.length * 0.3);
    const after = stepRaceLap(restarted, f1.ctx, AUTO);
    expect(after.events.some((e) => e.type === 'restart' && e.lap === after.currentLap)).toBe(true);

    const ended = simulateRemainingRace(f1.start(281), f1.ctx, AUTO);
    expect(ended.endedEarly).toBe(true);
    expect(ended.currentLap).toBeLessThan(ended.totalLaps);
    expect(ended.currentLap / ended.totalLaps).toBeGreaterThanOrEqual(RACE.RED_FLAG_END_PROGRESS);
    expect(finalizeRace(ended, f1.ctx.category).totalLaps).toBe(ended.currentLap);
  });

  it('ordem de equipe: obedecer troca as posições; ignorar fica registrado', () => {
    const pending = runUntil(f1.start(2), f1, (s) => s.pendingTeamOrder !== null);
    expect(pending.pendingTeamOrder).not.toBeNull();
    const favoured = pending.pendingTeamOrder!.favouredDriverId;
    const index = (s: RaceSimState, id: string) => s.cars.findIndex((c) => c.driverId === id);
    expect(index(pending, f1.playerId)).toBe(index(pending, favoured) - 1);

    const obeyed = stepRaceLap(pending, f1.ctx, { mode: 'balanced', auto: true, teamOrder: 'obey' });
    const ignored = stepRaceLap(pending, f1.ctx, { mode: 'balanced', auto: true, teamOrder: 'ignore' });
    expect(obeyed.teamOrders.slice(-1)[0]).toMatchObject({ askedDriverId: f1.playerId, favouredDriverId: favoured, obeyed: true });
    expect(ignored.teamOrders.slice(-1)[0]).toMatchObject({ askedDriverId: f1.playerId, obeyed: false });
    expect(obeyed.pendingTeamOrder).toBeNull();
    expect(finalizeRace(simulateRemainingRace(obeyed, f1.ctx, AUTO), f1.ctx.category).teamOrders.some((o) => o.askedDriverId === f1.playerId && o.obeyed)).toBe(
      true,
    );
  });

  it('quando a chuva chega, os carros trocam para pneus de chuva', () => {
    const spa = raceSetup('f1', 'spa');
    const state = simulateRemainingRace(spa.start(6), spa.ctx, AUTO);
    expect(state.forecast.kind).toBe('rain');
    expect(state.events.some((e) => e.type === 'weather')).toBe(true);
    const finished = state.cars.filter((c) => c.status === 'running');
    expect(finished.filter((c) => c.compoundsUsed.some((x) => TYRES[x].rain)).length).toBeGreaterThan(finished.length * 0.8);
  });
});

describe('todas as categorias', () => {
  it('cada categoria simula uma corrida válida, respeitando as próprias regras', () => {
    for (const category of CATEGORIES) {
      const setup = raceSetup(category.id);
      for (const seed of [1, 2, 3]) {
        const state = simulateRemainingRace(setup.start(seed), setup.ctx, AUTO);
        const result = finalizeRace(state, category);
        expect(result.entries).toHaveLength(20);
        expect(state.totalLaps).toBe(raceLaps(setup.ctx.track, category));
        if (!category.race.pitStops) expect(result.entries.every((e) => e.pitStops === 0)).toBe(true);
        if (!category.race.safetyCar) expect(result.safetyCars).toBe(0);
        if (!category.race.virtualSafetyCar) expect(result.virtualSafetyCars).toBe(0);
        if (!category.race.redFlag) expect(result.redFlags).toBe(0);
        if (!category.race.teamOrders) expect(result.teamOrders).toHaveLength(0);
        if (!category.race.fuel) expect(result.entries.every((e) => e.dnfReason !== 'fuel')).toBe(true);
        const winner = result.entries[0]!;
        expect(winner.totalTime / state.currentLap).toBeGreaterThan(referenceLapTime(setup.ctx.track, category) * 0.98);
      }
    }
  });

  it('um F1 é mais rápido que um F2, que é mais rápido que um F3, na mesma pista', () => {
    const lap = (id: 'f1' | 'f2' | 'f3') => referenceLapTime(getTrack('monza'), getCategory(id));
    expect(lap('f1')).toBeLessThan(lap('f2'));
    expect(lap('f2')).toBeLessThan(lap('f3'));
  });
});

describe('classificação eliminatória e punições de grid', () => {
  const participants = f1.drivers.map((driver) => ({
    driver,
    team: f1.ctx.teams[driver.teamId!]!,
    approach: 'balanced' as const,
    modifiers: NEUTRAL_MODIFIERS,
  }));
  const category = getCategory('f1');

  it('elimina um quarto do grid em cada uma das duas primeiras fases', () => {
    const q = simulateQualifying(participants, f1.ctx.track, DRY, 99, category);
    expect(q.entries.map((e) => e.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(q.entries.slice(15).every((e) => e.eliminatedIn === 'Q1')).toBe(true);
    expect(q.entries.slice(10, 15).every((e) => e.eliminatedIn === 'Q2')).toBe(true);
    expect(q.entries.slice(0, 10).every((e) => e.eliminatedIn === undefined)).toBe(true);
    expect(q.entries[0]!.attempts).toHaveLength(6);
    expect(q.entries[19]!.attempts).toHaveLength(2);
  });

  it('a punição de grid desloca o punido para trás', () => {
    const clean = simulateQualifying(participants, f1.ctx.track, DRY, 99, category);
    const pole = clean.entries[0]!.driverId;
    const punished = simulateQualifying(participants, f1.ctx.track, DRY, 99, category, { [pole]: 5 });
    const entry = punished.entries.find((e) => e.driverId === pole)!;
    expect(entry.position).toBe(6);
    expect(entry.gridPenalty).toBe(5);
    expect(punished.entries[0]!.driverId).toBe(clean.entries[1]!.driverId);
  });
});
