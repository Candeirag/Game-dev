/**
 * Simulação de corrida, volta a volta.
 *
 * stepRaceLap recebe um estado e devolve o próximo, sem efeitos colaterais. A
 * interface reproduz a corrida chamando-a volta a volta; os testes e a carreira
 * simulam corridas inteiras com a mesma função.
 *
 * Sorte determinística e isolada: a aleatoriedade de cada piloto em cada volta
 * vem de hashSeed(semente, volta, piloto); cada disputa e cada decisão de
 * neutralização tem a sua própria semente. As decisões do jogador mudam médias
 * e probabilidades, mas nunca embaralham a sorte dos outros.
 *
 * Ordem de cada volta:
 * 0. Clima da volta e resposta a uma ordem de equipe pendente.
 * 1. Cada carro: modo de pilotagem, decisão de box, tempo de volta em pista
 *    livre (ritmo, pneus, combustível, dano, condição do piloto), incidentes,
 *    parada, desgaste e consumo.
 * 2. Resolução de posições: disputas em bandeira verde; fila atrás do safety
 *    car; posições congeladas sob safety car virtual.
 * 3. Consequências: danos, punições, abandonos.
 * 4. Direção de prova: safety car, safety car virtual ou bandeira vermelha
 *    conforme os incidentes da volta; relargadas.
 * 5. Ordens de equipe para a volta seguinte.
 */
import type { DnfReason, Driver, RaceEvent, RaceMode, SessionWeather, Team, TyreCompound } from '@/domain/schemas';
import { raceLaps, referenceLapTime } from '@/data/tracks';
import { chooseAiRaceMode } from '../../ai/decisions';
import { createRng, gaussian, hashSeed } from '../../rng';
import { RACE, RACE_MODE_EFFECTS, SIM, TYRES } from '../constants';
import {
  conditionEffects,
  damagePenalty,
  errorProbability,
  expectedLapTime,
  fuelPenalty,
  lapNoiseSigma,
  mechanicalFailureProbability,
  tyreCliffPenalty,
  tyreConditionEffect,
  tyreWearPerLap,
  type ConditionEffects,
} from '../performance';
import { bestCompoundFor, buildStrategyOptions, chooseAiStrategy, clonePlan, decidePit } from './strategy';
import type { GridSlot, Neutralization, PlayerRaceInput, RaceCar, RaceContext, RaceSimState, TeamOrderRecord } from './types';
import { buildWetnessProfile, conditionFor } from './weatherProfile';

/** Tempo extra fixo da volta de largada (saída parada), igual para todos. */
const START_LAP_EXTRA = 1.5;
/** Folga mínima mantida entre carros depois de resolver as posições. */
const ORDER_GAP = 0.1;
/** Perda de tempo a partir da qual o carro é só ultrapassado, sem disputa (rodada, parada). */
const COMPROMISED_LOSS = 2.5;

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Dado ausente na simulação: ${what}`);
  return value;
}

function driverName(ctx: RaceContext, id: string): string {
  const d = ctx.drivers[id];
  return d ? `${d.firstName.charAt(0)}. ${d.lastName}` : id;
}

/** Monta o estado inicial da corrida a partir do grid. */
export function createRaceSim(
  grid: readonly GridSlot[],
  ctx: RaceContext,
  weather: SessionWeather,
  seed: number,
  playerDriverId: string,
): RaceSimState {
  const { track, category } = ctx;
  const rules = category.race;
  const totalLaps = raceLaps(track, category);
  const { wetnessByLap, forecast } = buildWetnessProfile(seed, track, weather, totalLaps, rules.changingWeather);
  const lapTime = referenceLapTime(track, category);

  const cars: RaceCar[] = grid.map((slot, index) => {
    const driver = need(ctx.drivers[slot.driverId], `piloto ${slot.driverId}`);
    const plan = slot.plan
      ? clonePlan(slot.plan)
      : chooseAiStrategy(buildStrategyOptions(rules, track, totalLaps, lapTime, driver.attributes, weather.wetness), index + 1);
    return {
      driverId: slot.driverId,
      teamId: slot.teamId,
      grid: index + 1,
      totalTime: index * SIM.GRID_SPACING,
      lapsCompleted: 0,
      lastLap: null,
      bestLap: null,
      status: 'running',
      tyre: { compound: plan.startCompound, wear: 0, age: 0 },
      compoundsUsed: [plan.startCompound],
      fuel: rules.fuel ? totalLaps * (1 + RACE.FUEL_MARGIN) : 0,
      damage: 0,
      damageTotal: 0,
      pitStops: 0,
      plan: plan.stops,
      penaltySeconds: 0,
      penaltyPoints: 0,
      gridDropNext: 0,
      minorErrors: 0,
      errors: 0,
      overtakes: 0,
      mode: 'balanced',
      modifiers: slot.modifiers,
      injured: false,
    };
  });

  return {
    seed,
    trackId: track.id,
    categoryId: category.id,
    totalLaps,
    currentLap: 0,
    weather,
    wetnessByLap,
    forecast,
    neutralization: { type: 'none' },
    restart: 'none',
    endedEarly: false,
    cars,
    events: [],
    fastestLap: null,
    playerDriverId,
    pendingTeamOrder: null,
    teamOrders: [],
    safetyCars: 0,
    virtualSafetyCars: 0,
    redFlags: 0,
  };
}

export function isRaceFinished(state: RaceSimState): boolean {
  return state.currentLap >= state.totalLaps || state.endedEarly || state.cars.every((c) => c.status === 'dnf');
}

interface LapWork {
  car: RaceCar;
  driver: Driver;
  team: Team;
  mode: RaceMode;
  cond: ConditionEffects;
  /** Tempo de volta em pista livre, sem parada (base das disputas). */
  paceLap: number;
  newTotal: number;
  retired: DnfReason | null;
  /** Perdeu tanto tempo (rodada ou parada) que os outros passam sem disputa. */
  compromised: boolean;
  pitted: boolean;
  pitLoss: number;
}

type Incident = 'crash' | 'collision' | 'mechanical' | 'spin';
type RaceControlCall = 'none' | 'vsc' | 'sc' | 'red';

/** Simula uma volta com as decisões do jogador. */
export function stepRaceLap(state: RaceSimState, ctx: RaceContext, input: PlayerRaceInput): RaceSimState {
  if (isRaceFinished(state)) return state;
  const { track, category } = ctx;
  const rules = category.race;
  const lap = state.currentLap + 1;
  const lapsRemaining = state.totalLaps - state.currentLap;
  const progress = state.totalLaps > 1 ? (lap - 1) / (state.totalLaps - 1) : 1;
  const wetness = state.wetnessByLap[lap] ?? state.weather.wetness;
  const previousWetness = state.wetnessByLap[lap - 1] ?? wetness;
  const weather: SessionWeather = { condition: conditionFor(wetness), wetness, trackTemp: state.weather.trackTemp };
  const neutral = state.neutralization.type;
  const standingStart = lap === 1 || state.restart === 'standing';
  const reference = referenceLapTime(track, category) * (1 + SIM.WET_LAP_PENALTY * wetness);
  const events: RaceEvent[] = [];
  const incidents: Incident[] = [];
  const teamOrders: TeamOrderRecord[] = [...state.teamOrders];
  const name = (id: string) => driverName(ctx, id);

  let running = state.cars.filter((c) => c.status === 'running');
  const retiredBefore = state.cars.filter((c) => c.status === 'dnf');

  if (lap > 1 && conditionFor(previousWetness) !== weather.condition) {
    const text = weather.condition === 'dry' ? 'A pista secou.' : weather.condition === 'damp' ? (wetness > previousWetness ? 'Começa a chover: pista úmida.' : 'A chuva diminui: pista úmida.') : 'Chuva forte: pista encharcada.';
    events.push({ lap, type: 'weather', driverId: running[0]?.driverId ?? '', message: text });
  }

  /* ---------- 0. Ordem de equipe pendente (resposta do jogador) ---------- */
  if (state.pendingTeamOrder) {
    const { teamId, favouredDriverId } = state.pendingTeamOrder;
    const askedIndex = running.findIndex((c) => c.driverId === state.playerDriverId);
    const favouredIndex = running.findIndex((c) => c.driverId === favouredDriverId);
    if (askedIndex >= 0 && favouredIndex === askedIndex + 1) {
      const obeyed = (input.teamOrder ?? 'obey') === 'obey';
      teamOrders.push({ lap, teamId, askedDriverId: state.playerDriverId, favouredDriverId, obeyed });
      if (obeyed) {
        running = swapForTeamOrder(running, askedIndex);
        events.push({ lap, type: 'teamOrder', driverId: state.playerDriverId, otherDriverId: favouredDriverId, message: `${name(state.playerDriverId)} obedece à equipe e deixa ${name(favouredDriverId)} passar.` });
      } else {
        events.push({ lap, type: 'teamOrder', driverId: state.playerDriverId, otherDriverId: favouredDriverId, message: `${name(state.playerDriverId)} ignora a ordem da equipe e mantém a posição.` });
      }
    }
  }

  /* ---------- 1. Cada carro: decisões, tempo de volta, incidentes ---------- */
  const work: LapWork[] = running.map((original, index) => {
    let car = original;
    const driver = need(ctx.drivers[car.driverId], `piloto ${car.driverId}`);
    const team = need(ctx.teams[car.teamId], `equipe ${car.teamId}`);
    const a = driver.attributes;
    const isPlayer = car.driverId === state.playerDriverId;
    const automatic = !isPlayer || input.auto === true;
    const cond = conditionEffects(driver.condition, driver.injury);
    const ahead = running[index - 1];
    const behind = running[index + 1];

    // Modo de pilotagem. Com combustível no limite, a IA (e o piloto automático) poupam.
    let mode: RaceMode = isPlayer
      ? input.mode
      : chooseAiRaceMode(a, {
          lapsRemaining,
          tyreWear: car.tyre.wear,
          gapAhead: ahead ? car.totalTime - ahead.totalTime : null,
          gapBehind: behind ? behind.totalTime - car.totalTime : null,
        });
    if (rules.fuel && automatic && car.fuel - lapsRemaining < 0.3) mode = 'conservative';
    const fx = RACE_MODE_EFFECTS[mode];

    // Todos os sorteios acontecem sempre, na mesma ordem, para manter a sequência estável.
    const rng = createRng(hashSeed(state.seed, lap, car.driverId));
    const noise = gaussian(rng);
    const startReaction = gaussian(rng);
    const mechanicalRoll = rng.next();
    const errorRoll = rng.next();
    const severityRoll = rng.next();
    const lossRoll = rng.next();
    const damageRoll = rng.next();
    const damageAmount = rng.next();
    const injuryRoll = rng.next();
    const pitNoise = Math.abs(gaussian(rng));
    const slowStopRoll = rng.next();
    const slowStopLoss = rng.next();
    const speedingRoll = rng.next();
    const unsafeRoll = rng.next();

    // Decisão de box.
    let pitCompound: TyreCompound | null = null;
    const usedDry = car.compoundsUsed.filter((c) => !TYRES[c].rain);
    const needsSecondCompound = rules.mandatoryTwoCompounds && new Set(usedDry).size < 2 && usedDry.length === car.compoundsUsed.length;
    const canPit = rules.pitStops && lap > 1 && lapsRemaining > 1;
    const freeChange = state.restart === 'standing' && lap > 1 && isPlayer && !!input.pit;
    if (canPit && !freeChange) {
      if (automatic) {
        // Pilotos de boa leitura reagem à pista desta volta; os demais, à da volta anterior.
        const decisionWetness = a.racecraft >= 75 ? wetness : previousWetness;
        pitCompound = decidePit(car, rules, { lap, totalLaps: state.totalLaps, wetness: decisionWetness, neutralized: neutral !== 'none', needsSecondCompound });
      } else if (input.pit) {
        pitCompound = input.pit;
      } else {
        const next = car.plan[0];
        if (next && lap >= next.lap && !input.skipPlannedStop) pitCompound = next.compound;
        else if (next && lap >= next.lap && input.skipPlannedStop) car = { ...car, plan: car.plan.slice(1) };
      }
    }
    if (freeChange && input.pit) {
      car = { ...car, tyre: { compound: input.pit, wear: 0, age: 0 }, compoundsUsed: [...car.compoundsUsed, input.pit] };
    }

    // Tempo de volta em pista livre.
    const tyreCond = tyreConditionEffect(car.tyre.compound, wetness);
    let lapTime: number;
    if (neutral === 'none') {
      const paceModifier =
        fx.pace +
        TYRES[car.tyre.compound].pace +
        cond.pace +
        tyreCond.pace +
        tyreCliffPenalty(car.tyre.compound, car.tyre.wear) +
        (rules.fuel ? fuelPenalty(car.fuel, state.totalLaps) : 0) +
        damagePenalty(car.damage);
      lapTime = expectedLapTime({
        attributes: a,
        car: team.car,
        track,
        weather,
        setupScore: car.modifiers.setupScore,
        tyreWear: car.tyre.wear,
        paceModifier,
        lapTimeFactor: category.lapTimeFactor,
        carFactor: category.carFactor,
      });
      lapTime *= 1 + noise * lapNoiseSigma(a, weather, progress) * cond.noise;
    } else {
      lapTime = reference * (neutral === 'vsc' ? RACE.VSC_LAP_FACTOR : RACE.SC_CATCHUP_FACTOR);
    }

    if (standingStart) {
      // Largada: experiência e concentração reduzem a dispersão da reação.
      const spread = SIM.START_REACTION_SPREAD * (1 - (a.experience + a.focus) / 200);
      lapTime += START_LAP_EXTRA + Math.max(startReaction, RACE.JUMP_START_THRESHOLD) * spread;
      if (startReaction < RACE.JUMP_START_THRESHOLD) {
        car = { ...car, penaltySeconds: car.penaltySeconds + RACE.JUMP_START_PENALTY };
        events.push({ lap, type: 'penalty', driverId: car.driverId, message: `${name(car.driverId)} queima a largada: ${RACE.JUMP_START_PENALTY}s de punição.` });
      }
    }

    // Incidentes. Atrás do safety car ninguém erra; quebras ficam mais raras.
    let retired: DnfReason | null = null;
    let incidentLoss = 0;
    const who = name(car.driverId);
    const mechanicalChance = mechanicalFailureProbability(team.car) * (neutral === 'none' ? 1 : 0.3);
    if (car.damage >= RACE.DAMAGE_RETIRE) {
      retired = 'damage';
      events.push({ lap, type: 'dnf', driverId: car.driverId, message: `${who} abandona com o carro danificado.` });
    } else if (mechanicalRoll < mechanicalChance) {
      retired = 'mechanical';
      incidents.push('mechanical');
      events.push({ lap, type: 'dnf', driverId: car.driverId, message: `${who} abandona com problema mecânico.` });
    } else if (neutral === 'none' && errorRoll < errorProbability(a, weather, progress) * fx.error * cond.error * tyreCond.error) {
      const severity = wetness >= 0.5 ? SIM.ERROR_SEVERITY_WET : SIM.ERROR_SEVERITY_DRY;
      car = { ...car, errors: car.errors + 1 };
      if (severityRoll < severity.minor) {
        incidentLoss = lerp(SIM.MINOR_ERROR_LOSS, lossRoll);
        car = { ...car, minorErrors: car.minorErrors + 1 };
        events.push({ lap, type: 'error', driverId: car.driverId, message: `${who} erra a freada e perde ${incidentLoss.toFixed(1)}s.` });
        if (rules.trackLimits && car.minorErrors >= RACE.TRACK_LIMITS_STRIKES && (car.minorErrors - RACE.TRACK_LIMITS_STRIKES) % 2 === 0) {
          car = { ...car, penaltySeconds: car.penaltySeconds + RACE.TRACK_LIMITS_PENALTY };
          events.push({ lap, type: 'penalty', driverId: car.driverId, message: `${who} excede os limites de pista: ${RACE.TRACK_LIMITS_PENALTY}s de punição.` });
        }
      } else if (severityRoll < severity.minor + severity.spin) {
        incidentLoss = lerp(SIM.SPIN_LOSS, lossRoll);
        incidents.push('spin');
        events.push({ lap, type: 'spin', driverId: car.driverId, message: `${who} roda e perde ${incidentLoss.toFixed(1)}s.` });
        if (damageRoll < RACE.DAMAGE_SPIN_CHANCE) {
          const damage = lerp(RACE.DAMAGE_SPIN, damageAmount);
          car = { ...car, damage: car.damage + damage, damageTotal: car.damageTotal + damage };
          events.push({ lap, type: 'damage', driverId: car.driverId, message: `${who} danifica o carro na rodada.` });
        }
      } else {
        retired = 'crash';
        incidents.push('crash');
        const injured = injuryRoll < injuryChance(ctx);
        car = { ...car, injured, damageTotal: car.damageTotal + 1 };
        events.push({ lap, type: 'dnf', driverId: car.driverId, message: `${who} bate e está fora da corrida.${injured ? ' O piloto é levado ao centro médico.' : ''}` });
      }
      lapTime += incidentLoss;
    }

    // Parada nos boxes.
    let pitLoss = 0;
    let pitted = false;
    if (pitCompound && !retired) {
      pitted = true;
      const laneFactor = neutral === 'sc' ? RACE.PIT_LOSS_FACTOR_SC : neutral === 'vsc' ? RACE.PIT_LOSS_FACTOR_VSC : 1;
      let service = RACE.PIT_SERVICE + (100 - team.crew) * RACE.PIT_SERVICE_PER_CREW_POINT + pitNoise * 0.4;
      if (slowStopRoll < RACE.PIT_SLOW_STOP_CHANCE * (1 - team.crew / 100)) service += lerp(RACE.PIT_SLOW_STOP_LOSS, slowStopLoss);
      const repairing = car.damage > 0.05;
      if (repairing) service += RACE.PIT_REPAIR_TIME;
      pitLoss = rules.pitLaneLoss * laneFactor + service;
      const next = car.plan[0];
      const consumesPlan = next !== undefined && (next.compound === pitCompound || next.lap - lap <= 10);
      let penaltySeconds = car.penaltySeconds;
      if (speedingRoll < RACE.PIT_SPEEDING_CHANCE * (1.5 - a.focus / 100)) {
        penaltySeconds += RACE.PIT_PENALTY;
        events.push({ lap, type: 'penalty', driverId: car.driverId, message: `${who} excede a velocidade no pit lane: ${RACE.PIT_PENALTY}s de punição.` });
      } else if (unsafeRoll < RACE.UNSAFE_RELEASE_CHANCE * (1.5 - team.crew / 100)) {
        penaltySeconds += RACE.PIT_PENALTY;
        events.push({ lap, type: 'penalty', driverId: car.driverId, message: `Liberação insegura de ${who} nos boxes: ${RACE.PIT_PENALTY}s de punição.` });
      }
      events.push({ lap, type: 'pit', driverId: car.driverId, message: `${who} para nos boxes: pneu ${TYRES[pitCompound].label.toLowerCase()}${repairing ? ' e reparo' : ''} (${service.toFixed(1)}s).` });
      car = {
        ...car,
        tyre: { compound: pitCompound, wear: 0, age: 0 },
        compoundsUsed: [...car.compoundsUsed, pitCompound],
        damage: repairing ? 0 : car.damage,
        pitStops: car.pitStops + 1,
        plan: consumesPlan ? car.plan.slice(1) : car.plan,
        penaltySeconds,
      };
    } else if (!retired) {
      // Desgaste e idade do pneu (só para quem não trocou nesta volta).
      const wearScale = neutral === 'none' ? fx.tyreWear : 0.3;
      const wear = tyreWearPerLap(a, track, weather, wearScale * TYRES[car.tyre.compound].wear * tyreCond.wear, car.modifiers.tyreWearFactor);
      car = { ...car, tyre: { ...car.tyre, wear: Math.min(1, car.tyre.wear + wear), age: car.tyre.age + 1 } };
    }

    // Combustível.
    if (rules.fuel && !retired) {
      const use = neutral === 'sc' ? RACE.FUEL_USE_SC : neutral === 'vsc' ? RACE.FUEL_USE_VSC : RACE.FUEL_USE[mode];
      const fuel = car.fuel - use;
      if (fuel < 0) {
        retired = 'fuel';
        events.push({ lap, type: 'fuel', driverId: car.driverId, message: `${who} fica sem combustível e para na pista.` });
      }
      car = { ...car, fuel: Math.max(0, fuel) };
    }

    return {
      car: { ...car, mode },
      driver,
      team,
      mode,
      cond,
      paceLap: lapTime,
      newTotal: car.totalTime + lapTime + pitLoss,
      retired,
      compromised: pitted || incidentLoss >= COMPROMISED_LOSS,
      pitted,
      pitLoss,
    };
  });

  // Fila dupla: quando os dois carros da equipe param juntos, o de trás espera.
  const pittedTeams = new Set<string>();
  for (const w of work) {
    if (!w.pitted) continue;
    if (pittedTeams.has(w.car.teamId)) {
      w.newTotal += RACE.PIT_DOUBLE_STACK_LOSS;
      w.pitLoss += RACE.PIT_DOUBLE_STACK_LOSS;
    }
    pittedTeams.add(w.car.teamId);
  }

  /* ---------- 2. Resolução de posições ---------- */
  let resolved: LapWork[] = [];
  const retiredNow: LapWork[] = [];

  if (neutral === 'sc') {
    // Fila atrás do safety car: ninguém ultrapassa; quem para nos boxes volta mais atrás.
    let previous: LapWork | null = null;
    for (const w of work) {
      if (w.retired) {
        retiredNow.push(w);
        continue;
      }
      if (w.pitted) {
        w.newTotal = w.car.totalTime + reference * RACE.SC_CATCHUP_FACTOR + w.pitLoss;
      } else {
        const own: number = w.car.totalTime + reference * (previous ? RACE.SC_CATCHUP_FACTOR : RACE.SC_LAP_FACTOR);
        w.newTotal = previous ? Math.max(own, previous.newTotal + RACE.SC_GAP) : own;
        previous = w;
      }
      resolved.push(w);
    }
    resolved.sort((x, y) => x.newTotal - y.newTotal);
    for (let i = 1; i < resolved.length; i++) {
      const prev = need(resolved[i - 1], 'fila');
      const cur = need(resolved[i], 'fila');
      cur.newTotal = Math.max(cur.newTotal, prev.newTotal + RACE.SC_GAP);
    }
  } else {
    const difficulty =
      track.overtakingDifficulty *
      (standingStart ? SIM.FIRST_LAP_DIFFICULTY_FACTOR : state.restart === 'rolling' ? RACE.RESTART_DIFFICULTY_FACTOR : 1);

    for (const w of work) {
      if (w.retired) {
        retiredNow.push(w);
        continue;
      }
      resolved.push(w);
      let idx = resolved.length - 1;
      let passes = 0;
      while (idx > 0) {
        const ahead = need(resolved[idx - 1], 'carro à frente');
        if (w.newTotal >= ahead.newTotal + SIM.MIN_GAP) break; // pista livre

        if (ahead.compromised) {
          // O carro da frente rodou ou parou: passa sem disputa.
          ahead.newTotal = Math.max(ahead.newTotal, w.newTotal + SIM.MIN_GAP);
          resolved[idx - 1] = w;
          resolved[idx] = ahead;
          idx--;
          continue;
        }

        const paceAdvantage = ahead.paceLap - w.paceLap;
        if (neutral === 'vsc' || w.compromised || paceAdvantage <= 0 || passes >= SIM.MAX_PASSES_PER_LAP) {
          w.newTotal = ahead.newTotal + SIM.MIN_GAP; // preso atrás
          break;
        }

        const rng = createRng(hashSeed(state.seed, lap, 'pass', w.car.driverId, ahead.car.driverId));
        const successRoll = rng.next();
        const collisionRoll = rng.next();
        const collisionDnfRoll = rng.next();
        const victimRoll = rng.next();
        const faultRoll = rng.next();
        const attackerDamage = rng.next();
        const defenderDamage = rng.next();
        const injuryRoll = rng.next();

        const attackFx = RACE_MODE_EFFECTS[w.mode];
        const defendFx = RACE_MODE_EFFECTS[ahead.mode];
        const logit =
          SIM.PASS_LOGIT_BASE +
          SIM.PASS_LOGIT_SKILL * (w.driver.attributes.overtaking - ahead.driver.attributes.defending) +
          SIM.PASS_LOGIT_PACE * paceAdvantage -
          SIM.PASS_LOGIT_DIFFICULTY * difficulty +
          attackFx.attack -
          defendFx.defend +
          w.cond.attack -
          ahead.cond.attack * 0.5;
        const attacker = name(w.car.driverId);
        const defender = name(ahead.car.driverId);

        if (successRoll < sigmoid(logit)) {
          ahead.newTotal = Math.max(ahead.newTotal + SIM.DEFENDED_PASS_LOSS, w.newTotal + SIM.MIN_GAP);
          resolved[idx - 1] = w;
          resolved[idx] = ahead;
          w.car = { ...w.car, overtakes: w.car.overtakes + 1 };
          events.push({ lap, type: 'overtake', driverId: w.car.driverId, otherDriverId: ahead.car.driverId, message: `${attacker} ultrapassa ${defender} e assume a ${idx}ª posição.` });
          idx--;
          passes++;
          continue;
        }

        // Tentativa frustrada: risco de toque. Cresce com a agressividade e com a
        // rivalidade entre os dois; cai com a leitura de corrida do atacante.
        const rivalry = rivalryBetween(ctx, state.playerDriverId, w.car.driverId, ahead.car.driverId);
        const collisionChance =
          SIM.COLLISION_ON_FAILED_PASS * attackFx.collision * (1.2 - w.driver.attributes.racecraft / 100) * (1 + rivalry / 100);
        if (collisionRoll < collisionChance) {
          incidents.push('collision');
          const attackerAtFault = faultRoll < RACE.COLLISION_FAULT_CHANCE;
          if (collisionDnfRoll < SIM.COLLISION_DNF_SHARE) {
            const victim = victimRoll < 0.6 ? w : ahead;
            const other = victim === w ? ahead : w;
            victim.retired = 'collision';
            const injured = injuryRoll < injuryChance(ctx);
            victim.car = { ...victim.car, injured, damageTotal: victim.car.damageTotal + 1 };
            other.car = { ...other.car, damage: other.car.damage + 0.2, damageTotal: other.car.damageTotal + 0.2 };
            events.push({
              lap,
              type: 'dnf',
              driverId: victim.car.driverId,
              otherDriverId: other.car.driverId,
              message: `Toque entre ${attacker} e ${defender}! ${name(victim.car.driverId)} está fora.${injured ? ' O piloto é levado ao centro médico.' : ''}`,
            });
            if (attackerAtFault && victim === ahead) {
              w.car = {
                ...w.car,
                penaltySeconds: w.car.penaltySeconds + RACE.COLLISION_DNF_PENALTY,
                penaltyPoints: w.car.penaltyPoints + 2,
                gridDropNext: w.car.gridDropNext + RACE.COLLISION_DNF_GRID_DROP,
              };
              events.push({ lap, type: 'penalty', driverId: w.car.driverId, otherDriverId: ahead.car.driverId, message: `${attacker} é punido por causar o acidente: ${RACE.COLLISION_DNF_PENALTY}s e ${RACE.COLLISION_DNF_GRID_DROP} posições no próximo grid.` });
            }
            if (victim === w) {
              resolved.splice(idx, 1);
              retiredNow.push(w);
              break;
            }
            resolved.splice(idx - 1, 1);
            retiredNow.push(ahead);
            idx--;
            continue; // o atacante segue disputando com quem está à frente
          }
          const dmgA = lerp(RACE.DAMAGE_COLLISION_ATTACKER, attackerDamage);
          const dmgD = lerp(RACE.DAMAGE_COLLISION_DEFENDER, defenderDamage);
          w.newTotal += 2.0;
          ahead.newTotal += 0.8;
          w.car = { ...w.car, damage: w.car.damage + dmgA, damageTotal: w.car.damageTotal + dmgA };
          ahead.car = { ...ahead.car, damage: ahead.car.damage + dmgD, damageTotal: ahead.car.damageTotal + dmgD };
          events.push({ lap, type: 'collision', driverId: w.car.driverId, otherDriverId: ahead.car.driverId, message: `${attacker} toca em ${defender}. Os dois perdem tempo e saem com danos.` });
          if (attackerAtFault) {
            w.car = { ...w.car, penaltySeconds: w.car.penaltySeconds + RACE.COLLISION_PENALTY, penaltyPoints: w.car.penaltyPoints + 1 };
            events.push({ lap, type: 'penalty', driverId: w.car.driverId, otherDriverId: ahead.car.driverId, message: `${attacker} recebe ${RACE.COLLISION_PENALTY}s por causar o toque.` });
          }
        }
        w.newTotal = Math.max(w.newTotal, ahead.newTotal + SIM.MIN_GAP + SIM.FAILED_PASS_LOSS);
        break;
      }
    }

    // Os tempos respeitam a ordem de pista.
    for (let i = 1; i < resolved.length; i++) {
      const prev = need(resolved[i - 1], 'ordem');
      const cur = need(resolved[i], 'ordem');
      cur.newTotal = Math.max(cur.newTotal, prev.newTotal + ORDER_GAP);
    }
  }
  resolved = resolved.filter((w) => !w.retired);

  /* ---------- 3. Atualização dos carros ---------- */
  let fastestLap = state.fastestLap;
  let runningCars: RaceCar[] = resolved.map((w) => {
    const actualLap = round3(w.newTotal - w.car.totalTime);
    const green = neutral === 'none' && !standingStart && !w.pitted;
    const bestLap = green ? (w.car.bestLap === null ? actualLap : Math.min(w.car.bestLap, actualLap)) : w.car.bestLap;
    if (green && (fastestLap === null || actualLap < fastestLap.time)) fastestLap = { driverId: w.car.driverId, time: actualLap, lap };
    return { ...w.car, totalTime: round3(w.newTotal), lapsCompleted: lap, lastLap: actualLap, bestLap };
  });
  if (fastestLap && fastestLap !== state.fastestLap && lap >= 3) {
    events.push({ lap, type: 'fastestLap', driverId: fastestLap.driverId, message: `${name(fastestLap.driverId)} marca a volta mais rápida: ${fastestLap.time.toFixed(3)}s.` });
  }
  const newlyRetired: RaceCar[] = retiredNow.map((w) => ({ ...w.car, status: 'dnf', dnfReason: w.retired ?? 'crash', lapsCompleted: lap - 1, lastLap: null }));

  if (lap === 1) {
    const leader = runningCars[0];
    if (leader) events.unshift({ lap, type: 'start', driverId: leader.driverId, message: `Largada! ${name(leader.driverId)} lidera a primeira volta.` });
  } else if (state.restart !== 'none') {
    const leader = runningCars[0];
    if (leader) events.unshift({ lap, type: 'restart', driverId: leader.driverId, message: state.restart === 'standing' ? `Relargada parada! ${name(leader.driverId)} mantém a ponta.` : `Bandeira verde! ${name(leader.driverId)} comanda a relargada.` });
  }

  /* ---------- 4. Direção de prova ---------- */
  let neutralization: Neutralization = state.neutralization;
  let restart: RaceSimState['restart'] = 'none';
  let endedEarly = false;
  let { safetyCars, virtualSafetyCars, redFlags } = state;
  const leaderId = runningCars[0]?.driverId ?? '';

  if (neutralization.type !== 'none') {
    const lapsLeft = neutralization.lapsLeft - 1;
    if (lapsLeft <= 0) {
      restart = neutralization.type === 'sc' ? 'rolling' : 'none';
      if (neutralization.type === 'vsc') events.push({ lap, type: 'restart', driverId: leaderId, message: 'Fim do safety car virtual: bandeira verde.' });
      else events.push({ lap, type: 'safetyCar', driverId: leaderId, message: 'O safety car entra nos boxes ao fim desta volta.' });
      neutralization = { type: 'none' };
    } else {
      neutralization = { type: neutralization.type, lapsLeft };
    }
  }

  if (incidents.length > 0 && lap < state.totalLaps && runningCars.length > 1) {
    const rng = createRng(hashSeed(state.seed, lap, 'race-control'));
    let call = 'none' as RaceControlCall;
    const rank = { none: 0, vsc: 1, sc: 2, red: 3 } as const;
    for (const incident of incidents) {
      const [sc, vsc, red] = RACE.NEUTRALIZATION_ODDS[incident];
      const roll = rng.next();
      const heavyRainRoll = rng.next();
      let outcome: RaceControlCall = 'none';
      if (rules.redFlag && (roll < red || (wetness >= 0.9 && incident !== 'mechanical' && incident !== 'spin' && heavyRainRoll < RACE.RED_FLAG_HEAVY_RAIN_CHANCE))) outcome = 'red';
      else if (rules.safetyCar && roll < red + sc) outcome = 'sc';
      else if (roll < red + sc + vsc) outcome = rules.virtualSafetyCar ? 'vsc' : 'none';
      if (rank[outcome] > rank[call]) call = outcome;
    }
    const lapsRoll = rng.next();

    if (call === 'red') {
      redFlags++;
      neutralization = { type: 'none' };
      if (lap / state.totalLaps >= RACE.RED_FLAG_END_PROGRESS) {
        endedEarly = true;
        events.push({ lap, type: 'redFlag', driverId: leaderId, message: 'Bandeira vermelha! A corrida é encerrada e o resultado desta volta é o oficial.' });
      } else {
        restart = 'standing';
        const nextWetness = state.wetnessByLap[lap + 1] ?? wetness;
        const leaderTime = runningCars[0]?.totalTime ?? 0;
        // Corrida interrompida: pelotão reagrupado, reparos e troca de pneus liberados.
        runningCars = runningCars.map((car, i) => {
          const compound = rules.pitStops ? bestCompoundFor(rules, nextWetness, car.plan[0]?.compound ?? car.tyre.compound) : car.tyre.compound;
          const changed = rules.pitStops;
          return {
            ...car,
            totalTime: round3(leaderTime + i * SIM.GRID_SPACING),
            damage: 0,
            tyre: changed ? { compound, wear: 0, age: 0 } : car.tyre,
            compoundsUsed: changed ? [...car.compoundsUsed, compound] : car.compoundsUsed,
            plan: changed && car.plan[0]?.compound === compound ? car.plan.slice(1) : car.plan,
          };
        });
        events.push({ lap, type: 'redFlag', driverId: leaderId, message: 'Bandeira vermelha! Corrida interrompida. Haverá relargada parada, com reparos e troca de pneus liberados.' });
      }
    } else if (call === 'sc') {
      if (neutralization.type === 'sc') {
        neutralization = { type: 'sc', lapsLeft: Math.max(neutralization.lapsLeft, 2) };
      } else {
        safetyCars++;
        neutralization = { type: 'sc', lapsLeft: Math.round(lerp(RACE.SC_LAPS, lapsRoll)) };
        restart = 'none';
        events.push({ lap, type: 'safetyCar', driverId: leaderId, message: 'Safety car na pista! O pelotão se reagrupa.' });
      }
    } else if (call === 'vsc' && neutralization.type === 'none' && restart === 'none') {
      virtualSafetyCars++;
      neutralization = { type: 'vsc', lapsLeft: Math.round(lerp(RACE.VSC_LAPS, lapsRoll)) };
      events.push({ lap, type: 'vsc', driverId: leaderId, message: 'Safety car virtual: todos reduzem o ritmo e as posições ficam congeladas.' });
    }
  }

  /* ---------- 5. Ordens de equipe ---------- */
  let pendingTeamOrder: RaceSimState['pendingTeamOrder'] = null;
  const racingNext = neutralization.type === 'none' && restart === 'none' && !endedEarly;
  if (rules.teamOrders && racingNext && lap >= 3 && state.totalLaps - lap >= 2) {
    const paceOf = new Map(resolved.map((w) => [w.car.driverId, w.paceLap]));
    for (let i = 0; i + 1 < runningCars.length; i++) {
      const front = need(runningCars[i], 'ordem de equipe');
      const back = need(runningCars[i + 1], 'ordem de equipe');
      if (front.teamId !== back.teamId || teamOrders.some((o) => o.teamId === front.teamId)) continue;
      if (back.totalTime - front.totalTime > RACE.TEAM_ORDER_GAP) continue;
      if (ctx.drivers[back.driverId]?.role !== 'first' || ctx.drivers[front.driverId]?.role === 'first') continue;
      const frontPace = paceOf.get(front.driverId) ?? 0;
      if ((paceOf.get(back.driverId) ?? Infinity) > frontPace * (1 - RACE.TEAM_ORDER_PACE_ADVANTAGE)) continue;

      if (front.driverId === state.playerDriverId) {
        pendingTeamOrder = { teamId: front.teamId, favouredDriverId: back.driverId };
        events.push({ lap, type: 'teamOrder', driverId: front.driverId, otherDriverId: back.driverId, message: `Rádio da equipe: "${name(back.driverId)} está mais rápido. Deixe-o passar."` });
        break;
      }
      const obeyed = createRng(hashSeed(state.seed, lap, 'team-order', front.driverId)).next() < RACE.TEAM_ORDER_AI_OBEY;
      teamOrders.push({ lap, teamId: front.teamId, askedDriverId: front.driverId, favouredDriverId: back.driverId, obeyed });
      if (obeyed) {
        runningCars = swapForTeamOrder(runningCars, i);
        events.push({ lap, type: 'teamOrder', driverId: front.driverId, otherDriverId: back.driverId, message: `Ordem de equipe: ${name(front.driverId)} deixa ${name(back.driverId)} passar.` });
      } else {
        events.push({ lap, type: 'teamOrder', driverId: front.driverId, otherDriverId: back.driverId, message: `${name(front.driverId)} ignora a ordem da equipe para deixar ${name(back.driverId)} passar.` });
      }
    }
  }

  if (lap === state.totalLaps && !endedEarly) {
    const winner = runningCars[0];
    if (winner) events.push({ lap, type: 'finish', driverId: winner.driverId, message: 'Bandeirada! Fim de corrida.' });
  }

  return {
    ...state,
    currentLap: lap,
    weather: state.weather,
    neutralization,
    restart,
    endedEarly,
    // Abandonos mais recentes ficam à frente dos anteriores (completaram mais voltas).
    cars: [...runningCars, ...newlyRetired, ...retiredBefore],
    events: [...state.events, ...events],
    fastestLap,
    pendingTeamOrder,
    teamOrders,
    safetyCars,
    virtualSafetyCars,
    redFlags,
  };
}

/** Troca de posições entre companheiros: o carro em `index` cede a posição ao seguinte. */
function swapForTeamOrder(cars: RaceCar[], index: number): RaceCar[] {
  const front = cars[index];
  const back = cars[index + 1];
  if (!front || !back) return cars;
  const next = [...cars];
  next[index] = { ...back, totalTime: front.totalTime };
  next[index + 1] = { ...front, totalTime: Math.max(back.totalTime, front.totalTime + RACE.TEAM_ORDER_SWAP_LOSS) };
  return next;
}

function injuryChance(ctx: RaceContext): number {
  if (ctx.category.vehicle === 'kart') return RACE.INJURY_CHANCE.kart;
  return ctx.category.tier >= 7 ? RACE.INJURY_CHANCE.f1 : RACE.INJURY_CHANCE.formula;
}

function rivalryBetween(ctx: RaceContext, playerId: string, a: string, b: string): number {
  if (!ctx.rivalries) return 0;
  if (a === playerId) return ctx.rivalries[b] ?? 0;
  if (b === playerId) return ctx.rivalries[a] ?? 0;
  return 0;
}

/** Simula todas as voltas restantes. Com `auto`, o engenheiro cuida de paradas e combustível. */
export function simulateRemainingRace(state: RaceSimState, ctx: RaceContext, input: PlayerRaceInput): RaceSimState {
  let current = state;
  while (!isRaceFinished(current)) current = stepRaceLap(current, ctx, { ...input, pit: null });
  return current;
}

/** Diferença para o líder, em segundos (null para abandono). */
export function gapToLeader(state: RaceSimState, car: RaceCar): number | null {
  const leader = state.cars[0];
  if (!leader || car.status === 'dnf') return null;
  return round3(car.totalTime - leader.totalTime);
}
