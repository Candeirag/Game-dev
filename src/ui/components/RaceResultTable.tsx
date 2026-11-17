import type { RaceResult } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { fullName } from '@/engine';
import { cx, Delta, PositionBadge, TableWrap, td, TeamSwatch, th, YouMark } from '@/ui/kit';
import { formatLap, formatRaceTime } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';
import { Mark } from '../race/raceBits';

/**
 * Resultado oficial de uma corrida. Em temporadas arquivadas, nomes e cores
 * vêm congelados do arquivo (`names`, `colors`), porque pilotos e equipes mudam.
 */
export function RaceResultTable({ result, names, colors }: { result: RaceResult; names?: Record<string, string>; colors?: Record<string, string> }) {
  const { player, drivers, teams } = useCareerView();
  const winnerTime = result.entries[0]?.totalTime ?? 0;
  const nameOf = (id: string) => names?.[id] ?? (drivers[id] ? fullName(drivers[id]!) : id);
  const colorOf = (teamId: string) => (colors?.[teamId] ? { color: colors[teamId]! } : teams[teamId]);
  const anyStops = result.entries.some((e) => e.pitStops > 0);
  return (
    <TableWrap>
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>Pos</th>
            <th className={th}>Piloto</th>
            <th className={cx(th, 'hidden text-center sm:table-cell')}>Grid</th>
            <th className={cx(th, 'text-right')}>Tempo</th>
            <th className={cx(th, 'hidden text-right md:table-cell')}>Melhor volta</th>
            {anyStops && <th className={cx(th, 'hidden text-center md:table-cell')}>Paradas</th>}
            <th className={cx(th, 'hidden text-center md:table-cell')}>Ultrap.</th>
            <th className={cx(th, 'text-right')}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {result.entries.map((e) => (
            <tr key={e.driverId} className={cx('border-t border-ink-700', e.driverId === player.id && 'bg-apex-500/10')}>
              <td className={td}>
                <PositionBadge position={e.position} dnf={e.status === 'dnf'} />
              </td>
              <td className={td}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* A faixa da equipe e o nome não se separam quando a linha quebra (só as marcas descem). */}
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <TeamSwatch team={colorOf(e.teamId)} />
                    <span className={cx(e.driverId === player.id && 'font-semibold')}>{nameOf(e.driverId)}</span>
                  </span>
                  {e.driverId === player.id && <YouMark />}
                  {result.fastestLap?.driverId === e.driverId && (
                    <Mark title="Volta mais rápida" tone="strong">
                      VMR
                    </Mark>
                  )}
                  {e.grid === 1 && <Mark title="Pole position">POLE</Mark>}
                  {e.penaltySeconds > 0 && <Mark title="Punição em tempo" tone="attention">{`+${e.penaltySeconds}s`}</Mark>}
                  {e.injured && (
                    <Mark title="Lesionado no acidente" tone="attention">
                      LESÃO
                    </Mark>
                  )}
                </span>
              </td>
              <td className={cx(td, 'hidden text-center tabular text-ink-400 sm:table-cell')}>
                {e.grid}
                {e.status === 'finished' && <Delta value={e.grid - e.position} signless threshold={0.5} className="ml-1 text-2xs" />}
              </td>
              <td className={cx(td, 'text-right tabular')}>
                {e.status === 'dnf' ? (
                  <span className="text-ink-400">
                    {DNF_LABELS[e.dnfReason ?? 'crash']} · V{e.lapsCompleted + 1}
                  </span>
                ) : e.position === 1 ? (
                  formatRaceTime(e.totalTime)
                ) : (
                  <span className="text-ink-300">+{(e.totalTime - winnerTime).toFixed(3)}</span>
                )}
              </td>
              <td className={cx(td, 'hidden text-right tabular text-ink-300 md:table-cell')}>{formatLap(e.bestLap)}</td>
              {anyStops && <td className={cx(td, 'hidden text-center tabular text-ink-400 md:table-cell')}>{e.pitStops}</td>}
              <td className={cx(td, 'hidden text-center tabular text-ink-400 md:table-cell')}>{e.overtakes}</td>
              <td className={cx(td, 'text-right font-semibold tabular')}>{e.points || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(result.safetyCars > 0 || result.virtualSafetyCars > 0 || result.redFlags > 0) && (
        <p className="border-t border-ink-700 py-2 text-xs text-ink-400">
          Neutralizações: {result.safetyCars} safety car, {result.virtualSafetyCars} safety car virtual,{' '}
          {counted(result.redFlags, 'bandeira vermelha', 'bandeiras vermelhas')}.
        </p>
      )}
    </TableWrap>
  );
}
