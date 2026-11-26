/**
 * Dinastia (Fase 6, etapa B): a sucessão com vários filhos (parentes com caminho próprio, nascimento
 * do herdeiro, linhagem com os traços do antecessor), quem passa o comando em vida, as opções de vaga
 * do herdeiro piloto, o patrocínio do parente nos negócios, o sobrenome e as regras de integridade
 * novas.
 */
import { describe, expect, it } from 'vitest';
import { FAMILY_TEAM, HEIR_START, RELATIVES } from '@/config/balance';
import { CareerStateSchema, type CareerState, type Child, type ChildRacing, type TeamStake } from '@/domain/schemas';
import { FAMILY } from '@/data/family';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import * as engine from './engineApi';
import { NOW, newCareer, playExecutiveRound, playRound, playSeason, resolvePending } from './helpers';

function expectValid(career: CareerState) {
  const parsed = CareerStateSchema.safeParse(career);
  expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
  expect(validateCareerIntegrity(career)).toEqual([]);
}

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
const roundSeat = (value: number) => Math.round(value / 500) * 500;
const withCash = (career: CareerState, cash: number): CareerState => ({ ...career, finance: { ...career.finance, cash } });

function careerWithPartner(seed: number): CareerState {
  const c = newCareer(seed);
  const partner = { ...engine.generatePartner(seed, 28, 1), relationship: 80, married: true };
  return { ...c, family: { ...c.family, partner } };
}

function playExecutiveSeason(career: CareerState): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
  return c;
}

/** Acrescenta filhos (gerados pelo motor, com os campos trocados). */
function withChildren(career: CareerState, patches: Partial<Child>[]): CareerState {
  const children = patches.map((patch, i) => ({ ...engine.generateChild(career, 100 + i), ...patch }));
  return { ...career, family: { ...career.family, children: [...career.family.children, ...children] } };
}

/** Começa a carreira de um filho e o põe na categoria e na força de equipe dadas. */
function racingIn(career: CareerState, id: string, categoryId: ChildRacing['categoryId'], teamRank: number, reputation = 30): CareerState {
  const c = engine.startChildCareer(career, id, 'full');
  const children = c.family.children.map((child) =>
    child.id === id && child.racing
      ? {
          ...child,
          racing: {
            ...child.racing,
            categoryId,
            teamRank,
            reputation,
            license: [{ season: 1, categoryId: 'kart-international' as const, position: 2, points: 12 }],
          },
        }
      : child,
  );
  return { ...c, family: { ...c.family, children } };
}

/** Fechamento da primeira temporada de um piloto com parceiro e muito dinheiro (memorizado). */
let foundingCache: CareerState | null = null;
function founder(): CareerState {
  foundingCache ??= withCash(resolvePending(playSeason(careerWithPartner(61))), 10_000_000);
  return foundingCache;
}

/** O fundador com quatro filhos: o herdeiro piloto (na Fórmula Júnior) e três que seguem outro caminho. */
function bigFamily(): CareerState {
  let c = withChildren(founder(), [
    { id: 'kid-heir', age: 17, kartYears: 6, talent: 90, interest: 90 },
    { id: 'kid-eng', age: 24, traits: ['studious'], talent: 80, bond: 70, stage: 'other' },
    { id: 'kid-biz', age: 25, traits: ['charismatic', 'rebel'], talent: 70, bond: 75, stage: 'other' },
    { id: 'kid-raced', age: 20, traits: ['gifted'], talent: 84, bond: 50, stage: 'other' },
  ]);
  const raced: ChildRacing = {
    categoryId: 'f4',
    teamName: 'Equipe antiga',
    teamRank: 8,
    reputation: 20,
    license: [],
    academy: null,
    seasons: [
      { season: 1, year: c.year - 2, categoryId: 'kart-national', teamName: 'Equipe A', position: 4, wins: 0, inWorld: false },
      { season: 1, year: c.year - 1, categoryId: 'f4', teamName: 'Equipe B', position: 12, wins: 0, inWorld: false },
    ],
    stalled: 0,
    familyCost: 0,
  };
  c = { ...c, family: { ...c.family, children: c.family.children.map((k) => (k.id === 'kid-raced' ? { ...k, racing: raced } : k)) } };
  c = racingIn(c, 'kid-heir', 'f4', 4);
  // Um traço do herdeiro já apareceu (o teste no kart, por exemplo): a marca vai junto para o nascimento.
  const heir = c.family.children.find((k) => k.id === 'kid-heir')!;
  const birthTraits = heir.birthTraits.map((t, i) => (i === 0 ? { ...t, revealedSeason: 1, revealedRound: 0 } : t));
  return { ...c, family: { ...c.family, children: c.family.children.map((k) => (k.id === 'kid-heir' ? { ...k, birthTraits } : k)) } };
}

/** Uma carreira já aposentada das pistas, no fechamento como dirigente. */
function retired(seed: number, cash = 400_000_000): CareerState {
  const closed = resolvePending(playSeason(careerWithPartner(seed)));
  return engine.retireFromDriving({ ...withCash(closed, cash), reputation: 60 });
}

/** Dono de uma equipe da categoria indicada, no fechamento da primeira temporada no comando. */
function ownerAtSeasonEnd(categoryId: CareerState['categoryId'], seed = 77): CareerState {
  const c = retired(seed);
  const listing = c.executiveOffseason!.listings.find((l) => l.categoryId === categoryId && l.rank === 8)!;
  return playExecutiveSeason(engine.startExecutiveSeason(c, { kind: 'buy', listingId: listing.id }));
}

/* ------------------------------------------------------------------ */

describe('caminho dos filhos que não herdam a carreira', () => {
  it('a personalidade e o que já correram decidem o caminho', () => {
    const path = (traits: Child['traits'], raced = false) => engine.relativePath({ traits, racing: raced ? ({} as ChildRacing) : null }, 1);
    expect(path(['studious'])).toBe('engineer');
    expect(path(['intuitive'])).toBe('engineer');
    expect(path(['charismatic'])).toBe('business');
    expect(path(['rebel', 'charismatic'])).toBe('business');
    expect(path(['calm'])).toBe('sportingDirector');
    expect(path(['determined'])).toBe('sportingDirector');
    expect(path(['gifted'], true)).toBe('sportingDirector');
    expect(path(['studious', 'intuitive'], true)).toBe('engineer');
  });

  it('o empate é sorteado entre os caminhos empatados, igual para a mesma semente', () => {
    const tie = (seed: number) => engine.relativePath({ traits: ['studious', 'charismatic'], racing: null }, seed);
    const none = (seed: number) => engine.relativePath({ traits: ['gifted'], racing: null }, seed);
    const tied = new Set(Array.from({ length: 200 }, (_, i) => tie(i)));
    expect([...tied].sort()).toEqual(['business', 'engineer']);
    expect(new Set(Array.from({ length: 300 }, (_, i) => none(i)))).toEqual(new Set(['engineer', 'business', 'sportingDirector']));
    expect(tie(7)).toBe(tie(7));
  });

  it('o nível no ofício segue o teto de piloto, com acaso, entre 0 e 100', () => {
    const c = founder();
    const kid = engine.generateChild(c, 3);
    const mean = (talent: number) => {
      const skills = Array.from({ length: 400 }, (_, i) => engine.relativeFromChild(c, { ...kid, id: `k${i}`, talent }, c.year).skill);
      for (const s of skills) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
      return skills.reduce((a, b) => a + b, 0) / skills.length;
    };
    const gap = mean(95) - mean(60);
    expect(gap).toBeGreaterThan(RELATIVES.SKILL_TALENT_WEIGHT * 35 - 3);
    expect(gap).toBeLessThan(RELATIVES.SKILL_TALENT_WEIGHT * 35 + 3);
  });
});

describe('sucessão com vários filhos', () => {
  it('o herdeiro piloto ganha o nascimento com os traços dele; os irmãos viram parentes; a linhagem guarda os traços do fundador', () => {
    const c = bigFamily();
    const opened = engine.beginSuccession(c, 'death');
    const heir = engine.resolveSuccession(opened, 'kid-heir', 'driver');
    const kids = Object.fromEntries(c.family.children.map((k) => [k.id, k]));

    // Parentes: um por irmão, com o caminho de cada um.
    expect(heir.family.children).toEqual([]);
    expect(heir.dynasty.relatives.map((r) => [r.id, r.path, r.racedTo])).toEqual([
      ['kid-eng', 'engineer', null],
      ['kid-biz', 'business', null],
      ['kid-raced', 'sportingDirector', 'f4'],
    ]);
    for (const r of heir.dynasty.relatives) {
      const kid = kids[r.id]!;
      expect(r).toMatchObject({ generation: 1, firstName: kid.firstName, traits: kid.traits, bond: kid.bond, sinceSeason: c.season + 1 });
      expect(r.bornYear).toBe(c.year + 1 - kid.age);
    }
    const message = heir.inbox.find((m) => m.id === `s${heir.season}-heir-g2`)!;
    expect(message.body).toContain('Quem não herdou a carreira segue caminho próprio');
    expect(message.body).toContain(`${kids['kid-eng']!.firstName} (${RELATIVE_PATH_INFO.engineer.label.toLowerCase()})`);

    // Nascimento do herdeiro: os traços do filho, com a marca do que já apareceu.
    expect(heir.birth).toMatchObject({ driverId: 'dyn-kid-heir', origin: 'racer-parent', region: 'capital' });
    expect(heir.birth!.traits).toEqual(kids['kid-heir']!.birthTraits);
    expect(heir.birth!.traits[0]!.revealedSeason).toBe(1);
    expect(engine.activeBirth(heir)).toBe(heir.birth);

    // Linhagem: quem saiu leva os traços de nascença e o parceiro; quem entra, o caminho.
    const partner = c.family.partner!;
    expect(heir.dynasty.lineage[0]).toMatchObject({ traits: c.birth!.traits, partnerName: `${partner.firstName} ${partner.lastName}` });
    expect(heir.dynasty.lineage[1]).toMatchObject({ generation: 2, driverId: 'dyn-kid-heir', path: 'driver', traits: [], partnerName: null });
    // Morte: ninguém passou o comando em vida.
    expect(heir.dynasty.elder).toBeNull();
    expectValid(heir);
    expectValid(playRound(heir));
  });

  it('um parente nos negócios patrocina o herdeiro piloto, só com vínculo e idade de trabalho', () => {
    const heir = engine.resolveSuccession(engine.beginSuccession(bigFamily(), 'death'), 'kid-heir', 'driver');
    const seat = engine.getCategory('f4').economy.seatCost;
    expect(heir.sponsors).toEqual([
      {
        id: 'family-business-kid-biz',
        name: expect.stringContaining('Empresa de'),
        tier: 0,
        perSeason: Math.round((((seat[0] + seat[1]) / 2) * RELATIVES.BUSINESS_SPONSOR_SHARE) / 100) * 100,
        podiumBonus: 0,
        endSeason: heir.season + RELATIVES.BUSINESS_SPONSOR_SEASONS - 1,
        satisfaction: 100,
        targetPosition: 20,
      },
    ]);
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-g2`)!.body).toContain('apoia a carreira');

    // Sem vínculo, ou ainda sem idade de trabalho, não há patrocínio.
    const cold = bigFamily();
    const distant = {
      ...cold,
      family: { ...cold.family, children: cold.family.children.map((k) => (k.id === 'kid-biz' ? { ...k, bond: RELATIVES.BUSINESS_SPONSOR_MIN_BOND - 1 } : k)) },
    };
    expect(engine.resolveSuccession(engine.beginSuccession(distant, 'death'), 'kid-heir', 'driver').sponsors).toEqual([]);
    const young = {
      ...cold,
      family: { ...cold.family, children: cold.family.children.map((k) => (k.id === 'kid-biz' ? { ...k, age: RELATIVES.WORK_FROM_AGE - 3 } : k)) },
    };
    expect(engine.resolveSuccession(engine.beginSuccession(young, 'death'), 'kid-heir', 'driver').sponsors).toEqual([]);
    // Onde as vagas não são vendidas, não há patrocínio.
    expect(engine.businessSponsor(heir, 'f1', heir.season, heir.year)).toBeNull();
  });

  it('pelos negócios, o filho também ganha o nascimento; o parceiro e o parente adulto não', () => {
    let c = withChildren(founder(), [{ id: 'kid-adult', age: 20, stage: 'other' }]);
    c = withChildren(c, [{ id: 'kid-small', age: 7 }]);
    const opened = engine.beginSuccession(c, 'death');
    const adult = c.family.children.find((k) => k.id === 'kid-adult')!;

    const child = engine.resolveSuccession(opened, 'kid-adult', 'executive');
    expect(child.birth!.driverId).toBe(child.playerDriverId);
    expect(child.birth!.traits).toEqual(adult.birthTraits);
    expect(engine.activeBirth(child)).not.toBeNull();
    expect(child.dynasty.lineage[1]).toMatchObject({ path: 'executive' });
    expect(child.dynasty.relatives.map((r) => r.id)).toEqual(['kid-small']);
    expectValid(child);

    const partner = engine.resolveSuccession(opened, 'partner', 'executive');
    expect(partner.birth).toEqual(c.birth);
    expect(engine.activeBirth(partner)).toBeNull();
    // Com o parceiro no comando, os filhos continuam na família.
    expect(partner.family.children.map((k) => k.id)).toEqual(['kid-adult', 'kid-small']);
    expect(partner.dynasty.relatives).toEqual([]);
    expectValid(partner);

    const relative = engine.resolveSuccession(opened, 'relative-driver', 'driver');
    expect(relative.birth!.driverId).toBe(relative.playerDriverId);
    expect(relative.birth!.traits.every((t) => t.revealedSeason === null)).toBe(true);
    // O parceiro de quem morreu não passa a ser do sobrinho; os filhos ficam com quem os cria.
    expect(relative.family.partner).toBeNull();
    expect(relative.family.children.map((k) => k.id)).toEqual(['kid-adult', 'kid-small']);
    expect(relative.dynasty.lineage[0]!.partnerName).toBe(`${c.family.partner!.firstName} ${c.family.partner!.lastName}`);
    expectValid(relative);

    const adultRelative = engine.resolveSuccession(opened, 'relative-adult', 'executive');
    expect(adultRelative.birth).toEqual(c.birth);
    expect(adultRelative.family.partner).toBeNull();
    expectValid(adultRelative);
  });

  it('o sobrenome: o herdeiro carrega FAMILY.NAME_PRESTIGE da fama da família', () => {
    expect(FAMILY.NAME_PRESTIGE).toBe(0.35);
    const c = bigFamily();
    const famous = { ...c, dynasty: { ...c.dynasty, lineage: c.dynasty.lineage.map((l) => ({ ...l, peakReputation: 90 })) } };
    const low = {
      ...famous,
      family: { ...famous.family, children: famous.family.children.map((k) => (k.id === 'kid-heir' ? { ...k, racing: { ...k.racing!, reputation: 10 } } : k)) },
    };
    expect(engine.resolveSuccession(engine.beginSuccession(low, 'death'), 'kid-heir', 'driver').reputation).toBe(Math.round(90 * FAMILY.NAME_PRESTIGE));
    // Quem já tem reputação maior que a parte da família fica com a dele.
    const high = {
      ...famous,
      family: { ...famous.family, children: famous.family.children.map((k) => (k.id === 'kid-heir' ? { ...k, racing: { ...k.racing!, reputation: 50 } } : k)) },
    };
    expect(engine.resolveSuccession(engine.beginSuccession(high, 'death'), 'kid-heir', 'driver').reputation).toBe(50);
  });

  it('a família da sucessão sobrevive ao save', () => {
    const heir = engine.resolveSuccession(engine.beginSuccession(bigFamily(), 'death'), 'kid-heir', 'driver');
    const loaded = importCareer(exportCareer(heir, NOW));
    expect(loaded.dynasty).toEqual(heir.dynasty);
    expect(loaded.birth).toEqual(heir.birth);
    expect(loaded.sponsors).toEqual(heir.sponsors);
  });
});

/* ------------------------------------------------------------------ */

describe('quem passa o comando em vida', () => {
  it('dono de equipe com herdeiro nas pistas: segue no controle da equipe, que vira participação de 100%', () => {
    const c = ownerAtSeasonEnd('f3');
    const team = engine.managedTeam(c)!;
    const heir = engine.resolveSuccession(engine.beginHandover(resolvePending(c)), 'relative-driver', 'driver');
    expect(heir.dynasty.elder).toEqual({
      driverId: 'player',
      name: c.dynasty.lineage[0]!.name,
      generation: 1,
      bornYear: c.dynasty.lineage[0]!.bornYear,
      role: 'owner',
      teamName: team.name,
      sinceSeason: c.season + 1,
    });
    expect(heir.finance.stakes.find((s) => s.teamId === team.id)).toMatchObject({ share: 1 });
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-g2`)!.body).toContain(`continua sob o controle de ${heir.dynasty.elder!.name}`);
    expectValid(heir);
  }, 60_000);

  it('sem equipe própria: cuida das participações, se houver; senão, sai de cena. A morte não cria ninguém nesse papel', () => {
    const c = retired(83, 2_000_000);
    const stake: TeamStake = {
      id: 'stake-f4-x',
      teamId: c.teams[0]!.id,
      teamName: c.teams[0]!.name,
      categoryId: c.categoryId,
      share: 0.2,
      cost: 100_000,
      value: 120_000,
      lastPosition: 4,
      lastDividend: 0,
    };
    const investor = engine.resolveSuccession(engine.beginHandover({ ...c, finance: { ...c.finance, stakes: [stake] } }), 'partner', 'executive');
    expect(investor.dynasty.elder).toMatchObject({ role: 'investor', teamName: stake.teamName, generation: 1 });
    expect(investor.inbox[0]!.body).toContain('participações');
    expectValid(investor);

    const quiet = engine.resolveSuccession(engine.beginHandover(c), 'partner', 'executive');
    expect(quiet.dynasty.elder).toMatchObject({ role: 'retired', teamName: null });
    expectValid(quiet);

    const death = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'partner', 'executive');
    expect(death.dynasty.elder).toBeNull();

    // A morte do personagem seguinte não muda quem já estava nesse papel (a avó segue viva).
    const next = engine.resolveSuccession(engine.beginSuccession(quiet, 'death'), 'relative-adult', 'executive');
    expect(next.dynasty.generation).toBe(3);
    expect(next.dynasty.elder).toEqual(quiet.dynasty.elder);
    expectValid(next);
  });

  it('envelhece e morre pela tábua de mortalidade, com sorteio próprio', () => {
    const c = engine.resolveSuccession(engine.beginHandover(retired(83, 2_000_000)), 'partner', 'executive');
    const elder = c.dynasty.elder!;
    // Sem ninguém nesse papel (a primeira geração), nada muda e nada é sorteado.
    const first = founder();
    expect(engine.checkElderMortality(first)).toBe(first);

    // Com 100 anos, a tábua não perdoa.
    const old = { ...c, dynasty: { ...c.dynasty, elder: { ...elder, bornYear: c.year - 100 } } };
    const after = engine.checkElderMortality(old);
    expect(after.dynasty.elder).toBeNull();
    const message = after.inbox.find((m) => m.id === `s${c.season}-elder-${elder.driverId}`)!;
    expect(message).toMatchObject({ category: 'family' });
    expect(message.body).toContain(`${elder.name}, que passou o comando da família em vida, morreu aos 100 anos.`);
    expectValid(after);

    // A frequência segue a tábua (aos 85 anos).
    let deaths = 0;
    for (let i = 0; i < 2000; i++) {
      const probe = { ...c, season: c.season + i, dynasty: { ...c.dynasty, elder: { ...elder, bornYear: c.year - 85 } } };
      if (engine.checkElderMortality(probe).dynasty.elder === null) deaths++;
    }
    expect(deaths / 2000).toBeGreaterThan(engine.mortalityRisk(85) - 0.03);
    expect(deaths / 2000).toBeLessThan(engine.mortalityRisk(85) + 0.03);
  });

  it('o sorteio entra no fechamento da temporada, nos dois modos', () => {
    const exec = engine.resolveSuccession(engine.beginHandover(retired(83, 2_000_000)), 'partner', 'executive');
    const started = engine.startExecutiveSeason(resolvePending(exec), { kind: 'spectate' });
    const aged = { ...started, dynasty: { ...started.dynasty, elder: { ...started.dynasty.elder!, bornYear: started.year - 100 } } };
    const closed = playExecutiveSeason(aged);
    expect(closed.dynasty.elder).toBeNull();
    expectValid(closed);

    const driver = engine.resolveSuccession(engine.beginHandover(retired(85, 2_000_000)), 'relative-driver', 'driver');
    expect(driver.dynasty.elder).toMatchObject({ role: 'retired' });
    const old = { ...driver, dynasty: { ...driver.dynasty, elder: { ...driver.dynasty.elder!, bornYear: driver.year - 100 } } };
    const end = playSeason(old);
    expect(end.dynasty.elder).toBeNull();
    expectValid(end);
  }, 60_000);
});

/* ------------------------------------------------------------------ */

describe('vaga do herdeiro piloto', () => {
  /** O fundador com um herdeiro piloto na categoria e na força de equipe dadas. */
  function heirIn(categoryId: ChildRacing['categoryId'], teamRank: number, cash = 10_000_000): CareerState {
    const c = withChildren(withCash(founder(), cash), [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    return engine.beginSuccession(racingIn(c, 'kid', categoryId, teamRank), 'death');
  }

  it('três opções: a equipe atual, uma da frente paga pela família e a da família', () => {
    const opened = heirIn('f4', 5);
    const f4 = engine.getCategory('f4');
    const ranked = engine.rankTeams(engine.buildCategoryField('f4', opened.seed, opened.season + 1).teams);
    const options = engine.heirSeatOptions(opened, 'kid');
    expect(options.map((o) => o.id)).toEqual(['current', 'top', 'family']);
    expect(options[0]).toEqual({
      id: 'current',
      teamName: ranked[5]!.name,
      rank: 5,
      seatCost: roundSeat(lerp(f4.economy.seatCost, 5 / 9)),
      available: true,
      reason: null,
    });
    const price = roundSeat(lerp(f4.economy.seatCost, HEIR_START.TOP_SEAT_RANK / 9) * (1 + HEIR_START.TOP_SEAT_PREMIUM));
    expect(options[1]).toEqual({
      id: 'top',
      teamName: ranked[HEIR_START.TOP_SEAT_RANK]!.name,
      rank: HEIR_START.TOP_SEAT_RANK,
      seatCost: price,
      available: true,
      reason: null,
    });
    expect(options[2]).toMatchObject({ id: 'family', available: false, teamName: null });
    expect(options[2]!.reason).toMatch(/não é dona/);
    // Quem não corre não tem vaga a escolher.
    expect(engine.heirSeatOptions(opened, 'partner')).toEqual([]);
    // A vaga atual é a de sempre.
    expect(engine.resolveSuccession(opened, 'kid', 'driver', 'current')).toEqual(engine.resolveSuccession(opened, 'kid', 'driver'));
  });

  it('a equipe da frente: paga na hora com o patrimônio herdado, e o contrato do ano não cobra de novo', () => {
    const opened = heirIn('f4', 5);
    const top = engine.heirSeatOptions(opened, 'kid')[1]!;
    const heir = engine.resolveSuccession(opened, 'kid', 'driver', 'top');
    const player = engine.getPlayer(heir);
    expect(engine.rankTeams(heir.teams).findIndex((t) => t.id === player.teamId)).toBe(HEIR_START.TOP_SEAT_RANK);
    expect(heir.contract.seatCost).toBe(0);
    expect(heir.finance.cash).toBe(10_000_000 - opened.succession!.tax - top.seatCost!);
    expect(heir.finance.transactions).toContainEqual(expect.objectContaining({ key: 'seat', amount: -top.seatCost!, label: `Vaga na ${top.teamName}` }));
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-g2`)!.body).toContain('pagou');
    expectValid(heir);
    expectValid(playRound(heir));
  });

  it('a equipe da frente exige dinheiro, vaga vendida e uma equipe melhor que a atual', () => {
    const poor = heirIn('f4', 5, 100_000);
    const option = engine.heirSeatOptions(poor, 'kid')[1]!;
    expect(option.available).toBe(false);
    expect(option.reason).toMatch(/patrimônio herdado/);
    expect(() => engine.resolveSuccession(poor, 'kid', 'driver', 'top')).toThrow(/patrimônio herdado/);
    // No limite: o que sobra depois do imposto cobre exatamente a vaga e a reserva para viver.
    const need = option.seatCost! + Math.round(HEIR_START.TOP_SEAT_RESERVE * engine.getCategory('f4').economy.living);
    const inherited = (cash: number) => cash - heirIn('f4', 5, cash).succession!.tax;
    let exact = need;
    while (inherited(exact) < need) exact += 1;
    expect(inherited(exact)).toBe(need);
    expect(engine.heirSeatOptions(heirIn('f4', 5, exact), 'kid')[1]!.available).toBe(true);
    expect(engine.heirSeatOptions(heirIn('f4', 5, exact - 1), 'kid')[1]!.available).toBe(false);

    expect(engine.heirSeatOptions(heirIn('f1', 6), 'kid')[1]!.reason).toMatch(/não são vendidas/);
    expect(engine.heirSeatOptions(heirIn('f4', HEIR_START.TOP_SEAT_RANK), 'kid')[1]!.reason).toMatch(/equipes da frente/);
    expect(() => engine.resolveSuccession(heirIn('f4', 5), 'partner', 'executive', 'top')).toThrow();
  });

  it('a equipe da família: só quando ela é da categoria do herdeiro; entra no grid como está, e a imprensa fala em favorecimento', () => {
    let c = ownerAtSeasonEnd('f3');
    const own = engine.managedTeam(c)!;
    c = withChildren(c, [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    const inF3 = engine.beginSuccession(racingIn(c, 'kid', 'f3', 6), 'death');
    const options = engine.heirSeatOptions(inF3, 'kid');
    const family = options[2]!;
    expect(family).toMatchObject({ id: 'family', teamName: own.name, available: true, reason: null });

    const heir = engine.resolveSuccession(inF3, 'kid', 'driver', 'family');
    const player = engine.getPlayer(heir);
    expect(player.teamId).toBe(own.id);
    expect(heir.teams.find((t) => t.id === own.id)).toMatchObject({ name: own.name, color: own.color, car: own.car });
    expect(engine.rankTeams(heir.teams).findIndex((t) => t.id === own.id)).toBe(family.rank);
    const f3 = engine.getCategory('f3');
    expect(heir.contract.seatCost).toBe(roundSeat(lerp(f3.economy.seatCost, family.rank! / 9) * FAMILY_TEAM.SEAT_SHARE));
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-favoritism`)).toMatchObject({ category: 'media', title: 'Favorecimento?' });
    expect(heir.finance.stakes.find((s) => s.teamId === own.id)).toMatchObject({ share: 1 });
    expectValid(heir);
    expectValid(playRound(heir));

    // Outra categoria: não há vaga na equipe da família.
    const inF4 = engine.beginSuccession(racingIn(c, 'kid', 'f4', 6), 'death');
    expect(engine.heirSeatOptions(inF4, 'kid')[2]!.reason).toMatch(/corre/);
    expect(() => engine.resolveSuccession(inF4, 'kid', 'driver', 'family')).toThrow(/corre/);
  }, 60_000);

  it('uma equipe fundada pela família, sem inscrição no grid novo, ocupa a da mais fraca', () => {
    const start = retired(87);
    const founded = engine.startExecutiveSeason(start, { kind: 'found', categoryId: 'f4', name: 'Equipe Raiz', color: '#335577' });
    let c = playExecutiveSeason(founded);
    const own = engine.managedTeam(c)!;
    expect(own.id.startsWith('own-')).toBe(true);
    c = withChildren(c, [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    const opened = engine.beginSuccession(racingIn(c, 'kid', 'f4', 6), 'death');
    const weakest = engine.rankTeams(engine.buildCategoryField('f4', opened.seed, opened.season + 1).teams).at(-1)!;
    const heir = engine.resolveSuccession(opened, 'kid', 'driver', 'family');
    expect(heir.teams).toHaveLength(10);
    expect(heir.teams.some((t) => t.id === weakest.id)).toBe(false);
    expect(heir.teams.find((t) => t.id === own.id)).toMatchObject({ name: 'Equipe Raiz', color: '#335577' });
    expect(engine.getPlayer(heir).teamId).toBe(own.id);
    expectValid(heir);
  }, 60_000);
});

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

describe('integridade da dinastia', () => {
  it('parentes, quem passou o comando e os traços da linhagem', () => {
    const heir = engine.resolveSuccession(engine.beginSuccession(bigFamily(), 'death'), 'kid-heir', 'driver');
    const relative = heir.dynasty.relatives[0]!;
    const problems = (patch: (c: CareerState) => CareerState) => validateCareerIntegrity(patch(heir));
    const dynasty = (c: CareerState, d: Partial<CareerState['dynasty']>): CareerState => ({ ...c, dynasty: { ...c.dynasty, ...d } });

    expect(problems((c) => dynasty(c, { relatives: [...c.dynasty.relatives, relative] }))).toContain('Parentes com id duplicado.');
    expect(problems((c) => ({ ...c, family: { ...c.family, children: [{ ...engine.generateChild(c, 1), id: relative.id }] } }))).toContain(
      'Parente com o mesmo id de um filho.',
    );
    expect(problems((c) => dynasty(c, { relatives: [{ ...relative, generation: 2 }] }))).toContain(
      `Parente ${relative.id} de geração igual ou maior que a atual.`,
    );

    const elder = { driverId: 'player', name: 'Ana Teste', generation: 1, bornYear: 1990, role: 'retired' as const, teamName: null, sinceSeason: 2 };
    expect(problems((c) => dynasty(c, { elder }))).toEqual([]);
    expect(problems((c) => dynasty(c, { elder: { ...elder, generation: 2 } }))).toContain(
      'Quem passou o comando em vida é de geração igual ou maior que a atual.',
    );
    expect(problems((c) => dynasty(c, { elder: { ...elder, driverId: 'ninguem' } }))).toContain(
      'Quem passou o comando em vida não é um personagem anterior da linhagem.',
    );
    expect(problems((c) => dynasty(c, { elder: { ...elder, driverId: c.playerDriverId } }))).toContain(
      'Quem passou o comando em vida não é um personagem anterior da linhagem.',
    );

    const trait = (id: 'rainMaster' | 'rainFear') => ({ id, revealedSeason: null, revealedRound: null });
    const withTraits = (traits: ReturnType<typeof trait>[]) => (c: CareerState) =>
      dynasty(c, { lineage: c.dynasty.lineage.map((l, i) => (i === 0 ? { ...l, traits } : l)) });
    expect(problems(withTraits([trait('rainMaster'), trait('rainMaster')]))).toContain('Traço de nascença repetido na linhagem (player).');
    expect(problems(withTraits([trait('rainMaster'), trait('rainFear')]))).toContain('Traços de nascença opostos na linhagem (player).');
  });
});
