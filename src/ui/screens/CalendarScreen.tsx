import { getTrack, raceLaps } from '@/data/tracks';
import { fullName } from '@/engine';
import { CircuitMap } from '../components/CircuitMap';
import { Card, PageHeader, PositionBadge, WeatherBadge, cx } from '../components/ui';
import { describeOvertaking, describePower, describeTyreWear, formatDate, trackCredit, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';

export function CalendarScreen() {
  const { career, player, drivers, category } = useCareerView();
  const credit = career.calendar.map((event) => trackCredit(event.trackId)).find((text) => text !== null) ?? null;
  return (
    <div>
      <PageHeader eyebrow={`${category.name} · ${career.year}`} title="Calendário">
        <span className="text-sm text-ink-400">
          {career.rounds.length} de {career.calendar.length} etapas disputadas
        </span>
      </PageHeader>
      <div className="grid gap-3">
        {career.calendar.map((event, index) => {
          const track = getTrack(event.trackId);
          const record = career.rounds.find((r) => r.round === event.round);
          const mine = record?.race.entries.find((e) => e.driverId === player.id);
          const winner = record ? drivers[record.race.entries[0]?.driverId ?? ''] : undefined;
          const isCurrent = career.weekend?.round === event.round;
          const isNext = !career.weekend && index === career.nextRoundIndex;
          return (
            <Card key={event.round} className={cx(isCurrent || isNext ? 'border-apex-500/60' : '', record && 'opacity-90')}>
              <div className="grid items-center gap-4 md:grid-cols-[56px_132px_1.6fr_1fr_1fr]">
                <div className="font-display text-4xl font-bold leading-none tabular text-ink-600">{String(event.round).padStart(2, '0')}</div>
                <CircuitMap track={track} style={category.vehicle} className="h-20 w-full max-w-[160px]" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl font-bold uppercase">{track.name}</span>
                    {isCurrent && <span className="rounded bg-apex-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Em andamento</span>}
                    {isNext && <span className="rounded bg-apex-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-apex-400">Próxima</span>}
                  </div>
                  <div className="text-sm text-ink-400">
                    {trackLocation(track)} · {formatDate(event.date)} · {raceLaps(track, category)} voltas · {track.lengthMeters} m
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    Ultrapassagem {describeOvertaking(track.overtakingDifficulty)} · Desgaste {describeTyreWear(track.tyreWear)} · Traçado que{' '}
                    {describePower(track.powerSensitivity)}
                  </div>
                </div>
                <div className="text-sm">
                  {record ? (
                    <WeatherBadge weather={record.race.weather} />
                  ) : (
                    <span className="text-ink-400">
                      Chance de chuva: <b className="text-ink-100 tabular">{Math.round(track.rainChance * 100)}%</b>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm md:justify-end">
                  {record && mine ? (
                    <>
                      <PositionBadge position={mine.position} dnf={mine.status === 'dnf'} />
                      <div className="leading-tight">
                        <div className="font-semibold">{mine.points} pts</div>
                        <div className="text-xs text-ink-400">Vencedor: {winner ? fullName(winner) : '-'}</div>
                      </div>
                    </>
                  ) : record ? (
                    <span className="text-xs text-ink-400">Não disputou · Vencedor: {winner ? fullName(winner) : '-'}</span>
                  ) : (
                    <span className="text-ink-500">-</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {credit && <p className="mt-3 text-[11px] text-ink-500">Traçados das pistas: {credit}</p>}
    </div>
  );
}
