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
 *
 * Um save de formato anterior nunca é perdido na conversão: na gravação que o
 * substituiria, o original vai intacto para uma chave própria
 * (`<slot>.original-v<formato>`), que nenhuma gravação nem a exclusão do slot
 * apagam. Ver `listOriginalCopies` e `exportOriginalCopy`.
 */
import { CAREER_SCHEMA_VERSION, CareerStateSchema, type CareerState } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { getPlayer, driverStandings, teamStandings } from '@/engine';
import { checksumOf } from './checksum';
import { validateCareerIntegrity } from './integrity';
import { NewerSchemaError, migrateCareerData } from './migrations';
import type { StorageAdapter } from './storage';
import { currencyForNationality, relabelMoney } from '@/domain/money';
import { fixStoredPlurals } from '@/domain/text';

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

/** Save íntegro, mas de uma versão mais nova do jogo: não pode ser aberto nem trocado pela cópia de segurança. */
export class NewerSaveError extends SaveError {
  constructor(message: string) {
    super(message);
    this.name = 'NewerSaveError';
  }
}

const backupKey = (slot: SaveSlotId) => `${slot}.backup`;
/** Onde fica a cópia intacta de um save de formato anterior depois que o slot é convertido. */
const originalKey = (slot: SaveSlotId, version: number) => `${slot}.original-v${version}`;
const ORIGINAL_KEY = /^(.+)\.original-v(\d+)$/;

/** Formato em que um save deste jogo foi gravado; null se o conteúdo não for um save do jogo. */
function storedVersion(raw: unknown): number | null {
  if (raw === null || typeof raw !== 'object') return null;
  const envelope = raw as { format?: unknown; schemaVersion?: unknown; career?: { schemaVersion?: unknown } };
  if (envelope.format !== SAVE_FORMAT) return null;
  const version = envelope.career?.schemaVersion ?? envelope.schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : null;
}

/** O que está gravado é um save deste jogo, de uma versão do formato mais nova que a deste build? */
function isNewerSave(raw: unknown): boolean {
  return (storedVersion(raw) ?? 0) > CAREER_SCHEMA_VERSION;
}

/** O que está gravado é um save deste jogo, de um formato anterior ao deste build? */
function isOlderSave(raw: unknown): boolean {
  return (storedVersion(raw) ?? CAREER_SCHEMA_VERSION) < CAREER_SCHEMA_VERSION;
}

export function summarize(career: CareerState): SaveSummary {
  const player = getPlayer(career);
  // Como piloto, vale a posição dele no campeonato; como dirigente, a da equipe que ele comanda.
  const driving = player.teamId !== null;
  const team = career.teams.find((t) => t.id === (driving ? player.teamId : career.management?.teamId));
  const standing = driving
    ? driverStandings(career).find((s) => s.driverId === player.id)
    : team
      ? teamStandings(career).find((s) => s.teamId === team.id)
      : undefined;
  return {
    playerName: `${player.firstName} ${player.lastName}`,
    teamName: team?.name ?? 'Sem equipe',
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
    if (error instanceof NewerSchemaError) throw new NewerSaveError(error.message);
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
  return relabelStoredMoney(parsed.data);
}

/**
 * Mensagens, notícias e eventos ficam gravados já por extenso. Saves de versões anteriores trazem
 * todos os valores com "€"; ao abrir, o símbolo desses textos passa a ser o da moeda da carreira
 * (a do país do piloto). Só o símbolo muda: os números e o resto do save ficam como estavam.
 * Na mesma passada, os plurais antigos do tipo "2 ponto(s)" são acertados.
 */
function relabelStoredMoney(career: CareerState): CareerState {
  const currency = currencyForNationality(getPlayer(career).nationality);
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return fixStoredPlurals(relabelMoney(value, currency));
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, walk(inner)]));
    return value;
  };
  return walk(career) as CareerState;
}

export async function saveCareer(storage: StorageAdapter, slot: SaveSlotId, career: CareerState, now: string): Promise<SaveEnvelope> {
  const envelope = createEnvelope(career, now);
  // Nunca grava um save que não conseguiria ler: além da integridade (createEnvelope), a carreira
  // passa pelo mesmo schema usado na leitura. A ida e volta completa por JSON (serializar, ler e
  // conferir o checksum de novo) dobrava o tempo de cada gravação automática em saves longos e
  // não detectava nada além disso.
  const parsed = CareerStateSchema.safeParse(envelope.career);
  if (!parsed.success) {
    throw new SaveError(
      'A carreira tem uma estrutura inválida e não foi salva.',
      parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  const previous = await storage.get(slot);
  // Um save de versão mais nova não é sobrescrito por conta própria: este build não sabe lê-lo, e
  // duas gravações automáticas de outra carreira o apagariam para sempre. Só sai do slot quando o
  // jogador o apaga na tela Saves.
  if (isNewerSave(previous)) {
    throw new NewerSaveError(
      'Este slot guarda um save de uma versão mais nova do jogo, e ele não foi sobrescrito. Atualize o jogo para abri-lo, salve em outro slot ou apague-o na tela Saves.',
    );
  }
  // Esta gravação vai substituir um save de formato anterior (o do slot ou, se ele já foi
  // convertido, o que restou na cópia de segurança)? Então o original é guardado antes, intacto,
  // numa chave que nenhuma gravação seguinte toca. Vai na mesma transação e é a primeira chave: se
  // faltar espaço para a cópia, nada é escrito e o save antigo continua no slot.
  const entries: Record<string, unknown> = {};
  const original = await originalToKeep(storage, slot, previous);
  const originalVersion = storedVersion(original);
  if (originalVersion !== null) entries[originalKey(slot, originalVersion)] = original;
  entries[slot] = envelope;
  if (previous !== undefined) entries[backupKey(slot)] = previous;
  await storage.setMany(entries);
  return envelope;
}

/**
 * O save de formato anterior que a próxima gravação do slot faria sumir, se houver: o do próprio
 * slot ou, se ele já foi convertido (ou está danificado), o da cópia de segurança.
 */
async function originalToKeep(storage: StorageAdapter, slot: SaveSlotId, previous: unknown): Promise<unknown> {
  const intact = (raw: unknown) => checksumOf((raw as SaveEnvelope).career) === (raw as SaveEnvelope).checksum;
  if (isOlderSave(previous) && intact(previous)) return previous;
  const backup = await storage.get(backupKey(slot));
  if (isOlderSave(backup) && (intact(backup) || !isOlderSave(previous))) return backup;
  return isOlderSave(previous) ? previous : undefined;
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
    // Um save de versão mais nova não está danificado. A cópia de segurança é mais antiga: carregá-la
    // no lugar dele faria o jogador perder o progresso sem perceber, na gravação automática seguinte.
    if (primaryError instanceof NewerSaveError) throw primaryError;
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
  /** 'newer' = gravado por uma versão mais nova do jogo (íntegro, mas este build não o lê). */
  status: 'empty' | 'ok' | 'corrupted' | 'newer';
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
        // O resumo é refeito a partir da carreira já migrada, e não lido do arquivo: assim um save
        // gravado por uma versão anterior aparece na lista com os nomes de hoje.
        const career = parseEnvelope(raw);
        return { slot, status: 'ok', savedAt: (raw as SaveEnvelope).savedAt, summary: summarize(career) };
      } catch (error) {
        return { slot, status: error instanceof NewerSaveError ? 'newer' : 'corrupted', error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
}

/** Apaga o slot e a cópia de segurança dele. As cópias de formatos anteriores (`listOriginalCopies`) ficam. */
export async function deleteSave(storage: StorageAdapter, slot: SaveSlotId): Promise<void> {
  await storage.delete([slot, backupKey(slot)]);
}

/** Cópia intacta de um save de formato anterior, guardada quando o slot foi convertido. */
export interface OriginalCopyInfo {
  slot: SaveSlotId;
  /** Formato em que o save foi gravado (o `schemaVersion` dele). */
  version: number;
  savedAt?: string;
  /** Resumo com os nomes de hoje; ausente se a cópia não puder mais ser lida por este build. */
  summary?: SaveSummary;
}

/**
 * As cópias de formatos anteriores guardadas neste aparelho: no máximo uma por slot e por formato
 * (uma conversão nova do mesmo slot e formato fica no lugar da anterior).
 */
export async function listOriginalCopies(storage: StorageAdapter): Promise<OriginalCopyInfo[]> {
  const copies: OriginalCopyInfo[] = [];
  for (const key of await storage.keys()) {
    const match = ORIGINAL_KEY.exec(key);
    const slot = SAVE_SLOTS.find((id) => id === match?.[1]);
    if (!match || !slot) continue;
    const raw = await storage.get(key);
    const copy: OriginalCopyInfo = { slot, version: Number(match[2]) };
    const savedAt = (raw as { savedAt?: unknown } | undefined)?.savedAt;
    if (typeof savedAt === 'string') copy.savedAt = savedAt;
    try {
      copy.summary = summarize(parseEnvelope(raw));
    } catch {
      // Sem resumo: a cópia continua guardada e pode ser exportada para a versão que a gravou.
    }
    copies.push(copy);
  }
  return copies.sort((a, b) => SAVE_SLOTS.indexOf(a.slot) - SAVE_SLOTS.indexOf(b.slot) || b.version - a.version);
}

/**
 * O texto JSON de uma cópia de formato anterior, exatamente como o save foi gravado (com o
 * checksum dele): abre na versão do jogo que o gravou e, pela migração, nesta.
 */
export async function exportOriginalCopy(storage: StorageAdapter, slot: SaveSlotId, version: number): Promise<string> {
  const raw = await storage.get(originalKey(slot, version));
  if (raw === undefined) throw new SaveError('Esta cópia não está mais guardada neste aparelho.');
  return JSON.stringify(raw, null, 2);
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
