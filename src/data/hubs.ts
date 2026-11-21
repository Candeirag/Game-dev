/**
 * Polos: a cidade em que o piloto mora para disputar cada campeonato (Fase 3 da grande
 * atualização).
 *
 * O kart regional, o Campeonato Brasileiro de Kart e a Fórmula Júnior têm base em São Paulo: é o
 * último degrau sem sair do país. O kart internacional tem base na Itália e as fórmulas de cima,
 * até o Grand Prix Mundial, na Inglaterra. Mudar de polo é decisão grande: os custos e os efeitos
 * estão em `HUB_RULES` (`src/config/balance.ts`); aqui ficam só os nomes e o mapa.
 */
import type { CategoryId, HubId } from '@/domain/schemas';

export interface HubDefinition {
  id: HubId;
  /** Nome do polo, como aparece nas telas. */
  name: string;
  country: string;
  /** Fora do Brasil: há mudança, aluguel, idioma novo e a família fica longe. */
  foreign: boolean;
  /** Idioma que o piloto precisa aprender (null no Brasil). */
  language: string | null;
  description: string;
}

export const HUBS: readonly HubDefinition[] = [
  {
    id: 'sao-paulo',
    name: 'São Paulo',
    country: 'Brasil',
    foreign: false,
    language: null,
    description: 'As equipes de kart, os kartódromos e os patrocinadores do país estão aqui. Dá para subir até a Fórmula Júnior sem sair de casa.',
  },
  {
    id: 'italia',
    name: 'Itália',
    country: 'Itália',
    foreign: true,
    language: 'italiano',
    description: 'O centro do kart internacional: as fábricas, as equipes de ponta e os olheiros das fórmulas.',
  },
  {
    id: 'inglaterra',
    name: 'Inglaterra',
    country: 'Inglaterra',
    foreign: true,
    language: 'inglês',
    description: 'A base das equipes de fórmula, do primeiro degrau internacional até o Grand Prix Mundial.',
  },
];

/** Polo de cada campeonato. */
export const CATEGORY_HUB: Readonly<Record<CategoryId, HubId>> = {
  'kart-regional': 'sao-paulo',
  'kart-national': 'sao-paulo',
  'kart-international': 'italia',
  f4: 'sao-paulo',
  f3: 'inglaterra',
  f2: 'inglaterra',
  f1: 'inglaterra',
};

/**
 * Onde fica a vaga de aluguel de quem não consegue vaga nenhuma: um degrau abaixo, nunca mais. A
 * Fórmula Júnior e o kart internacional são alternativas no mesmo degrau da escada, então quem cai
 * de qualquer um dos dois volta ao Campeonato Brasileiro de Kart (não troca um pelo outro, o que
 * seria mudar de país para descer). No kart regional, a vaga de aluguel é no próprio regional.
 */
export const RENTAL_CATEGORY: Readonly<Record<CategoryId, CategoryId>> = {
  'kart-regional': 'kart-regional',
  'kart-national': 'kart-regional',
  'kart-international': 'kart-national',
  f4: 'kart-national',
  f3: 'f4',
  f2: 'f3',
  f1: 'f2',
};

export function getHub(id: HubId): HubDefinition {
  const hub = HUBS.find((h) => h.id === id);
  if (!hub) throw new Error(`Polo desconhecido: ${id}`);
  return hub;
}

export const hubOfCategory = (categoryId: CategoryId): HubDefinition => getHub(CATEGORY_HUB[categoryId]);
