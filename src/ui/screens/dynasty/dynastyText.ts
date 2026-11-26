/**
 * Frases da tela da dinastia (árvore da família e placar). Só montam texto a partir do que o motor
 * já respondeu (`familyTree`, `generationRecords`); nenhuma regra de jogo mora aqui. Nenhuma frase
 * usa gênero: o jogo não sabe o do personagem, o do parceiro nem o dos filhos.
 */
import type { CategoryId, LineageEntry } from '@/domain/schemas';
import { categoryRef } from '@/domain/categoryNames';
import { counted, joinList } from '@/domain/text';

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
 */
export function endLabel(life: GenerationLife): string | null {
  if (life.toYear === null) return null;
  switch (life.endReason) {
    case 'death':
      return 'Faleceu à frente da família';
    case 'accident':
      return 'Acidente fatal';
    case 'handover':
      return life.alive ? 'Passou o comando em vida' : 'Passou o comando em vida e faleceu depois';
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
