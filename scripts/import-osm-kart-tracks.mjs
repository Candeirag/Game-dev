/**
 * Importa a geometria dos kartódromos a partir de dados do OpenStreetMap e grava
 * src/data/kartLayouts.ts.
 *
 * Uso: node scripts/import-osm-kart-tracks.mjs [--debug <arquivo.json>]
 *
 * Os dados de origem estão em scripts/osm-kart-tracks/: um arquivo por kartódromo,
 * com as vias `highway=raceway` daquela pista (identificador, etiquetas e nós),
 * obtidas da API do OpenStreetMap. (c) OpenStreetMap contributors, licença ODbL 1.0.
 * O arquivo gerado é uma base derivada e segue a mesma licença.
 *
 * Para cada pista do jogo:
 * 1. escolhe a volta: uma via fechada (`way`) ou, quando o mapa traz a pista em
 *    vários trechos e variantes, o percurso fechado que resulta de juntá-los (`stitch`);
 * 2. converte para metros num plano local (x para leste, y para sul, como na tela);
 * 3. põe os pontos no sentido da corrida e começa a lista na linha de largada.
 *
 * Junção dos trechos (`stitch`): os trechos formam um grafo; procuram-se os percursos
 * fechados que não repetem cruzamento, respeitam a mão das vias marcadas como mão
 * única e não dobram mais de `maxTurn` graus ao trocar de trecho. Fica o mais
 * longo, ou o de comprimento mais próximo de `target` (metros), quando declarado.
 * Boxes ficam de fora (vias com "pit" ou "box" no nome, ou listadas em `exclude`).
 *
 * Sentido: o do desenho no mapa (quem mapeia uma pista costuma seguir o sentido da
 * corrida, e as vias de mão única o declaram). `reverse` inverte.
 *
 * Largada: a 58% da reta mais longa, salvo `start` (fração da volta, a partir do
 * primeiro nó do percurso escolhido).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TRACKS = [
  // Brasil
  { id: 'vale-do-sol', venue: 'granja-viana', stitch: {} },
  { id: 'lagoa-azul', venue: 'londrina', way: 353073199 },
  { id: 'serra-gaucha', venue: 'velopark', way: 94748799 },
  { id: 'planalto', venue: 'brasilia', way: 1517120676 },
  { id: 'mantiqueira', venue: 'interlagos', stitch: {} },
  { id: 'litoral-norte', venue: 'joinville', way: 257802316 },
  { id: 'triangulo', venue: 'uberlandia', stitch: {} },
  { id: 'pampas', venue: 'taruma', way: 260695371 },
  { id: 'cerrado-paulista', venue: 'birigui', stitch: {} },
  { id: 'guanabara', venue: 'guapimirim', stitch: {} },
  // Mundo
  { id: 'garda', venue: 'lonato', way: 75490872 },
  { id: 'limburg', venue: 'genk', way: 67660672 },
  { id: 'sarthe-kart', venue: 'le-mans', way: 482284812 },
  { id: 'zuera', venue: 'zuera', way: 490212650 },
  { id: 'wackersdorf', venue: 'wackersdorf', way: 156019609 },
  { id: 'kristianstad', venue: 'kristianstad', way: 87888593 },
  { id: 'pfi', venue: 'pfi', stitch: {}, bridge: true },
  { id: 'portimao-kart', venue: 'portimao', stitch: { target: 1531 } },
  { id: 'franciacorta', venue: 'franciacorta', way: 1474753154 },
];

const debugIndex = process.argv.indexOf('--debug');
const debugFile = debugIndex > 0 ? process.argv[debugIndex + 1] : null;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const loadVenue = (name) => JSON.parse(readFileSync(new URL(`./osm-kart-tracks/${name}.json`, import.meta.url), 'utf8'));
const isPit = (way) => /pit|box/i.test(way.name ?? '');
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const pathLength = (points, closed) => {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) total += distance(points[i], points[i + 1]);
  return closed ? total + distance(points[points.length - 1], points[0]) : total;
};

/** Plano local em metros: x para leste, y para sul (o norte fica para cima na tela). */
function projector(ways) {
  const all = ways.flatMap((way) => way.nodes);
  const lat0 = all.reduce((sum, n) => sum + n[1], 0) / all.length;
  const lon0 = all.reduce((sum, n) => sum + n[2], 0) / all.length;
  const position = new Map();
  for (const [id, lat, lon] of all) position.set(id, [(lon - lon0) * 111_320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110_540]);
  return position;
}

/** Direção (vetor unitário) do fim de uma sequência de pontos, medida nos últimos `reach` metros. */
function endDirection(points, reach = 7) {
  const last = points[points.length - 1];
  let i = points.length - 2;
  while (i > 0 && distance(points[i], last) < reach) i--;
  const d = distance(points[i], last) || 1;
  return [(last[0] - points[i][0]) / d, (last[1] - points[i][1]) / d];
}

/**
 * Percursos fechados do grafo de trechos. Devolve a lista de candidatos, cada um com a
 * sequência de nós, o comprimento e quanto dele segue o sentido em que as vias foram desenhadas.
 */
function findLoops(ways, position, options) {
  const exclude = new Set(options.exclude ?? []);
  const usable = ways.filter((way) => !isPit(way) && !exclude.has(way.id));
  // Arestas entre nós vizinhos de cada via.
  const neighbours = new Map();
  const link = (a, b, edge) => {
    if (!neighbours.has(a)) neighbours.set(a, []);
    neighbours.get(a).push({ to: b, ...edge });
  };
  for (const way of usable) {
    const oneway = way.oneway === 'yes';
    for (let i = 0; i + 1 < way.nodes.length; i++) {
      const a = way.nodes[i][0];
      const b = way.nodes[i + 1][0];
      if (a === b) continue;
      link(a, b, { forward: true, allowed: true });
      link(b, a, { forward: false, allowed: !oneway });
    }
  }
  // Cruzamentos: nós em que se encontram mais de dois trechos, ou pontas soltas.
  const junctions = [...neighbours.keys()].filter((node) => neighbours.get(node).length !== 2);
  if (junctions.length === 0) junctions.push(usable[0].nodes[0][0]);
  const isJunction = new Set(junctions);
  // Arcos: de um cruzamento até o próximo, passando pelos nós intermediários.
  const arcs = [];
  for (const from of junctions) {
    for (const first of neighbours.get(from)) {
      const nodes = [from, first.to];
      let allowed = first.allowed;
      let drawn = first.forward ? distance(position.get(from), position.get(first.to)) : 0;
      let previous = from;
      let current = first.to;
      while (!isJunction.has(current)) {
        const next = neighbours.get(current).find((edge) => edge.to !== previous) ?? null;
        if (!next) break;
        allowed &&= next.allowed;
        if (next.forward) drawn += distance(position.get(current), position.get(next.to));
        nodes.push(next.to);
        previous = current;
        current = next.to;
      }
      if (!allowed || !isJunction.has(current)) continue;
      const points = nodes.map((node) => position.get(node));
      arcs.push({ from, to: current, nodes, points, length: pathLength(points, false), drawn, key: `${Math.min(nodes[0], nodes[nodes.length - 1])}:${nodes.length}:${Math.min(nodes[1], nodes[nodes.length - 2])}` });
    }
  }
  const outgoing = new Map();
  for (const arc of arcs) {
    if (!outgoing.has(arc.from)) outgoing.set(arc.from, []);
    outgoing.get(arc.from).push(arc);
  }
  const maxTurn = ((options.maxTurn ?? 110) * Math.PI) / 180;
  const turnBetween = (a, b) => {
    const u = endDirection(a.points);
    const reversed = endDirection([...b.points].reverse());
    const v = [-reversed[0], -reversed[1]];
    return Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
  };
  const order = new Map(junctions.map((node, index) => [node, index]));
  const loops = [];
  let steps = 0;
  // Busca em profundidade; cada percurso é encontrado a partir do seu cruzamento de menor índice.
  for (const start of junctions) {
    const visited = new Set([start]);
    const path = [];
    const walk = (node) => {
      if (++steps > 4_000_000) return;
      for (const arc of outgoing.get(node) ?? []) {
        if (order.get(arc.to) < order.get(start)) continue;
        const previous = path[path.length - 1];
        if (previous && (turnBetween(previous, arc) > maxTurn || (previous.key === arc.key && previous.from === arc.to))) continue;
        if (arc.to === start) {
          if (path.length === 0 && arc.nodes.length < 4) continue;
          if (path.length > 0 && turnBetween(arc, path[0]) > maxTurn) continue;
          const all = [...path, arc];
          const nodes = all.flatMap((a) => a.nodes.slice(0, -1));
          loops.push({ nodes, length: all.reduce((sum, a) => sum + a.length, 0), drawn: all.reduce((sum, a) => sum + a.drawn, 0), arcs: all.length });
          continue;
        }
        if (visited.has(arc.to)) continue;
        visited.add(arc.to);
        path.push(arc);
        walk(arc.to);
        path.pop();
        visited.delete(arc.to);
      }
    };
    walk(start);
  }
  if (steps > 4_000_000) console.warn('  busca interrompida pelo limite de passos');
  return loops;
}

/** Trecho mais reto e mais longo do percurso fechado: índice do primeiro ponto, distância até ele e comprimento. */
function longestStraight(points) {
  const n = points.length;
  // Reamostra a cada 2 m para medir a direção com regularidade.
  const dense = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const steps = Math.max(1, Math.round(distance(a, b) / 2));
    for (let k = 0; k < steps; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  const m = dense.length;
  const heading = dense.map((p, i) => Math.atan2(dense[(i + 3) % m][1] - dense[(i - 3 + m) % m][1], dense[(i + 3) % m][0] - dense[(i - 3 + m) % m][0]));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let best = { from: 0, samples: 0 };
  for (let i = 0; i < m; i++) {
    let samples = 1;
    while (samples < m && Math.abs(wrap(heading[(i + samples) % m] - heading[i])) < (9 * Math.PI) / 180) samples++;
    if (samples > best.samples) best = { from: i, samples };
  }
  const step = pathLength(points, true) / m;
  return { from: best.from * step, length: best.samples * step };
}

const debug = {};
const entries = [];
for (const track of TRACKS) {
  if (only && track.id !== only) continue;
  const venue = loadVenue(track.venue);
  const position = projector(venue.ways);
  let nodes;
  let note = '';
  if (track.way) {
    const way = venue.ways.find((w) => w.id === track.way);
    if (!way) throw new Error(`${track.id}: a via ${track.way} não está nos dados de ${track.venue}.`);
    nodes = way.nodes.map((node) => node[0]);
    if (nodes[0] !== nodes[nodes.length - 1]) throw new Error(`${track.id}: a via ${track.way} não é fechada.`);
    nodes = nodes.slice(0, -1);
  } else {
    const loops = findLoops(venue.ways, position, track.stitch);
    if (loops.length === 0) throw new Error(`${track.id}: nenhum percurso fechado em ${track.venue}.`);
    const target = track.stitch.target;
    loops.sort((a, b) => (target ? Math.abs(a.length - target) - Math.abs(b.length - target) : b.length - a.length));
    // O mesmo percurso aparece nos dois sentidos quando as vias não são de mão única: fica o do desenho.
    const best = loops[0];
    const twin = loops.find((loop) => loop !== best && Math.abs(loop.length - best.length) < 0.5 && loop.arcs === best.arcs && loop.drawn > best.drawn + 1);
    const chosen = twin ?? best;
    nodes = chosen.nodes;
    note = `${loops.length} percursos, ${chosen.arcs} trechos`;
    if (debugFile) debug[track.id] = { candidates: loops.slice(0, 12).map((loop) => ({ length: Math.round(loop.length), arcs: loop.arcs, drawn: Math.round(loop.drawn), points: loop.nodes.map((node) => position.get(node).map((v) => Math.round(v * 10) / 10)) })) };
  }
  let points = nodes.map((node) => position.get(node));
  points = points.filter((point, i) => i === 0 || distance(point, points[i - 1]) > 0.05);
  if (track.reverse) points = [...points].reverse();

  // Linha de largada.
  const total = pathLength(points, true);
  const straight = longestStraight(points);
  const startAt = track.start !== undefined ? track.start * total : (straight.from + straight.length * 0.58) % total;
  let travelled = 0;
  let cut = 0;
  let startPoint = points[0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const segment = distance(a, b);
    if (travelled + segment > startAt) {
      const t = (startAt - travelled) / segment;
      startPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      cut = i;
      break;
    }
    travelled += segment;
  }
  points = [startPoint, ...points.slice(cut + 1), ...points.slice(0, cut + 1)];
  points = points.filter((point, i) => i === 0 || distance(point, points[i - 1]) > 0.3);
  if (distance(points[0], points[points.length - 1]) <= 0.3) points.pop();

  // Sentido visto de cima: na tela (y para baixo), área positiva = horário.
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const entry = {
    id: track.id,
    venue: `${venue.venue}, ${venue.place}`,
    length: Math.round(total),
    clockwise: area > 0,
    bridge: track.bridge === true,
    points: points.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
  };
  entries.push(entry);
  if (debugFile) debug[track.id] = { ...(debug[track.id] ?? {}), points: entry.points, length: entry.length, straight: Math.round(straight.length), venue: track.venue };
  console.log(track.id.padEnd(17), String(points.length).padStart(4), 'pontos', String(entry.length).padStart(5), 'm', (entry.clockwise ? 'horário' : 'anti-horário').padEnd(13), `reta ${Math.round(straight.length)} m`, entry.bridge ? '(viaduto)' : '', note);
}

if (debugFile) writeFileSync(debugFile, JSON.stringify(debug));
if (!only) {
  const lines = [
    '/**',
    ' * Traçados reais dos kartódromos (os nomes das pistas no jogo são fictícios).',
    ' *',
    ' * ARQUIVO GERADO por scripts/import-osm-kart-tracks.mjs. Não edite à mão.',
    ' *',
    ' * Contém dados do OpenStreetMap, (c) OpenStreetMap contributors, disponíveis sob a',
    ' * Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright',
    ' * Este arquivo é uma base derivada desses dados e é distribuído sob a mesma licença',
    ' * (ver THIRD_PARTY_LICENSES.md).',
    ' *',
    ' * `points`: x e y alternados, em metros, num plano local (x para leste, y para sul).',
    ' * A lista começa na linha de largada, segue o sentido da corrida e fecha no primeiro ponto.',
    ' * `length` é o comprimento do traçado mapeado, que não precisa coincidir com o da pista',
    ' * fictícia do jogo (este continua sendo o que vale para tempos e regras).',
    ' */',
    "import type { CircuitLayout } from './circuitLayouts';",
    '',
    '/** Crédito exigido pela licença: aparece nas telas que mostram estes traçados. */',
    "export const KART_LAYOUTS_CREDIT = '© OpenStreetMap contributors';",
    '',
    'export const KART_LAYOUTS: Readonly<Record<string, CircuitLayout>> = {',
    ...entries.map((e) => `  // Referência: ${e.venue}\n  '${e.id}': { length: ${e.length}, clockwise: ${e.clockwise}, bridge: ${e.bridge}, points: [${e.points.join(', ')}] },`),
    '};',
    '',
  ];
  writeFileSync(new URL('../src/data/kartLayouts.ts', import.meta.url), lines.join('\n'));
}
