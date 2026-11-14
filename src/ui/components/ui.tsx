/** Componentes visuais básicos. Apenas apresentação. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { SessionWeather, Team } from '@/domain/schemas';
import { WEATHER_LABELS } from '@/domain/labels';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({ title, action, children, className, padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-ink-700/70 bg-ink-900/80 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-4 py-3">
          {title && <h2 className="font-display text-[15px] font-semibold uppercase tracking-wider text-ink-300">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-apex-500 text-white hover:bg-apex-400 shadow-[0_6px_20px_-8px_var(--color-apex-500)]',
    secondary: 'bg-ink-800 text-ink-100 border border-ink-600 hover:border-ink-400 hover:bg-ink-700',
    ghost: 'text-ink-300 hover:text-ink-100 hover:bg-ink-800',
    danger: 'bg-transparent text-apex-400 border border-apex-600/50 hover:bg-apex-600/15',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-apex-400">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide text-ink-100 sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function TeamSwatch({ team, className }: { team: Pick<Team, 'color'> | undefined; className?: string }) {
  return <span className={cx('inline-block h-3.5 w-1 shrink-0 rounded-full', className)} style={{ backgroundColor: team?.color ?? '#555' }} />;
}

export function WeatherBadge({ weather, compact }: { weather: SessionWeather; compact?: boolean }) {
  const tone = weather.condition === 'dry' ? 'text-gold-400 bg-gold-400/10 border-gold-400/25' : weather.condition === 'damp' ? 'text-sky-300 bg-sky-400/10 border-sky-400/25' : 'text-rain-400 bg-rain-400/15 border-rain-400/30';
  const icon = weather.condition === 'dry' ? '☀' : weather.condition === 'damp' ? '☁' : '☂';
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tabular', tone)}>
      <span aria-hidden>{icon}</span>
      {WEATHER_LABELS[weather.condition]}
      {!compact && <span className="text-ink-300">· {weather.trackTemp}°C</span>}
    </span>
  );
}

export function PositionBadge({ position, dnf }: { position: number; dnf?: boolean }) {
  if (dnf) return <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-ink-800 px-1.5 text-xs font-bold text-ink-400">AB</span>;
  const tone = position === 1 ? 'bg-gold-400 text-ink-950' : position === 2 ? 'bg-silver-300 text-ink-950' : position === 3 ? 'bg-bronze-400 text-ink-950' : position <= 10 ? 'bg-ink-700 text-ink-100' : 'bg-ink-800 text-ink-300';
  return <span className={cx('inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 font-display text-base font-bold tabular', tone)}>{position}</span>;
}

export function RatingBar({ value, previous, max = 100 }: { value: number; previous?: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const prevPct = previous !== undefined ? Math.max(0, Math.min(100, (previous / max) * 100)) : pct;
  const tone = value >= 80 ? 'bg-go-400' : value >= 65 ? 'bg-sky-400' : value >= 50 ? 'bg-gold-400' : 'bg-apex-500';
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink-800">
      <div className={cx('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${Math.min(pct, prevPct)}%` }} />
      {pct > prevPct && <div className="absolute inset-y-0 rounded-r-full bg-go-400/60" style={{ left: `${prevPct}%`, width: `${pct - prevPct}%` }} />}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className={cx('font-display text-2xl font-bold leading-tight tabular', accent ? 'text-apex-400' : 'text-ink-100')}>{value}</div>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-md px-3 py-1.5 text-sm font-semibold transition-colors', value === o.value ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Cartão de opção selecionável, usado nas decisões do jogador. */
export function ChoiceCard({ selected, onSelect, title, description, meta, disabled }: { selected: boolean; onSelect: () => void; title: ReactNode; description: ReactNode; meta?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        'group flex w-full flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-colors',
        selected ? 'border-apex-500 bg-apex-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-500',
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-ink-100">{title}</span>
        <span className={cx('h-4 w-4 shrink-0 rounded-full border-2', selected ? 'border-apex-500 bg-apex-500 shadow-[inset_0_0_0_2px_var(--color-ink-900)]' : 'border-ink-600')} />
      </div>
      <span className="text-sm leading-snug text-ink-300">{description}</span>
      {meta && <span className="text-xs text-ink-400">{meta}</span>}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center">
      <div className="font-display text-lg font-semibold uppercase tracking-wide text-ink-300">{title}</div>
      {children && <div className="mt-2 text-sm text-ink-400">{children}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4">{children}</div>;
}

export const th = 'px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400';
export const td = 'px-2 py-2 text-sm';

/** Medidor de 0 a 100 com rótulo, usado para condição, confiança, interesse e satisfação. */
export function Meter({ label, value, hint, tone }: { label: ReactNode; value: number; hint?: ReactNode; tone?: 'auto' | 'neutral' }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone === 'neutral' ? 'bg-sky-400' : v >= 65 ? 'bg-go-400' : v >= 40 ? 'bg-gold-400' : 'bg-apex-500';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-300">{label}</span>
        <span className="font-semibold tabular">{Math.round(v)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={cx('h-full rounded-full', color)} style={{ width: `${v}%` }} />
      </div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const tones = {
    neutral: 'bg-ink-800 text-ink-300 border-ink-700',
    good: 'bg-go-400/10 text-go-400 border-go-400/30',
    warn: 'bg-gold-400/10 text-gold-400 border-gold-400/30',
    bad: 'bg-apex-600/15 text-apex-400 border-apex-600/40',
    accent: 'bg-apex-500 text-white border-apex-500',
  };
  return <span className={cx('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone])}>{children}</span>;
}

export function Check({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span aria-hidden className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold', met ? 'bg-go-400/20 text-go-400' : 'bg-apex-600/20 text-apex-400')}>{met ? '✓' : '✕'}</span>
      <span className={met ? 'text-ink-300' : 'text-ink-100'}>{children}</span>
    </li>
  );
}
