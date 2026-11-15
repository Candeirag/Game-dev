import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEDGER_KEYS } from '@/domain/schemas';
import { LEDGER_LABELS } from '@/domain/labels';
import { ECONOMY, SPONSOR_RULES, commercialSponsors, expectedRoundResult, netWorth, ownedTeamValue, stocksValue } from '@/engine';
import { Card, Meter, PageHeader, Pill, Stat, TableWrap, Tabs, cx } from '../components/ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { CreditPanel, PropertyPanel, SavingsPanel, StakesPanel, StocksPanel } from './finance/AssetPanels';
import { LifeBackLink } from './life/LifeBackLink';

type FinanceTab = 'summary' | 'sponsors' | 'invest' | 'property' | 'stakes' | 'credit';
const TABS: { value: FinanceTab; label: string; drivingOnly?: boolean }[] = [
  { value: 'summary', label: 'Resumo' },
  { value: 'sponsors', label: 'Patrocínios', drivingOnly: true },
  { value: 'invest', label: 'Investimentos' },
  { value: 'property', label: 'Imóveis e empresas' },
  { value: 'stakes', label: 'Equipes' },
  { value: 'credit', label: 'Crédito e vida' },
];

type LedgerView = 'log' | 'reports';
const LEDGER_VIEWS: { value: LedgerView; label: string }[] = [
  { value: 'log', label: 'Últimos lançamentos' },
  { value: 'reports', label: 'Fechamentos anuais' },
];

/** Células compactas das tabelas de leitura (sem botões na linha). */
const head = 'px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-ink-400';
const cell = 'px-2 py-1.5 text-sm';
/** Cor de um valor em dinheiro: verde no positivo, âmbar no negativo. */
const moneyTone = (v: number) => (v < 0 ? 'text-gold-400' : 'text-go-400');

export function FinanceScreen() {
  const { career } = useCareerView();
  // A aba fica no endereço (?tab=...), para a tela Vida abrir direto na área certa.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tabs = TABS.filter((t) => !t.drivingOnly || career.mode === 'driver');
  const tab: FinanceTab = tabs.find((t) => t.value === requested)?.value ?? 'summary';
  const setTab = (next: FinanceTab) => setParams(next === 'summary' ? {} : { tab: next }, { replace: true });
  const driving = career.mode === 'driver';
  const nextRound = expectedRoundResult(career);

  return (
    <div>
      {/* Seis abas não cabem ao lado do título no celular: ficam numa linha própria, que rola de lado se faltar largura, e sobem para a direita do título em telas largas. */}
      <div className="xl:flex xl:items-start xl:justify-between xl:gap-4">
        <div className="min-w-0">
          <PageHeader
            title="Finanças"
            eyebrow={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <LifeBackLink />
                <span>
                  temporada {career.year}
                  {driving && (
                    <>
                      {' '}
                      · previsto por etapa <b className={cx('font-display text-base', moneyTone(nextRound))}>{formatMoney(nextRound, { sign: true })}</b>
                    </>
                  )}
                </span>
              </span>
            }
          />
        </div>
        <div className="mb-3 xl:shrink-0">
          <Tabs value={tab} options={tabs} onChange={setTab} />
        </div>
      </div>

      <div className="space-y-4">
        {tab === 'summary' && <SummaryTab />}
        {tab === 'sponsors' && driving && <SponsorsTab />}
        {tab === 'invest' && (
          <>
            <SavingsPanel />
            <StocksPanel />
          </>
        )}
        {tab === 'property' && <PropertyPanel />}
        {tab === 'stakes' && <StakesPanel />}
        {tab === 'credit' && <CreditPanel />}
      </div>
    </div>
  );
}

/** Resumo: os quatro números do patrimônio, o balanço da temporada e o histórico de lançamentos. */
function SummaryTab() {
  const { career } = useCareerView();
  const [view, setView] = useState<LedgerView>('log');
  const f = career.finance;
  const teamValue = ownedTeamValue(career);
  const assets = stocksValue(f) + [...f.properties, ...f.businesses, ...f.stakes].reduce((total, item) => total + item.value, 0);
  const debt = f.loans.reduce((total, loan) => total + loan.balance, 0);
  const totals = f.seasonTotals;
  const income = LEDGER_KEYS.filter((k) => (totals[k] ?? 0) > 0);
  const expenses = LEDGER_KEYS.filter((k) => (totals[k] ?? 0) < 0);
  const balance = LEDGER_KEYS.reduce((s, k) => s + (totals[k] ?? 0), 0);
  const worth = netWorth(f) + teamValue;

  return (
    <>
      <Card padded={false} bodyClassName="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 md:grid-cols-4">
        <Stat
          label="Caixa"
          value={<span className={f.cash < 0 ? 'text-gold-400' : ''}>{formatMoney(f.cash)}</span>}
          hint={f.cash < 0 ? `Juros de ${ECONOMY.LOAN_INTEREST * 100}% no fim do ano` : undefined}
        />
        <Stat
          label="Aplicações e bens"
          value={formatMoney(f.fixedIncome + f.equityFund + assets)}
          hint={debt > 0 ? `Empréstimos: ${formatMoney(debt)}` : undefined}
        />
        <Stat
          label="Patrimônio líquido"
          value={<span className={worth < 0 ? 'text-gold-400' : ''}>{formatMoney(worth)}</span>}
          hint={teamValue > 0 ? `Inclui a sua equipe: ${formatMoney(teamValue)}` : undefined}
        />
        <Stat
          label="Temporada até aqui"
          value={<span className={balance < 0 ? 'text-gold-400' : ''}>{formatMoney(balance, { sign: true })}</span>}
          hint="Receitas menos despesas"
        />
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card title="Receitas e despesas da temporada" padded={false}>
          <table className="w-full">
            <tbody>
              {[...income, ...expenses].map((k) => (
                <tr key={k} className="border-ink-800 border-b">
                  <td className={cx(cell, 'pl-4')}>{LEDGER_LABELS[k]}</td>
                  <td className={cx(cell, 'whitespace-nowrap pr-4 text-right', moneyTone(totals[k] ?? 0))}>
                    {formatMoney(totals[k] ?? 0, { sign: (totals[k] ?? 0) > 0, compact: false })}
                  </td>
                </tr>
              ))}
              {income.length + expenses.length === 0 && (
                <tr>
                  <td className={cx(cell, 'pl-4 text-ink-400')}>Sem lançamentos nesta temporada.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs leading-snug text-ink-400">
            Salário, patrocínios e vaga são pagos em parcelas por etapa. No fim do ano vêm dividendos, resultado das empresas, rendimento dos investimentos,
            juros de eventual dívida e o imposto de renda.
          </p>
        </Card>

        <Card padded={false}>
          <div className="border-ink-700 border-b">
            <Tabs value={view} options={LEDGER_VIEWS} onChange={setView} />
          </div>
          {view === 'log' ? (
            <div className="max-h-72 overflow-y-auto px-4">
              <TableWrap>
                <table className="w-full">
                  <thead className="sticky top-0 bg-ink-900">
                    <tr>
                      <th className={head}>Etapa</th>
                      <th className={head}>Lançamento</th>
                      <th className={cx(head, 'text-right')}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.transactions.map((t, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: os lançamentos não têm id; a lista é só de leitura
                      <tr key={i} className="border-ink-800 border-t">
                        <td className={cx(cell, 'whitespace-nowrap text-ink-400')}>
                          T{t.season} · E{t.round}
                        </td>
                        <td className={cell}>{t.label}</td>
                        <td className={cx(cell, 'whitespace-nowrap text-right', moneyTone(t.amount))}>{formatMoney(t.amount, { sign: true, compact: false })}</td>
                      </tr>
                    ))}
                    {f.transactions.length === 0 && (
                      <tr>
                        <td className={cx(cell, 'text-ink-400')} colSpan={3}>
                          Nenhum lançamento ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          ) : (
            <>
              <div className="px-4">
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={head}>Ano</th>
                        <th className={cx(head, 'text-right')}>Renda tributável</th>
                        <th className={cx(head, 'text-right')}>Imposto</th>
                        <th className={cx(head, 'text-right')}>Investimentos</th>
                        <th className={cx(head, 'text-right')}>Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...f.reports].reverse().map((r) => (
                        <tr key={r.season} className="border-ink-800 border-t">
                          <td className={cell}>{r.year}</td>
                          <td className={cx(cell, 'whitespace-nowrap text-right')}>{formatMoney(r.taxableIncome)}</td>
                          <td className={cx(cell, 'whitespace-nowrap text-right', r.tax > 0 ? 'text-gold-400' : 'text-ink-400')}>{formatMoney(-r.tax)}</td>
                          <td className={cx(cell, 'whitespace-nowrap text-right', r.investmentReturn === 0 ? 'text-ink-400' : moneyTone(r.investmentReturn))}>
                            {formatMoney(r.investmentReturn, { sign: true })}
                          </td>
                          <td className={cx(cell, 'whitespace-nowrap text-right font-semibold')}>{formatMoney(r.netWorthEnd)}</td>
                        </tr>
                      ))}
                      {f.reports.length === 0 && (
                        <tr>
                          <td className={cx(cell, 'text-ink-400')} colSpan={5}>
                            O primeiro fechamento acontece ao fim desta temporada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
              <p className="border-ink-800 border-t px-4 py-2 text-xs leading-snug text-ink-400">
                O imposto é progressivo, sobre a renda do trabalho menos o custo da vaga, mais dividendos, aluguéis e lucros.
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

const TIER_NAMES = ['', 'Pequeno', 'Médio', 'Grande'];

function SponsorsTab() {
  const { career } = useCareerView();
  const sponsors = commercialSponsors(career.sponsors);
  const family = career.sponsors.find((s) => s.tier === 0);
  return (
    <Card
      title="Patrocinadores"
      action={
        <span className="text-xs text-ink-400">
          {sponsors.length} de {SPONSOR_RULES.MAX_SPONSORS} cotas
        </span>
      }
      bodyClassName="space-y-3"
    >
      {sponsors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {sponsors.map((s) => (
            <div key={s.id} className="min-w-0 space-y-2 border-ink-700 border-l pl-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold leading-tight">{s.name}</span>
                  <Pill>{TIER_NAMES[s.tier]}</Pill>
                </div>
                <div className="text-xs text-ink-300">
                  <b className="font-display text-base text-ink-100">{formatMoney(s.perSeason)}</b> por ano · até {career.year + (s.endSeason - career.season)}
                </div>
              </div>
              <Meter label="Satisfação" value={s.satisfaction} hint={
                  <>
                    Meta: entre os {s.targetPosition} primeiros · <span className="whitespace-nowrap">{formatMoney(s.podiumBonus)} por pódio</span>
                  </>
                }
              />
            </div>
          ))}
        </div>
      )}
      {family && (
        <p className="text-sm text-ink-300">
          Apoio da família: <b className="text-ink-100">{formatMoney(family.perSeason)}</b> por ano, até o fim de{' '}
          {career.year + (family.endSeason - career.season)}.
        </p>
      )}
      <p className="text-xs leading-snug text-ink-400">
        {sponsors.length === 0 ? 'Nenhum patrocinador. ' : `O contrato é renovado se a satisfação estiver em ${SPONSOR_RULES.RENEW_THRESHOLD} ou mais. `}
        As propostas aparecem como decisões no painel; o porte de quem procura você depende da sua posição no campeonato e da sua reputação.
      </p>
    </Card>
  );
}
