/** Controles de ajuste: interruptor, escolha entre poucas opções e controle deslizante. Todos com 44 px de toque. */
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Interruptor de liga e desliga. O estado aparece de três jeitos: a posição do botão, o visto e
 * o texto "Ligado"/"Desligado" (não só a cor).
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cx('flex min-h-12 items-center gap-4 py-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-100">{label}</span>
        {hint && <span className="mt-1 block text-xs leading-snug text-ink-400">{hint}</span>}
      </span>
      <span className="w-20 shrink-0 text-right text-xs font-semibold text-ink-300">{checked ? 'Ligado' : 'Desligado'}</span>
      <span className="relative inline-flex h-11 w-14 shrink-0 items-center">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          // A caixa nativa cobre a área de toque inteira, invisível (o desenho é o trilho ao lado). O
          // estilo vai na linha porque a regra geral de "desativado" pinta fundo e contorno.
          className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] appearance-none"
          style={{ opacity: 0, background: 'none', boxShadow: 'none' }}
        />
        <span
          aria-hidden
          className={cx(
            'pointer-events-none flex h-7 w-14 items-center px-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-apex-400',
            disabled ? 'stripes bg-ink-800 shadow-ring' : checked ? 'bg-apex-500' : 'bg-ink-800 shadow-ring',
          )}
        >
          <span
            className={cx(
              'grid h-5 w-5 place-items-center transition-[translate] duration-(--motion-fast)',
              checked ? 'translate-x-7 bg-white text-apex-600' : 'translate-x-0 bg-ink-300 text-ink-300',
            )}
          >
            {checked && <Check size={14} strokeWidth={3} />}
          </span>
        </span>
      </span>
    </label>
  );
}

/** Escolha entre poucas opções, lado a lado. A escolhida tem contorno vermelho, chapa tingida e o visto. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  /** Nome do grupo para leitores de tela. */
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'chamfer-br flex min-h-11 min-w-24 flex-1 items-center justify-center gap-1 px-4 text-sm font-semibold transition-colors',
              selected ? 'bg-apex-500/15 text-ink-100 shadow-ring-accent' : 'bg-ink-800 text-ink-200 shadow-ring hover:bg-ink-700',
            )}
          >
            {selected && <Check size={14} strokeWidth={3} aria-hidden className="shrink-0 text-apex-400" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Controle deslizante de 0 a 100, com o valor escrito ao lado. */
export function Slider({
  value,
  onChange,
  label,
  step = 10,
  suffix = '%',
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex min-h-12 items-center gap-4">
      <span className="w-20 shrink-0 text-sm font-semibold text-ink-100">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 min-w-0 flex-1 cursor-pointer accent-apex-400"
      />
      <span className="w-12 shrink-0 text-right font-display text-lg font-semibold leading-none">
        {value}
        {suffix}
      </span>
    </label>
  );
}
