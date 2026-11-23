import { useEffect, useRef } from 'react';
import { EXIT_MS } from '../motion';
import { APTITUDE_INFO, BIRTH_TRAITS } from '@/data/birth';
import type { CareerState, EventChoice, PendingEvent } from '@/domain/schemas';
import { counted } from '@/domain/text';
import { useGameStore } from '@/store/gameStore';
import { Button, EffectList, StoryCard, StoryOutcome, type StoryChoice } from '@/ui/kit';
import { useCareer } from '../hooks/useCareer';

function unlockName(unlock: NonNullable<EventChoice['unlock']>): string {
  if (unlock.kind === 'trait') return Object.values(BIRTH_TRAITS).find((trait) => trait.id === unlock.id)?.name ?? 'Traço de nascença';
  const label = Object.entries(APTITUDE_INFO).find(([key]) => key === unlock.id)?.[1].label ?? 'Aptidão';
  // A escolha de quem tem a aptidão baixa não pode parecer elogio.
  return unlock.level === 'low' ? `Aptidão baixa: ${label}` : label;
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
 * Cartões ainda pendentes do mesmo lote: os que nasceram juntos (mesma temporada e etapa). O
 * contador conta só o lote, então nunca mistura etapas nem volta para trás quando um cartão que
 * passou da temporada anterior divide a fila com os do ano novo.
 */
function leftIn(career: CareerState, season: number, round: number): number {
  return career.pendingEvents.filter((e) => e.season === season && e.round === round).length;
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
  const focusPage = useRef(false);
  // Dois toques seguidos não podem pular o desfecho nem resolver o próximo cartão às cegas: logo
  // depois de a face trocar, os toques são ignorados pelo tempo da entrada.
  const face = lastOutcome ? `desfecho-${lastOutcome.eventId}` : `cartao-${pending[0]?.id ?? ''}`;
  const shownAt = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: o relógio recomeça a cada face nova.
  useEffect(() => {
    shownAt.current = performance.now();
  }, [face]);
  const ready = () => performance.now() - shownAt.current >= EXIT_MS;

  // Quem acabou de tocar numa escolha (ou em "Próxima decisão") perdeu o botão: o foco vai para o título da face nova.
  useEffect(() => {
    if (focusPage.current) {
      // Fechado o último desfecho, o painel some: o foco vai para o conteúdo da página, não se perde.
      focusPage.current = false;
      const main = document.querySelector('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    }
    if (!moveFocus.current) return;
    moveFocus.current = false;
    heading.current?.focus({ preventScroll: true });
  });

  if (lastOutcome) {
    const remaining = pending.length;
    const decided = career.eventLog.find((entry) => entry.id === lastOutcome.eventId);
    const done = decided ? decidedIn(career, decided.season, decided.round) : 0;
    const batch = done + (decided ? leftIn(career, decided.season, decided.round) : 0);
    return (
      <StoryOutcome
        key={`desfecho-${lastOutcome.eventId}`}
        className="enter"
        headingRef={heading}
        title={lastOutcome.title}
        counter={done > 0 && batch > 1 ? { current: done, total: batch } : undefined}
        choiceLabel={lastOutcome.choiceLabel}
        text={lastOutcome.text}
        note={remaining > 0 ? `${remaining === 1 ? 'Falta' : 'Faltam'} ${counted(remaining, 'decisão', 'decisões')}` : undefined}
        action={
          <Button
            variant="primary"
            onClick={() => {
              if (!ready()) return;
              moveFocus.current = remaining > 0;
              focusPage.current = remaining === 0;
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
  const batch = done + leftIn(career, event.season, event.round);
  return (
    <StoryCard
      key={event.id}
      className="enter"
      headingRef={heading}
      category={event.category}
      chain={event.chain}
      speaker={event.speaker}
      counter={batch > 1 ? { current: done + 1, total: batch } : undefined}
      title={event.title}
      body={event.body}
      choices={choicesOf(event)}
      onChoose={(choiceId) => {
        if (!ready()) return;
        resolveEvent(event.id, choiceId);
        // O foco só muda se o evento se resolveu: se o motor recusar a escolha, o aviso aparece e o cartão fica.
        if (useGameStore.getState().lastOutcome?.eventId === event.id) moveFocus.current = true;
      }}
    />
  );
}
