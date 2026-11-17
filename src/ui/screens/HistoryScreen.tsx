import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RoundRecord } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { computeCareerStats, driverRoundResults, fullName } from '@/engine';
import { RaceResultTable } from '../components/RaceResultTable';
import { Card, cx, EmptyState, PageHeader, PositionBadge, Stat, Tabs, WeatherBadge } from '@/ui/kit';
import { formatDate } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { useReveal } from './useReveal';

/**
 * Cada corrida na sequência da carreira é uma barrinha. O resultado aparece na altura e na forma,
 * não só na cor: pódio alto e verde; até 10º médio; depois do 10º baixo; abandono vazado, em âmbar.
 */
const SEQUENCE = [
  { key: 'podium', label: 'Pódio', color: 'h-4 bg-go-400' },
  { key: 'top10', label: 'Até 10º', color: 'h-3 bg-ink-300' },
  { key: 'other', label: 'Depois do 10º', color: 'h-1.5 bg-ink-500' },
  { key: 'dnf', label: 'Abandono', color: 'h-4 border border-gold-400' },
] as const;

function sequenceColor(position: number, dnf: boolean): string {
  const key = dnf ? 'dnf' : position <= 3 ? 'podium' : position <= 10 ? 'top10' : 'other';
  return SEQUENCE.find((s) => s.key === key)?.color ?? 'h-1.5 bg-ink-500';
}

const RESULT_ID = 'resultado-da-etapa';
const STEP_BUTTON = 'grid h-11 w-11 place-items-center text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-100';

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
  useReveal(RESULT_ID, open);
  const step = (offset: number) => {
    const next = shown ? current.rounds[current.rounds.indexOf(shown) + offset] : undefined;
    return next ? () => setOpen(next.round) : undefined;
  };
  const pickSeason = (value: string) => {
    setSelected(value);
    setOpen(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Carreira" title="Histórico de resultados">
        {seasons.length > 1 && seasons.length <= 3 && (
          <Tabs
            value={selected}
            onChange={pickSeason}
            options={seasons.map((s) => ({ value: String(s.season), label: `${s.year} · ${getCategory(s.categoryId).shortName}` }))}
          />
        )}
        {seasons.length > 3 && (
          <label className="flex items-center gap-2 text-sm text-ink-300">
            Temporada
            <select
              value={selected}
              onChange={(e) => pickSeason(e.target.value)}
              className="min-h-11 border border-ink-500 bg-ink-800 px-3 text-sm font-semibold text-ink-100 focus:border-apex-500 focus:outline-none"
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
            <div className="flex flex-wrap items-end gap-1" role="group" aria-label="Sequência de resultados">
              {all.map((r) => (
                <span
                  key={`${r.season}-${r.record.round}`}
                  title={`${r.year} · Etapa ${r.record.round}: ${r.entry.status === 'dnf' ? 'abandono' : `${r.entry.position}º`}`}
                  className={cx('w-1.5', sequenceColor(r.entry.position, r.entry.status === 'dnf'))}
                />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-2xs leading-tight text-ink-400">
              {SEQUENCE.map((s) => (
                <span key={s.key} className="inline-flex items-end gap-1">
                  <span aria-hidden className={cx('w-1.5', s.color)} />
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
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
            <div className="mt-2 text-xs text-ink-400">
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
                      'flex min-h-11 w-full items-center gap-2 px-2 py-1 text-left transition-colors',
                      isShown ? 'bg-ink-800 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-850',
                    )}
                  >
                    <span className="w-5 shrink-0 font-display text-lg font-bold leading-none text-ink-400">{String(record.round).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base font-semibold uppercase leading-tight text-ink-100">
                        {getTrack(record.trackId).name}
                      </span>
                      <span className="block truncate text-2xs leading-tight text-ink-400">
                        {mine ? `Largada ${mine.grid}º · ${mine.status === 'dnf' ? 'abandono' : `${mine.points} pts`}` : 'Não disputou'}
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

      {shown && (
        <div id={RESULT_ID} className="scroll-mt-16">
          <RoundResult record={shown} mine={mineIn(shown)} names={current.names} colors={current.colors} onPrevious={step(-1)} onNext={step(1)} />
        </div>
      )}
    </div>
  );
}

/** Resultado completo de uma etapa: quem venceu, como foi a corrida do jogador e a tabela oficial. */
function RoundResult({
  record,
  mine,
  names,
  colors,
  onPrevious,
  onNext,
}: {
  record: RoundRecord;
  mine: RoundRecord['race']['entries'][number] | undefined;
  names?: Record<string, string>;
  colors?: Record<string, string>;
  /** Passam para a etapa vizinha sem voltar à grade; ausentes na primeira e na última. */
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const { drivers } = useCareerView();
  const winner = record.race.entries[0];
  const track = getTrack(record.trackId);
  return (
    <Card
      title={`Etapa ${record.round} · ${track.name}`}
      action={
        <span className="-mr-3 flex shrink-0">
          <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="Etapa anterior" className={STEP_BUTTON}>
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Próxima etapa" className={STEP_BUTTON}>
            <ChevronRight size={18} aria-hidden />
          </button>
        </span>
      }
      padded={false}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-2 text-xs text-ink-400">
        <span>
          {formatDate(record.date)} ·{' '}
          {mine
            ? `Largada ${mine.grid}º · ${mine.status === 'dnf' ? `Abandono (${DNF_LABELS[mine.dnfReason ?? 'crash']})` : `${mine.points} pts`}`
            : 'Não disputou'}
          {winner && ` · Vencedor: ${names?.[winner.driverId] ?? (drivers[winner.driverId] ? fullName(drivers[winner.driverId]!) : winner.driverId)}`}
        </span>
        <WeatherBadge weather={record.race.weather} compact />
      </div>
      <div className="px-4 pb-2">
        <RaceResultTable result={record.race} names={names} colors={colors} />
      </div>
    </Card>
  );
}
