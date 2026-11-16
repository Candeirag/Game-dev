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
    // O clima das etapas seguintes já estava sorteado: jogar a etapa inteira com escolhas opostas não o muda.
    const cautious = playRound(newCareer(909), { program: 'setup', approach: 'balanced', mode: 'conservative' });
    const bold = playRound(newCareer(909), { program: 'longRun', approach: 'attack', mode: 'aggressive' });
    expect(checksumOf(bold)).not.toBe(checksumOf(cautious));
    expect(bold.calendar).toEqual(cautious.calendar);
    expect(bold.calendar).not.toBe(cautious.calendar);
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
    return /\.[cm]?[jt]sx?$/.test(name) ? [path] : [];
  });
}

/**
 * O código sem os comentários (para um comentário que cite `Math.random` não disparar o alarme),
 * com as mesmas linhas do arquivo. Textos, modelos de texto e expressões regulares são copiados
 * inteiros: um "//" ou "/*" dentro deles não é comentário e não pode esconder o código que vem depois.
 */
function withoutComments(source: string): string {
  let out = '';
  let i = 0;
  /** Último caractere de código que não é espaço: decide se uma barra abre uma expressão regular. */
  let last = '';
  /** Fim de um literal que começa em `start` (aspas, crase ou barra de expressão regular). */
  const literalEnd = (start: number): number => {
    const quote = source[start];
    let inClass = false;
    for (let j = start + 1; j < source.length; j++) {
      const c = source[j];
      if (c === '\\') j++;
      else if (quote !== '`' && c === '\n') return j;
      else if (quote === '`' && c === '$' && source[j + 1] === '{') j = codeEnd(j + 2, '}');
      else if (quote === '/' && c === '[') inClass = true;
      else if (quote === '/' && c === ']') inClass = false;
      else if (c === quote && !inClass) return j + 1;
    }
    return source.length;
  };
  /** Índice do `close` que fecha o trecho de código iniciado em `start` (dentro de `${…}`). */
  const codeEnd = (start: number, close: string): number => {
    let depth = 0;
    for (let j = start; j < source.length; j++) {
      const c = source[j];
      if (c === '"' || c === "'" || c === '`') j = literalEnd(j) - 1;
      else if (c === '{') depth++;
      else if (c === close && depth-- === 0) return j;
    }
    return source.length;
  };
  while (i < source.length) {
    const c = source[i] ?? '';
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, '');
      i = stop;
    } else if (c === '"' || c === "'" || c === '`' || (c === '/' && (last === '' || '(,=:[!&|?{};+-*%<>~^'.includes(last)))) {
      const stop = literalEnd(i);
      out += source.slice(i, stop);
      i = stop;
      last = 'x';
    } else {
      out += c;
      if (c.trim()) last = c;
      i++;
    }
  }
  return out;
}

const matches = (source: string, pattern: RegExp): string[] =>
  withoutComments(source)
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [`${index + 1}: ${line.trim().slice(0, 100)}`] : []));

function occurrences(dirs: readonly string[], pattern: RegExp, allowed: readonly string[] = []): string[] {
  return dirs
    .flatMap(sourceFiles)
    .filter((path) => !allowed.includes(path))
    .flatMap((path) => matches(readFileSync(path, 'utf8'), pattern).map((found) => `${path}:${found}`));
}

/** Onde mora a lógica do jogo: nada aqui pode depender de acaso solto, do relógio ou do aparelho. */
const LOGIC = ['src/engine', 'src/data', 'src/domain', 'src/config', 'src/persistence', 'sim'];

const RANDOM = /Math\s*(\.\s*random|\[\s*['"`]random)|\brandom\s*[,}][^;]*=\s*Math\b/;
/** O relógio: `Date.now`, `new Date()` sem argumentos, `Date()` e tudo de `performance`. Data montada de um número fixo pode. */
const CLOCK = /\bDate\s*\.\s*now\b|\bnew\s+Date\b(?!\s*\(\s*[^\s)])|(?<![.\w])Date\s*\(\s*\)|\bperformance\s*\./;
/** Leituras de data no fuso do aparelho: o mesmo instante daria dias diferentes em lugares diferentes. */
const LOCAL_TIME = /\.\s*(get(Day|Date|Month|FullYear|Hours|Minutes|Seconds|TimezoneOffset)|toLocale(Date|Time)String)\s*\(/;
/** O idioma do aparelho: ordenação, caixa e formatação sem idioma fixo (`toLocaleString('pt-BR')` pode). */
const DEVICE_LOCALE = /localeCompare|toLocale(Lower|Upper)Case|\bIntl\s*\.\s*\w+\s*\(\s*\)|toLocaleString\s*\(\s*\)/;

describe('a guarda enxerga o que precisa', () => {
  const found = (code: string, pattern: RegExp) => matches(code, pattern).length > 0;

  it('ignora comentários, e só eles: código depois de "//" ou "/*" dentro de um texto continua à vista', () => {
    expect(found('// Math.random() aqui é só conversa', RANDOM)).toBe(false);
    expect(found('/** nada de Math.random()\n * nem de Date.now() */ const a = 1;', RANDOM)).toBe(false);
    expect(found("const sep = 'a//b'; const r = Math.random();", RANDOM)).toBe(true);
    expect(found('const ok = /^\\/\\//.test(p) && Math.random() < 0.5;', RANDOM)).toBe(true);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: é o código de exemplo que a guarda lê.
    expect(found('const u = `${base}//x`; const r = Math.random();', RANDOM)).toBe(true);
    expect(found("const glob = 'src/*.ts';\nconst r = Math.random();\n/** fim */", RANDOM)).toBe(true);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: é o código de exemplo que a guarda lê.
    expect(found('const t = `${a ? `x//y` : "z"}`; const r = Math.random();', RANDOM)).toBe(true);
    expect(found('const ratio = total / count; // Math.random', RANDOM)).toBe(false);
  });

  it('diz a linha certa do arquivo, mesmo depois de um cabeçalho de várias linhas', () => {
    expect(matches('/**\n * cabeçalho\n * de três linhas\n */\nconst a = 1;\nconst r = Math.random();', RANDOM)).toEqual(['6: const r = Math.random();']);
  });

  it('reconhece as formas de sortear, ler o relógio e depender do aparelho', () => {
    for (const code of ['Math.random()', "Math['random']()", 'const { random } = Math;']) expect(found(code, RANDOM), code).toBe(true);
    for (const code of [
      'Date.now()',
      'const now = Date.now;',
      'new Date()',
      'new Date',
      '+new Date;',
      'const text = Date();',
      'performance.now()',
      'performance.timeOrigin',
    ])
      expect(found(code, CLOCK), code).toBe(true);
    for (const code of ['new Date(start + i * 86_400_000)', 'Date.UTC(year, 2, 8)', 'Date.parse(value)', 'const updatedAt = now;'])
      expect(found(code, CLOCK), code).toBe(false);
    for (const code of ['date.getDay()', 'd.getTimezoneOffset()', 'date.toLocaleDateString()']) expect(found(code, LOCAL_TIME), code).toBe(true);
    for (const code of [
      'a.localeCompare(b)',
      'name.toLocaleLowerCase()',
      'value.toLocaleString()',
      'new Intl.NumberFormat()',
      'Intl.DateTimeFormat().resolvedOptions()',
    ])
      expect(found(code, DEVICE_LOCALE), code).toBe(true);
    for (const code of ["value.toLocaleString('pt-BR')", "new Intl.NumberFormat('pt-BR')", 'date.toISOString()'])
      expect(found(code, DEVICE_LOCALE), code).toBe(false);
  });
});

describe('guarda: o gerador com semente é a única fonte de acaso', () => {
  it('não há Math.random em lugar nenhum do jogo nem do simulador', () => {
    expect(occurrences(['src', 'sim'], RANDOM)).toEqual([]);
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
    expect(occurrences(LOGIC, CLOCK, ['sim/cli.ts'])).toEqual([]);
    expect(occurrences(LOGIC, LOCAL_TIME)).toEqual([]);
  });

  it('a lógica do jogo não ordena nem formata pelo idioma do aparelho', () => {
    expect(occurrences(LOGIC, DEVICE_LOCALE)).toEqual([]);
  });

  it('o motor não lê feature flags nem variáveis do build: regra de jogo não depende de loja, anúncio ou versão paga', () => {
    expect(occurrences(['src/engine', 'src/data', 'src/domain', 'sim'], /config\/featureFlags|import\s*\.\s*meta\s*\.\s*env/)).toEqual([]);
  });

  it('o motor roda sem navegador: não toca em window, document nem armazenamento', () => {
    expect(
      occurrences(['src/engine', 'src/data', 'src/domain', 'sim'], /\b(window|document|localStorage|sessionStorage|indexedDB|navigator)\b\s*[.[]/),
    ).toEqual([]);
  });
});
