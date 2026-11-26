/**
 * O que o nascimento muda ao longo da carreira: perfil de corrida (aptidões e talentos e
 * defeitos), treino, patrocinadores e a vida no interior.
 *
 * O nascimento só vale para o personagem de quem ele é (`activeBirth`). Desde a Fase 6, o herdeiro que
 * é filho (ou o parente jovem piloto) ganha na sucessão um nascimento próprio, com os talentos e
 * defeitos que herdou, e tudo aqui passa a valer para ele; o do fundador fica na linhagem. Quem
 * assume sem ser de sangue (o parceiro, o parente adulto) e uma carreira de save anterior à versão 6
 * (`birth: null`) correm com tudo neutro.
 */
import { APTITUDE_EFFECTS, BIRTH, TRAIT_EFFECTS } from '@/config/balance';
import type { AptitudeKey, Birth, CareerState, TraitId } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { raceLaps, referenceLapTime } from '@/data/tracks';
import type { Track } from '@/domain/schemas';
import { neutralRaceProfile, type DriverRaceProfile } from '../simulation/race/types';

/** Os campos que um talento ou defeito pode ter em TRAIT_EFFECTS; os ausentes são neutros. */
type TraitEffect = Readonly<
  Partial<
    Record<
      | 'wetPace'
      | 'wetError'
      | 'startSpread'
      | 'startGain'
      | 'tyreWear'
      | 'training'
      | 'qualifying'
      | 'injury'
      | 'collision'
      | 'attack'
      | 'debutPace'
      | 'debutError',
      number
    >
  >
>;

export function traitEffect(id: TraitId): TraitEffect {
  return TRAIT_EFFECTS[id];
}

/** O nascimento que vale agora: o do personagem atual, se ele foi sorteado. */
export function activeBirth(career: CareerState): Birth | null {
  const birth = career.birth;
  return birth && birth.driverId === career.playerDriverId ? birth : null;
}

export function hasTrait(birth: Birth | null, id: TraitId): boolean {
  return birth?.traits.some((t) => t.id === id) ?? false;
}

/** Aptidão em relação a 50, de −1 (0) a +1 (100). */
const centered = (birth: Birth, key: AptitudeKey) => (birth.aptitudes[key] - 50) / 50;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Quem nasceu no interior e ainda não se mudou para a capital. */
export function livesInInterior(career: CareerState): boolean {
  const birth = activeBirth(career);
  return birth !== null && birth.region === 'interior' && birth.movedSeason === null;
}

/** Morar no interior pesa nesta categoria (viagens, treino e o evento da mudança)? */
export function interiorWeighs(career: CareerState): boolean {
  return livesInInterior(career) && (BIRTH.INTERIOR_CATEGORIES as readonly string[]).includes(career.categoryId);
}

/** Multiplicador do ganho de treino do jogador: aprende rápido ou devagar e, no interior, menos estrutura. */
export function birthTrainingFactor(career: CareerState): number {
  const birth = activeBirth(career);
  if (!birth) return 1;
  const traits = birth.traits.reduce((factor, t) => factor * (traitEffect(t.id).training ?? 1), 1);
  return traits * (interiorWeighs(career) ? BIRTH.INTERIOR_TRAINING_FACTOR : 1);
}

/** Multiplicador do valor das propostas de patrocínio para um carisma (0 a 100). */
export function charismaSponsorFactor(charisma: number): number {
  return 1 + ((charisma - 50) / 50) * APTITUDE_EFFECTS.CHARISMA_SPONSOR_VALUE;
}

/** Multiplicador do valor das propostas de patrocínio do jogador, pelo carisma de nascença. */
export function sponsorValueFactor(career: CareerState): number {
  const birth = activeBirth(career);
  return birth ? charismaSponsorFactor(birth.aptitudes.charisma) : 1;
}

/** Pontos de satisfação que o carisma soma (ou tira) a cada patrocinador por etapa. */
export function sponsorSatisfactionBonus(career: CareerState): number {
  const birth = activeBirth(career);
  return birth ? centered(birth, 'charisma') * APTITUDE_EFFECTS.CHARISMA_SATISFACTION : 0;
}

/**
 * A etapa é uma estreia do jogador: a primeira da carreira ou a primeira de uma temporada numa
 * categoria ou numa equipe diferente da temporada anterior.
 */
export function isDebutRound(career: CareerState, round: number): boolean {
  if (round !== 1) return false;
  const player = career.drivers.find((d) => d.id === career.playerDriverId);
  const last = career.history[career.history.length - 1];
  if (last?.mode !== 'driver') return true;
  return last.categoryId !== career.categoryId || last.playerTeamId !== player?.teamId;
}

/** Peso da prova longa: 0 até LONG_RACE_MINUTES[0], 1 a partir de LONG_RACE_MINUTES[1]. */
export function longRaceWeight(track: Track, category: CategoryDefinition): number {
  const minutes = (raceLaps(track, category) * referenceLapTime(track, category)) / 60;
  const [short, long] = APTITUDE_EFFECTS.LONG_RACE_MINUTES;
  return clamp01((minutes - short) / (long - short));
}

/**
 * Perfil de corrida do jogador nesta etapa, ou null se ele não tem nascimento sorteado. As
 * aptidões agem sempre; os talentos e defeitos também, revelados ou não.
 */
export function birthRaceProfile(career: CareerState, track: Track, category: CategoryDefinition, round: number): DriverRaceProfile | null {
  const birth = activeBirth(career);
  if (!birth) return null;
  const p = neutralRaceProfile();
  const fx = APTITUDE_EFFECTS;
  // Reflexo: reação na largada.
  p.startSpread *= 1 - centered(birth, 'reflexes') * fx.REFLEX_START_SPREAD;
  // Físico: cansaço nas provas longas e ritmo com a pista molhada.
  p.fatigue *= 1 - centered(birth, 'physique') * fx.PHYSIQUE_FATIGUE * longRaceWeight(track, category);
  p.wetPace -= centered(birth, 'physique') * fx.PHYSIQUE_WET_PACE;
  // Frieza: disputas e última volta.
  p.duel += centered(birth, 'composure') * fx.COMPOSURE_DUEL;
  p.lastLapDuel += centered(birth, 'composure') * fx.COMPOSURE_LAST_LAP_DUEL;
  p.lastLapError *= 1 - centered(birth, 'composure') * fx.COMPOSURE_LAST_LAP_ERROR;
  // Talentos e defeitos.
  const debut = isDebutRound(career, round);
  for (const trait of birth.traits) {
    const t = traitEffect(trait.id);
    p.wetPace += t.wetPace ?? 0;
    p.wetError += t.wetError ?? 0;
    p.startSpread *= t.startSpread ?? 1;
    p.startGain += t.startGain ?? 0;
    p.tyreWear *= t.tyreWear ?? 1;
    p.injury *= t.injury ?? 1;
    p.collision *= t.collision ?? 1;
    p.attack += t.attack ?? 0;
    p.qualifying += t.qualifying ?? 0;
    if (debut) {
      p.pace += t.debutPace ?? 0;
      p.error *= t.debutError ?? 1;
    }
  }
  return p;
}
