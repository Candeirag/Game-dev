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
      // Cada tela e, nas que têm abas, cada aba.
      for (const [nome, arquivo, abas] of [
        ['Fim de semana', 'fim-de-semana', []],
        ['Piloto', 'piloto', ['Condição e treino', 'Números']],
        ['Equipe', 'equipe', ['Contrato', 'Pilotos']],
        ['Carreira', 'carreira', ['Licença', 'Interesse']],
        ['Vida', 'vida', []],
        ['Calendário', 'calendario', []],
        ['Classificação', 'classificacao', ['Equipes']],
        ['Histórico', 'historico', []],
        ['Saves', 'saves', []],
        ['Como jogar', 'como-jogar', ['Fim de semana', 'Dinheiro']],
      ] as const) {
        await irPara(page, nome);
        await conferirTela(page, arquivo, formato.nome);
        for (const aba of abas) {
          await page.getByRole('main').getByRole('tab', { name: aba, exact: true }).click();
          await conferirTela(page, `${arquivo}-${aba.toLowerCase().replaceAll(' ', '-')}`, formato.nome);
        }
      }
      expect(erros).toEqual([]);
    });

    test('topo da escada, num save antigo: os nomes mais longos cabem', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.antigoNoTopo);
      await conferirTela(page, 'topo-painel', formato.nome);
      for (const [nome, arquivo, abas] of [
        ['Carreira', 'topo-carreira', ['Escada', 'Licença', 'Interesse']],
        ['Equipe', 'topo-equipe', ['Contrato']],
        ['Histórico', 'topo-historico', []],
        ['Classificação', 'topo-classificacao', ['Equipes']],
      ] as const) {
        await irPara(page, nome);
        await conferirTela(page, arquivo, formato.nome);
        for (const aba of abas) {
          await page.getByRole('main').getByRole('tab', { name: aba, exact: true }).click();
          await conferirTela(page, `${arquivo}-${aba.toLowerCase().replaceAll(' ', '-')}`, formato.nome);
        }
      }
      expect(erros).toEqual([]);
    });

    test('vida: finanças e família', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.formula);
      // Finanças e Família ficam dentro de Vida: cada linha da lista leva a uma área.
      for (const [linha, arquivo] of [
        ['Finanças', 'financas'],
        ['Patrocínios', 'financas-patrocinios'],
        ['Imóveis e empresas', 'financas-imoveis'],
        ['Investimentos', 'financas-investimentos'],
        ['Participações em equipes', 'financas-participacoes'],
        ['Crédito e padrão de vida', 'financas-credito'],
        ['Família', 'familia'],
      ] as const) {
        await irPara(page, 'Vida');
        await page
          .getByRole('main')
          .getByRole('link', { name: new RegExp(`^${linha}`) })
          .click();
        await conferirTela(page, arquivo, formato.nome);
      }
      for (const aba of ['Filhos', 'Linhagem']) {
        await page.getByRole('main').getByRole('tab', { name: aba, exact: true }).click();
        await conferirTela(page, `familia-${aba.toLowerCase()}`, formato.nome);
      }
      // O caminho de volta leva à tela Vida.
      await page.getByRole('main').getByRole('link', { name: 'Vida' }).click();
      await expect(page.getByRole('heading', { name: 'Vida', level: 1 })).toBeVisible();
      expect(erros).toEqual([]);
    });

    test('telas do dirigente, depois de pendurar o capacete', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.fimDeTemporada);
      await irPara(page, 'Carreira');
      await page.getByRole('button', { name: 'Pendurar o capacete' }).click();
      await page.getByRole('button', { name: 'Confirmar: parar de correr' }).click();
      // Sem equipe, no fechamento da temporada: propostas de cargo, equipes à venda e fundar a própria.
      await irPara(page, 'Carreira');
      await conferirTela(page, 'dirigente-carreira', formato.nome);
      for (const aba of ['À venda', 'Fundar']) {
        await page.getByRole('main').getByRole('tab', { name: aba, exact: true }).click();
        await conferirTela(page, `dirigente-carreira-${aba === 'Fundar' ? 'fundar' : 'a-venda'}`, formato.nome);
      }
      await page.getByRole('main').getByRole('tab', { name: 'Resumo', exact: true }).click();
      await page.getByRole('button', { name: 'Aceitar o cargo' }).first().click();
      // Com equipe: painel, gestão (todas as abas), fim de semana e carreira.
      await irPara(page, 'Painel');
      await conferirTela(page, 'dirigente-painel', formato.nome);
      await irPara(page, 'Gestão');
      await conferirTela(page, 'dirigente-gestao', formato.nome);
      for (const aba of ['Equipe técnica', 'Instalações', 'Desenvolvimento', 'Pilotos']) {
        await page.getByRole('main').getByRole('tab', { name: aba, exact: true }).click();
        await conferirTela(page, `dirigente-gestao-${aba.toLowerCase().replaceAll(' ', '-')}`, formato.nome);
      }
      await irPara(page, 'Fim de semana');
      await conferirTela(page, 'dirigente-fim-de-semana', formato.nome);
      await irPara(page, 'Carreira');
      await conferirTela(page, 'dirigente-carreira-com-equipe', formato.nome);
      expect(erros).toEqual([]);
    });
  });
}
