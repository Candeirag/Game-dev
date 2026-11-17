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
 *
 * A aposentadoria das pistas e a vida de dirigente ficam em
 * management/executive.ts.
 */
import type { CareerState, Driver, InboxMessage, Offer, RoundRecord, SeasonSummary, Team } from '@/domain/schemas';
import { getCategory, type CategoryDefinition } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { TEAM_TARGETS, initialTeams } from '@/data/teams';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { computeDriverStandings, computeTeamStandings } from '../championship/standings';
import { instantiateEvent } from '../events/engine';
import { createRng, gaussian, hashSeed } from '../rng';
import { buildCategoryField, rankTeams, teamStrength } from '../world/generation';
import { canAcceptOffer, contractFromOffer, generateOffers, negotiate, releaseFeeFor, type NegotiationDemand } from './contracts';
import { buildCalendar } from './createCareer';
import { applyAging, developDriver } from './development';
import { birthTrainingFactor } from '../birth/effects';
import { closeFamilyYear } from '../dynasty/family';
import { beginSeasonFamily } from '../dynasty/familyEvents';
import { checkMortality, touchLineage } from '../dynasty/succession';
import { closeAssetsYear, settleDebts } from '../economy/assets';
import { closeSeasonFinance, post } from './economy';
import { pushMessages } from './inbox';
import { licensePointsFor } from './license';
import { promotedRivals, runAiMarket, updateMarketInterest } from './market';
import { familyDriverIds, fullName, getPlayer, getTeam } from './selectors';
import { renewSponsors } from './sponsors';
import { money } from './selectors';
import { categoryRef } from '@/domain/categoryNames';
import { counted } from '@/domain/text';
import { recordSeasonTrend } from './trend';

/** A pré-temporada equivale a 2 ciclos de treino. */
const OFFSEASON_TRAINING_CYCLES = 2;
/** Teto da dívida, como fração da vaga mais cara da categoria seguinte, e custo do acordo em reputação. */
const DEBT_CEILING_SHARE = 0.5;
export const DEBT_SETTLEMENT_REPUTATION = 4;
/** Confiança abaixo da qual a equipe rescinde um contrato vigente. */
const TRUST_TERMINATION = 18;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Reputação: é o prestígio do piloto no automobilismo, de 0 a 100, e fica
 * ancorada ao degrau em que ele compete. Cada temporada tem uma "nota de
 * prestígio" = base da categoria + bônus pela posição final, e a reputação
 * anda metade do caminho até essa nota, mais 0,5 por vitória.
 *
 * Bases: 5 (kart regional), 15, 27, 38, 50, 62 e 74 (Grand Prix Mundial).
 * Bônus: campeão +22, vice +18, 3º +15, até 5º +13, até 10º +6, até 15º 0,
 * abaixo disso −5.
 *
 * Consequência: um campeão regional chega perto de 20, não de 100; só quem
 * vence nas categorias de cima se aproxima do topo. Um piloto que termina
 * sempre entre os cinco primeiros cumpre o requisito de reputação do degrau
 * seguinte a cada temporada.
 */
export const REPUTATION = {
  TIER_BASE: [0, 5, 15, 27, 38, 50, 62, 74],
  SPEED: 0.5,
  WIN_BONUS: 0.5,
} as const;

export function positionPrestige(position: number): number {
  if (position === 1) return 22;
  if (position === 2) return 18;
  if (position === 3) return 15;
  if (position <= 5) return 13;
  if (position <= 10) return 6;
  if (position <= 15) return 0;
  return -5;
}

export function reputationAfterSeason(reputation: number, position: number, wins: number, tier: number): number {
  const prestige = (REPUTATION.TIER_BASE[tier] ?? 0) + positionPrestige(position);
  return Math.round(clamp(reputation + (prestige - reputation) * REPUTATION.SPEED + wins * REPUTATION.WIN_BONUS, 0, 100));
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

  // Um parceiro que conhece a imprensa ajuda a imagem: +1 de reputação por temporada.
  const mediaBoost = career.family.partner?.background === 'media' ? 1 : 0;
  const reputationAfter = Math.min(100, reputationAfterSeason(career.reputation, me.position, me.wins, category.tier) + mediaBoost);
  const licensePointsEarned = licensePointsFor(category.id, me.position);
  const license = {
    ...career.license,
    history: [...career.license.history, { season: career.season, categoryId: category.id, position: me.position, points: licensePointsEarned }],
  };

  // Contas do ano: bônus de título, imposto, investimentos e juros.
  let finance = career.finance;
  if (me.position === 1) finance = post(finance, career.season, lastRound, 'bonus', career.contract.bonuses.title, 'Bônus pelo título');
  // Patrimônio (dividendos, imóveis, empresas, participações, empréstimos) e, depois, o imposto de renda.
  const assets = closeAssetsYear({ ...career, finance });
  const closed = closeSeasonFinance({ ...career, finance: assets.finance });
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

  notes.push(...assets.notes);
  // A família também fecha o ano: temporada dos filhos, aniversários e a relação do casal.
  const family = closeFamilyYear(career);
  const base: CareerState = { ...career, reputation: reputationAfter, license, finance, academy, family: family.family };
  const offers = generateOffers(base, reputationAfter, contractStatus, me.position);
  const champion = career.drivers.find((d) => d.id === standings[0]?.driverId);
  const message: InboxMessage = {
    id: `s${career.season}-end`,
    date,
    category: 'season',
    title: `Fim da temporada ${career.year}`,
    body: `${champion ? fullName(champion) : 'O campeão'} é o campeão. Você terminou em ${me.position}º (meta: ${team.driverTarget}º) e ganhou ${counted(licensePointsEarned, 'ponto', 'pontos')} de licença. Imposto de renda do ano: ${money(career, closed.report.tax)}. Veja as propostas para a próxima temporada na tela Carreira.`,
  };

  const messages: InboxMessage[] = [message];
  if (family.notes.length > 0)
    messages.push({ id: `s${career.season}-family`, date, category: 'family', title: 'A família neste ano', body: family.notes.join(' ') });
  const closedState: CareerState = {
    ...base,
    inbox: pushMessages(base.inbox, messages),
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
  return checkMortality(touchLineage(closedState));
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
 * Evolução das equipes entre temporadas.
 *
 * Cada posição no campeonato de equipes tem um carro de referência: o da
 * equipe que ocupa essa posição na ordem de forças original da categoria (a
 * "escada" de `initialTeams`). A cada temporada, a equipe anda 15% do caminho
 * entre o carro dela e a referência da posição em que terminou, no máximo 2
 * pontos em motor e chassi e 1 em confiabilidade. Quem termina acima do que o
 * carro vale atrai dinheiro e melhora; quem termina abaixo perde verba.
 *
 * A isso se soma o acerto (ou erro) do projeto do ano: uma variação sorteada
 * de cerca de 1,5 ponto por equipe, limitada a 3 e com soma zero no grid. É ela
 * que cria ciclos: uma equipe que acerta dois projetos seguidos sobe na
 * tabela, e a posição melhor passa a puxar o carro para cima. A cada cinco
 * temporadas o regulamento muda e essa variação dobra. A meta de cada equipe
 * é então recalculada pela nova ordem de forças.
 *
 * A referência fixa mantém a categoria com a mesma cara ao longo de décadas.
 * A regra anterior (até ±2 pontos pela diferença entre a posição esperada e a
 * obtida) tinha dois defeitos que só aparecem em carreiras longas: o
 * arredondamento dava +1 a quem subia uma posição e 0 a quem caía uma, e a
 * melhor equipe só podia perder enquanto a pior só podia ganhar. Em 60
 * temporadas, os carros inflavam e ficavam quase iguais.
 */
export const TEAM_EVOLUTION = {
  PULL: 0.15,
  MAX_STEP: 2,
  MAX_RELIABILITY_STEP: 1,
  DESIGN_SD: 1.5,
  MAX_DESIGN: 3,
  /** A cada cinco temporadas o regulamento técnico muda e a variação de projeto dobra: é quando o grid se embaralha. */
  REGULATION_CYCLE: 5,
  REGULATION_FACTOR: 2,
} as const;

/** A temporada que vai começar depois de `season` estreia um regulamento novo? (O ano do ciclo varia com a carreira e a categoria.) */
export function isRegulationChange(careerSeed: number, season: number, categoryId: CareerState['categoryId']): boolean {
  return season % TEAM_EVOLUTION.REGULATION_CYCLE === hashSeed(careerSeed, 'regulation', categoryId) % TEAM_EVOLUTION.REGULATION_CYCLE;
}

export function evolveTeams(teams: readonly Team[], career: CareerState): Team[] {
  const standings = computeTeamStandings(career.rounds, teams, career.adjustments);
  const ladder = rankTeams(initialTeams(career.categoryId));
  const expectedOrder = rankTeams(teams).map((t) => t.id);
  const limit = (v: number) => clamp(Math.round(v * 10) / 10, 40, 97);
  // Projeto do ano: um sorteio por equipe, descontada a média para a soma do grid ser zero.
  const shake = isRegulationChange(career.seed, career.season, career.categoryId) ? TEAM_EVOLUTION.REGULATION_FACTOR : 1;
  const design = teams.map((team) =>
    clamp(
      gaussian(createRng(hashSeed(career.seed, career.season, 'team-design', team.id))) * TEAM_EVOLUTION.DESIGN_SD * shake,
      -TEAM_EVOLUTION.MAX_DESIGN * shake,
      TEAM_EVOLUTION.MAX_DESIGN * shake,
    ),
  );
  const designMean = design.reduce((sum, v) => sum + v, 0) / Math.max(1, design.length);
  const evolved = teams.map((team, index) => {
    const position = standings.find((s) => s.teamId === team.id)?.position ?? expectedOrder.indexOf(team.id) + 1;
    const reference = ladder[position - 1];
    if (!reference) return team;
    const pull = clamp((teamStrength(reference) - teamStrength(team)) * TEAM_EVOLUTION.PULL, -TEAM_EVOLUTION.MAX_STEP, TEAM_EVOLUTION.MAX_STEP);
    const step = pull + (design[index] ?? 0) - designMean;
    const reliability = clamp(
      (reference.car.reliability - team.car.reliability) * TEAM_EVOLUTION.PULL,
      -TEAM_EVOLUTION.MAX_RELIABILITY_STEP,
      TEAM_EVOLUTION.MAX_RELIABILITY_STEP,
    );
    return {
      ...team,
      car: { engine: limit(team.car.engine + step), chassis: limit(team.car.chassis + step), reliability: limit(team.car.reliability + reliability) },
    };
  });
  const newOrder = rankTeams(evolved).map((t) => t.id);
  return evolved.map((t) => ({ ...t, driverTarget: TEAM_TARGETS[newOrder.indexOf(t.id)] ?? 16 }));
}

/**
 * Versão compacta de uma etapa para o arquivo de temporadas: ficam o resultado
 * oficial e o grid, que é o que o histórico mostra. A narração volta a volta,
 * as tentativas de classificação e os tempos de treino são descartados, para
 * o save não crescer vários megabytes ao longo de uma carreira longa.
 */
export function compactRound(record: RoundRecord): RoundRecord {
  return {
    ...record,
    practice: { ...record.practice, entries: [] },
    qualifying: { ...record.qualifying, entries: record.qualifying.entries.map((e) => ({ ...e, attempts: [] })) },
    race: { ...record.race, events: [] },
  };
}

/** Temporadas mais recentes guardadas com o resultado completo de cada etapa. */
export const FULL_HISTORY_SEASONS = 6;

/**
 * Enxuga o arquivo: nas temporadas mais antigas que as seis últimas, cada
 * etapa fica só com o pódio e com os resultados dos pilotos da família. A
 * classificação final do campeonato continua completa. Sem isso, um save de
 * várias gerações passaria de 15 MB.
 */
export function trimHistory(history: readonly SeasonSummary[], familyIds: ReadonlySet<string>): SeasonSummary[] {
  const cut = history.length - FULL_HISTORY_SEASONS;
  return history.map((summary, index) => {
    if (index >= cut) return summary;
    return {
      ...summary,
      rounds: summary.rounds.map((r) => ({
        ...r,
        qualifying: { ...r.qualifying, entries: r.qualifying.entries.filter((e) => familyIds.has(e.driverId)) },
        race: { ...r.race, entries: r.race.entries.filter((e) => e.position <= 3 || familyIds.has(e.driverId)), teamOrders: [] },
      })),
    };
  });
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
    rounds: career.rounds.map(compactRound),
    mode: 'driver',
  };
}

/**
 * Passagem de ano de um piloto: idade, declínio, pré-temporada e condição renovada.
 * `playerTraining` multiplica a pré-temporada do jogador (o ritmo de aprendizado do nascimento).
 */
export function winter(driver: Driver, careerSeed: number, season: number, playerTraining = 1): Driver {
  let d: Driver = { ...driver, age: driver.age + 1 };
  d = applyAging(d, hashSeed(careerSeed, season, 'aging', d.id));
  if (d.teamId || d.isPlayer)
    d = developDriver(d, hashSeed(careerSeed, season, 'offseason', d.id), OFFSEASON_TRAINING_CYCLES, d.isPlayer ? playerTraining : 1).driver;
  return {
    ...d,
    trainingFocus: d.isPlayer ? d.trainingFocus : chooseAiTrainingFocus(d.attributes),
    // O inverno zera a fase e aproxima confiança e moral do neutro; lesões cicatrizam.
    condition: {
      form: NEUTRAL_CONDITION.form,
      confidence: Math.round((d.condition.confidence + 50) / 2),
      morale: Math.round((d.condition.morale + NEUTRAL_CONDITION.morale) / 2),
    },
    injury: null,
  };
}

/** Monta o grid da nova categoria, com o jogador e os rivais que subiram junto. */
function enterCategory(
  career: CareerState,
  next: CategoryDefinition,
  offer: Offer,
  role: 'first' | 'second',
  nextSeason: number,
): { teams: Team[]; drivers: Driver[]; news: string[] } {
  const current = getCategory(career.categoryId);
  const player = getPlayer(career);
  const rivals = next.tier > current.tier ? promotedRivals(career, next) : [];
  const usedNames = new Set([fullName(player), ...rivals.map(fullName)]);
  const field = buildCategoryField(next.id, career.seed, nextSeason, usedNames);
  let drivers = field.drivers.filter((d) => !(d.teamId === offer.teamId && d.role === role));
  const news: string[] = [];

  // Os rivais ocupam a vaga de segundo piloto em equipes do meio do grid.
  const hosts = rankTeams(field.teams)
    .slice(2)
    .filter((t) => t.id !== offer.teamId);
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
  if (career.succession) throw new Error('Escolha o herdeiro antes de continuar.');

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
    news.push(`Você pagou ${money(career, fee)} de multa para deixar o contrato anterior.`);
  }

  // Acerto com credores: uma dívida maior que metade da vaga mais cara da categoria em que o
  // piloto vai correr é impagável naquele nível. Primeiro os bens do piloto são executados
  // (aplicações, ações, imóveis, empresas, participações); só o que sobrar acima do teto é
  // perdoado, e a notícia arranha a reputação.
  let reputation = career.reputation;
  const debtCeiling = Math.max(next.economy.seatCost[0] * DEBT_CEILING_SHARE, next.economy.living * 2);
  const settlement = settleDebts(finance, career.season, career.calendar.length, debtCeiling);
  finance = settlement.finance;
  if (settlement.raised > 0)
    news.push(`Para cobrir a dívida, os credores executaram ${money(career, settlement.raised)} do seu patrimônio (${settlement.sold.join(', ')}).`);
  if (settlement.forgiven > 0) {
    reputation = Math.max(0, reputation - DEBT_SETTLEMENT_REPUTATION);
    news.push(
      `Acordo com credores: ${money(career, settlement.forgiven)} da sua dívida foram perdoados, ao custo de ${DEBT_SETTLEMENT_REPUTATION} pontos de reputação.`,
    );
  }

  const sponsors = renewSponsors(career.sponsors, career.season, getCategory(career.categoryId), next);
  for (const s of sponsors.renewed) news.push(`${s.name} renovou o patrocínio por ${money(career, s.perSeason)} por temporada.`);
  for (const s of sponsors.left) news.push(s.tier === 0 ? 'O apoio financeiro da família chegou ao fim.' : `${s.name} não renovou o patrocínio.`);

  let academy = career.academy;
  if (academy && next.tier === 7) {
    news.push(`Você se formou na ${academy.name}: chegou ${categoryRef(next.id, 'a')}.`);
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
    if (isRegulationChange(career.seed, career.season, career.categoryId))
      news.push(`Regulamento técnico novo ${categoryRef(next.id, 'em')}: as equipes refizeram o projeto e a ordem de forças pode ter mudado.`);
    const before = career.teams.find((t) => t.id === offer.teamId);
    const after = teams.find((t) => t.id === offer.teamId);
    if (before && after) {
      const change = teamStrength(after) - teamStrength(before);
      if (Math.abs(change) >= 1)
        news.push(
          `A ${after.name} ${change > 0 ? 'acertou' : 'errou'} o projeto do ano: o ${next.machine} ficou ${counted(Math.abs(change).toFixed(1).replace('.', ','), 'ponto', 'pontos')} ${change > 0 ? 'melhor' : 'pior'}.`,
        );
    }
    const market = runAiMarket(career, career.drivers, teams, { teamId: offer.teamId, role: contract.role }, nextSeason);
    others = market.drivers;
    news.push(...market.news);
  }
  const newPlayer: Driver = { ...player, teamId: offer.teamId, role: contract.role, contractEnd: contract.endSeason };
  const playerTraining = birthTrainingFactor(career);
  const drivers = [newPlayer, ...others].map((d) => winter(d, career.seed, career.season, playerTraining));
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
    reputation,
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
    history: trimHistory([...career.history, summary], familyDriverIds(career)),
    seasonTrend: recordSeasonTrend(career),
  };
  state = { ...state, marketInterest: updateMarketInterest(state, 1) };

  // Começo de temporada: um patrocinador pode se apresentar.
  const sponsorOffer = instantiateEvent(state, 'sponsor-offer', 0);
  if (sponsorOffer) state = { ...state, pendingEvents: [sponsorOffer] };

  const kindText = changingCategory
    ? next.tier > getCategory(career.categoryId).tier
      ? `Você subiu ${categoryRef(next.id, 'para')}`
      : `Você vai disputar ${categoryRef(next.id, 'the')}`
    : `Você segue ${categoryRef(next.id, 'em')}`;
  const messages: InboxMessage[] = [
    {
      id: `s${nextSeason}-start`,
      date,
      category: 'season',
      title: `Temporada ${nextYear}: ${next.shortName}`,
      body: `${kindText}, pela ${newTeam.name}, como ${contract.role === 'first' ? 'primeiro' : 'segundo'} piloto. A meta é terminar entre os ${newTeam.driverTarget} primeiros. Custo da vaga: ${money(career, contract.seatCost)}; salário: ${money(career, contract.salary)}.`,
    },
  ];
  if (news.length > 0) messages.push({ id: `s${nextSeason}-market`, date, category: 'contract', title: 'Mercado de pilotos', body: news.join(' ') });
  return beginSeasonFamily({ ...state, inbox: pushMessages(career.inbox, messages) });
}
