/**
 * Comandos do jogador durante a corrida visual: ritmo de pilotagem, boxes e
 * resposta a ordens de equipe. São os mesmos comandos do modo de cronometragem;
 * as decisões valem para a próxima volta que o motor simular.
 */
import { TYRES, conditionFor, fullName, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { feedback } from '../feedback/feedback';
import { Button, Card, cx, TyreBadge } from '@/ui/kit';
import { useCareerView } from '../hooks/useCareer';

export function TeamOrderDialog({ race }: { race: RaceSimState }) {
  const { drivers } = useCareerView();
  const stepRace = useGameStore((s) => s.stepRace);
  if (!race.pendingTeamOrder) return null;
  const favoured = drivers[race.pendingTeamOrder.favouredDriverId];
  return (
    <div role="alertdialog" aria-label="Ordem de equipe" className="bg-ink-950/95 p-3 shadow-[inset_0_0_0_1px_var(--color-gold-400)]">
      <div className="font-display text-lg font-bold uppercase leading-none text-gold-400">Ordem de equipe</div>
      <p className="mt-1 text-xs leading-snug text-ink-100">
        A equipe pede que você deixe <b>{favoured ? fullName(favoured) : 'o companheiro'}</b> passar. Obedecer aumenta a confiança da equipe e melhora a relação
        com o companheiro; ignorar custa caro nas duas frentes, mas mantém a posição. A corrida segue assim que você responder.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
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

/** Boxes e estratégia. `bare` tira o cartão em volta, para caber na aba da transmissão. */
export function PitStrategyCard({ race, bare = false }: { race: RaceSimState; bare?: boolean }) {
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
  const engineer = (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-ink-200">
      <input type="checkbox" checked={autoEngineer} onChange={(e) => setAutoEngineer(e.target.checked)} className="h-5 w-5 accent-apex-500" />
      Engenheiro automático
    </label>
  );
  const content = (
    <>
      {bare && engineer}
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
      <div className="mt-3 text-xs font-semibold text-ink-300">
        {redFlagRestart ? 'Trocar pneus na relargada (sem custo)' : `Entrar nos boxes no fim da volta ${nextLap} com`}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {compounds.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!running || autoEngineer}
            onClick={() => {
              // Toque leve ao escolher o pneu.
              if (pitRequest !== c) feedback('tyreChoice');
              requestPit(pitRequest === c ? null : c);
            }}
            aria-pressed={pitRequest === c}
            className={cx(
              'flex min-h-11 items-center gap-1.5 px-2.5 text-xs font-semibold',
              pitRequest === c ? 'bg-apex-500/15 text-ink-100 shadow-ring-accent' : 'text-ink-200 shadow-ring hover:bg-ink-800',
            )}
          >
            <TyreBadge compound={c} />
            {TYRES[c].label}
          </button>
        ))}
      </div>
      {pitRequest && (
        <p className="mt-2 text-xs font-semibold text-ink-100">
          {redFlagRestart ? 'Troca confirmada para a relargada' : `Parada confirmada para a volta ${nextLap}`}: pneu {TYRES[pitRequest].label.toLowerCase()}
          {me.damage > 0.05 && !redFlagRestart ? ', com reparo do carro' : ''}.
        </p>
      )}
      {nextStop && !autoEngineer && (
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={skipPlannedStop}
            onChange={(e) => setSkipPlannedStop(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-apex-500"
          />
          Cancelar a parada planejada se ela cair na volta {nextLap}
        </label>
      )}
      <p className="mt-2 text-xs text-ink-400">
        {autoEngineer
          ? 'O engenheiro decide as paradas (clima, danos, safety car) e manda poupar combustível quando preciso.'
          : 'As paradas planejadas acontecem sozinhas. Reações ao clima, a danos e ao safety car ficam por sua conta.'}
      </p>
    </>
  );
  if (bare) return <div className="p-3">{content}</div>;
  return (
    <Card title="Boxes e estratégia" action={engineer}>
      {content}
    </Card>
  );
}
