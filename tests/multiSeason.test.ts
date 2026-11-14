/**
 * Simulações de várias temporadas, com um robô no lugar do jogador. Validam
 * que todos os sistemas funcionam juntos por muitos anos sem corromper o
 * estado, e que o equilíbrio geral fica dentro de faixas saudáveis.
 */
import { describe, expect, it } from 'vitest';
import { CareerStateSchema, type CareerState } from '@/domain/schemas';
import { CATEGORIES } from '@/data/categories';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { checksumOf } from '@/persistence/checksum';
import { driverStandings, getCategory, getPlayer, getRaceDrivers, netWorth, overallRating, teamStandings } from './engineApi';
import { botCareer, playCareer } from './helpers';

interface SeasonLog {
  season: number;
  tier: number;
  position: number;
  overall: number;
  age: number;
  netWorth: number;
  reputation: number;
}

function simulate(seed: number, talent: number, seasons: number, check: (c: CareerState) => void = () => {}): { final: CareerState; log: SeasonLog[] } {
  const log: SeasonLog[] = [];
  const final = playCareer(botCareer(seed, talent), seasons, { approach: 'attack' }, (c) => {
    check(c);
    const p = getPlayer(c);
    log.push({
      season: c.season,
      tier: getCategory(c.categoryId).tier,
      position: c.offseason!.playerPosition,
      overall: overallRating(p.attributes),
      age: p.age,
      netWorth: netWorth(c.finance),
      reputation: c.reputation,
    });
  });
  return { final, log };
}

describe('várias temporadas', () => {
  it('doze temporadas mantêm o save válido e íntegro em todos os fechamentos', () => {
    for (const [seed, talent] of [
      [11, 0],
      [12, 4],
      [13, 8],
    ] as const) {
      const { final } = simulate(seed, talent, 12, (c) => {
        expect(validateCareerIntegrity(c)).toEqual([]);
        const parsed = CareerStateSchema.safeParse(c);
        expect(parsed.success ? [] : parsed.error.issues.slice(0, 3)).toEqual([]);
        // Classificação coerente: pilotos e equipes somam os mesmos pontos.
        expect(driverStandings(c).reduce((s, d) => s + d.points, 0)).toBe(teamStandings(c).reduce((s, t) => s + t.points, 0));
        expect(getRaceDrivers(c)).toHaveLength(20);
      });
      expect(final.season).toBe(13);
      expect(final.history).toHaveLength(12);
      expect(validateCareerIntegrity(final)).toEqual([]);
    }
  }, 300_000);

  it('a carreira é determinística: mesma semente e mesmas decisões, mesmo resultado', () => {
    const a = simulate(21, 4, 4).final;
    const b = simulate(21, 4, 4).final;
    expect(checksumOf(a)).toBe(checksumOf(b));
  }, 120_000);

  it('o talento decide até onde a carreira vai', () => {
    const reach = (talent: number) => {
      const tiers = [31, 32, 33, 34].map((seed) => Math.max(...simulate(seed, talent, 14).log.map((l) => l.tier)));
      return tiers.reduce((a, b) => a + b, 0) / tiers.length;
    };
    const average = reach(0);
    const star = reach(8);
    // O robô mediano sai do kart, mas não domina; o talentoso chega às categorias de cima.
    expect(average).toBeGreaterThanOrEqual(3);
    expect(star).toBeGreaterThanOrEqual(6);
    expect(star).toBeGreaterThan(average);
  }, 600_000);

  it('o piloto evolui, envelhece e as finanças não saem de controle', () => {
    const { log, final } = simulate(41, 6, 14);
    const first = log[0]!;
    const last = log[log.length - 1]!;
    expect(last.age).toBe(first.age + 13);
    expect(last.overall).toBeGreaterThan(first.overall + 12);
    for (const l of log) {
      const category = CATEGORIES.find((c) => c.tier === l.tier)!;
      // A dívida nunca passa muito do custo de uma vaga da categoria (o acordo com credores a limita).
      const floor = -Math.max(category.economy.seatCost[0], 400_000) * 1.6;
      expect(l.netWorth).toBeGreaterThan(floor);
      expect(l.reputation).toBeGreaterThanOrEqual(0);
      expect(l.reputation).toBeLessThanOrEqual(100);
    }
    expect(final.finance.reports.length).toBeGreaterThan(0);
  }, 300_000);

  it('os grids das categorias ficam perto do nível projetado ao longo dos anos', () => {
    const drift: number[] = [];
    simulate(51, 8, 12, (c) => {
      const category = getCategory(c.categoryId);
      const ai = getRaceDrivers(c)
        .filter((d) => !d.isPlayer)
        .map((d) => overallRating(d.attributes));
      drift.push(ai.reduce((a, b) => a + b, 0) / ai.length - category.field.driverLevel);
    });
    // A IA evolui durante a temporada, mas o grid não infla sem limite nem desaba.
    expect(Math.min(...drift)).toBeGreaterThan(-4);
    expect(Math.max(...drift)).toBeLessThan(7);
  }, 300_000);
});
