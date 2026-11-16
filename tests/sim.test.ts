/** Simulador sem interface (`npm run sim`): argumentos, coleta, agregados e relatório. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYER_BACKGROUNDS, PLAYER_MAX_AGE, PLAYER_MIN_AGE } from '@/data/rules';
import { ROOKIE_TEAM_IDS } from '@/data/teams';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { HELP, parseArgs, runCli } from '../sim/cli';
import { formatReport } from '../sim/report';
import { DEFAULT_SIM_OPTIONS, type SimResult, createSimCareer, percentile, profileForSeed, runSimulation, simulateCareer, summarize } from '../sim/run';

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
    // A amostra cobre todos os começos possíveis: os três perfis, as três equipes de entrada e todas as idades.
    expect(new Set(profiles.map((p) => p.background)).size).toBe(PLAYER_BACKGROUNDS.length);
    expect(new Set(profiles.map((p) => p.teamId)).size).toBe(ROOKIE_TEAM_IDS.length);
    expect(new Set(profiles.map((p) => p.age)).size).toBe(PLAYER_MAX_AGE - PLAYER_MIN_AGE + 1);
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
    expect(summarize([], SMALL)).toMatchObject({ careers: 0, seasonsPlayed: 0, noSeat: { seasons: 0, share: 0 }, titles: { perCareer: 0, max: 0 } });
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
    ]) {
      expect(report).toContain(title);
    }
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
    expect(result.err).toMatch(/4 carreiras, \d+ temporadas em \d+,\d s/);
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
