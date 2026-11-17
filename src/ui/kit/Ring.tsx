/**
 * Anel de nota ou de posição: um arco em volta de um número grande. Com `fraction`, o arco
 * mede o valor (nota de 0 a 100, posição dentro do grid); sem ela, o anel só emoldura o número.
 */
import type { ReactNode } from 'react';
import { cx, type Tone } from './cx';

const ARC: Record<Tone, string> = {
  neutral: 'stroke-ink-200',
  good: 'stroke-go-400',
  attention: 'stroke-gold-400',
  accent: 'stroke-apex-400',
};

export function Ring({
  value,
  label,
  fraction,
  tone = 'neutral',
  size = 64,
  className,
}: {
  /** O que vai no centro: "56", "7º". */
  value: ReactNode;
  /** Legenda curta embaixo do número: "Geral", "Equipes". */
  label?: ReactNode;
  /** Quanto do anel fica preenchido, de 0 a 1. */
  fraction?: number;
  tone?: Tone;
  size?: number;
  className?: string;
}) {
  const stroke = 5;
  const radius = 50 - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  // O anel é aberto embaixo (270°), como um conta-giros.
  const sweep = 0.75;
  const filled = Math.max(0, Math.min(1, fraction ?? 1)) * sweep * circumference;
  return (
    // O rótulo fica na abertura de baixo do anel, abaixo das pontas do arco (que terminam a 86% da
    // altura): assim ele nunca encosta no traço, qualquer que seja a largura ou o tamanho do texto.
    <div className={cx('flex shrink-0 flex-col items-center', className)} style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[225deg]" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="butt"
            className="stroke-ink-700"
            strokeDasharray={`${sweep * circumference} ${circumference}`}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="butt"
            className={ARC[tone]}
            strokeDasharray={`${filled} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center leading-none">
          <span className="font-display font-bold text-ink-100" style={{ fontSize: `calc(${size * 0.4}px * var(--text-scale))` }}>
            {value}
          </span>
        </div>
      </div>
      {label && (
        <span
          className="whitespace-nowrap font-medium leading-none text-ink-400"
          style={{ fontSize: `calc(${Math.max(11, size * 0.15)}px * var(--text-scale))`, marginTop: -Math.round(size * 0.12) }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
