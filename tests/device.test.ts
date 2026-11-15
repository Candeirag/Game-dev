/**
 * Preparação para aplicativo: saves em arquivos do aparelho, migração do armazenamento antigo,
 * anotações com cópia no aparelho e vibração que não atrapalha fora do aplicativo.
 */
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeviceFileStorage, migrateStorage, type DeviceFiles } from '@/persistence/deviceStorage';
import { readPreference, resetPreferenceMirror, restorePreferences, writePreference, type PreferenceMirror } from '@/persistence/preferences';
import { loadCareer, listSaves, saveCareer } from '@/persistence/saveService';
import { IndexedDbStorage, MemoryStorage, probeStorage } from '@/persistence/storage';
import { deliverTextFile } from '@/platform/exportFile';
import { hapticsAvailable, installTapFeedback, tap } from '@/platform/haptics';
import { isNativeApp } from '@/platform/native';
import { newCareer } from './helpers';

/** Sistema de arquivos em memória, com falhas programáveis para simular o aplicativo fechado no meio de uma gravação. */
function fakeFiles() {
  const data = new Map<string, string>();
  let failRenames = false;
  const files: DeviceFiles = {
    async read(name) {
      return data.get(name) ?? null;
    },
    async write(name, text) {
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
  return { files, data, breakRenames: (value: boolean) => (failRenames = value) };
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

  it('não perde o save se o aplicativo fecha no meio da gravação', async () => {
    const { files, data, breakRenames } = fakeFiles();
    const storage = new DeviceFileStorage(files);
    await storage.setMany({ auto: { versao: 1 } });
    // A gravação seguinte escreve o temporário, mas a troca de nome não acontece.
    breakRenames(true);
    await expect(storage.setMany({ auto: { versao: 2 } })).rejects.toThrow();
    breakRenames(false);
    // O temporário ficou inteiro: é a versão mais nova e é ela que volta.
    expect(await storage.get('auto')).toEqual({ versao: 2 });
    expect(await storage.keys()).toEqual(['auto']);
    // Um temporário cortado é ignorado: vale o arquivo anterior.
    data.set('auto.json.tmp', '{"versao":');
    expect(await storage.get('auto')).toEqual({ versao: 1 });
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

  it('a vibração não faz nada e não lança erro', () => {
    expect(() => tap()).not.toThrow();
    expect(() => tap('medium')).not.toThrow();
    // Sem aplicativo, nenhum ouvinte é instalado (e nem é preciso haver documento).
    const uninstall = installTapFeedback();
    expect(() => uninstall()).not.toThrow();
  });

  it('exportar segue pelo caminho do navegador (download), não pelo compartilhamento do aparelho', async () => {
    // Em Node não há Blob URL nem documento: a tentativa de download falha, e é assim que se vê
    // que o caminho escolhido foi o do navegador.
    await expect(deliverTextFile('carreira.json', '{}')).rejects.toThrow();
  });
});
