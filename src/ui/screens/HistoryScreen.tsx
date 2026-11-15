import { useEffect, useMemo, useState } from 'react';
import type { RoundRecord } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { computeCareerStats, driverRoundResults, fullName } from '@/engine';
import { RaceResultTable } from '../components/RaceResultTable';
import { Card, EmptyState, PageHeader, PositionBadge, Stat, Tabs, WeatherBadge, cx } from '../components/ui';
import { formatDate } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { scrollToElement } from '../motion';

/** Cor de cada corrida na sequência da carreira: pódio em verde, abandono em âmbar, o resto neutro. */
const SEQUENCE = [
  { key: 'podium', label: 'Pódio', color: 'bg-go-400' },
  { key: 'top10', label: 'Até 10º', color: 'bg-ink-300' },
  { key: 'other', label: 'Depois do 10º', color: 'bg-ink-600' },
  { key: 'dnf', label: 'Abandono', color: 'bg-gold-400' },
] as const;

function sequenceColor(position: number, dnf: boolean): string {
  const key = dnf ? 'dnf' : position <= 3 ? 'podium' : position <= 10 ? 'top10' : 'other';
  return SEQUENCE.find((s) => s.key === key)?.color ?? 'bg-ink-600';
}

const RESULT_ID = 'resultado-da-etapa';

/**
 * Histórico: o resumo da carreira numa faixa, as etapas da temporada escolhida numa grade compacta
 * e, embaixo, o resultado completo da etapa em que o jogador tocar.
 */
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
  // Em temporadas de gerações anteriores, o "seu" resultado é o do personagem da época.
  const lineage = career.dynasty.lineage.map((l) => l.driverId);
  const mineIn = (record: RoundRecord) =>
    record.race.entries.find((e) => e.driverId === player.id) ?? record.race.entries.find((e) => lineage.includes(e.driverId));
  const shown = current.rounds.find((r) => r.round === open);
  // O resultado abre embaixo da grade: se ficou fora da tela, a página rola até ele.
  useEffect(() => {
    if (open === null) return;
    const result = document.getElementById(RESULT_ID);
    if (result && result.getBoundingClientRect().top > window.innerHeight - 120) scrollToElement(RESULT_ID);
  }, [open]);
  const pickSeason = (value: string) => {
    setSelected(value);
    setOpen(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Carreira" title="Histórico de resultados">
        {seasons.length > 1 && seasons.length <= 3 && (
          <Tabs value={selected} onChange={pickSeason} options={seasons.map((s) => ({ value: String(s.season), label: `${s.year} · ${getCategory(s.categoryId).shortName}` }))} />
        )}
        {seasons.length > 3 && (
          <label className="flex items-center gap-2 text-sm text-ink-300">
            Temporada
            <select
              value={selected}
              onChange={(e) => pickSeason(e.target.value)}
              className="min-h-11 border border-ink-700 bg-ink-800 px-3 text-sm font-semibold text-ink-100 focus:border-apex-500 focus:outline-none"
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

      <Card title="Resumo da carreira" bodyClassName="grid items-center gap-x-6 gap-y-3 p-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
          <Stat label="Temporadas" value={career.history.length + 1} />
          <Stat label="Corridas" value={stats.starts} />
          <Stat label="Vitórias" value={stats.wins} accent />
          <Stat label="Pódios" value={stats.podiums} />
          <Stat label="Pontos" value={stats.points} />
          <Stat label="Títulos" value={stats.titles} />
        </div>
        {all.length > 0 && (
          <div className="min-w-0">
            <div className="flex flex-wrap gap-0.5" role="group" aria-label="Sequência de resultados">
              {all.map((r) => (
                <span
                  key={`${r.season}-${r.record.round}`}
                  title={`${r.year} · Etapa ${r.record.round}: ${r.entry.status === 'dnf' ? 'abandono' : `${r.entry.position}º`}`}
                  className={cx('h-3 w-1.5', sequenceColor(r.entry.position, r.entry.status === 'dnf'))}
                />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-tight text-ink-400">
              {SEQUENCE.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <span aria-hidden className={cx('h-2 w-2', s.color)} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        title={`Temporada ${current.year} · ${getCategory(current.categoryId).name}`}
        action={current.rounds.length > 0 ? <span className="hidden text-xs text-ink-400 sm:inline">Toque numa etapa para ver o resultado</span> : undefined}
        padded={false}
      >
        {current.summary && (
          <div className="border-b border-ink-700 p-3">
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
              <Stat
                label="Campeão"
                value={<span className="block pt-1 text-lg leading-[1.1]">{current.summary.driverNames[current.summary.championDriverId] ?? '-'}</span>}
              />
              <Stat
                label={current.summary.mode === 'executive' ? 'Posição da equipe' : 'Sua posição'}
                value={current.summary.mode === 'executive' && !current.summary.playerTeamId ? '-' : `${current.summary.playerPosition}º`}
                accent
              />
              <Stat label={current.summary.mode === 'executive' ? 'Pontos da equipe' : 'Seus pontos'} value={current.summary.playerPoints} />
              <Stat label="Meta" value={`${current.summary.objectiveTarget}º`} hint={current.summary.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
            </div>
            <div className="mt-1.5 text-xs text-ink-400">
              {current.summary.mode === 'executive' ? 'Temporada como dirigente' : 'Temporada como piloto'} · Equipe: {current.summary.playerTeamName}
              {current.rounds.some((r) => r.race.entries.length < 10)
                ? ' · Temporada antiga: o arquivo guarda o pódio e os resultados da família em cada etapa.'
                : ''}
            </div>
          </div>
        )}
        {current.rounds.length === 0 ? (
          <div className="p-3">
            <EmptyState title="Nenhuma etapa disputada">Os resultados aparecem aqui depois de cada corrida.</EmptyState>
          </div>
        ) : (
          <ol className="grid gap-px bg-ink-800 sm:grid-cols-2 md:grid-cols-3">
            {current.rounds.map((record) => {
              const mine = mineIn(record);
              const isShown = record.round === shown?.round;
              return (
                <li key={record.round} className="min-w-0 bg-ink-900">
                  <button
                    type="button"
                    onClick={() => setOpen(isShown ? null : record.round)}
                    aria-pressed={isShown}
                    className={cx(
                      'flex min-h-11 w-full items-center gap-2 px-2.5 py-1 text-left transition-colors',
                      isShown ? 'bg-ink-700 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-850',
                    )}
                  >
                    <span className="w-5 shrink-0 font-display text-lg font-bold leading-none text-ink-500">{String(record.round).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold uppercase leading-tight text-ink-100 lg:text-base lg:leading-tight">
                        {getTrack(record.trackId).name}
                      </span>
                      <span className="block truncate text-[11px] leading-tight text-ink-400">
                        {mine
                          ? `Largada ${mine.grid}º · ${mine.status === 'dnf' ? 'abandono' : `${mine.points} pts`}`
                          : 'Não disputou'}
                      </span>
                    </span>
                    {mine && <PositionBadge position={mine.position} dnf={mine.status === 'dnf'} />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {shown && <RoundResult record={shown} mine={mineIn(shown)} names={current.names} colors={current.colors} />}
    </div>
  );
}

/** Resultado completo de uma etapa: quem venceu, como foi a corrida do jogador e a tabela oficial. */
function RoundResult({
  record,
  mine,
  names,
  colors,
}: {
  record: RoundRecord;
  mine: RoundRecord['race']['entries'][number] | undefined;
  names?: Record<string, string>;
  colors?: Record<string, string>;
}) {
  const { drivers } = useCareerView();
  const winner = record.race.entries[0];
  const track = getTrack(record.trackId);
  return (
    <Card
      title={<span id={RESULT_ID} className="scroll-mt-16">{`Etapa ${record.round} · ${track.name}`}</span>}
      action={<WeatherBadge weather={record.race.weather} compact />}
      padded={false}
    >
      <div className="px-4 pt-2 text-xs text-ink-400">
        {formatDate(record.date)} ·{' '}
        {mine
          ? `Largada ${mine.grid}º · ${mine.status === 'dnf' ? `Abandono (${DNF_LABELS[mine.dnfReason ?? 'crash']})` : `${mine.points} pts`}`
          : 'Não disputou'}
        {winner && ` · Vencedor: ${names?.[winner.driverId] ?? (drivers[winner.driverId] ? fullName(drivers[winner.driverId]!) : winner.driverId)}`}
      </div>
      <div className="px-4 pb-2">
        <RaceResultTable result={record.race} names={names} colors={colors} />
      </div>
    </Card>
  );
}
