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
 * - fator_idade: jovens aprendem mais rápido (1,15 até os 17 anos; 1,0 até os
 *   21; 0,85 até os 25; 0,55 até os 29; 0,25 depois).
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
  /** Calibrado para dar de +6 a +9 por temporada no atributo principal de um jovem. */
  TRAINING_RATE: 0.6,
  NATURAL_RATE: 0.08,
  /** Distância até o potencial a partir da qual o ganho é máximo. */
  FULL_GAIN_GAP: 20,
  EXPERIENCE_PER_ROUND: 1.6,
  VARIATION: [0.75, 1.25] as const,
} as const;

export function ageFactor(age: number): number {
  if (age <= 17) return 1.15;
  if (age <= 21) return 1.0;
  if (age <= 25) return 0.85;
  if (age <= 29) return 0.55;
  return 0.25;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export type AttributeDelta = Partial<Record<AttributeKey, number>>;

/** Aplica um ciclo de desenvolvimento a um piloto. A semente define a variação. */
export function developDriver(driver: Driver, seed: number, cycles = 1, multiplier = 1): { driver: Driver; delta: AttributeDelta } {
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
    const gain = Math.min(gap, rate * factor * gapFactor * variation * cycles * multiplier);
    attributes[key] = round2(current + gain);
    delta[key] = round2(attributes[key] - current);
  }

  const expGain = DEVELOPMENT.EXPERIENCE_PER_ROUND * cycles * Math.max(0, 1 - attributes.experience / 110);
  const newExperience = round2(Math.min(100, attributes.experience + expGain));
  delta.experience = round2(newExperience - attributes.experience);
  attributes.experience = newExperience;

  return { driver: { ...driver, attributes }, delta };
}

/** Ganho de treino por intensidade. O treino intenso rende mais, mas custa caro e desgasta. */
export const INTENSITY_GAIN = { light: 0.6, normal: 1, intense: 1.4 } as const;

/**
 * Multiplicador do aproveitamento do treino pela moral: 0,8 com moral 0,
 * 1,0 com moral 50 e 1,2 com moral 100.
 */
export function moraleTrainingFactor(morale: number): number {
  return 0.8 + morale / 250;
}

/**
 * Desenvolve todos os pilotos com vaga após uma etapa. Reservas treinam, mas
 * rendem metade (não competem). `playerMultiplier` reúne a intensidade do
 * treino e o apoio da academia do jogador.
 */
export function developAfterRound(
  drivers: readonly Driver[],
  careerSeed: number,
  season: number,
  round: number,
  playerMultiplier = 1,
): { drivers: Driver[]; deltas: Record<string, AttributeDelta> } {
  const deltas: Record<string, AttributeDelta> = {};
  const next = drivers.map((d) => {
    if (!d.teamId) return d;
    const multiplier = moraleTrainingFactor(d.condition.morale) * (d.isPlayer ? playerMultiplier : 1) * (d.role === 'reserve' ? 0.5 : 1) * (d.injury?.severity === 'serious' ? 0.3 : 1);
    const result = developDriver(d, hashSeed(careerSeed, season, round, 'development', d.id), 1, multiplier);
    deltas[d.id] = result.delta;
    return result.driver;
  });
  return { drivers: next, deltas };
}

/**
 * Envelhecimento. A partir dos 31 anos, os atributos físicos e de reflexo
 * (velocidade, concentração, ultrapassagem e chuva) caem a cada temporada:
 * 0,25 ponto por ano de idade acima de 30, com variação de ±30%. Aos 34, a
 * perda é de cerca de 1 ponto por ano; aos 38, de 2. Leitura de corrida,
 * gestão de pneus e experiência não caem: é por isso que veteranos ainda
 * rendem em corrida mesmo perdendo velocidade pura.
 */
export const DECLINE_START_AGE = 31;
const DECLINING: readonly (keyof Driver['attributes'])[] = ['pace', 'focus', 'overtaking', 'wetSkill'];

export function applyAging(driver: Driver, seed: number): Driver {
  if (driver.age < DECLINE_START_AGE) return driver;
  const rng = createRng(seed);
  const attributes = { ...driver.attributes };
  for (const key of DECLINING) {
    const loss = (driver.age - 30) * 0.25 * uniform(rng, 0.7, 1.3) * (key === 'pace' ? 1 : 0.7);
    attributes[key] = round2(Math.max(30, attributes[key] - loss));
  }
  // O potencial acompanha a queda (0,4 ponto por ano acima de 30): o treino não devolve o que a idade levou.
  const potential = round2(Math.max(attributes.pace, driver.potential - (driver.age - 30) * 0.4));
  return { ...driver, attributes, potential };
}
