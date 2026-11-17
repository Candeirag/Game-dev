/**
 * Botões. Todos têm área de toque de 44 px no mínimo (48 com `size="lg"`) e texto em Inter.
 *
 * - primário: a ação principal da tela (vermelho cheio, texto branco);
 * - secundário: as demais ações (chapa alta com contorno);
 * - perigo: o que não tem volta ou custa caro (contorno âmbar; peça confirmação);
 * - discreto (`ghost`): ações de apoio dentro de uma lista;
 * - desativado: o atributo `disabled` de qualquer um deles (chapa listrada; ver src/index.css).
 */
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-apex-500 text-white hover:bg-apex-600',
  secondary: 'bg-ink-800 text-ink-100 shadow-ring hover:bg-ink-700',
  ghost: 'text-ink-200 hover:bg-ink-800 hover:text-ink-100',
  danger: 'text-gold-400 shadow-[inset_0_0_0_1px_var(--color-gold-400)] hover:bg-gold-400/10',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'chamfer-br inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors',
        size === 'lg' ? 'min-h-12' : 'min-h-11',
        VARIANT[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Classes do botão que faz a carreira avançar (o passo principal da tela): maior, em fonte de
 * título. Vermelho quando é avançar; âmbar quando o passo é resolver uma pendência.
 */
export function advanceButtonClass(tone: 'accent' | 'attention'): string {
  return cx(
    'chamfer-br flex min-h-12 shrink-0 items-center justify-center gap-2 pl-4 pr-2 font-display text-lg font-semibold uppercase leading-none tracking-wide transition-colors [--chamfer:10px]',
    tone === 'attention' ? 'bg-gold-400 text-ink-950 hover:brightness-110' : 'bg-apex-500 text-white hover:bg-apex-600',
  );
}
