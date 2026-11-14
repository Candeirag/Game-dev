/**
 * Contratos: propostas das equipes, requisitos para aceitá-las e negociação.
 *
 * As propostas nascem no fechamento da temporada, a partir do interesse de
 * cada equipe (ver market.ts). Negociar é determinístico: cada pedido tem um
 * custo em pontos de interesse, e a equipe cede enquanto houver margem. Quando
 * a paciência acaba, a proposta é retirada.
 */
import type { CareerState, Contract, Offer, Team } from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { overallRating } from '../simulation/performance';
import { rankTeams } from '../world/generation';
import { netWorth } from './economy';
import { categoryRequirements, type Requirement } from './license';
import { reachableCategories, targetInterest, teamsOfCategory } from './market';
import { getPlayer, teamKey } from './selectors';
import { renewSponsors } from './sponsors';

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export const CONTRACT_RULES = {
  /** Interesse mínimo para uma equipe fazer proposta, por tipo. */
  MIN_INTEREST: { transfer: 52, promotion: 50, demotion: 40, renewal: 40 },
  /** Interesse abaixo do qual a equipe não cede nada na negociação. */
  NEGOTIATION_FLOOR: 45,
  PATIENCE: 3,
  /** Desconto máximo no custo da vaga para um piloto muito desejado (interesse 95+). */
  MAX_SEAT_DISCOUNT: 0.45,
  /** Custo, em pontos de interesse, de cada pedido na negociação. */
  DEMAND_COST: { salary: 8, seat: 8, bonus: 5, role: 15, shorter: 4, longer: 0, clause: 8 },
  /** Tamanho de cada concessão. */
  SALARY_STEP: 0.12,
  SEAT_STEP: 0.12,
  BONUS_STEP: 0.25,
  /** Tolerância de crédito: a equipe aceita o piloto se a dívida projetada não passar de 30% do custo líquido da vaga. */
  CREDIT_TOLERANCE: 0.3,
  /**
   * Bolsa de promoção: o campeão, o vice e o terceiro colocado ganham desconto
   * na vaga da categoria de cima (60%, 35% e 20%). Somado ao desconto por
   * interesse, o abatimento total não passa de 80%.
   */
  SCHOLARSHIP: [0.6, 0.35, 0.2],
  MAX_TOTAL_DISCOUNT: 0.8,
  MAX_OFFERS_PER_GROUP: 3,
} as const;

export type NegotiationDemand = keyof typeof CONTRACT_RULES.DEMAND_COST;

export function contractFromOffer(offer: Offer, startSeason: number): Contract {
  return {
    teamId: offer.teamId,
    categoryId: offer.categoryId,
    role: offer.role,
    startSeason,
    endSeason: startSeason + offer.years - 1,
    salary: offer.salary,
    seatCost: offer.seatCost,
    bonuses: { ...offer.bonuses },
    clauses: { ...offer.clauses },
  };
}

/** Nível esperado do primeiro piloto de uma equipe, pela posição dela na ordem de forças. */
function expectedLeadLevel(category: CategoryDefinition, rank: number): number {
  return category.field.driverLevel + category.field.driverSpread * (0.5 - rank / 9) + 1.5;
}

function buildOffer(career: CareerState, category: CategoryDefinition, team: Team, rank: number, kind: Offer['kind'], interest: number, scholarship = 0): Offer {
  const player = getPlayer(career);
  const t = rank / 9;
  const overall = overallRating(player.attributes);
  const interestDiscount = Math.min(CONTRACT_RULES.MAX_SEAT_DISCOUNT, Math.max(0, (interest - 50) / 100));
  const discount = Math.min(CONTRACT_RULES.MAX_TOTAL_DISCOUNT, interestDiscount + scholarship);
  const seatCost = roundTo(lerp(category.economy.seatCost, t) * (1 - discount), 500);
  const salary = roundTo(lerp(category.economy.salary, t) * (0.55 + interest / 220), 1000);
  const leadLevel = expectedLeadLevel(category, rank);
  const win = Math.round(category.economy.winBonus * (1.2 - 0.7 * t));
  const years = interest >= 75 ? 2 : 1;
  return {
    id: `offer-s${career.season}-${teamKey(category.id, team.id)}`,
    teamId: team.id,
    teamName: team.name,
    categoryId: category.id,
    kind,
    role: overall >= leadLevel - 0.5 ? 'first' : 'second',
    years,
    salary,
    seatCost,
    bonuses: { win, podium: Math.round(win * 0.35), point: Math.round(win * 0.02), title: win * 5 },
    clauses: {
      releaseFee: roundTo((salary + seatCost * 0.3) * 0.5 + category.economy.living, 500),
      performanceTarget: years > 1 ? Math.min(20, team.driverTarget + 5) : null,
    },
    interest: Math.round(interest),
    conceded: 0,
    patience: CONTRACT_RULES.PATIENCE,
    status: 'open',
    firstDriverPossible: overall >= leadLevel - 3 || interest >= 80,
    scholarship,
  };
}

/**
 * Propostas para a próxima temporada.
 * - Contrato vigente: opção de simplesmente cumpri-lo.
 * - Contrato no fim: a equipe atual propõe renovação se ainda confia no piloto.
 * - Outras equipes da categoria, da categoria acima e da categoria abaixo:
 *   propõem conforme o interesse; ficam as três mais interessadas de cada grupo.
 * - Rede de segurança: a equipe mais fraca do degrau abaixo (ou do primeiro
 *   degrau) sempre oferece uma vaga sem custo, para a carreira nunca travar.
 */
export function generateOffers(career: CareerState, reputation: number, contractStatus: 'active' | 'expired' | 'terminated', finalPosition = 99): Offer[] {
  const player = getPlayer(career);
  const current = getCategory(career.categoryId);
  const offers: Offer[] = [];

  for (const category of reachableCategories(career)) {
    const kind: Offer['kind'] = category.tier > current.tier ? 'promotion' : category.tier < current.tier ? 'demotion' : 'transfer';
    const group: Offer[] = [];
    rankTeams(teamsOfCategory(career, category.id)).forEach((team, rank) => {
      const isCurrentTeam = category.id === current.id && team.id === player.teamId;
      const interest = targetInterest(career, category, team, rank, reputation);
      if (isCurrentTeam) {
        if (contractStatus === 'active') {
          const c = career.contract;
          offers.push({
            id: `offer-s${career.season}-continue`, teamId: team.id, teamName: team.name, categoryId: category.id, kind: 'continue', role: c.role,
            years: c.endSeason - career.season, salary: c.salary, seatCost: c.seatCost, bonuses: { ...c.bonuses }, clauses: { ...c.clauses },
            interest: Math.round(interest), conceded: 0, patience: 0, status: 'open', firstDriverPossible: false, scholarship: 0,
          });
        } else if (contractStatus === 'expired' && interest >= CONTRACT_RULES.MIN_INTEREST.renewal) {
          offers.push(buildOffer(career, category, team, rank, 'renewal', interest));
        }
        return;
      }
      const scholarship = kind === 'promotion' ? (CONTRACT_RULES.SCHOLARSHIP[finalPosition - 1] ?? 0) : 0;
      if (interest >= CONTRACT_RULES.MIN_INTEREST[kind as 'transfer' | 'promotion' | 'demotion']) group.push(buildOffer(career, category, team, rank, kind, interest, scholarship));
    });
    group.sort((a, b) => b.interest - a.interest);
    offers.push(...group.slice(0, CONTRACT_RULES.MAX_OFFERS_PER_GROUP));
  }

  // Rede de segurança: a equipe mais fraca do degrau de baixo que ainda não fez proposta.
  const safetyCategory = reachableCategories(career)[0] ?? current;
  const candidates = rankTeams(teamsOfCategory(career, safetyCategory.id)).reverse();
  const safetyTeam = candidates.find((t) => !offers.some((o) => o.teamId === t.id && o.categoryId === safetyCategory.id));
  if (safetyTeam) {
    const base = buildOffer(career, safetyCategory, safetyTeam, 9, 'fallback', 40);
    offers.push({ ...base, id: `offer-s${career.season}-fallback`, seatCost: 0, salary: 0, years: 1, role: 'second', firstDriverPossible: false, clauses: { releaseFee: 0, performanceTarget: null } });
  }
  return offers;
}

/** Multa a pagar para aceitar esta proposta deixando um contrato vigente. */
export function releaseFeeFor(career: CareerState, offer: Offer): number {
  const bound = career.offseason?.contractStatus === 'active';
  return bound && offer.kind !== 'continue' ? career.contract.clauses.releaseFee : 0;
}

/**
 * Requisito financeiro. A equipe quer saber se o piloto consegue bancar a
 * temporada. Ele cumpre o requisito se:
 * - a temporada se paga (patrocínios, salário e apoio da academia cobrem a
 *   vaga, o custo de vida e o treino), mesmo que ele tenha dívidas; ou
 * - o saldo projetado ao fim da temporada não fica abaixo do limite de
 *   crédito (30% do custo líquido da vaga, ou um ano de custo de vida).
 * Os patrocínios entram já no valor da nova categoria; a multa rescisória,
 * se houver, sai do patrimônio.
 */
export function financeRequirement(career: CareerState, offer: Offer): Requirement {
  const category = getCategory(offer.categoryId);
  const sponsors = renewSponsors(career.sponsors, career.season, getCategory(career.categoryId), category).kept.reduce((sum, s) => sum + s.perSeason, 0);
  const netSeat = offer.seatCost * (1 - (career.academy?.supportShare ?? 0));
  const seasonFlow = sponsors + offer.salary - category.economy.living - category.economy.trainingCost * category.rounds - netSeat;
  const projected = netWorth(career.finance) - releaseFeeFor(career, offer) + seasonFlow;
  const creditLimit = Math.max(netSeat * CONTRACT_RULES.CREDIT_TOLERANCE, category.economy.living);
  const met = seasonFlow >= 0 || projected >= -creditLimit;
  const money = (v: number) => `€ ${Math.round(v).toLocaleString('pt-BR')}`;
  return {
    key: 'finance',
    label: 'Finanças',
    detail: met
      ? `Resultado previsto da temporada: ${money(seasonFlow)}; saldo projetado: ${money(projected)}`
      : `A temporada custaria ${money(-seasonFlow)} a mais do que você arrecada, e o saldo projetado (${money(projected)}) passa do limite de crédito de ${money(creditLimit)}`,
    met,
  };
}

/** Todos os requisitos para aceitar uma proposta (a rede de segurança não exige nada). */
export function offerRequirements(career: CareerState, offer: Offer): Requirement[] {
  if (offer.kind === 'fallback' || offer.kind === 'continue') return [];
  const reputation = career.offseason?.reputationAfter ?? career.reputation;
  const sporting = offer.categoryId === career.categoryId ? [] : categoryRequirements(career, offer.categoryId, { nextSeason: true, reputation });
  return [...sporting, financeRequirement(career, offer)];
}

export function canAcceptOffer(career: CareerState, offer: Offer): boolean {
  return offer.status === 'open' && offerRequirements(career, offer).every((r) => r.met);
}

export interface NegotiationResult {
  offer: Offer;
  accepted: boolean;
  message: string;
}

/** Margem de negociação restante, em pontos de interesse. */
export function negotiationMargin(offer: Offer): number {
  return Math.max(0, offer.interest - CONTRACT_RULES.NEGOTIATION_FLOOR - offer.conceded);
}

/** Aplica um pedido do jogador a uma proposta. */
export function negotiate(offer: Offer, demand: NegotiationDemand): NegotiationResult {
  if (offer.status !== 'open') return { offer, accepted: false, message: 'A proposta foi retirada.' };
  if (offer.kind === 'continue' || offer.kind === 'fallback') return { offer, accepted: false, message: 'Esta proposta não é negociável.' };

  const impossible: Partial<Record<NegotiationDemand, boolean>> = {
    salary: offer.salary <= 0,
    seat: offer.seatCost <= 0,
    bonus: offer.bonuses.win <= 0,
    role: offer.role === 'first' || !offer.firstDriverPossible,
    shorter: offer.years <= 1,
    longer: offer.years >= 3 || offer.interest < 60,
    clause: offer.clauses.performanceTarget === null,
  };
  const cost = CONTRACT_RULES.DEMAND_COST[demand];
  if (impossible[demand] || negotiationMargin(offer) < cost) {
    const patience = offer.patience - 1;
    if (patience <= 0) return { offer: { ...offer, patience: 0, status: 'withdrawn' }, accepted: false, message: `A ${offer.teamName} se cansou da negociação e retirou a proposta.` };
    return { offer: { ...offer, patience }, accepted: false, message: `A ${offer.teamName} recusou o pedido. A paciência da equipe está diminuindo.` };
  }

  const next: Offer = { ...offer, conceded: offer.conceded + cost, bonuses: { ...offer.bonuses }, clauses: { ...offer.clauses } };
  let message = '';
  switch (demand) {
    case 'salary':
      next.salary = roundTo(offer.salary * (1 + CONTRACT_RULES.SALARY_STEP), 1000);
      message = 'A equipe aceitou aumentar o salário.';
      break;
    case 'seat':
      next.seatCost = roundTo(offer.seatCost * (1 - CONTRACT_RULES.SEAT_STEP), 500);
      message = 'A equipe aceitou reduzir o custo da vaga.';
      break;
    case 'bonus':
      next.bonuses = { win: Math.round(offer.bonuses.win * 1.25), podium: Math.round(offer.bonuses.podium * 1.25), point: Math.round(offer.bonuses.point * 1.25), title: Math.round(offer.bonuses.title * 1.25) };
      message = 'A equipe aceitou melhorar os bônus.';
      break;
    case 'role':
      next.role = 'first';
      message = 'A equipe aceitou dar a você o status de primeiro piloto.';
      break;
    case 'shorter':
      next.years = offer.years - 1;
      if (next.years === 1) next.clauses.performanceTarget = null;
      message = 'A equipe aceitou um contrato mais curto.';
      break;
    case 'longer':
      next.years = offer.years + 1;
      message = 'A equipe aceitou um contrato mais longo.';
      break;
    case 'clause':
      next.clauses.performanceTarget = null;
      message = 'A equipe retirou a cláusula de desempenho.';
      break;
  }
  return { offer: next, accepted: true, message };
}
