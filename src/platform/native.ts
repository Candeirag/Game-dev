/**
 * O jogo roda em dois lugares: no navegador e dentro do aplicativo (Capacitor, Android e iOS).
 * Só este diretório conhece o Capacitor; o resto do jogo pergunta aqui se está no aplicativo.
 */
import { Capacitor } from '@capacitor/core';

/** Verdadeiro dentro do aplicativo instalado; falso no navegador e nos testes. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
