/**
 * Pequenas anotações fora dos saves: preferências de tela, a data da última exportação e a
 * corrida interrompida. Ficam no localStorage e nunca falham: sem armazenamento, a leitura
 * devolve null e a gravação é ignorada.
 *
 * No aplicativo, cada anotação é copiada também para o armazenamento do aparelho (Capacitor
 * Preferences), que o sistema não apaga; na abertura, `restorePreferences` traz de volta o que
 * o localStorage tiver perdido.
 */
const PREFIX = 'apex.';

/** Cópia durável das anotações, fora do localStorage. Só existe no aplicativo. */
export interface PreferenceMirror {
  all(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

let mirror: PreferenceMirror | null = null;
/** No aplicativo, o que foi lido do aparelho vale mesmo se o localStorage estiver bloqueado. */
const restored = new Map<string, string>();

export function readPreference(key: string): string | null {
  try {
    const value = localStorage.getItem(PREFIX + key);
    if (value !== null) return value;
  } catch {
    // Sem localStorage: vale o que veio do aparelho, se houver.
  }
  return restored.get(key) ?? null;
}

export function writePreference(key: string, value: string | null): void {
  if (value === null) restored.delete(key);
  else if (mirror) restored.set(key, value);
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Sem armazenamento disponível, a anotação vale só enquanto a página estiver aberta.
  }
  // A cópia no aparelho é feita em segundo plano; uma falha ali não pode atrapalhar o jogo.
  if (mirror) void (value === null ? mirror.remove(key) : mirror.set(key, value)).catch(() => {});
}

/**
 * Liga a cópia no aparelho e restaura as anotações guardadas nela. Chamado uma vez, na abertura
 * do aplicativo, antes de o jogo ler qualquer anotação. O que está no aparelho prevalece.
 */
export async function restorePreferences(target: PreferenceMirror): Promise<void> {
  mirror = target;
  let saved: Record<string, string> = {};
  try {
    saved = await target.all();
  } catch {
    // Sem leitura do aparelho, seguem valendo as anotações do localStorage.
  }
  for (const [key, value] of Object.entries(saved)) {
    restored.set(key, value);
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      // Fica só na memória (ver readPreference).
    }
  }
}

/** Só para testes: desliga a cópia no aparelho e esquece o que foi restaurado. */
export function resetPreferenceMirror(): void {
  mirror = null;
  restored.clear();
}

const LAST_EXPORT = 'lastExport';

/** Data (ISO) da última vez em que o jogador exportou a carreira, ou null. */
export function readLastExport(): string | null {
  const value = readPreference(LAST_EXPORT);
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function writeLastExport(at: string): void {
  writePreference(LAST_EXPORT, at);
}
