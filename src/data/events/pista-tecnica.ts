/**
 * Eventos de pista, lado técnico (Fase 5): peça nova, vistoria técnica, acerto, pneus, chuva,
 * motor, testes e engenheiros. Somam ao peso da categoria pista (STORY_EVENTS.CATEGORY_WEIGHTS).
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const TRACK_TECH_EVENTS: readonly StoryEventSpec[] = [];
