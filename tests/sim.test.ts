/** Simulador sem interface (`npm run sim`): argumentos, coleta, agregados e relatório. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { PLAYER_BACKGROUNDS, PLAYER_MAX_AGE, PLAYER_MIN_AGE } from '@/data/rules';
import { ROOKIE_TEAM_IDS } from '@/data/teams';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { HELP, parseArgs, runCli } from '../sim/cli';
import { formatReport } from '../sim/report';
import {
  type CareerSample,
  DEFAULT_SIM_OPTIONS,
  birthTerciles,
  SIM_POPULATION,
  type SeasonSample,
  type SimResult,
  createSimCareer,
  percentile,
  profileForSeed,
  runSimulation,
  simulateCareer,
  summarize,
} from '../sim/run';

const SMALL = { seeds: 4, seasons: 3, firstSeed: 11, talent: 0 };
const small: SimResult = runSimulation(SMALL);

describe('argumentos da linha de comando', () => {
  it('sem argumentos, vale o padrão: 50 carreiras de 15 temporadas', () => {
    expect(parseArgs([])).toEqual({ seeds: 50, seasons: 15, firstSeed: 1, talent: 0, json: false, out: null, help: false });
    expect(DEFAULT_SIM_OPTIONS).toEqual({ seeds: 50, seasons: 15, firstSeed: 1, talent: 0 });
  });

  it('lê cada opção, com espaço ou com sinal de igual', () => {
    expect(parseArgs(['--seeds', '8', '--seasons', '20', '--first-seed', '100', '--talent', '4', '--json', '--out', 'relatorio.txt'])).toEqual({
      seeds: 8,
      seasons: 20,
      firstSeed: 100,
      talent: 4,
      json: true,
      out: 'relatorio.txt',
      help: false,
    });
    expect(parseArgs(['--seeds=3', '--seasons=2'])).toMatchObject({ seeds: 3, seasons: 2 });
    expect(parseArgs(['--help']).help).toBe(true);
  });

  it('recusa o que não entende, explicando o motivo', () => {
    expect(() => parseArgs(['--sementes', '5'])).toThrow(/Opção desconhecida: --sementes/);
    expect(() => parseArgs(['--seeds'])).toThrow(/Falta o valor de --seeds/);
    expect(() => parseArgs(['--seeds', 'muitas'])).toThrow(/número inteiro de 1 a 5000/);
    expect(() => parseArgs(['--seeds', '0'])).toThrow(/número inteiro/);
    expect(() => parseArgs(['--seasons', '2.5'])).toThrow(/número inteiro de 1 a 80/);
    expect(() => parseArgs(['--talent', '99'])).toThrow(/de 0 a 12/);
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
    ...extra,
  });
  const profile = { background: 'natural', age: 16, teamId: 'horizonte' } as const;
  // A: sobe do 1º ao 2º degrau, pula o 3º pelo atalho, cai nele pela rede de segurança (faltou dinheiro) e volta ao 4º.
  const a: CareerSample = {
    seed: 1,
    profile,
    birth: { score: 60, region: 'capital', traitBalance: 1 },
    ended: 'completed',
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

describe('uma carreira de verdade que fica sem vaga por dinheiro', () => {
  // A semente 11 chega ao fim da segunda temporada em 20º, com proposta de equipe e sem caixa para
  // bancá-la, e nenhuma porta se abre: nem academia, nem vaquinha, nem investidor.
  const sample = simulateCareer(11, { seasons: 3, talent: 0 });

  it('a temporada seguinte é disputada pela vaga de aluguel, com o motivo "dinheiro"', () => {
    expect(sample.seasons[2]).toMatchObject({ season: 3, seat: 'fallback', noSeatCause: 'money', door: 'none' });
    // Havia proposta de equipe, e nenhuma que ele pudesse aceitar por porta nenhuma.
    expect(sample.seasons[1]?.offersMade).toBeGreaterThan(0);
    expect(sample.seasons[1]?.offers).toBe(0);
    expect(sample.seasons[1]?.doorOpen).toBe(false);
    expect(summarize([sample], { seeds: 1, seasons: 3, firstSeed: 11, talent: 0 }).noSeat).toMatchObject({ money: 1, noOffer: 0, requirements: 0 });
  });
});

describe('relatório', () => {
  const report = formatReport(small.summary);

  it('traz as seis medidas pedidas', () => {
    for (const title of [
      '1. POSIÇÃO FINAL POR CATEGORIA',
      '2. CAIXA NO FIM DE CADA TEMPORADA',
      '3. IDADE AO CHEGAR A CADA DEGRAU',
      '4. CARREIRAS QUE CHEGAM AO TOPO',
      '5. TÍTULOS POR CARREIRA',
      '6. TEMPORADAS PARADAS, SEM VAGA',
      '7. NASCIMENTO',
      '8. ECONOMIA E PORTAS',
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
    expect(data.summary.options).toEqual({ seeds: 2, seasons: 2, firstSeed: 1, talent: 0 });
    expect(readFileSync(file, 'utf8')).toBe(result.out);
    expect(result.err).toContain(`gravado em ${file}`);
  });
});
