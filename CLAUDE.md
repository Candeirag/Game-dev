# Apex Motorsport Dynasty: guia para sessões de trabalho

Jogo de carreira e gestão no automobilismo, em React + TypeScript, que vai virar aplicativo
(Android e iPhone). Todo texto do jogo, do código (comentários) e do repositório (commits,
issues, PRs) é em português do Brasil.

## As regras da grande atualização (fases 0 a 9)

Valem para todas as fases. As regras 2 a 5, 7 e 8 têm um teste ou um comando que as confere; a 1
e boa parte da 6 dependem de revisão (só largura da tela, sobreposição e área de toque têm teste).
Se você precisar contrariar uma delas, pare e pergunte antes.

1. **Uma fase por PR.** Nada de misturar escopos: o que não é da fase vai para "O que ficou de
   fora" do PR, não para o código. O PR não é mesclado por quem o abriu: o dono joga e aprova.
2. **Testes (Vitest) e Biome sempre passando.** Toda regra de jogo nova ganha teste no mesmo PR.
3. **Número de equilíbrio não fica solto no código.** Probabilidade, multiplicador, limite,
   custo, idade: tudo o que se ajusta para equilibrar o jogo mora em tabela com nome. Números
   novos entram em `src/config/balance.ts`. As tabelas que já existiam continuam onde estão (o
   mapa delas está nesse arquivo e é conferido por `tests/balance.test.ts`); quando uma fase
   mexer numa regra antiga cujo número está solto, leva o número para a configuração no mesmo PR.
4. **Toda aleatoriedade passa pelo gerador com semente** (`src/engine/rng.ts`):
   `createRng(hashSeed(career.seed, temporada, etapa, 'nome-do-sorteio', …))`. Nada de
   `Math.random`, `crypto`, relógio ou `localeCompare` na lógica; `tests/determinism.test.ts`
   falha se aparecerem. Mesma semente + mesmas escolhas = mesmo resultado. Sorteio novo ganha um
   nome novo; mudar o nome, os ids ou a ordem de uma lista usada num sorteio muda a sorte de
   carreiras em andamento.
5. **Mudou o formato do save: nova versão + migração.** Suba `CAREER_SCHEMA_VERSION`, escreva
   `migrateVN.ts` e registre em `src/persistence/migrations.ts` (o passo a passo está lá), grave
   os saves da versão nova com `UPDATE_FIXTURES=1 npx vitest run tests/fixtures.test.ts` e teste
   o degrau. Save antigo nunca quebra: os de `tests/fixtures/v1` em diante têm de abrir e
   continuar jogáveis. O schema descarta campos que não conhece, então todo campo novo exige
   versão nova. Na conversão, o save original fica guardado intacto no aparelho
   (`<slot>.original-v<formato>`, em `saveService.ts`; conferido por `tests/save.test.ts`):
   vale sozinho para toda versão futura e não pode ser removido.
6. **Interface.** Tela deitada (844×390 é a referência); português do Brasil; números com
   dígitos de largura fixa (`tabular-nums`, já ligado no `body`) e diferenças de tempo sempre
   com três casas (`formatGap`, `formatInterval`, `formatLap`); nenhuma informação só por cor
   (cor + letra, ícone ou seta); contraste de 4,5:1 para texto e 3:1 para texto grande, ícones e
   contornos; área de toque de no mínimo 44 pt, com 8 pt entre vizinhas; respeitar o "reduzir
   movimento" (do sistema ou de Ajustes): nada desliza nem dá zoom, só esmaece; vibração só em
   momentos importantes e sempre igual para a mesma ação, por um módulo único (as telas chamam
   `feedback(...)`, em `src/ui/feedback`; nenhuma chama a vibração direto). `e2e/telas.spec.ts`
   confere contraste, largura fixa, toque e espaço entre alvos em todas as telas.
7. **Visual.** Grafite escuro com vermelho de destaque, Barlow Condensed nos títulos e Inter no
   texto (tokens em `src/ui/tokens.css`). **Toda tela nova usa esses tokens e os componentes de
   `src/ui/kit`** (botão, card, chip, tabela e torre, barra de progresso, selo de pneu, variação
   com seta, sparkline, tarja): nada de cor, tamanho de texto ou sombra soltos, nem componente
   base refeito dentro da tela. Se faltar um componente, ele entra no kit e no catálogo
   (`#/dev/catalogo`, no `npm run dev`). A fonte condensada só em texto de 16 px ou mais; texto
   pequeno é sempre Inter. Nenhuma terceira fonte. A inspiração são os jogos de gestão de automobilismo, sem
   copiar logos, imagens ou layouts, e **sem marcas reais**: nem nomes de categorias, entidades,
   equipes, pilotos ou patrocinadores de verdade. Os nomes das categorias saem todos de
   `src/domain/categoryNames.ts`. `tests/names.test.ts` falha se os nomes antigos voltarem ao
   código (F1 a F4, "Fórmula 1" a "Fórmula 4", FIA, superlicença, licenças internacionais por
   letra); marca nova não é pega por teste, então confira cada nome que criar. "Campeonato
   Brasileiro de Kart" fica, por decisão do dono.
8. **Mexeu em regra de jogo: rode o simulador** (`npm run sim -- --seeds 50 --seasons 15`) e
   cole o relatório no PR, ao lado do relatório da fase anterior. Sem mudança de regra, o
   relatório tem de sair idêntico.

## Fluxo de trabalho (obrigatório)

1. **Uma issue por tarefa grande.** Antes de começar, crie a issue com o escopo, o que fica de
   fora e os critérios de pronto. Tarefas pequenas (um ajuste pontual) podem ir direto num PR.
2. **Um PR por tarefa, citando a issue** (`Closes #N` no corpo). Use o modelo em
   `.github/pull_request_template.md`. Nada vai para a `main` sem PR.
3. **Rode `npm run check` antes de abrir ou atualizar um PR** e só abra com tudo passando.
   Cole o resultado no PR. O GitHub Actions (`.github/workflows/check.yml`) roda a mesma
   verificação em todo PR e a cada envio para a `main`: PR com a verificação vermelha não entra.
4. **Mostre o plano antes de começar** uma tarefa grande e **confirme que os testes passam**
   antes de passar para a tarefa seguinte.
5. Commits pequenos e descritivos, citando a issue (`Refs #N`). Formatação automática vai em
   commit separado das mudanças de comportamento.

## Comandos

| Comando              | O que faz                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento.                                                                |
| `npm run build`      | Tipos e build de produção (`dist/`).                                                        |
| `npm run check`      | **Verificação completa:** lint (Biome), tipos, testes (Vitest) e navegador (Playwright).    |
| `npm run check:fast` | O mesmo, sem o Playwright.                                                                  |
| `npm run format`     | Aplica a formatação e as correções seguras do Biome.                                        |
| `npm run test:e2e`   | Só os testes no navegador (`e2e/`).                                                         |
| `npm run sim`        | **Simulador sem interface:** joga carreiras com o robô e imprime o relatório de equilíbrio. |
| `npm run calibrate`  | Relatórios de balanceamento detalhados (não fazem parte da verificação).                    |
| `npm run app:sync`   | Build e cópia para os projetos do aplicativo (`android/`, `ios/`).                          |
| `npm run app:icons`  | Regenera o ícone e a tela de abertura provisórios do aplicativo.                            |
| `npm run app:images` | Converte as imagens de `assets/higgsfield/` (carros e retratos) para WebP, dentro do jogo.  |

O Playwright usa o Chromium. Em uma máquina nova: `npx playwright install chromium`.
Para depurar um teste do navegador: `npx playwright test <arquivo> --trace on`.

Simulador: `npm run sim -- --seeds 50 --seasons 15` (o padrão; cerca de 25 s). Outras opções:
`--first-seed N`, `--talent N` (0 = o robô puro; 4 = bom jogador; 8 = excelente), `--json`,
`--out arquivo`, `--help`. O relatório vai para a saída padrão e não tem data nem duração: com
os mesmos argumentos e o mesmo código, sai sempre igual.

## O que não pode mudar sem querer

- **Simulação, balanceamento e economia.** `tests/regression.test.ts` compara carreiras de
  semente fixa com os valores de `tests/golden/simulation.json`. Se o teste falhar e a mudança
  não for proposital, é um defeito. Se for proposital, regrave com
  `UPDATE_GOLDEN=1 npx vitest run tests/regression.test.ts`, explique no PR o que mudou e cole o
  relatório do simulador de antes e de depois.
- **Identificadores.** Os ids das categorias (`f4`, `f3`, `f2`, `f1`, `kart-…`) e das equipes
  estão nos saves e entram nas sementes. O nome exibido pode mudar; o id, não
  (`tests/names.test.ts` trava a lista).
- **Saves.** Os de `tests/fixtures/` (versões 1 a 5) têm de continuar abrindo e jogáveis. Os
  das versões antigas são registros e nunca são regravados.
- **Telas.** `e2e/telas.spec.ts` abre todas as telas principais em 844×390 (a referência),
  390×844, 1180×820 e 1366×768, tira um print de cada (em `test-results/telas/`) e falha se uma
  imagem cruzar um texto, se a página passar da largura ou se houver área de toque menor que
  44 px. Tela nova entra nessa lista. Sobreposição proposital (texto sobre a pista na
  transmissão) leva o atributo `data-overlay-ok`.

## Arquitetura (resumo; detalhes em ARCHITECTURE.md)

`src/domain` (schemas e textos) → `src/data` (dados estáticos) → `src/engine` (motor puro e
determinístico) → `src/persistence` (saves) → `src/store` (Zustand, camada fina) → `src/ui`.
Ao lado: `src/config` (configuração de balanceamento e feature flags) e `sim/` (o robô e o
simulador, que só usam a API pública do motor).

- Regra de jogo só no motor. Componentes React e a store não decidem nada do jogo.
- Toda aleatoriedade vem de `src/engine/rng.ts`, com semente (regra 4).
- Dinheiro só por `src/domain/money.ts` (motor: `money(career, valor)`; interface:
  `formatMoney`). Plurais por `src/domain/text.ts`. Nome de categoria em frase só por
  `categoryRef` (`src/domain/categoryNames.ts`), que acerta "do/da", "no/na", "ao/à".
- O que ainda não está pronto para o jogador fica atrás de uma feature flag de
  `src/config/featureFlags.ts` (premium, anúncios, conquistas da loja; tudo desligado). O motor
  não lê flags.
- Visual "muro dos boxes" (sistema de design da Fase 1): os tokens ficam todos em
  `src/ui/tokens.css` (cores com papel fixo, escala de texto, grade de 8 px, chanfros, sombras,
  movimento) e os componentes base em `src/ui/kit` (importe de `@/ui/kit`). Cada cor tem um
  significado fixo (vermelho: ação principal e o jogador; verde: bom; âmbar: atenção) e nunca
  vai sozinha: junto vem texto, letra, seta ou ícone. Ícones só do Lucide; nada de emoji.
  O catálogo (`#/dev/catalogo`) só existe no servidor de desenvolvimento.
- Espaçamento: passos pares do Tailwind (`p-2`, `gap-4`: múltiplos de 8 px); `1` (4 px) só para
  ajuste fino. O passo `3` (12 px) sobrevive em telas antigas e não pode crescer
  (`tests/designSystem.test.ts` trava a contagem): quem mexer numa tela troca os dela.
- Texto: tamanhos só pelos tokens (`text-2xs` a `text-title`), que seguem o tamanho de texto do
  aparelho e o de Ajustes (`--text-scale`). Dinheiro abreviado nos cartões (`formatMoney`) e
  completo em detalhes e extrato (`formatMoneyFull`). Variação sempre com `Delta` (seta + sinal).
- Movimento: entradas e saídas de 150 a 300 ms, por transição de CSS (interrompível). Com menos
  movimento (sistema ou Ajustes; `data-motion="reduce"` no `<html>`), só a opacidade e as cores
  têm transição e a câmera da corrida fica parada (ver `src/ui/motion.ts`). Nada pisca a 3 Hz
  ou mais. Indicador de progresso só onde há espera de verdade (abrir save, carregar imagens).
- Retorno ao jogador: `src/ui/feedback` é o único lugar que decide vibração e som. A tela chama
  `feedback('victory')`; a tabela `FEEDBACK` diz o padrão. Sons são sintetizados
  (`sounds.ts`), sem arquivos de áudio. Os ajustes do jogador (texto, daltonismo, movimento,
  vibração, volumes) ficam em `src/ui/settings` e são guardados no aparelho, fora dos saves.
- Áreas de toque de no mínimo 44 px, com 8 px entre vizinhas. O aplicativo é pensado para a
  tela deitada (844×390): colunas a partir de `md:`, abas (na URL, `?tab=`) quando a tela fica
  comprida, e o passo que faz a carreira avançar sempre na barra fixa do pé da tela (56 px, o
  botão à direita, perto do polegar; `ScreenAction` e `ActionBar`, em
  `src/ui/layout/ScreenAction.tsx`). A página reserva o espaço da barra (`--action-bar-h`):
  rolando até o fim, o conteúdo termina acima dela (`e2e/telas.spec.ts` confere). Margens de
  segurança do aparelho pelos tokens `--safe-*`.
- Imagens geradas (carros por categoria, retratos): os originais vão em `assets/higgsfield/` e
  `npm run app:images` os converte para `src/assets/generated/`. Faltando imagem, a tela usa a
  reserva (o carro desenhado pelo jogo, a placa com o número). Ver `ASSETS.md`.
- Relatório de travamentos (Sentry) preparado e desligado: `src/monitoring/crashReporting.ts`.
- Aplicativo (Capacitor, Android e iOS): só `src/platform` importa `@capacitor/*`; o resto do
  jogo pergunta a `isNativeApp()`. No aplicativo os saves vão para arquivos do aparelho
  (`src/persistence/deviceStorage.ts`) e nada vem da rede (`tests/offline.test.ts`). As pastas
  `android/` e `ios/` são projetos nativos versionados: mexa nelas só para configuração
  (orientação, ícones, permissões) e rode `npm run app:sync` depois de mudar o jogo. Imagens
  que existem e que faltam: `ASSETS.md`.

## Convenções

- TypeScript estrito (`noUncheckedIndexedAccess`), sem `any`.
- Biome cuida de lint e formatação (`biome.json`). Não discuta estilo: rode `npm run format`.
- Arquivos gerados não se editam à mão: `src/data/circuitLayouts.ts` e
  `src/data/kartLayouts.ts` saem dos scripts em `scripts/`.
- Não ponha nomes de modelo de IA em commits, PRs ou código.
