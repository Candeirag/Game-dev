/**
 * O passo principal de uma tela (disputar o treino, largar, concluir a etapa).
 *
 * No formato largo (celular deitado, tablet, computador) o botão vai para a barra do passo
 * principal (`ActionBar`): uma faixa fixa no pé da tela, com o botão à direita, ao alcance do
 * polegar, no lugar do atalho padrão da carreira. A página reserva o espaço da barra no fim, então
 * o conteúdo termina acima dela. Na tela em pé o botão fica onde a tela o desenhou.
 */
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { advanceButtonClass, cx } from '@/ui/kit';
import { useChrome } from './chrome';

/** Altura da barra do passo principal, sem a margem da barra de gestos (igual ao `h-14` abaixo). */
export const ACTION_BAR_HEIGHT = '3.5rem';

/**
 * Barra do passo principal: presa ao pé da tela, de ponta a ponta (a partir do trilho lateral, se
 * houver), com 56 px mais a margem da barra de gestos. À direita, o botão; à esquerda, uma linha de
 * contexto opcional. Quem a usa reserva o mesmo espaço no fim da página (`--action-bar-h`).
 */
export function ActionBar({ info, children, visible = true }: { info?: ReactNode; children: ReactNode; visible?: boolean }) {
  return (
    <div
      role="region"
      aria-label="Próximo passo"
      className={cx(
        // Abaixo do painel "Mais" e dos avisos (z-30), acima do conteúdo que rola por baixo dela.
        'fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-20 border-t border-ink-700 bg-ink-900 pb-[var(--safe-bottom)] shadow-bar',
        !visible && 'hidden',
      )}
    >
      {/* Sem trilho (nova carreira), a margem da esquerda respeita o recorte da câmera; com trilho, ele já a inclui. */}
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 pl-[max(1rem,calc(var(--safe-left)-var(--rail-w,0px)))] pr-[calc(0.5rem+var(--safe-right))] lg:pl-[max(1.5rem,calc(var(--safe-left)-var(--rail-w,0px)))] lg:pr-[calc(1.5rem+var(--safe-right))]">
        <div className="min-w-0 flex-1 truncate text-xs text-ink-300">{info}</div>
        {children}
      </div>
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
  const { actionSlot, registerAction } = useChrome();
  // Enquanto este passo estiver na tela, a moldura mostra a barra (mesmo sem o atalho padrão), com o
  // `title` do passo como linha de contexto ("Equipe X · F. Elite" ao lado de "Assinar").
  useEffect(() => (actionSlot ? registerAction(title) : undefined), [actionSlot, registerAction, title]);
  const button = (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cx(advanceButtonClass(tone), !actionSlot && className)}>
      {children}
      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
  return actionSlot ? createPortal(button, actionSlot) : button;
}
