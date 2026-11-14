/**
 * Serviço de saves. Cuida da integridade em quatro camadas:
 *
 * 1. Envelope com formato e versão: arquivos que não são saves do jogo são
 *    recusados.
 * 2. Migração: saves de versões antigas do schema são convertidos.
 * 3. Validação estrutural (Zod) e de integridade referencial (integrity.ts).
 * 4. Checksum do conteúdo: detecta corrupção ou edição manual.
 *
 * Toda gravação mantém a versão anterior do slot como backup, na mesma
 * transação. Se o arquivo principal falhar em qualquer verificação, o
 * carregamento recorre ao backup automaticamente.
 */
import { CAREER_SCHEMA_VERSION, CareerStateSchema, type CareerState } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { getPlayer, getPlayerTeam, driverStandings } from '@/engine';
import { checksumOf } from './checksum';
import { validateCareerIntegrity } from './integrity';
import { migrateCareerData } from './migrations';
import type { StorageAdapter } from './storage';

export const SAVE_FORMAT = 'apex-motorsport-dynasty-save';
export const SAVE_SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SaveSlotId = (typeof SAVE_SLOTS)[number];

export interface SaveSummary {
  playerName: string;
  teamName: string;
  /** Ausente em saves gravados antes da Fase 2. */
  categoryName?: string;
  season: number;
  year: number;
  roundsCompleted: number;
  totalRounds: number;
  championshipPosition: number | null;
  points: number;
}

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  schemaVersion: number;
  savedAt: string;
  checksum: string;
  summary: SaveSummary;
  career: CareerState;
}

export class SaveError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

const backupKey = (slot: SaveSlotId) => `${slot}.backup`;

export function summarize(career: CareerState): SaveSummary {
  const player = getPlayer(career);
  const standing = driverStandings(career).find((s) => s.driverId === player.id);
  return {
    playerName: `${player.firstName} ${player.lastName}`,
    teamName: getPlayerTeam(career).name,
    categoryName: getCategory(career.categoryId).shortName,
    season: career.season,
    year: career.year,
    roundsCompleted: career.rounds.length,
    totalRounds: career.calendar.length,
    championshipPosition: career.rounds.length ? (standing?.position ?? null) : null,
    points: standing?.points ?? 0,
  };
}

export function createEnvelope(career: CareerState, now: string): SaveEnvelope {
  const problems = validateCareerIntegrity(career);
  if (problems.length) throw new SaveError('A carreira está inconsistente e não foi salva.', problems);
  const stamped: CareerState = { ...career, updatedAt: now };
  return {
    format: SAVE_FORMAT,
    schemaVersion: CAREER_SCHEMA_VERSION,
    savedAt: now,
    checksum: checksumOf(stamped),
    summary: summarize(stamped),
    career: stamped,
  };
}

/** Valida um envelope bruto e devolve a carreira. Lança SaveError com o motivo se falhar. */
export function parseEnvelope(raw: unknown): CareerState {
  if (raw === null || typeof raw !== 'object') throw new SaveError('Arquivo de save vazio ou ilegível.');
  const envelope = raw as Partial<SaveEnvelope>;
  if (envelope.format !== SAVE_FORMAT) throw new SaveError('Este arquivo não é um save do Apex Motorsport Dynasty.');

  // O checksum é conferido sobre o conteúdo original, antes de qualquer migração.
  if (typeof envelope.checksum !== 'string' || checksumOf(envelope.career) !== envelope.checksum) {
    throw new SaveError('O save está corrompido ou foi modificado (checksum não confere).');
  }

  let migrated: unknown;
  try {
    migrated = migrateCareerData(envelope.career);
  } catch (error) {
    throw new SaveError(error instanceof Error ? error.message : 'Falha ao migrar o save.');
  }

  const parsed = CareerStateSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new SaveError(
      'O save tem uma estrutura inválida.',
      parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  const problems = validateCareerIntegrity(parsed.data);
  if (problems.length) throw new SaveError('O save tem dados inconsistentes.', problems);
  return parsed.data;
}

export async function saveCareer(storage: StorageAdapter, slot: SaveSlotId, career: CareerState, now: string): Promise<SaveEnvelope> {
  const envelope = createEnvelope(career, now);
  // Confere a ida e volta antes de gravar: nunca escreve um save que não conseguiria ler.
  parseEnvelope(JSON.parse(JSON.stringify(envelope)));
  const previous = await storage.get(slot);
  const entries: Record<string, unknown> = { [slot]: envelope };
  if (previous !== undefined) entries[backupKey(slot)] = previous;
  await storage.setMany(entries);
  return envelope;
}

export interface LoadResult {
  career: CareerState;
  recoveredFromBackup: boolean;
}

export async function loadCareer(storage: StorageAdapter, slot: SaveSlotId): Promise<LoadResult> {
  const primary = await storage.get(slot);
  if (primary === undefined) throw new SaveError('Este slot está vazio.');
  try {
    return { career: parseEnvelope(primary), recoveredFromBackup: false };
  } catch (primaryError) {
    const backup = await storage.get(backupKey(slot));
    if (backup !== undefined) {
      try {
        return { career: parseEnvelope(backup), recoveredFromBackup: true };
      } catch {
        // O backup também falhou; o erro relatado é o do arquivo principal.
      }
    }
    throw primaryError;
  }
}

export interface SlotInfo {
  slot: SaveSlotId;
  status: 'empty' | 'ok' | 'corrupted';
  savedAt?: string;
  summary?: SaveSummary;
  error?: string;
}

export async function listSaves(storage: StorageAdapter): Promise<SlotInfo[]> {
  return Promise.all(
    SAVE_SLOTS.map(async (slot): Promise<SlotInfo> => {
      const raw = await storage.get(slot);
      if (raw === undefined) return { slot, status: 'empty' };
      try {
        parseEnvelope(raw);
        const env = raw as SaveEnvelope;
        return { slot, status: 'ok', savedAt: env.savedAt, summary: env.summary };
      } catch (error) {
        return { slot, status: 'corrupted', error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
}

export async function deleteSave(storage: StorageAdapter, slot: SaveSlotId): Promise<void> {
  await storage.delete([slot, backupKey(slot)]);
}

/** Exporta a carreira como texto JSON, para baixar como arquivo. */
export function exportCareer(career: CareerState, now: string): string {
  return JSON.stringify(createEnvelope(career, now), null, 2);
}

export function importCareer(json: string): CareerState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveError('O arquivo não contém JSON válido.');
  }
  return parseEnvelope(raw);
}
