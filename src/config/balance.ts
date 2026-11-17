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
