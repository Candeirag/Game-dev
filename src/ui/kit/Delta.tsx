/**
 * Indicador de variação: sempre uma seta e um sinal, nunca só a cor. "▲ +2,5" subiu; "▼ −R$ 4 mil"
 * caiu; "= 0" ficou igual. Em posições, a seta já diz o sentido e o número vai sem sinal (▲ 2).
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

function Arrow({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  return (
    <svg viewBox="0 0 10 10" width="0.7em" height="0.7em" aria-hidden className="shrink-0 fill-current">
      {direction === 'up' && <path d="M5 1 9.5 9h-9z" />}
      {direction === 'down' && <path d="M5 9 .5 1h9z" />}
      {direction === 'flat' && <path d="M1 2.5h8v1.6H1zM1 6h8v1.6H1z" />}
    </svg>
  );
}

export function Delta({
  value,
  format,
  suffix,
  signless = false,
  goodWhen = 'up',
  showZero = false,
  threshold = 0.05,
  className,
}: {
  /** A diferença: positiva subiu, negativa caiu. */
  value: number;
  /** Como escrever o tamanho da diferença (recebe o valor absoluto). Padrão: uma casa, com vírgula. */
  format?: (absolute: number) => string;
  suffix?: ReactNode;
  /** Sem sinal de mais ou de menos (posições: a seta basta). */
  signless?: boolean;
  /** Qual sentido é o bom: `up` (atributos, caixa) ou `down` (tempo de volta, custo). `none`: sem juízo de valor. */
  goodWhen?: 'up' | 'down' | 'none';
  /** Mostra "= 0" quando não mudou (o padrão é não mostrar nada). */
  showZero?: boolean;
  /** Abaixo disso, conta como "não mudou". */
  threshold?: number;
  className?: string;
}) {
  const flat = Math.abs(value) < threshold;
  if (flat && !showZero) return null;
  const direction = flat ? 'flat' : value > 0 ? 'up' : 'down';
  const good = goodWhen === 'none' || flat ? null : value > 0 === (goodWhen === 'up');
  const amount = (format ?? ((v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })))(Math.abs(value));
  const sign = flat || signless ? '' : value > 0 ? '+' : '−';
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold', good === null ? 'text-ink-300' : good ? 'text-go-400' : 'text-gold-400', className)}>
      <Arrow direction={direction} />
      <span className="sr-only">{flat ? 'sem mudança: ' : value > 0 ? 'subiu ' : 'caiu '}</span>
      <span>
        {sign}
        {flat ? '0' : amount}
        {suffix}
      </span>
    </span>
  );
}
