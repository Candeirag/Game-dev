/**
 * Telas do modo dirigente: painel, fim de semana e decisões de fim de
 * temporada. O jogador não corre; ele decide a estrutura, os pilotos e o rumo
 * da equipe (ou só investe e acompanha).
 *
 * Layout pensado para a tela deitada (844×390): duas colunas a partir de `md:` e abas
 * guardadas no endereço (`?tab=`) onde o conteúdo passa de duas alturas de tela.
 */
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CATEGORY_IDS,
  PRACTICE_PROGRAMS,
  QUALIFYING_APPROACHES,
  type CategoryId,
  type PracticeProgram,
  type QualifyingApproach,
  type TransitionRole,
} from '@/domain/schemas';
import { PRACTICE_PROGRAM_LABELS, QUALIFYING_APPROACH_LABELS } from '@/domain/labels';
import { TOP_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import { amongTheFirst, counted } from '@/domain/text';
import { getCategory } from '@/data/categories';
import { MANAGEMENT, REGULATIONS } from '@/data/management';
import { getTrack } from '@/data/tracks';
import { TRANSITION_ROLE_INFO } from '@/data/transition';
import {
  activeTransition,
  executiveStanding,
  favoritismNote,
  foundingCost,
  fullName,
  getNextEvent,
  isSeasonComplete,
  managedTeam,
  managedTeamPosition,
  netWorth,
  ownedTeamValue,
  teamBudgetForecast,
  transitionOffers,
  transitionWindow,
  tutorialActive,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { CircuitMap } from '../components/CircuitMap';
import { EventsPanel } from '../components/EventsPanel';
import { RaceResultTable } from '../components/RaceResultTable';
import {
  Button,
  Card,
  Check,
  Chip,
  ChoiceCard,
  cx,
  EmptyState,
  PageHeader,
  Pill,
  PositionBadge,
  Stat,
  TableWrap,
  Tabs,
  td,
  TeamSwatch,
  th,
  WeatherBadge,
} from '@/ui/kit';
import { formatDate, formatMoney, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { useChrome } from '../layout/chrome';
import { ScreenAction } from '../layout/ScreenAction';
import { RaceBroadcast } from '../race/RaceBroadcast';
import { TutorialCard } from './HelpScreen';
import { ExportReminder } from '../components/SaveNotices';
import { TransitionOfferChoices, TransitionPanel, transitionLaterText } from './executive/Transition';

/** Campo de formulário: reto, com 44 px de altura para o toque. */
const field = 'min-h-11 border border-ink-500 bg-ink-850 px-2 text-sm text-ink-100 focus:border-apex-500 focus:outline-none';
/** Ação discreta na barra de título de um cartão (a área de toque passa da barra, sem aumentá-la). */
const headerLink = '-my-1 flex min-h-11 items-center gap-1 text-xs font-semibold text-ink-300 transition-colors hover:text-ink-100';
/** Rótulo pequeno acima de um grupo de opções. */
const groupLabel = 'text-2xs font-semibold uppercase tracking-wider text-ink-400';

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export function ExecutiveDashboardScreen() {
  const { career, player, category, teams, teamStandings } = useCareerView();
  const navigate = useNavigate();
  const { wide } = useChrome();
  const m = career.management;
  const team = managedTeam(career);
  const next = getNextEvent(career);
  const seasonOver = isSeasonComplete(career);
  const position = managedTeamPosition(career);
  const lineup = m ? career.drivers.filter((d) => d.teamId === m.teamId && d.role !== 'reserve') : [];
  const racing = career.family.children.filter((c) => c.stage === 'racing' && c.racing);
  const track = next ? getTrack(next.trackId) : null;
  const pending = career.pendingEvents.length > 0;
  const transition = activeTransition(career);
  const offerWindow = transitionWindow(career);
  const later = transitionLaterText(career);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={`${category.shortName} · ${team ? team.name : 'Sem equipe'} · ${career.year}`} title={`Olá, ${player.firstName}`}>
        <span className="text-sm text-ink-400">
          Reputação <b className="tabular text-ink-100">{Math.floor(career.reputation)}</b>/100
        </span>
        <span className="text-sm text-ink-400">
          Patrimônio <b className="tabular text-ink-100">{formatMoney(netWorth(career.finance) + ownedTeamValue(career))}</b>
        </span>
      </PageHeader>

      {tutorialActive(career) && <TutorialCard />}
      {/* O botão de avançar (na barra do pé da tela) rola até aqui quando há decisões pendentes. */}
      <div id="decisoes" className="scroll-mt-16 empty:hidden">
        <EventsPanel />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {seasonOver && career.executiveOffseason && (
            <Card title={`Fim da temporada ${career.year}`} tone="attention">
              <p className="text-sm text-ink-300">
                {career.executiveOffseason.teamPosition !== null
                  ? `A equipe terminou em ${career.executiveOffseason.teamPosition}º (meta: ${career.executiveOffseason.target}º). `
                  : ''}
                {offerWindow === 'closing'
                  ? 'Decida o rumo da próxima temporada: o ano de transição, as propostas de cargo e as equipes à venda.'
                  : 'Decida o rumo da próxima temporada: pilotos, patrocinadores, propostas de cargo e equipes à venda.'}
              </p>
              {/* No formato largo, o botão de avançar (na barra do pé da tela) já leva à tela Carreira. */}
              {!wide && (
                <Button variant="primary" className="mt-4" onClick={() => navigate('/career')}>
                  Decidir a próxima temporada
                </Button>
              )}
            </Card>
          )}

          {!seasonOver && next && track && (
            <section className="chamfer bg-ink-700 p-px" aria-label="Próxima etapa">
              <div className="chamfer flex items-center gap-4 bg-ink-900 py-2 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-300">
                    <span className="h-3 w-1 shrink-0 bg-apex-500" aria-hidden />
                    Próxima etapa
                    <span className="font-normal text-ink-400">
                      Etapa {next.round} de {career.calendar.length}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-[clamp(1.5rem,3vw,2.5rem)] font-bold uppercase leading-[0.95] tracking-wide">{track.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-300">
                    <span>
                      {trackLocation(track)} · {formatDate(next.date)}
                    </span>
                    <WeatherBadge weather={next.weather.race} />
                  </div>
                  {!wide && (
                    <Button variant="primary" className="mt-4" disabled={pending} onClick={() => navigate('/weekend')}>
                      {pending ? 'Resolva as decisões pendentes' : m ? 'Ir para o muro dos boxes' : 'Acompanhar a etapa'}
                    </Button>
                  )}
                </div>
                <CircuitMap track={track} style={category.vehicle} className="h-20 w-[min(32%,9rem)] shrink-0" />
              </div>
            </section>
          )}

          {m && team ? (
            <Card
              title={team.name}
              action={
                <button type="button" className={headerLink} onClick={() => navigate('/team')}>
                  Gestão <ChevronRight size={14} aria-hidden />
                </button>
              }
              bodyClassName="!p-4"
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label="Campeonato" value={position ? `${position}º` : '-'} hint={`Meta: ${m.boardTarget}º`} accent />
                <Stat
                  label="Caixa"
                  value={<span className={m.budget < 0 ? 'text-gold-400' : ''}>{formatMoney(m.budget)}</span>}
                  hint={`Previsto no ano: ${formatMoney(teamBudgetForecast(career).net, { sign: true })}`}
                />
                <Stat
                  label="Carro"
                  value={
                    <span className="whitespace-nowrap text-xl">
                      {team.car.engine.toLocaleString('pt-BR')} / {team.car.chassis.toLocaleString('pt-BR')}
                    </span>
                  }
                  hint="Motor / chassi"
                />
                <Stat
                  label="Melhorias no ano"
                  value={Object.values(m.development.gains).reduce((a, b) => a + b, 0)}
                  hint={`Pesquisa em ritmo ${m.development.spend === 'high' ? 'agressivo' : m.development.spend === 'low' ? 'contido' : 'normal'}`}
                />
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {lineup.map((d) => (
                  <li key={d.id} className="min-w-0 bg-ink-850 px-2 py-2">
                    <div className="truncate text-sm font-semibold">{fullName(d)}</div>
                    <div className="text-xs text-ink-400">
                      moral {Math.round(d.condition.morale)} · confiança {Math.round(d.condition.confidence)}
                      {d.injury && <span className="text-gold-400"> · lesionado</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : transition ? (
            <TransitionPanel career={career} transition={transition} />
          ) : offerWindow === 'midseason' ? (
            <Card title="Ano de transição" tone="attention">
              <p className="text-sm text-ink-300">
                Você acabou de parar de correr. Antes da próxima etapa, dá para começar o ano de transição: mentoria de um jovem piloto, comentários na TV ou a
                imagem de uma marca, com cachê por etapa e um legado. Se a próxima etapa passar sem um papel, ele fica para o fechamento.
              </p>
              {/* No formato largo, o botão de avançar (na barra do pé da tela) já leva à tela Carreira. */}
              {!wide && (
                <Button variant="primary" className="mt-4" onClick={() => navigate('/career')}>
                  Escolher o papel
                </Button>
              )}
            </Card>
          ) : (
            <Card title="Fora das pistas">
              <p className="text-sm text-ink-300">
                Você não comanda nenhuma equipe nesta temporada. O campeonato segue, o seu patrimônio rende e a família continua. No fim do ano, a tela Carreira
                traz propostas de cargo e equipes à venda.
              </p>
              {later && <p className="mt-2 text-xs text-ink-400">{later}</p>}
            </Card>
          )}

          {racing.length > 0 && (
            <Card
              title="Filhos nas pistas"
              action={
                <button type="button" className={headerLink} onClick={() => navigate('/family')}>
                  Família <ChevronRight size={14} aria-hidden />
                </button>
              }
              bodyClassName="!p-4"
            >
              <ul className="space-y-2 text-sm">
                {racing.map((c) => {
                  const last = c.racing?.seasons[c.racing.seasons.length - 1];
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-2">
                      <span>
                        <b>{c.firstName}</b>, {c.age} anos · {c.racing ? getCategory(c.racing.categoryId).shortName : ''} · {c.racing?.teamName}
                      </span>
                      <span className="text-xs text-ink-400">{last ? `Último ano: ${last.position}º` : 'Estreia nesta temporada'}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <Card title="Campeonato de equipes" padded={false}>
          <ol className="divide-y divide-ink-800">
            {teamStandings.slice(0, 10).map((s) => (
              <li key={s.teamId} className={cx('flex items-center gap-2 px-4 py-1 text-sm', s.teamId === m?.teamId && 'bg-apex-500/10')}>
                <span className="w-5 text-right tabular text-ink-400">{s.position}</span>
                <TeamSwatch team={teams[s.teamId]} />
                <span className={cx('flex-1 truncate', s.teamId === m?.teamId && 'font-semibold text-ink-100')}>{teams[s.teamId]?.name}</span>
                <span className="font-display text-base font-semibold">{s.points}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title="Mensagens" padded={false}>
        <ul className="max-h-80 divide-y divide-ink-800 overflow-y-auto">
          {career.inbox.map((msg) => (
            <li key={msg.id} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{msg.title}</span>
                <span className="ml-auto shrink-0 text-2xs text-ink-400">{formatDate(msg.date)}</span>
              </div>
              <p className="mt-1 text-xs leading-snug text-ink-300">{msg.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fim de semana                                                       */
/* ------------------------------------------------------------------ */

const PRACTICE_HINTS: Record<PracticeProgram, string> = {
  setup: 'Melhor acerto para o fim de semana inteiro.',
  qualifying: 'Ganha tempo na classificação.',
  longRun: 'Poupa pneus na corrida.',
};
const QUALIFYING_HINTS: Record<QualifyingApproach, string> = {
  safe: 'Voltas limpas, sem risco de erro.',
  balanced: 'Equilíbrio entre risco e tempo.',
  attack: 'Mais rápido, com mais risco de volta perdida.',
};

export function ExecutiveWeekendScreen() {
  const { career, category, drivers } = useCareerView();
  const navigate = useNavigate();
  const { startWeekend, simulateAbsentWeekend, watchAbsentWeekend } = useGameStore.getState();
  const liveRace = useGameStore((s) => s.liveRace);
  const [program, setProgram] = useState<PracticeProgram>('setup');
  const [approach, setApproach] = useState<QualifyingApproach>('balanced');
  const m = career.management;
  const team = managedTeam(career);
  const [expanded, setExpanded] = useState(false);
  const next = getNextEvent(career);
  const last = career.rounds[career.rounds.length - 1];
  const seasonOver = isSeasonComplete(career);
  const track = next ? getTrack(next.trackId) : null;
  const mine = last && m ? last.race.entries.filter((e) => e.teamId === m.teamId) : [];
  // Com pilotos seus na última etapa, o resultado completo fica recolhido: primeiro, como eles foram.
  const fullResult = expanded || mine.length === 0;
  const pending = career.pendingEvents.length > 0;
  const simulate = () => {
    if (!useGameStore.getState().career?.weekend) startWeekend();
    if (useGameStore.getState().career?.weekend) simulateAbsentWeekend({ program, approach });
  };
  const watch = () => {
    if (!useGameStore.getState().career?.weekend) startWeekend();
    if (useGameStore.getState().career?.weekend) watchAbsentWeekend({ program, approach });
  };

  // Com a corrida na tela, o cabeçalho dá lugar à pista (o botão de concluir é da transmissão).
  if (liveRace) return <RaceBroadcast spectator />;

  const planning = !seasonOver && next && track;
  const transition = activeTransition(career);
  const who =
    m && team
      ? `Muro dos boxes · ${team.name}`
      : transition
        ? `Ano de transição · ${TRANSITION_ROLE_INFO[transition.role].label}`
        : 'Acompanhando o campeonato';

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={who} title={seasonOver ? 'Temporada encerrada' : next && track ? `Etapa ${next.round}: ${track.name}` : 'Fim de semana'}>
        {planning && (
          <>
            {/* Com decisões pendentes, a barra do pé da tela mostra o atalho para resolvê-las. */}
            {!pending && (
              <ScreenAction onClick={watch} className="min-h-12">
                Assistir à corrida
              </ScreenAction>
            )}
            <Button disabled={pending} onClick={simulate}>
              Simular a etapa
            </Button>
          </>
        )}
      </PageHeader>

      {planning && pending && (
        <p className="border border-gold-400/40 bg-gold-400/10 px-4 py-2 text-sm text-gold-400">Resolva as decisões pendentes no painel</p>
      )}

      {seasonOver ? (
        <EmptyState title="A temporada acabou">
          As decisões para o próximo ano estão na tela Carreira.
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate('/career')}>
              Ir para Carreira
            </Button>
          </div>
        </EmptyState>
      ) : next && track ? (
        <>
          <Card
            title="Plano do fim de semana"
            action={
              <span className="flex items-center gap-2 text-xs text-ink-400">
                <span className="hidden sm:inline">
                  {trackLocation(track)} · {formatDate(next.date)} ·
                </span>
                Corrida: <WeatherBadge weather={next.weather.race} />
              </span>
            }
            bodyClassName="!p-4"
          >
            {m ? (
              <div className="space-y-2">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={groupLabel}>Treino livre dos seus pilotos</span>
                    <WeatherBadge weather={next.weather.practice} compact />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PRACTICE_PROGRAMS.map((p) => (
                      <ChoiceCard
                        key={p}
                        selected={program === p}
                        onSelect={() => setProgram(p)}
                        title={PRACTICE_PROGRAM_LABELS[p]}
                        description={PRACTICE_HINTS[p]}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={groupLabel}>Classificação</span>
                    <WeatherBadge weather={next.weather.qualifying} compact />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {QUALIFYING_APPROACHES.map((a) => (
                      <ChoiceCard
                        key={a}
                        selected={approach === a}
                        onSelect={() => setApproach(a)}
                        title={QUALIFYING_APPROACH_LABELS[a]}
                        description={QUALIFYING_HINTS[a]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-300">
                    Sem equipe para comandar, você acompanha o resultado. A etapa é simulada por inteiro pelo mesmo motor de corrida.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400">
                    <span className="flex items-center gap-2">
                      Treino: <WeatherBadge weather={next.weather.practice} compact />
                    </span>
                    <span className="flex items-center gap-2">
                      Classificação: <WeatherBadge weather={next.weather.qualifying} compact />
                    </span>
                  </div>
                </div>
                <CircuitMap track={track} style={category.vehicle} className="h-20 w-[min(30%,9rem)] shrink-0" />
              </div>
            )}
          </Card>
          <p className="text-xs text-ink-400">
            Na corrida, os pilotos decidem ritmo e paradas. O que você controla é o carro, a estrutura e quem está no cockpit. Assistir ou simular dá o mesmo
            resultado.
          </p>
        </>
      ) : null}

      {last && (
        <Card
          title={`Última etapa: ${getTrack(last.trackId).name}`}
          action={
            mine.length > 0 ? (
              <button type="button" className={headerLink} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                Resultado completo {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
              </button>
            ) : undefined
          }
          padded={false}
        >
          {mine.length > 0 && (
            <div className={cx('flex flex-wrap gap-x-4 gap-y-2 px-4 py-2', fullResult && 'border-b border-ink-800')}>
              {mine.map((e) => (
                <div key={e.driverId} className="flex items-center gap-2 text-sm">
                  <PositionBadge position={e.position} dnf={e.status === 'dnf'} />
                  <span className="font-semibold">{drivers[e.driverId] ? fullName(drivers[e.driverId]!) : e.driverId}</span>
                  <span className="text-xs text-ink-400">
                    largou em {e.grid}º · {e.points} pts{e.damage > 0 ? ' · carro danificado' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {fullResult && (
            <div className="px-4 py-2">
              <RaceResultTable result={last.race} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carreira (fechamento e rumo)                                        */
/* ------------------------------------------------------------------ */

const ORIGIN_LABELS = { current: 'Na equipe', market: 'Mercado', rookie: 'Estreante', child: 'Família' } as const;

type CareerTab = 'summary' | 'drivers' | 'sponsors' | 'market' | 'found';
/** `withTeam`: a aba só existe para quem segue com a equipe (true) ou para quem está sem equipe (false). */
const CAREER_TABS: { value: CareerTab; label: string; withTeam?: boolean }[] = [
  { value: 'summary', label: 'Resumo' },
  { value: 'drivers', label: 'Pilotos', withTeam: true },
  { value: 'sponsors', label: 'Patrocínio', withTeam: true },
  { value: 'market', label: 'À venda', withTeam: false },
  { value: 'found', label: 'Fundar', withTeam: false },
];

export function ExecutiveCareerScreen() {
  const { career, player, category } = useCareerView();
  const navigate = useNavigate();
  const store = useGameStore.getState();
  const off = career.executiveOffseason;
  const m = career.management;
  const team = managedTeam(career);
  const [foundCategory, setFoundCategory] = useState<CategoryId>('kart-regional');
  const [foundName, setFoundName] = useState(`${player.lastName} Racing`);
  const [foundColor, setFoundColor] = useState('#22c55e');
  // A aba fica no endereço (?tab=...), como nas outras telas com abas.
  const [params, setParams] = useSearchParams();
  const cash = career.finance.cash;
  const keepsTeam = m !== null && off !== null && !off.dismissed;
  const pending = career.pendingEvents.length > 0;
  // Ano de transição: as propostas valem uma vez, logo depois de parar (no meio do ano) ou no primeiro fechamento.
  const offerWindow = transitionWindow(career);
  const offers = transitionOffers(career);
  const [role, setRole] = useState<TransitionRole | null>(null);
  const chosen = offers.find((o) => o.role === role && o.available) ?? null;
  const canTransition = offers.some((o) => o.available);
  const transition = activeTransition(career);
  const later = transitionLaterText(career);

  if (!off) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow={`Temporada ${career.year}`} title="Carreira de dirigente" />
        {offerWindow === 'midseason' && (
          <Card title="Ano de transição" tone="attention">
            <p className="text-sm text-ink-300">
              O primeiro ano fora do carro pode ter um papel, com cachê a cada etapa e um legado. Começando agora, ele vale pelo resto desta temporada. A
              proposta vale até a próxima etapa; depois, fica para o fechamento.
            </p>
            <div className="mt-4">
              <TransitionOfferChoices offers={offers} selected={chosen?.role ?? null} onSelect={setRole} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!pending && (
                <ScreenAction
                  disabled={!chosen}
                  title={chosen ? `Ano de transição: ${chosen.label}` : 'Escolha um papel para o ano de transição'}
                  onClick={() => chosen && store.beginTransition(chosen.role)}
                >
                  Começar o ano de transição
                </ScreenAction>
              )}
              <Button variant="ghost" onClick={() => navigate('/weekend')}>
                Seguir sem papel
              </Button>
            </div>
          </Card>
        )}
        {later && (
          <Card title="Ano de transição">
            <p className="text-sm text-ink-300">{later}</p>
          </Card>
        )}
        <Card bodyClassName="grid grid-cols-3 gap-4 !p-4">
          <Stat
            label="Prestígio como dirigente"
            value={Math.round(executiveStanding(career))}
            hint="Reputação mais o retrospecto das três últimas temporadas no comando"
            accent
          />
          <Stat
            label="Situação"
            value={m ? (m.position === 'owner' ? 'Dono' : 'Chefe contratado') : transition ? 'Ano de transição' : 'Sem cargo'}
            hint={team ? `${team.name} · ${category.shortName}` : transition ? TRANSITION_ROLE_INFO[transition.role].label : 'Investidor'}
          />
          <Stat label="Temporadas no comando" value={career.executiveLog.length} hint={m && m.strikes > 0 ? 'Advertido pela diretoria' : undefined} />
        </Card>
        <div className={cx('grid items-start gap-4', career.executiveLog.length > 0 && 'md:grid-cols-2')}>
          <Card title="Como funciona">
            <ul className="list-disc space-y-2 pl-4 text-sm text-ink-300">
              <li>
                No fim de cada temporada, esta tela traz as decisões: dupla de pilotos, patrocinadores, propostas para chefiar outras equipes, equipes à venda e
                a opção de fundar a sua.
              </li>
              <li>
                Logo depois de pendurar o capacete, o primeiro ano fora do carro pode ter um papel (o <b className="text-ink-100">ano de transição</b>):
                mentoria, comentários na TV ou a imagem de uma marca, cada um com cachê e um legado.
              </li>
              <li>
                Como <b className="text-ink-100">chefe contratado</b>, você recebe salário e bônus por meta, mas é demitido depois de {MANAGEMENT.MAX_STRIKES}{' '}
                temporadas abaixo do esperado.
              </li>
              <li>
                Como <b className="text-ink-100">dono</b>, o lucro (e o prejuízo) é seu, e a equipe passa aos herdeiros.
              </li>
              <li>
                Regulamento {categoryRef(category.id, 'de')}: {REGULATIONS[category.id].summary}
              </li>
            </ul>
          </Card>
          {career.executiveLog.length > 0 && <LogTable />}
        </div>
      </div>
    );
  }

  const tabs = CAREER_TABS.filter((t) => t.withTeam === undefined || t.withTeam === keepsTeam);
  const requested = params.get('tab');
  const tab: CareerTab = tabs.find((t) => t.value === requested)?.value ?? 'summary';
  const setTab = (next: CareerTab) => setParams(next === 'summary' ? {} : { tab: next }, { replace: true });
  const listingGroups = CATEGORY_IDS.map((id) => ({ id, items: off.listings.filter((l) => l.categoryId === id) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={`Fim da temporada ${career.year}`} title="Próxima temporada">
        <Tabs value={tab} options={tabs} onChange={setTab} />
        {/* O passo que começa a temporada vai para a barra do pé da tela. Com decisões pendentes, ela mostra o atalho para resolvê-las. */}
        {!pending &&
          (keepsTeam ? (
            <ScreenAction
              disabled={off.lineup.length !== 2}
              title={off.lineup.length !== 2 ? 'Escolha os dois pilotos na aba Pilotos' : undefined}
              onClick={() => store.startExecutiveSeason({ kind: 'continue' })}
            >
              Seguir com a <span className="max-w-44 truncate">{team?.name}</span>
            </ScreenAction>
          ) : offerWindow === 'closing' && canTransition ? (
            <ScreenAction
              disabled={!chosen}
              title={chosen ? `Ano de transição: ${chosen.label}` : 'Escolha um papel no cartão Ano de transição'}
              onClick={() => chosen && store.startExecutiveSeason({ kind: 'transition', role: chosen.role })}
            >
              Começar o ano de transição
            </ScreenAction>
          ) : (
            <ScreenAction onClick={() => store.startExecutiveSeason({ kind: 'spectate' })}>Seguir sem equipe</ScreenAction>
          ))}
      </PageHeader>
      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 border border-gold-400/40 bg-gold-400/10 py-2 pl-4 pr-2 text-sm text-gold-400">
          Resolva as decisões pendentes no painel antes de começar a temporada.
          <Button variant="danger" onClick={() => navigate('/dashboard')}>
            Ir para o painel
          </Button>
        </div>
      )}

      {tab === 'summary' && (
        <>
          {offerWindow === 'closing' && (
            <Card title="Ano de transição" tone="attention">
              <p className="text-sm text-ink-300">
                O primeiro ano fora do carro pode ter um papel, com cachê a cada etapa e um legado, pela próxima temporada inteira. Aceitar um cargo, comprar ou
                fundar uma equipe agora pula o ano de transição.
              </p>
              <div className="mt-4">
                <TransitionOfferChoices offers={offers} selected={chosen?.role ?? null} onSelect={setRole} />
              </div>
              {canTransition && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button disabled={pending} onClick={() => store.startExecutiveSeason({ kind: 'spectate' })}>
                    Seguir sem equipe
                  </Button>
                  <span className="min-w-0 flex-1 basis-60 text-xs text-ink-400">Um ano fora, sem papel: você só acompanha o campeonato.</span>
                </div>
              )}
            </Card>
          )}
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Card title="Balanço do ano">
              {off.teamPosition !== null && (
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <Stat label="Posição da equipe" value={`${off.teamPosition}º`} hint={`Meta: ${off.target}º`} accent />
                  <Stat
                    label="Meta"
                    value={<span className={off.objectiveMet ? 'text-go-400' : 'text-gold-400'}>{off.objectiveMet ? 'Cumprida' : 'Não cumprida'}</span>}
                  />
                  <Stat
                    label="Resultado financeiro"
                    value={<span className={off.profit < 0 ? 'text-gold-400' : 'text-go-400'}>{formatMoney(off.profit, { sign: true })}</span>}
                  />
                  <Stat label="Prêmio para o próximo ano" value={formatMoney(off.prize)} />
                </div>
              )}
              {off.notes.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm text-ink-300">
                  {off.notes.map((note, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: notas de texto sem id, lista só de leitura
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-400">
                  {offerWindow === 'closing'
                    ? 'Você encerrou a carreira de piloto. Escolha o próximo passo: o ano de transição, um cargo, uma equipe à venda ou fundar a sua.'
                    : 'Você encerrou a carreira de piloto. Escolha o próximo passo: um cargo, uma equipe à venda ou fundar a sua.'}
                </p>
              )}
              {off.dismissed && <p className="mt-4 text-sm font-semibold text-gold-400">Você foi demitido e precisa de um novo rumo.</p>}
            </Card>

            {keepsTeam && m ? (
              <div className="space-y-4">
                <Card title="Antes de seguir">
                  <ul className="space-y-2">
                    <Check met={off.lineup.length === 2}>Dupla de pilotos: {off.lineup.length} de 2 escolhidos</Check>
                    <li className="pl-6 text-sm text-ink-300">
                      Patrocínio: {m.sponsors.length} de {MANAGEMENT.SPONSOR_SLOTS} cotas ocupadas,{' '}
                      {counted(off.sponsorOffers.length, 'proposta nova', 'propostas novas')}
                    </li>
                  </ul>
                </Card>
                <Card title={m.position === 'owner' ? 'Vender a equipe' : 'Deixar o cargo'}>
                  <p className="text-sm text-ink-300">
                    {m.position === 'owner'
                      ? `Valor de mercado da ${team?.name}: ${formatMoney(ownedTeamValue(career))} (inclui o caixa e parte do custo das instalações; sobe com a posição e a reputação da equipe). Há imposto de 15% sobre o ganho em relação aos ${formatMoney(m.purchasePrice)} pagos.`
                      : 'Você pode pedir demissão para aceitar outra proposta, comprar uma equipe ou ficar um ano fora.'}
                  </p>
                  <Button variant="danger" className="mt-4" onClick={() => store.leaveTeam()}>
                    {m.position === 'owner' ? 'Vender' : 'Pedir demissão'}
                  </Button>
                </Card>
              </div>
            ) : (
              <Card
                title="Propostas para chefiar uma equipe"
                action={<span className="text-xs text-ink-400">Prestígio {Math.round(executiveStanding(career))}</span>}
                bodyClassName="!p-4"
              >
                {off.jobOffers.length === 0 ? (
                  <p className="text-sm text-ink-400">Nenhuma equipe procurou você neste ano.</p>
                ) : (
                  <ul className="space-y-2">
                    {off.jobOffers.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 bg-ink-850 py-2 pl-2 pr-2">
                        <div className="min-w-0">
                          <div className="font-display text-lg font-bold uppercase leading-tight">{o.teamName}</div>
                          <div className="text-xs text-ink-300">
                            {getCategory(o.categoryId).shortName} · {o.rank + 1}ª força do grid · meta: {o.target}º lugar
                          </div>
                          <div className="text-xs text-ink-300">
                            Salário: <b className="tabular text-ink-100">{formatMoney(o.salary)}</b> por temporada
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          className="shrink-0"
                          disabled={pending}
                          onClick={() => store.startExecutiveSeason({ kind: 'job', offerId: o.id })}
                        >
                          Aceitar o cargo
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
          {career.executiveLog.length > 0 && <LogTable />}
          <div className="flex flex-wrap items-center gap-x-4">
            <ExportReminder link={false} className="min-w-0 flex-1 basis-72" />
            <Link to="/saves" className="inline-flex min-h-11 items-center text-xs font-semibold text-ink-200 underline underline-offset-2 hover:text-ink-100">
              Exportar agora
            </Link>
          </div>
        </>
      )}

      {tab === 'drivers' && keepsTeam && (
        <Card
          title="Pilotos para a próxima temporada"
          action={<span className="text-xs text-ink-400">{off.lineup.length} de 2 escolhidos</span>}
          bodyClassName="!p-4"
        >
          {/* Sem esticar a linha: o aviso de favorecimento deixa o cartão do filho mais alto que o vizinho. */}
          <ul className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
            {[...off.candidates]
              .sort((a, b) => b.rating - a.rating)
              .map((c) => {
                const slot = off.lineup.indexOf(c.driverId);
                const toggle = () => store.setLineup(slot >= 0 ? off.lineup.filter((id) => id !== c.driverId) : [...off.lineup, c.driverId].slice(-2));
                const favoritism = favoritismNote(career, c, off.lineup);
                return (
                  <li
                    key={c.driverId}
                    className={cx('flex flex-wrap items-center gap-x-2 py-1 pl-2 pr-1', slot >= 0 ? 'bg-apex-500/10 shadow-ring-accent' : 'bg-ink-850')}
                  >
                    <span className="w-8 shrink-0 text-center font-display text-2xl font-bold leading-none" title="Nota">
                      <span className="sr-only">Nota </span>
                      {Math.floor(c.rating)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                        <span className="shrink-0 whitespace-nowrap">
                          <Pill tone={c.origin === 'child' ? 'good' : 'neutral'}>{ORIGIN_LABELS[c.origin]}</Pill>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-ink-400">
                        {/* A idade do candidato já é a da temporada para a qual ele assina. */}
                        <span className="whitespace-nowrap">{c.age} anos na próxima temporada</span>
                        <span className="whitespace-nowrap">Contrato de {counted(c.years, 'temporada', 'temporadas')}</span>
                        {c.salary > 0 && <span className="whitespace-nowrap text-ink-200">Salário: {formatMoney(c.salary)}</span>}
                        {c.seatFee > 0 && <span className="whitespace-nowrap text-ink-200">Paga {formatMoney(c.seatFee)} pela vaga</span>}
                      </div>
                    </div>
                    {c.willing ? (
                      <Button variant={slot >= 0 ? 'primary' : 'secondary'} className="shrink-0" onClick={toggle}>
                        {slot === 0 ? '1º piloto' : slot === 1 ? '2º piloto' : 'Escalar'}
                      </Button>
                    ) : (
                      <span className="flex min-h-11 shrink-0 items-center px-2 text-xs text-ink-400">Não aceita</span>
                    )}
                    {favoritism && (
                      <div className="flex basis-full flex-wrap items-start gap-x-2 gap-y-1 pb-2 pr-2 text-xs text-ink-300">
                        <Chip tone="attention" size="sm">
                          Favorecimento
                        </Chip>
                        <span className="min-w-0 flex-1 basis-48">{favoritism}</span>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
          <p className="mt-4 text-xs text-ink-400">
            O primeiro escolhido é o primeiro piloto. Pilotos melhores pedem salário maior ({categoryRef(TOP_CATEGORY_ID, 'em')}) ou pagam menos pela vaga (nas
            categorias de base), e só aceitam equipes à altura da ambição deles. Quem recusa quer uma equipe mais forte, ou chegou à idade-limite da categoria.
            Um filho corre pela equipe da família sem salário e sem pagar pela vaga, mas a imprensa fala em favorecimento.
          </p>
        </Card>
      )}

      {tab === 'sponsors' && keepsTeam && m && (
        <Card
          title="Patrocínio da equipe"
          action={
            <span className="text-xs text-ink-400">
              {m.sponsors.length} de {MANAGEMENT.SPONSOR_SLOTS} cotas ocupadas
            </span>
          }
        >
          {off.sponsorOffers.length === 0 ? (
            <p className="text-sm text-ink-400">Sem propostas novas.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {off.sponsorOffers.map((s) => (
                <div key={s.id} className="bg-ink-850 p-2 text-sm">
                  <div className="font-semibold">{s.name}</div>
                  <div className="font-display text-xl font-bold tabular">
                    {formatMoney(s.perSeason)}
                    <span className="font-sans text-xs font-normal text-ink-400"> por temporada</span>
                  </div>
                  <div className="text-xs text-ink-400">Exige a equipe {amongTheFirst(s.targetPosition)}.</div>
                  <Button className="mt-2" disabled={m.sponsors.length >= MANAGEMENT.SPONSOR_SLOTS} onClick={() => store.acceptTeamSponsor(s.id)}>
                    Aceitar
                  </Button>
                </div>
              ))}
            </div>
          )}
          {m.sponsors.length > 0 && (
            <p className="mt-4 text-xs text-ink-400">
              Atuais: {m.sponsors.map((s) => `${s.name} (${formatMoney(s.perSeason)}, ${amongTheFirst(s.targetPosition)})`).join(' · ')}. Para trocar, dispense
              um na tela Gestão.
            </p>
          )}
        </Card>
      )}

      {tab === 'market' && !keepsTeam && (
        <Card
          title="Equipes à venda"
          action={
            <span className="text-xs text-ink-400">
              Seu caixa: <b className="tabular text-ink-100">{formatMoney(cash)}</b>
            </span>
          }
          bodyClassName="!p-4"
        >
          <div className="grid items-start gap-x-6 gap-y-4 md:grid-cols-2">
            {listingGroups.map((group) => (
              <section key={group.id}>
                <h3 className={groupLabel}>{getCategory(group.id).shortName}</h3>
                <ul className="mt-1">
                  {group.items.map((l) => {
                    const affordable = l.price <= cash;
                    return (
                      <li key={l.id} className={cx('flex min-h-8 items-center gap-2 border-t border-ink-800 text-sm', !affordable && 'text-ink-400')}>
                        <span className={cx('min-w-0 flex-1 truncate', affordable && 'font-semibold')}>{l.teamName}</span>
                        <span className="shrink-0 whitespace-nowrap text-xs tabular text-ink-400">{l.rank + 1}ª de 10</span>
                        <span className="min-w-[4.75rem] shrink-0 whitespace-nowrap text-right tabular">{formatMoney(l.price)}</span>
                        {affordable ? (
                          <Button className="my-1 shrink-0" disabled={pending} onClick={() => store.startExecutiveSeason({ kind: 'buy', listingId: l.id })}>
                            Comprar
                          </Button>
                        ) : (
                          <span className="sr-only">Sem caixa</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-400">
            Ao lado do nome, a força da equipe no grid da categoria; em cinza, as que o seu caixa não paga. A compra é paga com o seu caixa pessoal (um
            empréstimo, na tela Finanças, pode completar o valor). Dono fica com o lucro, cobre o prejuízo e deixa a equipe para os herdeiros.
          </p>
        </Card>
      )}

      {tab === 'found' && !keepsTeam && (
        <Card
          title="Fundar uma equipe"
          action={
            <span className="text-xs text-ink-400">
              Seu caixa: <b className="tabular text-ink-100">{formatMoney(cash)}</b>
            </span>
          }
        >
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs text-ink-300">
              Categoria
              <select value={foundCategory} onChange={(e) => setFoundCategory(e.target.value as CategoryId)} className={cx(field, 'mt-1 block')}>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {getCategory(id).shortName} · {formatMoney(foundingCost(id))}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-300">
              Nome
              <input value={foundName} maxLength={28} onChange={(e) => setFoundName(e.target.value)} className={cx(field, 'mt-1 block w-52')} />
            </label>
            <label className="text-xs text-ink-300">
              Cor
              <input
                type="color"
                value={foundColor}
                onChange={(e) => setFoundColor(e.target.value)}
                className="mt-1 block h-11 w-14 cursor-pointer border border-ink-500 bg-ink-850"
              />
            </label>
            <Button
              variant="primary"
              disabled={pending || foundingCost(foundCategory) > cash}
              onClick={() => store.foundTeam(foundCategory, foundName, foundColor)}
            >
              {foundingCost(foundCategory) > cash ? 'Sem caixa' : `Fundar (${formatMoney(foundingCost(foundCategory))})`}
            </Button>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            A equipe nova ocupa a inscrição da mais fraca da categoria e herda o equipamento dela, um pouco pior. Começa sem instalações, sem equipe técnica e
            com reputação baixa: tudo por construir.
          </p>
        </Card>
      )}
    </div>
  );
}

function LogTable() {
  const { career } = useCareerView();
  return (
    <Card title="Retrospecto como dirigente" padded={false}>
      <div className="px-4">
        <TableWrap>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Temporada</th>
                <th className={th}>Categoria</th>
                <th className={th}>Equipe</th>
                <th className={cx(th, 'text-right')}>Posição</th>
                <th className={cx(th, 'text-right')}>Meta</th>
                <th className={cx(th, 'text-right')}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {[...career.executiveLog].reverse().map((l) => (
                <tr key={l.season} className="border-t border-ink-800">
                  <td className={cx(td, 'tabular')}>T{l.season}</td>
                  <td className={td}>{getCategory(l.categoryId).shortName}</td>
                  <td className={td}>{l.teamName}</td>
                  <td className={cx(td, 'text-right font-semibold tabular', l.position <= l.target ? 'text-go-400' : 'text-gold-400')}>{l.position}º</td>
                  <td className={cx(td, 'text-right tabular')}>{l.target}º</td>
                  <td className={cx(td, 'text-right tabular', l.profit < 0 ? 'text-gold-400' : 'text-go-400')}>{formatMoney(l.profit, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Card>
  );
}
