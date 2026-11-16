/**
 * Cena da corrida: desenha um quadro (pista, carros, safety car, efeitos e
 * etiquetas) para um instante da linha do tempo.
 *
 * A posição de cada carro ao longo da pista vem da linha do tempo, isto é, do
 * motor. O que esta camada decide é só apresentação: o lado da pista em que o
 * carro anda quando disputa posição com outro, a suavização da câmera e os
 * efeitos de rodada e de abandono.
 */
import type { Driver, Team } from '@/domain/schemas';
import { vehicleFor, type VehicleDefinition } from '@/data/vehicles';
import {
  CIRCUIT,
  eventsUntil,
  lapInfoAt,
  pitLateralAt,
  poseAt,
  racingLineAt,
  safetyCarAt,
  standingsAt,
  textHash01,
  type Circuit,
  type RaceTimeline,
  type StandingRow,
} from '@/engine';
import { accentFor, drawVectorCar, helmetFor, liveryFor, safetyCarSprite } from './liveries';
import { drawBridges, drawTrack, gridLateral, type TrackArt } from './trackPainter';

export type CameraMode = 'overview' | 'follow';

export interface SceneInput {
  timeline: RaceTimeline;
  circuit: Circuit;
  art: TrackArt;
  teams: Readonly<Record<string, Team>>;
  drivers: Readonly<Record<string, Driver>>;
  time: number;
  camera: CameraMode;
  /** Carro em destaque (selecionado); a câmera de acompanhamento segue este. */
  focusId: string;
  /** Carros do jogador: o dele como piloto, ou os da equipe que ele dirige. */
  mineIds: ReadonlySet<string>;
  /** Luzes de largada acesas (0 a 5), ou null fora do procedimento de largada. */
  lights: number | null;
}

/** Estado que passa de um quadro para o outro (suavizações). */
export interface SceneMemory {
  lateral: Map<string, number>;
  /** Lado da pista (1 ou -1) que cada carro ocupa enquanto disputa posição. */
  side: Map<string, number>;
  /** Recuo visual de cada carro ao longo da pista, em fração da volta (ver formation). */
  shift: Map<string, number>;
  camera: { x: number; y: number; scale: number } | null;
  lastFrame: number;
  /** Posição de cada carro na tela no último quadro, para seleção por clique. */
  hits: { driverId: string; x: number; y: number }[];
}

export function createSceneMemory(): SceneMemory {
  return { lateral: new Map(), side: new Map(), shift: new Map(), camera: null, lastFrame: 0, hits: [] };
}

const SAFETY_CAR_SIZE = { length: 22, width: 10.8 };

/** Distância lateral de cada carro ao eixo quando dois andam lado a lado. */
const LANE = 5.5;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const smooth = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/** Sigla de três letras do piloto, como nas transmissões ("De Groot" vira DEG). */
export function driverCode(lastName: string): string {
  return lastName
    .replace(/[^\p{L}]/gu, '')
    .slice(0, 3)
    .toUpperCase();
}

function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const light = (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  return light > 0.58 ? '#0b0d11' : '#ffffff';
}

export interface Placed {
  row: StandingRow;
  x: number;
  y: number;
  heading: number;
  alpha: number;
  /** Deslocamento lateral em relação ao eixo da pista e ponto da volta em que o carro é desenhado. */
  lateral: number;
  along: number;
}

interface Formation {
  /** Deslocamento lateral desejado de cada carro. */
  lateral: Map<string, number>;
  /** Recuo ao longo da pista (fração da volta, sempre <= 0). */
  shift: Map<string, number>;
}

/**
 * Formação dos carros na pista.
 *
 * Lado: carros sozinhos seguem a linha de corrida. Quando dois ficam próximos,
 * cada um toma um lado e o mantém até a disputa acabar; por isso a ultrapassagem
 * acontece lado a lado, sem os carros trocarem de faixa no meio dela. Quem chega
 * por trás vai para o lado de dentro da próxima curva.
 *
 * Recuo: o motor trabalha com diferenças de décimos de segundo, que na escala
 * do desenho são menores do que um carro. Para que dois carros na mesma faixa
 * nunca se sobreponham, o de trás é desenhado um pouco mais atrás do que a sua
 * posição exata. A ordem na pista e a classificação não mudam.
 *
 * Com safety car (`singleFile`), todos ficam em fila única atrás dele.
 */
function formation(rows: StandingRow[], circuit: Circuit, memory: SceneMemory, length: number, width: number, singleFile: boolean): Formation {
  const lateral = new Map<string, number>();
  const shift = new Map<string, number>();
  const onTrack = rows.filter(
    (r) =>
      (r.state === 'racing' || r.state === 'finished' || r.state === 'spin') && !r.sample.inPitLane && (r.sample.gridSlot === null || r.sample.inLap > 0.035),
  );
  for (const id of [...memory.side.keys()]) if (!onTrack.some((r) => r.driverId === id)) memory.side.delete(id);
  if (onTrack.length === 0) return { lateral, shift };

  // Ordem na pista, da frente para trás, começando depois do maior espaço vazio.
  const sorted = [...onTrack].sort((a, b) => b.sample.s - a.sample.s);
  let start = 0;
  let widest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const ahead = sorted[(i - 1 + sorted.length) % sorted.length];
    const current = sorted[i];
    if (!ahead || !current) continue;
    const gap = (ahead.sample.s - current.sample.s + 1) % 1 || (sorted.length === 1 ? 1 : 0);
    if (gap > widest) {
      widest = gap;
      start = i;
    }
  }
  const ordered = sorted.map((_, i) => sorted[(start + i) % sorted.length]).filter((r): r is StandingRow => r !== undefined);
  // Distância (em unidades) de cada carro para o da frente; o primeiro não tem ninguém por perto.
  const gapAhead = ordered.map((row, i) => {
    const ahead = ordered[i - 1];
    return i === 0 || !ahead ? Infinity : ((ahead.sample.s - row.sample.s + 1) % 1) * circuit.length;
  });

  const near = length * 1.7;
  const sides: number[] = [];
  const closeness: number[] = [];
  ordered.forEach((row, i) => {
    const front = gapAhead[i] ?? Infinity;
    const back = gapAhead[i + 1] ?? Infinity;
    // Atrás do safety car a fila é única: ninguém abre para disputar.
    const c = singleFile ? 0 : smooth(1 - Math.min(front, back) / near);
    closeness.push(c);
    if (c <= 0.001) {
      memory.side.delete(row.driverId);
      sides.push(0);
      return;
    }
    let side = memory.side.get(row.driverId) ?? 0;
    if (side === 0) {
      const inside = Math.sign(racingLineAt(circuit, row.sample.s + 0.012)) || (textHash01(`lane|${row.driverId}`) < 0.5 ? 1 : -1);
      if (front <= back) {
        // Chegou em quem vai à frente: toma o lado oposto ao dele (ou o de dentro, se ele está livre).
        const aheadSide = sides[i - 1] ?? 0;
        side = aheadSide !== 0 ? -aheadSide : inside;
      } else {
        // Está sendo alcançado: abre para o lado oposto ao de quem vem (que ficará por dentro).
        const behind = ordered[i + 1];
        const behindSide = behind ? (memory.side.get(behind.driverId) ?? 0) : 0;
        side = behindSide !== 0 ? -behindSide : -inside;
      }
      memory.side.set(row.driverId, side);
    }
    sides.push(side);
  });

  const limit = CIRCUIT.TRACK_WIDTH / 2 - width / 2 - 1.2;
  ordered.forEach((row, i) => {
    const c = closeness[i] ?? 0;
    lateral.set(row.driverId, clamp(racingLineAt(circuit, row.sample.s) * (1 - 0.8 * c) + (sides[i] ?? 0) * LANE * c, -limit, limit));
  });

  // Recuo: da frente para trás, cada carro respeita os que vão à frente na mesma faixa.
  const shown: number[] = [];
  let travelled = 0;
  ordered.forEach((row, i) => {
    if (i > 0) travelled -= gapAhead[i] ?? 0;
    let position = travelled;
    const mine = memory.lateral.get(row.driverId) ?? lateral.get(row.driverId) ?? 0;
    for (let j = Math.max(0, i - 4); j < i; j++) {
      const other = ordered[j];
      if (!other) continue;
      const theirs = memory.lateral.get(other.driverId) ?? lateral.get(other.driverId) ?? 0;
      // Lado a lado (faixas diferentes) podem emparelhar; na mesma faixa, um carro de distância.
      const overlap = 1 - smooth((Math.abs(theirs - mine) - width * 0.45) / (width * 0.5));
      // Por dentro de uma curva o caminho é mais curto do que no eixo da pista: a distância
      // medida no eixo precisa ser maior para os carros não se encostarem.
      const curvature = circuit.curvature[Math.floor(row.sample.s * circuit.count) % circuit.count] ?? 0;
      const inner = 1 / clamp(1 - curvature * mine, 0.5, 1.5);
      position = Math.min(position, (shown[j] ?? 0) - length * 1.08 * overlap * Math.max(1, inner));
    }
    shown.push(position);
    shift.set(row.driverId, (position - travelled) / circuit.length);
  });
  return { lateral, shift };
}

/**
 * Posição de cada carro no quadro: ponto da pista (da linha do tempo), lado da pista e recuo
 * (da formação), com as suavizações guardadas em `memory`. `dt` é o tempo real desde o quadro
 * anterior, em segundos. Sem dependência de canvas, para poder ser testada.
 */
export function placeCars(
  rows: StandingRow[],
  circuit: Circuit,
  memory: SceneMemory,
  dt: number,
  singleFile: boolean,
  size: Pick<VehicleDefinition, 'length' | 'width'>,
): Placed[] {
  const targets = formation(rows, circuit, memory, size.length, size.width, singleFile);
  const ease = 1 - Math.exp(-dt * 7);
  // O recuo muda mais devagar que o lado: quando o safety car entra, a fila se forma aos poucos.
  const slide = 1 - Math.exp(-dt * 2.2);
  const placed: Placed[] = [];
  for (const row of rows) {
    const { sample } = row;
    let alpha = 1;
    let target: number;
    let turn = 0;
    if (sample.state === 'retired') {
      // O carro sai para fora da pista, fica alguns segundos e é recolhido.
      const out = textHash01(`side|${row.driverId}`) < 0.5 ? 1 : -1;
      const crashed = sample.reason === 'crash' || sample.reason === 'collision';
      target = out * (CIRCUIT.TRACK_WIDTH / 2 + 8) * smooth(sample.retiredFor / 3);
      if (crashed) turn = out * 1.9 * smooth(sample.retiredFor / 1.5);
      alpha = 1 - smooth((sample.retiredFor - 22) / 8);
    } else if (sample.inPitLane) {
      target = pitLateralAt(circuit, sample.s) + (sample.inBox ? Math.sign(circuit.pit.offset) * 2.6 : 0);
    } else {
      target = targets.lateral.get(row.driverId) ?? racingLineAt(circuit, sample.s);
      if (sample.gridSlot !== null) {
        // Na largada o carro sai da sua posição do grid e converge para a linha de corrida.
        const blend = 1 - smooth(sample.inLap / 0.035);
        target = target * (1 - blend) + gridLateral(sample.gridSlot) * blend;
      }
    }
    if (alpha <= 0) {
      memory.lateral.delete(row.driverId);
      memory.shift.delete(row.driverId);
      continue;
    }
    const previous = memory.lateral.get(row.driverId);
    // No pit lane e no grid (parado ou ainda atrás da linha) a posição é exata; na pista, o carro
    // muda de lado aos poucos.
    const exact = previous === undefined || sample.inPitLane || sample.state === 'grid' || (sample.gridSlot !== null && sample.inLap <= 0);
    const lateral = exact ? target : previous + (target - previous) * ease;
    memory.lateral.set(row.driverId, lateral);
    // O recuo também entra e sai aos poucos, para o carro nunca dar um salto na pista.
    const wanted = targets.shift.get(row.driverId) ?? 0;
    const lastShift = memory.shift.get(row.driverId);
    const shift = exact || lastShift === undefined ? wanted : lastShift + (wanted - lastShift) * slide;
    memory.shift.set(row.driverId, shift);
    if (sample.spinPhase !== null) turn += smooth(sample.spinPhase * 1.6) * Math.PI * 3;
    const pose = poseAt(circuit, sample.s + shift, lateral);
    placed.push({ row, x: pose.x, y: pose.y, heading: pose.heading + turn, alpha, lateral, along: sample.s + shift });
  }
  return placed;
}

function drawSafetyCar(g: CanvasRenderingContext2D, time: number, length: number, width: number): void {
  const sprite = safetyCarSprite();
  if (sprite) {
    g.drawImage(sprite, -length / 2, -width / 2, length, width);
  } else {
    g.fillStyle = '#d7dce4';
    g.beginPath();
    g.roundRect(-length / 2, -width / 2, length, width, 3);
    g.fill();
    g.fillStyle = '#14171d';
    g.fillRect(-length * 0.22, -width * 0.4, length * 0.34, width * 0.8);
    g.fillStyle = '#d7dce4';
    g.fillRect(-length * 0.12, -width * 0.4, length * 0.14, width * 0.8);
  }
  // Luzes do teto, piscando.
  const on = Math.floor(time * 3) % 2 === 0;
  g.fillStyle = on ? '#ffd15c' : '#8a5a00';
  g.fillRect(-length * 0.145, -width * 0.27, length * 0.05, width * 0.25);
  g.fillStyle = on ? '#8a5a00' : '#ffd15c';
  g.fillRect(-length * 0.145, width * 0.02, length * 0.05, width * 0.25);
}

function drawLights(g: CanvasRenderingContext2D, width: number, lit: number): void {
  const size = clamp(width / 26, 12, 24);
  const gap = size * 0.5;
  const total = 5 * size + 4 * gap;
  const x0 = (width - total) / 2;
  const y0 = size * 1.2;
  g.fillStyle = 'rgba(7, 9, 13, 0.88)';
  g.beginPath();
  g.roundRect(x0 - size * 0.6, y0 - size * 0.6, total + size * 1.2, size * 2.2, size * 0.5);
  g.fill();
  for (let i = 0; i < 5; i++) {
    const cx = x0 + size / 2 + i * (size + gap);
    g.beginPath();
    g.arc(cx, y0 + size / 2, size / 2, 0, Math.PI * 2);
    g.fillStyle = i < lit ? '#ef3b2d' : '#2a1513';
    if (i < lit) {
      g.shadowColor = '#ef3b2d';
      g.shadowBlur = size * 0.8;
    }
    g.fill();
    g.shadowBlur = 0;
  }
}

/**
 * Mapa do circuito inteiro, no canto, para a câmera que acompanha um carro: mostra
 * onde está o pelotão. Cada carro é uma seta na cor da equipe, apontando no sentido em que anda.
 */
function drawMiniMap(g: CanvasRenderingContext2D, input: SceneInput, placed: Placed[], portrait: boolean, width: number): void {
  const { circuit, art } = input;
  const long = clamp(width * 0.2, 104, 190);
  const w = portrait ? long * (circuit.height / circuit.width) : long;
  const h = portrait ? long : long * (circuit.height / circuit.width);
  const x0 = 8;
  const y0 = 8;
  const scale = long / circuit.width;
  g.save();
  g.fillStyle = 'rgba(7, 9, 13, 0.8)';
  g.strokeStyle = 'rgba(151, 163, 184, 0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x0, y0, w, h, 8);
  g.fill();
  g.stroke();
  g.clip();
  // Mesma orientação da pista principal.
  g.translate(x0 + w / 2, y0 + h / 2);
  g.rotate(portrait ? -Math.PI / 2 : 0);
  g.scale(scale, scale);
  g.translate(-circuit.width / 2, -circuit.height / 2);
  g.lineJoin = 'round';
  g.strokeStyle = '#596275';
  g.lineWidth = 20;
  g.stroke(art.centre);
  const order = [...placed].sort(
    (a, b) =>
      Number(input.mineIds.has(a.row.driverId) || a.row.driverId === input.focusId) -
      Number(input.mineIds.has(b.row.driverId) || b.row.driverId === input.focusId),
  );
  for (const car of order) {
    if (car.row.state === 'retired') continue;
    const mine = input.mineIds.has(car.row.driverId);
    const focused = car.row.driverId === input.focusId;
    const size = (mine || focused ? 6.5 : 4.5) / scale;
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.heading);
    g.beginPath();
    g.moveTo(size, 0);
    g.lineTo(-size * 0.75, -size * 0.7);
    g.lineTo(-size * 0.35, 0);
    g.lineTo(-size * 0.75, size * 0.7);
    g.closePath();
    g.fillStyle = input.teams[car.row.teamId]?.color ?? '#9aa3b2';
    g.fill();
    if (mine || focused) {
      g.strokeStyle = mine ? '#ef3b2d' : '#f4f5f7';
      g.lineWidth = 1.6 / scale;
      g.stroke();
    }
    g.restore();
  }
  g.restore();
}

/** Desenha um quadro. `width` e `height` em pixels CSS; o contexto já está na escala do dispositivo. */
export function drawScene(g: CanvasRenderingContext2D, input: SceneInput, memory: SceneMemory, width: number, height: number, now: number): void {
  const { timeline, circuit, art, time } = input;
  const dt = memory.lastFrame ? Math.min(0.1, (now - memory.lastFrame) / 1000) : 0.016;
  memory.lastFrame = now;
  // O veículo é o da categoria da corrida: do kart de entrada ao Monoposto Grand Prix, cada um com o seu tamanho.
  const size = vehicleFor(timeline.categoryId);
  const rows = standingsAt(timeline, circuit, time);
  const info = lapInfoAt(timeline, time);
  const wetness = info?.wetness ?? 0;

  /* ---------- Carros: posição na pista ---------- */
  const placed = placeCars(rows, circuit, memory, dt, info?.flag === 'sc' && time < info.end, size);

  /* ---------- Câmera ---------- */
  const portrait = height > width * 1.12;
  const rotation = portrait ? -Math.PI / 2 : 0;
  const fit = portrait ? Math.min(width / circuit.height, height / circuit.width) : Math.min(width / circuit.width, height / circuit.height);
  const focus = placed.find((p) => p.row.driverId === input.focusId);
  const follow = input.camera === 'follow' && focus;
  const goal = follow
    ? { x: focus.x, y: focus.y, scale: clamp(Math.min(width, height) / (circuit.style === 'formula' ? 310 : 250), 1.2, 2.9) }
    : { x: circuit.width / 2, y: circuit.height / 2, scale: fit };
  const camera = memory.camera ?? goal;
  const pan = 1 - Math.exp(-dt * 5);
  camera.x += (goal.x - camera.x) * pan;
  camera.y += (goal.y - camera.y) * pan;
  camera.scale += (goal.scale - camera.scale) * (1 - Math.exp(-dt * 3.5));
  memory.camera = camera;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const toScreen = (x: number, y: number): [number, number] => {
    const dx = (x - camera.x) * camera.scale;
    const dy = (y - camera.y) * camera.scale;
    return [width / 2 + dx * cos - dy * sin, height / 2 + dx * sin + dy * cos];
  };

  g.save();
  g.clearRect(0, 0, width, height);
  g.translate(width / 2, height / 2);
  g.rotate(rotation);
  g.scale(camera.scale, camera.scale);
  g.translate(-camera.x, -camera.y);
  drawTrack(g, art, wetness);

  /* ---------- Carros ---------- */
  // Em telas pequenas o carro é ampliado para continuar legível.
  const grow = Math.max(1, 17 / (size.length * camera.scale));
  const recent = eventsUntil(timeline, time)
    .slice(-12)
    .filter((e) => e.type === 'overtake' && time - e.time < timeline.referenceLap * 0.035);
  const flashing = new Set(recent.map((e) => e.driverId));
  // Abandonados por baixo, líderes por cima.
  const drawOrder = [...placed].sort((a, b) => Number(b.row.state === 'retired') - Number(a.row.state === 'retired') || b.row.position - a.row.position);
  const paintCar = (car: Placed) => {
    const { row } = car;
    const team = input.teams[row.teamId];
    const colour = team?.color ?? '#9aa3b2';
    const length = size.length * grow;
    const breadth = size.width * grow;
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.heading);
    g.globalAlpha = car.alpha;
    // Sombra.
    g.fillStyle = 'rgba(0, 0, 0, 0.32)';
    g.beginPath();
    g.roundRect(-length / 2 + 1.1, -breadth / 2 + 1.5, length, breadth, 3);
    g.fill();
    const sprite = liveryFor(size.categoryId, row.teamId, colour, row.driverId, row.number);
    if (sprite) g.drawImage(sprite, -length / 2, -breadth / 2, length, breadth);
    else drawVectorCar(g, size.kind, length, breadth, colour, accentFor(row.teamId, colour), helmetFor(row.driverId));
    g.restore();

    // Fumaça de rodada e de quebra.
    const smoking = row.state === 'spin' || (row.state === 'retired' && row.sample.retiredFor < 14 && row.sample.reason !== 'fuel');
    if (smoking) {
      const phase = row.state === 'spin' ? (row.sample.spinPhase ?? 0) * 3 : row.sample.retiredFor / 2.2;
      for (let i = 0; i < 4; i++) {
        const life = (phase + i / 4) % 1;
        g.globalAlpha = (1 - life) * 0.3 * car.alpha;
        g.fillStyle = row.state === 'spin' ? '#cfd3da' : '#6f7682';
        g.beginPath();
        g.arc(
          car.x + (textHash01(`sx${i}${row.driverId}`) - 0.5) * 9,
          car.y - life * 9 + (textHash01(`sy${i}${row.driverId}`) - 0.5) * 6,
          3 + life * 8,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // Ultrapassagem recém-concluída: anel verde no carro que passou.
    if (flashing.has(row.driverId)) {
      g.strokeStyle = 'rgba(52, 211, 153, 0.9)';
      g.lineWidth = 1.6 / Math.max(0.6, camera.scale * 0.5);
      g.beginPath();
      g.arc(car.x, car.y, length * 0.72, 0, Math.PI * 2);
      g.stroke();
    }
  };
  // Viaduto: quem está no trecho de baixo é desenhado antes do tabuleiro e passa por baixo dele.
  const below = (car: Placed) => {
    const at = ((car.along % 1) + 1) % 1;
    return circuit.bridges.some((b) => at > b.under[0] && at < b.under[1]);
  };
  for (const car of drawOrder) if (below(car)) paintCar(car);
  drawBridges(g, art, wetness);
  for (const car of drawOrder) if (!below(car)) paintCar(car);

  /* ---------- Safety car ---------- */
  const leader = rows.find((r) => r.state === 'racing' && !r.sample.inPitLane);
  const safety = leader ? safetyCarAt(timeline, circuit, time, leader.sample.distance) : null;
  if (safety && safety.presence > 0) {
    const pose = poseAt(circuit, safety.s, safety.inPitLane ? pitLateralAt(circuit, safety.s) : racingLineAt(circuit, safety.s));
    g.save();
    g.translate(pose.x, pose.y);
    g.rotate(pose.heading);
    g.globalAlpha = safety.presence;
    drawSafetyCar(g, now / 1000, SAFETY_CAR_SIZE.length * grow, SAFETY_CAR_SIZE.width * grow);
    g.restore();
  }
  g.restore();

  /* ---------- Etiquetas (em pixels de tela) ---------- */
  memory.hits = placed
    .filter((p) => p.row.state !== 'retired')
    .map((p) => {
      const [x, y] = toScreen(p.x, p.y);
      return { driverId: p.row.driverId, x, y };
    });
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const priority = (p: Placed) => (p.row.driverId === input.focusId ? 0 : input.mineIds.has(p.row.driverId) ? 1 : p.row.position <= 3 ? 2 : 3);
  const labelled = placed
    .filter((p) => p.row.state !== 'retired' || p.row.sample.retiredFor < 6)
    .sort((a, b) => priority(a) - priority(b) || a.row.position - b.row.position);
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  const carPixels = size.length * grow * camera.scale;
  for (const car of labelled) {
    const { row } = car;
    const [sx, sy] = toScreen(car.x, car.y);
    if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;
    const mine = input.mineIds.has(row.driverId);
    const focused = row.driverId === input.focusId;
    const code = driverCode(input.drivers[row.driverId]?.lastName ?? '');
    const named = focused || mine;
    const text = row.state === 'retired' ? 'AB' : named ? `${row.position} ${code}` : String(row.position);
    g.font = `700 ${named ? 12 : 11}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const w = g.measureText(text).width + (named ? 9 : 7);
    const h = named ? 17 : 14;
    const x = sx - w / 2;
    const y = sy - Math.max(carPixels * 0.42, 9) - h - 4;
    const overlaps = boxes.some((b) => x < b.x + b.w + 1 && x + w + 1 > b.x && y < b.y + b.h + 1 && y + h + 1 > b.y);
    if (overlaps && priority(car) >= 2) continue;
    boxes.push({ x, y, w, h });
    const colour = input.teams[row.teamId]?.color ?? '#9aa3b2';
    g.globalAlpha = car.alpha;
    g.fillStyle = colour;
    g.beginPath();
    g.roundRect(x, y, w, h, 3);
    g.fill();
    if (mine || focused) {
      g.strokeStyle = mine ? '#ef3b2d' : '#f4f5f7';
      g.lineWidth = 2;
      g.stroke();
      // Seta apontando para o carro.
      g.fillStyle = mine ? '#ef3b2d' : '#f4f5f7';
      g.beginPath();
      g.moveTo(sx - 4, y + h + 1);
      g.lineTo(sx + 4, y + h + 1);
      g.lineTo(sx, y + h + 6);
      g.closePath();
      g.fill();
    }
    g.fillStyle = textOn(colour);
    g.fillText(text, sx, y + h / 2 + 0.5);
    g.globalAlpha = 1;
  }

  /* ---------- Chuva ---------- */
  if (wetness > 0.12) {
    const drops = Math.round(wetness * 90);
    g.strokeStyle = 'rgba(170, 200, 255, 0.28)';
    g.lineWidth = 1;
    g.beginPath();
    const fall = now / 1000;
    for (let i = 0; i < drops; i++) {
      const x = ((textHash01(`rx${i}`) * 1.3 * width + fall * 90) % (width * 1.3)) - width * 0.15;
      const y = (textHash01(`ry${i}`) * height + fall * (520 + textHash01(`rv${i}`) * 260)) % height;
      g.moveTo(x, y);
      g.lineTo(x - 3, y + 11);
    }
    g.stroke();
  }

  if (follow) drawMiniMap(g, input, placed, portrait, width);
  if (input.lights !== null) drawLights(g, width, input.lights);
}
