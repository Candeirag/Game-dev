/**
 * Vibração leve ao toque. Só existe no aplicativo; no navegador as funções não fazem nada, sem
 * erro. O jogador pode desligar (a escolha fica nas anotações do aparelho).
 */
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { readPreference, writePreference } from '@/persistence/preferences';
import { isNativeApp } from './native';

const KEY = 'haptics';

export type TapStrength = 'light' | 'medium';

/** Verdadeiro onde o aparelho pode vibrar (dentro do aplicativo). */
export function hapticsAvailable(): boolean {
  return isNativeApp();
}

export function hapticsEnabled(): boolean {
  return readPreference(KEY) !== 'off';
}

export function setHapticsEnabled(enabled: boolean): void {
  writePreference(KEY, enabled ? null : 'off');
}

/** Um toque curto. Nunca lança erro: sem vibração disponível, simplesmente não acontece nada. */
export function tap(strength: TapStrength = 'light'): void {
  if (!hapticsAvailable() || !hapticsEnabled()) return;
  void Haptics.impact({ style: strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
}

const INTERACTIVE = 'button, a[href], [role="tab"], select, summary, input[type="checkbox"], input[type="radio"], input[type="range"]';

/**
 * Liga a vibração aos toques da interface: todo botão, link, aba ou caixa de seleção dá um toque
 * leve; o botão que faz a carreira avançar (`data-haptic="medium"`) dá um toque um pouco mais forte.
 * Devolve a função que desliga.
 */
export function installTapFeedback(target?: Document): () => void {
  if (!hapticsAvailable()) return () => {};
  const root = target ?? document;
  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
    tap(target.getAttribute('data-haptic') === 'medium' ? 'medium' : 'light');
  };
  root.addEventListener('click', onClick, { capture: true, passive: true });
  return () => root.removeEventListener('click', onClick, { capture: true });
}
