/**
 * Geometria dos circuitos para a transmissão visual.
 *
 * Cada pista do jogo ganha um traçado próprio, gerado de forma determinística a
 * partir do seu id e das suas características (as mesmas que o motor de corrida
 * usa): pistas de motor têm retas longas; pistas travadas têm mais curvas e
 * raios menores. O traçado é um polígono com os cantos arredondados, ou seja,
 * retas de verdade ligadas por curvas de raio constante, como num mapa de
 * circuito.
 *
 * As medidas estão em "unidades de mundo": a pista inteira cabe numa área de
 * 1000 × 640. A escala é esquemática de propósito. Em escala real, um carro de
 * 5 m numa pista de 5 km teria 2 pixels; aqui carros e largura da pista são
 * ampliados para que a disputa seja visível, como em qualquer jogo de gestão.
 * A velocidade exibida ao jogador usa o comprimento real da pista (em metros)
 * e o tempo de volta real, então os km/h continuam coerentes.
 *
 * Nada aqui decide resultado de corrida: é só o desenho por onde os carros
 * passam e o perfil de velocidade ao longo da volta (devagar nas curvas,
 * rápido nas retas), igual para todos.
 */
import type { Track } from '@/domain/schemas';
import { createRng, hashSeed, uniform, type Rng } from '../rng';

export type CircuitStyle = 'kart' | 'formula';

export const CIRCUIT = {
  WORLD_WIDTH: 1000,
  WORLD_HEIGHT: 640,
  MARGIN: 74,
  TRACK_WIDTH: 30,
  PIT_WIDTH: 15,
  /** Distância entre o eixo da pista e o eixo do pit lane. */
  PIT_OFFSET: 30,
  /** Espaço reservado para o prédio dos boxes, além do pit lane. */
  PIT_BUILDING: 26,
  /** Distância entre amostras do traçado. */
  STEP: 2,
  /** Comprimento da transição de entrada e de saída do pit lane. */
  PIT_RAMP: 38,
  /** Menor raio de curva aceito (o lado de dentro precisa existir). */
  MIN_RADIUS: 18,
  /** Folga mínima entre dois trechos diferentes da pista (eixo a eixo). */
  MIN_CLEARANCE: 48,
  /** Espaço de cada carro no grid, ao longo da pista. */
  GRID_SLOT: 15,
  /** Comprimento e largura do carro desenhado. */
  CAR_LENGTH: 21,
  CAR_WIDTH: 8.9,
} as const;

/** Perfil de velocidade por tipo de veículo (valores relativos à velocidade máxima). */
const SPEED_PROFILE: Record<CircuitStyle, { fullRadius: number; minSpeed: number; accel: number; brake: number; peak: number }> = {
  // Kart: pouca diferença entre reta e curva, retomada curta.
  kart: { fullRadius: 150, minSpeed: 0.46, accel: 0.0026, brake: 0.006, peak: 1.36 },
  // Monoposto: freia forte, demora a chegar à velocidade máxima.
  formula: { fullRadius: 260, minSpeed: 0.3, accel: 0.0016, brake: 0.0046, peak: 1.5 },
};

export interface CircuitCorner {
  /** Início e fim da curva, em fração da volta. */
  from: number;
  to: number;
  radius: number;
  /** 1 = curva para o lado +normal; -1 = para o outro. */
  side: 1 | -1;
}

export interface PitLane {
  /** Começo da transição de entrada e ponto em que o carro já está no pit lane (frações da volta, perto de 1). */
  entry: number;
  entryEnd: number;
  /** Começo da transição de saída e ponto em que o carro volta à pista (frações da volta, perto de 0). */
  exitStart: number;
  exit: number;
  /** Deslocamento lateral do eixo do pit lane, com sinal. */
  offset: number;
  /** Trecho em que ficam as posições de parada das equipes. */
  boxFrom: number;
  boxTo: number;
}

export interface Circuit {
  trackId: string;
  style: CircuitStyle;
  width: number;
  height: number;
  /** Comprimento do eixo da pista, em unidades de mundo. */
  length: number;
  step: number;
  count: number;
  x: number[];
  y: number[];
  heading: number[];
  curvature: number[];
  /** Velocidade relativa em cada amostra (1 = máxima). */
  speed: number[];
  /** Fração do tempo de volta gasta até cada amostra (count + 1 valores, de 0 a 1). */
  tau: number[];
  /** Deslocamento lateral da linha de corrida (os carros cortam as curvas por dentro). */
  line: number[];
  /** Lado de dentro do circuito na reta dos boxes, em relação à normal. */
  insideSign: 1 | -1;
  clockwise: boolean;
  corners: CircuitCorner[];
  pit: PitLane;
  /** Fração da volta ocupada por cada posição do grid. */
  gridSlot: number;
  /** Limites entre os setores 1/2 e 2/3. */
  sectors: [number, number];
}

interface Vertex {
  x: number;
  y: number;
  radius: number;
}

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wrapAngle = (a: number) => {
  let v = a % TAU;
  if (v > Math.PI) v -= TAU;
  if (v < -Math.PI) v += TAU;
  return v;
};
const smoothstep = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
/** Fração no intervalo [0, 1). */
export const wrap01 = (s: number) => ((s % 1) + 1) % 1;

function at<T>(list: readonly T[], index: number): T {
  const n = list.length;
  const value = list[((index % n) + n) % n];
  if (value === undefined) throw new Error('Circuito sem amostras.');
  return value;
}

/* ------------------------------------------------------------------ */
/* 1. Polígono-base                                                    */
/* ------------------------------------------------------------------ */

/** Códigos de raio dos vértices de trechos especiais (o raio real é sorteado ao arredondar). */
const CHICANE = -1;
const TIGHT = -2;
const FLOWING = -3;

/**
 * Gera o contorno do circuito em duas etapas.
 *
 * 1. Um polígono grosso em torno do centro, com a reta dos boxes embaixo. Como
 *    cada vértice fica num ângulo maior que o anterior, ele nunca se cruza.
 * 2. Trechos característicos encaixados nas arestas longas: miolos (a pista
 *    entra no infield e volta), grampos, chicanes e esses. Pistas travadas
 *    recebem mais trechos; pistas de motor ficam com as retas inteiras.
 *
 * Quem garante que nada se sobrepõe é a validação feita depois (isValid).
 */
function basePolygon(rng: Rng, track: Track, style: CircuitStyle, attempt: number): Vertex[] {
  const twist = clamp((track.overtakingDifficulty - 0.3) / 0.65, 0, 1);
  const power = clamp((track.powerSensitivity - 0.15) / 0.75, 0, 1);
  const kart = style === 'kart';
  const b = lerp(0.52, 0.66, rng.next());

  // Reta dos boxes, embaixo: mais longa nas pistas de motor.
  const halfStraight = kart ? lerp(0.52, 0.7, power) : lerp(0.56, 0.8, power);
  const bottomY = b * 0.96;
  const bottomAngle = Math.atan2(bottomY, halfStraight);
  const vertices: Vertex[] = [
    { x: halfStraight, y: bottomY, radius: 0 },
    { x: -halfStraight, y: bottomY, radius: 0 },
  ];
  const count = 3 + Math.floor(rng.next() * 3);
  const from = Math.PI - bottomAngle;
  const span = Math.PI + 2 * bottomAngle;
  for (let i = 0; i < count; i++) {
    const angle = from + (span * (i + 0.5 + uniform(rng, -0.28, 0.28))) / count;
    const rho = uniform(rng, 0.8, 1);
    vertices.push({ x: rho * Math.cos(angle), y: b * rho * Math.sin(angle), radius: 0 });
  }
  // locked[i]: a aresta de i para i+1 não recebe trechos (reta dos boxes e interior de outros trechos).
  const locked: boolean[] = vertices.map((_, i) => i === 0);

  const wanted = Math.round((kart ? lerp(3, 5.5, twist) : lerp(2, 5, twist)) + uniform(rng, -0.6, 0.9));
  const features = Math.max(0, wanted - Math.floor(attempt / 30));
  for (let f = 0; f < features; f++) {
    // Aresta livre mais longa.
    let index = -1;
    let length = 0.4;
    for (let i = 0; i < vertices.length; i++) {
      if (locked[i]) continue;
      const p = at(vertices, i);
      const q = at(vertices, i + 1);
      const l = Math.hypot(q.x - p.x, q.y - p.y);
      if (l > length) {
        index = i;
        length = l;
      }
    }
    if (index < 0) break;
    const p = at(vertices, index);
    const q = at(vertices, index + 1);
    const dx = (q.x - p.x) / length;
    const dy = (q.y - p.y) / length;
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    // Normal que aponta para o centro do circuito.
    const inward = -dy * -mx + dx * -my >= 0 ? 1 : -1;
    const nx = -dy * inward;
    const ny = dx * inward;
    const toCentre = Math.hypot(mx, my);
    const middle = uniform(rng, 0.38, 0.62) * length;
    const along = (d: number, lateral: number, radius: number): Vertex => ({ x: p.x + dx * d + nx * lateral, y: p.y + dy * d + ny * lateral, radius });

    const roll = rng.next();
    let inserted: Vertex[];
    if (length > 0.72 && roll < (kart ? 0.3 : 0.42)) {
      // Miolo: a pista entra no infield, corre paralela e volta.
      const width = clamp(uniform(rng, 0.26, 0.42) * length, 0.22, 0.6);
      const depth = Math.min(uniform(rng, 0.2, 0.4), toCentre * 0.5);
      const skewIn = uniform(rng, -0.12, 0.22) * width;
      const skewOut = uniform(rng, -0.12, 0.22) * width;
      inserted = [along(middle - width / 2, 0, TIGHT), along(middle - width / 2 + skewIn, depth, TIGHT), along(middle + width / 2 - skewOut, depth * uniform(rng, 0.7, 1), TIGHT), along(middle + width / 2, 0, TIGHT)];
    } else if (length > 0.5 && roll < (kart ? 0.68 : 0.7)) {
      // Grampo: um dedo estreito, para dentro ou (às vezes) para fora.
      const width = uniform(rng, 0.15, 0.21);
      const outward = rng.next() < 0.3;
      const depth = outward ? -uniform(rng, 0.16, 0.28) : Math.min(uniform(rng, 0.24, 0.46), toCentre * 0.55);
      const lean = uniform(rng, -0.08, 0.08);
      inserted = [along(middle - width / 2, 0, TIGHT), along(middle - width / 2 + lean, depth, TIGHT), along(middle + width / 2 + lean, depth, TIGHT), along(middle + width / 2, 0, TIGHT)];
    } else if (length > 0.62 && roll < 0.86) {
      // Esses: três mudanças de direção encadeadas.
      const spacing = 0.115;
      const lateral = 0.05 * (rng.next() < 0.5 ? 1 : -1);
      inserted = [along(middle - spacing, lateral, FLOWING), along(middle, -lateral, FLOWING), along(middle + spacing, lateral, FLOWING)];
    } else {
      // Chicane: duas curvas curtas em S.
      const lateral = 0.042 * (rng.next() < 0.5 ? 1 : -1);
      inserted = [along(middle - 0.055, -lateral, CHICANE), along(middle + 0.055, lateral, CHICANE)];
    }
    vertices.splice(index + 1, 0, ...inserted);
    // As arestas internas do trecho ficam fechadas; a que sai dele continua livre.
    locked.splice(index + 1, 0, ...inserted.map((_, k) => k < inserted.length - 1));
  }
  return vertices;
}

/** Encaixa o polígono na área do mundo, mantendo a proporção. Espelha quando o sentido é anti-horário. */
function fitToWorld(vertices: Vertex[], mirror: boolean): Vertex[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  const availableW = CIRCUIT.WORLD_WIDTH - 2 * CIRCUIT.MARGIN;
  const availableH = CIRCUIT.WORLD_HEIGHT - 2 * CIRCUIT.MARGIN;
  const scale = Math.min(availableW / (maxX - minX), availableH / (maxY - minY));
  const offsetX = (CIRCUIT.WORLD_WIDTH - (maxX - minX) * scale) / 2;
  const offsetY = (CIRCUIT.WORLD_HEIGHT - (maxY - minY) * scale) / 2;
  return vertices.map((v) => {
    const x = offsetX + (v.x - minX) * scale;
    return { x: mirror ? CIRCUIT.WORLD_WIDTH - x : x, y: offsetY + (v.y - minY) * scale, radius: v.radius };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Cantos arredondados                                              */
/* ------------------------------------------------------------------ */

interface Fillet {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  radius: number;
  /** Ângulo de virada, com sinal. */
  turn: number;
  startAngle: number;
}

/** Calcula os arcos de cada vértice. Devolve null se algum canto não couber. */
function buildFillets(rng: Rng, vertices: Vertex[], track: Track, style: CircuitStyle): Fillet[] | null {
  const n = vertices.length;
  const twist = clamp((track.overtakingDifficulty - 0.3) / 0.65, 0, 1);
  const turns: number[] = [];
  const tangents: number[] = [];
  const edges: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = at(vertices, i - 1);
    const c = at(vertices, i);
    const q = at(vertices, i + 1);
    const inAngle = Math.atan2(c.y - p.y, c.x - p.x);
    const outAngle = Math.atan2(q.y - c.y, q.x - c.x);
    const turn = wrapAngle(outAngle - inAngle);
    const size = Math.abs(turn);
    if (size > 2.65) return null; // grampo fechado demais para arredondar
    // Raio desejado: curvas suaves são longas; grampos são curtos.
    let radius: number;
    if (c.radius === CHICANE) radius = uniform(rng, 20, 28);
    else if (c.radius === TIGHT) radius = uniform(rng, 24, 44);
    else if (c.radius === FLOWING) radius = uniform(rng, 44, 70);
    else if (size < 0.5) radius = uniform(rng, 150, 300);
    else if (size < 1.2) radius = uniform(rng, lerp(70, 40, twist), lerp(170, 100, twist));
    else if (size < 2) radius = uniform(rng, 30, lerp(80, 52, twist));
    else radius = uniform(rng, 20, 34);
    if (style === 'kart') radius = Math.max(radius * 0.76, CIRCUIT.MIN_RADIUS + 1);
    turns.push(turn);
    tangents.push(Math.max(radius, CIRCUIT.MIN_RADIUS) * Math.tan(size / 2));
    edges.push(Math.hypot(q.x - c.x, q.y - c.y));
  }
  // As tangentes de dois cantos vizinhos precisam caber na aresta entre eles.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const available = at(edges, i) - 8;
      const used = at(tangents, i) + at(tangents, j);
      if (used > available) {
        const factor = available / used;
        tangents[i] = at(tangents, i) * factor;
        tangents[j] = at(tangents, j) * factor;
      }
    }
  }
  const fillets: Fillet[] = [];
  for (let i = 0; i < n; i++) {
    const p = at(vertices, i - 1);
    const c = at(vertices, i);
    const q = at(vertices, i + 1);
    const turn = at(turns, i);
    const size = Math.abs(turn);
    const tangent = at(tangents, i);
    const radius = size < 1e-3 ? 1e6 : tangent / Math.tan(size / 2);
    if (radius < CIRCUIT.MIN_RADIUS) return null;
    const inLength = Math.hypot(c.x - p.x, c.y - p.y);
    const outLength = Math.hypot(q.x - c.x, q.y - c.y);
    const ix = (c.x - p.x) / inLength;
    const iy = (c.y - p.y) / inLength;
    const ox = (q.x - c.x) / outLength;
    const oy = (q.y - c.y) / outLength;
    const ax = c.x - ix * tangent;
    const ay = c.y - iy * tangent;
    const sign = turn >= 0 ? 1 : -1;
    // Normal do sentido de chegada, virada para o lado da curva.
    const cx = ax - iy * radius * sign;
    const cy = ay + ix * radius * sign;
    fillets.push({ ax, ay, bx: c.x + ox * tangent, by: c.y + oy * tangent, cx, cy, radius, turn, startAngle: Math.atan2(ay - cy, ax - cx) });
  }
  return fillets;
}

/** Percorre retas e arcos e devolve uma linha densa (um ponto por unidade). */
function tracePath(fillets: Fillet[]): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < fillets.length; i++) {
    const f = at(fillets, i);
    const next = at(fillets, i + 1);
    const arcLength = Math.abs(f.turn) * f.radius;
    const arcSteps = Math.max(2, Math.ceil(arcLength));
    for (let k = 0; k < arcSteps; k++) {
      const angle = f.startAngle + (f.turn * k) / arcSteps;
      x.push(f.cx + f.radius * Math.cos(angle));
      y.push(f.cy + f.radius * Math.sin(angle));
    }
    const lineLength = Math.hypot(next.ax - f.bx, next.ay - f.by);
    const lineSteps = Math.max(1, Math.ceil(lineLength));
    for (let k = 0; k < lineSteps; k++) {
      x.push(lerp(f.bx, next.ax, k / lineSteps));
      y.push(lerp(f.by, next.ay, k / lineSteps));
    }
  }
  return { x, y };
}

/** Reamostra a linha fechada em pontos igualmente espaçados, começando em `startLength`. */
function resample(path: { x: number[]; y: number[] }, startLength: number): { x: number[]; y: number[]; length: number; step: number } {
  const n = path.x.length;
  const cumulative: number[] = [0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cumulative.push(at(cumulative, i) + Math.hypot(at(path.x, j) - at(path.x, i), at(path.y, j) - at(path.y, i)));
  }
  const length = at(cumulative, n);
  const count = Math.round(length / CIRCUIT.STEP);
  const step = length / count;
  const x: number[] = [];
  const y: number[] = [];
  let segment = 0;
  for (let k = 0; k < count; k++) {
    const target = (startLength + k * step) % length;
    if (k === 0 || target < at(cumulative, segment)) segment = 0;
    while (segment < n - 1 && at(cumulative, segment + 1) < target) segment++;
    const span = at(cumulative, segment + 1) - at(cumulative, segment);
    const t = span > 0 ? (target - at(cumulative, segment)) / span : 0;
    const j = (segment + 1) % n;
    x.push(lerp(at(path.x, segment), at(path.x, j), t));
    y.push(lerp(at(path.y, segment), at(path.y, j), t));
  }
  return { x, y, length, step };
}

/* ------------------------------------------------------------------ */
/* 3. Montagem e validação                                             */
/* ------------------------------------------------------------------ */

function movingAverage(values: number[], radius: number): number[] {
  const n = values.length;
  const out: number[] = [];
  let sum = 0;
  for (let k = -radius; k <= radius; k++) sum += at(values, k);
  for (let i = 0; i < n; i++) {
    out.push(sum / (2 * radius + 1));
    sum += at(values, i + radius + 1) - at(values, i - radius);
  }
  return out;
}

/** Fração do tempo de volta acumulada até cada amostra, para um perfil de velocidade. */
function lapFractions(speed: number[], step: number): number[] {
  const count = speed.length;
  const tau: number[] = [0];
  for (let i = 0; i < count; i++) tau.push(at(tau, i) + (2 * step) / (at(speed, i) + at(speed, i + 1)));
  const total = at(tau, count);
  return tau.map((v) => v / total);
}

/** Maior velocidade da volta em relação à média. */
function peakPace(tau: number[], count: number): number {
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, 1 / count / (at(tau, i + 1) - at(tau, i)));
  return peak;
}

function assemble(trackId: string, style: CircuitStyle, fillets: Fillet[], clockwise: boolean): Circuit | null {
  // A volta começa na reta dos boxes: entre o fim do arco do vértice 0 e o começo do arco do vértice 1.
  const first = at(fillets, 0);
  const second = at(fillets, 1);
  const straight = Math.hypot(second.ax - first.bx, second.ay - first.by);
  const behind = straight * 0.6;
  const ahead = straight - behind;
  if (behind < 150 || ahead < 90) return null;

  const dense = tracePath(fillets);
  // O traçado denso começa no arco do vértice 0; a linha de chegada fica `behind` depois do fim dele.
  const startLength = Math.abs(first.turn) * first.radius + behind;
  const sampled = resample(dense, startLength);
  const { x, y, length, step } = sampled;
  const count = x.length;

  const heading: number[] = [];
  for (let i = 0; i < count; i++) heading.push(Math.atan2(at(y, i + 1) - at(y, i - 1), at(x, i + 1) - at(x, i - 1)));
  const rawCurvature: number[] = [];
  for (let i = 0; i < count; i++) rawCurvature.push(wrapAngle(at(heading, i + 1) - at(heading, i - 1)) / (2 * step));
  const curvature = movingAverage(rawCurvature, 2);

  // Perfil de velocidade: limite de cada curva, depois os limites de aceleração e de freada.
  const profile = SPEED_PROFILE[style];
  const speed = curvature.map((k) => {
    const radius = Math.abs(k) < 1e-5 ? Infinity : 1 / Math.abs(k);
    return clamp(Math.sqrt(radius / profile.fullRadius), profile.minSpeed, 1);
  });
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      speed[j] = Math.min(at(speed, j), Math.sqrt(at(speed, i) ** 2 + 2 * profile.accel * step));
    }
    for (let i = count - 1; i >= 0; i--) {
      const j = (i + 1) % count;
      speed[i] = Math.min(at(speed, i), Math.sqrt(at(speed, j) ** 2 + 2 * profile.brake * step));
    }
  }
  // A velocidade máxima não passa de um múltiplo plausível da média da volta (cerca de 330 km/h
  // para 230 km/h de média num F1). Em traçados muito travados o perfil é achatado até caber.
  let tau = lapFractions(speed, step);
  if (peakPace(tau, count) > profile.peak) {
    let low = 0.2;
    let high = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (low + high) / 2;
      if (peakPace(lapFractions(speed.map((v) => v ** mid), step), count) > profile.peak) high = mid;
      else low = mid;
    }
    for (let i = 0; i < count; i++) speed[i] = at(speed, i) ** low;
    tau = lapFractions(speed, step);
  }

  // Linha de corrida: os carros se aproximam do lado de dentro das curvas, com transição suave.
  const lineLimit = CIRCUIT.TRACK_WIDTH / 2 - CIRCUIT.CAR_WIDTH / 2 - 2;
  const line = movingAverage(movingAverage(curvature.map((k) => clamp(k * 520, -lineLimit, lineLimit)), 12), 12);

  // Curvas (para zebras e áreas de escape).
  const corners: CircuitCorner[] = [];
  const threshold = 1 / 320;
  let open: { from: number; sum: number; samples: number; side: 1 | -1 } | null = null;
  for (let i = 0; i <= count; i++) {
    const k = i < count ? at(curvature, i) : 0;
    const side: 1 | -1 = k >= 0 ? 1 : -1;
    const inside = Math.abs(k) > threshold;
    if (open && (!inside || side !== open.side)) {
      if (open.samples >= 5) corners.push({ from: open.from / count, to: i / count, radius: open.samples / open.sum, side: open.side });
      open = null;
    }
    if (inside && !open) open = { from: i, sum: 0, samples: 0, side };
    if (open) {
      open.sum += Math.abs(k);
      open.samples++;
    }
  }

  // Lado de dentro na linha de chegada: o lado em que está o centro do circuito.
  const cx = x.reduce((s, v) => s + v, 0) / count;
  const cy = y.reduce((s, v) => s + v, 0) / count;
  const h0 = at(heading, 0);
  const insideSign: 1 | -1 = (cx - at(x, 0)) * -Math.sin(h0) + (cy - at(y, 0)) * Math.cos(h0) >= 0 ? 1 : -1;

  const entryLength = Math.min(behind * 0.93, 330);
  const exitLength = ahead * 0.93;
  const ramp = Math.min(CIRCUIT.PIT_RAMP, exitLength * 0.45);
  const pit: PitLane = {
    entry: 1 - entryLength / length,
    entryEnd: 1 - (entryLength - CIRCUIT.PIT_RAMP) / length,
    exitStart: (exitLength - ramp) / length,
    exit: exitLength / length,
    offset: insideSign * CIRCUIT.PIT_OFFSET,
    boxFrom: 1 - (entryLength - CIRCUIT.PIT_RAMP - 14) / length,
    boxTo: 1 - 16 / length,
  };

  const circuit: Circuit = {
    trackId,
    style,
    width: CIRCUIT.WORLD_WIDTH,
    height: CIRCUIT.WORLD_HEIGHT,
    length,
    step,
    count,
    x,
    y,
    heading,
    curvature,
    speed,
    tau,
    line,
    insideSign,
    clockwise,
    corners,
    pit,
    gridSlot: CIRCUIT.GRID_SLOT / length,
    sectors: [1 / 3, 2 / 3],
  };
  return isValid(circuit) ? circuit : null;
}

/** Confere se nenhum trecho passa perto demais de outro e se a área dos boxes está livre. */
function isValid(circuit: Circuit): boolean {
  const { x, y, count, step } = circuit;
  const stride = 3;
  const minArc = 150 / step;
  for (let i = 0; i < count; i += stride) {
    for (let j = i + stride; j < count; j += stride) {
      const arc = Math.min(j - i, count - (j - i));
      if (arc < minArc) continue;
      if (Math.hypot(at(x, i) - at(x, j), at(y, i) - at(y, j)) < CIRCUIT.MIN_CLEARANCE) return false;
    }
  }
  // Pit lane e prédio: o lado de dentro da reta precisa estar desocupado.
  const reach = CIRCUIT.PIT_OFFSET + CIRCUIT.PIT_WIDTH / 2 + CIRCUIT.PIT_BUILDING;
  const needed = CIRCUIT.TRACK_WIDTH / 2 + 10;
  const from = Math.floor(circuit.pit.entry * count);
  const to = Math.ceil(circuit.pit.exit * count) + count;
  for (let k = from; k <= to; k += stride) {
    const i = k % count;
    const px = at(x, i) - Math.sin(at(circuit.heading, i)) * reach * circuit.insideSign;
    const py = at(y, i) + Math.cos(at(circuit.heading, i)) * reach * circuit.insideSign;
    for (let j = 0; j < count; j += stride) {
      const arc = Math.min(Math.abs(j - i), count - Math.abs(j - i));
      if (arc < minArc) continue;
      if (Math.hypot(px - at(x, j), py - at(y, j)) < needed) return false;
    }
  }
  return true;
}

/** Traçado de segurança (oval arredondado), usado só se nenhuma tentativa for válida. */
function fallbackPolygon(): Vertex[] {
  return [
    { x: 0.72, y: 0.5, radius: 0 },
    { x: -0.72, y: 0.5, radius: 0 },
    { x: -1, y: 0, radius: 0 },
    { x: -0.6, y: -0.5, radius: 0 },
    { x: 0.6, y: -0.5, radius: 0 },
    { x: 1, y: 0, radius: 0 },
  ];
}

const cache = new Map<string, Circuit>();

/**
 * Circuito de uma pista. O resultado depende só do id e das características da
 * pista, então é sempre o mesmo, em qualquer save e em qualquer sessão.
 */
export function buildCircuit(track: Track, style: CircuitStyle): Circuit {
  const key = `${track.id}|${style}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const clockwise = createRng(hashSeed('circuit', track.id, 'direction')).next() < 0.68;
  let circuit: Circuit | null = null;
  for (let attempt = 0; attempt < 150 && !circuit; attempt++) {
    const rng = createRng(hashSeed('circuit', track.id, attempt));
    const vertices = fitToWorld(basePolygon(rng, track, style, attempt), !clockwise);
    const fillets = buildFillets(rng, vertices, track, style);
    if (fillets) circuit = assemble(track.id, style, fillets, clockwise);
  }
  if (!circuit) {
    const rng = createRng(hashSeed('circuit', track.id, 'fallback'));
    const fillets = buildFillets(rng, fitToWorld(fallbackPolygon(), !clockwise), track, style);
    circuit = fillets ? assemble(track.id, style, fillets, clockwise) : null;
  }
  if (!circuit) throw new Error(`Não foi possível gerar o circuito de ${track.id}.`);
  cache.set(key, circuit);
  return circuit;
}

/* ------------------------------------------------------------------ */
/* 4. Consultas                                                        */
/* ------------------------------------------------------------------ */

export interface TrackPose {
  x: number;
  y: number;
  heading: number;
}

/** Posição e direção num ponto da volta (fração), com deslocamento lateral opcional. */
export function poseAt(circuit: Circuit, s: number, lateral = 0): TrackPose {
  const position = wrap01(s) * circuit.count;
  const i = Math.floor(position);
  const t = position - i;
  const h0 = at(circuit.heading, i);
  const heading = h0 + wrapAngle(at(circuit.heading, i + 1) - h0) * t;
  const x = lerp(at(circuit.x, i), at(circuit.x, i + 1), t);
  const y = lerp(at(circuit.y, i), at(circuit.y, i + 1), t);
  return { x: x - Math.sin(heading) * lateral, y: y + Math.cos(heading) * lateral, heading };
}

function sampleLinear(values: readonly number[], circuit: Circuit, s: number): number {
  const position = wrap01(s) * circuit.count;
  const i = Math.floor(position);
  return lerp(at(values, i), at(values, i + 1), position - i);
}

export const racingLineAt = (circuit: Circuit, s: number) => sampleLinear(circuit.line, circuit, s);

/** Fração do tempo de volta em que um carro em ritmo normal chega ao ponto s (aceita s fora de [0, 1]). */
export function tauAt(circuit: Circuit, s: number): number {
  const whole = Math.floor(s);
  const position = (s - whole) * circuit.count;
  const i = Math.min(circuit.count - 1, Math.floor(position));
  return whole + lerp(at(circuit.tau, i), circuit.tau[i + 1] ?? 1, position - i);
}

/** Inverso de tauAt: ponto da volta alcançado numa fração do tempo de volta. */
export function sAtTau(circuit: Circuit, tau: number): number {
  const whole = Math.floor(tau);
  const target = tau - whole;
  let low = 0;
  let high = circuit.count;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if ((circuit.tau[mid] ?? 1) <= target) low = mid;
    else high = mid;
  }
  const a = circuit.tau[low] ?? 0;
  const b = circuit.tau[low + 1] ?? 1;
  return whole + (low + (b > a ? (target - a) / (b - a) : 0)) / circuit.count;
}

/**
 * Velocidade no ponto s em relação à média da volta (1 = velocidade média).
 * Multiplicada por comprimento real ÷ tempo de volta, dá a velocidade real.
 */
export function paceAt(circuit: Circuit, s: number): number {
  const position = wrap01(s) * circuit.count;
  const i = Math.min(circuit.count - 1, Math.floor(position));
  const dTau = (circuit.tau[i + 1] ?? 1) - at(circuit.tau, i);
  return dTau > 0 ? 1 / circuit.count / dTau : 1;
}

/** Deslocamento lateral do pit lane no ponto s (0 fora dele; a transição é suave). */
export function pitLateralAt(circuit: Circuit, s: number): number {
  const p = circuit.pit;
  const v = wrap01(s);
  if (v >= p.entry) return p.offset * smoothstep((v - p.entry) / (p.entryEnd - p.entry));
  if (v <= p.exitStart) return p.offset;
  if (v < p.exit) return p.offset * (1 - smoothstep((v - p.exitStart) / (p.exit - p.exitStart)));
  return 0;
}

/** Ponto de parada de uma equipe no pit lane (as equipes se distribuem ao longo dos boxes). */
export function pitBoxAt(circuit: Circuit, index: number, count: number): number {
  const p = circuit.pit;
  return lerp(p.boxFrom, p.boxTo, count <= 1 ? 0.5 : 0.08 + (0.84 * index) / (count - 1));
}

/** Setor (1 a 3) de um ponto da volta. */
export function sectorAt(circuit: Circuit, s: number): 1 | 2 | 3 {
  const v = wrap01(s);
  return v < circuit.sectors[0] ? 1 : v < circuit.sectors[1] ? 2 : 3;
}
