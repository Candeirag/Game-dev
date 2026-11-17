/**
 * Vibração e som da corrida: o que acontece com o carro do jogador (toque, abandono, punição) e
 * a bandeirada. Só dispara para o que entra na tela com a corrida andando; voltar no tempo,
 * reabrir a tela ou pular para o fim não repete nada.
 */
import { useEffect, useRef } from 'react';
import { feedback, type FeedbackEvent } from '../feedback/feedback';

interface RaceEventLike {
  index: number;
  type: string;
  driverId?: string;
  otherDriverId?: string;
}

const EVENT_FEEDBACK: Readonly<Record<string, FeedbackEvent>> = {
  collision: 'contact',
  dnf: 'retirement',
  penalty: 'penalty',
};

export function useRaceFeedback({
  events,
  mineIds,
  playing,
  chequered,
}: {
  /** Os acontecimentos da corrida até o instante exibido. */
  events: readonly RaceEventLike[];
  mineIds: ReadonlySet<string>;
  /** A corrida está andando na tela (não pausada nem sendo revista aos saltos). */
  playing: boolean;
  /** A bandeirada já foi dada no instante exibido. */
  chequered: boolean;
}): void {
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const latest = events.at(-1)?.index ?? -1;
    const previous = seen.current;
    seen.current = latest;
    // Primeira leitura, salto para trás ou corrida parada: só anota onde está.
    if (previous === null || latest <= previous || !playing) return;
    for (const event of events) {
      if (event.index <= previous) continue;
      const kind = EVENT_FEEDBACK[event.type];
      const mine = (event.driverId !== undefined && mineIds.has(event.driverId)) || (event.otherDriverId !== undefined && mineIds.has(event.otherDriverId));
      if (kind && mine) feedback(kind);
    }
  }, [events, mineIds, playing]);

  const wasChequered = useRef(chequered);
  useEffect(() => {
    if (chequered && !wasChequered.current && playing) feedback('chequeredFlag');
    wasChequered.current = chequered;
  }, [chequered, playing]);
}
