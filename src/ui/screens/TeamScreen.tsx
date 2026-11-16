import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { ROLE_LABELS } from '@/domain/labels';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { computeCareerStats, fullName, getReserve, overallRating, rankTeams } from '@/engine';
import { VEHICLES } from '@/data/vehicles';
import { CarSprite } from '../components/CarSprite';
import { Card, Meter, PageHeader, Stat, Tabs, TeamSwatch, cx } from '../components/ui';
import { NumberPlate } from '../kit/bits';
import { formatMoney, formatRating } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';

type TeamTab = 'team' | 'contract' | 'drivers';
const TABS: { value: TeamTab; label: string }[] = [
  { value: 'team', label: 'Equipe' },
  { value: 'contract', label: 'Contrato' },
  { value: 'drivers', label: 'Pilotos' },
];

/** Altura do desenho do veículo na garagem, em px; a largura segue a proporção de cada categoria. */
const SPRITE_HEIGHT = 52;

/** Linha de contrato: rótulo à esquerda, valor à direita; o valor desce de linha se não couber. */
function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-ink-400">{label}</dt>
      <dd className="ml-auto text-right">{children}</dd>
    </div>
  );
}

/** Número pequeno da tabela de pilotos (campeonato, pontos, vitórias). */
function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="w-11 text-right">
      <dt className="text-[11px] font-medium text-ink-400">{label}</dt>
      <dd className="font-display text-lg font-semibold leading-tight">{value}</dd>
    </div>
  );
}

export function TeamScreen() {
  const { career, player, team, teammate, category, drivers, driverStandings, teamStandings, carNumbers } = useCareerView();
  // A aba fica no endereço (?tab=...), como nas outras telas com abas.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TeamTab = TABS.find((t) => t.value === requested)?.value ?? 'team';
  const setTab = (next: TeamTab) => setParams(next === 'team' ? {} : { tab: next }, { replace: true });
  const vehicle = VEHICLES[category.id];
  const reserve = getReserve(career, team.id);
  const rank = rankTeams(career.teams).findIndex((t) => t.id === team.id) + 1;
  const teamPosition = teamStandings.find((s) => s.teamId === team.id);
  const standing = (id: string) => driverStandings.find((s) => s.driverId === id);
  const affiliation = team.affiliation ? F1_TEAM_NAMES.find((_, i) => f1TeamId(i) === team.affiliation) : null;
  const rivalries = Object.entries(career.relations.rivalries)
    .filter(([id]) => drivers[id])
    .sort((a, b) => b[1] - a[1]);
  const lineup = [player, ...(teammate ? [teammate] : [])].sort((a, b) => Number(b.role === 'first') - Number(a.role === 'first'));
  const playerStats = computeCareerStats(career, player.id);
  const spriteWidth = Math.round((SPRITE_HEIGHT * vehicle.length) / vehicle.width);

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <TeamSwatch team={team} />
            {category.shortName} · {career.year} · {rank}ª força do grid
          </span>
        }
        title={team.name}
      >
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </PageHeader>

      {tab === 'team' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card title={`Garagem · ${vehicle.name}`} bodyClassName="p-3">
            <ul className="space-y-2">
              {lineup.map((d) => (
                <li key={d.id} className="flex items-center gap-3 bg-ink-850 px-2 py-1.5">
                  <div className="grid w-[min(42%,160px)] shrink-0 place-items-center" style={{ minHeight: SPRITE_HEIGHT }}>
                    <CarSprite
                      categoryId={category.id}
                      teamId={team.id}
                      color={team.color}
                      driverId={d.id}
                      number={carNumbers[d.id]}
                      className="w-full"
                      style={{ maxWidth: spriteWidth }}
                      title={`${vehicle.name} de ${fullName(d)}`}
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <NumberPlate number={carNumbers[d.id]} color={team.color} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold uppercase leading-tight">{fullName(d)}</div>
                      <div className="text-xs text-ink-400">
                        {ROLE_LABELS[d.role ?? 'second']}
                        {d.isPlayer ? ' · você' : ''}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-400">
              <span className="text-ink-300">{vehicle.description}</span> A pintura é a da equipe; o capacete e o número são de cada piloto. É este o{' '}
              {category.machine} que aparece na pista durante a corrida.
            </p>
          </Card>

          <Card title="Equipamento e estrutura" bodyClassName="p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Meter tone="neutral" label="Motor" value={team.car.engine} />
              <Meter tone="neutral" label="Chassi" value={team.car.chassis} />
              <Meter tone="neutral" label="Confiabilidade" value={team.car.reliability} />
              <Meter tone="neutral" label="Equipe de box" value={team.crew} />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              {category.race.pitStops ? 'Uma equipe de box melhor faz paradas mais rápidas.' : 'Sem paradas nesta categoria, a equipe de box não conta.'} O
              equipamento evolui entre as temporadas: quem supera a expectativa ganha verba, quem decepciona perde. Eventos também podem trazer ou cortar
              atualizações durante o ano.
            </p>
            {affiliation && (
              <p className="mt-3 flex items-center gap-2 border-t border-ink-700 pt-3 text-xs text-ink-300">
                <GraduationCap size={16} className="shrink-0 text-ink-400" aria-hidden />
                Ligada à academia da {affiliation}
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'contract' && (
        <div className={cx('grid items-start gap-4', career.academy ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          <Card title="Seu contrato" bodyClassName="p-3">
            <dl className="space-y-1.5 text-sm">
              <Term label="Papel">
                <span className="font-semibold">{ROLE_LABELS[career.contract.role]}</span>
              </Term>
              <Term label="Vigência">até o fim de {career.year + (career.contract.endSeason - career.season)}</Term>
              <Term label="Salário anual">{formatMoney(career.contract.salary)}</Term>
              <Term label="Custo anual da vaga">{formatMoney(career.contract.seatCost)}</Term>
              <Term label="Multa rescisória">{formatMoney(career.contract.clauses.releaseFee)}</Term>
              <Term label="Cláusula de desempenho">
                {career.contract.clauses.performanceTarget ? `terminar até o ${career.contract.clauses.performanceTarget}º` : 'não há'}
              </Term>
            </dl>
          </Card>

          <Card title="Objetivos" bodyClassName="p-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Meta do piloto"
                value={`${team.driverTarget}º`}
                hint={standing(player.id) && career.rounds.length ? `Você está em ${standing(player.id)?.position}º` : undefined}
                accent
              />
              <Stat
                label="Equipes"
                value={teamPosition && career.rounds.length ? `${teamPosition.position}º` : '-'}
                hint={counted(teamPosition?.points ?? 0, 'ponto', 'pontos')}
              />
            </div>
            <div className="mt-3">
              <Meter
                label="Confiança da equipe em você"
                value={career.relations.teamTrust}
                hint="Sobe com resultados acima da meta e com obediência às ordens; cai com abandonos por erro, danos e punições. Abaixo de 18, a equipe rescinde o contrato."
              />
            </div>
          </Card>

          {career.academy && (
            <Card title={career.academy.name} bodyClassName="p-3">
              <div className="grid grid-cols-3 items-end gap-3">
                <Stat label="Apoio na vaga" value={`${Math.round(career.academy.supportShare * 100)}%`} />
                <Stat label="Exigência" value={`até ${career.academy.targetPosition}º`} />
                <Stat label="Avisos" value={`${career.academy.strikes} de 2`} />
              </div>
              <p className="mt-3 text-xs text-ink-400">
                A academia paga parte da vaga, aumenta em 10% o rendimento do treino e chama a atenção das equipes ligadas a ela. A exigência vale para a
                posição final de cada temporada; com 2 avisos, você é dispensado. Você tem {counted(playerStats.starts, 'largada', 'largadas')} na carreira.
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === 'drivers' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card title="Pilotos e hierarquia" bodyClassName="p-3">
            <ul className="divide-y divide-ink-700">
              {lineup.map((d) => {
                const s = standing(d.id);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight">
                        {fullName(d)} {d.isPlayer && <span className="text-xs font-normal text-apex-400">(você)</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        <span className="font-semibold text-ink-200">{ROLE_LABELS[d.role ?? 'second']}</span> · {d.age} anos · geral{' '}
                        {formatRating(overallRating(d.attributes))}
                        {d.injury ? ` · lesionado (${counted(d.injury.roundsRemaining, 'etapa', 'etapas')})` : ''}
                      </div>
                    </div>
                    <dl className="flex shrink-0 gap-2">
                      <Figure label="Camp." value={career.rounds.length ? `${s?.position ?? '-'}º` : '-'} />
                      <Figure label="Pontos" value={s?.points ?? 0} />
                      <Figure label="Vitórias" value={s?.wins ?? 0} />
                    </dl>
                  </li>
                );
              })}
              <li className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{reserve ? fullName(reserve) : 'Sem reserva'}</div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    <span className="font-semibold text-ink-200">{ROLE_LABELS.reserve}</span>
                    {reserve ? ` · ${reserve.age} anos · geral ${formatRating(overallRating(reserve.attributes))}` : ''}
                  </div>
                </div>
                <p className="w-[min(11.5rem,50%)] shrink-0 text-right text-xs text-ink-400">
                  O reserva assume o {category.machine} quando um titular está lesionado ou suspenso.
                </p>
              </li>
            </ul>
            <p className="border-t border-ink-700 pt-2 text-xs text-ink-400">
              {category.race.teamOrders
                ? 'O primeiro piloto tem prioridade: em corrida, a equipe pode mandar o segundo ceder a posição quando o primeiro vem mais rápido logo atrás. No box, quando os dois param juntos, o de trás espera.'
                : 'Nesta categoria não há ordens de equipe: cada piloto corre por si.'}
            </p>
          </Card>

          <Card title="Relações" bodyClassName="space-y-3 p-3">
            <Meter
              label={teammate ? `Relação com ${fullName(teammate)}` : 'Relação com o companheiro'}
              value={career.relations.teammate}
              hint="Melhora quando você coopera (ordens de equipe, dividir peças); piora com disputas internas. Abaixo de 25, a equipe convoca os dois."
            />
            <Meter
              label="Moral"
              value={player.condition.morale}
              hint="Reage aos resultados, à relação com a equipe e a eventos. Moral baixa reduz o rendimento do treino."
            />
          </Card>

          <Card title="Rivalidades" className="md:col-span-2" bodyClassName="p-3">
            {rivalries.length === 0 ? (
              <p className="text-sm text-ink-400">
                Nenhuma rivalidade no momento. Elas nascem de toques na pista, de disputas apertadas na tabela e de declarações à imprensa.
              </p>
            ) : (
              <>
                <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
                  {rivalries.slice(0, 5).map(([id, value]) => (
                    <Meter key={id} tone="neutral" label={drivers[id] ? fullName(drivers[id]) : id} value={value} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-400">
                  Disputas de posição com um rival têm mais risco de toque: a chance cresce na proporção da rivalidade.
                </p>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
