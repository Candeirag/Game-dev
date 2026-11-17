/**
 * Lista rolável que nunca para com uma linha cortada: a altura visível é sempre um número inteiro
 * de linhas, o fim da lista também cai numa divisa de linha e, ao rolar, ela assenta no começo de
 * uma linha. Feita para a torre da corrida, em que a linha do jogador gruda no pé da lista: sem
 * isso, a linha logo acima dela aparecia pela metade.
 *
 * As linhas são os elementos com `data-row` (todas da mesma altura). O que vier depois delas (a
 * legenda, por exemplo) ganha um respiro embaixo até completar uma linha inteira. O espaço que
 * sobra abaixo da lista, menor que uma linha, fica vazio.
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cx } from './cx';

interface Fit {
  height: number;
  pad: number;
}

export function WholeRows({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pad = useRef(0);
  const [fit, setFit] = useState<Fit | null>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const list = content.current;
    if (!box || !list) return;
    const measure = () => {
      const row = list.querySelector<HTMLElement>('[data-row]');
      const rowHeight = row?.getBoundingClientRect().height ?? 0;
      if (rowHeight <= 0 || box.clientHeight <= 0) {
        setFit((old) => (old === null ? old : null));
        return;
      }
      const rows = Math.max(1, Math.floor((box.clientHeight + 0.5) / rowHeight));
      // Altura natural do conteúdo (sem o respiro que esta lista mesma pôs no fim).
      const natural = list.getBoundingClientRect().height - pad.current;
      const rest = natural % rowHeight;
      const nextPad = rest < 0.5 || rowHeight - rest < 0.5 ? 0 : rowHeight - rest;
      pad.current = nextPad;
      const next = { height: rows * rowHeight, pad: nextPad };
      setFit((old) => (old && Math.abs(old.height - next.height) < 0.5 && Math.abs(old.pad - next.pad) < 0.5 ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className={cx('min-h-0 flex-1', className)}>
      <div data-whole-rows className="snap-y snap-mandatory overflow-y-auto overscroll-contain" style={{ height: fit ? fit.height : '100%' }}>
        <div ref={content} style={{ paddingBottom: fit?.pad ?? 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
