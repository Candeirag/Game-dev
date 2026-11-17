/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 *
 * Toda a variabilidade do jogo passa por aqui: este é o único módulo de acaso
 * do projeto, e nenhum outro arquivo sorteia nada por conta própria
 * (`tests/determinism.test.ts` falha se alguém tentar). Isso garante três
 * coisas:
 * 1. Reprodutibilidade: a mesma semente sempre gera a mesma sequência, o que
 *    torna a simulação testável e os saves consistentes.
 * 2. Variabilidade controlada: a sorte entra em pontos definidos (ruído de
 *    volta, erros, clima) e com amplitude limitada pelas regras.
 * 3. Nada de "recarregar até dar certo": a sorte de cada sessão é fixada pela
 *    semente da carreira. Recarregar o save e repetir a mesma decisão produz
 *    o mesmo resultado; só uma decisão diferente muda o desfecho.
 */
export interface Rng {
  /** Número uniforme em [0, 1). */
  next(): number;
  /** Estado interno atual; permite pausar e retomar a sequência. */
  readonly state: number;
}

/**
 * Semente de uma carreira nova. É o único ponto do jogo com acaso de verdade,
 * de propósito: cada carreira nova tem a sua própria sorte. A semente vai para
 * o save (`career.seed`) e, daí em diante, tudo deriva dela.
 */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] ?? 1;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return state;
    },
  };
}

/**
 * Deriva uma semente estável a partir de várias partes (FNV-1a de 32 bits).
 * Cada sessão tem sua própria semente, por exemplo
 * hashSeed(careerSeed, temporada, etapa, 'qualifying'), de modo que jogar uma
 * sessão não altera a sorte das outras.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 0x811c9dc5;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Número estável tirado de um texto (FNV-1a com os bits embaralhados no fim), em 32 bits. Serve
 * para a aparência: a cor de detalhe de uma equipe, o lado em que um carro aparece numa disputa,
 * onde ficam as árvores de uma pista. O mesmo texto dá sempre o mesmo número, em qualquer
 * aparelho, e nada disso entra no estado do jogo. Para sortear algo que muda a carreira, use
 * `createRng(hashSeed(career.seed, …))`.
 */
export function textHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Embaralha os bits: sem isto, textos que só diferem no último caractere dão valores vizinhos.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** O mesmo, como fração em [0, 1). */
export function textHash01(text: string): number {
  return textHash(text) / 4294967296;
}

/** Uniforme em [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

/**
 * Normal padrão (média 0, desvio 1) pelo método de Box-Muller. Saturada em
 * ±3 desvios: eventos absurdamente improváveis não fazem sentido em um jogo e
 * só gerariam resultados que parecem bug.
 */
export function gaussian(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-12);
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(-3, Math.min(3, z));
}

export function chance(rng: Rng, probability: number): boolean {
  return rng.next() < probability;
}
