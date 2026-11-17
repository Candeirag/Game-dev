/**
 * Cartões de coisas que o jogador ainda não pode ver ou usar.
 *
 * - `SecretCard`: um segredo da ficha (um talento ou defeito oculto). Escondido, mostra só o "?";
 *   revelado, o nome, o que faz e quando apareceu. Talento e defeito nunca se distinguem só pela
 *   cor: vêm com ícone e com a palavra.
 * - `LockedCard`: uma opção bloqueada (uma origem da versão premium). Traz o cadeado, a etiqueta e
 *   o que a opção daria, sem botão de compra; não é clicável.
 */
import { CircleHelp, Lock, Sparkles, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Chip } from './Chip';
import { cx } from './cx';

export function SecretCard({
  hidden,
  kind,
  title,
  description,
  meta,
  hint,
}: {
  hidden: boolean;
  /** Só vale revelado: talento (verde, com brilho) ou defeito (âmbar, com alerta). */
  kind?: 'talent' | 'defect';
  title?: ReactNode;
  description?: ReactNode;
  /** Quando foi revelado ("Temporada 1, etapa 3"). */
  meta?: ReactNode;
  /** Escondido: a dica de como se descobre. */
  hint?: ReactNode;
}) {
  if (hidden) {
    return (
      <div className="chamfer-br flex min-h-16 items-center gap-4 bg-ink-850 px-4 py-2 shadow-frame">
        <span aria-hidden className="w-6 shrink-0 text-center font-display text-title font-bold leading-none text-ink-300">
          ?
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs font-semibold text-ink-200">
            <CircleHelp size={14} aria-hidden className="shrink-0" />
            Oculto
          </span>
          {hint && <span className="block text-2xs text-ink-400">{hint}</span>}
        </span>
      </div>
    );
  }
  const talent = kind === 'talent';
  return (
    <div
      className={cx(
        'chamfer-br flex min-h-16 flex-col gap-1 bg-ink-850 px-4 py-2',
        talent ? 'shadow-[inset_0_0_0_1px_var(--color-go-400)]' : 'shadow-[inset_0_0_0_1px_var(--color-gold-400)]',
      )}
    >
      <Chip
        size="sm"
        tone={talent ? 'good' : 'attention'}
        icon={talent ? <Sparkles size={12} aria-hidden className="shrink-0" /> : <TriangleAlert size={12} aria-hidden className="shrink-0" />}
        className="self-start"
      >
        {talent ? 'Talento' : 'Defeito'}
      </Chip>
      <span className="text-sm font-semibold text-ink-100">{title}</span>
      {description && <span className="text-xs leading-snug text-ink-300">{description}</span>}
      {meta && <span className="text-2xs text-ink-400">{meta}</span>}
    </div>
  );
}

export function LockedCard({
  title,
  summary,
  children,
  label = 'Premium',
}: {
  title: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  label?: ReactNode;
}) {
  return (
    <div aria-disabled="true" className="chamfer-br stripes flex h-full flex-col gap-2 bg-ink-900 p-4 shadow-frame">
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-200">
          <Lock size={16} aria-hidden className="shrink-0 text-ink-300" />
          {title}
        </span>
        <Chip size="sm" icon={null} className="shrink-0">
          {label}
        </Chip>
      </span>
      {summary && <span className="text-xs leading-snug text-ink-300">{summary}</span>}
      {children}
      <span className="sr-only">Bloqueado: disponível na versão premium, ainda sem compra.</span>
    </div>
  );
}
