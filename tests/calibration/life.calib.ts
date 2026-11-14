/**
 * Relatório de vidas inteiras (não é teste de regressão): piloto, dirigente,
 * família e sucessão, por várias gerações. Execute com `npm run calibrate`.
 */
import { test } from 'vitest';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { CareerStateSchema } from '@/domain/schemas';
import { getCategory, getPlayer, netWorth, overallRating } from '../engineApi';
import { botCareer, playLifeSeason } from '../helpers';

test('relatório de vidas', () => {
  for (const [seed, talent, buyTeam] of [[1, 8, true], [2, 4, false], [3, 8, true], [4, 0, true]] as const) {
    let c = botCareer(seed, talent);
    const lines: string[] = [];
    const start = c.season;
    let guard = 0;
    while (c.season < start + 70 && guard++ < 400) {
      const before = c;
      c = playLifeSeason(c, { retireAge: 36, buyTeam, choices: { approach: 'attack' } }, (end) => {
        const p = getPlayer(end);
        const cat = getCategory(end.categoryId).shortName.replace('Kart ', 'K').slice(0, 4);
        const kids = end.family.children.map((k) => `${k.firstName[0]}${k.age}${k.stage === 'racing' && k.racing ? `:${getCategory(k.racing.categoryId).shortName.replace('Kart ', 'K').slice(0, 3)}${k.racing.seasons[k.racing.seasons.length - 1]?.position ?? ''}` : k.stage[0]}`).join(',');
        const m = end.management;
        const what = end.mode === 'driver' ? `${cat}${end.offseason?.playerPosition ?? '?'}(${Math.round(overallRating(p.attributes))})` : m ? `${m.position === 'owner' ? 'DONO' : 'CHEFE'}:${cat}${end.executiveOffseason?.teamPosition ?? '?'}/${end.executiveOffseason?.target ?? '?'} cx${Math.round(m.budget / 1000)}k rep${m.reputation}` : `fora:${cat}`;
        lines.push(`g${end.dynasty.generation} ${p.age}a ${what} pat${Math.round(netWorth(end.finance) / 1000)}k rep${Math.round(end.reputation)}${end.family.partner ? ` par${end.family.partner.relationship}${end.family.partner.married ? 'c' : ''}` : ''}${kids ? ` [${kids}]` : ''}${end.succession ? ` †${end.succession.cause}` : ''}`);
      });
      const problems = validateCareerIntegrity(c);
      const parsed = CareerStateSchema.safeParse(c);
      if (problems.length || !parsed.success) {
        console.log(lines.join('\n'));
        throw new Error(`Estado inválido (semente ${seed}, temporada ${before.season}): ${problems.join('; ')} ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))}`);
      }
    }
    console.log(`\n=== semente ${seed}, talento ${talent} ===\n${lines.join('\n')}`);
  }
}, 1_800_000);
