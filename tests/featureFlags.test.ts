import { describe, expect, it } from 'vitest';
import { FEATURE_FLAGS, FEATURE_FLAG_NAMES, isFeatureEnabled, resolveFeatureFlags } from '@/config/featureFlags';

describe('feature flags', () => {
  it('existem as três flags da atualização: premium, anúncios e conquistas da loja', () => {
    expect([...FEATURE_FLAG_NAMES].sort()).toEqual(['ads', 'premium', 'storeAchievements']);
  });

  // Quando uma fase terminar a parte dela e ligar a flag, este teste muda junto, de propósito.
  it('tudo o que ainda não está pronto fica desligado', () => {
    expect(FEATURE_FLAGS).toEqual({ premium: false, ads: false, storeAchievements: false });
    for (const flag of FEATURE_FLAG_NAMES) expect(isFeatureEnabled(flag)).toBe(false);
  });

  it('um build de teste pode ligar flags por fora, pelo nome', () => {
    expect(resolveFeatureFlags('premium, ads')).toEqual({ premium: true, ads: true, storeAchievements: false });
    expect(resolveFeatureFlags(undefined)).toEqual(FEATURE_FLAGS);
    expect(resolveFeatureFlags('')).toEqual(FEATURE_FLAGS);
  });

  it('nomes desconhecidos são ignorados e nada é desligado por fora', () => {
    expect(resolveFeatureFlags('loja,PREMIUM,-ads')).toEqual(FEATURE_FLAGS);
  });
});
