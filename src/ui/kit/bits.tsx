/** Peças pequenas do visual novo: número do piloto, resultados recentes, medidor e clima. */
import { Cloud, CloudRain, Sun } from 'lucide-react';
import type { SessionWeather } from '@/domain/schemas';
import { WEATHER_LABELS } from '@/domain/labels';
import { Chip } from './Chip';
import { cx } from './cx';

/** Número do piloto, como na carenagem: inclinado, sobre a cor da equipe. */
export function NumberPlate({ number, color, className }: { number: number | undefined; color: string | undefined; className?: string }) {
  return (
    <span
      className={cx(
        'chamfer relative inline-flex min-w-11 items-center justify-center bg-ink-800 px-2 py-1 font-display text-2xl font-bold italic leading-none text-ink-100 [--chamfer:7px]',
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color ?? '#6f7c8e' }} />
      <span className="sr-only">Número </span>
      {number ?? '–'}
    </span>
  );
}

export interface RecentResult {
  round: number;
  /** Posição final; null se não disputou a etapa. */
  position: number | null;
  dnf: boolean;
}

/** Resultado das últimas etapas, da mais antiga para a mais recente. Pódio em verde, abandono em âmbar. */
export function ResultChips({ results, className }: { results: readonly RecentResult[]; className?: string }) {
  return (
    <span className={cx('inline-flex gap-1', className)}>
      {results.map((r) => {
        const text = r.position === null ? '–' : r.dnf ? 'AB' : String(r.position);
        const tone =
          r.position === null
            ? 'text-ink-400'
            : r.dnf
              ? 'bg-gold-400/15 text-gold-400'
              : r.position <= 3
                ? 'bg-go-400/15 text-go-400'
                : 'bg-ink-800 text-ink-200';
        const title = r.position === null ? `Etapa ${r.round}: não disputou` : r.dnf ? `Etapa ${r.round}: abandonou` : `Etapa ${r.round}: ${r.position}º`;
        return (
          <span key={r.round} title={title} className={cx('grid h-5 min-w-6 place-items-center px-1 text-xs font-semibold leading-none', tone)}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

/** Previsão do tempo: ícone, condição e temperatura da pista. */
export function WeatherTag({ weather, compact = false }: { weather: SessionWeather; compact?: boolean }) {
  const Icon = weather.condition === 'dry' ? Sun : weather.condition === 'damp' ? Cloud : CloudRain;
  return (
    <Chip tone={weather.condition === 'dry' ? 'neutral' : 'attention'} icon={<Icon size={14} strokeWidth={2} aria-hidden />}>
      {WEATHER_LABELS[weather.condition]}
      {!compact && <span className="font-normal">{weather.trackTemp}°C</span>}
    </Chip>
  );
}

/** O mesmo, com o nome antigo. */
export const WeatherBadge = WeatherTag;

/**
 * Marca da linha do jogador em tabelas e listas. A linha também é tingida de vermelho, mas a
 * cor não pode ser o único sinal: a etiqueta "Você" vai junto do nome.
 */
export function YouMark({ label = 'Você' }: { label?: string }) {
  return (
    <Chip tone="accent" size="sm" className="shrink-0">
      {label}
    </Chip>
  );
}
