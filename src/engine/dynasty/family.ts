/**
 * Família: parceiro, filhos e a carreira própria de cada filho.
 *
 * Os filhos não correm no campeonato do jogador (a não ser quando ele os
 * contrata para a própria equipe). A temporada de cada um é estimada com as
 * mesmas grandezas do resto do jogo: nota geral do piloto, nível do grid da
 * categoria, força da equipe, pontos de licença, reputação e os requisitos de
 * promoção de categories.ts. A evolução usa `developDriver`, a mesma função
 * dos pilotos do campeonato.
 */
import type {
  CareerState,
  CategoryId,
  Child,
  ChildRacing,
  ChildSeason,
  ChildTrait,
  Driver,
  DriverAttributes,
  Family,
  Partner,
  PendingEvent,
  SupportLevel,
} from '@/domain/schemas';
import { CHILD_TRAITS, PARTNER_BACKGROUNDS } from '@/domain/schemas';
import { HERITAGE } from '@/config/balance';
import { LIFESTYLE_RULES } from '@/data/assets';
import { LICENSE_WINDOW_SEASONS, categoryByTier, getCategory, type CategoryDefinition } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { CHILD_FIRST_NAMES, FAMILY, PARTNER_BACKGROUND_INFO, PARTNER_FIRST_NAMES, PARTNER_LAST_NAMES, getTrait } from '@/data/family';
import { F1_TEAM_NAMES, initialTeams } from '@/data/teams';
import { chooseAiTrainingFocus } from '../ai/decisions';
import { CONTRACT_RULES } from '../career/contracts';
import { applyAging, developDriver } from '../career/development';
import { licensePointsFor } from '../career/license';
import { reputationAfterSeason } from '../career/offseason';
import { fullName, getPlayer } from '../career/selectors';
import { TRAINABLE_ATTRIBUTES } from '../career/training';
import { hasPersonalProperty } from '../economy/assets';
import { childTrainingFactor, ensureHeritage, heritageTraitsFor, revealSeasonTrait } from './heritage';
import { mentorChildFactor } from './transition';
import { createRng, gaussian, hashSeed, type Rng } from '../rng';
import { overallRating } from '../simulation/performance';
import { rankTeams } from '../world/generation';
import { categoryRef } from '@/domain/categoryNames';
import { counted } from '@/domain/text';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng.next() * list.length)] as T;
const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

export function emptyFamily(): Family {
  return { partner: null, children: [], divorces: 0 };
}

/* ------------------------------------------------------------------ */
/* Parceiro                                                            */
/* ------------------------------------------------------------------ */

export function generatePartner(seed: number, playerAge: number, season: number): Partner {
  const rng = createRng(seed);
  const background = pick(rng, PARTNER_BACKGROUNDS);
  return {
    firstName: pick(rng, PARTNER_FIRST_NAMES),
    lastName: pick(rng, PARTNER_LAST_NAMES),
    age: Math.max(19, Math.round(playerAge - 2 + gaussian(rng) * 2.5)),
    background,
    talent: Math.round(clamp(PARTNER_BACKGROUND_INFO[background].talent + gaussian(rng) * 6, 45, 92)),
    relationship: 55,
    married: false,
    sinceSeason: season,
  };
}

/**
 * Variação anual da relação: padrão de vida, calendário longo, treino intenso
 * e tempo em casa (quem já parou de correr tem mais), com uma leve volta à
 * média (60) e um pouco de acaso.
 */
export function relationshipDrift(career: CareerState, seed: number): number {
  const partner = career.family.partner;
  if (!partner) return 0;
  let delta = LIFESTYLE_RULES[career.finance.lifestyle].relationship;
  if (career.mode === 'driver') {
    if (career.calendar.length > 12) delta -= FAMILY.LONG_SEASON_STRAIN;
    if (career.trainingIntensity === 'intense') delta -= FAMILY.INTENSE_TRAINING_STRAIN;
  } else {
    delta += 2;
  }
  if (partner.married) delta += 1;
  if (partner.background === 'motorsport' && career.mode === 'driver') delta += 1;
  if (hasPersonalProperty(career.finance, 'casa-campo')) delta += 3;
  delta += (60 - partner.relationship) * 0.1 + gaussian(createRng(seed)) * 3;
  return Math.round(delta * 10) / 10;
}

/** Efeito da vida a dois na moral, por etapa. */
export function partnerMoraleEffect(family: Family): number {
  const partner = family.partner;
  if (!partner) return 0;
  if (partner.relationship >= 70) return FAMILY.HAPPY_MORALE + (partner.background === 'arts' ? 0.2 : 0);
  if (partner.relationship < FAMILY.CRISIS_RELATIONSHIP) return FAMILY.CRISIS_MORALE;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Filhos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Um filho recém-nascido. O talento (teto de desenvolvimento) é herdado:
 * 55% do potencial do jogador, 20% da aptidão do parceiro e 25% de acaso
 * (média 78, desvio 9; os números estão em FAMILY), mais um desvio individual de 4 pontos e o bônus dos
 * traços de personalidade. O resultado é provável, não garantido: filhos de
 * campeões costumam ser bons, às vezes medianos e, raramente, melhores que os
 * pais.
 */
export function generateChild(career: CareerState, seed: number): Child {
  const rng = createRng(seed);
  const player = getPlayer(career);
  const partnerTalent = career.family.partner?.talent ?? 65;
  // O potencial do jogador cai com a idade; a herança usa o melhor que ele já teve.
  const parentTalent = Math.max(player.potential, ...TRAINABLE_ATTRIBUTES.map((k) => player.attributes[k]));
  const first = pick(rng, CHILD_TRAITS);
  const second = pick(rng, CHILD_TRAITS);
  const traits: ChildTrait[] = rng.next() < 0.6 && second !== first ? [first, second] : [first];
  const traitTalent = traits.reduce((sum, t) => sum + getTrait(t).talent, 0);
  const inherited =
    FAMILY.TALENT_PARENT * parentTalent +
    FAMILY.TALENT_PARTNER * partnerTalent +
    FAMILY.TALENT_CHANCE * (FAMILY.TALENT_CHANCE_MEAN + gaussian(rng) * FAMILY.TALENT_CHANCE_SD);
  const used = new Set(career.family.children.map((c) => c.firstName));
  let firstName = pick(rng, CHILD_FIRST_NAMES);
  for (let i = 0; i < 20 && used.has(firstName); i++) firstName = pick(rng, CHILD_FIRST_NAMES);
  const id = `child-g${career.dynasty.generation}-s${career.season}-${career.family.children.length}`;
  return {
    id,
    firstName,
    lastName: player.lastName,
    nationality: player.nationality,
    age: 0,
    traits,
    talent: Math.round(clamp(inherited + traitTalent + gaussian(rng) * FAMILY.TALENT_NOISE_SD, 55, 97)),
    interest: Math.round(clamp(48 + career.reputation / 6 + gaussian(rng) * 12, 10, 95)),
    bond: 70,
    stage: 'child',
    kartFunding: 'none',
    kartYears: 0,
    support: 'none',
    driver: null,
    racing: null,
    // Fase 6: talentos e defeitos de nascença, parte herdada do nascimento ativo (sorteio próprio,
    // que não mexe nos números acima).
    birthTraits: heritageTraitsFor(career, { id, birthTraits: [] }),
    kartTest: null,
  };
}

/**
 * Há espaço para mais um filho agora: com parceiro e o casal bem (relação de pelo menos
 * FAMILY.CHILD_RELATIONSHIP), dentro das idades-limite do casal (FAMILY.CHILD_MAX_PARENT_AGE e
 * PARTNER_MAX_CHILD_AGE), abaixo de FAMILY.MAX_CHILDREN, sem filho nascido nesta temporada (todos
 * com pelo menos um ano) e sem outro nascimento já à espera de resposta na fila de eventos. Vale para
 * o evento de família do começo do ano e para os cartões de vida pessoal (Fase 6), que nunca disputam
 * o mesmo bebê; numa mesma leva de cartões, sai no máximo um que faz nascer filho (`story/select.ts`).
 */
export function roomForChild(career: CareerState): boolean {
  const { partner, children } = career.family;
  if (!partner) return false;
  const youngest = children.reduce((min, c) => Math.min(min, c.age), 99);
  return (
    partner.relationship >= FAMILY.CHILD_RELATIONSHIP &&
    getPlayer(career).age <= FAMILY.CHILD_MAX_PARENT_AGE &&
    partner.age <= FAMILY.PARTNER_MAX_CHILD_AGE &&
    children.length < FAMILY.MAX_CHILDREN &&
    youngest >= 1 &&
    !career.pendingEvents.some(bringsBaby)
  );
}

/** O evento faz nascer um filho em alguma escolha (o bebê já sorteado, à espera da resposta). */
export function bringsBaby(event: Pick<PendingEvent, 'choices'>): boolean {
  return event.choices.some((c) => c.outcomes.some((o) => o.effects.some((x) => x.type === 'child')));
}

const traitProduct = (child: Child, key: 'development') => child.traits.reduce((p, t) => p * getTrait(t)[key], 1);
const traitSum = (child: Child, key: 'interest' | 'bond' | 'volatility' | 'sponsorAppeal') => child.traits.reduce((s, t) => s + getTrait(t)[key], 0);

/** Atributos iniciais de um filho que começa a carreira, a partir da formação no kart e do talento. */
function startingAttributes(child: Child, parent: Driver, rng: Rng): DriverAttributes {
  const base = FAMILY.START_BASE + child.kartYears * FAMILY.START_PER_KART_YEAR + (child.talent - 75) * FAMILY.START_TALENT_WEIGHT;
  // O estilo também passa de pai para filho: os dois melhores atributos do jogador viram pontos fortes.
  const strengths = [...TRAINABLE_ATTRIBUTES].sort((a, b) => parent.attributes[b] - parent.attributes[a]).slice(0, 2);
  const attributes = { experience: Math.round(8 + child.kartYears * 3.5) } as DriverAttributes;
  for (const key of TRAINABLE_ATTRIBUTES) {
    let value = base + gaussian(rng) * 2.5 + (strengths.includes(key) ? 3 : 0);
    if (child.traits.includes('calm') && (key === 'focus' || key === 'consistency')) value += 3;
    if (child.traits.includes('aggressive')) value += key === 'overtaking' ? 4 : key === 'consistency' ? -2 : 0;
    if (child.traits.includes('studious') && (key === 'racecraft' || key === 'tyreManagement')) value += 3;
    if (child.traits.includes('intuitive') && key === 'wetSkill') value += 6;
    attributes[key] = Math.round(clamp(value, 35, child.talent));
  }
  return attributes;
}

function teamNameAt(categoryId: CategoryId, rank: number): string {
  return rankTeams(initialTeams(categoryId))[rank]?.name ?? 'Equipe independente';
}

/** Fração da vaga que os patrocinadores do próprio filho cobrem. */
function ownCoverage(child: Child, reputation: number): number {
  return clamp(FAMILY.OWN_COVERAGE_BASE + reputation * FAMILY.OWN_COVERAGE_PER_REPUTATION + traitSum(child, 'sponsorAppeal'), 0, 0.9);
}

/** Custo líquido da vaga de um filho e quanto dele cabe à família. */
export function childSeatFunding(
  child: Child,
  category: CategoryDefinition,
  rank: number,
  reputation: number,
  academy: string | null,
  scholarship: number,
): { net: number; familyCost: number; funded: boolean } {
  const discount = Math.min(CONTRACT_RULES.MAX_TOTAL_DISCOUNT, scholarship + (academy ? FAMILY.ACADEMY_SHARE : 0));
  const net = lerp(category.economy.seatCost, rank / 9) * (1 - discount);
  const own = ownCoverage(child, reputation);
  const familyShare = FAMILY.SUPPORT_SHARE[child.support];
  return { net: Math.round(net), familyCost: Math.round(net * Math.min(familyShare, Math.max(0, 1 - own))), funded: net <= 0 || own + familyShare >= 1 };
}

/** Começa a carreira de um filho no kart regional, com o nível de apoio escolhido. */
export function startChildCareer(career: CareerState, childId: string, support: SupportLevel): CareerState {
  const child = career.family.children.find((c) => c.id === childId);
  if (!child) throw new Error('Filho não encontrado.');
  if (child.stage === 'racing' || child.age < FAMILY.CAREER_START_AGE) return career;
  const rng = createRng(hashSeed(career.seed, 'child-career', child.id));
  const parent = getPlayer(career);
  const attributes = startingAttributes(child, parent, rng);
  const category = getCategory('kart-regional');
  // Com apoio total, uma equipe do meio para cima; sem apoio, as do fundo.
  const teamRank = support === 'full' ? 3 : support === 'basic' ? 6 : 8;
  const withSupport: Child = { ...child, support };
  const funding = childSeatFunding(withSupport, category, teamRank, 5, null, 0);
  const driver: Driver = {
    id: `dyn-${child.id}`,
    firstName: child.firstName,
    lastName: child.lastName,
    nationality: child.nationality,
    age: Math.max(10, child.age),
    teamId: null,
    role: null,
    contractEnd: 0,
    condition: { ...NEUTRAL_CONDITION },
    injury: null,
    isPlayer: false,
    attributes,
    potential: child.talent,
    trainingFocus: chooseAiTrainingFocus(attributes),
  };
  const racing: ChildRacing = {
    categoryId: category.id,
    teamName: teamNameAt(category.id, teamRank),
    teamRank,
    reputation: 5,
    license: [],
    academy: null,
    seasons: [],
    stalled: 0,
    familyCost: funding.familyCost,
  };
  return updateChild(career, { ...withSupport, stage: 'racing', driver, racing });
}

export function updateChild(career: CareerState, child: Child): CareerState {
  return { ...career, family: { ...career.family, children: career.family.children.map((c) => (c.id === child.id ? child : c)) } };
}

export function setKartFunding(career: CareerState, childId: string, funding: SupportLevel): CareerState {
  const child = career.family.children.find((c) => c.id === childId);
  if (!child) throw new Error('Filho não encontrado.');
  if (child.stage !== 'child' && child.stage !== 'karting') throw new Error('A formação no kart já terminou.');
  if (child.age < FAMILY.KART_START_AGE) throw new Error(`A formação no kart começa aos ${FAMILY.KART_START_AGE} anos.`);
  return updateChild(career, { ...child, stage: 'karting', kartFunding: funding });
}

/** Muda o apoio à carreira de um filho. O custo da temporada em curso é recalculado. */
export function setChildSupport(career: CareerState, childId: string, support: SupportLevel): CareerState {
  const child = career.family.children.find((c) => c.id === childId);
  if (!child?.racing || child.stage !== 'racing') throw new Error('Este filho não tem carreira em andamento.');
  const next: Child = { ...child, support };
  const category = getCategory(child.racing.categoryId);
  const inWorld = career.drivers.some((d) => d.id === child.driver?.id);
  const familyCost = inWorld ? 0 : childSeatFunding(next, category, child.racing.teamRank, child.racing.reputation, child.racing.academy, 0).familyCost;
  return updateChild(career, { ...next, racing: { ...child.racing, familyCost } });
}

/* ------------------------------------------------------------------ */
/* Temporada de um filho fora do campeonato do jogador                 */
/* ------------------------------------------------------------------ */

/**
 * Nota competitiva: média entre a velocidade e a nota geral. Em corrida, a
 * velocidade pesa mais do que na nota geral, e é ela que os jovens treinam
 * primeiro; esta média reproduz as posições que o próprio jogador consegue no
 * campeonato simulado com atributos equivalentes.
 */
export function competitiveRating(attributes: DriverAttributes): number {
  return (attributes.pace + overallRating(attributes)) / 2;
}

/**
 * Estima a posição final. Cada piloto do grid tem uma nota de desempenho =
 * nível esperado da vaga (pelo nível da categoria e pela força da equipe) +
 * vantagem do carro. A do filho é a nota competitiva dele + a vantagem do
 * carro da equipe em que corre + o acaso da temporada. A posição é quantos
 * ficam à frente.
 */
export function estimateSeasonPosition(rating: number, category: CategoryDefinition, teamRank: number, noise: number): number {
  const carWeight = FAMILY.CAR_WEIGHT * Math.sqrt(category.carFactor);
  const car = (rank: number) => (4.5 - rank) * carWeight;
  const score = rating + car(teamRank) + noise;
  let ahead = 0;
  for (let rank = 0; rank < 10; rank++) {
    for (const offset of [1.5, -1.5]) {
      if (rank === teamRank && offset < 0) continue; // a vaga que o próprio filho ocupa
      // +1: nos pilotos gerados, a velocidade fica cerca de 2 pontos acima da média dos atributos.
      const level = category.field.driverLevel + category.field.driverSpread * (0.5 - rank / 9) + offset + 1;
      if (level + car(rank) > score) ahead++;
    }
  }
  return ahead + 1;
}

/** Foco de treino de um jovem em formação: velocidade enquanto houver margem; depois, o ponto mais fraco. */
function coachFocus(driver: Driver): Driver['trainingFocus'] {
  return driver.potential - driver.attributes.pace > 4 ? 'speed' : chooseAiTrainingFocus(driver.attributes);
}

function winsFor(position: number, rng: Rng): number {
  if (position === 1) return 3 + Math.floor(rng.next() * 4);
  if (position === 2) return 1 + Math.floor(rng.next() * 3);
  if (position === 3) return Math.floor(rng.next() * 3);
  if (position <= 6) return rng.next() < 0.3 ? 1 : 0;
  return 0;
}

/** Fecha a temporada de um filho: resultado (real ou estimado), licença, reputação e evolução. */
export function closeChildSeason(
  child: Child,
  career: CareerState,
  world: { position: number; wins: number; driver: Driver; teamName: string } | null,
): { child: Child; note: string } {
  const racing = child.racing;
  if (!racing || !child.driver || child.stage !== 'racing') return { child, note: '' };
  const category = getCategory(racing.categoryId);
  const rng = createRng(hashSeed(career.seed, career.season, 'child-season', child.id));
  let driver = child.driver;
  let position: number;
  let wins: number;
  let teamName = racing.teamName;
  if (world) {
    ({ position, wins, driver, teamName } = world);
  } else {
    const noise = gaussian(rng) * Math.max(1, FAMILY.SEASON_NOISE_SD + traitSum(child, 'volatility'));
    position = estimateSeasonPosition(competitiveRating(driver.attributes), category, racing.teamRank, noise);
    wins = winsFor(position, rng);
    // Aprender rápido ou devagar (childTrainingFactor) vale também no campeonato do jogador: ali a
    // evolução é a das etapas (familyTrainingFactors, em developAfterRound).
    // A mentoria do ano de transição (Fase 6) acelera o filho acompanhado.
    const multiplier =
      traitProduct(child, 'development') *
      HERITAGE.SUPPORT_DEVELOPMENT[child.support] *
      (racing.academy ? FAMILY.ACADEMY_DEVELOPMENT : 1) *
      childTrainingFactor(child) *
      mentorChildFactor(career, child);
    // Uma temporada equivale às etapas da categoria mais a pré-temporada, em três blocos:
    // a cada bloco, o treinador revê o foco do treino.
    const cycles = (category.rounds + 2) / 3;
    for (let block = 0; block < 3; block++) {
      driver = developDriver(
        { ...driver, trainingFocus: coachFocus(driver) },
        hashSeed(career.seed, career.season, 'child-dev', child.id, block),
        cycles,
        multiplier,
      ).driver;
    }
  }
  const points = licensePointsFor(category.id, position);
  const reputation = reputationAfterSeason(racing.reputation, position, wins, category.tier);
  const season: ChildSeason = { season: career.season, year: career.year, categoryId: category.id, teamName, position, wins, inWorld: world !== null };
  const note = `${child.firstName} terminou ${categoryRef(category.id, 'the')} em ${position}º${wins > 0 ? `, com ${counted(wins, 'vitória', 'vitórias')}` : ''}.`;
  // Fase 6: a temporada pode revelar mais um talento ou defeito de nascença.
  const revealed = revealSeasonTrait(child, career);
  return {
    child: {
      ...revealed.child,
      driver,
      racing: {
        ...racing,
        reputation,
        license: [...racing.license, { season: career.season, categoryId: category.id, position, points }],
        seasons: [...racing.seasons, season].slice(-30),
      },
    },
    note: revealed.note ? `${note} ${revealed.note}` : note,
  };
}

function meetsRequirements(child: Child, racing: ChildRacing, category: CategoryDefinition, season: number): boolean {
  const req = category.requirements;
  const points = racing.license.filter((h) => h.season > season - LICENSE_WINDOW_SEASONS).reduce((sum, h) => sum + h.points, 0);
  return (
    (child.driver?.age ?? 0) >= req.minAge &&
    points >= req.licensePoints &&
    racing.reputation >= req.minReputation &&
    Math.floor(child.driver?.attributes.experience ?? 0) >= req.minExperience
  );
}

/**
 * Define onde um filho corre na temporada seguinte: sobe se cumpre os
 * requisitos e consegue pagar a vaga; senão fica; sem dinheiro nem para ficar,
 * corre de graça na pior equipe e, depois de duas temporadas assim, desiste.
 * Chamada depois de o filho já ter feito aniversário.
 */
export function planChildSeason(child: Child, career: CareerState): { child: Child; note: string } {
  const racing = child.racing;
  const driver = child.driver;
  if (!racing || !driver || child.stage !== 'racing') return { child, note: '' };
  const rng = createRng(hashSeed(career.seed, career.season, 'child-plan', child.id));
  const current = getCategory(racing.categoryId);
  const last = racing.seasons[racing.seasons.length - 1];
  const position = last?.position ?? 12;
  const quit = (reason: string): { child: Child; note: string } => ({
    child: { ...child, stage: 'other', racing: { ...racing, familyCost: 0 } },
    note: `${child.firstName} ${reason}`,
  });

  if (current.tier === 7) {
    const rating = overallRating(driver.attributes);
    if (driver.age >= 38 || (driver.age >= 33 && rating < current.field.driverLevel - 6))
      return quit(`anunciou a aposentadoria ${categoryRef(current.id, 'de')}.`);
    const teamRank = Math.round(clamp((racing.teamRank + clamp(Math.round((position - 1) / 2), 0, 9)) / 2, 0, 9));
    return { child: { ...child, racing: { ...racing, teamRank, teamName: teamNameAt('f1', teamRank), familyCost: 0, academy: null } }, note: '' };
  }

  // Academia de uma equipe do topo: quem termina entre os três primeiros nas categorias intermediárias pode ser chamado.
  let academy = racing.academy;
  let note = '';
  if (!academy && current.tier >= 3 && current.tier <= 5 && position <= 3 && rng.next() < FAMILY.ACADEMY_CHANCE) {
    academy = `Academia ${pick(rng, F1_TEAM_NAMES)}`;
    note = `${child.firstName} foi chamado para a ${academy}. `;
  }

  const up = current.id === 'kart-national' ? [categoryByTier(4), categoryByTier(3)] : [categoryByTier(current.tier + 1)];
  const scholarship = CONTRACT_RULES.SCHOLARSHIP[position - 1] ?? 0;
  for (const target of up) {
    if (!target || position > FAMILY.PROMOTION_POSITION || !meetsRequirements(child, racing, target, career.season + 1)) continue;
    const teamRank = Math.round(clamp(3 + (position - 1) / 1.5 - (academy ? 1 : 0), 1, 9));
    const funding = childSeatFunding(child, target, teamRank, racing.reputation, academy, scholarship);
    if (!funding.funded) {
      note += `${child.firstName} tinha vaga ${categoryRef(target.id, 'em')}, mas não conseguiu pagar por ela. `;
      continue;
    }
    return {
      child: {
        ...child,
        racing: {
          ...racing,
          categoryId: target.id,
          teamRank,
          teamName: teamNameAt(target.id, teamRank),
          academy: target.tier === 7 ? null : academy,
          stalled: 0,
          familyCost: funding.familyCost,
        },
      },
      note: `${note}${child.firstName} sobe ${categoryRef(target.id, 'para')}, pela ${teamNameAt(target.id, teamRank)}.`,
    };
  }

  if (driver.age > current.field.maxAge + 1)
    return quit(`passou da idade ${categoryRef(current.id, 'de')} sem conseguir subir e encerrou a carreira de piloto.`);
  const teamRank = Math.round(clamp((racing.teamRank + clamp(Math.round((position - 1) / 2), 0, 9)) / 2, 0, 9));
  const funding = childSeatFunding(child, current, teamRank, racing.reputation, academy, 0);
  if (funding.funded) {
    return {
      child: { ...child, racing: { ...racing, teamRank, teamName: teamNameAt(current.id, teamRank), academy, stalled: 0, familyCost: funding.familyCost } },
      note: note.trim(),
    };
  }
  if (racing.stalled + 1 >= 2) return quit('ficou sem dinheiro para seguir correndo e abandonou a carreira.');
  return {
    child: { ...child, racing: { ...racing, teamRank: 9, teamName: teamNameAt(current.id, 9), academy, stalled: racing.stalled + 1, familyCost: 0 } },
    note: `${note}${child.firstName} não conseguiu pagar a vaga e vai correr de favor na ${teamNameAt(current.id, 9)}. Sem apoio, a carreira dele acaba em um ano.`,
  };
}

/* ------------------------------------------------------------------ */
/* Virada de ano da família                                            */
/* ------------------------------------------------------------------ */

export interface FamilyYearResult {
  family: Family;
  notes: string[];
}

/**
 * Fechamento do ano da família: resultado da temporada de cada filho,
 * aniversários, formação no kart, vontade de correr, relação com o jogador e
 * plano da temporada seguinte. `worldResults` traz o resultado real dos filhos
 * que correram no campeonato do jogador.
 */
export function closeFamilyYear(
  career: CareerState,
  worldResults: Readonly<Record<string, { position: number; wins: number; driver: Driver; teamName: string }>> = {},
  keepInWorld: ReadonlySet<string> = new Set(),
): FamilyYearResult {
  const notes: string[] = [];
  const kartBoost = hasPersonalProperty(career.finance, 'kartodromo') ? 1.25 : 1;
  const lifestyleBond = LIFESTYLE_RULES[career.finance.lifestyle].relationship / 2;
  // Filhos de saves antigos ganham os traços de nascença antes de a temporada poder revelar algum.
  const children = ensureHeritage(career).family.children.map((original) => {
    let child = original;
    if (child.stage === 'racing') {
      const closed = closeChildSeason(child, career, child.driver ? (worldResults[child.driver.id] ?? null) : null);
      child = closed.child;
      if (closed.note) notes.push(closed.note);
    }
    // Aniversário.
    child = { ...child, age: child.age + 1 };
    if (child.driver)
      child = { ...child, driver: applyAging({ ...child.driver, age: child.driver.age + 1 }, hashSeed(career.seed, career.season, 'child-aging', child.id)) };
    if (child.stage === 'karting') {
      child = { ...child, kartYears: Math.round((child.kartYears + FAMILY.KART_YIELD[child.kartFunding] * kartBoost) * 100) / 100 };
    }
    // Vontade de correr e relação com o jogador.
    if (child.stage !== 'other') {
      const funding = child.stage === 'karting' ? (child.kartFunding === 'full' ? 4 : child.kartFunding === 'basic' ? 2 : -3) : 0;
      child = { ...child, interest: Math.round(clamp(child.interest + traitSum(child, 'interest') + funding + (child.bond > 60 ? 1 : 0))) };
    }
    const supportBond = child.stage === 'racing' ? (child.support === 'full' ? 2 : child.support === 'none' ? -2 : 0) : 0;
    const homeBond = (career.mode === 'executive' ? 1 : career.calendar.length > 12 ? -1 : 0) + (hasPersonalProperty(career.finance, 'casa-campo') ? 3 : 0);
    child = { ...child, bond: Math.round(clamp(child.bond + traitSum(child, 'bond') + lifestyleBond + supportBond + homeBond + (65 - child.bond) * 0.08)) };
    // Um filho rebelde e distante pode largar o automobilismo.
    const inWorld = child.driver !== null && keepInWorld.has(child.driver.id);
    if (
      child.stage === 'racing' &&
      !inWorld &&
      child.traits.includes('rebel') &&
      child.bond < 25 &&
      createRng(hashSeed(career.seed, career.season, 'rebel', child.id)).next() < 0.4
    ) {
      notes.push(`${child.firstName} rompeu com a família e largou as pistas.`);
      child = { ...child, stage: 'other', racing: child.racing ? { ...child.racing, familyCost: 0 } : null };
    }
    if (child.stage === 'racing' && child.driver && !keepInWorld.has(child.driver.id)) {
      const planned = planChildSeason(child, career);
      child = planned.child;
      if (planned.note) notes.push(planned.note);
    }
    // Quem deixou as pistas não guarda mais os dados de piloto (o histórico da carreira fica em `racing`).
    if (child.stage === 'other' && child.driver) child = { ...child, driver: null };
    return child;
  });

  let partner = career.family.partner;
  if (partner) {
    const drift = relationshipDrift(career, hashSeed(career.seed, career.season, 'relationship'));
    partner = { ...partner, age: partner.age + 1, relationship: Math.round(clamp(partner.relationship + drift)) };
  }
  return { family: { ...career.family, partner, children }, notes };
}

/** Texto curto sobre a fase de um filho, para a interface e as mensagens (sem gênero: o jogo não sabe o de ninguém). */
export function childSummary(child: Child): string {
  if (child.stage === 'racing' && child.racing) return `${getCategory(child.racing.categoryId).shortName}, ${child.racing.teamName}`;
  if (child.stage === 'karting') return 'Formação no kart';
  if (child.stage === 'other') return child.racing ? 'Encerrou a carreira de piloto' : 'Seguiu outro caminho';
  return child.age < FAMILY.KART_START_AGE ? 'Ainda sem idade para o kart' : 'Fora das pistas';
}

export const childName = (child: Pick<Child, 'firstName' | 'lastName'>) => fullName(child);
