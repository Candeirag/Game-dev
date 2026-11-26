/**
 * Placar e árvore da dinastia (Fase 6).
 *
 * Tudo aqui é leitura: a tela da família e o simulador perguntam o que cada geração fez (títulos,
 * vitórias, pódios, equipes em que correu e que dirigiu, temporadas, reputação, patrimônio deixado)
 * e quem é quem na família (o personagem de cada geração, o parceiro, os filhos atuais, os parentes
 * e quem passou o comando em vida). As fontes são a linhagem, as temporadas arquivadas e a temporada
 * em curso; nada é gravado.
 */
import type { BirthTrait, CareerState, CategoryId, ChildTrait, Elder, LineageEntry, Relative, RoundRecord, SeasonSummary, TraitId } from '@/domain/schemas';
import { BIRTH_TRAITS } from '@/data/birth';
import { getCategory } from '@/data/categories';
import { initialTeams } from '@/data/teams';
import { activeBirth } from '../birth/effects';
import { computeDriverStandings } from '../championship/standings';
import { archiveSeason } from '../career/offseason';
import { fullName, getPlayer } from '../career/selectors';
import { managedTeam } from '../management/team';
import { heritageTraitsFor } from './heritage';
import { familyYear, relativeAge } from './relatives';

/** Títulos e vitórias de um personagem como piloto, a partir das temporadas arquivadas. */
export function drivingRecord(seasons: readonly SeasonSummary[], driverId: string): { titles: number; wins: number } {
  let titles = 0;
  let wins = 0;
  for (const s of seasons) {
    if (s.mode !== 'driver') continue;
    const row = s.driverStandings.find((d) => d.driverId === driverId);
    if (!row) continue;
    wins += row.wins;
    if (row.position === 1) titles += 1;
  }
  return { titles, wins };
}

/** A equipe pela qual um piloto correu a última etapa que disputou nas etapas dadas (null: nenhuma). */
export function lastRaceTeam(rounds: readonly RoundRecord[], driverId: string): string | null {
  for (let i = rounds.length - 1; i >= 0; i--) {
    const entry = rounds[i]?.race.entries.find((e) => e.driverId === driverId);
    if (entry) return entry.teamId;
  }
  return null;
}

/** Uma temporada vista pelo placar: arquivada, fechada ou em curso (`closed: false`, sem título). */
interface SeasonView {
  season: number;
  categoryId: CategoryId;
  mode: 'driver' | 'executive';
  teamName: string | null;
  standings: readonly { driverId: string; position: number; wins: number }[];
  rounds: readonly RoundRecord[];
  closed: boolean;
}

function viewOf(summary: SeasonSummary): SeasonView {
  return {
    season: summary.season,
    categoryId: summary.categoryId,
    mode: summary.mode,
    teamName: summary.playerTeamId ? summary.playerTeamName : null,
    standings: summary.driverStandings,
    rounds: summary.rounds,
    closed: true,
  };
}

/** As temporadas da carreira inteira: as arquivadas e a atual (fechada ou em curso). */
function seasonViews(career: CareerState): SeasonView[] {
  const views = career.history.map(viewOf);
  const player = getPlayer(career);
  const playerTeam = career.teams.find((t) => t.id === player.teamId);
  if (career.offseason && playerTeam) return [...views, viewOf(archiveSeason(career))];
  if (career.executiveOffseason) return [...views, viewOf(career.executiveOffseason.summary)];
  // Em curso (ou, num save antigo, fechada sem a vaga do jogador): a classificação até aqui.
  const teamName = career.mode === 'driver' ? (playerTeam?.name ?? null) : (managedTeam(career)?.name ?? null);
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  return [
    ...views,
    { season: career.season, categoryId: career.categoryId, mode: career.mode, teamName, standings, rounds: career.rounds, closed: career.offseason !== null },
  ];
}

/**
 * A temporada em que quem saiu no meio do ano (acidente) deixou o resto para quem assumiu os negócios,
 * vista por quem saiu: uma temporada de piloto, pela equipe das etapas que correu. O nome vem das
 * equipes da temporada em curso ou, numa arquivada, das equipes da categoria.
 */
function asDriverSeason(career: CareerState, view: SeasonView, driverId: string): SeasonView {
  const teamId = lastRaceTeam(view.rounds, driverId);
  const teams = view.season === career.season ? career.teams : initialTeams(view.categoryId);
  return { ...view, mode: 'driver', teamName: teams.find((t) => t.id === teamId)?.name ?? null };
}

const unique = (names: readonly (string | null)[]) => names.filter((n, i, all): n is string => n !== null && all.indexOf(n) === i);

const podiumsIn = (rounds: readonly RoundRecord[], driverId: string) =>
  rounds.filter((r) => r.race.entries.some((e) => e.driverId === driverId && e.status === 'finished' && e.position <= 3)).length;

/** O que uma geração fez, para o placar da dinastia. */
export interface GenerationRecord {
  generation: number;
  driverId: string;
  name: string;
  bornYear: number;
  fromSeason: number;
  /** null: a geração atual. */
  toSeason: number | null;
  fromYear: number;
  toYear: number | null;
  current: boolean;
  /** Como assumiu a família (null: o fundador ou save antigo). */
  path: LineageEntry['path'];
  endReason: LineageEntry['endReason'];
  bestCategoryId: CategoryId | null;
  titles: number;
  wins: number;
  podiums: number;
  /** Equipes em que correu e que dirigiu, na ordem, sem repetir. */
  drivenTeams: string[];
  managedTeams: string[];
  driverSeasons: number;
  executiveSeasons: number;
  peakReputation: number;
  netWorthPassed: number | null;
  /** Talentos e defeitos de nascença (com as marcas de revelação). */
  traits: BirthTrait[];
  partnerName: string | null;
}

/**
 * O placar de cada geração, da primeira à atual. Títulos e vitórias de quem já passou a família
 * adiante são os gravados na linhagem quando a geração terminou (a mesma conta de `drivingRecord`,
 * com as vitórias de uma temporada interrompida por acidente); os da geração atual saem das
 * temporadas arquivadas e da fechada agora, e as vitórias contam também as da temporada em curso. Um
 * título só conta com a temporada fechada. Os pódios saem sempre das etapas.
 *
 * Quando alguém sai no meio do ano e quem assume vai para os negócios, a temporada é das duas
 * gerações: de piloto para quem saiu (com a equipe das etapas) e de dirigente para quem entrou.
 */
export function generationRecords(career: CareerState): GenerationRecord[] {
  const views = seasonViews(career);
  const lineage = career.dynasty.lineage;
  const yearOf = (season: number) => career.year - (career.season - season);
  return lineage.map((entry, index) => {
    const current = index === lineage.length - 1;
    const to = entry.toSeason ?? career.season;
    const next = lineage[index + 1];
    const shared = next && entry.toSeason !== null && next.fromSeason === entry.toSeason ? entry.toSeason : null;
    const mine = views
      .filter((v) => v.season >= entry.fromSeason && v.season <= to)
      .map((v) => (v.season === shared ? asDriverSeason(career, v, entry.driverId) : v));
    const driving = mine.filter((v) => v.mode === 'driver');
    const managing = mine.filter((v) => v.mode === 'executive');
    const row = (v: SeasonView) => v.standings.find((s) => s.driverId === entry.driverId);
    let best = entry.bestCategoryId;
    if (current && career.mode === 'driver' && (!best || getCategory(career.categoryId).tier > getCategory(best).tier)) best = career.categoryId;
    const partner = career.family.partner;
    return {
      generation: entry.generation,
      driverId: entry.driverId,
      name: entry.name,
      bornYear: entry.bornYear,
      fromSeason: entry.fromSeason,
      toSeason: entry.toSeason,
      fromYear: yearOf(entry.fromSeason),
      toYear: entry.toSeason === null ? null : yearOf(entry.toSeason),
      current,
      path: entry.path,
      endReason: entry.endReason,
      bestCategoryId: best,
      titles: current ? driving.filter((v) => v.closed && row(v)?.position === 1).length : entry.titles,
      wins: current ? driving.reduce((sum, v) => sum + (row(v)?.wins ?? 0), 0) : entry.wins,
      podiums: driving.reduce((sum, v) => sum + podiumsIn(v.rounds, entry.driverId), 0),
      drivenTeams: unique(driving.map((v) => v.teamName)),
      managedTeams: unique(managing.map((v) => v.teamName)),
      driverSeasons: driving.length,
      executiveSeasons: managing.length,
      peakReputation: current ? Math.max(entry.peakReputation, career.reputation) : entry.peakReputation,
      netWorthPassed: entry.netWorthPassed,
      traits: current ? (activeBirth(career)?.traits ?? entry.traits) : entry.traits,
      partnerName: current ? (partner ? `${partner.firstName} ${partner.lastName}` : null) : entry.partnerName,
    };
  });
}

/** As somas da dinastia inteira. */
export interface DynastyTotals {
  generations: number;
  titles: number;
  wins: number;
  podiums: number;
  driverSeasons: number;
  executiveSeasons: number;
  /** Equipes diferentes em que a família correu ou que dirigiu. */
  teams: number;
  bestCategoryId: CategoryId | null;
}

export function dynastyTotals(career: CareerState): DynastyTotals {
  const records = generationRecords(career);
  const sum = (key: 'titles' | 'wins' | 'podiums' | 'driverSeasons' | 'executiveSeasons') => records.reduce((total, r) => total + r[key], 0);
  let best: CategoryId | null = null;
  for (const r of records) if (r.bestCategoryId && (!best || getCategory(r.bestCategoryId).tier > getCategory(best).tier)) best = r.bestCategoryId;
  return {
    generations: records.length,
    titles: sum('titles'),
    wins: sum('wins'),
    podiums: sum('podiums'),
    driverSeasons: sum('driverSeasons'),
    executiveSeasons: sum('executiveSeasons'),
    teams: unique(records.flatMap((r) => [...r.drivenTeams, ...r.managedTeams])).length,
    bestCategoryId: best,
  };
}

/* ------------------------------------------------------------------ */
/* Árvore da família                                                   */
/* ------------------------------------------------------------------ */

export interface FamilyTreeChild {
  id: string;
  name: string;
  age: number;
  stage: 'child' | 'karting' | 'racing' | 'other';
  traits: ChildTrait[];
  /** Talentos e defeitos de nascença já revelados e quantos ainda estão ocultos. */
  revealed: readonly { id: TraitId; kind: 'talent' | 'defect' }[];
  hidden: number;
}

export interface FamilyTreeRelative {
  id: string;
  name: string;
  age: number;
  path: Relative['path'];
  skill: number;
  bond: number;
  racedTo: CategoryId | null;
}

export interface FamilyTreeGeneration {
  generation: number;
  driverId: string;
  name: string;
  bornYear: number;
  path: LineageEntry['path'];
  endReason: LineageEntry['endReason'];
  current: boolean;
  /** Vivo: a geração atual ou quem passou o comando em vida e segue vivo (está em `dynasty.elders`). */
  alive: boolean;
  /** O papel de quem passou o comando em vida (null: não é o caso). */
  elderRole: Elder['role'] | null;
  partnerName: string | null;
  /** Os filhos atuais (só na geração atual). */
  children: FamilyTreeChild[];
  /** Os filhos desta geração que não herdaram a carreira. */
  relatives: FamilyTreeRelative[];
}

export interface FamilyTree {
  surname: string;
  generations: FamilyTreeGeneration[];
  /** Quem passou o comando em vida e segue vivo, do mais antigo ao mais recente. */
  elders: Elder[];
}

/**
 * A árvore da família: as gerações em ordem, com parceiro, filhos e parentes de cada uma. As idades
 * dos parentes seguem a mesma referência que as dos filhos (`familyYear`: o ano seguinte, no
 * fechamento da temporada).
 */
export function familyTree(career: CareerState): FamilyTree {
  const { dynasty } = career;
  const partner = career.family.partner;
  const year = familyYear(career);
  const generations = dynasty.lineage.map((entry, index): FamilyTreeGeneration => {
    const current = index === dynasty.lineage.length - 1;
    const elder = dynasty.elders.find((e) => e.driverId === entry.driverId) ?? null;
    const children = current
      ? career.family.children.map((child): FamilyTreeChild => {
          const traits = heritageTraitsFor(career, child);
          const revealed = traits.filter((t) => t.revealedSeason !== null).map((t) => ({ id: t.id, kind: BIRTH_TRAITS[t.id].kind }));
          return {
            id: child.id,
            name: fullName(child),
            age: child.age,
            stage: child.stage,
            traits: child.traits,
            revealed,
            hidden: traits.length - revealed.length,
          };
        })
      : [];
    const relatives = dynasty.relatives
      .filter((r) => r.generation === entry.generation)
      .map(
        (r): FamilyTreeRelative => ({
          id: r.id,
          name: fullName(r),
          age: relativeAge(r, year),
          path: r.path,
          skill: r.skill,
          bond: r.bond,
          racedTo: r.racedTo,
        }),
      );
    return {
      generation: entry.generation,
      driverId: entry.driverId,
      name: entry.name,
      bornYear: entry.bornYear,
      path: entry.path,
      endReason: entry.endReason,
      current,
      alive: current || elder !== null,
      elderRole: elder?.role ?? null,
      partnerName: current ? (partner ? `${partner.firstName} ${partner.lastName}` : null) : entry.partnerName,
      children,
      relatives,
    };
  });
  return { surname: dynasty.surname, generations, elders: dynasty.elders };
}
