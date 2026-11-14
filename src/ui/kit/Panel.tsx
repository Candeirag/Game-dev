/**
 * Painel: a superfície básica do "muro dos boxes". É uma chapa de canto chanfrado, com uma
 * barra de título opcional. A borda é a própria chapa de baixo aparecendo 1 px em volta, o
 * que mantém a linha também no chanfro (uma borda comum seria cortada junto com o canto).
 */
import type { ReactNode } from 'react';
import { cx } from '../components/ui';

export type Tone = 'neutral' | 'good' | 'attention' | 'accent';

const EDGE: Record<Tone, string> = {
  neutral: 'bg-ink-700',
  good: 'bg-go-400/60',
  attention: 'bg-gold-400/70',
  accent: 'bg-apex-500/80',
};

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  tone = 'neutral',
  flush = false,
}: {
  title?: ReactNode;
  /** Conteúdo à direita da barra de título (um link, um contador). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Cor da borda: só muda quando o painel inteiro tem um estado (pendência, por exemplo). */
  tone?: Tone;
  /** Sem espaçamento interno (listas e tabelas que vão de borda a borda). */
  flush?: boolean;
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
        <div className={cx('min-h-0 flex-1', !flush && 'p-4', bodyClassName)}>{children}</div>
      </div>
    </section>
  );
}

const TAG: Record<Tone, string> = {
  neutral: 'bg-ink-700 text-ink-200',
  good: 'bg-go-400/15 text-go-400',
  attention: 'bg-gold-400/15 text-gold-400',
  accent: 'bg-apex-500 text-white',
};

/** Etiqueta de estado. A cor tem significado fixo: verde é bom, âmbar pede atenção. */
export function Tag({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('chamfer-br inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold leading-none [--chamfer:6px]', TAG[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
