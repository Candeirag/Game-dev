/**
 * Chip: etiqueta curta de estado. A cor tem significado fixo (verde é bom, âmbar pede atenção)
 * e nunca vai sozinha: o chip sempre traz o texto e, quando pede atenção, o ícone de alerta.
 */
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx, type Tone } from './cx';

const CHIP: Record<Tone, string> = {
  neutral: 'bg-ink-700 text-ink-100',
  good: 'bg-go-400/15 text-go-400',
  attention: 'bg-gold-400/15 text-gold-400',
  accent: 'bg-apex-500 text-white',
};

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  size = 'md',
}: {
  tone?: Tone;
  /** Ícone à esquerda. Sem ele, o chip de atenção usa o triângulo de alerta; `null` tira o ícone. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const shown = icon === undefined && tone === 'attention' ? <TriangleAlert size={12} strokeWidth={2.5} aria-hidden className="shrink-0" /> : icon;
  return (
    <span
      className={cx(
        'chamfer-br inline-flex items-center gap-1 px-2 py-1 font-semibold leading-none [--chamfer:var(--chamfer-sm)]',
        size === 'sm' ? 'text-2xs' : 'text-xs',
        CHIP[tone],
        className,
      )}
    >
      {shown}
      {children}
    </span>
  );
}

/** Nomes antigos do chip, mantidos para as telas que já os usavam. */
export const Tag = Chip;

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  return (
    <Chip size="sm" tone={tone === 'warn' || tone === 'bad' ? 'attention' : tone}>
      {children}
    </Chip>
  );
}
