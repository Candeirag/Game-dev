/**
 * O efeito mostrado depois da escolha (Fase 5): cada efeito aplicado vira uma linha que a tela
 * desenha com ícone, rótulo, seta e sinal. O valor é o que de fato mudou (um indicador que já
 * estava no teto não "sobe 6"), lido da carreira antes e depois.
 */
import type { CareerState, Effect } from '@/domain/schemas';
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
  | { kind: 'releaseFee'; factor: number }
  | { kind: 'relationship'; value: number }
  | { kind: 'academy'; name: string }
  | { kind: 'remember'; name: string; role: string }
  | { kind: 'attitude'; name: string; value: number }
  | { kind: 'follows'; name: string }
  | { kind: 'joinsTeam'; name: string; team: string }
  | { kind: 'chain'; ends: boolean };

function statOf(c: CareerState, stat: Extract<StoryEffectView, { kind: 'stat' }>['stat']): number {
  if (stat === 'reputation') return c.reputation;
  if (stat === 'teamTrust') return c.relations.teamTrust;
  if (stat === 'teammateRelation') return c.relations.teammate;
  const player = c.drivers.find((d) => d.id === c.playerDriverId);
  return player?.condition[stat] ?? 0;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

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
  const statsDone = new Set<string>();
  let cash = 0;
  let cashSeen = false;
  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        if (statsDone.has(e.stat)) break;
        statsDone.add(e.stat);
        const value = round1(statOf(after, e.stat) - statOf(before, e.stat));
        if (value !== 0) views.push({ kind: 'stat', stat: e.stat, value });
        break;
      }
      case 'cash':
        cashSeen = true;
        break;
      case 'rivalry': {
        const name = nameOf(e.driverId);
        if (name) views.push({ kind: 'rivalry', name, value: e.value });
        break;
      }
      case 'sponsorSatisfaction':
        views.push({ kind: 'sponsorMood', name: e.sponsorId ? (before.sponsors.find((s) => s.id === e.sponsorId)?.name ?? null) : null, value: e.value });
        break;
      case 'addSponsor':
        if (after.sponsors.some((s) => s.id === e.sponsor.id))
          views.push({ kind: 'sponsorAdded', name: e.sponsor.name, perSeason: e.sponsor.perSeason, target: e.sponsor.targetPosition });
        break;
      case 'removeSponsor': {
        const s = before.sponsors.find((x) => x.id === e.sponsorId);
        if (s) views.push({ kind: 'sponsorRemoved', name: s.name });
        break;
      }
      case 'gridPenalty':
        views.push({ kind: 'grid', name: e.driverId === before.playerDriverId ? null : nameOf(e.driverId), places: e.places });
        break;
      case 'penaltyPoints':
        views.push({ kind: 'penaltyPoints', value: e.value });
        break;
      case 'pointsAdjustment':
        if (e.driverId === before.playerDriverId) views.push({ kind: 'points', value: e.points });
        break;
      case 'interest': {
        const team = teamOf(e.teamKey);
        if (team) views.push({ kind: 'interest', team, value: e.value });
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
      case 'seatCost':
        views.push({ kind: 'seatCost', value: Math.round(e.value) });
        break;
      case 'releaseFee':
        views.push({ kind: 'releaseFee', factor: e.factor });
        break;
      case 'relationship':
        views.push({ kind: 'relationship', value: e.value });
        break;
      case 'joinAcademy':
        if (after.academy) views.push({ kind: 'academy', name: e.academy.name });
        break;
      case 'storyPerson':
        if (!storyOf(before).people.some((p) => p.key === e.person.key))
          views.push({ kind: 'remember', name: `${e.person.firstName} ${e.person.lastName}`, role: e.person.role });
        break;
      case 'storyAttitude': {
        const person = storyOf(after).people.find((p) => p.key === e.key);
        if (person) views.push({ kind: 'attitude', name: `${person.firstName} ${person.lastName}`, value: e.value });
        break;
      }
      case 'storyFollow': {
        const person = storyOf(after).people.find((p) => p.key === e.key);
        if (person && e.follow) views.push({ kind: 'follows', name: `${person.firstName} ${person.lastName}` });
        break;
      }
      case 'storyJoinTeam': {
        const person = storyOf(after).people.find((p) => p.key === e.key);
        if (person) views.push({ kind: 'joinsTeam', name: `${person.firstName} ${person.lastName}`, team: e.org });
        break;
      }
      case 'storyChain':
        views.push({ kind: 'chain', ends: e.next === null });
        break;
      default:
        break;
    }
  }
  if (cashSeen) {
    cash = Math.round(after.finance.cash - before.finance.cash);
    if (cash !== 0) views.unshift({ kind: 'cash', value: cash });
  }
  return views;
}
