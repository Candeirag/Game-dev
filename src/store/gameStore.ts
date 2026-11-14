/**
 * Store global (Zustand). É uma camada fina: guarda o estado atual e chama o
 * motor do jogo (src/engine) e o serviço de saves (src/persistence). Nenhuma
 * regra de jogo vive aqui nem nos componentes React.
 */
import { create } from 'zustand';
import type { CareerState, CategoryId, DevArea, DevValues, FacilityKey, Lifestyle, PracticeProgram, Property, QualifyingApproach, RaceMode, ResearchSpend, StaffRole, SupportLevel, TrainingFocus, TrainingIntensity, TyreCompound } from '@/domain/schemas';
import * as engine from '@/engine';
import type { ExecutivePlan, InvestmentProduct, NegotiationDemand, NewCareerInput, RaceSimState, RaceTimeline, StrategyPlan } from '@/engine';
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
  /**
   * Linha do tempo da corrida em andamento, para a transmissão visual. É derivada
   * das voltas que o motor já simulou; como a corrida ao vivo, não vai para o save.
   */
  raceTimeline: RaceTimeline | null;
  raceMode: RaceMode;
  /** Parada pedida pelo jogador para a próxima volta. */
  pitRequest: TyreCompound | null;
  /** Pular a parada planejada para a próxima volta. */
  skipPlannedStop: boolean;
  /** Engenheiro automático: decide paradas e protege o combustível. */
  autoEngineer: boolean;
  saveStatus: SaveStatus;
  slots: SlotInfo[];
  notice: string | null;
  /** Desfecho do último evento resolvido, para mostrar ao jogador. */
  lastOutcome: { title: string; text: string } | null;

  refreshSlots(): Promise<void>;
  newCareer(input: NewCareerInput): Promise<void>;
  loadSlot(slot: SaveSlotId): Promise<void>;
  importJson(json: string): Promise<void>;
  exportJson(): string | null;
  saveToSlot(slot: SaveSlotId): Promise<void>;
  removeSlot(slot: SaveSlotId): Promise<void>;
  exitToMenu(): void;
  dismissNotice(): void;
  dismissOutcome(): void;

  setTrainingFocus(focus: TrainingFocus): void;
  setTrainingIntensity(intensity: TrainingIntensity): void;
  invest(product: InvestmentProduct, amount: number): void;
  resolveEvent(eventId: string, choiceId: string): void;

  startWeekend(options?: { rest?: boolean }): void;
  runPractice(program: PracticeProgram): void;
  runQualifying(approach: QualifyingApproach): void;
  simulateAbsentWeekend(choices?: { program?: PracticeProgram; approach?: QualifyingApproach }): void;
  beginRace(plan?: StrategyPlan): void;
  setRaceMode(mode: RaceMode): void;
  requestPit(compound: TyreCompound | null): void;
  setSkipPlannedStop(skip: boolean): void;
  setAutoEngineer(auto: boolean): void;
  /** Avança uma volta. `teamOrder` responde a uma ordem de equipe pendente. */
  stepRace(teamOrder?: 'obey' | 'ignore'): void;
  simulateRestOfRace(): void;
  completeWeekend(): void;

  negotiateOffer(offerId: string, demand: NegotiationDemand): void;
  startNextSeason(offerId: string): void;
  retire(): void;

  /* Patrimônio pessoal */
  buyStock(stockId: string, shares: number): void;
  sellStock(stockId: string, shares: number): void;
  buyProperty(catalogId: string, use: Property['use']): void;
  setPropertyUse(propertyId: string, use: Property['use']): void;
  sellProperty(propertyId: string): void;
  openBusiness(catalogId: string): void;
  upgradeBusiness(businessId: string): void;
  sellBusiness(businessId: string): void;
  buyStake(teamId: string, share: number): void;
  sellStake(stakeId: string): void;
  takeLoan(amount: number, seasons: number): void;
  repayLoan(loanId: string): void;
  setLifestyle(lifestyle: Lifestyle): void;

  /* Família e sucessão */
  setKartFunding(childId: string, funding: SupportLevel): void;
  setChildSupport(childId: string, support: SupportLevel): void;
  beginHandover(): void;
  cancelHandover(): void;
  resolveSuccession(heirId: string, path: 'driver' | 'executive'): void;

  /* Gestão de equipe */
  hireStaff(staffId: string): void;
  dismissStaff(role: StaffRole): void;
  setDepartment(department: 'engineers' | 'mechanics', level: number): void;
  upgradeFacility(key: FacilityKey): void;
  setDevelopment(change: { allocation?: DevValues; spend?: ResearchSpend }): void;
  setAreaShare(area: DevArea, share: number): void;
  ownerTransfer(amount: number): void;
  setLineup(driverIds: string[]): void;
  acceptTeamSponsor(sponsorId: string): void;
  dropTeamSponsor(sponsorId: string): void;
  leaveTeam(): void;
  startExecutiveSeason(plan: ExecutivePlan): void;
  foundTeam(categoryId: CategoryId, name: string, color: string): void;

  /* Tutorial */
  visit(route: string): void;
  dismissTutorial(): void;
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

  /** Ação simples: chama uma função do motor com os argumentos dados e salva. */
  const action = <A extends unknown[]>(fn: (career: CareerState, ...args: A) => CareerState) => (...args: A) => apply((c) => fn(c, ...args), { save: true });

  const RACE_RESET = { liveRace: null, raceTimeline: null, raceMode: 'balanced' as RaceMode, pitRequest: null, skipPlannedStop: false };

  return {
    storage: createDefaultStorage(),
    career: null,
    ...RACE_RESET,
    autoEngineer: false,
    saveStatus: { kind: 'idle' },
    slots: [],
    notice: null,
    lastOutcome: null,

    async refreshSlots() {
      set({ slots: await listSaves(get().storage) });
    },

    async newCareer(input) {
      const career = engine.createCareer(input, newSeed(), now());
      set({ career, ...RACE_RESET, notice: null, lastOutcome: null });
      await autosave(career);
    },

    async loadSlot(slot) {
      try {
        const { career, recoveredFromBackup } = await loadCareer(get().storage, slot);
        set({
          career,
          ...RACE_RESET,
          lastOutcome: null,
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
      set({ career, ...RACE_RESET, lastOutcome: null, notice: 'Carreira importada com sucesso.' });
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
      set({ career: null, ...RACE_RESET, notice: null, lastOutcome: null, saveStatus: { kind: 'idle' } });
      void get().refreshSlots();
    },

    dismissNotice() {
      set({ notice: null });
    },

    dismissOutcome() {
      set({ lastOutcome: null });
    },

    setTrainingFocus(focus) {
      apply((c) => engine.setTrainingFocus(c, focus), { save: true });
    },

    setTrainingIntensity(intensity) {
      apply((c) => engine.setTrainingIntensity(c, intensity), { save: true });
    },

    invest(product, amount) {
      apply((c) => engine.invest(c, { product, amount }), { save: true });
    },

    resolveEvent(eventId, choiceId) {
      const career = get().career;
      const event = career?.pendingEvents.find((e) => e.id === eventId);
      if (!career || !event) return;
      try {
        const result = engine.resolveEvent(career, eventId, choiceId);
        set({ career: result.career, lastOutcome: { title: event.title, text: result.outcome }, notice: null });
        void autosave(result.career);
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    startWeekend(options) {
      apply((c) => engine.startWeekend(c, options), { save: true });
    },

    runPractice(program) {
      apply((c) => engine.runPractice(c, program), { save: true });
    },

    runQualifying(approach) {
      apply((c) => engine.runQualifying(c, approach), { save: true });
    },

    simulateAbsentWeekend(choices) {
      apply((c) => engine.simulateAbsentWeekend(c, choices), { save: true });
    },

    beginRace(plan) {
      const career = get().career;
      if (!career) return;
      try {
        const race = engine.createWeekendRace(career, plan);
        set({ ...RACE_RESET, liveRace: race, raceTimeline: engine.createRaceTimeline(race, engine.buildRaceContext(career)), notice: null });
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    setRaceMode(mode) {
      set({ raceMode: mode });
    },

    requestPit(compound) {
      set({ pitRequest: compound });
    },

    setSkipPlannedStop(skip) {
      set({ skipPlannedStop: skip });
    },

    setAutoEngineer(auto) {
      set({ autoEngineer: auto });
    },

    stepRace(teamOrder) {
      const { career, liveRace, raceTimeline, raceMode, pitRequest, skipPlannedStop, autoEngineer } = get();
      if (!career || !liveRace || engine.isRaceFinished(liveRace)) return;
      // Uma ordem de equipe pendente exige resposta antes da próxima volta.
      if (liveRace.pendingTeamOrder && !teamOrder) return;
      const context = engine.buildRaceContext(career);
      const next = engine.stepRaceLap(liveRace, context, {
        mode: raceMode,
        pit: pitRequest,
        skipPlannedStop,
        auto: autoEngineer,
        ...(teamOrder ? { teamOrder } : {}),
      });
      set({ liveRace: next, raceTimeline: raceTimeline && engine.appendRaceLap(raceTimeline, liveRace, next, context), pitRequest: null, skipPlannedStop: false });
    },

    simulateRestOfRace() {
      const { career, liveRace, raceMode } = get();
      if (!career || !liveRace) return;
      // Mesmas regras de simulateRemainingRace, volta a volta, para a linha do tempo acompanhar.
      const context = engine.buildRaceContext(career);
      let race = liveRace;
      let timeline = get().raceTimeline;
      while (!engine.isRaceFinished(race)) {
        const next = engine.stepRaceLap(race, context, { mode: raceMode, auto: true, pit: null });
        timeline = timeline && engine.appendRaceLap(timeline, race, next, context);
        race = next;
      }
      set({ liveRace: race, raceTimeline: timeline, pitRequest: null, skipPlannedStop: false });
    },

    completeWeekend() {
      const race = get().liveRace;
      if (!race) return;
      apply((c) => engine.completeWeekend(c, race), { save: true });
      if (!get().notice) set({ ...RACE_RESET });
    },

    negotiateOffer(offerId, demand) {
      const career = get().career;
      if (!career) return;
      try {
        const result = engine.negotiateOffer(career, offerId, demand);
        set({ career: result.career, notice: result.message });
        void autosave(result.career);
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    startNextSeason(offerId) {
      apply((c) => engine.startNextSeason(c, offerId), { save: true });
    },

    retire() {
      apply(engine.retireFromDriving, { save: true });
    },

    buyStock: action(engine.buyStock),
    sellStock: action(engine.sellStock),
    buyProperty: action(engine.buyProperty),
    setPropertyUse: action(engine.setPropertyUse),
    sellProperty: action(engine.sellProperty),
    openBusiness: action(engine.openBusiness),
    upgradeBusiness: action(engine.upgradeBusiness),
    sellBusiness: action(engine.sellBusiness),
    buyStake: action(engine.buyStake),
    sellStake: action(engine.sellStake),
    takeLoan: action(engine.takeLoan),
    repayLoan: action(engine.repayLoan),
    setLifestyle: action(engine.setLifestyle),

    setKartFunding: action(engine.setKartFunding),
    setChildSupport: action(engine.setChildSupport),
    beginHandover: action(engine.beginHandover),
    cancelHandover: action(engine.cancelHandover),
    resolveSuccession(heirId, path) {
      apply((c) => engine.resolveSuccession(c, heirId, path), { save: true });
      if (!get().notice) set({ ...RACE_RESET, lastOutcome: null });
    },

    hireStaff: action(engine.hireStaff),
    dismissStaff: action(engine.dismissStaff),
    setDepartment: action(engine.setDepartment),
    upgradeFacility: action(engine.upgradeFacility),
    setDevelopment: action(engine.setDevelopment),
    setAreaShare: action(engine.setAreaShare),
    ownerTransfer: action(engine.ownerTransfer),
    setLineup: action(engine.setLineup),
    acceptTeamSponsor: action(engine.acceptTeamSponsor),
    dropTeamSponsor: action(engine.dropTeamSponsor),
    leaveTeam: action(engine.leaveTeam),
    startExecutiveSeason: action(engine.startExecutiveSeason),
    foundTeam(categoryId, name, color) {
      apply((c) => engine.startExecutiveSeason(c, { kind: 'found', categoryId, name, color }), { save: true });
    },

    visit(route) {
      const career = get().career;
      if (!career) return;
      const next = engine.visitTutorialRoute(career, route);
      if (next !== career) {
        set({ career: next });
        void autosave(next);
      }
    },
    dismissTutorial: action(engine.dismissTutorial),
  };
});
