/**
 * Catálogo dos eventos encadeados (Fase 5): junta os arquivos de dados de cada categoria, as
 * cadeias e os perfis de patrocinador. O formato está em `src/domain/storyEvents.ts`; o motor, em
 * `src/engine/story`. `tests/storyEvents.test.ts` valida tudo o que sai daqui.
 *
 * A ordem das listas entra no sorteio (regra 4): acrescente eventos no fim de cada arquivo.
 */
import type { SponsorProfile, StoryChainSpec, StoryEventSpec } from '@/domain/storyEvents';
import { CAREER_EVENTS } from './carreira';
import { CHAINS_A } from './cadeias/a';
import { CHAINS_B } from './cadeias/b';
import { CHAINS_C } from './cadeias/c';
import { MONEY_EVENTS } from './dinheiro';
import { SPONSOR_PROFILES } from './patrocinadores';
import { HEALTH_EVENTS } from './saude';
import { TRACK_EVENTS } from './pista';
import { TRACK_TECH_EVENTS } from './pista-tecnica';
import { TOP_EVENTS } from './topo';
import { PERSONAL_EVENTS } from './vida';

export { STORY_FIRST_NAMES, STORY_LAST_NAMES } from './pessoas';
export { SPONSOR_PROFILES };

/** Eventos avulsos de todas as categorias. */
export const STORY_EVENT_CATALOG: readonly StoryEventSpec[] = [
  ...TRACK_EVENTS,
  ...TRACK_TECH_EVENTS,
  ...CAREER_EVENTS,
  ...MONEY_EVENTS,
  ...HEALTH_EVENTS,
  ...PERSONAL_EVENTS,
  ...TOP_EVENTS,
];

/** Cadeias de eventos com memória. */
export const STORY_CHAINS: readonly StoryChainSpec[] = [...CHAINS_A, ...CHAINS_B, ...CHAINS_C];

export function sponsorProfile(id: string): SponsorProfile | undefined {
  return SPONSOR_PROFILES.find((p) => p.id === id);
}
