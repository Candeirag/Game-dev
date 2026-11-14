/**
 * Linha do tempo da corrida: a ponte entre o motor e a transmissão visual.
 *
 * O motor de corrida calcula uma volta inteira de cada vez e devolve o tempo
 * acumulado de cada carro. Este módulo guarda esses tempos e responde à
 * pergunta "onde está cada carro no instante t?", para que a tela mostre os
 * carros andando entre uma linha de chegada e a seguinte.
 *
 * Regras que garantem que a imagem é a corrida real, e não uma animação solta:
 * - Cada carro cruza a linha exatamente no tempo que o motor calculou. Logo, a
 *   ordem na pista ao fim de cada volta é a ordem do motor, e as diferenças em
 *   segundos são as do motor.
 * - Dentro da volta, todos seguem o mesmo perfil de velocidade do circuito
 *   (devagar nas curvas, rápido nas retas). Quem faz a volta mais rápida anda
 *   mais depressa em todos os pontos, e a ultrapassagem acontece na pista, no
 *   ponto em que as duas trajetórias se cruzam.
 * - Paradas, rodadas e abandonos vêm dos eventos do motor: o carro que parou
 *   entra de fato no pit lane, e o tempo parado é o tempo que ele perdeu.
 *
 * Nada aqui usa sorteio que mude resultado. Os únicos valores "escolhidos" são
 * de apresentação (em que ponto da volta um carro roda ou abandona), fixados
 * por uma função de dispersão do piloto e da volta, sempre iguais.
 */
import type { DnfReason, RaceEvent, RaceMode, TyreCompound } from '@/domain/schemas';
import { referenceLapTime } from '@/data/tracks';
import { createRng, hashSeed } from '../rng';
import { RACE } from '../simulation/constants';
import type { RaceCar, RaceContext, RaceSimState } from '../simulation/race/types';
import { isRaceFinished } from '../simulation/race/step';
import { buildCircuit, paceAt, pitBoxAt, sAtTau, tauAt, wrap01, type Circuit } from './circuit';

export type SegmentKind = 'pace' | 'launch' | 'lane' | 'hold';

/** Trecho de uma volta: entre t0 e t1 o carro vai de s0 a s1 (frações da volta). */
export interface LapSegment {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
  kind: SegmentKind;
}

export interface CarLap {
  lap: number;
  t0: number;
  /** Instante em que cruza a linha (ou em que para, se abandonar nesta volta). */
  t1: number;
  segments: LapSegment[];
  /** Entra nos boxes no fim desta volta. */
  pitIn: boolean;
  /** Sai dos boxes no começo desta volta. */
  pitOut: boolean;
  /** Intervalo em que o carro está rodado na pista. */
  spin: { from: number; to: number } | null;
  /** Estado do carro ao fim da volta, como o motor informou. */
  position: number;
  lastLap: number | null;
  bestLap: number | null;
  compound: TyreCompound;
  wear: number;
  pitStops: number;
  penaltySeconds: number;
  damage: number;
  fuel: number;
  mode: RaceMode;
}

export interface CarTimeline {
  driverId: string;
  teamId: string;
  grid: number;
  /** Número do carro (estável por piloto; não faz parte do save). */
  number: number;
  /** Posição da equipe nos boxes. */
  boxIndex: number;
  startCompound: TyreCompound;
  laps: CarLap[];
  retired: { lap: number; time: number; s: number; reason: DnfReason } | null;
  finishTime: number | null;
}

export type LapFlag = 'green' | 'sc' | 'vsc';

export interface LapInfo {
  lap: number;
  /** Instante em que o líder começa e termina a volta. */
  start: number;
  end: number;
  flag: LapFlag;
  /** Largada ou relargada parada. */
  standing: boolean;
  wetness: number;
  /** O safety car recolhe aos boxes no fim desta volta. */
  safetyCarIn: boolean;
}

export interface TimedEvent extends RaceEvent {
  /** Instante da corrida em que o evento acontece na pista. */
  time: number;
  /** Ordem original no motor (desempate). */
  index: number;
}

export interface RaceTimeline {
  trackId: string;
  categoryId: string;
  totalLaps: number;
  lapsBuilt: number;
  /** Tempo de volta de referência da pista na categoria (dá o ritmo da reprodução). */
  referenceLap: number;
  lengthMeters: number;
  playerDriverId: string;
  /** Pilotos na ordem do grid. */
  order: string[];
  cars: Record<string, CarTimeline>;
  boxCount: number;
  laps: LapInfo[];
  events: TimedEvent[];
  /** Até este instante a posição de todos os carros na pista é conhecida. */
  horizon: number;
  finished: boolean;
  /** Instante em que o vencedor recebe a bandeirada e em que o último carro termina. */
  winnerTime: number | null;
  endTime: number | null;
  /** Bandeiras vermelhas: a corrida para neste instante (final = encerrada de vez). */
  suspensions: { time: number; lap: number; final: boolean }[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hash01 = (...parts: (string | number)[]) => createRng(hashSeed('broadcast', ...parts)).next();

/** Acelera do zero e depois segue em ritmo constante: f(0) = 0, f'(0) = 0, f(1) = 1. */
const LAUNCH = 0.05;
const LAUNCH_NORM = 1 + LAUNCH * (Math.exp(-1 / LAUNCH) - 1);
const launchEase = (u: number) => (u + LAUNCH * (Math.exp(-u / LAUNCH) - 1)) / LAUNCH_NORM;
const launchRate = (u: number) => (1 - Math.exp(-u / LAUNCH)) / LAUNCH_NORM;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function circuitForRace(ctx: RaceContext): Circuit {
  return buildCircuit(ctx.track, ctx.category.vehicle);
}

/** Números dos carros: derivados do id do piloto, sem repetição no mesmo grid. */
function assignNumbers(driverIds: readonly string[]): Record<string, number> {
  const taken = new Set<number>();
  const numbers: Record<string, number> = {};
  for (const id of driverIds) {
    let n = 2 + (hashSeed('car-number', id) % 98);
    while (taken.has(n)) n = n >= 99 ? 2 : n + 1;
    taken.add(n);
    numbers[id] = n;
  }
  return numbers;
}

/** Linha do tempo de uma corrida que ainda não largou. */
export function createRaceTimeline(race: RaceSimState, ctx: RaceContext): RaceTimeline {
  const numbers = assignNumbers(race.cars.map((c) => c.driverId));
  const teams = [...new Set(race.cars.map((c) => c.teamId))];
  const cars: Record<string, CarTimeline> = {};
  for (const car of race.cars) {
    cars[car.driverId] = {
      driverId: car.driverId,
      teamId: car.teamId,
      grid: car.grid,
      number: numbers[car.driverId] ?? car.grid,
      boxIndex: teams.indexOf(car.teamId),
      startCompound: car.tyre.compound,
      laps: [],
      retired: null,
      finishTime: null,
    };
  }
  return {
    trackId: race.trackId,
    categoryId: race.categoryId,
    totalLaps: race.totalLaps,
    lapsBuilt: 0,
    referenceLap: referenceLapTime(ctx.track, ctx.category),
    lengthMeters: ctx.track.lengthMeters,
    playerDriverId: race.playerDriverId,
    order: race.cars.map((c) => c.driverId),
    cars,
    boxCount: teams.length,
    laps: [],
    events: [],
    horizon: 0,
    finished: false,
    winnerTime: null,
    endTime: null,
    suspensions: [],
  };
}

interface Draft {
  car: RaceCar;
  previous: RaceCar;
  base: CarTimeline;
  t0: number;
  t1: number;
  s0: number;
  pitted: boolean;
  spun: boolean;
  retiredNow: boolean;
}

/**
 * Acrescenta à linha do tempo a volta que o motor acabou de simular
 * (`previous` é o estado antes da volta; `next`, o estado depois).
 */
export function appendRaceLap(timeline: RaceTimeline, previous: RaceSimState, next: RaceSimState, ctx: RaceContext): RaceTimeline {
  const lap = next.currentLap;
  if (lap !== previous.currentLap + 1 || lap !== timeline.lapsBuilt + 1) return timeline;
  const circuit = circuitForRace(ctx);
  const flag: LapFlag = previous.neutralization.type === 'none' ? 'green' : previous.neutralization.type;
  const standing = lap === 1 || previous.restart === 'standing';
  const redFlag = next.redFlags > previous.redFlags;
  const newEvents = next.events.slice(previous.events.length);
  const nextById = new Map(next.cars.map((c, i) => [c.driverId, { car: c, position: i + 1 }]));
  const running = previous.cars.filter((c) => c.status === 'running');
  // Na largada parada todos saem no mesmo instante; a diferença do grid vira distância.
  const lapStart = lap === 1 ? 0 : standing ? Math.min(...running.map((c) => c.totalTime)) : Math.min(...running.map((c) => timeline.cars[c.driverId]?.laps.at(-1)?.t1 ?? c.totalTime));
  const reference = timeline.referenceLap;

  /* ---------- 1. Tempos de cada carro na volta ---------- */
  const drafts: Draft[] = running.flatMap((prev, slot) => {
    const base = timeline.cars[prev.driverId];
    const entry = nextById.get(prev.driverId);
    if (!base || !entry) return [];
    const car = entry.car;
    const lastT1 = base.laps.at(-1)?.t1 ?? 0;
    const t0 = standing ? lapStart : lastT1;
    const retiredNow = car.status === 'dnf';
    // Numa volta de bandeira vermelha o motor reagrupa os tempos; a pista mostra o tempo real da volta.
    const crossing = redFlag ? prev.totalTime + (car.lastLap ?? reference) : car.totalTime;
    return [{
      car,
      previous: prev,
      base,
      t0,
      t1: retiredNow ? t0 : Math.max(t0 + 1, crossing),
      s0: standing ? -(slot + 0.7) * circuit.gridSlot : 0,
      pitted: !retiredNow && car.pitStops > prev.pitStops,
      spun: !retiredNow && newEvents.some((e) => e.type === 'spin' && e.driverId === car.driverId),
      retiredNow,
    }];
  });

  const clean = drafts.filter((d) => !d.retiredNow && !d.pitted && !d.spun).map((d) => d.t1 - d.t0);
  const typical = median(clean) ?? median(drafts.filter((d) => !d.retiredNow).map((d) => d.t1 - d.t0)) ?? reference * 1.05;

  /* ---------- 2. Trechos da volta ---------- */
  const cars = { ...timeline.cars };
  const entryTau = tauAt(circuit, circuit.pit.entry);
  for (const d of drafts) {
    const { car, base, t0, s0 } = d;
    const tau0 = tauAt(circuit, s0);
    const kind: SegmentKind = standing ? 'launch' : 'pace';
    const pitOut = base.laps.at(-1)?.pitIn ?? false;
    const segments: LapSegment[] = [];
    let spin: CarLap['spin'] = null;
    let retired = base.retired;
    let t1 = d.t1;

    if (d.retiredNow) {
      // O carro anda no ritmo do pelotão até o ponto em que para.
      const stopAt = clamp(0.12 + 0.76 * hash01(car.driverId, lap, 'dnf'), Math.max(0.02, circuit.pit.exit + 0.02), circuit.pit.entry - 0.03);
      t1 = t0 + typical * ((tauAt(circuit, stopAt) - tau0) / (1 - tau0));
      segments.push({ t0, t1, s0, s1: stopAt, kind });
      retired = { lap, time: t1, s: stopAt, reason: car.dnfReason ?? 'crash' };
    } else if (d.pitted) {
      // Tempo perdido na parada, pela mesma conta do motor: travessia do pit lane mais o serviço.
      const duration = t1 - t0;
      const service = Number(/\((\d+(?:\.\d+)?)s\)/.exec(newEvents.find((e) => e.type === 'pit' && e.driverId === car.driverId)?.message ?? '')?.[1] ?? RACE.PIT_SERVICE);
      const laneFactor = flag === 'sc' ? RACE.PIT_LOSS_FACTOR_SC : flag === 'vsc' ? RACE.PIT_LOSS_FACTOR_VSC : 1;
      const loss = clamp(ctx.category.race.pitLaneLoss * laneFactor + service, 0, duration * 0.75);
      const box = pitBoxAt(circuit, base.boxIndex, timeline.boxCount);
      const share = (entryTau - tau0) / (1 - tau0);
      // O pit lane é percorrido devagar: no mínimo uma vez e meia o tempo que a pista levaria.
      const laneFloor = (1 - entryTau) * reference * 1.5;
      const hold = clamp(service, 1, duration * 0.3);
      const drive = Math.max(duration * 0.4, Math.min((duration - loss) * share, duration - hold - laneFloor));
      const lane = duration - drive - hold;
      const laneIn = lane * ((box - circuit.pit.entry) / (1 - circuit.pit.entry));
      const a = t0 + drive;
      const b = a + laneIn;
      const c = b + hold;
      segments.push({ t0, t1: a, s0, s1: circuit.pit.entry, kind }, { t0: a, t1: b, s0: circuit.pit.entry, s1: box, kind: 'lane' }, { t0: b, t1: c, s0: box, s1: box, kind: 'hold' }, { t0: c, t1, s0: box, s1: 1, kind: 'lane' });
    } else if (d.spun) {
      const duration = t1 - t0;
      const loss = clamp(duration - typical, Math.min(1.5, duration * 0.2), Math.min(10, duration * 0.5));
      const where = clamp(0.15 + 0.7 * hash01(car.driverId, lap, 'spin'), circuit.pit.exit + 0.02, circuit.pit.entry - 0.03);
      const a = t0 + (duration - loss) * ((tauAt(circuit, where) - tau0) / (1 - tau0));
      segments.push({ t0, t1: a, s0, s1: where, kind }, { t0: a, t1: a + loss, s0: where, s1: where, kind: 'hold' }, { t0: a + loss, t1, s0: where, s1: 1, kind: 'pace' });
      spin = { from: a, to: a + loss };
    } else {
      segments.push({ t0, t1, s0, s1: 1, kind });
    }

    const record: CarLap = {
      lap,
      t0,
      t1,
      segments,
      pitIn: d.pitted,
      pitOut,
      spin,
      position: nextById.get(car.driverId)?.position ?? 0,
      lastLap: car.lastLap,
      bestLap: car.bestLap,
      compound: car.tyre.compound,
      wear: car.tyre.wear,
      pitStops: car.pitStops,
      penaltySeconds: car.penaltySeconds,
      damage: car.damage,
      fuel: car.fuel,
      mode: car.mode,
    };
    cars[car.driverId] = { ...base, laps: [...base.laps, record], retired };
  }

  /* ---------- 3. Volta, bandeiras e fim de corrida ---------- */
  const survivors = drafts.filter((d) => !d.retiredNow);
  const crossings = survivors.map((d) => cars[d.car.driverId]?.laps.at(-1)?.t1 ?? d.t1);
  const leaderEnd = crossings.length ? Math.min(...crossings) : lapStart + typical;
  const info: LapInfo = {
    lap,
    start: lapStart,
    end: leaderEnd,
    flag,
    standing,
    wetness: next.wetnessByLap[lap] ?? next.weather.wetness,
    safetyCarIn: flag === 'sc' && next.neutralization.type === 'none',
  };
  const finished = isRaceFinished(next);
  const suspensions = redFlag ? [...timeline.suspensions, { time: leaderEnd, lap, final: next.endedEarly }] : timeline.suspensions;
  let winnerTime = timeline.winnerTime;
  let endTime = timeline.endTime;
  if (finished) {
    winnerTime = leaderEnd;
    // Mesmo com bandeira vermelha final, cada carro completa a volta: é o resultado dela que vale.
    endTime = crossings.length === 0 ? leaderEnd : Math.max(...crossings);
    for (const d of survivors) {
      const entry = cars[d.car.driverId];
      const last = entry?.laps.at(-1);
      if (entry && last) cars[d.car.driverId] = { ...entry, finishTime: last.t1 };
    }
  }

  /* ---------- 4. Eventos, cada um no seu instante ---------- */
  const built: RaceTimeline = {
    ...timeline,
    lapsBuilt: lap,
    cars,
    laps: [...timeline.laps, info],
    horizon: finished ? (endTime ?? leaderEnd) : leaderEnd,
    finished,
    winnerTime,
    endTime,
    suspensions,
  };
  let answeredOrder = previous.pendingTeamOrder === null;
  const timed: TimedEvent[] = newEvents.map((event, i) => {
    const own = cars[event.driverId]?.laps.at(-1);
    const mine = own && own.lap === lap ? own : null;
    const within = (fraction: number) => (mine ? mine.t0 + (mine.t1 - mine.t0) * fraction : lapStart + typical * fraction);
    let time: number;
    switch (event.type) {
      case 'start':
      case 'weather':
        time = lapStart;
        break;
      case 'restart':
        time = i === 0 ? lapStart : leaderEnd;
        break;
      case 'overtake':
        time = crossingTime(built, circuit, event.driverId, event.otherDriverId, lap) ?? within(0.5);
        break;
      case 'spin':
        time = mine?.spin?.from ?? within(0.5);
        break;
      case 'damage':
        time = mine?.spin?.from ?? within(0.55);
        break;
      case 'dnf':
      case 'fuel':
        time = cars[event.driverId]?.retired?.time ?? within(0.5);
        break;
      case 'pit':
        time = mine?.segments.find((s) => s.kind === 'lane')?.t0 ?? within(0.9);
        break;
      case 'error':
        time = within(0.2 + 0.6 * hash01(event.driverId, lap, 'error'));
        break;
      case 'collision':
        time = within(0.5);
        break;
      case 'penalty':
        time = within(standing ? 0.15 : 0.75);
        break;
      case 'fastestLap':
        time = mine?.t1 ?? leaderEnd;
        break;
      case 'teamOrder':
        // A resposta a uma ordem pendente acontece no começo da volta; as demais, no fim.
        if (!answeredOrder && event.driverId === previous.playerDriverId) {
          answeredOrder = true;
          time = within(0.12);
        } else {
          time = leaderEnd;
        }
        break;
      case 'safetyCar':
        time = info.safetyCarIn ? Math.max(lapStart, leaderEnd - typical * 0.35) : leaderEnd;
        break;
      default:
        time = leaderEnd;
    }
    return { ...event, time, index: previous.events.length + i };
  });
  const events = [...timeline.events, ...timed].sort((a, b) => a.time - b.time || a.index - b.index);
  return { ...built, events };
}

/** Linha do tempo completa de uma corrida já simulada, a partir dos estados de cada volta. */
export function buildRaceTimeline(states: readonly RaceSimState[], ctx: RaceContext): RaceTimeline | null {
  const first = states[0];
  if (!first) return null;
  let timeline = createRaceTimeline(first, ctx);
  for (let i = 1; i < states.length; i++) {
    const previous = states[i - 1];
    const next = states[i];
    if (previous && next) timeline = appendRaceLap(timeline, previous, next, ctx);
  }
  return timeline;
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

function segmentPosition(circuit: Circuit, segment: LapSegment, t: number): { s: number; rate: number } {
  const duration = segment.t1 - segment.t0;
  if (segment.kind === 'hold' || duration <= 0) return { s: segment.s1, rate: 0 };
  const u = clamp((t - segment.t0) / duration, 0, 1);
  if (segment.kind === 'lane') return { s: segment.s0 + (segment.s1 - segment.s0) * u, rate: (segment.s1 - segment.s0) / duration };
  const a = tauAt(circuit, segment.s0);
  const b = tauAt(circuit, segment.s1);
  const progress = segment.kind === 'launch' ? launchEase(u) : u;
  const s = sAtTau(circuit, a + (b - a) * progress);
  const rate = ((b - a) / duration) * (segment.kind === 'launch' ? launchRate(u) : 1) * paceAt(circuit, s);
  return { s, rate };
}

function segmentTime(circuit: Circuit, segment: LapSegment, s: number): number {
  if (segment.kind === 'hold') return segment.t0;
  const duration = segment.t1 - segment.t0;
  if (segment.kind === 'lane') return segment.t0 + duration * clamp((s - segment.s0) / (segment.s1 - segment.s0 || 1), 0, 1);
  const a = tauAt(circuit, segment.s0);
  const b = tauAt(circuit, segment.s1);
  const progress = clamp((tauAt(circuit, s) - a) / (b - a || 1), 0, 1);
  if (segment.kind === 'pace') return segment.t0 + duration * progress;
  // Largada: inverte a curva de aceleração por bisseção.
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (launchEase(mid) < progress) low = mid;
    else high = mid;
  }
  return segment.t0 + duration * ((low + high) / 2);
}

export type CarState = 'grid' | 'racing' | 'pit' | 'spin' | 'retired' | 'finished';

export interface CarSample {
  driverId: string;
  /** Distância percorrida, em voltas (negativa no grid, antes da largada). */
  distance: number;
  /** Ponto da volta, de 0 a 1. */
  s: number;
  /** Volta em andamento. */
  lap: number;
  state: CarState;
  /** O carro está no pit lane (entrada, box ou saída). */
  inPitLane: boolean;
  /** Parado no box. */
  inBox: boolean;
  /** Velocidade em km/h. */
  speed: number;
  /** Progresso da rodada, de 0 a 1 (null se não está rodando). */
  spinPhase: number | null;
  /** Segundos de corrida desde o abandono. */
  retiredFor: number;
  reason: DnfReason | null;
  /** Último registro de volta completa (pneus, paradas, punições). */
  record: CarLap | null;
}

function lapAt(car: CarTimeline, t: number): CarLap | null {
  // Última volta que já começou. Depois de uma bandeira vermelha, a volta da relargada
  // começa antes de a anterior "terminar", e é ela que vale.
  for (let i = car.laps.length - 1; i >= 0; i--) {
    const lap = car.laps[i];
    if (lap && lap.t0 <= t) return lap;
  }
  return car.laps[0] ?? null;
}

/** Posição e estado de um carro no instante t. */
export function sampleCar(timeline: RaceTimeline, circuit: Circuit, car: CarTimeline, t: number): CarSample {
  const toKmh = timeline.lengthMeters * 3.6;
  const lap = lapAt(car, t);
  const completed = (upTo: number) => {
    for (let i = car.laps.length - 1; i >= 0; i--) {
      const l = car.laps[i];
      if (l && l.t1 <= upTo && !(car.retired && car.retired.lap === l.lap)) return l;
    }
    return null;
  };
  const base = { driverId: car.driverId, spinPhase: null, retiredFor: 0, reason: null, inBox: false } as const;
  if (!lap) {
    // Antes de o motor simular a primeira volta: carro parado no grid.
    const s = -(car.grid - 0.3) * circuit.gridSlot;
    return { ...base, distance: s, s: wrap01(s), lap: 1, state: 'grid', inPitLane: false, speed: 0, record: null };
  }
  if (car.retired && t >= car.retired.time) {
    return { ...base, distance: car.retired.lap - 1 + car.retired.s, s: car.retired.s, lap: car.retired.lap, state: 'retired', inPitLane: false, speed: 0, retiredFor: t - car.retired.time, reason: car.retired.reason, record: completed(t) };
  }
  if (car.finishTime !== null && t >= car.finishTime) {
    // Volta de desaceleração depois da bandeirada.
    const duration = (lap.t1 - lap.t0) * 1.8;
    const extra = Math.min(0.9, (t - car.finishTime) / duration);
    const s = sAtTau(circuit, extra);
    return { ...base, distance: lap.lap + extra, s: wrap01(s), lap: lap.lap, state: 'finished', inPitLane: false, speed: (paceAt(circuit, s) / duration) * toKmh, record: lap };
  }
  const segment = lap.segments.find((sg) => t < sg.t1) ?? lap.segments.at(-1);
  if (!segment) return { ...base, distance: lap.lap - 1, s: 0, lap: lap.lap, state: 'racing', inPitLane: false, speed: 0, record: completed(t) };
  const { s, rate } = segmentPosition(circuit, segment, t);
  const inPitLane = segment.kind === 'lane' || (lap.pitIn && segment.kind === 'hold') || (lap.pitIn && s >= circuit.pit.entry) || (lap.pitOut && s >= 0 && s <= circuit.pit.exit);
  const spinning = lap.spin !== null && t >= lap.spin.from && t < lap.spin.to;
  const state: CarState = spinning ? 'spin' : inPitLane ? 'pit' : s < 0 && rate === 0 ? 'grid' : 'racing';
  return {
    ...base,
    distance: lap.lap - 1 + s,
    s: wrap01(s),
    lap: lap.lap,
    state,
    inPitLane,
    inBox: lap.pitIn && segment.kind === 'hold',
    speed: Math.max(0, rate) * toKmh,
    spinPhase: spinning && lap.spin ? (t - lap.spin.from) / (lap.spin.to - lap.spin.from) : null,
    record: completed(t),
  };
}

/** Distância percorrida (em voltas) no instante t, sem o resto da amostra. */
function distanceAt(timeline: RaceTimeline, circuit: Circuit, car: CarTimeline, t: number): number {
  return sampleCar(timeline, circuit, car, t).distance;
}

/** Instante em que um carro passou (ou passará) por uma distância. null se ele nunca esteve lá. */
export function timeAtDistance(circuit: Circuit, car: CarTimeline, distance: number): number | null {
  for (let i = car.laps.length - 1; i >= 0; i--) {
    const lap = car.laps[i];
    if (!lap) continue;
    const s = distance - (lap.lap - 1);
    const first = lap.segments[0];
    const last = lap.segments.at(-1);
    if (!first || !last || s < first.s0 || s > last.s1) continue;
    const segment = lap.segments.find((sg) => sg.kind !== 'hold' && s >= sg.s0 && s <= sg.s1) ?? last;
    return segmentTime(circuit, segment, s);
  }
  return null;
}

/** Instante em que o atacante passa o defensor dentro de uma volta (null se as trajetórias não se cruzam). */
function crossingTime(timeline: RaceTimeline, circuit: Circuit, attackerId: string, defenderId: string | undefined, lap: number): number | null {
  const attacker = timeline.cars[attackerId];
  const defender = defenderId ? timeline.cars[defenderId] : undefined;
  const a = attacker?.laps.find((l) => l.lap === lap);
  const b = defender?.laps.find((l) => l.lap === lap);
  if (!attacker || !defender || !a || !b) return null;
  const from = Math.max(a.t0, b.t0);
  const to = Math.min(a.t1, b.t1);
  if (to <= from) return null;
  const gap = (t: number) => distanceAt(timeline, circuit, attacker, t) - distanceAt(timeline, circuit, defender, t);
  const steps = 32;
  let before = from;
  let gapBefore = gap(from);
  for (let i = 1; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const g = gap(t);
    if (gapBefore < 0 && g >= 0) {
      let low = before;
      let high = t;
      for (let k = 0; k < 12; k++) {
        const mid = (low + high) / 2;
        if (gap(mid) < 0) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    }
    before = t;
    gapBefore = g;
  }
  return null;
}

export interface StandingRow {
  driverId: string;
  teamId: string;
  number: number;
  position: number;
  grid: number;
  state: CarState;
  /** Voltas completas. */
  laps: number;
  /** Diferença para o líder, em segundos (null no grid, para abandonos ou quando ainda não há referência). */
  gap: number | null;
  /** Diferença para o carro da frente. */
  interval: number | null;
  /** Voltas de desvantagem para o líder (0 = na mesma volta). */
  lapsDown: number;
  compound: TyreCompound;
  wear: number;
  pitStops: number;
  penaltySeconds: number;
  damage: number;
  lastLap: number | null;
  bestLap: number | null;
  speed: number;
  sample: CarSample;
}

/**
 * Classificação no instante t, pela posição real dos carros na pista. É ela
 * que a tela mostra: nunca o estado adiantado do motor.
 */
export function standingsAt(timeline: RaceTimeline, circuit: Circuit, t: number): StandingRow[] {
  const entries = timeline.order.flatMap((id) => {
    const car = timeline.cars[id];
    return car ? [{ car, sample: sampleCar(timeline, circuit, car, t) }] : [];
  });
  const rank = (e: (typeof entries)[number]) => (e.sample.state === 'retired' ? 0 : e.sample.state === 'finished' ? 2 : 1);
  entries.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return rb - ra;
    if (ra === 2) return (a.car.finishTime ?? 0) - (b.car.finishTime ?? 0);
    if (ra === 0) return b.sample.distance - a.sample.distance || (b.car.retired?.time ?? 0) - (a.car.retired?.time ?? 0);
    return b.sample.distance - a.sample.distance || a.car.grid - b.car.grid;
  });
  const leader = entries[0];
  const raceLaps = timeline.finished ? timeline.lapsBuilt : timeline.totalLaps;
  let previousGap: number | null = 0;
  return entries.map((entry, index) => {
    const { car, sample } = entry;
    const record = sample.record;
    let gap: number | null = null;
    let lapsDown = 0;
    if (leader && sample.state !== 'retired') {
      if (entry === leader) gap = 0;
      else if (sample.state === 'finished' && leader.car.finishTime !== null && car.finishTime !== null) gap = car.finishTime - leader.car.finishTime;
      else if (sample.distance >= sample.lap - 1) {
        // Atrás da linha, numa largada parada, ainda não existe diferença de tempo.
        const leaderTime = timeAtDistance(circuit, leader.car, Math.min(sample.distance, raceLaps));
        gap = leaderTime === null ? null : Math.max(0, t - leaderTime);
        lapsDown = Math.max(0, Math.floor(Math.min(leader.sample.distance, raceLaps) - sample.distance));
      }
    }
    const interval = index === 0 || gap === null || previousGap === null ? null : Math.max(0, gap - previousGap);
    previousGap = gap;
    return {
      driverId: car.driverId,
      teamId: car.teamId,
      number: car.number,
      position: index + 1,
      grid: car.grid,
      state: sample.state,
      laps: record?.lap ?? 0,
      gap,
      interval,
      lapsDown,
      compound: record?.compound ?? car.startCompound,
      wear: record?.wear ?? 0,
      pitStops: record?.pitStops ?? 0,
      penaltySeconds: record?.penaltySeconds ?? 0,
      damage: record?.damage ?? 0,
      lastLap: record?.lastLap ?? null,
      bestLap: record?.bestLap ?? null,
      speed: sample.speed,
      sample,
    };
  });
}

/** Informações da volta que o líder está fazendo no instante t. */
export function lapInfoAt(timeline: RaceTimeline, t: number): LapInfo | null {
  for (let i = timeline.laps.length - 1; i >= 0; i--) {
    const info = timeline.laps[i];
    if (info && info.start <= t) return info;
  }
  return timeline.laps[0] ?? null;
}

export interface SafetyCarSample {
  s: number;
  inPitLane: boolean;
  /** De 0 a 1: o carro aparece ao entrar na pista e some ao recolher. */
  presence: number;
}

/** Posição do safety car (à frente do líder) enquanto a prova está neutralizada. */
export function safetyCarAt(timeline: RaceTimeline, circuit: Circuit, t: number, leaderDistance: number): SafetyCarSample | null {
  const info = lapInfoAt(timeline, t);
  if (!info || info.flag !== 'sc' || t >= info.end) return null;
  const lead = 46 / circuit.length;
  const raw = leaderDistance - Math.floor(leaderDistance) + lead;
  // Na volta em que recolhe, o safety car já saiu da pista quando chega à linha.
  if (info.safetyCarIn && raw >= 1) return null;
  const s = wrap01(raw);
  const progress = (t - info.start) / Math.max(1, info.end - info.start);
  const previous = timeline.laps[info.lap - 2];
  const entering = !previous || previous.flag !== 'sc';
  const inPitLane = info.safetyCarIn && s >= circuit.pit.entry;
  const presence = Math.min(entering ? clamp(progress / 0.06, 0, 1) : 1, info.safetyCarIn ? clamp((1 - s) / 0.02, 0, 1) : 1);
  return { s, inPitLane, presence };
}

/** Eventos já acontecidos até o instante t (a lista está em ordem de tempo). */
export function eventsUntil(timeline: RaceTimeline, t: number): TimedEvent[] {
  let low = 0;
  let high = timeline.events.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((timeline.events[mid]?.time ?? Infinity) <= t) low = mid + 1;
    else high = mid;
  }
  return timeline.events.slice(0, low);
}

/** Uma bandeira vermelha interrompe a corrida exatamente neste instante? Devolve a primeira ainda não atendida. */
export function suspensionBetween(timeline: RaceTimeline, from: number, to: number): { time: number; lap: number; final: boolean } | null {
  return timeline.suspensions.find((s) => s.time > from && s.time <= to) ?? null;
}
