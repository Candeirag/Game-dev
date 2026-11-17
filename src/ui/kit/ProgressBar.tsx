/**
 * Barra de progresso de 0 a `max`. O preenchimento nunca é a única informação: quem usa a barra
 * mostra o número ao lado (ver `Meter` e `Gauge`), e a barra tem o valor no rótulo acessível.
 */
import { cx, type Tone } from './cx';

const FILL: Record<Tone, string> = { neutral: 'bg-ink-200', good: 'bg-go-400', attention: 'bg-gold-400', accent: 'bg-apex-400' };

/** Tom automático de um medidor de 0 a 100: verde de 65 para cima, âmbar abaixo de 40. */
export function meterTone(value: number): Tone {
  return value >= 65 ? 'good' : value >= 40 ? 'neutral' : 'attention';
}

export function ProgressBar({
  value,
  max = 100,
  previous,
  tone = 'neutral',
  label,
  ticks = false,
  className,
}: {
  value: number;
  max?: number;
  /** Valor de antes: o trecho ganho desde então aparece em verde. */
  previous?: number;
  tone?: Tone;
  /** Rótulo acessível ("Moral: 62 de 100"). Sem ele, a barra é decorativa e o número ao lado é a informação. */
  label?: string;
  /** Marcas a cada quarto, como numa régua. */
  ticks?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const prevPct = previous !== undefined ? Math.max(0, Math.min(100, (previous / max) * 100)) : pct;
  const bar = (
    <>
      <div className={cx('absolute inset-y-0 left-0', FILL[tone])} style={{ width: `${Math.min(pct, prevPct)}%` }} />
      {pct > prevPct && <div className="absolute inset-y-0 bg-go-400" style={{ left: `${prevPct}%`, width: `${pct - prevPct}%` }} />}
      {ticks && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(25%-1px),var(--color-ink-900)_calc(25%-1px),var(--color-ink-900)_25%,transparent_25%)] bg-[length:25%_100%]"
        />
      )}
    </>
  );
  const box = cx('relative h-2 w-full overflow-hidden bg-ink-700', className);
  return label ? (
    <div className={box} role="img" aria-label={label}>
      {bar}
    </div>
  ) : (
    <div className={box} aria-hidden>
      {bar}
    </div>
  );
}
