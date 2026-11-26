/**
 * Vínculos: quem ou o que um cartão cita (`StoryNeed`). Cada vínculo precisa existir para o cartão
 * poder sair; ele libera os marcadores de texto (`{rival}`, `{valor}`…) e os alvos dos efeitos.
 */
import { ACADEMY_DOOR, STORY_EVENTS, TEAM_CASH_CALL } from '@/config/balance';
import type { Academy, Child, Driver, Sponsor, StoryPerson, Team } from '@/domain/schemas';
import type { StoryNeed } from '@/domain/storyEvents';
import { TOP_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { SPONSOR_RULES, commercialSponsors } from '../career/sponsors';
import { driverStandings, teamKey } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import type { StoryContext } from './context';
import { freshRivalryThisRound, incidentWithPlayer } from './context';
import { interestedTeam, topRivalId } from './conditions';
import { findPerson } from './memory';

export interface StoryBindings {
  teammate?: Driver;
  rival?: Driver;
  other?: Driver;
  leader?: Driver;
  sponsor?: Sponsor;
  interestedTeam?: { team: Team; key: string };
  otherTeam?: { team: Team; key: string };
  roundPoints?: number;
  cashCall?: { amount: number; canPay: boolean; split: number };
  academy?: { academy: Academy; chance: number; topTeam: string };
  /** O bebê que o cartão faz nascer (efeito `child`), sorteado antes do texto (Fase 6). */
  baby?: Child;
  /** Pessoas da memória (e as que o próprio cartão vai guardar), pela chave. */
  persons: Record<string, StoryPerson>;
}

const driver = (ctx: StoryContext, id: string | null | undefined) => (id ? ctx.career.drivers.find((d) => d.id === id) : undefined);

function academyInvite(ctx: StoryContext): StoryBindings['academy'] {
  const { career, category, player } = ctx;
  const rules = STORY_EVENTS.ACADEMY_INVITE;
  if (career.academy || category.tier < rules.MIN_TIER || category.tier > rules.MAX_TIER || player.age > rules.MAX_AGE) return undefined;
  if (ctx.round < rules.MIN_ROUND || ctx.standing > rules.MAX_STANDING || career.reputation < category.requirements.minReputation) return undefined;
  const index = hashSeed(career.seed, 'academy', career.season) % F1_TEAM_NAMES.length;
  const topTeam = F1_TEAM_NAMES[index] ?? `Equipe ${categoryRef(TOP_CATEGORY_ID, 'de')}`;
  const odds = STORY_EVENTS.ACADEMY;
  const chance = Math.min(
    odds.MAX,
    Math.max(
      odds.MIN,
      odds.BASE +
        (overallRating(player.attributes) - category.field.driverLevel) / odds.RATING_DIVISOR +
        (player.potential - odds.POTENTIAL_PIVOT) / odds.POTENTIAL_DIVISOR,
    ),
  );
  return {
    academy: {
      f1TeamId: f1TeamId(index),
      name: `Academia ${topTeam}`,
      joinedSeason: career.season,
      supportShare: ACADEMY_DOOR.SUPPORT_SHARE,
      targetPosition: ACADEMY_DOOR.TARGET_POSITION,
      strikes: 0,
    },
    chance,
    topTeam,
  };
}

function cashCall(ctx: StoryContext): StoryBindings['cashCall'] {
  const { career } = ctx;
  const seat = career.contract.seatCost;
  if (seat <= 0 || ctx.round < 2 || ctx.round >= career.calendar.length - 1) return undefined;
  // O pedido é uma fração da vaga, limitada a uma parte do caixa: ninguém pede a quem não tem.
  const wanted = seat * TEAM_CASH_CALL.SEAT_SHARE;
  const affordable = Math.max(0, career.finance.cash) * TEAM_CASH_CALL.MAX_CASH_SHARE;
  const amount = Math.floor(Math.min(wanted, affordable) / 100) * 100;
  return { amount, canPay: amount >= TEAM_CASH_CALL.MIN_PAYMENT, split: seat * TEAM_CASH_CALL.SPLIT_SEAT_SHARE };
}

/** O piloto que chegou logo à frente do jogador, de outra equipe e com pontos. */
function driverAhead(ctx: StoryContext): Driver | undefined {
  const mine = ctx.entry;
  if (mine?.status !== 'finished' || mine.position < 2) return undefined;
  const ahead = ctx.record?.race.entries[mine.position - 2];
  if (!ahead || ahead.points <= 0 || ahead.teamId === mine.teamId) return undefined;
  return driver(ctx, ahead.driverId);
}

/**
 * Resolve os vínculos de um cartão. Devolve null se algum faltar. `seedKey` torna os sorteios do
 * vínculo (a "outra equipe") próprios do cartão, sem depender da ordem do catálogo.
 */
export function resolveNeeds(ctx: StoryContext, needs: readonly StoryNeed[] | undefined, seedKey: string): StoryBindings | null {
  const { career } = ctx;
  const out: StoryBindings = { persons: {} };
  for (const need of needs ?? []) {
    switch (need) {
      case 'teammate':
        if (!ctx.teammate) return null;
        out.teammate = ctx.teammate;
        break;
      case 'rival': {
        const d = driver(ctx, topRivalId(ctx));
        if (!d) return null;
        out.rival = d;
        break;
      }
      case 'newRival': {
        const d = driver(ctx, freshRivalryThisRound(career, ctx.round));
        if (!d) return null;
        out.rival = d;
        break;
      }
      case 'other': {
        const d = driver(ctx, incidentWithPlayer(career, ctx.record)?.otherId);
        if (!d) return null;
        out.other = d;
        break;
      }
      case 'ahead': {
        const d = driverAhead(ctx);
        if (!d) return null;
        out.other = d;
        break;
      }
      case 'leader': {
        // O líder é outro piloto: se quem lidera é o jogador, o cartão não sai.
        const top = driverStandings(career)[0];
        const d = career.rounds.length > 0 && top?.driverId !== ctx.player.id ? driver(ctx, top?.driverId) : undefined;
        if (!d) return null;
        out.leader = d;
        break;
      }
      case 'sponsor':
      case 'unhappySponsor': {
        const pool = commercialSponsors(career.sponsors).filter((s) => need === 'sponsor' || s.satisfaction < SPONSOR_RULES.PRESSURE_THRESHOLD);
        const s = [...pool].sort((a, b) => a.satisfaction - b.satisfaction || (a.id < b.id ? -1 : 1))[0];
        if (!s) return null;
        out.sponsor = s;
        break;
      }
      case 'interestedTeam': {
        const best = interestedTeam(ctx);
        const team = best ? career.teams.find((t) => t.id === best.teamId) : undefined;
        if (!best || !team) return null;
        out.interestedTeam = { team, key: best.key };
        break;
      }
      case 'otherTeam': {
        const pool = career.teams.filter((t) => t.id !== ctx.team?.id);
        const team = pool[Math.floor(createRng(hashSeed(career.seed, career.season, ctx.round, 'story-team', seedKey)).next() * pool.length)];
        if (!team) return null;
        out.otherTeam = { team, key: teamKey(career.categoryId, team.id) };
        break;
      }
      case 'roundPoints': {
        const entry = ctx.entry;
        if (entry?.status !== 'finished' || entry.points <= 0) return null;
        out.roundPoints = entry.points;
        break;
      }
      case 'cashCall': {
        const call = cashCall(ctx);
        if (!call) return null;
        out.cashCall = call;
        break;
      }
      case 'academy': {
        const invite = academyInvite(ctx);
        if (!invite) return null;
        out.academy = invite;
        break;
      }
      default: {
        const key = need.slice('person:'.length);
        const person = findPerson(ctx.story, key);
        if (!person) return null;
        out.persons[key] = person;
      }
    }
  }
  return out;
}
