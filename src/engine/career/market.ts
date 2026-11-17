/**
 * Mercado: interesse das equipes no jogador e movimentação dos pilotos da IA
 * entre as temporadas.
 */
import type { CareerState, CategoryId, Driver, Team } from '@/domain/schemas';
import { compareText } from '@/domain/text';
import { categoryByTier, getCategory, type CategoryDefinition } from '@/data/categories';
import { initialTeams } from '@/data/teams';
import { computeDriverStandings } from '../championship/standings';
import { hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { generateDriver, rankTeams } from '../world/generation';
import { driverStandings, fullName, getPlayer, teamKey } from './selectors';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

export const MARKET = {
  /** O interesse anda 35% do caminho até o alvo a cada etapa. */
  INTEREST_SPEED: 0.35,
  /**
   * Equivalência entre categorias: uma posição no campeonato vale seis posições
   * a menos no degrau de cima (ser 1º equivale a ser 7º) e seis a mais no de baixo.
   */
  TIER_POSITION_SHIFT: 6,
  /** Equipes ligadas à academia do piloto olham para ele com mais atenção. */
  ACADEMY_BONUS: 15,
} as const;

/** Equipes de uma categoria: as do save, se for a atual; senão, as iniciais da categoria. */
export function teamsOfCategory(career: CareerState, categoryId: CategoryId): Team[] {
  return categoryId === career.categoryId ? career.teams : initialTeams(categoryId);
}

/**
 * Categorias em que o jogador pode correr na próxima temporada: um degrau
 * abaixo, o atual e um acima. Há um atalho, como na vida real: do kart
 * nacional já se pode ir direto para a Fórmula Júnior, sem passar pelo kart
 * internacional, desde que os requisitos dela sejam cumpridos.
 */
export function reachableCategories(career: CareerState): CategoryDefinition[] {
  const tier = getCategory(career.categoryId).tier;
  const tiers = [tier - 1, tier, tier + 1];
  if (career.categoryId === 'kart-national') tiers.push(tier + 2);
  return tiers.map(categoryByTier).filter((c): c is CategoryDefinition => c !== undefined);
}

/**
 * Interesse-alvo de uma equipe no jogador (0 a 100). Cada equipe avalia o
 * piloto em relação ao que ela mesma espera:
 * - 45% desempenho: posição no campeonato comparada à meta da equipe (estar
 *   duas posições abaixo da meta vale 50%; cada posição soma ou tira 10%);
 * - 30% nível: nota geral comparada ao nível dos pilotos daquela equipe;
 * - 15% reputação e 10% juventude.
 * A equipe atual pondera também a confiança que tem no piloto.
 */
export function targetInterest(career: CareerState, category: CategoryDefinition, team: Team, rank: number, reputation = career.reputation): number {
  const player = getPlayer(career);
  const current = getCategory(career.categoryId);
  const me = driverStandings(career).find((s) => s.driverId === player.id);
  // No atalho do kart nacional para a Fórmula Júnior, o salto conta como um degrau só.
  const steps = Math.max(-1, Math.min(1, category.tier - current.tier));
  const equivalentPosition = (me?.position ?? 12) + steps * MARKET.TIER_POSITION_SHIFT;
  const performance = career.rounds.length >= 2 ? clamp(0.5 + (team.driverTarget + 2 - equivalentPosition) / 10, 0, 1) : 0.4;
  const teamLevel = category.field.driverLevel + category.field.driverSpread * (0.5 - rank / 9);
  const fit = clamp(0.5 + (overallRating(player.attributes) - teamLevel) / 12, 0, 1);
  const youth = clamp((category.field.maxAge - player.age) / Math.max(1, category.field.maxAge - category.field.minAge), 0, 1);
  let value = 100 * (0.45 * performance + 0.3 * fit + 0.15 * (reputation / 100) + 0.1 * youth);
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
 *    no Grand Prix Mundial); quem passou da idade da categoria sai; no Grand Prix Mundial, aposenta-se quem
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
  /** Equipe cuja dupla já foi definida (a que o jogador dirige): [primeiro piloto, segundo piloto]. */
  reserved?: { teamId: string; drivers: readonly Driver[] },
): MarketResult {
  const category = getCategory(career.categoryId);
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const pointsOf = new Map(standings.map((s) => [s.driverId, s.points]));
  const maxPoints = Math.max(1, ...standings.map((s) => s.points));
  const value = (d: Driver) => overallRating(d.attributes) + 6 * ((pointsOf.get(d.id) ?? 0) / maxPoints) + Math.max(0, 22 - d.age) * 0.3;
  const news: string[] = [];
  const reservedIds = new Set(reserved?.drivers.map((d) => d.id) ?? []);
  const ai = drivers.filter((d) => !d.isPlayer && !reservedIds.has(d.id));
  const usedNames = new Set([...drivers, ...(reserved?.drivers ?? [])].map(fullName));
  const capacity = (teamId: string | null) => (teamId === reserved?.teamId ? 0 : teamId === player.teamId ? 1 : 2);

  // 1. Saídas.
  const leaving = new Set<string>();
  if (category.tier < 7) {
    for (const s of standings.filter((x) => x.driverId !== career.playerDriverId).slice(0, 3)) {
      const d = ai.find((x) => x.id === s.driverId);
      if (d?.teamId && s.position <= 5) {
        leaving.add(d.id);
        news.push(`${fullName(d)} (${s.position}º) sobe de categoria.`);
      }
    }
  }
  for (const d of ai) {
    if (leaving.has(d.id)) continue;
    const tooOld =
      category.tier < 7 ? d.age > category.field.maxAge + 1 : d.age >= 38 || (d.age >= 34 && overallRating(d.attributes) < category.field.driverLevel - 5);
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
    if (keeps && (seats.get(d.teamId ?? '')?.length ?? 2) < capacity(d.teamId)) seats.get(d.teamId ?? '')?.push(d);
    else free.push({ ...d, teamId: null, role: null });
  }

  // 3. Estreantes: um para cada saída, mais três de margem.
  const ranked = rankTeams(teams);
  for (let i = 0; i < leaving.size + 3; i++) {
    const id = `${category.id}-s${nextSeason}-rookie-${i}`;
    free.push(
      generateDriver({
        id,
        seed: hashSeed(career.seed, 'driver', id),
        category,
        teamRank: 4 + (i % 5),
        teamId: null,
        role: 'second',
        season: nextSeason,
        usedNames,
        rookie: true,
      }),
    );
  }

  // 4. Preenchimento das vagas, da equipe mais forte para a mais fraca.
  free.sort((a, b) => value(b) - value(a) || compareText(a.id, b.id));
  const previousTeam = new Map(drivers.map((d) => [d.id, d.teamId]));
  for (const team of ranked) {
    const list = seats.get(team.id) ?? [];
    while (list.length < capacity(team.id) && free.length > 0) {
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
    if (team.id === reserved?.teamId) {
      reserved.drivers.slice(0, 2).forEach((d, i) => {
        result.push({ ...d, teamId: team.id, role: i === 0 ? 'first' : 'second', contractEnd: Math.max(nextSeason, d.contractEnd) });
      });
    } else if (team.id === player.teamId) {
      const mate = list[0];
      if (mate) result.push({ ...mate, role: player.role === 'first' ? 'second' : 'first' });
    } else {
      list.forEach((d, i) => {
        result.push({ ...d, role: i === 0 ? 'first' : 'second' });
      });
    }
    // Reserva: o piloto livre mais jovem entre os melhores que sobraram.
    const reserveIndex = free.findIndex((d) => d.age <= category.field.minAge + Math.ceil((category.field.maxAge - category.field.minAge) * 0.6));
    const reserve = free.splice(Math.max(reserveIndex, 0), 1)[0];
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
