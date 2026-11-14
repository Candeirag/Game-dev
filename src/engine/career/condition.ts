/**
 * Condição dos pilotos: fase, confiança, moral e lesões.
 *
 * A mesma regra vale para o jogador e para a IA. Depois de cada corrida, a
 * condição se move conforme o resultado em relação ao esperado para o
 * equipamento (a meta da equipe). Os efeitos na pista estão em
 * simulation/performance.ts (conditionEffects).
 */
import type { Condition, Driver, Injury, RaceEntryResult } from '@/domain/schemas';
import { createRng } from '../rng';

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

export const CONDITION_RULES = {
  /** A fase é uma média móvel: 60% do valor anterior, 40% da nota da corrida. */
  FORM_MEMORY: 0.6,
  /** Cada posição acima ou abaixo da meta vale 6 pontos na nota da corrida. */
  FORM_PER_POSITION: 6,
  /** A confiança volta 10% do caminho até 50 a cada etapa: ninguém vive de um resultado antigo. */
  CONFIDENCE_REVERSION: 0.1,
  /** A moral volta 15% do caminho até 55 a cada etapa (o tempo cura). */
  MORALE_RECOVERY: 0.15,
  MORALE_BASELINE: 55,
} as const;

/**
 * Nova condição após uma corrida.
 * - Fase: nota = 50 + 6 × (meta − posição), limitada a 0–100; abandono por
 *   erro próprio vale 20.
 * - Confiança: aproxima-se de 50 (10% por etapa) e reage ao resultado: vitória +10, pódio +6, dentro da meta +2, abaixo da meta −3,
 *   acidente por erro próprio −8; cada ultrapassagem +0,5 (até +3).
 * - Moral: aproxima-se da linha de base e reage ao resultado (+4 acima da
 *   meta, −3 abaixo, −5 em abandono).
 */
export function conditionAfterRace(condition: Condition, entry: RaceEntryResult | null, target: number): Condition {
  if (!entry) {
    // Não correu (lesão ou suspensão): a fase esfria e a moral cai um pouco.
    return { form: clamp(condition.form * 0.9 + 5), confidence: condition.confidence, morale: clamp(condition.morale - 2) };
  }
  const ownFault = entry.status === 'dnf' && (entry.dnfReason === 'crash' || entry.dnfReason === 'fuel');
  const finished = entry.status === 'finished';
  const raceScore = finished ? Math.min(100, Math.max(0, 50 + CONDITION_RULES.FORM_PER_POSITION * (target - entry.position))) : ownFault ? 20 : 45;
  const form = condition.form * CONDITION_RULES.FORM_MEMORY + raceScore * (1 - CONDITION_RULES.FORM_MEMORY);

  let confidence = condition.confidence + (50 - condition.confidence) * CONDITION_RULES.CONFIDENCE_REVERSION + Math.min(3, entry.overtakes * 0.5);
  if (finished && entry.position === 1) confidence += 10;
  else if (finished && entry.position <= 3) confidence += 6;
  else if (finished && entry.position <= target) confidence += 2;
  else if (finished) confidence -= 3;
  if (ownFault) confidence -= 8;
  if (entry.status === 'dnf' && entry.dnfReason === 'collision') confidence -= 3;
  if (entry.penaltySeconds > 0) confidence -= 1;

  let morale = condition.morale + (CONDITION_RULES.MORALE_BASELINE - condition.morale) * CONDITION_RULES.MORALE_RECOVERY;
  if (finished && entry.position <= Math.max(1, target - 2)) morale += 4;
  else if (finished && entry.position > target) morale -= 3;
  if (entry.status === 'dnf') morale -= 5;

  return { form: clamp(form), confidence: clamp(confidence), morale: clamp(morale) };
}

const INJURIES: Record<Injury['severity'], readonly string[]> = {
  minor: ['Contusão no punho', 'Luxação no ombro', 'Dor cervical', 'Contusão nas costelas'],
  serious: ['Fratura no punho', 'Fratura na clavícula', 'Concussão', 'Fratura no pé'],
};

/**
 * Lesão sofrida em um acidente. 65% são leves (1 a 2 etapas de recuperação; o
 * piloto pode correr com perda de rendimento) e 35% são graves (2 a 5 etapas
 * fora).
 */
export function rollInjury(seed: number): Injury {
  const rng = createRng(seed);
  const serious = rng.next() < 0.35;
  const severity: Injury['severity'] = serious ? 'serious' : 'minor';
  const list = INJURIES[severity];
  return {
    description: list[Math.floor(rng.next() * list.length)] ?? 'Lesão',
    severity,
    roundsRemaining: serious ? 2 + Math.floor(rng.next() * 4) : 1 + Math.floor(rng.next() * 2),
  };
}

/** Avança a recuperação em uma etapa. `rested` indica que o piloto não correu. */
export function recoverInjury(injury: Injury | null, rested: boolean): Injury | null {
  if (!injury) return null;
  // Correr lesionado atrasa a recuperação: só o descanso conta como etapa inteira,
  // exceto nas lesões leves, que cicatrizam de qualquer forma.
  const progress = rested || injury.severity === 'minor' ? 1 : 0;
  const remaining = injury.roundsRemaining - progress;
  return remaining <= 0 ? null : { ...injury, roundsRemaining: remaining };
}

/** O piloto está impedido de correr (lesão grave). */
export function isUnavailable(driver: Pick<Driver, 'injury'>): boolean {
  return driver.injury !== null && driver.injury.severity === 'serious';
}
