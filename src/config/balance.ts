/**
 * Configuração de balanceamento: o lugar dos números que equilibram o jogo.
 *
 * Regra (vale da Fase 1 em diante): probabilidade, multiplicador, limite, custo, idade, peso de
 * fórmula, tudo o que se ajusta para equilibrar o jogo entra AQUI, numa tabela com nome e com um
 * comentário dizendo o que o número faz e de onde ele veio. No código do motor fica só a conta,
 * lendo a tabela. Assim, quem calibra o jogo mexe num arquivo, e o relatório do simulador
 * (`npm run sim`) diz o que a mudança causou.
 *
 *   export const NOME_DA_REGRA = {
 *     // Chance por etapa de …; 3% dá cerca de uma vez a cada três temporadas.
 *     CHANCE_POR_ETAPA: 0.03,
 *   } as const;
 *
 * Este arquivo não importa nada do motor (`src/engine`), para o motor poder importá-lo sem
 * formar um ciclo.
 *
 * As tabelas que já existiam antes da grande atualização continuam onde nasceram, ao lado do
 * sistema que cada uma regula, e estão mapeadas em BALANCE_TABLES. Quando uma fase mexer numa
 * dessas regras, ou numa regra cujo número ainda está solto no meio do código, traz os números
 * para cá no mesmo PR e atualiza o mapa. `tests/balance.test.ts` confere que o mapa cobre todas as
 * constantes exportadas (nome em maiúsculas) do motor e dos dados e barra constante de módulo nova
 * fora daqui; número solto no meio de uma conta ele não vê: aí vale a revisão.
 */

/**
 * Limites de registro (não mudam o jogo; só o quanto de história o save guarda).
 */
export const HISTORY_LIMITS = {
  // Temporadas guardadas para os gráficos de tendência (atributos e caixa). 60 cobre duas
  // gerações inteiras de uma dinastia e pesa menos de 20 kB no save.
  SEASON_TREND: 60,
  // Toques em lances decisivos guardados em `relations.rivalryLog` (Fase 4), para a Fase 5 usar.
  // 40 cobrem várias temporadas de um piloto brigador e pesam menos de 5 kB no save.
  RIVALRY_LOG: 40,
} as const;

/* ------------------------------------------------------------------ */
/* Nascimento (Fase 2)                                                 */
/* ------------------------------------------------------------------ */

/**
 * O sorteio do nascimento: família, corpo e mente, talentos e defeitos. Os textos (cidades,
 * profissões, nomes dos traços) ficam em `src/data/birth.ts`; aqui só os números.
 */
export const BIRTH = {
  // Sorteios refeitos de graça no começo da carreira. Os extras ficam atrás da flag premium.
  FREE_REROLLS: 3,
  // Sorteios extras da versão premium, quando ela existir. É o teto que o motor aceita.
  PREMIUM_EXTRA_REROLLS: 7,
  // Chance de nascer num bairro da capital; o resto nasce numa cidade do interior paulista.
  CAPITAL_CHANCE: 0.5,
  // Aptidões de corpo e mente: normal com média 50 e desvio 15, limitada a 15–95 e arredondada.
  // Com esse desvio, dois terços dos pilotos ficam entre 35 e 65 em cada aptidão.
  APTITUDE_MEAN: 50,
  APTITUDE_SD: 15,
  APTITUDE_MIN: 15,
  APTITUDE_MAX: 95,
  // Renda da família: a profissão da mãe e a do pai valem de 1 a 3 cada; a soma (2 a 6) escolhe a
  // linha das tabelas abaixo (índice = soma − 2). Antes da Fase 2 todo estreante começava com
  // R$ 30.000 e recebia R$ 24.000 por ano durante cinco anos; a família pobre ajuda menos e por
  // menos tempo, mas a mais bem empregada chega perto disso.
  SAVINGS_BY_INCOME: [16_000, 19_000, 22_000, 25_000, 28_000],
  // Variação das economias em torno do valor da linha (±15%), arredondada a R$ 500.
  SAVINGS_VARIATION: 0.15,
  SUPPORT_PER_SEASON_BY_INCOME: [16_000, 18_000, 20_000, 22_000, 24_000],
  SUPPORT_SEASONS_BY_INCOME: [3, 3, 4, 4, 4],
  // Talentos e defeitos de cada piloto: um talento, um defeito e um terceiro de qualquer tipo.
  TALENTS: 1,
  DEFECTS: 1,
  EXTRA_TRAITS: 1,
  // Quem nasce no interior começa na equipe menor do kart regional (a única que aceita um piloto
  // que mora longe), paga viagens a cada etapa e treina num lugar com menos estrutura.
  INTERIOR_TEAM_ID: 'garagem',
  INTERIOR_TRAVEL_PER_ROUND: 500,
  INTERIOR_TRAINING_FACTOR: 0.9,
  // Categorias disputadas no Brasil: só nelas morar no interior pesa (viagens e evento da mudança).
  INTERIOR_CATEGORIES: ['kart-regional', 'kart-national'],
  // O evento da mudança para São Paulo aparece depois desta etapa (e volta a cada temporada
  // enquanto o piloto ficar no interior).
  MOVE_EVENT_ROUND: 2,
  // Mudar com a família: custa mais e a moral sente pouco. Morar com parentes: custa menos, mas a
  // saudade pesa mais.
  MOVE_WITH_FAMILY_COST: 8_000,
  MOVE_WITH_FAMILY_MORALE: -5,
  MOVE_WITH_RELATIVES_COST: 3_000,
  MOVE_WITH_RELATIVES_MORALE: -12,
} as const;

/**
 * Corpo e mente na ficha inicial: cada ponto de aptidão acima (ou abaixo) de 50 soma (ou tira)
 * esta fração de ponto nos atributos ligados. Reflexo 80 dá +3,6 de velocidade e +1,8 de
 * ultrapassagem. O carisma não mexe em atributo de pilotagem: pesa nos patrocinadores.
 */
export const APTITUDE_LINKS = {
  reflexes: { pace: 0.12, overtaking: 0.06 },
  physique: { focus: 0.08, wetSkill: 0.08 },
  intelligence: { racecraft: 0.12, tyreManagement: 0.08 },
  composure: { consistency: 0.1, defending: 0.08 },
  charisma: {},
} as const;

/**
 * Corpo e mente ao longo da carreira. `k` é a aptidão em relação a 50, de −1 (0) a +1 (100).
 */
export const APTITUDE_EFFECTS = {
  // Potencial: soma esta fração da média de reflexo, físico, inteligência e frieza acima de 50.
  POTENTIAL_PER_POINT: 0.1,
  // Reflexo: a dispersão da reação na largada cai até 30% (e sobe até 30% com reflexo 0).
  REFLEX_START_SPREAD: 0.3,
  // Físico: o cansaço das provas longas cai até 40%. Prova longa vai de 20 minutos (peso 0) a 60
  // minutos ou mais (peso 1): no kart não pesa; no Grand Prix Mundial pesa inteiro.
  PHYSIQUE_FATIGUE: 0.4,
  LONG_RACE_MINUTES: [20, 60],
  // Físico na chuva: até 0,08% de tempo de volta com a pista encharcada (cerca de 6 pontos de chuva).
  PHYSIQUE_WET_PACE: 0.0008,
  // Frieza: soma até 0,2 ao logit das disputas (como atacante e como defensor), mais 0,3 na última
  // volta, quando a chance de erro também cai até 35%.
  COMPOSURE_DUEL: 0.2,
  COMPOSURE_LAST_LAP_DUEL: 0.3,
  COMPOSURE_LAST_LAP_ERROR: 0.35,
  // Carisma: valor das propostas de patrocínio (até ±20%) e satisfação dos patrocinadores por etapa
  // (até ±0,5 ponto).
  CHARISMA_SPONSOR_VALUE: 0.2,
  CHARISMA_SATISFACTION: 0.5,
} as const;

/**
 * Efeito de cada talento e defeito na pista, em modificadores simples (a Fase 4 usa os mesmos
 * traços nas chances dos lances). Referência: 0,1% de tempo de volta vale cerca de 7 pontos de
 * velocidade. Campos ausentes são neutros.
 *
 * - wetPace: fração do tempo de volta por unidade de umidade (negativo = mais rápido).
 * - wetError: multiplica a chance de erro por (1 + wetError × umidade).
 * - startSpread / startGain: multiplica a dispersão da reação na largada / soma segundos à volta de largada.
 * - tyreWear: multiplica o desgaste dos pneus.
 * - training: multiplica o ganho de treino.
 * - qualifying: fração do tempo de volta na classificação.
 * - injury: multiplica a chance de lesão num acidente.
 * - collision / attack: multiplica a chance de toque numa disputa frustrada / soma ao logit do ataque.
 * - debutPace / debutError: tempo de volta e chance de erro nas estreias.
 */
export const TRAIT_EFFECTS = {
  rainMaster: { wetPace: -0.0015, wetError: -0.3 },
  rainFear: { wetPace: 0.0015, wetError: 0.5 },
  bornStarter: { startSpread: 0.7, startGain: -0.25 },
  slowStarter: { startSpread: 1.3, startGain: 0.25 },
  tyreSaver: { tyreWear: 0.88 },
  tyreEater: { tyreWear: 1.14 },
  quickLearner: { training: 1.2 },
  slowLearner: { training: 0.85 },
  qualifyingKing: { qualifying: -0.001 },
  qualifyingNerves: { qualifying: 0.001 },
  ironBody: { injury: 0.5 },
  fragile: { injury: 1.8 },
  cleanRacer: { collision: 0.7 },
  hothead: { collision: 1.4, attack: 0.1 },
  bigStage: { debutPace: -0.001, debutError: 0.85 },
  debutNerves: { debutPace: 0.002, debutError: 1.4 },
} as const;

/** Gatilhos de revelação dos traços ocultos. */
export const TRAIT_REVEAL = {
  // Posições ganhas (ou perdidas) na primeira volta que revelam o largador nato (ou a largada sonolenta).
  START_POSITIONS: 2,
  // Desgaste de pneus da pista (1 = médio) a partir do qual uma corrida completa revela o poupador
  // ou o gastador: 3 das 10 pistas do kart regional.
  HIGH_WEAR_TRACK: 1.1,
} as const;

/* ------------------------------------------------------------------ */
/* Economia, polos e portas (Fase 3)                                   */
/* ------------------------------------------------------------------ */

/**
 * Polos: o que custa e o que rende morar onde o campeonato tem base. As chaves são os ids de
 * `src/data/hubs.ts`. São Paulo é a casa do piloto: sem mudança e sem aluguel de polo (o custo de
 * vida da categoria já cobre morar com a família).
 */
export const HUB_RULES = {
  // Mudança para o polo, paga uma vez na chegada: passagens, caução do aluguel e curso do idioma.
  MOVE_COST: { 'sao-paulo': 0, italia: 45_000, inglaterra: 70_000 },
  // Aluguel de um quarto perto da equipe, por temporada (lançado em parcelas por etapa).
  RENT_PER_SEASON: { 'sao-paulo': 0, italia: 60_000, inglaterra: 95_000 },
  // A família longe pesa: moral tirada no começo de cada temporada morando fora do país.
  FAMILY_FAR_MORALE: -8,
  // Idioma novo: no primeiro ano no polo o treino rende 10% menos e a equipe começa confiando menos.
  LANGUAGE_TRAINING_FACTOR: 0.9,
  LANGUAGE_TEAM_TRUST: -5,
  // Em troca, quem mora no polo aparece: pontos de interesse a mais das equipes dos campeonatos dali.
  VISIBILITY_INTEREST: 6,
} as const;

/**
 * Custos de correr que não são a vaga, por campeonato (ids das categorias). Viagem: por etapa
 * (estrada pelo estado no regional, avião e hotel no Brasileiro, deslocamentos pela Europa nos de
 * fora). Equipamento: por temporada (capacete, macacão, pneus de treino e, no kart, a revisão do
 * motor). No Grand Prix Mundial a equipe paga tudo.
 */
export const RUNNING_COSTS = {
  TRAVEL_PER_ROUND: { 'kart-regional': 300, 'kart-national': 1_200, 'kart-international': 5_000, f4: 4_000, f3: 12_000, f2: 25_000, f1: 0 },
  EQUIPMENT_PER_SEASON: { 'kart-regional': 3_000, 'kart-national': 8_000, 'kart-international': 40_000, f4: 35_000, f3: 90_000, f2: 180_000, f1: 0 },
  // A vaga da rede de segurança deixou de ser de graça: é uma vaga de aluguel na equipe mais fraca,
  // por esta fração do preço de tabela da vaga mais barata do campeonato (1 = preço cheio: quem não
  // interessa a ninguém não ganha desconto). Pode ser paga a crédito: é o que faz terminar mal
  // custar dinheiro sem nunca deixar o piloto a pé.
  FALLBACK_SEAT_SHARE: 1,
} as const;

/**
 * Patrocinadores em escada. O porte (1 = comércio do bairro, 2 = empresa regional, 3 = marca
 * grande) continua saindo do resultado, mas cada campeonato tem um teto, e marca grande só fecha
 * com quem tem título e visibilidade (reputação).
 */
export const SPONSOR_LADDER = {
  // Maior porte que se apresenta em cada campeonato: no kart regional, só o comércio do bairro.
  MAX_TIER: { 'kart-regional': 1, 'kart-national': 2, 'kart-international': 2, f4: 2, f3: 3, f2: 3, f1: 3 },
  // Marca grande antes das fórmulas de cima: só com um título na carreira e esta reputação.
  BIG_BRAND_MIN_REPUTATION: 30,
  // Degrau até onde o valor pago por cada porte acompanha o preço do campeonato (índice = porte).
  // O comércio do bairro paga valor de kart regional onde quer que o piloto corra; a empresa
  // regional e a marca grande acompanham o piloto até o topo (a regional paga 36% do valor de
  // referência do campeonato; a grande, 60%: ver SPONSOR_RULES.TIER_SHARE).
  VALUE_CEILING_TIER: [7, 1, 7, 7],
  // Patrocínio esperado ao subir de degrau: a equipe de cima conta com esta fração do valor de um
  // patrocinador do porte que o resultado do piloto atrai no campeonato novo (se ele tiver cota
  // livre ou um patrocinador menor para trocar). É o que deixa o campeão pobre subir com
  // patrocínio e bolsa, sem precisar de investidor.
  EXPECTED_ON_PROMOTION: 1,
  // Quem sobe de degrau com o piloto dá um desconto na meta: tantas posições a mais na primeira
  // temporada no campeonato novo, até o teto. Na renovação, a meta volta à do porte.
  PROMOTION_TARGET_RELIEF: 4,
  MAX_TARGET: 15,
} as const;

/**
 * Academia como porta: além do convite por evento, uma equipe do topo chama no fim do ano quem
 * cumpre estes requisitos (todos visíveis na tela Caminhos). Ela paga a vaga; cobra exclusividade
 * e resultado.
 */
export const ACADEMY_DOOR = {
  // Do Campeonato Brasileiro de Kart (2º degrau) à Fórmula Elite (6º).
  MIN_TIER: 2,
  MAX_TIER: 6,
  // Idade máxima na temporada seguinte e pior posição final aceita.
  MAX_AGE: 21,
  MAX_POSITION: 3,
  // Fração da vaga que a academia paga, e a posição final que ela exige a cada temporada.
  SUPPORT_SHARE: 1,
  TARGET_POSITION: 6,
  // Exclusividade: quantos patrocinadores pessoais o piloto da academia pode ter.
  MAX_PERSONAL_SPONSORS: 1,
} as const;

/**
 * Investidor: paga a vaga de uma proposta e leva uma fatia dos ganhos para sempre. Ganho é o que o
 * piloto recebe por correr: salário, bônus e o que sobra dos patrocínios depois de pagar a parcela
 * da vaga. Enquanto o patrocínio só cobre a vaga, ele leva pouco; quando o piloto passa a ganhar
 * de verdade, a fatia pesa. É a porta cara.
 */
export const INVESTOR = {
  // Quem ele procura: até esta posição final e esta idade (na temporada seguinte).
  MAX_POSITION: 8,
  MAX_AGE: 25,
  // Fatia pela posição final: até o 3º lugar, 10%; até o 8º, 15%.
  SHARE_TOP3: 0.1,
  SHARE_TOP8: 0.15,
  // Quem já tem investidor consegue outro aporte até esta posição; cada vaga a mais soma esta fatia.
  KEEP_POSITION: 12,
  EXTRA_SEAT_SHARE: 0.05,
  MAX_SHARE: 0.4,
  // Último recurso: depois deste número de temporadas seguidas sem nenhuma porta, um investidor
  // aparece para qualquer piloto, cobra mais caro e, se nenhuma equipe fez proposta, traz uma vaga
  // numa equipe do meio do grid (posição na ordem de forças, a partir de 0).
  LAST_RESORT_AFTER: 2,
  LAST_RESORT_SHARE: 0.25,
  LAST_RESORT_TEAM_RANK: 6,
} as const;

/**
 * Vaquinha da cidade: só com bom resultado e carisma. O dinheiro entra uma vez; em troca, a
 * torcida local cobra o resultado da temporada seguinte.
 */
export const CROWDFUND = {
  // Do kart regional à Fórmula Júnior (4º degrau): depois disso os valores são grandes demais para uma cidade.
  MAX_TIER: 4,
  MAX_POSITION: 5,
  // Carisma de nascença mínimo (50 é o piloto comum; quem não tem nascimento sorteado conta como 50).
  MIN_CHARISMA: 55,
  // Arrecadação de referência por degrau em que o piloto corre (índice = degrau), multiplicada
  // por (0,6 + carisma/100): carisma 55 arrecada 115% da referência; carisma 90, 150%.
  BASE_BY_TIER: [0, 20_000, 80_000, 250_000, 400_000],
  CHARISMA_BASE: 0.6,
  // Temporadas de intervalo entre duas vaquinhas.
  COOLDOWN_SEASONS: 3,
  // A torcida espera, no ano seguinte, a posição final de agora mais esta folga (no degrau de cima, vale o dobro).
  TARGET_SLACK: 4,
  // Pressão: moral tirada no começo da temporada cobrada, e o preço de decepcionar a cidade.
  PRESSURE_MORALE: -4,
  MISS_MORALE: -10,
  MISS_REPUTATION: -2,
} as const;

/**
 * Evento "A equipe pede um aporte extra": um patrocinador da equipe não pagou e ela pede dinheiro
 * ao piloto no meio do ano.
 */
export const TEAM_CASH_CALL = {
  // O pedido é esta fração do custo anual da vaga...
  SEAT_SHARE: 0.12,
  // ...mas nunca mais que esta fração do dinheiro que o piloto tem em caixa: ninguém pede a quem não tem.
  MAX_CASH_SHARE: 0.2,
  // Abaixo deste valor não vale pedir: a equipe só propõe parcelar ou segue sem o dinheiro.
  MIN_PAYMENT: 500,
  // Parcelar no contrato: o custo anual da vaga sobe esta fração.
  SPLIT_SEAT_SHARE: 0.08,
  // Recusar: chance de a equipe cortar as atualizações do equipamento.
  REFUSE_CUT_CHANCE: 0.4,
} as const;

/**
 * Trabalhos paralelos: dinheiro por etapa em troca de tempo de treino. Só até a Fórmula Júnior
 * (4º degrau): dali em diante a agenda não deixa.
 */
export const SIDE_JOBS = {
  MAX_TIER: 4,
  // Instrutor de kart: paga melhor; o treino rende 15% menos.
  instructor: { perRound: 800, training: 0.85, damageDiscount: 0 },
  // Ajudante de mecânico: paga menos, o treino rende 20% menos, mas o conserto depois de batida sai 30% mais barato.
  mechanic: { perRound: 600, training: 0.8, damageDiscount: 0.3 },
} as const;

/* ------------------------------------------------------------------ */
/* Corrida com lances e pneus (Fase 4)                                 */
/* ------------------------------------------------------------------ */

/**
 * Curva de desgaste dos pneus. O desgaste (0 = novo, 1 = na lona) continua somando um tanto por
 * volta (`SIM.TYRE_WEAR_PER_LAP`, vezes a pista, o piloto, o ritmo e o `wear` do composto em
 * `TYRES`). Esta tabela diz quanto tempo de volta o pneu perde em cada ponto da vida, em fração
 * do tempo de volta (0,01 = 1%, perto de 0,9 s numa volta de 90 s):
 *
 *   perda = fade × min(1, desgaste / FADE_BY)                      perde pouco no começo
 *         + plateau × (desgaste − FADE_BY) / (cliff − FADE_BY)     estabiliza: sobe devagar
 *         + drop × (desgaste − cliff) / (1 − cliff)                cai do penhasco
 *
 * Referência (pista de desgaste médio, piloto médio, ritmo equilibrado): o médio chega ao penhasco
 * em 25 voltas, o macio em 13 e o duro em 40. Passado o penhasco, cada volta custa perto de 1,2 s
 * a mais que a anterior com o médio, 1,6 s com o macio e 1 s com o duro (numa volta de 90 s). Antes
 * dele, a perda total fica em torno de 0,5% da volta: o pneu "estabiliza". No kart, quem anda no
 * ritmo equilibrado chega ao fim de uma corrida de 22 voltas com 70% de desgaste; no agressivo
 * desde a largada, passa do penhasco (80%) duas voltas antes da bandeirada.
 */
export const TYRE_CURVE = {
  // Desgaste até onde vai a perda do começo (o pico de aderência do pneu novo).
  FADE_BY: 0.1,
  COMPOUNDS: {
    // Kart: não há troca, mas o pneu acaba. Quem anda agressivo no começo cai do penhasco no fim.
    kart: { fade: 0.001, plateau: 0.004, cliff: 0.8, drop: 0.06 },
    // Macio: o mais rápido (ver `TYRES`), penhasco cedo e íngreme.
    soft: { fade: 0.002, plateau: 0.005, cliff: 0.72, drop: 0.09 },
    medium: { fade: 0.0015, plateau: 0.0045, cliff: 0.8, drop: 0.08 },
    // Duro: lento e durável; penhasco tarde e menos brusco.
    hard: { fade: 0.001, plateau: 0.004, cliff: 0.88, drop: 0.06 },
    intermediate: { fade: 0.0015, plateau: 0.005, cliff: 0.78, drop: 0.07 },
    wet: { fade: 0.0015, plateau: 0.005, cliff: 0.82, drop: 0.07 },
  },
  // Gestão de pneus do piloto: com 0, desgasta 30% mais que o piloto médio; com 100, 30% menos.
  MANAGEMENT_WORST: 1.3,
  MANAGEMENT_RANGE: 0.6,
  // Atrás do safety car (ou sob o virtual) o pneu quase não gasta.
  NEUTRALIZED_WEAR: 0.3,
  // Estados mostrados na tela (texto + cor): "novo" até FADE_BY; "bom" até esta fração do caminho
  // até o penhasco; "no limite" a esta distância do penhasco; "acabado" dali em diante.
  GOOD_UNTIL: 0.6,
  LIMIT_MARGIN: 0.08,
  // A IA (e o engenheiro automático) passa a poupar quando o pneu entra no limite e para nos boxes
  // assim que ele passa do penhasco, se ainda faltarem estas voltas: com menos que isso, a parada
  // (perto de 25 s) custa mais do que arrastar o pneu acabado até a bandeirada.
  PIT_PAST_CLIFF: 0,
  PIT_MIN_LAPS_LEFT: 6,
  // Janela ideal de parada: as últimas voltas antes do penhasco.
  PIT_WINDOW_LAPS: 4,
  // Estratégias que deixariam mais que esta fração da corrida depois do penhasco são descartadas.
  STRATEGY_MIN_LIFE: 0.95,
} as const;

/**
 * Toque entre dois carros: o que acontece depois do contato. Vale para as disputas de sempre e
 * para os lances decisivos. Estes números estavam soltos em `step.ts` e vieram para cá na Fase 4.
 */
export const RACE_CONTACT = {
  // Tempo perdido por quem ataca e por quem defende num toque sem abandono, em segundos.
  TIME_LOSS_ATTACKER: 2.0,
  TIME_LOSS_DEFENDER: 0.8,
  // Num toque com abandono: chance de o abandono ser de quem atacava, e o dano de quem segue.
  DNF_ATTACKER_SHARE: 0.6,
  DNF_SURVIVOR_DAMAGE: 0.2,
  // A chance de toque cai com a leitura de corrida: multiplica por (1,2 − leitura/100).
  RACECRAFT_BASE: 1.2,
} as const;

/**
 * Lances decisivos: a corrida pausa de 2 a 4 vezes e o jogador escolhe. Só o piloto do jogador tem
 * lances. Cada opção tem uma chance de dar certo, `sigmoid(logit)`, limitada a CHANCE_MIN–CHANCE_MAX.
 * O logit soma a base da opção (abaixo) com termos de atributo, equipamento, pneus, clima e do
 * perfil de nascença; `s(x) = (x − nível do grid da categoria) / SKILL_SCALE`.
 *
 * Em OPTIONS, por opção:
 * - risk: 0 = segura, 1 = moderada, 2 = arriscada (a tela vibra em alerta ao confirmar).
 * - base: logit de partida. sigmoid(0) = 50%; +1 leva a 73%; −1, a 27%.
 * - win / lose: o que acontece na volta do lance quando dá certo ou errado:
 *     time    segundos somados à volta do jogador (negativo = ganho)
 *     attack  soma ao logit das disputas em que o jogador ataca nesta volta
 *     defend  tira do logit das disputas em que o jogador defende nesta volta
 *     error   multiplica a chance de erro do jogador nesta volta
 *     wear    multiplica o desgaste do jogador nesta volta
 *     rival   segundos somados à volta do rival (ele erra ou tira o pé)
 * - crash / spin / contact (só em lose): de cada erro, a parte que vira abandono, rodada ou toque
 *   no rival; o resto é só o tempo perdido. O toque ainda passa pelos multiplicadores de sempre
 *   (leitura de corrida, rivalidade, esquentado ou piloto limpo).
 * - sure: a opção não tem como dar errado (ceder a posição); a chance é 100% e a base não conta.
 * Nas opções de parada (`rain.pit` e `pit.undercut`), `time` é o que muda no serviço dos boxes.
 */
export const RACE_MOMENTS = {
  // Uma corrida completa tem de 2 a 4 lances. A largada conta; a última volta fecha a conta
  // quando faltar lance para o mínimo.
  MIN_PER_RACE: 2,
  MAX_PER_RACE: 4,
  // Ataques e defesas somados, no máximo, e voltas de intervalo entre dois lances de disputa.
  MAX_DUELS: 2,
  // O intervalo é esta fração da corrida, com este mínimo de voltas (conta da largada também: não
  // há disputa nas primeiras voltas, com o pelotão ainda embolado). Nem na penúltima volta.
  COOLDOWN_SHARE: 0.3,
  COOLDOWN_LAPS: 4,
  // Distância (s) para o carro da frente que abre o lance de ataque, e para o de trás que abre a defesa.
  ATTACK_GAP: 0.5,
  DEFENSE_GAP: 0.5,
  // A defesa só abre se o carro de trás for mais rápido por pelo menos isto (s por volta).
  DEFENSE_PACE_EDGE: 0.05,
  // Última volta: o lance abre com um carro a até isto (s), à frente ou atrás. O "tudo ou nada" mira
  // o carro da frente se ele estiver a até LAST_LAP_REACH.
  LAST_LAP_GAP: 0.6,
  LAST_LAP_REACH: 1.2,
  // Um ataque que deu certo alcança o rival se ele estiver a até isto no fim da volta (s).
  REACH: 1.5,
  // Vantagem de ritmo levada em conta nas chances, limitada a esta faixa (s por volta).
  PACE_EDGE_RANGE: [-0.4, 0.8],
  CHANCE_MIN: 0.05,
  CHANCE_MAX: 0.97,
  // Pontos de atributo que valem 1 no logit dos termos de habilidade.
  SKILL_SCALE: 15,
  OPTIONS: {
    start: {
      // Por dentro: ganha até duas posições na primeira curva; errando, perde tempo e pode tocar.
      inside: { risk: 2, base: -0.2, win: { time: -0.45, attack: 1.5 }, lose: { time: 0.2 }, crash: 0.01, spin: 0, contact: 0.16 },
      // Por fora: ganho menor, sem toque.
      outside: { risk: 1, base: 0.5, win: { time: -0.3, attack: 0.8 }, lose: { time: 0.2 }, crash: 0, spin: 0, contact: 0 },
      // Segurar: defende a posição; no pior caso, patina um pouco.
      hold: { risk: 0, base: 2, win: { time: -0.05, defend: 1.5, error: 0.5 }, lose: { time: 0.15 }, crash: 0, spin: 0, contact: 0 },
    },
    attack: {
      // Mergulhar na freada: passa já; errando, perde a linha e pode tocar no rival.
      dive: { risk: 2, base: 0.6, win: { time: -0.2 }, lose: { time: 0.25 }, crash: 0.015, spin: 0.05, contact: 0.18 },
      // Esperar o erro: não custa nada (e poupa pneu); a chance depende do rival.
      wait: { risk: 0, base: 0, win: { rival: 1.4 }, lose: { wear: 0.85 }, crash: 0, spin: 0, contact: 0 },
      // Vácuo: depende da reta e do motor; errando, só perde um pouco de tempo.
      slipstream: { risk: 1, base: 0.3, win: {}, lose: { time: 0.3, wear: 1.15 }, crash: 0, spin: 0, contact: 0 },
    },
    defense: {
      // Fechar a porta: segura a posição; errando, perde a posição e pode haver toque e punição.
      block: { risk: 2, base: 0.3, win: { rival: 0.3 }, lose: { time: 0.2 }, crash: 0.01, spin: 0.03, contact: 0.22 },
      // Ceder: perde a posição sem perder tempo nem pneu.
      yield: { risk: 0, base: 0, sure: true, win: { time: -0.25, wear: 0.8 }, lose: {}, crash: 0, spin: 0, contact: 0 },
    },
    rain: {
      // Parar já: pneu certo antes dos outros; o risco é só a parada sair lenta.
      pit: { risk: 0, base: 2.2, win: { time: -0.5 }, lose: { time: 3.5 }, crash: 0, spin: 0, contact: 0 },
      // Ficar na pista com pneu de seco: ganha tempo e posição se segurar o carro.
      stay: { risk: 2, base: 0.3, win: { error: 0.4 }, lose: { time: 1.5 }, crash: 0.08, spin: 0.4, contact: 0 },
    },
    lastLap: {
      // Tudo ou nada: passa o rival (ou crava a volta); errando, pode rodar, tocar ou bater.
      allIn: { risk: 2, base: 0.5, win: { time: -0.35 }, lose: { time: 0.3 }, crash: 0.02, spin: 0.06, contact: 0.14 },
      // Garantir os pontos: leva o carro até a bandeirada defendendo a posição.
      secure: { risk: 0, base: 2.6, win: { time: 0.1, defend: 1.2, error: 0.3 }, lose: { time: 0.4 }, crash: 0, spin: 0, contact: 0 },
    },
    pit: {
      // Undercut: parada limpa e voltas de saída voando; errando, a parada sai lenta.
      undercut: { risk: 1, base: 0, win: { time: -0.4 }, lose: { time: 2.5 }, crash: 0, spin: 0, contact: 0 },
      // Overcut: mais voltas com pista livre; errando, o pneu cai do penhasco antes da parada.
      overcut: { risk: 1, base: -0.6, win: {}, lose: {}, crash: 0, spin: 0, contact: 0 },
    },
  },
  START: {
    // Peso da experiência + concentração (a mesma dupla da reação na largada) e da ultrapassagem.
    SKILL: 0.6,
    OVERTAKING: 0.4,
    DEFENDING: 0.3,
    // Reflexo e largador nato (perfil): 30% a menos de dispersão valem 0,45 no logit; 0,25 s de
    // ganho na largada valem 0,5.
    REACTION: 1.5,
    GAIN: 2,
    // Pista molhada atrapalha a largada de quem não sabe andar na chuva.
    WET: 1.2,
  },
  ATTACK: {
    // Esperar o erro: chance-base e o que soma a ela.
    WAIT_BASE: 0.06,
    WAIT_PER_CONSISTENCY: 0.003,
    WAIT_PER_FOCUS: 0.002,
    WAIT_TYRE_LIMIT: 0.07,
    WAIT_TYRE_GONE: 0.15,
    WAIT_WET: 0.25,
    WAIT_PER_RACECRAFT: 0.003,
    WAIT_MAX: 0.6,
    // Vácuo: peso da sensibilidade da pista a motor (0,5 é neutro: numa pista de retas, 0,65, o vácuo
    // rende mais que o mergulho; numa travada, 0,35, bem menos) e da diferença de motor.
    SLIP_POWER: 4,
    SLIP_ENGINE: 0.04,
  },
  RAIN: {
    // Parar: cada ponto de equipe de box acima de 75 soma isto ao logit.
    PIT_PER_CREW: 0.03,
    // Ficar: pesos da nota de chuva e da leitura de corrida; quanto pesa a umidade que vem aí; e o
    // perfil de nascença (gênio na chuva: erro −30% e ritmo −0,15% por unidade de umidade).
    WET_SKILL: 0.9,
    RACECRAFT: 0.3,
    SEVERITY: 2.5,
    PROFILE_ERROR: 1.5,
    PROFILE_PACE: 300,
    // Dando certo, por estas voltas o pneu de seco perde só esta fração do que perderia na água.
    STAY_LAPS: 2,
    STAY_GRIP: 0.35,
  },
  LAST_LAP: {
    // Sem rival ao alcance, "tudo ou nada" é uma volta no limite: pesos de velocidade e consistência.
    PACE: 0.5,
    CONSISTENCY: 0.5,
    // Sem rival ao alcance, o ganho é em fração da volta (0,8%: 0,4 s num kartódromo, 0,7 s num
    // autódromo), e o piloto ataca melhor quem alcançar.
    SOLO_GAIN: 0.008,
    SOLO_ATTACK: 1,
    // Garantir: peso da consistência e do erro de última volta do perfil (frieza).
    SECURE_CONSISTENCY: 0.5,
    SECURE_PROFILE: 2,
  },
  PIT: {
    // A pergunta aparece quando a parada planejada está a até estas voltas.
    LEAD_LAPS: 2,
    // Undercut: peso da equipe de box (acima de 75), da velocidade do piloto e do pneu gasto
    // (acima de 50% de desgaste, o pneu novo rende mais).
    CREW: 0.05,
    PACE: 0.3,
    WORN: 2,
    // A parada mais rápida que um lance consegue, como fração do serviço perfeito (`RACE.PIT_SERVICE`).
    BEST_SERVICE: 0.8,
    // Dando certo: estas voltas de saída mais rápidas (fração da volta).
    OUT_LAPS: 2,
    OUT_LAP_PACE: -0.0025,
    // Overcut: voltas a mais na pista; cada volta de folga até o penhasco vale isto no logit.
    STRETCH_LAPS: 3,
    MARGIN: 0.35,
    TYRE_MANAGEMENT: 0.5,
    PROFILE_WEAR: 3,
    // Dando certo: pneu poupado e pista livre. Dando errado: o pneu acaba antes da hora.
    STRETCH_WEAR: 0.75,
    STRETCH_PACE: -0.0015,
    STRETCH_FAIL_PACE: 0.005,
  },
  CONTACT: {
    // Dano do jogador e do rival num toque de lance, e o tempo que cada um perde (s). É um toque de
    // disputa lado a lado, mais leve que a batida de quem erra a freada sozinho (`RACE_CONTACT`).
    PLAYER_DAMAGE: [0.1, 0.3],
    RIVAL_DAMAGE: [0.05, 0.2],
    PLAYER_TIME: 1,
    RIVAL_TIME: 0.5,
    // De cada toque, a parte que tira alguém da corrida.
    DNF_SHARE: 0.12,
    // Chance de os comissários culparem o jogador (5 s e 1 ponto; com abandono do rival, a punição maior).
    FAULT: 0.4,
  },
  STYLE: {
    // Estilo do piloto, de 0 (cauteloso) a 100 (agressivo): 50 mais estes pesos.
    ATTACK_VS_DEFENCE: 0.4,
    PACE_VS_CONSISTENCY: 0.3,
    CONFIDENCE: 0.2,
    // Esquentado (toque ×1,4) soma 16; piloto limpo (×0,7) tira 12.
    COLLISION: 40,
    // O ritmo escolhido pelo jogador também vale: agressivo soma, conservador tira.
    MODE: 12,
    // Faixas do rótulo: até aqui cauteloso; daqui em diante agressivo.
    CAUTIOUS_BELOW: 40,
    AGGRESSIVE_FROM: 60,
    // Chance mínima para o piloto aceitar uma opção arriscada [cauteloso, agressivo] e uma moderada.
    RISKY_MIN_CHANCE: [0.75, 0.45],
    MODERATE_MIN_CHANCE: [0.55, 0.3],
  },
} as const;

/** Rádio do engenheiro: quando ele fala (uma mensagem por volta, no máximo). */
export const ENGINEER_RADIO = {
  // Rival a até isto (s) que parou nesta volta: "dá para tentar o undercut".
  RIVAL_PIT_GAP: 3,
  // Carro de trás chegando: a até isto (s) e tirando pelo menos isto por volta.
  CLOSING_GAP: 2,
  CLOSING_RATE: 0.3,
  // Esse aviso só vale a partir desta volta e não se repete antes de passarem estas voltas.
  CLOSING_FROM_LAP: 3,
  CLOSING_REPEAT_LAPS: 4,
  // Aviso de chuva: quando faltam estas voltas para a previsão.
  RAIN_WARNING_LAPS: 2,
} as const;

/* ------------------------------------------------------------------ */
/* Eventos encadeados (Fase 5)                                         */
/* ------------------------------------------------------------------ */

/**
 * Cartões de evento: quantos saem por etapa, que categoria pesa mais, o tamanho de cada efeito e as
 * faixas que as condições dos dados citam por nome (os dados em `src/data/events` não têm número).
 * Calibrado com o simulador (`npm run sim`, seção 10).
 */
export const STORY_EVENTS = {
  // Cartões por etapa: de 1 a 3, com estes pesos (índice 0 = um cartão). Média de 1,4 por etapa:
  // umas 210 variantes em 15 temporadas, sem repetir.
  PER_ROUND: [65, 28, 7],
  // Peso de cada categoria no sorteio. O foco é a pista; a vida pessoal é rara.
  CATEGORY_WEIGHTS: { track: 40, career: 24, money: 16, health: 12, personal: 8 },
  // Peso de um evento dentro da categoria, pela frequência que os dados dão a ele.
  EVENT_WEIGHTS: { rare: 1, normal: 3, common: 6 },
  // Um evento que reage à etapa recém-disputada (condição `race`) pesa isto a mais: o toque de
  // domingo vira assunto na segunda-feira.
  REACTIVE_BOOST: 3,
  // Passos de cadeia por etapa (entram antes do sorteio e contam no total da etapa).
  MAX_CHAIN_STEPS_PER_ROUND: 1,
  // Cadeias em andamento ao mesmo tempo: mais que isso embaralha as histórias.
  MAX_ACTIVE_CHAINS: 4,
  // Etapas entre duas aparições do mesmo evento (com variantes diferentes), dentro da temporada.
  EVENT_SPACING: 5,
  // Começo de temporada: a proposta de patrocínio (se houver) e no máximo um cartão de pré-temporada.
  SEASON_START_CARDS: 1,

  // Tamanho dos efeitos (índice 0 = tamanho 1). Moral, confiança, fase, confiança da equipe e
  // relação com o companheiro, em pontos (0 a 100).
  STAT_STEPS: [3, 6, 10],
  // A reputação anda devagar (cerca de 10 pontos separam um degrau do seguinte).
  REPUTATION_STEPS: [1, 2, 4],
  // Dinheiro: fração do custo de vida anual da categoria (no kart regional, R$ 6 mil por ano:
  // R$ 300, R$ 900 e R$ 2.400; no Grand Prix Mundial, R$ 17,5 mil, R$ 52,5 mil e R$ 140 mil).
  MONEY_STEPS: [0.05, 0.15, 0.4],
  RIVALRY_STEPS: [8, 15, 25],
  // O que uma pessoa lembrada pensa do piloto (−100 a 100).
  ATTITUDE_STEPS: [15, 30, 50],
  SPONSOR_MOOD_STEPS: [5, 12, 22],
  // Interesse de uma equipe no piloto (0 a 100).
  INTEREST_STEPS: [6, 12, 20],
  GRID_PLACES: [3, 5, 10],
  PENALTY_POINTS: [1, 2, 3],
  // Atributos: um treino especial rende pouco; uma lesão mal curada tira pouco.
  ATTRIBUTE_STEPS: [0.3, 0.6, 1],
  // Rendimento do equipamento (motor e chassi, 40 a 99).
  CAR_STEPS: [0.5, 1, 1.5],
  // Custo anual da vaga e multa rescisória: fração do valor atual.
  SEAT_COST_STEPS: [0.04, 0.08, 0.15],
  RELEASE_FEE_STEPS: [0.15, 0.3, 0.5],
  // Relação com o parceiro ou parceira (0 a 100).
  RELATIONSHIP_STEPS: [4, 8, 14],
  // Etapas de uma lesão ou doença curta e longa.
  INJURY_ROUNDS: { short: 1, long: 3 },

  // Chances dos desfechos sorteados. `rest` é o que falta para 100%.
  ODDS: { sure: 1, likely: 0.75, even: 0.5, unlikely: 0.3 },
  // Prazos entre passos de cadeia, em etapas ou em temporadas (a partir da primeira etapa).
  DELAYS: {
    next: { rounds: 1, seasons: 0 },
    soon: { rounds: 3, seasons: 0 },
    later: { rounds: 6, seasons: 0 },
    nextSeason: { rounds: 0, seasons: 1 },
    twoSeasons: { rounds: 0, seasons: 2 },
    whenever: { rounds: 0, seasons: 0 },
  },

  // Faixas que as condições citam por nome.
  // Fases da vida (idade mínima de cada uma).
  AGE_STAGES: { teen: 0, young: 18, adult: 25, veteran: 35 },
  // Posição no campeonato: a pior posição de cada faixa; "metade de trás" começa depois do 10º.
  STANDING_LEVELS: { leader: 1, top3: 3, top5: 5, top10: 10, backHalf: 11 },
  // Indicadores de 0 a 100: muito baixo e baixo são "até"; alto e muito alto são "a partir de".
  STAT_LEVELS: { veryLow: 20, low: 35, high: 65, veryHigh: 80 },
  // Atitude de uma pessoa: hostil e negativa são "até"; positiva e fiel, "a partir de".
  ATTITUDE_LEVELS: { hostile: -40, negative: -1, positive: 0, loyal: 40 },
  // Caixa, em custos de vida anuais da categoria: no vermelho abaixo de 0; apertado até 0,5;
  // confortável até 4; rico daí para cima.
  CASH_LEVELS: { tight: 0.5, rich: 4 },
  // Aptidões de nascença (0 a 100): "alta" a partir de, "baixa" até.
  APTITUDE_LEVELS: { high: 65, low: 35 },
  // Rivalidade mínima para alguém ser "o rival" de um cartão.
  RIVAL_MIN: 20,
  // Interesse mínimo para uma equipe ser "a equipe interessada".
  INTERESTED_MIN: 55,
  // Posições ganhas ou perdidas do grid à bandeirada para a etapa contar como "ganhou" ou "perdeu muito".
  PLACES_SWING: 5,
  // Umidade da pista (0 a 1) a partir da qual a corrida conta como "na chuva".
  WET_RACE: 0.3,
  // Um lance decisivo vencido conta como "arriscado" se a chance mostrada era menor que isto.
  RISKY_MOMENT_CHANCE: 0.5,
  // O rival que volta ao grid (sem estar no grid de antes) ganha o nível de um piloto desta posição
  // na ordem de forças das equipes (0 = a mais forte, 9 = a mais fraca): o meio do grid.
  FOLLOWER_TEAM_RANK: 5,

  // Convite de academia: chance de passar na avaliação, pela nota do piloto em relação ao nível
  // da categoria e pelo potencial (a mesma conta dos eventos de antes da Fase 5).
  ACADEMY: { BASE: 0.4, RATING_DIVISOR: 40, POTENTIAL_PIVOT: 85, POTENTIAL_DIVISOR: 50, MIN: 0.2, MAX: 0.85 },
  // Convite de academia: quem recebe (degraus, idade, etapa e posição no campeonato).
  ACADEMY_INVITE: { MIN_TIER: 3, MAX_TIER: 6, MAX_AGE: 21, MIN_ROUND: 4, MAX_STANDING: 5 },
} as const;

/**
 * Perfis de patrocinador (Fase 5): cada um com valor, exigência e personalidade. O valor de
 * referência e a meta de cada porte continuam em SPONSOR_RULES (`src/engine/career/sponsors.ts`).
 */
export const SPONSOR_PROFILE_RULES = {
  // Multiplica o valor anual de referência do porte.
  VALUE: { low: 0.8, fair: 1, high: 1.2, premium: 1.4 },
  // Posições somadas à meta do porte: o patrocinador folgado aceita mais atrás; o exigente, menos.
  TARGET_SHIFT: { easy: 3, normal: 0, hard: -3 },
  // Quanto da queda de satisfação de cada etapa a personalidade sente (1 = normal).
  PATIENCE: { patient: 0.6, demanding: 1.4, vain: 1.1, discreet: 0.9, loyal: 0.5, impulsive: 1.6 },
  // Quanto da alta de satisfação ela sente (o vaidoso adora pódio; o discreto mal comemora).
  ENTHUSIASM: { patient: 1, demanding: 0.8, vain: 1.4, discreet: 0.8, loyal: 1.1, impulsive: 1.3 },
  // Satisfação de um patrocinador que acaba de assinar (a mesma de antes da Fase 5).
  START_SATISFACTION: 60,
  // O valor de cada proposta varia até 10% para cima ou para baixo (faixa de 20%), e metade dos
  // contratos vale por mais uma temporada (as mesmas contas de antes da Fase 5).
  VALUE_VARIATION: 0.2,
  EXTRA_SEASON_CHANCE: 0.5,
  // Pechinchar: o valor sobe isto e a meta aperta tantas posições, se o patrocinador topar.
  HAGGLE_VALUE: 1.2,
  HAGGLE_TARGET: -1,
} as const;

/* ------------------------------------------------------------------ */
/* Dinastia e aposentadoria (Fase 6)                                   */
/* ------------------------------------------------------------------ */

/**
 * Herança de talentos e defeitos. Cada filho nasce com três traços de nascença, como o fundador
 * (um talento, um defeito e um terceiro qualquer, sem os dois lados de um par): parte vem do pai ou
 * da mãe, parte é sorteada. Ficam ocultos até o teste no kart e as temporadas de carreira própria.
 * Aqui também estão os números do que se vê de um filho antes da sucessão (o teste, a avaliação dos
 * treinadores) e da evolução dele na carreira própria.
 */
export const HERITAGE = {
  // Chance de cada traço do pai ou da mãe passar para um filho. Com três traços, em média 1,2 passa:
  // o "gênio na chuva" costuma aparecer na família, e o "esquentado" também.
  INHERIT_CHANCE: 0.4,
  // Composição dos traços de um filho (a mesma do nascimento sorteado).
  TALENTS: 1,
  DEFECTS: 1,
  EXTRA_TRAITS: 1,
  // Teste no kart: a idade em que ele acontece (a adolescência, antes da carreira própria aos 14).
  KART_TEST_AGE: 12,
  // Custo do teste completo (um dia inteiro com instrutores) e do rápido (uma tarde).
  KART_TEST_COST: { full: 3_000, quick: 900 },
  // Quantos traços ocultos cada teste revela.
  KART_TEST_REVEALS: { full: 2, quick: 1 },
  // Vínculo que o filho perde quando a família não o leva ao teste.
  KART_TEST_SKIP_BOND: 4,
  // Diferença para o tempo de referência, em segundos: base, quanto cada ponto de teto abaixo do
  // teto de referência soma (acima dele, tira), quanto cada ano de formação no kart tira e o acaso
  // do dia (desvio). Um teto 90 com seis anos de kart fica a 0,1 s; um teto 70 sem kart, a uns 1,4 s.
  KART_TEST_GAP: { BASE: 0.6, REFERENCE_TALENT: 90, PER_TALENT_POINT: 0.04, PER_KART_YEAR: 0.08, SD: 0.12 },
  // Faixas da diferença para o veredito dos instrutores (até cada valor, em segundos).
  KART_TEST_VERDICTS: { outstanding: 0.2, promising: 0.45, average: 0.8 },
  // Chance de cada temporada de carreira própria (por fora ou no campeonato do jogador) revelar mais
  // um traço.
  SEASON_REVEAL_CHANCE: 0.5,
  // Evolução de um filho numa temporada de carreira própria por fora do campeonato do jogador, pelo
  // apoio da família: completo, básico ou nenhum. Os números estavam soltos em `closeChildSeason`; a
  // Fase 6 mexeu nessa conta (aprender rápido ou devagar) e os trouxe para cá, sem mudar os valores.
  SUPPORT_DEVELOPMENT: { full: 1, basic: 0.92, none: 0.85 },
  // Avaliação dos treinadores sobre o teto de um filho (`childScoutReport`, que a tela da sucessão e o
  // robô leem): o teto mínimo de cada faixa, da melhor para a pior ("Fora de série", "Muito
  // promissor", "Promissor", "Mediano"); abaixo da última, "Limitado". Só existe com a carreira em
  // andamento ou depois deste tanto de anos de kart: antes, ninguém viu a criança pilotar. Valores de
  // antes da Fase 6, trazidos para cá sem mudança.
  SCOUT_BANDS: { outstanding: 90, veryPromising: 86, promising: 82, average: 76 },
  SCOUT_MIN_KART_YEARS: 0.5,
  // Aptidões de corpo e mente do herdeiro: esta parte vem do pai ou da mãe e o resto da média 50,
  // com o desvio abaixo (um herdeiro não é cópia de ninguém).
  APTITUDE_PARENT_WEIGHT: 0.5,
  APTITUDE_SD: 10,
  // Limites das aptidões (os mesmos do nascimento sorteado).
  APTITUDE_MIN: 15,
  APTITUDE_MAX: 95,
} as const;

/**
 * O ano de transição: o primeiro ano fora do carro. Cada papel paga um cachê por etapa (fração do
 * custo de vida de referência do personagem, que acompanha o prestígio dele) e deixa um legado.
 */
export const TRANSITION = {
  // Cachê por etapa, em custos de vida anuais de referência. Comentarista e embaixador também
  // ganham pela reputação (cada ponto acima de FEE_REPUTATION_FLOOR soma esta fração, por etapa).
  FEE_SHARE: { mentor: 0.04, commentator: 0.06, ambassador: 0.08 },
  FEE_PER_REPUTATION: { mentor: 0, commentator: 0.001, ambassador: 0.002 },
  FEE_REPUTATION_FLOOR: 30,
  // Reputação mínima para cada papel (o embaixador precisa de um nome que venda).
  MIN_REPUTATION: { mentor: 0, commentator: 15, ambassador: 30 },
  // Reputação no fechamento do ano de transição: o comentarista fica em evidência, o embaixador
  // também; o mentor ganha se o pupilo terminar entre os 5 primeiros.
  SEASON_REPUTATION: { mentor: 0, commentator: 2, ambassador: 1 },
  MENTOR_TOP_REPUTATION: 2,
  MENTOR_TOP_POSITION: 5,
  // Mentor: o pupilo treina mais. Um piloto do campeonato ganha esta fração de ciclo de treino extra
  // por etapa; um filho, este multiplicador na evolução do ano.
  MENTOR_EXTRA_CYCLES: 0.5,
  MENTOR_CHILD_DEVELOPMENT: 1.12,
  // Idade máxima do pupilo que o mentor acompanha (pilotos do campeonato).
  MENTOR_MAX_AGE: 21,
  // Legado do mentor: o pupilo aceita a equipe do ex-mentor mais facilmente (pontos de atração).
  MENTOR_LOYALTY: 15,
  // Legado do comentarista: prestígio extra no mercado de dirigentes no fechamento do ano.
  COMMENTATOR_PRESTIGE: 6,
  // Legado do embaixador: a marca patrocina o herdeiro que correr (fração do custo da vaga da
  // categoria dele, por temporada) durante estas temporadas.
  AMBASSADOR_HEIR_SHARE: 0.15,
  AMBASSADOR_HEIR_SEASONS: 3,
  // A vida em viagem: relação com o parceiro e com os filhos no ano (embaixador e comentarista).
  TRAVEL_RELATIONSHIP: { mentor: 2, commentator: -2, ambassador: -4 },
  // Chance de um evento do ano de transição depois de cada etapa (cada evento sai uma vez).
  EVENT_CHANCE: 0.45,
  // Tamanho dos efeitos dos eventos (o tamanho 1, 2 ou 3 do evento escolhe a posição na lista):
  // dinheiro em custos de vida anuais; reputação e moral em pontos; relação com o parceiro e vínculo
  // dos filhos em pontos (EVENT_BOND vale para os dois).
  EVENT_MONEY: [0.05, 0.15, 0.3],
  EVENT_REPUTATION: [1, 2, 3],
  EVENT_MORALE: [3, 6, 10],
  EVENT_BOND: [3, 6, 10],
} as const;

/**
 * O peso do sobrenome. Da segunda geração em diante, o herdeiro carrega a fama da família: mais
 * reputação e mais contatos, e a imprensa compara o tempo todo (resultado ruim pesa mais). O peso é
 * a fama do antecessor mais famoso: 0 até FAME_FLOOR de reputação máxima, 1 com 100.
 */
export const SURNAME = {
  FAME_FLOOR: 30,
  // Interesse extra das equipes (contatos), com peso 1.
  CONTACTS_INTEREST: 10,
  // No fechamento, uma queda de reputação pesa até esta fração a mais (com peso 1).
  BAD_RESULT_WEIGHT: 0.6,
  // Terminar na metade de trás do campeonato custa até estes pontos de reputação a mais.
  BACK_HALF_REPUTATION: 3,
  // Por etapa: moral perdida ao terminar fora dos 10 primeiros (ou abandonar), com peso 1.
  ROUND_MORALE: 2,
  // Chance de a imprensa comparar com o antecessor numa etapa (só mensagem).
  PRESS_CHANCE: 0.25,
} as const;

/**
 * Começo do herdeiro nas pistas e a equipe da família. Só da segunda geração em diante alguém
 * começa numa equipe boa: o dinheiro da família paga a vaga.
 */
export const HEIR_START = {
  // Força da equipe boa que o herdeiro pode comprar na categoria dele (0 = a melhor).
  TOP_SEAT_RANK: 1,
  // O preço da vaga na equipe boa leva este ágio sobre a tabela (a equipe cobra o sobrenome).
  TOP_SEAT_PREMIUM: 0.25,
  // A compra da vaga tem de deixar pelo menos esta reserva, em custos de vida anuais da categoria.
  TOP_SEAT_RESERVE: 1,
  // Contrato do primeiro ano do herdeiro piloto, pela força da equipe em que ele larga (t = força / 9:
  // 0 na melhor, 1 na mais fraca). Salário: esta fração da tabela da categoria naquela força. Bônus
  // por vitória: o da categoria × (WIN_BONUS[0] − WIN_BONUS[1] × t); pódio e ponto valem estas frações
  // do bônus por vitória, e o título, TITLE_MULTIPLIER vezes ele.
  CONTRACT: {
    SALARY_SHARE: 0.7,
    WIN_BONUS: [1.2, 0.7],
    PODIUM_SHARE: 0.35,
    POINT_SHARE: 0.02,
    TITLE_MULTIPLIER: 5,
  },
} as const;

export const FAMILY_TEAM = {
  // A equipe da família cobra do herdeiro esta fração da vaga de tabela (o resto é a família).
  SEAT_SHARE: 0,
  // Favorecimento: cada etapa em que o filho termina atrás do companheiro custa reputação à equipe
  // (dirigente) ou moral ao piloto (herdeiro); no fechamento, terminar atrás do companheiro custa
  // reputação ao personagem e à equipe.
  ROUND_TEAM_REPUTATION: 0.3,
  ROUND_MORALE: 1.5,
  SEASON_REPUTATION: 2,
  SEASON_TEAM_REPUTATION: 3,
  // Bater o companheiro cala a imprensa: reputação no fechamento.
  SEASON_BEAT_TEAMMATE_REPUTATION: 1,
  // Chance de a imprensa falar em favorecimento numa etapa em que o filho ficou atrás (só mensagem).
  PRESS_CHANCE: 0.3,
} as const;

/**
 * Maus investimentos: da segunda geração em diante, quem herda dinheiro atrai propostas de negócio.
 * No começo do ano, com patrimônio líquido acima do mínimo, um conhecido oferece um negócio.
 */
export const BAD_INVESTMENT = {
  CHANCE: 0.3,
  // Patrimônio mínimo, em custos de vida anuais de referência.
  MIN_WEALTH: 20,
  // Quanto do caixa e das aplicações o negócio pede.
  STAKE_SHARE: 0.15,
  // Desfechos: na maioria das vezes perde boa parte; às vezes ganha um pouco.
  LOSS_CHANCE: 0.65,
  LOSS_SHARE: 0.7,
  GAIN_SHARE: 0.3,
} as const;

/**
 * Os filhos que não herdaram a carreira e o personagem anterior. Os números de cada caminho:
 * nível no ofício, desconto quando um parente é contratado e o patrocínio da empresa de quem foi
 * para os negócios.
 */
export const RELATIVES = {
  // Nível no ofício: base + parte do teto de piloto + o acaso (desvio).
  SKILL_BASE: 35,
  SKILL_TALENT_WEIGHT: 0.4,
  SKILL_SD: 8,
  // Idade em que um parente passa a trabalhar e em que para.
  WORK_FROM_AGE: 22,
  WORK_UNTIL_AGE: 68,
  // Contratado pela equipe da família, aceita ganhar esta fração do salário de mercado.
  STAFF_SALARY_SHARE: 0.7,
  // Um parente nos boxes ou na direção de outra equipe abre portas: interesse extra das equipes por
  // parente nesses caminhos, até o teto.
  CONTACT_INTEREST: 3,
  CONTACT_INTEREST_MAX: 6,
  // Um parente nos negócios patrocina o herdeiro que corre: fração do custo da vaga da categoria por
  // temporada, durante estas temporadas, se a relação estiver pelo menos neste nível.
  BUSINESS_SPONSOR_SHARE: 0.12,
  BUSINESS_SPONSOR_SEASONS: 4,
  BUSINESS_SPONSOR_MIN_BOND: 40,
  // O personagem anterior, vivo depois de passar o comando: mortalidade anual pela mesma tábua do
  // jogador (FAMILY.MORTALITY), com sorteio próprio.
} as const;

/**
 * Mapa das tabelas de balanceamento que moram fora deste arquivo: caminho do módulo → nomes
 * exportados. Dados por categoria, pista e equipe ficam em `src/data`; regras gerais de cada
 * sistema, no próprio módulo do motor.
 */
export const BALANCE_TABLES: Readonly<Record<string, readonly string[]>> = {
  // Dados por categoria, pista, equipe e piloto.
  'src/data/categories.ts': ['CATEGORIES', 'LICENSE_WINDOW_SEASONS', 'PENALTY_POINTS_BAN'],
  'src/data/tracks.ts': ['TRACKS', 'BR_KART_TRACKS', 'WORLD_KART_TRACKS', 'CIRCUITS'],
  'src/data/teams.ts': ['TEAMS', 'TEAM_TARGETS', 'ROOKIE_TEAM_IDS'],
  'src/data/drivers.ts': ['AI_DRIVERS', 'NEUTRAL_CONDITION'],
  'src/data/names.ts': ['NATIONALITY_WEIGHTS'],
  // Criação do piloto e fim de semana.
  'src/data/rules.ts': [
    'PLAYER_BACKGROUNDS',
    'PLAYER_BONUS_POINTS',
    'PLAYER_BONUS_MAX_PER_ATTRIBUTE',
    'PLAYER_MIN_AGE',
    'PLAYER_MAX_AGE',
    'STARTING_REPUTATION',
    'QUALIFYING_ATTEMPTS',
    'PRACTICE_LAPS',
  ],
  // Corrida: tempo de volta, pneus, incidentes, direção de prova.
  'src/engine/simulation/constants.ts': ['SIM', 'RACE', 'TYRES', 'CONDITION', 'RACE_MODE_EFFECTS', 'QUALIFYING_APPROACH_EFFECTS', 'PRACTICE_PROGRAM_EFFECTS'],
  // Carreira do piloto.
  'src/engine/career/economy.ts': ['ECONOMY'],
  'src/engine/career/development.ts': ['DEVELOPMENT', 'INTENSITY_GAIN', 'DECLINE_START_AGE'],
  'src/engine/career/training.ts': ['TRAINING_GROUPS'],
  'src/engine/career/condition.ts': ['CONDITION_RULES'],
  'src/engine/career/contracts.ts': ['CONTRACT_RULES'],
  'src/engine/career/market.ts': ['MARKET'],
  'src/engine/career/offseason.ts': ['REPUTATION', 'TEAM_EVOLUTION', 'DEBT_SETTLEMENT_REPUTATION'],
  'src/engine/career/sponsors.ts': ['SPONSOR_RULES'],
  'src/engine/career/roundEffects.ts': ['RELATION_RULES'],
  // Eventos: o registro guardado no save (os números dos cartões estão em STORY_EVENTS).
  'src/engine/events/engine.ts': ['EVENT_RULES'],
  // Patrimônio, família e gestão de equipe.
  'src/data/assets.ts': ['ASSET_RULES', 'LIFESTYLE_RULES', 'STOCKS', 'PROPERTIES', 'BUSINESSES'],
  'src/data/family.ts': ['FAMILY', 'TRAITS', 'PARTNER_BACKGROUND_INFO'],
  'src/data/management.ts': ['MANAGEMENT', 'TEAM_ECONOMY', 'REGULATIONS', 'DEV_EFFECTS'],
  'src/engine/management/events.ts': ['MANAGEMENT_EVENT_CHANCE'],
  'src/engine/management/team.ts': ['VACANT_RATING'],
};
