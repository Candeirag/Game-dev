import { describe, expect, it } from 'vitest';
import { createRng, gaussian, hashSeed } from '@/engine/rng';

describe('RNG determinístico', () => {
  it('a mesma semente produz a mesma sequência', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('sementes diferentes produzem sequências diferentes', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('gera valores em [0, 1) com média próxima de 0,5', () => {
    const rng = createRng(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });

  it('gaussiana tem média ~0, desvio ~1 e saturação em ±3', () => {
    const rng = createRng(99);
    const values = Array.from({ length: 20000 }, () => gaussian(rng));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(sd).toBeGreaterThan(0.95);
    expect(sd).toBeLessThan(1.05);
    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(3);
  });

  it('hashSeed é estável e sensível a cada parte', () => {
    expect(hashSeed(1, 'race', 3)).toBe(hashSeed(1, 'race', 3));
    expect(hashSeed(1, 'race', 3)).not.toBe(hashSeed(1, 'race', 4));
    expect(hashSeed(1, 'race', 3)).not.toBe(hashSeed(2, 'race', 3));
  });
});
