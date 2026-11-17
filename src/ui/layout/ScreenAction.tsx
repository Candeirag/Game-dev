/**
 * O passo principal de uma tela (disputar o treino, largar, concluir a etapa).
 *
 * No formato largo (celular deitado, tablet, computador) o botão fica sempre no canto inferior
 * direito, ao alcance do polegar, no lugar do atalho padrão da carreira (`ActionDock`). Na tela
 * em pé ele fica onde a tela o desenhou.
 */
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { advanceButtonClass, cx } from '@/ui/kit';
import { useChrome } from './chrome';

/**
 * Doca do botão principal: presa ao canto inferior direito, dentro das margens de segurança do
 * aparelho (barra de gestos e recorte da câmera). `raised` a sobe para cima da barra de comandos
 * da corrida.
 */
export function ActionDock({ children, raised = false }: { children: ReactNode; raised?: boolean }) {
  return (
    <div
      className={cx(
        'pointer-events-none fixed right-[calc(0.75rem+var(--safe-right))] z-30 flex justify-end drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] *:pointer-events-auto',
        raised ? 'bottom-[calc(5.25rem+var(--safe-bottom))]' : 'bottom-[calc(0.75rem+var(--safe-bottom))]',
      )}
    >
      {children}
    </div>
  );
}

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
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cx(advanceButtonClass(tone), !actionSlot && className)}>
      {children}
      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
  return actionSlot ? createPortal(button, actionSlot) : button;
}
