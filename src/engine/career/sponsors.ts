/**
 * Patrocinadores pessoais do piloto.
 *
 * Um patrocinador paga um valor anual (em parcelas por etapa) e espera uma
 * posição no campeonato. A satisfação sobe e desce com os resultados; quando
 * cai demais, ele pressiona (evento) e, no limite, vai embora.
 */
import type { CareerState, RaceEntryResult, Sponsor } from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { createRng, hashSeed } from '../rng';
import { ECONOMY } from './economy';

export const SPONSOR_RULES = {
  MAX_SPONSORS: 3,
  /** Fração do valor de referência da categoria paga por cada porte de patrocinador. */
  TIER_SHARE: [0, 0.22, 0.42, 0.75],
  /** Bônus por pódio, como fração do valor anual. */
  PODIUM_BONUS_SHARE: 0.04,
  /** Abaixo disto, o patrocinador pressiona; abaixo do limite de saída, rompe. */
  PRESSURE_THRESHOLD: 35,
  LEAVE_THRESHOLD: 12,
  /** Satisfação mínima para renovar no fim do contrato. */
  RENEW_THRESHOLD: 60,
} as const;

const NAMES: readonly (readonly string[])[] = [
  [],
  ['Oficina do Tonho', 'Padaria Estrela', 'Auto Peças Rota', 'Lubrificantes Vitta', 'Loja Pit Stop', 'Mercado Bom Preço'],
  ['Banco Meridiano', 'Energéticos Volt', 'Seguros Atlas', 'Telecom Onda', 'Tintas Arco', 'Rede Posto Sete'],
  ['Petro Aurora', 'Relógios Chronos', 'Tecnologia Nexa', 'Companhia Aérea Zênite', 'Bebidas Kora', 'Grupo Financeiro Lumen'],
];

export function familySupport(): Sponsor {
  return { id: 'family', name: 'Apoio da família', tier: 0, perSeason: ECONOMY.FAMILY_SUPPORT, podiumBonus: 0, endSeason: ECONOMY.FAMILY_SUPPORT_SEASONS, satisfaction: 100, targetPosition: 20 };
}

export const commercialSponsors = (sponsors: readonly Sponsor[]) => sponsors.filter((s) => s.tier > 0);

/**
 * Porte do patrocinador que um piloto atrai: depende de quanto a reputação
 * supera o mínimo da categoria (menos de 10 pontos acima: pequeno; menos de
 * 25: médio; mais: grande).
 */
export function sponsorTierFor(reputation: number, category: CategoryDefinition): 1 | 2 | 3 {
  const surplus = reputation - category.requirements.minReputation;
  return surplus >= 25 ? 3 : surplus >= 10 ? 2 : 1;
}

/** Monta uma proposta de patrocínio. A semente define o nome e uma variação de ±10% no valor. */
export function buildSponsor(career: CareerState, tier: 1 | 2 | 3, seed: number, teamTarget: number): Sponsor {
  const rng = createRng(seed);
  const category = getCategory(career.categoryId);
  const taken = new Set(career.sponsors.map((s) => s.name));
  const pool = (NAMES[tier] ?? []).filter((n) => !taken.has(n));
  const name = pool[Math.floor(rng.next() * pool.length)] ?? `Patrocinador ${career.season}-${tier}`;
  const perSeason = Math.round((category.economy.sponsorBase * (SPONSOR_RULES.TIER_SHARE[tier] ?? 0.2) * (0.9 + rng.next() * 0.2)) / 100) * 100;
  return {
    id: `sponsor-${hashSeed(seed, name).toString(16)}`,
    name,
    tier,
    perSeason,
    podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE),
    endSeason: career.season + (rng.next() < 0.5 ? 0 : 1),
    satisfaction: 60,
    // Patrocinadores maiores esperam mais que a própria equipe.
    targetPosition: Math.max(1, teamTarget - (tier - 1) * 2),
  };
}

/**
 * Satisfação após uma etapa: compara a posição no campeonato com a esperada
 * (1,2 ponto por posição, até ±5) e soma a exposição da corrida (vitória +6,
 * pódio +4) ou o desgaste (acidente por erro próprio ou punição: −2).
 */
export function satisfactionAfterRound(sponsor: Sponsor, championshipPosition: number, entry: RaceEntryResult | null): number {
  if (sponsor.tier === 0) return sponsor.satisfaction;
  let delta = Math.max(-5, Math.min(5, (sponsor.targetPosition - championshipPosition) * 1.2));
  if (entry?.status === 'finished' && entry.position === 1) delta += 6;
  else if (entry?.status === 'finished' && entry.position <= 3) delta += 4;
  if (entry && (entry.dnfReason === 'crash' || entry.penaltySeconds > 0)) delta -= 2;
  if (!entry) delta -= 1;
  return Math.round(Math.min(100, Math.max(0, sponsor.satisfaction + delta)) * 10) / 10;
}

/**
 * Renovações no fim da temporada. Contratos que vencem são renovados por mais
 * um ano se o patrocinador estiver satisfeito, e o valor acompanha a categoria
 * em que o piloto vai correr (90% do valor de tabela, nunca menos que o atual).
 */
export function renewSponsors(sponsors: readonly Sponsor[], season: number, nextCategory: CategoryDefinition): { kept: Sponsor[]; left: Sponsor[]; renewed: Sponsor[] } {
  const kept: Sponsor[] = [];
  const left: Sponsor[] = [];
  const renewed: Sponsor[] = [];
  for (const s of sponsors) {
    if (s.endSeason > season) {
      kept.push(s);
    } else if (s.tier > 0 && s.satisfaction >= SPONSOR_RULES.RENEW_THRESHOLD) {
      const perSeason = Math.max(s.perSeason, Math.round((nextCategory.economy.sponsorBase * (SPONSOR_RULES.TIER_SHARE[s.tier] ?? 0.2) * 0.9) / 100) * 100);
      const next = { ...s, endSeason: season + 1, perSeason, podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE) };
      kept.push(next);
      renewed.push(next);
    } else {
      left.push(s);
    }
  }
  return { kept, left, renewed };
}
