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

/** Quantidade seguida da palavra na forma certa: "1 ponto", "4 ultrapassagens", "0 vitórias". */
export function counted(count: number | string, singular: string, plural: string): string {
  return `${count} ${pluralWord(count, singular, plural)}`;
}
