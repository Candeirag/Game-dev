import { useState } from 'react';
import { LEDGER_KEYS } from '@/domain/schemas';
import { LEDGER_LABELS } from '@/domain/labels';
import { ECONOMY, SPONSOR_RULES, commercialSponsors, netWorth, ownedTeamValue, stocksValue, type InvestmentProduct } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, Meter, PageHeader, Pill, Stat, TableWrap, Tabs, cx, td, th } from '../components/ui';
import { currencySymbol, formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { CreditPanel, PropertyPanel, StakesPanel, StocksPanel } from './finance/AssetPanels';

type FinanceTab = 'summary' | 'stocks' | 'property' | 'stakes' | 'credit';
const TABS: { value: FinanceTab; label: string }[] = [
  { value: 'summary', label: 'Resumo' },
  { value: 'stocks', label: 'Ações' },
  { value: 'property', label: 'Imóveis e empresas' },
  { value: 'stakes', label: 'Equipes' },
  { value: 'credit', label: 'Crédito e padrão de vida' },
];

const PRODUCTS: { id: InvestmentProduct; name: string; description: string }[] = [
  { id: 'fixedIncome', name: 'Renda fixa', description: `Rende ${ECONOMY.FIXED_INCOME_RETURN * 100}% ao ano, sem risco.` },
  { id: 'equityFund', name: 'Fundo de ações', description: `Rende ${ECONOMY.EQUITY_MEAN * 100}% ao ano em média, mas oscila muito e pode perder.` },
];

export function FinanceScreen() {
  const { career, category } = useCareerView();
  const invest = useGameStore((s) => s.invest);
  const [amount, setAmount] = useState('10000');
  const [tab, setTab] = useState<FinanceTab>('summary');
  const f = career.finance;
  const driving = career.mode === 'driver';
  const teamValue = ownedTeamValue(career);
  const assets = stocksValue(f) + [...f.properties, ...f.businesses, ...f.stakes].reduce((total, item) => total + item.value, 0);
  const debt = f.loans.reduce((total, loan) => total + loan.balance, 0);
  const totals = f.seasonTotals;
  const income = LEDGER_KEYS.filter((k) => (totals[k] ?? 0) > 0);
  const expenses = LEDGER_KEYS.filter((k) => (totals[k] ?? 0) < 0);
  const sum = (keys: readonly string[]) => keys.reduce((s, k) => s + (totals[k] ?? 0), 0);
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const sponsors = commercialSponsors(career.sponsors);
  const family = career.sponsors.find((s) => s.tier === 0);
  const perRound = (v: number) => v / career.calendar.length;
  const nextRound =
    perRound(
      career.contract.salary +
        career.sponsors.reduce((s, x) => s + x.perSeason, 0) +
        (career.academy ? career.contract.seatCost * career.academy.supportShare : 0),
    ) -
    perRound(career.contract.seatCost + category.economy.living) -
    category.economy.trainingCost * ECONOMY.TRAINING_COST[career.trainingIntensity];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Temporada ${career.year}`} title="Finanças">
        {driving && (
          <span className="text-sm text-ink-400">
            Resultado previsto por etapa:{' '}
            <b className={cx('tabular', nextRound < 0 ? 'text-apex-400' : 'text-go-400')}>{formatMoney(nextRound, { sign: true })}</b>
          </span>
        )}
      </PageHeader>

      <div className="overflow-x-auto">
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <Stat
            label="Caixa"
            value={<span className={f.cash < 0 ? 'text-apex-400' : ''}>{formatMoney(f.cash)}</span>}
            hint={f.cash < 0 ? `Dívida: juros de ${ECONOMY.LOAN_INTEREST * 100}% no fim do ano` : 'Disponível'}
          />
        </Card>
        <Card>
          <Stat
            label="Aplicações e bens"
            value={formatMoney(f.fixedIncome + f.equityFund + assets)}
            hint={debt > 0 ? `Empréstimos: ${formatMoney(debt)}` : 'Renda fixa, fundo, ações, imóveis, empresas e participações'}
          />
        </Card>
        <Card>
          <Stat
            label="Patrimônio líquido"
            value={<span className={netWorth(f) + teamValue < 0 ? 'text-apex-400' : ''}>{formatMoney(netWorth(f) + teamValue)}</span>}
            hint={teamValue > 0 ? `Inclui a sua equipe: ${formatMoney(teamValue)}` : undefined}
            accent
          />
        </Card>
        <Card>
          <Stat label="Temporada até aqui" value={formatMoney(sum(LEDGER_KEYS), { sign: true })} hint="Receitas menos despesas" />
        </Card>
      </div>

      {tab === 'stocks' && <StocksPanel />}
      {tab === 'property' && <PropertyPanel />}
      {tab === 'stakes' && <StakesPanel />}
      {tab === 'credit' && <CreditPanel />}

      {tab === 'summary' && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Receitas e despesas da temporada" padded={false}>
              <div className="px-4">
                <table className="w-full">
                  <tbody>
                    {income.map((k) => (
                      <tr key={k} className="border-b border-ink-800">
                        <td className={td}>{LEDGER_LABELS[k]}</td>
                        <td className={cx(td, 'text-right tabular text-go-400')}>{formatMoney(totals[k] ?? 0, { sign: true, compact: false })}</td>
                      </tr>
                    ))}
                    {expenses.map((k) => (
                      <tr key={k} className="border-b border-ink-800">
                        <td className={td}>{LEDGER_LABELS[k]}</td>
                        <td className={cx(td, 'text-right tabular text-apex-400')}>{formatMoney(totals[k] ?? 0, { compact: false })}</td>
                      </tr>
                    ))}
                    {income.length + expenses.length === 0 && (
                      <tr>
                        <td className={cx(td, 'text-ink-400')}>Sem lançamentos nesta temporada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-3 text-xs text-ink-400">
                Salário, patrocínios e a vaga são pagos em parcelas por etapa. No fim do ano vêm os dividendos, o resultado das empresas, o imposto de renda
                (progressivo, sobre a renda do trabalho menos o custo da vaga, mais dividendos, aluguéis e lucros), o rendimento dos investimentos e os juros de
                eventual dívida.
              </p>
            </Card>

            {driving && (
              <Card
                title="Patrocinadores"
                action={
                  <span className="text-xs text-ink-400">
                    {sponsors.length} de {SPONSOR_RULES.MAX_SPONSORS} cotas
                  </span>
                }
              >
                {family && (
                  <p className="mb-4 text-sm text-ink-300">
                    Apoio da família: <b className="tabular text-ink-100">{formatMoney(family.perSeason)}</b> por ano, até o fim de{' '}
                    {career.year + (family.endSeason - career.season)}.
                  </p>
                )}
                {sponsors.length === 0 ? (
                  <p className="text-sm text-ink-400">
                    Nenhum patrocinador. As propostas aparecem como decisões no painel; o porte de quem procura você depende da sua posição no campeonato e da
                    sua reputação.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {sponsors.map((s) => (
                      <div key={s.id}>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">
                            {s.name} <Pill>{['', 'Pequeno', 'Médio', 'Grande'][s.tier]}</Pill>
                          </span>
                          <span className="text-sm tabular text-ink-300">
                            {formatMoney(s.perSeason)}/ano · até {career.year + (s.endSeason - career.season)}
                          </span>
                        </div>
                        <Meter
                          label="Satisfação"
                          value={s.satisfaction}
                          hint={`Espera ver você entre os ${s.targetPosition} primeiros. Paga ${formatMoney(s.podiumBonus)} por pódio. Renova se a satisfação estiver em ${SPONSOR_RULES.RENEW_THRESHOLD} ou mais.`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          <Card title="Investimentos">
            <div className="grid gap-4 md:grid-cols-2">
              {PRODUCTS.map((p) => (
                <div key={p.id} className="rounded-lg border border-ink-800 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold">{p.name}</div>
                    <div className="font-display text-xl font-bold tabular">{formatMoney(f[p.id])}</div>
                  </div>
                  <p className="mt-1 text-sm text-ink-400">{p.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={value <= 0 || value > f.cash} onClick={() => invest(p.id, value)}>
                      Aplicar
                    </Button>
                    <Button variant="ghost" disabled={value <= 0 || value > f[p.id]} onClick={() => invest(p.id, -value)}>
                      Resgatar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-300">
              Valor da operação ({currencySymbol()})
              <input
                type="number"
                min={0}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-40 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm tabular text-ink-100 focus:border-apex-500 focus:outline-none"
              />
              <span className="text-xs text-ink-400">O rendimento é creditado no fechamento de cada temporada.</span>
            </label>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Últimos lançamentos" padded={false}>
              <div className="max-h-[360px] overflow-y-auto px-4">
                <TableWrap>
                  <table className="w-full">
                    <thead className="sticky top-0 bg-ink-900">
                      <tr>
                        <th className={th}>Etapa</th>
                        <th className={th}>Lançamento</th>
                        <th className={cx(th, 'text-right')}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.transactions.map((t, i) => (
                        <tr key={i} className="border-t border-ink-800">
                          <td className={cx(td, 'tabular text-ink-400')}>
                            T{t.season} · E{t.round}
                          </td>
                          <td className={td}>{t.label}</td>
                          <td className={cx(td, 'text-right tabular', t.amount < 0 ? 'text-apex-400' : 'text-go-400')}>
                            {formatMoney(t.amount, { sign: true, compact: false })}
                          </td>
                        </tr>
                      ))}
                      {f.transactions.length === 0 && (
                        <tr>
                          <td className={cx(td, 'text-ink-400')} colSpan={3}>
                            Nenhum lançamento ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            </Card>
            <Card title="Fechamentos anuais" padded={false}>
              <div className="px-4">
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={th}>Ano</th>
                        <th className={cx(th, 'text-right')}>Renda tributável</th>
                        <th className={cx(th, 'text-right')}>Imposto</th>
                        <th className={cx(th, 'text-right')}>Investimentos</th>
                        <th className={cx(th, 'text-right')}>Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...f.reports].reverse().map((r) => (
                        <tr key={r.season} className="border-t border-ink-800">
                          <td className={cx(td, 'tabular')}>{r.year}</td>
                          <td className={cx(td, 'text-right tabular')}>{formatMoney(r.taxableIncome)}</td>
                          <td className={cx(td, 'text-right tabular text-apex-400')}>{formatMoney(-r.tax)}</td>
                          <td className={cx(td, 'text-right tabular', r.investmentReturn < 0 ? 'text-apex-400' : 'text-go-400')}>
                            {formatMoney(r.investmentReturn, { sign: true })}
                          </td>
                          <td className={cx(td, 'text-right font-semibold tabular')}>{formatMoney(r.netWorthEnd)}</td>
                        </tr>
                      ))}
                      {f.reports.length === 0 && (
                        <tr>
                          <td className={cx(td, 'text-ink-400')} colSpan={5}>
                            O primeiro fechamento acontece ao fim desta temporada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
