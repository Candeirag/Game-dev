import { EVENT_CATEGORY_LABELS } from '@/domain/labels';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, Pill } from './ui';
import { useCareer } from '../hooks/useCareer';

/** Decisões pendentes: cada evento exige uma escolha antes do próximo fim de semana. */
export function EventsPanel() {
  const career = useCareer();
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const dismissOutcome = useGameStore((s) => s.dismissOutcome);
  if (career.pendingEvents.length === 0 && !lastOutcome) return null;

  return (
    <div className="space-y-4">
      {lastOutcome && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm">
          <div>
            <div className="font-semibold text-sky-300">{lastOutcome.title}</div>
            <div className="text-ink-100">{lastOutcome.text}</div>
          </div>
          <button type="button" onClick={dismissOutcome} className="text-ink-300 hover:text-ink-100" aria-label="Fechar">✕</button>
        </div>
      )}
      {career.pendingEvents.map((event) => (
        <Card key={event.id} className="border-gold-400/40" title={<span className="flex items-center gap-2 text-gold-400">Decisão pendente <Pill tone="warn">{EVENT_CATEGORY_LABELS[event.category]}</Pill></span>}>
          <h3 className="font-display text-2xl font-bold uppercase leading-tight">{event.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">{event.body}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {event.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => resolveEvent(event.id, choice.id)}
                className="flex flex-col items-start gap-1 rounded-lg border border-ink-700 bg-ink-850 p-3 text-left transition-colors hover:border-gold-400/60 hover:bg-ink-800"
              >
                <span className="text-sm font-semibold text-ink-100">{choice.label}</span>
                <span className="text-xs leading-snug text-ink-400">{choice.description}</span>
                {choice.outcomes.length > 1 && <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gold-400">Desfecho incerto</span>}
              </button>
            ))}
          </div>
        </Card>
      ))}
      {career.pendingEvents.length > 0 && <p className="text-xs text-ink-400">Resolva as decisões pendentes para liberar o próximo fim de semana.</p>}
      {career.pendingEvents.length === 0 && lastOutcome && <Button variant="ghost" onClick={dismissOutcome}>Entendido</Button>}
    </div>
  );
}
