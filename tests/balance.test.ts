/**
 * Números de equilíbrio moram em tabela com nome. As tabelas novas entram em
 * `src/config/balance.ts`; as que já existiam estão mapeadas lá (BALANCE_TABLES). Este teste
 * mantém o mapa honesto: tudo o que ele cita existe, e nenhuma constante exportada do motor ou
 * dos dados fica de fora sem estar na lista do que não é balanceamento. Constantes de módulo sem
 * `export` têm uma lista congelada: as que já existiam ficam, uma nova faz o teste falhar. O teste
 * só enxerga constantes com nome em maiúsculas; número solto no meio de uma conta ele não vê.
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
  // Nascimento (Fase 2): cidades, profissões, aptidões, traços e origens. A faixa de renda de cada
  // profissão é só uma categoria; o dinheiro de cada faixa está em BIRTH, em src/config/balance.ts.
  'HOMETOWNS',
  'MOTHER_PROFESSIONS',
  'FATHER_PROFESSIONS',
  'APTITUDE_INFO',
  'APTITUDE_ORDER',
  'BIRTH_TRAITS',
  'BIRTH_ORIGIN_INFO',
  'BIRTH_ORIGIN_ORDER',
  // Polos e portas (Fase 3 da grande atualização): nomes e o mapa campeonato → polo. Os custos estão
  // em HUB_RULES, RUNNING_COSTS, INVESTOR… em src/config/balance.ts.
  'HUBS',
  'CATEGORY_HUB',
  'RENTAL_CATEGORY',
  'INVESTOR_NAMES',
  'SIDE_JOB_INFO',
  // Lances decisivos e rádio do engenheiro (Fase 4): só as palavras. As chances, os ganhos e as
  // perdas estão em RACE_MOMENTS, TYRE_CURVE e ENGINEER_RADIO, em src/config/balance.ts.
  'MOMENT_TEXTS',
  'MOMENT_CONSEQUENCE_TEXTS',
  'RADIO_TEXTS',
  // Eventos encadeados (Fase 5): os dados dos cartões, das cadeias e dos patrocinadores, e os nomes
  // das pessoas. Só palavras e chaves: tamanhos, chances, prazos e faixas têm nome, e os números
  // estão em STORY_EVENTS e SPONSOR_PROFILE_RULES, em src/config/balance.ts.
  'STORY_EVENT_CATALOG',
  'STORY_CHAINS',
  'TRACK_EVENTS',
  'TRACK_TECH_EVENTS',
  'CAREER_EVENTS',
  'MONEY_EVENTS',
  'HEALTH_EVENTS',
  'PERSONAL_EVENTS',
  'TOP_EVENTS',
  'CHAINS_A',
  'CHAINS_B',
  'CHAINS_C',
  'SPONSOR_PROFILES',
  'STORY_FIRST_NAMES',
  'STORY_LAST_NAMES',
  // Textos dos eventos de família em variantes (Fase 5): só palavras; os valores chegam prontos.
  'FAMILY_EVENT_TEXTS',
  // Herança (Fase 6): os vereditos do teste no kart e os textos deles. As faixas de cada veredito
  // estão em HERITAGE, em src/config/balance.ts.
  'KART_TEST_VERDICT_IDS',
  'KART_TEST_VERDICT_INFO',
  // Dinastia (Fase 6): os nomes dos caminhos dos parentes e dos papéis de quem passou o comando em
  // vida. Os números estão em RELATIVES, em src/config/balance.ts.
  'RELATIVE_PATH_INFO',
  'ELDER_ROLE_INFO',
  // Ano de transição (Fase 6): os nomes dos papéis, as marcas inventadas, as mensagens e os eventos
  // do ano. Os cachês, as chances e o tamanho de cada efeito estão em TRANSITION, em
  // src/config/balance.ts; os eventos usam degraus e chances com nome.
  'TRANSITION_ROLE_INFO',
  'TRANSITION_BRANDS',
  'TRANSITION_ROUND_TEXTS',
  'TRANSITION_START_TEXTS',
  'TRANSITION_EVENTS',
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

/**
 * Constantes de módulo (sem `export`) que já existiam quando a regra 3 entrou em vigor: algumas
 * são números de equilíbrio antigos, outras são tabelas de nomes e de aparência. A lista é
 * congelada: uma constante nova no motor ou nos dados que não esteja aqui faz o teste falhar.
 */
const KNOWN_PRIVATE: Readonly<Record<string, readonly string[]>> = {
  'src/data/categories.ts': ['CIRCUITS', 'KART_POINTS', 'KART_RACE', 'SP_KART_ROUNDS', 'WORLD_KART_TRACKS'],
  'src/data/drivers.ts': ['ROWS'],
  'src/data/management.ts': ['F1_RULES', 'KART_RULES', 'SPEC_RULES'],
  'src/data/teams.ts': ['CACHE', 'COLORS', 'FROZEN_SLUGS', 'REGIONAL_TEAMS', 'TARGETS', 'TEAM_NAMES'],
  'src/data/vehicles.ts': ['FALLBACK'],
  'src/engine/broadcast/circuit.ts': [
    'CHICANE',
    'FLOWING',
    'KART_MIN_RADIUS',
    'METRIC_PROFILE',
    'REAL_FACTORS',
    'REAL_MARGIN',
    'REAL_SCALE',
    'REAL_SPACING',
    'SPEED_PROFILE',
    'TAU',
    'TIGHT',
  ],
  'src/engine/broadcast/timeline.ts': ['LAUNCH', 'LAUNCH_NORM'],
  'src/engine/career/condition.ts': ['INJURIES'],
  'src/engine/career/createCareer.ts': ['ROOKIE_SEAT_DISCOUNT'],
  'src/engine/career/development.ts': ['DECLINING'],
  'src/engine/career/offseason.ts': ['DEBT_CEILING_SHARE', 'OFFSEASON_TRAINING_CYCLES', 'TRUST_TERMINATION'],
  'src/engine/career/sponsors.ts': ['NAMES'],
  'src/engine/dynasty/succession.ts': ['NON_DRIVER_ATTRIBUTES'],
  'src/engine/management/events.ts': ['BUILDERS'],
  'src/engine/management/executive.ts': ['FORCED_SALE_DISCOUNT'],
  'src/engine/simulation/practice.ts': ['SETUP_NOISE'],
  'src/engine/simulation/qualifying.ts': ['KNOCKOUT_ATTEMPTS_PER_SEGMENT', 'QUALIFYING_ERROR_MULTIPLIER'],
  'src/engine/simulation/race/step.ts': ['COMPROMISED_LOSS', 'ORDER_GAP', 'START_LAP_EXTRA'],
  'src/engine/simulation/race/strategy.ts': ['REPAIR_THRESHOLD', 'WRONG_TYRE_THRESHOLD'],
  'src/engine/simulation/race/weatherProfile.ts': ['DRYING_CHANCE', 'RAIN_ARRIVAL_SHARE'],
  'src/engine/simulation/weather.ts': ['SESSION_CORRELATION', 'WET_SHARE_OF_RAIN'],
  'src/engine/tutorial.ts': ['STEPS'],
  'src/engine/world/generation.ts': ['ARCHETYPES', 'ROLE_OFFSET'],
};

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

  it('constante nova de módulo, mesmo sem export, também não passa despercebida', () => {
    const fresh = ['src/data', 'src/engine']
      .flatMap(sourceFiles)
      .filter((path) => !/Layouts\.ts$/.test(path))
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(/^const ([A-Z][A-Z0-9_]{2,})\b/gm)]
          .map((match) => match[1] ?? '')
          .filter((name) => !KNOWN_PRIVATE[path]?.includes(name))
          .map((name) => `${path}: ${name} (número de equilíbrio novo vai em src/config/balance.ts; se não for balanceamento, entra em KNOWN_PRIVATE)`),
      );
    expect(fresh).toEqual([]);
    // A lista não guarda nomes que já saíram do código.
    for (const [path, names] of Object.entries(KNOWN_PRIVATE)) {
      const source = readFileSync(path, 'utf8');
      for (const name of names) expect(source, `${path} não tem mais ${name}`).toMatch(new RegExp(`^const ${name}\\b`, 'm'));
    }
  });

  it('a configuração não importa o motor (para o motor poder importá-la)', () => {
    expect(readFileSync('src/config/balance.ts', 'utf8')).not.toMatch(/from ['"]@\/engine|from ['"]\.\.\/engine/);
  });
});
