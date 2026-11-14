/**
 * Comandos do jogador durante a corrida visual: ritmo de pilotagem, boxes e
 * resposta a ordens de equipe. São os mesmos comandos do modo de cronometragem;
 * as decisões valem para a próxima volta que o motor simular.
 */
import { RACE_MODES } from '@/domain/schemas';
import { RACE_MODE_DESCRIPTIONS, RACE_MODE_LABELS } from '@/domain/labels';
import { TYRES, conditionFor, fullName, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CompoundDot } from '../components/RaceView';
import { Button, Card, cx } from '../components/ui';
import { useCareerView } from '../hooks/useCareer';

export function TeamOrderDialog({ race }: { race: RaceSimState }) {
  const { drivers } = useCareerView();
  const stepRace = useGameStore((s) => s.stepRace);
  if (!race.pendingTeamOrder) return null;
  const favoured = drivers[race.pendingTeamOrder.favouredDriverId];
  return (
    <div role="alertdialog" aria-label="Ordem de equipe" className="rounded-xl border border-purple-400/60 bg-purple-500/15 p-4">
      <div className="font-display text-xl font-bold uppercase text-purple-200">Ordem de equipe</div>
      <p className="mt-1 text-sm text-ink-100">
        A equipe pede que você deixe <b>{favoured ? fullName(favoured) : 'o companheiro'}</b> passar. Obedecer aumenta a confiança da equipe e melhora a relação
        com o companheiro; ignorar custa caro nas duas frentes, mas mantém a posição. A corrida segue assim que você responder.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => stepRace('obey')}>
          Obedecer e ceder a posição
        </Button>
        <Button variant="danger" onClick={() => stepRace('ignore')}>
          Ignorar a ordem
        </Button>
      </div>
    </div>
  );
}

export function RaceModeCard({ race }: { race: RaceSimState }) {
  const { player, category } = useCareerView();
  const mode = useGameStore((s) => s.raceMode);
  const setRaceMode = useGameStore((s) => s.setRaceMode);
  const running = race.cars.find((c) => c.driverId === player.id)?.status === 'running';
  return (
    <Card title="Ritmo de pilotagem">
      <div className="grid grid-cols-3 gap-1.5">
        {RACE_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setRaceMode(m)}
            disabled={!running}
            aria-pressed={mode === m}
            className={cx(
              'rounded-lg border px-1 py-2 text-xs font-semibold transition-colors disabled:opacity-40',
              mode === m ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-400 hover:border-ink-500',
            )}
          >
            {RACE_MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-400">
        {RACE_MODE_DESCRIPTIONS[mode]}
        {category.race.fuel ? ' O modo também muda o consumo de combustível.' : ''}
      </p>
      {running && race.currentLap < race.totalLaps && <p className="mt-2 text-xs text-ink-500">Vale a partir da volta {race.currentLap + 1}.</p>}
    </Card>
  );
}

export function PitStrategyCard({ race }: { race: RaceSimState }) {
  const { player, category } = useCareerView();
  const pitRequest = useGameStore((s) => s.pitRequest);
  const skipPlannedStop = useGameStore((s) => s.skipPlannedStop);
  const autoEngineer = useGameStore((s) => s.autoEngineer);
  const { requestPit, setSkipPlannedStop, setAutoEngineer } = useGameStore.getState();
  const rules = category.race;
  const me = race.cars.find((c) => c.driverId === player.id);
  if (!rules.pitStops || !me) return null;
  const running = me.status === 'running';
  const compounds = [...rules.dryCompounds, ...rules.wetCompounds];
  const nextStop = me.plan[0];
  const nextLap = race.currentLap + 1;
  const wetness = race.wetnessByLap[Math.min(race.totalLaps, Math.max(1, race.currentLap))] ?? race.weather.wetness;
  const redFlagRestart = race.restart === 'standing' && race.currentLap > 0;
  return (
    <Card
      title="Boxes e estratégia"
      action={
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" checked={autoEngineer} onChange={(e) => setAutoEngineer(e.target.checked)} className="accent-apex-500" />
          Engenheiro automático
        </label>
      }
    >
      <p className="text-sm text-ink-300">
        {nextStop ? (
          <>
            Próxima parada planejada: <b className="text-ink-100">volta {nextStop.lap}</b>, pneu {TYRES[nextStop.compound].label.toLowerCase()}.
          </>
        ) : (
          'Nenhuma parada planejada.'
        )}
        {rules.mandatoryTwoCompounds && new Set(me.compoundsUsed).size < 2 && conditionFor(wetness) === 'dry' && (
          <span className="text-gold-400"> Você ainda precisa usar um segundo composto (30s de punição se não usar).</span>
        )}
      </p>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {redFlagRestart ? 'Trocar pneus na relargada (sem custo)' : `Entrar nos boxes no fim da volta ${nextLap} com`}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {compounds.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!running || autoEngineer}
            onClick={() => requestPit(pitRequest === c ? null : c)}
            aria-pressed={pitRequest === c}
            className={cx(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40',
              pitRequest === c ? 'border-sky-400 bg-sky-400/15 text-ink-100' : 'border-ink-700 text-ink-300 hover:border-ink-500',
            )}
          >
            <CompoundDot compound={c} />
            {TYRES[c].label}
          </button>
        ))}
      </div>
      {pitRequest && (
        <p className="mt-2 text-xs text-sky-300">
          {redFlagRestart ? 'Troca confirmada para a relargada' : `Parada confirmada para a volta ${nextLap}`}: pneu {TYRES[pitRequest].label.toLowerCase()}
          {me.damage > 0.05 && !redFlagRestart ? ', com reparo do carro' : ''}.
        </p>
      )}
      {nextStop && !autoEngineer && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" checked={skipPlannedStop} onChange={(e) => setSkipPlannedStop(e.target.checked)} className="accent-apex-500" />
          Cancelar a parada planejada se ela cair na volta {nextLap}
        </label>
      )}
      <p className="mt-3 text-xs text-ink-500">
        {autoEngineer
          ? 'O engenheiro decide as paradas (clima, danos, safety car) e manda poupar combustível quando preciso.'
          : 'As paradas planejadas acontecem sozinhas. Reações ao clima, a danos e ao safety car ficam por sua conta.'}
      </p>
    </Card>
  );
}
