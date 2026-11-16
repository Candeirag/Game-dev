/**
 * Números de equilíbrio moram em tabela com nome. As tabelas novas entram em
 * `src/config/balance.ts`; as que já existiam estão mapeadas lá (BALANCE_TABLES). Este teste
 * mantém o mapa honesto: tudo o que ele cita existe, e nenhuma constante exportada do motor ou
 * dos dados fica de fora sem estar na lista do que não é balanceamento.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BALANCE_TABLES } from '@/config/balance';

const MODULES = import.meta.glob<Record<string, unknown>>(['/src/data/**/*.ts', '/src/engine/**/*.ts']);

/** Constantes exportadas que não são balanceamento: nomes e textos, ids, limites de armazenamento e aparência. */
const NOT_BALANCE = new Set([
  // Nomes e textos.
  'NAME_POOLS',
  'NATIONALITIES',
  'F1_TEAM_NAMES',
  'TEAM_SPONSOR_NAMES',
  'STAFF_FIRST_NAMES',
  'STAFF_LAST_NAMES',
  'PARTNER_FIRST_NAMES',
  'PARTNER_LAST_NAMES',
  'CHILD_FIRST_NAMES',
  'STAFF_ROLE_EFFECTS',
  'FACILITY_INFO',
  // Ids e estrutura.
  'PLAYER_DRIVER_ID',
  'ROOKIE_SEAT_DRIVER',
  'TRAINABLE_ATTRIBUTES',
  'FIRST_SEASON_YEAR',
  // Tamanho do save, não regra de jogo.
  'INBOX_LIMIT',
  'FULL_HISTORY_SEASONS',
  // Aparência: tamanho dos veículos e desenho das pistas na transmissão.
  'VEHICLES',
  'CIRCUIT',
  // Arquivos gerados pelos scripts de importação de traçados.
  'CIRCUIT_LAYOUTS',
  'KART_LAYOUTS',
  'KART_LAYOUTS_CREDIT',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : name.endsWith('.ts') ? [path] : [];
  });
}

describe('configuração de balanceamento', () => {
  it('toda tabela do mapa existe no módulo indicado', async () => {
    for (const [path, names] of Object.entries(BALANCE_TABLES)) {
      const load = MODULES[`/${path}`];
      expect(load, `${path} não existe`).toBeDefined();
      const module = await load!();
      for (const name of names) expect(module[name], `${path} não exporta ${name}`).toBeDefined();
    }
  });

  it('nenhuma tabela aparece duas vezes no mapa', () => {
    const names = Object.values(BALANCE_TABLES).flat();
    expect(new Set(names).size).toBe(names.length);
  });

  it('toda constante exportada do motor e dos dados está no mapa ou na lista do que não é balanceamento', () => {
    const mapped = new Set(Object.entries(BALANCE_TABLES).flatMap(([path, names]) => names.map((name) => `${path}:${name}`)));
    const missing = ['src/data', 'src/engine'].flatMap(sourceFiles).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/^export const ([A-Z][A-Z0-9_]{2,})\b/gm)]
        .map((match) => match[1] ?? '')
        .filter((name) => !NOT_BALANCE.has(name) && !mapped.has(`${path}:${name}`))
        .map((name) => `${path}: ${name} (número de equilíbrio novo vai em src/config/balance.ts; tabela antiga entra em BALANCE_TABLES)`),
    );
    expect(missing).toEqual([]);
  });

  it('a configuração não importa o motor (para o motor poder importá-la)', () => {
    expect(readFileSync('src/config/balance.ts', 'utf8')).not.toMatch(/from ['"]@\/engine|from ['"]\.\.\/engine/);
  });
});
