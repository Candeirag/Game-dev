/**
 * Simulador sem interface: cria carreiras, joga com o robô (`sim/policy.ts`) e mede o que
 * interessa para o equilíbrio do jogo. É o que `npm run sim` executa e o que cada fase usa para
 * comparar o antes e o depois de uma mudança de regra.
 *
 * Tudo aqui é determinístico: a carreira da semente N é sempre a mesma, do perfil do piloto ao
 * último resultado. Por isso o relatório de duas execuções com os mesmos argumentos é idêntico,
 * e uma diferença entre duas versões do código é sempre efeito do código.
 */
import {
  MOMENT_KINDS,
  type CareerState,
  type CategoryId,
  type EventChoice,
  type EventCategory,
  type MomentKind,
  type MomentOutcome,
  type MomentRecord,
  type Offer,
  type PendingEvent,
} from '@/domain/schemas';
import { STORY_CATEGORIES, type StoryCategory } from '@/domain/storyEvents';
import { compareText } from '@/domain/text';
import { RACE_MOMENTS } from '@/config/balance';
import { APTITUDE_ORDER, BIRTH_TRAITS } from '@/data/birth';
import { CATEGORIES, getCategory } from '@/data/categories';
import { SPONSOR_PROFILES, STORY_CHAINS, STORY_EVENT_CATALOG } from '@/data/events';
import type { PlayerBackground } from '@/data/rules';
import * as engine from '@/engine';
import { continueDynasty, dynastyStats, type DynastySample, type DynastyStats } from './dynasty';
import { botOffseason, botTraining, playRound, resolvePending, withTalent, type BotDoor, type Choices, type MomentPolicy, type RaceWatch } from './policy';

/** Data fixa de criação das carreiras: o relógio não entra na simulação. */
const CREATED_AT = '2027-01-01T00:00:00.000Z';

export interface SimOptions {
  /** Quantas carreiras (uma por semente, a partir de `firstSeed`). */
  seeds: number;
  /** Temporadas jogadas em cada carreira. */
  seasons: number;
  firstSeed: number;
  /** Bônus de talento do piloto (0 = o robô puro; ver `withTalent`). */
  talent: number;
  /**
   * Como o robô responde aos lances decisivos (Fase 4). Sem valor, vale 'style': ele não responde e
   * o estilo do piloto decide, como em "simular até o fim". 'safe' e 'bold' servem para comparar.
   */
  moments?: MomentPolicy;
  /**
   * Gerações por carreira (Fase 6). Com 1, a amostra acaba nas temporadas pedidas. Com 2, cada carreira
   * continua dali até a 2ª geração (`sim/dynasty.ts`) e o relatório ganha a seção 11; as seções 1 a 10
   * continuam medindo só as temporadas pedidas da 1ª geração. Sem valor, vale 1 (a linha de comando
   * usa 2 por padrão).
   */
  generations?: 1 | 2;
}

export const DEFAULT_SIM_OPTIONS: Required<SimOptions> = { seeds: 50, seasons: 15, firstSeed: 1, talent: 0, moments: 'style', generations: 2 };

/**
 * A política simples do simulador, num lugar só: treino de acerto, classificação e corrida
 * equilibradas (com o engenheiro automático), primeira opção em cada evento, a melhor proposta
 * que der para aceitar no fim do ano e o treino escolhido por `botTraining`. Os lances decisivos
 * (Fase 4) ficam com o estilo do piloto, a não ser que `SimOptions.moments` peça outra política.
 */
export const SIM_CHOICES: Choices = { program: 'setup', approach: 'balanced', mode: 'balanced', eventChoice: 0 };

/**
 * A população da amostra, congelada de propósito: os perfis, as idades e as equipes de estreia
 * entre os quais cada semente sorteia o seu piloto. Se uma fase acrescentar um perfil ou uma
 * equipe de entrada ao jogo, estas listas NÃO acompanham sozinhas: os 50 pilotos da linha de base
 * continuam os mesmos, e os relatórios de fases diferentes continuam comparáveis. Mexer aqui é
 * trocar a linha de base (regrave `docs/simulador/` e diga no PR).
 *
 * Desde a Fase 2, cada carreira tem também o seu nascimento sorteado (o primeiro sorteio da
 * semente, sem refazer). Quem nasce no interior começa na equipe menor do kart regional, seja qual
 * for a equipe que a população sorteou para a semente.
 */
export const SIM_POPULATION = {
  backgrounds: ['natural', 'technical', 'fighter'],
  ages: [14, 15, 16, 17],
  teamIds: ['horizonte', 'cerrado', 'garagem'],
} as const satisfies { backgrounds: readonly PlayerBackground[]; ages: readonly number[]; teamIds: readonly string[] };

/** Como o piloto conseguiu a vaga de uma temporada: a inicial ou o tipo da proposta aceita. */
export type SeatOrigin = 'initial' | Offer['kind'];

/**
 * Por que o piloto ficou só com a rede de segurança: nenhuma equipe fez proposta; havia proposta
 * e o que faltou foi dinheiro para bancar a vaga; ou faltou outro requisito (licença, reputação,
 * experiência, idade).
 */
export type NoSeatCause = 'no-offer' | 'money' | 'requirements';

export interface SeasonSample {
  /** Temporada da carreira (1 = a de estreia). */
  season: number;
  categoryId: CategoryId;
  tier: number;
  /** Idade do piloto durante a temporada. */
  age: number;
  /** Posição final no campeonato. */
  position: number;
  wins: number;
  podiums: number;
  title: boolean;
  /** Dinheiro em caixa depois do fechamento do ano (impostos, juros e rendimentos já lançados). */
  cash: number;
  netWorth: number;
  reputation: number;
  /** Nota geral do piloto ao fim da temporada. */
  overall: number;
  /** Etapas em que o piloto não correu (lesão ou suspensão). */
  roundsMissed: number;
  seat: SeatOrigin;
  /** Só nas temporadas disputadas pela rede de segurança: o motivo. */
  noSeatCause: NoSeatCause | null;
  /** Propostas de equipes para o ano seguinte, sem contar a rede de segurança: quantas vieram e quantas o piloto podia aceitar. */
  offersMade: number;
  offers: number;
  /** Portas (Fase 3): havia alguma aberta no fechamento (uma vaga, fora a de aluguel, por qualquer porta)? */
  doorOpen: boolean;
  /** O investidor de último recurso estava valendo neste fechamento. */
  lastResort: boolean;
  /** Porta usada para a vaga desta temporada ('initial' na estreia; 'none' = vaga de aluguel). */
  door: BotDoor | 'initial';
  /** Resultado do ano: a soma de todos os lançamentos da temporada (receitas menos despesas, impostos e juros incluídos). */
  yearResult: number;
  /** Patrocinadores que romperam por meta não cumprida neste fechamento. */
  sponsorsBroken: number;
  /** Fatia do investidor ao fim da temporada (0 = sem investidor). */
  investorShare: number;
  sideJob: boolean;
  academy: boolean;
  /** Lances decisivos (Fase 4): uma linha por corrida em que o piloto largou, na ordem das etapas. */
  races: RaceSample[];
  /** Rivalidades que nasceram nesta temporada de um toque num lance (`relations.rivalryLog`, com `fresh`). */
  freshRivalries: number;
  /** Eventos (Fase 5): os cartões que apareceram na temporada, contados antes da resposta do robô. */
  events: EventSample;
}

/** Uma escolha que existe por causa de um traço de nascença ou de uma aptidão. */
export type UnlockSample = NonNullable<EventChoice['unlock']>;

/**
 * Os cartões de eventos de uma temporada. Os da Fase 5 são os de `definitionId` 'story:…' (eventos
 * avulsos, passos de cadeia e propostas de patrocínio); os outros são os de família e a mudança.
 */
export interface EventSample {
  /** Cartões da Fase 5 gerados depois de cada etapa disputada (posição 0 = etapa 1). */
  perRound: number[];
  /** Cartões da Fase 5 do começo da temporada (a de estreia não tem começo). */
  seasonStart: number;
  /** Cartões da Fase 5 por categoria, das etapas e do começo da temporada. */
  byCategory: Record<StoryCategory, number>;
  /** Cadeias com algum cartão nesta temporada, e as concluídas até o fechamento dela (ids, sem repetir). */
  chains: string[];
  chainsDone: string[];
  /** Uma entrada por escolha liberada por traço ou aptidão que um cartão da Fase 5 ofereceu. */
  unlocks: UnlockSample[];
  /** O perfil de cada proposta de patrocínio da Fase 5 ('story:sponsor:<perfil>'). */
  sponsorOffers: string[];
  /** Eventos de fora da Fase 5: os de família e a mudança. */
  others: number;
}

/** Um lance do piloto: a opção escolhida, o que a tela mostrava e como terminou. */
export interface MomentSample {
  kind: MomentKind;
  option: string;
  /** Risco da opção escolhida: 0 = segura, 1 = moderada, 2 = arriscada. */
  risk: 0 | 1 | 2;
  /** Chance de dar certo mostrada na opção escolhida, de 0 a 1. */
  chance: number;
  /** Chance mostrada na opção arriscada do lance, escolhida ou não (null se o lance não oferecia uma). */
  riskyChance: number | null;
  success: boolean;
  outcome: MomentOutcome;
  /** Houve toque com o rival (é o que cria rivalidade). */
  contact: boolean;
  /** O lance rendeu punição em tempo. */
  penalized: boolean;
}

/** Os lances de uma corrida, com a qualidade do piloto na hora em que ela foi disputada. */
export interface RaceSample {
  round: number;
  /** Vantagem sobre o grid: a nota geral do piloto na corrida menos o nível médio dos pilotos da categoria. */
  edge: number;
  /** Corrida completa: o piloto recebeu a bandeirada e a prova não foi encerrada antes por bandeira vermelha. */
  completed: boolean;
  moments: MomentSample[];
}

export interface CareerProfile {
  background: PlayerBackground;
  age: number;
  teamId: string;
}

/** O nascimento sorteado da carreira (Fase 2), resumido para comparar começos fortes e fracos. */
export interface BirthSample {
  /** Nota de nascença: a média das cinco aptidões de corpo e mente (50 é o piloto comum). */
  score: number;
  region: 'capital' | 'interior';
  /** Talentos menos defeitos: com três traços, +1 (dois talentos) ou −1 (dois defeitos). */
  traitBalance: number;
}

export interface CareerSample {
  seed: number;
  profile: CareerProfile;
  birth: BirthSample;
  seasons: SeasonSample[];
  /** 'completed' = jogou todas as temporadas pedidas; 'succession' = a carreira passou a um herdeiro antes disso. */
  ended: 'completed' | 'succession';
  /** Textos de evento que esta carreira viu mais de uma vez (Fase 5: nenhum texto pode se repetir). */
  texts: TextRepeatSample;
  /** A dinastia (Fase 6): só com `generations: 2`, a continuação da carreira até a 2ª geração. */
  dynasty?: DynastySample;
}

/** Um texto que apareceu mais de uma vez na mesma carreira. */
export interface RepeatedText {
  /** O começo do texto. */
  text: string;
  /** Quantas vezes apareceu, e quantas delas num cartão da Fase 5. */
  times: number;
  story: number;
  /** Os eventos (`definitionId`) em que apareceu, na ordem em que apareceram. */
  events: string[];
}

/**
 * Textos repetidos numa carreira: título, corpo, rótulo de escolha e texto de desfecho de todos os
 * cartões que ela viu. `story` conta só os cartões da Fase 5; `all`, todos os eventos (com família e
 * mudança). Os dois são textos distintos que apareceram mais de uma vez.
 */
export interface TextRepeatSample {
  story: number;
  all: number;
  repeated: RepeatedText[];
}

/**
 * Perfil do piloto de cada semente: perfil inicial, idade e equipe de estreia variam com a
 * semente, para a amostra cobrir os começos possíveis. Os pontos livres vão sempre para
 * velocidade e consistência, como faria um jogador que lê as descrições.
 */
export function profileForSeed(seed: number): CareerProfile {
  const rng = engine.createRng(engine.hashSeed(seed, 'sim-profile'));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)] as T;
  return { background: pick(SIM_POPULATION.backgrounds), age: pick(SIM_POPULATION.ages), teamId: pick(SIM_POPULATION.teamIds) };
}

export function createSimCareer(seed: number, talent = 0): CareerState {
  const profile = profileForSeed(seed);
  const career = engine.createCareer(
    { firstName: 'Piloto', lastName: `Semente ${seed}`, nationality: 'BR', bonus: { pace: 4, consistency: 4 }, ...profile },
    seed,
    CREATED_AT,
  );
  return withTalent(career, talent);
}

/** Propostas de equipes no fechamento (sem a rede de segurança) e, se nenhuma serve, o que faltou. */
function seatMarket(career: CareerState): { made: number; acceptable: number; cause: NoSeatCause | null } {
  const offers = (career.offseason?.offers ?? []).filter((o) => o.kind !== 'fallback');
  const acceptable = offers.filter((o) => engine.canAcceptOffer(career, o)).length;
  if (acceptable > 0) return { made: offers.length, acceptable, cause: null };
  if (offers.length === 0) return { made: 0, acceptable: 0, cause: 'no-offer' };
  // Faltou só dinheiro em pelo menos uma proposta: com caixa, o piloto teria a vaga.
  const onlyMoney = offers.some((o) =>
    engine
      .offerRequirements(career, o)
      .filter((r) => !r.met)
      .every((r) => r.key === 'finance'),
  );
  return { made: offers.length, acceptable: 0, cause: onlyMoney ? 'money' : 'requirements' };
}

/**
 * Acompanha as corridas de uma temporada e guarda os lances de cada uma. O registro do resultado
 * (`race.moments`) diz a opção escolhida; a chance da opção arriscada, escolhida ou não, vem do
 * lance como foi oferecido. Só lê: a corrida é a mesma com ou sem ele.
 */
function watchMoments(races: RaceSample[]): RaceWatch {
  let moments: MomentSample[] = [];
  return {
    onMoment(moment, record: MomentRecord) {
      const chosen = moment.options.find((o) => o.id === record.option);
      const risky = moment.options.find((o) => o.risk === 2);
      moments.push({
        kind: record.kind,
        option: record.option,
        risk: chosen?.risk ?? 0,
        chance: record.chance,
        riskyChance: risky ? risky.chance : null,
        success: record.success,
        outcome: record.outcome,
        contact: record.contact,
        penalized: record.penaltySeconds > 0,
      });
    },
    onRace(race, career) {
      const player = engine.getPlayer(career);
      const car = race.cars.find((c) => c.driverId === player.id);
      races.push({
        round: career.nextRoundIndex + 1,
        edge: engine.overallRating(player.attributes) - getCategory(career.categoryId).field.driverLevel,
        completed: !race.endedEarly && car?.status === 'running',
        moments,
      });
      moments = [];
    },
  };
}

/** Os cartões da Fase 5 (eventos avulsos, passos de cadeia e propostas de patrocínio) começam assim. */
const STORY_PREFIX = 'story:';
const SPONSOR_PREFIX = 'story:sponsor:';
/** Até quantas letras de um texto repetido o relatório mostra. */
const EXCERPT_LENGTH = 60;

const isStoryCategory = (category: EventCategory): category is StoryCategory => STORY_CATEGORIES.some((c) => c === category);
const excerpt = (text: string) => (text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : text);

/** Os textos que o jogador lê num cartão: título, corpo, rótulo de cada escolha e texto de cada desfecho. */
function eventTexts(event: PendingEvent): string[] {
  return [event.title, event.body, ...event.choices.flatMap((c) => [c.label, ...c.outcomes.map((o) => o.text)])].filter((text) => text !== '');
}

export function emptyEventSample(): EventSample {
  return {
    perRound: [],
    seasonStart: 0,
    byCategory: { track: 0, career: 0, money: 0, health: 0, personal: 0 },
    chains: [],
    chainsDone: [],
    unlocks: [],
    sponsorOffers: [],
    others: 0,
  };
}

/** Quem acompanha os cartões de uma carreira (o que a seção 10 do relatório mede). */
export interface EventWatch {
  /** Lê os cartões pendentes, sem mexer na carreira, e conta os que ainda não tinha visto (que devolve). */
  look(career: CareerState): PendingEvent[];
  /** Fecha a temporada (depois do fechamento e das respostas): devolve o que ela teve e começa a próxima. */
  closeSeason(career: CareerState): EventSample;
  /** Os textos que a carreira viu mais de uma vez até agora. */
  texts(): TextRepeatSample;
}

/**
 * Acompanha os cartões de uma carreira. O simulador chama `look` antes de cada resposta do robô: os
 * cartões gerados depois da etapa N são resolvidos no começo da etapa N+1, os da última etapa depois
 * do fechamento do ano e os do começo da temporada antes da primeira etapa. Cada cartão conta uma
 * vez (pelo id), na temporada em que apareceu. Só lê: a carreira é a mesma com ou sem ele.
 */
export function watchEvents(): EventWatch {
  const seen = new Set<string>();
  const tally = new Map<string, { times: number; story: number; events: string[] }>();
  let season = emptyEventSample();
  const count = (text: string, event: PendingEvent, story: boolean) => {
    const row = tally.get(text) ?? { times: 0, story: 0, events: [] };
    row.times++;
    if (story) row.story++;
    if (!row.events.includes(event.definitionId)) row.events.push(event.definitionId);
    tally.set(text, row);
  };
  return {
    look(career) {
      const fresh = career.pendingEvents.filter((e) => !seen.has(e.id));
      for (const event of fresh) {
        seen.add(event.id);
        const story = event.definitionId.startsWith(STORY_PREFIX);
        for (const text of eventTexts(event)) count(text, event, story);
        if (!story) {
          season.others++;
          continue;
        }
        if (event.round > 0) season.perRound[event.round - 1] = (season.perRound[event.round - 1] ?? 0) + 1;
        else season.seasonStart++;
        if (isStoryCategory(event.category)) season.byCategory[event.category]++;
        if (event.chain && !season.chains.includes(event.chain.id)) season.chains.push(event.chain.id);
        for (const choice of event.choices) if (choice.unlock) season.unlocks.push(choice.unlock);
        if (event.definitionId.startsWith(SPONSOR_PREFIX)) season.sponsorOffers.push(event.definitionId.slice(SPONSOR_PREFIX.length));
      }
      return fresh;
    },
    closeSeason(career) {
      const rounds = Math.max(career.rounds.length, season.perRound.length);
      const done = engine
        .storyOf(career)
        .chains.filter((c) => c.status === 'done')
        .map((c) => c.id);
      const sample: EventSample = { ...season, perRound: Array.from({ length: rounds }, (_, i) => season.perRound[i] ?? 0), chainsDone: done };
      season = emptyEventSample();
      return sample;
    },
    texts() {
      const rows = [...tally].filter(([, row]) => row.times > 1);
      return {
        story: rows.filter(([, row]) => row.story > 1).length,
        all: rows.length,
        repeated: rows.map(([text, row]) => ({ text: excerpt(text), times: row.times, story: row.story, events: [...row.events] })),
      };
    },
  };
}

function sampleSeason(
  career: CareerState,
  index: number,
  seat: SeatOrigin,
  noSeatCause: NoSeatCause | null,
  door: BotDoor | 'initial',
  races: RaceSample[],
  events: EventSample,
): SeasonSample {
  const offseason = career.offseason;
  if (!offseason) throw new Error('Temporada sem fechamento.');
  const player = engine.getPlayer(career);
  const category = getCategory(career.categoryId);
  const market = seatMarket(career);
  return {
    season: index,
    categoryId: category.id,
    tier: category.tier,
    age: player.age,
    position: offseason.playerPosition,
    wins: offseason.wins,
    podiums: offseason.podiums,
    title: offseason.playerPosition === 1,
    cash: career.finance.cash,
    netWorth: Math.round(engine.netWorth(career.finance)),
    reputation: career.reputation,
    overall: engine.overallRating(player.attributes),
    roundsMissed: career.rounds.filter((r) => !r.race.entries.some((e) => e.driverId === player.id)).length,
    seat,
    noSeatCause: seat === 'fallback' ? noSeatCause : null,
    offersMade: market.made,
    offers: market.acceptable,
    doorOpen: engine.hasOpenDoor(career),
    lastResort: engine.lastResortActive(career),
    door,
    yearResult: Object.values(career.finance.reports[career.finance.reports.length - 1]?.totals ?? {}).reduce((total, value) => total + value, 0),
    sponsorsBroken: career.sponsors.filter((s) => engine.missedTarget(s, offseason.playerPosition)).length,
    investorShare: career.investor?.share ?? 0,
    sideJob: career.sideJob !== 'none',
    academy: career.academy !== null,
    races,
    freshRivalries: career.relations.rivalryLog.filter((r) => r.season === career.season && r.fresh).length,
    events,
  };
}

function birthSample(career: CareerState): BirthSample {
  const birth = career.birth;
  if (!birth) throw new Error('Carreira do simulador sem nascimento.');
  const traits = birth.traits.map((t) => BIRTH_TRAITS[t.id].kind);
  return {
    score: engine.birthScore(birth.aptitudes),
    region: birth.region,
    traitBalance: traits.filter((k) => k === 'talent').length - traits.filter((k) => k === 'defect').length,
  };
}

/**
 * Joga uma carreira com o robô e devolve uma linha por temporada disputada. Com `generations: 2`, a
 * carreira continua depois delas até a 2ª geração (`continueDynasty`, que mostra cada passo a
 * `onDynastyStep`, se houver), sem mudar as temporadas da amostra.
 */
export function simulateCareer(
  seed: number,
  options: Pick<SimOptions, 'seasons' | 'talent' | 'moments' | 'generations'>,
  onDynastyStep?: (career: CareerState) => void,
): CareerSample {
  const choices: Choices = { ...SIM_CHOICES, moments: options.moments ?? DEFAULT_SIM_OPTIONS.moments };
  const { sample, career } = playSampleSeasons(seed, options, choices);
  if ((options.generations ?? 1) < 2) return sample;
  const from = { firstSeasons: sample.seasons, startAge: sample.profile.age, choices, talent: options.talent };
  return { ...sample, dynasty: continueDynasty(seed, career, from, onDynastyStep) };
}

/** As temporadas pedidas de uma carreira: a amostra e a carreira como ficou no fim dela (para a dinastia continuar). */
function playSampleSeasons(seed: number, options: Pick<SimOptions, 'seasons' | 'talent'>, choices: Choices): { sample: CareerSample; career: CareerState } {
  const profile = profileForSeed(seed);
  const seasons: SeasonSample[] = [];
  let index = 1;
  let birth: BirthSample | null = null;
  try {
    let career = createSimCareer(seed, options.talent);
    birth = birthSample(career);
    let seat: SeatOrigin = 'initial';
    let cause: NoSeatCause | null = null;
    let door: BotDoor | 'initial' = 'initial';
    // Os cartões são lidos antes de cada resposta do robô (o `resolvePending` do começo de cada etapa
    // e o do fechamento do ano); ler não muda a carreira.
    const events = watchEvents();
    for (; index <= options.seasons; index++) {
      career = botTraining(career);
      const races: RaceSample[] = [];
      const watch = watchMoments(races);
      while (career.nextRoundIndex < career.calendar.length && !career.succession) {
        events.look(career);
        career = playRound(career, choices, watch);
      }
      // Um acidente fatal no meio do ano encerra a amostra sem contar a temporada incompleta.
      if (!career.offseason) return { sample: { seed, profile, birth, seasons, ended: 'succession', texts: events.texts() }, career };
      // As decisões que a última etapa deixou pendentes são resolvidas aqui, depois do fechamento
      // do ano (que acontece ao concluir a última etapa) e antes de medir o caixa e de escolher a
      // proposta, como faz o jogador.
      events.look(career);
      if (!career.succession) career = resolvePending(career, choices.eventChoice);
      seasons.push(sampleSeason(career, index, seat, cause, door, races, events.closeSeason(career)));
      // Quem jogou todas as temporadas pedidas completou a carreira, mesmo que a sucessão venha no último fechamento.
      if (index === options.seasons) break;
      if (career.succession) return { sample: { seed, profile, birth, seasons, ended: 'succession', texts: events.texts() }, career };
      const next = botOffseason(career);
      seat = career.offseason?.offers.find((o) => o.id === next.offerId)?.kind ?? 'fallback';
      cause = seat === 'fallback' ? seatMarket(career).cause : null;
      door = next.door;
      career = engine.startNextSeason(next.career, next.offerId);
    }
    return { sample: { seed, profile, birth, seasons, ended: 'completed', texts: events.texts() }, career };
  } catch (error) {
    // Uma carreira que quebra tem de dizer qual foi: é com a semente que se reproduz o defeito.
    throw new Error(`A carreira da semente ${seed} falhou na temporada ${index}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/* ------------------------------------------------------------------ */
/* Agregados                                                           */
/* ------------------------------------------------------------------ */

export interface CategoryStats {
  categoryId: CategoryId;
  tier: number;
  /** Temporadas disputadas na categoria, somando todas as carreiras. */
  seasons: number;
  /** Carreiras que passaram pela categoria. */
  careers: number;
  averagePosition: number;
  medianPosition: number;
  bestPosition: number;
  /** Fração das temporadas terminadas entre os três primeiros. */
  top3Share: number;
  titles: number;
}

export interface CashStats {
  season: number;
  careers: number;
  p10: number;
  median: number;
  p90: number;
  /** Fração das carreiras com o caixa negativo no fim da temporada. */
  negativeShare: number;
  medianNetWorth: number;
}

export interface ArrivalStats {
  categoryId: CategoryId;
  tier: number;
  /** Carreiras que chegaram ao degrau. */
  careers: number;
  share: number;
  averageAge: number;
  minAge: number;
  maxAge: number;
  /** Temporada da carreira, em média, em que o piloto estreou no degrau. */
  averageSeason: number;
}

/**
 * Desempenho de um grupo de carreiras separadas pelo nascimento: quanto a nota de nascença, a
 * cidade ou os traços ocultos mudam a carreira do mesmo robô.
 */
export interface BirthGroupStats {
  group: 'low' | 'mid' | 'high' | 'capital' | 'interior' | 'talents' | 'defects';
  careers: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  /** Posição média no campeonato da temporada de estreia. */
  debutPosition: number;
  /** Degrau mais alto alcançado, em média. */
  averageHighestTier: number;
  /** Parcela das carreiras que chegaram aos monopostos (4º degrau ou mais). */
  formulaShare: number;
  /** Parcela das carreiras que chegaram ao topo. */
  topShare: number;
  titlesPerCareer: number;
  noSeatPerCareer: number;
}

export interface SimSummary {
  options: SimOptions;
  careers: number;
  seasonsPlayed: number;
  averageStartAge: number;
  byCategory: CategoryStats[];
  cashBySeason: CashStats[];
  arrivals: ArrivalStats[];
  top: { categoryId: CategoryId; careers: number; share: number };
  /** Carreiras por degrau mais alto alcançado (índice 0 = degrau 1). */
  highestTier: number[];
  titles: { total: number; perCareer: number; max: number; none: number; one: number; two: number; threeOrMore: number };
  /**
   * Temporadas em que o piloto só correu graças à rede de segurança, e por quê: nenhuma equipe
   * fez proposta (`noOffer`), havia proposta e faltou dinheiro (`money`) ou faltou outro requisito
   * (`requirements`).
   */
  noSeat: { seasons: number; perCareer: number; careers: number; share: number; noOffer: number; money: number; requirements: number };
  /** Temporadas em que o piloto desceu de degrau (por proposta ou pela rede de segurança). */
  demotions: { seasons: number; perCareer: number; careers: number };
  /** Maior sequência de temporadas no mesmo degrau, em média por carreira. */
  longestStay: number;
  roundsMissedPerSeason: number;
  /** Carreiras que passaram a um herdeiro (morte ou acidente) antes de completar as temporadas pedidas. */
  interrupted: number;
  /**
   * Nascimento (Fase 2): as carreiras em três grupos do mesmo tamanho pela nota de nascença
   * (baixa, média e alta), e depois por cidade (capital e interior) e pelos traços (dois talentos e
   * dois defeitos).
   */
  byBirth: BirthGroupStats[];
  byOrigin: BirthGroupStats[];
  /** Economia e portas (Fase 3). */
  doors: DoorStats;
  /** Lances decisivos (Fase 4). */
  moments: MomentStats;
  /** Eventos encadeados com memória (Fase 5). */
  events: EventStats;
  /** A dinastia (Fase 6): só com `generations: 2`; senão, null. */
  dynasty: DynastyStats | null;
}

/** Cartões da Fase 5 por etapa disputada e no começo da temporada (a regra é de 1 a 3 por etapa). */
export interface EventCountStats {
  /** Etapas disputadas e os cartões gerados depois delas. */
  rounds: number;
  cards: number;
  /** Cartões por etapa, em média. */
  perRound: number;
  /** Etapas com 0, 1, 2, 3 e mais de 3 cartões. */
  zero: number;
  one: number;
  two: number;
  three: number;
  more: number;
  /** Temporadas com começo (todas, menos a de estreia) e os cartões desse começo. */
  starts: number;
  startCards: number;
  perStart: number;
}

/** Uma cadeia do catálogo: quantas carreiras a começaram e quantas a concluíram. */
export interface ChainStats {
  id: string;
  title: string;
  started: number;
  done: number;
}

/** Um traço ou aptidão que libera escolhas: quantas o catálogo tem e quantas apareceram. */
export interface UnlockStats extends UnlockSample {
  /** Escolhas do catálogo (eventos avulsos e passos de cadeia) que ele libera. */
  inCatalog: number;
  /** Vezes em que uma escolha liberada por ele foi oferecida, e em quantas carreiras. */
  times: number;
  careers: number;
}

export interface EventStats {
  all: EventCountStats;
  /** O mesmo por temporada da carreira (1 = a de estreia): mostra se o catálogo se esgota. */
  bySeason: (EventCountStats & { season: number })[];
  /** Todos os cartões da Fase 5 (etapas e começos de temporada) e os eventos de fora dela (família e mudança). */
  cards: number;
  others: number;
  /** Parcela de cada categoria nos cartões da Fase 5, na ordem do jogo. */
  byCategory: { category: StoryCategory; cards: number; share: number }[];
  /** Todas as cadeias do catálogo, na ordem dele (e, no fim, alguma que só a amostra tenha). */
  chains: ChainStats[];
  chainsStartedPerCareer: number;
  chainsDonePerCareer: number;
  /** Escolhas liberadas por traço ou aptidão: no total, por carreira, carreiras que viram alguma e por traço/aptidão. */
  unlocks: number;
  unlocksPerCareer: number;
  unlockCareers: number;
  byUnlock: UnlockStats[];
  /** Propostas de patrocínio da Fase 5, perfis distintos (e quantos o catálogo tem) e perfis repetidos numa mesma carreira. */
  sponsorOffers: number;
  sponsorOffersPerCareer: number;
  sponsorProfiles: number;
  sponsorCatalog: number;
  sponsorRepeated: number;
  /** Textos repetidos na mesma carreira (a soma das carreiras), e quantas carreiras têm algum. */
  repeats: {
    story: number;
    storyCareers: number;
    all: number;
    allCareers: number;
    /** Os textos repetidos, juntando as carreiras: primeiro os da Fase 5, depois os que mais carreiras viram. */
    examples: (RepeatedText & { careers: number })[];
  };
}

/** Quantos lances têm as corridas completas de um grupo (a regra é de 2 a 4 por corrida). */
export interface MomentCountStats {
  /** Corridas em que o piloto largou, e as que ele completou. */
  races: number;
  completeRaces: number;
  /** Lances por corrida completa, em média. */
  perRace: number;
  /** Corridas completas com 2, 3 e 4 lances, e as que ficaram fora dessa faixa. */
  two: number;
  three: number;
  four: number;
  other: number;
}

/** Uma opção de um tipo de lance: quantas vezes foi escolhida e no que deu. */
export interface MomentOptionStats {
  kind: MomentKind;
  option: string;
  /** Risco da opção na tabela do jogo: 0 = segura, 1 = moderada, 2 = arriscada. */
  risk: 0 | 1 | 2;
  times: number;
  /** Fração das vezes em que deu certo, e a chance que a tela mostrava, em média. */
  successShare: number;
  averageChance: number;
  spins: number;
  /** Toques com o rival (um toque que acaba em abandono conta aqui e em `retired`). */
  contacts: number;
  retired: number;
  penalized: number;
}

/** As corridas de uma faixa de qualidade do piloto (terços pela vantagem sobre o grid). */
export interface MomentEdgeStats {
  group: 'low' | 'mid' | 'high';
  races: number;
  averageEdge: number;
  minEdge: number;
  maxEdge: number;
  moments: number;
  /** Lances que ofereciam uma opção arriscada, e a chance média mostrada nela (escolhida ou não). */
  riskyOffered: number;
  riskyChance: number;
  /** Fração desses lances em que o piloto escolheu a opção arriscada. */
  riskyTakenShare: number;
  /** Fração de todos os lances da faixa que deram certo. */
  successShare: number;
  /** Lances arriscados vencidos, por corrida. */
  riskyWonPerRace: number;
  /** Lances vencidos menos lances perdidos, por corrida (o registro não diz posições ganhas). */
  balancePerRace: number;
}

export interface MomentStats {
  /** Todos os lances de todas as corridas (completas ou não). */
  moments: number;
  all: MomentCountStats;
  byCategory: (MomentCountStats & { categoryId: CategoryId })[];
  /** Todas as opções de todos os tipos de lance, na ordem do jogo (inclusive as nunca escolhidas). */
  byOption: MomentOptionStats[];
  /** Três grupos de corridas do mesmo tamanho, pela vantagem do piloto sobre o grid na hora da corrida. */
  byEdge: MomentEdgeStats[];
  /** Rivalidades novas (nascidas de um toque num lance), no total e por carreira. */
  freshRivalries: number;
  freshRivalriesPerCareer: number;
  /** Toques em lances a cada 100 lances. */
  contactsPer100: number;
}

/** Como as carreiras de um grupo pagaram a entrada num degrau. */
export interface EntryStats {
  /** Carreiras que chegaram ao degrau. */
  careers: number;
  share: number;
  averageSeason: number;
  /** Por qual porta: com o que tinham (patrocínio e bolsa), academia, vaquinha ou investidor. */
  own: number;
  academy: number;
  crowdfund: number;
  investor: number;
}

export interface DoorStats {
  /** Temporadas fechadas sem nenhuma porta aberta, e a maior sequência numa mesma carreira. */
  noDoorSeasons: number;
  noDoorCareers: number;
  longestNoDoorStreak: number;
  /** Fechamentos em que o investidor de último recurso apareceu. */
  lastResortSeasons: number;
  /** Vagas conseguidas por cada porta (temporadas). */
  used: { own: number; academy: number; crowdfund: number; investor: number; none: number };
  /** Carreiras que terminaram com investidor, e a fatia média e a maior entre elas. */
  investorCareers: number;
  investorAverageShare: number;
  investorMaxShare: number;
  academyCareers: number;
  sideJobSeasons: number;
  /** Patrocinadores que romperam por meta não cumprida, por carreira. */
  sponsorsBrokenPerCareer: number;
  /** Quanto o ano rende ou custa pela posição final, no kart (regional e Brasileiro): mediana do resultado do ano. */
  yearResultByPosition: { label: string; seasons: number; median: number }[];
  /** O mesmo por degrau: mediana do resultado do ano de quem terminou na metade de cima e na de baixo. */
  yearResultByTier: { categoryId: CategoryId; seasons: number; topHalf: number; bottomHalf: number }[];
  /** Entrada na Fórmula Júnior: todas as carreiras e os terços pela nota de nascença. */
  juniorEntry: { label: string; stats: EntryStats }[];
}

/** Maior sequência de temporadas seguidas sem porta numa carreira. */
function longestNoDoorStreak(seasons: readonly SeasonSample[]): number {
  let best = 0;
  let run = 0;
  for (const s of seasons) {
    run = s.doorOpen || s.lastResort ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Como um grupo de carreiras pagou a primeira temporada num degrau. */
function entryStats(samples: readonly CareerSample[], categoryId: CategoryId): EntryStats {
  const firsts = samples.flatMap((c) => c.seasons.find((s) => s.categoryId === categoryId) ?? []);
  const by = (door: BotDoor) => firsts.filter((s) => s.door === door).length;
  return {
    careers: firsts.length,
    share: samples.length ? firsts.length / samples.length : 0,
    averageSeason: firsts.length ? firsts.reduce((total, s) => total + s.season, 0) / firsts.length : 0,
    own: by('own'),
    academy: by('academy'),
    crowdfund: by('crowdfund'),
    investor: by('investor'),
  };
}

function doorStats(samples: readonly CareerSample[]): DoorStats {
  const all = samples.flatMap((c) => c.seasons);
  // A porta de uma temporada é a que deu a vaga dela; a estreia não conta.
  const seats = all.filter((s) => s.door !== 'initial');
  const used = (door: BotDoor) => seats.filter((s) => s.door === door).length;
  const finalShares = samples.map((c) => c.seasons[c.seasons.length - 1]?.investorShare ?? 0).filter((share) => share > 0);
  const kart = all.filter((s) => s.tier <= 2);
  const band = (label: string, from: number, to: number) => {
    const rows = kart.filter((s) => s.position >= from && s.position <= to);
    return {
      label,
      seasons: rows.length,
      median: percentile(
        rows.map((s) => s.yearResult),
        0.5,
      ),
    };
  };
  const [low, mid, high] = birthTerciles(samples);
  return {
    noDoorSeasons: all.filter((s) => !s.doorOpen && !s.lastResort).length,
    noDoorCareers: samples.filter((c) => c.seasons.some((s) => !s.doorOpen && !s.lastResort)).length,
    longestNoDoorStreak: Math.max(0, ...samples.map((c) => longestNoDoorStreak(c.seasons))),
    lastResortSeasons: all.filter((s) => s.lastResort).length,
    used: { own: used('own'), academy: used('academy'), crowdfund: used('crowdfund'), investor: used('investor'), none: used('none') },
    investorCareers: finalShares.length,
    investorAverageShare: finalShares.length ? finalShares.reduce((total, share) => total + share, 0) / finalShares.length : 0,
    investorMaxShare: Math.max(0, ...finalShares),
    academyCareers: samples.filter((c) => c.seasons.some((s) => s.academy)).length,
    sideJobSeasons: all.filter((s) => s.sideJob).length,
    sponsorsBrokenPerCareer: samples.length ? all.reduce((total, s) => total + s.sponsorsBroken, 0) / samples.length : 0,
    yearResultByPosition: [band('1º a 5º', 1, 5), band('6º a 10º', 6, 10), band('11º a 15º', 11, 15), band('16º a 20º', 16, 99)],
    yearResultByTier: CATEGORIES.flatMap((category) => {
      const rows = all.filter((s) => s.categoryId === category.id);
      if (rows.length === 0) return [];
      const median = (half: readonly SeasonSample[]) =>
        percentile(
          half.map((s) => s.yearResult),
          0.5,
        );
      return [
        {
          categoryId: category.id,
          seasons: rows.length,
          topHalf: median(rows.filter((s) => s.position <= 10)),
          bottomHalf: median(rows.filter((s) => s.position > 10)),
        },
      ];
    }),
    juniorEntry: [
      { label: 'Todas as carreiras', stats: entryStats(samples, 'f4') },
      { label: 'Nascença alta', stats: entryStats(high, 'f4') },
      { label: 'Nascença média', stats: entryStats(mid, 'f4') },
      { label: 'Nascença baixa', stats: entryStats(low, 'f4') },
    ],
  };
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => (values.length ? sum(values) / values.length : 0);

function momentCounts(races: readonly RaceSample[]): MomentCountStats {
  const complete = races.filter((r) => r.completed).map((r) => r.moments.length);
  const two = complete.filter((n) => n === 2).length;
  const three = complete.filter((n) => n === 3).length;
  const four = complete.filter((n) => n === 4).length;
  return { races: races.length, completeRaces: complete.length, perRace: mean(complete), two, three, four, other: complete.length - two - three - four };
}

/**
 * Três grupos de corridas do mesmo tamanho (o do meio fica com a sobra) pela vantagem do piloto
 * sobre o grid; no empate, vale a ordem em que as corridas foram disputadas (semente, temporada, etapa).
 */
export function edgeTerciles(races: readonly RaceSample[]): [RaceSample[], RaceSample[], RaceSample[]] {
  const sorted = races.map((race, order) => ({ race, order })).sort((a, b) => a.race.edge - b.race.edge || a.order - b.order);
  const third = Math.floor(sorted.length / 3);
  const pick = (from: number, to: number) => sorted.slice(from, to).map((row) => row.race);
  return [pick(0, third), pick(third, sorted.length - third), pick(sorted.length - third, sorted.length)];
}

function edgeGroup(group: MomentEdgeStats['group'], races: readonly RaceSample[]): MomentEdgeStats | null {
  if (races.length === 0) return null;
  const edges = races.map((r) => r.edge);
  const moments = races.flatMap((r) => r.moments);
  const offered = moments.filter((m) => m.riskyChance !== null);
  const riskyWon = moments.filter((m) => m.risk === 2 && m.success).length;
  const won = moments.filter((m) => m.success).length;
  return {
    group,
    races: races.length,
    averageEdge: mean(edges),
    minEdge: Math.min(...edges),
    maxEdge: Math.max(...edges),
    moments: moments.length,
    riskyOffered: offered.length,
    riskyChance: mean(offered.map((m) => m.riskyChance ?? 0)),
    riskyTakenShare: offered.length ? offered.filter((m) => m.risk === 2).length / offered.length : 0,
    successShare: moments.length ? won / moments.length : 0,
    riskyWonPerRace: riskyWon / races.length,
    balancePerRace: (won - (moments.length - won)) / races.length,
  };
}

function momentStats(samples: readonly CareerSample[]): MomentStats {
  const seasons = samples.flatMap((c) => c.seasons);
  const races = seasons.flatMap((s) => s.races);
  const moments = races.flatMap((r) => r.moments);
  const freshRivalries = sum(seasons.map((s) => s.freshRivalries));
  const terciles = edgeTerciles(races);
  return {
    moments: moments.length,
    all: momentCounts(races),
    byCategory: CATEGORIES.flatMap((category) => {
      const rows = seasons.filter((s) => s.categoryId === category.id).flatMap((s) => s.races);
      return rows.length === 0 ? [] : [{ categoryId: category.id, ...momentCounts(rows) }];
    }),
    byOption: MOMENT_KINDS.flatMap((kind) =>
      Object.entries<{ risk: 0 | 1 | 2 }>(RACE_MOMENTS.OPTIONS[kind]).map(([option, rule]): MomentOptionStats => {
        const rows = moments.filter((m) => m.kind === kind && m.option === option);
        return {
          kind,
          option,
          risk: rule.risk,
          times: rows.length,
          successShare: rows.length ? rows.filter((m) => m.success).length / rows.length : 0,
          averageChance: mean(rows.map((m) => m.chance)),
          spins: rows.filter((m) => m.outcome === 'spin').length,
          contacts: rows.filter((m) => m.contact).length,
          retired: rows.filter((m) => m.outcome === 'retired').length,
          penalized: rows.filter((m) => m.penalized).length,
        };
      }),
    ),
    byEdge: (['low', 'mid', 'high'] as const).map((group, i) => edgeGroup(group, terciles[i] ?? [])).filter((row): row is MomentEdgeStats => row !== null),
    freshRivalries,
    freshRivalriesPerCareer: samples.length ? freshRivalries / samples.length : 0,
    contactsPer100: moments.length ? (moments.filter((m) => m.contact).length / moments.length) * 100 : 0,
  };
}

function eventCounts(seasons: readonly SeasonSample[]): EventCountStats {
  const perRound = seasons.flatMap((s) => s.events.perRound);
  // A temporada de estreia não tem começo: a carreira já nasce nela.
  const starts = seasons.filter((s) => s.season > 1).map((s) => s.events.seasonStart);
  const rounds = (cards: number) => perRound.filter((n) => n === cards).length;
  return {
    rounds: perRound.length,
    cards: sum(perRound),
    perRound: mean(perRound),
    zero: rounds(0),
    one: rounds(1),
    two: rounds(2),
    three: rounds(3),
    more: perRound.filter((n) => n > 3).length,
    starts: starts.length,
    startCards: sum(starts),
    perStart: mean(starts),
  };
}

const unlockKey = (unlock: UnlockSample) => `${unlock.kind}:${unlock.id}${unlock.level === 'low' ? ':baixa' : ''}`;

/**
 * Escolhas do catálogo liberadas por cada traço ou aptidão. Vale a primeira condição de traço ou
 * aptidão da escolha, que é a que o cartão mostra.
 */
function catalogUnlocks(): Map<string, number> {
  const out = new Map<string, number>();
  for (const spec of [...STORY_EVENT_CATALOG, ...STORY_CHAINS.flatMap((chain) => chain.steps)])
    for (const choice of spec.choices) {
      const condition = choice.requires?.find((c) => c.c === 'trait' || c.c === 'aptitude');
      const unlock: UnlockSample | null =
        condition?.c === 'trait'
          ? { kind: 'trait', id: condition.trait }
          : condition?.c === 'aptitude'
            ? { kind: 'aptitude', id: condition.aptitude, level: condition.level }
            : null;
      if (unlock) out.set(unlockKey(unlock), (out.get(unlockKey(unlock)) ?? 0) + 1);
    }
  return out;
}

/** Os textos repetidos de todas as carreiras, juntos: primeiro os da Fase 5, depois os que mais carreiras viram. */
function repeatedExamples(samples: readonly CareerSample[]): (RepeatedText & { careers: number })[] {
  const byText = new Map<string, RepeatedText & { careers: number }>();
  for (const career of samples)
    for (const repeated of career.texts.repeated) {
      const row = byText.get(repeated.text);
      if (!row) {
        byText.set(repeated.text, { ...repeated, events: [...repeated.events], careers: 1 });
        continue;
      }
      row.times += repeated.times;
      row.story += repeated.story;
      row.careers++;
      for (const event of repeated.events) if (!row.events.includes(event)) row.events.push(event);
    }
  return [...byText.values()].sort((a, b) => b.story - a.story || b.careers - a.careers || b.times - a.times || compareText(a.text, b.text));
}

function eventStats(samples: readonly CareerSample[], seasonsAsked: number): EventStats {
  const seasons = samples.flatMap((c) => c.seasons);
  const events = seasons.map((s) => s.events);
  const all = eventCounts(seasons);
  const cards = sum(events.map((e) => sum(e.perRound) + e.seasonStart));
  const perCareer = (count: number) => (samples.length ? count / samples.length : 0);
  const union = (career: CareerSample, pick: (e: EventSample) => readonly string[]) => new Set(career.seasons.flatMap((s) => pick(s.events)));

  const started = samples.map((c) => union(c, (e) => e.chains));
  const done = samples.map((c) => union(c, (e) => e.chainsDone));
  const chainIds = [...STORY_CHAINS.map((chain) => chain.id), ...started.flatMap((set) => [...set])].filter((id, i, ids) => ids.indexOf(id) === i);

  const inCatalog = catalogUnlocks();
  const offered = events.flatMap((e) => e.unlocks);
  const unlockOrder: UnlockSample[] = [
    ...Object.values(BIRTH_TRAITS).map((t): UnlockSample => ({ kind: 'trait', id: t.id })),
    ...APTITUDE_ORDER.flatMap((id): UnlockSample[] => [
      { kind: 'aptitude', id, level: 'high' },
      { kind: 'aptitude', id, level: 'low' },
    ]),
    ...offered,
  ].filter((u, i, list) => list.findIndex((v) => unlockKey(v) === unlockKey(u)) === i);

  const sponsorRepeated = samples.reduce((total, c) => {
    const offers = c.seasons.flatMap((s) => s.events.sponsorOffers);
    return total + new Set(offers.filter((id, i) => offers.indexOf(id) !== i)).size;
  }, 0);
  const sponsorOffers = events.flatMap((e) => e.sponsorOffers);

  return {
    all,
    bySeason: Array.from({ length: seasonsAsked }, (_, i) => {
      const rows = seasons.filter((s) => s.season === i + 1);
      return rows.length ? [{ season: i + 1, ...eventCounts(rows) }] : [];
    }).flat(),
    cards,
    others: sum(events.map((e) => e.others)),
    byCategory: STORY_CATEGORIES.map((category) => {
      const count = sum(events.map((e) => e.byCategory[category]));
      return { category, cards: count, share: cards ? count / cards : 0 };
    }),
    chains: chainIds.map((id) => ({
      id,
      title: STORY_CHAINS.find((chain) => chain.id === id)?.title ?? id,
      started: started.filter((set) => set.has(id)).length,
      done: done.filter((set) => set.has(id)).length,
    })),
    chainsStartedPerCareer: perCareer(sum(started.map((set) => set.size))),
    chainsDonePerCareer: perCareer(sum(done.map((set) => set.size))),
    unlocks: offered.length,
    unlocksPerCareer: perCareer(offered.length),
    unlockCareers: samples.filter((c) => c.seasons.some((s) => s.events.unlocks.length > 0)).length,
    byUnlock: unlockOrder
      .map((unlock) => {
        const key = unlockKey(unlock);
        return {
          ...unlock,
          inCatalog: inCatalog.get(key) ?? 0,
          times: offered.filter((u) => unlockKey(u) === key).length,
          careers: samples.filter((c) => c.seasons.some((s) => s.events.unlocks.some((u) => unlockKey(u) === key))).length,
        };
      })
      .filter((row) => row.inCatalog > 0 || row.times > 0),
    sponsorOffers: sponsorOffers.length,
    sponsorOffersPerCareer: perCareer(sponsorOffers.length),
    sponsorProfiles: new Set(sponsorOffers).size,
    sponsorCatalog: SPONSOR_PROFILES.filter((p) => !p.chainOnly).length,
    sponsorRepeated,
    repeats: {
      story: sum(samples.map((c) => c.texts.story)),
      storyCareers: samples.filter((c) => c.texts.story > 0).length,
      all: sum(samples.map((c) => c.texts.all)),
      allCareers: samples.filter((c) => c.texts.all > 0).length,
      examples: repeatedExamples(samples),
    },
  };
}

/** Percentil pelo método do posto mais próximo (0,5 = mediana). */
export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] ?? 0;
}

function longestStay(seasons: readonly SeasonSample[]): number {
  let best = 0;
  let run = 0;
  seasons.forEach((s, i) => {
    run = i > 0 && seasons[i - 1]?.tier === s.tier ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function birthGroup(group: BirthGroupStats['group'], samples: readonly CareerSample[]): BirthGroupStats | null {
  if (samples.length === 0) return null;
  const scores = samples.map((c) => c.birth.score);
  const highest = samples.map((c) => Math.max(0, ...c.seasons.map((s) => s.tier)));
  const topTier = Math.max(...CATEGORIES.map((c) => c.tier));
  const debut = samples.flatMap((c) => c.seasons.filter((s) => s.season === 1).map((s) => s.position));
  return {
    group,
    careers: samples.length,
    averageScore: mean(scores),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    debutPosition: mean(debut),
    averageHighestTier: mean(highest),
    formulaShare: highest.filter((tier) => tier >= 4).length / samples.length,
    topShare: highest.filter((tier) => tier >= topTier).length / samples.length,
    titlesPerCareer: mean(samples.map((c) => c.seasons.filter((s) => s.title).length)),
    noSeatPerCareer: mean(samples.map((c) => c.seasons.filter((s) => s.seat === 'fallback').length)),
  };
}

/** Três grupos do mesmo tamanho (o do meio fica com a sobra) pela nota de nascença; empate pela semente. */
export function birthTerciles(samples: readonly CareerSample[]): [CareerSample[], CareerSample[], CareerSample[]] {
  const sorted = [...samples].sort((a, b) => a.birth.score - b.birth.score || a.seed - b.seed);
  const third = Math.floor(sorted.length / 3);
  return [sorted.slice(0, third), sorted.slice(third, sorted.length - third), sorted.slice(sorted.length - third)];
}

export function summarize(samples: readonly CareerSample[], options: SimOptions): SimSummary {
  const all = samples.flatMap((s) => s.seasons);
  const careers = samples.length;
  const share = (count: number) => (careers ? count / careers : 0);

  const byCategory = CATEGORIES.flatMap((category): CategoryStats[] => {
    const rows = all.filter((s) => s.categoryId === category.id);
    if (rows.length === 0) return [];
    const positions = rows.map((s) => s.position);
    return [
      {
        categoryId: category.id,
        tier: category.tier,
        seasons: rows.length,
        careers: samples.filter((c) => c.seasons.some((s) => s.categoryId === category.id)).length,
        averagePosition: mean(positions),
        medianPosition: percentile(positions, 0.5),
        bestPosition: Math.min(...positions),
        top3Share: rows.filter((s) => s.position <= 3).length / rows.length,
        titles: rows.filter((s) => s.title).length,
      },
    ];
  });

  const cashBySeason = Array.from({ length: options.seasons }, (_, i): CashStats | null => {
    const rows = all.filter((s) => s.season === i + 1);
    if (rows.length === 0) return null;
    const cash = rows.map((s) => s.cash);
    return {
      season: i + 1,
      careers: rows.length,
      p10: percentile(cash, 0.1),
      median: percentile(cash, 0.5),
      p90: percentile(cash, 0.9),
      negativeShare: rows.filter((s) => s.cash < 0).length / rows.length,
      medianNetWorth: percentile(
        rows.map((s) => s.netWorth),
        0.5,
      ),
    };
  }).filter((row): row is CashStats => row !== null);

  const arrivals = CATEGORIES.flatMap((category): ArrivalStats[] => {
    // Chegar é subir: a primeira temporada no degrau vindo de um degrau mais baixo (ou a estreia).
    // Quem pula um degrau pelo atalho e depois cai nele não "chegou" a ele.
    const firsts = samples.flatMap((c) => c.seasons.find((s, i) => s.categoryId === category.id && (i === 0 || (c.seasons[i - 1]?.tier ?? 0) < s.tier)) ?? []);
    if (firsts.length === 0) return [];
    const ages = firsts.map((s) => s.age);
    return [
      {
        categoryId: category.id,
        tier: category.tier,
        careers: firsts.length,
        share: share(firsts.length),
        averageAge: mean(ages),
        minAge: Math.min(...ages),
        maxAge: Math.max(...ages),
        averageSeason: mean(firsts.map((s) => s.season)),
      },
    ];
  });

  const topCategory = CATEGORIES.reduce((top, c) => (c.tier > top.tier ? c : top));
  const reachedTop = samples.filter((c) => c.seasons.some((s) => s.categoryId === topCategory.id)).length;
  const highestTier = CATEGORIES.map((category) => samples.filter((c) => Math.max(0, ...c.seasons.map((s) => s.tier)) === category.tier).length);

  const titlesPerCareer = samples.map((c) => c.seasons.filter((s) => s.title).length);
  const noSeatPerCareer = samples.map((c) => c.seasons.filter((s) => s.seat === 'fallback').length);
  const demotionsPerCareer = samples.map((c) => c.seasons.filter((s, i) => i > 0 && s.tier < (c.seasons[i - 1]?.tier ?? s.tier)).length);

  return {
    options,
    careers,
    seasonsPlayed: all.length,
    averageStartAge: mean(samples.map((c) => c.profile.age)),
    byCategory,
    cashBySeason,
    arrivals,
    top: { categoryId: topCategory.id, careers: reachedTop, share: share(reachedTop) },
    highestTier,
    titles: {
      total: sum(titlesPerCareer),
      perCareer: mean(titlesPerCareer),
      max: Math.max(0, ...titlesPerCareer),
      none: titlesPerCareer.filter((n) => n === 0).length,
      one: titlesPerCareer.filter((n) => n === 1).length,
      two: titlesPerCareer.filter((n) => n === 2).length,
      threeOrMore: titlesPerCareer.filter((n) => n >= 3).length,
    },
    noSeat: {
      seasons: sum(noSeatPerCareer),
      perCareer: mean(noSeatPerCareer),
      careers: noSeatPerCareer.filter((n) => n > 0).length,
      share: share(noSeatPerCareer.filter((n) => n > 0).length),
      noOffer: all.filter((s) => s.noSeatCause === 'no-offer').length,
      money: all.filter((s) => s.noSeatCause === 'money').length,
      requirements: all.filter((s) => s.noSeatCause === 'requirements').length,
    },
    demotions: { seasons: sum(demotionsPerCareer), perCareer: mean(demotionsPerCareer), careers: demotionsPerCareer.filter((n) => n > 0).length },
    longestStay: mean(samples.map((c) => longestStay(c.seasons))),
    roundsMissedPerSeason: mean(all.map((s) => s.roundsMissed)),
    interrupted: samples.filter((c) => c.ended === 'succession').length,
    byBirth: (['low', 'mid', 'high'] as const)
      .map((group, i) => birthGroup(group, birthTerciles(samples)[i] ?? []))
      .filter((row): row is BirthGroupStats => row !== null),
    byOrigin: [
      birthGroup(
        'capital',
        samples.filter((c) => c.birth.region === 'capital'),
      ),
      birthGroup(
        'interior',
        samples.filter((c) => c.birth.region === 'interior'),
      ),
      birthGroup(
        'talents',
        samples.filter((c) => c.birth.traitBalance > 0),
      ),
      birthGroup(
        'defects',
        samples.filter((c) => c.birth.traitBalance < 0),
      ),
    ].filter((row): row is BirthGroupStats => row !== null),
    doors: doorStats(samples),
    moments: momentStats(samples),
    events: eventStats(samples, options.seasons),
    dynasty: (options.generations ?? 1) >= 2 ? dynastyStats(samples.flatMap((c) => c.dynasty ?? [])) : null,
  };
}

export interface SimResult {
  samples: CareerSample[];
  summary: SimSummary;
}

/** Roda todas as carreiras pedidas. `onCareer` recebe o progresso (para a linha de comando). */
export function runSimulation(options: SimOptions, onCareer?: (done: number, total: number) => void): SimResult {
  const samples: CareerSample[] = [];
  for (let i = 0; i < options.seeds; i++) {
    samples.push(simulateCareer(options.firstSeed + i, options));
    onCareer?.(i + 1, options.seeds);
  }
  return { samples, summary: summarize(samples, options) };
}
