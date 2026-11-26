/**
 * O ano de transição (Fase 6): o primeiro ano fora do carro.
 *
 * Quem pendura o capacete pode passar o primeiro ano num de três papéis, em vez de um ano vazio
 * acompanhando o campeonato: mentoria de um jovem piloto, comentários na TV ou imagem de uma marca.
 * Cada papel paga um cachê por etapa (no ramo sem equipe de `applyExecutiveRoundEffects`), traz uma
 * mensagem por etapa e eventos próprios (categoria `transition`, cada um uma vez), e no fechamento do
 * ano dá reputação e mexe na vida em família. Depois, deixa um legado para o resto da vida do
 * personagem: o pupilo aceita a equipe do ex-mentor mais facilmente; o rosto da TV tem mais prestígio
 * no mercado de dirigentes; a marca patrocina o herdeiro que correr.
 *
 * A oferta vale uma vez por personagem (`career.transition === null`), na temporada em que ele parou de
 * correr (`career.retiredSeason`): logo depois de parar no meio do ano (`beginTransition`, o papel vale
 * pelo resto da temporada) ou no primeiro fechamento (o plano `transition` de `startExecutiveSeason`,
 * o papel vale pela temporada seguinte). Os números estão em TRANSITION (`src/config/balance.ts`) e os
 * textos em `src/data/transition.ts`. Os sorteios têm nomes próprios ('transition-brand',
 * 'transition-event', 'mentor-dev'): quem não faz o ano de transição não muda de sorte.
 */
import type {
  CareerState,
  CategoryId,
  Child,
  Effect,
  EventChoice,
  Family,
  InboxMessage,
  PendingEvent,
  RoundRecord,
  Sponsor,
  Transition,
  TransitionRole,
} from '@/domain/schemas';
import { TRANSITION_ROLES } from '@/domain/schemas';
import { STORY_EVENTS, TRANSITION } from '@/config/balance';
import { getCategory } from '@/data/categories';
import {
  TRANSITION_BRANDS,
  TRANSITION_EVENTS,
  TRANSITION_ROLE_INFO,
  TRANSITION_ROUND_TEXTS,
  TRANSITION_START_TEXTS,
  type TransitionEffectSpec,
  type TransitionEventSpec,
  type TransitionTextParams,
} from '@/data/transition';
import { categoryRef } from '@/domain/categoryNames';
import { compareText, counted } from '@/domain/text';
import type { DriverStanding } from '../championship/standings';
import { developDriver } from '../career/development';
import { post } from '../career/economy';
import { pushMessages } from '../career/inbox';
import { formerCharacterIds, fullName, money } from '../career/selectors';
import { familySupport } from '../career/sponsors';
import { livingCostBase } from '../management/executive';
import { createRng, hashSeed } from '../rng';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------------ */
/* Quando a oferta vale                                                */
/* ------------------------------------------------------------------ */

/**
 * A janela do ano de transição: 'closing' no fechamento da temporada em que o personagem parou de
 * correr (o papel vale pela temporada seguinte), 'midseason' logo depois de parar no meio do ano (vale
 * pelo resto dela); null fora disso, quando o ano de transição já foi escolhido ou passou.
 */
export function transitionWindow(career: CareerState): 'closing' | 'midseason' | null {
  if (career.mode !== 'executive' || career.transition !== null || career.retiredSeason !== career.season) return null;
  if (career.succession || career.management) return null;
  if (career.executiveOffseason) return 'closing';
  if (career.weekend || career.nextRoundIndex >= career.calendar.length) return null;
  return 'midseason';
}

/** O ano de transição em andamento nesta temporada (null: nenhum, ou já terminou). */
export function activeTransition(career: CareerState): Transition | null {
  const t = career.transition;
  return t && !t.done && t.season === career.season ? t : null;
}

/** Cachê de uma etapa no papel, pela reputação e pelo custo de vida de referência de agora. */
export function transitionFee(career: CareerState, role: TransitionRole): number {
  const extra = Math.max(0, career.reputation - TRANSITION.FEE_REPUTATION_FLOOR) * TRANSITION.FEE_PER_REPUTATION[role];
  return Math.round(livingCostBase(career) * (TRANSITION.FEE_SHARE[role] + extra));
}

interface Protege {
  id: string;
  name: string;
  isChild: boolean;
}

/**
 * Quem a mentoria acompanharia: o filho mais novo com carreira em andamento; sem filho piloto, o
 * piloto do campeonato com vaga de titular (no fechamento, com contrato para o ano seguinte), até
 * MENTOR_MAX_AGE anos na temporada do ano de transição, com o maior potencial (empate pelo id).
 */
function proposedProtege(career: CareerState, window: 'closing' | 'midseason'): Protege | null {
  const child = career.family.children.filter((c) => c.stage === 'racing' && c.driver).sort((a, b) => a.age - b.age || compareText(a.id, b.id))[0];
  if (child?.driver) return { id: child.driver.id, name: fullName(child), isChild: true };
  const nextYear = window === 'closing' ? 1 : 0;
  const former = formerCharacterIds(career);
  const pick = career.drivers
    .filter(
      (d) =>
        !d.isPlayer &&
        d.id !== career.playerDriverId &&
        !former.has(d.id) &&
        d.teamId !== null &&
        d.role !== 'reserve' &&
        (window === 'midseason' || d.contractEnd > career.season) &&
        d.age + nextYear <= TRANSITION.MENTOR_MAX_AGE,
    )
    .sort((a, b) => b.potential - a.potential || compareText(a.id, b.id))[0];
  return pick ? { id: pick.id, name: fullName(pick), isChild: false } : null;
}

/** A marca que o personagem representaria (uma por personagem). */
function brandFor(career: CareerState): string {
  const rng = createRng(hashSeed(career.seed, 'transition-brand', career.playerDriverId));
  return TRANSITION_BRANDS[Math.floor(rng.next() * TRANSITION_BRANDS.length)] ?? TRANSITION_BRANDS[0] ?? 'Marca';
}

export interface TransitionOffer {
  role: TransitionRole;
  label: string;
  description: string;
  /** O legado que o papel deixa. */
  legacy: string;
  /** Cachê estimado por etapa (pela reputação de agora). */
  feePerRound: number;
  minReputation: number;
  available: boolean;
  /** Por que o papel não está disponível (null quando está). */
  reason: string | null;
  /** Mentoria: quem seria acompanhado (id de piloto e nome) e se é um dos filhos. */
  protegeId: string | null;
  protegeName: string | null;
  protegeIsChild: boolean;
  /** Imagem de uma marca: a marca. */
  brand: string | null;
}

/**
 * As três propostas do ano de transição, com o cachê estimado, a reputação mínima, a disponibilidade
 * e o motivo, o legado e, na mentoria, o pupilo proposto. Vazia fora da janela (`transitionWindow`).
 */
export function transitionOffers(career: CareerState): TransitionOffer[] {
  const window = transitionWindow(career);
  if (!window) return [];
  const protege = proposedProtege(career, window);
  return TRANSITION_ROLES.map((role) => {
    const info = TRANSITION_ROLE_INFO[role];
    const min = TRANSITION.MIN_REPUTATION[role];
    let reason: string | null = null;
    if (career.reputation < min) reason = `Pede reputação ${min}; a sua é ${Math.floor(career.reputation)}.`;
    else if (role === 'mentor' && !protege)
      reason = `Nenhum jovem piloto para acompanhar: nenhum filho corre, e ninguém com vaga no campeonato tem até ${TRANSITION.MENTOR_MAX_AGE} anos.`;
    const mentor = role === 'mentor' && protege;
    return {
      role,
      label: info.label,
      description: info.description,
      legacy: info.legacy,
      feePerRound: transitionFee(career, role),
      minReputation: min,
      available: reason === null,
      reason,
      protegeId: mentor ? protege.id : null,
      protegeName: mentor ? protege.name : null,
      protegeIsChild: mentor ? protege.isChild : false,
      brand: role === 'ambassador' ? brandFor(career) : null,
    };
  });
}

/** A proposta do papel, se a janela é a pedida e o papel está disponível (senão, o erro diz por quê). */
export function requireTransitionOffer(career: CareerState, role: TransitionRole, window: 'closing' | 'midseason'): TransitionOffer {
  if (transitionWindow(career) !== window)
    throw new Error(
      window === 'closing'
        ? 'O ano de transição só pode ser escolhido no primeiro fechamento depois de parar de correr.'
        : 'O ano de transição só começa no meio do ano logo depois de parar de correr.',
    );
  const offer = transitionOffers(career).find((o) => o.role === role);
  if (!offer) throw new Error('Papel desconhecido.');
  if (!offer.available) throw new Error(offer.reason ?? 'Papel indisponível.');
  return offer;
}

/** O registro do ano de transição que começa na temporada dada, a partir da proposta escolhida. */
export function transitionFromOffer(offer: TransitionOffer, season: number): Transition {
  return {
    role: offer.role,
    season,
    protegeId: offer.protegeId,
    protegeName: offer.protegeName,
    brand: offer.brand,
    earnings: 0,
    seen: [],
    done: false,
  };
}

function textParams(career: CareerState, t: Transition, round: number, winner: string, fee: number, pupilResult: string | null): TransitionTextParams {
  return {
    round,
    winner,
    fee: money(career, fee),
    championship: categoryRef(career.categoryId, 'the'),
    brand: t.brand ?? '',
    pupil: t.protegeName ?? '',
    pupilResult,
  };
}

/** A mensagem do começo do ano de transição. */
export function transitionStartText(career: CareerState, t: Transition): string {
  return TRANSITION_START_TEXTS[t.role](textParams(career, t, 0, '', 0, null));
}

/**
 * Começa o ano de transição no meio da temporada, logo depois de parar de correr: o papel vale pelo
 * resto dela, e o fechamento desse ano é o do ano de transição.
 */
export function beginTransition(career: CareerState, role: TransitionRole): CareerState {
  const offer = requireTransitionOffer(career, role, 'midseason');
  const transition = transitionFromOffer(offer, career.season);
  const date = career.calendar[Math.min(career.calendar.length - 1, Math.max(0, career.nextRoundIndex - 1))]?.date ?? `${career.year}-01-01`;
  const message: InboxMessage = {
    id: `s${career.season}-transition`,
    date,
    category: 'season',
    title: `Ano de transição: ${TRANSITION_ROLE_INFO[role].label}`,
    body: `${transitionStartText(career, transition)} O papel vale até o fim desta temporada.`,
  };
  return { ...career, transition, inbox: pushMessages(career.inbox, [message]) };
}

/* ------------------------------------------------------------------ */
/* Etapa                                                               */
/* ------------------------------------------------------------------ */

/**
 * O ano de transição numa etapa: o cachê (lançamento `transition`), o treino extra de quem a mentoria
 * acompanha no campeonato (MENTOR_EXTRA_CYCLES, sorteio 'mentor-dev') e o texto da mensagem da etapa.
 * Sem ano de transição em andamento, devolve a carreira e null.
 */
export function transitionRound(career: CareerState, record: RoundRecord): { career: CareerState; body: string | null } {
  const t = activeTransition(career);
  if (!t) return { career, body: null };
  const { season } = career;
  const round = record.round;
  const fee = transitionFee(career, t.role);
  let next: CareerState = {
    ...career,
    finance: post(career.finance, season, round, 'transition', fee, `Ano de transição (${TRANSITION_ROLE_INFO[t.role].label})`),
    transition: { ...t, earnings: t.earnings + fee },
  };
  let pupilResult: string | null = null;
  if (t.role === 'mentor' && t.protegeId) {
    const pupil = next.drivers.find((d) => d.id === t.protegeId && d.teamId !== null);
    if (pupil) {
      const trained = developDriver(pupil, hashSeed(career.seed, season, round, 'mentor-dev', pupil.id), TRANSITION.MENTOR_EXTRA_CYCLES, 1).driver;
      next = { ...next, drivers: next.drivers.map((d) => (d.id === pupil.id ? trained : d)) };
      const entry = record.race.entries.find((e) => e.driverId === pupil.id);
      pupilResult = !entry ? 'não correu' : entry.status === 'finished' ? `terminou em ${entry.position}º` : 'abandonou';
    } else if (!protegeChild(career.family.children, t.protegeId)) {
      // Um piloto do campeonato que perdeu a vaga: o filho acompanhado por fora tem o texto da carreira própria.
      pupilResult = 'ficou sem vaga e não correu';
    }
  }
  const winnerId = record.race.entries[0]?.driverId;
  const winner = career.drivers.find((d) => d.id === winnerId);
  const body = TRANSITION_ROUND_TEXTS[t.role](textParams(career, t, round, winner ? fullName(winner) : '-', fee, pupilResult));
  return { career: next, body };
}

function render(text: string, t: Transition): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'pupilo') return t.protegeName ?? '';
    if (key === 'marca') return t.brand ?? '';
    throw new Error(`Marcador desconhecido nos textos do ano de transição: {${key}}`);
  });
}

const step = (list: readonly number[], size: number) => Math.sign(size) * (list[Math.min(list.length, Math.abs(size)) - 1] ?? 0);

/** Os efeitos concretos de um efeito dos dados, pelos degraus de TRANSITION.EVENT_*. */
export function transitionEffects(career: CareerState, spec: TransitionEffectSpec, label: string): Effect[] {
  switch (spec.e) {
    case 'cash':
      return [
        {
          type: 'cash',
          value: Math.round((livingCostBase(career) * step(TRANSITION.EVENT_MONEY, spec.size)) / 100) * 100,
          ledger: 'transition',
          label,
        },
      ];
    case 'reputation':
      return [{ type: 'stat', stat: 'reputation', value: step(TRANSITION.EVENT_REPUTATION, spec.size) }];
    case 'morale':
      return [{ type: 'stat', stat: 'morale', value: step(TRANSITION.EVENT_MORALE, spec.size) }];
    case 'relationship':
      return career.family.partner ? [{ type: 'relationship', value: step(TRANSITION.EVENT_BOND, spec.size) }] : [];
    case 'bond':
      return career.family.children.map((c) => ({ type: 'childStat', childId: c.id, stat: 'bond', value: step(TRANSITION.EVENT_BOND, spec.size) }));
  }
}

function needsMet(career: CareerState, spec: TransitionEventSpec): boolean {
  if (spec.needs === 'partner') return career.family.partner !== null;
  if (spec.needs === 'children') return career.family.children.length > 0;
  return true;
}

/** Os eventos do papel que ainda podem sair (não vistos e com quem eles pressupõem). */
export function transitionEventCandidates(career: CareerState, t: Transition): TransitionEventSpec[] {
  return TRANSITION_EVENTS.filter((e) => e.role === t.role && !t.seen.includes(e.id) && needsMet(career, e));
}

/** Monta o cartão pendente de um evento dos dados. */
export function transitionEventCard(career: CareerState, t: Transition, spec: TransitionEventSpec, round: number): PendingEvent {
  const title = render(spec.title, t);
  const choices: EventChoice[] = spec.choices.map((choice) => {
    const fixed: number[] = choice.outcomes.map((o) => (o.odds === 'rest' ? 0 : STORY_EVENTS.ODDS[o.odds]));
    const rest = 1 - fixed.reduce((a, b) => a + b, 0);
    return {
      id: choice.id,
      label: render(choice.label, t),
      description: render(choice.description, t),
      outcomes: choice.outcomes.map((o, i) => ({
        probability: o.odds === 'rest' ? rest : (fixed[i] ?? 0),
        text: render(o.text, t),
        effects: o.effects.flatMap((effect) => transitionEffects(career, effect, title)),
      })),
    };
  });
  return {
    id: `s${career.season}-r${round}-transition-${spec.id}`,
    definitionId: `transition-${spec.id}`,
    category: 'transition',
    season: career.season,
    round,
    title,
    body: render(spec.body, t),
    choices,
  };
}

/**
 * Depois de cada etapa do ano de transição, com chance EVENT_CHANCE (sorteio 'transition-event'), um
 * evento do papel que ainda não saiu. Ele fica marcado como visto na hora: não volta neste ano.
 */
export function addTransitionEvent(career: CareerState, record: RoundRecord): CareerState {
  const t = activeTransition(career);
  if (!t) return career;
  const rng = createRng(hashSeed(career.seed, career.season, record.round, 'transition-event'));
  if (rng.next() >= TRANSITION.EVENT_CHANCE) return career;
  const candidates = transitionEventCandidates(career, t);
  const spec = candidates[Math.floor(rng.next() * candidates.length)];
  if (!spec) return career;
  return {
    ...career,
    pendingEvents: [...career.pendingEvents, transitionEventCard(career, t, spec, record.round)],
    transition: { ...t, seen: [...t.seen, spec.id] },
  };
}

/* ------------------------------------------------------------------ */
/* Fechamento                                                          */
/* ------------------------------------------------------------------ */

/** O filho que a mentoria acompanha (pelo id de piloto que ele tem ou teve). */
function protegeChild(children: readonly Child[], protegeId: string): Child | undefined {
  return children.find((c) => c.driver?.id === protegeId || `dyn-${c.id}` === protegeId);
}

/**
 * Multiplicador da evolução do ano de um filho pela mentoria: MENTOR_CHILD_DEVELOPMENT para o filho
 * acompanhado no ano de transição (na carreira por fora; no campeonato acompanhado, o treino extra é
 * o das etapas), 1 para os outros.
 */
export function mentorChildFactor(career: CareerState, child: Pick<Child, 'id' | 'driver'>): number {
  const t = activeTransition(career);
  if (t?.role !== 'mentor' || !t.protegeId) return 1;
  return child.driver?.id === t.protegeId || `dyn-${child.id}` === t.protegeId ? TRANSITION.MENTOR_CHILD_DEVELOPMENT : 1;
}

export interface TransitionClosing {
  transition: Transition;
  /** Pontos de reputação do ano (somados à reputação do fechamento). */
  reputation: number;
  family: Family;
  note: string;
}

/**
 * Fecha o ano de transição: a reputação do papel (SEASON_REPUTATION, e a mentoria ganha
 * MENTOR_TOP_REPUTATION se o pupilo terminou até MENTOR_TOP_POSITION), a vida em viagem na relação
 * com o parceiro e no vínculo dos filhos (TRAVEL_RELATIONSHIP) e a nota do fechamento. O registro
 * fica `done`: o legado passa a valer. `family` é a família depois do fechamento do ano dela.
 */
export function closeTransitionYear(career: CareerState, family: Family, standings: readonly DriverStanding[]): TransitionClosing | null {
  const t = activeTransition(career);
  if (!t) return null;
  const info = TRANSITION_ROLE_INFO[t.role];
  let reputation = TRANSITION.SEASON_REPUTATION[t.role];
  const parts = [`Ano de transição (${info.label}): ${money(career, t.earnings)} em cachês.`];
  if (t.role === 'mentor' && t.protegeId) {
    const position =
      standings.find((s) => s.driverId === t.protegeId)?.position ??
      protegeChild(family.children, t.protegeId)?.racing?.seasons.find((s) => s.season === career.season)?.position ??
      null;
    if (position !== null) parts.push(`${t.protegeName ?? 'O pupilo'} terminou o ano em ${position}º.`);
    if (position !== null && position <= TRANSITION.MENTOR_TOP_POSITION) reputation += TRANSITION.MENTOR_TOP_REPUTATION;
  }
  if (reputation > 0) parts.push(`A reputação subiu ${counted(reputation, 'ponto', 'pontos')}.`);
  const travel = TRANSITION.TRAVEL_RELATIONSHIP[t.role];
  if (travel < 0 && (family.partner || family.children.length > 0)) parts.push('A agenda cheia de viagens pesou em casa.');
  if (travel > 0 && (family.partner || family.children.length > 0)) parts.push('O ano mais perto de casa fez bem à família.');
  parts.push(`Legado: ${info.legacy}`);
  const partner = family.partner ? { ...family.partner, relationship: Math.round(clamp(family.partner.relationship + travel)) } : null;
  const children = family.children.map((c) => ({ ...c, bond: Math.round(clamp(c.bond + travel)) }));
  return { transition: { ...t, done: true }, reputation, family: { ...family, partner, children }, note: parts.join(' ') };
}

/* ------------------------------------------------------------------ */
/* Legado                                                              */
/* ------------------------------------------------------------------ */

/** Legado da mentoria: pontos de atração da equipe do ex-mentor para quem ele acompanhou. */
export function mentorLoyalty(career: CareerState, driverId: string): number {
  const t = career.transition;
  return t?.done && t.role === 'mentor' && t.protegeId === driverId ? TRANSITION.MENTOR_LOYALTY : 0;
}

/** Legado dos comentários na TV: prestígio extra no mercado de dirigentes. */
export function transitionPrestige(career: CareerState): number {
  const t = career.transition;
  return t?.done && t.role === 'commentator' ? TRANSITION.COMMENTATOR_PRESTIGE : 0;
}

/**
 * Legado da imagem de marca: a marca patrocina o herdeiro que corre (porte 0, como o apoio da
 * família), com AMBASSADOR_HEIR_SHARE da vaga média da categoria dele por temporada, durante
 * AMBASSADOR_HEIR_SEASONS temporadas. `career` é a de quem fez o ano de transição.
 */
export function ambassadorSponsor(career: CareerState, categoryId: CategoryId, season: number): Sponsor | null {
  const t = career.transition;
  if (!t?.done || t.role !== 'ambassador' || !t.brand) return null;
  const seat = getCategory(categoryId).economy.seatCost;
  const perSeason = Math.round((((seat[0] + seat[1]) / 2) * TRANSITION.AMBASSADOR_HEIR_SHARE) / 100) * 100;
  if (perSeason <= 0) return null;
  return familySupport(perSeason, season + TRANSITION.AMBASSADOR_HEIR_SEASONS - 1, { id: 'legacy-brand', name: t.brand });
}
