import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRACTICE_PROGRAMS, QUALIFYING_APPROACHES, type PracticeProgram, type QualifyingApproach, type RoundRecord } from '@/domain/schemas';
import {
  PRACTICE_PROGRAM_DESCRIPTIONS,
  PRACTICE_PROGRAM_LABELS,
  QUALIFYING_APPROACH_DESCRIPTIONS,
  QUALIFYING_APPROACH_LABELS,
} from '@/domain/labels';
import { getTrack, raceLaps } from '@/data/tracks';
import { buildWetnessProfile, fullName, getNextEvent, isSeasonComplete, playerAvailability, playerStrategyOptions, sessionSeed } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { EventsPanel } from '../components/EventsPanel';
import { RaceResultTable } from '../components/RaceResultTable';
import { RaceView } from '../components/RaceView';
import { Button, Card, ChoiceCard, EmptyState, PageHeader, Pill, TableWrap, TeamSwatch, WeatherBadge, cx, td, th } from '../components/ui';
import { describeOvertaking, describeTyreWear, formatDate, formatLap, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';

const STEPS = [
  { key: 'practice', label: 'Treino livre' },
  { key: 'qualifying', label: 'Classificação' },
  { key: 'race', label: 'Corrida' },
] as const;

export function WeekendScreen() {
  const { career, player, category } = useCareerView();
  const liveRace = useGameStore((s) => s.liveRace);
  const startWeekend = useGameStore((s) => s.startWeekend);
  const simulateAbsentWeekend = useGameStore((s) => s.simulateAbsentWeekend);
  const navigate = useNavigate();
  const weekend = career.weekend;
  const event = weekend ? career.calendar.find((e) => e.round === weekend.round) : getNextEvent(career);
  const lastRound = career.rounds[career.rounds.length - 1];

  if (career.status === 'retired') {
    return <EmptyState title="Carreira encerrada">Você se aposentou. Consulte o histórico e as estatísticas nas outras telas.</EmptyState>;
  }

  if (!weekend) {
    const availability = playerAvailability(career);
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Fim de semana" title={event ? `Etapa ${event.round}` : 'Temporada encerrada'} />
        <EventsPanel />
        {lastRound && <RoundSummary record={lastRound} />}
        {event ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">Próxima etapa · {formatDate(event.date)}</div>
                <div className="font-display text-2xl font-bold uppercase">{getTrack(event.trackId).name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink-400">Previsão: <WeatherBadge weather={event.weather.race} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {availability.available ? (
                  <>
                    <Button variant="primary" disabled={career.pendingEvents.length > 0} onClick={() => startWeekend()}>
                      {availability.canRest ? 'Correr mesmo lesionado' : 'Iniciar fim de semana'}
                    </Button>
                    {availability.canRest && <Button disabled={career.pendingEvents.length > 0} onClick={() => startWeekend({ rest: true })}>Descansar e ceder a vaga ao reserva</Button>}
                  </>
                ) : (
                  <Button variant="primary" disabled={career.pendingEvents.length > 0} onClick={() => startWeekend()}>Acompanhar a etapa dos boxes</Button>
                )}
              </div>
            </div>
            {!availability.available && (
              <p className="mt-3 text-sm text-rose-200">
                {availability.reason === 'ban' ? 'Você está suspenso desta etapa por pontos na licença.' : `Você está fora por lesão (${player.injury?.description}).`} O piloto reserva corre no seu lugar.
              </p>
            )}
            {availability.canRest && (
              <p className="mt-3 text-sm text-ink-400">
                Lesão leve ({player.injury?.description}): correndo, você perde rendimento e erra mais. Descansando, não pontua, mas não arrisca um resultado ruim.
              </p>
            )}
            {career.pendingEvents.length > 0 && <p className="mt-3 text-sm text-gold-400">Resolva as decisões pendentes acima para liberar o fim de semana.</p>}
          </Card>
        ) : (
          isSeasonComplete(career) && (
            <EmptyState title="Todas as etapas foram disputadas">
              Veja o fechamento da temporada e as propostas na tela Carreira.
              <div className="mt-4"><Button variant="primary" onClick={() => navigate('/career')}>Ver propostas</Button></div>
            </EmptyState>
          )
        )}
      </div>
    );
  }

  if (!event) return null;
  const track = getTrack(event.trackId);
  const activeIndex = STEPS.findIndex((s) => s.key === weekend.phase);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${category.shortName} · Etapa ${event.round} de ${career.calendar.length} · ${formatDate(event.date)}`} title={track.name}>
        <span className="text-sm text-ink-400">{trackLocation(track)} · {raceLaps(track, category)} voltas</span>
      </PageHeader>

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, i) => {
          const weather = event.weather[step.key];
          return (
            <li key={step.key} className={cx('rounded-lg border px-3 py-2.5', i === activeIndex ? 'border-apex-500 bg-apex-500/10' : i < activeIndex ? 'border-ink-700 bg-ink-900' : 'border-ink-800 bg-ink-950 opacity-70')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">{i < activeIndex ? '✓ ' : ''}{step.label}</span>
                <span className="hidden sm:inline"><WeatherBadge weather={weather} compact /></span>
              </div>
            </li>
          );
        })}
      </ol>

      {!weekend.playerParticipates ? (
        <Card title="Você não disputa esta etapa">
          <p className="text-sm text-ink-300">O piloto reserva da equipe corre no seu lugar. A etapa será simulada por inteiro, e você acompanha o resultado.</p>
          <Button variant="primary" className="mt-4" onClick={simulateAbsentWeekend}>Simular a etapa</Button>
        </Card>
      ) : (
        <>
          {weekend.phase === 'practice' && <PracticePhase />}
          {weekend.phase === 'qualifying' && <QualifyingPhase />}
          {weekend.phase === 'race' && (liveRace ? <RaceView /> : <PreRacePhase />)}
        </>
      )}
    </div>
  );
}

function PracticePhase() {
  const { career } = useCareerView();
  const runPractice = useGameStore((s) => s.runPractice);
  const [program, setProgram] = useState<PracticeProgram>('setup');
  const event = career.calendar.find((e) => e.round === career.weekend?.round);
  if (!event) return null;
  const track = getTrack(event.trackId);
  return (
    <Card title="Programa do treino livre">
      <p className="mb-4 text-sm text-ink-400">
        O treino define o trabalho do fim de semana. Esta pista tem desgaste de pneus {describeTyreWear(track.tyreWear)}, ultrapassagem {describeOvertaking(track.overtakingDifficulty)} e clima previsto para o treino:{' '}
        <WeatherBadge weather={event.weather.practice} />
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {PRACTICE_PROGRAMS.map((p) => (
          <ChoiceCard key={p} selected={program === p} onSelect={() => setProgram(p)} title={PRACTICE_PROGRAM_LABELS[p]} description={PRACTICE_PROGRAM_DESCRIPTIONS[p]} />
        ))}
      </div>
      <Button variant="primary" className="mt-5" onClick={() => runPractice(program)}>Disputar treino livre</Button>
    </Card>
  );
}

function QualifyingPhase() {
  const { career, player, drivers, teams, category } = useCareerView();
  const runQualifying = useGameStore((s) => s.runQualifying);
  const [approach, setApproach] = useState<QualifyingApproach>('balanced');
  const practice = career.weekend?.practice;
  if (!practice) return null;
  const mine = practice.entries.find((e) => e.driverId === player.id);
  const myPos = practice.entries.findIndex((e) => e.driverId === player.id) + 1;
  const best = practice.entries[0]?.bestLap ?? 0;
  const gridPenalty = career.gridPenalties[player.id] ?? 0;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card title="Resultado do treino livre" padded={false}>
        {mine && (
          <div className="grid grid-cols-3 gap-4 border-b border-ink-800 p-4">
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Sua posição</div><div className="font-display text-2xl font-bold tabular">{myPos}º</div></div>
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Qualidade do acerto</div><div className="font-display text-2xl font-bold tabular">{Math.round(mine.modifiers.setupScore * 100)}%</div></div>
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Programa</div><div className="text-sm font-semibold">{PRACTICE_PROGRAM_LABELS[mine.program]}</div></div>
          </div>
        )}
        <div className="max-h-[420px] overflow-y-auto px-4">
          <TableWrap>
            <table className="w-full">
              <thead className="sticky top-0 bg-ink-900"><tr><th className={th}>#</th><th className={th}>Piloto</th><th className={cx(th, 'text-right')}>Melhor volta</th><th className={cx(th, 'text-right')}>Dif.</th></tr></thead>
              <tbody>
                {practice.entries.map((e, i) => (
                  <tr key={e.driverId} className={cx('border-t border-ink-800', e.driverId === player.id && 'bg-apex-500/10')}>
                    <td className={cx(td, 'tabular text-ink-400')}>{i + 1}</td>
                    <td className={td}><span className="flex items-center gap-2"><TeamSwatch team={teams[e.teamId]} />{drivers[e.driverId] ? fullName(drivers[e.driverId]!) : e.driverId}</span></td>
                    <td className={cx(td, 'text-right tabular')}>{formatLap(e.bestLap)}</td>
                    <td className={cx(td, 'text-right tabular text-ink-400')}>{i === 0 ? '' : `+${(e.bestLap - best).toFixed(3)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </Card>
      <Card title="Abordagem da classificação">
        <p className="mb-4 text-sm text-ink-400">
          {category.qualifyingFormat === 'knockout'
            ? 'Classificação eliminatória em três fases: em cada uma das duas primeiras, os cinco mais lentos são eliminados. São duas tentativas por fase.'
            : 'São 3 tentativas lançadas; vale a melhor volta.'}{' '}
          Um erro invalida a tentativa. Sua consistência é {Math.floor(player.attributes.consistency)}.
        </p>
        {gridPenalty > 0 && <p className="mb-4 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-sm text-gold-400">Você cumpre uma punição: perde {gridPenalty} posições no grid depois da classificação.</p>}
        <div className="grid gap-3">
          {QUALIFYING_APPROACHES.map((a) => (
            <ChoiceCard key={a} selected={approach === a} onSelect={() => setApproach(a)} title={QUALIFYING_APPROACH_LABELS[a]} description={QUALIFYING_APPROACH_DESCRIPTIONS[a]} />
          ))}
        </div>
        <Button variant="primary" className="mt-5" onClick={() => runQualifying(approach)}>Disputar classificação</Button>
      </Card>
    </div>
  );
}

function PreRacePhase() {
  const { career, player, drivers, teams, category } = useCareerView();
  const beginRace = useGameStore((s) => s.beginRace);
  const options = useMemo(() => playerStrategyOptions(career), [career]);
  const [selected, setSelected] = useState(0);
  const qualifying = career.weekend?.qualifying;
  const event = career.calendar.find((e) => e.round === career.weekend?.round);
  const forecast = useMemo(() => {
    if (!event || !career.weekend) return null;
    const track = getTrack(event.trackId);
    // Mesma previsão que a corrida vai usar: vem da semente da sessão.
    return buildWetnessProfile(sessionSeed(career, career.weekend.round, 'race'), track, event.weather.race, raceLaps(track, category), category.race.changingWeather).forecast;
  }, [career, event, category]);
  if (!qualifying || !event) return null;
  const pole = qualifying.entries[0]?.bestLap ?? null;
  const mine = qualifying.entries.find((e) => e.driverId === player.id);
  const rules = category.race;
  const plan = options[selected]?.plan;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card title="Grid de largada" padded={false}>
        <div className="px-4">
          <TableWrap>
            <table className="w-full">
              <thead><tr><th className={th}>Pos</th><th className={th}>Piloto</th><th className={cx(th, 'hidden sm:table-cell')}>Tentativas</th><th className={cx(th, 'text-right')}>Melhor</th><th className={cx(th, 'text-right')}>Dif.</th></tr></thead>
              <tbody>
                {qualifying.entries.map((e) => (
                  <tr key={e.driverId} className={cx('border-t border-ink-800', e.driverId === player.id && 'bg-apex-500/10')}>
                    <td className={cx(td, 'font-semibold tabular')}>{e.position}</td>
                    <td className={td}>
                      <span className="flex flex-wrap items-center gap-2">
                        <TeamSwatch team={teams[e.teamId]} />{drivers[e.driverId] ? fullName(drivers[e.driverId]!) : e.driverId}
                        {e.eliminatedIn && <Pill>{e.eliminatedIn}</Pill>}
                        {e.gridPenalty > 0 && <Pill tone="warn">−{e.gridPenalty} pos.</Pill>}
                      </span>
                    </td>
                    <td className={cx(td, 'hidden text-xs tabular text-ink-400 sm:table-cell')}>{e.attempts.map((t) => (t === null ? '✕' : formatLap(t))).join(' · ')}</td>
                    <td className={cx(td, 'text-right tabular')}>{formatLap(e.bestLap)}</td>
                    <td className={cx(td, 'text-right tabular text-ink-400')}>{e.position === 1 || e.bestLap === null || pole === null || e.eliminatedIn ? '' : `+${(e.bestLap - pole).toFixed(3)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </Card>

      <div className="space-y-6">
        {rules.pitStops && (
          <Card title="Estratégia de pneus">
            <p className="mb-3 text-sm text-ink-400">
              {rules.mandatoryTwoCompounds ? 'No seco, é obrigatório usar dois compostos diferentes. ' : ''}
              A perda estimada soma desgaste, ritmo de cada composto e tempo de box; quanto menor, melhor. As paradas planejadas acontecem sozinhas, e você pode mudar o plano durante a corrida.
            </p>
            <div className="grid gap-2">
              {options.map((o, i) => (
                <ChoiceCard key={o.id} selected={selected === i} onSelect={() => setSelected(i)} title={o.label} description={options.length > 1 ? `Perda estimada: ${o.estimatedLoss.toFixed(1)}s${i === 0 ? ' (a mais rápida no papel)' : ` (+${(o.estimatedLoss - (options[0]?.estimatedLoss ?? 0)).toFixed(1)}s)`}` : 'Reaja às condições da pista durante a corrida.'} />
              ))}
            </div>
          </Card>
        )}
        <Card title="Antes da largada">
          {mine && (
            <p className="text-sm text-ink-300">
              Você larga em <b className="text-ink-100">{mine.position}º</b>
              {mine.attempts.some((t) => t === null) && `, com ${mine.attempts.filter((t) => t === null).length} tentativa(s) invalidada(s)`}.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-400">
            Largada: <WeatherBadge weather={event.weather.race} />
            {forecast && forecast.kind !== 'stable' && <span className="text-rain-400">{forecast.kind === 'rain' ? 'Risco de chuva' : 'Pista deve secar'} por volta da volta {forecast.aroundLap}.</span>}
            {forecast && forecast.kind === 'stable' && rules.changingWeather && <span>Sem mudança prevista.</span>}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-400">
            <li>O ritmo de pilotagem pode ser trocado a cada volta.</li>
            {rules.fuel && <li>O combustível é contado: atacar o tempo todo acaba com o tanque antes do fim.</li>}
            {rules.safetyCar && <li>Acidentes podem trazer safety car{rules.virtualSafetyCar ? ', safety car virtual' : ''}{rules.redFlag ? ' ou bandeira vermelha' : ''}.</li>}
            {rules.teamOrders && <li>A equipe pode pedir que você ceda a posição ao companheiro.</li>}
          </ul>
          <Button variant="primary" className="mt-5 h-12 w-full text-base" onClick={() => beginRace(plan)}>Ir para a largada</Button>
        </Card>
      </div>
    </div>
  );
}

function RoundSummary({ record }: { record: RoundRecord }) {
  const { player } = useCareerView();
  const mine = record.race.entries.find((e) => e.driverId === player.id);
  return (
    <Card title={`Resultado da etapa ${record.round} · ${getTrack(record.trackId).name}`} padded={false}>
      <div className="border-b border-ink-800 p-4 text-sm text-ink-300">
        {mine ? (
          <>Você {mine.status === 'finished' ? <>terminou em <b className="text-ink-100">{mine.position}º</b></> : 'abandonou'}, largando em {mine.grid}º, e somou <b className="text-ink-100">{mine.points}</b> ponto(s).</>
        ) : (
          'Você não disputou esta etapa.'
        )}
      </div>
      <div className="px-4"><RaceResultTable result={record.race} /></div>
    </Card>
  );
}
