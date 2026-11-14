/**
 * Pequenas anotações do navegador, fora dos saves: preferências de tela, a
 * data da última exportação e a corrida interrompida. Usa o localStorage e
 * nunca falha: sem armazenamento, a leitura devolve null e a gravação é ignorada.
 */
const PREFIX = 'apex.';

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Sem armazenamento disponível, a anotação vale só enquanto a página estiver aberta.
  }
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
