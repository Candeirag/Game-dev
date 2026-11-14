/**
 * Painel: a tela de entrada da carreira de piloto, no visual "muro dos boxes".
 *
 * Um painel grande (a próxima etapa, com o traçado e o clima) e quatro painéis-resumo com anel
 * (piloto, equipamento, equipe e carreira) ocupam a primeira dobra. Abaixo vêm as decisões
 * pendentes, a mini-classificação, a condição com o programa de treino e as mensagens.
 *
 * Só apresentação: tudo o que aparece aqui vem do estado da carreira e de consultas do motor.
 */
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { InboxMessage } from '@/domain/schemas';
import { DNF_LABELS } from '@/domain/labels';
import { counted, pluralWord } from '@/domain/text';
import { getTrack, raceLaps } from '@/data/tracks';
import { VEHICLES } from '@/data/vehicles';
import {
  fullName,
  getNextEvent,
  isSeasonComplete,
  netWorth,
  overallRating,
  playerAvailability,
  rankTeams,
  teamStrength,
  tutorialActive,
  tutorialSteps,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CarSprite } from '../components/CarSprite';
import { CircuitMap } from '../components/CircuitMap';
import { EventsPanel } from '../components/EventsPanel';
import { TrainingFocusPicker } from '../components/TrainingFocusPicker';
import { cx } from '../components/ui';
import { describeOvertaking, describePower, describeTyreWear, formatDate, formatMoney, formatRating, trackCredit, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { Panel, Tag, type Tone } from '../kit/Panel';
import { Ring } from '../kit/Ring';
import { Gauge, NumberPlate, ResultChips, WeatherTag, type RecentResult } from '../kit/bits';
import { primaryAction, useChrome, useMediaQuery } from '../layout/chrome';

const MESSAGE_KIND: Record<InboxMessage['category'], string> = {
  team: 'Equipe',
  race: 'Corrida',
  training: 'Treino',
  season: 'Temporada',
  finance: 'Finanças',
  contract: 'Contrato',
  health: 'Saúde',
  media: 'Imprensa',
  family: 'Família',
  business: 'Negócios',
};

/** Quantas etapas recentes aparecem na mini-classificação. */
const RECENT = 3;

export function DashboardScreen() {
  const { career, player, team, teammate, category, drivers, teams, carNumbers, driverStandings, teamStandings } = useCareerView();
  const { wide } = useChrome();
  const next = getNextEvent(career);
  const seasonOver = isSeasonComplete(career);
  const raced = career.rounds.length > 0;
  const me = driverStandings.find((s) => s.driverId === player.id);
  const leader = driverStandings[0];
  const onTarget = me ? me.position <= team.driverTarget : false;
  const lastRound = career.rounds[career.rounds.length - 1];
  const lastEntry = lastRound?.race.entries.find((e) => e.driverId === player.id);

  // Resultado de cada piloto nas últimas etapas, da mais antiga para a mais recente.
  const recentRounds = career.rounds.slice(-RECENT);
  const recentOf = (driverId: string): RecentResult[] =>
    recentRounds.map((round) => {
      const entry = round.race.entries.find((e) => e.driverId === driverId);
      return { round: round.round, position: entry ? entry.position : null, dnf: entry?.status === 'dnf' };
    });

  // Onde o piloto e o equipamento estão no grid (titulares da categoria).
  const starters = career.drivers.filter((d) => d.teamId !== null && d.role !== 'reserve');
  const overall = overallRating(player.attributes);
  const driverRank = 1 + starters.filter((d) => d.id !== player.id && overallRating(d.attributes) > overall).length;
  const ranked = rankTeams(career.teams);
  const carRank = 1 + ranked.findIndex((t) => t.id === team.id);
  const teamRow = teamStandings.find((s) => s.teamId === team.id);
  const machine = category.vehicle === 'kart' ? 'Kart' : 'Carro';

  const standingsRows = driverStandings.slice(0, 4);
  const showMe = me !== undefined && me.position > 4;
  const targetTone: Tone = !raced ? 'neutral' : onTarget ? 'good' : 'attention';
  // Anel menor quando os quatro resumos dividem pouco espaço (celular deitado).
  const ringSize = useMediaQuery('(min-width: 1024px)') ? 64 : 54;

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Painel</h1>

      {/* Primeira dobra: a próxima etapa e os quatro resumos. */}
      <div className="grid gap-3 md:grid-cols-12 landscape:grid-cols-12">
        <div className="md:col-span-6 lg:col-span-7 landscape:col-span-6 lg:landscape:col-span-7">
          {career.status === 'retired' ? (
            <Panel title="Carreira encerrada" className="h-full">
              <p className="text-sm text-ink-300">Você se aposentou. O histórico, as estatísticas e as finanças continuam disponíveis para consulta.</p>
            </Panel>
          ) : seasonOver ? (
            <SeasonOverPanel />
          ) : next || career.weekend ? (
            <NextEventPanel />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:col-span-6 lg:col-span-5 landscape:col-span-6 lg:landscape:col-span-5">
          <SummaryCard to="/driver" title="Piloto" ring={<Ring value={formatRating(overall)} label="Geral" fraction={overall / 100} size={ringSize} />}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <NumberPlate number={carNumbers[player.id]} color={team.color} />
              <span className="min-w-0 truncate text-sm font-semibold">{player.lastName}</span>
            </div>
            <div className="mt-1.5 text-xs leading-tight text-ink-400">
              {driverRank}º do grid · {player.age} anos
            </div>
          </SummaryCard>

          <SummaryCard
            to="/team"
            title={machine}
            ring={<Ring value={Math.round(teamStrength(team))} label="Nota" fraction={teamStrength(team) / 100} size={ringSize} />}
          >
            <CarSprite
              categoryId={category.id}
              teamId={team.id}
              color={team.color}
              driverId={player.id}
              number={carNumbers[player.id]}
              className="w-full max-w-28"
            />
            <div className="mt-1 text-xs leading-tight text-ink-400">
              {carRank}º do grid<span className="max-lg:hidden"> · {VEHICLES[category.id].name}</span>
            </div>
          </SummaryCard>

          <SummaryCard
            to="/team"
            title="Equipe"
            ring={
              <Ring
                value={raced && teamRow ? `${teamRow.position}º` : '–'}
                label="Equipes"
                fraction={raced && teamRow ? 1 - (teamRow.position - 1) / Math.max(1, teamStandings.length) : 0}
                size={ringSize}
              />
            }
          >
            <div className="flex gap-2">
              <span aria-hidden className="mt-0.5 h-4 w-1 shrink-0" style={{ backgroundColor: team.color }} />
              <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-tight">{team.name}</span>
            </div>
            <div className="mt-1.5 truncate text-xs leading-tight text-ink-400">{teammate ? `Com ${teammate.lastName}` : 'Sem companheiro'}</div>
          </SummaryCard>

          <SummaryCard
            to="/career"
            title="Carreira"
            ring={
              <Ring
                value={raced && me ? `${me.position}º` : '–'}
                label="Geral"
                tone={targetTone}
                fraction={raced && me ? 1 - (me.position - 1) / Math.max(1, driverStandings.length) : 0}
                size={ringSize}
              />
            }
          >
            <div className="font-display text-xl font-semibold leading-none">
              {me?.points ?? 0} <span className="text-sm font-medium text-ink-400">{pluralWord(me?.points ?? 0, 'ponto', 'pontos')}</span>
            </div>
            <div
              className={cx(
                'mt-1.5 text-xs leading-tight',
                targetTone === 'good' ? 'text-go-400' : targetTone === 'attention' ? 'text-gold-400' : 'text-ink-400',
              )}
            >
              {raced ? (onTarget ? 'Dentro da meta' : 'Abaixo da meta') : 'Meta'}: {team.driverTarget}º
            </div>
          </SummaryCard>
        </div>
      </div>

      {tutorialActive(career) && <TutorialStrip />}

      <div id="decisoes" className="scroll-mt-16 empty:hidden">
        <EventsPanel />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel
          title="Classificação"
          flush
          action={
            <Link to="/standings" className="-my-1 flex min-h-11 items-center gap-0.5 text-xs font-semibold text-ink-300 hover:text-ink-100">
              Tabela completa <ChevronRight size={14} aria-hidden />
            </Link>
          }
        >
          {!raced ? (
            <p className="p-4 text-sm text-ink-400">A classificação começa a contar depois da primeira etapa.</p>
          ) : (
            <>
              <ol>
                {standingsRows.map((s) => (
                  <StandingRow
                    key={s.driverId}
                    position={s.position}
                    name={drivers[s.driverId] ? fullName(drivers[s.driverId]!) : s.driverId}
                    color={teams[s.teamId ?? '']?.color}
                    points={s.points}
                    recent={recentOf(s.driverId)}
                    isPlayer={s.driverId === player.id}
                  />
                ))}
                {showMe && me && (
                  <StandingRow
                    position={me.position}
                    name={fullName(player)}
                    color={team.color}
                    points={me.points}
                    recent={recentOf(player.id)}
                    isPlayer
                    separated
                  />
                )}
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink-700 px-4 py-2.5 text-xs text-ink-400">
                <span>
                  {leader && me
                    ? leader.driverId === me.driverId
                      ? 'Você lidera o campeonato'
                      : `${leader.points - me.points} ${pluralWord(leader.points - me.points, 'ponto', 'pontos')} atrás do líder`
                    : ''}
                </span>
                {lastRound && (
                  <span>
                    Última etapa:{' '}
                    <b className="font-semibold text-ink-200">
                      {lastEntry
                        ? lastEntry.status === 'dnf'
                          ? `abandono (${DNF_LABELS[lastEntry.dnfReason ?? 'crash'].toLowerCase()})`
                          : `${lastEntry.position}º, largando em ${lastEntry.grid}º`
                        : 'não disputou'}
                    </b>
                  </span>
                )}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Condição e treino" action={player.injury ? <Tag tone="attention">Lesionado</Tag> : undefined}>
          <div className="space-y-2.5">
            <Gauge label="Fase" value={player.condition.form} />
            <Gauge label="Confiança" value={player.condition.confidence} />
            <Gauge label="Moral" value={player.condition.morale} />
          </div>
          {player.injury && (
            <p className="mt-3 text-sm text-gold-400">
              {player.injury.description}: {player.injury.severity === 'serious' ? 'fora' : 'rendimento reduzido'} por{' '}
              {counted(player.injury.roundsRemaining, 'etapa', 'etapas')}.
            </p>
          )}
          <div className="mt-4 border-t border-ink-700 pt-4">
            <TrainingFocusPicker />
          </div>
        </Panel>

        <Panel
          title="Mensagens"
          flush
          action={
            <span className="text-xs text-ink-400">
              Patrimônio{' '}
              <b className={cx('font-display text-base font-semibold', netWorth(career.finance) < 0 ? 'text-gold-400' : 'text-ink-100')}>
                {formatMoney(netWorth(career.finance))}
              </b>
            </span>
          }
        >
          <ul className="max-h-[30rem] divide-y divide-ink-700/70 overflow-y-auto">
            {career.inbox.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-400">
                    {MESSAGE_KIND[m.category]} · {formatDate(m.date)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug text-ink-300">{m.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {!wide && <div aria-hidden className="h-1" />}
    </div>
  );
}

/** Painel-resumo: um anel de nota ou posição e duas linhas do que importa. O painel inteiro abre a tela da área. */
function SummaryCard({ to, title, ring, children }: { to: string; title: string; ring: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="group block focus-visible:outline-offset-0" aria-label={`${title}: abrir`}>
      <Panel
        title={title}
        className="h-full transition-colors group-hover:bg-ink-500"
        bodyClassName="flex items-center gap-2.5 !p-2.5 lg:gap-3 lg:!p-3"
        action={<ChevronRight size={16} aria-hidden className="text-ink-500 transition-colors group-hover:text-ink-100" />}
      >
        {ring}
        <div className="min-w-0 flex-1">{children}</div>
      </Panel>
    </Link>
  );
}

function StandingRow({
  position,
  name,
  color,
  points,
  recent,
  isPlayer,
  separated = false,
}: {
  position: number;
  name: string;
  color: string | undefined;
  points: number;
  recent: readonly RecentResult[];
  isPlayer: boolean;
  separated?: boolean;
}) {
  return (
    <li
      className={cx(
        'relative flex min-h-11 items-center gap-3 px-4 text-sm',
        isPlayer ? 'bg-apex-500/12' : '',
        separated ? 'border-t-2 border-dashed border-ink-700' : 'border-t border-ink-700/70 first:border-t-0',
      )}
    >
      {isPlayer && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-apex-500" />}
      <span className="w-6 text-right font-display text-xl font-semibold leading-none text-ink-300">{position}</span>
      <span aria-hidden className="h-4 w-1 shrink-0" style={{ backgroundColor: color ?? '#626e7f' }} />
      <span className={cx('min-w-0 flex-1 truncate', isPlayer && 'font-semibold')}>{name}</span>
      <ResultChips results={recent} className="max-[420px]:hidden" />
      <span className="w-9 text-right font-display text-xl font-semibold leading-none">{points}</span>
    </li>
  );
}

/** Primeiros passos: uma linha só, com o próximo passo. É o único ponto de ajuda desta tela. */
function TutorialStrip() {
  const { career } = useCareerView();
  const navigate = useNavigate();
  const dismiss = useGameStore((s) => s.dismissTutorial);
  const steps = tutorialSteps(career);
  const done = steps.filter((s) => s.done).length;
  const step = steps.find((s) => !s.done);
  if (!step) return null;
  return (
    <div className="chamfer bg-ink-700 p-px">
      <div className="chamfer flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink-900 py-2 pl-4 pr-2">
        <span className="font-display text-[15px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-200">
          Primeiros passos{' '}
          <span className="text-ink-400">
            {done}/{steps.length}
          </span>
        </span>
        <span className="min-w-0 flex-1 basis-56 text-sm text-ink-300">
          <b className="font-semibold text-ink-100">{step.title}.</b> {step.text}
        </span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => navigate(step.route)}
            className="min-h-11 min-w-11 bg-ink-700 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-600"
          >
            Ir
          </button>
          <button type="button" onClick={dismiss} className="min-h-11 px-3 text-sm font-semibold text-ink-400 hover:text-ink-100">
            Dispensar
          </button>
        </span>
      </div>
    </div>
  );
}

/** Fim de temporada: o resultado do ano e as propostas para o próximo. */
function SeasonOverPanel() {
  const { career } = useCareerView();
  const off = career.offseason;
  const open = off ? off.offers.filter((o) => o.status === 'open').length : 0;
  return (
    <Panel title={`Fim da temporada ${career.year}`} className="h-full" bodyClassName="stripes flex h-full flex-col justify-center">
      {off ? (
        <>
          <div className="font-display text-5xl font-bold leading-none">
            {off.playerPosition}º <span className="text-xl font-medium text-ink-400">no campeonato</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag tone={off.objectiveMet ? 'good' : 'attention'}>
              Meta: {off.target}º · {off.objectiveMet ? 'cumprida' : 'não cumprida'}
            </Tag>
            <Tag>
              {counted(open, 'proposta', 'propostas')} para {career.year + 1}
            </Tag>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-300">A temporada terminou. Feche o ano na tela Carreira.</p>
      )}
      <AdvanceInPlace />
    </Panel>
  );
}

/** Painel principal: a próxima etapa, com o traçado da pista em destaque e a previsão do tempo. */
function NextEventPanel() {
  const { career, category, player } = useCareerView();
  const next = getNextEvent(career);
  const event = career.weekend ? career.calendar.find((e) => e.round === career.weekend?.round) : next;
  if (!event) return null;
  const track = getTrack(event.trackId);
  const inProgress = career.weekend !== null;
  const availability = playerAvailability(career);
  const credit = trackCredit(track.id);
  return (
    <section className="chamfer h-full bg-ink-700 p-px [--chamfer:18px]" aria-label={inProgress ? 'Fim de semana em andamento' : 'Próxima etapa'}>
      <div className="chamfer relative flex h-full min-h-[17.5rem] flex-col overflow-hidden bg-ink-900 [--chamfer:18px]">
        {/* O traçado ocupa o lado direito, sobre uma grade de prancheta. */}
        <div aria-hidden className="gridlines absolute inset-y-0 right-0 w-[58%] [mask-image:linear-gradient(to_right,transparent,black_35%)]" />
        <div aria-hidden className="stripes absolute -right-8 top-0 h-full w-24 -skew-x-12 opacity-70" />
        <CircuitMap track={track} style={category.vehicle} className="pointer-events-none absolute right-3 top-3 h-[calc(100%-5.25rem)] w-[44%]" />

        <div className="relative flex min-h-0 flex-1 flex-col p-4 pr-[48%]">
          <div className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-ink-300">
            <span className="h-3 w-1 shrink-0 bg-apex-500" aria-hidden />
            {inProgress ? 'Em andamento' : 'Próxima etapa'}
            <span className="font-normal text-ink-400">
              {event.round} de {career.calendar.length}
            </span>
          </div>
          <h2 className="mt-2 font-display text-[clamp(1.6rem,3.1vw,2.75rem)] font-bold uppercase leading-[0.95] tracking-wide">{track.name}</h2>
          <div className="mt-1.5 text-sm text-ink-300">
            {trackLocation(track)} · {formatDate(event.date).replace(/ \d{4}$/, '')}
          </div>
          <p className="mt-3 hidden max-w-md text-sm leading-snug text-ink-400 xl:block">{track.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <WeatherTag weather={event.weather.race} />
            <span className="text-xs text-ink-400">previsão para a corrida</span>
          </div>
          {!availability.available && (
            <Tag tone="attention" className="mt-3 !items-start whitespace-normal py-1.5 leading-snug">
              {availability.reason === 'ban'
                ? 'Você está suspenso desta etapa por pontos na licença.'
                : `Lesionado (${player.injury?.description}): fora por ${counted(player.injury?.roundsRemaining ?? 0, 'etapa', 'etapas')}.`}{' '}
              O reserva corre no seu lugar.
            </Tag>
          )}
          <AdvanceInPlace />
        </div>

        {/* Ficha da pista, de ponta a ponta. */}
        <dl className="relative grid shrink-0 grid-cols-4 divide-x divide-ink-700 border-t border-ink-700 bg-ink-800/90 text-center">
          <Fact label="Voltas" value={raceLaps(track, category)} />
          <Fact label="Ultrapassar" value={describeOvertaking(track.overtakingDifficulty)} />
          <Fact label="Desgaste" value={describeTyreWear(track.tyreWear)} />
          <Fact label="Favorece" value={describePower(track.powerSensitivity).replace('favorece o ', '')} />
        </dl>
        {credit && <span className="pointer-events-none absolute bottom-[3.25rem] right-3 text-[9px] leading-none text-ink-500">Traçado: {credit}</span>}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-1 py-1.5">
      <dt className="text-[10px] font-medium text-ink-400">{label}</dt>
      <dd className="truncate font-display text-base font-semibold leading-tight first-letter:uppercase">{value}</dd>
    </div>
  );
}

/** Com a tela em pé não há barra superior com o botão de avançar: ele aparece dentro do painel principal. */
function AdvanceInPlace() {
  const { career } = useCareerView();
  const { wide } = useChrome();
  const navigate = useNavigate();
  const action = primaryAction(career);
  if (wide || !action) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (action.anchor) document.getElementById(action.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else navigate(action.to);
      }}
      className={cx(
        'chamfer-br mt-4 flex min-h-11 w-fit items-center gap-1.5 pl-4 pr-3 font-display text-lg font-semibold uppercase leading-none tracking-wide [--chamfer:10px]',
        action.tone === 'attention' ? 'bg-gold-400 text-ink-950' : 'bg-apex-500 text-white',
      )}
    >
      {action.label}
      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
