/**
 * Cartão: uma chapa de canto chanfrado, com barra de título opcional. A moldura é a chapa de
 * baixo aparecendo 1 px em volta, o que mantém a linha também no chanfro.
 */
import type { ReactNode } from 'react';
import { cx, type Tone } from './cx';

const EDGE: Record<Tone, string> = {
  neutral: 'bg-ink-700',
  good: 'bg-go-400/60',
  attention: 'bg-gold-400/70',
  accent: 'bg-apex-400/80',
};

export interface CardProps {
  title?: ReactNode;
  /** Conteúdo à direita da barra de título (um link, um contador). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
  /** Cor da moldura: só muda quando o cartão inteiro tem um estado (pendência, fechamento de temporada). */
  tone?: Tone;
}

export function Card({ title, action, children, className, bodyClassName, padded = true, tone = 'neutral' }: CardProps) {
  return (
    <section className={cx('chamfer p-px', EDGE[tone], className)}>
      <div className="chamfer flex h-full flex-col bg-ink-900">
        {(title || action) && (
          <header className="flex min-h-10 shrink-0 items-center justify-between gap-4 bg-ink-800 pl-4 pr-2">
            {title && <h2 className="font-display text-base font-semibold uppercase leading-none tracking-[0.06em] text-ink-200">{title}</h2>}
            {action}
          </header>
        )}
        <div className={cx('min-h-0 flex-1', padded && 'p-4', bodyClassName)}>{children}</div>
      </div>
    </section>
  );
}

/** O mesmo cartão, com o nome usado nas telas refeitas; `flush` tira o espaçamento interno. */
export function Panel({ flush = false, ...props }: Omit<CardProps, 'padded'> & { flush?: boolean }) {
  return <Card {...props} padded={!flush} />;
}
