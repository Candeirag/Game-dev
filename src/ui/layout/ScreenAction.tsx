/**
 * O passo principal de uma tela (disputar o treino, largar, concluir a etapa).
 *
 * No formato largo o botão vai para a barra superior, sempre à direita, no lugar do atalho
 * padrão da carreira. Na tela em pé ele fica onde a tela o desenhou.
 */
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../components/ui';
import { useChrome } from './chrome';

export function ScreenAction({
  children,
  onClick,
  disabled = false,
  tone = 'accent',
  title,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Âmbar quando o passo é resolver uma pendência; vermelho quando é avançar. */
  tone?: 'accent' | 'attention';
  title?: string;
  /** Classes do botão quando ele fica dentro da tela (formato em pé). */
  className?: string;
}) {
  const { actionSlot } = useChrome();
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      // No aplicativo, o passo que avança a carreira vibra um pouco mais forte que os outros toques.
      data-haptic="medium"
      className={cx(
        'chamfer-br flex min-h-11 shrink-0 items-center justify-center gap-1.5 pl-4 pr-3 font-display text-lg font-semibold uppercase leading-none tracking-wide transition-colors [--chamfer:10px] disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400',
        tone === 'attention' ? 'bg-gold-400 text-ink-950 hover:brightness-110' : 'bg-apex-500 text-white hover:bg-apex-400',
        !actionSlot && className,
      )}
    >
      {children}
      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
  return actionSlot ? createPortal(button, actionSlot) : button;
}
