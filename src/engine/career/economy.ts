/**
 * Economia do piloto: receitas e despesas por etapa, fechamento anual com
 * impostos, rendimento de investimentos e juros de dívida.
 *
 * Tudo passa por `post`, que registra o lançamento, atualiza o caixa e os
 * totais da temporada. O patrimônio é caixa + investimentos.
 */
import type { CareerState, Finance, LedgerKey, RaceEntryResult, SeasonFinanceReport, Transaction } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { createRng, gaussian, hashSeed } from '../rng';

export const ECONOMY = {
  /** Dinheiro inicial do piloto (economias da família). */
  STARTING_CASH: 30_000,
  /** Apoio anual da família nos três primeiros anos de carreira. */
  FAMILY_SUPPORT: 22_000,
  FAMILY_SUPPORT_SEASONS: 3,
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
  /** Renda fixa: 4% ao ano, sem risco. */
  FIXED_INCOME_RETURN: 0.04,
  /** Fundo de ações: média de 9% ao ano, desvio de 16% (pode perder). */
  EQUITY_MEAN: 0.09,
  EQUITY_SD: 0.16,
  /** Juros anuais sobre o saldo negativo. */
  LOAN_INTEREST: 0.14,
  /** Multiplicadores do custo de treino por intensidade. */
  TRAINING_COST: { light: 0.4, normal: 1, intense: 2.2 },
  TRANSACTION_LIMIT: 60,
} as const;

export function netWorth(finance: Finance): number {
  return finance.cash + finance.fixedIncome + finance.equityFund;
}

export function emptyFinance(cash: number): Finance {
  return { cash, fixedIncome: 0, equityFund: 0, seasonTotals: {}, transactions: [], reports: [] };
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

/** Lançamentos de uma etapa: parcelas anuais divididas pelo número de etapas, mais bônus e contas. */
export function settleRound(career: CareerState, round: number, entry: RaceEntryResult | null): Finance {
  const category = getCategory(career.categoryId);
  const { contract, season } = career;
  const share = 1 / career.calendar.length;
  let f = career.finance;

  f = post(f, season, round, 'salary', contract.salary * share, 'Salário');
  for (const sponsor of career.sponsors) {
    f = post(f, season, round, 'sponsors', sponsor.perSeason * share, sponsor.name);
    if (entry && entry.status === 'finished' && entry.position <= 3) f = post(f, season, round, 'bonus', sponsor.podiumBonus, `Bônus de pódio: ${sponsor.name}`);
  }
  if (entry && entry.status === 'finished') {
    if (entry.position === 1) f = post(f, season, round, 'bonus', contract.bonuses.win, 'Bônus por vitória');
    else if (entry.position <= 3) f = post(f, season, round, 'bonus', contract.bonuses.podium, 'Bônus por pódio');
  }
  if (entry) f = post(f, season, round, 'bonus', contract.bonuses.point * entry.points, 'Bônus por pontos');

  const seat = contract.seatCost * share;
  f = post(f, season, round, 'seat', -seat, 'Parcela da vaga');
  if (career.academy) f = post(f, season, round, 'academy', seat * career.academy.supportShare, `Apoio da ${career.academy.name}`);
  f = post(f, season, round, 'living', -category.economy.living * share, 'Custo de vida e estrutura');
  f = post(f, season, round, 'training', -category.economy.trainingCost * ECONOMY.TRAINING_COST[career.trainingIntensity], 'Programa de treino');
  if (entry && entry.damage > 0) f = post(f, season, round, 'damage', -category.economy.damageBill * Math.min(1, entry.damage), 'Conta de danos');
  return f;
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
  const taxable = Math.max(0, (t.salary ?? 0) + (t.bonus ?? 0) + (t.sponsors ?? 0) + (t.academy ?? 0) + (t.seat ?? 0));
  const tax = incomeTax(taxable);
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

  const report: SeasonFinanceReport = { season, year, totals: { ...f.seasonTotals }, taxableIncome: taxable, tax, investmentReturn, loanInterest, netWorthEnd: netWorth(f) };
  return { finance: { ...f, seasonTotals: {}, reports: [...f.reports, report].slice(-12) }, report };
}

export type InvestmentProduct = 'fixedIncome' | 'equityFund';

/** Aplica (valor positivo) ou resgata (valor negativo) de um investimento. */
export function moveInvestment(finance: Finance, product: InvestmentProduct, amount: number): Finance {
  const value = Math.round(amount);
  if (value > 0 && value > finance.cash) throw new Error('Saldo em caixa insuficiente para a aplicação.');
  if (value < 0 && -value > finance[product]) throw new Error('Valor de resgate maior que o saldo aplicado.');
  return { ...finance, cash: finance.cash - value, [product]: finance[product] + value };
}
