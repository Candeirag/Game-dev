/** Simulador sem interface (`npm run sim`): argumentos, coleta, agregados e relatório. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { SPONSOR_PROFILES, STORY_CHAINS } from '@/data/events';
import { PLAYER_BACKGROUNDS, PLAYER_MAX_AGE, PLAYER_MIN_AGE } from '@/data/rules';
import { ROOKIE_TEAM_IDS } from '@/data/teams';
import { validateCareerIntegrity } from '@/persistence/integrity';
import type { MomentRecord, PendingEvent } from '@/domain/schemas';
import type { RaceMoment } from '@/engine';
import { HELP, parseArgs, runCli } from '../sim/cli';
import { playRound } from '../sim/policy';
import { formatReport } from '../sim/report';
import {
  type CareerSample,
  DEFAULT_SIM_OPTIONS,
  type EventSample,
  birthTerciles,
  edgeTerciles,
  emptyEventSample,
  type MomentSample,
  type RaceSample,
  SIM_CHOICES,
  SIM_POPULATION,
  type SeasonSample,
  type SimResult,
  type TextRepeatSample,
  createSimCareer,
  percentile,
  profileForSeed,
  runSimulation,
  simulateCareer,
  summarize,
  watchEvents,
} from '../sim/run';

const SMALL = { seeds: 4, seasons: 3, firstSeed: 11, talent: 0 };
const small: SimResult = runSimulation(SMALL);
/** Carreira montada à mão sem nenhum texto repetido. */
const NO_REPEATS: TextRepeatSample = { story: 0, all: 0, repeated: [] };
const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

describe('argumentos da linha de comando', () => {
  it('sem argumentos, vale o padrão: 50 carreiras de 15 temporadas', () => {
    expect(parseArgs([])).toEqual({ seeds: 50, seasons: 15, firstSeed: 1, talent: 0, moments: 'style', json: false, out: null, help: false });
    expect(DEFAULT_SIM_OPTIONS).toEqual({ seeds: 50, seasons: 15, firstSeed: 1, talent: 0, moments: 'style' });
  });

  it('lê cada opção, com espaço ou com sinal de igual', () => {
    expect(
      parseArgs(['--seeds', '8', '--seasons', '20', '--first-seed', '100', '--talent', '4', '--moments', 'bold', '--json', '--out', 'relatorio.txt']),
    ).toEqual({
      seeds: 8,
      seasons: 20,
      firstSeed: 100,
      talent: 4,
      moments: 'bold',
      json: true,
      out: 'relatorio.txt',
      help: false,
    });
    expect(parseArgs(['--seeds=3', '--seasons=2', '--moments=safe'])).toMatchObject({ seeds: 3, seasons: 2, moments: 'safe' });
    expect(parseArgs(['--help']).help).toBe(true);
  });

  it('recusa o que não entende, explicando o motivo', () => {
    expect(() => parseArgs(['--sementes', '5'])).toThrow(/Opção desconhecida: --sementes/);
    expect(() => parseArgs(['--seeds'])).toThrow(/Falta o valor de --seeds/);
    expect(() => parseArgs(['--seeds', 'muitas'])).toThrow(/número inteiro de 1 a 5000/);
    expect(() => parseArgs(['--seeds', '0'])).toThrow(/número inteiro/);
    expect(() => parseArgs(['--seasons', '2.5'])).toThrow(/número inteiro de 1 a 80/);
    expect(() => parseArgs(['--talent', '99'])).toThrow(/de 0 a 12/);
    expect(() => parseArgs(['--moments', 'ousado'])).toThrow(/--moments precisa ser style, safe ou bold \(veio "ousado"\)/);
    expect(() => parseArgs(['--moments'])).toThrow(/Falta o valor de --moments/);
    expect(() => parseArgs(['--first-seed', '4294967295', '--seeds', '2'])).toThrow(/32 bits/);
  });

  it('não adivinha valores estranhos: número só com algarismos, valor vazio e opção no lugar do valor são recusados', () => {
    // O valor é tudo o que vem depois do primeiro sinal de igual.
    expect(parseArgs(['--out=pasta/a=b.txt']).out).toBe('pasta/a=b.txt');
    expect(() => parseArgs(['--seeds=5=6'])).toThrow(/número inteiro de 1 a 5000 \(veio "5=6"\)/);
    for (const value of ['0x2', '1e0', ' 5', '+5']) expect(() => parseArgs(['--seeds', value]), value).toThrow(/número inteiro/);
    expect(() => parseArgs(['--talent='])).toThrow(/Falta o valor de --talent/);
    expect(() => parseArgs(['--out='])).toThrow(/Falta o valor de --out/);
    expect(() => parseArgs(['--out', '--json'])).toThrow(/Falta o valor de --out/);
  });
});

describe('carreiras do simulador', () => {
  it('cada semente tem o seu perfil de piloto, sempre o mesmo e sempre válido', () => {
    const profiles = Array.from({ length: 50 }, (_, i) => profileForSeed(i + 1));
    expect(profiles).toEqual(Array.from({ length: 50 }, (_, i) => profileForSeed(i + 1)));
    for (const profile of profiles) {
      expect(profile.age).toBeGreaterThanOrEqual(PLAYER_MIN_AGE);
      expect(profile.age).toBeLessThanOrEqual(PLAYER_MAX_AGE);
      expect(ROOKIE_TEAM_IDS).toContain(profile.teamId);
    }
    // A amostra cobre todos os começos: os três perfis, as três equipes de entrada e todas as idades.
    expect(new Set(profiles.map((p) => p.background)).size).toBe(SIM_POPULATION.backgrounds.length);
    expect(new Set(profiles.map((p) => p.teamId)).size).toBe(SIM_POPULATION.teamIds.length);
    expect(new Set(profiles.map((p) => p.age)).size).toBe(SIM_POPULATION.ages.length);
  });

  it('a população da amostra é fixa e só usa perfis, idades e equipes que existem no jogo', () => {
    // Congelada de propósito: se o jogo ganhar um perfil ou uma equipe de entrada, os 50 pilotos da linha de base não mudam.
    expect(SIM_POPULATION).toEqual({ backgrounds: ['natural', 'technical', 'fighter'], ages: [14, 15, 16, 17], teamIds: ['horizonte', 'cerrado', 'garagem'] });
    for (const background of SIM_POPULATION.backgrounds) expect(PLAYER_BACKGROUNDS.map((b) => b.id)).toContain(background);
    for (const teamId of SIM_POPULATION.teamIds) expect(ROOKIE_TEAM_IDS).toContain(teamId);
  });

  it('uma carreira que quebra diz a semente e a temporada', () => {
    expect(() => simulateCareer(-1, { seasons: 1, talent: 0 })).toThrow(/A carreira da semente -1 falhou na temporada 1: Semente inválida/);
  });

  it('nascem íntegras, com a semente pedida', () => {
    const career = createSimCareer(123);
    expect(career.seed).toBe(123);
    expect(validateCareerIntegrity(career)).toEqual([]);
  });

  it('dão uma linha por temporada disputada, com o que o relatório precisa', () => {
    const sample = simulateCareer(11, { seasons: 3, talent: 0 });
    expect(sample.ended).toBe('completed');
    expect(sample.seasons.map((s) => s.season)).toEqual([1, 2, 3]);
    expect(sample.seasons[0]).toMatchObject({ categoryId: 'kart-regional', tier: 1, seat: 'initial', age: sample.profile.age });
    // O piloto envelhece um ano por temporada.
    expect(sample.seasons.map((s) => s.age)).toEqual([0, 1, 2].map((n) => sample.profile.age + n));
    for (const season of sample.seasons) {
      expect(season.position).toBeGreaterThanOrEqual(1);
      expect(season.position).toBeLessThanOrEqual(20);
      expect(season.title).toBe(season.position === 1);
      expect(Number.isFinite(season.cash) && Number.isFinite(season.netWorth)).toBe(true);
    }
  });

  it('o talento do piloto muda a carreira', () => {
    const position = (talent: number) => simulateCareer(11, { seasons: 2, talent }).seasons.map((s) => s.position);
    expect(position(8)).not.toEqual(position(0));
  });
});

describe('agregados', () => {
  const { summary, samples } = small;

  it('somam todas as carreiras e temporadas, sem perder nenhuma', () => {
    expect(summary.careers).toBe(4);
    expect(summary.seasonsPlayed).toBe(samples.reduce((total, c) => total + c.seasons.length, 0));
    expect(summary.byCategory.reduce((total, c) => total + c.seasons, 0)).toBe(summary.seasonsPlayed);
    expect(summary.cashBySeason.map((s) => s.season)).toEqual([1, 2, 3]);
    expect(summary.cashBySeason.reduce((total, s) => total + s.careers, 0)).toBe(summary.seasonsPlayed);
    expect(summary.highestTier.reduce((total, n) => total + n, 0)).toBe(4);
    expect(summary.titles.none + summary.titles.one + summary.titles.two + summary.titles.threeOrMore).toBe(4);
    expect(summary.titles.total).toBe(summary.byCategory.reduce((total, c) => total + c.titles, 0));
  });

  it('todas as carreiras começam no primeiro degrau', () => {
    expect(summary.arrivals[0]).toMatchObject({ categoryId: 'kart-regional', tier: 1, careers: 4, share: 1, averageSeason: 1 });
    expect(summary.averageStartAge).toBe(summary.arrivals[0]?.averageAge);
    expect(summary.top).toMatchObject({ categoryId: 'f1' });
  });

  it('os percentis seguem o posto mais próximo', () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentile([10, 20, 30, 40], 0.1)).toBe(10);
    expect(percentile([10, 20, 30, 40], 0.9)).toBe(40);
    expect(percentile([], 0.5)).toBe(0);
    for (const row of summary.cashBySeason) {
      expect(row.p10).toBeLessThanOrEqual(row.median);
      expect(row.median).toBeLessThanOrEqual(row.p90);
    }
  });

  it('"sem vaga" conta as temporadas disputadas pela rede de segurança', () => {
    const fallbacks = samples.reduce((total, c) => total + c.seasons.filter((s) => s.seat === 'fallback').length, 0);
    expect(summary.noSeat.seasons).toBe(fallbacks);
    // Toda temporada sem vaga tem um motivo, e só elas.
    expect(summary.noSeat.noOffer + summary.noSeat.money + summary.noSeat.requirements).toBe(fallbacks);
    for (const season of samples.flatMap((c) => c.seasons)) {
      expect(season.noSeatCause !== null).toBe(season.seat === 'fallback');
      expect(season.offers).toBeLessThanOrEqual(season.offersMade);
    }
    expect(summarize([], SMALL)).toMatchObject({ careers: 0, seasonsPlayed: 0, noSeat: { seasons: 0, share: 0 }, titles: { perCareer: 0, max: 0 } });
  });
});

describe('agregados de carreiras montadas à mão', () => {
  const idOf = (tier: number) => CATEGORIES.find((c) => c.tier === tier)!.id;
  const season = (number: number, tier: number, extra: Partial<SeasonSample> = {}): SeasonSample => ({
    season: number,
    categoryId: idOf(tier),
    tier,
    age: 15 + number,
    position: 10,
    wins: 0,
    podiums: 0,
    title: false,
    cash: 1000 * number,
    netWorth: 2000 * number,
    reputation: 30,
    overall: 60,
    roundsMissed: 0,
    seat: number === 1 ? 'initial' : 'continue',
    noSeatCause: null,
    offersMade: 2,
    offers: 1,
    doorOpen: true,
    lastResort: false,
    door: number === 1 ? 'initial' : 'own',
    yearResult: 0,
    sponsorsBroken: 0,
    investorShare: 0,
    sideJob: false,
    academy: false,
    races: [],
    freshRivalries: 0,
    events: emptyEventSample(),
    ...extra,
  });
  const profile = { background: 'natural', age: 16, teamId: 'horizonte' } as const;
  // A: sobe do 1º ao 2º degrau, pula o 3º pelo atalho, cai nele pela rede de segurança (faltou dinheiro) e volta ao 4º.
  const a: CareerSample = {
    seed: 1,
    profile,
    birth: { score: 60, region: 'capital', traitBalance: 1 },
    ended: 'completed',
    texts: NO_REPEATS,
    seasons: [
      season(1, 1, { position: 1, title: true }),
      season(2, 1, { position: 2 }),
      season(3, 2, { seat: 'promotion', position: 1, title: true }),
      season(4, 4, { seat: 'promotion', cash: -500, roundsMissed: 2 }),
      season(5, 3, { seat: 'fallback', noSeatCause: 'money', cash: -900 }),
      season(6, 4, { seat: 'promotion' }),
    ],
  };
  // B: fica sem proposta no primeiro degrau, depois sobe um degrau por vez até o 3º, e a carreira é interrompida.
  const b: CareerSample = {
    seed: 2,
    profile: { ...profile, age: 14 },
    birth: { score: 40, region: 'interior', traitBalance: -1 },
    ended: 'succession',
    texts: NO_REPEATS,
    seasons: [
      season(1, 1, { position: 20 }),
      season(2, 1, { seat: 'fallback', noSeatCause: 'no-offer', position: 3 }),
      season(3, 2, { seat: 'promotion' }),
      season(4, 3, { seat: 'promotion', age: 30 }),
    ],
  };
  const summary = summarize([a, b], { seeds: 2, seasons: 6, firstSeed: 1, talent: 0 });
  const arrival = (tier: number) => summary.arrivals.find((row) => row.tier === tier);

  it('chegar a um degrau é subir até ele: quem pula o degrau e depois cai nele não conta', () => {
    // Ao 3º degrau só B chegou (aos 30, na temporada 4); a queda de A para ele não é chegada.
    expect(arrival(3)).toMatchObject({ careers: 1, share: 0.5, averageAge: 30, minAge: 30, maxAge: 30, averageSeason: 4 });
    // Ao 4º, só A, e vale a primeira subida (temporada 4), não a volta (temporada 6).
    expect(arrival(4)).toMatchObject({ careers: 1, averageAge: 19, averageSeason: 4 });
    expect(arrival(2)).toMatchObject({ careers: 2, averageSeason: 3 });
    expect(arrival(1)).toMatchObject({ careers: 2, share: 1, averageSeason: 1 });
    expect(arrival(5)).toBeUndefined();
    // "Passou pela categoria" continua contando a queda: A disputou uma temporada no 3º degrau.
    expect(summary.byCategory.find((row) => row.tier === 3)).toMatchObject({ seasons: 2, careers: 2 });
  });

  it('degrau mais alto, títulos, posições e idade de estreia', () => {
    expect(summary.highestTier).toEqual([0, 0, 1, 1, 0, 0, 0]);
    expect(summary.top).toMatchObject({ careers: 0, share: 0 });
    expect(summary.titles).toEqual({ total: 2, perCareer: 1, max: 2, none: 1, one: 0, two: 1, threeOrMore: 0 });
    expect(summary.byCategory.find((row) => row.tier === 1)).toMatchObject({
      seasons: 4,
      careers: 2,
      averagePosition: 6.5,
      medianPosition: 2,
      bestPosition: 1,
      top3Share: 0.75,
      titles: 1,
    });
    expect(summary.averageStartAge).toBe(15);
    expect(summary.seasonsPlayed).toBe(10);
  });

  it('temporadas sem vaga e o motivo, quedas, sequência no mesmo degrau, etapas perdidas e interrupções', () => {
    expect(summary.noSeat).toEqual({ seasons: 2, perCareer: 1, careers: 2, share: 1, noOffer: 1, money: 1, requirements: 0 });
    // Só A desceu (do 4º para o 3º); ficar no 1º degrau pela rede de segurança não é descer.
    expect(summary.demotions).toEqual({ seasons: 1, perCareer: 0.5, careers: 1 });
    expect(summary.longestStay).toBe(2);
    expect(summary.roundsMissedPerSeason).toBe(0.2);
    expect(summary.interrupted).toBe(1);
  });

  it('caixa por temporada: só as carreiras que chegaram àquela temporada entram', () => {
    expect(summary.cashBySeason.map((row) => row.careers)).toEqual([2, 2, 2, 2, 1, 1]);
    expect(summary.cashBySeason[3]).toMatchObject({ season: 4, p10: -500, median: -500, p90: 4000, negativeShare: 0.5, medianNetWorth: 8000 });
    expect(summary.cashBySeason[4]).toMatchObject({ season: 5, median: -900, negativeShare: 1 });
  });

  it('nascimento: grupos pela nota de nascença, pela cidade e pelos traços', () => {
    // Com duas carreiras, o terço de baixo e o de cima ficam vazios; o do meio leva as duas.
    expect(summary.byBirth.map((g) => g.group)).toEqual(['mid']);
    const [low, mid, high] = birthTerciles([a, b, { ...a, seed: 3, birth: { ...a.birth, score: 50 } }]);
    expect([low, mid, high].map((g) => g.map((c) => c.seed))).toEqual([[2], [3], [1]]);
    expect(summary.byOrigin.find((g) => g.group === 'capital')).toMatchObject({
      careers: 1,
      averageScore: 60,
      debutPosition: 1,
      averageHighestTier: 4,
      formulaShare: 1,
      topShare: 0,
      titlesPerCareer: 2,
      noSeatPerCareer: 1,
    });
    expect(summary.byOrigin.find((g) => g.group === 'interior')).toMatchObject({ careers: 1, averageScore: 40, debutPosition: 20, averageHighestTier: 3 });
    expect(summary.byOrigin.find((g) => g.group === 'talents')?.careers).toBe(1);
    expect(summary.byOrigin.find((g) => g.group === 'defects')?.careers).toBe(1);
    const text = formatReport(summary);
    expect(text).toContain('Nascença média');
    expect(text).toContain('Dois defeitos');
  });

  it('o relatório mostra esses números e acerta o singular', () => {
    const text = formatReport(summary);
    expect(text).toContain('em 1, nenhuma equipe fez proposta; em 1, havia proposta e faltou dinheiro para a vaga; em 0, faltou outro requisito.');
    expect(text).toContain('Carreiras interrompidas por sucessão (morte ou acidente): 1.');
    expect(text).toContain('Chegar é subir');
    const single = formatReport(summarize([{ ...b, seasons: b.seasons.slice(0, 1) }], { seeds: 1, seasons: 1, firstSeed: 2, talent: 0 }));
    expect(single).toContain('1 carreira (semente 2), 1 temporada cada: 1 temporada disputada');
    expect(single).toContain('0 de 1 carreira (0%)');
    expect(single).toContain('Maior sequência no mesmo degrau: 1,0 temporada, em média.');
    expect(single).not.toMatch(/1 carreiras|1 temporadas/);
  });
});

describe('portas nos agregados (Fase 3)', () => {
  const sample = (seed: number, seasons: SeasonSample[]): CareerSample => ({
    seed,
    profile: { background: 'natural', age: 16, teamId: 'horizonte' },
    birth: { score: 50, region: 'capital', traitBalance: 1 },
    seasons,
    ended: 'completed',
    texts: NO_REPEATS,
  });
  const base = (number: number, extra: Partial<SeasonSample>): SeasonSample => ({
    season: number,
    categoryId: 'kart-regional',
    tier: 1,
    age: 15 + number,
    position: 10,
    wins: 0,
    podiums: 0,
    title: false,
    cash: 0,
    netWorth: 0,
    reputation: 5,
    overall: 60,
    roundsMissed: 0,
    seat: 'renewal',
    noSeatCause: null,
    offersMade: 1,
    offers: 1,
    doorOpen: true,
    lastResort: false,
    door: 'own',
    yearResult: 0,
    sponsorsBroken: 0,
    investorShare: 0,
    sideJob: false,
    academy: false,
    races: [],
    freshRivalries: 0,
    events: emptyEventSample(),
    ...extra,
  });
  // Duas temporadas sem porta, o último recurso na terceira (não conta como "sem porta") e mais uma sem porta.
  const stuck = sample(1, [
    base(1, { door: 'initial', doorOpen: false, position: 18, yearResult: -9_000 }),
    base(2, { door: 'none', doorOpen: false, position: 19, yearResult: -7_000, sponsorsBroken: 2 }),
    base(3, { door: 'none', doorOpen: true, lastResort: true, position: 17, yearResult: -5_000 }),
    base(4, { door: 'investor', doorOpen: false, position: 4, yearResult: 3_000, investorShare: 0.25, sideJob: true }),
  ]);
  const climber = sample(2, [
    base(1, { door: 'initial', position: 2, yearResult: 4_000 }),
    base(2, { door: 'own', categoryId: 'kart-national', tier: 2, position: 3, yearResult: 6_000 }),
    base(3, { door: 'academy', categoryId: 'f4', tier: 4, position: 8, academy: true }),
  ]);
  const doors = summarize([stuck, climber], { seeds: 2, seasons: 4, firstSeed: 1, talent: 0 }).doors;

  it('conta as temporadas sem porta e a maior sequência, sem contar o ano do último recurso', () => {
    expect(doors).toMatchObject({ noDoorSeasons: 3, noDoorCareers: 1, longestNoDoorStreak: 2, lastResortSeasons: 1 });
  });

  it('conta as vagas por porta, o investidor, a academia, o trabalho e os rompimentos', () => {
    expect(doors.used).toEqual({ own: 1, academy: 1, crowdfund: 0, investor: 1, none: 2 });
    expect(doors).toMatchObject({
      investorCareers: 1,
      investorAverageShare: 0.25,
      investorMaxShare: 0.25,
      academyCareers: 1,
      sideJobSeasons: 1,
      sponsorsBrokenPerCareer: 1,
    });
  });

  it('mede o resultado do ano pela posição final no kart e a entrada na Fórmula Júnior por porta', () => {
    expect(doors.yearResultByPosition.map((b) => [b.seasons, b.median])).toEqual([
      [3, 4_000],
      [0, 0],
      [0, 0],
      [3, -7_000],
    ]);
    expect(doors.juniorEntry[0]).toMatchObject({
      label: 'Todas as carreiras',
      stats: { careers: 1, share: 0.5, averageSeason: 3, own: 0, academy: 1, investor: 0 },
    });
  });
});

describe('lances decisivos nos agregados (Fase 4)', () => {
  const moment = (
    kind: MomentSample['kind'],
    option: string,
    risk: 0 | 1 | 2,
    chance: number,
    riskyChance: number | null,
    extra: Partial<MomentSample> = {},
  ): MomentSample => ({
    kind,
    option,
    risk,
    chance,
    riskyChance,
    success: true,
    outcome: 'won',
    contact: false,
    penalized: false,
    ...extra,
  });
  const lost = { success: false, outcome: 'lost' } as const;
  const race = (round: number, edge: number, moments: MomentSample[], completed = true): RaceSample => ({ round, edge, completed, moments });
  const career = (seed: number, categoryId: SeasonSample['categoryId'], tier: number, races: RaceSample[], freshRivalries: number): CareerSample => ({
    seed,
    profile: { background: 'natural', age: 16, teamId: 'horizonte' },
    birth: { score: 50, region: 'capital', traitBalance: 1 },
    ended: 'completed',
    seasons: [
      {
        season: 1,
        categoryId,
        tier,
        age: 16,
        position: 10,
        wins: 0,
        podiums: 0,
        title: false,
        cash: 0,
        netWorth: 0,
        reputation: 5,
        overall: 60,
        roundsMissed: 0,
        seat: 'initial',
        noSeatCause: null,
        offersMade: 1,
        offers: 1,
        doorOpen: true,
        lastResort: false,
        door: 'initial',
        yearResult: 0,
        sponsorsBroken: 0,
        investorShare: 0,
        sideJob: false,
        academy: false,
        races,
        freshRivalries,
        events: emptyEventSample(),
      },
    ],
    texts: NO_REPEATS,
  });
  // No kart: uma corrida de 2 lances, uma de 3 (com um toque punido) e um abandono na largada, que não é corrida completa.
  const kart = career(
    1,
    'kart-regional',
    1,
    [
      race(1, -6, [moment('start', 'outside', 1, 0.5, 0.3), moment('lastLap', 'secure', 0, 0.9, 0.6)]),
      race(2, -2, [
        moment('start', 'inside', 2, 0.4, 0.4, { success: false, outcome: 'touch', contact: true, penalized: true }),
        moment('attack', 'wait', 0, 0.2, 0.5, lost),
        moment('lastLap', 'allIn', 2, 0.7, 0.7),
      ]),
      race(3, 0, [moment('start', 'inside', 2, 0.5, 0.5, { success: false, outcome: 'retired', contact: true })], false),
    ],
    2,
  );
  // Nos monopostos: uma corrida de 4 lances (o de parada não tem opção arriscada), uma de 1 só (fora da faixa) e uma de 2.
  const formula = career(
    2,
    'f4',
    4,
    [
      race(1, 3, [
        moment('start', 'inside', 2, 0.8, 0.8),
        moment('pit', 'undercut', 1, 0.6, null),
        moment('attack', 'dive', 2, 0.7, 0.7),
        moment('lastLap', 'allIn', 2, 0.8, 0.8, { success: false, outcome: 'spin' }),
      ]),
      race(2, 5, [moment('start', 'hold', 0, 0.8, 0.4)]),
      race(3, 8, [moment('start', 'inside', 2, 0.9, 0.9), moment('defense', 'block', 2, 0.8, 0.8)]),
    ],
    0,
  );
  const stats = summarize([kart, formula], { seeds: 2, seasons: 1, firstSeed: 1, talent: 0 }).moments;

  it('conta os lances por corrida completa, no total e por categoria', () => {
    expect(stats.moments).toBe(13);
    expect(stats.all).toEqual({ races: 6, completeRaces: 5, perRace: 2.4, two: 2, three: 1, four: 1, other: 1 });
    expect(stats.byCategory).toEqual([
      { categoryId: 'kart-regional', races: 3, completeRaces: 2, perRace: 2.5, two: 1, three: 1, four: 0, other: 0 },
      { categoryId: 'f4', races: 3, completeRaces: 3, perRace: 7 / 3, two: 1, three: 0, four: 1, other: 1 },
    ]);
  });

  it('mede cada opção de cada lance: vezes, acerto, chance mostrada e consequências', () => {
    // Todas as opções do jogo aparecem, na ordem dele, mesmo as que ninguém escolheu.
    expect(stats.byOption).toHaveLength(14);
    expect(stats.byOption.map((o) => `${o.kind}/${o.option}`).slice(0, 4)).toEqual(['start/inside', 'start/outside', 'start/hold', 'attack/dive']);
    const option = (kind: string, id: string) => stats.byOption.find((o) => o.kind === kind && o.option === id);
    const inside = option('start', 'inside');
    expect(inside).toMatchObject({ risk: 2, times: 4, successShare: 0.5, spins: 0, contacts: 2, retired: 1, penalized: 1 });
    expect(inside?.averageChance).toBeCloseTo(0.65, 10);
    expect(option('lastLap', 'allIn')).toMatchObject({ risk: 2, times: 2, successShare: 0.5, averageChance: 0.75, spins: 1, contacts: 0 });
    expect(option('rain', 'stay')).toEqual({
      kind: 'rain',
      option: 'stay',
      risk: 2,
      times: 0,
      successShare: 0,
      averageChance: 0,
      spins: 0,
      contacts: 0,
      retired: 0,
      penalized: 0,
    });
    expect(stats.byOption.reduce((total, o) => total + o.times, 0)).toBe(stats.moments);
  });

  it('separa as corridas em três faixas do mesmo tamanho pela vantagem sobre o grid', () => {
    const [low, mid, high] = stats.byEdge;
    expect(stats.byEdge.map((g) => g.group)).toEqual(['low', 'mid', 'high']);
    // Baixa: as corridas de vantagem −6 e −2. Cinco lances, todos com opção arriscada; o piloto foi nela em dois e venceu um.
    expect(low).toMatchObject({ races: 2, averageEdge: -4, minEdge: -6, maxEdge: -2, moments: 5, riskyOffered: 5, riskyTakenShare: 0.4, successShare: 0.6 });
    expect(low?.riskyChance).toBeCloseTo(0.5, 10);
    expect(low).toMatchObject({ riskyWonPerRace: 0.5, balancePerRace: 0.5 });
    // Média: 0 e +3. O lance de parada não oferece opção arriscada e fica fora da chance e do "arriscou".
    expect(mid).toMatchObject({ races: 2, minEdge: 0, maxEdge: 3, moments: 5, riskyOffered: 4, riskyTakenShare: 1, successShare: 0.6, riskyWonPerRace: 1 });
    expect(mid?.riskyChance).toBeCloseTo(0.7, 10);
    // Alta: +5 e +8. Três lances vencidos, dois deles arriscados; o seguro também conta na chance oferecida (40%).
    expect(high).toMatchObject({ races: 2, minEdge: 5, maxEdge: 8, moments: 3, riskyOffered: 3, successShare: 1, riskyWonPerRace: 1, balancePerRace: 1.5 });
    expect(high?.riskyChance).toBeCloseTo(0.7, 10);
    expect(high?.riskyTakenShare).toBeCloseTo(2 / 3, 10);
  });

  it('nos terços, o do meio fica com a sobra e o empate segue a ordem das corridas', () => {
    const tied = [race(1, 2, []), race(2, 1, []), race(3, 2, []), race(4, 2, []), race(5, 0, [])];
    expect(edgeTerciles(tied).map((group) => group.map((r) => r.round))).toEqual([[5], [2, 1, 3], [4]]);
    expect(edgeTerciles([race(1, 0, []), race(2, 1, [])]).map((group) => group.length)).toEqual([0, 2, 0]);
  });

  it('conta as rivalidades novas e os toques por 100 lances', () => {
    expect(stats).toMatchObject({ freshRivalries: 2, freshRivalriesPerCareer: 1 });
    expect(stats.contactsPer100).toBeCloseTo((2 / 13) * 100, 10);
  });

  it('o relatório mostra essas tabelas, e sem carreira nenhuma não inventa número', () => {
    const text = formatReport(summarize([kart, formula], { seeds: 2, seasons: 1, firstSeed: 1, talent: 0 }));
    expect(text).toContain('Lances: 13 em 6 corridas (5 completas). Corridas completas fora da faixa de 2 a 4 lances: 1.');
    expect(text).toContain('Rivalidades novas: 2 (1,00 por carreira). Toques em lances: 15,4 a cada 100 lances.');
    expect(text).toMatch(/Todas as categorias +6 +5 +2,40 +40% +20% +20%/);
    expect(text).toMatch(/Largada +Arriscar por dentro +Arriscado +4 +50% +65% +0 +2 +1 +1/);
    expect(text).toMatch(/Chuva começando +Arriscar na pista +Arriscado +0 +- +- +0 +0 +0 +0/);
    expect(text).toMatch(/Baixa +2 +−4,0 \(−6,0 a −2,0\) +5 +50% +40% +60% +0,50 +\+0,50/);
    expect(text).toMatch(/Alta +2 +\+6,5 \(\+5,0 a \+8,0\) +3 +70% +67% +100% +1,00 +\+1,50/);
    const empty = summarize([], SMALL);
    expect(empty.moments).toMatchObject({
      moments: 0,
      all: { races: 0, completeRaces: 0, perRace: 0 },
      byCategory: [],
      byEdge: [],
      freshRivalriesPerCareer: 0,
      contactsPer100: 0,
    });
    expect(empty.moments.byOption).toHaveLength(14);
    const section = formatReport(empty).split('9. LANCES DECISIVOS')[1] ?? '';
    expect(section).toContain('Lances: 0 em 0 corridas (0 completas).');
    expect(section).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('lances decisivos em carreiras de verdade (Fase 4)', () => {
  it('acompanhar a corrida não a muda, e o que o observador vê é o que fica no resultado', () => {
    const career = createSimCareer(11);
    const seen: { moment: RaceMoment; record: MomentRecord }[] = [];
    let races = 0;
    const watched = playRound(career, SIM_CHOICES, { onMoment: (moment, record) => seen.push({ moment, record }), onRace: () => races++ });
    expect(watched).toEqual(playRound(career, SIM_CHOICES));
    expect(races).toBe(1);
    expect(seen.map((s) => s.record)).toEqual(watched.rounds.at(-1)?.race.moments);
    expect(seen[0]?.moment.kind).toBe('start');
    for (const { moment, record } of seen) {
      // O lance oferecido é o que foi resolvido, e a chance gravada é a que a opção mostrava.
      expect([moment.kind, moment.lap]).toEqual([record.kind, record.lap]);
      expect(moment.options.find((o) => o.id === record.option)?.chance).toBe(record.chance);
      // O robô padrão não responde: quem escolheu foi o estilo do piloto.
      expect(record.auto).toBe(true);
    }
  });

  it('cada corrida da amostra traz os seus lances, a começar pela largada', () => {
    const seasons = small.samples.flatMap((c) => c.seasons);
    const races = seasons.flatMap((s) => s.races);
    expect(races.length).toBeGreaterThan(0);
    for (const season of seasons) expect(season.races.map((r) => r.round)).toEqual([...season.races.map((r) => r.round)].sort((a, b) => a - b));
    for (const r of races) {
      expect(r.moments[0]?.kind).toBe('start');
      expect(r.moments.length).toBeLessThanOrEqual(4);
      expect(Number.isFinite(r.edge)).toBe(true);
      for (const m of r.moments) {
        expect(m.chance).toBeGreaterThanOrEqual(0);
        expect(m.chance).toBeLessThanOrEqual(1);
        // A opção arriscada escolhida é a própria opção arriscada do lance.
        if (m.risk === 2) expect(m.riskyChance).toBe(m.chance);
      }
    }
    expect(small.summary.moments.moments).toBe(races.reduce((total, r) => total + r.moments.length, 0));
    expect(small.summary.moments.byEdge.reduce((total, g) => total + g.races, 0)).toBe(races.length);
  });

  it('a política de lances muda as escolhas: "bold" vai sempre na opção arriscada e "safe", nunca', () => {
    const chosen = (moments: 'safe' | 'bold') =>
      simulateCareer(11, { seasons: 1, talent: 0, moments })
        .seasons.flatMap((s) => s.races)
        .flatMap((r) => r.moments);
    const bold = chosen('bold');
    expect(bold.length).toBeGreaterThan(0);
    for (const m of bold) if (m.riskyChance !== null) expect(m.risk).toBe(2);
    // Todo lance com opção arriscada tem também uma mais segura.
    for (const m of chosen('safe')) expect(m.risk).toBeLessThan(2);
  });

  // Critério de aceite da Fase 4: pilotos melhores vencem mais lances. Com o mesmo robô, as corridas
  // em que o piloto tem mais vantagem sobre o grid mostram chances maiores na opção arriscada e
  // rendem mais lances arriscados vencidos.
  it('pilotos melhores veem chances maiores e vencem mais lances arriscados', () => {
    const { byEdge } = runSimulation({ seeds: 8, seasons: 6, firstSeed: 11, talent: 0 }).summary.moments;
    const [low, , high] = byEdge;
    expect(byEdge.map((g) => g.group)).toEqual(['low', 'mid', 'high']);
    expect(high!.averageEdge).toBeGreaterThan(low!.averageEdge);
    expect(high!.riskyChance).toBeGreaterThan(low!.riskyChance);
    expect(high!.riskyWonPerRace).toBeGreaterThan(low!.riskyWonPerRace);
  });
});

describe('eventos nos agregados (Fase 5)', () => {
  const chain = STORY_CHAINS[0]!;
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const events = (perRound: number[], extra: Partial<EventSample>): EventSample => ({ ...emptyEventSample(), perRound, ...extra });
  const season = (number: number, sample: EventSample): SeasonSample => ({
    season: number,
    categoryId: 'kart-regional',
    tier: 1,
    age: 15 + number,
    position: 10,
    wins: 0,
    podiums: 0,
    title: false,
    cash: 0,
    netWorth: 0,
    reputation: 5,
    overall: 60,
    roundsMissed: 0,
    seat: number === 1 ? 'initial' : 'continue',
    noSeatCause: null,
    offersMade: 1,
    offers: 1,
    doorOpen: true,
    lastResort: false,
    door: number === 1 ? 'initial' : 'own',
    yearResult: 0,
    sponsorsBroken: 0,
    investorShare: 0,
    sideJob: false,
    academy: false,
    races: [],
    freshRivalries: 0,
    events: sample,
  });
  const career = (seed: number, seasons: SeasonSample[], texts: TextRepeatSample): CareerSample => ({
    seed,
    profile: { background: 'natural', age: 16, teamId: 'horizonte' },
    birth: { score: 50, region: 'capital', traitBalance: 1 },
    ended: 'completed',
    seasons,
    texts,
  });
  // A: duas temporadas. Na estreia, etapas com 1, 2, 0 e 4 cartões; na segunda, com 3 e 1, e 2 no começo do ano.
  // Começa uma cadeia do catálogo (e a conclui) e uma que o catálogo não tem; recebe o mesmo perfil de patrocínio duas vezes.
  const a = career(
    1,
    [
      season(
        1,
        events([1, 2, 0, 4], {
          byCategory: { track: 3, career: 2, money: 1, health: 1, personal: 0 },
          chains: [chain.id],
          unlocks: [
            { kind: 'trait', id: 'rainMaster' },
            { kind: 'aptitude', id: 'charisma' },
          ],
          sponsorOffers: ['perfil-a'],
          others: 1,
        }),
      ),
      season(
        2,
        events([3, 1], {
          seasonStart: 2,
          byCategory: { track: 2, career: 0, money: 3, health: 0, personal: 1 },
          chains: [chain.id, 'cadeia-de-teste'],
          chainsDone: [chain.id],
          unlocks: [{ kind: 'trait', id: 'rainMaster' }],
          sponsorOffers: ['perfil-b', 'perfil-a'],
        }),
      ),
    ],
    {
      story: 1,
      all: 2,
      repeated: [
        { text: 'Texto da Fase 5', times: 2, story: 2, events: ['story:evento'] },
        { text: 'Texto de família', times: 3, story: 0, events: ['family-partner', 'birth-move'] },
      ],
    },
  );
  // B: uma temporada, etapas com 2, 0 e 1 cartões; conclui a cadeia de teste e repete um texto de família.
  const b = career(
    2,
    [
      season(
        1,
        events([2, 0, 1], {
          byCategory: { track: 1, career: 1, money: 1, health: 0, personal: 0 },
          chains: ['cadeia-de-teste'],
          chainsDone: ['cadeia-de-teste'],
          sponsorOffers: ['perfil-c'],
          others: 2,
        }),
      ),
    ],
    { story: 0, all: 1, repeated: [{ text: 'Texto de família', times: 2, story: 0, events: ['family-wedding'] }] },
  );
  const summary = summarize([a, b], { seeds: 2, seasons: 2, firstSeed: 1, talent: 0 });
  const stats = summary.events;

  it('conta os cartões por etapa disputada, a faixa de 1 a 3 e os do começo do ano (da segunda temporada em diante)', () => {
    expect(stats.all).toEqual({ rounds: 9, cards: 14, perRound: 14 / 9, zero: 2, one: 3, two: 2, three: 1, more: 1, starts: 1, startCards: 2, perStart: 2 });
    expect(stats.bySeason).toEqual([
      { season: 1, rounds: 7, cards: 10, perRound: 10 / 7, zero: 2, one: 2, two: 2, three: 0, more: 1, starts: 0, startCards: 0, perStart: 0 },
      { season: 2, rounds: 2, cards: 4, perRound: 2, zero: 0, one: 1, two: 0, three: 1, more: 0, starts: 1, startCards: 2, perStart: 2 },
    ]);
    expect(stats).toMatchObject({ cards: 16, others: 3 });
  });

  it('mede a parcela de cada categoria, as cadeias começadas e concluídas, os traços e as propostas', () => {
    expect(stats.byCategory).toEqual([
      { category: 'track', cards: 6, share: 0.375 },
      { category: 'career', cards: 3, share: 0.1875 },
      { category: 'money', cards: 5, share: 0.3125 },
      { category: 'health', cards: 1, share: 0.0625 },
      { category: 'personal', cards: 1, share: 0.0625 },
    ]);
    // Todas as cadeias do catálogo aparecem, na ordem dele; a que só a amostra tem vem no fim, com o id no lugar do nome.
    expect(stats.chains).toHaveLength(STORY_CHAINS.length + 1);
    expect(stats.chains[0]).toEqual({ id: chain.id, title: chain.title, started: 1, done: 1 });
    expect(stats.chains.at(-1)).toEqual({ id: 'cadeia-de-teste', title: 'cadeia-de-teste', started: 2, done: 1 });
    expect(stats.chains.slice(1, -1).every((c) => c.started === 0 && c.done === 0)).toBe(true);
    expect(stats).toMatchObject({ chainsStartedPerCareer: 1.5, chainsDonePerCareer: 1 });
    expect(stats).toMatchObject({ unlocks: 3, unlocksPerCareer: 1.5, unlockCareers: 1 });
    expect(stats.byUnlock.find((u) => u.id === 'rainMaster')).toMatchObject({ kind: 'trait', times: 2, careers: 1 });
    expect(stats.byUnlock.find((u) => u.id === 'charisma')).toMatchObject({ kind: 'aptitude', times: 1, careers: 1 });
    expect(stats).toMatchObject({
      sponsorOffers: 4,
      sponsorOffersPerCareer: 2,
      sponsorProfiles: 3,
      sponsorCatalog: SPONSOR_PROFILES.filter((p) => !p.chainOnly).length,
      sponsorRepeated: 1,
    });
  });

  it('soma os textos repetidos das carreiras e junta os exemplos, os da Fase 5 primeiro', () => {
    expect(stats.repeats).toEqual({
      story: 1,
      storyCareers: 1,
      all: 3,
      allCareers: 2,
      examples: [
        { text: 'Texto da Fase 5', times: 2, story: 2, events: ['story:evento'], careers: 1 },
        { text: 'Texto de família', times: 5, story: 0, events: ['family-partner', 'birth-move', 'family-wedding'], careers: 2 },
      ],
    });
  });

  it('o relatório mostra esses números, e sem carreira nenhuma não inventa número', () => {
    const text = formatReport(summary);
    expect(text).toContain(
      'Cartões da Fase 5: 16 (1,56 por etapa disputada; 2,00 no começo de cada temporada, da segunda em diante). Eventos de família e mudança: 3.',
    );
    expect(text).toContain('Etapas disputadas: 9. Sem nenhum cartão: 2. Com mais de 3: 1.');
    expect(text).toMatch(/Todas as temporadas +9 +1,56 +22% +33% +22% +11% +11% +2,00/);
    expect(text).toMatch(/Temporada 1 +7 +1,43 +29% +29% +29% +0% +14% +-\n/);
    expect(text).toMatch(/Temporada 2 +2 +2,00 +0% +50% +0% +50% +0% +2,00/);
    expect(text).toMatch(/Pista +6 +38%/);
    expect(text).toMatch(/Vida pessoal +1 +6%/);
    expect(text).toContain('Cadeias por carreira: 1,50 começadas e 1,00 concluídas, em média.');
    expect(text).toMatch(new RegExp(`${literal(chain.title)} +${literal(chain.id)} +1 +1`));
    expect(text).toMatch(/cadeia-de-teste +cadeia-de-teste +2 +1/);
    expect(text).toContain('Escolhas de traço ou aptidão oferecidas: 3 (1,50 por carreira), em 1 de 2 carreiras.');
    expect(text).toMatch(/Gênio na chuva +Talento +\d+ +2 +1/);
    expect(text).toMatch(/Carisma +Aptidão +\d+ +1 +1/);
    expect(text).toContain(
      `Propostas de patrocínio: 4 (2,00 por carreira), de 3 perfis diferentes (o catálogo tem ${stats.sponsorCatalog}). Perfil repetido na mesma carreira: 1.`,
    );
    expect(text).toContain('Textos repetidos na mesma carreira, só nos cartões da Fase 5: 1 (em 1 de 2 carreiras).');
    expect(text).toContain('Textos repetidos na mesma carreira, em todos os eventos (com família e mudança): 3 (em 2 de 2 carreiras).');
    expect(text).toContain('  "Texto da Fase 5" (story:evento): 2 vezes, em 1 carreira.');
    expect(text).toContain('  "Texto de família" (family-partner, birth-move, family-wedding): 5 vezes, em 2 carreiras.');

    const empty = summarize([], SMALL).events;
    expect(empty).toMatchObject({
      all: { rounds: 0, cards: 0, perRound: 0, starts: 0, perStart: 0 },
      bySeason: [],
      cards: 0,
      others: 0,
      chainsStartedPerCareer: 0,
      unlocks: 0,
      unlocksPerCareer: 0,
      sponsorOffers: 0,
      sponsorOffersPerCareer: 0,
      sponsorProfiles: 0,
      repeats: { story: 0, storyCareers: 0, all: 0, allCareers: 0, examples: [] },
    });
    expect(empty.byCategory.every((c) => c.cards === 0 && c.share === 0)).toBe(true);
    expect(empty.chains.every((c) => c.started === 0 && c.done === 0)).toBe(true);
    expect(empty.byUnlock.every((u) => u.times === 0 && u.careers === 0)).toBe(true);
    const section = formatReport(summarize([], SMALL)).split('10. EVENTOS')[1] ?? '';
    expect(section).toContain('Cartões da Fase 5: 0 (- por etapa disputada; - no começo de cada temporada, da segunda em diante).');
    expect(section).toContain('Textos repetidos na mesma carreira, só nos cartões da Fase 5: 0 (em 0 de 0 carreiras).');
    expect(section).toMatch(/Pista +0 +-/);
    expect(section).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('eventos em carreiras de verdade (Fase 5)', () => {
  const card = (id: string, definitionId: string, title: string, label: string, outcome: string): PendingEvent => ({
    id,
    definitionId,
    category: definitionId.startsWith('story:') ? 'track' : 'family',
    season: 1,
    round: 1,
    title,
    body: `Corpo do cartão ${id}.`,
    choices: [{ id: 'a', label, description: '', outcomes: [{ probability: 1, text: outcome, effects: [] }] }],
  });

  it('acompanhar os cartões não muda a carreira, e o que ele vê é o que fica no registro', () => {
    const watch = watchEvents();
    let watched = createSimCareer(11);
    let plain = watched;
    const seen: PendingEvent[] = [];
    for (let round = 0; round < 4; round++) {
      const before = structuredClone(watched);
      seen.push(...watch.look(watched));
      expect(watched).toEqual(before);
      watched = playRound(watched, SIM_CHOICES);
      plain = playRound(plain, SIM_CHOICES);
    }
    seen.push(...watch.look(watched));
    expect(watched).toEqual(plain);
    // Cada cartão conta uma vez: ler de novo não acha nada novo.
    expect(watch.look(watched)).toEqual([]);
    // O que ele viu é o que o registro guarda (os cartões já respondidos) mais os que ainda esperam resposta.
    const ids = (events: readonly { id: string }[]) => events.map((e) => e.id).sort();
    expect(ids(seen)).toEqual(ids([...watched.eventLog, ...watched.pendingEvents]));
    expect(seen.some((e) => e.definitionId.startsWith('story:'))).toBe(true);
    // A temporada tem uma posição por etapa disputada e soma todos os cartões vistos.
    const sample = watch.closeSeason(watched);
    expect(sample.perRound).toHaveLength(4);
    for (const n of sample.perRound) expect(n).toBeLessThanOrEqual(3);
    expect(total(sample.perRound) + sample.seasonStart + sample.others).toBe(seen.length);
    expect(total(Object.values(sample.byCategory))).toBe(total(sample.perRound) + sample.seasonStart);
  });

  it('conta os textos repetidos da carreira: só os da Fase 5 e todos os eventos', () => {
    const career = createSimCareer(11);
    const watch = watchEvents();
    const long = `Um texto comprido que passa do limite do relatório e precisa ser cortado ${'de novo '.repeat(6)}`;
    watch.look({
      ...career,
      pendingEvents: [card('e1', 'story:um', 'Título um', 'Aceitar', 'Deu certo.'), card('e2', 'family-partner', 'Família', 'Aceitar', long)],
    });
    // O mesmo cartão lido de novo não conta outra vez.
    watch.look({ ...career, pendingEvents: [card('e1', 'story:um', 'Título um', 'Aceitar', 'Deu certo.')] });
    expect(watch.texts()).toEqual({ story: 0, all: 1, repeated: [{ text: 'Aceitar', times: 2, story: 1, events: ['story:um', 'family-partner'] }] });
    watch.look({
      ...career,
      pendingEvents: [card('e3', 'story:dois', 'Título dois', 'Aceitar', 'Deu certo.'), card('e4', 'birth-move', 'Mudança', 'Ficar', long)],
    });
    const texts = watch.texts();
    expect(texts).toMatchObject({ story: 2, all: 3 });
    // O texto comprido aparece cortado, com reticências.
    const cut = texts.repeated.find((r) => r.events.includes('birth-move'));
    expect(cut).toMatchObject({ times: 2, story: 0, events: ['family-partner', 'birth-move'] });
    expect(cut?.text.length).toBeLessThanOrEqual(60);
    expect(cut?.text.endsWith('…')).toBe(true);
    // Os cartões da Fase 5 contam na etapa em que nasceram; os de família e a mudança ficam à parte.
    expect(watch.closeSeason(career)).toMatchObject({ perRound: [2], seasonStart: 0, others: 2, byCategory: { track: 2 } });
    expect(watch.closeSeason(career)).toEqual(emptyEventSample());
  });

  it('cada temporada da amostra traz os cartões de cada etapa, e a soma bate com o resumo', () => {
    for (const season of small.samples.flatMap((c) => c.seasons)) {
      // Uma posição por etapa disputada: as corridas do piloto mais as etapas em que ele não correu.
      expect(season.events.perRound).toHaveLength(season.races.length + season.roundsMissed);
      for (const n of season.events.perRound) expect(n).toBeLessThanOrEqual(3);
      expect(total(Object.values(season.events.byCategory))).toBe(total(season.events.perRound) + season.events.seasonStart);
      // A temporada de estreia não tem começo: a carreira já nasce nela.
      if (season.season === 1) expect(season.events.seasonStart).toBe(0);
    }
    const { events } = small.summary;
    expect(events.all.cards).toBeGreaterThan(0);
    expect(events.all.zero + events.all.one + events.all.two + events.all.three + events.all.more).toBe(events.all.rounds);
    expect(total(events.byCategory.map((c) => c.cards))).toBe(events.cards);
    expect(total(events.bySeason.map((s) => s.rounds))).toBe(events.all.rounds);
  });

  // Critério de aceite da Fase 5: nenhum texto se repete numa carreira de 15 temporadas.
  it('em 15 temporadas, nenhum texto de evento se repete na mesma carreira', () => {
    for (const sample of runSimulation({ seeds: 2, seasons: 15, firstSeed: 1, talent: 0 }).samples) {
      expect(sample.seasons, `semente ${sample.seed}`).toHaveLength(15);
      expect(sample.texts, `semente ${sample.seed}`).toEqual(NO_REPEATS);
    }
  });
});

describe('uma carreira de verdade que fica sem vaga por dinheiro', () => {
  // A semente 38 chega ao fim da segunda temporada em 20º, com proposta de equipe e sem caixa para
  // bancá-la, e nenhuma porta se abre: nem academia, nem vaquinha, nem investidor. (Até a Fase 3 o
  // exemplo era a semente 11; com a curva de pneus e os lances da Fase 4 as corridas dela mudaram.)
  const sample = simulateCareer(38, { seasons: 3, talent: 0 });

  it('a temporada seguinte é disputada pela vaga de aluguel, com o motivo "dinheiro"', () => {
    expect(sample.seasons[2]).toMatchObject({ season: 3, seat: 'fallback', noSeatCause: 'money', door: 'none' });
    // Havia proposta de equipe, e nenhuma que ele pudesse aceitar por porta nenhuma.
    expect(sample.seasons[1]?.offersMade).toBeGreaterThan(0);
    expect(sample.seasons[1]?.offers).toBe(0);
    expect(sample.seasons[1]?.doorOpen).toBe(false);
    expect(sample.seasons[1]?.position).toBe(20);
    expect(summarize([sample], { seeds: 1, seasons: 3, firstSeed: 38, talent: 0 }).noSeat).toMatchObject({ money: 1, noOffer: 0, requirements: 0 });
  });
});

describe('relatório', () => {
  const report = formatReport(small.summary);

  it('traz as seis medidas pedidas e as seções das fases seguintes', () => {
    for (const title of [
      '1. POSIÇÃO FINAL POR CATEGORIA',
      '2. CAIXA NO FIM DE CADA TEMPORADA',
      '3. IDADE AO CHEGAR A CADA DEGRAU',
      '4. CARREIRAS QUE CHEGAM AO TOPO',
      '5. TÍTULOS POR CARREIRA',
      '6. TEMPORADAS PARADAS, SEM VAGA',
      '7. NASCIMENTO',
      '8. ECONOMIA E PORTAS',
      '9. LANCES DECISIVOS',
      '10. EVENTOS',
    ]) {
      expect(report).toContain(title);
    }
    expect(report).toMatch(
      /Por quê: em \d+, nenhuma equipe fez proposta; em \d+, havia proposta e faltou dinheiro para a vaga; em \d+, faltou outro requisito\./,
    );
    expect(report).toContain('4 carreiras (sementes 11 a 14), 3 temporadas cada');
    expect(report).toContain('Campeonato Regional de Kart');
    expect(report).toContain('Chegaram ao Grand Prix Mundial: 0 de 4 carreiras (0%).');
    expect(report).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('é idêntico em duas execuções com os mesmos argumentos (sem data nem duração)', () => {
    expect(formatReport(runSimulation(SMALL).summary)).toBe(report);
  });
});

describe('linha de comando', () => {
  const run = (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(argv, { out: (text) => out.push(text), err: (text) => err.push(text) });
    return { code, out: out.join(''), err: err.join('') };
  };

  it('--help mostra a ajuda e não simula nada', () => {
    expect(run(['--help'])).toEqual({ code: 0, out: HELP, err: '' });
  });

  it('uma falha do motor sai com código 1 e a mensagem com a semente, sem relatório', () => {
    const out: string[] = [];
    const err: string[] = [];
    const broken = () => simulateCareer(-1, { seasons: 1, talent: 0 }) as never;
    const code = runCli(['--seeds', '1', '--seasons', '1'], { out: (text) => out.push(text), err: (text) => err.push(text) }, broken);
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err.join('')).toMatch(/A carreira da semente -1 falhou na temporada 1/);
  });

  it('um argumento inválido sai com erro e a explicação, sem relatório', () => {
    const result = run(['--seeds', 'x']);
    expect(result.code).toBe(2);
    expect(result.out).toBe('');
    expect(result.err).toMatch(/--seeds precisa ser um número inteiro/);
  });

  it('o relatório vai para a saída padrão; o progresso e o tempo, para a saída de erro', () => {
    const result = run(['--seeds', '4', '--seasons', '3', '--first-seed', '11']);
    expect(result.code).toBe(0);
    expect(result.out).toBe(formatReport(small.summary));
    expect(result.err).toMatch(/4\/4 carreiras/);
    expect(result.err).toMatch(/4 carreiras, \d+ temporadas em \d+,\d s · jogo .+, save v\d+/);
    // A versão do jogo e a do save ficam fora do relatório, para ele só mudar quando uma regra mudar.
    expect(result.out).not.toMatch(/save v\d|jogo \d/i);
  });

  it('--moments troca a política de lances do robô e aparece na linha da política; o padrão não muda de texto', () => {
    const bold = run(['--seeds', '1', '--seasons', '1', '--first-seed', '11', '--moments', 'bold']);
    expect(bold.code).toBe(0);
    expect(bold.out).toContain('melhor proposta aceitável) · talento 0 · lances: sempre a opção mais arriscada\n');
    expect(bold.out).toContain('Nesta execução o robô responde a todos, sempre com a opção mais arriscada');
    const safe = run(['--seeds', '1', '--seasons', '1', '--first-seed', '11', '--moments=safe']);
    expect(safe.out).toContain('· talento 0 · lances: sempre a opção mais segura\n');
    const standard = run(['--seeds', '1', '--seasons', '1', '--first-seed', '11']);
    expect(run(['--seeds', '1', '--seasons', '1', '--first-seed', '11', '--moments', 'style']).out).toBe(standard.out);
    expect(standard.out).toContain('melhor proposta aceitável) · talento 0\n');
    expect(standard.out).toContain('O robô não responde a nenhum: quem escolhe a opção é o estilo do piloto');
    expect(new Set([standard.out, bold.out, safe.out]).size).toBe(3);
    expect(HELP).toContain('--moments P');
    expect(run(['--moments', 'ousado'])).toMatchObject({ code: 2, out: '' });
  });

  it('um arquivo de saída em que não dá para gravar é recusado antes de simular', () => {
    const never = () => {
      throw new Error('não era para simular');
    };
    const folder = mkdtempSync(join(tmpdir(), 'sim-'));
    for (const out of [join(folder, 'pasta-que-nao-existe', 'relatorio.txt'), folder]) {
      const err: string[] = [];
      const code = runCli(['--seeds', '1', '--seasons', '1', '--out', out], { out: () => {}, err: (text) => err.push(text) }, never);
      expect(code, out).toBe(2);
      expect(err.join(''), out).toMatch(/^Não dá para gravar em /);
    }
  });

  it('--json escreve os dados completos e --out grava a saída num arquivo', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'sim-')), 'dados.json');
    const result = run(['--seeds', '2', '--seasons', '2', '--json', '--out', file]);
    const data = JSON.parse(result.out) as SimResult;
    expect(data.samples).toHaveLength(2);
    expect(data.summary.options).toEqual({ seeds: 2, seasons: 2, firstSeed: 1, talent: 0, moments: 'style' });
    // Os dados completos trazem os lances de cada corrida, com a chance mostrada.
    expect(data.samples[0]?.seasons[0]?.races[0]?.moments[0]).toMatchObject({ kind: 'start', chance: expect.any(Number) });
    expect(readFileSync(file, 'utf8')).toBe(result.out);
    expect(result.err).toContain(`gravado em ${file}`);
  });
});
