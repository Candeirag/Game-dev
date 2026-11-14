/** Painéis do patrimônio pessoal. Só apresentação: preços, limites e regras vêm do motor. */
import { useState } from 'react';
import { LIFESTYLES } from '@/domain/schemas';
import { LIFESTYLE_LABELS } from '@/domain/labels';
import { ASSET_RULES, BUSINESSES, LIFESTYLE_RULES, PROPERTIES, STOCKS } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { loanLimit, loanPayoff, annualPayment, rankTeams, stakePrice, stockPrice, stocksValue, teamStandings } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, ChoiceCard, Pill, Stat, TableWrap, TeamSwatch, cx, td, th } from '../../components/ui';
import { formatMoney } from '../../format';
import { useCareer } from '../../hooks/useCareer';

const input = 'w-28 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm tabular text-ink-100 focus:border-apex-500 focus:outline-none';
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits).replace('.', ',')}%`;

export function StocksPanel() {
  const career = useCareer();
  const buy = useGameStore((s) => s.buyStock);
  const sell = useGameStore((s) => s.sellStock);
  const [quantity, setQuantity] = useState<Record<string, string>>({});
  const f = career.finance;
  return (
    <div className="space-y-6">
      <Card title="Bolsa de valores" action={<span className="text-xs text-ink-400">Carteira: <b className="tabular text-ink-100">{formatMoney(stocksValue(f))}</b></span>} padded={false}>
        <div className="px-4">
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Ação</th>
                  <th className={cx(th, 'text-right')}>Cotação</th>
                  <th className={cx(th, 'hidden text-right md:table-cell')}>Retorno · risco</th>
                  <th className={cx(th, 'hidden text-right sm:table-cell')}>Dividendo</th>
                  <th className={cx(th, 'text-right')}>Em carteira</th>
                  <th className={cx(th, 'text-right')}>Resultado</th>
                  <th className={th}>Negociar</th>
                </tr>
              </thead>
              <tbody>
                {STOCKS.map((stock) => {
                  const price = stockPrice(f, stock.id);
                  const held = f.stocks.find((h) => h.stockId === stock.id);
                  const shares = Math.max(0, Math.floor(Number(quantity[stock.id] ?? '10') || 0));
                  const result = held ? (price - held.avgCost) * held.shares : 0;
                  return (
                    <tr key={stock.id} className="border-t border-ink-800">
                      <td className={td}><div className="font-semibold">{stock.name}</div><div className="text-xs text-ink-400">{stock.sector}</div></td>
                      <td className={cx(td, 'text-right tabular')}>€ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={cx(td, 'hidden text-right text-xs text-ink-400 md:table-cell')}>{pct(stock.drift)} ao ano · ±{pct(stock.volatility)}</td>
                      <td className={cx(td, 'hidden text-right tabular sm:table-cell')}>{pct(stock.dividendYield)}</td>
                      <td className={cx(td, 'text-right tabular')}>{held ? `${held.shares} (${formatMoney(held.shares * price)})` : '-'}</td>
                      <td className={cx(td, 'text-right tabular', result < 0 ? 'text-apex-400' : result > 0 ? 'text-go-400' : 'text-ink-400')}>{held ? formatMoney(result, { sign: true }) : '-'}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <input aria-label={`Quantidade de ${stock.name}`} type="number" min={1} step={1} value={quantity[stock.id] ?? '10'} onChange={(e) => setQuantity({ ...quantity, [stock.id]: e.target.value })} className={cx(input, 'w-20')} />
                          <Button disabled={shares <= 0 || shares * price > f.cash} onClick={() => buy(stock.id, shares)}>Comprar</Button>
                          <Button variant="ghost" disabled={!held || shares <= 0 || shares > held.shares} onClick={() => sell(stock.id, shares)}>Vender</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <p className="px-4 py-3 text-xs text-ink-400">
          As cotações mudam depois de cada etapa: parte do movimento é do mercado inteiro, parte é de cada empresa. Os dividendos são pagos no fechamento da temporada. Na venda com lucro, {pct(ASSET_RULES.CAPITAL_GAINS_TAX)} do ganho vai para o imposto.
        </p>
      </Card>
    </div>
  );
}

export function PropertyPanel() {
  const career = useCareer();
  const { buyProperty, setPropertyUse, sellProperty, openBusiness, upgradeBusiness, sellBusiness } = useGameStore.getState();
  const f = career.finance;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Imóveis">
        <div className="space-y-4">
          {PROPERTIES.map((def) => {
            const owned = f.properties.find((p) => p.catalogId === def.id);
            return (
              <div key={def.id} className={cx('rounded-lg border p-4', owned ? 'border-go-400/30 bg-go-400/5' : 'border-ink-800')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold">{def.name} {owned && <Pill tone="good">{owned.use === 'rented' ? 'Alugado' : 'Uso próprio'}</Pill>}</div>
                  <div className="font-display text-xl font-bold tabular">{formatMoney(owned?.value ?? def.price)}</div>
                </div>
                <p className="mt-1 text-sm text-ink-400">{def.description} Aluguel de {pct(def.rentYield, 1)} ao ano, manutenção de {pct(def.upkeep, 1)}, valorização média de {pct(def.appreciation, 1)}.</p>
                <p className="mt-1 text-xs text-ink-300">{def.personalPerk}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {owned ? (
                    <>
                      <Button onClick={() => setPropertyUse(owned.id, owned.use === 'rented' ? 'personal' : 'rented')}>{owned.use === 'rented' ? 'Passar a usar' : 'Colocar para alugar'}</Button>
                      <Button variant="danger" onClick={() => sellProperty(owned.id)}>Vender ({formatMoney(owned.value * (1 - ASSET_RULES.PROPERTY_SALE_FEE))})</Button>
                    </>
                  ) : (
                    <>
                      <Button disabled={def.price > f.cash} onClick={() => buyProperty(def.id, 'rented')}>Comprar para alugar</Button>
                      <Button variant="ghost" disabled={def.price > f.cash} onClick={() => buyProperty(def.id, 'personal')}>Comprar para uso próprio</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-400">Imposto anual de {pct(ASSET_RULES.PROPERTY_TAX, 1)} sobre o valor. Na venda: corretagem de {pct(ASSET_RULES.PROPERTY_SALE_FEE)} e {pct(ASSET_RULES.CAPITAL_GAINS_TAX)} de imposto sobre o ganho.</p>
      </Card>

      <Card title="Empresas" action={<span className="text-xs text-ink-400">Reputação <b className="tabular text-ink-100">{Math.floor(career.reputation)}</b></span>}>
        <div className="space-y-4">
          {BUSINESSES.map((def) => {
            const owned = f.businesses.find((b) => b.catalogId === def.id);
            const locked = career.reputation < def.minReputation;
            return (
              <div key={def.id} className={cx('rounded-lg border p-4', owned ? 'border-go-400/30 bg-go-400/5' : 'border-ink-800')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold">{def.name} {owned && <Pill tone="good">Nível {owned.level}</Pill>}</div>
                  <div className="font-display text-xl font-bold tabular">{formatMoney(owned?.value ?? def.cost)}</div>
                </div>
                <p className="mt-1 text-sm text-ink-400">{def.description} {owned ? `Último resultado anual: ${formatMoney(owned.lastProfit, { sign: true })}.` : `Exige reputação ${def.minReputation}.`}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {owned ? (
                    <>
                      <Button disabled={owned.level >= 3 || def.cost > f.cash} onClick={() => upgradeBusiness(owned.id)}>{owned.level >= 3 ? 'Nível máximo' : `Expandir (${formatMoney(def.cost)})`}</Button>
                      <Button variant="danger" onClick={() => sellBusiness(owned.id)}>Vender ({formatMoney(owned.value)})</Button>
                    </>
                  ) : (
                    <Button disabled={locked || def.cost > f.cash} onClick={() => openBusiness(def.id)}>{locked ? 'Reputação insuficiente' : `Abrir (${formatMoney(def.cost)})`}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-400">O lucro depende da sua fama: com reputação 20, uma empresa mal se paga; com 80 ou mais, rende o dobro. O resultado entra no fechamento da temporada e é tributado como renda.</p>
      </Card>
    </div>
  );
}

export function StakesPanel() {
  const career = useCareer();
  const buyStake = useGameStore((s) => s.buyStake);
  const sellStake = useGameStore((s) => s.sellStake);
  const category = getCategory(career.categoryId);
  const ranked = rankTeams(career.teams);
  const standings = teamStandings(career);
  const f = career.finance;
  return (
    <div className="space-y-6">
      {f.stakes.length > 0 && (
        <Card title="Suas participações" padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead><tr><th className={th}>Equipe</th><th className={cx(th, 'text-right')}>Fatia</th><th className={cx(th, 'text-right')}>Valor</th><th className={cx(th, 'text-right')}>Última posição</th><th className={cx(th, 'text-right')}>Último dividendo</th><th className={th} /></tr></thead>
                <tbody>
                  {f.stakes.map((s) => (
                    <tr key={s.id} className="border-t border-ink-800">
                      <td className={td}><div className="font-semibold">{s.teamName}</div><div className="text-xs text-ink-400">{getCategory(s.categoryId).shortName}</div></td>
                      <td className={cx(td, 'text-right tabular')}>{pct(s.share)}</td>
                      <td className={cx(td, 'text-right tabular')}>{formatMoney(s.value)}</td>
                      <td className={cx(td, 'text-right tabular')}>{s.lastPosition}º</td>
                      <td className={cx(td, 'text-right tabular', s.lastDividend < 0 ? 'text-apex-400' : 'text-go-400')}>{formatMoney(s.lastDividend, { sign: true })}</td>
                      <td className={cx(td, 'text-right')}><Button variant="ghost" onClick={() => sellStake(s.id)}>Vender</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>
      )}
      <Card title={`Equipes da ${category.shortName}`} padded={false}>
        <div className="px-4">
          <TableWrap>
            <table className="w-full">
              <thead><tr><th className={th}>Equipe</th><th className={cx(th, 'text-right')}>No campeonato</th>{ASSET_RULES.STAKE_SHARES.map((share) => <th key={share} className={cx(th, 'text-right')}>Comprar {pct(share)}</th>)}</tr></thead>
              <tbody>
                {ranked.map((team) => {
                  const position = standings.find((s) => s.teamId === team.id)?.position;
                  return (
                    <tr key={team.id} className="border-t border-ink-800">
                      <td className={td}><span className="flex items-center gap-2"><TeamSwatch team={team} />{team.name}</span></td>
                      <td className={cx(td, 'text-right tabular')}>{position ? `${position}º` : '-'}</td>
                      {ASSET_RULES.STAKE_SHARES.map((share) => {
                        const price = stakePrice(career, team.id, share);
                        return <td key={share} className={cx(td, 'text-right')}><Button variant="ghost" disabled={price > f.cash} onClick={() => buyStake(team.id, share)}>{formatMoney(price)}</Button></td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <p className="px-4 py-3 text-xs text-ink-400">
          Uma participação paga dividendos no fim da temporada conforme a posição da equipe: a campeã distribui 10% do seu valor; a última pede aporte aos sócios. O valor da fatia acompanha a posição no campeonato. Participações minoritárias vão até 49%.
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
  const living = getCategory(career.categoryId).economy.living;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Empréstimos">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Limite disponível" value={formatMoney(limit)} hint={`${pct(ASSET_RULES.LOAN_ASSET_SHARE)} dos ativos + ${ASSET_RULES.LOAN_INCOME_MULTIPLE}× a renda contratada`} />
          <Stat label="Juros" value={`${pct(ASSET_RULES.LOAN_RATE)} ao ano`} hint="Parcelas iguais, pagas a cada etapa" />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-ink-300">Valor (€)<br /><input type="number" min={1000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className={cx(input, 'mt-1 w-36')} /></label>
          <label className="text-sm text-ink-300">Prazo<br />
            <select value={term} onChange={(e) => setTerm(Number(e.target.value))} className={cx(input, 'mt-1 w-40')}>
              {ASSET_RULES.LOAN_TERMS.map((t) => <option key={t} value={t}>{t} temporadas</option>)}
            </select>
          </label>
          <Button variant="primary" disabled={value < 1000 || value > limit} onClick={() => takeLoan(value, term)}>Contratar</Button>
        </div>
        {value >= 1000 && <p className="mt-2 text-xs text-ink-400">Parcela anual de {formatMoney(annualPayment(value, ASSET_RULES.LOAN_RATE, term))}; total pago: {formatMoney(annualPayment(value, ASSET_RULES.LOAN_RATE, term) * term)}.</p>}
        {f.loans.length > 0 && (
          <div className="mt-5 space-y-3">
            {f.loans.map((loan) => (
              <div key={loan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-800 p-3 text-sm">
                <div>
                  <div className="font-semibold">{loan.label}</div>
                  <div className="text-xs text-ink-400">Saldo {formatMoney(loan.balance)} · parcela anual {formatMoney(loan.annualPayment)} · faltam {loan.seasonsRemaining} temporada(s)</div>
                </div>
                <Button disabled={loanPayoff(career, loan) > f.cash} onClick={() => repayLoan(loan.id)}>Quitar ({formatMoney(loanPayoff(career, loan))})</Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-400">O empréstimo é mais barato que deixar o caixa negativo, que paga 14% ao ano. Serve para atravessar uma temporada cara ou para comprar uma equipe.</p>
      </Card>

      <Card title="Padrão de vida">
        <div className="grid gap-3">
          {LIFESTYLES.map((id) => {
            const rule = LIFESTYLE_RULES[id];
            return (
              <ChoiceCard
                key={id}
                selected={f.lifestyle === id}
                onSelect={() => setLifestyle(id)}
                title={LIFESTYLE_LABELS[id]}
                description={`Custo de vida de ${formatMoney(living * rule.cost)} por temporada nesta categoria.`}
                meta={`Moral ${rule.morale > 0 ? `+${rule.morale.toLocaleString('pt-BR')}` : '0'} por etapa · relação com o parceiro ${rule.relationship > 0 ? '+' : ''}${rule.relationship} por ano`}
              />
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-400">Viver com simplicidade economiza, mas desgasta o relacionamento. Um padrão mais alto melhora a moral (que rende treino e regularidade) e a vida em família.</p>
      </Card>
    </div>
  );
}
