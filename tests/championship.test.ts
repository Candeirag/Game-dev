import { describe, expect, it } from 'vitest';
import type { RaceEntryResult, RoundRecord } from '@/domain/schemas';
import { TEAMS } from '@/data/teams';
import { getCategory } from '@/data/categories';
import { computeDriverStandings, computeTeamStandings, pointsFor as pointsForRules } from '@/engine';

const KART = getCategory('kart-regional');
const F1 = getCategory('f1');
const pointsFor = (e: Omit<RaceEntryResult, 'points'>, fastest: string | null) => pointsForRules(e, fastest, KART);

const entry = (driverId: string, teamId: string, position: number, grid: number, status: 'finished' | 'dnf' = 'finished'): Omit<RaceEntryResult, 'points'> => ({
  driverId,
  teamId,
  position,
  grid,
  status,
  lapsCompleted: 20,
  totalTime: 1000 + position,
  bestLap: 50,
  overtakes: 0,
  errors: 0,
  pitStops: 0,
  penaltySeconds: 0,
  penaltyPoints: 0,
  damage: 0,
  injured: false,
});

describe('pontuação', () => {
  it('segue a tabela 25-18-15-12-10-8-6-4-2-1', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((p) => pointsFor(entry('x', 't', p, 5), null))).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0]);
  });

  it('dá +1 pela pole, mesmo com abandono', () => {
    expect(pointsFor(entry('x', 't', 1, 1), null)).toBe(26);
    expect(pointsFor(entry('x', 't', 20, 1, 'dnf'), null)).toBe(1);
  });

  it('dá +1 pela volta mais rápida só para quem terminou', () => {
    expect(pointsFor(entry('x', 't', 12, 5), 'x')).toBe(1);
    expect(pointsFor(entry('x', 't', 20, 5, 'dnf'), 'x')).toBe(0);
  });

  it('cada categoria aplica as próprias regras de bônus', () => {
    // F1: sem ponto de pole; a volta mais rápida só vale para quem chega entre os dez primeiros.
    expect(pointsForRules(entry('x', 't', 1, 1), null, F1)).toBe(25);
    expect(pointsForRules(entry('x', 't', 10, 5), 'x', F1)).toBe(2);
    expect(pointsForRules(entry('x', 't', 12, 5), 'x', F1)).toBe(0);
    // F2: a pole vale 2 pontos.
    expect(pointsForRules(entry('x', 't', 1, 1), null, getCategory('f2'))).toBe(27);
  });
});

function round(n: number, results: [string, string, number, number][]): RoundRecord {
  const weather = { condition: 'dry' as const, wetness: 0, trackTemp: 30 };
  return {
    season: 1,
    round: n,
    trackId: 'vale-do-sol',
    date: '2027-03-08',
    practice: { weather, entries: [] },
    qualifying: { weather, entries: [] },
    race: {
      weather,
      totalLaps: 20,
      fastestLap: null,
      events: [],
      safetyCars: 0,
      virtualSafetyCars: 0,
      redFlags: 0,
      teamOrders: [],
      moments: [],
      entries: results.map(([d, t, pos, grid]) => ({ ...entry(d, t, pos, grid), points: pointsFor(entry(d, t, pos, grid), null) })),
    },
  };
}

describe('classificação do campeonato', () => {
  const rounds = [
    round(1, [
      ['a', 'vortex', 1, 2],
      ['b', 'trovao', 2, 1],
      ['c', 'vortex', 3, 3],
    ]),
    round(2, [
      ['b', 'trovao', 1, 2],
      ['a', 'vortex', 2, 1],
      ['c', 'vortex', 3, 3],
    ]),
  ];

  it('soma pontos e conta vitórias, pódios e poles', () => {
    const s = computeDriverStandings(rounds, []);
    const a = s.find((x) => x.driverId === 'a')!;
    expect(a.points).toBe(25 + 18 + 1);
    expect(a.wins).toBe(1);
    expect(a.podiums).toBe(2);
    expect(a.poles).toBe(1);
  });

  it('desempata por countback (mais vitórias, depois mais 2º lugares)', () => {
    // a e b: 44 pontos cada, 1 vitória e 1 segundo lugar cada. Empate total: ordem alfabética.
    const s = computeDriverStandings(rounds, []);
    expect(s.map((x) => x.driverId)).toEqual(['a', 'b', 'c']);
    const tie = computeDriverStandings(
      [
        round(1, [
          ['x', 'vortex', 1, 5],
          ['y', 'trovao', 3, 6],
        ]),
        round(2, [
          ['y', 'trovao', 2, 5],
          ['x', 'vortex', 9, 6],
        ]),
        round(3, [
          ['y', 'trovao', 2, 5],
          ['x', 'vortex', 10, 6],
        ]),
      ],
      [],
    );
    // x: 25+2+1 = 28; y: 15+18+18 = 51. Sem empate, y lidera.
    expect(tie[0]!.driverId).toBe('y');
  });

  it('ajustes de pontos (comissários, protestos) entram na classificação', () => {
    const adjusted = computeDriverStandings(rounds, [], [{ driverId: 'a', teamId: 'vortex', points: -30, reason: 'teste', round: 2 }]);
    expect(adjusted.find((x) => x.driverId === 'a')!.points).toBe(44 - 30);
    expect(adjusted[0]!.driverId).toBe('b');
    const teams = computeTeamStandings(rounds, TEAMS, [{ driverId: 'a', teamId: 'vortex', points: -30, reason: 'teste', round: 2 }]);
    expect(teams.find((x) => x.teamId === 'vortex')!.points).toBe(25 + 15 + 18 + 1 + 15 - 30);
  });

  it('a pontuação das equipes soma seus pilotos', () => {
    const t = computeTeamStandings(rounds, TEAMS);
    const vortex = t.find((x) => x.teamId === 'vortex')!;
    expect(vortex.points).toBe(25 + 15 + 18 + 1 + 15);
    expect(t[0]!.teamId).toBe('vortex');
    expect(t).toHaveLength(10);
  });
});
