/**
 * Componentes visuais básicos, no visual "muro dos boxes". Apenas apresentação.
 *
 * As cores têm significado fixo: vermelho é a ação principal e o jogador; verde é bom; âmbar
 * pede atenção. Tudo o mais é neutro. Áreas de toque têm no mínimo 44 px.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check as CheckIcon, Cloud, CloudRain, Sun, X } from 'lucide-react';
import type { SessionWeather, Team } from '@/domain/schemas';
import { WEATHER_LABELS } from '@/domain/labels';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type Tone = 'neutral' | 'good' | 'attention' | 'accent';

const EDGE: Record<Tone, string> = {
  neutral: 'bg-ink-700',
  good: 'bg-go-400/60',
  attention: 'bg-gold-400/70',
  accent: 'bg-apex-500/80',
};

/**
 * Cartão: uma chapa de canto chanfrado, com barra de título opcional. A borda é a chapa de baixo
 * aparecendo 1 px em volta, o que mantém a linha também no chanfro.
 */
export function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
  padded = true,
  tone = 'neutral',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
  /** Cor da borda: só muda quando o cartão inteiro tem um estado (pendência, fechamento de temporada). */
  tone?: Tone;
}) {
  return (
    <section className={cx('chamfer p-px', EDGE[tone], className)}>
      <div className="chamfer flex h-full flex-col bg-ink-900">
        {(title || action) && (
          <header className="flex min-h-9 shrink-0 items-center justify-between gap-3 bg-ink-800 pl-4 pr-3">
            {title && <h2 className="font-display text-[15px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-200">{title}</h2>}
            {action}
          </header>
        )}
        <div className={cx('min-h-0 flex-1', padded && 'p-4', bodyClassName)}>{children}</div>
      </div>
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-apex-500 text-white hover:bg-apex-400',
    secondary: 'bg-ink-800 text-ink-100 shadow-[inset_0_0_0_1px_var(--color-ink-600)] hover:bg-ink-700',
    ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
    danger: 'text-gold-400 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-gold-400)_55%,transparent)] hover:bg-gold-400/10',
  };
  return (
    <button
      type="button"
      className={cx(
        'chamfer-br inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Cabeçalho de tela, em uma linha: título, contexto ao lado e ações à direita. */
export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="font-display text-[1.75rem] font-bold uppercase leading-none tracking-wide text-ink-100">{title}</h1>
        {eyebrow && <div className="text-xs font-medium text-ink-400">{eyebrow}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
    </div>
  );
}

/** Faixa com a cor da equipe: é a identidade dela em listas e tabelas. */
export function TeamSwatch({ team, className }: { team: Pick<Team, 'color'> | undefined; className?: string }) {
  return <span className={cx('inline-block h-3.5 w-1 shrink-0', className)} style={{ backgroundColor: team?.color ?? '#626e7f' }} />;
}

const TAG: Record<Tone, string> = {
  neutral: 'bg-ink-700 text-ink-200',
  good: 'bg-go-400/15 text-go-400',
  attention: 'bg-gold-400/15 text-gold-400',
  accent: 'bg-apex-500 text-white',
};

/** Etiqueta de estado. */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const mapped: Tone = tone === 'warn' || tone === 'bad' ? 'attention' : tone;
  return (
    <span className={cx('chamfer-br inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold leading-none [--chamfer:5px]', TAG[mapped])}>
      {children}
    </span>
  );
}

/** Previsão do tempo: ícone, condição e temperatura da pista. Pista molhada pede atenção. */
export function WeatherBadge({ weather, compact }: { weather: SessionWeather; compact?: boolean }) {
  const Icon = weather.condition === 'dry' ? Sun : weather.condition === 'damp' ? Cloud : CloudRain;
  return (
    <span
      className={cx(
        'chamfer-br inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold leading-none [--chamfer:5px]',
        TAG[weather.condition === 'dry' ? 'neutral' : 'attention'],
      )}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {WEATHER_LABELS[weather.condition]}
      {!compact && <span className="font-normal opacity-80">{weather.trackTemp}°C</span>}
    </span>
  );
}

/** Posição de chegada: pódio em verde, abandono em âmbar. */
export function PositionBadge({ position, dnf }: { position: number; dnf?: boolean }) {
  if (dnf) return <span className="inline-grid h-7 min-w-9 place-items-center bg-gold-400/15 px-1.5 font-display text-sm font-semibold text-gold-400">AB</span>;
  const tone = position <= 3 ? 'bg-go-400/15 text-go-400' : position <= 10 ? 'bg-ink-700 text-ink-100' : 'bg-ink-800 text-ink-300';
  return <span className={cx('inline-grid h-7 min-w-9 place-items-center px-1.5 font-display text-lg font-bold leading-none', tone)}>{position}</span>;
}

/** Barra de atributo de 0 a 100. O trecho ganho desde o começo da temporada aparece em verde. */
export function RatingBar({ value, previous, max = 100 }: { value: number; previous?: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const prevPct = previous !== undefined ? Math.max(0, Math.min(100, (previous / max) * 100)) : pct;
  return (
    <div className="relative h-2 w-full overflow-hidden bg-ink-800">
      <div className="absolute inset-y-0 left-0 bg-ink-200" style={{ width: `${Math.min(pct, prevPct)}%` }} />
      {pct > prevPct && <div className="absolute inset-y-0 bg-go-400" style={{ left: `${prevPct}%`, width: `${pct - prevPct}%` }} />}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-ink-400">{label}</div>
      <div className={cx('font-display text-2xl font-bold leading-tight', accent ? 'text-apex-400' : 'text-ink-100')}>{value}</div>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)]">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 shrink-0 px-4 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-ink-700 text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Cartão de opção selecionável, usado nas decisões do jogador. */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        'chamfer-br group flex min-h-11 w-full flex-col items-start gap-1 p-3 text-left transition-colors disabled:opacity-40',
        selected
          ? 'bg-apex-500/15 shadow-[inset_0_0_0_1px_var(--color-apex-500)]'
          : 'bg-ink-800 shadow-[inset_0_0_0_1px_var(--color-ink-600)] hover:bg-ink-700',
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-ink-100">{title}</span>
        <span
          aria-hidden
          className={cx('grid h-4 w-4 shrink-0 place-items-center', selected ? 'bg-apex-500 text-white' : 'shadow-[inset_0_0_0_2px_var(--color-ink-600)]')}
        >
          {selected && <CheckIcon size={12} strokeWidth={3} />}
        </span>
      </span>
      <span className="text-sm leading-snug text-ink-300">{description}</span>
      {meta && <span className="text-xs text-ink-400">{meta}</span>}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="stripes border border-dashed border-ink-700 p-6 text-center">
      <div className="font-display text-lg font-semibold uppercase tracking-wide text-ink-200">{title}</div>
      {children && <div className="mt-2 text-sm text-ink-400">{children}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4">{children}</div>;
}

export const th = 'px-2 py-2 text-left text-[11px] font-medium text-ink-400';
export const td = 'px-2 py-2 text-sm';

/** Medidor de 0 a 100 com rótulo, usado para condição, confiança, interesse e satisfação. */
export function Meter({ label, value, hint, tone }: { label: ReactNode; value: number; hint?: ReactNode; tone?: 'auto' | 'neutral' }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone === 'neutral' ? 'bg-ink-200' : v >= 65 ? 'bg-go-400' : v >= 40 ? 'bg-ink-200' : 'bg-gold-400';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-300">{label}</span>
        <span className="font-display text-lg font-semibold leading-none">{Math.round(v)}</span>
      </div>
      <div className="h-2 w-full bg-ink-800">
        <div className={cx('h-full', color)} style={{ width: `${v}%` }} />
      </div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

/** Requisito cumprido (verde) ou em falta (âmbar). */
export function Check({ met, children }: { met: boolean; children: ReactNode }) {
  const Icon = met ? CheckIcon : X;
  return (
    <li className="flex items-start gap-2 text-sm">
      <span aria-hidden className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center', met ? 'bg-go-400/20 text-go-400' : 'bg-gold-400/20 text-gold-400')}>
        <Icon size={12} strokeWidth={3} />
      </span>
      <span className={met ? 'text-ink-300' : 'text-ink-100'}>{children}</span>
      <span className="sr-only">{met ? '(cumprido)' : '(em falta)'}</span>
    </li>
  );
}
