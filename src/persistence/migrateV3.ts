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
 * O que o jogador digitou não é tocado: o nome do piloto, o sobrenome da família e o nome e a
 * sigla de uma equipe fundada por ele ficam como estão, mesmo que contenham uma das siglas
 * antigas, inclusive dentro das frases que os citam. (Única exceção, nas frases: um nome digitado
 * que seja, sozinho, exatamente um nome antigo, como uma equipe chamada "Stallion F1"; protegê-lo
 * deixaria as menções à equipe de verdade sem trocar. Nos campos de nome ele fica como está.)
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
 * Campos que guardam um NOME (de equipe, de pessoa, de academia, a sigla) e não uma frase. Neles
 * as regras de texto não entram: um nome digitado pelo jogador pode conter "F1" (uma equipe
 * "Scuderia F1", de sigla "SF"; uma "Força 1", de sigla "F1"), e reescrevê-lo estragaria o nome
 * e, na sigla, estouraria o limite de quatro letras do save. Um campo de nome só muda quando é
 * exatamente o de uma das duas equipes rebatizadas.
 */
const NAME_KEYS: ReadonlySet<string> = new Set([
  'name',
  'shortName',
  'teamName',
  'playerTeamName',
  'academy',
  'firstName',
  'lastName',
  'surname',
  'formerName',
]);
/** Onde um objeto do save diz de que equipe ele fala. As fundadas pelo jogador têm id próprio ("own-…"). */
const TEAM_ID_KEYS = ['id', 'teamId', 'playerTeamId'] as const;
const TEAM_NAME_KEYS = ['name', 'teamName', 'playerTeamName'] as const;
const ownedByPlayer = (holder: Loose): boolean => TEAM_ID_KEYS.some((key) => text(holder[key]).startsWith('own-'));

/** Nome antigo → nome novo, por igualdade exata: as duas equipes e as academias delas. */
const OLD_NAMES: ReadonlyMap<string, string> = new Map(
  RENAMED_TEAMS.flatMap(({ from, to }): [string, string][] => [
    [from.name, to.name],
    [`Academia ${from.name}`, `Academia ${to.name}`],
  ]),
);

function renameNameField(key: string, value: string, holder: Loose): string {
  // A sigla é derivada do nome e nunca aparece em frases: acerta-se pelo id da equipe.
  if (key === 'shortName') {
    const renamed = RENAMED_TEAMS.find((team) => team.id === holder.id);
    return renamed && value === renamed.from.shortName ? renamed.to.shortName : value;
  }
  return ownedByPlayer(holder) ? value : (OLD_NAMES.get(value) ?? value);
}

/** Um nome que é, sozinho, um dos nomes antigos: "F1", "Fórmula 3", "Stallion F1". */
const IS_OLD_NAME = new RegExp(`^(?:F[1-4]|Fórmula [1-4]|${RENAMED_TEAMS.map((team) => team.from.name).join('|')})$`);

/**
 * Nomes que o jogador digitou e que as frases gravadas citam: o piloto (e os personagens
 * anteriores da família), o sobrenome da dinastia e as equipes fundadas por ele, onde quer que o
 * save guarde o nome (grid, histórico, retrospecto de dirigente, participações, extrato). Vão do
 * mais longo para o mais curto, para um nome completo ser posto de lado antes de um pedaço dele.
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
  // Equipes fundadas: todo objeto ligado a um id "own-…", mesmo que a equipe já não esteja no grid.
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') {
      const holder = value as Loose;
      if (ownedByPlayer(holder)) for (const key of TEAM_NAME_KEYS) add(holder[key]);
      Object.values(holder).forEach(visit);
    }
  };
  visit(data);
  // O lançamento da fundação guarda o nome mesmo depois de a equipe sair de todo o resto.
  for (const entry of list(obj(data.finance).transactions)) add(/^Fundação da equipe (.+)$/.exec(text(entry.label))?.[1]);
  return (
    [...names]
      // Só precisa de proteção o nome que as regras mudariam (um "Scuderia F1", por exemplo).
      .filter((name) => applyRules(name) !== name)
      // Um nome digitado que é exatamente um nome antigo não é posto de lado nas frases: isso
      // impediria de trocar todas as menções à categoria ou à equipe de verdade. Ele continua
      // intacto nos campos de nome, e o nome completo do piloto continua protegido.
      .filter((name) => !IS_OLD_NAME.test(name))
      .sort((a, b) => b.length - a.length)
  );
}

export function migrateV3(data: Loose): Loose {
  const typed = typedNames(data);
  const walk = (value: unknown, key: string, holder: Loose): unknown => {
    if (typeof value === 'string') return NAME_KEYS.has(key) ? renameNameField(key, value, holder) : renameStoredText(value, typed);
    // Os itens de uma lista são do mesmo campo que a lista (as notas de `notes`, por exemplo).
    if (Array.isArray(value)) return value.map((inner) => walk(inner, key, holder));
    if (value !== null && typeof value === 'object') {
      const inside = value as Loose;
      return Object.fromEntries(Object.entries(inside).map(([innerKey, inner]): [string, unknown] => [innerKey, walk(inner, innerKey, inside)]));
    }
    return value;
  };
  return walk(data, '', {}) as Loose;
}
