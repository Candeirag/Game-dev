/**
 * Geração de pilotos e grids para as categorias sem elenco escrito à mão.
 *
 * Não é sorteio livre: cada piloto nasce de regras ligadas à categoria e à
 * equipe, e a semente da carreira torna o resultado reproduzível.
 *
 * - Nível: a média dos atributos parte do nível da categoria e sobe ou desce
 *   conforme a força da equipe (boas equipes contratam bons pilotos). O
 *   primeiro piloto fica 1,5 acima da base da equipe; o segundo, 1,5 abaixo; o
 *   reserva, 6 abaixo.
 * - Perfil: um de cinco arquétipos desloca os atributos (veloz, regular,
 *   lutador, especialista em chuva, completo), mais uma variação individual
 *   de ±2 (um desvio-padrão).
 * - Idade: dentro da faixa da categoria. Experiência: cresce com a idade e com
 *   o degrau da categoria. Potencial: os jovens têm mais margem para evoluir.
 */
import type { AttributeKey, CategoryId, Driver, DriverAttributes, DriverRole, Team } from '@/domain/schemas';
import { compareText } from '@/domain/text';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { NAME_POOLS, NATIONALITY_WEIGHTS } from '@/data/names';
import { initialTeams } from '@/data/teams';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { TRAINABLE_ATTRIBUTES } from '../career/training';
import { createRng, gaussian, hashSeed, type Rng } from '../rng';

const ROLE_OFFSET: Record<DriverRole, number> = { first: 1.5, second: -1.5, reserve: -6 };

const ARCHETYPES: readonly Partial<Record<AttributeKey, number>>[] = [
  { pace: 4, consistency: -3, overtaking: 2, defending: -1, focus: -2, racecraft: -1, tyreManagement: -2 },
  { pace: -1, consistency: 5, overtaking: -3, defending: 2, focus: 4, racecraft: 3, tyreManagement: 3, wetSkill: -1 },
  { overtaking: 5, defending: 4, consistency: -2, tyreManagement: -3, wetSkill: 1 },
  { pace: -1, racecraft: 1, wetSkill: 9, defending: -1 },
  { pace: 0.5, consistency: 0.5, overtaking: 0.5, defending: 0.5, focus: 0.5, racecraft: 0.5, tyreManagement: 0.5, wetSkill: 0.5 },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function pickWeighted(rng: Rng, weights: Readonly<Record<string, number>>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[0]?.[0] ?? 'BR';
}

function pickName(rng: Rng, category: CategoryDefinition, used: Set<string>): { firstName: string; lastName: string; nationality: string } {
  const weights = NATIONALITY_WEIGHTS[category.tier <= 2 ? 'national' : 'international'];
  for (let attempt = 0; attempt < 40; attempt++) {
    const nationality = pickWeighted(rng, weights);
    const pool = NAME_POOLS.find((p) => p.code === nationality) ?? NAME_POOLS[0];
    if (!pool) break;
    const firstName = pool.first[Math.floor(rng.next() * pool.first.length)] ?? 'Alex';
    const lastName = pool.last[Math.floor(rng.next() * pool.last.length)] ?? 'Silva';
    const full = `${firstName} ${lastName}`;
    if (!used.has(full)) {
      used.add(full);
      return { firstName, lastName, nationality };
    }
  }
  // Todos os nomes sorteados já existiam: usa um sufixo numérico para manter a unicidade.
  const fallback = `Piloto ${used.size + 1}`;
  used.add(fallback);
  return { firstName: 'Piloto', lastName: String(used.size), nationality: 'BR' };
}

export interface GenerateDriverOptions {
  id: string;
  seed: number;
  category: CategoryDefinition;
  /** Posição da equipe na ordem de forças (0 = a mais forte, 9 = a mais fraca). */
  teamRank: number;
  teamId: string | null;
  role: DriverRole;
  season: number;
  usedNames: Set<string>;
  /** Estreante: idade na parte de baixo da faixa da categoria. */
  rookie?: boolean;
}

export function generateDriver(o: GenerateDriverOptions): Driver {
  const rng = createRng(o.seed);
  const { field, tier } = o.category;
  const name = pickName(rng, o.category, o.usedNames);
  const base = field.driverLevel + field.driverSpread * (0.5 - o.teamRank / 9) + ROLE_OFFSET[o.role];
  const archetype = ARCHETYPES[Math.floor(rng.next() * ARCHETYPES.length)] ?? {};

  const ageSpan = field.maxAge - field.minAge;
  const ageRoll = rng.next();
  const young = o.rookie || o.role === 'reserve';
  const age = Math.round(field.minAge + ageSpan * (young ? ageRoll * 0.35 : 0.1 + ageRoll * 0.75));

  const attributes = { experience: 0 } as DriverAttributes;
  for (const key of TRAINABLE_ATTRIBUTES) {
    const paceBias = key === 'pace' ? 2 : 0;
    attributes[key] = Math.round(clamp(base + paceBias + (archetype[key] ?? 0) + gaussian(rng) * 2, 30, 99));
  }
  attributes.experience = Math.round(clamp(18 + tier * 8 + (age - field.minAge) * 3.5 + gaussian(rng) * 3, 5, 99));

  const best = Math.max(...TRAINABLE_ATTRIBUTES.map((k) => attributes[k]));
  // Margem de evolução: 0,6 ponto por ano abaixo de 24, mais até 3 pontos. Um jovem de 16 anos
  // pode crescer de 5 a 8 pontos; um piloto de 24 ou mais já está perto do teto.
  const headroom = Math.max(0, 24 - age) * 0.6 + rng.next() * 3;
  const potential = Math.round(clamp(best + headroom, best, 99));

  return {
    id: o.id,
    ...name,
    age,
    teamId: o.teamId,
    role: o.teamId ? o.role : null,
    contractEnd: o.teamId ? o.season + (rng.next() < 0.5 ? 0 : 1) : 0,
    isPlayer: false,
    attributes,
    potential,
    trainingFocus: chooseAiTrainingFocus(attributes),
    condition: { ...NEUTRAL_CONDITION },
    injury: null,
  };
}

export const teamStrength = (t: Team) => (t.car.engine + t.car.chassis) / 2;

/** Equipes ordenadas da mais forte para a mais fraca. */
export function rankTeams(teams: readonly Team[]): Team[] {
  return [...teams].sort((a, b) => teamStrength(b) - teamStrength(a) || compareText(a.id, b.id));
}

/** Grid completo de uma categoria: 10 equipes, cada uma com dois titulares e um reserva. */
export function buildCategoryField(
  categoryId: CategoryId,
  careerSeed: number,
  season: number,
  usedNames: Set<string> = new Set(),
): { teams: Team[]; drivers: Driver[] } {
  const category = getCategory(categoryId);
  const teams = initialTeams(categoryId);
  const drivers: Driver[] = [];
  rankTeams(teams).forEach((team, rank) => {
    for (const role of ['first', 'second', 'reserve'] as const) {
      const id = `${categoryId}-s${season}-${rank}-${role}`;
      drivers.push(generateDriver({ id, seed: hashSeed(careerSeed, 'driver', id), category, teamRank: rank, teamId: team.id, role, season, usedNames }));
    }
  });
  return { teams, drivers };
}

/** Reserva gerado para uma equipe que não tem um. */
export function generateReserve(
  category: CategoryDefinition,
  team: Team,
  teamRank: number,
  careerSeed: number,
  season: number,
  usedNames: Set<string>,
): Driver {
  const id = `${category.id}-s${season}-${team.id}-reserve`;
  return generateDriver({ id, seed: hashSeed(careerSeed, 'driver', id), category, teamRank, teamId: team.id, role: 'reserve', season, usedNames });
}
