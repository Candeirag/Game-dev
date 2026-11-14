/**
 * Teste de estresse (não é teste de regressão): vidas com políticas variadas
 * e eventos forçados (aposentadoria no meio do ano, acidentes fatais) e
 * passagens de comando em vida, conferindo schema, integridade e ida e volta do save a cada
 * passo. Serve para caçar estados inválidos em caminhos raros.
 */
import { test } from 'vitest';
import { CareerStateSchema, type CareerState } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import * as engine from '../engineApi';
import { NOW, botCareer, playLifeSeason, playRound, resolvePending, type LifePolicy } from '../helpers';

/** Caminho do primeiro valor diferente entre dois objetos (null se forem iguais). */
function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
    return `${path}: ${String(a)} ≠ ${String(b)}${Object.is(a, -0) ? ' (zero negativo)' : ''}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av === undefined && bv === undefined) continue;
    const d = firstDifference(av, bv, `${path}.${key}`);
    if (d) return d;
  }
  return null;
}

function check(c: CareerState, where: string) {
  const parsed = CareerStateSchema.safeParse(c);
  const problems = validateCareerIntegrity(c);
  if (!parsed.success || problems.length)
    throw new Error(`${where}: ${problems.slice(0, 4).join('; ')} ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 2))}`);
}

test('estresse: políticas variadas e eventos forçados', () => {
  const policies: LifePolicy[] = [
    { retireAge: 36, heir: 'driver', buyTeam: true },
    { retireAge: 24, heir: 'executive', buyTeam: true, handoverAge: 44, choices: { eventChoice: 1 } },
    { retireAge: 30, heir: 'executive', buyTeam: false, choices: { eventChoice: 2, approach: 'attack' } },
    { retireAge: 19, heir: 'driver', buyTeam: true, handoverAge: 50, choices: { eventChoice: 3 } },
  ];
  let steps = 0;
  for (let seed = 101; seed <= 112; seed++) {
    const policy = policies[seed % policies.length]!;
    let c = botCareer(seed, (seed % 3) * 4);
    let guard = 0;
    const start = c.season;
    while (c.season < start + 45 && guard++ < 250) {
      const where = `semente ${seed}, temporada ${c.season}, modo ${c.mode}`;
      // Eventos forçados, em momentos diferentes para cada semente.
      if (c.mode === 'driver' && !c.succession && c.season === 4 + (seed % 5) && c.nextRoundIndex === 0) {
        for (let i = 0; i < 3; i++) c = playRound(c, policy.choices);
        c = seed % 2 === 0 ? engine.retireFromDriving(resolvePending(c)) : engine.beginSuccession(resolvePending(c), 'accident');
        check(c, `${where} (evento forçado)`);
      }
      c = playLifeSeason(c, policy);
      check(c, where);
      if (guard % 7 === 0) {
        const loaded = importCareer(exportCareer(c, NOW));
        const diff = firstDifference(c, loaded);
        if (diff) throw new Error(`${where}: o save não voltou igual em ${diff}`);
      }
      steps++;
    }
    console.log(
      `semente ${seed}: ${c.season - start} temporadas, ${c.dynasty.generation}ª geração, modo ${c.mode}${c.management ? ` (${c.management.position})` : ''}`,
    );
  }
  console.log(`passos conferidos: ${steps}`);
}, 3_600_000);
