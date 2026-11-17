/**
 * Veículo de cada categoria: a identidade visual da escada, do kart de entrada
 * ao Monoposto Grand Prix. Cada categoria do jogo tem o seu, e nenhum é reaproveitado.
 * Os nomes vêm de `src/domain/categoryNames.ts`.
 *
 * Isto é só aparência (e o tamanho com que o carro é desenhado na pista): não
 * muda regra, desempenho nem progressão, que continuam em categories.ts.
 *
 * Os comprimentos estão em unidades de mundo da transmissão e guardam a
 * proporção real entre os veículos (um kart tem cerca de 2 m; um carro do topo, 5,6 m),
 * ampliada para o carro ser visível na pista. A largura sai da proporção do
 * sprite de cada veículo.
 */
import { CATEGORY_NAMES } from '@/domain/categoryNames';
import type { CategoryId } from '@/domain/schemas';

export interface VehicleDefinition {
  categoryId: CategoryId;
  kind: 'kart' | 'formula';
  /** Nome do veículo, como aparece na garagem e na escada da carreira. */
  name: string;
  /** O que o distingue dos vizinhos na escada. */
  description: string;
  length: number;
  width: number;
}

export const VEHICLES: Readonly<Record<CategoryId, VehicleDefinition>> = {
  'kart-regional': {
    categoryId: 'kart-regional',
    kind: 'kart',
    name: CATEGORY_NAMES['kart-regional'].vehicleName,
    description: 'Kart de entrada: chassi tubular à mostra, quase sem carenagem, motor 4 tempos.',
    length: 13.5,
    width: 8.9,
  },
  'kart-national': {
    categoryId: 'kart-national',
    kind: 'kart',
    name: CATEGORY_NAMES['kart-national'].vehicleName,
    description: 'Kart de competição: carenagens completas e motor 2 tempos de 125 cc.',
    length: 14.5,
    width: 8.9,
  },
  'kart-international': {
    categoryId: 'kart-international',
    kind: 'kart',
    name: CATEGORY_NAMES['kart-international'].vehicleName,
    description: 'Kart de ponta: carenagem dianteira larga, radiador lateral, freios dianteiros e câmbio.',
    length: 15.5,
    width: 10.2,
  },
  f4: {
    categoryId: 'f4',
    kind: 'formula',
    name: CATEGORY_NAMES.f4.vehicleName,
    description: 'Monoposto de entrada: compacto e estreito, asas simples, tomada de ar alta.',
    length: 18,
    width: 8.1,
  },
  f3: {
    categoryId: 'f3',
    kind: 'formula',
    name: CATEGORY_NAMES.f3.vehicleName,
    description: 'Mais aerodinâmica: asa dianteira de três elementos e barbatana na tampa do motor.',
    length: 19.5,
    width: 8.2,
  },
  f2: {
    categoryId: 'f2',
    kind: 'formula',
    name: CATEGORY_NAMES.f2.vehicleName,
    description: 'Carro grande e potente: asa traseira larga em dois planos e pneus traseiros bem mais largos.',
    length: 21,
    width: 9.5,
  },
  f1: {
    categoryId: 'f1',
    kind: 'formula',
    name: CATEGORY_NAMES.f1.vehicleName,
    description: 'Carro de efeito solo: asa dianteira de quatro elementos, assoalho largo e rodas grandes com calota.',
    length: 23,
    width: 9.7,
  },
};

const FALLBACK = VEHICLES.f1;

/** Veículo de uma categoria (aceita o id como texto, como vem do estado da corrida). */
export function vehicleFor(categoryId: string): VehicleDefinition {
  return (VEHICLES as Readonly<Record<string, VehicleDefinition>>)[categoryId] ?? FALLBACK;
}
