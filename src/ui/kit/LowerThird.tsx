/**
 * Tarja inferior da transmissão: uma faixa fina sobre a pista, com um rótulo curto, o título e
 * uma linha de detalhe. Fundo translúcido e sombra, para a corrida continuar aparecendo.
 *
 * A Fase 1 entrega o componente e o lugar dele na tela de corrida; quem o preenche (os lances
 * decisivos) é a Fase 4.
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
  className,
}: {
  /** Rótulo curto, em caixa alta ("Volta 12", "Disputa pela 3ª posição"). */
  kicker?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div role="status" className={cx('overlay enter flex min-h-12 max-w-full items-stretch text-ink-100', className)}>
      <span aria-hidden className={cx('w-1.5 shrink-0', BAR[tone])} />
      <div className="flex min-w-0 items-center gap-2 px-4 py-2">
        {icon}
        <div className="min-w-0 leading-tight">
          {kicker && <div className="truncate text-2xs font-semibold uppercase tracking-wider text-ink-300">{kicker}</div>}
          <div className="truncate font-display text-xl font-bold uppercase leading-none tracking-wide">{title}</div>
          {detail && <div className="mt-1 truncate text-xs text-ink-200">{detail}</div>}
        </div>
      </div>
    </div>
  );
}
