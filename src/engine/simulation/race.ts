/**
 * Simulação de corrida, volta a volta.
 *
 * O estado da corrida (RaceSimState) é um objeto de dados simples. A função
 * stepRaceLap recebe um estado e devolve o próximo, sem efeitos colaterais.
 * Isso permite que a interface reproduza a corrida em tempo real, que o
 * jogador mude o modo de pilotagem durante a prova e que os testes simulem
 * corridas inteiras.
 *
 * Sorte determinística e isolada: a aleatoriedade de cada piloto em cada volta
 * vem de hashSeed(semente, volta, piloto). Cada disputa de posição tem a sua
 * própria semente. Mudar o modo do jogador altera as médias e as
 * probabilidades, mas nunca embaralha a sorte dos outros pilotos.
 *
 * Ordem de cada volta:
 * 1. Cada kart calcula seu tempo de volta "em pista livre": ritmo, pneus,
 *    modo, ruído de consistência, erros e quebras.
 * 2. As posições são resolvidas da frente para trás. Quem chega perto do kart
 *    da frente com ritmo melhor tenta a ultrapassagem; o sucesso depende de
 *    ataque contra defesa, vantagem de ritmo, dificuldade da pista e modo.
 *    Quem não tenta, ou falha, fica preso atrás.
 * 3. Os tempos acumulados são ajustados para respeitar a ordem de pista.
 */
import type {
  DnfReason,
  Driver,
  RaceEntryResult,
  RaceEvent,
  RaceMode,
  RaceResult,
  SessionWeather,
  Team,
  Track,
  WeekendModifiers,
} from '@/domain/schemas';
import { chooseAiRaceMode } from '../ai/decisions';
import { scoreRaceEntries } from '../championship/points';
import { createRng, gaussian, hashSeed } from '../rng';
import { RACE_MODE_EFFECTS, SIM } from './constants';
import { errorProbability, expectedLapTime, lapNoiseSigma, mechanicalFailureProbability, tyreWearPerLap } from './performance';

export interface RaceCar {
  driverId: string;
  teamId: string;
  grid: number;
  totalTime: number;
  lapsCompleted: number;
  lastLap: number | null;
  bestLap: number | null;
  tyreWear: number;
  status: 'running' | 'dnf';
  dnfReason?: DnfReason;
  errors: number;
  overtakes: number;
  mode: RaceMode;
  modifiers: WeekendModifiers;
}

export interface RaceSimState {
  seed: number;
  trackId: string;
  weather: SessionWeather;
  totalLaps: number;
  /** Voltas já completadas pelo líder (0 = antes da largada). */
  currentLap: number;
  /** Ordem atual: primeiro os karts na pista, depois os abandonos. */
  cars: RaceCar[];
  events: RaceEvent[];
  fastestLap: { driverId: string; time: number; lap: number } | null;
  playerDriverId: string;
}

export interface RaceContext {
  track: Track;
  drivers: Readonly<Record<string, Driver>>;
  teams: Readonly<Record<string, Team>>;
}

export interface GridSlot {
  driverId: string;
  teamId: string;
  modifiers: WeekendModifiers;
}

/** Tempo extra fixo da volta de largada (saída parada), igual para todos. */
const START_LAP_EXTRA = 1.5;
/** Folga mínima mantida entre karts depois de resolver as posições. */
const ORDER_GAP = 0.1;

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function createRaceSim(
  grid: readonly GridSlot[],
  track: Track,
  weather: SessionWeather,
  seed: number,
  playerDriverId: string,
): RaceSimState {
  return {
    seed,
    trackId: track.id,
    weather,
    totalLaps: track.laps,
    currentLap: 0,
    cars: grid.map((slot, index) => ({
      driverId: slot.driverId,
      teamId: slot.teamId,
      grid: index + 1,
      totalTime: index * SIM.GRID_SPACING,
      lapsCompleted: 0,
      lastLap: null,
      bestLap: null,
      tyreWear: 0,
      status: 'running',
      errors: 0,
      overtakes: 0,
      mode: 'balanced',
      modifiers: slot.modifiers,
    })),
    events: [],
    fastestLap: null,
    playerDriverId,
  };
}

export function isRaceFinished(state: RaceSimState): boolean {
  return state.currentLap >= state.totalLaps || state.cars.every((c) => c.status === 'dnf');
}

function driverName(ctx: RaceContext, id: string): string {
  const d = ctx.drivers[id];
  return d ? `${d.firstName.charAt(0)}. ${d.lastName}` : id;
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Dado ausente na simulação: ${what}`);
  return value;
}

interface LapWork {
  car: RaceCar;
  driver: Driver;
  team: Team;
  mode: RaceMode;
  lapTime: number;
  newTotal: number;
  retired: DnfReason | null;
}

/** Simula uma volta. O modo do jogador vale para esta volta; a IA decide o seu. */
export function stepRaceLap(state: RaceSimState, ctx: RaceContext, playerMode: RaceMode): RaceSimState {
  if (isRaceFinished(state)) return state;
  const lap = state.currentLap + 1;
  const progress = state.totalLaps > 1 ? (lap - 1) / (state.totalLaps - 1) : 1;
  const { track } = ctx;
  const weather = state.weather;
  const events: RaceEvent[] = [];

  const running = state.cars.filter((c) => c.status === 'running');
  const retiredBefore = state.cars.filter((c) => c.status === 'dnf');

  /* ---------- 1. Tempo de volta em pista livre ---------- */
  const work: LapWork[] = running.map((car, index) => {
    const driver = need(ctx.drivers[car.driverId], `piloto ${car.driverId}`);
    const team = need(ctx.teams[car.teamId], `equipe ${car.teamId}`);
    const a = driver.attributes;
    const ahead = running[index - 1];
    const behind = running[index + 1];
    const mode: RaceMode =
      car.driverId === state.playerDriverId
        ? playerMode
        : chooseAiRaceMode(a, {
            lapsRemaining: state.totalLaps - state.currentLap,
            tyreWear: car.tyreWear,
            gapAhead: ahead ? car.totalTime - ahead.totalTime : null,
            gapBehind: behind ? behind.totalTime - car.totalTime : null,
          });
    const fx = RACE_MODE_EFFECTS[mode];

    // Todos os sorteios acontecem sempre, na mesma ordem, para manter a sequência estável.
    const rng = createRng(hashSeed(state.seed, lap, car.driverId));
    const noise = gaussian(rng);
    const startReaction = gaussian(rng);
    const mechanicalRoll = rng.next();
    const errorRoll = rng.next();
    const severityRoll = rng.next();
    const lossRoll = rng.next();

    let lapTime = expectedLapTime({
      attributes: a,
      kart: team.kart,
      track,
      weather,
      setupScore: car.modifiers.setupScore,
      tyreWear: car.tyreWear,
      paceModifier: fx.pace,
    });
    lapTime *= 1 + noise * lapNoiseSigma(a, weather, progress);

    if (lap === 1) {
      // Largada: experiência e concentração reduzem a dispersão da reação.
      const spread = SIM.START_REACTION_SPREAD * (1 - (a.experience + a.focus) / 200);
      lapTime += START_LAP_EXTRA + startReaction * spread;
    }

    let retired: DnfReason | null = null;
    const name = driverName(ctx, car.driverId);
    if (mechanicalRoll < mechanicalFailureProbability(team.kart)) {
      retired = 'mechanical';
      events.push({ lap, type: 'dnf', driverId: car.driverId, message: `${name} abandona com problema mecânico.` });
    } else if (errorRoll < errorProbability(a, weather, progress) * fx.error) {
      const severity = weather.wetness >= 0.5 ? SIM.ERROR_SEVERITY_WET : SIM.ERROR_SEVERITY_DRY;
      car = { ...car, errors: car.errors + 1 };
      if (severityRoll < severity.minor) {
        const loss = SIM.MINOR_ERROR_LOSS[0] + (SIM.MINOR_ERROR_LOSS[1] - SIM.MINOR_ERROR_LOSS[0]) * lossRoll;
        lapTime += loss;
        events.push({ lap, type: 'error', driverId: car.driverId, message: `${name} erra a freada e perde ${loss.toFixed(1)}s.` });
      } else if (severityRoll < severity.minor + severity.spin) {
        const loss = SIM.SPIN_LOSS[0] + (SIM.SPIN_LOSS[1] - SIM.SPIN_LOSS[0]) * lossRoll;
        lapTime += loss;
        events.push({ lap, type: 'spin', driverId: car.driverId, message: `${name} roda e perde ${loss.toFixed(1)}s.` });
      } else {
        retired = 'crash';
        events.push({ lap, type: 'dnf', driverId: car.driverId, message: `${name} bate e está fora da corrida.` });
      }
    }

    const tyreWear = Math.min(1, car.tyreWear + tyreWearPerLap(a, track, weather, fx.tyreWear, car.modifiers.tyreWearFactor));
    return { car: { ...car, tyreWear, mode }, driver, team, mode, lapTime, newTotal: car.totalTime + lapTime, retired };
  });

  /* ---------- 2. Resolução de posições ---------- */
  const resolved: LapWork[] = [];
  const retiredNow: LapWork[] = [];
  const difficulty = track.overtakingDifficulty * (lap === 1 ? SIM.FIRST_LAP_DIFFICULTY_FACTOR : 1);

  for (const w of work) {
    if (w.retired) {
      retiredNow.push(w);
      continue;
    }
    resolved.push(w);
    let idx = resolved.length - 1;
    let passes = 0;
    while (idx > 0) {
      const ahead = need(resolved[idx - 1], 'kart à frente');
      if (w.newTotal >= ahead.newTotal + SIM.MIN_GAP) break; // pista livre

      const paceAdvantage = ahead.lapTime - w.lapTime;
      if (paceAdvantage <= 0 || passes >= SIM.MAX_PASSES_PER_LAP) {
        w.newTotal = ahead.newTotal + SIM.MIN_GAP; // preso atrás
        break;
      }

      const rng = createRng(hashSeed(state.seed, lap, 'pass', w.car.driverId, ahead.car.driverId));
      const successRoll = rng.next();
      const collisionRoll = rng.next();
      const collisionDnfRoll = rng.next();
      const victimRoll = rng.next();

      const attackFx = RACE_MODE_EFFECTS[w.mode];
      const defendFx = RACE_MODE_EFFECTS[ahead.mode];
      const logit =
        SIM.PASS_LOGIT_BASE +
        SIM.PASS_LOGIT_SKILL * (w.driver.attributes.overtaking - ahead.driver.attributes.defending) +
        SIM.PASS_LOGIT_PACE * paceAdvantage -
        SIM.PASS_LOGIT_DIFFICULTY * difficulty +
        attackFx.attack -
        defendFx.defend;
      const attacker = driverName(ctx, w.car.driverId);
      const defender = driverName(ctx, ahead.car.driverId);

      if (successRoll < sigmoid(logit)) {
        // Ultrapassagem: o kart da frente perde a linha e fica atrás.
        ahead.newTotal = Math.max(ahead.newTotal + SIM.DEFENDED_PASS_LOSS, w.newTotal + SIM.MIN_GAP);
        resolved[idx - 1] = w;
        resolved[idx] = ahead;
        w.car = { ...w.car, overtakes: w.car.overtakes + 1 };
        events.push({
          lap,
          type: 'overtake',
          driverId: w.car.driverId,
          otherDriverId: ahead.car.driverId,
          message: `${attacker} ultrapassa ${defender} e assume a ${idx}ª posição.`,
        });
        idx--;
        passes++;
        continue;
      }

      // Tentativa frustrada: risco de toque, que cresce com a agressividade e cai com a leitura de corrida.
      const collisionChance =
        SIM.COLLISION_ON_FAILED_PASS * attackFx.collision * (1.2 - w.driver.attributes.racecraft / 100);
      if (collisionRoll < collisionChance) {
        if (collisionDnfRoll < SIM.COLLISION_DNF_SHARE) {
          const victim = victimRoll < 0.6 ? w : ahead;
          victim.retired = 'collision';
          events.push({
            lap,
            type: 'dnf',
            driverId: victim.car.driverId,
            otherDriverId: victim === w ? ahead.car.driverId : w.car.driverId,
            message: `Toque entre ${attacker} e ${defender}! ${driverName(ctx, victim.car.driverId)} está fora.`,
          });
          if (victim === w) {
            resolved.splice(idx, 1);
            retiredNow.push(w);
          } else {
            resolved.splice(idx - 1, 1);
            retiredNow.push(ahead);
            idx--;
            continue; // o atacante segue disputando com quem está à frente
          }
          break;
        }
        w.newTotal += 2.0;
        ahead.newTotal += 0.8;
        events.push({
          lap,
          type: 'collision',
          driverId: w.car.driverId,
          otherDriverId: ahead.car.driverId,
          message: `${attacker} toca em ${defender}. Os dois perdem tempo.`,
        });
      }
      w.newTotal = Math.max(w.newTotal, ahead.newTotal + SIM.MIN_GAP + SIM.FAILED_PASS_LOSS);
      break;
    }
  }

  // 3. Os tempos respeitam a ordem de pista.
  for (let i = 1; i < resolved.length; i++) {
    const prev = need(resolved[i - 1], 'ordem');
    const cur = need(resolved[i], 'ordem');
    cur.newTotal = Math.max(cur.newTotal, prev.newTotal + ORDER_GAP);
  }

  /* ---------- 4. Atualização do estado ---------- */
  let fastestLap = state.fastestLap;
  const runningCars: RaceCar[] = resolved.map((w) => {
    const actualLap = round3(w.newTotal - w.car.totalTime);
    const bestLap = w.car.bestLap === null ? actualLap : Math.min(w.car.bestLap, actualLap);
    if (lap > 1 && (fastestLap === null || actualLap < fastestLap.time)) {
      fastestLap = { driverId: w.car.driverId, time: actualLap, lap };
    }
    return { ...w.car, totalTime: round3(w.newTotal), lapsCompleted: lap, lastLap: actualLap, bestLap };
  });
  if (fastestLap && fastestLap !== state.fastestLap && fastestLap.lap === lap && lap >= 3) {
    events.push({
      lap,
      type: 'fastestLap',
      driverId: fastestLap.driverId,
      message: `${driverName(ctx, fastestLap.driverId)} marca a volta mais rápida: ${fastestLap.time.toFixed(3)}s.`,
    });
  }

  const newlyRetired: RaceCar[] = retiredNow.map((w) => ({
    ...w.car,
    status: 'dnf',
    dnfReason: w.retired ?? 'crash',
    lapsCompleted: lap - 1,
    lastLap: null,
  }));

  if (lap === 1) {
    const leader = runningCars[0];
    if (leader) {
      events.unshift({ lap, type: 'start', driverId: leader.driverId, message: `Largada! ${driverName(ctx, leader.driverId)} lidera a primeira volta.` });
    }
  }
  if (lap === state.totalLaps) {
    const winner = runningCars[0];
    if (winner) {
      events.push({ lap, type: 'finish', driverId: winner.driverId, message: `Bandeirada! ${driverName(ctx, winner.driverId)} vence a corrida.` });
    }
  }

  return {
    ...state,
    currentLap: lap,
    // Abandonos mais recentes ficam à frente dos anteriores (completaram mais voltas).
    cars: [...runningCars, ...newlyRetired, ...retiredBefore],
    events: [...state.events, ...events],
    fastestLap,
  };
}

/** Simula todas as voltas restantes com o mesmo modo para o jogador. */
export function simulateRemainingRace(state: RaceSimState, ctx: RaceContext, playerMode: RaceMode): RaceSimState {
  let current = state;
  while (!isRaceFinished(current)) current = stepRaceLap(current, ctx, playerMode);
  return current;
}

/** Converte uma corrida encerrada no resultado oficial, já com a pontuação. */
export function finalizeRace(state: RaceSimState): RaceResult {
  if (!isRaceFinished(state)) throw new Error('A corrida ainda não terminou.');
  const fastestLapDriver = state.fastestLap?.driverId ?? null;
  const unscored: Omit<RaceEntryResult, 'points'>[] = state.cars.map((car, index) => ({
    driverId: car.driverId,
    teamId: car.teamId,
    position: index + 1,
    grid: car.grid,
    status: car.status === 'running' ? 'finished' : 'dnf',
    ...(car.dnfReason ? { dnfReason: car.dnfReason } : {}),
    lapsCompleted: car.lapsCompleted,
    totalTime: car.totalTime,
    bestLap: car.bestLap,
    overtakes: car.overtakes,
    errors: car.errors,
  }));
  return {
    weather: state.weather,
    totalLaps: state.totalLaps,
    entries: scoreRaceEntries(unscored, fastestLapDriver),
    fastestLap: state.fastestLap,
    events: state.events,
  };
}

/** Diferença para o líder, em segundos (null para abandono). */
export function gapToLeader(state: RaceSimState, car: RaceCar): number | null {
  const leader = state.cars[0];
  if (!leader || car.status === 'dnf') return null;
  return round3(car.totalTime - leader.totalTime);
}

