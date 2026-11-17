/**
 * Selo de pneu: o anel tem a cor do composto e o centro, a letra dele. As letras são as das
 * transmissões (S, M, H, I, W), uma para cada composto, então dá para ler sem depender da cor.
 * O nome em português vem sempre junto: no texto de apoio (`tyreName`), no rótulo acessível e na
 * legenda (`TyreLegend`) que acompanha as listas com selos.
 */
import type { TyreCompound } from '@/domain/schemas';
import { TYRES } from '@/engine';
import { cx } from './cx';

/** Letra de cada composto, como nas transmissões. Não pode haver duas iguais (tests/designSystem.test.ts confere). */
export const TYRE_LETTERS: Readonly<Record<TyreCompound, string>> = {
  soft: 'S',
  medium: 'M',
  hard: 'H',
  intermediate: 'I',
  wet: 'W',
  kart: 'K',
};

const RING: Record<TyreCompound, string> = {
  kart: 'border-tyre-kart',
  soft: 'border-tyre-soft',
  medium: 'border-tyre-medium',
  hard: 'border-tyre-hard',
  intermediate: 'border-tyre-inter',
  wet: 'border-tyre-wet',
};

/** Nome do composto em português, com a letra do selo: "macio (S)". Para o texto de apoio. */
export function tyreName(compound: TyreCompound, { capitalized = false }: { capitalized?: boolean } = {}): string {
  const label = TYRES[compound].label;
  return `${capitalized ? label : label.toLowerCase()} (${TYRE_LETTERS[compound]})`;
}

export function TyreBadge({ compound, size = 'sm', withLabel = false }: { compound: TyreCompound; size?: 'sm' | 'md'; withLabel?: boolean }) {
  const label = TYRES[compound].label;
  const badge = (
    <span
      role="img"
      aria-label={`Pneu ${tyreName(compound)}`}
      title={tyreName(compound, { capitalized: true })}
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full bg-ink-950 font-sans font-bold leading-none text-ink-100',
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

/**
 * Legenda dos selos: cada letra com o nome do composto em português. Vai junto de toda lista que
 * mostra selos sem o nome (a torre da corrida, a tabela da cronometragem).
 */
export function TyreLegend({ compounds, className }: { compounds: readonly TyreCompound[]; className?: string }) {
  const unique = [...new Set(compounds)];
  return (
    <div role="group" aria-label="Legenda dos pneus" className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-300', className)}>
      <span className="font-semibold text-ink-200">Pneus:</span>
      {unique.map((compound) => (
        <span key={compound} className="inline-flex items-center gap-1">
          <TyreBadge compound={compound} />
          {TYRES[compound].label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}
