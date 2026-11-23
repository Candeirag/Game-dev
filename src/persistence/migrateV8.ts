/**
 * Migração do save da versão 8 para a 9 (Fase 5 da grande atualização): eventos encadeados.
 *
 * A versão 9 acrescenta `story`, a memória das histórias do personagem atual: as variantes de texto
 * já mostradas, as marcas das escolhas, as pessoas lembradas e as cadeias em andamento. Uma
 * carreira antiga começa sem marcas, pessoas nem cadeias. Os cartões que ela viu antes da Fase 5
 * eram do catálogo antigo, que não existe mais, com uma exceção: os eventos de família e a pergunta
 * da mudança para São Paulo continuam, e a primeira variante de cada um é o texto de antes. Por
 * isso cada um deles que o save já mostrou (no registro de eventos ou pendente) entra na memória
 * como visto, na ordem: a próxima aparição sai com um texto novo.
 *
 * Os campos novos de patrocinador (`profileId`, `personality`), de escolha (`unlock`) e de cartão
 * (`storyKey`, `chain`, `speaker`) são opcionais: os saves antigos ficam sem eles, e os cartões
 * pendentes do catálogo antigo continuam resolvíveis.
 *
 * É só de dados e pode rodar duas vezes sem mudar nada na segunda.
 */
type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Grupo de variantes de um evento que continua depois da Fase 5 (a mesma chave usada em
 * `src/engine/birth/move.ts` e `src/engine/dynasty/familyEvents.ts`), ou null.
 */
function groupOf(definitionId: string): string | null {
  if (definitionId === 'birth-move') return 'birth-move';
  for (const kind of ['partner', 'wedding', 'crisis', 'child']) if (definitionId === `family-${kind}`) return `family-${kind}`;
  if (definitionId.startsWith('family-kart-')) return 'family-kart';
  if (definitionId.startsWith('family-career-')) return 'family-career';
  return null;
}

/** As variantes já mostradas, pela ordem em que os eventos apareceram (do mais antigo ao mais novo). */
function seenFrom(data: Loose): { key: string; season: number; round: number }[] {
  const shown = new Map<string, { season: number; round: number }>();
  // O registro guarda o mais recente primeiro; os pendentes vieram depois de tudo o que está nele.
  const log = Array.isArray(data.eventLog) ? [...data.eventLog].reverse() : [];
  const pending = Array.isArray(data.pendingEvents) ? data.pendingEvents : [];
  for (const event of [...log, ...pending]) {
    if (!isObject(event) || typeof event.id !== 'string' || typeof event.definitionId !== 'string' || shown.has(event.id)) continue;
    if (groupOf(event.definitionId) === null) continue;
    const season = typeof event.season === 'number' && event.season >= 1 ? event.season : 1;
    const round = typeof event.round === 'number' && event.round >= 0 ? event.round : 0;
    shown.set(event.id, { season, round });
  }
  const counts = new Map<string, number>();
  const seen: { key: string; season: number; round: number }[] = [];
  for (const event of [...log, ...pending]) {
    if (!isObject(event) || typeof event.id !== 'string' || typeof event.definitionId !== 'string') continue;
    const when = shown.get(event.id);
    const group = groupOf(event.definitionId);
    if (!when || !group) continue;
    shown.delete(event.id);
    const n = counts.get(group) ?? 0;
    counts.set(group, n + 1);
    seen.push({ key: `${group}#${n}`, ...when });
  }
  return seen;
}

export function migrateV8(data: Loose): Loose {
  if (isObject(data.story)) return data;
  const driverId = typeof data.playerDriverId === 'string' ? data.playerDriverId : 'player';
  return { ...data, story: { driverId, seen: seenFrom(data), flags: [], people: [], chains: [] } };
}
