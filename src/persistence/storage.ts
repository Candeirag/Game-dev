/**
 * Adaptadores de armazenamento chave-valor. O jogo usa IndexedDB quando
 * disponível, localStorage como alternativa e memória nos testes.
 */
export interface StorageAdapter {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  get(key: string): Promise<unknown>;
  /** Grava várias chaves de uma vez; no IndexedDB, em uma única transação (tudo ou nada). */
  setMany(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<void>;
  keys(): Promise<string[]>;
}

const DB_NAME = 'apex-motorsport-dynasty';
const STORE = 'saves';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erro no IndexedDB.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transação do IndexedDB falhou.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transação do IndexedDB abortada.'));
  });
}

export class IndexedDbStorage implements StorageAdapter {
  readonly kind = 'indexeddb' as const;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory = indexedDB,
    private readonly dbName: string = DB_NAME,
  ) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.factory.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o IndexedDB.'));
      });
    }
    return this.dbPromise;
  }

  async get(key: string): Promise<unknown> {
    const db = await this.db();
    return requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const [key, value] of Object.entries(entries)) store.put(value, key);
    await transactionDone(tx);
  }

  async delete(keys: string[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    for (const key of keys) tx.objectStore(STORE).delete(key);
    await transactionDone(tx);
  }

  async keys(): Promise<string[]> {
    const db = await this.db();
    const keys = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys());
    return keys.map(String);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'localstorage' as const;
  private readonly prefix = `${DB_NAME}:`;

  constructor(private readonly storage: Storage = localStorage) {}

  async get(key: string): Promise<unknown> {
    const raw = this.storage.getItem(this.prefix + key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    // Serializa tudo antes de gravar: se algo falhar, nada é escrito pela metade.
    const serialized = Object.entries(entries).map(([k, v]) => [this.prefix + k, JSON.stringify(v)] as const);
    for (const [k, v] of serialized) this.storage.setItem(k, v);
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) this.storage.removeItem(this.prefix + key);
  }

  async keys(): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(this.prefix)) out.push(key.slice(this.prefix.length));
    }
    return out;
  }
}

export class MemoryStorage implements StorageAdapter {
  readonly kind = 'memory' as const;
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<unknown> {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) this.data.set(k, JSON.stringify(v));
  }

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) this.data.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }

  /** Só para testes: grava um valor bruto, sem passar pelas regras do jogo. */
  rawSet(key: string, value: unknown): void {
    this.data.set(key, JSON.stringify(value));
  }
}

const PROBE_KEY = '__teste_de_gravacao';
/** Quanto esperar por um armazenamento que não responde (há navegadores em que o IndexedDB fica pendurado). */
const PROBE_TIMEOUT_MS = 2500;

/** Grava, lê e apaga um valor: só assim se sabe que o armazenamento funciona de verdade. */
async function works(storage: StorageAdapter): Promise<boolean> {
  const probe = (async () => {
    await storage.setMany({ [PROBE_KEY]: 1 });
    const read = await storage.get(PROBE_KEY);
    await storage.delete([PROBE_KEY]);
    return read === 1;
  })();
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), PROBE_TIMEOUT_MS));
  try {
    return await Promise.race([probe, timeout]);
  } catch {
    return false;
  }
}

/**
 * Escolhe o armazenamento testando cada um, do melhor para o pior. Navegação anônima, páginas
 * embutidas e bloqueio de dados podem derrubar o IndexedDB ou o localStorage mesmo quando eles
 * existem; nesse caso o jogo cai para a memória, e a interface avisa que nada fica guardado.
 */
export async function probeStorage(): Promise<StorageAdapter> {
  const candidates: (() => StorageAdapter)[] = [];
  if (typeof indexedDB !== 'undefined') candidates.push(() => new IndexedDbStorage());
  candidates.push(() => new LocalStorageAdapter());
  for (const make of candidates) {
    try {
      const storage = make();
      if (await works(storage)) return storage;
    } catch {
      // O próprio acesso ao armazenamento pode ser bloqueado; tenta o seguinte.
    }
  }
  return new MemoryStorage();
}

export function createDefaultStorage(): StorageAdapter {
  if (typeof indexedDB !== 'undefined') return new IndexedDbStorage();
  if (typeof localStorage !== 'undefined') return new LocalStorageAdapter();
  return new MemoryStorage();
}
