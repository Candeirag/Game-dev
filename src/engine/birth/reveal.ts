/**
 * Revelação dos talentos e defeitos ocultos.
 *
 * Cada traço fica como "?" na ficha até o jogo mostrar, na pista, que ele existe: "gênio na chuva"
 * na primeira corrida molhada, "esquentado" no primeiro toque. Os dois lados de um par têm o
 * mesmo tipo de gatilho, então o jogador não sabe qual dos dois tem até acontecer. Depois de cada
 * etapa, `revealTraits` confere os gatilhos dos traços ainda ocultos; revelar não muda o efeito
 * (o traço já agia desde a primeira corrida), só o mostra.
 */
import { TRAIT_REVEAL } from '@/config/balance';
import type { CareerState, InboxMessage, RaceEntryResult, RoundRecord, TraitId } from '@/domain/schemas';
import { BIRTH_TRAITS } from '@/data/birth';
import { getTrack } from '@/data/tracks';
import { pushMessages } from '../career/inbox';
import { activeBirth, isDebutRound } from './effects';

export interface RevealContext {
  career: CareerState;
  record: RoundRecord;
  /** Resultado do jogador na corrida (null se ele não correu). */
  entry: RaceEntryResult | null;
  playerId: string;
  /** A etapa foi a última da temporada (balanço do ano). */
  seasonEnded: boolean;
}

/** Posições ganhas (positivo) ou perdidas na primeira volta, pelas ultrapassagens registradas nela. */
export function startPositionChange(record: RoundRecord, playerId: string): number {
  let change = 0;
  for (const e of record.race.events) {
    if (e.lap !== 1 || e.type !== 'overtake') continue;
    if (e.driverId === playerId) change++;
    else if (e.otherDriverId === playerId) change--;
  }
  return change;
}

/** Diferença da melhor volta de classificação do jogador para a do companheiro (negativa = mais rápido). */
function qualifyingGapToTeammate(record: RoundRecord, playerId: string): number | null {
  const mine = record.qualifying.entries.find((e) => e.driverId === playerId);
  const mate = mine ? record.qualifying.entries.find((e) => e.teamId === mine.teamId && e.driverId !== playerId) : undefined;
  if (!mine || !mate) return null;
  const own = mine.bestLap ?? Number.POSITIVE_INFINITY;
  const other = mate.bestLap ?? Number.POSITIVE_INFINITY;
  if (own === other) return null;
  return own - other;
}

// Corrida que larga molhada, ou em que a chuva chegou no meio (o lance "chuva começando" da Fase 4).
const wetRace = (c: RevealContext) => c.entry !== null && (c.record.race.weather.condition !== 'dry' || c.record.race.moments.some((m) => m.kind === 'rain'));
const highWearFinish = (c: RevealContext) => c.entry?.status === 'finished' && getTrack(c.record.trackId).tyreWear >= TRAIT_REVEAL.HIGH_WEAR_TRACK;
const crash = (c: RevealContext) => c.entry?.status === 'dnf' && (c.entry.dnfReason === 'crash' || c.entry.dnfReason === 'collision');
const contact = (c: RevealContext) =>
  c.record.race.events.some(
    (e) => (e.type === 'collision' || (e.type === 'dnf' && e.otherDriverId !== undefined)) && (e.driverId === c.playerId || e.otherDriverId === c.playerId),
  );
const debut = (c: RevealContext) => c.entry !== null && isDebutRound(c.career, c.record.round);
const startGain = (c: RevealContext) => c.entry !== null && startPositionChange(c.record, c.playerId) >= TRAIT_REVEAL.START_POSITIONS;
const startLoss = (c: RevealContext) => c.entry !== null && startPositionChange(c.record, c.playerId) <= -TRAIT_REVEAL.START_POSITIONS;
const aheadOfMate = (c: RevealContext) => (qualifyingGapToTeammate(c.record, c.playerId) ?? 0) < 0;
const behindMate = (c: RevealContext) => (qualifyingGapToTeammate(c.record, c.playerId) ?? 0) > 0;

/** O gatilho de cada traço: verdadeiro quando a etapa recém-disputada o revela. */
export const revealTriggers: Readonly<Record<TraitId, (c: RevealContext) => boolean>> = {
  rainMaster: wetRace,
  rainFear: wetRace,
  bornStarter: startGain,
  slowStarter: startLoss,
  tyreSaver: highWearFinish,
  tyreEater: highWearFinish,
  quickLearner: (c) => c.seasonEnded,
  slowLearner: (c) => c.seasonEnded,
  qualifyingKing: aheadOfMate,
  qualifyingNerves: behindMate,
  ironBody: crash,
  fragile: crash,
  cleanRacer: contact,
  hothead: contact,
  bigStage: debut,
  debutNerves: debut,
};

/** Revela os traços cujos gatilhos a etapa acionou e avisa o jogador por mensagem. */
export function revealTraits(career: CareerState, record: RoundRecord): CareerState {
  const birth = activeBirth(career);
  if (!birth || birth.traits.every((t) => t.revealedSeason !== null)) return career;
  const playerId = career.playerDriverId;
  const context: RevealContext = {
    career,
    record,
    entry: record.race.entries.find((e) => e.driverId === playerId) ?? null,
    playerId,
    seasonEnded: record.round >= career.calendar.length,
  };
  const revealed: TraitId[] = [];
  const traits = birth.traits.map((trait) => {
    if (trait.revealedSeason !== null || !revealTriggers[trait.id](context)) return trait;
    revealed.push(trait.id);
    return { ...trait, revealedSeason: record.season, revealedRound: record.round };
  });
  if (revealed.length === 0) return career;
  const messages: InboxMessage[] = revealed.map((id) => {
    const info = BIRTH_TRAITS[id];
    return {
      id: `s${record.season}-r${record.round}-trait-${id}`,
      date: record.date,
      category: 'race',
      title: `${info.kind === 'talent' ? 'Talento descoberto' : 'Defeito descoberto'}: ${info.name}`,
      body: `${info.description} Ficou claro ${info.reveal}. A ficha do piloto já mostra.`,
    };
  });
  return { ...career, birth: { ...birth, traits }, inbox: pushMessages(career.inbox, messages) };
}
