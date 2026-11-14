import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CareerStateSchema } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
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
import { buildRaceContext, completeWeekend, computeCareerStats, createWeekendRace, driverStandings, getPlayer, isSeasonComplete, simulateRemainingRace, startNextSeason } from './engineApi';
import { NOW, newCareer, pickBestOffer, playRound, playSeason, resolvePending } from './helpers';

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

  it('preserva os sistemas da Fase 2 (contrato, finanças, eventos, fechamento de temporada)', async () => {
    const storage = new MemoryStorage();
    const season = playSeason(newCareer(64));
    await saveCareer(storage, 'slot1', season, NOW);
    const { career: loaded } = await loadCareer(storage, 'slot1');
    expect(loaded.offseason).toEqual(season.offseason);
    expect(loaded.contract).toEqual(season.contract);
    expect(loaded.finance).toEqual(season.finance);
    expect(loaded.eventLog).toEqual(season.eventLog);
    // A carreira carregada continua jogável.
    const next = startNextSeason(loaded, pickBestOffer(loaded));
    expect(validateCareerIntegrity(next)).toEqual([]);
  });
});

/**
 * Compatibilidade: saves reais gravados pelo código da Fase 1 (schema 1),
 * guardados em tests/fixtures/v1, precisam abrir e continuar jogáveis.
 */
describe('compatibilidade com saves da Fase 1', () => {
  const load = (name: string) => importCareer(readFileSync(`tests/fixtures/v1/${name}.json`, 'utf8'));
  const raw = (name: string) => JSON.parse(readFileSync(`tests/fixtures/v1/${name}.json`, 'utf8')) as { career: { schemaVersion: number; rounds: unknown[]; reputation: number; drivers: { id: string; attributes: unknown }[]; history: unknown[] } };

  it('os arquivos são mesmo da versão 1', () => {
    for (const name of ['mid-weekend', 'season-complete', 'second-season']) expect(raw(name).career.schemaVersion).toBe(1);
  });

  it('save no meio de um fim de semana: migra, valida e a corrida pode ser disputada', () => {
    const original = raw('mid-weekend').career;
    const c = load('mid-weekend');
    expect(c.schemaVersion).toBe(2);
    expect(CareerStateSchema.safeParse(c).success).toBe(true);
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(c.categoryId).toBe('kart-regional');
    expect(c.rounds).toHaveLength(original.rounds.length);
    expect(c.weekend).toMatchObject({ phase: 'race', playerParticipates: true });
    expect(c.weekend!.entrants).toHaveLength(20);
    // Os atributos e resultados do jogador não mudam na migração.
    expect(getPlayer(c).attributes).toEqual(original.drivers.find((d) => d.id === 'player')!.attributes);
    expect(computeCareerStats(c, 'player').starts).toBe(3);
    // Sistemas novos no estado inicial.
    expect(c.contract.teamId).toBe(getPlayer(c).teamId);
    expect(c.finance.cash).toBeGreaterThan(0);
    expect(c.drivers.filter((d) => d.role === 'reserve')).toHaveLength(10);
    // Continua do ponto em que parou: termina a etapa e o resto da temporada.
    const finished = playSeason(continueWeekend(c));
    expect(finished.rounds).toHaveLength(10);
    expect(validateCareerIntegrity(finished)).toEqual([]);
  });

  it('save com a temporada terminada: ganha o fechamento e as propostas', () => {
    const original = raw('season-complete').career;
    const c = load('season-complete');
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(isSeasonComplete(c)).toBe(true);
    expect(c.offseason).not.toBeNull();
    expect(c.offseason!.reputationBefore).toBe(original.reputation);
    expect(c.offseason!.playerPosition).toBe(driverStandings(c).find((s) => s.driverId === 'player')!.position);
    expect(c.license.history).toHaveLength(1);
    const next = startNextSeason(c, pickBestOffer(c));
    expect(next.season).toBe(2);
    expect(validateCareerIntegrity(playRound(next))).toEqual([]);
  });

  it('save na segunda temporada: o histórico arquivado é mantido e convertido', () => {
    const c = load('second-season');
    expect(validateCareerIntegrity(c)).toEqual([]);
    expect(c.season).toBe(2);
    expect(c.history).toHaveLength(1);
    expect(c.history[0]).toMatchObject({ categoryId: 'kart-regional', season: 1 });
    expect(c.history[0]!.rounds).toHaveLength(10);
    expect(c.history[0]!.playerTeamName.length).toBeGreaterThan(0);
    expect(c.license.history).toHaveLength(1);
    expect(computeCareerStats(c, 'player').starts).toBe(11);
    const finished = playSeason(c);
    expect(finished.offseason).not.toBeNull();
    expect(validateCareerIntegrity(finished)).toEqual([]);
  });

  it('um save migrado pode ser regravado e relido na versão nova', async () => {
    const storage = new MemoryStorage();
    const c = load('second-season');
    await saveCareer(storage, 'slot1', c, NOW);
    const { career: again } = await loadCareer(storage, 'slot1');
    expect(again).toEqual({ ...c, updatedAt: NOW });
  });
});

/** Termina a etapa de um save carregado com o fim de semana em andamento. */
function continueWeekend(c: Parameters<typeof playRound>[0]) {
  const race = simulateRemainingRace(createWeekendRace(c), buildRaceContext(c), { mode: 'balanced', auto: true });
  return resolvePending(completeWeekend(c, race));
}
