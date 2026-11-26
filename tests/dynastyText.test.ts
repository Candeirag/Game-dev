/**
 * Frases da tela da dinastia (Fase 6): como cada geração chegou à frente da família, os anos de vida,
 * o período, o motivo do fim, até onde o parente correu e as equipes em frase. Nada com gênero.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { familyTree, familyYear, generationRecords, getPlayer, resolveSuccession } from '@/engine';
import { importCareer } from '@/persistence/saveService';
import {
  commandPeriod,
  endLabel,
  type GenerationLife,
  generationLife,
  lifeYears,
  racedToText,
  takeoverLabel,
  teamsText,
} from '@/ui/screens/dynasty/dynastyText';

const life = (patch: Partial<GenerationLife>): GenerationLife => ({
  bornYear: 2010,
  fromYear: 2025,
  toYear: 2060,
  endReason: 'handover',
  alive: false,
  age: null,
  ...patch,
});

describe('frases da dinastia', () => {
  it('como assumiu: a 1ª geração fundou; depois, pelas pistas ou pelos negócios', () => {
    expect(takeoverLabel(1, null)).toBe('Fundou a dinastia');
    // A 1ª geração é sempre a que fundou, mesmo que o registro diga outra coisa.
    expect(takeoverLabel(1, 'driver')).toBe('Fundou a dinastia');
    expect(takeoverLabel(2, 'driver')).toBe('Assumiu pelas pistas');
    expect(takeoverLabel(3, 'executive')).toBe('Assumiu pelos negócios');
    // Save antigo, sem o caminho gravado: não inventa.
    expect(takeoverLabel(2, null)).toBeNull();
  });

  it('anos de vida: de ponta a ponta para quem morreu no comando; nascimento e idade para quem está vivo', () => {
    expect(lifeYears(life({ endReason: 'death' }))).toBe('2010 a 2060');
    expect(lifeYears(life({ endReason: 'accident', toYear: 2041 }))).toBe('2010 a 2041');
    expect(lifeYears(life({ alive: true, age: 72 }))).toBe('Nascimento em 2010 · 72 anos');
    expect(lifeYears(life({ toYear: null, endReason: null, alive: true, age: 1 }))).toBe('Nascimento em 2010 · 1 ano');
    // Passou o comando e não está mais entre os vivos (morreu depois ou save de antes da v10): o ano
    // da morte não fica gravado, então só o nascimento.
    expect(lifeYears(life({}))).toBe('Nascimento em 2010');
  });

  it('período à frente da família e motivo do fim, sem repetir o ano', () => {
    expect(commandPeriod(life({}))).toBe('À frente da família de 2025 a 2060');
    expect(commandPeriod(life({ toYear: null }))).toBe('À frente da família desde 2025');
    expect(endLabel(life({ toYear: null, endReason: null, alive: true }))).toBeNull();
    expect(endLabel(life({ endReason: 'death' }))).toBe('Faleceu à frente da família');
    expect(endLabel(life({ endReason: 'accident' }))).toBe('Acidente fatal');
    expect(endLabel(life({ alive: true }))).toBe('Passou o comando em vida');
    // Fora da lista dos vivos não quer dizer morte: nos saves de antes da v10 a lista vem vazia. Sem o
    // ano gravado, a frase não inventa um falecimento.
    expect(endLabel(life({ alive: false }))).toBe('Passou o comando em vida');
    // Save antigo, fechado sem motivo: nada.
    expect(endLabel(life({ endReason: null }))).toBeNull();
  });

  it('passagem de comando num save de antes da v10: ninguém aparece como falecido sem o jogo ter sorteado', () => {
    // Save da v9 com a passagem de comando aberta; resolvida já na regra da v10, quem passou o
    // comando entra na lista dos vivos.
    const pending = importCareer(readFileSync('tests/fixtures/v9/sucessao-pendente.json', 'utf8'));
    expect(pending.succession?.cause).toBe('handover');
    const resolved = resolveSuccession(pending, 'partner', 'executive');
    const lifeOfFounder = (career: typeof resolved) => {
      const tree = familyTree(career);
      const founder = tree.generations[0];
      const record = generationRecords(career)[0];
      if (!founder || !record) throw new Error('a árvore e o placar começam pela 1ª geração');
      const elder = tree.elders.find((e) => e.driverId === founder.driverId) ?? null;
      return generationLife(founder, record, { playerAge: getPlayer(career).age, elder, year: familyYear(career) });
    };
    const alive = lifeOfFounder(resolved);
    expect(alive.alive).toBe(true);
    expect(lifeYears(alive)).toMatch(/^Nascimento em \d{4} · \d+ anos$/);
    expect(endLabel(alive)).toBe('Passou o comando em vida');

    // O mesmo save resolvido na v9 e convertido: a migração grava a lista vazia (`elders: []`).
    const migrated = { ...resolved, dynasty: { ...resolved.dynasty, elders: [] } };
    const unknown = lifeOfFounder(migrated);
    expect(unknown.alive).toBe(false);
    expect(lifeYears(unknown)).toBe(`Nascimento em ${unknown.bornYear}`);
    expect(endLabel(unknown)).toBe('Passou o comando em vida');
  });

  it('até onde o parente correu, com o artigo da categoria', () => {
    expect(racedToText('f2')).toBe('Correu até a Fórmula Elite');
    expect(racedToText('f1')).toBe('Correu até o Grand Prix Mundial');
    expect(racedToText(null)).toBe('Nunca correu');
  });

  it('equipes em frase, ou o texto de nenhuma', () => {
    expect(teamsText(['Equipe A'], 'nenhuma equipe')).toBe('Equipe A');
    expect(teamsText(['Equipe A', 'Equipe B', 'Equipe C'], 'nenhuma equipe')).toBe('Equipe A, Equipe B e Equipe C');
    expect(teamsText([], 'nenhuma equipe')).toBe('nenhuma equipe');
  });
});
