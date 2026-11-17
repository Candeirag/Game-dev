/**
 * Preparação para aplicativo: saves em arquivos do aparelho, migração do armazenamento antigo,
 * anotações com cópia no aparelho e o interruptor da vibração.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceFileStorage, migrateStorage, type DeviceFiles } from '@/persistence/deviceStorage';
import { readPreference, resetPreferenceMirror, restorePreferences, writePreference, type PreferenceMirror } from '@/persistence/preferences';
import { loadCareer, listSaves, saveCareer } from '@/persistence/saveService';
import { IndexedDbStorage, MemoryStorage, probeStorage } from '@/persistence/storage';
import { deliverTextFile } from '@/platform/exportFile';
import { hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/platform/haptics';
import { isNativeApp } from '@/platform/native';
import { newCareer } from './helpers';

/** Todos os arquivos de código do jogo. */
function sourceFiles(dir = join(__dirname, '..', 'src')): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Sistema de arquivos em memória, com falhas programáveis para simular falta de espaço e o aplicativo fechado no meio de uma gravação. */
function fakeFiles() {
  const data = new Map<string, string>();
  let failRenames = false;
  /** Espaço total do "aparelho", em caracteres (null = sem limite). */
  let capacity: number | null = null;
  const files: DeviceFiles = {
    async read(name) {
      return data.get(name) ?? null;
    },
    async write(name, text) {
      if (capacity !== null) {
        let used = text.length;
        for (const [other, content] of data) if (other !== name) used += content.length;
        if (used > capacity) throw new Error('sem espaço');
      }
      data.set(name, text);
    },
    async rename(from, to) {
      if (failRenames) throw new Error('aplicativo fechado');
      const text = data.get(from);
      if (text === undefined) throw new Error('arquivo não existe');
      data.set(to, text);
      data.delete(from);
    },
    async remove(name) {
      data.delete(name);
    },
    async list() {
      return [...data.keys()];
    },
  };
  return {
    files,
    data,
    breakRenames: (value: boolean) => {
      failRenames = value;
    },
    /** Limita o espaço a `factor` vezes o que está ocupado agora (null tira o limite). */
    limitSpace: (factor: number | null) => {
      const used = [...data.values()].reduce((sum, content) => sum + content.length, 0);
      capacity = factor === null ? null : Math.floor(used * factor);
    },
  };
}

const NOW = '2026-11-15T12:00:00.000Z';

describe('saves em arquivos do aparelho', () => {
  it('grava, lê, lista e apaga, um arquivo por chave', async () => {
    const { files, data } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    expect(storage.kind).toBe('device');
    await storage.setMany({ auto: { a: 1 }, 'slot1.backup': [1, 2, 3] });
    expect(await storage.get('auto')).toEqual({ a: 1 });
    expect(await storage.get('slot1.backup')).toEqual([1, 2, 3]);
    expect(await storage.get('slot2')).toBeUndefined();
    expect((await storage.keys()).sort()).toEqual(['auto', 'slot1.backup']);
    expect([...data.keys()].sort()).toEqual(['auto.json', 'slot1.backup.json']);
    await storage.delete(['auto']);
    expect(await storage.keys()).toEqual(['slot1.backup']);
  });

  it('é aceito pela escolha de armazenamento, antes dos do navegador', async () => {
    const storage = await probeStorage([() => new DeviceFileStorage(fakeFiles().files)]);
    expect(storage.kind).toBe('device');
  });

  it('guarda e reabre uma carreira inteira, com a cópia de segurança', async () => {
    const storage = new DeviceFileStorage(fakeFiles().files);
    const career = newCareer();
    await saveCareer(storage, 'auto', career, NOW);
    await saveCareer(storage, 'auto', { ...career, reputation: career.reputation + 1 }, NOW);
    const loaded = await loadCareer(storage, 'auto');
    expect(loaded.career.reputation).toBe(career.reputation + 1);
    expect(loaded.recoveredFromBackup).toBe(false);
    expect((await storage.keys()).sort()).toEqual(['auto', 'auto.backup']);
    expect((await listSaves(storage)).find((slot) => slot.slot === 'auto')?.status).toBe('ok');
  });

  it('sem espaço para tudo, nada é escrito: gravar várias chaves é tudo ou nada', async () => {
    const { files, data, limitSpace } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    await storage.setMany({ auto: { versao: 1 }, 'auto.backup': { versao: 0 } });
    // Cabe o temporário da primeira chave, não o da segunda.
    limitSpace(1.6);
    await expect(storage.setMany({ auto: { versao: 2 }, 'auto.backup': { versao: 1 } })).rejects.toThrow('sem espaço');
    limitSpace(null);
    expect(await storage.get('auto')).toEqual({ versao: 1 });
    expect(await storage.get('auto.backup')).toEqual({ versao: 0 });
    expect([...data.keys()].sort()).toEqual(['auto.backup.json', 'auto.json']);
  });

  it('com o armazenamento quase cheio, o save abre mão da cópia de segurança e o progresso é gravado', async () => {
    const { files, limitSpace } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    const career = newCareer();
    await saveCareer(storage, 'auto', career, NOW);
    // Cabem o save atual e um novo ao lado dele, mas não a cópia de segurança junto.
    limitSpace(2.5);
    await saveCareer(storage, 'auto', { ...career, reputation: career.reputation + 1 }, NOW);
    expect((await loadCareer(storage, 'auto')).career.reputation).toBe(career.reputation + 1);
    expect(await storage.keys()).toEqual(['auto']);
    // Sem espaço nem para o save novo, a gravação falha e o que estava no slot continua lá.
    limitSpace(1.2);
    await expect(saveCareer(storage, 'auto', { ...career, reputation: career.reputation + 2 }, NOW)).rejects.toThrow('sem espaço');
    limitSpace(null);
    expect((await loadCareer(storage, 'auto')).career.reputation).toBe(career.reputation + 1);
    expect(await storage.keys()).toEqual(['auto']);
  });

  it('aplicativo fechado depois da confirmação: a gravação é concluída na abertura seguinte', async () => {
    const { files, data, breakRenames } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    await storage.setMany({ auto: { versao: 1 }, 'auto.backup': { versao: 0 } });
    breakRenames(true);
    await expect(storage.setMany({ auto: { versao: 2 }, 'auto.backup': { versao: 1 } })).rejects.toThrow();
    breakRenames(false);
    // Outra abertura do aplicativo: as duas chaves aparecem com os valores novos, nunca uma de cada.
    const reopened = new DeviceFileStorage(files);
    expect(await reopened.get('auto')).toEqual({ versao: 2 });
    expect(await reopened.get('auto.backup')).toEqual({ versao: 1 });
    expect([...data.keys()].sort()).toEqual(['auto.backup.json', 'auto.json']);
    // Na mesma sessão a troca também termina na operação seguinte.
    expect(await storage.get('auto')).toEqual({ versao: 2 });
  });

  it('aplicativo fechado antes da confirmação: os temporários são descartados e vale o que estava', async () => {
    const { files, data } = fakeFiles();
    await new DeviceFileStorage(files).setMany({ auto: { versao: 1 } });
    // Sobrou um temporário inteiro e outro cortado, sem arquivo de confirmação.
    data.set('auto.json.tmp', '{"versao":2}');
    data.set('slot1.json.tmp', '{"versao":');
    const reopened = new DeviceFileStorage(files);
    expect(await reopened.get('auto')).toEqual({ versao: 1 });
    expect(await reopened.get('slot1')).toBeUndefined();
    expect(await reopened.keys()).toEqual(['auto']);
    expect([...data.keys()]).toEqual(['auto.json']);
  });

  it('um valor que não vira JSON não deixa nada escrito', async () => {
    const { files, data } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(storage.setMany({ auto: { ok: true }, slot1: circular })).rejects.toThrow();
    expect(data.size).toBe(0);
  });
});

describe('migração dos saves para o aparelho', () => {
  it('traz os saves do IndexedDB, confere e esvazia a origem', async () => {
    const old = new IndexedDbStorage(new IDBFactory(), 'migracao-1');
    const career = newCareer();
    await saveCareer(old, 'auto', career, NOW);
    await saveCareer(old, 'slot2', career, NOW);
    const target = new DeviceFileStorage(fakeFiles().files);
    const result = await migrateStorage(old, target);
    expect(result.moved).toBe(2);
    expect((await target.keys()).sort()).toEqual(['auto', 'slot2']);
    // A carreira que volta do aparelho é a mesma que voltaria do armazenamento antigo.
    const reference = new MemoryStorage();
    await saveCareer(reference, 'auto', career, NOW);
    expect((await loadCareer(target, 'auto')).career).toEqual((await loadCareer(reference, 'auto')).career);
    expect(await old.keys()).toEqual([]);
    // Rodar de novo não faz nada.
    expect((await migrateStorage(old, target)).moved).toBe(0);
  });

  it('não passa por cima do que o aparelho já tem', async () => {
    const old = new MemoryStorage();
    await old.setMany({ auto: { origem: 'antigo' }, slot1: { origem: 'antigo' } });
    const target = new DeviceFileStorage(fakeFiles().files);
    await target.setMany({ auto: { origem: 'aparelho' } });
    expect((await migrateStorage(old, target)).moved).toBe(1);
    expect(await target.get('auto')).toEqual({ origem: 'aparelho' });
    expect(await target.get('slot1')).toEqual({ origem: 'antigo' });
  });

  it('se a cópia falha, a origem fica intacta', async () => {
    const old = new MemoryStorage();
    await old.setMany({ auto: { origem: 'antigo' } });
    const { files, breakRenames } = fakeFiles();
    breakRenames(true);
    await expect(migrateStorage(old, new DeviceFileStorage(files))).rejects.toThrow();
    expect(await old.get('auto')).toEqual({ origem: 'antigo' });
  });
});

describe('anotações com cópia no aparelho', () => {
  function fakeMirror(initial: Record<string, string> = {}) {
    const saved = new Map(Object.entries(initial));
    const mirror: PreferenceMirror = {
      async all() {
        return Object.fromEntries(saved);
      },
      async set(key, value) {
        saved.set(key, value);
      },
      async remove(key) {
        saved.delete(key);
      },
    };
    return { mirror, saved };
  }

  beforeEach(() => resetPreferenceMirror());
  afterEach(() => resetPreferenceMirror());

  it('sem aplicativo e sem localStorage, ler devolve null e gravar não falha', () => {
    expect(readPreference('raceView')).toBeNull();
    expect(() => writePreference('raceView', 'timing')).not.toThrow();
  });

  it('restaura do aparelho o que o localStorage perdeu e copia cada gravação', async () => {
    const { mirror, saved } = fakeMirror({ raceView: 'timing', lastExport: NOW });
    await restorePreferences(mirror);
    expect(readPreference('raceView')).toBe('timing');
    expect(readPreference('lastExport')).toBe(NOW);
    writePreference('raceSpeed', '4');
    writePreference('raceView', null);
    await Promise.resolve();
    expect(saved.get('raceSpeed')).toBe('4');
    expect(saved.has('raceView')).toBe(false);
    expect(readPreference('raceSpeed')).toBe('4');
    expect(readPreference('raceView')).toBeNull();
  });

  it('uma falha na leitura do aparelho não impede o jogo de abrir', async () => {
    const broken: PreferenceMirror = {
      all: () => Promise.reject(new Error('sem acesso')),
      set: () => Promise.reject(new Error('sem acesso')),
      remove: () => Promise.reject(new Error('sem acesso')),
    };
    await expect(restorePreferences(broken)).resolves.toBeUndefined();
    expect(() => writePreference('raceSpeed', '2')).not.toThrow();
    expect(readPreference('raceSpeed')).toBe('2');
  });
});

describe('fora do aplicativo', () => {
  it('o jogo sabe que não está no aplicativo', () => {
    expect(isNativeApp()).toBe(false);
    expect(hapticsAvailable()).toBe(false);
  });

  it('o interruptor da vibração fica guardado nas anotações e começa ligado', async () => {
    resetPreferenceMirror();
    expect(hapticsEnabled()).toBe(true);
    const saved = new Map<string, string>();
    await restorePreferences({
      all: async () => ({}),
      set: async (key, value) => void saved.set(key, value),
      remove: async (key) => void saved.delete(key),
    });
    setHapticsEnabled(false);
    expect(hapticsEnabled()).toBe(false);
    await Promise.resolve();
    expect(saved.get('haptics')).toBe('off');
    setHapticsEnabled(true);
    expect(hapticsEnabled()).toBe(true);
    await Promise.resolve();
    expect(saved.has('haptics')).toBe(false);
    resetPreferenceMirror();
  });

  it('nenhuma tela chama a vibração: o plugin só pode aparecer no módulo único', () => {
    const outside = sourceFiles().filter((file) => !file.endsWith(join('platform', 'haptics.ts')) && /@capacitor\/haptics/.test(readFileSync(file, 'utf8')));
    expect(outside).toEqual([]);
  });

  it('exportar segue pelo caminho do navegador (download), não pelo compartilhamento do aparelho', async () => {
    // Em Node não há Blob URL nem documento: a tentativa de download falha, e é assim que se vê
    // que o caminho escolhido foi o do navegador.
    await expect(deliverTextFile('carreira.json', '{}')).rejects.toThrow();
  });
});
