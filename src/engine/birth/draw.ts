/**
 * Sorteio do nascimento (Fase 2): família, corpo e mente, talentos e defeitos ocultos.
 *
 * O sorteio sai de `hashSeed(semente, 'birth', tentativa)`: a mesma semente e a mesma tentativa
 * dão sempre o mesmo nascimento, e "sortear de novo" é só passar à tentativa seguinte. A ordem dos
 * sorteios é fixa (região, cidade, mãe, pai, economias, aptidões, traços) e cada um consome sempre
 * o mesmo número de números do gerador, seja qual for o resultado dos anteriores.
 */
import { APTITUDE_EFFECTS, APTITUDE_LINKS, BIRTH } from '@/config/balance';
import { APTITUDE_KEYS, TRAIT_IDS, type Aptitudes, type AttributeKey, type Birth, type BirthTrait, type TraitId } from '@/domain/schemas';
import { BIRTH_TRAITS, FATHER_PROFESSIONS, HOMETOWNS, MOTHER_PROFESSIONS } from '@/data/birth';
import { createRng, gaussian, hashSeed, type Rng } from '../rng';

/** Sorteios refeitos que o motor aceita: os gratuitos mais os extras da versão premium. */
export function maxBirthRerolls(): number {
  return BIRTH.FREE_REROLLS + BIRTH.PREMIUM_EXTRA_REROLLS;
}

/** Um item da lista, com um único número do gerador (a sequência não depende do tamanho da lista). */
function pick<T>(rng: Rng, list: readonly T[]): T {
  const item = list[Math.floor(rng.next() * list.length)];
  if (item === undefined) throw new Error('Lista vazia no sorteio do nascimento.');
  return item;
}

const at = (list: readonly number[], index: number): number => list[Math.max(0, Math.min(list.length - 1, index))] ?? 0;

function drawAptitude(rng: Rng): number {
  const value = Math.round(BIRTH.APTITUDE_MEAN + gaussian(rng) * BIRTH.APTITUDE_SD);
  return Math.min(BIRTH.APTITUDE_MAX, Math.max(BIRTH.APTITUDE_MIN, value));
}

/**
 * Um talento, um defeito e um terceiro de qualquer tipo, sem os dois lados de um mesmo par. O
 * candidato é escolhido entre os que ainda cabem, sempre com um número do gerador por escolha.
 */
function drawTraits(rng: Rng): BirthTrait[] {
  const chosen: TraitId[] = [];
  const fits = (id: TraitId) => !chosen.includes(id) && !chosen.includes(BIRTH_TRAITS[id].opposite);
  const take = (pool: readonly TraitId[]) => chosen.push(pick(rng, pool.filter(fits)));
  const talents = TRAIT_IDS.filter((id) => BIRTH_TRAITS[id].kind === 'talent');
  const defects = TRAIT_IDS.filter((id) => BIRTH_TRAITS[id].kind === 'defect');
  for (let i = 0; i < BIRTH.TALENTS; i++) take(talents);
  for (let i = 0; i < BIRTH.DEFECTS; i++) take(defects);
  for (let i = 0; i < BIRTH.EXTRA_TRAITS; i++) take(TRAIT_IDS);
  return chosen.map((id) => ({ id, revealedSeason: null, revealedRound: null }));
}

/** O nascimento da tentativa `attempt` (0 = o primeiro sorteio) para a semente da carreira. */
export function drawBirth(seed: number, attempt: number, driverId: string): Birth {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error(`Sorteio de nascimento inválido: ${attempt}.`);
  const rng = createRng(hashSeed(seed, 'birth', attempt));
  const region = rng.next() < BIRTH.CAPITAL_CHANCE ? 'capital' : 'interior';
  const hometown = pick(
    rng,
    HOMETOWNS.filter((h) => h.region === region),
  );
  const mother = pick(rng, MOTHER_PROFESSIONS);
  const father = pick(rng, FATHER_PROFESSIONS);
  // Soma das faixas de renda (2 a 6) vira o índice das tabelas (0 a 4).
  const income = mother.income + father.income - 2;
  const variation = (rng.next() * 2 - 1) * BIRTH.SAVINGS_VARIATION;
  const savings = Math.round((at(BIRTH.SAVINGS_BY_INCOME, income) * (1 + variation)) / 500) * 500;
  const aptitudes = Object.fromEntries(APTITUDE_KEYS.map((key) => [key, drawAptitude(rng)])) as Aptitudes;
  const traits = drawTraits(rng);
  return {
    driverId,
    origin: 'humble',
    rerolls: attempt,
    hometownId: hometown.id,
    region,
    parents: { mother: mother.id, father: father.id },
    savings,
    support: { perSeason: at(BIRTH.SUPPORT_PER_SEASON_BY_INCOME, income), seasons: at(BIRTH.SUPPORT_SEASONS_BY_INCOME, income) },
    aptitudes,
    traits,
    movedSeason: null,
  };
}

/**
 * Quanto o corpo e a mente somam (ou tiram) de cada atributo na ficha inicial, em pontos inteiros.
 * Ver APTITUDE_LINKS.
 */
export function birthAttributeBonus(aptitudes: Aptitudes): Partial<Record<AttributeKey, number>> {
  const raw: Partial<Record<AttributeKey, number>> = {};
  for (const key of APTITUDE_KEYS) {
    const links: Readonly<Partial<Record<AttributeKey, number>>> = APTITUDE_LINKS[key];
    for (const [attribute, weight] of Object.entries(links) as [AttributeKey, number][]) {
      raw[attribute] = (raw[attribute] ?? 0) + (aptitudes[key] - 50) * weight;
    }
  }
  return Object.fromEntries(Object.entries(raw).map(([attribute, value]) => [attribute, Math.round(value)]));
}

/** Pontos de potencial pela média de reflexo, físico, inteligência e frieza (o carisma não conta). */
export function birthPotentialBonus(aptitudes: Aptitudes): number {
  const driving = (aptitudes.reflexes + aptitudes.physique + aptitudes.intelligence + aptitudes.composure) / 4;
  return Math.round((driving - 50) * APTITUDE_EFFECTS.POTENTIAL_PER_POINT);
}

/** Nota de nascença: a média das cinco aptidões (50 é o piloto comum). */
export function birthScore(aptitudes: Aptitudes): number {
  return APTITUDE_KEYS.reduce((total, key) => total + aptitudes[key], 0) / APTITUDE_KEYS.length;
}
