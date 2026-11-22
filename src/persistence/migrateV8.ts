/**
 * Migração do save da versão 8 para a 9 (Fase 5 da grande atualização): eventos encadeados.
 *
 * A versão 9 acrescenta `story`, a memória das histórias do personagem atual: as variantes de texto
 * já mostradas, as marcas das escolhas, as pessoas lembradas e as cadeias em andamento. Uma
 * carreira antiga começa com a memória vazia, do piloto que ela acompanha agora: os cartões que ele
 * viu antes da Fase 5 eram do catálogo antigo, que não existe mais, então nada se repete.
 *
 * Os campos novos de patrocinador (`profileId`, `personality`), de escolha (`unlock`) e de cartão
 * (`storyKey`, `chain`, `speaker`) são opcionais: os saves antigos ficam sem eles, e os cartões
 * pendentes do catálogo antigo continuam resolvíveis.
 *
 * É só de dados e pode rodar duas vezes sem mudar nada na segunda.
 */
type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => value !== null && typeof value === 'object' && !Array.isArray(value);

export function migrateV8(data: Loose): Loose {
  if (isObject(data.story)) return data;
  const driverId = typeof data.playerDriverId === 'string' ? data.playerDriverId : 'player';
  return { ...data, story: { driverId, seen: [], flags: [], people: [], chains: [] } };
}
