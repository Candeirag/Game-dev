/**
 * Pilotos que acompanham a carreira (Fase 5): o rival do kart que uma cadeia marcou com `follow`
 * entra no grid da categoria nova quando o jogador sobe, no mesmo molde dos rivais que sobem
 * junto (`promotedRivals`). Se ele ainda está no grid atual, vem como está; se sumiu (subiu antes
 * ou mudou de campeonato), volta com o mesmo id, o nome e a nacionalidade de quando o jogador o
 * conheceu, com o nível de um piloto do meio do grid da categoria nova.
 */
import { STORY_EVENTS } from '@/config/balance';
import type { CareerState, Driver } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { fullName } from '../career/selectors';
import { hashSeed } from '../rng';
import { generateDriver } from '../world/generation';
import { storyOf } from './memory';

export function storyFollowers(
  career: CareerState,
  next: CategoryDefinition,
  nextSeason: number,
  exclude: ReadonlySet<string>,
  usedNames: Set<string>,
): Driver[] {
  const out: Driver[] = [];
  for (const person of storyOf(career).people) {
    if (!person.follows || !person.driverId || exclude.has(person.driverId)) continue;
    const current = career.drivers.find((d) => d.id === person.driverId && !d.isPlayer);
    if (current) {
      if (current.age + 1 > next.field.maxAge) continue;
      out.push(current);
      continue;
    }
    const age = (person.age ?? next.field.minAge) + (nextSeason - person.metSeason);
    if (age > next.field.maxAge || age < next.field.minAge) continue;
    const name = `${person.firstName} ${person.lastName}`;
    usedNames.add(name);
    const fresh = generateDriver({
      id: person.driverId,
      seed: hashSeed(career.seed, 'story-follow', person.driverId, nextSeason),
      category: next,
      teamRank: STORY_EVENTS.FOLLOWER_TEAM_RANK,
      teamId: null,
      role: 'second',
      season: nextSeason,
      usedNames: new Set(usedNames),
    });
    out.push({ ...fresh, firstName: person.firstName, lastName: person.lastName, nationality: person.nationality ?? fresh.nationality, age: age - 1 });
  }
  return out.filter((d, i) => out.findIndex((x) => x.id === d.id) === i && fullName(d) !== '');
}
