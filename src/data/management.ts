/**
 * Economia e regulamento das equipes, por categoria.
 *
 * As ordens de grandeza derivam da economia dos pilotos (categories.ts): nas
 * categorias de base, a receita principal de uma equipe são os dois pilotos
 * que pagam pela vaga; na Fórmula 1, são os prêmios e os patrocinadores, e é a
 * equipe que paga os pilotos.
 */
import type { CategoryId, DevArea, FacilityKey, ResearchSpend, StaffRole } from '@/domain/schemas';

export interface TeamEconomy {
  /** Custo operacional por temporada: viagens, pneus, inscrições, peças. */
  operations: number;
  /** Prêmio por posição no campeonato de equipes: [campeã, última]. */
  prize: readonly [number, number];
  /** Patrocínio total de uma equipe com reputação 50. */
  sponsorBase: number;
  /** Salário anual de um profissional nota 70 (diretores e chefes). */
  staffSalary: number;
  /** Custo de um ponto de pesquisa. */
  researchCost: number;
  /** Valor de mercado: [melhor equipe, pior equipe]. */
  value: readonly [number, number];
  /** Salário do chefe de equipe contratado: [melhor equipe, pior equipe]. */
  principalSalary: readonly [number, number];
  /** Custo de subir um nível de instalação (multiplicado pelo nível de destino). */
  facilityCost: number;
  /** Teto de gastos com desenvolvimento por temporada (null = sem teto). */
  budgetCap: number | null;
  /** Evolução média das equipes rivais ao longo de uma temporada, em pontos de carro. */
  fieldDevelopment: number;
}

export const TEAM_ECONOMY: Readonly<Record<CategoryId, TeamEconomy>> = {
  'kart-regional': { operations: 30_000, prize: [6_000, 500], sponsorBase: 9_000, staffSalary: 3_500, researchCost: 350, value: [120_000, 50_000], principalSalary: [18_000, 8_000], facilityCost: 7_000, budgetCap: null, fieldDevelopment: 0.6 },
  'kart-national': { operations: 60_000, prize: [15_000, 1_500], sponsorBase: 24_000, staffSalary: 7_000, researchCost: 800, value: [300_000, 120_000], principalSalary: [35_000, 15_000], facilityCost: 16_000, budgetCap: null, fieldDevelopment: 0.6 },
  'kart-international': { operations: 150_000, prize: [40_000, 4_000], sponsorBase: 60_000, staffSalary: 16_000, researchCost: 2_000, value: [800_000, 350_000], principalSalary: [70_000, 30_000], facilityCost: 40_000, budgetCap: null, fieldDevelopment: 0.6 },
  f4: { operations: 400_000, prize: [100_000, 10_000], sponsorBase: 150_000, staffSalary: 40_000, researchCost: 5_500, value: [2_500_000, 1_200_000], principalSalary: [140_000, 60_000], facilityCost: 110_000, budgetCap: null, fieldDevelopment: 0.4 },
  f3: { operations: 1_000_000, prize: [300_000, 30_000], sponsorBase: 380_000, staffSalary: 100_000, researchCost: 14_000, value: [7_000_000, 3_500_000], principalSalary: [300_000, 120_000], facilityCost: 280_000, budgetCap: null, fieldDevelopment: 0.4 },
  f2: { operations: 2_600_000, prize: [800_000, 80_000], sponsorBase: 950_000, staffSalary: 240_000, researchCost: 35_000, value: [18_000_000, 9_000_000], principalSalary: [600_000, 250_000], facilityCost: 650_000, budgetCap: null, fieldDevelopment: 0.4 },
  f1: { operations: 20_000_000, prize: [70_000_000, 18_000_000], sponsorBase: 26_000_000, staffSalary: 1_500_000, researchCost: 420_000, value: [220_000_000, 70_000_000], principalSalary: [4_000_000, 1_000_000], facilityCost: 5_000_000, budgetCap: 30_000_000, fieldDevelopment: 2 },
};

export interface TechnicalRegulations {
  /** Áreas em que o regulamento permite desenvolvimento próprio. */
  open: Readonly<Record<DevArea, boolean>>;
  /** Melhorias permitidas por área em uma temporada. */
  maxGainsPerArea: number;
  summary: string;
}

const KART_RULES: TechnicalRegulations = {
  open: { aero: false, chassis: true, engine: false, suspension: true, manufacturing: true },
  maxGainsPerArea: 2,
  summary: 'Motores lacrados e sorteados; não há aerodinâmica. A equipe trabalha o chassi, o acerto e a preparação.',
};
const SPEC_RULES: TechnicalRegulations = {
  open: { aero: false, chassis: false, engine: false, suspension: true, manufacturing: true },
  maxGainsPerArea: 2,
  summary: 'Categoria monomarca: chassi, motor e aerodinâmica são iguais para todos. Só o acerto de suspensão e a preparação fazem diferença.',
};
const F1_RULES: TechnicalRegulations = {
  open: { aero: true, chassis: true, engine: true, suspension: true, manufacturing: true },
  maxGainsPerArea: 5,
  summary: 'Desenvolvimento livre, com teto de gastos e horas de túnel de vento limitadas pela posição no campeonato anterior.',
};

export const REGULATIONS: Readonly<Record<CategoryId, TechnicalRegulations>> = {
  'kart-regional': KART_RULES,
  'kart-national': KART_RULES,
  'kart-international': KART_RULES,
  f4: SPEC_RULES,
  f3: SPEC_RULES,
  f2: SPEC_RULES,
  f1: F1_RULES,
};

/** Efeito de uma melhoria de cada área sobre o carro (em pontos de nota). */
export const DEV_EFFECTS: Readonly<Record<DevArea, { engine: number; chassis: number; reliability: number }>> = {
  aero: { engine: 0.2, chassis: 0.6, reliability: 0 },
  chassis: { engine: 0, chassis: 0.7, reliability: 0 },
  engine: { engine: 0.8, chassis: 0, reliability: 0 },
  suspension: { engine: 0, chassis: 0.4, reliability: 0.2 },
  manufacturing: { engine: 0, chassis: 0, reliability: 1 },
};

export const MANAGEMENT = {
  /** Pontos de pesquisa para a primeira melhoria de uma área; cada melhoria seguinte custa 35% a mais. */
  RESEARCH_BASE: 6,
  RESEARCH_GROWTH: 0.35,
  /** Pontos de pesquisa por etapa por nível do departamento de engenharia, e custo relativo, por ritmo. */
  SPEND: { low: { points: 0.5, cost: 0.5 }, medium: { points: 1, cost: 1 }, high: { points: 1.6, cost: 1.9 } } satisfies Record<ResearchSpend, { points: number; cost: number }>,
  /** Simulador: +6% de pesquisa por nível. Túnel de vento: +10% na aerodinâmica por nível. Fábrica: +10% em fabricação e −3% no custo por nível. */
  SIMULATOR_RESEARCH: 0.06,
  WIND_TUNNEL_AERO: 0.1,
  FACTORY_MANUFACTURING: 0.1,
  FACTORY_COST_DISCOUNT: 0.03,
  /** Simulador: +4% no desenvolvimento dos pilotos da equipe por nível. */
  SIMULATOR_DRIVER_DEV: 0.04,
  /** Horas de túnel na F1: 70% para a campeã, mais 5 pontos percentuais por posição. */
  WIND_TUNNEL_ALLOWANCE: { base: 0.7, perPosition: 0.05 },
  /** Manutenção anual das instalações: 12% do custo de um nível, por nível. */
  FACILITY_UPKEEP: 0.12,
  /** Departamentos: cada nível custa 45% do salário de referência por ano. */
  DEPARTMENT_SALARY: 0.45,
  /** Reputação da equipe: anda 40% do caminho até a nota da posição final. */
  REPUTATION_SPEED: 0.4,
  /** Caixa inicial ao assumir: 25% do custo operacional. */
  STARTING_BUDGET: 0.25,
  /** Reserva mínima que o dono deve deixar ao retirar dinheiro: 15% do custo operacional. */
  RESERVE: 0.15,
  /** Fundar uma equipe custa 60% do valor da mais fraca da categoria. */
  FOUNDING_COST: 0.6,
  /** O excedente de desenvolvimento sobre a média do grid perde 30% na virada do ano. */
  CARRY_OVER: 0.7,
  /** Chefe contratado: bônus de 20% do salário por meta cumprida; duas temporadas abaixo da meta, demissão. */
  TARGET_BONUS: 0.2,
  MAX_STRIKES: 2,
  SPONSOR_SLOTS: 3,
} as const;

export const STAFF_ROLE_EFFECTS: Readonly<Record<StaffRole, string>> = {
  principal: 'Comanda a operação: acelera o ganho de reputação da equipe e mantém a moral dos pilotos.',
  technicalDirector: 'Define o rumo técnico: é o maior peso na velocidade da pesquisa.',
  sportingDirector: 'Cuida de regulamento, patrocinadores e contratos: aumenta a receita de patrocínio e convence pilotos.',
  chiefEngineer: 'Extrai o máximo do carro: contribui para a pesquisa e para a confiança dos pilotos.',
  chiefMechanic: 'Comanda os boxes: paradas mais rápidas e menos erros.',
};

export const FACILITY_INFO: Readonly<Record<FacilityKey, { name: string; effect: string }>> = {
  simulator: { name: 'Simulador', effect: 'Acelera a pesquisa (+6% por nível) e o desenvolvimento dos pilotos (+4% por nível).' },
  windTunnel: { name: 'Túnel de vento', effect: 'Acelera a pesquisa de aerodinâmica (+10% por nível).' },
  factory: { name: 'Fábrica', effect: 'Acelera a fabricação (+10% por nível), barateia a pesquisa (−3% por nível) e melhora os boxes.' },
};

/** Patrocinadores de equipe (fictícios). */
export const TEAM_SPONSOR_NAMES = ['Orbital Bank', 'Nexa Telecom', 'Vértice Seguros', 'Lumen Energia', 'Kairo Logística', 'Atlas Aço', 'Boreal Bebidas', 'Sigma Cloud', 'Rota Combustíveis', 'Zênite Relógios', 'Polar Refrigeração', 'Vento Aéreas'] as const;

export const STAFF_FIRST_NAMES = ['Marco', 'Helena', 'Tomás', 'Ingrid', 'Paulo', 'Sofia', 'Andrea', 'Luca', 'Renata', 'Hugo', 'Claire', 'Otto', 'Beatriz', 'Diego', 'Nadia', 'Rui'] as const;
export const STAFF_LAST_NAMES = ['Bianchi', 'Moreau', 'Keller', 'Tavares', 'Lindqvist', 'Okafor', 'Ferraz', 'Novak', 'Haas', 'Ribeiro', 'Sato', 'Whitmore', 'Castel', 'Duarte', 'Varga', 'Monteiro'] as const;

/** Valor de mercado de uma equipe pela posição na ordem de forças (0 = a melhor, 9 = a pior). */
export function teamValue(categoryId: CategoryId, rank: number): number {
  const [top, bottom] = TEAM_ECONOMY[categoryId].value;
  const t = Math.min(1, Math.max(0, rank / 9));
  return Math.round((top + (bottom - top) * t) / 1000) * 1000;
}
