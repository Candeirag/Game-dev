# Valores gravados da simulação

`simulation.json` guarda o resumo numérico das carreiras de referência (ver
`tests/regression/digest.ts`): depois de cada etapa e de cada virada de
temporada, o resultado da corrida, os pontos, as finanças, a reputação e um
hash do estado inteiro da carreira, sem os textos por extenso.

`tests/regression.test.ts` joga as mesmas carreiras e compara com este arquivo.
Se um número mudar sem querer, o teste aponta o primeiro ponto que divergiu.

## Quando regravar

Só quando a mudança de comportamento for proposital (uma regra nova, um ajuste
de balanceamento, um campo novo no estado da carreira):

```
UPDATE_GOLDEN=1 npx vitest run tests/regression.test.ts
```

Explique no PR o que mudou e por quê.

## Conferência da reformulação visual

Em 14/11/2026 o mesmo resumo foi rodado em três versões do código, com as
mesmas sementes: `d5a0199` (antes da rodada de usabilidade), `39c9e0d` (antes
da reformulação visual) e a versão com o Painel novo. Foram 87 pontos de
conferência em cinco categorias (kart regional, nacional e internacional,
Fórmula 4 e Fórmula 2), e nenhum número diferiu. Os valores gravados aqui são
os dessa conferência.
