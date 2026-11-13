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

export const DriverSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nationality: z.string().length(2),
  age: z.number().int().min(10).max(60),
  /** Equipe atual, ou null quando o piloto está sem vaga (reserva). */
  teamId: z.string().nullable(),
  isPlayer: z.boolean(),
  attributes: DriverAttributesSchema,
  /** Teto de desenvolvimento: nenhum atributo treinável cresce além disso. */
  potential: RatingSchema,
  trainingFocus: TrainingFocusSchema,
});
export type Driver = z.infer<typeof DriverSchema>;

export const KartPerformanceSchema = z.object({
  /** Potência do motor: pesa mais em pistas rápidas. */
  engine: RatingSchema,
  /** Chassi/acerto: pesa mais em pistas travadas. */
  chassis: RatingSchema,
  /** Confiabilidade mecânica: reduz a chance de quebra. */
  reliability: RatingSchema,
});
export type KartPerformance = z.infer<typeof KartPerformanceSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kart: KartPerformanceSchema,
  /** Posição no campeonato de pilotos que a equipe espera do seu piloto. */
  driverTarget: z.number().int().min(1).max(20),
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
});
export type QualifyingEntry = z.infer<typeof QualifyingEntrySchema>;

export const QualifyingResultSchema = z.object({
  weather: SessionWeatherSchema,
  /** Ordenado pela posição no grid. */
  entries: z.array(QualifyingEntrySchema),
});
export type QualifyingResult = z.infer<typeof QualifyingResultSchema>;

export const RaceStatusSchema = z.enum(['finished', 'dnf']);
export const DnfReasonSchema = z.enum(['crash', 'mechanical', 'collision']);
export type DnfReason = z.infer<typeof DnfReasonSchema>;

export const RaceEventSchema = z.object({
  lap: z.number().int().min(0),
  type: z.enum(['start', 'overtake', 'error', 'spin', 'dnf', 'collision', 'fastestLap', 'finish']),
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
});
export type WeekendState = z.infer<typeof WeekendStateSchema>;

/* ------------------------------------------------------------------ */
/* Carreira                                                            */
/* ------------------------------------------------------------------ */

export const InboxMessageSchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.enum(['team', 'race', 'training', 'season']),
  title: z.string(),
  body: z.string(),
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

export const StandingSnapshotSchema = z.object({
  driverId: z.string(),
  teamId: z.string().nullable(),
  position: z.number().int().min(1),
  points: z.number().int().min(0),
  wins: z.number().int().min(0),
});

/** Resumo arquivado de uma temporada encerrada. */
export const SeasonSummarySchema = z.object({
  season: z.number().int().min(1),
  year: z.number().int(),
  championDriverId: z.string(),
  championTeamId: z.string(),
  playerTeamId: z.string(),
  playerPosition: z.number().int().min(1),
  playerPoints: z.number().int().min(0),
  objectiveTarget: z.number().int().min(1),
  objectiveMet: z.boolean(),
  driverStandings: z.array(StandingSnapshotSchema),
  /** Nomes congelados no momento do arquivamento (pilotos podem mudar depois). */
  driverNames: z.record(z.string(), z.string()),
  rounds: z.array(RoundRecordSchema),
});
export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;

export const CAREER_SCHEMA_VERSION = 1;

export const CareerStateSchema = z.object({
  schemaVersion: z.literal(CAREER_SCHEMA_VERSION),
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Semente mestra: toda a variabilidade da carreira deriva dela. */
  seed: z.number().int().min(0).max(0xffffffff),
  season: z.number().int().min(1),
  year: z.number().int(),
  playerDriverId: z.string(),
  reputation: RatingSchema,
  drivers: z.array(DriverSchema),
  teams: z.array(TeamSchema),
  calendar: z.array(ChampionshipEventSchema),
  /** Índice (base 0) da próxima etapa. Igual a calendar.length quando a temporada acabou. */
  nextRoundIndex: z.number().int().min(0),
  weekend: WeekendStateSchema.nullable(),
  /** Etapas disputadas na temporada atual, em ordem. */
  rounds: z.array(RoundRecordSchema),
  /** Atributos do jogador no início da temporada, para mostrar a evolução. */
  playerSeasonStartAttributes: DriverAttributesSchema,
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
  state: z.string().length(2),
  lengthMeters: z.number().int().positive(),
  /** Tempo de referência de uma volta seca, com kart e piloto nota 100. */
  baseLapTime: z.number().positive(),
  laps: z.number().int().positive(),
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
