/**
 * Migração do save da versão 4 para a 5 (Fase 1): retrato das temporadas.
 *
 * A versão 5 acrescenta `seasonTrend`, a lista com um retrato de cada temporada fechada
 * (atributos do piloto, nota geral, caixa e patrimônio), usada pelos gráficos pequenos de
 * tendência. Nenhuma regra do jogo lê esse campo.
 *
 * Um save antigo não tem como recuperar os atributos de temporadas passadas, então a lista
 * começa vazia: os gráficos mostram o ponto de hoje e ganham um ponto a cada temporada fechada
 * dali em diante. Nada mais no save é tocado.
 *
 * É uma migração só de dados: não chama o motor do jogo e pode rodar duas vezes sem mudar nada
 * na segunda.
 */
type Loose = Record<string, unknown>;

export function migrateV4(data: Loose): Loose {
  return { ...data, seasonTrend: Array.isArray(data.seasonTrend) ? data.seasonTrend : [] };
}
