/**
 * Migração do save da versão 7 para a 8 (Fase 4 da grande atualização): corrida com lances.
 *
 * A versão 8 acrescenta:
 * - `moments` no resultado de cada corrida: os lances decisivos do jogador. As corridas disputadas
 *   antes da Fase 4 não tiveram lances e ficam com a lista vazia, onde quer que o resultado esteja
 *   guardado (etapas da temporada, histórico das temporadas e o balanço do dirigente);
 * - `relations.rivalryLog`: os toques em lances que criaram rivalidade, para a Fase 5 usar. Uma
 *   carreira antiga começa sem registro; a intensidade das rivalidades (`rivalries`) não muda.
 *
 * É só de dados e pode rodar duas vezes sem mudar nada na segunda.
 */
type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => value !== null && typeof value === 'object' && !Array.isArray(value);

function migrateRound(round: unknown): unknown {
  if (!isObject(round) || !isObject(round.race)) return round;
  if (Array.isArray(round.race.moments)) return round;
  return { ...round, race: { ...round.race, moments: [] } };
}

const migrateRounds = (rounds: unknown): unknown => (Array.isArray(rounds) ? rounds.map(migrateRound) : rounds);

export function migrateV7(data: Loose): Loose {
  const relations = isObject(data.relations)
    ? { ...data.relations, rivalryLog: Array.isArray(data.relations.rivalryLog) ? data.relations.rivalryLog : [] }
    : data.relations;
  const history = Array.isArray(data.history)
    ? data.history.map((season) => (isObject(season) ? { ...season, rounds: migrateRounds(season.rounds) } : season))
    : data.history;
  const offseason = data.executiveOffseason;
  const executiveOffseason =
    isObject(offseason) && isObject(offseason.summary)
      ? { ...offseason, summary: { ...offseason.summary, rounds: migrateRounds(offseason.summary.rounds) } }
      : offseason;
  return { ...data, relations, rounds: migrateRounds(data.rounds), history, executiveOffseason };
}
