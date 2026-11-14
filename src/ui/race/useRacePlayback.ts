/**
 * Relógio da transmissão: faz o tempo de corrida avançar e pede ao motor a
 * próxima volta quando o líder termina a que já foi simulada.
 *
 * Aqui não há regra de corrida. O gancho só decide QUANDO chamar o motor
 * (pela loja) e em que ritmo mostrar o que ele já calculou. As decisões do
 * jogador (ritmo, parada, ordem de equipe) continuam valendo para a próxima
 * volta que o motor simular, como no modo de cronometragem.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { lapInfoAt, type RaceTimeline } from '@/engine';
import { useGameStore } from '@/store/gameStore';

/** Em 1×, uma volta de referência dura estes segundos na tela. */
export const LAP_SECONDS = 24;
export const SPEEDS = [1, 2, 4, 8] as const;
/** Tempo de corrida que a imagem continua rodando depois que o último carro termina (fração da volta). */
const TAIL = 0.05;
/** Duração de cada luz de largada e da espera antes de apagarem, em segundos reais (em 1×). */
const LIGHT_STEP = 0.55;
const LIGHT_HOLD = 0.75;

export type PlaybackPhase = 'grid' | 'lights' | 'racing' | 'paused' | 'order' | 'suspended' | 'finished';

export interface RacePlayback {
  /** Tempo de corrida, atualizado a cada quadro (o canvas lê daqui). */
  timeRef: MutableRefObject<number>;
  /** Cópia do tempo para o HUD, atualizada algumas vezes por segundo. */
  time: number;
  playing: boolean;
  speed: number;
  phase: PlaybackPhase;
  /** Luzes de largada acesas (0 a 5), ou null. */
  lights: number | null;
  /** A imagem está atrás do ponto mais recente já simulado (revendo a corrida). */
  behindLive: boolean;
  toggle(): void;
  setSpeed(speed: number): void;
  /** Volta a mostrar a corrida desde a largada, sem simular nada de novo. */
  restart(): void;
  goLive(): void;
  /** Avança até o fim da volta do líder. */
  skipLap(): void;
  /** Simula o que falta (engenheiro automático) e vai para o fim. */
  finish(): void;
}

function endOfBroadcast(timeline: RaceTimeline): number {
  return (timeline.endTime ?? timeline.horizon) + timeline.referenceLap * TAIL;
}

/** Bandeira vermelha ainda sem relargada simulada: a corrida para neste instante. */
function openSuspension(timeline: RaceTimeline) {
  if (timeline.finished) return null;
  const last = timeline.suspensions.at(-1);
  return last && !last.final && last.lap === timeline.lapsBuilt ? last : null;
}

export function useRacePlayback(): RacePlayback {
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const lightsRef = useRef<{ elapsed: number } | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlayingState] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [lights, setLights] = useState<number | null>(null);
  const [waitingOrder, setWaitingOrder] = useState(false);
  const timeline = useGameStore((s) => s.raceTimeline);

  const setPlaying = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlayingState(value);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    let shownLights: number | null = null;
    const showLights = (value: number | null) => {
      if (value !== shownLights) {
        shownLights = value;
        setLights(value);
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const store = useGameStore.getState();
      let tl = store.raceTimeline;
      if (!tl || !playingRef.current) return;

      // Procedimento de largada: cinco luzes acendem, apagam, e só então o tempo corre.
      if (lightsRef.current) {
        lightsRef.current.elapsed += dt * Math.sqrt(speedRef.current);
        const lit = Math.min(5, Math.floor(lightsRef.current.elapsed / LIGHT_STEP) + 1);
        if (lightsRef.current.elapsed >= 5 * LIGHT_STEP + LIGHT_HOLD) {
          lightsRef.current = null;
          showLights(null);
        } else {
          showLights(lit);
          return;
        }
      }

      let target = timeRef.current + dt * (tl.referenceLap / LAP_SECONDS) * speedRef.current;
      let waiting = false;

      // Bandeira vermelha: a imagem para no instante da bandeira e espera o jogador relargar.
      const suspension = openSuspension(tl);
      if (suspension && target >= suspension.time && timeRef.current < suspension.time) {
        timeRef.current = suspension.time;
        setTime(suspension.time);
        setPlaying(false);
        return;
      }

      while (target > tl.horizon && !tl.finished) {
        const race = useGameStore.getState().liveRace;
        if (!race || race.pendingTeamOrder) {
          // O motor só simula a próxima volta depois da resposta à ordem de equipe.
          target = tl.horizon;
          waiting = race?.pendingTeamOrder != null;
          break;
        }
        useGameStore.getState().stepRace();
        const next = useGameStore.getState().raceTimeline;
        if (!next || next.lapsBuilt === tl.lapsBuilt) {
          target = tl.horizon;
          break;
        }
        tl = next;
        const built = tl.laps.at(-1);
        if (built?.standing) {
          // Largada parada: os carros já estão no grid; o tempo começa quando as luzes apagarem.
          target = built.start;
          lightsRef.current = { elapsed: 0 };
          showLights(1);
          break;
        }
      }
      setWaitingOrder(waiting);

      if (tl.finished && target >= endOfBroadcast(tl)) {
        target = endOfBroadcast(tl);
        setPlaying(false);
      }
      timeRef.current = target;
      if (now - lastHud > 180 || !playingRef.current) {
        lastHud = now;
        setTime(target);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [setPlaying]);

  const jump = useCallback((value: number) => {
    timeRef.current = value;
    setTime(value);
  }, []);

  const toggle = useCallback(() => {
    const tl = useGameStore.getState().raceTimeline;
    if (!tl) return;
    // Depois do fim, "play" revê a corrida desde a largada.
    if (!playingRef.current && tl.finished && timeRef.current >= endOfBroadcast(tl) - 1e-6) jump(0);
    setPlaying(!playingRef.current);
  }, [jump, setPlaying]);

  const setSpeed = useCallback((value: number) => {
    speedRef.current = value;
    setSpeedState(value);
  }, []);

  const restart = useCallback(() => {
    lightsRef.current = null;
    setLights(null);
    jump(0);
    setPlaying(true);
  }, [jump, setPlaying]);

  const goLive = useCallback(() => {
    const tl = useGameStore.getState().raceTimeline;
    if (tl) jump(tl.finished ? endOfBroadcast(tl) : tl.horizon);
  }, [jump]);

  const skipLap = useCallback(() => {
    const store = useGameStore.getState();
    let tl = store.raceTimeline;
    if (!tl) return;
    lightsRef.current = null;
    setLights(null);
    const now = timeRef.current;
    if (now >= tl.horizon - 1e-6 && !tl.finished) {
      if (store.liveRace?.pendingTeamOrder) return;
      store.stepRace();
      tl = useGameStore.getState().raceTimeline ?? tl;
    }
    const info = tl.laps.find((l) => l.end > now + 1e-6) ?? lapInfoAt(tl, now);
    const target = tl.finished && (!info || info.end <= now + 1e-6) ? endOfBroadcast(tl) : Math.min(info?.end ?? tl.horizon, tl.horizon);
    jump(target);
  }, [jump]);

  const finish = useCallback(() => {
    useGameStore.getState().simulateRestOfRace();
    const tl = useGameStore.getState().raceTimeline;
    lightsRef.current = null;
    setLights(null);
    setPlaying(false);
    if (tl) jump(endOfBroadcast(tl));
  }, [jump, setPlaying]);

  const suspension = timeline ? openSuspension(timeline) : null;
  const ended = timeline ? timeline.finished && time >= endOfBroadcast(timeline) - 1e-6 : false;
  const phase: PlaybackPhase = !timeline
    ? 'grid'
    : ended
      ? 'finished'
      : lights !== null
        ? 'lights'
        : suspension && time >= suspension.time - 1e-6
          ? 'suspended'
          : waitingOrder && playing
            ? 'order'
            : playing
              ? 'racing'
              : timeline.lapsBuilt === 0
                ? 'grid'
                : 'paused';

  return {
    timeRef,
    time,
    playing,
    speed,
    phase,
    lights,
    behindLive: timeline ? time < (timeline.finished ? endOfBroadcast(timeline) : timeline.horizon) - timeline.referenceLap * 1.5 : false,
    toggle,
    setSpeed,
    restart,
    goLive,
    skipLap,
    finish,
  };
}
