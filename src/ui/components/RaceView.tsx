import { useEffect, useMemo, useState } from 'react';
import { RACE_MODES } from '@/domain/schemas';
import { RACE_MODE_DESCRIPTIONS, RACE_MODE_LABELS } from '@/domain/labels';
import { finalizeRace, fullName, gapToLeader, isRaceFinished } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { RaceResultTable } from './RaceResultTable';
import { Button, Card, TableWrap, TeamSwatch, WeatherBadge, cx, td, th } from './ui';
import { formatGap, formatLap } from '../format';
import { useCareerView } from '../hooks/useCareer';

/** Duração de cada volta na reprodução, por velocidade. */
const SPEEDS = [
  { label: '1×', ms: 1400 },
  { label: '2×', ms: 700 },
  { label: '4×', ms: 300 },
];

const EVENT_TONE: Record<string, string> = {
  overtake: 'text-go-400',
  error: 'text-gold-400',
  spin: 'text-gold-400',
  dnf: 'text-apex-400',
  collision: 'text-apex-400',
  fastestLap: 'text-purple-300',
  start: 'text-ink-100',
  finish: 'text-ink-100',
};

export function RaceView() {
  const { player, drivers, teams } = useCareerView();
  const race = useGameStore((s) => s.liveRace);
  const mode = useGameStore((s) => s.raceMode);
  const setRaceMode = useGameStore((s) => s.setRaceMode);
  const stepRace = useGameStore((s) => s.stepRace);
  const simulateRest = useGameStore((s) => s.simulateRestOfRace);
  const completeWeekend = useGameStore((s) => s.completeWeekend);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);

  const finished = race ? isRaceFinished(race) : false;

  useEffect(() => {
    if (!playing || finished) return;
    const id = window.setInterval(stepRace, SPEEDS[speed]?.ms ?? 1000);
    return () => window.clearInterval(id);
  }, [playing, finished, speed, stepRace]);

  const result = useMemo(() => (race && finished ? finalizeRace(race) : null), [race, finished]);

  if (!race) return null;
  const myIndex = race.cars.findIndex((c) => c.driverId === player.id);
  const me = race.cars[myIndex];
  const ahead = myIndex > 0 ? race.cars[myIndex - 1] : undefined;
  const behind = race.cars[myIndex + 1];
  const nameOf = (id: string) => (drivers[id] ? fullName(drivers[id]!) : id);
  const recentEvents = [...race.events].reverse().slice(0, 40);

  if (result) {
    const mine = result.entries.find((e) => e.driverId === player.id);
    return (
      <div className="space-y-6">
        <Card title="Bandeirada" className="border-gold-400/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-display text-3xl font-bold uppercase">
                {mine?.status === 'finished' ? `Você terminou em ${mine.position}º` : 'Você abandonou a corrida'}
              </div>
              <div className="text-sm text-ink-400">
                Largou em {mine?.grid}º · {mine?.points ?? 0} ponto(s) · {mine?.overtakes ?? 0} ultrapassagem(ns) · Vencedor: {nameOf(result.entries[0]?.driverId ?? '')}
              </div>
            </div>
            <Button variant="primary" className="h-12 px-6 text-base" onClick={completeWeekend}>Concluir etapa e salvar</Button>
          </div>
        </Card>
        <Card title="Resultado oficial" padded={false}><div className="px-4"><RaceResultTable result={result} /></div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700/70 bg-ink-900 px-4 py-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Volta</div>
            <div className="font-display text-3xl font-bold leading-none tabular">
              {race.currentLap}<span className="text-ink-500">/{race.totalLaps}</span>
            </div>
          </div>
          <WeatherBadge weather={race.weather} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={playing ? 'secondary' : 'primary'} onClick={() => setPlaying(!playing)}>{playing ? '❚❚ Pausar' : race.currentLap === 0 ? '▶ Largar' : '▶ Continuar'}</Button>
          <Button onClick={stepRace} disabled={playing}>+1 volta</Button>
          <div className="flex rounded-lg border border-ink-700 p-0.5">
            {SPEEDS.map((s, i) => (
              <button key={s.label} type="button" onClick={() => setSpeed(i)} className={cx('rounded-md px-2.5 py-1 text-xs font-semibold', speed === i ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>{s.label}</button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => { setPlaying(false); simulateRest(); }}>Simular até o fim</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
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
                    <th className={cx(th, 'w-24')}>Pneus</th>
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
                            <span className={cx('ml-1 text-[10px]', gained > 0 ? 'text-go-400' : 'text-apex-400')}>{gained > 0 ? `▲${gained}` : `▼${-gained}`}</span>
                          )}
                        </td>
                        <td className={td}>
                          <span className="flex items-center gap-2">
                            <TeamSwatch team={teams[car.teamId]} />
                            <span className={cx('truncate', isMe && 'font-semibold')}>{nameOf(car.driverId)}</span>
                            {race.fastestLap?.driverId === car.driverId && <span className="rounded bg-purple-500/20 px-1 text-[10px] font-bold text-purple-300">VMR</span>}
                          </span>
                        </td>
                        <td className={cx(td, 'text-right tabular text-ink-300')}>{car.status === 'dnf' ? '-' : race.currentLap === 0 ? '' : formatGap(gapToLeader(race, car))}</td>
                        <td className={cx(td, 'hidden text-right tabular text-ink-400 sm:table-cell')}>{formatLap(car.lastLap)}</td>
                        <td className={cx(td, 'hidden text-right tabular text-ink-400 md:table-cell')}>{formatLap(car.bestLap)}</td>
                        <td className={td}>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800" title={`${Math.round((1 - car.tyreWear) * 100)}% de pneu`}>
                            <div className={cx('h-full rounded-full', car.tyreWear > 0.7 ? 'bg-apex-500' : car.tyreWear > 0.45 ? 'bg-gold-400' : 'bg-go-400')} style={{ width: `${Math.max(0, (1 - car.tyreWear) * 100)}%` }} />
                          </div>
                        </td>
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
                  disabled={me?.status === 'dnf'}
                  aria-pressed={mode === m}
                  className={cx('rounded-lg border px-1 py-2 text-xs font-semibold transition-colors', mode === m ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-400 hover:border-ink-500')}
                >
                  {RACE_MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-400">{RACE_MODE_DESCRIPTIONS[mode]}</p>
            {me && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-800 pt-4 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wider text-ink-400">Posição</dt><dd className="font-display text-2xl font-bold tabular">{me.status === 'dnf' ? 'AB' : myIndex + 1}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-ink-400">Pneus</dt><dd className="font-display text-2xl font-bold tabular">{Math.round((1 - me.tyreWear) * 100)}%</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-ink-400">À frente</dt><dd className="tabular">{ahead && me.status === 'running' && race.currentLap > 0 ? `${(me.totalTime - ahead.totalTime).toFixed(2)}s · ${drivers[ahead.driverId]?.lastName}` : '-'}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-ink-400">Atrás</dt><dd className="tabular">{behind && behind.status === 'running' && me.status === 'running' && race.currentLap > 0 ? `${(behind.totalTime - me.totalTime).toFixed(2)}s · ${drivers[behind.driverId]?.lastName}` : '-'}</dd></div>
              </dl>
            )}
          </Card>

          <Card title="Acontecimentos" padded={false}>
            <ul className="max-h-[360px] space-y-0 overflow-y-auto">
              {recentEvents.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">Os karts estão alinhados no grid.</li>}
              {recentEvents.map((e, i) => (
                <li key={`${race.events.length - i}`} className={cx('flex gap-3 border-t border-ink-800 px-4 py-2 text-sm first:border-t-0', i === 0 && 'animate-flash', (e.driverId === player.id || e.otherDriverId === player.id) && 'bg-apex-500/8')}>
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
