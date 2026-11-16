/**
 * Nomes próprios das categorias: o único arquivo do jogo que escreve o nome de um campeonato.
 *
 * O jogo não usa marcas reais. As quatro categorias de monopostos têm nomes do próprio jogo, e
 * tudo o que deriva deles (o veículo, a licença, o rótulo curto das telas) sai daqui. Dados
 * (`src/data/categories.ts`, `src/data/vehicles.ts`), motor e interface só leem este arquivo:
 * para rebatizar uma categoria, muda-se uma linha aqui e mais nada.
 *
 * Os identificadores internos ('f4', 'f3', 'f2', 'f1', 'kart-…') NÃO acompanham os nomes. Eles
 * estão nos saves e entram no cálculo das sementes (`hashSeed`); trocá-los mudaria o resultado
 * das corridas e quebraria carreiras em andamento.
 *
 * Em frase, o nome nunca é colado à mão depois de "da", "na" ou "à": há nomes masculinos e
 * femininos, e quem acerta a contração é `categoryRef`.
 */
import type { CategoryId } from './schemas';

export type Gender = 'm' | 'f';

export interface CategoryNaming {
  /** Nome completo do campeonato. */
  name: string;
  /** Rótulo curto, para onde o espaço é pouco: barra superior, abas, células de tabela. */
  shortName: string;
  /** Gênero do nome (vale para o completo e para o curto). */
  gender: Gender;
  /** Sigla de duas letras, para relatórios em colunas (simulador e calibração). */
  code: string;
  /** Veículo da categoria, como aparece na garagem e na escada da carreira. */
  vehicleName: string;
  /** Licença exigida para correr na categoria. */
  licenseName: string;
}

export const CATEGORY_NAMES: Readonly<Record<CategoryId, CategoryNaming>> = {
  'kart-regional': {
    name: 'Campeonato Regional de Kart',
    shortName: 'Kart Regional',
    gender: 'm',
    code: 'KR',
    vehicleName: 'Kart 4 tempos',
    licenseName: 'Licença de Kart Regional',
  },
  'kart-national': {
    name: 'Campeonato Brasileiro de Kart',
    shortName: 'Kart Nacional',
    gender: 'm',
    code: 'KN',
    vehicleName: 'Kart 125 cc',
    licenseName: 'Licença Nacional de Kart',
  },
  'kart-international': {
    name: 'Campeonato Mundial de Kart',
    shortName: 'Kart Internacional',
    gender: 'm',
    code: 'KI',
    vehicleName: 'Kart 125 cc com câmbio',
    licenseName: 'Licença Internacional de Kart',
  },
  f4: {
    name: 'Fórmula Júnior',
    shortName: 'F. Júnior',
    gender: 'f',
    code: 'FJ',
    vehicleName: 'Monoposto Júnior',
    licenseName: 'Licença Júnior',
  },
  f3: {
    name: 'Fórmula Sprint',
    shortName: 'F. Sprint',
    gender: 'f',
    code: 'FS',
    vehicleName: 'Monoposto Sprint',
    licenseName: 'Licença Sprint',
  },
  f2: {
    name: 'Fórmula Elite',
    shortName: 'F. Elite',
    gender: 'f',
    code: 'FE',
    vehicleName: 'Monoposto Elite',
    licenseName: 'Licença Elite',
  },
  f1: {
    name: 'Grand Prix Mundial',
    shortName: 'GP Mundial',
    gender: 'm',
    code: 'GP',
    vehicleName: 'Monoposto Grand Prix',
    licenseName: 'Licença Mundial',
  },
};

/** Categoria em que toda carreira começa, a primeira de monopostos e o topo da escada. */
export const FIRST_CATEGORY_ID: CategoryId = 'kart-regional';
export const FIRST_FORMULA_CATEGORY_ID: CategoryId = 'f4';
export const TOP_CATEGORY_ID: CategoryId = 'f1';

/**
 * Como o nome entra na frase: sozinho com o artigo ('the') ou depois de uma preposição que se
 * contrai com ele.
 */
export type CategoryLink = 'the' | 'de' | 'em' | 'a' | 'para' | 'por';

const LINKS: Readonly<Record<CategoryLink, Readonly<Record<Gender, string>>>> = {
  the: { m: 'o', f: 'a' },
  de: { m: 'do', f: 'da' },
  em: { m: 'no', f: 'na' },
  a: { m: 'ao', f: 'à' },
  para: { m: 'para o', f: 'para a' },
  por: { m: 'pelo', f: 'pela' },
};

/**
 * O nome da categoria pronto para entrar numa frase, com o artigo ou a contração no gênero
 * certo: `categoryRef('f1', 'a')` = "ao Grand Prix Mundial"; `categoryRef('f2', 'em')` = "na
 * Fórmula Elite"; `categoryRef('kart-national', 'para')` = "para o Campeonato Brasileiro de Kart".
 * Com `short`, usa o rótulo curto ("do GP Mundial").
 */
export function categoryRef(id: CategoryId, link: CategoryLink, options: { short?: boolean } = {}): string {
  const naming = CATEGORY_NAMES[id];
  return `${LINKS[link][naming.gender]} ${options.short ? naming.shortName : naming.name}`;
}
