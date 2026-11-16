import type { DriverAttributes } from '@/domain/schemas';

/** Ano da primeira temporada de toda carreira. As regras de cada categoria ficam em categories.ts. */
export const FIRST_SEASON_YEAR = 2027;

/** Tentativas lançadas de cada piloto na classificação. */
export const QUALIFYING_ATTEMPTS = 3;

/** Voltas que cada piloto completa no treino livre. */
export const PRACTICE_LAPS = 12;

/* ------------------------------------------------------------------ */
/* Criação do piloto                                                   */
/* ------------------------------------------------------------------ */

export type PlayerBackground = 'natural' | 'technical' | 'fighter';

export interface PlayerBackgroundPreset {
  id: PlayerBackground;
  name: string;
  description: string;
  attributes: DriverAttributes;
  potential: number;
}

/**
 * Perfis iniciais do jogador. Todos somam o mesmo total nos 8 atributos
 * treináveis (474), de modo que nenhum é estritamente melhor; eles só
 * distribuem os pontos de outra forma. O potencial é inversamente
 * proporcional à experiência inicial: quem já chega mais pronto evolui menos.
 * Os valores deixam o estreante no nível do fundo do pelotão intermediário:
 * em uma equipe de entrada, ele briga pela meta (cerca de 16º) e, com boas
 * decisões, chega a pontuar. A evolução é sentida ao longo da carreira.
 */
export const PLAYER_BACKGROUNDS: readonly PlayerBackgroundPreset[] = [
  {
    id: 'natural',
    name: 'Talento natural',
    description: 'Rápido desde o primeiro dia, mas ainda erra e desgasta muito os pneus.',
    attributes: { pace: 70, consistency: 54, overtaking: 62, defending: 56, focus: 56, racecraft: 54, tyreManagement: 54, wetSkill: 68, experience: 20 },
    potential: 92,
  },
  {
    id: 'technical',
    name: 'Piloto técnico',
    description: 'Lê bem a corrida e cuida do equipamento. Falta-lhe velocidade pura.',
    attributes: { pace: 62, consistency: 64, overtaking: 54, defending: 60, focus: 62, racecraft: 66, tyreManagement: 66, wetSkill: 40, experience: 28 },
    potential: 86,
  },
  {
    id: 'fighter',
    name: 'Lutador',
    description: 'Forte nas disputas roda a roda, tanto no ataque quanto na defesa.',
    attributes: { pace: 64, consistency: 56, overtaking: 68, defending: 66, focus: 58, racecraft: 56, tyreManagement: 52, wetSkill: 54, experience: 24 },
    potential: 89,
  },
];

/** Pontos livres que o jogador distribui na criação. */
export const PLAYER_BONUS_POINTS = 8;
/** Máximo de pontos livres em um mesmo atributo. */
export const PLAYER_BONUS_MAX_PER_ATTRIBUTE = 4;

export const PLAYER_MIN_AGE = 14;
export const PLAYER_MAX_AGE = 17;

export const NATIONALITIES: readonly { code: string; name: string }[] = [
  { code: 'BR', name: 'Brasil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'UY', name: 'Uruguai' },
  { code: 'PY', name: 'Paraguai' },
  { code: 'CL', name: 'Chile' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IT', name: 'Itália' },
  { code: 'US', name: 'Estados Unidos' },
];

/** Reputação inicial de um estreante (0 a 100). */
export const STARTING_REPUTATION = 10;
