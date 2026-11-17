/**
 * Preparação do aplicativo antes de o jogo abrir: restaura as anotações guardadas no aparelho.
 * No navegador não faz nada.
 */
import { restorePreferences } from '@/persistence/preferences';
import { capacitorPreferences } from './devicePreferences';
import { isNativeApp } from './native';

export async function prepareApp(): Promise<void> {
  if (!isNativeApp()) return;
  document.documentElement.dataset.app = 'native';
  await restorePreferences(capacitorPreferences());
}
