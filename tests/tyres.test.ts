/**
 * Pneus da Fase 4: a curva de desgaste (perde pouco, estabiliza, cai do penhasco), os estados
 * mostrados na tela, a janela de parada e o que isso faz numa corrida de verdade.
 *
 * Tudo aqui é determinístico: as contas são funções puras e as corridas usam sementes fixas.
 */
import { describe, expect, it } from 'vitest';
import { TRAIT_EFFECTS, TYRE_CURVE } from '@/config/balance';
import { TYRE_STATE_LABELS } from '@/domain/labels';
import { TYRE_COMPOUNDS, type DriverAttributes, type Track, type TyreCompound } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { getTrack, referenceLapTime } from '@/data/tracks';
import {
  RACE,
  TYRES,
  baseWearPerLap,
  cleanAirLapTime,
  compoundLifeLaps,
  conditionFor,
  finalizeRace,
  isRaceFinished,
  lapsToCliff,
  neutralRaceProfile,
  pitWindow,
  stepRaceLap,
  tyreCliff,
  tyrePaceLoss,
  tyreState,
  type MomentChoice,
  type RaceContext,
  type RaceMoment,
  type RaceSimState,
  type TyreState,
} from '@/engine';
import { tyreManagementFactor } from '@/engine/simulation/performance';
import { DRY, WET, raceSetup } from './raceSetup';

const CURVE = TYRE_CURVE.COMPOUNDS;
const DRY_COMPOUNDS = ['soft', 'medium', 'hard'] as const;
const STATES: readonly TyreState[] = ['new', 'good', 'worn', 'limit', 'gone'];

const f1 = raceSetup('f1', 'abu-dhabi');
/** Piloto médio em gestão de pneus (50 = desgaste de tabela) numa pista de desgaste médio (1). */
const AVERAGE: DriverAttributes = { ...f1.drivers[0]!.attributes, tyreManagement: 50 };
const NEUTRAL_TRACK: Track = { ...getTrack('abu-dhabi'), tyreWear: 1 };
/** A volta de referência dos comentários de `TYRE_CURVE`: 90 segundos. */
const LAP = 90;

/** Desgaste de 0 a 1 em passos de 0,5%. */
const WEARS = Array.from({ length: 201 }, (_, i) => i / 200);

/** A opção menos arriscada de um lance (na dúvida, a de maior chance): isola o efeito dos pneus. */
function safest(moment: RaceMoment | null): MomentChoice | null {
  if (!moment) return null;
  const pick = [...moment.options].sort((a, b) => a.risk - b.risk || b.chance - a.chance)[0]!;
  return { option: pick.id };
}

/** O mesmo contexto, com alguns atributos de um piloto trocados. */
function withAttributes(ctx: RaceContext, driverId: string, patch: Partial<DriverAttributes>): RaceContext {
  const driver = ctx.drivers[driverId]!;
  return { ...ctx, drivers: { ...ctx.drivers, [driverId]: { ...driver, attributes: { ...driver.attributes, ...patch } } } };
}

const carOf = (state: RaceSimState, driverId: string) => state.cars.find((c) => c.driverId === driverId)!;
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

describe('curva de desgaste: perde pouco, estabiliza, cai do penhasco', () => {
  it('pneu novo não perde nada, e o que se perde no começo é pouco', () => {
    for (const compound of TYRE_COMPOUNDS) {
      const { fade } = CURVE[compound];
      expect(tyrePaceLoss(compound, 0), compound).toBe(0);
      // Até FADE_BY vale o "fade" do composto, subindo em linha reta.
      expect(tyrePaceLoss(compound, TYRE_CURVE.FADE_BY / 2), compound).toBeCloseTo(fade / 2, 12);
      expect(tyrePaceLoss(compound, TYRE_CURVE.FADE_BY), compound).toBeCloseTo(fade, 12);
      // "Pouco": menos de três décimos numa volta de 90 s.
      expect(fade, compound).toBeGreaterThan(0);
      expect(fade * LAP, compound).toBeLessThan(0.3);
    }
  });

  it('no platô o pneu fica quase estável: do fim do começo ao penhasco sobe menos que o "plateau"', () => {
    for (const compound of TYRE_COMPOUNDS) {
      const { fade, plateau, cliff } = CURVE[compound];
      const atCliff = tyrePaceLoss(compound, cliff);
      expect(atCliff - tyrePaceLoss(compound, TYRE_CURVE.FADE_BY), compound).toBeLessThanOrEqual(plateau + 1e-12);
      expect(atCliff, compound).toBeCloseTo(fade + plateau, 12);
      // No meio do platô, metade dele.
      const middle = (TYRE_CURVE.FADE_BY + cliff) / 2;
      expect(tyrePaceLoss(compound, middle) - fade, compound).toBeCloseTo(plateau / 2, 12);
      // Até o penhasco a perda toda não passa de 1% da volta (nem de 0,7 s em 90 s).
      expect(atCliff, compound).toBeLessThan(0.01);
      expect(atCliff * LAP, compound).toBeLessThan(0.7);
    }
  });

  it('depois do penhasco o pneu cai: a inclinação é pelo menos 10 vezes a do platô', () => {
    for (const compound of TYRE_COMPOUNDS) {
      const cliff = tyreCliff(compound);
      const plateauSlope = (tyrePaceLoss(compound, cliff) - tyrePaceLoss(compound, TYRE_CURVE.FADE_BY)) / (cliff - TYRE_CURVE.FADE_BY);
      const step = (1 - cliff) / 4;
      const dropSlope = (tyrePaceLoss(compound, cliff + step) - tyrePaceLoss(compound, cliff)) / step;
      expect(plateauSlope, compound).toBeGreaterThan(0);
      expect(dropSlope, compound).toBeGreaterThanOrEqual(10 * plateauSlope);
      // Na lona (desgaste 1) a perda é a do penhasco mais o "drop" inteiro.
      expect(tyrePaceLoss(compound, 1), compound).toBeCloseTo(tyrePaceLoss(compound, cliff) + CURVE[compound].drop, 12);
    }
  });

  it('três voltas além do penhasco custam mais de 2 s por volta numa volta de 90 s', () => {
    for (const compound of TYRE_COMPOUNDS) {
      const cliff = tyreCliff(compound);
      const rate = baseWearPerLap(AVERAGE, NEUTRAL_TRACK, compound);
      const atCliff = tyrePaceLoss(compound, cliff);
      const threeLapsLater = tyrePaceLoss(compound, cliff + 3 * rate);
      expect((threeLapsLater - atCliff) * LAP, compound).toBeGreaterThan(2);
      // Cada volta além do penhasco custa segundos, não décimos: perto de 1 s a mais que a anterior.
      const perLap = (tyrePaceLoss(compound, cliff + rate) - atCliff) * LAP;
      expect(perLap, compound).toBeGreaterThan(0.8);
      expect(perLap, compound).toBeLessThan(2);
      // Antes dele, uma volta a mais quase não muda nada: menos de 5 centésimos, 20 vezes menos que depois.
      const before = (tyrePaceLoss(compound, cliff - rate) - tyrePaceLoss(compound, cliff - 2 * rate)) * LAP;
      expect(before, compound).toBeLessThan(0.05);
      expect(perLap, compound).toBeGreaterThan(20 * before);
    }
  });

  it('a perda nunca diminui com o desgaste, para todos os compostos, e fica presa entre 0 e 1 de desgaste', () => {
    for (const compound of TYRE_COMPOUNDS) {
      let previous = -1;
      for (const wear of WEARS) {
        const loss = tyrePaceLoss(compound, wear);
        expect(loss, `${compound} com ${wear}`).toBeGreaterThanOrEqual(previous);
        previous = loss;
      }
      expect(tyrePaceLoss(compound, -0.3)).toBe(0);
      expect(tyrePaceLoss(compound, 1.4)).toBe(tyrePaceLoss(compound, 1));
    }
  });

  it('macio antes do médio, médio antes do duro: no penhasco, no ritmo e nas voltas que dura', () => {
    expect(tyreCliff('soft')).toBeLessThan(tyreCliff('medium'));
    expect(tyreCliff('medium')).toBeLessThan(tyreCliff('hard'));
    // O macio é o mais rápido e o duro, o mais lento.
    expect(TYRES.soft.pace).toBeLessThan(TYRES.medium.pace);
    expect(TYRES.medium.pace).toBeLessThan(TYRES.hard.pace);
    // O macio dura menos voltas e o duro é o que mais dura, para qualquer piloto e pista.
    for (const attributes of [AVERAGE, f1.drivers[0]!.attributes, { ...AVERAGE, tyreManagement: 20 }]) {
      for (const track of [NEUTRAL_TRACK, getTrack('monaco'), getTrack('silverstone')]) {
        const life = (compound: TyreCompound) => compoundLifeLaps(attributes, track, compound);
        expect(life('soft')).toBeLessThan(life('medium'));
        expect(life('medium')).toBeLessThan(life('hard'));
      }
    }
    // Referência de `TYRE_CURVE` (piloto médio, pista média): macio perto de 13 voltas, médio de 25, duro de 40.
    const life = (compound: TyreCompound) => compoundLifeLaps(AVERAGE, NEUTRAL_TRACK, compound);
    expect(life('soft')).toBeGreaterThan(10);
    expect(life('soft')).toBeLessThan(16);
    expect(life('medium')).toBeGreaterThan(21);
    expect(life('medium')).toBeLessThan(29);
    expect(life('hard')).toBeGreaterThan(35);
    expect(life('hard')).toBeLessThan(46);
    // O penhasco do macio também é o mais brusco: cada volta além dele custa mais que no duro.
    const perLap = (compound: TyreCompound) =>
      tyrePaceLoss(compound, tyreCliff(compound) + baseWearPerLap(AVERAGE, NEUTRAL_TRACK, compound)) - tyrePaceLoss(compound, tyreCliff(compound));
    expect(perLap('soft')).toBeGreaterThan(perLap('medium'));
    expect(perLap('medium')).toBeGreaterThan(perLap('hard'));
  });

  it('num stint, o macio começa mais rápido que o médio e fica mais lento depois que cai do penhasco', () => {
    const lapLoss = (compound: TyreCompound, lap: number) =>
      TYRES[compound].pace + tyrePaceLoss(compound, Math.min(1, lap * baseWearPerLap(AVERAGE, NEUTRAL_TRACK, compound)));
    const softLife = Math.ceil(compoundLifeLaps(AVERAGE, NEUTRAL_TRACK, 'soft'));
    for (let lap = 1; lap < softLife; lap++) expect(lapLoss('soft', lap), `volta ${lap}`).toBeLessThan(lapLoss('medium', lap));
    for (const lap of [softLife + 2, softLife + 4]) {
      expect(lapLoss('soft', lap), `volta ${lap}`).toBeGreaterThan(lapLoss('medium', lap));
      expect(lapLoss('soft', lap), `volta ${lap}`).toBeGreaterThan(lapLoss('hard', lap));
    }
  });

  it('intermediário e chuva têm curva própria, e o kart tem penhasco', () => {
    for (const compound of ['intermediate', 'wet', 'kart'] as const) {
      const curve = CURVE[compound];
      expect(curve.cliff, compound).toBeGreaterThan(TYRE_CURVE.FADE_BY + TYRE_CURVE.LIMIT_MARGIN);
      expect(curve.cliff, compound).toBeLessThan(1);
      expect(curve.drop, compound).toBeGreaterThan(10 * (curve.fade + curve.plateau));
      expect(tyreCliff(compound), compound).toBe(curve.cliff);
      // Passado o penhasco, perde mais de 1% da volta bem antes de chegar à lona.
      expect(tyrePaceLoss(compound, 0.95) - tyrePaceLoss(compound, curve.cliff), compound).toBeGreaterThan(0.01);
    }
    // Curvas próprias: nenhuma das duas de chuva é a cópia de um composto de pista seca.
    for (const rain of ['intermediate', 'wet'] as const) {
      for (const dry of DRY_COMPOUNDS) expect(CURVE[rain], `${rain} e ${dry}`).not.toEqual(CURVE[dry]);
      expect(TYRES[rain].rain).toBe(true);
    }
    expect(CURVE.intermediate).not.toEqual(CURVE.wet);
    expect(tyreCliff('intermediate')).not.toBe(tyreCliff('wet'));
    // Sem composto informado, o tempo de volta usa a curva do médio; toda a tabela tem os seis compostos.
    expect(Object.keys(CURVE).sort()).toEqual([...TYRE_COMPOUNDS].sort());
  });
});

describe('estado do pneu', () => {
  it('os cinco estados aparecem nas faixas certas, para cada composto', () => {
    const tiny = 1e-6;
    for (const compound of TYRE_COMPOUNDS) {
      const cliff = tyreCliff(compound);
      const good = cliff * TYRE_CURVE.GOOD_UNTIL;
      const limit = cliff - TYRE_CURVE.LIMIT_MARGIN;
      const state = (wear: number) => tyreState(compound, wear);
      // Novo: enquanto dura o pico de aderência.
      expect(state(0), compound).toBe('new');
      expect(state(TYRE_CURVE.FADE_BY - tiny), compound).toBe('new');
      // Bom: do fim do pico até GOOD_UNTIL do caminho até o penhasco.
      expect(state(TYRE_CURVE.FADE_BY), compound).toBe('good');
      expect(state(good - tiny), compound).toBe('good');
      // Gasto: daí até a margem do limite.
      expect(state(good + tiny), compound).toBe('worn');
      expect(state(limit - tiny), compound).toBe('worn');
      // No limite: os últimos LIMIT_MARGIN antes do penhasco.
      expect(state(limit + tiny), compound).toBe('limit');
      expect(state(cliff - tiny), compound).toBe('limit');
      // Acabado: do penhasco em diante.
      expect(state(cliff), compound).toBe('gone');
      expect(state(1), compound).toBe('gone');
    }
  });

  it('o estado só piora com o desgaste e passa pelos cinco, na ordem', () => {
    for (const compound of TYRE_COMPOUNDS) {
      const seen: TyreState[] = [];
      for (const wear of WEARS) {
        const state = tyreState(compound, wear);
        if (seen.at(-1) !== state) seen.push(state);
      }
      expect(seen, compound).toEqual(STATES);
    }
  });

  it('"acabado" é exatamente o trecho da curva em que o pneu perde segundos', () => {
    for (const compound of TYRE_COMPOUNDS) {
      for (const wear of WEARS) {
        const past = tyrePaceLoss(compound, wear) > tyrePaceLoss(compound, tyreCliff(compound)) + 1e-12;
        if (past) expect(tyreState(compound, wear), `${compound} com ${wear}`).toBe('gone');
        else if (wear < tyreCliff(compound)) expect(tyreState(compound, wear), `${compound} com ${wear}`).not.toBe('gone');
      }
    }
  });

  it('todo estado tem rótulo em português, e os rótulos são diferentes entre si', () => {
    expect(Object.keys(TYRE_STATE_LABELS).sort()).toEqual([...STATES].sort());
    for (const state of STATES) expect(TYRE_STATE_LABELS[state].trim().length, state).toBeGreaterThan(2);
    expect(new Set(STATES.map((s) => TYRE_STATE_LABELS[s])).size).toBe(STATES.length);
    expect(TYRE_STATE_LABELS.limit).toBe('No limite');
    expect(TYRE_STATE_LABELS.gone).toBe('Acabado');
  });
});

describe('vida do pneu e janela de parada', () => {
  const rules = getCategory('f1').race;
  const kartRules = getCategory('kart-regional').race;
  const track = getTrack('abu-dhabi');
  const attributes = f1.drivers[0]!.attributes;
  const tyre = (compound: TyreCompound, wear = 0, age = 0) => ({ tyre: { compound, wear, age } });
  const RACE_LAPS = 70;

  it('lapsToCliff conta as voltas inteiras até o penhasco e zera depois dele', () => {
    for (const compound of DRY_COMPOUNDS) {
      const life = compoundLifeLaps(attributes, track, compound);
      const fresh = lapsToCliff(tyre(compound).tyre, attributes, track);
      expect(Number.isInteger(fresh), compound).toBe(true);
      expect(fresh, compound).toBe(Math.floor(life));
      // Com metade da vida gasta, sobra perto de metade das voltas.
      const half = lapsToCliff(tyre(compound, tyreCliff(compound) / 2).tyre, attributes, track);
      expect(half, compound).toBeLessThan(fresh);
      expect(Math.abs(half - life / 2), compound).toBeLessThanOrEqual(1);
      expect(lapsToCliff(tyre(compound, tyreCliff(compound)).tyre, attributes, track), compound).toBe(0);
      expect(lapsToCliff(tyre(compound, 1).tyre, attributes, track), compound).toBe(0);
    }
    // Serve também ao kart, que não para: diz em que volta o pneu acaba.
    expect(lapsToCliff(tyre('kart').tyre, AVERAGE, NEUTRAL_TRACK)).toBe(Math.floor(tyreCliff('kart') / baseWearPerLap(AVERAGE, NEUTRAL_TRACK, 'kart')));
  });

  it('a janela abre nas últimas PIT_WINDOW_LAPS voltas antes do penhasco e não muda de lugar ao longo do stint', () => {
    for (const compound of DRY_COMPOUNDS) {
      const rate = baseWearPerLap(attributes, track, compound);
      const life = compoundLifeLaps(attributes, track, compound);
      const ends: number[] = [];
      let openedAt: number | null = null;
      for (let lap = 0; lap * rate < tyreCliff(compound); lap++) {
        const car = tyre(compound, lap * rate, lap);
        const window = pitWindow(car, attributes, track, rules, lap, RACE_LAPS);
        if (!window) throw new Error(`Sem janela: ${compound}, volta ${lap}`);
        expect(window.lapsLeft, `${compound}, volta ${lap}`).toBe(lapsToCliff(car.tyre, attributes, track));
        // A janela nunca está no passado, e termina na última volta antes do penhasco.
        expect(window.from, `${compound}, volta ${lap}`).toBeGreaterThan(lap);
        expect(window.to, `${compound}, volta ${lap}`).toBeGreaterThanOrEqual(window.from);
        if (window.lapsLeft >= 1) expect(window.to, `${compound}, volta ${lap}`).toBe(lap + window.lapsLeft);
        // Tem PIT_WINDOW_LAPS voltas enquanto couberem; depois, as que restam.
        expect(window.to - window.from + 1, `${compound}, volta ${lap}`).toBe(Math.max(1, Math.min(TYRE_CURVE.PIT_WINDOW_LAPS, window.lapsLeft)));
        // "Aberta" = a próxima volta já está dentro dela.
        const open = lap + 1 >= window.from;
        expect(open, `${compound}, volta ${lap}`).toBe(window.lapsLeft <= TYRE_CURVE.PIT_WINDOW_LAPS);
        if (open && openedAt === null) openedAt = lap;
        if (window.lapsLeft >= 1) ends.push(window.to);
      }
      // O fim da janela é sempre a mesma volta (a conta arredonda para baixo: no máximo uma de diferença).
      expect(Math.max(...ends) - Math.min(...ends), compound).toBeLessThanOrEqual(1);
      const end = Math.max(...ends);
      expect(Math.abs(end - life), compound).toBeLessThanOrEqual(1);
      // Abre PIT_WINDOW_LAPS voltas antes do fim, e não antes.
      expect(openedAt, compound).not.toBeNull();
      expect(Math.abs(end - (openedAt ?? 0) - TYRE_CURVE.PIT_WINDOW_LAPS), compound).toBeLessThanOrEqual(1);
      // Parando até o fim da janela, o pneu não chega a acabar; duas voltas depois, acabou.
      expect(tyreState(compound, (end - 1) * rate), compound).not.toBe('gone');
      expect(tyreState(compound, (end + 2) * rate), compound).toBe('gone');
    }
  });

  it('não há janela quando o pneu chega ao fim da corrida, nem no kart; pneu acabado pede parada já', () => {
    // Duro novo numa corrida de 20 voltas: chega com folga.
    expect(compoundLifeLaps(attributes, track, 'hard')).toBeGreaterThan(20);
    expect(pitWindow(tyre('hard'), attributes, track, rules, 0, 20)).toBeNull();
    // O mesmo pneu numa corrida de 70 voltas precisa de parada.
    expect(pitWindow(tyre('hard'), attributes, track, rules, 0, RACE_LAPS)).not.toBeNull();
    // Faltando poucas voltas, mesmo um pneu gasto chega: não é preciso parar por desgaste.
    const worn = tyre('medium', tyreCliff('medium') - 3.5 * baseWearPerLap(attributes, track, 'medium'), 20);
    expect(pitWindow(worn, attributes, track, rules, RACE_LAPS - 2, RACE_LAPS)).toBeNull();
    expect(pitWindow(worn, attributes, track, rules, RACE_LAPS - 10, RACE_LAPS)).toEqual({ from: RACE_LAPS - 9, to: RACE_LAPS - 7, lapsLeft: 3 });
    // Kart: sem boxes, sem janela, com o pneu no estado que for.
    for (const wear of [0, 0.5, 0.79, 0.95]) expect(pitWindow(tyre('kart', wear), AVERAGE, NEUTRAL_TRACK, kartRules, 5, 22)).toBeNull();
    // Passou do penhasco com corrida pela frente: a janela é a próxima volta.
    expect(pitWindow(tyre('soft', 0.9, 15), attributes, track, rules, 15, RACE_LAPS)).toEqual({ from: 16, to: 16, lapsLeft: 0 });
  });

  it('o poupador alonga a vida do pneu e o gastador encurta', () => {
    const saver = TRAIT_EFFECTS.tyreSaver.tyreWear;
    const eater = TRAIT_EFFECTS.tyreEater.tyreWear;
    expect(saver).toBeLessThan(1);
    expect(eater).toBeGreaterThan(1);
    for (const compound of DRY_COMPOUNDS) {
      const life = (factor?: number) => compoundLifeLaps(attributes, track, compound, factor);
      expect(life(saver), compound).toBeCloseTo(life() / saver, 9);
      expect(life(eater), compound).toBeCloseTo(life() / eater, 9);
      expect(life(saver), compound).toBeGreaterThan(life());
      expect(life(eater), compound).toBeLessThan(life());
      expect(baseWearPerLap(attributes, track, compound, saver), compound).toBeLessThan(baseWearPerLap(attributes, track, compound));
      const laps = (factor?: number) => lapsToCliff(tyre(compound).tyre, attributes, track, factor);
      expect(laps(saver), compound).toBeGreaterThan(laps(eater));
      // A janela de parada anda junto: mais tarde para o poupador, mais cedo para o gastador.
      const to = (factor?: number) => pitWindow(tyre(compound), attributes, track, rules, 0, 200, factor)!.to;
      expect(to(saver), compound).toBeGreaterThanOrEqual(to());
      expect(to(eater), compound).toBeLessThanOrEqual(to());
      expect(to(saver), compound).toBeGreaterThan(to(eater));
    }
  });

  it('gestão de pneus alta alonga a vida: de 30% a mais de desgaste (0) a 30% a menos (100)', () => {
    const withManagement = (tyreManagement: number): DriverAttributes => ({ ...attributes, tyreManagement });
    expect(tyreManagementFactor(withManagement(50))).toBeCloseTo(1, 12);
    expect(tyreManagementFactor(withManagement(0))).toBeCloseTo(TYRE_CURVE.MANAGEMENT_WORST, 12);
    expect(tyreManagementFactor(withManagement(100))).toBeCloseTo(TYRE_CURVE.MANAGEMENT_WORST - TYRE_CURVE.MANAGEMENT_RANGE, 12);
    for (const compound of [...DRY_COMPOUNDS, 'kart'] as const) {
      let previous = 0;
      for (const level of [0, 25, 50, 75, 100]) {
        const life = compoundLifeLaps(withManagement(level), track, compound);
        expect(life, `${compound} com gestão ${level}`).toBeGreaterThan(previous);
        previous = life;
      }
      expect(lapsToCliff(tyre(compound).tyre, withManagement(90), track)).toBeGreaterThan(lapsToCliff(tyre(compound).tyre, withManagement(30), track));
    }
    // A pista também conta: onde o asfalto gasta mais, o pneu dura menos.
    const rough: Track = { ...track, tyreWear: 1.3 };
    const smooth: Track = { ...track, tyreWear: 0.85 };
    expect(compoundLifeLaps(attributes, rough, 'medium')).toBeLessThan(compoundLifeLaps(attributes, smooth, 'medium'));
  });
});

describe('ritmo na corrida: andar agressivo no começo cobra no fim', () => {
  // Pista de desgaste alto (1,2), 21 voltas, sem boxes. O piloto do teste tem gestão de pneus mediana
  // (55): o do grid de apoio (76) é dos que mais poupam e só chegaria ao penhasco na bandeirada.
  const kart = raceSetup('kart-regional', 'cerrado-paulista');
  const ctx = withAttributes(kart.ctx, kart.playerId, { tyreManagement: 55 });
  const reference = referenceLapTime(ctx.track, ctx.category);
  const plateauSeconds = CURVE.kart.plateau * reference;
  const SEEDS = [1, 2, 3, 4, 5, 6];
  const MODES = ['conservative', 'balanced', 'aggressive'] as const;

  interface KartRun {
    final: RaceSimState;
    /** Tempo de cada volta do jogador (índice 0 = volta 1). */
    laps: number[];
    /** Desgaste ao fim de cada volta. */
    wear: number[];
    /** Tempo em pista livre antes de cada volta: sem ruído, sem tráfego e sem contar dano no kart. */
    clean: number[];
  }

  function run(seed: number, mode: (typeof MODES)[number], context: RaceContext = ctx): KartRun {
    let state = kart.start(seed);
    const laps: number[] = [];
    const wear: number[] = [];
    const clean: number[] = [];
    while (!isRaceFinished(state)) {
      clean.push(cleanAirLapTime({ ...carOf(state, kart.playerId), damage: 0 }, context, 0, state.totalLaps, state.weather.trackTemp, mode));
      // Lances sempre com a opção segura: o que muda entre as corridas é só o ritmo.
      state = stepRaceLap(state, context, { mode, moment: safest(state.pendingMoment) });
      const me = carOf(state, kart.playerId);
      laps.push(me.lastLap ?? Number.NaN);
      wear.push(me.tyre.wear);
    }
    return { final: state, laps, wear, clean };
  }

  const runs = new Map<string, KartRun>();
  const cached = (seed: number, mode: (typeof MODES)[number]) => {
    const key = `${seed}:${mode}`;
    let hit = runs.get(key);
    if (!hit) {
      hit = run(seed, mode);
      runs.set(key, hit);
    }
    return hit;
  };
  /** Quanto as duas últimas voltas ficam mais lentas que o meio da corrida (mediana das voltas 8 a 12). */
  const fade = (r: KartRun) => mean(r.laps.slice(-2)) - median(r.laps.slice(7, 12));

  it('o cenário é o do critério: kart, pista de desgaste alto, pneu único e sem parada', () => {
    expect(ctx.track.tyreWear).toBeGreaterThanOrEqual(1.2);
    expect(ctx.category.race.pitStops).toBe(false);
    const state = kart.start(1);
    expect(state.cars.every((c) => c.tyre.compound === 'kart' && c.plan.length === 0)).toBe(true);
    expect(plateauSeconds).toBeGreaterThan(0.1);
    expect(plateauSeconds).toBeLessThan(0.4);
  });

  it('quanto mais forte o ritmo, mais desgaste na bandeirada', () => {
    for (const seed of SEEDS) {
      const [calm, even, hard] = MODES.map((mode) => cached(seed, mode));
      for (const r of [calm!, even!, hard!]) {
        expect(carOf(r.final, kart.playerId).status, `semente ${seed}`).toBe('running');
        expect(r.laps).toHaveLength(r.final.totalLaps);
        // O desgaste só sobe, volta a volta.
        for (let i = 1; i < r.wear.length; i++) expect(r.wear[i]!).toBeGreaterThan(r.wear[i - 1]!);
      }
      const end = (r: KartRun) => r.wear.at(-1)!;
      expect(end(hard!), `semente ${seed}`).toBeGreaterThan(end(even!) + 0.1);
      expect(end(even!), `semente ${seed}`).toBeGreaterThan(end(calm!) + 0.1);
    }
  });

  it('o agressivo desde a largada passa do penhasco antes do fim; o equilibrado e o conservador, não', () => {
    const cliff = tyreCliff('kart');
    for (const seed of SEEDS) {
      const hard = cached(seed, 'aggressive');
      const goneAt = hard.wear.findIndex((w) => w >= cliff) + 1;
      expect(goneAt, `semente ${seed}`).toBeGreaterThan(hard.final.totalLaps / 2);
      // Pelo menos duas voltas inteiras com o pneu acabado.
      expect(goneAt, `semente ${seed}`).toBeLessThanOrEqual(hard.final.totalLaps - 2);
      expect(tyreState('kart', hard.wear.at(-1)!), `semente ${seed}`).toBe('gone');
      for (const mode of ['balanced', 'conservative'] as const) {
        const r = cached(seed, mode);
        expect(
          r.wear.every((w) => w < cliff),
          `semente ${seed}, ${mode}`,
        ).toBe(true);
      }
      expect(tyreState('kart', cached(seed, 'conservative').wear.at(-1)!), `semente ${seed}`).toBe('worn');
    }
  });

  it('as últimas voltas do agressivo ficam mais lentas que as do meio da corrida por mais que a perda do platô', () => {
    for (const seed of SEEDS) {
      const hard = cached(seed, 'aggressive');
      const lost = fade(hard);
      expect(lost, `semente ${seed}`).toBeGreaterThan(plateauSeconds);
      // São segundos, não décimos: mais de 1 s por volta nas duas últimas.
      expect(lost, `semente ${seed}`).toBeGreaterThan(1);
      // Quem não passou do penhasco termina no ritmo do meio da corrida (bem menos de um terço disso).
      for (const mode of ['balanced', 'conservative'] as const) expect(fade(cached(seed, mode)), `semente ${seed}, ${mode}`).toBeLessThan(lost / 3);
      // Sem ruído e sem tráfego (pista livre): a queda do agressivo passa de 1,5 s; a do equilibrado cabe no platô.
      const cleanDrop = (r: KartRun) => r.clean.at(-1)! - r.clean[10]!;
      expect(cleanDrop(hard), `semente ${seed}`).toBeGreaterThan(1.5);
      expect(cleanDrop(cached(seed, 'balanced')), `semente ${seed}`).toBeLessThan(plateauSeconds);
      expect(cleanDrop(cached(seed, 'conservative')), `semente ${seed}`).toBeLessThan(plateauSeconds);
    }
  });

  it('o ritmo forte rende no começo e custa no fim, na mesma corrida', () => {
    let earlyGain = 0;
    let lateLoss = 0;
    for (const seed of SEEDS) {
      const hard = cached(seed, 'aggressive');
      const even = cached(seed, 'balanced');
      // Em pista livre, o agressivo é mais rápido enquanto o pneu aguenta...
      for (let lap = 1; lap <= 12; lap++) expect(hard.clean[lap]!, `semente ${seed}, volta ${lap + 1}`).toBeLessThan(even.clean[lap]!);
      // ...e mais lento que o equilibrado nas duas últimas voltas.
      for (const lap of [-2, -1]) expect(hard.clean.at(lap)!, `semente ${seed}`).toBeGreaterThan(even.clean.at(lap)! + 0.5);
      earlyGain += mean(even.clean.slice(1, 13)) - mean(hard.clean.slice(1, 13));
      lateLoss += mean(hard.laps.slice(-3)) - mean(even.laps.slice(-3));
    }
    expect(earlyGain / SEEDS.length).toBeGreaterThan(0);
    // Nas três últimas voltas, o agressivo perde em média mais de 1 s por volta para o equilibrado.
    expect(lateLoss / SEEDS.length).toBeGreaterThan(1);
  });

  it('o poupador de pneus chega com menos desgaste que o gastador, com o mesmo ritmo', () => {
    const profiled = (tyreWear: number): RaceContext => ({ ...ctx, profiles: { [kart.playerId]: { ...neutralRaceProfile(), tyreWear } } });
    const saver = run(3, 'aggressive', profiled(TRAIT_EFFECTS.tyreSaver.tyreWear));
    const eater = run(3, 'aggressive', profiled(TRAIT_EFFECTS.tyreEater.tyreWear));
    const plain = cached(3, 'aggressive');
    const end = (r: KartRun) => r.wear.at(-1)!;
    expect(end(saver)).toBeLessThan(end(plain));
    expect(end(plain)).toBeLessThan(end(eater));
    // O gastador passa do penhasco mais cedo que o poupador.
    const goneAt = (r: KartRun) => r.wear.findIndex((w) => w >= tyreCliff('kart')) + 1;
    expect(goneAt(eater)).toBeGreaterThan(0);
    expect(goneAt(eater)).toBeLessThan(goneAt(saver) === 0 ? Number.POSITIVE_INFINITY : goneAt(saver));
  });

  it('mesma semente e mesmas escolhas dão a mesma corrida', () => {
    expect(run(2, 'aggressive')).toEqual(cached(2, 'aggressive'));
  });
});

describe('regra dos dois compostos e a IA nos boxes', () => {
  const AUTO = { mode: 'balanced', auto: true } as const;

  interface Watched {
    final: RaceSimState;
    /** Por carro: voltas terminadas com o pneu além do penhasco e a maior sequência delas. */
    gone: Map<string, { laps: number; run: number }>;
  }

  /** Corre a corrida inteira com o engenheiro automático, anotando quem anda com pneu acabado. */
  function watch(setup: ReturnType<typeof raceSetup>, seed: number, weather = DRY): Watched {
    let state = setup.start(seed, weather);
    const gone = new Map<string, { laps: number; run: number }>();
    const streak = new Map<string, number>();
    while (!isRaceFinished(state)) {
      state = stepRaceLap(state, setup.ctx, AUTO);
      for (const car of state.cars) {
        if (car.status !== 'running') continue;
        const past = tyreState(car.tyre.compound, car.tyre.wear) === 'gone';
        const now = past ? (streak.get(car.driverId) ?? 0) + 1 : 0;
        streak.set(car.driverId, now);
        const entry = gone.get(car.driverId) ?? { laps: 0, run: 0 };
        gone.set(car.driverId, { laps: entry.laps + (past ? 1 : 0), run: Math.max(entry.run, now) });
      }
    }
    return { final: state, gone };
  }

  const isDry = (state: RaceSimState) => state.wetnessByLap.slice(1, state.currentLap + 1).every((w) => conditionFor(w) === 'dry');

  it('nas categorias com a regra, a IA usa dois compostos em corrida seca e ninguém é punido', () => {
    for (const id of ['f2', 'f1'] as const) {
      const setup = raceSetup(id);
      expect(setup.ctx.category.race.mandatoryTwoCompounds, id).toBe(true);
      let checked = 0;
      for (const seed of [1, 2]) {
        const { final } = watch(setup, seed);
        if (!isDry(final)) continue;
        const result = finalizeRace(final, setup.ctx.category);
        for (const car of final.cars) {
          if (car.status !== 'running') continue;
          const dryUsed = new Set(car.compoundsUsed.filter((c) => !TYRES[c].rain));
          expect(dryUsed.size, `${id}, semente ${seed}, ${car.driverId}`).toBeGreaterThanOrEqual(2);
          expect(car.pitStops, `${id}, semente ${seed}, ${car.driverId}`).toBeGreaterThanOrEqual(1);
          // Sem os 30 s da regra: a punição do resultado é só a que o carro já trazia.
          expect(result.entries.find((e) => e.driverId === car.driverId)!.penaltySeconds).toBe(car.penaltySeconds);
          checked++;
        }
      }
      expect(checked, id).toBeGreaterThan(10);
    }
  });

  it('quem não cumpre em corrida seca leva a punição da regra no resultado', () => {
    const setup = raceSetup('f2');
    // O jogador larga de duro, sem parada marcada, e recusa todas as paradas.
    let state = setup.start(4, DRY, { startCompound: 'hard', stops: [] });
    while (!isRaceFinished(state)) {
      const moment = state.pendingMoment;
      const answer = moment?.kind === 'pit' ? { option: 'overcut' } : moment?.kind === 'rain' ? { option: 'stay' } : safest(moment);
      state = stepRaceLap(state, setup.ctx, { mode: 'conservative', skipPlannedStop: true, moment: answer });
    }
    expect(isDry(state)).toBe(true);
    expect(state.redFlags).toBe(0);
    const me = carOf(state, setup.playerId);
    expect(me.status).toBe('running');
    expect(me.pitStops).toBe(0);
    expect(me.compoundsUsed).toEqual(['hard']);

    const result = finalizeRace(state, setup.ctx.category);
    const entry = result.entries.find((e) => e.driverId === setup.playerId)!;
    expect(RACE.COMPOUND_RULE_PENALTY).toBeGreaterThan(0);
    expect(entry.penaltySeconds).toBe(me.penaltySeconds + RACE.COMPOUND_RULE_PENALTY);
    expect(entry.totalTime).toBeCloseTo(me.totalTime + me.penaltySeconds + RACE.COMPOUND_RULE_PENALTY, 3);
    // Só ele: os outros cumpriram e ficam com a punição que já tinham.
    for (const other of result.entries) {
      if (other.driverId === setup.playerId || other.status !== 'finished') continue;
      expect(other.penaltySeconds, other.driverId).toBe(carOf(state, other.driverId).penaltySeconds);
    }
    // A classificação é refeita com a punição: quem terminou à frente dele no resultado tem tempo final menor.
    const finished = result.entries.filter((e) => e.status === 'finished');
    for (let i = 1; i < finished.length; i++) expect(finished[i]!.totalTime).toBeGreaterThanOrEqual(finished[i - 1]!.totalTime);
  });

  it('em corrida molhada a regra não vale, e nas categorias sem a regra ninguém é punido por um composto só', () => {
    const f2 = raceSetup('f2');
    const wet = watch(f2, 3, WET).final;
    expect(isDry(wet)).toBe(false);
    const wetResult = finalizeRace(wet, f2.ctx.category);
    for (const car of wet.cars) {
      if (car.status !== 'running') continue;
      expect(wetResult.entries.find((e) => e.driverId === car.driverId)!.penaltySeconds, car.driverId).toBe(car.penaltySeconds);
    }
    // Fórmula Júnior: um composto de pista seca, sem a regra.
    const f4 = raceSetup('f4');
    expect(f4.ctx.category.race.mandatoryTwoCompounds).toBe(false);
    const dry = watch(f4, 1).final;
    const dryResult = finalizeRace(dry, f4.ctx.category);
    let single = 0;
    for (const car of dry.cars) {
      if (car.status !== 'running') continue;
      if (new Set(car.compoundsUsed).size === 1) single++;
      expect(dryResult.entries.find((e) => e.driverId === car.driverId)!.penaltySeconds, car.driverId).toBe(car.penaltySeconds);
    }
    expect(single).toBeGreaterThan(0);
  });

  it('a IA não arrasta pneu acabado: para logo depois do penhasco, salvo nas últimas voltas', () => {
    // O engenheiro chama para os boxes assim que o pneu passa do penhasco, se ainda faltam
    // PIT_MIN_LAPS_LEFT voltas; com menos que isso, a parada custa mais que levar o pneu até a
    // bandeirada. Então a maior sequência de voltas com pneu acabado é a volta em que ele acabou
    // mais as últimas da corrida: PIT_MIN_LAPS_LEFT, no máximo. O teto por carro tem duas voltas
    // de folga (safety car e fila dupla podem atrasar a parada em uma volta); o da corrida inteira
    // deixa cada carro repetir isso em dois stints; e a média do grid fica bem abaixo, porque a
    // maioria troca antes de chegar lá.
    const perCarRun = TYRE_CURVE.PIT_MIN_LAPS_LEFT + 2;
    for (const id of ['f4', 'f3', 'f2', 'f1'] as const) {
      const setup = raceSetup(id);
      expect(setup.ctx.category.race.pitStops, id).toBe(true);
      let cars = 0;
      let laps = 0;
      for (const seed of [1, 2, 3, 7]) {
        const { final, gone } = watch(setup, seed);
        for (const car of final.cars) {
          if (car.driverId === setup.playerId) continue;
          const seen = gone.get(car.driverId) ?? { laps: 0, run: 0 };
          expect(seen.run, `${id}, semente ${seed}, ${car.driverId}`).toBeLessThanOrEqual(perCarRun);
          expect(seen.laps, `${id}, semente ${seed}, ${car.driverId}`).toBeLessThanOrEqual(2 * perCarRun);
          cars++;
          laps += seen.laps;
        }
      }
      // Em média, menos de duas voltas por carro por corrida com o pneu além do penhasco.
      expect(laps / cars, id).toBeLessThan(2);
    }
  });
});
