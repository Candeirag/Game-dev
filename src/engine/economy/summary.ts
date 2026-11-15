/**
 * Resumo da vida fora das pistas: os números que a tela "Vida" mostra em cada linha.
 * Só leitura: soma e conta o que já está no estado da carreira, com as mesmas contas que o
 * motor faz a cada etapa (aluguel, manutenção, parcelas). Não decide nada.
 */
import type { CareerState } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { ECONOMY, netWorth, stocksValue } from '../career/economy';
import { commercialSponsors } from '../career/sponsors';
import { familyAnnualCost, getPropertyDefinition, loansBalance } from './assets';

export interface LifeSummary {
  finance: {
    cash: number;
    netWorth: number;
    /** Resultado previsto de uma etapa, só para quem corre (salário e patrocínios menos vaga, custo de vida e treino). */
    perRound: number | null;
    debt: number;
  };
  sponsors: { count: number; perSeason: number; familySupport: number; lowestSatisfaction: number | null };
  property: { count: number; rented: number; value: number; perRound: number };
  business: { count: number; value: number; lastProfit: number };
  investments: { fixedIncome: number; equityFund: number; stocks: number; total: number; holdings: number };
  stakes: { count: number; value: number; lastDividend: number };
  family: { partner: string | null; married: boolean; children: number; racing: number; annualCost: number };
}

/** Resultado previsto de uma etapa para o piloto: o que entra menos o que sai, sem prêmios nem imprevistos. */
export function expectedRoundResult(career: CareerState): number {
  const category = getCategory(career.categoryId);
  const rounds = Math.max(1, career.calendar.length);
  const income =
    career.contract.salary +
    career.sponsors.reduce((sum, s) => sum + s.perSeason, 0) +
    (career.academy ? career.contract.seatCost * career.academy.supportShare : 0);
  const costs = career.contract.seatCost + category.economy.living;
  return (income - costs) / rounds - category.economy.trainingCost * ECONOMY.TRAINING_COST[career.trainingIntensity];
}

export function lifeSummary(career: CareerState): LifeSummary {
  const f = career.finance;
  const rounds = Math.max(1, career.calendar.length);
  const commercial = commercialSponsors(career.sponsors);
  const family = career.sponsors.find((s) => s.tier === 0);
  const rent = f.properties.reduce((sum, p) => {
    const def = getPropertyDefinition(p.catalogId);
    return sum + (p.use === 'rented' ? p.value * def.rentYield : 0) - p.value * def.upkeep;
  }, 0);
  const stocks = stocksValue(f);
  return {
    finance: {
      cash: f.cash,
      netWorth: netWorth(f),
      perRound: career.mode === 'driver' ? expectedRoundResult(career) : null,
      debt: loansBalance(f),
    },
    sponsors: {
      count: commercial.length,
      perSeason: commercial.reduce((sum, s) => sum + s.perSeason, 0),
      familySupport: family?.perSeason ?? 0,
      lowestSatisfaction: commercial.length > 0 ? Math.min(...commercial.map((s) => s.satisfaction)) : null,
    },
    property: {
      count: f.properties.length,
      rented: f.properties.filter((p) => p.use === 'rented').length,
      value: f.properties.reduce((sum, p) => sum + p.value, 0),
      perRound: rent / rounds,
    },
    business: {
      count: f.businesses.length,
      value: f.businesses.reduce((sum, b) => sum + b.value, 0),
      lastProfit: f.businesses.reduce((sum, b) => sum + b.lastProfit, 0),
    },
    investments: { fixedIncome: f.fixedIncome, equityFund: f.equityFund, stocks, total: f.fixedIncome + f.equityFund + stocks, holdings: f.stocks.length },
    stakes: {
      count: f.stakes.length,
      value: f.stakes.reduce((sum, s) => sum + s.value, 0),
      lastDividend: f.stakes.reduce((sum, s) => sum + s.lastDividend, 0),
    },
    family: {
      partner: career.family.partner ? career.family.partner.firstName : null,
      married: career.family.partner?.married ?? false,
      children: career.family.children.length,
      racing: career.family.children.filter((c) => c.stage === 'racing').length,
      annualCost: familyAnnualCost(career),
    },
  };
}
