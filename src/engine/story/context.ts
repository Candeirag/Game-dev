/**
 * O momento em que um cartão é sorteado: quem é o piloto, onde ele corre, o que aconteceu na etapa
 * recém-disputada (as marcas `RaceTag`) e a sua posição no campeonato. As condições dos dados
 * (`conditions.ts`) e os vínculos (`bindings.ts`) leem só daqui.
 */
import { STORY_EVENTS } from '@/config/balance';
import type { Birth, CareerState, Driver, RaceEntryResult, RoundRecord, StoryMemory, Team } from '@/domain/schemas';
import type { RaceTag, SeasonPart } from '@/domain/storyEvents';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { activeBirth } from '../birth/effects';
import { driverStandings, getPlayer, getTeammate } from '../career/selectors';
import { storyOf } from './memory';

export interface StoryContext {
  career: CareerState;
  story: StoryMemory;
  player: Driver;
  team: Team | null;
  teammate: Driver | null;
  category: CategoryDefinition;
  /** Etapa recém-disputada (null no começo da temporada). */
  record: RoundRecord | null;
  entry: RaceEntryResult | null;
  /** Etapa (0 = começo da temporada, antes da primeira corrida). */
  round: number;
  /** Posição no campeonato (antes da segunda etapa, a da temporada anterior ou o meio do grid). */
  standing: number;
  tags: ReadonlySet<RaceTag>;
  birth: Birth | null;
  /** Temporada deste personagem (1 = a primeira dele). */
  characterSeason: number;
}

/** O outro piloto de um toque com o jogador nesta corrida e quem atacou. */
export function incidentWithPlayer(career: CareerState, record: RoundRecord | null): { otherId: string; playerAttacked: boolean } | null {
  const id = career.playerDriverId;
  for (const e of record?.race.events ?? []) {
    if (!e.otherDriverId || (e.type !== 'collision' && e.type !== 'dnf')) continue;
    if (e.driverId !== id && e.otherDriverId !== id) continue;
    return { otherId: e.driverId === id ? e.otherDriverId : e.driverId, playerAttacked: e.type === 'collision' && e.driverId === id };
  }
  return null;
}

/** A rivalidade nascida num lance desta etapa (Fase 4), se houver. */
export function freshRivalryThisRound(career: CareerState, round: number): string | null {
  const log = career.relations.rivalryLog;
  for (let i = log.length - 1; i >= 0; i--) {
    const r = log[i];
    if (r && r.season === career.season && r.round === round && r.fresh) return r.driverId;
  }
  return null;
}

function raceTags(career: CareerState, record: RoundRecord | null, entry: RaceEntryResult | null, teammate: Driver | null, round: number): Set<RaceTag> {
  const tags = new Set<RaceTag>();
  if (!record) return tags;
  if (!entry) {
    tags.add('absent');
    return tags;
  }
  const finished = entry.status === 'finished';
  if (finished) {
    if (entry.position === 1) tags.add('win');
    if (entry.position <= 3) tags.add('podium');
    tags.add(entry.points > 0 ? 'points' : 'noPoints');
    if (entry.grid - entry.position >= STORY_EVENTS.PLACES_SWING) tags.add('gainedPlaces');
    if (entry.position - entry.grid >= STORY_EVENTS.PLACES_SWING) tags.add('lostPlaces');
  } else {
    tags.add('dnf');
    if (entry.dnfReason === 'crash' || entry.dnfReason === 'fuel') tags.add('crash');
    if (entry.dnfReason === 'mechanical' || entry.dnfReason === 'damage') tags.add('mechanical');
  }
  const incident = incidentWithPlayer(career, record);
  if (incident) {
    tags.add('contact');
    tags.add(incident.playerAttacked ? 'contactCulprit' : 'contactVictim');
  }
  if (entry.penaltySeconds > 0 || entry.penaltyPoints > 0) tags.add('penalized');
  if (entry.grid === 1) tags.add('pole');
  if (entry.injured) tags.add('injured');
  if (record.race.fastestLap?.driverId === entry.driverId) tags.add('fastestLap');
  if (record.race.weather.wetness >= STORY_EVENTS.WET_RACE) tags.add('wet');
  const mate = teammate ? record.race.entries.find((e) => e.driverId === teammate.id) : undefined;
  if (mate && finished) {
    if (mate.status !== 'finished' || mate.position > entry.position) tags.add('beatTeammate');
    else tags.add('behindTeammate');
  } else if (mate && mate.status === 'finished') tags.add('behindTeammate');
  for (const m of record.race.moments) {
    if (m.success && !m.auto && m.chance < STORY_EVENTS.RISKY_MOMENT_CHANCE) tags.add('momentWon');
    if (m.outcome === 'spin' || m.outcome === 'touch' || m.outcome === 'retired') tags.add('momentLost');
  }
  if (freshRivalryThisRound(career, round)) tags.add('newRivalry');
  return tags;
}

/** Temporada deste personagem: conta a partir de quando ele entrou na dinastia. */
function characterSeasonOf(career: CareerState): number {
  const since = career.dynasty.lineage[career.dynasty.lineage.length - 1]?.fromSeason ?? 1;
  return career.season - since + 1;
}

export function buildContext(career: CareerState, record: RoundRecord | null, round: number): StoryContext {
  const player = getPlayer(career);
  const team = career.teams.find((t) => t.id === player.teamId) ?? null;
  const teammate = team ? getTeammate(career) : null;
  const entry = record?.race.entries.find((e) => e.driverId === player.id) ?? null;
  const lastSeason = career.history[career.history.length - 1]?.playerPosition ?? Math.ceil(career.drivers.filter((d) => d.teamId).length / 2);
  const standing = career.rounds.length >= 2 ? (driverStandings(career).find((s) => s.driverId === player.id)?.position ?? lastSeason) : lastSeason;
  return {
    career,
    story: storyOf(career),
    player,
    team,
    teammate,
    category: getCategory(career.categoryId),
    record,
    entry,
    round,
    standing,
    tags: raceTags(career, record, entry, teammate, round),
    birth: activeBirth(career),
    characterSeason: characterSeasonOf(career),
  };
}

/** Em que parte da temporada está a etapa (0 = começo, antes da primeira corrida). */
export function seasonPart(round: number, total: number): SeasonPart {
  if (round <= 0) return 'start';
  if (round >= total) return 'finale';
  if (round <= total / 3) return 'early';
  if (round <= (2 * total) / 3) return 'middle';
  return 'late';
}
