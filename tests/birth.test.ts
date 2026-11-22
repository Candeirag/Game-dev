/**
 * Nascimento (Fase 2): sorteio, efeitos na ficha e na pista, revelação dos talentos e defeitos
 * ocultos (um teste por gatilho), mudança para São Paulo e o nascimento que só vale para quem o
 * sorteou.
 */
import { describe, expect, it } from 'vitest';
import { APTITUDE_LINKS, BIRTH, TRAIT_EFFECTS } from '@/config/balance';
import { TRAIT_IDS, type Birth, type CareerState, type RaceEvent, type RoundRecord, type TraitId } from '@/domain/schemas';
import { BIRTH_TRAITS, FATHER_PROFESSIONS, HOMETOWNS, MOTHER_PROFESSIONS } from '@/data/birth';
import { getTrack } from '@/data/tracks';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { profileForSeed } from '../sim/run';
import {
  activeBirth,
  birthAttributeBonus,
  birthPotentialBonus,
  birthRaceProfile,
  birthScore,
  birthTrainingFactor,
  buildRaceContext,
  buildSponsor,
  createCareer,
  drawBirth,
  getCategory,
  getPlayer,
  isDebutRound,
  livesInInterior,
  longRaceWeight,
  maxBirthRerolls,
  neutralRaceProfile,
  overallRating,
  resolveEvent,
  revealTraits,
  revealTriggers,
  simulateRemainingRace,
  sponsorValueFactor,
  startNextSeason,
  startPositionChange,
  validateNewCareerInput,
  type RevealContext,
} from './engineApi';
import { DEFAULT_INPUT, NOW, botTraining, newCareer, pickBestOffer, playRound, resolvePending } from './helpers';
import { WET, raceSetup } from './raceSetup';

/** A carreira com o nascimento trocado (aptidões e traços escolhidos à mão), para isolar um efeito. */
function withBirth(career: CareerState, patch: Partial<Birth>): CareerState {
  return { ...career, birth: { ...career.birth!, ...patch } };
}
const traits = (...ids: TraitId[]) => ids.map((id) => ({ id, revealedSeason: null, revealedRound: null }));
const flat = { reflexes: 50, physique: 50, intelligence: 50, composure: 50, charisma: 50 };

/** Primeira semente (a partir de `from`) cujo nascimento satisfaz a condição. */
function seedWhere(test: (birth: Birth) => boolean, from = 1): number {
  for (let seed = from; seed < from + 500; seed++) if (test(drawBirth(seed, 0, 'player'))) return seed;
  throw new Error('Nenhuma semente encontrada.');
}

describe('sorteio do nascimento', () => {
  it('a mesma semente e o mesmo sorteio dão sempre o mesmo nascimento', () => {
    expect(drawBirth(4107, 0, 'player')).toEqual(drawBirth(4107, 0, 'player'));
    expect(drawBirth(4107, 2, 'player')).toEqual(drawBirth(4107, 2, 'player'));
    // A carreira grava exatamente o nascimento sorteado, e o save o guarda.
    const career = newCareer(4107, { birthAttempt: 2 });
    expect(career.birth).toEqual(drawBirth(4107, 2, 'player'));
    expect(importCareer(exportCareer(career, NOW)).birth).toEqual(career.birth);
  });

  it('sortear de novo dá outro nascimento, e a tentativa fica registrada', () => {
    const first = drawBirth(4107, 0, 'player');
    const second = drawBirth(4107, 1, 'player');
    expect(second).not.toEqual(first);
    expect(first.rerolls).toBe(0);
    expect(second.rerolls).toBe(1);
    // Outra semente também muda o nascimento.
    expect(drawBirth(4108, 0, 'player')).not.toEqual(first);
  });

  it('em 300 nascimentos: metade na capital, aptidões em 15–95, três traços sem par oposto, família pobre', () => {
    const births = Array.from({ length: 300 }, (_, i) => drawBirth(i + 1, 0, 'player'));
    const capital = births.filter((b) => b.region === 'capital').length;
    expect(capital).toBeGreaterThan(120);
    expect(capital).toBeLessThan(180);
    for (const b of births) {
      const town = HOMETOWNS.find((h) => h.id === b.hometownId)!;
      expect(town.region).toBe(b.region);
      expect(MOTHER_PROFESSIONS.some((p) => p.id === b.parents.mother)).toBe(true);
      expect(FATHER_PROFESSIONS.some((p) => p.id === b.parents.father)).toBe(true);
      expect(b.origin).toBe('humble');
      for (const value of Object.values(b.aptitudes)) {
        expect(value).toBeGreaterThanOrEqual(BIRTH.APTITUDE_MIN);
        expect(value).toBeLessThanOrEqual(BIRTH.APTITUDE_MAX);
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(b.traits).toHaveLength(3);
      const ids = b.traits.map((t) => t.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids.some((id) => ids.includes(BIRTH_TRAITS[id].opposite))).toBe(false);
      expect(ids.filter((id) => BIRTH_TRAITS[id].kind === 'talent').length).toBeGreaterThanOrEqual(1);
      expect(ids.filter((id) => BIRTH_TRAITS[id].kind === 'defect').length).toBeGreaterThanOrEqual(1);
      expect(b.traits.every((t) => t.revealedSeason === null)).toBe(true);
      // Pouco e por pouco tempo: menos do que os R$ 30.000 e os R$ 24.000 por cinco anos de antes.
      expect(b.savings).toBeLessThan(33_000);
      expect(b.support.perSeason).toBeLessThanOrEqual(24_000);
      expect(b.support.seasons).toBeLessThan(5);
    }
    // Todos os traços aparecem em algum nascimento.
    expect(new Set(births.flatMap((b) => b.traits.map((t) => t.id))).size).toBe(TRAIT_IDS.length);
  });

  it('o catálogo tem pelo menos 12 traços, metade talentos e metade defeitos, em pares opostos', () => {
    expect(TRAIT_IDS.length).toBeGreaterThanOrEqual(12);
    const talents = TRAIT_IDS.filter((id) => BIRTH_TRAITS[id].kind === 'talent');
    expect(talents.length * 2).toBe(TRAIT_IDS.length);
    for (const id of TRAIT_IDS) {
      const opposite = BIRTH_TRAITS[id].opposite;
      expect(BIRTH_TRAITS[opposite].opposite).toBe(id);
      expect(BIRTH_TRAITS[opposite].kind).not.toBe(BIRTH_TRAITS[id].kind);
      expect(revealTriggers[id]).toBeTypeOf('function');
      expect(TRAIT_EFFECTS[id]).toBeDefined();
    }
  });

  it('o sorteio pode ser refeito três vezes de graça; o motor aceita até o teto do premium e recusa além', () => {
    expect(BIRTH.FREE_REROLLS).toBe(3);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, birthAttempt: 3 })).toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, birthAttempt: maxBirthRerolls() })).toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, birthAttempt: maxBirthRerolls() + 1 })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, birthAttempt: -1 })).not.toEqual([]);
    expect(validateNewCareerInput({ ...DEFAULT_INPUT, birthAttempt: 1.5 })).not.toEqual([]);
    expect(() => drawBirth(1, -1, 'player')).toThrow();
  });
});

describe('corpo e mente na ficha inicial', () => {
  it('cada aptidão soma nos atributos ligados; aptidão 50 não muda nada', () => {
    expect(birthAttributeBonus(flat)).toEqual({ pace: 0, overtaking: 0, focus: 0, wetSkill: 0, racecraft: 0, tyreManagement: 0, consistency: 0, defending: 0 });
    const quick = birthAttributeBonus({ ...flat, reflexes: 80 });
    expect(quick.pace).toBe(Math.round(30 * APTITUDE_LINKS.reflexes.pace));
    expect(quick.overtaking).toBe(Math.round(30 * APTITUDE_LINKS.reflexes.overtaking));
    expect(birthAttributeBonus({ ...flat, composure: 20 }).consistency).toBe(Math.round(-30 * APTITUDE_LINKS.composure.consistency));
    // O carisma não mexe em atributo de pilotagem.
    expect(birthAttributeBonus({ ...flat, charisma: 95 })).toEqual(birthAttributeBonus(flat));
    expect(birthPotentialBonus({ ...flat, reflexes: 90, physique: 90, intelligence: 90, composure: 90 })).toBe(4);
    expect(birthPotentialBonus(flat)).toBe(0);
    expect(birthScore({ reflexes: 40, physique: 50, intelligence: 60, composure: 70, charisma: 80 })).toBe(60);
  });

  it('a carreira nasce com os atributos, o potencial, o caixa e o apoio que o nascimento deu', () => {
    const career = newCareer(4107);
    const birth = career.birth!;
    const player = getPlayer(career);
    const bonus = birthAttributeBonus(birth.aptitudes);
    // Perfil "talento natural" com 4 pontos livres em velocidade e consistência.
    expect(player.attributes.pace).toBe(70 + 4 + (bonus.pace ?? 0));
    expect(player.attributes.consistency).toBe(54 + 4 + (bonus.consistency ?? 0));
    expect(player.potential).toBe(92 + birthPotentialBonus(birth.aptitudes));
    expect(career.finance.cash).toBe(birth.savings);
    expect(career.sponsors).toEqual([expect.objectContaining({ id: 'family', perSeason: birth.support.perSeason, endSeason: birth.support.seasons })]);
    expect(career.playerSeasonStartAttributes).toEqual(player.attributes);
    expect(validateCareerIntegrity(career)).toEqual([]);
  });

  it('quem nasce no interior começa na equipe menor do regional; quem nasce na capital escolhe', () => {
    const interior = newCareer(
      seedWhere((b) => b.region === 'interior'),
      { teamId: 'horizonte' },
    );
    expect(getPlayer(interior).teamId).toBe(BIRTH.INTERIOR_TEAM_ID);
    expect(interior.contract.teamId).toBe(BIRTH.INTERIOR_TEAM_ID);
    expect(livesInInterior(interior)).toBe(true);
    expect(validateCareerIntegrity(interior)).toEqual([]);
    const capital = newCareer(
      seedWhere((b) => b.region === 'capital'),
      { teamId: 'horizonte' },
    );
    expect(getPlayer(capital).teamId).toBe('horizonte');
    expect(livesInInterior(capital)).toBe(false);
  });
});

describe('modificadores na pista', () => {
  const base = newCareer(4107);

  it('sem aptidões fora de 50 e sem traços, o perfil é o neutro', () => {
    const plain = withBirth(base, { aptitudes: flat, traits: [] });
    const track = getTrack(plain.calendar[0]!.trackId);
    expect(birthRaceProfile(plain, track, getCategory('kart-regional'), 2)).toEqual(neutralRaceProfile());
  });

  it('cada talento e defeito vira o seu modificador; os de estreia só valem na estreia', () => {
    const track = getTrack(base.calendar[0]!.trackId);
    const kart = getCategory('kart-regional');
    const profile = (...ids: TraitId[]) => birthRaceProfile(withBirth(base, { aptitudes: flat, traits: traits(...ids) }), track, kart, 1)!;
    expect(profile('rainMaster').wetPace).toBe(TRAIT_EFFECTS.rainMaster.wetPace);
    expect(profile('rainFear').wetError).toBe(TRAIT_EFFECTS.rainFear.wetError);
    expect(profile('bornStarter')).toMatchObject({ startSpread: TRAIT_EFFECTS.bornStarter.startSpread, startGain: TRAIT_EFFECTS.bornStarter.startGain });
    expect(profile('tyreEater').tyreWear).toBe(TRAIT_EFFECTS.tyreEater.tyreWear);
    expect(profile('qualifyingKing').qualifying).toBe(TRAIT_EFFECTS.qualifyingKing.qualifying);
    expect(profile('fragile').injury).toBe(TRAIT_EFFECTS.fragile.injury);
    expect(profile('hothead')).toMatchObject({ collision: TRAIT_EFFECTS.hothead.collision, attack: TRAIT_EFFECTS.hothead.attack });
    expect(profile('debutNerves')).toMatchObject({ pace: TRAIT_EFFECTS.debutNerves.debutPace, error: TRAIT_EFFECTS.debutNerves.debutError });
    // Fora da estreia, o nervoso corre normal.
    const later = birthRaceProfile(withBirth(base, { aptitudes: flat, traits: traits('debutNerves') }), track, kart, 2)!;
    expect(later).toMatchObject({ pace: 0, error: 1 });
  });

  it('físico pesa nas provas longas (não no kart) e na chuva; frieza nas disputas e na última volta; reflexo na largada', () => {
    const kart = getCategory('kart-regional');
    const top = getCategory('f1');
    const kartTrack = getTrack(kart.trackIds[0]!);
    const topTrack = getTrack(top.trackIds[0]!);
    expect(longRaceWeight(kartTrack, kart)).toBe(0);
    expect(longRaceWeight(topTrack, top)).toBe(1);
    const strong = withBirth(base, { aptitudes: { ...flat, physique: 90, composure: 90, reflexes: 90 }, traits: [] });
    expect(birthRaceProfile(strong, kartTrack, kart, 2)!.fatigue).toBe(1);
    const topProfile = birthRaceProfile(strong, topTrack, top, 2)!;
    expect(topProfile.fatigue).toBeLessThan(0.8);
    expect(topProfile.wetPace).toBeLessThan(0);
    expect(topProfile.duel).toBeGreaterThan(0);
    expect(topProfile.lastLapDuel).toBeGreaterThan(0);
    expect(topProfile.lastLapError).toBeLessThan(1);
    expect(topProfile.startSpread).toBeLessThan(1);
    const weak = birthRaceProfile(withBirth(base, { aptitudes: { ...flat, physique: 15, composure: 15 }, traits: [] }), topTrack, top, 2)!;
    expect(weak.fatigue).toBeGreaterThan(1);
    expect(weak.duel).toBeLessThan(0);
  });

  it('o perfil entra no contexto da corrida só para o jogador sorteado', () => {
    let c = playRound(newCareer(4107));
    c = resolvePending(c);
    const ctx = buildRaceContext({ ...c, weekend: { round: 2, phase: 'race', practice: null, qualifying: null, entrants: [], playerParticipates: true } });
    expect(Object.keys(ctx.profiles ?? {})).toEqual([c.playerDriverId]);
    const legacy = buildRaceContext({
      ...c,
      birth: null,
      weekend: { round: 2, phase: 'race', practice: null, qualifying: null, entrants: [], playerParticipates: true },
    });
    expect(legacy.profiles).toBeUndefined();
  });

  it('no motor de corrida, o gênio na chuva anda mais com pista molhada e o medo de chuva, menos; a sorte dos outros não muda', () => {
    const setup = raceSetup('kart-regional');
    const id = setup.playerId;
    const run = (profile: ReturnType<typeof neutralRaceProfile> | null, seed: number) => {
      const ctx = profile ? { ...setup.ctx, profiles: { [id]: profile } } : setup.ctx;
      return simulateRemainingRace(setup.start(seed, WET), ctx, { mode: 'balanced', auto: true });
    };
    const car = (state: ReturnType<typeof run>) => state.cars.find((c) => c.driverId === id)!;
    // Uma corrida em que o piloto termina (o perfil não muda os sorteios: se ele termina sem perfil, termina com).
    const seed = Array.from({ length: 40 }, (_, i) => 31 + i).find((s) => car(run(null, s)).status === 'running')!;
    const average = (state: ReturnType<typeof run>) => car(state).totalTime / car(state).lapsCompleted;
    const neutral = run(null, seed);
    const genius = run({ ...neutralRaceProfile(), wetPace: TRAIT_EFFECTS.rainMaster.wetPace }, seed);
    const fearful = run({ ...neutralRaceProfile(), wetPace: TRAIT_EFFECTS.rainFear.wetPace }, seed);
    expect(average(genius)).toBeLessThan(average(neutral));
    expect(average(fearful)).toBeGreaterThan(average(neutral));
    // Um perfil neutro explícito é exatamente o mesmo que nenhum perfil.
    expect(run(neutralRaceProfile(), seed)).toEqual(neutral);
  });

  it('largador nato e largada sonolenta mudam a primeira volta', () => {
    const setup = raceSetup('kart-regional');
    const id = setup.playerId;
    const firstLap = (profile: ReturnType<typeof neutralRaceProfile>) => {
      const ctx = { ...setup.ctx, profiles: { [id]: profile } };
      const state = simulateRemainingRace(setup.start(12), ctx, { mode: 'balanced', auto: true });
      return state;
    };
    const fast = firstLap({ ...neutralRaceProfile(), startSpread: 0.7, startGain: -0.25 });
    const slow = firstLap({ ...neutralRaceProfile(), startSpread: 1.3, startGain: 0.25 });
    const time = (s: typeof fast) => s.cars.find((c) => c.driverId === id)!.totalTime;
    expect(time(fast)).toBeLessThan(time(slow));
  });

  it('aprende rápido treina mais; aprende devagar, menos; o interior tira estrutura até a mudança', () => {
    const capital = newCareer(seedWhere((b) => b.region === 'capital'));
    expect(birthTrainingFactor(withBirth(capital, { traits: traits('quickLearner') }))).toBeCloseTo(1.2);
    expect(birthTrainingFactor(withBirth(capital, { traits: traits('slowLearner') }))).toBeCloseTo(0.85);
    expect(birthTrainingFactor(withBirth(capital, { traits: [] }))).toBe(1);
    const interior = newCareer(seedWhere((b) => b.region === 'interior'));
    expect(birthTrainingFactor(withBirth(interior, { traits: [] }))).toBe(BIRTH.INTERIOR_TRAINING_FACTOR);
    expect(birthTrainingFactor(withBirth(interior, { traits: [], movedSeason: 1 }))).toBe(1);
  });

  it('o carisma sobe ou desce o valor das propostas de patrocínio', () => {
    const charming = withBirth(base, { aptitudes: { ...flat, charisma: 90 } });
    const shy = withBirth(base, { aptitudes: { ...flat, charisma: 15 } });
    expect(sponsorValueFactor(charming)).toBeGreaterThan(1);
    expect(sponsorValueFactor(shy)).toBeLessThan(1);
    expect(buildSponsor(charming, 2, 99).perSeason).toBeGreaterThan(buildSponsor(shy, 2, 99).perSeason);
    expect(sponsorValueFactor({ ...base, birth: null })).toBe(1);
  });
});

describe('revelação dos traços: um teste por gatilho', () => {
  // Uma etapa de verdade, disputada, que cada teste ajusta para acionar (ou não) um gatilho.
  const played = playRound(newCareer(4107));
  const record = played.rounds[0]!;
  const playerId = played.playerDriverId;
  const entry = record.race.entries.find((e) => e.driverId === playerId)!;

  function context(
    patch: { record?: Partial<RoundRecord>; race?: Partial<RoundRecord['race']>; entry?: Partial<typeof entry> | null; seasonEnded?: boolean } = {},
  ): RevealContext {
    const race = { ...record.race, ...patch.race };
    const newEntry = patch.entry === null ? null : { ...entry, ...patch.entry };
    race.entries = race.entries.map((e) => (e.driverId === playerId && newEntry ? newEntry : e)).filter((e) => e.driverId !== playerId || newEntry !== null);
    return {
      career: played,
      record: { ...record, ...patch.record, race },
      entry: newEntry,
      playerId,
      seasonEnded: patch.seasonEnded ?? false,
    };
  }
  const overtake = (driverId: string, otherDriverId: string, lap = 1): RaceEvent => ({ lap, type: 'overtake', driverId, otherDriverId, message: '' });
  const rival = record.race.entries.find((e) => e.driverId !== playerId)!.driverId;
  const wet = { condition: 'wet' as const, wetness: 0.8, trackTemp: 18 };
  const dry = { condition: 'dry' as const, wetness: 0, trackTemp: 30 };

  it('gênio na chuva e medo de chuva: a primeira corrida com pista molhada', () => {
    for (const id of ['rainMaster', 'rainFear'] as const) {
      expect(revealTriggers[id](context({ race: { weather: wet } }))).toBe(true);
      expect(revealTriggers[id](context({ race: { weather: dry } }))).toBe(false);
      // Quem não correu não descobre nada.
      expect(revealTriggers[id](context({ race: { weather: wet }, entry: null }))).toBe(false);
    }
  });

  it('largador nato: duas posições ganhas na primeira volta; largada sonolenta: duas perdidas', () => {
    const gained = context({ race: { events: [overtake(playerId, rival), overtake(playerId, rival)] } });
    const lost = context({ race: { events: [overtake(rival, playerId), overtake(rival, playerId)] } });
    const later = context({ race: { events: [overtake(playerId, rival, 2), overtake(playerId, rival, 3)] } });
    expect(startPositionChange(gained.record, playerId)).toBe(2);
    expect(revealTriggers.bornStarter(gained)).toBe(true);
    expect(revealTriggers.bornStarter(lost)).toBe(false);
    expect(revealTriggers.bornStarter(later)).toBe(false);
    expect(revealTriggers.slowStarter(lost)).toBe(true);
    expect(revealTriggers.slowStarter(gained)).toBe(false);
  });

  it('poupador e gastador de pneus: a primeira corrida completa numa pista de alto desgaste', () => {
    const high = getCategory('kart-regional').trackIds.find((id) => getTrack(id).tyreWear >= 1.1)!;
    const low = getCategory('kart-regional').trackIds.find((id) => getTrack(id).tyreWear < 1.1)!;
    for (const id of ['tyreSaver', 'tyreEater'] as const) {
      expect(revealTriggers[id](context({ record: { trackId: high }, entry: { status: 'finished' } }))).toBe(true);
      expect(revealTriggers[id](context({ record: { trackId: low }, entry: { status: 'finished' } }))).toBe(false);
      expect(revealTriggers[id](context({ record: { trackId: high }, entry: { status: 'dnf', dnfReason: 'mechanical' } }))).toBe(false);
    }
  });

  it('aprende rápido e aprende devagar: o balanço da primeira temporada', () => {
    for (const id of ['quickLearner', 'slowLearner'] as const) {
      expect(revealTriggers[id](context({ seasonEnded: true }))).toBe(true);
      expect(revealTriggers[id](context({ seasonEnded: false }))).toBe(false);
    }
  });

  it('rei da classificação: à frente do companheiro; trava na classificação: atrás', () => {
    const mine = record.qualifying.entries.find((e) => e.driverId === playerId)!;
    const mate = record.qualifying.entries.find((e) => e.teamId === mine.teamId && e.driverId !== playerId)!;
    const withLaps = (own: number, other: number) =>
      context({
        record: {
          qualifying: {
            ...record.qualifying,
            entries: record.qualifying.entries.map((e) =>
              e.driverId === playerId ? { ...e, bestLap: own } : e.driverId === mate.driverId ? { ...e, bestLap: other } : e,
            ),
          },
        },
      });
    expect(revealTriggers.qualifyingKing(withLaps(50, 50.2))).toBe(true);
    expect(revealTriggers.qualifyingKing(withLaps(50.2, 50))).toBe(false);
    expect(revealTriggers.qualifyingNerves(withLaps(50.2, 50))).toBe(true);
    expect(revealTriggers.qualifyingNerves(withLaps(50, 50.2))).toBe(false);
    expect(revealTriggers.qualifyingNerves(withLaps(50, 50))).toBe(false);
  });

  it('corpo de ferro e frágil: a primeira batida', () => {
    for (const id of ['ironBody', 'fragile'] as const) {
      expect(revealTriggers[id](context({ entry: { status: 'dnf', dnfReason: 'crash' } }))).toBe(true);
      expect(revealTriggers[id](context({ entry: { status: 'dnf', dnfReason: 'collision' } }))).toBe(true);
      expect(revealTriggers[id](context({ entry: { status: 'dnf', dnfReason: 'mechanical' } }))).toBe(false);
      expect(revealTriggers[id](context({ entry: { status: 'finished' } }))).toBe(false);
    }
  });

  it('piloto limpo e esquentado: o primeiro toque', () => {
    const touch: RaceEvent = { lap: 4, type: 'collision', driverId: rival, otherDriverId: playerId, message: '' };
    const crashOut: RaceEvent = { lap: 4, type: 'dnf', driverId: playerId, otherDriverId: rival, message: '' };
    const others: RaceEvent = { lap: 4, type: 'collision', driverId: rival, otherDriverId: 'outro', message: '' };
    for (const id of ['cleanRacer', 'hothead'] as const) {
      expect(revealTriggers[id](context({ race: { events: [touch] } }))).toBe(true);
      expect(revealTriggers[id](context({ race: { events: [crashOut] } }))).toBe(true);
      expect(revealTriggers[id](context({ race: { events: [others] } }))).toBe(false);
    }
  });

  it('brilha nas estreias e nervoso em estreias: a estreia', () => {
    for (const id of ['bigStage', 'debutNerves'] as const) {
      expect(revealTriggers[id](context())).toBe(true);
      expect(revealTriggers[id](context({ record: { round: 2 } }))).toBe(false);
      expect(revealTriggers[id](context({ entry: null }))).toBe(false);
    }
  });

  it('a revelação marca temporada e etapa, avisa por mensagem e não se repete', () => {
    const career = withBirth(played, { traits: traits('rainMaster', 'hothead', 'bigStage') });
    const revealed = revealTraits(career, { ...record, race: { ...record.race, weather: wet, events: [] } });
    const byId = Object.fromEntries(revealed.birth!.traits.map((t) => [t.id, t]));
    expect(byId.rainMaster).toMatchObject({ revealedSeason: 1, revealedRound: 1 });
    expect(byId.bigStage).toMatchObject({ revealedSeason: 1, revealedRound: 1 });
    expect(byId.hothead).toMatchObject({ revealedSeason: null, revealedRound: null });
    expect(revealed.inbox[0]?.title).toMatch(/^Talento descoberto: (Gênio na chuva|Brilha nas estreias)$/);
    // Duas mensagens novas, uma por traço revelado. (A etapa disputada já pode ter deixado na caixa a
    // revelação de um traço do nascimento sorteado, que este teste trocou: essa não conta.)
    const known = new Set(career.inbox.map((m) => m.id));
    const fresh = revealed.inbox.filter((m) => !known.has(m.id));
    expect(fresh).toHaveLength(2);
    expect(fresh.every((m) => m.title.includes('descoberto'))).toBe(true);
    // De novo, com o mesmo gatilho, nada muda.
    expect(revealTraits(revealed, { ...record, race: { ...record.race, weather: wet, events: [] } })).toBe(revealed);
  });

  it('pela carreira: a estreia revela o traço de estreia e uma corrida molhada revela o de chuva', () => {
    const seed = seedWhere((b) => b.traits.some((t) => t.id === 'debutNerves' || t.id === 'bigStage'));
    const after = playRound(newCareer(seed));
    const debutTrait = after.birth!.traits.find((t) => t.id === 'debutNerves' || t.id === 'bigStage')!;
    expect(debutTrait).toMatchObject({ revealedSeason: 1, revealedRound: 1 });
    expect(after.inbox.some((m) => m.title.endsWith(BIRTH_TRAITS[debutTrait.id].name))).toBe(true);
  });
});

describe('mudança para São Paulo', () => {
  const seed = seedWhere((b) => b.region === 'interior');

  function untilMove(): CareerState {
    // playRound resolve as decisões da etapa anterior (primeira opção) antes de correr; o evento da
    // mudança chega depois da etapa BIRTH.MOVE_EVENT_ROUND e fica pendente.
    let c = newCareer(seed);
    for (let i = 0; i < BIRTH.MOVE_EVENT_ROUND; i++) c = playRound(c);
    return c;
  }

  it('quem mora no interior paga viagens a cada etapa', () => {
    const c = playRound(newCareer(seed));
    expect(c.finance.transactions.some((t) => t.label === 'Viagens do interior' && t.amount === -BIRTH.INTERIOR_TRAVEL_PER_ROUND)).toBe(true);
  });

  it('o evento aparece cedo; mudar com a família custa, pesa na moral e acaba com as viagens', () => {
    const c = untilMove();
    const event = c.pendingEvents.find((e) => e.definitionId === 'birth-move')!;
    expect(event).toMatchObject({ round: BIRTH.MOVE_EVENT_ROUND, category: 'family' });
    expect(event.choices.map((x) => x.id)).toEqual(['family', 'relatives', 'stay']);
    const morale = getPlayer(c).condition.morale;
    const cash = c.finance.cash;
    const moved = resolveEvent(c, event.id, 'family').career;
    expect(moved.birth!.movedSeason).toBe(1);
    expect(moved.finance.cash).toBe(cash - BIRTH.MOVE_WITH_FAMILY_COST);
    expect(getPlayer(moved).condition.morale).toBeCloseTo(morale + BIRTH.MOVE_WITH_FAMILY_MORALE, 5);
    expect(livesInInterior(moved)).toBe(false);
    const next = playRound(resolvePending(moved));
    expect(next.finance.transactions.filter((t) => t.round === 3 && t.label === 'Viagens do interior')).toHaveLength(0);
    expect(validateCareerIntegrity(next)).toEqual([]);
  });

  it('morar com parentes custa menos e pesa mais na moral', () => {
    const c = untilMove();
    const event = c.pendingEvents.find((e) => e.definitionId === 'birth-move')!;
    const moved = resolveEvent(c, event.id, 'relatives').career;
    expect(moved.finance.cash).toBe(c.finance.cash - BIRTH.MOVE_WITH_RELATIVES_COST);
    expect(getPlayer(moved).condition.morale).toBeLessThan(getPlayer(c).condition.morale + BIRTH.MOVE_WITH_FAMILY_MORALE);
  });

  it('ficar mais um ano não muda nada agora, e a pergunta volta na temporada seguinte', () => {
    const c = untilMove();
    const event = c.pendingEvents.find((e) => e.definitionId === 'birth-move')!;
    let stayed = resolveEvent(c, event.id, 'stay').career;
    expect(stayed.finance.cash).toBe(c.finance.cash);
    expect(livesInInterior(stayed)).toBe(true);
    // Não volta na mesma temporada.
    while (stayed.nextRoundIndex < stayed.calendar.length) stayed = playRound(resolvePending(stayed, 2));
    expect(stayed.eventLog.filter((e) => e.definitionId === 'birth-move')).toHaveLength(1);
    let next = startNextSeason(resolvePending(stayed, 2), pickBestOffer(resolvePending(stayed, 2)));
    for (let i = 0; i < BIRTH.MOVE_EVENT_ROUND; i++) next = playRound(resolvePending(next, 2));
    if (livesInInterior(next) && next.categoryId === 'kart-regional') {
      expect(next.pendingEvents.some((e) => e.definitionId === 'birth-move' && e.season === 2)).toBe(true);
    }
  });

  it('quem nasce na capital nunca recebe o evento', () => {
    let c = newCareer(seedWhere((b) => b.region === 'capital'));
    for (let i = 0; i < 4; i++) c = playRound(resolvePending(c));
    expect(c.eventLog.some((e) => e.definitionId === 'birth-move')).toBe(false);
    expect(c.pendingEvents.some((e) => e.definitionId === 'birth-move')).toBe(false);
  });
});

describe('o nascimento é de quem o sorteou', () => {
  it('um herdeiro (outro personagem) e um save antigo correm sem efeito de nascença', () => {
    const career = newCareer(4107);
    expect(activeBirth(career)).not.toBeNull();
    expect(activeBirth({ ...career, playerDriverId: 'herdeiro' })).toBeNull();
    expect(activeBirth({ ...career, birth: null })).toBeNull();
    const track = getTrack(career.calendar[0]!.trackId);
    expect(birthRaceProfile({ ...career, birth: null }, track, getCategory('kart-regional'), 1)).toBeNull();
    expect(birthTrainingFactor({ ...career, birth: null })).toBe(1);
  });

  it('a estreia é a primeira etapa numa categoria ou numa equipe nova', () => {
    const career = newCareer(4107);
    expect(isDebutRound(career, 1)).toBe(true);
    expect(isDebutRound(career, 2)).toBe(false);
  });
});

describe('nascimentos melhores rendem carreiras melhores', () => {
  it('na mesma semente, o melhor dos sorteios termina as primeiras temporadas melhor que o pior', () => {
    // Para cada semente do simulador, o sorteio de nota mais alta e o de nota mais baixa entre os
    // permitidos; o mesmo robô joga as duas carreiras por três temporadas.
    const attempts = Array.from({ length: maxBirthRerolls() + 1 }, (_, i) => i);
    let best = 0;
    let worst = 0;
    let bestOverall = 0;
    let worstOverall = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const scored = attempts
        .map((attempt) => ({ attempt, score: birthScore(drawBirth(seed, attempt, 'player').aptitudes) }))
        .sort((a, b) => a.score - b.score);
      const play = (attempt: number) => {
        let c = createCareer(
          {
            firstName: 'Piloto',
            lastName: `Semente ${seed}`,
            nationality: 'BR',
            bonus: { pace: 4, consistency: 4 },
            ...profileForSeed(seed),
            birthAttempt: attempt,
          },
          seed,
          NOW,
        );
        let positions = 0;
        for (let season = 0; season < 3; season++) {
          c = botTraining(c);
          while (c.nextRoundIndex < c.calendar.length) c = playRound(c);
          c = resolvePending(c);
          positions += c.offseason!.playerPosition;
          if (season < 2) c = startNextSeason(c, pickBestOffer(c));
        }
        return { positions, overall: overallRating(getPlayer(c).attributes) };
      };
      const high = play(scored[scored.length - 1]!.attempt);
      const low = play(scored[0]!.attempt);
      best += high.positions;
      worst += low.positions;
      bestOverall += high.overall;
      worstOverall += low.overall;
    }
    expect(best).toBeLessThan(worst);
    expect(bestOverall).toBeGreaterThan(worstOverall);
  }, 60_000);
});
