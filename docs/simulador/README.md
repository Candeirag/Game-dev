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

## Como usar numa fase

1. Antes de mexer numa regra, confira que o relatório atual bate com o da fase anterior:

   ```
   npm run sim --silent > /tmp/agora.txt && diff docs/simulador/fase-0.txt /tmp/agora.txt
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
