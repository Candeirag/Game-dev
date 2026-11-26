/** Pequenos ajudantes de texto em português, usados pelo motor e pela interface. */

/** Valor numérico de uma contagem que pode vir já formatada ("1,5" ou "1.5"). */
function numeric(count: number | string): number {
  return typeof count === 'number' ? count : Number(count.replace(',', '.'));
}

/** A palavra no singular ou no plural: singular para quantidades entre zero e dois (1 ponto, 1,5 ponto), plural para zero e de dois em diante. */
export function pluralWord(count: number | string, singular: string, plural: string): string {
  const value = Math.abs(numeric(count));
  return value > 0 && value < 2 ? singular : plural;
}

const STORED_PLURAL = /(\d+(?:[.,]\d+)?) ([a-zà-ú]+)\((s|ns)\)(?: ([a-zà-ú]+)\(s\))?/gi;

/**
 * Acerta o plural de textos gravados por versões anteriores, que escreviam "2 ponto(s)" e
 * "1 ultrapassagem(ns)". O número que vem antes da palavra decide a forma.
 */
export function fixStoredPlurals(text: string): string {
  if (!text.includes('(s)') && !text.includes('(ns)')) return text;
  return text.replace(STORED_PLURAL, (_match, count: string, word: string, suffix: string, second: string | undefined) => {
    const many = pluralWord(count, '', 's') === 's';
    const first = !many ? word : suffix === 'ns' ? `${word.slice(0, -1)}ns` : `${word}s`;
    return `${count} ${first}${second ? ` ${second}${many ? 's' : ''}` : ''}`;
  });
}

/** Primeira letra em maiúscula, para abrir uma frase com um trecho montado ("do Grand Prix…" → "Do Grand Prix…"). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ordem fixa entre dois textos, pelo código de cada caractere. É o desempate do motor para ids:
 * dá o mesmo resultado em qualquer aparelho e idioma, ao contrário de `localeCompare`, que segue
 * o idioma do sistema (em tcheco ou dinamarquês, por exemplo, a ordem das letras é outra) e faria
 * a mesma carreira ter resultados diferentes de um celular para outro.
 */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Meta de posição de uma equipe, em frase: "em 1º lugar" quando a meta é a liderança, "entre as
 * 3 primeiras" nas demais ("entre as 1 primeiras" não existe).
 */
export function amongTheFirst(position: number): string {
  return position <= 1 ? 'em 1º lugar' : `entre as ${position} primeiras`;
}

/** Quantidade seguida da palavra na forma certa: "1 ponto", "4 ultrapassagens", "0 vitórias". */
export function counted(count: number | string, singular: string, plural: string): string {
  return `${count} ${pluralWord(count, singular, plural)}`;
}

/** Itens em frase: "A", "A e B", "A, B e C" (vazio para nenhum). */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
