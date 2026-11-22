import { CircleCheck, FastForward, Headset, Pause, Play, SkipForward, TriangleAlert, UserRound, Video } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { feedbackOnce } from '../feedback/feedback';
import { createPortal } from 'react-dom';
import type { RaceResult } from '@/domain/schemas';
import { MOMENT_TEXTS } from '@/data/raceMoments';
import {
  DRIVING_STYLE_DESCRIPTIONS,
  DRIVING_STYLE_LABELS,
  MOMENT_KIND_LABELS,
  RACE_MODE_DESCRIPTIONS,
  RACE_MODE_LABELS,
  WEATHER_LABELS,
} from '@/domain/labels';
import { conditionFor, drivingStyle, drivingStyleScore, finalizeRace, fullName, gapToLeader, isRaceFinished, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { RaceResultTable } from './RaceResultTable';
import { Card, Chip, cx, Delta, LowerThird, TeamSwatch, th, TyreBadge, TyreLegend, TyreWearBar, YouMark } from '@/ui/kit';
import { formatGap, formatInterval, formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { ScreenAction } from '../layout/ScreenAction';
import { useChrome } from '../layout/chrome';
import { MomentBar, useStageAboveMoment } from '../race/MomentBar';
import { PitStrategyCard, TeamOrderDialog } from '../race/RaceCommands';
import { RaceControlBar } from '../race/RaceControlBar';
import { EVENT_TONE, HeaderButton, Mark } from '../race/raceBits';
import { playerRaceProfile, shownLapTimes } from '../race/raceInfo';
import { PlayerTyrePanel, type ShownTyre } from '../race/TyrePanel';
import { counted } from '@/domain/text';

/** Duração de cada volta na reprodução, por velocidade. */
const SPEEDS = [
  { label: '1×', ms: 1400 },
  { label: '2×', ms: 700 },
  { label: '4×', ms: 300 },
  { label: '8×', ms: 120 },
];

/** Número com uma casa e vírgula, como no resto do jogo ("36,3"). */
const decimal = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  const won = result.moments.filter((moment) => moment.success).length;
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
      {mine && result.moments.length > 0 && (
        <Card
          title="Lances da corrida"
          action={
            <span className="pr-2 text-xs text-ink-300">
              {counted(won, 'deu certo', 'deram certo')} de {result.moments.length}
            </span>
          }
        >
          <ul className="divide-y divide-ink-700">
            {result.moments.map((moment) => {
              const option = MOMENT_TEXTS[moment.kind].options[moment.option]?.label ?? moment.option;
              return (
                <li key={`${moment.lap}-${moment.kind}`} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="w-8 shrink-0 pt-px text-xs font-semibold text-ink-300">V{moment.lap}</span>
                  {moment.success ? (
                    <CircleCheck size={16} aria-hidden className="mt-px shrink-0 text-go-400" />
                  ) : (
                    <TriangleAlert size={16} aria-hidden className="mt-px shrink-0 text-gold-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-tight">
                      <b className="font-semibold text-ink-100">
                        {MOMENT_KIND_LABELS[moment.kind]}: {option}
                      </b>
                      <span className="text-xs text-ink-300">{Math.round(moment.chance * 100)}% de chance</span>
                      {moment.auto && (
                        <Chip size="sm" icon={<UserRound size={12} aria-hidden className="shrink-0" />}>
                          Decidido pelo piloto
                        </Chip>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-snug text-ink-300">
                      <b className={cx('font-semibold', moment.success ? 'text-go-400' : 'text-gold-400')}>{moment.success ? 'Deu certo.' : 'Deu errado.'}</b>{' '}
                      {moment.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
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
  const { career, player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const timeline = useGameStore((s) => s.raceTimeline);
  const mode = useGameStore((s) => s.raceMode);
  const { setRaceMode, stepRace, simulateRestOfRace } = useGameStore.getState();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [side, setSide] = useState<TimingPanel>('car');
  const { wide, topSlot } = useChrome();
  const startPlaying = useCallback(() => setPlaying(true), []);

  const finished = race ? isRaceFinished(race) : false;
  const awaitingOrder = race?.pendingTeamOrder !== null && race?.pendingTeamOrder !== undefined;
  // Lance decisivo: aqui a tela mostra sempre a última volta simulada, então a pergunta aparece na hora.
  const awaitingMoment = !finished && race?.pendingMoment !== null && race?.pendingMoment !== undefined;

  useEffect(() => {
    // A reprodução para sozinha quando a equipe dá uma ordem ou há um lance à espera: o jogador
    // precisa responder (o relógio nem gira, para não pedir voltas ao motor em falso).
    if (!playing || finished || awaitingOrder || awaitingMoment) return;
    const id = window.setInterval(() => stepRace(), SPEEDS[speed]?.ms ?? 1000);
    return () => window.clearInterval(id);
  }, [playing, finished, awaitingOrder, awaitingMoment, speed, stepRace]);

  const profile = useMemo(() => playerRaceProfile(career), [career]);
  // Deitado, a tabela encolhe para caber inteira acima da tarja do lance.
  const { stage, height: stageHeight, onHeight } = useStageAboveMoment<HTMLDivElement>(awaitingMoment && wide);

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

  // O pneu do jogador: neste modo, o que está na tela é o estado da última volta simulada.
  const myTyre: ShownTyre | null = me
    ? {
        compound: me.tyre.compound,
        wear: me.tyre.wear,
        lap: race.currentLap,
        totalLaps: race.totalLaps,
        times: timeline ? shownLapTimes(timeline, player.id, Number.POSITIVE_INFINITY) : [],
        state: me.status === 'running' ? 'running' : 'retired',
      }
    : null;
  const style = drivingStyle(drivingStyleScore(player, profile, mode));
  // O que acabou de acontecer com o jogador nesta volta: o desfecho do lance e o rádio do engenheiro.
  const lastMoment = race.moments.at(-1);
  const outcome = !awaitingMoment && lastMoment && lastMoment.lap === race.currentLap ? lastMoment : null;
  const lastRadio = race.radio.at(-1);
  const radio = !awaitingMoment && !outcome && lastRadio && lastRadio.lap === race.currentLap ? lastRadio : null;

  const playLabel = race.currentLap === 0 ? 'Largar' : 'Continuar';
  // Cabeçalho: volta, clima e os comandos de avanço. No formato largo ele ocupa a barra superior do jogo.
  const header = (
    <div className={cx('flex min-w-0 flex-1 items-center gap-x-2', !topSlot && 'flex-wrap py-1')}>
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
        <HeaderButton
          icon={SkipForward}
          label="+1 volta"
          always
          onClick={() => stepRace()}
          disabled={playing || awaitingOrder || awaitingMoment}
          title={awaitingMoment ? 'Responda ao lance para a corrida seguir' : undefined}
        />
        <HeaderButton
          icon={FastForward}
          label="Simular até o fim"
          onClick={() => {
            setPlaying(false);
            simulateRestOfRace();
          }}
          title={me ? 'O piloto decide os lances pelo estilo dele e o engenheiro assume paradas e combustível até o fim' : 'Vai direto para o resultado'}
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
      ref={stage}
      className="flex flex-col gap-2"
      style={
        wide
          ? stageHeight !== null
            ? { height: `${stageHeight}px` }
            : { height: 'calc(100dvh - 8.75rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))', minHeight: '13.5rem' }
          : undefined
      }
    >
      {topSlot ? createPortal(header, topSlot) : <div className="chamfer flex min-h-12 items-center bg-ink-900 px-2 shadow-frame">{header}</div>}

      {/* Lance decisivo: a tarja toma o lugar da barra de comandos até o jogador responder. */}
      {awaitingMoment && <MomentBar race={race} tyre={myTyre} onAnswered={startPlaying} onHeight={onHeight} />}
      {me && !awaitingMoment && (
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
        <div role="status" className="shrink-0 bg-gold-400/10 px-2 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400)]">
          {race.neutralization.type === 'sc' ? 'Safety car na pista' : 'Safety car virtual'} · mais {counted(race.neutralization.lapsLeft, 'volta', 'voltas')}.
          Ultrapassagens proibidas{rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {redFlagRestart && (
        <div role="status" className="shrink-0 bg-gold-400/10 px-2 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400)]">
          Bandeira vermelha · relargada parada na próxima volta.
          {rules.pitStops ? ' A troca de pneus é livre: escolha um composto na aba Boxes, se quiser trocar.' : ''}
        </div>
      )}
      {race.pendingTeamOrder && (
        <div className="shrink-0">
          <TeamOrderDialog race={race} />
        </div>
      )}
      {/* O que acabou de acontecer com o jogador: o desfecho do lance vem antes do rádio. */}
      <div aria-live="polite" className="shrink-0 empty:hidden">
        {outcome ? (
          <LowerThird
            kicker={`Lance · ${MOMENT_KIND_LABELS[outcome.kind]} · ${outcome.success ? 'deu certo' : 'deu errado'}`}
            title={outcome.message}
            tone={outcome.success ? 'good' : 'attention'}
            icon={
              outcome.success ? (
                <CircleCheck size={18} aria-hidden className="shrink-0 text-go-400" />
              ) : (
                <TriangleAlert size={18} aria-hidden className="shrink-0 text-gold-400" />
              )
            }
            compact
          />
        ) : radio ? (
          <LowerThird kicker="Rádio · engenheiro" title={radio.message} icon={<Headset size={18} aria-hidden className="shrink-0 text-ink-200" />} compact />
        ) : null}
      </div>

      <div className={cx('min-h-0 flex-1', wide ? 'grid grid-cols-[minmax(0,1fr)_15rem] gap-2 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'flex flex-col gap-4')}>
        {/* A tabela rola por dentro; a legenda das letras dos pneus fica no pé, à vista sem rolar. */}
        <div className="flex min-h-0 flex-col bg-ink-900 shadow-frame">
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-2">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-ink-900">
                <tr>
                  <th className={th}>Pos</th>
                  <th className={th}>Piloto</th>
                  <th className={cx(th, 'text-right')}>Dif.</th>
                  <th className={cx(th, 'hidden text-right lg:table-cell')}>Última</th>
                  <th className={cx(th, 'hidden text-right xl:table-cell')}>Melhor</th>
                  <th className={cx(th, 'sm:w-24')}>Pneus</th>
                  {rules.pitStops && <th className={cx(th, 'hidden text-center lg:table-cell')}>Par.</th>}
                </tr>
              </thead>
              <tbody>
                {race.cars.map((car, i) => {
                  const isMe = car.driverId === player.id;
                  return (
                    <tr key={car.driverId} className={cx('border-t border-ink-700', isMe && 'bg-apex-500/15', car.status === 'dnf' && 'text-ink-300')}>
                      <td className="w-14 px-2 py-2">
                        <span className="flex items-center gap-1">
                          <span className="font-display text-base font-bold leading-none">{car.status === 'dnf' ? 'AB' : i + 1}</span>
                          {car.status === 'running' && race.currentLap > 0 && (
                            <Delta value={car.grid - (i + 1)} signless threshold={0.5} className="text-2xs" />
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-sm">
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
                      <td className="px-2 py-2 text-right text-sm text-ink-300">
                        {car.status === 'dnf' ? '–' : race.currentLap === 0 ? '' : formatGap(gapToLeader(race, car))}
                      </td>
                      <td className="hidden px-2 py-2 text-right text-sm text-ink-400 lg:table-cell">{formatLap(car.lastLap)}</td>
                      <td className="hidden px-2 py-2 text-right text-sm text-ink-400 xl:table-cell">{formatLap(car.bestLap)}</td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          {rules.pitStops && <TyreBadge compound={car.tyre.compound} />}
                          {/* Com troca de pneus, na tela estreita fica só o selo (com a letra); a barra de desgaste aparece a partir de 640 px.
                              A barra enche conforme o pneu gasta, até a marca do penhasco; o estado vai em palavras na dica. */}
                          <TyreWearBar
                            compound={car.tyre.compound}
                            wear={car.tyre.wear}
                            className={cx('flex-1', rules.pitStops ? 'max-sm:hidden' : 'min-w-10')}
                          />
                        </span>
                      </td>
                      {rules.pitStops && <td className="hidden px-2 py-2 text-center text-sm text-ink-400 lg:table-cell">{car.pitStops}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rules.pitStops && <TyreLegend compounds={[...rules.dryCompounds, ...rules.wetCompounds]} className="shrink-0 border-t border-ink-700 px-2 py-1" />}
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
              <div className="p-2">
                {me ? (
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-2">
                    {fact('Posição', me.status === 'dnf' ? 'AB' : `${myIndex + 1}º`)}
                    {fact('Última volta', formatLap(me.lastLap))}
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
                {myTyre && <PlayerTyrePanel tyre={myTyre} className="mt-2 border-t border-ink-700 pt-2" />}
                {me && rules.fuel && (
                  <p className={cx('mt-2 text-xs', fuelMargin < 1 ? 'font-semibold text-gold-400' : 'text-ink-300')}>
                    Combustível: {decimal(me.fuel)} voltas no tanque, {lapsRemaining} por correr (
                    {fuelMargin >= 0 ? `sobra ${decimal(fuelMargin)}` : `falta ${decimal(-fuelMargin)}: poupe ou não chega ao fim`}).
                  </p>
                )}
                {me && (me.damage >= 0.05 || me.penaltySeconds > 0) && (
                  <p className="mt-2 text-xs text-gold-400">
                    {me.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, me.damage) * 100)}% (perde ritmo até reparar). `}
                    {me.penaltySeconds > 0 && `Punições acumuladas: ${me.penaltySeconds}s, somados ao tempo final.`}
                  </p>
                )}
                {me && (
                  <p className="mt-2 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-400">
                    <b className="font-semibold text-ink-200">{RACE_MODE_LABELS[mode]}.</b> {RACE_MODE_DESCRIPTIONS[mode]}
                    {rules.fuel ? ' O ritmo também muda o consumo de combustível.' : ''}
                  </p>
                )}
                {me && (
                  <p className="mt-2 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-400">
                    <b className="font-semibold text-ink-200">Estilo do piloto: {DRIVING_STYLE_LABELS[style]}.</b> {DRIVING_STYLE_DESCRIPTIONS[style]} É ele
                    quem decide os lances que você deixar com o piloto e todos os de "Simular até o fim".
                  </p>
                )}
              </div>
            )}
            {panel === 'pits' && <PitStrategyCard race={race} tyre={myTyre} bare />}
            {panel === 'events' && (
              <ul>
                {recentEvents.length === 0 && <li className="px-2 py-2 text-sm text-ink-400">Os carros estão alinhados no grid.</li>}
                {recentEvents.map((e, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a chave é a posição do evento na corrida, que não muda
                    key={`${race.events.length - i}`}
                    className={cx(
                      'flex gap-2 border-t border-ink-700/70 px-2 py-2 text-xs first:border-t-0',
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
