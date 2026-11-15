/**
 * Gestão da equipe: orçamento, equipe técnica, instalações, desenvolvimento e pilotos.
 *
 * Uma aba por assunto, guardada no endereço (`?tab=`), e cada aba em duas ou três colunas
 * para caber na tela deitada (844×390).
 */
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DEV_AREAS, FACILITY_KEYS, RESEARCH_SPENDS, STAFF_ROLES, type DevArea, type ManagedTeam, type StaffRole } from '@/domain/schemas';
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
import { Button, Card, EmptyState, Meter, PageHeader, Pill, RatingBar, Stat, TableWrap, Tabs, cx, td, th } from '../components/ui';
import { currencySymbol, formatMoney } from '../format';
import { useCareer } from '../hooks/useCareer';
import { counted } from '@/domain/text';

type Tab = 'overview' | 'staff' | 'facilities' | 'development' | 'drivers';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Orçamento' },
  { value: 'staff', label: 'Equipe técnica' },
  { value: 'facilities', label: 'Instalações' },
  { value: 'development', label: 'Desenvolvimento' },
  { value: 'drivers', label: 'Pilotos' },
];
const number = (v: number, digits = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits });
/** Linhas de tabela mais baixas, para a tabela de contas caber na tela deitada. */
const tight = '!py-1.5';

export function ManagementScreen() {
  const career = useCareer();
  const navigate = useNavigate();
  // A aba fica no endereço (?tab=...), como nas outras telas com abas.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.find((t) => t.value === requested)?.value ?? 'overview';
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  const m = career.management;
  const team = managedTeam(career);
  if (!m || !team) {
    return (
      <div className="space-y-3">
        <PageHeader eyebrow="Gestão" title="Sem equipe" />
        <EmptyState title="Você não comanda nenhuma equipe">
          No fechamento de cada temporada, a tela Carreira traz as propostas para chefiar uma equipe, as equipes à venda e a opção de fundar a sua.
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate('/career')}>
              Ver a tela Carreira
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }
  const category = getCategory(m.categoryId);
  const position = managedTeamPosition(career);

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={
          <>
            {category.shortName} · {m.position === 'owner' ? 'Você é o dono' : 'Chefe de equipe contratado'} · Campeonato de equipes:{' '}
            <b className={cx('tabular', position !== null && position <= m.boardTarget ? 'text-go-400' : 'text-gold-400')}>
              {position !== null ? `${position}º` : '-'}
            </b>{' '}
            (meta: {m.boardTarget}º)
          </>
        }
        title={team.name}
      >
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </PageHeader>

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
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const rows = [
    ...Object.entries(forecast.income).map(([key, v]) => ({ key, planned: v })),
    ...Object.entries(forecast.expenses).map(([key, v]) => ({ key, planned: -v })),
  ];
  const extra = Object.keys(m.ledger).filter((key) => !rows.some((r) => r.key === key));
  return (
    <div className="space-y-3">
      <Card bodyClassName="grid grid-cols-2 gap-3 !p-3 md:grid-cols-4">
        <Stat
          label="Caixa da equipe"
          value={<span className={m.budget < 0 ? 'text-gold-400' : ''}>{formatMoney(m.budget)}</span>}
          hint={m.budget < 0 ? 'No vermelho: a pesquisa para' : 'Separado do seu dinheiro'}
        />
        <Stat
          label="Resultado previsto"
          value={<span className={forecast.net < 0 ? 'text-gold-400' : 'text-go-400'}>{formatMoney(forecast.net, { sign: true })}</span>}
          hint="Por temporada, sem danos e eventos"
        />
        <Stat label="Reputação da equipe" value={Math.round(m.reputation)} hint="Atrai patrocinadores, pilotos e profissionais" />
        <Stat
          label={m.position === 'owner' ? 'Valor da equipe' : 'Seu salário'}
          value={formatMoney(m.position === 'owner' ? ownedTeamValue(career) : m.salary)}
          hint={m.position === 'owner' ? `Comprada por ${formatMoney(m.purchasePrice)}` : m.strikes > 0 ? 'Advertido pela diretoria' : 'Por temporada'}
          accent
        />
      </Card>

      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card title="Receitas e despesas" padded={false}>
          <div className="px-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={cx(th, tight)}>Conta</th>
                  <th className={cx(th, tight, 'whitespace-nowrap text-right')}>Previsto no ano</th>
                  <th className={cx(th, tight, 'text-right')}>Realizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-ink-800">
                    <td className={cx(td, tight)}>{TEAM_LEDGER_LABELS[r.key] ?? r.key}</td>
                    <td className={cx(td, tight, 'whitespace-nowrap text-right tabular', r.planned < 0 ? 'text-gold-400' : 'text-go-400')}>
                      {formatMoney(r.planned, { sign: true })}
                    </td>
                    <td className={cx(td, tight, 'whitespace-nowrap text-right tabular text-ink-300')}>{formatMoney(m.ledger[r.key] ?? 0, { sign: true })}</td>
                  </tr>
                ))}
                {extra.map((key) => (
                  <tr key={key} className="border-t border-ink-800">
                    <td className={cx(td, tight)}>{TEAM_LEDGER_LABELS[key] ?? key}</td>
                    <td className={cx(td, tight, 'text-right text-ink-500')}>-</td>
                    <td className={cx(td, tight, 'whitespace-nowrap text-right tabular text-ink-300')}>{formatMoney(m.ledger[key] ?? 0, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-800 px-4 py-2.5 text-xs text-ink-400">
            Os valores anuais entram em parcelas iguais a cada etapa. O prêmio vem da posição no campeonato anterior.{' '}
            {m.position === 'owner'
              ? 'Se o ano fechar no vermelho, a diferença sai do seu bolso.'
              : 'Os donos retiram o lucro acumulado no fim do ano; fechar no vermelho rende advertência.'}
          </p>
        </Card>

        <div className="space-y-3">
          <Card
            title="Patrocinadores"
            action={
              <span className="text-xs text-ink-400">
                {m.sponsors.length} de {MANAGEMENT.SPONSOR_SLOTS} cotas
              </span>
            }
            bodyClassName="!p-3"
          >
            {m.sponsors.length === 0 ? (
              <p className="text-sm text-ink-400">Nenhum patrocinador. As propostas chegam no fechamento da temporada.</p>
            ) : (
              <ul className="space-y-1.5">
                {m.sponsors.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 bg-ink-850 py-0.5 pl-3 pr-1 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="text-xs text-ink-400">
                        {formatMoney(s.perSeason)} por temporada · entre as {s.targetPosition} primeiras · até {career.year + (s.endSeason - career.season)}
                      </div>
                    </div>
                    <Button variant="ghost" className="shrink-0" onClick={() => dropTeamSponsor(s.id)}>
                      Dispensar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-400">
              Cada patrocinador exige uma posição no campeonato e rompe o contrato se a equipe terminar mais de duas posições abaixo dela.
            </p>
          </Card>

          {m.position === 'owner' && (
            <Card title="Caixa do dono" bodyClassName="!p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-ink-300">
                  Valor ({currencySymbol()})
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 block min-h-11 w-32 border border-ink-700 bg-ink-850 px-3 text-sm tabular text-ink-100 focus:border-apex-500 focus:outline-none"
                  />
                </label>
                <Button disabled={value <= 0 || value > career.finance.cash} onClick={() => ownerTransfer(value)}>
                  Aportar na equipe
                </Button>
                <Button variant="ghost" disabled={value <= 0} onClick={() => ownerTransfer(-value)}>
                  Retirar lucros
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Seu caixa pessoal: {formatMoney(career.finance.cash)}. A retirada entra na sua renda tributável, e a equipe precisa manter uma reserva de{' '}
                {formatMoney(TEAM_ECONOMY[m.categoryId].operations * MANAGEMENT.RESERVE)}.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Staff({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const { hireStaff, dismissStaff, setDepartment } = useGameStore.getState();
  // À esquerda, as cinco funções; à direita, a função escolhida, com os nomes disponíveis no mercado.
  const [role, setRole] = useState<StaffRole>('principal');
  const salary = TEAM_ECONOMY[m.categoryId].staffSalary * MANAGEMENT.DEPARTMENT_SALARY;
  const describe = (r: StaffRole) => {
    const current = m.staff.find((s) => s.role === r);
    const self = r === 'principal' && !current;
    const blocked = r === 'principal' && m.position !== 'owner';
    return {
      current,
      self,
      rating: self ? principalRating(career) : (current?.rating ?? VACANT_RATING),
      market: blocked ? [] : m.staffMarket.filter((s) => s.role === r),
      name: current ? current.name : self ? 'Você comanda a equipe' : 'Função vaga (interino)',
    };
  };
  const selected = describe(role);
  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card title="Funções" padded={false}>
          <ul className="divide-y divide-ink-800">
            {STAFF_ROLES.map((r) => {
              const info = describe(r);
              return (
                <li key={r}>
                  <button
                    type="button"
                    aria-pressed={role === r}
                    onClick={() => setRole(r)}
                    className={cx(
                      'flex min-h-11 w-full items-center gap-3 py-1 pl-4 pr-3 text-left transition-colors',
                      role === r ? 'bg-ink-800 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-850',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] leading-tight text-ink-400">{STAFF_ROLE_LABELS[r]}</span>
                      <span className={cx('block truncate text-sm font-semibold', !info.current && !info.self && 'text-gold-400')}>{info.name}</span>
                    </span>
                    {info.market.length > 0 && <span className="shrink-0 text-[11px] text-ink-400">{info.market.length} no mercado</span>}
                    <span className="w-7 shrink-0 text-right font-display text-xl font-bold leading-none">{Math.round(info.rating)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={STAFF_ROLE_LABELS[role]}
          action={<span className="font-display text-xl font-bold tabular">{Math.round(selected.rating)}</span>}
          bodyClassName="!p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{selected.name}</div>
              <div className="text-xs text-ink-400">
                {selected.current
                  ? `${formatMoney(selected.current.salary)} por temporada · contrato até ${career.year + (selected.current.contractEnd - career.season)}`
                  : selected.self
                    ? 'A sua nota cresce com a experiência como dirigente e com a reputação.'
                    : 'Um interino rende pouco.'}
              </div>
            </div>
            {selected.current && (
              <Button variant="ghost" className="shrink-0" onClick={() => dismissStaff(role)}>
                Dispensar
              </Button>
            )}
          </div>
          <div className="mt-2">
            <RatingBar value={selected.rating} />
          </div>
          <p className="mt-2 text-xs text-ink-400">{STAFF_ROLE_EFFECTS[role]}</p>
          {selected.market.length > 0 && (
            <ul className="mt-2 space-y-1.5 border-t border-ink-800 pt-2">
              {selected.market.map((candidate) => (
                <li key={candidate.id} className="flex items-center justify-between gap-2 bg-ink-850 py-0.5 pl-3 pr-1 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {candidate.name} · nota <b className="tabular">{candidate.rating}</b>
                    </span>
                    <span className="block text-xs text-ink-400">{formatMoney(candidate.salary)} por temporada</span>
                  </span>
                  <Button className="shrink-0" onClick={() => hireStaff(candidate.id)}>
                    Contratar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Departamentos" bodyClassName="grid gap-x-6 gap-y-3 !p-3 md:grid-cols-2">
        {(['engineers', 'mechanics'] as const).map((department) => (
          <div key={department}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{department === 'engineers' ? 'Engenharia' : 'Mecânicos'}</div>
                <div className="text-xs text-ink-400">
                  Folha: {formatMoney(m[department] * salary)} por temporada ({formatMoney(salary)} por nível).
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  className="min-w-11 !px-0"
                  disabled={m[department] <= 1}
                  onClick={() => setDepartment(department, m[department] - 1)}
                  aria-label="Reduzir"
                >
                  <Minus size={16} aria-hidden />
                </Button>
                <span className="w-16 text-center font-display text-xl font-bold tabular">Nível {m[department]}</span>
                <Button
                  className="min-w-11 !px-0"
                  disabled={m[department] >= 5}
                  onClick={() => setDepartment(department, m[department] + 1)}
                  aria-label="Aumentar"
                >
                  <Plus size={16} aria-hidden />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {department === 'engineers'
                ? `A capacidade de pesquisa parte de ${MANAGEMENT.ENGINEERING_BASE} pontos por etapa e ganha ${number(MANAGEMENT.ENGINEERING_PER_LEVEL)} por nível; o custo da pesquisa cresce junto.`
                : 'Cada nível melhora os boxes em 7 pontos: paradas mais rápidas e menos erros.'}
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Facilities({ m }: { m: ManagedTeam }) {
  const upgradeFacility = useGameStore((s) => s.upgradeFacility);
  const economy = TEAM_ECONOMY[m.categoryId];
  const closed = !REGULATIONS[m.categoryId].open.aero;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {FACILITY_KEYS.map((key) => {
          const level = m.facilities[key];
          const cost = facilityUpgradeCost(m, key);
          const useless = key === 'windTunnel' && closed;
          return (
            <Card
              key={key}
              title={FACILITY_INFO[key].name}
              action={<span className="font-display text-xl font-bold tabular">Nível {level}</span>}
              bodyClassName="flex flex-col !p-3"
            >
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cx('h-2 flex-1', i <= level ? 'bg-ink-200' : 'bg-ink-800')} />
                ))}
              </div>
              <p className="mt-2 flex-1 text-sm leading-snug text-ink-300">{FACILITY_INFO[key].effect}</p>
              {useless && <p className="mt-2 text-xs text-gold-400">O regulamento desta categoria não permite desenvolvimento aerodinâmico.</p>}
              <Button className="mt-3 w-full" disabled={level >= 5 || cost > m.budget || useless} onClick={() => upgradeFacility(key)}>
                {level >= 5 ? 'Nível máximo' : `Ampliar (${formatMoney(cost)})`}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-400">
        As obras saem do caixa da equipe (<b className={cx('tabular', m.budget < 0 ? 'text-gold-400' : 'text-ink-200')}>{formatMoney(m.budget)}</b>). A
        manutenção custa {formatMoney(economy.facilityCost * MANAGEMENT.FACILITY_UPKEEP)} por nível, por temporada. As instalações ficam com a equipe e entram
        no valor dela.
      </p>
    </div>
  );
}

function Development({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const setDevelopment = useGameStore((s) => s.setDevelopment);
  const setAreaShare = useGameStore((s) => s.setAreaShare);
  const team = managedTeam(career);
  const rules = REGULATIONS[m.categoryId];
  const economy = TEAM_ECONOMY[m.categoryId];
  const rate = researchRate(m);
  const cost = researchCostPerRound(m);
  const allowance = windTunnelAllowance(m);
  const setShare = (area: DevArea, value: number) => setAreaShare(area, value);
  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-3">
          <Card title="Ritmo da pesquisa" bodyClassName="!p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {RESEARCH_SPENDS.map((spend) => {
                const selected = m.development.spend === spend;
                return (
                  <button
                    key={spend}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDevelopment({ spend })}
                    className={cx(
                      'chamfer-br flex min-h-11 min-w-0 flex-col items-start gap-0.5 px-2 py-2 text-left transition-colors',
                      selected
                        ? 'bg-apex-500/15 shadow-[inset_0_0_0_1px_var(--color-apex-500)]'
                        : 'bg-ink-800 shadow-[inset_0_0_0_1px_var(--color-ink-600)] hover:bg-ink-700',
                    )}
                  >
                    <span className="text-sm font-semibold text-ink-100">{RESEARCH_SPEND_LABELS[spend]}</span>
                    <span className="whitespace-nowrap text-[11px] leading-tight text-ink-300">
                      pesquisa {number(MANAGEMENT.SPEND[spend].points)}×
                      <br />
                      custo {number(MANAGEMENT.SPEND[spend].cost)}×
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Pesquisa por etapa" value={`${number(rate)} pts`} />
              <Stat label="Custo por etapa" value={formatMoney(cost)} />
            </div>
            {economy.budgetCap !== null && (
              <div className="mt-3">
                <Meter
                  label="Teto de gastos usado"
                  value={(m.development.spent / economy.budgetCap) * 100}
                  hint={`${formatMoney(m.development.spent)} de ${formatMoney(economy.budgetCap)}`}
                  tone="neutral"
                />
              </div>
            )}
          </Card>

          {team && (
            <Card title="Equipamento" bodyClassName="grid grid-cols-2 gap-3 !p-3">
              <Stat label="Motor" value={number(team.car.engine)} hint={`Base do ano: ${number(m.baseCar.engine)}`} />
              <Stat label="Chassi" value={number(team.car.chassis)} hint={`Base do ano: ${number(m.baseCar.chassis)}`} />
              <Stat label="Confiabilidade" value={number(team.car.reliability)} hint={`Base do ano: ${number(m.baseCar.reliability)}`} />
              <Stat label="Boxes" value={team.crew} hint="Mecânicos e chefias" />
            </Card>
          )}
        </div>

        <Card
          title="Áreas de desenvolvimento"
          action={<span className="text-xs text-ink-400">Até {rules.maxGainsPerArea} melhorias por área no ano</span>}
          bodyClassName="!px-3 !py-1"
        >
          <div className="divide-y divide-ink-800">
            {DEV_AREAS.map((area) => {
              const open = rules.open[area];
              const gains = m.development.gains[area];
              const maxed = gains >= rules.maxGainsPerArea;
              const needed = researchNeeded(gains);
              const share = m.development.allocation[area];
              const effect = DEV_EFFECTS[area];
              const parts = [
                effect.engine ? `motor +${number(effect.engine)}` : '',
                effect.chassis ? `chassi +${number(effect.chassis)}` : '',
                effect.reliability ? `confiabilidade +${number(effect.reliability)}` : '',
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <div key={area} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2">
                    <div className={cx('text-sm font-semibold', !open && 'text-ink-400')}>
                      {DEV_AREA_LABELS[area]} <span className="text-xs font-normal text-ink-400">cada melhoria: {parts}</span>
                    </div>
                    {open ? (
                      <div className="text-xs tabular text-ink-300">
                        {gains} de {rules.maxGainsPerArea} melhorias
                      </div>
                    ) : (
                      <Pill>Fechado</Pill>
                    )}
                  </div>
                  {open ? (
                    <>
                      <div className="flex items-center gap-3">
                        <input
                          aria-label={`Esforço em ${DEV_AREA_LABELS[area]}`}
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.round(share * 100)}
                          onChange={(e) => setShare(area, Number(e.target.value) / 100)}
                          className="min-h-11 min-w-0 flex-1 accent-(--color-apex-500)"
                        />
                        <span className="w-11 text-right font-display text-lg font-semibold leading-none">{Math.round(share * 100)}%</span>
                      </div>
                      <div className="flex justify-between gap-2 text-xs text-ink-400">
                        <span>
                          {maxed
                            ? 'Limite do regulamento atingido nesta temporada'
                            : `Próxima melhoria: ${number(m.development.progress[area])} de ${number(needed)} pontos`}
                        </span>
                        {!maxed && share > 0 && (
                          <span>
                            cerca de{' '}
                            {counted(Math.max(1, Math.ceil((needed - m.development.progress[area]) / Math.max(0.01, rate * share))), 'etapa', 'etapas')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-ink-800">
                        <div
                          className={cx('h-full', maxed ? 'bg-go-400' : 'bg-ink-200')}
                          style={{ width: `${maxed ? 100 : Math.min(100, (m.development.progress[area] / needed) * 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-ink-400">Fechado pelo regulamento desta categoria.</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Regulamento técnico" bodyClassName="space-y-2 !p-3 text-xs text-ink-400">
        <p className="text-sm text-ink-300">
          {rules.summary}
          {economy.budgetCap !== null && ` Teto de gastos com desenvolvimento: ${formatMoney(economy.budgetCap)} por temporada.`}
          {m.categoryId === 'f1' && ` Horas de túnel de vento: ${Math.round(allowance * 100)}% (quem termina na frente recebe menos).`}
        </p>
        <p>
          Ao mexer em uma área, as demais são reajustadas para a soma dar 100%. A primeira melhoria de uma área no ano pede {MANAGEMENT.RESEARCH_BASE} pontos, e
          cada seguinte, {Math.round(MANAGEMENT.RESEARCH_GROWTH * 100)}% a mais. A pesquisa em andamento não se perde na virada do ano. As rivais também
          evoluem: na virada da temporada, a evolução média do grid é descontada de todos, e o que a sua equipe ganhou acima da média perde{' '}
          {Math.round((1 - MANAGEMENT.CARRY_OVER) * 100)}%.
        </p>
      </Card>
    </div>
  );
}

function Drivers({ m }: { m: ManagedTeam }) {
  const career = useCareer();
  const lineup = career.drivers
    .filter((d) => d.teamId === m.teamId)
    .sort((a, b) => (a.role === 'first' ? 0 : a.role === 'second' ? 1 : 2) - (b.role === 'first' ? 0 : b.role === 'second' ? 1 : 2));
  const children = new Set(career.family.children.map((c) => c.driver?.id));
  return (
    <Card title="Pilotos da equipe" padded={false}>
      <div className="px-4">
        <TableWrap>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Piloto</th>
                <th className={th}>Função</th>
                <th className={cx(th, 'text-right')}>Idade</th>
                <th className={cx(th, 'text-right')}>Nota</th>
                <th className={cx(th, 'text-right')}>Potencial</th>
                <th className={cx(th, 'text-right')}>Moral</th>
                <th className={cx(th, 'text-right')}>Salário</th>
                <th className={cx(th, 'text-right')}>Paga pela vaga</th>
                <th className={cx(th, 'text-right')}>Contrato</th>
              </tr>
            </thead>
            <tbody>
              {lineup.map((d) => {
                const deal = m.deals[d.id];
                return (
                  <tr key={d.id} className="border-t border-ink-800">
                    <td className={cx(td, 'whitespace-nowrap font-semibold')}>
                      {fullName(d)} {children.has(d.id) && <Pill tone="good">Família</Pill>} {d.injury && <Pill tone="bad">Lesionado</Pill>}
                    </td>
                    <td className={cx(td, 'whitespace-nowrap text-ink-300')}>{d.role ? ROLE_LABELS[d.role] : '-'}</td>
                    <td className={cx(td, 'text-right tabular')}>{d.age}</td>
                    <td className={cx(td, 'text-right font-semibold tabular')}>{Math.floor(overallRating(d.attributes))}</td>
                    <td className={cx(td, 'text-right tabular text-ink-300')}>{Math.floor(d.potential)}</td>
                    <td className={cx(td, 'text-right tabular')}>{Math.round(d.condition.morale)}</td>
                    <td className={cx(td, 'whitespace-nowrap text-right tabular')}>{deal?.salary ? formatMoney(deal.salary) : '-'}</td>
                    <td className={cx(td, 'whitespace-nowrap text-right tabular')}>{deal?.seatFee ? formatMoney(deal.seatFee) : '-'}</td>
                    <td className={cx(td, 'text-right tabular text-ink-300')}>{career.year + (Math.max(d.contractEnd, career.season) - career.season)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <p className="border-t border-ink-800 px-4 py-2.5 text-xs text-ink-400">
        A dupla da próxima temporada é escolhida no fechamento do ano, na tela Carreira. No fim de semana, você define o programa de treino e a abordagem de
        classificação dos dois pilotos. O simulador da equipe acelera a evolução deles.
      </p>
    </Card>
  );
}
