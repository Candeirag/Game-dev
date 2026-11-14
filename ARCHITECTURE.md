# Arquitetura: Apex Motorsport Dynasty

Este documento descreve como o código está organizado, por quê, e como estendê-lo sem quebrar as garantias do projeto. Ele cobre a Fase 2 (carreira completa do kart à Fórmula 1).

## Princípios

1. **As regras do jogo vivem no motor (`src/engine`), nunca na interface.** Componentes React só exibem dados e disparam ações. Nenhum componente calcula tempo de volta, pontos, propostas, impostos ou desfecho de evento.
2. **Estado imutável e funções puras.** Toda transição é `(estado, decisão) → novo estado`. O motor não lê relógio, rede nem `Math.random()`.
3. **Variabilidade controlada.** Toda aleatoriedade passa por um gerador com semente (`src/engine/rng.ts`), e cada sorteio tem a sua própria semente derivada da carreira.
4. **Uma fonte de verdade.** Os tipos TypeScript são inferidos dos schemas Zod, que também validam os saves. A classificação do campeonato nunca é armazenada: é recalculada dos resultados e dos ajustes de pontos.
5. **Regras como dados.** O motor não tem `if` por categoria: cada categoria é uma definição em `src/data/categories.ts` (regras de corrida, economia, requisitos), e os efeitos de cada evento são dados guardados junto com ele.
6. **Sistemas que conversam em um só lugar.** Os efeitos de uma etapa sobre economia, condição, licença, relações, patrocinadores, evolução, mercado e eventos são aplicados por uma única sequência ordenada (`roundEffects.ts`).

## Camadas

```
┌───────────────────────────────────────────────────────────────┐
│ src/ui            React: telas, componentes, formatação       │
│   ↓ lê estado / dispara ações                                 │
│ src/store         Zustand: estado atual, corrida ao vivo,     │
│                   autosave                                    │
│   ↓ chama                                   ↓ chama           │
│ src/engine        Motor (puro)        src/persistence  Saves  │
│   ↓ usa                                     ↓ usa             │
│ src/domain        Schemas e tipos (Zod) + rótulos             │
│ src/data          Dados estáticos (categorias, equipes,       │
│                   pilotos, pistas, nomes)                     │
└───────────────────────────────────────────────────────────────┘
```

As dependências só apontam para baixo. `engine` não conhece React nem Zustand. `persistence` depende do motor só para validar e migrar saves.

## Mapa de diretórios

| Caminho | Responsabilidade |
| --- | --- |
| `src/domain/schemas.ts` | Schemas Zod e tipos de todo o modelo: piloto, equipe, sessões, resultados, contrato, propostas, finanças, patrocinadores, licença, relações, eventos e efeitos, carreira. Versão do schema do save. |
| `src/domain/labels.ts` | Textos em português compartilhados pelo motor (mensagens) e pela UI. |
| `src/data/categories.ts` | As sete categorias: regras de corrida, nível do grid, economia, requisitos e pontos de licença. |
| `src/data/teams.ts`, `drivers.ts`, `tracks.ts`, `names.ts`, `rules.ts` | Equipes de todas as categorias, elenco inicial do kart regional, 34 pistas, nomes para pilotos gerados, perfis iniciais do jogador. |
| `src/engine/rng.ts` | PRNG mulberry32, derivação de sementes (FNV-1a), gaussiana saturada. |
| `src/engine/simulation/constants.ts` | Todas as constantes de calibragem da simulação, comentadas. |
| `src/engine/simulation/performance.ts` | Modelo de desempenho: ritmo, tempo de volta, ruído, erros, desgaste, compostos, combustível, dano, condição do piloto. |
| `src/engine/simulation/weather.ts`, `practice.ts`, `qualifying.ts` | Clima do fim de semana, treino livre e classificação (sessão única ou eliminatória; punições de grid). |
| `src/engine/simulation/race/` | **Motor de corrida**, independente da carreira e da interface (ver abaixo). |
| `src/engine/ai/decisions.ts` | Decisões da IA por regras: treino, classificação, ritmo de corrida, foco de treino. |
| `src/engine/championship/` | Pontuação por categoria e classificação com desempate e ajustes de pontos. |
| `src/engine/world/generation.ts` | Geração de pilotos e grids por regras, para as categorias sem elenco escrito à mão. |
| `src/engine/career/` | Carreira: criação, fim de semana, efeitos da etapa, condição e lesões, economia, patrocinadores, licença, contratos e negociação, mercado, evolução e envelhecimento, fechamento e virada de temporada, estatísticas. |
| `src/engine/events/` | Eventos dinâmicos: catálogo (`definitions.ts`), geração e resolução (`engine.ts`), aplicação de efeitos (`effects.ts`). |
| `src/engine/index.ts` | API pública do motor; a UI e a store importam só daqui. |
| `src/persistence/` | Armazenamento (IndexedDB, localStorage, memória), checksum, integridade, migrações e serviço de saves. |
| `src/store/gameStore.ts` | Store Zustand: camada fina sobre o motor. |
| `src/ui/` | Layout, telas, componentes e formatação. |
| `tests/` | Testes Vitest; `tests/fixtures/v1/` guarda saves reais da Fase 1; `tests/calibration/` guarda o relatório de balanceamento. |
| `legacy/simdev/` | Projeto anterior do repositório, preservado e fora do build. |

## Motor de corrida (`src/engine/simulation/race/`)

O motor recebe um `RaceContext` (pista, definição da categoria, pilotos, equipes) e um grid, e não conhece `CareerState`. Os testes o usam direto, com grids montados à mão (`tests/raceSetup.ts`).

| Arquivo | Conteúdo |
| --- | --- |
| `types.ts` | `RaceSimState`, `RaceCar`, `RaceContext`, `PlayerRaceInput`, `StrategyPlan`. Tudo é dado simples. |
| `weatherProfile.ts` | Umidade da pista em cada volta e previsão (com erro) para o jogador. |
| `strategy.ts` | Opções de estratégia de pneus, escolha da IA e decisão de box a cada volta. |
| `step.ts` | `createRaceSim`, `stepRaceLap`, `simulateRemainingRace`: uma volta por chamada. |
| `finalize.ts` | Resultado oficial: punições em tempo, regra dos dois compostos, pontuação. |

Ordem de cada volta em `stepRaceLap`:

```
0. Clima da volta; resposta do jogador a uma ordem de equipe pendente.
1. Cada carro: modo de pilotagem (jogador ou IA), decisão de box, tempo de
   volta em pista livre (ritmo, composto, desgaste, combustível, dano,
   condição), incidentes (quebra, erro, rodada, batida, lesão), parada,
   desgaste e consumo.
2. Posições: disputas em bandeira verde; fila atrás do safety car; posições
   congeladas sob safety car virtual. Carros que rodaram ou pararam são
   passados sem disputa.
3. Consequências: danos, punições, abandonos.
4. Direção de prova: safety car, safety car virtual ou bandeira vermelha
   conforme os incidentes; relargada lançada ou parada.
5. Ordens de equipe para a volta seguinte.
```

A entrada do jogador (`PlayerRaceInput`) traz o ritmo, um pedido de parada com composto, o cancelamento da parada planejada, a resposta a uma ordem de equipe e a opção de engenheiro automático (o motor decide paradas e protege o combustível pelas regras da IA).

## Fluxo de uma etapa

```
startWeekend({rest?})  → define os inscritos (titulares disponíveis; o reserva
                         substitui quem está lesionado ou suspenso)
runPractice(p)         → acerto e modificadores do fim de semana     (autosave)
runQualifying(a)       → grid, já com punições de grid               (autosave)
playerStrategyOptions  → estratégias de pneus para o jogador escolher
createWeekendRace(pl)  → RaceSimState (fica na store, não no save)
stepRaceLap × N        → a UI reproduz volta a volta
completeWeekend        → resultado oficial gravado
  └ applyRoundEffects  → 1 economia · 2 condição e lesões · 3 licença ·
                         4 relações · 5 patrocinadores · 6 evolução ·
                         7 mercado · 8 eventos · 9 mensagens          (autosave)
  └ closeSeason        → só na última etapa: reputação, licença, contas do
                         ano, contrato, academia e propostas
```

Eventos pendentes bloqueiam `startWeekend` até serem resolvidos com `resolveEvent`. No fim da temporada, o estado fica em `career.offseason` (propostas negociáveis) até `startNextSeason(offerId)`, que troca equipe ou categoria, roda o mercado da IA, envelhece e desenvolve os pilotos, evolui as equipes e monta o novo calendário.

A corrida em andamento não é salva. Se a página for recarregada no meio da prova, a corrida recomeça da largada com a mesma semente.

## Determinismo e isolamento da sorte

- `hashSeed(seed, temporada, etapa, 'qualifying')` gera a semente de cada sessão.
- Na corrida, cada piloto em cada volta usa `hashSeed(semente, volta, piloto)`; cada disputa, cada decisão da direção de prova e cada ordem de equipe têm semente própria.
- Lesões, evolução, envelhecimento, retorno de investimentos, geração de pilotos e desfecho de eventos usam sementes derivadas da carreira e do contexto (`hashSeed(seed, evento, escolha)`).
- Todos os sorteios de um piloto em uma volta acontecem sempre, na mesma ordem.

Consequência: as decisões do jogador mudam médias e probabilidades, mas não embaralham a sorte dos outros; recarregar o save não muda o desfecho de uma mesma decisão; e uma carreira inteira de vários anos é reproduzível (há um teste que compara o checksum de duas execuções).

## Modelo de dados da carreira

`CareerState` guarda a categoria atual e o seu mundo: equipes, pilotos (titulares, reservas e livres), calendário, etapas da temporada e fim de semana em andamento. Sobre isso ficam os sistemas da carreira: `contract`, `finance`, `sponsors`, `academy`, `license`, `relations`, `marketInterest`, `pendingEvents`, `eventLog`, `adjustments`, `gridPenalties`, `offseason` e `history`.

Só a categoria que o jogador disputa é simulada. Ao mudar de categoria, o grid da nova é gerado por regras (`world/generation.ts`) e os melhores rivais da categoria anterior sobem junto, para as rivalidades continuarem. As equipes das outras categorias vêm dos dados estáticos e servem para calcular interesse e propostas.

As temporadas arquivadas em `history` são compactadas (`compactRound`): ficam resultado e grid; a narração volta a volta é descartada. Uma carreira de 12 temporadas ocupa cerca de 1,2 MB.

## Persistência e compatibilidade

`saveCareer` e `loadCareer` (`src/persistence/saveService.ts`) aplicam quatro camadas:

1. **Envelope** com formato, versão, data, resumo e checksum.
2. **Checksum** cyrb53 sobre a serialização canônica da carreira, conferido antes de qualquer migração.
3. **Migração** (`migrations.ts`): converte saves antigos, versão a versão. Saves de versões futuras são recusados.
4. **Validação**: schema Zod mais `validateCareerIntegrity` (referências, dois titulares e no máximo um reserva por equipe, contrato coerente com equipe, categoria e papel, calendário do tamanho da categoria, resultados batendo com o progresso, fechamento presente exatamente quando a temporada acabou, probabilidades dos eventos somando 1).

Toda gravação faz antes a ida e volta (serializa e valida) e guarda a versão anterior do slot como backup, na mesma transação.

**Compatibilidade com a Fase 1.** O schema subiu da versão 1 para a 2. A migração `1 → 2` transforma um save antigo em uma carreira no kart regional: renomeia `kart` para `car` nas equipes, define papéis e reservas, cria contrato, finanças, licença (a partir do histórico) e relações no estado inicial, completa os campos novos dos resultados e, se o save estava parado no fim da temporada, roda o fechamento que antes não existia. `tests/fixtures/v1/` contém três saves gravados pelo código da Fase 1 (no meio de um fim de semana, com a temporada terminada e na segunda temporada), e os testes verificam que eles abrem, validam e continuam jogáveis.

## Como estender

**Nova categoria.** Acrescente a definição em `categories.ts` (e o id em `CATEGORY_IDS`), as equipes em `teams.ts` e as pistas em `tracks.ts`. O motor de corrida, o mercado, os contratos e a economia leem tudo da definição.

**Nova regra de corrida.** Acrescente o campo em `RaceRules`, o comportamento em `race/step.ts` (ou `strategy.ts`), as constantes em `constants.ts` e um teste em `tests/raceEngine.test.ts` usando `raceSetup`.

**Novo evento.** Acrescente uma entrada em `EVENT_DEFINITIONS` com a condição (`build` devolve `null` quando não vale) e as escolhas. Use os efeitos existentes; se precisar de um efeito novo, acrescente a variante em `EffectSchema`, o caso em `effects.ts` e suba a versão do schema se o formato de dados já gravados mudar.

**Novo campo no save.** Suba `CAREER_SCHEMA_VERSION`, registre a migração em `MIGRATIONS`, gere uma fixture com a versão anterior e acrescente o teste de compatibilidade.

**Rebalanceamento.** Ajuste constantes ou dados e rode `npm run calibrate`: ele simula 12 carreiras de 14 temporadas com um robô e imprime as trajetórias, as estatísticas de corrida por categoria e o desvio do nível dos grids.

## Qualidade

- `npm run typecheck`: TypeScript estrito (`strict`, `noUncheckedIndexedAccess`), sem `any`.
- `npm test`: 121 testes.
  - `raceEngine.test.ts`: pneus, combustível, clima, estratégia, boxes, safety car, safety car virtual, bandeira vermelha, punições, regra dos dois compostos, ordens de equipe, classificação eliminatória, todas as categorias.
  - `simulation.test.ts`, `championship.test.ts`: modelo de desempenho, sessões, pontuação por categoria, ajustes.
  - `systems.test.ts`: economia, impostos, investimentos, condição, lesões, suspensão, licença, reputação, contratos, negociação, patrocinadores, mercado, eventos e cada tipo de efeito.
  - `career.test.ts`, `multiSeason.test.ts`: temporada completa, virada de ano, e carreiras de 12 a 14 temporadas com verificação de integridade em todo fechamento, determinismo, faixas de equilíbrio e nível dos grids.
  - `save.test.ts`: ida e volta, IndexedDB, adulteração, backup, e os saves reais da Fase 1.
- `npm run build`: checagem de tipos e build de produção.
