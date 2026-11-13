/**
 * Migrações de save entre versões do schema da carreira.
 *
 * Quando CAREER_SCHEMA_VERSION subir, registre aqui uma função que converte
 * os dados da versão N para a N+1. Saves antigos passam por todas as
 * migrações em sequência antes de serem validados.
 */
import { CAREER_SCHEMA_VERSION } from '@/domain/schemas';

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Chave: versão de origem. Ainda não há migrações, porque a versão 1 é a primeira. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function migrateCareerData(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > CAREER_SCHEMA_VERSION) {
    throw new Error(`Save criado por uma versão mais nova do jogo (schema ${version}).`);
  }
  while (version < CAREER_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Não há migração do schema ${version} para ${version + 1}.`);
    data = { ...migrate(data), schemaVersion: version + 1 };
    version += 1;
  }
  return data;
}
