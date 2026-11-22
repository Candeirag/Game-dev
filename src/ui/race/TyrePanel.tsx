/**
 * Painel de pneus do jogador (Fase 4): o desgaste em número e em palavra, a barra com a marca do
 * penhasco, o gráfico pequeno do tempo de volta e até quando o pneu vai (a janela ideal de parada
 * ou, no kart, a volta em que ele cai do penhasco).
 *
 * Tudo sai do que já apareceu na imagem (o desgaste e a volta mostrados), nunca do estado
 * adiantado do motor. As contas são do motor (`tyreState`, `pitWindow`, `lapsToCliff`); aqui só se
 * escolhe o que mostrar.
 *
 * - `compact`: o resumo de três linhas baixas que fica sempre à vista, sem abrir gaveta: na barra
 *   superior da corrida (tela deitada) ou no cartão do piloto em foco (em pé).
 * - completo: na gaveta ou aba "Piloto", em "Boxes" e no painel "Meu carro" da cronometragem.
 */
import { CircleCheck, Timer, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { getTrack } from '@/data/tracks';
import type { TyreCompound } from '@/domain/schemas';
import { useGameStore } from '@/store/gameStore';
import { cx, Sparkline, type Tone, TyreGauge } from '@/ui/kit';
import { formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { playerRaceProfile, tyreOutlook, type TyreOutlook } from './raceInfo';

/** O pneu do jogador como está na tela. */
export interface ShownTyre {
  compound: TyreCompound;
  /** Desgaste de 0 (novo) a 1 (no fim), ao fim da última volta completa mostrada. */
  wear: number;
  /** Última volta completa do jogador na imagem (0 no grid). */
  lap: number;
  totalLaps: number;
  /** Tempos das últimas voltas mostradas, da mais antiga para a mais recente (ver `shownLapTimes`). */
  times: readonly number[];
  /** O carro ainda está na prova: fora dela (abandono, bandeirada) não há previsão a dar. */
  state: 'running' | 'retired' | 'finished';
}

const OUTLOOK_TEXT: Record<Tone, string> = { neutral: 'text-ink-100', good: 'text-go-400', attention: 'text-gold-400', accent: 'text-ink-100' };
const OUTLOOK_ICON = { neutral: Timer, good: CircleCheck, attention: TriangleAlert, accent: Timer } as const;

/** Até quando o pneu do jogador vai, em uma frase (ver `tyreOutlook`). */
export function useTyreOutlook(tyre: ShownTyre | null): TyreOutlook | null {
  const { career, player, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const profile = useMemo(() => playerRaceProfile(career), [career]);
  if (!tyre || !race) return null;
  if (tyre.state === 'retired') return { text: 'Carro fora da prova', tone: 'neutral' };
  if (tyre.state === 'finished') return { text: 'Corrida encerrada', tone: 'neutral' };
  // O que é próprio do piloto e do fim de semana no desgaste: treino de ritmo de corrida × nascença.
  const weekend = race.cars.find((c) => c.driverId === player.id)?.modifiers.tyreWearFactor ?? 1;
  return tyreOutlook({
    compound: tyre.compound,
    wear: tyre.wear,
    lap: tyre.lap,
    totalLaps: tyre.totalLaps,
    attributes: player.attributes,
    track: getTrack(race.trackId),
    rules: category.race,
    factor: weekend * profile.tyreWear,
  });
}

/** Rótulo acessível do gráfico: a série inteira em palavras, com os tempos em três casas. */
function lapChartLabel(times: readonly number[]): string {
  const first = times[0];
  const last = times.at(-1);
  if (first === undefined || last === undefined || times.length < 2) return 'Tempo de volta: ainda sem voltas para comparar';
  return `Tempo de volta nas últimas ${times.length} voltas: de ${formatLap(first)} a ${formatLap(last)}; a melhor foi ${formatLap(Math.min(...times))}`;
}

export function PlayerTyrePanel({ tyre, compact = false, className }: { tyre: ShownTyre; compact?: boolean; className?: string }) {
  const { category } = useCareerView();
  const outlook = useTyreOutlook(tyre);
  const badge = category.race.pitStops;
  const Icon = outlook ? OUTLOOK_ICON[outlook.tone] : Timer;
  const outlookLine = outlook && (
    <span
      title={outlook.text}
      className={cx('flex min-w-0 items-center gap-1 font-semibold leading-tight', compact ? 'text-2xs' : 'text-xs', OUTLOOK_TEXT[outlook.tone])}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />
      <span className={cx('min-w-0', compact && 'truncate')}>{outlook.text}</span>
    </span>
  );
  const last = tyre.times.at(-1);

  // Resumo de três linhas baixas: cabe na barra superior da corrida e no cartão do piloto em foco.
  if (compact) {
    return (
      <div className={cx('min-w-0', className)}>
        <TyreGauge
          compound={tyre.compound}
          wear={tyre.wear}
          badge={badge}
          trailing={<Sparkline values={tyre.times} label={lapChartLabel(tyre.times)} width={40} height={14} />}
        />
        <div className="mt-1">{outlookLine}</div>
      </div>
    );
  }

  return (
    <section aria-label="Pneus" className={cx('min-w-0', className)}>
      <TyreGauge compound={tyre.compound} wear={tyre.wear} badge={badge} caption />
      <div className="mt-2">{outlookLine}</div>
      <div className="mt-2 flex items-center gap-2">
        <Sparkline values={tyre.times} label={lapChartLabel(tyre.times)} width={96} height={28} />
        <div className="min-w-0 text-2xs leading-snug text-ink-300">
          <div>Tempo de volta: a linha sobe quando o pneu cai.</div>
          {last !== undefined && (
            <div>
              Última <b className="font-semibold text-ink-100">{formatLap(last)}</b> · melhor{' '}
              <b className="font-semibold text-ink-100">{formatLap(Math.min(...tyre.times))}</b>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
