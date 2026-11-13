import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbStorage, MemoryStorage } from '@/persistence/storage';
import {
  SaveError,
  createEnvelope,
  deleteSave,
  exportCareer,
  importCareer,
  listSaves,
  loadCareer,
  parseEnvelope,
  saveCareer,
} from '@/persistence/saveService';
import { canonicalStringify, checksumOf } from '@/persistence/checksum';
import { migrateCareerData } from '@/persistence/migrations';
import { NOW, newCareer, playRound } from './helpers';

describe('checksum', () => {
  it('não depende da ordem das chaves', () => {
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(checksumOf({ b: 1, a: 2 })).toBe(checksumOf({ a: 2, b: 1 }));
    expect(checksumOf({ a: 1 })).not.toBe(checksumOf({ a: 2 }));
  });
});

describe('saves', () => {
  const career = playRound(playRound(newCareer(31)));

  it('salva e carrega preservando os dados exatamente', async () => {
    const storage = new MemoryStorage();
    await saveCareer(storage, 'slot1', career, NOW);
    const { career: loaded, recoveredFromBackup } = await loadCareer(storage, 'slot1');
    expect(recoveredFromBackup).toBe(false);
    expect(loaded).toEqual({ ...career, updatedAt: NOW });
    expect(loaded.rounds).toHaveLength(2);
  });

  it('funciona com IndexedDB', async () => {
    const storage = new IndexedDbStorage(indexedDB, 'teste-apex');
    await saveCareer(storage, 'auto', career, NOW);
    const { career: loaded } = await loadCareer(storage, 'auto');
    expect(loaded.rounds).toEqual(career.rounds);
    const slots = await listSaves(storage);
    expect(slots.find((s) => s.slot === 'auto')!.status).toBe('ok');
    expect(slots.find((s) => s.slot === 'slot1')!.status).toBe('empty');
    await deleteSave(storage, 'auto');
    expect((await listSaves(storage)).find((s) => s.slot === 'auto')!.status).toBe('empty');
  });

  it('detecta adulteração pelo checksum', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.reputation = 100;
    expect(() => parseEnvelope(envelope)).toThrow(/checksum/);
  });

  it('recusa dados estruturalmente inválidos mesmo com checksum coerente', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.drivers[0].attributes.pace = 140;
    envelope.checksum = checksumOf(envelope.career);
    expect(() => parseEnvelope(envelope)).toThrow(SaveError);
  });

  it('recusa dados inconsistentes (integridade referencial)', () => {
    const envelope = JSON.parse(JSON.stringify(createEnvelope(career, NOW)));
    envelope.career.rounds.pop();
    envelope.checksum = checksumOf(envelope.career);
    expect(() => parseEnvelope(envelope)).toThrow(/inconsistentes/);
  });

  it('recupera do backup quando o arquivo principal está corrompido', async () => {
    const storage = new MemoryStorage();
    await saveCareer(storage, 'slot2', newCareer(31), NOW);
    await saveCareer(storage, 'slot2', career, NOW);
    storage.rawSet('slot2', { format: 'apex-motorsport-dynasty-save', checksum: 'x', career: {} });
    const { career: loaded, recoveredFromBackup } = await loadCareer(storage, 'slot2');
    expect(recoveredFromBackup).toBe(true);
    expect(loaded.rounds).toHaveLength(0);
    expect((await listSaves(storage)).find((s) => s.slot === 'slot2')!.status).toBe('corrupted');
  });

  it('exporta e importa como JSON', () => {
    const json = exportCareer(career, NOW);
    expect(importCareer(json).rounds).toEqual(career.rounds);
    expect(() => importCareer('não é json')).toThrow(SaveError);
    expect(() => importCareer('{"format":"outro"}')).toThrow(/não é um save/);
  });

  it('recusa saves de versões futuras do schema', () => {
    expect(() => migrateCareerData({ schemaVersion: 99 })).toThrow(/mais nova/);
  });

  it('não salva uma carreira inconsistente', async () => {
    const broken = { ...career, nextRoundIndex: 5 };
    await expect(saveCareer(new MemoryStorage(), 'slot3', broken, NOW)).rejects.toThrow(SaveError);
  });
});
