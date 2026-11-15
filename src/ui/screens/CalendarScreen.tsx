import { useState, type ReactNode } from 'react';
import { Flag } from 'lucide-react';
import { getTrack, raceLaps } from '@/data/tracks';
import { fullName } from '@/engine';
import { CircuitMap } from '../components/CircuitMap';
import { Card, PageHeader, Pill, PositionBadge, WeatherBadge, cx } from '../components/ui';
import { describeOvertaking, describePower, describeTyreWear, formatDate, trackCredit, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { ResultChips } from '../kit/bits';

/**
 * Calendário: a temporada inteira numa lista compacta (duas colunas na tela deitada) e, ao lado,
 * a etapa escolhida com o traçado e as características da pista. Abre na etapa em andamento ou
 * na próxima.
 */
export function CalendarScreen() {
  const { career, player, drivers, category } = useCareerView();
  const credit = career.calendar.map((event) => trackCredit(event.trackId)).find((text) => text !== null) ?? null;
  const upcoming = career.weekend ? career.weekend.round : career.calendar[career.nextRoundIndex]?.round;
  const [chosen, setChosen] = useState<number | null>(null);
  const selected = career.calendar.find((e) => e.round === (chosen ?? upcoming)) ?? career.calendar[career.calendar.length - 1];
  const resultOf = (round: number) => {
    const record = career.rounds.find((r) => r.round === round);
    return { record, mine: record?.race.entries.find((e) => e.driverId === player.id) };
  };
  const held = selected ? resultOf(selected.round) : { record: undefined, mine: undefined };
  const winner = drivers[held.record?.race.entries[0]?.driverId ?? ''];

  return (
    <div>
      <PageHeader eyebrow={`${category.name} · ${career.year}`} title="Calendário">
        <span className="text-sm text-ink-400">
          {career.rounds.length} de {career.calendar.length} etapas disputadas
        </span>
      </PageHeader>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card padded={false}>
          <ol
            className="grid gap-px bg-ink-800 md:auto-cols-fr md:grid-flow-col"
            style={{ gridTemplateRows: `repeat(${Math.ceil(career.calendar.length / 2)}, auto)` }}
          >
            {career.calendar.map((event) => {
              const track = getTrack(event.trackId);
              const { record, mine } = resultOf(event.round);
              const isUpcoming = event.round === upcoming;
              const isSelected = event.round === selected?.round;
              return (
                <li key={event.round} className="min-w-0 bg-ink-900">
                  <button
                    type="button"
                    onClick={() => setChosen(event.round)}
                    aria-pressed={isSelected}
                    className={cx(
                      'flex min-h-11 w-full items-center gap-2 px-2 py-1 text-left transition-colors',
                      isSelected ? 'bg-ink-700 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-850',
                    )}
                  >
                    <span className={cx('w-5 shrink-0 font-display text-lg font-bold leading-none', isUpcoming ? 'text-apex-400' : 'text-ink-500')}>
                      {String(event.round).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold uppercase leading-tight text-ink-100 lg:text-base lg:leading-tight">
                        {track.name}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-ink-400">
                        {formatDate(event.date).replace(/ \d{4}$/, '')} · {track.city}
                      </span>
                    </span>
                    {record ? (
                      <ResultChips className="shrink-0" results={[{ round: event.round, position: mine?.position ?? null, dnf: mine?.status === 'dnf' }]} />
                    ) : isUpcoming ? (
                      <Flag size={16} strokeWidth={2.25} className="mx-1 shrink-0 text-apex-400" aria-label={career.weekend ? 'Em andamento' : 'Próxima'} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>

        {selected && (
          <EventDetail
            round={selected.round}
            total={career.calendar.length}
            date={selected.date}
            trackId={selected.trackId}
            status={
              held.record ? (
                held.mine ? (
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                    {held.mine.points} pts
                    <PositionBadge position={held.mine.position} dnf={held.mine.status === 'dnf'} />
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">Não disputou</span>
                )
              ) : career.weekend?.round === selected.round ? (
                <Pill tone="accent">Em andamento</Pill>
              ) : selected.round === upcoming ? (
                <Pill tone="accent">Próxima</Pill>
              ) : undefined
            }
          >
            {held.record && (
              <div className="flex items-center justify-between gap-3 border-t border-ink-700 pt-2.5 text-xs text-ink-400">
                <span className="min-w-0">
                  Vencedor: <b className="font-semibold text-ink-200">{winner ? fullName(winner) : '-'}</b>
                </span>
                <span className="shrink-0">
                  <WeatherBadge weather={held.record.race.weather} />
                </span>
              </div>
            )}
          </EventDetail>
        )}
      </div>
      {credit && <p className="mt-3 text-[11px] text-ink-500">Traçados das pistas: {credit}</p>}
    </div>
  );
}

function EventDetail({
  round,
  total,
  date,
  trackId,
  status,
  children,
}: {
  round: number;
  total: number;
  date: string;
  trackId: string;
  /** À direita do título: o resultado do jogador, ou se a etapa é a próxima ou está em andamento. */
  status: ReactNode;
  /** Vencedor e clima, quando a etapa já foi disputada. */
  children: ReactNode;
}) {
  const { category } = useCareerView();
  const track = getTrack(trackId);
  return (
    <Card
      title={`Etapa ${round} de ${total}`}
      action={status}
      bodyClassName="space-y-2.5 p-3"
    >
      {/* O traçado tem largura fixa e não encolhe: o texto fica na coluna ao lado, sem cruzar o desenho. */}
      <div className="flex items-center gap-3">
        <CircuitMap track={track} style={category.vehicle} className="h-20 w-28 shrink-0 lg:h-28 lg:w-40" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-bold uppercase leading-none">{track.name}</div>
          <div className="mt-1 text-xs text-ink-300">{trackLocation(track)}</div>
          <div className="text-xs text-ink-400">{formatDate(date)}</div>
          <div className="text-xs text-ink-400">
            {raceLaps(track, category)} voltas · {track.lengthMeters} m
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Trait label="Ultrapassagem" value={describeOvertaking(track.overtakingDifficulty)} />
        <Trait label="Desgaste de pneus" value={describeTyreWear(track.tyreWear)} />
        <Trait label="Pista" value={describePower(track.powerSensitivity)} />
        <Trait label="Chance de chuva" value={`${Math.round(track.rainChance * 100)}%`} />
      </dl>
      {children}
    </Card>
  );
}

function Trait({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-ink-400">{label}</dt>
      <dd className="font-semibold leading-tight text-ink-100">{value}</dd>
    </div>
  );
}
