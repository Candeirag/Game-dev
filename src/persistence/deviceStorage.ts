/**
 * Saves em arquivos do aparelho (aplicativo). Cada chave vira um arquivo JSON numa pasta própria
 * do aplicativo, que o sistema não apaga para liberar espaço e que entra no backup do aparelho.
 *
 * A gravação é em duas etapas (arquivo temporário e troca de nome): se o aplicativo for fechado
 * no meio, fica o arquivo antigo ou o temporário inteiro, nunca um arquivo pela metade.
 */
import type { StorageAdapter } from './storage';

/** O mínimo que o armazenamento precisa do sistema de arquivos; os testes usam uma versão em memória. */
export interface DeviceFiles {
  /** Conteúdo do arquivo, ou null se ele não existe. */
  read(name: string): Promise<string | null>;
  write(name: string, data: string): Promise<void>;
  /** Troca o nome de um arquivo, substituindo o destino se ele existir. */
  rename(from: string, to: string): Promise<void>;
  /** Apaga o arquivo; não falha se ele não existe. */
  remove(name: string): Promise<void>;
  list(): Promise<string[]>;
}

const EXTENSION = '.json';
const TEMPORARY = '.tmp';

const fileOf = (key: string) => `${encodeURIComponent(key)}${EXTENSION}`;

export class DeviceFileStorage implements StorageAdapter {
  readonly kind = 'device' as const;

  constructor(private readonly files: DeviceFiles) {}

  async get(key: string): Promise<unknown> {
    const name = fileOf(key);
    // O temporário só sobra quando a troca de nome não chegou a acontecer: ele é a versão mais nova.
    for (const candidate of [name + TEMPORARY, name]) {
      const raw = await this.files.read(candidate);
      if (raw === null) continue;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        // Arquivo cortado: tenta o outro.
      }
    }
    return undefined;
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    // Serializa tudo antes de gravar: um valor que não vira JSON não deixa nada escrito.
    const serialized = Object.entries(entries).map(([key, value]) => [fileOf(key), JSON.stringify(value)] as const);
    for (const [name, data] of serialized) await this.files.write(name + TEMPORARY, data);
    for (const [name] of serialized) await this.files.rename(name + TEMPORARY, name);
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.files.remove(fileOf(key));
      await this.files.remove(fileOf(key) + TEMPORARY);
    }
  }

  async keys(): Promise<string[]> {
    const names = await this.files.list();
    const keys = new Set<string>();
    for (const name of names) {
      const base = name.endsWith(TEMPORARY) ? name.slice(0, -TEMPORARY.length) : name;
      if (base.endsWith(EXTENSION)) keys.add(decodeURIComponent(base.slice(0, -EXTENSION.length)));
    }
    return [...keys];
  }
}

export interface MigrationResult {
  /** Quantas chaves foram trazidas do armazenamento antigo. */
  moved: number;
}

/**
 * Traz os saves de um armazenamento antigo (IndexedDB ou localStorage do aplicativo) para o novo.
 *
 * Só copia o que o destino ainda não tem, confere a cópia lendo de volta e só então apaga a
 * origem. Se qualquer passo falhar, a origem fica intacta e a migração é tentada de novo na
 * próxima abertura.
 */
export async function migrateStorage(source: StorageAdapter, target: StorageAdapter): Promise<MigrationResult> {
  const sourceKeys = await source.keys();
  if (sourceKeys.length === 0) return { moved: 0 };
  const existing = new Set(await target.keys());
  const entries: Record<string, unknown> = {};
  for (const key of sourceKeys) {
    if (existing.has(key)) continue;
    const value = await source.get(key);
    if (value !== undefined) entries[key] = value;
  }
  const moved = Object.keys(entries);
  if (moved.length > 0) {
    await target.setMany(entries);
    for (const key of moved) {
      if (JSON.stringify(await target.get(key)) !== JSON.stringify(entries[key])) throw new Error(`A cópia do save "${key}" não conferiu.`);
    }
  }
  // O que o destino já tinha (de uma migração anterior, interrompida antes de apagar) também sai da origem.
  await source.delete(sourceKeys);
  return { moved: moved.length };
}
