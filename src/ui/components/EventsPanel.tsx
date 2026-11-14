import { X } from 'lucide-react';
import { EVENT_CATEGORY_LABELS } from '@/domain/labels';
import { useGameStore } from '@/store/gameStore';
import { useCareer } from '../hooks/useCareer';
import { Panel, Tag } from '../kit/Panel';

/** Decisões pendentes: cada evento exige uma escolha antes do próximo fim de semana. */
export function EventsPanel() {
  const career = useCareer();
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const dismissOutcome = useGameStore((s) => s.dismissOutcome);
  if (career.pendingEvents.length === 0 && !lastOutcome) return null;

  return (
    <div className="space-y-3">
      {lastOutcome && (
        <div role="status" className="enter chamfer bg-ink-600 p-px">
          <div className="chamfer flex items-start justify-between gap-3 bg-ink-800 py-3 pl-4 pr-2 text-sm">
            <div>
              <div className="font-display text-base font-semibold uppercase tracking-wide text-ink-100">{lastOutcome.title}</div>
              <div className="mt-0.5 text-ink-200">{lastOutcome.text}</div>
            </div>
            <button
              type="button"
              onClick={dismissOutcome}
              className="-my-1 grid h-11 w-11 shrink-0 place-items-center text-ink-300 hover:text-ink-100"
              aria-label="Fechar"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {career.pendingEvents.map((event) => (
        <Panel
          key={event.id}
          tone="attention"
          title={<span className="text-gold-400">Decisão pendente</span>}
          action={<Tag tone="attention">{EVENT_CATEGORY_LABELS[event.category]}</Tag>}
        >
          <h3 className="font-display text-2xl font-bold uppercase leading-tight">{event.title}</h3>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-300">{event.body}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {event.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => resolveEvent(event.id, choice.id)}
                className="chamfer-br flex min-h-11 flex-col items-start gap-1 border border-ink-600 bg-ink-800 p-3 text-left transition-colors hover:border-gold-400 hover:bg-ink-700"
              >
                <span className="text-sm font-semibold text-ink-100">{choice.label}</span>
                <span className="text-xs leading-snug text-ink-300">{choice.description}</span>
                {choice.outcomes.length > 1 && <span className="mt-0.5 text-[11px] font-semibold text-gold-400">Desfecho incerto</span>}
              </button>
            ))}
          </div>
        </Panel>
      ))}
      {career.pendingEvents.length > 0 && <p className="text-xs text-ink-400">Resolva as decisões pendentes para liberar o próximo fim de semana.</p>}
    </div>
  );
}
