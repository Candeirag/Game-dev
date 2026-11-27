/**
 * Saves de exemplo de cada versão do formato (tests/fixtures/vN).
 *
 * Os das versões antigas são registros: foram gravados pelo jogo daquela época e nunca são
 * regravados. É com eles que se prova que um save antigo continua abrindo. Os da versão atual
 * saem das receitas abaixo; quando o formato muda (CAREER_SCHEMA_VERSION sobe), grave os novos com
 *
 *   UPDATE_FIXTURES=1 npx vitest run tests/fixtures.test.ts
 *
 * e os de antes ficam onde estão. Este teste falha se a versão atual não tiver os seus saves.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERITAGE } from '@/config/balance';
import { CAREER_SCHEMA_VERSION, type CareerState } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { BUSINESSES, PROPERTIES, STOCKS } from '@/data/assets';
import {
  activeTransition,
  beginHandover,
  buyProperty,
  drawBirth,
  buyStock,
  familyStaffRelativeId,
  favoritismNote,
  generationRecords,
  getCategory,
  getPlayer,
  heirSeatOptions,
  isFamilyStaff,
  isFamilyTeamOffer,
  isHeirBirth,
  lifeSummary,
  loanLimit,
  openBusiness,
  resolveSuccession,
  retireFromDriving,
  runPractice,
  runQualifying,
  setLineup,
  startExecutiveSeason,
  startNextSeason,
  startWeekend,
  stockPrice,
  takeLoan,
  transitionOffers,
  transitionWindow,
} from './engineApi';
import {
  NOW,
  botCareer,
  botExecutiveOffseason,
  botOffseason,
  botSuccession,
  botTraining,
  newCareer,
  pickBestOffer,
  playExecutiveRound,
  playLifeSeason,
  playRound,
  playSeason,
  resolvePending,
} from './helpers';

const ROOT = 'tests/fixtures';
const CURRENT = `${ROOT}/v${CAREER_SCHEMA_VERSION}`;

/** Receitas dos saves da versão atual: uma situação de jogo por arquivo. */
const RECIPES: Readonly<Record<string, () => CareerState>> = {
  /** Estreante no kart, quarta etapa, parado na hora da corrida. */
  'kart-na-largada': () => {
    let c = newCareer(4107);
    for (let i = 0; i < 3; i++) c = playRound(c);
    c = startWeekend(resolvePending(c));
    return runQualifying(runPractice(c, 'setup'), 'balanced');
  },
  /** Piloto talentoso no fim da primeira temporada de monopostos, com as propostas na mesa. */
  'monoposto-fim-de-temporada': () => {
    let c = botCareer(20260311, 9);
    for (let season = 0; season < 12; season++) {
      c = botTraining(c);
      while (c.nextRoundIndex < c.calendar.length) c = playRound(c);
      if (getCategory(c.categoryId).vehicle === 'formula') return c;
      c = startNextSeason(c, pickBestOffer(c));
    }
    throw new Error('O robô não chegou aos monopostos.');
  },
  /** Ex-piloto que pendurou o capacete cedo e comanda uma equipe, com três etapas disputadas. */
  'dirigente-no-meio-da-temporada': () => executiveMidSeason(),
  /** O mesmo dirigente no fechamento do ano, com ações, empréstimo e o que mais o caixa permitir de patrimônio. */
  'dirigente-fechamento-com-patrimonio': () => executiveSeasonEnd(),
  /** Passagem de comando em aberto: a sucessão espera a escolha do herdeiro. */
  'sucessao-pendente': () => beginHandover(executiveSeasonEnd()),
  /**
   * Nascimento (Fase 2): estreante nascido no interior depois da segunda etapa, com a mudança para
   * São Paulo esperando a decisão e o traço de estreia já revelado.
   */
  'nascimento-mudanca-pendente': () => {
    for (let seed = 1; seed < 500; seed++) {
      const birth = drawBirth(seed, 0, 'player');
      if (birth.region !== 'interior' || !birth.traits.some((t) => t.id === 'debutNerves' || t.id === 'bigStage')) continue;
      let c = newCareer(seed);
      for (let i = 0; i < 2; i++) c = playRound(c);
      if (c.pendingEvents.some((e) => e.definitionId === 'birth-move')) return c;
    }
    throw new Error('Nenhuma semente com nascimento no interior e traço de estreia.');
  },
  /**
   * Lances decisivos (Fase 4): estreante que respondeu a todos os lances da primeira etapa pela opção
   * mais arriscada e tocou num rival (a rivalidade nasce ali e vai para o registro), e na segunda
   * etapa não respondeu a nenhum: o piloto decidiu pelo estilo.
   */
  'lances-com-toque-e-rivalidade': () => {
    for (let seed = 1; seed < 500; seed++) {
      const c = playRound(newCareer(seed), { moments: 'bold' });
      if (c.relations.rivalryLog.some((touch) => touch.fresh)) return playRound(c);
    }
    throw new Error('Nenhuma semente com toque num lance da primeira etapa.');
  },
  /**
   * Eventos encadeados (Fase 5): o rival que nasceu no kart (cadeia "Velho conhecido") voltou ao grid
   * das fórmulas, e a memória guarda a pessoa, a cadeia no meio e os textos já vistos. Parado no
   * começo da primeira temporada nas fórmulas, com o cartão do reencontro pendente.
   */
  'historia-rival-do-kart-nas-formulas': () => {
    for (let seed = 1; seed < 400; seed++) {
      let c = botCareer(seed, 6);
      for (let season = 0; season < 10; season++) {
        c = botTraining(c);
        while (c.nextRoundIndex < c.calendar.length) c = playRound(c);
        // A mesma política de fim de ano do simulador: decisões resolvidas primeiro, e a porta paga só se abrir algo melhor.
        const next = botOffseason(resolvePending(c));
        c = startNextSeason(next.career, next.offerId);
        if (getCategory(c.categoryId).vehicle !== 'formula') continue;
        const rival = c.story.people.find((p) => p.key === 'rival-kart');
        const chain = c.story.chains.find((x) => x.id === 'velho-conhecido');
        if (!rival || chain?.status !== 'active' || !c.drivers.some((d) => d.id === rival.driverId)) break;
        // Algumas etapas até o reencontro com o rival sair: o save fica com o cartão da cadeia pendente.
        for (let round = 0; round < 4; round++) {
          c = playRound(c);
          if (c.pendingEvents.some((e) => e.chain?.id === 'velho-conhecido')) return c;
        }
        break;
      }
    }
    throw new Error('Nenhuma semente com o rival do kart de volta nas fórmulas.');
  },
  /** Eventos encadeados (Fase 5): um cartão pendente com uma escolha que só existe por causa de um traço ou do carisma. */
  'cartao-com-escolha-de-traco': () => {
    for (let seed = 1; seed < 400; seed++) {
      let c = newCareer(seed);
      for (let i = 0; i < 10; i++) {
        c = playRound(c);
        if (c.pendingEvents.some((e) => e.choices.some((choice) => choice.unlock))) return c;
      }
    }
    throw new Error('Nenhuma semente com escolha de traço em 10 etapas.');
  },

  /* As receitas da dinastia (Fase 6) saem todas da mesma família: ver `dynastyJourney`. */

  /** Pendurou o capacete no meio do ano (depois de um quarto do calendário): a janela do ano de transição está aberta. */
  'aposentadoria-no-meio-do-ano': () => {
    let c = dynastyJourney().lastDrivingSeason;
    const rounds = Math.floor(c.calendar.length / 4);
    for (let i = 0; i < rounds; i++) c = playRound(c);
    return retireFromDriving(resolvePending(c));
  },
  /** Fechamento de dirigente logo depois de pendurar o capacete: as propostas do ano de transição na mesa. */
  'fechamento-com-ano-de-transicao': () => dynastyJourney().retiredClosing,
  /** No meio do ano de transição (imagem de uma marca), com cachê recebido e um evento do ano pendente. */
  'ano-de-transicao-em-andamento': () => dynastyJourney().transitionYear,
  /**
   * Dirigente com equipe própria e quatro filhos, no começo da temporada: um já corre, um fez o teste no kart (com
   * traços revelados), um de 12 anos tem o teste na fila e o mais novo ainda não tem idade para ele.
   */
  'filhos-no-teste-do-kart': () => dynastyJourney().kartTestSeason,
  /**
   * Dirigente com equipe própria, no fechamento, com dois filhos entre os candidatos a piloto (com o aviso de
   * favorecimento) e um deles já escalado, ao lado de um piloto da equipe.
   */
  'dirigente-com-filho-piloto': () => {
    const c = dynastyJourney().childCandidatesClosing;
    const candidates = c.executiveOffseason?.candidates ?? [];
    const child = candidates.find((x) => x.origin === 'child' && x.willing);
    const mate = candidates.find((x) => x.origin === 'current' && x.willing);
    if (!child || !mate) throw new Error('O fechamento não tem um filho e um piloto da equipe entre os candidatos.');
    return setLineup(c, [child.driverId, mate.driverId]);
  },
  /**
   * Passagem de comando em vida com quatro filhos entre os herdeiros: três correm, e dois deles podem
   * largar numa equipe da frente ou na equipe da família, que corre na categoria deles.
   */
  'sucessao-com-varios-filhos': () => beginHandover(dynastyJourney().handoverClosing),
  /**
   * A 2ª geração nas pistas, três etapas depois da passagem de comando: a 1ª geração segue viva e no
   * controle da equipe, os irmãos seguiram caminhos diferentes (engenharia, direção esportiva,
   * negócios) e o nascimento do herdeiro tem os traços que o teste no kart e as temporadas revelaram.
   */
  'dinastia-segunda-geracao': () => {
    let c = heirSeason();
    for (let i = 0; i < 3; i++) c = playRound(c);
    return c;
  },
  /**
   * O fechamento da primeira temporada da 2ª geração: a equipe da família entre as propostas e os
   * apoios de legado (a empresa de um irmão e a marca do ano de transição da 1ª geração).
   */
  'herdeiro-com-equipe-da-familia': () => resolvePending(playSeason(heirSeason())),
  /**
   * Quem já não corria assumiu os negócios: a equipe da família segue na família, agora com a 2ª
   * geração no comando, e um irmão engenheiro no mercado de profissionais. Começo da temporada.
   */
  'segunda-geracao-dona-de-equipe': () => {
    const open = beginHandover(dynastyJourney().handoverClosing);
    // Um dos filhos adultos, de preferência quem já não corre; entre iguais, o mais velho.
    const heir = (open.succession?.heirs ?? [])
      .filter((h) => h.kind === 'child' && h.canManage)
      .sort((a, b) => Number(a.canDrive) - Number(b.canDrive) || b.age - a.age)[0];
    if (!heir) throw new Error('Nenhum filho adulto para assumir os negócios.');
    return botExecutiveOffseason(resolveSuccession(open, heir.id, 'executive'));
  },
};

/**
 * Os momentos da carreira de onde saem os saves da dinastia (Fase 6). É uma família só: a carreira da
 * semente 3, com o bônus de talento de um jogador excelente (quatro títulos no topo e quatro filhos).
 * O robô de sempre corre até pendurar o capacete no fechamento dos 36 anos; o ano de transição é o da
 * imagem de uma marca (que depois patrocina o herdeiro); no fechamento seguinte ele compra uma equipe
 * e, daí em diante, comanda a equipe enquanto os filhos crescem e correm. O comando passa em vida no
 * primeiro fechamento em que dois filhos vão correr na categoria da equipe da família.
 */
interface DynastyJourney {
  /** O começo da temporada dos 36 anos, a última como piloto. */
  lastDrivingSeason: CareerState;
  /** O fechamento dessa temporada, logo depois de pendurar o capacete. */
  retiredClosing: CareerState;
  /** O ano de transição, logo depois da primeira etapa que deixou um evento do ano pendente. */
  transitionYear: CareerState;
  /** O primeiro começo de temporada com um filho correndo, um testado, um de 12 anos com o teste na fila e um mais novo. */
  kartTestSeason: CareerState;
  /** O fechamento anterior ao da passagem de comando. */
  childCandidatesClosing: CareerState;
  /** O fechamento da passagem de comando, com as decisões pendentes resolvidas. */
  handoverClosing: CareerState;
}

/** A jornada é jogada uma vez só, pela primeira receita que pede (alguns segundos). */
let journey: DynastyJourney | null = null;

function dynastyJourney(): DynastyJourney {
  journey ??= playDynastyJourney();
  return journey;
}

function playDynastyJourney(): DynastyJourney {
  let c = botCareer(3, 8);
  let lastDrivingSeason: CareerState | null = null;
  for (let guard = 0; guard < 40 && c.mode === 'driver' && !c.succession; guard++) {
    if (!lastDrivingSeason && getPlayer(c).age >= 36) lastDrivingSeason = c;
    c = playLifeSeason(c, { retireAge: 36 });
  }
  if (!lastDrivingSeason || !c.executiveOffseason || c.succession) throw new Error('O robô não pendurou o capacete no fechamento dos 36 anos.');
  const retiredClosing = c;

  c = startExecutiveSeason(resolvePending(retiredClosing), { kind: 'transition', role: 'ambassador' });
  let transitionYear: CareerState | null = null;
  while (c.nextRoundIndex < c.calendar.length) {
    c = playExecutiveRound(c);
    if (!transitionYear && c.pendingEvents.some((e) => e.category === 'transition')) transitionYear = c;
  }
  if (!transitionYear) throw new Error('O ano de transição terminou sem nenhum evento do ano.');

  let kartTestSeason: CareerState | null = null;
  let childCandidatesClosing: CareerState | null = null;
  for (let guard = 0; guard < 30; guard++) {
    const closing = resolvePending(c);
    const teamCategory = closing.management?.categoryId;
    const inTeamCategory = closing.family.children.filter((k) => k.stage === 'racing' && teamCategory !== undefined && k.racing?.categoryId === teamCategory);
    if (inTeamCategory.length >= 2) {
      if (!kartTestSeason || !childCandidatesClosing) break;
      return { lastDrivingSeason, retiredClosing, transitionYear, kartTestSeason, childCandidatesClosing, handoverClosing: closing };
    }
    childCandidatesClosing = closing;
    c = botExecutiveOffseason(closing, { buyTeam: true });
    if (!kartTestSeason && kartTestSeasonStart(c)) kartTestSeason = c;
    while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playExecutiveRound(c);
    if (c.succession) throw new Error('A 1ª geração morreu antes da passagem de comando.');
  }
  throw new Error('A família não chegou aos momentos das receitas da dinastia.');
}

/** Começo de temporada com um filho correndo, um que já fez o teste no kart, um de 12 anos com o teste na fila e um mais novo. */
function kartTestSeasonStart(c: CareerState): boolean {
  const kids = c.family.children;
  const testPending = (id: string) => c.pendingEvents.some((e) => e.definitionId === `family-kart-test-${id}`);
  return (
    kids.some((k) => k.stage === 'racing') &&
    kids.some((k) => k.stage !== 'racing' && k.kartTest !== null) &&
    kids.some((k) => k.age === HERITAGE.KART_TEST_AGE && testPending(k.id)) &&
    kids.some((k) => k.age < HERITAGE.KART_TEST_AGE)
  );
}

/** O herdeiro piloto que o robô da dinastia escolhe (pelo que se vê, na melhor vaga ao alcance), no começo da 1ª temporada. */
function heirSeason(): CareerState {
  return botTraining(botSuccession(beginHandover(dynastyJourney().handoverClosing), { heirChoice: 'outlook' }));
}

function executiveMidSeason(): CareerState {
  let c = botCareer(3, 8);
  for (let guard = 0; guard < 60; guard++) {
    c = playLifeSeason(c, { retireAge: 22, buyTeam: true });
    if (c.mode === 'executive' && c.management && !c.succession && !c.executiveOffseason && c.rounds.length === 0) {
      for (let i = 0; i < 3; i++) c = playExecutiveRound(c);
      if (!c.succession) return c;
    }
  }
  throw new Error('O robô não chegou a comandar uma equipe.');
}

function executiveSeasonEnd(): CareerState {
  let c = executiveMidSeason();
  // Com a economia da Fase 3 o robô pendura o capacete sem dinheiro. O save de exemplo existe para
  // cobrir o patrimônio (ações, imóvel, empresa, empréstimo), então a receita garante um caixa mínimo.
  if (c.finance.cash < 60_000) c = { ...c, finance: { ...c.finance, cash: 60_000 } };
  // Patrimônio pessoal: ações sempre; imóvel e empresa, os mais baratos que o caixa e a reputação permitirem; e um empréstimo.
  const stock = [...STOCKS].sort((a, b) => a.startPrice - b.startPrice)[0]!;
  c = buyStock(c, stock.id, Math.max(1, Math.floor(Math.min(c.finance.cash * 0.1, 20_000) / stockPrice(c.finance, stock.id))));
  const property = [...PROPERTIES].sort((a, b) => a.price - b.price)[0]!;
  if (c.finance.cash >= property.price * 1.5) c = buyProperty(c, property.id, 'rented');
  const business = [...BUSINESSES].sort((a, b) => a.cost - b.cost).find((b) => c.reputation >= b.minReputation && c.finance.cash >= b.cost * 1.5);
  if (business) c = openBusiness(c, business.id);
  if (loanLimit(c) >= 5000) c = takeLoan(c, Math.min(loanLimit(c), 30_000), 2);
  while (!c.executiveOffseason && !c.succession) c = playExecutiveRound(c);
  if (c.succession) throw new Error('A carreira de exemplo acabou em sucessão antes do fechamento.');
  return resolvePending(c);
}

const versionFolders = () =>
  readdirSync(ROOT)
    .filter((name) => /^v\d+$/.test(name))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

const filesOf = (folder: string) =>
  readdirSync(`${ROOT}/${folder}`)
    .filter((name) => name.endsWith('.json'))
    .map((name) => `${ROOT}/${folder}/${name}`);

/** Versão gravada dentro de um arquivo de save, sem migrar nada. */
const storedVersion = (file: string) => (JSON.parse(readFileSync(file, 'utf8')) as { career: { schemaVersion: number } }).career.schemaVersion;

/** Um save da versão atual, pelo nome da receita. */
const current = (name: string) => importCareer(readFileSync(`${CURRENT}/${name}.json`, 'utf8'));

describe('saves de exemplo', () => {
  it.runIf(process.env.UPDATE_FIXTURES)(
    'grava os saves da versão atual',
    () => {
      mkdirSync(CURRENT, { recursive: true });
      for (const [name, build] of Object.entries(RECIPES)) {
        const career = build();
        expect(validateCareerIntegrity(career), name).toEqual([]);
        // O mesmo envelope que o jogo exporta, sem a indentação, para o arquivo pesar menos.
        writeFileSync(`${CURRENT}/${name}.json`, `${JSON.stringify(JSON.parse(exportCareer(career, NOW)))}\n`);
      }
    },
    600_000,
  );

  it('há uma pasta para cada versão do formato, da 1 à atual', () => {
    expect(versionFolders()).toEqual(Array.from({ length: CAREER_SCHEMA_VERSION }, (_, i) => `v${i + 1}`));
  });

  it('cada arquivo é mesmo da versão da pasta em que está (saves antigos não são regravados)', () => {
    for (const folder of versionFolders()) {
      for (const file of filesOf(folder)) expect(`${file}: v${storedVersion(file)}`).toBe(`${file}: ${folder}`);
    }
  });

  it('a versão atual tem os saves de todas as receitas', () => {
    for (const name of Object.keys(RECIPES)) expect(existsSync(`${CURRENT}/${name}.json`), `${CURRENT}/${name}.json`).toBe(true);
  });

  it('os saves da versão atual cobrem piloto na largada, fim de temporada e dirigente', () => {
    const careers = Object.fromEntries(Object.keys(RECIPES).map((name) => [name, importCareer(readFileSync(`${CURRENT}/${name}.json`, 'utf8'))]));
    expect(careers['kart-na-largada']).toMatchObject({ mode: 'driver', categoryId: 'kart-regional', weekend: { phase: 'race' } });
    expect(careers['monoposto-fim-de-temporada']?.offseason?.offers.length).toBeGreaterThan(0);
    expect(getCategory(careers['monoposto-fim-de-temporada']!.categoryId).vehicle).toBe('formula');
    expect(careers['dirigente-no-meio-da-temporada']).toMatchObject({ mode: 'executive', rounds: { length: 3 } });
    expect(careers['dirigente-no-meio-da-temporada']?.management).not.toBeNull();
  });

  it('e o nascimento: interior, mudança pendente e traço revelado', () => {
    const born = importCareer(readFileSync(`${CURRENT}/nascimento-mudanca-pendente.json`, 'utf8'));
    expect(born.birth).toMatchObject({ region: 'interior', movedSeason: null });
    expect(born.pendingEvents.some((e) => e.definitionId === 'birth-move')).toBe(true);
    expect(born.birth?.traits.some((t) => t.revealedSeason !== null)).toBe(true);
    expect(born.birth?.traits.some((t) => t.revealedSeason === null)).toBe(true);
  });

  it('e também patrimônio pessoal, fechamento de dirigente e sucessão em aberto', () => {
    const closing = importCareer(readFileSync(`${CURRENT}/dirigente-fechamento-com-patrimonio.json`, 'utf8'));
    expect(closing.executiveOffseason).not.toBeNull();
    expect(closing.finance.stocks.length).toBeGreaterThan(0);
    expect(closing.finance.loans.length).toBeGreaterThan(0);
    const handover = importCareer(readFileSync(`${CURRENT}/sucessao-pendente.json`, 'utf8'));
    expect(handover.succession).toMatchObject({ cause: 'handover' });
    expect(handover.succession?.heirs.length).toBeGreaterThan(0);
  });

  it('e os lances decisivos: respondidos pelo jogador, decididos pelo estilo e um toque que criou rivalidade', () => {
    const career = importCareer(readFileSync(`${CURRENT}/lances-com-toque-e-rivalidade.json`, 'utf8'));
    const [answered, byStyle] = career.rounds.map((round) => round.race.moments);
    expect(answered!.length).toBeGreaterThan(0);
    expect(answered!.every((moment) => !moment.auto)).toBe(true);
    expect(byStyle!.length).toBeGreaterThan(0);
    expect(byStyle!.every((moment) => moment.auto)).toBe(true);
    const touch = answered!.find((moment) => moment.contact);
    expect(touch?.rivalId).toBeDefined();
    expect(career.relations.rivalryLog[0]).toMatchObject({ driverId: touch!.rivalId, season: 1, round: 1, lap: touch!.lap, kind: touch!.kind, fresh: true });
    expect(career.relations.rivalries[touch!.rivalId!]).toBeGreaterThan(0);
    // Nos outros saves o robô não responde aos lances: as corridas que o piloto disputou têm os do estilo.
    const atTheGrid = importCareer(readFileSync(`${CURRENT}/kart-na-largada.json`, 'utf8'));
    const driven = atTheGrid.rounds.flatMap((round) => round.race.moments);
    expect(driven.length).toBeGreaterThan(0);
    expect(driven.every((moment) => moment.auto)).toBe(true);
  });

  it('e os eventos encadeados: o rival do kart de volta nas fórmulas, com a memória no meio da cadeia', () => {
    const career = importCareer(readFileSync(`${CURRENT}/historia-rival-do-kart-nas-formulas.json`, 'utf8'));
    expect(getCategory(career.categoryId).vehicle).toBe('formula');
    const rival = career.story.people.find((p) => p.key === 'rival-kart');
    expect(rival).toBeDefined();
    expect(getCategory(rival!.metCategoryId).vehicle).toBe('kart');
    expect(career.drivers.some((d) => d.id === rival!.driverId)).toBe(true);
    expect(career.story.chains.find((c) => c.id === 'velho-conhecido')?.steps.length).toBeGreaterThan(0);
    expect(career.pendingEvents.some((e) => e.chain?.id === 'velho-conhecido' && e.speaker)).toBe(true);
    expect(career.story.seen.length).toBeGreaterThan(10);
    const trait = importCareer(readFileSync(`${CURRENT}/cartao-com-escolha-de-traco.json`, 'utf8'));
    expect(trait.pendingEvents.some((e) => e.choices.some((c) => c.unlock))).toBe(true);
  });

  it('e a aposentadoria: a janela do ano de transição no meio do ano e no fechamento, e o ano em andamento', () => {
    const midseason = current('aposentadoria-no-meio-do-ano');
    expect(midseason).toMatchObject({ mode: 'executive', retiredSeason: midseason.season, transition: null, weekend: null });
    expect(midseason.rounds.length).toBeGreaterThan(0);
    expect(transitionWindow(midseason)).toBe('midseason');
    expect(transitionOffers(midseason).some((o) => o.available)).toBe(true);
    const closing = current('fechamento-com-ano-de-transicao');
    expect(closing.executiveOffseason).not.toBeNull();
    expect(transitionWindow(closing)).toBe('closing');
    expect(transitionOffers(closing).filter((o) => o.available).length).toBeGreaterThan(1);
    const year = current('ano-de-transicao-em-andamento');
    expect(activeTransition(year)).toMatchObject({ role: 'ambassador', done: false });
    expect(activeTransition(year)?.earnings).toBeGreaterThan(0);
    expect(year.pendingEvents.some((e) => e.category === 'transition')).toBe(true);
  });

  it('e a família: os filhos no teste do kart e o filho candidato a piloto do dirigente', () => {
    const family = current('filhos-no-teste-do-kart');
    const kids = family.family.children;
    expect(family.dynasty.generation).toBe(1);
    expect(kids.length).toBeGreaterThanOrEqual(3);
    expect(new Set(kids.map((k) => k.age)).size).toBe(kids.length);
    expect(kids.some((k) => k.stage === 'racing' && k.racing !== null)).toBe(true);
    const tested = kids.find((k) => k.stage !== 'racing' && k.kartTest !== null);
    expect(tested?.birthTraits.some((t) => t.revealedSeason !== null)).toBe(true);
    const next = kids.find((k) => k.age === HERITAGE.KART_TEST_AGE && k.kartTest === null);
    expect(next).toBeDefined();
    expect(family.pendingEvents.some((e) => e.definitionId === `family-kart-test-${next?.id}`)).toBe(true);
    expect(kids.some((k) => k.age < HERITAGE.KART_TEST_AGE)).toBe(true);

    const director = current('dirigente-com-filho-piloto');
    expect(director.management?.position).toBe('owner');
    const off = director.executiveOffseason;
    const children = off?.candidates.filter((x) => x.origin === 'child') ?? [];
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) expect(favoritismNote(director, child, off?.lineup)).not.toBeNull();
    expect(children.some((x) => off?.lineup.includes(x.driverId))).toBe(true);
  });

  it('e a sucessão: vários filhos, as vagas do herdeiro e a 2ª geração nas pistas', () => {
    const open = current('sucessao-com-varios-filhos');
    expect(open.succession?.cause).toBe('handover');
    const children = open.succession?.heirs.filter((h) => h.kind === 'child') ?? [];
    expect(children.length).toBeGreaterThanOrEqual(3);
    const seats = children.filter((h) => h.canDrive).map((h) => heirSeatOptions(open, h.id));
    expect(seats.length).toBeGreaterThanOrEqual(2);
    expect(seats.some((options) => options.some((o) => o.id === 'top' && o.available))).toBe(true);
    expect(seats.some((options) => options.some((o) => o.id === 'family' && o.available))).toBe(true);

    const heir = current('dinastia-segunda-geracao');
    const [founder, second] = heir.dynasty.lineage;
    expect(heir).toMatchObject({ mode: 'driver', weekend: null, dynasty: { generation: 2, lineage: { length: 2 } } });
    expect(heir.rounds.length).toBeGreaterThan(0);
    expect(heir.nextRoundIndex).toBeLessThan(heir.calendar.length);
    expect(founder).toMatchObject({ endReason: 'handover' });
    expect(founder?.traits.length).toBeGreaterThan(0);
    expect(founder?.partnerName).not.toBeNull();
    expect(second?.path).toBe('driver');
    expect(generationRecords(heir)[0]?.titles).toBeGreaterThan(0);
    expect(heir.dynasty.elders.map((e) => e.driverId)).toContain(founder?.driverId);
    expect(new Set(heir.dynasty.relatives.map((r) => r.path)).size).toBeGreaterThanOrEqual(2);
    expect(heir.birth !== null && isHeirBirth(heir.birth)).toBe(true);
    expect(heir.birth?.traits.some((t) => t.revealedSeason !== null)).toBe(true);
  });

  it('e o herdeiro: a proposta da equipe da família, os apoios de legado e a equipe da família nos negócios', () => {
    const closing = current('herdeiro-com-equipe-da-familia');
    expect(closing).toMatchObject({ mode: 'driver', dynasty: { generation: 2 } });
    expect(closing.offseason?.offers.some((o) => isFamilyTeamOffer(closing, o))).toBe(true);
    const legacy = closing.sponsors.filter((s) => s.tier === 0);
    const brand = legacy.find((s) => s.id === 'legacy-brand');
    expect(legacy.some((s) => s.id.startsWith('family-business-'))).toBe(true);
    // A empresa do irmão entra no apoio da família; a marca, entre os outros apoios sem meta.
    const support = lifeSummary(closing).sponsors;
    expect(support.familySupport).toBeGreaterThan(0);
    expect(support.otherSupport.map((s) => s.name)).toContain(brand?.name);

    const owner = current('segunda-geracao-dona-de-equipe');
    expect(owner).toMatchObject({ mode: 'executive', management: { position: 'owner' }, dynasty: { generation: 2 } });
    expect(owner.dynasty.lineage.at(-1)?.path).toBe('executive');
    const relatives = (owner.management?.staffMarket ?? []).filter(isFamilyStaff).map(familyStaffRelativeId);
    expect(relatives.length).toBeGreaterThan(0);
    for (const id of relatives) expect(owner.dynasty.relatives.some((r) => r.id === id)).toBe(true);
  });
});
