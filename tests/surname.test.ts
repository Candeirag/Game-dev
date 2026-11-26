/**
 * Dinastia (Fase 6, etapa D): o peso do sobrenome (contatos, pressão e imprensa), a equipe da
 * família (propostas e favorecimento, como piloto e como dirigente), os parentes contratáveis, os
 * maus investimentos e os cartões novos (geração, sobrenome, equipe da família e filhos que nascem
 * pela vida pessoal). Com peso zero (a primeira geração), nada disso muda a carreira.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAD_INVESTMENT, FAMILY_TEAM, RELATIVES, SURNAME } from '@/config/balance';
import type { CareerState, Child, LineageEntry, Relative, RoundRecord, TeamStake } from '@/domain/schemas';
import { categoryRef } from '@/domain/categoryNames';
import { FAMILY } from '@/data/family';
import { FAMILY_EVENT_TEXTS } from '@/data/familyTexts';
import { importCareer } from '@/persistence/saveService';
import { markSeen } from '@/engine/story/memory';
import * as engine from './engineApi';
import { newCareer, playExecutiveRound, playRound, playSeason, resolvePending } from './helpers';

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

const PREDECESSOR = 'Rita Antiga';

/** A mesma carreira como se fosse da segunda geração: um antecessor na linhagem com a reputação máxima dada. */
function asHeir(c: CareerState, peak: number, patch: Partial<LineageEntry> = {}): CareerState {
  const current = c.dynasty.lineage[c.dynasty.lineage.length - 1]!;
  const before: LineageEntry = {
    ...current,
    generation: 1,
    driverId: 'antecessor',
    name: PREDECESSOR,
    bornYear: c.year - 50,
    fromSeason: 1,
    toSeason: Math.max(0, c.season - 1),
    endReason: 'handover',
    peakReputation: peak,
    traits: [],
    partnerName: null,
    path: null,
    ...patch,
  };
  return { ...c, dynasty: { ...c.dynasty, generation: 2, lineage: [before, { ...current, generation: 2 }] } };
}

function relative(c: CareerState, id: string, path: Relative['path'], age: number, skill = 70): Relative {
  return {
    id,
    firstName: 'Caio',
    lastName: id,
    generation: 1,
    bornYear: engine.familyYear(c) - age,
    path,
    skill,
    traits: ['calm'],
    bond: 60,
    racedTo: null,
    sinceSeason: 1,
  };
}
const withRelatives = (c: CareerState, relatives: Relative[]): CareerState => ({ ...c, dynasty: { ...c.dynasty, relatives } });

function stake(c: CareerState, teamId: string, share: number, categoryId = c.categoryId): TeamStake {
  return { id: `stake-${teamId}`, teamId, teamName: teamId, categoryId, share, cost: 0, value: 100_000, lastPosition: 5, lastDividend: 0 };
}
const withStake = (c: CareerState, s: TeamStake): CareerState => ({ ...c, finance: { ...c.finance, stakes: [...c.finance.stakes, s] } });
const withCash = (c: CareerState, cash: number): CareerState => ({ ...c, finance: { ...c.finance, cash } });

/** A etapa com o resultado de um piloto trocado (posição e, se dado, o abandono). */
function withResult(record: RoundRecord, driverId: string, position: number, status: 'finished' | 'dnf' = 'finished'): RoundRecord {
  const entries = record.race.entries.map((e) => {
    if (e.driverId !== driverId) return e;
    const { dnfReason: _reason, ...rest } = e;
    return status === 'dnf' ? { ...rest, position, status, dnfReason: 'crash' as const } : { ...rest, position, status };
  });
  return { ...record, race: { ...record.race, entries } };
}
const atRound = (record: RoundRecord, round: number): RoundRecord => ({ ...record, round });

function careerWithPartner(seed: number, age = 28): CareerState {
  const created = newCareer(seed);
  const c = { ...created, drivers: created.drivers.map((d) => (d.isPlayer ? { ...d, age } : d)) };
  const partner = { ...engine.generatePartner(seed, age, 1), relationship: 80, married: true };
  return { ...c, family: { ...c.family, partner: { ...partner, age: Math.min(partner.age, FAMILY.PARTNER_MAX_CHILD_AGE) } } };
}

/** Uma carreira com uma etapa jogada (para as etapas e o companheiro). */
let playedCache: CareerState | null = null;
function played(): CareerState {
  playedCache ??= playRound(newCareer(11));
  return playedCache;
}

/** O dirigente no meio da temporada (save gravado da versão atual), com equipe. */
let executiveCache: CareerState | null = null;
function executive(): CareerState {
  executiveCache ??= importCareer(readFileSync('tests/fixtures/v10/dirigente-no-meio-da-temporada.json', 'utf8'));
  return executiveCache;
}

/** Marca um dos pilotos da equipe do dirigente como filho dele (sem traços de nascença: o treino não muda). */
function withChildInTeam(c: CareerState, driverId: string, id = 'kid-team'): CareerState {
  const driver = c.drivers.find((d) => d.id === driverId)!;
  const child: Child = {
    ...engine.generateChild(c, 5),
    id,
    age: driver.age,
    stage: 'racing',
    driver: { ...driver },
    racing: { categoryId: c.categoryId, teamName: 'Equipe', teamRank: 5, reputation: 20, license: [], academy: null, seasons: [], stalled: 0, familyCost: 0 },
    birthTraits: [],
  };
  return { ...c, family: { ...c.family, children: [...c.family.children, child] } };
}

const lineupOf = (c: CareerState) => c.drivers.filter((d) => d.teamId === c.management?.teamId && d.role !== 'reserve');

/* ------------------------------------------------------------------ */

describe('o peso do sobrenome', () => {
  it('zero na primeira geração; depois, a fama do antecessor mais famoso, de FAME_FLOOR a 100', () => {
    const c = newCareer(5);
    expect(engine.surnameWeight(c)).toBe(0);
    expect(engine.predecessor(c)).toBeNull();
    expect(engine.surnameWeight(asHeir(c, SURNAME.FAME_FLOOR))).toBe(0);
    expect(engine.surnameWeight(asHeir(c, SURNAME.FAME_FLOOR - 10))).toBe(0);
    expect(engine.surnameWeight(asHeir(c, 100))).toBe(1);
    expect(engine.surnameWeight(asHeir(c, 65))).toBeCloseTo((65 - SURNAME.FAME_FLOOR) / (100 - SURNAME.FAME_FLOOR), 10);
    expect(engine.predecessor(asHeir(c, 65))?.name).toBe(PREDECESSOR);
    // Três gerações: vale o mais famoso dos antecessores; a fama do personagem atual não conta.
    const heir = asHeir(c, 40);
    const [first, second] = heir.dynasty.lineage;
    const third: CareerState = {
      ...heir,
      dynasty: {
        ...heir.dynasty,
        generation: 3,
        lineage: [
          { ...first!, peakReputation: 80 },
          { ...second!, generation: 2, peakReputation: 40 },
          { ...second!, generation: 3, peakReputation: 100 },
        ],
      },
    };
    expect(engine.surnameWeight(third)).toBeCloseTo((80 - SURNAME.FAME_FLOOR) / (100 - SURNAME.FAME_FLOOR), 10);
  });

  it('contatos: o sobrenome e os parentes nos boxes somam interesse das equipes', () => {
    const c = played();
    const category = engine.getCategory(c.categoryId);
    const ranked = engine.rankTeams(c.teams);
    const rank = ranked.findIndex((t) => t.id !== engine.getPlayer(c).teamId);
    const team = ranked[rank]!;
    const interest = (career: CareerState) => engine.targetInterest(career, category, team, rank);
    const base = interest(c);
    expect(base).toBeLessThan(100 - SURNAME.CONTACTS_INTEREST - RELATIVES.CONTACT_INTEREST_MAX);
    expect(engine.familyContactsInterest(c)).toBe(0);
    expect(interest(asHeir(c, 100))).toBeCloseTo(base + SURNAME.CONTACTS_INTEREST, 6);
    expect(interest(asHeir(c, 65))).toBeCloseTo(base + 0.5 * SURNAME.CONTACTS_INTEREST, 6);
    // Parentes na engenharia e na direção esportiva, em idade de trabalho, até o teto.
    const quiet = asHeir(c, SURNAME.FAME_FLOOR);
    expect(interest(withRelatives(quiet, [relative(c, 'r1', 'engineer', 30)]))).toBeCloseTo(base + RELATIVES.CONTACT_INTEREST, 6);
    const crowd = [relative(c, 'r1', 'engineer', 30), relative(c, 'r2', 'sportingDirector', 40), relative(c, 'r3', 'engineer', 50)];
    expect(interest(withRelatives(quiet, crowd))).toBeCloseTo(base + RELATIVES.CONTACT_INTEREST_MAX, 6);
    // Negócios, jovem demais ou velho demais: nada.
    const none = [
      relative(c, 'r4', 'business', 30),
      relative(c, 'r5', 'engineer', RELATIVES.WORK_FROM_AGE - 1),
      relative(c, 'r6', 'sportingDirector', RELATIVES.WORK_UNTIL_AGE + 1),
    ];
    expect(interest(withRelatives(quiet, none))).toBe(base);
  });

  it('o que o antecessor fazia na mesma idade sai das temporadas arquivadas dele', () => {
    const closed = resolvePending(playSeason(newCareer(9)));
    const summary = engine.archiveSeason(closed);
    const row = summary.driverStandings.find((d) => d.driverId === 'player')!;
    const entry: LineageEntry = { ...closed.dynasty.lineage[0]!, driverId: 'player', bornYear: summary.year - 15, fromSeason: 1, toSeason: 9 };
    const second = { ...summary, season: 3, year: summary.year + 2 };
    const c: CareerState = { ...closed, history: [summary, second] };
    expect(engine.predecessorAtAge(c, entry, 15)).toBe(
      `corria ${categoryRef(summary.categoryId, 'em')} e terminou o ano em ${row.position}º${row.position === 1 ? ', com o título' : ''}`,
    );
    expect(engine.predecessorAtAge(c, entry, 14)).toBe('ainda nem tinha estreado nas pistas');
    expect(engine.predecessorAtAge(c, entry, 16)).toBe('estava longe das pistas naquele ano');
    expect(engine.predecessorAtAge(c, entry, 18)).toBe('já tinha parado de correr');
    expect(engine.predecessorAtAge(c, { ...entry, driverId: 'outro' }, 15)).toBe('nunca tinha corrido, e mesmo assim o nome já abria portas');
    // Fora do período dele na linhagem, a temporada não conta.
    expect(engine.predecessorAtAge(c, { ...entry, fromSeason: 5 }, 15)).toBe('nunca tinha corrido, e mesmo assim o nome já abria portas');
    const champion = { ...summary, driverStandings: summary.driverStandings.map((d) => (d.driverId === 'player' ? { ...d, position: 1 } : d)) };
    expect(engine.predecessorAtAge({ ...closed, history: [champion] }, entry, 15)).toMatch(/terminou o ano em 1º, com o título$/);
  });
});

describe('pressão do sobrenome', () => {
  it('por etapa: fora dos primeiros ou abandono custa moral pelo peso; dentro, nada', () => {
    const c = played();
    const id = engine.getPlayer(c).id;
    const record = c.rounds[0]!;
    const heir = asHeir(c, 100);
    expect(engine.pressureRound(heir, withResult(record, id, SURNAME.ROUND_TOP)).morale).toBe(0);
    expect(engine.pressureRound(heir, withResult(record, id, SURNAME.ROUND_TOP + 1)).morale).toBe(-SURNAME.ROUND_MORALE);
    expect(engine.pressureRound(heir, withResult(record, id, 3, 'dnf')).morale).toBe(-SURNAME.ROUND_MORALE);
    expect(engine.pressureRound(asHeir(c, 65), withResult(record, id, 15)).morale).toBeCloseTo(-0.5 * SURNAME.ROUND_MORALE, 10);
    // Fora da etapa (sem resultado), nada; e a primeira geração nunca sente.
    const absent = { ...record, race: { ...record.race, entries: record.race.entries.filter((e) => e.driverId !== id) } };
    expect(engine.pressureRound(heir, absent)).toEqual({ morale: 0, messages: [] });
    for (let r = 1; r <= 40; r++) expect(engine.pressureRound(c, atRound(withResult(record, id, 15), r))).toEqual({ morale: 0, messages: [] });
  });

  it('a imprensa compara com o antecessor com a chance PRESS_CHANCE, citando o que ele fazia na mesma idade', () => {
    const c = played();
    const id = engine.getPlayer(c).id;
    const heir = asHeir(c, 100);
    const record = withResult(c.rounds[0]!, id, 15);
    let count = 0;
    for (let r = 1; r <= 800; r++) {
      const out = engine.pressureRound(heir, atRound(record, r));
      if (out.messages.length === 0) continue;
      count += 1;
      expect(out.messages).toHaveLength(1);
      const message = out.messages[0]!;
      expect(message).toMatchObject({ id: `s${c.season}-r${r}-surname-press`, category: 'media' });
      expect(message.body).toContain(PREDECESSOR);
      expect(message.body).toContain('nunca tinha corrido');
    }
    expect(count / 800).toBeGreaterThan(SURNAME.PRESS_CHANCE - 0.05);
    expect(count / 800).toBeLessThan(SURNAME.PRESS_CHANCE + 0.05);
    expect(engine.pressureRound(heir, atRound(record, 7))).toEqual(engine.pressureRound(heir, atRound(record, 7)));
  });

  it('na etapa de verdade, a moral do herdeiro cai pelo peso (a mesma corrida, só a linhagem muda)', () => {
    const pre = newCareer(13);
    const a = playRound(pre);
    const b = playRound(asHeir(pre, 100));
    const entry = a.rounds[0]!.race.entries.find((e) => e.driverId === a.playerDriverId)!;
    expect(b.rounds[0]!.race.entries).toEqual(a.rounds[0]!.race.entries);
    const bad = entry.status !== 'finished' || entry.position > SURNAME.ROUND_TOP;
    const expected = Math.max(0, engine.getPlayer(a).condition.morale - (bad ? SURNAME.ROUND_MORALE : 0));
    expect(engine.getPlayer(b).condition.morale).toBeCloseTo(expected, 1);
    // A mesma etapa em primeira geração não tem mensagem da imprensa comparando.
    expect(a.inbox.some((m) => m.id.endsWith('surname-press'))).toBe(false);
  });

  it('no fechamento: a queda de reputação pesa mais e a metade de trás custa reputação', () => {
    const closed = resolvePending(playSeason(newCareer(15)));
    const standings = engine.computeDriverStandings(closed.rounds, closed.drivers, closed.adjustments);
    const me = standings.find((s) => s.driverId === closed.playerDriverId)!;
    const field = closed.drivers.filter((d) => d.teamId !== null && d.role !== 'reserve').length;
    const backHalf = me.position > field / 2 ? SURNAME.BACK_HALF_REPUTATION : 0;
    const heir = { ...asHeir(closed, 100), reputation: 40 };
    const dropped = engine.pressureSeason(heir, standings, 30);
    expect(dropped.reputation).toBe(-Math.round(10 * SURNAME.BAD_RESULT_WEIGHT + backHalf));
    expect(dropped.notes).toHaveLength(1);
    expect(dropped.notes[0]).toContain(PREDECESSOR);
    expect(engine.pressureSeason(heir, standings, 50).reputation).toBe(-Math.round(backHalf));
    // Na primeira geração, nada.
    expect(engine.pressureSeason({ ...closed, reputation: 40 }, standings, 30)).toEqual({ reputation: 0, notes: [] });
  });

  it('o fechamento da temporada de piloto aplica a pressão (o mesmo ano, só a linhagem muda)', () => {
    const closed = resolvePending(playSeason(newCareer(15)));
    const open: CareerState = { ...closed, offseason: null, reputation: 40 };
    const a = engine.closeSeason(open);
    const heir = asHeir(open, 100);
    const b = engine.closeSeason(heir);
    const standings = engine.computeDriverStandings(open.rounds, open.drivers, open.adjustments);
    const after = a.offseason!.reputationAfter;
    const pressure = engine.pressureSeason(heir, standings, after);
    expect(b.offseason!.reputationAfter).toBe(Math.max(0, after + pressure.reputation));
    for (const note of pressure.notes) expect(b.offseason!.notes).toContain(note);
    expect(a.offseason!.notes.some((n) => n.includes(PREDECESSOR))).toBe(false);
  });
});

describe('equipe da família: favorecimento do herdeiro piloto', () => {
  it('a equipe da família é a de 100%; uma participação minoritária não conta', () => {
    const c = played();
    const team = engine.getPlayer(c).teamId!;
    expect(engine.racesForFamilyTeam(c)).toBe(false);
    expect(engine.racesForFamilyTeam(withStake(c, stake(c, team, 1)))).toBe(true);
    expect(engine.racesForFamilyTeam(withStake(c, stake(c, team, 0.49)))).toBe(false);
    const other = c.teams.find((t) => t.id !== team)!.id;
    expect(engine.racesForFamilyTeam(withStake(c, stake(c, other, 1)))).toBe(false);
    expect(engine.racesForFamilyTeam(withStake(c, stake(c, team, 1, 'f4')))).toBe(false);
  });

  it('por etapa: atrás do companheiro custa moral, e a imprensa fala em favorecimento com a chance PRESS_CHANCE', () => {
    const c = played();
    const me = engine.getPlayer(c);
    const mate = engine.getTeammate(c)!;
    const family = withStake(c, stake(c, me.teamId!, 1));
    const behind = withResult(withResult(c.rounds[0]!, me.id, 8), mate.id, 3);
    const ahead = withResult(withResult(c.rounds[0]!, me.id, 3), mate.id, 8);
    expect(engine.pressureRound(family, behind).morale).toBe(-FAMILY_TEAM.ROUND_MORALE);
    expect(engine.pressureRound(family, ahead).morale).toBe(0);
    expect(engine.pressureRound(family, withResult(behind, mate.id, 3, 'dnf')).morale).toBe(0);
    expect(engine.pressureRound(family, withResult(ahead, me.id, 2, 'dnf')).morale).toBe(-FAMILY_TEAM.ROUND_MORALE);
    expect(engine.pressureRound(c, behind)).toEqual({ morale: 0, messages: [] });
    let count = 0;
    for (let r = 1; r <= 800; r++) {
      const out = engine.pressureRound(family, atRound(behind, r));
      const press = out.messages.filter((m) => m.id === `s${c.season}-r${r}-favoritism-press`);
      if (press.length === 0) continue;
      count += 1;
      expect(press[0]!.body).toContain(engine.fullName(mate));
    }
    expect(count / 800).toBeGreaterThan(FAMILY_TEAM.PRESS_CHANCE - 0.05);
    expect(count / 800).toBeLessThan(FAMILY_TEAM.PRESS_CHANCE + 0.05);
  });

  it('no fechamento: atrás do companheiro custa reputação, à frente rende', () => {
    const c = played();
    const me = engine.getPlayer(c);
    const mate = engine.getTeammate(c)!;
    const family = withStake(c, stake(c, me.teamId!, 1));
    const standings = engine.computeDriverStandings(c.rounds, c.drivers, c.adjustments);
    const place = (myPos: number, matePos: number) =>
      standings.map((s) => (s.driverId === me.id ? { ...s, position: myPos } : s.driverId === mate.id ? { ...s, position: matePos } : s));
    expect(engine.pressureSeason(family, place(6, 2), c.reputation)).toMatchObject({ reputation: -FAMILY_TEAM.SEASON_REPUTATION });
    expect(engine.pressureSeason(family, place(2, 6), c.reputation)).toMatchObject({ reputation: FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION });
    expect(engine.pressureSeason(c, place(6, 2), c.reputation)).toEqual({ reputation: 0, notes: [] });
  });
});

describe('equipe da família: propostas', () => {
  const closed = () => resolvePending(playSeason(newCareer(19)));

  it('a equipe da família de uma categoria ao alcance sempre propõe, com interesse máximo e a vaga de SEAT_SHARE', () => {
    const c = closed();
    const above = engine.reachableCategories(c).sort((a, b) => b.tier - a.tier)[0]!;
    const ranked = engine.rankTeams(engine.teamsOfCategory(c, above.id));
    const team = ranked[0]!;
    const family = withStake(c, stake(c, team.id, 1, above.id));
    const offers = engine.generateOffers(family, c.reputation, 'expired');
    const own = offers.filter((o) => o.teamId === team.id && o.categoryId === above.id);
    expect(own).toHaveLength(1);
    const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
    expect(own[0]).toMatchObject({
      interest: 100,
      seatCost: Math.round((lerp(above.economy.seatCost, 0) * FAMILY_TEAM.SEAT_SHARE) / 500) * 500,
      firstDriverPossible: true,
      clauses: { performanceTarget: null },
    });
    expect(engine.isFamilyTeamOffer(family, own[0]!)).toBe(true);
    expect(offers.filter((o) => o.id !== own[0]!.id).every((o) => !engine.isFamilyTeamOffer(family, o))).toBe(true);
    // Sem a participação de 100% (ou com uma minoritária), as propostas são as de sempre.
    const baseline = engine.generateOffers(c, c.reputation, 'expired');
    expect(engine.generateOffers(withStake(c, stake(c, team.id, 0.49, above.id)), c.reputation, 'expired')).toEqual(baseline);
  });

  it('a equipe atual da família: com contrato em vigor, só cumpri-lo; vencido, a renovação de família', () => {
    const c = closed();
    const me = engine.getPlayer(c);
    const family = withStake(c, stake(c, me.teamId!, 1));
    const active = engine.generateOffers(family, c.reputation, 'active').filter((o) => o.teamId === me.teamId && o.categoryId === c.categoryId);
    expect(active.map((o) => o.kind)).toEqual(['continue']);
    const expired = engine.generateOffers(family, c.reputation, 'expired').filter((o) => o.teamId === me.teamId && o.categoryId === c.categoryId);
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ kind: 'renewal', interest: 100, clauses: { performanceTarget: null } });
    // Mesmo rescindido por desempenho, a família renova.
    const terminated = engine.generateOffers(family, c.reputation, 'terminated').filter((o) => o.teamId === me.teamId);
    expect(terminated.map((o) => o.kind)).toEqual(['renewal']);
  });
});

describe('equipe da família: o dirigente que põe um filho na própria equipe', () => {
  it('por etapa: o filho atrás do companheiro custa reputação à equipe, e a imprensa pode falar', () => {
    const c = executive();
    const [kid, mate] = lineupOf(c);
    const family = withChildInTeam(c, kid!.id);
    const behind = withResult(withResult(c.rounds[2]!, kid!.id, 9), mate!.id, 4);
    const ahead = withResult(withResult(c.rounds[2]!, kid!.id, 4), mate!.id, 9);
    expect(engine.favoritismExecutiveRound(family, behind).teamReputation).toBeCloseTo(-FAMILY_TEAM.ROUND_TEAM_REPUTATION, 10);
    expect(engine.favoritismExecutiveRound(family, ahead)).toEqual({ teamReputation: 0, messages: [] });
    expect(engine.favoritismExecutiveRound(c, behind)).toEqual({ teamReputation: 0, messages: [] });
    // Dois filhos na mesma equipe: ninguém é favorecido em relação ao outro.
    expect(engine.favoritismExecutiveRound(withChildInTeam(family, mate!.id, 'kid-two'), behind).teamReputation).toBe(0);
    // Na etapa de verdade, a diferença é só essa.
    const base = engine.applyExecutiveRoundEffects(c, behind, {});
    const withKid = engine.applyExecutiveRoundEffects(family, behind, {});
    expect(withKid.management!.reputation).toBeCloseTo(base.management!.reputation - FAMILY_TEAM.ROUND_TEAM_REPUTATION, 10);
    let count = 0;
    for (let r = 1; r <= 600; r++) if (engine.favoritismExecutiveRound(family, atRound(behind, r)).messages.length > 0) count += 1;
    expect(count / 600).toBeGreaterThan(FAMILY_TEAM.PRESS_CHANCE - 0.06);
    expect(count / 600).toBeLessThan(FAMILY_TEAM.PRESS_CHANCE + 0.06);
  });

  it('no fechamento: atrás do companheiro custa reputação à equipe e ao personagem; à frente rende', () => {
    const c = executive();
    const [kid, mate] = lineupOf(c);
    const family = withChildInTeam(c, kid!.id);
    const standings = engine.computeDriverStandings(c.rounds, c.drivers, c.adjustments);
    const place = (kidPos: number, matePos: number) =>
      standings.map((s) => (s.driverId === kid!.id ? { ...s, position: kidPos } : s.driverId === mate!.id ? { ...s, position: matePos } : s));
    const behind = engine.favoritismExecutiveSeason(family, place(7, 3));
    expect(behind).toMatchObject({ team: -FAMILY_TEAM.SEASON_TEAM_REPUTATION, personal: -FAMILY_TEAM.SEASON_REPUTATION });
    expect(behind.notes).toHaveLength(1);
    expect(engine.favoritismExecutiveSeason(family, place(3, 7))).toMatchObject({ team: 0, personal: FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION });
    expect(engine.favoritismExecutiveSeason(c, place(7, 3))).toEqual({ team: 0, personal: 0, notes: [] });
  });

  it('o fechamento do dirigente aplica o favorecimento (o mesmo ano, só o filho muda)', () => {
    let played = executive();
    while (played.nextRoundIndex < played.calendar.length) played = playExecutiveRound(played);
    const open: CareerState = { ...played, executiveOffseason: null, succession: null };
    const [kid] = lineupOf(open);
    const a = engine.closeExecutiveSeason(open);
    const family = withChildInTeam(open, kid!.id);
    const b = engine.closeExecutiveSeason(family);
    const standings = engine.computeDriverStandings(open.rounds, open.drivers, open.adjustments);
    const fav = engine.favoritismExecutiveSeason(family, standings);
    expect(b.management!.reputation).toBe(Math.min(100, Math.max(0, a.management!.reputation + fav.team)));
    expect(b.reputation).toBe(Math.min(100, Math.max(0, a.reputation + fav.personal)));
    expect(b.inbox.find((m) => m.id === `s${open.season}-end`)!.body).toContain(fav.notes[0]!);
  });

  it('o aviso de favorecimento do candidato filho', () => {
    const c = executive();
    const note = engine.favoritismNote(c, { origin: 'child', name: 'Beto Teste' });
    expect(note).toContain('Beto Teste');
    expect(note).toContain('favorecimento');
    expect(engine.favoritismNote(c, { origin: 'market', name: 'Beto Teste' })).toBeNull();
    expect(engine.favoritismNote(played(), { origin: 'child', name: 'Beto Teste' })).toBeNull();
  });
});

describe('parentes contratáveis', () => {
  it('um por parente em idade de trabalho e por função do caminho dele, com o desconto de família', () => {
    const c = executive();
    const m = c.management!;
    const season = c.season;
    const relatives = [
      relative(c, 'child-g1-s3-0', 'engineer', 30, 72),
      relative(c, 'sd', 'sportingDirector', 40, 66),
      relative(c, 'biz', 'business', 35),
      relative(c, 'young', 'engineer', RELATIVES.WORK_FROM_AGE - 1),
      relative(c, 'old', 'sportingDirector', RELATIVES.WORK_UNTIL_AGE + 1),
    ];
    const staff = engine.familyStaff(withRelatives(c, relatives), m.categoryId, [], season);
    expect(staff.map((s) => s.id)).toEqual([
      'staff-family-child-g1-s3-0-chiefEngineer',
      'staff-family-child-g1-s3-0-technicalDirector',
      'staff-family-sd-sportingDirector',
    ]);
    for (const s of staff) {
      const r = relatives.find((x) => x.id === engine.familyStaffRelativeId(s))!;
      expect(engine.isFamilyStaff(s)).toBe(true);
      expect(s).toMatchObject({
        name: `${r.firstName} ${r.lastName}`,
        rating: r.skill,
        salary: Math.round((engine.staffSalary(m.categoryId, r.skill, s.role) * RELATIVES.STAFF_SALARY_SHARE) / 100) * 100,
        contractEnd: season + RELATIVES.STAFF_CONTRACT_SEASONS - 1,
      });
    }
    expect(engine.isFamilyStaff(m.staff[0]!)).toBe(false);
    expect(engine.familyStaffRelativeId(m.staff[0]!)).toBeNull();
    // Quem já está contratado não volta ao mercado (nas duas funções).
    const hired = engine.familyStaff(withRelatives(c, relatives), m.categoryId, [{ id: 'staff-family-child-g1-s3-0-chiefEngineer' }], season);
    expect(hired.map((s) => s.id)).toEqual(['staff-family-sd-sportingDirector']);
    // Na primeira geração, sem parentes, ninguém.
    expect(engine.familyStaff(c, m.categoryId, [], season)).toEqual([]);
  });

  it('entram no fim do mercado da equipe nova e saem dele ao serem contratados', () => {
    const c = executive();
    const m = c.management!;
    const relatives = [relative(c, 'eng', 'engineer', 30, 72)];
    const team = engine.rankTeams(c.teams).find((t) => t.id !== m.teamId)!.id;
    const options = { position: 'owner' as const, salary: 0, purchasePrice: 0 };
    const plain = engine.createManagedTeam({ ...c, management: null }, team, options);
    const managed = engine.createManagedTeam(withRelatives({ ...c, management: null }, relatives), team, options);
    const family = engine.familyStaff(withRelatives(c, relatives), c.categoryId, [], c.season);
    expect(managed.staffMarket).toEqual([...plain.staffMarket, ...family]);
    const career = withRelatives({ ...c, management: managed }, relatives);
    const after = engine.hireStaff(career, 'staff-family-eng-chiefEngineer');
    expect(after.management!.staff.some((s) => s.id === 'staff-family-eng-chiefEngineer')).toBe(true);
    expect(after.management!.staffMarket.some(engine.isFamilyStaff)).toBe(false);
  });

  it('na virada do ano, o parente renova com o desconto e não sai; o mercado novo traz os outros parentes', () => {
    let c = executive();
    while (c.nextRoundIndex < c.calendar.length) c = playExecutiveRound(c);
    c = resolvePending(c);
    const relatives = [relative(c, 'eng', 'engineer', 30, 72), relative(c, 'sd', 'sportingDirector', 45, 64)];
    const m = c.management!;
    const member = { id: 'staff-family-eng-chiefEngineer', name: 'Caio eng', role: 'chiefEngineer' as const, rating: 72, salary: 1000, contractEnd: c.season };
    const open: CareerState = withRelatives(
      { ...c, executiveOffseason: null, succession: null, management: { ...m, staff: [...m.staff.filter((s) => s.role !== 'chiefEngineer'), member] } },
      relatives,
    );
    const closed = engine.closeExecutiveSeason(open);
    const renewed = closed.management!.staff.find((s) => s.id === member.id)!;
    expect(renewed.contractEnd).toBe(c.season + RELATIVES.STAFF_CONTRACT_SEASONS);
    expect(renewed.salary).toBe(Math.round((engine.staffSalary(m.categoryId, renewed.rating, 'chiefEngineer') * RELATIVES.STAFF_SALARY_SHARE) / 100) * 100);
    expect(closed.succession).toBeNull();
    const next = engine.startExecutiveSeason(resolvePending(closed), { kind: 'continue' });
    const market = next.management!.staffMarket;
    expect(market.filter(engine.isFamilyStaff).map((s) => s.id)).toEqual(['staff-family-sd-sportingDirector']);
    const regular = engine.buildStaffMarket(c.seed, next.season, m.categoryId, closed.management!.reputation);
    expect(market.filter((s) => !engine.isFamilyStaff(s))).toEqual(regular);
  });
});

describe('maus investimentos', () => {
  const rich = (c: CareerState) => withCash(c, 5_000_000);
  const at = (c: CareerState, season: number): CareerState => ({ ...c, season });

  it('nunca na primeira geração; da segunda em diante, com patrimônio, na chance CHANCE', () => {
    const c = rich(newCareer(21));
    for (let s = 1; s <= 200; s++) {
      expect(engine.badInvestmentStake(at(c, s))).toBe(0);
      expect(engine.familySeasonEvents(at(c, s)).some((e) => e.definitionId === 'family-bad-investment')).toBe(false);
    }
    const heir = asHeir(c, 60);
    const liquid = heir.finance.cash + heir.finance.fixedIncome + heir.finance.equityFund;
    let count = 0;
    for (let s = 1; s <= 600; s++) {
      const stake = engine.badInvestmentStake(at(heir, s));
      if (stake === 0) continue;
      count += 1;
      expect(stake).toBe(Math.round((liquid * BAD_INVESTMENT.STAKE_SHARE) / 100) * 100);
    }
    expect(count / 600).toBeGreaterThan(BAD_INVESTMENT.CHANCE - 0.05);
    expect(count / 600).toBeLessThan(BAD_INVESTMENT.CHANCE + 0.05);
    // Sem patrimônio, nada.
    const poor = withCash(asHeir(newCareer(21), 60), 1000);
    for (let s = 1; s <= 100; s++) expect(engine.badInvestmentStake(at(poor, s))).toBe(0);
  });

  it('o evento: entrar (perde na maioria das vezes, ganha às vezes) ou recusar; texto novo a cada vez', () => {
    const heir = asHeir(rich(newCareer(21)), 60);
    const season = Array.from({ length: 50 }, (_, i) => i + 1).find((s) => engine.badInvestmentStake(at(heir, s)) > 0)!;
    const c = at(heir, season);
    const stake = engine.badInvestmentStake(c);
    const event = engine.familySeasonEvents(c).find((e) => e.definitionId === 'family-bad-investment')!;
    expect(event.storyKey).toBe('family-badInvestment#0');
    expect(event.choices.map((x) => x.id)).toEqual(['invest', 'refuse']);
    const [lost, won] = event.choices[0]!.outcomes;
    const loss = Math.round((stake * BAD_INVESTMENT.LOSS_SHARE) / 100) * 100;
    const gain = Math.round((stake * BAD_INVESTMENT.GAIN_SHARE) / 100) * 100;
    expect(lost).toMatchObject({ probability: BAD_INVESTMENT.LOSS_CHANCE, effects: [{ type: 'cash', value: -loss, ledger: 'investment', capToCash: true }] });
    expect(won).toMatchObject({ probability: 1 - BAD_INVESTMENT.LOSS_CHANCE, effects: [{ type: 'cash', value: gain, ledger: 'investment' }] });
    expect(event.choices[1]!.outcomes).toMatchObject([{ probability: 1, effects: [] }]);
    // Resolver mexe no caixa pelo lançamento dos investimentos.
    const resolved = engine.resolveEvent({ ...c, pendingEvents: [event] }, event.id, 'invest').career;
    expect([c.finance.cash - loss, c.finance.cash + gain]).toContain(resolved.finance.cash);
    // A variante seguinte na próxima vez; acabadas as variantes, o evento não volta.
    const seen = markSeen(c, ['family-badInvestment#0'], 0);
    expect(engine.familySeasonEvents(seen).find((e) => e.definitionId === 'family-bad-investment')?.storyKey).toBe('family-badInvestment#1');
    const all = markSeen(
      c,
      FAMILY_EVENT_TEXTS.badInvestment.map((_, i) => `family-badInvestment#${i}`),
      0,
    );
    expect(engine.familySeasonEvents(all).some((e) => e.definitionId === 'family-bad-investment')).toBe(false);
  });

  it('pelo menos seis variantes, sem texto repetido no catálogo da família', () => {
    expect(FAMILY_EVENT_TEXTS.badInvestment.length).toBeGreaterThanOrEqual(6);
    const params = { stake: 'R$ 1', loss: 'R$ 2', gain: 'R$ 3' };
    const texts = FAMILY_EVENT_TEXTS.badInvestment.flatMap((f) => {
      const t = f(params);
      return [t.title, t.body, t.invest.label, t.invest.description, t.invest.lost, t.invest.won, t.refuse.label, t.refuse.description, t.refuse.text];
    });
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
  });
});

describe('cartões da dinastia', () => {
  it('condições: geração, sobrenome famoso e equipe da família', () => {
    const c = played();
    // Os cartões que presumem pais pobres ficam na primeira geração.
    expect(engine.storyCardFor(c, null, 1, 'bicho-de-estimacao')).not.toBeNull();
    expect(engine.storyCardFor(asHeir(c, 100), null, 1, 'bicho-de-estimacao')).toBeNull();
    // O sobrenome só pesa com um antecessor famoso.
    expect(engine.storyCardFor(c, null, 1, 'sobrenome-abre-portas')).toBeNull();
    expect(engine.storyCardFor(asHeir(c, SURNAME.FAME_FLOOR), null, 1, 'sobrenome-abre-portas')).toBeNull();
    const card = engine.storyCardFor(asHeir(c, 100), null, 1, 'sobrenome-abre-portas', 0)!;
    expect(card.body).toContain(PREDECESSOR);
    expect(card.body).toContain(c.dynasty.surname);
    // A equipe da família.
    expect(engine.storyCardFor(c, null, 1, 'box-dividido-na-equipe-da-familia')).toBeNull();
    const family = withStake(c, stake(c, engine.getPlayer(c).teamId!, 1));
    expect(engine.storyCardFor(family, null, 1, 'box-dividido-na-equipe-da-familia')).not.toBeNull();
  });

  it('espaço para mais um filho: parceiro, idades, máximo, nenhum bebê do ano nem esperando resposta', () => {
    const c = careerWithPartner(23);
    expect(engine.roomForChild(c)).toBe(true);
    expect(engine.roomForChild({ ...c, family: { ...c.family, partner: null } })).toBe(false);
    const partner = c.family.partner!;
    expect(engine.roomForChild({ ...c, family: { ...c.family, partner: { ...partner, age: FAMILY.PARTNER_MAX_CHILD_AGE + 1 } } })).toBe(false);
    const old = { ...c, drivers: c.drivers.map((d) => (d.isPlayer ? { ...d, age: FAMILY.CHILD_MAX_PARENT_AGE + 1 } : d)) };
    expect(engine.roomForChild(old)).toBe(false);
    const kid = (age: number, i: number): Child => ({ ...engine.generateChild(c, 50 + i), id: `k${i}`, age });
    const withKids = (ages: number[]) => ({ ...c, family: { ...c.family, children: ages.map(kid) } });
    expect(engine.roomForChild(withKids([3]))).toBe(true);
    expect(engine.roomForChild(withKids([3, 0]))).toBe(false);
    expect(engine.roomForChild(withKids(Array.from({ length: FAMILY.MAX_CHILDREN }, () => 5)))).toBe(false);
    const card = engine.storyCardFor(c, null, 1, 'conversa-sobre-um-filho')!;
    expect(engine.roomForChild({ ...c, pendingEvents: [card] })).toBe(false);
  });

  it('um filho que nasce por um cartão de vida pessoal: o bebê é sorteado antes do texto e nasce na escolha natural', () => {
    const c = careerWithPartner(23);
    const card = engine.storyCardFor(c, null, 1, 'conversa-sobre-um-filho', 0)!;
    const effect = card.choices[0]!.outcomes[0]!.effects.find((e) => e.type === 'child');
    expect(effect?.type).toBe('child');
    const baby = effect?.type === 'child' ? effect.child : null;
    expect(baby).not.toBeNull();
    expect(card.choices[0]!.outcomes[0]!.text).toContain(baby!.firstName);
    expect(baby).toMatchObject({ age: 0, lastName: engine.getPlayer(c).lastName });
    // O mesmo cartão no mesmo momento sorteia o mesmo bebê.
    expect(engine.storyCardFor(c, null, 1, 'conversa-sobre-um-filho', 0)).toEqual(card);
    const born = engine.resolveEvent({ ...c, pendingEvents: [card] }, card.id, card.choices[0]!.id).career;
    expect(born.family.children.map((k) => k.id)).toEqual([baby!.id]);
    const waited = engine.resolveEvent({ ...c, pendingEvents: [card] }, card.id, card.choices[1]!.id).career;
    expect(waited.family.children).toEqual([]);
    // Sem parceiro (ou sem idade), o cartão não sai.
    expect(engine.storyCardFor({ ...c, family: { ...c.family, partner: null } }, null, 1, 'conversa-sobre-um-filho')).toBeNull();
    expect(engine.storyCardFor(careerWithPartner(23, 16), null, 1, 'conversa-sobre-um-filho')).toBeNull();
  });

  it('com um bebê de cartão esperando resposta, o evento de família do começo do ano não traz outro', () => {
    const base = { ...careerWithPartner(23), family: { ...careerWithPartner(23).family } };
    const season = Array.from({ length: 80 }, (_, i) => i + 1).find((s) =>
      engine.familySeasonEvents({ ...base, season: s }).some((e) => e.definitionId === 'family-child'),
    )!;
    expect(season).toBeDefined();
    const c = { ...base, season };
    const card = engine.storyCardFor(c, null, 1, 'conversa-sobre-um-filho')!;
    expect(engine.familySeasonEvents({ ...c, pendingEvents: [card] }).some((e) => e.definitionId === 'family-child')).toBe(false);
  });
});
