/**
 * O peso do sobrenome e a equipe da família (Fase 6).
 *
 * Da segunda geração em diante, quem corre carrega a fama de quem veio antes: as equipes olham com
 * mais atenção (contatos), a imprensa compara o tempo todo e um resultado ruim pesa mais. O peso vai
 * de 0 a 1 pela reputação máxima do antecessor mais famoso (SURNAME); na primeira geração é sempre
 * 0, e com peso 0 nada aqui muda a carreira nem consome sorteio.
 *
 * A equipe da família é a de que a família tem 100% (a participação que fica quando um dono passa o
 * comando a um herdeiro piloto). Correr por ela (ou pôr um filho na própria equipe, como dirigente)
 * rende conversa de favorecimento: ficar atrás do companheiro custa moral ou reputação, e bater o
 * companheiro cala a imprensa (FAMILY_TEAM).
 *
 * Os parentes nos boxes ou na direção de outras equipes também abrem portas (RELATIVES).
 *
 * Sorteios com nome próprio, só quando a regra vale: 'surname-press' e 'favoritism-press' (as
 * mensagens da imprensa). Os textos estão em `src/data/dynasty.ts`.
 */
import { FAMILY_TEAM, RELATIVES, SURNAME } from '@/config/balance';
import type { CareerState, DriverCandidate, InboxMessage, LineageEntry, Offer, RaceEntryResult, RoundRecord, TeamStake } from '@/domain/schemas';
import { categoryRef } from '@/domain/categoryNames';
import { FAVORITISM_PRESS_TEXTS, SURNAME_PRESS_TEXTS } from '@/data/dynasty';
import type { DriverStanding } from '../championship/standings';
import { fullName, getPlayer } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import { familyYear, isWorkingAge } from './relatives';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------------ */
/* O peso do sobrenome                                                 */
/* ------------------------------------------------------------------ */

/**
 * O peso do sobrenome (0 a 1): 0 na primeira geração; depois, a reputação máxima do antecessor mais
 * famoso, de SURNAME.FAME_FLOOR (peso 0) a 100 (peso 1).
 */
export function surnameWeight(career: Pick<CareerState, 'dynasty'>): number {
  const earlier = career.dynasty.lineage.slice(0, -1);
  if (earlier.length === 0) return 0;
  const peak = Math.max(...earlier.map((e) => e.peakReputation));
  return clamp((peak - SURNAME.FAME_FLOOR) / (100 - SURNAME.FAME_FLOOR), 0, 1);
}

/** Quem veio imediatamente antes na linhagem (null na primeira geração). */
export function predecessor(career: Pick<CareerState, 'dynasty'>): LineageEntry | null {
  const { lineage } = career.dynasty;
  return lineage.length >= 2 ? (lineage[lineage.length - 2] ?? null) : null;
}

/**
 * Interesse extra das equipes pelos contatos da família: o peso do sobrenome × SURNAME.CONTACTS_INTEREST,
 * mais RELATIVES.CONTACT_INTEREST por parente em idade de trabalho na engenharia ou na direção
 * esportiva (até RELATIVES.CONTACT_INTEREST_MAX). Na primeira geração, 0.
 */
export function familyContactsInterest(career: CareerState): number {
  const surname = surnameWeight(career) * SURNAME.CONTACTS_INTEREST;
  const year = familyYear(career);
  const insiders = career.dynasty.relatives.filter((r) => (r.path === 'engineer' || r.path === 'sportingDirector') && isWorkingAge(r, year)).length;
  return surname + Math.min(RELATIVES.CONTACT_INTEREST_MAX, insiders * RELATIVES.CONTACT_INTEREST);
}

/**
 * O que quem veio antes fazia na mesma idade, pelas temporadas arquivadas dessa pessoa: "corria na
 * Fórmula Júnior e terminou o ano em 3º", "ainda não tinha estreado", "já tinha parado de correr".
 */
export function predecessorAtAge(career: CareerState, entry: LineageEntry, age: number): string {
  const seasons = career.history.filter((s) => s.mode === 'driver' && s.season >= entry.fromSeason && (entry.toSeason === null || s.season <= entry.toSeason));
  const raced = seasons.flatMap((s) => {
    const row = s.driverStandings.find((d) => d.driverId === entry.driverId);
    return row ? [{ summary: s, row, age: s.year - entry.bornYear }] : [];
  });
  const same = raced.find((r) => r.age === age);
  if (same)
    return `corria ${categoryRef(same.summary.categoryId, 'em')} e terminou o ano em ${same.row.position}º${same.row.position === 1 ? ', com o título' : ''}`;
  if (raced.length === 0) return 'nunca tinha corrido, e mesmo assim o nome já abria portas';
  if (raced.every((r) => r.age > age)) return 'ainda nem tinha estreado nas pistas';
  if (raced.every((r) => r.age < age)) return 'já tinha parado de correr';
  return 'estava longe das pistas naquele ano';
}

/* ------------------------------------------------------------------ */
/* A equipe da família                                                 */
/* ------------------------------------------------------------------ */

/** A participação de 100% da família numa equipe (a equipe da família), se houver. */
export function familyTeamStake(career: Pick<CareerState, 'finance'>, categoryId: string, teamId: string): TeamStake | null {
  return career.finance.stakes.find((s) => s.share >= 1 && s.teamId === teamId && s.categoryId === categoryId) ?? null;
}

/** O piloto do jogador corre pela equipe da família (participação de 100% na equipe do contrato). */
export function racesForFamilyTeam(career: CareerState): boolean {
  return career.mode === 'driver' && familyTeamStake(career, career.contract.categoryId, career.contract.teamId) !== null;
}

/** A proposta é da equipe da família (para a tela marcar). */
export function isFamilyTeamOffer(career: Pick<CareerState, 'finance'>, offer: Pick<Offer, 'categoryId' | 'teamId'>): boolean {
  return familyTeamStake(career, offer.categoryId, offer.teamId) !== null;
}

/**
 * O aviso de favorecimento de um candidato a piloto que é filho do dirigente (para a tela do
 * fechamento). null para quem não é da família ou sem equipe.
 */
export function favoritismNote(career: CareerState, candidate: Pick<DriverCandidate, 'origin' | 'name'>): string | null {
  if (candidate.origin !== 'child' || !career.management) return null;
  return `${candidate.name} é da família: a imprensa vai falar em favorecimento. Cada etapa atrás do companheiro custa reputação à equipe, e terminar o ano atrás dele custa reputação a você e à equipe; terminar à frente cala a conversa.`;
}

/** Ficou atrás do companheiro na corrida: o companheiro terminou, e na frente (ou o outro abandonou). */
function behind(mine: RaceEntryResult | undefined, mate: RaceEntryResult | undefined): boolean {
  return mine !== undefined && mate?.status === 'finished' && (mine.status !== 'finished' || mine.position > mate.position);
}

/* ------------------------------------------------------------------ */
/* Por etapa                                                           */
/* ------------------------------------------------------------------ */

/** O que a etapa custa a quem carrega o sobrenome ou corre pela equipe da família (modo piloto). */
export interface PressureRound {
  /** Moral do piloto do jogador (zero ou negativa). */
  morale: number;
  messages: InboxMessage[];
}

/**
 * Pressão de uma etapa no modo piloto. Sobrenome: terminar fora dos SURNAME.ROUND_TOP primeiros (ou
 * abandonar) custa peso × SURNAME.ROUND_MORALE de moral, e a imprensa compara com quem veio antes
 * (chance SURNAME.PRESS_CHANCE). Equipe da família: terminar atrás do companheiro custa
 * FAMILY_TEAM.ROUND_MORALE de moral, e a imprensa fala em favorecimento (chance FAMILY_TEAM.PRESS_CHANCE).
 * Sem peso e sem equipe da família, nada muda e nada é sorteado.
 */
export function pressureRound(career: CareerState, record: RoundRecord): PressureRound {
  const out: PressureRound = { morale: 0, messages: [] };
  const player = getPlayer(career);
  const entry = record.race.entries.find((e) => e.driverId === player.id);
  if (!entry) return out;
  const { season } = career;
  const round = record.round;
  const msg = (id: string, text: { title: string; body: string }) =>
    out.messages.push({ id: `s${season}-r${round}-${id}`, date: record.date, category: 'media', title: text.title, body: text.body });

  const weight = surnameWeight(career);
  const before = predecessor(career);
  if (weight > 0 && before) {
    const good = entry.status === 'finished' && entry.position <= SURNAME.ROUND_TOP;
    if (!good) out.morale -= weight * SURNAME.ROUND_MORALE;
    const rng = createRng(hashSeed(career.seed, season, round, 'surname-press'));
    if (rng.next() < SURNAME.PRESS_CHANCE) {
      const text = SURNAME_PRESS_TEXTS[Math.floor(rng.next() * SURNAME_PRESS_TEXTS.length)];
      if (text) msg('surname-press', text({ predecessor: before.name, past: predecessorAtAge(career, before, player.age), good }));
    }
  }

  if (racesForFamilyTeam(career)) {
    const mate = career.drivers.find((d) => d.teamId === player.teamId && d.id !== player.id && d.role !== 'reserve');
    const mateEntry = mate ? record.race.entries.find((e) => e.driverId === mate.id) : undefined;
    if (mate && behind(entry, mateEntry)) {
      out.morale -= FAMILY_TEAM.ROUND_MORALE;
      const rng = createRng(hashSeed(career.seed, season, round, 'favoritism-press'));
      if (rng.next() < FAMILY_TEAM.PRESS_CHANCE) {
        const text = FAVORITISM_PRESS_TEXTS[Math.floor(rng.next() * FAVORITISM_PRESS_TEXTS.length)];
        const team = career.teams.find((t) => t.id === player.teamId)?.name ?? 'equipe';
        if (text) msg('favoritism-press', text({ driver: fullName(player), team, teammate: fullName(mate) }));
      }
    }
  }
  return out;
}

/** Os filhos do jogador que correm pela equipe que ele comanda, com o companheiro de cada um. */
function childrenInManagedTeam(career: CareerState): { childDriverId: string; mateId: string | null }[] {
  const m = career.management;
  if (!m) return [];
  const childIds = new Set(career.family.children.flatMap((c) => (c.driver ? [c.driver.id] : [])));
  const lineup = career.drivers.filter((d) => d.teamId === m.teamId && d.role !== 'reserve');
  return lineup
    .filter((d) => childIds.has(d.id))
    .map((d) => {
      const mate = lineup.find((x) => x.id !== d.id);
      // Dois filhos na mesma equipe: ninguém é favorecido em relação ao outro.
      return { childDriverId: d.id, mateId: mate && !childIds.has(mate.id) ? mate.id : null };
    });
}

/**
 * Favorecimento numa etapa do dirigente que pôs um filho na própria equipe: cada filho que terminou
 * atrás do companheiro custa FAMILY_TEAM.ROUND_TEAM_REPUTATION à reputação da equipe, e a imprensa
 * pode falar nisso (chance FAMILY_TEAM.PRESS_CHANCE). Sem filho na equipe, nada muda e nada é sorteado.
 */
export function favoritismExecutiveRound(career: CareerState, record: RoundRecord): { teamReputation: number; messages: InboxMessage[] } {
  const out = { teamReputation: 0, messages: [] as InboxMessage[] };
  const team = career.teams.find((t) => t.id === career.management?.teamId);
  for (const { childDriverId, mateId } of childrenInManagedTeam(career)) {
    if (!mateId) continue;
    const mine = record.race.entries.find((e) => e.driverId === childDriverId);
    const mate = record.race.entries.find((e) => e.driverId === mateId);
    if (!behind(mine, mate)) continue;
    out.teamReputation -= FAMILY_TEAM.ROUND_TEAM_REPUTATION;
    const rng = createRng(hashSeed(career.seed, career.season, record.round, 'favoritism-press', childDriverId));
    if (rng.next() < FAMILY_TEAM.PRESS_CHANCE) {
      const text = FAVORITISM_PRESS_TEXTS[Math.floor(rng.next() * FAVORITISM_PRESS_TEXTS.length)];
      const child = career.drivers.find((d) => d.id === childDriverId);
      const other = career.drivers.find((d) => d.id === mateId);
      if (text && child && other) {
        const words = text({ driver: fullName(child), team: team?.name ?? 'equipe', teammate: fullName(other) });
        out.messages.push({
          id: `s${career.season}-r${record.round}-favoritism-press-${childDriverId}`,
          date: record.date,
          category: 'media',
          title: words.title,
          body: words.body,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* No fechamento                                                       */
/* ------------------------------------------------------------------ */

/** O que o fechamento da temporada de piloto acrescenta à reputação (inteiro) e as notas. */
export interface PressureSeason {
  reputation: number;
  notes: string[];
}

/**
 * Pressão no fechamento da temporada de piloto. Sobrenome: uma queda de reputação pesa
 * peso × SURNAME.BAD_RESULT_WEIGHT a mais, e terminar na metade de trás do campeonato custa
 * peso × SURNAME.BACK_HALF_REPUTATION. Equipe da família: terminar atrás do companheiro custa
 * FAMILY_TEAM.SEASON_REPUTATION, e à frente rende FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION.
 * `after` é a reputação da temporada antes desta conta.
 */
export function pressureSeason(career: CareerState, standings: readonly DriverStanding[], after: number): PressureSeason {
  const out: PressureSeason = { reputation: 0, notes: [] };
  const player = getPlayer(career);
  const me = standings.find((s) => s.driverId === player.id);
  if (!me) return out;
  let extra = 0;
  const weight = surnameWeight(career);
  const before = predecessor(career);
  if (weight > 0 && before) {
    const drop = Math.max(0, career.reputation - after);
    const field = career.drivers.filter((d) => d.teamId !== null && d.role !== 'reserve').length;
    const backHalf = me.position > field / 2;
    const surname = drop * weight * SURNAME.BAD_RESULT_WEIGHT + (backHalf ? weight * SURNAME.BACK_HALF_REPUTATION : 0);
    if (Math.round(surname) > 0) {
      extra -= surname;
      out.notes.push(`Com o sobrenome de ${before.name}, a cobrança pesou: a temporada ruim custou mais reputação do que custaria a outro piloto.`);
    }
  }
  if (racesForFamilyTeam(career)) {
    const mate = career.drivers.find((d) => d.teamId === player.teamId && d.id !== player.id && d.role !== 'reserve');
    const rival = mate ? standings.find((s) => s.driverId === mate.id) : undefined;
    if (mate && rival) {
      if (rival.position < me.position) {
        extra -= FAMILY_TEAM.SEASON_REPUTATION;
        out.notes.push(`Na equipe da família, terminar atrás de ${fullName(mate)} deu munição a quem fala em favorecimento.`);
      } else {
        extra += FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION;
        out.notes.push(`Na equipe da família, terminar à frente de ${fullName(mate)} calou quem falava em favorecimento.`);
      }
    }
  }
  out.reputation = Math.round(extra);
  return out;
}

/**
 * Favorecimento no fechamento do dirigente que pôs um filho na própria equipe: cada filho que
 * terminou o campeonato atrás do companheiro custa FAMILY_TEAM.SEASON_TEAM_REPUTATION à equipe e
 * FAMILY_TEAM.SEASON_REPUTATION ao personagem; à frente, o personagem ganha
 * FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION.
 */
export function favoritismExecutiveSeason(career: CareerState, standings: readonly DriverStanding[]): { personal: number; team: number; notes: string[] } {
  const out = { personal: 0, team: 0, notes: [] as string[] };
  for (const { childDriverId, mateId } of childrenInManagedTeam(career)) {
    if (!mateId) continue;
    const mine = standings.find((s) => s.driverId === childDriverId);
    const mate = standings.find((s) => s.driverId === mateId);
    const child = career.drivers.find((d) => d.id === childDriverId);
    const other = career.drivers.find((d) => d.id === mateId);
    if (!mine || !mate || !child || !other) continue;
    if (mate.position < mine.position) {
      out.team -= FAMILY_TEAM.SEASON_TEAM_REPUTATION;
      out.personal -= FAMILY_TEAM.SEASON_REPUTATION;
      out.notes.push(`${fullName(child)} terminou o ano atrás de ${fullName(other)}, e a conversa de favorecimento custou reputação a você e à equipe.`);
    } else {
      out.personal += FAMILY_TEAM.SEASON_BEAT_TEAMMATE_REPUTATION;
      out.notes.push(`${fullName(child)} terminou o ano à frente de ${fullName(other)} e calou quem falava em favorecimento.`);
    }
  }
  return out;
}
