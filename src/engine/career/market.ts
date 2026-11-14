/**
 * Mercado: interesse das equipes no jogador e movimentação dos pilotos da IA
 * entre as temporadas.
 */
import type { CareerState, CategoryId, Driver, Team } from '@/domain/schemas';
import { categoryByTier, getCategory, type CategoryDefinition } from '@/data/categories';
import { initialTeams } from '@/data/teams';
import { computeDriverStandings } from '../championship/standings';
import { hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { generateDriver, rankTeams, teamStrength } from '../world/generation';
import { driverStandings, fullName, getPlayer, teamKey } from './selectors';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

export const MARKET = {
  /** O interesse anda 35% do caminho até o alvo a cada etapa. */
  INTEREST_SPEED: 0.35,
  /** As melhores equipes são mais exigentes: até 28 pontos a menos de interesse. */
  TOP_TEAM_SELECTIVITY: 28,
  /** Subir de categoria exige mais; descer, menos. */
  PROMOTION_PENALTY: 8,
  DEMOTION_BONUS: 15,
  /** Equipes ligadas à academia do piloto olham para ele com mais atenção. */
  ACADEMY_BONUS: 15,
} as const;

/** Equipes de uma categoria: as do save, se for a atual; senão, as iniciais da categoria. */
export function teamsOfCategory(career: CareerState, categoryId: CategoryId): Team[] {
  return categoryId === career.categoryId ? career.teams : initialTeams(categoryId);
}

/** Categorias vizinhas (um degrau abaixo, a atual e um degrau acima). */
export function reachableCategories(career: CareerState): CategoryDefinition[] {
  const tier = getCategory(career.categoryId).tier;
  return [tier - 1, tier, tier + 1].map(categoryByTier).filter((c): c is CategoryDefinition => c !== undefined);
}

/**
 * Interesse-alvo de uma equipe no jogador (0 a 100):
 * 40% desempenho no campeonato, 30% adequação do nível ao da categoria,
 * 20% reputação e 10% juventude, menos a exigência da equipe. A equipe atual
 * pondera também a confiança que tem no piloto.
 */
export function targetInterest(career: CareerState, category: CategoryDefinition, team: Team, rank: number, reputation = career.reputation): number {
  const player = getPlayer(career);
  const current = getCategory(career.categoryId);
  const standings = driverStandings(career);
  const me = standings.find((s) => s.driverId === player.id);
  const field = Math.max(2, standings.length);
  const performance = career.rounds.length >= 2 && me ? (field - me.position) / (field - 1) : 0.45;
  const fit = clamp(0.5 + (overallRating(player.attributes) - category.field.driverLevel) / 20, 0, 1);
  const youth = clamp((category.field.maxAge - player.age) / Math.max(1, category.field.maxAge - category.field.minAge), 0, 1);
  let value = 100 * (0.4 * performance + 0.3 * fit + 0.2 * (reputation / 100) + 0.1 * youth);
  value -= ((9 - rank) / 9) * MARKET.TOP_TEAM_SELECTIVITY;
  if (category.tier > current.tier) value -= MARKET.PROMOTION_PENALTY;
  if (category.tier < current.tier) value += MARKET.DEMOTION_BONUS;
  if (career.academy && team.affiliation === career.academy.f1TeamId) value += MARKET.ACADEMY_BONUS;
  if (category.id === career.categoryId && team.id === player.teamId) value = 0.6 * value + 0.4 * career.relations.teamTrust;
  return clamp(value);
}

/** Atualiza o interesse de todas as equipes alcançáveis. `speed` = 1 recalcula do zero. */
export function updateMarketInterest(career: CareerState, speed: number = MARKET.INTEREST_SPEED): Record<string, number> {
  const interest: Record<string, number> = {};
  for (const category of reachableCategories(career)) {
    rankTeams(teamsOfCategory(career, category.id)).forEach((team, rank) => {
      const key = teamKey(category.id, team.id);
      const target = targetInterest(career, category, team, rank);
      const previous = career.marketInterest[key];
      interest[key] = Math.round((previous === undefined ? target * 0.85 : previous + (target - previous) * speed) * 10) / 10;
    });
  }
  return interest;
}

/* ------------------------------------------------------------------ */
/* Mercado de pilotos da IA                                            */
/* ------------------------------------------------------------------ */

export interface MarketResult {
  drivers: Driver[];
  /** Movimentações mais relevantes, para o noticiário. */
  news: string[];
}

/**
 * Movimentação da IA dentro da categoria, entre duas temporadas.
 *
 * 1. Saídas: os três melhores da IA no campeonato sobem de categoria (exceto
 *    na F1); quem passou da idade da categoria sai; na F1, aposenta-se quem
 *    tem 38 anos ou mais, ou 34 e nível abaixo do grid.
 * 2. Ficam livres: quem saiu de contrato, os reservas e o segundo piloto que
 *    superou o primeiro da própria equipe (insatisfeito, pede para sair).
 * 3. Chegadas: estreantes gerados para repor as saídas.
 * 4. As equipes escolhem, da mais forte para a mais fraca, o melhor piloto
 *    livre (nível + pontos da temporada). A vaga do jogador já está definida.
 * 5. Em cada equipe, o piloto de maior valor de mercado é o primeiro piloto,
 *    salvo quando o contrato do jogador diz o contrário.
 */
export function runAiMarket(
  career: CareerState,
  drivers: readonly Driver[],
  teams: readonly Team[],
  player: { teamId: string; role: 'first' | 'second' },
  nextSeason: number,
): MarketResult {
  const category = getCategory(career.categoryId);
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const pointsOf = new Map(standings.map((s) => [s.driverId, s.points]));
  const maxPoints = Math.max(1, ...standings.map((s) => s.points));
  const value = (d: Driver) => overallRating(d.attributes) + 6 * ((pointsOf.get(d.id) ?? 0) / maxPoints) + Math.max(0, 22 - d.age) * 0.3;
  const news: string[] = [];
  const ai = drivers.filter((d) => !d.isPlayer);
  const usedNames = new Set(drivers.map(fullName));

  // 1. Saídas.
  const leaving = new Set<string>();
  if (category.tier < 7) {
    for (const s of standings.filter((x) => x.driverId !== career.playerDriverId).slice(0, 3)) {
      const d = ai.find((x) => x.id === s.driverId);
      if (d && d.teamId && s.position <= 5) {
        leaving.add(d.id);
        news.push(`${fullName(d)} (${s.position}º) sobe de categoria.`);
      }
    }
  }
  for (const d of ai) {
    if (leaving.has(d.id)) continue;
    const tooOld = category.tier < 7 ? d.age > category.field.maxAge + 1 : d.age >= 38 || (d.age >= 34 && overallRating(d.attributes) < category.field.driverLevel - 5);
    if (tooOld) {
      leaving.add(d.id);
      if (d.role !== 'reserve' && d.teamId) news.push(category.tier < 7 ? `${fullName(d)} deixa a categoria.` : `${fullName(d)} anuncia a aposentadoria.`);
    }
  }
  const staying = ai.filter((d) => !leaving.has(d.id));

  // 2. Quem fica livre.
  const unhappy = new Set<string>();
  for (const team of teams) {
    const first = staying.find((d) => d.teamId === team.id && d.role === 'first');
    const second = staying.find((d) => d.teamId === team.id && d.role === 'second');
    if (first && second && (pointsOf.get(second.id) ?? 0) > (pointsOf.get(first.id) ?? 0) * 1.25 + 5) unhappy.add(second.id);
  }
  const seats = new Map<string, Driver[]>(teams.map((t) => [t.id, []]));
  const free: Driver[] = [];
  for (const d of staying) {
    const displacedByPlayer = d.teamId === player.teamId && d.role === player.role;
    const keeps = d.teamId !== null && d.role !== 'reserve' && d.contractEnd >= nextSeason && !unhappy.has(d.id) && !displacedByPlayer;
    if (keeps && (seats.get(d.teamId ?? '')?.length ?? 2) < (d.teamId === player.teamId ? 1 : 2)) seats.get(d.teamId ?? '')?.push(d);
    else free.push({ ...d, teamId: null, role: null });
  }

  // 3. Estreantes: um para cada saída, mais três de margem.
  const ranked = rankTeams(teams);
  for (let i = 0; i < leaving.size + 3; i++) {
    const id = `${category.id}-s${nextSeason}-rookie-${i}`;
    free.push(generateDriver({ id, seed: hashSeed(career.seed, 'driver', id), category, teamRank: 4 + (i % 5), teamId: null, role: 'second', season: nextSeason, usedNames, rookie: true }));
  }

  // 4. Preenchimento das vagas, da equipe mais forte para a mais fraca.
  free.sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id));
  const previousTeam = new Map(drivers.map((d) => [d.id, d.teamId]));
  for (const team of ranked) {
    const list = seats.get(team.id) ?? [];
    const capacity = team.id === player.teamId ? 1 : 2;
    while (list.length < capacity && free.length > 0) {
      const pick = free.shift();
      if (!pick) break;
      const years = 1 + (hashSeed(career.seed, 'contract', pick.id, nextSeason) % 2);
      list.push({ ...pick, teamId: team.id, contractEnd: nextSeason + years - 1 });
      const from = previousTeam.get(pick.id);
      if (from !== team.id && news.length < 8) {
        const origin = teams.find((t) => t.id === from);
        news.push(origin ? `${fullName(pick)} troca a ${origin.name} pela ${team.name}.` : `${fullName(pick)} assina com a ${team.name}.`);
      }
    }
    seats.set(team.id, list);
  }

  // 5. Papéis e reservas.
  const result: Driver[] = [];
  for (const team of ranked) {
    const list = [...(seats.get(team.id) ?? [])].sort((a, b) => value(b) - value(a));
    if (team.id === player.teamId) {
      const mate = list[0];
      if (mate) result.push({ ...mate, role: player.role === 'first' ? 'second' : 'first' });
    } else {
      list.forEach((d, i) => result.push({ ...d, role: i === 0 ? 'first' : 'second' }));
    }
    // Reserva: o piloto livre mais jovem entre os melhores que sobraram.
    const reserveIndex = free.findIndex((d) => d.age <= category.field.minAge + Math.ceil((category.field.maxAge - category.field.minAge) * 0.6));
    const reserve = free.splice(reserveIndex >= 0 ? reserveIndex : 0, 1)[0];
    if (reserve) result.push({ ...reserve, teamId: team.id, role: 'reserve', contractEnd: nextSeason });
  }
  return { drivers: result, news: news.slice(0, 8) };
}

/** Os melhores pilotos da IA que acompanham o jogador quando ele sobe de categoria. */
export function promotedRivals(career: CareerState, next: CategoryDefinition, limit = 4): Driver[] {
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const rivals: Driver[] = [];
  for (const s of standings) {
    if (rivals.length >= limit || s.position > 6) break;
    const d = career.drivers.find((x) => x.id === s.driverId);
    if (d && !d.isPlayer && d.age + 1 <= next.field.maxAge) rivals.push(d);
  }
  return rivals;
}

export { teamStrength };
