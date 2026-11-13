# Arquitetura: Apex Motorsport Dynasty

Este documento descreve como o código está organizado, por quê, e como estendê-lo sem quebrar as garantias do projeto.

## Princípios

1. **As regras do jogo vivem no motor (`src/engine`), nunca na interface.** Componentes React só exibem dados e disparam ações. Nenhum componente calcula tempo de volta, pontos, evolução ou resultado de sessão.
2. **Estado imutável e funções puras.** Toda transição de jogo é `(estado, decisão) → novo estado`. O motor não lê relógio, rede nem `Math.random()`. Isso torna a simulação testável e reproduzível.
3. **Variabilidade controlada.** Toda aleatoriedade passa por um gerador com semente (`src/engine/rng.ts`). A semente de cada sessão é derivada da semente da carreira.
4. **Uma fonte de verdade.** Os tipos TypeScript são inferidos dos schemas Zod, que também validam os saves. A classificação do campeonato nunca é armazenada: ela é recalculada a partir dos resultados.
5. **Dados estáticos separados do estado.** Pistas, regras e o elenco inicial ficam em `src/data`. O save guarda só o que muda.

## Camadas

```
┌──────────────────────────────────────────────────────────────┐
│ src/ui            React: telas, componentes, formatação      │
│   ↓ lê estado / dispara ações                                │
│ src/store         Zustand: estado atual + autosave           │
│   ↓ chama                                  ↓ chama           │
│ src/engine        Motor (puro)       src/persistence  Saves  │
│   ↓ usa                                    ↓ usa             │
│ src/domain        Schemas e tipos (Zod) + rótulos            │
│ src/data          Dados estáticos (equipes, pilotos, pistas) │
└──────────────────────────────────────────────────────────────┘
```

As dependências só apontam para baixo. `engine` não conhece React nem Zustand, e `domain` não depende de nada do projeto.

## Mapa de diretórios

| Caminho | Responsabilidade |
| --- | --- |
| `src/domain/schemas.ts` | Schemas Zod e tipos de todo o modelo: piloto, equipe, clima, sessões, resultados, carreira. Versão do schema do save. |
| `src/domain/labels.ts` | Textos em português para atributos, modos e clima. Usados pelo motor (mensagens) e pela UI. |
| `src/data/` | Equipes, pilotos da IA, pistas, calendário, pontuação e perfis iniciais do jogador. Todo número tem justificativa no comentário. |
| `src/engine/rng.ts` | PRNG mulberry32, derivação de sementes (FNV-1a), gaussiana saturada. |
| `src/engine/simulation/constants.ts` | Todas as constantes de calibragem da simulação, comentadas. |
| `src/engine/simulation/performance.ts` | Modelo de desempenho: nota de ritmo, tempo de volta esperado, ruído, chance de erro, quebra e desgaste. |
| `src/engine/simulation/weather.ts` | Clima correlacionado por fim de semana. |
| `src/engine/simulation/practice.ts` | Treino livre: acerto e modificadores do fim de semana. |
| `src/engine/simulation/qualifying.ts` | Classificação: tentativas lançadas e grid. |
| `src/engine/simulation/race.ts` | Corrida volta a volta: largada, erros, quebras, pneus, ultrapassagens, toques. |
| `src/engine/ai/decisions.ts` | Decisões da IA, por regras: programa de treino, abordagem, ritmo de corrida, foco de treino. |
| `src/engine/championship/` | Pontuação e classificação de pilotos e equipes, com desempate por countback. |
| `src/engine/career/` | Criação de carreira, fluxo do fim de semana, evolução, fim de temporada e transferências, estatísticas, mensagens. |
| `src/engine/index.ts` | API pública do motor; a UI e a store importam só daqui. |
| `src/persistence/` | Adaptadores de armazenamento (IndexedDB, localStorage, memória), checksum, integridade, migrações e serviço de saves. |
| `src/store/gameStore.ts` | Store Zustand: estado atual, corrida ao vivo e autosave. É uma camada fina sobre o motor. |
| `src/ui/` | Layout, telas, componentes visuais e formatação. |
| `tests/` | Testes Vitest do motor, do campeonato, da carreira e dos saves. `tests/calibration/` guarda o relatório de balanceamento. |
| `legacy/simdev/` | Projeto anterior do repositório (SimDev), preservado sem alterações. Não faz parte do build. |

## Fluxo de uma etapa

```
startWeekend      → weekend.phase = 'practice'
runPractice(p)    → weekend.practice, phase = 'qualifying'   (autosave)
runQualifying(a)  → weekend.qualifying, phase = 'race'       (autosave)
createWeekendRace → RaceSimState (fica na store, não no save)
stepRaceLap × N   → a UI reproduz volta a volta; o modo do jogador entra a cada volta
completeWeekend   → RoundRecord gravado, evolução aplicada, mensagens,
                    nextRoundIndex++                           (autosave)
```

A corrida em andamento não é salva. Se o jogador recarregar a página no meio da prova, a fase continua sendo `race` e a corrida recomeça da largada. Como a semente é fixa, as mesmas decisões levam ao mesmo resultado, e não há como recarregar para trocar a sorte.

## Determinismo e isolamento da sorte

- `hashSeed(seedDaCarreira, temporada, etapa, 'qualifying')` gera a semente de cada sessão.
- No treino e na classificação, cada piloto usa `hashSeed(semente, idDoPiloto)`.
- Na corrida, cada piloto em cada volta usa `hashSeed(semente, volta, idDoPiloto)`, e cada disputa de posição usa `hashSeed(semente, volta, 'pass', atacante, defensor)`.
- Todos os sorteios de um piloto em uma volta acontecem sempre, na mesma ordem, mesmo que não sejam usados.

Consequência: a decisão do jogador muda médias e probabilidades, mas não embaralha a sorte dos rivais. Os testes `tests/simulation.test.ts` verificam isso, além do determinismo completo.

## Persistência e integridade

`saveCareer` e `loadCareer` (`src/persistence/saveService.ts`) aplicam quatro camadas:

1. **Envelope** com `format`, `schemaVersion`, `savedAt`, `summary` e `checksum`.
2. **Checksum** cyrb53 sobre a serialização canônica (chaves ordenadas) da carreira. Detecta corrupção e edição manual.
3. **Migração** (`migrations.ts`): converte saves de versões anteriores; saves de versões futuras são recusados.
4. **Validação**: schema Zod mais `validateCareerIntegrity` (referências, 2 pilotos por equipe, ordem do calendário, resultados batendo com o progresso, histórico coerente).

Além disso:
- Antes de gravar, o serviço faz a ida e volta (serializa e valida). Um save que não pudesse ser lido nunca é escrito.
- Cada gravação guarda a versão anterior do slot como `<slot>.backup`, na mesma transação do IndexedDB. Se o principal falhar, o carregamento usa o backup e avisa o jogador.
- Há quatro slots: `auto` (automático, após cada sessão), `slot1` a `slot3` (manuais). Também é possível exportar e importar um arquivo JSON.
- Ordem de preferência do armazenamento: IndexedDB, depois localStorage, depois memória.

## Como estender

**Novo atributo de piloto**
1. Acrescente a chave em `ATTRIBUTE_KEYS` e em `DriverAttributesSchema`.
2. Suba `CAREER_SCHEMA_VERSION` e registre uma migração em `MIGRATIONS` que preencha o valor nos saves antigos.
3. Use o atributo em `performance.ts` ou `race.ts` e acrescente o rótulo em `labels.ts`.
4. Atualize os dados em `src/data/drivers.ts` e `rules.ts`.

**Nova categoria (por exemplo, Fórmula 4)**
Crie os dados (equipes, pistas, pontuação) em `src/data/` e parametrize `createCareer` e `buildCalendar` pela categoria. O motor de corrida já recebe pista, equipes e pilotos por parâmetro.

**Nova decisão do jogador**
Acrescente o enum em `schemas.ts`, o efeito em `constants.ts`, a aplicação no módulo de sessão, a escolha da IA em `ai/decisions.ts` e, por último, os controles na UI.

**Rebalanceamento**
Ajuste `src/engine/simulation/constants.ts` ou os dados e rode `npm run calibrate`, que simula 20 temporadas e imprime campeões, médias de grid e chegada, ultrapassagens, abandonos, clima e o efeito das decisões do jogador.

## Qualidade

- `npm run typecheck`: TypeScript estrito (`strict`, `noUncheckedIndexedAccess`, sem `any`).
- `npm test`: 51 testes cobrindo RNG, modelo de desempenho, clima, sessões, invariantes da corrida, determinismo, pontuação, desempates, carreira completa com troca de temporada, e saves (IndexedDB via `fake-indexeddb`, adulteração, backup, migração).
- `npm run build`: checagem de tipos e build de produção.
