import { useMemo, useState } from 'react';
import type { Offer } from '@/domain/schemas';
import { OFFER_KIND_LABELS, ROLE_LABELS } from '@/domain/labels';
import { CATEGORIES, LICENSE_WINDOW_SEASONS, PENALTY_POINTS_BAN, categoryByTier, getCategory } from '@/data/categories';
import {
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
import { Button, Card, Check, Meter, PageHeader, Pill, Stat, TeamSwatch, cx } from '../components/ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';

const DEMANDS: { id: NegotiationDemand; label: string; available: (o: Offer) => boolean }[] = [
  { id: 'seat', label: 'Reduzir o custo da vaga', available: (o) => o.seatCost > 0 },
  { id: 'salary', label: 'Aumentar o salário', available: (o) => o.salary > 0 },
  { id: 'bonus', label: 'Melhorar os bônus', available: (o) => o.bonuses.win > 0 },
  { id: 'role', label: 'Pedir o status de primeiro piloto', available: (o) => o.role !== 'first' },
  { id: 'longer', label: 'Contrato mais longo', available: (o) => o.years < 3 },
  { id: 'shorter', label: 'Contrato mais curto', available: (o) => o.years > 1 },
  { id: 'clause', label: 'Retirar a cláusula de desempenho', available: (o) => o.clauses.performanceTarget !== null },
];

export function CareerScreen() {
  const { career, player, team, category, drivers } = useCareerView();
  const retire = useGameStore((s) => s.retire);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const next = categoryByTier(category.tier + 1);
  const points = licensePointsTotal(career.license, career.season);
  const requirements = useMemo(() => (next ? categoryRequirements(career, next.id) : []), [career, next]);
  const champion = career.offseason ? drivers[career.offseason.championDriverId] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${player.firstName} ${player.lastName} · ${player.age} anos`} title="Carreira">
        <span className="text-sm text-ink-400">Reputação <b className="text-ink-100 tabular">{Math.floor(career.reputation)}</b>/100</span>
      </PageHeader>

      {career.offseason && career.status === 'active' && (
        <Card title={`Fechamento da temporada ${career.year}`} className="border-gold-400/40">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Sua posição" value={`${career.offseason.playerPosition}º`} accent />
            <Stat label="Meta" value={`${career.offseason.target}º`} hint={career.offseason.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
            <Stat label="Pontos" value={career.offseason.playerPoints} hint={`${career.offseason.wins} vitória(s) · ${career.offseason.podiums} pódio(s)`} />
            <Stat label="Reputação" value={`${Math.floor(career.offseason.reputationBefore)} → ${career.offseason.reputationAfter}`} />
            <Stat label="Licença" value={`+${career.offseason.licensePointsEarned}`} hint="Pontos ganhos" />
          </div>
          <p className="mt-3 text-sm text-ink-300">Campeão: <b className="text-ink-100">{champion ? fullName(champion) : '-'}</b>.</p>
          {career.offseason.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-gold-400">
              {career.offseason.notes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          )}
          <h3 className="mt-6 mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-300">Propostas para {career.year + 1}</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {career.offseason.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
          <p className="mt-4 text-xs text-ink-400">Ao assinar, a temporada vira: todos ficam um ano mais velhos e passam pela pré-temporada, o mercado de pilotos se movimenta e os patrocinadores satisfeitos renovam.</p>
        </Card>
      )}

      <Card title="Escada do automobilismo">
        <ol className="grid gap-2 md:grid-cols-7">
          {CATEGORIES.map((c) => {
            const state = c.tier < category.tier ? 'done' : c.tier === category.tier ? 'current' : 'ahead';
            const seasons = career.history.filter((h) => h.categoryId === c.id).length + (c.id === category.id ? 1 : 0);
            return (
              <li key={c.id} className={cx('rounded-lg border p-3', state === 'current' ? 'border-apex-500 bg-apex-500/10' : state === 'done' ? 'border-ink-700 bg-ink-900' : 'border-ink-800 opacity-70')}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Degrau {c.tier}</div>
                <div className="font-display text-lg font-bold uppercase leading-tight">{c.shortName}</div>
                {/* O veículo de cada degrau, em proporção: do kart de entrada ao F1. Na categoria atual, com a pintura da equipe. */}
                <div className="flex h-12 items-center" title={VEHICLES[c.id].description}>
                  <CarSprite categoryId={c.id} teamId={state === 'current' ? team.id : 'escada'} color={state === 'current' ? team.color : '#aab3c2'} driverId={state === 'current' ? player.id : undefined} style={{ width: `${Math.round((VEHICLES[c.id].length / VEHICLES.f1.length) * 100)}%` }} />
                </div>
                <div className="text-[11px] text-ink-300">{VEHICLES[c.id].name}</div>
                <div className="mt-1 text-xs text-ink-400">{seasons > 0 ? `${seasons} temporada(s)` : `Vaga: ${formatMoney(c.economy.seatCost[1])} a ${formatMoney(c.economy.seatCost[0])}`}</div>
              </li>
            );
          })}
        </ol>
        {career.categoryId === 'kart-national' && <p className="mt-3 text-xs text-ink-400">Do kart nacional é possível ir direto para a Fórmula 4, se você cumprir os requisitos dela.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={next ? `Requisitos para a ${next.shortName}` : 'Topo da escada'}>
          {next ? (
            <>
              <ul className="space-y-2">
                {requirements.map((r) => <Check key={r.key} met={r.met}><b>{r.label}:</b> {r.detail}</Check>)}
                <Check met={Object.entries(career.marketInterest).some(([key, value]) => key.startsWith(`${next.id}:`) && value >= 50)}>
                  <b>Proposta de uma equipe:</b> pelo menos uma equipe da {next.shortName} precisa ter interesse de 50 ou mais.
                </Check>
              </ul>
              <p className="mt-3 text-xs text-ink-400">A idade vale para o início da próxima temporada. Além disso, você precisa conseguir bancar a vaga (ver Finanças e as propostas no fim do ano). Os três primeiros do campeonato ganham bolsa de 60%, 35% e 20% na vaga do degrau de cima.</p>
            </>
          ) : (
            <p className="text-sm text-ink-300">Você chegou à Fórmula 1. Agora é disputar vitórias e títulos enquanto a idade permitir: a partir dos 31 anos, a velocidade começa a cair.</p>
          )}
        </Card>

        <Card title="Licença">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Pontos de licença" value={points} hint={`Últimas ${LICENSE_WINDOW_SEASONS} temporadas`} accent />
            <Stat label="Pontos de punição" value={`${career.license.penaltyPoints}/${PENALTY_POINTS_BAN}`} hint="Zeram a cada temporada" />
            <Stat label="Suspensões" value={career.license.banRounds} hint="Etapas a cumprir" />
          </div>
          {career.license.history.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-ink-300">
              {[...career.license.history].reverse().slice(0, 6).map((h) => (
                <li key={h.season} className="flex justify-between gap-3">
                  <span>Temporada {h.season} · {getCategory(h.categoryId).shortName} · {h.position}º</span>
                  <span className="tabular text-ink-100">+{h.points}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-400">Cada temporada rende pontos pela posição final. Toques e infrações rendem pontos de punição; com {PENALTY_POINTS_BAN}, você é suspenso por uma etapa.</p>
        </Card>
      </div>

      <MarketCard />

      {career.status === 'active' && (
        <Card title="Aposentadoria das pistas">
          <p className="max-w-3xl text-sm text-ink-400">Pendurar o capacete é definitivo para este personagem, mas a carreira continua: você passa a atuar como dirigente (investidor, chefe de equipe ou dono) e acompanha os filhos. {career.offseason ? 'Como a temporada já acabou, as propostas de cargo e as equipes à venda aparecem em seguida.' : 'No meio da temporada, o reserva assume o seu carro e você acompanha o resto do campeonato de fora.'}</p>
          <div className="mt-3 flex gap-2">
            {confirmRetire ? (
              <>
                <Button variant="danger" disabled={career.weekend !== null} onClick={retire}>Confirmar: parar de correr</Button>
                <Button variant="ghost" onClick={() => setConfirmRetire(false)}>Cancelar</Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRetire(true)}>Pendurar o capacete</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
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
  const kindTone = offer.kind === 'promotion' ? 'good' : offer.kind === 'demotion' || offer.kind === 'fallback' ? 'warn' : 'neutral';

  return (
    <div className={cx('rounded-xl border p-4', withdrawn ? 'border-ink-800 opacity-50' : acceptable ? 'border-ink-600 bg-ink-850' : 'border-ink-800 bg-ink-900')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold"><TeamSwatch team={team} />{offer.teamName}</div>
          <div className="text-xs text-ink-400">{category.name} · {rank}ª força do grid</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={kindTone}>{OFFER_KIND_LABELS[offer.kind]}</Pill>
          {offer.scholarship > 0 && <Pill tone="good">Bolsa de {Math.round(offer.scholarship * 100)}%</Pill>}
          {withdrawn && <Pill tone="bad">Retirada</Pill>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-ink-400">Papel</dt><dd className="font-semibold">{ROLE_LABELS[offer.role]}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-400">Duração</dt><dd>{offer.years} ano(s)</dd></div>
        <div className="flex justify-between"><dt className="text-ink-400">Vaga/ano</dt><dd className="tabular">{formatMoney(offer.seatCost)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-400">Salário/ano</dt><dd className="tabular">{formatMoney(offer.salary)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-400">Bônus vitória</dt><dd className="tabular">{formatMoney(offer.bonuses.win)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-400">Multa</dt><dd className="tabular">{formatMoney(offer.clauses.releaseFee)}</dd></div>
        <div className="col-span-2 flex justify-between"><dt className="text-ink-400">Cláusula de desempenho</dt><dd>{offer.clauses.performanceTarget ? `rescisão se terminar abaixo do ${offer.clauses.performanceTarget}º` : 'não há'}</dd></div>
      </dl>
      {fee > 0 && <p className="mt-2 text-xs text-gold-400">Aceitar esta proposta rompe o contrato vigente: multa de {formatMoney(fee)}.</p>}

      {offer.kind !== 'continue' && offer.kind !== 'fallback' && (
        <div className="mt-3"><Meter label="Interesse da equipe" value={offer.interest} hint={negotiable ? `Margem de negociação: ${margin >= 16 ? 'alta' : margin >= 8 ? 'média' : margin > 0 ? 'baixa' : 'nenhuma'} · paciência: ${offer.patience} recusa(s)` : undefined} /></div>
      )}

      {requirements.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {requirements.map((r) => <Check key={r.key} met={r.met}><b>{r.label}:</b> {r.detail}</Check>)}
        </ul>
      )}
      {offer.kind === 'fallback' && <p className="mt-3 text-xs text-ink-400">Vaga sem custo e sem exigências: a equipe aposta em você. É a rede de segurança da carreira.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={!acceptable} onClick={() => startNextSeason(offer.id)}>{offer.kind === 'continue' ? 'Cumprir o contrato' : 'Assinar'}</Button>
        {negotiable && <Button variant="ghost" onClick={() => setNegotiating(!negotiating)}>{negotiating ? 'Fechar negociação' : 'Negociar'}</Button>}
      </div>
      {negotiating && negotiable && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {DEMANDS.filter((d) => d.available(offer)).map((d) => (
            <button key={d.id} type="button" onClick={() => negotiateOffer(offer.id, d.id)} className="rounded-lg border border-ink-700 px-3 py-2 text-left text-xs font-semibold text-ink-300 hover:border-ink-500 hover:text-ink-100">
              {d.label}
            </button>
          ))}
          <p className="col-span-full text-xs text-ink-500">Cada pedido aceito consome margem. Um pedido recusado gasta a paciência da equipe; quando ela acaba, a proposta é retirada.</p>
        </div>
      )}
    </div>
  );
}

function MarketCard() {
  const { career, player } = useCareerView();
  const groups = reachableCategories(career);
  return (
    <Card title="Interesse das equipes" action={<span className="text-xs text-ink-400">Atualizado a cada etapa</span>}>
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((group) => {
          const teams = rankTeams(teamsOfCategory(career, group.id))
            .map((team, index) => ({ team, rank: index + 1, interest: career.marketInterest[teamKey(group.id, team.id)] ?? 0 }))
            .sort((a, b) => b.interest - a.interest)
            .slice(0, 5);
          return (
            <div key={group.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-300">{group.shortName}</span>
                {group.id === career.categoryId && <Pill>Atual</Pill>}
              </div>
              <div className="space-y-3">
                {teams.map(({ team, rank, interest }) => (
                  <Meter key={team.id} label={<span className="flex items-center gap-2"><TeamSwatch team={team} />{team.name}{team.id === player.teamId && group.id === career.categoryId ? ' (sua equipe)' : ''} <span className="text-xs text-ink-500">#{rank}</span></span>} value={interest} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-400">Cada equipe avalia você pelo que ela mesma espera: a sua posição comparada à meta dela, o seu nível comparado ao dos pilotos dela, a reputação e a idade. Com interesse a partir de cerca de 50, ela faz proposta no fim do ano; acima disso, cresce o desconto na vaga e a margem de negociação.</p>
    </Card>
  );
}
