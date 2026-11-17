# Valores gravados da simulação

`simulation.json` guarda o resumo numérico das carreiras de referência (ver
`tests/regression/digest.ts`): depois de cada etapa e de cada virada de
temporada, o resultado da corrida, os pontos, as finanças, a reputação e um
hash do estado inteiro da carreira, sem os textos por extenso e sem o número
da versão do save. O rótulo de cada ponto leva o id da categoria, não o nome.
Assim, rebatizar um campeonato ou subir a versão do save não mexe neste
arquivo: se ele mudar, é porque o jogo mudou.

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
conferência em cinco categorias (kart regional, nacional e internacional, e
as hoje chamadas Fórmula Júnior e Fórmula Elite), e nenhum número diferiu. Os
valores gravados aqui são os dessa conferência.

## Fase 0 (16/11/2026): rótulos e hash

Na Fase 0 os rótulos passaram a usar o id da categoria e o hash deixou de
incluir a versão do save. Só essas duas colunas mudaram nos 65 pontos; caixa,
patrimônio, reputação, posição, pontos, classificações, resultado da última
corrida e totais do ano ficaram idênticos. O arquivo foi regravado com o
código da `main` (`ffc04a9`) mais essa mudança do resumo, e depois disso a
troca dos nomes das categorias e o save na versão 4 não o alteraram.

## Fase 2 (17/11/2026): nascimento

A regra mudou de propósito: toda carreira nova nasce com um sorteio (aptidões que mexem nos
atributos e no potencial, traços que mudam a corrida, dinheiro da família), então a carreira A
mudou inteira e o arquivo foi regravado. Para continuar passando do kart regional à Fórmula
Júnior, a carreira A usa agora o quarto sorteio da mesma semente (`birthAttempt: 3`). A carreira C
(save de Fórmula Elite da Fase 2, sem nascimento) deu os mesmos resultados, pontos, finanças e
reputação nos 10 pontos de conferência; só o hash mudou, porque o estado ganhou o campo
`birth: null`.

