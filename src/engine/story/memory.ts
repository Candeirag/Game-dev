/**
 * Memória das histórias (Fase 5): o que o jogo lembra do personagem atual.
 *
 * - `seen`: variantes de texto já mostradas. Não tem corte: é o que garante que nenhum texto se
 *   repete na carreira. Uma variante entra aqui quando o cartão é criado, não quando é resolvido.
 * - `flags`: marcas deixadas por escolhas ("brigou com o chefe do kart").
 * - `people`: pessoas com nome, papel, atitude e o retrato de quando o piloto as conheceu.
 * - `chains`: cadeias em andamento (o próximo passo e a partir de quando ele pode sair) e concluídas.
 *
 * Só este módulo e os efeitos (`events/effects.ts`) escrevem na memória.
 */
import type { CareerState, StoryChainState, StoryMemory, StoryPerson } from '@/domain/schemas';

export function emptyStory(driverId: string): StoryMemory {
  return { driverId, seen: [], flags: [], people: [], chains: [] };
}

/** A memória do personagem atual (vazia se ela for de outro, o que só acontece no meio da sucessão). */
export function storyOf(career: CareerState): StoryMemory {
  return career.story.driverId === career.playerDriverId ? career.story : emptyStory(career.playerDriverId);
}

export function hasSeen(story: StoryMemory, key: string): boolean {
  return story.seen.some((s) => s.key === key);
}

export function markSeen(career: CareerState, keys: readonly string[], round: number): CareerState {
  const story = storyOf(career);
  const fresh = keys.filter((key) => !hasSeen(story, key));
  if (fresh.length === 0) return career;
  return { ...career, story: { ...story, seen: [...story.seen, ...fresh.map((key) => ({ key, season: career.season, round }))] } };
}

/** Última aparição de um evento (qualquer variante) nesta temporada, ou null. */
export function lastAppearance(story: StoryMemory, eventKey: string, season: number): number | null {
  let last: number | null = null;
  const prefix = `${eventKey}#`;
  for (const s of story.seen) if (s.season === season && s.key.startsWith(prefix) && (last === null || s.round > last)) last = s.round;
  return last;
}

export const hasFlag = (story: StoryMemory, flag: string) => story.flags.some((f) => f.id === flag);
export const findPerson = (story: StoryMemory, key: string): StoryPerson | undefined => story.people.find((p) => p.key === key);
export const findChain = (story: StoryMemory, id: string): StoryChainState | undefined => story.chains.find((c) => c.id === id);
export const activeChains = (story: StoryMemory) => story.chains.filter((c) => c.status === 'active');

/** (temporada, etapa) já chegou a `notBefore`? */
export function isDue(notBefore: { season: number; round: number }, season: number, round: number): boolean {
  return season > notBefore.season || (season === notBefore.season && round >= notBefore.round);
}

const clampAttitude = (v: number) => Math.round(Math.min(100, Math.max(-100, v)));

/* ---------------- Escrita (chamada pelos efeitos) ---------------- */

type StoryUpdate = (story: StoryMemory) => StoryMemory;

export function updateStory(career: CareerState, update: StoryUpdate): CareerState {
  return { ...career, story: update(storyOf(career)) };
}

export const setFlag =
  (flag: string, set: boolean, season: number): StoryUpdate =>
  (story) => {
    const others = story.flags.filter((f) => f.id !== flag);
    return { ...story, flags: set ? [...others, { id: flag, season }] : others };
  };

/** Guarda a pessoa; se a chave já existe, só atualiza o papel (identidade e atitude ficam). */
export const upsertPerson =
  (person: StoryPerson): StoryUpdate =>
  (story) => {
    const known = findPerson(story, person.key);
    if (!known) return { ...story, people: [...story.people, person] };
    return { ...story, people: story.people.map((p) => (p.key === person.key ? { ...p, role: person.role } : p)) };
  };

const updatePerson =
  (key: string, patch: (p: StoryPerson) => StoryPerson): StoryUpdate =>
  (story) => ({
    ...story,
    people: story.people.map((p) => (p.key === key ? patch(p) : p)),
  });

export const changeAttitude = (key: string, value: number): StoryUpdate => updatePerson(key, (p) => ({ ...p, attitude: clampAttitude(p.attitude + value) }));
export const personJoinsTeam = (key: string, org: string, teamKey: string | null): StoryUpdate => updatePerson(key, (p) => ({ ...p, org, teamKey }));
export const setFollow = (key: string, follow: boolean): StoryUpdate => updatePerson(key, (p) => ({ ...p, follows: follow }));

/** Registra um passo vivido e agenda o seguinte; ao acabar, as pessoas da cadeia deixam de acompanhar. */
export const advanceChain =
  (
    chainId: string,
    step: string,
    choice: string,
    next: string | null,
    notBefore: { season: number; round: number },
    when: { season: number; round: number },
  ): StoryUpdate =>
  (story) => {
    const current: StoryChainState = findChain(story, chainId) ?? { id: chainId, status: 'active', next: null, notBefore, steps: [] };
    const updated: StoryChainState = {
      ...current,
      status: next ? 'active' : 'done',
      next,
      notBefore,
      steps: [...current.steps, { step, choice, season: when.season, round: when.round }],
    };
    const chains = findChain(story, chainId) ? story.chains.map((c) => (c.id === chainId ? updated : c)) : [...story.chains, updated];
    const people = next ? story.people : story.people.map((p) => (p.chainId === chainId ? { ...p, follows: false } : p));
    return { ...story, chains, people };
  };
