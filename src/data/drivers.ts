import type { Driver, DriverAttributes } from '@/domain/schemas';

/**
 * Os 20 pilotos controlados pela IA, escritos à mão.
 *
 * Como os perfis foram montados:
 * - O nível geral de cada piloto acompanha o da sua equipe. Boas equipes
 *   contratam bons pilotos, mas há exceções de propósito (jovens talentos em
 *   equipes modestas, veteranos regulares no meio do grid).
 * - O pelotão da frente (8 pilotos das 4 melhores equipes) foi calibrado para
 *   caber em cerca de 0,1 s por volta. Nas simulações de teste, isso dá títulos
 *   divididos entre vários pilotos, em vez do domínio de uma dupla.
 * - Cada piloto tem uma identidade clara, para que a simulação produza
 *   comportamentos reconhecíveis: o prodígio rápido e irregular, o veterano
 *   consistente, o especialista em chuva.
 * - Os jovens têm experiência baixa e potencial alto; os veteranos, o
 *   contrário. Isso faz o grid mudar ao longo das temporadas.
 *
 * Nas equipes de entrada, o segundo piloto de cada uma (ver ROOKIE_SEAT_DRIVER)
 * cede a vaga quando o jogador assina com aquela equipe.
 */

type Row = [
  id: string,
  firstName: string,
  lastName: string,
  nationality: string,
  age: number,
  teamId: string,
  pace: number,
  consistency: number,
  overtaking: number,
  defending: number,
  focus: number,
  racecraft: number,
  tyreManagement: number,
  wetSkill: number,
  experience: number,
  potential: number,
];

const ROWS: readonly Row[] = [
  // Vortex: o favorito completo e um jovem agressivo
  ['andrade', 'Lucas', 'Andrade', 'BR', 17, 'vortex', 80, 76, 76, 74, 77, 79, 72, 70, 68, 90],
  ['kowalski', 'Matheus', 'Kowalski', 'BR', 16, 'vortex', 78, 70, 80, 68, 70, 72, 66, 74, 55, 88],
  // Trovão: o veterano metódico e o prodígio irregular
  ['monteiro', 'Rafael', 'Monteiro', 'BR', 18, 'trovao', 78, 77, 72, 78, 78, 80, 78, 68, 74, 86],
  ['sato', 'Gabriel', 'Sato', 'BR', 15, 'trovao', 79, 66, 74, 64, 66, 68, 64, 76, 42, 93],
  // Serra: o equilibrado e o especialista em chuva
  ['bertolini', 'Thiago', 'Bertolini', 'BR', 17, 'serra', 78, 76, 70, 74, 74, 76, 76, 72, 64, 84],
  ['ferraz', 'Diego', 'Ferraz', 'AR', 18, 'serra', 75, 72, 74, 76, 72, 74, 70, 80, 66, 82],
  // Falcão: o talento cru e o estrategista
  ['cardoso', 'Bruno', 'Cardoso', 'BR', 16, 'falcao', 78, 68, 76, 66, 68, 70, 66, 66, 50, 89],
  ['lima', 'Henrique', 'Lima', 'BR', 19, 'falcao', 74, 78, 68, 76, 78, 78, 78, 70, 76, 80],
  // Rio Grande
  ['schneider', 'Vitor', 'Schneider', 'BR', 17, 'riogrande', 72, 72, 72, 70, 70, 70, 72, 74, 58, 83],
  ['paredes', 'Enzo', 'Paredes', 'UY', 16, 'riogrande', 74, 64, 76, 62, 64, 64, 62, 66, 46, 87],
  // Atlântico
  ['nogueira', 'Caio', 'Nogueira', 'BR', 18, 'atlantico', 70, 74, 66, 72, 74, 74, 74, 64, 66, 79],
  ['mendes', 'Arthur', 'Mendes', 'BR', 15, 'atlantico', 71, 62, 70, 62, 62, 62, 64, 70, 36, 90],
  // Pampa
  ['wagner', 'Felipe', 'Wagner', 'BR', 19, 'pampa', 68, 74, 64, 72, 72, 72, 72, 76, 70, 76],
  ['alves', 'Pedro', 'Alves', 'BR', 16, 'pampa', 70, 64, 70, 64, 64, 64, 62, 62, 44, 84],
  // Horizonte
  ['rocha', 'Leonardo', 'Rocha', 'BR', 17, 'horizonte', 69, 68, 68, 66, 68, 68, 70, 66, 54, 80],
  ['duarte', 'Samuel', 'Duarte', 'BR', 15, 'horizonte', 64, 60, 64, 60, 60, 58, 60, 60, 30, 82],
  // Cerrado
  ['pires', 'Gustavo', 'Pires', 'BR', 20, 'cerrado', 66, 72, 62, 70, 70, 70, 70, 68, 72, 72],
  ['teixeira', 'Nicolas', 'Teixeira', 'PY', 14, 'cerrado', 62, 58, 62, 58, 58, 56, 58, 62, 26, 85],
  // Garagem Nova
  ['moura', 'Daniel', 'Moura', 'BR', 18, 'garagem', 65, 66, 64, 64, 66, 64, 66, 64, 56, 76],
  ['batista', 'João', 'Batista', 'BR', 15, 'garagem', 60, 58, 60, 58, 56, 56, 58, 58, 28, 80],
];

export const AI_DRIVERS: readonly Driver[] = ROWS.map((row) => {
  const [id, firstName, lastName, nationality, age, teamId, pace, consistency, overtaking, defending, focus, racecraft, tyreManagement, wetSkill, experience, potential] = row;
  const attributes: DriverAttributes = { pace, consistency, overtaking, defending, focus, racecraft, tyreManagement, wetSkill, experience };
  return { id, firstName, lastName, nationality, age, teamId, isPlayer: false, attributes, potential, trainingFocus: 'balanced' };
});

/** Piloto que cede a vaga quando o jogador assina com cada equipe de entrada. */
export const ROOKIE_SEAT_DRIVER: Readonly<Record<string, string>> = {
  horizonte: 'duarte',
  cerrado: 'teixeira',
  garagem: 'batista',
};
