import { TRAINING_FOCUSES, TRAINING_INTENSITIES } from '@/domain/schemas';
import { TRAINING_FOCUS_DESCRIPTIONS, TRAINING_FOCUS_LABELS, TRAINING_INTENSITY_DESCRIPTIONS, TRAINING_INTENSITY_LABELS } from '@/domain/labels';
import { ECONOMY } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { cx } from './ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';

export function TrainingFocusPicker() {
  const { career, player, category } = useCareerView();
  const setTrainingFocus = useGameStore((s) => s.setTrainingFocus);
  const setTrainingIntensity = useGameStore((s) => s.setTrainingIntensity);
  const option = (active: boolean) =>
    cx('min-h-11 border px-3 py-2 text-left text-sm font-semibold leading-tight transition-colors', active ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-300 hover:border-ink-500');
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold text-ink-300">Foco do treino</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TRAINING_FOCUSES.map((focus) => (
            <button key={focus} type="button" onClick={() => setTrainingFocus(focus)} aria-pressed={player.trainingFocus === focus} className={option(player.trainingFocus === focus)}>
              {TRAINING_FOCUS_LABELS[focus]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-400">{TRAINING_FOCUS_DESCRIPTIONS[player.trainingFocus]}</p>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-ink-300">Intensidade</div>
        <div className="grid grid-cols-3 gap-2">
          {TRAINING_INTENSITIES.map((intensity) => (
            <button key={intensity} type="button" onClick={() => setTrainingIntensity(intensity)} aria-pressed={career.trainingIntensity === intensity} className={option(career.trainingIntensity === intensity)}>
              {TRAINING_INTENSITY_LABELS[intensity]}
              <span className="block text-xs font-normal text-ink-400">{formatMoney(category.economy.trainingCost * ECONOMY.TRAINING_COST[intensity])} por etapa</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-400">{TRAINING_INTENSITY_DESCRIPTIONS[career.trainingIntensity]} A moral também pesa: com moral alta, o treino rende até 20% mais.</p>
      </div>
    </div>
  );
}
