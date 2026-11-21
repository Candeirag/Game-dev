/**
 * Fase 3 da grande atualização: economia, polos e portas.
 *
 * A regra de ouro: sempre existe uma saída, mesmo para o pobre. Aqui ficam as regras que a
 * sustentam: custos de correr, vaga de aluguel, patrocinadores em escada que rompem quando a meta
 * não é cumprida, academia, vaquinha, investidor (com a fatia para sempre) e trabalho paralelo.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACADEMY_DOOR, CROWDFUND, HUB_RULES, INVESTOR, RUNNING_COSTS, SIDE_JOBS, SPONSOR_LADDER, TEAM_CASH_CALL } from '@/config/balance';
import type { CareerState, Investor, Offer, Sponsor } from '@/domain/schemas';
import { CATEGORIES, getCategory } from '@/data/categories';
import { CATEGORY_HUB, HUBS, RENTAL_CATEGORY } from '@/data/hubs';
import { closeSeasonFinance, emptyFinance, payInvestor, settleRound } from '@/engine/career/economy';
import { applyEffects } from '@/engine/events/effects';
import { instantiateEvent } from '@/engine/events/engine';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { importCareer } from '@/persistence/saveService';
import { MIGRATIONS, migrateStep } from '@/persistence/migrations';
import { runSimulation } from '../sim/run';
import {
  buildOffer,
  buildSponsor,
  canAcceptOffer,
  canJoinAcademy,
  canLaunchCrowdfund,
  canSignInvestor,
  careerTitles,
  convertToExecutive,
  crowdfundAmount,
  crowdfundTarget,
  doorFor,
  economyTrainingFactor,
  financeProjection,
  generateOffers,
  getPlayer,
  hasOpenDoor,
  investorAmount,
  investorTerms,
  joinAcademyDoor,
  lastResortActive,
  launchCrowdfund,
  learningLanguage,
  maxSponsors,
  missedTarget,
  moveCost,
  offerHelp,
  offerPricing,
  pathsReport,
  rankTeams,
  renewSponsors,
  seasonRunningCosts,
  setSideJob,
  signInvestor,
  sponsorBaseFor,
  sponsorTierFor,
  startNextSeason,
  withLastResortOffer,
} from './engineApi';
import { botOffseason, botTraining, newCareer, pickBestOffer, playRound, playSeason } from './helpers';

const entry = (position: number, extra: Record<string, unknown> = {}) => ({
  driverId: 'player',
  teamId: 'cerrado',
  position,
  grid: 10,
  status: 'finished' as const,
  lapsCompleted: 20,
  totalTime: 1000,
  bestLap: 50,
  overtakes: 0,
  errors: 0,
  points: 0,
  pitStops: 0,
  penaltySeconds: 0,
  penaltyPoints: 0,
  damage: 0,
  injured: false,
  ...extra,
});

const sponsorOf = (tier: 1 | 2 | 3, extra: Partial<Sponsor> = {}): Sponsor => ({
  id: `s${tier}`,
  name: `Patrocinador ${tier}`,
  tier,
  perSeason: 9_000,
  podiumBonus: 0,
  endSeason: 99,
  satisfaction: 80,
  targetPosition: 10,
  ...extra,
});

const investorOf = (extra: Partial<Investor> = {}): Investor => ({
  name: 'Largada Capital',
  share: 0.2,
  sinceSeason: 1,
  invested: 50_000,
  received: 0,
  seats: 1,
  funded: null,
  ...extra,
});

/** Estreante no fim da primeira temporada de kart regional, com as propostas na mesa (sem trabalho paralelo). */
const closed: CareerState = { ...playSeason(botTraining(newCareer(42))), sideJob: 'none' };
/** Só o apoio da família, sem patrocinador comercial. */
const familyOnly = closed.sponsors.filter((s) => s.tier === 0);
const offseason = closed.offseason!;
/** O mesmo fechamento, como se o piloto tivesse terminado em outra posição. */
const finishing = (position: number, career: CareerState = closed): CareerState => ({
  ...career,
  offseason: { ...career.offseason!, playerPosition: position },
});
/** Uma proposta de transferência de uma equipe do meio do grid, para os testes das portas. */
const midfieldOffer = (career: CareerState): Offer => {
  const category = getCategory(career.categoryId);
  const ranked = rankTeams(career.teams);
  const team = ranked.find((t, i) => i >= 4 && t.id !== getPlayer(career).teamId)!;
  return { ...buildOffer(career, category, team, ranked.indexOf(team), 'transfer', 60), id: 'offer-teste' };
};
/**
 * O caso relatado pelo dono no teste da Fase 3: piloto que termina a Fórmula Júnior em 6º, com o
 * contrato vencido, sem patrocinador, sem academia e com o caixa em −R$ 73 mil. É o save de exemplo
 * do monoposto no fim da temporada, refeito nessas condições, com as propostas geradas de novo.
 */
const juniorSixth: CareerState = (() => {
  const base = importCareer(readFileSync('tests/fixtures/v7/monoposto-fim-de-temporada.json', 'utf8'));
  const state: CareerState = {
    ...base,
    academy: null,
    investor: null,
    sponsors: [],
    finance: emptyFinance(-73_000),
    contract: { ...base.contract, endSeason: base.season },
    offseason: { ...base.offseason!, playerPosition: 6, contractStatus: 'expired', offers: [] },
  };
  const offers = generateOffers({ ...state, offseason: null }, state.offseason!.reputationAfter, 'expired', 6);
  return { ...state, offseason: { ...state.offseason!, offers } };
})();

const withOffer = (career: CareerState, offer: Offer): CareerState => ({
  ...career,
  offseason: { ...career.offseason!, offers: [offer, ...career.offseason!.offers.filter((o) => o.kind === 'fallback')] },
});

describe('polos e campeonatos', () => {
  it('cada campeonato tem um polo: São Paulo até a Fórmula Júnior, Itália no kart internacional, Inglaterra nas fórmulas de cima', () => {
    expect(CATEGORIES.map((c) => CATEGORY_HUB[c.id])).toEqual(['sao-paulo', 'sao-paulo', 'italia', 'sao-paulo', 'inglaterra', 'inglaterra', 'inglaterra']);
    expect(HUBS.filter((h) => h.foreign).map((h) => h.id)).toEqual(['italia', 'inglaterra']);
  });

  it('o kart regional roda pelo estado de São Paulo e o Brasileiro, por várias cidades do país', () => {
    const regional = new Set(getCategory('kart-regional').trackIds);
    expect([...regional].sort()).toEqual(['cerrado-paulista', 'mantiqueira', 'vale-do-sol']);
    expect(getCategory('kart-regional').trackIds).toHaveLength(getCategory('kart-regional').rounds);
    expect(new Set(getCategory('kart-national').trackIds).size).toBe(10);
  });

  it('a carreira nova mora em São Paulo e não paga mudança nem aluguel para correr no Brasil', () => {
    const c = newCareer();
    expect(c.hub).toEqual({ id: 'sao-paulo', arrivedSeason: 1 });
    expect(moveCost(c, 'kart-national')).toBe(0);
    expect(moveCost(c, 'f4')).toBe(0);
    expect(moveCost(c, 'kart-international')).toBe(HUB_RULES.MOVE_COST.italia);
    expect(moveCost(c, 'f3')).toBe(HUB_RULES.MOVE_COST.inglaterra);
    expect(seasonRunningCosts('kart-regional', 'sao-paulo').housing).toBe(0);
    expect(seasonRunningCosts('kart-international', 'italia').housing).toBe(HUB_RULES.RENT_PER_SEASON.italia);
  });

  it('os preços sobem muito a cada degrau', () => {
    const paid = CATEGORIES.filter((c) => c.economy.seatCost[1] > 0);
    paid.forEach((category, i) => {
      const next = paid[i + 1];
      // A Fórmula Júnior, no Brasil, e o kart internacional, na Itália, são alternativas no mesmo degrau da escada.
      if (!next || category.id === 'kart-international') return;
      expect(next.economy.seatCost[1], `${next.id} depois de ${category.id}`).toBeGreaterThan(category.economy.seatCost[1] * 1.5);
    });
    expect(getCategory('f4').economy.seatCost[1]).toBeGreaterThan(getCategory('kart-national').economy.seatCost[1] * 5);
  });
});

describe('custos de correr', () => {
  const c = newCareer();

  it('cada etapa cobra a viagem e a parcela do equipamento, além da vaga, da vida e do treino', () => {
    const totals = settleRound(c, 1, entry(12)).finance.seasonTotals;
    expect(totals.travel).toBe(-RUNNING_COSTS.TRAVEL_PER_ROUND['kart-regional']);
    expect(totals.equipment).toBe(-Math.round(RUNNING_COSTS.EQUIPMENT_PER_SEASON['kart-regional'] / c.calendar.length));
    // Morando em São Paulo, não há aluguel de polo.
    expect(totals.housing).toBeUndefined();
  });

  it('quem mora num polo de fora paga o aluguel em parcelas', () => {
    const abroad: CareerState = { ...c, hub: { id: 'italia', arrivedSeason: 1 } };
    expect(settleRound(abroad, 1, entry(12)).finance.seasonTotals.housing).toBe(-Math.round(HUB_RULES.RENT_PER_SEASON.italia / c.calendar.length));
  });

  it('a vaga de aluguel custa dinheiro: terminar mal deixou de ser de graça', () => {
    const fallback = offseason.offers.find((o) => o.kind === 'fallback')!;
    expect(fallback.seatCost).toBe(getCategory('kart-regional').economy.seatCost[1] * RUNNING_COSTS.FALLBACK_SEAT_SHARE);
    expect(canAcceptOffer(closed, fallback)).toBe(true);
    // Sem patrocínio e sem a família, o ano na vaga de aluguel fecha no vermelho.
    const alone: CareerState = { ...closed, sponsors: [] };
    expect(financeProjection(alone, fallback).seasonFlow).toBeLessThan(-fallback.seatCost);
  });

  it('quem cai, cai um degrau só: a vaga de aluguel fica sempre na categoria abaixo', () => {
    expect(RENTAL_CATEGORY).toEqual({
      'kart-regional': 'kart-regional',
      'kart-national': 'kart-regional',
      // A Fórmula Júnior e o kart internacional são alternativas no mesmo degrau: dos dois, a queda é para o Brasileiro.
      'kart-international': 'kart-national',
      f4: 'kart-national',
      f3: 'f4',
      f2: 'f3',
      f1: 'f2',
    });
    // Nem o piloto mais quebrado é mandado mais para baixo que isso.
    for (const cash of [50_000, -73_000, -5_000_000]) {
      const junior = generateOffers({ ...juniorSixth, finance: emptyFinance(cash) }, juniorSixth.reputation, 'expired', 6);
      expect(junior.filter((o) => o.kind === 'fallback').map((o) => o.categoryId)).toEqual(['kart-national']);
    }
    expect(offseason.offers.find((o) => o.kind === 'fallback')).toMatchObject({ categoryId: 'kart-regional' });
  });

  it('uma vaga que não custa mais que a de aluguel não é recusada por dinheiro', () => {
    const fallback = offseason.offers.find((o) => o.kind === 'fallback')!;
    const cheap: Offer = { ...midfieldOffer(closed), seatCost: fallback.seatCost - 1_000 };
    const broke = withOffer({ ...closed, finance: emptyFinance(-30_000), sponsors: [] }, cheap);
    expect(financeProjection(broke, cheap)).toMatchObject({ cheaperThanRental: true, met: true });
    expect(financeProjection(broke, { ...cheap, seatCost: fallback.seatCost + 5_000 }).met).toBe(false);
  });
});

describe('patrocinadores em escada', () => {
  it('comércio do bairro no kart regional, empresa regional no Brasileiro e na Fórmula Júnior', () => {
    expect(sponsorTierFor(40, getCategory('kart-regional'), 1, 3)).toBe(1);
    expect(sponsorTierFor(40, getCategory('kart-national'), 1, 3)).toBe(2);
    expect(sponsorTierFor(40, getCategory('f4'), 1, 3)).toBe(2);
    expect(SPONSOR_LADDER.MAX_TIER['kart-regional']).toBe(1);
  });

  it('marca grande só com título e visibilidade', () => {
    const sprint = getCategory('f3');
    const reputation = SPONSOR_LADDER.BIG_BRAND_MIN_REPUTATION;
    expect(sponsorTierFor(reputation, sprint, 1, 1)).toBe(3);
    // Sem título, ou com título e pouca reputação, o teto é a empresa regional.
    expect(sponsorTierFor(reputation + 30, sprint, 1, 0)).toBe(2);
    expect(sponsorTierFor(reputation - 1, sprint, 1, 2)).toBe(2);
  });

  it('os títulos contados são os das temporadas arquivadas do personagem atual', () => {
    expect(careerTitles(closed)).toBe(0);
    const second = startNextSeason(closed, pickBestOffer(closed));
    expect(second.history).toHaveLength(1);
    const champion: CareerState = { ...second, history: [{ ...second.history[0]!, playerPosition: 1 }] };
    expect(careerTitles(champion)).toBe(1);
    // Um título de outra geração da família não conta.
    const heir: CareerState = { ...champion, dynasty: { ...champion.dynasty, lineage: [{ ...champion.dynasty.lineage[0]!, fromSeason: 2 }] } };
    expect(careerTitles(heir)).toBe(0);
  });

  it('o comércio do bairro não acompanha o preço dos degraus de cima; a empresa regional, sim', () => {
    const regional = getCategory('kart-regional');
    const junior = getCategory('f4');
    expect(sponsorBaseFor(1, junior)).toBe(regional.economy.sponsorBase);
    expect(sponsorBaseFor(2, junior)).toBe(junior.economy.sponsorBase);
    const local = sponsorOf(1);
    const company = sponsorOf(2, { perSeason: 40_000 });
    const up = renewSponsors([local, company], 1, getCategory('kart-national'), junior).kept;
    expect(up[0]!.perSeason).toBe(local.perSeason);
    expect(up[1]!.perSeason).toBeGreaterThan(company.perSeason * 3);
  });

  it('o carisma aumenta o valor do patrocínio', () => {
    const base = newCareer(3);
    const withCharisma = (charisma: number): CareerState => ({ ...base, birth: { ...base.birth!, aptitudes: { ...base.birth!.aptitudes, charisma } } });
    expect(buildSponsor(withCharisma(90), 1, 1).perSeason).toBeGreaterThan(buildSponsor(withCharisma(20), 1, 1).perSeason);
  });
});

describe('rompimento de patrocínio', () => {
  const regional = getCategory('kart-regional');
  const family: Sponsor = { ...sponsorOf(1), id: 'family', tier: 0, targetPosition: 20 };

  it('quem não vê a meta cumprida rompe no fim da temporada, mesmo com contrato por vencer', () => {
    const sponsor = sponsorOf(2, { targetPosition: 10, endSeason: 5 });
    expect(missedTarget(sponsor, 11)).toBe(true);
    expect(missedTarget(sponsor, 10)).toBe(false);
    const result = renewSponsors([sponsor], 1, regional, regional, 11);
    expect(result.broken.map((s) => s.id)).toEqual([sponsor.id]);
    expect(result.kept).toEqual([]);
    expect(result.left).toEqual([]);
  });

  it('meta cumprida, contrato mantido; e o apoio da família não rompe por resultado', () => {
    const sponsor = sponsorOf(2, { targetPosition: 10, endSeason: 5 });
    const result = renewSponsors([sponsor, family], 1, regional, regional, 10);
    expect(result.broken).toEqual([]);
    expect(result.kept.map((s) => s.id)).toEqual([sponsor.id, 'family']);
    expect(renewSponsors([family], 1, regional, regional, 20).broken).toEqual([]);
  });

  it('sem a posição final (no meio do ano), ninguém rompe', () => {
    expect(renewSponsors([sponsorOf(2, { targetPosition: 1 })], 1, regional, regional).broken).toEqual([]);
  });

  it('na virada do ano o patrocinador sai, o dinheiro para de entrar e a notícia explica', () => {
    const sponsor = sponsorOf(1, { id: 'padaria', name: 'Padaria Estrela', targetPosition: offseason.playerPosition - 1, endSeason: 9 });
    const loyal = sponsorOf(1, { id: 'oficina', name: 'Oficina do Tonho', targetPosition: 20, endSeason: 9 });
    const career: CareerState = { ...closed, sponsors: [...closed.sponsors, sponsor, loyal] };
    // O fechamento já avisa quem vai romper.
    const next = startNextSeason(career, pickBestOffer(career));
    expect(next.sponsors.map((s) => s.id)).not.toContain('padaria');
    expect(next.sponsors.map((s) => s.id)).toContain('oficina');
    expect(next.inbox.some((m) => m.body.includes('Padaria Estrela rompeu o patrocínio'))).toBe(true);
    const round = settleRound(next, 1, entry(12)).finance.transactions.map((t) => t.label);
    expect(round).toContain('Oficina do Tonho');
    expect(round).not.toContain('Padaria Estrela');
  });

  it('o requisito financeiro de uma proposta já desconta quem vai romper', () => {
    const sponsor = sponsorOf(1, { perSeason: 30_000, targetPosition: 5, endSeason: 9 });
    const offer = midfieldOffer(closed);
    const kept = financeProjection(finishing(5, { ...closed, sponsors: [sponsor] }), offer).seasonFlow;
    const broken = financeProjection(finishing(6, { ...closed, sponsors: [sponsor] }), offer).seasonFlow;
    expect(kept - broken).toBe(30_000);
  });

  it('quem sobe de degrau com o piloto afrouxa a meta do primeiro ano, até o teto', () => {
    const sponsor = sponsorOf(2, { targetPosition: 10 });
    const up = renewSponsors([sponsor], 1, getCategory('kart-national'), getCategory('f4'), 3).kept[0]!;
    expect(up.targetPosition).toBe(10 + SPONSOR_LADDER.PROMOTION_TARGET_RELIEF);
    const local = renewSponsors([sponsorOf(1, { targetPosition: 15 })], 1, regional, getCategory('kart-national'), 3).kept[0]!;
    expect(local.targetPosition).toBe(SPONSOR_LADDER.MAX_TARGET);
  });
});

describe('investidor: porcentagem para sempre', () => {
  const offer = midfieldOffer(closed);
  /** Terceiro colocado, sem dinheiro para a vaga: o investidor é a porta. */
  const eligible = withOffer(finishing(3, { ...closed, finance: emptyFinance(0), sponsors: familyOnly }), offer);

  it('a fatia é uma conta simples sobre o ganho, lançada no extrato e somada no que ele já levou', () => {
    const investor = investorOf({ share: 0.2, received: 100 });
    const paid = payInvestor(emptyFinance(1_000), investor, 3, 2, 5_000);
    expect(paid.finance.cash).toBe(0);
    expect(paid.finance.seasonTotals.investor).toBe(-1_000);
    expect(paid.finance.transactions[0]).toMatchObject({ key: 'investor', amount: -1_000, label: 'Parte de Largada Capital (20% dos ganhos)' });
    expect(paid.investor?.received).toBe(1_100);
    // Sem investidor, ou sem ganho, nada muda.
    expect(payInvestor(emptyFinance(1_000), null, 3, 2, 5_000).finance.cash).toBe(1_000);
    expect(payInvestor(emptyFinance(1_000), investor, 3, 2, 0).finance.transactions).toEqual([]);
  });

  it('a fatia vem pela posição final: 10% até o 3º lugar, 15% até o 8º, e ninguém abaixo disso', () => {
    expect(investorTerms(finishing(3))).toMatchObject({ available: true, share: INVESTOR.SHARE_TOP3, lastResort: false });
    expect(investorTerms(finishing(8))).toMatchObject({ available: true, share: INVESTOR.SHARE_TOP8 });
    expect(investorTerms(finishing(9)).available).toBe(false);
  });

  it('o aporte paga a vaga daquela proposta e só vale para ela', () => {
    expect(canAcceptOffer(eligible, offer)).toBe(false);
    expect(doorFor(eligible, offer)).toBe('investor');
    const signed = signInvestor(eligible, offer.id);
    expect(signed.investor).toMatchObject({
      share: INVESTOR.SHARE_TOP3,
      invested: offer.seatCost,
      seats: 1,
      received: 0,
      funded: { season: 1, offerId: offer.id },
    });
    expect(signed.finance.cash).toBe(offer.seatCost);
    expect(canAcceptOffer(signed, offer)).toBe(true);
    // O dinheiro não pode ir para outra vaga, nem há um segundo aporte no mesmo ano.
    expect(() => startNextSeason(signed, pickBestOffer(signed) === offer.id ? 'offer-s1-fallback' : pickBestOffer(signed))).toThrow(
      'só vale para a vaga que ele pagou',
    );
    expect(canSignInvestor(signed, offer.id)).toBe(false);
    const next = startNextSeason(signed, offer.id);
    expect(next.investor).toMatchObject({ share: INVESTOR.SHARE_TOP3, funded: null });
  });

  it('a porcentagem vale para sempre: temporadas, equipes e campeonatos depois, ele continua levando a parte dele', () => {
    let career = startNextSeason(signInvestor(eligible, offer.id), offer.id);
    const name = career.investor!.name;
    for (let season = 0; season < 3; season++) {
      career = playSeason(botTraining(career));
      const next = botOffseason(career);
      career = startNextSeason(next.career, next.offerId);
      expect(career.investor?.name).toBe(name);
      expect(career.investor!.share).toBeGreaterThanOrEqual(INVESTOR.SHARE_TOP3);
    }
    // Anos depois, com salário de piloto profissional: a fatia sai de cada parcela e de cada bônus.
    const share = career.investor!.share;
    const pro: CareerState = {
      ...career,
      sponsors: [],
      contract: { ...career.contract, salary: 1_000_000, seatCost: 0, bonuses: { win: 50_000, podium: 20_000, point: 0, title: 0 } },
    };
    const round = settleRound(pro, 1, entry(1));
    const earnings = Math.round(1_000_000 / pro.calendar.length) + 50_000;
    expect(round.finance.seasonTotals.investor).toBe(-Math.round(earnings * share));
    expect(round.investor!.received).toBe(career.investor!.received + Math.round(earnings * share));
  }, 60_000);

  it('do patrocínio, ele só leva parte do que sobra depois de pagar a vaga', () => {
    const base: CareerState = { ...closed, investor: investorOf({ share: 0.2 }), contract: { ...closed.contract, salary: 0, seatCost: 20_000 } };
    const rounds = base.calendar.length;
    // Patrocínio menor que a vaga: nada para o investidor.
    const covered: CareerState = { ...base, sponsors: [sponsorOf(1, { perSeason: 20_000 })] };
    expect(settleRound(covered, 1, entry(12)).finance.seasonTotals.investor).toBeUndefined();
    // Patrocínio que passa da vaga: 20% da sobra. O apoio da família não entra na conta.
    const family: Sponsor = { ...sponsorOf(1, { perSeason: 500_000 }), id: 'family', tier: 0 };
    const surplus: CareerState = { ...base, sponsors: [sponsorOf(1, { perSeason: 50_000 }), family] };
    expect(settleRound(surplus, 1, entry(12)).finance.seasonTotals.investor).toBe(-Math.round(((50_000 - 20_000) / rounds) * 0.2));
  });

  it('cada vaga a mais soma à fatia, até o teto', () => {
    const second = withOffer(finishing(10, { ...closed, finance: emptyFinance(0), sponsors: familyOnly, investor: investorOf({ share: 0.15 }) }), offer);
    // Quem já tem investidor consegue outro aporte até o 12º lugar.
    expect(investorTerms(second)).toMatchObject({ available: true, added: INVESTOR.EXTRA_SEAT_SHARE });
    expect(signInvestor(second, offer.id).investor).toMatchObject({ share: 0.15 + INVESTOR.EXTRA_SEAT_SHARE, seats: 2, invested: 50_000 + offer.seatCost });
    const atCap = { ...second, investor: investorOf({ share: INVESTOR.MAX_SHARE }) };
    expect(investorTerms(atCap)).toMatchObject({ available: false, share: INVESTOR.MAX_SHARE });
  });

  it('a projeção de uma proposta já desconta a fatia do investidor', () => {
    const paid: Offer = { ...offer, salary: 100_000, seatCost: 0 };
    const free = financeProjection({ ...closed, sponsors: [] }, paid).seasonFlow;
    const cut = financeProjection({ ...closed, sponsors: [], investor: investorOf({ share: 0.2 }) }, paid).seasonFlow;
    expect(free - cut).toBe(20_000);
  });

  it('o aporte não paga imposto, e o que o investidor leva diminui a renda tributável', () => {
    const season = { ...closed, offseason: null };
    const clean = closeSeasonFinance({ ...season, finance: { ...emptyFinance(0), seasonTotals: { salary: 100_000 } } }).report.taxableIncome;
    const withAporte = closeSeasonFinance({
      ...season,
      finance: {
        ...emptyFinance(0),
        seasonTotals: { salary: 100_000, investor: 500_000 },
        transactions: [{ season: season.season, round: 1, key: 'investor', amount: 500_000, label: 'Aporte' }],
      },
    }).report.taxableIncome;
    expect(withAporte).toBe(clean);
    const withCut = closeSeasonFinance({
      ...season,
      finance: {
        ...emptyFinance(0),
        seasonTotals: { salary: 100_000, investor: -20_000 },
        transactions: [{ season: season.season, round: 1, key: 'investor', amount: -20_000, label: 'Parte' }],
      },
    }).report.taxableIncome;
    expect(withCut).toBe(clean - 20_000);
  });

  it('quem deixa as pistas deixa de dever ganhos de piloto', () => {
    expect(convertToExecutive({ ...closed, investor: investorOf(), sideJob: 'instructor' })).toMatchObject({
      investor: null,
      sideJob: 'none',
      crowdfund: null,
    });
  });
});

describe('último recurso: nunca uma parede sem porta', () => {
  const stuck: CareerState = finishing(19, { ...closed, finance: emptyFinance(-10_000), sponsors: [], noDoorSeasons: INVESTOR.LAST_RESORT_AFTER });

  it('depois de duas temporadas seguidas sem porta, o investidor aparece para qualquer piloto', () => {
    expect(lastResortActive({ ...stuck, noDoorSeasons: INVESTOR.LAST_RESORT_AFTER - 1 })).toBe(false);
    expect(lastResortActive(stuck)).toBe(true);
    expect(investorTerms(stuck)).toMatchObject({ available: true, lastResort: true, share: INVESTOR.LAST_RESORT_SHARE });
  });

  it('se nenhuma equipe fez proposta, ele traz uma vaga no meio do grid, antes da vaga de aluguel', () => {
    const fallback = stuck.offseason!.offers.filter((o) => o.kind === 'fallback');
    const offers = withLastResortOffer({ ...stuck, offseason: { ...stuck.offseason!, offers: fallback } }, fallback);
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({ categoryId: 'kart-regional', status: 'open', years: 1 });
    expect(offers[0]!.kind).not.toBe('fallback');
    expect(offers[1]!.kind).toBe('fallback');
    // Fora do último recurso, as propostas ficam como estão.
    expect(withLastResortOffer({ ...stuck, noDoorSeasons: 0 }, fallback)).toEqual(fallback);
  });

  it('o aporte de último recurso cobre a vaga e o que faltar para fechar o ano: a porta abre', () => {
    const fallback = stuck.offseason!.offers.filter((o) => o.kind === 'fallback');
    const career: CareerState = {
      ...stuck,
      offseason: { ...stuck.offseason!, offers: withLastResortOffer({ ...stuck, offseason: { ...stuck.offseason!, offers: fallback } }, fallback) },
    };
    const offer = career.offseason!.offers[0]!;
    expect(canAcceptOffer(career, offer)).toBe(false);
    expect(investorAmount(career, offer)).toBeGreaterThan(offer.seatCost);
    expect(doorFor(career, offer)).toBe('investor');
    expect(hasOpenDoor(career)).toBe(true);
    const next = startNextSeason(signInvestor(career, offer.id), offer.id);
    expect(next.investor?.share).toBe(INVESTOR.LAST_RESORT_SHARE);
    // A conta das temporadas sem porta recomeça.
    expect(next.noDoorSeasons).toBe(0);
  });

  it('um ano sem porta soma na conta; um ano com porta zera', () => {
    const noDoor: CareerState = finishing(19, {
      ...closed,
      finance: emptyFinance(-10_000),
      sponsors: [],
      offseason: { ...offseason, offers: offseason.offers.filter((o) => o.kind === 'fallback') },
    });
    expect(hasOpenDoor(noDoor)).toBe(false);
    expect(startNextSeason(noDoor, 'offer-s1-fallback').noDoorSeasons).toBe(1);
    expect(startNextSeason({ ...noDoor, noDoorSeasons: 1 }, 'offer-s1-fallback').noDoorSeasons).toBe(2);
    expect(hasOpenDoor(closed)).toBe(offseason.offers.some((o) => o.kind !== 'fallback' && doorFor(closed, o) !== null));
  });

  it('no simulador, nenhuma carreira fica mais de duas temporadas seguidas sem nenhuma porta, e terminar mal custa dinheiro', () => {
    const { summary } = runSimulation({ seeds: 8, seasons: 9, firstSeed: 1, talent: 0 });
    expect(summary.doors.longestNoDoorStreak).toBeLessThanOrEqual(INVESTOR.LAST_RESORT_AFTER);
    const [top, , , bottom] = summary.doors.yearResultByPosition;
    expect(bottom!.seasons).toBeGreaterThan(0);
    expect(bottom!.median).toBeLessThan(0);
    expect(bottom!.median).toBeLessThan(top!.median);
  }, 60_000);
});

describe('caso relatado: 6º na Fórmula Júnior com o caixa negativo', () => {
  const offers = juniorSixth.offseason!.offers;
  const real = offers.filter((o) => o.kind !== 'fallback');

  it('reproduz o problema: nenhuma proposta cabe no bolso, e o que barra é sempre o dinheiro', () => {
    expect(juniorSixth).toMatchObject({ categoryId: 'f4', finance: { cash: -73_000 } });
    expect(real.length).toBeGreaterThan(3);
    for (const offer of real) {
      expect(canAcceptOffer(juniorSixth, offer), offer.teamName).toBe(false);
      expect(offerHelp(juniorSixth, offer).missing.map((r) => r.key)).toEqual(['finance']);
    }
  });

  it('a vaga de aluguel é no Campeonato Brasileiro de Kart, um degrau abaixo, e não no kart regional', () => {
    const fallback = offers.find((o) => o.kind === 'fallback')!;
    expect(fallback.categoryId).toBe('kart-national');
    expect(canAcceptOffer(juniorSixth, fallback)).toBe(true);
  });

  it('o 6º lugar tem porta: o investidor banca qualquer uma das propostas, até a equipe aceitar', () => {
    expect(hasOpenDoor(juniorSixth)).toBe(true);
    for (const offer of real) {
      expect(doorFor(juniorSixth, offer), offer.teamName).toBe('investor');
      // O aporte cobre a vaga e o que faltava para fechar o ano.
      expect(investorAmount(juniorSixth, offer)).toBeGreaterThanOrEqual(offer.seatCost);
      expect(canAcceptOffer(signInvestor(juniorSixth, offer.id), offer)).toBe(true);
    }
  });

  it('a tela Carreira recebe, por proposta, o requisito que falta e a porta dos Caminhos que resolve', () => {
    const help = offerHelp(juniorSixth, real[0]!);
    expect(help.door).toBe('investor');
    expect(help.missing.map((r) => r.label)).toEqual(['Finanças']);
    expect(help.hint).toMatch(/O investidor abre esta vaga: põe .+ e fica com 15% dos seus ganhos para sempre\. Feche por Caminhos\./);
    // Sem porta nenhuma (10º lugar, fora do alcance do investidor), a frase diz isso e aponta a vaga de aluguel.
    const tenth: CareerState = { ...juniorSixth, offseason: { ...juniorSixth.offseason!, playerPosition: 10 } };
    expect(offerHelp(tenth, real[0]!)).toMatchObject({ door: null });
    expect(offerHelp(tenth, real[0]!).hint).toContain('nenhuma porta abre esta vaga agora');
    // Requisito esportivo em falta não se compra: nenhuma porta resolve.
    const promotion = real.find((o) => o.categoryId === 'f3');
    if (promotion) {
      const green: CareerState = { ...juniorSixth, license: { ...juniorSixth.license, history: [] } };
      const blocked = offerHelp(green, promotion);
      expect(blocked.door).toBeNull();
      expect(blocked.missing.some((r) => r.key === 'license')).toBe(true);
      expect(blocked.hint).toContain('Nenhuma porta compra requisito esportivo');
    }
    // Proposta que já pode ser assinada não pede nada.
    expect(offerHelp(closed, offseason.offers.find((o) => o.kind === 'fallback')!)).toEqual({ missing: [], door: null, hint: '' });
  });
});

describe('preço da vaga às claras', () => {
  it('a proposta com bolsa traz o preço cheio, a bolsa, o desconto da equipe e o valor final', () => {
    const national = getCategory('kart-national');
    const ranked = rankTeams(closed.teams);
    const champion = buildOffer(finishing(1), national, ranked[9]!, 9, 'promotion', 70, 0.6);
    const pricing = offerPricing(closed, { ...champion, teamId: 'x' });
    // Equipe fora da lista: vale o preço da melhor (posição 0). O que importa aqui é a conta.
    expect(pricing.listPrice).toBe(national.economy.seatCost[0]);
    const exact = offerPricing({ ...closed, categoryId: 'kart-national' }, { ...champion, teamId: ranked[9]!.id });
    expect(exact.listPrice).toBe(national.economy.seatCost[1]);
    expect(exact.scholarship).toBe(0.6);
    expect(exact.teamDiscount).toBeCloseTo(0.2, 5);
    expect(exact.discount).toBeCloseTo(0.8, 5);
    expect(champion.seatCost).toBe(national.economy.seatCost[1] * 0.2);
  });

  it('sem bolsa e sem desconto, o preço é o cheio; a vaga de aluguel não tem desconto', () => {
    const fallback = offseason.offers.find((o) => o.kind === 'fallback')!;
    expect(offerPricing(closed, fallback)).toEqual({ listPrice: fallback.seatCost, discount: 0, scholarship: 0, teamDiscount: 0 });
    const plain = buildOffer(closed, getCategory('kart-regional'), rankTeams(closed.teams)[9]!, 9, 'transfer', 50);
    expect(offerPricing(closed, plain)).toMatchObject({ listPrice: plain.seatCost, discount: 0 });
  });
});

describe('evento "A equipe pede um aporte extra"', () => {
  const season = playRound(playRound(newCareer(42)));
  const withCash = (cash: number): CareerState => ({ ...season, pendingEvents: [], eventLog: [], finance: emptyFinance(cash) });
  const payment = (career: CareerState) => {
    const event = instantiateEvent(career, 'contract-seat-increase', 3);
    const pay = event?.choices.find((c) => c.id === 'pay');
    const effect = pay?.outcomes[0]?.effects.find((e) => e.type === 'cash');
    return { event, pay, amount: effect && effect.type === 'cash' ? -effect.value : 0, effect };
  };

  it('pede no máximo uma parte do caixa do piloto', () => {
    const seat = season.contract.seatCost;
    // Com folga no caixa, o pedido é a fração da vaga.
    expect(payment(withCash(1_000_000)).amount).toBe(Math.floor((seat * TEAM_CASH_CALL.SEAT_SHARE) / 100) * 100);
    // Com pouco caixa, é limitado a 20% dele.
    const tight = payment(withCash(5_000));
    expect(tight.amount).toBe(5_000 * TEAM_CASH_CALL.MAX_CASH_SHARE);
    expect(tight.event?.body).toContain('o seu caixa não aguenta mais que isso');
  });

  it('a quem não tem caixa, a equipe não pede dinheiro: sobra recusar ou parcelar', () => {
    for (const cash of [0, -73_000, 1_000]) {
      const { event, pay } = payment(withCash(cash));
      expect(pay, `caixa ${cash}`).toBeUndefined();
      expect(event?.choices.map((c) => c.id)).toEqual(['refuse', 'split']);
    }
  });

  it('o pagamento nunca leva o saldo ao negativo, mesmo que o caixa encolha até a decisão', () => {
    const { effect } = payment(withCash(1_000_000));
    expect(effect).toMatchObject({ capToCash: true });
    // O caixa caiu para R$ 300 antes de o jogador decidir: sai só o que há.
    const poorer = applyEffects(withCash(300), [effect!], 3);
    expect(poorer.finance.cash).toBe(0);
    expect(applyEffects(withCash(-500), [effect!], 3).finance.cash).toBe(-500);
    // Os outros lançamentos de eventos continuam valendo inteiros.
    expect(applyEffects(withCash(300), [{ type: 'cash', value: -1_000, ledger: 'event', label: 'Multa' }], 3).finance.cash).toBe(-700);
  });
});

describe('academia: paga a vaga, cobra exclusividade e resultado', () => {
  const national: CareerState = { ...finishing(2), categoryId: 'kart-national' };

  it('a porta abre para quem termina entre os três primeiros, tem idade e não tem investidor', () => {
    expect(canJoinAcademy(national)).toBe(true);
    expect(canJoinAcademy(finishing(ACADEMY_DOOR.MAX_POSITION + 1, national))).toBe(false);
    // No kart regional as academias ainda não olham.
    expect(canJoinAcademy(finishing(1))).toBe(false);
    expect(canJoinAcademy({ ...national, investor: investorOf() })).toBe(false);
    const old = { ...national, drivers: national.drivers.map((d) => (d.isPlayer ? { ...d, age: ACADEMY_DOOR.MAX_AGE } : d)) };
    expect(canJoinAcademy(old)).toBe(false);
    // Só no fechamento do ano.
    expect(canJoinAcademy({ ...national, offseason: null })).toBe(false);
  });

  it('ela paga a vaga inteira e fica só com um patrocinador pessoal, o que paga mais', () => {
    const sponsors = [sponsorOf(1, { id: 'a', perSeason: 5_000 }), sponsorOf(2, { id: 'b', perSeason: 40_000 }), sponsorOf(1, { id: 'c', perSeason: 9_000 })];
    const family: Sponsor = { ...sponsorOf(1), id: 'family', tier: 0 };
    const joined = joinAcademyDoor({ ...national, sponsors: [family, ...sponsors] });
    expect(joined.academy).toMatchObject({ supportShare: ACADEMY_DOOR.SUPPORT_SHARE, targetPosition: ACADEMY_DOOR.TARGET_POSITION, strikes: 0 });
    expect(joined.sponsors.map((s) => s.id)).toEqual(['family', 'b']);
    expect(maxSponsors(joined)).toBe(ACADEMY_DOOR.MAX_PERSONAL_SPONSORS);
    expect(maxSponsors(national)).toBe(3);
    // A vaga sai de graça para o piloto.
    const round = settleRound({ ...joined, contract: { ...joined.contract, seatCost: 100_000 } }, 1, entry(5)).finance.seasonTotals;
    expect(round.academy).toBe(-round.seat!);
  });

  it('exclusividade: quem é de academia não tem investidor nem vaquinha', () => {
    const joined = joinAcademyDoor(national);
    expect(investorTerms(joined).available).toBe(false);
    expect(canLaunchCrowdfund(joined)).toBe(false);
    // O convite por evento entra pela mesma regra.
    const viaEvent = applyEffects(
      { ...national, sponsors: [sponsorOf(1, { id: 'a' }), sponsorOf(1, { id: 'b', perSeason: 12_000 })] },
      [{ type: 'joinAcademy', academy: joined.academy! }],
      1,
    );
    expect(viaEvent.sponsors.map((s) => s.id)).toEqual(['b']);
  });
});

describe('vaquinha da cidade', () => {
  const charismatic = (charisma: number, career: CareerState = closed): CareerState => ({
    ...career,
    birth: { ...career.birth!, aptitudes: { ...career.birth!.aptitudes, charisma } },
  });
  const good = charismatic(70, finishing(4));

  it('só com bom resultado e carisma', () => {
    expect(canLaunchCrowdfund(good)).toBe(true);
    expect(canLaunchCrowdfund(charismatic(CROWDFUND.MIN_CHARISMA - 1, finishing(4)))).toBe(false);
    expect(canLaunchCrowdfund(charismatic(70, finishing(CROWDFUND.MAX_POSITION + 1)))).toBe(false);
    // Quem não teve nascimento sorteado conta como carisma 50: abaixo do mínimo.
    expect(canLaunchCrowdfund({ ...good, birth: null })).toBe(false);
  });

  it('o dinheiro entra uma vez, cresce com o carisma, e a cidade passa a esperar um resultado', () => {
    expect(crowdfundAmount(charismatic(90, finishing(4)))).toBeGreaterThan(crowdfundAmount(good));
    const launched = launchCrowdfund(good);
    expect(launched.finance.cash).toBe(good.finance.cash + crowdfundAmount(good));
    expect(launched.crowdfund).toMatchObject({ season: 1, amount: crowdfundAmount(good), targetPosition: 4 + CROWDFUND.TARGET_SLACK, settled: false });
    expect(launched.finance.transactions[0]).toMatchObject({ key: 'crowdfund' });
    // Não dá para pedir de novo antes do intervalo.
    expect(canLaunchCrowdfund({ ...launched, season: 2 })).toBe(false);
    expect(canLaunchCrowdfund({ ...launched, season: 1 + CROWDFUND.COOLDOWN_SEASONS })).toBe(true);
  });

  it('a torcida cobra na temporada seguinte: quem decepciona perde moral e reputação', () => {
    const launched = launchCrowdfund(good);
    const fallback = launched.offseason!.offers.find((o) => o.kind === 'fallback')!;
    let career = startNextSeason(launched, canAcceptOffer(launched, launched.offseason!.offers[0]!) ? launched.offseason!.offers[0]!.id : fallback.id);
    expect(crowdfundTarget(career)).toBe(4 + CROWDFUND.TARGET_SLACK);
    // A pressão já pesa no começo do ano.
    expect(getPlayer(career).condition.morale).toBeLessThan(getPlayer(startNextSeason(good, pickBestOffer(good))).condition.morale + 1);
    // Uma meta impossível de cumprir, para o teste não depender do resultado do robô.
    career = playSeason(botTraining({ ...career, crowdfund: { ...career.crowdfund!, targetPosition: 0 } }));
    expect(career.crowdfund?.settled).toBe(true);
    expect(career.offseason!.notes.some((n) => n.includes('decepcionou a torcida'))).toBe(true);
    expect(crowdfundTarget(career)).toBeNull();
  });
});

describe('trabalhos paralelos', () => {
  const c = newCareer();

  it('dão dinheiro por etapa e tiram tempo de treino', () => {
    const instructor = setSideJob(c, 'instructor');
    expect(settleRound(instructor, 1, entry(12)).finance.seasonTotals.job).toBe(SIDE_JOBS.instructor.perRound);
    expect(settleRound(c, 1, entry(12)).finance.seasonTotals.job).toBeUndefined();
    expect(economyTrainingFactor(c)).toBe(1);
    expect(economyTrainingFactor(instructor)).toBe(SIDE_JOBS.instructor.training);
    expect(economyTrainingFactor(setSideJob(c, 'mechanic'))).toBe(SIDE_JOBS.mechanic.training);
  });

  it('o ajudante de mecânico paga menos pelo conserto depois de batida', () => {
    const full = settleRound(c, 1, entry(12, { damage: 1 })).finance.seasonTotals.damage!;
    const mechanic = settleRound(setSideJob(c, 'mechanic'), 1, entry(12, { damage: 1 })).finance.seasonTotals.damage!;
    expect(mechanic).toBe(Math.round(full * (1 - SIDE_JOBS.mechanic.damageDiscount)));
  });

  it('o treino da temporada rende menos para quem trabalha', () => {
    // O mesmo piloto, as mesmas etapas: a soma dos atributos treináveis cresce menos com o trabalho na oficina.
    const growth = (career: CareerState) => {
      let s = career;
      for (let i = 0; i < 6; i++) s = playRound(s);
      const attributes = getPlayer(s).attributes;
      return attributes.pace + attributes.racecraft + attributes.consistency + attributes.overtaking + attributes.defending + attributes.focus;
    };
    expect(growth(setSideJob(c, 'mechanic'))).toBeLessThan(growth(c));
  });

  it('acima da Fórmula Júnior a agenda não deixa, e o trabalho acaba quando o piloto sobe', () => {
    expect(() => setSideJob({ ...c, categoryId: 'f3' }, 'instructor')).toThrow('agenda');
    expect(setSideJob({ ...c, categoryId: 'f3', sideJob: 'instructor' }, 'none').sideJob).toBe('none');
    expect(() => setSideJob({ ...c, mode: 'executive' }, 'instructor')).toThrow();
  });
});

describe('mudança de polo', () => {
  it('é decisão grande: custa a mudança, o aluguel, um ano de idioma e a família longe', () => {
    // Um piloto com dinheiro e requisitos para subir, com uma proposta do kart internacional (Itália) e outra de casa.
    const ready: CareerState = {
      ...finishing(1),
      finance: emptyFinance(5_000_000),
      reputation: 60,
      offseason: { ...offseason, playerPosition: 1, reputationAfter: 60 },
      license: { ...closed.license, history: [{ season: 1, categoryId: 'kart-national', position: 1, points: 30 }] },
      drivers: closed.drivers.map((d) => (d.isPlayer ? { ...d, attributes: { ...d.attributes, experience: 60 } } : d)),
    };
    const international = getCategory('kart-international');
    const teams = rankTeams(closed.teams);
    const away: Offer = { ...buildOffer(ready, international, teams[5]!, 5, 'promotion', 70), teamId: 'x', id: 'offer-italia' };
    expect(financeProjection(ready, away).projected).toBeLessThan(5_000_000 - HUB_RULES.MOVE_COST.italia);
    const home = startNextSeason(ready, pickBestOffer(ready));
    expect(home.hub).toEqual({ id: 'sao-paulo', arrivedSeason: 1 });
    expect(home.finance.seasonTotals.moving).toBeUndefined();
    expect(learningLanguage(home)).toBe(false);

    const abroad: CareerState = { ...home, hub: { id: 'italia', arrivedSeason: home.season } };
    expect(learningLanguage(abroad)).toBe(true);
    expect(economyTrainingFactor(abroad)).toBe(HUB_RULES.LANGUAGE_TRAINING_FACTOR);
    // No segundo ano o idioma já não atrapalha.
    expect(economyTrainingFactor({ ...abroad, season: abroad.season + 1 })).toBe(1);
  });

  it('assinar com um campeonato de outro polo muda o piloto de país: mudança paga, moral e confiança da equipe mais baixas', () => {
    let career = playSeason(botTraining(newCareer(20260311)));
    // Sobe pelo jogo de verdade até aparecer uma proposta de fora que o piloto, com dinheiro, possa aceitar.
    for (let season = 0; season < 14; season++) {
      const rich: CareerState = { ...career, finance: emptyFinance(50_000_000) };
      const away = rich.offseason!.offers.find((o) => CATEGORY_HUB[o.categoryId] !== rich.hub.id && canAcceptOffer(rich, o));
      if (away) {
        const moved = startNextSeason(rich, away.id);
        const hubId = CATEGORY_HUB[away.categoryId];
        expect(moved.hub).toEqual({ id: hubId, arrivedSeason: moved.season });
        if (hubId !== 'sao-paulo') {
          expect(moved.finance.seasonTotals.moving).toBe(-HUB_RULES.MOVE_COST[hubId]);
          expect(learningLanguage(moved)).toBe(true);
          expect(moved.inbox.some((m) => m.body.includes('Você se muda para'))).toBe(true);
          expect(settleRound(moved, 1, entry(10)).finance.seasonTotals.housing).toBeLessThan(0);
        }
        return;
      }
      const next = botOffseason(rich);
      career = playSeason(botTraining(startNextSeason(next.career, next.offerId)));
    }
    throw new Error('Nenhuma proposta de outro polo em 14 temporadas.');
  }, 60_000);

  it('quem volta para o Brasil não paga mudança', () => {
    const abroad: CareerState = { ...closed, hub: { id: 'italia', arrivedSeason: 1 } };
    expect(moveCost(abroad, 'kart-national')).toBe(0);
    expect(moveCost(abroad, 'f3')).toBe(HUB_RULES.MOVE_COST.inglaterra);
  });
});

describe('tela Caminhos: o jogador nunca fica sem saber o que fazer', () => {
  it('lista as seis portas, e "mais um ano" nunca fecha', () => {
    const report = pathsReport(closed);
    expect(report.doors.map((d) => d.id)).toEqual(['own', 'academy', 'crowdfund', 'investor', 'job', 'wait']);
    expect(report.doors.find((d) => d.id === 'wait')?.status).toBe('open');
    expect(report.atOffseason).toBe(true);
    for (const door of report.doors) {
      expect(door.summary.length).toBeGreaterThan(10);
      expect(door.price.length).toBeGreaterThan(10);
      for (const r of door.requirements) {
        expect(r.progress).toBeGreaterThanOrEqual(0);
        expect(r.progress).toBeLessThanOrEqual(1);
        if (r.met) expect(r.progress).toBe(1);
      }
    }
  });

  it('diz quanto falta para a próxima vaga, com a bolsa da posição atual', () => {
    const champion = pathsReport(finishing(1, { ...closed, finance: emptyFinance(0), sponsors: [] }));
    const national = champion.next.find((n) => n.categoryId === 'kart-national')!;
    expect(national.scholarship).toBe(0.6);
    expect(national.seatAfterScholarship).toBe(getCategory('kart-national').economy.seatCost[1] * 0.4);
    expect(national.missing).toBe(national.seatAfterScholarship + national.runningCosts);
    expect(national.moveTo).toBeNull();
    expect(pathsReport(finishing(9)).next[0]!.scholarship).toBe(0);
    // Do Brasileiro, os dois caminhos de cima: a Fórmula Júnior, em casa, e o kart internacional, na Itália.
    const fromNational = pathsReport({ ...closed, categoryId: 'kart-national' });
    expect(fromNational.next.map((n) => n.categoryId).sort()).toEqual(['f4', 'kart-international']);
    expect(fromNational.next.find((n) => n.categoryId === 'kart-international')).toMatchObject({ moveTo: 'Itália', moveCost: HUB_RULES.MOVE_COST.italia });
  });

  it('acompanha as portas no meio da temporada e conta os anos sem porta', () => {
    let career = newCareer();
    const start = pathsReport(career);
    expect(start).toMatchObject({ position: null, atOffseason: false, noDoorSeasons: 0, lastResortIn: INVESTOR.LAST_RESORT_AFTER });
    // Antes da primeira etapa nenhuma porta que depende de resultado está aberta, mas o trabalho paralelo e "mais um ano", sim.
    expect(start.doors.filter((d) => d.status === 'open').map((d) => d.id)).toEqual(['job', 'wait']);
    career = playRound(playRound(career));
    expect(pathsReport(career).position).toBeGreaterThan(0);
    expect(pathsReport(setSideJob(career, 'instructor')).doors.find((d) => d.id === 'job')?.status).toBe('active');
    expect(pathsReport({ ...career, noDoorSeasons: 1 }).lastResortIn).toBe(INVESTOR.LAST_RESORT_AFTER - 1);
  });
});

describe('save v7: migração 6 → 7', () => {
  it('um save da versão 6 ganha o polo do seu campeonato e nenhum vínculo novo', () => {
    const { hub: _hub, investor: _investor, crowdfund: _crowdfund, sideJob: _sideJob, noDoorSeasons: _noDoor, ...v6 } = closed;
    const migrated = migrateStep({ ...v6, schemaVersion: 6, categoryId: 'f3' }, 6);
    expect(migrated).toMatchObject({
      schemaVersion: 7,
      hub: { id: 'inglaterra', arrivedSeason: 0 },
      investor: null,
      crowdfund: null,
      sideJob: 'none',
      noDoorSeasons: 0,
    });
    expect(migrateStep({ ...v6, schemaVersion: 6 }, 6).hub).toEqual({ id: 'sao-paulo', arrivedSeason: 0 });
    expect(Object.keys(MIGRATIONS).map(Number)).toContain(6);
  });

  it('rodar a migração duas vezes não muda nada na segunda', () => {
    const once = migrateStep({ ...closed, schemaVersion: 6 }, 6);
    expect(migrateStep({ ...once, schemaVersion: 6 }, 6)).toEqual(once);
    // O que já estava no save é preservado.
    expect(migrateStep({ ...closed, schemaVersion: 6, investor: investorOf(), sideJob: 'mechanic' }, 6)).toMatchObject({
      sideJob: 'mechanic',
      investor: { share: 0.2 },
    });
  });

  it('a carreira com as regras novas continua íntegra ao longo dos anos', () => {
    let career = closed;
    for (let season = 0; season < 2; season++) {
      const next = botOffseason(career);
      career = playSeason(botTraining(startNextSeason(next.career, next.offerId)));
      expect(validateCareerIntegrity(career)).toEqual([]);
    }
  });
});
