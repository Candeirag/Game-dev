/**
 * Caminhos: quanto falta para a próxima vaga e como está cada porta (Fase 3 da grande
 * atualização). O jogador nunca pode ficar sem saber o que fazer: toda porta mostra o que dá, o
 * que cobra e o progresso de cada requisito, e a porta "mais um ano" nunca fecha.
 *
 * Só apresentação: o retrato vem de `pathsReport`, do motor, e os botões chamam ações da store. As
 * portas pagas (academia, vaquinha, investidor) só podem ser usadas no fechamento do ano.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, CircleCheck, DoorClosed, DoorOpen, Hourglass, type LucideIcon } from 'lucide-react';
import type { SideJob } from '@/domain/schemas';
import { categoryRef } from '@/domain/categoryNames';
import { counted } from '@/domain/text';
import { getCategory } from '@/data/categories';
import { SIDE_JOB_INFO } from '@/data/doors';
import {
  canJoinAcademy,
  canLaunchCrowdfund,
  canSignInvestor,
  crowdfundAmount,
  type Door,
  type DoorStatus,
  investorAmount,
  type NextSeat,
  pathsReport,
  type PathRequirement,
  realOffers,
  sideJobAllowed,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Check, Chip, PageHeader, Panel, ProgressBar, Segmented, type Tone } from '@/ui/kit';
import { formatMoney, formatMoneyFull } from '../format';
import { useCareerView } from '../hooks/useCareer';

const STATUS: Record<DoorStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  active: { label: 'Em vigor', tone: 'good', icon: CircleCheck },
  open: { label: 'Aberta', tone: 'good', icon: DoorOpen },
  near: { label: 'Perto de abrir', tone: 'attention', icon: Hourglass },
  closed: { label: 'Fechada', tone: 'neutral', icon: DoorClosed },
};

const JOB_OPTIONS: readonly { value: SideJob; label: string }[] = (['none', 'instructor', 'mechanic'] as const).map((value) => ({
  value,
  label: SIDE_JOB_INFO[value].name,
}));

export function PathsScreen() {
  const { career, category } = useCareerView();
  const report = pathsReport(career);
  const position = report.position;

  return (
    <div>
      <PageHeader
        title="Caminhos"
        eyebrow={
          <span>
            {category.shortName} · {position === null ? 'a temporada ainda não começou' : `${position}º no campeonato`}
            {report.atOffseason ? ' · fim de temporada: as portas abertas podem ser usadas agora' : ' · as portas abrem no fim da temporada'}
          </span>
        }
      >
        <Link to="/career" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-200 hover:text-ink-100">
          Propostas na tela Carreira <ChevronRight size={16} aria-hidden />
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {report.next.length > 0 && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {report.next.map((seat) => (
              <NextSeatPanel key={seat.categoryId} seat={seat} />
            ))}
          </div>
        )}

        {report.noDoorSeasons > 0 && (
          <Panel tone="attention" title="Sem porta">
            <p className="text-sm text-ink-200">
              {counted(report.noDoorSeasons, 'temporada seguida', 'temporadas seguidas')} sem nenhuma porta aberta.{' '}
              {report.lastResortIn > 0
                ? 'Se a próxima também fechar assim, um investidor de último recurso aparece: nunca fica uma parede sem porta.'
                : 'O investidor de último recurso está à mesa neste fechamento.'}
            </p>
          </Panel>
        )}

        <div className="grid items-start gap-4 md:grid-cols-2">
          {report.doors.map((door) => (
            <DoorPanel key={door.id} door={door} atOffseason={report.atOffseason} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Quanto falta para a vaga mais barata de um campeonato de cima. */
function NextSeatPanel({ seat }: { seat: NextSeat }) {
  const category = getCategory(seat.categoryId);
  const need = seat.seatAfterScholarship + seat.moveCost + seat.runningCosts;
  const have = need - seat.missing;
  return (
    <Panel
      title={`Próxima vaga: ${category.shortName}`}
      action={
        <Chip tone={seat.missing === 0 ? 'good' : 'attention'} icon={seat.missing === 0 ? <CircleCheck size={12} aria-hidden /> : undefined}>
          {seat.missing === 0 ? 'O dinheiro dá' : `Faltam ${formatMoney(seat.missing)}`}
        </Chip>
      }
    >
      <ProgressBar value={have} max={Math.max(1, need)} tone={seat.missing === 0 ? 'good' : 'attention'} label={`Você cobre ${formatMoneyFull(have)} de ${formatMoneyFull(need)}`} />
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-300">Vaga mais barata {categoryRef(seat.categoryId, 'de')}</dt>
        <dd className="text-right text-ink-100">{formatMoneyFull(seat.seatCost)}</dd>
        {seat.scholarship > 0 && (
          <>
            <dt className="text-ink-300">Com a bolsa de {Math.round(seat.scholarship * 100)}% da sua posição</dt>
            <dd className="text-right text-ink-100">{formatMoneyFull(seat.seatAfterScholarship)}</dd>
          </>
        )}
        <dt className="text-ink-300">Viagens, equipamento, aluguel, vida e treino do ano</dt>
        <dd className="text-right text-ink-100">{formatMoneyFull(seat.runningCosts)}</dd>
        {seat.moveTo && (
          <>
            <dt className="text-ink-300">Mudança para {seat.moveTo}</dt>
            <dd className="text-right text-ink-100">{formatMoneyFull(seat.moveCost)}</dd>
          </>
        )}
        <dt className="text-ink-300">Você tem em caixa</dt>
        <dd className="text-right text-ink-100">{formatMoneyFull(seat.cash)}</dd>
        <dt className="text-ink-300">Patrocínios que seguem com você</dt>
        <dd className="text-right text-ink-100">{formatMoneyFull(seat.sponsors)}</dd>
      </dl>
      {seat.moveTo && (
        <p className="mt-2 text-xs text-ink-400">
          Mudar de polo é decisão grande: aluguel o ano todo, um ano para se virar no idioma e a família longe. Em troca, as equipes de lá passam a ver você.
        </p>
      )}
      <ul className="mt-4 space-y-1 border-t border-ink-700 pt-4">
        {seat.sporting.map((r) => (
          <Check key={r.key} met={r.met}>
            {r.label}: {r.detail}
          </Check>
        ))}
      </ul>
    </Panel>
  );
}

function RequirementRow({ requirement }: { requirement: PathRequirement }) {
  return (
    <li className="space-y-1">
      <ul>
        <Check met={requirement.met}>
          <b className="font-semibold">{requirement.label}:</b> {requirement.detail}
        </Check>
      </ul>
      {!requirement.met && <ProgressBar value={requirement.progress} max={1} tone="attention" />}
    </li>
  );
}

function DoorPanel({ door, atOffseason }: { door: Door; atOffseason: boolean }) {
  const status = STATUS[door.status];
  const Icon = status.icon;
  return (
    <Panel
      title={door.title}
      tone={door.status === 'near' ? 'attention' : door.status === 'closed' ? 'neutral' : 'good'}
      action={
        <Chip tone={status.tone} icon={<Icon size={12} aria-hidden />}>
          {status.label}
        </Chip>
      }
    >
      <p className="text-sm text-ink-200">{door.summary}</p>
      <p className="mt-2 text-sm text-ink-300">
        <b className="font-semibold text-ink-100">O que cobra:</b> {door.price}
      </p>
      {door.requirements.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-ink-700 pt-4">
          {door.requirements.map((r) => (
            <RequirementRow key={r.label} requirement={r} />
          ))}
        </ul>
      )}
      <DoorAction door={door} atOffseason={atOffseason} />
    </Panel>
  );
}

/** O que dá para fazer com a porta agora. */
function DoorAction({ door, atOffseason }: { door: Door; atOffseason: boolean }) {
  const { career } = useCareerView();
  const joinAcademy = useGameStore((s) => s.joinAcademy);
  const launchCrowdfund = useGameStore((s) => s.launchCrowdfund);
  const signInvestor = useGameStore((s) => s.signInvestor);
  const setSideJob = useGameStore((s) => s.setSideJob);
  const wrap = 'mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4';

  if (door.id === 'job') {
    if (!sideJobAllowed(career.categoryId)) return null;
    return (
      <div className="mt-4 space-y-2 border-t border-ink-700 pt-4">
        <Segmented value={career.sideJob} options={JOB_OPTIONS} onChange={setSideJob} label="Trabalho paralelo" />
        <p className="text-xs text-ink-400">{SIDE_JOB_INFO[career.sideJob].description}</p>
      </div>
    );
  }
  if (door.id === 'wait' || door.id === 'own') {
    if (!atOffseason) return null;
    return (
      <div className={wrap}>
        <Link to="/career" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-200 hover:text-ink-100">
          Ver as propostas <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    );
  }
  if (door.id === 'academy' && canJoinAcademy(career)) {
    return (
      <div className={wrap}>
        <Button variant="primary" onClick={joinAcademy}>
          Entrar na academia
        </Button>
      </div>
    );
  }
  if (door.id === 'crowdfund' && canLaunchCrowdfund(career)) {
    return (
      <div className={wrap}>
        <Button variant="primary" onClick={launchCrowdfund}>
          Fazer a vaquinha ({formatMoney(crowdfundAmount(career))})
        </Button>
      </div>
    );
  }
  if (door.id === 'investor') {
    const funded = career.investor?.funded?.season === career.season ? career.investor.funded.offerId : null;
    const offers = realOffers(career).filter((o) => canSignInvestor(career, o.id));
    return (
      <>
        {career.investor && (
          <p className="mt-4 border-t border-ink-700 pt-4 text-sm text-ink-200">
            {career.investor.name} leva <b className="font-semibold text-ink-100">{Math.round(career.investor.share * 100)}%</b> dos seus ganhos. Já pôs{' '}
            {formatMoneyFull(career.investor.invested)} na sua carreira e recebeu {formatMoneyFull(career.investor.received)}.
            {funded && ' O aporte deste ano já está no caixa e só vale para a vaga que ele pagou: assine na tela Carreira.'}
          </p>
        )}
        {offers.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-ink-700 pt-4">
            {offers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-ink-200">
                  {offer.teamName} · {getCategory(offer.categoryId).shortName}
                </span>
                <Button onClick={() => signInvestor(offer.id)}>Pagar esta vaga com o investidor ({formatMoney(investorAmount(career, offer))})</Button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  return null;
}

/** Resumo dos caminhos para o Painel: o estado de cada porta e o atalho para a tela. */
export function PathsSummary() {
  const { career } = useCareerView();
  const report = pathsReport(career);
  const nearest = [...report.next].sort((a, b) => a.missing - b.missing)[0];
  return (
    <Panel
      title="Caminhos"
      action={
        <Link to="/paths" className="-my-1 flex min-h-11 items-center gap-1 text-xs font-semibold text-ink-300 hover:text-ink-100">
          Ver caminhos <ChevronRight size={14} aria-hidden />
        </Link>
      }
    >
      <p className="text-sm text-ink-200">
        {nearest
          ? nearest.missing === 0
            ? `O dinheiro para a vaga mais barata ${categoryRef(nearest.categoryId, 'de')} já dá.`
            : `Faltam ${formatMoney(nearest.missing)} para a vaga mais barata ${categoryRef(nearest.categoryId, 'de')}.`
          : 'Você está no topo da escada.'}
      </p>
      <ul className="mt-4 space-y-2">
        {report.doors.map((door) => {
          const status = STATUS[door.status];
          const Icon = status.icon;
          return (
            <li key={door.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink-300">{door.title}</span>
              <Chip size="sm" tone={status.tone} icon={<Icon size={12} aria-hidden />} className="shrink-0">
                {status.label}
              </Chip>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
