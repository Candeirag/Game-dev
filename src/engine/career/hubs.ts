/**
 * Polos na carreira (Fase 3 da grande atualização): a mudança para o polo de um campeonato e o
 * que morar longe faz com o piloto. Os números estão em `HUB_RULES` e `SIDE_JOBS`
 * (`src/config/balance.ts`); os nomes e o mapa campeonato → polo, em `src/data/hubs.ts`.
 */
import { HUB_RULES, SIDE_JOBS } from '@/config/balance';
import type { CareerState, CategoryId, HubState } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { CATEGORY_HUB, getHub, type HubDefinition } from '@/data/hubs';

/** O piloto vai precisar se mudar para disputar este campeonato? */
export function needsMove(career: CareerState, categoryId: CategoryId): boolean {
  return CATEGORY_HUB[categoryId] !== career.hub.id;
}

/** Custo da mudança para o polo de um campeonato (zero se o piloto já mora lá). */
export function moveCost(career: CareerState, categoryId: CategoryId): number {
  return needsMove(career, categoryId) ? HUB_RULES.MOVE_COST[CATEGORY_HUB[categoryId]] : 0;
}

/** O polo depois de assinar com um campeonato: o mesmo, ou o novo com a temporada de chegada. */
export function hubAfterSigning(career: CareerState, categoryId: CategoryId, nextSeason: number): HubState {
  return needsMove(career, categoryId) ? { id: CATEGORY_HUB[categoryId], arrivedSeason: nextSeason } : career.hub;
}

/** Primeiro ano num polo de outro idioma: o piloto ainda não entende os engenheiros direito. */
export function learningLanguage(career: CareerState): boolean {
  return getHub(career.hub.id).foreign && career.hub.arrivedSeason === career.season;
}

/** O trabalho paralelo só cabe na agenda até a Fórmula Júnior. */
export function sideJobAllowed(categoryId: CategoryId): boolean {
  return getCategory(categoryId).tier <= SIDE_JOBS.MAX_TIER;
}

/**
 * Quanto o treino rende com a vida fora da pista: o trabalho paralelo tira tempo de treino, e o
 * primeiro ano com o idioma novo rende menos. Multiplica o ganho de treino do jogador.
 */
export function economyTrainingFactor(career: CareerState): number {
  const job = career.sideJob === 'none' ? 1 : SIDE_JOBS[career.sideJob].training;
  return job * (learningLanguage(career) ? HUB_RULES.LANGUAGE_TRAINING_FACTOR : 1);
}

/** O que a mudança de polo cobra em palavras, para a notícia da virada de ano e para a tela Caminhos. */
export function moveSummary(hub: HubDefinition): string {
  return `Você se muda para ${hub.name}: aluguel o ano todo, ${hub.language ? `um ano para se virar em ${hub.language} ` : ''}e a família longe.`;
}
