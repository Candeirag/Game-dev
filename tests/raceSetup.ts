/** Monta corridas avulsas para os testes do motor, sem depender do estado da carreira. */
import type { CategoryId, Driver, SessionWeather, Team } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { buildCategoryField, createRaceSim, rankTeams, type GridSlot, type RaceContext, type RaceSimState, type StrategyPlan } from '@/engine';

export const DRY: SessionWeather = { condition: 'dry', wetness: 0, trackTemp: 30 };
export const WET: SessionWeather = { condition: 'wet', wetness: 0.9, trackTemp: 18 };
export const NEUTRAL_MODIFIERS = { setupScore: 0.5, qualifyingBonus: 0, tyreWearFactor: 1 };

export interface RaceSetup {
  ctx: RaceContext;
  drivers: Driver[];
  teams: Team[];
  /** Id do piloto tratado como jogador: o segundo piloto da equipe mais forte. */
  playerId: string;
  start(seed: number, weather?: SessionWeather, playerPlan?: StrategyPlan, gridOrder?: string[]): RaceSimState;
}

export function raceSetup(categoryId: CategoryId, trackId?: string, fieldSeed = 77): RaceSetup {
  const category = getCategory(categoryId);
  const field = buildCategoryField(categoryId, fieldSeed, 1);
  const drivers = field.drivers.filter((d) => d.role !== 'reserve');
  const track = getTrack(trackId ?? category.trackIds[0]!);
  const ctx: RaceContext = {
    track,
    category,
    drivers: Object.fromEntries(field.drivers.map((d) => [d.id, d])),
    teams: Object.fromEntries(field.teams.map((t) => [t.id, t])),
  };
  const ranked = rankTeams(field.teams);
  const playerId = drivers.find((d) => d.teamId === ranked[0]!.id && d.role === 'second')!.id;
  // Grid padrão: ordem de força das equipes, primeiro piloto à frente do segundo.
  const defaultOrder = ranked.flatMap((t) =>
    drivers
      .filter((d) => d.teamId === t.id)
      .sort((a) => (a.role === 'first' ? -1 : 1))
      .map((d) => d.id),
  );
  return {
    ctx,
    drivers,
    teams: field.teams,
    playerId,
    start(seed, weather = DRY, playerPlan, gridOrder = defaultOrder) {
      const grid: GridSlot[] = gridOrder.map((id) => {
        const d = ctx.drivers[id]!;
        return { driverId: id, teamId: d.teamId!, modifiers: NEUTRAL_MODIFIERS, ...(id === playerId && playerPlan ? { plan: playerPlan } : {}) };
      });
      return createRaceSim(grid, ctx, weather, seed, playerId);
    },
  };
}
