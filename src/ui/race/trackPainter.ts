/**
 * Desenho do circuito no canvas: gramado, áreas de escape, zebras, asfalto,
 * pit lane e boxes, linha de chegada, grid e setores.
 *
 * Tudo é vetor, montado uma vez por circuito (Path2D em unidades de mundo) e
 * redesenhado a cada quadro sob a transformação da câmera. Assim o zoom da
 * câmera que acompanha um carro continua nítido.
 */
import { CIRCUIT, pitBoxAt, pitLateralAt, poseAt, type Circuit } from '@/engine';

const COLORS = {
  grass: '#13231b',
  grassStripe: '#162a20',
  infield: 'rgba(120, 190, 150, 0.035)',
  shadow: 'rgba(0, 0, 0, 0.28)',
  gravel: '#8d7a55',
  tree: '#0c1912',
  canopy: '#15301f',
  canopyLight: '#1d4029',
  stand: '#262b36',
  seats: '#a92c24',
  runoff: '#232730',
  kerbWhite: '#e9edf2',
  kerbRed: '#d6362a',
  edge: '#c9d0da',
  asphalt: '#363b47',
  asphaltWet: '#232936',
  rubber: 'rgba(8, 9, 12, 0.2)',
  pit: '#2b303a',
  pitEdge: 'rgba(201, 208, 218, 0.55)',
  wall: '#8b95a5',
  building: '#0f131a',
  roof: '#1b212d',
  mark: 'rgba(240, 243, 247, 0.75)',
  sectors: ['#f6c343', '#60a5fa'],
} as const;

export interface TrackArt {
  circuit: Circuit;
  centre: Path2D;
  kerbs: Path2D;
  gravel: Path2D;
  runoff: Path2D;
  racingLine: Path2D;
  pitLane: Path2D;
  pitWall: Path2D;
  building: Path2D;
  roof: Path2D;
  boxes: { path: Path2D; color: string }[];
  gridMarks: Path2D;
  sectorMarks: Path2D[];
  finish: { x: number; y: number; heading: number };
  /** Cenário: árvores (longe da pista) e arquibancadas na reta dos boxes. */
  trees: { x: number; y: number; r: number }[];
  stands: Path2D;
  seats: Path2D;
}

/** Linha ao longo da pista, entre dois pontos da volta, com deslocamento lateral. */
function stretch(circuit: Circuit, from: number, to: number, lateral: number | ((s: number) => number)): Path2D {
  const path = new Path2D();
  const first = Math.floor(from * circuit.count);
  const last = Math.ceil(to * circuit.count);
  for (let k = first; k <= last; k++) {
    const s = k / circuit.count;
    const p = poseAt(circuit, s, typeof lateral === 'number' ? lateral : lateral(s));
    if (k === first) path.moveTo(p.x, p.y);
    else path.lineTo(p.x, p.y);
  }
  return path;
}

function append(target: Path2D, source: Path2D): void {
  target.addPath(source);
}

/** Retângulo alinhado à pista: centro em (s, lateral), comprimento ao longo da pista e largura através dela. */
function slab(circuit: Circuit, s: number, lateral: number, along: number, across: number): Path2D {
  const p = poseAt(circuit, s, lateral);
  const cos = Math.cos(p.heading);
  const sin = Math.sin(p.heading);
  const path = new Path2D();
  const corner = (a: number, b: number): [number, number] => [p.x + cos * a - sin * b, p.y + sin * a + cos * b];
  const points = [corner(-along / 2, -across / 2), corner(along / 2, -across / 2), corner(along / 2, across / 2), corner(-along / 2, across / 2)];
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

function hash01(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/** Menor distância de um ponto ao eixo da pista. */
function distanceToTrack(circuit: Circuit, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < circuit.count; i += 3) best = Math.min(best, Math.hypot((circuit.x[i] ?? 0) - x, (circuit.y[i] ?? 0) - y));
  return best;
}

/** Árvores espalhadas pelo terreno, sempre no mesmo lugar para a mesma pista e longe do asfalto e dos boxes. */
function scatterTrees(circuit: Circuit): TrackArt['trees'] {
  const trees: TrackArt['trees'] = [];
  const pitReach = CIRCUIT.PIT_OFFSET + CIRCUIT.PIT_WIDTH / 2 + CIRCUIT.PIT_BUILDING + 16;
  const pitFrom = poseAt(circuit, circuit.pit.entry, Math.sign(circuit.pit.offset) * pitReach * 0.5);
  const pitTo = poseAt(circuit, circuit.pit.exit, Math.sign(circuit.pit.offset) * pitReach * 0.5);
  for (let i = 0; i < 150 && trees.length < 46; i++) {
    const x = -60 + hash01(`tx|${circuit.trackId}|${i}`) * (circuit.width + 120);
    const y = -60 + hash01(`ty|${circuit.trackId}|${i}`) * (circuit.height + 120);
    if (distanceToTrack(circuit, x, y) < 52) continue;
    // Faixa dos boxes: distância ao segmento entre a entrada e a saída do pit lane.
    const dx = pitTo.x - pitFrom.x;
    const dy = pitTo.y - pitFrom.y;
    const t = Math.min(1, Math.max(0, ((x - pitFrom.x) * dx + (y - pitFrom.y) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(pitFrom.x + dx * t - x, pitFrom.y + dy * t - y) < pitReach * 0.75) continue;
    trees.push({ x, y, r: 7 + hash01(`tr|${circuit.trackId}|${i}`) * 8 });
  }
  return trees;
}

/** Prepara o desenho de um circuito. `boxColors` são as cores das equipes, na ordem dos boxes. */
export function buildTrackArt(circuit: Circuit, boxColors: readonly string[], gridSize: number): TrackArt {
  const half = CIRCUIT.TRACK_WIDTH / 2;
  const centre = stretch(circuit, 0, 1, 0);
  centre.closePath();

  const kerbs = new Path2D();
  const gravel = new Path2D();
  const runoff = new Path2D();
  for (const corner of circuit.corners) {
    if (corner.radius < 150) append(kerbs, stretch(circuit, corner.from, corner.to, 0));
    // Área de escape do lado de fora: brita nas curvas lentas, asfalto nas médias.
    const length = corner.to - corner.from;
    const outside = -corner.side * (half + 11);
    if (corner.radius < 62) append(gravel, stretch(circuit, corner.from + length * 0.3, corner.to + length * 0.25, outside));
    else if (corner.radius < 130) append(runoff, stretch(circuit, corner.from + length * 0.3, corner.to + length * 0.2, outside));
  }

  const pit = circuit.pit;
  const pitLane = stretch(circuit, pit.entry, 1 + pit.exit, (s) => pitLateralAt(circuit, s));
  const sign = Math.sign(pit.offset);
  const pitWall = stretch(circuit, pit.entryEnd, 1 + pit.exitStart, sign * (half + (CIRCUIT.PIT_OFFSET - half - CIRCUIT.PIT_WIDTH / 2) / 2));
  const buildingCentre = pit.offset + sign * (CIRCUIT.PIT_WIDTH / 2 + 4 + CIRCUIT.PIT_BUILDING / 2 - 4);
  const buildingLength = (pit.boxTo - pit.boxFrom) * circuit.length + 22;
  const buildingAt = (pit.boxFrom + pit.boxTo) / 2;
  const building = slab(circuit, buildingAt, buildingCentre, buildingLength, CIRCUIT.PIT_BUILDING - 8);
  const roof = slab(circuit, buildingAt, buildingCentre + sign * 2.5, buildingLength - 6, CIRCUIT.PIT_BUILDING - 17);
  const boxes = boxColors.map((color, i) => ({
    color,
    path: slab(circuit, pitBoxAt(circuit, i, boxColors.length), pit.offset + sign * (CIRCUIT.PIT_WIDTH / 2 + 2.6), Math.min(15, (buildingLength - 22) / Math.max(1, boxColors.length) - 2), 3.2),
  }));

  // Posições do grid: um colchete na frente de cada carro, em duas filas alternadas.
  const gridMarks = new Path2D();
  for (let i = 0; i < gridSize; i++) {
    const s = -(i + 0.7) * circuit.gridSlot + (CIRCUIT.CAR_LENGTH / 2 + 1.5) / circuit.length;
    const lateral = gridLateral(i);
    const front = poseAt(circuit, s, lateral);
    const cos = Math.cos(front.heading);
    const sin = Math.sin(front.heading);
    const w = CIRCUIT.CAR_WIDTH / 2 + 1.2;
    gridMarks.moveTo(front.x - cos * 4 - sin * -w, front.y - sin * 4 + cos * -w);
    gridMarks.lineTo(front.x - sin * -w, front.y + cos * -w);
    gridMarks.lineTo(front.x - sin * w, front.y + cos * w);
    gridMarks.lineTo(front.x - cos * 4 - sin * w, front.y - sin * 4 + cos * w);
  }

  const sectorMarks = circuit.sectors.map((s) => {
    const path = new Path2D();
    const a = poseAt(circuit, s, -half);
    const b = poseAt(circuit, s, half);
    path.moveTo(a.x, a.y);
    path.lineTo(b.x, b.y);
    return path;
  });

  // Arquibancadas do lado de fora da reta dos boxes, onde houver espaço.
  const stands = new Path2D();
  const seats = new Path2D();
  const outer = -sign * (half + 21);
  for (const at of [-(pit.exit * 0.2 + 0.03), pit.exit * 0.75]) {
    const centre = poseAt(circuit, at, outer);
    if (centre.x < 30 || centre.x > circuit.width - 30 || centre.y < 16 || centre.y > circuit.height - 16) continue;
    append(stands, slab(circuit, at, outer, 84, 15));
    for (const row of [-4.2, 0, 4.2]) append(seats, slab(circuit, at, outer + row, 80, 2.4));
  }

  return {
    circuit,
    trees: scatterTrees(circuit),
    stands,
    seats,
    centre,
    kerbs,
    gravel,
    runoff,
    racingLine: (() => {
      const path = stretch(circuit, 0, 1, (s) => circuit.line[Math.round(s * circuit.count) % circuit.count] ?? 0);
      path.closePath();
      return path;
    })(),
    pitLane,
    pitWall,
    building,
    roof,
    boxes,
    gridMarks,
    sectorMarks,
    finish: poseAt(circuit, 0),
  };
}

/** Deslocamento lateral de cada posição do grid: filas alternadas, pole do lado de dentro. */
export function gridLateral(slot: number): number {
  return (slot % 2 === 0 ? 1 : -1) * (CIRCUIT.TRACK_WIDTH / 2 - CIRCUIT.CAR_WIDTH / 2 - 2.8);
}

let grassPattern: { context: CanvasRenderingContext2D; pattern: CanvasPattern | null } | null = null;

function grass(g: CanvasRenderingContext2D): CanvasPattern | string {
  if (grassPattern?.context === g && grassPattern.pattern) return grassPattern.pattern;
  const tile = document.createElement('canvas');
  tile.width = 64;
  tile.height = 64;
  const t = tile.getContext('2d');
  if (!t) return COLORS.grass;
  t.fillStyle = COLORS.grass;
  t.fillRect(0, 0, 64, 64);
  t.fillStyle = COLORS.grassStripe;
  t.fillRect(0, 0, 64, 32);
  const pattern = g.createPattern(tile, 'repeat');
  grassPattern = { context: g, pattern };
  return pattern ?? COLORS.grass;
}

function mix(a: string, b: string, t: number): string {
  const x = Number.parseInt(a.slice(1), 16);
  const y = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((x >> shift) & 255) + (((y >> shift) & 255) - ((x >> shift) & 255)) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/** Desenha o circuito. O contexto já deve estar com a transformação da câmera (unidades de mundo). */
export function drawTrack(g: CanvasRenderingContext2D, art: TrackArt, wetness: number): void {
  const { circuit } = art;
  const width = CIRCUIT.TRACK_WIDTH;
  g.lineJoin = 'round';
  g.lineCap = 'butt';

  g.fillStyle = grass(g);
  g.fillRect(-1500, -1500, circuit.width + 3000, circuit.height + 3000);
  g.fillStyle = COLORS.infield;
  g.fill(art.centre);

  // Árvores.
  for (const tree of art.trees) {
    g.fillStyle = COLORS.tree;
    g.beginPath();
    g.arc(tree.x + 2, tree.y + 2.5, tree.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.canopy;
    g.beginPath();
    g.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    g.arc(tree.x + tree.r * 0.8, tree.y + tree.r * 0.5, tree.r * 0.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.canopyLight;
    g.beginPath();
    g.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.3, tree.r * 0.5, 0, Math.PI * 2);
    g.fill();
  }

  // Arquibancadas.
  g.fillStyle = COLORS.stand;
  g.fill(art.stands);
  g.fillStyle = COLORS.seats;
  g.fill(art.seats);

  // Áreas de escape.
  g.lineCap = 'round';
  g.strokeStyle = COLORS.gravel;
  g.lineWidth = 17;
  g.stroke(art.gravel);
  g.strokeStyle = COLORS.runoff;
  g.lineWidth = 15;
  g.stroke(art.runoff);
  g.lineCap = 'butt';

  // Sombra suave em volta da pista.
  g.strokeStyle = COLORS.shadow;
  g.lineWidth = width + 20;
  g.stroke(art.centre);

  // Prédio dos boxes e pit lane.
  g.fillStyle = COLORS.building;
  g.fill(art.building);
  g.fillStyle = COLORS.roof;
  g.fill(art.roof);
  g.strokeStyle = COLORS.pitEdge;
  g.lineWidth = CIRCUIT.PIT_WIDTH + 1.6;
  g.stroke(art.pitLane);
  g.strokeStyle = COLORS.pit;
  g.lineWidth = CIRCUIT.PIT_WIDTH;
  g.stroke(art.pitLane);
  for (const box of art.boxes) {
    g.fillStyle = box.color;
    g.fill(box.path);
  }

  // Zebras: uma faixa larga listrada sob o asfalto; sobram as bordas de dentro e de fora da curva.
  g.strokeStyle = COLORS.kerbWhite;
  g.lineWidth = width + 10;
  g.stroke(art.kerbs);
  g.strokeStyle = COLORS.kerbRed;
  g.setLineDash([6, 6]);
  g.stroke(art.kerbs);
  g.setLineDash([]);

  // Linha branca da borda e asfalto.
  g.strokeStyle = COLORS.edge;
  g.lineWidth = width + 2.2;
  g.stroke(art.centre);
  g.strokeStyle = wetness > 0 ? mix(COLORS.asphalt, COLORS.asphaltWet, Math.min(1, wetness * 1.2)) : COLORS.asphalt;
  g.lineWidth = width;
  g.stroke(art.centre);

  // Borracha na linha de corrida (some com a pista molhada).
  if (wetness < 0.6) {
    g.strokeStyle = COLORS.rubber;
    g.globalAlpha = 1 - wetness / 0.6;
    g.lineWidth = 8;
    g.stroke(art.racingLine);
    g.globalAlpha = 1;
  }

  // Mureta dos boxes.
  g.strokeStyle = COLORS.wall;
  g.lineWidth = 1.6;
  g.stroke(art.pitWall);

  // Grid e setores.
  g.strokeStyle = COLORS.mark;
  g.lineWidth = 1.1;
  g.stroke(art.gridMarks);
  art.sectorMarks.forEach((path, i) => {
    g.strokeStyle = COLORS.sectors[i] ?? COLORS.mark;
    g.globalAlpha = 0.75;
    g.lineWidth = 1.6;
    g.stroke(path);
    g.globalAlpha = 1;
  });

  // Linha de chegada quadriculada.
  const { x, y, heading } = art.finish;
  g.save();
  g.translate(x, y);
  g.rotate(heading);
  const rows = 8;
  const cell = width / rows;
  for (let column = 0; column < 2; column++) {
    for (let row = 0; row < rows; row++) {
      g.fillStyle = (row + column) % 2 === 0 ? '#f2f4f7' : '#0c0e12';
      g.fillRect(-cell + column * cell, -width / 2 + row * cell, cell, cell);
    }
  }
  g.restore();
}
