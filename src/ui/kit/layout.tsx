/** Peças de estrutura de tela: cabeçalho, abas, número em destaque, estado vazio e cartão de escolha. */
import { Check as CheckIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

/** Cabeçalho de tela, em uma linha: título, contexto ao lado e ações à direita. */
export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-title font-bold uppercase leading-none tracking-wide text-ink-100">{title}</h1>
        {eyebrow && <div className="text-xs font-medium text-ink-400">{eyebrow}</div>}
      </div>
      {children && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
    </div>
  );
}

/** Um número em destaque com o rótulo em cima. */
export function Stat({ label, value, hint, accent }: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-2xs font-medium text-ink-400">{label}</div>
      <div className={cx('font-display text-2xl font-bold leading-tight', accent ? 'text-apex-400' : 'text-ink-100')}>{value}</div>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

/** Abas. A selecionada tem a chapa mais clara e a barra vermelha embaixo (cor + forma). */
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto bg-ink-900 shadow-frame">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 shrink-0 px-4 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-ink-700 text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-400)]' : 'text-ink-300 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Cartão de opção selecionável, usado nas decisões do jogador. O escolhido ganha contorno vermelho e a caixa marcada. */
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
        'chamfer-br group flex min-h-11 w-full flex-col items-start gap-1 p-4 text-left transition-colors',
        selected ? 'bg-apex-500/15 shadow-ring-accent' : 'bg-ink-800 shadow-ring hover:bg-ink-700',
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-ink-100">{title}</span>
        <span
          aria-hidden
          className={cx('grid h-4 w-4 shrink-0 place-items-center', selected ? 'bg-apex-500 text-white' : 'shadow-[inset_0_0_0_2px_var(--color-ink-500)]')}
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
    <div className="stripes border border-dashed border-ink-600 p-6 text-center">
      <div className="font-display text-lg font-semibold uppercase tracking-wide text-ink-200">{title}</div>
      {children && <div className="mt-2 text-sm text-ink-400">{children}</div>}
    </div>
  );
}

/** Requisito cumprido (verde, com visto) ou em falta (âmbar, com xis). */
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
