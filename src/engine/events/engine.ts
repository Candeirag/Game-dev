/**
 * Resolução dos eventos pendentes.
 *
 * Desde a Fase 5, os cartões nascem dos dados (`src/data/events`), pelo motor de histórias
 * (`src/engine/story`): de 1 a 3 por etapa, encadeados e sem repetir texto. Este módulo só resolve:
 * o cartão pendente é autossuficiente (escolhas, desfechos e efeitos já traduzidos), então os
 * cartões antigos, de saves de antes da Fase 5, continuam resolvíveis.
 *
 * Ao escolher, o desfecho é sorteado pelas probabilidades da escolha, com semente derivada da
 * carreira e do evento: recarregar o save não muda o desfecho de uma mesma escolha.
 */
import type { CareerState, Effect, EventLogEntry } from '@/domain/schemas';
import { pushMessages } from '../career/inbox';
import { createRng, hashSeed } from '../rng';
import { applyEffects } from './effects';

/** Tamanho do registro de eventos guardado no save (não é regra de jogo). */
export const EVENT_RULES = {
  LOG_LIMIT: 80,
} as const;

export interface EventResolution {
  career: CareerState;
  /** Texto do desfecho sorteado. */
  outcome: string;
  /** Rótulo da escolha feita. */
  choiceLabel: string;
  /** Efeitos aplicados (para a tela mostrar o que mudou). */
  effects: readonly Effect[];
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
  return { career: next, outcome: outcome.text, choiceLabel: choice.label, effects: outcome.effects };
}
