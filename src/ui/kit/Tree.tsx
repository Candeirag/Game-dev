/**
 * Árvore da família: as gerações numa linha vertical (o tronco), da primeira à atual, e, dentro de
 * cada geração, os ramos (filhos, parentes) presos por traços.
 *
 * A ligação é desenhada só com bordas na cor de linha forte dos tokens (`ink-600`): o tronco com
 * 2 px, que desce do marcador de uma geração até o da seguinte, e os ramos com 1 px, no desenho de
 * "├─" e "└─". O marcador da geração atual é vermelho e traz a palavra "Atual" embaixo, nunca só a
 * cor.
 *
 * É feita de listas aninhadas (`ol` das gerações, `ul` dos ramos): o leitor de tela anuncia os
 * níveis, e a conferência de alvos de toque aceita os itens de uma mesma lista um embaixo do outro.
 * Nada aqui é clicável: o que for ação vai no conteúdo de cada geração.
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

/** As gerações, da primeira (no alto) à atual (embaixo). */
export function GenerationTree({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ol aria-label={label} className={cx('flex flex-col', className)}>
      {children}
    </ol>
  );
}

/**
 * Uma geração: o marcador no tronco ("1ª") e o conteúdo ao lado. O tronco desce do marcador até a
 * geração seguinte; na última, não há tronco abaixo.
 */
export function TreeGeneration({
  marker,
  markerLabel,
  current = false,
  children,
}: {
  /** O que vai no marcador: "1ª", "2ª". */
  marker: ReactNode;
  /** O mesmo marcador por extenso, para o leitor de tela ("1ª geração"). */
  markerLabel: string;
  /** A geração atual: marcador vermelho e a palavra "Atual". */
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="group/generation grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4">
      <div aria-hidden className="flex flex-col items-center">
        <span
          className={cx(
            'chamfer-br grid h-10 w-10 shrink-0 place-items-center font-display text-lg font-bold leading-none',
            current ? 'bg-apex-500 text-white' : 'bg-ink-800 text-ink-100 shadow-frame',
          )}
        >
          {marker}
        </span>
        {current && <span className="mt-1 text-2xs font-semibold text-apex-400">Atual</span>}
        <span className="mt-1 w-0 flex-1 border-ink-600 border-l-2 group-last/generation:hidden" />
      </div>
      <div className="min-w-0 pb-6 group-last/generation:pb-0">
        <span className="sr-only">
          {markerLabel}
          {current ? ' (atual)' : ''}:{' '}
        </span>
        {children}
      </div>
    </li>
  );
}

/** Os ramos de uma geração (filhos, parentes), com um título curto em cima. */
export function TreeBranches({ label, title, children, className }: { label: string; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {title && (
        <div aria-hidden className="text-2xs font-medium text-ink-400">
          {title}
        </div>
      )}
      <ul aria-label={label} className="mt-1">
        {children}
      </ul>
    </div>
  );
}

/** Um ramo: o traço vertical que vem de cima e o traço curto até o conteúdo ("├─"; no último, "└─"). */
export function TreeBranch({ children }: { children: ReactNode }) {
  return (
    <li className="relative pb-2 pl-6 before:absolute before:top-0 before:left-2 before:h-full before:border-ink-600 before:border-l after:absolute after:top-3 after:left-2 after:w-3 after:border-ink-600 after:border-t last:pb-0 last:before:h-3">
      {children}
    </li>
  );
}
