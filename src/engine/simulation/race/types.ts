/**
 * Tipos do motor de corrida.
 *
 * O motor é independente da interface e da carreira: recebe um RaceContext
 * (pista, regras da categoria, pilotos e equipes) e um RaceSimState, e devolve
 * o próximo estado. Tudo é dado simples e serializável.
 */
import type {
  DnfReason,
  Driver,
  MomentKind,
  MomentRecord,
  RaceEvent,
  RaceMode,
  SessionWeather,
  Team,
  Track,
  TyreCompound,
  WeekendModifiers,
} from '@/domain/schemas';
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

/* ---------------- Lances decisivos (Fase 4) ---------------- */

/** O que pesou na chance de uma opção, para a tela explicar o número. */
export type MomentFactorKey = 'driver' | 'rival' | 'car' | 'crew' | 'tyres' | 'track' | 'weather' | 'form' | 'profile';

export interface MomentFactor {
  key: MomentFactorKey;
  /** Quanto este fator mexe na chance, em pontos percentuais (positivo = ajuda). */
  points: number;
}

export interface MomentOption {
  /** Id da opção (as chaves de RACE_MOMENTS.OPTIONS[lance]). */
  id: string;
  label: string;
  /** Chance de dar certo, de 0 a 1. A mesma que resolve o lance. */
  chance: number;
  /** 0 = segura, 1 = moderada, 2 = arriscada. */
  risk: 0 | 1 | 2;
  /** O que se ganha se der certo e o que se perde se der errado, em texto curto. */
  gain: string;
  loss: string;
  factors: MomentFactor[];
}

/** Um lance decisivo à espera da escolha do jogador. Vale para a volta `lap` (a próxima). */
export interface RaceMoment {
  kind: MomentKind;
  lap: number;
  /** Rival do lance (o carro da frente no ataque, o de trás na defesa), se houver. */
  rivalId: string | null;
  title: string;
  question: string;
  options: MomentOption[];
  /** Lance de parada: os compostos que podem ser colocados e o sugerido pelo engenheiro. */
  compounds?: TyreCompound[];
  suggestedCompound?: TyreCompound;
}

/** Resposta do jogador a um lance. Sem resposta, o piloto decide pelo próprio estilo. */
export interface MomentChoice {
  option: string;
  /** Composto a colocar, no lance de parada. */
  compound?: TyreCompound;
}

/**
 * Efeito de um lance que dura mais de uma volta (ficar na pista na chuva, voltas de saída do
 * undercut, esticar o stint). Vale da volta `fromLap` à `untilLap`, só para o carro do jogador.
 */
export interface MomentCarry {
  fromLap: number;
  untilLap: number;
  /** Fração somada ao tempo de volta (negativo = mais rápido). */
  pace: number;
  /** Multiplica a perda (ritmo e erro) de estar com o pneu errado para a pista. 1 = sem efeito. */
  grip: number;
  /** Multiplica o desgaste. */
  wear: number;
  /** O engenheiro não chama para os boxes enquanto durar (o jogador ainda pode pedir a parada). */
  holdPit: boolean;
}

/** Mensagem do engenheiro para o jogador. Não vai para o save: só existe durante a corrida. */
export interface RadioMessage {
  lap: number;
  /** Assunto da mensagem (uma por volta, no máximo). */
  topic: 'tyresLimit' | 'tyresGone' | 'rivalPitted' | 'rain' | 'closing' | 'pitWindow';
  message: string;
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
  /** Lance decisivo aguardando a escolha do jogador para a próxima volta. */
  pendingMoment: RaceMoment | null;
  /** Lances já resolvidos nesta corrida, na ordem. */
  moments: MomentRecord[];
  /** Efeito de lance ainda em vigor para o carro do jogador. */
  carry: MomentCarry | null;
  /** Rádio do engenheiro para o jogador (não vai para o resultado). */
  radio: RadioMessage[];
}

/**
 * Modificadores próprios de um piloto, além dos atributos: hoje, os do nascimento (aptidões de
 * corpo e mente e talentos e defeitos ocultos). Quem não tem perfil corre com o neutro
 * (`neutralRaceProfile`), e o perfil nunca acrescenta sorteios: só muda médias e limites.
 */
export interface DriverRaceProfile {
  /** Fração somada ao tempo de volta (negativo = mais rápido). */
  pace: number;
  /** Fração somada ao tempo de volta por unidade de umidade da pista. */
  wetPace: number;
  /** Multiplicador da chance de erro. */
  error: number;
  /** A chance de erro é multiplicada por (1 + wetError × umidade). */
  wetError: number;
  /** Multiplicador do cansaço (ruído e erros que crescem com a corrida). */
  fatigue: number;
  /** Multiplicador da dispersão da reação na largada. */
  startSpread: number;
  /** Segundos somados à volta de largada. */
  startGain: number;
  /** Multiplicador do desgaste de pneus. */
  tyreWear: number;
  /** Multiplicador da chance de lesão num acidente. */
  injury: number;
  /** Multiplicador da chance de toque numa disputa frustrada (como atacante). */
  collision: number;
  /** Soma ao logit das disputas quando ataca. */
  attack: number;
  /** Soma ao logit das disputas quando ataca e subtrai quando defende. */
  duel: number;
  /** O mesmo, só na última volta. */
  lastLapDuel: number;
  /** Multiplicador da chance de erro na última volta. */
  lastLapError: number;
  /** Fração somada ao tempo da volta de classificação. */
  qualifying: number;
}

/** O perfil que não muda nada: o de todo piloto sem nascimento sorteado. */
export function neutralRaceProfile(): DriverRaceProfile {
  return {
    pace: 0,
    wetPace: 0,
    error: 1,
    wetError: 0,
    fatigue: 1,
    startSpread: 1,
    startGain: 0,
    tyreWear: 1,
    injury: 1,
    collision: 1,
    attack: 0,
    duel: 0,
    lastLapDuel: 0,
    lastLapError: 1,
    qualifying: 0,
  };
}

export interface RaceContext {
  track: Track;
  category: CategoryDefinition;
  drivers: Readonly<Record<string, Driver>>;
  teams: Readonly<Record<string, Team>>;
  /** Rivalidades do jogador (piloto → 0 a 100): disputas com rivais são mais tensas. */
  rivalries?: Readonly<Record<string, number>>;
  /** Perfis próprios (piloto → modificadores); quem não aparece corre com o neutro. */
  profiles?: Readonly<Record<string, DriverRaceProfile>>;
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
  /**
   * Resposta ao lance decisivo pendente. Sem ela, o piloto decide pelo próprio estilo: é o que
   * acontece em "simular até o fim" e quando o jogador entrega o lance ao piloto.
   */
  moment?: MomentChoice | null;
}

export interface GridSlot {
  driverId: string;
  teamId: string;
  modifiers: WeekendModifiers;
  /** Estratégia do carro; se ausente, o motor escolhe pela regra da IA. */
  plan?: StrategyPlan;
}
