/**
 * Importa as imagens geradas (carros por categoria e retratos) para dentro do jogo.
 *
 * Lê os originais de `assets/higgsfield/` e grava versões em WebP, nos tamanhos de celular, em
 * `src/assets/generated/`, de onde o jogo as carrega (o aplicativo não busca nada na rede).
 *
 *   assets/higgsfield/carros/<id da categoria>.(png|jpg|jpeg|webp)
 *       ids: kart-regional, kart-national, kart-international, f4, f3, f2, f1
 *       → src/assets/generated/carros/<id>.webp, 640 px de largura (320 px na tela, em 2×),
 *         mantendo a proporção e a transparência.
 *   assets/higgsfield/retratos/<qualquer nome>.(png|jpg|jpeg|webp)
 *       "jogador.*" é o retrato do piloto do jogador; os demais formam o elenco e são
 *       distribuídos entre os outros pilotos (sempre o mesmo retrato para o mesmo piloto).
 *       → src/assets/generated/retratos/<nome>.webp, 256×320 (proporção 4:5, corte centrado
 *         no alto da imagem, onde costuma ficar o rosto).
 *
 * Sem a pasta de origem (ou sem uma das subpastas), não faz nada e o jogo segue com as imagens
 * atuais. Imagem que faltar também cai na reserva: o carro desenhado pelo jogo e a placa com o
 * número do piloto.
 *
 * Uso: npm run app:images            (opções: --from <pasta> --out <pasta>)
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const FROM = option('--from', join(ROOT, 'assets/higgsfield'));
const OUT = option('--out', join(ROOT, 'src/assets/generated'));

export const CAR_IDS = ['kart-regional', 'kart-national', 'kart-international', 'f4', 'f3', 'f2', 'f1'];
/** Largura do carro (px): o dobro dos 320 px que ele ocupa na tela, para telas 2×. */
const CAR_WIDTH = 640;
/** Retrato em 4:5: o dobro de 128×160. */
const PORTRAIT = { width: 256, height: 320 };
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** Nome de arquivo seguro: minúsculas, sem acentos nem espaços. */
const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const list = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => IMAGE.test(name))
        .sort()
    : [];

async function run() {
  const cars = list(join(FROM, 'carros'));
  const portraits = list(join(FROM, 'retratos'));
  if (cars.length === 0 && portraits.length === 0) {
    console.log(`Nenhuma imagem em ${FROM} (carros/ e retratos/). Nada a importar; o jogo usa as imagens atuais.`);
    return;
  }
  // A saída é sempre refeita por inteiro: o que sumiu da origem some do jogo.
  rmSync(join(OUT, 'carros'), { recursive: true, force: true });
  rmSync(join(OUT, 'retratos'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'carros'), { recursive: true });
  mkdirSync(join(OUT, 'retratos'), { recursive: true });

  for (const file of cars) {
    const id = basename(file, extname(file));
    if (!CAR_IDS.includes(id)) {
      console.log(`  carros/${file}: ignorado (o nome tem de ser o id de uma categoria: ${CAR_IDS.join(', ')})`);
      continue;
    }
    const info = await sharp(join(FROM, 'carros', file))
      .resize({ width: CAR_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(join(OUT, 'carros', `${id}.webp`));
    console.log(`  carros/${id}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} kB`);
  }
  for (const file of portraits) {
    const name = slug(basename(file, extname(file)));
    if (!name) continue;
    const info = await sharp(join(FROM, 'retratos', file))
      .resize({ ...PORTRAIT, fit: 'cover', position: 'top' })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(join(OUT, 'retratos', `${name}.webp`));
    console.log(`  retratos/${name}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} kB`);
  }
  const missing = CAR_IDS.filter((id) => !existsSync(join(OUT, 'carros', `${id}.webp`)));
  if (missing.length > 0) console.log(`Categorias sem imagem (usam o carro atual): ${missing.join(', ')}`);
  console.log('Pronto. Rode `npm run app:sync` para levar as imagens ao aplicativo.');
}

await run();
