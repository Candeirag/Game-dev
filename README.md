# Apex Motorsport Dynasty

Jogo de carreira e gestão de automobilismo para navegador. Na **Fase 1**, você cria um piloto, entra em uma equipe modesta do Campeonato Regional de Kart e disputa uma temporada completa (treino livre, classificação e corrida volta a volta), evolui o piloto e segue para as próximas temporadas.

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
| `npm test` | Roda os testes automatizados (Vitest) |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run calibrate` | Simula 20 temporadas e imprime um relatório de balanceamento (no Windows, rode `set CALIBRATE=1 && npx vitest run --reporter=verbose`) |

O build usa caminhos relativos, então a pasta `dist/` funciona em qualquer servidor estático.

## Como jogar

1. **Nova carreira:** escolha nome, nacionalidade, idade e perfil (*Talento natural*, *Piloto técnico* ou *Lutador*), distribua 8 pontos livres e assine com uma das três equipes de entrada. Cada equipe tem uma meta de posição no campeonato.
2. **Painel:** mostra a próxima etapa (com a previsão do tempo e as características da pista), a sua posição, a meta da equipe, as mensagens e o **programa de treino**. O foco escolhido define quais atributos evoluem depois de cada etapa.
3. **Fim de semana:**
   - **Treino livre:** escolha entre *acerto* (mais ritmo no fim de semana todo), *simulação de classificação* (volta lançada mais rápida) ou *ritmo de corrida* (menos desgaste de pneus).
   - **Classificação:** escolha entre *segura*, *equilibrada* ou *ataque total*. Atacar é mais rápido, mas aumenta o risco de invalidar a volta.
   - **Corrida:** assista volta a volta (1×, 2× ou 4×) e troque o ritmo quando quiser: *conservador* poupa pneus e erra menos; *agressivo* ataca, mas gasta pneus e arrisca toques.
4. **Concluir etapa:** o resultado vira pontos, o piloto evolui, a equipe reage e o jogo salva sozinho.
5. **Fim de temporada:** veja o campeão, se a meta foi cumprida, a nova reputação e as propostas das equipes. Assine e comece o ano seguinte.

Outras telas: **Piloto** (atributos, evolução na temporada, estatísticas), **Calendário**, **Classificação** (pilotos com o resultado de cada etapa, e equipes), **Histórico** (todas as etapas de todas as temporadas, com a classificação completa) e **Saves**.

### Saves

- **Save automático** depois de cada sessão e a cada mudança no plano de treino.
- **Três slots manuais**, mais exportação e importação de arquivo `.json`.
- Cada save é validado (estrutura, consistência e checksum) ao ser gravado e ao ser carregado. Arquivos corrompidos ou editados à mão são recusados, e a versão anterior do slot é usada como cópia de segurança.
- A corrida em andamento não é salva: se você recarregar a página durante a prova, ela recomeça da largada, com o mesmo grid e a mesma sorte.

## Estrutura do projeto

```
src/
  domain/       schemas Zod e tipos (fonte única da verdade), rótulos em português
  data/         equipes, pilotos, pistas, calendário e regras, com justificativas
  engine/       motor do jogo, sem React: simulação, IA, campeonato e carreira
  persistence/  IndexedDB/localStorage, checksum, integridade, migrações e saves
  store/        Zustand (camada fina sobre o motor + autosave)
  ui/           telas, componentes e layout
tests/          testes do motor, do campeonato, da carreira e dos saves
legacy/simdev/  projeto anterior do repositório, preservado e fora do build
```

Documentação detalhada:
- [ARCHITECTURE.md](ARCHITECTURE.md): camadas, fluxo de dados, determinismo, persistência e como estender.
- [GAME_DESIGN.md](GAME_DESIGN.md): regras, fórmulas da simulação, balanceamento e próximas fases.

## Sobre a pasta `legacy/simdev`

Antes deste projeto, o repositório continha o **SimDev**, um jogo de gestão de estúdio de jogos importado de [SuitedTom/SimDev](https://github.com/SuitedTom/SimDev) sob licença MIT. Ele foi movido intacto para `legacy/simdev/`, com sua licença original, e não é usado pelo Apex Motorsport Dynasty.
