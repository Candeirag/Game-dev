import type { Track } from '@/domain/schemas';
import type { CategoryDefinition } from './categories';

/**
 * Os 10 kartódromos do calendário. Os nomes são fictícios; cada pista fica na
 * cidade do kartódromo real que serve de referência para o traçado
 * (src/data/kartLayouts.ts), e o clima segue a realidade de cada região.
 * Os identificadores são os de sempre: os saves guardam só o id da pista.
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
export const BR_KART_TRACKS: readonly Track[] = [
  {
    id: 'vale-do-sol',
    name: 'Kartódromo Vale do Sol',
    city: 'Cotia',
    state: 'SP',
    country: 'BR',
    lengthMeters: 1120,
    baseLapTime: 48.6,
    laps: 22,
    overtakingDifficulty: 0.45,
    tyreWear: 1.0,
    powerSensitivity: 0.5,
    rainChance: 0.4,
    baseTrackTemp: 34,
    description: 'Traçado completo e equilibrado. Boa abertura de temporada para medir forças.',
  },
  {
    id: 'lagoa-azul',
    name: 'Circuito Lagoa Azul',
    city: 'Londrina',
    state: 'PR',
    country: 'BR',
    lengthMeters: 980,
    baseLapTime: 44.2,
    laps: 24,
    overtakingDifficulty: 0.6,
    tyreWear: 0.85,
    powerSensitivity: 0.35,
    rainChance: 0.35,
    baseTrackTemp: 26,
    description: 'Sinuoso e técnico. O chassi fala mais alto que o motor, e ultrapassar exige paciência.',
  },
  {
    id: 'serra-gaucha',
    name: 'Kartódromo Vale dos Sinos',
    city: 'Nova Santa Rita',
    state: 'RS',
    country: 'BR',
    lengthMeters: 1210,
    baseLapTime: 52.1,
    laps: 20,
    overtakingDifficulty: 0.4,
    tyreWear: 1.05,
    powerSensitivity: 0.55,
    rainChance: 0.4,
    baseTrackTemp: 20,
    description: 'Longo, com retas e freadas fortes. Frio e chuva frequentes, em que a sensibilidade do piloto faz diferença.',
  },
  {
    id: 'planalto',
    name: 'Autódromo de Kart do Planalto',
    city: 'Brasília',
    state: 'DF',
    country: 'BR',
    lengthMeters: 1300,
    baseLapTime: 54.8,
    laps: 19,
    overtakingDifficulty: 0.3,
    tyreWear: 1.1,
    powerSensitivity: 0.7,
    rainChance: 0.15,
    baseTrackTemp: 33,
    description: 'Retas longas e muito vácuo. Motor forte e boas ultrapassagens garantem corridas movimentadas.',
  },
  {
    id: 'mantiqueira',
    name: 'Kartódromo das Represas',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    lengthMeters: 1050,
    baseLapTime: 46.9,
    laps: 23,
    overtakingDifficulty: 0.5,
    tyreWear: 0.95,
    powerSensitivity: 0.45,
    rainChance: 0.15,
    baseTrackTemp: 27,
    description: 'Ritmo constante e curvas de média velocidade. Quem erra pouco leva vantagem.',
  },
  {
    id: 'litoral-norte',
    name: 'Circuito Litoral Norte',
    city: 'Joinville',
    state: 'SC',
    country: 'BR',
    lengthMeters: 1150,
    baseLapTime: 49.7,
    laps: 21,
    overtakingDifficulty: 0.42,
    tyreWear: 1.0,
    powerSensitivity: 0.5,
    rainChance: 0.45,
    baseTrackTemp: 22,
    description: 'Clima úmido e imprevisível. Um dos traçados mais chuvosos do calendário.',
  },
  {
    id: 'triangulo',
    name: 'Kartódromo do Triângulo',
    city: 'Uberlândia',
    state: 'MG',
    country: 'BR',
    lengthMeters: 1250,
    baseLapTime: 53.0,
    laps: 20,
    overtakingDifficulty: 0.35,
    tyreWear: 1.3,
    powerSensitivity: 0.6,
    rainChance: 0.05,
    baseTrackTemp: 38,
    description: 'Asfalto abrasivo e calor extremo. A gestão de pneus decide a corrida.',
  },
  {
    id: 'pampas',
    name: 'Circuito dos Pampas',
    city: 'Viamão',
    state: 'RS',
    country: 'BR',
    lengthMeters: 1080,
    baseLapTime: 47.5,
    laps: 22,
    overtakingDifficulty: 0.55,
    tyreWear: 0.9,
    powerSensitivity: 0.4,
    rainChance: 0.4,
    baseTrackTemp: 15,
    description: 'Inverno gaúcho, com asfalto frio e pouca aderência. Erros são caros.',
  },
  {
    id: 'cerrado-paulista',
    name: 'Kartódromo Cerrado Paulista',
    city: 'Birigui',
    state: 'SP',
    country: 'BR',
    lengthMeters: 1180,
    baseLapTime: 50.4,
    laps: 21,
    overtakingDifficulty: 0.38,
    tyreWear: 1.2,
    powerSensitivity: 0.6,
    rainChance: 0.1,
    baseTrackTemp: 36,
    description: 'Seco e quente, com duas retas de vácuo. Favorece quem ataca com inteligência.',
  },
  {
    id: 'guanabara',
    name: 'Kartódromo Guanabara',
    city: 'Guapimirim',
    state: 'RJ',
    country: 'BR',
    lengthMeters: 1140,
    baseLapTime: 49.2,
    laps: 22,
    overtakingDifficulty: 0.48,
    tyreWear: 1.05,
    powerSensitivity: 0.5,
    rainChance: 0.3,
    baseTrackTemp: 31,
    description: 'Grande final. Traçado completo, no qual todos os atributos são postos à prova.',
  },
];

type Row = [
  id: string,
  name: string,
  city: string,
  country: string,
  lengthMeters: number,
  baseLapTime: number,
  laps: number,
  overtakingDifficulty: number,
  tyreWear: number,
  powerSensitivity: number,
  rainChance: number,
  baseTrackTemp: number,
  description: string,
];

const fromRows = (rows: readonly Row[]): Track[] =>
  rows.map(
    ([id, name, city, country, lengthMeters, baseLapTime, laps, overtakingDifficulty, tyreWear, powerSensitivity, rainChance, baseTrackTemp, description]) => ({
      id,
      name,
      city,
      state: '',
      country,
      lengthMeters,
      baseLapTime,
      laps,
      overtakingDifficulty,
      tyreWear,
      powerSensitivity,
      rainChance,
      baseTrackTemp,
      description,
    }),
  );

/**
 * Pistas do kart internacional. Nomes fictícios em cidades com tradição real
 * no kartismo; o traçado é o do kartódromo real de cada cidade (menos Al Ain,
 * sem traçado mapeado, que continua gerado por regras). Os critérios dos
 * números são os mesmos das pistas brasileiras.
 */
export const WORLD_KART_TRACKS: readonly Track[] = fromRows([
  ['garda', 'Pista do Lago de Garda', 'Lonato', 'IT', 1200, 46.5, 22, 0.45, 1.0, 0.5, 0.2, 28, 'O templo do kart europeu: técnica, rápida e sempre lotada.'],
  ['limburg', 'Kartódromo de Limburgo', 'Genk', 'BE', 1360, 52.0, 20, 0.4, 1.0, 0.55, 0.4, 20, 'Traçado fluido e clima belga: a chuva aparece sem avisar.'],
  [
    'sarthe-kart',
    'Circuito de Kart do Sarthe',
    'Le Mans',
    'FR',
    1384,
    53.5,
    19,
    0.38,
    1.05,
    0.6,
    0.3,
    24,
    'Retas longas ao lado do circuito das 24 Horas. Vácuo decide.',
  ],
  ['zuera', 'Circuito de Aragão', 'Zuera', 'ES', 1700, 61.0, 17, 0.3, 1.2, 0.7, 0.08, 38, 'O mais longo e veloz do calendário, sob calor seco.'],
  ['wackersdorf', 'Arena da Baviera', 'Wackersdorf', 'DE', 1190, 47.5, 22, 0.55, 0.9, 0.4, 0.35, 22, 'Travado e exigente: largar na frente vale ouro.'],
  ['kristianstad', 'Pista da Escânia', 'Kristianstad', 'SE', 1221, 48.8, 21, 0.5, 0.9, 0.45, 0.35, 18, 'Asfalto frio e pouca aderência no verão sueco.'],
  [
    'pfi',
    'Circuito de Lincolnshire',
    'Grantham',
    'GB',
    1382,
    54.0,
    19,
    0.45,
    1.0,
    0.5,
    0.45,
    18,
    'Ponte, túnel e tempo inglês: quase metade das provas tem pista molhada.',
  ],
  [
    'portimao-kart',
    'Kartódromo do Algarve',
    'Portimão',
    'PT',
    1531,
    58.0,
    18,
    0.4,
    1.15,
    0.55,
    0.1,
    34,
    'Sobe e desce com curvas longas que castigam os pneus.',
  ],
  ['franciacorta', 'Pista da Lombardia', 'Castrezzato', 'IT', 1300, 50.5, 20, 0.5, 0.95, 0.45, 0.25, 26, 'Moderna e equilibrada, palco de decisões de título.'],
  ['al-ain', 'Circuito do Oásis', 'Al Ain', 'AE', 1600, 60.0, 17, 0.35, 1.25, 0.6, 0.02, 40, 'Final no deserto: calor extremo e desgaste alto.'],
]);

/**
 * Autódromos dos monopostos. Nomes fictícios em cidades reais. O tempo de
 * referência é o do Monoposto Grand Prix; cada categoria aplica o seu fator. O campo "laps"
 * não é usado aqui: o número de voltas vem da duração da prova na categoria.
 */
export const CIRCUITS: readonly Track[] = fromRows([
  [
    'sao-paulo',
    'Autódromo Paulista',
    'São Paulo',
    'BR',
    4309,
    71.0,
    1,
    0.35,
    1.0,
    0.55,
    0.4,
    38,
    'Curto, em sentido anti-horário, com subida longa até a reta. Chuva de verão é comum.',
  ],
  ['melbourne', 'Circuito do Lago', 'Melbourne', 'AU', 5278, 79.0, 1, 0.5, 0.95, 0.55, 0.2, 32, 'Semipermanente e rápido, com muros próximos.'],
  [
    'imola',
    'Autódromo da Emília',
    'Ímola',
    'IT',
    4909,
    76.5,
    1,
    0.65,
    0.95,
    0.5,
    0.25,
    30,
    'Estreito e à moda antiga: ultrapassar é difícil, errar custa caro.',
  ],
  ['barcelona', 'Circuito da Catalunha', 'Barcelona', 'ES', 4657, 73.5, 1, 0.6, 1.2, 0.45, 0.1, 40, 'Curvas longas de alta que devoram os pneus.'],
  ['monaco', 'Circuito do Principado', 'Monte Carlo', 'MC', 3337, 72.0, 1, 0.95, 0.75, 0.15, 0.15, 36, 'Ruas apertadas: a classificação decide quase tudo.'],
  ['montreal', 'Circuito da Ilha', 'Montreal', 'CA', 4361, 73.0, 1, 0.35, 0.9, 0.7, 0.3, 30, 'Retas, freadas fortes e muros: safety car frequente.'],
  ['silverstone', 'Circuito do Aeródromo', 'Silverstone', 'GB', 5891, 87.5, 1, 0.4, 1.25, 0.5, 0.35, 28, 'Curvas de altíssima velocidade e tempo instável.'],
  ['spa', 'Circuito das Ardenas', 'Spa', 'BE', 7004, 105.0, 1, 0.3, 1.05, 0.7, 0.45, 24, 'O mais longo do calendário. Pode chover em metade da pista.'],
  ['budapest', 'Anel do Danúbio', 'Budapeste', 'HU', 4381, 77.5, 1, 0.75, 1.0, 0.25, 0.15, 44, 'Travado e quente: um kartódromo gigante.'],
  ['monza', 'Autódromo do Parque Real', 'Monza', 'IT', 5793, 81.0, 1, 0.3, 0.9, 0.9, 0.2, 34, 'O templo da velocidade: motor e vácuo acima de tudo.'],
  ['singapura', 'Circuito da Marina', 'Singapura', 'SG', 4940, 91.5, 1, 0.8, 1.05, 0.3, 0.35, 34, 'Corrida noturna de rua, longa e fisicamente brutal.'],
  ['suzuka', 'Circuito do Oito', 'Suzuka', 'JP', 5807, 89.5, 1, 0.6, 1.2, 0.5, 0.3, 30, 'Traçado em oito, técnico e veloz: o preferido dos pilotos.'],
  ['austin', 'Circuito do Texas', 'Austin', 'US', 5513, 95.0, 1, 0.4, 1.15, 0.55, 0.15, 36, 'Subida cega na largada e sequência de esses de alta.'],
  ['abu-dhabi', 'Circuito do Golfo', 'Abu Dhabi', 'AE', 5281, 84.5, 1, 0.5, 0.95, 0.6, 0.02, 34, 'Final ao entardecer, praticamente sem chance de chuva.'],
]);

export const TRACKS: readonly Track[] = [...BR_KART_TRACKS, ...WORLD_KART_TRACKS, ...CIRCUITS];

export function getTrack(trackId: string): Track {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) throw new Error(`Pista desconhecida: ${trackId}`);
  return track;
}

/** Tempo de referência da pista para o equipamento da categoria. */
export function referenceLapTime(track: Track, category: CategoryDefinition): number {
  return track.baseLapTime * category.lapTimeFactor;
}

/** Número de voltas da corrida: fixo no kart; pela duração da prova nos monopostos. */
export function raceLaps(track: Track, category: CategoryDefinition): number {
  if (category.race.raceMinutes === null) return track.laps;
  return Math.max(8, Math.round((category.race.raceMinutes * 60) / referenceLapTime(track, category)));
}

/**
 * Datas das etapas (AAAA-MM-DD). A temporada começa em 8 de março. Com 10
 * etapas, o intervalo é de três semanas; campeonatos mais longos encurtam o
 * intervalo para terminar até novembro.
 */
export function calendarDates(year: number, rounds: number): string[] {
  const interval = rounds <= 10 ? 21 : Math.floor(230 / (rounds - 1));
  const start = Date.UTC(year, 2, 8);
  return Array.from({ length: rounds }, (_, i) => new Date(start + i * interval * 86_400_000).toISOString().slice(0, 10));
}
