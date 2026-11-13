import type { Track } from '@/domain/schemas';

/**
 * Os 10 kartódromos do calendário. Os nomes são fictícios; as cidades e o
 * clima seguem a realidade do Sul e do Sudeste do Brasil.
 *
 * Como os números foram escolhidos:
 * - baseLapTime: comprimento do traçado dividido por uma velocidade média de
 *   kart de competição (cerca de 80 a 85 km/h), arredondado.
 * - laps: corridas de 15 a 20 minutos, a duração típica de uma final regional.
 * - rainChance e baseTrackTemp: na data da etapa. Março é fim do verão
 *   chuvoso no Sudeste. Junho a agosto é a estação seca no Sudeste, enquanto o
 *   Sul continua chuvoso e frio.
 * - overtakingDifficulty, tyreWear e powerSensitivity descrevem o traçado:
 *   retas longas facilitam a ultrapassagem e valorizam o motor; trechos
 *   travados valorizam o chassi; asfalto abrasivo e curvas de raio longo
 *   desgastam mais os pneus.
 */
export const TRACKS: readonly Track[] = [
  {
    id: 'vale-do-sol', name: 'Kartódromo Vale do Sol', city: 'Atibaia', state: 'SP',
    lengthMeters: 1120, baseLapTime: 48.6, laps: 22,
    overtakingDifficulty: 0.45, tyreWear: 1.0, powerSensitivity: 0.5,
    rainChance: 0.4, baseTrackTemp: 34,
    description: 'Traçado completo e equilibrado. Boa abertura de temporada para medir forças.',
  },
  {
    id: 'lagoa-azul', name: 'Circuito Lagoa Azul', city: 'Curitiba', state: 'PR',
    lengthMeters: 980, baseLapTime: 44.2, laps: 24,
    overtakingDifficulty: 0.6, tyreWear: 0.85, powerSensitivity: 0.35,
    rainChance: 0.35, baseTrackTemp: 26,
    description: 'Sinuoso e técnico. O chassi fala mais alto que o motor, e ultrapassar exige paciência.',
  },
  {
    id: 'serra-gaucha', name: 'Kartódromo Serra Gaúcha', city: 'Caxias do Sul', state: 'RS',
    lengthMeters: 1210, baseLapTime: 52.1, laps: 20,
    overtakingDifficulty: 0.4, tyreWear: 1.05, powerSensitivity: 0.55,
    rainChance: 0.4, baseTrackTemp: 20,
    description: 'Subidas e descidas fortes. Frio e chuva frequentes, em que a sensibilidade do piloto faz diferença.',
  },
  {
    id: 'planalto', name: 'Autódromo de Kart do Planalto', city: 'Brasília', state: 'DF',
    lengthMeters: 1300, baseLapTime: 54.8, laps: 19,
    overtakingDifficulty: 0.3, tyreWear: 1.1, powerSensitivity: 0.7,
    rainChance: 0.15, baseTrackTemp: 33,
    description: 'Retas longas e muito vácuo. Motor forte e boas ultrapassagens garantem corridas movimentadas.',
  },
  {
    id: 'mantiqueira', name: 'Kartódromo da Mantiqueira', city: 'São José dos Campos', state: 'SP',
    lengthMeters: 1050, baseLapTime: 46.9, laps: 23,
    overtakingDifficulty: 0.5, tyreWear: 0.95, powerSensitivity: 0.45,
    rainChance: 0.15, baseTrackTemp: 27,
    description: 'Ritmo constante e curvas de média velocidade. Quem erra pouco leva vantagem.',
  },
  {
    id: 'litoral-norte', name: 'Circuito Litoral Norte', city: 'Joinville', state: 'SC',
    lengthMeters: 1150, baseLapTime: 49.7, laps: 21,
    overtakingDifficulty: 0.42, tyreWear: 1.0, powerSensitivity: 0.5,
    rainChance: 0.45, baseTrackTemp: 22,
    description: 'Clima úmido e imprevisível. Um dos traçados mais chuvosos do calendário.',
  },
  {
    id: 'triangulo', name: 'Kartódromo do Triângulo', city: 'Uberlândia', state: 'MG',
    lengthMeters: 1250, baseLapTime: 53.0, laps: 20,
    overtakingDifficulty: 0.35, tyreWear: 1.3, powerSensitivity: 0.6,
    rainChance: 0.05, baseTrackTemp: 38,
    description: 'Asfalto abrasivo e calor extremo. A gestão de pneus decide a corrida.',
  },
  {
    id: 'pampas', name: 'Circuito dos Pampas', city: 'Santa Maria', state: 'RS',
    lengthMeters: 1080, baseLapTime: 47.5, laps: 22,
    overtakingDifficulty: 0.55, tyreWear: 0.9, powerSensitivity: 0.4,
    rainChance: 0.4, baseTrackTemp: 15,
    description: 'Inverno gaúcho, com asfalto frio e pouca aderência. Erros são caros.',
  },
  {
    id: 'cerrado-paulista', name: 'Kartódromo Cerrado Paulista', city: 'Ribeirão Preto', state: 'SP',
    lengthMeters: 1180, baseLapTime: 50.4, laps: 21,
    overtakingDifficulty: 0.38, tyreWear: 1.2, powerSensitivity: 0.6,
    rainChance: 0.1, baseTrackTemp: 36,
    description: 'Seco e quente, com duas retas de vácuo. Favorece quem ataca com inteligência.',
  },
  {
    id: 'guanabara', name: 'Kartódromo Guanabara', city: 'Rio de Janeiro', state: 'RJ',
    lengthMeters: 1140, baseLapTime: 49.2, laps: 22,
    overtakingDifficulty: 0.48, tyreWear: 1.05, powerSensitivity: 0.5,
    rainChance: 0.3, baseTrackTemp: 31,
    description: 'Grande final. Traçado completo, no qual todos os atributos são postos à prova.',
  },
];

/**
 * Datas do calendário (mês e dia), com intervalo de três semanas entre as
 * etapas, de março a setembro. A ordem das pistas segue a ordem de TRACKS.
 */
export const CALENDAR_DATES: readonly string[] = [
  '03-08', '03-29', '04-19', '05-10', '05-31', '06-21', '07-12', '08-02', '08-23', '09-13',
];

export function getTrack(trackId: string): Track {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) throw new Error(`Pista desconhecida: ${trackId}`);
  return track;
}
