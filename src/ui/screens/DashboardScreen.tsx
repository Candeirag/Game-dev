import { Link, useNavigate } from 'react-router-dom';
import { DNF_LABELS } from '@/domain/labels';
import { getTrack, raceLaps } from '@/data/tracks';
import { fullName, getNextEvent, isSeasonComplete, netWorth, overallRating, playerAvailability } from '@/engine';
import { EventsPanel } from '../components/EventsPanel';
import { TrainingFocusPicker } from '../components/TrainingFocusPicker';
import { Button, Card, Meter, PageHeader, Pill, PositionBadge, Stat, TeamSwatch, WeatherBadge, cx } from '../components/ui';
import { describeOvertaking, describePower, describeTyreWear, formatDate, formatMoney, formatRating, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';

const CATEGORY_TONE = { team: 'bg-sky-400', race: 'bg-apex-500', training: 'bg-go-400', season: 'bg-gold-400', finance: 'bg-emerald-300', contract: 'bg-purple-400', health: 'bg-rose-400', media: 'bg-sky-300', family: 'bg-pink-300', business: 'bg-amber-300' } as const;

export function DashboardScreen() {
  const { career, player, team, category, drivers, teams, driverStandings } = useCareerView();
  const navigate = useNavigate();
  const next = getNextEvent(career);
  const seasonOver = isSeasonComplete(career);
  const me = driverStandings.find((s) => s.driverId === player.id);
  const leader = driverStandings[0];
  const lastRound = career.rounds[career.rounds.length - 1];
  const lastEntry = lastRound?.race.entries.find((e) => e.driverId === player.id);
  const onTarget = me ? me.position <= team.driverTarget : false;
  const top = driverStandings.slice(0, 6);
  const showMe = me && me.position > 6;
  const availability = playerAvailability(career);

  return (
    <div>
      <PageHeader eyebrow={`${category.shortName} · ${team.name} · ${career.year}`} title={`Olá, ${player.firstName}`}>
        <span className="text-sm text-ink-400">Reputação <b className="text-ink-100 tabular">{Math.floor(career.reputation)}</b>/100</span>
        <span className="text-sm text-ink-400">Patrimônio <b className={cx('tabular', netWorth(career.finance) < 0 ? 'text-apex-400' : 'text-ink-100')}>{formatMoney(netWorth(career.finance))}</b></span>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {career.status === 'retired' && (
            <Card title="Carreira encerrada"><p className="text-sm text-ink-300">Você se aposentou. O histórico, as estatísticas e as finanças continuam disponíveis para consulta.</p></Card>
          )}
          <EventsPanel />

          {career.status === 'active' && seasonOver && career.offseason && (
            <Card title={`Fim da temporada ${career.year}`} className="border-gold-400/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-ink-300">
                  Você terminou em <b className="text-ink-100">{career.offseason.playerPosition}º</b> (meta: {career.offseason.target}º). Há{' '}
                  <b className="text-ink-100">{career.offseason.offers.filter((o) => o.status === 'open').length}</b> proposta(s) para {career.year + 1}.
                </div>
                <Button variant="primary" onClick={() => navigate('/career')}>Ver propostas</Button>
              </div>
            </Card>
          )}
          {career.status === 'active' && !seasonOver && next && <NextEventCard />}

          {!availability.available && !seasonOver && (
            <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {availability.reason === 'ban' ? 'Você está suspenso da próxima etapa por pontos na licença.' : `Você está lesionado (${player.injury?.description}) e fora por ${player.injury?.roundsRemaining} etapa(s).`} O piloto reserva corre no seu lugar.
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Campeonato">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Posição" value={career.rounds.length ? `${me?.position}º` : '-'} accent />
                <Stat label="Pontos" value={me?.points ?? 0} />
                <Stat label="Para o líder" value={leader && me && career.rounds.length ? (leader.driverId === me.driverId ? 'Líder' : `-${leader.points - me.points}`) : '-'} />
              </div>
              <div className={cx('mt-4 rounded-lg border px-3 py-2 text-sm', onTarget || !career.rounds.length ? 'border-go-400/30 bg-go-400/5 text-go-400' : 'border-gold-400/30 bg-gold-400/5 text-gold-400')}>
                Meta da equipe: terminar entre os <b>{team.driverTarget}</b> primeiros.{' '}
                {career.rounds.length > 0 && (onTarget ? 'Você está dentro da meta.' : 'Hoje você está abaixo da meta.')}
              </div>
            </Card>

            <Card title="Última corrida">
              {lastRound && lastEntry ? (
                <div className="flex items-center gap-4">
                  <PositionBadge position={lastEntry.position} dnf={lastEntry.status === 'dnf'} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{getTrack(lastRound.trackId).name}</div>
                    <div className="text-sm text-ink-400">
                      Largou em {lastEntry.grid}º ·{' '}
                      {lastEntry.status === 'dnf' ? `Abandono (${DNF_LABELS[lastEntry.dnfReason ?? 'crash']})` : `${lastEntry.points} pts`} ·{' '}
                      Vencedor: {drivers[lastRound.race.entries[0]?.driverId ?? '']?.lastName}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-400">{lastRound ? 'Você não disputou a última etapa.' : 'Nenhuma corrida disputada nesta temporada.'}</p>
              )}
            </Card>
          </div>

          <Card title="Condição do piloto" action={player.injury ? <Pill tone="bad">Lesionado</Pill> : undefined}>
            <div className="grid gap-5 sm:grid-cols-3">
              <Meter label="Fase" value={player.condition.form} hint="Resultados recentes. Afeta o ritmo." />
              <Meter label="Confiança" value={player.condition.confidence} hint="Menos erros e mais sucesso nas disputas." />
              <Meter label="Moral" value={player.condition.morale} hint="Regularidade e rendimento do treino." />
            </div>
            {player.injury && <p className="mt-4 text-sm text-rose-200">{player.injury.description}: {player.injury.severity === 'serious' ? 'fora' : 'rendimento reduzido'} por {player.injury.roundsRemaining} etapa(s).</p>}
          </Card>

          <Card title="Programa de treino">
            <TrainingFocusPicker />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Classificação" action={<Link to="/standings" className="text-xs font-semibold text-ink-400 hover:text-ink-100">Ver tudo →</Link>} padded={false}>
            {career.rounds.length === 0 ? (
              <p className="p-4 text-sm text-ink-400">A classificação começa a contar depois da primeira etapa.</p>
            ) : (
              <ol className="divide-y divide-ink-800">
                {top.map((s) => (
                  <StandingRow key={s.driverId} position={s.position} name={drivers[s.driverId] ? fullName(drivers[s.driverId]!) : s.driverId} color={teams[s.teamId ?? '']?.color} points={s.points} isPlayer={s.driverId === player.id} />
                ))}
                {showMe && me && <StandingRow position={me.position} name={fullName(player)} color={team.color} points={me.points} isPlayer />}
              </ol>
            )}
          </Card>

          <Card title="Mensagens" padded={false}>
            <ul className="max-h-[440px] divide-y divide-ink-800 overflow-y-auto">
              {career.inbox.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', CATEGORY_TONE[m.category])} />
                    <span className="truncate text-sm font-semibold">{m.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-ink-500">{formatDate(m.date)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-ink-300">{m.body}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Seu piloto">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{fullName(player)}</div>
                <div className="text-sm text-ink-400">{player.age} anos · {team.name}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-4xl font-bold tabular">{formatRating(overallRating(player.attributes))}</div>
                <div className="text-[11px] uppercase tracking-wider text-ink-400">Geral</div>
              </div>
            </div>
            <Link to="/driver" className="mt-3 inline-block text-sm font-semibold text-apex-400 hover:text-apex-500">Ver perfil completo →</Link>
          </Card>
        </div>
      </div>
    </div>
  );

}

function StandingRow({ position, name, color, points, isPlayer }: { position: number; name: string; color: string | undefined; points: number; isPlayer: boolean }) {
  return (
    <li className={cx('flex items-center gap-3 px-4 py-2 text-sm', isPlayer && 'bg-apex-500/10')}>
      <span className="w-5 text-right font-semibold tabular text-ink-400">{position}</span>
      <TeamSwatch team={color ? { color } : undefined} />
      <span className={cx('flex-1 truncate', isPlayer && 'font-semibold text-ink-100')}>{name}</span>
      <span className="font-semibold tabular">{points}</span>
    </li>
  );
}

function NextEventCard() {
  const { career, category } = useCareerView();
  const navigate = useNavigate();
  const next = getNextEvent(career);
  const event = career.weekend ? career.calendar.find((e) => e.round === career.weekend?.round) : next;
  if (!event) return null;
  const track = getTrack(event.trackId);
  const inProgress = career.weekend !== null;
  return (
    <section className="relative overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900">
      <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_30%,rgba(239,59,45,0.22),transparent_60%)]" />
      <div className="relative p-5 sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-apex-400">
          {inProgress ? 'Fim de semana em andamento' : 'Próxima etapa'} · Etapa {event.round} de {career.calendar.length}
        </div>
        <h2 className="mt-1 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">{track.name}</h2>
        <div className="mt-1 text-sm text-ink-300">{trackLocation(track)} · {formatDate(event.date)}</div>
        <p className="mt-3 max-w-xl text-sm text-ink-300">{track.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-ink-400">Previsão para a corrida: <WeatherBadge weather={event.weather.race} /></span>
          <span className="text-ink-400">{raceLaps(track, category)} voltas · {track.lengthMeters} m</span>
          <span className="text-ink-400">Ultrapassagem: <b className="text-ink-100">{describeOvertaking(track.overtakingDifficulty)}</b></span>
          <span className="text-ink-400">Desgaste: <b className="text-ink-100">{describeTyreWear(track.tyreWear)}</b></span>
          <span className="text-ink-400">Traçado: <b className="text-ink-100">{describePower(track.powerSensitivity)}</b></span>
        </div>
        <Button variant="primary" className="mt-5" disabled={!inProgress && career.pendingEvents.length > 0} onClick={() => navigate('/weekend')}>
          {inProgress ? 'Continuar fim de semana' : career.pendingEvents.length > 0 ? 'Resolva as decisões pendentes' : 'Ir para o fim de semana'}
        </Button>
      </div>
    </section>
  );
}
