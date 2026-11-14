/**
 * Patrimônio pessoal: ações, imóveis, empresas, participações em equipes,
 * empréstimos e padrão de vida.
 *
 * Como o resto da economia, tudo passa por `post` (economy.ts): cada compra,
 * venda, aluguel, dividendo e parcela vira um lançamento no extrato. As
 * funções recebem a carreira e devolvem uma nova; erros de regra viram
 * exceções com a mensagem que a interface mostra.
 *
 * Ritmo:
 * - a cada etapa (`settleAssetsRound`): cotações das ações, aluguel e
 *   manutenção dos imóveis, parcelas dos empréstimos e custos com os filhos;
 * - no fim da temporada (`closeAssetsYear`): dividendos, valorização e imposto
 *   dos imóveis, lucro das empresas, dividendos das participações e
 *   amortização dos empréstimos.
 */
import type { Business, CareerState, Finance, Lifestyle, Loan, Property, StockHolding, TeamStake } from '@/domain/schemas';
import { ASSET_RULES, BUSINESSES, PROPERTIES, STOCKS, type BusinessDefinition, type PropertyDefinition, type StockDefinition } from '@/data/assets';
import { FAMILY } from '@/data/family';
import { teamValue } from '@/data/management';
import { initialTeams } from '@/data/teams';
import { computeTeamStandings } from '../championship/standings';
import { netWorth, post } from '../career/economy';
import { createRng, gaussian, hashSeed } from '../rng';
import { rankTeams } from '../world/generation';
import { money } from '../career/selectors';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function getStock(id: string): StockDefinition {
  const stock = STOCKS.find((s) => s.id === id);
  if (!stock) throw new Error('Ação desconhecida.');
  return stock;
}
export function getPropertyDefinition(id: string): PropertyDefinition {
  const def = PROPERTIES.find((p) => p.id === id);
  if (!def) throw new Error('Imóvel desconhecido.');
  return def;
}
export function getBusinessDefinition(id: string): BusinessDefinition {
  const def = BUSINESSES.find((b) => b.id === id);
  if (!def) throw new Error('Empresa desconhecida.');
  return def;
}

export function stockPrice(finance: Finance, stockId: string): number {
  return finance.stockPrices[stockId] ?? getStock(stockId).startPrice;
}

/** O imóvel está em uso próprio? (Os benefícios de cada um ficam nos pontos em que agem.) */
export function hasPersonalProperty(finance: Finance, catalogId: string): boolean {
  return finance.properties.some((p) => p.catalogId === catalogId && p.use === 'personal');
}

function round(career: CareerState): number {
  return Math.min(career.calendar.length, career.nextRoundIndex + 1);
}

function requireCash(finance: Finance, amount: number) {
  if (amount > finance.cash) throw new Error('Saldo em caixa insuficiente.');
}

/** Imposto sobre o ganho de capital de uma venda (zero se houve prejuízo). */
function capitalGainsTax(proceeds: number, cost: number): number {
  return Math.max(0, Math.round((proceeds - cost) * ASSET_RULES.CAPITAL_GAINS_TAX));
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

export function buyStock(career: CareerState, stockId: string, shares: number): CareerState {
  if (!Number.isInteger(shares) || shares <= 0) throw new Error('Informe uma quantidade inteira de ações.');
  const stock = getStock(stockId);
  const price = stockPrice(career.finance, stockId);
  const total = Math.round(price * shares);
  requireCash(career.finance, total);
  const held = career.finance.stocks.find((h) => h.stockId === stockId);
  const holding: StockHolding = held
    ? { stockId, shares: held.shares + shares, avgCost: (held.avgCost * held.shares + price * shares) / (held.shares + shares) }
    : { stockId, shares, avgCost: price };
  const finance = post(career.finance, career.season, round(career), 'assets', -total, `Compra de ${shares} ações da ${stock.name}`);
  return { ...career, finance: { ...finance, stocks: [...finance.stocks.filter((h) => h.stockId !== stockId), holding] } };
}

export function sellStock(career: CareerState, stockId: string, shares: number): CareerState {
  const held = career.finance.stocks.find((h) => h.stockId === stockId);
  if (!held || !Number.isInteger(shares) || shares <= 0 || shares > held.shares) throw new Error('Quantidade de ações inválida.');
  const stock = getStock(stockId);
  const proceeds = Math.round(stockPrice(career.finance, stockId) * shares);
  const tax = capitalGainsTax(proceeds, held.avgCost * shares);
  let finance = post(career.finance, career.season, round(career), 'assets', proceeds, `Venda de ${shares} ações da ${stock.name}`);
  finance = post(finance, career.season, round(career), 'tax', -tax, 'Imposto sobre ganho de capital');
  const rest = held.shares - shares;
  return { ...career, finance: { ...finance, stocks: rest > 0 ? finance.stocks.map((h) => (h.stockId === stockId ? { ...h, shares: rest } : h)) : finance.stocks.filter((h) => h.stockId !== stockId) } };
}

/**
 * Cotações depois de uma etapa: movimento browniano geométrico com o retorno
 * e a volatilidade de cada ação, em um passo de 1/N de ano (N = etapas da
 * temporada). Parte do movimento é do mercado inteiro, para que as ações
 * subam e caiam juntas nas crises.
 */
export function stepStockPrices(prices: Readonly<Record<string, number>>, careerSeed: number, season: number, roundNumber: number, roundsInSeason: number): Record<string, number> {
  const dt = 1 / Math.max(1, roundsInSeason);
  const market = gaussian(createRng(hashSeed(careerSeed, season, roundNumber, 'market')));
  const next: Record<string, number> = {};
  for (const stock of STOCKS) {
    const own = gaussian(createRng(hashSeed(careerSeed, season, roundNumber, 'stock', stock.id)));
    const z = ASSET_RULES.MARKET_WEIGHT * market + ASSET_RULES.IDIOSYNCRATIC_WEIGHT * own;
    const growth = Math.exp((stock.drift - (stock.volatility * stock.volatility) / 2) * dt + stock.volatility * Math.sqrt(dt) * z);
    const price = (prices[stock.id] ?? stock.startPrice) * growth;
    next[stock.id] = Math.max(0.5, Math.round(price * 100) / 100);
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Imóveis                                                             */
/* ------------------------------------------------------------------ */

export function buyProperty(career: CareerState, catalogId: string, use: Property['use']): CareerState {
  const def = getPropertyDefinition(catalogId);
  if (career.finance.properties.some((p) => p.catalogId === catalogId)) throw new Error('Você já tem este imóvel.');
  requireCash(career.finance, def.price);
  const property: Property = { id: `prop-${catalogId}-s${career.season}`, catalogId, name: def.name, cost: def.price, value: def.price, purchasedSeason: career.season, use };
  const finance = post(career.finance, career.season, round(career), 'assets', -def.price, `Compra: ${def.name}`);
  return { ...career, finance: { ...finance, properties: [...finance.properties, property] } };
}

export function setPropertyUse(career: CareerState, propertyId: string, use: Property['use']): CareerState {
  if (!career.finance.properties.some((p) => p.id === propertyId)) throw new Error('Imóvel não encontrado.');
  return { ...career, finance: { ...career.finance, properties: career.finance.properties.map((p) => (p.id === propertyId ? { ...p, use } : p)) } };
}

export function sellProperty(career: CareerState, propertyId: string): CareerState {
  const property = career.finance.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error('Imóvel não encontrado.');
  const proceeds = Math.round(property.value * (1 - ASSET_RULES.PROPERTY_SALE_FEE));
  let finance = post(career.finance, career.season, round(career), 'assets', proceeds, `Venda: ${property.name}`);
  finance = post(finance, career.season, round(career), 'tax', -capitalGainsTax(proceeds, property.cost), 'Imposto sobre ganho de capital');
  return { ...career, finance: { ...finance, properties: finance.properties.filter((p) => p.id !== propertyId) } };
}

/* ------------------------------------------------------------------ */
/* Empresas                                                            */
/* ------------------------------------------------------------------ */

export function businessValue(business: Pick<Business, 'invested' | 'lastProfit'>): number {
  return Math.max(0, Math.round(business.invested * ASSET_RULES.BUSINESS_VALUE_INVESTED + business.lastProfit * ASSET_RULES.BUSINESS_VALUE_PROFIT_YEARS));
}

export function openBusiness(career: CareerState, catalogId: string): CareerState {
  const def = getBusinessDefinition(catalogId);
  if (career.finance.businesses.some((b) => b.catalogId === catalogId)) throw new Error('Você já tem esta empresa.');
  if (career.reputation < def.minReputation) throw new Error(`É preciso reputação ${def.minReputation} para abrir esta empresa.`);
  requireCash(career.finance, def.cost);
  const business: Business = { id: `biz-${catalogId}-s${career.season}`, catalogId, name: def.name, invested: def.cost, value: businessValue({ invested: def.cost, lastProfit: 0 }), level: 1, foundedSeason: career.season, lastProfit: 0 };
  const finance = post(career.finance, career.season, round(career), 'assets', -def.cost, `Abertura: ${def.name}`);
  return { ...career, finance: { ...finance, businesses: [...finance.businesses, business] } };
}

export function upgradeBusiness(career: CareerState, businessId: string): CareerState {
  const business = career.finance.businesses.find((b) => b.id === businessId);
  if (!business) throw new Error('Empresa não encontrada.');
  if (business.level >= 3) throw new Error('A empresa já está no nível máximo.');
  const def = getBusinessDefinition(business.catalogId);
  requireCash(career.finance, def.cost);
  const invested = business.invested + def.cost;
  const finance = post(career.finance, career.season, round(career), 'assets', -def.cost, `Expansão: ${business.name}`);
  return { ...career, finance: { ...finance, businesses: finance.businesses.map((b) => (b.id === businessId ? { ...b, level: b.level + 1, invested, value: businessValue({ invested, lastProfit: b.lastProfit }) } : b)) } };
}

export function sellBusiness(career: CareerState, businessId: string): CareerState {
  const business = career.finance.businesses.find((b) => b.id === businessId);
  if (!business) throw new Error('Empresa não encontrada.');
  let finance = post(career.finance, career.season, round(career), 'assets', business.value, `Venda: ${business.name}`);
  finance = post(finance, career.season, round(career), 'tax', -capitalGainsTax(business.value, business.invested), 'Imposto sobre ganho de capital');
  return { ...career, finance: { ...finance, businesses: finance.businesses.filter((b) => b.id !== businessId) } };
}

/** Lucro anual de uma empresa: depende do nível, da reputação do dono e da sorte do ano. */
export function businessProfit(business: Business, reputation: number, seed: number, partnerBoost: boolean): number {
  const def = getBusinessDefinition(business.catalogId);
  const luck = 0.7 + createRng(seed).next() * 0.6;
  return Math.round(def.baseProfit * business.level * (0.4 + reputation / 60) * luck * (partnerBoost ? 1.1 : 1) - def.cost * business.level * 0.03);
}

/* ------------------------------------------------------------------ */
/* Participações em equipes                                            */
/* ------------------------------------------------------------------ */

/** Preço de uma fatia de uma equipe do campeonato atual. */
export function stakePrice(career: CareerState, teamId: string, share: number): number {
  const rank = rankTeams(career.teams).findIndex((t) => t.id === teamId);
  if (rank < 0) throw new Error('Equipe não encontrada.');
  return Math.round(teamValue(career.categoryId, rank) * share * ASSET_RULES.STAKE_PREMIUM);
}

export function buyStake(career: CareerState, teamId: string, share: number): CareerState {
  if (!ASSET_RULES.STAKE_SHARES.includes(share as 0.05)) throw new Error('Fatia inválida.');
  const team = career.teams.find((t) => t.id === teamId);
  if (!team) throw new Error('Equipe não encontrada.');
  if (career.management?.teamId === teamId && career.management.position === 'owner') throw new Error('Esta equipe já é sua.');
  const existing = career.finance.stakes.find((s) => s.teamId === teamId && s.categoryId === career.categoryId);
  if ((existing?.share ?? 0) + share > 0.49) throw new Error('Uma participação minoritária não pode passar de 49%.');
  const price = stakePrice(career, teamId, share);
  requireCash(career.finance, price);
  const rank = rankTeams(career.teams).findIndex((t) => t.id === teamId);
  const stake: TeamStake = existing
    ? { ...existing, share: existing.share + share, cost: existing.cost + price, value: Math.round(teamValue(career.categoryId, rank) * (existing.share + share)) }
    : { id: `stake-${career.categoryId}-${teamId}`, teamId, teamName: team.name, categoryId: career.categoryId, share, cost: price, value: Math.round(teamValue(career.categoryId, rank) * share), lastPosition: rank + 1, lastDividend: 0 };
  const finance = post(career.finance, career.season, round(career), 'assets', -price, `Participação de ${Math.round(share * 100)}% na ${team.name}`);
  return { ...career, finance: { ...finance, stakes: [...finance.stakes.filter((s) => s.id !== stake.id), stake] } };
}

export function sellStake(career: CareerState, stakeId: string): CareerState {
  const stake = career.finance.stakes.find((s) => s.id === stakeId);
  if (!stake) throw new Error('Participação não encontrada.');
  let finance = post(career.finance, career.season, round(career), 'assets', stake.value, `Venda da participação na ${stake.teamName}`);
  finance = post(finance, career.season, round(career), 'tax', -capitalGainsTax(stake.value, stake.cost), 'Imposto sobre ganho de capital');
  return { ...career, finance: { ...finance, stakes: finance.stakes.filter((s) => s.id !== stakeId) } };
}

/**
 * Dividendo anual de uma participação: a equipe distribui de 6% do seu valor
 * (campeã) a −1,2% (última, que pede aporte aos sócios), 0,8 ponto a menos por
 * posição.
 */
export function stakeDividend(stake: TeamStake, position: number): number {
  const fullValue = teamValue(stake.categoryId, position - 1);
  return Math.round(fullValue * stake.share * (ASSET_RULES.STAKE_DIVIDEND_TOP - ASSET_RULES.STAKE_DIVIDEND_STEP * (position - 1)));
}

/**
 * Posição esperada, no longo prazo, de uma equipe que o jogo não está
 * simulando: a força original dela na categoria (equipes criadas pelo jogador
 * tendem ao meio do grid, com gestores contratados).
 */
function stakeAnchor(stake: TeamStake): number {
  const rank = rankTeams(initialTeams(stake.categoryId)).findIndex((t) => t.id === stake.teamId);
  return rank >= 0 ? rank + 1 : 5.5;
}

/* ------------------------------------------------------------------ */
/* Empréstimos                                                         */
/* ------------------------------------------------------------------ */

/** Renda anual contratada: salário (de piloto ou de chefe de equipe) e patrocínios. */
function contractedIncome(career: CareerState): number {
  const salary = career.mode === 'driver' ? career.contract.salary : (career.management?.salary ?? 0);
  return salary + (career.mode === 'driver' ? career.sponsors.reduce((sum, s) => sum + s.perSeason, 0) : 0);
}

export function loansBalance(finance: Finance): number {
  return finance.loans.reduce((sum, l) => sum + l.balance, 0);
}

/** Quanto o banco ainda empresta. */
export function loanLimit(career: CareerState): number {
  const f = career.finance;
  const assets = Math.max(0, netWorth(f) + loansBalance(f));
  const limit = assets * ASSET_RULES.LOAN_ASSET_SHARE + contractedIncome(career) * ASSET_RULES.LOAN_INCOME_MULTIPLE - loansBalance(f);
  return Math.max(0, Math.floor(limit / 1000) * 1000);
}

/** Parcela anual de um financiamento pelo sistema de parcelas iguais. */
export function annualPayment(amount: number, rate: number, seasons: number): number {
  return Math.round((amount * rate) / (1 - Math.pow(1 + rate, -seasons)));
}

/**
 * Fração da temporada já disputada. No fechamento vale zero: as contas do ano
 * já foram feitas e o que for contratado agora começa a contar no ano seguinte.
 */
function seasonProgress(career: CareerState): number {
  if (career.offseason || career.executiveOffseason || career.calendar.length === 0) return 0;
  return career.nextRoundIndex / career.calendar.length;
}

export function takeLoan(career: CareerState, amount: number, seasons: number): CareerState {
  const value = Math.round(amount);
  if (!ASSET_RULES.LOAN_TERMS.includes(seasons as 2)) throw new Error('Prazo inválido.');
  if (value < 1000) throw new Error(`O valor mínimo de um empréstimo é ${money(career, 1000)}.`);
  if (value > loanLimit(career)) throw new Error('O banco não aprova este valor: ele passa do seu limite de crédito.');
  const loan: Loan = { id: `loan-s${career.season}-${career.finance.loans.length}-${value}`, label: `Empréstimo de ${seasons} temporadas`, principal: value, balance: value, rate: ASSET_RULES.LOAN_RATE, annualPayment: annualPayment(value, ASSET_RULES.LOAN_RATE, seasons), seasonsRemaining: seasons,
    // Contratado no meio do ano, só paga juros pela parte que falta: o crédito abaixo anula os juros do trecho já disputado.
    paidThisSeason: Math.round(value * ASSET_RULES.LOAN_RATE * seasonProgress(career)),
  };
  const finance = post(career.finance, career.season, round(career), 'loan', value, 'Empréstimo bancário');
  return { ...career, finance: { ...finance, loans: [...finance.loans, loan] } };
}

/** Valor para quitar um empréstimo agora: saldo com os juros do ano até aqui, menos o que já foi pago nesta temporada. */
export function loanPayoff(career: CareerState, loan: Loan): number {
  return Math.max(0, Math.round(loan.balance * (1 + loan.rate * seasonProgress(career)) - loan.paidThisSeason));
}

export function repayLoan(career: CareerState, loanId: string): CareerState {
  const loan = career.finance.loans.find((l) => l.id === loanId);
  if (!loan) throw new Error('Empréstimo não encontrado.');
  const payoff = loanPayoff(career, loan);
  requireCash(career.finance, payoff);
  const finance = post(career.finance, career.season, round(career), 'loan', -payoff, 'Quitação de empréstimo');
  return { ...career, finance: { ...finance, loans: finance.loans.filter((l) => l.id !== loanId) } };
}

export function setLifestyle(career: CareerState, lifestyle: Lifestyle): CareerState {
  return { ...career, finance: { ...career.finance, lifestyle } };
}

/* ------------------------------------------------------------------ */
/* Dívida e execução de bens                                           */
/* ------------------------------------------------------------------ */

export interface Liquidation {
  finance: Finance;
  /** Quanto foi levantado. */
  raised: number;
  /** O que foi vendido, para o aviso ao jogador. */
  sold: string[];
}

/**
 * Execução de bens por credores: resgata aplicações e vende ações, imóveis,
 * empresas e participações, nessa ordem, até levantar o valor pedido. Imóveis,
 * empresas e participações são vendidos inteiros.
 */
export function liquidateAssets(finance: Finance, season: number, round: number, needed: number): Liquidation {
  let f = finance;
  let remaining = Math.ceil(needed);
  const sold: string[] = [];
  for (const product of ['fixedIncome', 'equityFund'] as const) {
    const amount = Math.min(Math.floor(f[product]), Math.max(0, remaining));
    if (amount <= 0) continue;
    f = { ...f, cash: f.cash + amount, [product]: f[product] - amount };
    remaining -= amount;
    sold.push(product === 'fixedIncome' ? 'renda fixa' : 'fundo de ações');
  }
  for (const holding of f.stocks) {
    if (remaining <= 0) break;
    const price = stockPrice(f, holding.stockId);
    const shares = Math.min(holding.shares, Math.ceil(remaining / price));
    const proceeds = Math.round(price * shares);
    f = post(f, season, round, 'assets', proceeds, `Execução: ações da ${getStock(holding.stockId).name}`);
    f = { ...f, stocks: f.stocks.map((h) => (h.stockId === holding.stockId ? { ...h, shares: h.shares - shares } : h)).filter((h) => h.shares > 0) };
    remaining -= proceeds;
    sold.push(`ações da ${getStock(holding.stockId).name}`);
  }
  for (const property of f.properties) {
    if (remaining <= 0) break;
    const proceeds = Math.round(property.value * (1 - ASSET_RULES.PROPERTY_SALE_FEE));
    f = { ...post(f, season, round, 'assets', proceeds, `Execução: ${property.name}`), properties: f.properties.filter((p) => p.id !== property.id) };
    remaining -= proceeds;
    sold.push(property.name);
  }
  for (const business of f.businesses) {
    if (remaining <= 0) break;
    f = { ...post(f, season, round, 'assets', business.value, `Execução: ${business.name}`), businesses: f.businesses.filter((b) => b.id !== business.id) };
    remaining -= business.value;
    sold.push(business.name);
  }
  for (const stake of f.stakes) {
    if (remaining <= 0) break;
    f = { ...post(f, season, round, 'assets', stake.value, `Execução: participação na ${stake.teamName}`), stakes: f.stakes.filter((s) => s.id !== stake.id) };
    remaining -= stake.value;
    sold.push(`participação na ${stake.teamName}`);
  }
  return { finance: f, raised: Math.ceil(needed) - remaining, sold };
}

export interface DebtSettlement extends Liquidation {
  /** Dívida perdoada depois de executados todos os bens. */
  forgiven: number;
}

/**
 * Acerto com credores quando a dívida em caixa passa do teto: primeiro os bens
 * são executados; só o que continuar acima do teto é perdoado. Quem tem
 * patrimônio não tem dívida perdoada.
 */
export function settleDebts(finance: Finance, season: number, round: number, ceiling: number): DebtSettlement {
  if (finance.cash >= -ceiling) return { finance, raised: 0, sold: [], forgiven: 0 };
  const liquidation = liquidateAssets(finance, season, round, -finance.cash - ceiling);
  const forgiven = Math.max(0, Math.round(-liquidation.finance.cash - ceiling));
  return { ...liquidation, finance: forgiven > 0 ? { ...liquidation.finance, cash: -ceiling } : liquidation.finance, forgiven };
}

/* ------------------------------------------------------------------ */
/* Custos com a família                                                */
/* ------------------------------------------------------------------ */

/** Custo anual com a formação e a carreira dos filhos, com o desconto do kartódromo próprio. */
export function familyAnnualCost(career: CareerState): number {
  const kartDiscount = hasPersonalProperty(career.finance, 'kartodromo') ? 0.5 : 1;
  let total = 0;
  for (const child of career.family.children) {
    if (child.stage === 'karting') total += FAMILY.KART_COST[child.kartFunding] * kartDiscount;
    if (child.stage === 'racing' && child.racing) total += child.racing.familyCost;
  }
  return Math.round(total);
}

/* ------------------------------------------------------------------ */
/* Liquidação por etapa e fechamento anual                             */
/* ------------------------------------------------------------------ */

/** Lançamentos do patrimônio e da família em uma etapa. */
export function settleAssetsRound(career: CareerState, roundNumber: number): Finance {
  const { season } = career;
  const rounds = Math.max(1, career.calendar.length);
  const share = 1 / rounds;
  let f: Finance = { ...career.finance, stockPrices: stepStockPrices(career.finance.stockPrices, career.seed, season, roundNumber, rounds) };

  for (const property of f.properties) {
    const def = getPropertyDefinition(property.catalogId);
    if (property.use === 'rented') f = post(f, season, roundNumber, 'rent', property.value * def.rentYield * share, `Aluguel: ${property.name}`);
    f = post(f, season, roundNumber, 'rent', -property.value * def.upkeep * share, `Manutenção: ${property.name}`);
  }
  if (f.loans.length > 0) {
    let paid = 0;
    const loans = f.loans.map((loan) => {
      const installment = Math.round(loan.annualPayment * share);
      paid += installment;
      return { ...loan, paidThisSeason: loan.paidThisSeason + installment };
    });
    f = { ...post(f, season, roundNumber, 'loan', -paid, 'Parcelas de empréstimos'), loans };
  }
  f = post(f, season, roundNumber, 'family', -familyAnnualCost(career) * share, 'Formação e carreira dos filhos');
  return f;
}

export interface AssetsYearResult {
  finance: Finance;
  notes: string[];
}

/** Fechamento anual do patrimônio. Roda antes do imposto de renda (closeSeasonFinance). */
export function closeAssetsYear(career: CareerState): AssetsYearResult {
  const { season } = career;
  const rounds = career.calendar.length;
  const notes: string[] = [];
  let f = career.finance;

  // Ações: dividendos sobre a cotação de fechamento.
  let dividends = 0;
  for (const holding of f.stocks) dividends += holding.shares * stockPrice(f, holding.stockId) * getStock(holding.stockId).dividendYield;
  f = post(f, season, rounds, 'dividends', dividends, 'Dividendos de ações');

  // Imóveis: valorização (ou queda) e imposto anual.
  let propertyTax = 0;
  const properties = f.properties.map((property) => {
    const def = getPropertyDefinition(property.catalogId);
    const change = clamp(def.appreciation + gaussian(createRng(hashSeed(career.seed, season, 'property', property.id))) * def.appreciationSd, -0.15, 0.25);
    const value = Math.round(property.value * (1 + change));
    propertyTax += value * ASSET_RULES.PROPERTY_TAX;
    return { ...property, value };
  });
  f = post({ ...f, properties }, season, rounds, 'tax', -propertyTax, 'Imposto sobre imóveis');

  // Empresas: lucro do ano e novo valor.
  const partnerBoost = career.family.partner?.background === 'business';
  const businesses: Business[] = [];
  for (const business of f.businesses) {
    const profit = businessProfit(business, career.reputation, hashSeed(career.seed, season, 'business', business.id), partnerBoost);
    f = post(f, season, rounds, 'business', profit, `Resultado: ${business.name}`);
    businesses.push({ ...business, lastProfit: profit, value: businessValue({ invested: business.invested, lastProfit: profit }) });
    notes.push(`${business.name}: ${profit >= 0 ? 'lucro' : 'prejuízo'} de ${money(career, Math.abs(profit))}.`);
  }
  f = { ...f, businesses };

  // Participações: dividendo pela posição da equipe e novo valor de mercado.
  const standings = computeTeamStandings(career.rounds, career.teams, career.adjustments);
  const stakes: TeamStake[] = [];
  for (const stake of f.stakes) {
    const real = stake.categoryId === career.categoryId ? standings.find((s) => s.teamId === stake.teamId)?.position : undefined;
    // Equipe fora do campeonato acompanhado: a posição oscila e volta, aos poucos, para a força original dela.
    const position = real ?? clamp(Math.round(stake.lastPosition + (stakeAnchor(stake) - stake.lastPosition) * 0.3 + gaussian(createRng(hashSeed(career.seed, season, 'stake', stake.id))) * 1.2), 1, 10);
    const dividend = stakeDividend(stake, position);
    f = post(f, season, rounds, 'dividends', dividend, dividend >= 0 ? `Dividendos: ${stake.teamName}` : `Aporte de sócio: ${stake.teamName}`);
    stakes.push({ ...stake, lastPosition: position, lastDividend: dividend, value: Math.round(teamValue(stake.categoryId, position - 1) * stake.share) });
    notes.push(`${stake.teamName} terminou em ${position}º: ${dividend >= 0 ? `dividendos de ${money(career, dividend)}` : `aporte de ${money(career, -dividend)}`}.`);
  }
  f = { ...f, stakes };

  // Empréstimos: juros do ano, amortização e quitação.
  const loans: Loan[] = [];
  for (const loan of f.loans) {
    const balance = Math.round(loan.balance * (1 + loan.rate) - loan.paidThisSeason);
    if (loan.seasonsRemaining <= 1 || balance <= 0) {
      // Acerto final: diferenças de arredondamento das parcelas.
      f = post(f, season, rounds, 'loan', -Math.max(0, balance), 'Parcela final de empréstimo');
      notes.push(`${loan.label} quitado.`);
    } else {
      loans.push({ ...loan, balance, seasonsRemaining: loan.seasonsRemaining - 1, paidThisSeason: 0 });
    }
  }
  return { finance: { ...f, loans }, notes };
}
