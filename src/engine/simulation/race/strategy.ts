/**
 * Estratégia de pneus e decisões de box.
 *
 * As mesmas funções servem ao jogador (opções mostradas antes da largada e
 * piloto automático) e à IA. Nenhuma decisão usa sorteio.
 */
import { TYRE_CURVE } from '@/config/balance';
import type { DriverAttributes, Track, TyreCompound } from '@/domain/schemas';
import { compareText } from '@/domain/text';
import type { RaceRules } from '@/data/categories';
import { RACE, SIM, TYRES } from '../constants';
import { tyreCliff, tyreConditionEffect, tyreManagementFactor, tyrePaceLoss } from '../performance';
import type { PlannedStop, RaceCar, StrategyPlan } from './types';

/** Perda mínima de ritmo (fração da volta) que justifica parar para trocar o tipo de pneu. */
const WRONG_TYRE_THRESHOLD = 0.03;
/** Dano a partir do qual vale parar para reparar. */
const REPAIR_THRESHOLD = 0.35;

/** Melhor composto para a umidade atual, entre os permitidos pela categoria. */
export function bestCompoundFor(rules: RaceRules, wetness: number, preferDry?: TyreCompound): TyreCompound {
  const candidates = [...rules.dryCompounds, ...rules.wetCompounds];
  let best: TyreCompound = rules.dryCompounds[0] ?? 'kart';
  let bestScore = Infinity;
  for (const compound of new Set(candidates)) {
    const effect = tyreConditionEffect(compound, wetness);
    // Entre compostos adequados, o preferido (da estratégia) desempata.
    const score = effect.pace + (compound === preferDry ? -0.0001 : 0) + (TYRES[compound].rain ? 0 : TYRES[compound].pace * 0.01);
    if (score < bestScore) {
      bestScore = score;
      best = compound;
    }
  }
  return best;
}

/**
 * Desgaste por volta de um composto em pista seca e ritmo equilibrado (base das estimativas).
 * `factor` junta o que é próprio do piloto e do fim de semana: o treino de ritmo de corrida
 * (`tyreWearFactor`) e o poupador ou gastador de pneus (`profile.tyreWear`).
 */
export function baseWearPerLap(attributes: DriverAttributes, track: Track, compound: TyreCompound, factor = 1): number {
  return SIM.TYRE_WEAR_PER_LAP * track.tyreWear * tyreManagementFactor(attributes) * TYRES[compound].wear * factor;
}

/** Voltas que um pneu novo deste composto dura até o penhasco, para este piloto nesta pista. */
export function compoundLifeLaps(attributes: DriverAttributes, track: Track, compound: TyreCompound, factor = 1): number {
  return tyreCliff(compound) / baseWearPerLap(attributes, track, compound, factor);
}

/** Tempo perdido (em frações de volta, somadas) em um stint de n voltas com o composto. */
function stintCost(attributes: DriverAttributes, track: Track, compound: TyreCompound, laps: number): number {
  const rate = baseWearPerLap(attributes, track, compound);
  let cost = 0;
  for (let i = 1; i <= laps; i++) cost += TYRES[compound].pace + tyrePaceLoss(compound, Math.min(1, rate * i));
  return cost;
}

/** Janela ideal de parada: as últimas voltas antes de o pneu cair do penhasco. */
export interface PitWindow {
  /** Primeira e última volta da janela (a parada acontece no fim da volta). */
  from: number;
  to: number;
  /** Voltas que o pneu ainda aguenta antes do penhasco, a partir de agora. */
  lapsLeft: number;
}

/**
 * Janela de parada do carro, pelo desgaste de agora e pela taxa em pista seca e ritmo equilibrado.
 * Devolve null quando o pneu chega ao fim da corrida sem cair do penhasco (não é preciso parar por
 * desgaste) e nas categorias sem boxes. `lap` é a volta já completada.
 */
export function pitWindow(
  car: Pick<RaceCar, 'tyre'>,
  attributes: DriverAttributes,
  track: Track,
  rules: RaceRules,
  lap: number,
  totalLaps: number,
  factor = 1,
): PitWindow | null {
  if (!rules.pitStops) return null;
  const rate = baseWearPerLap(attributes, track, car.tyre.compound, factor);
  const lapsLeft = Math.max(0, Math.floor((tyreCliff(car.tyre.compound) - car.tyre.wear) / rate));
  const to = lap + lapsLeft;
  if (to >= totalLaps) return null;
  return { from: Math.max(lap + 1, to - TYRE_CURVE.PIT_WINDOW_LAPS + 1), to: Math.max(lap + 1, to), lapsLeft };
}

export interface StrategyOption {
  id: string;
  label: string;
  plan: StrategyPlan;
  /** Tempo total estimado perdido com pneus e paradas, em segundos (menor é melhor). */
  estimatedLoss: number;
}

function describe(plan: StrategyPlan): string {
  const sequence = [plan.startCompound, ...plan.stops.map((s) => s.compound)].map((c) => TYRES[c].label).join(' → ');
  if (plan.stops.length === 0) return `Sem paradas (${sequence})`;
  return `${plan.stops.length} parada${plan.stops.length > 1 ? 's' : ''}: ${sequence} (volta${plan.stops.length > 1 ? 's' : ''} ${plan.stops.map((s) => s.lap).join(' e ')})`;
}

/**
 * Lista as estratégias viáveis para a corrida, da mais rápida para a mais
 * lenta na estimativa. Cada stint dura em proporção à vida útil do composto.
 * Com pista molhada na largada, a única opção é largar com o pneu adequado e
 * reagir à pista.
 */
export function buildStrategyOptions(
  rules: RaceRules,
  track: Track,
  totalLaps: number,
  lapTime: number,
  attributes: DriverAttributes,
  startWetness: number,
): StrategyOption[] {
  if (!rules.pitStops) {
    const compound = bestCompoundFor(rules, startWetness);
    return [{ id: 'none', label: 'Sem paradas', plan: { startCompound: compound, stops: [] }, estimatedLoss: 0 }];
  }
  const startBest = bestCompoundFor(rules, startWetness);
  if (TYRES[startBest].rain) {
    return [
      {
        id: 'wet-start',
        label: `Largar com pneu ${TYRES[startBest].label.toLowerCase()} e reagir à pista`,
        plan: { startCompound: startBest, stops: [] },
        estimatedLoss: 0,
      },
    ];
  }

  const dry = rules.dryCompounds;
  const sequences: TyreCompound[][] = [];
  for (const a of dry) {
    sequences.push([a]);
    for (const b of dry) {
      sequences.push([a, b]);
      for (const c of dry) sequences.push([a, b, c]);
    }
  }

  const stopCost = rules.pitLaneLoss + RACE.PIT_SERVICE + 1;
  const options: StrategyOption[] = [];
  for (const sequence of sequences) {
    if (rules.mandatoryTwoCompounds && new Set(sequence).size < 2) continue;
    const lives = sequence.map((c) => compoundLifeLaps(attributes, track, c));
    const totalLife = lives.reduce((a, b) => a + b, 0);
    // Descarta estratégias que não chegam ao fim sem cair do penhasco.
    if (totalLife < totalLaps * TYRE_CURVE.STRATEGY_MIN_LIFE) continue;
    const stops: PlannedStop[] = [];
    const stints: number[] = [];
    let covered = 0;
    sequence.forEach((compound, i) => {
      const isLast = i === sequence.length - 1;
      const laps = isLast ? totalLaps - covered : Math.max(2, Math.round((totalLaps * (lives[i] ?? 0)) / totalLife));
      stints.push(laps);
      covered += laps;
      if (!isLast) stops.push({ lap: covered, compound: sequence[i + 1] ?? compound });
    });
    if (stints.some((n) => n < 2) || covered !== totalLaps) continue;
    const tyreCost = sequence.reduce((sum, compound, i) => sum + stintCost(attributes, track, compound, stints[i] ?? 0), 0) * lapTime;
    const plan: StrategyPlan = { startCompound: sequence[0] ?? 'medium', stops };
    options.push({ id: sequence.join('-'), label: describe(plan), plan, estimatedLoss: Math.round((tyreCost + stops.length * stopCost) * 10) / 10 });
  }
  options.sort((a, b) => a.estimatedLoss - b.estimatedLoss || compareText(a.id, b.id));
  return options.slice(0, 4);
}

/**
 * Estratégia da IA: a mais rápida na estimativa. Quem larga do 11º para trás
 * escolhe a segunda opção quando ela custa até 4 s a mais: uma estratégia
 * diferente dá pista livre e chance de ganhar posições.
 */
export function chooseAiStrategy(options: readonly StrategyOption[], gridPosition: number): StrategyPlan {
  const best = options[0];
  if (!best) throw new Error('Nenhuma estratégia disponível.');
  const alternative = options[1];
  if (gridPosition > 10 && alternative && alternative.estimatedLoss - best.estimatedLoss <= 4) return clonePlan(alternative.plan);
  return clonePlan(best.plan);
}

export const clonePlan = (plan: StrategyPlan): StrategyPlan => ({ startCompound: plan.startCompound, stops: plan.stops.map((s) => ({ ...s })) });

export interface PitSituation {
  lap: number;
  totalLaps: number;
  /** Umidade em que o piloto baseia a decisão (a desta volta ou a da anterior). */
  wetness: number;
  neutralized: boolean;
  /** A corrida teve pista seca o tempo todo até aqui (regra dos dois compostos). */
  needsSecondCompound: boolean;
}

/**
 * Decide se o carro para nesta volta e com qual composto. Ordem das regras:
 * 1. Pneu errado para a pista (perda ≥ 3% da volta).
 * 2. Dano que vale o reparo.
 * 3. Parada planejada, antecipada em até 10 voltas se houver neutralização.
 * 4. Pneu além do penhasco com corrida suficiente pela frente.
 * 5. Última chance de cumprir a regra dos dois compostos.
 */
export function decidePit(car: RaceCar, rules: RaceRules, s: PitSituation): TyreCompound | null {
  if (!rules.pitStops) return null;
  const lapsRemaining = s.totalLaps - s.lap + 1;
  if (s.lap <= 1 || lapsRemaining <= 1) return null;
  const next = car.plan[0];

  const current = tyreConditionEffect(car.tyre.compound, s.wetness);
  const ideal = bestCompoundFor(rules, s.wetness, next?.compound);
  if (lapsRemaining >= 3 && ideal !== car.tyre.compound && current.pace - tyreConditionEffect(ideal, s.wetness).pace >= WRONG_TYRE_THRESHOLD) {
    return ideal;
  }

  const dryPick = (): TyreCompound => {
    if (next && !TYRES[next.compound].rain) return next.compound;
    // Sem plano: o composto mais macio que aguenta até o fim; se nenhum aguenta, o mais durável.
    const unused = rules.dryCompounds.filter((c) => !car.compoundsUsed.includes(c));
    const pool = s.needsSecondCompound && unused.length ? unused : rules.dryCompounds;
    return (
      [...pool].sort((a, b) => TYRES[a].pace - TYRES[b].pace).find((c) => tyreCliff(c) / (SIM.TYRE_WEAR_PER_LAP * TYRES[c].wear) >= lapsRemaining) ??
      pool[pool.length - 1] ??
      car.tyre.compound
    );
  };
  const sameType = (): TyreCompound => (TYRES[car.tyre.compound].rain ? car.tyre.compound : dryPick());

  if (car.damage >= REPAIR_THRESHOLD && lapsRemaining >= 5) return sameType();

  if (next && !TYRES[car.tyre.compound].rain) {
    if (s.lap >= next.lap) return next.compound;
    if (s.neutralized && next.lap - s.lap <= 10 && car.tyre.age >= 3) return next.compound;
  }

  if (car.tyre.wear >= tyreCliff(car.tyre.compound) + TYRE_CURVE.PIT_PAST_CLIFF && lapsRemaining >= TYRE_CURVE.PIT_MIN_LAPS_LEFT) return sameType();

  if (s.needsSecondCompound && lapsRemaining <= 2) return dryPick();
  return null;
}
