import { useMemo } from 'react';
import { ATTRIBUTE_KEYS } from '@/domain/schemas';
import { ATTRIBUTE_DESCRIPTIONS, ATTRIBUTE_LABELS } from '@/domain/labels';
import { NATIONALITIES } from '@/data/rules';
import { computeCareerStats, fullName, overallRating } from '@/engine';
import { TrainingFocusPicker } from '../components/TrainingFocusPicker';
import { Card, Meter, PageHeader, Pill, RatingBar, Stat, cx } from '../components/ui';
import { formatRating, signed } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';

export function DriverScreen() {
  const { career, player, team } = useCareerView();
  const stats = useMemo(() => computeCareerStats(career, player.id), [career, player.id]);
  const start = career.playerSeasonStartAttributes;
  const overall = overallRating(player.attributes);
  const overallDelta = overall - overallRating(start);
  const nationality = NATIONALITIES.find((n) => n.code === player.nationality)?.name ?? player.nationality;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Perfil do piloto" title={fullName(player)}>
        <span className="text-sm text-ink-400">{nationality} · {player.age} anos · {team.name}</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Atributos" action={<span className="text-xs text-ink-400">Variação desde o início da temporada</span>}>
          <ul className="space-y-4">
            {ATTRIBUTE_KEYS.map((key) => {
              const value = player.attributes[key];
              const delta = value - start[key];
              return (
                <li key={key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{ATTRIBUTE_LABELS[key]}</span>
                    <span className="flex items-baseline gap-2">
                      {Math.abs(delta) >= 0.05 && <span className={cx('text-xs tabular', delta > 0 ? 'text-go-400' : 'text-apex-400')}>{signed(delta)}</span>}
                      <span className="w-8 text-right font-display text-xl font-bold tabular">{formatRating(value)}</span>
                    </span>
                  </div>
                  <RatingBar value={value} previous={start[key]} />
                  <p className="mt-1 text-xs text-ink-400">{ATTRIBUTE_DESCRIPTIONS[key]}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Avaliação">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Geral" value={formatRating(overall)} hint={Math.abs(overallDelta) >= 0.05 ? `${signed(overallDelta)} na temporada` : undefined} accent />
              <Stat label="Potencial" value={player.potential} hint="Teto dos atributos" />
              <Stat label="Reputação" value={career.reputation} hint="De 0 a 100" />
            </div>
            <p className="mt-4 text-xs text-ink-400">A nota geral é uma média ponderada dos atributos, com a velocidade pesando mais. O potencial limita até onde o treino leva cada atributo.</p>
          </Card>

          <Card title="Condição" action={player.injury ? <Pill tone="bad">Lesionado</Pill> : undefined}>
            <div className="space-y-4">
              <Meter label="Fase" value={player.condition.form} hint="Média dos resultados recentes em relação à meta. Vale até ±0,12% no tempo de volta." />
              <Meter label="Confiança" value={player.condition.confidence} hint="Muda a chance de erro (de −25% a +25%) e o sucesso nas disputas de posição." />
              <Meter label="Moral" value={player.condition.morale} hint="Muda a regularidade das voltas e o rendimento do treino (de −20% a +20%)." />
            </div>
            {player.injury && (
              <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {player.injury.description}: {player.injury.severity === 'serious' ? 'você não pode correr' : 'você pode correr, 0,3% mais lento e com 30% mais erros'}. Recuperação em {counted(player.injury.roundsRemaining, 'etapa', 'etapas')}.
              </p>
            )}
            {player.age >= 31 && <p className="mt-4 text-xs text-gold-400">Aos {player.age} anos, a velocidade, a concentração e a ultrapassagem caem um pouco a cada temporada.</p>}
          </Card>

          <Card title="Estatísticas de carreira">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Corridas" value={stats.starts} />
              <Stat label="Vitórias" value={stats.wins} />
              <Stat label="Pódios" value={stats.podiums} />
              <Stat label="Poles" value={stats.poles} />
              <Stat label="Voltas + rápidas" value={stats.fastestLaps} />
              <Stat label="Pontos" value={stats.points} />
              <Stat label="Melhor resultado" value={stats.bestFinish ? `${stats.bestFinish}º` : '-'} />
              <Stat label="Abandonos" value={stats.dnfs} />
              <Stat label="Títulos" value={stats.titles} />
            </div>
          </Card>

          <Card title="Programa de treino">
            <TrainingFocusPicker />
          </Card>
        </div>
      </div>
    </div>
  );
}
