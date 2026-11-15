/**
 * Gera o ícone e a tela de abertura PROVISÓRIOS do aplicativo, a partir da marca atual (o "A"
 * chanfrado em vermelho sobre grafite), e grava por cima de cada imagem dos projetos Android e
 * iOS, no tamanho que cada uma já tem. Quando a arte final existir, ela substitui este script
 * (ver ASSETS.md).
 *
 * Uso: npm run app:icons
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = new URL('..', import.meta.url).pathname;
const FONT = readFileSync(join(ROOT, 'src/assets/fonts/barlow-condensed-latin-700-normal.woff2')).toString('base64');
const GRAPHITE = '#15181d';
const RED = '#e8402f';

/** Largura e altura de um PNG, lidas do cabeçalho. */
function pngSize(file) {
  const data = readFileSync(file);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** A marca: quadrado vermelho chanfrado com o "A" em itálico. `size` é o lado, em px. */
const mark = (size) => `
  <div style="width:${size}px;height:${size}px;background:${RED};display:grid;place-items:center;
    clip-path:polygon(22% 0,100% 0,100% 78%,78% 100%,0 100%,0 22%)">
    <span style="font:italic 700 ${size * 0.78}px/1 'Barlow Condensed';color:#fff;transform:translateX(-3%)">A</span>
  </div>`;

const stripes = `repeating-linear-gradient(-55deg, rgba(255,255,255,0.035) 0 6%, transparent 6% 12%)`;

function page({ width, height, background, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url(data:font/woff2;base64,${FONT}) format('woff2'); }
    html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${background}; overflow: hidden; }
    body { display: grid; place-items: center; }
  </style></head><body>${body}</body></html>`;
}

const DESIGNS = {
  /** Ícone quadrado, sem transparência (o iOS não aceita ícone com fundo transparente). */
  icon: ({ width }) => page({ width, height: width, background: `${stripes}, ${GRAPHITE}`, body: mark(width * 0.6) }),
  /** Ícone redondo do Android: o mesmo desenho dentro de um círculo. */
  round: ({ width }) =>
    page({
      width,
      height: width,
      background: 'transparent',
      body: `<div style="width:100%;height:100%;border-radius:50%;background:${stripes}, ${GRAPHITE};display:grid;place-items:center">${mark(width * 0.52)}</div>`,
    }),
  /** Camada da frente do ícone adaptável do Android: só a marca, dentro da área segura (66% do centro). */
  foreground: ({ width }) => page({ width, height: width, background: 'transparent', body: mark(width * 0.4) }),
  /** Tela de abertura: a marca e o nome do jogo, centrados no grafite. */
  splash: ({ width, height }) => {
    const unit = Math.min(width, height);
    return page({
      width,
      height,
      background: GRAPHITE,
      body: `<div style="display:grid;justify-items:center;gap:${unit * 0.035}px">${mark(unit * 0.17)}
        <div style="font:700 ${unit * 0.042}px/1 'Barlow Condensed';letter-spacing:0.14em;color:#e9edf3;text-transform:uppercase;white-space:nowrap">
          Apex <span style="color:${RED}">Motorsport</span> Dynasty</div></div>`,
    });
  },
};

function designFor(file) {
  if (file.includes('splash') || file.includes('Splash')) return 'splash';
  if (file.endsWith('ic_launcher_foreground.png')) return 'foreground';
  if (file.endsWith('ic_launcher_round.png')) return 'round';
  return 'icon';
}

const targets = [
  ...walk(join(ROOT, 'android/app/src/main/res')).filter((file) => file.endsWith('.png')),
  ...walk(join(ROOT, 'ios/App/App/Assets.xcassets')).filter((file) => file.endsWith('.png')),
].map((file) => ({ file, design: designFor(file), ...pngSize(file) }));

// Originais para a loja e para conferência, fora dos projetos nativos.
mkdirSync(join(ROOT, 'resources'), { recursive: true });
targets.push(
  { file: join(ROOT, 'resources/icone-provisorio.png'), design: 'icon', width: 1024, height: 1024 },
  { file: join(ROOT, 'resources/abertura-provisoria.png'), design: 'splash', width: 2732, height: 2732 },
);

const browser = await chromium.launch();
const tab = await browser.newPage();
for (const target of targets) {
  await tab.setViewportSize({ width: target.width, height: target.height });
  await tab.setContent(DESIGNS[target.design](target));
  await tab.evaluate(() => document.fonts.ready);
  const transparent = target.design === 'round' || target.design === 'foreground';
  writeFileSync(target.file, await tab.screenshot({ omitBackground: transparent, type: 'png' }));
  console.log(`${target.design.padEnd(10)} ${String(target.width).padStart(4)}×${String(target.height).padEnd(4)} ${target.file.slice(ROOT.length)}`);
}
await browser.close();

// O fundo do ícone adaptável do Android acompanha o grafite da marca.
writeFileSync(
  join(ROOT, 'android/app/src/main/res/values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GRAPHITE}</color>\n</resources>\n`,
);
