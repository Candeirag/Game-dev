/**
 * Regras da família e da dinastia.
 *
 * Os números de mortalidade seguem, em ordem de grandeza, uma tábua de vida
 * real; os demais foram calibrados para que uma carreira de piloto (cerca de
 * 25 temporadas) costume produzir um relacionamento estável e de um a três
 * filhos, com tempo para o primeiro chegar ao kart antes da aposentadoria.
 */
import type { ChildTrait, SupportLevel } from '@/domain/schemas';

export interface TraitDefinition {
  id: ChildTrait;
  name: string;
  /** O traço como substantivo, para as frases sem gênero ("Perfil: sangue-frio e carisma"). */
  quality: string;
  description: string;
  /** Multiplicador da evolução por temporada. */
  development: number;
  /** Bônus no teto de desenvolvimento. */
  talent: number;
  /** Variação anual da vontade de correr e da relação com o jogador. */
  interest: number;
  bond: number;
  /** Ruído extra no resultado da temporada (pilotos agressivos oscilam mais). */
  volatility: number;
  /** Fração extra do custo da vaga coberta por patrocinadores próprios. */
  sponsorAppeal: number;
}

export const TRAITS: readonly TraitDefinition[] = [
  {
    id: 'determined',
    name: 'Determinado',
    quality: 'determinação',
    description: 'Treina mais que os outros e não desiste.',
    development: 1.15,
    talent: 0,
    interest: 3,
    bond: 0,
    volatility: 0,
    sponsorAppeal: 0,
  },
  {
    id: 'gifted',
    name: 'Talentoso',
    quality: 'talento natural',
    description: 'Nasceu com um teto mais alto.',
    development: 1,
    talent: 4,
    interest: 1,
    bond: 0,
    volatility: 0,
    sponsorAppeal: 0,
  },
  {
    id: 'calm',
    name: 'Frio',
    quality: 'sangue-frio',
    description: 'Erra pouco sob pressão; resultados regulares.',
    development: 1,
    talent: 0,
    interest: 0,
    bond: 1,
    volatility: -0.8,
    sponsorAppeal: 0,
  },
  {
    id: 'aggressive',
    name: 'Agressivo',
    quality: 'agressividade',
    description: 'Ataca sempre: alterna vitórias e acidentes.',
    development: 1.03,
    talent: 1,
    interest: 2,
    bond: -1,
    volatility: 1.2,
    sponsorAppeal: 0,
  },
  {
    id: 'charismatic',
    name: 'Carismático',
    quality: 'carisma',
    description: 'Atrai patrocinadores com facilidade.',
    development: 1,
    talent: 0,
    interest: 0,
    bond: 1,
    volatility: 0,
    sponsorAppeal: 0.2,
  },
  {
    id: 'rebel',
    name: 'Rebelde',
    quality: 'rebeldia',
    description: 'Bate de frente com a família e pode largar tudo.',
    development: 0.95,
    talent: 2,
    interest: -3,
    bond: -3,
    volatility: 0.6,
    sponsorAppeal: 0,
  },
  {
    id: 'studious',
    name: 'Estudioso',
    quality: 'método',
    description: 'Entende o carro e aprende com método.',
    development: 1.08,
    talent: 0,
    interest: -1,
    bond: 1,
    volatility: -0.4,
    sponsorAppeal: 0,
  },
  {
    id: 'intuitive',
    name: 'Intuitivo',
    quality: 'intuição',
    description: 'Sente a pista; brilha em condições difíceis.',
    development: 1,
    talent: 2,
    interest: 1,
    bond: 0,
    volatility: 0.3,
    sponsorAppeal: 0,
  },
];

export function getTrait(id: ChildTrait): TraitDefinition {
  const trait = TRAITS.find((t) => t.id === id);
  if (!trait) throw new Error(`Traço desconhecido: ${id}`);
  return trait;
}

export const FAMILY = {
  /** Idade mínima para um relacionamento sério e chance anual de conhecer alguém. */
  PARTNER_MIN_AGE: 21,
  PARTNER_CHANCE: 0.35,
  /** Relação mínima e tempo juntos para o casamento entrar em pauta. */
  MARRIAGE_RELATIONSHIP: 65,
  /** Custo do casamento, em custos de vida anuais da categoria. */
  WEDDING_COST: 0.8,
  /**
   * Filhos: chance anual de o assunto surgir, idade-limite do personagem e do parceiro, relação
   * mínima do casal para o assunto surgir (no começo do ano e nos cartões de vida pessoal) e máximo
   * de filhos. Os dois números do meio estavam soltos no evento de família; a Fase 6 (filhos que
   * nascem por cartões de vida pessoal) os trouxe para cá, sem mudar os valores.
   */
  CHILD_CHANCE: 0.4,
  CHILD_MAX_PARENT_AGE: 48,
  PARTNER_MAX_CHILD_AGE: 45,
  CHILD_RELATIONSHIP: 55,
  MAX_CHILDREN: 4,
  /** Abaixo disto, a relação entra em crise. */
  CRISIS_RELATIONSHIP: 35,
  /** Parte do patrimônio líquido que fica com o ex-cônjuge em um divórcio. */
  DIVORCE_SHARE: 0.3,
  /** Desgaste anual da relação por temporada de calendário longo (mais de 12 etapas) e por treino intenso. */
  LONG_SEASON_STRAIN: 3,
  INTENSE_TRAINING_STRAIN: 2,
  /** Casamento feliz (70+) dá moral por etapa; relação em crise tira. */
  HAPPY_MORALE: 0.3,
  CRISIS_MORALE: -0.6,

  /**
   * Herança de talento: pesos do jogador, do parceiro e do acaso (média e desvio), e desvio individual.
   * Fase 6: eram 0,5 / 0,2 / 0,3 com média 72. Quem cresce numa família de pilotos (kart desde os 8
   * anos, boxes em casa) puxa mais do pai ou da mãe e menos da média: com o pai de teto 89, a média dos
   * filhos sobe de 79,5 para 82. Sem isso, no simulador, a 2ª geração ia menos longe que a 1ª.
   */
  TALENT_PARENT: 0.55,
  TALENT_PARTNER: 0.2,
  TALENT_CHANCE: 0.25,
  TALENT_CHANCE_MEAN: 78,
  TALENT_CHANCE_SD: 9,
  TALENT_NOISE_SD: 4,

  /** Formação no kart: dos 8 aos 13 anos. Custo anual e rendimento por nível de investimento. */
  KART_START_AGE: 8,
  CAREER_START_AGE: 14,
  KART_COST: { none: 0, basic: 9_000, full: 28_000 } satisfies Record<SupportLevel, number>,
  KART_YIELD: { none: 0, basic: 0.6, full: 1 } satisfies Record<SupportLevel, number>,
  /** Vontade mínima para começar a carreira aos 14 anos. */
  CAREER_INTEREST: 40,
  /** Atributos iniciais aos 14 anos: base + anos de kart × ganho + (talento − 75) × peso. */
  START_BASE: 47,
  START_PER_KART_YEAR: 2,
  START_TALENT_WEIGHT: 0.2,

  /** Apoio à carreira: parte do custo líquido da vaga que a família paga. */
  SUPPORT_SHARE: { none: 0, basic: 0.5, full: 1 } satisfies Record<SupportLevel, number>,
  /** Fração da vaga que os patrocinadores do próprio filho cobrem: 20% + reputação/250. */
  OWN_COVERAGE_BASE: 0.2,
  OWN_COVERAGE_PER_REPUTATION: 1 / 250,
  /** Academia de uma equipe do topo: cobre metade da vaga e acelera a evolução. */
  ACADEMY_SHARE: 0.5,
  ACADEMY_CHANCE: 0.4,
  ACADEMY_DEVELOPMENT: 1.1,
  /** Posição máxima no campeonato para um filho receber proposta do degrau de cima. */
  PROMOTION_POSITION: 8,
  /** Ruído do resultado de uma temporada simulada fora do campeonato do jogador. */
  SEASON_NOISE_SD: 2.5,
  /** Quanto cada posição de força da equipe vale em nota de desempenho (no kart; cresce com o peso do carro na categoria). */
  CAR_WEIGHT: 0.45,

  /** Mortalidade anual por faixa de idade (tábua de vida simplificada). */
  MORTALITY: [
    { upTo: 49, risk: 0.001 },
    { upTo: 59, risk: 0.005 },
    { upTo: 69, risk: 0.015 },
    { upTo: 79, risk: 0.05 },
    { upTo: 89, risk: 0.14 },
    { upTo: 99, risk: 0.3 },
    { upTo: 200, risk: 1 },
  ],
  /** Chance de uma lesão grave em corrida ser fatal. */
  FATAL_ACCIDENT_CHANCE: 0.02,
  /** Idade mínima para assumir os negócios da família. */
  ADULT_AGE: 18,
  /** Parte da melhor reputação da família que o herdeiro carrega no sobrenome. */
  NAME_PRESTIGE: 0.35,
} as const;

export const PARTNER_FIRST_NAMES = [
  'Marina',
  'Camila',
  'Elena',
  'Sophie',
  'Lara',
  'Isabel',
  'Chiara',
  'Emma',
  'Júlia',
  'Nina',
  'Rafael',
  'Lucas',
  'Daniel',
  'Mateo',
  'Henrique',
  'Leo',
  'Bruno',
  'Felipe',
  'Adrien',
  'Tiago',
] as const;
export const PARTNER_LAST_NAMES = [
  'Albuquerque',
  'Fontana',
  'Meyer',
  'Lacerda',
  'Dubois',
  'Vasconcelos',
  'Romano',
  'Brandt',
  'Queiroz',
  'Navarro',
  'Siqueira',
  'Laurent',
] as const;
export const CHILD_FIRST_NAMES = [
  'Ayrton',
  'Enzo',
  'Bia',
  'Gabriel',
  'Luna',
  'Theo',
  'Alice',
  'Caio',
  'Maya',
  'Pedro',
  'Nico',
  'Clara',
  'Davi',
  'Sara',
  'Bento',
  'Lia',
  'Max',
  'Íris',
  'Ravi',
  'Olívia',
] as const;

export const PARTNER_BACKGROUND_INFO = {
  motorsport: { name: 'Automobilismo', description: 'Cresceu nos boxes: entende a rotina e os filhos herdam mais aptidão.', talent: 78 },
  business: { name: 'Negócios', description: 'Ajuda a cuidar do dinheiro: os negócios da família rendem 10% mais.', talent: 66 },
  arts: { name: 'Artes', description: 'Vida fora das pistas: a moral se recupera mais rápido.', talent: 62 },
  health: { name: 'Saúde', description: 'Trabalha com medicina ou fisioterapia: as lesões duram uma etapa a menos.', talent: 68 },
  media: { name: 'Mídia', description: 'Conhece a imprensa: a reputação cresce um pouco mais rápido.', talent: 64 },
} as const;
