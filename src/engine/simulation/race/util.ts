/** Pequenas contas e nomes usados por mais de um módulo do motor de corrida. */
import type { RaceContext } from './types';

export const round3 = (v: number) => Math.round(v * 1000) / 1000;
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Dado ausente na simulação: ${what}`);
  return value;
}

/** Nome curto do piloto nos textos da corrida: "A. Sobrenome". */
export function driverName(ctx: RaceContext, id: string): string {
  const d = ctx.drivers[id];
  return d ? `${d.firstName.charAt(0)}. ${d.lastName}` : id;
}

/** Rivalidade do jogador com o outro piloto de uma disputa (0 se o jogador não está nela). */
export function rivalryBetween(ctx: RaceContext, playerId: string, a: string, b: string): number {
  if (!ctx.rivalries) return 0;
  if (a === playerId) return ctx.rivalries[b] ?? 0;
  if (b === playerId) return ctx.rivalries[a] ?? 0;
  return 0;
}

/** Segundos com uma casa e vírgula, para os textos ("1,4"). */
export const seconds1 = (value: number) => value.toFixed(1).replace('.', ',');
