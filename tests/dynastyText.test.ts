/**
 * Frases da tela da dinastia (Fase 6): como cada geração chegou à frente da família, os anos de vida,
 * o período, o motivo do fim, até onde o parente correu e as equipes em frase. Nada com gênero.
 */
import { describe, expect, it } from 'vitest';
import { commandPeriod, endLabel, type GenerationLife, lifeYears, racedToText, takeoverLabel, teamsText } from '@/ui/screens/dynasty/dynastyText';

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
    // Passou o comando e morreu depois: o ano da morte não fica gravado.
    expect(lifeYears(life({}))).toBe('Nascimento em 2010');
  });

  it('período à frente da família e motivo do fim, sem repetir o ano', () => {
    expect(commandPeriod(life({}))).toBe('À frente da família de 2025 a 2060');
    expect(commandPeriod(life({ toYear: null }))).toBe('À frente da família desde 2025');
    expect(endLabel(life({ toYear: null, endReason: null, alive: true }))).toBeNull();
    expect(endLabel(life({ endReason: 'death' }))).toBe('Faleceu à frente da família');
    expect(endLabel(life({ endReason: 'accident' }))).toBe('Acidente fatal');
    expect(endLabel(life({ alive: true }))).toBe('Passou o comando em vida');
    expect(endLabel(life({ alive: false }))).toBe('Passou o comando em vida e faleceu depois');
    // Save antigo, fechado sem motivo: nada.
    expect(endLabel(life({ endReason: null }))).toBeNull();
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
