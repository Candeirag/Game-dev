/**
 * Movimento da interface. Três regras valem para o jogo todo:
 *
 * 1. Entradas e saídas são curtas (150 a 300 ms; ver os tokens em src/ui/tokens.css).
 * 2. São transições de CSS, não animações com quadros-chave: se o jogador muda de ideia no
 *    meio (abre e fecha em seguida), a transição volta de onde estava, sem esperar terminar.
 * 3. Quem pede menos movimento (ao sistema, por `prefers-reduced-motion`, ou em Ajustes) não vê
 *    nada deslizar nem crescer: o que entra e sai só esmaece, em 150 ms.
 *
 * Indicador de progresso só aparece onde há espera de verdade (abrir um save, carregar imagens).
 * Dados que já estão no aparelho aparecem direto, sem esqueleto nem carregando.
 */
import { useEffect, useState } from 'react';
import { reducedMotion } from './settings/settings';

/** Duração padrão de uma saída, em ms (igual a --motion-base no CSS). */
export const EXIT_MS = 220;
/** Duração da saída para quem pede menos movimento: só o esmaecer (igual a --motion-fast). */
export const REDUCED_EXIT_MS = 150;

/** Menos movimento: pedido ao sistema ou ligado em Ajustes. */
export function prefersReducedMotion(): boolean {
  if (reducedMotion()) return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Rolagem suave até um elemento; instantânea para quem pede menos movimento. */
export function scrollToElement(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Presença de um elemento que entra e sai com transição.
 *
 * `mounted` diz se ele deve estar na página; `shown` vira true um quadro depois de montar (o que
 * dispara a transição de entrada) e false na hora de sair, com o elemento ainda montado até a
 * transição de saída acabar. Reabrir durante a saída só inverte a transição em curso.
 */
export function usePresence(open: boolean, exitMs: number = EXIT_MS): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Dois quadros: o primeiro pinta o estado inicial, o segundo começa a transição.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? Math.min(exitMs, REDUCED_EXIT_MS) : exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted, shown };
}
