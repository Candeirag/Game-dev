/**
 * Frases da tela da dinastia (árvore da família e placar). Só montam texto a partir do que o motor
 * já respondeu (`familyTree`, `generationRecords`); nenhuma regra de jogo mora aqui. Nenhuma frase
 * usa gênero: o jogo não sabe o do personagem, o do parceiro nem o dos filhos.
 */
import type { CategoryId, Elder, LineageEntry } from '@/domain/schemas';
import { categoryRef } from '@/domain/categoryNames';
import { counted, joinList } from '@/domain/text';
import type { FamilyTreeGeneration, GenerationRecord } from '@/engine';

/** Como o personagem chegou à frente da família (null: save antigo, sem o registro). */
export function takeoverLabel(generation: number, path: LineageEntry['path']): string | null {
  if (generation === 1) return 'Fundou a dinastia';
  if (path === 'driver') return 'Assumiu pelas pistas';
  if (path === 'executive') return 'Assumiu pelos negócios';
  return null;
}

/** O que se sabe de uma geração para a linha de vida e o fim. */
export interface GenerationLife {
  bornYear: number;
  fromYear: number;
  /** null: a geração atual. */
  toYear: number | null;
  endReason: LineageEntry['endReason'];
  /** A geração atual ou quem passou o comando em vida e segue vivo. */
  alive: boolean;
  /** Idade de quem está vivo (null: já faleceu). */
  age: number | null;
}

/**
 * A linha de vida de uma geração, juntando a árvore (`familyTree`) e o placar (`generationRecords`).
 * A idade só existe para quem se sabe vivo: o personagem atual e quem passou o comando e segue na
 * lista dos vivos (`elder`); a dele conta no ano da família (`familyYear`).
 */
export function generationLife(
  node: Pick<FamilyTreeGeneration, 'bornYear' | 'endReason' | 'alive' | 'current'>,
  record: Pick<GenerationRecord, 'fromYear' | 'toYear'>,
  { playerAge, elder, year }: { playerAge: number; elder: Pick<Elder, 'bornYear'> | null; year: number },
): GenerationLife {
  return {
    bornYear: node.bornYear,
    fromYear: record.fromYear,
    toYear: record.toYear,
    endReason: node.endReason,
    alive: node.alive,
    age: node.current ? playerAge : elder ? year - elder.bornYear : null,
  };
}

/** Os anos de vida: "1990 a 2041" para quem morreu no comando; "Nascimento em 1990 · 52 anos" para quem está vivo. */
export function lifeYears(life: GenerationLife): string {
  const died = life.endReason === 'death' || life.endReason === 'accident';
  if (died && life.toYear !== null) return `${life.bornYear} a ${life.toYear}`;
  if (life.alive && life.age !== null) return `Nascimento em ${life.bornYear} · ${counted(life.age, 'ano', 'anos')}`;
  return `Nascimento em ${life.bornYear}`;
}

/** O período à frente da família: "À frente da família de 2026 a 2048" ou "desde 2048". */
export function commandPeriod(life: Pick<GenerationLife, 'fromYear' | 'toYear'>): string {
  return life.toYear === null ? `À frente da família desde ${life.fromYear}` : `À frente da família de ${life.fromYear} a ${life.toYear}`;
}

/**
 * Como a geração terminou (null: a geração atual ou save antigo sem o motivo). O ano já está no
 * período à frente da família, então aqui só vai o motivo.
 *
 * Quem passou o comando em vida e não está mais na lista dos vivos (`dynasty.elders`) pode ter
 * morrido depois ou vir de um save de antes da versão 10, que não tinha essa lista. Como o motor não
 * grava o ano dessa morte, a frase não afirma nada além da passagem; quem segue vivo ganha, na tela,
 * o selo "Em vida".
 */
export function endLabel(life: GenerationLife): string | null {
  if (life.toYear === null) return null;
  switch (life.endReason) {
    case 'death':
      return 'Faleceu à frente da família';
    case 'accident':
      return 'Acidente fatal';
    case 'handover':
      return 'Passou o comando em vida';
    default:
      return null;
  }
}

/** Até onde um parente correu antes de mudar de caminho. */
export function racedToText(racedTo: CategoryId | null): string {
  return racedTo ? `Correu até ${categoryRef(racedTo, 'the')}` : 'Nunca correu';
}

/** As equipes de uma geração, em frase ("A, B e C"), ou o texto de quando não há nenhuma. */
export function teamsText(teams: readonly string[], none: string): string {
  return teams.length > 0 ? joinList(teams) : none;
}
