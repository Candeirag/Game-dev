/**
 * Ritmo da corrida (critério de aceite da Fase 4): "uma corrida jogada com lances leva menos de
 * 4 minutos".
 *
 * A conta pura está em tests/pacing.test.ts (`raceScreenSeconds`). Aqui é o relógio de parede, com
 * o jogo de verdade: o save abre na largada, a corrida inteira roda em 1× na corrida visual e cada
 * lance é respondido pela interface assim que aparece (opção marcada e "Confirmar"; nada de
 * "Simular até o fim" nem de "+1 volta"). O tempo vai do primeiro toque até o resultado na tela.
 *
 * A corrida do save (kart, 19 voltas) dá 165 s de voltas em 1× mais 3,5 s de luzes: a conta prevê
 * cerca de 169 s, e a imagem ainda espera o último carro cruzar a linha.
 */
import { expect, test } from '@playwright/test';
import { SAVES, abrirSave, escolherOpcao, irPara, tarjaDoLance, vigiarErros } from './apoio';

test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

/** O teto do critério de aceite, em segundos. */
const QUATRO_MINUTOS = 240;
/** Abaixo disto a corrida não foi mostrada em 1× (as voltas somam 165 s): algo a pulou ou acelerou. */
const CORRIDA_INTEIRA = 150;

test('uma corrida inteira em 1×, respondendo a cada lance pela interface, leva menos de 4 minutos', async ({ page }) => {
  test.setTimeout(420_000);
  const erros = vigiarErros(page);
  await abrirSave(page, SAVES.naLargada);
  await irPara(page, 'Fim de semana');
  await page.getByRole('button', { name: 'Ir para a largada' }).click();
  const tarja = tarjaDoLance(page);
  const barra = page.getByRole('region', { name: 'Comandos da corrida' });
  const resultado = page.getByRole('button', { name: 'Concluir etapa e salvar' });
  await expect(tarjaDoLance(page, 'Largada')).toBeVisible();
  // A corrida do save tem 19 voltas (a volta aparece na barra superior do jogo).
  await expect(page.getByRole('banner').first()).toContainText('0/19');

  const lances: string[] = [];
  let pensando = 0;
  const inicio = Date.now();
  while (!(await resultado.count())) {
    if (await tarja.count()) {
      // O lance abriu: a opção mais segura é marcada e confirmada na hora (o jogador não demora).
      const aberto = Date.now();
      const titulo = (await tarja.getAttribute('aria-label'))?.replace('Lance decisivo: ', '') ?? '';
      const opcao = await escolherOpcao(page, 'segura');
      await tarja.getByRole('button', { name: 'Confirmar', exact: true }).click();
      lances.push(`${titulo}: ${opcao}`);
      pensando += Date.now() - aberto;
      // Depois da largada a corrida anda em 1×, a velocidade de quem abre o jogo pela primeira vez.
      if (lances.length === 1) await expect(barra.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
    } else await page.waitForTimeout(100);
    expect(Date.now() - inicio, 'a corrida passou de 4 minutos sem chegar ao resultado').toBeLessThan(QUATRO_MINUTOS * 1000);
  }
  const segundos = (Date.now() - inicio) / 1000;

  const medida = `corrida de 19 voltas em 1×: ${segundos.toFixed(1)} s do primeiro toque ao resultado, com ${lances.length} lances (${(pensando / 1000).toFixed(1)} s com a tarja aberta)`;
  test.info().annotations.push({ type: 'tempo de corrida', description: medida });
  console.log(`${medida}\n  ${lances.join('\n  ')}`);

  expect(segundos).toBeLessThan(QUATRO_MINUTOS);
  expect(segundos, 'a corrida não foi mostrada inteira em 1×').toBeGreaterThan(CORRIDA_INTEIRA);
  // Foi uma corrida jogada: pelo menos a largada e mais um lance, todos decididos pelo jogador.
  expect(lances.length).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/Você terminou em \d+º|Você abandonou/)).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Lances da corrida');
  await expect(page.getByRole('main')).toContainText(new RegExp(`de ${lances.length}`));
  await expect(page.getByText('Decidido pelo piloto')).toHaveCount(0);
  expect(erros).toEqual([]);
});
