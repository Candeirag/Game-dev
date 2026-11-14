/**
 * Gestão de equipe: estrutura, equipe técnica, instalações, pesquisa e o caixa
 * da equipe, etapa a etapa.
 *
 * A equipe administrada é uma das equipes do campeonato (`career.teams`). O
 * carro e a equipe de box que o motor de corrida usa são os dela; a gestão só
 * muda esses números por regras: melhorias de pesquisa mexem no carro,
 * mecânicos e chefias mexem nos boxes. Nada aqui toca o motor de corrida.
 */
import type { CareerState, CarPerformance, DevArea, DevValues, FacilityKey, InboxMessage, ManagedTeam, ResearchSpend, RoundRecord, StaffMember, StaffRole, Team, TeamSponsor } from '@/domain/schemas';
import { DEV_AREAS, STAFF_ROLES } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { DEV_EFFECTS, MANAGEMENT, REGULATIONS, STAFF_FIRST_NAMES, STAFF_LAST_NAMES, TEAM_ECONOMY, TEAM_SPONSOR_NAMES, teamValue } from '@/data/management';
import { computeTeamStandings } from '../championship/standings';
import { post } from '../career/economy';
import { createRng, gaussian, hashSeed } from '../rng';
import { rankTeams } from '../world/generation';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
const round1 = (v: number) => Math.round(v * 10) / 10;
const zeroDev = (): DevValues => ({ aero: 0, chassis: 0, engine: 0, suspension: 0, manufacturing: 0 });

/** Nota de quem ocupa a função; função vaga rende como um interino nota 38. */
export const VACANT_RATING = 38;

export function requireManagement(career: CareerState): ManagedTeam {
  if (career.mode !== 'executive' || !career.management) throw new Error('Você não comanda nenhuma equipe.');
  return career.management;
}

export function managedTeam(career: CareerState): Team | null {
  return career.management ? (career.teams.find((t) => t.id === career.management?.teamId) ?? null) : null;
}

export function staffRating(m: ManagedTeam, role: StaffRole): number {
  return m.staff.find((s) => s.role === role)?.rating ?? VACANT_RATING;
}

/**
 * Nota do comando da equipe. Se há um chefe contratado pelo dono, vale a dele.
 * Senão, é a do próprio jogador: 45, mais 4 por temporada de experiência como
 * dirigente (até 30) e um quinto da reputação, limitada a 90.
 */
export function principalRating(career: CareerState): number {
  const m = career.management;
  if (!m) return VACANT_RATING;
  const hired = m.staff.find((s) => s.role === 'principal');
  if (hired) return hired.rating;
  return Math.round(clamp(45 + Math.min(30, career.executiveLog.length * 4) + career.reputation * 0.2, 0, 90));
}

/** Equipe de box: mecânicos, chefe dos mecânicos, diretor esportivo e fábrica. */
export function crewRating(m: ManagedTeam): number {
  return Math.round(clamp(35 + m.mechanics * 7 + staffRating(m, 'chiefMechanic') * 0.25 + staffRating(m, 'sportingDirector') * 0.1 + m.facilities.factory, 30, 97));
}

/** Pontos de pesquisa por etapa, antes da divisão entre as áreas. */
export function researchRate(m: ManagedTeam): number {
  const people = 0.55 + staffRating(m, 'technicalDirector') / 200 + staffRating(m, 'chiefEngineer') / 400;
  return m.engineers * MANAGEMENT.SPEND[m.development.spend].points * people * (1 + m.facilities.simulator * MANAGEMENT.SIMULATOR_RESEARCH);
}

/** Custo da pesquisa em uma etapa. */
export function researchCostPerRound(m: ManagedTeam): number {
  const economy = TEAM_ECONOMY[m.categoryId];
  return Math.round(economy.researchCost * m.engineers * MANAGEMENT.SPEND[m.development.spend].cost * (1 - m.facilities.factory * MANAGEMENT.FACTORY_COST_DISCOUNT));
}

/** Pontos de pesquisa para a próxima melhoria de uma área que já teve `gains` melhorias no ano. */
export function researchNeeded(gains: number): number {
  return MANAGEMENT.RESEARCH_BASE * (1 + gains * MANAGEMENT.RESEARCH_GROWTH);
}

/** Fração das horas de túnel de vento a que a equipe tem direito (só existe limite na F1). */
export function windTunnelAllowance(m: ManagedTeam): number {
  if (m.categoryId !== 'f1') return 1;
  const position = m.previousPosition ?? m.boardTarget;
  return MANAGEMENT.WIND_TUNNEL_ALLOWANCE.base + (position - 1) * MANAGEMENT.WIND_TUNNEL_ALLOWANCE.perPosition;
}

function areaBoost(m: ManagedTeam, area: DevArea): number {
  if (area === 'aero') return (1 + m.facilities.windTunnel * MANAGEMENT.WIND_TUNNEL_AERO) * windTunnelAllowance(m);
  if (area === 'manufacturing') return 1 + m.facilities.factory * MANAGEMENT.FACTORY_MANUFACTURING;
  return 1;
}

/** Distribuição válida: zera as áreas fechadas pelo regulamento e faz a soma dar 1. */
export function normalizeAllocation(categoryId: ManagedTeam['categoryId'], allocation: DevValues): DevValues {
  const open = REGULATIONS[categoryId].open;
  const cleaned = zeroDev();
  let total = 0;
  for (const area of DEV_AREAS) {
    cleaned[area] = open[area] ? Math.max(0, allocation[area]) : 0;
    total += cleaned[area];
  }
  const openAreas = DEV_AREAS.filter((a) => open[a]);
  for (const area of DEV_AREAS) cleaned[area] = total > 0 ? cleaned[area] / total : open[area] ? 1 / openAreas.length : 0;
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Pessoas                                                             */
/* ------------------------------------------------------------------ */

function staffSalary(categoryId: ManagedTeam['categoryId'], rating: number, role: StaffRole): number {
  const base = TEAM_ECONOMY[categoryId].staffSalary * (role === 'principal' || role === 'technicalDirector' ? 1.4 : 1);
  return Math.round((base * Math.pow(rating / 70, 2.5)) / 100) * 100;
}

export function generateStaff(seed: number, role: StaffRole, level: number, categoryId: ManagedTeam['categoryId'], season: number): StaffMember {
  const rng = createRng(seed);
  const rating = Math.round(clamp(level + gaussian(rng) * 5, 30, 96));
  const name = `${STAFF_FIRST_NAMES[Math.floor(rng.next() * STAFF_FIRST_NAMES.length)]} ${STAFF_LAST_NAMES[Math.floor(rng.next() * STAFF_LAST_NAMES.length)]}`;
  return { id: `staff-${seed.toString(16)}`, name, role, rating, salary: staffSalary(categoryId, rating, role), contractEnd: season + 1 + Math.floor(rng.next() * 2) };
}

/**
 * Profissionais disponíveis no mercado: dois por função. O nível médio segue a
 * reputação da equipe (os melhores não vão para equipes pequenas), com um
 * candidato acima e um abaixo.
 */
export function buildStaffMarket(careerSeed: number, season: number, categoryId: ManagedTeam['categoryId'], reputation: number): StaffMember[] {
  const market: StaffMember[] = [];
  for (const role of STAFF_ROLES) {
    for (const [i, offset] of [8, -4].entries()) {
      market.push(generateStaff(hashSeed(careerSeed, season, 'staff-market', role, i), role, 38 + reputation * 0.5 + offset, categoryId, season));
    }
  }
  return market;
}

function teamSponsor(seed: number, perSeason: number, season: number, target: number, taken: ReadonlySet<string>): TeamSponsor {
  const rng = createRng(seed);
  const pool = TEAM_SPONSOR_NAMES.filter((n) => !taken.has(n));
  const name = pool[Math.floor(rng.next() * pool.length)] ?? `Patrocinador ${seed % 97}`;
  return { id: `tsp-${seed.toString(16)}`, name, perSeason: Math.round(perSeason / 100) * 100, endSeason: season + Math.floor(rng.next() * 2), targetPosition: target };
}

/**
 * Propostas de patrocínio para a equipe. O valor total que o mercado paga
 * cresce com a reputação: base × (0,45 + reputação/80). Cada proposta troca
 * dinheiro por exigência: a mais generosa cobra uma posição melhor.
 */
export function buildSponsorOffers(careerSeed: number, season: number, m: Pick<ManagedTeam, 'categoryId' | 'reputation' | 'boardTarget' | 'sponsors'>): TeamSponsor[] {
  const total = TEAM_ECONOMY[m.categoryId].sponsorBase * (0.45 + m.reputation / 80);
  const taken = new Set(m.sponsors.map((s) => s.name));
  const offers: TeamSponsor[] = [];
  for (const [i, [share, targetShift]] of ([[0.5, -1], [0.38, 1], [0.3, 3]] as const).entries()) {
    const offer = teamSponsor(hashSeed(careerSeed, season, 'team-sponsor', i), total * share, season + 1, Math.round(clamp(m.boardTarget + targetShift, 1, 10)), taken);
    taken.add(offer.name);
    offers.push(offer);
  }
  return offers;
}

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export interface ManagedTeamOptions {
  position: ManagedTeam['position'];
  salary: number;
  purchasePrice: number;
  /** Equipe fundada do zero: sem instalações e com estrutura mínima. */
  founded?: boolean;
}

/** Monta a gestão de uma equipe do campeonato atual, com a estrutura que a força dela sugere. */
export function createManagedTeam(career: CareerState, teamId: string, options: ManagedTeamOptions): ManagedTeam {
  const ranked = rankTeams(career.teams);
  const rank = ranked.findIndex((t) => t.id === teamId);
  const team = ranked[rank];
  if (!team) throw new Error('Equipe não encontrada.');
  const categoryId = career.categoryId;
  const category = getCategory(categoryId);
  const economy = TEAM_ECONOMY[categoryId];
  const season = career.season;
  const t = rank / 9;
  const reputation = options.founded ? 22 : Math.round(clamp(82 - rank * 6));
  const boardTarget = Math.min(10, rank + 2);
  const level = (seedKey: string) => clamp(Math.round(4 - rank * 0.4 + gaussian(createRng(hashSeed(career.seed, teamId, seedKey))) * 0.6), 0, 5);
  const staff = options.founded
    ? []
    : STAFF_ROLES.filter((r) => r !== 'principal').map((role) => generateStaff(hashSeed(career.seed, teamId, 'staff', role), role, 74 - rank * 3.5, categoryId, season));
  const departments = options.founded ? 1 : clamp(Math.round(4.5 - rank * 0.35), 1, 5);

  const deals: ManagedTeam['deals'] = {};
  for (const driver of career.drivers.filter((d) => d.teamId === teamId)) {
    const race = driver.role !== 'reserve';
    deals[driver.id] = {
      salary: race ? Math.round((lerp(category.economy.salary, t) * (driver.role === 'first' ? 1 : 0.6)) / 1000) * 1000 : 0,
      seatFee: race ? Math.round(lerp(category.economy.seatCost, t) / 500) * 500 : 0,
      endSeason: Math.max(season, driver.contractEnd),
    };
  }

  const base: ManagedTeam = {
    teamId,
    categoryId,
    position: options.position,
    sinceSeason: season,
    budget: Math.round(economy.operations * MANAGEMENT.STARTING_BUDGET),
    reputation,
    salary: options.salary,
    prize: Math.round(lerp(economy.prize, t)),
    purchasePrice: options.purchasePrice,
    boardTarget,
    strikes: 0,
    staff,
    staffMarket: buildStaffMarket(career.seed, season, categoryId, reputation),
    engineers: departments,
    mechanics: departments,
    facilities: options.founded ? { simulator: 0, windTunnel: 0, factory: 0 } : { simulator: level('simulator'), windTunnel: categoryId === 'f1' ? level('windTunnel') : 0, factory: level('factory') },
    baseCar: { ...team.car },
    development: { allocation: normalizeAllocation(categoryId, { aero: 1, chassis: 1, engine: 1, suspension: 1, manufacturing: 1 }), spend: 'medium', progress: zeroDev(), gains: zeroDev(), spent: 0 },
    fieldGains: {},
    sponsors: [],
    deals,
    ledger: {},
    previousPosition: null,
  };
  // Dois patrocinadores de saída: as duas propostas menos exigentes do mercado.
  const sponsors = buildSponsorOffers(career.seed, season - 1, base).slice(1).map((s) => ({ ...s, endSeason: season + (s.endSeason - season) }));
  return { ...base, sponsors };
}

/** Grava no campeonato a equipe de box que a estrutura atual produz. */
export function syncManagedTeam(career: CareerState): CareerState {
  const m = career.management;
  if (!m) return career;
  const crew = crewRating(m);
  return { ...career, teams: career.teams.map((t) => (t.id === m.teamId ? { ...t, crew } : t)) };
}

/** Valor de mercado da equipe do jogador (zero se ele é só o chefe contratado). */
export function ownedTeamValue(career: CareerState): number {
  const m = career.management;
  if (!m || m.position !== 'owner') return 0;
  const rank = rankTeams(career.teams).findIndex((t) => t.id === m.teamId);
  const facilities = (m.facilities.simulator + m.facilities.windTunnel + m.facilities.factory) * TEAM_ECONOMY[m.categoryId].facilityCost * 0.5;
  return Math.round(teamValue(m.categoryId, Math.max(0, rank)) * (0.7 + m.reputation / 200) + facilities + Math.max(0, m.budget));
}

/* ------------------------------------------------------------------ */
/* Decisões do dirigente                                               */
/* ------------------------------------------------------------------ */

function spend(m: ManagedTeam, key: string, amount: number): ManagedTeam {
  const value = Math.round(amount);
  return { ...m, budget: m.budget + value, ledger: { ...m.ledger, [key]: (m.ledger[key] ?? 0) + value } };
}

export function hireStaff(career: CareerState, staffId: string): CareerState {
  const m = requireManagement(career);
  const candidate = m.staffMarket.find((s) => s.id === staffId);
  if (!candidate) throw new Error('Profissional indisponível.');
  if (candidate.role === 'principal' && m.position !== 'owner') throw new Error('Só o dono pode contratar um chefe de equipe.');
  const current = m.staff.find((s) => s.role === candidate.role);
  // Indenização de quem sai: metade do salário de um ano.
  let next = current ? spend(m, 'staff', -current.salary * 0.5) : m;
  next = { ...next, staff: [...next.staff.filter((s) => s.role !== candidate.role), candidate], staffMarket: next.staffMarket.filter((s) => s.id !== staffId) };
  return syncManagedTeam({ ...career, management: next });
}

export function dismissStaff(career: CareerState, role: StaffRole): CareerState {
  const m = requireManagement(career);
  const current = m.staff.find((s) => s.role === role);
  if (!current) throw new Error('Função já está vaga.');
  const next = spend(m, 'staff', -current.salary * 0.5);
  return syncManagedTeam({ ...career, management: { ...next, staff: next.staff.filter((s) => s.role !== role) } });
}

export function setDepartment(career: CareerState, department: 'engineers' | 'mechanics', level: number): CareerState {
  const m = requireManagement(career);
  if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('O departamento vai do nível 1 ao 5.');
  // Contratar custa um mês de salários; demitir, a indenização equivalente.
  const cost = Math.abs(level - m[department]) * TEAM_ECONOMY[m.categoryId].staffSalary * MANAGEMENT.DEPARTMENT_SALARY * 0.1;
  return syncManagedTeam({ ...career, management: { ...spend(m, 'staff', -cost), [department]: level } });
}

export function facilityUpgradeCost(m: ManagedTeam, key: FacilityKey): number {
  return TEAM_ECONOMY[m.categoryId].facilityCost * (m.facilities[key] + 1);
}

export function upgradeFacility(career: CareerState, key: FacilityKey): CareerState {
  const m = requireManagement(career);
  if (m.facilities[key] >= 5) throw new Error('A instalação já está no nível máximo.');
  if (key === 'windTunnel' && !REGULATIONS[m.categoryId].open.aero) throw new Error('O regulamento desta categoria não permite desenvolvimento aerodinâmico: um túnel de vento não teria uso.');
  const cost = facilityUpgradeCost(m, key);
  if (cost > m.budget) throw new Error('O caixa da equipe não cobre esta obra.');
  const next = spend(m, 'facilities', -cost);
  return syncManagedTeam({ ...career, management: { ...next, facilities: { ...next.facilities, [key]: next.facilities[key] + 1 } } });
}

export function setDevelopment(career: CareerState, change: { allocation?: DevValues; spend?: ResearchSpend }): CareerState {
  const m = requireManagement(career);
  const allocation = change.allocation ? normalizeAllocation(m.categoryId, change.allocation) : m.development.allocation;
  return { ...career, management: { ...m, development: { ...m.development, allocation, spend: change.spend ?? m.development.spend } } };
}

/** Aporte (valor positivo) ou retirada (negativo) do dono. A retirada é renda tributável. */
export function ownerTransfer(career: CareerState, amount: number): CareerState {
  const m = requireManagement(career);
  if (m.position !== 'owner') throw new Error('Só o dono movimenta o caixa da equipe.');
  const value = Math.round(amount);
  const round = Math.min(career.calendar.length, career.nextRoundIndex + 1);
  if (value > 0) {
    if (value > career.finance.cash) throw new Error('Saldo pessoal insuficiente.');
    return { ...career, finance: post(career.finance, career.season, round, 'team', -value, 'Aporte na equipe'), management: spend(m, 'owner', value) };
  }
  const reserve = TEAM_ECONOMY[m.categoryId].operations * MANAGEMENT.RESERVE;
  if (m.budget + value < reserve) throw new Error(`A equipe precisa manter uma reserva de € ${Math.round(reserve).toLocaleString('pt-BR')}.`);
  return { ...career, finance: post(career.finance, career.season, round, 'dividends', -value, 'Retirada de lucros da equipe'), management: spend(m, 'owner', value) };
}

/* ------------------------------------------------------------------ */
/* Orçamento                                                           */
/* ------------------------------------------------------------------ */

export interface TeamBudgetForecast {
  income: Record<string, number>;
  expenses: Record<string, number>;
  /** Resultado previsto da temporada, sem contar danos e eventos. */
  net: number;
}

function sponsorFactor(m: ManagedTeam): number {
  return 1 + (staffRating(m, 'sportingDirector') - 60) / 300;
}

/** Receitas e despesas anuais previstas com a estrutura atual. */
export function teamBudgetForecast(career: CareerState): TeamBudgetForecast {
  const m = requireManagement(career);
  const economy = TEAM_ECONOMY[m.categoryId];
  const lineup = career.drivers.filter((d) => d.teamId === m.teamId);
  const deals = lineup.map((d) => m.deals[d.id]).filter((d): d is NonNullable<typeof d> => d !== undefined);
  const income = {
    sponsors: Math.round(m.sponsors.reduce((sum, s) => sum + s.perSeason, 0) * sponsorFactor(m)),
    seats: deals.reduce((sum, d) => sum + d.seatFee, 0),
    prize: m.prize,
  };
  const expenses = {
    drivers: deals.reduce((sum, d) => sum + d.salary, 0),
    staff: Math.round(m.staff.reduce((sum, s) => sum + s.salary, 0) + (m.engineers + m.mechanics) * economy.staffSalary * MANAGEMENT.DEPARTMENT_SALARY),
    principal: m.salary,
    operations: economy.operations,
    facilities: Math.round((m.facilities.simulator + m.facilities.windTunnel + m.facilities.factory) * economy.facilityCost * MANAGEMENT.FACILITY_UPKEEP),
    research: researchCostPerRound(m) * getCategory(m.categoryId).rounds,
  };
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { income, expenses, net: sum(income) - sum(expenses) };
}

/* ------------------------------------------------------------------ */
/* Etapa                                                               */
/* ------------------------------------------------------------------ */

function applyGain(car: CarPerformance, area: DevArea): CarPerformance {
  const effect = DEV_EFFECTS[area];
  return { engine: round1(Math.min(99, car.engine + effect.engine)), chassis: round1(Math.min(99, car.chassis + effect.chassis)), reliability: round1(Math.min(99, car.reliability + effect.reliability)) };
}

export interface TeamRoundResult {
  management: ManagedTeam;
  teams: Team[];
  messages: { id: string; category: InboxMessage['category']; title: string; body: string }[];
}

/**
 * Caixa e pesquisa da equipe em uma etapa.
 * Receitas e despesas anuais entram em parcelas iguais por etapa; os danos
 * dos dois carros são cobrados na hora. A pesquisa gera pontos, que viram
 * melhorias no carro quando a área acumula o suficiente. As rivais também
 * evoluem, um pouco a cada etapa, mais depressa as de cima.
 */
export function settleTeamRound(career: CareerState, record: RoundRecord): TeamRoundResult {
  const original = requireManagement(career);
  const economy = TEAM_ECONOMY[original.categoryId];
  const category = getCategory(original.categoryId);
  const rules = REGULATIONS[original.categoryId];
  const share = 1 / Math.max(1, career.calendar.length);
  const forecast = teamBudgetForecast(career);
  const messages: TeamRoundResult['messages'] = [];
  let m = original;

  for (const [key, value] of Object.entries(forecast.income)) m = spend(m, key, value * share);
  for (const [key, value] of Object.entries(forecast.expenses)) if (key !== 'research') m = spend(m, key, -value * share);

  let damage = 0;
  for (const entry of record.race.entries) if (entry.teamId === m.teamId) damage += Math.min(1, entry.damage);
  m = spend(m, 'damage', -damage * Math.max(category.economy.damageBill, economy.operations * 0.01));

  // Pesquisa: precisa de caixa positivo e de espaço no teto de gastos.
  let teams = career.teams;
  const cost = researchCostPerRound(m);
  const capReached = economy.budgetCap !== null && m.development.spent + cost > economy.budgetCap;
  if (m.budget <= 0) {
    messages.push({ id: 'research-paused', category: 'business', title: 'Pesquisa parada por falta de caixa', body: 'O caixa da equipe está negativo. O desenvolvimento do carro fica parado até as contas voltarem ao azul.' });
  } else if (capReached) {
    // A primeira vez que o teto barra a pesquisa: avisa e marca o gasto no teto, para não repetir o aviso.
    const cap = economy.budgetCap ?? 0;
    if (m.development.spent < cap) {
      m = { ...m, development: { ...m.development, spent: cap } };
      messages.push({ id: 'budget-cap', category: 'business', title: 'Teto de gastos atingido', body: `A equipe chegou ao teto de gastos com desenvolvimento (€ ${cap.toLocaleString('pt-BR')}). A pesquisa só volta na próxima temporada.` });
    }
  } else {
    m = spend(m, 'research', -cost);
    const rate = researchRate(m);
    const progress = { ...m.development.progress };
    const gains = { ...m.development.gains };
    let car = teams.find((t) => t.id === m.teamId)?.car;
    const delivered: DevArea[] = [];
    for (const area of DEV_AREAS) {
      if (!rules.open[area] || gains[area] >= rules.maxGainsPerArea) continue;
      progress[area] += rate * m.development.allocation[area] * areaBoost(m, area);
      while (gains[area] < rules.maxGainsPerArea && progress[area] >= researchNeeded(gains[area])) {
        progress[area] -= researchNeeded(gains[area]);
        gains[area] += 1;
        if (car) car = applyGain(car, area);
        delivered.push(area);
      }
      if (gains[area] >= rules.maxGainsPerArea) progress[area] = 0;
      progress[area] = Math.round(progress[area] * 100) / 100;
    }
    m = { ...m, development: { ...m.development, progress, gains, spent: m.development.spent + cost } };
    if (car && delivered.length > 0) {
      const updated = car;
      teams = teams.map((t) => (t.id === m.teamId ? { ...t, car: updated } : t));
      messages.push({ id: 'upgrade', category: 'business', title: 'Atualização entregue pela fábrica', body: `O departamento técnico entregou ${delivered.length} melhoria(s) nesta etapa. O carro agora tem motor ${updated.engine}, chassi ${updated.chassis} e confiabilidade ${updated.reliability}.` });
    }
  }

  // Evolução das rivais.
  const ranked = rankTeams(teams);
  const fieldGains = { ...m.fieldGains };
  teams = teams.map((t) => {
    if (t.id === m.teamId) return t;
    const rank = ranked.findIndex((x) => x.id === t.id);
    const gain = economy.fieldDevelopment * share * (1.25 - rank * 0.05);
    fieldGains[t.id] = Math.round(((fieldGains[t.id] ?? 0) + gain) * 1000) / 1000;
    return { ...t, car: { ...t.car, engine: Math.min(97, Math.round((t.car.engine + gain) * 100) / 100), chassis: Math.min(97, Math.round((t.car.chassis + gain) * 100) / 100) } };
  });
  m = { ...m, fieldGains };

  if (original.budget > 0 && m.budget <= 0) {
    messages.push({ id: 'team-debt', category: 'business', title: 'Caixa da equipe no vermelho', body: m.position === 'owner' ? 'A equipe gastou mais do que arrecadou. Faça um aporte ou corte custos: no fim da temporada, o saldo negativo sai do seu bolso.' : 'A equipe gastou mais do que arrecadou. A diretoria vai cobrar isso no fim da temporada.' });
  }
  return { management: m, teams, messages };
}

/** Posição atual da equipe administrada no campeonato de equipes. */
export function managedTeamPosition(career: CareerState): number | null {
  const m = career.management;
  if (!m) return null;
  return computeTeamStandings(career.rounds, career.teams, career.adjustments).find((s) => s.teamId === m.teamId)?.position ?? null;
}
