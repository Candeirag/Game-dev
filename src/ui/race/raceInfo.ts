/**
 * Contas de exibição da corrida com lances e pneus (Fase 4): o que a tela mostra do pneu do
 * jogador, dos tempos de volta e do que pesa na chance de cada opção de lance.
 *
 * Nada aqui decide a corrida. As regras (curva do pneu, janela de parada, chances) são do motor;
 * estas funções só escolhem o que mostrar e com que palavras, sempre a partir do que já apareceu
 * na imagem, nunca do estado adiantado do motor.
 */
import { BIRTH_TRAITS } from '@/data/birth';
import type { RaceRules } from '@/data/categories';
import { MOMENT_FACTOR_LABELS } from '@/domain/labels';
import type { Birth, CareerState, DriverAttributes, MomentKind, Track, TraitId, TyreCompound } from '@/domain/schemas';
import {
  TYRES,
  buildRaceContext,
  lapsToCliff,
  neutralRaceProfile,
  pitWindow,
  tyreState,
  type DriverRaceProfile,
  type MomentOption,
  type RaceTimeline,
} from '@/engine';
import type { Tone } from '@/ui/kit';

/** Perfil de corrida do jogador (aptidões e talentos de nascença); o neutro para quem não tem. */
export function playerRaceProfile(career: CareerState): DriverRaceProfile {
  try {
    return buildRaceContext(career).profiles?.[career.playerDriverId] ?? neutralRaceProfile();
  } catch {
    // Fora de um fim de semana não há contexto de corrida: vale o perfil neutro.
    return neutralRaceProfile();
  }
}

/* ------------------------------------------------------------------ */
/* O que pesa na chance de uma opção                                   */
/* ------------------------------------------------------------------ */

/** Talentos e defeitos de nascença que entram na chance de cada lance. Os de chuva só contam com pista molhada. */
const MOMENT_TRAITS: Readonly<Record<MomentKind, readonly TraitId[]>> = {
  start: ['bornStarter', 'slowStarter'],
  attack: ['hothead'],
  defense: [],
  rain: ['rainMaster', 'rainFear'],
  lastLap: [],
  pit: ['tyreSaver', 'tyreEater'],
};
const RAIN_TRAITS: readonly TraitId[] = ['rainMaster', 'rainFear'];

export interface ShownFactor {
  key: string;
  label: string;
  /** Pontos percentuais que o fator soma (ou tira) da chance. */
  points: number;
}

/**
 * Os fatores que mais pesam na chance de uma opção, do maior para o menor (no máximo `limit`).
 *
 * O fator de nascença só aparece quando um talento ou defeito ligado ao lance já foi revelado, e
 * então com o nome dele ("Gênio na chuva"). Enquanto o traço está oculto, o fator some da lista: a
 * chance já o inclui, mas a tela não entrega o segredo.
 */
export function shownFactors(option: MomentOption, kind: MomentKind, birth: Birth | null, limit = 3): ShownFactor[] {
  const wet = kind === 'rain' || option.factors.some((f) => f.key === 'weather');
  const linked = [...MOMENT_TRAITS[kind], ...(wet ? RAIN_TRAITS : [])];
  const revealed = birth?.traits.find((t) => t.revealedSeason !== null && linked.includes(t.id)) ?? null;
  const shown: ShownFactor[] = [];
  for (const factor of option.factors) {
    if (factor.points === 0) continue;
    if (factor.key === 'profile') {
      if (revealed) shown.push({ key: factor.key, label: BIRTH_TRAITS[revealed.id].name, points: factor.points });
      continue;
    }
    shown.push({ key: factor.key, label: MOMENT_FACTOR_LABELS[factor.key], points: factor.points });
  }
  // Do que mais pesa para o que menos pesa, a favor ou contra; no empate, vale a ordem do motor.
  return shown
    .map((factor, index) => ({ factor, index }))
    .sort((a, b) => Math.abs(b.factor.points) - Math.abs(a.factor.points) || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.factor);
}

/* ------------------------------------------------------------------ */
/* Pneus                                                               */
/* ------------------------------------------------------------------ */

export interface TyreOutlook {
  text: string;
  tone: Tone;
}

/**
 * Até quando o pneu vai, em uma frase. Com boxes: a janela ideal de parada ("Janela ideal: voltas
 * 18 a 21"), "Pare já" quando ela passou e "O pneu vai até o fim" quando não é preciso parar por
 * desgaste. Sem boxes (kart): a volta em que o pneu cai do penhasco, ou que ele aguenta até a
 * bandeirada. `lap` é a última volta completa na imagem; `factor`, o que é próprio do piloto e do
 * fim de semana no desgaste (treino de ritmo de corrida × poupador ou gastador de pneus).
 */
export function tyreOutlook(input: {
  compound: TyreCompound;
  wear: number;
  lap: number;
  totalLaps: number;
  attributes: DriverAttributes;
  track: Track;
  rules: RaceRules;
  factor: number;
}): TyreOutlook {
  const { compound, wear, lap, totalLaps, attributes, track, rules, factor } = input;
  const tyre = { compound, wear, age: 0 };
  const gone = tyreState(compound, wear) === 'gone';
  if (lap >= totalLaps) return { text: 'Corrida encerrada', tone: 'neutral' };
  if (!rules.pitStops) {
    if (gone) return { text: 'O pneu já caiu do penhasco', tone: 'attention' };
    const cliffLap = lap + lapsToCliff(tyre, attributes, track, factor) + 1;
    return cliffLap > totalLaps
      ? { text: 'Aguenta até a bandeirada', tone: 'good' }
      : { text: `Cai do penhasco na volta ${cliffLap}`, tone: cliffLap - lap <= 2 ? 'attention' : 'neutral' };
  }
  // Com pneu de chuva, quem manda na parada é a pista, não o desgaste.
  if (TYRES[compound].rain) return { text: gone ? 'Pare já' : 'Troca conforme a pista secar', tone: gone ? 'attention' : 'neutral' };
  const window = pitWindow({ tyre }, attributes, track, rules, lap, totalLaps, factor);
  if (!window) return { text: 'O pneu vai até o fim', tone: 'good' };
  if (gone || window.lapsLeft <= 0) return { text: 'Pare já', tone: 'attention' };
  const open = lap + 1 >= window.from;
  return {
    text: window.from === window.to ? `Janela ideal: volta ${window.from}` : `Janela ideal: voltas ${window.from} a ${window.to}`,
    tone: open ? 'attention' : 'neutral',
  };
}

/**
 * Tempos das últimas voltas do piloto que já apareceram na imagem, para o gráfico pequeno. Ficam
 * de fora as voltas que não dizem nada do pneu: a da largada parada, as de entrada e saída dos
 * boxes e as de bandeira (safety car, real ou virtual).
 */
export function shownLapTimes(timeline: RaceTimeline, driverId: string, time: number, limit = 10): number[] {
  const car = timeline.cars[driverId];
  const times: number[] = [];
  for (const lap of car?.laps ?? []) {
    if (lap.t1 > time || lap.lastLap === null || lap.pitIn || lap.pitOut || car?.retired?.lap === lap.lap) continue;
    const info = timeline.laps[lap.lap - 1];
    if (info?.flag !== 'green' || info.standing) continue;
    times.push(lap.lastLap);
  }
  return times.slice(-limit);
}
