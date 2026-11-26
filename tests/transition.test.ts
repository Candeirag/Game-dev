/**
 * O ano de transição (Fase 6, etapa C): as propostas dos três papéis, a entrada no fechamento e no
 * meio do ano, o cachê e a mensagem de cada etapa, os eventos do ano (sem repetir), a mentoria que
 * acelera o pupilo, o fechamento (reputação, vida em família, legado), o legado de cada papel, a
 * regra de uma vez por personagem, o robô, o save e a integridade.
 */
import { describe, expect, it } from 'vitest';
import { STORY_EVENTS, TRANSITION } from '@/config/balance';
import { CareerStateSchema, TRANSITION_ROLES, type CareerState, type Child, type RoundRecord, type Transition, type TransitionRole } from '@/domain/schemas';
import { TRANSITION_BRANDS, TRANSITION_EVENTS, TRANSITION_ROLE_INFO, TRANSITION_ROUND_TEXTS, TRANSITION_START_TEXTS } from '@/data/transition';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
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

function expectValid(career: CareerState) {
  const parsed = CareerStateSchema.safeParse(career);
  expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
  expect(validateCareerIntegrity(career)).toEqual([]);
}

const withCash = (career: CareerState, cash: number): CareerState => ({ ...career, finance: { ...career.finance, cash } });

/** Fechamento da primeira temporada de um piloto que acaba de pendurar o capacete (memorizado por semente). */
const closedCache = new Map<number, CareerState>();
function retiredAt(seed = 77, reputation = 40, cash = 500_000): CareerState {
  let closed = closedCache.get(seed);
  if (!closed) {
    closed = resolvePending(playSeason(newCareer(seed)));
    closedCache.set(seed, closed);
  }
  return engine.retireFromDriving({ ...withCash(closed, cash), reputation });
}

/** O ano de transição escolhido no primeiro fechamento depois de parar. */
function transitionYear(role: TransitionRole, seed = 77, reputation = 40): CareerState {
  return engine.startExecutiveSeason(retiredAt(seed, reputation), { kind: 'transition', role });
}

function playExecutiveSeason(career: CareerState): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
  return c;
}

/** Acrescenta filhos (gerados pelo motor, com os campos trocados). */
function withChildren(career: CareerState, patches: Partial<Child>[]): CareerState {
  const children = patches.map((patch, i) => ({ ...engine.generateChild(career, 300 + i), ...patch }));
  return { ...career, family: { ...career.family, children: [...career.family.children, ...children] } };
}

function withPartner(career: CareerState, relationship = 60): CareerState {
  return { ...career, family: { ...career.family, partner: { ...engine.generatePartner(9, 30, 1), relationship } } };
}

/** Os lançamentos de cachê do papel (o motor os grava com o nome do papel). */
const feePosts = (career: CareerState, role: TransitionRole) =>
  career.finance.transactions.filter((t) => t.key === 'transition' && t.label === `Ano de transição (${TRANSITION_ROLE_INFO[role].label})`);

/* ------------------------------------------------------------------ */

describe('propostas do ano de transição', () => {
  it('no primeiro fechamento depois de parar: três papéis, com cachê, reputação mínima, legado e o pupilo da mentoria', () => {
    const c = retiredAt();
    expect(c.retiredSeason).toBe(c.season);
    expect(engine.transitionWindow(c)).toBe('closing');
    const offers = engine.transitionOffers(c);
    expect(offers.map((o) => o.role)).toEqual([...TRANSITION_ROLES]);
    const living = engine.livingCostBase(c);
    for (const offer of offers) {
      const extra = Math.max(0, c.reputation - TRANSITION.FEE_REPUTATION_FLOOR) * TRANSITION.FEE_PER_REPUTATION[offer.role];
      expect(offer.feePerRound).toBe(Math.round(living * (TRANSITION.FEE_SHARE[offer.role] + extra)));
      expect(offer.feePerRound).toBeGreaterThan(0);
      expect(offer).toMatchObject({ ...TRANSITION_ROLE_INFO[offer.role], minReputation: TRANSITION.MIN_REPUTATION[offer.role], available: true, reason: null });
    }
    // A marca é uma das inventadas, só na imagem de marca; o pupilo, só na mentoria.
    const [mentor, commentator, ambassador] = offers;
    expect(TRANSITION_BRANDS).toContain(ambassador!.brand);
    expect([mentor!.brand, commentator!.brand]).toEqual([null, null]);
    expect([commentator!.protegeId, ambassador!.protegeId]).toEqual([null, null]);
    // Sem filho piloto: o titular do campeonato com contrato para o ano seguinte, até a idade-limite no
    // ano de transição, com o maior potencial (empate pelo id).
    const former = engine.formerCharacterIds(c);
    const expected = c.drivers
      .filter((d) => !d.isPlayer && !former.has(d.id) && d.teamId && d.role !== 'reserve' && d.contractEnd > c.season && d.age + 1 <= TRANSITION.MENTOR_MAX_AGE)
      .sort((a, b) => b.potential - a.potential || (a.id < b.id ? -1 : 1))[0]!;
    expect(mentor).toMatchObject({ protegeId: expected.id, protegeName: engine.fullName(expected), protegeIsChild: false });
  });

  it('a reputação mínima e a falta de pupilo tiram papéis, com o motivo', () => {
    const low = engine.transitionOffers(retiredAt(77, 10));
    expect(low.map((o) => o.available)).toEqual([true, false, false]);
    expect(low[1]!.reason).toMatch(new RegExp(`reputação ${TRANSITION.MIN_REPUTATION.commentator}`));
    expect(low[2]!.reason).toMatch(new RegExp(`reputação ${TRANSITION.MIN_REPUTATION.ambassador}`));
    // Ninguém jovem no campeonato e nenhum filho piloto: a mentoria não tem quem acompanhar.
    const c = retiredAt();
    const veterans = { ...c, drivers: c.drivers.map((d) => (d.isPlayer ? d : { ...d, age: TRANSITION.MENTOR_MAX_AGE + 5 })) };
    const [mentor] = engine.transitionOffers(veterans);
    expect(mentor).toMatchObject({ available: false, protegeId: null });
    expect(mentor!.reason).toMatch(/Nenhum jovem piloto/);
  });

  it('com filhos correndo, a mentoria acompanha o mais novo deles', () => {
    let c = withChildren(retiredAt(), [
      { id: 'kid-old', age: 17 },
      { id: 'kid-young', age: 15 },
      { id: 'kid-small', age: 9 },
    ]);
    c = engine.startChildCareer(engine.startChildCareer(c, 'kid-old', 'full'), 'kid-young', 'full');
    const [mentor] = engine.transitionOffers(c);
    const young = c.family.children.find((k) => k.id === 'kid-young')!;
    expect(mentor).toMatchObject({ available: true, protegeId: young.driver!.id, protegeName: engine.fullName(young), protegeIsChild: true });
  });

  it('fora da janela não há propostas', () => {
    const closed = resolvePending(playSeason(newCareer(77)));
    // Ainda nas pistas.
    expect(engine.transitionOffers(closed)).toEqual([]);
    // Depois do primeiro fechamento (um ano sem cargo), a janela fechou.
    const spectated = playExecutiveSeason(engine.startExecutiveSeason(retiredAt(), { kind: 'spectate' }));
    expect(spectated.transition).toBeNull();
    expect(engine.transitionWindow(spectated)).toBeNull();
    expect(engine.transitionOffers(spectated)).toEqual([]);
    // Com o ano de transição já escolhido.
    expect(engine.transitionOffers(transitionYear('commentator'))).toEqual([]);
    // Com uma sucessão aberta, ou sem saber quando o personagem parou (save antigo).
    const c = retiredAt();
    expect(engine.transitionOffers({ ...c, retiredSeason: null })).toEqual([]);
    expect(engine.transitionOffers(engine.beginSuccession(c, 'death'))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe('o ano de transição escolhido no fechamento', () => {
  it.each(TRANSITION_ROLES)('%s: começa sem equipe, paga o cachê a cada etapa e fecha com reputação, nota e legado', (role) => {
    const retired = retiredAt();
    const offer = engine.transitionOffers(retired).find((o) => o.role === role)!;
    let c = engine.startExecutiveSeason(retired, { kind: 'transition', role });
    expect(c.season).toBe(retired.season + 1);
    expect(c.management).toBeNull();
    expect(c.transition).toEqual({
      role,
      season: c.season,
      protegeId: offer.protegeId,
      protegeName: offer.protegeName,
      brand: offer.brand,
      earnings: 0,
      seen: [],
      done: false,
    });
    expect(c.inbox.find((m) => m.id === `s${c.season}-start`)!.body).toContain('Ano de transição');
    expectValid(c);

    // Cada etapa: o cachê do papel (pela reputação da hora) e a mensagem dele.
    while (c.nextRoundIndex < c.calendar.length - 1) {
      c = resolvePending(c);
      const fee = engine.transitionFee(c, role);
      const earned = c.transition!.earnings;
      c = playExecutiveRound(c);
      expect(c.transition!.earnings).toBe(earned + fee);
      const message = c.inbox.find((m) => m.id === `s${c.season}-r${c.rounds.length}-race`)!;
      expect(message.body).not.toContain('Você acompanha o campeonato de fora');
    }
    expect(feePosts(c, role)).toHaveLength(c.calendar.length - 1);

    // O fechamento: reputação do papel, sem a queda do ano sem cargo; a mentoria ganha mais com o
    // pupilo entre os primeiros.
    c = resolvePending(c);
    const before = c.reputation;
    c = playExecutiveRound(c);
    const off = c.executiveOffseason!;
    expect(off).not.toBeNull();
    const pupil = off.summary.driverStandings.find((s) => s.driverId === offer.protegeId);
    const top = role === 'mentor' && pupil !== undefined && pupil.position <= TRANSITION.MENTOR_TOP_POSITION ? TRANSITION.MENTOR_TOP_REPUTATION : 0;
    expect(c.reputation).toBe(Math.min(100, before + TRANSITION.SEASON_REPUTATION[role] + top));
    expect(c.transition).toMatchObject({ role, done: true });
    expect(feePosts(c, role).reduce((sum, t) => sum + t.amount, 0)).toBe(c.transition!.earnings);
    expect(off.notes.some((n) => n.startsWith(`Ano de transição (${TRANSITION_ROLE_INFO[role].label})`) && n.includes(TRANSITION_ROLE_INFO[role].legacy))).toBe(
      true,
    );
    // O cachê é renda do trabalho: entra no imposto do ano.
    expect(c.finance.reports[c.finance.reports.length - 1]!.taxableIncome).toBeGreaterThanOrEqual(c.transition!.earnings);
    // A janela fechou: o fechamento oferece só o que já havia (cargos, equipes), sem outro ano de transição.
    expect(engine.transitionOffers(c)).toEqual([]);
    expect(() => engine.startExecutiveSeason(resolvePending(c), { kind: 'transition', role })).toThrow(/primeiro fechamento/);
    expectValid(c);
  });

  it('sem cargo nem ano de transição, a fama cai 1 no fechamento', () => {
    let c = engine.startExecutiveSeason(retiredAt(), { kind: 'spectate' });
    while (c.nextRoundIndex < c.calendar.length - 1) c = playExecutiveRound(c);
    c = resolvePending(c);
    const before = c.reputation;
    expect(playExecutiveRound(c).reputation).toBe(before - 1);
  });

  it('um papel indisponível não pode ser escolhido', () => {
    expect(() => engine.startExecutiveSeason(retiredAt(77, 10), { kind: 'transition', role: 'ambassador' })).toThrow(/reputação/);
  });
});

/* ------------------------------------------------------------------ */

describe('o ano de transição no meio da temporada', () => {
  /** Três etapas como piloto e a aposentadoria. */
  function retiredMidSeason(seed = 45, reputation = 40): CareerState {
    let c = newCareer(seed);
    for (let i = 0; i < 3; i++) c = playRound(c);
    return engine.retireFromDriving({ ...resolvePending(c), reputation });
  }

  it('logo depois de parar: o papel vale pelo resto da temporada, e o fechamento é o do ano de transição', () => {
    const retired = retiredMidSeason();
    expect(retired.retiredSeason).toBe(retired.season);
    expect(engine.transitionWindow(retired)).toBe('midseason');
    expect(engine.transitionOffers(retired).every((o) => o.available)).toBe(true);
    let c = engine.beginTransition(retired, 'commentator');
    expect(c.transition).toMatchObject({ role: 'commentator', season: retired.season, earnings: 0, done: false });
    expect(c.inbox.find((m) => m.id === `s${c.season}-transition`)!.body).toMatch(/até o fim desta temporada/);
    expectValid(c);
    // Uma vez só.
    expect(() => engine.beginTransition(c, 'ambassador')).toThrow(/logo depois de parar/);
    c = playExecutiveSeason(c);
    expect(feePosts(c, 'commentator')).toHaveLength(c.calendar.length - 3);
    expect(c.transition!.done).toBe(true);
    expect(engine.transitionOffers(c)).toEqual([]);
    expectValid(c);
  });

  it('quem parou no meio do ano sem escolher ainda tem o ano de transição no fechamento', () => {
    const c = playExecutiveSeason(retiredMidSeason());
    expect(engine.transitionWindow(c)).toBe('closing');
    const next = engine.startExecutiveSeason(resolvePending(c), { kind: 'transition', role: 'mentor' });
    expect(next.transition).toMatchObject({ role: 'mentor', season: c.season + 1 });
    expectValid(next);
  });

  it('quem para antes da primeira etapa também está logo depois de parar', () => {
    const closed = resolvePending(playSeason(newCareer(47)));
    const next = engine.startNextSeason(closed, pickBestOffer(closed));
    const c = engine.retireFromDriving({ ...next, reputation: 40 });
    expect(c.nextRoundIndex).toBe(0);
    expect(engine.transitionWindow(c)).toBe('midseason');
    expectValid(engine.beginTransition(c, 'ambassador'));
  });

  it('fora da janela, ou num papel indisponível, não começa', () => {
    let driving = newCareer(45);
    driving = playRound(driving);
    expect(() => engine.beginTransition(driving, 'mentor')).toThrow(/logo depois de parar/);
    expect(() => engine.beginTransition(retiredAt(), 'mentor')).toThrow(/logo depois de parar/);
    expect(() => engine.beginTransition(retiredMidSeason(45, 10), 'ambassador')).toThrow(/reputação/);
  });
});

/* ------------------------------------------------------------------ */

describe('eventos do ano de transição', () => {
  /** Uma etapa de verdade, com o número trocado (o sorteio do evento só lê o número da etapa). */
  function recordAt(career: CareerState, round: number): RoundRecord {
    const played = playExecutiveRound(career);
    return { ...played.rounds[0]!, round };
  }

  it(`sai um evento depois de cada etapa com a chance EVENT_CHANCE (${TRANSITION.EVENT_CHANCE})`, () => {
    const c = transitionYear('commentator');
    const record = recordAt(c, 1);
    let events = 0;
    const trials = 1200;
    for (let i = 0; i < trials; i++) {
      const seeded = { ...c, seed: 1000 + Math.floor(i / 12) };
      if (engine.addTransitionEvent(seeded, { ...record, round: 1 + (i % 12) }).pendingEvents.length > c.pendingEvents.length) events += 1;
    }
    expect(Math.abs(events / trials - TRANSITION.EVENT_CHANCE)).toBeLessThan(0.05);
  });

  it.each(TRANSITION_ROLES)('%s: cada evento sai uma vez, do papel, com os textos montados e as chances somando 1', (role) => {
    const c = withChildren(withPartner(transitionYear(role)), [{ id: 'kid', age: 8 }]);
    const record = recordAt(c, 1);
    let state = c;
    for (let round = 1; round <= 80; round++) state = engine.addTransitionEvent(state, { ...record, round });
    const cards = state.pendingEvents;
    const own = TRANSITION_EVENTS.filter((e) => e.role === role);
    // Com parceiro e filhos, todos os eventos do papel saíram, cada um uma vez.
    expect(cards.map((e) => e.definitionId).sort()).toEqual(own.map((e) => `transition-${e.id}`).sort());
    expect(state.transition!.seen.slice().sort()).toEqual(own.map((e) => e.id).sort());
    for (const card of cards) {
      expect(card.category).toBe('transition');
      expect(card.choices.length).toBeGreaterThanOrEqual(2);
      const text = [card.title, card.body, ...card.choices.flatMap((ch) => [ch.label, ch.description, ...ch.outcomes.map((o) => o.text)])].join(' ');
      expect(text).not.toMatch(/[{}]/);
      for (const choice of card.choices) expect(choice.outcomes.reduce((sum, o) => sum + o.probability, 0)).toBeCloseTo(1, 6);
    }
    expect(validateCareerIntegrity(state)).toEqual([]);
    // Todos resolvidos pela primeira escolha (a natural), a carreira continua íntegra.
    let resolved = state;
    for (const card of cards) resolved = engine.resolveEvent(resolved, card.id, card.choices[0]!.id).career;
    expectValid(resolved);
  });

  it('sem parceiro ou sem filhos, os eventos que pressupõem essas pessoas não saem', () => {
    for (const role of TRANSITION_ROLES) {
      const c = transitionYear(role);
      const candidates = engine.transitionEventCandidates(c, c.transition!);
      expect(candidates.map((e) => e.id)).toEqual(TRANSITION_EVENTS.filter((e) => e.role === role && !e.needs).map((e) => e.id));
      const full = withChildren(withPartner(c), [{ id: 'kid', age: 8 }]);
      expect(engine.transitionEventCandidates(full, full.transition!)).toHaveLength(TRANSITION_EVENTS.filter((e) => e.role === role).length);
    }
  });

  it('os tamanhos dos dados viram efeitos pelas listas EVENT_*', () => {
    const c = withChildren(withPartner(transitionYear('mentor')), [
      { id: 'kid-a', age: 8 },
      { id: 'kid-b', age: 5 },
    ]);
    const living = engine.livingCostBase(c);
    expect(engine.transitionEffects(c, { e: 'cash', size: -2 }, 'X')).toEqual([
      { type: 'cash', value: Math.round((living * -TRANSITION.EVENT_MONEY[1]) / 100) * 100, ledger: 'transition', label: 'X' },
    ]);
    expect(engine.transitionEffects(c, { e: 'reputation', size: 3 }, 'X')).toEqual([
      { type: 'stat', stat: 'reputation', value: TRANSITION.EVENT_REPUTATION[2] },
    ]);
    expect(engine.transitionEffects(c, { e: 'morale', size: -1 }, 'X')).toEqual([{ type: 'stat', stat: 'morale', value: -TRANSITION.EVENT_MORALE[0] }]);
    expect(engine.transitionEffects(c, { e: 'relationship', size: 2 }, 'X')).toEqual([{ type: 'relationship', value: TRANSITION.EVENT_BOND[1] }]);
    expect(engine.transitionEffects(c, { e: 'bond', size: 1 }, 'X')).toEqual([
      { type: 'childStat', childId: 'kid-a', stat: 'bond', value: TRANSITION.EVENT_BOND[0] },
      { type: 'childStat', childId: 'kid-b', stat: 'bond', value: TRANSITION.EVENT_BOND[0] },
    ]);
    // Sem parceiro, a relação não tem em quem mexer.
    expect(engine.transitionEffects(transitionYear('mentor'), { e: 'relationship', size: 2 }, 'X')).toEqual([]);
  });

  it('fora do ano de transição, nenhum evento', () => {
    const c = engine.startExecutiveSeason(retiredAt(), { kind: 'spectate' });
    const record = recordAt(c, 1);
    for (let round = 1; round <= 30; round++) expect(engine.addTransitionEvent(c, { ...record, round })).toBe(c);
  });
});

/* ------------------------------------------------------------------ */

describe('a mentoria acelera o pupilo', () => {
  it('o pupilo do campeonato ganha o treino extra de cada etapa; os outros pilotos não mudam', () => {
    const mentor = transitionYear('mentor');
    const pupilId = mentor.transition!.protegeId!;
    const alone = playExecutiveRound({ ...mentor, transition: null });
    const helped = playExecutiveRound(mentor);
    const sum = (career: CareerState, id: string) => Object.values(career.drivers.find((d) => d.id === id)!.attributes).reduce((a, b) => a + b, 0);
    expect(sum(helped, pupilId)).toBeGreaterThan(sum(alone, pupilId));
    for (const driver of alone.drivers.filter((d) => d.id !== pupilId)) expect(helped.drivers.find((d) => d.id === driver.id)).toEqual(driver);
    expect(helped.inbox.find((m) => m.id === `s${helped.season}-r1-race`)!.body).toContain(mentor.transition!.protegeName!);
  });

  it('o pupilo do campeonato que perde a vaga não treina, e a mensagem diz que ficou de fora', () => {
    const mentor = transitionYear('mentor');
    const seated = mentor.drivers.find((d) => !d.isPlayer && d.teamId)!;
    const benched = { ...seated, id: 'sem-vaga', teamId: null, role: null };
    const c: CareerState = {
      ...mentor,
      drivers: [...mentor.drivers, benched],
      transition: { ...mentor.transition!, protegeId: 'sem-vaga', protegeName: 'Nome Sem Vaga' },
    };
    const played = playExecutiveRound(c);
    expect(played.inbox.find((m) => m.id === `s${played.season}-r1-race`)!.body).toContain('Nome Sem Vaga ficou sem vaga e não correu');
    expect(played.drivers.find((d) => d.id === 'sem-vaga')!.attributes).toEqual(benched.attributes);
  });

  it('o filho acompanhado evolui MENTOR_CHILD_DEVELOPMENT a mais na carreira por fora', () => {
    let c = withChildren(retiredAt(), [{ id: 'kid', age: 15 }]);
    c = engine.startChildCareer(c, 'kid', 'full');
    c = engine.startExecutiveSeason(c, { kind: 'transition', role: 'mentor' });
    const kid = c.family.children.find((k) => k.id === 'kid')!;
    expect(c.transition!.protegeId).toBe(kid.driver!.id);
    expect(engine.mentorChildFactor(c, kid)).toBe(TRANSITION.MENTOR_CHILD_DEVELOPMENT);
    expect(engine.mentorChildFactor({ ...c, transition: null }, kid)).toBe(1);
    expect(engine.mentorChildFactor(c, { id: 'outro', driver: null })).toBe(1);
    const helped = engine.closeChildSeason(kid, c, null).child.driver!;
    const alone = engine.closeChildSeason(kid, { ...c, transition: null }, null).child.driver!;
    const sum = (d: typeof helped) => Object.values(d.attributes).reduce((a, b) => a + b, 0);
    expect(sum(helped)).toBeGreaterThan(sum(alone));
    // A mensagem da etapa fala da carreira própria do filho.
    const played = playExecutiveRound(c);
    expect(played.inbox.find((m) => m.id === `s${played.season}-r1-race`)!.body).toContain('na carreira própria');
  });
});

/* ------------------------------------------------------------------ */

describe('fechamento do ano de transição', () => {
  function standing(driverId: string, position: number): engine.DriverStanding {
    return { driverId, teamId: 't', position, points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, bestFinish: position, results: [] };
  }

  it.each(TRANSITION_ROLES)('%s: a vida em viagem mexe na relação com o parceiro e no vínculo dos filhos', (role) => {
    const c = withChildren(withPartner(transitionYear(role), 50), [{ id: 'kid', age: 8, bond: 50 }]);
    const closing = engine.closeTransitionYear(c, c.family, [])!;
    const travel = TRANSITION.TRAVEL_RELATIONSHIP[role];
    expect(closing.family.partner!.relationship).toBe(50 + travel);
    expect(closing.family.children[0]!.bond).toBe(50 + travel);
    expect(closing.transition).toEqual({ ...c.transition!, done: true });
    expect(closing.note).toContain(TRANSITION_ROLE_INFO[role].legacy);
    // Fora do ano de transição, nada a fechar.
    expect(engine.closeTransitionYear({ ...c, transition: closing.transition }, c.family, [])).toBeNull();
  });

  it('a mentoria ganha MENTOR_TOP_REPUTATION com o pupilo até MENTOR_TOP_POSITION', () => {
    const c = transitionYear('mentor');
    const id = c.transition!.protegeId!;
    const base = TRANSITION.SEASON_REPUTATION.mentor;
    expect(engine.closeTransitionYear(c, c.family, [standing(id, TRANSITION.MENTOR_TOP_POSITION)])!.reputation).toBe(base + TRANSITION.MENTOR_TOP_REPUTATION);
    expect(engine.closeTransitionYear(c, c.family, [standing(id, TRANSITION.MENTOR_TOP_POSITION + 1)])!.reputation).toBe(base);
    expect(engine.closeTransitionYear(c, c.family, [])!.reputation).toBe(base);
  });

  it('o filho acompanhado por fora conta pela posição da temporada dele', () => {
    let c = withChildren(retiredAt(), [{ id: 'kid', age: 15 }]);
    c = engine.startExecutiveSeason(engine.startChildCareer(c, 'kid', 'full'), { kind: 'transition', role: 'mentor' });
    const season = { season: c.season, year: c.year, categoryId: 'kart-regional' as const, teamName: 'Equipe', position: 2, wins: 1, inWorld: false };
    const family = {
      ...c.family,
      // Mesmo quem largou as pistas no fechamento (sem os dados de piloto) é encontrado.
      children: c.family.children.map((k) =>
        k.id === 'kid' ? { ...k, driver: null, stage: 'other' as const, racing: { ...k.racing!, seasons: [season] } } : k,
      ),
    };
    const closing = engine.closeTransitionYear(c, family, [])!;
    expect(closing.reputation).toBe(TRANSITION.SEASON_REPUTATION.mentor + TRANSITION.MENTOR_TOP_REPUTATION);
    expect(closing.note).toContain('terminou o ano em 2º');
  });
});

/* ------------------------------------------------------------------ */

describe('legado do ano de transição', () => {
  function done(role: TransitionRole): CareerState {
    return playExecutiveSeason(transitionYear(role));
  }

  it('comentários na TV: prestígio extra no mercado de dirigentes', () => {
    const c = done('commentator');
    expect(engine.executiveStanding(c) - engine.executiveStanding({ ...c, transition: null })).toBe(TRANSITION.COMMENTATOR_PRESTIGE);
    // Só depois de terminado.
    const during = transitionYear('commentator');
    expect(engine.transitionPrestige(during)).toBe(0);
    expect(engine.transitionPrestige(done('mentor'))).toBe(0);
  });

  it('mentoria: quem foi acompanhado aceita a equipe do ex-mentor com MENTOR_LOYALTY de atração', () => {
    const c = done('mentor');
    const id = c.transition!.protegeId!;
    expect(engine.mentorLoyalty(c, id)).toBe(TRANSITION.MENTOR_LOYALTY);
    expect(engine.mentorLoyalty(c, 'outro')).toBe(0);
    expect(engine.mentorLoyalty(transitionYear('mentor'), id)).toBe(0);

    // Um dono de equipe no fechamento: um piloto do mercado que recusa a equipe por pouco aceita se o
    // dono foi mentor dele.
    const retired = retiredAt(77, 60, 400_000_000);
    const listing = retired.executiveOffseason!.listings.find((l) => l.categoryId === 'kart-national' && l.rank === 8)!;
    const owner = playExecutiveSeason(engine.startExecutiveSeason(retired, { kind: 'buy', listingId: listing.id }));
    const m = owner.management!;
    const rank = engine.rankTeams(owner.teams).findIndex((t) => t.id === m.teamId);
    const candidate = owner.executiveOffseason!.candidates.find((x) => x.origin === 'market' && x.willing)!;
    const driver = owner.drivers.find((d) => d.id === candidate.driverId)!;
    const ambition = engine.driverTerms(m.categoryId, rank, driver, engine.fieldRatings(owner)).ambition;
    // A atração da equipe fica 1 ponto abaixo do que ele pede (o mercado soma 8 pontos à atração).
    const reputation = ambition - 9 - (engine.staffRating(m, 'sportingDirector') - 60) * 0.3;
    const tuned: CareerState = { ...owner, management: { ...m, reputation } };
    const willing = (career: CareerState) => engine.buildDriverCandidates(career).find((x) => x.driverId === driver.id)!.willing;
    expect(willing(tuned)).toBe(false);
    const mentorOf: Transition = {
      role: 'mentor',
      season: 1,
      protegeId: driver.id,
      protegeName: engine.fullName(driver),
      brand: null,
      earnings: 0,
      seen: [],
      done: true,
    };
    expect(willing({ ...tuned, transition: mentorOf })).toBe(true);
  });

  it('imagem de marca: a marca patrocina o herdeiro que corre', () => {
    let c = withChildren(withCash(retiredAt(77, 40), 2_000_000), [{ id: 'heir', age: 17, kartYears: 6, talent: 88, interest: 90 }]);
    c = engine.startExecutiveSeason(engine.startChildCareer(c, 'heir', 'full'), { kind: 'transition', role: 'ambassador' });
    c = playExecutiveSeason(c);
    expect(c.transition).toMatchObject({ role: 'ambassador', done: true });
    const brand = c.transition!.brand!;
    const heir = engine.resolveSuccession(engine.beginSuccession(c, 'handover'), 'heir', 'driver');
    const sponsor = heir.sponsors.find((s) => s.id === 'legacy-brand')!;
    const seat = engine.getCategory(heir.categoryId).economy.seatCost;
    expect(sponsor).toMatchObject({
      name: brand,
      tier: 0,
      perSeason: Math.round((((seat[0] + seat[1]) / 2) * TRANSITION.AMBASSADOR_HEIR_SHARE) / 100) * 100,
      endSeason: heir.season + TRANSITION.AMBASSADOR_HEIR_SEASONS - 1,
    });
    expect(heir.inbox.some((m) => m.body.includes(`A ${brand} cumpre o que prometeu`))).toBe(true);
    // O herdeiro começa sem ano de transição e sem aposentadoria: o dele virá quando parar de correr.
    expect(heir.transition).toBeNull();
    expect(heir.retiredSeason).toBeNull();
    expectValid(heir);
    // Sem o legado (outro papel), nada de marca.
    const commentator = { ...c, transition: { ...c.transition!, role: 'commentator' as const, brand: null } };
    expect(engine.resolveSuccession(engine.beginSuccession(commentator, 'handover'), 'heir', 'driver').sponsors.some((s) => s.id === 'legacy-brand')).toBe(
      false,
    );
    // Nem pelos negócios: o herdeiro dos negócios não corre e também começa sem o ano de transição.
    const business = engine.resolveSuccession(engine.beginSuccession(c, 'handover'), 'heir', 'executive');
    expect(business.sponsors).toEqual([]);
    expect([business.transition, business.retiredSeason]).toEqual([null, null]);
  });
});

/* ------------------------------------------------------------------ */

describe('o robô no ano de transição', () => {
  const noJobs = (career: CareerState): CareerState => ({ ...career, executiveOffseason: { ...career.executiveOffseason!, jobOffers: [] } });

  it('sem equipe comprada nem cargo aceito, escolhe o primeiro papel disponível: comentários, imagem de marca, mentoria', () => {
    expect(botExecutiveOffseason(noJobs(retiredAt(77, 40))).transition?.role).toBe('commentator');
    expect(botExecutiveOffseason(noJobs(retiredAt(77, 10))).transition?.role).toBe('mentor');
    // Com uma proposta de cargo, o robô de sempre aceita o cargo.
    const withJob = retiredAt(77, 40);
    expect(withJob.executiveOffseason!.jobOffers.length).toBeGreaterThan(0);
    const job = botExecutiveOffseason(withJob);
    expect(job.management?.position).toBe('principal');
    expect(job.transition).toBeNull();
    // Na dinastia do simulador, o ano de transição vem antes do cargo.
    expect(botExecutiveOffseason(withJob, { transitionFirst: true })).toMatchObject({ management: null, transition: { role: 'commentator' } });
    // Fora da janela, o ano sem cargo de sempre.
    const later = playExecutiveSeason(engine.startExecutiveSeason(retiredAt(), { kind: 'spectate' }));
    expect(botExecutiveOffseason(noJobs(later)).transition).toBeNull();
  });

  it('uma vida com o ano de transição primeiro: depois dele, a carreira de dirigente segue íntegra', () => {
    let c = botCareer(5, 8);
    const roles: string[] = [];
    for (let guard = 0; guard < 12 && c.season < 9; guard++) {
      c = playLifeSeason(c, { retireAge: 18, buyTeam: true, transitionFirst: true });
      if (c.transition && !roles.includes(c.transition.role)) roles.push(c.transition.role);
      expectValid(c);
    }
    expect(roles).toEqual(['commentator']);
    expect(c.transition).toMatchObject({ done: true });
    expect(c.mode).toBe('executive');
  }, 60_000);
});

/* ------------------------------------------------------------------ */

describe('save e integridade', () => {
  it('o ano de transição em andamento sobrevive ao save', () => {
    let c = transitionYear('ambassador');
    c = playExecutiveRound(playExecutiveRound(c));
    const loaded = importCareer(exportCareer(c, NOW));
    expect(loaded.transition).toEqual(c.transition);
    expect(loaded.retiredSeason).toBe(c.retiredSeason);
    expectValid(loaded);
  });

  it('as regras de integridade do ano de transição', () => {
    const c = transitionYear('mentor');
    const t = c.transition!;
    const problems = (patch: Partial<CareerState>) => validateCareerIntegrity({ ...c, ...patch });
    expect(problems({})).toEqual([]);
    expect(problems({ transition: { ...t, season: c.season + 1 } })).toContain('Ano de transição numa temporada futura.');
    expect(problems({ retiredSeason: null })).toContain('Ano de transição fora da temporada da aposentadoria e da seguinte.');
    expect(problems({ transition: { ...t, season: c.season - 1 } })).toContain('Ano de transição em andamento fora da temporada dele ou com equipe.');
    expect(problems({ transition: { ...t, protegeId: null } })).toContain('Ano de transição: só a mentoria tem pupilo, e ela precisa de um.');
    expect(problems({ transition: { ...t, role: 'ambassador', protegeId: null } })).toContain(
      'Ano de transição: só a imagem de marca tem marca, e ela precisa de uma.',
    );
    expect(problems({ transition: { ...t, seen: ['conselho-na-vespera', 'conselho-na-vespera'] } })).toContain('Evento do ano de transição visto duas vezes.');
    expect(problems({ transition: { ...t, seen: ['frase-vazada'] } })).toContain('Evento do ano de transição desconhecido ou de outro papel.');
    expect(problems({ retiredSeason: c.season + 1 })).toContain('Aposentadoria numa temporada futura.');
    const driving = newCareer(3);
    expect(validateCareerIntegrity({ ...driving, retiredSeason: 1 })).toContain('Piloto em atividade com temporada de aposentadoria.');
  });
});

/* ------------------------------------------------------------------ */

describe('dados do ano de transição', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const textsOf = (e: (typeof TRANSITION_EVENTS)[number]) => [
    e.title,
    e.body,
    ...e.choices.flatMap((c) => [c.label, c.description, ...c.outcomes.map((o) => o.text)]),
  ];

  it('cada papel tem nome, descrição, legado e pelo menos cinco eventos que não pressupõem ninguém', () => {
    for (const role of TRANSITION_ROLES) {
      const info = TRANSITION_ROLE_INFO[role];
      expect(info.label.length * info.description.length * info.legacy.length).toBeGreaterThan(0);
      expect(TRANSITION_EVENTS.filter((e) => e.role === role && !e.needs).length).toBeGreaterThanOrEqual(5);
    }
    expect(new Set(TRANSITION_BRANDS).size).toBe(TRANSITION_BRANDS.length);
  });

  it('ids únicos; de duas a três escolhas; desfechos com uma chance certa ou com um "resto"', () => {
    const ids = TRANSITION_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of TRANSITION_EVENTS) {
      expect(event.id).toMatch(/^[a-z0-9-]+$/);
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(3);
      expect(new Set(event.choices.map((c) => c.id)).size).toBe(event.choices.length);
      for (const choice of event.choices) {
        const odds = choice.outcomes.map((o) => o.odds);
        if (odds.length === 1) expect(odds).toEqual(['sure']);
        else {
          expect(odds.length).toBeLessThanOrEqual(3);
          expect(odds.filter((o) => o === 'rest')).toHaveLength(1);
          expect(odds).not.toContain('sure');
          const fixed = odds.reduce((sum, o) => sum + (o === 'rest' || o === 'sure' ? 0 : STORY_EVENTS.ODDS[o]), 0);
          expect(fixed).toBeLessThan(1);
        }
        for (const outcome of choice.outcomes) {
          expect(outcome.effects.length).toBeGreaterThan(0);
          for (const effect of outcome.effects) expect([1, 2, 3]).toContain(Math.abs(effect.size));
        }
      }
    }
  });

  it('quem o evento pressupõe bate com os efeitos, e os marcadores são os do papel', () => {
    for (const event of TRANSITION_EVENTS) {
      const kinds = event.choices.flatMap((c) => c.outcomes.flatMap((o) => o.effects.map((e) => e.e)));
      if (kinds.includes('relationship')) expect(event.needs, event.id).toBe('partner');
      if (kinds.includes('bond')) expect(event.needs, event.id).toBe('children');
      const allowed = event.role === 'mentor' ? ['pupilo'] : event.role === 'ambassador' ? ['marca'] : [];
      for (const text of textsOf(event)) for (const key of placeholders(text)) expect(allowed, `${event.id}: {${key}}`).toContain(key);
    }
  });

  it('sem números e sem texto repetido', () => {
    const all = TRANSITION_EVENTS.flatMap(textsOf);
    for (const text of all) expect(text, text).not.toMatch(/\d/);
    const repeated = all.filter((text, i) => all.indexOf(text) !== i);
    expect(repeated).toEqual([]);
    // As mensagens de etapa e de começo de cada papel são diferentes entre si.
    const params = { round: 1, winner: 'W', fee: 'F', championship: 'C', brand: 'B', pupil: 'P', pupilResult: null };
    const messages = TRANSITION_ROLES.flatMap((r) => [TRANSITION_ROUND_TEXTS[r](params), TRANSITION_START_TEXTS[r](params)]);
    expect(new Set(messages).size).toBe(messages.length);
  });
});
