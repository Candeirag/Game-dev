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
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleUser,
  Crosshair,
  Eye,
  FastForward,
  Flag,
  Headset,
  ListOrdered,
  type LucideIcon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScrollText,
  SkipForward,
  TriangleAlert,
  Video,
  Wrench,
  X,
} from 'lucide-react';
import {
  DRIVING_STYLE_DESCRIPTIONS,
  DRIVING_STYLE_LABELS,
  MOMENT_KIND_LABELS,
  RACE_MODE_DESCRIPTIONS,
  RACE_MODE_LABELS,
  WEATHER_LABELS,
} from '@/domain/labels';
import { getTrack } from '@/data/tracks';
import {
  buildCircuit,
  conditionFor,
  drivingStyle,
  drivingStyleScore,
  eventsUntil,
  finalizeRace,
  fullName,
  isRaceFinished,
  lapInfoAt,
  standingsAt,
  type StandingRow,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CarSprite } from '../components/CarSprite';
import { RaceResultPanel } from '../components/RaceView';
import { Button, cx, Delta, LowerThird, PortraitOr, Tower, type TowerRow, TyreBadge, TyreGauge, TyreLegend, TyreWearBar, tyreName, WholeRows } from '@/ui/kit';
import { portraitUrl } from '../images';
import { feedback } from '../feedback/feedback';
import { formatInterval, formatLap, trackCredit } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { useChrome, useMediaQuery } from '../layout/chrome';
import { prefersReducedMotion } from '../motion';
import { MomentBar, useStageAboveMoment } from './MomentBar';
import { EVENT_TONE, HeaderButton, Mark } from './raceBits';
import { RaceCanvas } from './RaceCanvas';
import { PitStrategyCard, TeamOrderDialog } from './RaceCommands';
import { RaceControlBar } from './RaceControlBar';
import { playerRaceProfile, shownLapTimes } from './raceInfo';
import { driverCode, type CameraMode } from './raceScene';
import { PlayerTyrePanel, type ShownTyre } from './TyrePanel';
import { useRaceBanners } from './useRaceBanners';
import { useRaceFeedback } from './useRaceFeedback';
import { SPEEDS, useRacePlayback } from './useRacePlayback';
import { useSettings } from '../settings/useSettings';
import { systemPrefersReducedMotion } from '../settings/settings';

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
  // Diferenças de tempo sempre com três casas (regra 6).
  return value === null ? '' : formatInterval(value);
}

/** Dois carros a menos disso um do outro estão em disputa: a torre realça o par em foco. Só exibição. */
const BATTLE_GAP_SECONDS = 1.5;

/**
 * `spectator`: a corrida já foi simulada por inteiro e o jogador só assiste (dirigente no muro dos boxes
 * ou piloto fora da etapa). Não há comandos; os carros em destaque são os da equipe dele.
 */
export function RaceBroadcast({ onTimingView, spectator = false }: { onTimingView?: () => void; spectator?: boolean }) {
  const { wide, topSlot } = useChrome();
  // Com mouse, as linhas da classificação são clicáveis; no toque, são só leitura (ver a torre).
  // Mouse de verdade: tela de toque não conta, mesmo quando o sistema diz que o ponteiro é fino.
  const finePointer = useMediaQuery('(pointer: fine)') && navigator.maxTouchPoints === 0 && !('ontouchstart' in window);
  const [side, setSide] = useState<SidePanel>('tower');
  // No formato largo a torre fica sempre à vista; piloto, boxes e eventos abrem numa camada sobre a pista.
  const [drawer, setDrawer] = useState<Exclude<SidePanel, 'tower'> | null>(null);
  // Menos movimento: a câmera não acompanha nem dá zoom; fica parada no circuito inteiro.
  const stillCamera = useSettings().reduceMotion || systemPrefersReducedMotion();
  const { career, player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const timeline = useGameStore((s) => s.raceTimeline);
  const raceMode = useGameStore((s) => s.raceMode);
  const setRaceMode = useGameStore((s) => s.setRaceMode);
  const playback = useRacePlayback();
  // A corrida abre acompanhando o carro do jogador, com o circuito inteiro no minimapa.
  const [chosenCamera, setCamera] = useState<CameraMode>('follow');
  const camera: CameraMode = stillCamera ? 'overview' : chosenCamera;
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

  // Vibração e som: o que acontece com o carro do jogador e a bandeirada, no instante em que aparecem.
  useRaceFeedback({
    events,
    mineIds,
    playing: playback.playing,
    chequered: timeline !== null && timeline.winnerTime !== null && time >= timeline.winnerTime,
  });

  // Faixas passageiras de quem corre: o desfecho de cada lance decisivo e o rádio do engenheiro.
  const banners = useRaceBanners({ timeline, time, playing: playback.playing, enabled: !spectator && mineIds.has(player.id) });
  const profile = useMemo(() => playerRaceProfile(career), [career]);

  // Lance decisivo: a pergunta só aparece quando a imagem chega ao ponto em que o motor precisa da
  // resposta (na largada, já no grid). A corrida fica parada, sem tempo limite.
  const momentDue = !spectator && race !== null && timeline !== null && race.pendingMoment !== null && !timeline.finished && time >= timeline.horizon - 1e-6;
  // A tarja do lance ocupa o pé da tela: a gaveta aberta sairia de baixo dela, então fecha.
  useEffect(() => {
    if (!momentDue) return;
    setDrawer(null);
    // Em pé a página rola: ela volta ao topo, para a pista ficar à vista acima da tarja.
    if (!wide) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [momentDue, wide]);
  // Deitado, a pista e a torre encolhem para caber inteiras acima da tarja: nada fica atrás dela e o
  // carro do jogador continua no centro da imagem. Em pé a página rola, e a tarja fica sobre o pé dela.
  const { stage, height: stageHeight, onHeight: setMomentBarHeight } = useStageAboveMoment<HTMLDivElement>(momentDue && wide);

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
  // O pneu do jogador como está na imagem (não o do motor, que anda até uma volta à frente).
  const myTyre: ShownTyre | null =
    !spectator && myRow
      ? {
          compound: myRow.compound,
          wear: myRow.wear,
          lap: Math.min(timeline.totalLaps, myRow.laps),
          totalLaps: timeline.totalLaps,
          times: shownLapTimes(timeline, player.id, time),
          state: myRow.state === 'retired' ? 'retired' : myRow.state === 'finished' ? 'finished' : 'running',
        }
      : null;
  const style = drivingStyle(drivingStyleScore(player, profile, raceMode));

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

  // Deitado, o resumo dos pneus do jogador vai na barra superior (em pé, no cartão do piloto em foco).
  const tyreAtSight = wide && myTyre && (
    <div title="Pneus do seu carro" className="w-52 min-w-0 shrink overflow-hidden">
      <PlayerTyrePanel tyre={myTyre} compact />
    </div>
  );

  // Cabeçalho da transmissão: volta, bandeira, clima e os comandos da reprodução. No formato largo ele
  // ocupa a barra superior do jogo, para a pista ficar com toda a altura da tela.
  const header = (
    <div className={cx('flex min-w-0 flex-1 items-center gap-x-2', !topSlot && 'flex-wrap py-1')}>
      <div className="flex shrink-0 items-baseline gap-2 leading-none">
        <span className="text-2xs font-medium text-ink-400">Volta</span>
        <span className="font-display text-2xl font-bold leading-none">
          {leaderLap}
          <span className="text-ink-400">/{raceLaps}</span>
        </span>
      </div>
      <span
        role="status"
        className={cx(
          'chamfer-br inline-flex shrink-0 items-center gap-2 px-2 py-2 text-xs font-bold uppercase leading-none tracking-wide [--chamfer:6px]',
          FLAG_STYLE[flag.tone],
        )}
      >
        <Flag size={14} aria-hidden />
        {flag.label}
      </span>
      <span className="hidden min-w-0 truncate text-xs text-ink-300 lg:inline">{weatherText}</span>
      {/* Os pneus do jogador, sempre à vista sem tapar a pista: desgaste, penhasco, tempos de volta e a janela de parada. */}
      {tyreAtSight}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {playback.behindLive && !timeline.finished && <HeaderButton icon={Radio} label="Voltar ao vivo" onClick={playback.goLive} />}
        <HeaderButton
          icon={SkipForward}
          label="+1 volta"
          // Com os pneus na barra superior, o nome do botão só aparece quando sobra largura.
          always={!tyreAtSight}
          onClick={playback.skipLap}
          disabled={orderDue || momentDue || playback.phase === 'suspended' || playback.phase === 'lights'}
          title={momentDue ? 'Responda ao lance para a corrida seguir' : 'Avança até o fim da volta do líder'}
        />
        {!timeline.finished && (
          <HeaderButton
            icon={FastForward}
            label="Simular até o fim"
            onClick={playback.finish}
            title={
              spectator
                ? 'A tela vai direto para o resultado'
                : 'O piloto decide os lances pelo estilo dele, o engenheiro assume paradas e combustível, e a tela vai direto para o resultado'
            }
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
        <div
          role="status"
          className="overlay px-2 py-2 text-xs font-semibold text-apex-400 shadow-[inset_3px_0_0_0_var(--color-apex-400),var(--shadow-overlay)]"
        >
          Bandeira vermelha: corrida interrompida. Os carros voltam ao grid para uma relargada parada.
          {rules.pitStops ? ' A troca de pneus é livre: escolha um composto na aba Boxes, se quiser trocar.' : ''} Toque em Relargar quando estiver pronto.
        </div>
      )}
      {info?.flag !== 'green' && info && started && !chequered && playback.phase !== 'suspended' && (
        <div
          role="status"
          className="overlay px-2 py-2 text-xs font-semibold text-gold-400 shadow-[inset_3px_0_0_0_var(--color-gold-400),var(--shadow-overlay)]"
        >
          {info.flag === 'sc' ? 'Safety car na pista' : 'Safety car virtual'}: ultrapassagens proibidas
          {rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {timeline.finished && playback.phase !== 'finished' && (
        <div className="overlay flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-xs text-ink-100">
          <span>
            {spectator
              ? 'Você acompanha do muro dos boxes: na corrida, os pilotos decidem ritmo e paradas.'
              : 'A corrida já foi decidida; você está revendo as imagens.'}
          </span>
          <Button onClick={playback.goLive}>{spectator ? 'Pular para o resultado' : 'Ver o resultado'}</Button>
        </div>
      )}
    </>
  );

  // A disputa em foco: o piloto em destaque e o vizinho mais próximo, se estiverem colados.
  const battleIds = new Set<string>();
  if (started && focus && focus.state !== 'retired') {
    const gapAhead = ahead && ahead.state !== 'retired' && focus.interval !== null ? focus.interval : Number.POSITIVE_INFINITY;
    const gapBehind = behind && behind.state !== 'retired' && behind.interval !== null ? behind.interval : Number.POSITIVE_INFINITY;
    const rival = gapAhead <= gapBehind ? ahead : behind;
    if (rival && Math.min(gapAhead, gapBehind) <= BATTLE_GAP_SECONDS) {
      battleIds.add(focus.driverId);
      battleIds.add(rival.driverId);
    }
  }

  const towerRows: TowerRow[] = rows.map((row) => {
    const out = row.state === 'retired';
    const gained = row.grid - row.position;
    return {
      id: row.driverId,
      position: out ? '–' : row.position,
      color: teams[row.teamId]?.color,
      name: codeOf(row.driverId),
      team: teams[row.teamId]?.name,
      marks: (
        <>
          {started && !out && <Delta value={gained} signless threshold={0.5} className="shrink-0 text-2xs" />}
          {row.penaltySeconds > 0 && <Mark tone="attention" title="Punição somada ao tempo final">{`+${row.penaltySeconds}s`}</Mark>}
        </>
      ),
      value: row.state === 'pit' ? <b className="text-ink-100">BOX</b> : gapText(row, gapMode, started),
      tyre: (
        <>
          {rules.pitStops && <TyreBadge compound={row.compound} />}
          {/* A barra enche conforme o pneu gasta, até a marca do penhasco; o estado vai em palavras na dica. */}
          <TyreWearBar compound={row.compound} wear={row.wear} className="w-5" />
        </>
      ),
      mine: mineIds.has(row.driverId),
      battle: battleIds.has(row.driverId),
      out,
      title: `${nameOf(row.driverId)} · ${teams[row.teamId]?.name ?? ''}`,
    };
  });
  // Com mouse, clicar na linha destaca o piloto. No toque a linha é só leitura (é baixa demais para um
  // alvo de 44 px): o destaque muda pelas setas do painel Piloto ou tocando no carro.
  // A torre mostra sempre linhas inteiras (WholeRows): a linha acima da do jogador, que gruda no pé,
  // não fica cortada. Nas categorias com troca de pneus, a legenda das letras dos selos fica no pé do
  // painel, à vista sem rolar.
  const tower = (
    <>
      <WholeRows>
        <Tower label="Ordem da corrida" rows={towerRows} onSelect={finePointer ? setFocusId : undefined} selectedId={focus?.driverId} />
      </WholeRows>
      {rules.pitStops && <TyreLegend compounds={[...rules.dryCompounds, ...rules.wetCompounds]} className="shrink-0 border-t border-ink-700 px-2 py-1" />}
    </>
  );
  // Um toque troca a diferença mostrada: para o líder ou para o carro da frente.
  const gapToggle = (
    <button
      type="button"
      onClick={() => setGapMode(gapMode === 'leader' ? 'interval' : 'leader')}
      className="flex min-h-11 w-full shrink-0 items-center justify-between gap-2 border-b border-ink-700 bg-ink-800 px-2 text-left text-xs text-ink-200 transition-colors hover:text-ink-100"
    >
      {/* Sem reticências: o modo é a informação. Com o texto grande, a frase quebra em duas linhas. */}
      <span className="min-w-0 py-1 leading-tight">
        Diferença para <b className="font-semibold text-ink-100">{gapMode === 'leader' ? 'o líder' : 'o carro da frente'}</b>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-semibold text-ink-100">
        <ArrowLeftRight size={16} aria-hidden />
        Trocar
      </span>
    </button>
  );

  const fact = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-2xs font-medium text-ink-400">{label}</dt>
      <dd className="truncate font-display text-lg font-semibold leading-tight">{value}</dd>
    </div>
  );
  const intervalAhead = ahead && started && focus && focus.interval !== null && focus.state !== 'retired' ? focus.interval : null;
  const intervalBehind =
    behind && started && focus && behind.interval !== null && behind.state !== 'retired' && focus.state !== 'retired' ? behind.interval : null;

  const driverPanel = focus && (
    <div className="p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => stepFocus(-1)}
          disabled={focusIndex <= 0}
          aria-label="Piloto da frente"
          className="grid h-11 w-11 shrink-0 place-items-center bg-ink-800 text-ink-100 shadow-ring hover:bg-ink-700"
        >
          <ChevronUp size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <div className="truncate font-display text-xl font-bold uppercase">
            {focus.state === 'retired' ? 'AB' : `P${focus.position}`} · {codeOf(focus.driverId)} <span className="text-ink-300">#{focus.number}</span>
          </div>
          <div className="truncate text-2xs text-ink-300">
            {nameOf(focus.driverId)}
            {focusIsPlayer ? ' · você' : focusIsMine ? ' · sua equipe' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => stepFocus(1)}
          disabled={focusIndex >= rows.length - 1}
          aria-label="Piloto de trás"
          className="grid h-11 w-11 shrink-0 place-items-center bg-ink-800 text-ink-100 shadow-ring hover:bg-ink-700"
        >
          <ChevronDown size={18} aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <PortraitOr
          src={portraitUrl(focus.driverId, focus.driverId === player.id)}
          name={nameOf(focus.driverId)}
          color={teams[focus.teamId]?.color}
          size="sm"
          fallback={null}
        />
        <CarSprite
          categoryId={category.id}
          teamId={focus.teamId}
          color={teams[focus.teamId]?.color ?? '#9aa3b2'}
          driverId={focus.driverId}
          number={focus.number}
          className="w-14 shrink-0"
        />
        <span className="min-w-0 truncate text-2xs text-ink-300">{teams[focus.teamId]?.name}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {fact('Velocidade', `${Math.round(focus.speed)} km/h`)}
        {fact('Volta', `${Math.min(raceLaps, started ? focus.sample.lap : 0)}/${raceLaps}`)}
        {fact(rules.pitStops ? 'Paradas' : 'Largou em', rules.pitStops ? focus.pitStops : `${focus.grid}º`)}
        {fact('À frente', intervalAhead !== null ? formatInterval(intervalAhead) : '–')}
        {fact('Atrás', intervalBehind !== null ? formatInterval(intervalBehind) : '–')}
        {fact('Última volta', formatLap(focus.lastLap))}
      </dl>
      <div className="mt-2 text-2xs text-ink-300">
        Melhor volta: <b className="font-semibold text-ink-100">{formatLap(focus.bestLap)}</b>
      </div>
      {/* Pneus: o painel completo para o carro do jogador; para os outros, só o desgaste. */}
      <div className="mt-2 border-t border-ink-700 pt-2">
        {focusIsPlayer && myTyre ? <PlayerTyrePanel tyre={myTyre} /> : <TyreGauge compound={focus.compound} wear={focus.wear} badge={rules.pitStops} />}
      </div>
      {(focus.damage >= 0.05 || focus.penaltySeconds > 0 || (rules.fuel && focusIsPlayer && focus.sample.record)) && (
        <p className="mt-2 text-xs text-gold-400">
          {rules.fuel && focusIsPlayer && focus.sample.record && (
            <span className="text-ink-200">
              Combustível: {focus.sample.record.fuel.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} voltas no tanque,{' '}
              {Math.max(0, raceLaps - focus.sample.record.lap)} por correr.{' '}
            </span>
          )}
          {focus.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, focus.damage) * 100)}%. `}
          {focus.penaltySeconds > 0 && `Punições: ${focus.penaltySeconds}s somados ao tempo final.`}
        </p>
      )}
      {!spectator && (
        <p className="mt-2 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-300">
          <b className="font-semibold text-ink-100">{RACE_MODE_LABELS[raceMode]}.</b> {RACE_MODE_DESCRIPTIONS[raceMode]}
          {rules.fuel ? ' O ritmo também muda o consumo de combustível.' : ''}
        </p>
      )}
      {!spectator && mineIds.has(player.id) && (
        <p className="mt-2 border-t border-ink-700 pt-2 text-xs leading-snug text-ink-300">
          <b className="font-semibold text-ink-100">Estilo do piloto: {DRIVING_STYLE_LABELS[style]}.</b> {DRIVING_STYLE_DESCRIPTIONS[style]} É ele quem decide
          os lances que você deixar com o piloto e todos os de "Simular até o fim". O ritmo escolhido puxa o estilo para um lado ou para o outro.
        </p>
      )}
    </div>
  );

  const eventsPanel = (
    <ul>
      {events.length === 0 && (
        <li className="p-2 text-sm text-ink-300">
          Os carros estão alinhados no grid.{' '}
          {rules.pitStops ? `Compostos: ${[...rules.dryCompounds, ...rules.wetCompounds].map((c) => tyreName(c)).join(', ')}.` : ''}
        </li>
      )}
      {[...events]
        .reverse()
        .slice(0, 60)
        .map((e) => (
          <li
            key={e.index}
            className={cx(
              'flex gap-2 border-t border-ink-700/70 px-2 py-2 text-xs first:border-t-0',
              (isMine(e.driverId) || isMine(e.otherDriverId)) && 'bg-apex-500/15 shadow-[inset_3px_0_0_0_var(--color-apex-400)]',
            )}
          >
            <span className="w-7 shrink-0 text-ink-300">V{e.lap}</span>
            <span className={EVENT_TONE[e.type] ?? 'text-ink-200'}>{e.message}</span>
          </li>
        ))}
    </ul>
  );
  const panelContent = (which: Exclude<SidePanel, 'tower'>) =>
    which === 'driver' ? driverPanel : which === 'pits' ? <PitStrategyCard race={race} tyre={myTyre} bare /> : eventsPanel;

  const credit = trackId ? trackCredit(trackId) : null;
  const pickMine = () => {
    if (!best) return;
    setFocusId(
      focusIsMine && camera === 'follow' && mineIds.size > 1
        ? (rows.find((r) => mineIds.has(r.driverId) && r.driverId !== focus?.driverId)?.driverId ?? best.driverId)
        : best.driverId,
    );
    setCamera('follow');
  };
  /** Botão da coluna lateral da pista: ícone com o nome embaixo, 56×44, ao alcance do polegar direito. */
  const sideButton = (
    icon: LucideIcon,
    label: string,
    pressed: boolean,
    onClick: () => void,
    extra?: { disabled?: boolean; title?: string; name?: string },
  ) => {
    const Icon = icon;
    return (
      <button
        key={label}
        type="button"
        onClick={onClick}
        aria-pressed={pressed}
        aria-label={extra?.name}
        disabled={extra?.disabled}
        title={extra?.title}
        className={cx(
          'flex h-11 w-14 flex-col items-center justify-center gap-1 text-2xs font-semibold leading-none transition-colors',
          pressed ? 'bg-apex-500 text-white shadow-overlay' : 'overlay text-ink-100 hover:bg-ink-800',
        )}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden />
        {label}
      </button>
    );
  };
  const stillTitle = 'Com "menos movimento" ligado, a câmera fica parada no circuito inteiro';
  const cameraButtons = (
    <>
      {sideButton(Video, 'Geral', camera === 'overview', () => setCamera('overview'), { name: 'Câmera geral' })}
      {best &&
        sideButton(Crosshair, mineIds.has(player.id) ? 'Meu' : 'Equipe', camera === 'follow' && focusIsMine, pickMine, {
          name: ownLabel,
          title: mineIds.size > 1 ? 'Acompanha um carro da sua equipe; toque de novo para alternar' : undefined,
        })}
      {followLabel &&
        focus &&
        sideButton(Eye, codeOf(focus.driverId), camera === 'follow', () => setCamera('follow'), {
          name: followLabel,
          disabled: stillCamera,
          title: stillCamera ? stillTitle : undefined,
        })}
    </>
  );
  const panelButtons = (
    <>
      {sideButton(CircleUser, 'Piloto', drawer === 'driver', () => setDrawer(drawer === 'driver' ? null : 'driver'))}
      {rules.pitStops && !spectator && sideButton(Wrench, 'Boxes', drawer === 'pits', () => setDrawer(drawer === 'pits' ? null : 'pits'))}
      {sideButton(ScrollText, 'Eventos', drawer === 'events', () => setDrawer(drawer === 'events' ? null : 'events'))}
    </>
  );
  const drawerTitle = drawer === 'driver' ? 'Piloto em foco' : drawer === 'pits' ? 'Boxes e estratégia' : 'Eventos da corrida';

  // O piloto em foco, num cartão fino no pé da pista. Em pé, quando é o carro do jogador, os pneus
  // dele vêm junto (deitado, ficam na barra superior: ver `tyreAtSight`).
  const focusCard = focus && (
    <div className="overlay pointer-events-none flex min-w-0 max-w-full shrink-0 items-stretch text-ink-100">
      <div aria-hidden className="w-1.5 shrink-0" style={{ background: teams[focus.teamId]?.color }} />
      <div className="min-w-0 px-2 py-1">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold leading-none">{focus.state === 'retired' ? 'AB' : `P${focus.position}`}</span>
            <span className={cx('font-display text-lg font-bold leading-none tracking-wide', focusIsMine && 'text-apex-400')}>{codeOf(focus.driverId)}</span>
            <span className="text-2xs text-ink-200">#{focus.number}</span>
            {focusIsMine && <span className="text-2xs font-semibold text-ink-100">{mineIds.has(player.id) ? 'você' : 'sua equipe'}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-2xs text-ink-200">
            <span>
              <b className="font-display text-base text-ink-100">{Math.round(focus.speed)}</b> km/h
            </span>
            {intervalAhead !== null && (
              <span className="flex items-center">
                <ChevronUp size={12} aria-label="para o carro da frente" /> {formatInterval(intervalAhead)}
              </span>
            )}
            {intervalBehind !== null && (
              <span className="flex items-center">
                <ChevronDown size={12} aria-label="para o carro de trás" /> {formatInterval(intervalBehind)}
              </span>
            )}
          </div>
        </div>
        {!wide && focusIsPlayer && myTyre && <PlayerTyrePanel tyre={myTyre} compact className="mt-1 w-44 border-t border-ink-600 pt-1" />}
      </div>
    </div>
  );
  // Faixa passageira no pé da pista: o desfecho de um lance vem antes do rádio, e o rádio antes dos eventos.
  const outcome = momentDue ? null : banners.outcome;
  const radio = momentDue || outcome ? null : banners.radio;
  const banner = outcome ? (
    <LowerThird
      kicker={`Lance · ${MOMENT_KIND_LABELS[outcome.kind]}`}
      title={outcome.success ? 'Deu certo' : 'Deu errado'}
      detail={outcome.message}
      tone={outcome.success ? 'good' : 'attention'}
      icon={
        outcome.success ? (
          <CircleCheck size={20} aria-hidden className="shrink-0 text-go-400" />
        ) : (
          <TriangleAlert size={20} aria-hidden className="shrink-0 text-gold-400" />
        )
      }
      wrap
    />
  ) : radio ? (
    <LowerThird kicker="Rádio · engenheiro" title={radio.message} icon={<Headset size={18} aria-hidden className="shrink-0 text-ink-200" />} compact />
  ) : null;
  const tickerList = (
    <ul className="space-y-1">
      {ticker.map((e) => (
        <li
          key={e.index}
          className={cx(
            'overlay w-fit max-w-full px-2 py-1 text-xs',
            EVENT_TONE[e.type] ?? 'text-ink-100',
            (isMine(e.driverId) || isMine(e.otherDriverId)) && 'shadow-[inset_3px_0_0_0_var(--color-apex-400),var(--shadow-overlay)]',
          )}
        >
          {e.message}
        </li>
      ))}
    </ul>
  );
  const creditLine = credit && <span className="overlay w-fit px-1 text-2xs text-ink-200">Traçado: {credit}</span>;
  const canvas = (
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
      still={stillCamera}
      className={wide ? 'h-full w-full' : 'aspect-[4/5] w-full'}
    />
  );
  const changeMode = (mode: typeof raceMode) => {
    // Toque leve ao trocar o ritmo (só quando muda de fato).
    if (mode !== raceMode) feedback('paceChange');
    setRaceMode(mode);
  };

  return (
    <div className={wide ? '' : 'space-y-4'}>
      {topSlot ? createPortal(header, topSlot) : <div className="chamfer flex min-h-12 items-center bg-ink-900 px-2 shadow-frame">{header}</div>}

      {wide ? (
        // Em tela larga tudo cabe sem rolar: a torre fixa à esquerda, a pista dominando e a barra de comandos embaixo.
        <div
          ref={stage}
          className={cx('grid grid-cols-[15rem_minmax(0,1fr)] gap-2 xl:grid-cols-[19rem_minmax(0,1fr)]', stageHeight === null && 'min-h-[13.5rem]')}
          style={{
            height:
              stageHeight !== null
                ? `${stageHeight}px`
                : `calc(100dvh - ${showBar ? '8.75rem' : '5.5rem'} - env(safe-area-inset-top) - max(var(--action-bar-h, 0px), env(safe-area-inset-bottom)))`,
          }}
        >
          <aside aria-label="Classificação da corrida" className="flex min-h-0 flex-col bg-ink-900 shadow-frame">
            {gapToggle}
            {tower}
          </aside>

          {/* Na transmissão, placares e nomes ficam sobre a pista de propósito (o teste visual pula esta área):
              camadas finas, translúcidas e com sombra; a pista domina. */}
          <div data-overlay-ok className="relative min-h-0 min-w-0 overflow-hidden shadow-frame">
            {canvas}
            {/* Avisos que pedem atenção: no alto, à esquerda. */}
            <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-13rem)] flex-col gap-1 *:pointer-events-auto">{notices}</div>
            {/* Coluna da direita, ao alcance do polegar: câmera em cima, painéis embaixo. */}
            <div className="absolute bottom-2 right-2 top-2 flex flex-col items-end justify-between gap-2">
              <div role="group" aria-label="Câmera" className="flex gap-2">
                {cameraButtons}
              </div>
              {/* Com o lance aberto, a tarja cobre o pé da pista: os botões dos painéis saem de baixo dela. */}
              {!momentDue && (
                <div role="group" aria-label="Painéis da corrida" className="flex flex-col gap-2">
                  {panelButtons}
                </div>
              )}
            </div>
            {drawer && !momentDue && (
              <section
                aria-label={drawerTitle}
                className="overlay enter absolute bottom-2 right-[4.5rem] top-[3.75rem] flex w-[min(18rem,calc(100%-5.5rem))] flex-col text-ink-100"
              >
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-600 pl-2">
                  <h2 className="font-display text-base font-semibold uppercase leading-none tracking-wide">{drawerTitle}</h2>
                  <button
                    type="button"
                    onClick={() => setDrawer(null)}
                    aria-label="Fechar painel"
                    className="grid h-11 w-11 shrink-0 place-items-center text-ink-100 hover:bg-ink-800"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{panelContent(drawer)}</div>
              </section>
            )}
            {/* Pé da pista: o lugar da tarja inferior (os lances decisivos da Fase 4 entram aqui, com
                `LowerThird`), os eventos recentes e o piloto em foco. */}
            <div className="pointer-events-none absolute bottom-2 left-2 right-[4.5rem] flex items-end justify-between gap-2">
              <div data-slot="tarja-inferior" aria-live="polite" className="flex min-w-0 flex-col items-start gap-1">
                {banner}
                {!drawer && !momentDue && !banner && tickerList}
                {!momentDue && creditLine}
              </div>
              {/* Enquanto a faixa do lance ou do rádio está na tela, ela fica com a largura: o cartão volta em seguida. */}
              {!drawer && !momentDue && !banner && focusCard}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div data-overlay-ok className="relative min-h-0 min-w-0 overflow-hidden shadow-frame">
            {canvas}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
              <div className="pointer-events-auto flex min-w-0 max-w-[62%] flex-col gap-1">{notices}</div>
              <div className="pointer-events-auto ml-auto flex shrink-0 flex-col items-end gap-2" role="group" aria-label="Câmera">
                {cameraButtons}
              </div>
            </div>
            {/* Em pé há altura de sobra: a tarja e os eventos ficam em cima, com a largura toda, e o cartão embaixo. */}
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col gap-1">
              <div data-slot="tarja-inferior" aria-live="polite" className="flex min-w-0 flex-col items-start gap-1">
                {banner}
                {!momentDue && !banner && tickerList}
              </div>
              {!momentDue && (
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">{creditLine}</div>
                  {focusCard}
                </div>
              )}
            </div>
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
                    panel === t.id ? 'text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-400)]' : 'text-ink-300 hover:text-ink-100',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {panel === 'tower' ? (
              // O espaço em cima separa o botão de troca das abas (8 px entre alvos de toque).
              <div className="flex h-[24rem] flex-col pt-2">
                {gapToggle}
                {tower}
              </div>
            ) : (
              <div className="max-h-[26rem] min-h-0 flex-1 overflow-y-auto overscroll-contain">{panelContent(panel)}</div>
            )}
          </aside>
        </div>
      )}

      {/* Lance decisivo: a tarja toma o lugar da barra de comandos até o jogador responder. */}
      {momentDue && <MomentBar race={race} tyre={myTyre} onAnswered={playback.start} onHeight={setMomentBarHeight} />}
      {showBar && !momentDue && myRow && (
        <RaceControlBar
          position={myRow.state === 'retired' ? 'AB' : `P${started ? myRow.position : myRow.grid}`}
          lap={`Volta ${Math.min(raceLaps, started ? myRow.sample.lap : 0)}/${raceLaps}`}
          mode={raceMode}
          onMode={changeMode}
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
      {!showBar && !momentDue && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant={playback.playing ? 'secondary' : 'primary'} onClick={playback.toggle} disabled={orderDue} className="min-w-28">
            {playback.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playLabel}
          </Button>
          <div className="flex bg-ink-900 shadow-ring" role="group" aria-label="Velocidade da corrida">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => playback.setSpeed(s)}
                aria-pressed={playback.speed === s}
                className={cx(
                  'min-h-11 min-w-11 px-1 text-sm font-semibold',
                  playback.speed === s ? 'bg-apex-500 text-white' : 'text-ink-200 hover:text-ink-100',
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
