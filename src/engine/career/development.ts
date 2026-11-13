/**
 * Evolução dos pilotos.
 *
 * Depois de cada etapa, todos os pilotos com vaga evoluem segundo uma regra
 * única, aplicada igualmente ao jogador e à IA:
 *
 *   ganho = (TAXA_TREINO × peso_do_foco + TAXA_NATURAL)
 *           × fator_idade × fator_distância × variação
 *
 * - peso_do_foco: vem do programa de treino escolhido (ver training.ts).
 * - TAXA_NATURAL: competir já desenvolve um pouco de tudo.
 * - fator_idade: jovens aprendem mais rápido.
 * - fator_distância: quanto mais perto do potencial, mais lento o ganho
 *   (retorno decrescente); no potencial, o ganho é zero.
 * - variação: de 0,75 a 1,25, sorteada com a semente da carreira. Representa
 *   a resposta individual ao treino, que nunca é idêntica de uma semana para
 *   outra.
 *
 * A experiência cresce só competindo, e cada vez mais devagar perto de 100.
 */
import type { AttributeKey, Driver, DriverAttributes } from '@/domain/schemas';
import { createRng, hashSeed, uniform } from '../rng';
import { TRAINABLE_ATTRIBUTES, TRAINING_GROUPS } from './training';

export const DEVELOPMENT = {
  /** Calibrado para dar de +5 a +8 por temporada no atributo principal de um jovem. */
  TRAINING_RATE: 0.5,
  NATURAL_RATE: 0.08,
  /** Distância até o potencial a partir da qual o ganho é máximo. */
  FULL_GAIN_GAP: 30,
  EXPERIENCE_PER_ROUND: 1.6,
  VARIATION: [0.75, 1.25] as const,
} as const;

export function ageFactor(age: number): number {
  if (age <= 15) return 1.15;
  if (age <= 18) return 1.0;
  if (age <= 22) return 0.8;
  if (age <= 27) return 0.5;
  return 0.25;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export type AttributeDelta = Partial<Record<AttributeKey, number>>;

/** Aplica um ciclo de desenvolvimento a um piloto. A semente define a variação. */
export function developDriver(driver: Driver, seed: number, cycles = 1): { driver: Driver; delta: AttributeDelta } {
  const rng = createRng(seed);
  const weights = TRAINING_GROUPS[driver.trainingFocus];
  const factor = ageFactor(driver.age);
  const attributes: DriverAttributes = { ...driver.attributes };
  const delta: AttributeDelta = {};

  for (const key of TRAINABLE_ATTRIBUTES) {
    const variation = uniform(rng, DEVELOPMENT.VARIATION[0], DEVELOPMENT.VARIATION[1]);
    const current = attributes[key];
    const gap = Math.max(0, Math.min(100, driver.potential) - current);
    if (gap <= 0) continue;
    const gapFactor = Math.min(1, gap / DEVELOPMENT.FULL_GAIN_GAP);
    const rate = DEVELOPMENT.TRAINING_RATE * (weights[key] ?? 0) + DEVELOPMENT.NATURAL_RATE;
    const gain = Math.min(gap, rate * factor * gapFactor * variation * cycles);
    attributes[key] = round2(current + gain);
    delta[key] = round2(attributes[key] - current);
  }

  const expGain = DEVELOPMENT.EXPERIENCE_PER_ROUND * cycles * Math.max(0, 1 - attributes.experience / 110);
  const newExperience = round2(Math.min(100, attributes.experience + expGain));
  delta.experience = round2(newExperience - attributes.experience);
  attributes.experience = newExperience;

  return { driver: { ...driver, attributes }, delta };
}

/** Desenvolve todos os pilotos com vaga após uma etapa. */
export function developAfterRound(
  drivers: readonly Driver[],
  careerSeed: number,
  season: number,
  round: number,
): { drivers: Driver[]; deltas: Record<string, AttributeDelta> } {
  const deltas: Record<string, AttributeDelta> = {};
  const next = drivers.map((d) => {
    if (!d.teamId) return d;
    const result = developDriver(d, hashSeed(careerSeed, season, round, 'development', d.id));
    deltas[d.id] = result.delta;
    return result.driver;
  });
  return { drivers: next, deltas };
}
