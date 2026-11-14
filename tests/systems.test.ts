import { describe, expect, it } from 'vitest';
import type { CareerState, Offer, Sponsor } from '@/domain/schemas';
import { PENALTY_POINTS_BAN, getCategory } from '@/data/categories';
import { closeSeasonFinance, emptyFinance, moveInvestment, post, settleRound } from '@/engine/career/economy';
import { applyEffects } from '@/engine/events/effects';
import { validateCareerIntegrity } from '@/persistence/integrity';
import {
  CONTRACT_RULES,
  ECONOMY,
  EVENT_DEFINITIONS,
  buildSponsor,
  canAcceptOffer,
  categoryRequirements,
  conditionAfterRace,
  financeRequirement,
  getPlayer,
  getReserve,
  incomeTax,
  licensePointsTotal,
  negotiate,
  negotiateOffer,
  negotiationMargin,
  netWorth,
  offerRequirements,
  playerAvailability,
  positionPrestige,
  recoverInjury,
  renewSponsors,
  reputationAfterSeason,
  resolveEvent,
  rollInjury,
  satisfactionAfterRound,
  simulateAbsentWeekend,
  sponsorTierFor,
  startWeekend,
  updateMarketInterest,
} from './engineApi';
import { newCareer, playRound, playSeason, resolvePending } from './helpers';

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

describe('economia', () => {
  it('lançamentos atualizam caixa, totais e extrato', () => {
    let f = emptyFinance(1000);
    f = post(f, 1, 1, 'salary', 500, 'Salário');
    f = post(f, 1, 1, 'seat', -300, 'Vaga');
    expect(f.cash).toBe(1200);
    expect(f.seasonTotals).toEqual({ salary: 500, seat: -300 });
    expect(f.transactions.map((t) => t.amount)).toEqual([-300, 500]);
    expect(post(f, 1, 1, 'bonus', 0, 'nada')).toBe(f);
  });

  it('uma etapa cobra a parcela da vaga e os custos, e paga os patrocínios', () => {
    const c = newCareer();
    const f = settleRound(c, 1, entry(12));
    const share = 1 / c.calendar.length;
    expect(f.seasonTotals.seat).toBe(-Math.round(c.contract.seatCost * share));
    expect(f.seasonTotals.sponsors).toBe(Math.round(ECONOMY.FAMILY_SUPPORT * share));
    expect(f.seasonTotals.living).toBeLessThan(0);
    expect(f.seasonTotals.training).toBeLessThan(0);
    expect(f.seasonTotals.damage).toBeUndefined();
    // Dano vira conta; treino intenso custa mais.
    expect(settleRound(c, 1, entry(12, { damage: 0.5 })).seasonTotals.damage).toBeLessThan(0);
    expect(settleRound({ ...c, trainingIntensity: 'intense' }, 1, entry(12)).seasonTotals.training!).toBeLessThan(f.seasonTotals.training!);
  });

  it('o imposto é progressivo e isento na faixa mais baixa', () => {
    expect(incomeTax(0)).toBe(0);
    expect(incomeTax(40_000)).toBe(0);
    expect(incomeTax(100_000)).toBe(9_000);
    expect(incomeTax(10_000_000) / 10_000_000).toBeGreaterThan(incomeTax(1_000_000) / 1_000_000);
  });

  it('o fechamento do ano aplica imposto, rendimento e juros', () => {
    const c = newCareer();
    const rich: CareerState = { ...c, finance: { ...emptyFinance(0), fixedIncome: 100_000, seasonTotals: { salary: 500_000, seat: -100_000 } } };
    const { finance, report } = closeSeasonFinance(rich);
    expect(report.taxableIncome).toBe(400_000);
    expect(report.tax).toBe(incomeTax(400_000));
    expect(finance.fixedIncome).toBe(Math.round(100_000 * (1 + ECONOMY.FIXED_INCOME_RETURN)));
    expect(finance.seasonTotals).toEqual({});
    expect(finance.reports).toHaveLength(1);
    const broke = closeSeasonFinance({ ...c, finance: emptyFinance(-50_000) });
    expect(broke.report.loanInterest).toBe(Math.round(50_000 * ECONOMY.LOAN_INTEREST));
    expect(broke.finance.cash).toBe(-50_000 - broke.report.loanInterest);
  });

  it('investimentos movem dinheiro entre caixa e aplicações, com limites', () => {
    let f = emptyFinance(10_000);
    f = moveInvestment(f, 'equityFund', 6_000);
    expect(f).toMatchObject({ cash: 4_000, equityFund: 6_000 });
    expect(netWorth(f)).toBe(10_000);
    f = moveInvestment(f, 'equityFund', -1_000);
    expect(f).toMatchObject({ cash: 5_000, equityFund: 5_000 });
    expect(() => moveInvestment(f, 'fixedIncome', 99_000)).toThrow();
    expect(() => moveInvestment(f, 'equityFund', -99_000)).toThrow();
  });
});

describe('condição, lesões e suspensão', () => {
  const neutral = { form: 50, confidence: 50, morale: 55 };

  it('resultado acima da meta melhora a condição; abandono por erro piora', () => {
    const good = conditionAfterRace(neutral, entry(1), 10);
    const bad = conditionAfterRace(neutral, entry(20, { status: 'dnf', dnfReason: 'crash' }), 10);
    expect(good.form).toBeGreaterThan(neutral.form);
    expect(good.confidence).toBeGreaterThan(neutral.confidence);
    expect(good.morale).toBeGreaterThan(neutral.morale);
    expect(bad.form).toBeLessThan(neutral.form);
    expect(bad.confidence).toBeLessThan(neutral.confidence);
    expect(bad.morale).toBeLessThan(neutral.morale);
  });

  it('a confiança não fica presa no teto', () => {
    let c = { form: 50, confidence: 100, morale: 55 };
    for (let i = 0; i < 12; i++) c = conditionAfterRace(c, entry(10), 10);
    expect(c.confidence).toBeLessThan(85);
  });

  it('lesões têm gravidade e prazo; a recuperação conta as etapas', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const injury = rollInjury(seed);
      expect(injury.roundsRemaining).toBeGreaterThanOrEqual(injury.severity === 'serious' ? 2 : 1);
      expect(injury.roundsRemaining).toBeLessThanOrEqual(injury.severity === 'serious' ? 5 : 2);
    }
    expect(recoverInjury({ description: 'x', severity: 'minor', roundsRemaining: 1 }, false)).toBeNull();
    expect(recoverInjury({ description: 'x', severity: 'serious', roundsRemaining: 2 }, true)).toMatchObject({ roundsRemaining: 1 });
    // Correr com lesão grave (não é permitido, mas a regra existe) não adianta a recuperação.
    expect(recoverInjury({ description: 'x', severity: 'serious', roundsRemaining: 2 }, false)).toMatchObject({ roundsRemaining: 2 });
  });

  it('com lesão grave, o reserva corre no lugar do jogador e a etapa conta', () => {
    const base = newCareer(5);
    const injured: CareerState = {
      ...base,
      drivers: base.drivers.map((d) => (d.isPlayer ? { ...d, injury: { description: 'Fratura', severity: 'serious' as const, roundsRemaining: 2 } } : d)),
    };
    expect(playerAvailability(injured)).toEqual({ available: false, reason: 'injury', canRest: false });
    const weekend = startWeekend(injured);
    const reserve = getReserve(injured, 'cerrado')!;
    expect(weekend.weekend!.playerParticipates).toBe(false);
    expect(weekend.weekend!.entrants.map((e) => e.driverId)).toContain(reserve.id);
    expect(weekend.weekend!.entrants.map((e) => e.driverId)).not.toContain('player');
    expect(weekend.weekend!.entrants).toHaveLength(20);
    const after = simulateAbsentWeekend(weekend);
    expect(after.rounds).toHaveLength(1);
    expect(after.rounds[0]!.race.entries.some((e) => e.driverId === 'player')).toBe(false);
    expect(after.rounds[0]!.race.entries.some((e) => e.driverId === reserve.id)).toBe(true);
    expect(getPlayer(after).injury).toMatchObject({ roundsRemaining: 1 });
    expect(validateCareerIntegrity(after)).toEqual([]);
  });

  it('com lesão leve, o jogador escolhe entre correr e descansar', () => {
    const base = newCareer(5);
    const hurt: CareerState = {
      ...base,
      drivers: base.drivers.map((d) => (d.isPlayer ? { ...d, injury: { description: 'Contusão', severity: 'minor' as const, roundsRemaining: 2 } } : d)),
    };
    expect(playerAvailability(hurt)).toEqual({ available: true, reason: null, canRest: true });
    expect(startWeekend(hurt).weekend!.playerParticipates).toBe(true);
    expect(startWeekend(hurt, { rest: true }).weekend!.playerParticipates).toBe(false);
  });

  it('12 pontos na licença suspendem o piloto por uma etapa', () => {
    const base = newCareer(9);
    const nearBan: CareerState = { ...base, license: { ...base.license, penaltyPoints: PENALTY_POINTS_BAN, banRounds: 1 } };
    expect(playerAvailability(nearBan).reason).toBe('ban');
    const after = playRound(nearBan);
    expect(after.rounds[0]!.race.entries.some((e) => e.driverId === 'player')).toBe(false);
    expect(after.license.banRounds).toBe(1); // 12 pontos acumulados geram nova suspensão ao serem contados
    const served = playRound({ ...base, license: { ...base.license, banRounds: 1 } });
    expect(served.license.banRounds).toBe(0);
    expect(playerAvailability(served).available).toBe(true);
  });
});

describe('licença e reputação', () => {
  it('os pontos de licença valem por três temporadas', () => {
    const license = { history: [1, 2, 3, 4].map((season) => ({ season, categoryId: 'f3' as const, position: 1, points: 10 })), penaltyPoints: 0, banRounds: 0 };
    expect(licensePointsTotal(license, 4)).toBe(30);
    expect(licensePointsTotal(license, 6)).toBe(10);
    expect(licensePointsTotal(license, 8)).toBe(0);
  });

  it('um estreante não cumpre os requisitos da F1 nem do kart nacional', () => {
    const c = newCareer();
    expect(categoryRequirements(c, 'f1').every((r) => r.met)).toBe(false);
    const national = categoryRequirements(c, 'kart-national');
    expect(national.find((r) => r.key === 'license')!.met).toBe(false);
    expect(national.find((r) => r.key === 'age')!.met).toBe(true);
  });

  it('a reputação fica ancorada ao degrau da categoria', () => {
    expect(positionPrestige(1)).toBeGreaterThan(positionPrestige(5));
    expect(positionPrestige(5)).toBeGreaterThan(positionPrestige(12));
    // Campeão regional não chega perto do topo; campeão da F2 passa do requisito da F1.
    expect(reputationAfterSeason(10, 1, 6, 1)).toBeLessThan(30);
    expect(reputationAfterSeason(50, 1, 4, 6)).toBeGreaterThanOrEqual(getCategory('f1').requirements.minReputation);
    // Uma temporada ruim em categoria alta derruba menos que o fundo do poço.
    expect(reputationAfterSeason(60, 18, 0, 6)).toBeGreaterThan(50);
    expect(reputationAfterSeason(0, 20, 0, 1)).toBe(0);
  });
});

describe('contratos e negociação', () => {
  const season = playSeason(newCareer(42));
  const offseason = season.offseason!;
  const sample: Offer = {
    id: 'o',
    teamId: 't',
    teamName: 'Equipe',
    categoryId: 'f3',
    kind: 'transfer',
    role: 'second',
    years: 2,
    salary: 100_000,
    seatCost: 400_000,
    bonuses: { win: 1000, podium: 400, point: 20, title: 5000 },
    clauses: { releaseFee: 50_000, performanceTarget: 12 },
    interest: 70,
    conceded: 0,
    patience: 3,
    status: 'open',
    firstDriverPossible: true,
    scholarship: 0,
  };

  it('toda temporada termina com ao menos uma proposta aceitável', () => {
    expect(offseason.offers.length).toBeGreaterThan(0);
    expect(offseason.offers.some((o) => canAcceptOffer(season, o))).toBe(true);
    const fallback = offseason.offers.find((o) => o.kind === 'fallback')!;
    expect(fallback.seatCost).toBe(0);
    expect(offerRequirements(season, fallback)).toEqual([]);
  });

  it('a equipe cede enquanto há margem e cada concessão a consome', () => {
    expect(negotiationMargin(sample)).toBe(25);
    const a = negotiate(sample, 'seat');
    expect(a.accepted).toBe(true);
    expect(a.offer.seatCost).toBeLessThan(sample.seatCost);
    expect(negotiationMargin(a.offer)).toBe(25 - CONTRACT_RULES.DEMAND_COST.seat);
    const b = negotiate(a.offer, 'role');
    expect(b.accepted).toBe(true);
    expect(b.offer.role).toBe('first');
    // Margem restante: 2. Um novo pedido de salário (custo 8) é recusado e gasta paciência.
    const c = negotiate(b.offer, 'salary');
    expect(c.accepted).toBe(false);
    expect(c.offer.patience).toBe(2);
    expect(c.offer.salary).toBe(b.offer.salary);
  });

  it('insistir demais faz a equipe retirar a proposta', () => {
    let offer: Offer = { ...sample, interest: 46 };
    for (let i = 0; i < 3; i++) offer = negotiate(offer, 'salary').offer;
    expect(offer.status).toBe('withdrawn');
    expect(negotiate(offer, 'seat').accepted).toBe(false);
  });

  it('encurtar o contrato remove a cláusula de desempenho; pedidos impossíveis são recusados', () => {
    expect(negotiate(sample, 'shorter').offer).toMatchObject({ years: 1, clauses: { performanceTarget: null } });
    expect(negotiate(sample, 'clause').offer.clauses.performanceTarget).toBeNull();
    expect(negotiate({ ...sample, firstDriverPossible: false }, 'role').accepted).toBe(false);
    expect(negotiate({ ...sample, kind: 'continue' }, 'seat').accepted).toBe(false);
  });

  it('negociar altera a proposta guardada no fechamento da temporada', () => {
    const target = offseason.offers.find((o) => o.kind !== 'continue' && o.kind !== 'fallback');
    if (!target) return;
    const result = negotiateOffer(season, target.id, 'bonus');
    const updated = result.career.offseason!.offers.find((o) => o.id === target.id)!;
    expect(updated.patience + updated.conceded).not.toBe(target.patience + target.conceded);
    expect(validateCareerIntegrity(result.career)).toEqual([]);
  });

  it('o requisito financeiro barra uma vaga cara para quem não tem dinheiro nem patrocínio', () => {
    const poor: CareerState = { ...season, finance: emptyFinance(0), sponsors: [] };
    expect(financeRequirement(poor, sample).met).toBe(false);
    const rich: CareerState = { ...poor, finance: emptyFinance(5_000_000) };
    expect(financeRequirement(rich, sample).met).toBe(true);
    // Em dívida, mas com patrocínio que paga a temporada: aceito.
    const sponsor: Sponsor = { id: 's', name: 'S', tier: 3, perSeason: 50_000, podiumBonus: 0, endSeason: 99, satisfaction: 80, targetPosition: 5 };
    const funded: CareerState = { ...season, finance: emptyFinance(-10_000), sponsors: [sponsor, { ...sponsor, id: 's2' }, { ...sponsor, id: 's3' }] };
    expect(financeRequirement(funded, { ...sample, categoryId: 'kart-regional', seatCost: 20_000, salary: 0 }).met).toBe(true);
  });
});

describe('patrocinadores e mercado', () => {
  const c = newCareer(3);

  it('o porte do patrocinador acompanha os resultados e a fama', () => {
    const category = getCategory('kart-regional');
    expect(sponsorTierFor(5, category, 15)).toBe(1);
    expect(sponsorTierFor(5, category, 6)).toBe(2);
    expect(sponsorTierFor(5, category, 2)).toBe(3);
    expect(sponsorTierFor(30, category, 15)).toBe(2);
    const small = buildSponsor(c, 1, 1);
    const big = buildSponsor(c, 3, 1);
    expect(big.perSeason).toBeGreaterThan(small.perSeason * 2);
    expect(big.targetPosition).toBeLessThan(small.targetPosition);
  });

  it('a satisfação sobe com resultado acima do esperado e cai abaixo', () => {
    const sponsor = buildSponsor(c, 2, 1);
    expect(satisfactionAfterRound(sponsor, 3, entry(1))).toBeGreaterThan(sponsor.satisfaction);
    expect(satisfactionAfterRound(sponsor, 18, entry(18))).toBeLessThan(sponsor.satisfaction);
    expect(satisfactionAfterRound({ ...sponsor, tier: 0, satisfaction: 100 }, 20, null)).toBe(100);
  });

  it('na virada do ano, os satisfeitos renovam e o valor acompanha a categoria', () => {
    const sponsor = buildSponsor(c, 2, 1);
    const happy = { ...sponsor, endSeason: 1, satisfaction: 80 };
    const unhappy = { ...sponsor, id: 'x', endSeason: 1, satisfaction: 30 };
    const regional = getCategory('kart-regional');
    const national = getCategory('kart-national');
    const same = renewSponsors([happy, unhappy], 1, regional, regional);
    expect(same.kept.map((s) => s.id)).toEqual([happy.id]);
    expect(same.left.map((s) => s.id)).toEqual(['x']);
    expect(same.kept[0]!.endSeason).toBe(2);
    const up = renewSponsors([happy], 1, regional, national);
    expect(up.kept[0]!.perSeason).toBeGreaterThan(happy.perSeason * 2);
  });

  it('o interesse das equipes cresce com bons resultados', () => {
    const before = c.marketInterest;
    expect(Object.values(before).every((v) => v >= 0 && v <= 100)).toBe(true);
    const season = playSeason(c);
    const after = updateMarketInterest(season, 1);
    expect(Object.keys(after).length).toBeGreaterThanOrEqual(20);
    expect(Object.values(after).every((v) => v >= 0 && v <= 100)).toBe(true);
  });
});

describe('eventos', () => {
  it('em todas as definições, as probabilidades de cada escolha somam 1', () => {
    // Joga temporadas com escolhas diferentes para instanciar o máximo de eventos possível.
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let c = newCareer(seed);
      while (c.nextRoundIndex < c.calendar.length) {
        for (const event of c.pendingEvents) {
          seen.add(event.definitionId);
          expect(event.choices.length).toBeGreaterThanOrEqual(2);
          for (const choice of event.choices) expect(choice.outcomes.reduce((s, o) => s + o.probability, 0)).toBeCloseTo(1, 6);
        }
        c = playRound(c, { eventChoice: seed % 3, mode: 'aggressive', approach: 'attack' });
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
    expect(new Set(EVENT_DEFINITIONS.map((d) => d.category)).size).toBe(8);
    expect(new Set(EVENT_DEFINITIONS.map((d) => d.id)).size).toBe(EVENT_DEFINITIONS.length);
  });

  it('eventos pendentes bloqueiam o fim de semana até serem resolvidos', () => {
    let c = newCareer(2);
    while (c.pendingEvents.length === 0 && c.nextRoundIndex < c.calendar.length) c = playRound(c);
    expect(c.pendingEvents.length).toBeGreaterThan(0);
    expect(() => startWeekend(c)).toThrow(/decisões pendentes/);
    expect(() => startWeekend(resolvePending(c))).not.toThrow();
  });

  it('resolver um evento aplica os efeitos, registra no histórico e é determinístico', () => {
    let c = newCareer(2);
    while (c.pendingEvents.length === 0) c = playRound(c);
    const event = c.pendingEvents[0]!;
    const choice = event.choices[0]!;
    const a = resolveEvent(c, event.id, choice.id);
    const b = resolveEvent(c, event.id, choice.id);
    expect(a).toEqual(b);
    expect(a.career.pendingEvents.some((e) => e.id === event.id)).toBe(false);
    expect(a.career.eventLog[0]).toMatchObject({ id: event.id, choiceLabel: choice.label, outcome: a.outcome });
    expect(a.career.inbox[0]!.title).toBe(event.title);
    expect(() => resolveEvent(c, event.id, 'inexistente')).toThrow();
    expect(validateCareerIntegrity(a.career)).toEqual([]);
  });

  it('cada tipo de efeito altera o sistema correspondente', () => {
    const c = newCareer(1);
    const sponsor = buildSponsor(c, 2, 9);
    const after = applyEffects(
      c,
      [
        { type: 'stat', stat: 'morale', value: -10 },
        { type: 'stat', stat: 'reputation', value: 5 },
        { type: 'stat', stat: 'teamTrust', value: 7 },
        { type: 'cash', value: -1000, ledger: 'event', label: 'Multa' },
        { type: 'rivalry', driverId: 'andrade', value: 30 },
        { type: 'addSponsor', sponsor },
        { type: 'sponsorSatisfaction', sponsorId: sponsor.id, value: -20 },
        { type: 'penaltyPoints', value: 2 },
        { type: 'gridPenalty', driverId: 'player', places: 3 },
        { type: 'pointsAdjustment', driverId: 'player', points: -10, reason: 'teste' },
        { type: 'interest', teamKey: 'kart-regional:vortex', value: 15 },
        { type: 'attribute', key: 'experience', value: 1 },
        { type: 'carUpgrade', value: 2 },
        { type: 'seatCost', value: 500 },
        { type: 'releaseFee', factor: 0 },
      ],
      3,
    );
    const p0 = getPlayer(c);
    const p1 = getPlayer(after);
    expect(p1.condition.morale).toBe(p0.condition.morale - 10);
    expect(after.reputation).toBe(c.reputation + 5);
    expect(after.relations.teamTrust).toBe(57);
    expect(after.finance.cash).toBe(c.finance.cash - 1000);
    expect(after.relations.rivalries.andrade).toBe(30);
    expect(after.sponsors.find((s) => s.id === sponsor.id)!.satisfaction).toBe(40);
    expect(after.license.penaltyPoints).toBe(2);
    expect(after.gridPenalties.player).toBe(3);
    expect(after.adjustments).toEqual([{ driverId: 'player', teamId: 'cerrado', points: -10, reason: 'teste', round: 3 }]);
    expect(after.marketInterest['kart-regional:vortex']).toBe((c.marketInterest['kart-regional:vortex'] ?? 0) + 15);
    expect(p1.attributes.experience).toBe(p0.attributes.experience + 1);
    expect(after.teams.find((t) => t.id === 'cerrado')!.car.engine).toBe(c.teams.find((t) => t.id === 'cerrado')!.car.engine + 2);
    expect(after.contract.seatCost).toBe(c.contract.seatCost + 500);
    expect(after.contract.clauses.releaseFee).toBe(0);
    expect(applyEffects(after, [{ type: 'removeSponsor', sponsorId: sponsor.id }], 3).sponsors.some((s) => s.id === sponsor.id)).toBe(false);
  });

  it('uma punição de grid dada por evento vale na classificação seguinte', () => {
    const base = newCareer(8);
    const clean = playRound(base).rounds[0]!.qualifying.entries.find((e) => e.driverId === 'player')!;
    const punished = playRound({ ...base, gridPenalties: { player: 3 } }).rounds[0]!.qualifying.entries.find((e) => e.driverId === 'player')!;
    expect(punished.gridPenalty).toBe(3);
    expect(punished.position).toBe(Math.min(20, clean.position + 3));
  });
});
