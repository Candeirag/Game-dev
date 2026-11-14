/**
 * Apresentação da corrida, quadro a quadro: a formação dos carros na pista.
 *
 * A linha do tempo diz onde cada carro está ao longo da volta; a cena decide o
 * lado da pista e um pequeno recuo para dois carros não se sobreporem. Estes
 * testes reproduzem corridas a 60 quadros por segundo e conferem que o
 * resultado na tela é contínuo e cabe na pista.
 */
import { describe, expect, it } from 'vitest';
import type { CategoryId, Driver, Team } from '@/domain/schemas';
import { getTrack } from '@/data/tracks';
import { CAR_SIZE, createSceneMemory, driverCode, placeCars } from '@/ui/race/raceScene';
import { LAP_SECONDS } from '@/ui/race/useRacePlayback';
import { CIRCUIT, buildCategoryField, buildRaceTimeline, circuitForRace, createRaceSim, getCategory, isRaceFinished, lapInfoAt, standingsAt, stepRaceLap, type RaceContext, type RaceSimState } from './engineApi';

function fieldRace(categoryId: CategoryId, trackId: string, seed: number, wetness = 0) {
  const category = getCategory(categoryId);
  const field = buildCategoryField(categoryId, seed, 1);
  const starters = field.drivers.filter((d) => d.role !== 'reserve');
  const ctx: RaceContext = {
    track: getTrack(trackId),
    category,
    drivers: Object.fromEntries(starters.map((d): [string, Driver] => [d.id, d])),
    teams: Object.fromEntries(field.teams.map((t): [string, Team] => [t.id, t])),
  };
  const grid = starters.map((d) => ({ driverId: d.id, teamId: d.teamId ?? '', modifiers: { setupScore: 0.6, qualifyingBonus: 0, tyreWearFactor: 1 } }));
  const weather = { condition: wetness >= 0.5 ? ('wet' as const) : ('dry' as const), wetness, trackTemp: 30 };
  const states: RaceSimState[] = [createRaceSim(grid, ctx, weather, seed, starters[0]!.id)];
  while (!isRaceFinished(states.at(-1)!)) states.push(stepRaceLap(states.at(-1)!, ctx, { mode: 'balanced', auto: true }));
  return { ctx, timeline: buildRaceTimeline(states, ctx)!, circuit: circuitForRace(ctx), final: states.at(-1)! };
}

interface FrameStats {
  frames: number;
  /** Maior deslocamento de um carro entre dois quadros, em unidades de mundo. */
  worstJump: number;
  /** Quadros × pares de carros na pista, e quantos deles estavam sobrepostos. */
  pairs: number;
  overlapping: number;
  /** Maior distância de um carro em disputa ao eixo da pista. */
  widest: number;
}

/** Reproduz um trecho da corrida a 60 quadros por segundo, na velocidade dada. */
function play(race: ReturnType<typeof fieldRace>, from: number, to: number, speed: number): FrameStats {
  const { timeline, circuit } = race;
  const memory = createSceneMemory();
  const size = CAR_SIZE[circuit.style];
  const dt = 1 / 60;
  const rate = (timeline.referenceLap / LAP_SECONDS) * speed;
  const restarts = timeline.suspensions.filter((s) => !s.final).map((s) => s.time);
  const stats: FrameStats = { frames: 0, worstJump: 0, pairs: 0, overlapping: 0, widest: 0 };
  let previous = new Map<string, { x: number; y: number }>();
  for (let t = from; t <= to; t += dt * rate) {
    const info = lapInfoAt(timeline, t);
    const placed = placeCars(standingsAt(timeline, circuit, t), circuit, memory, dt, info?.flag === 'sc' && t < info.end);
    const regrid = restarts.some((r) => r > t - dt * rate && r <= t);
    const positions = new Map<string, { x: number; y: number }>();
    for (const car of placed) {
      positions.set(car.row.driverId, { x: car.x, y: car.y });
      const before = previous.get(car.row.driverId);
      if (before && !regrid) stats.worstJump = Math.max(stats.worstJump, Math.hypot(car.x - before.x, car.y - before.y));
      if (car.row.state === 'racing' && !car.row.sample.inPitLane) stats.widest = Math.max(stats.widest, Math.abs(car.lateral));
    }
    const racing = placed.filter((c) => c.row.state === 'racing' && !c.row.sample.inPitLane);
    for (let i = 0; i < racing.length; i++) {
      for (let j = i + 1; j < racing.length; j++) {
        const a = racing[i]!;
        const b = racing[j]!;
        stats.pairs++;
        // Sobrepostos: menos de 70% de um carro de distância, na mesma faixa.
        const along = Math.abs((((a.along - b.along) % 1) + 1.5) % 1 - 0.5) * circuit.length;
        if (along < size.length * 0.7 && Math.abs(a.lateral - b.lateral) < size.width * 0.6) stats.overlapping++;
      }
    }
    previous = positions;
    stats.frames++;
  }
  return stats;
}

describe('formação dos carros na pista', () => {
  it('largada e primeiras voltas de kart: sem saltos, sem sobreposição, todos dentro da pista', () => {
    const race = fieldRace('kart-regional', 'vale-do-sol', 11);
    const stats = play(race, 0, race.timeline.laps[2]!.end, 1);
    expect(stats.frames).toBeGreaterThan(3000);
    // Em 1×, a volta dura 24 s: um carro anda cerca de 1,5 unidade por quadro (2 nas retas).
    expect(stats.worstJump).toBeLessThan(4.5);
    expect(stats.widest).toBeLessThanOrEqual(CIRCUIT.TRACK_WIDTH / 2 - CAR_SIZE.kart.width / 2);
    // Com 20 karts em 5 segundos de pista, a formação em duas filas quase elimina a sobreposição.
    expect(stats.overlapping / stats.pairs).toBeLessThan(0.004);
  });

  it('F1 com chuva, safety car e relargada: a imagem continua contínua em 1× e em 8×', () => {
    const race = fieldRace('f1', 'suzuka', 41, 1);
    expect(race.final.safetyCars).toBeGreaterThan(0);
    expect(race.final.redFlags).toBeGreaterThan(0);
    const slow = play(race, 0, race.timeline.laps[3]!.end, 1);
    expect(slow.worstJump).toBeLessThan(5);
    expect(slow.widest).toBeLessThanOrEqual(CIRCUIT.TRACK_WIDTH / 2 - CAR_SIZE.formula.width / 2);
    expect(slow.overlapping / slow.pairs).toBeLessThan(0.006);
    // Em 8× cada quadro avança oito vezes mais; o limite de deslocamento cresce na mesma proporção.
    const fast = play(race, 0, race.timeline.endTime!, 8);
    expect(fast.frames).toBeGreaterThan(5000);
    expect(fast.worstJump).toBeLessThan(5 * 8);
    expect(fast.widest).toBeLessThanOrEqual(CIRCUIT.TRACK_WIDTH / 2 - CAR_SIZE.formula.width / 2);
  });

  it('atrás do safety car os carros ficam em fila única', () => {
    const race = fieldRace('f1', 'suzuka', 41, 1);
    const sc = race.timeline.laps.find((l) => l.flag === 'sc' && race.timeline.laps[l.lap - 2]?.flag === 'sc');
    expect(sc).toBeDefined();
    const memory = createSceneMemory();
    const t = sc!.start + (sc!.end - sc!.start) * 0.6;
    let placed = placeCars(standingsAt(race.timeline, race.circuit, t), race.circuit, memory, 1 / 60, true);
    for (let i = 0; i < 120; i++) placed = placeCars(standingsAt(race.timeline, race.circuit, t), race.circuit, memory, 1 / 60, true);
    // Fila na ordem em que os carros estão na pista, a partir do líder (um retardatário pode estar no meio dela).
    const onTrack = placed.filter((c) => c.row.state === 'racing' && !c.row.sample.inPitLane);
    const leader = onTrack.find((c) => c.row.position === Math.min(...onTrack.map((o) => o.row.position)))!;
    const behindLeader = (c: (typeof onTrack)[number]) => (((leader.along - c.along) % 1) + 1) % 1;
    const queue = [...onTrack].sort((a, b) => behindLeader(a) - behindLeader(b));
    expect(queue.length).toBeGreaterThan(10);
    for (let i = 1; i < queue.length; i++) {
      const gap = (behindLeader(queue[i]!) - behindLeader(queue[i - 1]!)) * race.circuit.length;
      // Um carro atrás do outro, nunca lado a lado.
      expect(gap, `fila ${i}`).toBeGreaterThanOrEqual(CAR_SIZE.formula.length * 1.02);
      expect(Math.abs(queue[i]!.lateral - queue[i - 1]!.lateral), `fila ${i}`).toBeLessThan(CAR_SIZE.formula.width);
    }
  });

  it('a sigla do piloto usa só letras', () => {
    expect(driverCode('De Groot')).toBe('DEG');
    expect(driverCode("O'Brien")).toBe('OBR');
    expect(driverCode('Kjær')).toBe('KJÆ');
    expect(driverCode('Li')).toBe('LI');
  });
});
