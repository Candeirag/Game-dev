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

export function familySupport(): Sponsor {
  return { id: 'family', name: 'Apoio da família', tier: 0, perSeason: ECONOMY.FAMILY_SUPPORT, podiumBonus: 0, endSeason: ECONOMY.FAMILY_SUPPORT_SEASONS, satisfaction: 100, targetPosition: 20 };
}

export const commercialSponsors = (sponsors: readonly Sponsor[]) => sponsors.filter((s) => s.tier > 0);

/**
 * Porte do patrocinador que um piloto atrai. Vem dos resultados: entre os
 * três primeiros do campeonato, grande; entre os oito, médio; abaixo disso,
 * pequeno. Uma reputação bem acima do mínimo da categoria (15 pontos ou mais)
 * sobe um porte, porque um nome conhecido vende mesmo em fase ruim.
 */
export function sponsorTierFor(reputation: number, category: CategoryDefinition, championshipPosition: number): 1 | 2 | 3 {
  const byResult = championshipPosition <= 3 ? 3 : championshipPosition <= 8 ? 2 : 1;
  const famous = reputation - category.requirements.minReputation >= 15 ? 1 : 0;
  return Math.min(3, byResult + famous) as 1 | 2 | 3;
}

/** Monta uma proposta de patrocínio. A semente define o nome e uma variação de ±10% no valor. */
export function buildSponsor(career: CareerState, tier: 1 | 2 | 3, seed: number): Sponsor {
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
    // Quanto maior o patrocinador, mais ele exige: é o que impede um piloto de meio de grid de viver de cotas grandes.
    targetPosition: SPONSOR_RULES.TIER_TARGET[tier] ?? 14,
  };
}

/**
 * Satisfação após uma etapa: compara a posição no campeonato com a esperada
 * (1,2 ponto por posição, de −3 a +5) e soma a exposição da corrida (vitória +6,
 * pódio +4) ou o desgaste (acidente por erro próprio ou punição: −2).
 */
export function satisfactionAfterRound(sponsor: Sponsor, championshipPosition: number, entry: RaceEntryResult | null): number {
  if (sponsor.tier === 0) return sponsor.satisfaction;
  let delta = Math.max(-3, Math.min(5, (sponsor.targetPosition - championshipPosition) * 1.2));
  if (entry?.status === 'finished' && entry.position === 1) delta += 6;
  else if (entry?.status === 'finished' && entry.position <= 3) delta += 4;
  if (entry && (entry.dnfReason === 'crash' || entry.penaltySeconds > 0)) delta -= 2;
  if (!entry) delta -= 1;
  return Math.round(Math.min(100, Math.max(0, sponsor.satisfaction + delta)) * 10) / 10;
}

/** Valor anual de um patrocinador em outra categoria, mantendo o seu porte e a sua generosidade relativa. */
function rebase(sponsor: Sponsor, from: CategoryDefinition, to: CategoryDefinition): Sponsor {
  if (sponsor.tier === 0 || from.id === to.id) return sponsor;
  const perSeason = Math.round((sponsor.perSeason * (to.economy.sponsorBase / from.economy.sponsorBase)) / 100) * 100;
  return { ...sponsor, perSeason, podiumBonus: Math.round(perSeason * SPONSOR_RULES.PODIUM_BONUS_SHARE) };
}

/**
 * Patrocinadores na virada de temporada.
 * - Contratos que vencem são renovados por mais um ano se o patrocinador
 *   estiver satisfeito; os demais vão embora.
 * - Quando o piloto muda de categoria, os patrocinadores que ficam ajustam o
 *   valor à nova categoria: quem patrocina um piloto em ascensão investe mais
 *   quando a vitrine cresce (e menos, se ele desce).
 */
export function renewSponsors(sponsors: readonly Sponsor[], season: number, current: CategoryDefinition, next: CategoryDefinition): { kept: Sponsor[]; left: Sponsor[]; renewed: Sponsor[] } {
  const kept: Sponsor[] = [];
  const left: Sponsor[] = [];
  const renewed: Sponsor[] = [];
  for (const s of sponsors) {
    if (s.endSeason > season) {
      kept.push(rebase(s, current, next));
    } else if (s.tier > 0 && s.satisfaction >= SPONSOR_RULES.RENEW_THRESHOLD) {
      const renewedSponsor = { ...rebase(s, current, next), endSeason: season + 1 };
      kept.push(renewedSponsor);
      renewed.push(renewedSponsor);
    } else {
      left.push(s);
    }
  }
  return { kept, left, renewed };
}
