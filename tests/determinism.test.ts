/**
 * Mesma semente + mesmas escolhas = mesmo resultado.
 *
 * Toda a sorte do jogo sai de `src/engine/rng.ts`, a partir da semente gravada no save. Estes
 * testes travam as duas metades dessa promessa: o comportamento (carreiras repetidas dão o mesmo
 * estado, recarregar não muda a sorte, só uma decisão diferente muda o desfecho) e o código
 * (nenhum outro arquivo sorteia, lê o relógio ou ordena pelo idioma do aparelho).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { compareText } from '@/domain/text';
import { createRng, hashSeed, randomSeed, textHash, textHash01 } from '@/engine/rng';
import { checksumOf } from '@/persistence/checksum';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { simulateCareer } from '../sim/run';
import * as engine from './engineApi';
import { DEFAULT_INPUT, NOW, botCareer, botTraining, newCareer, pickBestOffer, playLife, playRound, resolvePending, type Choices } from './helpers';

/** Joga `rounds` etapas com o robô e devolve o checksum do estado depois de cada uma. */
function trail(career: CareerState, rounds: number, choices: Choices = {}): { career: CareerState; sums: string[] } {
  let c = career;
  const sums: string[] = [];
  for (let i = 0; i < rounds; i++) {
    if (c.offseason) c = engine.startNextSeason(c, pickBestOffer(c));
    c = playRound(c, choices);
    sums.push(checksumOf(c));
  }
  return { career: c, sums };
}

/** Grava e abre de novo, como faz o jogador que fecha o jogo e volta: o save passa por todo o caminho de leitura. */
const reload = (career: CareerState): CareerState => importCareer(exportCareer(career, NOW));

describe('mesma semente e mesmas escolhas', () => {
  it('dão o mesmo estado, etapa por etapa', () => {
    const first = trail(botCareer(2024, 4), 14);
    const second = trail(botCareer(2024, 4), 14);
    expect(second.sums).toEqual(first.sums);
    expect(second.career).toEqual(first.career);
  });

  it('dão a mesma carreira inteira no simulador', () => {
    const options = { seasons: 4, talent: 4 };
    expect(simulateCareer(77, options)).toEqual(simulateCareer(77, options));
  });

  it('passam pelas mesmas aposentadoria, vida de dirigente e sucessão', () => {
    const life = () => playLife(botCareer(5, 8), 12, { retireAge: 19, buyTeam: true, handoverAge: 22 });
    const first = life();
    expect(first.mode).toBe('executive');
    expect(first.dynasty.generation).toBeGreaterThanOrEqual(2);
    expect(checksumOf(life())).toBe(checksumOf(first));
  }, 120_000);
});

describe('o que muda o resultado', () => {
  it('outra semente dá outra carreira', () => {
    expect(trail(newCareer(1), 3).sums).not.toEqual(trail(newCareer(2), 3).sums);
    expect(simulateCareer(1, { seasons: 2, talent: 0 })).not.toEqual(simulateCareer(2, { seasons: 2, talent: 0 }));
  });

  it('uma escolha diferente muda o desfecho, e só ela: a sorte dos outros sorteios é a mesma', () => {
    const start = engine.startWeekend(resolvePending(newCareer(909)));
    const setup = engine.runPractice(start, 'setup');
    const longRun = engine.runPractice(start, 'longRun');
    // O jogador mudou o próprio treino...
    const mine = (c: CareerState) => c.weekend?.practice?.entries.find((e) => e.driverId === c.playerDriverId);
    expect(mine(longRun)).not.toEqual(mine(setup));
    // ...e os rivais fizeram exatamente os mesmos tempos nas duas versões da história.
    const rivals = (c: CareerState) => c.weekend?.practice?.entries.filter((e) => e.driverId !== c.playerDriverId).map((e) => [e.driverId, e.bestLap]);
    expect(rivals(longRun)).toEqual(rivals(setup));
    // O clima das etapas seguintes já estava sorteado e não muda com a escolha.
    expect(longRun.calendar).toEqual(setup.calendar);
    // Repetir a mesma escolha depois de recarregar devolve o mesmo treino: não dá para "rolar de novo".
    expect(engine.runPractice(reload(start), 'setup').weekend).toEqual(setup.weekend);
  });

  it('o ritmo de corrida escolhido muda a corrida do jogador', () => {
    const before = engine.runQualifying(engine.runPractice(engine.startWeekend(resolvePending(newCareer(909))), 'setup'), 'balanced');
    const race = (mode: 'conservative' | 'aggressive') =>
      engine.finalizeRace(
        engine.simulateRemainingRace(engine.createWeekendRace(before), engine.buildRaceContext(before), { mode, auto: true }),
        engine.getCategory(before.categoryId),
      );
    expect(race('aggressive')).toEqual(race('aggressive'));
    expect(race('aggressive').entries).not.toEqual(race('conservative').entries);
  });
});

describe('recarregar o save não muda a sorte', () => {
  it('gravar e abrir em cada passo dá a mesma temporada que jogar direto', () => {
    const straight = trail(botCareer(31, 6), 10);

    let c = botCareer(31, 6);
    const sums: string[] = [];
    for (let round = 0; round < 10; round++) {
      c = reload(engine.startWeekend(reload(resolvePending(reload(c)))));
      if (c.weekend?.playerParticipates) {
        c = reload(engine.runPractice(c, 'setup'));
        c = reload(engine.runQualifying(c, 'balanced'));
        const finished = engine.simulateRemainingRace(engine.createWeekendRace(c), engine.buildRaceContext(c), { mode: 'balanced', auto: true });
        c = engine.completeWeekend(c, finished);
      } else c = engine.simulateAbsentWeekend(c);
      // A data da última gravação é a única coisa que a recarga carimba; fora dela, o estado é o mesmo.
      sums.push(checksumOf({ ...c, updatedAt: straight.career.updatedAt }));
    }
    expect(sums).toEqual(straight.sums);

    // E a virada de temporada, depois de mais uma recarga, cai na mesma temporada seguinte.
    const next = (career: CareerState) => engine.startNextSeason(career, pickBestOffer(career));
    const a = next(straight.career);
    const b = next(reload(c));
    expect(checksumOf({ ...b, updatedAt: a.updatedAt })).toBe(checksumOf(a));
  }, 120_000);

  it('a corrida volta a volta, com os mesmos comandos, é igual à simulada de uma vez', () => {
    const c = engine.runQualifying(engine.runPractice(engine.startWeekend(resolvePending(botTraining(newCareer(64)))), 'setup'), 'balanced');
    const context = engine.buildRaceContext(c);
    let lapByLap = engine.createWeekendRace(c);
    while (!engine.isRaceFinished(lapByLap)) lapByLap = engine.stepRaceLap(lapByLap, context, { mode: 'balanced', auto: true, pit: null });
    const atOnce = engine.simulateRemainingRace(engine.createWeekendRace(c), context, { mode: 'balanced', auto: true });
    expect(checksumOf(lapByLap)).toBe(checksumOf(atOnce));
  });
});

describe('a semente', () => {
  it('de uma carreira nova é um inteiro de 32 bits, diferente a cada vez', () => {
    const seeds = Array.from({ length: 24 }, () => randomSeed());
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('fica gravada na carreira e não muda ao longo dela', () => {
    const career = newCareer(4242);
    expect(career.seed).toBe(4242);
    expect(trail(career, 2).career.seed).toBe(4242);
    expect(reload(career).seed).toBe(4242);
  });

  it('inválida é recusada na criação da carreira', () => {
    for (const seed of [-1, 1.5, 0x1_0000_0000, Number.NaN]) expect(() => engine.createCareer(DEFAULT_INPUT, seed, NOW)).toThrow(/Semente inválida/);
    expect(engine.createCareer(DEFAULT_INPUT, 0xffffffff, NOW).seed).toBe(0xffffffff);
  });

  it('deriva sementes estáveis para cada sorteio', () => {
    // Valores fixos: se mudarem, todas as carreiras em andamento mudam de sorte.
    expect(hashSeed(12345, 1, 1, 'race')).toBe(hashSeed(12345, 1, 1, 'race'));
    expect([hashSeed(12345, 1, 1, 'race'), hashSeed(1, 'driver', 'x'), createRng(42).next()]).toMatchInlineSnapshot(`
      [
        4144893361,
        3430742682,
        0.6011037519201636,
      ]
    `);
  });
});

describe('aparência estável', () => {
  it('o número tirado de um texto é o mesmo em qualquer lugar', () => {
    // Cor de detalhe, capacete e pintura saem daqui: mudar estes valores muda a cara das equipes.
    expect([textHash('accent|vortex'), textHash('helmet|player'), textHash('pattern|cerrado')]).toMatchInlineSnapshot(`
      [
        3160229628,
        3759114681,
        146866083,
      ]
    `);
    expect(textHash01('lane|player')).toBeGreaterThanOrEqual(0);
    expect(textHash01('lane|player')).toBeLessThan(1);
    expect(textHash01('lane|player')).toBe(textHash('lane|player') / 4294967296);
  });

  it('o desempate por id não depende do idioma do aparelho', () => {
    // Pela ordem do alfabeto tcheco, "ch" vem depois de "h"; pela ordem fixa de caracteres, não.
    expect(['rodrigo', 'chaves', 'hugo', 'rocha', 'f1-b', 'f1-a', 'F'].sort(compareText)).toEqual(['F', 'chaves', 'f1-a', 'f1-b', 'hugo', 'rocha', 'rodrigo']);
    expect(compareText('a', 'a')).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Guarda do código                                                    */
/* ------------------------------------------------------------------ */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** O código sem os comentários (para um comentário que cite `Math.random` não disparar o alarme). */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function occurrences(dirs: readonly string[], pattern: RegExp, allowed: readonly string[] = []): string[] {
  return dirs
    .flatMap(sourceFiles)
    .filter((path) => !allowed.includes(path))
    .flatMap((path) =>
      withoutComments(readFileSync(path, 'utf8'))
        .split('\n')
        .flatMap((line, index) => (pattern.test(line) ? [`${path}:${index + 1}: ${line.trim().slice(0, 100)}`] : [])),
    );
}

/** Onde mora a lógica do jogo: nada aqui pode depender de acaso solto, do relógio ou do aparelho. */
const LOGIC = ['src/engine', 'src/data', 'src/domain', 'src/persistence', 'sim'];

describe('guarda: o gerador com semente é a única fonte de acaso', () => {
  it('não há Math.random em lugar nenhum do jogo nem do simulador', () => {
    expect(occurrences(['src', 'sim'], /Math\s*\.\s*random/)).toEqual([]);
  });

  it('o acaso de verdade (crypto) só existe na criação da semente', () => {
    expect(occurrences(['src', 'sim'], /\bcrypto\b|getRandomValues|randomUUID/, ['src/engine/rng.ts'])).toEqual([]);
  });

  it('não há outro gerador nem outro hash de sorteio fora de src/engine/rng.ts', () => {
    // As constantes do mulberry32 e do FNV-1a: quem as repete está reimplementando o gerador.
    expect(occurrences(['src', 'sim'], /0x6d2b79f5|0x811c9dc5|0x01000193/i, ['src/engine/rng.ts'])).toEqual([]);
  });

  it('a lógica do jogo não lê o relógio', () => {
    // A linha de comando do simulador mede o tempo gasto, mas só o escreve na saída de erro.
    expect(occurrences(LOGIC, /Date\.now\s*\(|new Date\(\s*\)|performance\.now\s*\(/, ['sim/cli.ts'])).toEqual([]);
  });

  it('a lógica do jogo não ordena pelo idioma do aparelho', () => {
    expect(occurrences(LOGIC, /localeCompare\s*\(|Intl\.Collator/)).toEqual([]);
  });

  it('o motor roda sem navegador: não toca em window, document nem armazenamento', () => {
    expect(
      occurrences(['src/engine', 'src/data', 'src/domain', 'sim'], /\b(window|document|localStorage|sessionStorage|indexedDB|navigator)\b\s*[.[]/),
    ).toEqual([]);
  });
});
