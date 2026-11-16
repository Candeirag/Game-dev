/** Linha de comando do simulador: lê os argumentos, roda as carreiras e escreve o relatório. */
import { writeFileSync } from 'node:fs';
import { CAREER_SCHEMA_VERSION } from '@/domain/schemas';
import { formatReport } from './report';
import { DEFAULT_SIM_OPTIONS, type SimOptions, type SimResult, runSimulation } from './run';

export interface CliOptions extends SimOptions {
  /** Escreve os dados completos (uma linha por temporada de cada carreira) em JSON, no lugar do relatório. */
  json: boolean;
  /** Arquivo em que o relatório (ou o JSON) também é gravado. */
  out: string | null;
  help: boolean;
}

export const HELP = `Simulador de carreiras do Apex Motorsport Dynasty.

Uso: npm run sim -- [opções]

  --seeds N        quantas carreiras simular (padrão: ${DEFAULT_SIM_OPTIONS.seeds})
  --seasons N      temporadas por carreira (padrão: ${DEFAULT_SIM_OPTIONS.seasons})
  --first-seed N   semente da primeira carreira (padrão: ${DEFAULT_SIM_OPTIONS.firstSeed})
  --talent N       bônus de talento do piloto, de 0 a 12 (padrão: ${DEFAULT_SIM_OPTIONS.talent}; 4 = bom jogador, 8 = excelente)
  --json           escreve os dados completos em JSON, no lugar do relatório
  --out ARQUIVO    grava também a saída neste arquivo
  --help           mostra esta ajuda

O relatório vai para a saída padrão e é sempre o mesmo para os mesmos argumentos.
O progresso e o tempo gasto vão para a saída de erro.
`;

const LIMITS = {
  seeds: [1, 5000],
  seasons: [1, 80],
  firstSeed: [0, 0xffffffff],
  talent: [0, 12],
} as const;

const NUMERIC: Readonly<Record<string, keyof typeof LIMITS>> = {
  '--seeds': 'seeds',
  '--seasons': 'seasons',
  '--first-seed': 'firstSeed',
  '--talent': 'talent',
};

/** Interpreta os argumentos. Lança um erro com a explicação se algum for inválido. */
export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_SIM_OPTIONS, json: false, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    // Aceita "--seeds 50" e "--seeds=50".
    const [name = '', inline] = arg.split('=', 2);
    const value = () => {
      const next = inline ?? argv[++i];
      if (next === undefined) throw new Error(`Falta o valor de ${name}.`);
      return next;
    };
    const key = NUMERIC[name];
    if (key) {
      const text = value();
      const number = Number(text);
      const [min, max] = LIMITS[key];
      if (!Number.isInteger(number) || number < min || number > max)
        throw new Error(`${name} precisa ser um número inteiro de ${min} a ${max} (veio "${text}").`);
      options[key] = number;
    } else if (name === '--json') options.json = true;
    else if (name === '--out') options.out = value();
    else if (name === '--help' || name === '-h') options.help = true;
    else throw new Error(`Opção desconhecida: ${arg}. Use --help para ver as opções.`);
  }
  if (options.firstSeed + options.seeds - 1 > LIMITS.firstSeed[1]) throw new Error('As sementes passam do limite de 32 bits.');
  return options;
}

export interface CliStreams {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** Roda a linha de comando e devolve o código de saída: 0 = certo, 1 = uma carreira quebrou, 2 = argumento inválido. */
export function runCli(argv: readonly string[], streams: CliStreams, simulate: typeof runSimulation = runSimulation): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    streams.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  if (options.help) {
    streams.out(HELP);
    return 0;
  }
  const { json, out, help: _help, ...sim } = options;
  const started = performance.now();
  let result: SimResult;
  try {
    result = simulate(sim, (done, total) => {
      if (done % 10 === 0 || done === total) streams.err(`  ${done}/${total} carreiras\n`);
    });
  } catch (error) {
    // Uma regra quebrada no motor aparece aqui: a mensagem traz a semente e a temporada para reproduzir.
    streams.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const text = json ? `${JSON.stringify(result, null, 1)}\n` : formatReport(result.summary);
  streams.out(text);
  if (out) writeFileSync(out, text);
  const seconds = (performance.now() - started) / 1000;
  streams.err(
    `${result.summary.careers} carreiras, ${result.summary.seasonsPlayed} temporadas em ${seconds.toFixed(1).replace('.', ',')} s · jogo ${__APP_VERSION__}, save v${CAREER_SCHEMA_VERSION}${out ? ` · gravado em ${out}` : ''}\n`,
  );
  return 0;
}
