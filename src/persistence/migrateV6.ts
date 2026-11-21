/**
 * Migração do save da versão 6 para a 7 (Fase 3 da grande atualização): economia e polos.
 *
 * A versão 7 acrescenta o polo em que o piloto mora (`hub`), o investidor, a vaquinha da cidade,
 * o trabalho paralelo e a conta das temporadas sem porta. Uma carreira começada antes disso:
 * - mora no polo do campeonato que disputa (ou acompanha, como dirigente), sem mudança a pagar e
 *   sem o ano de adaptação ao idioma (`arrivedSeason: 0`);
 * - não tem investidor, vaquinha nem trabalho paralelo, e começa a conta das portas do zero.
 *
 * O mapa de polos é copiado aqui de propósito: a migração é só de dados e não pode mudar se o
 * jogo um dia trocar o polo de um campeonato. Pode rodar duas vezes sem mudar nada na segunda.
 */
type Loose = Record<string, unknown>;

const hubByCategory: Readonly<Record<string, string>> = {
  'kart-regional': 'sao-paulo',
  'kart-national': 'sao-paulo',
  'kart-international': 'italia',
  f4: 'sao-paulo',
  f3: 'inglaterra',
  f2: 'inglaterra',
  f1: 'inglaterra',
};

const isObject = (value: unknown): value is Loose => value !== null && typeof value === 'object';

export function migrateV6(data: Loose): Loose {
  const hubId = hubByCategory[typeof data.categoryId === 'string' ? data.categoryId : ''] ?? 'sao-paulo';
  return {
    ...data,
    hub: isObject(data.hub) ? data.hub : { id: hubId, arrivedSeason: 0 },
    investor: isObject(data.investor) ? data.investor : null,
    crowdfund: isObject(data.crowdfund) ? data.crowdfund : null,
    sideJob: typeof data.sideJob === 'string' ? data.sideJob : 'none',
    noDoorSeasons: typeof data.noDoorSeasons === 'number' ? data.noDoorSeasons : 0,
  };
}
