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
import { CAREER_SCHEMA_VERSION, type CareerState } from '@/domain/schemas';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { BUSINESSES, PROPERTIES, STOCKS } from '@/data/assets';
import {
  beginHandover,
  buyProperty,
  drawBirth,
  buyStock,
  getCategory,
  loanLimit,
  openBusiness,
  runPractice,
  runQualifying,
  startNextSeason,
  startWeekend,
  stockPrice,
  takeLoan,
} from './engineApi';
import { NOW, botCareer, botOffseason, botTraining, newCareer, pickBestOffer, playExecutiveRound, playLifeSeason, playRound, resolvePending } from './helpers';

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
};

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
});
