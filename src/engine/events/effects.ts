/**
 * Aplicação dos efeitos de um evento ao estado da carreira.
 *
 * Os efeitos são dados simples, guardados junto com o evento no save. Este é
 * o único lugar em que eles alteram o jogo, o que torna cada evento auditável
 * e testável.
 */
import type { CareerState, Effect } from '@/domain/schemas';
import { DEV_AREAS } from '@/domain/schemas';
import { FAMILY } from '@/data/family';
import { netWorth, post } from '../career/economy';
import { getPlayer } from '../career/selectors';
import { setKartFunding, startChildCareer } from '../dynasty/family';

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

export function applyEffect(career: CareerState, effect: Effect, round: number): CareerState {
  const player = getPlayer(career);
  const updatePlayer = (patch: Partial<typeof player>): CareerState => ({
    ...career,
    drivers: career.drivers.map((d) => (d.id === player.id ? { ...d, ...patch } : d)),
  });

  switch (effect.type) {
    case 'stat': {
      if (effect.stat === 'reputation') return { ...career, reputation: clamp(career.reputation + effect.value) };
      if (effect.stat === 'teamTrust') return { ...career, relations: { ...career.relations, teamTrust: clamp(career.relations.teamTrust + effect.value) } };
      if (effect.stat === 'teammateRelation')
        return { ...career, relations: { ...career.relations, teammate: clamp(career.relations.teammate + effect.value) } };
      return updatePlayer({ condition: { ...player.condition, [effect.stat]: clamp(player.condition[effect.stat] + effect.value) } });
    }
    case 'cash':
      return { ...career, finance: post(career.finance, career.season, round, effect.ledger, effect.value, effect.label) };
    case 'rivalry': {
      const value = Math.min(100, Math.max(0, (career.relations.rivalries[effect.driverId] ?? 0) + effect.value));
      const rivalries = { ...career.relations.rivalries };
      if (value <= 0) delete rivalries[effect.driverId];
      else rivalries[effect.driverId] = value;
      return { ...career, relations: { ...career.relations, rivalries } };
    }
    case 'sponsorSatisfaction':
      return {
        ...career,
        sponsors: career.sponsors.map((s) =>
          s.tier > 0 && (effect.sponsorId === null || s.id === effect.sponsorId) ? { ...s, satisfaction: clamp(s.satisfaction + effect.value) } : s,
        ),
      };
    case 'addSponsor':
      return career.sponsors.some((s) => s.id === effect.sponsor.id) ? career : { ...career, sponsors: [...career.sponsors, effect.sponsor] };
    case 'removeSponsor':
      return { ...career, sponsors: career.sponsors.filter((s) => s.id !== effect.sponsorId) };
    case 'penaltyPoints':
      return { ...career, license: { ...career.license, penaltyPoints: Math.max(0, career.license.penaltyPoints + effect.value) } };
    case 'gridPenalty':
      return { ...career, gridPenalties: { ...career.gridPenalties, [effect.driverId]: (career.gridPenalties[effect.driverId] ?? 0) + effect.places } };
    case 'pointsAdjustment': {
      const teamId = career.drivers.find((d) => d.id === effect.driverId)?.teamId ?? null;
      return { ...career, adjustments: [...career.adjustments, { driverId: effect.driverId, teamId, points: effect.points, reason: effect.reason, round }] };
    }
    case 'interest':
      return { ...career, marketInterest: { ...career.marketInterest, [effect.teamKey]: clamp((career.marketInterest[effect.teamKey] ?? 0) + effect.value) } };
    case 'joinAcademy':
      return { ...career, academy: effect.academy };
    case 'leaveAcademy':
      return { ...career, academy: null };
    case 'attribute':
      return updatePlayer({
        attributes: { ...player.attributes, [effect.key]: Math.round(Math.min(100, Math.max(0, player.attributes[effect.key] + effect.value)) * 100) / 100 },
      });
    case 'injury':
      return updatePlayer({ injury: effect.injury });
    case 'carUpgrade': {
      const bump = (v: number) => Math.min(99, Math.max(40, Math.round((v + effect.value) * 10) / 10));
      return {
        ...career,
        teams: career.teams.map((t) => (t.id === player.teamId ? { ...t, car: { ...t.car, engine: bump(t.car.engine), chassis: bump(t.car.chassis) } } : t)),
      };
    }
    case 'seatCost':
      return { ...career, contract: { ...career.contract, seatCost: Math.max(0, Math.round(career.contract.seatCost + effect.value)) } };
    case 'releaseFee':
      return {
        ...career,
        contract: { ...career.contract, clauses: { ...career.contract.clauses, releaseFee: Math.round(career.contract.clauses.releaseFee * effect.factor) } },
      };

    /* ---------------- Família ---------------- */
    case 'partner':
      return career.family.partner ? career : { ...career, family: { ...career.family, partner: effect.partner } };
    case 'relationship': {
      const partner = career.family.partner;
      return partner ? { ...career, family: { ...career.family, partner: { ...partner, relationship: clamp(partner.relationship + effect.value) } } } : career;
    }
    case 'marry': {
      const partner = career.family.partner;
      return partner ? { ...career, family: { ...career.family, partner: { ...partner, married: true } } } : career;
    }
    case 'child':
      return career.family.children.some((c) => c.id === effect.child.id)
        ? career
        : { ...career, family: { ...career.family, children: [...career.family.children, effect.child] } };
    case 'divorce': {
      if (!career.family.partner) return career;
      // O ex-cônjuge fica com uma parte do patrimônio líquido, paga em dinheiro.
      const settlement = Math.max(0, netWorth(career.finance)) * effect.share;
      return {
        ...career,
        finance: post(career.finance, career.season, round, 'family', -settlement, 'Partilha do divórcio'),
        family: { partner: null, divorces: career.family.divorces + 1, children: career.family.children.map((c) => ({ ...c, bond: clamp(c.bond - 5) })) },
      };
    }
    case 'childStat': {
      const children = career.family.children.map((c) => {
        if (c.id !== effect.childId) return c;
        const next = { ...c, [effect.stat]: clamp(c[effect.stat] + effect.value) };
        // Sem vontade de correr na idade de começar, segue outro caminho.
        const givesUp = (next.stage === 'child' || next.stage === 'karting') && next.age >= FAMILY.CAREER_START_AGE && next.interest < FAMILY.CAREER_INTEREST;
        return givesUp ? { ...next, stage: 'other' as const } : next;
      });
      return { ...career, family: { ...career.family, children } };
    }
    case 'childKart':
      return career.family.children.some((c) => c.id === effect.childId && (c.stage === 'child' || c.stage === 'karting'))
        ? setKartFunding(career, effect.childId, effect.funding)
        : career;
    case 'childCareer':
      return startChildCareer(career, effect.childId, effect.support);

    /* ---------------- Gestão de equipe ---------------- */
    case 'teamBudget': {
      const m = career.management;
      return m
        ? {
            ...career,
            management: { ...m, budget: Math.round(m.budget + effect.value), ledger: { ...m.ledger, event: (m.ledger.event ?? 0) + Math.round(effect.value) } },
          }
        : career;
    }
    case 'teamReputation': {
      const m = career.management;
      return m ? { ...career, management: { ...m, reputation: clamp(m.reputation + effect.value) } } : career;
    }
    case 'devProgress': {
      const m = career.management;
      if (!m) return career;
      const progress = { ...m.development.progress };
      for (const area of DEV_AREAS) {
        if (effect.area === null ? m.development.allocation[area] > 0 : effect.area === area) progress[area] = Math.max(0, progress[area] + effect.value);
      }
      return { ...career, management: { ...m, development: { ...m.development, progress } } };
    }
    case 'staffRating': {
      const m = career.management;
      return m
        ? { ...career, management: { ...m, staff: m.staff.map((x) => (x.role === effect.role ? { ...x, rating: clamp(x.rating + effect.value) } : x)) } }
        : career;
    }
    case 'lineupCondition': {
      const m = career.management;
      if (!m) return career;
      return {
        ...career,
        drivers: career.drivers.map((d) =>
          d.teamId === m.teamId ? { ...d, condition: { ...d.condition, [effect.stat]: clamp(d.condition[effect.stat] + effect.value) } } : d,
        ),
      };
    }
  }
}

export function applyEffects(career: CareerState, effects: readonly Effect[], round: number): CareerState {
  return effects.reduce((state, effect) => applyEffect(state, effect, round), career);
}
