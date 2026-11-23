/**
 * Avaliação das condições dos dados (`StoryCondition`). Todas as condições de uma lista precisam
 * valer. As faixas citadas por nome (fase da vida, posição, indicador, caixa, atitude, aptidão)
 * têm os limites em STORY_EVENTS.
 */
import { STORY_EVENTS } from '@/config/balance';
import type { CareerState } from '@/domain/schemas';
import type { AgeStage, AttitudeLevel, StandingLevel, StatLevel, StoryCashLevel, StoryCondition, StoryHas, StoryStat } from '@/domain/storyEvents';
import { AGE_STAGES, STORY_CASH_LEVELS } from '@/domain/storyEvents';
import { SPONSOR_RULES, commercialSponsors, maxSponsors } from '../career/sponsors';
import { teamKey } from '../career/selectors';
import type { StoryContext } from './context';
import { freshRivalryThisRound, seasonPart } from './context';
import { findPerson, hasFlag } from './memory';

export function ageStage(age: number): AgeStage {
  let stage: AgeStage = 'teen';
  for (const s of AGE_STAGES) if (age >= STORY_EVENTS.AGE_STAGES[s]) stage = s;
  return stage;
}

export function cashLevel(career: CareerState, living: number): StoryCashLevel {
  const cash = career.finance.cash;
  if (cash < 0) return 'broke';
  if (cash < living * STORY_EVENTS.CASH_LEVELS.tight) return 'tight';
  if (cash < living * STORY_EVENTS.CASH_LEVELS.rich) return 'comfortable';
  return 'rich';
}

function inStanding(position: number, level: StandingLevel): boolean {
  const limit = STORY_EVENTS.STANDING_LEVELS[level];
  return level === 'backHalf' ? position >= limit : position <= limit;
}

function statLevelHolds(value: number, level: StatLevel): boolean {
  const limit = STORY_EVENTS.STAT_LEVELS[level];
  return level === 'veryLow' || level === 'low' ? value <= limit : value >= limit;
}

function attitudeHolds(value: number, level: AttitudeLevel): boolean {
  const limit = STORY_EVENTS.ATTITUDE_LEVELS[level];
  return level === 'hostile' || level === 'negative' ? value <= limit : value >= limit;
}

export function statValue(ctx: StoryContext, stat: StoryStat): number {
  const { career, player } = ctx;
  switch (stat) {
    case 'reputation':
      return career.reputation;
    case 'teamTrust':
      return career.relations.teamTrust;
    case 'teammateRelation':
      return career.relations.teammate;
    default:
      return player.condition[stat];
  }
}

/** Interesse alto de outra equipe da categoria atual (a maior), ou null. */
export function interestedTeam(ctx: StoryContext): { teamId: string; key: string; value: number } | null {
  let best: { teamId: string; key: string; value: number } | null = null;
  for (const team of ctx.career.teams) {
    if (team.id === ctx.team?.id) continue;
    const key = teamKey(ctx.career.categoryId, team.id);
    const value = ctx.career.marketInterest[key] ?? 0;
    if (value >= STORY_EVENTS.INTERESTED_MIN && (!best || value > best.value)) best = { teamId: team.id, key, value };
  }
  return best;
}

/**
 * O rival do momento: quem acabou de virar rival num toque de lance decisivo nesta etapa (Fase 4),
 * mesmo que a rivalidade ainda seja pequena; senão, o maior rival no grid atual (com equipe), se a
 * rivalidade passa do mínimo.
 */
export function topRivalId(ctx: StoryContext): string | null {
  const fresh = freshRivalryThisRound(ctx.career, ctx.round);
  if (fresh && ctx.career.drivers.some((d) => d.id === fresh && d.teamId && !d.isPlayer)) return fresh;
  let best: [string, number] | null = null;
  for (const [id, value] of Object.entries(ctx.career.relations.rivalries)) {
    if (value < STORY_EVENTS.RIVAL_MIN || !ctx.career.drivers.some((d) => d.id === id && d.teamId && !d.isPlayer)) continue;
    if (!best || value > best[1] || (value === best[1] && id < best[0])) best = [id, value];
  }
  return best?.[0] ?? null;
}

function has(ctx: StoryContext, what: StoryHas): boolean {
  const { career } = ctx;
  switch (what) {
    case 'teammate':
      return ctx.teammate !== null;
    case 'rival':
      return topRivalId(ctx) !== null;
    case 'commercialSponsor':
      return commercialSponsors(career.sponsors).length > 0;
    case 'freeSponsorSlot':
      return commercialSponsors(career.sponsors).length < maxSponsors(career);
    case 'unhappySponsor':
      return commercialSponsors(career.sponsors).some((s) => s.satisfaction < SPONSOR_RULES.PRESSURE_THRESHOLD);
    case 'partner':
      return career.family.partner !== null;
    case 'children':
      return career.family.children.length > 0;
    case 'injury':
      return ctx.player.injury !== null;
    case 'academy':
      return career.academy !== null;
    case 'seatCost':
      return career.contract.seatCost > 0;
    case 'investor':
      return career.investor !== null;
    case 'sideJob':
      return career.sideJob !== 'none';
    case 'interestedTeam':
      return interestedTeam(ctx) !== null;
    case 'debt':
      return career.finance.cash < 0;
    case 'loan':
      return career.finance.loans.length > 0;
  }
}

function cashAtLeast(level: StoryCashLevel, min: StoryCashLevel): boolean {
  return STORY_CASH_LEVELS.indexOf(level) >= STORY_CASH_LEVELS.indexOf(min);
}

export function conditionHolds(ctx: StoryContext, condition: StoryCondition): boolean {
  const { career, story } = ctx;
  switch (condition.c) {
    case 'tier':
      return (condition.min === undefined || ctx.category.tier >= condition.min) && (condition.max === undefined || ctx.category.tier <= condition.max);
    case 'age': {
      const stage = AGE_STAGES.indexOf(ageStage(ctx.player.age));
      return (
        (condition.from === undefined || stage >= AGE_STAGES.indexOf(condition.from)) &&
        (condition.to === undefined || stage <= AGE_STAGES.indexOf(condition.to))
      );
    }
    case 'careerSeason':
      return (condition.min === undefined || ctx.characterSeason >= condition.min) && (condition.max === undefined || ctx.characterSeason <= condition.max);
    case 'categoryDebut': {
      const last = career.history[career.history.length - 1];
      return !last || last.categoryId !== career.categoryId || last.mode !== 'driver';
    }
    case 'season':
      return seasonPart(ctx.round, career.calendar.length) === condition.part;
    case 'race':
      return ctx.tags.has(condition.tag);
    case 'notRace':
      return ctx.record !== null && !ctx.tags.has(condition.tag);
    case 'standing':
      return (
        (condition.in === undefined || inStanding(ctx.standing, condition.in)) && (condition.out === undefined || !inStanding(ctx.standing, condition.out))
      );
    case 'stat':
      return statLevelHolds(statValue(ctx, condition.stat), condition.level);
    case 'cash': {
      const level = cashLevel(career, ctx.category.economy.living);
      return (
        (condition.atLeast === undefined || cashAtLeast(level, condition.atLeast)) && (condition.atMost === undefined || cashAtLeast(condition.atMost, level))
      );
    }
    case 'trait':
      return ctx.birth?.traits.some((t) => t.id === condition.trait && t.revealedSeason !== null) ?? false;
    case 'aptitude': {
      if (!ctx.birth) return false;
      const value = ctx.birth.aptitudes[condition.aptitude];
      return condition.level === 'high' ? value >= STORY_EVENTS.APTITUDE_LEVELS.high : value <= STORY_EVENTS.APTITUDE_LEVELS.low;
    }
    case 'region':
      return ctx.birth?.region === condition.region;
    case 'hub':
      return career.hub.id === condition.hub;
    case 'has':
      return has(ctx, condition.what);
    case 'lacks':
      return !has(ctx, condition.what);
    case 'flag':
      return hasFlag(story, condition.flag);
    case 'noFlag':
      return !hasFlag(story, condition.flag);
    case 'person':
      return findPerson(story, condition.key) !== undefined;
    case 'noPerson':
      return findPerson(story, condition.key) === undefined;
    case 'attitude': {
      const person = findPerson(story, condition.key);
      return person !== undefined && attitudeHolds(person.attitude, condition.level);
    }
    case 'onGrid': {
      const person = findPerson(story, condition.key);
      return person?.driverId != null && career.drivers.some((d) => d.id === person.driverId && d.teamId !== null);
    }
    case 'personAtTeam': {
      const person = findPerson(story, condition.key);
      return person?.teamKey != null && ctx.team !== null && person.teamKey === teamKey(career.categoryId, ctx.team.id);
    }
  }
}

export const allHold = (ctx: StoryContext, conditions: readonly StoryCondition[] | undefined) => (conditions ?? []).every((c) => conditionHolds(ctx, c));
