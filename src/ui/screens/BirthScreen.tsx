/**
 * Nascimento: o primeiro passo de uma carreira nova. O jogo sorteia a família, o corpo e a mente e
 * três talentos ou defeitos ocultos; a ficha se preenche item por item (de uma vez, com menos
 * movimento). O sorteio pode ser refeito algumas vezes; as outras origens são da versão premium e
 * aparecem com cadeado, sem compra.
 *
 * O rascunho (semente e sorteio) fica guardado no aparelho: voltar ao menu ou recarregar a página
 * não muda o nascimento nem devolve sorteios.
 */
import { ArrowLeft, Dices, Lock, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BIRTH } from '@/config/balance';
import { isFeatureEnabled } from '@/config/featureFlags';
import { BIRTH_ORIGIN_INFO, BIRTH_ORIGIN_ORDER } from '@/data/birth';
import { counted } from '@/domain/text';
import { PLAYER_DRIVER_ID, drawBirth } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { BirthAptitudes, BirthFamily, BirthTraits, hometownOf } from '../components/BirthSheet';
import { Button, Card, Chip, cx, LockedCard, useRevealSequence } from '@/ui/kit';
import { ActionBar, ScreenAction } from '../layout/ScreenAction';
import { WIDE_QUERY, useMediaQuery } from '../layout/chrome';

/** Sorteios refeitos que esta versão do jogo permite: os gratuitos e, com a versão premium, os extras. */
export function allowedBirthRerolls(): number {
  return BIRTH.FREE_REROLLS + (isFeatureEnabled('premium') ? BIRTH.PREMIUM_EXTRA_REROLLS : 0);
}

export function BirthScreen() {
  const navigate = useNavigate();
  const draft = useGameStore((s) => s.birthDraft);
  const beginBirth = useGameStore((s) => s.beginBirth);
  const rerollBirth = useGameStore((s) => s.rerollBirth);
  const wide = useMediaQuery(WIDE_QUERY);

  useEffect(() => {
    if (!draft) beginBirth();
  }, [draft, beginBirth]);

  const birth = useMemo(() => (draft ? drawBirth(draft.seed, draft.attempt, PLAYER_DRIVER_ID) : null), [draft]);
  // A ficha se preenche de novo a cada sorteio.
  const sequence = useRevealSequence(draft ? `${draft.seed}-${draft.attempt}` : 'nenhum');
  if (!draft || !birth) return null;

  const allowed = allowedBirthRerolls();
  const remaining = Math.max(0, allowed - draft.attempt);
  const premiumMore = !isFeatureEnabled('premium');
  const town = hometownOf(birth);
  const safeX = 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]';

  const reroll = (
    <Button
      variant="secondary"
      onClick={() => rerollBirth(allowed)}
      disabled={remaining === 0}
      aria-label={`Sortear de novo: ${counted(remaining, 'sorteio restante', 'sorteios restantes')}`}
    >
      <Dices size={18} aria-hidden />
      {remaining > 0 ? `Sortear de novo (${remaining})` : 'Sem sorteios'}
    </Button>
  );
  const proceed = <ScreenAction onClick={() => navigate('/new/piloto')}>Continuar</ScreenAction>;
  const rerollInfo =
    remaining > 0
      ? `${counted(remaining, 'sorteio restante', 'sorteios restantes')}. Depois de começar, o nascimento não muda.`
      : premiumMore
        ? 'Os sorteios gratuitos acabaram. Mais sorteios na versão premium.'
        : 'Os sorteios acabaram.';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900 pt-[env(safe-area-inset-top)]">
        <div className={cx('mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 py-2', safeX)}>
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center text-ink-300 transition-colors hover:text-ink-100"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div className="min-w-40 flex-1">
            <div className="flex items-baseline gap-x-4">
              <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Nascimento</h1>
              <span className="truncate text-xs font-medium text-ink-400">Nova carreira · 1 de 2</span>
            </div>
            <div className="mt-1 truncate text-xs text-ink-300">
              Família humilde · Brasil · {town?.name ?? ''}
              {draft.attempt > 0 && <span className="text-ink-400"> · {draft.attempt + 1}º sorteio</span>}
            </div>
          </div>
          {!wide && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {reroll}
              {proceed}
            </div>
          )}
        </div>
      </header>

      <div
        className={cx(
          'mx-auto grid max-w-6xl items-start gap-4 pt-4',
          safeX,
          wide ? 'grid-cols-2 pb-[calc(1.5rem+3.5rem+env(safe-area-inset-bottom))]' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="space-y-4">
          <BirthFamily birth={birth} sequence={sequence} from={0} />
          <BirthTraits birth={birth} sequence={sequence} from={10} />
        </div>
        <BirthAptitudes birth={birth} sequence={sequence} from={5} />

        <Card
          title="Outras origens"
          action={
            <Chip size="sm" icon={<Lock size={12} aria-hidden className="shrink-0" />}>
              Versão premium
            </Chip>
          }
          className={cx(wide && 'col-span-2')}
          bodyClassName="p-4"
        >
          <p className="mb-2 text-xs text-ink-400">
            No jogo grátis, todo piloto nasce numa família humilde no Brasil. A versão premium vai deixar escolher a origem e o país; por enquanto, ainda não há
            compra.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {BIRTH_ORIGIN_ORDER.filter((id) => BIRTH_ORIGIN_INFO[id].premium).map((id) => {
              const origin = BIRTH_ORIGIN_INFO[id];
              return (
                <LockedCard key={id} title={origin.name} summary={origin.summary}>
                  <ul className="grid gap-1 text-xs">
                    {origin.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-1 text-ink-200">
                        <Plus size={12} aria-hidden className="mt-1 shrink-0" />
                        <span className="sr-only">Vantagem:</span>
                        {perk}
                      </li>
                    ))}
                    {origin.drawbacks.map((drawback) => (
                      <li key={drawback} className="flex items-start gap-1 text-ink-300">
                        <Minus size={12} aria-hidden className="mt-1 shrink-0" />
                        <span className="sr-only">Desvantagem:</span>
                        {drawback}
                      </li>
                    ))}
                  </ul>
                </LockedCard>
              );
            })}
          </div>
        </Card>
      </div>

      {wide && (
        <ActionBar info={rerollInfo}>
          <div className="flex items-center gap-2">
            {reroll}
            {proceed}
          </div>
        </ActionBar>
      )}
    </div>
  );
}
