/**
 * Formato dos dados dos eventos encadeados (Fase 5 da grande atualização).
 *
 * Os eventos são dados, não código: cada um diz quando pode aparecer (condições), quem o texto cita
 * (vínculos), o que cada escolha faz (efeitos por tamanho, nunca por número) e as variantes de
 * texto. O motor (`src/engine/story`) lê estes dados, sorteia de 1 a 3 cartões por etapa, monta o
 * texto com os nomes do momento e guarda na memória do save o que precisa ser lembrado: pessoas,
 * marcas de escolhas e cadeias em andamento.
 *
 * Regras que `tests/storyEvents.test.ts` confere em todos os arquivos de dados:
 * - nenhum texto se repete no catálogo inteiro (título, corpo, rótulo de escolha, desfecho);
 * - toda marca, pessoa, cadeia, passo e perfil citado existe e é criado antes de ser usado;
 * - todo marcador de texto (`{rival}`, `{pessoa:chefe-kart}`…) tem o vínculo declarado;
 * - toda cadeia tem pelo menos 3 passos num caminho, todo passo é alcançável e todo desfecho de
 *   passo termina a cadeia ou aponta para um passo que existe (sem ponta solta).
 *
 * Números não entram aqui: tamanhos, chances, prazos e pesos são nomes que apontam para as tabelas
 * `STORY_EVENTS` e `SPONSOR_PROFILE_RULES` de `src/config/balance.ts`.
 *
 * Marcadores de texto (o `^` na frente põe a primeira letra em maiúscula: `{^rival}`):
 * - sempre disponíveis: `{nome}` (primeiro nome do piloto), `{piloto}` (nome completo), `{equipe}`,
 *   `{categoria}` (nome da categoria; com `:the|de|em|a|para|por` sai com o artigo certo, como em
 *   `{categoria:em}` → "na Fórmula Júnior"), `{pista}` (a pista da etapa que acabou; no começo da
 *   temporada, a da primeira etapa), `{cidade}` (cidade ou bairro natal) e `{ano}`;
 * - com vínculo (veja `StoryNeed`): `{companheiro}`, `{rival}`, `{outro}`, `{lider}`,
 *   `{patrocinador}`, `{equipeInteressada}`, `{outraEquipe}`, `{valor}`, `{pontos}`, `{academia}`,
 *   `{equipeTopo}`, `{chance}`, `{meta}`;
 * - pessoas da memória: `{pessoa:CHAVE}` (nome completo), `{primeiro:CHAVE}` (primeiro nome) e
 *   `{org:CHAVE}` (equipe ou empresa a que ela está ligada).
 */
import type { AptitudeKey, AttributeKey, HubId, TraitId } from './schemas';

/* ---------------- Categorias e pesos ---------------- */

/** As cinco categorias dos cartões. O peso de cada uma no sorteio está em STORY_EVENTS.CATEGORY_WEIGHTS. */
export const STORY_CATEGORIES = ['track', 'career', 'money', 'health', 'personal'] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];

/** Frequência de um evento dentro da sua categoria (pesos em STORY_EVENTS.EVENT_WEIGHTS). */
export const STORY_FREQUENCIES = ['rare', 'normal', 'common'] as const;
export type StoryFrequency = (typeof STORY_FREQUENCIES)[number];

/**
 * Tamanho de um efeito, de −3 (perda grande) a +3 (ganho grande). O valor de cada degrau depende do
 * efeito e está em STORY_EVENTS (pontos de moral, fração do custo de vida, posições de grid…).
 */
export type StorySize = -3 | -2 | -1 | 1 | 2 | 3;

/** Chance de um desfecho (valores em STORY_EVENTS.ODDS). `rest` é o que sobra para chegar a 100%. */
export const STORY_ODDS = ['sure', 'likely', 'even', 'unlikely', 'rest', 'academy'] as const;
export type StoryOdds = (typeof STORY_ODDS)[number];

/** Prazo entre um passo de cadeia e o seguinte (valores em STORY_EVENTS.DELAYS). */
export const STORY_DELAYS = ['next', 'soon', 'later', 'nextSeason', 'twoSeasons', 'whenever'] as const;
export type StoryDelay = (typeof STORY_DELAYS)[number];

/** Faixas de caixa, medidas em custos de vida anuais da categoria (limites em STORY_EVENTS.CASH_LEVELS). */
export const STORY_CASH_LEVELS = ['broke', 'tight', 'comfortable', 'rich'] as const;
export type StoryCashLevel = (typeof STORY_CASH_LEVELS)[number];

/** Personalidade de um patrocinador: muda o quanto ele tolera resultado ruim e o tom dos textos. */
export const SPONSOR_PERSONALITIES = ['patient', 'demanding', 'vain', 'discreet', 'loyal', 'impulsive'] as const;
export type SponsorPersonality = (typeof SPONSOR_PERSONALITIES)[number];

/* ---------------- O que aconteceu na etapa ---------------- */

/**
 * Marcas da etapa recém-disputada, para eventos que reagem à corrida. Um evento com uma condição
 * `race` é "reativo" e ganha peso no sorteio (STORY_EVENTS.REACTIVE_BOOST).
 */
export const RACE_TAGS = [
  /** Venceu. */
  'win',
  /** Terminou entre os três primeiros (inclui a vitória). */
  'podium',
  /** Terminou e pontuou. */
  'points',
  /** Terminou sem pontos. */
  'noPoints',
  /** Abandonou, por qualquer motivo. */
  'dnf',
  /** Abandonou por erro próprio (batida ou falta de combustível). */
  'crash',
  /** Abandonou por quebra ou dano. */
  'mechanical',
  /** Se envolveu num toque com outro piloto. */
  'contact',
  /** No toque, o outro piloto foi quem atacou. */
  'contactVictim',
  /** No toque, quem atacou foi o jogador. */
  'contactCulprit',
  /** Recebeu punição na corrida (segundos ou pontos na licença). */
  'penalized',
  /** Não correu (lesão, suspensão ou descanso). */
  'absent',
  /** Largou na pole. */
  'pole',
  /** Ganhou muitas posições do grid à bandeirada (STORY_EVENTS.PLACES_SWING). */
  'gainedPlaces',
  /** Perdeu muitas posições do grid à bandeirada. */
  'lostPlaces',
  /** Terminou à frente do companheiro. */
  'beatTeammate',
  /** Terminou atrás do companheiro. */
  'behindTeammate',
  /** Corrida com pista molhada. */
  'wet',
  /** Venceu um lance decisivo arriscado (Fase 4). */
  'momentWon',
  /** Errou um lance decisivo (rodou, tocou ou abandonou). */
  'momentLost',
  /** Um toque num lance criou uma rivalidade nova nesta etapa (Fase 4). */
  'newRivalry',
  /** Se machucou na corrida. */
  'injured',
  /** Fez a volta mais rápida. */
  'fastestLap',
] as const;
export type RaceTag = (typeof RACE_TAGS)[number];

/** Momento da temporada: começo (antes da 1ª etapa), primeiro terço, meio, último terço, última etapa. */
export const SEASON_PARTS = ['start', 'early', 'middle', 'late', 'finale'] as const;
export type SeasonPart = (typeof SEASON_PARTS)[number];

/** Indicadores que um efeito `stat` mexe e uma condição `stat` lê (0 a 100). */
export const STORY_STATS = ['morale', 'confidence', 'form', 'reputation', 'teamTrust', 'teammateRelation'] as const;
export type StoryStat = (typeof STORY_STATS)[number];

/** Coisas que o piloto tem (ou não) agora. */
export const STORY_HAS = [
  'teammate',
  'rival',
  'commercialSponsor',
  'freeSponsorSlot',
  'unhappySponsor',
  'partner',
  'children',
  'injury',
  'academy',
  'seatCost',
  'investor',
  'sideJob',
  'interestedTeam',
  'debt',
  'loan',
  // Fase 6: quem veio antes era famoso (o peso do sobrenome passa de zero), corre pela equipe da
  // família, ou há espaço para mais um filho (parceiro, idades, menos que o máximo, nenhum bebê
  // nascido nesta temporada nem esperando resposta).
  'famousParent',
  'familyTeam',
  'roomForChild',
] as const;
export type StoryHas = (typeof STORY_HAS)[number];

/* ---------------- Condições ---------------- */

/** Fase da vida do piloto (idades em STORY_EVENTS.AGE_STAGES). */
export const AGE_STAGES = ['teen', 'young', 'adult', 'veteran'] as const;
export type AgeStage = (typeof AGE_STAGES)[number];

/** Faixas da posição no campeonato (limites em STORY_EVENTS.STANDING_LEVELS). */
export const STANDING_LEVELS = ['leader', 'top3', 'top5', 'top10', 'backHalf'] as const;
export type StandingLevel = (typeof STANDING_LEVELS)[number];

/** Faixas de um indicador de 0 a 100 (limites em STORY_EVENTS.STAT_LEVELS). */
export const STAT_LEVELS = ['veryLow', 'low', 'high', 'veryHigh'] as const;
export type StatLevel = (typeof STAT_LEVELS)[number];

/** O que uma pessoa pensa do piloto (limites em STORY_EVENTS.ATTITUDE_LEVELS). */
export const ATTITUDE_LEVELS = ['hostile', 'negative', 'positive', 'loyal'] as const;
export type AttitudeLevel = (typeof ATTITUDE_LEVELS)[number];

/**
 * Uma condição. Todas as condições de uma lista precisam valer. Nenhuma traz número de equilíbrio:
 * as faixas têm nome e os limites estão em `src/config/balance.ts`. Os únicos números são os degraus
 * da escada (1 a 7), a temporada da carreira e a geração da dinastia, que são posições, não ajustes.
 */
export type StoryCondition =
  /** Degrau da categoria: 1 a 3 são os karts, 4 a 7 as fórmulas (7 é o topo). */
  | { c: 'tier'; min?: number; max?: number }
  /** Fase da vida: de (`from`) e/ou até (`to`). */
  | { c: 'age'; from?: AgeStage; to?: AgeStage }
  /** Temporada da carreira deste personagem (1 = a primeira). */
  | { c: 'careerSeason'; min?: number; max?: number }
  /** Primeira temporada do piloto nesta categoria (estreia, depois de subir ou de descer). */
  | { c: 'categoryDebut' }
  /** Momento da temporada. */
  | { c: 'season'; part: SeasonPart }
  /** O que aconteceu na etapa recém-disputada. */
  | { c: 'race'; tag: RaceTag }
  | { c: 'notRace'; tag: RaceTag }
  /** Posição no campeonato dentro da faixa (`in`) ou fora dela (`out`). */
  | { c: 'standing'; in?: StandingLevel; out?: StandingLevel }
  /** Moral, confiança, fase, reputação, confiança da equipe ou relação com o companheiro numa faixa. */
  | { c: 'stat'; stat: StoryStat; level: StatLevel }
  /** Caixa: pelo menos (`atLeast`) e/ou no máximo (`atMost`) uma faixa. */
  | { c: 'cash'; atLeast?: StoryCashLevel; atMost?: StoryCashLevel }
  /** Talento ou defeito de nascença, só depois de revelado na ficha. */
  | { c: 'trait'; trait: TraitId }
  /** Aptidão de nascença alta ou baixa (limites em STORY_EVENTS.APTITUDE_LEVELS). */
  | { c: 'aptitude'; aptitude: AptitudeKey; level: 'high' | 'low' }
  /** Nasceu na capital ou no interior. */
  | { c: 'region'; region: 'capital' | 'interior' }
  /** Mora neste polo. */
  | { c: 'hub'; hub: HubId }
  | { c: 'has'; what: StoryHas }
  | { c: 'lacks'; what: StoryHas }
  /** Marca deixada por uma escolha anterior. */
  | { c: 'flag'; flag: string }
  | { c: 'noFlag'; flag: string }
  /** A memória tem esta pessoa (ou não tem). */
  | { c: 'person'; key: string }
  | { c: 'noPerson'; key: string }
  /** O que a pessoa pensa do piloto. */
  | { c: 'attitude'; key: string; level: AttitudeLevel }
  /** O piloto lembrado está no grid da categoria atual, com equipe. */
  | { c: 'onGrid'; key: string }
  /** A pessoa trabalha na equipe atual do piloto. */
  | { c: 'personAtTeam'; key: string }
  /** Geração da dinastia (1 = o fundador): de (`min`) e/ou até (`max`). Fase 6. */
  | { c: 'generation'; min?: number; max?: number };

/* ---------------- Vínculos ---------------- */

/**
 * Quem ou o que o evento cita. Cada vínculo precisa existir para o evento entrar no sorteio, e
 * libera os marcadores de texto e os alvos de efeito correspondentes.
 */
export type StoryNeed =
  /** `{companheiro}`: o companheiro de equipe. */
  | 'teammate'
  /** `{rival}`: o maior rival no grid atual (rivalidade mínima STORY_EVENTS.RIVAL_MIN). */
  | 'rival'
  /** `{rival}`: o piloto de uma rivalidade nascida num lance desta etapa (Fase 4). */
  | 'newRival'
  /** `{outro}`: o outro piloto do toque desta etapa. */
  | 'other'
  /** `{outro}`: o piloto que chegou logo à frente nesta etapa, de outra equipe e com pontos. */
  | 'ahead'
  /** `{lider}`: o líder do campeonato (outro piloto). */
  | 'leader'
  /** `{patrocinador}`: um patrocinador comercial do piloto (o menos satisfeito). */
  | 'sponsor'
  /** `{patrocinador}`: um patrocinador comercial abaixo do limite de pressão (SPONSOR_RULES). */
  | 'unhappySponsor'
  /** `{equipeInteressada}`: outra equipe da categoria com interesse alto no piloto. */
  | 'interestedTeam'
  /** `{outraEquipe}`: uma equipe da categoria atual que não é a do piloto (sorteada). */
  | 'otherTeam'
  /** `{pontos}`: os pontos que o piloto fez nesta etapa (vistoria técnica). */
  | 'roundPoints'
  /** `{valor}`: o aporte que a equipe pede (TEAM_CASH_CALL); some se o piloto não tem caixa. */
  | 'cashCall'
  /** `{academia}`, `{equipeTopo}`, `{chance}`, `{meta}`: convite de uma academia (ACADEMY_DOOR). */
  | 'academy'
  /** A pessoa `CHAVE` da memória. */
  | `person:${string}`;

/* ---------------- Efeitos ---------------- */

/** Alvo de um efeito sobre outro piloto. `person` usa a pessoa da memória (`key`). */
export type StoryDriverTarget = 'rival' | 'other' | 'teammate' | 'leader' | 'person';

/** Alvo de um efeito sobre uma equipe (interesse do mercado). */
export type StoryTeamTarget = 'current' | 'interested' | 'other' | 'person';

/** De onde vem uma pessoa nova da memória. */
export type StoryPersonSource =
  /** O chefe da equipe atual do piloto (nome inventado, ligado à equipe). */
  | 'teamBoss'
  /** Um piloto do vínculo correspondente (rival, outro, companheiro, rival novo): guarda o retrato dele. */
  | 'rival'
  | 'newRival'
  | 'other'
  | 'teammate'
  /** Alguém de fora das pistas (nome inventado). `org` diz onde ele trabalha. */
  | 'stranger';

/** Um efeito, com tamanho por nome (os números estão em STORY_EVENTS). */
export type StoryEffect =
  | { e: 'stat'; stat: StoryStat; size: StorySize }
  /** Dinheiro: o tamanho vezes uma fração do custo de vida da categoria. `cap` nunca deixa o caixa negativo. */
  | { e: 'cash'; size: StorySize; cap?: boolean }
  | { e: 'rivalry'; who: StoryDriverTarget; key?: string; size: StorySize }
  /** Satisfação dos patrocinadores: de todos ou só do vinculado (`{patrocinador}`). */
  | { e: 'sponsorMood'; who: 'all' | 'bound'; size: StorySize }
  /** O patrocinador vinculado vai embora. */
  | { e: 'dropSponsor' }
  /** Interesse de uma equipe no piloto. */
  | { e: 'interest'; team: StoryTeamTarget; key?: string; size: StorySize }
  /** Posições de punição no próximo grid (tamanho 1 a 3), para o piloto ou para outro. */
  | { e: 'grid'; who: 'player' | StoryDriverTarget; size: 1 | 2 | 3 }
  /** Pontos de punição na licença (tamanho 1 a 3). */
  | { e: 'penaltyPoints'; size: 1 | 2 | 3 }
  /** Perde os pontos desta etapa (vistoria técnica; precisa do vínculo `roundPoints`). */
  | { e: 'losePoints' }
  | { e: 'attribute'; attribute: AttributeKey; size: StorySize }
  /** Lesão ou doença: leve (corre mal) ou grave (fica fora), curta ou longa. */
  | { e: 'injury'; severity: 'minor' | 'serious'; length: 'short' | 'long'; description: string }
  /** Rendimento do equipamento da equipe (motor e chassi). */
  | { e: 'car'; size: StorySize }
  /** Custo anual da vaga (fração da vaga atual). */
  | { e: 'seatCost'; size: StorySize }
  /** Multa rescisória do contrato atual. */
  | { e: 'releaseFee'; size: StorySize }
  /** Relação com o parceiro ou parceira (se houver). */
  | { e: 'relationship'; size: StorySize }
  /** Paga o aporte pedido pela equipe (vínculo `cashCall`). */
  | { e: 'payCashCall' }
  /** Dilui o aporte no custo da vaga (vínculo `cashCall`). */
  | { e: 'splitCashCall' }
  /** Entra na academia do convite (vínculo `academy`). */
  | { e: 'joinAcademy' }
  /** Assina com um patrocinador de um perfil de `SPONSOR_PROFILES`. */
  | { e: 'sponsor'; profile: string }
  /** Deixa uma marca na memória (ou apaga, com `clear`). */
  | { e: 'flag'; flag: string; clear?: boolean }
  /** Guarda uma pessoa na memória (ou atualiza o papel e a atitude de quem já está lá). */
  | {
      e: 'meet';
      key: string;
      from: StoryPersonSource;
      /** O papel, como entra nos textos e na tela: "chefe de equipe", "dono da padaria". */
      role: string;
      /** Equipe ou empresa (só para `stranger`; os outros vêm da equipe da pessoa). */
      org?: string;
      attitude?: StorySize;
    }
  /** Muda o que a pessoa pensa do piloto. */
  | { e: 'attitude'; key: string; size: StorySize }
  /** A pessoa passa a trabalhar na equipe vinculada (`other` = `{outraEquipe}`, `interested`, `current`). */
  | { e: 'joinTeam'; key: string; team: 'current' | 'interested' | 'other' }
  /** O piloto lembrado acompanha a carreira: entra no grid quando o jogador sobe de categoria. */
  | { e: 'follow'; key: string; on: boolean }
  /**
   * Nasce um filho (Fase 6). O bebê é sorteado antes do texto (marcador `{bebe}`, o primeiro nome);
   * o cartão precisa da condição `{ c: 'has', what: 'roomForChild' }`.
   */
  | { e: 'child' };

/* ---------------- Escolhas, desfechos e textos ---------------- */

/** Para onde a cadeia vai depois deste desfecho. */
export type StoryNext = { step: string; delay: StoryDelay } | 'end';

export interface StoryOutcome {
  odds: StoryOdds;
  effects: readonly StoryEffect[];
  /** Só em passos de cadeia (obrigatório lá): o passo seguinte ou o fim. */
  next?: StoryNext;
}

export interface StoryChoice {
  id: string;
  /** A escolha só aparece se todas valerem (por exemplo, o traço "esquentado" revelado). */
  requires?: readonly StoryCondition[];
  /** Um desfecho certo (`sure`) ou de dois a três sorteados (as chances somam 100%). */
  outcomes: readonly StoryOutcome[];
}

/** Texto de uma escolha numa variante: o rótulo do botão e um texto por desfecho, na ordem. */
export interface StoryChoiceText {
  label: string;
  outcomes: readonly string[];
}

/** Uma variante de texto: título, corpo e o texto de cada escolha (pelo id da escolha). */
export interface StoryVariant {
  title: string;
  body: string;
  choices: Readonly<Record<string, StoryChoiceText>>;
}

/** O que eventos avulsos e passos de cadeia têm em comum. */
export interface StoryCardSpec {
  id: string;
  category: StoryCategory;
  /** Condições para o cartão poder sair. */
  when: readonly StoryCondition[];
  needs?: readonly StoryNeed[];
  /** Papel e chave da pessoa que aparece no alto do cartão (precisa estar em `needs` ou ser criada aqui). */
  speaker?: string;
  choices: readonly StoryChoice[];
  /** Cada variante é um texto inteiro diferente; cada uma sai no máximo uma vez por personagem. */
  variants: readonly StoryVariant[];
}

/** Um evento avulso: entra no sorteio da etapa enquanto tiver variante nova e a condição valer. */
export interface StoryEventSpec extends StoryCardSpec {
  frequency: StoryFrequency;
  /** No máximo uma aparição por temporada (o padrão é o intervalo de STORY_EVENTS.EVENT_SPACING etapas). */
  oncePerSeason?: boolean;
}

/** Um passo de cadeia. O passo inicial entra no sorteio como um evento; os outros vêm com prazo. */
export interface StoryStepSpec extends StoryCardSpec {
  /** Só no passo inicial: a frequência no sorteio. */
  frequency?: StoryFrequency;
}

/** Uma cadeia de eventos com memória. Cada cadeia acontece no máximo uma vez por personagem. */
export interface StoryChainSpec {
  id: string;
  /** Nome da cadeia, para a lista no PR, o relatório do simulador e a tela. */
  title: string;
  /** Em uma frase, o que a cadeia conta (documentação). */
  summary: string;
  /** Id do passo inicial. */
  start: string;
  steps: readonly StoryStepSpec[];
}

/* ---------------- Patrocinadores ---------------- */

/** Faixa de valor de um perfil de patrocinador (fatores em SPONSOR_PROFILE_RULES.VALUE). */
export type SponsorValue = 'low' | 'fair' | 'high' | 'premium';
/** Exigência de um perfil: a meta fica mais folgada ou mais apertada (SPONSOR_PROFILE_RULES.TARGET_SHIFT). */
export type SponsorDemand = 'easy' | 'normal' | 'hard';

/** Textos da proposta de um patrocinador, na voz dele. */
export interface SponsorPitch {
  title: string;
  body: string;
  /** Rótulos das três escolhas: assinar, pechinchar, recusar. */
  sign: string;
  haggle: string;
  refuse: string;
  /** Desfechos: assinou; pechinchou e ganhou; pechinchou e perdeu; recusou. */
  signed: string;
  haggleWon: string;
  haggleLost: string;
  refused: string;
}

/**
 * Um perfil de patrocinador. Cada perfil aparece no máximo uma vez por personagem: nada de "mesmo
 * modelo de patrocinador" em temporadas diferentes.
 */
export interface SponsorProfile {
  id: string;
  /** Nome inventado (nenhuma marca real). */
  name: string;
  /** Ramo, para a tela: "padaria", "cooperativa agrícola". */
  sector: string;
  /** Porte: 1 = comércio local, 2 = empresa regional, 3 = marca grande. */
  tier: 1 | 2 | 3;
  value: SponsorValue;
  demand: SponsorDemand;
  personality: SponsorPersonality;
  /** Só sai por uma cadeia (por exemplo, a padaria da cidade natal), nunca no sorteio comum. */
  chainOnly?: boolean;
  pitch: SponsorPitch;
}
