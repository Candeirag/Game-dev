import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RACE_MODES, type RaceResult, type TyreCompound } from '@/domain/schemas';
import { RACE_MODE_DESCRIPTIONS, RACE_MODE_LABELS, WEATHER_LABELS } from '@/domain/labels';
import { TYRES, conditionFor, finalizeRace, fullName, gapToLeader, isRaceFinished, type RaceSimState } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { RaceResultTable } from './RaceResultTable';
import { Button, Card, Pill, TableWrap, TeamSwatch, cx, td, th } from './ui';
import { formatGap, formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { RaceControlBar } from '../race/RaceControlBar';
import { counted } from '@/domain/text';

/** Duração de cada volta na reprodução, por velocidade. */
const SPEEDS = [
  { label: '1×', ms: 1400 },
  { label: '2×', ms: 700 },
  { label: '4×', ms: 300 },
  { label: '8×', ms: 120 },
];

export const EVENT_TONE: Record<string, string> = {
  overtake: 'text-go-400',
  error: 'text-gold-400',
  spin: 'text-gold-400',
  dnf: 'text-apex-400',
  collision: 'text-apex-400',
  damage: 'text-apex-400',
  fuel: 'text-apex-400',
  penalty: 'text-gold-400',
  fastestLap: 'text-purple-300',
  pit: 'text-sky-300',
  safetyCar: 'text-gold-400 font-semibold',
  vsc: 'text-gold-400 font-semibold',
  redFlag: 'text-apex-400 font-semibold',
  restart: 'text-go-400 font-semibold',
  weather: 'text-rain-400 font-semibold',
  teamOrder: 'text-purple-300',
  start: 'text-ink-100',
  finish: 'text-ink-100',
};

const COMPOUND_STYLE: Record<TyreCompound, string> = {
  kart: 'bg-ink-600 text-ink-100',
  soft: 'bg-apex-500 text-white',
  medium: 'bg-gold-400 text-ink-950',
  hard: 'bg-ink-100 text-ink-950',
  intermediate: 'bg-go-400 text-ink-950',
  wet: 'bg-rain-400 text-ink-950',
};

export function CompoundDot({ compound }: { compound: TyreCompound }) {
  return (
    <span title={TYRES[compound].label} className={cx('inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold', COMPOUND_STYLE[compound])}>
      {TYRES[compound].label.charAt(0)}
    </span>
  );
}

/** Resultado oficial da corrida, com o botão que conclui a etapa. Usado pelos dois modos de exibição. */
export function RaceResultPanel({ race, result, extra }: { race: RaceSimState; result: RaceResult; extra?: ReactNode }) {
  const { career, player, drivers } = useCareerView();
  const completeWeekend = useGameStore((s) => s.completeWeekend);
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const mine = result.entries.find((e) => e.driverId === player.id);
  // Fora do carro (dirigente, ou piloto que não disputou a etapa), o destaque é o resultado da equipe.
  const teamId = career.management?.teamId ?? player.teamId;
  const team = mine ? [] : result.entries.filter((e) => e.teamId === teamId);
  return (
    <div className="space-y-6">
      <Card title={race.endedEarly ? 'Corrida encerrada com bandeira vermelha' : 'Bandeirada'} className="border-gold-400/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-display text-3xl font-bold uppercase">
              {mine
                ? mine.status === 'finished'
                  ? `Você terminou em ${mine.position}º`
                  : 'Você abandonou a corrida'
                : team.length > 0
                  ? `Sua equipe: ${team.map((e) => (e.status === 'finished' ? `${e.position}º` : 'abandono')).join(' e ')}`
                  : 'Corrida encerrada'}
            </div>
            {!mine && (
              <div className="text-sm text-ink-400">
                {team.map((e) => `${nameOf(e.driverId)}: largou em ${e.grid}º, ${counted(e.points, 'ponto', 'pontos')}`).join(' · ')}
                {team.length > 0 ? ' · ' : ''}Vencedor: {nameOf(result.entries[0]?.driverId ?? '')}
              </div>
            )}
            {mine && (
              <div className="text-sm text-ink-400">
                Largou em {mine.grid}º · {counted(mine.points, 'ponto', 'pontos')} · {counted(mine.overtakes, 'ultrapassagem', 'ultrapassagens')}
                {mine.pitStops > 0 && ` · ${counted(mine.pitStops, 'parada', 'paradas')}`}
                {mine.penaltySeconds > 0 && ` · ${mine.penaltySeconds}s de punição`} · Vencedor: {nameOf(result.entries[0]?.driverId ?? '')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {extra}
            <Button variant="primary" className="h-12 px-6 text-base" onClick={completeWeekend}>
              Concluir etapa e salvar
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Resultado oficial" padded={false}>
        <div className="px-4">
          <RaceResultTable result={result} />
        </div>
      </Card>
    </div>
  );
}

export function RaceView() {
  const { player, drivers, teams, category } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const mode = useGameStore((s) => s.raceMode);
  const pitRequest = useGameStore((s) => s.pitRequest);
  const skipPlannedStop = useGameStore((s) => s.skipPlannedStop);
  const autoEngineer = useGameStore((s) => s.autoEngineer);
  const { setRaceMode, stepRace, simulateRestOfRace, requestPit, setSkipPlannedStop, setAutoEngineer } = useGameStore.getState();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);

  const finished = race ? isRaceFinished(race) : false;
  const awaitingOrder = race?.pendingTeamOrder !== null && race?.pendingTeamOrder !== undefined;

  useEffect(() => {
    // A reprodução para sozinha quando a equipe dá uma ordem: o jogador precisa responder.
    if (!playing || finished || awaitingOrder) return;
    const id = window.setInterval(() => stepRace(), SPEEDS[speed]?.ms ?? 1000);
    return () => window.clearInterval(id);
  }, [playing, finished, awaitingOrder, speed, stepRace]);

  const result = useMemo(() => (race && finished ? finalizeRace(race, category) : null), [race, finished, category]);

  // No modo de cronometragem a "volta na tela" é a última simulada (ver a retomada de corrida interrompida).
  const currentLap = race?.currentLap ?? 0;
  useEffect(() => {
    useGameStore.getState().noteLapShown(currentLap);
  }, [currentLap]);

  if (!race) return null;
  const rules = category.race;
  const myIndex = race.cars.findIndex((c) => c.driverId === player.id);
  const me = race.cars[myIndex];
  const ahead = myIndex > 0 ? race.cars[myIndex - 1] : undefined;
  const behind = race.cars[myIndex + 1];
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const recentEvents = [...race.events].reverse().slice(0, 50);
  const wetness = race.wetnessByLap[Math.min(race.totalLaps, Math.max(1, race.currentLap))] ?? race.weather.wetness;
  const lapsRemaining = race.totalLaps - race.currentLap;
  const running = me?.status === 'running';
  const compounds = [...rules.dryCompounds, ...rules.wetCompounds];
  const nextStop = me?.plan[0];
  const fuelMargin = me ? me.fuel - lapsRemaining : 0;
  const redFlagRestart = race.restart === 'standing' && race.currentLap > 0;

  if (result) return <RaceResultPanel race={race} result={result} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700/70 bg-ink-900 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Volta</div>
            <div className="font-display text-3xl font-bold leading-none tabular">
              {race.currentLap}
              <span className="text-ink-500">/{race.totalLaps}</span>
            </div>
          </div>
          <Pill tone={conditionFor(wetness) === 'dry' ? 'neutral' : 'accent'}>
            {WEATHER_LABELS[conditionFor(wetness)]} · pista {Math.round(wetness * 100)}% molhada
          </Pill>
          {race.forecast.kind !== 'stable' && race.forecast.aroundLap !== null && race.currentLap < race.forecast.aroundLap && (
            <span className="text-xs text-rain-400">
              Previsão: {race.forecast.kind === 'rain' ? 'chuva' : 'pista secando'} por volta da volta {race.forecast.aroundLap}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={playing ? 'secondary' : 'primary'} onClick={() => setPlaying(!playing)} disabled={awaitingOrder}>
            {playing ? '❚❚ Pausar' : race.currentLap === 0 ? '▶ Largar' : '▶ Continuar'}
          </Button>
          <Button onClick={() => stepRace()} disabled={playing || awaitingOrder}>
            +1 volta
          </Button>
          <div className="flex rounded-lg border border-ink-700 p-0.5">
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSpeed(i)}
                className={cx('rounded-md px-2.5 py-1 text-xs font-semibold', speed === i ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setPlaying(false);
              simulateRestOfRace();
            }}
            title="O engenheiro assume paradas e combustível até o fim"
          >
            Simular até o fim
          </Button>
        </div>
      </div>

      {me && (
        <RaceControlBar
          position={me.status === 'running' ? `P${myIndex + 1}` : 'AB'}
          lap={`Volta ${race.currentLap}/${race.totalLaps}`}
          mode={mode}
          onMode={setRaceMode}
          modeDisabled={!running}
          modeFromLap={race.currentLap < race.totalLaps ? race.currentLap + 1 : null}
          playing={playing}
          playLabel={race.currentLap === 0 ? 'Largar' : 'Continuar'}
          onToggle={() => setPlaying(!playing)}
          toggleDisabled={awaitingOrder}
          speeds={SPEEDS.map((sp, i) => ({ label: sp.label, active: speed === i, select: () => setSpeed(i) }))}
        />
      )}

      {race.neutralization.type !== 'none' && (
        <div role="status" className="rounded-xl border border-gold-400/50 bg-gold-400/15 px-4 py-3 text-sm font-semibold text-gold-400">
          {race.neutralization.type === 'sc' ? 'SAFETY CAR NA PISTA' : 'SAFETY CAR VIRTUAL'} · mais {counted(race.neutralization.lapsLeft, 'volta', 'voltas')}.
          Ultrapassagens proibidas{rules.pitStops ? '; parar agora custa menos tempo.' : '.'}
        </div>
      )}
      {redFlagRestart && (
        <div role="status" className="rounded-xl border border-apex-500/60 bg-apex-500/15 px-4 py-3 text-sm font-semibold text-apex-400">
          BANDEIRA VERMELHA · relargada parada na próxima volta.
          {rules.pitStops ? ' A troca de pneus é livre: escolha um composto abaixo, se quiser trocar.' : ''}
        </div>
      )}
      {race.pendingTeamOrder && (
        <div role="alertdialog" aria-label="Ordem de equipe" className="rounded-xl border border-purple-400/60 bg-purple-500/15 p-4">
          <div className="font-display text-xl font-bold uppercase text-purple-200">Ordem de equipe</div>
          <p className="mt-1 text-sm text-ink-100">
            A equipe pede que você deixe <b>{nameOf(race.pendingTeamOrder.favouredDriverId)}</b> passar. Obedecer aumenta a confiança da equipe e melhora a
            relação com o companheiro; ignorar custa caro nas duas frentes, mas mantém a posição.
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
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Pos</th>
                    <th className={th}>Piloto</th>
                    <th className={cx(th, 'text-right')}>Dif.</th>
                    <th className={cx(th, 'hidden text-right sm:table-cell')}>Última</th>
                    <th className={cx(th, 'hidden text-right md:table-cell')}>Melhor</th>
                    <th className={cx(th, 'w-28')}>Pneus</th>
                    {rules.pitStops && <th className={cx(th, 'hidden text-center sm:table-cell')}>Par.</th>}
                  </tr>
                </thead>
                <tbody>
                  {race.cars.map((car, i) => {
                    const gained = car.grid - (i + 1);
                    const isMe = car.driverId === player.id;
                    return (
                      <tr key={car.driverId} className={cx('border-t border-ink-800', isMe && 'bg-apex-500/12', car.status === 'dnf' && 'opacity-45')}>
                        <td className={cx(td, 'w-14')}>
                          <span className="font-display text-base font-bold tabular">{car.status === 'dnf' ? 'AB' : i + 1}</span>
                          {car.status === 'running' && race.currentLap > 0 && gained !== 0 && (
                            <span className={cx('ml-1 text-[10px]', gained > 0 ? 'text-go-400' : 'text-apex-400')}>
                              {gained > 0 ? `▲${gained}` : `▼${-gained}`}
                            </span>
                          )}
                        </td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <TeamSwatch team={teams[car.teamId]} />
                            <span className={cx('truncate', isMe && 'font-semibold')}>{nameOf(car.driverId)}</span>
                            {race.fastestLap?.driverId === car.driverId && (
                              <span className="rounded bg-purple-500/20 px-1 text-[10px] font-bold text-purple-300">VMR</span>
                            )}
                            {car.penaltySeconds > 0 && (
                              <span className="rounded bg-gold-400/20 px-1 text-[10px] font-bold text-gold-400">+{car.penaltySeconds}s</span>
                            )}
                            {car.damage >= 0.2 && car.status === 'running' && (
                              <span title="Carro danificado" className="rounded bg-apex-600/25 px-1 text-[10px] font-bold text-apex-400">
                                DANO
                              </span>
                            )}
                          </span>
                        </td>
                        <td className={cx(td, 'text-right tabular text-ink-300')}>
                          {car.status === 'dnf' ? '-' : race.currentLap === 0 ? '' : formatGap(gapToLeader(race, car))}
                        </td>
                        <td className={cx(td, 'hidden text-right tabular text-ink-400 sm:table-cell')}>{formatLap(car.lastLap)}</td>
                        <td className={cx(td, 'hidden text-right tabular text-ink-400 md:table-cell')}>{formatLap(car.bestLap)}</td>
                        <td className={td}>
                          <span className="flex items-center gap-1.5">
                            {rules.pitStops && <CompoundDot compound={car.tyre.compound} />}
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800" title={`${Math.round((1 - car.tyre.wear) * 100)}% de pneu`}>
                              <span
                                className={cx(
                                  'block h-full rounded-full',
                                  car.tyre.wear > 0.75 ? 'bg-apex-500' : car.tyre.wear > 0.45 ? 'bg-gold-400' : 'bg-go-400',
                                )}
                                style={{ width: `${Math.max(0, (1 - car.tyre.wear) * 100)}%` }}
                              />
                            </span>
                          </span>
                        </td>
                        {rules.pitStops && <td className={cx(td, 'hidden text-center tabular text-ink-400 sm:table-cell')}>{car.pitStops}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>

        <div className="space-y-4">
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
                    'rounded-lg border px-1 py-2 text-xs font-semibold transition-colors',
                    mode === m ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-400 hover:border-ink-500',
                  )}
                >
                  {RACE_MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-400">
              {RACE_MODE_DESCRIPTIONS[mode]}
              {rules.fuel ? ' O modo também muda o consumo de combustível.' : ''}
            </p>
            {me && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-800 pt-4 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">Posição</dt>
                  <dd className="font-display text-2xl font-bold tabular">{me.status === 'dnf' ? 'AB' : myIndex + 1}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">Pneus</dt>
                  <dd className="flex items-center gap-2 font-display text-2xl font-bold tabular">
                    {rules.pitStops && <CompoundDot compound={me.tyre.compound} />}
                    {Math.round((1 - me.tyre.wear) * 100)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">À frente</dt>
                  <dd className="tabular">
                    {ahead && running && race.currentLap > 0 ? `${(me.totalTime - ahead.totalTime).toFixed(2)}s · ${drivers[ahead.driverId]?.lastName}` : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">Atrás</dt>
                  <dd className="tabular">
                    {behind && behind.status === 'running' && running && race.currentLap > 0
                      ? `${(behind.totalTime - me.totalTime).toFixed(2)}s · ${drivers[behind.driverId]?.lastName}`
                      : '-'}
                  </dd>
                </div>
                {rules.fuel && (
                  <div className="col-span-2">
                    <dt className="text-[11px] uppercase tracking-wider text-ink-400">Combustível</dt>
                    <dd className={cx('tabular', fuelMargin < 0 ? 'font-semibold text-apex-400' : fuelMargin < 1 ? 'text-gold-400' : '')}>
                      {me.fuel.toFixed(1)} voltas no tanque · {lapsRemaining} por correr (
                      {fuelMargin >= 0 ? `sobra ${fuelMargin.toFixed(1)}` : `falta ${(-fuelMargin).toFixed(1)}: poupe ou não chega ao fim`})
                    </dd>
                  </div>
                )}
                {(me.damage >= 0.05 || me.penaltySeconds > 0) && (
                  <div className="col-span-2 text-xs text-gold-400">
                    {me.damage >= 0.05 && `Dano no carro: ${Math.round(Math.min(1, me.damage) * 100)}% (perde ritmo até reparar). `}
                    {me.penaltySeconds > 0 && `Punições acumuladas: ${me.penaltySeconds}s, somados ao tempo final.`}
                  </div>
                )}
              </dl>
            )}
          </Card>

          {rules.pitStops && me && (
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
                {redFlagRestart ? 'Trocar pneus na relargada (sem custo)' : 'Parar na próxima volta com'}
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
                  Parada confirmada para a próxima volta: pneu {TYRES[pitRequest].label.toLowerCase()}
                  {me.damage > 0.05 ? ', com reparo do carro' : ''}.
                </p>
              )}
              {nextStop && !autoEngineer && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-300">
                  <input type="checkbox" checked={skipPlannedStop} onChange={(e) => setSkipPlannedStop(e.target.checked)} className="accent-apex-500" />
                  Cancelar a parada planejada se ela cair na próxima volta
                </label>
              )}
              <p className="mt-3 text-xs text-ink-500">
                {autoEngineer
                  ? 'O engenheiro decide as paradas (clima, danos, safety car) e manda poupar combustível quando preciso.'
                  : 'As paradas planejadas acontecem sozinhas. Reações ao clima, a danos e ao safety car ficam por sua conta.'}
              </p>
            </Card>
          )}

          <Card title="Acontecimentos" padded={false}>
            <ul className="max-h-[360px] space-y-0 overflow-y-auto">
              {recentEvents.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">Os carros estão alinhados no grid.</li>}
              {recentEvents.map((e, i) => (
                <li
                  key={`${race.events.length - i}`}
                  className={cx(
                    'flex gap-3 border-t border-ink-800 px-4 py-2 text-sm first:border-t-0',
                    i === 0 && 'animate-flash',
                    (e.driverId === player.id || e.otherDriverId === player.id) && 'bg-apex-500/8',
                  )}
                >
                  <span className="w-8 shrink-0 text-xs tabular text-ink-500">V{e.lap}</span>
                  <span className={EVENT_TONE[e.type] ?? 'text-ink-300'}>{e.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
