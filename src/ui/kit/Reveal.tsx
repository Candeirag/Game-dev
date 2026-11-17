/**
 * Revelação em sequência: os itens entram um depois do outro, como uma ficha sendo preenchida.
 * Cada um esmaece e sobe um pouco em 300 ms (o teto de movimento do jogo); só o atraso cresce de
 * item em item. Mudar a chave (`revealKey`, por exemplo um novo sorteio) recomeça a sequência.
 *
 * Com menos movimento (pedido ao sistema ou ligado em Ajustes) nada anima: todos os itens aparecem
 * de uma vez, sem atraso nem transição.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from '../motion';
import { useSettings } from '../settings/useSettings';
import { cx } from './cx';

/** Intervalo entre a entrada de um item e a do seguinte, em ms. */
export const REVEAL_STEP_MS = 140;

export interface RevealSequence {
  /** Os itens já devem estar à vista (o estado final da transição). */
  shown: boolean;
  /** Animar: falso com menos movimento. */
  animate: boolean;
}

/** Liga a sequência um quadro depois de montar (ou de mudar a chave), para a transição acontecer. */
export function useRevealSequence(revealKey: string | number): RevealSequence {
  // Lido a cada desenho: mudar o ajuste em Ajustes vale na próxima revelação.
  useSettings();
  const animate = !prefersReducedMotion();
  const [shownKey, setShownKey] = useState<string | number | null>(null);
  useEffect(() => {
    if (!animate) return;
    let second = 0;
    // Dois quadros: o primeiro pinta tudo escondido, o segundo começa as transições.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShownKey(revealKey));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [revealKey, animate]);
  return { shown: !animate || shownKey === revealKey, animate };
}

/** Um item da sequência: entra na posição `index` (0 = o primeiro). */
export function RevealItem({ index, sequence, children, className }: { index: number; sequence: RevealSequence; children: ReactNode; className?: string }) {
  return (
    <div
      data-shown={sequence.shown}
      style={sequence.animate ? { transitionDelay: sequence.shown ? `${index * REVEAL_STEP_MS}ms` : '0ms' } : undefined}
      className={cx(
        sequence.animate
          ? 'translate-y-2 opacity-0 transition-[opacity,translate] duration-(--motion-slow) ease-(--ease-out) data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100'
          : 'transition-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
