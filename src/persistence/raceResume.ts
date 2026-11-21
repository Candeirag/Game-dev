/**
 * Corrida interrompida. A corrida ao vivo não faz parte do save: se a página
 * recarrega no meio da prova, o save volta ao momento antes da largada.
 *
 * Para o jogador não perder a corrida, o navegador guarda os comandos dados a
 * cada volta (ritmo, parada, ordem de equipe e, desde a Fase 4, a resposta a
 * cada lance decisivo). Como o motor é determinístico, refazer as voltas com os
 * mesmos comandos devolve exatamente a mesma corrida; nada do resultado é
 * guardado aqui, só os comandos.
 *
 * O registro tem versão (`v`): a 2 é a das corridas com lances. Um registro da
 * versão anterior foi gravado com as regras antigas de corrida e é descartado
 * (a corrida recomeça da largada), em vez de ser refeito com regras diferentes.
 */
import { z } from 'zod';
import { RACE_MODES, type CareerState } from '@/domain/schemas';
import type { PlayerRaceInput, StrategyPlan } from '@/engine';
import { readPreference, writePreference } from './preferences';

const KEY = 'raceResume';

export interface RaceResume {
  /** Carreira, temporada e etapa a que os comandos pertencem. */
  key: string;
  /** Estratégia escolhida antes da largada. */
  plan: StrategyPlan | null;
  /** Comandos de cada volta já simulada, na ordem. */
  steps: PlayerRaceInput[];
  mode: PlayerRaceInput['mode'];
  autoEngineer: boolean;
  /** Volta que a imagem mostrava (a reprodução pode estar um pouco atrás da simulação). */
  shownLap: number;
  /** Instante exato da imagem (tempo de corrida), anotado quando a página é fechada ou escondida; null se não deu tempo. */
  shownTime: number | null;
  totalLaps: number;
}

/** Só confere o formato geral; o conteúdo dos comandos é validado pelo motor ao refazer a corrida. */
const RecordSchema = z.object({
  v: z.literal(2),
  key: z.string(),
  plan: z.unknown(),
  steps: z.array(z.object({ mode: z.enum(RACE_MODES) }).passthrough()).min(1),
  mode: z.enum(RACE_MODES),
  autoEngineer: z.boolean(),
  shownLap: z.number().int().min(0),
  shownTime: z.number().min(0).nullable().optional(),
  totalLaps: z.number().int().min(1),
});

/** Identifica a corrida: a carreira (semente e data de criação), a temporada e a etapa. */
export function raceResumeKey(career: CareerState): string | null {
  if (!career.weekend) return null;
  return [career.seed, career.createdAt, career.season, career.weekend.round].join('|');
}

export function saveRaceResume(record: RaceResume): void {
  writePreference(KEY, JSON.stringify({ v: 2, ...record }));
}

export function clearRaceResume(): void {
  writePreference(KEY, null);
}

/** Corrida interrompida desta carreira e desta etapa, se houver. */
export function loadRaceResume(career: CareerState): RaceResume | null {
  const key = raceResumeKey(career);
  const raw = readPreference(KEY);
  if (!key || !raw) return null;
  try {
    const parsed = RecordSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.key !== key) return null;
    const { plan, steps, mode, autoEngineer, shownLap, shownTime, totalLaps } = parsed.data;
    return {
      key,
      plan: (plan ?? null) as StrategyPlan | null,
      steps: steps as PlayerRaceInput[],
      mode,
      autoEngineer,
      shownLap,
      shownTime: shownTime ?? null,
      totalLaps,
    };
  } catch {
    return null;
  }
}
