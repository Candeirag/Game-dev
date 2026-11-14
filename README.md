# Apex Motorsport Dynasty

Simulador de carreira de automobilismo para navegador. Você cria um piloto, começa no kart regional em uma equipe modesta e sobe a escada até a Fórmula 1: sete categorias, contratos, patrocinadores, finanças, lesões, rivalidades, eventos e corridas decididas volta a volta. Fora do carro, você constrói patrimônio, forma uma família e, ao pendurar o capacete, segue como dirigente: chefe ou dono de equipe. Quando o personagem morre, um herdeiro continua a história.

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
| `npm test` | Roda os 215 testes automatizados (Vitest); leva cerca de 25 segundos |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run calibrate` | Imprime os relatórios de balanceamento (carreiras, vidas inteiras, equipes, investimentos em 40 temporadas, saúde do mundo em 60 temporadas) e roda os testes de estresse (vidas com políticas variadas e um "macaco" que aperta botões ao acaso); leva cerca de 6 minutos (no Windows: `set CALIBRATE=1 && npx vitest run --reporter=verbose`) |
| `npm run bench` | Mede o desempenho do motor e dos saves |

O build usa caminhos relativos, então a pasta `dist/` funciona em qualquer servidor estático.

## O que há no jogo

- **Sete categorias:** Kart Regional, Nacional e Internacional, Fórmula 4, 3, 2 e 1, cada uma com as próprias regras de corrida, custos e exigências.
- **Promoção por mérito:** licença (pontos pela posição final), reputação, experiência, idade, dinheiro e uma equipe interessada.
- **Contratos:** duração, salário, custo da vaga, bônus, multa rescisória e cláusula de desempenho; propostas no fim do ano, negociação com margem e paciência, renovação e rescisão; mercado de pilotos entre as temporadas.
- **Piloto:** nove atributos, treino com foco e intensidade, fase, confiança e moral, lesões e recuperação, envelhecimento e declínio.
- **Corrida:** classificação (eliminatória na F1), largada, ultrapassagens e defesa, erros e acidentes, danos, quebras, safety car, safety car virtual, bandeira vermelha, punições, clima que muda durante a prova, compostos de pneu, desgaste, paradas, estratégia e combustível.
- **Corrida visual:** a corrida acontece num circuito visto de cima, com os carros (pintura de cada equipe, capacete e número de cada piloto) andando no tempo real da simulação: largada com luzes, disputas lado a lado, ultrapassagens, paradas no pit lane, rodadas, abandonos, safety car, bandeira vermelha com relargada e chuva. Há torre de tempos, câmera geral ou acompanhando um carro, pausa e velocidades de 1× a 8×.
- **Um veículo por categoria:** kart 4 tempos de chassi tubular (Regional), kart 125 cc carenado (Nacional), kart 125 cc com câmbio (Internacional), Fórmula 4, Fórmula 3, Fórmula 2 e Fórmula 1. O mesmo veículo aparece na corrida, na garagem (tela Equipe), no grid e na escada da tela Carreira.
- **Circuitos reais com nomes fictícios:** os 14 autódromos reproduzem o traçado da pista real que inspira cada um (curvas, retas, sentido da corrida, largada e, no Circuito do Oito, o viaduto). Os 20 kartódromos têm traçado gerado por regras. O mapa de cada pista aparece no calendário, no painel e antes da largada.
- **Equipes:** primeiro piloto, segundo e reserva; ordens de equipe; confiança, relação com o companheiro e rivalidades; academias das equipes de F1.
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
   - **Estratégia** (da F4 em diante): escolha entre os planos de pneus calculados para a pista.
   - **Corrida:** em "Ir para a largada" abre a pista. Toque em **Largar**: as luzes apagam e os carros saem. Use **Pausar**, **1× a 8×** e **+1 volta** para controlar o ritmo da transmissão; **Câmera geral** mostra o circuito inteiro e **Meu piloto** acompanha o seu carro (toque em qualquer piloto da classificação, ou num carro, para destacá-lo). Durante a prova você troca o ritmo, pede paradas, responde às ordens de equipe e reage a safety car e chuva; a decisão vale para a volta seguinte à que o líder está fazendo. O "engenheiro automático" cuida de paradas e combustível, se você preferir. **Reiniciar visualização** mostra de novo o que já aconteceu, sem simular outra vez, e **Simular até o fim** vai direto ao resultado. Quem prefere a tabela antiga usa "Modo cronometragem".
4. **Entre as etapas:** ajuste o treino, acompanhe a confiança da equipe e as rivalidades (tela Equipe), o interesse das equipes e os requisitos do próximo degrau (tela Carreira), e o dinheiro (tela Finanças).
5. **Fim de temporada:** na tela Carreira, veja o fechamento do ano e as propostas. Negocie, confira os requisitos de cada uma e assine.
6. **Fora das pistas:** em Finanças, aplique o dinheiro (ações, imóveis, empresas, participações) e escolha o padrão de vida. Em Família, acompanhe o parceiro e os filhos; as decisões do casal aparecem como eventos no começo de cada temporada, a partir dos 21 anos.
7. **Depois da carreira de piloto:** na tela Carreira, "Pendurar o capacete" leva às propostas de cargo, às equipes à venda e à fundação de uma equipe. A tela Equipe vira Gestão, e o fim de semana passa a ser do pit wall: você define o treino e a classificação dos seus pilotos e escolhe entre assistir à corrida (com os dois carros da equipe em destaque) ou simular a etapa. O resultado é o mesmo.
8. **Sucessão:** quando o personagem morre (ou passa o comando em vida), escolha o herdeiro e o caminho dele.

O painel traz uma lista de primeiros passos, e a tela "Como jogar" resume as regras.

Dicas:
- No começo, o dinheiro é curto: a família ajuda por cinco anos, e bons resultados atraem patrocinadores maiores. Uma categoria cara sem patrocínio vira dívida.
- Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.
- Do kart nacional dá para ir direto para a Fórmula 4.
- Na F2 e na F1, atacar a corrida inteira acaba com o combustível antes da bandeirada.
- Filho sem formação no kart começa a carreira muito atrás; a formação custa pouco perto do que rende.
- Como dirigente, piloto bom custa caro (ou paga menos pela vaga): a dupla ideal depende do caixa da equipe.
- Em categorias monomarca, só suspensão e fabricação podem ser desenvolvidas; na F1, há teto de gastos.

### Saves

- **Save automático** depois de cada sessão e de cada decisão.
- **Três slots manuais**, mais exportação e importação de arquivo `.json`.
- Cada save é validado (estrutura, consistência e checksum) ao ser gravado e ao ser carregado, e a versão anterior do slot fica como cópia de segurança.
- **Saves das fases anteriores continuam funcionando:** são convertidos ao abrir, mantendo o piloto, os resultados, o dinheiro, o contrato e o histórico, com os sistemas novos no estado inicial. Uma carreira encerrada na Fase 2 pode voltar como dirigente.
- A corrida em andamento não é salva: recarregar a página durante a prova faz a corrida recomeçar da largada, com a mesma sorte.

## Estrutura do projeto

```
src/
  domain/       schemas Zod e tipos (fonte única da verdade), rótulos
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
  store/        Zustand (camada fina sobre o motor + autosave)
  ui/           telas, componentes e layout
    race/         corrida visual: canvas, pintura dos carros, torre de tempos, controles
  assets/race/  sprites vistos de cima: um veículo por categoria, safety car e cenário
scripts/        importação dos traçados reais (gera src/data/circuitLayouts.ts)
tests/          testes do motor, da carreira, dos saves, da corrida visual, de várias temporadas e de vidas inteiras
legacy/simdev/  projeto anterior do repositório, preservado e fora do build
```

Créditos: os traçados dos autódromos vêm do conjunto de dados [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (licença MIT; ver [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)). Os sprites de veículos e de cenário foram gerados no Higgsfield.

Documentação detalhada:
- [ARCHITECTURE.md](ARCHITECTURE.md): camadas, motor de corrida, fluxo de dados, determinismo, persistência, compatibilidade de saves e como estender.
- [GAME_DESIGN.md](GAME_DESIGN.md): todas as regras e fórmulas, tabelas de balanceamento, limitações e próximos passos.

## Sobre a pasta `legacy/simdev`

Antes deste projeto, o repositório continha o **SimDev**, um jogo de gestão de estúdio de jogos importado de [SuitedTom/SimDev](https://github.com/SuitedTom/SimDev) sob licença MIT. Ele foi movido intacto para `legacy/simdev/`, com sua licença original, e não é usado pelo Apex Motorsport Dynasty.
