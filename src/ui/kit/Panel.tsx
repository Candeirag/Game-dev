/**
 * Painel e etiqueta do visual "muro dos boxes". O painel é o mesmo cartão de
 * `components/ui.tsx`; fica aqui com o nome usado nas telas refeitas.
 */
import type { ReactNode } from 'react';
import { Card, cx, type Tone } from '../components/ui';

export type { Tone };

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
    <Card title={title} action={action} className={className} bodyClassName={bodyClassName} padded={!flush} tone={tone}>
      {children}
    </Card>
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
