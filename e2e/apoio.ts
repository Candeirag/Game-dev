/** Apoio aos testes no navegador: tamanhos de tela, abertura de saves e a verificação visual. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { descrever, medirContraste, reprovadas } from './contraste';

/**
 * Formatos conferidos. O aplicativo é feito para a tela deitada (844×390) e escala para tablet
 * e computador; o celular em pé continua valendo para quem joga pelo navegador.
 */
export const TELAS = [
  { nome: 'em-pe', width: 390, height: 844, toque: true, celular: true },
  { nome: 'deitado', width: 844, height: 390, toque: true, celular: true },
  { nome: 'tablet', width: 1180, height: 820, toque: true, celular: false },
  { nome: 'computador', width: 1366, height: 768, toque: false, celular: false },
] as const;

/** Menor lado aceito para uma área de toque, em px (44, com meio pixel de folga de arredondamento). */
const TOQUE_MINIMO = 43.5;

export const SAVES = {
  naLargada: 'tests/fixtures/v3/atual-kart-na-largada.json',
  fimDeTemporada: 'tests/fixtures/v3/atual-fim-de-temporada.json',
  formula: 'tests/fixtures/v2/formula-mid-season.json',
  antesDaReformulacao: 'tests/fixtures/v3/antes-da-reformulacao-kart-na-largada.json',
  /** Saves da versão 3, de antes dos nomes próprios das categorias: abrem pela migração 3 → 4. */
  antigoComAcademia: 'tests/fixtures/v3/fase0-monoposto-com-academia.json',
  antigoNoTopo: 'tests/fixtures/v3/fase0-topo-fim-de-temporada.json',
  antigoDirigente: 'tests/fixtures/v3/fase0-dirigente-dono-de-equipe.json',
} as const;

/** Nomes de marcas reais que saves antigos traziam por extenso e que não podem aparecer em tela nenhuma. */
export const NOMES_ANTIGOS = /\bF[1-4]\b|Fórmula [1-4]\b/;

/** Erros de página e de console acumulados durante um teste. */
export function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('pageerror', (error) => erros.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') erros.push(message.text());
  });
  return erros;
}

/** Abre o jogo no menu inicial e importa um save pelo seletor de arquivo. */
export async function abrirSave(page: Page, arquivo: string): Promise<void> {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', arquivo);
  await page.waitForURL(/#\/dashboard/);
  const aviso = page.getByRole('button', { name: 'Fechar aviso' });
  if (await aviso.count()) await aviso.click();
}

/**
 * Deixa um save gravado no armazenamento do navegador, como se uma versão anterior do jogo o
 * tivesse salvado naquele slot, e recarrega o menu inicial.
 */
export async function gravarNoAparelho(page: Page, slot: string, arquivo: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova carreira' }).waitFor();
  await page.evaluate(
    async ([chave, json]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const pedido = indexedDB.open('apex-motorsport-dynasty', 1);
        pedido.onupgradeneeded = () => {
          if (!pedido.result.objectStoreNames.contains('saves')) pedido.result.createObjectStore('saves');
        };
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transacao = db.transaction('saves', 'readwrite');
        transacao.objectStore('saves').put(JSON.parse(json), chave);
        transacao.oncomplete = () => resolve();
        transacao.onerror = () => reject(transacao.error);
      });
      db.close();
    },
    [slot, readFileSync(arquivo, 'utf8')] as const,
  );
  await page.reload();
}

/** Vai para uma tela pela navegação do jogo (trilho, barra inferior ou "Mais"). */
export async function irPara(page: Page, nome: string): Promise<void> {
  // O nome do link pode vir seguido de um aviso ("Carreira Há propostas"), por isso a busca é pelo começo.
  const link = new RegExp(`^${nome}`);
  // Logo depois de abrir um save a moldura ainda pode estar entrando: espera a navegação aparecer.
  await page.getByRole('navigation', { name: 'Navegação principal' }).first().waitFor();
  const direto = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: link });
  if (await direto.count()) await direto.first().click();
  else {
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
    await page.getByRole('dialog', { name: 'Mais telas' }).getByRole('link', { name: link }).click();
  }
  // Espera a troca de tela e as imagens (sprites e fontes) assentarem.
  await page.waitForTimeout(350);
}

export interface Sobreposicao {
  imagem: string;
  texto: string;
  area: string;
}

/**
 * Procura imagem em cima de texto (ou texto em cima de imagem) no conteúdo da tela.
 *
 * "Imagem" é todo elemento de imagem: <img>, <canvas> e SVG com papel de imagem (o traçado das
 * pistas). Ícones de interface não entram. Para cada uma, compara a caixa visível com a de cada
 * trecho de texto visível; se as duas se cruzam por mais de 3 px, é um defeito.
 *
 * Ficam de fora, de propósito:
 * - o que está dentro de um elemento marcado com `data-overlay-ok` (a transmissão da corrida,
 *   em que nomes e placares ficam sobre a pista);
 * - barras fixas e grudadas (navegação, barra superior, comandos da corrida), que passam por
 *   cima do conteúdo ao rolar.
 */
export async function sobreposicoes(page: Page): Promise<Sobreposicao[]> {
  return page.evaluate(() => {
    type Box = { left: number; top: number; right: number; bottom: number };
    const cross = (a: Box, b: Box): Box | null => {
      const box = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
      return box.right - box.left > 3 && box.bottom - box.top > 3 ? box : null;
    };
    const floating = (element: Element): boolean => {
      for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position === 'fixed' || position === 'sticky') return true;
        if (node.hasAttribute('data-overlay-ok')) return true;
      }
      return false;
    };
    /** Parte da caixa que os contêineres com rolagem ou corte deixam aparecer. */
    const visibleBox = (element: Element, rect: DOMRect): Box | null => {
      let box: Box | null = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      for (let node = element.parentElement; box && node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible' || style.clipPath !== 'none') {
          const clip = node.getBoundingClientRect();
          const next = {
            left: Math.max(box.left, clip.left),
            top: Math.max(box.top, clip.top),
            right: Math.min(box.right, clip.right),
            bottom: Math.min(box.bottom, clip.bottom),
          };
          box = next.right - next.left > 0.5 && next.bottom - next.top > 0.5 ? next : null;
        }
      }
      return box;
    };
    const shown = (element: Element): boolean => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const name = (element: Element): string => {
      const label = element.getAttribute('aria-label') ?? element.getAttribute('alt') ?? element.getAttribute('title') ?? '';
      return `<${element.tagName.toLowerCase()}> ${label}`.trim();
    };

    const images = [...document.querySelectorAll('img, canvas, svg[role="img"]')]
      .filter((element) => shown(element) && !floating(element))
      .map((element) => ({ element, box: visibleBox(element, element.getBoundingClientRect()) }))
      .filter((item): item is { element: Element; box: Box } => item.box !== null);

    const found: { imagem: string; texto: string; area: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (!text || !parent || !shown(parent) || floating(parent) || parent.closest('svg, script, style, .sr-only')) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const box = visibleBox(parent, rect);
        if (!box) continue;
        for (const image of images) {
          if (image.element.contains(parent)) continue;
          const hit = cross(box, image.box);
          if (hit)
            found.push({
              imagem: name(image.element),
              texto: text.slice(0, 50),
              area: `${Math.round(hit.right - hit.left)}×${Math.round(hit.bottom - hit.top)} px`,
            });
        }
      }
    }
    // Um mesmo par aparece uma vez só.
    const seen = new Set<string>();
    return found.filter((item) => {
      const key = `${item.imagem}|${item.texto}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

/**
 * Áreas de toque menores que 44×44 px. Conta tudo que é clicável e está visível: botões, links,
 * abas, campos e caixas de seleção (estas pelo rótulo que as envolve).
 */
export async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((minimo) => {
    const found: string[] = [];
    for (const element of document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"], summary')) {
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('.sr-only, [inert]')) continue;
      if (element instanceof HTMLInputElement && (element.type === 'file' || element.type === 'hidden')) continue;
      const label = element.matches('input[type="checkbox"], input[type="radio"]') ? element.closest('label') : null;
      const box = (label ?? element).getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.width < minimo || box.height < minimo) {
        const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        found.push(`<${element.tagName.toLowerCase()}> "${name}" (${Math.round(box.width)}×${Math.round(box.height)} px)`);
      }
    }
    return [...new Set(found)];
  }, TOQUE_MINIMO);
}

/**
 * Números fora da largura fixa: todo texto com algarismo tem de usar `tabular-nums` (tempos,
 * diferenças, dinheiro, posições e atributos não podem dançar quando mudam).
 */
export async function numerosSemLarguraFixa(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (!/\d/.test(text) || !parent || parent.closest('svg, script, style, option, .sr-only')) continue;
      if (!parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (!getComputedStyle(parent).fontVariantNumeric.includes('tabular-nums')) found.add(`"${text.slice(0, 40)}"`);
    }
    return [...found];
  });
}

/**
 * Texto pequeno em fonte condensada: a fonte de título (Barlow Condensed, ou a Saira do
 * comparativo) só vale a partir de 16 px, na escala de texto em vigor; abaixo disso é Inter.
 */
export async function condensadaPequena(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale-user') || '1') || 1;
    const system = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale-system') || '1') || 1;
    const minimum = 16 * scale * system - 0.5;
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (!text || !parent || parent.closest('svg, script, style, option, .sr-only')) continue;
      if (!parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const style = getComputedStyle(parent);
      const family = style.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() ?? '';
      if (/Condensed/i.test(family) && Number.parseFloat(style.fontSize) < minimum) found.add(`"${text.slice(0, 40)}" (${style.fontSize})`);
    }
    return [...found];
  });
}

/**
 * Alvos de toque colados: vizinhos precisam de uns 8 px entre si. Ficam de fora os que formam
 * um controle só, encostados de propósito e cada um com 44 px ou mais (abas, navegação, grupos
 * de botões como as velocidades da corrida) e as linhas de uma lista, uma embaixo da outra.
 */
export async function alvosColados(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const GAP = 7.5;
    const targets = [...document.querySelectorAll('button, a[href], input, select, textarea, summary')].filter((element) => {
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('.sr-only, [inert]')) return false;
      if (element instanceof HTMLInputElement && (element.type === 'file' || element.type === 'hidden')) return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    const group = (element: Element) => element.closest('[role="tablist"], [role="group"], [role="radiogroup"], [role="toolbar"], nav, ul, ol, table');
    // Barras fixas e grudadas passam por cima do conteúdo ao rolar: não são vizinhas dele.
    const floating = (element: Element): boolean => {
      for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position === 'fixed' || position === 'sticky') return true;
      }
      return false;
    };
    const name = (element: Element) => (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const found = new Set<string>();
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        if (!a || !b || a.contains(b) || b.contains(a)) continue;
        if (floating(a) !== floating(b)) continue;
        // Partes de um mesmo controle (abas, navegação, lista) encostam de propósito.
        const shared = group(a);
        if (shared && shared === group(b)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const overlapY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        const gapX = Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right);
        const gapY = Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom);
        const side = overlapY > 4 && gapX >= -0.5 && gapX < GAP;
        const stacked = overlapX > 4 && gapY >= -0.5 && gapY < GAP;
        if (side || stacked) found.add(`"${name(a)}" e "${name(b)}" (${Math.round(side ? gapX : gapY)} px)`);
      }
    }
    return [...found];
  });
}

/**
 * Tira o print da tela inteira e confere: sobreposição de imagem com texto, transbordo lateral,
 * contraste (texto, ícones e contornos), algarismos de largura fixa, fonte condensada só em texto
 * grande e, nos formatos de toque, o tamanho das áreas de toque e o espaço entre elas.
 */
export async function conferirTela(page: Page, tela: string, formato: string): Promise<void> {
  await page.waitForTimeout(250);
  // Espera as entradas em curso terminarem (medir uma cor no meio de um esmaecer daria um valor errado).
  await page.evaluate(async () => {
    const running = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY);
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
  // Nome de arquivo sem acentos nem espaços.
  const arquivo = tela
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
  await page.screenshot({ path: `test-results/telas/${formato}/${arquivo}.png`, fullPage: true });
  // AUDITORIA=<nome>: só levanta as medidas de contraste de cada tela (test-results/auditoria/<nome>), sem reprovar.
  if (process.env.AUDITORIA) {
    const pasta = `test-results/auditoria/${process.env.AUDITORIA}/${formato}`;
    mkdirSync(pasta, { recursive: true });
    writeFileSync(`${pasta}/${arquivo}.json`, JSON.stringify(await medirContraste(page)));
    return;
  }
  const achados = await sobreposicoes(page);
  const toque = TELAS.find((item) => item.nome === formato)?.toque ?? true;
  const pequenos = toque ? await alvosPequenos(page) : [];
  const medidas = reprovadas(await medirContraste(page));
  const soltos = await numerosSemLarguraFixa(page);
  const condensadas = await condensadaPequena(page);
  const colados = toque ? await alvosColados(page) : [];
  if (process.env.LEVANTAR) {
    for (const a of achados) console.log(`ACHADO ${formato} | ${tela} | ${a.imagem} × "${a.texto}" (${a.area})`);
    for (const alvo of pequenos) console.log(`ACHADO ${formato} | ${tela} | toque pequeno: ${alvo}`);
    for (const par of colados) console.log(`ACHADO ${formato} | ${tela} | alvos colados: ${par}`);
    for (const m of medidas) console.log(`ACHADO ${formato} | ${tela} | contraste: ${descrever(m)}`);
    for (const n of soltos) console.log(`ACHADO ${formato} | ${tela} | número sem largura fixa: ${n}`);
    for (const c of condensadas) console.log(`ACHADO ${formato} | ${tela} | condensada pequena: ${c}`);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (sobra > 0) console.log(`ACHADO ${formato} | ${tela} | transbordo de ${sobra} px`);
    return;
  }
  expect(achados, `${tela} (${formato}): imagem sobre texto\n${achados.map((a) => `  ${a.imagem} × "${a.texto}" (${a.area})`).join('\n')}`).toEqual([]);
  const transbordo = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(transbordo, `${tela} (${formato}): a página passa ${transbordo} px da largura da tela`).toBeLessThanOrEqual(0);
  expect(pequenos, `${tela} (${formato}): áreas de toque menores que 44 px\n  ${pequenos.join('\n  ')}`).toEqual([]);
  expect(colados, `${tela} (${formato}): alvos de toque com menos de 8 px entre si\n  ${colados.join('\n  ')}`).toEqual([]);
  expect(medidas.map(descrever), `${tela} (${formato}): contraste abaixo do mínimo`).toEqual([]);
  expect(soltos, `${tela} (${formato}): números sem algarismos de largura fixa`).toEqual([]);
  expect(condensadas, `${tela} (${formato}): texto pequeno em fonte condensada`).toEqual([]);
}
