/** Anotações do jogo no armazenamento do aparelho, pelo Capacitor Preferences (ver `persistence/preferences.ts`). */
import { Preferences } from '@capacitor/preferences';
import type { PreferenceMirror } from '@/persistence/preferences';

export function capacitorPreferences(): PreferenceMirror {
  return {
    async all() {
      const { keys } = await Preferences.keys();
      const out: Record<string, string> = {};
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        if (value !== null) out[key] = value;
      }
      return out;
    },
    async set(key, value) {
      await Preferences.set({ key, value });
    },
    async remove(key) {
      await Preferences.remove({ key });
    },
  };
}
