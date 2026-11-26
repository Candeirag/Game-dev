/**
 * Os parentes e o personagem anterior (Fase 6).
 *
 * Na sucessão, os filhos que não herdaram a carreira não somem: seguem caminho próprio
 * (engenharia, negócios ou direção esportiva, pela personalidade e pelo que já correram) e ficam na
 * árvore da família (`dynasty.relatives`). Quem foi para os negócios patrocina o herdeiro que corre.
 * Quem passa o comando em vida segue vivo (`dynasty.elders`, que pode ter mais de um): no controle
 * da equipe da família, nas participações ou longe das pistas, até a tábua de mortalidade o levar.
 *
 * Os sorteios têm nomes próprios (`relative-path`, `relative-skill`) e só acontecem na sucessão.
 * Os números estão em RELATIVES (`src/config/balance.ts`); os textos, em `src/data/dynasty.ts`.
 */
import { RELATIVES } from '@/config/balance';
import {
  RELATIVE_PATHS,
  type CareerState,
  type Child,
  type ChildTrait,
  type Elder,
  type Driver,
  type Relative,
  type RelativePath,
  type Sponsor,
  type TeamStake,
} from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { compareText } from '@/domain/text';
import { fullName } from '../career/selectors';
import { familySupport } from '../career/sponsors';
import { createRng, gaussian, hashSeed } from '../rng';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/** Cada traço de personalidade puxa para um caminho; os demais não pesam. */
const pathOfTrait: Partial<Record<ChildTrait, RelativePath>> = {
  studious: 'engineer',
  intuitive: 'engineer',
  charismatic: 'business',
  rebel: 'business',
  calm: 'sportingDirector',
  determined: 'sportingDirector',
};

/**
 * O caminho de um filho que não herdou a carreira: estudioso ou intuitivo vai para a engenharia;
 * carismático ou rebelde, para os negócios; frio, determinado ou quem já correu, para a direção
 * esportiva. Cada traço (e ter corrido) vale um voto; o empate é sorteado (`seed`, que só é usado
 * quando há empate).
 */
export function relativePath(child: Pick<Child, 'traits' | 'racing'>, seed: number): RelativePath {
  const votes: Record<RelativePath, number> = { engineer: 0, business: 0, sportingDirector: 0 };
  for (const trait of child.traits) {
    const path = pathOfTrait[trait];
    if (path) votes[path] += 1;
  }
  if (child.racing) votes.sportingDirector += 1;
  const best = Math.max(...RELATIVE_PATHS.map((p) => votes[p]));
  const tied = RELATIVE_PATHS.filter((p) => votes[p] === best);
  if (tied.length === 1) return tied[0] as RelativePath;
  return tied[Math.floor(createRng(seed).next() * tied.length)] as RelativePath;
}

/** O degrau mais alto em que um filho correu (pelas temporadas fechadas da carreira própria). */
function highestCategory(child: Pick<Child, 'racing'>): CategoryDefinition | null {
  let best: CategoryDefinition | null = null;
  for (const season of child.racing?.seasons ?? []) {
    const category = getCategory(season.categoryId);
    if (!best || category.tier > best.tier) best = category;
  }
  return best;
}

/**
 * Um filho que não herdou a carreira vira parente, com caminho próprio e nível no ofício (base,
 * parte do teto de piloto e o acaso). `ageYear` é o ano a que a idade dele se refere (o seguinte,
 * se o ano da família já fechou).
 */
export function relativeFromChild(career: CareerState, child: Child, ageYear: number): Relative {
  const rng = createRng(hashSeed(career.seed, 'relative-skill', child.id));
  const skill = RELATIVES.SKILL_BASE + RELATIVES.SKILL_TALENT_WEIGHT * child.talent + gaussian(rng) * RELATIVES.SKILL_SD;
  return {
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    generation: career.dynasty.generation,
    bornYear: ageYear - child.age,
    path: relativePath(child, hashSeed(career.seed, 'relative-path', child.id)),
    skill: Math.round(clamp(skill)),
    traits: child.traits,
    bond: child.bond,
    racedTo: highestCategory(child)?.id ?? null,
    sinceSeason: career.season + 1,
  };
}

export const relativeAge = (relative: Pick<Relative, 'bornYear'>, year: number) => year - relative.bornYear;

/**
 * O ano a que as idades da família se referem: no fechamento da temporada (nos dois modos), o ano da
 * família já fechou e os filhos já fizeram aniversário, então vale o ano seguinte. É a mesma
 * referência que a sucessão usa para gravar o ano de nascimento dos parentes.
 */
export function familyYear(career: Pick<CareerState, 'year' | 'offseason' | 'executiveOffseason'>): number {
  return career.year + (career.offseason || career.executiveOffseason ? 1 : 0);
}

/** O parente está em idade de trabalho (RELATIVES.WORK_FROM_AGE a WORK_UNTIL_AGE) no ano dado. */
export function isWorkingAge(relative: Pick<Relative, 'bornYear'>, year: number): boolean {
  const age = relativeAge(relative, year);
  return age >= RELATIVES.WORK_FROM_AGE && age <= RELATIVES.WORK_UNTIL_AGE;
}

/**
 * O patrocínio de um parente nos negócios ao herdeiro que corre: a empresa do parente de maior
 * vínculo (pelo menos RELATIVES.BUSINESS_SPONSOR_MIN_BOND), em idade de trabalho, paga
 * RELATIVES.BUSINESS_SPONSOR_SHARE da vaga média da categoria por temporada, durante
 * RELATIVES.BUSINESS_SPONSOR_SEASONS temporadas. É um apoio de família (porte 0): não cobra meta.
 * Onde as vagas não são vendidas (o topo), não há patrocínio.
 */
export function businessSponsor(career: CareerState, categoryId: CategoryDefinition['id'], season: number, year: number): Sponsor | null {
  const backer = career.dynasty.relatives
    .filter((r) => r.path === 'business' && r.bond >= RELATIVES.BUSINESS_SPONSOR_MIN_BOND && isWorkingAge(r, year))
    .sort((a, b) => b.bond - a.bond || compareText(a.id, b.id))[0];
  if (!backer) return null;
  const seat = getCategory(categoryId).economy.seatCost;
  const perSeason = Math.round((((seat[0] + seat[1]) / 2) * RELATIVES.BUSINESS_SPONSOR_SHARE) / 100) * 100;
  if (perSeason <= 0) return null;
  return familySupport(perSeason, season + RELATIVES.BUSINESS_SPONSOR_SEASONS - 1, {
    id: `family-business-${backer.id}`,
    name: `Empresa de ${fullName(backer)}`,
  });
}

/** A maior participação da família de que nenhum dos nomes dados cuida (desempate pelo id). */
function largestFreeStake(stakes: readonly TeamStake[], taken: ReadonlySet<string>): TeamStake | undefined {
  return stakes.filter((s) => !taken.has(s.teamName)).sort((a, b) => b.value - a.value || compareText(a.id, b.id))[0];
}

/** As equipes ou participações de que os que passaram o comando já cuidam. */
const caredFor = (elders: readonly Elder[]) => new Set(elders.flatMap((e) => (e.teamName ? [e.teamName] : [])));

/**
 * O personagem que passa o comando em vida: segue no controle da equipe da família se ela fica com
 * a família e o herdeiro vai para as pistas; cuida da maior participação de que nenhum outro que
 * passou o comando já cuida, se houver; senão, sai de cena. `ownedTeamName` é o nome da equipe
 * própria que vira participação (null: não há).
 */
export function elderAfterHandover(career: CareerState, former: Driver, ownedTeamName: string | null): Elder {
  const entry = career.dynasty.lineage[career.dynasty.lineage.length - 1];
  const stake = largestFreeStake(career.finance.stakes, caredFor(career.dynasty.elders));
  const role: Elder['role'] = ownedTeamName ? 'owner' : stake ? 'investor' : 'retired';
  return {
    driverId: former.id,
    name: fullName(former),
    generation: career.dynasty.generation,
    bornYear: entry?.bornYear ?? career.year - former.age,
    role,
    teamName: ownedTeamName ?? stake?.teamName ?? null,
    sinceSeason: career.season + 1,
  };
}

/**
 * Quem passou o comando cuida de uma equipe ou de uma participação pelo nome. Quando ela sai da
 * família (venda, execução de dívida, compra da equipe inteira), essa pessoa passa a cuidar da maior
 * participação de que nenhum outro cuida ou, sem nenhuma, só acompanha a família de longe. Devolve a
 * mesma carreira quando nada mudou (sempre, na primeira geração).
 */
export function refreshElders(career: CareerState): CareerState {
  const { elders } = career.dynasty;
  const held = (e: Elder) => e.teamName === null || career.finance.stakes.some((s) => s.teamName === e.teamName);
  if (elders.every(held)) return career;
  const taken = caredFor(elders.filter(held));
  const next = elders.map((e): Elder => {
    if (held(e)) return e;
    const stake = largestFreeStake(career.finance.stakes, taken);
    if (!stake) return { ...e, role: 'retired', teamName: null };
    taken.add(stake.teamName);
    return { ...e, role: 'investor', teamName: stake.teamName };
  });
  return { ...career, dynasty: { ...career.dynasty, elders: next } };
}
