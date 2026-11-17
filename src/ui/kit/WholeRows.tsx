/**
 * Lista rolável que nunca para com uma linha cortada: a altura visível é sempre um número inteiro
 * de linhas, o fim da lista também cai numa divisa de linha e, quando o jogador termina de rolar,
 * ela assenta no começo da linha mais próxima. Feita para a torre da corrida, em que a linha do
 * jogador gruda no pé (ou no alto) da lista: sem isso, a linha vizinha aparecia pela metade.
 *
 * As linhas são os elementos com `data-row` (todas da mesma altura). O que vier depois delas (a
 * legenda, por exemplo) ganha um respiro embaixo até completar uma linha inteira. O espaço que
 * sobra abaixo da lista, menor que uma linha, fica vazio.
 *
 * O assentamento é feito aqui, ao fim da rolagem do jogador, e não com `scroll-snap`: o encaixe
 * do navegador realinha a lista sozinho quando as linhas trocam de lugar (a cada ultrapassagem a
 * torre "andava" atrás de um piloto) e não sabe lidar com a linha que gruda. Pelo mesmo motivo a
 * âncora de rolagem do navegador fica desligada.
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../motion';
import { cx } from './cx';

interface Fit {
  height: number;
  pad: number;
}

/** Quanto tempo sem rolar conta como "o jogador parou" (o mesmo que o evento `scrollend`). */
const SETTLE_MS = 120;

export function WholeRows({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pad = useRef(0);
  const rowHeight = useRef(0);
  const [fit, setFit] = useState<Fit | null>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const list = content.current;
    if (!box || !list) return;
    const measure = () => {
      const row = list.querySelector<HTMLElement>('[data-row]');
      const height = row?.getBoundingClientRect().height ?? 0;
      rowHeight.current = height;
      if (height <= 0 || box.clientHeight <= 0) {
        setFit((old) => (old === null ? old : null));
        return;
      }
      const rows = Math.max(1, Math.floor((box.clientHeight + 0.5) / height));
      // Altura natural do conteúdo (sem o respiro que esta lista mesma pôs no fim).
      const natural = list.getBoundingClientRect().height - pad.current;
      const rest = natural % height;
      const nextPad = rest < 0.5 || height - rest < 0.5 ? 0 : height - rest;
      pad.current = nextPad;
      const next = { height: rows * height, pad: nextPad };
      setFit((old) => (old && Math.abs(old.height - next.height) < 0.5 && Math.abs(old.pad - next.pad) < 0.5 ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // Quando o jogador para de rolar, a lista assenta no começo da linha mais próxima.
  useLayoutEffect(() => {
    const list = scroller.current;
    if (!list) return;
    let timer = 0;
    // Sem trava: depois do assentamento a lista já está numa divisa e `settle` não faz nada; se o
    // jogador interromper a animação rolando de novo, a próxima parada assenta de onde ele deixou.
    const settle = () => {
      const height = rowHeight.current;
      if (height <= 0) return;
      const max = list.scrollHeight - list.clientHeight;
      const target = Math.min(max, Math.round(list.scrollTop / height) * height);
      if (Math.abs(target - list.scrollTop) < 0.5) return;
      list.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      list.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={outer} className={cx('min-h-0 flex-1', className)}>
      <div ref={scroller} data-whole-rows className="overflow-y-auto overscroll-contain [overflow-anchor:none]" style={{ height: fit ? fit.height : '100%' }}>
        <div ref={content} style={{ paddingBottom: fit?.pad ?? 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
