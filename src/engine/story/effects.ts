/**
 * Tradução dos efeitos dos dados (tamanhos por nome) em efeitos concretos do save (`Effect`), com os
 * valores do momento: a fração do custo de vida da categoria, o id do rival, a chave da equipe. O
 * cartão guarda os efeitos já traduzidos; resolver não consulta os dados de novo.
 */
import { SPONSOR_PROFILE_RULES, STORY_EVENTS } from '@/config/balance';
import type { Effect, Sponsor, StoryPerson } from '@/domain/schemas';
import type { SponsorProfile, StoryDriverTarget, StoryEffect, StorySize } from '@/domain/storyEvents';
import { STORY_FIRST_NAMES, STORY_LAST_NAMES, sponsorProfile } from '@/data/events';
import { SPONSOR_RULES, sponsorBaseFor } from '../career/sponsors';
import { sponsorValueFactor } from '../birth/effects';
import { getCategory } from '@/data/categories';
import { teamKey } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import type { StoryBindings } from './bindings';
import type { StoryContext } from './context';
import { findPerson } from './memory';

const step = (steps: readonly number[], size: StorySize | number): number => Math.sign(size) * (steps[Math.abs(size) - 1] ?? 0);

function driverTarget(b: StoryBindings, who: StoryDriverTarget, key?: string): string | undefined {
  switch (who) {
    case 'rival':
      return b.rival?.id;
    case 'other':
      return b.other?.id;
    case 'teammate':
      return b.teammate?.id;
    case 'leader':
      return b.leader?.id;
    case 'person':
      return (key ? b.persons[key]?.driverId : undefined) ?? undefined;
  }
}

/** Nome inventado e estável para uma pessoa nova da memória (chefe de equipe, dona da padaria). */
function inventName(ctx: StoryContext, key: string): { firstName: string; lastName: string } {
  const rng = createRng(hashSeed(ctx.career.seed, 'story-person', key, ctx.career.season));
  const taken = new Set(ctx.career.drivers.map((d) => `${d.firstName} ${d.lastName}`));
  for (const p of ctx.story.people) taken.add(`${p.firstName} ${p.lastName}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const firstName = STORY_FIRST_NAMES[Math.floor(rng.next() * STORY_FIRST_NAMES.length)] ?? 'Ana';
    const lastName = STORY_LAST_NAMES[Math.floor(rng.next() * STORY_LAST_NAMES.length)] ?? 'Souza';
    if (!taken.has(`${firstName} ${lastName}`)) return { firstName, lastName };
  }
  return { firstName: STORY_FIRST_NAMES[0] ?? 'Ana', lastName: STORY_LAST_NAMES[0] ?? 'Souza' };
}

/**
 * O retrato de uma pessoa que um efeito `meet` vai guardar. Quem já está na memória volta como está
 * (o efeito só atualiza o papel); quem é novo ganha nome, equipe e a idade do piloto agora.
 */
export function personSnapshot(ctx: StoryContext, b: StoryBindings, effect: Extract<StoryEffect, { e: 'meet' }>): StoryPerson | null {
  const known = findPerson(ctx.story, effect.key);
  if (known) return { ...known, role: effect.role };
  const base = {
    key: effect.key,
    role: effect.role,
    metSeason: ctx.career.season,
    metCategoryId: ctx.career.categoryId,
    playerAge: ctx.player.age,
    attitude: effect.attitude ? step(STORY_EVENTS.ATTITUDE_STEPS, effect.attitude) : 0,
    follows: false,
    chainId: null,
  };
  if (effect.from === 'teamBoss' || effect.from === 'stranger') {
    const org = effect.from === 'teamBoss' ? (ctx.team?.name ?? null) : (effect.org ?? null);
    const key = effect.from === 'teamBoss' && ctx.team ? teamKey(ctx.career.categoryId, ctx.team.id) : null;
    return { ...base, ...inventName(ctx, effect.key), driverId: null, nationality: null, age: null, org, teamKey: key };
  }
  const d = effect.from === 'rival' || effect.from === 'newRival' ? b.rival : effect.from === 'other' ? b.other : b.teammate;
  if (!d) return null;
  const team = ctx.career.teams.find((t) => t.id === d.teamId);
  return {
    ...base,
    firstName: d.firstName,
    lastName: d.lastName,
    driverId: d.id,
    nationality: d.nationality,
    age: d.age,
    org: team?.name ?? null,
    teamKey: team ? teamKey(ctx.career.categoryId, team.id) : null,
  };
}

/** Monta o patrocinador de um perfil para o piloto de agora (valor, meta e personalidade do perfil). */
export function sponsorFromProfile(ctx: StoryContext, profile: SponsorProfile, seed: number): Sponsor {
  const rng = createRng(seed);
  const category = getCategory(ctx.career.categoryId);
  const variation = 1 - SPONSOR_PROFILE_RULES.VALUE_VARIATION / 2 + rng.next() * SPONSOR_PROFILE_RULES.VALUE_VARIATION;
  const share = SPONSOR_RULES.TIER_SHARE[profile.tier] ?? 0;
  const perSeason =
    Math.round(
      (sponsorBaseFor(profile.tier, category) * share * SPONSOR_PROFILE_RULES.VALUE[profile.value] * variation * sponsorValueFactor(ctx.career)) / 100,
    ) * 100;
  const target = (SPONSOR_RULES.TIER_TARGET[profile.tier] ?? Math.max(...SPONSOR_RULES.TIER_TARGET)) + SPONSOR_PROFILE_RULES.TARGET_SHIFT[profile.demand];
  return {
    id: `sponsor-${profile.id}`,
    name: profile.name,
    tier: profile.tier,
    perSeason,
    podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE),
    endSeason: ctx.career.season + (rng.next() < SPONSOR_PROFILE_RULES.EXTRA_SEASON_CHANCE ? 0 : 1),
    satisfaction: SPONSOR_PROFILE_RULES.START_SATISFACTION,
    targetPosition: Math.max(1, target),
    profileId: profile.id,
    personality: profile.personality,
  };
}

/** Os efeitos concretos de um efeito dos dados (vazio quando o alvo não existe agora). */
export function concreteEffects(ctx: StoryContext, b: StoryBindings, effect: StoryEffect, label: string, cardKey: string): Effect[] {
  const { career, player } = ctx;
  const E = STORY_EVENTS;
  switch (effect.e) {
    case 'stat':
      return [{ type: 'stat', stat: effect.stat, value: step(effect.stat === 'reputation' ? E.REPUTATION_STEPS : E.STAT_STEPS, effect.size) }];
    case 'cash': {
      const value = Math.round((step(E.MONEY_STEPS, effect.size) * ctx.category.economy.living) / 100) * 100;
      return [{ type: 'cash', value, ledger: 'event', label, ...(effect.cap && value < 0 ? { capToCash: true } : {}) }];
    }
    case 'rivalry': {
      const id = driverTarget(b, effect.who, effect.key);
      return id ? [{ type: 'rivalry', driverId: id, value: step(E.RIVALRY_STEPS, effect.size) }] : [];
    }
    case 'sponsorMood':
      if (effect.who === 'bound' && !b.sponsor) return [];
      return [
        { type: 'sponsorSatisfaction', sponsorId: effect.who === 'bound' ? (b.sponsor?.id ?? null) : null, value: step(E.SPONSOR_MOOD_STEPS, effect.size) },
      ];
    case 'dropSponsor':
      return b.sponsor ? [{ type: 'removeSponsor', sponsorId: b.sponsor.id }] : [];
    case 'interest': {
      const key =
        effect.team === 'current'
          ? ctx.team
            ? teamKey(career.categoryId, ctx.team.id)
            : undefined
          : effect.team === 'interested'
            ? b.interestedTeam?.key
            : effect.team === 'other'
              ? b.otherTeam?.key
              : effect.key
                ? (b.persons[effect.key]?.teamKey ?? undefined)
                : undefined;
      return key ? [{ type: 'interest', teamKey: key, value: step(E.INTEREST_STEPS, effect.size) }] : [];
    }
    case 'grid': {
      const id = effect.who === 'player' ? player.id : driverTarget(b, effect.who);
      return id ? [{ type: 'gridPenalty', driverId: id, places: E.GRID_PLACES[effect.size - 1] ?? 3 }] : [];
    }
    case 'penaltyPoints':
      return [{ type: 'penaltyPoints', value: E.PENALTY_POINTS[effect.size - 1] ?? 1 }];
    case 'losePoints':
      return b.roundPoints
        ? [{ type: 'pointsAdjustment', driverId: player.id, points: -b.roundPoints, reason: `Irregularidade técnica na etapa ${ctx.round}` }]
        : [];
    case 'attribute':
      return [{ type: 'attribute', key: effect.attribute, value: step(E.ATTRIBUTE_STEPS, effect.size) }];
    case 'injury':
      return [{ type: 'injury', injury: { description: effect.description, severity: effect.severity, roundsRemaining: E.INJURY_ROUNDS[effect.length] } }];
    case 'car':
      return [{ type: 'carUpgrade', value: step(E.CAR_STEPS, effect.size) }];
    case 'seatCost': {
      const value = Math.round(step(E.SEAT_COST_STEPS, effect.size) * career.contract.seatCost);
      return value !== 0 ? [{ type: 'seatCost', value }] : [];
    }
    case 'releaseFee':
      return [{ type: 'releaseFee', factor: 1 + step(E.RELEASE_FEE_STEPS, effect.size) }];
    case 'relationship':
      return career.family.partner ? [{ type: 'relationship', value: step(E.RELATIONSHIP_STEPS, effect.size) }] : [];
    case 'payCashCall':
      return b.cashCall ? [{ type: 'cash', value: -b.cashCall.amount, ledger: 'event', label: 'Aporte extra à equipe', capToCash: true }] : [];
    case 'splitCashCall':
      return b.cashCall ? [{ type: 'seatCost', value: b.cashCall.split }] : [];
    case 'joinAcademy':
      return b.academy ? [{ type: 'joinAcademy', academy: b.academy.academy }] : [];
    case 'sponsor': {
      const profile = sponsorProfile(effect.profile);
      if (!profile || career.sponsors.some((s) => s.profileId === profile.id)) return [];
      return [{ type: 'addSponsor', sponsor: sponsorFromProfile(ctx, profile, hashSeed(career.seed, 'story-sponsor', profile.id, cardKey)) }];
    }
    case 'flag':
      return [{ type: 'storyFlag', flag: effect.flag, set: !effect.clear }];
    case 'meet': {
      const person = b.persons[effect.key] ?? personSnapshot(ctx, b, effect);
      return person ? [{ type: 'storyPerson', person: { ...person, role: effect.role } }] : [];
    }
    case 'attitude':
      return [{ type: 'storyAttitude', key: effect.key, value: step(E.ATTITUDE_STEPS, effect.size) }];
    case 'joinTeam': {
      const target =
        effect.team === 'current'
          ? ctx.team
            ? { team: ctx.team, key: teamKey(career.categoryId, ctx.team.id) }
            : undefined
          : effect.team === 'interested'
            ? b.interestedTeam
            : b.otherTeam;
      return target ? [{ type: 'storyJoinTeam', key: effect.key, org: target.team.name, teamKey: target.key }] : [];
    }
    case 'follow':
      return [{ type: 'storyFollow', key: effect.key, follow: effect.on }];
    case 'child':
      return career.family.partner && b.baby ? [{ type: 'child', child: b.baby }] : [];
  }
}
