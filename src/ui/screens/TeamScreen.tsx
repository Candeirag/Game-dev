import { ROLE_LABELS } from '@/domain/labels';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { computeCareerStats, fullName, getReserve, overallRating, rankTeams } from '@/engine';
import { VEHICLES } from '@/data/vehicles';
import { CarSprite } from '../components/CarSprite';
import { Card, Meter, PageHeader, Pill, Stat, TeamSwatch } from '../components/ui';
import { formatMoney, formatRating } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';

export function TeamScreen() {
  const { career, player, team, teammate, category, drivers, driverStandings, teamStandings, carNumbers } = useCareerView();
  const vehicle = VEHICLES[category.id];
  const reserve = getReserve(career, team.id);
  const rank = rankTeams(career.teams).findIndex((t) => t.id === team.id) + 1;
  const teamPosition = teamStandings.find((s) => s.teamId === team.id);
  const standing = (id: string) => driverStandings.find((s) => s.driverId === id);
  const affiliation = team.affiliation ? F1_TEAM_NAMES.find((_, i) => f1TeamId(i) === team.affiliation) : null;
  const rivalries = Object.entries(career.relations.rivalries).filter(([id]) => drivers[id]).sort((a, b) => b[1] - a[1]);
  const lineup = [player, ...(teammate ? [teammate] : [])].sort((a) => (a.role === 'first' ? -1 : 1));
  const playerStats = computeCareerStats(career, player.id);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${category.shortName} · ${career.year}`} title={team.name}>
        <span className="flex items-center gap-2 text-sm text-ink-400"><TeamSwatch team={team} />{rank}ª força do grid{affiliation ? ` · ligada à academia da ${affiliation}` : ''}</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Equipamento e estrutura">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Motor" value={Math.round(team.car.engine)} />
            <Stat label="Chassi" value={Math.round(team.car.chassis)} />
            <Stat label="Confiabilidade" value={Math.round(team.car.reliability)} />
            <Stat label="Equipe de box" value={Math.round(team.crew)} hint={category.race.pitStops ? 'Paradas mais rápidas' : 'Sem paradas nesta categoria'} />
          </div>
          <p className="mt-4 text-xs text-ink-400">O equipamento evolui entre as temporadas: equipes que superam a expectativa ganham verba; as que decepcionam perdem. Eventos também podem trazer ou cortar atualizações durante o ano.</p>
        </Card>

        <Card title="Objetivos">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Meta do piloto" value={`${team.driverTarget}º`} hint={standing(player.id) && career.rounds.length ? `Você está em ${standing(player.id)?.position}º` : undefined} accent />
            <Stat label="Equipes" value={teamPosition && career.rounds.length ? `${teamPosition.position}º` : '-'} hint={`${teamPosition?.points ?? 0} pontos`} />
          </div>
          <div className="mt-5 space-y-4">
            <Meter label="Confiança da equipe em você" value={career.relations.teamTrust} hint="Sobe com resultados acima da meta e com obediência às ordens; cai com abandonos por erro, danos e punições. Abaixo de 18, a equipe rescinde o contrato." />
          </div>
        </Card>

        <Card title="Seu contrato">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-400">Papel</dt><dd className="font-semibold">{ROLE_LABELS[career.contract.role]}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-400">Vigência</dt><dd>até o fim de {career.year + (career.contract.endSeason - career.season)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-400">Salário anual</dt><dd className="tabular">{formatMoney(career.contract.salary)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-400">Custo anual da vaga</dt><dd className="tabular">{formatMoney(career.contract.seatCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-400">Multa rescisória</dt><dd className="tabular">{formatMoney(career.contract.clauses.releaseFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-400">Cláusula de desempenho</dt><dd>{career.contract.clauses.performanceTarget ? `terminar até o ${career.contract.clauses.performanceTarget}º` : 'não há'}</dd></div>
          </dl>
        </Card>
      </div>

      <Card title={`Garagem · ${vehicle.name}`}>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_1fr_1.1fr]">
          {lineup.map((d) => (
            <div key={d.id} className="text-center">
              <div className="rounded-lg bg-ink-850 px-4 py-5">
                <CarSprite categoryId={category.id} teamId={team.id} color={team.color} driverId={d.id} number={carNumbers[d.id]} className="mx-auto w-full max-w-[260px]" title={`${vehicle.name} de ${fullName(d)}`} />
              </div>
              <div className="mt-2 font-display text-lg font-bold uppercase leading-tight">#{carNumbers[d.id]} {fullName(d)}</div>
              <div className="text-xs text-ink-400">{ROLE_LABELS[d.role ?? 'second']}{d.isPlayer ? ' · você' : ''}</div>
            </div>
          ))}
          <div className="text-sm text-ink-300">
            <p>{vehicle.description}</p>
            <p className="mt-2 text-xs text-ink-400">A pintura é a da equipe; o capacete e o número são de cada piloto. É este o {category.machine} que aparece na pista durante a corrida.</p>
          </div>
        </div>
      </Card>

      <Card title="Pilotos e hierarquia">
        <div className="grid gap-4 md:grid-cols-3">
          {lineup.map((d) => (
            <div key={d.id} className="rounded-lg border border-ink-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{fullName(d)} {d.isPlayer && <span className="text-xs text-apex-400">(você)</span>}</div>
                <Pill tone={d.role === 'first' ? 'accent' : 'neutral'}>{ROLE_LABELS[d.role ?? 'second']}</Pill>
              </div>
              <div className="mt-1 text-sm text-ink-400">{d.age} anos · geral {formatRating(overallRating(d.attributes))}{d.injury ? ` · lesionado (${counted(d.injury.roundsRemaining, 'etapa', 'etapas')})` : ''}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-[11px] uppercase tracking-wider text-ink-400">Camp.</div><div className="font-semibold tabular">{career.rounds.length ? `${standing(d.id)?.position ?? '-'}º` : '-'}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-ink-400">Pontos</div><div className="font-semibold tabular">{standing(d.id)?.points ?? 0}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-ink-400">Vitórias</div><div className="font-semibold tabular">{standing(d.id)?.wins ?? 0}</div></div>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-ink-700 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{reserve ? fullName(reserve) : 'Sem reserva'}</div>
              <Pill>{ROLE_LABELS.reserve}</Pill>
            </div>
            {reserve && <div className="mt-1 text-sm text-ink-400">{reserve.age} anos · geral {formatRating(overallRating(reserve.attributes))}</div>}
            <p className="mt-3 text-xs text-ink-400">O reserva assume o {category.machine} quando um titular está lesionado ou suspenso.</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-400">
          {category.race.teamOrders
            ? 'O primeiro piloto tem prioridade: em corrida, a equipe pode mandar o segundo ceder a posição quando o primeiro vem mais rápido logo atrás. No box, quando os dois param juntos, o de trás espera.'
            : 'Nesta categoria não há ordens de equipe: cada piloto corre por si.'}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Relações">
          <div className="space-y-5">
            <Meter label={teammate ? `Relação com ${fullName(teammate)}` : 'Relação com o companheiro'} value={career.relations.teammate} hint="Melhora quando você coopera (ordens de equipe, dividir peças); piora com disputas internas. Abaixo de 25, a equipe convoca os dois." />
            <Meter label="Moral" value={player.condition.morale} hint="Reage aos resultados, à relação com a equipe e a eventos. Moral baixa reduz o rendimento do treino." />
          </div>
        </Card>
        <Card title="Rivalidades">
          {rivalries.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhuma rivalidade no momento. Elas nascem de toques na pista, de disputas apertadas na tabela e de declarações à imprensa.</p>
          ) : (
            <div className="space-y-4">
              {rivalries.slice(0, 5).map(([id, value]) => (
                <Meter key={id} tone="neutral" label={drivers[id] ? fullName(drivers[id]!) : id} value={value} />
              ))}
              <p className="text-xs text-ink-400">Disputas de posição com um rival têm mais risco de toque: a chance cresce na proporção da rivalidade.</p>
            </div>
          )}
        </Card>
      </div>

      {career.academy && (
        <Card title={career.academy.name}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Apoio na vaga" value={`${Math.round(career.academy.supportShare * 100)}%`} />
            <Stat label="Exigência" value={`até ${career.academy.targetPosition}º`} hint="Posição final em cada temporada" />
            <Stat label="Avisos" value={`${career.academy.strikes} de 2`} hint="Com 2, você é dispensado" />
          </div>
          <p className="mt-3 text-sm text-ink-400">A academia paga parte da vaga, aumenta em 10% o rendimento do treino e chama a atenção das equipes ligadas a ela. Você tem {counted(playerStats.starts, 'largada', 'largadas')} na carreira.</p>
        </Card>
      )}
    </div>
  );
}
