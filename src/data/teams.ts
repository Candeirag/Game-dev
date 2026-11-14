import type { CategoryId, Team } from '@/domain/schemas';

/**
 * As 10 equipes do Campeonato Regional de Kart.
 *
 * Os números não são aleatórios: as equipes formam uma escada de 5 níveis,
 * com dois times por nível. Do topo à base, a média de motor e chassi cai
 * cerca de 2,5 pontos por equipe, o que dá uns 20 pontos entre a primeira e
 * a última. Pelo modelo de tempo de volta (ver simulationConstants), isso
 * vale cerca de 0,2 s por volta: diferença real, mas que um piloto bom
 * consegue compensar.
 *
 * Dentro de cada nível, as equipes trocam força de motor por força de chassi,
 * para que o traçado de cada pista mude a ordem de forças.
 *
 * A meta (driverTarget) acompanha o nível: quem tem o melhor kart espera
 * disputar o título; quem está no fundo quer apenas sair das últimas posições.
 */
const REGIONAL_TEAMS: readonly Team[] = [
  // Nível 1: candidatos ao título
  {
    id: 'vortex',
    name: 'Vortex Racing Kart',
    shortName: 'VRX',
    color: '#e11d48',
    car: { engine: 86, chassis: 83, reliability: 88 },
    crew: 78,
    affiliation: null,
    driverTarget: 3,
  },
  {
    id: 'trovao',
    name: 'Trovão Motorsport',
    shortName: 'TRV',
    color: '#f59e0b',
    car: { engine: 82, chassis: 87, reliability: 84 },
    crew: 76,
    affiliation: null,
    driverTarget: 3,
  },
  // Nível 2: briga por pódios
  {
    id: 'serra',
    name: 'Serra Kart Team',
    shortName: 'SER',
    color: '#10b981',
    car: { engine: 81, chassis: 78, reliability: 86 },
    crew: 72,
    affiliation: null,
    driverTarget: 6,
  },
  {
    id: 'falcao',
    name: 'Falcão Competições',
    shortName: 'FAL',
    color: '#3b82f6',
    car: { engine: 77, chassis: 81, reliability: 80 },
    crew: 70,
    affiliation: null,
    driverTarget: 6,
  },
  // Nível 3: pelotão intermediário
  {
    id: 'riogrande',
    name: 'Rio Grande Racing',
    shortName: 'RGR',
    color: '#8b5cf6',
    car: { engine: 77, chassis: 74, reliability: 82 },
    crew: 66,
    affiliation: null,
    driverTarget: 10,
  },
  {
    id: 'atlantico',
    name: 'Atlântico Kart',
    shortName: 'ATL',
    color: '#06b6d4',
    car: { engine: 73, chassis: 77, reliability: 76 },
    crew: 64,
    affiliation: null,
    driverTarget: 10,
  },
  // Nível 4: briga por pontos
  {
    id: 'pampa',
    name: 'Pampa Speed',
    shortName: 'PMP',
    color: '#84cc16',
    car: { engine: 72, chassis: 70, reliability: 78 },
    crew: 60,
    affiliation: null,
    driverTarget: 13,
  },
  {
    id: 'horizonte',
    name: 'Horizonte Racing',
    shortName: 'HOR',
    color: '#f97316',
    car: { engine: 69, chassis: 72, reliability: 72 },
    crew: 58,
    affiliation: null,
    driverTarget: 13,
  },
  // Nível 5: equipes de entrada, onde o jogador começa
  {
    id: 'cerrado',
    name: 'Cerrado Kart Club',
    shortName: 'CER',
    color: '#a16207',
    car: { engine: 67, chassis: 66, reliability: 74 },
    crew: 54,
    affiliation: null,
    driverTarget: 16,
  },
  {
    id: 'garagem',
    name: 'Garagem Nova Kart',
    shortName: 'GNK',
    color: '#64748b',
    car: { engine: 64, chassis: 66, reliability: 70 },
    crew: 52,
    affiliation: null,
    driverTarget: 16,
  },
];

/**
 * Equipes que oferecem vaga a um estreante. Um piloto novato e sem resultados
 * só consegue lugar nas equipes de nível 4 e 5.
 */
export const ROOKIE_TEAM_IDS: readonly string[] = ['horizonte', 'cerrado', 'garagem'];

/* ------------------------------------------------------------------ */
/* Demais categorias                                                   */
/* ------------------------------------------------------------------ */

const COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#a16207', '#64748b'] as const;
const TARGETS = [3, 3, 6, 6, 10, 10, 13, 13, 16, 16] as const;

/** Equipes de F1 (fictícias), da mais forte para a mais fraca. Todas mantêm uma academia de pilotos. */
export const F1_TEAM_NAMES = [
  'Corsa Imperiale',
  'Albion Grand Prix',
  'Rheingold Racing',
  'Solaris Racing',
  'Azure F1 Team',
  'Emerald GP',
  'Massif Racing',
  'Stallion F1',
  'Kraken Motorsport',
  'Orion Grand Prix',
] as const;

interface CategoryTeams {
  names: readonly string[];
  /** Índice (em F1_TEAM_NAMES) da equipe de F1 a que cada equipe é ligada; -1 = independente. */
  affiliations: readonly number[];
}

const TEAM_NAMES: Record<Exclude<CategoryId, 'kart-regional'>, CategoryTeams> = {
  'kart-national': {
    names: [
      'Águia Racing',
      'Meridional Kart',
      'Tupi Motorsport',
      'Ipê Competições',
      'Corsa Brasil',
      'Litoral Racing Team',
      'Sertão Kart',
      'Paulista Speed',
      'Arara Azul Racing',
      'Nova Era Kart',
    ],
    affiliations: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  },
  'kart-international': {
    names: [
      'Scuderia Aurora',
      'Nordic Kart Racing',
      'Britannia Karts',
      'Iberia Racing',
      'Alpen Kart Technik',
      'Riviera Corse',
      'Benelux Kart Team',
      'Pacific Rim Racing',
      'Adria Motorsport',
      'Atlas Kart Club',
    ],
    affiliations: [0, 1, -1, -1, 2, -1, -1, -1, -1, -1],
  },
  f4: {
    names: [
      'Prisma Racing',
      'Velocità Junior',
      'Dragon Motorsport',
      'Van Aalst Racing',
      'Ibérica Racing',
      'Kestrel Autosport',
      'Riviera Junior Team',
      'Lone Star Academy',
      'Sakura Racing',
      'Southern Cross Motorsport',
    ],
    affiliations: [0, 3, -1, 1, -1, 2, -1, 4, -1, -1],
  },
  f3: {
    names: [
      'Artemis Grand Prix',
      'Neptune Racing',
      'Prisma Racing',
      'Hyperion GP',
      'Castilla Racing',
      'Sterling Motorsport',
      'Van Aalst Racing',
      'Helvetia Motorsport',
      'Bohemia Racing System',
      'Lowlands Motorsport',
    ],
    affiliations: [1, 0, 2, 3, -1, 4, 5, -1, 6, -1],
  },
  f2: {
    names: [
      'Artemis Grand Prix',
      'Prisma Racing',
      'Sterling Motorsport',
      'Victrix Racing',
      'Loire Racing',
      'Castilla Racing',
      'Hyperion GP',
      'Lowlands Motorsport',
      'Neptune Racing',
      'Bohemia Racing System',
    ],
    affiliations: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
  f1: { names: F1_TEAM_NAMES, affiliations: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
};

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function f1TeamId(index: number): string {
  return `f1-${slug(F1_TEAM_NAMES[index] ?? '')}`;
}

/**
 * Monta as 10 equipes de uma categoria pela mesma escada usada no kart
 * regional: da primeira à última, a média de motor e chassi cai 2,5 pontos por
 * equipe (de 86 a 63,5), a confiabilidade cai de 90 a 70 e a equipe de box, de
 * 90 a 54. Equipes vizinhas alternam força de motor e de chassi, para que o
 * traçado de cada pista mude a ordem de forças. O quanto essa diferença pesa
 * no tempo de volta depende do carFactor da categoria.
 */
function buildTeams(categoryId: Exclude<CategoryId, 'kart-regional'>): Team[] {
  const { names, affiliations } = TEAM_NAMES[categoryId];
  return names.map((name, rank) => {
    const average = 86 - rank * 2.5;
    const bias = rank % 2 === 0 ? 2 : -2;
    const initials = name
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase();
    return {
      id: `${categoryId}-${slug(name)}`,
      name,
      shortName: (initials.length >= 2 ? initials : name.toUpperCase()).slice(0, 3),
      color: COLORS[rank] ?? '#64748b',
      car: { engine: Math.round(average + bias), chassis: Math.round(average - bias), reliability: Math.round(90 - rank * 2.2) },
      crew: 90 - rank * 4,
      affiliation: (affiliations[rank] ?? -1) >= 0 ? f1TeamId(affiliations[rank] ?? 0) : null,
      driverTarget: TARGETS[rank] ?? 16,
    };
  });
}

const CACHE = new Map<CategoryId, readonly Team[]>();

/** Equipes iniciais de uma categoria (cópias novas a cada chamada). */
export function initialTeams(categoryId: CategoryId): Team[] {
  let teams = CACHE.get(categoryId);
  if (!teams) {
    teams = categoryId === 'kart-regional' ? REGIONAL_TEAMS : buildTeams(categoryId);
    CACHE.set(categoryId, teams);
  }
  return teams.map((t) => ({ ...t, car: { ...t.car } }));
}

/** Mantido para os dados e testes da Fase 1. */
export const TEAMS: readonly Team[] = REGIONAL_TEAMS;

/** Metas de posição por ordem de força da equipe. */
export const TEAM_TARGETS: readonly number[] = TARGETS;
