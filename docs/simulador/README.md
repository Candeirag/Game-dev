# Relatórios do simulador

Um relatório por fase da grande atualização, gerado por `npm run sim` com os argumentos padrão
(50 carreiras, sementes 1 a 50, 15 temporadas cada, robô sem bônus de talento). O relatório não
tem data, duração nem número de versão: enquanto nenhuma regra do jogo mudar, ele sai idêntico.

| Arquivo | Comando |
| ------- | ------- |
| `fase-0.txt` | `npm run sim -- --seeds 50 --seasons 15` (linha de base) |
| `fase-0-talento-4.txt` | o mesmo, com `--talent 4` (um bom jogador) |
| `fase-0-talento-8.txt` | o mesmo, com `--talent 8` (um jogador excelente) |

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
- "Sem vaga" é a temporada em que nenhuma equipe fez uma proposta que o piloto pudesse aceitar e
  ele só correu pela rede de segurança (a vaga gratuita na equipe mais fraca do degrau de baixo).
- Cada semente tem um piloto diferente (perfil, idade de 14 a 17 anos e equipe de estreia), sempre
  o mesmo para a mesma semente.
