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
