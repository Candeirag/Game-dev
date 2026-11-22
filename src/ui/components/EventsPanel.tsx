import { useEffect, useRef } from 'react';
import { APTITUDE_INFO, BIRTH_TRAITS } from '@/data/birth';
import type { CareerState, EventChoice, PendingEvent } from '@/domain/schemas';
import { counted } from '@/domain/text';
import { useGameStore } from '@/store/gameStore';
import { Button, EffectList, StoryCard, StoryOutcome, type StoryChoice } from '@/ui/kit';
import { useCareer } from '../hooks/useCareer';

function unlockName(unlock: NonNullable<EventChoice['unlock']>): string {
  if (unlock.kind === 'trait') return Object.values(BIRTH_TRAITS).find((trait) => trait.id === unlock.id)?.name ?? 'Traço de nascença';
  return Object.entries(APTITUDE_INFO).find(([key]) => key === unlock.id)?.[1].label ?? 'Aptidão';
}

function choicesOf(event: PendingEvent): StoryChoice[] {
  return event.choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    description: choice.description || undefined,
    unlock: choice.unlock ? { kind: choice.unlock.kind, name: unlockName(choice.unlock) } : undefined,
    uncertain: choice.outcomes.length > 1,
  }));
}

/**
 * Decisões já tomadas na mesma etapa, lidas do registro da carreira: o contador ("Decisão 2 de 3")
 * continua certo depois de trocar de tela, girar o aparelho ou recarregar o jogo.
 */
function decidedIn(career: CareerState, season: number, round: number): number {
  return career.eventLog.filter((entry) => entry.season === season && entry.round === round).length;
}

/**
 * Decisões pendentes, um cartão por vez: cada evento exige uma escolha antes do próximo fim de
 * semana. Ao tocar numa escolha o evento se resolve na hora e o cartão vira o desfecho (o que foi
 * escolhido, o que aconteceu e o que mudou); "Próxima decisão" traz o cartão seguinte e
 * "Continuar" fecha o desfecho. A troca de face entra com `enter`: com menos movimento, só esmaece.
 */
export function EventsPanel() {
  const career = useCareer();
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const dismissOutcome = useGameStore((s) => s.dismissOutcome);
  const pending = career.pendingEvents;
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);

  // Quem acabou de tocar numa escolha (ou em "Próxima decisão") perdeu o botão: o foco vai para o título da face nova.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    heading.current?.focus({ preventScroll: true });
  });

  if (lastOutcome) {
    const remaining = pending.length;
    const decided = career.eventLog.find((entry) => entry.id === lastOutcome.eventId);
    const done = decided ? decidedIn(career, decided.season, decided.round) : 0;
    return (
      <StoryOutcome
        key={`desfecho-${lastOutcome.eventId}`}
        className="enter"
        headingRef={heading}
        title={lastOutcome.title}
        counter={done > 0 ? { current: done, total: done + remaining } : undefined}
        choiceLabel={lastOutcome.choiceLabel}
        text={lastOutcome.text}
        note={remaining > 0 ? `${remaining === 1 ? 'Falta' : 'Faltam'} ${counted(remaining, 'decisão', 'decisões')}` : undefined}
        action={
          <Button
            variant="primary"
            onClick={() => {
              moveFocus.current = remaining > 0;
              dismissOutcome();
            }}
          >
            {remaining > 0 ? 'Próxima decisão' : 'Continuar'}
          </Button>
        }
      >
        <EffectList effects={lastOutcome.effects} />
      </StoryOutcome>
    );
  }

  const event = pending[0];
  if (!event) return null;
  const done = decidedIn(career, event.season, event.round);
  return (
    <StoryCard
      key={event.id}
      className="enter"
      headingRef={heading}
      category={event.category}
      chain={event.chain}
      speaker={event.speaker}
      counter={{ current: done + 1, total: done + pending.length }}
      title={event.title}
      body={event.body}
      choices={choicesOf(event)}
      onChoose={(choiceId) => {
        resolveEvent(event.id, choiceId);
        // O foco só muda se o evento se resolveu: se o motor recusar a escolha, o aviso aparece e o cartão fica.
        if (useGameStore.getState().lastOutcome?.eventId === event.id) moveFocus.current = true;
      }}
    />
  );
}
