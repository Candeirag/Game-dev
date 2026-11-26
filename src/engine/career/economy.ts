/**
 * Economia do piloto: receitas e despesas por etapa, fechamento anual com
 * impostos, rendimento de investimentos e juros de dívida.
 *
 * Tudo passa por `post`, que registra o lançamento, atualiza o caixa e os
 * totais da temporada. O restante do patrimônio (ações, imóveis, empresas,
 * participações e empréstimos) fica em economy/assets.ts.
 */
import { HUB_RULES, RUNNING_COSTS, SIDE_JOBS } from '@/config/balance';
import type { CareerState, CategoryId, Finance, HubId, Investor, LedgerKey, RaceEntryResult, SeasonFinanceReport, Transaction } from '@/domain/schemas';
import { LIFESTYLE_RULES, initialStockPrices, STOCKS } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { getHub } from '@/data/hubs';
import { createRng, gaussian, hashSeed } from '../rng';

export const ECONOMY = {
  /** Dinheiro inicial do piloto (economias da família). */
  STARTING_CASH: 30_000,
  /** Apoio anual da família nos cinco primeiros anos de carreira. */
  FAMILY_SUPPORT: 24_000,
  FAMILY_SUPPORT_SEASONS: 5,
  /**
   * Imposto de renda progressivo sobre a renda tributável da temporada
   * (salário + bônus + patrocínios − custo da vaga): faixas e alíquotas.
   */
  TAX_BRACKETS: [
    { upTo: 40_000, rate: 0 },
    { upTo: 300_000, rate: 0.15 },
    { upTo: 3_000_000, rate: 0.275 },
    { upTo: Infinity, rate: 0.37 },
  ],
  /**
   * Retornos reais (o jogo não tem inflação). Renda fixa: 2,5% ao ano, sem
   * risco. Fundo de ações: média de 4% ao ano, desvio de 15% (pode perder);
   * por causa da oscilação, o resultado típico de longo prazo fica perto do da
   * renda fixa, com chance de bem mais e de bem menos.
   */
  FIXED_INCOME_RETURN: 0.025,
  EQUITY_MEAN: 0.04,
  EQUITY_SD: 0.15,
  /** Juros anuais sobre o saldo negativo. */
  LOAN_INTEREST: 0.14,
  /** Multiplicadores do custo de treino por intensidade. */
  TRAINING_COST: { light: 0.4, normal: 1, intense: 2.2 },
  TRANSACTION_LIMIT: 60,
} as const;

/** Valor de mercado da carteira de ações. */
export function stocksValue(finance: Finance): number {
  return finance.stocks.reduce((sum, h) => sum + h.shares * (finance.stockPrices[h.stockId] ?? STOCKS.find((s) => s.id === h.stockId)?.startPrice ?? 0), 0);
}

/**
 * Patrimônio líquido: caixa, aplicações, ações, imóveis, empresas e
 * participações em equipes, menos os empréstimos. Uma equipe da qual o
 * jogador é dono entra à parte (ver `ownedTeamValue`, na gestão).
 */
export function netWorth(finance: Finance): number {
  const sum = (items: readonly { value: number }[]) => items.reduce((total, item) => total + item.value, 0);
  const loans = finance.loans.reduce((total, l) => total + l.balance, 0);
  return Math.round(
    finance.cash +
      finance.fixedIncome +
      finance.equityFund +
      stocksValue(finance) +
      sum(finance.properties) +
      sum(finance.businesses) +
      sum(finance.stakes) -
      loans,
  );
}

export function emptyFinance(cash: number): Finance {
  return {
    cash,
    fixedIncome: 0,
    equityFund: 0,
    seasonTotals: {},
    transactions: [],
    reports: [],
    stocks: [],
    stockPrices: initialStockPrices(),
    properties: [],
    businesses: [],
    stakes: [],
    loans: [],
    lifestyle: 'frugal',
  };
}

/** Registra um lançamento (positivo = receita, negativo = despesa). */
export function post(finance: Finance, season: number, round: number, key: LedgerKey, amount: number, label: string): Finance {
  const value = Math.round(amount);
  if (value === 0) return finance;
  const transaction: Transaction = { season, round, key, amount: value, label };
  return {
    ...finance,
    cash: finance.cash + value,
    seasonTotals: { ...finance.seasonTotals, [key]: (finance.seasonTotals[key] ?? 0) + value },
    transactions: [transaction, ...finance.transactions].slice(0, ECONOMY.TRANSACTION_LIMIT),
  };
}

/**
 * Custos de correr uma temporada num campeonato, fora a vaga: viagens, equipamento e, para quem
 * mora num polo fora do país, o aluguel (Fase 3 da grande atualização). É o que cada etapa lança
 * em parcelas e o que a equipe considera ao perguntar se o piloto banca o ano.
 */
export function seasonRunningCosts(categoryId: CategoryId, hubId: HubId): { travel: number; equipment: number; housing: number; total: number } {
  const travel = RUNNING_COSTS.TRAVEL_PER_ROUND[categoryId] * getCategory(categoryId).rounds;
  const equipment = RUNNING_COSTS.EQUIPMENT_PER_SEASON[categoryId];
  const housing = HUB_RULES.RENT_PER_SEASON[hubId];
  return { travel, equipment, housing, total: travel + equipment + housing };
}

/** Patrocínio que conta como ganho para o investidor: o que sobra depois de pagar a vaga. */
export function investorSponsorBase(sponsorship: number, netSeat: number): number {
  return Math.max(0, sponsorship - netSeat);
}

/**
 * A parte do investidor: a fatia dele sobre um ganho do piloto (salário, bônus ou sobra de patrocínio). O
 * lançamento sai do caixa na mesma hora e fica somado em `received`, para a tela de finanças
 * mostrar quanto ele já levou.
 */
export function payInvestor(
  finance: Finance,
  investor: Investor | null,
  season: number,
  round: number,
  earnings: number,
): { finance: Finance; investor: Investor | null } {
  const cut = investor ? Math.round(Math.max(0, earnings) * investor.share) : 0;
  if (!investor || cut === 0) return { finance, investor };
  return {
    finance: post(finance, season, round, 'investor', -cut, `Parte de ${investor.name} (${Math.round(investor.share * 100)}% dos ganhos)`),
    investor: { ...investor, received: investor.received + cut },
  };
}

/** Lançamentos de uma etapa: parcelas anuais divididas pelo número de etapas, mais bônus e contas. */
export function settleRound(career: CareerState, round: number, entry: RaceEntryResult | null): { finance: Finance; investor: Investor | null } {
  const category = getCategory(career.categoryId);
  const { contract, season } = career;
  const share = 1 / career.calendar.length;
  let f = career.finance;
  // Ganhos da etapa sobre os quais o investidor tem parte: salário, bônus e o que sobra dos
  // patrocínios comerciais depois de pagar a parcela da vaga (o apoio da família não entra).
  let earnings = 0;
  let sponsorship = 0;
  const earn = (key: LedgerKey, amount: number, label: string) => {
    f = post(f, season, round, key, amount, label);
    earnings += Math.round(amount);
  };

  earn('salary', contract.salary * share, 'Salário');
  for (const sponsor of career.sponsors) {
    f = post(f, season, round, 'sponsors', sponsor.perSeason * share, sponsor.name);
    if (sponsor.tier > 0) sponsorship += sponsor.perSeason * share;
    if (entry && entry.status === 'finished' && entry.position <= 3) earn('bonus', sponsor.podiumBonus, `Bônus de pódio: ${sponsor.name}`);
  }
  if (entry && entry.status === 'finished') {
    if (entry.position === 1) earn('bonus', contract.bonuses.win, 'Bônus por vitória');
    else if (entry.position <= 3) earn('bonus', contract.bonuses.podium, 'Bônus por pódio');
  }
  if (entry) earn('bonus', contract.bonuses.point * entry.points, 'Bônus por pontos');
  const netSeat = contract.seatCost * share * (1 - (career.academy?.supportShare ?? 0));
  const paid = payInvestor(f, career.investor, season, round, earnings + investorSponsorBase(sponsorship, netSeat));
  f = paid.finance;

  // Trabalho paralelo: o dinheiro entra a cada etapa (o tempo de treino que ele tira está em `economyTrainingFactor`).
  const job = career.sideJob === 'none' ? null : SIDE_JOBS[career.sideJob];
  if (job) f = post(f, season, round, 'job', job.perRound, career.sideJob === 'instructor' ? 'Aulas como instrutor de kart' : 'Trabalho na oficina');

  const seat = contract.seatCost * share;
  f = post(f, season, round, 'seat', -seat, 'Parcela da vaga');
  if (career.academy) f = post(f, season, round, 'academy', seat * career.academy.supportShare, `Apoio da ${career.academy.name}`);
  f = post(f, season, round, 'living', -category.economy.living * LIFESTYLE_RULES[f.lifestyle].cost * share, 'Custo de vida e estrutura');
  // Quem usa o próprio galpão como oficina treina gastando 20% menos.
  const ownWorkshop = f.properties.some((p) => p.catalogId === 'galpao' && p.use === 'personal') ? 0.8 : 1;
  f = post(f, season, round, 'training', -category.economy.trainingCost * ECONOMY.TRAINING_COST[career.trainingIntensity] * ownWorkshop, 'Programa de treino');
  // Correr custa mais que a vaga: a viagem de cada etapa, o equipamento e o aluguel de quem mora num polo fora do país.
  const running = seasonRunningCosts(category.id, career.hub.id);
  f = post(f, season, round, 'travel', -RUNNING_COSTS.TRAVEL_PER_ROUND[category.id], 'Viagem da etapa');
  f = post(f, season, round, 'equipment', -running.equipment * share, 'Equipamento');
  f = post(f, season, round, 'housing', -running.housing * share, `Aluguel: ${getHub(career.hub.id).name}`);
  if (entry && entry.damage > 0)
    f = post(f, season, round, 'damage', -category.economy.damageBill * Math.min(1, entry.damage) * (1 - (job?.damageDiscount ?? 0)), 'Conta de danos');
  return { finance: f, investor: paid.investor };
}

export function incomeTax(taxable: number): number {
  let tax = 0;
  let floor = 0;
  for (const bracket of ECONOMY.TAX_BRACKETS) {
    if (taxable <= floor) break;
    tax += (Math.min(taxable, bracket.upTo) - floor) * bracket.rate;
    floor = bracket.upTo;
  }
  return Math.round(tax);
}

/**
 * Fechamento da temporada: imposto de renda, rendimento dos investimentos e
 * juros da dívida. O retorno do fundo de ações é sorteado pela semente da
 * carreira (uma normal com a média e o desvio definidos acima, limitada a
 * −35% e +50%).
 */
export function closeSeasonFinance(career: CareerState): { finance: Finance; report: SeasonFinanceReport } {
  const { season, year } = career;
  const rounds = career.calendar.length;
  let f = career.finance;
  const t = f.seasonTotals;
  // O que o investidor levou na temporada (o extrato soma no mesmo lançamento o aporte, que não é renda).
  const investorPaid = f.transactions.filter((x) => x.season === season && x.key === 'investor' && x.amount < 0).reduce((sum, x) => sum - x.amount, 0);
  // Renda do trabalho (líquida do custo da vaga, das viagens, do equipamento, do aluguel do polo e da
  // parte do investidor) mais a renda do patrimônio: dividendos, aluguéis e lucro das empresas. Os
  // cachês do ano de transição (Fase 6) são renda do trabalho. O aporte do investidor e a vaquinha
  // não são renda: não pagam imposto.
  const taxable = Math.max(
    0,
    (t.salary ?? 0) +
      (t.bonus ?? 0) +
      (t.sponsors ?? 0) +
      (t.academy ?? 0) +
      (t.seat ?? 0) +
      (t.dividends ?? 0) +
      (t.rent ?? 0) +
      (t.business ?? 0) +
      (t.job ?? 0) +
      (t.transition ?? 0) +
      (t.travel ?? 0) +
      (t.equipment ?? 0) +
      (t.housing ?? 0) -
      investorPaid,
  );
  // Residência fiscal em Mônaco (cobertura de uso próprio): 25% a menos de imposto de renda.
  const residence = f.properties.some((p) => p.catalogId === 'cobertura-monaco' && p.use === 'personal') ? 0.75 : 1;
  const tax = Math.round(incomeTax(taxable) * residence);
  f = post(f, season, rounds, 'tax', -tax, 'Imposto de renda');

  const equityRate = Math.min(0.5, Math.max(-0.35, ECONOMY.EQUITY_MEAN + gaussian(createRng(hashSeed(career.seed, season, 'equity'))) * ECONOMY.EQUITY_SD));
  const fixedGain = Math.round(f.fixedIncome * ECONOMY.FIXED_INCOME_RETURN);
  const equityGain = Math.round(f.equityFund * equityRate);
  const investmentReturn = fixedGain + equityGain;
  f = {
    ...f,
    fixedIncome: f.fixedIncome + fixedGain,
    equityFund: Math.max(0, f.equityFund + equityGain),
    seasonTotals: { ...f.seasonTotals, investment: (f.seasonTotals.investment ?? 0) + investmentReturn },
  };

  const loanInterest = f.cash < 0 ? Math.round(-f.cash * ECONOMY.LOAN_INTEREST) : 0;
  f = post(f, season, rounds, 'interest', -loanInterest, 'Juros da dívida');

  const report: SeasonFinanceReport = {
    season,
    year,
    totals: { ...f.seasonTotals },
    taxableIncome: taxable,
    tax,
    investmentReturn,
    loanInterest,
    netWorthEnd: netWorth(f),
  };
  return { finance: { ...f, seasonTotals: {}, reports: [...f.reports, report].slice(-12) }, report };
}

export type InvestmentProduct = 'fixedIncome' | 'equityFund';

export interface InvestmentMove {
  product: InvestmentProduct;
  /** Positivo aplica; negativo resgata. */
  amount: number;
}

/** Aplica (valor positivo) ou resgata (valor negativo) de um investimento. */
export function moveInvestment(finance: Finance, product: InvestmentProduct, amount: number): Finance {
  const value = Math.round(amount);
  if (value > 0 && value > finance.cash) throw new Error('Saldo em caixa insuficiente para a aplicação.');
  if (value < 0 && -value > finance[product]) throw new Error('Valor de resgate maior que o saldo aplicado.');
  return { ...finance, cash: finance.cash - value, [product]: finance[product] + value };
}
