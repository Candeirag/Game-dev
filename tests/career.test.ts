import { describe, expect, it } from 'vitest';
import { CareerStateSchema, type Driver } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import {
  applyAging,
  computeCareerStats,
  createCareer,
  developDriver,
  driverStandings,
  getPlayer,
  getRaceDrivers,
  isSeasonComplete,
  netWorth,
  setTrainingFocus,
  startNextSeason,
  startWeekend,
  teamStandings,
  validateNewCareerInput,
} from './engineApi';
import { DEFAULT_INPUT, NOW, newCareer, pickBestOffer, playRound, playSeason } from './helpers';

describe('criação de carreira', () => {
  it('cria um campeonato com 10 equipes, 20 titulares, 10 reservas e 10 etapas', () => {
    const c = newCareer();
    expect(c.categoryId).toBe('kart-regional');
    expect(c.teams).toHaveLength(10);
    expect(getRaceDrivers(c)).toHaveLength(20);
    expect(c.drivers.filter((d) => d.role === 'reserve')).toHaveLength(10);
    expect(c.calendar).toHaveLength(10);
    expect(CareerStateSchema.safeParse(c).success).toBe(true);
    expect(validateCareerIntegrity(c)).toEqual([]);
  });

  it('o jogador ocupa a vaga de estreante, e quem a cede vira reserva', () => {
    const c = newCareer();
    const p = getPlayer(c);
    expect(p.teamId).toBe('cerrado');
    expect(p.role).toBe('second');
    expect(c.drivers.find((d) => d.id === 'teixeira')).toMatchObject({ teamId: 'cerrado', role: 'reserve' });
    expect(p.attributes.pace).toBe(70 + 4);
  });

  it('começa com contrato, caixa, apoio da família e licença vazia', () => {
    const c = newCareer();
    expect(c.contract).toMatchObject({ teamId: 'cerrado', categoryId: 'kart-regional', role: 'second', endSeason: 1, salary: 0 });
    expect(c.contract.seatCost).toBeGreaterThan(0);
    expect(c.finance.cash).toBeGreaterThan(0);
    expect(c.sponsors.map((s) => s.id)).toEqual(['family']);
    expect(c.license).toEqual({ history: [], penaltyPoints: 0, banRounds: 0 });
    expect(Object.keys(c.marketInterest).length).toBe(20);
  });

  it('valida a criação do piloto', () => {
    expect(validateNewCareerInput(DEFAULT_INPUT)).toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, teamId: 'vortex' })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, bonus: { pace: 5 } })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, bonus: { pace: 4, focus: 4, consistency: 1 } })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, bonus: { experience: 2 } })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, age: 30 })).not.toEqual([]);
    expect(() => createCareer({ ...DEFAULT_INPUT, firstName: ' ' }, 1, NOW)).toThrow();
  });
});

describe('evolução e envelhecimento', () => {
  it('o foco de treino direciona o ganho e nunca passa do potencial', () => {
    const p = getPlayer(newCareer());
    const speed = developDriver({ ...p, trainingFocus: 'speed' }, 1).delta;
    const wet = developDriver({ ...p, trainingFocus: 'wet' }, 1).delta;
    expect(speed.pace!).toBeGreaterThan(wet.pace!);
    expect(wet.wetSkill!).toBeGreaterThan(speed.wetSkill!);
    let d: Driver = { ...p, trainingFocus: 'speed' };
    for (let i = 0; i < 200; i++) d = developDriver(d, i).driver;
    expect(d.attributes.pace).toBeLessThanOrEqual(d.potential);
    expect(d.attributes.experience).toBeLessThanOrEqual(100);
  });

  it('jovens evoluem mais rápido; intensidade e moral multiplicam o ganho', () => {
    const p = getPlayer(newCareer());
    const gain = (age: number, multiplier = 1) => developDriver({ ...p, age, trainingFocus: 'speed' }, 3, 1, multiplier).delta.pace!;
    expect(gain(15)).toBeGreaterThan(gain(26));
    expect(gain(15, 1.4)).toBeGreaterThan(gain(15));
    expect(gain(15, 0.6)).toBeLessThan(gain(15));
  });

  it('a partir dos 31 anos a velocidade cai; antes disso, não', () => {
    const p = getPlayer(newCareer());
    expect(applyAging({ ...p, age: 28 }, 1)).toEqual({ ...p, age: 28 });
    const old = applyAging({ ...p, age: 36 }, 1);
    expect(old.attributes.pace).toBeLessThan(p.attributes.pace);
    expect(old.attributes.racecraft).toBe(p.attributes.racecraft);
    expect(old.attributes.experience).toBe(p.attributes.experience);
    expect(old.potential).toBeLessThan(p.potential);
    const loss = (age: number) => p.attributes.pace - applyAging({ ...p, age }, 1).attributes.pace;
    expect(loss(38)).toBeGreaterThan(loss(32));
  });
});

describe('temporada completa', () => {
  const season = playSeason(setTrainingFocus(newCareer(777), 'speed'));

  it('disputa as 10 etapas, fecha a temporada e mantém a integridade', () => {
    expect(season.rounds).toHaveLength(10);
    expect(isSeasonComplete(season)).toBe(true);
    expect(season.offseason).not.toBeNull();
    expect(validateCareerIntegrity(season)).toEqual([]);
    expect(CareerStateSchema.safeParse(season).success).toBe(true);
    expect(() => startWeekend(season)).toThrow();
  });

  it('a soma dos pontos dos pilotos é igual à soma dos pontos das equipes', () => {
    const drivers = driverStandings(season).reduce((s, d) => s + d.points, 0);
    const teams = teamStandings(season).reduce((s, t) => s + t.points, 0);
    expect(drivers).toBe(teams);
    expect(drivers).toBeGreaterThan(10 * 90);
  });

  it('o jogador evolui ao longo da temporada', () => {
    const p = getPlayer(season);
    expect(p.attributes.pace).toBeGreaterThan(season.playerSeasonStartAttributes.pace);
    expect(p.attributes.experience).toBeGreaterThan(season.playerSeasonStartAttributes.experience);
  });

  it('as estatísticas de carreira batem com a classificação', () => {
    const stats = computeCareerStats(season, 'player');
    const standing = driverStandings(season).find((s) => s.driverId === 'player')!;
    expect(stats.starts).toBe(standing.results.filter((r) => r !== null).length);
    expect(stats.points).toBe(standing.results.reduce((s, r) => s + (r?.points ?? 0), 0));
    expect(stats.wins).toBe(standing.wins);
  });

  it('gera mensagens de corrida, equipe, treino e temporada', () => {
    for (const category of ['race', 'team', 'training', 'season'] as const) expect(season.inbox.some((m) => m.category === category)).toBe(true);
  });

  it('o fechamento registra licença, reputação, contas do ano e propostas', () => {
    const o = season.offseason!;
    const standing = driverStandings(season).find((s) => s.driverId === 'player')!;
    expect(o.playerPosition).toBe(standing.position);
    expect(season.reputation).toBe(o.reputationAfter);
    expect(season.license.history).toEqual([{ season: 1, categoryId: 'kart-regional', position: o.playerPosition, points: o.licensePointsEarned }]);
    expect(season.finance.reports).toHaveLength(1);
    expect(season.finance.reports[0]!.netWorthEnd).toBe(netWorth(season.finance));
    expect(season.finance.seasonTotals).toEqual({});
    expect(o.contractStatus).toBe('expired');
    expect(o.offers.some((x) => x.kind === 'fallback')).toBe(true);
  });

  it('inicia a temporada seguinte: contrato novo, ano novo, todos mais velhos', () => {
    const offerId = pickBestOffer(season);
    const offer = season.offseason!.offers.find((o) => o.id === offerId)!;
    const next = startNextSeason(season, offerId);
    expect(next.season).toBe(2);
    expect(next.year).toBe(season.year + 1);
    expect(next.rounds).toEqual([]);
    expect(next.offseason).toBeNull();
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ categoryId: 'kart-regional', playerPosition: season.offseason!.playerPosition });
    expect(getPlayer(next).teamId).toBe(offer.teamId);
    expect(next.contract.teamId).toBe(offer.teamId);
    expect(next.contract.startSeason).toBe(2);
    expect(getPlayer(next).age).toBe(getPlayer(season).age + 1);
    expect(next.license.penaltyPoints).toBe(0);
    expect(validateCareerIntegrity(next)).toEqual([]);
    expect(CareerStateSchema.safeParse(next).success).toBe(true);
    expect(() => startNextSeason(season, 'proposta-inexistente')).toThrow();
    // A segunda temporada também pode ser jogada.
    const round1 = playRound(next);
    expect(round1.rounds).toHaveLength(1);
    expect(computeCareerStats(round1, 'player').starts).toBeGreaterThanOrEqual(10);
  });
});
