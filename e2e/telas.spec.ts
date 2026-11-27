/**
 * Conferência visual: abre todas as telas principais no celular (em pé e deitado), no tablet e
 * no computador, tira um print de cada uma (test-results/telas) e verifica se alguma imagem
 * cruza um texto, se a página passa da largura da tela e se há área de toque menor que 44 px.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  SAVES,
  TELAS,
  abrirSave,
  conferirTela,
  correrAteOLance,
  desfechoDoLance,
  escolherOpcao,
  gravarNoAparelho,
  irPara,
  opcoesDoLance,
  responderLance,
  responderLances,
  tarjaDoLance,
  vigiarErros,
} from './apoio';

for (const formato of TELAS) {
  test.describe(`telas em ${formato.width}×${formato.height}`, () => {
    test.use({
      viewport: { width: formato.width, height: formato.height },
      deviceScaleFactor: formato.celular ? 2 : 1,
      isMobile: formato.celular,
      hasTouch: formato.toque,
    });

    test('menu inicial, nascimento e nova carreira', async ({ page }) => {
      const erros = vigiarErros(page);
      await page.goto('/');
      await conferirTela(page, 'menu', formato.nome);
      await page.getByRole('button', { name: 'Nova carreira' }).click();
      // Etapa 1: o nascimento sorteado (a ficha termina de se revelar antes do print).
      await expect(page.getByRole('heading', { name: 'Nascimento', level: 1 })).toBeVisible();
      await page.waitForTimeout(2500);
      await conferirTela(page, 'nascimento', formato.nome);
      // Etapa 2: a criação do piloto, com o nascimento aplicado.
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: 'Crie seu piloto', level: 1 })).toBeVisible();
      await conferirTela(page, 'nova-carreira', formato.nome);
      // Ajustes também abre pelo menu, sem carreira carregada.
      await page.getByRole('button', { name: 'Voltar' }).click();
      await expect(page.getByRole('heading', { name: 'Nascimento', level: 1 })).toBeVisible();
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
      // A corrida começa pela resposta ao lance da largada (aqui, entregue ao piloto): as luzes acendem.
      await responderLance(page, 'piloto');
      await expect(page.getByRole('region', { name: 'Comandos da corrida' })).toBeVisible();
      // O desfecho da largada passa pela tarja inferior e sai; a corrida segue, com os pneus à vista.
      await expect(desfechoDoLance(page)).toBeVisible({ timeout: 20_000 });
      await expect(desfechoDoLance(page)).toHaveCount(0);
      await expect(page.getByText(/Desgaste \d+% ·/).first()).toBeVisible();
      await conferirTela(page, 'corrida', formato.nome);
      // "Simular até o fim": os lances que faltam ficam com o piloto, e o resultado diz isso em cada um.
      await page.getByRole('button', { name: 'Simular até o fim' }).click();
      await expect(page.getByRole('button', { name: 'Concluir etapa e salvar' })).toBeVisible();
      await expect(page.getByRole('main')).toContainText('Lances da corrida');
      await expect(page.getByText('Decidido pelo piloto').first()).toBeVisible();
      await conferirTela(page, 'resultado', formato.nome);
      expect(erros).toEqual([]);
    });

    test('corrida com lances decisivos: largada, desfecho, pneus, lance no meio da prova e resultado', async ({ page }) => {
      test.setTimeout(180_000);
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.naLargada);
      await irPara(page, 'Fim de semana');
      await page.getByRole('button', { name: 'Ir para a largada' }).click();
      // No grid, a tarja do lance toma o lugar da barra de comandos: não há "Largar", e nada se confirma sem escolher.
      const largada = tarjaDoLance(page, 'Largada');
      const barra = page.getByRole('region', { name: 'Comandos da corrida' });
      await expect(largada).toBeVisible();
      await expect(barra).toHaveCount(0);
      await expect(opcoesDoLance(page)).toHaveCount(3);
      await expect(largada.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
      await expect(largada.getByRole('button', { name: 'Deixar com o piloto' })).toBeEnabled();
      await conferirTela(page, 'corrida-lance-largada', formato.nome);
      // Uma opção marcada: a chance e o prejuízo se errar estão no nome dela; a tarja diz o que se ganha, o que se perde e o que pesa.
      expect(await escolherOpcao(page, 'segura')).toMatch(/^.+: \d+% de chance de dar certo; (se errar: perde pouco|sem risco)/);
      await expect(largada).toContainText('Se der certo:');
      await expect(largada).toContainText('Se der errado:');
      await expect(largada).toContainText('Pesa na chance, em pontos:');
      await conferirTela(page, 'corrida-lance-opcao', formato.nome);
      await largada.getByRole('button', { name: 'Confirmar' }).click();
      // As luzes apagam e o desfecho aparece na tarja inferior, em palavras (não só na cor).
      const desfecho = desfechoDoLance(page);
      await expect(desfecho).toBeVisible({ timeout: 20_000 });
      await expect(desfecho).toContainText('Lance · Largada');
      await conferirTela(page, 'corrida-lance-desfecho', formato.nome);
      await expect(desfecho).toHaveCount(0);
      // O painel de pneus completo (gaveta "Piloto" nas telas largas, aba "Piloto" em pé): desgaste em
      // número e palavra, o gráfico do tempo de volta e até quando o pneu vai.
      const paineis = page.getByRole('group', { name: 'Painéis da corrida' });
      if (await paineis.count()) await paineis.getByRole('button', { name: 'Piloto' }).click();
      else await page.getByRole('tab', { name: 'Piloto' }).click();
      const pneus = page.getByRole('region', { name: 'Pneus' });
      await expect(pneus).toContainText(/Desgaste \d+% · \S+/);
      await expect(pneus.getByRole('img', { name: /^Tempo de volta/ })).toBeVisible();
      await expect(pneus).toContainText(/Cai do penhasco na volta \d+|Aguenta até a bandeirada|O pneu já caiu do penhasco/);
      // Na gaveta, os pneus vêm depois da ficha do piloto: rola até eles para o print.
      await pneus.scrollIntoViewIfNeeded();
      await conferirTela(page, 'corrida-pneus', formato.nome);
      // Um lance no meio da prova (nesta semente, um ataque na volta 7): a corrida para sozinha e a pista continua à vista.
      await barra.getByRole('button', { name: '8×' }).click();
      const disputa = await correrAteOLance(page, /Ataque|Defesa/);
      await expect(barra).toHaveCount(0);
      await expect(disputa.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
      await conferirTela(page, 'corrida-lance-ataque', formato.nome);
      // Até a bandeirada, todos os lances respondidos pelo jogador: nenhum fica marcado como decidido pelo piloto.
      await responderLance(page, 'ousada');
      await responderLances(page, 'segura');
      await expect(page.getByRole('button', { name: 'Concluir etapa e salvar' })).toBeVisible({ timeout: 90_000 });
      const principal = page.getByRole('main');
      await expect(principal).toContainText('Lances da corrida');
      await expect(principal).toContainText(/Largada: .+\d+% de chance/);
      await expect(principal).toContainText(/(Ataque|Defesa): .+\d+% de chance/);
      await expect(principal).toContainText(/\d (deu certo|deram certo) de \d/);
      await expect(page.getByText('Decidido pelo piloto')).toHaveCount(0);
      await conferirTela(page, 'corrida-resultado-lances', formato.nome);
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
      // Também na cronometragem a corrida começa pelo lance da largada: a tarja fica no lugar da barra de comandos.
      const barra = page.getByRole('region', { name: 'Comandos da corrida' });
      await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
      await expect(barra).toHaveCount(0);
      await conferirTela(page, 'cronometragem-lance', formato.nome);
      await responderLance(page, 'segura');
      await barra.getByRole('button', { name: '8×' }).click();
      await expect(barra).toContainText(/Volta [3-9]\/44/);
      // Parada para o print: em 8× a parada planejada (e o lance dela) chegaria no meio da conferência.
      await barra.getByRole('button', { name: 'Pausar' }).click();
      await conferirTela(page, 'cronometragem', formato.nome);
      await page.getByRole('tab', { name: 'Boxes' }).click();
      await conferirTela(page, 'cronometragem-boxes', formato.nome);
      // A escolha do modo de exibição fica guardada; volta para a corrida visual.
      await page.getByRole('button', { name: 'Voltar à corrida visual' }).click();
      await expect(page.getByRole('button', { name: 'Modo cronometragem' })).toBeVisible();
      // Na corrida visual, a prova segue até o lance da parada (nesta semente, na volta 31): além das
      // opções, a tarja mostra o pneu que está no carro e deixa escolher o que entra.
      await barra.getByRole('button', { name: '8×' }).click();
      await barra.getByRole('button', { name: /^(Continuar|Largar)$/ }).click();
      const parada = await correrAteOLance(page, 'Parada');
      await expect(parada).toContainText(/Desgaste \d+% ·/);
      await expect(parada.getByRole('radiogroup', { name: 'Pneu a colocar' }).getByRole('radio', { checked: true })).toHaveCount(1);
      await conferirTela(page, 'corrida-lance-parada', formato.nome);
      expect(erros).toEqual([]);
    });

    test('nascimento na carreira: mudança para São Paulo pendente e ficha com traço revelado', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.nascimento);
      await conferirTela(page, 'painel-mudanca', formato.nome);
      await irPara(page, 'Piloto');
      await page.getByRole('main').getByRole('tab', { name: 'Nascimento', exact: true }).click();
      await expect(page.getByRole('main')).toContainText('Talentos e defeitos');
      await expect(page.getByRole('main')).toContainText('Oculto');
      await conferirTela(page, 'piloto-nascimento-revelado', formato.nome);
      expect(erros).toEqual([]);
    });

    test('decisões: um cartão por vez e o desfecho com o que mudou', async ({ page }) => {
      const erros = vigiarErros(page);
      // Dois cartões antigos pendentes (o aporte extra à equipe e a mudança para São Paulo): só o primeiro aparece.
      await abrirSave(page, SAVES.nascimento);
      const cartao = page.getByRole('region', { name: 'A equipe pede um aporte extra' });
      await expect(cartao).toBeVisible();
      await expect(page.getByRole('region', { name: 'Mudança para São Paulo' })).toHaveCount(0);
      await expect(cartao).toContainText('Contrato');
      await expect(cartao).toContainText('Decisão 1 de 2');
      // A escolha com mais de um desfecho leva o dado e a palavra; a explicação dos cartões antigos continua lá.
      const escolhas = cartao.getByRole('group', { name: 'Escolhas' }).getByRole('button');
      await expect(escolhas).toHaveCount(3);
      await expect(escolhas.filter({ hasText: 'Recusar' })).toContainText('Incerto');
      await expect(escolhas.filter({ hasText: 'Pagar' })).not.toContainText('Incerto');
      await expect(escolhas.filter({ hasText: 'Pagar' })).toContainText('fica em dívida com você');
      await cartao.scrollIntoViewIfNeeded();
      await conferirTela(page, 'decisao-cartao', formato.nome);
      // Tocar numa escolha resolve na hora: o cartão vira o desfecho, com o que mudou em ícone, texto e seta.
      await escolhas.filter({ hasText: 'Pagar' }).click();
      const desfecho = page.getByRole('region', { name: 'Desfecho: A equipe pede um aporte extra' });
      await expect(desfecho).toBeVisible();
      await expect(desfecho).toContainText('Você escolheu: Pagar R$ 1.400');
      await expect(desfecho).toContainText('O aporte garante as atualizações previstas.');
      const mudancas = desfecho.getByRole('list', { name: 'O que mudou' }).getByRole('listitem');
      await expect(mudancas).toHaveCount(2);
      await expect(mudancas.filter({ hasText: 'Caixa' })).toContainText(/caiu\s*−R\$\s1\.400/);
      await expect(mudancas.filter({ hasText: 'Confiança da equipe' })).toContainText(/subiu\s*\+\d/);
      await expect(desfecho).toContainText('Falta 1 decisão');
      await desfecho.scrollIntoViewIfNeeded();
      await conferirTela(page, 'decisao-desfecho', formato.nome);
      // "Próxima decisão" traz o segundo cartão, com o contador andando.
      await desfecho.getByRole('button', { name: 'Próxima decisão' }).click();
      const segundo = page.getByRole('region', { name: 'Mudança para São Paulo' });
      await expect(segundo).toContainText('Decisão 2 de 2');
      await expect(segundo).toContainText('Família');
      expect(erros).toEqual([]);
    });

    test('carreira e painel no fim da temporada', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.fimDeTemporada);
      await conferirTela(page, 'painel-fim-de-temporada', formato.nome);
      // Caminhos, no fim da temporada: as portas abertas podem ser usadas.
      await page.getByRole('main').getByRole('link', { name: 'Ver caminhos' }).click();
      await page.waitForTimeout(350);
      await expect(page.getByRole('main')).toContainText('Mais um ano atrás de resultado');
      await conferirTela(page, 'caminhos-fim-de-temporada', formato.nome);
      await irPara(page, 'Carreira');
      await conferirTela(page, 'carreira-propostas', formato.nome);
      expect(erros).toEqual([]);
    });

    test('demais telas, numa carreira de monopostos', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.formula);
      await conferirTela(page, 'painel-formula', formato.nome);
      // Caminhos (Fase 3 da grande atualização), aberta pelo resumo do Painel, no meio da temporada.
      await page.getByRole('main').getByRole('link', { name: 'Ver caminhos' }).click();
      await page.waitForTimeout(350);
      await expect(page.getByRole('main')).toContainText('Vaquinha da cidade');
      await conferirTela(page, 'caminhos', formato.nome);
      // Cada tela e, nas que têm abas, cada aba.
      for (const [nome, arquivo, abas] of [
        ['Fim de semana', 'fim-de-semana', []],
        ['Piloto', 'piloto', ['Condição e treino', 'Nascimento', 'Números']],
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

    /* ---------------- Fase 6: dinastia e aposentadoria (saves da versão 10) ---------------- */

    test('dinastia: árvore e placar, pela Vida e pela Família, e a ficha do herdeiro', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.segundaGeracao);
      const principal = page.getByRole('main');
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Dinastia/ }).click();
      await expect(page.getByRole('heading', { name: 'Dinastia', level: 1 })).toBeVisible();
      // A árvore: as duas gerações no tronco, quem passou o comando em vida e os irmãos que seguiram outro caminho.
      await expect(principal).toContainText('Passou o comando em vida');
      await expect(principal).toContainText('Seguiram outro caminho');
      await expect(principal).toContainText('Engenharia');
      await conferirTela(page, 'dinastia-arvore', formato.nome);
      await principal.getByRole('tab', { name: 'Placar', exact: true }).click();
      await expect(page).toHaveURL(/tab=placar/);
      await expect(principal).toContainText('Placar da dinastia');
      await conferirTela(page, 'dinastia-placar', formato.nome);
      // Também se chega pela Família, pelo atalho do cabeçalho.
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Família/ }).click();
      await principal.getByRole('link', { name: 'Árvore e placar' }).click();
      await expect(page.getByRole('heading', { name: 'Dinastia', level: 1 })).toBeVisible();
      // A ficha de quem herdou a carreira: o nascimento vem da família de piloto, com os traços já revelados.
      await irPara(page, 'Piloto');
      await principal.getByRole('tab', { name: 'Nascimento', exact: true }).click();
      await expect(principal).toContainText('Talentos e defeitos');
      await conferirTela(page, 'piloto-nascimento-herdeiro', formato.nome);
      expect(erros).toEqual([]);
    });

    test('família: os filhos com os traços ocultos e o teste no kart', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.filhosNoTesteDoKart);
      // O cartão do teste no kart de quem fez 12 anos, no painel.
      await expect(page.getByRole('region', { name: 'Dia de avaliação no kartódromo' })).toBeVisible();
      await conferirTela(page, 'painel-teste-no-kart', formato.nome);
      const principal = page.getByRole('main');
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Família/ }).click();
      await principal.getByRole('tab', { name: 'Filhos', exact: true }).click();
      const filhos = principal.getByRole('list').first();
      // Quem já fez o teste: o tempo e o veredito, e parte dos traços revelada.
      await filhos.getByRole('button', { name: /^Maya/ }).click();
      await expect(principal).toContainText('Talentos e defeitos de nascença');
      await expect(principal).toContainText(/\d\.\d{3} s do tempo de referência/);
      await conferirTela(page, 'familia-filhos-teste-no-kart', formato.nome);
      // Quem ainda é criança: todos os traços ocultos e a data do teste.
      await filhos.getByRole('button', { name: /^Ayrton/ }).click();
      await expect(principal).not.toContainText('Todos revelados');
      await expect(principal).toContainText(/O teste vem no começo da temporada em que Ayrton tiver 12 anos/);
      await conferirTela(page, 'familia-filhos-tracos-ocultos', formato.nome);
      expect(erros).toEqual([]);
    });

    test('sucessão com vários filhos: o que se sabe de cada um e as vagas da próxima temporada', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.sucessaoComVariosFilhos);
      await expect(page.getByRole('heading', { name: 'Quem assume a família?', level: 1 })).toBeVisible();
      const lista = page.getByRole('main').getByRole('list').first();
      await expect(lista.getByRole('button')).toHaveCount(7);
      await conferirTela(page, 'sucessao-varios-filhos', formato.nome);
      // Um filho piloto: o caminho nas pistas e as três vagas (mesma força, equipe da frente, equipe da família).
      await lista.getByRole('button', { name: /^Nico Teste/ }).click();
      const familia = page.getByRole('button', { name: /^Equipe da família/ });
      await expect(page.getByRole('button', { name: /^Mesma força/ })).toBeEnabled();
      await expect(page.getByRole('button', { name: /^Equipe da frente/ })).toBeEnabled();
      await familia.click();
      await expect(familia).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('main')).toContainText('Favorecimento: a imprensa vai cobrar');
      await conferirTela(page, 'sucessao-vagas', formato.nome);
      await expect(familia).toHaveAttribute('aria-pressed', 'true');
      expect(erros).toEqual([]);
    });

    test('aposentadoria no meio do ano: as propostas do ano de transição e o começo do papel', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.aposentadoriaNoMeioDoAno);
      // O painel avisa que a proposta vale até a próxima etapa.
      await expect(page.getByRole('main')).toContainText('Você acabou de parar de correr');
      await conferirTela(page, 'transicao-meio-do-ano-painel', formato.nome);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      await expect(principal).toContainText('Ano de transição');
      // A mentoria fica indisponível (ninguém para acompanhar), com o motivo por escrito.
      await expect(page.getByRole('button', { name: /^Mentoria/ })).toBeDisabled();
      await expect(principal).toContainText('Nenhum jovem piloto para acompanhar');
      const comentarios = page.getByRole('button', { name: /^Comentários na TV/ });
      await comentarios.click();
      await conferirTela(page, 'transicao-meio-do-ano', formato.nome);
      // A moldura muda de formato no print da página inteira; a escolha continua de pé.
      await expect(comentarios).toHaveAttribute('aria-pressed', 'true');
      // Começar o papel agora: ele vale pelo resto da temporada, e o painel passa a mostrá-lo.
      await page.getByRole('button', { name: 'Começar o ano de transição' }).click();
      await irPara(page, 'Painel');
      await expect(page.getByRole('main')).toContainText('Comentários na TV');
      await expect(page.getByRole('main')).toContainText('Cachê recebido');
      expect(erros).toEqual([]);
    });

    test('ano de transição: o cartão no fechamento e o painel durante o ano', async ({ page }) => {
      const erros = vigiarErros(page);
      // No fechamento logo depois de parar: o ano de transição antes das propostas de cargo.
      await abrirSave(page, SAVES.fechamentoComAnoDeTransicao);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      await expect(principal).toContainText('pela próxima temporada inteira');
      await expect(page.getByRole('button', { name: /^Imagem de uma marca/ })).toBeEnabled();
      await conferirTela(page, 'transicao-fechamento', formato.nome);
      // Durante o ano (a imagem de uma marca): cachê, marca e legado no painel, com um cartão do papel pendente.
      await abrirSave(page, SAVES.anoDeTransicao);
      await expect(page.getByRole('region', { name: 'Lote com defeito' })).toBeVisible();
      await expect(principal).toContainText('Calçados Passo Largo');
      await expect(principal).toContainText('Cachê recebido');
      await conferirTela(page, 'transicao-painel', formato.nome);
      await irPara(page, 'Fim de semana');
      await conferirTela(page, 'transicao-fim-de-semana', formato.nome);
      expect(erros).toEqual([]);
    });

    test('dirigente com filhos pilotos: o aviso de favorecimento e os parentes no mercado', async ({ page }) => {
      const erros = vigiarErros(page);
      // Fechamento do dono da equipe, com dois filhos entre os candidatos.
      await abrirSave(page, SAVES.dirigenteComFilhoPiloto);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      await principal.getByRole('tab', { name: 'Pilotos', exact: true }).click();
      await expect(principal).toContainText(/a imprensa vai falar em favorecimento/);
      await conferirTela(page, 'dirigente-pilotos-com-filho', formato.nome);
      // Na segunda geração, quem seguiu pela engenharia aparece no mercado de profissionais, marcado como família.
      await abrirSave(page, SAVES.segundaGeracaoDonaDeEquipe);
      await irPara(page, 'Gestão');
      await principal.getByRole('tab', { name: 'Equipe técnica', exact: true }).click();
      const engenheiro = principal.getByRole('button', { name: /^Engenheiro-chefe/ });
      await engenheiro.click();
      await expect(principal).toContainText(/Olívia Teste · nota \d+/);
      await expect(principal).toContainText('salário de família');
      await expect(engenheiro).toHaveAttribute('aria-pressed', 'true');
      // O print de página inteira muda a altura da janela (e a moldura deitada/em pé): a escolha da
      // tela não é conferida depois dele.
      await conferirTela(page, 'gestao-parentes-no-mercado', formato.nome);
      expect(erros).toEqual([]);
    });

    test('herdeiro nas pistas: a proposta da equipe da família e os apoios de legado', async ({ page }) => {
      const erros = vigiarErros(page);
      await abrirSave(page, SAVES.herdeiroComEquipeDaFamilia);
      await irPara(page, 'Carreira');
      const principal = page.getByRole('main');
      const proposta = principal.getByRole('button', { name: /^Castilla Racing.*Equipe da família/ });
      await proposta.click();
      await expect(proposta).toHaveAttribute('aria-pressed', 'true');
      await expect(principal).toContainText('Equipe da família: a imprensa vai falar em favorecimento');
      await conferirTela(page, 'propostas-equipe-da-familia', formato.nome);
      // Os apoios sem meta: a empresa do irmão e a marca do ano de transição.
      await irPara(page, 'Vida');
      await principal.getByRole('link', { name: /^Patrocínios/ }).click();
      await expect(principal).toContainText('Empresa de Nico Teste');
      await expect(principal).toContainText('Calçados Passo Largo');
      await conferirTela(page, 'financas-patrocinios-legado', formato.nome);
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

  test('texto muito grande no lance da largada: a pergunta, as opções e os botões cabem', async ({ page }) => {
    const erros = vigiarErros(page);
    await abrirSave(page, SAVES.naLargada);
    await irPara(page, 'Ajustes');
    await page.getByRole('radio', { name: 'Muito grande' }).click();
    await irPara(page, 'Fim de semana');
    await page.getByRole('button', { name: 'Ir para a largada' }).click();
    const tarja = tarjaDoLance(page, 'Largada');
    await expect(tarja).toBeVisible();
    await conferirTela(page, 'texto-grande-lance', 'deitado');
    // Com uma opção marcada a tarja fica mais alta (entra o detalhe do que se ganha e do que se perde).
    await escolherOpcao(page, 'segura');
    await conferirTela(page, 'texto-grande-lance-opcao', 'deitado');
    // A pista continua à vista acima da tarja, e os dois botões ficam inteiros dentro da tela.
    const caixa = await tarja.boundingBox();
    expect(caixa?.y ?? 0).toBeGreaterThanOrEqual(96);
    for (const nome of ['Deixar com o piloto', 'Confirmar']) await expect(tarja.getByRole('button', { name: nome })).toBeInViewport({ ratio: 1 });
    expect(erros).toEqual([]);
  });

  test('texto muito grande na corrida: a torre e os comandos cabem', async ({ page }) => {
    const erros = vigiarErros(page);
    await abrirSave(page, SAVES.naLargada);
    await irPara(page, 'Ajustes');
    await page.getByRole('radio', { name: 'Muito grande' }).click();
    await irPara(page, 'Fim de semana');
    await page.getByRole('button', { name: 'Ir para a largada' }).click();
    // A corrida começa pela resposta ao lance da largada; o print é depois que o desfecho sai da tarja inferior.
    await responderLance(page, 'segura');
    await expect(desfechoDoLance(page)).toBeVisible({ timeout: 20_000 });
    await expect(desfechoDoLance(page)).toHaveCount(0);
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
    // Larga segurando a posição (o jogador sai da pole e continua na frente); os lances seguintes se respondem sozinhos.
    await responderLance(page, 'segura');
    await responderLances(page);
    const barra = page.getByRole('region', { name: 'Comandos da corrida' });
    await barra.getByRole('button', { name: '8×' }).click();
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
