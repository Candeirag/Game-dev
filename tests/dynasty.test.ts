/**
 * Dinastia (Fase 6, etapa B): a sucessão com vários filhos (parentes com caminho próprio, nascimento
 * do herdeiro, linhagem com os traços do antecessor), quem passa o comando em vida, as opções de vaga
 * do herdeiro piloto, o patrocínio do parente nos negócios, o sobrenome, o placar e a árvore da
 * família, e as regras de integridade novas.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAMILY_TEAM, HEIR_START, RELATIVES } from '@/config/balance';
import { CareerStateSchema, type CareerState, type Child, type ChildRacing, type TeamStake } from '@/domain/schemas';
import { ASSET_RULES } from '@/data/assets';
import { CHILD_FIRST_NAMES, FAMILY } from '@/data/family';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { TEAM_TARGETS } from '@/data/teams';
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

/**
 * Uma carreira com parceiro. Desde a etapa D, os cartões de vida pessoal também fazem nascer filhos;
 * aqui o parceiro passa da idade-limite (FAMILY.PARTNER_MAX_CHILD_AGE) para os filhos de cada teste
 * serem só os que o próprio teste põe.
 */
function careerWithPartner(seed: number): CareerState {
  const c = newCareer(seed);
  const partner = { ...engine.generatePartner(seed, 28, 1), relationship: 80, married: true, age: FAMILY.PARTNER_MAX_CHILD_AGE + 1 };
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

/** Dá ao jogador a vitória da etapa indicada: ele troca de posição com quem tinha vencido. */
function withWin(career: CareerState, index: number): CareerState {
  const id = career.playerDriverId;
  const rounds = career.rounds.map((r, i) => {
    const mine = r.race.entries.find((e) => e.driverId === id);
    if (i !== index || !mine) return r;
    const entries = r.race.entries.map((e) =>
      e.driverId === id ? { ...e, position: 1, status: 'finished' as const } : e.position === 1 ? { ...e, position: mine.position } : e,
    );
    return { ...r, race: { ...r.race, entries } };
  });
  return { ...career, rounds };
}

/** Uma carreira com parceiro no meio da primeira temporada (quatro etapas), com uma vitória na segunda. */
function midSeason(seed: number): CareerState {
  let c = careerWithPartner(seed);
  for (let i = 0; i < 4; i++) c = playRound(c);
  return withWin(c, 1);
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
    expect(heir.dynasty.elders).toEqual([]);
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

  it('o ano de transição é de quem o viveu: o herdeiro começa sem ele, nos dois caminhos', () => {
    const c = bigFamily();
    const transition = { role: 'mentor' as const, season: c.season, protegeId: null, protegeName: null, brand: null, earnings: 1000, seen: [], done: true };
    const opened = engine.beginSuccession({ ...c, transition }, 'death');
    expect(opened.transition).toEqual(transition);
    expect(engine.resolveSuccession(opened, 'kid-heir', 'driver').transition).toBeNull();
    expect(engine.resolveSuccession(opened, 'kid-eng', 'executive').transition).toBeNull();
  });

  it('no fechamento, a idade dos parentes na árvore é a mesma que tinham como filhos', () => {
    const c = withChildren(retired(83, 2_000_000), [
      { id: 'kid-adult', age: 24, stage: 'other' },
      { id: 'kid-b', age: 19, stage: 'other' },
    ]);
    // No fechamento, o ano da família já fechou: as idades dos filhos são as do ano seguinte.
    expect(engine.familyYear(c)).toBe(c.year + 1);
    const heir = engine.resolveSuccession(engine.beginHandover(c), 'kid-adult', 'executive');
    expect(heir.executiveOffseason).not.toBeNull();
    expect(engine.familyTree(heir).generations[0]!.relatives.map((r) => [r.id, r.age])).toEqual([['kid-b', 19]]);
    // Virado o ano, a idade é a mesma até o próximo fechamento.
    const next = engine.startExecutiveSeason(resolvePending(heir), { kind: 'spectate' });
    expect(engine.familyYear(next)).toBe(next.year);
    expect(engine.familyTree(next).generations[0]!.relatives[0]!.age).toBe(19);
  }, 60_000);
});

/* ------------------------------------------------------------------ */

describe('a lista de herdeiros e a parte dos irmãos', () => {
  it('a parte dos irmãos: cada um leva ASSET_RULES.SIBLING_SHARE do dinheiro líquido depois do imposto, até ASSET_RULES.SIBLING_SHARE_MAX irmãos', () => {
    const many = ASSET_RULES.SIBLING_SHARE_MAX + 2;
    const kids = Array.from({ length: many }, (_, i): Partial<Child> => (i === 0 ? { id: 'kid-0', age: 25, stage: 'other' } : { id: `kid-${i}`, age: 10 }));
    const opened = engine.beginSuccession(withChildren(founder(), kids), 'death');
    const { estate, tax } = opened.succession!;
    const heir = engine.resolveSuccession(opened, 'kid-0', 'executive');
    const { cash, fixedIncome, equityFund } = opened.finance;
    const share = Math.round((cash + fixedIncome + equityFund - tax) * ASSET_RULES.SIBLING_SHARE * ASSET_RULES.SIBLING_SHARE_MAX);
    expect(heir.finance.transactions).toContainEqual(expect.objectContaining({ key: 'inheritance', amount: -share }));
    expect(heir.dynasty.lineage.at(-2)!.netWorthPassed).toBe(Math.round(estate - tax - share));
  });

  it('a parte dos irmãos sai só do dinheiro: a equipe fica inteira com quem herda e a partilha nunca deixa dívida', () => {
    // Dono de uma equipe da Fórmula Elite com pouco dinheiro em caixa: quase todo o patrimônio é a equipe.
    const owner = ownerAtSeasonEnd('f2');
    const poor = withChildren(withCash(owner, 50_000), [
      { id: 'kid-heir', age: 17, kartYears: 6, talent: 88, interest: 90 },
      { id: 'kid-a', age: 20, stage: 'other' },
      { id: 'kid-b', age: 22, stage: 'other' },
    ]);
    const opened = engine.beginHandover(racingIn(poor, 'kid-heir', 'kart-national', 5));
    const { estate, tax } = opened.succession!;
    expect(engine.ownedTeamValue(opened)).toBeGreaterThan(estate / 2);
    const heir = engine.resolveSuccession(opened, 'kid-heir', 'driver');
    const liquid = Math.max(0, 50_000 + opened.finance.fixedIncome + opened.finance.equityFund - tax);
    const share = Math.round(liquid * ASSET_RULES.SIBLING_SHARE * 2);
    const paid = heir.finance.transactions.filter((t) => t.key === 'inheritance' && t.label === 'Parte dos irmãos na herança');
    expect(paid.reduce((sum, t) => sum - t.amount, 0)).toBe(share);
    // O imposto pode deixar o caixa negativo; a parte dos irmãos, não.
    expect(heir.finance.cash).toBe(50_000 - tax - share);
    expect(share).toBeLessThanOrEqual(liquid);
    // A equipe continua da família, inteira.
    expect(heir.finance.stakes.some((s) => s.share === 1)).toBe(true);
  });

  it('a parte dos irmãos sai primeiro do caixa e, se faltar, das aplicações', () => {
    const kids: Partial<Child>[] = [
      { id: 'kid-0', age: 25, stage: 'other' },
      { id: 'kid-1', age: 20, stage: 'other' },
    ];
    const rich = withChildren(founder(), kids);
    const base = { ...rich, finance: { ...rich.finance, cash: 100_000, fixedIncome: 3_000_000, equityFund: 1_000_000 } };
    const opened = engine.beginSuccession(base, 'death');
    const { tax } = opened.succession!;
    const share = Math.round((100_000 + 3_000_000 + 1_000_000 - tax) * ASSET_RULES.SIBLING_SHARE);
    const heir = engine.resolveSuccession(opened, 'kid-0', 'executive');
    const fromCash = Math.max(0, Math.min(share, 100_000 - tax));
    expect(heir.finance.fixedIncome + heir.finance.equityFund).toBe(4_000_000 - (share - fromCash));
    expect(heir.finance.equityFund).toBe(1_000_000);
  });

  it('os parentes da lista não repetem o nome de ninguém da família; sem repetição, o sorteio de sempre', () => {
    const c = founder();
    const former = engine.getPlayer(c);
    // Sem repetição: os mesmos nomes do sorteio 'relative' (o primeiro e o terceiro número dele).
    const rng = engine.createRng(engine.hashSeed(c.seed, c.season, 'relative'));
    const young = CHILD_FIRST_NAMES[Math.floor(rng.next() * CHILD_FIRST_NAMES.length)]!;
    rng.next();
    const adult = CHILD_FIRST_NAMES[Math.floor(rng.next() * CHILD_FIRST_NAMES.length)]!;
    const names = (x: CareerState) =>
      engine
        .beginSuccession(x, 'death')
        .succession!.heirs.filter((h) => h.kind === 'relative')
        .map((h) => h.name.split(' ')[0]);
    if (young !== adult && young !== former.firstName && adult !== former.firstName) expect(names(c)).toEqual([young, adult]);
    // Com quase todos os nomes já na família (filhos e parentes da árvore), sobram dois, um para cada.
    const free = CHILD_FIRST_NAMES.filter((n) => n !== former.firstName).slice(-2);
    const taken = CHILD_FIRST_NAMES.filter((n) => n !== former.firstName && !free.includes(n));
    const withKids = withChildren(
      c,
      taken.slice(0, 2).map((firstName, i) => ({ id: `kid-${i}`, firstName, age: 6 })),
    );
    const relative = {
      id: 'rel-x',
      lastName: former.lastName,
      generation: 1,
      bornYear: c.year - 30,
      path: 'engineer' as const,
      skill: 50,
      traits: [],
      bond: 50,
      racedTo: null,
      sinceSeason: 1,
    };
    const crowded: CareerState = {
      ...withKids,
      dynasty: { ...withKids.dynasty, relatives: taken.slice(2).map((firstName, i) => ({ ...relative, id: `rel-${i}`, firstName })) },
    };
    const chosen = names(crowded);
    expect([...chosen].sort()).toEqual([...free].sort());
    // E o mesmo resultado para a mesma semente.
    expect(names(crowded)).toEqual(chosen);
  });

  it('a categoria da primeira temporada do herdeiro piloto é a das vagas, também no meio do ano', () => {
    let c = midSeason(62);
    c = withChildren(c, [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    const opened = engine.beginSuccession(engine.startChildCareer(c, 'kid', 'full'), 'accident');
    const closed = engine.closeFamilyYear({ ...opened, succession: null }).family.children.find((k) => k.id === 'kid')!.racing!;
    expect(engine.heirStartCategory(opened, 'kid')).toBe(closed.categoryId);
    expect(engine.resolveSuccession(opened, 'kid', 'driver').categoryId).toBe(closed.categoryId);
    expect(engine.heirStartCategory(opened, 'partner')).toBeNull();
    // No fechamento, é a categoria em que já corre.
    const offseason = withChildren(founder(), [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    const between = engine.beginSuccession(racingIn(offseason, 'kid', 'f4', 4), 'death');
    expect(engine.heirStartCategory(between, 'kid')).toBe('f4');
  });

  it('a fase de um filho pequeno é dita sem gênero', () => {
    const [kid] = withChildren(founder(), [{ id: 'kid', age: FAMILY.KART_START_AGE - 2, stage: 'child' }]).family.children.slice(-1);
    expect(engine.childSummary(kid!)).toBe('Ainda sem idade para o kart');
  });
});

/* ------------------------------------------------------------------ */

describe('quem passa o comando em vida', () => {
  it('dono de equipe com herdeiro nas pistas: segue no controle da equipe, que vira participação de 100%', () => {
    const c = ownerAtSeasonEnd('f3');
    const team = engine.managedTeam(c)!;
    const heir = engine.resolveSuccession(engine.beginHandover(resolvePending(c)), 'relative-driver', 'driver');
    expect(heir.dynasty.elders).toEqual([
      {
        driverId: 'player',
        name: c.dynasty.lineage[0]!.name,
        generation: 1,
        bornYear: c.dynasty.lineage[0]!.bornYear,
        role: 'owner',
        teamName: team.name,
        sinceSeason: c.season + 1,
      },
    ]);
    expect(heir.finance.stakes.find((s) => s.teamId === team.id)).toMatchObject({ share: 1 });
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-g2`)!.body).toContain(`continua sob o controle de ${heir.dynasty.elders[0]!.name}`);
    expectValid(heir);

    // A árvore mostra o fundador vivo, no controle da equipe.
    const tree = engine.familyTree(heir);
    expect(tree.generations[0]).toMatchObject({ alive: true, elderRole: 'owner', current: false });
    expect(tree.generations[1]).toMatchObject({ alive: true, current: true });
    expect(tree.elders).toEqual(heir.dynasty.elders);
    // E o placar, a temporada como dono da equipe.
    expect(engine.generationRecords(heir)[0]).toMatchObject({ driverSeasons: 1, executiveSeasons: 1, managedTeams: [team.name], endReason: 'handover' });
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
    expect(investor.dynasty.elders).toMatchObject([{ role: 'investor', teamName: stake.teamName, generation: 1 }]);
    expect(investor.inbox[0]!.body).toContain('participações');
    expectValid(investor);

    const quiet = engine.resolveSuccession(engine.beginHandover(c), 'partner', 'executive');
    expect(quiet.dynasty.elders).toMatchObject([{ role: 'retired', teamName: null }]);
    expectValid(quiet);

    const death = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'partner', 'executive');
    expect(death.dynasty.elders).toEqual([]);

    // A morte do personagem seguinte não muda quem já estava nesse papel (a avó segue viva).
    const next = engine.resolveSuccession(engine.beginSuccession(quiet, 'death'), 'relative-adult', 'executive');
    expect(next.dynasty.generation).toBe(3);
    expect(next.dynasty.elders).toEqual(quiet.dynasty.elders);
    expectValid(next);
  });

  it('envelhece e morre pela tábua de mortalidade, com sorteio próprio', () => {
    const c = engine.resolveSuccession(engine.beginHandover(retired(83, 2_000_000)), 'partner', 'executive');
    const elder = c.dynasty.elders[0]!;
    // Sem ninguém nesse papel (a primeira geração), nada muda e nada é sorteado.
    const first = founder();
    expect(engine.checkElderMortality(first)).toBe(first);

    // Com 100 anos, a tábua não perdoa.
    const old = { ...c, dynasty: { ...c.dynasty, elders: [{ ...elder, bornYear: c.year - 100 }] } };
    const after = engine.checkElderMortality(old);
    expect(after.dynasty.elders).toEqual([]);
    const message = after.inbox.find((m) => m.id === `s${c.season}-elder-${elder.driverId}`)!;
    expect(message).toMatchObject({ category: 'family' });
    expect(message.body).toContain(`${elder.name}, que passou o comando da família em vida, morreu aos 100 anos.`);
    expectValid(after);

    // A frequência segue a tábua (aos 85 anos).
    let deaths = 0;
    for (let i = 0; i < 2000; i++) {
      const probe = { ...c, season: c.season + i, dynasty: { ...c.dynasty, elders: [{ ...elder, bornYear: c.year - 85 }] } };
      if (engine.checkElderMortality(probe).dynasty.elders.length === 0) deaths++;
    }
    expect(deaths / 2000).toBeGreaterThan(engine.mortalityRisk(85) - 0.03);
    expect(deaths / 2000).toBeLessThan(engine.mortalityRisk(85) + 0.03);
  });

  /** Uma participação na equipe de índice `index` da carreira dada. */
  const stakeIn = (c: CareerState, index: number, value: number): TeamStake => ({
    id: `stake-${c.categoryId}-${c.teams[index]!.id}`,
    teamId: c.teams[index]!.id,
    teamName: c.teams[index]!.name,
    categoryId: c.categoryId,
    share: 0.2,
    cost: 40_000,
    value,
    lastPosition: 4,
    lastDividend: 0,
  });

  /** Duas passagens de comando em vida seguidas, numa família com duas participações. */
  function twoHandovers() {
    const c = retired(83, 2_000_000);
    const big = stakeIn(c, 0, 120_000);
    const small = stakeIn(c, 1, 50_000);
    const first = engine.resolveSuccession(engine.beginHandover({ ...c, finance: { ...c.finance, stakes: [big, small] } }), 'partner', 'executive');
    const second = engine.resolveSuccession(engine.beginHandover(first), 'relative-adult', 'executive');
    return { big, small, first, second };
  }

  it('duas passagens em vida seguidas: quem já tinha passado o comando segue vivo, e cada um tem o seu papel e o seu sorteio', () => {
    const { big, small, first, second } = twoHandovers();
    expect(second.dynasty.generation).toBe(3);
    expect(second.dynasty.elders.map((e) => [e.driverId, e.generation, e.role, e.teamName])).toEqual([
      ['player', 1, 'investor', big.teamName],
      [first.playerDriverId, 2, 'investor', small.teamName],
    ]);
    // Ninguém morreu: nenhuma mensagem de luto, e a árvore mostra as três gerações vivas.
    expect(second.inbox.some((m) => m.id.includes('-elder-'))).toBe(false);
    expect(engine.familyTree(second).generations.map((g) => [g.generation, g.alive, g.elderRole])).toEqual([
      [1, true, 'investor'],
      [2, true, 'investor'],
      [3, true, null],
    ]);
    expectValid(second);
    expect(importCareer(exportCareer(second, NOW)).dynasty).toEqual(second.dynasty);

    // Cada um com o seu sorteio: com 100 anos, só o fundador morre, e a participação dele segue com a família.
    const aged = (founder: number, next: number): CareerState => ({
      ...second,
      dynasty: { ...second.dynasty, elders: second.dynasty.elders.map((e, i) => ({ ...e, bornYear: second.year - (i === 0 ? founder : next) })) },
    });
    const founderGone = engine.checkElderMortality(aged(100, 40));
    expect(founderGone.dynasty.elders.map((e) => e.driverId)).toEqual([first.playerDriverId]);
    const message = founderGone.inbox.find((m) => m.id === `s${second.season}-elder-player`)!;
    expect(message.body).toContain(`morreu aos 100 anos. A participação na ${big.teamName} segue com a família.`);
    expectValid(founderGone);
    const bothGone = engine.checkElderMortality(aged(100, 100));
    expect(bothGone.dynasty.elders).toEqual([]);
    expect(bothGone.inbox.filter((m) => m.id.startsWith(`s${second.season}-elder-`))).toHaveLength(2);
    expectValid(bothGone);
  });

  it('vendida a participação de quem passou o comando, essa pessoa cuida de outra livre ou só acompanha a família', () => {
    const { big, small, first, second } = twoHandovers();
    const role = (c: CareerState) => c.dynasty.elders.map((e) => [e.role, e.teamName]);
    // Só o fundador: passa a cuidar da outra participação.
    expect(role(engine.sellStake(first, big.id))).toEqual([['investor', small.teamName]]);
    // Com os dois: a outra já tem quem cuide, então quem perdeu a sua só acompanha.
    const soldBig = engine.sellStake(second, big.id);
    expect(role(soldBig)).toEqual([
      ['retired', null],
      ['investor', small.teamName],
    ]);
    expect(engine.familyTree(soldBig).generations[0]!.elderRole).toBe('retired');
    expectValid(soldBig);
    expect(role(engine.sellStake(second, small.id))).toEqual([
      ['investor', big.teamName],
      ['retired', null],
    ]);
    // A morte de quem só acompanha não fala de participação.
    const old = { ...soldBig, dynasty: { ...soldBig.dynasty, elders: soldBig.dynasty.elders.map((e) => ({ ...e, bornYear: soldBig.year - 100 })) } };
    const gone = engine.checkElderMortality(old);
    expect(gone.inbox.find((m) => m.id === `s${soldBig.season}-elder-player`)!.body).not.toContain('participação');
  });

  it('o sorteio entra no fechamento da temporada, nos dois modos', () => {
    const exec = engine.resolveSuccession(engine.beginHandover(retired(83, 2_000_000)), 'partner', 'executive');
    const started = engine.startExecutiveSeason(resolvePending(exec), { kind: 'spectate' });
    const aged = { ...started, dynasty: { ...started.dynasty, elders: [{ ...started.dynasty.elders[0]!, bornYear: started.year - 100 }] } };
    const closed = playExecutiveSeason(aged);
    expect(closed.dynasty.elders).toEqual([]);
    expectValid(closed);

    const driver = engine.resolveSuccession(engine.beginHandover(retired(85, 2_000_000)), 'relative-driver', 'driver');
    expect(driver.dynasty.elders).toMatchObject([{ role: 'retired' }]);
    const old = { ...driver, dynasty: { ...driver.dynasty, elders: [{ ...driver.dynasty.elders[0]!, bornYear: driver.year - 100 }] } };
    const end = playSeason(old);
    expect(end.dynasty.elders).toEqual([]);
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

    // A vaga atual segue a regra de antes da Fase 6: o grid gerado como está, a equipe na força em que o
    // herdeiro já corria, a vaga de tabela dessa força cobrada no contrato (nada pago na hora) e o
    // contrato do primeiro ano pela mesma força (HEIR_START.CONTRACT).
    const heir = engine.resolveSuccession(opened, 'kid', 'driver', 'current');
    const player = engine.getPlayer(heir);
    expect(heir.teams).toEqual(engine.buildCategoryField('f4', opened.seed, opened.season + 1).teams);
    expect(player.teamId).toBe(ranked[5]!.id);
    const t = 5 / 9;
    const terms = HEIR_START.CONTRACT;
    const win = Math.round(f4.economy.winBonus * (terms.WIN_BONUS[0] - terms.WIN_BONUS[1] * t));
    expect(heir.contract).toMatchObject({
      teamId: ranked[5]!.id,
      categoryId: 'f4',
      startSeason: heir.season,
      endSeason: heir.season,
      seatCost: roundSeat(lerp(f4.economy.seatCost, t)),
      salary: Math.round((lerp(f4.economy.salary, t) * terms.SALARY_SHARE) / 1000) * 1000,
      bonuses: { win, podium: Math.round(win * terms.PODIUM_SHARE), point: Math.round(win * terms.POINT_SHARE), title: win * terms.TITLE_MULTIPLIER },
    });
    const seats = (x: CareerState) => x.finance.transactions.filter((tx) => tx.key === 'seat');
    expect(seats(heir)).toEqual(seats(opened));
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-favoritism`)).toBeUndefined();
    // Sem escolher, é a vaga atual.
    expect(engine.resolveSuccession(opened, 'kid', 'driver')).toEqual(heir);
  });

  it('numa sucessão no meio do ano (acidente), as opções já levam em conta o fim do ano do herdeiro', () => {
    let c = midSeason(62);
    c = withChildren(c, [
      { id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 },
      { id: 'sib', age: 10 },
    ]);
    const opened = engine.beginSuccession(engine.startChildCareer(c, 'kid', 'full'), 'accident');
    const before = opened.family.children.find((k) => k.id === 'kid')!.racing!;
    // O ano do herdeiro fecha antes da escolha: a temporada dele pode mudar a força da equipe e o degrau.
    const closed = engine.closeFamilyYear({ ...opened, succession: null }).family.children.find((k) => k.id === 'kid')!.racing!;
    expect([closed.categoryId, closed.teamRank]).not.toEqual([before.categoryId, before.teamRank]);
    const current = engine.heirSeatOptions(opened, 'kid')[0]!;
    const ranked = engine.rankTeams(engine.buildCategoryField(closed.categoryId, opened.seed, opened.season + 1).teams);
    const rank = Math.min(ranked.length - 1, closed.teamRank);
    expect(current).toMatchObject({ rank, teamName: ranked[rank]!.name, available: true });
    // E a escolha dá exatamente o que a opção mostrou.
    const heir = engine.resolveSuccession(opened, 'kid', 'driver', 'current');
    expect(heir.categoryId).toBe(closed.categoryId);
    expect(heir.teams.find((t) => t.id === engine.getPlayer(heir).teamId)!.name).toBe(current.teamName);
    expect(heir.contract.seatCost).toBe(current.seatCost);
    expectValid(heir);
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
    // O carro é o do fim do ano com o acerto da virada: a média do campo sai e só parte do ganho da
    // pesquisa acima dela fica (o mesmo que a equipe levaria para o ano seguinte com o dirigente).
    const settled = engine.normalizeFieldDevelopment(c).find((t) => t.id === own.id)!;
    expect(settled.car).not.toEqual(own.car);
    expect(heir.teams.find((t) => t.id === own.id)).toMatchObject({ name: own.name, color: own.color, car: settled.car });
    expect(engine.rankTeams(heir.teams).findIndex((t) => t.id === own.id)).toBe(family.rank);
    // A meta de cada equipe segue a ordem de forças do grid novo.
    expect(engine.rankTeams(heir.teams).map((t) => t.driverTarget)).toEqual(TEAM_TARGETS.slice(0, heir.teams.length));
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

  it('a equipe que ficou com quem passou o comando (participação de 100%) também é a equipe da família', () => {
    const c = ownerAtSeasonEnd('f3');
    const own = engine.managedTeam(c)!;
    const second = engine.resolveSuccession(engine.beginHandover(resolvePending(c)), 'relative-driver', 'driver');
    expect(second.management).toBeNull();
    expect(second.finance.stakes.find((s) => s.teamId === own.id)).toMatchObject({ share: 1 });
    const closed = withChildren(resolvePending(playSeason(second)), [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]);
    const opened = engine.beginSuccession(racingIn(closed, 'kid', 'f3', 6), 'death');
    const family = engine.heirSeatOptions(opened, 'kid')[2]!;
    expect(family).toMatchObject({ id: 'family', teamName: own.name, available: true, reason: null });

    const heir = engine.resolveSuccession(opened, 'kid', 'driver', 'family');
    expect(engine.getPlayer(heir).teamId).toBe(own.id);
    expect(engine.rankTeams(heir.teams).findIndex((t) => t.id === own.id)).toBe(family.rank);
    // Ninguém da família desenvolveu o carro: a equipe vem do grid novo, como as rivais.
    expect(heir.teams).toEqual(engine.buildCategoryField('f3', opened.seed, opened.season + 1).teams);
    expect(heir.inbox.find((m) => m.id === `s${heir.season}-heir-favoritism`)).toBeDefined();
    expectValid(heir);

    // Vendida a participação, não há mais equipe da família.
    const stake = opened.finance.stakes.find((s) => s.teamId === own.id)!;
    expect(engine.heirSeatOptions(engine.sellStake(opened, stake.id), 'kid')[2]!.reason).toMatch(/não é dona/);
  }, 60_000);
});

/* ------------------------------------------------------------------ */

describe('placar e árvore da dinastia', () => {
  it('o placar de cada geração bate com a linhagem e com as temporadas', () => {
    const c = bigFamily();
    const heir = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'kid-heir', 'driver');
    const closed = playSeason(heir);
    const records = engine.generationRecords(closed);
    expect(records).toHaveLength(2);
    const [first, second] = records as [engine.GenerationRecord, engine.GenerationRecord];
    const entry = closed.dynasty.lineage[0]!;
    expect(first).toMatchObject({
      generation: 1,
      current: false,
      name: entry.name,
      titles: entry.titles,
      wins: entry.wins,
      endReason: 'death',
      driverSeasons: 1,
      executiveSeasons: 0,
      drivenTeams: [closed.history[0]!.playerTeamName],
      managedTeams: [],
      traits: c.birth!.traits,
      partnerName: entry.partnerName,
      toSeason: 1,
      toYear: closed.history[0]!.year,
    });
    const off = closed.offseason!;
    const team = closed.teams.find((t) => t.id === engine.getPlayer(closed).teamId)!;
    expect(second).toMatchObject({
      generation: 2,
      current: true,
      path: 'driver',
      toSeason: null,
      titles: off.playerPosition === 1 ? 1 : 0,
      wins: off.wins,
      podiums: off.podiums,
      drivenTeams: [team.name],
      driverSeasons: 1,
      bestCategoryId: 'f4',
      // O nascimento do herdeiro vale: a temporada pode ter revelado mais um traço.
      traits: closed.birth!.traits,
    });
    expect(closed.birth!.driverId).toBe(closed.playerDriverId);
    const totals = engine.dynastyTotals(closed);
    expect(totals).toMatchObject({
      generations: 2,
      titles: first.titles + second.titles,
      wins: first.wins + second.wins,
      podiums: first.podiums + second.podiums,
    });
    expect(totals.teams).toBe(new Set([...first.drivenTeams, ...second.drivenTeams]).size);
    expect(totals.bestCategoryId).toBe('f4');
  });

  it('as vitórias da temporada em curso contam; o título só com ela fechada', () => {
    const heir = engine.resolveSuccession(engine.beginSuccession(bigFamily(), 'death'), 'kid-heir', 'driver');
    let c = heir;
    for (let i = 0; i < 3; i++) c = playRound(c);
    const live = engine.generationRecords(c)[1]!;
    const standing = engine.computeDriverStandings(c.rounds, c.drivers, c.adjustments).find((s) => s.driverId === c.playerDriverId)!;
    expect(live.wins).toBe(standing.wins);
    expect(live.titles).toBe(0);
    expect(live.driverSeasons).toBe(1);
  });

  it('acidente no meio do ano, com quem assume indo para os negócios: a temporada é de piloto para quem saiu e de dirigente para quem entrou', () => {
    const c = withChildren(midSeason(61), [
      { id: 'kid-adult', age: 20, stage: 'other' },
      { id: 'kid-small', age: 7 },
    ]);
    const team = c.teams.find((t) => t.id === engine.getPlayer(c).teamId)!;
    const partial = engine.computeDriverStandings(c.rounds, c.drivers, c.adjustments).find((s) => s.driverId === 'player')!;
    expect(partial.wins).toBeGreaterThan(0);
    const exec = engine.resolveSuccession(engine.beginSuccession(c, 'accident'), 'kid-adult', 'executive');
    // A geração nova começa nesta temporada; a que saiu leva as vitórias dela (o título, não).
    expect(exec.dynasty.lineage.map((l) => [l.fromSeason, l.toSeason])).toEqual([
      [1, 1],
      [1, null],
    ]);
    expect(exec.dynasty.lineage[0]).toMatchObject({ wins: partial.wins, titles: 0 });
    // O ano da família não fechou: o parente tem a idade deste ano, na linhagem e na árvore.
    const small = c.family.children.find((k) => k.id === 'kid-small')!;
    expect(exec.dynasty.relatives).toMatchObject([{ id: 'kid-small', bornYear: c.year - small.age }]);
    expect(engine.familyTree(exec).generations[0]!.relatives[0]!.age).toBe(small.age);
    expectValid(exec);

    const former = (career: CareerState) => engine.generationRecords(career)[0]!;
    const asDriver = {
      driverSeasons: 1,
      executiveSeasons: 0,
      drivenTeams: [team.name],
      managedTeams: [],
      wins: partial.wins,
      podiums: partial.podiums,
      titles: 0,
    };
    // Em curso, fechada e já arquivada (com o nome da equipe tirado das equipes da categoria).
    expect(former(exec)).toMatchObject(asDriver);
    expect(engine.generationRecords(exec)[1]).toMatchObject({ fromSeason: 1, driverSeasons: 0, executiveSeasons: 1, wins: 0, podiums: 0 });
    const closed = playExecutiveSeason(exec);
    expect(former(closed)).toMatchObject(asDriver);
    expect(engine.generationRecords(closed)[1]).toMatchObject({ driverSeasons: 0, executiveSeasons: 1 });
    expectValid(closed);
    const next = engine.startExecutiveSeason(resolvePending(closed), { kind: 'spectate' });
    expect(former(next)).toMatchObject(asDriver);
    expect(engine.generationRecords(next)[1]).toMatchObject({ driverSeasons: 0, executiveSeasons: 2 });
    expect(engine.dynastyTotals(next)).toMatchObject({ wins: partial.wins, podiums: partial.podiums, driverSeasons: 1, executiveSeasons: 2 });
  }, 60_000);

  it('acidente no meio do ano, com herdeiro piloto: a temporada interrompida fica com a equipe e as vitórias de quem saiu', () => {
    const c = engine.startChildCareer(withChildren(midSeason(62), [{ id: 'kid', age: 17, kartYears: 6, talent: 90, interest: 90 }]), 'kid', 'full');
    const team = c.teams.find((t) => t.id === engine.getPlayer(c).teamId)!;
    const partial = engine.computeDriverStandings(c.rounds, c.drivers, c.adjustments).find((s) => s.driverId === 'player')!;
    expect(partial.wins).toBeGreaterThan(0);
    const heir = engine.resolveSuccession(engine.beginSuccession(c, 'accident'), 'kid', 'driver');
    // A temporada é arquivada como de piloto de quem saiu: equipe, posição, pontos e meta até ali.
    expect(heir.history.at(-1)).toMatchObject({
      season: 1,
      mode: 'driver',
      playerTeamId: team.id,
      playerTeamName: team.name,
      playerPosition: partial.position,
      playerPoints: partial.points,
      objectiveTarget: team.driverTarget,
      objectiveMet: partial.position <= team.driverTarget,
    });
    expect(heir.dynasty.lineage[0]).toMatchObject({ wins: partial.wins, titles: 0, toSeason: 1 });
    expect(engine.generationRecords(heir)[0]).toMatchObject({
      driverSeasons: 1,
      executiveSeasons: 0,
      drivenTeams: [team.name],
      wins: partial.wins,
      podiums: partial.podiums,
      titles: 0,
    });
    expectValid(heir);
  });

  it('o placar e a árvore abrem em todos os saves gravados', () => {
    const files = readdirSync('tests/fixtures')
      .filter((name) => /^v\d+$/.test(name))
      .flatMap((folder) => readdirSync(`tests/fixtures/${folder}`).map((name) => `tests/fixtures/${folder}/${name}`))
      .filter((path) => path.endsWith('.json'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const career = importCareer(readFileSync(file, 'utf8'));
      const records = engine.generationRecords(career);
      expect(records, file).toHaveLength(career.dynasty.lineage.length);
      expect(records.at(-1)!.current, file).toBe(true);
      expect(engine.familyTree(career).generations, file).toHaveLength(career.dynasty.generation);
      expect(engine.dynastyTotals(career).generations, file).toBe(career.dynasty.lineage.length);
    }
  });

  it('a árvore: o personagem de cada geração, o parceiro, os filhos atuais e os parentes', () => {
    const c = bigFamily();
    const tree = engine.familyTree(c);
    expect(tree.surname).toBe(c.dynasty.surname);
    expect(tree.generations).toHaveLength(1);
    const now = tree.generations[0]!;
    expect(now).toMatchObject({ current: true, alive: true, elderRole: null, relatives: [] });
    expect(now.partnerName).toBe(`${c.family.partner!.firstName} ${c.family.partner!.lastName}`);
    expect(now.children.map((k) => k.id)).toEqual(['kid-heir', 'kid-eng', 'kid-biz', 'kid-raced']);
    const heirNode = now.children[0]!;
    expect(heirNode.revealed).toHaveLength(1);
    expect(heirNode.hidden).toBe(2);

    const heir = engine.resolveSuccession(engine.beginSuccession(c, 'death'), 'kid-heir', 'driver');
    const after = engine.familyTree(heir);
    expect(after.generations.map((g) => [g.generation, g.alive, g.current])).toEqual([
      [1, false, false],
      [2, true, true],
    ]);
    expect(after.generations[0]!.relatives.map((r) => [r.id, r.path, r.age])).toEqual(
      heir.dynasty.relatives.map((r) => [r.id, r.path, heir.year - r.bornYear]),
    );
    expect(after.generations[0]!.partnerName).toBe(heir.dynasty.lineage[0]!.partnerName);
    expect(after.generations[1]!.children).toEqual([]);
    expect(after.generations[1]!.relatives).toEqual([]);
  });
});

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
    // O fundador da carreira de teste morreu; para estar vivo, teria de ter passado o comando.
    const handedOver = (c: CareerState, elders: (typeof elder)[]) =>
      dynasty(c, { elders, lineage: c.dynasty.lineage.map((l, i) => (i === 0 ? { ...l, endReason: 'handover' as const } : l)) });
    expect(problems((c) => handedOver(c, [elder]))).toEqual([]);
    expect(problems((c) => dynasty(c, { elders: [elder] }))).toContain('Quem passou o comando em vida (player) não saiu por uma passagem de comando.');
    expect(problems((c) => handedOver(c, [elder, elder]))).toContain('Quem passou o comando em vida aparece duas vezes.');
    expect(problems((c) => handedOver(c, [{ ...elder, generation: 2 }]))).toContain(
      'Quem passou o comando em vida (player) é de geração igual ou maior que a atual.',
    );
    expect(problems((c) => handedOver(c, [{ ...elder, driverId: 'ninguem' }]))).toContain(
      'Quem passou o comando em vida (ninguem) não é um personagem anterior da linhagem.',
    );
    expect(problems((c) => handedOver(c, [{ ...elder, driverId: c.playerDriverId }]))).toContain(
      `Quem passou o comando em vida (${heir.playerDriverId}) não é um personagem anterior da linhagem.`,
    );

    const trait = (id: 'rainMaster' | 'rainFear') => ({ id, revealedSeason: null, revealedRound: null });
    const withTraits = (traits: ReturnType<typeof trait>[]) => (c: CareerState) =>
      dynasty(c, { lineage: c.dynasty.lineage.map((l, i) => (i === 0 ? { ...l, traits } : l)) });
    expect(problems(withTraits([trait('rainMaster'), trait('rainMaster')]))).toContain('Traço de nascença repetido na linhagem (player).');
    expect(problems(withTraits([trait('rainMaster'), trait('rainFear')]))).toContain('Traços de nascença opostos na linhagem (player).');
  });
});
