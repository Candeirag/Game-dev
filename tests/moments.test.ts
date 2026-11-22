/**
 * Lances decisivos da Fase 4: a largada e os outros momentos em que a corrida pausa e o jogador
 * escolhe. O que estes testes travam:
 *
 * - as chances mostradas saem dos atributos, do equipamento, do clima e do perfil de nascença, sem
 *   sorteio, e são as mesmas que resolvem o lance (mesma semente, mesmo resultado);
 * - sem resposta, o piloto decide pelo próprio estilo: "simular direto" continua funcionando;
 * - uma corrida tem de 2 a 4 lances, e pilotos melhores vencem mais lances;
 * - o que cada opção faz na pista, e o que um toque deixa no save (rivalidade).
 *
 * Tudo com sementes fixas. Onde é preciso "muitas sementes", o mesmo lance é resolvido centenas de
 * vezes a partir de um estado montado (uma volta por tentativa), o que custa pouco.
 */
import { describe, expect, it } from 'vitest';
import { APTITUDE_EFFECTS, HISTORY_LIMITS, RACE_MOMENTS, TRAIT_EFFECTS } from '@/config/balance';
import { DRIVING_STYLE_DESCRIPTIONS, DRIVING_STYLE_LABELS, MOMENT_FACTOR_LABELS, MOMENT_KIND_LABELS, MOMENT_RISK_LABELS } from '@/domain/labels';
import {
  MOMENT_KINDS,
  MOMENT_OUTCOMES,
  MomentRecordSchema,
  RivalryRecordSchema,
  type CareerState,
  type DriverAttributes,
  type MomentKind,
  type MomentRecord,
  type RivalryRecord,
  type SessionWeather,
} from '@/domain/schemas';
import { RADIO_TEXTS } from '@/data/raceMoments';
import { TRACKS } from '@/data/tracks';
import {
  RACE,
  RELATION_RULES,
  TYRES,
  chooseByStyle,
  createRaceSim,
  drivingStyle,
  drivingStyleScore,
  finalizeRace,
  isRaceFinished,
  neutralRaceProfile,
  simulateRemainingRace,
  stepRaceLap,
  stressedCorner,
  tyreState,
  upcomingMoment,
  type DriverRaceProfile,
  type GridSlot,
  type MomentChoice,
  type MomentOption,
  type PlayerRaceInput,
  type RaceContext,
  type RaceMoment,
  type RaceSimState,
} from '@/engine';
import { botMomentChoice } from '../sim/policy';
import { newCareer, playRound } from './helpers';
import { DRY, WET, raceSetup, type RaceSetup } from './raceSetup';

const M = RACE_MOMENTS;
const AUTO = { mode: 'balanced', auto: true } as const;

const kart = raceSetup('kart-regional');
const f4 = raceSetup('f4');
const f2 = raceSetup('f2');
const f1 = raceSetup('f1');

/* ------------------------------------------------------------------ */
/* Apoio                                                               */
/* ------------------------------------------------------------------ */

/** Como responder a um lance: a escolha, ou null para deixar com o estilo do piloto. */
type Answer = (moment: RaceMoment, state: RaceSimState) => MomentChoice | null;
/** Sempre a opção mais arriscada, sempre a mais segura (as políticas do robô) ou o estilo do piloto. */
const bold: Answer = (moment) => botMomentChoice(moment, 'bold');
const safe: Answer = (moment) => botMomentChoice(moment, 'safe');
const byStyle: Answer = () => null;

interface Resolved {
  /** A corrida antes e depois da volta do lance. */
  before: RaceSimState;
  after: RaceSimState;
  moment: RaceMoment;
  record: MomentRecord;
}

interface Played {
  final: RaceSimState;
  resolved: Resolved[];
  /** A última volta foi disputada em bandeira verde (sem safety car e sem relargada). */
  lastLapGreen: boolean;
}

/** Corre até a bandeirada, guardando o antes e o depois de cada lance. */
function play(start: RaceSimState, ctx: RaceContext, answer: Answer, input: Omit<PlayerRaceInput, 'moment'> = AUTO): Played {
  let state = start;
  const resolved: Resolved[] = [];
  let lastLapGreen = false;
  while (!isRaceFinished(state)) {
    const moment = state.pendingMoment;
    if (state.currentLap === state.totalLaps - 1) lastLapGreen = state.neutralization.type === 'none' && state.restart === 'none';
    const next = stepRaceLap(state, ctx, { ...input, moment: moment ? answer(moment, state) : null });
    if (moment) resolved.push({ before: state, after: next, moment, record: next.moments.at(-1)! });
    state = next;
  }
  return { final: state, resolved, lastLapGreen };
}

const carOf = (state: RaceSimState, driverId: string) => state.cars.find((c) => c.driverId === driverId)!;
const placeOf = (state: RaceSimState, driverId: string) => state.cars.findIndex((c) => c.driverId === driverId);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function optionOf(moment: RaceMoment | null, id: string): MomentOption {
  const found = moment?.options.find((o) => o.id === id);
  if (!found) throw new Error(`Opção ${id} ausente no lance ${moment?.kind ?? '(nenhum)'}`);
  return found;
}
const chanceOf = (moment: RaceMoment | null, id: string) => optionOf(moment, id).chance;
/** Pontos de um fator na chance de uma opção (0 quando o fator não pesa). */
const pointsOf = (moment: RaceMoment | null, id: string, key: string) => optionOf(moment, id).factors.find((f) => f.key === key)?.points ?? 0;

/** O mesmo contexto, com atributos de um piloto trocados (valores novos ou uma conta sobre os atuais). */
function withAttributes(ctx: RaceContext, driverId: string, patch: Partial<DriverAttributes> | ((value: number) => number)): RaceContext {
  const driver = ctx.drivers[driverId]!;
  const attributes: DriverAttributes = { ...driver.attributes, ...(typeof patch === 'function' ? {} : patch) };
  if (typeof patch === 'function') for (const key of Object.keys(attributes) as (keyof DriverAttributes)[]) attributes[key] = patch(attributes[key]);
  return { ...ctx, drivers: { ...ctx.drivers, [driverId]: { ...driver, attributes } } };
}

/** O mesmo contexto, com todos os atributos do jogador subindo ou descendo `delta` pontos (de 1 a 99). */
const shifted = (setup: RaceSetup, delta: number) => withAttributes(setup.ctx, setup.playerId, (value) => Math.max(1, Math.min(99, value + delta)));

function withProfile(ctx: RaceContext, driverId: string, profile: Partial<DriverRaceProfile>): RaceContext {
  return { ...ctx, profiles: { ...ctx.profiles, [driverId]: { ...neutralRaceProfile(), ...profile } } };
}

/** Perfil de corrida de quem nasceu com estes talentos ou defeitos (a mesma conta de `birthRaceProfile`). */
function traitProfile(...traits: (keyof typeof TRAIT_EFFECTS)[]): DriverRaceProfile {
  const profile = neutralRaceProfile();
  for (const trait of traits) {
    const fx: Partial<Record<string, number>> = TRAIT_EFFECTS[trait];
    profile.wetPace += fx.wetPace ?? 0;
    profile.wetError += fx.wetError ?? 0;
    profile.startSpread *= fx.startSpread ?? 1;
    profile.startGain += fx.startGain ?? 0;
    profile.tyreWear *= fx.tyreWear ?? 1;
    profile.injury *= fx.injury ?? 1;
    profile.collision *= fx.collision ?? 1;
    profile.attack += fx.attack ?? 0;
  }
  return profile;
}
const withTraits = (setup: RaceSetup, ...traits: (keyof typeof TRAIT_EFFECTS)[]) => withProfile(setup.ctx, setup.playerId, traitProfile(...traits));

/** Frieza de nascença no máximo e no mínimo (`APTITUDE_EFFECTS.COMPOSURE_*`). */
const COOL: Partial<DriverRaceProfile> = {
  duel: APTITUDE_EFFECTS.COMPOSURE_DUEL,
  lastLapDuel: APTITUDE_EFFECTS.COMPOSURE_LAST_LAP_DUEL,
  lastLapError: 1 - APTITUDE_EFFECTS.COMPOSURE_LAST_LAP_ERROR,
};
const NERVOUS: Partial<DriverRaceProfile> = {
  duel: -APTITUDE_EFFECTS.COMPOSURE_DUEL,
  lastLapDuel: -APTITUDE_EFFECTS.COMPOSURE_LAST_LAP_DUEL,
  lastLapError: 1 + APTITUDE_EFFECTS.COMPOSURE_LAST_LAP_ERROR,
};

/**
 * Grid pronto, com o lance da largada calculado para `ctx`. O apoio monta a corrida com o contexto
 * original; quando o teste troca atributos ou perfil, a largada tem de ser recalculada com o novo.
 */
function opening(setup: RaceSetup, ctx: RaceContext, seed: number, weather: SessionWeather = DRY, gridOrder?: string[]): RaceSimState {
  const state = setup.start(seed, weather, undefined, gridOrder);
  return ctx === setup.ctx ? state : { ...state, pendingMoment: upcomingMoment(state, ctx) };
}

/** Guarda o resultado de uma conta cara para os testes que a compartilham. */
function memo<T>(build: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => {
    cached ??= { value: build() };
    return cached.value;
  };
}

/**
 * Procura, semente a semente, a primeira corrida que para num lance do tipo pedido (e que passe no
 * filtro), correndo com as opções seguras e o engenheiro automático. Devolve a corrida parada nele.
 */
function findMoment(setup: RaceSetup, kind: MomentKind, accept: (state: RaceSimState, moment: RaceMoment) => boolean = () => true): RaceSimState {
  for (let seed = 1; seed <= 60; seed++) {
    let state = setup.start(seed);
    while (!isRaceFinished(state)) {
      const moment = state.pendingMoment;
      if (moment?.kind === kind && accept(state, moment)) return state;
      state = stepRaceLap(state, setup.ctx, { ...AUTO, moment: moment ? safe(moment, state) : null });
    }
  }
  throw new Error(`Nenhuma corrida de ${setup.ctx.category.id} com o lance "${kind}" em 60 sementes.`);
}

/** Um composto de pista seca usado até aqui e a parada planejada pela frente. */
const beforeFirstStop = (setup: RaceSetup) => (state: RaceSimState) => {
  const car = state.cars.find((c) => c.driverId === setup.playerId);
  return car !== undefined && new Set(car.compoundsUsed).size === 1 && car.plan.length > 0;
};
/** Chuva começando na Fórmula Júnior; parada chegando na Fórmula Elite e no Grand Prix Mundial; última volta de kart sem e com rival ao alcance. */
const rainState = memo(() => findMoment(f4, 'rain'));
const pitState = memo(() => findMoment(f2, 'pit', beforeFirstStop(f2)));
const grandPrixPitState = memo(() => findMoment(f1, 'pit', beforeFirstStop(f1)));
const lonelyLastLap = memo(() => findMoment(kart, 'lastLap', (_, moment) => moment.rivalId === null));
const lastLapFight = memo(() => findMoment(kart, 'lastLap', (_, moment) => moment.rivalId !== null));

interface DuelSetup {
  /** Distância (s) do jogador para o carro da frente e do carro de trás para o jogador. */
  gapAhead?: number;
  gapBehind?: number;
  /** Desgaste do pneu do jogador (os outros ficam com 30%). */
  playerWear?: number;
  weather?: SessionWeather;
}

/**
 * Estado montado para os lances de disputa: uma corrida de kart depois de 8 voltas, com o pelotão
 * espaçado de 3 em 3 segundos, todos com o mesmo pneu, o jogador em 6º e só a largada na conta dos
 * lances. As distâncias para os vizinhos são as pedidas (sem pedido, ninguém está perto).
 */
function duelState({ gapAhead, gapBehind, playerWear = 0.3, weather = DRY }: DuelSetup = {}): RaceSimState {
  let state = kart.start(5, weather);
  for (let lap = 0; lap < 8; lap++) state = stepRaceLap(state, kart.ctx, { ...AUTO, moment: state.pendingMoment ? safe(state.pendingMoment, state) : null });
  const others = state.cars.filter((c) => c.status === 'running' && c.driverId !== kart.playerId);
  const position = 5;
  const order = [...others.slice(0, position), carOf(state, kart.playerId), ...others.slice(position)];
  const cars = order.map((car, index) => ({ ...car, totalTime: 1000 + index * 3, damage: 0, tyre: { ...car.tyre, wear: 0.3 } }));
  const mine = cars[position]!;
  mine.tyre = { ...mine.tyre, wear: playerWear };
  if (gapAhead !== undefined) mine.totalTime = cars[position - 1]!.totalTime + gapAhead;
  if (gapBehind !== undefined) cars[position + 1]!.totalTime = mine.totalTime + gapBehind;
  return {
    ...state,
    cars: [...cars, ...state.cars.filter((c) => c.status !== 'running')],
    moments: state.moments.slice(0, 1),
    pendingMoment: null,
    pendingTeamOrder: null,
    neutralization: { type: 'none' },
    restart: 'none',
    carry: null,
  };
}

/** O jogador colado atrás de um rival (ataque) e com um rival mais rápido colado atrás (defesa: pneu acabado). */
const attackState = memo(() => duelState({ gapAhead: 0.3 }));
const defenseState = memo(() => duelState({ gapBehind: 0.3, playerWear: 0.83 }));
const wetAttackState = memo(() => duelState({ gapAhead: 0.3, weather: WET }));

/** Um registro de lance já resolvido, para montar o histórico de uma corrida. */
function pastMoment(kind: MomentKind, lap: number): MomentRecord {
  return { lap, kind, option: 'x', chance: 0.5, success: false, auto: false, outcome: 'lost', contact: false, penaltySeconds: 0, message: 'Lance de teste.' };
}

/** Resolve o mesmo lance com outra semente: uma volta, com o sorteio do lance e o dos carros trocados. */
function trial(state: RaceSimState, ctx: RaceContext, moment: RaceMoment, option: string, k: number): Resolved {
  const before: RaceSimState = { ...state, seed: k * 7919, pendingMoment: moment };
  const after = stepRaceLap(before, ctx, { mode: 'balanced', moment: { option } });
  return { before, after, moment, record: after.moments.at(-1)! };
}

/** Lances em que o jogador (ou o rival) não teve erro próprio, rodada nem abandono na volta: o efeito do lance aparece limpo. */
function cleanLap(step: Resolved, driverId: string): boolean {
  return !step.after.events.some((e) => e.lap === step.moment.lap && e.driverId === driverId && ['error', 'spin', 'dnf', 'damage', 'fuel'].includes(e.type));
}

/* ------------------------------------------------------------------ */
/* Largada                                                             */
/* ------------------------------------------------------------------ */

describe('a largada é o primeiro lance', () => {
  it('a corrida já nasce parada no lance da largada, com três opções', () => {
    for (const setup of [kart, f4, f2, f1]) {
      const state = setup.start(1);
      const moment = state.pendingMoment;
      if (!moment) throw new Error('Sem lance de largada.');
      const where = setup.ctx.category.id;
      expect(state.currentLap, where).toBe(0);
      expect(state.moments, where).toEqual([]);
      expect(state.radio, where).toEqual([]);
      expect(state.carry, where).toBeNull();
      expect(moment.kind, where).toBe('start');
      expect(moment.lap, where).toBe(1);
      expect(moment.title, where).toBe(MOMENT_KIND_LABELS.start);
      expect(moment.question.length, where).toBeGreaterThan(10);
      expect(moment.compounds, where).toBeUndefined();
      expect(moment.options.map((o) => o.id)).toEqual(['inside', 'outside', 'hold']);
      expect(moment.options.map((o) => o.risk)).toEqual([2, 1, 0]);
      for (const option of moment.options) {
        expect(option.chance, `${where}: ${option.id}`).toBeGreaterThanOrEqual(M.CHANCE_MIN);
        expect(option.chance, `${where}: ${option.id}`).toBeLessThanOrEqual(M.CHANCE_MAX);
        expect(option.label.length, option.id).toBeGreaterThan(3);
        expect(option.gain.length, option.id).toBeGreaterThan(3);
        expect(option.loss.length, option.id).toBeGreaterThan(3);
        expect(MOMENT_RISK_LABELS[option.risk].length).toBeGreaterThan(3);
      }
      // Quanto mais segura a opção, maior a chance de dar certo.
      expect(chanceOf(moment, 'hold'), where).toBeGreaterThan(chanceOf(moment, 'outside'));
      expect(chanceOf(moment, 'outside'), where).toBeGreaterThan(chanceOf(moment, 'inside'));
      // O rival do lance é o vizinho de grid com quem um toque aconteceria: o carro da frente.
      const index = placeOf(state, setup.playerId);
      expect(index, where).toBeGreaterThan(0);
      expect(moment.rivalId, where).toBe(state.cars[index - 1]!.driverId);
    }
  });

  it('largando na pole, o vizinho do lance é o segundo colocado', () => {
    const order = [kart.playerId, ...kart.drivers.map((d) => d.id).filter((id) => id !== kart.playerId)];
    const state = kart.start(1, DRY, undefined, order);
    expect(state.cars[0]!.driverId).toBe(kart.playerId);
    expect(state.pendingMoment?.kind).toBe('start');
    expect(state.pendingMoment?.rivalId).toBe(state.cars[1]!.driverId);
  });

  it('sem o jogador no grid não há lance, e a corrida corre como sempre', () => {
    const template = kart.start(3);
    const grid: GridSlot[] = template.cars.map((c) => ({ driverId: c.driverId, teamId: c.teamId, modifiers: c.modifiers }));
    // O jogador é dirigente (ninguém do grid) ou cumpre suspensão (o carro dele não larga).
    const cases: [GridSlot[], string][] = [
      [grid, 'ninguem'],
      [grid.filter((slot) => slot.driverId !== kart.playerId), kart.playerId],
    ];
    for (const [slots, playerId] of cases) {
      let state = createRaceSim(slots, kart.ctx, DRY, 3, playerId);
      expect(state.pendingMoment).toBeNull();
      expect(upcomingMoment(state, kart.ctx)).toBeNull();
      const whole = simulateRemainingRace(state, kart.ctx, AUTO);
      while (!isRaceFinished(state)) {
        state = stepRaceLap(state, kart.ctx, AUTO);
        expect(state.pendingMoment).toBeNull();
      }
      expect(state.currentLap).toBe(state.totalLaps);
      expect(state.moments).toEqual([]);
      expect(state.radio).toEqual([]);
      expect(state.carry).toBeNull();
      expect(state).toEqual(whole);
      const result = finalizeRace(state, kart.ctx.category);
      expect(result.moments).toEqual([]);
      expect(result.entries).toHaveLength(slots.length);
      // Uma resposta a lance que não existe não muda nada.
      const answered = stepRaceLap(createRaceSim(slots, kart.ctx, DRY, 3, playerId), kart.ctx, { ...AUTO, moment: { option: 'inside' } });
      expect(answered).toEqual(stepRaceLap(createRaceSim(slots, kart.ctx, DRY, 3, playerId), kart.ctx, AUTO));
    }
  });
});

/* ------------------------------------------------------------------ */
/* Determinismo                                                        */
/* ------------------------------------------------------------------ */

describe('mesma semente, mesmo resultado', () => {
  it('a mesma situação dá sempre o mesmo lance, com as mesmas chances, e a chance não usa sorteio', () => {
    for (const setup of [kart, f2]) {
      for (const seed of [1, 2, 3]) {
        const state = setup.start(seed);
        expect(upcomingMoment(state, setup.ctx)).toEqual(state.pendingMoment);
        expect(upcomingMoment(state, setup.ctx)).toEqual(upcomingMoment(state, setup.ctx));
        // Trocar a semente do estado não muda as chances: só o desfecho é sorteado.
        expect(upcomingMoment({ ...state, seed: state.seed + 1000 }, setup.ctx)).toEqual(state.pendingMoment);
      }
    }
    // Ao longo de uma corrida inteira: o lance pendente é sempre o que `upcomingMoment` devolve para aquele estado.
    let state = kart.start(9);
    let pauses = 0;
    while (!isRaceFinished(state)) {
      expect(upcomingMoment(state, kart.ctx)).toEqual(state.pendingMoment);
      if (state.pendingMoment) pauses++;
      state = stepRaceLap(state, kart.ctx, { ...AUTO, moment: state.pendingMoment ? bold(state.pendingMoment, state) : null });
    }
    expect(state.pendingMoment).toBeNull();
    expect(pauses).toBe(state.moments.length);
    for (const state of [attackState(), defenseState()]) expect(upcomingMoment(state, kart.ctx)).toEqual(upcomingMoment(state, kart.ctx));
  });

  it('a mesma volta com a mesma entrada dá o mesmo estado, sem mexer no estado de entrada', () => {
    for (const [setup, seed] of [
      [kart, 7],
      [f2, 5],
    ] as const) {
      const state = setup.start(seed);
      const frozen = JSON.stringify(state);
      for (const option of ['inside', 'outside', 'hold']) {
        const input: PlayerRaceInput = { mode: 'aggressive', moment: { option } };
        const first = stepRaceLap(state, setup.ctx, input);
        expect(stepRaceLap(state, setup.ctx, input)).toEqual(first);
        expect(first.moments).toHaveLength(1);
        expect(first.moments[0]!.option).toBe(option);
      }
      expect(JSON.stringify(state)).toBe(frozen);
    }
    // No meio da corrida, num lance de disputa.
    const state = { ...attackState(), pendingMoment: upcomingMoment(attackState(), kart.ctx) };
    const input: PlayerRaceInput = { mode: 'balanced', moment: { option: 'dive' } };
    expect(stepRaceLap(state, kart.ctx, input)).toEqual(stepRaceLap(state, kart.ctx, input));
  });

  it('a corrida inteira com as mesmas escolhas é idêntica; escolhas diferentes dão corridas diferentes', () => {
    for (const [setup, seed] of [
      [kart, 11],
      [f2, 4],
    ] as const) {
      const first = play(setup.start(seed), setup.ctx, bold);
      const again = play(setup.start(seed), setup.ctx, bold);
      expect(again.final).toEqual(first.final);
      expect(finalizeRace(again.final, setup.ctx.category)).toEqual(finalizeRace(first.final, setup.ctx.category));
      // Outra política, outra corrida: já na largada a opção é outra.
      const calm = play(setup.start(seed), setup.ctx, safe);
      expect(calm.final.moments[0]!.option).toBe('hold');
      expect(first.final.moments[0]!.option).toBe('inside');
      expect(calm.final).not.toEqual(first.final);
      expect(calm.final.cars.map((c) => c.totalTime)).not.toEqual(first.final.cars.map((c) => c.totalTime));
      // E outra semente, outra corrida, com as mesmas escolhas.
      expect(play(setup.start(seed + 1), setup.ctx, bold).final.cars.map((c) => c.totalTime)).not.toEqual(first.final.cars.map((c) => c.totalTime));
    }
  });

  it('o sorteio do lance é o mesmo para qualquer opção: se a mais difícil dá certo, as mais fáceis também dão', () => {
    let insideWins = 0;
    let holdWins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const state = kart.start(seed);
      const won = (option: string) => stepRaceLap(state, kart.ctx, { mode: 'balanced', moment: { option } }).moments[0]!.success;
      const [inside, outside, hold] = [won('inside'), won('outside'), won('hold')];
      if (inside) expect(outside, `semente ${seed}`).toBe(true);
      if (outside) expect(hold, `semente ${seed}`).toBe(true);
      insideWins += inside ? 1 : 0;
      holdWins += hold ? 1 : 0;
    }
    expect(insideWins).toBeGreaterThan(5);
    expect(holdWins).toBeGreaterThan(insideWins + 5);
    expect(holdWins).toBeLessThan(40);
  });
});

/* ------------------------------------------------------------------ */
/* Chances                                                             */
/* ------------------------------------------------------------------ */

describe('as chances saem dos atributos, do carro, da pista e do clima', () => {
  const id = kart.playerId;
  const again = (state: RaceSimState, ctx: RaceContext) => upcomingMoment(state, ctx);

  it('largada: experiência e concentração ajudam em tudo; ultrapassagem, por dentro e por fora; defesa, a segurar', () => {
    const state = kart.start(1);
    const base = state.pendingMoment;
    const sharp = again(state, withAttributes(kart.ctx, id, { experience: 70, focus: 95 }));
    const dull = again(state, withAttributes(kart.ctx, id, { experience: 10, focus: 40 }));
    for (const option of ['inside', 'outside', 'hold']) {
      expect(chanceOf(sharp, option), option).toBeGreaterThan(chanceOf(base, option));
      expect(chanceOf(dull, option), option).toBeLessThan(chanceOf(base, option));
      // O fator "Piloto" acompanha o sinal: sobe com o atributo, cai com ele.
      expect(pointsOf(sharp, option, 'driver'), option).toBeGreaterThan(pointsOf(base, option, 'driver'));
      expect(pointsOf(dull, option, 'driver'), option).toBeLessThan(pointsOf(base, option, 'driver'));
    }
    expect(pointsOf(sharp, 'inside', 'driver')).toBeGreaterThan(0);
    expect(pointsOf(dull, 'inside', 'driver')).toBeLessThan(0);

    const attacker = again(state, withAttributes(kart.ctx, id, { overtaking: 95 }));
    expect(chanceOf(attacker, 'inside')).toBeGreaterThan(chanceOf(base, 'inside'));
    expect(chanceOf(attacker, 'outside')).toBeGreaterThan(chanceOf(base, 'outside'));
    expect(chanceOf(attacker, 'hold')).toBe(chanceOf(base, 'hold'));
    // A ultrapassagem pesa o dobro por dentro.
    expect(chanceOf(attacker, 'inside') - chanceOf(base, 'inside')).toBeGreaterThan(chanceOf(attacker, 'outside') - chanceOf(base, 'outside'));

    const defender = again(state, withAttributes(kart.ctx, id, { defending: 95 }));
    expect(chanceOf(defender, 'hold')).toBeGreaterThan(chanceOf(base, 'hold'));
    expect(chanceOf(defender, 'inside')).toBe(chanceOf(base, 'inside'));
    expect(chanceOf(defender, 'outside')).toBe(chanceOf(base, 'outside'));
  });

  it('largada na chuva: a pista molhada atrapalha, e a nota de chuva devolve parte disso', () => {
    const dry = kart.start(1).pendingMoment;
    const state = kart.start(1, WET);
    const wet = state.pendingMoment;
    const skilled = again(state, withAttributes(kart.ctx, id, { wetSkill: 95 }));
    const clumsy = again(state, withAttributes(kart.ctx, id, { wetSkill: 30 }));
    for (const option of ['inside', 'outside', 'hold']) {
      expect(chanceOf(wet, option), option).toBeLessThan(chanceOf(dry, option));
      expect(chanceOf(skilled, option), option).toBeGreaterThan(chanceOf(wet, option));
      expect(chanceOf(clumsy, option), option).toBeLessThan(chanceOf(wet, option));
      expect(chanceOf(skilled, option), option).toBeLessThan(chanceOf(dry, option));
      // No seco o clima não aparece entre os fatores; na chuva, aparece e é negativo.
      expect(pointsOf(dry, option, 'weather'), option).toBe(0);
      expect(pointsOf(wet, option, 'weather'), option).toBeLessThan(0);
      expect(pointsOf(skilled, option, 'weather'), option).toBeGreaterThan(pointsOf(wet, option, 'weather'));
    }
  });

  it('ataque: abre com o jogador colado no carro da frente, que vira o rival do lance', () => {
    const state = attackState();
    const moment = again(state, kart.ctx);
    if (!moment) throw new Error('Sem lance de ataque.');
    expect(moment.kind).toBe('attack');
    expect(moment.lap).toBe(state.currentLap + 1);
    expect(moment.title).toBe(MOMENT_KIND_LABELS.attack);
    expect(moment.rivalId).toBe(state.cars[placeOf(state, id) - 1]!.driverId);
    expect(moment.options.map((o) => o.id)).toEqual(['dive', 'wait', 'slipstream']);
    expect(moment.options.map((o) => o.risk)).toEqual([2, 0, 1]);
    // O nome do rival aparece na pergunta.
    expect(moment.question).toContain(kart.ctx.drivers[moment.rivalId!]!.lastName);
    for (const option of moment.options) {
      expect(option.chance).toBeGreaterThanOrEqual(M.CHANCE_MIN);
      expect(option.chance).toBeLessThanOrEqual(M.CHANCE_MAX);
    }
    // Fora do alcance não há lance: nem com o rival longe demais, nem sem ninguém por perto.
    expect(again(duelState({ gapAhead: M.ATTACK_GAP + 0.3 }), kart.ctx)).toBeNull();
    expect(again(duelState(), kart.ctx)).toBeNull();
    expect(again(duelState({ gapAhead: M.ATTACK_GAP - 0.05 }), kart.ctx)?.kind).toBe('attack');
  });

  it('ataque: ultrapassagem melhor sobe a chance; rival que defende melhor baixa a do mergulho', () => {
    const state = attackState();
    const base = again(state, kart.ctx);
    const rival = base!.rivalId!;
    const sharper = again(state, withAttributes(kart.ctx, id, { overtaking: 92 }));
    expect(chanceOf(sharper, 'dive')).toBeGreaterThan(chanceOf(base, 'dive') + 0.1);
    expect(chanceOf(sharper, 'slipstream')).toBeGreaterThan(chanceOf(base, 'slipstream') + 0.1);
    expect(chanceOf(sharper, 'wait')).toBe(chanceOf(base, 'wait'));
    expect(pointsOf(sharper, 'dive', 'driver')).toBeGreaterThan(pointsOf(base, 'dive', 'driver'));

    const wall = again(state, withAttributes(kart.ctx, rival, { defending: 95 }));
    expect(chanceOf(wall, 'dive')).toBeLessThan(chanceOf(base, 'dive') - 0.05);
    expect(chanceOf(wall, 'slipstream')).toBeLessThan(chanceOf(base, 'slipstream') - 0.05);
    expect(pointsOf(wall, 'dive', 'driver')).toBeLessThan(pointsOf(base, 'dive', 'driver'));
    const door = again(state, withAttributes(kart.ctx, rival, { defending: 50 }));
    expect(chanceOf(door, 'dive')).toBeGreaterThan(chanceOf(base, 'dive'));
  });

  it('ataque: esperar o erro depende do rival (consistência, concentração) e da leitura de corrida do jogador', () => {
    const state = attackState();
    const base = again(state, kart.ctx);
    const rival = base!.rivalId!;
    const shaky = again(state, withAttributes(kart.ctx, rival, { consistency: 40, focus: 40 }));
    const solid = again(state, withAttributes(kart.ctx, rival, { consistency: 95, focus: 95 }));
    expect(chanceOf(shaky, 'wait')).toBeGreaterThan(chanceOf(base, 'wait') + 0.05);
    expect(chanceOf(solid, 'wait')).toBeLessThan(chanceOf(base, 'wait'));
    expect(pointsOf(shaky, 'wait', 'rival')).toBeGreaterThan(pointsOf(base, 'wait', 'rival'));
    const reader = again(state, withAttributes(kart.ctx, id, { racecraft: 99 }));
    expect(chanceOf(reader, 'wait')).toBeGreaterThan(chanceOf(base, 'wait'));
    // Pneu do rival no fim ajuda quem espera.
    const rivalOnWornTyres: RaceSimState = { ...state, cars: state.cars.map((c) => (c.driverId === rival ? { ...c, tyre: { ...c.tyre, wear: 0.9 } } : c)) };
    expect(chanceOf(again(rivalOnWornTyres, kart.ctx), 'wait')).toBeGreaterThan(chanceOf(base, 'wait') + 0.1);
    // E a chance de esperar nunca passa do teto.
    const hopeless = again(rivalOnWornTyres, withAttributes(kart.ctx, rival, { consistency: 1, focus: 1, racecraft: 1 }));
    expect(chanceOf(hopeless, 'wait')).toBeLessThanOrEqual(M.ATTACK.WAIT_MAX);
    expect(chanceOf(hopeless, 'wait')).toBeGreaterThan(chanceOf(shaky, 'wait'));
  });

  it('ataque: pista de reta favorece o vácuo; pista travada favorece o mergulho', () => {
    const state = attackState();
    const onTrack = (powerSensitivity: number) => again(state, { ...kart.ctx, track: { ...kart.ctx.track, powerSensitivity } });
    const straights = onTrack(0.8);
    const neutral = onTrack(0.5);
    const twisty = onTrack(0.3);
    expect(chanceOf(straights, 'slipstream')).toBeGreaterThan(chanceOf(neutral, 'slipstream') + 0.1);
    expect(chanceOf(neutral, 'slipstream')).toBeGreaterThan(chanceOf(twisty, 'slipstream') + 0.05);
    expect(chanceOf(straights, 'slipstream')).toBeGreaterThan(chanceOf(straights, 'dive'));
    expect(chanceOf(twisty, 'slipstream')).toBeLessThan(chanceOf(twisty, 'dive'));
    // O mergulho quase não muda com a reta (só pelo que o motor pesa no ritmo dos dois carros).
    expect(Math.abs(chanceOf(straights, 'dive') - chanceOf(twisty, 'dive'))).toBeLessThan(0.03);
    expect(pointsOf(straights, 'slipstream', 'track')).toBeGreaterThan(pointsOf(twisty, 'slipstream', 'track'));
    // Pista difícil de ultrapassar baixa as duas.
    const narrow = again(state, { ...kart.ctx, track: { ...kart.ctx.track, overtakingDifficulty: 0.9 } });
    const wide = again(state, { ...kart.ctx, track: { ...kart.ctx.track, overtakingDifficulty: 0.1 } });
    for (const option of ['dive', 'slipstream']) expect(chanceOf(narrow, option), option).toBeLessThan(chanceOf(wide, option));
  });

  it('defesa: só abre com um carro mais rápido colado atrás; defender melhor sobe a chance de fechar a porta', () => {
    const state = defenseState();
    const moment = again(state, kart.ctx);
    if (!moment) throw new Error('Sem lance de defesa.');
    expect(moment.kind).toBe('defense');
    expect(moment.title).toBe(MOMENT_KIND_LABELS.defense);
    expect(moment.rivalId).toBe(state.cars[placeOf(state, id) + 1]!.driverId);
    expect(moment.options.map((o) => o.id)).toEqual(['block', 'yield']);
    expect(moment.options.map((o) => o.risk)).toEqual([2, 0]);
    // Ceder não tem como dar errado: 100%, sem fatores.
    expect(optionOf(moment, 'yield')).toMatchObject({ chance: 1, factors: [] });
    expect(chanceOf(moment, 'block')).toBeLessThanOrEqual(M.CHANCE_MAX);

    const rival = moment.rivalId!;
    expect(chanceOf(again(state, withAttributes(kart.ctx, id, { defending: 95 })), 'block')).toBeGreaterThan(chanceOf(moment, 'block') + 0.05);
    expect(chanceOf(again(state, withAttributes(kart.ctx, id, { defending: 50 })), 'block')).toBeLessThan(chanceOf(moment, 'block'));
    expect(chanceOf(again(state, withAttributes(kart.ctx, rival, { overtaking: 95 })), 'block')).toBeLessThan(chanceOf(moment, 'block') - 0.1);
    // Pista difícil de ultrapassar ajuda quem defende.
    const narrow = again(state, { ...kart.ctx, track: { ...kart.ctx.track, overtakingDifficulty: 0.9 } });
    expect(chanceOf(narrow, 'block')).toBeGreaterThan(chanceOf(moment, 'block'));

    // Com o mesmo pneu o carro de trás não é mais rápido: não há o que defender. Longe demais, também não.
    expect(again(duelState({ gapBehind: 0.3 }), kart.ctx)).toBeNull();
    expect(again(duelState({ gapBehind: M.DEFENSE_GAP + 0.3, playerWear: 0.83 }), kart.ctx)).toBeNull();
    // Com as duas disputas abertas, vem a mais apertada.
    expect(again(duelState({ gapAhead: 0.4, gapBehind: 0.2, playerWear: 0.83 }), kart.ctx)?.kind).toBe('defense');
    expect(again(duelState({ gapAhead: 0.2, gapBehind: 0.4, playerWear: 0.83 }), kart.ctx)?.kind).toBe('attack');
  });

  it('última volta: com rival ao alcance vale a disputa; sem rival, a velocidade e a consistência', () => {
    const alone = lonelyLastLap();
    const lonely = alone.pendingMoment;
    expect(lonely?.lap).toBe(alone.totalLaps);
    expect(lonely?.rivalId).toBeNull();
    expect(lonely?.options.map((o) => o.id)).toEqual(['allIn', 'secure']);
    expect(lonely?.options.map((o) => o.risk)).toEqual([2, 0]);
    expect(chanceOf(lonely, 'secure')).toBeGreaterThan(chanceOf(lonely, 'allIn'));
    const quick = again(alone, withAttributes(kart.ctx, id, { pace: 95, consistency: 95 }));
    expect(chanceOf(quick, 'allIn')).toBeGreaterThan(chanceOf(lonely, 'allIn') + 0.05);
    expect(chanceOf(quick, 'secure')).toBeGreaterThan(chanceOf(lonely, 'secure'));
    const erratic = again(alone, withAttributes(kart.ctx, id, { consistency: 40 }));
    expect(chanceOf(erratic, 'allIn')).toBeLessThan(chanceOf(lonely, 'allIn'));
    expect(chanceOf(erratic, 'secure')).toBeLessThan(chanceOf(lonely, 'secure'));

    const fight = lastLapFight();
    const duel = fight.pendingMoment;
    const rival = duel?.rivalId;
    if (!rival) throw new Error('Sem rival na última volta.');
    expect(rival).toBe(fight.cars[placeOf(fight, id) - 1]!.driverId);
    expect(carOf(fight, id).totalTime - carOf(fight, rival).totalTime).toBeLessThanOrEqual(M.LAST_LAP_REACH);
    expect(chanceOf(again(fight, withAttributes(kart.ctx, id, { overtaking: 95 })), 'allIn')).toBeGreaterThan(chanceOf(duel, 'allIn') + 0.1);
    expect(chanceOf(again(fight, withAttributes(kart.ctx, rival, { defending: 99 })), 'allIn')).toBeLessThan(chanceOf(duel, 'allIn'));
    // Passar alguém na última volta é mais difícil que cravar uma volta sozinho.
    expect(chanceOf(duel, 'allIn')).toBeLessThan(chanceOf(lonely, 'allIn'));
  });

  it('chuva começando: parar depende da equipe de box; ficar, da nota de chuva e da leitura de corrida', () => {
    const state = rainState();
    const moment = state.pendingMoment;
    if (!moment) throw new Error('Sem lance de chuva.');
    const me = f4.playerId;
    expect(moment.title).toBe(MOMENT_KIND_LABELS.rain);
    expect(moment.rivalId).toBeNull();
    expect(moment.options.map((o) => o.id)).toEqual(['pit', 'stay']);
    expect(moment.options.map((o) => o.risk)).toEqual([0, 2]);
    expect(chanceOf(moment, 'pit')).toBeGreaterThan(chanceOf(moment, 'stay'));
    // O engenheiro sugere um pneu de chuva, e o jogador está de pneu de seco.
    expect(TYRES[moment.suggestedCompound!].rain).toBe(true);
    expect(TYRES[carOf(state, me).tyre.compound].rain).toBe(false);
    expect(pointsOf(moment, 'stay', 'weather')).toBeLessThan(0);

    const rainman = again(state, withAttributes(f4.ctx, me, { wetSkill: 99 }));
    const reader = again(state, withAttributes(f4.ctx, me, { racecraft: 99 }));
    const lost = again(state, withAttributes(f4.ctx, me, { wetSkill: 40 }));
    expect(chanceOf(rainman, 'stay')).toBeGreaterThan(chanceOf(moment, 'stay') + 0.1);
    expect(chanceOf(reader, 'stay')).toBeGreaterThan(chanceOf(moment, 'stay'));
    expect(chanceOf(lost, 'stay')).toBeLessThan(chanceOf(moment, 'stay') - 0.1);
    for (const other of [rainman, reader, lost]) expect(chanceOf(other, 'pit')).toBe(chanceOf(moment, 'pit'));

    const team = f4.ctx.teams[carOf(state, me).teamId]!;
    const withCrew = (crew: number): RaceContext => ({ ...f4.ctx, teams: { ...f4.ctx.teams, [team.id]: { ...team, crew } } });
    expect(chanceOf(again(state, withCrew(40)), 'pit')).toBeLessThan(chanceOf(again(state, withCrew(75)), 'pit'));
    expect(chanceOf(again(state, withCrew(75)), 'pit')).toBeLessThan(chanceOf(again(state, withCrew(99)), 'pit'));
    expect(pointsOf(again(state, withCrew(40)), 'pit', 'crew')).toBeLessThan(0);
    expect(pointsOf(again(state, withCrew(99)), 'pit', 'crew')).toBeGreaterThan(0);
  });

  it('parada: o undercut depende do box e da velocidade; o overcut, de quanto pneu ainda resta e da gestão', () => {
    const state = pitState();
    const moment = state.pendingMoment;
    if (!moment) throw new Error('Sem lance de parada.');
    const me = f2.playerId;
    const car = carOf(state, me);
    expect(moment.title).toBe(MOMENT_KIND_LABELS.pit);
    expect(moment.rivalId).toBeNull();
    expect(moment.options.map((o) => o.id)).toEqual(['undercut', 'overcut']);
    expect(moment.options.map((o) => o.risk)).toEqual([1, 1]);
    // A pergunta chega pouco antes da parada planejada.
    const planned = car.plan[0]!;
    expect(planned.lap - moment.lap).toBeGreaterThanOrEqual(0);
    expect(planned.lap - moment.lap).toBeLessThanOrEqual(M.PIT.LEAD_LAPS);
    // Regra dos dois compostos: só usou o duro, então a lista só traz o outro composto de pista seca.
    expect(new Set(car.compoundsUsed).size).toBe(1);
    expect(moment.compounds).toEqual(f2.ctx.category.race.dryCompounds.filter((c) => !car.compoundsUsed.includes(c)));
    expect(moment.compounds).toHaveLength(1);
    expect(moment.suggestedCompound).toBe(planned.compound);

    expect(chanceOf(again(state, withAttributes(f2.ctx, me, { tyreManagement: 99 })), 'overcut')).toBeGreaterThan(chanceOf(moment, 'overcut'));
    expect(chanceOf(again(state, withAttributes(f2.ctx, me, { tyreManagement: 40 })), 'overcut')).toBeLessThan(chanceOf(moment, 'overcut'));
    expect(chanceOf(again(state, withAttributes(f2.ctx, me, { pace: 99 })), 'undercut')).toBeGreaterThan(chanceOf(moment, 'undercut'));
    expect(chanceOf(again(state, withAttributes(f2.ctx, me, { pace: 60 })), 'undercut')).toBeLessThan(chanceOf(moment, 'undercut'));
    const team = f2.ctx.teams[car.teamId]!;
    const withCrew = (crew: number): RaceContext => ({ ...f2.ctx, teams: { ...f2.ctx.teams, [team.id]: { ...team, crew } } });
    expect(chanceOf(again(state, withCrew(50)), 'undercut')).toBeLessThan(chanceOf(again(state, withCrew(99)), 'undercut'));
    // Pneu mais gasto: o undercut rende mais e o overcut fica mais difícil.
    const worn: RaceSimState = { ...state, cars: state.cars.map((c) => (c.driverId === me ? { ...c, tyre: { ...c.tyre, wear: 0.85 } } : c)) };
    expect(chanceOf(again(worn, f2.ctx), 'undercut')).toBeGreaterThan(chanceOf(moment, 'undercut'));
    expect(chanceOf(again(worn, f2.ctx), 'overcut')).toBeLessThan(chanceOf(moment, 'overcut'));
  });

  it('parada no Grand Prix: a lista de compostos respeita a regra dos dois compostos', () => {
    const state = grandPrixPitState();
    const moment = state.pendingMoment;
    const car = carOf(state, f1.playerId);
    expect(f1.ctx.category.race.mandatoryTwoCompounds).toBe(true);
    // Com um composto só usado até aqui, o que já foi usado sai da lista.
    expect(new Set(car.compoundsUsed).size).toBe(1);
    expect(moment?.compounds).toEqual(f1.ctx.category.race.dryCompounds.filter((c) => !car.compoundsUsed.includes(c)));
    expect(moment?.compounds).not.toContain(car.tyre.compound);
    expect(moment?.compounds).toContain(moment?.suggestedCompound);
    // Depois de cumprir a regra, qualquer composto de pista seca serve.
    const done: RaceSimState = { ...state, cars: state.cars.map((c) => (c.driverId === f1.playerId ? { ...c, compoundsUsed: ['hard', 'soft'] } : c)) };
    expect(upcomingMoment(done, f1.ctx)?.compounds).toEqual([...f1.ctx.category.race.dryCompounds]);
  });

  it('os fatores explicam a chance: sem repetição, sem zeros, do que mais pesa para o que menos pesa, e com o sinal coerente', () => {
    // Todos os lances das corridas inteiras, mais corridas na chuva e as situações montadas: os seis tipos de lance.
    const moments: RaceMoment[] = corpus().flatMap(({ races }) => races.flatMap((race) => race.resolved.map((step) => step.moment)));
    for (const seed of [1, 2, 3]) for (const step of play(kart.start(seed, WET), kart.ctx, bold).resolved) moments.push(step.moment);
    for (const state of [attackState(), defenseState(), wetAttackState()]) moments.push(upcomingMoment(state, kart.ctx)!);
    for (const state of [rainState(), pitState(), grandPrixPitState(), lonelyLastLap(), lastLapFight()]) moments.push(state.pendingMoment!);
    expect(new Set(moments.map((m) => m.kind))).toEqual(new Set(MOMENT_KINDS));

    const rules: Record<string, Record<string, { base: number; sure?: boolean }>> = M.OPTIONS;
    let explained = 0;
    for (const moment of moments) {
      expect(moment.options.length, moment.kind).toBeGreaterThanOrEqual(2);
      expect(Object.keys(rules[moment.kind]!)).toEqual(moment.options.map((o) => o.id));
      for (const option of moment.options) {
        const where = `${moment.kind}.${option.id}`;
        const rule = rules[moment.kind]![option.id]!;
        const keys = option.factors.map((f) => f.key);
        expect(new Set(keys).size, where).toBe(keys.length);
        for (const factor of option.factors) {
          expect(MOMENT_FACTOR_LABELS[factor.key], where).toBeTruthy();
          expect(Number.isInteger(factor.points), where).toBe(true);
          expect(factor.points, where).not.toBe(0);
        }
        const weights = option.factors.map((f) => Math.abs(f.points));
        expect(
          [...weights].sort((a, b) => b - a),
          where,
        ).toEqual(weights);
        if (rule.sure) {
          expect(option, where).toMatchObject({ chance: 1, factors: [] });
          continue;
        }
        expect(option.chance, where).toBeGreaterThanOrEqual(M.CHANCE_MIN);
        expect(option.chance, where).toBeLessThanOrEqual(M.CHANCE_MAX);
        // A chance de partida da opção: só fatores a favor a sobem; só fatores contra a baixam.
        const start = where === 'attack.wait' ? M.ATTACK.WAIT_BASE : Math.min(M.CHANCE_MAX, Math.max(M.CHANCE_MIN, sigmoid(rule.base)));
        if (option.factors.length > 0 && option.factors.every((f) => f.points > 0)) expect(option.chance, where).toBeGreaterThan(start - 0.011);
        if (option.factors.length > 0 && option.factors.every((f) => f.points < 0)) expect(option.chance, where).toBeLessThan(start + 0.011);
        if (option.factors.length > 0) explained++;
      }
    }
    expect(explained).toBeGreaterThan(500);
  });
});

/* ------------------------------------------------------------------ */
/* Talentos e defeitos                                                 */
/* ------------------------------------------------------------------ */

describe('talentos e defeitos de nascença mexem nas chances', () => {
  const id = kart.playerId;

  it('gênio na chuva vê chance maior de ficar na pista quando a chuva começa; medo de chuva, menor', () => {
    const state = rainState();
    const neutral = state.pendingMoment;
    const master = upcomingMoment(state, withTraits(f4, 'rainMaster'));
    const fear = upcomingMoment(state, withTraits(f4, 'rainFear'));
    expect(chanceOf(master, 'stay')).toBeGreaterThan(chanceOf(neutral, 'stay') + 0.1);
    expect(chanceOf(fear, 'stay')).toBeLessThan(chanceOf(neutral, 'stay') - 0.1);
    expect(pointsOf(master, 'stay', 'profile')).toBeGreaterThan(0);
    expect(pointsOf(fear, 'stay', 'profile')).toBeLessThan(0);
    expect(pointsOf(neutral, 'stay', 'profile')).toBe(0);
    // Parar nos boxes não depende do talento do piloto.
    expect(chanceOf(master, 'pit')).toBe(chanceOf(neutral, 'pit'));
    expect(chanceOf(fear, 'pit')).toBe(chanceOf(neutral, 'pit'));
  });

  it('na pista molhada o gênio na chuva larga e disputa melhor, e quem tem medo, pior; no seco não muda nada', () => {
    const wetStart = kart.start(1, WET);
    const master = upcomingMoment(wetStart, withTraits(kart, 'rainMaster'));
    const fear = upcomingMoment(wetStart, withTraits(kart, 'rainFear'));
    for (const option of ['inside', 'outside', 'hold']) {
      expect(chanceOf(master, option), option).toBeGreaterThan(chanceOf(wetStart.pendingMoment, option));
      expect(chanceOf(fear, option), option).toBeLessThan(chanceOf(wetStart.pendingMoment, option));
    }
    const wetDuel = wetAttackState();
    const duel = upcomingMoment(wetDuel, kart.ctx);
    expect(duel?.kind).toBe('attack');
    for (const option of ['dive', 'slipstream']) {
      expect(chanceOf(upcomingMoment(wetDuel, withTraits(kart, 'rainMaster')), option), option).toBeGreaterThan(chanceOf(duel, option) + 0.05);
      expect(chanceOf(upcomingMoment(wetDuel, withTraits(kart, 'rainFear')), option), option).toBeLessThan(chanceOf(duel, option) - 0.05);
    }
    // Pista seca: o talento de chuva não entra na conta.
    const dryStart = kart.start(1);
    for (const trait of ['rainMaster', 'rainFear'] as const) {
      expect(upcomingMoment(dryStart, withTraits(kart, trait))).toEqual(dryStart.pendingMoment);
      expect(upcomingMoment(attackState(), withTraits(kart, trait))).toEqual(upcomingMoment(attackState(), kart.ctx));
    }
  });

  it('largador nato melhora a largada e a largada sonolenta piora', () => {
    for (const weather of [DRY, WET]) {
      const state = kart.start(2, weather);
      const born = upcomingMoment(state, withTraits(kart, 'bornStarter'));
      const slow = upcomingMoment(state, withTraits(kart, 'slowStarter'));
      for (const option of ['inside', 'outside', 'hold']) {
        expect(chanceOf(born, option), option).toBeGreaterThan(chanceOf(state.pendingMoment, option));
        expect(chanceOf(slow, option), option).toBeLessThan(chanceOf(state.pendingMoment, option));
        expect(pointsOf(born, option, 'profile'), option).toBeGreaterThan(0);
        expect(pointsOf(slow, option, 'profile'), option).toBeLessThan(0);
      }
      expect(chanceOf(born, 'inside')).toBeGreaterThan(chanceOf(state.pendingMoment, 'inside') + 0.15);
    }
    // O talento de largada não mexe nos outros lances.
    expect(upcomingMoment(attackState(), withTraits(kart, 'bornStarter'))).toEqual(upcomingMoment(attackState(), kart.ctx));
  });

  it('poupador de pneus melhora o overcut; gastador piora', () => {
    for (const [setup, state] of [
      [f2, pitState()],
      [f1, grandPrixPitState()],
    ] as const) {
      const neutral = state.pendingMoment;
      const saver = upcomingMoment(state, withTraits(setup, 'tyreSaver'));
      const eater = upcomingMoment(state, withTraits(setup, 'tyreEater'));
      expect(chanceOf(saver, 'overcut')).toBeGreaterThan(chanceOf(neutral, 'overcut') + 0.03);
      expect(chanceOf(eater, 'overcut')).toBeLessThan(chanceOf(neutral, 'overcut') - 0.03);
      expect(pointsOf(saver, 'overcut', 'profile')).toBeGreaterThan(0);
      expect(pointsOf(eater, 'overcut', 'profile')).toBeLessThan(0);
      expect(chanceOf(saver, 'undercut')).toBe(chanceOf(neutral, 'undercut'));
      expect(chanceOf(eater, 'undercut')).toBe(chanceOf(neutral, 'undercut'));
    }
  });

  it('frieza melhora a última volta, com ou sem rival, e as disputas', () => {
    for (const [seed, state] of [
      ['sem rival', lonelyLastLap()],
      ['com rival', lastLapFight()],
    ] as const) {
      const neutral = state.pendingMoment;
      const cool = upcomingMoment(state, withProfile(kart.ctx, id, COOL));
      const nervous = upcomingMoment(state, withProfile(kart.ctx, id, NERVOUS));
      for (const option of ['allIn', 'secure']) {
        expect(chanceOf(cool, option), `${seed}: ${option}`).toBeGreaterThan(chanceOf(neutral, option));
        expect(chanceOf(nervous, option), `${seed}: ${option}`).toBeLessThan(chanceOf(neutral, option));
        expect(pointsOf(cool, option, 'profile'), `${seed}: ${option}`).toBeGreaterThan(0);
        expect(pointsOf(nervous, option, 'profile'), `${seed}: ${option}`).toBeLessThan(0);
      }
    }
    // Cada peça da frieza pesa sozinha: duelo de última volta no "tudo ou nada", erro de última volta no "garantir".
    const fight = lastLapFight();
    expect(chanceOf(upcomingMoment(fight, withProfile(kart.ctx, id, { lastLapDuel: COOL.lastLapDuel! })), 'allIn')).toBeGreaterThan(
      chanceOf(fight.pendingMoment, 'allIn'),
    );
    expect(chanceOf(upcomingMoment(fight, withProfile(kart.ctx, id, { duel: COOL.duel! })), 'allIn')).toBeGreaterThan(chanceOf(fight.pendingMoment, 'allIn'));
    expect(chanceOf(upcomingMoment(fight, withProfile(kart.ctx, id, { lastLapError: COOL.lastLapError! })), 'secure')).toBeGreaterThan(
      chanceOf(fight.pendingMoment, 'secure'),
    );
    // Nas disputas do meio da corrida vale a frieza de duelo (atacando e defendendo), não a de última volta.
    const attack = upcomingMoment(attackState(), kart.ctx);
    expect(chanceOf(upcomingMoment(attackState(), withProfile(kart.ctx, id, COOL)), 'dive')).toBeGreaterThan(chanceOf(attack, 'dive'));
    expect(chanceOf(upcomingMoment(attackState(), withProfile(kart.ctx, id, { lastLapDuel: COOL.lastLapDuel! })), 'dive')).toBe(chanceOf(attack, 'dive'));
    const defense = upcomingMoment(defenseState(), kart.ctx);
    expect(chanceOf(upcomingMoment(defenseState(), withProfile(kart.ctx, id, COOL)), 'block')).toBeGreaterThan(chanceOf(defense, 'block'));
    expect(chanceOf(upcomingMoment(defenseState(), withProfile(kart.ctx, id, NERVOUS)), 'block')).toBeLessThan(chanceOf(defense, 'block'));
  });

  it('o esquentado toca mais em lances errados que o piloto limpo, medido em muitas sementes', () => {
    const state = attackState();
    const hot = trials(state, withTraits(kart, 'hothead'), 'dive', 1000);
    const clean = trials(state, withTraits(kart, 'cleanRacer'), 'dive', 1000);
    const plain = diveTrials();
    expect(TRAIT_EFFECTS.hothead.collision).toBeGreaterThan(1);
    expect(TRAIT_EFFECTS.cleanRacer.collision).toBeLessThan(1);
    /** De cada lance errado, a parte que acaba em toque no rival. */
    const touchShare = (steps: readonly Resolved[]) => {
      const failed = steps.filter((s) => !s.record.success);
      return failed.filter((s) => s.record.contact).length / failed.length;
    };
    expect(touchShare(hot)).toBeGreaterThan(touchShare(plain));
    expect(touchShare(plain)).toBeGreaterThan(touchShare(clean));
    // O esquentado toca o dobro do piloto limpo (1,4 contra 0,7); com a folga da amostra, pelo menos uma vez e meia.
    expect(touchShare(hot)).toBeGreaterThan(1.5 * touchShare(clean));
    expect(hot.filter((s) => s.record.contact).length).toBeGreaterThan(clean.filter((s) => s.record.contact).length + 20);
    // Semente a semente: onde o piloto limpo toca, o esquentado também toca (ou acerta o lance, porque ataca um pouco melhor).
    clean.forEach((step, index) => {
      if (step.record.contact) expect(hot[index]!.record.contact || hot[index]!.record.success, `semente ${step.before.seed}`).toBe(true);
    });
    // Rodar e bater sozinho não dependem do temperamento.
    expect(Math.abs(count(hot, 'spin') - count(clean, 'spin'))).toBeLessThanOrEqual(5);
    // E o temperamento não muda a chance mostrada de quem espera o erro do rival.
    expect(chanceOf(upcomingMoment(state, withTraits(kart, 'hothead')), 'wait')).toBe(chanceOf(upcomingMoment(state, kart.ctx), 'wait'));
    expect(upcomingMoment(state, withTraits(kart, 'cleanRacer'))).toEqual(upcomingMoment(state, kart.ctx));
  });
});

/* ------------------------------------------------------------------ */
/* Estilo do piloto                                                    */
/* ------------------------------------------------------------------ */

describe('estilo do piloto: quem decide quando o jogador não responde', () => {
  const driver = kart.ctx.drivers[kart.playerId]!;
  const neutral = neutralRaceProfile();
  const withSkills = (patch: Partial<DriverAttributes>) => ({ ...driver, attributes: { ...driver.attributes, ...patch } });
  const withConfidence = (confidence: number) => ({ ...driver, condition: { ...driver.condition, confidence } });

  it('a nota de estilo sobe com ultrapassagem acima da defesa, confiança, temperamento esquentado e ritmo agressivo', () => {
    const base = drivingStyleScore(driver, neutral, 'balanced');
    expect(Number.isInteger(base)).toBe(true);
    // Piloto sem pendor nenhum (atributos iguais, confiança média, perfil neutro, ritmo equilibrado): 50.
    const flat = { ...withSkills({ overtaking: 70, defending: 70, pace: 70, consistency: 70 }), condition: { ...driver.condition, confidence: 50 } };
    expect(drivingStyleScore(flat, neutral, 'balanced')).toBe(50);

    expect(drivingStyleScore(withSkills({ overtaking: driver.attributes.overtaking + 20 }), neutral, 'balanced')).toBeGreaterThan(base);
    expect(drivingStyleScore(withSkills({ defending: driver.attributes.defending + 20 }), neutral, 'balanced')).toBeLessThan(base);
    expect(drivingStyleScore(withSkills({ pace: 99, consistency: 60 }), neutral, 'balanced')).toBeGreaterThan(base);
    expect(drivingStyleScore(withConfidence(90), neutral, 'balanced')).toBeGreaterThan(base);
    expect(drivingStyleScore(withConfidence(10), neutral, 'balanced')).toBeLessThan(base);
    // Esquentado soma; piloto limpo tira.
    expect(drivingStyleScore(driver, traitProfile('hothead'), 'balanced')).toBeGreaterThan(base + 10);
    expect(drivingStyleScore(driver, traitProfile('cleanRacer'), 'balanced')).toBeLessThan(base - 8);
    // O ritmo escolhido para a corrida também conta.
    expect(drivingStyleScore(driver, neutral, 'aggressive')).toBe(base + M.STYLE.MODE);
    expect(drivingStyleScore(driver, neutral, 'conservative')).toBe(base - M.STYLE.MODE);
    // Sempre entre 0 e 100.
    const wild = { ...withSkills({ overtaking: 99, defending: 1, pace: 99, consistency: 1 }), condition: { ...driver.condition, confidence: 100 } };
    const meek = { ...withSkills({ overtaking: 1, defending: 99, pace: 1, consistency: 99 }), condition: { ...driver.condition, confidence: 0 } };
    expect(drivingStyleScore(wild, traitProfile('hothead'), 'aggressive')).toBe(100);
    expect(drivingStyleScore(meek, traitProfile('cleanRacer'), 'conservative')).toBe(0);
  });

  it('o rótulo do estilo segue as faixas, e todo estilo tem nome e descrição', () => {
    expect(drivingStyle(0)).toBe('cautious');
    expect(drivingStyle(M.STYLE.CAUTIOUS_BELOW - 1)).toBe('cautious');
    expect(drivingStyle(M.STYLE.CAUTIOUS_BELOW)).toBe('balanced');
    expect(drivingStyle(50)).toBe('balanced');
    expect(drivingStyle(M.STYLE.AGGRESSIVE_FROM - 1)).toBe('balanced');
    expect(drivingStyle(M.STYLE.AGGRESSIVE_FROM)).toBe('aggressive');
    expect(drivingStyle(100)).toBe('aggressive');
    for (const style of ['cautious', 'balanced', 'aggressive'] as const) {
      expect(DRIVING_STYLE_LABELS[style].length).toBeGreaterThan(3);
      expect(DRIVING_STYLE_DESCRIPTIONS[style].length).toBeGreaterThan(10);
    }
  });

  /** O lance da largada com as chances trocadas: por dentro (arriscada), por fora (moderada), segurar (segura). */
  const startWith = (inside: number, outside: number, hold: number): RaceMoment => {
    const moment = kart.start(1).pendingMoment!;
    const chances: Record<string, number> = { inside, outside, hold };
    return { ...moment, options: moment.options.map((o) => ({ ...o, chance: chances[o.id]! })) };
  };

  it('escolhe a arriscada quando a chance passa do limite do estilo, e a segura quando não passa', () => {
    const [riskyCautious, riskyAggressive] = M.STYLE.RISKY_MIN_CHANCE;
    const [moderateCautious, moderateAggressive] = M.STYLE.MODERATE_MIN_CHANCE;
    expect(riskyCautious).toBeGreaterThan(riskyAggressive);
    expect(moderateCautious).toBeGreaterThan(moderateAggressive);
    // Com a moderada fora do jogo (chance baixa), a escolha é entre a arriscada e a segura.
    const pick = (inside: number, score: number) => chooseByStyle(startWith(inside, 0.1, 0.9), score).option;
    // Piloto cauteloso (0): só arrisca acima do limite alto.
    expect(pick(riskyCautious + 0.01, 0)).toBe('inside');
    expect(pick(riskyCautious - 0.01, 0)).toBe('hold');
    // Piloto agressivo (100): arrisca com a chance apertada.
    expect(pick(riskyAggressive + 0.01, 100)).toBe('inside');
    expect(pick(riskyAggressive - 0.01, 100)).toBe('hold');
    // No meio do caminho (50), o limite é a média dos dois.
    const middle = (riskyCautious + riskyAggressive) / 2;
    expect(pick(middle + 0.01, 50)).toBe('inside');
    expect(pick(middle - 0.01, 50)).toBe('hold');
    // A mesma chance: o agressivo vai, o cauteloso segura.
    expect(pick(0.6, 100)).toBe('inside');
    expect(pick(0.6, 0)).toBe('hold');
    // Notas fora da faixa valem como os extremos.
    expect(pick(0.6, 140)).toBe('inside');
    expect(pick(0.6, -20)).toBe('hold');
  });

  it('entre as opções que o estilo aceita, fica com a mais ousada; a moderada tem o seu próprio limite', () => {
    const [moderateCautious, moderateAggressive] = M.STYLE.MODERATE_MIN_CHANCE;
    // Arriscada recusada, moderada aceita: vai de moderada.
    expect(chooseByStyle(startWith(0.2, moderateCautious + 0.01, 0.9), 0).option).toBe('outside');
    expect(chooseByStyle(startWith(0.2, moderateCautious - 0.01, 0.9), 0).option).toBe('hold');
    expect(chooseByStyle(startWith(0.2, moderateAggressive + 0.01, 0.9), 100).option).toBe('outside');
    expect(chooseByStyle(startWith(0.2, moderateAggressive - 0.01, 0.9), 100).option).toBe('hold');
    // As duas aceitas: a arriscada, mesmo com chance menor que a moderada.
    expect(chooseByStyle(startWith(0.8, 0.95, 0.97), 0).option).toBe('inside');
    // A escolha nunca fica mais tímida quando a nota de estilo sobe.
    for (const moment of [startWith(0.5, 0.5, 0.9), startWith(0.7, 0.4, 0.9), startWith(0.46, 0.31, 0.9), kart.start(1).pendingMoment!]) {
      let risk = 0;
      for (let score = 0; score <= 100; score += 5) {
        const chosen = optionOf(moment, chooseByStyle(moment, score).option).risk;
        expect(chosen).toBeGreaterThanOrEqual(risk);
        risk = chosen;
      }
    }
    // Sem opção aceitável (só arriscadas, com pouca chance): a de maior chance.
    const base = kart.start(1).pendingMoment!;
    const desperate: RaceMoment = {
      ...base,
      options: [
        { ...base.options[0]!, id: 'a', risk: 2, chance: 0.2 },
        { ...base.options[0]!, id: 'b', risk: 2, chance: 0.3 },
      ],
    };
    expect(chooseByStyle(desperate, 0).option).toBe('b');
    // No lance de parada, a escolha leva o composto sugerido pelo engenheiro.
    const pit = pitState().pendingMoment!;
    expect(chooseByStyle(pit, 50).compound).toBe(pit.suggestedCompound);
    expect(chooseByStyle(base, 50).compound).toBeUndefined();
  });

  it('sem resposta (ausente ou null), o registro sai como decisão do piloto, com a opção do estilo dele', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const mode of ['conservative', 'balanced', 'aggressive'] as const) {
        const state = kart.start(seed);
        const expected = chooseByStyle(state.pendingMoment!, drivingStyleScore(driver, neutral, mode));
        const absent = stepRaceLap(state, kart.ctx, { mode });
        const empty = stepRaceLap(state, kart.ctx, { mode, moment: null });
        expect(empty).toEqual(absent);
        expect(absent.moments).toHaveLength(1);
        expect(absent.moments[0]).toMatchObject({ lap: 1, kind: 'start', auto: true, option: expected.option });
        expect(absent.moments[0]!.chance).toBe(chanceOf(state.pendingMoment, expected.option));
      }
    }
    // O estilo conta o perfil de nascença e o ritmo escolhido: com as mesmas chances na tela, o
    // esquentado vai por dentro e o piloto limpo vai por fora; o piloto neutro só arrisca se não estiver poupando.
    const state = kart.start(1);
    const sharp = withAttributes(kart.ctx, kart.playerId, { experience: 70, focus: 95 });
    const decided = (profile: DriverRaceProfile, mode: PlayerRaceInput['mode']) => {
      const ctx = withProfile(sharp, kart.playerId, profile);
      const moment = upcomingMoment(state, ctx)!;
      const record = stepRaceLap({ ...state, pendingMoment: moment }, ctx, { mode }).moments[0]!;
      expect(record.auto).toBe(true);
      expect(record.option).toBe(chooseByStyle(moment, drivingStyleScore(ctx.drivers[kart.playerId]!, profile, mode)).option);
      return record.option;
    };
    expect(decided(traitProfile('hothead'), 'balanced')).toBe('inside');
    expect(decided(traitProfile('cleanRacer'), 'balanced')).toBe('outside');
    expect(decided(neutral, 'balanced')).toBe('inside');
    expect(decided(neutral, 'conservative')).toBe('outside');
  });

  it('com resposta válida vale a escolha do jogador, mesmo com o engenheiro automático; resposta inválida cai no estilo', () => {
    const state = kart.start(2);
    const style = chooseByStyle(state.pendingMoment!, drivingStyleScore(driver, neutral, 'balanced')).option;
    for (const auto of [false, true]) {
      for (const option of ['inside', 'outside', 'hold']) {
        const next = stepRaceLap(state, kart.ctx, { mode: 'balanced', auto, moment: { option } });
        expect(next.moments[0], `${option}, auto ${auto}`).toMatchObject({ kind: 'start', option, auto: false, chance: chanceOf(state.pendingMoment, option) });
      }
      for (const bad of ['voar', '', 'dive']) {
        const next = stepRaceLap(state, kart.ctx, { mode: 'balanced', auto, moment: { option: bad } });
        expect(next.moments[0], `"${bad}", auto ${auto}`).toMatchObject({ kind: 'start', option: style, auto: true });
        expect(next).toEqual(stepRaceLap(state, kart.ctx, { mode: 'balanced', auto }));
      }
    }
    // Composto que não está na lista do lance de parada: vale o sugerido pelo engenheiro.
    const pit = pitState();
    const moment = pit.pendingMoment!;
    const used = carOf(pit, f2.playerId).tyre.compound;
    expect(moment.compounds).not.toContain(used);
    const stopped = stepRaceLap(pit, f2.ctx, { ...AUTO, moment: { option: 'undercut', compound: used } });
    expect(stopped.moments.at(-1)).toMatchObject({ kind: 'pit', option: 'undercut', auto: false });
    expect(carOf(stopped, f2.playerId).tyre.compound).toBe(moment.suggestedCompound);
  });
});

/* ------------------------------------------------------------------ */
/* Simular direto                                                      */
/* ------------------------------------------------------------------ */

describe('simular direto continua funcionando', () => {
  it('simular até o fim é igual a correr volta a volta sem responder a lance nenhum', () => {
    for (const [setup, seed] of [
      [kart, 4],
      [f4, 6],
      [f2, 3],
    ] as const) {
      const whole = simulateRemainingRace(setup.start(seed), setup.ctx, AUTO);
      let state = setup.start(seed);
      while (!isRaceFinished(state)) state = stepRaceLap(state, setup.ctx, { ...AUTO, pit: null, moment: null });
      expect(state).toEqual(whole);
      expect(isRaceFinished(whole)).toBe(true);
      expect(whole.pendingMoment).toBeNull();
      // Todos os lances foram decididos pelo estilo do piloto.
      expect(whole.moments.length).toBeGreaterThanOrEqual(1);
      expect(whole.moments.every((m) => m.auto)).toBe(true);
      expect(whole.moments[0]).toMatchObject({ kind: 'start', lap: 1 });
      // Uma resposta esquecida na entrada não vale para a corrida toda: é descartada.
      expect(simulateRemainingRace(setup.start(seed), setup.ctx, { ...AUTO, moment: { option: 'inside' } })).toEqual(whole);
      const result = finalizeRace(whole, setup.ctx.category);
      expect(result.entries).toHaveLength(whole.cars.length);
    }
  });

  it('com a largada respondida pelo jogador, simular o resto termina a corrida e só a largada fica como escolha dele', () => {
    for (const [setup, seed] of [
      [kart, 6],
      [f1, 2],
    ] as const) {
      const started = stepRaceLap(setup.start(seed), setup.ctx, { mode: 'balanced', moment: { option: 'outside' } });
      expect(started.currentLap).toBe(1);
      const finished = simulateRemainingRace(started, setup.ctx, AUTO);
      expect(isRaceFinished(finished)).toBe(true);
      expect(finished.moments[0]).toMatchObject({ kind: 'start', option: 'outside', auto: false });
      expect(finished.moments.slice(1).every((m) => m.auto)).toBe(true);
      expect(finished.moments.length).toBeLessThanOrEqual(M.MAX_PER_RACE);
      expect(simulateRemainingRace(started, setup.ctx, AUTO)).toEqual(finished);
      const result = finalizeRace(finished, setup.ctx.category);
      expect(result.moments).toBe(finished.moments);
      expect(result.entries.some((e) => e.driverId === setup.playerId)).toBe(true);
    }
  });

  it('simular a partir de um lance pendente no meio da corrida resolve o lance pelo estilo', () => {
    const state = { ...attackState(), pendingMoment: upcomingMoment(attackState(), kart.ctx) };
    const driver = kart.ctx.drivers[kart.playerId]!;
    const expected = chooseByStyle(state.pendingMoment!, drivingStyleScore(driver, neutralRaceProfile(), 'balanced'));
    const finished = simulateRemainingRace(state, kart.ctx, AUTO);
    expect(isRaceFinished(finished)).toBe(true);
    expect(finished.moments[1]).toMatchObject({ kind: 'attack', lap: state.currentLap + 1, auto: true, option: expected.option });
    // Uma corrida já terminada não muda.
    expect(simulateRemainingRace(finished, kart.ctx, AUTO)).toBe(finished);
    expect(stepRaceLap(finished, kart.ctx, { mode: 'balanced', moment: { option: 'dive' } })).toBe(finished);
  });
});

/* ------------------------------------------------------------------ */
/* Orçamento: de 2 a 4 lances por corrida                              */
/* ------------------------------------------------------------------ */

/** Corridas inteiras nas quatro categorias do critério, alternando as três políticas de lance pela semente. */
const POLICIES = [bold, safe, byStyle] as const;
const corpus = memo(() =>
  (
    [
      [kart, 45],
      [f4, 45],
      [f2, 30],
      [f1, 15],
    ] as const
  ).map(([setup, seeds]) => ({
    setup,
    races: Array.from({ length: seeds }, (_, i) => ({ seed: i + 1, ...play(setup.start(i + 1), setup.ctx, POLICIES[(i + 1) % 3]!) })),
  })),
);

describe('orçamento: de 2 a 4 lances por corrida', () => {
  it('nenhuma corrida passa do máximo, nunca há dois lances na mesma volta e a largada sempre abre a conta', () => {
    for (const { setup, races } of corpus()) {
      const id = setup.ctx.category.id;
      let full = 0;
      let total = 0;
      for (const { seed, final } of races) {
        const where = `${id}, semente ${seed}`;
        const moments = final.moments;
        expect(moments.length, where).toBeGreaterThanOrEqual(1);
        expect(moments.length, where).toBeLessThanOrEqual(M.MAX_PER_RACE);
        expect(moments[0], where).toMatchObject({ kind: 'start', lap: 1 });
        for (let i = 1; i < moments.length; i++) expect(moments[i]!.lap, where).toBeGreaterThan(moments[i - 1]!.lap);
        // Um de cada, no máximo: largada, chuva, parada e última volta.
        for (const kind of ['start', 'rain', 'pit', 'lastLap'] as const)
          expect(moments.filter((m) => m.kind === kind).length, `${where}: ${kind}`).toBeLessThanOrEqual(1);
        for (const moment of moments) {
          expect(moment.lap, where).toBeLessThanOrEqual(final.totalLaps);
          if (moment.kind === 'lastLap') expect(moment.lap, where).toBe(final.totalLaps);
          else expect(moment.lap, where).toBeLessThan(final.totalLaps);
          expect(MomentRecordSchema.parse(moment), where).toEqual(moment);
          expect(moment.message.length, where).toBeGreaterThan(10);
        }
        if (moments.length === M.MAX_PER_RACE) full++;
        total += moments.length;
      }
      // O orçamento é usado: há corridas com o máximo, e a média fica entre o mínimo e o máximo.
      expect(full, id).toBeGreaterThan(0);
      expect(total / races.length, id).toBeGreaterThan(M.MIN_PER_RACE);
      expect(total / races.length, id).toBeLessThan(M.MAX_PER_RACE);
    }
  });

  it('toda corrida que o jogador termina sob bandeira verde tem pelo menos o mínimo de lances', () => {
    for (const { setup, races } of corpus()) {
      const id = setup.ctx.category.id;
      let green = 0;
      for (const { seed, final, lastLapGreen } of races) {
        // Fora da regra: abandono do jogador, bandeira vermelha final e safety car (ou relargada) na última volta.
        if (carOf(final, setup.playerId).status !== 'running' || final.endedEarly || !lastLapGreen) continue;
        green++;
        expect(final.moments.length, `${id}, semente ${seed}`).toBeGreaterThanOrEqual(M.MIN_PER_RACE);
      }
      expect(green / races.length, id).toBeGreaterThan(0.7);
    }
  });

  it('lances de disputa respeitam o máximo, o intervalo e ficam fora das primeiras voltas e da penúltima', () => {
    let duels = 0;
    for (const { setup, races } of corpus()) {
      for (const { seed, final } of races) {
        const where = `${setup.ctx.category.id}, semente ${seed}`;
        const cooldown = Math.max(M.COOLDOWN_LAPS, Math.round(final.totalLaps * M.COOLDOWN_SHARE));
        const moments = final.moments;
        expect(moments.filter((m) => m.kind === 'attack' || m.kind === 'defense').length, where).toBeLessThanOrEqual(M.MAX_DUELS);
        moments.forEach((moment, index) => {
          if (moment.kind !== 'attack' && moment.kind !== 'defense') return;
          duels++;
          expect(moment.rivalId, where).toBeTruthy();
          // Fora das primeiras voltas: o intervalo conta da largada (volta 1).
          expect(moment.lap, where).toBeGreaterThanOrEqual(1 + cooldown);
          expect(final.totalLaps - moment.lap, where).toBeGreaterThanOrEqual(2);
          expect(moment.lap - (moments[index - 1]?.lap ?? 0), where).toBeGreaterThanOrEqual(cooldown);
          // Um lance fica guardado para o fim: a disputa nunca é o último lance do orçamento.
          expect(index, where).toBeLessThan(M.MAX_PER_RACE - 1);
        });
      }
    }
    expect(duels).toBeGreaterThan(100);
  });

  it('lance de parada só nas categorias com boxes; lance de chuva só com clima variável, e nunca no kart', () => {
    const seen: Record<string, Set<MomentKind>> = {};
    for (const { setup, races } of corpus()) {
      const rules = setup.ctx.category.race;
      const kinds = new Set(races.flatMap((r) => r.final.moments.map((m) => m.kind)));
      seen[setup.ctx.category.id] = kinds;
      if (!rules.pitStops) expect(kinds.has('pit'), setup.ctx.category.id).toBe(false);
      if (!rules.changingWeather) expect(kinds.has('rain'), setup.ctx.category.id).toBe(false);
      for (const { resolved } of races) {
        for (const { before, moment } of resolved) {
          const car = carOf(before, setup.playerId);
          if (moment.kind === 'pit') {
            // Em pista seca, com pneu de seco e com corrida suficiente para esticar o stint.
            expect(TYRES[car.tyre.compound].rain).toBe(false);
            expect(before.totalLaps - moment.lap).toBeGreaterThanOrEqual(M.PIT.STRETCH_LAPS + 2);
            expect(moment.compounds?.length).toBeGreaterThan(0);
          }
          if (moment.kind === 'rain') {
            // A pista passa de seca a úmida nesta volta, e o carro está de pneu de seco.
            expect(TYRES[car.tyre.compound].rain).toBe(false);
            expect(before.wetnessByLap[moment.lap]!).toBeGreaterThan(before.wetnessByLap[moment.lap - 1]!);
            expect(before.totalLaps - moment.lap).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
    expect(kart.ctx.category.race.pitStops).toBe(false);
    expect(kart.ctx.category.race.changingWeather).toBe(false);
    expect([...seen['kart-regional']!].sort()).toEqual(['attack', 'defense', 'lastLap', 'start'].filter((k) => seen['kart-regional']!.has(k as MomentKind)));
    expect(seen['kart-regional']!.has('attack')).toBe(true);
    expect(seen['kart-regional']!.has('lastLap')).toBe(true);
    // Onde há boxes e clima variável, os dois lances aparecem.
    expect(seen.f2!.has('pit')).toBe(true);
    expect(seen.f1!.has('pit')).toBe(true);
    expect(seen.f4!.has('rain')).toBe(true);
    // Kart com pista molhada desde a largada: continua sem lance de chuva e sem lance de parada.
    for (const seed of [1, 2, 3]) {
      const kinds = play(kart.start(seed, WET), kart.ctx, bold).final.moments.map((m) => m.kind);
      expect(kinds).not.toContain('rain');
      expect(kinds).not.toContain('pit');
    }
  });

  it('as regras do orçamento, uma a uma, no estado montado', () => {
    const state = attackState();
    const lap = state.currentLap + 1;
    const cooldown = Math.max(M.COOLDOWN_LAPS, Math.round(state.totalLaps * M.COOLDOWN_SHARE));
    const start = pastMoment('start', 1);
    const next = (patch: Partial<RaceSimState>) => upcomingMoment({ ...state, ...patch }, kart.ctx);
    expect(next({ moments: [start] })?.kind).toBe('attack');
    // Intervalo entre lances: no limite abre, uma volta antes não.
    expect(next({ moments: [start, pastMoment('pit', lap - cooldown)] })?.kind).toBe('attack');
    expect(next({ moments: [start, pastMoment('pit', lap - cooldown + 1)] })).toBeNull();
    // Máximo de disputas, e um lance guardado para a última volta.
    expect(next({ moments: [pastMoment('attack', 1), pastMoment('defense', lap - cooldown)] })).toBeNull();
    expect(next({ moments: [pastMoment('attack', 1), pastMoment('pit', lap - cooldown)] })?.kind).toBe('attack');
    expect(next({ moments: [start, pastMoment('attack', 2), pastMoment('pit', lap - cooldown)] })).toBeNull();
    // Uma pergunta por volta: sob safety car, em relargada ou com ordem de equipe pendente não há lance.
    expect(next({ neutralization: { type: 'sc', lapsLeft: 2 } })).toBeNull();
    expect(next({ neutralization: { type: 'vsc', lapsLeft: 1 } })).toBeNull();
    expect(next({ restart: 'rolling' })).toBeNull();
    expect(next({ restart: 'standing' })).toBeNull();
    expect(next({ pendingTeamOrder: { teamId: 'x', favouredDriverId: 'y' } })).toBeNull();
    // Corrida encerrada, penúltima volta, jogador fora da pista: nada.
    expect(next({ endedEarly: true })).toBeNull();
    expect(next({ currentLap: state.totalLaps })).toBeNull();
    expect(next({ currentLap: state.totalLaps - 2 })).toBeNull();
    expect(next({ cars: state.cars.map((c) => (c.driverId === kart.playerId ? { ...c, status: 'dnf' as const } : c)) })).toBeNull();

    // Última volta: fecha a conta quando falta lance para o mínimo, com ou sem alguém por perto.
    const last = { currentLap: state.totalLaps - 1 };
    const lonely = duelState();
    const alone = upcomingMoment({ ...lonely, ...last }, kart.ctx);
    expect(alone).toMatchObject({ kind: 'lastLap', lap: state.totalLaps, rivalId: null });
    expect(next({ ...last, moments: [start] })).toMatchObject({ kind: 'lastLap', rivalId: state.cars[placeOf(state, kart.playerId) - 1]!.driverId });
    // Com o mínimo já cumprido, só abre se houver briga: um carro a até LAST_LAP_GAP, à frente ou atrás.
    const two = [start, pastMoment('attack', 5)];
    expect(upcomingMoment({ ...lonely, ...last, moments: two }, kart.ctx)).toBeNull();
    expect(next({ ...last, moments: two })?.kind).toBe('lastLap');
    expect(upcomingMoment({ ...duelState({ gapBehind: M.LAST_LAP_GAP - 0.1 }), ...last, moments: two }, kart.ctx)).toMatchObject({
      kind: 'lastLap',
      rivalId: null,
    });
    expect(upcomingMoment({ ...duelState({ gapAhead: M.LAST_LAP_GAP + 0.2 }), ...last, moments: two }, kart.ctx)).toBeNull();
    // O "tudo ou nada" mira o carro da frente até LAST_LAP_REACH; mais longe que isso, é uma volta sozinho.
    expect(upcomingMoment({ ...duelState({ gapAhead: M.LAST_LAP_REACH - 0.1 }), ...last }, kart.ctx)?.rivalId).toBeTruthy();
    expect(upcomingMoment({ ...duelState({ gapAhead: M.LAST_LAP_REACH + 0.2 }), ...last }, kart.ctx)?.rivalId).toBeNull();
    // Orçamento esgotado: nem na última volta.
    const spent = [start, pastMoment('attack', 5), pastMoment('pit', 9), pastMoment('defense', 14)];
    expect(next({ ...last, moments: spent })).toBeNull();
    expect(next({ moments: spent })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Desfechos                                                           */
/* ------------------------------------------------------------------ */

/** O mesmo lance resolvido muitas vezes, cada vez com uma semente. */
function trials(state: RaceSimState, ctx: RaceContext, option: string, count: number): Resolved[] {
  const moment = upcomingMoment(state, ctx);
  if (!moment) throw new Error('O estado montado não tem lance.');
  return Array.from({ length: count }, (_, i) => trial(state, ctx, moment, option, i + 1));
}
const diveTrials = memo(() => trials(attackState(), kart.ctx, 'dive', 1000));
const slipstreamTrials = memo(() => trials(attackState(), kart.ctx, 'slipstream', 300));
const waitTrials = memo(() => trials(attackState(), kart.ctx, 'wait', 400));
const blockTrials = memo(() => trials(defenseState(), kart.ctx, 'block', 600));
const yieldTrials = memo(() => trials(defenseState(), kart.ctx, 'yield', 200));

const rate = (steps: readonly Resolved[]) => steps.filter((s) => s.record.success).length / steps.length;
const meanChance = (steps: readonly Resolved[]) => steps.reduce((sum, s) => sum + s.record.chance, 0) / steps.length;
const count = (steps: readonly Resolved[], outcome: MomentRecord['outcome']) => steps.filter((s) => s.record.outcome === outcome).length;

describe('desfechos dos lances', () => {
  /** Todos os lances resolvidos nas corridas inteiras, com o id do jogador de cada corrida. */
  const raced = memo(() => corpus().flatMap(({ setup, races }) => races.flatMap((r) => r.resolved.map((step) => ({ step, playerId: setup.playerId })))));
  const crafted = memo(() => [...diveTrials(), ...blockTrials(), ...slipstreamTrials()].map((step) => ({ step, playerId: kart.playerId })));

  it('com a opção arriscada, em muitas sementes, aparecem os cinco desfechos', () => {
    const steps = diveTrials();
    expect(new Set(steps.map((s) => s.record.outcome))).toEqual(new Set(MOMENT_OUTCOMES));
    // Dar certo ou só perder tempo é o comum; rodar, tocar e abandonar são os riscos da opção.
    expect(count(steps, 'won')).toBeGreaterThan(150);
    expect(count(steps, 'lost')).toBeGreaterThan(count(steps, 'won'));
    expect(count(steps, 'touch')).toBeGreaterThan(count(steps, 'spin'));
    expect(count(steps, 'spin')).toBeGreaterThan(count(steps, 'retired'));
    expect(count(steps, 'retired')).toBeGreaterThan(3);
    expect(count(steps, 'retired')).toBeLessThan(steps.length * 0.05);
    // A opção segura do mesmo lance nunca tem incidente.
    expect(new Set(waitTrials().map((s) => s.record.outcome))).toEqual(new Set(['won', 'lost']));
    expect(new Set(slipstreamTrials().map((s) => s.record.outcome))).toEqual(new Set(['won', 'lost']));
    expect(new Set(yieldTrials().map((s) => s.record.outcome))).toEqual(new Set(['won']));
    // Nas corridas inteiras também aparecem todos.
    expect(new Set(raced().map(({ step }) => step.record.outcome))).toEqual(new Set(MOMENT_OUTCOMES));
  });

  it('a taxa de acerto observada fica perto da chance mostrada', () => {
    // Mesmo lance, muitas sementes: a tolerância é de três desvios-padrão da proporção, com folga.
    for (const [name, steps, tolerance] of [
      ['mergulho', diveTrials(), 0.05],
      ['fechar a porta', blockTrials(), 0.06],
      ['esperar o erro', waitTrials(), 0.07],
      ['vácuo', slipstreamTrials(), 0.09],
    ] as const) {
      const shown = steps[0]!.record.chance;
      expect(
        steps.every((s) => s.record.chance === shown),
        name,
      ).toBe(true);
      expect(Math.abs(rate(steps) - shown), `${name}: mostrada ${shown}, observada ${rate(steps)}`).toBeLessThan(tolerance);
    }
    expect(rate(yieldTrials())).toBe(1);
    // Corridas inteiras, todas as políticas juntas: a média observada acompanha a média mostrada.
    const all = raced().map(({ step }) => step);
    expect(all.length).toBeGreaterThan(350);
    expect(Math.abs(rate(all) - meanChance(all))).toBeLessThan(0.06);
    // E quem mostra chance alta acerta mais que quem mostra chance baixa.
    const likely = all.filter((s) => s.record.chance >= 0.6);
    const unlikely = all.filter((s) => s.record.chance < 0.4);
    expect(likely.length).toBeGreaterThan(80);
    expect(unlikely.length).toBeGreaterThan(80);
    expect(rate(likely)).toBeGreaterThan(rate(unlikely) + 0.3);
  });

  it('o registro conta o que houve: opção, chance, acerto e desfecho coerentes', () => {
    for (const { step } of [...raced(), ...crafted()]) {
      const { record, moment } = step;
      const where = `${record.kind}.${record.option} na volta ${record.lap}`;
      expect(record.lap, where).toBe(moment.lap);
      expect(record.kind, where).toBe(moment.kind);
      expect(record.chance, where).toBe(chanceOf(moment, record.option));
      expect(record.rivalId ?? null, where).toBe(moment.rivalId);
      // Deu certo é "won"; os outros quatro desfechos são de lance errado.
      expect(record.outcome === 'won', where).toBe(record.success);
      // Toque só em lance com rival, e só nos desfechos de toque ou abandono.
      if (record.contact) {
        expect(record.rivalId, where).toBeTruthy();
        expect(['touch', 'retired'], where).toContain(record.outcome);
      }
      if (record.outcome === 'touch') expect(record.contact, where).toBe(true);
      expect(record.message.length, where).toBeGreaterThan(10);
      expect(step.after.moments.at(-1), where).toBe(record);
      expect(step.after.moments.length, where).toBe(step.before.moments.length + 1);
    }
  });

  it('todo toque tem o evento de colisão ou de abandono entre o jogador e o rival, na mesma volta', () => {
    let touches = 0;
    let rivalOut = 0;
    for (const { step, playerId } of [...raced(), ...crafted()]) {
      const { record, after, before } = step;
      if (record.outcome !== 'touch') continue;
      touches++;
      const rival = record.rivalId!;
      const where = `${record.kind}.${record.option}, volta ${record.lap}, semente ${before.seed}`;
      const event = after.events.find(
        (e) =>
          e.lap === record.lap &&
          (e.type === 'collision' || e.type === 'dnf') &&
          ((e.driverId === playerId && e.otherDriverId === rival) || (e.driverId === rival && e.otherDriverId === playerId)),
      );
      if (!event) throw new Error(`Toque sem evento: ${where}`);
      // "Tocou" é o jogador seguindo na corrida: com danos (toque simples) ou com o rival fora.
      expect(carOf(after, playerId).status, where).toBe('running');
      expect(carOf(after, playerId).damageTotal, where).toBeGreaterThan(carOf(before, playerId).damageTotal);
      if (event.type === 'dnf') {
        rivalOut++;
        expect(event.driverId, where).toBe(rival);
        expect(carOf(after, rival), where).toMatchObject({ status: 'dnf', dnfReason: 'collision' });
      } else {
        expect(event, where).toMatchObject({ driverId: playerId, otherDriverId: rival });
        expect(carOf(after, rival).damageTotal, where).toBeGreaterThan(carOf(before, rival).damageTotal);
      }
    }
    expect(touches).toBeGreaterThan(40);
    expect(rivalOut).toBeGreaterThan(0);
  });

  it('a punição do lance aparece no registro, no carro e nos eventos', () => {
    let punished = 0;
    for (const { step, playerId } of [...raced(), ...crafted()]) {
      const { record, after, before } = step;
      const where = `${record.kind}.${record.option}, volta ${record.lap}, semente ${before.seed}`;
      expect([0, RACE.COLLISION_PENALTY, RACE.COLLISION_DNF_PENALTY], where).toContain(record.penaltySeconds);
      if (record.penaltySeconds === 0) continue;
      punished++;
      // Só há punição de lance quando houve toque e o jogador seguiu na corrida.
      expect(record, where).toMatchObject({ contact: true, outcome: 'touch' });
      const mine = carOf(after, playerId);
      expect(mine.penaltySeconds - carOf(before, playerId).penaltySeconds, where).toBeGreaterThanOrEqual(record.penaltySeconds);
      expect(mine.penaltyPoints, where).toBeGreaterThan(carOf(before, playerId).penaltyPoints);
      expect(
        after.events.some((e) => e.lap === record.lap && e.type === 'penalty' && e.driverId === playerId && e.otherDriverId === record.rivalId),
        where,
      ).toBe(true);
      expect(record.message, where).toContain(`${record.penaltySeconds} s`);
      // A punição maior é a de tirar o rival da corrida, e vem com perda de posições no próximo grid.
      if (record.penaltySeconds === RACE.COLLISION_DNF_PENALTY) {
        expect(carOf(after, record.rivalId!).status, where).toBe('dnf');
        expect(mine.gridDropNext, where).toBeGreaterThan(carOf(before, playerId).gridDropNext);
      }
    }
    expect(punished).toBeGreaterThan(8);
    // A punição entra no resultado oficial.
    const { step, playerId } = [...raced()].find(({ step }) => step.record.penaltySeconds > 0) ?? { step: null, playerId: '' };
    if (step) expect(carOf(step.after, playerId).penaltySeconds).toBeGreaterThanOrEqual(step.record.penaltySeconds);
  });

  it('"rodou" deixa o jogador na pista com tempo perdido; "abandonou" tira o jogador da corrida, e os lances acabam', () => {
    let spins = 0;
    let retirements = 0;
    for (const { step, playerId } of [...raced(), ...crafted()]) {
      const { record, after, before } = step;
      const where = `${record.kind}.${record.option}, volta ${record.lap}, semente ${before.seed}`;
      const mine = carOf(after, playerId);
      if (record.outcome === 'spin') {
        spins++;
        expect(
          after.events.some((e) => e.lap === record.lap && e.type === 'spin' && e.driverId === playerId),
          where,
        ).toBe(true);
        expect(mine.errors, where).toBeGreaterThan(carOf(before, playerId).errors);
        expect(record.contact, where).toBe(false);
      }
      if (record.outcome === 'retired') {
        retirements++;
        expect(mine.status, where).toBe('dnf');
        expect(mine.lapsCompleted, where).toBe(record.lap - 1);
        expect(mine.dnfReason, where).toBe(record.contact ? 'collision' : 'crash');
        expect(
          after.events.some((e) => e.lap === record.lap && e.type === 'dnf' && e.driverId === playerId),
          where,
        ).toBe(true);
        expect(after.pendingMoment, where).toBeNull();
        expect(after.carry, where).toBeNull();
        expect(upcomingMoment(after, kart.ctx), where).toBeNull();
      }
    }
    expect(spins).toBeGreaterThan(20);
    expect(retirements).toBeGreaterThan(8);
    // Numa corrida inteira, o lance do abandono é o último registro, e o rádio se cala.
    let checked = 0;
    for (const { setup, races } of corpus()) {
      for (const { final } of races) {
        const index = final.moments.findIndex((m) => m.outcome === 'retired');
        if (index < 0) continue;
        checked++;
        expect(index).toBe(final.moments.length - 1);
        expect(carOf(final, setup.playerId).status).toBe('dnf');
        expect(final.radio.every((r) => r.lap < final.moments[index]!.lap)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('o resultado da corrida leva os lances e não leva o rádio', () => {
    for (const { setup, races } of corpus()) {
      for (const { final } of races.slice(0, 6)) {
        const result = finalizeRace(final, setup.ctx.category);
        expect(result.moments).toBe(final.moments);
        expect('radio' in result).toBe(false);
        expect(Object.keys(result)).not.toContain('pendingMoment');
        expect(Object.keys(result)).not.toContain('carry');
        const saved = JSON.stringify(result);
        for (const message of final.radio) expect(saved).not.toContain(message.message);
      }
    }
    // E há rádio para não levar: o corpus tem corridas com mensagens.
    expect(corpus().some(({ races }) => races.some((r) => r.final.radio.length > 0))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Efeitos na pista                                                    */
/* ------------------------------------------------------------------ */

describe('o que cada opção faz na pista', () => {
  const id = kart.playerId;
  const ahead = (state: RaceSimState, a: string, b: string) => placeOf(state, a) < placeOf(state, b);
  const overtook = (step: Resolved, attacker: string, defender: string) =>
    step.after.events.some((e) => e.lap === step.moment.lap && e.type === 'overtake' && e.driverId === attacker && e.otherDriverId === defender);

  it('ataque que dá certo passa o rival naquela volta', () => {
    for (const [name, steps] of [
      ['mergulho', diveTrials()],
      ['vácuo', slipstreamTrials()],
      ['esperar o erro', waitTrials()],
    ] as const) {
      let passes = 0;
      for (const step of steps) {
        const rival = step.moment.rivalId!;
        expect(ahead(step.before, rival, id), name).toBe(true);
        // Fora da regra: o jogador errou sozinho na mesma volta, ou o rival já não está na pista.
        if (!step.record.success || !cleanLap(step, id) || carOf(step.after, rival).status !== 'running') continue;
        passes++;
        const where = `${name}, semente ${step.before.seed}`;
        expect(ahead(step.after, id, rival), where).toBe(true);
        expect(overtook(step, id, rival), where).toBe(true);
        expect(carOf(step.after, id).overtakes, where).toBeGreaterThan(carOf(step.before, id).overtakes);
      }
      expect(passes, name).toBeGreaterThan(40);
    }
    // Esperar o erro que dá certo: o rival erra sob pressão (evento dele, citando o jogador).
    for (const step of waitTrials()) {
      const rival = step.moment.rivalId!;
      const pressured = step.after.events.some((e) => e.lap === step.moment.lap && e.type === 'error' && e.driverId === rival && e.otherDriverId === id);
      if (carOf(step.after, rival).status === 'running' && carOf(step.after, id).status === 'running')
        expect(pressured, `semente ${step.before.seed}`).toBe(step.record.success);
    }
  });

  // Quando o rival do lance ultrapassa outro carro na mesma volta, o passe garantido do jogador não é
  // gasto no carro que ficou entre os dois: ele vale até passar o rival. (Caso que já falhou:
  // raceSetup('f2'), semente 87, sempre a arriscada, mergulhos das voltas 13 e 25; semente 8, pelo
  // estilo, vácuo da volta 15.)
  it('em corrida inteira, o ataque que dá certo também deixa o jogador à frente do rival', () => {
    let passes = 0;
    for (const [seed, answer] of [
      [87, bold],
      [8, byStyle],
    ] as const) {
      for (const step of play(f2.start(seed), f2.ctx, answer).resolved) {
        const rival = step.moment.rivalId;
        if (step.moment.kind !== 'attack' || !rival || !step.record.success) continue;
        if (!cleanLap(step, f2.playerId) || carOf(step.after, rival).status !== 'running') continue;
        passes++;
        expect(ahead(step.after, f2.playerId, rival), `semente ${seed}, volta ${step.moment.lap}`).toBe(true);
      }
    }
    expect(passes).toBeGreaterThan(0);
  });

  it('nas corridas inteiras, o ataque que dá certo sempre rende a posição do carro da frente', () => {
    let wins = 0;
    for (const { setup, races } of corpus()) {
      for (const { resolved } of races) {
        for (const step of resolved) {
          const rival = step.moment.rivalId;
          if (step.moment.kind !== 'attack' || !rival || !step.record.success || !cleanLap(step, setup.playerId)) continue;
          wins++;
          // O jogador ultrapassa alguém na volta do lance (o rival, quase sempre: ver o teste pendente acima).
          expect(carOf(step.after, setup.playerId).overtakes).toBeGreaterThan(carOf(step.before, setup.playerId).overtakes);
        }
      }
    }
    expect(wins).toBeGreaterThan(15);
  });

  it('"fechar a porta" que dá certo mantém o jogador à frente; "ceder" entrega a posição', () => {
    let held = 0;
    let broken = 0;
    for (const step of blockTrials()) {
      const rival = step.moment.rivalId!;
      const where = `semente ${step.before.seed}`;
      expect(ahead(step.before, id, rival), where).toBe(true);
      if (!cleanLap(step, id) || !cleanLap(step, rival) || carOf(step.after, rival).status !== 'running' || carOf(step.after, id).status !== 'running')
        continue;
      if (step.record.success) {
        held++;
        expect(ahead(step.after, id, rival), where).toBe(true);
        expect(overtook(step, rival, id), where).toBe(false);
      } else if (step.record.outcome === 'lost') {
        // Não segurou: o rival passa.
        broken++;
        expect(ahead(step.after, rival, id), where).toBe(true);
        expect(overtook(step, rival, id), where).toBe(true);
      }
    }
    expect(held).toBeGreaterThan(300);
    expect(broken).toBeGreaterThan(50);

    let given = 0;
    for (const step of yieldTrials()) {
      const rival = step.moment.rivalId!;
      const where = `semente ${step.before.seed}`;
      expect(step.record, where).toMatchObject({ option: 'yield', chance: 1, success: true, outcome: 'won', contact: false, penaltySeconds: 0 });
      if (!cleanLap(step, id) || !cleanLap(step, rival) || carOf(step.after, rival).status !== 'running') continue;
      given++;
      expect(ahead(step.after, rival, id), where).toBe(true);
      expect(overtook(step, rival, id), where).toBe(true);
      // Entrega uma posição, e só uma.
      expect(placeOf(step.after, id), where).toBe(placeOf(step.before, id) + 1);
    }
    expect(given).toBeGreaterThan(150);
  });

  /** Segue a corrida por algumas voltas, anotando o pneu e as paradas do jogador ao fim de cada uma. */
  function follow(setup: RaceSetup, state: RaceSimState, laps: number, auto: boolean) {
    const trace: { lap: number; compound: string; stops: number }[] = [];
    let current = state;
    for (let i = 0; i < laps && !isRaceFinished(current); i++) {
      current = stepRaceLap(current, setup.ctx, { mode: 'balanced', auto, moment: current.pendingMoment ? safe(current.pendingMoment, current) : null });
      const car = carOf(current, setup.playerId);
      trace.push({ lap: current.currentLap, compound: car.tyre.compound, stops: car.pitStops });
    }
    return { trace, final: current };
  }

  it('undercut: para naquela volta, com o composto escolhido; overcut: adia a parada', () => {
    for (const [setup, state] of [
      [f1, grandPrixPitState()],
      [f2, pitState()],
    ] as const) {
      const moment = state.pendingMoment!;
      const me = setup.playerId;
      const before = carOf(state, me);
      const planned = before.plan[0]!;
      const where = `${setup.ctx.category.id}, semente ${state.seed}`;
      // O último composto da lista: no Grand Prix, não é o sugerido pelo engenheiro.
      const compound = moment.compounds!.at(-1)!;
      if (setup === f1) expect(compound, where).not.toBe(moment.suggestedCompound);
      for (const auto of [true, false]) {
        // Undercut: a parada vem agora, antes da volta planejada, e sai com o composto pedido.
        const under = stepRaceLap(state, setup.ctx, { mode: 'balanced', auto, moment: { option: 'undercut', compound } });
        const stopped = carOf(under, me);
        expect(under.moments.at(-1), where).toMatchObject({ kind: 'pit', option: 'undercut', auto: false });
        expect(stopped.pitStops, where).toBe(before.pitStops + 1);
        expect(stopped.tyre, where).toEqual({ compound, wear: 0, age: 0 });
        expect(stopped.compoundsUsed.at(-1), where).toBe(compound);
        expect(new Set(stopped.compoundsUsed.filter((c) => !TYRES[c].rain)).size, where).toBeGreaterThanOrEqual(2);
        expect(moment.lap, where).toBeLessThanOrEqual(planned.lap);
        expect(
          stopped.plan.some((s) => s.lap === planned.lap),
          where,
        ).toBe(false);
        expect(
          under.events.some((e) => e.lap === moment.lap && e.type === 'pit' && e.driverId === me),
          where,
        ).toBe(true);
        // Dando certo, as voltas de saída são mais rápidas; dando errado, não há bônus.
        if (under.moments.at(-1)!.success)
          expect(under.carry, where).toMatchObject({ fromLap: moment.lap + 1, untilLap: moment.lap + M.PIT.OUT_LAPS, holdPit: false });
        else expect(under.carry, where).toBeNull();
        if (under.carry) expect(under.carry.pace, where).toBeLessThan(0);

        // Overcut: fica na pista com o mesmo pneu e remarca a parada para algumas voltas depois.
        const over = stepRaceLap(state, setup.ctx, { mode: 'balanced', auto, moment: { option: 'overcut', compound } });
        const stayed = carOf(over, me);
        const stopLap = moment.lap + M.PIT.STRETCH_LAPS;
        expect(over.moments.at(-1), where).toMatchObject({ kind: 'pit', option: 'overcut', auto: false });
        expect(stayed.pitStops, where).toBe(before.pitStops);
        expect(stayed.tyre.compound, where).toBe(before.tyre.compound);
        expect(stayed.plan[0], where).toEqual({ lap: stopLap, compound });
        expect(stopLap, where).toBeGreaterThan(planned.lap);
        expect(over.carry, where).toMatchObject({ fromLap: moment.lap, untilLap: stopLap - 1, holdPit: true });
        // Dando certo, o pneu é poupado; dando errado, o ritmo cai até a parada.
        if (over.moments.at(-1)!.success) expect(over.carry!.wear, where).toBeLessThan(1);
        else expect(over.carry!.pace, where).toBeGreaterThan(0);
        // Nas voltas seguintes ninguém chama para os boxes antes da volta marcada, e nela a parada acontece.
        const { trace } = follow(setup, over, M.PIT.STRETCH_LAPS + 1, auto);
        for (const point of trace) {
          if (point.lap < stopLap) expect(point, `${where}, volta ${point.lap}`).toMatchObject({ compound: before.tyre.compound, stops: before.pitStops });
          else expect(point, `${where}, volta ${point.lap}`).toMatchObject({ compound, stops: before.pitStops + 1 });
        }
        expect(trace.at(-1)!.lap, where).toBeGreaterThanOrEqual(stopLap);
      }
    }
  });

  it('o overcut que dá certo gasta menos pneu que o que dá errado, na mesma volta', () => {
    const state = pitState();
    const moment = state.pendingMoment!;
    const wearAfter = (k: number) => {
      const step = trial(state, f2.ctx, moment, 'overcut', k);
      return {
        success: step.record.success,
        wear: carOf(step.after, f2.playerId).tyre.wear - carOf(state, f2.playerId).tyre.wear,
        outcome: step.record.outcome,
      };
    };
    const results = Array.from({ length: 40 }, (_, i) => wearAfter(i + 1));
    const good = results.filter((r) => r.success);
    const bad = results.filter((r) => !r.success);
    expect(good.length).toBeGreaterThan(5);
    expect(bad.length).toBeGreaterThan(2);
    // Sem incidente possível: errar o overcut é só o pneu acabar antes da hora.
    expect(new Set(results.map((r) => r.outcome))).toEqual(new Set(['won', 'lost']));
    const worst = Math.max(...good.map((r) => r.wear));
    for (const r of bad) expect(r.wear).toBeGreaterThan(worst);
    expect(good[0]!.wear / bad[0]!.wear).toBeCloseTo(M.PIT.STRETCH_WEAR, 2);
  });

  /** O lance de chuva resolvido com "ficar na pista" em várias sementes: há as que dão certo e as em que o piloto roda. */
  const stayTrials = memo(() => {
    const state = rainState();
    return Array.from({ length: 60 }, (_, i) => trial(state, f4.ctx, state.pendingMoment!, 'stay', i + 1));
  });

  it('chuva: "parar" troca para pneu de chuva naquela volta', () => {
    const state = rainState();
    const moment = state.pendingMoment!;
    const me = f4.playerId;
    const before = carOf(state, me);
    for (const auto of [true, false]) {
      const pitted = stepRaceLap(state, f4.ctx, { mode: 'balanced', auto, moment: { option: 'pit' } });
      const car = carOf(pitted, me);
      expect(pitted.moments.at(-1)).toMatchObject({ kind: 'rain', option: 'pit', lap: moment.lap, auto: false });
      expect(car.tyre).toEqual({ compound: moment.suggestedCompound, wear: 0, age: 0 });
      expect(TYRES[car.tyre.compound].rain).toBe(true);
      expect(car.pitStops).toBe(before.pitStops + 1);
      expect(pitted.carry).toBeNull();
      expect(pitted.events.some((e) => e.lap === moment.lap && e.type === 'pit' && e.driverId === me)).toBe(true);
    }
    // Sem resposta, com o engenheiro automático, o piloto decide pelo estilo: uma das duas opções, e o registro diz qual.
    const auto = stepRaceLap(state, f4.ctx, AUTO).moments.at(-1)!;
    expect(auto).toMatchObject({ kind: 'rain', auto: true });
    expect(['pit', 'stay']).toContain(auto.option);
  });

  it('chuva: "ficar" mantém o pneu de seco pelas voltas previstas e depois para; dando errado, a parada vem na volta seguinte', () => {
    const state = rainState();
    const moment = state.pendingMoment!;
    const me = f4.playerId;
    const before = carOf(state, me);
    const stopLap = moment.lap + M.RAIN.STAY_LAPS;
    expect(new Set(stayTrials().map((s) => s.record.outcome)).has('won')).toBe(true);
    expect(new Set(stayTrials().map((s) => s.record.outcome)).has('spin')).toBe(true);
    // Fora da regra: bandeira vermelha (troca de pneus liberada para todos) e abandono do jogador nas voltas seguintes.
    const settled = (from: RaceSimState, laps: number, auto: boolean) => {
      const { trace, final } = follow(f4, from, laps, auto);
      return final.redFlags === state.redFlags && carOf(final, me).status === 'running' ? trace : null;
    };

    let lucky = 0;
    for (const step of stayTrials()) {
      if (!step.record.success || lucky >= 3) continue;
      const stayed = step.after;
      const traces = [true, false].map((auto) => settled(stayed, M.RAIN.STAY_LAPS, auto));
      if (carOf(stayed, me).status !== 'running' || traces.includes(null)) continue;
      lucky++;
      const where = `semente ${step.before.seed}`;
      expect(step.record, where).toMatchObject({ kind: 'rain', option: 'stay', outcome: 'won' });
      expect(carOf(stayed, me).tyre.compound, where).toBe(before.tyre.compound);
      expect(carOf(stayed, me).pitStops, where).toBe(before.pitStops);
      // A parada já fica marcada, e até lá o engenheiro não chama (e o pneu de seco perde menos na água).
      expect(carOf(stayed, me).plan[0], where).toEqual({ lap: stopLap, compound: moment.suggestedCompound });
      expect(stayed.carry, where).toMatchObject({ fromLap: moment.lap, untilLap: stopLap - 1, grip: M.RAIN.STAY_GRIP, holdPit: true });
      for (const trace of traces) {
        for (const point of trace!) {
          if (point.lap < stopLap) expect(point, `${where}, volta ${point.lap}`).toMatchObject({ compound: before.tyre.compound, stops: before.pitStops });
          else expect(point, `${where}, volta ${point.lap}`).toMatchObject({ compound: moment.suggestedCompound, stops: before.pitStops + 1 });
        }
        expect(trace!.at(-1)!.lap, where).toBe(stopLap);
      }
    }
    expect(lucky).toBeGreaterThan(0);

    let unlucky = 0;
    for (const step of stayTrials()) {
      if (step.record.success || unlucky >= 3) continue;
      const failed = step.after;
      const traces = [true, false].map((auto) => settled(failed, 1, auto));
      if (carOf(failed, me).status !== 'running' || failed.redFlags !== state.redFlags || traces.includes(null)) continue;
      unlucky++;
      const where = `semente ${step.before.seed}`;
      expect(failed.carry, where).toBeNull();
      expect(carOf(failed, me).tyre.compound, where).toBe(before.tyre.compound);
      expect(carOf(failed, me).plan[0], where).toEqual({ lap: moment.lap + 1, compound: moment.suggestedCompound });
      for (const trace of traces) {
        expect(trace![0], where).toMatchObject({ lap: moment.lap + 1, compound: moment.suggestedCompound, stops: before.pitStops + 1 });
      }
    }
    expect(unlucky).toBeGreaterThan(0);
  });

  it('ficar na pista que dá certo rende: nas voltas da chuva o pneu de seco perde menos do que perderia', () => {
    const state = rainState();
    const moment = state.pendingMoment!;
    const me = f4.playerId;
    const stayed = stayTrials().find((s) => s.record.success)!.after;
    // Mesma semente, mesma volta: com o lance vencido a volta sai mais rápida do que sem o alívio de aderência.
    const noGrip: RaceSimState = { ...stayed, carry: { ...stayed.carry!, grip: 1 } };
    const withRelief = stepRaceLap(stayed, f4.ctx, { mode: 'balanced', skipPlannedStop: true });
    const without = stepRaceLap(noGrip, f4.ctx, { mode: 'balanced', skipPlannedStop: true });
    expect(stayed.wetnessByLap[moment.lap + 1]!).toBeGreaterThan(0.15);
    expect(carOf(withRelief, me).tyre.compound).toBe(carOf(state, me).tyre.compound);
    expect(carOf(withRelief, me).lastLap!).toBeLessThan(carOf(without, me).lastLap!);
  });
});

/* ------------------------------------------------------------------ */
/* A sorte dos outros                                                  */
/* ------------------------------------------------------------------ */

describe('a escolha do jogador não mexe na sorte dos outros', () => {
  it('com o jogador largando em último, a primeira volta do líder é idêntica qualquer que seja a opção na largada', () => {
    const order = [...kart.drivers.map((d) => d.id).filter((id) => id !== kart.playerId), kart.playerId];
    for (const seed of [1, 2, 3, 4]) {
      const start = kart.start(seed, DRY, undefined, order);
      expect(start.cars.at(-1)!.driverId).toBe(kart.playerId);
      const pole = start.cars[0]!.driverId;
      const laps = ['inside', 'outside', 'hold'].map((option) => stepRaceLap(start, kart.ctx, { mode: 'balanced', moment: { option } }));
      const [inside, outside, hold] = laps;
      for (const other of [outside!, hold!]) {
        expect(carOf(other, pole).lastLap, `semente ${seed}`).toBe(carOf(inside!, pole).lastLap);
        expect(carOf(other, pole).totalTime, `semente ${seed}`).toBe(carOf(inside!, pole).totalTime);
        // E não só o pole: a metade da frente do grid inteira faz a mesma volta.
        for (const car of inside!.cars.filter((c) => c.grid <= 10)) expect(carOf(other, car.driverId), `semente ${seed}, ${car.driverId}`).toEqual(car);
      }
      // Sem resposta (estilo do piloto) também.
      const auto = stepRaceLap(start, kart.ctx, { mode: 'balanced' });
      expect(carOf(auto, pole)).toEqual(carOf(inside!, pole));
    }
  });

  it('num lance de disputa, quem está longe faz a mesma volta com qualquer opção do jogador', () => {
    const state = attackState();
    const moment = upcomingMoment(state, kart.ctx)!;
    const far = state.cars.slice(0, 3).map((c) => c.driverId);
    const back = state.cars
      .filter((c) => c.status === 'running')
      .slice(-4)
      .map((c) => c.driverId);
    for (let k = 1; k <= 12; k++) {
      const [dive, wait, slipstream] = ['dive', 'wait', 'slipstream'].map((option) => trial(state, kart.ctx, moment, option, k).after);
      for (const driverId of [...far, ...back]) {
        expect(carOf(wait!, driverId), `semente ${k}, ${driverId}`).toEqual(carOf(dive!, driverId));
        expect(carOf(slipstream!, driverId), `semente ${k}, ${driverId}`).toEqual(carOf(dive!, driverId));
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Pilotos melhores vencem mais lances                                 */
/* ------------------------------------------------------------------ */

describe('pilotos melhores vencem mais lances', () => {
  const LEVELS = [-10, 0, 10] as const;
  /** Corridas de kart com a mesma política (sempre a opção arriscada) para o jogador original, com +10 e com −10 em tudo. */
  const byLevel = memo(
    () =>
      new Map(
        LEVELS.map((delta) => {
          const ctx = delta === 0 ? kart.ctx : shifted(kart, delta);
          return [delta, Array.from({ length: 90 }, (_, i) => play(opening(kart, ctx, i + 1), ctx, bold)).flatMap((race) => race.resolved)] as const;
        }),
      ),
  );
  const of = (delta: (typeof LEVELS)[number], ...kinds: MomentKind[]) =>
    byLevel()
      .get(delta)!
      .filter((s) => kinds.length === 0 || kinds.includes(s.record.kind));

  it('na mesma situação, o piloto melhor vê chance maior em toda opção arriscada (e nunca menor nas outras)', () => {
    const situations: [RaceSetup, RaceSimState][] = [
      [kart, kart.start(1)],
      [kart, kart.start(1, WET)],
      [kart, attackState()],
      [kart, wetAttackState()],
      [kart, defenseState()],
      [kart, lonelyLastLap()],
      [kart, lastLapFight()],
      [f4, rainState()],
      [f2, pitState()],
    ];
    const kinds = new Set<MomentKind>();
    for (const [setup, state] of situations) {
      const [worse, same, better] = LEVELS.map((delta) => upcomingMoment(state, delta === 0 ? setup.ctx : shifted(setup, delta)));
      if (!worse || !same || !better) throw new Error('Situação sem lance.');
      kinds.add(same.kind);
      expect(worse.kind).toBe(same.kind);
      expect(better.kind).toBe(same.kind);
      for (const option of same.options) {
        const where = `${same.kind}.${option.id}`;
        expect(chanceOf(better, option.id), where).toBeGreaterThanOrEqual(option.chance);
        expect(chanceOf(worse, option.id), where).toBeLessThanOrEqual(option.chance);
        if (option.risk === 2) {
          expect(chanceOf(better, option.id), where).toBeGreaterThan(option.chance + 0.03);
          expect(chanceOf(worse, option.id), where).toBeLessThan(option.chance - 0.03);
        }
      }
    }
    expect(kinds).toEqual(new Set(MOMENT_KINDS));
  });

  it('com a mesma política (sempre a opção arriscada), +10 em tudo acerta bem mais lances que o piloto original', () => {
    for (const delta of LEVELS) {
      const steps = of(delta);
      expect(steps.length, `nível ${delta}`).toBeGreaterThan(150);
      // Todas as escolhas foram a opção mais arriscada do lance.
      expect(steps.every((s) => optionOf(s.moment, s.record.option).risk === Math.max(...s.moment.options.map((o) => o.risk)))).toBe(true);
      // A taxa observada acompanha a chance média mostrada.
      expect(Math.abs(rate(steps) - meanChance(steps)), `nível ${delta}`).toBeLessThan(0.07);
    }
    expect(rate(of(10))).toBeGreaterThan(rate(of(0)) + 0.1);
    expect(rate(of(10))).toBeGreaterThan(rate(of(-10)) + 0.1);
    expect(meanChance(of(10))).toBeGreaterThan(meanChance(of(0)) + 0.1);
  });

  it('em cada tipo de lance de iniciativa (largada, ataque, última volta) a ordem é estrita: +10 > original > −10', () => {
    for (const kind of ['start', 'attack', 'lastLap'] as const) {
      const [worse, same, better] = LEVELS.map((delta) => of(delta, kind));
      for (const steps of [worse!, same!, better!]) expect(steps.length, kind).toBeGreaterThan(30);
      expect(rate(better!), kind).toBeGreaterThan(rate(same!) + 0.05);
      expect(rate(same!), kind).toBeGreaterThan(rate(worse!) + 0.05);
      expect(meanChance(better!), kind).toBeGreaterThan(meanChance(same!));
      expect(meanChance(same!), kind).toBeGreaterThan(meanChance(worse!));
    }
    // Os três juntos: são os lances em que o piloto parte para cima.
    const initiative = (delta: (typeof LEVELS)[number]) => rate(of(delta, 'start', 'attack', 'lastLap'));
    expect(initiative(10)).toBeGreaterThan(initiative(0) + 0.1);
    expect(initiative(0)).toBeGreaterThan(initiative(-10) + 0.08);
    // Largada: o sorteio é o mesmo nas três corridas de cada semente, então quem acerta com menos chance acerta com mais.
    const wins = (delta: (typeof LEVELS)[number]) => new Set(of(delta, 'start').flatMap((s) => (s.record.success ? [s.before.seed] : [])));
    for (const seed of wins(-10)) expect(wins(0).has(seed), `semente ${seed}`).toBe(true);
    for (const seed of wins(0)) expect(wins(10).has(seed), `semente ${seed}`).toBe(true);
  });

  it('o piloto mais fraco passa a corrida se defendendo; o mais forte quase não é atacado', () => {
    const defenses = (delta: (typeof LEVELS)[number]) => of(delta, 'defense').length;
    expect(defenses(-10)).toBeGreaterThan(30);
    expect(defenses(-10)).toBeGreaterThan(3 * defenses(0));
    expect(defenses(0)).toBeGreaterThanOrEqual(defenses(10));
    // "Fechar a porta" parte de uma chance alta (quem está à frente tem a pista a favor): é o lance mais fácil de vencer.
    expect(rate(of(-10, 'defense'))).toBeGreaterThan(rate(of(-10, 'attack')) + 0.3);
  });

  // A taxa GERAL de acerto (todos os lances somados) não separa o piloto original do que tem −10: o
  // mais fraco recebe muito mais lances de defesa (teste acima), em que "fechar a porta" acerta mais
  // do que um ataque, e a mistura de lances compensa o que ele perde em cada tipo. Por isso a regra
  // "pilotos melhores vencem mais lances" é conferida por tipo de lance (testes acima) e, no
  // simulador, pela chance oferecida e pelos lances arriscados vencidos por corrida (seção 9).
});

/* ------------------------------------------------------------------ */
/* Rivalidade no save                                                  */
/* ------------------------------------------------------------------ */

describe('um toque num lance vira rivalidade no save', () => {
  /** Joga etapas (sempre a opção arriscada) até uma delas ter um lance com toque. */
  function untilContact(career: CareerState, limit = 8) {
    let current = career;
    for (let i = 0; i < limit; i++) {
      const before = current;
      current = playRound(current, { moments: 'bold' });
      const round = current.rounds.at(-1)!;
      const moment = round.race.moments.find((m) => m.contact && m.rivalId);
      if (moment?.rivalId) return { before, after: current, round, moment, rivalId: moment.rivalId };
    }
    throw new Error(`Nenhum toque em lance em ${limit} etapas.`);
  }
  const story = memo(() => untilContact(newCareer(42)));
  const newRivalMessages = (career: CareerState) => career.inbox.filter((m) => m.title.startsWith('Rivalidade nova'));

  it('a etapa grava a rivalidade, o registro do toque e a mensagem "Rivalidade nova"', () => {
    const { before, after, round, moment, rivalId } = story();
    const rival = after.drivers.find((d) => d.id === rivalId)!;
    expect(moment.auto).toBe(false);
    expect(['touch', 'retired']).toContain(moment.outcome);
    // Antes da etapa não havia nada com esse piloto.
    expect(before.relations.rivalries[rivalId] ?? 0).toBe(0);
    expect(before.relations.rivalryLog.some((r) => r.driverId === rivalId)).toBe(false);
    expect(newRivalMessages(before)).toHaveLength(0);

    const retired = round.race.events.some((e) => e.type === 'dnf' && e.lap === moment.lap && e.otherDriverId !== undefined);
    expect(after.relations.rivalries[rivalId]!).toBeGreaterThan(0);
    expect(after.relations.rivalries[rivalId]!).toBeGreaterThanOrEqual(retired ? RELATION_RULES.RIVALRY_DNF : RELATION_RULES.RIVALRY_COLLISION);
    const entry = after.relations.rivalryLog.at(-1)!;
    expect(entry).toEqual({ driverId: rivalId, season: round.season, round: round.round, lap: moment.lap, kind: moment.kind, retired, fresh: true });
    expect(RivalryRecordSchema.parse(entry)).toEqual(entry);
    expect(after.relations.rivalryLog).toHaveLength(before.relations.rivalryLog.length + round.race.moments.filter((m) => m.contact && m.rivalId).length);

    const messages = newRivalMessages(after);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.title).toBe(`Rivalidade nova: ${rival.firstName} ${rival.lastName}`);
    expect(messages[0]!.category).toBe('race');
    expect(messages[0]!.body).toContain(`volta ${moment.lap}`);
    expect(messages[0]!.body).toContain(rival.lastName);
    // O lance e o evento de toque estão no resultado gravado da etapa.
    expect(round.race.moments).toContain(moment);
    expect(
      round.race.events.some(
        (e) =>
          e.lap === moment.lap &&
          (e.type === 'collision' || e.type === 'dnf') &&
          [e.driverId, e.otherDriverId].includes(rivalId) &&
          [e.driverId, e.otherDriverId].includes(before.playerDriverId),
      ),
    ).toBe(true);
  });

  it('o registro respeita o limite de história: entra o toque novo e sai o mais antigo', () => {
    const { before, rivalId, moment } = story();
    const limit = HISTORY_LIMITS.RIVALRY_LOG;
    const filler: RivalryRecord[] = Array.from({ length: limit }, (_, i) => ({
      driverId: 'antigo',
      season: 1,
      round: i + 1,
      lap: 3,
      kind: 'attack',
      retired: false,
      fresh: false,
    }));
    const full = playRound({ ...before, relations: { ...before.relations, rivalryLog: filler } }, { moments: 'bold' });
    expect(full.relations.rivalryLog).toHaveLength(limit);
    expect(full.relations.rivalryLog.at(-1)).toMatchObject({ driverId: rivalId, lap: moment.lap, kind: moment.kind, fresh: true });
    expect(full.relations.rivalryLog[0]).toEqual(filler[1]);
    expect(full.relations.rivalryLog.slice(0, -1)).toEqual(filler.slice(1));
    // Abaixo do limite nada se perde.
    const partial = playRound({ ...before, relations: { ...before.relations, rivalryLog: filler.slice(0, 5) } }, { moments: 'bold' });
    expect(partial.relations.rivalryLog).toHaveLength(6);
    expect(partial.relations.rivalryLog.slice(0, 5)).toEqual(filler.slice(0, 5));
  });

  it('com quem já era rival, o toque entra no registro sem "rivalidade nova"; sem toque, nada é gravado', () => {
    const { before, rivalId, moment } = story();
    const known = playRound(
      { ...before, relations: { ...before.relations, rivalries: { ...before.relations.rivalries, [rivalId]: 30 } } },
      { moments: 'bold' },
    );
    const again = known.rounds.at(-1)!.race.moments.find((m) => m.contact && m.rivalId === rivalId);
    expect(again).toMatchObject({ lap: moment.lap, kind: moment.kind });
    expect(known.relations.rivalryLog.at(-1)).toMatchObject({ driverId: rivalId, fresh: false });
    expect(known.relations.rivalries[rivalId]!).toBeGreaterThan(30);
    expect(newRivalMessages(known)).toHaveLength(0);

    // Etapas sem toque em lance: o registro fica como estava.
    let career = newCareer(31);
    for (let i = 0; i < 2; i++) {
      const next = playRound(career, { moments: 'safe' });
      const touched = next.rounds.at(-1)!.race.moments.filter((m) => m.contact && m.rivalId).length;
      expect(next.relations.rivalryLog).toHaveLength(career.relations.rivalryLog.length + touched);
      if (touched === 0) expect(newRivalMessages(next)).toHaveLength(newRivalMessages(career).length);
      career = next;
    }
    expect(newCareer(31).relations.rivalryLog).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Rádio do engenheiro                                                 */
/* ------------------------------------------------------------------ */

describe('rádio do engenheiro', () => {
  const TOPICS = ['tyresLimit', 'tyresGone', 'rivalPitted', 'rain', 'closing', 'pitWindow'];

  it('fala no máximo uma vez por volta, nunca na última, e só com o jogador na pista', () => {
    let messages = 0;
    for (const { setup, races } of corpus()) {
      for (const { seed, final } of races) {
        const where = `${setup.ctx.category.id}, semente ${seed}`;
        const me = carOf(final, setup.playerId);
        final.radio.forEach((message, index) => {
          messages++;
          expect(TOPICS, where).toContain(message.topic);
          expect(message.message.length, where).toBeGreaterThan(10);
          expect(message.lap, where).toBeGreaterThanOrEqual(1);
          expect(message.lap, where).toBeLessThan(final.totalLaps);
          // Uma por volta, em ordem.
          if (index > 0) expect(message.lap, where).toBeGreaterThan(final.radio[index - 1]!.lap);
          // Depois do abandono do jogador, silêncio.
          if (me.status === 'dnf') expect(message.lap, where).toBeLessThanOrEqual(me.lapsCompleted);
        });
      }
    }
    expect(messages).toBeGreaterThan(100);
  });

  it('em corridas com desgaste e paradas aparecem os avisos de pneu, de janela e de rival nos boxes', () => {
    const topics = (setup: RaceSetup) =>
      new Set(
        corpus()
          .find((c) => c.setup === setup)!
          .races.flatMap((r) => r.final.radio.map((m) => m.topic)),
      );
    for (const setup of [f2, f1]) {
      for (const topic of ['tyresLimit', 'pitWindow', 'rivalPitted', 'closing'] as const)
        expect(topics(setup).has(topic), `${setup.ctx.category.id}: ${topic}`).toBe(true);
    }
    // No kart não há boxes: nada de janela de parada nem de rival parando.
    expect(topics(kart).has('pitWindow')).toBe(false);
    expect(topics(kart).has('rivalPitted')).toBe(false);
    expect(topics(kart).has('rain')).toBe(false);
    // A janela anunciada é de voltas que ainda vêm.
    for (const { races } of corpus()) {
      for (const { final } of races) {
        for (const message of final.radio) {
          if (message.topic !== 'pitWindow') continue;
          const laps = [...message.message.matchAll(/\d+/g)].map((m) => Number(m[0]));
          expect(laps.length).toBeGreaterThan(0);
          for (const lap of laps) expect(lap).toBeGreaterThan(message.lap);
        }
      }
    }
  });

  it('o rádio só cresce durante a corrida e avisa do pneu na ordem: no limite, depois acabado', () => {
    // Kart em pista de desgaste alto, piloto de gestão mediana, ritmo agressivo desde a largada.
    const setup = raceSetup('kart-regional', 'cerrado-paulista');
    const ctx = withAttributes(setup.ctx, setup.playerId, { tyreManagement: 55 });
    let state = opening(setup, ctx, 2);
    while (!isRaceFinished(state)) {
      const next = stepRaceLap(state, ctx, { mode: 'aggressive', moment: state.pendingMoment ? safe(state.pendingMoment, state) : null });
      // As mensagens antigas ficam; a volta acrescenta uma, no máximo, e é a da volta que acabou.
      expect(next.radio.slice(0, state.radio.length)).toEqual(state.radio);
      expect(next.radio.length - state.radio.length).toBeLessThanOrEqual(1);
      if (next.radio.length > state.radio.length) expect(next.radio.at(-1)!.lap).toBe(next.currentLap);
      state = next;
    }
    const limit = state.radio.find((m) => m.topic === 'tyresLimit');
    const gone = state.radio.find((m) => m.topic === 'tyresGone');
    if (!limit || !gone) throw new Error('Faltou aviso de pneu.');
    expect(limit.lap).toBeLessThan(gone.lap);
    expect(state.radio.filter((m) => m.topic === 'tyresLimit')).toHaveLength(1);
    expect(state.radio.filter((m) => m.topic === 'tyresGone')).toHaveLength(1);
    // O aviso de limite cita o pneu mais exigido da pista; o de pneu acabado diz quanto se perde por volta.
    expect(limit.message.startsWith(stressedCorner(setup.ctx.track.id))).toBe(true);
    expect(gone.message).toMatch(/\d,\d s por volta/);
    // Os avisos batem com o estado do pneu naquela volta.
    expect(tyreState('kart', carOf(state, setup.playerId).tyre.wear)).toBe('gone');
  });

  it('o pneu mais exigido é sempre o mesmo para a mesma pista', () => {
    const corners = new Set<string>();
    for (const track of TRACKS) {
      const corner = stressedCorner(track.id);
      expect(stressedCorner(track.id), track.id).toBe(corner);
      expect(RADIO_TEXTS.corners, track.id).toContain(corner);
      corners.add(corner);
    }
    // Pistas diferentes pedem pneus diferentes.
    expect(corners.size).toBeGreaterThan(1);
  });
});
