/** Peças pequenas usadas pela corrida visual, pelo modo cronometragem e pelos comandos de corrida. */
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/ui/kit';

/** Tom de cada tipo de acontecimento da corrida: verde é bom, âmbar pede atenção. */
export const EVENT_TONE: Record<string, string> = {
  overtake: 'text-go-400',
  error: 'text-gold-400',
  spin: 'text-gold-400',
  dnf: 'text-gold-400 font-semibold',
  collision: 'text-gold-400 font-semibold',
  damage: 'text-gold-400',
  fuel: 'text-gold-400',
  penalty: 'text-gold-400',
  fastestLap: 'text-ink-100 font-semibold',
  pit: 'text-ink-200',
  safetyCar: 'text-gold-400 font-semibold',
  vsc: 'text-gold-400 font-semibold',
  redFlag: 'text-gold-400 font-semibold',
  restart: 'text-go-400 font-semibold',
  weather: 'text-gold-400 font-semibold',
  teamOrder: 'text-gold-400',
  start: 'text-ink-100',
  finish: 'text-ink-100',
};

/** Etiqueta curta de tabela (VMR, POLE, +5s). */
export function Mark({ children, title, tone = 'neutral' }: { children: string; title?: string; tone?: 'neutral' | 'strong' | 'attention' }) {
  return (
    <span
      title={title}
      className={cx(
        'shrink-0 px-1 text-2xs font-bold leading-4',
        tone === 'strong' ? 'bg-ink-200 text-ink-950' : tone === 'attention' ? 'bg-gold-400/20 text-gold-400' : 'bg-ink-700 text-ink-100',
      )}
    >
      {children}
    </span>
  );
}

/** Botão do cabeçalho da corrida: ícone sempre; o texto aparece quando há espaço. */
export function HeaderButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  always = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  title?: string;
  always?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 px-2 text-xs font-semibold text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      <span className={always ? 'max-sm:hidden' : 'hidden xl:inline'}>{label}</span>
    </button>
  );
}
