/**
 * Geração e resolução de eventos.
 *
 * Depois de cada etapa: todos os eventos "garantidos" cuja condição vale
 * entram na fila (até dois), e há 45% de chance de um evento "aleatório",
 * sorteado por peso entre os elegíveis. O jogador precisa resolver os eventos
 * pendentes antes do próximo fim de semana.
 *
 * Ao escolher, o desfecho é sorteado pelas probabilidades da escolha, com
 * semente derivada da carreira e do evento: recarregar o save não muda o
 * desfecho de uma mesma escolha.
 */
import type { CareerState, EventLogEntry, PendingEvent, RoundRecord } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { pushMessages } from '../career/inbox';
import { driverStandings, getPlayer, getPlayerTeam, getTeammate } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import { EVENT_DEFINITIONS, type EventContext, type EventDefinition } from './definitions';
import { applyEffects } from './effects';

export const EVENT_RULES = {
  RANDOM_EVENT_CHANCE: 0.45,
  MAX_GUARANTEED_PER_ROUND: 2,
  LOG_LIMIT: 80,
} as const;

function timesThisSeason(career: CareerState, definitionId: string): number {
  return (
    career.eventLog.filter((e) => e.season === career.season && e.definitionId === definitionId).length +
    career.pendingEvents.filter((e) => e.season === career.season && e.definitionId === definitionId).length
  );
}

function buildContext(career: CareerState, record: RoundRecord | null, round: number, definition: EventDefinition): EventContext {
  const player = getPlayer(career);
  const standing = driverStandings(career).find((s) => s.driverId === player.id);
  return {
    career,
    player,
    team: getPlayerTeam(career),
    teammate: getTeammate(career),
    category: getCategory(career.categoryId),
    record,
    entry: record?.race.entries.find((e) => e.driverId === player.id) ?? null,
    position: standing?.position ?? 20,
    round,
    seed: hashSeed(career.seed, career.season, round, 'event', definition.id),
  };
}

function instantiate(career: CareerState, record: RoundRecord | null, round: number, definition: EventDefinition): PendingEvent | null {
  if (timesThisSeason(career, definition.id) >= definition.maxPerSeason) return null;
  const content = definition.build(buildContext(career, record, round, definition));
  if (!content) return null;
  return {
    id: `s${career.season}-r${round}-${definition.id}`,
    definitionId: definition.id,
    category: definition.category,
    season: career.season,
    round,
    ...content,
  };
}

/** Cria um evento específico, se a condição dele valer agora (usado no início da temporada). */
export function instantiateEvent(career: CareerState, definitionId: string, round: number): PendingEvent | null {
  const definition = EVENT_DEFINITIONS.find((d) => d.id === definitionId);
  return definition ? instantiate(career, null, round, definition) : null;
}

/** Eventos que surgem após uma etapa. */
export function generateEvents(career: CareerState, record: RoundRecord, round: number): PendingEvent[] {
  const events: PendingEvent[] = [];
  let state = career;
  const add = (event: PendingEvent | null) => {
    if (!event || state.pendingEvents.some((e) => e.id === event.id)) return false;
    events.push(event);
    state = { ...state, pendingEvents: [...state.pendingEvents, event] };
    return true;
  };

  let guaranteed = 0;
  for (const definition of EVENT_DEFINITIONS) {
    if (definition.kind !== 'guaranteed' || guaranteed >= EVENT_RULES.MAX_GUARANTEED_PER_ROUND) continue;
    if (add(instantiate(state, record, round, definition))) guaranteed++;
  }

  const rng = createRng(hashSeed(career.seed, career.season, round, 'random-event'));
  const happens = rng.next() < EVENT_RULES.RANDOM_EVENT_CHANCE;
  const pickRoll = rng.next();
  if (happens) {
    const candidates = EVENT_DEFINITIONS.filter((d) => d.kind === 'random')
      .map((definition) => ({ definition, event: instantiate(state, record, round, definition) }))
      .filter((c): c is { definition: EventDefinition; event: PendingEvent } => c.event !== null);
    const total = candidates.reduce((sum, c) => sum + c.definition.weight, 0);
    let roll = pickRoll * total;
    for (const c of candidates) {
      roll -= c.definition.weight;
      if (roll < 0) {
        add(c.event);
        break;
      }
    }
  }
  return events;
}

export interface EventResolution {
  career: CareerState;
  outcome: string;
}

/** Resolve um evento pendente com a escolha do jogador e aplica os efeitos. */
export function resolveEvent(career: CareerState, eventId: string, choiceId: string): EventResolution {
  const event = career.pendingEvents.find((e) => e.id === eventId);
  if (!event) throw new Error('Evento não encontrado.');
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error('Escolha inválida para este evento.');

  let roll = createRng(hashSeed(career.seed, event.id, choice.id)).next();
  let outcome = choice.outcomes[choice.outcomes.length - 1];
  for (const candidate of choice.outcomes) {
    roll -= candidate.probability;
    if (roll < 0) {
      outcome = candidate;
      break;
    }
  }
  if (!outcome) throw new Error('Evento sem desfecho.');

  const entry: EventLogEntry = {
    id: event.id,
    definitionId: event.definitionId,
    category: event.category,
    season: event.season,
    round: event.round,
    title: event.title,
    choiceLabel: choice.label,
    outcome: outcome.text,
  };
  let next: CareerState = {
    ...career,
    pendingEvents: career.pendingEvents.filter((e) => e.id !== eventId),
    eventLog: [entry, ...career.eventLog].slice(0, EVENT_RULES.LOG_LIMIT),
  };
  next = applyEffects(next, outcome.effects, event.round);
  const date = career.calendar[Math.max(0, event.round - 1)]?.date ?? `${career.year}-01-01`;
  next = {
    ...next,
    inbox: pushMessages(next.inbox, [
      { id: `${event.id}-outcome`, date, category: 'media', title: event.title, body: `Você escolheu: ${choice.label}. ${outcome.text}` },
    ]),
  };
  return { career: next, outcome: outcome.text };
}
