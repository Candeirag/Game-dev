/**
 * Sistema de design (Fase 1): o que dá para conferir sem abrir o navegador. Tokens e contraste
 * da paleta, letras dos pneus, fonte condensada só em texto grande, tamanhos de texto só pelos
 * tokens, ícones sem emoji, sons curtos, a tabela de vibração e os ajustes do jogador.
 *
 * O que depende da tela desenhada (contraste de cada elemento, áreas de toque, algarismos de
 * largura fixa) é conferido em e2e/telas.spec.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TYRE_COMPOUNDS } from '@/domain/schemas';
import { HAPTIC_PATTERNS } from '@/platform/haptics';
import { FEEDBACK } from '@/ui/feedback/feedback';
import { SOUNDS, SOUND_IDS, soundDuration, volumeToGain } from '@/ui/feedback/sounds';
import { formatGap, formatInterval, formatLap, formatMoneyAs } from '@/ui/format';
import { TYRE_LETTERS, tyreName } from '@/ui/kit/TyreBadge';
import { DEFAULT_SETTINGS, MAX_TEXT_SCALE, SYSTEM_SCALE_RANGE, TEXT_SIZES, TEXT_SIZE_SCALE, parseSettings, textScale } from '@/ui/settings/settings';

/** Usos do passo de 12 px (p-3, gap-3…) que sobraram nas telas antigas. Só diminui. */
const STEP_3_LEFT = 288;

const ROOT = join(__dirname, '..');
const UI = join(ROOT, 'src', 'ui');

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, pattern) : pattern.test(name) ? [path] : [];
  });
}
const uiSources = files(UI, /\.(ts|tsx)$/);
const tokens = readFileSync(join(UI, 'tokens.css'), 'utf8');

/** Valor de um token de cor (`--color-ink-900: #1d222a;`) no tema padrão. */
function color(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`).exec(tokens);
  if (!match?.[1]) throw new Error(`Token de cor não encontrado: ${name}`);
  return match[1];
}
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(value >> 16) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens', () => {
  it('ficam num arquivo só: cor, tipografia, espaçamento, cantos, sombras e movimento', () => {
    for (const token of [
      '--color-ink-950',
      '--color-apex-500',
      '--text-2xs',
      '--text-title',
      '--spacing',
      '--space-1',
      '--chamfer-md',
      '--shadow-ring',
      '--shadow-overlay',
      '--motion-base',
      '--touch-min',
      '--safe-bottom',
    ])
      expect(tokens, token).toContain(`${token}:`);
    // Nenhum outro arquivo de estilo define cor ou tamanho de texto do tema.
    for (const file of [join(ROOT, 'src', 'index.css'), join(UI, 'fonts.css')]) {
      expect(readFileSync(file, 'utf8'), relative(ROOT, file)).not.toMatch(/--color-[a-z]+-\d+\s*:|--text-[a-z0-9]+\s*:/);
    }
  });

  it('a escala de texto segue o tamanho de texto do aparelho e o ajuste do jogo', () => {
    const sizes = [...tokens.matchAll(/--text-([a-z0-9]+):\s*([^;]+);/g)].filter(([, name]) => !name?.startsWith('scale'));
    expect(sizes.length).toBeGreaterThanOrEqual(8);
    for (const [, name, value] of sizes) expect(value, `--text-${name}`).toMatch(/^calc\([\d.]+rem \* var\(--text-scale\)\)$/);
    // Nada menor que 11 px (0,6875 rem).
    for (const [, name, value] of sizes) expect(Number.parseFloat(value?.slice(5) ?? '0'), `--text-${name}`).toBeGreaterThanOrEqual(0.6875);
  });

  it('o espaçamento é a grade de 8 px (com o meio passo de 4)', () => {
    expect(tokens).toMatch(/--spacing:\s*0\.25rem;/);
    const steps = [...tokens.matchAll(/--space-(\d+):\s*([\d.]+)rem;/g)].map(([, step, rem]) => [Number(step), Number(rem) * 16] as const);
    expect(steps.length).toBeGreaterThanOrEqual(5);
    for (const [step, px] of steps) expect(px, `--space-${step}`).toBe(step * 8);
  });

  it('o passo de 12 px das telas antigas não cresce (e os fracionados não voltam)', () => {
    const spacing = /(?<=["' :`])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(0\.5|1\.5|2\.5|3|3\.5|5|7|9|11)(?=["' `])/g;
    const counts = new Map<string, number>();
    for (const file of uiSources) {
      for (const match of readFileSync(file, 'utf8').matchAll(spacing)) counts.set(match[1] ?? '', (counts.get(match[1] ?? '') ?? 0) + 1);
    }
    // Fora da grade de 8 px (com o meio passo de 4) só resta o passo 3, em telas de antes da
    // Fase 1. O número abaixo só pode cair: quem mexer numa tela troca os dela por 2 ou 4.
    expect([...counts.keys()].sort()).toEqual(['3']);
    expect(counts.get('3')).toBeLessThanOrEqual(STEP_3_LEFT);
  });

  it('a paleta cumpre os mínimos de contraste: 4,5:1 para texto, 3:1 para contornos e ícones', () => {
    const surfaces = ['ink-950', 'ink-900', 'ink-850', 'ink-800'];
    // Texto (do apagado ao principal) sobre todas as chapas.
    for (const text of ['ink-400', 'ink-300', 'ink-200', 'ink-100', 'gold-400', 'go-400', 'rain-400', 'apex-400'])
      for (const surface of surfaces) expect(contrast(color(text), color(surface)), `${text} sobre ${surface}`).toBeGreaterThanOrEqual(4.5);
    // Sobre a linha (ink-700), o texto é ink-300 ou mais claro.
    for (const text of ['ink-300', 'ink-200', 'ink-100']) expect(contrast(color(text), color('ink-700')), `${text} sobre ink-700`).toBeGreaterThanOrEqual(4.5);
    // Texto branco sobre o vermelho dos botões, normal e pressionado.
    for (const fill of ['apex-500', 'apex-600']) expect(contrast('#ffffff', color(fill)), `branco sobre ${fill}`).toBeGreaterThanOrEqual(4.5);
    // Texto escuro sobre âmbar, verde e azul.
    for (const fill of ['gold-400', 'go-400', 'rain-400']) expect(contrast(color('ink-950'), color(fill)), `ink-950 sobre ${fill}`).toBeGreaterThanOrEqual(4.5);
    // Contorno de controle e preenchimento vermelho contra as chapas.
    for (const surface of surfaces) expect(contrast(color('ink-500'), color(surface)), `ink-500 sobre ${surface}`).toBeGreaterThanOrEqual(3);
    for (const surface of ['ink-950', 'ink-900']) expect(contrast(color('apex-500'), color(surface)), `apex-500 sobre ${surface}`).toBeGreaterThanOrEqual(3);
  });

  it('o modo para daltônicos troca o verde por azul e mantém o contraste', () => {
    const block = /:root\[data-vision="daltonico"\]\s*\{([^}]+)\}/.exec(tokens)?.[1] ?? '';
    const good = /--color-go-400:\s*(#[0-9a-f]{6});/.exec(block)?.[1];
    expect(good).toBeDefined();
    if (!good) return;
    const value = Number.parseInt(good.slice(1), 16);
    // Azul: o canal azul domina o vermelho (o verde do tema padrão é o contrário).
    expect(value & 255).toBeGreaterThan(value >> 16);
    for (const surface of ['ink-950', 'ink-900', 'ink-850', 'ink-800']) expect(contrast(good, color(surface))).toBeGreaterThanOrEqual(4.5);
    // Os cinco compostos de pneu ganham cor própria nesse modo.
    for (const tyre of ['soft', 'medium', 'hard', 'inter', 'wet']) expect(block).toContain(`--color-tyre-${tyre}:`);
  });
});

describe('fontes', () => {
  it('só Barlow Condensed e Inter, embutidas, com as licenças OFL ao lado', () => {
    const fonts = readdirSync(join(ROOT, 'src', 'assets', 'fonts'));
    for (const license of ['OFL-BarlowCondensed.txt', 'OFL-Inter.txt']) {
      expect(fonts).toContain(license);
      expect(readFileSync(join(ROOT, 'src', 'assets', 'fonts', license), 'utf8')).toContain('SIL Open Font License');
    }
    // Nenhum arquivo de fonte além das duas famílias do jogo (a Saira do comparativo saiu).
    expect(fonts.filter((name) => /\.(woff2?|ttf|otf)$/.test(name) && !/^(barlow-condensed|inter)-/.test(name))).toEqual([]);
    expect(fonts.filter((name) => name.startsWith('OFL-')).sort()).toEqual(['OFL-BarlowCondensed.txt', 'OFL-Inter.txt']);
    const css = readFileSync(join(UI, 'fonts.css'), 'utf8');
    const families = [...new Set([...css.matchAll(/font-family:\s*"([^"]+)"/g)].map((m) => m[1]))].sort();
    // Só as duas famílias do jogo; nenhuma terceira fonte decorativa.
    expect(families).toEqual(['Barlow Condensed', 'Inter']);
    expect(tokens).toMatch(/--font-display:\s*"Barlow Condensed"/);
    expect(tokens).toMatch(/--font-sans:\s*"Inter"/);
  });

  it('a fonte condensada só aparece em texto de 16 px ou mais; texto pequeno é sempre em Inter', () => {
    const found: string[] = [];
    for (const file of uiSources) {
      for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        // Cada literal de classes da linha: se pede a fonte de título, não pode pedir tamanho pequeno.
        for (const literal of line.match(/(['"`])(?:(?!\1).)*font-display(?:(?!\1).)*\1/g) ?? []) {
          if (/(^|[\s'"`])text-(2xs|xs|sm)\b/.test(literal)) found.push(`${relative(ROOT, file)}:${index + 1}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('tamanho de texto só pelos tokens: nenhum valor solto em px nas telas', () => {
    const found = uiSources.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (/\btext-\[\d+(\.\d+)?px\]/.test(line) ? [`${relative(ROOT, file)}:${index + 1}`] : [])),
    );
    expect(found).toEqual([]);
  });
});

describe('estados e ícones', () => {
  it('desativado não é opacidade: o estilo é um só, com texto legível', () => {
    const found = uiSources.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (/disabled:opacity-/.test(line) ? [`${relative(ROOT, file)}:${index + 1}`] : [])),
    );
    expect(found).toEqual([]);
    const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
    expect(css).toMatch(
      /:is\(button, input, select, textarea\):disabled,\s*\[aria-disabled="true"\]\s*\{[^}]*opacity:\s*1;[^}]*color:\s*var\(--color-ink-300\)/,
    );
  });

  it('um só conjunto de ícones (Lucide), sem emoji no código da interface', () => {
    // Pictogramas e símbolos que os sistemas desenham como emoji (inclui ▲ ▼ ✓ ✗ ★ ⚠).
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}]|\u{FE0F}/u;
    const found = uiSources.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (emoji.test(line.replace(/\/\/.*$|\/?\*.*$/, '')) ? [`${relative(ROOT, file)}:${index + 1}`] : [])),
    );
    expect(found).toEqual([]);
    const iconLibraries = new Set(
      uiSources.flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/from '((?:@heroicons|react-icons|@tabler|@phosphor-icons|lucide-react)[^']*)'/g)].map((m) => m[1]),
      ),
    );
    expect([...iconLibraries]).toEqual(['lucide-react']);
  });

  it('cada composto de pneu tem uma letra só dele, a das transmissões, e o nome em português junto', () => {
    expect(TYRE_LETTERS).toEqual({ soft: 'S', medium: 'M', hard: 'H', intermediate: 'I', wet: 'W', kart: 'K' });
    expect(tyreName('soft')).toBe('macio (S)');
    expect(tyreName('wet', { capitalized: true })).toBe('Chuva (W)');
    const letters = TYRE_COMPOUNDS.map((compound) => TYRE_LETTERS[compound]);
    for (const letter of letters) expect(letter).toMatch(/^[A-Z]$/);
    expect(new Set(letters).size).toBe(TYRE_COMPOUNDS.length);
  });
});

describe('números', () => {
  it('diferenças de tempo sempre com três casas', () => {
    expect(formatInterval(0.2341)).toBe('+0.234');
    expect(formatInterval(12)).toBe('+12.000');
    expect(formatInterval(-1.05)).toBe('−1.050');
    expect(formatInterval(0)).toBe('+0.000');
    expect(formatGap(3.5)).toBe('+3.500');
    expect(formatLap(83.4567)).toBe('1:23.457');
    expect(formatLap(48.2)).toBe('48.200');
  });

  it('nenhuma tela escreve tempo com uma ou duas casas', () => {
    const found = uiSources.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (/\.toFixed\([12]\)\}?s\b|toFixed\([12]\)\s*\+\s*'s'/.test(line) ? [`${relative(ROOT, file)}:${index + 1}`] : [])),
    );
    expect(found).toEqual([]);
  });

  it('dinheiro: abreviado para os cartões, completo para os detalhes', () => {
    expect(formatMoneyAs(1_250_000, 'BRL')).toBe('R$ 1,25 mi');
    expect(formatMoneyAs(250_000, 'BRL')).toBe('R$ 250 mil');
    expect(formatMoneyAs(1_250_000, 'BRL', { compact: false })).toBe('R$ 1.250.000');
    expect(formatMoneyAs(-4000, 'BRL', { sign: true })).toBe('−R$ 4.000');
  });
});

describe('vibração e som', () => {
  it('cada acontecimento tem um padrão fixo, e os tipos seguem a tabela combinada', () => {
    const events = Object.entries(FEEDBACK);
    for (const [name, spec] of events) {
      expect(spec.haptic !== null || spec.sound !== null, name).toBe(true);
      if (spec.haptic) expect(HAPTIC_PATTERNS, name).toContain(spec.haptic);
      if (spec.sound) expect(SOUND_IDS, name).toContain(spec.sound);
    }
    const byHaptic = (pattern: string) =>
      events
        .filter(([, spec]) => spec.haptic === pattern)
        .map(([name]) => name)
        .sort();
    expect(byHaptic('success')).toEqual(['contractSigned', 'podium', 'title', 'victory']);
    expect(byHaptic('error')).toEqual(['contact', 'penalty', 'retirement']);
    expect(byHaptic('warning')).toEqual(['riskyDecision']);
    expect(byHaptic('selection')).toEqual(['paceChange', 'tyreChoice']);
  });

  it('há som para a bandeirada, o pódio e a proposta chegando; todos curtos', () => {
    expect(FEEDBACK.chequeredFlag.sound).toBe('chequered');
    expect(FEEDBACK.podium.sound).toBe('podium');
    expect(FEEDBACK.offerArrived.sound).toBe('offer');
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].length, id).toBeGreaterThan(0);
      expect(soundDuration(id), id).toBeLessThanOrEqual(1.5);
      for (const note of SOUNDS[id]) {
        expect(note.gain, id).toBeGreaterThan(0);
        expect(note.gain, id).toBeLessThanOrEqual(1);
        expect(note.frequency, id).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it('o volume vai de mudo a cheio, sem passar do limite', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(50)).toBeCloseTo(0.25);
    expect(volumeToGain(250)).toBe(1);
    expect(volumeToGain(-10)).toBe(0);
  });
});

describe('ajustes do jogador', () => {
  it('sem nada guardado, valem os padrões; anotação estragada não derruba o jogo', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{isto não é json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2,3]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ textSize: 'gigante', musicVolume: 'alto', effectsVolume: 400, colorBlind: 'sim' }))).toEqual({
      ...DEFAULT_SETTINGS,
      effectsVolume: 100,
    });
  });

  it('guarda tamanho do texto, modo para daltônicos, menos movimento, vibração e os dois volumes', () => {
    const saved = { textSize: 'large', colorBlind: true, reduceMotion: true, haptics: false, musicVolume: 0, effectsVolume: 30 } as const;
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it('o tamanho do texto soma o do aparelho ao do jogo, dentro de limites', () => {
    expect(TEXT_SIZES).toEqual(['small', 'default', 'large', 'xlarge']);
    expect(textScale('default', 1)).toEqual({ system: 1, user: 1 });
    expect(textScale('large', 1.2)).toEqual({ system: 1.2, user: TEXT_SIZE_SCALE.large });
    // O aparelho pedindo um texto enorme (ou minúsculo) fica nos limites.
    expect(textScale('default', 3).system).toBe(SYSTEM_SCALE_RANGE.max);
    expect(textScale('default', 0.2).system).toBe(SYSTEM_SCALE_RANGE.min);
    // O produto dos dois nunca passa do teto.
    for (const size of TEXT_SIZES) {
      const scale = textScale(size, 1.5);
      expect(scale.system * scale.user).toBeLessThanOrEqual(MAX_TEXT_SCALE + 1e-9);
    }
    // Medição inválida conta como "padrão".
    expect(textScale('default', Number.NaN).system).toBe(1);
  });
});
