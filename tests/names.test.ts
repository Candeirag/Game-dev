/**
 * Nomes do jogo: as categorias têm nomes próprios, num arquivo só, e nenhuma marca real aparece
 * no que o jogador lê. Os identificadores internos ficam como sempre foram, porque estão nos
 * saves e entram no cálculo das sementes.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_NAMES, categoryRef } from '@/domain/categoryNames';
import { CATEGORY_IDS } from '@/domain/schemas';
import { capitalize } from '@/domain/text';
import { CATEGORIES } from '@/data/categories';
import { F1_TEAM_NAMES, f1TeamId, initialTeams } from '@/data/teams';
import { VEHICLES } from '@/data/vehicles';
import { categoryRequirements } from './engineApi';
import { newCareer } from './helpers';

/** Marcas reais que o jogo não usa em lugar nenhum do que escreve na tela ou grava. */
const REAL_MARKS = /\bF[1-4]\b|F[oó]rmula [1-4]\b|\bFIA\b|Superlicença/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|html|css)$/.test(name) ? [path] : [];
  });
}

describe('nomes das categorias', () => {
  it('são os nomes próprios do jogo, do kart ao topo', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      'Campeonato Regional de Kart',
      'Campeonato Brasileiro de Kart',
      'Campeonato Mundial de Kart',
      'Fórmula Júnior',
      'Fórmula Sprint',
      'Fórmula Elite',
      'Grand Prix Mundial',
    ]);
  });

  it('os dados só repetem o que está no arquivo central', () => {
    for (const category of CATEGORIES) {
      const naming = CATEGORY_NAMES[category.id];
      expect(category.name).toBe(naming.name);
      expect(category.shortName).toBe(naming.shortName);
      expect(category.requirements.licenseName).toBe(naming.licenseName);
      expect(VEHICLES[category.id].name).toBe(naming.vehicleName);
    }
  });

  it('cada categoria tem nome, rótulo curto, sigla, veículo e licença só dela', () => {
    for (const key of ['name', 'shortName', 'code', 'vehicleName', 'licenseName'] as const) {
      expect(new Set(CATEGORY_IDS.map((id) => CATEGORY_NAMES[id][key])).size, key).toBe(CATEGORY_IDS.length);
    }
    // O rótulo curto cabe na barra superior da tela deitada, ao lado do ano.
    for (const id of CATEGORY_IDS) expect(CATEGORY_NAMES[id].shortName.length).toBeLessThanOrEqual(18);
  });

  it('os identificadores internos não mudaram', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['kart-regional', 'kart-national', 'kart-international', 'f4', 'f3', 'f2', 'f1']);
  });
});

describe('o nome na frase', () => {
  it('a contração acompanha o gênero do nome', () => {
    expect(categoryRef('f1', 'a')).toBe('ao Grand Prix Mundial');
    expect(categoryRef('f1', 'de')).toBe('do Grand Prix Mundial');
    expect(categoryRef('f1', 'em')).toBe('no Grand Prix Mundial');
    expect(categoryRef('f2', 'a')).toBe('à Fórmula Elite');
    expect(categoryRef('f3', 'em')).toBe('na Fórmula Sprint');
    expect(categoryRef('f4', 'para')).toBe('para a Fórmula Júnior');
    expect(categoryRef('f4', 'the')).toBe('a Fórmula Júnior');
    expect(categoryRef('kart-national', 'para')).toBe('para o Campeonato Brasileiro de Kart');
    expect(categoryRef('kart-regional', 'por')).toBe('pelo Campeonato Regional de Kart');
  });

  it('o rótulo curto tem o mesmo gênero do nome completo', () => {
    expect(categoryRef('f1', 'de', { short: true })).toBe('do GP Mundial');
    expect(categoryRef('f3', 'para', { short: true })).toBe('para a F. Sprint');
    expect(categoryRef('kart-national', 'para', { short: true })).toBe('para o Kart Nacional');
    expect(capitalize(categoryRef('kart-regional', 'de'))).toBe('Do Campeonato Regional de Kart');
  });
});

describe('requisitos para subir de categoria', () => {
  it('dizem o que o piloto tem e o mínimo exigido, sem "16 de 13 anos"', () => {
    const career = newCareer(7, { age: 15 });
    const rows = Object.fromEntries(categoryRequirements(career, 'kart-national').map((r) => [r.key, r]));
    expect(rows.age).toMatchObject({ label: 'Idade', detail: '16 anos na próxima temporada (mínimo 13)', met: true });
    expect(rows.license).toMatchObject({ label: 'Licença Nacional de Kart', detail: '0 pontos (mínimo 2)', met: false });
    expect(rows.reputation?.detail).toBe('10 (mínimo 10)');
    expect(rows.experience?.detail).toMatch(/^\d+ \(mínimo 26\)$/);
    for (const row of Object.values(rows)) expect(row.detail).not.toMatch(/\d+ de \d+/);
  });

  it('fora da virada de temporada, a idade é a de hoje', () => {
    const career = newCareer(7, { age: 15 });
    const age = categoryRequirements(career, 'f1', { nextSeason: false }).find((r) => r.key === 'age');
    expect(age).toMatchObject({ detail: '15 anos (mínimo 18)', met: false });
  });
});

describe('equipes', () => {
  it('nenhuma equipe leva uma marca real no nome', () => {
    for (const id of CATEGORY_IDS) for (const team of initialTeams(id)) expect(team.name).not.toMatch(REAL_MARKS);
    expect(F1_TEAM_NAMES).toContain('Azure Motorsport');
    expect(F1_TEAM_NAMES).toContain('Stallion Autosport');
  });

  // Os ids estão nos saves e entram nas sementes (hashSeed): rebatizar uma equipe não pode mudá-los.
  it('os ids das equipes do topo são os de sempre, mesmo das rebatizadas', () => {
    const ids = [
      'f1-corsa-imperiale',
      'f1-albion-grand-prix',
      'f1-rheingold-racing',
      'f1-solaris-racing',
      'f1-azure-f1-team',
      'f1-emerald-gp',
      'f1-massif-racing',
      'f1-stallion-f1',
      'f1-kraken-motorsport',
      'f1-orion-grand-prix',
    ];
    expect(initialTeams('f1').map((t) => t.id)).toEqual(ids);
    expect(F1_TEAM_NAMES.map((_, index) => f1TeamId(index))).toEqual(ids);
  });

  it('os ids das demais categorias também estão travados', () => {
    const ids = CATEGORY_IDS.filter((id) => id !== 'f1').flatMap((id) => initialTeams(id).map((t) => t.id));
    expect(ids).toMatchInlineSnapshot(`
      [
        "vortex",
        "trovao",
        "serra",
        "falcao",
        "riogrande",
        "atlantico",
        "pampa",
        "horizonte",
        "cerrado",
        "garagem",
        "kart-national-aguia-racing",
        "kart-national-meridional-kart",
        "kart-national-tupi-motorsport",
        "kart-national-ipe-competicoes",
        "kart-national-corsa-brasil",
        "kart-national-litoral-racing-team",
        "kart-national-sertao-kart",
        "kart-national-paulista-speed",
        "kart-national-arara-azul-racing",
        "kart-national-nova-era-kart",
        "kart-international-scuderia-aurora",
        "kart-international-nordic-kart-racing",
        "kart-international-britannia-karts",
        "kart-international-iberia-racing",
        "kart-international-alpen-kart-technik",
        "kart-international-riviera-corse",
        "kart-international-benelux-kart-team",
        "kart-international-pacific-rim-racing",
        "kart-international-adria-motorsport",
        "kart-international-atlas-kart-club",
        "f4-prisma-racing",
        "f4-velocita-junior",
        "f4-dragon-motorsport",
        "f4-van-aalst-racing",
        "f4-iberica-racing",
        "f4-kestrel-autosport",
        "f4-riviera-junior-team",
        "f4-lone-star-academy",
        "f4-sakura-racing",
        "f4-southern-cross-motorsport",
        "f3-artemis-grand-prix",
        "f3-neptune-racing",
        "f3-prisma-racing",
        "f3-hyperion-gp",
        "f3-castilla-racing",
        "f3-sterling-motorsport",
        "f3-van-aalst-racing",
        "f3-helvetia-motorsport",
        "f3-bohemia-racing-system",
        "f3-lowlands-motorsport",
        "f2-artemis-grand-prix",
        "f2-prisma-racing",
        "f2-sterling-motorsport",
        "f2-victrix-racing",
        "f2-loire-racing",
        "f2-castilla-racing",
        "f2-hyperion-gp",
        "f2-lowlands-motorsport",
        "f2-neptune-racing",
        "f2-bohemia-racing-system",
      ]
    `);
  });

  it('cada equipe ligada a uma academia aponta para uma equipe do topo que existe', () => {
    const top = new Set(initialTeams('f1').map((t) => t.id));
    for (const id of CATEGORY_IDS) for (const team of initialTeams(id)) if (team.affiliation) expect(top.has(team.affiliation), team.id).toBe(true);
  });
});

describe('marcas reais', () => {
  it('não aparecem no código do jogo, do simulador nem dos testes no navegador', () => {
    const found = ['src', 'sim', 'e2e', 'index.html']
      .flatMap((entry) => (statSync(entry).isDirectory() ? sourceFiles(entry) : [entry]))
      // Ficam de fora os arquivos gerados (o cabeçalho cita o repositório de origem dos traçados, crédito
      // obrigatório) e a migração da versão 3, que precisa conhecer os nomes antigos para trocá-los.
      .filter((path) => !/src\/data\/(circuitLayouts|kartLayouts)\.ts$|src\/persistence\/migrateV3\.ts$/.test(path))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .flatMap((line, index) => (REAL_MARKS.test(line) ? [`${path}:${index + 1}: ${line.trim().slice(0, 120)}`] : [])),
      );
    expect(found).toEqual([]);
  });
});
