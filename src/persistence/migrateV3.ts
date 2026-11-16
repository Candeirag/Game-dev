/**
 * Migração do save da versão 3 para a 4 (Fase 0): nomes próprios.
 *
 * A versão 4 não muda a estrutura do save; muda o que ele traz escrito. Até a versão 3, as
 * categorias de monopostos e duas equipes do topo tinham nomes de marcas reais, e esses nomes
 * ficaram gravados por extenso em mensagens, notícias, eventos, lançamentos do extrato, propostas
 * e fichas de pilotos. Esta migração troca tudo pelos nomes do jogo:
 *
 * - as duas equipes rebatizadas (o id delas continua o mesmo, só o nome e a sigla mudam);
 * - "Fórmula 1" a "Fórmula 4" e as siglas, com a contração acertada quando o nome novo é
 *   masculino ("chegou à Fórmula 1" vira "chegou ao Grand Prix Mundial");
 * - de quebra, a concordância que as versões antigas erravam nos campeonatos de kart ("subiu
 *   para a Campeonato Mundial de Kart").
 *
 * O que o jogador digitou não é tocado: o nome do piloto, o sobrenome da família e o nome de uma
 * equipe fundada por ele ficam como estão, mesmo que contenham uma das siglas antigas, inclusive
 * dentro das frases que os citam.
 *
 * É uma migração só de dados: não chama o motor do jogo e pode rodar duas vezes sem mudar nada
 * na segunda.
 */
import { CATEGORY_NAMES, type CategoryLink, categoryRef } from '@/domain/categoryNames';
import type { CategoryId } from '@/domain/schemas';
import { capitalize } from '@/domain/text';

type Loose = Record<string, unknown>;

/** Equipes rebatizadas na versão 4, pelo id (que não muda). */
const RENAMED_TEAMS: readonly { id: string; from: { name: string; shortName: string }; to: { name: string; shortName: string } }[] = [
  { id: 'f1-azure-f1-team', from: { name: 'Azure F1 Team', shortName: 'AFT' }, to: { name: 'Azure Motorsport', shortName: 'AM' } },
  { id: 'f1-stallion-f1', from: { name: 'Stallion F1', shortName: 'SF' }, to: { name: 'Stallion Autosport', shortName: 'SA' } },
];

/** Categorias que tinham número no nome: "Fórmula N" por extenso e "FN" como sigla. */
const NUMBERED: readonly { digit: string; id: CategoryId }[] = [
  { digit: '1', id: 'f1' },
  { digit: '2', id: 'f2' },
  { digit: '3', id: 'f3' },
  { digit: '4', id: 'f4' },
];

/** Contrações femininas que as versões antigas colavam antes de qualquer nome de categoria. */
const FEMININE_LINKS: Readonly<Record<string, CategoryLink>> = { a: 'the', à: 'a', da: 'de', na: 'em', pela: 'por' };
const LINK_WORDS = 'a|à|da|na|pela|A|À|Da|Na|Pela';
/** Início do texto ou um caractere que não continua uma palavra, um número ou um id. */
const BEFORE = '(^|[^\\p{L}\\p{N}_-])';
const AFTER = '(?![\\p{L}\\p{N}_-])';

type Rule = (text: string) => string;

/** "na Fórmula 1" → "no Grand Prix Mundial": a contração passa a ser a do gênero do nome novo. */
function linkedRule(oldName: string, id: CategoryId): Rule {
  const pattern = new RegExp(`${BEFORE}(${LINK_WORDS}) ${oldName}${AFTER}`, 'gu');
  return (text) =>
    text.replace(pattern, (_match, before: string, word: string) => {
      const phrase = categoryRef(id, FEMININE_LINKS[word.toLowerCase()] ?? 'the');
      return `${before}${word === word.toLowerCase() ? phrase : capitalize(phrase)}`;
    });
}

/** O nome antigo sozinho (títulos, listas): troca direta pelo nome novo. */
function bareRule(oldName: string, newName: string): Rule {
  const pattern = new RegExp(`${BEFORE}${oldName}${AFTER}`, 'gu');
  return (text) => text.replace(pattern, (_match, before: string) => `${before}${newName}`);
}

const KART_NAMES = 'Campeonato (?:Regional|Brasileiro|Mundial) de Kart|Kart (?:Regional|Nacional|Internacional)';
const MASCULINE: Readonly<Record<string, string>> = { a: 'o', à: 'ao', da: 'do', na: 'no', pela: 'pelo' };
const KART_PATTERN = new RegExp(`${BEFORE}(${LINK_WORDS}) (${KART_NAMES})${AFTER}`, 'gu');

/** "para a Campeonato Mundial de Kart" → "para o Campeonato Mundial de Kart" (erro das versões antigas). */
const kartGenderRule: Rule = (text) =>
  text.replace(KART_PATTERN, (_match, before: string, word: string, name: string) => {
    const fixed = MASCULINE[word.toLowerCase()] ?? word;
    return `${before}${word === word.toLowerCase() ? fixed : capitalize(fixed)} ${name}`;
  });

/** A ordem importa: nomes de equipe antes das siglas; nome com contração antes do nome sozinho. */
const RULES: readonly Rule[] = [
  ...RENAMED_TEAMS.map(
    ({ from, to }): Rule =>
      (text) =>
        text.split(from.name).join(to.name),
  ),
  ...NUMBERED.flatMap(({ digit, id }) => [linkedRule(`Fórmula ${digit}`, id), linkedRule(`F${digit}`, id)]),
  ...NUMBERED.flatMap(({ digit, id }) => [bareRule(`Fórmula ${digit}`, CATEGORY_NAMES[id].name), bareRule(`F${digit}`, CATEGORY_NAMES[id].shortName)]),
  kartGenderRule,
];

const applyRules = (text: string): string => RULES.reduce((work, rule) => rule(work), text);

/** Só os textos que citam um nome antigo passam pelas regras: a imensa maioria sai intocada. */
const MAY_NEED_REWRITE = /F[1-4]|Fórmula [1-4]|Kart|Azure|Stallion/;

/**
 * Reescreve um texto gravado. `typed` são os nomes digitados pelo jogador: cada ocorrência deles
 * é posta de lado antes das regras e devolvida depois, intacta.
 */
export function renameStoredText(text: string, typed: readonly string[] = []): string {
  if (!MAY_NEED_REWRITE.test(text)) return text;
  const held: string[] = [];
  let work = text;
  for (const name of typed) {
    if (!name || !work.includes(name)) continue;
    // O marcador usa caracteres de controle, que não aparecem em nenhum texto do jogo.
    work = work.split(name).join(`\u0001${held.length}\u0002`);
    held.push(name);
  }
  return held.reduce((result, name, index) => result.split(`\u0001${index}\u0002`).join(name), applyRules(work));
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = (value: unknown): Loose[] => (Array.isArray(value) ? (value as Loose[]) : []);
const obj = (value: unknown): Loose => (value !== null && typeof value === 'object' ? (value as Loose) : {});

/**
 * Nomes que o jogador digitou: o piloto (e os personagens anteriores da família), o sobrenome da
 * dinastia e as equipes fundadas por ele. Vão do mais longo para o mais curto, para um nome
 * completo ser posto de lado antes de um pedaço dele.
 */
function typedNames(data: Loose): string[] {
  const names = new Set<string>();
  const add = (value: unknown) => {
    const name = text(value).trim();
    if (name.length >= 2) names.add(name);
  };
  for (const driver of list(data.drivers)) {
    if (driver.isPlayer !== true && driver.id !== data.playerDriverId) continue;
    add(driver.firstName);
    add(driver.lastName);
    add(`${text(driver.firstName)} ${text(driver.lastName)}`);
  }
  const dynasty = obj(data.dynasty);
  add(dynasty.surname);
  for (const entry of list(dynasty.lineage)) add(entry.name);
  // Equipes fundadas pelo jogador têm id próprio ("own-…"); as demais não podem ser rebatizadas.
  for (const team of list(data.teams)) if (text(team.id).startsWith('own-')) add(team.name);
  // Só precisa de proteção o nome que as regras mudariam (um "Scuderia F1", por exemplo).
  return [...names].filter((name) => applyRules(name) !== name).sort((a, b) => b.length - a.length);
}

export function migrateV3(data: Loose): Loose {
  const typed = typedNames(data);
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return renameStoredText(value, typed);
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value).map(([key, inner]): [string, unknown] => [key, walk(inner)]);
      const result: Loose = Object.fromEntries(entries);
      // A sigla da equipe é derivada do nome e não aparece em frases: acerta-se pelo id.
      const renamed = RENAMED_TEAMS.find((team) => team.id === result.id);
      if (renamed && result.shortName === renamed.from.shortName) result.shortName = renamed.to.shortName;
      return result;
    }
    return value;
  };
  return walk(data) as Loose;
}
