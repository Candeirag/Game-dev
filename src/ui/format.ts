/** Formatação para exibição. Não contém regras de jogo. */
import { KART_LAYOUTS, KART_LAYOUTS_CREDIT } from '@/data/kartLayouts';

export function formatLap(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
}

export function formatRaceTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function formatGap(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds === 0) return 'Líder';
  return `+${seconds.toFixed(3)}`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatRating(value: number): string {
  return Math.floor(value).toString();
}

export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
}

/** Descrição textual das características da pista (apenas exibição). */
export function describeTyreWear(tyreWear: number): string {
  return tyreWear >= 1.15 ? 'alto' : tyreWear >= 0.95 ? 'médio' : 'baixo';
}

export function describeOvertaking(difficulty: number): string {
  return difficulty >= 0.5 ? 'difícil' : difficulty >= 0.4 ? 'média' : 'fácil';
}

export function describePower(powerSensitivity: number): string {
  return powerSensitivity >= 0.6 ? 'favorece o motor' : powerSensitivity <= 0.4 ? 'favorece o chassi' : 'equilibrada';
}

/** Valor em euros, abreviado acima de 100 mil (€ 1,25 mi) e completo abaixo disso. */
export function formatMoney(value: number, options: { compact?: boolean; sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : options.sign && value > 0 ? '+' : '';
  if (options.compact !== false && abs >= 1_000_000) return `${sign}€ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (options.compact !== false && abs >= 100_000) return `${sign}€ ${Math.round(abs / 1000).toLocaleString('pt-BR')} mil`;
  return `${sign}€ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

export function trackLocation(track: { city: string; state: string; country: string }): string {
  return `${track.city}, ${track.state || track.country}`;
}

/** Crédito da fonte do traçado, quando a licença pede que ele apareça junto do mapa (kartódromos reais). */
export function trackCredit(trackId: string): string | null {
  return trackId in KART_LAYOUTS ? KART_LAYOUTS_CREDIT : null;
}
