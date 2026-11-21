/**
 * Fase 3: patrimônio pessoal, família, aposentadoria, gestão de equipe,
 * desenvolvimento técnico, morte e sucessão.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAREER_SCHEMA_VERSION, CareerStateSchema, type CareerState, type Child, type RoundRecord } from '@/domain/schemas';
import { ASSET_RULES, STOCKS } from '@/data/assets';
import { FAMILY } from '@/data/family';
import { MANAGEMENT, REGULATIONS, TEAM_ECONOMY } from '@/data/management';
import { closeSeasonFinance } from '@/engine/career/economy';
import { applyEffects } from '@/engine/events/effects';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer, loadCareer, saveCareer, summarize } from '@/persistence/saveService';
import { MemoryStorage } from '@/persistence/storage';
import * as engine from './engineApi';
import {
  NOW,
  botCareer,
  botExecutiveOffseason,
  newCareer,
  pickBestOffer,
  playExecutiveRound,
  playLifeSeason,
  playRound,
  playSeason,
  resolvePending,
} from './helpers';

/** Estado válido: passa no schema e nas verificações de integridade. */
function expectValid(career: CareerState) {
  const parsed = CareerStateSchema.safeParse(career);
  expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
  expect(validateCareerIntegrity(career)).toEqual([]);
}

const withCash = (career: CareerState, cash: number): CareerState => ({ ...career, finance: { ...career.finance, cash } });
const withReputation = (career: CareerState, reputation: number): CareerState => ({ ...career, reputation });

/** Carreira no fechamento da primeira temporada, já aposentada das pistas. */
function retiredCareer(seed = 77, cash = 500_000, reputation = 30): CareerState {
  const closed = resolvePending(playSeason(newCareer(seed)));
  return engine.retireFromDriving(withReputation(withCash(closed, cash), reputation));
}

/** Jogador dono de uma equipe da categoria indicada (a de posição `rank` entre as que estão à venda). */
function ownerCareer(categoryId: CareerState['categoryId'], rank: 5 | 8 | 9 = 8, seed = 77): CareerState {
  const c = retiredCareer(seed, 400_000_000, 60);
  const listing = c.executiveOffseason!.listings.find((l) => l.categoryId === categoryId && l.rank === rank)!;
  return engine.startExecutiveSeason(c, { kind: 'buy', listingId: listing.id });
}

function playExecutiveSeason(career: CareerState): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
  return c;
}

/* ------------------------------------------------------------------ */

describe('assistir à corrida do muro dos boxes', () => {
  it('assistir ou simular a etapa dá exatamente a mesma carreira, e a linha do tempo cobre a corrida toda', () => {
    const career = engine.startWeekend(resolvePending(ownerCareer('f1')));
    const program = 'longRun' as const;
    const approach = 'attack' as const;
    const simulated = engine.simulateAbsentWeekend(career, { program, approach });

    // Caminho de quem assiste: treino e classificação, corrida volta a volta, e só então o fechamento.
    const prepared = engine.prepareAbsentWeekend(career, { program, approach });
    expect(prepared.weekend!.phase).toBe('race');
    expect(prepared.rounds).toHaveLength(career.rounds.length);
    const context = engine.buildRaceContext(prepared);
    let race = engine.createWeekendRace(prepared);
    let timeline = engine.createRaceTimeline(race, context);
    while (!engine.isRaceFinished(race)) {
      const next = engine.stepRaceLap(race, context, { mode: 'balanced', auto: true, pit: null });
      timeline = engine.appendRaceLap(timeline, race, next, context);
      race = next;
    }
    expect(engine.completeWeekend(prepared, race)).toEqual(simulated);
    expect(timeline.finished).toBe(true);
    expect(timeline.lapsBuilt).toBe(race.currentLap);
    // O dirigente não está no grid; os dois carros da equipe dele estão.
    expect(timeline.cars[career.playerDriverId]).toBeUndefined();
    expect(Object.values(timeline.cars).filter((c) => c.teamId === career.management!.teamId)).toHaveLength(2);
    // Recarregar no meio (a carreira é salva na hora da corrida) e simular chega ao mesmo resultado.
    expect(engine.simulateAbsentWeekend(prepared)).toEqual(simulated);
  });
});

describe('patrimônio pessoal', () => {
  it('ações: compra pelo preço atual, preço médio e imposto de 15% sobre o ganho na venda', () => {
    const stock = STOCKS[0]!;
    let c = withCash(newCareer(), 100_000);
    c = engine.buyStock(c, stock.id, 100);
    expect(c.finance.cash).toBe(100_000 - stock.startPrice * 100);
    expect(c.finance.stocks).toEqual([{ stockId: stock.id, shares: 100, avgCost: stock.startPrice }]);
    expect(engine.netWorth(c.finance)).toBe(100_000);

    // A ação dobra de preço: a venda de metade paga 15% do ganho.
    c = { ...c, finance: { ...c.finance, stockPrices: { ...c.finance.stockPrices, [stock.id]: stock.startPrice * 2 } } };
    const before = c.finance.cash;
    c = engine.sellStock(c, stock.id, 50);
    const gain = stock.startPrice * 50;
    expect(c.finance.cash).toBe(before + stock.startPrice * 2 * 50 - Math.round(gain * ASSET_RULES.CAPITAL_GAINS_TAX));
    expect(c.finance.stocks[0]!.shares).toBe(50);
    expect(() => engine.sellStock(c, stock.id, 51)).toThrow();
    expect(() => engine.buyStock(c, stock.id, 10_000_000)).toThrow(/insuficiente/);
    expectValid(c);
  });

  it('cotações: mudam a cada etapa, são reproduzíveis e continuam positivas', () => {
    const c = newCareer(5);
    const a = engine.stepStockPrices(c.finance.stockPrices, 5, 1, 1, 10);
    const b = engine.stepStockPrices(c.finance.stockPrices, 5, 1, 1, 10);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c.finance.stockPrices);
    let prices = c.finance.stockPrices;
    for (let season = 1; season <= 40; season++) for (let round = 1; round <= 10; round++) prices = engine.stepStockPrices(prices, 5, season, round, 10);
    for (const stock of STOCKS) expect(prices[stock.id]).toBeGreaterThan(0);
    // Depois de uma etapa disputada, a carreira guarda as cotações novas.
    const played = playRound(newCareer(5));
    expect(played.finance.stockPrices).toEqual(a);
  });

  it('imóvel alugado rende aluguel a cada etapa; o de uso próprio em Mônaco reduz o imposto de renda', () => {
    let c = withCash(newCareer(9), 10_000_000);
    c = engine.buyProperty(c, 'apartamento', 'rented');
    expect(c.finance.properties).toHaveLength(1);
    expect(() => engine.buyProperty(c, 'apartamento', 'rented')).toThrow(/já tem/);
    const played = playRound(c);
    // 5% de aluguel menos 1% de manutenção, em 10 parcelas.
    expect(played.finance.seasonTotals.rent).toBe(Math.round(180_000 * 0.05 * 0.1) - Math.round(180_000 * 0.01 * 0.1));

    const income = { ...c, finance: { ...c.finance, seasonTotals: { salary: 1_000_000 } } };
    const normal = closeSeasonFinance(income).report.tax;
    const monaco = closeSeasonFinance(engine.buyProperty(income, 'cobertura-monaco', 'personal')).report.tax;
    expect(monaco).toBe(Math.round(normal * 0.75));

    const sold = engine.sellProperty(c, c.finance.properties[0]!.id);
    expect(sold.finance.properties).toHaveLength(0);
    expect(sold.finance.cash).toBe(c.finance.cash + Math.round(180_000 * (1 - ASSET_RULES.PROPERTY_SALE_FEE)));
  });

  it('empresa: exige reputação e lucra mais com um dono famoso', () => {
    const unknown = withCash(withReputation(newCareer(), 5), 1_000_000);
    expect(() => engine.openBusiness(unknown, 'escola')).toThrow(/reputação/);
    const c = engine.openBusiness(withReputation(unknown, 40), 'escola');
    const business = c.finance.businesses[0]!;
    const modest = engine.businessProfit(business, 20, 123, false);
    const famous = engine.businessProfit(business, 90, 123, false);
    expect(famous).toBeGreaterThan(modest * 2);
    // O fechamento do ano lança o resultado e atualiza o valor da empresa.
    const closed = engine.closeAssetsYear(c);
    expect(closed.finance.seasonTotals.business).toBe(closed.finance.businesses[0]!.lastProfit);
    expect(closed.finance.businesses[0]!.value).toBe(engine.businessValue(closed.finance.businesses[0]!));
  });

  it('empréstimo: respeita o limite, cobra parcelas por etapa e é quitado no prazo', () => {
    let c = withCash(newCareer(11), 50_000);
    const limit = engine.loanLimit(c);
    expect(limit).toBeGreaterThan(0);
    expect(() => engine.takeLoan(c, limit + 5_000, 2)).toThrow(/limite/);
    c = engine.takeLoan(c, 20_000, 2);
    expect(c.finance.cash).toBe(70_000);
    expect(engine.netWorth(c.finance)).toBe(50_000);
    const loan = c.finance.loans[0]!;
    expect(loan.annualPayment).toBe(engine.annualPayment(20_000, ASSET_RULES.LOAN_RATE, 2));

    const one = playRound(c);
    expect(one.finance.loans[0]!.paidThisSeason).toBe(Math.round(loan.annualPayment / 10));
    // Duas temporadas depois, o empréstimo sumiu e o total pago é principal + juros.
    let paid = 0;
    let state = c;
    for (let year = 0; year < 2; year++) {
      state = playSeason(state);
      paid += -(state.finance.reports[state.finance.reports.length - 1]!.totals.loan ?? 0) + (year === 0 ? 20_000 : 0);
      if (year === 0) state = engine.startNextSeason(resolvePending(state), pickBestOffer(state));
    }
    expect(state.finance.loans).toHaveLength(0);
    expect(paid).toBeGreaterThan(20_000 * 1.1);
    expect(paid).toBeLessThan(20_000 * 1.2);

    // Quitação antecipada.
    const early = engine.repayLoan(c, loan.id);
    expect(early.finance.loans).toHaveLength(0);
    expect(early.finance.cash).toBe(50_000);
  });

  it('participação em equipe: paga dividendos pela posição da equipe no campeonato', () => {
    let c = withCash(newCareer(13), 2_000_000);
    const best = engine.rankTeams(c.teams)[0]!;
    c = engine.buyStake(c, best.id, 0.25);
    expect(c.finance.stakes[0]).toMatchObject({ teamId: best.id, share: 0.25 });
    expect(() => engine.buyStake(c, best.id, 0.25)).toThrow(/49%/);
    const closed = playSeason(c);
    const stake = closed.finance.stakes[0]!;
    const position = engine.teamStandings(closed).find((s) => s.teamId === best.id)!.position;
    expect(stake.lastPosition).toBe(position);
    expect(stake.lastDividend).toBe(engine.stakeDividend(stake, position));
    expect(closed.finance.reports[0]!.totals.dividends).toBe(stake.lastDividend);
    // A última colocada pede aporte em vez de pagar.
    expect(engine.stakeDividend(stake, 10)).toBeLessThan(0);
    expect(engine.stakeDividend(stake, 1)).toBeGreaterThan(0);
  });

  it('padrão de vida: custa mais e melhora a moral; dividendos e aluguéis entram no imposto de renda', () => {
    const base = withCash(newCareer(21), 500_000);
    const frugal = playRound(base);
    const luxury = playRound(engine.setLifestyle(base, 'luxury'));
    expect(luxury.finance.seasonTotals.living).toBe(Math.round((frugal.finance.seasonTotals.living ?? 0) * 3.5));
    expect(engine.getPlayer(luxury).condition.morale).toBeGreaterThan(engine.getPlayer(frugal).condition.morale);

    const totals = { salary: 100_000 };
    const plain = closeSeasonFinance({ ...base, finance: { ...base.finance, seasonTotals: totals } }).report;
    const invested = closeSeasonFinance({ ...base, finance: { ...base.finance, seasonTotals: { ...totals, dividends: 50_000, rent: 20_000 } } }).report;
    expect(invested.taxableIncome).toBe(plain.taxableIncome + 70_000);
    expect(invested.tax).toBeGreaterThan(plain.tax);
  });
});

/* ------------------------------------------------------------------ */

function careerWithPartner(seed = 31, relationship = 80, married = false): CareerState {
  const c = newCareer(seed);
  const partner = { ...engine.generatePartner(seed, 28, 1), relationship, married };
  return { ...c, family: { ...c.family, partner } };
}

function childOf(career: CareerState, seed: number, patch: Partial<Child> = {}): Child {
  return { ...engine.generateChild(career, seed), ...patch };
}

describe('família', () => {
  it('o talento dos filhos é herdado com variação: pais melhores tendem a ter filhos melhores', () => {
    const base = careerWithPartner();
    const average = (potential: number) => {
      const c = { ...base, drivers: base.drivers.map((d) => (d.isPlayer ? { ...d, potential, attributes: { ...d.attributes, pace: 60 } } : d)) };
      const talents = Array.from({ length: 300 }, (_, i) => engine.generateChild(c, i + 1).talent);
      for (const t of talents) {
        expect(t).toBeGreaterThanOrEqual(55);
        expect(t).toBeLessThanOrEqual(97);
      }
      return { mean: talents.reduce((a, b) => a + b, 0) / talents.length, min: Math.min(...talents), max: Math.max(...talents) };
    };
    const champion = average(96);
    const journeyman = average(72);
    expect(champion.mean - journeyman.mean).toBeGreaterThan(9);
    expect(champion.mean - journeyman.mean).toBeLessThan(15);
    // Probabilístico: há sobreposição entre as duas distribuições.
    expect(journeyman.max).toBeGreaterThan(champion.min);
    // Reproduzível.
    expect(engine.generateChild(base, 7)).toEqual(engine.generateChild(base, 7));
  });

  it('casamento: o evento aparece com a relação firme, custa dinheiro e muda o estado civil', () => {
    const c = { ...careerWithPartner(31, 80), season: 3 };
    const events = engine.familySeasonEvents(c);
    const wedding = events.find((e) => e.definitionId === 'family-wedding')!;
    expect(wedding).toBeDefined();
    const withEvent = { ...c, pendingEvents: [wedding] };
    const married = engine.resolveEvent(withEvent, wedding.id, 'party').career;
    expect(married.family.partner!.married).toBe(true);
    expect(married.family.partner!.relationship).toBe(90);
    expect(married.finance.cash).toBeLessThan(c.finance.cash);
    expect(married.finance.seasonTotals.family).toBeLessThan(0);
    // Já casado, o evento não se repete.
    expect(engine.familySeasonEvents(married).some((e) => e.definitionId === 'family-wedding')).toBe(false);
  });

  it('crise e divórcio: o cônjuge leva 30% do patrimônio e a moral despenca', () => {
    const c = withCash({ ...careerWithPartner(33, 20, true), season: 4 }, 1_000_000);
    const crisis = engine.familySeasonEvents(c).find((e) => e.definitionId === 'family-crisis')!;
    expect(crisis).toBeDefined();
    const ignore = crisis.choices.find((x) => x.id === 'ignore')!;
    const divorce = ignore.outcomes.find((o) => o.effects.some((e) => e.type === 'divorce'))!;
    const after = applyEffects({ ...c, pendingEvents: [crisis] }, divorce.effects, 0);
    expect(after.family.partner).toBeNull();
    expect(after.family.divorces).toBe(1);
    expect(after.finance.cash).toBe(1_000_000 - 1_000_000 * FAMILY.DIVORCE_SHARE);
    expect(engine.getPlayer(after).condition.morale).toBeLessThan(engine.getPlayer(c).condition.morale);
    // Relação em crise tira moral a cada etapa; casamento feliz dá.
    expect(engine.partnerMoraleEffect(c.family)).toBeLessThan(0);
    expect(engine.partnerMoraleEffect(careerWithPartner(33, 85, true).family)).toBeGreaterThan(0);
  });

  it('filho: formação no kart custa por etapa e rende base; aos 14 começa a carreira com apoio da família', () => {
    let c = withCash(careerWithPartner(35), 5_000_000);
    const kid = childOf(c, 1, { age: 8, interest: 70 });
    c = { ...c, family: { ...c.family, children: [kid] } };
    // Aos 8 anos, o evento do kart.
    const kart = engine.familySeasonEvents(c).find((e) => e.definitionId === `family-kart-${kid.id}`)!;
    expect(kart).toBeDefined();
    c = engine.resolveEvent({ ...c, pendingEvents: [kart] }, kart.id, 'full').career;
    expect(c.family.children[0]).toMatchObject({ stage: 'karting', kartFunding: 'full' });
    expect(engine.familyAnnualCost(c)).toBe(FAMILY.KART_COST.full);
    const played = playRound(c);
    expect(played.finance.seasonTotals.family).toBe(-Math.round(FAMILY.KART_COST.full / 10));
    // Kartódromo próprio: metade do custo.
    expect(engine.familyAnnualCost(engine.buyProperty(c, 'kartodromo', 'personal'))).toBe(FAMILY.KART_COST.full / 2);

    // Seis anos de formação completa.
    let family = c.family;
    for (let year = 0; year < 6; year++) family = engine.closeFamilyYear({ ...c, family, season: c.season + year }).family;
    const teen = family.children[0]!;
    expect(teen.age).toBe(14);
    expect(teen.kartYears).toBe(6);
    c = { ...c, family };
    const start = engine.familySeasonEvents(c).find((e) => e.definitionId === `family-career-${kid.id}`)!;
    expect(start).toBeDefined();
    c = engine.resolveEvent({ ...c, pendingEvents: [start] }, start.id, 'full').career;
    const racer = c.family.children[0]!;
    expect(racer.stage).toBe('racing');
    expect(racer.racing).toMatchObject({ categoryId: 'kart-regional', teamRank: 3 });
    expect(racer.driver!.potential).toBe(racer.talent);
    expect(racer.racing!.familyCost).toBeGreaterThan(0);
    expect(engine.familyAnnualCost(c)).toBe(racer.racing!.familyCost);

    // A temporada dele é disputada por fora: resultado, licença, reputação e evolução.
    const afterSeason = engine.closeFamilyYear(c).family.children[0]!;
    expect(afterSeason.racing!.seasons).toHaveLength(1);
    expect(afterSeason.racing!.license).toHaveLength(1);
    expect(afterSeason.driver!.age).toBe(15);
    expect(engine.overallRating(afterSeason.driver!.attributes)).toBeGreaterThan(engine.overallRating(racer.driver!.attributes));
    expectValid(c);
  });

  it('sem formação no kart, o filho começa bem mais fraco', () => {
    const c = careerWithPartner(37);
    const rating = (kartYears: number) => {
      const kid = childOf(c, 3, { age: 14, kartYears, talent: 85 });
      const started = engine.startChildCareer({ ...c, family: { ...c.family, children: [kid] } }, kid.id, 'full');
      return engine.overallRating(started.family.children[0]!.driver!.attributes);
    };
    expect(rating(6) - rating(0)).toBeGreaterThan(8);
  });

  it('a posição estimada melhora com a nota do piloto e com a força da equipe', () => {
    const category = engine.getCategory('f3');
    const position = (rating: number, rank: number) => engine.estimateSeasonPosition(rating, category, rank, 0);
    expect(position(95, 0)).toBe(1);
    expect(position(60, 9)).toBe(20);
    for (let r = 70; r < 90; r++) expect(position(r + 1, 4)).toBeLessThanOrEqual(position(r, 4));
    expect(position(80, 1)).toBeLessThan(position(80, 8));
  });

  it('promoção de um filho depende de requisitos e de dinheiro: sem apoio, um bom resultado pode não bastar', () => {
    const c = careerWithPartner(39);
    const kid = childOf(c, 5, { age: 16, kartYears: 6, talent: 85, traits: ['calm'] });
    const started = engine.startChildCareer({ ...c, family: { ...c.family, children: [kid] } }, kid.id, 'full').family.children[0]!;
    // Quinto colocado no kart regional, com licença e reputação para subir.
    const racing = {
      ...started.racing!,
      reputation: 14,
      license: [{ season: 1, categoryId: 'kart-regional' as const, position: 5, points: 6 }],
      seasons: [{ season: 1, year: 2027, categoryId: 'kart-regional' as const, teamName: 'x', position: 5, wins: 0, inWorld: false }],
    };
    const driver = { ...started.driver!, attributes: { ...started.driver!.attributes, experience: 40 } };
    const supported = engine.planChildSeason({ ...started, racing, driver, support: 'full' }, c).child;
    expect(supported.racing!.categoryId).toBe('kart-national');
    expect(supported.racing!.familyCost).toBeGreaterThan(0);
    const alone = engine.planChildSeason({ ...started, racing, driver, support: 'none' }, c);
    expect(alone.child.racing!.categoryId).toBe('kart-regional');
    expect(alone.child.racing!.stalled).toBe(1);
    expect(alone.note).toMatch(/não conseguiu pagar/);
    // Mais um ano sem dinheiro e a carreira acaba.
    const again = engine.planChildSeason({ ...alone.child, racing: { ...alone.child.racing!, seasons: [{ ...racing.seasons[0]!, position: 12 }] } }, c);
    expect(again.child.stage).toBe('other');
  });
});

/* ------------------------------------------------------------------ */

describe('aposentadoria das pistas', () => {
  it('no fechamento da temporada: vira dirigente, com propostas de cargo e equipes à venda', () => {
    const closed = resolvePending(playSeason(newCareer(41)));
    const c = engine.retireFromDriving(withReputation(closed, 80));
    expect(c.mode).toBe('executive');
    expect(c.offseason).toBeNull();
    expect(engine.getPlayer(c).teamId).toBeNull();
    const off = c.executiveOffseason!;
    expect(off.summary.mode).toBe('driver');
    expect(off.summary.playerPosition).toBe(closed.offseason!.playerPosition);
    expect(off.jobOffers.length).toBeGreaterThan(0);
    expect(off.jobOffers[0]!.categoryId).toBe('f1');
    expect(off.listings.length).toBe(21);
    // A equipe que ele deixou continua com dois titulares.
    for (const team of c.teams) expect(c.drivers.filter((d) => d.teamId === team.id && d.role !== 'reserve')).toHaveLength(2);
    expectValid(c);
    expect(() => engine.retireFromDriving(c)).toThrow(/já se aposentou/);
  });

  it('um piloto desconhecido só recebe propostas das categorias de base', () => {
    const c = retiredCareer(43, 10_000, 8);
    const tiers = c.executiveOffseason!.jobOffers.map((o) => engine.getCategory(o.categoryId).tier);
    expect(Math.max(...tiers)).toBeLessThanOrEqual(2);
  });

  it('no meio da temporada: o reserva assume e o campeonato segue sem o jogador', () => {
    let c = newCareer(45);
    for (let i = 0; i < 3; i++) c = playRound(c);
    const team = engine.getPlayer(c).teamId!;
    const retired = engine.retireFromDriving(resolvePending(c));
    expect(retired.mode).toBe('executive');
    expect(retired.executiveOffseason).toBeNull();
    expect(retired.drivers.filter((d) => d.teamId === team && d.role !== 'reserve')).toHaveLength(2);
    expectValid(retired);
    const finished = playExecutiveSeason(retired);
    expect(finished.rounds).toHaveLength(10);
    expect(finished.executiveOffseason).not.toBeNull();
    expect(finished.rounds[9]!.race.entries.some((e) => e.driverId === 'player')).toBe(false);
    expectValid(finished);
  });

  it('save antigo com a carreira encerrada (Fase 2) pode voltar como dirigente', () => {
    const legacy: CareerState = { ...resolvePending(playSeason(newCareer(47))), status: 'retired' };
    const c = engine.retireFromDriving(legacy);
    expect(c.status).toBe('active');
    expect(c.mode).toBe('executive');
    expectValid(c);
  });

  it('sem cargo, o jogador acompanha a temporada como investidor e segue recebendo propostas', () => {
    let c = engine.startExecutiveSeason(retiredCareer(49), { kind: 'spectate' });
    expect(c.management).toBeNull();
    expect(c.season).toBe(2);
    expect(c.history).toHaveLength(1);
    expectValid(c);
    const age = engine.getPlayer(c).age;
    c = playExecutiveSeason(c);
    expect(c.executiveOffseason!.teamPosition).toBeNull();
    expect(c.finance.reports).toHaveLength(2);
    c = botExecutiveOffseason(c);
    expect(engine.getPlayer(c).age).toBe(age + 1);
    expectValid(c);
  });
});

/* ------------------------------------------------------------------ */

describe('gestão de equipe', () => {
  it('comprar uma equipe: o dinheiro sai do patrimônio pessoal e a equipe passa a ter caixa, estrutura e contratos', () => {
    const retired = retiredCareer(51, 5_000_000, 40);
    const listing = retired.executiveOffseason!.listings.find((l) => l.categoryId === 'kart-national' && l.rank === 8)!;
    const c = engine.startExecutiveSeason(retired, { kind: 'buy', listingId: listing.id });
    const m = c.management!;
    expect(m).toMatchObject({ position: 'owner', teamId: listing.teamId, categoryId: 'kart-national', purchasePrice: listing.price });
    expect(c.categoryId).toBe('kart-national');
    expect(c.finance.cash).toBe(5_000_000 - listing.price);
    expect(m.budget).toBe(TEAM_ECONOMY['kart-national'].operations * MANAGEMENT.STARTING_BUDGET);
    expect(m.staff.map((s) => s.role).sort()).toEqual(['chiefEngineer', 'chiefMechanic', 'sportingDirector', 'technicalDirector']);
    expect(Object.keys(m.deals)).toHaveLength(3);
    expect(m.sponsors).toHaveLength(3);
    expect(engine.ownedTeamValue(c)).toBeGreaterThan(0);
    expectValid(c);
    expect(() => engine.startExecutiveSeason(withCash(retired, 1_000), { kind: 'buy', listingId: listing.id })).toThrow(/insuficiente/);
  });

  it('uma temporada como dono: receitas e despesas por etapa, avaliação e mercado no fechamento', () => {
    let c = ownerCareer('f3', 8);
    const start = c.management!.budget;
    c = playExecutiveRound(c);
    const m = c.management!;
    const forecast = engine.teamBudgetForecast(c);
    for (const key of ['sponsors', 'seats', 'prize', 'staff', 'operations', 'research']) expect(m.ledger[key]).toBeDefined();
    expect(m.ledger.operations).toBe(-Math.round(forecast.expenses.operations! / 10));
    expect(m.budget).not.toBe(start);
    expect(m.budget).toBe(start + Object.values(m.ledger).reduce((a, b) => a + b, 0));

    c = playExecutiveSeason(c);
    const off = c.executiveOffseason!;
    expect(off.teamPosition).toBe(engine.teamStandings(c).find((s) => s.teamId === m.teamId)!.position);
    expect(off.target).toBe(m.boardTarget);
    expect(off.summary).toMatchObject({ mode: 'executive', playerTeamId: m.teamId, playerPosition: off.teamPosition });
    expect(off.candidates.filter((x) => x.origin === 'current').length).toBeGreaterThanOrEqual(2);
    expect(off.candidates.filter((x) => x.origin === 'rookie')).toHaveLength(3);
    expect(off.lineup).toHaveLength(2);
    expect(off.sponsorOffers).toHaveLength(3);
    expect(c.executiveLog).toHaveLength(1);
    expect(c.management!.previousPosition).toBe(off.teamPosition);
    expectValid(c);

    const next = botExecutiveOffseason(c);
    expect(next.season).toBe(c.season + 1);
    expect(next.management!.ledger).toEqual({});
    expect(next.management!.development.spent).toBe(0);
    expect(next.history[next.history.length - 1]!.mode).toBe('executive');
    for (const id of off.lineup) expect(next.drivers.find((d) => d.id === id)!.teamId).toBe(m.teamId);
    for (const team of next.teams) expect(next.drivers.filter((d) => d.teamId === team.id && d.role !== 'reserve')).toHaveLength(2);
    expectValid(next);
  });

  it('fundar uma equipe: ocupa a vaga da mais fraca, com nome e cor próprios e estrutura mínima', () => {
    const retired = retiredCareer(53, 3_000_000, 30);
    const cost = engine.foundingCost('f4');
    const c = engine.startExecutiveSeason(retired, { kind: 'found', categoryId: 'f4', name: 'Scuderia Teste', color: '#22cc88' });
    const team = engine.managedTeam(c)!;
    expect(team).toMatchObject({ name: 'Scuderia Teste', shortName: 'ST', color: '#22cc88' });
    expect(c.teams).toHaveLength(10);
    expect(engine.rankTeams(c.teams)[9]!.id).toBe(team.id);
    expect(c.finance.cash).toBe(3_000_000 - cost);
    expect(c.management).toMatchObject({ position: 'owner', engineers: 1, mechanics: 1, facilities: { simulator: 0, windTunnel: 0, factory: 0 }, staff: [] });
    expect(c.drivers.filter((d) => d.teamId === team.id && d.role !== 'reserve')).toHaveLength(2);
    expectValid(c);
    expect(() => engine.startExecutiveSeason(retired, { kind: 'found', categoryId: 'f4', name: 'X', color: '#22cc88' })).toThrow(/nome/);
  });

  it('chefe contratado: recebe salário por etapa e é demitido depois de duas temporadas abaixo da meta', () => {
    const retired = retiredCareer(55, 100_000, 95);
    const offer = retired.executiveOffseason!.jobOffers.find((o) => o.categoryId === 'f1')!;
    let c = engine.startExecutiveSeason(retired, { kind: 'job', offerId: offer.id });
    expect(c.management).toMatchObject({ position: 'principal', salary: offer.salary, boardTarget: offer.target });
    const one = playExecutiveRound(c);
    expect(one.finance.seasonTotals.salary).toBe(Math.round(offer.salary / c.calendar.length));

    // Carro sabotado para o teste: a equipe termina no fundo do grid.
    const wreck = (state: CareerState): CareerState => ({
      ...state,
      teams: state.teams.map((t) => (t.id === state.management!.teamId ? { ...t, car: { engine: 45, chassis: 45, reliability: 60 } } : t)),
    });
    c = playExecutiveSeason(wreck(c));
    expect(c.executiveOffseason).toMatchObject({ objectiveMet: false, dismissed: false });
    expect(c.management!.strikes).toBe(1);
    c = playExecutiveSeason(wreck(botExecutiveOffseason(c)));
    expect(c.executiveOffseason!.dismissed).toBe(true);
    expect(c.executiveOffseason!.candidates).toEqual([]);
    expect(() => engine.startExecutiveSeason(c, { kind: 'continue' })).toThrow();
    const after = botExecutiveOffseason(c);
    expect(after.management?.teamId).not.toBe(offer.teamId);
    expectValid(after);
  });

  it('equipe técnica, departamentos e instalações mudam a pesquisa, os boxes e o caixa', () => {
    const c = ownerCareer('f1', 9);
    const m = c.management!;
    const rate = engine.researchRate(m);
    // Diretor técnico melhor.
    const director = m.staffMarket.filter((s) => s.role === 'technicalDirector').sort((a, b) => b.rating - a.rating)[0]!;
    const hired = engine.hireStaff({ ...c, management: { ...m, staffMarket: [...m.staffMarket, { ...director, id: 'star', rating: 95 }] } }, 'star');
    expect(engine.researchRate(hired.management!)).toBeGreaterThan(rate);
    expect(hired.management!.budget).toBeLessThan(m.budget);
    // Mais engenheiros e simulador.
    const bigger = engine.setDepartment(c, 'engineers', 5);
    expect(engine.researchRate(bigger.management!)).toBeCloseTo((rate * engine.engineeringCapacity({ engineers: 5 })) / engine.engineeringCapacity(m), 5);
    const rich = { ...c, management: { ...m, budget: 100_000_000 } };
    const simulator = engine.upgradeFacility(rich, 'simulator');
    expect(simulator.management!.facilities.simulator).toBe(m.facilities.simulator + 1);
    expect(simulator.management!.budget).toBe(100_000_000 - engine.facilityUpgradeCost(m, 'simulator'));
    expect(engine.researchRate(simulator.management!)).toBeGreaterThan(rate);
    expect(() => engine.upgradeFacility(c, 'factory')).toThrow(/caixa/);
    // Mecânicos: a equipe de box do campeonato muda junto.
    const crew = engine.managedTeam(c)!.crew;
    expect(engine.managedTeam(engine.setDepartment(c, 'mechanics', 5))!.crew).toBeGreaterThan(crew);
    // Só o dono contrata um chefe de equipe.
    const principal = m.staffMarket.find((s) => s.role === 'principal')!;
    expect(engine.hireStaff(c, principal.id).management!.staff.some((s) => s.role === 'principal')).toBe(true);
    expect(() => engine.hireStaff({ ...c, management: { ...m, position: 'principal' } }, principal.id)).toThrow(/dono/);
  });

  it('dono movimenta o caixa: aporte sai do bolso; retirada exige reserva e vira renda tributável', () => {
    const c = ownerCareer('f3', 8);
    const m = c.management!;
    const funded = engine.ownerTransfer(c, 200_000);
    expect(funded.management!.budget).toBe(m.budget + 200_000);
    expect(funded.finance.cash).toBe(c.finance.cash - 200_000);
    const withdrawn = engine.ownerTransfer(funded, -150_000);
    expect(withdrawn.finance.seasonTotals.dividends).toBe(150_000);
    expect(() => engine.ownerTransfer(c, -m.budget)).toThrow(/reserva/);
    // Prejuízo no fim do ano sai do bolso do dono.
    const broke = playExecutiveSeason({ ...c, management: { ...m, budget: -5_000_000 } });
    expect(broke.management!.budget).toBe(0);
    expect(broke.finance.reports[broke.finance.reports.length - 1]!.totals.team).toBeLessThan(0);
  });
});

/* ------------------------------------------------------------------ */

describe('desenvolvimento técnico', () => {
  it('a pesquisa vira melhorias no carro, na área escolhida', () => {
    let c = ownerCareer('f1', 9);
    c = engine.setDepartment(c, 'engineers', 5);
    c = engine.setDevelopment(
      { ...c, management: { ...c.management!, budget: 200_000_000 } },
      { spend: 'high', allocation: { aero: 0, chassis: 0, engine: 1, suspension: 0, manufacturing: 0 } },
    );
    const before = engine.managedTeam(c)!.car;
    for (let i = 0; i < 6; i++) c = playExecutiveRound(c);
    const after = engine.managedTeam(c)!.car;
    const gains = c.management!.development.gains;
    expect(gains.engine).toBeGreaterThanOrEqual(2);
    expect(gains.aero + gains.chassis + gains.suspension + gains.manufacturing).toBe(0);
    expect(after.engine).toBeCloseTo(before.engine + gains.engine * 0.8, 5);
    expect(after.chassis).toBe(before.chassis);
    expect(c.management!.ledger.research).toBeLessThan(0);
    // As rivais também evoluem.
    expect(Object.values(c.management!.fieldGains).every((g) => g > 0)).toBe(true);
    expectValid(c);
  });

  it('cada melhoria seguinte custa mais pesquisa, e há um limite por área', () => {
    expect(engine.researchNeeded(1)).toBeGreaterThan(engine.researchNeeded(0));
    let c = ownerCareer('f3', 8);
    c = engine.setDevelopment(
      { ...c, management: { ...c.management!, engineers: 5, budget: 50_000_000 } },
      { spend: 'high', allocation: { aero: 0, chassis: 0, engine: 0, suspension: 1, manufacturing: 0 } },
    );
    c = playExecutiveSeason(c);
    expect(c.management!.development.gains.suspension).toBe(REGULATIONS.f3.maxGainsPerArea);
  });

  it('regulamento: categoria monomarca não permite mexer em motor, chassi ou aerodinâmica', () => {
    const c = ownerCareer('f3', 8);
    const next = engine.setDevelopment(c, { allocation: { aero: 1, chassis: 1, engine: 1, suspension: 1, manufacturing: 1 } });
    expect(next.management!.development.allocation).toEqual({ aero: 0, chassis: 0, engine: 0, suspension: 0.5, manufacturing: 0.5 });
    expect(() => engine.upgradeFacility({ ...c, management: { ...c.management!, budget: 1e9 } }, 'windTunnel')).toThrow(/regulamento/);
    const engineBefore = engine.managedTeam(c)!.car.engine;
    let played: CareerState = { ...c, management: { ...c.management!, engineers: 5, budget: 50_000_000 } };
    for (let i = 0; i < 5; i++) played = playExecutiveRound(played);
    expect(engine.managedTeam(played)!.car.engine).toBe(engineBefore);
    // No kart, o motor é lacrado, mas o chassi é livre.
    expect(engine.normalizeAllocation('kart-regional', { aero: 1, chassis: 1, engine: 1, suspension: 0, manufacturing: 0 })).toEqual({
      aero: 0,
      chassis: 1,
      engine: 0,
      suspension: 0,
      manufacturing: 0,
    });
  });

  it('Fórmula 1: teto de gastos interrompe a pesquisa; túnel de vento rende menos para quem terminou na frente', () => {
    let c = ownerCareer('f1', 9);
    c = engine.setDevelopment({ ...c, management: { ...c.management!, engineers: 5, budget: 500_000_000 } }, { spend: 'high' });
    c = playExecutiveSeason(c);
    const cap = TEAM_ECONOMY.f1.budgetCap!;
    expect(c.management!.development.spent).toBeLessThanOrEqual(cap);
    expect(-(c.management!.ledger.research ?? 0)).toBeLessThanOrEqual(cap);
    expect(c.inbox.some((m) => m.title === 'Teto de gastos atingido') || c.management!.development.spent === cap).toBe(true);
    const m = c.management!;
    expect(engine.windTunnelAllowance({ ...m, previousPosition: 1 })).toBeLessThan(engine.windTunnelAllowance({ ...m, previousPosition: 10 }));
  });

  it('gestão ativa faz diferença: investir em estrutura e pesquisa melhora o carro em relação ao grid', () => {
    const strength = (state: CareerState) => {
      const team = engine.managedTeam(state)!;
      const others = state.teams.filter((t) => t.id !== team.id);
      const avg = others.reduce((sum, t) => sum + (t.car.engine + t.car.chassis) / 2, 0) / others.length;
      return (team.car.engine + team.car.chassis) / 2 - avg;
    };
    const run = (active: boolean) => {
      let c = ownerCareer('f1', 9, 61);
      const initial = strength(c);
      for (let season = 0; season < 4; season++) {
        if (active) {
          c = { ...c, management: { ...c.management!, budget: Math.max(c.management!.budget, season === 0 ? 400_000_000 : 150_000_000) } };
          c = engine.setDepartment(engine.setDepartment(c, 'engineers', 5), 'mechanics', 5);
          for (const key of ['simulator', 'windTunnel', 'factory'] as const) while (c.management!.facilities[key] < 5) c = engine.upgradeFacility(c, key);
          for (const role of ['technicalDirector', 'chiefEngineer'] as const) {
            const best = c.management!.staffMarket.filter((s) => s.role === role).sort((a, b) => b.rating - a.rating)[0];
            if (best && best.rating > engine.staffRating(c.management!, role)) c = engine.hireStaff(c, best.id);
          }
          c = engine.setDevelopment(c, { spend: 'high' });
        } else {
          c = engine.setDevelopment(c, { spend: 'low' });
        }
        c = botExecutiveOffseason(playExecutiveSeason(c));
      }
      return strength(c) - initial;
    };
    const active = run(true);
    const passive = run(false);
    expect(active).toBeGreaterThan(passive + 2);
    expect(active).toBeGreaterThan(0);
  }, 120_000);
});

/* ------------------------------------------------------------------ */

describe('pilotos da equipe', () => {
  it('escalação: só entra quem aceita a equipe; os escolhidos correm por ela no ano seguinte', () => {
    const c = playExecutiveSeason(ownerCareer('f3', 8));
    const off = c.executiveOffseason!;
    const rookie = off.candidates.find((x) => x.origin === 'rookie')!;
    const current = off.candidates.find((x) => x.origin === 'current' && x.willing)!;
    const picked = engine.setLineup(c, [current.driverId, rookie.driverId]);
    const refused = off.candidates.find((x) => !x.willing);
    if (refused) expect(() => engine.setLineup(c, [refused.driverId, rookie.driverId])).toThrow(/não aceita/);
    expect(() => engine.setLineup(c, [rookie.driverId, rookie.driverId])).toThrow();
    const next = engine.startExecutiveSeason(resolvePending(picked), { kind: 'continue' });
    const teamId = next.management!.teamId;
    expect(next.drivers.find((d) => d.id === current.driverId)).toMatchObject({ teamId, role: 'first' });
    expect(next.drivers.find((d) => d.id === rookie.driverId)).toMatchObject({ teamId, role: 'second' });
    expect(next.management!.deals[rookie.driverId]).toMatchObject({ seatFee: rookie.seatFee, salary: rookie.salary });
    expectValid(next);
    expect(() => engine.startExecutiveSeason(resolvePending(engine.setLineup(c, [current.driverId])), { kind: 'continue' })).toThrow(/dois pilotos/);
  });

  it('pilotos melhores pagam menos pela vaga; na F1, pedem salário maior', () => {
    const weak = {
      attributes: { pace: 70, consistency: 70, overtaking: 70, defending: 70, focus: 70, racecraft: 70, tyreManagement: 70, wetSkill: 70, experience: 70 },
    };
    const strong = {
      attributes: { pace: 86, consistency: 86, overtaking: 86, defending: 86, focus: 86, racecraft: 86, tyreManagement: 86, wetSkill: 86, experience: 86 },
    };
    expect(engine.driverTerms('f3', 4, strong).seatFee).toBeLessThan(engine.driverTerms('f3', 4, weak).seatFee);
    expect(engine.driverTerms('f1', 4, strong).salary).toBeGreaterThan(engine.driverTerms('f1', 4, weak).salary);
    expect(engine.driverTerms('f1', 4, strong).ambition).toBeGreaterThan(engine.driverTerms('f1', 4, weak).ambition);
  });

  it('um filho pode correr pela equipe da família: entra no campeonato e a temporada dele passa a ser a real', () => {
    let c = ownerCareer('kart-regional', 8, 63);
    const base = { ...c, family: { ...c.family, partner: engine.generatePartner(1, 40, 1) } };
    const kid = childOf(base, 9, { age: 15, kartYears: 6, talent: 88, interest: 80 });
    c = engine.startChildCareer({ ...base, family: { ...base.family, children: [kid] } }, kid.id, 'full');
    c = playExecutiveSeason(c);
    const candidate = c.executiveOffseason!.candidates.find((x) => x.origin === 'child')!;
    expect(candidate).toMatchObject({ childId: kid.id, willing: true, seatFee: 0 });
    const other = c.executiveOffseason!.candidates.find((x) => x.origin === 'current' && x.willing)!;
    c = engine.startExecutiveSeason(resolvePending(engine.setLineup(c, [other.driverId, candidate.driverId])), { kind: 'continue' });
    const teamId = c.management!.teamId;
    expect(c.drivers.find((d) => d.id === candidate.driverId)).toMatchObject({ teamId, role: 'second', isPlayer: false });
    expect(c.family.children[0]!.racing).toMatchObject({ categoryId: 'kart-regional', familyCost: 0 });
    expectValid(c);

    const seasons = c.family.children[0]!.racing!.seasons.length;
    c = playExecutiveSeason(c);
    const child = c.family.children[0]!;
    const last = child.racing!.seasons[child.racing!.seasons.length - 1]!;
    expect(child.racing!.seasons).toHaveLength(seasons + 1);
    expect(last.inWorld).toBe(true);
    expect(last.position).toBe(engine.driverStandings(c).find((s) => s.driverId === candidate.driverId)!.position);
    expect(c.executiveOffseason!.candidates.find((x) => x.driverId === candidate.driverId)).toMatchObject({ origin: 'child' });
    // Fora da escalação, ele volta a correr por conta própria e sai do campeonato do jogador.
    const others = c
      .executiveOffseason!.candidates.filter((x) => x.origin !== 'child' && x.willing)
      .slice(0, 2)
      .map((x) => x.driverId);
    const next = engine.startExecutiveSeason(resolvePending(engine.setLineup(c, others)), { kind: 'continue' });
    expect(next.drivers.some((d) => d.id === candidate.driverId)).toBe(false);
    expect(next.family.children[0]!.stage).toBe('racing');
    expectValid(next);
  }, 60_000);

  it('vender a equipe: o valor entra no patrimônio, com imposto sobre o ganho', () => {
    const c = playExecutiveSeason(ownerCareer('f3', 8));
    const value = engine.ownedTeamValue(c);
    const sold = engine.leaveTeam(c);
    expect(sold.management).toBeNull();
    expect(sold.finance.cash).toBeGreaterThan(c.finance.cash + value * 0.8);
    expect(sold.executiveOffseason!.candidates).toEqual([]);
    expect(() => engine.startExecutiveSeason(c, { kind: 'spectate' })).toThrow(/Venda/);
    const next = engine.startExecutiveSeason(resolvePending(sold), { kind: 'spectate' });
    expect(next.management).toBeNull();
    expectValid(next);
  });
});

/* ------------------------------------------------------------------ */

describe('morte e sucessão', () => {
  it('o risco de morte cresce com a idade', () => {
    expect(engine.mortalityRisk(30)).toBeLessThan(engine.mortalityRisk(65));
    expect(engine.mortalityRisk(65)).toBeLessThan(engine.mortalityRisk(85));
    expect(engine.mortalityRisk(95)).toBe(0.3);
  });

  it('sem família: sempre há um parente jovem para continuar nas pistas', () => {
    const closed = withCash(resolvePending(playSeason(newCareer(71))), 2_000_000);
    const c = engine.beginSuccession(closed, 'death');
    const s = c.succession!;
    expect(s.heirs.some((h) => h.canDrive)).toBe(true);
    expect(s.heirs.some((h) => h.canManage)).toBe(true);
    expect(s.estate).toBe(engine.netWorth(closed.finance));
    expect(s.tax).toBe(Math.round((s.estate - ASSET_RULES.INHERITANCE_EXEMPT) * ASSET_RULES.INHERITANCE_TAX));
    expectValid(c);
    // Com a sucessão aberta, o jogo não anda.
    expect(() => engine.startNextSeason(c, pickBestOffer(closed))).toThrow(/herdeiro/);

    const heir = engine.resolveSuccession(c, 'relative-driver', 'driver');
    const player = engine.getPlayer(heir);
    expect(heir.succession).toBeNull();
    expect(heir.mode).toBe('driver');
    expect(heir.season).toBe(2);
    expect(heir.categoryId).toBe('kart-regional');
    expect(player.lastName).toBe('Teste');
    expect(player.id).not.toBe('player');
    expect(heir.dynasty.generation).toBe(2);
    expect(heir.dynasty.lineage).toHaveLength(2);
    expect(heir.dynasty.lineage[0]).toMatchObject({ endReason: 'death', toSeason: 1 });
    expect(heir.finance.cash).toBe(2_000_000 - s.tax);
    expect(heir.history).toHaveLength(1);
    expectValid(heir);
    // A carreira do herdeiro é jogável.
    const played = playSeason(heir);
    expect(played.offseason).not.toBeNull();
    expectValid(engine.startNextSeason(resolvePending(played), pickBestOffer(played)));
  });

  it('um filho piloto herda a carreira: assume na categoria dele, com o patrimônio (menos imposto e a parte dos irmãos)', () => {
    let c = withCash(resolvePending(playSeason(careerWithPartner(73, 80, true))), 10_000_000);
    const heirKid = childOf(c, 1, { id: 'kid-a', age: 17, kartYears: 6, talent: 90 });
    const sibling = childOf(c, 2, { id: 'kid-b', age: 9, firstName: 'Caçula' });
    c = engine.startChildCareer({ ...c, family: { ...c.family, children: [heirKid, sibling] } }, 'kid-a', 'full');
    const racing = {
      ...c.family.children[0]!.racing!,
      categoryId: 'f4' as const,
      teamRank: 2,
      reputation: 40,
      license: [{ season: 1, categoryId: 'kart-international' as const, position: 2, points: 12 }],
    };
    c = { ...c, family: { ...c.family, children: [{ ...c.family.children[0]!, racing }, sibling] } };

    const opened = engine.beginSuccession(c, 'death');
    const options = opened.succession!.heirs;
    expect(options.find((h) => h.id === 'kid-a')).toMatchObject({ canDrive: true, canManage: false });
    expect(options.find((h) => h.id === 'kid-b')).toMatchObject({ canDrive: false, canManage: false });
    expect(options.find((h) => h.id === 'partner')).toMatchObject({ canManage: true });
    expect(() => engine.resolveSuccession(opened, 'kid-b', 'driver')).toThrow();
    expect(() => engine.resolveSuccession(opened, 'kid-a', 'executive')).toThrow();

    const heir = engine.resolveSuccession(opened, 'kid-a', 'driver');
    const player = engine.getPlayer(heir);
    const { estate, tax } = opened.succession!;
    expect(player).toMatchObject({ id: 'dyn-kid-a', firstName: heirKid.firstName, isPlayer: true });
    expect(heir.categoryId).toBe('f4');
    expect(engine.rankTeams(heir.teams).findIndex((t) => t.id === player.teamId)).toBe(2);
    expect(heir.contract).toMatchObject({ teamId: player.teamId, categoryId: 'f4' });
    expect(heir.reputation).toBe(40);
    expect(heir.license.history).toEqual(racing.license);
    expect(heir.finance.cash).toBe(10_000_000 - tax - Math.round((estate - tax) * ASSET_RULES.SIBLING_SHARE));
    expect(heir.finance.seasonTotals.inheritance).toBeUndefined();
    expect(heir.family).toEqual({ partner: null, children: [], divorces: 0 });
    expect(heir.dynasty.lineage[1]).toMatchObject({ generation: 2, driverId: 'dyn-kid-a' });
    expectValid(heir);
    expectValid(playRound(heir));
  });

  it('o cônjuge pode assumir os negócios e, depois, passar o comando a um filho', () => {
    let c = ownerCareer('kart-national', 8, 75);
    const partner = { ...engine.generatePartner(3, 45, 1), married: true, relationship: 80 };
    const kid = childOf({ ...c, family: { ...c.family, partner } }, 4, { id: 'kid-c', age: 12 });
    c = playExecutiveSeason({ ...c, family: { partner, children: [kid], divorces: 0 } });
    const teamId = c.management!.teamId;

    const widow = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'partner', 'executive');
    expect(engine.getPlayer(widow)).toMatchObject({ firstName: partner.firstName, teamId: null, isPlayer: true });
    expect(widow.management).toMatchObject({ teamId, position: 'owner' });
    expect(widow.family.partner).toBeNull();
    expect(widow.family.children).toHaveLength(1);
    expect(widow.executiveLog).toEqual([]);
    expect(widow.dynasty.generation).toBe(2);
    expect(widow.executiveOffseason).not.toBeNull();
    expectValid(widow);

    // Seis anos depois, o filho é adulto e recebe o comando em vida (imposto menor).
    let state = botExecutiveOffseason(widow);
    for (let year = 0; year < 6; year++) {
      state = playExecutiveSeason(state);
      if (state.succession) break;
      if (year < 5) state = botExecutiveOffseason(state);
    }
    if (!state.succession) {
      expect(state.family.children[0]!.age).toBeGreaterThanOrEqual(18);
      const handover = engine.beginHandover(state);
      expect(handover.succession).toMatchObject({ cause: 'handover' });
      expect(handover.succession!.tax).toBe(Math.max(0, Math.round((handover.succession!.estate - ASSET_RULES.INHERITANCE_EXEMPT) * ASSET_RULES.HANDOVER_TAX)));
      expect(engine.cancelHandover(handover).succession).toBeNull();
      const child = engine.resolveSuccession(handover, 'kid-c', 'executive');
      expect(engine.getPlayer(child).firstName).toBe(kid.firstName);
      expect(child.management).toMatchObject({ teamId, position: 'owner' });
      expect(child.dynasty.generation).toBe(3);
      expect(child.family.children).toEqual([]);
      expectValid(child);
      expectValid(playExecutiveSeason(botExecutiveOffseason(child)));
    }
  }, 60_000);

  it('morte de um piloto em atividade: um herdeiro adulto pode assumir só os negócios', () => {
    const closed = withCash(resolvePending(playSeason(careerWithPartner(85, 80, true))), 3_000_000);
    const opened = engine.beginSuccession(closed, 'death');
    const widow = engine.resolveSuccession(opened, 'partner', 'executive');
    expect(widow.mode).toBe('executive');
    expect(widow.offseason).toBeNull();
    expect(widow.executiveOffseason!.summary).toMatchObject({ mode: 'driver', season: 1 });
    expect(engine.getPlayer(widow).teamId).toBeNull();
    // O piloto que morreu fica na lista só até a temporada ser arquivada, sem equipe e fora do mercado.
    expect(widow.drivers.find((d) => d.id === 'player')).toMatchObject({ isPlayer: false, teamId: null });
    expectValid(widow);
    const next = botExecutiveOffseason(widow);
    expect(next.drivers.some((d) => d.id === 'player')).toBe(false);
    expectValid(playExecutiveSeason(next));
  });

  it('um filho que corria pela equipe da família deixa o carro ao assumir o comando dela', () => {
    let c = ownerCareer('kart-regional', 8, 87);
    const base = { ...c, family: { ...c.family, partner: engine.generatePartner(1, 45, 1) } };
    const kid = childOf(base, 9, { id: 'kid-d', age: 18, kartYears: 6, talent: 88, interest: 80 });
    c = engine.startChildCareer({ ...base, family: { ...base.family, children: [kid] } }, kid.id, 'full');
    c = playExecutiveSeason(c);
    const candidate = c.executiveOffseason!.candidates.find((x) => x.origin === 'child')!;
    const other = c.executiveOffseason!.candidates.find((x) => x.origin === 'current' && x.willing)!;
    c = engine.startExecutiveSeason(resolvePending(engine.setLineup(c, [other.driverId, candidate.driverId])), { kind: 'continue' });
    c = playExecutiveSeason(c);
    const teamId = c.management!.teamId;

    const heir = engine.resolveSuccession(engine.beginSuccession(resolvePending(c), 'death'), 'kid-d', 'executive');
    const player = engine.getPlayer(heir);
    expect(player).toMatchObject({ id: candidate.driverId, firstName: kid.firstName, teamId: null, isPlayer: true });
    expect(heir.management).toMatchObject({ teamId, position: 'owner' });
    expect(heir.drivers.filter((d) => d.teamId === teamId && d.role !== 'reserve')).toHaveLength(2);
    // O novo dono não aparece na lista de pilotos da própria equipe.
    expect(heir.executiveOffseason!.candidates.some((x) => x.driverId === player.id)).toBe(false);
    expect(heir.executiveOffseason!.lineup).toHaveLength(2);
    expectValid(heir);
    expectValid(playExecutiveSeason(botExecutiveOffseason(heir)));
  }, 60_000);

  it('herdeiro piloto de um dono de equipe: a equipe vira participação de 100% e segue pagando dividendos', () => {
    const c = playExecutiveSeason(ownerCareer('f3', 8, 77));
    const team = engine.managedTeam(c)!;
    const heir = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'relative-driver', 'driver');
    expect(heir.management).toBeNull();
    expect(heir.mode).toBe('driver');
    expect(heir.finance.stakes).toHaveLength(1);
    expect(heir.finance.stakes[0]).toMatchObject({ teamId: team.id, teamName: team.name, share: 1, categoryId: 'f3' });
    expectValid(heir);
    const closed = playSeason(heir);
    expect(closed.finance.stakes[0]!.lastDividend).not.toBe(0);
  });

  it('acidente fatal no meio da temporada: o reserva assume, o jogo espera o herdeiro e a carreira continua', () => {
    let c = newCareer(79);
    for (let i = 0; i < 4; i++) c = playRound(c);
    const team = engine.getPlayer(c).teamId!;
    const opened = engine.beginSuccession(resolvePending(c), 'accident');
    expect(opened.succession).toMatchObject({ cause: 'accident' });
    expect(engine.getPlayer(opened).teamId).toBeNull();
    expect(opened.drivers.filter((d) => d.teamId === team && d.role !== 'reserve')).toHaveLength(2);
    expectValid(opened);
    expect(() => engine.startWeekend(opened)).toThrow(/herdeiro/);
    const heir = engine.resolveSuccession(opened, 'relative-driver', 'driver');
    expect(heir.season).toBe(2);
    expect(heir.history[0]).toMatchObject({ season: 1, mode: 'driver' });
    expect(heir.history[0]!.rounds).toHaveLength(4);
    expectValid(heir);
    // Lesão grave em corrida: a checagem só pode abrir sucessão quando o piloto se feriu.
    expect(engine.checkFatalAccident(c, 1, 4, false).succession).toBeNull();
  });

  it('a sucessão sobrevive ao save: exportar e importar no meio da escolha', () => {
    const closed = resolvePending(playSeason(careerWithPartner(81, 80, true)));
    const opened = engine.beginSuccession(closed, 'death');
    const loaded = importCareer(exportCareer(opened, NOW));
    expect(loaded.succession).toEqual(opened.succession);
    const a = engine.resolveSuccession(opened, 'relative-driver', 'driver');
    const b = engine.resolveSuccession(loaded, 'relative-driver', 'driver');
    expect(b).toEqual(a);
  });
});

/* ------------------------------------------------------------------ */

describe('compatibilidade com saves da Fase 2', () => {
  const load = (name: string) => importCareer(readFileSync(`tests/fixtures/v2/${name}.json`, 'utf8'));
  const raw = (name: string) => JSON.parse(readFileSync(`tests/fixtures/v2/${name}.json`, 'utf8')) as { career: CareerState };
  const names = ['kart-mid-weekend', 'kart-pending-events', 'offseason', 'formula-mid-season'];
  /** A etapa sem a lista de lances da corrida, para comparar com o que o save antigo trazia. */
  const withoutMoments = ({ race: { moments: _moments, ...race }, ...round }: RoundRecord) => ({ ...round, race });

  it('os arquivos são mesmo da versão 2', () => {
    for (const name of names) expect(raw(name).career.schemaVersion).toBe(2);
  });

  it('todos migram para a versão atual sem perder nada do que já existia', () => {
    for (const name of names) {
      const before = raw(name).career;
      const c = load(name);
      expect(c.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
      expectValid(c);
      // Tudo o que o save tinha continua igual. As corridas guardadas só ganham a lista de lances
      // decisivos (save v8, Fase 4), vazia: elas foram disputadas antes de os lances existirem.
      expect(c.drivers).toEqual(before.drivers);
      expect(c.teams).toEqual(before.teams);
      expect(c.rounds.every((r) => r.race.moments.length === 0)).toBe(true);
      expect(c.rounds.map(withoutMoments)).toEqual(before.rounds);
      expect(c.contract).toEqual(before.contract);
      expect(c.finance.cash).toBe(before.finance.cash);
      expect(c.finance.transactions).toEqual(before.finance.transactions);
      expect(c.history.every((season) => season.rounds.every((r) => r.race.moments.length === 0))).toBe(true);
      expect(c.history.map(({ mode: _mode, rounds, ...rest }) => ({ ...rest, rounds: rounds.map(withoutMoments) }))).toEqual(before.history);
      expect(c.offseason).toEqual(before.offseason);
      // Sistemas novos no estado inicial.
      expect(c).toMatchObject({ mode: 'driver', management: null, succession: null, executiveOffseason: null, family: { partner: null, children: [] } });
      expect(c.dynasty.lineage[0]).toMatchObject({ driverId: c.playerDriverId, generation: 1 });
      expect(c.finance).toMatchObject({ stocks: [], properties: [], loans: [], lifestyle: 'frugal' });
      expect(c.tutorial.dismissed).toBe(true);
    }
  });

  it('save no meio de um fim de semana: a corrida é disputada e a temporada termina', () => {
    const c = load('kart-mid-weekend');
    expect(c.weekend).toMatchObject({ phase: 'race' });
    const race = engine.simulateRemainingRace(engine.createWeekendRace(c), engine.buildRaceContext(c), { mode: 'balanced', auto: true });
    const finished = playSeason(engine.completeWeekend(c, race));
    expect(finished.offseason).not.toBeNull();
    expectValid(finished);
  });

  it('save no fechamento de temporada: dá para assinar, ou se aposentar e virar dirigente', () => {
    const c = load('offseason');
    const next = engine.startNextSeason(c, pickBestOffer(c));
    expect(next.season).toBe(c.season + 1);
    expectValid(next);
    const retired = engine.retireFromDriving(c);
    expectValid(retired);
    expectValid(playExecutiveSeason(botExecutiveOffseason(retired)));
  });

  it('save de monoposto no meio da temporada: segue jogável, com os sistemas novos funcionando', () => {
    let c = load('formula-mid-season');
    const stock = STOCKS[0]!;
    c = engine.buyStock(withCash(c, Math.max(c.finance.cash, 100_000)), stock.id, 10);
    c = playRound(c);
    expect(c.finance.stockPrices[stock.id]).not.toBe(stock.startPrice);
    expectValid(c);
    expectValid(importCareer(exportCareer(c, NOW)));
  });
});

/* ------------------------------------------------------------------ */

describe('auditoria: dívida, insolvência e brechas fechadas', () => {
  it('dívida de piloto: quem tem bens não tem dívida perdoada; os credores executam o patrimônio', () => {
    const closed = resolvePending(playSeason(newCareer(93)));
    // A rede de segurança não exige nada: com qualquer dívida, a temporada seguinte começa.
    const offer = closed.offseason!.offers.find((o) => o.kind === 'fallback')!.id;
    // Sem bens: a dívida acima do teto é perdoada, com dano à reputação (regra da Fase 2).
    const broke = engine.startNextSeason(withCash(closed, -5_000_000), offer);
    expect(broke.finance.cash).toBeGreaterThan(-200_000);
    expect(broke.reputation).toBeLessThan(closed.reputation);
    // Com o mesmo valor aplicado em renda fixa e ações, a dívida é paga com os bens e nada é perdoado.
    const stock = STOCKS[0]!;
    const rich: CareerState = {
      ...closed,
      finance: { ...closed.finance, cash: -5_000_000, fixedIncome: 3_000_000, stocks: [{ stockId: stock.id, shares: 100_000, avgCost: stock.startPrice }] },
    };
    const settled = engine.startNextSeason(rich, offer);
    expect(settled.reputation).toBe(closed.reputation);
    expect(settled.finance.fixedIncome).toBe(0);
    expect(settled.finance.stocks[0]!.shares).toBeLessThan(100_000);
    expect(engine.netWorth(settled.finance)).toBeGreaterThan(engine.netWorth(rich.finance) - 400_000);
    expect(settled.inbox.some((m) => /credores executaram/.test(m.body))).toBe(true);
    expectValid(settled);
  });

  it('execução de bens: aplicações primeiro, depois ações, imóveis, empresas e participações', () => {
    let c = withReputation(withCash(newCareer(95), 3_000_000), 50);
    c = engine.buyProperty(engine.openBusiness(engine.invest(c, { product: 'fixedIncome', amount: 100_000 }), 'escola'), 'apartamento', 'rented');
    const little = engine.liquidateAssets(c.finance, 1, 1, 60_000);
    expect(little).toMatchObject({ raised: 60_000, sold: ['renda fixa'] });
    expect(little.finance.fixedIncome).toBe(40_000);
    expect(little.finance.properties).toHaveLength(1);
    const more = engine.liquidateAssets(c.finance, 1, 1, 150_000);
    expect(more.sold).toEqual(['renda fixa', 'Apartamento na cidade']);
    expect(more.finance.businesses).toHaveLength(1);
    expect(more.raised).toBeGreaterThanOrEqual(150_000);
    const settlement = engine.settleDebts({ ...c.finance, cash: -1_000_000 }, 1, 1, 10_000);
    expect(settlement.finance.properties).toHaveLength(0);
    expect(settlement.finance.businesses).toHaveLength(0);
    expect(settlement.finance.cash).toBe(-10_000);
    expect(settlement.forgiven).toBeGreaterThan(0);
  });

  it('dirigente insolvente: bens executados, equipe vendida à força e, por último, acordo com credores', () => {
    const owner = ownerCareer('f3', 8, 97);
    const team = engine.managedTeam(owner)!;
    const debt = playExecutiveSeason(withCash(owner, -80_000_000));
    expect(debt.management).toBeNull();
    expect(debt.executiveOffseason!.candidates).toEqual([]);
    expect(debt.executiveOffseason!.notes.some((n) => n.includes(`vender a ${team.name}`))).toBe(true);
    expect(debt.finance.cash).toBe(-engine.livingCostBase(debt) * 2);
    expect(debt.reputation).toBeLessThan(owner.reputation);
    expectValid(debt);
    expectValid(botExecutiveOffseason(debt));
    // Uma dívida pequena não custa a equipe.
    const fine = playExecutiveSeason(withCash(owner, -20_000));
    expect(fine.management).not.toBeNull();
  });

  it('custo de vida fora das pistas acompanha o prestígio, não a categoria acompanhada', () => {
    const star = engine.startExecutiveSeason(retiredCareer(99, 1_000_000, 90), { kind: 'spectate' });
    expect(star.categoryId).toBe('kart-regional');
    expect(engine.livingCostBase(star)).toBe(engine.getCategory('f1').economy.living);
    expect(engine.livingCostBase(withReputation(star, 8))).toBe(engine.getCategory('kart-regional').economy.living);
    const played = playExecutiveRound(star);
    expect(played.finance.seasonTotals.living).toBe(-Math.round(engine.getCategory('f1').economy.living / 10));
  });

  it('empréstimo contratado no meio do ano só paga juros pela parte que falta', () => {
    let c = withCash(newCareer(101), 50_000);
    for (let i = 0; i < 5; i++) c = playRound(c);
    c = resolvePending(c);
    const cash = c.finance.cash;
    const loaned = engine.takeLoan(c, 20_000, 2);
    const loan = loaned.finance.loans[0]!;
    // Quitar na mesma hora devolve exatamente o que foi emprestado.
    expect(engine.loanPayoff(loaned, loan)).toBe(20_000);
    expect(engine.repayLoan(loaned, loan.id).finance.cash).toBe(cash);
    // No fechamento, metade do ano de juros.
    const closed = playSeason(loaned);
    const after = closed.finance.loans[0]!;
    const paid = Math.round(loan.annualPayment / 10) * 5;
    expect(after.balance).toBe(Math.round(20_000 * (1 + ASSET_RULES.LOAN_RATE) - Math.round(20_000 * ASSET_RULES.LOAN_RATE * 0.5) - paid));
    // No fechamento da temporada, um empréstimo novo não carrega juros do ano que acabou.
    const late = engine.takeLoan(closed, 10_000, 2);
    expect(engine.loanPayoff(late, late.finance.loans[1]!)).toBe(10_000);
  });

  it('comprar uma equipe da qual já se é sócio: a participação entra no negócio', () => {
    const retired = retiredCareer(103, 5_000_000, 40);
    const listing = retired.executiveOffseason!.listings.find((l) => l.categoryId === 'kart-regional' && l.rank === 8)!;
    const partner = engine.buyStake(retired, listing.teamId, 0.25);
    const stake = partner.finance.stakes[0]!;
    const owner = engine.startExecutiveSeason(partner, { kind: 'buy', listingId: listing.id });
    expect(owner.finance.stakes).toEqual([]);
    expect(owner.finance.cash).toBe(partner.finance.cash - (listing.price - stake.value));
    expect(owner.management).toMatchObject({ position: 'owner', teamId: listing.teamId });
    expectValid(owner);
  });

  it('ao deixar a equipe, os ganhos do ano das rivais são descontados (os carros não inflam)', () => {
    const c = playExecutiveSeason(ownerCareer('f1', 9, 105));
    const m = c.management!;
    const gains = Object.values(m.fieldGains);
    const mean = gains.reduce((a, b) => a + b, 0) / gains.length;
    expect(mean).toBeGreaterThan(1);
    const rival = c.teams.find((t) => t.id !== m.teamId && t.car.engine < 95)!;
    const sold = engine.leaveTeam(c);
    expect(sold.teams.find((t) => t.id === rival.id)!.car.engine).toBeCloseTo(rival.car.engine - mean, 1);
    expect(engine.normalizeFieldDevelopment(sold)).toBe(sold.teams);
  });

  it('equipe técnica: a renovação não acumula reajustes de salário', () => {
    let c = ownerCareer('f3', 8, 107);
    for (let year = 0; year < 8; year++) c = playExecutiveSeason(year === 0 ? c : botExecutiveOffseason(c));
    for (const person of c.management!.staff) expect(person.salary).toBeLessThanOrEqual(engine.staffSalary('f3', 97, person.role));
  }, 60_000);

  it('participação em equipe fora do campeonato acompanhado: a posição volta para a força original da equipe', () => {
    const c = withCash(newCareer(109), 5_000_000);
    const best = engine.rankTeams(c.teams)[0]!;
    let state = engine.buyStake(c, best.id, 0.25);
    // O jogador muda de categoria: a equipe do kart regional deixa de ser simulada.
    state = { ...state, categoryId: 'kart-national' };
    const positions: number[] = [];
    for (let year = 0; year < 30; year++) {
      state = { ...state, season: state.season + 1, finance: engine.closeAssetsYear(state).finance };
      positions.push(state.finance.stakes[0]!.lastPosition);
    }
    const average = positions.reduce((a, b) => a + b, 0) / positions.length;
    expect(average).toBeLessThan(3);
    expect(Math.max(...positions)).toBeLessThanOrEqual(6);
  });

  it('fundar ou comprar uma equipe para revender em seguida não dá lucro, em nenhuma categoria', () => {
    for (const categoryId of ['kart-regional', 'kart-national', 'kart-international', 'f4', 'f3', 'f2', 'f1'] as const) {
      const retired = retiredCareer(113, 500_000_000, 60);
      const founded = engine.startExecutiveSeason(retired, { kind: 'found', categoryId, name: 'Revenda Rápida', color: '#123456' });
      expect(engine.ownedTeamValue(founded), `fundar na ${categoryId}`).toBeLessThan(engine.foundingCost(categoryId));
      for (const rank of [5, 8, 9] as const) {
        const listing = retired.executiveOffseason!.listings.find((l) => l.categoryId === categoryId && l.rank === rank)!;
        const bought = engine.startExecutiveSeason(retired, { kind: 'buy', listingId: listing.id });
        expect(engine.ownedTeamValue(bought), `comprar a ${rank + 1}ª da ${categoryId}`).toBeLessThan(listing.price);
      }
    }
  });

  it('patrocinador que rompe o contrato arranha a reputação da equipe', () => {
    const c = ownerCareer('f3', 8, 115);
    const m = c.management!;
    // Mesma temporada, com e sem um patrocinador que exigia o título.
    const demanding = { ...m, sponsors: m.sponsors.map((s, i) => (i === 0 ? { ...s, targetPosition: 1 } : s)) };
    const calm = playExecutiveSeason(c);
    const broken = playExecutiveSeason({ ...c, management: demanding });
    expect(broken.management!.sponsors).toHaveLength(calm.management!.sponsors.length - 1);
    expect(broken.management!.reputation).toBe(calm.management!.reputation - MANAGEMENT.BROKEN_SPONSOR_REPUTATION);
  });

  it('gravação recusa uma carreira com estrutura inválida, sem precisar da ida e volta por JSON', async () => {
    const c = newCareer(117);
    const storage = new MemoryStorage();
    await expect(saveCareer(storage, 'slot1', { ...c, reputation: Number.NaN }, NOW)).rejects.toThrow(/estrutura inválida|inconsistente/);
    await expect(saveCareer(storage, 'slot1', { ...c, finance: { ...c.finance, lifestyle: 'nababo' as never } }, NOW)).rejects.toThrow(/estrutura inválida/);
    expect(await storage.get('slot1')).toBeUndefined();
  });

  it('avaliação dos treinadores só aparece depois que o filho pilota; o tutorial some no modo dirigente', () => {
    const c = careerWithPartner(119);
    const kid = childOf(c, 3, { talent: 91 });
    expect(engine.childScoutReport(kid)).toBeNull();
    expect(engine.childScoutReport({ ...kid, stage: 'karting', kartYears: 1 })).toBe('Fora de série');
    expect(engine.childScoutReport({ ...kid, stage: 'karting', kartYears: 1, talent: 70 })).toBe('Limitado');
    expect(engine.tutorialActive(newCareer(119))).toBe(true);
    expect(engine.tutorialActive(engine.retireFromDriving(resolvePending(playSeason(newCareer(119)))))).toBe(false);
  });

  it('mortalidade e idade: ninguém passa dos 100 anos, e quem largou as pistas não guarda dados de piloto', () => {
    expect(engine.mortalityRisk(99)).toBe(0.3);
    expect(engine.mortalityRisk(100)).toBe(1);
    const c = careerWithPartner(111);
    const kid = childOf(c, 3, { id: 'kid-q', age: 16, kartYears: 6 });
    const racing = engine.startChildCareer({ ...c, family: { ...c.family, children: [kid] } }, 'kid-q', 'full');
    const quit = { ...racing, family: { ...racing.family, children: racing.family.children.map((k) => ({ ...k, stage: 'other' as const })) } };
    const after = engine.closeFamilyYear(quit).family.children[0]!;
    expect(after.driver).toBeNull();
    expect(after.racing).not.toBeNull();
    expectValid({ ...quit, family: engine.closeFamilyYear(quit).family });
  });
});

describe('saves no modo dirigente', () => {
  it('salvar e carregar funciona fora das pistas: sem equipe, como dono e com sucessão aberta', async () => {
    const storage = new MemoryStorage();
    const spectator = engine.startExecutiveSeason(retiredCareer(83), { kind: 'spectate' });
    const owner = playExecutiveRound(ownerCareer('f3', 8, 83));
    const succession = engine.beginSuccession(resolvePending(owner), 'death');
    for (const [slot, state] of [
      ['slot1', spectator],
      ['slot2', owner],
      ['slot3', succession],
    ] as const) {
      const envelope = await saveCareer(storage, slot, state, NOW);
      expect(envelope.summary.playerName).toBe('Ana Teste');
      expect((await loadCareer(storage, slot)).career).toEqual(state);
    }
    expect(summarize(spectator)).toMatchObject({ teamName: 'Sem equipe', championshipPosition: null });
    expect(summarize(owner)).toMatchObject({ teamName: engine.managedTeam(owner)!.name, championshipPosition: engine.managedTeamPosition(owner) });
  });
});

describe('uma vida inteira e além', () => {
  it('piloto, dirigente, morte e herdeiro: o save continua válido por 60 temporadas e atravessa gerações', () => {
    let c = botCareer(2, 4);
    const modes = new Set<string>();
    let guard = 0;
    while (c.season < 60 && guard++ < 300) {
      c = playLifeSeason(c, { retireAge: 36, choices: { approach: 'attack' } });
      modes.add(c.management ? `executive:${c.management.position}` : c.mode);
      expectValid(c);
    }
    expect(c.season).toBe(60);
    expect(c.history).toHaveLength(59);
    expect(modes.has('driver')).toBe(true);
    expect(modes.has('executive:principal')).toBe(true);
    expect(c.dynasty.generation).toBeGreaterThanOrEqual(2);
    expect(c.dynasty.lineage).toHaveLength(c.dynasty.generation);
    expect(c.dynasty.lineage[0]).toMatchObject({ endReason: 'death' });
    expect(c.dynasty.lineage[0]!.netWorthPassed).toBeGreaterThan(0);
    // O save completo passa pelo ciclo de exportar e importar e não cresce sem limite.
    const json = exportCareer(c, NOW);
    expect(importCareer(json)).toEqual(c);
    expect(json.length).toBeLessThan(9_000_000);
  }, 240_000);

  it('é determinística: a mesma semente e as mesmas decisões dão a mesma vida', () => {
    const run = () => {
      let c = botCareer(5, 8);
      for (let i = 0; i < 12; i++) c = playLifeSeason(c, { retireAge: 22, buyTeam: true });
      return c;
    };
    expect(run()).toEqual(run());
  }, 120_000);
});

/* ------------------------------------------------------------------ */

describe('tutorial', () => {
  it('os passos são concluídos pelo que o jogador faz', () => {
    let c = newCareer(91);
    expect(engine.tutorialActive(c)).toBe(true);
    const done = (state: CareerState) =>
      engine
        .tutorialSteps(state)
        .filter((s) => s.done)
        .map((s) => s.id);
    expect(done(c)).toEqual([]);
    c = engine.visitTutorialRoute(c, '/driver');
    expect(done(c)).toEqual(['driver']);
    expect(engine.visitTutorialRoute(c, '/driver')).toBe(c);
    c = playRound(c);
    expect(done(c)).toContain('race');
    const closed = playSeason(c);
    const next = engine.startNextSeason(resolvePending(closed), pickBestOffer(closed));
    expect(done(next)).toContain('season');
    expect(engine.tutorialActive(engine.dismissTutorial(next))).toBe(false);
  });
});
