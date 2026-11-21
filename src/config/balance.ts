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
  // Eventos.
  'src/engine/events/engine.ts': ['EVENT_RULES'],
  'src/engine/events/definitions.ts': ['EVENT_DEFINITIONS'],
  // Patrimônio, família e gestão de equipe.
  'src/data/assets.ts': ['ASSET_RULES', 'LIFESTYLE_RULES', 'STOCKS', 'PROPERTIES', 'BUSINESSES'],
  'src/data/family.ts': ['FAMILY', 'TRAITS', 'PARTNER_BACKGROUND_INFO'],
  'src/data/management.ts': ['MANAGEMENT', 'TEAM_ECONOMY', 'REGULATIONS', 'DEV_EFFECTS'],
  'src/engine/management/events.ts': ['MANAGEMENT_EVENT_CHANCE'],
  'src/engine/management/team.ts': ['VACANT_RATING'],
};
