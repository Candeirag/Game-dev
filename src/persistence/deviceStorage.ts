/**
 * Saves em arquivos do aparelho (aplicativo). Cada chave vira um arquivo JSON numa pasta própria
 * do aplicativo, que o sistema não apaga para liberar espaço e que entra no backup do aparelho.
 *
 * Gravar várias chaves é tudo ou nada, como numa transação do IndexedDB (o serviço de saves conta
 * com isso):
 *
 * 1. cada valor vai para um arquivo temporário;
 * 2. um arquivo de confirmação lista os temporários, e só a partir dele a gravação vale;
 * 3. os temporários tomam o lugar dos arquivos antigos e a confirmação é apagada.
 *
 * Se algo falha antes da confirmação (falta de espaço, aplicativo fechado), os temporários são
 * descartados e fica tudo como estava. Se falha depois, a troca é concluída na operação seguinte.
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
/** Lista dos arquivos de uma gravação confirmada e ainda não concluída. Não é uma chave. */
const COMMIT = 'gravacao-confirmada';

const fileOf = (key: string) => `${encodeURIComponent(key)}${EXTENSION}`;

export class DeviceFileStorage implements StorageAdapter {
  readonly kind = 'device' as const;
  /** Conclusão (ou descarte) de uma gravação interrompida; feita uma vez e refeita depois de uma falha. */
  private recovery: Promise<void> | null = null;

  constructor(private readonly files: DeviceFiles) {}

  private ready(): Promise<void> {
    this.recovery ??= this.recover().catch((error: unknown) => {
      this.recovery = null;
      throw error;
    });
    return this.recovery;
  }

  /** Conclui a gravação que chegou a ser confirmada e descarta temporários que sobraram. */
  private async recover(): Promise<void> {
    const names = await this.files.list();
    if (names.includes(COMMIT)) {
      let confirmed: string[] = [];
      try {
        const parsed: unknown = JSON.parse((await this.files.read(COMMIT)) ?? '[]');
        if (Array.isArray(parsed)) confirmed = parsed.filter((name): name is string => typeof name === 'string');
      } catch {
        // A confirmação ficou pela metade: a gravação não chegou a valer.
      }
      for (const name of confirmed) {
        if (names.includes(name + TEMPORARY)) await this.files.rename(name + TEMPORARY, name);
      }
      await this.files.remove(COMMIT);
    }
    for (const name of await this.files.list()) {
      if (name.endsWith(TEMPORARY)) await this.files.remove(name);
    }
  }

  async get(key: string): Promise<unknown> {
    await this.ready();
    const raw = await this.files.read(fileOf(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      // Arquivo ilegível vale como ausente: o serviço de saves recorre à cópia de segurança.
      return undefined;
    }
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    // Serializa tudo antes de gravar: um valor que não vira JSON não deixa nada escrito.
    const serialized = Object.entries(entries).map(([key, value]) => [fileOf(key), JSON.stringify(value)] as const);
    if (serialized.length === 0) return;
    await this.ready();
    const names = serialized.map(([name]) => name);
    try {
      for (const [name, data] of serialized) await this.files.write(name + TEMPORARY, data);
      await this.files.write(COMMIT, JSON.stringify(names));
    } catch (error) {
      // Não coube ou não gravou: nada muda. Os temporários saem agora (ou na próxima abertura).
      await this.discard([...names.map((name) => name + TEMPORARY), COMMIT]);
      throw error;
    }
    try {
      for (const name of names) await this.files.rename(name + TEMPORARY, name);
      await this.files.remove(COMMIT);
    } catch (error) {
      // A gravação já vale: a próxima operação termina a troca dos arquivos.
      this.recovery = null;
      throw error;
    }
  }

  private async discard(names: string[]): Promise<void> {
    for (const name of names) {
      try {
        await this.files.remove(name);
      } catch {
        // Fica para a limpeza da próxima abertura.
      }
    }
  }

  async delete(keys: string[]): Promise<void> {
    await this.ready();
    for (const key of keys) await this.files.remove(fileOf(key));
  }

  async keys(): Promise<string[]> {
    await this.ready();
    return (await this.files.list()).filter((name) => name.endsWith(EXTENSION)).map((name) => decodeURIComponent(name.slice(0, -EXTENSION.length)));
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
