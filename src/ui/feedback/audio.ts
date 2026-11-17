/**
 * Saída de som: um canal de efeitos e um de música, cada um com o seu volume (Ajustes). Os
 * efeitos são sintetizados a partir das partituras de `sounds.ts`.
 *
 * O canal de música já existe e obedece ao volume, mas ainda não há trilha: quando houver, ela
 * se liga a `musicBus()`.
 *
 * O navegador e o aplicativo só liberam som depois de um toque do jogador; até lá, tocar um som
 * não faz nada (e não dá erro).
 */
import { getSettings, subscribeSettings } from '../settings/settings';
import { SOUNDS, volumeToGain, type SoundId } from './sounds';

interface Bus {
  context: AudioContext;
  effects: GainNode;
  music: GainNode;
}

let bus: Bus | null = null;

function ensureBus(): Bus | null {
  if (bus) return bus;
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  try {
    const context = new AudioContext();
    const effects = context.createGain();
    const music = context.createGain();
    effects.connect(context.destination);
    music.connect(context.destination);
    bus = { context, effects, music };
    syncVolumes();
    subscribeSettings(syncVolumes);
    return bus;
  } catch {
    return null;
  }
}

function syncVolumes(): void {
  if (!bus) return;
  const settings = getSettings();
  bus.effects.gain.value = volumeToGain(settings.effectsVolume);
  bus.music.gain.value = volumeToGain(settings.musicVolume);
}

/** O nó onde a trilha sonora se ligará (ainda não há música no jogo). */
export function musicBus(): GainNode | null {
  return ensureBus()?.music ?? null;
}

/** Toca um efeito. Com o volume de efeitos em zero, nem cria as notas. */
export function playSound(id: SoundId): void {
  if (getSettings().effectsVolume <= 0) return;
  const out = ensureBus();
  if (!out) return;
  const { context, effects } = out;
  // O contexto nasce suspenso até o primeiro toque do jogador; retomar depois de um toque é permitido.
  if (context.state === 'suspended') void context.resume().catch(() => {});
  const start = context.currentTime + 0.01;
  for (const n of SOUNDS[id]) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = n.wave;
    oscillator.frequency.value = n.frequency;
    // Ataque curto e queda suave: sem estalo no começo nem no fim da nota.
    envelope.gain.setValueAtTime(0, start + n.at);
    envelope.gain.linearRampToValueAtTime(n.gain, start + n.at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.duration);
    oscillator.connect(envelope);
    envelope.connect(effects);
    oscillator.start(start + n.at);
    oscillator.stop(start + n.at + n.duration + 0.02);
  }
}
