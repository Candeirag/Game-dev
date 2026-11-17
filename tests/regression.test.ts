/**
 * Testes que travam o comportamento do jogo a partir da reformulação visual:
 * a simulação com semente fixa tem de dar os números gravados, e os saves gravados por
 * versões anteriores e pela atual têm de abrir e continuar jogáveis.
 *
 * Quando uma mudança de regra for proposital, regrave os valores com
 *   UPDATE_GOLDEN=1 npx vitest run tests/regression.test.ts
 * e explique a mudança no PR.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAREER_SCHEMA_VERSION } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { completeWeekend, createWeekendRace, buildRaceContext, simulateRemainingRace, startNextSeason } from './engineApi';
import { NOW, botExecutiveOffseason, pickBestOffer, playExecutiveRound, playRound } from './helpers';
import { referenceCheckpoints, type Checkpoint } from './regression/digest';

const GOLDEN = 'tests/golden/simulation.json';

describe('simulação com semente fixa', () => {
  it('dá os mesmos resultados, pontos e finanças gravados', () => {
    const current = referenceCheckpoints();
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, `${JSON.stringify(current, null, 1)}\n`);
    const recorded = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Checkpoint[];
    expect(current.length).toBe(recorded.length);
    // Percorre do kart regional à Fórmula Júnior, mais a Fórmula Elite do save gravado.
    expect([...new Set(current.map((c) => c.category))]).toEqual(['kart-regional', 'kart-national', 'kart-international', 'f4', 'f2']);
    // Aponta o primeiro ponto que divergiu e em quê, em vez de despejar a lista inteira.
    for (let i = 0; i < recorded.length; i++) {
      const was = recorded[i]!;
      const now = current[i]!;
      const changed = (Object.keys(was) as (keyof Checkpoint)[]).filter((key) => was[key] !== now[key]);
      const visible = changed.filter((key) => key !== 'hash');
      const detail =
        visible.length > 0
          ? visible.map((key) => `${key}: ${String(was[key]).slice(0, 80)} → ${String(now[key]).slice(0, 80)}`).join('; ')
          : 'mudou algo do estado da carreira fora de resultados, pontos e finanças';
      expect(changed, `${was.label}: ${detail}`).toEqual([]);
    }
  }, 120_000);
});

describe('saves gravados', () => {
  // Todas as versões do formato, da primeira à atual: uma versão nova entra aqui sozinha.
  const folders = readdirSync('tests/fixtures').filter((name) => /^v\d+$/.test(name));
  const files = folders.flatMap((folder) =>
    readdirSync(`tests/fixtures/${folder}`)
      .filter((name) => name.endsWith('.json'))
      .map((name) => `tests/fixtures/${folder}/${name}`),
  );

  it('há saves de antes da reformulação e da versão atual', () => {
    const v3 = files.filter((f) => f.includes('/v3/'));
    expect(v3.some((f) => f.includes('antes-da-reformulacao'))).toBe(true);
    expect(v3.some((f) => f.includes('antes-da-usabilidade'))).toBe(true);
    expect(v3.some((f) => f.includes('atual'))).toBe(true);
  });

  it.each(files)('%s abre sem erro e continua jogável', (file) => {
    const career = importCareer(readFileSync(file, 'utf8'));
    expect(career.schemaVersion).toBe(CAREER_SCHEMA_VERSION);
    expect(validateCareerIntegrity(career)).toEqual([]);
    // Nenhum texto antigo sobra com a moeda errada ou com plural entre parênteses.
    const text = JSON.stringify(career);
    expect(text).not.toMatch(/\d [a-zãõç]+\((s|ns)\)/);
    // Nem com o nome de uma marca real, nem com a concordância errada dos campeonatos de kart.
    expect(text).not.toMatch(/\bF[1-4]\b|Fórmula [1-4]\b|Azure F1|Stallion F1/);
    expect(text).not.toMatch(/(?:^|[ "(])(?:a|à|da|na|pela) (?:Campeonato (?:Regional|Brasileiro|Mundial) de Kart|Kart (?:Regional|Nacional|Internacional))/i);
    // Regravar e abrir de novo não muda nada.
    expect(importCareer(exportCareer(career, NOW))).toEqual({ ...career, updatedAt: NOW });

    // Continua jogável: segue em frente a partir do ponto em que o save parou.
    if (career.succession || career.status !== 'active') return;
    let next = career;
    if (career.mode === 'executive') next = career.executiveOffseason ? botExecutiveOffseason(career) : playExecutiveRound(career);
    else if (career.offseason) next = startNextSeason(career, pickBestOffer(career));
    else if (career.weekend?.qualifying && career.weekend.playerParticipates) {
      const race = simulateRemainingRace(createWeekendRace(career), buildRaceContext(career), { mode: 'balanced', auto: true });
      next = completeWeekend(career, race);
    } else if (!career.weekend && career.nextRoundIndex < career.calendar.length) next = playRound(career);
    expect(validateCareerIntegrity(next)).toEqual([]);
    expect(next).not.toBe(career);
  });
});
