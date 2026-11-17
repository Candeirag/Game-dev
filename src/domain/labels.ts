/** Rótulos em português, compartilhados pelas mensagens do motor e pela interface. */
import type { AttributeKey, DnfReason, PracticeProgram, QualifyingApproach, RaceMode, TrainingFocus, WeatherCondition } from './schemas';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  pace: 'Velocidade',
  consistency: 'Consistência',
  overtaking: 'Ultrapassagem',
  defending: 'Defesa',
  focus: 'Concentração',
  racecraft: 'Inteligência de corrida',
  tyreManagement: 'Gestão de pneus',
  wetSkill: 'Chuva',
  experience: 'Experiência',
};

export const ATTRIBUTE_DESCRIPTIONS: Record<AttributeKey, string> = {
  pace: 'Velocidade pura em uma volta. É o atributo que mais pesa no tempo de volta.',
  consistency: 'Regularidade volta após volta. Reduz a variação dos tempos e a chance de erro.',
  overtaking: 'Capacidade de completar ultrapassagens.',
  defending: 'Capacidade de segurar a posição quando atacado.',
  focus: 'Resistência ao cansaço mental: evita que o ritmo caia e os erros aumentem no fim da corrida. Também ajuda na largada.',
  racecraft: 'Leitura de corrida: contribui para o ritmo, melhora o retorno de acerto e reduz o risco de toques.',
  tyreManagement: 'Preserva os pneus, mantendo o ritmo nas voltas finais.',
  wetSkill: 'Desempenho com pista úmida ou molhada. Na chuva, substitui parte da velocidade.',
  experience: 'Cresce competindo. Melhora o ritmo, a largada e a qualidade do acerto.',
};

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  speed: 'Velocidade',
  racecraft: 'Disputa e estratégia',
  consistency: 'Consistência mental',
  tyres: 'Gestão de pneus',
  wet: 'Pilotagem na chuva',
  balanced: 'Equilibrado',
};

export const TRAINING_FOCUS_DESCRIPTIONS: Record<TrainingFocus, string> = {
  speed: 'Simulador e treinos de volta rápida. Foco em Velocidade e Ultrapassagem.',
  racecraft: 'Treinos de disputa roda a roda. Foco em Inteligência de corrida, Defesa e Ultrapassagem.',
  consistency: 'Preparação física e mental. Foco em Consistência e Concentração.',
  tyres: 'Stints longos de corrida. Foco em Gestão de pneus.',
  wet: 'Treinos em pista molhada. Foco em Chuva.',
  balanced: 'Ganho pequeno, distribuído por todos os atributos.',
};

export const PRACTICE_PROGRAM_LABELS: Record<PracticeProgram, string> = {
  setup: 'Trabalho de acerto',
  qualifying: 'Simulação de classificação',
  longRun: 'Ritmo de corrida',
};

export const PRACTICE_PROGRAM_DESCRIPTIONS: Record<PracticeProgram, string> = {
  setup: 'Prioriza o acerto do equipamento. É o maior ganho de ritmo, valendo para a classificação e para a corrida.',
  qualifying: 'Voltas lançadas com pneus novos. Garante uma volta mais rápida na classificação.',
  longRun: 'Stints longos. Reduz em 15% o desgaste de pneus na corrida, o que é decisivo em pistas abrasivas.',
};

export const QUALIFYING_APPROACH_LABELS: Record<QualifyingApproach, string> = {
  safe: 'Segura',
  balanced: 'Equilibrada',
  attack: 'Ataque total',
};

export const QUALIFYING_APPROACH_DESCRIPTIONS: Record<QualifyingApproach, string> = {
  safe: 'Margem de segurança: um pouco mais lento, mas com metade do risco de errar.',
  balanced: 'Equilíbrio entre risco e velocidade.',
  attack: 'Volta no limite: mais rápida, mas com quase o dobro do risco de invalidar a tentativa.',
};

export const RACE_MODE_LABELS: Record<RaceMode, string> = {
  conservative: 'Conservador',
  balanced: 'Equilibrado',
  aggressive: 'Agressivo',
};

export const RACE_MODE_DESCRIPTIONS: Record<RaceMode, string> = {
  conservative: 'Poupa pneus e erra menos, mas perde ritmo e quase não ataca.',
  balanced: 'Ritmo normal.',
  aggressive: 'Mais ritmo e ataque, mas gasta mais pneus e aumenta o risco de erros e toques.',
};

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  dry: 'Seco',
  damp: 'Úmido',
  wet: 'Chuva',
};

export const DNF_LABELS: Record<DnfReason, string> = {
  crash: 'Acidente',
  mechanical: 'Mecânico',
  collision: 'Toque',
  fuel: 'Sem combustível',
  damage: 'Danos',
};

export function ordinal(n: number): string {
  return `${n}º`;
}

export const TRAINING_INTENSITY_LABELS: Record<import('./schemas').TrainingIntensity, string> = {
  light: 'Leve',
  normal: 'Normal',
  intense: 'Intenso',
};

export const TRAINING_INTENSITY_DESCRIPTIONS: Record<import('./schemas').TrainingIntensity, string> = {
  light: 'Ganho de 60% e custo baixo. Recupera a fase (+2 por etapa).',
  normal: 'Ganho e custo normais.',
  intense: 'Ganho de 140%, mas custa mais que o dobro, desgasta a fase (−2 por etapa) e traz 1,5% de risco de lesão leve por etapa.',
};

export const EVENT_CATEGORY_LABELS: Record<import('./schemas').EventCategory, string> = {
  interview: 'Entrevista',
  controversy: 'Polêmica',
  rivalry: 'Rivalidade',
  investigation: 'Investigação',
  protest: 'Protesto',
  contract: 'Contrato',
  sponsor: 'Patrocínio',
  unexpected: 'Inesperado',
  family: 'Família',
  management: 'Gestão',
};

export const OFFER_KIND_LABELS: Record<import('./schemas').Offer['kind'], string> = {
  continue: 'Contrato vigente',
  renewal: 'Renovação',
  transfer: 'Transferência',
  promotion: 'Promoção',
  demotion: 'Categoria abaixo',
  fallback: 'Vaga de aluguel',
};

export const LEDGER_LABELS: Record<import('./schemas').LedgerKey, string> = {
  salary: 'Salário',
  sponsors: 'Patrocínios',
  bonus: 'Bônus',
  academy: 'Apoio da academia',
  investment: 'Rendimento de investimentos',
  seat: 'Custo da vaga',
  living: 'Custo de vida e estrutura',
  training: 'Treino',
  damage: 'Danos',
  tax: 'Impostos',
  interest: 'Juros',
  release: 'Multas rescisórias',
  event: 'Eventos',
  dividends: 'Dividendos',
  rent: 'Imóveis (aluguel e manutenção)',
  business: 'Empresas',
  loan: 'Empréstimos',
  assets: 'Compra e venda de ativos',
  family: 'Família',
  team: 'Equipe própria',
  inheritance: 'Herança',
  travel: 'Viagens',
  housing: 'Aluguel no polo',
  equipment: 'Equipamento',
  moving: 'Mudança de polo',
  job: 'Trabalho paralelo',
  investor: 'Investidor',
  crowdfund: 'Vaquinha da cidade',
};

export const ROLE_LABELS: Record<import('./schemas').DriverRole, string> = {
  first: 'Primeiro piloto',
  second: 'Segundo piloto',
  reserve: 'Reserva',
};

/* ---------------- Fase 3 ---------------- */

export const LIFESTYLE_LABELS: Record<import('./schemas').Lifestyle, string> = {
  frugal: 'Simples',
  comfortable: 'Confortável',
  luxury: 'Luxo',
};

export const SUPPORT_LABELS: Record<import('./schemas').SupportLevel, string> = {
  none: 'Nenhum',
  basic: 'Parcial',
  full: 'Total',
};

export const CHILD_STAGE_LABELS: Record<import('./schemas').Child['stage'], string> = {
  child: 'Criança',
  karting: 'Formação no kart',
  racing: 'Piloto',
  other: 'Fora das pistas',
};

export const STAFF_ROLE_LABELS: Record<import('./schemas').StaffRole, string> = {
  principal: 'Chefe de equipe',
  technicalDirector: 'Diretor técnico',
  sportingDirector: 'Diretor esportivo',
  chiefEngineer: 'Engenheiro-chefe',
  chiefMechanic: 'Chefe dos mecânicos',
};

export const DEV_AREA_LABELS: Record<import('./schemas').DevArea, string> = {
  aero: 'Aerodinâmica',
  chassis: 'Chassi',
  engine: 'Motor',
  suspension: 'Suspensão',
  manufacturing: 'Fabricação',
};

export const RESEARCH_SPEND_LABELS: Record<import('./schemas').ResearchSpend, string> = {
  low: 'Contido',
  medium: 'Normal',
  high: 'Agressivo',
};

export const TEAM_LEDGER_LABELS: Record<string, string> = {
  sponsors: 'Patrocínios',
  seats: 'Vagas pagas pelos pilotos',
  prize: 'Prêmios',
  owner: 'Aportes e retiradas do dono',
  drivers: 'Salários dos pilotos',
  staff: 'Equipe técnica',
  principal: 'Salário do chefe de equipe',
  operations: 'Operação',
  facilities: 'Instalações',
  research: 'Pesquisa e desenvolvimento',
  damage: 'Danos',
  event: 'Eventos',
};

export const SUCCESSION_CAUSE_LABELS: Record<import('./schemas').Succession['cause'], string> = {
  death: 'Falecimento',
  accident: 'Acidente fatal',
  handover: 'Passagem de comando',
};
