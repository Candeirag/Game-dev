/**
 * Constantes do modelo de simulação, cada uma com a sua justificativa.
 * Toda a calibragem fica concentrada aqui para facilitar o balanceamento.
 *
 * Referência de escala: em uma volta de cerca de 50 s, um grid de kart
 * regional costuma ficar dentro de 0,6 a 1,0 s entre o primeiro e o último na
 * classificação. As constantes abaixo reproduzem essa dispersão.
 */
export const SIM = {
  /* ---------------- Tempo de volta ---------------- */

  /**
   * Perda de tempo por ponto de nota do piloto abaixo de 100, como fração da
   * volta. 20 pontos de diferença dão 0,44% (cerca de 0,22 s em 50 s).
   */
  DRIVER_RATING_TIME_FACTOR: 0.00022,
  /**
   * Mesmo cálculo para o kart. É um pouco menor que o do piloto: no kart, o
   * piloto pesa mais que o equipamento.
   */
  KART_RATING_TIME_FACTOR: 0.00014,
  /**
   * Ganho máximo de um acerto perfeito (setupScore = 1): 0,7%, cerca de 0,35 s.
   * O acerto é a "forma do fim de semana": acertar a janela do kart em cada
   * pista é o que mais embaralha a ordem entre equipes próximas.
   */
  SETUP_MAX_GAIN: 0.007,
  /** Quanto a volta fica mais lenta com a pista totalmente molhada (+9%). */
  WET_LAP_PENALTY: 0.09,

  /* ---------------- Consistência e ruído ---------------- */

  /** Desvio mínimo da volta de um piloto perfeito (0,1% = 0,05 s). */
  NOISE_BASE: 0.001,
  /**
   * Desvio extra por ponto de consistência abaixo de 100. Com consistência 50,
   * o desvio total é de 0,3% (cerca de 0,15 s por volta).
   */
  NOISE_PER_CONSISTENCY_POINT: 0.00004,
  /** Desvio extra por ponto de concentração abaixo de 100, ao fim da corrida (cansaço). */
  FATIGUE_PER_FOCUS_POINT: 0.00002,
  /** A pista molhada amplia a irregularidade em até 60%. */
  WET_NOISE_MULTIPLIER: 0.6,

  /* ---------------- Erros ---------------- */

  /** Chance de erro por volta de um piloto com consistência e concentração 100. */
  ERROR_BASE: 0.003,
  /** Chance extra por ponto de consistência abaixo de 100. */
  ERROR_PER_CONSISTENCY_POINT: 0.00012,
  /** Chance extra por ponto de concentração abaixo de 100, crescendo ao longo da corrida. */
  ERROR_PER_FOCUS_POINT: 0.00008,
  /** Chance extra com chuva para um piloto com nota 0 em chuva (cai em proporção à nota). */
  ERROR_WET_EXTRA: 0.025,
  /** Distribuição da gravidade de um erro no seco: leve, rodada ou abandono. */
  ERROR_SEVERITY_DRY: { minor: 0.72, spin: 0.25, crash: 0.03 },
  /** Na chuva, rodadas e abandonos ficam mais prováveis. */
  ERROR_SEVERITY_WET: { minor: 0.6, spin: 0.34, crash: 0.06 },
  /** Tempo perdido em um erro leve (saída de traçado), em segundos. */
  MINOR_ERROR_LOSS: [0.8, 2.2] as const,
  /** Tempo perdido em uma rodada, em segundos. */
  SPIN_LOSS: [4.0, 9.0] as const,

  /* ---------------- Mecânica ---------------- */

  /**
   * Chance de quebra por volta = (100 - confiabilidade)² × fator. Com
   * confiabilidade 70, dá cerca de 3% por corrida; com 88, menos de 0,5%.
   */
  MECHANICAL_FAILURE_FACTOR: 0.0000015,

  /* ---------------- Pneus ---------------- */

  /**
   * Desgaste por volta em pista de desgaste médio (1.0) com gestão de pneus 50. Quanto tempo de
   * volta cada ponto de desgaste custa está em `TYRE_CURVE` (`src/config/balance.ts`).
   */
  TYRE_WEAR_PER_LAP: 0.032,
  /** Na chuva, o pneu aquece menos e desgasta menos. */
  WET_TYRE_WEAR_MULTIPLIER: 0.6,

  /* ---------------- Ultrapassagem ---------------- */

  /** Distância mínima entre dois karts na mesma posição relativa, em segundos. */
  MIN_GAP: 0.18,
  /** Tempo perdido por quem tenta ultrapassar e não consegue. */
  FAILED_PASS_LOSS: 0.12,
  /** Tempo perdido por quem é ultrapassado (precisa defender e perde a linha). */
  DEFENDED_PASS_LOSS: 0.08,
  /** Máximo de ultrapassagens de um mesmo piloto em uma única volta. */
  MAX_PASSES_PER_LAP: 2,
  /**
   * Coeficientes da logística (sigmoide) que dá a chance de sucesso:
   * logit = BASE + skill × (ataque − defesa) + pace × (vantagem de ritmo em s)
   *       − difficulty × (dificuldade da pista).
   */
  PASS_LOGIT_BASE: -0.6,
  PASS_LOGIT_SKILL: 1 / 18,
  PASS_LOGIT_PACE: 3.5,
  PASS_LOGIT_DIFFICULTY: 3.0,
  /** Chance-base de toque quando uma ultrapassagem dá errado. */
  COLLISION_ON_FAILED_PASS: 0.035,
  /** Fração dos toques que tiram alguém da corrida. */
  COLLISION_DNF_SHARE: 0.25,

  /* ---------------- Largada ---------------- */

  /** Distância entre posições no grid na largada, em segundos. */
  GRID_SPACING: 0.25,
  /** Desvio da reação na largada para experiência e concentração 0 (em s). */
  START_REACTION_SPREAD: 0.5,
  /** A primeira volta facilita ultrapassagens (pelotão embolado): multiplica a dificuldade. */
  FIRST_LAP_DIFFICULTY_FACTOR: 0.6,

  /* ---------------- Classificação ---------------- */

  /** A pista ganha borracha a cada tentativa da classificação: 0,05% por tentativa. */
  TRACK_EVOLUTION_PER_ATTEMPT: 0.0005,
  /**
   * Na volta lançada, com pneus novos e pista livre, o piloto é mais regular
   * que em uma volta de corrida, presa ao tráfego: o ruído cai para 70%.
   */
  QUALIFYING_NOISE_FACTOR: 0.7,
} as const;

/** Efeitos dos modos de corrida. */
export const RACE_MODE_EFFECTS = {
  conservative: { pace: 0.0025, error: 0.6, tyreWear: 0.8, attack: -0.6, defend: 0.0, collision: 0.6 },
  balanced: { pace: 0, error: 1, tyreWear: 1, attack: 0, defend: 0, collision: 1 },
  aggressive: { pace: -0.0015, error: 1.5, tyreWear: 1.25, attack: 0.6, defend: 0.3, collision: 1.6 },
} as const;

/** Efeitos das abordagens de classificação. */
export const QUALIFYING_APPROACH_EFFECTS = {
  safe: { pace: 0.0008, error: 0.5 },
  balanced: { pace: 0, error: 1 },
  /**
   * Cerca de 0,05 s mais rápido, com 2,2 vezes o risco de errar. Um piloto
   * regular (consistência 80) perde perto de 5% das tentativas; um irregular
   * (consistência 55), perto de 14%.
   */
  attack: { pace: -0.001, error: 2.2 },
} as const;

/**
 * Efeitos dos programas de treino livre. Cada um traz um benefício diferente
 * para o resto do fim de semana; não existe escolha dominante.
 */
export const PRACTICE_PROGRAM_EFFECTS = {
  /** Foco em acerto: +0,1 de setupScore sobre os outros programas (≈0,035 s em todas as voltas). */
  setup: { setupBonus: 0.16, qualifyingBonus: 0, tyreWearFactor: 1 },
  /** Simulação de classificação: ≈0,07 s a menos na volta lançada, só no sábado. */
  qualifying: { setupBonus: 0.06, qualifyingBonus: 0.0015, tyreWearFactor: 1 },
  /** Ritmo de corrida: 15% menos desgaste, decisivo em pistas abrasivas. */
  longRun: { setupBonus: 0.06, qualifyingBonus: 0, tyreWearFactor: 0.85 },
} as const;

/* ================================================================== */
/* Fase 2: pneus, combustível, boxes, neutralizações, punições, danos  */
/* ================================================================== */

/**
 * Compostos de pneu. "pace" é o ajuste no tempo de volta (negativo = mais
 * rápido) e "wear" multiplica o desgaste por volta.
 *
 * Calibragem: com desgaste-base de 3,2% por volta, o médio chega ao "penhasco"
 * (80% de desgaste) em cerca de 25 voltas, o macio (72%) em 13 e o duro (88%) em 40; os
 * penhascos e a curva de perda de cada composto estão em `TYRE_CURVE`
 * (`src/config/balance.ts`). Numa corrida do Grand Prix Mundial de 58 voltas, uma parada
 * (médio + duro) e duas paradas (macio + médio + médio) custam quase o mesmo tempo total; a
 * escolha depende da pista, do piloto e das neutralizações.
 */
export const TYRES = {
  kart: { pace: 0, wear: 1, rain: false, label: 'Kart' },
  soft: { pace: -0.006, wear: 1.7, rain: false, label: 'Macio' },
  medium: { pace: 0, wear: 1, rain: false, label: 'Médio' },
  hard: { pace: 0.005, wear: 0.68, rain: false, label: 'Duro' },
  intermediate: { pace: 0, wear: 1, rain: true, label: 'Intermediário' },
  wet: { pace: 0, wear: 0.8, rain: true, label: 'Chuva' },
} as const;

export const RACE = {
  /* ---------------- Combustível ---------------- */

  /** Um tanque cheio (combustível para a corrida toda) deixa a volta 2,5% mais lenta. */
  FUEL_FULL_TANK_PENALTY: 0.025,
  /** Margem de combustível embarcada além da distância da corrida. */
  FUEL_MARGIN: 0.03,
  /** Consumo relativo por modo de pilotagem. */
  FUEL_USE: { conservative: 0.93, balanced: 1, aggressive: 1.06 },
  /** Consumo relativo atrás do safety car e sob safety car virtual. */
  FUEL_USE_SC: 0.5,
  FUEL_USE_VSC: 0.65,

  /* ---------------- Boxes ---------------- */

  /** Tempo de serviço de uma parada perfeita, em segundos. */
  PIT_SERVICE: 2.8,
  /** Segundos extras por ponto de qualidade da equipe de box abaixo de 100. */
  PIT_SERVICE_PER_CREW_POINT: 0.035,
  /** Chance de parada lenta para uma equipe de box nota 0 (cai em proporção à nota). */
  PIT_SLOW_STOP_CHANCE: 0.12,
  PIT_SLOW_STOP_LOSS: [3, 9] as const,
  /** Tempo extra para reparar danos (troca de asa dianteira). */
  PIT_REPAIR_TIME: 9,
  /** O segundo carro da equipe espera quando os dois param na mesma volta. */
  PIT_DOUBLE_STACK_LOSS: 3,
  /** Parar sob neutralização custa menos, porque o pelotão anda devagar. */
  PIT_LOSS_FACTOR_SC: 0.5,
  PIT_LOSS_FACTOR_VSC: 0.65,
  /** Chance-base de excesso de velocidade no pit lane e de liberação insegura. */
  PIT_SPEEDING_CHANCE: 0.012,
  UNSAFE_RELEASE_CHANCE: 0.008,

  /* ---------------- Neutralizações ---------------- */

  /** Volta atrás do safety car, em relação à volta de referência. */
  SC_LAP_FACTOR: 1.45,
  /** Ritmo de quem ainda está alcançando a fila do safety car. */
  SC_CATCHUP_FACTOR: 1.12,
  /** Distância entre carros na fila do safety car, em segundos. */
  SC_GAP: 0.5,
  SC_LAPS: [3, 5] as const,
  VSC_LAP_FACTOR: 1.32,
  VSC_LAPS: [1, 2] as const,
  /** Chance de neutralização por tipo de incidente: [safety car, safety car virtual, bandeira vermelha]. */
  NEUTRALIZATION_ODDS: {
    crash: [0.4, 0.3, 0.02],
    collision: [0.5, 0.25, 0.05],
    mechanical: [0.12, 0.4, 0],
    spin: [0, 0.06, 0],
  },
  /** Com a pista encharcada (umidade ≥ 0,9), um acidente tem chance extra de bandeira vermelha. */
  RED_FLAG_HEAVY_RAIN_CHANCE: 0.25,
  /** Se a bandeira vermelha sai depois de 75% da prova, a corrida não é retomada. */
  RED_FLAG_END_PROGRESS: 0.75,
  /** Na relargada, o pelotão compacto facilita as ultrapassagens. */
  RESTART_DIFFICULTY_FACTOR: 0.75,

  /* ---------------- Punições ---------------- */

  /** Reação tão adiantada (em desvios-padrão) que configura queima de largada. */
  JUMP_START_THRESHOLD: -2.2,
  JUMP_START_PENALTY: 5,
  /** Erros leves a partir dos quais os comissários punem por limites de pista. */
  TRACK_LIMITS_STRIKES: 3,
  TRACK_LIMITS_PENALTY: 5,
  /** Chance de o atacante ser considerado culpado por um toque. */
  COLLISION_FAULT_CHANCE: 0.6,
  COLLISION_PENALTY: 5,
  /** Toque que tira um rival da corrida: 10 s, 2 pontos de punição e 3 posições no próximo grid. */
  COLLISION_DNF_PENALTY: 10,
  COLLISION_DNF_GRID_DROP: 3,
  PIT_PENALTY: 5,
  /** Punição por não usar dois compostos em corrida seca, quando a regra exige. */
  COMPOUND_RULE_PENALTY: 30,

  /* ---------------- Danos e lesões ---------------- */

  /** Um carro com dano 1,0 fica 1,2% mais lento. */
  DAMAGE_TIME_PENALTY: 0.012,
  /** Dano a partir do qual o carro não consegue continuar. */
  DAMAGE_RETIRE: 1,
  DAMAGE_COLLISION_ATTACKER: [0.25, 0.6] as const,
  DAMAGE_COLLISION_DEFENDER: [0.1, 0.4] as const,
  DAMAGE_SPIN_CHANCE: 0.2,
  DAMAGE_SPIN: [0.1, 0.3] as const,
  /** Chance de lesão em um acidente que tira o piloto da corrida. */
  INJURY_CHANCE: { kart: 0.05, formula: 0.04, f1: 0.02 },

  /* ---------------- Ordens de equipe ---------------- */

  /** Distância máxima entre companheiros para a equipe pedir a troca de posições. */
  TEAM_ORDER_GAP: 0.6,
  /** Vantagem mínima de ritmo do primeiro piloto (fração da volta) para a equipe intervir. */
  TEAM_ORDER_PACE_ADVANTAGE: 0.0015,
  /** Chance de um piloto da IA obedecer à ordem. */
  TEAM_ORDER_AI_OBEY: 0.85,
  TEAM_ORDER_SWAP_LOSS: 0.4,
} as const;

/** Efeitos da condição do piloto. Em 50, todos os efeitos são neutros. */
export const CONDITION = {
  /** Fase: ±0,12% no tempo de volta entre 0 e 100. */
  FORM_PACE: 0.0012,
  /** Confiança: multiplicador de erro de 1,25 (em 0) a 0,75 (em 100). */
  CONFIDENCE_ERROR: 0.25,
  /** Confiança: ajuste no logit das disputas, de -0,8 a +0,8. */
  CONFIDENCE_ATTACK: 0.8,
  /** Moral: multiplicador do ruído de volta de 1,1 (em 0) a 0,9 (em 100). */
  MORALE_NOISE: 0.1,
  /** Correr com lesão leve: 0,3% mais lento e 30% mais erros. */
  INJURY_PACE: 0.003,
  INJURY_ERROR: 1.3,
} as const;
