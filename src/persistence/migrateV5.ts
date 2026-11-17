/**
 * Migração do save da versão 5 para a 6 (Fase 2 da grande atualização): nascimento.
 *
 * A versão 6 acrescenta `birth`, o nascimento sorteado do piloto (família, corpo e mente,
 * talentos e defeitos ocultos). Uma carreira começada antes disso não teve sorteio, e inventar um
 * agora mudaria o piloto e a sorte de quem já está jogando. Por isso o save antigo fica com
 * `birth: null`: nenhum efeito de nascença, nenhum traço oculto, nenhuma mudança de cidade. A
 * carreira continua exatamente como era.
 *
 * É uma migração só de dados: não chama o motor do jogo e pode rodar duas vezes sem mudar nada
 * na segunda.
 */
type Loose = Record<string, unknown>;

export function migrateV5(data: Loose): Loose {
  return { ...data, birth: data.birth !== undefined && data.birth !== null && typeof data.birth === 'object' ? data.birth : null };
}
