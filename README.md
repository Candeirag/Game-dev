# Apex Motorsport Dynasty

Simulador de carreira de automobilismo para navegador. Você cria um piloto, começa no kart regional em uma equipe modesta e sobe a escada até o Grand Prix Mundial: sete categorias, contratos, patrocinadores, finanças, lesões, rivalidades, eventos e corridas decididas volta a volta. Fora do carro, você constrói patrimônio, forma uma família e, ao pendurar o capacete, segue como dirigente: chefe ou dono de equipe. Quando o personagem morre, um herdeiro continua a história.

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

| Comando             | O que faz                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`     | Checa os tipos e gera o build de produção em `dist/`                                                                                                                                                                                                                                                                                            |
| `npm run preview`   | Serve o build de produção localmente                                                                                                                                                                                                                                                                                                            |
| `npm test`          | Roda os testes automatizados (Vitest, mais de 350); leva cerca de 30 segundos                                                                                                                                                                                                                                                                   |
| `npm run typecheck` | Só a checagem de tipos                                                                                                                                                                                                                                                                                                                          |
| `npm run sim`       | Simulador sem interface: joga carreiras com o robô e imprime o relatório de equilíbrio (posição por categoria, caixa por temporada, idade em cada degrau, carreiras que chegam ao topo, títulos e temporadas sem vaga). `npm run sim -- --seeds 50 --seasons 15` é o padrão e leva cerca de 25 s; `--help` lista as opções                      |
| `npm run calibrate` | Imprime os relatórios de balanceamento (carreiras, vidas inteiras, equipes, investimentos em 40 temporadas, saúde do mundo em 60 temporadas) e roda os testes de estresse (vidas com políticas variadas e um "macaco" que aperta botões ao acaso); leva cerca de 6 minutos (no Windows: `set CALIBRATE=1 && npx vitest run --reporter=verbose`) |
| `npm run bench`     | Mede o desempenho do motor e dos saves                                                                                                                                                                                                                                                                                                          |

O build usa caminhos relativos, então a pasta `dist/` funciona em qualquer servidor estático.

## O que há no jogo

- **Sete categorias:** Kart Regional, Nacional e Internacional, Fórmula Júnior, Fórmula Sprint, Fórmula Elite e Grand Prix Mundial, cada uma com as próprias regras de corrida, custos e exigências.
- **Promoção por mérito:** licença (pontos pela posição final), reputação, experiência, idade, dinheiro e uma equipe interessada.
- **Contratos:** duração, salário, custo da vaga, bônus, multa rescisória e cláusula de desempenho; propostas no fim do ano, negociação com margem e paciência, renovação e rescisão; mercado de pilotos entre as temporadas.
- **Piloto:** nove atributos, treino com foco e intensidade, fase, confiança e moral, lesões e recuperação, envelhecimento e declínio.
- **Corrida:** classificação (eliminatória no Grand Prix Mundial), largada, ultrapassagens e defesa, erros e acidentes, danos, quebras, safety car, safety car virtual, bandeira vermelha, punições, clima que muda durante a prova, compostos de pneu, desgaste, paradas, estratégia e combustível.
- **Corrida visual:** a corrida acontece num circuito visto de cima, com os carros (pintura de cada equipe, capacete e número de cada piloto) andando no tempo real da simulação: largada com luzes, disputas lado a lado, ultrapassagens, paradas no pit lane, rodadas, abandonos, safety car, bandeira vermelha com relargada e chuva. Há torre de tempos, câmera geral ou acompanhando um carro, pausa e velocidades de 1× a 8×.
- **Feito para o celular deitado:** um trilho lateral leva às áreas principais (Painel, Fim de semana, Piloto, Equipe, Carreira e "Mais") e a barra superior traz caixa, reputação e posição no campeonato; o botão que faz a carreira avançar fica sempre no canto inferior direito, ao alcance do polegar. Na corrida, a torre de classificação fica fixa à esquerda (posição, piloto, equipe, pneu e diferença, com a disputa em foco realçada), a pista domina o centro com camadas finas por cima e uma barra fixa no rodapé traz o ritmo de pilotagem, pausa, velocidade e a posição do piloto. Com o celular em pé, no navegador, a navegação vai para uma barra inferior.
- **Moeda pelo país do piloto:** piloto brasileiro vê os valores em reais (R$); os demais, em euros. É só o símbolo: os números da economia são os mesmos.
- **Um veículo por categoria:** kart 4 tempos de chassi tubular (Regional), kart 125 cc carenado (Nacional), kart 125 cc com câmbio (Internacional), Monoposto Júnior, Monoposto Sprint, Monoposto Elite e Monoposto Grand Prix. O mesmo veículo aparece na corrida, na garagem (tela Equipe), no grid e na escada da tela Carreira.
- **Circuitos reais com nomes fictícios:** os 14 autódromos reproduzem o traçado da pista real que inspira cada um (curvas, retas, sentido da corrida, largada e, no Circuito do Oito, o viaduto). Dos 20 kartódromos, 19 reproduzem o traçado de um kartódromo real mapeado no OpenStreetMap (10 no Brasil, 9 na Europa; a pista inglesa tem até a ponte), e a cidade de cada pista é a do kartódromo de referência; só o Circuito do Oásis continua com traçado gerado por regras. O mapa de cada pista aparece no calendário, no painel e antes da largada.
- **Equipes:** primeiro piloto, segundo e reserva; ordens de equipe; confiança, relação com o companheiro e rivalidades; academias das equipes do Grand Prix Mundial.
- **Economia pessoal:** salário, patrocínios, bônus, custo da vaga, padrão de vida, conta de danos e impostos; renda fixa, fundo, ações com cotação que muda a cada etapa, imóveis, empresas, participações em equipes com dividendos, empréstimos e dívida.
- **Eventos:** entrevistas, polêmicas, rivalidades, investigações, protestos, problemas contratuais, pressão de patrocinadores, imprevistos, vida em família e decisões de gestão, todos com consequências sobre os outros sistemas.
- **Família e dinastia:** relacionamento, casamento e divórcio, filhos com personalidade e talento herdado em parte, formação no kart, carreira própria dos filhos (que você pode bancar) e linhagem.
- **Aposentadoria e gestão:** ao parar de correr, você investe, aceita o comando de uma equipe, compra uma ou funda a sua. Decide pilotos, equipe técnica, departamentos, instalações, patrocinadores e a pesquisa do carro (aerodinâmica, chassi, motor, suspensão e fabricação), dentro do regulamento de cada categoria.
- **Morte e sucessão:** o personagem envelhece e morre; um herdeiro assume nas pistas ou nos negócios, com herança, imposto e a equipe da família. O save nunca acaba.

## Como jogar

1. **Nova carreira:** escolha nome, nacionalidade, idade e perfil, distribua 8 pontos livres e assine com uma das três equipes de entrada do kart regional.
2. **Painel:** mostra as **decisões pendentes** (eventos), a próxima etapa, a sua condição (fase, confiança, moral), o programa de treino e as mensagens. As decisões pendentes precisam ser resolvidas antes do fim de semana.
3. **Fim de semana:**
   - **Treino livre:** acerto, simulação de classificação ou ritmo de corrida.
   - **Classificação:** abordagem segura, equilibrada ou ataque total.
   - **Estratégia** (da Fórmula Júnior em diante): escolha entre os planos de pneus calculados para a pista.
   - **Corrida:** em "Ir para a largada" abre a pista. Toque em **Largar**: as luzes apagam e os carros saem. Use **Pausar**, **1× a 8×** e **+1 volta** para controlar o ritmo da transmissão; **Câmera geral** mostra o circuito inteiro e **Meu piloto** acompanha o seu carro (toque em qualquer piloto da classificação, ou num carro, para destacá-lo). Durante a prova você troca o ritmo, pede paradas, responde às ordens de equipe e reage a safety car e chuva; a decisão vale para a volta seguinte à que o líder está fazendo. O "engenheiro automático" cuida de paradas e combustível, se você preferir. **Reiniciar visualização** mostra de novo o que já aconteceu, sem simular outra vez, e **Simular até o fim** vai direto ao resultado. Quem prefere a tabela antiga usa "Modo cronometragem".
4. **Entre as etapas:** ajuste o treino, acompanhe a confiança da equipe e as rivalidades (tela Equipe), o interesse das equipes e os requisitos do próximo degrau (tela Carreira), e o dinheiro (tela Vida).
5. **Fim de temporada:** na tela Carreira, veja o fechamento do ano e as propostas. Negocie, confira os requisitos de cada uma e assine.
6. **Fora das pistas:** a tela Vida (em "Mais") reúne tudo, com um resumo por linha. Em Finanças, aplique o dinheiro (ações, imóveis, empresas, participações) e escolha o padrão de vida. Em Família, acompanhe o parceiro e os filhos; as decisões do casal aparecem como eventos no começo de cada temporada, a partir dos 21 anos.
7. **Depois da carreira de piloto:** na tela Carreira, "Pendurar o capacete" leva às propostas de cargo, às equipes à venda e à fundação de uma equipe. A tela Equipe vira Gestão, e o fim de semana passa a ser do muro dos boxes: você define o treino e a classificação dos seus pilotos e escolhe entre assistir à corrida (com os dois carros da equipe em destaque) ou simular a etapa. O resultado é o mesmo.
8. **Sucessão:** quando o personagem morre (ou passa o comando em vida), escolha o herdeiro e o caminho dele.

O painel traz uma lista de primeiros passos, e a tela "Como jogar" resume as regras.

Dicas:

- No começo, o dinheiro é curto: a família ajuda por cinco anos, e bons resultados atraem patrocinadores maiores. Uma categoria cara sem patrocínio vira dívida.
- Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.
- Do kart nacional dá para ir direto para a Fórmula Júnior.
- Na Fórmula Elite e no Grand Prix Mundial, atacar a corrida inteira acaba com o combustível antes da bandeirada.
- Filho sem formação no kart começa a carreira muito atrás; a formação custa pouco perto do que rende.
- Como dirigente, piloto bom custa caro (ou paga menos pela vaga): a dupla ideal depende do caixa da equipe.
- Em categorias monomarca, só suspensão e fabricação podem ser desenvolvidas; no Grand Prix Mundial, há teto de gastos.

### Verificação

```
npm run check        # lint (Biome), tipos, testes (Vitest) e navegador (Playwright)
npm run check:fast   # o mesmo, sem o Playwright
npm run format       # formatação e correções seguras
```

Os testes travam o comportamento do jogo: a simulação com semente fixa é comparada com valores gravados (`tests/golden`), a mesma semente com as mesmas escolhas tem de dar o mesmo resultado (`tests/determinism.test.ts`), os saves de todas as versões têm de abrir (`tests/fixtures`), e o Playwright percorre o fluxo principal e confere todas as telas em 844×390, 390×844, 1180×820 e 1366×768, acusando imagem sobre texto, página mais larga que a tela e área de toque menor que 44 px. O fluxo de trabalho (uma issue e um PR por tarefa) está em [CLAUDE.md](CLAUDE.md).

### Saves

- **Save automático** depois de cada sessão e de cada decisão.
- **Três slots manuais**, mais exportação e importação de arquivo `.json`.
- Cada save é validado (estrutura, consistência e checksum) ao ser gravado e ao ser carregado, e a versão anterior do slot fica como cópia de segurança.
- **Saves das fases anteriores continuam funcionando:** são convertidos ao abrir, mantendo o piloto, os resultados, o dinheiro, o contrato e o histórico, com os sistemas novos no estado inicial. Uma carreira encerrada na Fase 2 pode voltar como dirigente.
- **O formato do save tem versão** (hoje, a 4). Um save antigo passa por todas as migrações, uma a uma, até a versão atual; um save gravado por uma versão mais nova do jogo não é aberto nem substituído pela cópia de segurança: o jogo pede para atualizar. Quando um save antigo é convertido, o original fica guardado intacto no aparelho (tela Saves, "Cópias de formatos anteriores") e pode ser exportado para a versão que o gravou.
- **Corrida interrompida:** a corrida ao vivo não entra no save, mas o navegador guarda os comandos dados a cada volta. Se a página recarrega no meio da prova, o jogo oferece "Continuar de onde parou" ou "Ver resultado"; a corrida é refeita com os mesmos comandos e dá no mesmo.
- **No aplicativo**, os saves ficam em arquivos do próprio aparelho (não no navegador), entram no backup do sistema e a exportação abre a folha de compartilhamento (salvar em Arquivos, enviar por mensagem ou e-mail).
- No navegador, os saves moram nele, que pode apagá-los: a tela Saves e o fechamento de cada temporada lembram de exportar o `.json` e mostram a data da última exportação. Se o navegador bloquear a gravação, o jogo segue na memória e avisa que o progresso será perdido ao fechar.

## Aplicativo (Android e iOS)

O jogo vira aplicativo com o [Capacitor](https://capacitorjs.com): o build de produção vai dentro do aplicativo e nada vem da rede. A tela fica travada na horizontal, em tela cheia, respeitando o recorte da câmera e a barra de gestos.

| Comando               | O que faz                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run app:sync`    | Faz o build e copia para os projetos `android/` e `ios/`.                                       |
| `npm run app:android` | O mesmo, e abre o projeto no Android Studio (precisa do Android Studio e do SDK do Android 36). |
| `npm run app:ios`     | O mesmo, e abre o projeto no Xcode (precisa de um Mac com uma versão recente do Xcode).         |
| `npm run app:icons`   | Regenera o ícone e a tela de abertura provisórios.                                              |

Para testar num aparelho: rode `npm run app:android` ou `npm run app:ios`, conecte o aparelho (ou escolha um emulador) e use o botão de executar do Android Studio ou do Xcode. Antes de publicar é preciso trocar o identificador provisório (`appId` em `capacitor.config.ts`, e nos projetos nativos), assinar o aplicativo e substituir o ícone e a abertura; a lista das imagens que faltam está em [ASSETS.md](ASSETS.md).

No aplicativo o jogo ganha coisas que o navegador não tem: saves em arquivos do aparelho (com migração automática do que uma versão anterior tiver deixado no armazenamento do navegador embutido), exportação pela folha de compartilhamento e a vibração em momentos importantes (vitória, toque, punição, decisão arriscada), que se liga e desliga em Ajustes.

## Estrutura do projeto

```
src/
  domain/       schemas Zod e tipos (fonte única da verdade), rótulos e os nomes próprios das categorias
  data/         categorias, equipes, pilotos, pistas e regras, com justificativas
  engine/       motor do jogo, sem React
    simulation/   desempenho, clima, treino, classificação
    simulation/race/  motor de corrida (independente da carreira)
    broadcast/    transmissão: traçado dos circuitos e linha do tempo da corrida
    career/       fim de semana, economia, contratos, mercado, temporadas
    economy/      patrimônio pessoal (ações, imóveis, empresas, empréstimos)
    dynasty/      família, carreira dos filhos, morte e sucessão
    management/   gestão de equipe, pesquisa e modo dirigente
    events/       eventos dinâmicos e seus efeitos
    world/        geração de grids
  persistence/  IndexedDB, checksum, integridade, migrações e saves
  config/       configuração de balanceamento e feature flags (premium, anúncios, conquistas da loja; tudo desligado)
  store/        Zustand (camada fina sobre o motor + autosave)
  ui/           telas, componentes e layout
    race/         corrida visual: canvas, pintura dos carros, torre de tempos, controles
  assets/race/  sprites vistos de cima: um veículo por categoria, safety car e cenário
sim/            o robô que joga carreiras e o simulador sem interface (npm run sim)
scripts/        importação dos traçados reais (gera src/data/circuitLayouts.ts e src/data/kartLayouts.ts)
tests/          testes do motor, da carreira, dos saves, da corrida visual, de várias temporadas e de vidas inteiras
legacy/simdev/  projeto anterior do repositório, preservado e fora do build
```

Créditos: os traçados dos autódromos vêm do conjunto de dados [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (licença MIT). Os traçados dos kartódromos contêm dados do [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, sob a licença ODbL 1.0; os arquivos derivados desses dados (`scripts/osm-kart-tracks/` e `src/data/kartLayouts.ts`) seguem a mesma licença. Detalhes em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Os sprites de veículos e de cenário foram gerados no Higgsfield.

Documentação detalhada:

- [ARCHITECTURE.md](ARCHITECTURE.md): camadas, motor de corrida, fluxo de dados, determinismo, persistência, compatibilidade de saves e como estender.
- [GAME_DESIGN.md](GAME_DESIGN.md): todas as regras e fórmulas, tabelas de balanceamento, limitações e próximos passos.

## Sobre a pasta `legacy/simdev`

Antes deste projeto, o repositório continha o **SimDev**, um jogo de gestão de estúdio de jogos importado de [SuitedTom/SimDev](https://github.com/SuitedTom/SimDev) sob licença MIT. Ele foi movido intacto para `legacy/simdev/`, com sua licença original, e não é usado pelo Apex Motorsport Dynasty.
