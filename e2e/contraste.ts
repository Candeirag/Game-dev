/**
 * Medição de contraste das telas (regra 6 do CLAUDE.md), feita dentro da página.
 *
 * Para cada texto, ícone e contorno de controle visível, calcula a cor que de fato chega à tela
 * (a cor do elemento composta sobre os fundos dos ancestrais, com as opacidades de cada grupo) e
 * a razão de contraste da WCAG entre ela e o fundo. Os mínimos:
 *
 * - texto normal: 4,5:1;
 * - texto grande (24 px ou mais; 18,66 px ou mais em negrito), ícones e contornos de botões e
 *   campos: 3:1.
 *
 * Estados desativados entram na conta como qualquer outro texto: o jogador precisa conseguir ler
 * o que está indisponível.
 *
 * O que a medição não vê: imagens e degradês de fundo (usa a cor de fundo que estiver embaixo) e
 * o desenho da pista. Para as camadas que ficam sobre a pista (`data-overlay-ok`) ela considera o
 * pior caso: o trecho mais claro do cenário atrás da camada.
 */
import type { Page } from '@playwright/test';

export interface Medida {
  tipo: 'texto' | 'icone' | 'contorno';
  /** Trecho do texto, ou o nome do controle ou do ícone. */
  rotulo: string;
  /** Cor da frente e do fundo, como chegam à tela (#rrggbb). */
  frente: string;
  fundo: string;
  razao: number;
  minimo: number;
  grande: boolean;
  desativado: boolean;
  sobrePista: boolean;
}

/** Folga de arredondamento: a razão é comparada com duas casas. */
export const FOLGA = 0.005;

export function reprovadas(medidas: readonly Medida[]): Medida[] {
  return medidas.filter((m) => m.razao < m.minimo - FOLGA);
}

export function descrever(m: Medida): string {
  const estado = [m.grande ? 'grande' : '', m.desativado ? 'desativado' : '', m.sobrePista ? 'sobre a pista' : ''].filter(Boolean).join(', ');
  return `${m.tipo} "${m.rotulo}" ${m.frente} sobre ${m.fundo}: ${m.razao.toFixed(2)}:1 (mínimo ${m.minimo}:1)${estado ? ` [${estado}]` : ''}`;
}

export async function medirContraste(page: Page): Promise<Medida[]> {
  return page.evaluate(async () => {
    // Entradas em curso terminam antes da medida: no meio de um esmaecer, a cor ainda não é a final.
    const running = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY);
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    type Rgba = [number, number, number, number];
    /** O ponto mais claro do cenário da pista (zebras e faixas brancas), para as camadas sobre ela. */
    const PISTA_CLARA: Rgba = [232, 232, 232, 1];

    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    const parsed = new Map<string, Rgba>();
    /** Qualquer cor de CSS (rgb, oklab, color-mix já resolvido) em RGBA de 0 a 255 e alfa de 0 a 1. */
    const parse = (color: string): Rgba => {
      const known = parsed.get(color);
      if (known) return known;
      let out: Rgba = [0, 0, 0, 0];
      if (ctx && color && color !== 'transparent') {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
      }
      parsed.set(color, out);
      return out;
    };
    /** `top` sobre `under`, as duas com alfa (não pré-multiplicado). */
    const over = (under: Rgba, top: Rgba): Rgba => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a <= 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const fade = (color: Rgba, opacity: number): Rgba => [color[0], color[1], color[2], color[3] * opacity];
    const luminance = (c: Rgba): number => {
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    };
    const ratio = (a: Rgba, b: Rgba): number => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const hex = (c: Rgba): string => `#${[c[0], c[1], c[2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

    const styles = new Map<Element, CSSStyleDeclaration>();
    const styleOf = (element: Element): CSSStyleDeclaration => {
      let style = styles.get(element);
      if (!style) {
        style = getComputedStyle(element);
        styles.set(element, style);
      }
      return style;
    };
    const canvasColor = over([255, 255, 255, 1], parse(styleOf(document.documentElement).backgroundColor));

    /**
     * Cor do fundo e de uma camada pintada dentro de `element` (o texto, um contorno), como chegam
     * à tela. Segue a cadeia de ancestrais da raiz até o elemento; um ancestral com opacidade é
     * um grupo: pinta-se o grupo à parte e só então ele entra, esmaecido, sobre o que há embaixo.
     */
    const paint = (element: Element, layer: Rgba | null): { fundo: Rgba; frente: Rgba; sobrePista: boolean } => {
      const chain: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
      let sobrePista = false;
      const render = (index: number, under: Rgba): [Rgba, Rgba] => {
        const node = chain[index];
        if (!node) return [under, layer ? over(under, layer) : under];
        const style = styleOf(node);
        const opacity = Number(style.opacity);
        let base = under;
        if (node.hasAttribute('data-overlay-ok')) {
          sobrePista = true;
          base = PISTA_CLARA;
        }
        const start: Rgba = opacity < 1 ? [0, 0, 0, 0] : base;
        const own = over(start, parse(style.backgroundColor));
        const [bg, fg] = render(index + 1, own);
        return opacity < 1 ? [over(base, fade(bg, opacity)), over(base, fade(fg, opacity))] : [bg, fg];
      };
      const [fundo, frente] = render(0, canvasColor);
      return { fundo, frente, sobrePista };
    };

    const shown = (element: Element): boolean => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const disabled = (element: Element): boolean => element.closest('button:disabled, input:disabled, select:disabled, [aria-disabled="true"]') !== null;
    const medidas: Medida[] = [];
    const push = (m: Medida) => {
      medidas.push({ ...m, razao: Math.round(m.razao * 100) / 100 });
    };

    // Textos.
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim().replace(/\s+/g, ' ') ?? '';
      const parent = node.parentElement;
      if (!text || !parent || seen.has(parent)) continue;
      if (!shown(parent) || parent.closest('svg, script, style, option, .sr-only, [inert]')) continue;
      const box = parent.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      seen.add(parent);
      const style = styleOf(parent);
      const { fundo, frente, sobrePista } = paint(parent, parse(style.color));
      const size = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const grande = size >= 24 || (size >= 18.66 && bold);
      push({
        tipo: 'texto',
        rotulo: text.slice(0, 40),
        frente: hex(frente),
        fundo: hex(fundo),
        razao: ratio(frente, fundo),
        minimo: grande ? 3 : 4.5,
        grande,
        desativado: disabled(parent),
        sobrePista,
      });
    }

    // Ícones (o traço usa a cor do texto do elemento).
    for (const icon of document.querySelectorAll('svg')) {
      if (!shown(icon) || icon.closest('.sr-only, [inert]') || icon.getAttribute('role') === 'img') continue;
      const box = icon.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.width > 48) continue;
      const style = styleOf(icon);
      const stroke = style.stroke && style.stroke !== 'none' ? style.stroke : style.fill && style.fill !== 'none' ? style.fill : style.color;
      const { fundo, frente, sobrePista } = paint(icon, parse(stroke));
      const owner = icon.closest('button, a, [role="img"], [title]');
      const name = (owner?.getAttribute('aria-label') ?? owner?.getAttribute('title') ?? owner?.textContent ?? icon.getAttribute('class') ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      push({
        tipo: 'icone',
        rotulo: name || 'ícone',
        frente: hex(frente),
        fundo: hex(fundo),
        razao: ratio(frente, fundo),
        minimo: 3,
        grande: false,
        desativado: disabled(icon),
        sobrePista,
      });
    }

    // Contornos de botões e campos: a borda (ou o anel interno) contra o que há em volta.
    for (const control of document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"]')) {
      if (!shown(control) || control.closest('.sr-only, [inert]')) continue;
      if (control instanceof HTMLInputElement && ['file', 'hidden', 'checkbox', 'radio', 'range'].includes(control.type)) continue;
      const box = control.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = styleOf(control);
      let edge: string | null = null;
      if (Number.parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') edge = style.borderTopColor;
      else {
        // Anel interno: `box-shadow: <cor> 0 0 0 1px inset`.
        const ring = /^(.+?)\s+0px\s+0px\s+0px\s+[\d.]+px\s+inset/.exec(style.boxShadow);
        if (ring?.[1]) edge = ring[1];
      }
      if (!edge || parse(edge)[3] === 0) continue;
      const parent = control.parentElement ?? document.body;
      const outside = paint(parent, null);
      const inside = paint(control, parse(edge));
      const filled = paint(control, null);
      // Vale o mais visível entre o contorno e o próprio preenchimento do controle.
      const best = Math.max(ratio(inside.frente, outside.fundo), ratio(filled.fundo, outside.fundo));
      const edgeWins = ratio(inside.frente, outside.fundo) >= ratio(filled.fundo, outside.fundo);
      const name = (control.getAttribute('aria-label') ?? control.textContent ?? control.getAttribute('name') ?? control.tagName)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      push({
        tipo: 'contorno',
        rotulo: name || control.tagName.toLowerCase(),
        frente: hex(edgeWins ? inside.frente : filled.fundo),
        fundo: hex(outside.fundo),
        razao: best,
        minimo: 3,
        grande: false,
        desativado: disabled(control),
        sobrePista: outside.sobrePista,
      });
    }
    return medidas;
  });
}
