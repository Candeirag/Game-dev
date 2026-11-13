import { describe, expect, it } from 'vitest';
import { CareerStateSchema, type Driver } from '@/domain/schemas';
import {
  computeCareerStats,
  computeSeasonOutcome,
  createCareer,
  developDriver,
  driverStandings,
  getContractOffers,
  getPlayer,
  isSeasonComplete,
  setTrainingFocus,
  startNextSeason,
  startWeekend,
  teamStandings,
  validateNewCareerInput,
} from '@/engine';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { DEFAULT_INPUT, NOW, newCareer, playRound, playSeason } from './helpers';

describe('criação de carreira', () => {
  it('cria um campeonato com 10 equipes, 20 pilotos ativos e 10 etapas', () => {
    const c = newCareer();
    expect(c.teams).toHaveLength(10);
    expect(c.drivers.filter((d) => d.teamId)).toHaveLength(20);
    expect(c.calendar).toHaveLength(10);
    expect(CareerStateSchema.safeParse(c).success).toBe(true);
    expect(validateCareerIntegrity(c)).toEqual([]);
  });

  it('o jogador ocupa a vaga de estreante e recebe os bônus', () => {
    const c = newCareer();
    const p = getPlayer(c);
    expect(p.teamId).toBe('cerrado');
    expect(c.drivers.find((d) => d.id === 'teixeira')!.teamId).toBeNull();
    expect(p.attributes.pace).toBe(70 + 4);
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

describe('evolução', () => {
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

  it('jovens evoluem mais rápido que veteranos', () => {
    const p = getPlayer(newCareer());
    const young = developDriver({ ...p, age: 15, trainingFocus: 'speed' }, 3).delta.pace!;
    const old = developDriver({ ...p, age: 26, trainingFocus: 'speed' }, 3).delta.pace!;
    expect(young).toBeGreaterThan(old);
  });
});

describe('temporada completa', () => {
  const season = playSeason(setTrainingFocus(newCareer(777), 'speed'));

  it('disputa as 10 etapas e mantém a integridade', () => {
    expect(season.rounds).toHaveLength(10);
    expect(isSeasonComplete(season)).toBe(true);
    expect(validateCareerIntegrity(season)).toEqual([]);
    expect(CareerStateSchema.safeParse(season).success).toBe(true);
    expect(() => startWeekend(season)).toThrow();
  });

  it('a soma dos pontos dos pilotos é igual à soma dos pontos das equipes', () => {
    const drivers = driverStandings(season).reduce((s, d) => s + d.points, 0);
    const teams = teamStandings(season).reduce((s, t) => s + t.points, 0);
    expect(drivers).toBe(teams);
    expect(drivers).toBeGreaterThan(10 * 101);
  });

  it('o jogador evolui ao longo da temporada', () => {
    const p = getPlayer(season);
    expect(p.attributes.pace).toBeGreaterThan(season.playerSeasonStartAttributes.pace);
    expect(p.attributes.experience).toBeGreaterThan(season.playerSeasonStartAttributes.experience);
  });

  it('as estatísticas de carreira batem com a classificação', () => {
    const stats = computeCareerStats(season, 'player');
    const standing = driverStandings(season).find((s) => s.driverId === 'player')!;
    expect(stats.starts).toBe(10);
    expect(stats.points).toBe(standing.points);
    expect(stats.wins).toBe(standing.wins);
  });

  it('gera mensagens de corrida, equipe e treino', () => {
    expect(season.inbox.some((m) => m.category === 'race')).toBe(true);
    expect(season.inbox.some((m) => m.category === 'training')).toBe(true);
    expect(season.inbox.some((m) => m.category === 'season')).toBe(true);
  });

  it('oferece contratos e inicia a temporada seguinte com transferência', () => {
    const offers = getContractOffers(season);
    expect(offers.length).toBeGreaterThan(0);
    const outcome = computeSeasonOutcome(season);
    const target = offers.find((o) => !o.isCurrentTeam) ?? offers[0]!;
    const next = startNextSeason(season, target.teamId);
    expect(next.season).toBe(2);
    expect(next.year).toBe(season.year + 1);
    expect(next.rounds).toEqual([]);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]!.playerPosition).toBe(outcome.playerPosition);
    expect(next.reputation).toBe(outcome.reputationAfter);
    expect(getPlayer(next).teamId).toBe(target.teamId);
    expect(getPlayer(next).age).toBe(getPlayer(season).age + 1);
    expect(validateCareerIntegrity(next)).toEqual([]);
    expect(() => startNextSeason(season, 'equipe-inexistente')).toThrow();
    // A segunda temporada também pode ser jogada.
    const round1 = playRound(next);
    expect(round1.rounds).toHaveLength(1);
    expect(computeCareerStats(round1, 'player').starts).toBe(11);
  });
});
