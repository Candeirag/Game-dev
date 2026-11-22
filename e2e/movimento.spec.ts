/**
 * Movimento da interface: entradas e saídas curtas (150 a 300 ms), interrompíveis; nada piscando
 * a 3 Hz ou mais; e, para quem pede menos movimento (ao sistema ou em Ajustes), só um esmaecer
 * curto no lugar de deslizamento e zoom, com a câmera da corrida parada. Vale também para a tarja
 * do lance decisivo e para a faixa do desfecho (Fase 4).
 */
import { expect, test, type Page } from '@playwright/test';
import { SAVES, abrirSave, desfechoDoLance, responderLance, tarjaDoLance } from './apoio';

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

/** Maior duração de transição ou animação entre os elementos da página, em ms (indicadores de progresso em laço ficam de fora). */
async function maiorDuracao(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ms = (value: string) => Math.max(0, ...value.split(',').map((part) => (part.trim().endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000)));
    let longest = 0;
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      longest = Math.max(longest, ms(style.transitionDuration));
      if (style.animationName !== 'none' && style.animationIterationCount !== 'infinite') longest = Math.max(longest, ms(style.animationDuration));
    }
    return longest;
  });
}

/** Seletores da tarja do lance decisivo e da faixa do desfecho (a tarja inferior da transmissão). */
const TARJA_DO_LANCE = '[role="dialog"][aria-label^="Lance decisivo"]';
const FAIXA_DO_DESFECHO = '[data-slot="tarja-inferior"] [role="status"]';

interface Transicao {
  propriedade: string;
  /** Duração declarada para o elemento, em ms. */
  duracao: number;
}

/**
 * Passa a anotar toda transição que começar na página daqui em diante (o jogo é uma página só, então
 * a anotação continua valendo ao trocar de tela). `transicoesDe` devolve as de um elemento.
 */
async function anotarTransicoes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const anotadas: { alvo: Element; propriedade: string; duracao: number }[] = [];
    (window as unknown as { transicoesAnotadas: typeof anotadas }).transicoesAnotadas = anotadas;
    document.addEventListener(
      'transitionrun',
      (event) => {
        if (!(event.target instanceof Element)) return;
        const duracoes = getComputedStyle(event.target)
          .transitionDuration.split(',')
          .map((parte) => (parte.trim().endsWith('ms') ? parseFloat(parte) : parseFloat(parte) * 1000));
        anotadas.push({ alvo: event.target, propriedade: event.propertyName, duracao: Math.max(0, ...duracoes) });
      },
      true,
    );
  });
}

/** As transições anotadas do elemento que casa com o seletor (o próprio elemento, não o que está dentro dele). */
async function transicoesDe(page: Page, seletor: string): Promise<Transicao[]> {
  return page.evaluate((alvo) => {
    const anotadas = (window as unknown as { transicoesAnotadas?: { alvo: Element; propriedade: string; duracao: number }[] }).transicoesAnotadas ?? [];
    return anotadas.filter((item) => item.alvo.matches(alvo)).map(({ propriedade, duracao }) => ({ propriedade, duracao }));
  }, seletor);
}

/** Propriedades que mudam de lugar, de tamanho ou de giro: o que "desliza" e o que "dá zoom". */
const MOVIMENTO = /^(all|translate|transform|scale|rotate|zoom|width|height|top|left|right|bottom|inset.*|margin.*|padding.*)$/;

test('o "Mais" entra e sai em até 300 ms e pode ser interrompido', async ({ page }) => {
  await abrirSave(page, SAVES.naLargada);
  const mais = page.getByRole('button', { name: 'Mais', exact: true });
  const folha = page.getByRole('dialog', { name: 'Mais telas' });
  await mais.click();
  await expect(folha).toBeVisible();
  const duracao = await maiorDuracao(page);
  expect(duracao).toBeGreaterThanOrEqual(150);
  expect(duracao).toBeLessThanOrEqual(300);

  // Fecha e reabre em seguida, sem esperar a saída terminar: a folha volta, não fica presa.
  await page.keyboard.press('Escape');
  await mais.click();
  await expect(folha.getByRole('link', { name: 'Vida' })).toBeVisible();

  // Fechada de vez, sai da página logo depois da transição.
  await page.keyboard.press('Escape');
  await expect(folha).toHaveCount(0, { timeout: 1000 });
});

test('nenhuma transição das telas passa de 300 ms', async ({ page }) => {
  await abrirSave(page, SAVES.naLargada);
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: /^Fim de semana/ })
    .click();
  await anotarTransicoes(page);
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  // No grid, o lance da largada: a tarja sobe do rodapé esmaecendo, numa transição de 150 a 300 ms.
  await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
  const entrada = await transicoesDe(page, TARJA_DO_LANCE);
  expect(entrada.map((t) => t.propriedade).sort()).toEqual(['opacity', 'translate']);
  for (const transicao of entrada) {
    expect(transicao.duracao).toBeGreaterThanOrEqual(150);
    expect(transicao.duracao).toBeLessThanOrEqual(300);
  }
  // Uma opção marcada (a tarja cresce com o detalhe) e a resposta: nada novo passa do limite.
  await responderLance(page, 'segura');
  await expect(page.getByRole('region', { name: 'Comandos da corrida' })).toBeVisible();
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
  // O desfecho entra na tarja inferior do mesmo jeito, e a corrida segue.
  await expect(desfechoDoLance(page)).toBeVisible({ timeout: 20_000 });
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
  const desfecho = await transicoesDe(page, FAIXA_DO_DESFECHO);
  expect(desfecho.map((t) => t.propriedade)).toContain('opacity');
  for (const transicao of desfecho) expect(transicao.duracao).toBeLessThanOrEqual(300);
  await expect(desfechoDoLance(page)).toHaveCount(0);
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
});

/** Propriedades que se movem (posição, tamanho, giro) em transição em algum elemento da página. */
async function transicoesDeMovimento(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const moving = /(^|,\s*)(all|translate|transform|scale|rotate|width|height|top|left|right|bottom|margin|padding)/;
    const found = new Set<string>();
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      const longest = Math.max(
        0,
        ...style.transitionDuration.split(',').map((part) => (part.trim().endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000)),
      );
      if (longest > 1 && moving.test(style.transitionProperty)) found.add(style.transitionProperty);
    }
    return [...found];
  });
}

/** Animações em laço com período menor que um terço de segundo: piscariam três vezes por segundo ou mais. */
async function piscando(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return timing?.iterations === Number.POSITIVE_INFINITY && Number(timing.duration) < 334;
      })
      .map((animation) => (animation as CSSAnimation).animationName ?? 'animação'),
  );
}

test('nada pisca três vezes por segundo ou mais', async ({ page }) => {
  await abrirSave(page, SAVES.naLargada);
  expect(await piscando(page)).toEqual([]);
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: /^Fim de semana/ })
    .click();
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  // Com o lance da largada aberto, nas luzes da largada e com o desfecho na tela.
  await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
  expect(await piscando(page)).toEqual([]);
  await responderLance(page, 'segura');
  await page.waitForTimeout(1500);
  expect(await piscando(page)).toEqual([]);
  await expect(desfechoDoLance(page)).toBeVisible({ timeout: 20_000 });
  expect(await piscando(page)).toEqual([]);
});

/** Opacidade de cada item da ficha do nascimento (a revelação em sequência). */
async function opacidadesDaFicha(page: Page): Promise<number[]> {
  return page.evaluate(() => [...document.querySelectorAll('[data-shown]')].map((element) => Number(getComputedStyle(element).opacity)));
}

test('o nascimento se revela item por item, cada um em até 300 ms', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  await expect(page.getByRole('heading', { name: 'Nascimento', level: 1 })).toBeVisible();
  // Logo depois de abrir, a ficha ainda está se preenchendo: os últimos itens não apareceram.
  const logo = await opacidadesDaFicha(page);
  expect(logo.length).toBeGreaterThan(10);
  expect(logo.some((value) => value < 1)).toBe(true);
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(300);
  // Em pouco tempo, tudo está à vista.
  await expect.poll(async () => (await opacidadesDaFicha(page)).every((value) => value === 1), { timeout: 4000 }).toBe(true);
});

/** O que vale com menos movimento, venha o pedido do sistema ou do ajuste do jogo. */
async function conferirMenosMovimento(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mais telas' })).toBeVisible();
  // Nada desliza, cresce ou gira: só a opacidade e as cores ainda têm transição, e curta.
  expect(await transicoesDeMovimento(page)).toEqual([]);
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(150);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--enter-shift').trim())).toBe('0px');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Mais telas' })).toHaveCount(0, { timeout: 1000 });
  // Na corrida, a câmera fica parada no circuito inteiro: acompanhar um carro é deslizar e dar zoom.
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: /^Fim de semana/ })
    .click();
  await anotarTransicoes(page);
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(page.getByRole('button', { name: 'Câmera geral' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Meu piloto' })).toHaveAttribute('aria-pressed', 'false');
  expect(await transicoesDeMovimento(page)).toEqual([]);
  // O lance da largada já está aberto no grid: a tarja não sobe do rodapé, só esmaece, e depressa.
  const tarja = tarjaDoLance(page, 'Largada');
  await expect(tarja).toBeVisible();
  await conferirSoEsmaece(page, TARJA_DO_LANCE);
  // Marcar uma opção faz a tarja crescer (entra o detalhe): de uma vez, sem transição de tamanho.
  await responderLance(page, 'segura');
  expect(await transicoesDe(page, TARJA_DO_LANCE).then((lista) => lista.filter((t) => MOVIMENTO.test(t.propriedade)))).toEqual([]);
  // O desfecho entra na tarja inferior do mesmo jeito, e a câmera continua parada no circuito inteiro.
  await expect(desfechoDoLance(page)).toBeVisible({ timeout: 20_000 });
  await conferirSoEsmaece(page, FAIXA_DO_DESFECHO);
  await expect(page.getByRole('button', { name: 'Câmera geral' })).toHaveAttribute('aria-pressed', 'true');
  expect(await transicoesDeMovimento(page)).toEqual([]);
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(150);
}

/**
 * Com menos movimento, o elemento que acabou de entrar só esmaeceu: houve transição de opacidade,
 * curta, nenhuma de posição, tamanho ou giro, e ele está parado no lugar (sem deslocamento nem escala).
 */
async function conferirSoEsmaece(page: Page, seletor: string): Promise<void> {
  const transicoes = await transicoesDe(page, seletor);
  expect(
    transicoes.map((t) => t.propriedade),
    `${seletor}: tem de esmaecer ao entrar`,
  ).toContain('opacity');
  expect(
    transicoes.filter((t) => MOVIMENTO.test(t.propriedade)),
    `${seletor}: nada desliza nem dá zoom`,
  ).toEqual([]);
  for (const transicao of transicoes) expect(transicao.duracao).toBeLessThanOrEqual(300);
  const parado = await page.locator(seletor).evaluate((elemento) => {
    const estilo = getComputedStyle(elemento);
    return { translate: estilo.translate, scale: estilo.scale, rotate: estilo.rotate, transform: estilo.transform };
  });
  expect(parado).toEqual({ translate: 'none', scale: 'none', rotate: 'none', transform: 'none' });
  expect(await maiorDuracao(page)).toBeLessThanOrEqual(150);
}

test.describe('com "reduzir movimento" ligado no sistema', () => {
  test.use({ reducedMotion: 'reduce' });

  test('deslizamento e zoom viram um esmaecer curto, e a câmera da corrida fica parada', async ({ page }) => {
    await abrirSave(page, SAVES.naLargada);
    await conferirMenosMovimento(page);
  });

  test('o nascimento aparece inteiro de uma vez, sem animação', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nova carreira' }).click();
    await expect(page.getByRole('heading', { name: 'Nascimento', level: 1 })).toBeVisible();
    const logo = await opacidadesDaFicha(page);
    expect(logo.length).toBeGreaterThan(10);
    expect(logo.every((value) => value === 1)).toBe(true);
    expect(await transicoesDeMovimento(page)).toEqual([]);
    // Um novo sorteio também aparece de uma vez.
    await page.getByRole('button', { name: /^Sortear de novo/ }).click();
    expect((await opacidadesDaFicha(page)).every((value) => value === 1)).toBe(true);
  });

  test('a tela Ajustes mostra que o aparelho já pede menos movimento', async ({ page }) => {
    await page.goto('/#/ajustes');
    const interruptor = page.getByRole('switch', { name: /Menos movimento/ });
    await expect(interruptor).toBeChecked();
    await expect(interruptor).toBeDisabled();
    await expect(page.getByRole('main')).toContainText('O aparelho já pede menos movimento');
  });
});

test.describe('com "menos movimento" ligado em Ajustes', () => {
  test('vale o mesmo que o pedido do sistema, e a corrida abre com a câmera geral', async ({ page }) => {
    await abrirSave(page, SAVES.naLargada);
    // Sem o ajuste, a corrida acompanha o carro do jogador e as telas deslizam.
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'reduce');
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Mais telas' })
      .getByRole('link', { name: /^Ajustes/ })
      .click();
    await page.getByRole('switch', { name: /Menos movimento/ }).check();
    await conferirMenosMovimento(page);
  });
});
