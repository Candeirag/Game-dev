import { useEffect } from 'react';
import { scrollToElement } from '../motion';

/**
 * Lista e detalhe (propostas, calendário, histórico): quando o jogador escolhe um item e o painel
 * de detalhe está fora da tela (embaixo da lista, na tela em pé), a página rola até ele. Com os
 * dois lado a lado, nada se mexe.
 */
export function useReveal(id: string, chosen: string | number | null): void {
  useEffect(() => {
    if (chosen === null) return;
    const box = document.getElementById(id)?.getBoundingClientRect();
    if (box && (box.top > window.innerHeight - 120 || box.bottom < 120)) scrollToElement(id);
  }, [id, chosen]);
}
