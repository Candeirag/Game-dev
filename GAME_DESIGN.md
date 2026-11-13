# Game Design: Apex Motorsport Dynasty

## Visão

Um jogo de carreira e gestão de automobilismo em que o jogador vive a trajetória de um piloto: do kart regional, em uma equipe modesta, até as categorias de topo. A Fase 1 entrega a fundação: um campeonato de kart completo e jogável, com simulação baseada em regras.

**Pilares**
1. **Decisões que importam.** Cada fim de semana tem três decisões com custo e benefício (treino, classificação, ritmo de corrida), além do plano de treino entre as etapas.
2. **Simulação crível.** Resultados nascem de atributos, equipamento, pista e clima, com sorte limitada e explicável.
3. **Progressão sentida.** O piloto evolui de forma visível, a reputação abre portas e a carreira atravessa temporadas.

## Loop principal

```
Entre etapas:   escolher o foco de treino → ler mensagens → ver classificação e calendário
Fim de semana:  Treino livre (programa) → Classificação (abordagem) → Corrida (ritmo, volta a volta)
Após a etapa:   resultado oficial → pontos → evolução → reação da equipe → autosave
Fim de temporada: meta avaliada → reputação → propostas → nova temporada
```

## Piloto

Nove atributos, de 0 a 100 (guardados com casas decimais para permitir evolução gradual):

| Atributo | Efeito na simulação |
| --- | --- |
| Velocidade | 64% da nota de ritmo no seco. É o atributo que mais pesa. |
| Consistência | 10% do ritmo. Reduz o desvio das voltas e a chance de erro. |
| Ultrapassagem | Aumenta a chance de completar uma ultrapassagem. |
| Defesa | Reduz a chance de ser ultrapassado. |
| Concentração | 8% do ritmo. Reduz o cansaço (ruído e erros no fim da corrida) e melhora a largada. |
| Inteligência de corrida | 10% do ritmo. Melhora o retorno de acerto e reduz o risco de toque em disputas. |
| Gestão de pneus | Reduz o desgaste em até 30% em relação à média. |
| Chuva | Na pista molhada, substitui até 60% da nota de ritmo. |
| Experiência | 8% do ritmo. Melhora a largada e o acerto. Só cresce competindo. |

**Nota geral** (só para exibição e para a IA): média ponderada, com 25% de velocidade.
**Potencial**: teto de desenvolvimento dos atributos treináveis.

### Criação
- Três perfis com o mesmo total de pontos (474 nos 8 atributos treináveis): *Talento natural* (rápido, irregular, potencial 92), *Piloto técnico* (regular e cuidadoso, potencial 86) e *Lutador* (forte no roda a roda, potencial 89).
- Mais 8 pontos livres, no máximo 4 por atributo.
- Idade de 14 a 17 anos. Mais jovem significa evolução mais rápida.
- Vaga em uma das três equipes de entrada: Horizonte, Cerrado ou Garagem Nova.

### Evolução
Após cada etapa, para todos os pilotos (jogador e IA):

```
ganho = (0,5 × peso_do_foco + 0,08) × fator_idade × min(1, distância_ao_potencial / 30) × variação(0,75 a 1,25)
```

- **Focos de treino:** Velocidade, Disputa e estratégia, Consistência mental, Gestão de pneus, Pilotagem na chuva e Equilibrado.
- **Fator de idade:** 1,15 até 15 anos; 1,0 de 16 a 18; 0,8 de 19 a 22; 0,5 de 23 a 27; 0,25 depois disso.
- **Experiência:** +1,6 por etapa × (1 − exp/110).
- **Pré-temporada:** equivale a 2 ciclos de treino.
- **IA:** treina sempre o grupo de atributos em que está mais fraca.

## Campeonato regional de kart

- **10 equipes** em 5 níveis, com 2 equipes por nível. Cerca de 20 pontos de kart separam a primeira da última, o que vale uns 0,15 s por volta.
- **20 pilotos**, 2 por equipe, com perfis escritos à mão (prodígio, veterano metódico, especialista em chuva…).
- **10 etapas** de março a setembro, em 10 kartódromos fictícios em cidades reais do Sul, Sudeste e Centro-Oeste.
- **Pontuação:** 25-18-15-12-10-8-6-4-2-1, mais 1 ponto pela pole e 1 pela volta mais rápida (só para quem termina).
- **Desempate:** countback (mais vitórias, depois mais 2º lugares, e assim por diante).
- **Equipes:** soma dos pontos dos dois pilotos.
- **Metas:** cada equipe espera uma posição no campeonato de pilotos (3º, 6º, 10º, 13º ou 16º, conforme o nível).

### Pistas
Cada pista tem comprimento, tempo de referência, número de voltas, dificuldade de ultrapassagem, desgaste de pneus, peso motor/chassi, chance climatológica de chuva e temperatura. Exemplos: o **Planalto** (retas longas, favorece o motor, ultrapassagens fáceis), a **Lagoa Azul** (travada, favorece o chassi, ultrapassagens difíceis), o **Triângulo** (calor e asfalto abrasivo, pneus decisivos) e a **Serra Gaúcha** e o **Litoral Norte** (frequentemente chuvosos).

## Fim de semana

### Treino livre: programa de trabalho
| Programa | Benefício |
| --- | --- |
| Trabalho de acerto | +0,10 de qualidade de acerto sobre os outros programas (≈0,035 s em todas as voltas do fim de semana). |
| Simulação de classificação | ≈0,07 s mais rápido na volta lançada de classificação. |
| Ritmo de corrida | 15% menos desgaste de pneus na corrida. |

A **qualidade do acerto** (0 a 1) é `0,2 + retorno do piloto × 0,35 + bônus do programa + ruído(σ 0,2)`. O retorno combina experiência, inteligência de corrida e chassi. O ruído representa acertar ou errar a janela do kart naquela pista: é a "forma do fim de semana", e vale até ±0,07 s por volta. Um acerto perfeito vale 0,7% do tempo de volta.

### Classificação: abordagem
Três tentativas lançadas com pneus novos; vale a melhor. Uma tentativa com erro é invalidada. O risco de erro em volta de classificação é 4 vezes o de uma volta de corrida.

| Abordagem | Ritmo | Risco de erro |
| --- | --- | --- |
| Segura | +0,08% | ×0,5 |
| Equilibrada | - | ×1 |
| Ataque total | −0,10% (≈0,05 s) | ×2,2 |

### Corrida: ritmo volta a volta
O jogador assiste a corrida em tempo real (1×, 2× ou 4×, ou avança volta a volta) e pode mudar o ritmo a qualquer momento:

| Ritmo | Tempo de volta | Erros | Pneus | Ataque | Defesa | Toques |
| --- | --- | --- | --- | --- | --- | --- |
| Conservador | +0,25% | ×0,6 | ×0,8 | −0,6 | - | ×0,6 |
| Equilibrado | - | ×1 | ×1 | - | - | ×1 |
| Agressivo | −0,15% | ×1,5 | ×1,25 | +0,6 | +0,3 | ×1,6 |

## Simulação

### Tempo de volta
```
base     = tempo de referência da pista × (1 + 9% × umidade)
perdas   = (100 − nota do piloto) × 0,022%
         + (100 − nota do kart)   × 0,014%
         − acerto × 0,7%
         + 1,4% × desgaste²
         + ajuste do modo
volta    = base × (1 + perdas) × (1 + N(0,1) × σ)
σ        = (0,1% + (100 − consistência) × 0,004% + cansaço) × (1 + 0,6 × umidade)
cansaço  = (100 − concentração) × 0,002% × progresso da corrida
```
A nota do kart é `motor × peso_motor + chassi × (1 − peso_motor)`, conforme o traçado.

### Erros e incidentes
- **Chance por volta:** `0,3% + (100 − consistência) × 0,012% + (100 − concentração) × 0,008% × progresso + 2,5% × umidade × (1 − chuva/100)`, multiplicada pelo modo.
- **Gravidade no seco:** 72% erro leve (0,8 a 2,2 s), 25% rodada (4 a 9 s) e 3% batida (abandono). Na chuva: 60%, 34% e 6%.
- **Quebra mecânica por volta:** `(100 − confiabilidade)² × 0,00015%`, ou cerca de 3% por corrida com confiabilidade 70.

### Largada
Os karts partem separados por 0,25 s por posição do grid. A reação tem desvio de `0,5 s × (1 − (experiência + concentração)/200)`. Na primeira volta, a dificuldade de ultrapassagem cai 40%, porque o pelotão está embolado.

### Ultrapassagens
As posições são resolvidas da frente para trás. Um kart que chega a menos de 0,18 s do que está à frente, com volta mais rápida, tenta passar:

```
logit = −0,6 + (ataque − defesa)/18 + 3,5 × vantagem_de_ritmo(s) − 3,0 × dificuldade_da_pista + modos
P(sucesso) = 1 / (1 + e^−logit)
```
- **Se passa:** o kart ultrapassado perde 0,08 s.
- **Se falha:** o atacante perde 0,12 s e fica preso atrás. Há risco de toque de `3,5% × modo × (1,2 − inteligência/100)`; um quarto dos toques tira alguém da corrida.
- **Limite:** no máximo 2 ultrapassagens por piloto por volta.

### Clima
Cada fim de semana tem uma "frente" climática latente. Cada sessão deriva dela com correlação de 0,92, e a sessão tem chuva quando `Φ(z) < chance de chuva da pista`. Isso garante que a frequência de chuva siga exatamente a climatologia da pista, o que é verificado em teste. Da chuva, 55% é pista encharcada (umidade de 0,75 a 1); o resto é pista úmida (0,3 a 0,55). A chuva esfria o asfalto.

### IA
Todas as decisões seguem regras explícitas, sem sorteio:
- **Treino:** inexperiente (experiência < 45) faz acerto; em pista abrasiva, quem cuida mal dos pneus faz ritmo de corrida; onde ultrapassar é difícil, simulação de classificação.
- **Classificação:** consistência ≥ 78 ataca; < 62 joga seguro; na chuva, quem não domina o molhado joga seguro.
- **Corrida:** poupa pneus gastos; ataca nas voltas finais se houver alguém a menos de 0,8 s; administra quando está isolado; pilotos de boa leitura atacam a menos de 0,5 s; bons defensores fecham a porta no fim.

### Justificativa da aleatoriedade
A sorte entra apenas em: ruído de volta (limitado pela consistência), forma do fim de semana (acerto), erros, quebras, desfecho das disputas e clima. Toda ela vem de sementes derivadas da carreira. Não existe sorteio sem regra, e recarregar o save não muda o resultado de uma mesma decisão.

### Calibração (20 temporadas, `npm run calibrate`)
- Títulos divididos entre os favoritos (por exemplo, Andrade 11, Monteiro 8 e Lima 1); vitórias distribuídas entre 4 a 6 pilotos.
- Cerca de 50 ultrapassagens, 4,5 erros e 0,7 abandono por corrida.
- O estreante na equipe mais fraca termina em média entre 16º e 18º, conforme suas decisões; com escolhas boas, cumpre a meta (16º) e pontua.

## Fim de temporada

- **Reputação:** `+3 × (meta − posição final) + 2 × vitórias + pódios`, limitada entre 0 e 100.
- **Propostas:** uma equipe faz proposta se `posição ≤ meta da equipe + 2 + ⌊reputação/25⌋`. A equipe atual renova se o jogador não ficou mais de 6 posições abaixo da meta. As equipes de entrada sempre oferecem vaga.
- **Transferência:** o piloto mais fraco da nova equipe ocupa a vaga deixada pelo jogador.
- **Equipes:** evoluem até ±2 pontos de motor e chassi conforme superem ou decepcionem a expectativa; as metas são recalculadas.
- **Envelhecimento:** todos ficam um ano mais velhos e passam pela pré-temporada.

## Próximas fases (fora do escopo da Fase 1)
- Escada de categorias (kart nacional, Fórmula 4, Fórmula Regional…), com propostas entre categorias.
- Contratos, salário, patrocínio, empresário e orçamento.
- Rivalidades, moral, mídia e eventos narrativos.
- Aposentadoria e chegada de novos pilotos da IA, mercado de transferências entre pilotos da IA.
- Estratégia de pneus e paradas nas categorias de monoposto; telemetria detalhada.
- Áudio, visual de pista em 2D e conquistas.
