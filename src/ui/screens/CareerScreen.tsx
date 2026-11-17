import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { FIRST_FORMULA_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import type { Offer, Offseason } from '@/domain/schemas';
import { OFFER_KIND_LABELS, ROLE_LABELS } from '@/domain/labels';
import { CATEGORIES, LICENSE_WINDOW_SEASONS, PENALTY_POINTS_BAN, categoryByTier, getCategory } from '@/data/categories';
import {
  CONTRACT_RULES,
  canAcceptOffer,
  categoryRequirements,
  fullName,
  licensePointsTotal,
  negotiationMargin,
  offerRequirements,
  rankTeams,
  reachableCategories,
  releaseFeeFor,
  teamKey,
  teamsOfCategory,
  type NegotiationDemand,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { VEHICLES } from '@/data/vehicles';
import { CarSprite } from '../components/CarSprite';
import { Button, Card, Check, cx, EmptyState, Meter, PageHeader, Pill, Stat, Tabs, TeamSwatch } from '@/ui/kit';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { counted } from '@/domain/text';
import { ExportReminder } from '../components/SaveNotices';
import { ScreenAction } from '../layout/ScreenAction';
import { useReveal } from './useReveal';

const DEMANDS: { id: NegotiationDemand; label: string; available: (o: Offer) => boolean }[] = [
  { id: 'seat', label: 'Reduzir o custo da vaga', available: (o) => o.seatCost > 0 },
  { id: 'salary', label: 'Aumentar o salário', available: (o) => o.salary > 0 },
  { id: 'bonus', label: 'Melhorar os bônus', available: (o) => o.bonuses.win > 0 },
  { id: 'role', label: 'Pedir o status de primeiro piloto', available: (o) => o.role !== 'first' },
  { id: 'longer', label: 'Contrato mais longo', available: (o) => o.years < 3 },
  { id: 'shorter', label: 'Contrato mais curto', available: (o) => o.years > 1 },
  { id: 'clause', label: 'Retirar a cláusula de desempenho', available: (o) => o.clauses.performanceTarget !== null },
];

type CareerTab = 'offers' | 'ladder' | 'license' | 'interest';

const OFFER_ID = 'proposta-aberta';

/** A maior largura entre os veículos: define a altura da faixa reservada à imagem em cada degrau. */
const WIDEST_VEHICLE = Math.max(...CATEGORIES.map((c) => VEHICLES[c.id].width));

export function CareerScreen() {
  const { career, player } = useCareerView();
  // No fim da temporada, as propostas são o assunto da tela: abrem primeiro.
  const closing = career.offseason && career.status === 'active' ? career.offseason : null;
  const tabs: { value: CareerTab; label: string }[] = [
    ...(closing ? [{ value: 'offers' as const, label: 'Propostas' }] : []),
    { value: 'ladder', label: 'Escada' },
    { value: 'license', label: 'Licença' },
    { value: 'interest', label: 'Interesse' },
  ];
  const first: CareerTab = closing ? 'offers' : 'ladder';
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = tabs.find((t) => t.value === requested)?.value ?? first;
  const setTab = (next: CareerTab) => setParams(next === first ? {} : { tab: next }, { replace: true });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={`${player.firstName} ${player.lastName} · ${player.age} anos · reputação ${Math.floor(career.reputation)}/100`} title="Carreira">
        <Tabs value={tab} options={tabs} onChange={setTab} />
      </PageHeader>

      {tab === 'offers' && closing && <OffersTab offseason={closing} />}
      {tab === 'ladder' && <LadderTab />}
      {tab === 'license' && <LicenseTab />}
      {tab === 'interest' && <MarketCard />}

      {career.status === 'active' && <Retirement />}
    </div>
  );
}

/* ---------------- Escada e requisitos ---------------- */

function LadderTab() {
  const { career, player, team, category } = useCareerView();
  const next = categoryByTier(category.tier + 1);
  const requirements = useMemo(() => (next ? categoryRequirements(career, next.id) : []), [career, next]);
  // Durante a temporada, o interesse da equipe mais interessada do degrau de cima é uma estimativa:
  // as propostas só saem no fechamento, com as contas do ano. No fechamento, vale o que saiu.
  const promotionOffer = next && career.offseason ? career.offseason.offers.some((o) => o.kind === 'promotion' && o.categoryId === next.id) : null;
  const bestInterest = next
    ? Math.max(
        0,
        ...Object.entries(career.marketInterest)
          .filter(([key]) => key.startsWith(`${next.id}:`))
          .map(([, value]) => value),
      )
    : 0;

  return (
    <>
      <Card title="Escada do automobilismo" bodyClassName="p-3">
        {/*
          O desenho do carro tem tamanho fixo (`--u` é quantos pixels vale cada unidade de comprimento
          do veículo) e mora numa faixa só dele, de altura fixa e com corte: nunca encosta nos textos
          do degrau, em nenhum tamanho de tela.
        */}
        <ol className="grid grid-cols-2 gap-1.5 [--u:3.2px] sm:grid-cols-4 md:grid-cols-[1fr_1fr_1.25fr_1fr_1fr_1fr_1fr] md:max-[839px]:[--u:2.8px] lg:gap-2 lg:[--u:4.2px]">
          {CATEGORIES.map((c) => {
            const state = c.tier < category.tier ? 'done' : c.tier === category.tier ? 'current' : 'ahead';
            const seasons = career.history.filter((h) => h.categoryId === c.id).length + (c.id === category.id ? 1 : 0);
            const vehicle = VEHICLES[c.id];
            return (
              <li
                key={c.id}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cx(
                  'flex min-w-0 flex-col border-t-[3px] p-2',
                  state === 'current' ? 'border-apex-400 bg-apex-500/10' : state === 'done' ? 'border-ink-400 bg-ink-850' : 'border-ink-500 bg-ink-850/50',
                )}
              >
                <div className="text-2xs font-semibold uppercase leading-tight tracking-wider text-ink-300">
                  Degrau {c.tier}
                  {state === 'current' ? ' · você está aqui' : state === 'done' ? ' · já correu' : ''}
                </div>
                <div
                  className={cx(
                    'font-display text-base font-bold uppercase leading-[1.1] [overflow-wrap:anywhere] md:min-h-[2.2em] md:max-[839px]:text-xs lg:min-h-0 lg:text-lg lg:leading-[1.1]',
                    state === 'ahead' ? 'text-ink-300' : 'text-ink-100',
                  )}
                >
                  {c.shortName}
                </div>
                {/* O veículo de cada degrau, em proporção: do kart de entrada ao Monoposto Grand Prix. Na categoria atual, com a pintura da equipe. */}
                <div
                  className="my-1 flex shrink-0 items-center overflow-hidden"
                  style={{ height: `calc(var(--u) * ${WIDEST_VEHICLE} + 4px)` }}
                  title={vehicle.description}
                >
                  <CarSprite
                    categoryId={c.id}
                    teamId={state === 'current' ? team.id : 'escada'}
                    color={state === 'current' ? team.color : '#aab3c2'}
                    driverId={state === 'current' ? player.id : undefined}
                    className="shrink-0"
                    style={{ width: `calc(var(--u) * ${vehicle.length})` }}
                  />
                </div>
                <div className="text-2xs leading-tight text-ink-300">{vehicle.name}</div>
                <div className="mt-0.5 text-2xs leading-tight text-ink-400">
                  {seasons > 0 ? (
                    counted(seasons, 'temporada', 'temporadas')
                  ) : c.economy.seatCost[0] > 0 ? (
                    <>
                      Vaga: <span className="whitespace-nowrap">{formatMoney(c.economy.seatCost[1])}</span> a{' '}
                      <span className="whitespace-nowrap">{formatMoney(c.economy.seatCost[0])}</span>
                    </>
                  ) : (
                    'A equipe paga salário'
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {career.categoryId === 'kart-national' && (
          <p className="mt-2 text-xs text-ink-400">
            Do kart nacional é possível ir direto {categoryRef(FIRST_FORMULA_CATEGORY_ID, 'para')}, se você cumprir os requisitos.
          </p>
        )}
      </Card>

      <Card title={next ? `Requisitos ${categoryRef(next.id, 'para', { short: true })}` : 'Topo da escada'}>
        {next ? (
          <>
            <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {requirements.map((r) => (
                <Check key={r.key} met={r.met}>
                  <b>{r.label}:</b> {r.detail}
                </Check>
              ))}
              <Check met={promotionOffer ?? bestInterest >= CONTRACT_RULES.MIN_INTEREST.promotion}>
                <b>Interesse de uma equipe {categoryRef(next.id, 'de')}:</b>{' '}
                {promotionOffer === null
                  ? `${Math.floor(bestInterest)} hoje (as propostas saem no fim da temporada, a partir de ${CONTRACT_RULES.MIN_INTEREST.promotion})`
                  : promotionOffer
                    ? 'há proposta para a próxima temporada'
                    : 'nenhuma proposta neste fim de temporada'}
              </Check>
            </ul>
            <p className="mt-3 text-xs text-ink-400">
              Você também precisa bancar a vaga (veja Finanças e as propostas no fim do ano); os três primeiros do campeonato ganham bolsa de 60%, 35% e 20% na
              vaga do degrau de cima.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-300">
            Você chegou {categoryRef(category.id, 'a')}. Agora é disputar vitórias e títulos enquanto a idade permitir: a partir dos 31 anos, a velocidade
            começa a cair.
          </p>
        )}
      </Card>
    </>
  );
}

/* ---------------- Licença ---------------- */

function LicenseTab() {
  const { career } = useCareerView();
  const points = licensePointsTotal(career.license, career.season);
  const history = [...career.license.history].reverse().slice(0, 6);
  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card title="Licença">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Pontos de licença" value={points} hint={`Últimas ${LICENSE_WINDOW_SEASONS} temporadas`} accent />
          <Stat label="Pontos de punição" value={`${career.license.penaltyPoints}/${PENALTY_POINTS_BAN}`} hint="Zeram a cada temporada" />
          <Stat label="Suspensões" value={career.license.banRounds} hint="Etapas a cumprir" />
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Cada temporada rende pontos pela posição final. Toques e infrações rendem pontos de punição; com {PENALTY_POINTS_BAN}, você é suspenso por uma etapa.
        </p>
      </Card>

      <Card title="Pontos por temporada" padded={false}>
        {history.length > 0 ? (
          <ul className="divide-y divide-ink-800 text-sm text-ink-300">
            {history.map((h) => (
              <li key={h.season} className="flex items-baseline justify-between gap-3 px-4 py-1.5">
                <span>
                  Temporada {h.season} · {getCategory(h.categoryId).shortName} · {h.position}º
                </span>
                <span className="font-display text-base font-semibold text-ink-100">+{h.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-ink-400">Os pontos de cada temporada concluída aparecem aqui.</p>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Fim de temporada: propostas e fechamento ---------------- */

function OffersTab({ offseason }: { offseason: Offseason }) {
  const { career, drivers } = useCareerView();
  const [chosen, setChosen] = useState<string | null>(null);
  useReveal(OFFER_ID, chosen);
  const offers = offseason.offers;
  // Sem escolha do jogador, abre a primeira proposta que ele pode assinar.
  const selected = offers.find((o) => o.id === chosen) ?? offers.find((o) => o.status !== 'withdrawn' && canAcceptOffer(career, o)) ?? offers[0];
  const champion = drivers[offseason.championDriverId];

  return (
    <>
      {offers.length === 0 || !selected ? (
        <EmptyState title="Nenhuma proposta">Nenhuma equipe fez proposta para {career.year + 1}.</EmptyState>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title={`Propostas para ${career.year + 1}`} padded={false} bodyClassName="md:max-h-[max(13.5rem,calc(100dvh-10rem))] md:overflow-y-auto">
            <ul>
              {offers.map((offer) => (
                <li key={offer.id} className="border-t border-ink-800 first:border-t-0">
                  <OfferRow offer={offer} selected={offer.id === selected.id} onSelect={() => setChosen(offer.id)} />
                </li>
              ))}
            </ul>
          </Card>
          <div id={OFFER_ID} className="min-w-0 scroll-mt-16">
            <OfferDetail key={selected.id} offer={selected} />
          </div>
        </div>
      )}

      <p className="text-xs text-ink-400">
        Ao assinar, a temporada vira: todos ficam um ano mais velhos e passam pela pré-temporada, o mercado de pilotos se movimenta e os patrocinadores
        satisfeitos renovam.
      </p>

      <Card title={`Fechamento da temporada ${career.year}`} tone="attention">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-6">
          <Stat label="Sua posição" value={`${offseason.playerPosition}º`} accent />
          <Stat label="Meta" value={`${offseason.target}º`} hint={offseason.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
          <Stat
            label="Pontos"
            value={offseason.playerPoints}
            hint={`${counted(offseason.wins, 'vitória', 'vitórias')} · ${counted(offseason.podiums, 'pódio', 'pódios')}`}
          />
          <Stat
            label="Reputação"
            value={
              <span className="inline-flex items-center gap-1">
                {Math.floor(offseason.reputationBefore)}
                <ArrowRight size={18} strokeWidth={2.5} className="text-ink-400" aria-label="para" />
                {offseason.reputationAfter}
              </span>
            }
          />
          <Stat label="Licença" value={`+${offseason.licensePointsEarned}`} hint="Pontos ganhos" />
          <Stat label="Campeão" value={<span className="block pt-1 text-lg leading-[1.1]">{champion ? fullName(champion) : '-'}</span>} />
        </div>
        {offseason.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-gold-400">
            {offseason.notes.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <TriangleAlert size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3">
          <ExportReminder link={false} className="min-w-0 flex-1 basis-72" />
          <Link to="/saves" className="inline-flex min-h-11 items-center text-xs font-semibold text-ink-200 underline underline-offset-2 hover:text-ink-100">
            Exportar agora
          </Link>
        </div>
      </Card>
    </>
  );
}

/** Linha da lista de propostas: o bastante para comparar; o resto aparece ao lado, na proposta aberta. */
function OfferRow({ offer, selected, onSelect }: { offer: Offer; selected: boolean; onSelect: () => void }) {
  const { career } = useCareerView();
  const category = getCategory(offer.categoryId);
  const team = teamsOfCategory(career, offer.categoryId).find((t) => t.id === offer.teamId);
  const withdrawn = offer.status === 'withdrawn';
  const blocked = !withdrawn && !canAcceptOffer(career, offer);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex min-h-12 w-full flex-col justify-center gap-0.5 px-3 py-1.5 text-left transition-colors',
        selected ? 'bg-ink-800 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-850',
        withdrawn && 'opacity-50',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <TeamSwatch team={team} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-100">{offer.teamName}</span>
        <span className={cx('shrink-0 text-xs font-semibold', withdrawn ? 'text-gold-400' : KIND_TEXT[kindTone(offer)])}>
          {withdrawn ? 'Retirada' : OFFER_KIND_LABELS[offer.kind]}
        </span>
      </span>
      <span className="flex w-full items-center justify-between gap-2 pl-3 text-xs text-ink-400">
        <span className="min-w-0 truncate">
          {category.shortName} · {offer.seatCost > 0 ? `vaga ${formatMoney(offer.seatCost)}` : `salário ${formatMoney(offer.salary)}`}
        </span>
        {blocked && (
          <span className="flex shrink-0 items-center gap-1 text-gold-400">
            <TriangleAlert size={13} strokeWidth={2} aria-hidden />
            Falta requisito
          </span>
        )}
      </span>
    </button>
  );
}

function kindTone(offer: Offer): 'good' | 'warn' | 'neutral' {
  return offer.kind === 'promotion' ? 'good' : offer.kind === 'demotion' || offer.kind === 'fallback' ? 'warn' : 'neutral';
}

const KIND_TEXT: Record<ReturnType<typeof kindTone>, string> = { good: 'text-go-400', warn: 'text-gold-400', neutral: 'text-ink-300' };

function Term({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cx(!stacked && 'flex items-baseline justify-between gap-3')}>
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className={cx(!stacked && 'text-right')}>{children}</dd>
    </div>
  );
}

/** A proposta aberta, com tudo o que ela traz e as ações: assinar (o passo que vira a temporada) e negociar. */
function OfferDetail({ offer }: { offer: Offer }) {
  const { career } = useCareerView();
  const negotiateOffer = useGameStore((s) => s.negotiateOffer);
  const startNextSeason = useGameStore((s) => s.startNextSeason);
  const [negotiating, setNegotiating] = useState(false);
  const category = getCategory(offer.categoryId);
  const requirements = offerRequirements(career, offer);
  const acceptable = canAcceptOffer(career, offer);
  const withdrawn = offer.status === 'withdrawn';
  const negotiable = !withdrawn && offer.kind !== 'continue' && offer.kind !== 'fallback';
  const margin = negotiationMargin(offer);
  const fee = releaseFeeFor(career, offer);
  const team = teamsOfCategory(career, offer.categoryId).find((t) => t.id === offer.teamId);
  const rank = rankTeams(teamsOfCategory(career, offer.categoryId)).findIndex((t) => t.id === offer.teamId) + 1;
  const courted = offer.kind !== 'continue' && offer.kind !== 'fallback';

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <TeamSwatch team={team} />
          {offer.teamName}
        </span>
      }
      action={
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5 py-1">
          <Pill tone={kindTone(offer)}>{OFFER_KIND_LABELS[offer.kind]}</Pill>
          {offer.scholarship > 0 && <Pill tone="good">Bolsa de {Math.round(offer.scholarship * 100)}%</Pill>}
          {withdrawn && <Pill tone="bad">Retirada</Pill>}
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="mb-2 text-xs text-ink-400">
        {category.name} · {rank}ª força do grid
      </div>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        <div>
          <dl className="space-y-0.5 text-sm">
            <Term label="Papel">
              <b>{ROLE_LABELS[offer.role]}</b>
            </Term>
            <Term label="Duração">{counted(offer.years, 'ano', 'anos')}</Term>
            <Term label="Vaga/ano">{formatMoney(offer.seatCost)}</Term>
            <Term label="Salário/ano">{formatMoney(offer.salary)}</Term>
            <Term label="Bônus vitória">{formatMoney(offer.bonuses.win)}</Term>
            <Term label="Multa">{formatMoney(offer.clauses.releaseFee)}</Term>
            <Term label="Cláusula de desempenho" stacked>
              {offer.clauses.performanceTarget ? `rescisão se terminar abaixo do ${offer.clauses.performanceTarget}º` : 'não há'}
            </Term>
          </dl>
        </div>

        <div className="flex flex-col gap-2.5">
          {courted && (
            <Meter
              label="Interesse da equipe"
              value={offer.interest}
              hint={
                negotiable
                  ? `Margem de negociação: ${margin >= 16 ? 'alta' : margin >= 8 ? 'média' : margin > 0 ? 'baixa' : 'nenhuma'} · paciência: ${counted(offer.patience, 'recusa', 'recusas')}`
                  : undefined
              }
            />
          )}
          {requirements.length > 0 && (
            <ul className="space-y-1.5">
              {requirements.map((r) => (
                <Check key={r.key} met={r.met}>
                  <b>{r.label}:</b> {r.detail}
                </Check>
              ))}
            </ul>
          )}
          {offer.kind === 'fallback' && (
            <p className="text-xs text-ink-400">Vaga sem custo e sem exigências: a equipe aposta em você. É a rede de segurança da carreira.</p>
          )}
          {fee > 0 && <p className="text-xs text-gold-400">Aceitar esta proposta rompe o contrato vigente: multa de {formatMoney(fee)}.</p>}
          <div className="mt-auto flex flex-wrap gap-2">
            {/* Na tela deitada, este botão sobe para a barra superior. */}
            <ScreenAction
              disabled={!acceptable}
              onClick={() => startNextSeason(offer.id)}
              title={`${offer.teamName} · ${category.shortName}`}
              className="text-base"
            >
              {offer.kind === 'continue' ? 'Cumprir o contrato' : 'Assinar'}
            </ScreenAction>
            {negotiable && (
              <Button variant={negotiating ? 'ghost' : 'secondary'} aria-expanded={negotiating} onClick={() => setNegotiating(!negotiating)}>
                {negotiating ? 'Fechar negociação' : 'Negociar'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {negotiating && negotiable && (
        <div className="mt-3 border-t border-ink-700 pt-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {DEMANDS.filter((d) => d.available(offer)).map((d) => (
              <Button key={d.id} onClick={() => negotiateOffer(offer.id, d.id)} className="justify-start text-left text-xs">
                {d.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Cada pedido aceito consome margem. Um pedido recusado gasta a paciência da equipe; quando ela acaba, a proposta é retirada.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Interesse das equipes ---------------- */

function MarketCard() {
  const { career, player } = useCareerView();
  const groups = reachableCategories(career);
  return (
    <Card title="Interesse das equipes" action={<span className="text-xs text-ink-400">Atualizado a cada etapa</span>} bodyClassName="p-3">
      <div className={cx('grid gap-x-6 gap-y-4', groups.length >= 3 ? 'md:grid-cols-3' : groups.length === 2 && 'md:grid-cols-2')}>
        {groups.map((group) => {
          const teams = rankTeams(teamsOfCategory(career, group.id))
            .map((team, index) => ({ team, rank: index + 1, interest: career.marketInterest[teamKey(group.id, team.id)] ?? 0 }))
            .sort((a, b) => b.interest - a.interest)
            .slice(0, 5);
          return (
            <div key={group.id} className="min-w-0">
              <div className="mb-2 flex min-h-5 items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">{group.shortName}</span>
                {group.id === career.categoryId && <Pill>Atual</Pill>}
              </div>
              <ul className="space-y-2">
                {teams.map(({ team, rank, interest }) => {
                  const mine = team.id === player.teamId && group.id === career.categoryId;
                  return (
                    <li key={team.id}>
                      <div className="mb-1 flex items-baseline gap-2 text-sm leading-tight">
                        <TeamSwatch team={team} className="self-center" />
                        <span className={cx('min-w-0 truncate', mine ? 'font-semibold text-ink-100' : 'text-ink-300')}>
                          {team.name}
                          {mine ? ' (sua equipe)' : ''}
                        </span>
                        <span className="shrink-0 text-xs text-ink-400">{rank}ª força</span>
                        <span className="ml-auto shrink-0 font-display text-lg font-semibold leading-none">{Math.round(interest)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-ink-800" role="img" aria-label={`Interesse da ${team.name}: ${Math.round(interest)} de 100`}>
                        <div
                          className={cx('h-full', interest >= 65 ? 'bg-go-400' : interest >= 40 ? 'bg-ink-200' : 'bg-gold-400')}
                          style={{ width: `${Math.max(0, Math.min(100, interest))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        Cada equipe avalia você pelo que ela mesma espera: a sua posição diante da meta dela, o seu nível diante do dos pilotos dela, a reputação e a idade. A
        partir de cerca de 50 de interesse, ela faz proposta no fim do ano; acima disso, crescem o desconto na vaga e a margem de negociação.
      </p>
    </Card>
  );
}

/* ---------------- Aposentadoria: uma faixa discreta no fim da tela ---------------- */

function Retirement() {
  const { career } = useCareerView();
  const retire = useGameStore((s) => s.retire);
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Aposentadoria das pistas" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink-700 pt-3">
      <p className="min-w-0 flex-1 basis-80 text-xs text-ink-400">
        <b className="font-semibold text-ink-300">Aposentadoria das pistas.</b> Pendurar o capacete é definitivo para este personagem, mas a carreira continua:
        você passa a atuar como dirigente (investidor, chefe de equipe ou dono) e acompanha os filhos.
        {confirming &&
          (career.offseason
            ? ' Como a temporada já acabou, as propostas de cargo e as equipes à venda aparecem em seguida.'
            : ' No meio da temporada, o reserva assume o seu carro e você acompanha o resto do campeonato de fora.')}
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {confirming ? (
          <>
            <Button variant="danger" disabled={career.weekend !== null} onClick={retire}>
              Confirmar: parar de correr
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Pendurar o capacete
          </Button>
        )}
      </div>
    </section>
  );
}
