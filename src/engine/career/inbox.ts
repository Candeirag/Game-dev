import type { InboxMessage } from '@/domain/schemas';

/** Limite de mensagens guardadas: evita que o save cresça sem controle. */
export const INBOX_LIMIT = 60;

/** Adiciona mensagens no topo (mais recente primeiro), sem repetir ids. */
export function pushMessages(inbox: readonly InboxMessage[], messages: readonly InboxMessage[]): InboxMessage[] {
  const ids = new Set(messages.map((m) => m.id));
  return [...[...messages].reverse(), ...inbox.filter((m) => !ids.has(m.id))].slice(0, INBOX_LIMIT);
}
