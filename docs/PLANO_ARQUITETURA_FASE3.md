# Plano técnico: motor de simulação profundo e escalável (Fase 3)

Análise da arquitetura atual do Apex Motorsport Dynasty e plano priorizado para levá-la a um mundo com centenas de pilotos, dezenas de equipes, várias categorias simuladas ao mesmo tempo e milhares de eventos por temporada.

Este documento é só análise e plano. Nenhuma funcionalidade foi implementada. Os números vêm de medições feitas no commit `b5c1aac` (Node 22, uma thread); a seção 9 explica como reproduzi-las.

## 1. Conclusão

A base é boa para o que ela faz hoje: o motor é puro e determinístico, não há ciclos de importação entre arquivos, os tipos e a validação dos saves têm uma única origem, e a corrida é rápida (14 ms para uma corrida de F1 de 69 voltas). O problema não é velocidade de cálculo. São quatro limites de desenho, nesta ordem de gravidade:

1. **O mundo é o jogador.** Só a categoria do jogador existe; contrato, finanças, licença, relações e patrocinadores são campos soltos do jogador em `CareerState`, e os pilotos da IA não têm nada disso. Ao mudar de categoria, o grid antigo é descartado e o novo é gerado. Não há como simular várias categorias sem remodelar os dados.
2. **O save é um bloco só, regravado e revalidado inteiro a cada clique.** Hoje são 1,4 MB e 63 ms por gravação (até trocar o foco de treino dispara uma). Com 12 campeonatos simulados, a projeção é de 14 MB e mais de 600 ms por ação.
3. **Os sistemas se conhecem diretamente.** Uma função de cerca de 150 linhas (`applyRoundEffects`) aplica nove sistemas em ordem fixa, e o passo da corrida é uma função de 575 linhas. Cada sistema novo exige editar essas duas funções.
4. **Não existe tempo.** A única unidade é "a próxima etapa do jogador". Campeonatos com calendários diferentes, janelas de mercado e prazos de contrato precisam de um calendário global e de um agendador.

A proposta é evoluir sem reescrever: manter o motor puro e determinístico, e trocar a estrutura por baixo dele em seis etapas (seção 7). A ordem importa: primeiro medir e travar o comportamento atual com testes de repetição, depois remodelar os dados, e só então trocar o formato do save, para migrar uma vez só.

**Decisões que dependem de você** estão na seção 8. A mais importante: aceitar que as categorias em que o jogador não está sejam simuladas em modo simplificado (resultado estatístico em vez de volta a volta). Sem isso, a meta de escala custa bem mais.

## 2. Meta de escala

Para o plano ter números, assumi esta meta. Ajuste se a sua for outra.

| Dimensão | Hoje | Meta |
| --- | --- | --- |
| Pilotos no mundo | 30 (20 titulares + 10 reservas) | 400 a 600 |
| Equipes | 10 (só as da categoria atual) | 60 organizações, cerca de 110 inscrições em campeonatos |
| Campeonatos simulados ao mesmo tempo | 1 | 12 a 15 |
| Corridas por temporada | 10 a 14 | cerca de 200 |
| Eventos de domínio por temporada (resultados, lesões, contratos, punições) | cerca de 300 | 5.000 ou mais |
| Eventos narrativos avaliados por temporada | cerca de 20 | centenas |
| Gravação automática | 63 ms, bloqueia a tela | menos de 30 ms, fora da tela |
| Avanço de uma semana do mundo | não existe | menos de 150 ms, fora da tela |

## 3. Estado atual

### 3.1 Tamanho e estrutura

- Motor, dados, domínio, persistência e store: 7.900 linhas. Interface: 2.700. Testes: 1.750 (121 testes).
- Maiores arquivos: `race/step.ts` (773 linhas), `domain/schemas.ts` (712), `events/definitions.ts` (441), `career/offseason.ts` (406).
- `src/engine/simulation/race/` já é independente da carreira: recebe pista, categoria, pilotos e equipes. É a parte mais reaproveitável.

### 3.2 Dependências entre áreas

Contagem de importações de valor entre áreas (script na seção 9). Não há ciclo entre arquivos, mas há três pares de áreas que dependem um do outro:

| Par | Importações | Por quê |
| --- | --- | --- |
| `career` ⇄ `events` | 2 e 6 | `roundEffects` e `offseason` chamam o motor de eventos; os eventos usam patrocinadores, caixa de entrada, seletores e economia da carreira |
| `career` ⇄ `world` | 4 e 1 | a carreira gera grids; a geração usa a tabela de treino da carreira |
| `career` ⇄ `ai` | 3 e 1 | a IA usa a tabela de treino; a carreira chama as decisões da IA |

Outras dependências que atravessam camadas:

| De | Para | Problema |
| --- | --- | --- |
| `persistence` | `engine/career`, `engine/world`, `engine/simulation` (8 importações em `migrations.ts:17-24`) | A migração 1→2 chama regras vivas do motor (`closeSeason`, `generateReserve`, `updateMarketInterest`). Mudar uma regra muda o resultado de migrar um save antigo. |
| `ui` | `data` (12 importações) | Telas leem dados estáticos direto, sem passar pelo motor. |
| `race` | `ai/decisions` | A IA é chamada de dentro do passo da corrida; o jogador é tratado à parte por comparação de id (`step.ts:212`). |
| `engine/*` | `data/categories` (23 chamadas a `getCategory`) | O motor busca dados estáticos por conta própria, em vez de recebê-los. Dificulta testes, mods e conteúdo novo. |

### 3.3 Desempenho medido

| Operação | Tempo | Observação |
| --- | --- | --- |
| Corrida de kart (22 voltas, 20 karts) | 4,1 ms | 184 µs por volta |
| Corrida de F3 (26 voltas) | 6,4 ms | |
| Corrida de F1 (69 voltas) | 14,2 ms | 206 µs por volta, cerca de 10 µs por carro por volta |
| Treino + classificação | 0,7 ms | |
| Efeitos pós-etapa (`applyRoundEffects`) | 1,7 ms | dos quais 0,7 ms são eventos |
| `updateMarketInterest` | 0,75 ms | recalcula a classificação uma vez por equipe |
| Temporada completa de F1 (14 etapas) + virada | 216 ms + 1 ms | |
| Semente + gerador por sorteio (`hashSeed` + `createRng`) | 0,6 µs | monta um texto a cada chamada (`rng.ts:45`) |
| **Gravação automática completa** | **63 ms** | integridade + checksum + ida e volta + Zod, sobre 1,4 MB |
| ↳ checksum (serialização canônica + hash) | 17,5 ms | |
| ↳ validação Zod do save inteiro | 16,4 ms | feita ao gravar e de novo ao ler |
| ↳ `JSON.stringify` | 6,2 ms | |
| Classificação, 20 pilotos e 14 etapas | 0,3 ms | |
| Classificação, 400 pilotos e 30 etapas | 19 ms | cresce de forma quadrática (`standings.ts:62`) |

Tamanho do save depois de 12 temporadas: 1.368 KB, dos quais 834 KB são o histórico (já compactado) e 469 KB são a temporada atual. Uma etapa de F1 ocupa 37,5 KB, e 24,5 KB disso são a narração da corrida em texto.

## 4. Diagnóstico por sistema

### 4.1 Pilotos

**Como é.** `Driver` (`schemas.ts:88`) tem identidade, nove atributos, potencial, foco de treino, equipe, papel, fim de contrato, condição e lesão. Tudo num objeto só, dentro de uma lista em `CareerState.drivers`.

**Limites.**
- A IA não tem contrato, salário, finanças, licença, relações nem histórico próprio. `contractEnd` e `role` são o que existe. O mercado (`market.ts:110`) simula as trocas com uma regra global, não com decisões de cada piloto e de cada equipe.
- Não há histórico de carreira da IA. As estatísticas (`stats.ts`) varrem os resultados do jogador; para qualquer outro piloto, os dados somem quando a temporada é compactada ou o grid é descartado.
- Os pilotos deixam de existir. `enterCategory` (`offseason.ts:252`) gera um grid novo e descarta o antigo, salvo quatro rivais. Os três primeiros da IA "sobem de categoria" e desaparecem.
- Um único potencial serve de teto para todos os atributos. Não há traços, adaptação por tipo de carro, nem incerteza de avaliação (o jogador vê o potencial exato dos rivais).
- A idade é um inteiro incrementado na virada do ano; não há data de nascimento.

### 4.2 Equipes

**Como é.** `Team` tem nome, cor, desempenho do carro (motor, chassi, confiabilidade), equipe de box, afiliação e meta. As equipes das outras categorias vêm de dados estáticos (`teamsOfCategory`, `market.ts:29`).

**Limites.**
- Equipe e inscrição são a mesma coisa. "Prisma Racing" na F4, na F3 e na F2 são três equipes sem ligação. Não há organização com orçamento, pessoal ou programa de base.
- As vagas não existem como entidade. O vínculo é `driver.teamId` + `driver.role`, e a integridade exige exatamente dois titulares (`integrity.ts:34`). Terceiro carro, empréstimo, troca no meio do ano e piloto reserva em outra categoria não cabem.
- O carro evolui só na virada do ano, por uma regra de até ±2 pontos. Não há desenvolvimento durante a temporada, orçamento nem regulamento.
- As equipes fora da categoria do jogador não evoluem. A F1 fica congelada até o jogador chegar.

### 4.3 Motor de corrida

**Como é.** `stepRaceLap` (`step.ts:163`) é uma função de 575 linhas com cinco blocos: decisões e tempo de volta, posições, atualização, direção de prova e ordens de equipe. O estado é uma lista de objetos `RaceCar`, copiados a cada volta.

**Pontos fortes.** Rápido, determinístico, sem dependência da carreira, com 24 testes próprios.

**Limites.**
- A função única mistura física, decisões da IA, regras de prova e texto de narração. Acrescentar um sistema (bandeira azul, retardatários, modos de motor, peças) exige mexer no meio dela.
- A IA está embutida. O piloto do jogador é um caso especial por id. Não dá para trocar a política de decisão, nem correr dois humanos, nem gravar e repetir decisões.
- A narração é texto pronto em português, gerado dentro do motor (33 mensagens em `step.ts`) e gravado no save. Isso prende o idioma, ocupa dois terços do tamanho de uma etapa e impede reprocessar a narração.
- Não há retardatários: todos completam todas as voltas, e a diferença pode passar de uma volta sem efeito.
- Um único nível de detalhe. Para simular corridas que ninguém assiste, só existe o volta a volta.
- A corrida em andamento não é gravada. Como a semente é fixa, recarregar a página permite refazer a prova já sabendo quando chove e quando entra o safety car.

### 4.4 Sistema de eventos

**Como é.** Dezenove definições em código (`definitions.ts`), cada uma com uma função `build` que devolve o evento ou `null`. A cada etapa, o motor percorre todas (`engine.ts:76` e `:85`). Os efeitos são dados gravados com o evento e aplicados por um único interpretador (`effects.ts`).

**Pontos fortes.** O modelo de efeitos como dados é o desenho certo e deve ser mantido.

**Limites.**
- Só o jogador gera e recebe eventos. Um mundo vivo precisa de eventos sobre outros pilotos e equipes (lesão do rival, troca de chefe de equipe, crise financeira).
- A avaliação é uma varredura completa: todas as definições a cada etapa. Com centenas de definições e eventos avaliados para centenas de pilotos, o custo cresce como definições × entidades × etapas.
- Não há encadeamento. Um evento não agenda outro nem guarda estado (uma polêmica que se arrasta por três etapas não é representável).
- O gatilho é sempre "depois de uma etapa do jogador". Não há eventos por data, por prazo de contrato ou por janela de mercado.
- O conteúdo está em código. Escrever eventos exige programar.
- O limite de dois eventos garantidos por etapa descarta os demais em silêncio, pela ordem do arquivo.

### 4.5 Save

**Como é.** Um envelope com a carreira inteira, checksum, validação Zod e verificação de integridade. A cada gravação: integridade, checksum, serialização, leitura de volta e validação completa (`saveService.ts:123`), depois escrita do bloco e do backup.

**Pontos fortes.** Compatibilidade testada com saves reais da versão 1; backup automático; formato validado.

**Limites.**
- Custo proporcional ao save inteiro, pago a cada ação. Quinze pontos da store disparam a gravação (`gameStore.ts`), inclusive ações triviais.
- Todo o histórico é carregado na memória e revalidado, mesmo que a tela mostre só a temporada atual.
- O backup dobra o espaço. No `localStorage` (limite de cerca de 5 MB), um save longo deixa de caber.
- A migração depende do motor vivo (seção 3.2). A próxima migração herdaria esse risco em cadeia.
- Não há registro do que aconteceu, só o estado final. Não dá para auditar, desfazer nem reproduzir um erro relatado.

### 4.6 Progressão de carreira

**Como é.** A escada é linear, com um atalho escrito à mão (`market.ts`, kart nacional → F4). Os requisitos são campos fixos por categoria. As propostas nascem do interesse de cada equipe no jogador.

**Limites.**
- Todo o mercado é calculado do ponto de vista do jogador. `targetInterest` (`market.ts:55`) é "o que esta equipe acha do jogador"; não existe "o que esta equipe acha de cada piloto". As propostas para a IA não existem: ela é redistribuída por uma regra de ordenação.
- A escada é uma lista. Categorias paralelas (dois campeonatos de F4 regionais, turismo, endurance) não cabem.
- As decisões só acontecem no fim do ano. Não há janela de transferências, pré-contrato com efeito, nem demissão no meio da temporada.
- `targetInterest` recalcula a classificação inteira a cada chamada (`market.ts:58`): hoje são cerca de 35 recálculos por etapa. Para avaliar todos os pilotos contra todas as vagas, o custo explode (seção 5).

## 5. Gargalos

Ordenados pelo impacto na meta de escala. As projeções assumem o crescimento linear ou quadrático medido.

| # | Gargalo | Hoje | Na meta, com o desenho atual | Causa |
| --- | --- | --- | --- | --- |
| 1 | Gravação automática | 63 ms por ação | 600 ms ou mais por ação (save de cerca de 14 MB) | bloco único; checksum, ida e volta e Zod sobre tudo; uma gravação por clique |
| 2 | Mercado para todos os pilotos | 0,75 ms (só o jogador) | dezenas de segundos (400 pilotos × 110 vagas, cada par recalculando a classificação) | classificação recalculada dentro de `targetInterest` |
| 3 | Simulação na thread da interface | 216 ms por temporada | 2 a 3 s por temporada; 100 a 400 ms por semana do mundo, com a tela travada | tudo roda na thread principal |
| 4 | Classificação | 0,3 ms | 19 ms por chamada, chamada centenas de vezes | busca linear por piloto em cada etapa (`standings.ts:62`); sem cache |
| 5 | Tamanho e memória do save | 1,4 MB | 14 MB em 10 temporadas; não cabe no `localStorage` | narração em texto (65% de uma etapa); histórico inteiro em memória; backup dobrado |
| 6 | Avaliação de eventos | 0,7 ms | cresce como definições × entidades × etapas | varredura completa de todas as definições |
| 7 | Renderização | não medido | tabelas de 400 linhas refeitas a cada ação | a carreira é um objeto só; qualquer mudança invalida todas as telas (`useCareerView`) |
| 8 | Sementes | 0,6 µs por sorteio | irrelevante no total (cerca de 6% do passo da corrida) | concatenação de texto por sorteio |

O cálculo da corrida em si não é gargalo: cerca de 200 corridas por temporada custam por volta de 1,5 a 2 s de processador no total. O que precisa mudar é onde e com que nível de detalhe elas rodam.

## 6. Riscos de inconsistência e de acoplamento

### 6.1 Dados duplicados ou sem dono

| Dado | Onde vive | Risco |
| --- | --- | --- |
| Equipe, papel e fim de contrato do jogador | `driver.teamId`, `driver.role`, `driver.contractEnd` e também `contract.teamId`, `contract.role`, `contract.endSeason` | Três fontes para o mesmo fato. A integridade verifica depois; nada impede a divergência antes. |
| Meta da equipe (`driverTarget`) | gravada na equipe, mas derivada da ordem de forças | Fica desatualizada quando um evento altera o carro no meio do ano. |
| Interesse das equipes (`marketInterest`) | gravado, mas é uma média móvel de um valor recalculável | Os eventos somam nele; o recálculo de início de temporada apaga o efeito. |
| Pilotos citados no histórico | ids de pilotos que já foram descartados | O histórico depende de nomes congelados (`driverNames`). Não dá para abrir a ficha de um campeão antigo. |
| Nomes de pilotos gerados | sorteados por categoria e temporada | Dois pilotos diferentes podem ter o mesmo nome em momentos diferentes da carreira. |
| Propostas do fim do ano | cópia congelada em `offseason.offers` | Um efeito aplicado depois do fechamento (multa rescisória alterada por evento) não aparece nelas. |
| Texto de mensagens e eventos | gravado pronto no save | Correções de texto não chegam aos saves existentes. |

### 6.2 Regras fora do lugar

- A projeção de resultado por etapa está escrita na tela de Finanças (`FinanceScreen.tsx:28-31`) e repete, à mão, a lógica de `settleRound` e de `financeRequirement`. As três podem divergir.
- A tela do fim de semana monta a previsão do tempo chamando `buildWetnessProfile` com a semente da sessão (`WeekendScreen.tsx:223`). A interface conhece um detalhe interno do motor, e tem acesso ao clima exato da corrida.
- `completeWeekend` confia no estado de corrida que recebe da store; só confere a semente. Qualquer estado com a semente certa é aceito como resultado oficial.

### 6.3 Determinismo frágil

- As sementes derivam de textos que incluem ids (`hashSeed(seed, volta, 'f1-s1-3-first')`). Renomear um id ou mudar o formato de um id gerado muda todos os resultados seguintes.
- O hash é de 32 bits. Com milhares de sorteios independentes por temporada, colisões entre fluxos são prováveis; duas sequências iguais passariam despercebidas.
- Não há identificação da versão das regras no save. Depois de um rebalanceamento, o mesmo save produz outro futuro, sem aviso e sem como comparar.
- Não existe teste de repetição com resultado guardado. Hoje, uma mudança que altere sem querer o resultado de uma corrida só é notada se quebrar uma faixa estatística.

### 6.4 Acoplamento

- **Objeto central.** `CareerState` tem 33 campos e é recebido inteiro por quase todas as funções (47 cópias `{...career}` no motor). Não há como dizer o que cada sistema lê e o que escreve.
- **Sequência fixa de sistemas.** `applyRoundEffects` (`roundEffects.ts:63`) conhece economia, condição, licença, relações, patrocinadores, evolução, mercado, eventos e mensagens, e a ordem entre eles está no corpo da função. O comentário do passo 9 antes do 8 mostra que a ordem já foi ajustada por causa de um efeito colateral.
- **Jogador como caso especial.** Há 21 pontos no motor que testam `isPlayer` ou `playerDriverId`. Cada sistema novo herda a pergunta "isto vale para a IA?".
- **Idioma dentro do motor.** Mensagens da corrida, da caixa de entrada e dos eventos são montadas no motor.
- **Robô de teste fora do produto.** A política que joga uma carreira sozinha está em `tests/helpers.ts`. O jogo vai precisar dela (simular uma temporada, simular o resto da corrida), e hoje há duas versões parciais: a do teste e a do "engenheiro automático".

## 7. Arquitetura proposta

### 7.1 Princípios mantidos

Motor puro, estado imutável nas fronteiras, sorteio com semente, schemas como fonte única, regras como dados, efeitos de evento como dados. Tudo isso continua.

### 7.2 Visão geral

```
┌─────────────────────────────── thread da interface ───────────────────────────────┐
│  UI (React)  ←  modelos de tela prontos  ←  cliente da simulação (mensagens)      │
└───────────────────────────────────────────────────────────────────────────────────┘
                          ▲ deltas e modelos de tela        │ comandos
                          │                                 ▼
┌──────────────────────────────── worker de simulação ──────────────────────────────┐
│  Orquestrador: relógio do mundo + agendador + fila de comandos                    │
│                                                                                   │
│  Sistemas (cada um declara o que lê, o que escreve e a que fatos reage)           │
│   Competição · Corrida · Desenvolvimento · Contratos e mercado · Economia ·       │
│   Relações e reputação · Narrativa · Licenças e regulamento                       │
│                                                                                   │
│  Barramento de fatos (ordem determinística)  →  diário da temporada               │
│                                                                                   │
│  Mundo: tabelas por id (pilotos, organizações, inscrições, vagas, contratos,      │
│          campeonatos, sessões, resultados) + índices + agregados em cache         │
└───────────────────────────────────────────────────────────────────────────────────┘
                          │ blocos alterados
                          ▼
┌──────────────────────────────────── persistência ─────────────────────────────────┐
│  manifesto · mundo · temporada/campeonato · diário · arquivo (carregado sob       │
│  demanda)   — gravação incremental, checksum por bloco, migração por bloco        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Mundo: entidades em tabelas

Trocar o objeto central por tabelas indexadas por id, cada uma com um dono.

| Tabela | Conteúdo | Substitui |
| --- | --- | --- |
| `drivers` | identidade fixa: nome, data de nascimento, nacionalidade | parte de `Driver` |
| `driverSkills` | atributos, potencial por grupo, traços | `Driver.attributes`, `potential` |
| `driverState` | fase, confiança, moral, lesão, licença, reputação | `Driver.condition`, e os campos soltos do jogador |
| `organizations` | equipe como empresa: orçamento, estrutura, academia | não existe |
| `entries` | inscrição de uma organização em um campeonato-temporada: carro, equipe de box, meta | `Team` |
| `seats` | vaga em uma inscrição (titular, reserva), com período | `driver.teamId` + `role` |
| `contracts` | vínculo piloto ↔ vaga, com datas, valores e cláusulas, **para todos os pilotos** | `CareerState.contract` |
| `ledgers` | lançamentos por entidade (piloto ou organização) | `CareerState.finance` |
| `relations` | grafo com peso entre entidades (confiança, rivalidade) | `CareerState.relations` |
| `championships`, `sessions`, `results` | calendário e resultados de todos os campeonatos | `calendar`, `rounds`, `history` |

Regras do modelo:
- **Um fato, um lugar.** A equipe de um piloto é "o contrato ativo dele aponta para qual vaga". `teamId`, `role` e `contractEnd` deixam de existir como campos e viram consultas.
- **O jogador é um piloto com um controlador humano.** Um campo `controller: 'human' | 'ai'` substitui os 21 testes de `isPlayer`. Tudo o que hoje é exclusivo do jogador (contrato, finanças, licença, relações, patrocinadores) passa a existir para qualquer piloto, com nível de detalhe menor para a IA.
- **Ids numéricos estáveis**, atribuídos uma vez e nunca reaproveitados. Pilotos não são descartados: aposentam-se e ficam no arquivo.
- **Agregados em cache, com verificação.** Classificação, estatísticas de carreira e ordem de forças são mantidas de forma incremental quando um resultado entra, e um teste recalcula tudo do zero e compara. Mantém a garantia atual (a classificação sempre bate com os resultados) sem o custo de recalcular.

### 7.4 Tempo e agendador

- **Relógio do mundo em dias.** Cada campeonato tem o seu calendário em datas. O jogador avança até o próximo compromisso dele; o mundo avança junto.
- **Agendador:** fila ordenada por data de itens a processar: sessões de todos os campeonatos, parcelas de contrato, vencimentos, janelas de mercado, eventos narrativos agendados, recuperação de lesões.
- **Ordem determinística** dentro de um mesmo dia: por tipo de item e depois por id.
- Isso libera o que hoje não cabe: transferências no meio do ano, pré-contratos, eventos com prazo, campeonatos com número diferente de etapas correndo em paralelo.

### 7.5 Sistemas, comandos e fatos

Substituir a sequência fixa por três conceitos:

- **Comando:** intenção de mudar o mundo (`AssinarContrato`, `DisputarSessao`, `ResolverEvento`). Vem da interface ou de um sistema.
- **Fato:** algo que aconteceu (`ResultadoRegistrado`, `PilotoLesionado`, `ContratoRescindido`, `PunicaoAplicada`). É imutável e vai para o diário.
- **Sistema:** módulo que declara as tabelas que lê, as que escreve e os fatos a que reage.

Hoje, `applyRoundEffects` chama nove sistemas. Na proposta, a competição publica `ResultadoRegistrado`, e economia, condição, licença, relações, patrocinadores, desenvolvimento, mercado e narrativa reagem, cada um no seu arquivo. A ordem de reação é declarada em um único lugar (uma lista de prioridades), não espalhada pelo código. Acrescentar um sistema passa a ser acrescentar um arquivo e uma linha nessa lista.

Ganhos diretos: o par `career` ⇄ `events` deixa de existir (a narrativa reage a fatos e emite comandos); o diário dá auditoria e reprodução de erros; e "milhares de eventos por temporada" vira o caso normal, com índice por tipo de fato.

### 7.6 Motor de corrida

Manter o modelo de desempenho e as regras; trocar a estrutura.

- **Fases separadas:** `pace`, `incidents`, `pits`, `positions`, `raceControl`, `teamOrders`, cada uma em um arquivo, com entrada e saída explícitas. `stepRaceLap` vira uma lista de fases.
- **Controladores:** uma interface única decide ritmo, parada e resposta a ordens. A IA e o jogador são duas implementações. Remove o caso especial do jogador e permite repetir uma corrida a partir das decisões gravadas.
- **Estado orientado a dados:** vetores numéricos por campo (tempo total, desgaste, combustível, dano) em vez de uma lista de objetos copiada a cada volta. Reduz alocação e permite transferir o estado entre worker e interface sem cópia.
- **Narração como códigos:** cada acontecimento é um registro compacto (tipo, volta, piloto, outro piloto, valor). O texto é montado na interface, a partir de modelos por idioma. Corta cerca de 65% do tamanho de uma etapa e resolve o idioma.
- **Níveis de detalhe:**

| Nível | Uso | Como |
| --- | --- | --- |
| Completo | a corrida do jogador | volta a volta, como hoje |
| Rápido | corridas da categoria do jogador e das vizinhas | por trechos de corrida (um cálculo por stint e por incidente), sem narração |
| Estatístico | categorias distantes | ordem de chegada sorteada a partir de ritmo esperado, confiabilidade e variância calibrada |

  Os níveis rápido e estatístico são calibrados contra o completo: um teste compara as distribuições (posição média por nível de piloto, abandonos, variância) e falha se divergirem além de uma tolerância.
- **Corrida em andamento gravada** como semente + decisões do jogador até a volta atual. Fecha a brecha de recarregar para refazer a prova.
- **Sementes numéricas:** misturar inteiros (semente, sistema, entidade, instante) em 64 bits, sem montar texto, com um fluxo por sistema. Remove a dependência de ids em texto e o risco de colisão.

### 7.7 Narrativa

- **Conteúdo como dados:** definições em arquivos validados por schema (condição, peso, escolhas, efeitos, chaves de texto). Escrever eventos deixa de exigir código.
- **Índice por gatilho:** cada definição declara os fatos que a ativam. Um fato consulta só as definições inscritas nele, em vez de todas.
- **Sujeito genérico:** um evento tem um sujeito (qualquer piloto ou organização). Para a IA, a escolha é feita por uma política; para o jogador, pela tela.
- **Histórias com estado:** uma definição pode agendar a continuação (pelo agendador) e guardar variáveis próprias.
- **Orçamento por semana:** limite de eventos por entidade, com fila por prioridade, em vez do corte silencioso de hoje.
- **Texto por chave**, com parâmetros, montado na interface.

### 7.8 Persistência

- **Save em blocos** no IndexedDB, um registro por bloco: `manifesto`, `mundo` (entidades), `temporada/<n>/<campeonato>` (resultados em formato colunar), `diário/<n>`, `arquivo/<n>`.
- **Gravação incremental.** Como o estado é imutável, um bloco mudou se a referência mudou. Só os blocos alterados são gravados. Trocar o foco de treino grava alguns kilobytes, não o save inteiro.
- **Checksum por bloco**, e um checksum do manifesto sobre os dos blocos.
- **Validação completa só ao carregar** e nos testes. Ao gravar, valida-se só o bloco alterado. A ida e volta completa a cada gravação sai.
- **Arquivo carregado sob demanda:** temporadas antigas ficam fora da memória até a tela de histórico pedir.
- **Backup por geração:** guardar a geração anterior só dos blocos que mudaram.
- **Migrações congeladas:** cada migração é uma transformação de dados pura, com cópia das constantes que usa, sem importar o motor. Uma fixture gravada por versão, como já existe para a versão 1.
- **Versão das regras no manifesto**, para avisar quando um save foi criado com outro balanceamento.
- O `localStorage` deixa de ser alternativa para o save completo; fica só para preferências. Exportar continua gerando um arquivo único.

### 7.9 Interface

- **Simulação em um worker.** A interface manda comandos e recebe modelos de tela prontos. A tela nunca trava, e as regras deixam de poder vazar para os componentes, porque eles não têm mais acesso ao estado bruto.
- **Modelos de tela calculados no motor:** projeção financeira, previsão do tempo, requisitos de proposta. Remove os dois vazamentos da seção 6.2.
- **Assinaturas por fatia:** cada tela assina só o que mostra.
- **Listas virtualizadas** para tabelas de centenas de linhas.

### 7.10 Orçamentos de desempenho

Metas a verificar por um conjunto de medições automáticas, na meta de escala da seção 2.

| Operação | Orçamento |
| --- | --- |
| Avanço de uma semana do mundo | menos de 150 ms no worker |
| Corrida do jogador, por volta | menos de 0,5 ms |
| Virada de temporada, com mercado para todos | menos de 1 s no worker |
| Gravação incremental | menos de 30 ms |
| Carregamento do save, sem o arquivo | menos de 300 ms |
| Memória da simulação | menos de 60 MB |
| Resposta da interface a um clique | um quadro (16 ms), sempre |

## 8. Plano priorizado

Seis etapas. Cada uma termina com o jogo funcionando e os testes passando. O tamanho é relativo: P (dias), M (uma a duas semanas), G (três semanas ou mais), para uma pessoa.

### Etapa 0: medir e travar o comportamento (P) — fazer primeiro

Nenhuma mudança de comportamento. É a rede de segurança de tudo o que vem depois.

| Tarefa | Critério de aceite |
| --- | --- |
| Conjunto de medições automáticas (corrida, temporada, gravação, classificação em escala) | os números da seção 3.3 saem de um comando |
| Testes de repetição: guardar o checksum de uma corrida e de uma carreira de 5 temporadas | qualquer mudança de resultado quebra o teste e precisa ser aceita de propósito |
| Tirar as duas regras da interface (projeção financeira e previsão do tempo) para funções do motor | a interface não importa `buildWetnessProfile` nem calcula valores por etapa |
| Mover o robô de `tests/helpers.ts` para o motor, como política de piloto automático | os testes e o "simular até o fim" usam a mesma política |
| Ganhos imediatos: cache da classificação por temporada; gravação com atraso de 1 s e sem a ida e volta completa | gravação abaixo de 30 ms no save atual; nenhuma gravação por clique em sequência |

### Etapa 1: mundo em tabelas e jogador como piloto comum (G) — o maior risco

| Tarefa | Critério de aceite |
| --- | --- |
| Tabelas de entidades com ids estáveis; acesso por repositórios | nenhum sistema recebe `CareerState` inteiro |
| Organização, inscrição, vaga e contrato como entidades, para todos os pilotos | `teamId`, `role` e `contractEnd` não existem como campos |
| Contrato, finanças, licença, reputação e relações por entidade | os 21 testes de `isPlayer` no motor caem para os de entrada de decisão |
| Agregados em cache (classificação, estatísticas) com teste de recálculo | classificação de 400 pilotos em menos de 1 ms por consulta |
| Pilotos nunca descartados; histórico de carreira para a IA | a ficha de qualquer piloto antigo abre |

Risco: é a mudança mais invasiva. Mitigação: fazer atrás de uma camada de adaptação que ainda monte o `CareerState` antigo para a interface e para o save, e remover a camada só no fim da etapa 4. Os testes de repetição da etapa 0 dizem se o comportamento mudou.

### Etapa 2: tempo, agendador e sistemas por fatos (M)

| Tarefa | Critério de aceite |
| --- | --- |
| Relógio em dias e agendador | dois campeonatos com calendários diferentes avançam juntos |
| Comandos, fatos e diário | `applyRoundEffects` deixa de existir; cada sistema está em um arquivo e reage a fatos |
| Ordem dos sistemas declarada em um único lugar | acrescentar um sistema não edita nenhum outro |
| Sementes numéricas de 64 bits por sistema | nenhum sorteio depende de texto; teste de independência entre fluxos |

Depende da etapa 1. Muda os resultados (as sementes mudam): os testes de repetição são regravados uma vez, de propósito, e a versão das regras sobe.

### Etapa 3: vários campeonatos e níveis de detalhe (G)

| Tarefa | Critério de aceite |
| --- | --- |
| Motor de corrida em fases, com controladores e estado em vetores | `stepRaceLap` com menos de 80 linhas; a IA e o jogador usam a mesma interface |
| Narração como códigos, com texto montado na interface | uma etapa de F1 ocupa menos de 10 KB |
| Níveis rápido e estatístico, calibrados contra o completo | teste de calibração entre níveis dentro da tolerância |
| Todas as categorias simuladas a cada semana | semana do mundo em menos de 150 ms, com 12 campeonatos |
| Simulação em um worker | a interface responde em um quadro durante o avanço |
| Corrida em andamento gravada (semente + decisões) | recarregar a página retoma a corrida na mesma volta |

Depende das etapas 1 e 2.

### Etapa 4: persistência em blocos (M)

| Tarefa | Critério de aceite |
| --- | --- |
| Save em blocos, gravação incremental, checksum por bloco | gravação abaixo de 30 ms na meta de escala |
| Arquivo carregado sob demanda | carregamento abaixo de 300 ms com 15 temporadas |
| Migração 2→3, congelada, com fixtures da versão 2 | saves das fases 1 e 2 abrem e continuam jogáveis |
| Migração 1→2 reescrita sem importar o motor | `persistence` não importa `engine` |

Vem depois da etapa 1 de propósito: o formato novo grava o modelo novo, e a migração acontece uma vez só. As fixtures da versão 2 devem ser geradas **antes** da etapa 1, com o código atual.

### Etapa 5: mercado e economia para todos (M)

| Tarefa | Critério de aceite |
| --- | --- |
| Avaliação piloto × vaga pré-calculada (nível, desempenho, reputação por piloto; exigência por vaga) | mercado de 400 pilotos e 110 vagas em menos de 200 ms |
| Propostas, negociação e assinatura para a IA, pelas mesmas regras do jogador | um piloto da IA pode recusar uma equipe; uma equipe pode ficar sem piloto e buscar outro |
| Janelas de transferência e mudanças no meio do ano | um piloto demitido na etapa 6 é substituído |
| Orçamento das organizações e desenvolvimento do carro durante a temporada | a ordem de forças muda ao longo do ano |
| Escada como grafo de categorias | um segundo campeonato do mesmo degrau pode ser acrescentado só com dados |

### Etapa 6: narrativa em escala (M)

| Tarefa | Critério de aceite |
| --- | --- |
| Eventos como arquivos de dados, com schema e chaves de texto | um evento novo entra sem mudar código |
| Índice por gatilho e orçamento por semana | 300 definições avaliadas para 400 pilotos em menos de 20 ms por semana |
| Sujeito genérico e política de escolha da IA | rivais e equipes passam por eventos que o jogador vê no noticiário |
| Histórias com estado e continuação agendada | um evento de três capítulos funciona |

As etapas 5 e 6 são independentes entre si e podem trocar de ordem.

### Ordem e dependências

```
0 ──► 1 ──► 2 ──► 3
      │           │
      └──► 4 ◄────┘ (pode começar ao fim da 1)
      2 ──► 5
      2 ──► 6
```

Se o tempo for curto, a etapa 0 sozinha já resolve o gargalo mais visível hoje (a gravação), e as etapas 1 e 2 são o que destrava todo o resto.

### Decisões que dependem de você

1. **Níveis de detalhe.** As categorias em que o jogador não está podem ser simuladas de forma simplificada? Recomendo que sim. Simular tudo volta a volta é possível (cerca de 2 s por temporada no worker), mas multiplica o tamanho dos resultados gravados.
2. **Tamanho do mundo.** A meta da seção 2 (400 a 600 pilotos, 12 a 15 campeonatos) serve? Ela define os orçamentos.
3. **Compatibilidade.** Manter os saves das fases 1 e 2 abrindo? Recomendo que sim; o custo é a migração da etapa 4.
4. **Idiomas.** O jogo terá outros idiomas? Se sim, a troca de texto por chaves (etapas 3 e 6) sobe de prioridade.
5. **Plataforma.** Só navegador? Se houver versão de computador ou celular, a escolha de armazenamento da etapa 4 muda.
6. **Conteúdo por dados.** Você quer escrever eventos, categorias e equipes sem programar? Se sim, a etapa 6 e a escada como grafo sobem de prioridade.

## 9. Como reproduzir as medições

- **Dependências:** um script percorre `src/`, resolve as importações (`@/` e relativas), agrupa por área e procura ciclos (componentes fortemente conexos).
- **Desempenho:** um teste temporário do Vitest mede, com `performance.now()` e média de 10 a 200 repetições, cada linha da tabela 3.3. A carreira usada é a do robô com semente 2 e talento 8 (`tests/helpers.ts`), jogada até completar uma temporada de F1.
- **Escala da classificação:** resultados sintéticos de 20 a 400 pilotos e 14 a 30 etapas passados a `computeDriverStandings`.

Os dois scripts não estão no repositório. A primeira tarefa da etapa 0 é transformá-los em um conjunto permanente de medições.
