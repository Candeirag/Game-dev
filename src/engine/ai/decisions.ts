/**
 * Decisões dos pilotos da IA. Todas seguem regras determinísticas a partir dos
 * atributos e da situação; nenhuma envolve sorteio. Assim, os rivais se
 * comportam de forma coerente com o próprio perfil.
 */
import type { DriverAttributes, PracticeProgram, QualifyingApproach, RaceMode, SessionWeather, Track, TrainingFocus } from '@/domain/schemas';
import { TYRE_CURVE } from '@/config/balance';
import { TRAINING_GROUPS } from '../career/training';

export function chooseAiPracticeProgram(a: DriverAttributes, track: Track): PracticeProgram {
  // Pilotos inexperientes precisam de tempo de pista para acertar o kart.
  if (a.experience < 45) return 'setup';
  // Em pista abrasiva, quem não cuida bem dos pneus treina ritmo de corrida.
  if (track.tyreWear >= 1.1 && a.tyreManagement < 75) return 'longRun';
  // Onde ultrapassar é difícil, largar na frente vale mais.
  if (track.overtakingDifficulty >= 0.5) return 'qualifying';
  return 'setup';
}

export function chooseAiQualifyingApproach(a: DriverAttributes, weather: SessionWeather): QualifyingApproach {
  // Na chuva, quem não domina o molhado prefere garantir uma volta limpa.
  if (weather.wetness > 0.5 && a.wetSkill < 60) return 'safe';
  if (a.consistency >= 78) return 'attack';
  if (a.consistency < 62) return 'safe';
  return 'balanced';
}

export interface RaceSituation {
  lapsRemaining: number;
  tyreWear: number;
  /** Desgaste em que o composto em uso cai do penhasco. */
  tyreCliff: number;
  /** Desgaste previsto no fim do stint (na próxima parada ou na bandeirada), em ritmo equilibrado. */
  projectedWear: number;
  /** Voltas até o fim do stint. */
  stintLapsLeft: number;
  /** Distância para o kart da frente, em segundos (null se for o líder). */
  gapAhead: number | null;
  /** Distância para o kart de trás, em segundos (null se for o último). */
  gapBehind: number | null;
}

export function chooseAiRaceMode(a: DriverAttributes, s: RaceSituation): RaceMode {
  // Pneu no limite (perto do penhasco) com muita corrida pela frente: poupar.
  if (s.tyreWear > s.tyreCliff - TYRE_CURVE.LIMIT_MARGIN && s.lapsRemaining > 3) return 'conservative';
  // O pneu não chega ao fim do stint nesse ritmo: poupar desde já, para não cair do penhasco.
  if (s.projectedWear > s.tyreCliff && s.stintLapsLeft > 3) return 'conservative';
  // Reta final com alguém ao alcance: atacar.
  if (s.lapsRemaining <= 4 && s.gapAhead !== null && s.gapAhead < 0.8) return 'aggressive';
  // Sozinho na pista: administrar o resultado.
  const isolatedAhead = s.gapAhead === null || s.gapAhead > 2.5;
  const isolatedBehind = s.gapBehind === null || s.gapBehind > 2.5;
  if (isolatedAhead && isolatedBehind) return 'conservative';
  // Pilotos de boa leitura de corrida atacam quando a chance aparece.
  if (a.racecraft >= 75 && s.gapAhead !== null && s.gapAhead < 0.5) return 'aggressive';
  // Pressionado no fim, quem defende bem fecha a porta com mais agressividade.
  if (s.lapsRemaining <= 5 && s.gapBehind !== null && s.gapBehind < 0.4 && a.defending >= 70) return 'aggressive';
  return 'balanced';
}

/**
 * A IA treina o grupo de atributos em que está mais fraca: é a escolha que um
 * preparador faria e mantém os rivais completos ao longo das temporadas.
 */
export function chooseAiTrainingFocus(a: DriverAttributes): TrainingFocus {
  const candidates: TrainingFocus[] = ['speed', 'racecraft', 'consistency', 'tyres', 'wet'];
  let best: TrainingFocus = 'balanced';
  let lowest = Infinity;
  for (const focus of candidates) {
    const keys = Object.keys(TRAINING_GROUPS[focus]) as (keyof DriverAttributes)[];
    const avg = keys.reduce((sum, key) => sum + a[key], 0) / keys.length;
    if (avg < lowest) {
      lowest = avg;
      best = focus;
    }
  }
  return best;
}
