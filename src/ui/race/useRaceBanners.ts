/**
 * Faixas passageiras da transmissão (Fase 4): o desfecho de um lance decisivo e o rádio do
 * engenheiro. Cada uma entra no instante em que o acontecimento aparece na imagem, com a corrida
 * andando, e fica alguns segundos de relógio (não de corrida: em 8× a volta passa num piscar).
 *
 * O desfecho de um lance também vibra, no mesmo instante: certo (`momentWon`) ou errado
 * (`momentLost`). Toque e abandono não vibram por aqui: os eventos deles já vibram em
 * `useRaceFeedback`, e a mesma coisa não vibra duas vezes. Cada lance vibra uma vez só: voltar no
 * tempo, rever a corrida ou pular para o fim não repete nada.
 */
import { useEffect, useRef, useState } from 'react';
import { latestMoment, latestRadio, type RaceTimeline, type TimedMoment, type TimedRadio } from '@/engine';
import { feedback } from '../feedback/feedback';
import { MOMENT_RESULT_SECONDS, RADIO_SECONDS } from './useRacePlayback';

/** Um acontecimento só conta como "acabou de aparecer" se a imagem está a menos disto dele (fração da volta). */
const NEAR_LAPS = 0.6;

/**
 * O item mais recente de uma lista em ordem de tempo, enquanto estiver "fresco": entrou na tela
 * com a corrida andando há menos de `seconds` segundos reais. `onNew` é chamado na entrada, com
 * `first` dizendo se é a primeira vez que este item aparece (e não uma reprise).
 */
function useFresh<T extends { time: number }>(
  list: readonly T[],
  latest: T | null,
  time: number,
  playing: boolean,
  nearSeconds: number,
  seconds: number,
  onNew?: (item: T, first: boolean) => void,
): T | null {
  const index = latest ? list.indexOf(latest) : -1;
  const [fresh, setFresh] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const highest = useRef(-1);
  const timer = useRef(0);
  const notify = useRef(onNew);
  notify.current = onNew;

  useEffect(() => {
    const previous = last.current;
    last.current = index;
    if (previous === null || index === previous) return;
    if (index < previous) {
      // Voltou no tempo: a faixa que estava na tela sai.
      window.clearTimeout(timer.current);
      setFresh(null);
      return;
    }
    const first = index > highest.current;
    highest.current = Math.max(highest.current, index);
    // Só o que acontece diante do jogador: corrida andando e a imagem logo depois do acontecimento.
    if (!latest || !playing || time - latest.time > nearSeconds) return;
    setFresh(index);
    notify.current?.(latest, first);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFresh(null), seconds * 1000);
  }, [index, latest, playing, time, nearSeconds, seconds]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return latest && fresh === index ? latest : null;
}

function momentFeedback(moment: TimedMoment, first: boolean): void {
  if (!first) return;
  if (moment.success) feedback('momentWon');
  else if (moment.outcome === 'lost' || moment.outcome === 'spin') feedback('momentLost');
}

export interface RaceBanners {
  /** Desfecho de lance a mostrar agora, ou null. */
  outcome: TimedMoment | null;
  /** Mensagem do engenheiro a mostrar agora, ou null. */
  radio: TimedRadio | null;
}

const NO_MOMENTS: readonly TimedMoment[] = [];
const NO_RADIO: readonly TimedRadio[] = [];

export function useRaceBanners({
  timeline,
  time,
  playing,
  enabled,
}: {
  timeline: RaceTimeline | null;
  time: number;
  /** A corrida está andando na tela (não pausada nem sendo revista aos saltos). */
  playing: boolean;
  /** Só para quem corre: o espectador não tem lances nem rádio. */
  enabled: boolean;
}): RaceBanners {
  const active = enabled ? timeline : null;
  const near = (active?.referenceLap ?? 0) * NEAR_LAPS;
  const outcome = useFresh(active?.moments ?? NO_MOMENTS, active ? latestMoment(active, time) : null, time, playing, near, MOMENT_RESULT_SECONDS, momentFeedback);
  const radio = useFresh(active?.radio ?? NO_RADIO, active ? latestRadio(active, time) : null, time, playing, near, RADIO_SECONDS);
  return { outcome, radio };
}
