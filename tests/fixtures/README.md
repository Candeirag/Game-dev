# Saves de exemplo

Uma pasta por versão do formato do save (`CAREER_SCHEMA_VERSION`). São arquivos de verdade: o
mesmo envelope que o jogo exporta, com checksum.

- **Os das versões antigas são registros.** Foram gravados pelo jogo daquela época e nunca são
  regravados: é com eles que os testes provam que um save antigo abre, migra e continua jogável
  (`tests/regression.test.ts`, `tests/save.test.ts`, `tests/phase3.test.ts` e, no navegador,
  `e2e/`). `tests/fixtures.test.ts` falha se um arquivo não for da versão da pasta em que está.
- **Os da versão atual saem de receitas** em `tests/fixtures.test.ts`. Quando o formato mudar:

  ```
  UPDATE_FIXTURES=1 npx vitest run tests/fixtures.test.ts
  ```

  O comando grava a pasta da versão nova; as anteriores ficam como estão.

| Pasta | Gravados por | O que há |
| ----- | ------------ | -------- |
| `v1`  | Fase 1 (kart regional, um campeonato) | No meio de um fim de semana, temporada terminada, segunda temporada. |
| `v2`  | Fase 2 (carreira completa) | Kart no meio do fim de semana, com eventos pendentes, fechamento de temporada, monoposto no meio do ano. |
| `v3`  | Fase 3 e reformulação visual | Kart na largada e no fim de temporada, em três momentos do código (`antes-da-usabilidade`, `antes-da-reformulacao`, `atual`); e os três `fase0-*`, gravados com o código de antes dos nomes próprios das categorias (`ffc04a9`): monoposto com academia de nome antigo, topo da escada no fim da temporada e dirigente dono de equipe. |
| `v4`  | Fase 0 da grande atualização | Kart na largada, monoposto no fim da temporada, dirigente no meio da temporada, dirigente no fechamento com patrimônio (ações, imóvel, empresa, empréstimo) e sucessão em aberto. |
| `v5`  | Fase 1 da grande atualização | As mesmas situações da `v4`, com o retrato das temporadas (`seasonTrend`). Sem nascimento: abrem com `birth: null`. |
| `v6`  | Fase 2 da grande atualização | As mesmas situações, agora com nascimento sorteado, e `nascimento-mudanca-pendente`: estreante nascido no interior depois da segunda etapa, com a mudança para São Paulo pendente e o traço de estreia revelado. |
| `v7`  | Fase 3 da grande atualização | As mesmas situações da `v6`, com o polo em que o piloto mora, o investidor, a vaquinha, o trabalho paralelo e a conta das temporadas sem porta, já sob a economia nova (vaga de aluguel paga, viagens, equipamento, patrocinadores em escada). |
| `v8`  | Fase 4 da grande atualização | As mesmas situações da `v7`, com os lances decisivos de cada corrida (`race.moments`) e o registro dos toques que criaram rivalidade (`relations.rivalryLog`), já sob a curva de pneus nova. Nesses o robô não responde aos lances (o piloto decide pelo estilo). E `lances-com-toque-e-rivalidade`: estreante que respondeu a todos os lances da primeira etapa pela opção mais arriscada e tocou num rival (a rivalidade nasce ali), e na segunda etapa deixou o piloto decidir. |
| `v9`  | Fase 5 da grande atualização | As mesmas situações da `v8`, com a memória das histórias (`story`: textos vistos, marcas, pessoas e cadeias) e os cartões encadeados pendentes. E dois novos: `historia-rival-do-kart-nas-formulas`, com o rival nascido no kart (cadeia "Velho conhecido") de volta no grid das fórmulas e a cadeia no meio; e `cartao-com-escolha-de-traco`, com um cartão pendente que tem uma escolha liberada por traço ou por carisma. |

Os arquivos `fase0-*` e os da `v4` em diante estão sem indentação, para pesarem menos. Abrem do mesmo jeito.
