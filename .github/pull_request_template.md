## O que muda

<!-- Uma ou duas frases. Cite a issue: "Closes #N". -->

Closes #

## Como foi verificado

- [ ] `npm run check` passou (lint, tipos, testes e navegador)
- [ ] Testado em 844×390 e 390×844 (prints na horizontal abaixo, se a interface mudou)
- [ ] Um save antigo abre e continua jogável

<!-- Cole aqui o resumo da saída do `npm run check`. -->

## Simulação e saves

- [ ] Não muda resultados, pontos nem finanças (`tests/regression.test.ts` sem regravar)
- [ ] Muda de propósito: valores regravados e explicados abaixo
- [ ] Mudou o formato do save: versão nova, migração, saves da versão nova gravados e degrau testado

<!--
Mexeu em regra de jogo? Rode `npm run sim -- --seeds 50 --seasons 15` e cole o relatório aqui,
com o que mudou em relação ao da fase anterior (docs/simulador/). Sem mudança de regra, o
relatório tem de sair idêntico: diga isso.
-->

## O que ficou de fora

<!-- O que não entrou neste PR e por quê. -->
