/**
 * Modelo de dados do jogo.
 *
 * Os schemas Zod são a fonte única da verdade: os tipos TypeScript usados em
 * todo o projeto são inferidos daqui, e os mesmos schemas validam qualquer
 * save carregado do disco. Assim, tipo estático e validação em tempo de
 * execução nunca divergem.
 */
import { z } from 'zod';
import { SPONSOR_PERSONALITIES, STORY_CATEGORIES } from './storyEvents';

/* ------------------------------------------------------------------ */
/* Primitivos                                                          */
/* ------------------------------------------------------------------ */

/** Atributo de 0 a 100. Guardado com casas decimais para permitir evolução gradual. */
export const RatingSchema = z.number().min(0).max(100);

export const ATTRIBUTE_KEYS = ['pace', 'consistency', 'overtaking', 'defending', 'focus', 'racecraft', 'tyreManagement', 'wetSkill', 'experience'] as const;
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
  age: z.number().int().min(10).max(110),
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
  /** Equipe do Grand Prix Mundial a cuja academia esta equipe é ligada (null se independente). */
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
    'start',
    'overtake',
    'error',
    'spin',
    'dnf',
    'collision',
    'fastestLap',
    'finish',
    'pit',
    'safetyCar',
    'vsc',
    'redFlag',
    'restart',
    'penalty',
    'weather',
    'teamOrder',
    'damage',
    'fuel',
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

/* ---------------- Lances decisivos (Fase 4 da grande atualização) ---------------- */

export const MOMENT_KINDS = ['start', 'attack', 'defense', 'rain', 'lastLap', 'pit'] as const;
export const MomentKindSchema = z.enum(MOMENT_KINDS);
export type MomentKind = z.infer<typeof MomentKindSchema>;

/** Como o lance terminou: deu certo, só perdeu tempo, rodou, tocou no rival ou abandonou. */
export const MOMENT_OUTCOMES = ['won', 'lost', 'spin', 'touch', 'retired'] as const;
export const MomentOutcomeSchema = z.enum(MOMENT_OUTCOMES);
export type MomentOutcome = z.infer<typeof MomentOutcomeSchema>;

/** Um lance decisivo já resolvido, como fica no resultado da corrida. */
export const MomentRecordSchema = z.object({
  /** Volta em que o lance aconteceu. */
  lap: z.number().int().min(1),
  kind: MomentKindSchema,
  /** Opção escolhida (os ids estão em RACE_MOMENTS.OPTIONS, em src/config/balance.ts). */
  option: z.string(),
  /** Chance de dar certo que a opção mostrava, de 0 a 1. */
  chance: z.number().min(0).max(1),
  success: z.boolean(),
  /** Decidido pelo estilo do piloto (simular direto), e não pelo jogador. */
  auto: z.boolean(),
  /** Rival do lance, quando havia um. */
  rivalId: z.string().optional(),
  outcome: MomentOutcomeSchema,
  /** Houve toque com o rival (é o que cria rivalidade). */
  contact: z.boolean(),
  /** Segundos de punição recebidos por causa do lance. */
  penaltySeconds: z.number().min(0),
  /** Texto pronto para exibição (gerado pela simulação, não pela UI). */
  message: z.string(),
});
export type MomentRecord = z.infer<typeof MomentRecordSchema>;

export const RaceResultSchema = z.object({
  weather: SessionWeatherSchema,
  totalLaps: z.number().int().min(1),
  /** Ordenado pela posição final. */
  entries: z.array(RaceEntryResultSchema),
  fastestLap: z.object({ driverId: z.string(), time: z.number().positive(), lap: z.number().int().min(1) }).nullable(),
  events: z.array(RaceEventSchema),
  safetyCars: z.number().int().min(0),
  virtualSafetyCars: z.number().int().min(0),
  redFlags: z.number().int().min(0),
  /** Ordens de equipe dadas durante a corrida. */
  teamOrders: z.array(z.object({ lap: z.number().int(), teamId: z.string(), askedDriverId: z.string(), favouredDriverId: z.string(), obeyed: z.boolean() })),
  /** Lances decisivos do jogador nesta corrida, na ordem (vazio se ele não correu). */
  moments: z.array(MomentRecordSchema),
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
  category: z.enum(['team', 'race', 'training', 'season', 'finance', 'contract', 'health', 'media', 'family', 'business']),
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
  'salary',
  'sponsors',
  'bonus',
  'academy',
  'investment',
  'seat',
  'living',
  'training',
  'damage',
  'tax',
  'interest',
  'release',
  'event',
  // Fase 3: patrimônio, família e negócios.
  'dividends',
  'rent',
  'business',
  'loan',
  'assets',
  'family',
  'team',
  'inheritance',
  // Fase 3 da grande atualização: polos, custos de correr e portas.
  'travel',
  'housing',
  'equipment',
  'moving',
  'job',
  'investor',
  'crowdfund',
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

/* ---------------- Patrimônio (Fase 3) ---------------- */

/** Posição em uma ação: quantidade e preço médio de compra (base do imposto sobre o ganho). */
export const StockHoldingSchema = z.object({
  stockId: z.string(),
  shares: z.number().min(0),
  avgCost: z.number().min(0),
});
export type StockHolding = z.infer<typeof StockHoldingSchema>;

export const PropertySchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  name: z.string(),
  /** Preço pago, base do imposto sobre o ganho de capital na venda. */
  cost: z.number().min(0),
  value: z.number().min(0),
  purchasedSeason: z.number().int(),
  /** Alugado rende aluguel; de uso próprio dá o benefício descrito no catálogo. */
  use: z.enum(['rented', 'personal']),
});
export type Property = z.infer<typeof PropertySchema>;

export const BusinessSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  name: z.string(),
  invested: z.number().min(0),
  value: z.number().min(0),
  level: z.number().int().min(1).max(3),
  foundedSeason: z.number().int(),
  /** Lucro (ou prejuízo) da última temporada fechada. */
  lastProfit: z.number(),
});
export type Business = z.infer<typeof BusinessSchema>;

/** Participação minoritária (ou herdada) em uma equipe. */
export const TeamStakeSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  categoryId: CategoryIdSchema,
  share: z.number().min(0).max(1),
  cost: z.number().min(0),
  value: z.number().min(0),
  /** Última posição conhecida da equipe no campeonato. */
  lastPosition: z.number().int().min(1),
  lastDividend: z.number(),
});
export type TeamStake = z.infer<typeof TeamStakeSchema>;

export const LoanSchema = z.object({
  id: z.string(),
  label: z.string(),
  principal: z.number().min(0),
  /** Saldo devedor no início da temporada atual. */
  balance: z.number().min(0),
  rate: z.number().min(0),
  /** Parcela anual (dividida pelas etapas da temporada). */
  annualPayment: z.number().min(0),
  seasonsRemaining: z.number().int().min(1),
  paidThisSeason: z.number().min(0),
});
export type Loan = z.infer<typeof LoanSchema>;

export const LIFESTYLES = ['frugal', 'comfortable', 'luxury'] as const;
export const LifestyleSchema = z.enum(LIFESTYLES);
export type Lifestyle = z.infer<typeof LifestyleSchema>;

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
  /** Ações em carteira e cotações atuais (id da ação → preço). */
  stocks: z.array(StockHoldingSchema),
  stockPrices: z.record(z.string(), z.number().positive()),
  properties: z.array(PropertySchema),
  businesses: z.array(BusinessSchema),
  stakes: z.array(TeamStakeSchema),
  loans: z.array(LoanSchema),
  /** Padrão de vida: multiplica o custo de vida e mexe com a moral e a família. */
  lifestyle: LifestyleSchema,
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
  /** Perfil de `SPONSOR_PROFILES` de que ele saiu (Fase 5); ausente nos patrocinadores mais antigos. */
  profileId: z.string().optional(),
  /** Personalidade (Fase 5): muda o quanto ele tolera resultado ruim. Ausente: tolerância normal. */
  personality: z.enum(SPONSOR_PERSONALITIES).optional(),
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

/* ---------------- Polos e portas (Fase 3 da grande atualização) ---------------- */

/** Polo: a cidade em que o piloto mora para disputar um campeonato. Os dados ficam em `src/data/hubs.ts`. */
export const HubIdSchema = z.enum(['sao-paulo', 'italia', 'inglaterra']);
export type HubId = z.infer<typeof HubIdSchema>;

export const HubStateSchema = z.object({
  id: HubIdSchema,
  /** Temporada em que o piloto chegou ao polo (0 = já morava nele antes de o jogo acompanhar os polos). */
  arrivedSeason: z.number().int().min(0),
});
export type HubState = z.infer<typeof HubStateSchema>;

/** Investidor: pagou uma ou mais vagas e leva uma fatia dos ganhos do piloto para sempre. */
export const InvestorSchema = z.object({
  name: z.string(),
  /** Fatia dos ganhos (salário, bônus e patrocínios), de 0 a 1. */
  share: z.number().min(0).max(1),
  sinceSeason: z.number().int().min(1),
  /** Quanto o investidor já pôs na carreira e quanto já recebeu de volta. */
  invested: z.number().min(0),
  received: z.number().min(0),
  /** Vagas que ele pagou. */
  seats: z.number().int().min(0),
  /** A vaga que o último aporte pagou: o dinheiro só vale para aquela proposta. */
  funded: z.object({ season: z.number().int().min(1), offerId: z.string() }).nullable(),
});
export type Investor = z.infer<typeof InvestorSchema>;

/** Vaquinha da cidade: o dinheiro entra uma vez e a torcida cobra o resultado da temporada seguinte. */
export const CrowdfundSchema = z.object({
  /** Temporada em que a vaquinha foi feita (a cobrança vale para a seguinte). */
  season: z.number().int().min(1),
  town: z.string(),
  amount: z.number().min(0),
  /** Posição final que a torcida espera na temporada seguinte. */
  targetPosition: z.number().int().min(1),
  /** A cobrança já foi feita (cumprida ou não): fica só o registro, para o intervalo até a próxima. */
  settled: z.boolean(),
});
export type Crowdfund = z.infer<typeof CrowdfundSchema>;

export const SideJobSchema = z.enum(['none', 'instructor', 'mechanic']);
export type SideJob = z.infer<typeof SideJobSchema>;

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

/**
 * Um toque num lance decisivo, guardado para a Fase 5 usar: com quem foi, quando, em que lance e
 * se criou uma rivalidade nova. A intensidade que o motor lê continua em `rivalries`.
 */
export const RivalryRecordSchema = z.object({
  driverId: z.string(),
  season: z.number().int().min(1),
  round: z.number().int().min(1),
  lap: z.number().int().min(1),
  /** O lance em que o toque aconteceu. */
  kind: MomentKindSchema,
  /** Alguém abandonou por causa do toque. */
  retired: z.boolean(),
  /** O piloto não era rival antes desta etapa: a rivalidade nasceu aqui. */
  fresh: z.boolean(),
});
export type RivalryRecord = z.infer<typeof RivalryRecordSchema>;

export const RelationsSchema = z.object({
  /** Confiança da equipe no jogador. */
  teamTrust: RatingSchema,
  /** Relação com o companheiro de equipe. */
  teammate: RatingSchema,
  /** Intensidade da rivalidade com outros pilotos (id → 0 a 100). */
  rivalries: z.record(z.string(), z.number().min(0).max(100)),
  /** Toques em lances decisivos que criaram ou reacenderam rivalidades (os mais recentes por último). */
  rivalryLog: z.array(RivalryRecordSchema),
});
export type Relations = z.infer<typeof RelationsSchema>;

/* ---------------- Família e dinastia (Fase 3) ---------------- */

export const CHILD_TRAITS = ['determined', 'gifted', 'calm', 'aggressive', 'charismatic', 'rebel', 'studious', 'intuitive'] as const;
export const ChildTraitSchema = z.enum(CHILD_TRAITS);
export type ChildTrait = z.infer<typeof ChildTraitSchema>;

export const SUPPORT_LEVELS = ['none', 'basic', 'full'] as const;
export const SupportLevelSchema = z.enum(SUPPORT_LEVELS);
export type SupportLevel = z.infer<typeof SupportLevelSchema>;

export const PARTNER_BACKGROUNDS = ['motorsport', 'business', 'arts', 'health', 'media'] as const;

export const PartnerSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().int().min(16),
  background: z.enum(PARTNER_BACKGROUNDS),
  /** Aptidão esportiva que passa aos filhos (os filhos herdam dos dois lados). */
  talent: RatingSchema,
  relationship: RatingSchema,
  married: z.boolean(),
  sinceSeason: z.number().int(),
});
export type Partner = z.infer<typeof PartnerSchema>;

export const LicenseHistoryEntrySchema = z.object({
  season: z.number().int(),
  categoryId: CategoryIdSchema,
  position: z.number().int().min(1),
  points: z.number().min(0),
});

export const ChildSeasonSchema = z.object({
  season: z.number().int(),
  year: z.number().int(),
  categoryId: CategoryIdSchema,
  teamName: z.string(),
  position: z.number().int().min(1),
  wins: z.number().int().min(0),
  /** Verdadeiro quando o resultado veio do campeonato simulado (na equipe do jogador), não da estimativa. */
  inWorld: z.boolean(),
});
export type ChildSeason = z.infer<typeof ChildSeasonSchema>;

/** Carreira própria de um filho, que corre fora do campeonato do jogador. */
export const ChildRacingSchema = z.object({
  categoryId: CategoryIdSchema,
  teamName: z.string(),
  /** Força da equipe em que corre: 0 = a melhor, 9 = a pior. */
  teamRank: z.number().int().min(0).max(9),
  reputation: RatingSchema,
  license: z.array(LicenseHistoryEntrySchema),
  /** Academia de uma equipe do Grand Prix Mundial que o apoia (null = nenhuma). */
  academy: z.string().nullable(),
  seasons: z.array(ChildSeasonSchema),
  /** Temporadas seguidas sem conseguir bancar a vaga; com 2, a carreira acaba. */
  stalled: z.number().int().min(0),
  /** Custo anual da carreira que cabe à família nesta temporada. */
  familyCost: z.number().min(0),
});
export type ChildRacing = z.infer<typeof ChildRacingSchema>;

export const ChildSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  nationality: z.string().length(2),
  age: z.number().int().min(0),
  traits: z.array(ChildTraitSchema).min(1).max(2),
  /** Teto de desenvolvimento herdado dos pais (com variação). */
  talent: RatingSchema,
  /** Vontade de seguir no automobilismo. */
  interest: RatingSchema,
  /** Relação com o personagem do jogador. */
  bond: RatingSchema,
  /** child: pequeno; karting: formação no kart; racing: carreira própria; other: seguiu outro caminho. */
  stage: z.enum(['child', 'karting', 'racing', 'other']),
  kartFunding: SupportLevelSchema,
  /** Anos de formação no kart, ponderados pelo investimento. */
  kartYears: z.number().min(0),
  support: SupportLevelSchema,
  driver: DriverSchema.nullable(),
  racing: ChildRacingSchema.nullable(),
});
export type Child = z.infer<typeof ChildSchema>;

export const FamilySchema = z.object({
  partner: PartnerSchema.nullable(),
  children: z.array(ChildSchema),
  divorces: z.number().int().min(0),
});
export type Family = z.infer<typeof FamilySchema>;

export const LineageEntrySchema = z.object({
  generation: z.number().int().min(1),
  driverId: z.string(),
  name: z.string(),
  bornYear: z.number().int(),
  fromSeason: z.number().int().min(1),
  toSeason: z.number().int().nullable(),
  endReason: z.enum(['death', 'accident', 'handover']).nullable(),
  bestCategoryId: CategoryIdSchema.nullable(),
  titles: z.number().int().min(0),
  wins: z.number().int().min(0),
  peakReputation: RatingSchema,
  /** Patrimônio líquido transmitido ao sucessor. */
  netWorthPassed: z.number().nullable(),
});
export type LineageEntry = z.infer<typeof LineageEntrySchema>;

export const DynastySchema = z.object({
  generation: z.number().int().min(1),
  surname: z.string(),
  lineage: z.array(LineageEntrySchema).min(1),
});
export type Dynasty = z.infer<typeof DynastySchema>;

export const HeirOptionSchema = z.object({
  id: z.string(),
  kind: z.enum(['child', 'partner', 'relative']),
  name: z.string(),
  age: z.number().int(),
  description: z.string(),
  /** Pode assumir como piloto (tem carreira em andamento). */
  canDrive: z.boolean(),
  /** Pode assumir os negócios (é maior de idade). */
  canManage: z.boolean(),
  childId: z.string().nullable(),
  driver: DriverSchema.nullable(),
  racing: ChildRacingSchema.nullable(),
});
export type HeirOption = z.infer<typeof HeirOptionSchema>;

/** Sucessão em aberto: o jogo espera a escolha do herdeiro. */
export const SuccessionSchema = z.object({
  cause: z.enum(['death', 'accident', 'handover']),
  year: z.number().int(),
  formerName: z.string(),
  /** Patrimônio líquido no momento da sucessão e imposto que incide sobre ele. */
  estate: z.number(),
  tax: z.number().min(0),
  heirs: z.array(HeirOptionSchema).min(1),
});
export type Succession = z.infer<typeof SuccessionSchema>;

/* ---------------- Gestão de equipe (Fase 3) ---------------- */

export const STAFF_ROLES = ['principal', 'technicalDirector', 'sportingDirector', 'chiefEngineer', 'chiefMechanic'] as const;
export const StaffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const StaffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: StaffRoleSchema,
  rating: RatingSchema,
  /** Salário por temporada. */
  salary: z.number().min(0),
  contractEnd: z.number().int(),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const DEV_AREAS = ['aero', 'chassis', 'engine', 'suspension', 'manufacturing'] as const;
export const DevAreaSchema = z.enum(DEV_AREAS);
export type DevArea = z.infer<typeof DevAreaSchema>;

export const DevValuesSchema = z.object({
  aero: z.number().min(0),
  chassis: z.number().min(0),
  engine: z.number().min(0),
  suspension: z.number().min(0),
  manufacturing: z.number().min(0),
});
export type DevValues = z.infer<typeof DevValuesSchema>;

export const FACILITY_KEYS = ['simulator', 'windTunnel', 'factory'] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];
const FacilityLevelSchema = z.number().int().min(0).max(5);

export const RESEARCH_SPENDS = ['low', 'medium', 'high'] as const;
export const ResearchSpendSchema = z.enum(RESEARCH_SPENDS);
export type ResearchSpend = z.infer<typeof ResearchSpendSchema>;

export const TeamSponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  perSeason: z.number().min(0),
  endSeason: z.number().int(),
  /** Posição no campeonato de equipes que o patrocinador exige. */
  targetPosition: z.number().int().min(1),
});
export type TeamSponsor = z.infer<typeof TeamSponsorSchema>;

export const DriverDealSchema = z.object({
  /** Salário que a equipe paga ao piloto por temporada. */
  salary: z.number().min(0),
  /** Valor que o piloto (ou seus patrocinadores) leva à equipe por temporada. */
  seatFee: z.number().min(0),
  endSeason: z.number().int(),
});
export type DriverDeal = z.infer<typeof DriverDealSchema>;

export const ManagedTeamSchema = z.object({
  teamId: z.string(),
  categoryId: CategoryIdSchema,
  /** principal = chefe de equipe contratado; owner = dono (que também comanda). */
  position: z.enum(['principal', 'owner']),
  sinceSeason: z.number().int(),
  /** Caixa da equipe (separado do dinheiro pessoal). */
  budget: z.number(),
  reputation: RatingSchema,
  /** Salário do jogador como chefe contratado (0 para o dono). */
  salary: z.number().min(0),
  /** Prêmio anual, definido pela posição no campeonato anterior e pago em parcelas por etapa. */
  prize: z.number().min(0),
  purchasePrice: z.number().min(0),
  /** Posição no campeonato de equipes que a diretoria (ou o mercado) espera. */
  boardTarget: z.number().int().min(1),
  /** Temporadas seguidas abaixo da meta; com 2, o chefe contratado é demitido. */
  strikes: z.number().int().min(0),
  staff: z.array(StaffMemberSchema),
  /** Profissionais disponíveis para contratação nesta temporada. */
  staffMarket: z.array(StaffMemberSchema),
  /** Tamanho dos departamentos (1 a 5). */
  engineers: z.number().int().min(1).max(5),
  mechanics: z.number().int().min(1).max(5),
  facilities: z.object({ simulator: FacilityLevelSchema, windTunnel: FacilityLevelSchema, factory: FacilityLevelSchema }),
  /** Carro no início da temporada, sem as melhorias do ano. */
  baseCar: CarPerformanceSchema,
  development: z.object({
    /** Distribuição do esforço de pesquisa entre as áreas (soma 1). */
    allocation: DevValuesSchema,
    spend: ResearchSpendSchema,
    /** Pontos de pesquisa acumulados para a próxima melhoria de cada área. */
    progress: DevValuesSchema,
    /** Melhorias entregues nesta temporada, por área. */
    gains: DevValuesSchema,
    /** Gasto com desenvolvimento na temporada (conta para o teto de gastos). */
    spent: z.number().min(0),
  }),
  /** Evolução das equipes rivais nesta temporada (id → pontos de carro). */
  fieldGains: z.record(z.string(), z.number()),
  sponsors: z.array(TeamSponsorSchema),
  deals: z.record(z.string(), DriverDealSchema),
  /** Totais da temporada por tipo de lançamento do caixa da equipe. */
  ledger: z.record(z.string(), z.number()),
  /** Posição da equipe no campeonato anterior (null na primeira temporada do jogador nela). */
  previousPosition: z.number().int().min(1).nullable(),
});
export type ManagedTeam = z.infer<typeof ManagedTeamSchema>;

/** Uma temporada do jogador no comando de uma equipe. */
export const ExecutiveLogEntrySchema = z.object({
  season: z.number().int(),
  categoryId: CategoryIdSchema,
  teamName: z.string(),
  position: z.number().int().min(1),
  target: z.number().int().min(1),
  profit: z.number(),
});
export type ExecutiveLogEntry = z.infer<typeof ExecutiveLogEntrySchema>;

/* ---------------- Eventos ---------------- */

export const EffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stat'), stat: z.enum(['morale', 'confidence', 'form', 'reputation', 'teamTrust', 'teammateRelation']), value: z.number() }),
  z.object({
    type: z.literal('cash'),
    value: z.number(),
    ledger: LedgerKeySchema,
    label: z.string(),
    /** Pagamento que nunca leva o saldo ao negativo: sai no máximo o que há em caixa na hora (Fase 3 da grande atualização). */
    capToCash: z.boolean().optional(),
  }),
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
  // Fase 3: família.
  z.object({ type: z.literal('partner'), partner: PartnerSchema }),
  z.object({ type: z.literal('relationship'), value: z.number() }),
  z.object({ type: z.literal('marry') }),
  z.object({ type: z.literal('child'), child: ChildSchema }),
  z.object({ type: z.literal('divorce'), share: z.number().min(0).max(1) }),
  z.object({ type: z.literal('childStat'), childId: z.string(), stat: z.enum(['interest', 'bond']), value: z.number() }),
  z.object({ type: z.literal('childKart'), childId: z.string(), funding: SupportLevelSchema }),
  z.object({ type: z.literal('childCareer'), childId: z.string(), support: SupportLevelSchema }),
  // Fase 3: gestão de equipe.
  z.object({ type: z.literal('teamBudget'), value: z.number(), label: z.string() }),
  z.object({ type: z.literal('teamReputation'), value: z.number() }),
  z.object({ type: z.literal('devProgress'), area: DevAreaSchema.nullable(), value: z.number() }),
  z.object({ type: z.literal('staffRating'), role: StaffRoleSchema, value: z.number() }),
  z.object({ type: z.literal('lineupCondition'), stat: z.enum(['morale', 'confidence']), value: z.number() }),
  // Fase 2 da grande atualização: nascimento. Quem nasceu no interior se muda para a capital.
  z.object({ type: z.literal('relocate') }),
  // Fase 5: memória das histórias (marcas, pessoas e cadeias), em `career.story`.
  z.object({ type: z.literal('storyFlag'), flag: z.string().min(1), set: z.boolean() }),
  z.object({ type: z.literal('storyPerson'), person: z.lazy(() => StoryPersonSchema) }),
  z.object({ type: z.literal('storyAttitude'), key: z.string().min(1), value: z.number() }),
  z.object({ type: z.literal('storyJoinTeam'), key: z.string().min(1), org: z.string(), teamKey: z.string().nullable() }),
  z.object({ type: z.literal('storyFollow'), key: z.string().min(1), follow: z.boolean() }),
  z.object({
    type: z.literal('storyChain'),
    chainId: z.string().min(1),
    step: z.string().min(1),
    choice: z.string().min(1),
    /** Passo seguinte (null: a cadeia acaba aqui) e quando ele pode sair. */
    next: z.string().nullable(),
    notBefore: z.object({ season: z.number().int().min(1), round: z.number().int().min(0) }),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const EVENT_CATEGORIES = [
  'interview',
  'controversy',
  'rivalry',
  'investigation',
  'protest',
  'contract',
  'sponsor',
  'unexpected',
  'family',
  'management',
  // Fase 5: as cinco categorias dos cartões encadeados.
  ...STORY_CATEGORIES,
] as const;
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
  /** Explicação da escolha. Os cartões da Fase 5 deixam vazio: o efeito só aparece depois. */
  description: z.string(),
  outcomes: z.array(EventOutcomeSchema).min(1),
  /** Fase 5: a escolha existe por causa de um traço de nascença ou de uma aptidão (a tela mostra qual). */
  unlock: z.object({ kind: z.enum(['trait', 'aptitude']), id: z.string(), level: z.enum(['high', 'low']).optional() }).optional(),
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
  /** Fase 5: chave da variante de texto (evento#variante), que não volta mais para este personagem. */
  storyKey: z.string().optional(),
  /** Fase 5: a cadeia a que o cartão pertence (id e nome). */
  chain: z.object({ id: z.string(), title: z.string() }).optional(),
  /** Fase 5: quem fala no cartão (nome e papel). */
  speaker: z.object({ name: z.string(), role: z.string() }).optional(),
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
  /** driver: temporada como piloto; executive: como dirigente (a posição é a da equipe, se houver). */
  mode: z.enum(['driver', 'executive']),
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

/* ---------------- Fechamento como dirigente (Fase 3) ---------------- */

export const JobOfferSchema = z.object({
  id: z.string(),
  categoryId: CategoryIdSchema,
  teamId: z.string(),
  teamName: z.string(),
  rank: z.number().int().min(0),
  salary: z.number().min(0),
  target: z.number().int().min(1),
});
export type JobOffer = z.infer<typeof JobOfferSchema>;

export const TeamListingSchema = z.object({
  id: z.string(),
  categoryId: CategoryIdSchema,
  teamId: z.string(),
  teamName: z.string(),
  rank: z.number().int().min(0),
  price: z.number().min(0),
});
export type TeamListing = z.infer<typeof TeamListingSchema>;

export const DriverCandidateSchema = z.object({
  driverId: z.string(),
  name: z.string(),
  age: z.number().int(),
  rating: z.number(),
  origin: z.enum(['current', 'market', 'rookie', 'child']),
  salary: z.number().min(0),
  seatFee: z.number().min(0),
  years: z.number().int().min(1),
  /** Falso quando o piloto não aceita correr por esta equipe. */
  willing: z.boolean(),
  /** Dados do piloto, quando ele ainda não está no campeonato (estreantes e filhos). */
  driver: DriverSchema.nullable(),
  childId: z.string().nullable(),
});
export type DriverCandidate = z.infer<typeof DriverCandidateSchema>;

export const ExecutiveOffseasonSchema = z.object({
  /** Resumo da temporada encerrada, arquivado quando a próxima começar. */
  summary: SeasonSummarySchema,
  teamPosition: z.number().int().min(1).nullable(),
  target: z.number().int().min(1).nullable(),
  objectiveMet: z.boolean().nullable(),
  prize: z.number(),
  profit: z.number(),
  /** O chefe contratado foi demitido neste fechamento. */
  dismissed: z.boolean(),
  notes: z.array(z.string()),
  jobOffers: z.array(JobOfferSchema),
  listings: z.array(TeamListingSchema),
  candidates: z.array(DriverCandidateSchema),
  /** Pilotos escolhidos para a próxima temporada: [primeiro, segundo]. */
  lineup: z.array(z.string()).max(2),
  sponsorOffers: z.array(TeamSponsorSchema),
});
export type ExecutiveOffseason = z.infer<typeof ExecutiveOffseasonSchema>;

export const TRAINING_INTENSITIES = ['light', 'normal', 'intense'] as const;
export const TrainingIntensitySchema = z.enum(TRAINING_INTENSITIES);
export type TrainingIntensity = z.infer<typeof TrainingIntensitySchema>;

/* ---------------- Memória das histórias (Fase 5 da grande atualização) ---------------- */

/** Uma pessoa que o jogo lembra: o chefe de equipe do kart, o rival que volta, a dona da padaria. */
export const StoryPersonSchema = z.object({
  /** Chave nos dados (`chefe-kart`, `rival-kart`, `padaria`). */
  key: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  /** Papel, como aparece nos textos: "chefe de equipe", "dono da padaria". */
  role: z.string(),
  /** Pilotos: o id no grid em que foi conhecido (para voltar ao grid) e a nacionalidade. */
  driverId: z.string().nullable(),
  nationality: z.string().nullable(),
  /** Idade da pessoa quando o piloto a conheceu (só pilotos), para saber a idade de hoje. */
  age: z.number().int().nullable(),
  /** Equipe ou empresa a que ela está ligada agora; `teamKey` ("categoria:equipe") quando é uma equipe. */
  org: z.string().nullable(),
  teamKey: z.string().nullable(),
  /** Quando e onde o piloto a conheceu, e a idade que ele tinha. */
  metSeason: z.number().int().min(1),
  metCategoryId: CategoryIdSchema,
  playerAge: z.number().int().min(0),
  /** O que ela pensa do piloto: −100 (inimigo) a 100 (fiel). */
  attitude: z.number().min(-100).max(100),
  /** Piloto que acompanha a carreira: entra no grid quando o jogador sobe de categoria. */
  follows: z.boolean(),
  /** Cadeia que a guardou (ao acabar a cadeia, ela deixa de acompanhar). */
  chainId: z.string().nullable(),
});
export type StoryPerson = z.infer<typeof StoryPersonSchema>;

const StoryMomentSchema = z.object({ season: z.number().int().min(1), round: z.number().int().min(0) });

export const StoryChainStateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['active', 'done']),
  /** Próximo passo (null quando a cadeia acabou) e a partir de quando ele pode sair. */
  next: z.string().nullable(),
  notBefore: StoryMomentSchema,
  /** Passos vividos, em ordem: o passo, a escolha e quando. */
  steps: z.array(z.object({ step: z.string(), choice: z.string(), season: z.number().int().min(1), round: z.number().int().min(0) })),
});
export type StoryChainState = z.infer<typeof StoryChainStateSchema>;

/**
 * Memória do personagem atual. É dele, como o nascimento: a sucessão começa uma memória nova.
 * `seen` não tem corte: é o que garante que nenhum texto se repete na carreira.
 */
export const StoryMemorySchema = z.object({
  driverId: z.string(),
  /** Variantes de texto já mostradas (evento#variante, perfil de patrocinador…) e quando. */
  seen: z.array(z.object({ key: z.string().min(1), season: z.number().int().min(1), round: z.number().int().min(0) })),
  /** Marcas deixadas por escolhas. */
  flags: z.array(z.object({ id: z.string().min(1), season: z.number().int().min(1) })),
  people: z.array(StoryPersonSchema),
  chains: z.array(StoryChainStateSchema),
});
export type StoryMemory = z.infer<typeof StoryMemorySchema>;

/**
 * Versão do formato do save. Sobe a cada mudança no que é gravado, sempre junto com uma migração
 * em src/persistence/migrations.ts e um save novo em tests/fixtures (o passo a passo está lá).
 * Versão 4 (Fase 0): nomes próprios das categorias e das equipes nos textos gravados.
 * Versão 5 (Fase 1): retrato de cada temporada fechada (`seasonTrend`), para os gráficos pequenos
 * de evolução dos atributos e do caixa. É só registro: nenhuma regra do jogo o lê.
 * Versão 6 (Fase 2): o nascimento sorteado do piloto (`birth`) e o efeito `relocate` (mudança do
 * interior para a capital). Saves antigos ficam com `birth: null`: carreira começada antes dos
 * nascimentos, sem nenhum efeito de nascença.
 * Versão 7 (Fase 3): polo, investidor, vaquinha, trabalho paralelo e a conta das temporadas sem porta.
 * Versão 8 (Fase 4): os lances decisivos de cada corrida (`race.moments`) e o registro dos toques
 * em lances que criaram rivalidade (`relations.rivalryLog`). Saves antigos ficam com as duas listas vazias.
 * Versão 9 (Fase 5): a memória das histórias (`story`: textos já mostrados, marcas, pessoas e cadeias).
 * Saves antigos ficam com a memória vazia. Patrocinadores, escolhas e cartões ganham campos opcionais.
 */
export const CAREER_SCHEMA_VERSION = 9;

/* ---------------- Nascimento (Fase 2 da grande atualização) ---------------- */

/** Corpo e mente: as cinco aptidões de nascença (0 a 100, em torno de 50). */
export const APTITUDE_KEYS = ['reflexes', 'physique', 'intelligence', 'composure', 'charisma'] as const;
export const AptitudeKeySchema = z.enum(APTITUDE_KEYS);
export type AptitudeKey = z.infer<typeof AptitudeKeySchema>;
export const AptitudesSchema = z.object({
  reflexes: RatingSchema,
  physique: RatingSchema,
  intelligence: RatingSchema,
  composure: RatingSchema,
  charisma: RatingSchema,
});
export type Aptitudes = z.infer<typeof AptitudesSchema>;

/** Origem da família. Só a humilde está aberta; as demais são da versão premium, ainda bloqueada. */
export const BIRTH_ORIGINS = ['humble', 'racer-parent', 'business-parent', 'mechanic-parent', 'abroad'] as const;
export const BirthOriginSchema = z.enum(BIRTH_ORIGINS);
export type BirthOrigin = z.infer<typeof BirthOriginSchema>;

/**
 * Talentos e defeitos ocultos, em pares que se excluem (cada talento tem o seu defeito oposto).
 * Os ids entram no sorteio: a ordem desta lista não muda.
 */
export const TRAIT_IDS = [
  'rainMaster',
  'rainFear',
  'bornStarter',
  'slowStarter',
  'tyreSaver',
  'tyreEater',
  'quickLearner',
  'slowLearner',
  'qualifyingKing',
  'qualifyingNerves',
  'ironBody',
  'fragile',
  'cleanRacer',
  'hothead',
  'bigStage',
  'debutNerves',
] as const;
export const TraitIdSchema = z.enum(TRAIT_IDS);
export type TraitId = z.infer<typeof TraitIdSchema>;

export const BirthTraitSchema = z.object({
  id: TraitIdSchema,
  /** Temporada e etapa em que o jogo revelou o traço; null enquanto ele é um "?" na ficha. */
  revealedSeason: z.number().int().min(1).nullable(),
  revealedRound: z.number().int().min(0).nullable(),
});
export type BirthTrait = z.infer<typeof BirthTraitSchema>;

/** O nascimento sorteado no começo da carreira. Os valores ficam gravados como saíram do sorteio. */
export const BirthSchema = z.object({
  /** De quem é: só vale para este personagem (um herdeiro não herda o nascimento). */
  driverId: z.string().min(1),
  origin: BirthOriginSchema,
  /** Quantas vezes o sorteio foi refeito antes de começar. */
  rerolls: z.number().int().min(0),
  hometownId: z.string().min(1),
  region: z.enum(['capital', 'interior']),
  /** Profissões da mãe e do pai (ids de src/data/birth.ts). */
  parents: z.object({ mother: z.string().min(1), father: z.string().min(1) }),
  /** Economias da família no começo da carreira (o caixa inicial). */
  savings: z.number().min(0),
  /** Quanto a família ajuda por temporada e por quantas temporadas. */
  support: z.object({ perSeason: z.number().min(0), seasons: z.number().int().min(0) }),
  aptitudes: AptitudesSchema,
  traits: z.array(BirthTraitSchema),
  /** Temporada em que quem nasceu no interior se mudou para a capital (null: não se mudou ou nasceu nela). */
  movedSeason: z.number().int().min(1).nullable(),
});
export type Birth = z.infer<typeof BirthSchema>;

/**
 * Retrato do fim de uma temporada, para os gráficos de tendência da interface. Guarda o que os
 * outros registros não guardam: os atributos do piloto e o caixa naquele momento.
 */
export const SeasonTrendPointSchema = z.object({
  season: z.number().int().min(1),
  year: z.number().int(),
  /** De quem é o retrato: muda a cada geração da dinastia. */
  driverId: z.string(),
  /** Atributos e nota geral do piloto no fim da temporada; null nas temporadas como dirigente. */
  attributes: DriverAttributesSchema.nullable(),
  overall: z.number().nullable(),
  /** Dinheiro em conta e patrimônio líquido no fechamento do ano. */
  cash: z.number(),
  netWorth: z.number(),
});
export type SeasonTrendPoint = z.infer<typeof SeasonTrendPointSchema>;

export const CareerStateSchema = z.object({
  schemaVersion: z.literal(CAREER_SCHEMA_VERSION),
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Semente mestra: toda a variabilidade da carreira deriva dela. */
  seed: z.number().int().min(0).max(0xffffffff),
  season: z.number().int().min(1),
  year: z.number().int(),
  /** 'retired' só aparece em saves antigos (Fase 2); hoje a carreira segue como dirigente. */
  status: z.enum(['active', 'retired']),
  /** driver: o personagem corre; executive: aposentou-se das pistas e atua como dirigente ou investidor. */
  mode: z.enum(['driver', 'executive']),
  /** Categoria acompanhada nesta temporada: a que o jogador disputa ou a da equipe que ele dirige. */
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
  /** Contrato de piloto. No modo dirigente, guarda o último contrato assinado (só histórico). */
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
  /** Um retrato por temporada fechada, da mais antiga para a mais recente (só para os gráficos). */
  seasonTrend: z.array(SeasonTrendPointSchema),
  inbox: z.array(InboxMessageSchema),
  family: FamilySchema,
  dynasty: DynastySchema,
  /** Equipe que o jogador comanda ou possui (modo dirigente). */
  management: ManagedTeamSchema.nullable(),
  executiveOffseason: ExecutiveOffseasonSchema.nullable(),
  /** Retrospecto do personagem atual como dirigente (acompanha-o entre equipes). */
  executiveLog: z.array(ExecutiveLogEntrySchema),
  /** Sucessão em aberto: bloqueia o jogo até o herdeiro ser escolhido. */
  succession: SuccessionSchema.nullable(),
  tutorial: z.object({ done: z.array(z.string()), dismissed: z.boolean() }),
  /** Nascimento sorteado do personagem que começou a carreira (null em saves anteriores à versão 6). */
  birth: BirthSchema.nullable(),
  /** Polo em que o piloto mora (Fase 3 da grande atualização). */
  hub: HubStateSchema,
  investor: InvestorSchema.nullable(),
  crowdfund: CrowdfundSchema.nullable(),
  /** Trabalho paralelo: dá dinheiro por etapa e tira tempo de treino. */
  sideJob: SideJobSchema,
  /** Temporadas seguidas fechadas sem nenhuma porta aberta (nenhuma vaga além da de aluguel). */
  noDoorSeasons: z.number().int().min(0),
  /** Memória das histórias do personagem atual (Fase 5 da grande atualização). */
  story: StoryMemorySchema,
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
