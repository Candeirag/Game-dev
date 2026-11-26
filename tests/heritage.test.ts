/**
 * Herança e teste no kart (Fase 6): os talentos e defeitos de nascença dos filhos (parte herdada,
 * parte sorteada), o teste no kart da adolescência, a revelação nas temporadas de carreira própria,
 * os filhos de saves antigos, o nascimento do herdeiro e o que se sabe dele antes da escolha.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIRTH, HERITAGE, TRAIT_EFFECTS } from '@/config/balance';
import { APTITUDE_KEYS, BirthSchema, CareerStateSchema, type BirthTrait, type CareerState, type Child, type HeirOption, type TraitId } from '@/domain/schemas';
import { BIRTH_TRAITS, HOMETOWNS } from '@/data/birth';
import { FAMILY } from '@/data/family';
import { FAMILY_EVENT_TEXTS } from '@/data/familyTexts';
import { KART_TEST_VERDICT_INFO } from '@/data/heritage';
import { applyEffects } from '@/engine/events/effects';
import { describeEffects } from '@/engine/story/outcome';
import { markSeen } from '@/engine/story/memory';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import * as engine from './engineApi';
import { NOW, newCareer, playExecutiveRound, playRound } from './helpers';

const hidden = (...ids: TraitId[]): BirthTrait[] => ids.map((id) => ({ id, revealedSeason: null, revealedRound: null }));
const kind = (id: TraitId) => BIRTH_TRAITS[id].kind;

/** Os invariantes de um conjunto de traços de nascença. */
function expectValidTraits(traits: readonly BirthTrait[]) {
  const ids = traits.map((t) => t.id);
  expect(ids).toHaveLength(HERITAGE.TALENTS + HERITAGE.DEFECTS + HERITAGE.EXTRA_TRAITS);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.some((id) => ids.includes(BIRTH_TRAITS[id].opposite))).toBe(false);
  expect(ids.filter((id) => kind(id) === 'talent').length).toBeGreaterThanOrEqual(HERITAGE.TALENTS);
  expect(ids.filter((id) => kind(id) === 'defect').length).toBeGreaterThanOrEqual(HERITAGE.DEFECTS);
}

function expectValid(career: CareerState) {
  const parsed = CareerStateSchema.safeParse(career);
  expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
  expect(validateCareerIntegrity(career)).toEqual([]);
}

function careerWithPartner(seed = 41): CareerState {
  const c = newCareer(seed);
  const partner = { ...engine.generatePartner(seed, 28, 1), relationship: 80 };
  return { ...c, family: { ...c.family, partner } };
}

function withChild(career: CareerState, patch: Partial<Child>, seed = 1): { career: CareerState; child: Child } {
  const child = { ...engine.generateChild(career, seed), ...patch };
  return { career: { ...career, family: { ...career.family, children: [...career.family.children, child] } }, child };
}

const findChild = (career: CareerState, id: string) => career.family.children.find((c) => c.id === id)!;

/** Um filho com a carreira própria começada (apoio completo). */
function racingChild(base: CareerState, patch: Partial<Child> = {}, id = 'kid-r'): CareerState {
  const { career } = withChild(base, { id, age: 15, kartYears: 6, talent: 86, interest: 90, ...patch });
  return engine.startChildCareer(career, id, 'full');
}

/** Todos os textos de um objeto de texto (título, corpo, rótulos, descrições e desfechos). */
const allStrings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(allStrings) : [];

/* ------------------------------------------------------------------ */

describe('herança dos talentos e defeitos', () => {
  const parent = hidden('rainMaster', 'tyreEater', 'hothead');

  it('cada traço do pai ou da mãe passa com a chance de HERITAGE.INHERIT_CHANCE', () => {
    let passed = 0;
    let trials = 0;
    for (let i = 0; i < 2000; i++) {
      const inherited = engine.inheritTraits(parent, engine.createRng(engine.hashSeed(99, 'herança', i)));
      for (const t of parent) {
        trials++;
        if (inherited.includes(t.id)) passed++;
      }
    }
    expect(passed / trials).toBeGreaterThan(HERITAGE.INHERIT_CHANCE - 0.03);
    expect(passed / trials).toBeLessThan(HERITAGE.INHERIT_CHANCE + 0.03);
    // Nos traços completos, o do pai aparece pelo menos com essa chance (o sorteio do resto também pode trazê-lo).
    const present = Array.from({ length: 2000 }, (_, i) => engine.drawHeritageTraits(parent, engine.hashSeed(7, i))).filter((traits) =>
      traits.some((t) => t.id === 'rainMaster'),
    ).length;
    expect(present / 2000).toBeGreaterThan(HERITAGE.INHERIT_CHANCE);
  });

  it('2.000 sorteios: três traços, sem repetição nem par oposto, com talento e defeito, todos ocultos', () => {
    const seen = new Set<TraitId>();
    for (let i = 0; i < 2000; i++) {
      const parentTraits = engine.drawBirth(i, 0, 'pai').traits;
      const traits = engine.drawHeritageTraits(i % 5 === 0 ? [] : parentTraits, engine.hashSeed(3, 'filho', i));
      expectValidTraits(traits);
      expect(traits.every((t) => t.revealedSeason === null && t.revealedRound === null)).toBe(true);
      for (const t of traits) seen.add(t.id);
    }
    expect(seen.size).toBe(16);
  });

  it('herdar dois talentos não impede o defeito: o resto completa a composição', () => {
    const talents = hidden('rainMaster', 'bornStarter', 'tyreSaver');
    for (let i = 0; i < 300; i++) expectValidTraits(engine.drawHeritageTraits(talents, engine.hashSeed(5, i)));
  });

  it('é determinístico: a mesma semente dá os mesmos traços', () => {
    expect(engine.drawHeritageTraits(parent, 1234)).toEqual(engine.drawHeritageTraits(parent, 1234));
  });

  it('o filho que nasce herda do nascimento ativo, num sorteio separado que não mexe no resto do filho', () => {
    const base = careerWithPartner();
    const kid = engine.generateChild(base, 11);
    expectValidTraits(kid.birthTraits);
    expect(kid.birthTraits).toEqual(engine.drawHeritageTraits(base.birth!.traits, engine.hashSeed(base.seed, 'child-heritage', kid.id)));
    // Sem nascimento ativo (um herdeiro de save antigo), tudo sorteado; o resto do filho é igual.
    const orphan = engine.generateChild({ ...base, birth: null }, 11);
    expect(orphan.birthTraits).toEqual(engine.drawHeritageTraits([], engine.hashSeed(base.seed, 'child-heritage', kid.id)));
    expect({ ...orphan, birthTraits: [] }).toEqual({ ...kid, birthTraits: [] });
    expect(kid.kartTest).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe('teste no kart', () => {
  const testEvent = (career: CareerState, child: Child) => engine.familySeasonEvents(career).find((e) => e.definitionId === `family-kart-test-${child.id}`);

  it('aparece para quem tem 12 ou 13 anos e ainda não fez, com três escolhas (a primeira é o teste completo)', () => {
    const base = careerWithPartner();
    for (const age of [11, 12, 13, 14]) {
      const { career, child } = withChild(base, { age, stage: age >= 8 ? 'karting' : 'child', kartFunding: 'basic' });
      const event = testEvent(career, child);
      expect(event !== undefined, `idade ${age}`).toBe(age >= HERITAGE.KART_TEST_AGE && age < FAMILY.CAREER_START_AGE);
      if (event) {
        expect(event.choices.map((c) => c.id)).toEqual(['full', 'quick', 'skip']);
        expect(event.category).toBe('family');
        expect(event.storyKey).toMatch(/^family-kartTest#/);
      }
    }
    const { career, child } = withChild(base, { age: 12, kartTest: { season: 1, depth: 'quick', gap: 0.5, revealed: [] } });
    expect(testEvent(career, child)).toBeUndefined();
  });

  it('o teste completo custa, revela dois traços, grava o resultado e manda mensagem; só uma vez', () => {
    const { career, child } = withChild(careerWithPartner(), { age: 12, stage: 'karting', kartYears: 3 });
    const event = testEvent(career, child)!;
    const done = engine.resolveEvent({ ...career, pendingEvents: [event] }, event.id, 'full').career;
    const tested = findChild(done, child.id);
    expect(done.finance.cash).toBe(career.finance.cash - HERITAGE.KART_TEST_COST.full);
    expect(done.finance.seasonTotals.family).toBe(-HERITAGE.KART_TEST_COST.full);
    expect(tested.kartTest).toMatchObject({ season: career.season, depth: 'full' });
    expect(tested.kartTest!.revealed).toHaveLength(HERITAGE.KART_TEST_REVEALS.full);
    for (const id of tested.kartTest!.revealed)
      expect(tested.birthTraits.find((t) => t.id === id)).toMatchObject({ revealedSeason: career.season, revealedRound: 0 });
    expect(tested.birthTraits.filter((t) => t.revealedSeason !== null)).toHaveLength(2);
    // A diferença tem três casas e nunca é negativa.
    expect(tested.kartTest!.gap).toBeGreaterThanOrEqual(0);
    expect(Math.round(tested.kartTest!.gap * 1000) / 1000).toBe(tested.kartTest!.gap);
    const message = done.inbox.find((m) => m.id === `s${career.season}-kart-test-${child.id}`)!;
    expect(message.category).toBe('family');
    expect(message.body).toContain(`+${tested.kartTest!.gap.toFixed(3)} s`);
    expect(message.body).toContain(KART_TEST_VERDICT_INFO[engine.kartTestVerdict(tested.kartTest!.gap)].label.toLowerCase());
    for (const id of tested.kartTest!.revealed) {
      expect(message.body).toContain(BIRTH_TRAITS[id].name);
      expect(message.body).toContain(kind(id) === 'talent' ? `${BIRTH_TRAITS[id].name} (talento)` : `${BIRTH_TRAITS[id].name} (defeito)`);
    }
    expectValid(done);
    // Uma vez só: o evento não volta e o efeito repetido não muda nada.
    expect(testEvent(done, tested)).toBeUndefined();
    expect(engine.applyKartTest(done, child.id, 'full')).toBe(done);
    // O que mudou aparece na tela do desfecho.
    const views = describeEffects(career, done, event.choices[0]!.outcomes[0]!.effects);
    expect(views.some((v) => v.kind === 'note' && v.text.includes('teste no kart'))).toBe(true);
  });

  it('o rápido custa menos e revela um traço; não levar não custa, não revela e tira vínculo', () => {
    const { career, child } = withChild(careerWithPartner(), { age: 13 });
    const event = testEvent(career, child)!;
    const quick = engine.resolveEvent({ ...career, pendingEvents: [event] }, event.id, 'quick').career;
    expect(quick.finance.cash).toBe(career.finance.cash - HERITAGE.KART_TEST_COST.quick);
    expect(findChild(quick, child.id).kartTest!.revealed).toHaveLength(HERITAGE.KART_TEST_REVEALS.quick);
    expect(findChild(quick, child.id).kartTest!.depth).toBe('quick');
    // A primeira revelação é a mesma nos dois testes (o rápido só para antes).
    const full = engine.applyKartTest(career, child.id, 'full');
    expect(findChild(full, child.id).kartTest!.revealed[0]).toBe(findChild(quick, child.id).kartTest!.revealed[0]);
    expect(findChild(full, child.id).kartTest!.gap).toBe(findChild(quick, child.id).kartTest!.gap);

    const skipped = engine.resolveEvent({ ...career, pendingEvents: [event] }, event.id, 'skip').career;
    expect(skipped.finance.cash).toBe(career.finance.cash);
    expect(findChild(skipped, child.id).kartTest).toBeNull();
    expect(findChild(skipped, child.id).birthTraits.every((t) => t.revealedSeason === null)).toBe(true);
    expect(findChild(skipped, child.id).bond).toBe(child.bond - HERITAGE.KART_TEST_SKIP_BOND);
  });

  it('a diferença cai com o teto e com os anos de kart, e o veredito segue as faixas', () => {
    const base = careerWithPartner();
    const gap = (talent: number, kartYears: number) => {
      const { career, child } = withChild(base, { id: 'kid-teste', age: 12, talent, kartYears });
      return findChild(engine.applyKartTest(career, child.id, 'quick'), child.id).kartTest!.gap;
    };
    expect(gap(70, 0)).toBeGreaterThan(gap(85, 0));
    expect(gap(85, 0)).toBeGreaterThan(gap(85, 4));
    expect(gap(70, 0)).toBeGreaterThan(1);
    const bands = HERITAGE.KART_TEST_VERDICTS;
    expect(engine.kartTestVerdict(0)).toBe('outstanding');
    expect(engine.kartTestVerdict(bands.outstanding)).toBe('outstanding');
    expect(engine.kartTestVerdict(bands.outstanding + 0.001)).toBe('promising');
    expect(engine.kartTestVerdict(bands.promising + 0.001)).toBe('average');
    expect(engine.kartTestVerdict(bands.average + 0.001)).toBe('limited');
  });

  it('textos em variantes: pelo menos seis, cada uma uma vez por personagem', () => {
    expect(FAMILY_EVENT_TEXTS.kartTest.length).toBeGreaterThanOrEqual(6);
    let { career } = withChild(careerWithPartner(), { age: 12 });
    const child = career.family.children[0]!;
    const titles: string[] = [];
    for (let i = 0; i < FAMILY_EVENT_TEXTS.kartTest.length + 2; i++) {
      const event = testEvent(career, child);
      if (!event) break;
      titles.push(event.title);
      career = markSeen(career, [event.storyKey!], 0);
    }
    expect(titles).toHaveLength(FAMILY_EVENT_TEXTS.kartTest.length);
    expect(new Set(titles).size).toBe(titles.length);
    // Os textos do grupo não se repetem entre si nem com os de outros grupos (mesmos nomes e valores).
    const name = 'Teca';
    const [high, low] = ['R$ 3 mil', 'R$ 900'];
    const texts = FAMILY_EVENT_TEXTS.kartTest.flatMap((variant) => allStrings(variant({ child: name, age: 12, full: high, quick: low })));
    expect(texts).toHaveLength(FAMILY_EVENT_TEXTS.kartTest.length * 11);
    expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([]);
    const others = new Set([
      ...FAMILY_EVENT_TEXTS.partner.flatMap((v) =>
        allStrings(v({ first: name, full: `${name} Souza`, age: 12, background: 'médica', description: 'Cuida de um hospital.' })),
      ),
      ...FAMILY_EVENT_TEXTS.wedding.flatMap((v) => allStrings(v({ first: name, together: '3 temporadas', share: 50, party: high, simple: low }))),
      ...FAMILY_EVENT_TEXTS.crisis.flatMap((v) =>
        [true, false].flatMap((married) => allStrings(v({ first: name, married, share: 50, therapy: high, trip: low }))),
      ),
      ...FAMILY_EVENT_TEXTS.child.flatMap((v) => [true, false].flatMap((firstChild) => allStrings(v({ first: name, firstChild, baby: name })))),
      ...FAMILY_EVENT_TEXTS.kart.flatMap((v) => allStrings(v({ child: name, age: 12, until: 14, perYear: 2, full: high, basic: low }))),
      ...FAMILY_EVENT_TEXTS.career.flatMap((v) => allStrings(v({ child: name, age: 12, traits: 'calmo', base: '3,0 anos', seatLow: low, seatHigh: high }))),
    ]);
    expect(others.size).toBeGreaterThan(100);
    expect(texts.filter((t) => others.has(t))).toEqual([]);
  });

  it('o veredito do teste não usa as palavras da avaliação dos treinadores', () => {
    const { child } = withChild(careerWithPartner(), { stage: 'racing' });
    const scout = new Set(Array.from({ length: 61 }, (_, i) => engine.childScoutReport({ ...child, talent: 40 + i })));
    expect(scout.size).toBe(5);
    for (const verdict of Object.values(KART_TEST_VERDICT_INFO)) expect(scout.has(verdict.label)).toBe(false);
    expect(new Set(Object.values(KART_TEST_VERDICT_INFO).map((v) => v.label)).size).toBe(4);
  });

  it('dois filhos na idade do teste ganham dois eventos, com textos diferentes', () => {
    let { career } = withChild(careerWithPartner(), { id: 'kid-a', age: 12 });
    ({ career } = withChild(career, { id: 'kid-b', age: 13, firstName: 'Caçula' }, 2));
    const events = engine.familySeasonEvents(career).filter((e) => e.definitionId.startsWith('family-kart-test-'));
    expect(events.map((e) => e.definitionId)).toEqual(['family-kart-test-kid-a', 'family-kart-test-kid-b']);
    expect(events[0]!.storyKey).not.toBe(events[1]!.storyKey);
  });
});

/* ------------------------------------------------------------------ */

describe('temporadas de carreira própria', () => {
  it('cada temporada pode revelar mais um traço (sorteio próprio), com nota no fechamento', () => {
    const base = careerWithPartner();
    let reveals = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const c = racingChild(base, {}, `kid-${i}`);
      const kid = findChild(c, `kid-${i}`);
      const closed = engine.closeChildSeason(kid, c, null);
      const shown = closed.child.birthTraits.filter((t) => t.revealedSeason !== null);
      expect(shown.length).toBeLessThanOrEqual(1);
      if (shown.length === 1) {
        reveals++;
        expect(shown[0]).toMatchObject({ revealedSeason: c.season, revealedRound: c.calendar.length });
        expect(closed.note).toContain(BIRTH_TRAITS[shown[0]!.id].name);
      }
    }
    expect(reveals / total).toBeGreaterThan(HERITAGE.SEASON_REVEAL_CHANCE - 0.08);
    expect(reveals / total).toBeLessThan(HERITAGE.SEASON_REVEAL_CHANCE + 0.08);
  });

  it('vale também para quem corre no campeonato do jogador, e nada aparece com tudo revelado', () => {
    const base = careerWithPartner();
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const c = racingChild(base, {}, `kid-w${i}`);
      const kid = findChild(c, `kid-w${i}`);
      const closed = engine.closeChildSeason(kid, c, { position: 3, wins: 1, driver: kid.driver!, teamName: 'Equipe da família' });
      if (closed.child.birthTraits.some((t) => t.revealedSeason !== null)) found = true;
    }
    expect(found).toBe(true);
    const c = racingChild(base);
    const kid = findChild(c, 'kid-r');
    const allShown = { ...kid, birthTraits: kid.birthTraits.map((t) => ({ ...t, revealedSeason: 1, revealedRound: 0 })) };
    expect(engine.closeChildSeason(allShown, c, null).child.birthTraits).toEqual(allShown.birthTraits);
  });

  it('quem aprende rápido evolui mais na temporada; quem aprende devagar, menos', () => {
    const base = careerWithPartner();
    const c = racingChild(base);
    const kid = findChild(c, 'kid-r');
    const rating = (traits: BirthTrait[]) => engine.overallRating(engine.closeChildSeason({ ...kid, birthTraits: traits }, c, null).child.driver!.attributes);
    const quick = rating(hidden('quickLearner', 'rainFear', 'tyreSaver'));
    const neutral = rating(hidden('rainMaster', 'tyreEater', 'hothead'));
    const slow = rating(hidden('slowLearner', 'rainMaster', 'tyreSaver'));
    expect(TRAIT_EFFECTS.quickLearner.training).toBeGreaterThan(1);
    expect(quick).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(slow);
    expect(engine.childTrainingFactor({ birthTraits: hidden('quickLearner') })).toBe(TRAIT_EFFECTS.quickLearner.training);
  });

  it('familyTrainingFactors: por id de piloto, só os filhos que correm e aprendem rápido ou devagar', () => {
    const quick = racingChild(careerWithPartner(), { birthTraits: hidden('quickLearner', 'rainFear', 'tyreSaver') });
    const kid = findChild(quick, 'kid-r');
    expect(engine.familyTrainingFactors(quick)).toEqual({ [kid.driver!.id]: TRAIT_EFFECTS.quickLearner.training });
    const neutral = racingChild(careerWithPartner(), { birthTraits: hidden('rainMaster', 'tyreEater', 'hothead') });
    expect(engine.familyTrainingFactors(neutral)).toEqual({});
    // Quem não corre não entra (não tem piloto).
    const { career } = withChild(careerWithPartner(), { age: 12, birthTraits: hidden('slowLearner', 'rainMaster', 'tyreSaver') });
    expect(engine.familyTrainingFactors(career)).toEqual({});
  });

  it('no campeonato do jogador, o filho no grid aprende rápido ou devagar nas etapas (piloto e dirigente)', () => {
    const base = careerWithPartner();
    // O piloto do filho é um piloto do grid com margem para evoluir, como o filho na equipe do dirigente.
    const rival = base.drivers.find((d) => d.teamId && !d.isPlayer && d.role !== 'reserve' && d.potential - d.attributes.pace > 5)!;
    const withGridKid = (career: CareerState, traits: BirthTrait[] | null): CareerState => {
      if (!traits) return career;
      const c = racingChild(career);
      return {
        ...c,
        family: { ...c.family, children: c.family.children.map((k) => (k.id === 'kid-r' ? { ...k, driver: { ...rival }, birthTraits: traits } : k)) },
      };
    };
    const total = (career: CareerState) => Object.values(career.drivers.find((d) => d.id === rival.id)!.attributes).reduce((a, b) => a + b, 0);
    for (const play of [(c: CareerState) => playRound(c), (c: CareerState) => playExecutiveRound(engine.retireFromDriving(c))]) {
      const quick = total(play(withGridKid(base, hidden('quickLearner', 'rainFear', 'tyreSaver'))));
      const neutral = total(play(withGridKid(base, hidden('rainMaster', 'tyreEater', 'hothead'))));
      const slow = total(play(withGridKid(base, hidden('slowLearner', 'rainMaster', 'tyreSaver'))));
      expect(quick).toBeGreaterThan(neutral);
      expect(neutral).toBeGreaterThan(slow);
      // Sem filho no grid, o piloto evolui exatamente como com um filho sem esses traços.
      expect(total(play(withGridKid(base, null)))).toBe(neutral);
    }
  });

  it('a evolução por fora segue o apoio da família (HERITAGE.SUPPORT_DEVELOPMENT)', () => {
    const c = racingChild(careerWithPartner());
    const kid = findChild(c, 'kid-r');
    const rating = (support: Child['support']) => engine.overallRating(engine.closeChildSeason({ ...kid, support }, c, null).child.driver!.attributes);
    expect(HERITAGE.SUPPORT_DEVELOPMENT.full).toBeGreaterThan(HERITAGE.SUPPORT_DEVELOPMENT.basic);
    expect(rating('full')).toBeGreaterThan(rating('basic'));
    expect(rating('basic')).toBeGreaterThan(rating('none'));
  });

  it('a avaliação dos treinadores segue as faixas de HERITAGE.SCOUT_BANDS', () => {
    const { child } = withChild(careerWithPartner(), { stage: 'karting', kartYears: HERITAGE.SCOUT_MIN_KART_YEARS });
    const bands = HERITAGE.SCOUT_BANDS;
    const report = (talent: number) => engine.childScoutReport({ ...child, talent });
    expect(engine.childScoutReport({ ...child, kartYears: HERITAGE.SCOUT_MIN_KART_YEARS - 0.01 })).toBeNull();
    expect(report(bands.outstanding)).toBe('Fora de série');
    expect(report(bands.outstanding - 1)).toBe('Muito promissor');
    expect(report(bands.veryPromising)).toBe('Muito promissor');
    expect(report(bands.veryPromising - 1)).toBe('Promissor');
    expect(report(bands.promising)).toBe('Promissor');
    expect(report(bands.promising - 1)).toBe('Mediano');
    expect(report(bands.average)).toBe('Mediano');
    expect(report(bands.average - 1)).toBe('Limitado');
  });
});

/* ------------------------------------------------------------------ */

describe('filhos de saves antigos', () => {
  const oldSave = () => importCareer(readFileSync('tests/fixtures/v3/fase0-dirigente-dono-de-equipe.json', 'utf8'));

  it('chegam sem traços e ganham os herdados no começo da temporada e na abertura da sucessão, sempre os mesmos', () => {
    const old = oldSave();
    expect(old.family.children.length).toBeGreaterThan(0);
    expect(old.family.children.every((c) => c.birthTraits.length === 0)).toBe(true);
    const ensured = engine.ensureHeritage(old);
    for (const child of ensured.family.children) {
      expectValidTraits(child.birthTraits);
      expect(child.birthTraits).toEqual(
        engine.drawHeritageTraits(engine.activeBirth(old)?.traits ?? [], engine.hashSeed(old.seed, 'child-heritage', child.id)),
      );
    }
    // Nada a fazer: devolve a mesma carreira.
    expect(engine.ensureHeritage(ensured)).toBe(ensured);
    // O começo da temporada e a sucessão dão os mesmos traços.
    expect(engine.beginSeasonFamily(old).family.children.map((c) => c.birthTraits)).toEqual(ensured.family.children.map((c) => c.birthTraits));
    const succession = engine.beginSuccession(old, 'death');
    expect(succession.family.children.map((c) => c.birthTraits)).toEqual(ensured.family.children.map((c) => c.birthTraits));
    expectValid(engine.beginSeasonFamily(old));
  });

  it('o fechamento do ano da família dá os mesmos traços de ensureHeritage, antes de revelar', () => {
    const old = oldSave();
    const ids = (children: readonly Child[]) => children.map((c) => c.birthTraits.map((t) => t.id));
    const { family } = engine.closeFamilyYear(old);
    expect(ids(family.children)).toEqual(ids(engine.ensureHeritage(old).family.children));
    for (const child of family.children) expectValidTraits(child.birthTraits);
    // Um filho de save antigo que corre: a temporada revela um dos traços que ele herda (não outro).
    let revealed = 0;
    for (let i = 0; i < 12; i++) {
      const c = racingChild(careerWithPartner(), {}, `kid-old-${i}`);
      const oldKid = { ...findChild(c, `kid-old-${i}`), birthTraits: [] };
      const asOld = { ...c, family: { ...c.family, children: [oldKid] } };
      const expected = engine.ensureHeritage(asOld).family.children[0]!.birthTraits;
      const closed = engine.closeFamilyYear(asOld).family.children[0]!;
      expect(closed.birthTraits.map((t) => t.id)).toEqual(expected.map((t) => t.id));
      revealed += closed.birthTraits.filter((t) => t.revealedSeason === c.season).length;
    }
    expect(revealed).toBeGreaterThan(0);
  });

  it('save antigo com nascimento ativo: o filho sem traços herda do fundador', () => {
    const base = careerWithPartner();
    expect(engine.activeBirth(base)).not.toBeNull();
    const children = Array.from({ length: 8 }, (_, i) => ({ ...engine.generateChild(base, i + 1), id: `kid-antigo-${i}`, birthTraits: [] }));
    const old: CareerState = { ...base, family: { ...base.family, children } };
    const ensured = engine.ensureHeritage(old);
    for (const child of ensured.family.children) {
      expectValidTraits(child.birthTraits);
      expect(child.birthTraits).toEqual(engine.drawHeritageTraits(base.birth!.traits, engine.hashSeed(base.seed, 'child-heritage', child.id)));
    }
    // Os traços do fundador contam: sem o nascimento ativo, a herança sai diferente.
    const orphans = engine.ensureHeritage({ ...old, birth: null });
    expect(orphans.family.children.map((c) => c.birthTraits)).not.toEqual(ensured.family.children.map((c) => c.birthTraits));
    expectValid(ensured);
  });
});

/* ------------------------------------------------------------------ */

describe('o herdeiro: o que se sabe dele e o nascimento', () => {
  function heirCareer(): { career: CareerState; child: Child; option: HeirOption } {
    const base = careerWithPartner(43);
    const { career: withKid } = withChild(base, { id: 'kid-h', age: 16, kartYears: 6, talent: 88, interest: 90, stage: 'karting' });
    let career = engine.startChildCareer(withKid, 'kid-h', 'full');
    career = engine.applyKartTest(career, 'kid-h', 'full');
    const child = findChild(career, 'kid-h');
    const option = engine.beginSuccession(career, 'death').succession!.heirs.find((h) => h.childId === 'kid-h')!;
    return { career, child, option };
  }

  it('heirOutlook mostra os traços revelados, quantos faltam, o teste, a avaliação e onde corre', () => {
    const { career, child, option } = heirCareer();
    const outlook = engine.heirOutlook(career, option);
    expect(outlook.revealed.map((t) => t.id)).toEqual(child.birthTraits.filter((t) => t.revealedSeason !== null).map((t) => t.id));
    expect(outlook.revealed).toHaveLength(HERITAGE.KART_TEST_REVEALS.full);
    expect(outlook.revealed.every((t) => t.kind === kind(t.id))).toBe(true);
    expect(outlook.hidden).toBe(child.birthTraits.length - HERITAGE.KART_TEST_REVEALS.full);
    expect(outlook.kartTest).toEqual({ depth: 'full', gap: child.kartTest!.gap, verdict: engine.kartTestVerdict(child.kartTest!.gap) });
    expect(outlook.scout).toBe(engine.childScoutReport(child));
    expect(outlook).toMatchObject({ age: child.age, categoryId: 'kart-regional', tier: 1, teamName: child.racing!.teamName });
    // O parceiro não tem traços nem carreira; o parente jovem tem traços todos ocultos.
    const heirs = engine.beginSuccession(career, 'death').succession!.heirs;
    expect(engine.heirOutlook(career, heirs.find((h) => h.kind === 'partner')!)).toMatchObject({ revealed: [], hidden: 0, kartTest: null, categoryId: null });
    const relative = engine.heirOutlook(career, heirs.find((h) => h.id === 'relative-driver')!);
    expect(relative).toMatchObject({ revealed: [], hidden: 3, categoryId: 'kart-regional', teamName: null });
  });

  it('heirBirth: filho de ex-piloto na capital, com os traços e as marcas, aptidões puxadas do antecessor', () => {
    const { career, child, option } = heirCareer();
    const birth = engine.heirBirth(career, option);
    expect(BirthSchema.safeParse(birth).success).toBe(true);
    expect(birth).toMatchObject({
      driverId: child.driver!.id,
      origin: 'racer-parent',
      rerolls: 0,
      region: 'capital',
      parents: { mother: 'dinastia', father: 'dinastia' },
      savings: 0,
      support: { perSeason: 0, seasons: 0 },
      movedSeason: null,
    });
    expect(birth.traits).toEqual(child.birthTraits);
    // A tela reconhece o nascimento de herdeiro pelo motor; o do fundador, mesmo filho de ex-piloto, não é.
    expect(engine.isHeirBirth(birth)).toBe(true);
    expect(engine.isHeirBirth(career.birth!)).toBe(false);
    expect(engine.isHeirBirth({ ...career.birth!, origin: 'racer-parent' })).toBe(false);
    expect(HOMETOWNS.some((h) => h.id === birth.hometownId && h.region === 'capital')).toBe(true);
    for (const key of APTITUDE_KEYS) {
      expect(birth.aptitudes[key]).toBeGreaterThanOrEqual(HERITAGE.APTITUDE_MIN);
      expect(birth.aptitudes[key]).toBeLessThanOrEqual(HERITAGE.APTITUDE_MAX);
    }
    expect(engine.heirBirth(career, option)).toEqual(birth);
    // Antecessor da capital: mesma cidade. Do interior: a primeira cidade da capital.
    const capital = { ...career, birth: { ...career.birth!, region: 'capital' as const, hometownId: 'perus' } };
    expect(engine.heirBirth(capital, option).hometownId).toBe('perus');
    const interior = { ...career, birth: { ...career.birth!, region: 'interior' as const, hometownId: 'campinas' } };
    expect(engine.heirBirth(interior, option).hometownId).toBe(HOMETOWNS.find((h) => h.region === 'capital')!.id);
    // Vale nas regras de integridade do nascimento quando o herdeiro entra na linhagem.
    const lineage = [...career.dynasty.lineage, { ...career.dynasty.lineage[0]!, generation: 2, driverId: birth.driverId }];
    const asHeir: CareerState = { ...career, birth, dynasty: { ...career.dynasty, lineage } };
    expect(validateCareerIntegrity(asHeir).filter((p) => /nascimento|Cidade|Traço/i.test(p))).toEqual([]);
  });

  it('as aptidões do herdeiro puxam metade das do antecessor, com o acaso de cada um', () => {
    const { career, option } = heirCareer();
    const strong = { ...career, birth: { ...career.birth!, aptitudes: { reflexes: 90, physique: 90, intelligence: 90, composure: 90, charisma: 90 } } };
    const means = Array.from({ length: 300 }, (_, i) => {
      const birth = engine.heirBirth(strong, option, `dyn-teste-${i}`);
      return APTITUDE_KEYS.reduce((sum, key) => sum + birth.aptitudes[key], 0) / APTITUDE_KEYS.length;
    });
    const mean = means.reduce((a, b) => a + b, 0) / means.length;
    const expected = HERITAGE.APTITUDE_PARENT_WEIGHT * 90 + (1 - HERITAGE.APTITUDE_PARENT_WEIGHT) * BIRTH.APTITUDE_MEAN;
    expect(Math.abs(mean - expected)).toBeLessThan(1.5);
    expect(new Set(means).size).toBeGreaterThan(50);
    // Sem nascimento ativo, a média é a da população.
    const none = Array.from({ length: 300 }, (_, i) => engine.heirBirth({ ...career, birth: null }, option, `dyn-teste-${i}`).aptitudes.reflexes);
    expect(Math.abs(none.reduce((a, b) => a + b, 0) / none.length - BIRTH.APTITUDE_MEAN)).toBeLessThan(1.5);
  });

  it('o parente jovem herda a carreira com traços sorteados, todos ocultos; o filho que não corre precisa do id', () => {
    const { career } = heirCareer();
    const heirs = engine.beginSuccession(career, 'death').succession!.heirs;
    const relative = heirs.find((h) => h.id === 'relative-driver')!;
    const birth = engine.heirBirth(career, relative);
    expect(birth.driverId).toBe(relative.driver!.id);
    expectValidTraits(birth.traits);
    expect(birth.traits.every((t) => t.revealedSeason === null)).toBe(true);
    // Um filho que assume os negócios sem correr: quem chama passa o id que ele vai ter.
    const { career: withAdult } = withChild(career, { id: 'kid-adulto', age: 19, stage: 'other' }, 3);
    const adultChild = engine.beginSuccession(withAdult, 'death').succession!.heirs.find((h) => h.childId === 'kid-adulto')!;
    expect(() => engine.heirBirth(withAdult, adultChild)).toThrow(/id de piloto/);
    const adultBirth = engine.heirBirth(withAdult, adultChild, 'dyn-kid-adulto-g2-s1');
    expect(adultBirth.driverId).toBe('dyn-kid-adulto-g2-s1');
    expect(adultBirth.traits).toEqual(findChild(withAdult, 'kid-adulto').birthTraits);
  });

  it('o parceiro e o parente adulto não têm nascimento de herdeiro', () => {
    const { career } = heirCareer();
    const heirs = engine.beginSuccession(career, 'death').succession!.heirs;
    const partner = heirs.find((h) => h.kind === 'partner')!;
    const adult = heirs.find((h) => h.id === 'relative-adult')!;
    expect(() => engine.heirBirth(career, partner)).toThrow(/Só o filho e o parente jovem/);
    expect(() => engine.heirBirth(career, partner, 'dyn-partner-g2-s1')).toThrow(/Só o filho e o parente jovem/);
    expect(() => engine.heirBirth(career, adult, 'dyn-relative-adult-g2-s1')).toThrow(/Só o filho e o parente jovem/);
  });
});

/* ------------------------------------------------------------------ */

describe('integridade e save', () => {
  it('traços repetidos ou opostos num filho e teste que revela o que o filho não tem são recusados', () => {
    const { career, child } = withChild(careerWithPartner(), { age: 12 });
    const patch = (p: Partial<Child>): CareerState => ({ ...career, family: { ...career.family, children: [{ ...child, ...p }] } });
    expect(validateCareerIntegrity(patch({ birthTraits: hidden('rainMaster', 'rainFear', 'hothead') })).join()).toMatch(/opostos/);
    expect(validateCareerIntegrity(patch({ birthTraits: hidden('rainMaster', 'rainMaster', 'hothead') })).join()).toMatch(/repetido/);
    const notOwned = (['rainMaster', 'rainFear'] as const).find((id) => !child.birthTraits.some((t) => t.id === id))!;
    expect(validateCareerIntegrity(patch({ kartTest: { season: 1, depth: 'quick', gap: 0.3, revealed: [notOwned] } })).join()).toMatch(/fora dos traços/);
  });

  it('o resultado do teste sobrevive ao save', () => {
    const { career, child } = withChild(careerWithPartner(), { age: 12 });
    const tested = applyEffects(career, [{ type: 'kartTest', childId: child.id, depth: 'full' }], 0);
    expectValid(tested);
    expect(findChild(importCareer(exportCareer(tested, NOW)), child.id)).toEqual(findChild(tested, child.id));
  });
});
