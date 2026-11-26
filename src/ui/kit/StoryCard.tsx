/**
 * Cartão de decisão (Fase 5): a pergunta rápida da carreira, um cartão por vez, como nos jogos de
 * cartas de escolha. Tem duas faces:
 *
 * - `StoryCard`, a pergunta: no alto, a categoria (ícone e nome), a história a que o cartão
 *   pertence (quando é de uma cadeia) e o contador "Decisão 1 de 3"; depois quem fala, o título,
 *   o texto e as escolhas, em botões grandes. A escolha que existe por causa de um traço ou de uma
 *   aptidão leva o selo com o nome dele; a de desfecho incerto leva o dado e a palavra "Incerto".
 *   O efeito de cada escolha não aparece antes: só depois de escolher.
 * - `StoryOutcome`, o desfecho: o que foi escolhido, o texto do que aconteceu, a lista "o que
 *   mudou" (`EffectList`, passada como filho) e o botão para seguir.
 *
 * Deitado (a partir de `md:`), o texto fica à esquerda e as escolhas (ou o que mudou) à direita.
 * Quem usa decide a entrada do cartão (a classe `enter`, que com menos movimento só esmaece).
 */
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronRight,
  CircleCheck,
  Dices,
  FileSignature,
  Flag,
  Flame,
  Gavel,
  Handshake,
  HeartPulse,
  House,
  type LucideIcon,
  MessageCircle,
  Mic,
  Search,
  Sparkles,
  Swords,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useId, type ReactNode, type Ref } from 'react';
import { EVENT_CATEGORY_LABELS } from '@/domain/labels';
import type { EventCategory } from '@/domain/schemas';
import { Card } from './Card';
import { Chip } from './Chip';

/** O ícone de cada categoria de evento, sempre junto do nome dela. */
export const EVENT_CATEGORY_ICONS: Readonly<Record<EventCategory, LucideIcon>> = {
  interview: Mic,
  controversy: Flame,
  rivalry: Swords,
  investigation: Search,
  protest: Gavel,
  contract: FileSignature,
  sponsor: Handshake,
  unexpected: Zap,
  family: House,
  management: Building2,
  transition: Mic,
  track: Flag,
  career: Briefcase,
  money: Wallet,
  health: HeartPulse,
  personal: Users,
};

export interface StoryChoice {
  id: string;
  label: string;
  /** Explicação curta: os cartões antigos e o aviso de quem sai na proposta de patrocínio. Os cartões da Fase 5 não têm. */
  description?: string;
  /** Traço de nascença ou aptidão que libera a escolha, já com o nome ("Esquentado", "Carisma"). */
  unlock?: { kind: 'trait' | 'aptitude'; name: string };
  /** A escolha tem mais de um desfecho possível. */
  uncertain?: boolean;
}

/** Posição do cartão na fila de decisões: "Decisão 1 de 3". */
export interface StoryCounter {
  current: number;
  total: number;
}

function Counter({ counter }: { counter?: StoryCounter }) {
  if (!counter) return null;
  return (
    <span className="ml-auto text-xs font-semibold text-ink-300">
      Decisão {counter.current} de {counter.total}
    </span>
  );
}

const TITLE = 'font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink-100 outline-none lg:text-2xl';

function ChoiceButton({ choice, onChoose, disabled }: { choice: StoryChoice; onChoose: (id: string) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChoose(choice.id)}
      disabled={disabled}
      className="chamfer-br flex min-h-12 w-full items-center gap-2 bg-ink-800 py-2 pl-4 pr-2 text-left shadow-ring transition-colors hover:bg-ink-700"
    >
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="text-sm font-semibold leading-snug text-ink-100">{choice.label}</span>
        {choice.description && <span className="text-xs leading-snug text-ink-300">{choice.description}</span>}
        {(choice.unlock || choice.uncertain) && (
          <span className="flex flex-wrap gap-2">
            {choice.unlock && (
              <Chip size="sm" icon={<Sparkles size={12} aria-hidden className="shrink-0" />} className="shadow-ring">
                <span className="sr-only">{choice.unlock.kind === 'trait' ? 'Liberada pelo traço' : 'Liberada pela aptidão'}: </span>
                {choice.unlock.name}
              </Chip>
            )}
            {choice.uncertain && (
              <Chip size="sm" icon={<Dices size={12} aria-hidden className="shrink-0" />} className="shadow-ring">
                <span className="sr-only">Desfecho </span>Incerto
              </Chip>
            )}
          </span>
        )}
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-300" />
    </button>
  );
}

export function StoryCard({
  category,
  chain,
  speaker,
  counter,
  title,
  body,
  choices,
  onChoose,
  disabled,
  headingRef,
  className,
}: {
  category: EventCategory;
  /** A história (cadeia) a que o cartão pertence. */
  chain?: { title: string };
  /** Quem fala no cartão. */
  speaker?: { name: string; role: string };
  counter?: StoryCounter;
  title: string;
  body: string;
  choices: readonly StoryChoice[];
  onChoose: (choiceId: string) => void;
  disabled?: boolean;
  /** Para a tela levar o foco ao título quando o cartão troca. */
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const titleId = useId();
  const CategoryIcon = EVENT_CATEGORY_ICONS[category];
  return (
    <Card tone="attention" labelledBy={titleId} className={className} bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon={<CategoryIcon size={12} aria-hidden className="shrink-0" />}>{EVENT_CATEGORY_LABELS[category]}</Chip>
        {chain && (
          <Chip icon={<BookOpen size={12} aria-hidden className="shrink-0" />}>
            <span className="sr-only">História: </span>
            {chain.title}
          </Chip>
        )}
        <Counter counter={counter} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          {speaker && (
            <p className="mb-2 flex items-center gap-2 text-sm text-ink-200">
              <MessageCircle size={16} aria-hidden className="shrink-0 text-ink-300" />
              <span className="min-w-0">
                <span className="font-semibold text-ink-100">{speaker.name}</span> · {speaker.role}
              </span>
            </p>
          )}
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className={TITLE}>
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-200">{body}</p>
        </div>
        <div role="group" aria-label="Escolhas" className="flex min-w-0 flex-col gap-2">
          {choices.map((choice) => (
            <ChoiceButton key={choice.id} choice={choice} onChoose={onChoose} disabled={disabled} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function StoryOutcome({
  title,
  counter,
  choiceLabel,
  text,
  children,
  note,
  action,
  headingRef,
  className,
}: {
  /** O título do cartão que foi decidido. */
  title: string;
  counter?: StoryCounter;
  choiceLabel: string;
  /** O que aconteceu. */
  text: string;
  /** O que mudou (`EffectList`). */
  children: ReactNode;
  /** Texto curto ao lado do botão ("Falta 1 decisão"). */
  note?: ReactNode;
  /** O botão para seguir ("Próxima decisão", "Continuar"). */
  action: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}) {
  const titleId = useId();
  return (
    <Card labelledBy={titleId} className={className} bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* O título já diz "Desfecho" para o leitor de tela. */}
        <span aria-hidden className="flex">
          <Chip icon={<CircleCheck size={12} aria-hidden className="shrink-0" />}>Desfecho</Chip>
        </span>
        <Counter counter={counter} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className={TITLE}>
            <span className="sr-only">Desfecho: </span>
            {title}
          </h3>
          <p className="mt-2 text-sm leading-snug">
            <span className="text-ink-300">Você escolheu: </span>
            <span className="font-semibold text-ink-100">{choiceLabel}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-200">{text}</p>
        </div>
        {children}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {note && <span className="text-xs text-ink-300">{note}</span>}
        {action}
      </div>
    </Card>
  );
}
