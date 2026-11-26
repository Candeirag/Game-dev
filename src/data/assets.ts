/**
 * Catálogo do patrimônio pessoal: ações, imóveis e empresas.
 *
 * Tudo aqui é fictício, mas com proporções plausíveis. Os números foram
 * escolhidos para que cada classe de ativo tenha um papel diferente:
 * - ações: liquidez imediata e risco de mercado (o preço muda a cada etapa);
 * - imóveis: renda estável, valorização lenta e custo de manutenção;
 * - empresas: retorno alto para quem tem reputação, e baixo para quem não tem;
 * - participações em equipes: dependem do resultado esportivo (ver management.ts).
 */
import type { Lifestyle } from '@/domain/schemas';

export interface StockDefinition {
  id: string;
  name: string;
  sector: string;
  startPrice: number;
  /** Retorno médio anual esperado (sem contar dividendos). */
  drift: number;
  /** Volatilidade anual (desvio-padrão do retorno). */
  volatility: number;
  /** Dividendo anual, como fração do preço no fechamento da temporada. */
  dividendYield: number;
}

/**
 * Seis ações com perfis distintos: o retorno esperado cresce com o risco, e as
 * empresas maduras compensam a valorização menor com dividendos.
 *
 * O jogo não tem inflação (vagas, salários e equipes custam sempre o mesmo),
 * então estes são retornos reais. O retorno total (valorização + dividendos)
 * vai de 3,5% a 6% ao ano. Com números de bolsa "de verdade" (10% ou mais), o
 * patrimônio de uma geração multiplicava por dezenas até a seguinte e o
 * dinheiro deixava de importar (medido em tests/calibration/economy.calib.ts).
 */
export const STOCKS: readonly StockDefinition[] = [
  { id: 'banco-box', name: 'Banco Box', sector: 'Banco', startPrice: 42, drift: 0, volatility: 0.14, dividendYield: 0.035 },
  { id: 'tecnopneu', name: 'Tecnopneu', sector: 'Pneus', startPrice: 28, drift: 0.005, volatility: 0.13, dividendYield: 0.03 },
  { id: 'apex-energia', name: 'Apex Energia', sector: 'Energia', startPrice: 65, drift: 0.015, volatility: 0.2, dividendYield: 0.025 },
  { id: 'veloce-motors', name: 'Veloce Motors', sector: 'Montadora', startPrice: 120, drift: 0.025, volatility: 0.24, dividendYield: 0.02 },
  { id: 'pista-midia', name: 'Pista Mídia', sector: 'Mídia esportiva', startPrice: 18, drift: 0.045, volatility: 0.3, dividendYield: 0.005 },
  { id: 'grid-tech', name: 'Grid Tech', sector: 'Tecnologia', startPrice: 85, drift: 0.06, volatility: 0.36, dividendYield: 0 },
];

export function initialStockPrices(): Record<string, number> {
  return Object.fromEntries(STOCKS.map((s) => [s.id, s.startPrice]));
}

export interface PropertyDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Aluguel anual, como fração do valor do imóvel. */
  rentYield: number;
  /** Manutenção e condomínio por ano, como fração do valor. */
  upkeep: number;
  /** Valorização média anual e desvio. */
  appreciation: number;
  appreciationSd: number;
  /** Benefício do uso próprio (texto para a interface; a regra fica em assets.ts). */
  personalPerk: string;
}

export const PROPERTIES: readonly PropertyDefinition[] = [
  {
    id: 'apartamento',
    name: 'Apartamento na cidade',
    description: 'Dois quartos perto do centro. Fácil de alugar.',
    price: 180_000,
    rentYield: 0.05,
    upkeep: 0.01,
    appreciation: 0.015,
    appreciationSd: 0.04,
    personalPerk: 'Morar nele dá +0,3 de moral por etapa.',
  },
  {
    id: 'galpao',
    name: 'Galpão comercial',
    description: 'Oficina e depósito alugados a equipes de base.',
    price: 320_000,
    rentYield: 0.065,
    upkeep: 0.015,
    appreciation: 0.01,
    appreciationSd: 0.04,
    personalPerk: 'Usado como oficina própria: o treino custa 20% menos.',
  },
  {
    id: 'casa-campo',
    name: 'Casa de campo',
    description: 'Refúgio longe das pistas, bom para a família.',
    price: 450_000,
    rentYield: 0.04,
    upkeep: 0.012,
    appreciation: 0.015,
    appreciationSd: 0.05,
    personalPerk: 'Uso próprio: +0,5 de moral por etapa e +3 na relação com a família por ano.',
  },
  {
    id: 'kartodromo',
    name: 'Kartódromo',
    description: 'Pista de kart com escola e aluguel de karts.',
    price: 1_200_000,
    rentYield: 0.07,
    upkeep: 0.03,
    appreciation: 0.01,
    appreciationSd: 0.05,
    personalPerk: 'A formação dos filhos no kart custa metade e rende 25% mais.',
  },
  {
    id: 'cobertura-monaco',
    name: 'Cobertura em Mônaco',
    description: 'Endereço dos pilotos de ponta.',
    price: 4_500_000,
    rentYield: 0.03,
    upkeep: 0.01,
    appreciation: 0.025,
    appreciationSd: 0.06,
    personalPerk: 'Residência fiscal: o imposto de renda cai 25%.',
  },
];

export interface BusinessDefinition {
  id: string;
  name: string;
  description: string;
  /** Investimento para abrir (nível 1). Cada nível seguinte custa o mesmo valor. */
  cost: number;
  /** Lucro anual por nível com reputação 36 e ano mediano. */
  baseProfit: number;
  minReputation: number;
}

/**
 * O lucro depende da fama do dono: lucro = base × nível × (0,4 + reputação/60)
 * × sorte do ano (0,7 a 1,3). Um piloto desconhecido mal empata; um campeão de
 * Grand Prix Mundial dobra o retorno.
 */
export const BUSINESSES: readonly BusinessDefinition[] = [
  { id: 'marca', name: 'Marca de roupas', description: 'Linha de bonés e camisetas com o seu nome.', cost: 80_000, baseProfit: 9_000, minReputation: 15 },
  { id: 'escola', name: 'Escola de pilotagem', description: 'Cursos de kart e de pilotagem esportiva.', cost: 150_000, baseProfit: 18_000, minReputation: 20 },
  {
    id: 'simuladores',
    name: 'Centro de simuladores',
    description: 'Simuladores profissionais alugados por hora.',
    cost: 280_000,
    baseProfit: 32_000,
    minReputation: 30,
  },
  { id: 'agencia', name: 'Agência de pilotos', description: 'Gestão de carreira de jovens talentos.', cost: 450_000, baseProfit: 55_000, minReputation: 45 },
];

/**
 * Padrão de vida: multiplicador do custo de vida, efeito por etapa na moral e
 * efeito anual na relação com o parceiro.
 */
export const LIFESTYLE_RULES: Readonly<Record<Lifestyle, { cost: number; morale: number; relationship: number }>> = {
  frugal: { cost: 1, morale: 0, relationship: -1 },
  comfortable: { cost: 1.8, morale: 0.4, relationship: 2 },
  luxury: { cost: 3.5, morale: 0.8, relationship: 4 },
};

export const ASSET_RULES = {
  /** Imposto sobre o ganho de capital na venda de ações, imóveis, empresas e participações. */
  CAPITAL_GAINS_TAX: 0.15,
  /** Imposto anual sobre o valor dos imóveis. */
  PROPERTY_TAX: 0.006,
  /** Corretagem na venda de um imóvel. */
  PROPERTY_SALE_FEE: 0.05,
  /** Correlação das ações com o mercado: metade do movimento é comum a todas. */
  MARKET_WEIGHT: 0.6,
  IDIOSYNCRATIC_WEIGHT: 0.8,
  /** Empréstimo bancário: juros anuais e prazos oferecidos (em temporadas). */
  LOAN_RATE: 0.09,
  LOAN_TERMS: [2, 4, 6],
  /** Limite de crédito: 40% dos ativos mais 1,5 vez a renda anual contratada. */
  LOAN_ASSET_SHARE: 0.4,
  LOAN_INCOME_MULTIPLE: 1.5,
  /** Ágio pago para comprar uma participação e fatias oferecidas. */
  STAKE_PREMIUM: 1.1,
  STAKE_SHARES: [0.05, 0.1, 0.25],
  /**
   * Venda de empresa: 60% do investido mais 2 anos do último lucro. Mesmo com
   * a reputação no máximo, o valor mal chega ao que foi investido: uma empresa
   * serve para dar renda, não para ser revendida com lucro.
   */
  BUSINESS_VALUE_INVESTED: 0.6,
  BUSINESS_VALUE_PROFIT_YEARS: 2,
  /** Participações: a campeã distribui 6% do seu valor; cada posição abaixo, 0,8 ponto a menos (a última pede 1,2% de aporte). */
  STAKE_DIVIDEND_TOP: 0.06,
  STAKE_DIVIDEND_STEP: 0.008,
  /** Imposto de herança sobre o que passa do valor isento; doação em vida paga menos. */
  INHERITANCE_TAX: 0.08,
  HANDOVER_TAX: 0.04,
  INHERITANCE_EXEMPT: 100_000,
  /** Parte da herança que vai para cada irmão do herdeiro escolhido, até SIBLING_SHARE_MAX irmãos. */
  SIBLING_SHARE: 0.15,
  SIBLING_SHARE_MAX: 3,
} as const;
