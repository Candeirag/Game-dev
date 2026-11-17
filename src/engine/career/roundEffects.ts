/**
 * Efeitos de uma etapa sobre a carreira.
 *
 * Depois que o resultado oficial é gravado, esta sequência liga todos os
 * sistemas, sempre na mesma ordem:
 *
 *  1. Economia: salário, patrocínios, bônus, vaga, custos e conta de danos;
 *     patrimônio pessoal (ações, imóveis, empréstimos) e custos com a família.
 *  2. Condição: fase, confiança e moral de todos os pilotos; lesões e
 *     recuperação. A vida pessoal do jogador (padrão de vida, casa, parceiro)
 *     entra na moral dele.
 *  3. Licença: pontos de punição, suspensões e punições de grid.
 *  4. Relações: confiança da equipe, companheiro (ordens de equipe) e rivalidades.
 *  5. Patrocinadores: satisfação; os muito insatisfeitos rompem o contrato.
 *  6. Evolução: treino (foco, intensidade, moral, academia).
 *  7. Mercado: interesse das equipes.
 *  8. Eventos: decisões pendentes geradas pelo que aconteceu.
 *  9. Mensagens; depois, as revelações dos talentos e defeitos ocultos do nascimento.
 *
 * O nascimento (Fase 2) entra em quatro pontos: as viagens de quem mora no interior (1), o
 * carisma na satisfação dos patrocinadores (5), o ritmo de aprendizado e a estrutura de treino (6)
 * e o evento da mudança para São Paulo (8).
 */
import type { CareerState, Driver, InboxMessage, RoundRecord } from '@/domain/schemas';
import { ATTRIBUTE_LABELS, DNF_LABELS, TRAINING_FOCUS_LABELS } from '@/domain/labels';
import { PENALTY_POINTS_BAN, getCategory } from '@/data/categories';
import { getTrack } from '@/data/tracks';
import { computeDriverStandings } from '../championship/standings';
import { generateEvents } from '../events/engine';
import { createRng, hashSeed } from '../rng';
import { conditionAfterRace, recoverInjury, rollInjury } from './condition';
import { INTENSITY_GAIN, developAfterRound, type AttributeDelta } from './development';
import { LIFESTYLE_RULES } from '@/data/assets';
import { partnerMoraleEffect } from '../dynasty/family';
import { hasPersonalProperty, settleAssetsRound } from '../economy/assets';
import { post, settleRound } from './economy';
import { BIRTH } from '@/config/balance';
import { birthTrainingFactor, interiorWeighs, sponsorSatisfactionBonus } from '../birth/effects';
import { moveEventFor } from '../birth/move';
import { revealTraits } from '../birth/reveal';
import { pushMessages } from './inbox';
import { updateMarketInterest } from './market';
import { fullName, getPlayer, getTeam, getTeammate } from './selectors';
import { SPONSOR_RULES, satisfactionAfterRound } from './sponsors';
import { money } from './selectors';
import { counted } from '@/domain/text';

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

export const RELATION_RULES = {
  /**
   * Confiança da equipe: 1 ponto por posição em relação à meta, de −5 a +6 por
   * etapa. Além disso, ela volta 4% do caminho até 50 a cada etapa: a equipe
   * cobra resultados recentes, não um crédito eterno.
   */
  TRUST_PER_POSITION: 1,
  TRUST_REVERSION: 0.04,
  TRUST_OWN_FAULT_DNF: -5,
  TRUST_ORDER_OBEYED: 5,
  TRUST_ORDER_IGNORED: -10,
  /** Rivalidade: toque +15; toque com abandono +25; perde 2 por etapa sem incidentes. */
  RIVALRY_COLLISION: 15,
  RIVALRY_DNF: 25,
  RIVALRY_DECAY: 2,
  /** Vizinho direto na tabela, a até 10 pontos: +3 por etapa. */
  RIVALRY_STANDINGS: 3,
  /** Treino intenso: 1,5% de chance de lesão leve por etapa. */
  INTENSE_TRAINING_INJURY: 0.015,
} as const;

function formatDelta(delta: AttributeDelta): string {
  return (
    Object.entries(delta)
      .filter(([, v]) => (v ?? 0) >= 0.05)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      // Decimal com vírgula, como no resto do jogo em português ("Velocidade +0,7"). Só texto: os números não mudam.
      .map(([k, v]) => `${ATTRIBUTE_LABELS[k as keyof typeof ATTRIBUTE_LABELS]} +${(v ?? 0).toFixed(1).replace('.', ',')}`)
      .join(', ')
  );
}

export function applyRoundEffects(input: CareerState, record: RoundRecord, gridDrops: Readonly<Record<string, number>>): CareerState {
  let career = input;
  const category = getCategory(career.categoryId);
  const { season } = career;
  const round = record.round;
  const playerBefore = getPlayer(career);
  const team = getTeam(career, playerBefore.teamId ?? '');
  const entry = record.race.entries.find((e) => e.driverId === playerBefore.id) ?? null;
  const messages: InboxMessage[] = [];
  const msg = (id: string, category: InboxMessage['category'], title: string, body: string) =>
    messages.push({ id: `s${season}-r${round}-${id}`, date: record.date, category, title, body });

  /* 1. Economia */
  const cashBefore = career.finance.cash;
  career = { ...career, finance: settleRound(career, round, entry) };
  // Patrimônio e família: cotações, aluguéis, parcelas de empréstimos e custos com os filhos.
  career = { ...career, finance: settleAssetsRound(career, round) };
  // Quem nasceu no interior e ainda não se mudou paga as viagens até os kartódromos.
  if (interiorWeighs(career))
    career = { ...career, finance: post(career.finance, season, round, 'family', -BIRTH.INTERIOR_TRAVEL_PER_ROUND, 'Viagens do interior') };
  if (cashBefore >= 0 && career.finance.cash < 0) {
    msg(
      'debt',
      'finance',
      'Conta no vermelho',
      'O seu caixa ficou negativo. A dívida paga 14% de juros no fim da temporada, e as equipes olham as suas finanças antes de oferecer uma vaga.',
    );
  }

  /* 2. Condição e lesões (todos os pilotos) */
  const trainingRng = createRng(hashSeed(career.seed, season, round, 'training-injury'));
  // Vida fora das pistas: padrão de vida, moradia e relacionamento mexem com a moral do jogador.
  const lifeMorale =
    LIFESTYLE_RULES[career.finance.lifestyle].morale +
    partnerMoraleEffect(career.family) +
    (hasPersonalProperty(career.finance, 'apartamento') ? 0.3 : 0) +
    (hasPersonalProperty(career.finance, 'casa-campo') ? 0.5 : 0);
  const healthPartner = career.family.partner?.background === 'health';
  const drivers: Driver[] = career.drivers.map((d) => {
    if (!d.teamId) return d;
    const e = record.race.entries.find((x) => x.driverId === d.id) ?? null;
    const raced = e !== null;
    const target = career.teams.find((t) => t.id === d.teamId)?.driverTarget ?? 10;
    let condition = d.role === 'reserve' && !raced ? d.condition : conditionAfterRace(d.condition, e, target);
    let injury = recoverInjury(d.injury, !raced);
    if (e?.injured) injury = rollInjury(hashSeed(career.seed, season, round, 'injury', d.id));
    // Com um parceiro da área da saúde, a recuperação do jogador leva uma etapa a menos.
    if (d.isPlayer && healthPartner && e?.injured && injury) injury = { ...injury, roundsRemaining: Math.max(1, injury.roundsRemaining - 1) };
    if (d.isPlayer) {
      if (lifeMorale !== 0) condition = { ...condition, morale: clamp(condition.morale + lifeMorale) };
      // Intensidade do treino: o leve recupera a fase; o intenso desgasta e pode lesionar.
      if (career.trainingIntensity === 'light') condition = { ...condition, form: clamp(condition.form + 2) };
      if (career.trainingIntensity === 'intense') {
        condition = { ...condition, form: clamp(condition.form - 2) };
        if (!injury && trainingRng.next() < RELATION_RULES.INTENSE_TRAINING_INJURY)
          injury = { description: 'Estiramento muscular no treino', severity: 'minor', roundsRemaining: 1 };
      }
    }
    return { ...d, condition, injury };
  });
  career = { ...career, drivers };
  const player = getPlayer(career);
  if (player.injury && (!playerBefore.injury || entry?.injured)) {
    msg(
      'injury',
      'health',
      `Lesão: ${player.injury.description}`,
      player.injury.severity === 'serious'
        ? `Os médicos vetam a sua participação ${player.injury.roundsRemaining === 1 ? 'na próxima etapa' : `nas próximas ${player.injury.roundsRemaining} etapas`}. O piloto reserva assume o ${category.machine}.`
        : `Recuperação prevista: ${counted(player.injury.roundsRemaining, 'etapa', 'etapas')}. Você pode correr, com perda de rendimento, ou ceder a vaga ao reserva para se recuperar.`,
    );
  } else if (playerBefore.injury && !player.injury) {
    msg('recovered', 'health', 'Alta médica', 'Você está totalmente recuperado.');
  }

  /* 3. Licença */
  let license = career.license;
  if (license.banRounds > 0 && !entry) license = { ...license, banRounds: license.banRounds - 1 };
  if (entry && entry.penaltyPoints > 0) license = { ...license, penaltyPoints: license.penaltyPoints + entry.penaltyPoints };
  if (license.penaltyPoints >= PENALTY_POINTS_BAN) {
    license = { ...license, penaltyPoints: license.penaltyPoints - PENALTY_POINTS_BAN, banRounds: license.banRounds + 1 };
    msg('ban', 'race', 'Suspensão por pontos de punição', `Você atingiu ${PENALTY_POINTS_BAN} pontos de punição e está suspenso da próxima etapa.`);
  }
  // As punições de grid anteriores foram cumpridas nesta etapa; ficam as novas.
  career = { ...career, license, gridPenalties: { ...gridDrops } };
  if ((gridDrops[player.id] ?? 0) > 0) msg('grid', 'race', 'Punição de grid', `Você perde ${gridDrops[player.id]} posições no grid da próxima etapa.`);

  /* 4. Relações */
  let { teamTrust, teammate } = career.relations;
  teamTrust += (50 - teamTrust) * RELATION_RULES.TRUST_REVERSION;
  const rivalries: Record<string, number> = {};
  for (const [id, value] of Object.entries(career.relations.rivalries)) {
    if (value - RELATION_RULES.RIVALRY_DECAY > 0 && career.drivers.some((d) => d.id === id && d.teamId)) rivalries[id] = value - RELATION_RULES.RIVALRY_DECAY;
  }
  if (entry) {
    if (entry.status === 'finished') teamTrust += Math.max(-5, Math.min(6, (team.driverTarget - entry.position) * RELATION_RULES.TRUST_PER_POSITION));
    else if (entry.dnfReason === 'crash' || entry.dnfReason === 'fuel') teamTrust += RELATION_RULES.TRUST_OWN_FAULT_DNF;
    else if (entry.dnfReason === 'collision' || entry.dnfReason === 'damage') teamTrust -= 1;
    teamTrust -= 2 * Math.min(1, entry.damage);
    if (entry.penaltySeconds > 0) teamTrust -= 1;
  }
  const mate = getTeammate(career);
  for (const order of record.race.teamOrders) {
    if (order.askedDriverId === player.id) {
      teamTrust += order.obeyed ? RELATION_RULES.TRUST_ORDER_OBEYED : RELATION_RULES.TRUST_ORDER_IGNORED;
      teammate += order.obeyed ? 4 : -10;
    } else if (order.favouredDriverId === player.id) {
      teammate += order.obeyed ? -2 : -8;
      if (!order.obeyed && mate) rivalries[mate.id] = Math.min(100, (rivalries[mate.id] ?? 0) + 10);
    }
  }
  if (mate && entry?.status === 'finished') {
    const mateEntry = record.race.entries.find((e) => e.driverId === mate.id);
    // O primeiro piloto não gosta de ser batido pelo segundo.
    if (mateEntry?.status === 'finished' && player.role === 'second' && entry.position < mateEntry.position) teammate -= 2;
  }
  teammate += (55 - teammate) * 0.05;
  for (const e of record.race.events) {
    if (!e.otherDriverId || (e.type !== 'collision' && e.type !== 'dnf')) continue;
    const other = e.driverId === player.id ? e.otherDriverId : e.otherDriverId === player.id ? e.driverId : null;
    if (other) rivalries[other] = Math.min(100, (rivalries[other] ?? 0) + (e.type === 'dnf' ? RELATION_RULES.RIVALRY_DNF : RELATION_RULES.RIVALRY_COLLISION));
  }
  const standings = computeDriverStandings(career.rounds, career.drivers, career.adjustments);
  const me = standings.find((s) => s.driverId === player.id);
  if (me && round >= 3) {
    for (const neighbour of [standings[me.position - 2], standings[me.position]]) {
      if (neighbour && neighbour.driverId !== player.id && Math.abs(neighbour.points - me.points) <= 10) {
        rivalries[neighbour.driverId] = Math.min(100, (rivalries[neighbour.driverId] ?? 0) + RELATION_RULES.RIVALRY_STANDINGS);
      }
    }
  }
  career = { ...career, relations: { teamTrust: clamp(teamTrust), teammate: clamp(teammate), rivalries } };

  /* 5. Patrocinadores */
  const position = me?.position ?? standings.length;
  const charisma = sponsorSatisfactionBonus(career);
  const kept = [];
  for (const sponsor of career.sponsors) {
    const satisfaction = satisfactionAfterRound(sponsor, position, entry, charisma);
    if (sponsor.tier > 0 && satisfaction < SPONSOR_RULES.LEAVE_THRESHOLD) {
      msg(
        `sponsor-left-${sponsor.id}`,
        'finance',
        `${sponsor.name} rompe o contrato`,
        `Insatisfeito com os resultados, o patrocinador ${sponsor.name} encerrou o contrato. Você deixa de receber ${money(career, sponsor.perSeason)} por temporada.`,
      );
    } else {
      kept.push({ ...sponsor, satisfaction });
    }
  }
  career = { ...career, sponsors: kept };

  /* 6. Evolução */
  const multiplier = INTENSITY_GAIN[career.trainingIntensity] * (career.academy ? 1.1 : 1) * birthTrainingFactor(career);
  const developed = developAfterRound(career.drivers, career.seed, season, round, multiplier);
  career = { ...career, drivers: developed.drivers };

  /* 7. Mercado */
  career = { ...career, marketInterest: updateMarketInterest(career) };

  /* 9. Mensagens da etapa (antes dos eventos, para ficarem abaixo deles) */
  const track = getTrack(record.trackId);
  const winner = career.drivers.find((d) => d.id === record.race.entries[0]?.driverId);
  if (entry) {
    const result =
      entry.status === 'finished'
        ? `Você terminou em ${entry.position}º, largando de ${entry.grid}º, e somou ${counted(entry.points, 'ponto', 'pontos')}.${entry.penaltySeconds > 0 ? ` Punições: ${entry.penaltySeconds}s.` : ''}`
        : `Você abandonou (${DNF_LABELS[entry.dnfReason ?? 'crash'].toLowerCase()}) depois de largar em ${entry.grid}º.`;
    msg(
      'race',
      'race',
      `Etapa ${round}: ${track.name}`,
      `${result} Vencedor: ${winner ? fullName(winner) : '-'}. No campeonato, você é o ${me?.position ?? '-'}º, com ${counted(me?.points ?? 0, 'ponto', 'pontos')}.`,
    );
    let reaction: string;
    if (entry.status === 'dnf' && (entry.dnfReason === 'crash' || entry.dnfReason === 'fuel'))
      reaction = 'O chefe de equipe lembra que só pontua quem termina a corrida. Erros assim custam confiança.';
    else if (entry.status === 'dnf')
      reaction =
        entry.dnfReason === 'mechanical'
          ? 'A equipe assume a culpa pela quebra e promete revisar tudo antes da próxima etapa.'
          : 'A equipe lamenta o abandono e analisa o incidente.';
    else if (entry.position <= Math.max(1, team.driverTarget - 2))
      reaction = `A equipe está empolgada: um resultado acima do que o ${category.machine} costuma entregar.`;
    else if (entry.position <= team.driverTarget) reaction = 'Um resultado sólido, dentro do que a equipe espera.';
    else reaction = `A equipe esperava mais. A meta é terminar a temporada entre os ${team.driverTarget} primeiros.`;
    msg('team', 'team', `${team.name}: avaliação da etapa`, `${reaction} Confiança da equipe em você: ${Math.round(career.relations.teamTrust)}/100.`);
  } else {
    msg(
      'race',
      'race',
      `Etapa ${round}: ${track.name}`,
      `Você não disputou esta etapa. Vencedor: ${winner ? fullName(winner) : '-'}. No campeonato, você é o ${me?.position ?? '-'}º.`,
    );
  }
  const delta = developed.deltas[player.id];
  if (delta) {
    const summary = formatDelta(delta);
    msg(
      'training',
      'training',
      `Relatório de evolução (${TRAINING_FOCUS_LABELS[player.trainingFocus]})`,
      summary ? `Evolução após a etapa: ${summary}.` : 'Você está perto do seu potencial nos atributos treinados; os ganhos foram mínimos.',
    );
  }
  career = { ...career, inbox: pushMessages(career.inbox, messages) };
  // Nascimento: os traços ocultos que esta etapa mostrou.
  career = revealTraits(career, record);

  /* 8. Eventos */
  const events = generateEvents(career, record, round);
  if (events.length > 0) career = { ...career, pendingEvents: [...career.pendingEvents, ...events] };
  const move = moveEventFor(career, round);
  if (move) career = { ...career, pendingEvents: [...career.pendingEvents, move] };
  return career;
}
