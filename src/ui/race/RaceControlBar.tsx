/**
 * Barra fixa de comandos da corrida: ritmo de pilotagem, pausa, velocidade da
 * reprodução e a posição do jogador. Fica presa ao rodapé para o jogador mudar
 * o ritmo sem tirar a pista da tela; os dois modos de exibição (corrida visual
 * e cronometragem) usam a mesma barra.
 *
 * Não há regra aqui: os botões chamam os mesmos comandos dos cartões da tela.
 */
import { Pause, Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import { RACE_MODES, type RaceMode } from '@/domain/schemas';
import { RACE_MODE_LABELS } from '@/domain/labels';
import { cx } from '@/ui/kit';
import { useRaceBarSpace } from '../layout/chrome';

export interface RaceControlBarProps {
  /** Posição do jogador (ex.: "P14"), ou "AB" se abandonou. */
  position: string;
  /** Volta em que ele está (ex.: "Volta 3/22"). */
  lap: string;
  mode: RaceMode;
  onMode(mode: RaceMode): void;
  /** O ritmo não pode mais ser trocado (carro fora da prova ou corrida já decidida). */
  modeDisabled: boolean;
  /** A partir de que volta o ritmo escolhido vale, quando ainda vale. */
  modeFromLap: number | null;
  playing: boolean;
  /** Rótulo do botão quando parado: Largar, Continuar ou Relargar. */
  playLabel: string;
  onToggle(): void;
  toggleDisabled: boolean;
  speeds: readonly { label: string; active: boolean; select(): void }[];
}

export function RaceControlBar({
  position,
  lap,
  mode,
  onMode,
  modeDisabled,
  modeFromLap,
  playing,
  playLabel,
  onToggle,
  toggleDisabled,
  speeds,
}: RaceControlBarProps) {
  useRaceBarSpace(true);
  // Vai direto para o corpo da página: assim nenhum espaçamento ou transformação da tela desloca a barra.
  return createPortal(
    <div
      role="region"
      aria-label="Comandos da corrida"
      className="enter-up fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-40 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 py-2 pl-3 pr-[calc(0.75rem+env(safe-area-inset-right))] md:flex md:gap-3 lg:pl-6 lg:pr-[calc(1.5rem+env(safe-area-inset-right))]">
        <div className="min-w-[3.75rem] shrink-0 leading-none md:flex md:items-baseline md:gap-2" aria-live="off">
          <div className="font-display text-2xl font-bold tabular">{position}</div>
          <div className="mt-0.5 whitespace-nowrap text-2xs font-semibold text-ink-300 tabular md:mt-0 md:text-sm">{lap}</div>
        </div>

        <div
          role="group"
          aria-label="Ritmo de pilotagem"
          className="order-last col-span-3 grid grid-cols-3 gap-1.5 md:order-none md:ml-1 md:min-w-0 md:max-w-[23rem] md:flex-1"
        >
          {RACE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              disabled={modeDisabled}
              aria-pressed={mode === m}
              className={cx(
                'chamfer-br min-h-11 px-1 text-sm font-semibold transition-colors [--chamfer:8px]',
                mode === m ? 'bg-apex-500/20 text-ink-100 shadow-ring-accent' : 'bg-ink-800 text-ink-300 shadow-ring hover:text-ink-100',
              )}
            >
              {RACE_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <span className="hidden whitespace-nowrap text-xs text-ink-400 xl:inline">
          {modeFromLap !== null && !modeDisabled ? `Ritmo vale a partir da volta ${modeFromLap}` : ''}
        </span>

        <button
          type="button"
          onClick={onToggle}
          disabled={toggleDisabled}
          className={cx(
            'chamfer-br flex min-h-11 shrink-0 items-center justify-center gap-1.5 px-2 text-sm font-bold transition-colors [--chamfer:8px] md:ml-auto md:min-w-28',
            playing ? 'bg-ink-800 text-ink-100 shadow-ring hover:bg-ink-700' : 'bg-apex-500 text-white hover:bg-apex-600',
          )}
        >
          {playing ? <Pause size={16} className="shrink-0" aria-hidden /> : <Play size={16} className="shrink-0" aria-hidden />}
          <span className="max-[379px]:sr-only">{playing ? 'Pausar' : playLabel}</span>
        </button>

        <div role="group" aria-label="Velocidade da corrida" className="flex shrink-0 bg-ink-800 shadow-ring">
          {speeds.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.select}
              aria-pressed={s.active}
              className={cx('min-h-11 min-w-11 px-1 text-sm font-semibold', s.active ? 'bg-apex-500 text-white' : 'text-ink-300 hover:text-ink-100')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
