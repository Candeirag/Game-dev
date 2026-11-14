import { useMemo, useState } from 'react';
import type { RoundRecord } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { computeCareerStats, driverRoundResults, fullName } from '@/engine';
import { RaceResultTable } from '../components/RaceResultTable';
import { Card, EmptyState, PageHeader, PositionBadge, Stat, Tabs, WeatherBadge, cx } from '../components/ui';
import { formatDate } from '../format';
import { useCareerView } from '../hooks/useCareer';

export function HistoryScreen() {
  const { career, player } = useCareerView();
  const seasons = useMemo(
    () => [
      ...career.history.map((h) => ({
        season: h.season,
        year: h.year,
        categoryId: h.categoryId,
        rounds: h.rounds,
        names: h.driverNames,
        colors: h.teamColors,
        summary: h,
      })),
      {
        season: career.season,
        year: career.year,
        categoryId: career.categoryId,
        rounds: career.rounds,
        names: undefined,
        colors: undefined,
        summary: undefined,
      },
    ],
    [career],
  );
  const [selected, setSelected] = useState(String(career.season));
  const [open, setOpen] = useState<number | null>(null);
  const current = seasons.find((s) => String(s.season) === selected) ?? seasons[seasons.length - 1]!;
  const stats = useMemo(() => computeCareerStats(career, player.id), [career, player.id]);
  const all = useMemo(() => driverRoundResults(career, player.id), [career, player.id]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Carreira" title="Histórico de resultados">
        {seasons.length > 1 && seasons.length <= 6 && (
          <Tabs
            value={selected}
            onChange={(v) => {
              setSelected(v);
              setOpen(null);
            }}
            options={seasons.map((s) => ({ value: String(s.season), label: `${s.year} · ${getCategory(s.categoryId).shortName}` }))}
          />
        )}
        {seasons.length > 6 && (
          <label className="text-sm text-ink-300">
            Temporada{' '}
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setOpen(null);
              }}
              className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 focus:border-apex-500 focus:outline-none"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s.season} value={String(s.season)}>
                  {s.year} · {getCategory(s.categoryId).shortName}
                </option>
              ))}
            </select>
          </label>
        )}
      </PageHeader>

      <Card title="Resumo da carreira">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          <Stat label="Temporadas" value={career.history.length + 1} />
          <Stat label="Corridas" value={stats.starts} />
          <Stat label="Vitórias" value={stats.wins} accent />
          <Stat label="Pódios" value={stats.podiums} />
          <Stat label="Pontos" value={stats.points} />
          <Stat label="Títulos" value={stats.titles} />
        </div>
        {all.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Sequência de resultados">
            {all.map((r) => (
              <span
                key={`${r.season}-${r.record.round}`}
                title={`${r.year} · Etapa ${r.record.round}: ${r.entry.status === 'dnf' ? 'abandono' : `${r.entry.position}º`}`}
                className={cx(
                  'h-5 w-2 rounded-sm',
                  r.entry.status === 'dnf' ? 'bg-ink-700' : r.entry.position <= 3 ? 'bg-gold-400' : r.entry.position <= 10 ? 'bg-go-400' : 'bg-ink-500',
                )}
              />
            ))}
          </div>
        )}
      </Card>

      {current.summary && (
        <Card title={`Temporada ${current.year} · ${getCategory(current.categoryId).name}`}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Campeão" value={<span className="text-lg">{current.summary.driverNames[current.summary.championDriverId] ?? '-'}</span>} />
            <Stat
              label={current.summary.mode === 'executive' ? 'Posição da equipe' : 'Sua posição'}
              value={current.summary.mode === 'executive' && !current.summary.playerTeamId ? '-' : `${current.summary.playerPosition}º`}
              accent
            />
            <Stat label={current.summary.mode === 'executive' ? 'Pontos da equipe' : 'Seus pontos'} value={current.summary.playerPoints} />
            <Stat label="Meta" value={`${current.summary.objectiveTarget}º`} hint={current.summary.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
          </div>
          <div className="mt-2 text-sm text-ink-400">
            {current.summary.mode === 'executive' ? 'Temporada como dirigente' : 'Temporada como piloto'} · Equipe: {current.summary.playerTeamName}
            {current.rounds.some((r) => r.race.entries.length < 10)
              ? ' · Temporada antiga: o arquivo guarda o pódio e os resultados da família em cada etapa.'
              : ''}
          </div>
        </Card>
      )}

      {current.rounds.length === 0 ? (
        <EmptyState title="Nenhuma etapa disputada">Os resultados aparecem aqui depois de cada corrida.</EmptyState>
      ) : (
        <div className="space-y-3">
          {[...current.rounds].reverse().map((record) => (
            <RoundRow
              key={record.round}
              record={record}
              names={current.names}
              colors={current.colors}
              expanded={open === record.round}
              onToggle={() => setOpen(open === record.round ? null : record.round)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundRow({
  record,
  names,
  colors,
  expanded,
  onToggle,
}: {
  record: RoundRecord;
  names?: Record<string, string>;
  colors?: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { career, player, drivers } = useCareerView();
  // Em temporadas de gerações anteriores, o "seu" resultado é o do personagem da época.
  const lineage = career.dynasty.lineage.map((l) => l.driverId);
  const mine = record.race.entries.find((e) => e.driverId === player.id) ?? record.race.entries.find((e) => lineage.includes(e.driverId));
  const winner = record.race.entries[0];
  const track = getTrack(record.trackId);
  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left hover:bg-ink-850"
      >
        {mine && <PositionBadge position={mine.position} dnf={mine.status === 'dnf'} />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            Etapa {record.round} · {track.name}
          </div>
          <div className="text-xs text-ink-400">
            {formatDate(record.date)} ·{' '}
            {mine
              ? `Largada ${mine.grid}º · ${mine.status === 'dnf' ? `Abandono (${DNF_LABELS[mine.dnfReason ?? 'crash']})` : `${mine.points} pts`}`
              : 'Não disputou'}
            {winner && ` · Vencedor: ${names?.[winner.driverId] ?? (drivers[winner.driverId] ? fullName(drivers[winner.driverId]!) : winner.driverId)}`}
          </div>
        </div>
        <WeatherBadge weather={record.race.weather} compact />
        <span className="text-ink-400" aria-hidden>
          {expanded ? '▴' : '▾'}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-ink-800 px-4 pb-2">
          <RaceResultTable result={record.race} names={names} colors={colors} />
        </div>
      )}
    </Card>
  );
}
