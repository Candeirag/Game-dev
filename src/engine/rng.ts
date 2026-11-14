/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 *
 * Toda a variabilidade do jogo passa por aqui. Nada usa Math.random(). Isso
 * garante três coisas:
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
