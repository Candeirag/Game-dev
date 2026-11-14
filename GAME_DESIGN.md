# Game Design: Apex Motorsport Dynasty

## Visão

Um simulador de carreira de automobilismo: o jogador vive a trajetória de um piloto, do kart regional em uma equipe modesta até a Fórmula 1, e depois a de uma família inteira. A Fase 1 entregou um campeonato de kart jogável. A Fase 2 fez disso uma carreira completa, em que resultados, dinheiro, contratos, relações e eventos se influenciam. A Fase 3 acrescenta a vida fora do carro: patrimônio, família, aposentadoria, gestão de equipe, morte e sucessão.

**Pilares**
1. **Decisões que importam.** Treino, classificação, estratégia, ritmo de corrida, negociação, dinheiro e imprensa: cada escolha tem custo e benefício.
2. **Simulação crível.** Resultados nascem de atributos, equipamento, pista, clima e condição do piloto, com sorte limitada e explicável.
3. **Sistemas interligados.** Um toque na pista vira dano (conta a pagar), punição (grid da próxima etapa), rivalidade (mais risco nas disputas), investigação (decisão do jogador) e queda na confiança da equipe (contrato).
4. **Progressão conquistada.** Subir de categoria exige resultados, licença, reputação, experiência, idade, dinheiro e uma equipe interessada.
5. **A carreira é da família.** O piloto envelhece, para de correr e morre; o dinheiro, a equipe e o sobrenome passam adiante. O save não tem fim.

## Loop principal

```
Entre etapas:    decisões pendentes (eventos) → treino (foco e intensidade) →
                 finanças e investimentos → mensagens
Fim de semana:   treino livre (programa) → classificação (abordagem) →
                 estratégia de pneus → corrida (ritmo, boxes, ordens de equipe)
Após a etapa:    pontos → dinheiro → condição → licença → relações →
                 patrocinadores → evolução → interesse das equipes → eventos
Fim de temporada: reputação e licença → contas do ano (patrimônio e imposto) →
                 família (temporada dos filhos, relação do casal) →
                 contrato e academia → propostas e negociação →
                 mercado de pilotos → novo ano (eventos de família)

Depois das pistas (modo dirigente):
Entre etapas:    decisões de gestão → equipe técnica, instalações, pesquisa
Fim de semana:   treino e classificação dos dois pilotos → corrida simulada
Após a etapa:    caixa da equipe → pesquisa e melhorias → evolução das rivais
Fim de temporada: avaliação e prêmio → patrimônio, imposto e família →
                 pilotos e patrocinadores → cargos, compra ou fundação
A qualquer fim de ano: mortalidade → sucessão → herdeiro (piloto ou dirigente)
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
- **Evolução.** Cada posição do campeonato de equipes tem um carro de referência (a escada original da categoria). A cada ano, a equipe anda 15% do caminho entre o carro dela e a referência da posição em que terminou (no máximo 2 pontos): quem termina acima do que o carro vale melhora; quem termina abaixo piora. Soma-se o acerto ou erro do projeto do ano (cerca de 1,5 ponto por equipe, soma zero no grid) e, a cada cinco temporadas, uma mudança de regulamento que dobra essa variação. Medido em 60 temporadas: a média dos carros não sai de 75, a distância entre o melhor e o pior se mantém, e os títulos se dividem entre 4 a 8 equipes, em eras.

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
| Dividendos, aluguéis, lucro de empresas | Formação e carreira dos filhos, parcelas de empréstimos |

- **Patrocinadores.** Três cotas. O porte de quem procura o piloto vem dos resultados (entre os três primeiros: grande; entre os oito: médio) e da fama. Pagam 20%, 36% ou 60% do valor de referência da categoria e esperam top 15, top 10 ou top 5. A satisfação sobe e desce a cada etapa; abaixo de 35 há pressão (evento), e só renovam com 60 ou mais. Ao mudar de categoria, o valor acompanha a nova vitrine.
- **Impostos.** Progressivo sobre a renda da temporada (salário, bônus e patrocínios menos o custo da vaga, mais dividendos, aluguéis e lucro das empresas): isento até € 40 mil, 15% até 300 mil, 27,5% até 3 milhões, 37% acima.
- **Investimentos.** Renda fixa (2,5% ao ano) e fundo de ações (4% em média, desvio de 15%, pode perder). O rendimento entra no fechamento do ano. O jogo não tem inflação, então estes são retornos reais: em 40 temporadas, a renda fixa multiplica o valor por 2,7; o fundo, por 3,4 no caso típico, com um caso em dez abaixo de 1,0 e um em dez acima de 9,5.
- **Dívida.** Caixa negativo paga 14% ao ano. Uma dívida maior que metade da vaga mais cara da categoria seguinte é cobrada: primeiro os credores executam os bens do piloto (aplicações, ações, imóveis, empresas e participações, nessa ordem); só o que continuar acima do teto é perdoado, ao custo de 4 pontos de reputação. Quem tem patrimônio não tem dívida perdoada.

A economia é uma restrição real: um piloto de meio de grid atrai só patrocinadores pequenos e não sustenta por muito tempo uma categoria cara; quem vence atrai cotas grandes, bolsa e academia.

## Patrimônio pessoal

Além do caixa, da renda fixa e do fundo de ações, o jogador pode montar um patrimônio. Cada classe de ativo tem um papel diferente:

| Ativo | Como rende | Risco e custo |
| --- | --- | --- |
| Ações (6 empresas) | Preço muda a cada etapa; dividendos de 0% a 3,5% no fim do ano | Retorno total médio de 3,5% a 6% ao ano, com volatilidade de 13% a 36%; metade do movimento é do mercado inteiro |
| Imóveis (5) | Aluguel de 3% a 7% ao ano, em parcelas por etapa; valorização média de 1% a 2,5% | Manutenção de 1% a 3%, imposto anual de 0,6%, corretagem de 5% na venda |
| Empresas (4) | Lucro anual = base × nível × (0,4 + reputação/60) × sorte do ano (0,7 a 1,3) | Exigem reputação mínima; com fama baixa, mal se pagam; na venda valem 60% do investido mais dois anos de lucro (não dão lucro na revenda) |
| Participações em equipes (5%, 10% ou 25%) | Dividendo pela posição da equipe: de 6% do valor (campeã) a −1,2% (última, que pede aporte) | O valor da fatia acompanha a posição no campeonato; uma equipe que deixa de ser acompanhada volta, aos poucos, para a força original dela |

- **Uso próprio dos imóveis.** Em vez de alugar, o jogador pode usar o imóvel: o apartamento e a casa de campo dão moral a cada etapa (a casa também melhora a relação com a família); o galpão vira oficina e barateia o treino em 20%; o kartódromo corta pela metade o custo da formação dos filhos e a faz render 25% mais; a cobertura em Mônaco é residência fiscal e reduz o imposto de renda em 25%.
- **Empréstimos.** Juros de 9% ao ano, prazos de 2, 4 ou 6 temporadas, parcelas iguais pagas a cada etapa. Contratado no meio do ano, só paga juros pela parte que falta. O limite é 40% dos ativos mais 1,5 vez a renda anual contratada. É mais barato que o caixa negativo (14%) e mais caro que qualquer aplicação: serve para atravessar um ano caro ou comprar uma equipe, não para investir.
- **Padrão de vida.** Simples (custo de vida normal), confortável (1,8×; +0,4 de moral por etapa; +2 na relação por ano) ou luxo (3,5×; +0,8; +4). Viver com simplicidade desgasta o relacionamento (−1 por ano).
- **Impostos.** Dividendos, aluguéis e lucro das empresas somam-se à renda tributável do ano. Vender com lucro ações, imóveis, empresas, participações ou a própria equipe paga 15% sobre o ganho.
- **Patrimônio líquido** = caixa + aplicações + ações + imóveis + empresas + participações − empréstimos (mais o valor da equipe própria, se houver).

O que acontece com € 100 milhões em 40 temporadas, por estratégia (`npm run calibrate`, quatro sementes, com custo de vida de ex-piloto de F1 e um investidor que mantém o caixa positivo):

| Estratégia | Resultado típico | Faixa |
| --- | --- | --- |
| Só caixa | 0,9× | 0,9× |
| Renda fixa | 2,5× | 2,5× |
| Fundo de ações | 3,4× (400 sementes) | 1,0× a 9,5× |
| As seis ações, em partes iguais | 3,6× | 1,4× a 19× |
| Só Grid Tech (a mais arriscada) | 1,6× | 0,9× a 15× |
| Empréstimo máximo aplicado em ações | 3,2× | 0,7× a 26× |
| 25% da melhor equipe da F1 | 1,7× | 1,6× a 1,8× |
| 25% da pior equipe da F1 | 1,0× | 0,9× a 1,2× |
| Dono passivo de uma equipe | lucro médio de −0,5% a +2,3% do preço da equipe por ano | e a equipe desvaloriza, porque o carro fica para trás |

Antes da auditoria, o fundo e a carteira de ações multiplicavam o dinheiro por 12 a 16 no mesmo prazo, e as caudas passavam de 100×: depois de uma geração, o dinheiro deixava de importar.

## Família e dinastia

No começo de cada temporada, a família pode trazer decisões (eventos da categoria "Família"):

| Evento | Quando | O que está em jogo |
| --- | --- | --- |
| Conhecer alguém | A partir dos 21 anos, solteiro: 35% de chance por ano | Namorar custa um pouco de fase agora; dá moral |
| Casamento | Relação 65 ou mais, depois de um ano juntos | Festa (0,8 custo de vida anual) ou cerimônia simples; a relação se desgasta menos; em um divórcio, o cônjuge leva 30% do patrimônio |
| Filho | Relação 55 ou mais, até os 48 anos, no máximo quatro filhos: 40% de chance por ano | A família cresce; recusar esfria a relação |
| Crise | Relação abaixo de 35 | Terapia, viagem ou ignorar (50% de chance de separação) |
| Kart | Um filho faz 8 anos | Programa completo (€ 28 mil por ano), de fim de semana (€ 9 mil, rende 60%) ou nada |
| Início de carreira | Um filho faz 14 anos e quer correr (vontade 40 ou mais) | Apoio total, parcial ou nenhum; ou proibir |

- **Parceiro.** Tem uma origem (automobilismo, negócios, artes, saúde ou mídia) que dá um benefício: mais aptidão para os filhos, empresas 10% mais lucrativas, moral, uma etapa a menos de recuperação de lesões ou +1 de reputação por ano. A relação muda a cada ano com o padrão de vida, o calendário (mais de 12 etapas: −3), o treino intenso (−2), o casamento (+1) e o tempo em casa (dirigente: +2). Relação de 70 ou mais dá moral a cada etapa; abaixo de 35, tira.
- **Filhos.** Cada um nasce com um ou dois traços de personalidade (determinado, talentoso, frio, agressivo, carismático, rebelde, estudioso, intuitivo), que mexem na evolução, no teto, na vontade de correr, na relação com o jogador, na regularidade e na atração de patrocinadores.
- **Talento herdado.** O teto de desenvolvimento do filho = 50% do melhor nível do jogador + 20% da aptidão do parceiro + 30% de acaso (média 72, desvio 9), mais um desvio individual de 4 pontos e o bônus dos traços, entre 55 e 97. Filhos de um campeão (teto 96) ficam em média 12 pontos acima dos de um piloto mediano (teto 72), mas as duas distribuições se sobrepõem. Os dois melhores atributos do jogador viram pontos fortes do filho.
- **Formação no kart (8 aos 13 anos).** Cada ano bem feito vale cerca de 2 pontos em todos os atributos na estreia e mantém a vontade de correr. Seis anos completos deixam o filho no nível em que o próprio jogador começou; sem formação, ele estreia cerca de 12 pontos abaixo.
- **Carreira própria.** Aos 14, o filho estreia no kart regional. A temporada dele é estimada por fora do campeonato do jogador: a nota competitiva (média entre velocidade e nota geral) mais a vantagem do carro da equipe dele é comparada às 19 outras vagas do grid, com um acaso de 2,5 pontos. Ele ganha pontos de licença e reputação pelas mesmas tabelas do jogador, evolui pela mesma função e só sobe se cumprir os mesmos requisitos e terminar até o 8º lugar.
- **Dinheiro.** A vaga custa o preço de tabela da equipe, menos bolsa (três primeiros) e academia (metade). Os patrocinadores do próprio filho cobrem 20% mais reputação/250 (mais 20% se for carismático); a família paga o resto até o limite do apoio (total: tudo; parcial: metade; nenhum: nada). Sem dinheiro para subir, ele fica; sem dinheiro nem para ficar, corre de favor na pior equipe e, depois de dois anos assim, abandona a carreira. Quem passa da idade da categoria sem subir também para.
- **Avaliação.** O teto de um filho não aparece como número antes de ele correr. Depois de meio ano de kart, os treinadores dão uma avaliação (limitado, mediano, promissor, muito promissor, fora de série).
- **Linhagem.** A tela Família guarda todas as gerações: período, melhor categoria, títulos, vitórias, reputação máxima e patrimônio deixado.

Medido (2.000 filhos por caso, parceiro mediano): com um pai de teto 96, os filhos têm teto médio de 85, 45% chegam a 86 e 19% a 90; com um pai de teto 86, a média é 80 e só 3% chegam a 90. Com o robô (apoio total e formação completa), um filho de teto 81 costuma parar no kart internacional ou na F4; um de teto 89 chegou à F1 aos 28 anos. Em 16 vidas simuladas de pilotos de F1, a segunda geração chegou à F1 em duas, à F2 em quatro e parou entre o kart e a F3 nas demais: a dinastia regride à média, e ter mais filhos, formar no kart e escolher bem o herdeiro fazem diferença.

## Morte e continuidade

- **Mortalidade.** Sorteio anual no fechamento de cada temporada: 0,1% até os 49 anos, 0,5% dos 50 aos 59, 1,5% dos 60 aos 69, 5% dos 70 aos 79, 14% dos 80 aos 89 e 30% dos 90 aos 99; ninguém passa dos 100. Uma lesão grave em corrida tem 2% de chance de ser fatal.
- **Sucessão.** A morte (ou a passagem de comando em vida, possível no fechamento de uma temporada como dirigente) abre a escolha do herdeiro. Entram os filhos, o parceiro e dois parentes: um jovem que corre no kart regional e um adulto. Nada avança até a escolha.
- **Caminhos.** *Nas pistas*: um filho ou parente com carreira vira o piloto do jogador, na categoria e na força de equipe em que já corria, com a licença e a reputação dele (ou 20% da maior reputação da família, se for maior). *Nos negócios*: um herdeiro com 18 anos ou mais assume o patrimônio e a equipe. Filhos menores precisam de um tutor (o parceiro ou o parente adulto) até crescer; os filhos continuam na família do tutor.
- **Herança.** O patrimônio (com a equipe própria) paga 8% de imposto sobre o que passa de € 100 mil; a doação em vida paga 4%. Se o herdeiro é um dos filhos, cada irmão (até três) recebe 15% e sai do acompanhamento.
- **Equipe da família.** Com um herdeiro dirigente, ela continua sob comando dele. Com um herdeiro piloto, vira uma participação de 100% com gestores contratados e paga dividendos. O cargo de chefe contratado não é herdado.
- **Acidente no meio da temporada.** O reserva assume o carro, a temporada é arquivada como está e o herdeiro começa no ano seguinte.

## Aposentadoria e vida de dirigente

"Pendurar o capacete" (tela Carreira) encerra a vida de piloto do personagem, mas não a carreira. No fechamento da temporada, aparecem:

- **Propostas para chefiar uma equipe.** Cada equipe exige um prestígio mínimo (reputação mais o retrospecto das três últimas temporadas no comando: +4 por meta cumprida, −3 por meta perdida): base da categoria + 1,5 por posição na ordem de forças − 8. Um campeão de F1 recebe propostas da F1; um piloto desconhecido, só do kart. Salário de € 8 mil (pior equipe do kart regional) a € 4 milhões (melhor da F1).
- **Equipes à venda.** Em cada categoria, as duas mais fracas e uma do meio do grid: de cerca de € 60 mil (a pior do kart regional) a cerca de € 140 milhões (meio do grid da F1). O preço inclui o caixa com que a equipe é entregue. As equipes de ponta não ficam à venda. Quem já é sócio paga só a parte que falta.
- **Fundar uma equipe.** Custa 75% do valor da mais fraca da categoria, mais o caixa inicial. A equipe nova ocupa a inscrição da mais fraca e herda o equipamento dela, um pouco pior, sem instalações, sem equipe técnica e com reputação 22.
- **Revenda.** O valor de uma equipe é o valor de mercado da posição dela × (0,55 + reputação/200), mais um quarto do custo das instalações e o caixa. Fica abaixo do preço de compra até a equipe subir na tabela ou ganhar reputação: comprar ou fundar para revender em seguida dá prejuízo (conferido em todas as categorias).
- **Ficar sem equipe.** O jogador vive do patrimônio, acompanha o campeonato e a família; a reputação cai 1 ponto por ano.
- **Custo de vida.** Fora das pistas, acompanha o prestígio do personagem (o da categoria mais alta cuja nota-base de reputação ele alcança), não a categoria que ele acompanha.
- **Insolvência.** Dívida pessoal acima de dois anos de custo de vida, no fechamento do ano: os credores executam os bens; se não bastar, a equipe própria é vendida à força por 90% do valor; e só o que ainda sobrar é perdoado, com 4 pontos de reputação a menos.

O **chefe contratado** recebe salário por etapa e bônus de 20% por meta cumprida. Ficar duas ou mais posições abaixo da meta, ou fechar o ano no vermelho, rende advertência; com duas seguidas, é demitido. Os donos retiram o lucro acumulado. O **dono** aporta e retira dinheiro (a retirada é renda tributável e a equipe precisa manter uma reserva), cobre o prejuízo do ano com o próprio bolso e pode vender a equipe no fechamento.

No fim de semana, o dirigente escolhe o programa de treino e a abordagem de classificação dos dois pilotos; a corrida é disputada pelo motor, com os pilotos decidindo ritmo e paradas.

## Gestão de equipe

| Decisão | Efeito |
| --- | --- |
| Diretor técnico | Maior peso na velocidade da pesquisa |
| Engenheiro-chefe | Pesquisa e confiança dos pilotos a cada etapa |
| Diretor esportivo | Receita de patrocínio (cerca de ±10%) e poder de convencer pilotos |
| Chefe dos mecânicos | Equipe de box |
| Chefe de equipe (só o dono contrata; senão vale a nota do jogador) | Ganho de reputação da equipe e moral dos pilotos |
| Engenharia (nível 1 a 5) | Um ponto-base de pesquisa por etapa por nível (e o custo proporcional) |
| Mecânicos (nível 1 a 5) | +7 nos boxes por nível |
| Simulador, túnel de vento, fábrica (nível 0 a 5) | +6% de pesquisa e +4% na evolução dos pilotos; +10% em aerodinâmica; +10% em fabricação, −3% no custo da pesquisa e boxes melhores |

- **Mercado de profissionais.** Dois candidatos por função a cada temporada; o nível deles segue a reputação da equipe. O salário cresce com a nota (elevada a 2,5) e volta ao valor de mercado a cada renovação. Trocar alguém custa meio ano de salário de indenização. Quem tem contrato vencido e nota muito acima da reputação da equipe pode ir embora. Uma função vaga é ocupada por um interino fraco, que também recebe salário.
- **Pilotos.** No fechamento, a lista traz os atuais, os que ficam livres, três estreantes e os filhos do jogador. Cada piloto é medido contra o grid atual: na F1, o melhor pede € 14 milhões e o pior, € 600 mil; nas categorias de base é o piloto que paga, de 105% (o mais fraco) a 65% (o melhor) do preço de tabela da vaga. Um piloto só aceita se a reputação da equipe estiver à altura da ambição dele (os atuais são mais tolerantes), e quem chega à idade-limite não renova. Um filho corre pela equipe da família sem salário e sem pagar.
- **Patrocinadores da equipe.** Três cotas, que dividem o total que o mercado paga (40%, 33% e 27%): a base da categoria × (0,25 + reputação/60). A cota maior exige uma posição melhor que a meta da equipe. Quem vê a equipe mais de duas posições abaixo do combinado rompe o contrato, e cada rompimento tira 2 pontos da reputação da equipe.
- **Caixa.** Receitas (patrocínios, vagas pagas pelos pilotos, prêmio pela posição do ano anterior) e despesas (pilotos, equipe técnica, operação, instalações, pesquisa) entram em parcelas por etapa; os danos dos dois carros são cobrados na hora. Com o caixa negativo, a pesquisa para.
- **Reputação da equipe.** A cada ano, anda 40% do caminho até a nota da posição final (92 para a campeã, 8 a menos por posição), mais depressa com um bom comando.
- **Eventos de gestão** (35% de chance por etapa): ação promocional de patrocinador, rival sondando o diretor técnico, diretriz técnica da federação, briga entre os pilotos, atraso na fábrica, bônus de pódio.

Com a estrutura padrão, o resultado previsto do ano vai de 0,3% a 8% do valor da equipe (`npm run calibrate`): a pior de cada categoria empata, e as do meio do grid rendem de 3% a 6%. Não é dinheiro fácil: em 40 temporadas, o lucro médio de um dono que só deixa a equipe rodar ficou entre −0,5% e +2,3% do preço dela por ano (menos que a renda fixa), e a equipe ainda desvaloriza, porque o carro fica para trás. O ganho está em subir na tabela (prêmio e patrocínio maiores) e em vender uma equipe melhor do que a que comprou.

## Desenvolvimento técnico

A pesquisa gera pontos a cada etapa: capacidade da engenharia (2 pontos mais 0,6 por nível) × ritmo (contido 0,5; normal 1; agressivo 1,6, a 1,9 vez o custo) × pessoas (0,55 + diretor técnico/200 + engenheiro-chefe/400) × simulador. O jogador distribui o esforço entre cinco áreas. A primeira melhoria de uma área na temporada custa 9 pontos, e cada seguinte, 35% a mais. A pesquisa em andamento não se perde na virada do ano.

| Área | Cada melhoria dá | Kart | F4, F3 e F2 | F1 |
| --- | --- | --- | --- | --- |
| Aerodinâmica | chassi +0,6; motor +0,2 | fechada | fechada | livre |
| Chassi | chassi +0,7 | livre | fechada | livre |
| Motor | motor +0,8 | fechada (lacrado) | fechada | livre |
| Suspensão | chassi +0,4; confiabilidade +0,2 | livre | livre | livre |
| Fabricação | confiabilidade +1 | livre | livre | livre |
| Limite por área e por temporada | | 2 | 2 | 5 |

- **Fórmula 1.** Teto de gastos com desenvolvimento de € 30 milhões por temporada: ao atingi-lo, a pesquisa para até o ano seguinte. As horas de túnel de vento dependem da posição no campeonato anterior: 70% para a campeã, 5 pontos percentuais a mais por posição.
- **Concorrência.** Todas as rivais evoluem o mesmo durante o ano: 2 pontos de carro na F1, 0,6 no kart e 0,25 nas categorias monomarca. Na virada do ano, essa evolução é descontada de todos, e o que a equipe do jogador ganhou acima dela perde 30%. Quem não acompanha anda para trás.

Quanto o carro evolui por temporada com a estrutura padrão e o esforço dividido por igual (`npm run calibrate`):

| Categoria | Rivais | Melhor equipe (normal / agressivo) | Equipe do meio | Pior equipe |
| --- | --- | --- | --- | --- |
| Fórmula 1 | 2,00 | 2,46 / 3,47 | 1,55 a 1,79 / 2,23 a 2,80 | 1,01 / 1,45 |
| F4, F3 e F2 | 0,25 | 0,40 / 0,40 (limite do regulamento) | 0,30 a 0,40 / 0,40 | 0,25 a 0,30 / 0,30 a 0,40 |
| Kart | 0,60 | 1,10 / 1,10 | 0,55 a 0,83 / 0,83 a 1,10 | 0,55 / 0,69 |

Na F1, só a equipe de ponta acompanha o grid no ritmo normal; as do meio precisam do ritmo agressivo, e a pior não acompanha nem assim sem ampliar a engenharia, contratar gente melhor e concentrar o esforço.

Medido em quatro temporadas à frente da pior equipe da F1: com estrutura e pesquisa no máximo, o carro ganha mais de 2 pontos sobre o grid em relação a uma gestão que só mantém o ritmo contido.

## Tutorial e primeiros passos

O painel mostra uma lista de oito passos até ser concluída ou dispensada: conhecer o piloto, disputar uma etapa, tomar uma decisão, ver a equipe, cuidar do dinheiro, planejar a subida, fechar uma temporada e pensar na dinastia. Cada passo é marcado por algo que o jogador fez de verdade. A tela "Como jogar" repete a lista e resume as regras por assunto.

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

Os eventos de família (no começo de cada temporada) e os de gestão (depois das etapas, no modo dirigente) estão descritos nas seções deles. Todo evento altera estado de jogo: nenhum é só texto.

## Equilíbrio

`npm run calibrate` simula 12 carreiras de 14 temporadas com um robô que joga de forma simples. O "talento" soma pontos aos atributos e representa um jogador que decide melhor:

| Robô | Onde chega em 14 temporadas |
| --- | --- |
| Mediano (talento 0) | F3 ou F2 |
| Bom (talento 4) | F1 aos 26 ou 27 anos, no meio do grid |
| Excelente (talento 8) | F1 aos 24 a 28 anos; em parte das carreiras, vitórias e títulos |

Essas faixas foram medidas de novo depois da auditoria: com a regra nova de evolução das equipes, três das quatro carreiras do robô bom chegam à F1 (aos 24 a 28 anos) e uma das quatro do mediano também.

**Mundo no longo prazo** (60 temporadas acompanhadas de fora, por categoria): o nível médio dos pilotos sobe de 4 a 5 pontos nas primeiras temporadas e fica estável (kart regional 73, F3 82 a 83, F1 89 a 91, para níveis projetados de 68, 78 e 85); as idades ficam estáveis (F1: média de 31 a 33 anos, máximo de 38); a média dos carros fica em 75; há de 2 a 7 pilotos campeões diferentes por década na F1.

O mesmo comando simula quatro vidas de 70 temporadas (piloto até os 36 anos, depois dirigente, com sucessões) e confere a integridade do estado a cada passo. Nessas vidas: um campeão de F1 aposenta-se com cerca de € 180 milhões e recebe proposta da melhor equipe da F1; um piloto que parou na F3 ou na F2 recebe proposta de uma equipe do fundo da F2; as mortes aconteceram aos 60, 64 e 73 anos (um personagem chegou vivo aos 84); e os herdeiros que assumiram tinham de 16 a 22 anos: dois filhos, um no kart regional e outro na F4, e um parente, porque os filhos daquele personagem já tinham largado as pistas.

## Limitações conhecidas e próximos passos
- Só uma categoria é simulada por vez: a do jogador ou a da equipe que ele dirige. As outras existem como equipes, propostas e participações.
- Os filhos correm fora do campeonato do jogador (a temporada deles é estimada), a não ser quando ele os escala na própria equipe. Pai e filho não se enfrentam na pista.
- Ao escolher um herdeiro piloto, os irmãos dele saem do acompanhamento e a equipe da família passa a ser só uma participação.
- Só o personagem do jogador morre: o parceiro e os filhos não têm mortalidade própria.
- No modo dirigente, a corrida não é acompanhada volta a volta, e o dirigente não dá ordens durante a prova.
- A mudança de regulamento a cada cinco temporadas embaralha as rivais, mas não mexe no carro da equipe que o jogador dirige (o dela é o que a pesquisa construiu).
- O equilíbrio da gestão foi medido com robôs e simulações, não com jogadores: os números de retorno e de ritmo de desenvolvimento podem pedir ajuste fino depois de partidas reais.
- Nas vidas longas, o nível dos pilotos da F1 sobe alguns pontos acima do projetado; os contratos da gestão já medem cada piloto contra o grid real, mas o nível nominal da categoria não é recalibrado.
- O jogador não pode assinar como piloto reserva de uma categoria superior.
- Não há mudanças no meio da temporada (troca de equipe, demissão imediata, contratação de pilotos).
- Corridas sprint, pontuação pela metade e retardatários não são simulados.
- Áudio, visual de pista em 2D e conquistas ficam para uma fase futura.
- O plano de escala (centenas de pilotos, várias categorias simuladas ao mesmo tempo, saves em partes) está em `docs/PLANO_ARQUITETURA_FASE3.md` e não foi executado.
