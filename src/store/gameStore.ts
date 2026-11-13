/**
 * Store global (Zustand). É uma camada fina: guarda o estado atual e chama o
 * motor do jogo (src/engine) e o serviço de saves (src/persistence). Nenhuma
 * regra de jogo vive aqui nem nos componentes React.
 */
import { create } from 'zustand';
import type { CareerState, PracticeProgram, QualifyingApproach, RaceMode, TrainingFocus } from '@/domain/schemas';
import * as engine from '@/engine';
import type { NewCareerInput, RaceSimState } from '@/engine';
import { createDefaultStorage, type StorageAdapter } from '@/persistence/storage';
import {
  SaveError,
  deleteSave,
  exportCareer,
  importCareer,
  listSaves,
  loadCareer,
  saveCareer,
  type SaveSlotId,
  type SlotInfo,
} from '@/persistence/saveService';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string; slot: SaveSlotId }
  | { kind: 'error'; message: string; problems?: string[] };

export interface GameStore {
  storage: StorageAdapter;
  career: CareerState | null;
  liveRace: RaceSimState | null;
  raceMode: RaceMode;
  saveStatus: SaveStatus;
  slots: SlotInfo[];
  notice: string | null;

  refreshSlots(): Promise<void>;
  newCareer(input: NewCareerInput): Promise<void>;
  loadSlot(slot: SaveSlotId): Promise<void>;
  importJson(json: string): Promise<void>;
  exportJson(): string | null;
  saveToSlot(slot: SaveSlotId): Promise<void>;
  removeSlot(slot: SaveSlotId): Promise<void>;
  exitToMenu(): void;
  dismissNotice(): void;

  setTrainingFocus(focus: TrainingFocus): void;
  startWeekend(): void;
  runPractice(program: PracticeProgram): void;
  runQualifying(approach: QualifyingApproach): void;
  beginRace(): void;
  setRaceMode(mode: RaceMode): void;
  stepRace(): void;
  simulateRestOfRace(): void;
  completeWeekend(): void;
  startNextSeason(teamId: string): void;
}

const now = () => new Date().toISOString();

/**
 * Semente de uma carreira nova. É o único ponto do jogo com aleatoriedade não
 * determinística, de propósito: cada carreira nova tem a sua própria sorte.
 * Daí em diante, tudo deriva desta semente.
 */
function newSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Salva no slot automático. Erros aparecem no indicador de save, sem interromper o jogo. */
  async function autosave(career: CareerState) {
    set({ saveStatus: { kind: 'saving' } });
    try {
      await saveCareer(get().storage, 'auto', career, now());
      set({ saveStatus: { kind: 'saved', at: now(), slot: 'auto' } });
      void get().refreshSlots();
    } catch (error) {
      set({
        saveStatus: {
          kind: 'error',
          message: errorMessage(error),
          ...(error instanceof SaveError ? { problems: error.problems } : {}),
        },
      });
    }
  }

  /** Aplica uma transição do motor, trata erros e opcionalmente salva. */
  function apply(transition: (career: CareerState) => CareerState, options: { save: boolean }) {
    const career = get().career;
    if (!career) return;
    try {
      const next = transition(career);
      set({ career: next, notice: null });
      if (options.save) void autosave(next);
    } catch (error) {
      set({ notice: errorMessage(error) });
    }
  }

  return {
    storage: createDefaultStorage(),
    career: null,
    liveRace: null,
    raceMode: 'balanced',
    saveStatus: { kind: 'idle' },
    slots: [],
    notice: null,

    async refreshSlots() {
      set({ slots: await listSaves(get().storage) });
    },

    async newCareer(input) {
      const career = engine.createCareer(input, newSeed(), now());
      set({ career, liveRace: null, raceMode: 'balanced', notice: null });
      await autosave(career);
    },

    async loadSlot(slot) {
      try {
        const { career, recoveredFromBackup } = await loadCareer(get().storage, slot);
        set({
          career,
          liveRace: null,
          raceMode: 'balanced',
          saveStatus: { kind: 'idle' },
          notice: recoveredFromBackup ? 'O save principal estava danificado; a cópia de segurança foi carregada.' : null,
        });
      } catch (error) {
        set({ notice: errorMessage(error) });
        throw error;
      }
    },

    async importJson(json) {
      const career = importCareer(json);
      set({ career, liveRace: null, raceMode: 'balanced', notice: 'Carreira importada com sucesso.' });
      await autosave(career);
    },

    exportJson() {
      const career = get().career;
      return career ? exportCareer(career, now()) : null;
    },

    async saveToSlot(slot) {
      const career = get().career;
      if (!career) return;
      set({ saveStatus: { kind: 'saving' } });
      try {
        await saveCareer(get().storage, slot, career, now());
        set({ saveStatus: { kind: 'saved', at: now(), slot } });
        await get().refreshSlots();
      } catch (error) {
        set({ saveStatus: { kind: 'error', message: errorMessage(error) } });
      }
    },

    async removeSlot(slot) {
      await deleteSave(get().storage, slot);
      await get().refreshSlots();
    },

    exitToMenu() {
      set({ career: null, liveRace: null, notice: null, saveStatus: { kind: 'idle' } });
      void get().refreshSlots();
    },

    dismissNotice() {
      set({ notice: null });
    },

    setTrainingFocus(focus) {
      apply((c) => engine.setTrainingFocus(c, focus), { save: true });
    },

    startWeekend() {
      apply(engine.startWeekend, { save: true });
    },

    runPractice(program) {
      apply((c) => engine.runPractice(c, program), { save: true });
    },

    runQualifying(approach) {
      apply((c) => engine.runQualifying(c, approach), { save: true });
    },

    beginRace() {
      const career = get().career;
      if (!career) return;
      try {
        set({ liveRace: engine.createWeekendRace(career), raceMode: 'balanced', notice: null });
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    setRaceMode(mode) {
      set({ raceMode: mode });
    },

    stepRace() {
      const { career, liveRace, raceMode } = get();
      if (!career || !liveRace || engine.isRaceFinished(liveRace)) return;
      set({ liveRace: engine.stepRaceLap(liveRace, engine.buildRaceContext(career), raceMode) });
    },

    simulateRestOfRace() {
      const { career, liveRace, raceMode } = get();
      if (!career || !liveRace) return;
      set({ liveRace: engine.simulateRemainingRace(liveRace, engine.buildRaceContext(career), raceMode) });
    },

    completeWeekend() {
      const race = get().liveRace;
      if (!race) return;
      apply((c) => engine.completeWeekend(c, race), { save: true });
      if (!get().notice) set({ liveRace: null });
    },

    startNextSeason(teamId) {
      apply((c) => engine.startNextSeason(c, teamId), { save: true });
    },
  };
});
