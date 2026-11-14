/**
 * Fluxo principal, do começo ao fim, como um jogador faria no celular deitado: criar a carreira,
 * disputar treino, classificação e corrida (mudando o ritmo pela barra fixa), concluir a etapa
 * e recarregar a página para abrir o save automático.
 */
import { expect, test } from '@playwright/test';
import { SAVES, abrirSave, irPara, vigiarErros } from './apoio';

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test('criar carreira, disputar uma etapa inteira e recarregar o save', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova carreira' }).click();
  await page.getByLabel(/^Nome/).first().fill('Rui');
  await page.getByLabel(/Sobrenome/).fill('Prado');
  await page.getByRole('button', { name: /Começar|Iniciar|Assinar/ }).last().click();
  await page.waitForURL(/#\/dashboard/);

  // O Painel mostra a primeira etapa e o botão de avançar leva ao fim de semana.
  const topo = page.getByRole('banner').first();
  await expect(topo).toContainText('Etapa 1 de 10');
  await expect(topo).toContainText('R$ 30.000');
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
