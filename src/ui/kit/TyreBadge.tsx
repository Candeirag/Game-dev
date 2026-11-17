/**
 * Selo de pneu: o anel tem a cor do composto e o centro, a letra dele. Cada composto tem uma
 * letra só sua (Macio e Médio não dividem o "M"), então dá para ler sem depender da cor.
 */
import type { TyreCompound } from '@/domain/schemas';
import { TYRES } from '@/engine';
import { cx } from './cx';

/** Letra de cada composto. Não pode haver duas iguais (tests/designSystem.test.ts confere). */
export const TYRE_LETTERS: Readonly<Record<TyreCompound, string>> = {
  kart: 'K',
  soft: 'M',
  medium: 'E',
  hard: 'D',
  intermediate: 'I',
  wet: 'C',
};

const RING: Record<TyreCompound, string> = {
  kart: 'border-tyre-kart',
  soft: 'border-tyre-soft',
  medium: 'border-tyre-medium',
  hard: 'border-tyre-hard',
  intermediate: 'border-tyre-inter',
  wet: 'border-tyre-wet',
};

export function TyreBadge({ compound, size = 'sm', withLabel = false }: { compound: TyreCompound; size?: 'sm' | 'md'; withLabel?: boolean }) {
  const label = TYRES[compound].label;
  const badge = (
    <span
      role="img"
      aria-label={`Pneu ${label.toLowerCase()}`}
      title={label}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full bg-ink-950 font-bold leading-none text-ink-100',
        size === 'md' ? 'h-7 w-7 border-[3px] text-xs' : 'h-5 w-5 border-2 text-2xs',
        RING[compound],
      )}
    >
      {TYRE_LETTERS[compound]}
    </span>
  );
  if (!withLabel) return badge;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {badge}
      {label}
    </span>
  );
}
