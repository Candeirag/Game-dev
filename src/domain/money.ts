/**
 * Formatação de dinheiro: o único lugar do jogo que escreve um valor com
 * símbolo de moeda. O motor (mensagens, eventos, notícias) e a interface usam
 * esta mesma função.
 *
 * A moeda é só apresentação: o símbolo vem da nacionalidade do piloto e os
 * números da economia são os mesmos em qualquer moeda. Não há conversão.
 */
export type Currency = 'BRL' | 'EUR';

export const CURRENCY_SYMBOL: Readonly<Record<Currency, string>> = { BRL: 'R$', EUR: '€' };

/** Piloto brasileiro vê os valores em reais; os demais, em euros. */
export function currencyForNationality(nationality: string): Currency {
  return nationality.toUpperCase() === 'BR' ? 'BRL' : 'EUR';
}

export interface MoneyOptions {
  /** Abrevia acima de 100 mil (R$ 250 mil, R$ 1,25 mi). Padrão: valor completo. */
  compact?: boolean;
  /** Mostra o sinal de mais nos valores positivos. */
  sign?: boolean;
  /** Casas decimais do valor completo (cotações usam 2). Padrão: 0. */
  decimals?: number;
}

/** Valor em formato brasileiro, com o símbolo na frente: R$ 30.000, −R$ 1.200, € 1,25 mi. */
export function formatMoney(value: number, currency: Currency, options: MoneyOptions = {}): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : options.sign && value > 0 ? '+' : '';
  if (options.compact && abs >= 1_000_000) return `${sign}${symbol} ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (options.compact && abs >= 100_000) return `${sign}${symbol} ${Math.round(abs / 1000).toLocaleString('pt-BR')} mil`;
  const decimals = options.decimals ?? 0;
  const amount =
    decimals > 0 ? abs.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(abs).toLocaleString('pt-BR');
  return `${sign}${symbol} ${amount}`;
}

const ANY_SYMBOL = /(?:€|R\$)(?=\s?[-−]?\d)/g;

/**
 * Troca o símbolo de moeda de um texto já pronto (mensagens gravadas em saves
 * de versões anteriores, que só conheciam o euro). Não mexe nos números.
 */
export function relabelMoney(text: string, currency: Currency): string {
  return text.includes('€') || text.includes('R$') ? text.replace(ANY_SYMBOL, CURRENCY_SYMBOL[currency]) : text;
}
