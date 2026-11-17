/**
 * Caminhos: as portas para a próxima vaga (Fase 3 da grande atualização).
 *
 * A regra de ouro do jogo: sempre existe uma saída, mesmo para o pobre. Ela pode ser cara (um
 * investidor que leva parte dos ganhos para sempre) ou demorada (mais um ano de kart atrás de
 * resultado), mas nunca uma parede sem porta. As portas são:
 *
 * - dinheiro próprio, patrocínio e bolsa: o caminho de sempre (`canAcceptOffer`);
 * - academia: paga a vaga; cobra exclusividade e resultado;
 * - vaquinha da cidade: dinheiro uma vez só, para quem tem resultado e carisma; a torcida cobra;
 * - investidor: paga a vaga de uma proposta e fica com uma fatia dos ganhos (salário, bônus e
 *   sobra de patrocínio) para sempre;
 * - trabalho paralelo: dinheiro por etapa em troca de tempo de treino;
 * - mais um ano: a vaga de aluguel, que nunca falta.
 *
 * Depois de `INVESTOR.LAST_RESORT_AFTER` temporadas seguidas sem nenhuma porta, o investidor de
 * último recurso aparece para qualquer piloto (e traz uma vaga, se nenhuma equipe fez proposta):
 * é o que garante que ninguém fica mais do que isso diante de uma parede.
 *
 * Tudo aqui é determinístico e não guarda estado próprio: as portas são calculadas da carreira.
 * Os números estão em `src/config/balance.ts`.
 */
import { ACADEMY_DOOR, CROWDFUND, INVESTOR, RUNNING_COSTS, SIDE_JOBS } from '@/config/balance';
import { categoryRef } from '@/domain/categoryNames';
import type { Academy, CareerState, CategoryId, Investor, Offer, SideJob } from '@/domain/schemas';
import { HOMETOWNS } from '@/data/birth';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { INVESTOR_NAMES, SIDE_JOB_INFO } from '@/data/doors';
import { hubOfCategory } from '@/data/hubs';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { activeBirth } from '../birth/effects';
import { hashSeed } from '../rng';
import { rankTeams } from '../world/generation';
import { buildOffer, canAcceptOffer, CONTRACT_RULES, financeProjection, offerRequirements } from './contracts';
import { post, seasonRunningCosts } from './economy';
import { moveCost, needsMove, sideJobAllowed } from './hubs';
import { categoryRequirements, type Requirement } from './license';
import { reachableCategories, teamsOfCategory } from './market';
import { driverStandings, getPlayer, money, teamKey } from './selectors';
import { commercialSponsors, renewSponsors } from './sponsors';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Posição do piloto no campeonato: a final, no fechamento do ano; a atual, durante a temporada (null antes da primeira etapa). */
export function seasonPosition(career: CareerState): number | null {
  if (career.offseason) return career.offseason.playerPosition;
  if (career.rounds.length === 0) return null;
  return driverStandings(career).find((s) => s.driverId === career.playerDriverId)?.position ?? null;
}

/** Quanto falta para uma posição-alvo, de 0 (último) a 1 (cumprida), para as barras de progresso. */
function positionProgress(position: number | null, target: number, gridSize: number): number {
  if (position === null) return 0;
  return position <= target ? 1 : clamp01(1 - (position - target) / Math.max(1, gridSize - target));
}

/** Carisma de nascença (50, o piloto comum, para quem não teve nascimento sorteado). */
function charismaOf(career: CareerState): number {
  return activeBirth(career)?.aptitudes.charisma ?? 50;
}

/* ------------------------------------------------------------------ */
/* Academia                                                            */
/* ------------------------------------------------------------------ */

/** Um requisito de uma porta, com o progresso (0 a 1) para a tela Caminhos. */
export interface PathRequirement {
  label: string;
  detail: string;
  met: boolean;
  progress: number;
}

function academyRequirements(career: CareerState): PathRequirement[] {
  const category = getCategory(career.categoryId);
  const player = getPlayer(career);
  const position = seasonPosition(career);
  const age = player.age + 1;
  const inRange = category.tier >= ACADEMY_DOOR.MIN_TIER && category.tier <= ACADEMY_DOOR.MAX_TIER;
  return [
    {
      label: 'Campeonato',
      detail: inRange
        ? `Você corre ${categoryRef(category.id, 'em')}, onde os olheiros das academias estão`
        : category.tier < ACADEMY_DOOR.MIN_TIER
          ? 'As academias só olham a partir do Campeonato Brasileiro de Kart'
          : 'No topo da escada não há mais academia',
      met: inRange,
      progress: inRange ? 1 : 0,
    },
    {
      label: 'Resultado',
      detail:
        position === null
          ? `Terminar entre os ${ACADEMY_DOOR.MAX_POSITION} primeiros (a temporada ainda não começou)`
          : `${position}º no campeonato (precisa terminar entre os ${ACADEMY_DOOR.MAX_POSITION} primeiros)`,
      met: position !== null && position <= ACADEMY_DOOR.MAX_POSITION,
      progress: positionProgress(position, ACADEMY_DOOR.MAX_POSITION, career.teams.length * 2),
    },
    {
      label: 'Idade',
      detail: `${age} anos na próxima temporada (máximo ${ACADEMY_DOOR.MAX_AGE})`,
      met: age <= ACADEMY_DOOR.MAX_AGE,
      progress: age <= ACADEMY_DOOR.MAX_AGE ? 1 : 0,
    },
    {
      label: 'Exclusividade',
      detail: career.investor ? `Você tem contrato com ${career.investor.name}: a academia não divide o piloto com um investidor` : 'Sem investidor',
      met: career.investor === null,
      progress: career.investor === null ? 1 : 0,
    },
  ];
}

/** A academia que chamaria o piloto nesta temporada (a mesma do convite por evento). */
export function academyOnOffer(career: CareerState): Academy {
  const index = hashSeed(career.seed, 'academy', career.season) % F1_TEAM_NAMES.length;
  return {
    f1TeamId: f1TeamId(index),
    name: `Academia ${F1_TEAM_NAMES[index] ?? ''}`.trim(),
    joinedSeason: career.season,
    supportShare: ACADEMY_DOOR.SUPPORT_SHARE,
    targetPosition: ACADEMY_DOOR.TARGET_POSITION,
    strikes: 0,
  };
}

/** A porta da academia está aberta agora? Só no fechamento do ano, para quem cumpre todos os requisitos. */
export function canJoinAcademy(career: CareerState): boolean {
  return career.mode === 'driver' && career.offseason !== null && career.academy === null && academyRequirements(career).every((r) => r.met);
}

/**
 * Entrada numa academia, pela porta ou pelo convite de um evento. A exclusividade vale na hora:
 * ficam só os patrocinadores pessoais que ela permite (os que pagam mais).
 */
export function enterAcademy(career: CareerState, academy: Academy): CareerState {
  const commercial = [...commercialSponsors(career.sponsors)].sort((a, b) => b.perSeason - a.perSeason);
  const dropped = new Set(commercial.slice(ACADEMY_DOOR.MAX_PERSONAL_SPONSORS).map((s) => s.id));
  return { ...career, academy, sponsors: career.sponsors.filter((s) => !dropped.has(s.id)) };
}

export function joinAcademyDoor(career: CareerState): CareerState {
  if (!canJoinAcademy(career)) throw new Error('A academia não está de portas abertas para você agora.');
  return enterAcademy(career, academyOnOffer(career));
}

/* ------------------------------------------------------------------ */
/* Vaquinha da cidade                                                  */
/* ------------------------------------------------------------------ */

function crowdfundRequirements(career: CareerState): PathRequirement[] {
  const category = getCategory(career.categoryId);
  const position = seasonPosition(career);
  const charisma = charismaOf(career);
  const wait = career.crowdfund ? CROWDFUND.COOLDOWN_SEASONS - (career.season - career.crowdfund.season) : 0;
  return [
    {
      label: 'Resultado',
      detail:
        position === null
          ? `Terminar entre os ${CROWDFUND.MAX_POSITION} primeiros (a temporada ainda não começou)`
          : `${position}º no campeonato (precisa terminar entre os ${CROWDFUND.MAX_POSITION} primeiros)`,
      met: position !== null && position <= CROWDFUND.MAX_POSITION,
      progress: positionProgress(position, CROWDFUND.MAX_POSITION, career.teams.length * 2),
    },
    {
      label: 'Carisma',
      detail: `${Math.round(charisma)} (mínimo ${CROWDFUND.MIN_CHARISMA}): é o que faz a cidade abraçar a causa`,
      met: charisma >= CROWDFUND.MIN_CHARISMA,
      progress: clamp01(charisma / CROWDFUND.MIN_CHARISMA),
    },
    {
      label: 'Campeonato',
      detail:
        category.tier <= CROWDFUND.MAX_TIER
          ? `${category.name}: ao alcance de uma cidade`
          : 'Acima da Fórmula Júnior os valores são grandes demais para uma vaquinha',
      met: category.tier <= CROWDFUND.MAX_TIER,
      progress: category.tier <= CROWDFUND.MAX_TIER ? 1 : 0,
    },
    {
      label: 'Intervalo',
      detail: wait > 0 ? `A cidade já ajudou há pouco: dá para pedir de novo em ${wait} ${wait === 1 ? 'temporada' : 'temporadas'}` : 'A cidade ainda não foi chamada',
      met: wait <= 0,
      progress: wait <= 0 ? 1 : clamp01(1 - wait / CROWDFUND.COOLDOWN_SEASONS),
    },
    {
      label: 'Exclusividade',
      detail: career.academy ? `A ${career.academy.name} não deixa o piloto pedir dinheiro em público` : 'Sem academia',
      met: career.academy === null,
      progress: career.academy === null ? 1 : 0,
    },
  ];
}

/** Quanto a cidade arrecadaria agora, pelo degrau e pelo carisma do piloto. */
export function crowdfundAmount(career: CareerState): number {
  const base = CROWDFUND.BASE_BY_TIER[getCategory(career.categoryId).tier] ?? 0;
  return roundTo(base * (CROWDFUND.CHARISMA_BASE + charismaOf(career) / 100), 500);
}

/** A cidade do piloto: onde ele nasceu (São Paulo para quem não teve nascimento sorteado). */
function hometownOf(career: CareerState): string {
  const birth = activeBirth(career);
  return HOMETOWNS.find((h) => h.id === birth?.hometownId)?.name ?? 'São Paulo';
}

export function canLaunchCrowdfund(career: CareerState): boolean {
  return career.mode === 'driver' && career.offseason !== null && crowdfundRequirements(career).every((r) => r.met);
}

/** Faz a vaquinha: o dinheiro entra agora e a torcida passa a esperar um resultado na temporada seguinte. */
export function launchCrowdfund(career: CareerState): CareerState {
  if (!canLaunchCrowdfund(career) || !career.offseason) throw new Error('A cidade não faria uma vaquinha por você agora.');
  const amount = crowdfundAmount(career);
  const town = hometownOf(career);
  return {
    ...career,
    finance: post(career.finance, career.season, career.calendar.length, 'crowdfund', amount, `Vaquinha de ${town}`),
    crowdfund: { season: career.season, town, amount, targetPosition: career.offseason.playerPosition + CROWDFUND.TARGET_SLACK, settled: false },
  };
}

/**
 * Posição que a torcida cobra na temporada seguinte à vaquinha: a combinada, com a folga em dobro
 * se o piloto subiu de degrau (ninguém espera o mesmo resultado num campeonato mais forte).
 */
export function crowdfundTarget(career: CareerState): number | null {
  const crowdfund = career.crowdfund;
  if (!crowdfund || crowdfund.settled || career.season !== crowdfund.season + 1) return null;
  const before = career.history.find((h) => h.season === crowdfund.season)?.categoryId;
  const climbed = before !== undefined && getCategory(career.categoryId).tier > getCategory(before).tier;
  return crowdfund.targetPosition + (climbed ? CROWDFUND.TARGET_SLACK : 0);
}

/* ------------------------------------------------------------------ */
/* Investidor                                                          */
/* ------------------------------------------------------------------ */

export interface InvestorTerms {
  available: boolean;
  /** Investidor de último recurso: aparece para qualquer piloto, cobra mais e cobre o que faltar para fechar o ano. */
  lastResort: boolean;
  name: string;
  /** Fatia que este aporte acrescenta e a fatia total depois dele. */
  added: number;
  share: number;
  requirements: PathRequirement[];
}

/** O último recurso já está valendo? (Temporadas seguidas sem porta, contadas até o fechamento anterior.) */
export function lastResortActive(career: CareerState): boolean {
  return career.noDoorSeasons >= INVESTOR.LAST_RESORT_AFTER;
}

/** As condições do investidor para pagar uma vaga agora. */
export function investorTerms(career: CareerState): InvestorTerms {
  const current = career.investor;
  const position = seasonPosition(career);
  const age = getPlayer(career).age + 1;
  const lastResort = lastResortActive(career);
  const limit = current ? INVESTOR.KEEP_POSITION : INVESTOR.MAX_POSITION;
  const name = current?.name ?? INVESTOR_NAMES[hashSeed(career.seed, 'investor') % INVESTOR_NAMES.length] ?? 'Investidor';
  const fresh = lastResort ? INVESTOR.LAST_RESORT_SHARE : position !== null && position <= 3 ? INVESTOR.SHARE_TOP3 : INVESTOR.SHARE_TOP8;
  // Em centésimos, para a soma de fatias não acumular erro de arredondamento.
  const share = current ? Math.min(INVESTOR.MAX_SHARE, Math.round((current.share + INVESTOR.EXTRA_SEAT_SHARE) * 100) / 100) : fresh;
  const added = Math.round((share - (current?.share ?? 0)) * 100) / 100;
  const requirements: PathRequirement[] = [
    {
      label: 'Resultado',
      detail: lastResort
        ? 'Último recurso: o investidor aposta em você com o resultado que tiver'
        : position === null
          ? `Terminar entre os ${limit} primeiros (a temporada ainda não começou)`
          : `${position}º no campeonato (precisa terminar entre os ${limit} primeiros)`,
      met: lastResort || (position !== null && position <= limit),
      progress: lastResort ? 1 : positionProgress(position, limit, career.teams.length * 2),
    },
    {
      label: 'Idade',
      detail: lastResort ? 'Último recurso: sem limite de idade' : `${age} anos na próxima temporada (máximo ${INVESTOR.MAX_AGE})`,
      met: lastResort || current !== null || age <= INVESTOR.MAX_AGE,
      progress: lastResort || current !== null || age <= INVESTOR.MAX_AGE ? 1 : 0,
    },
    {
      label: 'Exclusividade',
      detail: career.academy ? `A ${career.academy.name} não divide o piloto com um investidor` : 'Sem academia',
      met: career.academy === null,
      progress: career.academy === null ? 1 : 0,
    },
    {
      label: 'Fatia',
      detail:
        added > 0 || !current
          ? `${Math.round(share * 100)}% dos seus ganhos para sempre${current ? ` (hoje são ${Math.round(current.share * 100)}%)` : ''}`
          : `${current.name} já tem a fatia máxima (${Math.round(current.share * 100)}%) e só põe mais dinheiro como último recurso`,
      met: added > 0 || lastResort,
      progress: added > 0 || lastResort ? 1 : 0,
    },
  ];
  return { available: career.mode === 'driver' && requirements.every((r) => r.met), lastResort, name, added, share, requirements };
}

/** Quanto o investidor poria nesta proposta: a vaga e a mudança de polo; como último recurso, também o que faltar para fechar o ano. */
export function investorAmount(career: CareerState, offer: Offer): number {
  const seat = offer.seatCost * (1 - (career.academy?.supportShare ?? 0)) + moveCost(career, offer.categoryId);
  if (!lastResortActive(career)) return Math.round(seat);
  const { projected, creditLimit } = financeProjection(career, offer);
  return Math.round(Math.max(seat, roundTo(-creditLimit - projected, 500) + 500));
}

/** Requisitos esportivos da proposta cumpridos (tudo menos o dinheiro)? */
function sportingMet(career: CareerState, offer: Offer): boolean {
  return offerRequirements(career, offer)
    .filter((r) => r.key !== 'finance')
    .every((r) => r.met);
}

export function canSignInvestor(career: CareerState, offerId: string): boolean {
  const offer = career.offseason?.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'open' || offer.kind === 'fallback' || offer.kind === 'continue') return false;
  if (career.investor?.funded?.season === career.season) return false;
  return investorTerms(career).available && sportingMet(career, offer) && investorAmount(career, offer) > 0;
}

/**
 * Assina com o investidor para uma proposta: o aporte entra no caixa agora, vale só para aquela
 * vaga, e a fatia dele sobre os ganhos do piloto vale para sempre.
 */
export function signInvestor(career: CareerState, offerId: string): CareerState {
  const offer = career.offseason?.offers.find((o) => o.id === offerId);
  if (!offer || !canSignInvestor(career, offerId)) throw new Error('O investidor não paga esta vaga.');
  const terms = investorTerms(career);
  const amount = investorAmount(career, offer);
  const investor: Investor = {
    name: terms.name,
    share: terms.share,
    sinceSeason: career.investor?.sinceSeason ?? career.season,
    invested: (career.investor?.invested ?? 0) + amount,
    received: career.investor?.received ?? 0,
    seats: (career.investor?.seats ?? 0) + 1,
    funded: { season: career.season, offerId },
  };
  return {
    ...career,
    investor,
    finance: post(career.finance, career.season, career.calendar.length, 'investor', amount, `Aporte de ${terms.name}: vaga na ${offer.teamName}`),
  };
}

/* ------------------------------------------------------------------ */
/* Trabalho paralelo                                                   */
/* ------------------------------------------------------------------ */

export function setSideJob(career: CareerState, job: SideJob): CareerState {
  if (career.mode !== 'driver') throw new Error('Só o piloto tem trabalho paralelo.');
  if (job !== 'none' && !sideJobAllowed(career.categoryId)) throw new Error('A agenda deste campeonato não deixa tempo para um trabalho paralelo.');
  return { ...career, sideJob: job };
}

/* ------------------------------------------------------------------ */
/* Portas no fechamento do ano                                         */
/* ------------------------------------------------------------------ */

export type DoorKey = 'own' | 'academy' | 'crowdfund' | 'investor';

/** Propostas que são uma vaga de verdade: todas menos a vaga de aluguel. */
export function realOffers(career: CareerState): Offer[] {
  return (career.offseason?.offers ?? []).filter((o) => o.kind !== 'fallback' && o.status === 'open');
}

/**
 * Por qual porta o piloto consegue aceitar esta proposta: com o que tem, pela academia, com a
 * vaquinha ou com o investidor (nesta ordem, da mais barata para a mais cara). null = nenhuma.
 */
export function doorFor(career: CareerState, offer: Offer): DoorKey | null {
  if (canAcceptOffer(career, offer)) return 'own';
  if (offer.status !== 'open' || !sportingMet(career, offer)) return null;
  if (canJoinAcademy(career) && canAcceptOffer(joinAcademyDoor(career), offer)) return 'academy';
  if (canLaunchCrowdfund(career) && canAcceptOffer(launchCrowdfund(career), offer)) return 'crowdfund';
  if (canSignInvestor(career, offer.id) && canAcceptOffer(signInvestor(career, offer.id), offer)) return 'investor';
  return null;
}

/** Abre a porta indicada para a proposta e devolve a carreira pronta para assinar. */
export function openDoor(career: CareerState, offer: Offer, door: DoorKey): CareerState {
  if (door === 'academy') return joinAcademyDoor(career);
  if (door === 'crowdfund') return launchCrowdfund(career);
  if (door === 'investor') return signInvestor(career, offer.id);
  return career;
}

/** Há alguma porta aberta neste fechamento: uma vaga, fora a de aluguel, que o piloto consegue aceitar de algum jeito? */
export function hasOpenDoor(career: CareerState): boolean {
  return realOffers(career).some((offer) => doorFor(career, offer) !== null);
}

/**
 * Último recurso: se já passaram as temporadas do limite sem porta e nenhuma equipe fez uma
 * proposta que o piloto possa disputar, o investidor traz uma vaga numa equipe do meio do grid do
 * campeonato atual. Devolve as propostas com ela incluída (antes da vaga de aluguel).
 */
export function withLastResortOffer(career: CareerState, offers: readonly Offer[]): Offer[] {
  if (!lastResortActive(career)) return [...offers];
  const probe: CareerState = career.offseason ? { ...career, offseason: { ...career.offseason, offers: [...offers] } } : career;
  if (offers.some((o) => o.kind !== 'fallback' && o.kind !== 'continue' && sportingMet(probe, o))) return [...offers];
  const category = getCategory(career.categoryId);
  const ranked = rankTeams(teamsOfCategory(career, category.id));
  const taken = new Set(offers.filter((o) => o.categoryId === category.id && o.kind !== 'fallback').map((o) => o.teamId));
  const rank = ranked.findIndex((t, i) => i >= INVESTOR.LAST_RESORT_TEAM_RANK && !taken.has(t.id));
  const team = ranked[rank];
  if (!team) return [...offers];
  const isOwn = team.id === getPlayer(career).teamId;
  const offer: Offer = {
    ...buildOffer(career, category, team, rank, isOwn ? 'renewal' : 'transfer', CONTRACT_RULES.MIN_INTEREST.transfer),
    id: `offer-s${career.season}-${teamKey(category.id, team.id)}-investor`,
    years: 1,
  };
  const fallbackIndex = offers.findIndex((o) => o.kind === 'fallback');
  const at = fallbackIndex < 0 ? offers.length : fallbackIndex;
  return [...offers.slice(0, at).filter((o) => !(o.teamId === team.id && o.categoryId === category.id)), offer, ...offers.slice(at)];
}

/* ------------------------------------------------------------------ */
/* Relatório para a tela Caminhos                                      */
/* ------------------------------------------------------------------ */

export type DoorStatus = 'active' | 'open' | 'near' | 'closed';

export interface Door {
  id: 'own' | 'academy' | 'crowdfund' | 'investor' | 'job' | 'wait';
  title: string;
  /** active: já vale; open: dá para usar agora; near: falta pouco; closed: ainda longe. */
  status: DoorStatus;
  /** O que a porta dá. */
  summary: string;
  /** O que ela cobra. */
  price: string;
  requirements: PathRequirement[];
}

export interface NextSeat {
  categoryId: CategoryId;
  /** Vaga mais barata do campeonato e a mesma vaga com a bolsa da posição atual. */
  seatCost: number;
  scholarship: number;
  seatAfterScholarship: number;
  /** Mudança de polo, se houver, e custos de correr o ano (viagens, equipamento, aluguel, vida e treino). */
  moveCost: number;
  moveTo: string | null;
  runningCosts: number;
  /** Com o que o piloto conta: dinheiro em caixa e patrocínios da próxima temporada. */
  cash: number;
  sponsors: number;
  /** Quanto falta para bancar a vaga e o ano (zero se já dá). */
  missing: number;
  /** Requisitos esportivos do campeonato (licença, idade, reputação, experiência). */
  sporting: Requirement[];
}

export interface PathsReport {
  /** Posição no campeonato que os requisitos usam (null antes da primeira etapa). */
  position: number | null;
  /** No fechamento do ano as portas abertas podem ser usadas; durante a temporada, só acompanhadas. */
  atOffseason: boolean;
  /** Os campeonatos de cima ao alcance (do Brasileiro, a Fórmula Júnior e o kart internacional). */
  next: NextSeat[];
  doors: Door[];
  /** Temporadas seguidas sem porta e quantas faltam para o investidor de último recurso. */
  noDoorSeasons: number;
  lastResortIn: number;
}

/** Quanto falta para a vaga mais barata de um campeonato de cima, com a bolsa que a posição atual daria. */
function nextSeat(career: CareerState, category: CategoryDefinition, position: number | null): NextSeat {
  const current = getCategory(career.categoryId);
  const scholarship = position === null ? 0 : (CONTRACT_RULES.SCHOLARSHIP[position - 1] ?? 0);
  const seatCost = category.economy.seatCost[1];
  const seatAfterScholarship = roundTo(seatCost * (1 - scholarship), 500);
  const hub = hubOfCategory(category.id);
  const runningCosts = seasonRunningCosts(category.id, hub.id).total + category.economy.living + category.economy.trainingCost * category.rounds;
  const sponsors = renewSponsors(career.sponsors, career.season, current, category, position).kept.reduce((sum, s) => sum + s.perSeason, 0);
  const cash = career.finance.cash;
  const move = moveCost(career, category.id);
  return {
    categoryId: category.id,
    seatCost,
    scholarship,
    seatAfterScholarship,
    moveCost: move,
    moveTo: needsMove(career, category.id) ? hub.name : null,
    runningCosts,
    cash,
    sponsors,
    missing: Math.max(0, Math.round(seatAfterScholarship + move + runningCosts - Math.max(0, cash) - sponsors)),
    sporting: categoryRequirements(career, category.id, { nextSeason: true, reputation: career.offseason?.reputationAfter ?? career.reputation }),
  };
}

const statusOf = (requirements: readonly PathRequirement[], usable: boolean): DoorStatus => {
  if (requirements.every((r) => r.met)) return usable ? 'open' : 'near';
  const average = requirements.reduce((sum, r) => sum + r.progress, 0) / Math.max(1, requirements.length);
  return average >= 0.75 ? 'near' : 'closed';
};

/** O retrato dos caminhos do piloto: quanto falta para a próxima vaga e como está cada porta. */
export function pathsReport(career: CareerState): PathsReport {
  const current = getCategory(career.categoryId);
  const position = seasonPosition(career);
  const atOffseason = career.offseason !== null;
  const next = reachableCategories(career)
    .filter((c) => c.tier > current.tier)
    .map((c) => nextSeat(career, c, position));
  const cheapest = [...next].sort((a, b) => a.missing - b.missing)[0];
  const offers = realOffers(career);
  const promotions = offers.filter((o) => getCategory(o.categoryId).tier > current.tier);

  const ownRequirements: PathRequirement[] = cheapest
    ? [
        {
          label: 'Dinheiro',
          detail:
            cheapest.missing > 0
              ? `Faltam ${money(career, cheapest.missing)} para a vaga mais barata ${categoryRef(cheapest.categoryId, 'de')} e os custos do ano`
              : `O caixa e os patrocínios cobrem a vaga mais barata ${categoryRef(cheapest.categoryId, 'de')}`,
          met: cheapest.missing === 0,
          progress: clamp01(1 - cheapest.missing / Math.max(1, cheapest.seatAfterScholarship + cheapest.moveCost + cheapest.runningCosts)),
        },
        {
          label: 'Bolsa',
          detail:
            cheapest.scholarship > 0
              ? `${position}º lugar: bolsa de ${Math.round(cheapest.scholarship * 100)}% na vaga de cima`
              : 'Campeão ganha 60% da vaga de cima; vice, 35%; terceiro, 20%',
          met: cheapest.scholarship > 0,
          progress: positionProgress(position, CONTRACT_RULES.SCHOLARSHIP.length, career.teams.length * 2),
        },
        ...cheapest.sporting.map((r) => ({ label: r.label, detail: r.detail, met: r.met, progress: r.met ? 1 : 0 })),
      ]
    : [];
  const ownOpen = atOffseason ? promotions.some((o) => canAcceptOffer(career, o)) : false;
  const own: Door = {
    id: 'own',
    title: 'Dinheiro próprio, patrocínio e bolsa',
    status: ownOpen ? 'open' : statusOf(ownRequirements.filter((r) => r.label !== 'Bolsa'), false),
    summary: 'O caminho sem dono: você paga a vaga com o que juntou, com os patrocinadores e com a bolsa de quem termina entre os três primeiros.',
    price: 'Nada além do seu dinheiro. Patrocinador cobra a meta: quem não a vê cumprida rompe no fim do ano.',
    requirements: ownRequirements,
  };

  const academyReqs = academyRequirements(career);
  const academy: Door = {
    id: 'academy',
    title: career.academy ? career.academy.name : 'Academia de equipe',
    status: career.academy ? 'active' : statusOf(academyReqs, atOffseason),
    summary: 'Uma equipe do topo paga a sua vaga e as equipes ligadas a ela passam a olhar para você.',
    price: `Exclusividade (um patrocinador pessoal só, sem investidor e sem vaquinha) e resultado: terminar entre os ${ACADEMY_DOOR.TARGET_POSITION} primeiros, ou dispensa depois de dois anos ruins.`,
    requirements: career.academy
      ? [
          {
            label: 'Meta da academia',
            detail:
              position === null
                ? `Terminar entre os ${career.academy.targetPosition} primeiros`
                : `${position}º no campeonato (meta: até o ${career.academy.targetPosition}º)${career.academy.strikes > 0 ? '; você já tem um aviso' : ''}`,
            met: position !== null && position <= career.academy.targetPosition,
            progress: positionProgress(position, career.academy.targetPosition, career.teams.length * 2),
          },
        ]
      : academyReqs,
  };

  const crowdfundReqs = crowdfundRequirements(career);
  const pressure = crowdfundTarget(career);
  const crowdfund: Door = {
    id: 'crowdfund',
    title: 'Vaquinha da cidade',
    status: pressure !== null ? 'active' : statusOf(crowdfundReqs, atOffseason),
    summary:
      pressure !== null && career.crowdfund
        ? `${career.crowdfund.town} juntou ${money(career, career.crowdfund.amount)} por você.`
        : `${hometownOf(career)} junta cerca de ${money(career, crowdfundAmount(career))} de uma vez, sem pedir parte dos seus ganhos.`,
    price: 'A torcida local cobra: na temporada seguinte ela espera um resultado e, se ele não vier, a moral e a reputação sentem.',
    requirements:
      pressure !== null
        ? [
            {
              label: 'Cobrança da torcida',
              detail: position === null ? `Terminar entre os ${pressure} primeiros` : `${position}º no campeonato (a cidade espera até o ${pressure}º)`,
              met: position !== null && position <= pressure,
              progress: positionProgress(position, pressure, career.teams.length * 2),
            },
          ]
        : crowdfundReqs,
  };

  const terms = investorTerms(career);
  const investor: Door = {
    id: 'investor',
    title: career.investor ? career.investor.name : terms.lastResort ? 'Investidor de último recurso' : 'Investidor',
    status: career.investor && !atOffseason ? 'active' : statusOf(terms.requirements, atOffseason),
    summary: terms.lastResort
      ? 'Ele paga a vaga, a mudança e o que faltar para fechar o ano. Se nenhuma equipe fez proposta, traz uma vaga no meio do grid.'
      : 'Ele paga a vaga de uma proposta (e a mudança de polo, se houver). O dinheiro só vale para aquela vaga.',
    price: `${Math.round(terms.share * 100)}% dos seus ganhos (salário, bônus e o que sobra dos patrocínios depois de pagar a vaga), para sempre. Cada vaga a mais que ele pagar soma ${Math.round(INVESTOR.EXTRA_SEAT_SHARE * 100)} pontos, até ${Math.round(INVESTOR.MAX_SHARE * 100)}%.`,
    requirements: terms.requirements,
  };

  const jobAllowed = sideJobAllowed(career.categoryId);
  const job: Door = {
    id: 'job',
    title: career.sideJob === 'none' ? 'Trabalho paralelo' : SIDE_JOB_INFO[career.sideJob].name,
    status: career.sideJob !== 'none' ? 'active' : jobAllowed ? 'open' : 'closed',
    summary: `Instrutor de kart rende ${money(career, SIDE_JOBS.instructor.perRound)} por etapa; ajudante de mecânico, ${money(career, SIDE_JOBS.mechanic.perRound)} e conserto ${Math.round(SIDE_JOBS.mechanic.damageDiscount * 100)}% mais barato.`,
    price: `Tempo de treino: ele rende ${Math.round((1 - SIDE_JOBS.instructor.training) * 100)}% menos como instrutor e ${Math.round((1 - SIDE_JOBS.mechanic.training) * 100)}% menos na oficina.`,
    requirements: [
      {
        label: 'Agenda',
        detail: jobAllowed ? `${current.name}: sobra tempo entre as etapas` : 'Acima da Fórmula Júnior a agenda não deixa tempo para outro trabalho',
        met: jobAllowed,
        progress: jobAllowed ? 1 : 0,
      },
    ],
  };

  const rental = roundTo(current.economy.seatCost[1] * RUNNING_COSTS.FALLBACK_SEAT_SHARE, 500);
  const wait: Door = {
    id: 'wait',
    title: 'Mais um ano atrás de resultado',
    status: 'open',
    summary: 'A porta que nunca fecha: a vaga de aluguel na equipe mais fraca sempre existe, e um ano bom reabre as outras portas.',
    price: `Tempo, e cerca de ${money(career, rental)} da vaga de aluguel, que pode ser paga a crédito.`,
    requirements: [],
  };

  return {
    position,
    atOffseason,
    next,
    doors: [own, academy, crowdfund, investor, job, wait],
    noDoorSeasons: career.noDoorSeasons,
    lastResortIn: Math.max(0, INVESTOR.LAST_RESORT_AFTER - career.noDoorSeasons),
  };
}
