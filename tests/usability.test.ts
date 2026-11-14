/**
 * Rodada de usabilidade: moeda pela nacionalidade, plurais e retomada de uma
 * corrida interrompida. Nada aqui muda regra ou número; os testes conferem
 * justamente que só o texto mudou e que a corrida refeita é a mesma.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { currencyForNationality, formatMoney, relabelMoney } from '@/domain/money';
import { counted, fixStoredPlurals, pluralWord } from '@/domain/text';
import { importCareer, exportCareer } from '@/persistence/saveService';
import { loadRaceResume, raceResumeKey } from '@/persistence/raceResume';
import { careerCurrency, money, runPractice, runQualifying, startWeekend } from './engineApi';
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

    // Corre seis voltas mudando o ritmo, como o jogador faria pela barra fixa.
    store().beginRace();
    const modes = ['balanced', 'aggressive', 'aggressive', 'conservative', 'balanced', 'aggressive'] as const;
    for (const mode of modes) {
      store().setRaceMode(mode);
      store().stepRace();
    }
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
        steps: modes.map((mode) => ({ mode, pit: null, skipPlannedStop: false, auto: false })),
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
    store().stepRace();
    store().stepRace();
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
});
