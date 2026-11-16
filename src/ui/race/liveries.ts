/**
 * Pintura dos veículos.
 *
 * Cada categoria tem o seu sprite-base (src/assets/race/vehicles), uma imagem
 * vista de cima gerada no Higgsfield, com a carroceria branca. Cada equipe ganha
 * a sua pintura em tempo de execução: a cor da equipe multiplica a carroceria
 * branca (pneus, asas e sombras continuam escuros), um desenho de pintura
 * acrescenta a cor de contraste, o capacete recebe a cor do piloto e o número
 * do carro vai no bico.
 *
 * Se a imagem não carregar, o carro é desenhado em vetor (drawVectorCar), então
 * a corrida funciona mesmo sem o arquivo.
 */
import type { CategoryId } from '@/domain/schemas';
import { VEHICLES } from '@/data/vehicles';
import { textHash } from '@/engine';
import f1Url from '@/assets/race/vehicles/f1.webp';
import f2Url from '@/assets/race/vehicles/f2.webp';
import f3Url from '@/assets/race/vehicles/f3.webp';
import f4Url from '@/assets/race/vehicles/f4.webp';
import kartInternationalUrl from '@/assets/race/vehicles/kart-international.webp';
import kartNationalUrl from '@/assets/race/vehicles/kart-national.webp';
import kartRegionalUrl from '@/assets/race/vehicles/kart-regional.webp';
import safetyCarUrl from '@/assets/race/vehicles/safety-car.webp';

export type CarCanvas = HTMLCanvasElement;

interface SpriteSpec {
  url: string;
  /** Capacete: centro e raio, em fração da largura e da altura do sprite (medidos na imagem). */
  helmet: { x: number; y: number; r: number };
  /** Onde vai o número do carro (centro e altura dos algarismos, em frações); null se não há painel para ele. */
  number: { x: number; y: number; size: number } | null;
}

const SPRITES: Readonly<Record<CategoryId, SpriteSpec>> = {
  'kart-regional': { url: kartRegionalUrl, helmet: { x: 0.262, y: 0.486, r: 0.096 }, number: null },
  'kart-national': { url: kartNationalUrl, helmet: { x: 0.281, y: 0.479, r: 0.082 }, number: { x: 0.875, y: 0.5, size: 0.17 } },
  'kart-international': { url: kartInternationalUrl, helmet: { x: 0.251, y: 0.472, r: 0.075 }, number: { x: 0.8, y: 0.5, size: 0.15 } },
  f4: { url: f4Url, helmet: { x: 0.497, y: 0.483, r: 0.034 }, number: { x: 0.79, y: 0.5, size: 0.15 } },
  f3: { url: f3Url, helmet: { x: 0.483, y: 0.478, r: 0.028 }, number: { x: 0.77, y: 0.5, size: 0.14 } },
  f2: { url: f2Url, helmet: { x: 0.513, y: 0.483, r: 0.031 }, number: { x: 0.8, y: 0.5, size: 0.14 } },
  f1: { url: f1Url, helmet: { x: 0.508, y: 0.484, r: 0.026 }, number: { x: 0.79, y: 0.5, size: 0.11 } },
};

interface BaseSprite {
  image: HTMLImageElement;
  /** Região da carroceria (branca no sprite), onde a pintura é aplicada. */
  mask: HTMLCanvasElement;
}

const bases: Partial<Record<CategoryId, BaseSprite | 'failed'>> = {};
const pending: Partial<Record<CategoryId, Promise<void>>> = {};
const liveries = new Map<string, CarCanvas>();
let safetyCar: HTMLImageElement | 'failed' | null = null;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Imagem indisponível: ${url}`));
    image.src = url;
  });
}

/** Separa a carroceria (clara) do resto do carro (pneus, asas, cockpit). */
function bodyMask(image: HTMLImageElement, helmet: SpriteSpec['helmet']): HTMLCanvasElement {
  const canvas = makeCanvas(image.width, image.height);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return canvas;
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const light = ((px[i] ?? 0) * 0.299 + (px[i + 1] ?? 0) * 0.587 + (px[i + 2] ?? 0) * 0.114) / 255;
    // Transição suave entre 0,5 e 0,7 de luminosidade, para não serrilhar a borda da pintura.
    const cover = Math.min(1, Math.max(0, (light - 0.5) / 0.2));
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = Math.round((px[i + 3] ?? 0) * cover);
  }
  g.putImageData(data, 0, 0);
  // O capacete é pintado à parte.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(helmet.x * canvas.width, helmet.y * canvas.height, helmet.r * canvas.width * 1.1, 0, Math.PI * 2);
  g.fill();
  return canvas;
}

/** Carrega o sprite de uma categoria (uma vez). A promessa resolve mesmo se a imagem falhar. */
export function loadCarSprites(categoryId: CategoryId): Promise<void> {
  const existing = pending[categoryId];
  if (existing) return existing;
  const spec = SPRITES[categoryId];
  const job = loadImage(spec.url)
    .then((image) => {
      bases[categoryId] = { image, mask: bodyMask(image, spec.helmet) };
    })
    .catch(() => {
      bases[categoryId] = 'failed';
    });
  pending[categoryId] = job;
  if (safetyCar === null) {
    safetyCar = 'failed';
    loadImage(safetyCarUrl)
      .then((image) => {
        safetyCar = image;
      })
      .catch(() => undefined);
  }
  return job;
}

export function safetyCarSprite(): HTMLImageElement | null {
  return safetyCar && safetyCar !== 'failed' ? safetyCar : null;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

function distance(a: string, b: string): number {
  const x = Number.parseInt(a.slice(1), 16);
  const y = Number.parseInt(b.slice(1), 16);
  return Math.abs(((x >> 16) & 255) - ((y >> 16) & 255)) + Math.abs(((x >> 8) & 255) - ((y >> 8) & 255)) + Math.abs((x & 255) - (y & 255));
}

const ACCENTS = ['#f4f5f7', '#15171c', '#f6c343', '#22d3ee', '#ef3b2d', '#34d399'];
const HELMET_COLORS = ['#f6c343', '#22d3ee', '#f4f5f7', '#ef3b2d', '#34d399', '#a78bfa', '#fb923c', '#60a5fa', '#f472b6', '#e2e8f0'];

/** Cor de contraste da equipe: sempre a mesma para a mesma equipe, e distante da cor principal. */
export function accentFor(teamId: string, primary: string): string {
  const options = ACCENTS.filter((c) => distance(c, primary) > 230);
  return options[textHash(`accent|${teamId}`) % Math.max(1, options.length)] ?? '#f4f5f7';
}

export function helmetFor(driverId: string): string {
  return HELMET_COLORS[textHash(`helmet|${driverId}`) % HELMET_COLORS.length] ?? '#f4f5f7';
}

/** Desenhos de pintura: onde entra a cor de contraste (coordenadas de 0 a 1, nariz à direita). */
const PATTERNS: ((g: CanvasRenderingContext2D, w: number, h: number) => void)[] = [
  // Faixa central do nariz à traseira.
  (g, w, h) => g.fillRect(0, h * 0.44, w, h * 0.12),
  // Traseira (tampa do motor) na cor de contraste.
  (g, w, h) => g.fillRect(0, 0, w * 0.4, h),
  // Laterais.
  (g, w, h) => {
    g.fillRect(w * 0.2, 0, w * 0.4, h * 0.36);
    g.fillRect(w * 0.2, h * 0.64, w * 0.4, h * 0.36);
  },
  // Corte diagonal.
  (g, w, h) => {
    g.beginPath();
    g.moveTo(w * 0.34, 0);
    g.lineTo(w * 0.62, 0);
    g.lineTo(w * 0.42, h);
    g.lineTo(w * 0.14, h);
    g.closePath();
    g.fill();
  },
  // Bico e duas faixas finas.
  (g, w, h) => {
    g.fillRect(w * 0.78, 0, w * 0.22, h);
    g.fillRect(0, h * 0.4, w * 0.78, h * 0.05);
    g.fillRect(0, h * 0.55, w * 0.78, h * 0.05);
  },
];

function textOn(hex: string): string {
  return luminance(hex) > 0.58 ? '#0b0d11' : '#ffffff';
}

/**
 * Veículo da categoria com a pintura de uma equipe, o capacete do piloto e o número do carro.
 * Devolve null enquanto o sprite não carregou (ou se falhou); nesse caso quem chama usa o
 * desenho em vetor.
 */
export function liveryFor(categoryId: CategoryId, teamId: string, primary: string, driverId: string, carNumber?: number): CarCanvas | null {
  const base = bases[categoryId];
  if (!base || base === 'failed') return null;
  const key = `${categoryId}|${teamId}|${primary}|${driverId}|${carNumber ?? ''}`;
  const cached = liveries.get(key);
  if (cached) return cached;
  const { image, mask } = base;
  const spec = SPRITES[categoryId];
  const w = image.width;
  const h = image.height;

  const paint = makeCanvas(w, h);
  const p = paint.getContext('2d');
  const out = makeCanvas(w, h);
  const o = out.getContext('2d');
  if (!p || !o) return null;
  const accent = accentFor(teamId, primary);
  p.fillStyle = primary;
  p.fillRect(0, 0, w, h);
  p.fillStyle = accent;
  PATTERNS[textHash(`pattern|${teamId}`) % PATTERNS.length]?.(p, w, h);
  if (spec.number && carNumber !== undefined) {
    // Número no bico, lido de frente para o carro (o sprite aponta para a direita).
    const size = spec.number.size * h;
    p.save();
    p.translate(spec.number.x * w, spec.number.y * h);
    p.rotate(Math.PI / 2);
    p.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    p.textAlign = 'center';
    p.textBaseline = 'middle';
    // Fundo na cor principal para o número não cair em cima do desenho de contraste.
    const plate = p.measureText(String(carNumber)).width + size * 0.3;
    p.fillStyle = primary;
    p.fillRect(-plate / 2, -size * 0.6, plate, size * 1.2);
    p.fillStyle = textOn(primary);
    p.fillText(String(carNumber), 0, size * 0.04);
    p.restore();
  }
  p.globalCompositeOperation = 'destination-in';
  p.drawImage(mask, 0, 0);

  o.drawImage(image, 0, 0);
  o.globalCompositeOperation = 'multiply';
  o.drawImage(paint, 0, 0);
  // Cores muito escuras sumiriam no asfalto: devolve um pouco de luz à carroceria.
  if (luminance(primary) < 0.28) {
    o.globalCompositeOperation = 'screen';
    o.globalAlpha = 0.22;
    o.drawImage(mask, 0, 0);
    o.globalAlpha = 1;
  }
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(image, 0, 0);
  o.globalCompositeOperation = 'source-over';

  // Capacete na cor do piloto, visto de cima: uma faixa da frente para trás e um brilho de lado.
  const hx = spec.helmet.x * w;
  const hy = spec.helmet.y * h;
  const hr = spec.helmet.r * w;
  const shell = helmetFor(driverId);
  o.save();
  o.beginPath();
  o.arc(hx, hy, hr, 0, Math.PI * 2);
  o.clip();
  o.fillStyle = shell;
  o.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  o.fillStyle = luminance(shell) > 0.6 ? 'rgba(12, 14, 18, 0.8)' : 'rgba(255, 255, 255, 0.85)';
  o.fillRect(hx - hr, hy - hr * 0.2, hr * 2, hr * 0.4);
  o.fillStyle = 'rgba(255, 255, 255, 0.28)';
  o.beginPath();
  o.ellipse(hx - hr * 0.1, hy - hr * 0.5, hr * 0.5, hr * 0.22, 0, 0, Math.PI * 2);
  o.fill();
  o.restore();
  o.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  o.lineWidth = Math.max(1, hr * 0.14);
  o.beginPath();
  o.arc(hx, hy, hr, 0, Math.PI * 2);
  o.stroke();

  liveries.set(key, out);
  return out;
}

/** Proporção (largura ÷ altura) do sprite de uma categoria, para reservar espaço antes de a imagem carregar. */
export function spriteAspect(categoryId: CategoryId): number {
  const vehicle = VEHICLES[categoryId];
  return vehicle.length / vehicle.width;
}

/**
 * Carro em vetor, usado quando o sprite não está disponível. Desenha no
 * sistema do carro: origem no centro, nariz para +x, comprimento e largura dados.
 */
export function drawVectorCar(
  g: CanvasRenderingContext2D,
  style: 'kart' | 'formula',
  length: number,
  width: number,
  primary: string,
  accent: string,
  helmet: string,
): void {
  const l = length / 2;
  const w = width / 2;
  g.fillStyle = '#0d0f13';
  // Rodas.
  const wheelL = length * 0.2;
  const wheelW = width * 0.26;
  for (const [x, y] of [
    [l * 0.52, -w],
    [l * 0.52, w - wheelW],
    [-l * 0.72, -w],
    [-l * 0.72, w - wheelW],
  ] as const)
    g.fillRect(x - wheelL / 2, y, wheelL, wheelW);
  if (style === 'formula') {
    // Asas.
    g.fillStyle = '#1b1e25';
    g.fillRect(l * 0.82, -w * 0.95, length * 0.07, width * 0.95);
    g.fillRect(-l, -w * 0.8, length * 0.08, width * 0.8);
    // Carroceria afilada.
    g.fillStyle = primary;
    g.beginPath();
    g.moveTo(l * 0.95, 0);
    g.lineTo(l * 0.3, -w * 0.28);
    g.lineTo(-l * 0.1, -w * 0.62);
    g.lineTo(-l * 0.85, -w * 0.4);
    g.lineTo(-l * 0.85, w * 0.4);
    g.lineTo(-l * 0.1, w * 0.62);
    g.lineTo(l * 0.3, w * 0.28);
    g.closePath();
    g.fill();
    g.fillStyle = accent;
    g.fillRect(-l * 0.85, -w * 0.1, length * 0.9, width * 0.1);
  } else {
    // Kart: assoalho, carenagens laterais e bico.
    g.fillStyle = '#23262e';
    g.fillRect(-l * 0.8, -w * 0.55, length * 0.8, width * 0.55);
    g.fillStyle = primary;
    g.fillRect(-l * 0.35, -w * 0.95, length * 0.36, width * 0.2);
    g.fillRect(-l * 0.35, w * 0.55, length * 0.36, width * 0.2);
    g.beginPath();
    g.moveTo(l * 0.95, -w * 0.5);
    g.lineTo(l * 0.95, w * 0.5);
    g.lineTo(l * 0.6, w * 0.7);
    g.lineTo(l * 0.6, -w * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = accent;
    g.fillRect(-l * 0.95, -w * 0.6, length * 0.07, width * 0.6);
  }
  g.fillStyle = helmet;
  g.beginPath();
  g.arc(style === 'formula' ? l * 0.05 : -l * 0.1, 0, w * (style === 'formula' ? 0.3 : 0.42), 0, Math.PI * 2);
  g.fill();
}
