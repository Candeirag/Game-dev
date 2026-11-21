/**
 * Medidor de pneu: quanto do pneu já foi gasto, com a marca do "penhasco" do composto (o ponto
 * em que ele passa a perder segundos por volta). A barra enche conforme o pneu gasta; encostou na
 * marca, acabou.
 *
 * O estado nunca vai só na cor: vem sempre a porcentagem e a palavra ("Desgaste 62% · Gasto") e,
 * perto do penhasco, o triângulo de alerta. Os limites de cada estado são os do motor
 * (`tyreState`), os mesmos que o rádio do engenheiro usa.
 *
 * - `TyreGauge`: a linha de texto com a barra embaixo (painel do piloto, boxes, cartão em foco).
 * - `TyreWearBar`: só a barra pequena, para listas (a torre, a tabela da cronometragem); a
 *   porcentagem e a palavra vão no rótulo acessível e na dica.
 */
import { TriangleAlert } from 'lucide-react';
import type { TyreCompound } from '@/domain/schemas';
import { TYRE_STATE_LABELS } from '@/domain/labels';
import { tyreCliff, tyreState, type TyreState } from '@/engine';
import { cx } from './cx';
import { TyreBadge } from './TyreBadge';

const FILL: Record<TyreState, string> = { new: 'bg-go-400', good: 'bg-go-400', worn: 'bg-ink-200', limit: 'bg-gold-400', gone: 'bg-gold-400' };
const TEXT: Record<TyreState, string> = { new: 'text-go-400', good: 'text-go-400', worn: 'text-ink-100', limit: 'text-gold-400', gone: 'text-gold-400' };

/** Desgaste em número, estado e a frase pronta: "Desgaste 62% · Gasto". */
export function tyreWearInfo(compound: TyreCompound, wear: number): { percent: number; state: TyreState; label: string } {
  const percent = Math.round(Math.min(1, Math.max(0, wear)) * 100);
  const state = tyreState(compound, wear);
  return { percent, state, label: `Desgaste ${percent}% · ${TYRE_STATE_LABELS[state]}` };
}

function Track({ compound, wear, state, className }: { compound: TyreCompound; wear: number; state: TyreState; className?: string }) {
  const fill = Math.min(100, Math.max(0, wear * 100));
  return (
    <span className={cx('relative block overflow-hidden bg-ink-700', className)}>
      {/* Um mínimo de preenchimento, para o pneu novo não parecer uma barra vazia. */}
      <span className={cx('block h-full', FILL[state])} style={{ width: `${Math.max(6, fill)}%` }} />
      {/* A marca do penhasco: um risco claro com contorno escuro, visível sobre a barra cheia ou vazia. */}
      <span aria-hidden className="absolute inset-y-0 w-0.5 bg-ink-100 shadow-[0_0_0_1px_var(--color-ink-950)]" style={{ left: `${tyreCliff(compound) * 100}%` }} />
    </span>
  );
}

export function TyreWearBar({ compound, wear, className }: { compound: TyreCompound; wear: number; className?: string }) {
  const { state, label } = tyreWearInfo(compound, wear);
  return (
    <span role="img" aria-label={label} title={label} className={cx('block', className)}>
      <Track compound={compound} wear={wear} state={state} className="h-1.5 w-full" />
    </span>
  );
}

export function TyreGauge({
  compound,
  wear,
  badge = true,
  caption = false,
  className,
}: {
  compound: TyreCompound;
  /** Desgaste de 0 (novo) a 1 (no fim). */
  wear: number;
  /** Mostra o selo do composto (some no kart, que só tem um). */
  badge?: boolean;
  /** Linha de apoio que explica a marca do penhasco. */
  caption?: boolean;
  className?: string;
}) {
  const { percent, state, label } = tyreWearInfo(compound, wear);
  const cliff = Math.round(tyreCliff(compound) * 100);
  const alert = state === 'limit' || state === 'gone';
  return (
    <div className={cx('min-w-0', className)}>
      <div className="flex items-center gap-2 text-xs leading-tight">
        {badge && <TyreBadge compound={compound} />}
        <span className="min-w-0">
          <span className="text-ink-300">Desgaste</span> <b className="font-semibold text-ink-100">{percent}%</b> <span className="text-ink-300">·</span>{' '}
          <b className={cx('inline-flex items-center gap-1 whitespace-nowrap font-semibold', TEXT[state])}>
            {alert && <TriangleAlert size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />}
            {TYRE_STATE_LABELS[state]}
          </b>
        </span>
      </div>
      <div role="img" aria-label={`${label}. O penhasco deste pneu fica em ${cliff}% de desgaste.`} className="mt-1">
        <Track compound={compound} wear={wear} state={state} className="h-2 w-full" />
      </div>
      {caption && <div className="mt-1 text-2xs text-ink-300">O risco claro marca o penhasco ({cliff}%): dali em diante o pneu perde segundos por volta.</div>}
    </div>
  );
}
