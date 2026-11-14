/**
 * Telas do modo dirigente: painel, fim de semana e decisões de fim de
 * temporada. O jogador não corre; ele decide a estrutura, os pilotos e o rumo
 * da equipe (ou só investe e acompanha).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_IDS, PRACTICE_PROGRAMS, QUALIFYING_APPROACHES, type CategoryId, type PracticeProgram, type QualifyingApproach } from '@/domain/schemas';
import { PRACTICE_PROGRAM_LABELS, QUALIFYING_APPROACH_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { MANAGEMENT, REGULATIONS } from '@/data/management';
import { getTrack } from '@/data/tracks';
import { executiveStanding, foundingCost, fullName, getNextEvent, isSeasonComplete, managedTeam, managedTeamPosition, netWorth, ownedTeamValue, teamBudgetForecast, tutorialActive } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { EventsPanel } from '../components/EventsPanel';
import { RaceResultTable } from '../components/RaceResultTable';
import { Button, Card, ChoiceCard, EmptyState, PageHeader, Pill, PositionBadge, Stat, TableWrap, TeamSwatch, WeatherBadge, cx, td, th } from '../components/ui';
import { formatDate, formatMoney, trackLocation } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { RaceBroadcast } from '../race/RaceBroadcast';
import { TutorialCard } from './HelpScreen';

const input = 'rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 focus:border-apex-500 focus:outline-none';

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export function ExecutiveDashboardScreen() {
  const { career, player, category, teams, teamStandings } = useCareerView();
  const navigate = useNavigate();
  const m = career.management;
  const team = managedTeam(career);
  const next = getNextEvent(career);
  const seasonOver = isSeasonComplete(career);
  const position = managedTeamPosition(career);
  const lineup = m ? career.drivers.filter((d) => d.teamId === m.teamId && d.role !== 'reserve') : [];
  const racing = career.family.children.filter((c) => c.stage === 'racing' && c.racing);
  const track = next ? getTrack(next.trackId) : null;

  return (
    <div>
      <PageHeader eyebrow={`${category.shortName} · ${team ? team.name : 'Sem equipe'} · ${career.year}`} title={`Olá, ${player.firstName}`}>
        <span className="text-sm text-ink-400">Reputação <b className="tabular text-ink-100">{Math.floor(career.reputation)}</b>/100</span>
        <span className="text-sm text-ink-400">Patrimônio <b className="tabular text-ink-100">{formatMoney(netWorth(career.finance) + ownedTeamValue(career))}</b></span>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {tutorialActive(career) && <TutorialCard />}
          <EventsPanel />

          {seasonOver && career.executiveOffseason && (
            <Card title={`Fim da temporada ${career.year}`} className="border-gold-400/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-xl text-sm text-ink-300">
                  {career.executiveOffseason.teamPosition !== null ? `A equipe terminou em ${career.executiveOffseason.teamPosition}º (meta: ${career.executiveOffseason.target}º). ` : ''}
                  Decida o rumo da próxima temporada: pilotos, patrocinadores, propostas de cargo e equipes à venda.
                </p>
                <Button variant="primary" onClick={() => navigate('/career')}>Decidir a próxima temporada</Button>
              </div>
            </Card>
          )}

          {!seasonOver && next && track && (
            <section className="relative overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900">
              <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_80%_30%,rgba(239,59,45,0.22),transparent_60%)]" />
              <div className="relative p-5 sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-apex-400">Próxima etapa · Etapa {next.round} de {career.calendar.length}</div>
                <h2 className="mt-1 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">{track.name}</h2>
                <div className="mt-1 text-sm text-ink-300">{trackLocation(track)} · {formatDate(next.date)} · <WeatherBadge weather={next.weather.race} /></div>
                <Button variant="primary" className="mt-5" disabled={career.pendingEvents.length > 0} onClick={() => navigate('/weekend')}>
                  {career.pendingEvents.length > 0 ? 'Resolva as decisões pendentes' : m ? 'Ir para o pit wall' : 'Acompanhar a etapa'}
                </Button>
              </div>
            </section>
          )}

          {m && team ? (
            <Card title={team.name} action={<Button variant="ghost" onClick={() => navigate('/team')}>Gestão →</Button>}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Campeonato" value={position ? `${position}º` : '-'} hint={`Meta: ${m.boardTarget}º`} accent />
                <Stat label="Caixa" value={<span className={m.budget < 0 ? 'text-apex-400' : ''}>{formatMoney(m.budget)}</span>} hint={`Previsto no ano: ${formatMoney(teamBudgetForecast(career).net, { sign: true })}`} />
                <Stat label="Carro" value={`${team.car.engine.toLocaleString('pt-BR')} / ${team.car.chassis.toLocaleString('pt-BR')}`} hint="Motor / chassi" />
                <Stat label="Melhorias no ano" value={Object.values(m.development.gains).reduce((a, b) => a + b, 0)} hint={`Pesquisa em ritmo ${m.development.spend === 'high' ? 'agressivo' : m.development.spend === 'low' ? 'contido' : 'normal'}`} />
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {lineup.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-ink-800 px-3 py-2 text-sm">
                    <span className="font-semibold">{fullName(d)}</span>
                    <span className="text-xs text-ink-400">moral {Math.round(d.condition.morale)} · confiança {Math.round(d.condition.confidence)}{d.injury ? ' · lesionado' : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card title="Fora das pistas">
              <p className="text-sm text-ink-300">Você não comanda nenhuma equipe nesta temporada. O campeonato segue sendo disputado, o seu patrimônio rende e a família continua. No fim do ano, a tela Carreira traz propostas de cargo e equipes à venda.</p>
            </Card>
          )}

          {racing.length > 0 && (
            <Card title="Filhos nas pistas" action={<Button variant="ghost" onClick={() => navigate('/family')}>Família →</Button>}>
              <ul className="space-y-2 text-sm">
                {racing.map((c) => {
                  const last = c.racing?.seasons[c.racing.seasons.length - 1];
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span><b>{c.firstName}</b>, {c.age} anos · {c.racing ? getCategory(c.racing.categoryId).shortName : ''} · {c.racing?.teamName}</span>
                      <span className="text-xs text-ink-400">{last ? `Último ano: ${last.position}º` : 'Estreia nesta temporada'}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Campeonato de equipes" padded={false}>
            <ol className="divide-y divide-ink-800">
              {teamStandings.slice(0, 10).map((s) => (
                <li key={s.teamId} className={cx('flex items-center gap-3 px-4 py-2 text-sm', s.teamId === m?.teamId && 'bg-apex-500/10')}>
                  <span className="w-5 text-right tabular text-ink-400">{s.position}</span>
                  <TeamSwatch team={teams[s.teamId]} />
                  <span className={cx('flex-1 truncate', s.teamId === m?.teamId && 'font-semibold text-ink-100')}>{teams[s.teamId]?.name}</span>
                  <span className="font-semibold tabular">{s.points}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Mensagens" padded={false}>
            <ul className="max-h-[440px] divide-y divide-ink-800 overflow-y-auto">
              {career.inbox.map((msg) => (
                <li key={msg.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{msg.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-ink-500">{formatDate(msg.date)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-ink-300">{msg.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fim de semana                                                       */
/* ------------------------------------------------------------------ */

export function ExecutiveWeekendScreen() {
  const { career, drivers } = useCareerView();
  const navigate = useNavigate();
  const { startWeekend, simulateAbsentWeekend, watchAbsentWeekend } = useGameStore.getState();
  const liveRace = useGameStore((s) => s.liveRace);
  const [program, setProgram] = useState<PracticeProgram>('setup');
  const [approach, setApproach] = useState<QualifyingApproach>('balanced');
  const m = career.management;
  const team = managedTeam(career);
  const next = getNextEvent(career);
  const last = career.rounds[career.rounds.length - 1];
  const seasonOver = isSeasonComplete(career);
  const track = next ? getTrack(next.trackId) : null;
  const mine = last && m ? last.race.entries.filter((e) => e.teamId === m.teamId) : [];
  const simulate = () => {
    if (!useGameStore.getState().career?.weekend) startWeekend();
    if (useGameStore.getState().career?.weekend) simulateAbsentWeekend({ program, approach });
  };
  const watch = () => {
    if (!useGameStore.getState().career?.weekend) startWeekend();
    if (useGameStore.getState().career?.weekend) watchAbsentWeekend({ program, approach });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={m && team ? `Pit wall · ${team.name}` : 'Acompanhando o campeonato'} title={seasonOver ? 'Temporada encerrada' : next && track ? `Etapa ${next.round}: ${track.name}` : 'Fim de semana'} />

      {liveRace ? (
        <RaceBroadcast spectator />
      ) : seasonOver ? (
        <EmptyState title="A temporada acabou">As decisões para o próximo ano estão na tela Carreira.<div className="mt-4"><Button variant="primary" onClick={() => navigate('/career')}>Ir para Carreira</Button></div></EmptyState>
      ) : next && track ? (
        <Card title="Plano do fim de semana">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-400">
            <span>{trackLocation(track)} · {formatDate(next.date)}</span>
            <span>Treino: <WeatherBadge weather={next.weather.practice} compact /></span>
            <span>Classificação: <WeatherBadge weather={next.weather.qualifying} compact /></span>
            <span>Corrida: <WeatherBadge weather={next.weather.race} /></span>
          </div>
          {m ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Treino livre dos seus pilotos</div>
                <div className="grid gap-2">
                  {PRACTICE_PROGRAMS.map((p) => <ChoiceCard key={p} selected={program === p} onSelect={() => setProgram(p)} title={PRACTICE_PROGRAM_LABELS[p]} description={p === 'setup' ? 'Melhor acerto para o fim de semana inteiro.' : p === 'qualifying' ? 'Ganha tempo na classificação.' : 'Poupa pneus na corrida.'} />)}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Classificação</div>
                <div className="grid gap-2">
                  {QUALIFYING_APPROACHES.map((a) => <ChoiceCard key={a} selected={approach === a} onSelect={() => setApproach(a)} title={QUALIFYING_APPROACH_LABELS[a]} description={a === 'safe' ? 'Voltas limpas, sem risco de erro.' : a === 'attack' ? 'Mais rápido, com mais risco de volta perdida.' : 'Equilíbrio entre risco e tempo.'} />)}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-300">Sem equipe para comandar, você acompanha o resultado. A etapa é simulada por inteiro pelo mesmo motor de corrida.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" disabled={career.pendingEvents.length > 0} onClick={watch}>
              {career.pendingEvents.length > 0 ? 'Resolva as decisões pendentes no painel' : 'Assistir à corrida'}
            </Button>
            <Button disabled={career.pendingEvents.length > 0} onClick={simulate}>Simular a etapa</Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Na corrida, os pilotos decidem ritmo e paradas. O que você controla é o carro, a estrutura e quem está no cockpit. Assistir ou simular dá o mesmo resultado.</p>
        </Card>
      ) : null}

      {last && !liveRace && (
        <Card title={`Última etapa: ${getTrack(last.trackId).name}`} padded={false}>
          {mine.length > 0 && (
            <div className="flex flex-wrap gap-3 border-b border-ink-800 px-4 py-3">
              {mine.map((e) => (
                <div key={e.driverId} className="flex items-center gap-2 text-sm">
                  <PositionBadge position={e.position} dnf={e.status === 'dnf'} />
                  <span className="font-semibold">{drivers[e.driverId] ? fullName(drivers[e.driverId]!) : e.driverId}</span>
                  <span className="text-xs text-ink-400">largou em {e.grid}º · {e.points} pts{e.damage > 0 ? ' · carro danificado' : ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2"><RaceResultTable result={last.race} /></div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carreira (fechamento e rumo)                                        */
/* ------------------------------------------------------------------ */

const ORIGIN_LABELS = { current: 'Na equipe', market: 'Mercado', rookie: 'Estreante', child: 'Família' } as const;

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
  const cash = career.finance.cash;
  const keepsTeam = m !== null && off !== null && !off.dismissed;
  const pending = career.pendingEvents.length > 0;

  if (!off) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={`Temporada ${career.year}`} title="Carreira de dirigente" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card><Stat label="Prestígio como dirigente" value={Math.round(executiveStanding(career))} hint="Reputação mais o retrospecto das três últimas temporadas no comando" accent /></Card>
          <Card><Stat label="Situação" value={m ? (m.position === 'owner' ? 'Dono' : 'Chefe contratado') : 'Sem cargo'} hint={team ? `${team.name} · ${category.shortName}` : 'Investidor'} /></Card>
          <Card><Stat label="Temporadas no comando" value={career.executiveLog.length} hint={m && m.strikes > 0 ? 'Advertido pela diretoria' : undefined} /></Card>
        </div>
        <Card title="Como funciona">
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-300">
            <li>No fim de cada temporada, esta tela traz as decisões: dupla de pilotos, patrocinadores, propostas para chefiar outras equipes, equipes à venda e a opção de fundar a sua.</li>
            <li>Como <b className="text-ink-100">chefe contratado</b>, você recebe salário e bônus por meta, mas é demitido depois de {MANAGEMENT.MAX_STRIKES} temporadas abaixo do esperado.</li>
            <li>Como <b className="text-ink-100">dono</b>, o lucro (e o prejuízo) é seu, e a equipe passa aos herdeiros.</li>
            <li>Regulamento da {category.shortName}: {REGULATIONS[category.id].summary}</li>
          </ul>
        </Card>
        {career.executiveLog.length > 0 && <LogTable />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Fim da temporada ${career.year}`} title="Próxima temporada">
        {keepsTeam ? (
          <Button variant="primary" disabled={pending || off.lineup.length !== 2} onClick={() => store.startExecutiveSeason({ kind: 'continue' })}>Seguir com a {team?.name}</Button>
        ) : (
          <Button disabled={pending} onClick={() => store.startExecutiveSeason({ kind: 'spectate' })}>Seguir sem equipe</Button>
        )}
      </PageHeader>
      {pending && <p className="rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-400">Resolva as decisões pendentes no painel antes de começar a temporada. <button type="button" className="underline" onClick={() => navigate('/dashboard')}>Ir para o painel</button></p>}

      <Card title="Balanço do ano">
        {off.teamPosition !== null && (
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Posição da equipe" value={`${off.teamPosition}º`} hint={`Meta: ${off.target}º`} accent />
            <Stat label="Meta" value={off.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
            <Stat label="Resultado financeiro" value={<span className={off.profit < 0 ? 'text-apex-400' : 'text-go-400'}>{formatMoney(off.profit, { sign: true })}</span>} />
            <Stat label="Prêmio para o próximo ano" value={formatMoney(off.prize)} />
          </div>
        )}
        {off.notes.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">{off.notes.map((note, i) => <li key={i}>{note}</li>)}</ul> : <p className="text-sm text-ink-400">Você encerrou a carreira de piloto. Escolha o próximo passo abaixo.</p>}
        {off.dismissed && <p className="mt-3 text-sm font-semibold text-apex-400">Você foi demitido e precisa de um novo rumo.</p>}
      </Card>

      {keepsTeam && m && (
        <>
          <Card title="Pilotos para a próxima temporada" action={<span className="text-xs text-ink-400">{off.lineup.length} de 2 escolhidos</span>} padded={false}>
            <div className="px-4">
              <TableWrap>
                <table className="w-full">
                  <thead><tr><th className={th}>Piloto</th><th className={th}>Origem</th><th className={cx(th, 'text-right')}>Idade</th><th className={cx(th, 'text-right')}>Nota</th><th className={cx(th, 'text-right')}>Salário</th><th className={cx(th, 'text-right')}>Paga pela vaga</th><th className={cx(th, 'text-right')}>Anos</th><th className={th}>Escalação</th></tr></thead>
                  <tbody>
                    {[...off.candidates].sort((a, b) => b.rating - a.rating).map((c) => {
                      const slot = off.lineup.indexOf(c.driverId);
                      const toggle = () => store.setLineup(slot >= 0 ? off.lineup.filter((id) => id !== c.driverId) : [...off.lineup, c.driverId].slice(-2));
                      return (
                        <tr key={c.driverId} className={cx('border-t border-ink-800', slot >= 0 && 'bg-apex-500/10')}>
                          <td className={cx(td, 'font-semibold')}>{c.name}</td>
                          <td className={td}><Pill tone={c.origin === 'child' ? 'good' : 'neutral'}>{ORIGIN_LABELS[c.origin]}</Pill></td>
                          <td className={cx(td, 'text-right tabular')}>{c.age}</td>
                          <td className={cx(td, 'text-right font-semibold tabular')}>{Math.floor(c.rating)}</td>
                          <td className={cx(td, 'text-right tabular')}>{c.salary ? formatMoney(c.salary) : '-'}</td>
                          <td className={cx(td, 'text-right tabular')}>{c.seatFee ? formatMoney(c.seatFee) : '-'}</td>
                          <td className={cx(td, 'text-right tabular')}>{c.years}</td>
                          <td className={td}>{c.willing ? <Button variant={slot >= 0 ? 'primary' : 'secondary'} onClick={toggle}>{slot === 0 ? '1º piloto' : slot === 1 ? '2º piloto' : 'Escalar'}</Button> : <span className="text-xs text-ink-500">Não aceita</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </div>
            <p className="px-4 py-3 text-xs text-ink-400">O primeiro escolhido é o primeiro piloto. Pilotos melhores pedem salário maior (na F1) ou pagam menos pela vaga (nas categorias de base), e só aceitam equipes à altura da ambição deles. Quem recusa quer uma equipe mais forte, ou chegou à idade-limite da categoria. Um filho corre pela equipe da família sem salário e sem pagar pela vaga.</p>
          </Card>

          <Card title="Patrocínio da equipe" action={<span className="text-xs text-ink-400">{m.sponsors.length} de {MANAGEMENT.SPONSOR_SLOTS} cotas ocupadas</span>}>
            {off.sponsorOffers.length === 0 ? <p className="text-sm text-ink-400">Sem propostas novas.</p> : (
              <div className="grid gap-3 md:grid-cols-3">
                {off.sponsorOffers.map((s) => (
                  <div key={s.id} className="rounded-lg border border-ink-800 p-3 text-sm">
                    <div className="font-semibold">{s.name}</div>
                    <div className="font-display text-xl font-bold tabular">{formatMoney(s.perSeason)}<span className="text-xs font-normal text-ink-400"> por temporada</span></div>
                    <div className="text-xs text-ink-400">Exige a equipe entre as {s.targetPosition} primeiras.</div>
                    <Button className="mt-2" disabled={m.sponsors.length >= MANAGEMENT.SPONSOR_SLOTS} onClick={() => store.acceptTeamSponsor(s.id)}>Aceitar</Button>
                  </div>
                ))}
              </div>
            )}
            {m.sponsors.length > 0 && <p className="mt-3 text-xs text-ink-400">Atuais: {m.sponsors.map((s) => `${s.name} (${formatMoney(s.perSeason)}, top ${s.targetPosition})`).join(' · ')}. Para trocar, dispense um na tela Gestão.</p>}
          </Card>

          <Card title={m.position === 'owner' ? 'Vender a equipe' : 'Deixar o cargo'}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-ink-300">{m.position === 'owner' ? `Valor de mercado da ${team?.name}: ${formatMoney(ownedTeamValue(career))} (inclui o caixa e parte do custo das instalações; sobe com a posição e a reputação da equipe). Há imposto de 15% sobre o ganho em relação aos ${formatMoney(m.purchasePrice)} pagos.` : 'Você pode pedir demissão para aceitar outra proposta, comprar uma equipe ou ficar um ano fora.'}</p>
              <Button variant="danger" onClick={() => store.leaveTeam()}>{m.position === 'owner' ? 'Vender' : 'Pedir demissão'}</Button>
            </div>
          </Card>
        </>
      )}

      {!keepsTeam && (
        <>
          <Card title="Propostas para chefiar uma equipe" action={<span className="text-xs text-ink-400">Prestígio {Math.round(executiveStanding(career))}</span>}>
            {off.jobOffers.length === 0 ? <p className="text-sm text-ink-400">Nenhuma equipe procurou você neste ano.</p> : (
              <div className="grid gap-3 md:grid-cols-3">
                {off.jobOffers.map((o) => (
                  <div key={o.id} className="rounded-lg border border-ink-800 p-4 text-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-apex-400">{getCategory(o.categoryId).shortName}</div>
                    <div className="font-display text-xl font-bold uppercase leading-tight">{o.teamName}</div>
                    <div className="mt-1 text-ink-300">{o.rank + 1}ª força do grid · meta: {o.target}º lugar</div>
                    <div className="text-ink-300">Salário: <b className="tabular text-ink-100">{formatMoney(o.salary)}</b> por temporada</div>
                    <Button variant="primary" className="mt-3" disabled={pending} onClick={() => store.startExecutiveSeason({ kind: 'job', offerId: o.id })}>Aceitar o cargo</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Equipes à venda" action={<span className="text-xs text-ink-400">Seu caixa: <b className="tabular text-ink-100">{formatMoney(cash)}</b></span>} padded={false}>
            <div className="px-4">
              <TableWrap>
                <table className="w-full">
                  <thead><tr><th className={th}>Categoria</th><th className={th}>Equipe</th><th className={cx(th, 'text-right')}>Força</th><th className={cx(th, 'text-right')}>Preço</th><th className={th} /></tr></thead>
                  <tbody>
                    {off.listings.map((l) => (
                      <tr key={l.id} className="border-t border-ink-800">
                        <td className={td}>{getCategory(l.categoryId).shortName}</td>
                        <td className={cx(td, 'font-semibold')}>{l.teamName}</td>
                        <td className={cx(td, 'text-right tabular')}>{l.rank + 1}ª de 10</td>
                        <td className={cx(td, 'text-right tabular')}>{formatMoney(l.price)}</td>
                        <td className={cx(td, 'text-right')}><Button disabled={pending || l.price > cash} onClick={() => store.startExecutiveSeason({ kind: 'buy', listingId: l.id })}>{l.price > cash ? 'Sem caixa' : 'Comprar'}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
            <p className="px-4 py-3 text-xs text-ink-400">A compra é paga com o seu caixa pessoal (um empréstimo, na tela Finanças, pode completar o valor). Dono fica com o lucro, cobre o prejuízo e deixa a equipe para os herdeiros.</p>
          </Card>

          <Card title="Fundar uma equipe">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm text-ink-300">Categoria<br />
                <select value={foundCategory} onChange={(e) => setFoundCategory(e.target.value as CategoryId)} className={cx(input, 'mt-1')}>
                  {CATEGORY_IDS.map((id) => <option key={id} value={id}>{getCategory(id).shortName} · {formatMoney(foundingCost(id))}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink-300">Nome<br /><input value={foundName} maxLength={28} onChange={(e) => setFoundName(e.target.value)} className={cx(input, 'mt-1 w-56')} /></label>
              <label className="text-sm text-ink-300">Cor<br /><input type="color" value={foundColor} onChange={(e) => setFoundColor(e.target.value)} className="mt-1 h-10 w-14 cursor-pointer rounded-lg border border-ink-700 bg-ink-850" /></label>
              <Button variant="primary" disabled={pending || foundingCost(foundCategory) > cash} onClick={() => store.foundTeam(foundCategory, foundName, foundColor)}>{foundingCost(foundCategory) > cash ? 'Sem caixa' : `Fundar (${formatMoney(foundingCost(foundCategory))})`}</Button>
            </div>
            <p className="mt-3 text-xs text-ink-400">A equipe nova ocupa a inscrição da mais fraca da categoria e herda o equipamento dela, um pouco pior. Começa sem instalações, sem equipe técnica e com reputação baixa: tudo por construir.</p>
          </Card>
        </>
      )}
      {career.executiveLog.length > 0 && <LogTable />}
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
            <thead><tr><th className={th}>Temporada</th><th className={th}>Categoria</th><th className={th}>Equipe</th><th className={cx(th, 'text-right')}>Posição</th><th className={cx(th, 'text-right')}>Meta</th><th className={cx(th, 'text-right')}>Resultado</th></tr></thead>
            <tbody>
              {[...career.executiveLog].reverse().map((l) => (
                <tr key={l.season} className="border-t border-ink-800">
                  <td className={cx(td, 'tabular')}>T{l.season}</td>
                  <td className={td}>{getCategory(l.categoryId).shortName}</td>
                  <td className={td}>{l.teamName}</td>
                  <td className={cx(td, 'text-right font-semibold tabular', l.position <= l.target ? 'text-go-400' : 'text-gold-400')}>{l.position}º</td>
                  <td className={cx(td, 'text-right tabular')}>{l.target}º</td>
                  <td className={cx(td, 'text-right tabular', l.profit < 0 ? 'text-apex-400' : 'text-go-400')}>{formatMoney(l.profit, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Card>
  );
}
