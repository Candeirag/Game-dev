# Apex Motorsport Dynasty: guia para sessões de trabalho

Jogo de carreira e gestão no automobilismo, em React + TypeScript, que vai virar aplicativo
(Android e iPhone). Todo texto do jogo, do código (comentários) e do repositório (commits,
issues, PRs) é em português do Brasil.

## Fluxo de trabalho (obrigatório)

1. **Uma issue por tarefa grande.** Antes de começar, crie a issue com o escopo, o que fica de
   fora e os critérios de pronto. Tarefas pequenas (um ajuste pontual) podem ir direto num PR.
2. **Um PR por tarefa, citando a issue** (`Closes #N` no corpo). Use o modelo em
   `.github/pull_request_template.md`. Nada vai para a `main` sem PR.
3. **Rode `npm run check` antes de abrir ou atualizar um PR** e só abra com tudo passando.
   Cole o resultado no PR.
4. **Mostre o plano antes de começar** uma tarefa grande e **confirme que os testes passam**
   antes de passar para a tarefa seguinte.
5. Commits pequenos e descritivos, citando a issue (`Refs #N`). Formatação automática vai em
   commit separado das mudanças de comportamento.

## Comandos

| Comando              | O que faz                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento.                                                             |
| `npm run build`      | Tipos e build de produção (`dist/`).                                                     |
| `npm run check`      | **Verificação completa:** lint (Biome), tipos, testes (Vitest) e navegador (Playwright). |
| `npm run check:fast` | O mesmo, sem o Playwright.                                                               |
| `npm run format`     | Aplica a formatação e as correções seguras do Biome.                                     |
| `npm run test:e2e`   | Só os testes no navegador (`e2e/`).                                                      |
| `npm run calibrate`  | Relatórios de balanceamento (não fazem parte da verificação).                            |
| `npm run app:sync`   | Build e cópia para os projetos do aplicativo (`android/`, `ios/`).                       |
| `npm run app:icons`  | Regenera o ícone e a tela de abertura provisórios do aplicativo.                         |

O Playwright usa o Chromium. Em uma máquina nova: `npx playwright install chromium`.
Para depurar um teste do navegador: `npx playwright test <arquivo> --trace on`.

## O que não pode mudar sem querer

- **Simulação, balanceamento e economia.** `tests/regression.test.ts` compara carreiras de
  semente fixa com os valores de `tests/golden/simulation.json`. Se o teste falhar e a mudança
  não for proposital, é um defeito. Se for proposital, regrave com
  `UPDATE_GOLDEN=1 npx vitest run tests/regression.test.ts` e explique no PR o que mudou.
- **Saves.** Os de `tests/fixtures/` (versões 1, 2 e 3) têm de continuar abrindo e jogáveis.
  Mudou o formato do save? Suba `CAREER_SCHEMA_VERSION`, escreva a migração em
  `src/persistence/migrations.ts` e grave um save novo em `tests/fixtures/`.
- **Telas.** `e2e/telas.spec.ts` abre todas as telas principais em 844×390 (a referência),
  390×844, 1180×820 e 1366×768, tira um print de cada (em `test-results/telas/`) e falha se uma
  imagem cruzar um texto, se a página passar da largura ou se houver área de toque menor que
  44 px. Tela nova entra nessa lista. Sobreposição proposital (texto sobre a pista na
  transmissão) leva o atributo `data-overlay-ok`.

## Arquitetura (resumo; detalhes em ARCHITECTURE.md)

`src/domain` (schemas e textos) → `src/data` (dados estáticos) → `src/engine` (motor puro e
determinístico) → `src/persistence` (saves) → `src/store` (Zustand, camada fina) → `src/ui`.

- Regra de jogo só no motor. Componentes React e a store não decidem nada do jogo.
- Toda aleatoriedade vem de `src/engine/rng.ts`, com semente. Nada de `Math.random` no motor.
- Dinheiro só por `src/domain/money.ts` (motor: `money(career, valor)`; interface:
  `formatMoney`). Plurais por `src/domain/text.ts`.
- Visual "muro dos boxes": tokens em `src/index.css`, componentes em `src/ui/kit`. Cada cor
  tem um significado fixo (vermelho: ação principal e o jogador; verde: bom; âmbar: atenção).
  Ícones só do Lucide; nada de emoji como ícone.
- Movimento: entradas e saídas de 150 a 300 ms, por transição de CSS (interrompível), e nada
  para quem usa `prefers-reduced-motion` (ver `src/ui/motion.ts`). Indicador de progresso só
  onde há espera de verdade (abrir save, carregar imagens).
- Áreas de toque de no mínimo 44 px. O aplicativo é pensado para a tela deitada (844×390):
  colunas a partir de `md:`, abas (na URL, `?tab=`) quando a tela fica comprida, e o passo que
  faz a carreira avançar sempre na barra superior (`src/ui/layout/ScreenAction.tsx`).
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
