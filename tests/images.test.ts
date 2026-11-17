/**
 * Imagens geradas (carros por categoria e retratos): quem recebe qual retrato, a reserva quando
 * falta imagem e o conversor (`npm run app:images`), rodado sobre imagens de teste.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { PLAYER_PORTRAIT, categoryCarUrl, portraitUrl, selectPortrait } from '@/ui/images';

describe('retratos', () => {
  const pool = ['ana', 'bruno', 'carla', PLAYER_PORTRAIT];

  it('o jogador usa o retrato "jogador"; sem ele, cai na reserva', () => {
    expect(selectPortrait(pool, 'player', true)).toBe(PLAYER_PORTRAIT);
    expect(selectPortrait(['ana', 'bruno'], 'player', true)).toBeNull();
  });

  it('os outros pilotos recebem um retrato do elenco, sempre o mesmo para a mesma pessoa, e nunca o do jogador', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `ai-${i}`);
    const first = ids.map((id) => selectPortrait(pool, id, false));
    expect(ids.map((id) => selectPortrait(pool, id, false))).toEqual(first);
    // A ordem em que os arquivos são listados não muda quem recebe o quê.
    expect(ids.map((id) => selectPortrait([...pool].reverse(), id, false))).toEqual(first);
    expect(first).not.toContain(PLAYER_PORTRAIT);
    expect(first).not.toContain(null);
    // O elenco inteiro é usado.
    expect(new Set(first).size).toBe(3);
  });

  it('sem nenhuma imagem importada, tudo cai na reserva', () => {
    expect(selectPortrait([], 'ai-1', false)).toBeNull();
    expect(selectPortrait([PLAYER_PORTRAIT], 'ai-1', false)).toBeNull();
    // No repositório ainda não há imagens geradas: as telas usam o carro e a placa atuais.
    if (!existsSync('src/assets/generated')) {
      expect(portraitUrl('ai-1', false)).toBeNull();
      for (const category of CATEGORIES) expect(categoryCarUrl(category.id)).toBeNull();
    }
  });
});

describe('conversor de imagens', () => {
  const work = mkdtempSync(join(tmpdir(), 'apex-imagens-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));
  const run = (from: string, out: string) => execFileSync('node', ['scripts/importar-imagens.mjs', '--from', from, '--out', out], { encoding: 'utf8' });

  it('sem a pasta de origem, não faz nada', () => {
    const out = join(work, 'saida-vazia');
    expect(run(join(work, 'nao-existe'), out)).toContain('Nada a importar');
    expect(existsSync(out)).toBe(false);
  });

  it('converte carros e retratos para WebP nos tamanhos de celular e ignora o que não reconhece', async () => {
    const from = join(work, 'origem');
    const out = join(work, 'saida');
    mkdirSync(join(from, 'carros'), { recursive: true });
    mkdirSync(join(from, 'retratos'), { recursive: true });
    const image = (width: number, height: number) => sharp({ create: { width, height, channels: 4, background: { r: 200, g: 60, b: 40, alpha: 1 } } }).png();
    await image(1600, 900).toFile(join(from, 'carros', 'f4.png'));
    await image(1600, 900).toFile(join(from, 'carros', 'carro-desconhecido.png'));
    await image(1024, 1024).toFile(join(from, 'retratos', 'Jogador.png'));
    await image(900, 1400).toFile(join(from, 'retratos', 'João da Silva.png'));

    const log = run(from, out);
    expect(readdirSync(join(out, 'carros'))).toEqual(['f4.webp']);
    expect(readdirSync(join(out, 'retratos')).sort()).toEqual(['joao-da-silva.webp', 'jogador.webp']);
    expect(log).toContain('carro-desconhecido.png: ignorado');
    expect(log).toContain('Categorias sem imagem');

    const car = await sharp(join(out, 'carros', 'f4.webp')).metadata();
    expect([car.format, car.width, car.height]).toEqual(['webp', 640, 360]);
    for (const file of ['jogador.webp', 'joao-da-silva.webp']) {
      const portrait = await sharp(join(out, 'retratos', file)).metadata();
      expect([portrait.format, portrait.width, portrait.height]).toEqual(['webp', 256, 320]);
    }

    // Rodar de novo refaz a saída: o que sumiu da origem some do jogo.
    rmSync(join(from, 'retratos', 'João da Silva.png'));
    run(from, out);
    expect(readdirSync(join(out, 'retratos'))).toEqual(['jogador.webp']);
  });
});
