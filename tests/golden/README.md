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

## Fase 4 (21/11/2026): corrida com lances e pneus

As regras da corrida mudaram de propósito, e com elas todos os resultados. O arquivo foi regravado
inteiro (65 pontos, como antes). O que mudou:

- **Curva de pneus para todos os carros.** O pneu agora aguenta, cai aos poucos e despenca no
  penhasco (`TYRE_CURVE`), e a IA passou a poupar pneu. O ritmo do pelotão inteiro é outro, do kart
  à Fórmula Elite.
- **Lances decisivos do jogador** (`RACE_MOMENTS`): até quatro por corrida, a largada sempre. O
  robô das carreiras de referência não responde a eles, e o piloto decide pelo estilo, como em
  "simular até o fim". O desfecho de um lance pode custar posição, dano, punição ou a corrida.
- **Estado novo da carreira.** Cada corrida guardada leva `race.moments` e as relações levam
  `rivalryLog`, o registro dos toques em lances que criaram rivalidade. Os dois entram no hash.

O resumo ganhou uma coluna, `lastMoments` (volta, lance, opção e desfecho de cada lance da última
corrida), para uma mudança nos lances aparecer pelo nome e não só pelo hash.

**Carreira A: semente e sorteio novos.** Com a semente de antes (`20260311`) nenhum sorteio de
nascimento, do primeiro ao décimo primeiro, mantinha o caminho do kart regional à Fórmula Júnior. O
quarto (`birthAttempt: 3`, o das Fases 2 e 3) passou a subir pelo kart internacional e só chega à
Fórmula Júnior na última virada, sem disputar nenhuma corrida de monoposto; os que disputam uma
temporada de Fórmula Júnior (0, 2, 5 e 6) sobem em seguida para a Fórmula Sprint, que o teste não
espera na lista. A carreira A usa agora a semente `20260321` no terceiro sorteio (`birthAttempt: 2`,
dentro dos sorteios gratuitos): duas temporadas no kart regional (5º e 2º), uma no kart nacional
(3º) e duas na Fórmula Júnior (14º e 11º), a segunda fechando com o caixa no vermelho. Em relação à
Fase 3 (duas no regional, duas no nacional, uma na Fórmula Júnior), há uma temporada a mais de
monoposto. Em cinco temporadas a carreira A tem dois toques em lances, os dois no `rivalryLog`.

**Carreira C** (o mesmo save de Fórmula Elite da Fase 2, sem nascimento): o save aberto tem os
mesmos números, e só o hash muda (o estado ganhou `moments: []` nas corridas guardadas e
`rivalryLog: []`). Dali em diante as nove corridas são outras: o piloto termina o ano de novo em 2º,
com 136 pontos em vez de 143, e com o caixa em 979 mil em vez de 2,10 milhões. A diferença de caixa
aparece nas etapas em que o carro sofre dano (7, 8, 10 e 11): o estilo desse piloto escolhe a linha
de dentro em oito das nove largadas, e a etapa 8 termina num abandono no lance da largada (dano
total, 406 mil a menos no caixa numa etapa só). O lance da parada (`pit`) aparece em três das nove
corridas.

## Fase 5 (23/11/2026): eventos encadeados

Os eventos mudaram de propósito, e com eles as carreiras. O arquivo foi regravado inteiro (65
pontos, como antes). O que mudou:

- **De 1 a 3 cartões por etapa, sorteados dos dados** (`src/data/events`), no lugar do catálogo
  antigo (até dois "garantidos" e um sorteado com 45% de chance). O robô continua escolhendo
  sempre a primeira opção, mas os cartões são outros e mexem em moral, confiança, dinheiro,
  patrocínio e rivalidades de outro jeito.
- **Patrocinadores por perfil**, com valor, meta e personalidade. A personalidade muda a satisfação
  por etapa (`SPONSOR_PROFILE_RULES`).
- **Estado novo da carreira.** A memória das histórias (`story`: textos vistos, marcas, pessoas e
  cadeias) entra no hash, e os cartões pendentes ganharam `storyKey`, `chain` e `speaker`.

A carreira A continua na semente `20260321`, no terceiro sorteio. Ela agora faz duas temporadas no
kart regional (8º e 2º) e uma no kart nacional (2º), sobe para a Fórmula Júnior (11º) e volta ao
kart nacional (5º). Antes eram duas na Fórmula Júnior. O caminho que o teste exige continua coberto
(a Fórmula Elite vem da carreira C).
