/**
 * Corrida visual: o circuito visto de cima com os carros em movimento, a torre
 * de tempos, o painel do piloto e os comandos do jogador.
 *
 * Tudo o que aparece aqui (posições, diferenças, pneus, eventos) é lido da
 * linha do tempo no instante exibido. O estado do motor fica até uma volta à
 * frente da imagem e não é mostrado antes da hora.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Crosshair, FastForward, Flag, ListOrdered, Pause, Play, Radio, RotateCcw, SkipForward, Video } from 'lucide-react';
import { RACE_MODE_DESCRIPTIONS, RACE_MODE_LABELS, WEATHER_LABELS } from '@/domain/labels';
import { getTrack } from '@/data/tracks';
import { TYRES, buildCircuit, conditionFor, eventsUntil, finalizeRace, fullName, isRaceFinished, lapInfoAt, standingsAt, type StandingRow } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CarSprite } from '../components/CarSprite';
import { RaceResultPanel } from '../components/RaceView';
import { Button, cx } from '../components/ui';
import { formatLap, trackCredit } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { useChrome, useMediaQuery } from '../layout/chrome';
import { CompoundDot, EVENT_TONE, HeaderButton } from './raceBits';
import { RaceCanvas } from './RaceCanvas';
import { PitStrategyCard, TeamOrderDialog } from './RaceCommands';
import { RaceControlBar } from './RaceControlBar';
import { driverCode, type CameraMode } from './raceScene';
import { SPEEDS, useRacePlayback } from './useRacePlayback';

const DNF_SHORT: Record<string, string> = { crash: 'Batida', collision: 'Toque', mechanical: 'Quebra', damage: 'Danos', fuel: 'Pane seca' };

type FlagTone = 'green' | 'yellow' | 'red' | 'chequered' | 'neutral';
/** As bandeiras usam as cores do regulamento: aqui a cor é a própria informação. */
const FLAG_STYLE: Record<FlagTone, string> = {
  green: 'bg-go-400/15 text-go-400',
  yellow: 'bg-gold-400/20 text-gold-400',
  red: 'bg-apex-500/20 text-apex-400',
  chequered: 'bg-ink-100/15 text-ink-100',
  neutral: 'bg-ink-800 text-ink-300',
};

function gapText(row: StandingRow, mode: 'leader' | 'interval', started: boolean): string {
  if (row.state === 'retired') return DNF_SHORT[row.sample.reason ?? ''] ?? 'Abandono';
  if (!started) return '';
  if (row.position === 1) return row.state === 'finished' ? 'Vencedor' : 'Líder';
  if (row.lapsDown > 0 && row.state !== 'finished') return `+${row.lapsDown} v`;
  const value = mode === 'leader' ? row.gap : row.interval;
  return value === null ? '' : `+${value.toFixed(value < 100 ? 1 : 0)}`;
}

/**
 * `spectator`: a corrida já foi simulada por inteiro e o jogador só assiste (dirigente no pit wall
 * ou piloto fora da etapa). Não há comandos; os carros em destaque são os da equipe dele.
 */
export function RaceBroadcast({ onTimingView, spectator = false }: { onTimingView?: () => void; spectator?: boolean }) {
  const { wide, topSlot } = useChrome();
  // Com mouse, as linhas da classificação são clicáveis; no toque, são só leitura (ver a torre).
  // Mouse de verdade: tela de toque não conta, mesmo quando o sistema diz que o ponteiro é fino.
  const finePointer = useMediaQuery('(pointer: fine)') && navigator.maxTouchPoints === 0 && !('ontouchstart' in window);
  const [side, setSide] = useState<SidePanel>('tower');
  const { career, player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const timeline = useGameStore((s) => s.raceTimeline);
  const raceMode = useGameStore((s) => s.raceMode);
  const setRaceMode = useGameStore((s) => s.setRaceMode);
  const playback = useRacePlayback();
  // A corrida abre acompanhando o carro do jogador, com o circuito inteiro no minimapa.
  const [camera, setCamera] = useState<CameraMode>('follow');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [gapMode, setGapMode] = useState<'leader' | 'interval'>('leader');

  const trackId = race?.trackId;
  const circuit = useMemo(() => (trackId ? buildCircuit(getTrack(trackId), category.vehicle) : null), [trackId, category.vehicle]);
  const time = playback.time;
  const rows = useMemo(() => (timeline && circuit ? standingsAt(timeline, circuit, time) : []), [timeline, circuit, time]);
  const events = useMemo(() => (timeline ? eventsUntil(timeline, time) : []), [timeline, time]);
  const finished = race ? isRaceFinished(race) : false;
  const result = useMemo(() => (race && finished ? finalizeRace(race, category) : null), [race, finished, category]);
  // Carros do jogador: o dele, se está no grid; senão, os da equipe que ele dirige (ou pela qual corre).
  const managedTeamId = career.management?.teamId ?? null;
  const mineIds = useMemo(() => {
    if (!timeline) return new Set<string>();
    if (timeline.cars[player.id]) return new Set([player.id]);
    const teamId = managedTeamId ?? player.teamId;
    return new Set(
      Object.values(timeline.cars)
        .filter((c) => teamId !== null && c.teamId === teamId)
        .map((c) => c.driverId),
    );
  }, [timeline, player.id, player.teamId, managedTeamId]);

  // Ao voltar para a transmissão com a corrida em andamento, a imagem retoma do ponto mais recente.
  // Quem só assiste começa sempre do grid: a corrida inteira já está simulada.
  // Depois de uma recarga da página, reabre na volta em que a imagem estava.
  const { goLive, seekLap, seekTime, timeRef } = playback;
  useEffect(() => {
    const store = useGameStore.getState();
    if (spectator || (store.raceTimeline?.lapsBuilt ?? 0) === 0) return;
    if (store.raceSeekTime !== null) seekTime(store.raceSeekTime);
    else if (store.raceSeekLap !== null) seekLap(store.raceSeekLap);
    else goLive();
    store.clearRaceSeek();
  }, [goLive, seekLap, seekTime, spectator]);

  // Ao fechar, recarregar ou esconder a página, anota o instante exato da imagem.
  useEffect(() => {
    if (spectator) return;
    const note = () => {
      const store = useGameStore.getState();
      if (store.liveRace && store.raceSteps.length > 0 && timeRef.current > 0) store.noteTimeShown(timeRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') note();
    };
    window.addEventListener('pagehide', note);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', note);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [spectator, timeRef]);

  // A volta que está na tela fica anotada: é dela que a corrida recomeça se a página for recarregada.
  const shownLap = timeline && rows[0] && time > 0 ? Math.min(timeline.totalLaps, rows[0].sample.lap) : 0;
  useEffect(() => {
    if (!spectator) useGameStore.getState().noteLapShown(shownLap);
  }, [shownLap, spectator]);

  if (!race || !timeline || !circuit) return null;

  const rules = category.race;
  const info = lapInfoAt(timeline, time);
  const started = timeline.lapsBuilt > 0 && (time > 0 || playback.phase !== 'grid');
  const leader = rows[0];
  const best = rows.find((r) => mineIds.has(r.driverId));
  const focus = rows.find((r) => r.driverId === focusId) ?? best ?? leader;
  const focusIndex = focus ? rows.indexOf(focus) : -1;
  const ahead = focusIndex > 0 ? rows[focusIndex - 1] : undefined;
  const behind = focusIndex >= 0 ? rows[focusIndex + 1] : undefined;
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const codeOf = (id: string) => driverCode(drivers[id]?.lastName ?? id);
  const wetness = info?.wetness ?? race.weather.wetness;
  const raceLaps = timeline.finished ? timeline.lapsBuilt : timeline.totalLaps;
  const leaderLap = Math.min(raceLaps, leader && started ? leader.sample.lap : 0);
  const chequered = timeline.winnerTime !== null && time >= timeline.winnerTime;
  const recentIncident = events
    .slice(-8)
    .some((e) => (e.type === 'dnf' || e.type === 'spin' || e.type === 'collision') && time - e.time < timeline.referenceLap * 0.25);
  const flag: { tone: FlagTone; label: string } =
    playback.phase === 'suspended' || (race.endedEarly && chequered)
      ? { tone: 'red', label: 'Bandeira vermelha' }
      : chequered
        ? { tone: 'chequered', label: 'Bandeirada' }
        : !started
          ? { tone: 'neutral', label: 'Grid de largada' }
          : info?.flag === 'sc'
            ? { tone: 'yellow', label: 'Safety car' }
            : info?.flag === 'vsc'
              ? { tone: 'yellow', label: 'Safety car virtual' }
              : recentIncident
                ? { tone: 'yellow', label: 'Bandeira amarela' }
                : { tone: 'green', label: 'Bandeira verde' };

  // A resposta a uma ordem de equipe só é pedida quando a imagem chega ao ponto em que o motor precisa dela.
  const orderDue = !spectator && race.pendingTeamOrder !== null && time >= timeline.horizon - 1e-6;

  if (result && playback.phase === 'finished') {
    return (
      <RaceResultPanel
        race={race}
        result={result}
        extra={
          <Button onClick={playback.restart}>
            <RotateCcw size={16} aria-hidden />
            Rever a corrida
          </Button>
        }
      />
    );
  }

  const playLabel = playback.playing ? 'Pausar' : playback.phase === 'grid' ? 'Largar' : playback.phase === 'suspended' ? 'Relargar' : 'Continuar';
  const ticker = events
    .slice(-3)
    .filter((e) => time - e.time < timeline.referenceLap * 0.45)
    .reverse();
  const focusIsPlayer = focus?.driverId === player.id;
  const focusIsMine = focus ? mineIds.has(focus.driverId) : false;
  const followLabel = focus && !focusIsMine ? `Acompanhar ${codeOf(focus.driverId)}` : null;
  const isMine = (id: string | undefined) => id !== undefined && mineIds.has(id);
  const ownLabel = mineIds.has(player.id) ? 'Meu piloto' : 'Minha equipe';

  // Barra fixa de comandos: só enquanto a corrida do jogador está valendo (some na bandeirada e nas reprises).
  const myRow = rows.find((r) => r.driverId === player.id);
  const myCar = race.cars.find((c) => c.driverId === player.id);
  const live = !timeline.finished || leaderLap >= raceLaps;
  const showBar = !spectator && myRow !== undefined && !chequered && live;

  const weatherText = (
    <>
      {WEATHER_LABELS[conditionFor(wetness)]}
      {wetness > 0.02 ? ` · pista ${Math.round(wetness * 100)}% molhada` : ''}
      {race.forecast.kind !== 'stable' && race.forecast.aroundLap !== null && leaderLap < race.forecast.aroundLap && (
        <span className="text-gold-400">
          {' '}
          · previsão: {race.forecast.kind === 'rain' ? 'chuva' : 'pista secando'} perto da volta {race.forecast.aroundLap}
        </span>
      )}
    </>
  );

  // Cabeçalho da transmissão: volta, bandeira, clima e os comandos da reprodução. No formato largo ele
  // ocupa a barra superior do jogo, para a pista ficar com toda a altura da tela.
  const header = (
    <div className={cx('flex min-w-0 flex-1 items-center gap-x-3', !topSlot && 'flex-wrap py-1')}>
      <div className="flex shrink-0 items-baseline gap-1.5 leading-none">
        <span className="text-[11px] font-medium text-ink-400">Volta</span>
        <span className="font-display text-2xl font-bold leading-none">
          {leaderLap}
          <span className="text-ink-500">/{raceLaps}</span>
        </span>
      </div>
      <span
        role="status"
        className={cx(
          'chamfer-br inline-flex shrink-0 items-center gap-1.5 px-2 py-1.5 font-display text-sm font-semibold uppercase leading-none tracking-wide [--chamfer:6px]',
          FLAG_STYLE[flag.tone],
        )}
      >
        <Flag size={14} aria-hidden />
        {flag.label}
      </span>
      <span className="hidden min-w-0 truncate text-xs text-ink-300 lg:inline">{weatherText}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {playback.behindLive && !timeline.finished && <HeaderButton icon={Radio} label="Voltar ao vivo" onClick={playback.goLive} />}
        <HeaderButton
          icon={SkipForward}
          label="+1 volta"
          always
          onClick={playback.skipLap}
          disabled={orderDue || playback.phase === 'suspended' || playback.phase === 'lights'}
          title="Avança até o fim da volta do líder"
        />
        {!timeline.finished && (
          <HeaderButton
            icon={FastForward}
            label="Simular até o fim"
            onClick={playback.finish}
            title="O engenheiro assume paradas e combustível até o fim, e a tela vai direto para o resultado"
          />
        )}
        <HeaderButton
          icon={RotateCcw}
          label="Reiniciar visualização"
          onClick={playback.restart}
          disabled={timeline.lapsBuilt === 0}
          title="Mostra a corrida de novo desde a largada, sem simular nada outra vez"
        />
        {onTimingView && <HeaderButton icon={ListOrdered} label="Modo cronometragem" onClick={onTimingView} />}
      </div>
    </div>
  );

  const tabs: { id: SidePanel; label: string }[] = [
    { id: 'tower', label: 'Ordem' },
    { id: 'driver', label: 'Piloto' },
    ...(rules.pitStops && !spectator ? [{ id: 'pits' as const, label: 'Boxes' }] : []),
    { id: 'events', label: 'Eventos' },
  ];
  const panel: SidePanel = tabs.some((t) => t.id === side) ? side : 'tower';
  const stepFocus = (delta: number) => {
    const next = rows[Math.max(0, Math.min(rows.length - 1, focusIndex + delta))];
    if (next) setFocusId(next.driverId);
  };

  // Avisos que pedem atenção aparecem sobre a pista, sem empurrar a tela.
  const notices = (
    <>
      {orderDue && <TeamOrderDialog race={race} />}
      {playback.phase === 'suspended' && (
        <div role="status" className="bg-ink-950/90 px-3 py-2 text-xs font-semibold text-apex-400 shadow-[inset_3px_0_0_0_var(--color-apex-500)]">
          Bandeira vermelha: corrida interrompida. Os carros voltam ao grid para uma relargada parada.
          {rules.pitStops ? ' A troca de pneus é livre: escolha um composto na aba Boxes, se quiser trocar.' : ''} Toque em Relargar quando estiver pronto.
        </div>
      )}
      {info?.flag !== 'green' && info && started && !chequered && playback.phase !== 'suspended' && (
        <div role="status" className="bg-ink-950/90 px-3 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400)]">
          {info.flag === 'sc' ? 'Safety car na pista' : 'Safety car virtual'}: ultrapassagens proibidas
          {rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {timeline.finished && playback.phase !== 'finished' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-950/90 px-3 py-1.5 text-xs text-ink-200">
          <span>
            {spectator
              ? 'Você acompanha do pit wall: na corrida, os pilotos decidem ritmo e paradas.'
              : 'A corrida já foi decidida; você está revendo as imagens.'}
          </span>
          <Button onClick={playback.goLive}>{spectator ? 'Pular para o resultado' : 'Ver o resultado'}</Button>
        </div>
      )}
    </>
  );

  const towerRow = (row: StandingRow) => {
    const isMe = mineIds.has(row.driverId);
    const gained = row.grid - row.position;
    const content = (
      <>
        <span className="text-right font-display text-base font-bold leading-none">{row.state === 'retired' ? '–' : row.position}</span>
        <span className="h-4 w-1" style={{ background: teams[row.teamId]?.color }} />
        <span className="flex min-w-0 items-baseline gap-1.5">
          <b className={cx('font-display text-[15px] leading-none tracking-wide', isMe && 'text-apex-400')}>{codeOf(row.driverId)}</b>
          <span className="truncate text-[11px] text-ink-400">{row.number}</span>
          {started && row.state !== 'retired' && gained !== 0 && (
            <span className={cx('flex items-center text-[10px] font-semibold', gained > 0 ? 'text-go-400' : 'text-gold-400')}>
              {gained > 0 ? <ChevronUp size={10} strokeWidth={3} aria-hidden /> : <ChevronDown size={10} strokeWidth={3} aria-hidden />}
              {Math.abs(gained)}
            </span>
          )}
          {row.penaltySeconds > 0 && <span className="bg-gold-400/20 px-1 text-[9px] font-bold text-gold-400">+{row.penaltySeconds}s</span>}
        </span>
        <span className={cx('text-right text-xs', row.state === 'pit' ? 'font-bold text-ink-100' : 'text-ink-300')}>
          {row.state === 'pit' ? 'BOX' : gapText(row, gapMode, started)}
        </span>
        <span className="flex items-center justify-end gap-1">
          {rules.pitStops ? <CompoundDot compound={row.compound} /> : null}
          <span className="h-1.5 w-5 overflow-hidden bg-ink-800" title={`${Math.round((1 - row.wear) * 100)}% de pneu`}>
            <span
              className={cx('block h-full', row.wear > 0.75 ? 'bg-gold-400' : row.wear > 0.45 ? 'bg-ink-200' : 'bg-go-400')}
              style={{ width: `${Math.max(6, (1 - row.wear) * 100)}%` }}
            />
          </span>
        </span>
      </>
    );
    const rowClass = cx(
      'grid h-[30px] w-full grid-cols-[22px_4px_minmax(0,1fr)_auto_auto] items-center gap-1.5 px-2 text-left text-[13px]',
      isMe && 'bg-apex-500/15',
      row.driverId === focus?.driverId && 'shadow-[inset_0_0_0_1px_var(--color-ink-300)]',
      row.state === 'retired' && 'opacity-50',
    );
    return (
      <li
        key={row.driverId}
        title={`${nameOf(row.driverId)} · ${teams[row.teamId]?.name ?? ''}`}
        // A linha do jogador não some ao rolar a lista: gruda no alto ou no pé do painel.
        className={cx(isMe && 'sticky bottom-0 top-0 z-10 bg-ink-900')}
      >
        {/* Com mouse, clicar na linha destaca o piloto. No toque a linha é só leitura (é baixa demais
            para um alvo de 44 px): o destaque muda pelas setas da aba Piloto ou tocando no carro. */}
        {finePointer ? (
          <button
            type="button"
            onClick={() => setFocusId(row.driverId)}
            aria-pressed={row.driverId === focus?.driverId}
            className={cx(rowClass, 'transition-colors hover:bg-ink-800')}
          >
            {content}
          </button>
        ) : (
          <div className={rowClass}>{content}</div>
        )}
      </li>
    );
  };

  const fact = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-ink-400">{label}</dt>
      <dd className="truncate font-display text-lg font-semibold leading-tight">{value}</dd>
    </div>
  );

  const sideContent = (
    <>
      {panel === 'tower' && (
        <>
          <ol>{rows.map(towerRow)}</ol>
          {/* A troca fica no fim da lista: assim a ordem ocupa toda a altura do painel. */}
          <button
            type="button"
            onClick={() => setGapMode(gapMode === 'leader' ? 'interval' : 'leader')}
            className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-ink-700 px-3 text-left text-[11px] text-ink-400 hover:text-ink-100"
          >
            <span>{gapMode === 'leader' ? 'Diferença para o líder' : 'Intervalo para o carro da frente'}</span>
            <span className="font-semibold text-ink-200">Trocar</span>
          </button>
        </>
      )}
      {panel === 'driver' && focus && (
        <div className="p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepFocus(-1)}
              disabled={focusIndex <= 0}
              aria-label="Piloto da frente"
              className="grid h-11 w-11 shrink-0 place-items-center bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              <ChevronUp size={18} aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center leading-tight">
              <div className="truncate font-display text-xl font-bold uppercase">
                {focus.state === 'retired' ? 'AB' : `P${focus.position}`} · {codeOf(focus.driverId)} <span className="text-ink-400">#{focus.number}</span>
              </div>
              <div className="truncate text-[11px] text-ink-400">
                {nameOf(focus.driverId)}
                {focusIsPlayer ? ' · você' : focusIsMine ? ' · sua equipe' : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => stepFocus(1)}
              disabled={focusIndex >= rows.length - 1}
              aria-label="Piloto de trás"
              className="grid h-11 w-11 shrink-0 place-items-center bg-ink-800 text-ink-200 hover:bg-ink-700 disabled:opacity-40"
            >
              <ChevronDown size={18} aria-hidden />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <CarSprite
              categoryId={category.id}
              teamId={focus.teamId}
              color={teams[focus.teamId]?.color ?? '#9aa3b2'}
              driverId={focus.driverId}
              number={focus.number}
              className="w-14 shrink-0"
            />
            <span className="min-w-0 truncate text-[11px] text-ink-400">{teams[focus.teamId]?.name}</span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
            {fact('Velocidade', `${Math.round(focus.speed)} km/h`)}
            {fact('Volta', `${Math.min(raceLaps, started ? focus.sample.lap : 0)}/${raceLaps}`)}
            {fact(
              'Pneus',
              <span className="flex items-center gap-1">
                {rules.pitStops && <CompoundDot compound={focus.compound} />}
                {Math.round((1 - focus.wear) * 100)}%
              </span>,
            )}
            {fact('À frente', ahead && started && focus.interval !== null && focus.state !== 'retired' ? `+${focus.interval.toFixed(1)}s` : '–')}
            {fact(
              'Atrás',
              behind && started && behind.interval !== null && behind.state !== 'retired' && focus.state !== 'retired'
                ? `+${behind.interval.toFixed(1)}s`
                : '–',
            )}
            {fact(rules.pitStops ? 'Paradas' : 'Largou em', rules.pitStops ? focus.pitStops : `${focus.grid}º`)}
            {fact('Última volta', formatLap(focus.lastLap))}
            {fact('Melhor', formatLap(focus.bestLap))}
          </dl>
          {(focus.damage >= 0.05 || focus.penaltySeconds > 0 || (rules.fuel && focusIsPlayer && focus.sample.record)) && (
            <p className="mt-2 text-xs text-gold-400">
              {rules.fuel && focusIsPlayer && focus.sample.record && (
                <span className="text-ink-300">
                  Combustível: {focus.sample.record.fuel.toFixed(1)} voltas no tanque, {Math.max(0, raceLaps - focus.sample.record.lap)} por correr.{' '}
                </span>
              )}
              {focus.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, focus.damage) * 100)}%. `}
              {focus.penaltySeconds > 0 && `Punições: ${focus.penaltySeconds}s somados ao tempo final.`}
            </p>
          )}
          {!spectator && (
            <p className="mt-3 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-400">
              <b className="font-semibold text-ink-200">{RACE_MODE_LABELS[raceMode]}.</b> {RACE_MODE_DESCRIPTIONS[raceMode]}
              {rules.fuel ? ' O ritmo também muda o consumo de combustível.' : ''}
            </p>
          )}
        </div>
      )}
      {panel === 'pits' && <PitStrategyCard race={race} bare />}
      {panel === 'events' && (
        <ul>
          {events.length === 0 && (
            <li className="px-3 py-3 text-sm text-ink-400">
              Os carros estão alinhados no grid.{' '}
              {rules.pitStops ? `Compostos: ${[...rules.dryCompounds, ...rules.wetCompounds].map((c) => TYRES[c].label.toLowerCase()).join(', ')}.` : ''}
            </li>
          )}
          {[...events]
            .reverse()
            .slice(0, 60)
            .map((e) => (
              <li
                key={e.index}
                className={cx(
                  'flex gap-2 border-t border-ink-700/70 px-3 py-1.5 text-xs first:border-t-0',
                  (isMine(e.driverId) || isMine(e.otherDriverId)) && 'bg-apex-500/10',
                )}
              >
                <span className="w-7 shrink-0 text-ink-500">V{e.lap}</span>
                <span className={EVENT_TONE[e.type] ?? 'text-ink-300'}>{e.message}</span>
              </li>
            ))}
        </ul>
      )}
    </>
  );

  const credit = trackId ? trackCredit(trackId) : null;
  const cameraButton = (active: boolean) =>
    cx('flex min-h-11 items-center gap-1.5 px-2.5 text-xs font-semibold', active ? 'bg-apex-500 text-white' : 'bg-ink-950/80 text-ink-200 hover:bg-ink-800');

  return (
    <div className={wide ? '' : 'space-y-3'}>
      {topSlot ? (
        createPortal(header, topSlot)
      ) : (
        <div className="chamfer flex min-h-12 items-center bg-ink-900 px-3 shadow-[inset_0_0_0_1px_var(--color-ink-700)]">{header}</div>
      )}

      {/* Em tela larga tudo cabe sem rolar: classificação à esquerda, pista no centro e a barra fixa embaixo. */}
      <div
        className={wide ? 'grid min-h-[13.5rem] grid-cols-[13.5rem_minmax(0,1fr)] gap-2 xl:grid-cols-[17rem_minmax(0,1fr)]' : 'flex flex-col gap-3'}
        style={wide ? { height: `calc(100dvh - ${showBar ? '8.75rem' : '5.5rem'} - env(safe-area-inset-top) - env(safe-area-inset-bottom))` } : undefined}
      >
        <aside className={cx('flex min-h-0 flex-col bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)]', !wide && 'order-2')}>
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
          <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', !wide && 'max-h-[26rem]')}>{sideContent}</div>
        </aside>

        {/* Na transmissão, placares e nomes ficam sobre a pista de propósito (o teste visual pula esta área). */}
        <div data-overlay-ok className={cx('relative min-h-0 min-w-0 overflow-hidden shadow-[inset_0_0_0_1px_var(--color-ink-700)]', !wide && 'order-1')}>
          <RaceCanvas
            timeline={timeline}
            circuit={circuit}
            teams={teams}
            drivers={drivers}
            timeRef={playback.timeRef}
            camera={camera}
            focusId={focus?.driverId ?? ''}
            mineIds={mineIds}
            lights={playback.lights}
            onSelect={setFocusId}
            className={wide ? 'h-full w-full' : 'aspect-[4/5] w-full'}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-1.5">
            <div className="pointer-events-auto flex min-w-0 max-w-[62%] flex-col gap-1">{notices}</div>
            <div className="pointer-events-auto ml-auto flex shrink-0 flex-col items-end gap-1 sm:flex-row" role="group" aria-label="Câmera">
              <button type="button" onClick={() => setCamera('overview')} aria-pressed={camera === 'overview'} className={cameraButton(camera === 'overview')}>
                <Video size={16} aria-hidden />
                Câmera geral
              </button>
              {best && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusId(
                      focusIsMine && camera === 'follow' && mineIds.size > 1
                        ? (rows.find((r) => mineIds.has(r.driverId) && r.driverId !== focus?.driverId)?.driverId ?? best.driverId)
                        : best.driverId,
                    );
                    setCamera('follow');
                  }}
                  aria-pressed={camera === 'follow' && focusIsMine}
                  title={mineIds.size > 1 ? 'Acompanha um carro da sua equipe; toque de novo para alternar' : undefined}
                  className={cameraButton(camera === 'follow' && focusIsMine)}
                >
                  <Crosshair size={16} aria-hidden />
                  {ownLabel}
                </button>
              )}
              {followLabel && (
                <button type="button" onClick={() => setCamera('follow')} aria-pressed={camera === 'follow'} className={cameraButton(camera === 'follow')}>
                  <Crosshair size={16} aria-hidden />
                  {followLabel}
                </button>
              )}
            </div>
          </div>
          {focus && (
            <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-stretch bg-ink-950/85 text-ink-100">
              <div className="w-1.5" style={{ background: teams[focus.teamId]?.color }} />
              <div className="px-2.5 py-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold leading-none">{focus.state === 'retired' ? 'AB' : `P${focus.position}`}</span>
                  <span className={cx('font-display text-lg font-bold leading-none tracking-wide', focusIsMine && 'text-apex-400')}>
                    {codeOf(focus.driverId)}
                  </span>
                  <span className="text-[11px] text-ink-400">#{focus.number}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-300">
                  <span>
                    <b className="font-display text-base text-ink-100">{Math.round(focus.speed)}</b> km/h
                  </span>
                  {started && focus.state !== 'retired' && focus.interval !== null && (
                    <span className="flex items-center">
                      <ChevronUp size={12} aria-hidden /> {focus.interval.toFixed(1)}s
                    </span>
                  )}
                  {started && focus.state !== 'retired' && behind && behind.interval !== null && behind.state !== 'retired' && (
                    <span className="flex items-center">
                      <ChevronDown size={12} aria-hidden /> {behind.interval.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <ul className={cx('pointer-events-none absolute left-1.5 max-w-[56%] space-y-1', credit ? 'bottom-6' : 'bottom-1.5')} aria-live="polite">
            {ticker.map((e) => (
              <li
                key={e.index}
                className={cx(
                  'w-fit bg-ink-950/80 px-2 py-1 text-xs',
                  EVENT_TONE[e.type] ?? 'text-ink-200',
                  (isMine(e.driverId) || isMine(e.otherDriverId)) && 'shadow-[inset_2px_0_0_0_var(--color-apex-500)]',
                )}
              >
                {e.message}
              </li>
            ))}
          </ul>
          {credit && <span className="pointer-events-none absolute bottom-1.5 left-1.5 bg-ink-950/70 px-1 text-[9px] text-ink-300">Traçado: {credit}</span>}
        </div>
      </div>

      {showBar && myRow && (
        <RaceControlBar
          position={myRow.state === 'retired' ? 'AB' : `P${started ? myRow.position : myRow.grid}`}
          lap={`Volta ${Math.min(raceLaps, started ? myRow.sample.lap : 0)}/${raceLaps}`}
          mode={raceMode}
          onMode={setRaceMode}
          modeDisabled={myCar?.status !== 'running' || finished}
          modeFromLap={race.currentLap < race.totalLaps ? race.currentLap + 1 : null}
          playing={playback.playing}
          playLabel={playLabel}
          onToggle={playback.toggle}
          toggleDisabled={orderDue}
          speeds={SPEEDS.map((s) => ({ label: `${s}×`, active: playback.speed === s, select: () => playback.setSpeed(s) }))}
        />
      )}
      {/* Quem só assiste não tem a barra de ritmo, mas precisa de pausar e da velocidade. */}
      {!showBar && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant={playback.playing ? 'secondary' : 'primary'} onClick={playback.toggle} disabled={orderDue} className="min-w-28">
            {playback.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playLabel}
          </Button>
          <div className="flex bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)]" role="group" aria-label="Velocidade da corrida">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => playback.setSpeed(s)}
                aria-pressed={playback.speed === s}
                className={cx(
                  'min-h-11 min-w-11 px-1 text-sm font-semibold',
                  playback.speed === s ? 'bg-apex-500 text-white' : 'text-ink-300 hover:text-ink-100',
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SidePanel = 'tower' | 'driver' | 'pits' | 'events';
