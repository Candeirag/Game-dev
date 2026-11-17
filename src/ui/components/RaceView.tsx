import { FastForward, Pause, Play, SkipForward, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { feedbackOnce } from '../feedback/feedback';
import { createPortal } from 'react-dom';
import type { RaceResult } from '@/domain/schemas';
import { RACE_MODE_DESCRIPTIONS, RACE_MODE_LABELS, WEATHER_LABELS } from '@/domain/labels';
import { conditionFor, finalizeRace, fullName, gapToLeader, isRaceFinished, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { RaceResultTable } from './RaceResultTable';
import { Card, cx, Delta, TeamSwatch, th, TyreBadge, YouMark } from '@/ui/kit';
import { formatGap, formatInterval, formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { ScreenAction } from '../layout/ScreenAction';
import { useChrome } from '../layout/chrome';
import { PitStrategyCard, TeamOrderDialog } from '../race/RaceCommands';
import { RaceControlBar } from '../race/RaceControlBar';
import { EVENT_TONE, HeaderButton, Mark } from '../race/raceBits';
import { counted } from '@/domain/text';

/** Duração de cada volta na reprodução, por velocidade. */
const SPEEDS = [
  { label: '1×', ms: 1400 },
  { label: '2×', ms: 700 },
  { label: '4×', ms: 300 },
  { label: '8×', ms: 120 },
];

/** Resultado oficial da corrida, com o botão que conclui a etapa. Usado pelos dois modos de exibição. */
export function RaceResultPanel({ race, result, extra }: { race: RaceSimState; result: RaceResult; extra?: ReactNode }) {
  const { career, player, drivers } = useCareerView();
  const completeWeekend = useGameStore((s) => s.completeWeekend);
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const mine = result.entries.find((e) => e.driverId === player.id);
  // Fora do carro (dirigente, ou piloto que não disputou a etapa), o destaque é o resultado da equipe.
  const teamId = career.management?.teamId ?? player.teamId;
  const team = mine ? [] : result.entries.filter((e) => e.teamId === teamId);
  // Vitória ou pódio do jogador: som e vibração junto com a entrada do resultado, uma vez por corrida.
  const celebration = mine?.status === 'finished' ? (mine.position === 1 ? 'victory' : mine.position <= 3 ? 'podium' : null) : null;
  const raceKey = `resultado-${career.id}-${career.season}-${race.trackId}-${career.rounds.length}`;
  useEffect(() => {
    if (celebration) feedbackOnce(raceKey, celebration);
  }, [celebration, raceKey]);
  return (
    <div className="space-y-4">
      <Card
        title={race.endedEarly ? 'Corrida encerrada com bandeira vermelha' : 'Bandeirada'}
        tone={mine?.status === 'finished' && mine.position <= 3 ? 'good' : mine?.status === 'dnf' ? 'attention' : 'neutral'}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-display text-3xl font-bold uppercase">
              {mine
                ? mine.status === 'finished'
                  ? `Você terminou em ${mine.position}º`
                  : 'Você abandonou a corrida'
                : team.length > 0
                  ? `Sua equipe: ${team.map((e) => (e.status === 'finished' ? `${e.position}º` : 'abandono')).join(' e ')}`
                  : 'Corrida encerrada'}
            </div>
            {!mine && (
              <div className="text-sm text-ink-400">
                {team.map((e) => `${nameOf(e.driverId)}: largou em ${e.grid}º, ${counted(e.points, 'ponto', 'pontos')}`).join(' · ')}
                {team.length > 0 ? ' · ' : ''}Vencedor: {nameOf(result.entries[0]?.driverId ?? '')}
              </div>
            )}
            {mine && (
              <div className="text-sm text-ink-400">
                Largou em {mine.grid}º · {counted(mine.points, 'ponto', 'pontos')} · {counted(mine.overtakes, 'ultrapassagem', 'ultrapassagens')}
                {mine.pitStops > 0 && ` · ${counted(mine.pitStops, 'parada', 'paradas')}`}
                {mine.penaltySeconds > 0 && ` · ${mine.penaltySeconds}s de punição`} · Vencedor: {nameOf(result.entries[0]?.driverId ?? '')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extra}
            <ScreenAction onClick={completeWeekend} className="min-h-12 px-6">
              Concluir etapa e salvar
            </ScreenAction>
          </div>
        </div>
      </Card>
      <Card title="Resultado oficial" padded={false}>
        <div className="px-4">
          <RaceResultTable result={result} />
        </div>
      </Card>
    </div>
  );
}

type TimingPanel = 'car' | 'pits' | 'events';

/**
 * Modo cronometragem: a corrida em tabela, volta a volta. Na tela deitada a tabela e o painel
 * lateral cabem sem rolar a página, com a barra de ritmo fixa embaixo.
 */
export function RaceView({ onBroadcastView }: { onBroadcastView?: () => void }) {
  const { player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const mode = useGameStore((s) => s.raceMode);
  const { setRaceMode, stepRace, simulateRestOfRace } = useGameStore.getState();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [side, setSide] = useState<TimingPanel>('car');
  const { wide, topSlot } = useChrome();

  const finished = race ? isRaceFinished(race) : false;
  const awaitingOrder = race?.pendingTeamOrder !== null && race?.pendingTeamOrder !== undefined;

  useEffect(() => {
    // A reprodução para sozinha quando a equipe dá uma ordem: o jogador precisa responder.
    if (!playing || finished || awaitingOrder) return;
    const id = window.setInterval(() => stepRace(), SPEEDS[speed]?.ms ?? 1000);
    return () => window.clearInterval(id);
  }, [playing, finished, awaitingOrder, speed, stepRace]);

  const result = useMemo(() => (race && finished ? finalizeRace(race, category) : null), [race, finished, category]);

  // No modo de cronometragem a "volta na tela" é a última simulada (ver a retomada de corrida interrompida).
  const currentLap = race?.currentLap ?? 0;
  useEffect(() => {
    useGameStore.getState().noteLapShown(currentLap);
  }, [currentLap]);

  if (!race) return null;
  const rules = category.race;
  const myIndex = race.cars.findIndex((c) => c.driverId === player.id);
  const me = race.cars[myIndex];
  const ahead = myIndex > 0 ? race.cars[myIndex - 1] : undefined;
  const behind = race.cars[myIndex + 1];
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const recentEvents = [...race.events].reverse().slice(0, 50);
  const wetness = race.wetnessByLap[Math.min(race.totalLaps, Math.max(1, race.currentLap))] ?? race.weather.wetness;
  const lapsRemaining = race.totalLaps - race.currentLap;
  const running = me?.status === 'running';
  const fuelMargin = me ? me.fuel - lapsRemaining : 0;
  const redFlagRestart = race.restart === 'standing' && race.currentLap > 0;

  if (result) return <RaceResultPanel race={race} result={result} />;

  const playLabel = race.currentLap === 0 ? 'Largar' : 'Continuar';
  // Cabeçalho: volta, clima e os comandos de avanço. No formato largo ele ocupa a barra superior do jogo.
  const header = (
    <div className={cx('flex min-w-0 flex-1 items-center gap-x-3', !topSlot && 'flex-wrap py-1')}>
      <div className="flex shrink-0 items-baseline gap-2 leading-none">
        <span className="text-2xs font-medium text-ink-400">Volta</span>
        <span className="font-display text-2xl font-bold leading-none">
          {race.currentLap}
          <span className="text-ink-400">/{race.totalLaps}</span>
        </span>
      </div>
      <span className="min-w-0 truncate text-xs text-ink-300">
        {WEATHER_LABELS[conditionFor(wetness)]}
        {wetness > 0.02 ? ` · pista ${Math.round(wetness * 100)}% molhada` : ''}
        {race.forecast.kind !== 'stable' && race.forecast.aroundLap !== null && race.currentLap < race.forecast.aroundLap && (
          <span className="text-gold-400">
            {' '}
            · previsão: {race.forecast.kind === 'rain' ? 'chuva' : 'pista secando'} perto da volta {race.forecast.aroundLap}
          </span>
        )}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!me && (
          <HeaderButton
            icon={playing ? Pause : Play}
            label={playing ? 'Pausar' : playLabel}
            always
            onClick={() => setPlaying(!playing)}
            disabled={awaitingOrder}
          />
        )}
        <HeaderButton icon={SkipForward} label="+1 volta" always onClick={() => stepRace()} disabled={playing || awaitingOrder} />
        <HeaderButton
          icon={FastForward}
          label="Simular até o fim"
          onClick={() => {
            setPlaying(false);
            simulateRestOfRace();
          }}
          title="O engenheiro assume paradas e combustível até o fim"
        />
        {onBroadcastView && <HeaderButton icon={Video} label="Voltar à corrida visual" onClick={onBroadcastView} />}
      </div>
    </div>
  );

  const tabs: { id: TimingPanel; label: string }[] = [
    { id: 'car', label: 'Meu carro' },
    ...(rules.pitStops && me ? [{ id: 'pits' as const, label: 'Boxes' }] : []),
    { id: 'events', label: 'Eventos' },
  ];
  const panel: TimingPanel = tabs.some((t) => t.id === side) ? side : 'car';
  const fact = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-2xs font-medium text-ink-400">{label}</dt>
      <dd className="truncate font-display text-lg font-semibold leading-tight">{value}</dd>
    </div>
  );

  return (
    <div
      className="flex flex-col gap-2"
      style={wide ? { height: 'calc(100dvh - 8.75rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))', minHeight: '13.5rem' } : undefined}
    >
      {topSlot ? createPortal(header, topSlot) : <div className="chamfer flex min-h-12 items-center bg-ink-900 px-3 shadow-frame">{header}</div>}

      {me && (
        <RaceControlBar
          position={me.status === 'running' ? `P${myIndex + 1}` : 'AB'}
          lap={`Volta ${race.currentLap}/${race.totalLaps}`}
          mode={mode}
          onMode={setRaceMode}
          modeDisabled={!running}
          modeFromLap={race.currentLap < race.totalLaps ? race.currentLap + 1 : null}
          playing={playing}
          playLabel={playLabel}
          onToggle={() => setPlaying(!playing)}
          toggleDisabled={awaitingOrder}
          speeds={SPEEDS.map((sp, i) => ({ label: sp.label, active: speed === i, select: () => setSpeed(i) }))}
        />
      )}

      {race.neutralization.type !== 'none' && (
        <div role="status" className="shrink-0 bg-gold-400/10 px-3 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400)]">
          {race.neutralization.type === 'sc' ? 'Safety car na pista' : 'Safety car virtual'} · mais {counted(race.neutralization.lapsLeft, 'volta', 'voltas')}.
          Ultrapassagens proibidas{rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {redFlagRestart && (
        <div role="status" className="shrink-0 bg-gold-400/10 px-3 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400)]">
          Bandeira vermelha · relargada parada na próxima volta.
          {rules.pitStops ? ' A troca de pneus é livre: escolha um composto na aba Boxes, se quiser trocar.' : ''}
        </div>
      )}
      {race.pendingTeamOrder && (
        <div className="shrink-0">
          <TeamOrderDialog race={race} />
        </div>
      )}

      <div className={cx('min-h-0 flex-1', wide ? 'grid grid-cols-[minmax(0,1fr)_15rem] gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'flex flex-col gap-3')}>
        <div className="min-h-0 overflow-auto overscroll-contain bg-ink-900 px-3 shadow-frame">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-ink-900">
              <tr>
                <th className={th}>Pos</th>
                <th className={th}>Piloto</th>
                <th className={cx(th, 'text-right')}>Dif.</th>
                <th className={cx(th, 'hidden text-right lg:table-cell')}>Última</th>
                <th className={cx(th, 'hidden text-right xl:table-cell')}>Melhor</th>
                <th className={cx(th, 'w-24')}>Pneus</th>
                {rules.pitStops && <th className={cx(th, 'hidden text-center lg:table-cell')}>Par.</th>}
              </tr>
            </thead>
            <tbody>
              {race.cars.map((car, i) => {
                const isMe = car.driverId === player.id;
                return (
                  <tr key={car.driverId} className={cx('border-t border-ink-700', isMe && 'bg-apex-500/15', car.status === 'dnf' && 'text-ink-300')}>
                    <td className="w-14 px-3 py-2">
                      <span className="flex items-center gap-1">
                        <span className="font-display text-base font-bold leading-none">{car.status === 'dnf' ? 'AB' : i + 1}</span>
                        {car.status === 'running' && race.currentLap > 0 && <Delta value={car.grid - (i + 1)} signless threshold={0.5} className="text-2xs" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <TeamSwatch team={teams[car.teamId]} />
                        <span className={cx('truncate', isMe && 'font-semibold')}>{nameOf(car.driverId)}</span>
                        {isMe && <YouMark />}
                        {race.fastestLap?.driverId === car.driverId && (
                          <Mark title="Volta mais rápida" tone="strong">
                            VMR
                          </Mark>
                        )}
                        {car.penaltySeconds > 0 && <Mark title="Punição em tempo" tone="attention">{`+${car.penaltySeconds}s`}</Mark>}
                        {car.damage >= 0.2 && car.status === 'running' && (
                          <Mark title="Carro danificado" tone="attention">
                            DANO
                          </Mark>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-ink-300">
                      {car.status === 'dnf' ? '–' : race.currentLap === 0 ? '' : formatGap(gapToLeader(race, car))}
                    </td>
                    <td className="hidden px-3 py-2 text-right text-sm text-ink-400 lg:table-cell">{formatLap(car.lastLap)}</td>
                    <td className="hidden px-3 py-2 text-right text-sm text-ink-400 xl:table-cell">{formatLap(car.bestLap)}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {rules.pitStops && <TyreBadge compound={car.tyre.compound} />}
                        <span className="h-1.5 flex-1 overflow-hidden bg-ink-800" title={`${Math.round((1 - car.tyre.wear) * 100)}% de pneu`}>
                          <span
                            className={cx('block h-full', car.tyre.wear > 0.75 ? 'bg-gold-400' : car.tyre.wear > 0.45 ? 'bg-ink-200' : 'bg-go-400')}
                            style={{ width: `${Math.max(0, (1 - car.tyre.wear) * 100)}%` }}
                          />
                        </span>
                      </span>
                    </td>
                    {rules.pitStops && <td className="hidden px-3 py-2 text-center text-sm text-ink-400 lg:table-cell">{car.pitStops}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="flex min-h-0 flex-col bg-ink-900 shadow-frame">
          <div role="tablist" aria-label="Painel da corrida" className="grid shrink-0 auto-cols-fr grid-flow-col border-b border-ink-700 bg-ink-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={panel === t.id}
                onClick={() => setSide(t.id)}
                className={cx(
                  'min-h-11 px-1 text-xs font-semibold',
                  panel === t.id ? 'text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:text-ink-100',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', !wide && 'max-h-[26rem]')}>
            {panel === 'car' && (
              <div className="p-3">
                {me ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {fact('Posição', me.status === 'dnf' ? 'AB' : `${myIndex + 1}º`)}
                    {fact(
                      'Pneus',
                      <span className="flex items-center gap-2">
                        {rules.pitStops && <TyreBadge compound={me.tyre.compound} />}
                        {Math.round((1 - me.tyre.wear) * 100)}%
                      </span>,
                    )}
                    {fact(
                      'À frente',
                      ahead && running && race.currentLap > 0
                        ? `${formatInterval(me.totalTime - ahead.totalTime)} ${drivers[ahead.driverId]?.lastName ?? ''}`
                        : '–',
                    )}
                    {fact(
                      'Atrás',
                      behind && behind.status === 'running' && running && race.currentLap > 0
                        ? `${formatInterval(behind.totalTime - me.totalTime)} ${drivers[behind.driverId]?.lastName ?? ''}`
                        : '–',
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-ink-400">Você acompanha esta corrida dos boxes.</p>
                )}
                {me && rules.fuel && (
                  <p className={cx('mt-2 text-xs', fuelMargin < 1 ? 'font-semibold text-gold-400' : 'text-ink-300')}>
                    Combustível: {me.fuel.toFixed(1)} voltas no tanque, {lapsRemaining} por correr (
                    {fuelMargin >= 0 ? `sobra ${fuelMargin.toFixed(1)}` : `falta ${(-fuelMargin).toFixed(1)}: poupe ou não chega ao fim`}).
                  </p>
                )}
                {me && (me.damage >= 0.05 || me.penaltySeconds > 0) && (
                  <p className="mt-2 text-xs text-gold-400">
                    {me.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, me.damage) * 100)}% (perde ritmo até reparar). `}
                    {me.penaltySeconds > 0 && `Punições acumuladas: ${me.penaltySeconds}s, somados ao tempo final.`}
                  </p>
                )}
                {me && (
                  <p className="mt-3 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-400">
                    <b className="font-semibold text-ink-200">{RACE_MODE_LABELS[mode]}.</b> {RACE_MODE_DESCRIPTIONS[mode]}
                    {rules.fuel ? ' O ritmo também muda o consumo de combustível.' : ''}
                  </p>
                )}
              </div>
            )}
            {panel === 'pits' && <PitStrategyCard race={race} bare />}
            {panel === 'events' && (
              <ul>
                {recentEvents.length === 0 && <li className="px-3 py-3 text-sm text-ink-400">Os carros estão alinhados no grid.</li>}
                {recentEvents.map((e, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a chave é a posição do evento na corrida, que não muda
                    key={`${race.events.length - i}`}
                    className={cx(
                      'flex gap-2 border-t border-ink-700/70 px-3 py-2 text-xs first:border-t-0',
                      (e.driverId === player.id || e.otherDriverId === player.id) && 'bg-apex-500/10',
                    )}
                  >
                    <span className="w-7 shrink-0 text-ink-400">V{e.lap}</span>
                    <span className={EVENT_TONE[e.type] ?? 'text-ink-300'}>{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
