/**
 * Lances decisivos (Fase 4): os poucos momentos em que a corrida pausa e o jogador escolhe.
 *
 * Como funciona:
 * - No fim de cada volta (e antes da largada), `upcomingMoment` olha a corrida e decide se a volta
 *   seguinte tem um lance. O lance fica em `RaceSimState.pendingMoment`, com as opções e a chance
 *   de cada uma já calculadas. Nada disso usa sorteio: a mesma situação dá sempre as mesmas chances.
 * - Na volta seguinte, `resolveMoment` lê a resposta do jogador (`PlayerRaceInput.moment`) ou, sem
 *   resposta, a escolha do estilo do piloto (`chooseByStyle`), sorteia o desfecho com a chance que
 *   a tela mostrou e devolve o plano da volta: tempo ganho ou perdido, disputa garantida, parada,
 *   incidente. `stepRaceLap` aplica o plano ao carro do jogador.
 * - O sorteio é próprio (`hashSeed(semente, volta, 'moment', lance)`) e tem sempre o mesmo número
 *   de valores: a escolha do jogador não mexe na sorte dos outros carros.
 *
 * Só o piloto do jogador tem lances. Sem ele no grid (dirigente, etapa cumprindo suspensão), a
 * corrida corre como sempre.
 */
import { RACE_CONTACT, RACE_MOMENTS } from '@/config/balance';
import type { Driver, MomentKind, MomentOutcome, MomentRecord, RaceMode, Team, TyreCompound } from '@/domain/schemas';
import { MOMENT_CONSEQUENCE_TEXTS, MOMENT_TEXTS } from '@/data/raceMoments';
import { referenceLapTime } from '@/data/tracks';
import { createRng, hashSeed } from '../../rng';
import { SIM, TYRES } from '../constants';
import { conditionEffects, tyreCliff, tyreState, type ConditionEffects } from '../performance';
import { cleanAirLapTime } from './pace';
import { baseWearPerLap, bestCompoundFor } from './strategy';
import {
  neutralRaceProfile,
  type DriverRaceProfile,
  type MomentCarry,
  type MomentChoice,
  type MomentFactor,
  type MomentFactorKey,
  type MomentOption,
  type PlannedStop,
  type PlayerRaceInput,
  type RaceCar,
  type RaceContext,
  type RaceMoment,
  type RaceSimState,
} from './types';
import { clamp, driverName, lerp, sigmoid } from './util';
import { conditionFor } from './weatherProfile';

const M = RACE_MOMENTS;

/** O que uma opção faz na volta do lance (os campos ausentes não mudam nada). */
type MomentEffect = Readonly<Partial<Record<'time' | 'attack' | 'defend' | 'error' | 'wear' | 'rival', number>>>;

interface OptionRule {
  risk: 0 | 1 | 2;
  base: number;
  win: MomentEffect;
  lose: MomentEffect;
  crash: number;
  spin: number;
  contact: number;
  sure?: boolean;
}

const optionRules: Readonly<Record<MomentKind, Readonly<Record<string, OptionRule>>>> = M.OPTIONS;

function ruleOf(kind: MomentKind, id: string): OptionRule {
  const rule = optionRules[kind][id];
  if (!rule) throw new Error(`Opção de lance desconhecida: ${kind}.${id}`);
  return rule;
}

/** Um carro na pista com tudo o que os lances leem dele. */
interface Side {
  car: RaceCar;
  driver: Driver;
  team: Team;
  profile: DriverRaceProfile;
  cond: ConditionEffects;
}

function sideOf(state: RaceSimState, ctx: RaceContext, driverId: string | undefined): Side | null {
  if (!driverId) return null;
  const car = state.cars.find((c) => c.driverId === driverId);
  const driver = ctx.drivers[driverId];
  const team = car ? ctx.teams[car.teamId] : undefined;
  if (car?.status !== 'running' || !driver || !team) return null;
  return { car, driver, team, profile: ctx.profiles?.[driverId] ?? neutralRaceProfile(), cond: conditionEffects(driver.condition, driver.injury) };
}

/* ------------------------------------------------------------------ */
/* Estilo do piloto                                                    */
/* ------------------------------------------------------------------ */

export type DrivingStyle = 'cautious' | 'balanced' | 'aggressive';

/**
 * Estilo do piloto, de 0 (cauteloso) a 100 (agressivo). Sai dos atributos (quem ataca melhor do
 * que defende e é mais veloz do que regular arrisca mais), da confiança, do temperamento de
 * nascença (esquentado ou piloto limpo) e do ritmo que o jogador escolheu para a corrida.
 */
export function drivingStyleScore(driver: Driver, profile: DriverRaceProfile, mode: RaceMode): number {
  const a = driver.attributes;
  const S = M.STYLE;
  const raw =
    50 +
    (a.overtaking - a.defending) * S.ATTACK_VS_DEFENCE +
    (a.pace - a.consistency) * S.PACE_VS_CONSISTENCY +
    (driver.condition.confidence - 50) * S.CONFIDENCE +
    (profile.collision - 1) * S.COLLISION +
    (mode === 'aggressive' ? S.MODE : mode === 'conservative' ? -S.MODE : 0);
  return Math.round(clamp(raw, 0, 100));
}

export function drivingStyle(score: number): DrivingStyle {
  return score < M.STYLE.CAUTIOUS_BELOW ? 'cautious' : score >= M.STYLE.AGGRESSIVE_FROM ? 'aggressive' : 'balanced';
}

/**
 * A escolha do piloto quando o jogador não decide: a opção mais ousada cuja chance o estilo dele
 * aceita. Um piloto cauteloso só arrisca com 75% de chance; um agressivo, com 45%. Sem sorteio.
 */
export function chooseByStyle(moment: RaceMoment, score: number): MomentChoice {
  const t = clamp(score, 0, 100) / 100;
  const minimum = [0, lerp(M.STYLE.MODERATE_MIN_CHANCE, t), lerp(M.STYLE.RISKY_MIN_CHANCE, t)] as const;
  let pick: MomentOption | null = null;
  for (const option of moment.options) {
    if (option.chance < minimum[option.risk]) continue;
    if (!pick || option.risk > pick.risk || (option.risk === pick.risk && option.chance > pick.chance)) pick = option;
  }
  // Nenhuma opção aceitável (todas arriscadas e com pouca chance): a de maior chance.
  if (!pick) for (const option of moment.options) if (!pick || option.chance > pick.chance) pick = option;
  if (!pick) throw new Error('Lance sem opções.');
  return { option: pick.id, ...(moment.suggestedCompound ? { compound: moment.suggestedCompound } : {}) };
}

/* ------------------------------------------------------------------ */
/* Chances                                                             */
/* ------------------------------------------------------------------ */

type Parts = Partial<Record<MomentFactorKey, number>>;

const clampChance = (p: number) => clamp(p, M.CHANCE_MIN, M.CHANCE_MAX);
const addParts = (a: Parts, b: Parts): Parts => {
  const out: Parts = { ...a };
  for (const [key, value] of Object.entries(b) as [MomentFactorKey, number][]) out[key] = (out[key] ?? 0) + value;
  return out;
};
const scaleParts = (parts: Parts, factor: number): Parts => Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, (v ?? 0) * factor]));

function optionTexts(kind: MomentKind, id: string, rival: string) {
  const text = MOMENT_TEXTS[kind].options[id];
  if (!text) throw new Error(`Texto ausente para o lance ${kind}.${id}`);
  return { label: text.label, gain: text.gain(rival), loss: text.loss(rival) };
}

/** Fatores ordenados do que mais pesa para o que menos pesa; os que não mexem um ponto somem. */
function sortFactors(factors: MomentFactor[]): MomentFactor[] {
  return factors.filter((f) => f.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || (a.key < b.key ? -1 : 1));
}

/** Opção cuja chance é uma logística: base da opção mais a soma das partes. */
function logitOption(kind: MomentKind, id: string, parts: Parts, rival: string): MomentOption {
  const rule = ruleOf(kind, id);
  const entries = Object.entries(parts) as [MomentFactorKey, number][];
  const total = rule.base + entries.reduce((sum, [, v]) => sum + v, 0);
  const chance = rule.sure ? 1 : clampChance(sigmoid(total));
  const factors = rule.sure ? [] : entries.map(([key, value]) => ({ key, points: Math.round((sigmoid(total) - sigmoid(total - value)) * 100) }));
  return { id, ...optionTexts(kind, id, rival), chance: Math.round(chance * 1000) / 1000, risk: rule.risk, factors: sortFactors(factors) };
}

/** Opção cuja chance é uma soma direta de probabilidades (esperar o erro do rival). */
function additiveOption(kind: MomentKind, id: string, base: number, parts: Parts, max: number, rival: string): MomentOption {
  const rule = ruleOf(kind, id);
  const entries = Object.entries(parts) as [MomentFactorKey, number][];
  const chance = clamp(base + entries.reduce((sum, [, v]) => sum + v, 0), M.CHANCE_MIN, max);
  const factors = entries.map(([key, value]) => ({ key, points: Math.round(value * 100) }));
  return { id, ...optionTexts(kind, id, rival), chance: Math.round(chance * 1000) / 1000, risk: rule.risk, factors: sortFactors(factors) };
}

/** Habilidade em relação ao nível do grid da categoria: 0 = piloto médio do campeonato. */
const skill = (ctx: RaceContext, value: number) => (value - ctx.category.field.driverLevel) / M.SKILL_SCALE;

/** Vantagem de ritmo de `fast` sobre `slow` em pista livre, em segundos por volta (limitada). */
function paceEdge(state: RaceSimState, ctx: RaceContext, fast: Side, slow: Side, wetness: number): number {
  const lap = (side: Side) => cleanAirLapTime(side.car, ctx, wetness, state.totalLaps, state.weather.trackTemp);
  return clamp(lap(slow) - lap(fast), M.PACE_EDGE_RANGE[0], M.PACE_EDGE_RANGE[1]);
}

/**
 * As partes do logit de uma disputa em que `attacker` tenta passar `defender`: os mesmos termos das
 * disputas de sempre (`SIM.PASS_LOGIT_*`), sem a base e sem o modo de pilotagem, mais a chuva.
 * As partes são do ponto de vista do atacante.
 */
function duelParts(state: RaceSimState, ctx: RaceContext, attacker: Side, defender: Side, wetness: number, lastLap: boolean): Parts {
  const a = attacker.driver.attributes;
  const d = defender.driver.attributes;
  return {
    driver: SIM.PASS_LOGIT_SKILL * (a.overtaking - d.defending),
    tyres: SIM.PASS_LOGIT_PACE * paceEdge(state, ctx, attacker, defender, wetness),
    track: -SIM.PASS_LOGIT_DIFFICULTY * ctx.track.overtakingDifficulty,
    form: attacker.cond.attack - defender.cond.attack * 0.5,
    profile:
      attacker.profile.attack +
      attacker.profile.duel -
      defender.profile.duel +
      (lastLap ? attacker.profile.lastLapDuel - defender.profile.lastLapDuel : 0) -
      (attacker.profile.wetError - defender.profile.wetError) * wetness,
    weather: (wetness * (a.wetSkill - d.wetSkill)) / M.SKILL_SCALE,
  };
}

/* ------------------------------------------------------------------ */
/* Os seis lances                                                      */
/* ------------------------------------------------------------------ */

function moment(kind: MomentKind, lap: number, rival: Side | null, rivalName: string, options: MomentOption[], extra: Partial<RaceMoment> = {}): RaceMoment {
  const text = MOMENT_TEXTS[kind];
  return { kind, lap, rivalId: rival?.car.driverId ?? null, title: text.title, question: text.question(rivalName), options, ...extra };
}

function startMoment(state: RaceSimState, ctx: RaceContext, me: Side): RaceMoment {
  const a = me.driver.attributes;
  const S = M.START;
  const wetness = state.wetnessByLap[1] ?? state.weather.wetness;
  // O vizinho de grid com quem um toque na primeira curva aconteceria: o da frente (ou o de trás, para o pole).
  const index = state.cars.findIndex((c) => c.driverId === me.car.driverId);
  const neighbour = sideOf(state, ctx, state.cars[index - 1]?.driverId) ?? sideOf(state, ctx, state.cars[index + 1]?.driverId);
  const reaction: Parts = {
    driver: skill(ctx, (a.experience + a.focus) / 2) * S.SKILL,
    profile: (1 - me.profile.startSpread) * S.REACTION - me.profile.startGain * S.GAIN - me.profile.wetError * wetness,
    form: me.cond.attack * 0.5,
    weather: -wetness * S.WET * (1 - a.wetSkill / 100) * 2,
  };
  const options = [
    logitOption('start', 'inside', addParts(reaction, { driver: skill(ctx, a.overtaking) * S.OVERTAKING }), ''),
    logitOption('start', 'outside', addParts(reaction, { driver: skill(ctx, a.overtaking) * S.OVERTAKING * 0.5 }), ''),
    logitOption('start', 'hold', addParts(scaleParts(reaction, 0.5), { driver: skill(ctx, a.defending) * S.DEFENDING }), ''),
  ];
  return moment('start', 1, neighbour, '', options);
}

function attackMoment(state: RaceSimState, ctx: RaceContext, me: Side, rival: Side, lap: number, wetness: number): RaceMoment {
  const A = M.ATTACK;
  const name = driverName(ctx, rival.car.driverId);
  const duel = duelParts(state, ctx, me, rival, wetness, false);
  const r = rival.driver.attributes;
  const progress = state.totalLaps > 1 ? (lap - 1) / (state.totalLaps - 1) : 1;
  const rivalTyres = tyreState(rival.car.tyre.compound, rival.car.tyre.wear);
  const wait: Parts = {
    rival: (100 - r.consistency) * A.WAIT_PER_CONSISTENCY + (100 - r.focus) * A.WAIT_PER_FOCUS * progress,
    tyres: rivalTyres === 'gone' ? A.WAIT_TYRE_GONE : rivalTyres === 'limit' ? A.WAIT_TYRE_LIMIT : 0,
    weather: wetness * (1 - r.wetSkill / 100) * A.WAIT_WET,
    driver: Math.max(0, me.driver.attributes.racecraft - r.racecraft) * A.WAIT_PER_RACECRAFT,
  };
  const slipstream = addParts(duel, {
    track: A.SLIP_POWER * (ctx.track.powerSensitivity - 0.5),
    car: A.SLIP_ENGINE * (me.team.car.engine - rival.team.car.engine),
  });
  const options = [
    logitOption('attack', 'dive', duel, name),
    additiveOption('attack', 'wait', A.WAIT_BASE, wait, A.WAIT_MAX, name),
    logitOption('attack', 'slipstream', slipstream, name),
  ];
  return moment('attack', lap, rival, name, options);
}

function defenseMoment(state: RaceSimState, ctx: RaceContext, me: Side, rival: Side, lap: number, wetness: number): RaceMoment {
  const name = driverName(ctx, rival.car.driverId);
  // A chance de segurar é o espelho da chance de o rival passar.
  const block = scaleParts(duelParts(state, ctx, rival, me, wetness, false), -1);
  return moment('defense', lap, rival, name, [logitOption('defense', 'block', block, name), logitOption('defense', 'yield', {}, name)]);
}

function rainMoment(state: RaceSimState, ctx: RaceContext, me: Side, lap: number): RaceMoment {
  const R = M.RAIN;
  const a = me.driver.attributes;
  const coming = Math.max(state.wetnessByLap[lap] ?? 0, state.wetnessByLap[lap + 1] ?? 0);
  const pit: Parts = { crew: (me.team.crew - 75) * R.PIT_PER_CREW };
  const stay: Parts = {
    driver: skill(ctx, a.wetSkill) * R.WET_SKILL + skill(ctx, a.racecraft) * R.RACECRAFT,
    weather: -R.SEVERITY * coming,
    profile: -me.profile.wetError * R.PROFILE_ERROR - me.profile.wetPace * R.PROFILE_PACE,
  };
  const compound = bestCompoundFor(ctx.category.race, coming);
  return moment('rain', lap, null, '', [logitOption('rain', 'pit', pit, ''), logitOption('rain', 'stay', stay, '')], { suggestedCompound: compound });
}

function lastLapMoment(state: RaceSimState, ctx: RaceContext, me: Side, rival: Side | null, lap: number, wetness: number): RaceMoment {
  const L = M.LAST_LAP;
  const a = me.driver.attributes;
  const name = rival ? driverName(ctx, rival.car.driverId) : '';
  const tyres = tyreState(me.car.tyre.compound, me.car.tyre.wear);
  const allIn: Parts = rival
    ? duelParts(state, ctx, me, rival, wetness, true)
    : {
        driver: skill(ctx, a.pace) * L.PACE + skill(ctx, a.consistency) * L.CONSISTENCY,
        tyres: tyres === 'gone' ? -1 : tyres === 'limit' ? -0.4 : 0,
        profile: me.profile.lastLapDuel - me.profile.wetError * wetness,
        weather: -wetness * (1 - a.wetSkill / 100) * 2,
        form: me.cond.attack * 0.5,
      };
  const secure: Parts = {
    driver: skill(ctx, a.consistency) * L.SECURE_CONSISTENCY,
    profile: -Math.log(Math.max(0.2, me.profile.lastLapError)) * L.SECURE_PROFILE,
    weather: -wetness * (1 - a.wetSkill / 100) * 2,
  };
  return moment('lastLap', lap, rival, name, [logitOption('lastLap', 'allIn', allIn, name), logitOption('lastLap', 'secure', secure, name)]);
}

/** Compostos de pista seca que o jogador pode colocar na parada, respeitando a regra dos dois compostos. */
function pitCompounds(ctx: RaceContext, car: RaceCar): TyreCompound[] {
  const rules = ctx.category.race;
  const dry = [...new Set(rules.dryCompounds)];
  if (!rules.mandatoryTwoCompounds) return dry;
  const used = new Set(car.compoundsUsed.filter((c) => !TYRES[c].rain));
  const unused = dry.filter((c) => !used.has(c));
  // Com um composto só usado até aqui, a parada tem de trazer outro.
  return used.size < 2 && unused.length > 0 ? unused : dry;
}

function pitMoment(ctx: RaceContext, me: Side, lap: number): RaceMoment | null {
  const P = M.PIT;
  const a = me.driver.attributes;
  const compounds = pitCompounds(ctx, me.car);
  const first = compounds[0];
  if (!first) return null;
  const planned = me.car.plan[0]?.compound;
  const suggested = planned && compounds.includes(planned) ? planned : first;
  const rate = baseWearPerLap(a, ctx.track, me.car.tyre.compound, me.car.modifiers.tyreWearFactor * me.profile.tyreWear);
  const margin = clamp((tyreCliff(me.car.tyre.compound) - me.car.tyre.wear) / rate - P.STRETCH_LAPS, -4, 4);
  const undercut: Parts = {
    crew: (me.team.crew - 75) * P.CREW,
    driver: skill(ctx, a.pace) * P.PACE,
    tyres: (me.car.tyre.wear - 0.5) * P.WORN,
  };
  const overcut: Parts = {
    tyres: margin * P.MARGIN,
    driver: skill(ctx, a.tyreManagement) * P.TYRE_MANAGEMENT,
    profile: -Math.log(me.profile.tyreWear) * P.PROFILE_WEAR,
  };
  return moment('pit', lap, null, '', [logitOption('pit', 'undercut', undercut, ''), logitOption('pit', 'overcut', overcut, '')], {
    compounds,
    suggestedCompound: suggested,
  });
}

/* ------------------------------------------------------------------ */
/* Qual lance vem aí                                                   */
/* ------------------------------------------------------------------ */

/**
 * O lance da próxima volta, se houver. `state` é a corrida como está agora (antes da largada ou no
 * fim de uma volta). A ordem de prioridade é: última volta, chuva, parada, ataque, defesa.
 */
export function upcomingMoment(state: RaceSimState, ctx: RaceContext): RaceMoment | null {
  if (state.currentLap >= state.totalLaps || state.endedEarly) return null;
  const me = sideOf(state, ctx, state.playerDriverId);
  if (!me) return null;
  const lap = state.currentLap + 1;
  if (lap === 1) return startMoment(state, ctx, me);
  const done = state.moments;
  if (done.length >= M.MAX_PER_RACE) return null;
  // Atrás do safety car (ou sob o virtual) ninguém disputa: não há lance. Uma corrida que termina
  // assim pode ficar só com o da largada.
  if (state.neutralization.type !== 'none') return null;

  const rules = ctx.category.race;
  const running = state.cars.filter((c) => c.status === 'running');
  const index = running.findIndex((c) => c.driverId === me.car.driverId);
  const ahead = sideOf(state, ctx, running[index - 1]?.driverId);
  const behind = sideOf(state, ctx, running[index + 1]?.driverId);
  const gapAhead = ahead ? me.car.totalTime - ahead.car.totalTime : Number.POSITIVE_INFINITY;
  const gapBehind = behind ? behind.car.totalTime - me.car.totalTime : Number.POSITIVE_INFINITY;
  const wetness = state.wetnessByLap[lap] ?? state.weather.wetness;
  const lapsAfter = state.totalLaps - lap;

  if (lap === state.totalLaps) {
    const fight = gapAhead <= M.LAST_LAP_GAP || gapBehind <= M.LAST_LAP_GAP;
    const rival = gapAhead <= M.LAST_LAP_REACH ? ahead : null;
    // Vale também na relargada: é a última chance de disputar.
    return done.length < M.MIN_PER_RACE || fight ? lastLapMoment(state, ctx, me, rival, lap, wetness) : null;
  }
  // Uma pergunta por volta: com ordem de equipe pendente ou em relargada não há lance de meio de corrida.
  if (state.pendingTeamOrder || state.restart !== 'none') return null;

  const had = (kind: MomentKind) => done.some((m) => m.kind === kind);
  const canPit = rules.pitStops && lapsAfter >= 2;
  const onDryTyres = !TYRES[me.car.tyre.compound].rain;

  // Chuva começando: a pista passa de seca a úmida na próxima volta e o carro está com pneu de seco.
  const previousWetness = state.wetnessByLap[state.currentLap] ?? state.weather.wetness;
  if (canPit && rules.changingWeather && onDryTyres && !had('rain') && conditionFor(previousWetness) === 'dry' && conditionFor(wetness) !== 'dry') {
    return rainMoment(state, ctx, me, lap);
  }

  // Parada: a planejada está chegando (ou o pneu entrou no limite sem parada marcada), em pista seca.
  if (canPit && onDryTyres && !had('pit') && conditionFor(wetness) === 'dry' && lapsAfter >= M.PIT.STRETCH_LAPS + 2) {
    const next = me.car.plan[0];
    const due = next !== undefined && !TYRES[next.compound].rain && next.lap >= lap && next.lap - lap <= M.PIT.LEAD_LAPS;
    const worn = next === undefined && tyreState(me.car.tyre.compound, me.car.tyre.wear) === 'limit';
    if (due || worn) {
      const pit = pitMoment(ctx, me, lap);
      if (pit) return pit;
    }
  }

  // Disputas: com intervalo entre elas, fora das primeiras voltas e da penúltima, e guardando um lance para o fim.
  const duels = done.filter((m) => m.kind === 'attack' || m.kind === 'defense').length;
  const lastLapOfMoment = done.at(-1)?.lap ?? 0;
  const cooldown = Math.max(M.COOLDOWN_LAPS, Math.round(state.totalLaps * M.COOLDOWN_SHARE));
  if (duels >= M.MAX_DUELS || done.length >= M.MAX_PER_RACE - 1 || lapsAfter < 2 || lap - lastLapOfMoment < cooldown) return null;
  const canAttack = ahead !== null && gapAhead <= M.ATTACK_GAP;
  const canDefend = behind !== null && gapBehind <= M.DEFENSE_GAP && paceEdge(state, ctx, behind, me, wetness) >= M.DEFENSE_PACE_EDGE;
  // Com as duas disputas abertas, vem a que ainda não aconteceu nesta corrida; no empate, a mais apertada.
  const defendFirst = canDefend && (!canAttack || (had('attack') && !had('defense')) || (had('attack') === had('defense') && gapBehind < gapAhead));
  if (defendFirst && behind) return defenseMoment(state, ctx, me, behind, lap, wetness);
  if (canAttack && ahead) return attackMoment(state, ctx, me, ahead, lap, wetness);
  return null;
}

/* ------------------------------------------------------------------ */
/* Resolução                                                           */
/* ------------------------------------------------------------------ */

/** O que o lance faz na volta em que é resolvido. `stepRaceLap` aplica isto ao carro do jogador. */
export interface MomentPlan {
  moment: RaceMoment;
  option: MomentOption;
  /** A escolha foi do estilo do piloto, e não do jogador. */
  auto: boolean;
  success: boolean;
  /** Segundos somados à volta do jogador (negativo = ganho). Não vale quando há rodada, toque ou batida. */
  time: number;
  /** Soma ao logit quando o jogador ataca nesta volta; tira do logit quando ele defende. */
  attack: number;
  defend: number;
  /** Multiplicadores da chance de erro e do desgaste do jogador nesta volta. */
  error: number;
  wear: number;
  /** Segundos somados à volta do rival. */
  rivalTime: number;
  /** A primeira disputa do jogador nesta volta é vencida sem sorteio (alcança o carro da frente). */
  pass: boolean;
  /** Quem atacar o jogador nesta volta fica atrás, sem sorteio e sem toque. */
  hold: boolean;
  /** O primeiro carro que atacar o jogador nesta volta passa sem sorteio. */
  yieldTo: boolean;
  /** Parada pedida pelo lance nesta volta, e o que muda no serviço dos boxes. */
  pit: TyreCompound | null;
  pitService: number;
  /** Parada sem imprevisto: sem pit stop lento nem punição de box. */
  cleanStop: boolean;
  /** Plano de paradas novo do carro, quando o lance o altera. */
  plan: PlannedStop[] | null;
  /** Efeito que dura mais de uma volta. */
  carry: MomentCarry | null;
  /** Consequência de um lance errado. O toque só acontece se o rival ainda estiver na pista. */
  incident: 'none' | 'crash' | 'spin' | 'contact';
  /** Sorteios já tirados, para as consequências (todos entre 0 e 1). */
  rolls: { spinLoss: number; injury: number; playerDamage: number; rivalDamage: number; fault: number; dnf: number; victim: number };
}

function validChoice(moment: RaceMoment, choice: MomentChoice | null | undefined): MomentChoice | null {
  if (!choice || !moment.options.some((o) => o.id === choice.option)) return null;
  const compound = choice.compound && moment.compounds?.includes(choice.compound) ? choice.compound : moment.suggestedCompound;
  return { option: choice.option, ...(compound ? { compound } : {}) };
}

/**
 * Resolve o lance pendente para a volta `lap`. Devolve null se não há lance ou se o jogador já não
 * está na pista. Sem resposta válida do jogador (é o caso de "simular até o fim", que não responde
 * a lance nenhum), quem decide é o estilo do piloto.
 */
export function resolveMoment(state: RaceSimState, ctx: RaceContext, input: PlayerRaceInput, lap: number): MomentPlan | null {
  const pending = state.pendingMoment;
  if (!pending || pending.lap !== lap) return null;
  const me = sideOf(state, ctx, state.playerDriverId);
  if (!me) return null;
  // A resposta do jogador vale com ou sem engenheiro automático: `auto` só cuida de boxes e combustível.
  const answered = validChoice(pending, input.moment);
  const choice = answered ?? chooseByStyle(pending, drivingStyleScore(me.driver, me.profile, input.mode));
  const option = pending.options.find((o) => o.id === choice.option);
  if (!option) return null;
  const rule = ruleOf(pending.kind, option.id);
  const rival = sideOf(state, ctx, pending.rivalId ?? undefined);

  // Sempre os mesmos sorteios, na mesma ordem, qualquer que seja a opção.
  const rng = createRng(hashSeed(state.seed, lap, 'moment', pending.kind));
  const successRoll = rng.next();
  const consequenceRoll = rng.next();
  const rolls = {
    spinLoss: rng.next(),
    injury: rng.next(),
    playerDamage: rng.next(),
    rivalDamage: rng.next(),
    fault: rng.next(),
    dnf: rng.next(),
    victim: rng.next(),
  };

  const success = successRoll < option.chance;
  const fx = success ? rule.win : rule.lose;
  let incident: MomentPlan['incident'] = 'none';
  if (!success) {
    const rivalry = rival ? (ctx.rivalries?.[rival.car.driverId] ?? 0) : 0;
    const contact = rival
      ? rule.contact * (RACE_CONTACT.RACECRAFT_BASE - me.driver.attributes.racecraft / 100) * (1 + rivalry / 100) * me.profile.collision
      : 0;
    if (consequenceRoll < rule.crash) incident = 'crash';
    else if (consequenceRoll < rule.crash + rule.spin) incident = 'spin';
    else if (consequenceRoll < rule.crash + rule.spin + contact) incident = 'contact';
  }

  const plan: MomentPlan = {
    moment: pending,
    option,
    auto: answered === null,
    success,
    time: fx.time ?? 0,
    attack: fx.attack ?? 0,
    defend: fx.defend ?? 0,
    error: fx.error ?? 1,
    wear: fx.wear ?? 1,
    rivalTime: fx.rival ?? 0,
    pass: false,
    hold: false,
    yieldTo: false,
    pit: null,
    pitService: 0,
    cleanStop: false,
    plan: null,
    carry: null,
    incident,
    rolls,
  };
  const key = `${pending.kind}.${option.id}`;
  const lastStopLap = state.totalLaps - 2;

  switch (key) {
    case 'attack.dive':
    case 'attack.wait':
    case 'attack.slipstream':
      plan.pass = success;
      break;
    case 'defense.block':
      plan.hold = success;
      plan.yieldTo = !success;
      break;
    case 'defense.yield':
      plan.yieldTo = true;
      break;
    case 'lastLap.allIn':
      plan.pass = success && rival !== null;
      // Sem rival ao alcance, o ganho é uma volta no limite, proporcional ao tamanho da pista.
      if (success && !rival) {
        plan.time = -M.LAST_LAP.SOLO_GAIN * referenceLapTime(ctx.track, ctx.category);
        plan.attack = M.LAST_LAP.SOLO_ATTACK;
      }
      break;
    case 'rain.pit':
    case 'pit.undercut': {
      // Nas duas, o `time` da tabela é o que muda no serviço dos boxes, não no tempo de pista.
      plan.pit = choice.compound ?? pending.suggestedCompound ?? null;
      plan.pitService = plan.time;
      plan.time = 0;
      plan.cleanStop = success;
      if (key === 'pit.undercut' && success) {
        plan.carry = { fromLap: lap + 1, untilLap: lap + M.PIT.OUT_LAPS, pace: M.PIT.OUT_LAP_PACE, grip: 1, wear: 1, holdPit: false };
      }
      break;
    }
    case 'rain.stay': {
      const compound = pending.suggestedCompound;
      // Dando certo, o piloto fica mais algumas voltas e a parada já fica marcada; dando errado, para na volta seguinte.
      const stopLap = success ? lap + M.RAIN.STAY_LAPS : lap + 1;
      if (compound && stopLap <= lastStopLap + 1) plan.plan = [{ lap: stopLap, compound }, ...me.car.plan];
      if (success) plan.carry = { fromLap: lap, untilLap: lap + M.RAIN.STAY_LAPS - 1, pace: 0, grip: M.RAIN.STAY_GRIP, wear: 1, holdPit: true };
      break;
    }
    case 'pit.overcut': {
      const compound = choice.compound ?? pending.suggestedCompound;
      const stopLap = Math.min(lap + M.PIT.STRETCH_LAPS, lastStopLap + 1);
      const rest = me.car.plan.slice(me.car.plan[0] ? 1 : 0);
      if (compound) plan.plan = [{ lap: stopLap, compound }, ...rest];
      plan.carry = {
        fromLap: lap,
        untilLap: stopLap - 1,
        pace: success ? M.PIT.STRETCH_PACE : M.PIT.STRETCH_FAIL_PACE,
        grip: 1,
        wear: success ? M.PIT.STRETCH_WEAR : 1,
        holdPit: true,
      };
      break;
    }
    default:
      break;
  }
  return plan;
}

/** O que de fato aconteceu na pista com o lance, visto depois de a volta ser simulada. */
export interface MomentFacts {
  /** O jogador rodou, tocou no rival ou abandonou por causa do lance. */
  outcome: MomentOutcome;
  contact: boolean;
  /** O rival abandonou no toque. */
  rivalRetired: boolean;
  /** O ataque deu certo, mas o rival terminou a volta à frente (abriu mais que o alcance do lance). */
  escaped: boolean;
  penaltySeconds: number;
}

/** O registro do lance, com a frase pronta para a tela. */
export function momentRecord(plan: MomentPlan, ctx: RaceContext, facts: MomentFacts): MomentRecord {
  const { moment: pending, option } = plan;
  const rival = pending.rivalId ? driverName(ctx, pending.rivalId) : '';
  const text = MOMENT_TEXTS[pending.kind].options[option.id];
  const C = MOMENT_CONSEQUENCE_TEXTS;
  let message = text ? (plan.success ? text.won(rival) : text.lost(rival)) : '';
  if (facts.escaped && plan.success) message = C.escaped(rival);
  if (facts.outcome === 'spin') message += C.spin();
  else if (facts.outcome === 'retired') message += facts.contact ? C.retired(rival) : C.crash();
  else if (facts.contact) message += facts.rivalRetired ? C.rivalRetired(rival) : C.touch(rival);
  if (facts.penaltySeconds > 0) message += C.penalty(facts.penaltySeconds);
  return {
    lap: pending.lap,
    kind: pending.kind,
    option: option.id,
    chance: option.chance,
    success: plan.success,
    auto: plan.auto,
    ...(pending.rivalId ? { rivalId: pending.rivalId } : {}),
    outcome: facts.outcome,
    contact: facts.contact,
    penaltySeconds: facts.penaltySeconds,
    message,
  };
}
