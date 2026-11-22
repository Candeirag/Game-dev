/**
 * Proposta de patrocínio (Fase 5): o patrocinador sai de um perfil de `SPONSOR_PROFILES`, com nome,
 * ramo, valor, meta e personalidade próprios, e o texto da proposta vem na voz dele. Cada perfil
 * aparece no máximo uma vez por personagem.
 *
 * A regra de quem recebe proposta é a de antes: o porte vem do resultado e da fama
 * (`sponsorTierFor`), ninguém assina com quem já está fora da meta e, com as cotas cheias, só
 * interessa um patrocinador maior que o menor atual, que sai para ele entrar.
 */
import { SPONSOR_PROFILE_RULES, STORY_EVENTS } from '@/config/balance';
import type { Effect, PendingEvent } from '@/domain/schemas';
import type { SponsorProfile } from '@/domain/storyEvents';
import { SPONSOR_PROFILES } from '@/data/events';
import { SPONSOR_RULES, careerTitles, commercialSponsors, maxSponsors, sponsorTierFor } from '../career/sponsors';
import { money } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import type { StoryContext } from './context';
import { sponsorFromProfile } from './effects';
import { hasSeen } from './memory';
import { renderText } from './text';

export const sponsorKey = (profile: SponsorProfile) => `sponsor:${profile.id}`;

/** Porte da proposta que o piloto atrai agora e o patrocinador que sairia, ou null se não há proposta. */
function offerSlot(ctx: StoryContext): { tier: 1 | 2 | 3; replaces: string | null } | null {
  const { career, category } = ctx;
  const tier = sponsorTierFor(career.reputation, category, ctx.standing, careerTitles(career));
  if (ctx.standing > (SPONSOR_RULES.TIER_TARGET[tier] ?? 0)) return null;
  const current = commercialSponsors(career.sponsors);
  if (current.length < maxSponsors(career)) return { tier, replaces: null };
  const weakest = [...current].sort((a, b) => a.tier - b.tier || a.perSeason - b.perSeason)[0];
  return weakest && weakest.tier < tier ? { tier, replaces: weakest.id } : null;
}

/** Perfis que ainda podem aparecer para este piloto, neste porte. */
function availableProfiles(ctx: StoryContext, tier: number): SponsorProfile[] {
  const names = new Set(ctx.career.sponsors.map((s) => s.name));
  return SPONSOR_PROFILES.filter((p) => !p.chainOnly && p.tier === tier && !names.has(p.name) && !hasSeen(ctx.story, sponsorKey(p)));
}

/** Há proposta possível agora? (usado no sorteio da etapa). */
export function canOfferSponsor(ctx: StoryContext): boolean {
  const slot = offerSlot(ctx);
  return slot !== null && availableProfiles(ctx, slot.tier).length > 0;
}

export function sponsorOfferCard(ctx: StoryContext, seed: number): { event: PendingEvent; key: string } | null {
  const slot = offerSlot(ctx);
  if (!slot) return null;
  const pool = availableProfiles(ctx, slot.tier);
  const rng = createRng(seed);
  const profile = pool[Math.floor(rng.next() * pool.length)];
  if (!profile) return null;
  const { career } = ctx;
  const sponsor = sponsorFromProfile(ctx, profile, hashSeed(seed, 'sponsor', profile.id));
  const better = {
    ...sponsor,
    perSeason: Math.round((sponsor.perSeason * SPONSOR_PROFILE_RULES.HAGGLE_VALUE) / 100) * 100,
    targetPosition: Math.max(1, sponsor.targetPosition + SPONSOR_PROFILE_RULES.HAGGLE_TARGET),
  };
  const replaced = slot.replaces ? career.sponsors.find((s) => s.id === slot.replaces) : undefined;
  const swap: Effect[] = replaced ? [{ type: 'removeSponsor', sponsorId: replaced.id }] : [];
  const extras = {
    patrocinador: profile.name,
    valor: money(career, sponsor.perSeason),
    bonus: money(career, sponsor.podiumBonus),
    meta: String(sponsor.targetPosition),
    ate: String(career.year + (sponsor.endSeason - career.season)),
  };
  const r = (text: string) => renderText(text, ctx, { persons: {} }, extras);
  const note = replaced ? `Para assinar, ${replaced.name} sai.` : '';
  const p = profile.pitch;
  return {
    key: sponsorKey(profile),
    event: {
      id: `s${career.season}-r${ctx.round}-sponsor-${profile.id}`,
      definitionId: `story:sponsor:${profile.id}`,
      category: 'money',
      season: career.season,
      round: ctx.round,
      title: r(p.title),
      body: r(p.body),
      choices: [
        {
          id: 'sign',
          label: r(p.sign),
          description: note,
          outcomes: [{ probability: 1, text: r(p.signed), effects: [...swap, { type: 'addSponsor', sponsor }] }],
        },
        {
          id: 'haggle',
          label: r(p.haggle),
          description: note,
          outcomes: [
            { probability: STORY_EVENTS.ODDS.even, text: r(p.haggleWon), effects: [...swap, { type: 'addSponsor', sponsor: better }] },
            { probability: 1 - STORY_EVENTS.ODDS.even, text: r(p.haggleLost), effects: [] },
          ],
        },
        { id: 'refuse', label: r(p.refuse), description: '', outcomes: [{ probability: 1, text: r(p.refused), effects: [] }] },
      ],
      storyKey: sponsorKey(profile),
    },
  };
}
