/**
 * Modelo de dados do jogo.
 *
 * Os schemas Zod são a fonte única da verdade: os tipos TypeScript usados em
 * todo o projeto são inferidos daqui, e os mesmos schemas validam qualquer
 * save carregado do disco. Assim, tipo estático e validação em tempo de
 * execução nunca divergem.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Primitivos                                                          */
/* ------------------------------------------------------------------ */

/** Atributo de 0 a 100. Guardado com casas decimais para permitir evolução gradual. */
export const RatingSchema = z.number().min(0).max(100);

export const ATTRIBUTE_KEYS = [
  'pace',
  'consistency',
  'overtaking',
  'defending',
  'focus',
  'racecraft',
  'tyreManagement',
  'wetSkill',
  'experience',
] as const;
export const AttributeKeySchema = z.enum(ATTRIBUTE_KEYS);
export type AttributeKey = z.infer<typeof AttributeKeySchema>;

export const DriverAttributesSchema = z.object({
  pace: RatingSchema,
  consistency: RatingSchema,
  overtaking: RatingSchema,
  defending: RatingSchema,
  focus: RatingSchema,
  racecraft: RatingSchema,
  tyreManagement: RatingSchema,
  wetSkill: RatingSchema,
  experience: RatingSchema,
});
export type DriverAttributes = z.infer<typeof DriverAttributesSchema>;

export const TRAINING_FOCUSES = ['speed', 'racecraft', 'consistency', 'tyres', 'wet', 'balanced'] as const;
export const TrainingFocusSchema = z.enum(TRAINING_FOCUSES);
export type TrainingFocus = z.infer<typeof TrainingFocusSchema>;

/* ------------------------------------------------------------------ */
/* Entidades                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORY_IDS = ['kart-regional', 'kart-national', 'kart-international', 'f4', 'f3', 'f2', 'f1'] as const;
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

/* ------------------------------------------------------------------ */
/* Condição do piloto                                                  */
/* ------------------------------------------------------------------ */

/** Estado psicológico e esportivo. 50 é neutro: não ajuda nem atrapalha. */
export const ConditionSchema = z.object({
  /** Fase recente: resultados acima ou abaixo do esperado. Afeta o ritmo. */
  form: RatingSchema,
  /** Confiança: afeta a chance de erro e o sucesso nas disputas. */
  confidence: RatingSchema,
  /** Moral: afeta a regularidade e o aproveitamento do treino. */
  morale: RatingSchema,
});
export type Condition = z.infer<typeof ConditionSchema>;

export const InjurySchema = z.object({
  description: z.string(),
  /** Leve: pode correr com perda de rendimento. Grave: fica fora. */
  severity: z.enum(['minor', 'serious']),
  roundsRemaining: z.number().int().min(1),
});
export type Injury = z.infer<typeof InjurySchema>;

export const DRIVER_ROLES = ['first', 'second', 'reserve'] as const;
export const DriverRoleSchema = z.enum(DRIVER_ROLES);
export type DriverRole = z.infer<typeof DriverRoleSchema>;

export const DriverSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nationality: z.string().length(2),
  age: z.number().int().min(10).max(60),
  /** Equipe atual, ou null quando o piloto está sem vaga. */
  teamId: z.string().nullable(),
  /** Papel na equipe (null para quem está sem vaga). */
  role: DriverRoleSchema.nullable(),
  /** Última temporada coberta pelo contrato atual (0 = sem contrato). */
  contractEnd: z.number().int().min(0),
  condition: ConditionSchema,
  injury: InjurySchema.nullable(),
  isPlayer: z.boolean(),
  attributes: DriverAttributesSchema,
  /** Teto de desenvolvimento: nenhum atributo treinável cresce além disso. */
  potential: RatingSchema,
  trainingFocus: TrainingFocusSchema,
});
export type Driver = z.infer<typeof DriverSchema>;

export const CarPerformanceSchema = z.object({
  /** Potência do motor: pesa mais em pistas rápidas. */
  engine: RatingSchema,
  /** Chassi/acerto: pesa mais em pistas travadas. */
  chassis: RatingSchema,
  /** Confiabilidade mecânica: reduz a chance de quebra. */
  reliability: RatingSchema,
});
export type CarPerformance = z.infer<typeof CarPerformanceSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Desempenho do equipamento (kart ou carro). */
  car: CarPerformanceSchema,
  /** Qualidade da equipe de box: paradas mais rápidas e menos erros. */
  crew: RatingSchema,
  /** Equipe de F1 a cuja academia esta equipe é ligada (null se independente). */
  affiliation: z.string().nullable(),
  /** Posição no campeonato de pilotos que a equipe espera do seu piloto. */
  driverTarget: z.number().int().min(1).max(30),
});
export type Team = z.infer<typeof TeamSchema>;

/* ------------------------------------------------------------------ */
/* Clima                                                               */
/* ------------------------------------------------------------------ */

export const WeatherConditionSchema = z.enum(['dry', 'damp', 'wet']);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const SessionWeatherSchema = z.object({
  condition: WeatherConditionSchema,
  /** 0 = pista seca, 1 = encharcada. */
  wetness: z.number().min(0).max(1),
  trackTemp: z.number().min(-10).max(70),
});
export type SessionWeather = z.infer<typeof SessionWeatherSchema>;

export const EventWeatherSchema = z.object({
  practice: SessionWeatherSchema,
  qualifying: SessionWeatherSchema,
  race: SessionWeatherSchema,
});
export type EventWeather = z.infer<typeof EventWeatherSchema>;

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

export const ChampionshipEventSchema = z.object({
  round: z.number().int().min(1),
  trackId: z.string().min(1),
  /** Data no formato ISO (AAAA-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weather: EventWeatherSchema,
});
export type ChampionshipEvent = z.infer<typeof ChampionshipEventSchema>;

/* ------------------------------------------------------------------ */
/* Decisões do jogador                                                 */
/* ------------------------------------------------------------------ */

export const PRACTICE_PROGRAMS = ['setup', 'qualifying', 'longRun'] as const;
export const PracticeProgramSchema = z.enum(PRACTICE_PROGRAMS);
export type PracticeProgram = z.infer<typeof PracticeProgramSchema>;

export const QUALIFYING_APPROACHES = ['safe', 'balanced', 'attack'] as const;
export const QualifyingApproachSchema = z.enum(QUALIFYING_APPROACHES);
export type QualifyingApproach = z.infer<typeof QualifyingApproachSchema>;

export const RACE_MODES = ['conservative', 'balanced', 'aggressive'] as const;
export const RaceModeSchema = z.enum(RACE_MODES);
export type RaceMode = z.infer<typeof RaceModeSchema>;

/* ------------------------------------------------------------------ */
/* Resultados de sessão                                                */
/* ------------------------------------------------------------------ */

/** Modificadores que o treino livre gera e que valem até o fim do fim de semana. */
export const WeekendModifiersSchema = z.object({
  /** Qualidade do acerto, de 0 a 1. */
  setupScore: z.number().min(0).max(1),
  /** Ganho percentual de tempo de volta na classificação (0 a 0.01). */
  qualifyingBonus: z.number().min(0).max(0.01),
  /** Multiplicador de desgaste de pneus na corrida (menor é melhor). */
  tyreWearFactor: z.number().min(0.5).max(1.5),
});
export type WeekendModifiers = z.infer<typeof WeekendModifiersSchema>;

export const PracticeEntrySchema = z.object({
  driverId: z.string(),
  teamId: z.string(),
  program: PracticeProgramSchema,
  bestLap: z.number().positive(),
  lapsCompleted: z.number().int().min(0),
  modifiers: WeekendModifiersSchema,
});
export type PracticeEntry = z.infer<typeof PracticeEntrySchema>;

export const PracticeResultSchema = z.object({
  weather: SessionWeatherSchema,
  entries: z.array(PracticeEntrySchema),
});
export type PracticeResult = z.infer<typeof PracticeResultSchema>;

export const QualifyingEntrySchema = z.object({
  driverId: z.string(),
  teamId: z.string(),
  approach: QualifyingApproachSchema,
  /** Uma posição por tentativa; null indica volta invalidada por erro. */
  attempts: z.array(z.number().positive().nullable()),
  bestLap: z.number().positive().nullable(),
  position: z.number().int().min(1),
  /** Classificação eliminatória: fase em que o piloto foi eliminado (ausente = chegou à fase final). */
  eliminatedIn: z.enum(['Q1', 'Q2']).optional(),
  /** Posições perdidas no grid por punição. */
  gridPenalty: z.number().int().min(0),
});
export type QualifyingEntry = z.infer<typeof QualifyingEntrySchema>;

export const QualifyingResultSchema = z.object({
  weather: SessionWeatherSchema,
  /** Ordenado pela posição no grid. */
  entries: z.array(QualifyingEntrySchema),
});
export type QualifyingResult = z.infer<typeof QualifyingResultSchema>;

export const RaceStatusSchema = z.enum(['finished', 'dnf']);
export const DnfReasonSchema = z.enum(['crash', 'mechanical', 'collision', 'fuel', 'damage']);

export const TYRE_COMPOUNDS = ['kart', 'soft', 'medium', 'hard', 'intermediate', 'wet'] as const;
export const TyreCompoundSchema = z.enum(TYRE_COMPOUNDS);
export type TyreCompound = z.infer<typeof TyreCompoundSchema>;
export type DnfReason = z.infer<typeof DnfReasonSchema>;

export const RaceEventSchema = z.object({
  lap: z.number().int().min(0),
  type: z.enum([
    'start', 'overtake', 'error', 'spin', 'dnf', 'collision', 'fastestLap', 'finish',
    'pit', 'safetyCar', 'vsc', 'redFlag', 'restart', 'penalty', 'weather', 'teamOrder', 'damage', 'fuel',
  ]),
  driverId: z.string(),
  otherDriverId: z.string().optional(),
  /** Texto pronto para exibição (gerado pela simulação, não pela UI). */
  message: z.string(),
});
export type RaceEvent = z.infer<typeof RaceEventSchema>;

export const RaceEntryResultSchema = z.object({
  driverId: z.string(),
  teamId: z.string(),
  position: z.number().int().min(1),
  grid: z.number().int().min(1),
  status: RaceStatusSchema,
  dnfReason: DnfReasonSchema.optional(),
  lapsCompleted: z.number().int().min(0),
  totalTime: z.number().min(0),
  bestLap: z.number().positive().nullable(),
  overtakes: z.number().int().min(0),
  errors: z.number().int().min(0),
  points: z.number().int().min(0),
  pitStops: z.number().int().min(0),
  /** Segundos de punição somados ao tempo final. */
  penaltySeconds: z.number().min(0),
  /** Pontos de punição na licença recebidos nesta corrida. */
  penaltyPoints: z.number().int().min(0),
  /** Dano acumulado no equipamento (0 = intacto). Vira custo e desgaste de confiança. */
  damage: z.number().min(0),
  /** Lesão sofrida em acidente nesta corrida. */
  injured: z.boolean(),
});
export type RaceEntryResult = z.infer<typeof RaceEntryResultSchema>;

export const RaceResultSchema = z.object({
  weather: SessionWeatherSchema,
  totalLaps: z.number().int().min(1),
  /** Ordenado pela posição final. */
  entries: z.array(RaceEntryResultSchema),
  fastestLap: z
    .object({ driverId: z.string(), time: z.number().positive(), lap: z.number().int().min(1) })
    .nullable(),
  events: z.array(RaceEventSchema),
  safetyCars: z.number().int().min(0),
  virtualSafetyCars: z.number().int().min(0),
  redFlags: z.number().int().min(0),
  /** Ordens de equipe dadas durante a corrida. */
  teamOrders: z.array(z.object({ lap: z.number().int(), teamId: z.string(), askedDriverId: z.string(), favouredDriverId: z.string(), obeyed: z.boolean() })),
});
export type RaceResult = z.infer<typeof RaceResultSchema>;

/** Registro completo de uma etapa disputada. */
export const RoundRecordSchema = z.object({
  season: z.number().int().min(1),
  round: z.number().int().min(1),
  trackId: z.string(),
  date: z.string(),
  practice: PracticeResultSchema,
  qualifying: QualifyingResultSchema,
  race: RaceResultSchema,
});
export type RoundRecord = z.infer<typeof RoundRecordSchema>;

/* ------------------------------------------------------------------ */
/* Fim de semana em andamento                                          */
/* ------------------------------------------------------------------ */

export const WeekendPhaseSchema = z.enum(['practice', 'qualifying', 'race']);
export type WeekendPhase = z.infer<typeof WeekendPhaseSchema>;

export const WeekendStateSchema = z.object({
  round: z.number().int().min(1),
  phase: WeekendPhaseSchema,
  practice: PracticeResultSchema.nullable(),
  qualifying: QualifyingResultSchema.nullable(),
  /** Quem disputa esta etapa (titulares disponíveis e reservas que os substituem). */
  entrants: z.array(z.object({ driverId: z.string(), teamId: z.string() })),
  /** Falso quando o jogador está lesionado ou suspenso; a etapa é simulada sem ele. */
  playerParticipates: z.boolean(),
});
export type WeekendState = z.infer<typeof WeekendStateSchema>;

/* ------------------------------------------------------------------ */
/* Carreira                                                            */
/* ------------------------------------------------------------------ */

export const InboxMessageSchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.enum(['team', 'race', 'training', 'season', 'finance', 'contract', 'health', 'media']),
  title: z.string(),
  body: z.string(),
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

/* ---------------- Contratos ---------------- */

export const ContractBonusesSchema = z.object({
  win: z.number().min(0),
  podium: z.number().min(0),
  /** Por ponto conquistado no campeonato. */
  point: z.number().min(0),
  title: z.number().min(0),
});

export const ContractClausesSchema = z.object({
  /** Multa que o piloto paga para sair antes do fim do contrato. */
  releaseFee: z.number().min(0),
  /** A equipe pode rescindir se o piloto terminar abaixo desta posição (null = sem cláusula). */
  performanceTarget: z.number().int().min(1).nullable(),
});

export const ContractSchema = z.object({
  teamId: z.string(),
  categoryId: CategoryIdSchema,
  role: z.enum(['first', 'second']),
  startSeason: z.number().int().min(1),
  /** Última temporada coberta (inclusive). */
  endSeason: z.number().int().min(1),
  /** Salário por temporada. */
  salary: z.number().min(0),
  /** Valor que o piloto leva à equipe por temporada (comum nas categorias de base). */
  seatCost: z.number().min(0),
  bonuses: ContractBonusesSchema,
  clauses: ContractClausesSchema,
});
export type Contract = z.infer<typeof ContractSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  categoryId: CategoryIdSchema,
  /** continue = cumprir o contrato vigente. */
  kind: z.enum(['continue', 'renewal', 'transfer', 'promotion', 'demotion', 'fallback']),
  role: z.enum(['first', 'second']),
  years: z.number().int().min(1).max(4),
  salary: z.number().min(0),
  seatCost: z.number().min(0),
  bonuses: ContractBonusesSchema,
  clauses: ContractClausesSchema,
  /** Interesse da equipe no piloto: define a margem de negociação. */
  interest: RatingSchema,
  /** Concessões já feitas pela equipe nesta negociação (em pontos de interesse). */
  conceded: z.number().min(0),
  /** Rodadas de negociação que a equipe ainda tolera. */
  patience: z.number().int().min(0),
  status: z.enum(['open', 'withdrawn']),
  /** A equipe aceita dar o status de primeiro piloto, se pedido. */
  firstDriverPossible: z.boolean(),
  /** Bolsa de promoção já descontada do custo da vaga (0 a 1), dada aos três primeiros do campeonato. */
  scholarship: z.number().min(0).max(1),
});
export type Offer = z.infer<typeof OfferSchema>;

/* ---------------- Economia ---------------- */

export const LEDGER_KEYS = [
  'salary', 'sponsors', 'bonus', 'academy', 'investment',
  'seat', 'living', 'training', 'damage', 'tax', 'interest', 'release', 'event',
] as const;
export const LedgerKeySchema = z.enum(LEDGER_KEYS);
export type LedgerKey = z.infer<typeof LedgerKeySchema>;

export const TransactionSchema = z.object({
  season: z.number().int(),
  round: z.number().int(),
  key: LedgerKeySchema,
  /** Positivo = receita; negativo = despesa. */
  amount: z.number(),
  label: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const SeasonFinanceReportSchema = z.object({
  season: z.number().int(),
  year: z.number().int(),
  totals: z.record(z.string(), z.number()),
  taxableIncome: z.number(),
  tax: z.number(),
  investmentReturn: z.number(),
  loanInterest: z.number(),
  netWorthEnd: z.number(),
});
export type SeasonFinanceReport = z.infer<typeof SeasonFinanceReportSchema>;

export const FinanceSchema = z.object({
  /** Dinheiro em caixa. Negativo = dívida, com juros no fim da temporada. */
  cash: z.number(),
  /** Aplicação conservadora: rende pouco, sem risco. */
  fixedIncome: z.number().min(0),
  /** Fundo de ações: rende mais na média, mas pode perder. */
  equityFund: z.number().min(0),
  /** Totais da temporada atual, por tipo de lançamento. */
  seasonTotals: z.record(z.string(), z.number()),
  /** Últimos lançamentos, do mais recente para o mais antigo. */
  transactions: z.array(TransactionSchema),
  reports: z.array(SeasonFinanceReportSchema),
});
export type Finance = z.infer<typeof FinanceSchema>;

export const SponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 0 = apoio da família; 1 a 3 = patrocinador pequeno, médio ou grande. */
  tier: z.number().int().min(0).max(3),
  perSeason: z.number().min(0),
  podiumBonus: z.number().min(0),
  endSeason: z.number().int().min(1),
  satisfaction: RatingSchema,
  /** Posição no campeonato que o patrocinador espera. */
  targetPosition: z.number().int().min(1),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const AcademySchema = z.object({
  f1TeamId: z.string(),
  name: z.string(),
  joinedSeason: z.number().int().min(1),
  /** Fração do custo da vaga que a academia paga. */
  supportShare: z.number().min(0).max(1),
  /** Posição final que a academia exige nas categorias de base. */
  targetPosition: z.number().int().min(1),
  /** Temporadas abaixo da exigência; com 2, o piloto é dispensado. */
  strikes: z.number().int().min(0),
});
export type Academy = z.infer<typeof AcademySchema>;

/* ---------------- Licença ---------------- */

export const LicenseSchema = z.object({
  /** Pontos de licença ganhos pela posição final em cada temporada. */
  history: z.array(z.object({ season: z.number().int(), categoryId: CategoryIdSchema, position: z.number().int().min(1), points: z.number().min(0) })),
  /** Pontos de punição na temporada. Ao atingir o limite, o piloto é suspenso por uma etapa. */
  penaltyPoints: z.number().int().min(0),
  /** Etapas de suspensão a cumprir. */
  banRounds: z.number().int().min(0),
});
export type License = z.infer<typeof LicenseSchema>;

/* ---------------- Relações ---------------- */

export const RelationsSchema = z.object({
  /** Confiança da equipe no jogador. */
  teamTrust: RatingSchema,
  /** Relação com o companheiro de equipe. */
  teammate: RatingSchema,
  /** Intensidade da rivalidade com outros pilotos (id → 0 a 100). */
  rivalries: z.record(z.string(), z.number().min(0).max(100)),
});
export type Relations = z.infer<typeof RelationsSchema>;

/* ---------------- Eventos ---------------- */

export const EffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stat'), stat: z.enum(['morale', 'confidence', 'form', 'reputation', 'teamTrust', 'teammateRelation']), value: z.number() }),
  z.object({ type: z.literal('cash'), value: z.number(), ledger: LedgerKeySchema, label: z.string() }),
  z.object({ type: z.literal('rivalry'), driverId: z.string(), value: z.number() }),
  z.object({ type: z.literal('sponsorSatisfaction'), sponsorId: z.string().nullable(), value: z.number() }),
  z.object({ type: z.literal('addSponsor'), sponsor: SponsorSchema }),
  z.object({ type: z.literal('removeSponsor'), sponsorId: z.string() }),
  z.object({ type: z.literal('penaltyPoints'), value: z.number().int() }),
  z.object({ type: z.literal('gridPenalty'), driverId: z.string(), places: z.number().int() }),
  z.object({ type: z.literal('pointsAdjustment'), driverId: z.string(), points: z.number().int(), reason: z.string() }),
  z.object({ type: z.literal('interest'), teamKey: z.string(), value: z.number() }),
  z.object({ type: z.literal('joinAcademy'), academy: AcademySchema }),
  z.object({ type: z.literal('leaveAcademy') }),
  z.object({ type: z.literal('attribute'), key: AttributeKeySchema, value: z.number() }),
  z.object({ type: z.literal('injury'), injury: InjurySchema }),
  z.object({ type: z.literal('carUpgrade'), value: z.number() }),
  z.object({ type: z.literal('seatCost'), value: z.number() }),
  z.object({ type: z.literal('releaseFee'), factor: z.number().min(0) }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const EVENT_CATEGORIES = ['interview', 'controversy', 'rivalry', 'investigation', 'protest', 'contract', 'sponsor', 'unexpected'] as const;
export const EventCategorySchema = z.enum(EVENT_CATEGORIES);
export type EventCategory = z.infer<typeof EventCategorySchema>;

export const EventOutcomeSchema = z.object({
  /** Probabilidade deste desfecho; as probabilidades de uma escolha somam 1. */
  probability: z.number().min(0).max(1),
  text: z.string(),
  effects: z.array(EffectSchema),
});

export const EventChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  outcomes: z.array(EventOutcomeSchema).min(1),
});
export type EventChoice = z.infer<typeof EventChoiceSchema>;

export const PendingEventSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  category: EventCategorySchema,
  season: z.number().int(),
  round: z.number().int(),
  title: z.string(),
  body: z.string(),
  choices: z.array(EventChoiceSchema).min(1),
});
export type PendingEvent = z.infer<typeof PendingEventSchema>;

export const EventLogEntrySchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  category: EventCategorySchema,
  season: z.number().int(),
  round: z.number().int(),
  title: z.string(),
  choiceLabel: z.string(),
  outcome: z.string(),
});
export type EventLogEntry = z.infer<typeof EventLogEntrySchema>;

export const PointsAdjustmentSchema = z.object({
  driverId: z.string(),
  teamId: z.string().nullable(),
  points: z.number().int(),
  reason: z.string(),
  round: z.number().int(),
});
export type PointsAdjustment = z.infer<typeof PointsAdjustmentSchema>;

/* ---------------- Temporadas ---------------- */

export const StandingSnapshotSchema = z.object({
  driverId: z.string(),
  teamId: z.string().nullable(),
  position: z.number().int().min(1),
  points: z.number().int(),
  wins: z.number().int().min(0),
});

/** Resumo arquivado de uma temporada encerrada. */
export const SeasonSummarySchema = z.object({
  season: z.number().int().min(1),
  year: z.number().int(),
  categoryId: CategoryIdSchema,
  championDriverId: z.string(),
  championTeamId: z.string(),
  playerTeamId: z.string(),
  playerTeamName: z.string(),
  playerPosition: z.number().int().min(1),
  playerPoints: z.number().int(),
  objectiveTarget: z.number().int().min(1),
  objectiveMet: z.boolean(),
  driverStandings: z.array(StandingSnapshotSchema),
  /** Nomes congelados no momento do arquivamento (pilotos e equipes mudam depois). */
  driverNames: z.record(z.string(), z.string()),
  teamColors: z.record(z.string(), z.string()),
  rounds: z.array(RoundRecordSchema),
});
export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;

/** Fechamento de temporada: fica aberto até o jogador assinar para o ano seguinte. */
export const OffseasonSchema = z.object({
  playerPosition: z.number().int().min(1),
  playerPoints: z.number().int(),
  wins: z.number().int().min(0),
  podiums: z.number().int().min(0),
  target: z.number().int().min(1),
  objectiveMet: z.boolean(),
  reputationBefore: RatingSchema,
  reputationAfter: RatingSchema,
  licensePointsEarned: z.number().min(0),
  championDriverId: z.string(),
  championTeamId: z.string(),
  /** O que aconteceu com o contrato vigente no fechamento. */
  contractStatus: z.enum(['active', 'expired', 'terminated']),
  offers: z.array(OfferSchema),
  /** Notas do fechamento (academia, patrocinadores, rescisão). */
  notes: z.array(z.string()),
});
export type Offseason = z.infer<typeof OffseasonSchema>;

export const TRAINING_INTENSITIES = ['light', 'normal', 'intense'] as const;
export const TrainingIntensitySchema = z.enum(TRAINING_INTENSITIES);
export type TrainingIntensity = z.infer<typeof TrainingIntensitySchema>;

export const CAREER_SCHEMA_VERSION = 2;

export const CareerStateSchema = z.object({
  schemaVersion: z.literal(CAREER_SCHEMA_VERSION),
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Semente mestra: toda a variabilidade da carreira deriva dela. */
  seed: z.number().int().min(0).max(0xffffffff),
  season: z.number().int().min(1),
  year: z.number().int(),
  status: z.enum(['active', 'retired']),
  /** Categoria que o jogador disputa nesta temporada. */
  categoryId: CategoryIdSchema,
  playerDriverId: z.string(),
  reputation: RatingSchema,
  /** Pilotos da categoria atual: titulares, reservas e pilotos sem vaga. */
  drivers: z.array(DriverSchema),
  /** Equipes da categoria atual. */
  teams: z.array(TeamSchema),
  calendar: z.array(ChampionshipEventSchema),
  /** Índice (base 0) da próxima etapa. Igual a calendar.length quando a temporada acabou. */
  nextRoundIndex: z.number().int().min(0),
  weekend: WeekendStateSchema.nullable(),
  /** Etapas disputadas na temporada atual, em ordem. */
  rounds: z.array(RoundRecordSchema),
  /** Ajustes de pontos da temporada (decisões de comissários e protestos). */
  adjustments: z.array(PointsAdjustmentSchema),
  /** Punições de grid a cumprir na próxima corrida (piloto → posições). */
  gridPenalties: z.record(z.string(), z.number().int().min(0)),
  /** Atributos do jogador no início da temporada, para mostrar a evolução. */
  playerSeasonStartAttributes: DriverAttributesSchema,
  trainingIntensity: TrainingIntensitySchema,
  contract: ContractSchema,
  finance: FinanceSchema,
  sponsors: z.array(SponsorSchema),
  academy: AcademySchema.nullable(),
  license: LicenseSchema,
  relations: RelationsSchema,
  /** Interesse das equipes no jogador (chave "categoria:equipe" → 0 a 100). */
  marketInterest: z.record(z.string(), z.number().min(0).max(100)),
  pendingEvents: z.array(PendingEventSchema),
  eventLog: z.array(EventLogEntrySchema),
  offseason: OffseasonSchema.nullable(),
  history: z.array(SeasonSummarySchema),
  inbox: z.array(InboxMessageSchema),
});
export type CareerState = z.infer<typeof CareerStateSchema>;

/* ------------------------------------------------------------------ */
/* Dados estáticos (não vão para o save)                               */
/* ------------------------------------------------------------------ */

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  /** Estado (pistas brasileiras) ou vazio. */
  state: z.string(),
  lengthMeters: z.number().int().positive(),
  /** Tempo de referência de uma volta seca, com kart e piloto nota 100. */
  baseLapTime: z.number().positive(),
  /** Voltas da corrida nas categorias de kart; nos monopostos, vem da duração da prova. */
  laps: z.number().int().positive(),
  country: z.string().length(2),
  /** 0 = ultrapassar é fácil, 1 = praticamente impossível. */
  overtakingDifficulty: z.number().min(0).max(1),
  /** Multiplicador de desgaste de pneus (1 = médio). */
  tyreWear: z.number().min(0.5).max(1.5),
  /** Peso do motor versus chassi (0 = só chassi, 1 = só motor). */
  powerSensitivity: z.number().min(0).max(1),
  /** Probabilidade climatológica de chuva na data da etapa. */
  rainChance: z.number().min(0).max(1),
  /** Temperatura média do asfalto na data da etapa, em °C. */
  baseTrackTemp: z.number(),
  description: z.string(),
});
export type Track = z.infer<typeof TrackSchema>;
