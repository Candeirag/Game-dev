# Game Design: Apex Motorsport Dynasty

## Visão

Um simulador de carreira de automobilismo: o jogador vive a trajetória de um piloto, do kart regional em uma equipe modesta até a Fórmula 1. A Fase 1 entregou um campeonato de kart jogável. A Fase 2 transforma isso em uma carreira completa, em que resultados, dinheiro, contratos, relações e eventos se influenciam.

**Pilares**
1. **Decisões que importam.** Treino, classificação, estratégia, ritmo de corrida, negociação, dinheiro e imprensa: cada escolha tem custo e benefício.
2. **Simulação crível.** Resultados nascem de atributos, equipamento, pista, clima e condição do piloto, com sorte limitada e explicável.
3. **Sistemas interligados.** Um toque na pista vira dano (conta a pagar), punição (grid da próxima etapa), rivalidade (mais risco nas disputas), investigação (decisão do jogador) e queda na confiança da equipe (contrato).
4. **Progressão conquistada.** Subir de categoria exige resultados, licença, reputação, experiência, idade, dinheiro e uma equipe interessada.

## Loop principal

```
Entre etapas:    decisões pendentes (eventos) → treino (foco e intensidade) →
                 finanças e investimentos → mensagens
Fim de semana:   treino livre (programa) → classificação (abordagem) →
                 estratégia de pneus → corrida (ritmo, boxes, ordens de equipe)
Após a etapa:    pontos → dinheiro → condição → licença → relações →
                 patrocinadores → evolução → interesse das equipes → eventos
Fim de temporada: reputação e licença → contas do ano → contrato e academia →
                 propostas e negociação → mercado de pilotos → novo ano
```

## A escada

| Degrau | Categoria | Etapas | Corrida | Vaga por ano | Requisitos (licença · reputação · experiência · idade) |
| --- | --- | --- | --- | --- | --- |
| 1 | Kart Regional | 10 | sem paradas | € 16 a 30 mil | início da carreira |
| 2 | Kart Nacional | 10 | sem paradas | € 34 a 60 mil | 2 pts · 10 · 26 · 13 anos |
| 3 | Kart Internacional | 10 | sem paradas | € 90 a 150 mil | 8 pts · 18 · 34 · 14 anos |
| 4 | Fórmula 4 | 10 | 28 min; safety car, bandeira vermelha, clima variável | € 240 a 380 mil | 12 pts · 25 · 40 · 15 anos |
| 5 | Fórmula 3 | 10 | 40 min; + safety car virtual e ordens de equipe | € 620 a 950 mil | 18 pts · 36 · 50 · 16 anos |
| 6 | Fórmula 2 | 12 | 58 min; + parada obrigatória (dois compostos) e combustível | € 1,6 a 2,4 mi | 25 pts · 48 · 58 · 17 anos |
| 7 | Fórmula 1 | 14 | 82 min; + três compostos, intermediário, classificação eliminatória | salário de € 0,6 a 14 mi | 40 pts · 60 · 64 · 18 anos |

Do kart nacional é possível ir direto para a F4, como na vida real. Além dos requisitos esportivos, é preciso uma proposta de uma equipe do degrau de cima e dinheiro para a vaga.

### Requisitos de promoção
- **Resultados e licença.** Cada temporada rende pontos de licença pela posição final (por exemplo, F3: 30, 25, 20, 15, 12…; F2: 40 para os três primeiros). Vale a soma das últimas três temporadas. A F1 exige 40, no espírito da superlicença.
- **Reputação.** Prestígio de 0 a 100, ancorado ao degrau: cada temporada tem uma nota (base da categoria + bônus da posição) e a reputação anda metade do caminho até ela, mais 0,5 por vitória. Bases: 5, 15, 27, 38, 50, 62 e 74. Bônus: campeão +22, vice +18, 3º +15, até 5º +13, até 10º +6, até 15º 0, abaixo −5. Um campeão regional fica perto de 20, não de 100; quem termina sempre entre os cinco primeiros cumpre o requisito do degrau seguinte a cada ano.
- **Experiência.** O atributo cresce só competindo: +1,6 por etapa × (1 − exp/110).
- **Idade.** Mínima por categoria, contada para a temporada seguinte.
- **Finanças.** A temporada precisa se pagar (patrocínios, salário e academia cobrem vaga, custo de vida e treino) ou o saldo projetado não pode passar do limite de crédito (30% do custo líquido da vaga).
- **Proposta de equipe.** Depende do interesse (ver Mercado).

## Piloto

### Atributos (0 a 100)
| Atributo | Efeito na simulação |
| --- | --- |
| Velocidade | 64% da nota de ritmo no seco. |
| Consistência | 10% do ritmo. Reduz o desvio das voltas e a chance de erro. |
| Ultrapassagem / Defesa | Sucesso nas disputas de posição. |
| Concentração | 8% do ritmo. Reduz o cansaço, melhora a largada e evita excesso de velocidade no pit lane. |
| Inteligência de corrida | 10% do ritmo. Melhora o acerto, reduz toques e faz reagir mais cedo à mudança de clima. |
| Gestão de pneus | Reduz o desgaste em até 30%. |
| Chuva | Na pista molhada, substitui até 60% da nota de ritmo. |
| Experiência | 8% do ritmo. Melhora a largada e o acerto. |

### Condição
Três indicadores de 0 a 100, neutros em 50, para o jogador e para a IA:
- **Fase:** média móvel (60% do valor anterior) da nota de cada corrida: 50 + 6 por posição acima ou abaixo da meta da equipe. Vale até ±0,12% no tempo de volta.
- **Confiança:** vitória +10, pódio +6, dentro da meta +2, abaixo −3, acidente por erro próprio −8; volta 10% do caminho até 50 a cada etapa. Muda a chance de erro (de −25% a +25%) e o sucesso nas disputas.
- **Moral:** reage a resultados, abandonos e eventos; volta 15% do caminho até 55. Muda a regularidade das voltas (±10%) e o rendimento do treino (de −20% a +20%).

### Treino e evolução
```
ganho = (0,6 × peso_do_foco + 0,08) × fator_idade × min(1, distância_ao_potencial / 20)
        × variação(0,75 a 1,25) × intensidade × moral × academia
```
- **Foco:** Velocidade, Disputa e estratégia, Consistência mental, Gestão de pneus, Pilotagem na chuva ou Equilibrado.
- **Intensidade:** leve (60% do ganho, custo baixo, +2 de fase por etapa), normal, ou intenso (140%, mais que o dobro do custo, −2 de fase, 1,5% de risco de lesão leve por etapa).
- **Idade:** fator 1,15 até 17 anos; 1,0 até 21; 0,85 até 25; 0,55 até 29; 0,25 depois.
- **Academia:** +10%.
- **Pré-temporada:** dois ciclos de treino.

### Lesões e recuperação
Um acidente que tira o piloto da corrida tem chance de lesão (5% no kart, 4% nos monopostos, 2% na F1). 65% são leves (1 a 2 etapas; o piloto pode correr 0,3% mais lento e com 30% mais erros, ou descansar) e 35% são graves (2 a 5 etapas fora). Quando um titular está fora, o **reserva** da equipe corre no lugar. As lesões cicatrizam na pré-temporada.

### Envelhecimento e declínio
A partir dos 31 anos, velocidade, concentração, ultrapassagem e chuva caem a cada temporada: 0,25 ponto por ano acima de 30, com variação de ±30% (cerca de 1 ponto por ano aos 34, 2 aos 38). Leitura de corrida, gestão de pneus e experiência não caem. O potencial acompanha a queda. Na F1, a IA se aposenta aos 38, ou aos 34 se estiver abaixo do nível do grid.

## Fim de semana

### Treino livre
| Programa | Benefício |
| --- | --- |
| Trabalho de acerto | +0,10 de qualidade de acerto (≈0,035 s por volta no fim de semana todo). |
| Simulação de classificação | ≈0,07 s na volta lançada. |
| Ritmo de corrida | 15% menos desgaste de pneus. |

Qualidade do acerto: `0,2 + retorno do piloto × 0,35 + bônus do programa + ruído(σ 0,2)`. Um acerto perfeito vale 0,7% do tempo de volta.

### Classificação
- **Sessão única** (até a F2): três tentativas; vale a melhor.
- **Eliminatória** (F1): três fases de duas tentativas; a cada uma das duas primeiras, os cinco mais lentos são eliminados.
- **Abordagem:** segura (+0,08%, metade do risco), equilibrada, ou ataque total (−0,10%, risco × 2,2). O risco em volta lançada é 4 vezes o de corrida.
- **Punições de grid** herdadas da corrida anterior ou de investigações deslocam o punido para trás.

### Estratégia de pneus (categorias com boxes)
| Composto | Ritmo | Desgaste | Dura até o "penhasco" |
| --- | --- | --- | --- |
| Macio | −0,6% | × 1,7 | ≈15 voltas |
| Médio | referência | × 1,0 | ≈26 voltas |
| Duro | +0,5% | × 0,68 | ≈37 voltas |
| Intermediário | ideal com pista de 15% a 65% molhada | × 1,0 | |
| Chuva | ideal acima de 50% | × 0,8 | |

Além de 80% de desgaste, o pneu perde 8% por unidade de desgaste extra. Pneu errado custa caro: pneu de seco com 30% de umidade perde 6% da volta e multiplica os erros. Antes da largada, o motor lista as estratégias viáveis com a perda estimada (desgaste, ritmo do composto e tempo de box); na F1, uma e duas paradas ficam próximas, e a escolha depende da pista e do piloto. Na F2 e na F1, quem não usa dois compostos em corrida seca leva 30 s.

### Corrida
O jogador acompanha volta a volta (1×, 2×, 4×, 8×, ou volta por volta) e decide:
- **Ritmo:** conservador (+0,25%, erros × 0,6, pneus × 0,8, combustível × 0,93), equilibrado, ou agressivo (−0,15%, erros × 1,5, pneus × 1,25, combustível × 1,06, mais ataque e mais risco de toque).
- **Boxes:** as paradas planejadas acontecem sozinhas; o jogador pode parar a qualquer volta com o composto que quiser, cancelar a parada planejada ou ligar o engenheiro automático.
- **Ordens de equipe:** quando chega uma, a corrida para e espera a resposta.

## Motor de corrida

### Tempo de volta
```
base   = referência da pista × fator da categoria × (1 + 9% × umidade)
perdas = (100 − nota do piloto) × 0,022%
       + (100 − nota do carro)  × 0,014% × peso do carro na categoria
       − acerto × 0,7%
       + 1,4% × desgaste² + penhasco + composto + pneu errado
       + combustível + dano + modo + fase do piloto
volta  = base × (1 + perdas) × (1 + N(0,1) × σ)
```
O peso do carro vai de 1 (kart) a 4 (F1): no kart, o piloto decide; na F1, o carro pesa quatro vezes mais.

### Incidentes
- **Erros:** chance por volta de `0,3% + (100 − consistência) × 0,012% + cansaço + chuva`, multiplicada pelo modo, pela confiança e pelo pneu. 72% erro leve, 25% rodada, 3% batida (60%, 34% e 6% na chuva).
- **Quebra mecânica:** `(100 − confiabilidade)² × 0,00015%` por volta.
- **Danos:** toques e rodadas danificam o carro (até 1,2% mais lento); dano total tira o carro da corrida. O reparo custa 9 s no box. Nas categorias de base, o piloto paga a conta.
- **Combustível (F2 e F1):** o tanque leva 3% além da distância; o tanque cheio custa 2,5% de ritmo. Atacar a corrida inteira consome 6% a mais: sem neutralizações, o carro para antes do fim. A IA e o engenheiro automático poupam quando a conta aperta.

### Disputas de posição
```
logit = −0,6 + (ataque − defesa)/18 + 3,5 × vantagem_de_ritmo(s) − 3,0 × dificuldade_da_pista
        + modos + confiança
```
Uma tentativa frustrada tem risco de toque (cresce com a agressividade e com a **rivalidade** entre os dois; cai com a leitura de corrida). Um quarto dos toques tira alguém da prova.

### Direção de prova
| Incidente | Safety car | Safety car virtual | Bandeira vermelha |
| --- | --- | --- | --- |
| Batida | 40% | 30% | 2% |
| Toque | 50% | 25% | 5% |
| Quebra | 12% | 40% | - |
| Rodada | - | 6% | - |

- **Safety car** (3 a 5 voltas): o pelotão se reagrupa a 0,5 s, ninguém ultrapassa, parar custa metade do tempo; a relargada lançada facilita ultrapassagens.
- **Safety car virtual** (1 a 2 voltas): posições congeladas, parada 35% mais barata.
- **Bandeira vermelha:** com pista encharcada, um acidente tem 25% de chance extra. Antes de 75% da prova, há relargada parada, com reparos e troca de pneus livres; depois disso, a corrida é encerrada.

### Punições
| Infração | Punição |
| --- | --- |
| Queimar a largada | 5 s |
| Causar um toque (60% de chance de culpa) | 5 s e 1 ponto na licença |
| Causar um toque que tira o rival da prova | 10 s, 2 pontos e 3 posições no próximo grid |
| Excesso de velocidade no pit lane, liberação insegura | 5 s |
| Limites de pista, nos monopostos (3 erros leves, e a cada 2 depois) | 5 s |
| Não usar dois compostos no seco (F2 e F1) | 30 s |

As punições em tempo entram no tempo final. Com 12 pontos na licença, o piloto é suspenso por uma etapa.

### Clima
O clima do fim de semana vem de uma frente climática com frequência igual à climatologia da pista. Nos monopostos, a pista pode mudar durante a corrida: chuva que chega (45% da chance de chuva da pista) ou pista que seca (55% das largadas molhadas). O jogador recebe uma previsão com erro de até três voltas.

### Frequências medidas (`npm run calibrate`, médias por corrida)
| Categoria | Safety car | Virtual | Vermelha | Paradas por carro | Abandonos | Punidos |
| --- | --- | --- | --- | --- | --- | --- |
| Kart | - | - | - | - | 0,7 | 1,0 |
| F4 | 0,5 | - | 0,04 | 0,2 | 0,5 | 0,9 |
| F3 | 0,7 | 0,6 | 0,13 | 0,2 | 0,9 | 1,2 |
| F2 | 1,0 | 0,7 | 0,10 | 1,0 | 1,0 | 1,6 |
| F1 | 1,0 | 0,9 | 0,10 | 1,6 | 1,4 | 1,5 |

## Equipes

- **Hierarquia.** Cada equipe tem primeiro piloto, segundo piloto e reserva. O papel do jogador vem do contrato; o da IA, do valor de mercado.
- **Ordens de equipe** (F3 em diante): se o segundo piloto está logo à frente do primeiro (até 0,6 s) e mais lento, a equipe pede a troca, uma vez por corrida. A IA obedece em 85% dos casos. O jogador escolhe: obedecer (+5 de confiança da equipe, +4 na relação) ou ignorar (−10 nas duas, e uma reunião com o chefe).
- **Boxes.** Quando os dois carros param juntos, o de trás espera 3 s. A qualidade da equipe de box define o tempo e o risco de parada lenta.
- **Confiança da equipe.** +1 por posição acima da meta (de −5 a +6 por etapa), −5 em abandono por erro, cai com danos e punições, e volta 4% do caminho até 50. Abaixo de 18, a equipe rescinde o contrato.
- **Relação com o companheiro** e **rivalidades.** Toque: +15 de rivalidade (+25 se alguém abandona); vizinho de tabela a até 10 pontos: +3 por etapa; perde 2 por etapa. A rivalidade aumenta o risco de toque nas disputas com aquele piloto.
- **Academia.** Equipes de F1 mantêm academias e convidam para avaliação quem está entre os cinco primeiros, tem até 21 anos e corre do kart internacional à F2. O piloto aprovado tem 70% da vaga paga, +10% no treino e mais interesse das equipes ligadas à academia. Duas temporadas fora dos seis primeiros e ele é dispensado.
- **Evolução.** Equipes que superam a expectativa ganham até 2 pontos de motor e chassi por ano; as que decepcionam perdem.

## Contratos e mercado

### Interesse das equipes
Cada equipe avalia o jogador pelo que ela mesma espera (0 a 100):
```
45% desempenho  (posição no campeonato comparada à meta da equipe)
30% nível       (nota geral comparada ao nível dos pilotos dela)
15% reputação · 10% juventude
```
Uma posição vale seis posições a menos no degrau de cima. A equipe atual pondera a confiança no piloto; equipes ligadas à academia do jogador somam 15. O interesse anda 35% do caminho até o alvo a cada etapa e é visível na tela Carreira.

### Propostas
No fim do ano, fazem proposta as equipes com interesse suficiente (52 na mesma categoria, 50 para promoção, 40 no degrau de baixo); de cada grupo ficam as três mais fortes. Uma **rede de segurança** (vaga sem custo na equipe mais fraca do degrau de baixo) impede que a carreira trave.
- **Custo da vaga:** tabela da categoria pela força da equipe, com desconto de até 45% conforme o interesse.
- **Bolsa de promoção:** campeão, vice e terceiro ganham 60%, 35% e 20% de desconto na vaga do degrau de cima.
- **Duração:** 1 ano, ou 2 com interesse alto (com cláusula de desempenho).
- **Cláusulas:** multa rescisória; cláusula de desempenho (a equipe rescinde se o piloto terminar abaixo da posição combinada).

### Negociação
Cada pedido custa pontos de interesse; a margem é `interesse − 45 − concessões`.

| Pedido | Custo |
| --- | --- |
| Reduzir a vaga em 12% / aumentar o salário em 12% | 8 |
| Melhorar os bônus em 25% | 5 |
| Status de primeiro piloto | 15 |
| Contrato mais curto / retirar a cláusula de desempenho | 4 / 8 |

Um pedido recusado gasta paciência (três recusas e a proposta é retirada).

### Renovação e rescisão
Contrato no fim: a equipe propõe renovar se ainda confia no piloto. Contrato vigente: o jogador pode cumpri-lo ou sair pagando a multa. A equipe rescinde pela cláusula de desempenho ou por quebra de confiança.

### Mercado de pilotos da IA
Entre as temporadas: os três melhores da IA sobem de categoria (na F1, os veteranos se aposentam); quem saiu de contrato, os reservas e o segundo piloto que superou o primeiro (insatisfeito) ficam livres; chegam estreantes; e as equipes escolhem, da mais forte para a mais fraca, o melhor piloto livre. Quando o jogador sobe, os melhores rivais sobem junto.

## Economia

| Receitas | Despesas |
| --- | --- |
| Salário (parcelas por etapa) | Custo da vaga (parcelas por etapa) |
| Patrocínios e bônus de pódio | Custo de vida e estrutura |
| Bônus de contrato (vitória, pódio, pontos, título) | Treino (pela intensidade) |
| Apoio da academia (70% da vaga) | Conta de danos (categorias de base) |
| Apoio da família (€ 24 mil por ano, 5 anos) | Impostos, juros, multas, taxas de eventos |

- **Patrocinadores.** Três cotas. O porte de quem procura o piloto vem dos resultados (entre os três primeiros: grande; entre os oito: médio) e da fama. Pagam 20%, 36% ou 60% do valor de referência da categoria e esperam top 15, top 10 ou top 5. A satisfação sobe e desce a cada etapa; abaixo de 35 há pressão (evento), e só renovam com 60 ou mais. Ao mudar de categoria, o valor acompanha a nova vitrine.
- **Impostos.** Progressivo sobre a renda da temporada (salário, bônus e patrocínios menos o custo da vaga): isento até € 40 mil, 15% até 300 mil, 27,5% até 3 milhões, 37% acima.
- **Investimentos.** Renda fixa (4% ao ano) e fundo de ações (9% em média, desvio de 16%, pode perder). O rendimento entra no fechamento do ano.
- **Dívida.** Caixa negativo paga 14% ao ano. Uma dívida maior que metade da vaga mais cara da categoria seguinte é reduzida a esse teto em um acordo com credores, ao custo de 4 pontos de reputação.

A economia é uma restrição real: um piloto de meio de grid atrai só patrocinadores pequenos e não sustenta por muito tempo uma categoria cara; quem vence atrai cotas grandes, bolsa e academia.

## Eventos dinâmicos

Depois de cada etapa, entram os eventos cuja condição vale (até dois) e, com 45% de chance, um sorteado por peso. O jogador precisa decidir antes do próximo fim de semana. Escolhas com desfecho incerto são sorteadas pela semente da carreira.

| Tipo | Eventos | Consequências possíveis |
| --- | --- | --- |
| Entrevistas | coletiva do vencedor; pressão em má fase | confiança da equipe, confiança, rivalidade, patrocinadores |
| Polêmicas | toque sofrido; vídeo fora de contexto | rivalidade, reputação, patrocinadores |
| Rivalidades | provocação do rival; conflito com o companheiro | risco de toque, multa, confiança da equipe |
| Investigações | comissários após um toque causado; vistoria técnica | posições no próximo grid, pontos na licença, perda dos pontos da etapa |
| Protestos | contra o rival à frente; contra o seu resultado | pontos do rival ou seus, taxa, rivalidade |
| Contrato | aporte extra pedido pela equipe; sondagem de outra equipe; vontade de sair | dinheiro, rendimento do carro, custo da vaga, multa rescisória, interesse de equipes |
| Patrocínio | pressão por resultados; proposta nova (ou troca por um maior) | receita, satisfação, fase |
| Inesperados | virose; prova de exibição; convite de academia; peça nova | lesão leve, experiência, academia, rendimento do carro |

Todo evento altera estado de jogo: nenhum é só texto.

## Equilíbrio

`npm run calibrate` simula 12 carreiras de 14 temporadas com um robô que joga de forma simples. O "talento" soma pontos aos atributos e representa um jogador que decide melhor:

| Robô | Onde chega em 14 temporadas |
| --- | --- |
| Mediano (talento 0) | F3 ou F2 |
| Bom (talento 4) | F1 aos 26 ou 27 anos, no meio do grid |
| Excelente (talento 8) | F1 aos 24 a 28 anos; em parte das carreiras, vitórias e títulos |

O nível médio dos grids da IA fica de 2 a 4 pontos acima do projetado ao longo dos anos, sem inflar nem desabar.

## Limitações conhecidas e próximos passos
- Só a categoria do jogador é simulada; as outras existem como equipes e propostas.
- O jogador não pode assinar como piloto reserva de uma categoria superior.
- Não há mudanças no meio da temporada (troca de equipe, demissão imediata).
- Corridas sprint, pontuação pela metade e retardatários não são simulados.
- Áudio, visual de pista em 2D e conquistas ficam para uma fase futura.
