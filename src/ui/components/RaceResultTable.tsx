import type { RaceResult } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { fullName } from '@/engine';
import { PositionBadge, TableWrap, TeamSwatch, cx, td, th } from './ui';
import { formatLap, formatRaceTime } from '../format';
import { useCareerView } from '../hooks/useCareer';

/** Nomes congelados (temporadas arquivadas) têm prioridade sobre os pilotos atuais. */
export function RaceResultTable({ result, names }: { result: RaceResult; names?: Record<string, string> }) {
  const { player, drivers, teams } = useCareerView();
  const winnerTime = result.entries[0]?.totalTime ?? 0;
  const nameOf = (id: string) => names?.[id] ?? (drivers[id] ? fullName(drivers[id]!) : id);
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
            <th className={cx(th, 'hidden text-center md:table-cell')}>Ultrap.</th>
            <th className={cx(th, 'text-right')}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {result.entries.map((e) => (
            <tr key={e.driverId} className={cx('border-t border-ink-800', e.driverId === player.id && 'bg-apex-500/10')}>
              <td className={td}><PositionBadge position={e.position} dnf={e.status === 'dnf'} /></td>
              <td className={td}>
                <span className="flex items-center gap-2">
                  <TeamSwatch team={teams[e.teamId]} />
                  <span className={cx(e.driverId === player.id && 'font-semibold')}>{nameOf(e.driverId)}</span>
                  {result.fastestLap?.driverId === e.driverId && <span title="Volta mais rápida" className="rounded bg-purple-500/20 px-1 text-[10px] font-bold text-purple-300">VMR</span>}
                  {e.grid === 1 && <span title="Pole position" className="rounded bg-ink-700 px-1 text-[10px] font-bold text-ink-300">POLE</span>}
                </span>
              </td>
              <td className={cx(td, 'hidden text-center tabular text-ink-400 sm:table-cell')}>
                {e.grid}
                {e.status === 'finished' && e.grid !== e.position && (
                  <span className={cx('ml-1 text-xs', e.grid > e.position ? 'text-go-400' : 'text-apex-400')}>
                    {e.grid > e.position ? `▲${e.grid - e.position}` : `▼${e.position - e.grid}`}
                  </span>
                )}
              </td>
              <td className={cx(td, 'text-right tabular')}>
                {e.status === 'dnf' ? (
                  <span className="text-ink-400">{DNF_LABELS[e.dnfReason ?? 'crash']} · V{e.lapsCompleted + 1}</span>
                ) : e.position === 1 ? (
                  formatRaceTime(e.totalTime)
                ) : (
                  <span className="text-ink-300">+{(e.totalTime - winnerTime).toFixed(3)}</span>
                )}
              </td>
              <td className={cx(td, 'hidden text-right tabular text-ink-300 md:table-cell')}>{formatLap(e.bestLap)}</td>
              <td className={cx(td, 'hidden text-center tabular text-ink-400 md:table-cell')}>{e.overtakes}</td>
              <td className={cx(td, 'text-right font-semibold tabular')}>{e.points || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
