/**
 * O efeito mostrado depois da escolha (Fase 5): cada efeito aplicado vira uma linha que a tela
 * desenha com ícone, rótulo, seta e sinal. O valor é o que de fato mudou, lido da carreira antes e
 * depois: um indicador que já estava no teto não "sobe 6", uma rivalidade já zerada não "cai 8", e
 * o caixa é a diferença do saldo (inclui a partilha de um divórcio ou o gasto de um evento de
 * família). Os efeitos de família e de gestão viram notas em palavras, com valor quando há um.
 */
import type { CareerState, Effect } from '@/domain/schemas';
import { STAFF_ROLE_LABELS } from '@/domain/labels';
import { fullName } from '../career/selectors';
import { storyOf } from './memory';

export type StoryEffectView =
  | { kind: 'stat'; stat: 'morale' | 'confidence' | 'form' | 'reputation' | 'teamTrust' | 'teammateRelation'; value: number }
  | { kind: 'cash'; value: number }
  | { kind: 'rivalry'; name: string; value: number }
  | { kind: 'sponsorMood'; name: string | null; value: number }
  | { kind: 'sponsorAdded'; name: string; perSeason: number; target: number }
  | { kind: 'sponsorRemoved'; name: string }
  | { kind: 'grid'; name: string | null; places: number }
  | { kind: 'penaltyPoints'; value: number }
  | { kind: 'points'; value: number }
  | { kind: 'interest'; team: string; value: number }
  | { kind: 'attribute'; attribute: string; value: number }
  | { kind: 'injury'; description: string; rounds: number; serious: boolean }
  | { kind: 'car'; value: number }
  | { kind: 'seatCost'; value: number }
  /** Multa rescisória: quanto o valor mudou, em dinheiro. */
  | { kind: 'releaseFee'; value: number }
  | { kind: 'relationship'; value: number }
  | { kind: 'academy'; name: string }
  | { kind: 'remember'; name: string; role: string }
  | { kind: 'attitude'; name: string; value: number }
  | { kind: 'follows'; name: string }
  | { kind: 'joinsTeam'; name: string; team: string }
  | { kind: 'chain'; ends: boolean }
  /**
   * Família, gestão de equipe, academia e mudança: uma nota em palavras, com o valor quando há um
   * (`money`: o valor é dinheiro). `topic` escolhe o ícone.
   */
  | { kind: 'note'; topic: 'family' | 'team' | 'move' | 'academy'; text: string; value?: number; money?: boolean };

type StatKey = Extract<StoryEffectView, { kind: 'stat' }>['stat'];

function statOf(c: CareerState, stat: StatKey): number {
  if (stat === 'reputation') return c.reputation;
  if (stat === 'teamTrust') return c.relations.teamTrust;
  if (stat === 'teammateRelation') return c.relations.teammate;
  const player = c.drivers.find((d) => d.id === c.playerDriverId);
  return player?.condition[stat] ?? 0;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Variação média da satisfação dos patrocinadores comerciais presentes antes e depois. */
function sponsorMoodChange(before: CareerState, after: CareerState, sponsorId: string | null): number {
  const pairs = before.sponsors
    .filter((s) => s.tier > 0 && (sponsorId === null || s.id === sponsorId))
    .flatMap((s) => {
      const now = after.sponsors.find((x) => x.id === s.id);
      return now ? [now.satisfaction - s.satisfaction] : [];
    });
  return pairs.length > 0 ? round1(pairs.reduce((sum, v) => sum + v, 0) / pairs.length) : 0;
}

const kartFundingText: Record<string, string> = { full: 'programa completo de kart', basic: 'kart de fim de semana', none: 'sem kart por enquanto' };
const careerSupportText: Record<string, string> = {
  full: 'carreira bancada pela família',
  basic: 'metade da vaga paga pela família',
  none: 'carreira por conta própria',
};

/** Linhas de efeito de um desfecho já aplicado (`before` e `after` são a carreira antes e depois). */
export function describeEffects(before: CareerState, after: CareerState, effects: readonly Effect[]): StoryEffectView[] {
  const views: StoryEffectView[] = [];
  const nameOf = (id: string) => {
    const d = before.drivers.find((x) => x.id === id) ?? after.drivers.find((x) => x.id === id);
    return d ? fullName(d) : null;
  };
  const teamOf = (key: string) => {
    const id = key.split(':')[1] ?? key;
    return before.teams.find((t) => t.id === id)?.name ?? after.teams.find((t) => t.id === id)?.name ?? null;
  };
  const childName = (id: string) =>
    (after.family.children.find((c) => c.id === id) ?? before.family.children.find((c) => c.id === id))?.firstName ?? 'O seu filho';
  const personName = (key: string) => {
    const p = storyOf(after).people.find((x) => x.key === key) ?? storyOf(before).people.find((x) => x.key === key);
    return p ? `${p.firstName} ${p.lastName}` : null;
  };
  const done = new Set<string>();
  const once = (key: string) => {
    if (done.has(key)) return false;
    done.add(key);
    return true;
  };
  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        if (!once(`stat:${e.stat}`)) break;
        const value = round1(statOf(after, e.stat) - statOf(before, e.stat));
        if (value !== 0) views.push({ kind: 'stat', stat: e.stat, value });
        break;
      }
      case 'rivalry': {
        const name = nameOf(e.driverId);
        if (!name || !once(`rivalry:${e.driverId}`)) break;
        const value = round1((after.relations.rivalries[e.driverId] ?? 0) - (before.relations.rivalries[e.driverId] ?? 0));
        if (value !== 0) views.push({ kind: 'rivalry', name, value });
        break;
      }
      case 'sponsorSatisfaction': {
        if (!once(`mood:${e.sponsorId ?? 'all'}`)) break;
        const value = sponsorMoodChange(before, after, e.sponsorId);
        const name = e.sponsorId ? (before.sponsors.find((s) => s.id === e.sponsorId)?.name ?? null) : null;
        if (value !== 0) views.push({ kind: 'sponsorMood', name, value });
        break;
      }
      case 'addSponsor':
        if (after.sponsors.some((s) => s.id === e.sponsor.id) && !before.sponsors.some((s) => s.id === e.sponsor.id))
          views.push({ kind: 'sponsorAdded', name: e.sponsor.name, perSeason: e.sponsor.perSeason, target: e.sponsor.targetPosition });
        break;
      case 'removeSponsor': {
        const s = before.sponsors.find((x) => x.id === e.sponsorId);
        if (s && !after.sponsors.some((x) => x.id === e.sponsorId)) views.push({ kind: 'sponsorRemoved', name: s.name });
        break;
      }
      case 'gridPenalty':
        views.push({ kind: 'grid', name: e.driverId === before.playerDriverId ? null : nameOf(e.driverId), places: e.places });
        break;
      case 'penaltyPoints': {
        const value = after.license.penaltyPoints - before.license.penaltyPoints;
        if (value !== 0) views.push({ kind: 'penaltyPoints', value });
        break;
      }
      case 'pointsAdjustment':
        if (e.driverId === before.playerDriverId) views.push({ kind: 'points', value: e.points });
        break;
      case 'interest': {
        const team = teamOf(e.teamKey);
        if (!team || !once(`interest:${e.teamKey}`)) break;
        const value = round1((after.marketInterest[e.teamKey] ?? 0) - (before.marketInterest[e.teamKey] ?? 0));
        if (value !== 0) views.push({ kind: 'interest', team, value });
        break;
      }
      case 'attribute':
        views.push({ kind: 'attribute', attribute: e.key, value: e.value });
        break;
      case 'injury':
        views.push({ kind: 'injury', description: e.injury.description, rounds: e.injury.roundsRemaining, serious: e.injury.severity === 'serious' });
        break;
      case 'carUpgrade':
        views.push({ kind: 'car', value: e.value });
        break;
      case 'seatCost': {
        const value = Math.round(after.contract.seatCost - before.contract.seatCost);
        if (value !== 0) views.push({ kind: 'seatCost', value });
        break;
      }
      case 'releaseFee': {
        const value = Math.round(after.contract.clauses.releaseFee - before.contract.clauses.releaseFee);
        if (value !== 0) views.push({ kind: 'releaseFee', value });
        break;
      }
      case 'relationship': {
        const value = round1((after.family.partner?.relationship ?? 0) - (before.family.partner?.relationship ?? 0));
        if (value !== 0 && after.family.partner) views.push({ kind: 'relationship', value });
        break;
      }
      case 'joinAcademy':
        if (after.academy && !before.academy) views.push({ kind: 'academy', name: e.academy.name });
        break;
      case 'leaveAcademy':
        if (before.academy && !after.academy) views.push({ kind: 'note', topic: 'academy', text: `Você deixou a ${before.academy.name}` });
        break;
      case 'storyPerson':
        if (!storyOf(before).people.some((p) => p.key === e.person.key))
          views.push({ kind: 'remember', name: `${e.person.firstName} ${e.person.lastName}`, role: e.person.role });
        break;
      case 'storyAttitude': {
        const name = personName(e.key);
        const was = storyOf(before).people.find((p) => p.key === e.key)?.attitude;
        const now = storyOf(after).people.find((p) => p.key === e.key)?.attitude;
        // Pessoa que acaba de entrar na memória: a linha "vai se lembrar disso" já diz o essencial.
        if (name && was !== undefined && now !== undefined && now !== was) views.push({ kind: 'attitude', name, value: now - was });
        break;
      }
      case 'storyFollow': {
        const name = personName(e.key);
        if (name && e.follow) views.push({ kind: 'follows', name });
        break;
      }
      case 'storyJoinTeam': {
        const name = personName(e.key);
        if (name) views.push({ kind: 'joinsTeam', name, team: e.org });
        break;
      }
      case 'storyChain':
        if (once('chain')) views.push({ kind: 'chain', ends: e.next === null });
        break;
      /* ---------------- Família ---------------- */
      case 'partner':
        if (!before.family.partner && after.family.partner)
          views.push({ kind: 'note', topic: 'family', text: `Começa um relacionamento com ${after.family.partner.firstName}` });
        break;
      case 'marry':
        if (after.family.partner?.married && !before.family.partner?.married)
          views.push({ kind: 'note', topic: 'family', text: `Casamento com ${after.family.partner.firstName}` });
        break;
      case 'divorce':
        if (before.family.partner && !after.family.partner)
          views.push({ kind: 'note', topic: 'family', text: `Fim do relacionamento com ${before.family.partner.firstName}` });
        break;
      case 'child':
        views.push({ kind: 'note', topic: 'family', text: `Nasce ${e.child.firstName} ${e.child.lastName}` });
        break;
      case 'childStat':
        views.push({
          kind: 'note',
          topic: 'family',
          text: `${childName(e.childId)}: ${e.stat === 'bond' ? 'vínculo com você' : 'vontade de correr'}`,
          value: e.value,
        });
        break;
      case 'childKart':
        views.push({ kind: 'note', topic: 'family', text: `${childName(e.childId)}: ${kartFundingText[e.funding] ?? 'kart'}` });
        break;
      case 'childCareer':
        views.push({ kind: 'note', topic: 'family', text: `${childName(e.childId)} estreia no kart regional: ${careerSupportText[e.support] ?? 'carreira'}` });
        break;
      case 'relocate':
        if (after.birth?.movedSeason !== before.birth?.movedSeason)
          views.push({ kind: 'note', topic: 'move', text: 'Mudança para São Paulo: acabam as viagens do interior' });
        break;
      /* ---------------- Gestão de equipe ---------------- */
      case 'teamBudget':
        views.push({ kind: 'note', topic: 'team', text: 'Caixa da equipe', value: Math.round(e.value), money: true });
        break;
      case 'teamReputation':
        views.push({ kind: 'note', topic: 'team', text: 'Reputação da equipe', value: e.value });
        break;
      case 'devProgress':
        views.push({ kind: 'note', topic: 'team', text: 'Andamento da pesquisa', value: e.value });
        break;
      case 'staffRating':
        views.push({ kind: 'note', topic: 'team', text: `Equipe técnica: ${STAFF_ROLE_LABELS[e.role].toLowerCase()}`, value: e.value });
        break;
      case 'lineupCondition':
        views.push({
          kind: 'note',
          topic: 'team',
          text: e.stat === 'morale' ? 'Moral dos pilotos da equipe' : 'Confiança dos pilotos da equipe',
          value: e.value,
        });
        break;
      default:
        break;
    }
  }
  const cash = Math.round(after.finance.cash - before.finance.cash);
  if (cash !== 0) views.unshift({ kind: 'cash', value: cash });
  return views;
}
