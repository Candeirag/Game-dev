import { CATEGORY_NAMES } from '@/domain/categoryNames';
import type { CategoryId, TyreCompound } from '@/domain/schemas';

/**
 * As sete categorias da escada, do kart regional ao Grand Prix Mundial.
 *
 * Cada categoria define as regras de corrida, o nível técnico do grid, a
 * economia e o que é preciso para entrar nela. O motor não tem nenhum "if"
 * por categoria: ele lê estas definições. Os nomes (campeonato, rótulo curto
 * e licença) vêm todos de `src/domain/categoryNames.ts`.
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
  /** Degrau na escada: 1 (kart regional) a 7 (Grand Prix Mundial). */
  tier: number;
  vehicle: 'kart' | 'formula';
  /** Como o equipamento é chamado nos textos. */
  machine: string;
  rounds: number;
  trackIds: readonly string[];
  /** Fator sobre o tempo de referência da pista (um Monoposto Júnior é mais lento que um Monoposto Grand Prix). */
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

/**
 * Etapas do kart regional: o campeonato tem polo em São Paulo e roda pelo estado, nos três
 * kartódromos paulistas que o jogo tem (Cotia, São Paulo e Birigui), cada um mais de uma vez.
 */
const SP_KART_ROUNDS = [
  'vale-do-sol',
  'mantiqueira',
  'cerrado-paulista',
  'vale-do-sol',
  'cerrado-paulista',
  'mantiqueira',
  'vale-do-sol',
  'mantiqueira',
  'cerrado-paulista',
  'vale-do-sol',
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
 * - Custos revistos na Fase 3 da grande atualização para a ordem de grandeza real, em reais, e
 *   para subirem muito a cada degrau: uma temporada de kart regional custa dezenas de milhares;
 *   o Brasileiro, mais de cem mil; o kart internacional, centenas de milhares; o primeiro degrau
 *   de monopostos, perto de um milhão; e as fórmulas de fora, milhões (o último degrau antes do
 *   topo passa de 10 milhões). Os valores foram calibrados no simulador (`npm run sim`) para um
 *   piloto pobre e bom chegar à Fórmula Júnior com patrocínio e bolsa, e um pobre mediano precisar
 *   de investidor, academia ou mais um ano. Viagens, equipamento e aluguel do polo ficam em
 *   `RUNNING_COSTS` e `HUB_RULES` (`src/config/balance.ts`).
 * - Os pontos de licença seguem a lógica das licenças por pontos do automobilismo: 40 pontos
 *   em três temporadas para chegar ao Grand Prix Mundial; as três primeiras posições da
 *   Fórmula Elite garantem os 40 de uma vez.
 * - carFactor: no kart e nas categorias monomarca, o equipamento pesa pouco;
 *   no Grand Prix Mundial, o carro vale quatro vezes mais.
 * - lapTimeFactor: razão aproximada entre os tempos de volta de cada carro e
 *   os do Monoposto Grand Prix na mesma pista.
 */
/** Identificação de uma categoria: o id (fixo) e os nomes que saem do arquivo central. */
const named = <T extends CategoryId>(id: T) => ({ id, name: CATEGORY_NAMES[id].name, shortName: CATEGORY_NAMES[id].shortName });

export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    ...named('kart-regional'),
    tier: 1,
    vehicle: 'kart',
    machine: 'kart',
    rounds: 10,
    trackIds: SP_KART_ROUNDS,
    lapTimeFactor: 1,
    carFactor: 1,
    qualifyingFormat: 'single',
    points: KART_POINTS,
    polePoints: 1,
    fastestLapPoints: 1,
    fastestLapTop10Only: false,
    race: KART_RACE,
    field: { driverLevel: 68, driverSpread: 16, minAge: 13, maxAge: 20 },
    economy: { seatCost: [30_000, 16_000], salary: [0, 0], living: 6_000, sponsorBase: 45_000, damageBill: 2_000, trainingCost: 300, winBonus: 0 },
    requirements: { minAge: 12, licensePoints: 0, minReputation: 0, minExperience: 0, licenseName: CATEGORY_NAMES['kart-regional'].licenseName },
    licensePoints: [10, 8, 6, 5, 4, 3, 2, 2, 1, 1],
  },
  {
    ...named('kart-national'),
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
    economy: { seatCost: [140_000, 80_000], salary: [0, 0], living: 10_000, sponsorBase: 110_000, damageBill: 6_000, trainingCost: 600, winBonus: 0 },
    requirements: { minAge: 13, licensePoints: 2, minReputation: 10, minExperience: 26, licenseName: CATEGORY_NAMES['kart-national'].licenseName },
    licensePoints: [15, 12, 10, 8, 6, 5, 4, 3, 2, 1],
  },
  {
    ...named('kart-international'),
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
    economy: { seatCost: [480_000, 300_000], salary: [0, 0], living: 40_000, sponsorBase: 480_000, damageBill: 15_000, trainingCost: 2_500, winBonus: 0 },
    requirements: { minAge: 14, licensePoints: 8, minReputation: 18, minExperience: 34, licenseName: CATEGORY_NAMES['kart-international'].licenseName },
    licensePoints: [20, 16, 13, 10, 8, 6, 5, 4, 3, 2],
  },
  {
    ...named('f4'),
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
    economy: { seatCost: [1_000_000, 650_000], salary: [0, 0], living: 30_000, sponsorBase: 750_000, damageBill: 60_000, trainingCost: 2_500, winBonus: 0 },
    requirements: { minAge: 15, licensePoints: 12, minReputation: 25, minExperience: 40, licenseName: CATEGORY_NAMES.f4.licenseName },
    licensePoints: [25, 20, 16, 13, 10, 8, 6, 4, 3, 2],
  },
  {
    ...named('f3'),
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
    economy: { seatCost: [4_500_000, 3_000_000], salary: [0, 0], living: 60_000, sponsorBase: 3_000_000, damageBill: 200_000, trainingCost: 5_000, winBonus: 40_000 },
    requirements: { minAge: 16, licensePoints: 18, minReputation: 36, minExperience: 50, licenseName: CATEGORY_NAMES.f3.licenseName },
    licensePoints: [30, 25, 20, 15, 12, 9, 7, 5, 3, 2],
  },
  {
    ...named('f2'),
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
      seatCost: [12_000_000, 8_000_000],
      salary: [0, 0],
      living: 120_000,
      sponsorBase: 8_000_000,
      damageBill: 500_000,
      trainingCost: 10_000,
      winBonus: 120_000,
    },
    requirements: { minAge: 17, licensePoints: 25, minReputation: 48, minExperience: 58, licenseName: CATEGORY_NAMES.f2.licenseName },
    licensePoints: [40, 40, 40, 30, 20, 10, 8, 6, 4, 3],
  },
  {
    ...named('f1'),
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
    requirements: { minAge: 18, licensePoints: 40, minReputation: 60, minExperience: 64, licenseName: CATEGORY_NAMES.f1.licenseName },
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

/** Temporadas consideradas na soma de pontos de licença. */
export const LICENSE_WINDOW_SEASONS = 3;
