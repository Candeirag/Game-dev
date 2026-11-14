# Arquitetura: Apex Motorsport Dynasty

Este documento descreve como o código está organizado, por quê, e como estendê-lo sem quebrar as garantias do projeto. Ele cobre o estado atual, depois da Fase 3: carreira completa do kart à Fórmula 1, patrimônio pessoal, família e dinastia, aposentadoria, gestão de equipe, morte e sucessão.

## Princípios

1. **As regras do jogo vivem no motor (`src/engine`), nunca na interface.** Componentes React só exibem dados e disparam ações. Nenhum componente calcula tempo de volta, pontos, propostas, impostos ou desfecho de evento.
2. **Estado imutável e funções puras.** Toda transição é `(estado, decisão) → novo estado`. O motor não lê relógio, rede nem `Math.random()`.
3. **Variabilidade controlada.** Toda aleatoriedade passa por um gerador com semente (`src/engine/rng.ts`), e cada sorteio tem a sua própria semente derivada da carreira.
4. **Uma fonte de verdade.** Os tipos TypeScript são inferidos dos schemas Zod, que também validam os saves. A classificação do campeonato nunca é armazenada: é recalculada dos resultados e dos ajustes de pontos.
5. **Regras como dados.** O motor não tem `if` por categoria: cada categoria é uma definição em `src/data/categories.ts` (regras de corrida, economia, requisitos), e os efeitos de cada evento são dados guardados junto com ele.
6. **Sistemas que conversam em um só lugar.** Os efeitos de uma etapa sobre economia, condição, licença, relações, patrocinadores, evolução, mercado e eventos são aplicados por uma única sequência ordenada: `roundEffects.ts` quando o jogador corre, `management/executive.ts` quando ele dirige.
7. **A carreira é da família.** O estado guarda um "personagem atual" (o piloto do jogador), a família dele e a linhagem. Aposentadoria e morte trocam o modo ou o personagem; nunca encerram o save.

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
| `src/domain/money.ts`, `text.ts` | Formatação de dinheiro (a única do jogo: símbolo pela nacionalidade do piloto, sem conversão de valores) e plurais. O motor escreve os valores com `money(career, valor)`; a interface, com `formatMoney` de `src/ui/format.ts`, que segue a moeda da carreira aberta. |
| `src/data/categories.ts` | As sete categorias: regras de corrida, nível do grid, economia, requisitos e pontos de licença. |
| `src/data/teams.ts`, `drivers.ts`, `tracks.ts`, `names.ts`, `rules.ts` | Equipes de todas as categorias, elenco inicial do kart regional, 34 pistas, nomes para pilotos gerados, perfis iniciais do jogador. |
| `src/data/assets.ts` | Catálogo do patrimônio: ações, imóveis, empresas, padrão de vida e as regras de crédito, impostos sobre ganho e herança. |
| `src/data/family.ts` | Regras da família: traços de personalidade, herança de talento, formação no kart, apoio à carreira dos filhos, tábua de mortalidade. |
| `src/data/management.ts` | Economia das equipes por categoria, regulamento técnico (áreas abertas, limites, teto de gastos), efeito de cada melhoria e regras da gestão. |
| `src/engine/rng.ts` | PRNG mulberry32, derivação de sementes (FNV-1a), gaussiana saturada. |
| `src/engine/simulation/constants.ts` | Todas as constantes de calibragem da simulação, comentadas. |
| `src/engine/simulation/performance.ts` | Modelo de desempenho: ritmo, tempo de volta, ruído, erros, desgaste, compostos, combustível, dano, condição do piloto. |
| `src/engine/simulation/weather.ts`, `practice.ts`, `qualifying.ts` | Clima do fim de semana, treino livre e classificação (sessão única ou eliminatória; punições de grid). |
| `src/engine/simulation/race/` | **Motor de corrida**, independente da carreira e da interface (ver abaixo). |
| `src/engine/broadcast/` | **Transmissão da corrida**: traçado de cada pista (`circuit.ts`) e linha do tempo que converte os tempos do motor em posições na pista (`timeline.ts`). Puro, sem interface (ver abaixo). |
| `src/engine/ai/decisions.ts` | Decisões da IA por regras: treino, classificação, ritmo de corrida, foco de treino. |
| `src/engine/championship/` | Pontuação por categoria e classificação com desempate e ajustes de pontos. |
| `src/engine/world/generation.ts` | Geração de pilotos e grids por regras, para as categorias sem elenco escrito à mão. |
| `src/engine/career/` | Carreira: criação, fim de semana, efeitos da etapa, condição e lesões, economia, patrocinadores, licença, contratos e negociação, mercado, evolução e envelhecimento, fechamento e virada de temporada, estatísticas. |
| `src/engine/events/` | Eventos dinâmicos: catálogo (`definitions.ts`), geração e resolução (`engine.ts`), aplicação de efeitos (`effects.ts`). |
| `src/engine/economy/assets.ts` | Patrimônio pessoal: ações, imóveis, empresas, participações em equipes, empréstimos e padrão de vida; liquidação por etapa e fechamento anual. |
| `src/engine/dynasty/` | Família (`family.ts`: parceiro, filhos, herança de talento, carreira própria dos filhos), eventos de família (`familyEvents.ts`) e morte e sucessão (`succession.ts`). |
| `src/engine/management/` | Gestão de equipe (`team.ts`: estrutura, equipe técnica, instalações, pesquisa, caixa), modo dirigente (`executive.ts`: aposentadoria, etapa, fechamento, mercado de pilotos, propostas, nova temporada) e eventos de gestão (`events.ts`). |
| `src/engine/tutorial.ts` | Passos do tutorial, deduzidos do estado da carreira. |
| `src/engine/index.ts` | API pública do motor; a UI e a store importam só daqui. |
| `src/persistence/` | Armazenamento (IndexedDB, localStorage, memória; `probeStorage` testa cada um na abertura e cai para o seguinte), checksum, integridade, migrações e serviço de saves. Ao abrir um save, os textos gravados por versões anteriores têm o símbolo de moeda e os plurais acertados. `preferences.ts` guarda anotações do navegador fora dos saves (velocidade da corrida, data da última exportação) e `raceResume.ts`, os comandos da corrida em andamento. |
| `src/store/gameStore.ts` | Store Zustand: camada fina sobre o motor. Registra os comandos de cada volta da corrida (`raceSteps`) e, depois de uma recarga, refaz a corrida com eles (`resumeRace`): o motor é determinístico, então o resultado é o mesmo. |
| `src/ui/layout/` | Moldura da carreira: barra lateral no computador; no celular, cabeçalho de uma linha, navegação inferior e a folha "Mais". `chrome.tsx` deixa a tela de corrida avisar que a barra fixa de comandos (`src/ui/race/RaceControlBar.tsx`) está aberta. |
| `src/ui/` | Layout, telas, componentes e formatação. |
| `src/ui/race/` | Corrida visual: canvas (`RaceCanvas`, `raceScene`, `trackPainter`), pintura dos carros (`liveries`), relógio da reprodução (`useRacePlayback`), tela (`RaceBroadcast`) e comandos do jogador (`RaceCommands`). |
| `src/assets/race/` | Sprites vistos de cima, gerados no Higgsfield: `vehicles/` (um veículo por categoria e o safety car) e `scenery/` (arquibancada e árvore). `docs/assets/referencia-circuito.jpg` é a referência visual usada para o desenho das pistas. |
| `src/data/vehicles.ts` | Veículo de cada categoria (nome, descrição e tamanho na pista). Só aparência: regras e desempenho continuam em `categories.ts`. |
| `src/data/circuitLayouts.ts` | Traçados reais dos 14 autódromos, em metros. Arquivo gerado por `scripts/import-f1-circuits.mjs` a partir de bacinger/f1-circuits (MIT; ver `THIRD_PARTY_LICENSES.md`). |
| `src/data/kartLayouts.ts` | Traçados reais de 19 kartódromos, em metros. Arquivo gerado por `scripts/import-osm-kart-tracks.mjs` a partir das vias `highway=raceway` do OpenStreetMap guardadas em `scripts/osm-kart-tracks/` (um arquivo por kartódromo). O script escolhe a via fechada da pista ou, quando o mapa a traz em trechos e variantes, junta os trechos no percurso fechado mais longo (ou no de comprimento oficial), põe a largada na reta mais longa e segue o sentido do desenho. Dados © OpenStreetMap contributors, ODbL 1.0: os dois são bases derivadas e seguem a mesma licença. |
| `tests/` | Testes Vitest; `tests/fixtures/v1/` e `v2/` guardam saves reais das Fases 1 e 2; `tests/calibration/` guarda os relatórios de balanceamento (carreiras, vidas inteiras e economia das equipes); `tests/bench/` mede desempenho. |
| `docs/PLANO_ARQUITETURA_FASE3.md` | Análise de escala feita antes da Fase 3 (mundo com centenas de pilotos, saves em partes). É um plano futuro: a Fase 3 foi construída sobre a arquitetura atual. |
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

## Transmissão da corrida (`src/engine/broadcast/` e `src/ui/race/`)

O motor de corrida calcula uma volta inteira de cada vez. A transmissão é a camada que mostra essa corrida num circuito, sem decidir nada.

```
stepRaceLap (motor)  →  appendRaceLap (linha do tempo)  →  sampleCar / standingsAt (instante t)  →  canvas e HUD
```

- **Circuito (`circuit.ts`).** `buildCircuit(pista, veículo)` devolve o traçado em que a corrida é desenhada, sempre o mesmo para a mesma pista (fica em cache). Há dois caminhos: traçado real (autódromos e 19 kartódromos) e traçado gerado (só a pista de kart sem traçado mapeado). **Autódromos:** os pontos reais de `circuitLayouts.ts` (em metros, começando na largada e no sentido da corrida) passam por uma curva suave, são girados para deitar o traçado na tela (sem espelhar) e ampliados a 1 unidade por metro; se dois trechos vizinhos se encostariam (pista e carros são desenhados mais largos que em escala), a escala daquela pista sobe até 1,5. A área de desenho tem o tamanho do circuito, então um circuito longo é mesmo maior. Os boxes ficam do lado de dentro pelo sentido da corrida e encolhem onde falta espaço; o traçado em oito ganha um viaduto (`bridges`); as duas retas mais longas viram zonas de ultrapassagem (`zones`). **Kartódromos:** os pontos reais de `kartLayouts.ts` seguem o mesmo caminho, com três diferenças: a escala é de 3 unidades por metro (um kartódromo é umas cinco vezes menor que um autódromo; sobe até 5,7 se trechos vizinhos se encostariam), os cantos vivos que o mapa de origem deixa nas junções de trechos são relaxados até o raio mínimo de 4 m, e os boxes podem ficar do lado de fora da reta, porque o miolo costuma ocupar o lado de dentro. O comprimento usado no desenho é o do traçado mapeado; o da pista fictícia (`lengthMeters`) continua valendo para tempos, regras e velocidade em km/h. **Traçado gerado** (pista sem traçado cadastrado): sai do id e das características da pista: um polígono em torno do centro (que nunca se cruza), com miolos, grampos, esses e chicanes encaixados nas arestas longas e os cantos arredondados; o resultado é validado (nenhum trecho encosta em outro; a área dos boxes fica livre). Nos dois casos saem o pit lane, as posições do grid, os setores e o perfil de velocidade da volta (limite de cada curva, aceleração e freada; em metros nos traçados reais). As medidas são esquemáticas: carros e largura de pista são ampliados para serem visíveis; a velocidade em km/h usa o comprimento real e o tempo de volta real.
- **Linha do tempo (`timeline.ts`).** A cada volta simulada, `appendRaceLap(linha, estadoAntes, estadoDepois, contexto)` registra, para cada carro, quando a volta começa, quando ele cruza a linha (o tempo acumulado do motor) e os trechos intermediários: ritmo normal, largada parada, travessia do pit lane, parada no box, rodada, abandono. `sampleCar` responde onde o carro está num instante; `standingsAt` dá a classificação e as diferenças nesse instante; `eventsUntil` dá os eventos já acontecidos (cada evento do motor ganha o instante em que acontece na pista, e a ultrapassagem é datada no cruzamento das duas trajetórias). Bandeira vermelha vira uma suspensão; safety car, uma volta em fila.
- **Garantia.** Cada carro cruza a linha no tempo do motor, então a ordem de pista ao fim de cada volta é a do motor (`tests/broadcast.test.ts` confere isso volta a volta, com chuva, paradas, safety car e bandeira vermelha). O que a interface acrescenta é só apresentação: o lado da pista de cada carro numa disputa, um pequeno recuo para dois carros na mesma faixa não se sobreporem, a câmera e os efeitos.
- **Loja.** `raceTimeline` fica ao lado de `liveRace` e é atualizada nas mesmas ações (`beginRace`, `stepRace`, `simulateRestOfRace`). Nenhum dos dois vai para o save. `watchAbsentWeekend` simula a corrida inteira de quem não está no carro (dirigente ou piloto ausente) e entrega a linha do tempo completa para assistir.
- **Relógio (`useRacePlayback`).** O tempo de corrida avança a cada quadro (em 1×, uma volta de referência dura 24 s). Quando o líder termina a última volta simulada, o gancho chama `stepRace`: o motor fica no máximo uma volta à frente da imagem, e o HUD nunca lê o estado do motor, só a linha do tempo no instante exibido. Ordem de equipe pendente e bandeira vermelha param o relógio até o jogador responder.
- **Desenho.** A pista é vetor (`Path2D` em unidades de mundo) redesenhado a cada quadro sob a transformação da câmera; o tabuleiro do viaduto é desenhado por cima dos carros que passam por baixo. O veículo é o da categoria da corrida (`vehicleFor(categoryId)`): cada sprite branco é pintado em tempo de execução com a cor da equipe (multiplicação sobre a carroceria e, nos karts, sobre o macacão do piloto), um desenho de pintura na cor de contraste, o capacete na cor do piloto e o número do carro (`assignCarNumbers`, o mesmo na garagem e na corrida). Se a imagem não carregar, há um desenho em vetor. `CarSprite` e `CircuitMap` levam o mesmo veículo e o mesmo traçado para as outras telas (garagem, escada, grid, calendário, painel).

## Fluxo de uma etapa

```
startWeekend({rest?})  → define os inscritos (titulares disponíveis; o reserva
                         substitui quem está lesionado ou suspenso)
runPractice(p)         → acerto e modificadores do fim de semana     (autosave)
runQualifying(a)       → grid, já com punições de grid               (autosave)
playerStrategyOptions  → estratégias de pneus para o jogador escolher
createWeekendRace(pl)  → RaceSimState (fica na store, não no save)
stepRaceLap × N        → a transmissão mostra a corrida (cada volta entra na
                         linha do tempo; ver acima)
completeWeekend        → resultado oficial gravado
  └ applyRoundEffects  → 1 economia · 2 condição e lesões · 3 licença ·
                         4 relações · 5 patrocinadores · 6 evolução ·
                         7 mercado · 8 eventos · 9 mensagens          (autosave)
  └ closeSeason        → só na última etapa: reputação, licença, contas do
                         ano, contrato, academia e propostas
```

Eventos pendentes bloqueiam `startWeekend` até serem resolvidos com `resolveEvent`. No fim da temporada, o estado fica em `career.offseason` (propostas negociáveis) até `startNextSeason(offerId)`, que troca equipe ou categoria, roda o mercado da IA, envelhece e desenvolve os pilotos, evolui as equipes e monta o novo calendário.

A corrida em andamento não é salva. Se a página for recarregada no meio da prova, a corrida recomeça da largada com a mesma semente.

## Modos da carreira: piloto e dirigente

`career.mode` diz o que o personagem faz. O campeonato (`teams`, `drivers`, `calendar`, `rounds`) é o mesmo nos dois modos e é sempre disputado pelo mesmo motor de corrida.

| | `driver` | `executive` |
| --- | --- | --- |
| Personagem | Tem vaga em uma equipe e corre | Está em `drivers` sem equipe: envelhece, mas não corre |
| Etapa | `applyRoundEffects` | `applyExecutiveRoundEffects`: finanças pessoais, pilotos, caixa e pesquisa da equipe, eventos de gestão |
| Fechamento | `closeSeason` → `career.offseason` (propostas de piloto) | `closeExecutiveSeason` → `career.executiveOffseason` (avaliação, mercado de pilotos, patrocínios, cargos, equipes à venda) |
| Novo ano | `startNextSeason(offerId)` | `startExecutiveSeason(plan)`: continuar, aceitar cargo, comprar, fundar ou ficar sem equipe |
| Equipe | A do contrato | `career.management` (ou nenhuma) |

`completeWeekend` escolhe o caminho pelo modo. `retireFromDriving` passa de `driver` a `executive`: no fechamento, converte o fechamento de piloto no de dirigente; no meio da temporada, o reserva assume o carro (`vacatePlayerSeat`) e o jogador acompanha o resto do ano.

A equipe administrada é uma das equipes do campeonato. A gestão nunca toca o motor de corrida: ela muda `team.car` (melhorias de pesquisa) e `team.crew` (mecânicos e chefias) por regras, e o motor lê esses números como os de qualquer equipe. As rivais evoluem o mesmo a cada etapa; na virada do ano (ou quando o jogador deixa a equipe), essa evolução é descontada de todos (`normalizeFieldDevelopment`). Entre as temporadas, `evolveTeams` puxa cada equipe para o carro de referência da posição em que ela terminou, soma a variação de projeto do ano e, a cada cinco temporadas, a mudança de regulamento: a escada de carros fica estável por décadas.

### Fechamento de um ano, nos dois modos

```
closeSeason / closeExecutiveSeason
  ├ closeAssetsYear       dividendos, imóveis, empresas, participações, empréstimos
  ├ closeSeasonFinance    imposto de renda, fundos, juros do caixa negativo
  ├ acerto de dívidas     execução de bens, venda forçada da equipe, perdão
  │                       (dirigente: aqui; piloto: em startNextSeason)
  ├ closeFamilyYear       temporada dos filhos, aniversários, relação do casal
  ├ touchLineage          registro do personagem na linhagem
  └ checkMortality        sorteio anual; se morrer, abre a sucessão
startNextSeason / startExecutiveSeason
  └ beginSeasonFamily     eventos de família do ano (parceiro, casamento,
                          filhos, crise, kart, início de carreira)
```

### Sucessão

`career.succession` não nulo bloqueia o jogo (`startWeekend`, `startNextSeason` e `startExecutiveSeason` recusam) até `resolveSuccession(heirId, caminho)`:

- **`driver`**: o herdeiro vira o piloto do jogador. A temporada em curso é arquivada, o grid da categoria dele é montado e uma nova temporada começa. Uma equipe da família vira participação de 100% (`finance.stakes`).
- **`executive`**: o herdeiro assume o patrimônio e, se a família for dona, a equipe. O campeonato em curso continua.

Há sempre um parente jovem que corre e um parente adulto entre os herdeiros, para a carreira nunca ficar sem continuação.

### Filhos fora e dentro do campeonato

Os filhos correm fora do campeonato do jogador: a temporada de cada um é estimada (`closeChildSeason`) com as mesmas grandezas do jogo (nota do piloto, nível do grid, força da equipe, pontos de licença, reputação, requisitos de promoção) e a mesma função de evolução dos demais pilotos. Quando o jogador escala um filho na própria equipe, o piloto dele entra em `career.drivers` e o resultado da temporada passa a ser o real.

## Determinismo e isolamento da sorte

- `hashSeed(seed, temporada, etapa, 'qualifying')` gera a semente de cada sessão.
- Na corrida, cada piloto em cada volta usa `hashSeed(semente, volta, piloto)`; cada disputa, cada decisão da direção de prova e cada ordem de equipe têm semente própria.
- Lesões, evolução, envelhecimento, retorno de investimentos, cotações das ações, geração de pilotos e de filhos, temporadas dos filhos, mortalidade e desfecho de eventos usam sementes derivadas da carreira e do contexto (`hashSeed(seed, evento, escolha)`).
- Todos os sorteios de um piloto em uma volta acontecem sempre, na mesma ordem.

Consequência: as decisões do jogador mudam médias e probabilidades, mas não embaralham a sorte dos outros; recarregar o save não muda o desfecho de uma mesma decisão; e uma carreira inteira de vários anos, incluindo aposentadoria, gestão e sucessão, é reproduzível (há testes que comparam duas execuções).

## Modelo de dados da carreira

`CareerState` guarda a categoria atual e o seu mundo: equipes, pilotos (titulares, reservas e livres), calendário, etapas da temporada e fim de semana em andamento. Sobre isso ficam os sistemas da carreira: `contract`, `finance` (com ações, imóveis, empresas, participações e empréstimos), `sponsors`, `academy`, `license`, `relations`, `marketInterest`, `pendingEvents`, `eventLog`, `adjustments`, `gridPenalties`, `offseason` e `history`; e os da Fase 3: `mode`, `family`, `dynasty`, `management`, `executiveOffseason`, `executiveLog`, `succession` e `tutorial`.

Só a categoria que o jogador disputa é simulada. Ao mudar de categoria, o grid da nova é gerado por regras (`world/generation.ts`) e os melhores rivais da categoria anterior sobem junto, para as rivalidades continuarem. As equipes das outras categorias vêm dos dados estáticos e servem para calcular interesse e propostas.

As temporadas arquivadas em `history` são compactadas (`compactRound`): ficam resultado e grid; a narração volta a volta é descartada. Das temporadas mais antigas que as seis últimas, cada etapa guarda só o pódio e os resultados dos pilotos da família (`trimHistory`); a classificação final continua completa. Uma carreira de 12 temporadas ocupa cerca de 1,2 MB, e uma de 60, cerca de 1,8 MB.

## Persistência e compatibilidade

`saveCareer` e `loadCareer` (`src/persistence/saveService.ts`) aplicam quatro camadas:

1. **Envelope** com formato, versão, data, resumo e checksum.
2. **Checksum** cyrb53 sobre a serialização canônica da carreira, conferido antes de qualquer migração.
3. **Migração** (`migrations.ts`): converte saves antigos, versão a versão. Saves de versões futuras são recusados.
4. **Validação**: schema Zod mais `validateCareerIntegrity` (referências, dois titulares e no máximo um reserva por equipe, contrato coerente com equipe, categoria e papel quando o jogador corre, calendário do tamanho da categoria, resultados batendo com o progresso, fechamento do modo certo presente exatamente quando a temporada acabou, probabilidades dos eventos somando 1, equipe administrada existente e da categoria atual, pesquisa somando 100%, linhagem terminando no personagem atual, sucessão com herdeiro possível).

Toda gravação valida antes a carreira (integridade e o mesmo schema usado na leitura) e guarda a versão anterior do slot como backup, na mesma transação. A validação não passa mais pela ida e volta completa por JSON, que dobrava o tempo de cada gravação automática em saves longos (174 ms → 74 ms em um save de 2,5 MB) sem detectar nada a mais.

**Compatibilidade com a Fase 2.** O schema subiu da versão 2 para a 3. A migração `2 → 3` só acrescenta dados: patrimônio vazio com as cotações iniciais, família vazia, linhagem de uma geração, modo `driver`, sem gestão nem sucessão, e tutorial dispensado para quem já tinha carreira. Ela não chama o motor do jogo, então não muda com o balanceamento. `tests/fixtures/v2/` contém quatro saves gravados pelo código da Fase 2 (no meio de um fim de semana, entre etapas, no fechamento de temporada e em um monoposto no meio do ano); os testes conferem que pilotos, equipes, resultados, contrato, caixa e histórico saem iguais da migração e que a carreira continua jogável. Um save da Fase 2 com a carreira "encerrada" pode voltar como dirigente.

**Compatibilidade com a Fase 1.** O schema tinha subido da versão 1 para a 2. A migração `1 → 2` transforma um save antigo em uma carreira no kart regional: renomeia `kart` para `car` nas equipes, define papéis e reservas, cria contrato, finanças, licença (a partir do histórico) e relações no estado inicial, completa os campos novos dos resultados e, se o save estava parado no fim da temporada, roda o fechamento que antes não existia (depois de todas as migrações, com os dados já no formato atual). `tests/fixtures/v1/` contém três saves gravados pelo código da Fase 1 (no meio de um fim de semana, com a temporada terminada e na segunda temporada), e os testes verificam que eles abrem, validam e continuam jogáveis.

## Como estender

**Nova categoria.** Acrescente a definição em `categories.ts` (e o id em `CATEGORY_IDS`), as equipes em `teams.ts` e as pistas em `tracks.ts`. O motor de corrida, o mercado, os contratos e a economia leem tudo da definição.

**Nova regra de corrida.** Acrescente o campo em `RaceRules`, o comportamento em `race/step.ts` (ou `strategy.ts`), as constantes em `constants.ts` e um teste em `tests/raceEngine.test.ts` usando `raceSetup`.

**Novo evento.** Acrescente uma entrada em `EVENT_DEFINITIONS` com a condição (`build` devolve `null` quando não vale) e as escolhas. Use os efeitos existentes; se precisar de um efeito novo, acrescente a variante em `EffectSchema`, o caso em `effects.ts` e suba a versão do schema se o formato de dados já gravados mudar.

**Novo campo no save.** Suba `CAREER_SCHEMA_VERSION`, registre a migração em `MIGRATIONS` (só transformação de dados, sem chamar o motor), gere uma fixture com a versão anterior e acrescente o teste de compatibilidade.

**Novo ativo, traço de personalidade ou função da equipe técnica.** São dados: `data/assets.ts`, `data/family.ts`, `data/management.ts`. Um ativo com regra própria (como a residência fiscal) declara o benefício no catálogo e aplica a regra no ponto em que ela age.

**Nova decisão de dirigente.** Acrescente a função em `management/team.ts` ou `executive.ts`, exporte pela API do motor, exponha na store com `action(...)` e use na tela. Se for um evento, acrescente um construtor em `management/events.ts`.

**Rebalanceamento.** Ajuste constantes ou dados e rode `npm run calibrate`. Ele imprime os relatórios de balanceamento: 12 carreiras de 14 temporadas com um robô (trajetórias, estatísticas de corrida por categoria e desvio do nível dos grids); 4 vidas de 70 temporadas (piloto, dirigente, família e sucessões, com verificação de integridade a cada passo); o resultado previsto e o ritmo de desenvolvimento das equipes por categoria e força (`teams.calib.ts`); o destino de € 100 milhões em 40 temporadas por estratégia de investimento (`economy.calib.ts`); e a saúde do mundo em 60 temporadas por categoria (`world.calib.ts`: nível e idade dos pilotos, carros e variedade de campeões). Roda também dois testes de estresse: `fuzz.calib.ts` (12 vidas de 45 temporadas com políticas variadas, aposentadorias no meio do ano, acidentes fatais e passagens de comando) e `monkey.calib.ts` (16 jogadores que chamam ações do motor ao acaso por 1.500 passos cada, com argumentos válidos e inválidos). Os dois conferem schema, integridade e ida e volta do save a cada passo. Foi com essas ferramentas que a auditoria do MVP achou os problemas de economia de longo prazo, de evolução das equipes e de sucessão.

## Qualidade

- `npm run typecheck`: TypeScript estrito (`strict`, `noUncheckedIndexedAccess`), sem `any`.
- `npm test`: 215 testes.
  - `raceEngine.test.ts`: pneus, combustível, clima, estratégia, boxes, safety car, safety car virtual, bandeira vermelha, punições, regra dos dois compostos, ordens de equipe, classificação eliminatória, todas as categorias.
  - `simulation.test.ts`, `championship.test.ts`: modelo de desempenho, sessões, pontuação por categoria, ajustes.
  - `systems.test.ts`: economia, impostos, investimentos, condição, lesões, suspensão, licença, reputação, contratos, negociação, patrocinadores, mercado, eventos e cada tipo de efeito.
  - `career.test.ts`, `multiSeason.test.ts`: temporada completa, virada de ano, e carreiras de 12 a 14 temporadas com verificação de integridade em todo fechamento, determinismo, faixas de equilíbrio e nível dos grids.
  - `save.test.ts`: ida e volta, IndexedDB, adulteração, backup, e os saves reais da Fase 1.
  - `phase3.test.ts`: patrimônio (ações, imóveis, empresas, participações, empréstimos, impostos), família (herança de talento, casamento, divórcio, formação e carreira dos filhos), aposentadoria, gestão (compra, fundação, cargo, demissão, equipe técnica, instalações, caixa), desenvolvimento técnico e regulamento, escalação de pilotos (inclusive filhos), morte e sucessão por todos os caminhos, saves reais da Fase 2, saves no modo dirigente, uma vida de 60 temporadas com várias gerações e o tutorial; e os casos da auditoria: dívida e execução de bens, insolvência do dirigente, empréstimo no meio do ano, revenda de equipes sem lucro, participações, salários da equipe técnica, mortalidade e gravação.
  - `broadcast.test.ts`: traçado das 34 pistas (fechado, contínuo, sem trechos sobrepostos, sempre igual), fidelidade dos 14 autódromos ao traçado real (comprimento, forma com erro abaixo de 25 m, sentido, lado dos boxes, viaduto) e dos 19 kartódromos ao traçado mapeado (forma com erro abaixo de 6 m, sentido, escala, largada numa reta, ponte da pista inglesa), perfil de velocidade, pit lane; e a linha do tempo: cada carro cruza a linha na ordem e no tempo do motor em todas as voltas (kart e monopostos, com chuva, paradas, safety car e bandeira vermelha), posição sem saltos, classificação e diferenças no meio da volta, paradas no box da equipe, abandonos, ultrapassagens no instante do evento, safety car, troca de pneus na relargada, e igualdade entre montar ao vivo e montar de uma vez.
  - `visualIdentity.test.ts`: um veículo por categoria (nenhuma criada ou removida), tamanhos crescentes na escada e compatíveis com a largura da pista, e números de carro únicos, estáveis e iguais na garagem e na corrida.
  - `raceScene.test.ts`: reproduz corridas a 60 quadros por segundo e confere a apresentação: nenhum carro salta, sai da largura da pista ou fica sobreposto a outro, em 1× e em 8×; fila única atrás do safety car.
- `npm run build`: checagem de tipos e build de produção.
