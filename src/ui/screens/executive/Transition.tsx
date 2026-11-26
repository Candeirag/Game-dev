/**
 * O ano de transição na tela (Fase 6): as três propostas para o primeiro ano fora do carro
 * (mentoria, comentários na TV, imagem de uma marca) e o painel do ano em andamento.
 *
 * Nada aqui decide o jogo: as propostas, o cachê, a disponibilidade e o motivo saem de
 * `transitionOffers` (`src/engine/dynasty/transition.ts`), e o começo do ano vai pela store
 * (`beginTransition` no meio do ano, o plano `transition` no fechamento).
 */
import { GraduationCap, Megaphone, Mic, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { CareerState, Transition, TransitionRole } from '@/domain/schemas';
import { TRANSITION } from '@/config/balance';
import { TRANSITION_ROLE_INFO } from '@/data/transition';
import { driverStandings, transitionFee, transitionWindow, type TransitionOffer } from '@/engine';
import { Card, Chip, ChoiceCard, Stat } from '@/ui/kit';
import { formatMoney } from '../../format';

/** Ícone de cada papel (o microfone é o mesmo dos cartões do ano de transição). */
export const TRANSITION_ROLE_ICONS: Readonly<Record<TransitionRole, LucideIcon>> = {
  mentor: GraduationCap,
  commentator: Mic,
  ambassador: Megaphone,
};

/**
 * O personagem parou de correr nesta temporada e ainda não fez o ano de transição, mas a janela do
 * meio do ano não está aberta (sobrou pouco calendário, ou uma etapa já passou sem papel): o ano de
 * transição fica para o fechamento. Só para a tela explicar; quem decide é `transitionWindow`.
 */
export function transitionWaitsForClosing(career: CareerState): boolean {
  return (
    career.mode === 'executive' &&
    career.retiredSeason === career.season &&
    career.transition === null &&
    !career.management &&
    !career.executiveOffseason &&
    !career.succession &&
    transitionWindow(career) === null
  );
}

/** Texto que explica por que o ano de transição ficou para o fechamento. */
export function transitionLaterText(): string {
  return `O ano de transição só começa no meio do ano logo depois de parar, com pelo menos ${Math.round(TRANSITION.MIDSEASON_MIN_SHARE * 100)}% do calendário pela frente. Agora ele fica para o fechamento: no fim desta temporada, a tela Carreira traz os três papéis, que valem pela temporada seguinte inteira.`;
}

/** As três propostas como escolha. Indisponível não se escolhe: o cartão mostra o motivo. */
export function TransitionOfferChoices({
  offers,
  selected,
  onSelect,
}: {
  offers: readonly TransitionOffer[];
  selected: TransitionRole | null;
  onSelect: (role: TransitionRole) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {offers.map((offer) => {
        const Icon = TRANSITION_ROLE_ICONS[offer.role];
        return (
          <ChoiceCard
            key={offer.role}
            selected={selected === offer.role}
            disabled={!offer.available}
            onSelect={() => onSelect(offer.role)}
            title={
              <span className="flex items-center gap-2">
                <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0 text-ink-300" />
                {offer.label}
              </span>
            }
            description={offer.description}
            meta={<OfferFacts offer={offer} />}
          />
        );
      })}
    </div>
  );
}

/** O que a proposta traz: cachê, reputação mínima, pupilo ou marca, legado e, se não dá, por quê. */
function OfferFacts({ offer }: { offer: TransitionOffer }) {
  return (
    <span className="mt-1 flex flex-col gap-1">
      <span>
        Cachê <b className="tabular text-ink-100">{formatMoney(offer.feePerRound)}</b> por etapa ·{' '}
        {offer.minReputation > 0 ? (
          <>
            reputação mínima <span className="tabular">{offer.minReputation}</span>
          </>
        ) : (
          'sem reputação mínima'
        )}
      </span>
      {offer.protegeName && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Pupilo: <b className="text-ink-100">{offer.protegeName}</b>
          </span>
          {offer.protegeIsChild && (
            <Chip tone="good" size="sm">
              Da família
            </Chip>
          )}
        </span>
      )}
      {offer.brand && (
        <span>
          Marca: <b className="text-ink-100">{offer.brand}</b>
        </span>
      )}
      <span>
        <b className="font-semibold text-ink-200">Legado:</b> {offer.legacy}
      </span>
      {offer.reason && (
        <span className="flex items-start gap-1 text-gold-400">
          <TriangleAlert size={13} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
          <span className="min-w-0">
            <span className="sr-only">Indisponível: </span>
            {offer.reason}
          </span>
        </span>
      )}
    </span>
  );
}

/** O ano de transição em andamento: papel, cachê recebido, pupilo ou marca e o legado que fica. */
export function TransitionPanel({ career, transition }: { career: CareerState; transition: Transition }) {
  const info = TRANSITION_ROLE_INFO[transition.role];
  const Icon = TRANSITION_ROLE_ICONS[transition.role];
  const protegePosition = transition.protegeId ? (driverStandings(career).find((s) => s.driverId === transition.protegeId)?.position ?? null) : null;
  const child = transition.protegeId
    ? career.family.children.some((c) => c.driver?.id === transition.protegeId || `dyn-${c.id}` === transition.protegeId)
    : false;
  return (
    <Card
      title="Ano de transição"
      action={
        <Chip tone="neutral" icon={<Icon size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />}>
          {info.label}
        </Chip>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Cachê recebido" value={<span className="tabular">{formatMoney(transition.earnings)}</span>} hint="Nesta temporada" accent />
        <Stat label="Por etapa" value={<span className="tabular">{formatMoney(transitionFee(career, transition.role))}</span>} hint="Pela reputação de agora" />
        {transition.protegeName ? (
          <Stat
            label={child ? 'Pupilo (da família)' : 'Pupilo'}
            value={<span className="block truncate text-lg leading-tight">{transition.protegeName}</span>}
            hint={protegePosition !== null ? `${protegePosition}º no campeonato` : child ? 'Na carreira própria' : undefined}
          />
        ) : transition.brand ? (
          <Stat label="Marca" value={<span className="block truncate text-lg leading-tight">{transition.brand}</span>} />
        ) : null}
      </div>
      <p className="mt-4 text-sm text-ink-300">
        <b className="font-semibold text-ink-100">Legado:</b> {info.legacy}
      </p>
      <p className="mt-2 text-xs text-ink-400">
        Cada etapa paga o cachê e traz notícias do papel; os convites e imprevistos do ano aparecem nas decisões do painel. No fechamento, você escolhe o
        próximo passo: um cargo, uma equipe à venda ou fundar a sua.
      </p>
    </Card>
  );
}
