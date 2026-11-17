/** Medidores: uma barra de progresso sempre acompanhada do número. */
import type { ReactNode } from 'react';
import type { Tone } from './cx';
import { ProgressBar, meterTone } from './ProgressBar';

/** Barra de atributo de 0 a 100. O trecho ganho desde o começo da temporada aparece em verde (e o número da variação vai ao lado). */
export function RatingBar({ value, previous, max = 100 }: { value: number; previous?: number; max?: number }) {
  return <ProgressBar value={value} previous={previous} max={max} />;
}

/** Medidor de 0 a 100 com rótulo em cima, usado para condição, confiança, interesse e satisfação. */
export function Meter({ label, value, hint, tone }: { label: ReactNode; value: number; hint?: ReactNode; tone?: 'auto' | 'neutral' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="text-ink-300">{label}</span>
        <span className="font-display text-lg font-semibold leading-none">{Math.round(v)}</span>
      </div>
      <ProgressBar value={v} tone={tone === 'neutral' ? 'neutral' : meterTone(v)} />
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

/** Medidor de 0 a 100 em uma linha: rótulo, barra com marcas e o número. */
export function Gauge({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 shrink-0 text-ink-300">{label}</span>
      <ProgressBar value={v} tone={tone ?? meterTone(v)} ticks label={`${label}: ${Math.round(v)} de 100`} className="min-w-0 flex-1" />
      <span className="w-7 shrink-0 text-right font-display text-lg font-semibold leading-none">{Math.round(v)}</span>
    </div>
  );
}
