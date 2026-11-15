/**
 * Vida: a central do que acontece fora das pistas. Cada linha é uma área (finanças, patrocínios,
 * imóveis, investimentos, equipes, crédito, família), com o resumo que importa na própria linha
 * e o caminho para a tela de detalhe.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChartLine, ChevronRight, CreditCard, Handshake, Heart, Users, Wallet, type LucideIcon } from 'lucide-react';
import { LIFESTYLE_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
import { lifeSummary, ownedTeamValue } from '@/engine';
import { PageHeader, Stat, cx } from '../components/ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { Panel, Tag } from '../kit/Panel';

export function LifeScreen() {
  const { career, player } = useCareerView();
  const life = lifeSummary(career);
  const teamValue = ownedTeamValue(career);
  const perRound = (value: number) => `${formatMoney(value, { sign: true })} por etapa`;
  const assets = life.property.count + life.business.count;

  return (
    <div>
      <PageHeader title="Vida" eyebrow={`${player.firstName} ${player.lastName} · fora das pistas`} />
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel flush>
          <ul className="divide-y divide-ink-700/70">
            <Row
              to="/finance"
              icon={Wallet}
              title="Finanças"
              value={formatMoney(life.finance.cash)}
              attention={life.finance.cash < 0}
              summary={
                <>
                  Caixa{life.finance.perRound !== null && <> · {perRound(life.finance.perRound)}</>}
                  {life.finance.debt > 0 && <> · empréstimos de {formatMoney(life.finance.debt)}</>}
                </>
              }
            />
            {career.mode === 'driver' && (
              <Row
                to="/finance?tab=sponsors"
                icon={Handshake}
                title="Patrocínios"
                value={life.sponsors.count > 0 ? formatMoney(life.sponsors.perSeason) : '–'}
                tag={life.sponsors.lowestSatisfaction !== null && life.sponsors.lowestSatisfaction < 40 ? <Tag tone="attention">Insatisfeito</Tag> : undefined}
                summary={
                  life.sponsors.count > 0 ? (
                    <>
                      {counted(life.sponsors.count, 'patrocinador', 'patrocinadores')} · por temporada
                      {life.sponsors.familySupport > 0 && <> · família: {formatMoney(life.sponsors.familySupport)}</>}
                    </>
                  ) : life.sponsors.familySupport > 0 ? (
                    <>Nenhum patrocinador · apoio da família de {formatMoney(life.sponsors.familySupport)} por ano</>
                  ) : (
                    'Nenhum patrocinador. As propostas chegam como decisões no Painel.'
                  )
                }
              />
            )}
            <Row
              to="/finance?tab=property"
              icon={Building2}
              title="Imóveis e empresas"
              value={assets > 0 ? formatMoney(life.property.value + life.business.value) : '–'}
              summary={
                assets > 0 ? (
                  <>
                    {life.property.count > 0 && (
                      <>
                        {counted(life.property.count, 'imóvel', 'imóveis')} · {perRound(life.property.perRound)}
                      </>
                    )}
                    {life.property.count > 0 && life.business.count > 0 && ' · '}
                    {life.business.count > 0 && (
                      <>
                        {counted(life.business.count, 'empresa', 'empresas')} · {formatMoney(life.business.lastProfit, { sign: true })} no último ano
                      </>
                    )}
                  </>
                ) : (
                  'Nenhum imóvel nem empresa. Rendem aluguel e lucro anual.'
                )
              }
            />
            <Row
              to="/finance?tab=invest"
              icon={ChartLine}
              title="Investimentos"
              value={life.investments.total > 0 ? formatMoney(life.investments.total) : '–'}
              summary={
                life.investments.total > 0 ? (
                  <>
                    Renda fixa {formatMoney(life.investments.fixedIncome)} · fundo {formatMoney(life.investments.equityFund)}
                    {life.investments.holdings > 0 && (
                      <>
                        {' '}
                        · {counted(life.investments.holdings, 'ação', 'ações')}: {formatMoney(life.investments.stocks)}
                      </>
                    )}
                  </>
                ) : (
                  'Nada aplicado. Renda fixa, fundo de ações e ações de empresas.'
                )
              }
            />
            <Row
              to="/finance?tab=stakes"
              icon={Users}
              title="Participações em equipes"
              value={life.stakes.count > 0 || teamValue > 0 ? formatMoney(life.stakes.value + teamValue) : '–'}
              summary={
                life.stakes.count > 0 || teamValue > 0 ? (
                  <>
                    {life.stakes.count > 0 && (
                      <>
                        {counted(life.stakes.count, 'participação', 'participações')} · {formatMoney(life.stakes.lastDividend, { sign: true })} no último ano
                      </>
                    )}
                    {life.stakes.count > 0 && teamValue > 0 && ' · '}
                    {teamValue > 0 && 'equipe própria'}
                  </>
                ) : (
                  'Nenhuma participação. Sócios recebem dividendos da equipe.'
                )
              }
            />
            <Row
              to="/finance?tab=credit"
              icon={CreditCard}
              title="Crédito e padrão de vida"
              value={LIFESTYLE_LABELS[career.finance.lifestyle]}
              attention={life.finance.debt > 0}
              summary={life.finance.debt > 0 ? <>Empréstimos: {formatMoney(life.finance.debt)}</> : 'Sem empréstimos'}
            />
            <Row
              to="/family"
              icon={Heart}
              title="Família"
              value={life.family.children > 0 ? counted(life.family.children, 'filho', 'filhos') : life.family.partner ? life.family.partner : '–'}
              summary={
                <>
                  {life.family.partner ? `${life.family.married ? 'Casamento' : 'Namoro'} com ${life.family.partner}` : 'Solteiro'}
                  {life.family.racing > 0 && <> · {counted(life.family.racing, 'filho correndo', 'filhos correndo')}</>}
                  {life.family.annualCost > 0 && <> · {formatMoney(life.family.annualCost)} por ano com os filhos</>}
                  {career.dynasty.generation > 1 && <> · {career.dynasty.generation}ª geração</>}
                </>
              }
            />
          </ul>
        </Panel>

        <Panel title="Patrimônio" bodyClassName="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-1">
          <Stat
            label="Patrimônio líquido"
            value={<span className={life.finance.netWorth + teamValue < 0 ? 'text-gold-400' : ''}>{formatMoney(life.finance.netWorth + teamValue)}</span>}
            hint={teamValue > 0 ? `Inclui a sua equipe: ${formatMoney(teamValue)}` : 'Caixa, aplicações e bens, menos dívidas'}
          />
          <Stat label="Caixa" value={<span className={life.finance.cash < 0 ? 'text-gold-400' : ''}>{formatMoney(life.finance.cash)}</span>} />
          {life.finance.perRound !== null && (
            <Stat
              label="Resultado previsto por etapa"
              value={<span className={life.finance.perRound < 0 ? 'text-gold-400' : 'text-go-400'}>{formatMoney(life.finance.perRound, { sign: true })}</span>}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Uma área da vida: ícone, nome, resumo e o número principal. A linha inteira leva ao detalhe. */
function Row({
  to,
  icon: Icon,
  title,
  summary,
  value,
  tag,
  attention = false,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  summary: ReactNode;
  value: ReactNode;
  tag?: ReactNode;
  attention?: boolean;
}) {
  return (
    <li>
      <Link to={to} className="group flex min-h-11 items-center gap-3 px-4 py-1 transition-colors hover:bg-ink-800 focus-visible:outline-offset-[-2px]">
        <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-ink-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold uppercase leading-none tracking-wide">{title}</span>
            {tag}
          </div>
          <div className="mt-0.5 text-xs leading-snug text-ink-300">{summary}</div>
        </div>
        <div className={cx('shrink-0 text-right font-display text-xl font-semibold leading-none', attention ? 'text-gold-400' : 'text-ink-100')}>{value}</div>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-500 transition-colors group-hover:text-ink-100" />
      </Link>
    </li>
  );
}
