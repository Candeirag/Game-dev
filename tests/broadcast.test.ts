/**
 * Transmissão visual da corrida: circuitos e linha do tempo.
 *
 * O ponto central destes testes é provar que a imagem é a corrida do motor:
 * a ordem dos carros na pista, no instante em que cada volta termina, tem de
 * ser a ordem que o motor calculou.
 */
import { describe, expect, it } from 'vitest';
import type { CategoryId, Driver, Team } from '@/domain/schemas';
import { CIRCUIT_LAYOUTS, type CircuitLayout } from '@/data/circuitLayouts';
import { KART_LAYOUTS } from '@/data/kartLayouts';
import { BR_KART_TRACKS, CIRCUITS, TRACKS, WORLD_KART_TRACKS, getTrack } from '@/data/tracks';
import {
  CIRCUIT,
  appendRaceLap,
  buildCategoryField,
  buildCircuit,
  buildRaceTimeline,
  circuitForRace,
  createRaceSim,
  createRaceTimeline,
  eventsUntil,
  finalizeRace,
  getCategory,
  isRaceFinished,
  paceAt,
  pitLateralAt,
  poseAt,
  sAtTau,
  safetyCarAt,
  sampleCar,
  standingsAt,
  stepRaceLap,
  tauAt,
  timeAtDistance,
  type RaceContext,
  type RaceSimState,
  type RaceTimeline,
} from './engineApi';
import { botCareer, playRound } from './helpers';
import { buildRaceContext, createWeekendRace, resolveEvent, runPractice, runQualifying, startWeekend } from './engineApi';

/** Corrida avulsa de uma categoria, com o grid na ordem das equipes. */
function fieldRace(categoryId: CategoryId, trackId: string, seed: number, wetness = 0): { ctx: RaceContext; states: RaceSimState[] } {
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
  const weather = { condition: wetness >= 0.5 ? ('wet' as const) : wetness > 0.05 ? ('damp' as const) : ('dry' as const), wetness, trackTemp: 30 };
  const playerId = starters[starters.length >> 1]!.id;
  const states = [createRaceSim(grid, ctx, weather, seed, playerId)];
  while (!isRaceFinished(states.at(-1)!)) states.push(stepRaceLap(states.at(-1)!, ctx, { mode: 'balanced', auto: true }));
  return { ctx, states };
}

const ALL_TRACKS = [
  ...[...BR_KART_TRACKS, ...WORLD_KART_TRACKS].map((track) => ({ track, style: 'kart' as const })),
  ...CIRCUITS.map((track) => ({ track, style: 'formula' as const })),
];

/**
 * Maior diferença, em metros, entre a distância em linha reta de dois pontos da volta no circuito do
 * jogo e no traçado de origem. Comparar distâncias dispensa saber o giro e o deslocamento do desenho.
 */
function shapeError(c: ReturnType<typeof buildCircuit>, layout: CircuitLayout): number {
  const n = layout.points.length / 2;
  const cumulative = [0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cumulative.push(cumulative[i]! + Math.hypot(layout.points[j * 2]! - layout.points[i * 2]!, layout.points[j * 2 + 1]! - layout.points[i * 2 + 1]!));
  }
  const sourceAt = (fraction: number) => {
    const target = fraction * cumulative[n]!;
    let i = 0;
    while (i < n - 1 && cumulative[i + 1]! < target) i++;
    const t = (target - cumulative[i]!) / (cumulative[i + 1]! - cumulative[i]! || 1);
    const j = (i + 1) % n;
    return { x: layout.points[i * 2]! + (layout.points[j * 2]! - layout.points[i * 2]!) * t, y: layout.points[i * 2 + 1]! + (layout.points[j * 2 + 1]! - layout.points[i * 2 + 1]!) * t };
  };
  let worst = 0;
  for (let a = 0; a < 40; a++) {
    for (let b = a + 1; b < 40; b++) {
      const p = poseAt(c, a / 40);
      const q = poseAt(c, b / 40);
      const sp = sourceAt(a / 40);
      const sq = sourceAt(b / 40);
      worst = Math.max(worst, Math.abs(Math.hypot(p.x - q.x, p.y - q.y) / c.unitsPerMetre - Math.hypot(sp.x - sq.x, sp.y - sq.y)));
    }
  }
  return worst;
}

describe('circuitos', () => {
  it('toda pista do jogo tem um traçado fechado, contínuo e sem trechos sobrepostos', () => {
    expect(ALL_TRACKS).toHaveLength(TRACKS.length);
    for (const { track, style } of ALL_TRACKS) {
      const c = buildCircuit(track, style);
      expect(c.count, track.id).toBeGreaterThan(600);
      let worstSpacing = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < c.count; i++) {
        const j = (i + 1) % c.count;
        worstSpacing = Math.max(worstSpacing, Math.abs(Math.hypot(c.x[j]! - c.x[i]!, c.y[j]! - c.y[i]!) - c.step));
        minX = Math.min(minX, c.x[i]!);
        maxX = Math.max(maxX, c.x[i]!);
        minY = Math.min(minY, c.y[i]!);
        maxY = Math.max(maxY, c.y[i]!);
      }
      // Amostras igualmente espaçadas, inclusive no fechamento da volta.
      expect(worstSpacing, track.id).toBeLessThan(0.05);
      // Dentro da área de desenho, com folga para a largura da pista e as zebras.
      expect(minX, track.id).toBeGreaterThan(CIRCUIT.TRACK_WIDTH);
      expect(maxX, track.id).toBeLessThan(c.width - CIRCUIT.TRACK_WIDTH);
      expect(minY, track.id).toBeGreaterThan(CIRCUIT.TRACK_WIDTH);
      expect(maxY, track.id).toBeLessThan(c.height - CIRCUIT.TRACK_WIDTH);
      // Dois trechos distantes ao longo da volta nunca se encostam. Nos traçados reais as pernas de
      // um grampo ficam coladas (só se comparam trechos a mais de 330 unidades um do outro pela
      // pista), e o viaduto é o único ponto em que o traçado se cruza.
      let closest = Infinity;
      const nearBridge = (i: number) => c.bridges.some((b) => [b.over, b.under].some(([from, to]) => i / c.count > from - 0.012 && i / c.count < to + 0.012));
      for (let i = 0; i < c.count; i += 5) {
        for (let j = i + 5; j < c.count; j += 5) {
          const arc = Math.min(j - i, c.count - (j - i)) * c.step;
          if (arc >= (c.real ? 330 : 160) && !(nearBridge(i) && nearBridge(j))) closest = Math.min(closest, Math.hypot(c.x[i]! - c.x[j]!, c.y[i]! - c.y[j]!));
        }
      }
      expect(closest, track.id).toBeGreaterThan(CIRCUIT.TRACK_WIDTH + (c.real ? 3 : 8));
      expect(c.corners.length, track.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('os autódromos reproduzem o traçado real: forma, comprimento, sentido e largada', () => {
    expect(Object.keys(CIRCUIT_LAYOUTS).sort()).toEqual(CIRCUITS.map((t) => t.id).sort());
    for (const track of CIRCUITS) {
      const layout = CIRCUIT_LAYOUTS[track.id]!;
      const c = buildCircuit(track, 'formula');
      expect(c.real, track.id).toBe(true);
      // Comprimento: o do traçado de origem, que é o da pista no jogo (diferença de menos de 1%).
      expect(Math.abs(layout.length / track.lengthMeters - 1), track.id).toBeLessThan(0.01);
      expect(Math.abs(c.length / c.unitsPerMetre / layout.length - 1), track.id).toBeLessThan(0.012);

      // Diferença máxima de 25 m em distâncias de até 2 km (a curva suave arredonda os cantos do traçado de origem).
      expect(shapeError(c, layout), track.id).toBeLessThan(25);

      // Sentido da corrida (na tela, y cresce para baixo: área positiva = horário). O traçado em oito fica de fora.
      let area = 0;
      for (let i = 0; i < c.count; i++) area += c.x[i]! * c.y[(i + 1) % c.count]! - c.x[(i + 1) % c.count]! * c.y[i]!;
      expect(c.clockwise).toBe(layout.clockwise);
      if (!layout.bridge) expect(area > 0, track.id).toBe(layout.clockwise);
      // Boxes do lado de dentro: à direita de quem corre no sentido horário.
      expect(Math.sign(c.pit.offset), track.id).toBe(layout.clockwise ? 1 : -1);
      // Zonas de ultrapassagem nas retas mais longas.
      expect(c.zones.length, track.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('os kartódromos reproduzem o traçado mapeado: forma, sentido, escala e largada numa reta', () => {
    const karts = [...BR_KART_TRACKS, ...WORLD_KART_TRACKS];
    // Só a pista de Al Ain não tem traçado mapeado e continua gerada por regras.
    expect(Object.keys(KART_LAYOUTS).sort()).toEqual(karts.map((t) => t.id).filter((id) => id !== 'al-ain').sort());
    expect(buildCircuit(getTrack('al-ain'), 'kart').real).toBe(false);
    for (const track of karts) {
      const layout = KART_LAYOUTS[track.id];
      if (!layout) continue;
      const c = buildCircuit(track, 'kart');
      expect(c.real, track.id).toBe(true);
      // Um kartódromo de verdade tem entre 800 m e 1,7 km.
      expect(layout.length, track.id).toBeGreaterThan(780);
      expect(layout.length, track.id).toBeLessThan(1750);
      // Escala: de 3 a 5,7 unidades por metro, a mesma nas duas direções; o comprimento confere.
      expect(c.unitsPerMetre, track.id).toBeGreaterThanOrEqual(3);
      expect(c.unitsPerMetre, track.id).toBeLessThanOrEqual(5.7);
      expect(Math.abs(c.length / c.unitsPerMetre / layout.length - 1), track.id).toBeLessThan(0.03);
      // Forma: diferença máxima de 6 m (o arredondamento das junções tira um pouco dos cantos vivos).
      expect(shapeError(c, layout), track.id).toBeLessThan(6);
      // Sentido da corrida, igual ao do traçado de origem.
      let area = 0;
      for (let i = 0; i < c.count; i++) area += c.x[i]! * c.y[(i + 1) % c.count]! - c.x[(i + 1) % c.count]! * c.y[i]!;
      expect(c.clockwise, track.id).toBe(layout.clockwise);
      expect(area > 0, track.id).toBe(layout.clockwise);
      // A largada fica numa reta: quase sem mudança de direção nos 12 m antes e depois da linha.
      const reach = Math.round((12 * c.unitsPerMetre) / c.step);
      let turn = 0;
      for (let k = -reach; k < reach; k++) turn += Math.abs(c.curvature[((k % c.count) + c.count) % c.count]!) * c.step;
      expect(turn, track.id).toBeLessThan(0.3);
      // Kartódromo não tem zona de ultrapassagem marcada.
      expect(c.zones, track.id).toHaveLength(0);
    }
    // A pista inglesa passa por cima de si mesma; as outras não têm viaduto.
    expect(buildCircuit(getTrack('pfi'), 'kart').bridges).toHaveLength(1);
    expect(buildCircuit(getTrack('garda'), 'kart').bridges).toHaveLength(0);
  });

  it('o traçado em oito passa por cima de si mesmo num viaduto, e só nele', () => {
    const c = buildCircuit(getTrack('suzuka'), 'formula');
    expect(c.bridges).toHaveLength(1);
    const { over, under } = c.bridges[0]!;
    // O trecho de cima vem depois na volta (a reta oposta passa sobre o trecho antes do grampo).
    expect(under[0]).toBeGreaterThan(0.3);
    expect(under[1]).toBeLessThan(0.5);
    expect(over[0]).toBeGreaterThan(0.7);
    expect(over[1]).toBeLessThan(0.9);
    const a = poseAt(c, (under[0] + under[1]) / 2);
    const b = poseAt(c, (over[0] + over[1]) / 2);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(4);
    // As duas pistas se cruzam em ângulo aberto (não correm lado a lado).
    const angle = Math.abs(Math.sin(a.heading - b.heading));
    expect(angle).toBeGreaterThan(0.5);
    for (const other of CIRCUITS.filter((t) => t.id !== 'suzuka')) expect(buildCircuit(other, 'formula').bridges, other.id).toHaveLength(0);
  });

  it('o traçado é sempre o mesmo e cada pista tem o seu', () => {
    const a = buildCircuit(getTrack('monza'), 'formula');
    const b = buildCircuit(getTrack('monza'), 'formula');
    expect(a).toBe(b);
    const shapes = new Set(ALL_TRACKS.map(({ track, style }) => buildCircuit(track, style).x.filter((_, i) => i % 40 === 0).map((v) => v.toFixed(0)).join(',')));
    expect(shapes.size).toBe(ALL_TRACKS.length);
  });

  it('o perfil de velocidade fecha a volta: tempo e posição são funções inversas', () => {
    for (const { track, style } of ALL_TRACKS) {
      const c = buildCircuit(track, style);
      expect(c.tau[0]).toBe(0);
      expect(c.tau[c.count]).toBeCloseTo(1, 9);
      for (const s of [0, 0.13, 0.5, 0.87, 0.999, -0.04, 1.3]) expect(sAtTau(c, tauAt(c, s)), `${track.id} ${s}`).toBeCloseTo(s, 5);
      // Os carros andam mais devagar nas curvas do que na reta dos boxes.
      const slowest = Math.min(...c.corners.map((k) => paceAt(c, (k.from + k.to) / 2)));
      expect(slowest, track.id).toBeLessThan(paceAt(c, 0) * 0.85);
    }
  });

  it('o pit lane fica do lado de dentro da reta e a posição acompanha o traçado', () => {
    for (const { track, style } of ALL_TRACKS) {
      const c = buildCircuit(track, style);
      expect(c.pit.entry).toBeLessThan(c.pit.entryEnd);
      expect(c.pit.exitStart).toBeLessThan(c.pit.exit);
      expect(pitLateralAt(c, 0)).toBe(c.pit.offset);
      expect(pitLateralAt(c, 0.5)).toBe(0);
      expect(Math.abs(c.pit.offset)).toBe(CIRCUIT.PIT_OFFSET);
      // Um carro com deslocamento lateral continua a meia largura de pista do eixo.
      const centre = poseAt(c, 0.4);
      const side = poseAt(c, 0.4, 9);
      expect(Math.hypot(side.x - centre.x, side.y - centre.y)).toBeCloseTo(9, 6);
    }
  });
});

/** Confere, volta a volta, que a pista mostra a ordem do motor. */
function expectFaithful(states: RaceSimState[], ctx: RaceContext): RaceTimeline {
  const timeline = buildRaceTimeline(states, ctx)!;
  expect(timeline.lapsBuilt).toBe(states.length - 1);
  for (let lap = 1; lap < states.length; lap++) {
    const state = states[lap]!;
    const redFlag = state.redFlags > states[lap - 1]!.redFlags;
    const running = state.cars.filter((c) => c.status === 'running');
    for (const [index, car] of running.entries()) {
      const record = timeline.cars[car.driverId]!.laps.find((l) => l.lap === lap)!;
      expect(record.position).toBe(index + 1);
      // O carro cruza a linha no tempo acumulado do motor (a volta de bandeira vermelha é reagrupada depois).
      if (!redFlag) expect(record.t1).toBeCloseTo(car.totalTime, 6);
      expect(record.t1).toBeGreaterThan(record.t0);
      const first = record.segments[0]!;
      const last = record.segments.at(-1)!;
      expect(first.t0).toBeCloseTo(record.t0, 9);
      expect(last.t1).toBeCloseTo(record.t1, 9);
      expect(last.s1).toBe(1);
      for (let k = 1; k < record.segments.length; k++) {
        expect(record.segments[k]!.t0).toBeCloseTo(record.segments[k - 1]!.t1, 9);
        expect(record.segments[k]!.s0).toBeCloseTo(record.segments[k - 1]!.s1, 9);
        expect(record.segments[k]!.t1).toBeGreaterThanOrEqual(record.segments[k]!.t0);
      }
    }
    // Numa troca por ordem de equipe o motor mantém quem cedeu à frente do carro seguinte mesmo
    // com centésimos a mais no tempo; a volta seguinte resolve. Fora isso, a ordem é estrita.
    const teamOrder = state.events.some((e) => e.lap === lap && e.type === 'teamOrder');
    if (redFlag || teamOrder || running.length === 0) continue;
    // Ordem em que os carros cruzam a linha = ordem do motor.
    const crossing = [...running].sort((a, b) => timeline.cars[a.driverId]!.laps.find((l) => l.lap === lap)!.t1 - timeline.cars[b.driverId]!.laps.find((l) => l.lap === lap)!.t1);
    expect(crossing.map((c) => c.driverId)).toEqual(running.map((c) => c.driverId));
  }
  return timeline;
}

describe('linha do tempo da corrida', () => {
  it('kart: os carros cruzam a linha na ordem e no tempo do motor, em todas as voltas', () => {
    for (const seed of [11, 12, 13]) {
      const { ctx, states } = fieldRace('kart-regional', 'vale-do-sol', seed);
      const timeline = expectFaithful(states, ctx);
      expect(timeline.finished).toBe(true);
      expect(Object.keys(timeline.cars)).toHaveLength(20);
    }
  });

  it('monopostos com chuva, paradas, safety car e bandeira vermelha continuam fiéis ao motor', () => {
    const seen = { pit: 0, sc: 0, red: 0, dnf: 0, spin: 0 };
    for (const [categoryId, trackId, seed, wetness] of [
      ['f1', 'monaco', 21, 0], ['f1', 'spa', 22, 0.7], ['f2', 'monza', 23, 0], ['f3', 'silverstone', 24, 0.3], ['f4', 'sao-paulo', 25, 0],
      ['f1', 'montreal', 26, 0.9], ['f1', 'singapura', 27, 0], ['f2', 'budapest', 28, 0.6], ['f1', 'suzuka', 41, 1], ['f2', 'montreal', 40, 1], ['f3', 'imola', 44, 1],
    ] as const) {
      const { ctx, states } = fieldRace(categoryId, trackId, seed, wetness);
      const timeline = expectFaithful(states, ctx);
      const final = states.at(-1)!;
      seen.pit += final.cars.reduce((s, c) => s + c.pitStops, 0);
      seen.sc += final.safetyCars;
      seen.red += final.redFlags;
      seen.dnf += final.cars.filter((c) => c.status === 'dnf').length;
      seen.spin += final.events.filter((e) => e.type === 'spin').length;
      // Todo evento do motor aparece na linha do tempo, uma vez, dentro da duração da corrida.
      expect(timeline.events).toHaveLength(final.events.length);
      expect(new Set(timeline.events.map((e) => e.index)).size).toBe(final.events.length);
      for (const e of timeline.events) {
        expect(e.time).toBeGreaterThanOrEqual(0);
        expect(e.time).toBeLessThanOrEqual(timeline.endTime! + 1e-6);
      }
      for (let i = 1; i < timeline.events.length; i++) expect(timeline.events[i]!.time).toBeGreaterThanOrEqual(timeline.events[i - 1]!.time);
      expect(timeline.suspensions).toHaveLength(final.redFlags);
    }
    // O conjunto de corridas cobre os casos que a transmissão precisa tratar.
    expect(seen.pit).toBeGreaterThan(50);
    expect(seen.sc).toBeGreaterThan(0);
    expect(seen.red).toBeGreaterThan(0);
    expect(seen.dnf).toBeGreaterThan(5);
    expect(seen.spin).toBeGreaterThan(0);
  });

  it('a posição de cada carro avança sem saltos e sem andar para trás', () => {
    // Corrida com safety car, bandeira vermelha e relargada parada.
    const { ctx, states } = fieldRace('f1', 'suzuka', 41, 1);
    expect(states.at(-1)!.redFlags).toBeGreaterThan(0);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    const step = 0.5;
    const restarts = timeline.suspensions.filter((s) => !s.final).map((s) => s.time);
    const problems: string[] = [];
    let fastest = 0;
    for (const id of timeline.order) {
      const car = timeline.cars[id]!;
      let previous = sampleCar(timeline, circuit, car, 0);
      expect(previous.state).toBe('grid');
      expect(previous.distance).toBeLessThan(0);
      for (let t = step; t <= timeline.endTime!; t += step) {
        const sample = sampleCar(timeline, circuit, car, t);
        const acrossRestart = restarts.some((r) => r > t - step && r <= t);
        const moved = sample.distance - previous.distance;
        // Nenhum carro anda para trás nem percorre mais de 4% da volta em meio segundo (seria um salto na tela).
        if (!acrossRestart && (moved < -1e-9 || moved > 0.04)) problems.push(`${id} em ${t}: andou ${moved}`);
        if (sample.s < 0 || sample.s >= 1 || sample.speed < 0) problems.push(`${id} em ${t}: s=${sample.s} v=${sample.speed}`);
        fastest = Math.max(fastest, sample.speed);
        previous = sample;
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    // Velocidade máxima plausível para um F1 (em pista molhada).
    expect(fastest).toBeGreaterThan(250);
    expect(fastest).toBeLessThan(400);
  });

  it('a classificação da tela no fim de cada volta é a do motor, e a final é o resultado oficial na pista', () => {
    const { ctx, states } = fieldRace('f1', 'monaco', 21);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    for (let lap = 1; lap < states.length; lap++) {
      const state = states[lap]!;
      if (state.redFlags > states[lap - 1]!.redFlags) continue;
      const running = state.cars.filter((c) => c.status === 'running');
      // Logo depois de o último carro cruzar a linha, quem completou a volta aparece na ordem do motor.
      const lastCrossing = Math.max(...running.map((c) => timeline.cars[c.driverId]!.laps.find((l) => l.lap === lap)!.t1));
      const leaderCrossing = timeline.laps[lap - 1]!.end;
      const rows = standingsAt(timeline, circuit, leaderCrossing + 1e-6);
      expect(rows[0]!.driverId).toBe(running[0]!.driverId);
      expect(rows[0]!.gap).toBe(0);
      expect(lastCrossing).toBeGreaterThanOrEqual(leaderCrossing);
    }
    const final = standingsAt(timeline, circuit, timeline.endTime! + 5);
    const onTrack = states.at(-1)!.cars.filter((c) => c.status === 'running').map((c) => c.driverId);
    expect(final.filter((r) => r.state === 'finished').map((r) => r.driverId)).toEqual(onTrack);
    // As diferenças finais são as do motor.
    const leaderTime = states.at(-1)!.cars[0]!.totalTime;
    for (const row of final.filter((r) => r.state === 'finished')) {
      const car = states.at(-1)!.cars.find((c) => c.driverId === row.driverId)!;
      expect(row.gap).toBeCloseTo(car.totalTime - leaderTime, 6);
    }
    // O resultado oficial só difere da ordem de pista por punições em tempo.
    const official = finalizeRace(states.at(-1)!, ctx.category);
    expect(official.entries).toHaveLength(final.length);
  });

  it('a diferença em segundos exibida no meio da volta é coerente com os tempos de volta', () => {
    const { ctx, states } = fieldRace('kart-regional', 'planalto', 14);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    const info = timeline.laps[5]!;
    const middle = (info.start + info.end) / 2;
    const rows = standingsAt(timeline, circuit, middle);
    const leader = timeline.cars[rows[0]!.driverId]!;
    for (const row of rows.filter((r) => r.state === 'racing').slice(1)) {
      // A diferença é o tempo desde que o líder passou pelo mesmo ponto.
      expect(row.gap).toBeCloseTo(middle - timeAtDistance(circuit, leader, row.sample.distance)!, 6);
      expect(row.gap!).toBeGreaterThan(0);
      expect(row.interval!).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < rows.length; i++) if (rows[i]!.state === 'racing' && rows[i - 1]!.state === 'racing') expect(rows[i]!.sample.distance).toBeLessThanOrEqual(rows[i - 1]!.sample.distance);
  });

  it('paradas passam pelo pit lane, com o carro parado no box da equipe', () => {
    const { ctx, states } = fieldRace('f1', 'monza', 31);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    let stops = 0;
    for (const car of Object.values(timeline.cars)) {
      for (const lap of car.laps.filter((l) => l.pitIn)) {
        stops++;
        const hold = lap.segments.find((s) => s.kind === 'hold')!;
        expect(hold.t1 - hold.t0).toBeGreaterThan(1);
        expect(hold.s0).toBeGreaterThan(circuit.pit.entryEnd);
        expect(hold.s0).toBeLessThan(1);
        const stopped = sampleCar(timeline, circuit, car, (hold.t0 + hold.t1) / 2);
        expect(stopped).toMatchObject({ state: 'pit', inPitLane: true, inBox: true, speed: 0 });
        // Na volta seguinte o carro sai pelo pit lane.
        const next = car.laps.find((l) => l.lap === lap.lap + 1);
        if (next && !car.retired) {
          expect(next.pitOut).toBe(true);
          expect(sampleCar(timeline, circuit, car, next.t0 + 0.2).inPitLane).toBe(true);
        }
      }
    }
    expect(stops).toBeGreaterThan(15);
    expect(timeline.events.filter((e) => e.type === 'pit')).toHaveLength(stops);
  });

  it('abandonos param na pista no instante do evento e saem da disputa', () => {
    const { ctx, states } = fieldRace('f1', 'montreal', 26, 0.9);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    const retired = Object.values(timeline.cars).filter((c) => c.retired);
    expect(retired.length).toBeGreaterThan(0);
    for (const car of retired) {
      const r = car.retired!;
      const event = timeline.events.find((e) => (e.type === 'dnf' || e.type === 'fuel') && e.driverId === car.driverId && e.lap === r.lap)!;
      expect(event.time).toBeCloseTo(r.time, 9);
      const after = sampleCar(timeline, circuit, car, r.time + 30);
      expect(after).toMatchObject({ state: 'retired', speed: 0, s: r.s });
      expect(after.retiredFor).toBeCloseTo(30, 6);
      expect(car.finishTime).toBeNull();
    }
    const rows = standingsAt(timeline, circuit, timeline.endTime! + 1);
    const firstRetired = rows.findIndex((r) => r.state === 'retired');
    expect(rows.slice(firstRetired).every((r) => r.state === 'retired')).toBe(true);
  });

  it('as ultrapassagens do motor acontecem na pista, no instante do evento', () => {
    const { ctx, states } = fieldRace('f1', 'spa', 33);
    const timeline = buildRaceTimeline(states, ctx)!;
    const circuit = circuitForRace(ctx);
    const overtakes = timeline.events.filter((e) => e.type === 'overtake' && e.lap > 1);
    expect(overtakes.length).toBeGreaterThan(10);
    let crossed = 0;
    for (const e of overtakes) {
      const attacker = timeline.cars[e.driverId]!;
      const defender = timeline.cars[e.otherDriverId!]!;
      const before = sampleCar(timeline, circuit, attacker, e.time - 0.4).distance - sampleCar(timeline, circuit, defender, e.time - 0.4).distance;
      const after = sampleCar(timeline, circuit, attacker, e.time + 0.4).distance - sampleCar(timeline, circuit, defender, e.time + 0.4).distance;
      if (before < 0 && after > 0) crossed++;
    }
    // A grande maioria das ultrapassagens é uma troca de posição visível entre os dois carros.
    expect(crossed / overtakes.length).toBeGreaterThan(0.8);
  });

  it('o safety car anda à frente do líder só enquanto a prova está neutralizada', () => {
    let checked = 0;
    for (const seed of [21, 26, 27, 34, 35, 36]) {
      const { ctx, states } = fieldRace('f1', 'montreal', seed, seed % 2 ? 0.8 : 0);
      const timeline = buildRaceTimeline(states, ctx)!;
      const circuit = circuitForRace(ctx);
      for (const info of timeline.laps) {
        const t = info.start + (info.end - info.start) * 0.4;
        const leader = standingsAt(timeline, circuit, t)[0]!;
        const sc = safetyCarAt(timeline, circuit, t, leader.sample.distance);
        if (info.flag === 'sc') {
          checked++;
          expect(sc).not.toBeNull();
          expect(sc!.presence).toBe(1);
        } else {
          expect(sc).toBeNull();
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('troca livre de pneus na bandeira vermelha aparece já no grid da relargada', () => {
    const { ctx, states } = fieldRace('f1', 'suzuka', 41, 1);
    const flagged = states.findIndex((s) => s.restart === 'standing' && s.currentLap > 0);
    expect(flagged).toBeGreaterThan(0);
    const before = states[flagged]!;
    const playerId = before.playerDriverId;
    expect(before.cars.find((c) => c.driverId === playerId)!.status).toBe('running');
    const regrouped = before.cars.find((c) => c.driverId === playerId)!.tyre.compound;
    const chosen = regrouped === 'intermediate' ? 'wet' : 'intermediate';
    // O jogador escolhe outro composto para a relargada (sem engenheiro automático).
    const after = stepRaceLap(before, ctx, { mode: 'balanced', pit: chosen });
    const timeline = appendRaceLap(buildRaceTimeline(states.slice(0, flagged + 1), ctx)!, before, after, ctx);
    const circuit = circuitForRace(ctx);
    const restart = timeline.suspensions.at(-1)!.time;
    const onGrid = standingsAt(timeline, circuit, restart + 0.01).find((r) => r.driverId === playerId)!;
    expect(onGrid.sample.gridSlot).not.toBeNull();
    expect(onGrid.compound).toBe(chosen);
    expect(onGrid.wear).toBe(0);
    expect(onGrid.pitStops).toBe(before.cars.find((c) => c.driverId === playerId)!.pitStops);
    // Os outros carros continuam com o composto do reagrupamento.
    const other = before.cars.find((c) => c.status === 'running' && c.driverId !== playerId)!;
    expect(standingsAt(timeline, circuit, restart + 0.01).find((r) => r.driverId === other.driverId)!.compound).toBe(other.tyre.compound);
  });

  it('os eventos aparecem conforme a corrida avança, nunca antes', () => {
    const { ctx, states } = fieldRace('f2', 'monza', 23);
    const timeline = buildRaceTimeline(states, ctx)!;
    expect(eventsUntil(timeline, -1)).toHaveLength(0);
    expect(eventsUntil(timeline, 0).map((e) => e.type)).toContain('start');
    const half = eventsUntil(timeline, timeline.endTime! / 2);
    expect(half.length).toBeGreaterThan(0);
    expect(half.length).toBeLessThan(timeline.events.length);
    expect(half.every((e) => e.time <= timeline.endTime! / 2)).toBe(true);
    expect(eventsUntil(timeline, timeline.endTime!)).toHaveLength(timeline.events.length);
    expect(timeline.events.find((e) => e.type === 'finish')!.time).toBeCloseTo(timeline.winnerTime!, 9);
  });

  it('montar volta a volta (ao vivo) dá a mesma linha do tempo que montar tudo de uma vez', () => {
    const { ctx, states } = fieldRace('f3', 'silverstone', 24, 0.3);
    let live = createRaceTimeline(states[0]!, ctx);
    for (let i = 1; i < states.length; i++) {
      live = appendRaceLap(live, states[i - 1]!, states[i]!, ctx);
      // Durante a corrida, o horizonte é o instante em que o líder fecha a última volta simulada.
      if (i < states.length - 1) expect(live.horizon).toBeCloseTo(live.laps.at(-1)!.end, 9);
    }
    expect(live).toEqual(buildRaceTimeline(states, ctx));
    // Repetir a mesma volta não altera nada.
    expect(appendRaceLap(live, states.at(-2)!, states.at(-1)!, ctx)).toBe(live);
  });
});

describe('integração com a carreira', () => {
  it('a corrida da carreira gera linha do tempo e o resultado gravado não muda por causa dela', () => {
    let career = botCareer(4242, 4);
    career = playRound(career);
    while (career.pendingEvents.length > 0) career = resolveEvent(career, career.pendingEvents[0]!.id, career.pendingEvents[0]!.choices[0]!.id).career;
    const weekend = runQualifying(runPractice(startWeekend(career), 'setup'), 'balanced');
    const ctx = buildRaceContext(weekend);
    const states = [createWeekendRace(weekend)];
    let timeline = createRaceTimeline(states[0]!, ctx);
    while (!isRaceFinished(states.at(-1)!)) {
      const next = stepRaceLap(states.at(-1)!, ctx, { mode: 'balanced', auto: true });
      timeline = appendRaceLap(timeline, states.at(-1)!, next, ctx);
      states.push(next);
    }
    expectFaithful(states, ctx);
    expect(timeline.playerDriverId).toBe(weekend.playerDriverId);
    expect(timeline.cars[weekend.playerDriverId]).toBeDefined();
    // Números de carro: únicos e estáveis.
    const numbers = Object.values(timeline.cars).map((c) => c.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(createRaceTimeline(states[0]!, ctx).cars[weekend.playerDriverId]!.number).toBe(timeline.cars[weekend.playerDriverId]!.number);
  });
});
