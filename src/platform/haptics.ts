/**
 * Vibração do aparelho: o módulo único por onde ela passa (nenhuma tela chama o plugin direto).
 *
 * Por enquanto há só o interruptor, guardado nas anotações do aparelho. Os padrões de vibração
 * por evento (momentos importantes, sempre iguais para a mesma ação) entram na Fase 1, aqui.
 * A vibração só existe dentro do aplicativo; no navegador o interruptor nem aparece.
 */
import { readPreference, writePreference } from '@/persistence/preferences';
import { isNativeApp } from './native';

const KEY = 'haptics';

/** Verdadeiro onde o aparelho pode vibrar (dentro do aplicativo). */
export function hapticsAvailable(): boolean {
  return isNativeApp();
}

/** A escolha do jogador; ligada por padrão. */
export function hapticsEnabled(): boolean {
  return readPreference(KEY) !== 'off';
}

export function setHapticsEnabled(enabled: boolean): void {
  writePreference(KEY, enabled ? null : 'off');
}
