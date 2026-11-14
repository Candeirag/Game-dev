/** Peças pequenas do visual novo: número do piloto, resultados recentes, medidor e clima. */
import { Cloud, CloudRain, Sun } from 'lucide-react';
import type { SessionWeather } from '@/domain/schemas';
import { WEATHER_LABELS } from '@/domain/labels';
import { cx } from '../components/ui';
import { Tag, type Tone } from './Panel';

/** Número do piloto, como na carenagem: inclinado, sobre a cor da equipe. */
export function NumberPlate({ number, color, className }: { number: number | undefined; color: string | undefined; className?: string }) {
  return (
    <span className={cx('chamfer relative inline-flex min-w-11 items-center justify-center bg-ink-800 px-2 py-1 font-display text-2xl font-bold italic leading-none text-ink-100 [--chamfer:7px]', className)}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color ?? '#7f8b9b' }} />
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
        const tone = r.position === null ? 'text-ink-500' : r.dnf ? 'bg-gold-400/15 text-gold-400' : r.position <= 3 ? 'bg-go-400/15 text-go-400' : 'bg-ink-800 text-ink-200';
        const title = r.position === null ? `Etapa ${r.round}: não disputou` : r.dnf ? `Etapa ${r.round}: abandonou` : `Etapa ${r.round}: ${r.position}º`;
        return (
          <span key={r.round} title={title} className={cx('grid h-5 min-w-6 place-items-center px-1 font-display text-sm font-semibold leading-none', tone)}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

/** Medidor de 0 a 100 em uma linha: rótulo, barra segmentada e o número. */
export function Gauge({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, value));
  const auto: Tone = v >= 65 ? 'good' : v >= 40 ? 'neutral' : 'attention';
  const fill = { good: 'bg-go-400', neutral: 'bg-ink-200', attention: 'bg-gold-400', accent: 'bg-apex-500' }[tone ?? auto];
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-ink-300">{label}</span>
      <div className="relative h-2 min-w-0 flex-1 bg-ink-800" role="img" aria-label={`${label}: ${Math.round(v)} de 100`}>
        <div className={cx('h-full', fill)} style={{ width: `${v}%` }} />
        {/* Marcas a cada quarto, como numa régua. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(25%-1px),var(--color-ink-900)_calc(25%-1px),var(--color-ink-900)_25%,transparent_25%)] bg-[length:25%_100%]" />
      </div>
      <span className="w-7 shrink-0 text-right font-display text-lg font-semibold leading-none">{Math.round(v)}</span>
    </div>
  );
}

/** Previsão do tempo: ícone, condição e temperatura da pista. */
export function WeatherTag({ weather, compact = false }: { weather: SessionWeather; compact?: boolean }) {
  const Icon = weather.condition === 'dry' ? Sun : weather.condition === 'damp' ? Cloud : CloudRain;
  return (
    <Tag tone={weather.condition === 'dry' ? 'neutral' : 'attention'} icon={<Icon size={14} strokeWidth={2} aria-hidden />}>
      {WEATHER_LABELS[weather.condition]}
      {!compact && <span className="font-normal opacity-80">{weather.trackTemp}°C</span>}
    </Tag>
  );
}
