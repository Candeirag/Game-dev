# Relatórios do simulador

Um relatório por fase da grande atualização, gerado por `npm run sim` com os argumentos padrão
(50 carreiras, sementes 1 a 50, 15 temporadas cada, robô sem bônus de talento). O relatório não
tem data, duração nem número de versão: enquanto nenhuma regra do jogo mudar, ele sai idêntico.

| Arquivo | Comando |
| ------- | ------- |
| `fase-0.txt` | `npm run sim -- --seeds 50 --seasons 15` (linha de base) |
| `fase-0-talento-4.txt` | o mesmo, com `--talent 4` (um bom jogador) |
| `fase-0-talento-8.txt` | o mesmo, com `--talent 8` (um jogador excelente) |
| `fase-1.txt` | `npm run sim -- --seeds 50 --seasons 15` (idêntico ao da Fase 0: só interface) |
| `fase-2.txt` | o mesmo, com o nascimento sorteado (seção 7 nova: nascença baixa, média e alta; capital e interior; dois talentos e dois defeitos) |
| `fase-2-talento-4.txt` | o mesmo, com `--talent 4` |
| `fase-2-talento-8.txt` | o mesmo, com `--talent 8` |
| `fase-3.txt` | `npm run sim -- --seeds 50 --seasons 15`, com a economia nova (seção 8 nova: portas, temporadas sem porta, resultado do ano por posição e por degrau, entrada na Fórmula Júnior) |
| `fase-3-talento-4.txt` | o mesmo, com `--talent 4` |
| `fase-3-talento-8.txt` | o mesmo, com `--talent 8` |
| `fase-4.txt` | `npm run sim -- --seeds 50 --seasons 15`, com a curva de pneus nova e os lances decisivos (seção 9 nova: lances por corrida, cada opção de cada lance, três faixas pela vantagem do piloto sobre o grid, rivalidades novas) |
| `fase-4-talento-4.txt` | o mesmo, com `--talent 4` |
| `fase-4-talento-8.txt` | o mesmo, com `--talent 8` |
| `fase-5.txt` | `npm run sim -- --seeds 50 --seasons 15`, com os eventos encadeados (seção 10 nova: cartões por etapa e por temporada, categorias, cadeias começadas e concluídas, escolhas de traço e aptidão, propostas de patrocínio e textos repetidos por carreira) |
| `fase-5-talento-4.txt` | o mesmo, com `--talent 4` |
| `fase-5-talento-8.txt` | o mesmo, com `--talent 8` |

## Como usar numa fase

1. Antes de mexer numa regra, confira que o relatório atual bate com o da fase anterior:

   ```
   npm run sim --silent > /tmp/agora.txt && diff docs/simulador/fase-0.txt /tmp/agora.txt
   ```

   Desde a Fase 6, o comando joga duas gerações por padrão, e o relatório ganha a linha "Dinastia:"
   no cabeçalho e a seção 11. Para comparar com os relatórios da Fase 0 à Fase 5, que têm uma
   geração só, rode com `--generations 1` (sai idêntico ao formato antigo):

   ```
   npm run sim --silent -- --generations 1 > /tmp/agora.txt && diff docs/simulador/fase-5.txt /tmp/agora.txt
   ```

2. Depois da mudança, gere o relatório da fase (`--out docs/simulador/fase-N.txt`) e cole no PR
   o que mudou em relação ao anterior. Mudança que afeta as categorias de cima aparece melhor
   com `--talent 4` e `--talent 8`, em que mais carreiras chegam lá.

## Como ler

- O robô joga de forma simples (treino de acerto, classificação e corrida equilibradas, primeira
  opção em cada evento, melhor proposta aceitável). Ele é mais fraco que um jogador atento: o
  que importa é a comparação entre fases, não o número absoluto.
- "Sem vaga" é a temporada em que o piloto não tinha nenhuma proposta que pudesse aceitar e só
  correu pela rede de segurança (a vaga gratuita na equipe mais fraca do degrau de baixo ou, para
  quem já está no primeiro degrau, do próprio kart regional). O relatório separa o motivo: nenhuma equipe fez proposta, havia proposta e faltou dinheiro, ou
  faltou outro requisito. No jogo de hoje ninguém fica um ano inteiro sem correr.
- As decisões que a última etapa deixa pendentes são resolvidas depois do fechamento do ano e
  antes de medir o caixa e de escolher a proposta, como faz o jogador. O jogo congela a posição
  final no fechamento: um evento da última etapa que tire pontos depois disso não muda a posição
  registrada (é assim no jogo de hoje, não só no simulador).
- "Chegar" a um degrau é subir até ele: quem pula um degrau por um atalho e depois cai nele não
  entra na linha desse degrau.
- A população da amostra é fixa (`SIM_POPULATION` em `sim/run.ts`): se o jogo ganhar um perfil ou
  uma equipe de entrada, os 50 pilotos da linha de base continuam os mesmos.
- Se uma carreira quebrar, o comando para com código 1 e diz a semente e a temporada.
- Cada semente tem um piloto diferente (perfil, idade de 14 a 17 anos e equipe de estreia), sempre
  o mesmo para a mesma semente. Desde a Fase 2, cada piloto tem também o nascimento da semente (o
  primeiro sorteio, sem refazer); quem nasce no interior começa na equipe menor do regional.
- A seção 8 (Fase 3) mede a economia e as portas. "Porta" é uma vaga, fora a de aluguel, que o
  piloto consegue aceitar com o que tem, pela academia, com a vaquinha ou com um investidor. A
  maior sequência de temporadas sem porta numa carreira não pode passar de 2. "Resultado do ano" é
  a soma dos lançamentos da temporada: nas piores posições do kart tem de ser negativo (terminar
  mal custa dinheiro). O robô da Fase 3 usa as portas e pega trabalho paralelo quando o caixa não
  cobre o ano; ele também passou a preferir a vaga que não o deixa devendo.
- A seção 7 (Fase 2) separa as carreiras pela nota de nascença, a média das cinco aptidões, em três
  grupos do mesmo tamanho. É ali que se confere que nascer melhor rende carreira melhor.
- A Fase 4 muda todas as corridas, e com elas todas as seções: a curva de pneus nova (o pneu perde
  pouco no começo, estabiliza e cai do penhasco no fim da vida) vale para todos os carros, do kart
  ao topo, e os lances decisivos mexem no resultado do piloto do jogador. Não espere o relatório da
  Fase 4 igual ao da Fase 3 em nenhuma tabela.
- A seção 9 (Fase 4) mede os lances decisivos. Só o piloto do jogador tem lances; os rivais
  continuam disputando posição pela regra de sempre. O robô padrão não responde a nenhum: quem
  escolhe é o estilo do piloto, como em "simular até o fim" (com `--moments safe` ou `--moments
  bold` ele responde a todos com a opção mais segura ou com a mais arriscada, para comparar; a
  linha "Política:" avisa). O que conferir:
  - cada corrida completa (o piloto termina e a prova não é encerrada por bandeira vermelha) tem de
    2 a 4 lances, e a primeira linha diz quantas ficaram fora da faixa;
  - na tabela das opções, "deu certo" e "chance mostrada" têm de andar juntas: a chance que a tela
    exibe é a que resolve o lance;
  - na tabela das três faixas, as corridas são separadas em grupos do mesmo tamanho pela vantagem
    do piloto sobre o grid na hora da corrida (a nota geral dele menos o nível médio dos pilotos da
    categoria; a nota sozinha se confunde com a categoria, porque quem melhora sobe de degrau). É
    ali que se confere o critério da fase, "pilotos melhores vencem mais lances": da faixa baixa
    para a alta, a chance mostrada na opção arriscada e os lances arriscados vencidos por corrida
    têm de crescer. "Saldo" é lances vencidos menos perdidos por corrida; o registro do lance não
    diz quantas posições ele valeu, e o relatório não estima;
  - "rivalidade nova" é o toque num lance com um piloto que ainda não era rival.
- A seção 11 (Fase 6) mede a dinastia. Desde a Fase 6, a linha de comando joga duas gerações por
  padrão (`--generations 2`): depois das temporadas pedidas, cada carreira continua com o mesmo
  robô. A 1ª geração corre até os 36 anos, faz o ano de transição, vira dirigente (compra uma
  equipe se o caixa permitir, aceita um cargo ou acompanha de fora) e passa o comando em vida quando
  um filho com carreira de piloto chega aos 16 anos; sem filho piloto, aos 60, e o parente jovem
  herda (morrer antes também abre a sucessão). O robô escolhe o herdeiro entre os filhos que já
  correm, pelo que se vê (degrau, teste no kart, avaliação dos treinadores, talentos e defeitos
  revelados, idade); o parente jovem só herda quando nenhum filho corre. A vaga: uma equipe da
  frente, se o patrimônio cobrir; senão, a da família; senão, a equipe em que já corria. A 2ª
  geração corre até os 36 anos ou 22 temporadas e, no fim de cada uma, fica com a proposta da
  equipe da família quando ela está no degrau mais alto ao alcance (senão, a equipe mais forte,
  como o robô de sempre). O bônus de talento (`--talent`) vale para o piloto de cada geração: o
  herdeiro o recebe ao assumir o carro, como o piloto da semente na criação. As seções 1 a 10
  continuam medindo só as temporadas pedidas da 1ª geração: com `--generations 1`, o relatório
  traz só as seções 1 a 10, como até a Fase 5, e leva uns 25 s; com as duas gerações, cerca de
  2 min (quase 3 com `--talent 8`, em que as carreiras vão mais longe).
  O que conferir:
  - na tabela das gerações, a 1ª conta a vida de piloto inteira (até parar), e não só as
    temporadas da amostra; o critério da fase é a 2ª geração chegar mais longe em média ("degrau
    mais alto", "monopostos", "topo" e a comparação pela semente) sem ganhar tudo ("não ganha
    tudo": a parcela das temporadas da 2ª geração com título e o máximo numa carreira);
  - as linhas "2ª: filho herdeiro" e "2ª: parente jovem" separam a 2ª geração por quem herdou. O
    parente jovem nasce na sucessão, com potencial próprio, sem herança de traços nem teste no
    kart: são os filhos herdeiros que medem as regras da dinastia;
  - a comparação pela semente é uma tabela de quatro medidas (degrau mais alto, títulos, vitórias
    e temporadas no topo), com todas as carreiras e só as de filho herdeiro. Com `--talent 8`,
    quase toda carreira chega ao topo e o degrau mais alto empata: aí valem as outras medidas;
  - a herança por quem herdou (patrimônio deixado, imposto, parte dos irmãos e o que ficou com o
    herdeiro; quando o parente herda, os filhos não recebem parte), a vaga do herdeiro, o que se
    sabia do filho herdeiro na escolha, os filhos por família, os testes no kart, os traços
    revelados antes da escolha, os parentes por caminho, o papel do ano de transição e as
    temporadas pela equipe da família;
  - em cada fechamento da dinastia o simulador confere a integridade da carreira e o formato do
    save: um estado inválido para o comando com a semente e a temporada.
