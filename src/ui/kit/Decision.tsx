/**
 * Tarja de decisão: a pergunta que para a corrida, como na TV. Tem a faixa de cor do tom, um
 * rótulo curto, a pergunta, as opções, a linha de detalhe da opção escolhida e os botões de ação
 * (o principal fica embaixo, à direita, perto do polegar).
 *
 * - `DecisionBar` é a moldura. Quem a usa decide onde ela fica (presa ao pé da tela, na corrida) e
 *   o que entra em cada parte. É um diálogo que não trava o resto da tela: a pista continua à
 *   vista atrás e acima dela.
 * - `ChanceOption` é o botão de cada opção: o nome, a chance de dar certo em número e em barra e
 *   o risco em palavra, com ícone. A cor acompanha, nunca vai sozinha, e não existe vermelho para
 *   "ruim": seguro é verde, moderado é neutro e arriscado é âmbar.
 */
import { Check, Scale, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { MOMENT_RISK_LABELS } from '@/domain/labels';
import { cx, type Tone } from './cx';
import { ProgressBar } from './ProgressBar';

const BAR: Record<Tone, string> = { neutral: 'bg-ink-200', good: 'bg-go-400', attention: 'bg-gold-400', accent: 'bg-apex-400' };

export function DecisionBar({
  label,
  kicker,
  title,
  aside,
  children,
  detail,
  actions,
  stacked = false,
  tone = 'accent',
  className,
  ref,
}: {
  /** Nome do diálogo para leitores de tela ("Lance decisivo: Largada"). */
  label: string;
  /** Rótulo curto, em caixa alta ("Largada · volta 1"). */
  kicker?: ReactNode;
  /** A pergunta. */
  title: ReactNode;
  /** Informação de apoio ao lado da pergunta (o estado do pneu, na parada). */
  aside?: ReactNode;
  /** As opções (`ChanceOption`), já no grupo delas. */
  children: ReactNode;
  /** O que se ganha, o que se perde e o que pesa na opção escolhida. */
  detail: ReactNode;
  /** Botões de ação; o principal por último. */
  actions: ReactNode;
  /** Em pé: tudo empilhado, com as ações numa linha no fim. Deitado: as ações ao lado do detalhe, no canto de baixo. */
  stacked?: boolean;
  tone?: Tone;
  className?: string;
  /** Para quem abre a tarja levar o foco até ela. */
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      aria-modal="false"
      tabIndex={-1}
      className={cx('enter-up flex max-w-full items-stretch border-t border-ink-600 bg-ink-950/95 text-ink-100 shadow-bar', className)}
    >
      <span aria-hidden className={cx('w-1.5 shrink-0', BAR[tone])} />
      {/* Se a tarja bater na altura máxima (texto muito grande), só o detalhe rola: a pergunta, as opções e as ações ficam sempre à vista. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2">
        <div className="flex min-w-0 shrink-0 items-end justify-between gap-4">
          {/* Deitado, o rótulo e a pergunta dividem a linha: cada linha a menos é pista a mais. */}
          <div className={cx('min-w-0 leading-tight', !stacked && 'flex flex-wrap items-baseline gap-x-2')}>
            {kicker && <div className="text-2xs font-semibold uppercase tracking-wider text-ink-300">{kicker}</div>}
            <div className="font-display text-lg font-semibold leading-tight tracking-wide">{title}</div>
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <div className="shrink-0">{children}</div>
        <div className={cx('flex min-h-0 min-w-0 gap-2', stacked ? 'flex-col' : 'items-end')}>
          <div
            className={cx(
              'max-h-full min-h-0 min-w-0 flex-1 self-stretch overflow-y-auto overscroll-contain text-xs leading-snug text-ink-200',
              !stacked && 'min-h-12',
            )}
          >
            {detail}
          </div>
          <div className={cx('flex shrink-0 gap-2', stacked && '*:flex-1')}>{actions}</div>
        </div>
      </div>
    </div>
  );
}

const RISK_TONE: Record<0 | 1 | 2, Tone> = { 0: 'good', 1: 'neutral', 2: 'attention' };
const RISK_TEXT: Record<0 | 1 | 2, string> = { 0: 'text-go-400', 1: 'text-ink-200', 2: 'text-gold-400' };
const RISK_ICON = { 0: ShieldCheck, 1: Scale, 2: TriangleAlert } as const;

export function ChanceOption({
  label,
  chance,
  risk,
  selected,
  onSelect,
  badge,
  seal,
  badgeLabel,
  disabled,
  className,
}: {
  label: string;
  /** Chance de dar certo, de 0 a 1. */
  chance: number;
  /** 0 = seguro, 1 = moderado, 2 = arriscado. */
  risk: 0 | 1 | 2;
  selected: boolean;
  onSelect: () => void;
  /** Marca pequena ao lado do nome (o selo do pneu que entra, na opção de parar). */
  badge?: ReactNode;
  /** Selo discreto preso à borda de cima, à direita (a opção que o piloto escolheria): não tira espaço do nome. */
  seal?: ReactNode;
  /** O selo e a marca, em palavras, para o nome acessível do botão. */
  badgeLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const percent = Math.round(chance * 100);
  const Icon = RISK_ICON[risk];
  return (
    <div className={cx('relative flex min-w-0', className)}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`${label}: ${percent}% de chance de dar certo, ${MOMENT_RISK_LABELS[risk].toLowerCase()}${badgeLabel ? `, ${badgeLabel}` : ''}`}
        onClick={onSelect}
        disabled={disabled}
        className={cx(
          'chamfer-br flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 px-2 py-2 text-left transition-colors',
          // A opção escolhida tem contorno vermelho, barra na base e o visto (forma, não só cor).
          selected
            ? 'bg-apex-500/20 text-ink-100 shadow-[inset_0_0_0_1px_var(--color-apex-400),inset_0_-4px_0_0_var(--color-apex-400)]'
            : 'bg-ink-800 text-ink-100 shadow-ring hover:bg-ink-700',
        )}
      >
        <span className="flex w-full items-center gap-2">
          {selected && <Check size={14} strokeWidth={3} aria-hidden className="shrink-0 text-apex-400" />}
          <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
            {/* O selo avança um pouco sobre a primeira linha: este calço faz o nome comprido quebrar antes dele. */}
            {seal && <span aria-hidden className="float-right h-2 w-[calc(4.5rem*var(--text-scale,1))]" />}
            {label}
          </span>
          {badge}
        </span>
        <span className="flex w-full items-center gap-2">
          <span className="shrink-0 font-display text-xl font-bold leading-none">{percent}%</span>
          <ProgressBar value={percent} tone={RISK_TONE[risk]} className="min-w-4 flex-1" />
          <span className={cx('flex shrink-0 items-center gap-1 text-2xs font-semibold leading-none', RISK_TEXT[risk])}>
            <Icon size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />
            {MOMENT_RISK_LABELS[risk]}
          </span>
        </span>
      </button>
      {seal && (
        <span aria-hidden className="pointer-events-none absolute -top-2 right-2 flex">
          {seal}
        </span>
      )}
    </div>
  );
}
