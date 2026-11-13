import { TRAINING_FOCUSES } from '@/domain/schemas';
import { TRAINING_FOCUS_DESCRIPTIONS, TRAINING_FOCUS_LABELS } from '@/domain/labels';
import { useGameStore } from '@/store/gameStore';
import { cx } from './ui';
import { useCareerView } from '../hooks/useCareer';

export function TrainingFocusPicker() {
  const { player } = useCareerView();
  const setTrainingFocus = useGameStore((s) => s.setTrainingFocus);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TRAINING_FOCUSES.map((focus) => (
          <button
            key={focus}
            type="button"
            onClick={() => setTrainingFocus(focus)}
            aria-pressed={player.trainingFocus === focus}
            className={cx(
              'rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors',
              player.trainingFocus === focus ? 'border-apex-500 bg-apex-500/10 text-ink-100' : 'border-ink-700 text-ink-300 hover:border-ink-500',
            )}
          >
            {TRAINING_FOCUS_LABELS[focus]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-400">{TRAINING_FOCUS_DESCRIPTIONS[player.trainingFocus]} O ganho é aplicado depois de cada etapa e diminui perto do seu potencial.</p>
    </div>
  );
}
