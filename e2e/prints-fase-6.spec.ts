/**
 * Prints da Fase 6 para o PR (docs/fase-6/prints): a árvore da família e o placar da dinastia, a
 * ficha do herdeiro, os filhos com os traços ocultos e o teste no kart, a sucessão com vários filhos
 * e as vagas, o ano de transição (logo depois de parar, no fechamento e durante o ano), o dirigente
 * com filhos e parentes no mercado e a proposta da equipe da família, na tela deitada (844×390) e em
 * pé (390×844).
 *
 * Não fazem parte da verificação: só rodam a pedido, com
 *   PRINTS=1 npx playwright test e2e/prints-fase-6.spec.ts --trace off
 *
 * Os saves (tests/fixtures/v10) têm semente fixa, então as telas são sempre as mesmas.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SAVES, abrirSave, irPara } from './apoio';

const PASTA = 'docs/fase-6/prints';

test.skip(!process.env.PRINTS, 'só a pedido: PRINTS=1 gera os prints do PR em docs/fase-6/prints');

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

/** Rola até o elemento ficar logo abaixo do cabeçalho fixo. */
async function noAlto(alvo: Locator): Promise<void> {
  await alvo.evaluate((elemento) => {
    const header = [...document.querySelectorAll('header')].find((h) => getComputedStyle(h).position === 'sticky');
    const margem = (header?.getBoundingClientRect().bottom ?? 0) + 8;
    window.scrollBy({ top: elemento.getBoundingClientRect().top - margem, behavior: 'instant' });
  });
}

/** Abre o save e fecha o aviso de importação, que cobriria a tela no print. */
async function abrir(page: Page, arquivo: string): Promise<void> {
  await abrirSave(page, arquivo);
  const aviso = page.getByRole('button', { name: 'Fechar aviso' });
  await aviso.waitFor({ timeout: 3_000 }).catch(() => undefined);
  if (await aviso.count()) await aviso.click();
}

for (const formato of [
  { nome: 'deitado', width: 844, height: 390, prefixo: '' },
  { nome: 'em-pe', width: 390, height: 844, prefixo: 'em-pe-' },
] as const) {
  test.describe(`tela ${formato.nome} (${formato.width}×${formato.height})`, () => {
    test.use({ viewport: { width: formato.width, height: formato.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const nome = (n: string) => `${formato.prefixo}${n}`;

    test('dinastia: árvore, placar e a ficha do herdeiro', async ({ page }) => {
      await abrir(page, SAVES.segundaGeracao);
      const principal = page.getByRole('main');
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Dinastia/ }).click();
      await expect(page.getByRole('heading', { name: 'Dinastia', level: 1 })).toBeVisible();
      await fotografar(page, nome('01-dinastia-arvore'));
      await noAlto(principal.getByText('Seguiram outro caminho').first());
      await fotografar(page, nome('02-dinastia-arvore-parentes'));
      await principal.getByRole('tab', { name: 'Placar', exact: true }).click();
      await expect(principal).toContainText('Placar da dinastia');
      await fotografar(page, nome('03-dinastia-placar'));
      await irPara(page, 'Piloto');
      await principal.getByRole('tab', { name: 'Nascimento', exact: true }).click();
      await expect(principal).toContainText('Talentos e defeitos');
      await fotografar(page, nome('04-herdeiro-nascimento'));
    });

    test('filhos: o teste no kart e os traços ocultos', async ({ page }) => {
      await abrir(page, SAVES.filhosNoTesteDoKart);
      const evento = page.getByRole('region', { name: 'Dia de avaliação no kartódromo' });
      await expect(evento).toBeVisible();
      await noAlto(evento);
      await fotografar(page, nome('05-teste-no-kart-cartao'));
      const principal = page.getByRole('main');
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Família/ }).click();
      await principal.getByRole('tab', { name: 'Filhos', exact: true }).click();
      const filhos = principal.getByRole('list').first();
      await filhos.getByRole('button', { name: /^Maya/ }).click();
      await expect(principal).toContainText(/\d\.\d{3} s do tempo de referência/);
      await fotografar(page, nome('06-filho-com-teste-no-kart'));
      await noAlto(principal.getByText('Talentos e defeitos de nascença').first());
      await fotografar(page, nome('07-filho-tracos-de-nascenca'));
    });

    test('sucessão com vários filhos e as vagas', async ({ page }) => {
      await abrir(page, SAVES.sucessaoComVariosFilhos);
      await expect(page.getByRole('heading', { name: 'Quem assume a família?', level: 1 })).toBeVisible();
      await fotografar(page, nome('08-sucessao-herdeiros'));
      const lista = page.getByRole('main').getByRole('list').first();
      await lista.getByRole('button', { name: /^Nico Teste/ }).click();
      await fotografar(page, nome('09-sucessao-o-que-se-sabe'));
      const frente = page.getByRole('button', { name: /^Equipe da frente/ });
      await frente.click();
      await noAlto(frente);
      await fotografar(page, nome('10-sucessao-vagas'));
    });

    test('ano de transição: ao parar, no fechamento e durante o ano', async ({ page }) => {
      await abrir(page, SAVES.aposentadoriaNoMeioDoAno);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      await expect(principal).toContainText('Ano de transição');
      await page.getByRole('button', { name: /^Comentários na TV/ }).click();
      await fotografar(page, nome('11-transicao-ao-parar'));
      await abrir(page, SAVES.fechamentoComAnoDeTransicao);
      await irPara(page, 'Carreira');
      await expect(principal).toContainText('pela próxima temporada inteira');
      await page.getByRole('button', { name: /^Imagem de uma marca/ }).click();
      await fotografar(page, nome('12-transicao-fechamento'));
      await abrir(page, SAVES.anoDeTransicao);
      await expect(principal).toContainText('Cachê recebido');
      await noAlto(principal.getByText('Cachê recebido').first());
      await fotografar(page, nome('13-transicao-painel'));
      const cartao = page.getByRole('region', { name: 'Lote com defeito' });
      await noAlto(cartao);
      await fotografar(page, nome('14-transicao-evento'));
    });

    test('dirigente com filhos, parentes no mercado e a equipe da família', async ({ page }) => {
      await abrir(page, SAVES.dirigenteComFilhoPiloto);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      await principal.getByRole('tab', { name: 'Pilotos', exact: true }).click();
      await expect(principal).toContainText(/a imprensa vai falar em favorecimento/);
      await noAlto(principal.getByText(/a imprensa vai falar em favorecimento/).first());
      await fotografar(page, nome('15-dirigente-filho-favorecimento'));
      await abrir(page, SAVES.segundaGeracaoDonaDeEquipe);
      await irPara(page, 'Gestão');
      await principal.getByRole('tab', { name: 'Equipe técnica', exact: true }).click();
      await principal.getByRole('button', { name: /^Engenheiro-chefe/ }).click();
      await expect(principal).toContainText('salário de família');
      await noAlto(principal.getByText('salário de família').first());
      await fotografar(page, nome('16-gestao-parente-no-mercado'));
      await abrir(page, SAVES.herdeiroComEquipeDaFamilia);
      await irPara(page, 'Carreira');
      await principal.getByRole('button', { name: /^Castilla Racing.*Equipe da família/ }).click();
      await expect(principal).toContainText('Equipe da família: a imprensa vai falar em favorecimento');
      await fotografar(page, nome('17-proposta-equipe-da-familia'));
    });
  });
}
