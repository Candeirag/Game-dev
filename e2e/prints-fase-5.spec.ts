/**
 * Prints da Fase 5 para o PR (docs/fase-5/prints): cartões de decisão no estilo Reigns, o desfecho
 * com a lista do que mudou, o passo de uma cadeia com quem fala e a escolha liberada por traço, na
 * tela deitada (844×390) e em pé (390×844).
 *
 * Não fazem parte da verificação: só rodam a pedido, com
 *   PRINTS=1 npx playwright test e2e/prints-fase-5.spec.ts
 *
 * Os saves (tests/fixtures/v9) têm semente fixa, então os cartões são sempre os mesmos.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SAVES, abrirSave } from './apoio';

const PASTA = 'docs/fase-5/prints';

test.skip(!process.env.PRINTS, 'só a pedido: PRINTS=1 gera os prints do PR em docs/fase-5/prints');

/** Print do que está na tela (sem rolar), depois que as entradas em curso terminam. */
async function fotografar(page: Page, nome: string): Promise<void> {
  mkdirSync(PASTA, { recursive: true });
  await page.waitForTimeout(350);
  await page.evaluate(async () => {
    const running = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY);
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: `${PASTA}/${nome}.png` });
}

/** O cartão pendente na tela: a região que contém o grupo de escolhas. */
const cartao = (page: Page): Locator =>
  page
    .getByRole('region')
    .filter({ has: page.getByRole('group', { name: 'Escolhas' }) })
    .last();
const desfecho = (page: Page): Locator => page.getByRole('region', { name: /^Desfecho:/ });

async function noAlto(alvo: Locator): Promise<void> {
  await alvo.evaluate((elemento) => elemento.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

/** Resolve os cartões até aparecer um que satisfaça `ok` (pela primeira escolha), e devolve-o. */
async function ateOCartao(page: Page, ok: (card: Locator) => Promise<boolean>): Promise<Locator> {
  for (let i = 0; i < 6; i++) {
    const card = cartao(page);
    await expect(card).toBeVisible();
    if (await ok(card)) return card;
    await card.getByRole('group', { name: 'Escolhas' }).getByRole('button').first().click();
    await desfecho(page)
      .getByRole('button', { name: /Próxima decisão|Continuar/ })
      .click();
  }
  throw new Error('O cartão esperado não apareceu.');
}

for (const formato of [
  { nome: 'deitado', width: 844, height: 390, prefixo: '' },
  { nome: 'em-pe', width: 390, height: 844, prefixo: 'em-pe-' },
] as const) {
  test.describe(`tela ${formato.nome} (${formato.width}×${formato.height})`, () => {
    test.use({ viewport: { width: formato.width, height: formato.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    test('cartão com escolha liberada por traço e o desfecho com o que mudou', async ({ page }) => {
      await abrirSave(page, SAVES.escolhaDeTraco);
      const card = await ateOCartao(
        page,
        async (c) =>
          (await c.getByText(/Liberada pel/).count()) > 0 ||
          (await c.locator('text=/Esquentado|Carisma|Piloto limpo|Corpo de ferro|Frieza|Inteligência|Gênio na chuva/').count()) > 0,
      );
      await noAlto(card);
      await fotografar(page, `${formato.prefixo}01-cartao-com-escolha-de-traco`);
      await card.getByRole('group', { name: 'Escolhas' }).getByRole('button').first().click();
      await expect(desfecho(page)).toBeVisible();
      await noAlto(desfecho(page));
      await fotografar(page, `${formato.prefixo}02-desfecho-com-o-que-mudou`);
    });

    test('passo de cadeia: o rival do kart de volta nas fórmulas, com quem fala e a memória', async ({ page }) => {
      await abrirSave(page, SAVES.historiaRival);
      const card = await ateOCartao(page, async (c) => (await c.getByText('Velho conhecido').count()) > 0);
      await noAlto(card);
      await fotografar(page, `${formato.prefixo}03-passo-de-cadeia-com-quem-fala`);
      await card.getByRole('group', { name: 'Escolhas' }).getByRole('button').first().click();
      await expect(desfecho(page)).toContainText('A história continua');
      await noAlto(desfecho(page));
      await fotografar(page, `${formato.prefixo}04-desfecho-da-cadeia`);
    });
  });
}
