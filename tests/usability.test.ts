/**
 * Rodada de usabilidade: moeda pela nacionalidade, plurais e retomada de uma
 * corrida interrompida. Nada aqui muda regra ou número; os testes conferem
 * justamente que só o texto mudou e que a corrida refeita é a mesma.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { currencyForNationality, formatMoney, relabelMoney } from '@/domain/money';
import { amongTheFirst, counted, fixStoredPlurals, pluralWord } from '@/domain/text';
import { importCareer, exportCareer } from '@/persistence/saveService';
import { loadRaceResume, raceResumeKey } from '@/persistence/raceResume';
import type { GameStore } from '@/store/gameStore';
import {
  buildRaceContext,
  careerCurrency,
  completeWeekend,
  createWeekendRace,
  isRaceFinished,
  money,
  runPractice,
  runQualifying,
  simulateRemainingRace,
  startWeekend,
  stepRaceLap,
  type MomentChoice,
  type PlayerRaceInput,
  type RaceMoment,
  type RaceSimState,
} from './engineApi';
import { NOW, newCareer, playRound, resolvePending } from './helpers';

/** localStorage de mentira, para a store e as anotações do navegador funcionarem no Node. */
function installLocalStorage(): Map<string, string> {
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return data;
}

describe('moeda', () => {
  it('formata em reais ou euros, sem converter o valor', () => {
    expect(currencyForNationality('BR')).toBe('BRL');
    expect(currencyForNationality('IT')).toBe('EUR');
    expect(formatMoney(30000, 'BRL')).toBe('R$ 30.000');
    expect(formatMoney(30000, 'EUR')).toBe('€ 30.000');
    expect(formatMoney(-1200, 'BRL')).toBe('−R$ 1.200');
    expect(formatMoney(1_250_000, 'BRL', { compact: true })).toBe('R$ 1,25 mi');
    expect(formatMoney(250_000, 'EUR', { compact: true })).toBe('€ 250 mil');
    expect(formatMoney(12.5, 'BRL', { decimals: 2 })).toBe('R$ 12,50');
    expect(formatMoney(500, 'BRL', { sign: true })).toBe('+R$ 500');
  });

  it('troca só o símbolo em textos já prontos', () => {
    expect(relabelMoney('A vaga custa € 13.000 por temporada.', 'BRL')).toBe('A vaga custa R$ 13.000 por temporada.');
    expect(relabelMoney('Saldo de € -1.200 e R$ 500.', 'EUR')).toBe('Saldo de € -1.200 e € 500.');
    expect(relabelMoney('Nada de dinheiro aqui: 13.000 pontos.', 'BRL')).toBe('Nada de dinheiro aqui: 13.000 pontos.');
  });

  it('o motor escreve na moeda do país do piloto, com os mesmos números', () => {
    const brazilian = newCareer(4242);
    const italian = newCareer(4242, { nationality: 'IT' });
    expect(careerCurrency(brazilian)).toBe('BRL');
    expect(careerCurrency(italian)).toBe('EUR');
    expect(money(brazilian, 13000)).toBe('R$ 13.000');
    const textOf = (c: CareerState) => JSON.stringify(c.inbox);
    expect(textOf(brazilian)).toContain('R$ ');
    expect(textOf(brazilian)).not.toContain('€');
    expect(textOf(italian)).toContain('€ ');
    // Mesma semente: a economia é idêntica; só o símbolo das mensagens difere.
    expect(italian.finance).toEqual(brazilian.finance);
    expect(textOf(italian).replaceAll('€', 'R$')).toBe(textOf(brazilian));
    // Uma temporada inteira não deixa nenhum "€" nos textos de um piloto brasileiro.
    let c = brazilian;
    for (let i = 0; i < 4; i++) c = playRound(c);
    expect(JSON.stringify(c)).not.toContain('€');
  });

  it('save antigo abre com o símbolo trocado e os valores intactos', () => {
    const raw = JSON.parse(readFileSync('tests/fixtures/v2/kart-pending-events.json', 'utf8')) as { career: { finance: { cash: number } } };
    expect(JSON.stringify(raw)).toContain('€');
    const loaded = importCareer(readFileSync('tests/fixtures/v2/kart-pending-events.json', 'utf8'));
    expect(JSON.stringify(loaded)).not.toContain('€');
    expect(JSON.stringify(loaded)).toContain('R$ ');
    expect(loaded.finance.cash).toBe(raw.career.finance.cash);
    // Exportar e importar de novo não muda mais nada.
    expect(importCareer(exportCareer(loaded, NOW))).toEqual({ ...loaded, updatedAt: NOW });
  });
});

describe('plurais', () => {
  it('singular entre zero e dois, plural no resto', () => {
    expect(counted(1, 'ponto', 'pontos')).toBe('1 ponto');
    expect(counted(2, 'ponto', 'pontos')).toBe('2 pontos');
    expect(counted(0, 'vitória', 'vitórias')).toBe('0 vitórias');
    expect(counted(4, 'ultrapassagem', 'ultrapassagens')).toBe('4 ultrapassagens');
    expect(counted('1,5', 'ano', 'anos')).toBe('1,5 ano');
    expect(counted('2.0', 'ano', 'anos')).toBe('2.0 anos');
    expect(pluralWord(1, 'proposta', 'propostas')).toBe('proposta');
  });

  it('a meta de posição de um patrocinador não vira "entre as 1 primeiras"', () => {
    expect(amongTheFirst(1)).toBe('em 1º lugar');
    expect(amongTheFirst(2)).toBe('entre as 2 primeiras');
    expect(amongTheFirst(8)).toBe('entre as 8 primeiras');
  });

  it('acerta os plurais de textos gravados por versões anteriores', () => {
    expect(fixStoredPlurals('Você somou 1 ponto(s) e fez 4 ultrapassagem(ns).')).toBe('Você somou 1 ponto e fez 4 ultrapassagens.');
    expect(fixStoredPlurals('0 vitória(s), 2 bandeira(s) vermelha(s), 1 tentativa(s) invalidada(s).')).toBe(
      '0 vitórias, 2 bandeiras vermelhas, 1 tentativa invalidada.',
    );
    expect(fixStoredPlurals('rendeu 1.5 ano(s) de base')).toBe('rendeu 1.5 ano de base');
    expect(fixStoredPlurals('Filho(a) de Ana, lateral(s)')).toBe('Filho(a) de Ana, lateral(s)');
    const loaded = importCareer(readFileSync('tests/fixtures/v2/offseason.json', 'utf8'));
    expect(JSON.stringify(loaded)).not.toMatch(/\d [a-zãõç]+\((s|ns)\)/);
  });

  it('as mensagens do motor não têm mais "(s)" nem "(ns)"', () => {
    let c = newCareer(99);
    for (let i = 0; i < 5; i++) c = playRound(c);
    expect(JSON.stringify(c)).not.toMatch(/[a-zãõç]\((s|ns)\)/);
  });
});

/** A resposta do jogador a cada lance decisivo, pela ordem em que aparecem (`null`: o piloto decide pelo estilo). */
type Answer = (moment: RaceMoment, index: number) => MomentChoice | null;

/** O comando de uma volta em que o jogador não pede parada nem usa o engenheiro automático. */
const lapInput = (mode: PlayerRaceInput['mode'], extra: Pick<PlayerRaceInput, 'moment' | 'teamOrder'>): PlayerRaceInput => ({
  mode,
  pit: null,
  skipPlannedStop: false,
  auto: false,
  ...extra,
});

/**
 * Uma volta como o jogador a joga na tela: responde ao lance decisivo pendente (sem `answer`, deixa
 * o piloto decidir pelo estilo), obedece à ordem de equipe pendente ou só deixa a volta correr.
 * Devolve o que a volta acrescenta ao comando gravado para a retomada.
 */
function playLap(store: () => GameStore, answer: Answer = () => null): Pick<PlayerRaceInput, 'moment' | 'teamOrder'> {
  const race = store().liveRace!;
  if (race.pendingMoment) {
    const moment = answer(race.pendingMoment, race.moments.length);
    store().answerMoment(moment);
    return { moment };
  }
  if (race.pendingTeamOrder) {
    store().stepRace('obey');
    return { teamOrder: 'obey' };
  }
  store().stepRace();
  return {};
}

describe('corrida interrompida', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('refazer a corrida com os mesmos comandos devolve a mesma corrida, e o resultado final é o mesmo', async () => {
    const { useGameStore } = await import('@/store/gameStore');
    const store = () => useGameStore.getState();
    const weekend = runQualifying(runPractice(startWeekend(resolvePending(newCareer(2024))), 'setup'), 'balanced');
    await store().importJson(exportCareer(weekend, NOW));
    expect(store().raceResume).toBeNull();

    // A largada sempre tem um lance decisivo: enquanto ele espera a resposta, a volta não anda.
    store().beginRace();
    expect(store().liveRace!.pendingMoment?.kind).toBe('start');
    store().stepRace();
    expect(store().liveRace!.currentLap).toBe(0);
    expect(store().raceSteps).toEqual([]);

    // Corre seis voltas mudando o ritmo, como o jogador faria pela barra fixa. Nos lances que
    // aparecem (o da largada, pelo menos), deixa o piloto decidir pelo estilo.
    const modes = ['balanced', 'aggressive', 'aggressive', 'conservative', 'balanced', 'aggressive'] as const;
    const steps: PlayerRaceInput[] = [];
    for (const mode of modes) {
      store().setRaceMode(mode);
      steps.push(lapInput(mode, playLap(store)));
    }
    expect(steps[0]).toHaveProperty('moment', null);
    store().noteLapShown(5);
    // Ritmo trocado depois da última volta simulada: também tem de sobreviver à recarga.
    store().setRaceMode('conservative');
    expect(loadRaceResume(store().career!)?.mode).toBe('conservative');
    store().setRaceMode('aggressive');
    const interrupted = store().liveRace!;
    expect(interrupted.currentLap).toBe(6);
    const career = store().career!;
    expect(raceResumeKey(career)).not.toBeNull();
    expect(loadRaceResume(career)?.steps).toHaveLength(6);
    expect(loadRaceResume(career)?.steps).toEqual(steps);

    // Resultado de referência: a corrida seguindo direto até o fim.
    store().simulateRestOfRace();
    const reference = store().liveRace!;

    // "Recarrega": a corrida ao vivo some e o save volta ao momento antes da largada.
    // (O registro guardado é o de antes de simular o resto; por isso é regravado aqui.)
    store().exitToMenu();
    await store().importJson(exportCareer(weekend, NOW));
    useGameStore.setState({
      raceResume: {
        key: raceResumeKey(career)!,
        plan: null,
        steps,
        mode: 'aggressive',
        autoEngineer: false,
        shownLap: 5,
        shownTime: 123.4,
        totalLaps: interrupted.totalLaps,
      },
    });

    store().resumeRace(false);
    expect(store().liveRace).toEqual(interrupted);
    expect(store().raceMode).toBe('aggressive');
    expect(store().raceSeekLap).toBe(5);
    expect(store().raceSeekTime).toBe(123.4);
    expect(store().raceTimeline?.lapsBuilt).toBe(6);

    // "Ver resultado": o mesmo fim de corrida da referência.
    useGameStore.setState({ liveRace: null, raceTimeline: null, raceResume: loadRaceResume(career) });
    store().resumeRace(true);
    expect(store().liveRace).toEqual(reference);
    expect(store().raceSeekLap).toBeNull();
  });

  it('o registro só vale para a mesma carreira e a mesma etapa', async () => {
    const { useGameStore } = await import('@/store/gameStore');
    const store = () => useGameStore.getState();
    const weekend = runQualifying(runPractice(startWeekend(resolvePending(newCareer(555))), 'setup'), 'balanced');
    await store().importJson(exportCareer(weekend, NOW));
    store().beginRace();
    playLap(store);
    playLap(store);
    const career = store().career!;
    expect(loadRaceResume(career)?.steps).toHaveLength(2);
    // Outra carreira, na mesma etapa: não herda a corrida.
    const other = runQualifying(runPractice(startWeekend(resolvePending(newCareer(556))), 'setup'), 'balanced');
    expect(loadRaceResume(other)).toBeNull();
    // Reabrir o save da própria carreira oferece a retomada; concluir a etapa apaga o registro.
    store().exitToMenu();
    await store().importJson(exportCareer(weekend, NOW));
    expect(store().raceResume?.steps).toHaveLength(2);
    store().resumeRace(true);
    store().completeWeekend();
    expect(store().raceResume).toBeNull();
    expect(loadRaceResume(career)).toBeNull();
  });

  /**
   * Corridas com lances respondidos (Fase 4). `answers` é o que o jogador responde a cada lance, na
   * ordem; `kinds`, os lances que a corrida tem com essas respostas (se o motor mudar e a lista for
   * outra, o roteiro precisa ser refeito); `stop`, o ponto em que a página fecha.
   */
  const interruptions: {
    name: string;
    careerOf: () => CareerState;
    answers: (MomentChoice | null)[];
    kinds: string[];
    stop: (race: RaceSimState) => boolean;
  }[] = [
    {
      // Kart, sem boxes: a página fecha com a pergunta do terceiro lance na tela, ainda sem resposta.
      name: 'kart, com a pergunta de um lance na tela',
      careerOf: () => newCareer(2026),
      answers: [{ option: 'inside' }, null, { option: 'dive' }, null],
      kinds: ['start', 'attack', 'attack', 'lastLap'],
      stop: (race) => race.moments.length === 2 && race.pendingMoment !== null,
    },
    {
      // Monoposto com boxes: a resposta ao lance da parada leva o composto; fecha duas voltas depois.
      name: 'monoposto, duas voltas depois do lance da parada',
      careerOf: () => importCareer(readFileSync('tests/fixtures/v2/formula-mid-season.json', 'utf8')),
      answers: [null, { option: 'undercut', compound: 'soft' }],
      kinds: ['start', 'pit'],
      stop: (race) => race.moments.length === 2 && race.currentLap >= race.moments[1]!.lap + 2,
    },
  ];

  it.each(interruptions)(
    'com lances respondidos ($name): a retomada refaz as respostas e a corrida termina igual',
    async ({ careerOf, answers, kinds, stop }) => {
      const { useGameStore } = await import('@/store/gameStore');
      const store = () => useGameStore.getState();
      const weekend = runQualifying(runPractice(startWeekend(resolvePending(careerOf())), 'setup'), 'balanced');
      // A resposta do roteiro, conferindo que ela existe mesmo entre as opções do lance que apareceu.
      const answer: Answer = (moment, index) => {
        const choice = answers[index] ?? null;
        if (choice) expect(moment.options.map((o) => o.id)).toContain(choice.option);
        if (choice?.compound) expect(moment.compounds).toContain(choice.compound);
        return choice;
      };

      // Referência: a mesma corrida, com as mesmas respostas, direto no motor e sem interrupção.
      const context = buildRaceContext(weekend);
      let reference = createWeekendRace(weekend);
      while (!isRaceFinished(reference)) {
        const pending = reference.pendingMoment;
        const extra = pending ? { moment: answer(pending, reference.moments.length) } : reference.pendingTeamOrder ? { teamOrder: 'obey' as const } : {};
        reference = stepRaceLap(reference, context, lapInput('balanced', extra));
      }
      expect(reference.moments.map((m) => m.kind)).toEqual(kinds);
      // Lance respondido pelo jogador fica com a opção dele; o que ele deixou passar, com a do estilo.
      expect(reference.moments.map((m) => m.auto)).toEqual(answers.map((choice) => choice === null));
      for (const [index, choice] of answers.entries()) if (choice) expect(reference.moments[index]?.option).toBe(choice.option);

      // O jogador corre até o ponto em que a página fecha.
      await store().importJson(exportCareer(weekend, NOW));
      const loaded = store().career!;
      store().beginRace();
      const steps: PlayerRaceInput[] = [];
      const lap = () => steps.push(lapInput('balanced', playLap(store, answer)));
      while (!stop(store().liveRace!) && !isRaceFinished(store().liveRace!)) lap();
      const interrupted = store().liveRace!;
      const shown = store().raceTimeline!;
      expect(isRaceFinished(interrupted)).toBe(false);
      expect(interrupted.moments).toHaveLength(2);
      // As respostas ficam nos comandos gravados, cada uma na volta do seu lance; as demais voltas não levam resposta.
      expect(store().raceSteps).toEqual(steps);
      const answeredLaps = steps.flatMap((step, index) => ('moment' in step ? [index + 1] : []));
      expect(answeredLaps).toEqual(interrupted.moments.map((m) => m.lap));
      expect(answeredLaps.map((n) => steps[n - 1]!.moment)).toEqual(answers.slice(0, 2));

      // "Recarrega": a corrida ao vivo some, o save volta para antes da largada e o registro é oferecido.
      store().exitToMenu();
      await store().importJson(exportCareer(weekend, NOW));
      expect(store().liveRace).toBeNull();
      const record = store().raceResume!;
      expect(record.steps).toEqual(steps);

      // "Continuar": a mesma corrida, com os mesmos lances já resolvidos, a mesma pergunta à espera (se
      // havia uma) e a mesma linha do tempo da transmissão.
      store().resumeRace(false);
      expect(store().liveRace).toEqual(interrupted);
      expect(store().liveRace!.pendingMoment).toEqual(interrupted.pendingMoment);
      expect(store().raceSteps).toEqual(steps);
      expect(store().raceTimeline).toEqual(shown);

      // "Ver resultado", a partir do mesmo registro: o que já foi respondido vale, e o resto o piloto decide.
      useGameStore.setState({ liveRace: null, raceTimeline: null, raceResume: record });
      store().resumeRace(true);
      const toTheEnd = store().liveRace!;
      expect(toTheEnd).toEqual(simulateRemainingRace(interrupted, context, { mode: 'balanced', auto: true }));
      expect(toTheEnd.moments.slice(0, 2)).toEqual(interrupted.moments);
      expect(toTheEnd.moments.slice(2).every((m) => m.auto)).toBe(true);

      // De volta ao ponto da interrupção, o jogador segue respondendo até a bandeirada: o resultado bate com a referência.
      useGameStore.setState({ liveRace: null, raceTimeline: null, raceResume: record });
      store().resumeRace(false);
      while (!isRaceFinished(store().liveRace!)) lap();
      expect(store().liveRace).toEqual(reference);
      expect(store().raceSteps).toEqual(steps);
      store().completeWeekend();
      const expected = completeWeekend(loaded, reference);
      expect(store().career!.rounds).toEqual(expected.rounds);
      expect(store().career!.rounds.at(-1)!.race.moments).toEqual(reference.moments);
      expect(store().career!.relations).toEqual(expected.relations);
      expect(loadRaceResume(loaded)).toBeNull();
    },
  );
});
