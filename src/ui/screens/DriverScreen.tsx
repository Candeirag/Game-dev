import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ATTRIBUTE_KEYS, type AttributeKey } from '@/domain/schemas';
import { ATTRIBUTE_DESCRIPTIONS, ATTRIBUTE_LABELS } from '@/domain/labels';
import { NATIONALITIES } from '@/data/rules';
import { computeCareerStats, fullName, overallRating } from '@/engine';
import { TrainingFocusPicker } from '../components/TrainingFocusPicker';
import { Card, cx, Delta, Meter, PageHeader, Pill, RatingBar, Ring, Stat, Tabs } from '@/ui/kit';
import { TrendLine, attributeSeries } from '../components/TrendLine';
import { formatRating } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';

type DriverTab = 'attributes' | 'condition' | 'stats';
const TABS: { value: DriverTab; label: string }[] = [
  { value: 'attributes', label: 'Atributos' },
  { value: 'condition', label: 'Condição e treino' },
  { value: 'stats', label: 'Números' },
];

/** Variação de um atributo na temporada: ganho em verde, perda em âmbar. Nada quando não mudou. */
export function DriverScreen() {
  const { career, player, team } = useCareerView();
  const stats = useMemo(() => computeCareerStats(career, player.id), [career, player.id]);
  // A aba fica no endereço (?tab=...), como nas outras telas com abas.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: DriverTab = TABS.find((t) => t.value === requested)?.value ?? 'attributes';
  const setTab = (next: DriverTab) => setParams(next === 'attributes' ? {} : { tab: next }, { replace: true });
  // Atributo aberto no quadro de explicação (só no formato largo; em pé, a explicação vai na lista).
  const [selected, setSelected] = useState<AttributeKey | null>(null);
  const start = career.playerSeasonStartAttributes;
  const overall = overallRating(player.attributes);
  const overallDelta = overall - overallRating(start);
  const nationality = NATIONALITIES.find((n) => n.code === player.nationality)?.name ?? player.nationality;

  return (
    <div className="space-y-3">
      <PageHeader eyebrow={`${nationality} · ${player.age} anos · ${team.name}`} title={fullName(player)}>
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </PageHeader>

      {tab === 'attributes' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card title="Atributos" action={<span className="text-xs text-ink-400">Variação desde o início da temporada</span>} bodyClassName="px-2 py-1">
            <ul className="grid gap-x-3 md:grid-cols-2">
              {ATTRIBUTE_KEYS.map((key) => {
                const value = player.attributes[key];
                const active = selected === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(active ? null : key)}
                      className={cx(
                        'block min-h-11 w-full px-2 py-1 text-left transition-colors',
                        active ? 'md:bg-ink-800 md:shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'md:hover:bg-ink-850',
                      )}
                    >
                      <span className="mb-1 flex h-5 items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{ATTRIBUTE_LABELS[key]}</span>
                        <span className="shrink-0 font-display text-xl font-bold leading-none">{formatRating(value)}</span>
                      </span>
                      {/* A variação tem lugar reservado, para as barras terem todas o mesmo comprimento. */}
                      <span className="flex items-center gap-2">
                        <span className="block min-w-0 flex-1">
                          <RatingBar value={value} previous={start[key]} />
                        </span>
                        <span className="flex h-3 w-11 shrink-0 justify-end">
                          <Delta value={value - start[key]} className="text-2xs leading-3" />
                        </span>
                      </span>
                      <span className="mt-1 block text-xs font-normal text-ink-400 md:hidden">{ATTRIBUTE_DESCRIPTIONS[key]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Avaliação" action={<Delta value={overallDelta} suffix=" na temporada" className="text-xs" />} bodyClassName="p-3">
            <div className="flex items-center gap-4">
              <Ring value={formatRating(overall)} label="Geral" fraction={overall / 100} tone="accent" size={76} />
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                <Stat label="Potencial" value={formatRating(player.potential)} />
                <Stat label="Reputação" value={career.reputation} />
              </div>
            </div>
            {/* Evolução por temporada: a nota geral ou, com um atributo aberto, a dele. */}
            <div className="mt-3 border-t border-ink-700 pt-3">
              <TrendLine
                title={selected ? ATTRIBUTE_LABELS[selected] : 'Nota geral'}
                values={attributeSeries(career, player.id, selected ?? 'overall', selected ? player.attributes[selected] : overall)}
                format={(v) => formatRating(v)}
                tone="good"
                threshold={0.5}
              />
            </div>
            <div className="mt-3 border-t border-ink-700 pt-3 text-xs text-ink-400 md:min-h-[6.25rem]">
              {selected && (
                <div className="hidden md:block">
                  <h3 className="font-display text-base font-semibold uppercase tracking-[0.06em] text-ink-200">{ATTRIBUTE_LABELS[selected]}</h3>
                  <p className="mt-1 text-ink-300">{ATTRIBUTE_DESCRIPTIONS[selected]}</p>
                </div>
              )}
              <p className={cx(selected && 'md:hidden')}>
                A nota geral é uma média ponderada dos atributos, com a velocidade pesando mais. O potencial é o teto dos atributos no treino; a reputação vai
                de 0 a 100. <span className="hidden md:inline">Toque em um atributo para ver o que ele faz.</span>
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'condition' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <Card title="Condição" action={player.injury ? <Pill tone="bad">Lesionado</Pill> : undefined} bodyClassName="space-y-3 p-3">
            <Meter label="Fase" value={player.condition.form} hint="Média dos resultados recentes em relação à meta. Vale até ±0,12% no tempo de volta." />
            <Meter label="Confiança" value={player.condition.confidence} hint="Muda a chance de erro (de −25% a +25%) e o sucesso nas disputas de posição." />
            <Meter label="Moral" value={player.condition.morale} hint="Muda a regularidade das voltas e o rendimento do treino (de −20% a +20%)." />
            {player.injury && (
              <p className="border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm text-ink-100">
                {player.injury.description}:{' '}
                {player.injury.severity === 'serious' ? 'você não pode correr' : 'você pode correr, 0,3% mais lento e com 30% mais erros'}. Recuperação em{' '}
                {counted(player.injury.roundsRemaining, 'etapa', 'etapas')}.
              </p>
            )}
            {player.age >= 31 && (
              <p className="text-xs text-gold-400">Aos {player.age} anos, a velocidade, a concentração e a ultrapassagem caem um pouco a cada temporada.</p>
            )}
          </Card>

          <Card title="Programa de treino" bodyClassName="p-3">
            <TrainingFocusPicker />
          </Card>
        </div>
      )}

      {tab === 'stats' && (
        <Card title="Estatísticas de carreira" bodyClassName="grid grid-cols-3 gap-x-4 gap-y-4 p-4 md:grid-cols-5">
          <Stat label="Corridas" value={stats.starts} />
          <Stat label="Vitórias" value={stats.wins} />
          <Stat label="Pódios" value={stats.podiums} />
          <Stat label="Poles" value={stats.poles} />
          <Stat label="Voltas + rápidas" value={stats.fastestLaps} />
          <Stat label="Pontos" value={stats.points} />
          <Stat label="Melhor resultado" value={stats.bestFinish ? `${stats.bestFinish}º` : '-'} />
          <Stat label="Abandonos" value={stats.dnfs} />
          <Stat label="Ultrapassagens" value={stats.overtakes} />
          <Stat label="Títulos" value={stats.titles} />
        </Card>
      )}
    </div>
  );
}
