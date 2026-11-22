/**
 * Ritmo da transmissão (Fase 4): "uma corrida jogada com lances leva menos de 4 minutos".
 *
 * A conta é a do relógio da transmissão (`src/ui/race/useRacePlayback.ts`): as luzes de largada,
 * todas as voltas no ritmo da tela e, por cima, o tempo em que o desfecho de cada lance fica na
 * tarja. O tempo que o jogador leva para escolher não entra (não há limite: a corrida espera).
 */
import { describe, expect, it } from 'vitest';
import { RACE_MOMENTS } from '@/config/balance';
import { CATEGORIES } from '@/data/categories';
import { getTrack, raceLaps } from '@/data/tracks';
import { buildCircuit } from '@/engine';
import { LAP_SECONDS, MIN_LAP_SECONDS, MOMENT_RESULT_SECONDS, RACE_SECONDS, SPEEDS, lapSecondsFor, raceScreenSeconds } from '@/ui/race/useRacePlayback';

/** O teto do critério de aceite: quatro minutos. */
const FOUR_MINUTES = 240;

/** Todas as corridas do jogo: cada pista do calendário de cada categoria. */
const RACES = CATEGORIES.flatMap((category) =>
  category.trackIds.map((trackId) => {
    const track = getTrack(trackId);
    return { category: category.id, track: trackId, length: buildCircuit(track, category.vehicle).length, laps: raceLaps(track, category) };
  }),
);

/** O ritmo natural da pista na tela: o de uma corrida de uma volta só, que nunca precisa encolher. */
const naturalLap = (length: number) => lapSecondsFor(length, 1);

/** A corrida inteira com o número máximo de lances, cada desfecho ficando o tempo todo na tarja. */
const playedSeconds = (length: number, laps: number, speed = 1) => raceScreenSeconds(length, laps, speed) + RACE_MOMENTS.MAX_PER_RACE * MOMENT_RESULT_SECONDS;

describe('ritmo da corrida na tela', () => {
  it('há corridas de todas as categorias na conta', () => {
    expect(new Set(RACES.map((r) => r.category)).size).toBe(CATEGORIES.length);
    for (const category of CATEGORIES) expect(category.trackIds.length).toBeGreaterThan(0);
    for (const race of RACES) {
      expect(race.length, `${race.category} em ${race.track}`).toBeGreaterThan(0);
      expect(race.laps, `${race.category} em ${race.track}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('em 1×, toda corrida jogada com o máximo de lances leva menos de 4 minutos', () => {
    let longest = 0;
    for (const race of RACES) {
      const seconds = playedSeconds(race.length, race.laps);
      expect(seconds, `${race.category} em ${race.track}: ${race.laps} voltas`).toBeLessThan(FOUR_MINUTES);
      longest = Math.max(longest, seconds);
    }
    // E não é uma corrida de um minuto: a mais longa passa de dois minutos e meio.
    expect(longest).toBeGreaterThan(150);
  });

  it('as voltas somadas cabem no tempo de corrida da tela', () => {
    for (const race of RACES) {
      const laps = race.laps * lapSecondsFor(race.length, race.laps);
      expect(laps, `${race.category} em ${race.track}`).toBeLessThanOrEqual(Math.max(RACE_SECONDS, race.laps * MIN_LAP_SECONDS) + 1e-9);
      // As luzes de largada e o rabicho depois da bandeirada somam poucos segundos às voltas.
      const extra = raceScreenSeconds(race.length, race.laps, 1) - laps;
      expect(extra, `${race.category} em ${race.track}`).toBeGreaterThan(0);
      expect(extra, `${race.category} em ${race.track}`).toBeLessThan(10);
    }
  });

  it('em 2× a corrida cai para perto da metade, e cada velocidade é mais curta que a anterior', () => {
    for (const race of RACES) {
      const normal = raceScreenSeconds(race.length, race.laps, 1);
      const double = raceScreenSeconds(race.length, race.laps, 2);
      expect(double / normal, `${race.category} em ${race.track}`).toBeGreaterThan(0.48);
      expect(double / normal, `${race.category} em ${race.track}`).toBeLessThan(0.55);
      let previous = Number.POSITIVE_INFINITY;
      for (const speed of SPEEDS) {
        const seconds = raceScreenSeconds(race.length, race.laps, speed);
        expect(seconds).toBeLessThan(previous);
        previous = seconds;
      }
      // Com lances, a mais rápida das velocidades ainda dá uma corrida de menos de um minuto.
      expect(playedSeconds(race.length, race.laps, SPEEDS[SPEEDS.length - 1])).toBeLessThan(60);
    }
  });

  it('nenhuma volta dura menos que o mínimo nem mais que o ritmo natural da pista', () => {
    for (const race of RACES) {
      const natural = naturalLap(race.length);
      expect(natural, `${race.category} em ${race.track}`).toBeGreaterThanOrEqual(LAP_SECONDS);
      expect(natural, `${race.category} em ${race.track}`).toBeLessThanOrEqual(40);
      const seconds = lapSecondsFor(race.length, race.laps);
      expect(seconds, `${race.category} em ${race.track}`).toBeGreaterThanOrEqual(MIN_LAP_SECONDS);
      expect(seconds, `${race.category} em ${race.track}`).toBeLessThanOrEqual(natural);
    }
    // Fora do calendário: corridas longuíssimas param no mínimo; mais voltas nunca alongam a volta.
    for (const length of [600, 2500, 4200, 7000, 12_000]) {
      expect(lapSecondsFor(length, 500)).toBe(MIN_LAP_SECONDS);
      let previous = Number.POSITIVE_INFINITY;
      for (let laps = 1; laps <= 120; laps++) {
        const seconds = lapSecondsFor(length, laps);
        expect(seconds).toBeGreaterThanOrEqual(MIN_LAP_SECONDS);
        expect(seconds).toBeLessThanOrEqual(previous);
        previous = seconds;
      }
    }
  });

  it('corrida curta não estica: poucas voltas correm no ritmo natural, não espalhadas pelo tempo todo', () => {
    for (const race of RACES) {
      const natural = naturalLap(race.length);
      // Três voltas levam três voltas naturais (e não os 165 s inteiros divididos por três).
      expect(lapSecondsFor(race.length, 3)).toBe(natural);
      expect(3 * lapSecondsFor(race.length, 3)).toBeLessThan(RACE_SECONDS);
      // Enquanto as voltas naturais cabem no tempo de corrida, a volta não muda de tamanho.
      const fits = Math.floor(RACE_SECONDS / natural);
      expect(lapSecondsFor(race.length, fits)).toBe(natural);
      // Passando disso, a volta encolhe para a corrida caber.
      expect(lapSecondsFor(race.length, fits + 2)).toBeLessThan(natural);
      expect(raceScreenSeconds(race.length, 3, 1)).toBeLessThan(raceScreenSeconds(race.length, race.laps, 1));
    }
  });
});
