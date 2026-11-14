import type { CategoryId, TyreCompound } from '@/domain/schemas';

/**
 * As sete categorias da escada, do kart regional à Fórmula 1.
 *
 * Cada categoria define as regras de corrida, o nível técnico do grid, a
 * economia e o que é preciso para entrar nela. O motor não tem nenhum "if"
 * por categoria: ele lê estas definições.
 */
export interface RaceRules {
  /** Há pit lane e troca de pneus durante a corrida. */
  pitStops: boolean;
  /** No seco, é obrigatório usar dois compostos diferentes. */
  mandatoryTwoCompounds: boolean;
  /** Compostos de pista seca disponíveis. */
  dryCompounds: readonly TyreCompound[];
  /** Compostos de chuva disponíveis. */
  wetCompounds: readonly TyreCompound[];
  /** Combustível modelado (peso e consumo). */
  fuel: boolean;
  safetyCar: boolean;
  virtualSafetyCar: boolean;
  redFlag: boolean;
  /** Clima pode mudar durante a corrida. */
  changingWeather: boolean;
  teamOrders: boolean;
  /** Punições por excesso de erros (limites de pista). */
  trackLimits: boolean;
  /** Tempo perdido para cruzar o pit lane, em segundos (sem contar a parada). */
  pitLaneLoss: number;
  /** Duração-alvo da corrida em minutos (monopostos). No kart, vale o número de voltas da pista. */
  raceMinutes: number | null;
}

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  shortName: string;
  /** Degrau na escada: 1 (kart regional) a 7 (Fórmula 1). */
  tier: number;
  vehicle: 'kart' | 'formula';
  /** Como o equipamento é chamado nos textos. */
  machine: string;
  rounds: number;
  trackIds: readonly string[];
  /** Fator sobre o tempo de referência da pista (um F4 é mais lento que um F1). */
  lapTimeFactor: number;
  /** Peso do equipamento no tempo de volta, em relação ao kart regional. */
  carFactor: number;
  qualifyingFormat: 'single' | 'knockout';
  points: readonly number[];
  polePoints: number;
  fastestLapPoints: number;
  /** A volta mais rápida só pontua para quem termina entre os dez primeiros. */
  fastestLapTop10Only: boolean;
  race: RaceRules;
  /** Nível médio dos atributos do grid e diferença entre a melhor e a pior equipe. */
  field: { driverLevel: number; driverSpread: number; minAge: number; maxAge: number };
  economy: {
    /** Custo anual da vaga: [melhor equipe, pior equipe]. */
    seatCost: readonly [number, number];
    /** Salário anual: [melhor equipe, pior equipe]. */
    salary: readonly [number, number];
    /** Custo de vida e estrutura pessoal por temporada. */
    living: number;
    /** Valor de referência de um patrocínio grande por temporada. */
    sponsorBase: number;
    /** Conta de um dano total no equipamento (cobrada do piloto nas categorias de base). */
    damageBill: number;
    /** Custo do treino normal por etapa. */
    trainingCost: number;
    /** Bônus por vitória pago pela melhor equipe (as outras pagam menos). */
    winBonus: number;
  };
  /** Requisitos para um piloto ser aceito na categoria. */
  requirements: { minAge: number; licensePoints: number; minReputation: number; minExperience: number; licenseName: string };
  /** Pontos de licença pela posição final (1º, 2º, ...). */
  licensePoints: readonly number[];
}

const KART_RACE: RaceRules = {
  pitStops: false,
  mandatoryTwoCompounds: false,
  dryCompounds: ['kart'],
  wetCompounds: ['kart'],
  fuel: false,
  safetyCar: false,
  virtualSafetyCar: false,
  redFlag: false,
  changingWeather: false,
  teamOrders: false,
  trackLimits: false,
  pitLaneLoss: 0,
  raceMinutes: null,
};

const KART_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

const BR_KART_TRACKS = [
  'vale-do-sol',
  'lagoa-azul',
  'serra-gaucha',
  'planalto',
  'mantiqueira',
  'litoral-norte',
  'triangulo',
  'pampas',
  'cerrado-paulista',
  'guanabara',
] as const;
const WORLD_KART_TRACKS = [
  'garda',
  'limburg',
  'sarthe-kart',
  'zuera',
  'wackersdorf',
  'kristianstad',
  'pfi',
  'portimao-kart',
  'franciacorta',
  'al-ain',
] as const;
const CIRCUITS = [
  'sao-paulo',
  'melbourne',
  'imola',
  'barcelona',
  'monaco',
  'montreal',
  'silverstone',
  'spa',
  'budapest',
  'monza',
  'singapura',
  'suzuka',
  'austin',
  'abu-dhabi',
] as const;

/**
 * Valores e sua origem:
 * - Custos na ordem de grandeza real, em euros, de cada categoria (uma temporada
 *   de F4 custa algumas centenas de milhares; uma de F2, mais de 2 milhões).
 * - Os pontos de licença seguem o espírito da superlicença da FIA: 40 pontos
 *   em três temporadas para chegar à F1; as três primeiras posições da F2
 *   garantem os 40 de uma vez.
 * - carFactor: no kart e nas categorias monomarca, o equipamento pesa pouco;
 *   na F1, o carro vale quatro vezes mais.
 * - lapTimeFactor: razão aproximada entre os tempos de volta de cada carro e
 *   os de um F1 na mesma pista.
 */
export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    id: 'kart-regional',
    name: 'Campeonato Regional de Kart',
    shortName: 'Kart Regional',
    tier: 1,
    vehicle: 'kart',
    machine: 'kart',
    rounds: 10,
    trackIds: BR_KART_TRACKS,
    lapTimeFactor: 1,
    carFactor: 1,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 1,
    fastestLapPoints: 1,
    fastestLapTop10Only: false,
    race: KART_RACE,
    field: { driverLevel: 68, driverSpread: 16, minAge: 13, maxAge: 20 },
    economy: { seatCost: [30_000, 16_000], salary: [0, 0], living: 5_000, sponsorBase: 16_000, damageBill: 1_500, trainingCost: 250, winBonus: 0 },
    requirements: { minAge: 12, licensePoints: 0, minReputation: 0, minExperience: 0, licenseName: 'Licença de Kart Regional' },
    licensePoints: [10, 8, 6, 5, 4, 3, 2, 2, 1, 1],
  },
  {
    id: 'kart-national',
    name: 'Campeonato Brasileiro de Kart',
    shortName: 'Kart Nacional',
    tier: 2,
    vehicle: 'kart',
    machine: 'kart',
    rounds: 10,
    trackIds: ['guanabara', 'triangulo', 'vale-do-sol', 'pampas', 'planalto', 'lagoa-azul', 'cerrado-paulista', 'litoral-norte', 'mantiqueira', 'serra-gaucha'],
    lapTimeFactor: 0.985,
    carFactor: 1,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 1,
    fastestLapPoints: 1,
    fastestLapTop10Only: false,
    race: KART_RACE,
    field: { driverLevel: 72, driverSpread: 14, minAge: 14, maxAge: 21 },
    economy: { seatCost: [60_000, 34_000], salary: [0, 0], living: 9_000, sponsorBase: 40_000, damageBill: 3_000, trainingCost: 500, winBonus: 0 },
    requirements: { minAge: 13, licensePoints: 2, minReputation: 10, minExperience: 26, licenseName: 'Licença Nacional de Kart' },
    licensePoints: [15, 12, 10, 8, 6, 5, 4, 3, 2, 1],
  },
  {
    id: 'kart-international',
    name: 'Campeonato Mundial de Kart',
    shortName: 'Kart Internacional',
    tier: 3,
    vehicle: 'kart',
    machine: 'kart',
    rounds: 10,
    trackIds: WORLD_KART_TRACKS,
    lapTimeFactor: 0.97,
    carFactor: 1,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 1,
    fastestLapPoints: 1,
    fastestLapTop10Only: false,
    race: KART_RACE,
    field: { driverLevel: 75, driverSpread: 14, minAge: 14, maxAge: 22 },
    economy: { seatCost: [150_000, 90_000], salary: [0, 0], living: 18_000, sponsorBase: 85_000, damageBill: 6_000, trainingCost: 1_000, winBonus: 0 },
    requirements: { minAge: 14, licensePoints: 8, minReputation: 18, minExperience: 34, licenseName: 'Licença Internacional de Kart' },
    licensePoints: [20, 16, 13, 10, 8, 6, 5, 4, 3, 2],
  },
  {
    id: 'f4',
    name: 'Fórmula 4',
    shortName: 'F4',
    tier: 4,
    vehicle: 'formula',
    machine: 'carro',
    rounds: 10,
    trackIds: ['imola', 'barcelona', 'budapest', 'spa', 'silverstone', 'monza', 'sao-paulo', 'austin', 'suzuka', 'abu-dhabi'],
    lapTimeFactor: 1.27,
    carFactor: 1.2,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 1,
    fastestLapPoints: 1,
    fastestLapTop10Only: true,
    race: {
      pitStops: true,
      mandatoryTwoCompounds: false,
      dryCompounds: ['medium'],
      wetCompounds: ['wet'],
      fuel: false,
      safetyCar: true,
      virtualSafetyCar: false,
      redFlag: true,
      changingWeather: true,
      teamOrders: false,
      trackLimits: true,
      pitLaneLoss: 24,
      raceMinutes: 28,
    },
    field: { driverLevel: 76, driverSpread: 13, minAge: 15, maxAge: 21 },
    economy: { seatCost: [380_000, 240_000], salary: [0, 0], living: 30_000, sponsorBase: 210_000, damageBill: 28_000, trainingCost: 2_500, winBonus: 0 },
    requirements: { minAge: 15, licensePoints: 12, minReputation: 25, minExperience: 40, licenseName: 'Licença Internacional D' },
    licensePoints: [25, 20, 16, 13, 10, 8, 6, 4, 3, 2],
  },
  {
    id: 'f3',
    name: 'Fórmula 3',
    shortName: 'F3',
    tier: 5,
    vehicle: 'formula',
    machine: 'carro',
    rounds: 10,
    trackIds: ['melbourne', 'imola', 'monaco', 'barcelona', 'silverstone', 'budapest', 'spa', 'monza', 'austin', 'abu-dhabi'],
    lapTimeFactor: 1.15,
    carFactor: 1.3,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 2,
    fastestLapPoints: 1,
    fastestLapTop10Only: true,
    race: {
      pitStops: true,
      mandatoryTwoCompounds: false,
      dryCompounds: ['medium', 'hard'],
      wetCompounds: ['wet'],
      fuel: false,
      safetyCar: true,
      virtualSafetyCar: true,
      redFlag: true,
      changingWeather: true,
      teamOrders: true,
      trackLimits: true,
      pitLaneLoss: 23,
      raceMinutes: 40,
    },
    field: { driverLevel: 78, driverSpread: 12, minAge: 16, maxAge: 23 },
    economy: { seatCost: [950_000, 620_000], salary: [0, 0], living: 50_000, sponsorBase: 520_000, damageBill: 70_000, trainingCost: 5_000, winBonus: 8_000 },
    requirements: { minAge: 16, licensePoints: 18, minReputation: 36, minExperience: 50, licenseName: 'Licença Internacional C' },
    licensePoints: [30, 25, 20, 15, 12, 9, 7, 5, 3, 2],
  },
  {
    id: 'f2',
    name: 'Fórmula 2',
    shortName: 'F2',
    tier: 6,
    vehicle: 'formula',
    machine: 'carro',
    rounds: 12,
    trackIds: ['melbourne', 'imola', 'monaco', 'barcelona', 'montreal', 'silverstone', 'budapest', 'spa', 'monza', 'singapura', 'austin', 'abu-dhabi'],
    lapTimeFactor: 1.08,
    carFactor: 1.4,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 2,
    fastestLapPoints: 1,
    fastestLapTop10Only: true,
    race: {
      pitStops: true,
      mandatoryTwoCompounds: true,
      dryCompounds: ['soft', 'hard'],
      wetCompounds: ['wet'],
      fuel: true,
      safetyCar: true,
      virtualSafetyCar: true,
      redFlag: true,
      changingWeather: true,
      teamOrders: true,
      trackLimits: true,
      pitLaneLoss: 22,
      raceMinutes: 58,
    },
    field: { driverLevel: 81, driverSpread: 11, minAge: 17, maxAge: 25 },
    economy: {
      seatCost: [2_400_000, 1_600_000],
      salary: [0, 0],
      living: 90_000,
      sponsorBase: 1_300_000,
      damageBill: 150_000,
      trainingCost: 10_000,
      winBonus: 25_000,
    },
    requirements: { minAge: 17, licensePoints: 25, minReputation: 48, minExperience: 58, licenseName: 'Licença Internacional B' },
    licensePoints: [40, 40, 40, 30, 20, 10, 8, 6, 4, 3],
  },
  {
    id: 'f1',
    name: 'Fórmula 1',
    shortName: 'F1',
    tier: 7,
    vehicle: 'formula',
    machine: 'carro',
    rounds: 14,
    trackIds: CIRCUITS,
    lapTimeFactor: 1,
    carFactor: 4,
    qualifyingFormat: 'knockout',
    points: KART_POINTS,
    polePoints: 0,
    fastestLapPoints: 1,
    fastestLapTop10Only: true,
    race: {
      pitStops: true,
      mandatoryTwoCompounds: true,
      dryCompounds: ['soft', 'medium', 'hard'],
      wetCompounds: ['intermediate', 'wet'],
      fuel: true,
      safetyCar: true,
      virtualSafetyCar: true,
      redFlag: true,
      changingWeather: true,
      teamOrders: true,
      trackLimits: true,
      pitLaneLoss: 21,
      raceMinutes: 82,
    },
    field: { driverLevel: 85, driverSpread: 10, minAge: 19, maxAge: 40 },
    economy: {
      seatCost: [0, 0],
      salary: [14_000_000, 600_000],
      living: 350_000,
      sponsorBase: 3_000_000,
      damageBill: 0,
      trainingCost: 30_000,
      winBonus: 300_000,
    },
    requirements: { minAge: 18, licensePoints: 40, minReputation: 60, minExperience: 64, licenseName: 'Superlicença' },
    licensePoints: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

export function getCategory(id: CategoryId): CategoryDefinition {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Categoria desconhecida: ${id}`);
  return category;
}

export function categoryByTier(tier: number): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.tier === tier);
}

/** Pontos de punição na licença que causam suspensão de uma etapa. */
export const PENALTY_POINTS_BAN = 12;

/** Temporadas consideradas na soma de pontos de licença (como na superlicença). */
export const LICENSE_WINDOW_SEASONS = 3;
