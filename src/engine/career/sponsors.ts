/**
 * Patrocinadores pessoais do piloto.
 *
 * Um patrocinador paga um valor anual (em parcelas por etapa) e espera uma
 * posição no campeonato. A satisfação sobe e desce com os resultados; quando
 * cai demais, ele pressiona (evento) e, no limite, vai embora.
 *
 * Desde a Fase 3 da grande atualização eles vêm em escada (`SPONSOR_LADDER`): o comércio do
 * bairro no kart regional, as empresas regionais no Brasileiro e na Fórmula Júnior, e as marcas
 * grandes só para quem tem título e visibilidade. E a meta é para valer: o patrocinador que não
 * vê o piloto na posição combinada ao fim da temporada rompe o contrato (`renewSponsors`).
 */
import { ACADEMY_DOOR, SPONSOR_LADDER, SPONSOR_PROFILE_RULES } from '@/config/balance';
import type { CareerState, RaceEntryResult, Sponsor } from '@/domain/schemas';
import { categoryByTier, getCategory, type CategoryDefinition } from '@/data/categories';
import { sponsorProfile } from '@/data/events';
import { createRng, hashSeed } from '../rng';
import { sponsorValueFactor } from '../birth/effects';
import { ECONOMY } from './economy';

export const SPONSOR_RULES = {
  MAX_SPONSORS: 3,
  /** Fração do valor de referência da categoria paga por cada porte de patrocinador. */
  TIER_SHARE: [0, 0.2, 0.36, 0.6],
  /** Posição no campeonato que cada porte de patrocinador espera, em qualquer categoria. */
  TIER_TARGET: [20, 15, 10, 5],
  /** Bônus por pódio, como fração do valor anual. */
  PODIUM_BONUS_SHARE: 0.04,
  /** Abaixo disto, o patrocinador pressiona; abaixo do limite de saída, rompe. */
  PRESSURE_THRESHOLD: 35,
  LEAVE_THRESHOLD: 5,
  /** Satisfação mínima para renovar no fim do contrato. */
  RENEW_THRESHOLD: 60,
} as const;

const NAMES: readonly (readonly string[])[] = [
  [],
  ['Oficina do Tonho', 'Padaria Estrela', 'Auto Peças Rota', 'Lubrificantes Vitta', 'Loja Pit Stop', 'Mercado Bom Preço'],
  ['Banco Meridiano', 'Energéticos Volt', 'Seguros Atlas', 'Telecom Onda', 'Tintas Arco', 'Rede Posto Sete'],
  ['Petro Aurora', 'Relógios Chronos', 'Tecnologia Nexa', 'Companhia Aérea Zênite', 'Bebidas Kora', 'Grupo Financeiro Lumen'],
];

/**
 * Apoio da família: um valor por temporada, até a temporada `seasons`. Sem argumentos, é o apoio
 * de antes dos nascimentos sorteados (usado pela migração dos saves antigos); numa carreira nova,
 * o valor e a duração vêm do nascimento. `identity` dá nome a outro apoio do mesmo tipo (porte 0,
 * sem meta de verdade), como a empresa de um parente (Fase 6).
 */
export function familySupport(
  perSeason: number = ECONOMY.FAMILY_SUPPORT,
  seasons: number = ECONOMY.FAMILY_SUPPORT_SEASONS,
  identity: Pick<Sponsor, 'id' | 'name'> = { id: 'family', name: 'Apoio da família' },
): Sponsor {
  return {
    ...identity,
    tier: 0,
    perSeason,
    podiumBonus: 0,
    endSeason: Math.max(1, seasons),
    satisfaction: 100,
    targetPosition: SPONSOR_RULES.TIER_TARGET[0],
  };
}

export const commercialSponsors = (sponsors: readonly Sponsor[]) => sponsors.filter((s) => s.tier > 0);

/**
 * O apoio é da família: o dos pais (`family`) ou o da empresa de um parente nos negócios (Fase 6). A
 * marca do legado da imagem de marca (`legacy-brand`) também é de porte 0, mas não é da família.
 */
export const isFamilySupport = (sponsor: Pick<Sponsor, 'id' | 'tier'>) =>
  sponsor.tier === 0 && (sponsor.id === 'family' || sponsor.id.startsWith('family-business-'));

/** Quantos patrocinadores pessoais o piloto pode ter: a academia cobra exclusividade. */
export function maxSponsors(career: CareerState): number {
  return career.academy ? ACADEMY_DOOR.MAX_PERSONAL_SPONSORS : SPONSOR_RULES.MAX_SPONSORS;
}

/** Títulos de piloto na carreira do personagem atual (temporadas arquivadas). */
export function careerTitles(career: CareerState): number {
  const since = career.dynasty.lineage[career.dynasty.lineage.length - 1]?.fromSeason ?? 1;
  return career.history.filter((h) => h.mode === 'driver' && h.season >= since && h.playerPosition === 1).length;
}

/**
 * Valor de referência de um patrocínio de certo porte num campeonato. Cada porte acompanha o
 * preço dos campeonatos só até um degrau (`VALUE_CEILING_TIER`): a padaria do bairro não paga
 * valor de fórmula porque o piloto subiu.
 */
export function sponsorBaseFor(tier: number, category: CategoryDefinition): number {
  const ceiling = SPONSOR_LADDER.VALUE_CEILING_TIER[tier] ?? 7;
  if (category.tier <= ceiling) return category.economy.sponsorBase;
  return (categoryByTier(ceiling) ?? category).economy.sponsorBase;
}

/**
 * Porte do patrocinador que um piloto atrai. Vem dos resultados: entre os
 * três primeiros do campeonato, grande; entre os oito, médio; abaixo disso,
 * pequeno. Uma reputação bem acima do mínimo da categoria (15 pontos ou mais)
 * sobe um porte, porque um nome conhecido vende mesmo em fase ruim.
 *
 * A escada limita o resultado: cada campeonato tem um porte máximo, e a marca grande (porte 3)
 * só aparece para quem já foi campeão e tem a reputação mínima (`titles` é o número de títulos
 * na carreira).
 */
export function sponsorTierFor(reputation: number, category: CategoryDefinition, championshipPosition: number, titles = 0): 1 | 2 | 3 {
  const byResult = championshipPosition <= 3 ? 3 : championshipPosition <= 8 ? 2 : 1;
  const famous = reputation - category.requirements.minReputation >= 15 ? 1 : 0;
  const bigBrand = titles > 0 && reputation >= SPONSOR_LADDER.BIG_BRAND_MIN_REPUTATION;
  const ceiling = Math.min(SPONSOR_LADDER.MAX_TIER[category.id], bigBrand ? 3 : 2);
  return Math.max(1, Math.min(ceiling, byResult + famous)) as 1 | 2 | 3;
}

/**
 * Monta uma proposta de patrocínio. A semente define o nome e uma variação de ±10% no valor; o
 * carisma de nascença do piloto (Fase 2) sobe ou desce o valor (ver `sponsorValueFactor`).
 */
export function buildSponsor(career: CareerState, tier: 1 | 2 | 3, seed: number): Sponsor {
  const rng = createRng(seed);
  const category = getCategory(career.categoryId);
  const taken = new Set(career.sponsors.map((s) => s.name));
  const pool = (NAMES[tier] ?? []).filter((n) => !taken.has(n));
  const name = pool[Math.floor(rng.next() * pool.length)] ?? `Patrocinador ${career.season}-${tier}`;
  const perSeason =
    Math.round((sponsorBaseFor(tier, category) * (SPONSOR_RULES.TIER_SHARE[tier] ?? 0.2) * (0.9 + rng.next() * 0.2) * sponsorValueFactor(career)) / 100) * 100;
  return {
    id: `sponsor-${hashSeed(seed, name).toString(16)}`,
    name,
    tier,
    perSeason,
    podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE),
    endSeason: career.season + (rng.next() < 0.5 ? 0 : 1),
    satisfaction: 60,
    // Quanto maior o patrocinador, mais ele exige: é o que impede um piloto de meio de grid de viver de cotas grandes.
    targetPosition: SPONSOR_RULES.TIER_TARGET[tier] ?? 14,
  };
}

/**
 * Satisfação após uma etapa: compara a posição no campeonato com a esperada
 * (1,2 ponto por posição, de −3 a +5) e soma a exposição da corrida (vitória +6,
 * pódio +4) ou o desgaste (acidente por erro próprio ou punição: −2). `charisma` é o que o
 * carisma de nascença soma ou tira (ver `sponsorSatisfactionBonus`).
 *
 * Desde a Fase 5, a personalidade do patrocinador pesa: o paciente e o fiel sentem menos a queda;
 * o exigente e o impulsivo, mais; o vaidoso comemora mais a alta (SPONSOR_PROFILE_RULES). Os
 * patrocinadores de antes da Fase 5 não têm personalidade e seguem a conta de sempre.
 */
export function satisfactionAfterRound(sponsor: Sponsor, championshipPosition: number, entry: RaceEntryResult | null, charisma = 0): number {
  if (sponsor.tier === 0) return sponsor.satisfaction;
  let delta = Math.max(-3, Math.min(5, (sponsor.targetPosition - championshipPosition) * 1.2)) + charisma;
  if (entry?.status === 'finished' && entry.position === 1) delta += 6;
  else if (entry?.status === 'finished' && entry.position <= 3) delta += 4;
  if (entry && (entry.dnfReason === 'crash' || entry.penaltySeconds > 0)) delta -= 2;
  if (!entry) delta -= 1;
  if (sponsor.personality) delta *= delta < 0 ? SPONSOR_PROFILE_RULES.PATIENCE[sponsor.personality] : SPONSOR_PROFILE_RULES.ENTHUSIASM[sponsor.personality];
  return Math.round(Math.min(100, Math.max(0, sponsor.satisfaction + delta)) * 10) / 10;
}

/** Meta de um contrato novo: a do porte, com a folga ou o aperto do perfil (Fase 5). */
export function freshTarget(sponsor: Sponsor): number {
  const base = SPONSOR_RULES.TIER_TARGET[sponsor.tier] ?? sponsor.targetPosition;
  const profile = sponsor.profileId ? sponsorProfile(sponsor.profileId) : undefined;
  return Math.max(1, base + (profile ? SPONSOR_PROFILE_RULES.TARGET_SHIFT[profile.demand] : 0));
}

/** Valor anual de um patrocinador em outra categoria, mantendo o seu porte e a sua generosidade relativa. */
function rebase(sponsor: Sponsor, from: CategoryDefinition, to: CategoryDefinition): Sponsor {
  if (sponsor.tier === 0 || from.id === to.id) return sponsor;
  const perSeason = Math.round((sponsor.perSeason * (sponsorBaseFor(sponsor.tier, to) / sponsorBaseFor(sponsor.tier, from))) / 100) * 100;
  // Estreante no degrau de cima: o patrocinador que sobe junto afrouxa a meta do primeiro ano.
  const targetPosition =
    to.tier > from.tier
      ? Math.max(sponsor.targetPosition, Math.min(SPONSOR_LADDER.MAX_TARGET, sponsor.targetPosition + SPONSOR_LADDER.PROMOTION_TARGET_RELIEF))
      : sponsor.targetPosition;
  return { ...sponsor, perSeason, podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE), targetPosition };
}

/**
 * Patrocinadores na virada de temporada.
 * - Meta não cumprida, contrato rompido: quem esperava o piloto até certa posição e o viu
 *   terminar abaixo dela vai embora, mesmo com contrato por vencer (`finalPosition` é a posição
 *   final no campeonato; sem ela, ninguém rompe).
 * - Contratos que vencem são renovados por mais um ano se o patrocinador
 *   estiver satisfeito; os demais vão embora.
 * - Quando o piloto muda de categoria, os patrocinadores que ficam ajustam o
 *   valor à nova categoria: quem patrocina um piloto em ascensão investe mais
 *   quando a vitrine cresce (e menos, se ele desce).
 */
export function renewSponsors(
  sponsors: readonly Sponsor[],
  season: number,
  current: CategoryDefinition,
  next: CategoryDefinition,
  finalPosition: number | null = null,
): { kept: Sponsor[]; left: Sponsor[]; renewed: Sponsor[]; broken: Sponsor[] } {
  const kept: Sponsor[] = [];
  const left: Sponsor[] = [];
  const renewed: Sponsor[] = [];
  const broken: Sponsor[] = [];
  for (const s of sponsors) {
    if (missedTarget(s, finalPosition)) {
      broken.push(s);
    } else if (s.endSeason > season) {
      kept.push(rebase(s, current, next));
    } else if (s.tier > 0 && s.satisfaction >= SPONSOR_RULES.RENEW_THRESHOLD) {
      // Contrato novo, meta do porte de novo (o desconto de estreante só volta se o piloto subir outra vez).
      const fresh = { ...s, targetPosition: freshTarget(s) };
      const renewedSponsor = { ...rebase(fresh, current, next), endSeason: season + 1 };
      kept.push(renewedSponsor);
      renewed.push(renewedSponsor);
    } else {
      left.push(s);
    }
  }
  return { kept, left, renewed, broken };
}

/**
 * Patrocínio que o resultado do piloto deve atrair no campeonato de cima, além dos patrocinadores
 * que ele já leva (`kept`). `equivalentPosition` é a posição final traduzida para o degrau novo.
 * Vale um patrocinador do porte que ele atrairia lá, se o contrato ainda fizesse sentido (posição
 * dentro da meta do porte) e houver cota livre ou um patrocinador menor para trocar.
 */
export function expectedSponsorship(
  career: CareerState,
  kept: readonly Sponsor[],
  category: CategoryDefinition,
  equivalentPosition: number,
  reputation: number,
): number {
  const tier = sponsorTierFor(reputation, category, equivalentPosition, careerTitles(career));
  if (equivalentPosition > (SPONSOR_RULES.TIER_TARGET[tier] ?? 0)) return 0;
  const commercial = [...commercialSponsors(kept)].sort((a, b) => a.perSeason - b.perSeason);
  const weakest = commercial[0];
  const full = commercial.length >= maxSponsors(career);
  if (full && (!weakest || weakest.tier >= tier)) return 0;
  const value = sponsorBaseFor(tier, category) * (SPONSOR_RULES.TIER_SHARE[tier] ?? 0) * sponsorValueFactor(career);
  return Math.max(0, Math.round((value - (full && weakest ? weakest.perSeason : 0)) * SPONSOR_LADDER.EXPECTED_ON_PROMOTION));
}

/** O patrocinador comercial viu o piloto terminar o campeonato abaixo da posição combinada? */
export function missedTarget(sponsor: Sponsor, finalPosition: number | null): boolean {
  return sponsor.tier > 0 && finalPosition !== null && finalPosition > sponsor.targetPosition;
}
