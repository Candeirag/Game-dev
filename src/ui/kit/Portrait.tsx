/**
 * Retrato com a moldura padrão: proporção 4:5, canto chanfrado e a faixa da cor da equipe na
 * base. Sem imagem, a moldura mostra as iniciais (a reserva); as telas que já tinham a placa
 * com o número do piloto continuam usando-a quando não há retrato (ver `PortraitOr`).
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

const SIZE = { sm: 'w-10', md: 'w-16', lg: 'w-24' } as const;

export function Portrait({
  src,
  name,
  color,
  size = 'md',
  className,
}: {
  /** Endereço da imagem; sem ele, aparecem as iniciais. */
  src: string | null;
  /** Nome da pessoa (texto alternativo e iniciais). */
  name: string;
  /** Cor da equipe. */
  color?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={cx('chamfer relative inline-block aspect-[4/5] shrink-0 overflow-hidden bg-ink-800 [--chamfer:var(--chamfer-sm)]', SIZE[size], className)}>
      {src ? (
        <img src={src} alt={`Retrato de ${name}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
      ) : (
        <span
          role="img"
          aria-label={`Retrato de ${name}`}
          className="stripes absolute inset-0 grid place-items-center font-display text-xl font-bold text-ink-200"
        >
          {initials}
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: color ?? '#6f7c8e' }} />
    </span>
  );
}

/** O retrato, quando existe a imagem; senão, o que a tela já mostrava (`fallback`). */
export function PortraitOr({
  src,
  fallback,
  ...props
}: {
  src: string | null;
  fallback: ReactNode;
  name: string;
  color?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return src ? <Portrait src={src} {...props} /> : fallback;
}
