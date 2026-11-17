import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, type Settings } from './settings';

/** Os ajustes do jogador, com redesenho quando mudam. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
