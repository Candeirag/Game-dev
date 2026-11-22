/** Linha de comando do simulador: lê os argumentos, roda as carreiras e escreve o relatório. */
import { accessSync, constants, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { counted } from '@/domain/text';
import { CAREER_SCHEMA_VERSION } from '@/domain/schemas';
import type { MomentPolicy } from './policy';
import { formatReport } from './report';
import { DEFAULT_SIM_OPTIONS, type SimOptions, type SimResult, runSimulation } from './run';

/** As políticas de lances que `--moments` aceita, na ordem em que a ajuda as mostra. */
const MOMENT_POLICIES: readonly MomentPolicy[] = ['style', 'safe', 'bold'];

export interface CliOptions extends Required<SimOptions> {
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
  --moments P      como o robô responde aos lances decisivos: ${MOMENT_POLICIES.join(', ')} (padrão: ${DEFAULT_SIM_OPTIONS.moments};
                   style = não responde, o estilo do piloto decide; safe = sempre a opção
                   mais segura; bold = sempre a mais arriscada)
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
    // Aceita "--seeds 50" e "--seeds=50" (o valor é tudo o que vem depois do primeiro "=").
    const equals = arg.indexOf('=');
    const name = equals < 0 ? arg : arg.slice(0, equals);
    const inline = equals < 0 ? undefined : arg.slice(equals + 1);
    const value = () => {
      const next = inline ?? argv[++i];
      // Sem valor, com valor vazio ou com outra opção no lugar do valor ("--out --json").
      if (next === undefined || next === '' || (inline === undefined && next.startsWith('--'))) throw new Error(`Falta o valor de ${name}.`);
      return next;
    };
    const key = NUMERIC[name];
    if (key) {
      const text = value();
      const number = Number(text);
      const [min, max] = LIMITS[key];
      // Só algarismos: "0x2", "1e0" e " 5" não são o que parecem.
      if (!/^\d+$/.test(text) || number < min || number > max) throw new Error(`${name} precisa ser um número inteiro de ${min} a ${max} (veio "${text}").`);
      options[key] = number;
    } else if (name === '--moments') {
      const text = value();
      const policy = MOMENT_POLICIES.find((p) => p === text);
      if (!policy) throw new Error(`${name} precisa ser ${MOMENT_POLICIES.slice(0, -1).join(', ')} ou ${MOMENT_POLICIES.at(-1)} (veio "${text}").`);
      options.moments = policy;
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

/** Confere, antes de gastar o tempo da simulação, que dá para gravar no arquivo pedido. */
function checkWritable(file: string): void {
  const directory = dirname(resolve(file));
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`a pasta ${directory} não existe`);
  accessSync(directory, constants.W_OK);
  if (statSync(file, { throwIfNoEntry: false })?.isDirectory()) throw new Error('o destino é uma pasta');
}

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Roda a linha de comando e devolve o código de saída: 0 = certo, 1 = uma carreira quebrou,
 * 2 = argumento inválido (inclusive um arquivo de saída em que não dá para gravar).
 */
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
  if (out) {
    try {
      checkWritable(out);
    } catch (error) {
      streams.err(`Não dá para gravar em ${out}: ${reason(error)}.\n`);
      return 2;
    }
  }
  const started = performance.now();
  let result: SimResult;
  try {
    result = simulate(sim, (done, total) => {
      if (done % 10 === 0 || done === total) streams.err(`  ${done}/${counted(total, 'carreira', 'carreiras')}\n`);
    });
  } catch (error) {
    // Uma regra quebrada no motor aparece aqui: a mensagem traz a semente e a temporada para reproduzir.
    streams.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const text = json ? `${JSON.stringify(result, null, 1)}\n` : formatReport(result.summary);
  streams.out(text);
  if (out) {
    try {
      writeFileSync(out, text);
    } catch (error) {
      streams.err(`Não dá para gravar em ${out}: ${reason(error)}.\n`);
      return 2;
    }
  }
  const seconds = (performance.now() - started) / 1000;
  streams.err(
    `${counted(result.summary.careers, 'carreira', 'carreiras')}, ${counted(result.summary.seasonsPlayed, 'temporada', 'temporadas')} em ${seconds.toFixed(1).replace('.', ',')} s · jogo ${__APP_VERSION__}, save v${CAREER_SCHEMA_VERSION}${out ? ` · gravado em ${out}` : ''}\n`,
  );
  return 0;
}
