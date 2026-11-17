/**
 * Fluxo principal, do começo ao fim, como um jogador faria no celular deitado: criar a carreira,
 * disputar treino, classificação e corrida (mudando o ritmo pela barra fixa), concluir a etapa
 * e recarregar a página para abrir o save automático.
 */
import { expect, test } from '@playwright/test';
import { NOMES_ANTIGOS, SAVES, abrirSave, irPara, vigiarErros } from './apoio';

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test('criar carreira, disputar uma etapa inteira e recarregar o save', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  // Etapa 1: o nascimento sorteado. Refazer o sorteio gasta um dos três; recarregar a página não devolve.
  await expect(page.getByRole('heading', { name: 'Nascimento', level: 1 })).toBeVisible();
  const sorteio = page.getByRole('button', { name: /^Sortear de novo/ });
  await expect(sorteio).toHaveAccessibleName('Sortear de novo: 3 sorteios restantes');
  await sorteio.click();
  await expect(sorteio).toHaveAccessibleName('Sortear de novo: 2 sorteios restantes');
  const cidade = await page.getByRole('banner').first().textContent();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Sortear de novo/ })).toHaveAccessibleName('Sortear de novo: 2 sorteios restantes');
  await expect(page.getByRole('banner').first()).toHaveText(cidade ?? '');
  await page.getByRole('button', { name: 'Continuar' }).click();
  // Etapa 2: o piloto.
  await page.getByLabel(/^Nome/).first().fill('Rui');
  await page.getByLabel(/Sobrenome/).fill('Prado');
  await page
    .getByRole('button', { name: /Começar|Iniciar|Assinar/ })
    .last()
    .click();
  await page.waitForURL(/#\/dashboard/);

  // O Painel mostra a primeira etapa e o botão de avançar leva ao fim de semana.
  const topo = page.getByRole('banner').first();
  await expect(topo).toContainText('Etapa 1 de 10');
  // O caixa inicial são as economias da família, que o nascimento sorteou.
  await expect(topo).toContainText(/R\$\s\d{1,2}\.\d{3}/);
  await page.getByRole('button', { name: 'Ir para o fim de semana' }).click();
  await page.waitForURL(/#\/weekend/);

  await page.locator('button:has-text("Iniciar"), button:has-text("Começar")').first().click();
  await page.getByRole('button', { name: 'Disputar treino livre' }).click();
  await page.getByRole('button', { name: 'Disputar classificação' }).click();
  await expect(page.getByText('Grid de largada')).toBeVisible();
  await page.getByRole('button', { name: 'Ir para a largada' }).click();

  // Corrida: a barra fixa fica na tela, com o ritmo sempre à mão.
  const barra = page.getByRole('region', { name: 'Comandos da corrida' });
  await expect(barra).toBeVisible();
  await barra.getByRole('button', { name: 'Largar' }).click();
  await barra.getByRole('button', { name: '8×' }).click();
  await barra.getByRole('button', { name: 'Agressivo' }).click();
  await expect(barra.getByRole('button', { name: 'Agressivo' })).toHaveAttribute('aria-pressed', 'true');
  await expect(barra).toContainText(/Volta [2-9]\/22/, { timeout: 30_000 });
  const caixaDaBarra = await barra.boundingBox();
  expect(caixaDaBarra && caixaDaBarra.y + caixaDaBarra.height).toBeLessThanOrEqual(390);
  await barra.getByRole('button', { name: 'Conservador' }).click();

  // Termina a corrida e conclui a etapa.
  await page.getByRole('button', { name: 'Simular até o fim' }).click();
  await expect(barra).toHaveCount(0);
  await expect(page.getByText(/Você terminou em \d+º|Você abandonou/)).toBeVisible();
  await page.getByRole('button', { name: 'Concluir etapa e salvar' }).click();
  await expect(topo).toContainText('Etapa 2 de 10');
  await expect(page.getByRole('img', { name: /^Salvo em/ })).toBeVisible();

  // Recarrega: o save automático traz a carreira de volta, na segunda etapa.
  await page.reload();
  await page.getByRole('button', { name: /^Continuar:/ }).click();
  await page.waitForURL(/#\/dashboard/);
  await expect(page.getByRole('banner').first()).toContainText('Etapa 2 de 10');
  await irPara(page, 'Calendário');
  await expect(page.getByText('1 de 10 etapas disputadas')).toBeVisible();
  expect(erros).toEqual([]);
});

test('abre um save gravado antes da reformulação visual e segue para a corrida', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirSave(page, SAVES.antesDaReformulacao);
  await expect(page.getByRole('banner').first()).toContainText('Etapa 4 de 10');
  await irPara(page, 'Fim de semana');
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  await expect(page.getByRole('region', { name: 'Comandos da corrida' })).toBeVisible();
  expect(erros).toEqual([]);
});

test('abre um save da versão 3: a carreira continua inteira e com os nomes próprios das categorias', async ({ page }) => {
  const erros = vigiarErros(page);
  await abrirSave(page, SAVES.antigoComAcademia);
  // Sétima temporada, no primeiro degrau dos monopostos: mesma etapa e mesma equipe, com o nome novo da categoria.
  const topo = page.getByRole('banner').first();
  await expect(topo).toContainText('F. Júnior 2033');
  await expect(topo).toContainText('Etapa 5 de 10');
  const corpo = page.locator('body');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);

  // A academia, que levava o nome antigo de uma equipe, continua ligada ao piloto.
  await irPara(page, 'Equipe');
  await page.getByRole('main').getByRole('tab', { name: 'Contrato', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Academia Stallion Autosport' })).toBeVisible();
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);

  // Requisitos do próximo degrau: o que o piloto tem e o mínimo, e o nome com a contração certa.
  await irPara(page, 'Carreira');
  await expect(page.getByRole('heading', { name: 'Requisitos para a F. Sprint' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(/Idade: \d+ anos na próxima temporada \(mínimo 16\)/);
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);
  await irPara(page, 'Histórico');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);

  // O save automático já foi regravado na versão nova: recarregar traz a mesma carreira.
  await page.reload();
  const continuar = page.getByRole('button', { name: /^Continuar:/ });
  await expect(continuar).toContainText('F. Júnior 2033');
  await continuar.click();
  await page.waitForURL(/#\/dashboard/);
  await expect(page.getByRole('banner').first()).toContainText('Etapa 5 de 10');
  expect(erros).toEqual([]);
});

test('abre saves da versão 3 no topo da escada e no modo dirigente, sem nomes antigos', async ({ page }) => {
  const erros = vigiarErros(page);
  const corpo = page.locator('body');
  await abrirSave(page, SAVES.antigoNoTopo);
  await expect(page.getByRole('banner').first()).toContainText('GP Mundial 2038');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);
  await irPara(page, 'Carreira');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);
  await page.getByRole('main').getByRole('tab', { name: 'Escada', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('Você chegou ao Grand Prix Mundial.');
  await irPara(page, 'Classificação');
  await page.getByRole('main').getByRole('tab', { name: 'Equipes', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('Azure Motorsport');
  await expect(page.getByRole('main')).toContainText('Stallion Autosport');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);

  await abrirSave(page, SAVES.antigoDirigente);
  await expect(page.getByRole('banner').first()).toContainText('F. Elite 2043');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);
  await irPara(page, 'Gestão');
  await expect(corpo).not.toContainText(NOMES_ANTIGOS);
  expect(erros).toEqual([]);
});
