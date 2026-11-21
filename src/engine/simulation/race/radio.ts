/**
 * Rádio do engenheiro (Fase 4): frases curtas para o jogador, uma por volta no máximo, sobre o que
 * ele precisa saber agora (pneu no limite, rival que parou, chuva chegando, carro encostando,
 * janela de parada). Não usa sorteio e não muda nada na corrida: só lê o estado antes e depois da
 * volta. As mensagens ficam em `RaceSimState.radio` e não vão para o resultado gravado.
 */
import { ENGINEER_RADIO, TYRE_CURVE } from '@/config/balance';
import { RADIO_TEXTS } from '@/data/raceMoments';
import { referenceLapTime } from '@/data/tracks';
import { textHash } from '../../rng';
import { TYRES } from '../constants';
import { tyreCliff, tyrePaceLoss, tyreState } from '../performance';
import { pitWindow } from './strategy';
import { neutralRaceProfile, type RaceCar, type RaceContext, type RadioMessage, type RaceSimState } from './types';
import { driverName, seconds1 } from './util';
import { conditionFor } from './weatherProfile';

/** O pneu mais exigido da pista, citado nos avisos de desgaste. Sempre o mesmo para a mesma pista. */
export function stressedCorner(trackId: string): string {
  const corners = RADIO_TEXTS.corners;
  return corners[textHash(trackId) % corners.length] ?? corners[0];
}

function windowOf(car: RaceCar, ctx: RaceContext, state: RaceSimState) {
  const driver = ctx.drivers[car.driverId];
  if (!driver || TYRES[car.tyre.compound].rain) return null;
  const profile = ctx.profiles?.[car.driverId] ?? neutralRaceProfile();
  return pitWindow(car, driver.attributes, ctx.track, ctx.category.race, state.currentLap, state.totalLaps, car.modifiers.tyreWearFactor * profile.tyreWear);
}

/**
 * A mensagem desta volta, se houver. `previous` é a corrida antes da volta e `next`, depois dela.
 * A ordem é a da urgência: pneu acabado, pneu no limite, rival que parou, chuva, janela de parada,
 * carro encostando.
 */
export function engineerRadio(previous: RaceSimState, next: RaceSimState, ctx: RaceContext): RadioMessage | null {
  const id = next.playerDriverId;
  const car = next.cars.find((c) => c.driverId === id);
  const before = previous.cars.find((c) => c.driverId === id);
  if (!car || !before || car.status !== 'running' || next.currentLap >= next.totalLaps || next.endedEarly) return null;
  const lap = next.currentLap;
  const rules = ctx.category.race;
  const say = (topic: RadioMessage['topic'], message: string): RadioMessage => ({ lap, topic, message });
  const sameStint = car.pitStops === before.pitStops && car.tyre.compound === before.tyre.compound;
  const now = tyreState(car.tyre.compound, car.tyre.wear);
  const then = tyreState(before.tyre.compound, before.tyre.wear);

  if (sameStint && now === 'gone' && then !== 'gone') {
    // Quanto a volta já perde em relação ao pneu ainda no platô, e vai piorar.
    const loss =
      (tyrePaceLoss(car.tyre.compound, car.tyre.wear) - tyrePaceLoss(car.tyre.compound, tyreCliff(car.tyre.compound))) *
      referenceLapTime(ctx.track, ctx.category);
    return say('tyresGone', RADIO_TEXTS.tyresGone(seconds1(Math.max(0.1, loss))));
  }
  const stint = windowOf(car, ctx, next);
  if (sameStint && now === 'limit' && then !== 'limit' && then !== 'gone') {
    const corner = stressedCorner(ctx.track.id);
    return say('tyresLimit', stint ? RADIO_TEXTS.tyresLimitWindow(corner, stint.from, stint.to) : RADIO_TEXTS.tyresLimit(corner));
  }

  const green = next.neutralization.type === 'none' && previous.neutralization.type === 'none';
  // Só faz sentido falar em undercut para quem ainda tem parada a fazer neste stint, em pista seca.
  const stopAhead = car.plan.length > 0 || stint !== null;
  if (rules.pitStops && green && stopAhead && !TYRES[car.tyre.compound].rain && car.pitStops === before.pitStops && next.totalLaps - lap >= 3) {
    // Um carro que estava perto antes da volta e parou nela.
    for (const other of next.cars) {
      if (other.driverId === id || other.status !== 'running') continue;
      const otherBefore = previous.cars.find((c) => c.driverId === other.driverId);
      if (!otherBefore || other.pitStops === otherBefore.pitStops) continue;
      const gap = otherBefore.totalTime - before.totalTime;
      if (Math.abs(gap) > ENGINEER_RADIO.RIVAL_PIT_GAP) continue;
      const name = driverName(ctx, other.driverId);
      return say('rivalPitted', gap < 0 ? RADIO_TEXTS.rivalPittedAhead(name) : RADIO_TEXTS.rivalPittedBehind(name));
    }
  }

  const forecast = next.forecast;
  const wetness = next.wetnessByLap[lap] ?? next.weather.wetness;
  if (
    forecast.kind === 'rain' &&
    forecast.aroundLap !== null &&
    conditionFor(wetness) === 'dry' &&
    forecast.aroundLap - lap === ENGINEER_RADIO.RAIN_WARNING_LAPS
  ) {
    return say('rain', RADIO_TEXTS.rain(ENGINEER_RADIO.RAIN_WARNING_LAPS));
  }

  // A janela de parada acaba de abrir.
  const stintBefore = windowOf(before, ctx, previous);
  if (sameStint && stint && stint.lapsLeft <= TYRE_CURVE.PIT_WINDOW_LAPS && (!stintBefore || stintBefore.lapsLeft > TYRE_CURVE.PIT_WINDOW_LAPS)) {
    return say('pitWindow', RADIO_TEXTS.pitWindow(stint.from, stint.to));
  }

  // Carro encostando: fora das primeiras voltas (o pelotão ainda está embolado) e sem repetir o aviso em seguida.
  const lastTalk = previous.radio.at(-1);
  const repeated = lastTalk?.topic === 'closing' && lap - lastTalk.lap < ENGINEER_RADIO.CLOSING_REPEAT_LAPS;
  if (green && lap >= ENGINEER_RADIO.CLOSING_FROM_LAP && !repeated) {
    const running = next.cars.filter((c) => c.status === 'running');
    const behind = running[running.findIndex((c) => c.driverId === id) + 1];
    const behindBefore = behind ? previous.cars.find((c) => c.driverId === behind.driverId) : undefined;
    if (behind && behindBefore && behindBefore.status === 'running') {
      const gap = behind.totalTime - car.totalTime;
      const gapBefore = behindBefore.totalTime - before.totalTime;
      if (gap <= ENGINEER_RADIO.CLOSING_GAP && gapBefore - gap >= ENGINEER_RADIO.CLOSING_RATE && gapBefore > 0) {
        return say('closing', RADIO_TEXTS.closing(driverName(ctx, behind.driverId), seconds1(gap)));
      }
    }
  }
  return null;
}
