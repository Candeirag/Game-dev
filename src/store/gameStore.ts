/**
 * Store global (Zustand). É uma camada fina: guarda o estado atual e chama o
 * motor do jogo (src/engine) e o serviço de saves (src/persistence). Nenhuma
 * regra de jogo vive aqui nem nos componentes React.
 */
import { create } from 'zustand';
import type {
  CareerState,
  CategoryId,
  DevArea,
  DevValues,
  FacilityKey,
  Lifestyle,
  PracticeProgram,
  Property,
  QualifyingApproach,
  RaceMode,
  ResearchSpend,
  SideJob,
  StaffRole,
  SupportLevel,
  TrainingFocus,
  TrainingIntensity,
  TyreCompound,
} from '@/domain/schemas';
import * as engine from '@/engine';
import type { ExecutivePlan, InvestmentProduct, NegotiationDemand, NewCareerInput, PlayerRaceInput, RaceSimState, RaceTimeline, StrategyPlan } from '@/engine';
import { readBirthDraft, readLastExport, writeBirthDraft, writeLastExport, type BirthDraft } from '@/persistence/preferences';
import { clearRaceResume, loadRaceResume, raceResumeKey, saveRaceResume, type RaceResume } from '@/persistence/raceResume';
import { reportError } from '@/monitoring/crashReporting';
import { DeviceFileStorage, migrateStorage } from '@/persistence/deviceStorage';
import { IndexedDbStorage, LocalStorageAdapter, createDefaultStorage, probeStorage, type StorageAdapter } from '@/persistence/storage';
import { capacitorFiles } from '@/platform/deviceFiles';
import { isNativeApp } from '@/platform/native';
import {
  NewerSaveError,
  type OriginalCopyInfo,
  SaveError,
  deleteSave,
  exportCareer,
  exportOriginalCopy,
  importCareer,
  listOriginalCopies,
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
  /** Comandos de cada volta já simulada e a estratégia da largada: é o que permite refazer a corrida depois de uma recarga. */
  raceSteps: PlayerRaceInput[];
  racePlan: StrategyPlan | null;
  /** Volta que a transmissão está mostrando (anotada pela tela). */
  raceShownLap: number;
  /** Instante exato da imagem, anotado quando a página é fechada ou escondida. */
  raceShownTime: number | null;
  /** Corrida desta etapa que foi interrompida por uma recarga da página, à espera da decisão do jogador. */
  raceResume: RaceResume | null;
  /** Depois de retomar a corrida: volta (e, se anotado, instante) em que a transmissão deve reabrir. A tela consome e limpa. */
  raceSeekLap: number | null;
  raceSeekTime: number | null;
  /** Data da última exportação da carreira para fora do navegador. */
  lastExportAt: string | null;
  saveStatus: SaveStatus;
  slots: SlotInfo[];
  /** Cópias intactas de saves de formato anterior, guardadas quando o slot foi convertido. */
  originalCopies: OriginalCopyInfo[];
  notice: string | null;
  /** Desfecho do último evento resolvido, para mostrar ao jogador. */
  lastOutcome: { title: string; text: string } | null;

  /** Testa o armazenamento do navegador e escolhe o que funciona (chamado uma vez, na abertura). */
  initStorage(): Promise<void>;
  refreshSlots(): Promise<void>;
  refreshOriginalCopies(): Promise<void>;
  /** Texto JSON de uma cópia de formato anterior, como o save foi gravado. */
  exportOriginalCopy(slot: SaveSlotId, version: number): Promise<string>;
  /** Anota que a carreira acabou de ser exportada. */
  markExported(): void;
  /** Nascimento da próxima carreira (semente e sorteio), guardado no aparelho até ela começar. */
  birthDraft: BirthDraft | null;
  /** Abre (ou retoma) o rascunho do nascimento: uma semente nova, no primeiro sorteio. */
  beginBirth(): BirthDraft;
  /** Passa ao sorteio seguinte, se ainda houver sorteios (`allowed` refeitos, conforme a versão do jogo). */
  rerollBirth(allowed: number): void;
  /** Cria a carreira com o nascimento do rascunho e o apaga. */
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
  /** Portas da carreira (tela Caminhos): trabalho paralelo a qualquer hora; academia, vaquinha e investidor no fechamento do ano. */
  setSideJob(job: SideJob): void;
  joinAcademy(): void;
  launchCrowdfund(): void;
  signInvestor(offerId: string): void;
  setTrainingIntensity(intensity: TrainingIntensity): void;
  invest(product: InvestmentProduct, amount: number): void;
  resolveEvent(eventId: string, choiceId: string): void;

  startWeekend(options?: { rest?: boolean }): void;
  runPractice(program: PracticeProgram): void;
  runQualifying(approach: QualifyingApproach): void;
  simulateAbsentWeekend(choices?: { program?: PracticeProgram; approach?: QualifyingApproach }): void;
  /**
   * Etapa sem o jogador no carro, para assistir: disputa treino e classificação, simula a corrida
   * inteira (com as mesmas entradas de simulateAbsentWeekend) e deixa a linha do tempo pronta para
   * a transmissão. O resultado só é gravado quando o jogador conclui a etapa.
   */
  watchAbsentWeekend(choices?: { program?: PracticeProgram; approach?: QualifyingApproach }): void;
  beginRace(plan?: StrategyPlan): void;
  setRaceMode(mode: RaceMode): void;
  requestPit(compound: TyreCompound | null): void;
  setSkipPlannedStop(skip: boolean): void;
  setAutoEngineer(auto: boolean): void;
  /** Avança uma volta. `teamOrder` responde a uma ordem de equipe pendente. */
  stepRace(teamOrder?: 'obey' | 'ignore'): void;
  /** Refaz a corrida interrompida com os mesmos comandos; `toEnd` simula também o que faltava. */
  resumeRace(toEnd: boolean): void;
  noteLapShown(lap: number): void;
  noteTimeShown(time: number): void;
  clearRaceSeek(): void;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useGameStore = create<GameStore>((set, get) => {
  /** O aviso de "save de versão mais nova no slot automático" já foi mostrado nesta sessão. */
  let newerSaveWarned = false;

  /** Salva no slot automático. Erros aparecem no indicador de save, sem interromper o jogo. */
  async function autosave(career: CareerState) {
    set({ saveStatus: { kind: 'saving' } });
    try {
      await saveCareer(get().storage, 'auto', career, now());
      set({ saveStatus: { kind: 'saved', at: now(), slot: 'auto' } });
      newerSaveWarned = false;
      void get().refreshSlots();
    } catch (error) {
      set({
        saveStatus: {
          kind: 'error',
          message: errorMessage(error),
          ...(error instanceof SaveError ? { problems: error.problems } : {}),
        },
        // O slot automático guarda um save de versão mais nova, que não é sobrescrito: o jogador
        // precisa saber por que a gravação automática parou. O aviso aparece uma vez; o indicador
        // de save continua mostrando a falha.
        ...(error instanceof NewerSaveError && !newerSaveWarned ? { notice: error.message } : {}),
      });
      if (error instanceof NewerSaveError) newerSaveWarned = true;
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
  const action =
    <A extends unknown[]>(fn: (career: CareerState, ...args: A) => CareerState) =>
    (...args: A) =>
      apply((c) => fn(c, ...args), { save: true });

  const RACE_RESET = {
    liveRace: null,
    raceTimeline: null,
    raceMode: 'balanced' as RaceMode,
    pitRequest: null,
    skipPlannedStop: false,
    raceSteps: [] as PlayerRaceInput[],
    racePlan: null,
    raceShownLap: 0,
    raceShownTime: null,
    raceResume: null,
    raceSeekLap: null,
    raceSeekTime: null,
  };

  /** Guarda no navegador os comandos da corrida em andamento, para ela sobreviver a uma recarga. */
  function rememberRace(): void {
    const { career, liveRace, raceSteps, racePlan, raceMode, autoEngineer, raceShownLap, raceShownTime } = get();
    const key = career ? raceResumeKey(career) : null;
    if (!key || !liveRace || raceSteps.length === 0) return;
    saveRaceResume({
      key,
      plan: racePlan,
      steps: raceSteps,
      mode: raceMode,
      autoEngineer,
      shownLap: Math.min(raceShownLap, raceSteps.length),
      shownTime: raceShownTime,
      totalLaps: liveRace.totalLaps,
    });
  }

  /** Corrida interrompida da carreira recém-aberta, se o save está na hora da corrida. */
  function pendingResume(career: CareerState): RaceResume | null {
    return career.weekend && career.weekend.qualifying !== null ? loadRaceResume(career) : null;
  }

  return {
    storage: createDefaultStorage(),
    career: null,
    ...RACE_RESET,
    autoEngineer: false,
    saveStatus: { kind: 'idle' },
    slots: [],
    originalCopies: [],
    notice: null,
    lastOutcome: null,
    lastExportAt: readLastExport(),
    birthDraft: readBirthDraft(),

    beginBirth() {
      const current = get().birthDraft;
      if (current) return current;
      const draft: BirthDraft = { seed: engine.randomSeed(), attempt: 0 };
      writeBirthDraft(draft);
      set({ birthDraft: draft });
      return draft;
    },

    rerollBirth(allowed) {
      const current = get().birthDraft;
      if (!current || current.attempt >= Math.min(allowed, engine.maxBirthRerolls())) return;
      const draft = { ...current, attempt: current.attempt + 1 };
      writeBirthDraft(draft);
      set({ birthDraft: draft });
    },

    async initStorage() {
      // No aplicativo, os saves ficam em arquivos do aparelho; no navegador, no IndexedDB.
      const storage = await probeStorage(isNativeApp() ? [() => new DeviceFileStorage(capacitorFiles())] : []);
      // Só troca se a carreira ainda não começou a ser gravada em outro lugar nesta sessão.
      if (storage.kind !== get().storage.kind) set({ storage });
      if (storage.kind === 'device') {
        // Saves que uma versão anterior do aplicativo deixou no IndexedDB ou no localStorage vêm para o aparelho.
        for (const old of [typeof indexedDB !== 'undefined' ? () => new IndexedDbStorage() : null, () => new LocalStorageAdapter()]) {
          try {
            if (old) await migrateStorage(old(), storage);
          } catch (error) {
            // A origem fica intacta e a migração é tentada de novo na próxima abertura.
            reportError(error, { source: 'migração dos saves' });
          }
        }
      }
      await get().refreshSlots();
    },

    markExported() {
      const at = now();
      writeLastExport(at);
      set({ lastExportAt: at });
    },

    async refreshSlots() {
      set({ slots: await listSaves(get().storage) });
    },

    async refreshOriginalCopies() {
      set({ originalCopies: await listOriginalCopies(get().storage) });
    },

    exportOriginalCopy(slot, version) {
      return exportOriginalCopy(get().storage, slot, version);
    },

    async newCareer(input) {
      const draft = get().birthDraft;
      const career = engine.createCareer({ ...input, birthAttempt: draft?.attempt ?? 0 }, draft?.seed ?? engine.randomSeed(), now());
      writeBirthDraft(null);
      set({ career, birthDraft: null, ...RACE_RESET, notice: null, lastOutcome: null });
      await autosave(career);
    },

    async loadSlot(slot) {
      try {
        const { career, recoveredFromBackup } = await loadCareer(get().storage, slot);
        set({
          career,
          ...RACE_RESET,
          raceResume: pendingResume(career),
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
      set({ career, ...RACE_RESET, raceResume: pendingResume(career), lastOutcome: null, notice: 'Carreira importada com sucesso.' });
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

    setSideJob(job) {
      apply((c) => engine.setSideJob(c, job), { save: true });
    },

    joinAcademy() {
      apply(engine.joinAcademyDoor, { save: true });
    },

    launchCrowdfund() {
      apply(engine.launchCrowdfund, { save: true });
    },

    signInvestor(offerId) {
      apply((c) => engine.signInvestor(c, offerId), { save: true });
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

    watchAbsentWeekend(choices) {
      const career = get().career;
      if (!career) return;
      try {
        const prepared = engine.prepareAbsentWeekend(career, choices);
        const context = engine.buildRaceContext(prepared);
        let race = engine.createWeekendRace(prepared);
        let timeline = engine.createRaceTimeline(race, context);
        while (!engine.isRaceFinished(race)) {
          const next = engine.stepRaceLap(race, context, { mode: 'balanced', auto: true, pit: null });
          timeline = engine.appendRaceLap(timeline, race, next, context);
          race = next;
        }
        set({ career: prepared, ...RACE_RESET, liveRace: race, raceTimeline: timeline, notice: null });
        void autosave(prepared);
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    beginRace(plan) {
      const career = get().career;
      if (!career) return;
      try {
        const race = engine.createWeekendRace(career, plan);
        // Uma largada nova substitui qualquer corrida interrompida desta etapa.
        clearRaceResume();
        set({
          ...RACE_RESET,
          liveRace: race,
          raceTimeline: engine.createRaceTimeline(race, engine.buildRaceContext(career)),
          racePlan: plan ?? null,
          notice: null,
        });
      } catch (error) {
        set({ notice: errorMessage(error) });
      }
    },

    setRaceMode(mode) {
      set({ raceMode: mode });
      rememberRace();
    },

    requestPit(compound) {
      set({ pitRequest: compound });
    },

    setSkipPlannedStop(skip) {
      set({ skipPlannedStop: skip });
    },

    setAutoEngineer(auto) {
      set({ autoEngineer: auto });
      rememberRace();
    },

    stepRace(teamOrder) {
      const { career, liveRace, raceTimeline, raceMode, pitRequest, skipPlannedStop, autoEngineer } = get();
      if (!career || !liveRace || engine.isRaceFinished(liveRace)) return;
      // Uma ordem de equipe pendente exige resposta antes da próxima volta.
      if (liveRace.pendingTeamOrder && !teamOrder) return;
      const context = engine.buildRaceContext(career);
      const input: PlayerRaceInput = {
        mode: raceMode,
        pit: pitRequest,
        skipPlannedStop,
        auto: autoEngineer,
        ...(teamOrder ? { teamOrder } : {}),
      };
      const next = engine.stepRaceLap(liveRace, context, input);
      set({
        liveRace: next,
        raceTimeline: raceTimeline && engine.appendRaceLap(raceTimeline, liveRace, next, context),
        pitRequest: null,
        skipPlannedStop: false,
        raceSteps: [...get().raceSteps, input],
      });
      rememberRace();
    },

    resumeRace(toEnd) {
      const { career, raceResume } = get();
      if (!career || !raceResume) return;
      try {
        // O motor é determinístico: a mesma largada com os mesmos comandos devolve a mesma corrida.
        const context = engine.buildRaceContext(career);
        let race = engine.createWeekendRace(career, raceResume.plan ?? undefined);
        let timeline = engine.createRaceTimeline(race, context);
        const steps: PlayerRaceInput[] = [];
        const advance = (input: PlayerRaceInput) => {
          const next = engine.stepRaceLap(race, context, input);
          timeline = engine.appendRaceLap(timeline, race, next, context);
          race = next;
          steps.push(input);
        };
        for (const input of raceResume.steps) {
          if (engine.isRaceFinished(race)) break;
          advance(input);
        }
        while (toEnd && !engine.isRaceFinished(race)) advance({ mode: raceResume.mode, auto: true, pit: null });
        set({
          ...RACE_RESET,
          liveRace: race,
          raceTimeline: timeline,
          raceMode: raceResume.mode,
          autoEngineer: raceResume.autoEngineer,
          raceSteps: steps,
          racePlan: raceResume.plan,
          raceShownLap: toEnd ? race.currentLap : raceResume.shownLap,
          raceSeekLap: toEnd ? null : raceResume.shownLap,
          raceSeekTime: toEnd ? null : raceResume.shownTime,
          notice: null,
        });
        rememberRace();
      } catch (error) {
        clearRaceResume();
        set({ raceResume: null, notice: `Não foi possível retomar a corrida interrompida (${errorMessage(error)}). Ela recomeça da largada.` });
      }
    },

    noteLapShown(lap) {
      if (lap === get().raceShownLap) return;
      // O instante anotado valia para a volta anterior.
      set({ raceShownLap: lap, raceShownTime: null });
      rememberRace();
    },

    noteTimeShown(time) {
      set({ raceShownTime: time });
      rememberRace();
    },

    clearRaceSeek() {
      if (get().raceSeekLap !== null || get().raceSeekTime !== null) set({ raceSeekLap: null, raceSeekTime: null });
    },

    simulateRestOfRace() {
      const { career, liveRace, raceMode } = get();
      if (!career || !liveRace) return;
      // Mesmas regras de simulateRemainingRace, volta a volta, para a linha do tempo acompanhar.
      const context = engine.buildRaceContext(career);
      let race = liveRace;
      let timeline = get().raceTimeline;
      const steps = [...get().raceSteps];
      while (!engine.isRaceFinished(race)) {
        const input: PlayerRaceInput = { mode: raceMode, auto: true, pit: null };
        const next = engine.stepRaceLap(race, context, input);
        timeline = timeline && engine.appendRaceLap(timeline, race, next, context);
        race = next;
        steps.push(input);
      }
      set({ liveRace: race, raceTimeline: timeline, pitRequest: null, skipPlannedStop: false, raceSteps: steps, raceShownLap: race.currentLap });
      rememberRace();
    },

    completeWeekend() {
      const race = get().liveRace;
      if (!race) return;
      apply((c) => engine.completeWeekend(c, race), { save: true });
      if (!get().notice) {
        clearRaceResume();
        set({ ...RACE_RESET });
      }
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
