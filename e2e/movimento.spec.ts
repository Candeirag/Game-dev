/**
 * Movimento da interface: entradas e saídas curtas (150 a 300 ms), interrompíveis; nada piscando
 * a 3 Hz ou mais; e, para quem pede menos movimento (ao sistema ou em Ajustes), só um esmaecer
 * curto no lugar de deslizamento e zoom, com a câmera da corrida parada.
 */
import { expect, test, type Page } from '@playwright/test';
import { SAVES, abrirSave } from './apoio';

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
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(page.getByRole('region', { name: 'Comandos da corrida' })).toBeVisible();
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
  await page.getByRole('region', { name: 'Comandos da corrida' }).getByRole('button', { name: 'Largar' }).click();
  await page.waitForTimeout(1500);
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
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(page.getByRole('button', { name: 'Câmera geral' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Meu piloto' })).toHaveAttribute('aria-pressed', 'false');
  expect(await transicoesDeMovimento(page)).toEqual([]);
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
