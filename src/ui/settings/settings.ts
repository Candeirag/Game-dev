/**
 * Ajustes do jogador (tela Ajustes): tamanho do texto, modo para daltônicos, menos movimento,
 * vibração e volumes. Ficam nas anotações do aparelho (`persistence/preferences.ts`), fora dos
 * saves: valem para todas as carreiras e não mudam nada do jogo.
 *
 * Este módulo guarda os valores e os aplica na página:
 * - `--text-scale-user` e `--text-scale-system` no <html> (a escala de texto dos tokens);
 * - `data-vision="daltonico"` (troca a paleta; ver src/ui/tokens.css);
 * - `data-motion="reduce"` quando o jogador ou o sistema pedem menos movimento.
 */
import { readPreference, writePreference } from '@/persistence/preferences';

export const TEXT_SIZES = ['small', 'default', 'large', 'xlarge'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Multiplicador de cada tamanho de texto do jogo (vezes o tamanho escolhido no aparelho). */
export const TEXT_SIZE_SCALE: Readonly<Record<TextSize, number>> = { small: 0.9, default: 1, large: 1.15, xlarge: 1.3 };
export const TEXT_SIZE_LABELS: Readonly<Record<TextSize, string>> = { small: 'Pequeno', default: 'Padrão', large: 'Grande', xlarge: 'Muito grande' };

/** Limites da escala que vem do aparelho e do produto das duas: acima disso as telas deitadas não cabem. */
export const SYSTEM_SCALE_RANGE = { min: 0.85, max: 1.5 } as const;
export const MAX_TEXT_SCALE = 1.6;

export interface Settings {
  textSize: TextSize;
  colorBlind: boolean;
  /** Menos movimento, ligado no jogo. Desligado, vale o que o sistema pedir. */
  reduceMotion: boolean;
  haptics: boolean;
  /** Volumes de 0 a 100. */
  musicVolume: number;
  effectsVolume: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  textSize: 'default',
  colorBlind: false,
  reduceMotion: false,
  haptics: true,
  musicVolume: 60,
  effectsVolume: 80,
};

const KEY = 'settings';
/** Chave antiga do interruptor de vibração (de antes da tela Ajustes); continua valendo na leitura. */
const LEGACY_HAPTICS_KEY = 'haptics';

const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;

/** Lê os ajustes guardados; o que faltar ou vier estragado cai no padrão. */
export function parseSettings(raw: string | null, legacyHaptics: string | null = null): Settings {
  let saved: Partial<Record<keyof Settings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') saved = parsed as typeof saved;
  } catch {
    // Anotação ilegível: valem os padrões.
  }
  return {
    textSize: TEXT_SIZES.find((size) => size === saved.textSize) ?? DEFAULT_SETTINGS.textSize,
    colorBlind: saved.colorBlind === true,
    reduceMotion: saved.reduceMotion === true,
    haptics: typeof saved.haptics === 'boolean' ? saved.haptics : legacyHaptics !== 'off',
    musicVolume: volume(saved.musicVolume, DEFAULT_SETTINGS.musicVolume),
    effectsVolume: volume(saved.effectsVolume, DEFAULT_SETTINGS.effectsVolume),
  };
}

/** A escala final do texto: a do aparelho (dentro dos limites) vezes a do jogo, com teto. */
export function textScale(size: TextSize, systemScale: number): { system: number; user: number } {
  const user = TEXT_SIZE_SCALE[size];
  const bounded = Math.max(SYSTEM_SCALE_RANGE.min, Math.min(SYSTEM_SCALE_RANGE.max, Number.isFinite(systemScale) && systemScale > 0 ? systemScale : 1));
  return { system: Math.min(bounded, MAX_TEXT_SCALE / user), user };
}

/** A escala de texto em vigor (para o que é desenhado fora do CSS, como os rótulos da pista). */
export function currentTextScale(size: TextSize = getSettings().textSize): number {
  const scale = textScale(size, systemScale);
  return scale.system * scale.user;
}

let current: Settings | null = null;
let systemScale = 1;
let systemReducedMotion = false;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  current ??= parseSettings(readPreference(KEY), readPreference(LEGACY_HAPTICS_KEY));
  return current;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateSettings(patch: Partial<Settings>): void {
  current = parseSettings(JSON.stringify({ ...getSettings(), ...patch }));
  writePreference(KEY, JSON.stringify(current));
  applySettings();
  for (const listener of listeners) listener();
}

/** Menos movimento vale se o jogador ligou no jogo ou se o sistema pede. */
export function reducedMotion(): boolean {
  return getSettings().reduceMotion || systemReducedMotion;
}

/** O sistema pede menos movimento? (A tela Ajustes avisa que, nesse caso, o interruptor do jogo não muda nada.) */
export function systemPrefersReducedMotion(): boolean {
  return systemReducedMotion;
}

/** Põe os ajustes na página. Sem página (testes do motor), não faz nada. */
export function applySettings(): void {
  if (typeof document === 'undefined') return;
  const settings = getSettings();
  const root = document.documentElement;
  const scale = textScale(settings.textSize, systemScale);
  root.style.setProperty('--text-scale-system', String(scale.system));
  root.style.setProperty('--text-scale-user', String(scale.user));
  if (settings.colorBlind) root.dataset.vision = 'daltonico';
  else delete root.dataset.vision;
  if (reducedMotion()) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
}

/**
 * Tamanho de texto escolhido no aparelho, como multiplicador (1 = padrão).
 *
 * No iPhone, a página só enxerga o Tamanho do Texto do sistema pela fonte `-apple-system-body`:
 * um elemento com ela tem 17 px no padrão e cresce ou encolhe com o ajuste. No Android o próprio
 * WebView já multiplica todo o texto pela escala do sistema, e no navegador o `rem` segue o
 * tamanho de fonte configurado; nos dois casos a medição dá 1 e não há o que somar.
 */
export function measureSystemTextScale(): number {
  if (typeof document === 'undefined' || !document.body) return 1;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body;';
  probe.textContent = 'M';
  document.body.appendChild(probe);
  const usesSystemFont = getComputedStyle(probe).font.includes('-apple-system') || CSS.supports('font', '-apple-system-body');
  const size = Number.parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return usesSystemFont && Number.isFinite(size) && size > 0 ? size / 17 : 1;
}

/** Chamado uma vez, antes de desenhar o jogo: aplica os ajustes e passa a seguir o sistema. */
export function initSettings(): void {
  if (typeof window === 'undefined') return;
  systemScale = measureSystemTextScale();
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    systemReducedMotion = query.matches;
    query.addEventListener('change', (event) => {
      systemReducedMotion = event.matches;
      applySettings();
      for (const listener of listeners) listener();
    });
  }
  // O tamanho do texto do sistema pode mudar com o jogo aberto (o jogador vai aos Ajustes do aparelho e volta).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const measured = measureSystemTextScale();
    if (measured === systemScale) return;
    systemScale = measured;
    applySettings();
  });
  applySettings();
}

/** Só para testes: esquece o que está na memória e relê das anotações. */
export function resetSettings(): void {
  current = null;
  systemScale = 1;
  systemReducedMotion = false;
}
