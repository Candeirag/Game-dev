import { useState } from 'react';
import { fullName } from '@/engine';
import { Card, PageHeader, TableWrap, Tabs, TeamSwatch, cx, td, th } from '../components/ui';
import { useCareerView } from '../hooks/useCareer';

type View = 'drivers' | 'teams';

function resultCellTone(position: number, dnf: boolean): string {
  if (dnf) return 'bg-ink-800 text-ink-500';
  if (position === 1) return 'bg-gold-400/90 text-ink-950';
  if (position === 2) return 'bg-silver-300/80 text-ink-950';
  if (position === 3) return 'bg-bronze-400/80 text-ink-950';
  if (position <= 10) return 'bg-go-400/15 text-go-400';
  return 'bg-ink-850 text-ink-400';
}

export function StandingsScreen() {
  const { career, player, drivers, teams, driverStandings, teamStandings } = useCareerView();
  const [view, setView] = useState<View>('drivers');
  const rounds = career.calendar.map((e) => e.round);
  const leaderPoints = driverStandings[0]?.points ?? 0;

  return (
    <div>
      <PageHeader eyebrow={`Temporada ${career.year} · ${career.rounds.length}/${career.calendar.length} etapas`} title="Classificação">
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: 'drivers', label: 'Pilotos' },
            { value: 'teams', label: 'Equipes' },
          ]}
        />
      </PageHeader>

      {career.rounds.length === 0 && (
        <p className="mb-4 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
          Nenhuma etapa disputada ainda. A ordem abaixo é provisória.
        </p>
      )}
      {career.adjustments.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg border border-gold-400/30 bg-gold-400/5 px-4 py-3 text-sm text-gold-400">
          {career.adjustments.map((a, i) => (
            <li key={i}>
              {drivers[a.driverId] ? fullName(drivers[a.driverId]!) : a.driverId}: {a.points > 0 ? '+' : ''}
              {a.points} pontos ({a.reason}).
            </li>
          ))}
        </ul>
      )}
      {view === 'drivers' ? (
        <Card padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Pos</th>
                    <th className={th}>Piloto</th>
                    <th className={cx(th, 'hidden md:table-cell')}>Equipe</th>
                    {rounds.map((r) => (
                      <th key={r} className={cx(th, 'hidden w-8 text-center xl:table-cell')}>
                        {r}
                      </th>
                    ))}
                    <th className={cx(th, 'text-center')}>V</th>
                    <th className={cx(th, 'hidden text-center sm:table-cell')}>Pód.</th>
                    <th className={cx(th, 'text-right')}>Pts</th>
                    <th className={cx(th, 'hidden text-right sm:table-cell')}>Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStandings.map((s) => {
                    const d = drivers[s.driverId];
                    const team = teams[s.teamId ?? ''];
                    const isMe = s.driverId === player.id || (career.management !== null && s.teamId === career.management.teamId);
                    return (
                      <tr key={s.driverId} className={cx('border-t border-ink-800', isMe && 'bg-apex-500/10')}>
                        <td className={cx(td, 'w-10 font-display text-base font-bold tabular')}>{s.position}</td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <TeamSwatch team={team} />
                            <span className={cx(isMe && 'font-semibold')}>{d ? fullName(d) : s.driverId}</span>
                          </span>
                        </td>
                        <td className={cx(td, 'hidden text-ink-400 md:table-cell')}>{team?.name ?? '-'}</td>
                        {rounds.map((r, i) => {
                          const res = s.results[i];
                          return (
                            <td key={r} className="hidden px-0.5 py-1 text-center xl:table-cell">
                              {res ? (
                                <span
                                  className={cx(
                                    'inline-flex h-6 w-7 items-center justify-center rounded text-[11px] font-bold tabular',
                                    resultCellTone(res.position, res.status === 'dnf'),
                                  )}
                                  title={`Etapa ${r}: ${res.status === 'dnf' ? 'abandono' : `${res.position}º`} · ${res.points} pts`}
                                >
                                  {res.status === 'dnf' ? 'AB' : res.position}
                                </span>
                              ) : (
                                <span className="text-ink-700">·</span>
                              )}
                            </td>
                          );
                        })}
                        <td className={cx(td, 'text-center tabular')}>{s.wins || ''}</td>
                        <td className={cx(td, 'hidden text-center tabular sm:table-cell')}>{s.podiums || ''}</td>
                        <td className={cx(td, 'text-right font-display text-base font-bold tabular')}>{s.points}</td>
                        <td className={cx(td, 'hidden text-right tabular text-ink-400 sm:table-cell')}>
                          {s.position === 1 ? '' : `-${leaderPoints - s.points}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Pos</th>
                    <th className={th}>Equipe</th>
                    <th className={cx(th, 'hidden md:table-cell')}>Pilotos</th>
                    <th className={cx(th, 'hidden text-center sm:table-cell')}>Equip. (M/C/C)</th>
                    <th className={cx(th, 'text-center')}>V</th>
                    <th className={cx(th, 'text-right')}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStandings.map((s) => {
                    const team = teams[s.teamId];
                    const lineup = career.drivers.filter((d) => d.teamId === s.teamId && d.role !== 'reserve');
                    const isMine = s.teamId === (player.teamId ?? career.management?.teamId);
                    return (
                      <tr key={s.teamId} className={cx('border-t border-ink-800', isMine && 'bg-apex-500/10')}>
                        <td className={cx(td, 'w-10 font-display text-base font-bold tabular')}>{s.position}</td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <TeamSwatch team={team} />
                            <span className="font-semibold">{team?.name}</span>
                          </span>
                        </td>
                        <td className={cx(td, 'hidden text-ink-400 md:table-cell')}>{lineup.map((d) => d.lastName).join(' / ')}</td>
                        <td className={cx(td, 'hidden text-center tabular text-ink-400 sm:table-cell')}>
                          {team ? `${Math.round(team.car.engine)} / ${Math.round(team.car.chassis)} / ${Math.round(team.car.reliability)}` : '-'}
                        </td>
                        <td className={cx(td, 'text-center tabular')}>{s.wins || ''}</td>
                        <td className={cx(td, 'text-right font-display text-base font-bold tabular')}>{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <p className="border-t border-ink-800 px-4 py-3 text-xs text-ink-400">
            Equipamento: Motor / Chassi / Confiabilidade. Os pontos da equipe são a soma dos pontos dos pilotos que correram por ela.
          </p>
        </Card>
      )}
    </div>
  );
}
