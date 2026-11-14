/**
 * Movimento da interface: entradas e saídas curtas (150 a 300 ms), interrompíveis, e nenhuma
 * transição para quem pede menos movimento ao sistema.
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

test.describe('com "reduzir movimento" ligado no sistema', () => {
  test.use({ reducedMotion: 'reduce' });

  test('não há transições nem rolagem suave', async ({ page }) => {
    await abrirSave(page, SAVES.naLargada);
    await page.getByRole('button', { name: 'Mais', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Mais telas' })).toBeVisible();
    expect(await maiorDuracao(page)).toBeLessThan(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Mais telas' })).toHaveCount(0, { timeout: 500 });
  });
});
