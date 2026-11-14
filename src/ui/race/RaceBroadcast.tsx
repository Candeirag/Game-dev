/**
 * Corrida visual: o circuito visto de cima com os carros em movimento, a torre
 * de tempos, o painel do piloto e os comandos do jogador.
 *
 * Tudo o que aparece aqui (posições, diferenças, pneus, eventos) é lido da
 * linha do tempo no instante exibido. O estado do motor fica até uma volta à
 * frente da imagem e não é mostrado antes da hora.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WEATHER_LABELS } from '@/domain/labels';
import { getTrack } from '@/data/tracks';
import { TYRES, buildCircuit, conditionFor, eventsUntil, finalizeRace, fullName, isRaceFinished, lapInfoAt, standingsAt, type StandingRow } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CompoundDot, EVENT_TONE, RaceResultPanel } from '../components/RaceView';
import { Button, Card, cx } from '../components/ui';
import { formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { RaceCanvas } from './RaceCanvas';
import { PitStrategyCard, RaceModeCard, TeamOrderDialog } from './RaceCommands';
import { driverCode, type CameraMode } from './raceScene';
import { SPEEDS, useRacePlayback } from './useRacePlayback';

const DNF_SHORT: Record<string, string> = { crash: 'Batida', collision: 'Toque', mechanical: 'Quebra', damage: 'Danos', fuel: 'Pane seca' };

type FlagTone = 'green' | 'yellow' | 'red' | 'chequered' | 'neutral';
const FLAG_STYLE: Record<FlagTone, string> = {
  green: 'border-go-400/50 bg-go-400/15 text-go-400',
  yellow: 'border-gold-400/60 bg-gold-400/20 text-gold-400',
  red: 'border-apex-500/70 bg-apex-500/20 text-apex-400',
  chequered: 'border-ink-300/60 bg-ink-100/10 text-ink-100',
  neutral: 'border-ink-600 bg-ink-800 text-ink-300',
};

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('h-4 w-4 shrink-0 fill-current', className)}>
      <path d={path} />
    </svg>
  );
}
const ICONS = {
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M6 4.5h4.5v15H6zm7.5 0H18v15h-4.5z',
  next: 'M5 4.5v15l10-7.5zm11.5 0H19v15h-2.5z',
  restart: 'M12 5V1.5L7 6l5 4.5V7a5.5 5.5 0 1 1-5.5 5.5H4.5A7.5 7.5 0 1 0 12 5z',
  overview: 'M3 5h18v14H3zm2 2v10h14V7zm2.5 2.5h9v5h-9z',
  follow: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
  flag: 'M5 3h2v18H5zm3 1h11l-2.5 4L19 12H8z',
  live: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5.6 5.6 7 7a7 7 0 0 0 0 10l-1.4 1.4a9 9 0 0 1 0-12.8zm12.8 0a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-10z',
} as const;

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
export function RaceBroadcast({ viewSwitch, spectator = false }: { viewSwitch?: ReactNode; spectator?: boolean }) {
  const { career, player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const timeline = useGameStore((s) => s.raceTimeline);
  const playback = useRacePlayback();
  const [camera, setCamera] = useState<CameraMode>('overview');
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
    return new Set(Object.values(timeline.cars).filter((c) => teamId !== null && c.teamId === teamId).map((c) => c.driverId));
  }, [timeline, player.id, player.teamId, managedTeamId]);

  // Ao voltar para a transmissão com a corrida em andamento, a imagem retoma do ponto mais recente.
  // Quem só assiste começa sempre do grid: a corrida inteira já está simulada.
  const { goLive } = playback;
  useEffect(() => {
    if (!spectator && (useGameStore.getState().raceTimeline?.lapsBuilt ?? 0) > 0) goLive();
  }, [goLive, spectator]);

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
  const recentIncident = events.slice(-8).some((e) => (e.type === 'dnf' || e.type === 'spin' || e.type === 'collision') && time - e.time < timeline.referenceLap * 0.25);
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

  if (result && playback.phase === 'finished') {
    return <RaceResultPanel race={race} result={result} extra={<Button onClick={playback.restart}><Icon path={ICONS.restart} />Rever a corrida</Button>} />;
  }

  const playLabel = playback.playing ? 'Pausar' : playback.phase === 'grid' ? 'Largar' : playback.phase === 'suspended' ? 'Relargar' : 'Continuar';
  const ticker = events.slice(-3).filter((e) => time - e.time < timeline.referenceLap * 0.45).reverse();
  const focusIsPlayer = focus?.driverId === player.id;
  const focusIsMine = focus ? mineIds.has(focus.driverId) : false;
  const followLabel = focus && !focusIsMine ? `Acompanhar ${codeOf(focus.driverId)}` : null;
  const isMine = (id: string | undefined) => id !== undefined && mineIds.has(id);
  const ownLabel = mineIds.has(player.id) ? 'Meu piloto' : 'Minha equipe';

  return (
    <div className="space-y-3">
      {/* Barra da transmissão: volta, bandeira, clima e controles de reprodução. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-ink-700/70 bg-ink-900 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Volta</div>
            <div className="font-display text-3xl font-bold leading-none tabular">{leaderLap}<span className="text-ink-500">/{raceLaps}</span></div>
          </div>
          <span role="status" className={cx('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wide', FLAG_STYLE[flag.tone])}>
            <Icon path={ICONS.flag} />{flag.label}
          </span>
          <span className="hidden text-xs text-ink-300 sm:inline">
            {WEATHER_LABELS[conditionFor(wetness)]}{wetness > 0.02 ? ` · pista ${Math.round(wetness * 100)}% molhada` : ''}
            {race.forecast.kind !== 'stable' && race.forecast.aroundLap !== null && leaderLap < race.forecast.aroundLap && (
              <span className="text-rain-400"> · previsão: {race.forecast.kind === 'rain' ? 'chuva' : 'pista secando'} perto da volta {race.forecast.aroundLap}</span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={playback.playing ? 'secondary' : 'primary'} onClick={playback.toggle} disabled={playback.phase === 'order'} className="min-w-28">
            <Icon path={playback.playing ? ICONS.pause : ICONS.play} />{playLabel}
          </Button>
          <div className="flex rounded-lg border border-ink-700 p-0.5" role="group" aria-label="Velocidade da corrida">
            {SPEEDS.map((s) => (
              <button key={s} type="button" onClick={() => playback.setSpeed(s)} aria-pressed={playback.speed === s} className={cx('rounded-md px-2.5 py-1 text-xs font-semibold tabular', playback.speed === s ? 'bg-apex-500 text-white' : 'text-ink-400 hover:text-ink-100')}>{s}×</button>
            ))}
          </div>
          <Button onClick={playback.skipLap} disabled={playback.phase === 'order' || playback.phase === 'suspended' || playback.phase === 'lights'} title="Avança até o fim da volta do líder"><Icon path={ICONS.next} />+1 volta</Button>
        </div>
      </div>

      {!spectator && <TeamOrderDialog race={race} />}
      {playback.phase === 'suspended' && (
        <div role="status" className="rounded-xl border border-apex-500/60 bg-apex-500/15 px-4 py-3 text-sm font-semibold text-apex-400">
          BANDEIRA VERMELHA · corrida interrompida. Os carros voltam ao grid para uma relargada parada.{rules.pitStops ? ' A troca de pneus é livre: escolha um composto em "Boxes e estratégia", se quiser trocar.' : ''} Toque em Relargar quando estiver pronto.
        </div>
      )}
      {info?.flag !== 'green' && info && started && !chequered && playback.phase !== 'suspended' && (
        <div role="status" className="rounded-xl border border-gold-400/50 bg-gold-400/15 px-4 py-2.5 text-sm font-semibold text-gold-400">
          {info.flag === 'sc' ? 'SAFETY CAR NA PISTA' : 'SAFETY CAR VIRTUAL'} · ultrapassagens proibidas{rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {timeline.finished && playback.phase !== 'finished' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-ink-300">
          <span>{spectator ? 'Você acompanha do pit wall: na corrida, os pilotos decidem ritmo e paradas.' : 'A corrida já foi decidida; você está revendo as imagens.'}</span>
          <Button onClick={playback.goLive}>{spectator ? 'Pular para o resultado' : 'Ver o resultado'}</Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[236px_minmax(0,1fr)]">
        {/* Torre de tempos */}
        <div className="order-2 lg:order-1">
          <Card padded={false} title="Classificação" action={
            <button type="button" onClick={() => setGapMode(gapMode === 'leader' ? 'interval' : 'leader')} className="rounded-md border border-ink-700 px-2 py-0.5 text-[11px] font-semibold text-ink-300 hover:border-ink-500">
              {gapMode === 'leader' ? 'Dif. p/ líder' : 'Intervalo'}
            </button>
          }>
            <ol className="py-1">
              {rows.map((row) => {
                const isMe = mineIds.has(row.driverId);
                const gained = row.grid - row.position;
                return (
                  <li key={row.driverId}>
                    <button type="button" onClick={() => setFocusId(row.driverId)} aria-pressed={row.driverId === focus?.driverId} title={`${nameOf(row.driverId)} · ${teams[row.teamId]?.name ?? ''}`}
                      className={cx('grid h-7 w-full grid-cols-[22px_4px_minmax(0,1fr)_auto_auto] items-center gap-1.5 px-2 text-left text-[13px] transition-colors hover:bg-ink-800', isMe && 'bg-apex-500/15', row.driverId === focus?.driverId && 'outline outline-1 -outline-offset-1 outline-ink-300', row.state === 'retired' && 'opacity-50')}>
                      <span className="text-right font-display text-base font-bold leading-none tabular">{row.state === 'retired' ? '–' : row.position}</span>
                      <span className="h-4 w-1 rounded-sm" style={{ background: teams[row.teamId]?.color }} />
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <b className={cx('font-display text-[15px] leading-none tracking-wide', isMe && 'text-apex-400')}>{codeOf(row.driverId)}</b>
                        <span className="truncate text-[11px] text-ink-400">{row.number}</span>
                        {started && row.state !== 'retired' && gained !== 0 && <span className={cx('text-[9px]', gained > 0 ? 'text-go-400' : 'text-apex-400')}>{gained > 0 ? `▲${gained}` : `▼${-gained}`}</span>}
                        {row.penaltySeconds > 0 && <span className="rounded bg-gold-400/20 px-1 text-[9px] font-bold text-gold-400">+{row.penaltySeconds}s</span>}
                      </span>
                      <span className={cx('text-right text-xs tabular', row.state === 'pit' ? 'font-bold text-sky-300' : 'text-ink-300')}>{row.state === 'pit' ? 'BOX' : gapText(row, gapMode, started)}</span>
                      <span className="flex items-center justify-end gap-1">
                        {rules.pitStops ? <CompoundDot compound={row.compound} /> : null}
                        <span className="h-1.5 w-5 overflow-hidden rounded-full bg-ink-800" title={`${Math.round((1 - row.wear) * 100)}% de pneu`}>
                          <span className={cx('block h-full rounded-full', row.wear > 0.75 ? 'bg-apex-500' : row.wear > 0.45 ? 'bg-gold-400' : 'bg-go-400')} style={{ width: `${Math.max(6, (1 - row.wear) * 100)}%` }} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        {/* Pista */}
        <div className="order-1 min-w-0 lg:order-2">
          <div className="relative overflow-hidden rounded-xl border border-ink-700/70">
            <RaceCanvas timeline={timeline} circuit={circuit} teams={teams} drivers={drivers} timeRef={playback.timeRef} camera={camera} focusId={focus?.driverId ?? ''} mineIds={mineIds} lights={playback.lights} onSelect={setFocusId} className="aspect-[4/5] w-full sm:aspect-[25/16]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-end gap-2 p-2">
              <div className="pointer-events-auto flex flex-wrap justify-end gap-1" role="group" aria-label="Câmera">
                <button type="button" onClick={() => setCamera('overview')} aria-pressed={camera === 'overview'} className={cx('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', camera === 'overview' ? 'bg-apex-500 text-white' : 'bg-ink-950/75 text-ink-200 hover:bg-ink-800')}><Icon path={ICONS.overview} />Câmera geral</button>
                {best && <button type="button" onClick={() => { setFocusId(focusIsMine && camera === 'follow' && mineIds.size > 1 ? (rows.find((r) => mineIds.has(r.driverId) && r.driverId !== focus?.driverId)?.driverId ?? best.driverId) : best.driverId); setCamera('follow'); }} aria-pressed={camera === 'follow' && focusIsMine} title={mineIds.size > 1 ? 'Acompanha um carro da sua equipe; toque de novo para alternar' : undefined} className={cx('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', camera === 'follow' && focusIsMine ? 'bg-apex-500 text-white' : 'bg-ink-950/75 text-ink-200 hover:bg-ink-800')}><Icon path={ICONS.follow} />{ownLabel}</button>}
                {followLabel && <button type="button" onClick={() => setCamera('follow')} aria-pressed={camera === 'follow'} className={cx('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', camera === 'follow' ? 'bg-apex-500 text-white' : 'bg-ink-950/75 text-ink-200 hover:bg-ink-800')}><Icon path={ICONS.follow} />{followLabel}</button>}
              </div>
            </div>
            {focus && (
              <div className="pointer-events-none absolute bottom-2 right-2 flex items-stretch overflow-hidden rounded-lg bg-ink-950/85 text-ink-100">
                <div className="w-1.5" style={{ background: teams[focus.teamId]?.color }} />
                <div className="px-2.5 py-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold leading-none tabular">{focus.state === 'retired' ? 'AB' : `P${focus.position}`}</span>
                    <span className={cx('font-display text-lg font-bold leading-none tracking-wide', focusIsMine && 'text-apex-400')}>{codeOf(focus.driverId)}</span>
                    <span className="text-[11px] text-ink-400 tabular">#{focus.number}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-3 text-[11px] text-ink-300 tabular">
                    <span><b className="font-display text-base text-ink-100">{Math.round(focus.speed)}</b> km/h</span>
                    {started && focus.state !== 'retired' && focus.interval !== null && <span>▲ {focus.interval.toFixed(1)}s</span>}
                    {started && focus.state !== 'retired' && behind && behind.interval !== null && behind.state !== 'retired' && <span>▼ {behind.interval.toFixed(1)}s</span>}
                  </div>
                </div>
              </div>
            )}
            <ul className="pointer-events-none absolute bottom-2 left-2 max-w-[58%] space-y-1" aria-live="polite">
              {ticker.map((e) => (
                <li key={e.index} className={cx('w-fit rounded-md bg-ink-950/80 px-2 py-1 text-xs', EVENT_TONE[e.type] ?? 'text-ink-200', (isMine(e.driverId) || isMine(e.otherDriverId)) && 'ring-1 ring-apex-500/70')}>{e.message}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={playback.restart} disabled={timeline.lapsBuilt === 0} title="Mostra a corrida de novo desde a largada, sem simular nada outra vez"><Icon path={ICONS.restart} />Reiniciar visualização</Button>
              {playback.behindLive && !timeline.finished && <Button onClick={playback.goLive}><Icon path={ICONS.live} />Voltar ao vivo</Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {!timeline.finished && <Button variant="ghost" onClick={playback.finish} title="O engenheiro assume paradas e combustível até o fim, e a tela vai direto para o resultado">Simular até o fim</Button>}
              {viewSwitch}
            </div>
          </div>
        </div>

      </div>

      {/* Piloto em destaque e comandos */}
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {focus && (
            <Card padded={false}>
              <div className="flex items-stretch">
                <div className="grid w-16 shrink-0 place-items-center rounded-l-xl font-display text-3xl font-bold" style={{ background: teams[focus.teamId]?.color, color: '#0b0d11' }}>
                  <span className="rounded bg-ink-950/85 px-1.5 text-ink-100 tabular">{focus.state === 'retired' ? 'AB' : focus.position}</span>
                </div>
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate font-display text-xl font-bold uppercase leading-tight">{nameOf(focus.driverId)}</div>
                    <div className="font-display text-lg font-bold text-ink-400 tabular">#{focus.number}</div>
                  </div>
                  <div className="truncate text-xs text-ink-400">{teams[focus.teamId]?.name}{focusIsPlayer ? ' · você' : focusIsMine ? ' · sua equipe' : ''}</div>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 border-t border-ink-800 px-3 py-3 text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink-400">Velocidade</dt>
                  <dd className="font-display text-2xl font-bold leading-none tabular">{Math.round(focus.speed)}<span className="ml-1 text-xs font-semibold text-ink-400">km/h</span></dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink-400">Volta</dt>
                  <dd className="font-display text-2xl font-bold leading-none tabular">{Math.min(raceLaps, started ? focus.sample.lap : 0)}<span className="text-sm text-ink-500">/{raceLaps}</span></dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-ink-400">Pneus</dt>
                  <dd className="flex items-center gap-1.5 font-display text-2xl font-bold leading-none tabular">{rules.pitStops && <CompoundDot compound={focus.compound} />}{Math.round((1 - focus.wear) * 100)}%</dd>
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-x-3">
                  <div><dt className="text-[10px] uppercase tracking-wider text-ink-400">À frente</dt><dd className="truncate tabular">{ahead && started && focus.interval !== null && focus.state !== 'retired' ? `+${focus.interval.toFixed(1)}s · ${codeOf(ahead.driverId)}` : '-'}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wider text-ink-400">Atrás</dt><dd className="truncate tabular">{behind && started && behind.interval !== null && behind.state !== 'retired' && focus.state !== 'retired' ? `+${behind.interval.toFixed(1)}s · ${codeOf(behind.driverId)}` : '-'}</dd></div>
                </div>
                <div className="col-span-3 grid grid-cols-3 gap-x-3 text-xs text-ink-300">
                  <div><dt className="text-[10px] uppercase tracking-wider text-ink-400">Última volta</dt><dd className="tabular">{formatLap(focus.lastLap)}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wider text-ink-400">Melhor</dt><dd className="tabular">{formatLap(focus.bestLap)}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wider text-ink-400">{rules.pitStops ? 'Paradas' : 'Largou em'}</dt><dd className="tabular">{rules.pitStops ? focus.pitStops : `${focus.grid}º`}</dd></div>
                </div>
                {(focus.damage >= 0.05 || focus.penaltySeconds > 0 || (rules.fuel && focusIsPlayer && focus.sample.record)) && (
                  <div className="col-span-3 text-xs text-gold-400">
                    {rules.fuel && focusIsPlayer && focus.sample.record && <span className="text-ink-300">Combustível: {focus.sample.record.fuel.toFixed(1)} voltas no tanque, {Math.max(0, raceLaps - focus.sample.record.lap)} por correr. </span>}
                    {focus.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, focus.damage) * 100)}%. `}
                    {focus.penaltySeconds > 0 && `Punições: ${focus.penaltySeconds}s somados ao tempo final.`}
                  </div>
                )}
              </dl>
            </Card>
          )}
        {!spectator && <RaceModeCard race={race} />}
        {!spectator && <PitStrategyCard race={race} />}
      </div>

      <Card title="Acontecimentos" padded={false}>
        <ul className="max-h-64 overflow-y-auto">
          {events.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">Os carros estão alinhados no grid. {rules.pitStops ? `Compostos: ${[...rules.dryCompounds, ...rules.wetCompounds].map((c) => TYRES[c].label.toLowerCase()).join(', ')}.` : ''}</li>}
          {[...events].reverse().slice(0, 60).map((e) => (
            <li key={e.index} className={cx('flex gap-3 border-t border-ink-800 px-4 py-1.5 text-sm first:border-t-0', (isMine(e.driverId) || isMine(e.otherDriverId)) && 'bg-apex-500/8')}>
              <span className="w-8 shrink-0 text-xs tabular text-ink-500">V{e.lap}</span>
              <span className={EVENT_TONE[e.type] ?? 'text-ink-300'}>{e.message}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
