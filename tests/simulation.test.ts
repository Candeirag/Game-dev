import { describe, expect, it } from 'vitest';
import type { DriverAttributes, SessionWeather } from '@/domain/schemas';
import { TRACKS } from '@/data/tracks';
import { TEAMS } from '@/data/teams';
import { hashSeed } from '@/engine/rng';
import { generateEventWeather, normalCdf } from '@/engine/simulation/weather';
import { driverPaceRating, errorProbability, expectedLapTime, lapNoiseSigma, tyreWearPerLap } from '@/engine/simulation/performance';
import { getCategory } from '@/data/categories';
import {
  buildRaceContext,
  conditionEffects,
  createWeekendRace,
  finalizeRace,
  isRaceFinished,
  runPractice,
  runQualifying,
  simulateRemainingRace,
  startWeekend,
  stepRaceLap,
} from '@/engine';
import { newCareer } from './helpers';

const KART = getCategory('kart-regional');
const AUTO = { mode: 'balanced', auto: true } as const;

const DRY: SessionWeather = { condition: 'dry', wetness: 0, trackTemp: 30 };
const WET: SessionWeather = { condition: 'wet', wetness: 1, trackTemp: 18 };
const track = TRACKS[0]!;
const car = TEAMS[0]!.car;
const base: DriverAttributes = {
  pace: 70,
  consistency: 70,
  overtaking: 70,
  defending: 70,
  focus: 70,
  racecraft: 70,
  tyreManagement: 70,
  wetSkill: 70,
  experience: 70,
};
const lap = (a: DriverAttributes, extra: Partial<Parameters<typeof expectedLapTime>[0]> = {}) =>
  expectedLapTime({ attributes: a, car, track, weather: DRY, setupScore: 0.5, tyreWear: 0, paceModifier: 0, ...extra });

describe('modelo de desempenho', () => {
  it('mais velocidade dá volta mais rápida', () => {
    expect(lap({ ...base, pace: 90 })).toBeLessThan(lap(base));
  });

  it('kart melhor dá volta mais rápida', () => {
    expect(lap(base, { car: { engine: 90, chassis: 90, reliability: 90 } })).toBeLessThan(lap(base, { car: { engine: 60, chassis: 60, reliability: 90 } }));
    // Na F1 (carFactor 4), a mesma diferença de equipamento pesa quatro vezes mais.
    const gap = (carFactor: number) =>
      lap(base, { car: { engine: 60, chassis: 60, reliability: 90 }, carFactor }) - lap(base, { car: { engine: 90, chassis: 90, reliability: 90 }, carFactor });
    expect(gap(4)).toBeCloseTo(gap(1) * 4, 6);
  });

  it('pneu gasto e pista molhada deixam a volta mais lenta', () => {
    expect(lap(base, { tyreWear: 0.8 })).toBeGreaterThan(lap(base));
    expect(lap(base, { weather: WET })).toBeGreaterThan(lap(base));
  });

  it('a diferença entre um piloto 60 e um 80 fica na escala do kart regional (0,1 a 0,4 s)', () => {
    const slow = { ...base, pace: 60, consistency: 60, racecraft: 60, focus: 60, experience: 60 };
    const fast = { ...base, pace: 80, consistency: 80, racecraft: 80, focus: 80, experience: 80 };
    const diff = lap(slow) - lap(fast);
    expect(diff).toBeGreaterThan(0.1);
    expect(diff).toBeLessThan(0.4);
  });

  it('na chuva, a nota de chuva passa a importar', () => {
    const rain = { ...base, wetSkill: 95 };
    const noRain = { ...base, wetSkill: 40 };
    expect(driverPaceRating(rain, DRY)).toBe(driverPaceRating(noRain, DRY));
    expect(driverPaceRating(rain, WET)).toBeGreaterThan(driverPaceRating(noRain, WET) + 20);
  });

  it('consistência reduz o ruído e os erros; o cansaço aumenta os dois', () => {
    expect(lapNoiseSigma({ ...base, consistency: 90 }, DRY, 0)).toBeLessThan(lapNoiseSigma({ ...base, consistency: 50 }, DRY, 0));
    expect(errorProbability({ ...base, consistency: 90 }, DRY, 0)).toBeLessThan(errorProbability({ ...base, consistency: 50 }, DRY, 0));
    expect(errorProbability(base, DRY, 1)).toBeGreaterThan(errorProbability(base, DRY, 0));
    expect(errorProbability(base, WET, 0.5)).toBeGreaterThan(errorProbability(base, DRY, 0.5));
  });

  it('a condição do piloto é neutra em 50 e ajuda ou atrapalha fora disso', () => {
    const neutral = conditionEffects({ form: 50, confidence: 50, morale: 50 }, null);
    expect(neutral).toEqual({ pace: 0, noise: 1, error: 1, attack: 0 });
    const high = conditionEffects({ form: 90, confidence: 90, morale: 90 }, null);
    const low = conditionEffects({ form: 10, confidence: 10, morale: 10 }, null);
    expect(high.pace).toBeLessThan(0);
    expect(low.pace).toBeGreaterThan(0);
    expect(high.error).toBeLessThan(1);
    expect(low.error).toBeGreaterThan(1);
    expect(high.attack).toBeGreaterThan(low.attack);
    const injured = conditionEffects({ form: 50, confidence: 50, morale: 50 }, { description: 'x', severity: 'minor', roundsRemaining: 1 });
    expect(injured.pace).toBeGreaterThan(0);
    expect(injured.error).toBeGreaterThan(1);
  });

  it('gestão de pneus reduz o desgaste', () => {
    expect(tyreWearPerLap({ ...base, tyreManagement: 90 }, track, DRY, 1, 1)).toBeLessThan(tyreWearPerLap({ ...base, tyreManagement: 40 }, track, DRY, 1, 1));
  });
});

describe('clima', () => {
  it('é determinístico pela semente', () => {
    expect(generateEventWeather(123, track)).toEqual(generateEventWeather(123, track));
  });

  it('a frequência de chuva respeita a climatologia de cada pista', () => {
    for (const t of TRACKS) {
      let rain = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) if (generateEventWeather(hashSeed('clima', t.id, i), t).race.condition !== 'dry') rain++;
      expect(Math.abs(rain / N - t.rainChance)).toBeLessThan(0.035);
    }
  });

  it('normalCdf é uma boa aproximação', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

function raceReady(seed = 2024) {
  let c = startWeekend(newCareer(seed));
  c = runPractice(c, 'setup');
  c = runQualifying(c, 'balanced');
  return c;
}

describe('fim de semana', () => {
  it('treino gera modificadores válidos para os 20 pilotos', () => {
    const c = runPractice(startWeekend(newCareer()), 'setup');
    const entries = c.weekend!.practice!.entries;
    expect(entries).toHaveLength(20);
    for (const e of entries) {
      expect(e.modifiers.setupScore).toBeGreaterThanOrEqual(0);
      expect(e.modifiers.setupScore).toBeLessThanOrEqual(1);
    }
    expect(c.weekend!.phase).toBe('qualifying');
  });

  it('o programa de acerto aumenta o setupScore do jogador sem mudar a sorte dos rivais', () => {
    const a = runPractice(startWeekend(newCareer()), 'setup').weekend!.practice!;
    const b = runPractice(startWeekend(newCareer()), 'longRun').weekend!.practice!;
    const pa = a.entries.find((e) => e.driverId === 'player')!;
    const pb = b.entries.find((e) => e.driverId === 'player')!;
    expect(pa.modifiers.setupScore).toBeGreaterThan(pb.modifiers.setupScore);
    expect(pb.modifiers.tyreWearFactor).toBeLessThan(1);
    const rival = (r: typeof a) => r.entries.find((e) => e.driverId === 'andrade');
    expect(rival(a)).toEqual(rival(b));
  });

  it('classificação gera um grid com posições únicas de 1 a 20', () => {
    const q = raceReady().weekend!.qualifying!;
    expect(q.entries.map((e) => e.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const times = q.entries.filter((e) => e.bestLap !== null).map((e) => e.bestLap!);
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });

  it('não permite pular fases', () => {
    const c = startWeekend(newCareer());
    expect(() => runQualifying(c, 'balanced')).toThrow();
    expect(() => createWeekendRace(c)).toThrow();
  });
});

describe('corrida', () => {
  it('é determinística: mesmas decisões, mesmo resultado', () => {
    const c = raceReady();
    const r1 = finalizeRace(simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), AUTO), KART);
    const r2 = finalizeRace(simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), AUTO), KART);
    expect(r1).toEqual(r2);
  });

  it('volta a volta produz o mesmo resultado que simular de uma vez', () => {
    const c = raceReady();
    const ctx = buildRaceContext(c);
    let s = createWeekendRace(c);
    while (!isRaceFinished(s)) s = stepRaceLap(s, ctx, AUTO);
    expect(s).toEqual(simulateRemainingRace(createWeekendRace(c), ctx, AUTO));
  });

  it('mantém invariantes: 20 classificados, posições únicas, tempos em ordem, pontos corretos', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const c = raceReady(seed);
      const result = finalizeRace(simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), { mode: 'aggressive', auto: true }), KART);
      expect(result.entries).toHaveLength(20);
      expect(new Set(result.entries.map((e) => e.driverId)).size).toBe(20);
      expect(result.entries.map((e) => e.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      const finishers = result.entries.filter((e) => e.status === 'finished');
      for (let i = 1; i < finishers.length; i++) expect(finishers[i]!.totalTime).toBeGreaterThanOrEqual(finishers[i - 1]!.totalTime);
      // Kart: sem paradas, sem safety car, sem combustível.
      expect(result.entries.every((e) => e.pitStops === 0)).toBe(true);
      expect(result.safetyCars + result.virtualSafetyCars + result.redFlags).toBe(0);
      for (const e of finishers) expect(e.lapsCompleted).toBe(result.totalLaps);
      // Abandonos ficam depois de todos os que terminaram.
      const firstDnf = result.entries.findIndex((e) => e.status === 'dnf');
      if (firstDnf >= 0) expect(result.entries.slice(firstDnf).every((e) => e.status === 'dnf')).toBe(true);
      const total = result.entries.reduce((s, e) => s + e.points, 0);
      // 101 pontos de corrida (se houver 10 classificados) + pole + volta mais rápida.
      expect(total).toBeLessThanOrEqual(103);
      expect(total).toBeGreaterThanOrEqual(1);
    }
  });

  it('o modo escolhido pelo jogador muda o desgaste de pneus', () => {
    const c = raceReady();
    const ctx = buildRaceContext(c);
    const start = createWeekendRace(c);
    const a = stepRaceLap(start, ctx, { mode: 'conservative' });
    const b = stepRaceLap(start, ctx, { mode: 'aggressive' });
    const player = (s: typeof a) => s.cars.find((x) => x.driverId === 'player')!;
    expect(player(a).tyre.wear).toBeLessThan(player(b).tyre.wear);
  });

  it('em média, o piloto mais forte termina na frente do mais fraco', () => {
    let strongAhead = 0;
    const N = 25;
    for (let seed = 1; seed <= N; seed++) {
      const c = raceReady(seed);
      const r = finalizeRace(simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), AUTO), KART);
      const pos = (id: string) => r.entries.find((e) => e.driverId === id)!.position;
      if (pos('andrade') < pos('moura')) strongAhead++;
    }
    expect(strongAhead / N).toBeGreaterThan(0.85);
  });
});
