import type { Team } from '@/domain/schemas';

/**
 * As 10 equipes do Campeonato Regional de Kart.
 *
 * Os números não são aleatórios: as equipes formam uma escada de 5 níveis,
 * com dois times por nível. Do topo à base, a média de motor e chassi cai
 * cerca de 2,5 pontos por equipe, o que dá uns 20 pontos entre a primeira e
 * a última. Pelo modelo de tempo de volta (ver simulationConstants), isso
 * vale cerca de 0,2 s por volta: diferença real, mas que um piloto bom
 * consegue compensar.
 *
 * Dentro de cada nível, as equipes trocam força de motor por força de chassi,
 * para que o traçado de cada pista mude a ordem de forças.
 *
 * A meta (driverTarget) acompanha o nível: quem tem o melhor kart espera
 * disputar o título; quem está no fundo quer apenas sair das últimas posições.
 */
export const TEAMS: readonly Team[] = [
  // Nível 1: candidatos ao título
  { id: 'vortex', name: 'Vortex Racing Kart', shortName: 'VRX', color: '#e11d48', kart: { engine: 86, chassis: 83, reliability: 88 }, driverTarget: 3 },
  { id: 'trovao', name: 'Trovão Motorsport', shortName: 'TRV', color: '#f59e0b', kart: { engine: 82, chassis: 87, reliability: 84 }, driverTarget: 3 },
  // Nível 2: briga por pódios
  { id: 'serra', name: 'Serra Kart Team', shortName: 'SER', color: '#10b981', kart: { engine: 81, chassis: 78, reliability: 86 }, driverTarget: 6 },
  { id: 'falcao', name: 'Falcão Competições', shortName: 'FAL', color: '#3b82f6', kart: { engine: 77, chassis: 81, reliability: 80 }, driverTarget: 6 },
  // Nível 3: pelotão intermediário
  { id: 'riogrande', name: 'Rio Grande Racing', shortName: 'RGR', color: '#8b5cf6', kart: { engine: 77, chassis: 74, reliability: 82 }, driverTarget: 10 },
  { id: 'atlantico', name: 'Atlântico Kart', shortName: 'ATL', color: '#06b6d4', kart: { engine: 73, chassis: 77, reliability: 76 }, driverTarget: 10 },
  // Nível 4: briga por pontos
  { id: 'pampa', name: 'Pampa Speed', shortName: 'PMP', color: '#84cc16', kart: { engine: 72, chassis: 70, reliability: 78 }, driverTarget: 13 },
  { id: 'horizonte', name: 'Horizonte Racing', shortName: 'HOR', color: '#f97316', kart: { engine: 69, chassis: 72, reliability: 72 }, driverTarget: 13 },
  // Nível 5: equipes de entrada, onde o jogador começa
  { id: 'cerrado', name: 'Cerrado Kart Club', shortName: 'CER', color: '#a16207', kart: { engine: 67, chassis: 66, reliability: 74 }, driverTarget: 16 },
  { id: 'garagem', name: 'Garagem Nova Kart', shortName: 'GNK', color: '#64748b', kart: { engine: 64, chassis: 66, reliability: 70 }, driverTarget: 16 },
];

/**
 * Equipes que oferecem vaga a um estreante. Um piloto novato e sem resultados
 * só consegue lugar nas equipes de nível 4 e 5.
 */
export const ROOKIE_TEAM_IDS: readonly string[] = ['horizonte', 'cerrado', 'garagem'];
