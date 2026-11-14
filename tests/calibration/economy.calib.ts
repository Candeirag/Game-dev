/**
 * Auditoria da economia pessoal (não é teste de regressão): o que acontece
 * com € 100 milhões em 40 temporadas, por estratégia de investimento.
 *
 * O jogo não tem inflação (salários, vagas e equipes custam sempre o mesmo),
 * então todo retorno é real. Nenhuma estratégia passiva deve multiplicar o
 * patrimônio a ponto de o dinheiro deixar de importar na geração seguinte.
 */
import { test } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { BUSINESSES, PROPERTIES, STOCKS } from '@/data/assets';
import * as engine from '../engineApi';
import { newCareer, playExecutiveRound, resolvePending } from '../helpers';

const START = 100_000_000;
const SEASONS = 40;
const SEEDS = [11, 22, 33, 44, 55, 66];

/** Investidor de 30 anos, reputação 90, acompanhando a F1 sem cargo. */
function investor(seed: number): CareerState {
  const base = newCareer(seed);
  const category = engine.getCategory('f1');
  const field = engine.buildCategoryField('f1', seed, 1);
  const player = { ...engine.getPlayer(base), teamId: null, role: null, age: 30 };
  return { ...base, mode: 'executive', categoryId: 'f1', reputation: 90, teams: field.teams, drivers: [player, ...field.drivers], calendar: engine.buildCalendar(seed, 1, base.year, category), sponsors: [], finance: { ...base.finance, cash: START }, tutorial: { done: [], dismissed: true } };
}

function total(c: CareerState): number {
  return engine.netWorth(c.finance) + engine.ownedTeamValue(c);
}

type Strategy = { name: string; setup: (c: CareerState) => CareerState; plan?: 'team' };

const allStocks = (c: CareerState, ids: readonly string[], amount: number) => ids.reduce((s, id) => engine.buyStock(s, id, Math.floor(amount / ids.length / engine.stockPrice(s.finance, id))), c);

const STRATEGIES: Strategy[] = [
  { name: 'Só caixa', setup: (c) => c },
  { name: 'Renda fixa', setup: (c) => engine.invest(c, { product: 'fixedIncome', amount: START * 0.98 }) },
  { name: 'Fundo de ações', setup: (c) => engine.invest(c, { product: 'equityFund', amount: START * 0.98 }) },
  { name: 'Ações (as seis, partes iguais)', setup: (c) => allStocks(c, STOCKS.map((s) => s.id), START * 0.98) },
  { name: 'Ações (só as duas de dividendos)', setup: (c) => allStocks(c, ['banco-box', 'tecnopneu'], START * 0.98) },
  { name: 'Ações (só Grid Tech)', setup: (c) => allStocks(c, ['grid-tech'], START * 0.98) },
  { name: 'Imóveis (os cinco, alugados)', setup: (c) => PROPERTIES.reduce((s, p) => engine.buyProperty(s, p.id, 'rented'), c) },
  { name: 'Empresas (as quatro, nível 3)', setup: (c) => BUSINESSES.reduce((s, b) => { let n = engine.openBusiness(s, b.id); const id = n.finance.businesses[n.finance.businesses.length - 1]!.id; n = engine.upgradeBusiness(n, id); return engine.upgradeBusiness(n, id); }, c) },
  { name: 'Participação: 25% da melhor equipe', setup: (c) => engine.buyStake(c, engine.rankTeams(c.teams)[0]!.id, 0.25) },
  { name: 'Participação: 25% da pior equipe', setup: (c) => engine.buyStake(c, engine.rankTeams(c.teams)[9]!.id, 0.25) },
  { name: 'Alavancagem: empréstimo máximo em ações', setup: (c) => { const loan = engine.takeLoan(c, engine.loanLimit(c), 6); return allStocks(loan, STOCKS.map((s) => s.id), loan.finance.cash * 0.98); } },
  { name: 'Dono passivo da 6ª equipe da F1', setup: (c) => c, plan: 'team' },
];

test('economia pessoal: € 100 milhões em 40 temporadas, por estratégia', () => {
  console.log(`\nestratégia                                 mediana   mín     máx     ao ano (mediana)   renda média por ano`);
  for (const strategy of STRATEGIES) {
    const results: number[] = [];
    const incomes: number[] = [];
    for (const seed of SEEDS) {
      let c = strategy.setup(investor(seed));
      let alive = true;
      for (let season = 0; season < SEASONS && alive; season++) {
        while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
        if (c.succession) { alive = false; break; }
        c = resolvePending(c);
        if (strategy.plan === 'team' && season === 0) {
          const listing = c.executiveOffseason!.listings.find((l) => l.categoryId === 'f1' && l.rank === 5)!;
          c = engine.startExecutiveSeason({ ...c, finance: { ...c.finance, cash: c.finance.cash + Math.max(0, listing.price - c.finance.cash) } }, { kind: 'buy', listingId: listing.id });
          continue;
        }
        if (c.management) {
          const off = c.executiveOffseason!;
          for (const offer of [...off.sponsorOffers].sort((a, b) => b.perSeason - a.perSeason)) if ((c.management?.sponsors.length ?? 3) < 3) c = engine.acceptTeamSponsor(c, offer.id);
          c = engine.startExecutiveSeason(c, { kind: 'continue' });
        } else {
          c = engine.startExecutiveSeason(c, { kind: 'spectate' });
        }
      }
      if (!alive) continue;
      results.push(total(c) / START);
      const reports = c.finance.reports;
      incomes.push(reports.reduce((sum, r) => sum + (r.totals.dividends ?? 0) + (r.totals.rent ?? 0) + (r.totals.business ?? 0) + r.investmentReturn, 0) / Math.max(1, reports.length));
    }
    results.sort((a, b) => a - b);
    const median = results[Math.floor(results.length / 2)] ?? 0;
    const income = incomes.reduce((a, b) => a + b, 0) / Math.max(1, incomes.length);
    console.log(`${strategy.name.padEnd(42)} ${median.toFixed(2).padStart(6)}× ${(results[0] ?? 0).toFixed(2).padStart(6)}× ${(results[results.length - 1] ?? 0).toFixed(2).padStart(6)}×   ${((Math.pow(Math.max(0.0001, median), 1 / SEASONS) - 1) * 100).toFixed(1).padStart(5)}%            € ${Math.round(income / 1000).toLocaleString('pt-BR')} mil`);
  }
}, 3_600_000);
