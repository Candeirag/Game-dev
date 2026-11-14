# Apex Motorsport Dynasty

Simulador de carreira de automobilismo para navegador. Você cria um piloto, começa no kart regional em uma equipe modesta e sobe a escada até a Fórmula 1: sete categorias, contratos, patrocinadores, finanças, lesões, rivalidades, eventos e corridas decididas volta a volta.

Feito com React 19, TypeScript (modo estrito), Vite, Tailwind CSS 4, Zustand e Zod. Os saves ficam no IndexedDB do navegador.

## Requisitos

- Node.js 20 ou mais recente (testado com o 22)
- npm 10 ou mais recente

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173).

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm run build` | Checa os tipos e gera o build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm test` | Roda os 121 testes automatizados (Vitest); leva cerca de 20 segundos |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run calibrate` | Simula 12 carreiras de 14 temporadas e imprime o relatório de balanceamento; leva cerca de 15 segundos (no Windows: `set CALIBRATE=1 && npx vitest run --reporter=verbose`) |

O build usa caminhos relativos, então a pasta `dist/` funciona em qualquer servidor estático.

## O que há no jogo

- **Sete categorias:** Kart Regional, Nacional e Internacional, Fórmula 4, 3, 2 e 1, cada uma com as próprias regras de corrida, custos e exigências.
- **Promoção por mérito:** licença (pontos pela posição final), reputação, experiência, idade, dinheiro e uma equipe interessada.
- **Contratos:** duração, salário, custo da vaga, bônus, multa rescisória e cláusula de desempenho; propostas no fim do ano, negociação com margem e paciência, renovação e rescisão; mercado de pilotos entre as temporadas.
- **Piloto:** nove atributos, treino com foco e intensidade, fase, confiança e moral, lesões e recuperação, envelhecimento e declínio.
- **Corrida:** classificação (eliminatória na F1), largada, ultrapassagens e defesa, erros e acidentes, danos, quebras, safety car, safety car virtual, bandeira vermelha, punições, clima que muda durante a prova, compostos de pneu, desgaste, paradas, estratégia e combustível.
- **Equipes:** primeiro piloto, segundo e reserva; ordens de equipe; confiança, relação com o companheiro e rivalidades; academias das equipes de F1.
- **Economia:** salário, patrocínios, bônus, custo da vaga, custo de vida, conta de danos, impostos, dívida e investimentos.
- **Eventos:** entrevistas, polêmicas, rivalidades, investigações, protestos, problemas contratuais, pressão de patrocinadores e imprevistos, todos com consequências sobre os outros sistemas.

## Como jogar

1. **Nova carreira:** escolha nome, nacionalidade, idade e perfil, distribua 8 pontos livres e assine com uma das três equipes de entrada do kart regional.
2. **Painel:** mostra as **decisões pendentes** (eventos), a próxima etapa, a sua condição (fase, confiança, moral), o programa de treino e as mensagens. As decisões pendentes precisam ser resolvidas antes do fim de semana.
3. **Fim de semana:**
   - **Treino livre:** acerto, simulação de classificação ou ritmo de corrida.
   - **Classificação:** abordagem segura, equilibrada ou ataque total.
   - **Estratégia** (da F4 em diante): escolha entre os planos de pneus calculados para a pista.
   - **Corrida:** acompanhe volta a volta, troque o ritmo, peça paradas, responda às ordens de equipe e reaja a safety car e chuva. O "engenheiro automático" cuida de paradas e combustível, se você preferir.
4. **Entre as etapas:** ajuste o treino, acompanhe a confiança da equipe e as rivalidades (tela Equipe), o interesse das equipes e os requisitos do próximo degrau (tela Carreira), e o dinheiro (tela Finanças).
5. **Fim de temporada:** na tela Carreira, veja o fechamento do ano e as propostas. Negocie, confira os requisitos de cada uma e assine.

Dicas:
- No começo, o dinheiro é curto: a família ajuda por cinco anos, e bons resultados atraem patrocinadores maiores. Uma categoria cara sem patrocínio vira dívida.
- Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.
- Do kart nacional dá para ir direto para a Fórmula 4.
- Na F2 e na F1, atacar a corrida inteira acaba com o combustível antes da bandeirada.

### Saves

- **Save automático** depois de cada sessão e de cada decisão.
- **Três slots manuais**, mais exportação e importação de arquivo `.json`.
- Cada save é validado (estrutura, consistência e checksum) ao ser gravado e ao ser carregado, e a versão anterior do slot fica como cópia de segurança.
- **Saves da Fase 1 continuam funcionando:** são convertidos ao abrir, mantendo o piloto, os resultados e o histórico. A carreira segue no kart regional, com os sistemas novos no estado inicial.
- A corrida em andamento não é salva: recarregar a página durante a prova faz a corrida recomeçar da largada, com a mesma sorte.

## Estrutura do projeto

```
src/
  domain/       schemas Zod e tipos (fonte única da verdade), rótulos
  data/         categorias, equipes, pilotos, pistas e regras, com justificativas
  engine/       motor do jogo, sem React
    simulation/   desempenho, clima, treino, classificação
    simulation/race/  motor de corrida (independente da carreira)
    career/       fim de semana, economia, contratos, mercado, temporadas
    events/       eventos dinâmicos e seus efeitos
    world/        geração de grids
  persistence/  IndexedDB, checksum, integridade, migrações e saves
  store/        Zustand (camada fina sobre o motor + autosave)
  ui/           telas, componentes e layout
tests/          testes do motor, da carreira, dos saves e de várias temporadas
legacy/simdev/  projeto anterior do repositório, preservado e fora do build
```

Documentação detalhada:
- [ARCHITECTURE.md](ARCHITECTURE.md): camadas, motor de corrida, fluxo de dados, determinismo, persistência, compatibilidade de saves e como estender.
- [GAME_DESIGN.md](GAME_DESIGN.md): todas as regras e fórmulas, tabelas de balanceamento, limitações e próximos passos.

## Sobre a pasta `legacy/simdev`

Antes deste projeto, o repositório continha o **SimDev**, um jogo de gestão de estúdio de jogos importado de [SuitedTom/SimDev](https://github.com/SuitedTom/SimDev) sob licença MIT. Ele foi movido intacto para `legacy/simdev/`, com sua licença original, e não é usado pelo Apex Motorsport Dynasty.
