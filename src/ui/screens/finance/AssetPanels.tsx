/** Painéis do patrimônio pessoal. Só apresentação: preços, limites e regras vêm do motor. */
import { type ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LIFESTYLES } from '@/domain/schemas';
import { LIFESTYLE_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
import { ASSET_RULES, BUSINESSES, LIFESTYLE_RULES, PROPERTIES, STOCKS } from '@/data/assets';
import { getCategory } from '@/data/categories';
import {
  ECONOMY,
  type InvestmentProduct,
  annualPayment,
  livingCostBase,
  loanLimit,
  loanPayoff,
  rankTeams,
  stakePrice,
  stockPrice,
  stocksValue,
  teamStandings,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, ChoiceCard, Pill, Stat, TableWrap, Tabs, TeamSwatch, cx } from '../../components/ui';
import { currencySymbol, formatMoney } from '../../format';
import { useCareer } from '../../hooks/useCareer';

/** Campo de formulário (texto, número, seleção) com 44 px de altura. */
const field = 'min-h-11 border border-ink-700 bg-ink-850 px-3 text-sm text-ink-100 focus:border-apex-500 focus:outline-none';
/** Células das tabelas com botões na linha: o botão já dá a altura, a célula não soma mais. */
const head = 'px-2 py-1.5 text-left text-[11px] font-medium text-ink-400';
const cell = 'px-2 py-0.5 text-sm';
const note = 'text-xs leading-snug text-ink-400';

const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits).replace('.', ',')}%`;
/** Percentual com casa decimal só quando ela existe (3,5%; 6%). */
const pctTight = (v: number) => pct(v, Math.abs(v * 100 - Math.round(v * 100)) < 0.01 ? 0 : 1);
/** Variação em pontos, com sinal (+0,4; −1; 0). */
const signedPoints = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR')}`;
/** Cor de um resultado em dinheiro: verde no positivo, âmbar no negativo. */
const resultTone = (v: number) => (v < 0 ? 'text-gold-400' : v > 0 ? 'text-go-400' : 'text-ink-400');

const PRODUCTS: { id: InvestmentProduct; name: string; description: string }[] = [
  { id: 'fixedIncome', name: 'Renda fixa', description: `Rende ${pctTight(ECONOMY.FIXED_INCOME_RETURN)} ao ano, sem risco.` },
  { id: 'equityFund', name: 'Fundo de ações', description: `Rende ${pctTight(ECONOMY.EQUITY_MEAN)} ao ano em média, mas oscila muito e pode perder.` },
];

/** Renda fixa e fundo de ações: um valor só, aplicado ou resgatado em um dos dois. */
export function SavingsPanel() {
  const career = useCareer();
  const invest = useGameStore((s) => s.invest);
  const [amount, setAmount] = useState('10000');
  const f = career.finance;
  const value = Math.max(0, Math.round(Number(amount) || 0));
  return (
    <Card
      title="Investimentos"
      action={<span className="text-right text-xs text-ink-400">Rendimento creditado no fechamento de cada temporada</span>}
      bodyClassName="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <label className="block text-xs text-ink-300">
        Valor da operação ({currencySymbol()})
        <input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className={cx(field, 'mt-1 block w-full')} />
      </label>
      {PRODUCTS.map((p) => (
        <div key={p.id} className="border-ink-700 border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-semibold">{p.name}</div>
            <div className="font-display text-xl font-bold leading-none">{formatMoney(f[p.id])}</div>
          </div>
          <p className={cx(note, 'mt-1')}>{p.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={value <= 0 || value > f.cash} onClick={() => invest(p.id, value)}>
              Aplicar
            </Button>
            <Button variant="ghost" disabled={value <= 0 || value > f[p.id]} onClick={() => invest(p.id, -value)}>
              Resgatar
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function StocksPanel() {
  const career = useCareer();
  const buy = useGameStore((s) => s.buyStock);
  const sell = useGameStore((s) => s.sellStock);
  const [quantity, setQuantity] = useState<Record<string, string>>({});
  const f = career.finance;
  return (
    <Card
      title="Bolsa de valores"
      action={
        <span className="text-xs text-ink-400">
          Carteira: <b className="text-ink-100">{formatMoney(stocksValue(f))}</b>
        </span>
      }
      padded={false}
    >
      <div className="px-4">
        <TableWrap>
          <table className="w-full">
            <thead>
              <tr>
                <th className={head}>Ação</th>
                <th className={cx(head, 'text-right')}>Cotação</th>
                <th className={cx(head, 'text-right')}>Retorno ao ano · risco</th>
                <th className={cx(head, 'text-right')}>Em carteira</th>
                <th className={head}>Negociar</th>
              </tr>
            </thead>
            <tbody>
              {STOCKS.map((stock) => {
                const price = stockPrice(f, stock.id);
                const held = f.stocks.find((h) => h.stockId === stock.id);
                const shares = Math.max(0, Math.floor(Number(quantity[stock.id] ?? '10') || 0));
                const result = held ? (price - held.avgCost) * held.shares : 0;
                return (
                  <tr key={stock.id} className="border-ink-800 border-t">
                    <td className={cell}>
                      <div className="whitespace-nowrap font-semibold leading-tight">{stock.name}</div>
                      <div className="text-xs text-ink-400">{stock.sector}</div>
                    </td>
                    <td className={cx(cell, 'whitespace-nowrap text-right')}>{formatMoney(price, { compact: false, decimals: 2 })}</td>
                    <td className={cx(cell, 'whitespace-nowrap text-right')}>
                      <div className="leading-tight">
                        {pctTight(stock.drift)} · ±{pct(stock.volatility)}
                      </div>
                      <div className="text-xs text-ink-400">dividendo de {pctTight(stock.dividendYield)}</div>
                    </td>
                    <td className={cx(cell, 'whitespace-nowrap text-right')}>
                      {held ? (
                        <>
                          <div className="leading-tight">
                            {held.shares} · {formatMoney(held.shares * price)}
                          </div>
                          <div className={cx('text-xs', resultTone(result))}>{formatMoney(result, { sign: true })}</div>
                        </>
                      ) : (
                        <span className="text-ink-400">–</span>
                      )}
                    </td>
                    <td className={cell}>
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Quantidade de ${stock.name}`}
                          type="number"
                          min={1}
                          step={1}
                          value={quantity[stock.id] ?? '10'}
                          onChange={(e) => setQuantity({ ...quantity, [stock.id]: e.target.value })}
                          className={cx(field, 'w-16 px-2')}
                        />
                        <Button className="px-3" disabled={shares <= 0 || shares * price > f.cash} onClick={() => buy(stock.id, shares)}>
                          Comprar
                        </Button>
                        <Button className="px-3" variant="ghost" disabled={!held || shares <= 0 || shares > held.shares} onClick={() => sell(stock.id, shares)}>
                          Vender
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <p className={cx(note, 'border-ink-800 border-t px-4 py-2')}>
        As cotações mudam a cada etapa, parte com o mercado inteiro, parte com cada empresa. Dividendos no fechamento da temporada; na venda com lucro,{' '}
        {pct(ASSET_RULES.CAPITAL_GAINS_TAX)} do ganho vai para o imposto.
      </p>
    </Card>
  );
}

/** Linha de uma lista de bens: nome, estado e valor. Tocar abre os detalhes e as ações logo abaixo. */
function AssetRow({
  open,
  onToggle,
  name,
  tag,
  value,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  name: string;
  tag?: ReactNode;
  value: string;
  children: ReactNode;
}) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cx(
          'flex min-h-11 w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-ink-800 focus-visible:outline-offset-[-2px]',
          open && 'bg-ink-800',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-ink-100">{name}</span>
          {tag}
        </span>
        <span className="shrink-0 font-display text-lg font-semibold leading-none text-ink-100">{value}</span>
        <Chevron size={16} aria-hidden className="shrink-0 text-ink-400" />
      </button>
      {open && <div className="space-y-2 bg-ink-850 px-4 py-3">{children}</div>}
    </li>
  );
}

export function PropertyPanel() {
  const career = useCareer();
  const { buyProperty, setPropertyUse, sellProperty, openBusiness, upgradeBusiness, sellBusiness } = useGameStore.getState();
  // Um item aberto por vez, nas duas listas: a tela fica com a altura de uma lista.
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const f = career.finance;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <Card title="Imóveis" padded={false}>
        <ul className="divide-y divide-ink-800">
          {PROPERTIES.map((def) => {
            const owned = f.properties.find((p) => p.catalogId === def.id);
            return (
              <AssetRow
                key={def.id}
                open={open === def.id}
                onToggle={() => toggle(def.id)}
                name={def.name}
                tag={owned && <Pill tone="good">{owned.use === 'rented' ? 'Alugado' : 'Uso próprio'}</Pill>}
                value={formatMoney(owned?.value ?? def.price)}
              >
                <p className="text-sm leading-snug text-ink-300">{def.description}</p>
                <p className={note}>
                  Aluguel de {pct(def.rentYield, 1)} ao ano · manutenção de {pct(def.upkeep, 1)} · valorização média de {pct(def.appreciation, 1)}.
                </p>
                <p className="text-xs leading-snug text-ink-200">{def.personalPerk}</p>
                {owned ? (
                  <div className="flex flex-wrap gap-2">
                    <Button className="px-3" onClick={() => setPropertyUse(owned.id, owned.use === 'rented' ? 'personal' : 'rented')}>
                      {owned.use === 'rented' ? 'Passar a usar' : 'Colocar para alugar'}
                    </Button>
                    <Button className="px-3" variant="danger" onClick={() => sellProperty(owned.id)}>
                      Vender ({formatMoney(owned.value * (1 - ASSET_RULES.PROPERTY_SALE_FEE))})
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-ink-400">Comprar</span>
                    <Button className="px-3" aria-label="Comprar para alugar" disabled={def.price > f.cash} onClick={() => buyProperty(def.id, 'rented')}>
                      Para alugar
                    </Button>
                    <Button
                      className="px-3"
                      aria-label="Comprar para uso próprio"
                      variant="ghost"
                      disabled={def.price > f.cash}
                      onClick={() => buyProperty(def.id, 'personal')}
                    >
                      Para uso próprio
                    </Button>
                  </div>
                )}
              </AssetRow>
            );
          })}
        </ul>
        <p className={cx(note, 'border-ink-800 border-t px-4 py-2')}>
          Imposto anual de {pct(ASSET_RULES.PROPERTY_TAX, 1)} sobre o valor. Na venda: corretagem de {pct(ASSET_RULES.PROPERTY_SALE_FEE)} e{' '}
          {pct(ASSET_RULES.CAPITAL_GAINS_TAX)} de imposto sobre o ganho.
        </p>
      </Card>

      <Card
        title="Empresas"
        action={
          <span className="text-xs text-ink-400">
            Reputação <b className="text-ink-100">{Math.floor(career.reputation)}</b>
          </span>
        }
        padded={false}
      >
        <ul className="divide-y divide-ink-800">
          {BUSINESSES.map((def) => {
            const owned = f.businesses.find((b) => b.catalogId === def.id);
            const locked = career.reputation < def.minReputation;
            return (
              <AssetRow
                key={def.id}
                open={open === def.id}
                onToggle={() => toggle(def.id)}
                name={def.name}
                tag={owned ? <Pill tone="good">Nível {owned.level}</Pill> : locked ? <Pill tone="warn">Reputação {def.minReputation}</Pill> : undefined}
                value={formatMoney(owned?.value ?? def.cost)}
              >
                <p className="text-sm leading-snug text-ink-300">{def.description}</p>
                <p className={note}>
                  {owned ? (
                    <>
                      Último resultado anual: <b className={resultTone(owned.lastProfit)}>{formatMoney(owned.lastProfit, { sign: true })}</b>.
                    </>
                  ) : (
                    `Exige reputação ${def.minReputation}.`
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {owned ? (
                    <>
                      <Button className="px-3" disabled={owned.level >= 3 || def.cost > f.cash} onClick={() => upgradeBusiness(owned.id)}>
                        {owned.level >= 3 ? 'Nível máximo' : `Expandir (${formatMoney(def.cost)})`}
                      </Button>
                      <Button className="px-3" variant="danger" onClick={() => sellBusiness(owned.id)}>
                        Vender ({formatMoney(owned.value)})
                      </Button>
                    </>
                  ) : (
                    <Button className="px-3" disabled={locked || def.cost > f.cash} onClick={() => openBusiness(def.id)}>
                      {locked ? 'Reputação insuficiente' : `Abrir (${formatMoney(def.cost)})`}
                    </Button>
                  )}
                </div>
              </AssetRow>
            );
          })}
        </ul>
        <p className={cx(note, 'border-ink-800 border-t px-4 py-2')}>
          O lucro depende da sua fama: com reputação 20, uma empresa mal se paga; com 80 ou mais, rende o dobro. Entra no fechamento da temporada e é tributado
          como renda.
        </p>
      </Card>
    </div>
  );
}

export function StakesPanel() {
  const career = useCareer();
  const buyStake = useGameStore((s) => s.buyStake);
  const sellStake = useGameStore((s) => s.sellStake);
  // A fatia é escolhida uma vez, no alto do cartão; cada equipe mostra só o preço dessa fatia.
  const [share, setShare] = useState<number>(ASSET_RULES.STAKE_SHARES[0]);
  const category = getCategory(career.categoryId);
  const ranked = rankTeams(career.teams);
  const standings = teamStandings(career);
  const f = career.finance;
  return (
    <div className="space-y-4">
      {f.stakes.length > 0 && (
        <Card title="Suas participações" padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={head}>Equipe</th>
                    <th className={cx(head, 'text-right')}>Fatia</th>
                    <th className={cx(head, 'text-right')}>Valor</th>
                    <th className={cx(head, 'text-right')}>Última posição</th>
                    <th className={cx(head, 'text-right')}>Último dividendo</th>
                    <th className={head} />
                  </tr>
                </thead>
                <tbody>
                  {f.stakes.map((s) => (
                    <tr key={s.id} className="border-ink-800 border-t">
                      <td className={cell}>
                        <div className="font-semibold leading-tight">{s.teamName}</div>
                        <div className="text-xs text-ink-400">{getCategory(s.categoryId).shortName}</div>
                      </td>
                      <td className={cx(cell, 'text-right')}>{pct(s.share)}</td>
                      <td className={cx(cell, 'text-right')}>{formatMoney(s.value)}</td>
                      <td className={cx(cell, 'text-right')}>{s.lastPosition}º</td>
                      <td className={cx(cell, 'text-right', resultTone(s.lastDividend))}>
                        {formatMoney(s.lastDividend, { sign: true })}
                      </td>
                      <td className={cx(cell, 'text-right')}>
                        <Button variant="ghost" onClick={() => sellStake(s.id)}>
                          Vender
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>
      )}
      <Card
        title={`Equipes da ${category.shortName}`}
        action={
          <span className="flex items-center gap-2 text-xs text-ink-400">
            Fatia a comprar
            <Tabs value={String(share)} options={ASSET_RULES.STAKE_SHARES.map((s) => ({ value: String(s), label: pct(s) }))} onChange={(v) => setShare(Number(v))} />
          </span>
        }
        padded={false}
      >
        <ul className="grid px-4 md:grid-cols-2 md:gap-x-6">
          {ranked.map((team) => {
            const position = standings.find((s) => s.teamId === team.id)?.position;
            const price = stakePrice(career, team.id, share);
            return (
              <li key={team.id} className="flex min-h-12 items-center gap-2 border-ink-800 border-b py-0.5">
                <TeamSwatch team={team} />
                <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
                <span className="shrink-0 text-xs text-ink-400">{position ? `${position}º` : '–'}</span>
                <Button
                  className="min-w-28 shrink-0 px-3"
                  aria-label={`Comprar ${pct(share)} da ${team.name} por ${formatMoney(price)}`}
                  disabled={price > f.cash}
                  onClick={() => buyStake(team.id, share)}
                >
                  {formatMoney(price)}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className={cx(note, 'px-4 py-2')}>
          Ao lado de cada equipe, a posição no campeonato. A participação paga dividendos no fim da temporada: a campeã distribui{' '}
          {pct(ASSET_RULES.STAKE_DIVIDEND_TOP)} do seu valor, cada posição abaixo paga {pct(ASSET_RULES.STAKE_DIVIDEND_STEP, 1)} a menos e a última pede aporte
          aos sócios. O valor da fatia acompanha a posição. Participações minoritárias vão até 49%.
        </p>
      </Card>
    </div>
  );
}

export function CreditPanel() {
  const career = useCareer();
  const { takeLoan, repayLoan, setLifestyle } = useGameStore.getState();
  const limit = loanLimit(career);
  const [amount, setAmount] = useState(String(Math.min(50_000, limit)));
  const [term, setTerm] = useState<number>(ASSET_RULES.LOAN_TERMS[1]);
  const f = career.finance;
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const living = livingCostBase(career);
  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <Card title="Empréstimos" bodyClassName="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Limite disponível"
            value={formatMoney(limit)}
            hint={`${pct(ASSET_RULES.LOAN_ASSET_SHARE)} dos ativos + ${ASSET_RULES.LOAN_INCOME_MULTIPLE.toLocaleString('pt-BR')}× a renda contratada`}
          />
          <Stat label="Juros" value={`${pct(ASSET_RULES.LOAN_RATE)} ao ano`} hint="Parcelas iguais, pagas a cada etapa" />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-20 flex-1 text-xs text-ink-300">
            Valor ({currencySymbol()})
            <input type="number" min={1000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className={cx(field, 'mt-1 block w-full')} />
          </label>
          <label className="min-w-36 flex-1 text-xs text-ink-300">
            Prazo
            <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className={cx(field, 'mt-1 block w-full')}>
              {ASSET_RULES.LOAN_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t} temporadas
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" disabled={value < 1000 || value > limit} onClick={() => takeLoan(value, term)}>
            Contratar
          </Button>
        </div>
        {value >= 1000 && (
          <p className={note}>
            Parcela anual de {formatMoney(annualPayment(value, ASSET_RULES.LOAN_RATE, term))}; total pago:{' '}
            {formatMoney(annualPayment(value, ASSET_RULES.LOAN_RATE, term) * term)}.
          </p>
        )}
        {f.loans.length > 0 && (
          <ul className="divide-y divide-ink-800 border-ink-800 border-t">
            {f.loans.map((loan) => (
              <li key={loan.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{loan.label}</div>
                  <div className="text-xs text-ink-400">
                    Saldo {formatMoney(loan.balance)} · parcela anual {formatMoney(loan.annualPayment)} · {loan.seasonsRemaining === 1 ? 'falta' : 'faltam'}{' '}
                    {counted(loan.seasonsRemaining, 'temporada', 'temporadas')}
                  </div>
                </div>
                <Button className="px-3" disabled={loanPayoff(career, loan) > f.cash} onClick={() => repayLoan(loan.id)}>
                  Quitar ({formatMoney(loanPayoff(career, loan))})
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className={note}>
          O empréstimo é mais barato que deixar o caixa negativo, que paga {pct(ECONOMY.LOAN_INTEREST)} ao ano. Serve para atravessar uma temporada cara ou
          para comprar uma equipe.
        </p>
      </Card>

      <Card title="Padrão de vida" bodyClassName="space-y-2">
        {LIFESTYLES.map((id) => {
          const rule = LIFESTYLE_RULES[id];
          return (
            <ChoiceCard
              key={id}
              selected={f.lifestyle === id}
              onSelect={() => setLifestyle(id)}
              title={LIFESTYLE_LABELS[id]}
              description={`Custa ${formatMoney(living * rule.cost)} por temporada.`}
              meta={`Moral ${signedPoints(rule.morale)} por etapa · relação ${signedPoints(rule.relationship)} por ano`}
            />
          );
        })}
        <p className={note}>
          Viver com simplicidade economiza, mas desgasta a relação com o parceiro. Um padrão mais alto melhora a moral (que rende treino e regularidade) e a
          vida em família.
        </p>
      </Card>
    </div>
  );
}
