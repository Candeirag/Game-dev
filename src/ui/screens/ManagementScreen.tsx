/** Gestão da equipe: orçamento, equipe técnica, instalações, desenvolvimento e pilotos. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEV_AREAS, FACILITY_KEYS, RESEARCH_SPENDS, STAFF_ROLES, type DevArea, type ManagedTeam } from '@/domain/schemas';
import { DEV_AREA_LABELS, RESEARCH_SPEND_LABELS, ROLE_LABELS, STAFF_ROLE_LABELS, TEAM_LEDGER_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { DEV_EFFECTS, FACILITY_INFO, MANAGEMENT, REGULATIONS, STAFF_ROLE_EFFECTS, TEAM_ECONOMY } from '@/data/management';
import {
  VACANT_RATING,
  facilityUpgradeCost,
  fullName,
  managedTeam,
  managedTeamPosition,
  overallRating,
  ownedTeamValue,
  principalRating,
  researchCostPerRound,
  researchNeeded,
  researchRate,
  teamBudgetForecast,
  windTunnelAllowance,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, ChoiceCard, EmptyState, Meter, PageHeader, Pill, RatingBar, Stat, TableWrap, Tabs, cx, td, th } from '../components/ui';
import { formatMoney } from '../format';
import { useCareer } from '../hooks/useCareer';

type Tab = 'overview' | 'staff' | 'facilities' | 'development' | 'drivers';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Orçamento' },
  { value: 'staff', label: 'Equipe técnica' },
  { value: 'facilities', label: 'Instalações' },
  { value: 'development', label: 'Desenvolvimento' },
  { value: 'drivers', label: 'Pilotos' },
];
const number = (v: number, digits = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits });

export function ManagementScreen() {
  const career = useCareer();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const m = career.management;
  const team = managedTeam(career);
  if (!m || !team) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Gestão" title="Sem equipe" />
        <EmptyState title="Você não comanda nenhuma equipe">
          No fechamento de cada temporada, a tela Carreira traz as propostas para chefiar uma equipe, as equipes à venda e a opção de fundar a sua.
          <div className="mt-4"><Button variant="primary" onClick={() => navigate('/career')}>Ver a tela Carreira</Button></div>
        </EmptyState>
      </div>
    );
  }
  const category = getCategory(m.categoryId);
  const position = managedTeamPosition(career);
  const forecast = teamBudgetForecast(career);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${category.shortName} · ${m.position === 'owner' ? 'Você é o dono' : 'Chefe de equipe contratado'}`} title={team.name}>
        <span className="text-sm text-ink-400">Campeonato de equipes: <b className={cx('tabular', position !== null && position <= m.boardTarget ? 'text-go-400' : 'text-gold-400')}>{position ?? '-'}º</b> (meta: {m.boardTarget}º)</span>
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Caixa da equipe" value={<span className={m.budget < 0 ? 'text-apex-400' : ''}>{formatMoney(m.budget)}</span>} hint={m.budget < 0 ? 'No vermelho: a pesquisa para' : 'Separado do seu dinheiro'} /></Card>
        <Card><Stat label="Resultado previsto" value={<span className={forecast.net < 0 ? 'text-apex-400' : 'text-go-400'}>{formatMoney(forecast.net, { sign: true })}</span>} hint="Por temporada, sem danos e eventos" /></Card>
        <Card><Stat label="Reputação da equipe" value={Math.round(m.reputation)} hint="Atrai patrocinadores, pilotos e profissionais" /></Card>
        <Card><Stat label={m.position === 'owner' ? 'Valor da equipe' : 'Seu salário'} value={formatMoney(m.position === 'owner' ? ownedTeamValue(career) : m.salary)} hint={m.position === 'owner' ? `Comprada por ${formatMoney(m.purchasePrice)}` : m.strikes > 0 ? 'Advertido pela diretoria' : 'Por temporada'} accent /></Card>
      </div>

      <div className="overflow-x-auto"><Tabs value={tab} options={TABS} onChange={setTab} /></div>
      {tab === 'overview' && <Overview m={m} />}
      {tab === 'staff' && <Staff m={m} />}
      {tab === 'facilities' && <Facilities m={m} />}
      {tab === 'development' && <Development m={m} />}
      {tab === 'drivers' && <Drivers m={m} />}
    </div>
  );
}

function Overview({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const { ownerTransfer, dropTeamSponsor } = useGameStore.getState();
  const [amount, setAmount] = useState('100000');
  const forecast = teamBudgetForecast(career);
  const team = managedTeam(career);
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const rows = [...Object.entries(forecast.income).map(([key, v]) => ({ key, planned: v })), ...Object.entries(forecast.expenses).map(([key, v]) => ({ key, planned: -v }))];
  const extra = Object.keys(m.ledger).filter((key) => !rows.some((r) => r.key === key));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Receitas e despesas" padded={false}>
        <div className="px-4">
          <table className="w-full">
            <thead><tr><th className={th}>Conta</th><th className={cx(th, 'text-right')}>Previsto no ano</th><th className={cx(th, 'text-right')}>Realizado</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-ink-800">
                  <td className={td}>{TEAM_LEDGER_LABELS[r.key] ?? r.key}</td>
                  <td className={cx(td, 'text-right tabular', r.planned < 0 ? 'text-apex-400' : 'text-go-400')}>{formatMoney(r.planned, { sign: true })}</td>
                  <td className={cx(td, 'text-right tabular text-ink-300')}>{formatMoney(m.ledger[r.key] ?? 0, { sign: true })}</td>
                </tr>
              ))}
              {extra.map((key) => (
                <tr key={key} className="border-t border-ink-800">
                  <td className={td}>{TEAM_LEDGER_LABELS[key] ?? key}</td>
                  <td className={cx(td, 'text-right text-ink-500')}>-</td>
                  <td className={cx(td, 'text-right tabular text-ink-300')}>{formatMoney(m.ledger[key] ?? 0, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-ink-400">
          Os valores anuais entram em parcelas iguais a cada etapa. O prêmio vem da posição no campeonato anterior. {m.position === 'owner' ? 'Se o ano fechar no vermelho, a diferença sai do seu bolso.' : 'Os donos retiram o lucro acumulado no fim do ano; fechar no vermelho rende advertência.'}
        </p>
      </Card>

      <div className="space-y-6">
        <Card title="Patrocinadores" action={<span className="text-xs text-ink-400">{m.sponsors.length} de {MANAGEMENT.SPONSOR_SLOTS} cotas</span>}>
          {m.sponsors.length === 0 ? <p className="text-sm text-ink-400">Nenhum patrocinador. As propostas chegam no fechamento da temporada.</p> : (
            <ul className="space-y-3">
              {m.sponsors.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-ink-400">{formatMoney(s.perSeason)} por temporada · exige a equipe entre as {s.targetPosition} primeiras · até {career.year + (s.endSeason - career.season)}</div>
                  </div>
                  <Button variant="ghost" onClick={() => dropTeamSponsor(s.id)}>Dispensar</Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-400">Um patrocinador rompe o contrato se a equipe terminar mais de duas posições abaixo do que ele exige.</p>
        </Card>

        {team && (
          <Card title="Equipamento">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Motor" value={number(team.car.engine)} hint={`Base do ano: ${number(m.baseCar.engine)}`} />
              <Stat label="Chassi" value={number(team.car.chassis)} hint={`Base do ano: ${number(m.baseCar.chassis)}`} />
              <Stat label="Confiabilidade" value={number(team.car.reliability)} hint={`Base do ano: ${number(m.baseCar.reliability)}`} />
              <Stat label="Boxes" value={team.crew} hint="Mecânicos e chefias" />
            </div>
          </Card>
        )}

        {m.position === 'owner' && (
          <Card title="Caixa do dono">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm text-ink-300">Valor (€)<br /><input type="number" min={0} step={10000} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-40 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm tabular text-ink-100 focus:border-apex-500 focus:outline-none" /></label>
              <Button disabled={value <= 0 || value > career.finance.cash} onClick={() => ownerTransfer(value)}>Aportar na equipe</Button>
              <Button variant="ghost" disabled={value <= 0} onClick={() => ownerTransfer(-value)}>Retirar lucros</Button>
            </div>
            <p className="mt-3 text-xs text-ink-400">Seu caixa pessoal: {formatMoney(career.finance.cash)}. A retirada entra na sua renda tributável, e a equipe precisa manter uma reserva de {formatMoney(TEAM_ECONOMY[m.categoryId].operations * MANAGEMENT.RESERVE)}.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Staff({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const { hireStaff, dismissStaff, setDepartment } = useGameStore.getState();
  const salary = TEAM_ECONOMY[m.categoryId].staffSalary * MANAGEMENT.DEPARTMENT_SALARY;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {STAFF_ROLES.map((role) => {
          const current = m.staff.find((s) => s.role === role);
          const self = role === 'principal' && !current;
          const rating = self ? principalRating(career) : (current?.rating ?? VACANT_RATING);
          const market = m.staffMarket.filter((s) => s.role === role);
          const blocked = role === 'principal' && m.position !== 'owner';
          return (
            <Card key={role} title={STAFF_ROLE_LABELS[role]} action={<span className="font-display text-xl font-bold tabular">{Math.round(rating)}</span>}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{current ? current.name : self ? 'Você comanda a equipe' : 'Função vaga (interino)'}</div>
                  <div className="text-xs text-ink-400">{current ? `${formatMoney(current.salary)} por temporada · contrato até ${career.year + (current.contractEnd - career.season)}` : self ? 'A sua nota cresce com a experiência como dirigente e com a reputação.' : 'Um interino rende pouco.'}</div>
                </div>
                {current && <Button variant="ghost" onClick={() => dismissStaff(role)}>Dispensar</Button>}
              </div>
              <div className="mt-2"><RatingBar value={rating} /></div>
              <p className="mt-2 text-xs text-ink-400">{STAFF_ROLE_EFFECTS[role]}</p>
              {market.length > 0 && !blocked && (
                <ul className="mt-3 space-y-2 border-t border-ink-800 pt-3">
                  {market.map((candidate) => (
                    <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{candidate.name} · nota <b className="tabular">{candidate.rating}</b> · <span className="text-ink-400">{formatMoney(candidate.salary)} por temporada</span></span>
                      <Button onClick={() => hireStaff(candidate.id)}>Contratar</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      <Card title="Departamentos">
        <div className="grid gap-6 md:grid-cols-2">
          {(['engineers', 'mechanics'] as const).map((department) => (
            <div key={department}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{department === 'engineers' ? 'Engenharia' : 'Mecânicos'}</div>
                  <div className="text-xs text-ink-400">{department === 'engineers' ? 'Cada nível soma um ponto-base de pesquisa por etapa (e aumenta o custo da pesquisa).' : 'Cada nível melhora os boxes em 7 pontos: paradas mais rápidas e menos erros.'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={m[department] <= 1} onClick={() => setDepartment(department, m[department] - 1)} aria-label="Reduzir">−</Button>
                  <span className="w-16 text-center font-display text-xl font-bold tabular">Nível {m[department]}</span>
                  <Button disabled={m[department] >= 5} onClick={() => setDepartment(department, m[department] + 1)} aria-label="Aumentar">+</Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-ink-400">Folha: {formatMoney(m[department] * salary)} por temporada ({formatMoney(salary)} por nível).</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Facilities({ m }: { m: ManagedTeam }) {
  const upgradeFacility = useGameStore((s) => s.upgradeFacility);
  const economy = TEAM_ECONOMY[m.categoryId];
  const closed = !REGULATIONS[m.categoryId].open.aero;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {FACILITY_KEYS.map((key) => {
          const level = m.facilities[key];
          const cost = facilityUpgradeCost(m, key);
          const useless = key === 'windTunnel' && closed;
          return (
            <Card key={key} title={FACILITY_INFO[key].name} action={<span className="font-display text-xl font-bold tabular">Nível {level}</span>}>
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cx('h-2 flex-1 rounded-full', i <= level ? 'bg-go-400' : 'bg-ink-800')} />)}
              </div>
              <p className="mt-3 text-sm text-ink-300">{FACILITY_INFO[key].effect}</p>
              {useless && <p className="mt-2 text-xs text-gold-400">O regulamento desta categoria não permite desenvolvimento aerodinâmico.</p>}
              <Button className="mt-4" disabled={level >= 5 || cost > m.budget || useless} onClick={() => upgradeFacility(key)}>{level >= 5 ? 'Nível máximo' : `Ampliar (${formatMoney(cost)})`}</Button>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-400">As obras saem do caixa da equipe. A manutenção custa {formatMoney(economy.facilityCost * MANAGEMENT.FACILITY_UPKEEP)} por nível, por temporada. As instalações ficam com a equipe e entram no valor dela.</p>
    </div>
  );
}

function Development({ m }: { m: ManagedTeam }) {
  const setDevelopment = useGameStore((s) => s.setDevelopment);
  const setAreaShare = useGameStore((s) => s.setAreaShare);
  const rules = REGULATIONS[m.categoryId];
  const economy = TEAM_ECONOMY[m.categoryId];
  const rate = researchRate(m);
  const cost = researchCostPerRound(m);
  const allowance = windTunnelAllowance(m);
  const setShare = (area: DevArea, value: number) => setAreaShare(area, value);
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-1">
        <Card title="Regulamento técnico">
          <p className="text-sm text-ink-300">{rules.summary}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {DEV_AREAS.map((area) => <li key={area} className="flex items-center justify-between"><span>{DEV_AREA_LABELS[area]}</span><Pill tone={rules.open[area] ? 'good' : 'bad'}>{rules.open[area] ? 'Livre' : 'Fechado'}</Pill></li>)}
          </ul>
          <p className="mt-3 text-xs text-ink-400">Limite: {rules.maxGainsPerArea} melhorias por área em cada temporada.{economy.budgetCap !== null && ` Teto de gastos com desenvolvimento: ${formatMoney(economy.budgetCap)} por temporada.`}{m.categoryId === 'f1' && ` Horas de túnel de vento: ${Math.round(allowance * 100)}% (quem termina na frente recebe menos).`}</p>
        </Card>
        <Card title="Ritmo da pesquisa">
          <div className="grid gap-2">
            {RESEARCH_SPENDS.map((spend) => (
              <ChoiceCard key={spend} selected={m.development.spend === spend} onSelect={() => setDevelopment({ spend })} title={RESEARCH_SPEND_LABELS[spend]} description={`${number(MANAGEMENT.SPEND[spend].points)} ponto(s) por nível de engenharia, a ${number(MANAGEMENT.SPEND[spend].cost)}× o custo.`} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Pesquisa por etapa" value={`${number(rate)} pts`} />
            <Stat label="Custo por etapa" value={formatMoney(cost)} />
          </div>
          {economy.budgetCap !== null && <div className="mt-4"><Meter label="Teto de gastos usado" value={(m.development.spent / economy.budgetCap) * 100} hint={`${formatMoney(m.development.spent)} de ${formatMoney(economy.budgetCap)}`} tone="neutral" /></div>}
        </Card>
      </div>

      <Card title="Áreas de desenvolvimento" className="xl:col-span-2">
        <div className="space-y-5">
          {DEV_AREAS.map((area) => {
            const open = rules.open[area];
            const gains = m.development.gains[area];
            const maxed = gains >= rules.maxGainsPerArea;
            const needed = researchNeeded(gains);
            const share = m.development.allocation[area];
            const effect = DEV_EFFECTS[area];
            const parts = [effect.engine ? `motor +${number(effect.engine)}` : '', effect.chassis ? `chassi +${number(effect.chassis)}` : '', effect.reliability ? `confiabilidade +${number(effect.reliability)}` : ''].filter(Boolean).join(', ');
            return (
              <div key={area} className={cx('rounded-lg border border-ink-800 p-4', !open && 'opacity-50')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold">{DEV_AREA_LABELS[area]} <span className="text-xs font-normal text-ink-400">cada melhoria: {parts}</span></div>
                  <div className="text-sm tabular text-ink-300">{gains} de {rules.maxGainsPerArea} melhorias</div>
                </div>
                {open ? (
                  <>
                    <div className="mt-3 flex items-center gap-3">
                      <input aria-label={`Esforço em ${DEV_AREA_LABELS[area]}`} type="range" min={0} max={100} step={5} value={Math.round(share * 100)} onChange={(e) => setShare(area, Number(e.target.value) / 100)} className="h-1.5 flex-1 accent-(--color-apex-500)" />
                      <span className="w-12 text-right text-sm font-semibold tabular">{Math.round(share * 100)}%</span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-ink-400"><span>{maxed ? 'Limite do regulamento atingido nesta temporada' : `Próxima melhoria: ${number(m.development.progress[area])} de ${number(needed)} pontos`}</span>{!maxed && share > 0 && <span>cerca de {Math.max(1, Math.ceil((needed - m.development.progress[area]) / Math.max(0.01, rate * share)))} etapa(s)</span>}</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-sky-400" style={{ width: `${maxed ? 100 : Math.min(100, (m.development.progress[area] / needed) * 100)}%` }} /></div>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-ink-400">Fechado pelo regulamento desta categoria.</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-400">
          Ao mexer em uma área, as demais são reajustadas para a soma dar 100%. Cada melhoria seguinte de uma mesma área custa {Math.round(MANAGEMENT.RESEARCH_GROWTH * 100)}% mais pesquisa. As rivais também evoluem durante o ano: na virada da temporada, a evolução média do grid é descontada de todos, e o que a sua equipe ganhou acima da média perde {Math.round((1 - MANAGEMENT.CARRY_OVER) * 100)}%.
        </p>
      </Card>
    </div>
  );
}

function Drivers({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const lineup = career.drivers.filter((d) => d.teamId === m.teamId).sort((a, b) => (a.role === 'first' ? 0 : a.role === 'second' ? 1 : 2) - (b.role === 'first' ? 0 : b.role === 'second' ? 1 : 2));
  const children = new Set(career.family.children.map((c) => c.driver?.id));
  return (
    <Card title="Pilotos da equipe" padded={false}>
      <div className="px-4">
        <TableWrap>
          <table className="w-full">
            <thead><tr><th className={th}>Piloto</th><th className={th}>Função</th><th className={cx(th, 'text-right')}>Idade</th><th className={cx(th, 'text-right')}>Nota</th><th className={cx(th, 'text-right')}>Potencial</th><th className={cx(th, 'text-right')}>Moral</th><th className={cx(th, 'text-right')}>Salário</th><th className={cx(th, 'text-right')}>Paga pela vaga</th><th className={cx(th, 'text-right')}>Contrato</th></tr></thead>
            <tbody>
              {lineup.map((d) => {
                const deal = m.deals[d.id];
                return (
                  <tr key={d.id} className="border-t border-ink-800">
                    <td className={cx(td, 'font-semibold')}>{fullName(d)} {children.has(d.id) && <Pill tone="good">Família</Pill>} {d.injury && <Pill tone="bad">Lesionado</Pill>}</td>
                    <td className={cx(td, 'text-ink-300')}>{d.role ? ROLE_LABELS[d.role] : '-'}</td>
                    <td className={cx(td, 'text-right tabular')}>{d.age}</td>
                    <td className={cx(td, 'text-right font-semibold tabular')}>{Math.floor(overallRating(d.attributes))}</td>
                    <td className={cx(td, 'text-right tabular text-ink-300')}>{Math.floor(d.potential)}</td>
                    <td className={cx(td, 'text-right tabular')}>{Math.round(d.condition.morale)}</td>
                    <td className={cx(td, 'text-right tabular')}>{deal?.salary ? formatMoney(deal.salary) : '-'}</td>
                    <td className={cx(td, 'text-right tabular')}>{deal?.seatFee ? formatMoney(deal.seatFee) : '-'}</td>
                    <td className={cx(td, 'text-right tabular text-ink-300')}>{career.year + (Math.max(d.contractEnd, career.season) - career.season)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <p className="px-4 py-3 text-xs text-ink-400">A dupla da próxima temporada é escolhida no fechamento do ano, na tela Carreira. No fim de semana, você define o programa de treino e a abordagem de classificação dos dois pilotos. O simulador da equipe acelera a evolução deles.</p>
    </Card>
  );
}
