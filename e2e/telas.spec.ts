/**
 * Conferência visual: abre todas as telas principais no celular (em pé e deitado), no tablet e
 * no computador, tira um print de cada uma (test-results/telas) e verifica se alguma imagem
 * cruza um texto, se a página passa da largura da tela e se há área de toque menor que 44 px.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SAVES, TELAS, abrirSave, conferirTela, gravarNoAparelho, irPara, vigiarErros } from './apoio';

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
      // Ajustes também abre pelo menu, sem carreira carregada.
      await page.getByRole('button', { name: 'Voltar' }).click();
      await page.getByRole('button', { name: 'Ajustes' }).click();
      await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
      await conferirTela(page, 'ajustes-menu', formato.nome);
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
        ['Ajustes', 'ajustes', []],
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

    test('saves: o save do formato anterior fica guardado depois da conversão e pode ser exportado', async ({ page }) => {
      const erros = vigiarErros(page);
      // O aparelho já tem um save automático gravado pela versão anterior do jogo (formato 3).
      await gravarNoAparelho(page, 'auto', SAVES.antigoComAcademia);
      await page.getByRole('button', { name: /^Continuar:/ }).click();
      await page.waitForURL(/#\/dashboard/);
      const copias = page.getByRole('region', { name: 'Cópias de formatos anteriores' });
      // Abrir só converte na memória: o slot ainda guarda o formato 3 e não há cópia para mostrar.
      await irPara(page, 'Saves');
      await expect(page.getByRole('main')).toContainText('Save automático');
      await expect(copias).toHaveCount(0);
      // A primeira gravação automática (aqui, trocar o foco do treino) converte o slot e guarda o original.
      await irPara(page, 'Piloto');
      await page.getByRole('main').getByRole('tab', { name: 'Condição e treino', exact: true }).click();
      await page.getByRole('main').locator('button[aria-pressed="false"]').first().click();
      await expect(page.getByRole('img', { name: /^Salvo em/ })).toBeVisible();
      await irPara(page, 'Saves');
      await expect(copias).toContainText('Save automático · formato 3');
      await expect(copias).toContainText('F. Júnior');
      await conferirTela(page, 'saves-copia-do-formato-anterior', formato.nome);
      // O arquivo exportado é o save antigo, byte a byte no conteúdo: é o que a versão anterior abre.
      const [download] = await Promise.all([page.waitForEvent('download'), copias.getByRole('button', { name: 'Exportar cópia (.json)' }).click()]);
      expect(download.suggestedFilename()).toBe('apex-save-original-auto-formato-3.json');
      const exportado = JSON.parse(readFileSync(await download.path(), 'utf8')) as unknown;
      expect(exportado).toEqual(JSON.parse(readFileSync(SAVES.antigoComAcademia, 'utf8')));
      // Apagar o slot não apaga a cópia: a lista é relida do armazenamento depois da exclusão.
      await page.getByRole('main').getByRole('button', { name: 'Apagar', exact: true }).first().click();
      await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
      await expect(page.getByRole('status')).toContainText('Save automático apagado.');
      await expect(copias).toContainText('Save automático · formato 3');
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

/** As telas principais do critério de aceite da Fase 1, na tela deitada. */
const PRINCIPAIS = ['Fim de semana', 'Piloto', 'Equipe', 'Carreira', 'Saves', 'Ajustes'] as const;

test.describe('ajustes de acessibilidade em 844×390', () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('texto muito grande: as telas principais continuam cabendo, legíveis e tocáveis', async ({ page }) => {
    const erros = vigiarErros(page);
    await abrirSave(page, SAVES.formula);
    await irPara(page, 'Ajustes');
    await page.getByRole('radio', { name: 'Muito grande' }).click();
    await expect(page.locator('html')).toHaveCSS('--text-scale-user', '1.3');
    await conferirTela(page, 'texto-grande-ajustes', 'deitado');
    await irPara(page, 'Painel');
    await conferirTela(page, 'texto-grande-painel', 'deitado');
    for (const nome of PRINCIPAIS.filter((n) => n !== 'Ajustes')) {
      await irPara(page, nome);
      await conferirTela(page, `texto-grande-${nome.toLowerCase().replaceAll(' ', '-')}`, 'deitado');
    }
    // O ajuste fica guardado no aparelho: vale depois de recarregar, já no menu.
    await page.reload();
    await expect(page.locator('html')).toHaveCSS('--text-scale-user', '1.3');
    expect(erros).toEqual([]);
  });

  test('texto muito grande na corrida: a torre e os comandos cabem', async ({ page }) => {
    const erros = vigiarErros(page);
    await abrirSave(page, SAVES.naLargada);
    await irPara(page, 'Ajustes');
    await page.getByRole('radio', { name: 'Muito grande' }).click();
    await irPara(page, 'Fim de semana');
    await page.getByRole('button', { name: 'Ir para a largada' }).click();
    await page.getByRole('region', { name: 'Comandos da corrida' }).getByRole('button', { name: 'Largar' }).click();
    await page.waitForTimeout(3000);
    await conferirTela(page, 'texto-grande-corrida', 'deitado');
    expect(erros).toEqual([]);
  });

  test('modo para daltônicos: a paleta troca, o contraste se mantém e o ajuste fica guardado', async ({ page }) => {
    const erros = vigiarErros(page);
    await abrirSave(page, SAVES.formula);
    await irPara(page, 'Ajustes');
    const verde = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-go-400').trim());
    await page.getByRole('switch', { name: /Modo para daltônicos/ }).check();
    await expect(page.locator('html')).toHaveAttribute('data-vision', 'daltonico');
    const azul = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-go-400').trim());
    expect(azul).not.toBe(verde);
    await conferirTela(page, 'daltonico-ajustes', 'deitado');
    await irPara(page, 'Painel');
    await conferirTela(page, 'daltonico-painel', 'deitado');
    await irPara(page, 'Carreira');
    await conferirTela(page, 'daltonico-carreira', 'deitado');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-vision', 'daltonico');
    expect(erros).toEqual([]);
  });

  test('os volumes e os interruptores ficam guardados no aparelho', async ({ page }) => {
    await page.goto('/#/ajustes');
    await page.getByRole('slider', { name: 'Efeitos' }).fill('30');
    await page.getByRole('slider', { name: 'Música' }).fill('0');
    await page.getByRole('switch', { name: /Menos movimento/ }).check();
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Efeitos' })).toHaveValue('30');
    await expect(page.getByRole('slider', { name: 'Música' })).toHaveValue('0');
    await expect(page.getByRole('switch', { name: /Menos movimento/ })).toBeChecked();
    // No navegador o aparelho não vibra: o interruptor aparece desativado, com a explicação.
    await expect(page.getByRole('switch', { name: /Vibração/ })).toBeDisabled();
    await expect(page.getByRole('main')).toContainText('Só existe no aplicativo instalado');
  });

  test('o catálogo de componentes não existe no build de produção', async ({ page }) => {
    await page.goto('/#/dev/catalogo');
    // A rota não é registrada: o jogo volta para o menu inicial.
    await expect(page.getByRole('button', { name: 'Nova carreira' })).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
  });
});

test.describe('torre da corrida em 844×390', () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('não rola sozinha quando os carros trocam de posição, e com o jogador em P1 o segundo aparece inteiro', async ({ page }) => {
    const erros = vigiarErros(page);
    // No save de monopostos o jogador larga na pole.
    await abrirSave(page, SAVES.formula);
    await irPara(page, 'Fim de semana');
    await page.getByRole('button', { name: 'Iniciar fim de semana' }).click();
    await page.getByRole('button', { name: 'Disputar treino livre' }).click();
    await page.getByRole('button', { name: 'Disputar classificação' }).click();
    await page.getByRole('button', { name: 'Ir para a largada' }).click();
    const barra = page.getByRole('region', { name: 'Comandos da corrida' });
    await barra.getByRole('button', { name: '8×' }).click();
    await barra.getByRole('button', { name: 'Largar' }).click();
    const torre = page.locator('[data-whole-rows]');
    const leituras = async () => {
      const valores: number[] = [];
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(800);
        valores.push(await torre.evaluate((list) => Math.round(list.scrollTop)));
      }
      return valores;
    };
    // No alto, com ultrapassagens acontecendo: a lista fica parada.
    expect(await leituras()).toEqual([0, 0, 0, 0, 0]);
    // A primeira linha é a do jogador (grudada no alto) e a segunda aparece inteira, sem nada por cima.
    const linhas = await torre.evaluate((list) => {
      const rows = [...list.querySelectorAll<HTMLElement>('[data-row]')].map((row) => row.getBoundingClientRect());
      return { primeira: rows[0], segunda: rows[1] };
    });
    expect(linhas.segunda?.top ?? 0).toBeGreaterThanOrEqual((linhas.primeira?.bottom ?? 0) - 0.5);
    await expect(torre.locator('[data-row]').first()).toContainText('(você)');
    // Rolada uma linha para baixo (onde a âncora de rolagem do navegador agiria): também fica parada.
    const linha = await torre.evaluate((list) => {
      const altura = list.querySelector<HTMLElement>('[data-row]')?.getBoundingClientRect().height ?? 0;
      list.scrollTop = altura;
      list.dispatchEvent(new Event('scroll'));
      return Math.round(altura);
    });
    expect(linha).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    expect(await leituras()).toEqual([linha, linha, linha, linha, linha]);
    expect(erros).toEqual([]);
  });
});
