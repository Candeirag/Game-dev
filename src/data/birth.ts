/**
 * Textos do nascimento (Fase 2): cidades, profissões dos pais, aptidões, talentos e defeitos e as
 * origens da família. Só nomes e descrições; os números ficam em `src/config/balance.ts` (BIRTH,
 * APTITUDE_LINKS, APTITUDE_EFFECTS, TRAIT_EFFECTS) e as regras em `src/engine/birth/`.
 *
 * As listas entram no sorteio pela ordem: acrescentar no fim é seguro para carreiras novas, mas
 * mudar a ordem ou os ids muda o nascimento de quem sortear com a mesma semente.
 */
import type { AptitudeKey, BirthOrigin, TraitId } from '@/domain/schemas';

export interface Hometown {
  id: string;
  name: string;
  region: 'capital' | 'interior';
  /** Complemento para as frases: "zona sul de São Paulo", "interior de São Paulo". */
  detail: string;
}

/** Bairros da periferia da capital e cidades do interior paulista. */
export const HOMETOWNS: readonly Hometown[] = [
  { id: 'capao-redondo', name: 'Capão Redondo', region: 'capital', detail: 'zona sul de São Paulo' },
  { id: 'itaquera', name: 'Itaquera', region: 'capital', detail: 'zona leste de São Paulo' },
  { id: 'brasilandia', name: 'Brasilândia', region: 'capital', detail: 'zona norte de São Paulo' },
  { id: 'grajau', name: 'Grajaú', region: 'capital', detail: 'extremo sul de São Paulo' },
  { id: 'cidade-tiradentes', name: 'Cidade Tiradentes', region: 'capital', detail: 'zona leste de São Paulo' },
  { id: 'heliopolis', name: 'Heliópolis', region: 'capital', detail: 'zona sul de São Paulo' },
  { id: 'sao-mateus', name: 'São Mateus', region: 'capital', detail: 'zona leste de São Paulo' },
  { id: 'perus', name: 'Perus', region: 'capital', detail: 'zona noroeste de São Paulo' },
  { id: 'campinas', name: 'Campinas', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'ribeirao-preto', name: 'Ribeirão Preto', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'sorocaba', name: 'Sorocaba', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'bauru', name: 'Bauru', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'sao-jose-do-rio-preto', name: 'São José do Rio Preto', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'piracicaba', name: 'Piracicaba', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'presidente-prudente', name: 'Presidente Prudente', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'marilia', name: 'Marília', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'araraquara', name: 'Araraquara', region: 'interior', detail: 'interior de São Paulo' },
  { id: 'franca', name: 'Franca', region: 'interior', detail: 'interior de São Paulo' },
];

export interface Profession {
  id: string;
  name: string;
  /** Faixa de renda (1 a 3). Quanto a família ajuda sai da soma das duas faixas (ver BIRTH). */
  income: 1 | 2 | 3;
}

/** Profissões da mãe. */
export const MOTHER_PROFESSIONS: readonly Profession[] = [
  { id: 'diarista', name: 'Diarista', income: 1 },
  { id: 'vendedora-ambulante', name: 'Vendedora ambulante', income: 1 },
  { id: 'manicure', name: 'Manicure', income: 1 },
  { id: 'costureira', name: 'Costureira', income: 2 },
  { id: 'cozinheira', name: 'Cozinheira', income: 2 },
  { id: 'caixa-de-supermercado', name: 'Caixa de supermercado', income: 2 },
  { id: 'cuidadora-de-idosos', name: 'Cuidadora de idosos', income: 2 },
  { id: 'auxiliar-de-enfermagem', name: 'Auxiliar de enfermagem', income: 3 },
  { id: 'professora', name: 'Professora da rede pública', income: 3 },
];

/** Profissões do pai. */
export const FATHER_PROFESSIONS: readonly Profession[] = [
  { id: 'servente-de-obra', name: 'Servente de obra', income: 1 },
  { id: 'entregador', name: 'Entregador', income: 1 },
  { id: 'feirante', name: 'Feirante', income: 1 },
  { id: 'pedreiro', name: 'Pedreiro', income: 2 },
  { id: 'porteiro', name: 'Porteiro', income: 2 },
  { id: 'vigilante', name: 'Vigilante', income: 2 },
  { id: 'operario', name: 'Operário de fábrica', income: 2 },
  { id: 'motorista-de-onibus', name: 'Motorista de ônibus', income: 3 },
  { id: 'eletricista', name: 'Eletricista', income: 3 },
];

/** Rótulo e explicação de cada aptidão de corpo e mente. */
export const APTITUDE_INFO: Readonly<Record<AptitudeKey, { label: string; description: string }>> = {
  reflexes: { label: 'Reflexo', description: 'Velocidade e ultrapassagem na ficha; reação na largada.' },
  physique: { label: 'Físico', description: 'Concentração e chuva na ficha; aguenta provas longas e pista molhada.' },
  intelligence: { label: 'Inteligência', description: 'Leitura de corrida e gestão de pneus na ficha.' },
  composure: { label: 'Frieza', description: 'Consistência e defesa na ficha; firme nas disputas e na última volta.' },
  charisma: { label: 'Carisma', description: 'Atrai patrocinadores e os mantém satisfeitos.' },
};

/** A ordem em que as aptidões aparecem (e são reveladas) na ficha. */
export const APTITUDE_ORDER: readonly AptitudeKey[] = ['reflexes', 'physique', 'intelligence', 'composure', 'charisma'];

export interface TraitInfo {
  id: TraitId;
  kind: 'talent' | 'defect';
  name: string;
  /** O que o traço faz, para a ficha depois de revelado. */
  description: string;
  /** Quando o jogo o revela: aparece na ficha só depois. */
  reveal: string;
  /** O traço oposto: os dois nunca vêm juntos. */
  opposite: TraitId;
}

/** Talentos e defeitos ocultos: oito pares, cada talento com o seu defeito oposto. */
export const BIRTH_TRAITS: Readonly<Record<TraitId, TraitInfo>> = {
  rainMaster: {
    id: 'rainMaster',
    kind: 'talent',
    name: 'Gênio na chuva',
    description: 'Mais rápido e mais seguro com a pista molhada.',
    reveal: 'na primeira corrida com pista molhada',
    opposite: 'rainFear',
  },
  rainFear: {
    id: 'rainFear',
    kind: 'defect',
    name: 'Medo de chuva',
    description: 'Perde tempo e erra mais com a pista molhada.',
    reveal: 'na primeira corrida com pista molhada',
    opposite: 'rainMaster',
  },
  bornStarter: {
    id: 'bornStarter',
    kind: 'talent',
    name: 'Largador nato',
    description: 'Reage rápido à luz verde e ganha posições na largada.',
    reveal: 'na primeira largada em que ganhar duas posições ou mais',
    opposite: 'slowStarter',
  },
  slowStarter: {
    id: 'slowStarter',
    kind: 'defect',
    name: 'Largada sonolenta',
    description: 'Demora a reagir à luz verde e perde posições na largada.',
    reveal: 'na primeira largada em que perder duas posições ou mais',
    opposite: 'bornStarter',
  },
  tyreSaver: {
    id: 'tyreSaver',
    kind: 'talent',
    name: 'Poupador de pneus',
    description: 'Gasta menos os pneus: rende mais no fim da corrida.',
    reveal: 'na primeira corrida completa numa pista de alto desgaste',
    opposite: 'tyreEater',
  },
  tyreEater: {
    id: 'tyreEater',
    kind: 'defect',
    name: 'Gastador de pneus',
    description: 'Gasta mais os pneus: perde rendimento no fim da corrida.',
    reveal: 'na primeira corrida completa numa pista de alto desgaste',
    opposite: 'tyreSaver',
  },
  quickLearner: {
    id: 'quickLearner',
    kind: 'talent',
    name: 'Aprende rápido',
    description: 'Tira mais de cada semana de treino.',
    reveal: 'no balanço da primeira temporada',
    opposite: 'slowLearner',
  },
  slowLearner: {
    id: 'slowLearner',
    kind: 'defect',
    name: 'Aprende devagar',
    description: 'Tira menos de cada semana de treino.',
    reveal: 'no balanço da primeira temporada',
    opposite: 'quickLearner',
  },
  qualifyingKing: {
    id: 'qualifyingKing',
    kind: 'talent',
    name: 'Rei da classificação',
    description: 'Encontra um décimo a mais na volta lançada.',
    reveal: 'na primeira classificação à frente do companheiro de equipe',
    opposite: 'qualifyingNerves',
  },
  qualifyingNerves: {
    id: 'qualifyingNerves',
    kind: 'defect',
    name: 'Trava na classificação',
    description: 'Deixa tempo na pista quando a volta precisa sair perfeita.',
    reveal: 'na primeira classificação atrás do companheiro de equipe',
    opposite: 'qualifyingKing',
  },
  ironBody: {
    id: 'ironBody',
    kind: 'talent',
    name: 'Corpo de ferro',
    description: 'Sai inteiro de batidas que lesionariam outros pilotos.',
    reveal: 'na primeira batida',
    opposite: 'fragile',
  },
  fragile: {
    id: 'fragile',
    kind: 'defect',
    name: 'Frágil',
    description: 'Uma batida forte tem mais chance de virar lesão.',
    reveal: 'na primeira batida',
    opposite: 'ironBody',
  },
  cleanRacer: {
    id: 'cleanRacer',
    kind: 'talent',
    name: 'Piloto limpo',
    description: 'Disputa roda a roda sem se tocar: raramente bate numa ultrapassagem.',
    reveal: 'no primeiro toque',
    opposite: 'hothead',
  },
  hothead: {
    id: 'hothead',
    kind: 'defect',
    name: 'Esquentado',
    description: 'Ataca com vontade demais: mais toques nas disputas.',
    reveal: 'no primeiro toque',
    opposite: 'cleanRacer',
  },
  bigStage: {
    id: 'bigStage',
    kind: 'talent',
    name: 'Brilha nas estreias',
    description: 'Cresce na primeira corrida numa categoria ou equipe nova.',
    reveal: 'na estreia',
    opposite: 'debutNerves',
  },
  debutNerves: {
    id: 'debutNerves',
    kind: 'defect',
    name: 'Nervoso em estreias',
    description: 'Erra mais e anda menos na primeira corrida numa categoria ou equipe nova.',
    reveal: 'na estreia',
    opposite: 'bigStage',
  },
};

export interface OriginInfo {
  id: BirthOrigin;
  name: string;
  summary: string;
  /** O que a origem dá e o que ela cobra, para os cards. */
  perks: readonly string[];
  drawbacks: readonly string[];
  /** Só na versão premium (ainda bloqueada). */
  premium: boolean;
}

/** As origens possíveis. No jogo grátis só a família humilde está aberta. */
export const BIRTH_ORIGIN_INFO: Readonly<Record<BirthOrigin, OriginInfo>> = {
  humble: {
    id: 'humble',
    name: 'Família humilde',
    summary: 'Nasce no Brasil, numa família que aperta o orçamento para pagar o kart.',
    perks: ['Ninguém espera nada de você'],
    drawbacks: ['Pouco dinheiro da família, por pouco tempo'],
    premium: false,
  },
  'racer-parent': {
    id: 'racer-parent',
    name: 'Filho de ex-piloto',
    summary: 'O sobrenome abre portas no paddock.',
    perks: ['Contatos nas equipes', 'Reputação inicial maior'],
    drawbacks: ['Comparação constante com o pai'],
    premium: true,
  },
  'business-parent': {
    id: 'business-parent',
    name: 'Filho de empresário',
    summary: 'Dinheiro não falta para começar.',
    perks: ['Muito dinheiro inicial'],
    drawbacks: ['Fama de "filhinho de papai"'],
    premium: true,
  },
  'mechanic-parent': {
    id: 'mechanic-parent',
    name: 'Filho de mecânico',
    summary: 'Cresceu dentro da oficina.',
    perks: ['Aprende acerto mais rápido'],
    drawbacks: ['Pouco dinheiro'],
    premium: true,
  },
  abroad: {
    id: 'abroad',
    name: 'Nascer em outro país',
    summary: 'Começa a carreira longe do Brasil.',
    perks: ['Escolha do país de nascimento'],
    drawbacks: ['Outra moeda, outra escada'],
    premium: true,
  },
};

/** A ordem dos cards das origens. */
export const BIRTH_ORIGIN_ORDER: readonly BirthOrigin[] = ['humble', 'racer-parent', 'business-parent', 'mechanic-parent', 'abroad'];
