/**
 * Feature flags: o único lugar que liga e desliga o que ainda não está pronto.
 *
 * Cada fase que começa algo que o jogador ainda não deve ver (uma tela de loja,
 * um botão de compra, um anúncio) esconde isso atrás de uma flag daqui e só a
 * liga quando a parte estiver completa. Regras:
 *
 * - Tudo nasce desligado. `tests/featureFlags.test.ts` falha se alguma flag for
 *   para a `main` ligada sem o teste ser atualizado de propósito.
 * - A interface e a store perguntam a `isFeatureEnabled`; ninguém espalha
 *   `if (false)` nem constantes próprias pelo código.
 * - O motor do jogo (`src/engine`) não lê flags: regra de jogo não depende de
 *   loja, anúncio ou versão paga.
 * - Para testar uma parte escondida sem mexer neste arquivo, ligue a flag só no
 *   build: `VITE_FEATURE_FLAGS=premium,ads npm run dev` (ver `.env.example`).
 */
export const FEATURE_FLAGS = {
  /** Versão paga do jogo e tudo o que só ela libera. */
  premium: false,
  /** Anúncios (faixas, intervalos e recompensas por assistir). */
  ads: false,
  /** Conquistas das lojas (Game Center, no iPhone; Play Jogos, no Android). */
  storeAchievements: false,
} as const satisfies Readonly<Record<string, boolean>>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const FEATURE_FLAG_NAMES = Object.keys(FEATURE_FLAGS) as FeatureFlag[];

/**
 * Aplica a lista de flags ligadas por fora (nomes separados por vírgula) sobre os valores
 * deste arquivo. Nomes desconhecidos são ignorados; nada aqui desliga uma flag.
 */
export function resolveFeatureFlags(overrides: string | undefined): Readonly<Record<FeatureFlag, boolean>> {
  const on = new Set(
    (overrides ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return Object.fromEntries(FEATURE_FLAG_NAMES.map((name) => [name, FEATURE_FLAGS[name] || on.has(name)])) as Record<FeatureFlag, boolean>;
}

const ACTIVE = resolveFeatureFlags(import.meta.env.VITE_FEATURE_FLAGS);

/** A parte protegida por esta flag pode aparecer para o jogador? */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return ACTIVE[flag];
}
