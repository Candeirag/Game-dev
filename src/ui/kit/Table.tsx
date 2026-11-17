/**
 * Tabelas e a torre de classificação.
 *
 * `TableWrap`, `th` e `td` são a tabela comum (classificação do campeonato, resultados, extrato).
 * `Tower` é a torre da transmissão: uma linha por piloto, com posição, nome, equipe, pneu e a
 * diferença de tempo. Quem a usa decide o que entra em cada coluna; a torre cuida do desenho, do
 * realce do jogador (faixa vermelha + negrito) e da disputa em foco (moldura clara em volta das
 * duas linhas, com o rótulo "em disputa" para leitores de tela).
 */
import type { ReactNode } from 'react';
import type { Team } from '@/domain/schemas';
import { cx } from './cx';

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4">{children}</div>;
}

export const th = 'px-2 py-2 text-left text-2xs font-medium text-ink-400';
export const td = 'px-2 py-2 text-sm';

/** Faixa com a cor da equipe: é a identidade dela em listas e tabelas (sempre ao lado do nome). */
export function TeamSwatch({ team, className }: { team: Pick<Team, 'color'> | undefined; className?: string }) {
  return <span aria-hidden className={cx('inline-block h-3.5 w-1 shrink-0', className)} style={{ backgroundColor: team?.color ?? '#6f7c8e' }} />;
}

/** Posição de chegada: pódio em verde, abandono em âmbar com a sigla "AB". */
export function PositionBadge({ position, dnf }: { position: number; dnf?: boolean }) {
  if (dnf)
    return <span className="inline-grid h-7 min-w-9 place-items-center bg-gold-400/15 px-1.5 font-display text-base font-semibold text-gold-400">AB</span>;
  const tone = position <= 3 ? 'bg-go-400/15 text-go-400' : position <= 10 ? 'bg-ink-700 text-ink-100' : 'bg-ink-800 text-ink-300';
  return <span className={cx('inline-grid h-7 min-w-9 place-items-center px-1.5 font-display text-lg font-bold leading-none', tone)}>{position}</span>;
}

export interface TowerRow {
  id: string;
  /** Posição ("1", "12") ou "–" para quem abandonou. */
  position: ReactNode;
  /** Cor da equipe (faixa ao lado do nome). */
  color?: string;
  /** Nome curto do piloto (sigla de três letras na corrida). */
  name: ReactNode;
  /** Equipe, em texto. */
  team?: ReactNode;
  /** Marcas ao lado do nome: posições ganhas, punição. */
  marks?: ReactNode;
  /** Selo do pneu e desgaste. */
  tyre?: ReactNode;
  /** Diferença de tempo ou estado ("+1.234", "BOX", "Abandono"). */
  value: ReactNode;
  /** Carro do jogador (ou da equipe dele). */
  mine?: boolean;
  /** Um dos dois pilotos da disputa em foco. */
  battle?: boolean;
  /** Fora da prova. */
  out?: boolean;
  title?: string;
}

export function Tower({
  rows,
  label,
  onSelect,
  selectedId,
  className,
}: {
  rows: readonly TowerRow[];
  /** Nome da lista para leitores de tela ("Ordem da corrida"). */
  label: string;
  /** Com mouse, clicar numa linha a põe em foco. No toque as linhas são só leitura (são baixas demais para um alvo de 44 px). */
  onSelect?: (id: string) => void;
  selectedId?: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={className}>
      {rows.map((row, index) => {
        // A moldura da disputa abraça as duas linhas vizinhas: fecha em cima na primeira e embaixo na segunda.
        const battleAbove = row.battle && rows[index - 1]?.battle;
        const battleBelow = row.battle && rows[index + 1]?.battle;
        const content = (
          <>
            <span className={cx('text-right font-display text-base font-bold leading-none', row.out && 'text-ink-400')}>{row.position}</span>
            <span aria-hidden className="h-4 w-1" style={{ background: row.color ?? '#6f7c8e' }} />
            <span className="flex min-w-0 items-baseline gap-1">
              <b className={cx('shrink-0 font-display text-base leading-none tracking-wide', row.mine ? 'text-apex-400' : row.out && 'text-ink-300')}>
                {row.name}
              </b>
              {row.mine && <span className="sr-only">(você)</span>}
              {row.battle && <span className="sr-only">(em disputa)</span>}
              {row.team && <span className="min-w-0 truncate text-2xs text-ink-400">{row.team}</span>}
              {row.marks}
            </span>
            <span className={cx('whitespace-nowrap text-right text-xs', row.out ? 'text-ink-400' : 'text-ink-200')}>{row.value}</span>
            <span className="flex items-center justify-end gap-1">{row.tyre}</span>
          </>
        );
        const rowClass = cx(
          'grid h-8 w-full grid-cols-[1.375rem_0.25rem_minmax(0,1fr)_auto_auto] items-center gap-1 px-2 text-left',
          row.mine && 'bg-apex-500/15 shadow-[inset_3px_0_0_0_var(--color-apex-400)]',
          row.battle && 'border-x-2 border-ink-100',
          row.battle && !battleAbove && 'border-t-2',
          row.battle && !battleBelow && 'border-b-2',
        );
        return (
          <li key={row.id} title={row.title} className={cx(row.mine && 'sticky bottom-0 top-0 z-10 bg-ink-900')}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                aria-pressed={row.id === selectedId}
                className={cx(rowClass, 'transition-colors hover:bg-ink-800')}
              >
                {content}
              </button>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
