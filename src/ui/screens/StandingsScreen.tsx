import { useSearchParams } from 'react-router-dom';
import { fullName } from '@/engine';
import { Card, cx, PageHeader, TableWrap, Tabs, TeamSwatch, YouMark } from '@/ui/kit';
import { useCareerView } from '../hooks/useCareer';
import { useMediaQuery } from '../layout/chrome';

type View = 'drivers' | 'teams';
type DriverRow = ReturnType<typeof useCareerView>['driverStandings'][number];

/** Células da tabela: mais baixas que as do resto do jogo, para o campeonato caber na tela deitada. */
const th = 'px-2 py-2 text-left text-2xs font-medium text-ink-400';
const td = 'px-2 py-[3px] text-sm';

/** Resultado de uma etapa na grade: vitória e pódio em verde, abandono em âmbar, o resto neutro. */
function resultCellTone(position: number, dnf: boolean): string {
  if (dnf) return 'bg-gold-400/15 text-gold-400';
  if (position === 1) return 'bg-go-400 text-ink-950';
  if (position <= 3) return 'bg-go-400/15 text-go-400';
  if (position <= 10) return 'bg-ink-800 text-ink-200';
  return 'text-ink-400';
}

export function StandingsScreen() {
  const { career, player, drivers, teams, driverStandings, teamStandings } = useCareerView();
  // A aba fica no endereço (?tab=teams), como nas outras telas com abas.
  const [params, setParams] = useSearchParams();
  const view: View = params.get('tab') === 'teams' ? 'teams' : 'drivers';
  const setView = (next: View) => setParams(next === 'drivers' ? {} : { tab: next }, { replace: true });
  // Na tela deitada a classificação se divide em duas metades lado a lado; no computador, com
  // espaço para a grade etapa a etapa, volta a ser uma tabela só.
  const split = useMediaQuery('(min-width: 768px) and (max-width: 1279.98px)');
  const half = Math.ceil(driverStandings.length / 2);
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
        <p className="mb-3 border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-400">Nenhuma etapa disputada ainda. A ordem abaixo é provisória.</p>
      )}
      {career.adjustments.length > 0 && (
        <ul className="mb-3 space-y-1 border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-gold-400">
          {career.adjustments.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista só cresce no fim e os ajustes não têm id
            <li key={i}>
              {drivers[a.driverId] ? fullName(drivers[a.driverId]!) : a.driverId}: {a.points > 0 ? '+' : ''}
              {a.points} pontos ({a.reason}).
            </li>
          ))}
        </ul>
      )}

      {view === 'drivers' ? (
        split ? (
          <div className="grid items-start gap-4 grid-cols-2">
            <DriversTable rows={driverStandings.slice(0, half)} leaderPoints={leaderPoints} compact />
            <DriversTable rows={driverStandings.slice(half)} leaderPoints={leaderPoints} compact />
          </div>
        ) : (
          <DriversTable rows={driverStandings} leaderPoints={leaderPoints} />
        )
      ) : (
        <Card padded={false}>
          <div className="px-3 py-1">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Pos</th>
                    <th className={th}>Equipe</th>
                    <th className={cx(th, 'hidden sm:table-cell')}>Pilotos</th>
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
                        <td className={'w-9 px-2 py-2 font-display text-base font-bold'}>{s.position}</td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <TeamSwatch team={team} />
                            <span className="font-semibold">{team?.name}</span>
                          </span>
                        </td>
                        <td className={cx(td, 'hidden text-ink-400 sm:table-cell')}>{lineup.map((d) => d.lastName).join(' / ')}</td>
                        <td className={cx(td, 'hidden text-center text-ink-400 sm:table-cell')}>
                          {team ? `${Math.round(team.car.engine)} / ${Math.round(team.car.chassis)} / ${Math.round(team.car.reliability)}` : '-'}
                        </td>
                        <td className={cx(td, 'text-center')}>{s.wins || ''}</td>
                        <td className={'px-2 py-2 text-right font-display text-base font-bold'}>{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <p className="border-t border-ink-800 px-4 py-2 text-xs text-ink-400">
            Equipamento: Motor / Chassi / Confiabilidade. Pontos da equipe: a soma dos pilotos que correram por ela.
          </p>
        </Card>
      )}
    </div>
  );
}

/**
 * Classificação de pilotos. `compact` é a metade usada na tela deitada: sem a coluna da equipe
 * (a faixa de cor a identifica; o nome aparece quando há largura) e sem a grade etapa a etapa.
 */
function DriversTable({ rows, leaderPoints, compact = false }: { rows: DriverRow[]; leaderPoints: number; compact?: boolean }) {
  const { career, player, drivers, teams } = useCareerView();
  const rounds = career.calendar.map((e) => e.round);
  return (
    <Card padded={false}>
      <div className="px-3 py-1">
        <TableWrap>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Pos</th>
                <th className={th}>Piloto</th>
                {!compact && <th className={cx(th, 'hidden md:table-cell')}>Equipe</th>}
                {!compact &&
                  rounds.map((r) => (
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
              {rows.map((s) => {
                const d = drivers[s.driverId];
                const team = teams[s.teamId ?? ''];
                const isMe = s.driverId === player.id || (career.management !== null && s.teamId === career.management.teamId);
                return (
                  <tr key={s.driverId} className={cx('border-t border-ink-800', isMe && 'bg-apex-500/10')}>
                    <td className={'w-9 px-2 py-2 font-display text-base font-bold'}>{s.position}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <TeamSwatch team={team} />
                        <span className={cx('whitespace-nowrap', isMe && 'font-semibold')}>{d ? fullName(d) : s.driverId}</span>
                        {isMe && <YouMark label={s.driverId === player.id ? 'Você' : 'Sua equipe'} />}
                        {compact && <span className="hidden min-w-0 truncate text-xs text-ink-400 lg:inline">{team?.name ?? ''}</span>}
                      </span>
                    </td>
                    {!compact && <td className={cx(td, 'hidden text-ink-400 md:table-cell')}>{team?.name ?? '-'}</td>}
                    {!compact &&
                      rounds.map((r, i) => {
                        const res = s.results[i];
                        return (
                          <td key={r} className="hidden px-1 py-1 text-center xl:table-cell">
                            {res ? (
                              <span
                                className={cx(
                                  'inline-flex h-6 w-7 items-center justify-center text-xs font-semibold leading-none',
                                  resultCellTone(res.position, res.status === 'dnf'),
                                )}
                                title={`Etapa ${r}: ${res.status === 'dnf' ? 'abandono' : `${res.position}º`} · ${res.points} pts`}
                              >
                                {res.status === 'dnf' ? 'AB' : res.position}
                              </span>
                            ) : (
                              <span className="text-ink-400">·</span>
                            )}
                          </td>
                        );
                      })}
                    <td className={cx(td, 'text-center')}>{s.wins || ''}</td>
                    <td className={cx(td, 'hidden text-center sm:table-cell')}>{s.podiums || ''}</td>
                    <td className={'px-2 py-2 text-right font-display text-base font-bold'}>{s.points}</td>
                    <td className={cx(td, 'hidden text-right text-ink-400 sm:table-cell')}>{s.position === 1 ? '' : `-${leaderPoints - s.points}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Card>
  );
}
