/**
 * Vibração do aparelho: o único módulo que fala com o plugin (`@capacitor/haptics`). Nenhuma tela
 * o chama direto: as telas avisam o que aconteceu a `src/ui/feedback`, que decide o padrão.
 *
 * São quatro padrões, sempre iguais para o mesmo tipo de acontecimento:
 * - `success`: vitória, título, contrato assinado;
 * - `error`: toque, abandono, punição;
 * - `warning`: confirmar uma decisão arriscada;
 * - `selection`: toque leve ao trocar o ritmo ou escolher o pneu.
 *
 * A vibração só existe dentro do aplicativo; no navegador nada acontece. Ela nunca é o único
 * aviso: quem a dispara já mostrou o acontecimento na tela.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './native';

export const HAPTIC_PATTERNS = ['success', 'error', 'warning', 'selection'] as const;
export type HapticPattern = (typeof HAPTIC_PATTERNS)[number];

/** Verdadeiro onde o aparelho pode vibrar (dentro do aplicativo). */
export function hapticsAvailable(): boolean {
  return isNativeApp();
}

/** Dispara um padrão. Falha em silêncio: um aparelho sem motor de vibração não pode atrapalhar o jogo. */
export function vibrate(pattern: HapticPattern): void {
  if (!hapticsAvailable()) return;
  const run =
    pattern === 'success'
      ? Haptics.notification({ type: NotificationType.Success })
      : pattern === 'error'
        ? Haptics.notification({ type: NotificationType.Error })
        : pattern === 'warning'
          ? Haptics.notification({ type: NotificationType.Warning })
          : Haptics.impact({ style: ImpactStyle.Light });
  void run.catch(() => {});
}
