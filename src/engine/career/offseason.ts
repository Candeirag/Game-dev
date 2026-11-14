/**
 * Fechamento de temporada e início da seguinte.
 *
 * closeSeason roda uma vez, logo após a última etapa: avalia a meta, atualiza
 * a reputação, concede os pontos de licença, fecha as contas do ano, revisa o
 * contrato e a academia e monta as propostas. O estado fica em
 * `career.offseason` até o jogador assinar.
 *
 * startNextSeason aplica a proposta escolhida: paga a multa (se houver),
 * troca de equipe ou de categoria, roda o mercado da IA, envelhece e
 * desenvolve os pilotos, evolui as equipes e monta o novo calendário.
 */
import type { CareerState, Driver, InboxMessage, Offer, SeasonSummary, Team } from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { TEAM_TARGETS } from '@/data/teams';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { computeDriverStandings, computeTeamStandings } from '../championship/standings';
import { instantiateEvent } from '../events/engine';
import { hashSeed } from '../rng';
import { buildCategoryField, rankTeams, teamStrength } from '../world/generation';
import { canAcceptOffer, contractFromOffer, generateOffers, negotiate, releaseFeeFor, type NegotiationDemand } from './contracts';
import { buildCalendar } from './createCareer';
import { applyAging, developDriver } from './development';
import { closeSeasonFinance, post } from './economy';
import { pushMessages } from './inbox';
import { licensePointsFor } from './license';
import { promotedRivals, runAiMarket, updateMarketInterest } from './market';
import { fullName, getPlayer, getTeam } from './selectors';
import { renewSponsors } from './sponsors';

/** A pré-temporada equivale a 2 ciclos de treino. */
const OFFSEASON_TRAINING_CYCLES = 2;
/** Confiança abaixo da qual a equipe rescinde um contrato vigente. */
const TRUST_TERMINATION = 18;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Variação de reputação na temporada: 3 pontos por posição acima ou abaixo da
 * meta, mais 2 por vitória e 1 por pódio (limitada entre −12 e +18); título
 * vale +5; terminar na metade de cima do grid vale um bônus que cresce com o
 * degrau da categoria (0,8 por degrau), porque resultado em categoria alta
 * repercute mais.
 */
export function reputationDelta(position: number, target: number, wins: number, podiums: number, fieldSize: number, tier: number): number {
  let delta = clamp(3 * (target - position) + 2 * wins + podiums, -12, 18);
  if (position === 1) delta += 5;
  if (position <= fieldSize / 2) delta += tier * 0.8;
  return delta;
}

export function closeSeason(career: CareerState): CareerState {
  if (career.offseason) return career;
  const player = getPlayer(career);
  const team = getTeam(career, player.teamId ?? '');
  const category = getCategory(career.categoryId);
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const teams = computeTeamStandings(career.rounds, career.teams, career.adjustments);
  const me = standings.find((s) => s.driverId === player.id);
  if (!me) throw new Error('Jogador fora da classificação.');
  const lastRound = career.calendar.length;
  const date = career.calendar[lastRound - 1]?.date ?? `${career.year}-12-01`;
  const notes: string[] = [];

  const reputationAfter = Math.round(clamp(career.reputation + reputationDelta(me.position, team.driverTarget, me.wins, me.podiums, standings.length, category.tier), 0, 100));
  const licensePointsEarned = licensePointsFor(category.id, me.position);
  const license = { ...career.license, history: [...career.license.history, { season: career.season, categoryId: category.id, position: me.position, points: licensePointsEarned }] };

  // Contas do ano: bônus de título, imposto, investimentos e juros.
  let finance = career.finance;
  if (me.position === 1) finance = post(finance, career.season, lastRound, 'bonus', career.contract.bonuses.title, 'Bônus pelo título');
  const closed = closeSeasonFinance({ ...career, finance });
  finance = closed.finance;

  // Contrato.
  let contractStatus: 'active' | 'expired' | 'terminated' = career.contract.endSeason > career.season ? 'active' : 'expired';
  const clause = career.contract.clauses.performanceTarget;
  if (contractStatus === 'active' && clause !== null && me.position > clause) {
    contractStatus = 'terminated';
    notes.push(`A ${team.name} acionou a cláusula de desempenho (terminar até o ${clause}º lugar) e rescindiu o seu contrato.`);
  } else if (contractStatus === 'active' && career.relations.teamTrust < TRUST_TERMINATION) {
    contractStatus = 'terminated';
    notes.push(`A ${team.name} perdeu a confiança em você e rescindiu o contrato.`);
  } else if (contractStatus === 'expired') {
    notes.push(`O seu contrato com a ${team.name} chegou ao fim.`);
  }

  // Academia: duas temporadas abaixo da exigência encerram o vínculo.
  let academy = career.academy;
  if (academy && category.tier < 7) {
    if (me.position > academy.targetPosition) {
      const strikes = academy.strikes + 1;
      if (strikes >= 2) {
        notes.push(`A ${academy.name} dispensou você depois de duas temporadas abaixo da exigência (terminar até o ${academy.targetPosition}º lugar).`);
        academy = null;
      } else {
        notes.push(`A ${academy.name} avisou: mais uma temporada fora dos ${academy.targetPosition} primeiros e você será dispensado.`);
        academy = { ...academy, strikes };
      }
    } else {
      academy = { ...academy, strikes: 0 };
    }
  }

  const base: CareerState = { ...career, reputation: reputationAfter, license, finance, academy };
  const offers = generateOffers(base, reputationAfter, contractStatus);
  const champion = career.drivers.find((d) => d.id === standings[0]?.driverId);
  const message: InboxMessage = {
    id: `s${career.season}-end`,
    date,
    category: 'season',
    title: `Fim da temporada ${career.year}`,
    body: `${champion ? fullName(champion) : 'O campeão'} é o campeão. Você terminou em ${me.position}º (meta: ${team.driverTarget}º) e ganhou ${licensePointsEarned} ponto(s) de licença. Imposto de renda do ano: € ${closed.report.tax.toLocaleString('pt-BR')}. Veja as propostas para a próxima temporada na tela Carreira.`,
  };

  return {
    ...base,
    inbox: pushMessages(base.inbox, [message]),
    offseason: {
      playerPosition: me.position,
      playerPoints: me.points,
      wins: me.wins,
      podiums: me.podiums,
      target: team.driverTarget,
      objectiveMet: me.position <= team.driverTarget,
      reputationBefore: career.reputation,
      reputationAfter,
      licensePointsEarned,
      championDriverId: standings[0]?.driverId ?? '',
      championTeamId: teams[0]?.teamId ?? '',
      contractStatus,
      offers,
      notes,
    },
  };
}

/** Negocia uma proposta aberta. Devolve o novo estado e a resposta da equipe. */
export function negotiateOffer(career: CareerState, offerId: string, demand: NegotiationDemand): { career: CareerState; accepted: boolean; message: string } {
  const offseason = career.offseason;
  const offer = offseason?.offers.find((o) => o.id === offerId);
  if (!offseason || !offer) throw new Error('Proposta não encontrada.');
  const result = negotiate(offer, demand);
  return {
    career: { ...career, offseason: { ...offseason, offers: offseason.offers.map((o) => (o.id === offerId ? result.offer : o)) } },
    accepted: result.accepted,
    message: result.message,
  };
}

/**
 * Evolução das equipes: quem termina acima da posição esperada atrai
 * patrocínio e melhora o equipamento; quem termina abaixo perde verba. São
 * até 2 pontos por temporada em motor e chassi. A meta de cada equipe é então
 * recalculada pela nova ordem de forças.
 */
export function evolveTeams(teams: readonly Team[], career: CareerState): Team[] {
  const standings = computeTeamStandings(career.rounds, teams, career.adjustments);
  const expectedOrder = rankTeams(teams).map((t) => t.id);
  const limit = (v: number) => clamp(Math.round(v * 10) / 10, 40, 97);
  const evolved = teams.map((team) => {
    const expected = expectedOrder.indexOf(team.id) + 1;
    const actual = standings.find((s) => s.teamId === team.id)?.position ?? expected;
    const delta = clamp(Math.round((expected - actual) / 2), -2, 2);
    return { ...team, car: { engine: limit(team.car.engine + delta), chassis: limit(team.car.chassis + delta), reliability: limit(team.car.reliability + Math.sign(delta)) } };
  });
  const newOrder = rankTeams(evolved).map((t) => t.id);
  return evolved.map((t) => ({ ...t, driverTarget: TEAM_TARGETS[newOrder.indexOf(t.id)] ?? 16 }));
}

export function archiveSeason(career: CareerState): SeasonSummary {
  const offseason = career.offseason;
  if (!offseason) throw new Error('A temporada ainda não foi fechada.');
  const player = getPlayer(career);
  const team = getTeam(career, player.teamId ?? '');
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  return {
    season: career.season,
    year: career.year,
    categoryId: career.categoryId,
    championDriverId: offseason.championDriverId,
    championTeamId: offseason.championTeamId,
    playerTeamId: team.id,
    playerTeamName: team.name,
    playerPosition: offseason.playerPosition,
    playerPoints: offseason.playerPoints,
    objectiveTarget: offseason.target,
    objectiveMet: offseason.objectiveMet,
    driverStandings: standings.map((s) => ({ driverId: s.driverId, teamId: s.teamId, position: s.position, points: s.points, wins: s.wins })),
    driverNames: Object.fromEntries(career.drivers.map((d) => [d.id, fullName(d)])),
    teamColors: Object.fromEntries(career.teams.map((t) => [t.id, t.color])),
    rounds: career.rounds,
  };
}

/** Passagem de ano de um piloto: idade, declínio, pré-temporada e condição renovada. */
function winter(driver: Driver, careerSeed: number, season: number): Driver {
  let d: Driver = { ...driver, age: driver.age + 1 };
  d = applyAging(d, hashSeed(careerSeed, season, 'aging', d.id));
  if (d.teamId || d.isPlayer) d = developDriver(d, hashSeed(careerSeed, season, 'offseason', d.id), OFFSEASON_TRAINING_CYCLES).driver;
  return {
    ...d,
    trainingFocus: d.isPlayer ? d.trainingFocus : chooseAiTrainingFocus(d.attributes),
    // O inverno zera a fase e aproxima confiança e moral do neutro; lesões cicatrizam.
    condition: { form: NEUTRAL_CONDITION.form, confidence: Math.round((d.condition.confidence + 50) / 2), morale: Math.round((d.condition.morale + NEUTRAL_CONDITION.morale) / 2) },
    injury: null,
  };
}

/** Monta o grid da nova categoria, com o jogador e os rivais que subiram junto. */
function enterCategory(career: CareerState, next: CategoryDefinition, offer: Offer, role: 'first' | 'second', nextSeason: number): { teams: Team[]; drivers: Driver[]; news: string[] } {
  const current = getCategory(career.categoryId);
  const player = getPlayer(career);
  const rivals = next.tier === current.tier + 1 ? promotedRivals(career, next) : [];
  const usedNames = new Set([fullName(player), ...rivals.map(fullName)]);
  const field = buildCategoryField(next.id, career.seed, nextSeason, usedNames);
  let drivers = field.drivers.filter((d) => !(d.teamId === offer.teamId && d.role === role));
  const news: string[] = [];

  // Os rivais ocupam a vaga de segundo piloto em equipes do meio do grid.
  const hosts = rankTeams(field.teams).slice(2).filter((t) => t.id !== offer.teamId);
  rivals.forEach((rival, i) => {
    const host = hosts[i];
    if (!host) return;
    drivers = drivers.filter((d) => !(d.teamId === host.id && d.role === 'second'));
    drivers.push({ ...rival, teamId: host.id, role: 'second', contractEnd: nextSeason + 1 });
    news.push(`${fullName(rival)} também sobe e assina com a ${host.name}.`);
  });
  return { teams: field.teams, drivers, news };
}

export function startNextSeason(career: CareerState, offerId: string): CareerState {
  const offseason = career.offseason;
  if (!offseason) throw new Error('A temporada ainda não terminou.');
  const offer = offseason.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Não há proposta desta equipe.');
  if (!canAcceptOffer(career, offer)) throw new Error('Você não cumpre os requisitos desta proposta.');

  const player = getPlayer(career);
  const next = getCategory(offer.categoryId);
  const changingCategory = next.id !== career.categoryId;
  const changingTeam = changingCategory || offer.teamId !== player.teamId;
  const nextSeason = career.season + 1;
  const nextYear = career.year + 1;
  const summary = archiveSeason(career);
  const contract = offer.kind === 'continue' ? career.contract : contractFromOffer(offer, nextSeason);
  const news: string[] = [];

  let finance = career.finance;
  const fee = releaseFeeFor(career, offer);
  if (fee > 0) {
    finance = post(finance, career.season, career.calendar.length, 'release', -fee, 'Multa rescisória');
    news.push(`Você pagou € ${fee.toLocaleString('pt-BR')} de multa para deixar o contrato anterior.`);
  }

  const sponsors = renewSponsors(career.sponsors, career.season, next);
  for (const s of sponsors.renewed) news.push(`${s.name} renovou o patrocínio por € ${s.perSeason.toLocaleString('pt-BR')} por temporada.`);
  for (const s of sponsors.left) news.push(s.tier === 0 ? 'O apoio financeiro da família chegou ao fim.' : `${s.name} não renovou o patrocínio.`);

  let academy = career.academy;
  if (academy && next.tier === 7) {
    news.push(`Você se formou na ${academy.name}: chegou à Fórmula 1.`);
    academy = null;
  }

  // Grid da próxima temporada.
  let teams: Team[];
  let others: Driver[];
  if (changingCategory) {
    const field = enterCategory(career, next, offer, contract.role, nextSeason);
    teams = field.teams;
    others = field.drivers;
    news.push(...field.news);
  } else {
    teams = evolveTeams(career.teams, career);
    const market = runAiMarket(career, career.drivers, teams, { teamId: offer.teamId, role: contract.role }, nextSeason);
    others = market.drivers;
    news.push(...market.news);
  }
  const newPlayer: Driver = { ...player, teamId: offer.teamId, role: contract.role, contractEnd: contract.endSeason };
  const drivers = [newPlayer, ...others].map((d) => winter(d, career.seed, career.season));
  const playerAfter = drivers.find((d) => d.isPlayer);
  if (!playerAfter) throw new Error('Jogador desapareceu na transição de temporada.');

  const ids = new Set(drivers.map((d) => d.id));
  const rivalries = Object.fromEntries(Object.entries(career.relations.rivalries).filter(([id]) => ids.has(id)));
  const calendar = buildCalendar(career.seed, nextSeason, nextYear, next);
  const date = calendar[0]?.date ?? `${nextYear}-03-01`;
  const newTeam = teams.find((t) => t.id === offer.teamId);
  if (!newTeam) throw new Error('Equipe escolhida não existe.');

  let state: CareerState = {
    ...career,
    season: nextSeason,
    year: nextYear,
    categoryId: next.id,
    drivers,
    teams,
    calendar,
    nextRoundIndex: 0,
    weekend: null,
    rounds: [],
    adjustments: [],
    gridPenalties: {},
    playerSeasonStartAttributes: { ...playerAfter.attributes },
    contract,
    finance,
    sponsors: sponsors.kept,
    academy,
    license: { ...career.license, penaltyPoints: 0 },
    relations: {
      teamTrust: changingTeam ? Math.round(clamp(50 + (offer.interest - 50) * 0.3, 35, 70)) : career.relations.teamTrust,
      teammate: 50,
      rivalries,
    },
    marketInterest: {},
    pendingEvents: [],
    offseason: null,
    history: [...career.history, summary],
  };
  state = { ...state, marketInterest: updateMarketInterest(state, 1) };

  // Começo de temporada: um patrocinador pode se apresentar.
  const sponsorOffer = instantiateEvent(state, 'sponsor-offer', 0);
  if (sponsorOffer) state = { ...state, pendingEvents: [sponsorOffer] };

  const kindText = changingCategory ? (next.tier > getCategory(career.categoryId).tier ? `Você subiu para a ${next.name}` : `Você vai disputar a ${next.name}`) : `Você segue na ${next.name}`;
  const messages: InboxMessage[] = [
    {
      id: `s${nextSeason}-start`,
      date,
      category: 'season',
      title: `Temporada ${nextYear}: ${next.shortName}`,
      body: `${kindText}, pela ${newTeam.name}, como ${contract.role === 'first' ? 'primeiro' : 'segundo'} piloto. A meta é terminar entre os ${newTeam.driverTarget} primeiros. Custo da vaga: € ${contract.seatCost.toLocaleString('pt-BR')}; salário: € ${contract.salary.toLocaleString('pt-BR')}.`,
    },
  ];
  if (news.length > 0) messages.push({ id: `s${nextSeason}-market`, date, category: 'contract', title: 'Mercado de pilotos', body: news.join(' ') });
  return { ...state, inbox: pushMessages(career.inbox, messages) };
}

/** Encerra a carreira do jogador. O save continua disponível para consulta. */
export function retire(career: CareerState): CareerState {
  if (career.weekend) throw new Error('Termine o fim de semana antes de se aposentar.');
  const date = career.calendar[Math.max(0, career.nextRoundIndex - 1)]?.date ?? `${career.year}-01-01`;
  return {
    ...career,
    status: 'retired',
    pendingEvents: [],
    inbox: pushMessages(career.inbox, [{ id: `s${career.season}-retired`, date, category: 'season', title: 'Aposentadoria', body: 'Você pendurou o capacete. A sua carreira fica registrada no histórico.' }]),
  };
}

export { teamStrength };
