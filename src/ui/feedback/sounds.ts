/**
 * Os sons do jogo, escritos como partituras curtas (não há arquivos de áudio: o aparelho os
 * sintetiza na hora, então funcionam sem rede e não pesam no aplicativo). Cada som é uma lista
 * de notas; `audio.ts` as toca. Sons só para momentos marcantes, sempre com menos de 1,5 s.
 */
export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface Note {
  /** Frequência, em Hz. */
  frequency: number;
  /** Quando a nota começa, em segundos a partir do início do som. */
  at: number;
  /** Duração, em segundos (com a queda de volume no fim). */
  duration: number;
  /** Volume de pico da nota, de 0 a 1. */
  gain: number;
  wave: Wave;
}

export const SOUND_IDS = ['chequered', 'podium', 'title', 'offer'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

const note = (frequency: number, at: number, duration: number, gain = 0.5, wave: Wave = 'triangle'): Note => ({ frequency, at, duration, gain, wave });

// Notas (Hz).
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;
const G4 = 392;

export const SOUNDS: Readonly<Record<SoundId, readonly Note[]>> = {
  /** Bandeirada: duas batidas rápidas e uma nota longa, como o agitar da bandeira. */
  chequered: [note(G5, 0, 0.09, 0.45, 'square'), note(G5, 0.12, 0.09, 0.45, 'square'), note(C6, 0.24, 0.45, 0.5)],
  /** Pódio: arpejo maior subindo. */
  podium: [note(C5, 0, 0.14), note(E5, 0.12, 0.14), note(G5, 0.24, 0.14), note(C6, 0.36, 0.5, 0.55)],
  /** Título: o arpejo do pódio com um acorde final mais cheio. */
  title: [note(C5, 0, 0.14), note(E5, 0.12, 0.14), note(G5, 0.24, 0.14), note(C6, 0.36, 0.7, 0.5), note(E6, 0.36, 0.7, 0.3), note(G4, 0.36, 0.7, 0.3, 'sine')],
  /** Proposta chegando: dois toques suaves, como uma notificação. */
  offer: [note(E5, 0, 0.16, 0.4, 'sine'), note(A5, 0.14, 0.3, 0.4, 'sine')],
};

/** Duração total de um som, em segundos. */
export function soundDuration(id: SoundId): number {
  return Math.max(...SOUNDS[id].map((n) => n.at + n.duration));
}

/** Volume do ajuste (0 a 100) como ganho de áudio: curva quadrática, que o ouvido percebe como linear. */
export function volumeToGain(volume: number): number {
  const v = Math.max(0, Math.min(100, volume)) / 100;
  return v * v;
}
