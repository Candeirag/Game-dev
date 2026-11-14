/**
 * Conferência visual: abre todas as telas principais nos dois formatos de celular, tira um
 * print de cada uma (test-results/telas) e verifica se alguma imagem cruza um texto ou se a
 * página passa da largura da tela.
 */
import { expect, test } from '@playwright/test';
import { SAVES, TELAS, abrirSave, conferirTela, irPara, vigiarErros } from './apoio';

for (const formato of TELAS) {
  test.describe(`telas em ${formato.width}×${formato.height}`, () => {
    test.use({ viewport: { width: formato.width, height: formato.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

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
        ['Finanças', 'financas'],
        ['Família', 'familia'],
        ['Calendário', 'calendario'],
        ['Classificação', 'classificacao'],
        ['Histórico', 'historico'],
        ['Saves', 'saves'],
        ['Como jogar', 'como-jogar'],
      ] as const) {
        await irPara(page, nome);
        await conferirTela(page, arquivo, formato.nome);
      }
      expect(erros).toEqual([]);
    });
  });
}
