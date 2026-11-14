/**
 * Conferência visual: abre todas as telas principais no celular (em pé e deitado), no tablet e
 * no computador, tira um print de cada uma (test-results/telas) e verifica se alguma imagem
 * cruza um texto, se a página passa da largura da tela e se há área de toque menor que 44 px.
 */
import { expect, test } from '@playwright/test';
import { SAVES, TELAS, abrirSave, conferirTela, irPara, vigiarErros } from './apoio';

for (const formato of TELAS) {
  test.describe(`telas em ${formato.width}×${formato.height}`, () => {
    test.use({
      viewport: { width: formato.width, height: formato.height },
      deviceScaleFactor: formato.celular ? 2 : 1,
      isMobile: formato.celular,
      hasTouch: formato.toque,
    });

    test('menu inicial e nova carreira', async ({ page }) => {
      const erros = vigiarErros(page);
      await page.goto('/');
      await conferirTela(page, 'menu', formato.nome);
      await page.getByRole('button', { name: 'Nova carreira' }).click();
      await conferirTela(page, 'nova-carreira', formato.nome);
      expect(erros).toEqual([]);
    });

    test('painel, fim de semana e corrida', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.naLargada);
      await conferirTela(page, 'painel', formato.nome);
      await irPara(page, 'Fim de semana');
      await conferirTela(page, 'fim-de-semana-grid', formato.nome);
      await page.getByRole('button', { name: 'Ir para a largada' }).click();
      const barra = page.getByRole('region', { name: 'Comandos da corrida' });
      await barra.getByRole('button', { name: 'Largar' }).click();
      await page.waitForTimeout(4000);
      await conferirTela(page, 'corrida', formato.nome);
      await page.getByRole('button', { name: 'Simular até o fim' }).click();
      await expect(page.getByRole('button', { name: 'Concluir etapa e salvar' })).toBeVisible();
      await conferirTela(page, 'resultado', formato.nome);
      expect(erros).toEqual([]);
    });

    test('treino, classificação e modo cronometragem', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.formula);
      await irPara(page, 'Fim de semana');
      await page.getByRole('button', { name: 'Iniciar fim de semana' }).click();
      await conferirTela(page, 'fim-de-semana-treino', formato.nome);
      await page.getByRole('button', { name: 'Disputar treino livre' }).click();
      await conferirTela(page, 'fim-de-semana-classificacao', formato.nome);
      await page.getByRole('button', { name: 'Disputar classificação' }).click();
      await conferirTela(page, 'fim-de-semana-grid-formula', formato.nome);
      await page.getByRole('button', { name: 'Ir para a largada' }).click();
      await page.getByRole('button', { name: 'Modo cronometragem' }).click();
      const barra = page.getByRole('region', { name: 'Comandos da corrida' });
      await barra.getByRole('button', { name: '8×' }).click();
      await barra.getByRole('button', { name: 'Largar' }).click();
      await expect(barra).toContainText(/Volta [3-9]\/44/);
      await conferirTela(page, 'cronometragem', formato.nome);
      await page.getByRole('tab', { name: 'Boxes' }).click();
      await conferirTela(page, 'cronometragem-boxes', formato.nome);
      // A escolha do modo de exibição fica guardada; volta para a corrida visual.
      await page.getByRole('button', { name: 'Voltar à corrida visual' }).click();
      await expect(page.getByRole('button', { name: 'Modo cronometragem' })).toBeVisible();
      expect(erros).toEqual([]);
    });

    test('carreira e painel no fim da temporada', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.fimDeTemporada);
      await conferirTela(page, 'painel-fim-de-temporada', formato.nome);
      await irPara(page, 'Carreira');
      await conferirTela(page, 'carreira-propostas', formato.nome);
      expect(erros).toEqual([]);
    });

    test('demais telas, numa carreira de monopostos', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.formula);
      await conferirTela(page, 'painel-formula', formato.nome);
      for (const [nome, arquivo] of [
        ['Fim de semana', 'fim-de-semana'],
        ['Piloto', 'piloto'],
        ['Equipe', 'equipe'],
        ['Carreira', 'carreira'],
        ['Vida', 'vida'],
        ['Calendário', 'calendario'],
        ['Classificação', 'classificacao'],
        ['Histórico', 'historico'],
        ['Saves', 'saves'],
        ['Como jogar', 'como-jogar'],
      ] as const) {
        await irPara(page, nome);
        await conferirTela(page, arquivo, formato.nome);
      }
      // Finanças e Família ficam dentro de Vida: cada linha da lista leva a uma área.
      await irPara(page, 'Vida');
      for (const [linha, arquivo] of [
        ['Finanças', 'financas'],
        ['Patrocínios', 'financas-patrocinios'],
        ['Imóveis e empresas', 'financas-imoveis'],
        ['Investimentos', 'financas-investimentos'],
        ['Participações em equipes', 'financas-participacoes'],
        ['Crédito e padrão de vida', 'financas-credito'],
        ['Família', 'familia'],
      ] as const) {
        await page
          .getByRole('main')
          .getByRole('link', { name: new RegExp(`^${linha}`) })
          .click();
        await conferirTela(page, arquivo, formato.nome);
        await irPara(page, 'Vida');
      }
      expect(erros).toEqual([]);
    });
  });
}
