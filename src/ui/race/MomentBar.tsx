/**
 * Tarja do lance decisivo (Fase 4): a corrida para, sem tempo limite, e o jogador escolhe.
 *
 * Fica presa ao pé da tela, no lugar da barra de comandos, com a pista à vista acima. Tocar numa
 * opção a seleciona e mostra o que se ganha, o que se perde e o que mais pesa na chance;
 * "Confirmar" envia. "Deixar com o piloto" entrega a decisão ao estilo dele, que é também o que
 * decide todos os lances em "Simular até o fim".
 *
 * As chances, os textos e a escolha do piloto vêm prontos do motor (`RaceMoment`,
 * `chooseByStyle`): aqui não há regra, só a pergunta. Os dois modos de exibição (corrida visual e
 * cronometragem) usam esta mesma tarja.
 */
import { CircleMinus, CirclePlus, UserRound } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DRIVING_STYLE_DESCRIPTIONS, DRIVING_STYLE_LABELS } from '@/domain/labels';
import type { TyreCompound } from '@/domain/schemas';
import { TYRES, activeBirth, chooseByStyle, drivingStyle, drivingStyleScore, type MomentChoice, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, ChanceOption, Chip, cx, DecisionBar, Delta, TyreBadge, TyreGauge, tyreName } from '@/ui/kit';
import { feedback } from '../feedback/feedback';
import { useCareerView } from '../hooks/useCareer';
import { useChrome, useRaceBarSpace } from '../layout/chrome';
import { playerRaceProfile, shownFactors } from './raceInfo';

/**
 * O espaço que sobra acima da tarja, na tela deitada: quem mostra a corrida (a pista com a torre,
 * ou a tabela da cronometragem) encolhe para caber inteiro ali, e nada fica atrás da tarja. Devolve
 * a referência para pôr no bloco que encolhe, a altura a dar a ele (null = a altura normal) e o
 * aviso de altura para passar à `MomentBar`.
 */
export function useStageAboveMoment<T extends HTMLElement>(open: boolean) {
  const stage = useRef<T>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!open || !element || barHeight <= 0) {
      setHeight(null);
      return;
    }
    const measure = () => setHeight(Math.max(96, Math.floor(window.innerHeight - barHeight - element.getBoundingClientRect().top - 8)));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, barHeight]);
  return { stage, height, onHeight: setBarHeight };
}

export function MomentBar({
  race,
  tyre,
  onAnswered,
  onHeight,
}: {
  race: RaceSimState;
  /** O pneu do jogador como está na tela, para o lance de parada. */
  tyre?: { compound: TyreCompound; wear: number } | null;
  /** Depois da resposta: quem mostra a corrida a põe para andar. */
  onAnswered?: () => void;
  /** Altura da tarja na tela (0 quando fecha): quem mostra a pista a encolhe para caber acima dela. */
  onHeight?: (height: number) => void;
}) {
  const moment = race.pendingMoment;
  const { wide } = useChrome();
  const { career, player } = useCareerView();
  const raceMode = useGameStore((s) => s.raceMode);
  const profile = useMemo(() => playerRaceProfile(career), [career]);
  const birth = useMemo(() => activeBirth(career), [career]);
  // A escolha vale só para o lance em que foi feita: um lance novo abre sem nada marcado.
  const key = moment ? `${moment.kind}-${moment.lap}` : '';
  const [pick, setPick] = useState<{ key: string; option: string } | null>(null);
  const [tyrePick, setTyrePick] = useState<{ key: string; compound: TyreCompound } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useRaceBarSpace(moment !== null);
  // O foco vai para a tarja quando ela abre: quem usa teclado ou leitor de tela cai na pergunta.
  useEffect(() => {
    if (key) dialog.current?.focus({ preventScroll: true });
  }, [key]);
  // A altura muda com a opção escolhida e com o tamanho do texto: quem mostra a pista acompanha.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!key || !element || !onHeight) return;
    const report = () => onHeight(element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
  }, [key, onHeight]);
  if (!moment) return null;

  const styleScore = drivingStyleScore(player, profile, raceMode);
  const style = drivingStyle(styleScore);
  const pilotPick = chooseByStyle(moment, styleScore).option;
  const selected = moment.options.find((o) => pick?.key === key && o.id === pick.option) ?? null;
  const compounds = moment.kind === 'pit' ? (moment.compounds ?? []) : [];
  const picked = tyrePick?.key === key && compounds.includes(tyrePick.compound) ? tyrePick.compound : null;
  const compound = picked ?? moment.suggestedCompound ?? null;
  const factors = selected ? shownFactors(selected, moment.kind, birth) : [];
  /** A opção que troca o pneu por conta do lance: a tela diz qual entra. */
  const fitsTyre = (optionId: string) => compound !== null && ((moment.kind === 'rain' && optionId === 'pit') || moment.kind === 'pit');

  const answer = (choice: MomentChoice | null) => {
    // Alerta ao confirmar a opção arriscada; o desfecho vibra depois, quando aparecer na pista.
    if (choice && selected?.risk === 2) feedback('riskyDecision');
    useGameStore.getState().answerMoment(choice);
    onAnswered?.();
  };

  const options = (
    <div
      role="radiogroup"
      aria-label="Opções do lance"
      className={cx('grid min-w-0 flex-1 gap-2', wide && moment.options.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}
    >
      {moment.options.map((option, index) => {
        const mine = option.id === pilotPick;
        const tyreIn = moment.kind === 'rain' && fitsTyre(option.id) && compound;
        const badges = [mine ? 'escolha do piloto' : null, tyreIn ? `entra o pneu ${tyreName(tyreIn)}` : null].filter((b): b is string => b !== null);
        return (
          <ChanceOption
            key={option.id}
            label={option.label}
            chance={option.chance}
            risk={option.risk}
            selected={selected?.id === option.id}
            onSelect={() => setPick({ key, option: option.id })}
            badgeLabel={badges.join(', ') || undefined}
            badge={tyreIn ? <TyreBadge compound={tyreIn} /> : undefined}
            seal={
              mine ? (
                <Chip size="sm" icon={<UserRound size={12} aria-hidden className="shrink-0" />} className="shadow-ring">
                  Piloto
                </Chip>
              ) : undefined
            }
            // Em pé, as opções vão em duas colunas; a terceira ocupa a linha de baixo inteira.
            className={!wide && moment.options.length % 2 === 1 && index === moment.options.length - 1 ? 'col-span-2' : undefined}
          />
        );
      })}
    </div>
  );

  const tyreChooser = compounds.length > 0 && (
    <div className="flex min-w-0 shrink-0 flex-col gap-1">
      <div id="lance-pneu" className="text-2xs font-semibold leading-none text-ink-300">
        Pneu a colocar
      </div>
      <div role="radiogroup" aria-labelledby="lance-pneu" className="flex flex-1 gap-2">
        {compounds.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={compound === c}
            aria-label={`Pneu ${tyreName(c)}`}
            onClick={() => {
              if (compound !== c) feedback('tyreChoice');
              setTyrePick({ key, compound: c });
            }}
            className={cx(
              'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-1 text-2xs font-semibold leading-none transition-colors',
              compound === c
                ? 'bg-apex-500/20 text-ink-100 shadow-[inset_0_0_0_1px_var(--color-apex-400),inset_0_-4px_0_0_var(--color-apex-400)]'
                : 'bg-ink-800 text-ink-200 shadow-ring hover:bg-ink-700',
            )}
          >
            <TyreBadge compound={c} />
            {TYRES[c].label}
          </button>
        ))}
      </div>
    </div>
  );

  // Texto corrido, para quebrar em menos linhas: o que se ganha, o que se perde, o pneu que entra e o que pesa.
  const detail = selected ? (
    <p>
      <CirclePlus size={14} aria-hidden className="mr-1 inline align-[-2px] text-go-400" />
      <b className="font-semibold text-ink-100">Se der certo:</b> {selected.gain}.{' '}
      <CircleMinus size={14} aria-hidden className="mr-1 inline align-[-2px] text-gold-400" />
      <b className="font-semibold text-ink-100">Se der errado:</b> {selected.loss}.
      {fitsTyre(selected.id) && compound && (
        <>
          {' '}
          <b className="font-semibold text-ink-100">Pneu que entra:</b> {tyreName(compound)}.
        </>
      )}
      {factors.length > 0 && (
        <span className="mt-1 flex flex-wrap items-center gap-x-2">
          <b className="font-semibold text-ink-100">Pesa na chance, em pontos:</b>
          {factors.map((factor) => (
            <span key={factor.key} className="inline-flex items-center gap-1 whitespace-nowrap">
              {factor.label}
              <Delta value={factor.points} format={(v) => String(Math.round(v))} />
            </span>
          ))}
        </span>
      )}
    </p>
  ) : (
    <p className="text-ink-300">Toque numa opção para ver o que se ganha, o que se perde e o que pesa na chance. Sem pressa: a corrida espera.</p>
  );

  return createPortal(
    <DecisionBar
      ref={dialog}
      label={`Lance decisivo: ${moment.title}`}
      kicker={`${moment.title} · volta ${moment.lap}`}
      title={moment.question}
      stacked={!wide}
      aside={moment.kind === 'pit' && tyre ? <TyreGauge compound={tyre.compound} wear={tyre.wear} className="w-48" /> : undefined}
      detail={detail}
      actions={
        <>
          {/* O nome do botão é só a ação; o estilo do piloto vai como descrição. */}
          <Button
            onClick={() => answer(null)}
            aria-label="Deixar com o piloto"
            aria-describedby="lance-estilo"
            title={`O piloto escolhe pelo próprio estilo. ${DRIVING_STYLE_LABELS[style]}: ${DRIVING_STYLE_DESCRIPTIONS[style].toLowerCase()}`}
            className="flex-col gap-1 px-2 leading-none"
          >
            <span>Deixar com o piloto</span>
            <span id="lance-estilo" className="text-2xs font-medium text-ink-300">
              Estilo: {DRIVING_STYLE_LABELS[style]}
            </span>
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => selected && answer({ option: selected.id, ...(compound ? { compound } : {}) })}
            className="min-w-28 px-4"
          >
            Confirmar
          </Button>
        </>
      }
      // Nunca cobre a tela toda: sobram a barra superior e uma faixa de pista acima da tarja.
      className="fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-40 max-h-[calc(100dvh-9rem-var(--safe-top))] pb-[var(--safe-bottom)] pr-[var(--safe-right)]"
    >
      {tyreChooser ? (
        <div className={cx('flex min-w-0 gap-2', !wide && 'flex-col')}>
          {options}
          {tyreChooser}
        </div>
      ) : (
        options
      )}
    </DecisionBar>,
    document.body,
  );
}
