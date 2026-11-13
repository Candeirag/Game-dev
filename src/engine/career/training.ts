import type { AttributeKey, TrainingFocus } from '@/domain/schemas';

/**
 * Programas de treino entre as etapas: cada foco distribui o ganho de treino
 * entre atributos, com pesos que somam cerca de 2. O foco "balanced" espalha
 * o mesmo total por todos os atributos treináveis. A experiência não é
 * treinável; ela só vem da competição.
 */
export const TRAINING_GROUPS: Readonly<Record<TrainingFocus, Partial<Record<AttributeKey, number>>>> = {
  speed: { pace: 1.4, overtaking: 0.6 },
  racecraft: { racecraft: 1.0, defending: 0.6, overtaking: 0.4 },
  consistency: { consistency: 1.1, focus: 0.9 },
  tyres: { tyreManagement: 1.6, racecraft: 0.4 },
  wet: { wetSkill: 1.6, consistency: 0.4 },
  balanced: {
    pace: 0.25,
    consistency: 0.25,
    overtaking: 0.25,
    defending: 0.25,
    focus: 0.25,
    racecraft: 0.25,
    tyreManagement: 0.25,
    wetSkill: 0.25,
  },
};

export const TRAINABLE_ATTRIBUTES: readonly AttributeKey[] = [
  'pace',
  'consistency',
  'overtaking',
  'defending',
  'focus',
  'racecraft',
  'tyreManagement',
  'wetSkill',
];
