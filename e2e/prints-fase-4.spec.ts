/**
 * Prints da Fase 4 para o PR (docs/fase-4/prints): lances decisivos, desfechos, painel de pneus e
 * rádio do engenheiro, na tela deitada (844×390) e os três principais em pé (390×844).
 *
 * Não fazem parte da verificação: só rodam a pedido, com
 *   PRINTS=1 npx playwright test e2e/prints-fase-4.spec.ts
 *
 * Os saves têm semente fixa e as respostas aqui são sempre as mesmas, então os lances e os
 * desfechos se repetem a cada execução: no kart, segurar a posição na largada dá certo, arriscar
 * por dentro dá errado e há um ataque na volta 7; no monoposto, o engenheiro avisa do carro que
 * vem chegando perto da volta 12 e o lance da parada abre na volta 31. Se o equilíbrio dos lances
 * mudar, um destes pode deixar de aparecer: o teste falha dizendo qual.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SAVES, abrirSave, correrAteOLance, desfechoDoLance, escolherOpcao, irPara, responderLance, responderLances, tarjaDoLance } from './apoio';

const PASTA = 'docs/fase-4/prints';

test.skip(!process.env.PRINTS, 'só a pedido: PRINTS=1 gera os prints do PR em docs/fase-4/prints');

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

/** Rola a página até o elemento ficar no alto da área visível. */
async function noAlto(alvo: Locator): Promise<void> {
  await alvo.evaluate((elemento) => elemento.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

/** Rola só a gaveta (o contêiner com rolagem em volta do elemento), sem mexer na página, até o fim do elemento aparecer. */
async function ateOFimNaGaveta(alvo: Locator): Promise<void> {
  await alvo.evaluate((elemento) => {
    for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(pai).overflowY) && pai.scrollHeight > pai.clientHeight) {
        pai.scrollTop += elemento.getBoundingClientRect().bottom - pai.getBoundingClientRect().bottom + 8;
        return;
      }
    }
  });
}

async function kartNoGrid(page: Page): Promise<void> {
  await abrirSave(page, SAVES.naLargada);
  await irPara(page, 'Fim de semana');
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
}

async function monopostoNoGrid(page: Page): Promise<void> {
  await abrirSave(page, SAVES.formula);
  await irPara(page, 'Fim de semana');
  await page.getByRole('button', { name: 'Iniciar fim de semana' }).click();
  await page.getByRole('button', { name: 'Disputar treino livre' }).click();
  await page.getByRole('button', { name: 'Disputar classificação' }).click();
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
}

test.describe('tela deitada (844×390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('kart: largada, opção com as chances, desfecho que deu certo, ataque, cronometragem e resultado', async ({ page }) => {
    test.setTimeout(240_000);
    await kartNoGrid(page);
    await fotografar(page, '01-lance-largada');
    await escolherOpcao(page, /^Segurar a posição/);
    await fotografar(page, '02-lance-opcao-com-as-chances');
    await tarjaDoLance(page).getByRole('button', { name: 'Confirmar' }).click();
    const desfecho = desfechoDoLance(page);
    await expect(desfecho).toContainText('Deu certo', { timeout: 20_000 });
    await fotografar(page, '03-desfecho-deu-certo');
    await expect(desfecho).toHaveCount(0);
    // O ataque do meio da prova, com a opção arriscada marcada: o detalhe mostra o que pesa na chance.
    await page.getByRole('region', { name: 'Comandos da corrida' }).getByRole('button', { name: '8×' }).click();
    await correrAteOLance(page, 'Ataque');
    await escolherOpcao(page, /^Mergulhar na freada/);
    await fotografar(page, '05-lance-de-ataque');
    // O mesmo lance na cronometragem: a tabela encolhe para caber acima da tarja.
    await page.getByRole('button', { name: 'Modo cronometragem' }).click();
    await expect(tarjaDoLance(page, 'Ataque')).toBeVisible();
    await escolherOpcao(page, /^Mergulhar na freada/);
    await fotografar(page, '09-cronometragem-com-lance');
    // Até o fim respondendo a tudo: o resultado lista cada lance, com a chance e o que aconteceu.
    await tarjaDoLance(page).getByRole('button', { name: 'Confirmar' }).click();
    await responderLances(page, 'ousada');
    await page.getByRole('region', { name: 'Comandos da corrida' }).getByRole('button', { name: '8×' }).click();
    await expect(page.getByRole('button', { name: 'Concluir etapa e salvar' })).toBeVisible({ timeout: 60_000 });
    await noAlto(page.getByText('Lances da corrida'));
    await fotografar(page, '10-resultado-com-os-lances');
  });

  test('kart: desfecho que deu errado', async ({ page }) => {
    await kartNoGrid(page);
    await responderLance(page, /^Arriscar por dentro/);
    await expect(desfechoDoLance(page)).toContainText('Deu errado', { timeout: 20_000 });
    await fotografar(page, '04-desfecho-deu-errado');
  });

  test('monoposto: rádio do engenheiro, painel de pneus e lance de parada', async ({ page }) => {
    test.setTimeout(240_000);
    await monopostoNoGrid(page);
    await responderLance(page, /^Segurar a posição/);
    const barra = page.getByRole('region', { name: 'Comandos da corrida' });
    // Depressa até perto da volta 8; dali em diante devagar, para o aviso do engenheiro ficar na tela.
    await barra.getByRole('button', { name: '8×' }).click();
    await expect(barra).toContainText(/Volta ([7-9]|1\d)\/44/, { timeout: 60_000 });
    await barra.getByRole('button', { name: '2×' }).click();
    const radio = page.locator('[data-slot="tarja-inferior"]').getByRole('status').filter({ hasText: 'Rádio · engenheiro' });
    await expect(radio).toBeVisible({ timeout: 60_000 });
    await fotografar(page, '07-radio-do-engenheiro');
    await expect(radio).toHaveCount(0);
    // O painel de pneus completo, na gaveta "Piloto", com o pneu já gasto: desgaste, a marca do penhasco,
    // o gráfico das voltas (a linha sobe quando o pneu cai) e a janela ideal de parada.
    await barra.getByRole('button', { name: '8×' }).click();
    await expect(barra).toContainText(/Volta 2[3-6]\/44/, { timeout: 60_000 });
    await barra.getByRole('button', { name: 'Pausar' }).click();
    await page.getByRole('group', { name: 'Painéis da corrida' }).getByRole('button', { name: 'Piloto' }).click();
    const pneus = page.getByRole('region', { name: 'Pneus' });
    await expect(pneus).toContainText(/Janela ideal: voltas? \d+/);
    await ateOFimNaGaveta(pneus);
    await fotografar(page, '06-painel-de-pneus');
    await page.getByRole('button', { name: 'Fechar painel' }).click();
    // O lance da parada: o pneu que está no carro ao lado da pergunta e a escolha do que entra.
    await barra.getByRole('button', { name: 'Continuar' }).click();
    await correrAteOLance(page, 'Parada');
    await escolherOpcao(page, /^Parar agora/);
    await fotografar(page, '08-lance-de-parada-no-monoposto');
  });
});

test.describe('em pé (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('kart: largada, opção com as chances e desfecho', async ({ page }) => {
    await kartNoGrid(page);
    await fotografar(page, '11-em-pe-lance-largada');
    await escolherOpcao(page, /^Segurar a posição/);
    await fotografar(page, '12-em-pe-lance-opcao-com-as-chances');
    await tarjaDoLance(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(desfechoDoLance(page)).toContainText('Deu certo', { timeout: 20_000 });
    await fotografar(page, '13-em-pe-desfecho-deu-certo');
    // Em pé, o painel de pneus completo fica na aba "Piloto", abaixo da pista (aqui, depois de algumas voltas).
    const barra = page.getByRole('region', { name: 'Comandos da corrida' });
    await barra.getByRole('button', { name: '8×' }).click();
    await expect(barra).toContainText(/Volta [45]\/19/, { timeout: 60_000 });
    await barra.getByRole('button', { name: 'Pausar' }).click();
    await page.getByRole('tab', { name: 'Piloto' }).click();
    const pneus = page.getByRole('region', { name: 'Pneus' });
    await pneus.scrollIntoViewIfNeeded();
    await fotografar(page, '14-em-pe-painel-de-pneus');
  });
});
