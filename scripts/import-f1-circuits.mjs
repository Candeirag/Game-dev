/**
 * Importa a geometria dos autódromos do conjunto de dados público
 * bacinger/f1-circuits (GeoJSON, licença MIT) e grava src/data/circuitLayouts.ts.
 *
 * Uso: node scripts/import-f1-circuits.mjs <pasta do repositório f1-circuits>
 *
 * Para cada pista do jogo: lê o traçado em longitude/latitude, converte para
 * metros num plano local (x para leste, y para sul, como na tela), põe os pontos
 * no sentido real da corrida e começa a lista na linha de largada.
 *
 * O arquivo de origem nem sempre começa na linha de largada atual nem segue o
 * sentido da corrida, então isso é declarado aqui, pista por pista:
 * - `start`: distância, em metros ao longo do arquivo de origem, até a linha de largada;
 * - `reverse`: o arquivo está no sentido contrário ao da corrida;
 * - `clockwise`: sentido real da corrida (na largada, para o traçado em oito);
 * - `bridge`: o traçado passa por cima de si mesmo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TRACKS = [
  { id: 'sao-paulo', file: 'br-1940', start: 0, clockwise: false },
  { id: 'melbourne', file: 'au-1953', start: 0, clockwise: true },
  { id: 'imola', file: 'it-1953', start: 0, clockwise: false },
  { id: 'barcelona', file: 'es-1991', start: 0, clockwise: true },
  // O arquivo começa na subida para o cassino; a largada fica na reta do porto, entre a última curva e a primeira.
  { id: 'monaco', file: 'mc-1929', start: 2400, clockwise: true },
  { id: 'montreal', file: 'ca-1978', start: 0, clockwise: true },
  // O arquivo começa na reta antiga dos boxes; desde 2011 a largada é na reta entre a última curva e a primeira, ao sul.
  { id: 'silverstone', file: 'gb-1948', start: 3230, clockwise: true },
  { id: 'spa', file: 'be-1925', start: 0, clockwise: true },
  { id: 'budapest', file: 'hu-1986', start: 0, clockwise: true },
  { id: 'monza', file: 'it-1922', start: 0, clockwise: true },
  // O arquivo está no sentido horário; a corrida é no anti-horário.
  { id: 'singapura', file: 'sg-2008', start: 0, reverse: true, clockwise: false },
  { id: 'suzuka', file: 'jp-1962', start: 0, clockwise: true, bridge: true },
  { id: 'austin', file: 'us-2012', start: 0, clockwise: false },
  { id: 'abu-dhabi', file: 'ae-2009', start: 0, clockwise: false },
];

const source = process.argv[2];
if (!source) throw new Error('Informe a pasta do repositório f1-circuits.');

const entries = TRACKS.map((track) => {
  const geo = JSON.parse(readFileSync(join(source, 'circuits', `${track.file}.geojson`), 'utf8'));
  const feature = geo.features[0];
  let coordinates = feature.geometry.coordinates.map(([lon, lat]) => [lon, lat]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) coordinates = coordinates.slice(0, -1);
  const lat0 = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const lon0 = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  // Plano local em metros: x para leste, y para sul (o norte fica para cima na tela).
  let points = coordinates.map(([lon, lat]) => [(lon - lon0) * 111_320 * Math.cos((lat0 * Math.PI) / 180), -(lat - lat0) * 110_540]);

  // Linha de largada: ponto a `start` metros do começo do arquivo de origem.
  const n = points.length;
  let travelled = 0;
  let cut = 0;
  let startPoint = points[0];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (travelled + segment > track.start) {
      const t = (track.start - travelled) / segment;
      startPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      cut = i;
      break;
    }
    travelled += segment;
  }
  // Lista começando na largada, no sentido do arquivo; depois, se preciso, no sentido da corrida.
  points = [startPoint, ...points.slice(cut + 1), ...points.slice(0, cut + 1)];
  if (track.reverse) points = [points[0], ...points.slice(1).reverse()];
  // Pontos repetidos no arquivo de origem não acrescentam nada ao traçado.
  points = points.filter((point, i) => i === 0 || Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) > 0.05);
  if (Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) <= 0.05) points.pop();

  // Conferência: na tela (y para baixo), área positiva = sentido horário. O traçado em oito fica de fora.
  let area = 0;
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (!track.bridge && area > 0 !== track.clockwise) throw new Error(`${track.id}: o sentido dos pontos não confere com o declarado.`);
  return {
    id: track.id,
    name: feature.properties.Name,
    length: Math.round(length),
    clockwise: track.clockwise,
    bridge: track.bridge === true,
    points: points.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
  };
});

const lines = [
  '/**',
  ' * Traçados reais dos autódromos (os nomes das pistas no jogo são fictícios).',
  ' *',
  ' * ARQUIVO GERADO por scripts/import-f1-circuits.mjs. Não edite à mão.',
  ' * Fonte: https://github.com/bacinger/f1-circuits (c) Tomislav Bacinger, licença MIT',
  ' * (ver THIRD_PARTY_LICENSES.md).',
  ' *',
  ' * `points`: x e y alternados, em metros, num plano local (x para leste, y para sul).',
  ' * A lista começa na linha de largada, segue o sentido da corrida e fecha no primeiro ponto.',
  ' */',
  'export interface CircuitLayout {',
  '  /** Comprimento do traçado de origem, em metros (confere com o da pista no jogo). */',
  '  length: number;',
  '  /** Sentido da corrida visto de cima (na largada, se o traçado se cruza). */',
  '  clockwise: boolean;',
  '  /** O traçado passa por cima de si mesmo (viaduto). */',
  '  bridge: boolean;',
  '  points: readonly number[];',
  '}',
  '',
  'export const CIRCUIT_LAYOUTS: Readonly<Record<string, CircuitLayout>> = {',
  ...entries.map(
    (e) =>
      `  // Referência: ${e.name}\n  '${e.id}': { length: ${e.length}, clockwise: ${e.clockwise}, bridge: ${e.bridge}, points: [${e.points.join(', ')}] },`,
  ),
  '};',
  '',
];
writeFileSync(new URL('../src/data/circuitLayouts.ts', import.meta.url), lines.join('\n'));
for (const e of entries)
  console.log(
    e.id.padEnd(12),
    String(e.points.length / 2).padStart(4),
    'pontos',
    String(e.length).padStart(5),
    'm',
    e.clockwise ? 'horário' : 'anti-horário',
    e.bridge ? '(viaduto)' : '',
  );
