/**
 * Tarja inferior da transmissão: uma faixa fina sobre a pista, com um rótulo curto, o título e
 * uma linha de detalhe. Fundo translúcido e sombra, para a corrida continuar aparecendo.
 *
 * Na corrida ela mostra o desfecho de cada lance decisivo ("Deu certo", com a frase do que
 * aconteceu) e o rádio do engenheiro. A pergunta do lance, com as opções, é a `DecisionBar`.
 *
 * - `wrap`: o detalhe pode quebrar em mais de uma linha (a frase do desfecho de um lance).
 * - `compact`: o título vai em texto corrido, no tamanho do apoio, e pode quebrar (uma frase do
 *   rádio do engenheiro, em vez de duas ou três palavras em caixa alta).
 */
import type { ReactNode } from 'react';
import { cx, type Tone } from './cx';

const BAR: Record<Tone, string> = { neutral: 'bg-ink-200', good: 'bg-go-400', attention: 'bg-gold-400', accent: 'bg-apex-400' };

export function LowerThird({
  kicker,
  title,
  detail,
  icon,
  tone = 'neutral',
  wrap = false,
  compact = false,
  className,
}: {
  /** Rótulo curto, em caixa alta ("Volta 12", "Disputa pela 3ª posição"). */
  kicker?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  wrap?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="status" className={cx('overlay enter flex min-h-12 max-w-full items-stretch text-ink-100', className)}>
      <span aria-hidden className={cx('w-1.5 shrink-0', BAR[tone])} />
      <div className={cx('flex min-w-0 items-center gap-2 py-2', compact ? 'px-2' : 'px-4')}>
        {icon}
        <div className="min-w-0 leading-tight">
          {kicker && <div className="truncate text-2xs font-semibold uppercase tracking-wider text-ink-300">{kicker}</div>}
          {compact ? (
            <div className="text-xs font-semibold leading-snug">{title}</div>
          ) : (
            <div className="truncate font-display text-xl font-bold uppercase leading-none tracking-wide">{title}</div>
          )}
          {detail && <div className={cx('mt-1 text-xs text-ink-200', wrap ? 'leading-snug' : 'truncate')}>{detail}</div>}
        </div>
      </div>
    </div>
  );
}
