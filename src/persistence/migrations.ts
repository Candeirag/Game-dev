/**
 * Migrações de save entre versões do schema da carreira.
 *
 * Quando CAREER_SCHEMA_VERSION sobe, registra-se aqui uma função que converte
 * os dados da versão N para a N+1. Saves antigos passam por todas as migrações
 * em sequência antes de serem validados.
 *
 * Versão 1 → 2 (Fase 2): a carreira deixa de ser um campeonato único e ganha
 * categoria, contrato, finanças, licença, relações, eventos e fechamento de
 * temporada. Um save da Fase 1 vira uma carreira no kart regional, com os
 * novos sistemas no estado inicial e todo o histórico de resultados mantido.
 *
 * Versão 2 → 3 (Fase 3): entram o patrimônio pessoal (ações, imóveis,
 * empresas, participações, empréstimos), a família, a dinastia, a gestão de
 * equipe, a sucessão e o tutorial. É uma migração só de dados: acrescenta os
 * campos novos no estado inicial, sem chamar o motor do jogo. Um save da
 * Fase 2 continua exatamente de onde parou.
 */
import { CAREER_SCHEMA_VERSION, type CareerState, type Contract, type Driver, type Team } from '@/domain/schemas';
import { initialStockPrices } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { NEUTRAL_CONDITION } from '@/data/drivers';
import { initialTeams } from '@/data/teams';
import { ECONOMY, emptyFinance } from '@/engine/career/economy';
import { licensePointsFor } from '@/engine/career/license';
import { updateMarketInterest } from '@/engine/career/market';
import { closeSeason } from '@/engine/career/offseason';
import { fullName } from '@/engine/career/selectors';
import { familySupport } from '@/engine/career/sponsors';
import { overallRating } from '@/engine/simulation/performance';
import { generateReserve, rankTeams } from '@/engine/world/generation';

type Loose = Record<string, unknown>;
type Migration = (data: Loose) => Loose;

const list = (value: unknown): Loose[] => (Array.isArray(value) ? (value as Loose[]) : []);
const obj = (value: unknown): Loose => (value !== null && typeof value === 'object' ? (value as Loose) : {});

function migrateRoundV1(round: Loose): Loose {
  const qualifying = obj(round.qualifying);
  const race = obj(round.race);
  return {
    ...round,
    qualifying: { ...qualifying, entries: list(qualifying.entries).map((e) => ({ gridPenalty: 0, ...e })) },
    race: {
      safetyCars: 0,
      virtualSafetyCars: 0,
      redFlags: 0,
      teamOrders: [],
      ...race,
      entries: list(race.entries).map((e) => ({ pitStops: 0, penaltySeconds: 0, penaltyPoints: 0, damage: 0, injured: false, ...e })),
    },
  };
}

function migrateV1(data: Loose): Loose {
  const category = getCategory('kart-regional');
  const season = typeof data.season === 'number' ? data.season : 1;
  const seed = typeof data.seed === 'number' ? data.seed : 1;
  const reference = initialTeams('kart-regional');

  // Equipes: "kart" passa a se chamar "car"; equipe de box e afiliação vêm dos dados da categoria.
  const teams = list(data.teams).map((t) => {
    const { kart, ...rest } = t;
    const ref = reference.find((r) => r.id === t.id);
    return { ...rest, car: kart, crew: ref?.crew ?? 60, affiliation: null } as unknown as Team;
  });

  // Pilotos: em cada equipe, o de maior nível é o primeiro piloto.
  const base = list(data.drivers).map((d) => ({ ...d, role: null, contractEnd: 0, condition: { ...NEUTRAL_CONDITION }, injury: null }) as unknown as Driver);
  const drivers = base.map((d) => {
    if (!d.teamId) return d;
    const mates = base
      .filter((x) => x.teamId === d.teamId)
      .sort((a, b) => overallRating(b.attributes) - overallRating(a.attributes) || a.id.localeCompare(b.id));
    return { ...d, role: mates[0]?.id === d.id ? ('first' as const) : ('second' as const), contractEnd: season };
  });
  const ranked = rankTeams(teams);
  const usedNames = new Set(drivers.map(fullName));
  for (const team of ranked) drivers.push(generateReserve(category, team, ranked.indexOf(team), seed, season, usedNames));

  const player = drivers.find((d) => d.isPlayer);
  const playerTeam = teams.find((t) => t.id === player?.teamId);
  if (!player || !playerTeam) throw new Error('Save da versão 1 sem piloto do jogador ou sem equipe.');
  const rank = ranked.findIndex((t) => t.id === playerTeam.id);
  const [seatTop, seatBottom] = category.economy.seatCost;
  const contract: Contract = {
    teamId: playerTeam.id,
    categoryId: category.id,
    role: player.role === 'first' ? 'first' : 'second',
    startSeason: season,
    endSeason: season,
    salary: 0,
    seatCost: Math.round(((seatTop + (seatBottom - seatTop) * (rank / 9)) * 0.75) / 500) * 500,
    bonuses: { win: 0, podium: 0, point: 0, title: 0 },
    clauses: { releaseFee: 0, performanceTarget: null },
  };

  const teamName = (id: unknown) => teams.find((t) => t.id === id)?.name ?? String(id);
  const history = list(data.history).map(
    (h): Loose => ({
      ...h,
      categoryId: category.id,
      playerTeamName: teamName(h.playerTeamId),
      teamColors: Object.fromEntries(teams.map((t) => [t.id, t.color])),
      rounds: list(h.rounds).map(migrateRoundV1),
    }),
  );

  const weekendV1 = data.weekend === null || data.weekend === undefined ? null : obj(data.weekend);
  const weekend = weekendV1 && {
    ...weekendV1,
    qualifying: weekendV1.qualifying
      ? { ...obj(weekendV1.qualifying), entries: list(obj(weekendV1.qualifying).entries).map((e) => ({ gridPenalty: 0, ...e })) }
      : null,
    entrants: drivers.filter((d) => d.teamId && d.role !== 'reserve').map((d) => ({ driverId: d.id, teamId: d.teamId })),
    playerParticipates: true,
  };

  const migrated = {
    ...data,
    schemaVersion: CAREER_SCHEMA_VERSION,
    status: 'active',
    categoryId: category.id,
    drivers,
    teams,
    weekend,
    rounds: list(data.rounds).map(migrateRoundV1),
    adjustments: [],
    gridPenalties: {},
    trainingIntensity: 'normal',
    contract,
    finance: emptyFinance(ECONOMY.STARTING_CASH),
    sponsors: season <= ECONOMY.FAMILY_SUPPORT_SEASONS ? [familySupport()] : [],
    academy: null,
    license: {
      history: history.map((h) => ({
        season: Number(h.season),
        categoryId: category.id,
        position: Number(h.playerPosition),
        points: licensePointsFor(category.id, Number(h.playerPosition)),
      })),
      penaltyPoints: 0,
      banRounds: 0,
    },
    relations: { teamTrust: 50, teammate: 50, rivalries: {} },
    marketInterest: {},
    pendingEvents: [],
    eventLog: [],
    offseason: null,
    history,
  } as unknown as CareerState;

  // O fechamento de temporada de um save parado no fim do ano é feito depois de todas as
  // migrações (ver migrateCareerData), quando os dados já estão no formato atual.
  const career: CareerState = { ...migrated, marketInterest: updateMarketInterest(migrated, 1) };
  return career as unknown as Loose;
}

function migrateV2(data: Loose): Loose {
  const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const text = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
  const season = num(data.season, 1);
  const year = num(data.year, 2027);
  const player = list(data.drivers).find((d) => d.id === data.playerDriverId) ?? {};
  const name = `${text(player.firstName, 'Piloto')} ${text(player.lastName, '')}`.trim();
  const history: Loose[] = list(data.history).map((h) => ({ mode: 'driver', ...h }));
  // Categoria mais alta já disputada, para o registro da linhagem.
  const tierOf = (id: unknown) => {
    try {
      return getCategory(id as CareerState['categoryId']).tier;
    } catch {
      return 0;
    }
  };
  const best = [...history.map((h) => h.categoryId), data.categoryId].reduce((top, id) => (tierOf(id) > tierOf(top) ? id : top), data.categoryId);
  const started = season > 1 || list(data.rounds).length > 0;
  return {
    ...data,
    mode: 'driver',
    history,
    finance: {
      ...obj(data.finance),
      stocks: [],
      stockPrices: initialStockPrices(),
      properties: [],
      businesses: [],
      stakes: [],
      loans: [],
      lifestyle: 'frugal',
    },
    family: { partner: null, children: [], divorces: 0 },
    dynasty: {
      generation: 1,
      surname: text(player.lastName, 'Família'),
      lineage: [
        {
          generation: 1,
          driverId: text(data.playerDriverId, 'player'),
          name,
          bornYear: year - num(player.age, 16),
          fromSeason: 1,
          toSeason: null,
          endReason: null,
          bestCategoryId: best,
          titles: 0,
          wins: 0,
          peakReputation: Math.min(100, Math.max(0, num(data.reputation, 10))),
          netWorthPassed: null,
        },
      ],
    },
    management: null,
    executiveOffseason: null,
    executiveLog: [],
    succession: null,
    // Quem já tinha uma carreira em andamento não precisa do tutorial.
    tutorial: { done: [], dismissed: started },
  };
}

/** Chave: versão de origem. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1, 2: migrateV2 };

export function migrateCareerData(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  let data = raw as Loose;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  const original = version;
  if (version > CAREER_SCHEMA_VERSION) {
    throw new Error(`Save criado por uma versão mais nova do jogo (schema ${version}).`);
  }
  while (version < CAREER_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Não há migração do schema ${version} para ${version + 1}.`);
    data = { ...migrate(data), schemaVersion: version + 1 };
    version += 1;
  }
  // Um save da versão 1 parado no fim da temporada precisa do fechamento, que só existe a partir
  // da versão 2. Ele é calculado aqui, com os dados já no formato atual.
  if (
    original === 1 &&
    Array.isArray(data.calendar) &&
    typeof data.nextRoundIndex === 'number' &&
    data.nextRoundIndex >= data.calendar.length &&
    data.weekend === null &&
    !data.offseason
  ) {
    data = closeSeason(data as unknown as CareerState) as unknown as Loose;
  }
  return data;
}
