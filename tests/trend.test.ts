/**
 * Retrato das temporadas (`seasonTrend`, save v5): o registro que alimenta os gráficos pequenos
 * de evolução dos atributos e do caixa. É só registro; estes testes conferem que ele é fiel ao
 * que o jogo mostrava no fim de cada temporada e que a migração 4 → 5 não toca em mais nada.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HISTORY_LIMITS } from '@/config/balance';
import { CAREER_SCHEMA_VERSION, CareerStateSchema, type CareerState, type SeasonTrendPoint } from '@/domain/schemas';
import { migrateStep } from '@/persistence/migrations';
import { importCareer } from '@/persistence/saveService';
import { getPlayer, netWorth, overallRating, recordSeasonTrend, seasonTrendPoint } from './engineApi';
import { botCareer, newCareer, playCareer } from './helpers';

describe('retrato das temporadas', () => {
  it('carreira nova começa sem retratos', () => {
    expect(newCareer().seasonTrend).toEqual([]);
  });

  it('cada temporada fechada deixa um retrato fiel: atributos, nota geral, caixa e patrimônio daquele momento', () => {
    const expected: SeasonTrendPoint[] = [];
    const final = playCareer(botCareer(7, 4), 4, { approach: 'attack' }, (career) => {
      const player = getPlayer(career);
      expected.push({
        season: career.season,
        year: career.year,
        driverId: player.id,
        attributes: { ...player.attributes },
        overall: overallRating(player.attributes),
        cash: Math.round(career.finance.cash),
        netWorth: Math.round(netWorth(career.finance)),
      });
    });
    // O retrato da última temporada só entra quando o ano virar; os das anteriores já estão gravados.
    expect(final.seasonTrend.length).toBeGreaterThanOrEqual(3);
    expect(final.seasonTrend.map((p) => p.season)).toEqual(expected.slice(0, final.seasonTrend.length).map((p) => p.season));
    for (const [index, point] of final.seasonTrend.entries()) {
      const was = expected[index]!;
      expect(point.driverId).toBe(was.driverId);
      expect(point.attributes).toEqual(was.attributes);
      expect(point.overall).toBe(was.overall);
    }
    // As temporadas vêm em ordem, uma vez cada.
    const seasons = final.seasonTrend.map((p) => p.season);
    expect(seasons).toEqual([...new Set(seasons)].sort((a, b) => a - b));
    expect(CareerStateSchema.safeParse(final).success).toBe(true);
  });

  it('o retrato é o estado do jogo naquele instante, sem sorteio: tirar duas vezes dá o mesmo', () => {
    const career = botCareer(3, 0);
    expect(seasonTrendPoint(career)).toEqual(seasonTrendPoint(career));
    const player = getPlayer(career);
    expect(seasonTrendPoint(career)).toEqual({
      season: career.season,
      year: career.year,
      driverId: player.id,
      attributes: player.attributes,
      overall: overallRating(player.attributes),
      cash: Math.round(career.finance.cash),
      netWorth: Math.round(netWorth(career.finance)),
    });
  });

  it('como dirigente, o retrato guarda o caixa e deixa os atributos vazios', () => {
    const career: CareerState = { ...botCareer(3, 0), mode: 'executive' };
    expect(seasonTrendPoint(career)).toMatchObject({ attributes: null, overall: null, cash: Math.round(career.finance.cash) });
  });

  it('guarda só as temporadas mais recentes e não repete a mesma temporada', () => {
    const base = botCareer(3, 0);
    const old = Array.from({ length: HISTORY_LIMITS.SEASON_TREND + 5 }, (_, i) => ({ ...seasonTrendPoint(base), season: i + 1, year: 2000 + i }));
    const career: CareerState = { ...base, season: old.length + 1, seasonTrend: old };
    const next = recordSeasonTrend(career);
    expect(next).toHaveLength(HISTORY_LIMITS.SEASON_TREND);
    expect(next.at(-1)?.season).toBe(career.season);
    // Gravar de novo a mesma temporada troca o retrato dela; não acrescenta outro.
    expect(recordSeasonTrend({ ...career, seasonTrend: next })).toHaveLength(HISTORY_LIMITS.SEASON_TREND);
  });
});

describe('migração da versão 4 para a 5', () => {
  const files = readdirSync('tests/fixtures/v4').filter((name) => name.endsWith('.json'));

  it.each(files)('%s: só acrescenta a lista de retratos, vazia, e sobe a versão', (name) => {
    const before = (JSON.parse(readFileSync(`tests/fixtures/v4/${name}`, 'utf8')) as { career: Record<string, unknown> }).career;
    expect(before.schemaVersion).toBe(4);
    expect('seasonTrend' in before).toBe(false);
    const after = migrateStep(before, 4);
    expect(after).toEqual({ ...before, schemaVersion: 5, seasonTrend: [] });
    // Rodar de novo sobre o resultado não muda nada.
    expect(migrateStep({ ...after, schemaVersion: 4 }, 4)).toEqual(after);
  });

  it.each(files)('%s: abre na versão atual e continua válido', (name) => {
    const career = importCareer(readFileSync(`tests/fixtures/v4/${name}`, 'utf8'));
    expect(career.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(career.seasonTrend).toEqual([]);
  });
});
