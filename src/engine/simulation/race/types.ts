/**
 * Tipos do motor de corrida.
 *
 * O motor é independente da interface e da carreira: recebe um RaceContext
 * (pista, regras da categoria, pilotos e equipes) e um RaceSimState, e devolve
 * o próximo estado. Tudo é dado simples e serializável.
 */
import type { DnfReason, Driver, RaceEvent, RaceMode, SessionWeather, Team, Track, TyreCompound, WeekendModifiers } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';

export interface PlannedStop {
  lap: number;
  compound: TyreCompound;
}

export interface StrategyPlan {
  startCompound: TyreCompound;
  stops: PlannedStop[];
}

export interface RaceCar {
  driverId: string;
  teamId: string;
  grid: number;
  totalTime: number;
  lapsCompleted: number;
  lastLap: number | null;
  bestLap: number | null;
  status: 'running' | 'dnf';
  dnfReason?: DnfReason;
  tyre: { compound: TyreCompound; wear: number; age: number };
  compoundsUsed: TyreCompound[];
  /** Combustível restante, em voltas de consumo normal. */
  fuel: number;
  /** Dano atual (afeta o ritmo) e dano acumulado na corrida (vira conta). */
  damage: number;
  damageTotal: number;
  pitStops: number;
  /** Paradas planejadas que ainda não aconteceram. */
  plan: PlannedStop[];
  penaltySeconds: number;
  penaltyPoints: number;
  /** Posições a perder no grid da próxima corrida. */
  gridDropNext: number;
  minorErrors: number;
  errors: number;
  overtakes: number;
  mode: RaceMode;
  modifiers: WeekendModifiers;
  injured: boolean;
}

export type Neutralization = { type: 'none' } | { type: 'sc' | 'vsc'; lapsLeft: number };

export interface TeamOrderRecord {
  lap: number;
  teamId: string;
  askedDriverId: string;
  favouredDriverId: string;
  obeyed: boolean;
}

export interface WeatherForecast {
  kind: 'stable' | 'rain' | 'drying';
  /** Volta aproximada da mudança (a previsão erra por algumas voltas). */
  aroundLap: number | null;
}

export interface RaceSimState {
  seed: number;
  trackId: string;
  categoryId: string;
  totalLaps: number;
  /** Voltas já completadas (0 = antes da largada). */
  currentLap: number;
  /** Clima na largada. */
  weather: SessionWeather;
  /** Umidade da pista em cada volta (índice = número da volta). */
  wetnessByLap: number[];
  forecast: WeatherForecast;
  neutralization: Neutralization;
  /** A próxima volta é uma relargada. */
  restart: 'none' | 'rolling' | 'standing';
  /** Corrida encerrada antes do fim por bandeira vermelha. */
  endedEarly: boolean;
  /** Ordem atual: primeiro os carros na pista, depois os abandonos. */
  cars: RaceCar[];
  events: RaceEvent[];
  fastestLap: { driverId: string; time: number; lap: number } | null;
  playerDriverId: string;
  /** Ordem de equipe aguardando a resposta do jogador. */
  pendingTeamOrder: { teamId: string; favouredDriverId: string } | null;
  teamOrders: TeamOrderRecord[];
  safetyCars: number;
  virtualSafetyCars: number;
  redFlags: number;
}

export interface RaceContext {
  track: Track;
  category: CategoryDefinition;
  drivers: Readonly<Record<string, Driver>>;
  teams: Readonly<Record<string, Team>>;
  /** Rivalidades do jogador (piloto → 0 a 100): disputas com rivais são mais tensas. */
  rivalries?: Readonly<Record<string, number>>;
}

/** Decisões do jogador para a próxima volta. */
export interface PlayerRaceInput {
  mode: RaceMode;
  /** Parar nos boxes nesta volta e sair com este composto. */
  pit?: TyreCompound | null;
  /** Ignorar a parada planejada para esta volta. */
  skipPlannedStop?: boolean;
  /** Resposta a uma ordem de equipe pendente (padrão: obedecer). */
  teamOrder?: 'obey' | 'ignore';
  /**
   * Piloto automático: o engenheiro decide paradas e protege o combustível,
   * seguindo as mesmas regras da IA. Usado em "simular até o fim".
   */
  auto?: boolean;
}

export interface GridSlot {
  driverId: string;
  teamId: string;
  modifiers: WeekendModifiers;
  /** Estratégia do carro; se ausente, o motor escolhe pela regra da IA. */
  plan?: StrategyPlan;
}
