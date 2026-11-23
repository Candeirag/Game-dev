/**
 * Motor dos eventos encadeados (Fase 5): o sorteio de 1 a 3 cartões por etapa, a memória que
 * atravessa temporadas e categorias, o rival que volta ao grid, as escolhas de traço e de carisma,
 * os perfis de patrocinador e nenhum texto repetido numa carreira de 15 temporadas.
 *
 * O validador dos dados (condições, referências, cadeias sem ponta solta) está em
 * `tests/storyEvents.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { BIRTH, STORY_EVENTS, SPONSOR_PROFILE_RULES } from '@/config/balance';
import type { CareerState, PendingEvent, RoundRecord, Sponsor } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { STORY_CHAINS } from '@/data/events';
import { satisfactionAfterRound } from '@/engine/career/sponsors';
import { resolveEvent } from '@/engine/events/engine';
import { describeEffects } from '@/engine/story/outcome';
import { drawBirth } from '@/engine/birth/draw';
import { moveEventFor } from '@/engine/birth/move';
import { familySeasonEvents } from '@/engine/dynasty/familyEvents';
import { storyFollowers } from '@/engine/story/followers';
import { emptyStory, markSeen, storyOf } from '@/engine/story/memory';
import { addRoundStoryEvents, addSeasonStartStoryEvents, carriedOverCards, storyCardFor } from '@/engine/story/select';
import { applyEffects } from '@/engine/events/effects';
import { exportCareer, importCareer } from '@/persistence/saveService';
import { validateCareerIntegrity } from '@/persistence/integrity';
import { NOW, botCareer, newCareer, playCareer, playRound, resolvePending } from './helpers';

const isStory = (e: PendingEvent) => e.definitionId.startsWith('story:');

/** Todos os textos de um cartão: título, corpo, rótulos e desfechos. */
const textsOf = (e: PendingEvent) => [e.title, e.body, ...e.choices.flatMap((c) => [c.label, ...c.outcomes.map((o) => o.text)])];

/** Joga uma carreira com o robô e guarda cada cartão que ela viu, na ordem em que apareceram. */
function cardsSeen(seed: number, seasons: number, talent = 0): { career: CareerState; cards: PendingEvent[] } {
  const cards: PendingEvent[] = [];
  const seen = new Set<string>();
  const collect = (c: CareerState) => {
    for (const e of c.pendingEvents) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      cards.push(e);
    }
  };
  let career = botCareer(seed, talent);
  for (let s = 0; s < seasons; s++) {
    while (career.nextRoundIndex < career.calendar.length) {
      collect(career);
      career = playRound(career);
    }
    collect(career);
    career = playCareer(career, 1);
  }
  collect(career);
  return { career, cards };
}

/** Uma etapa disputada de verdade, para os cartões que reagem à corrida. */
function playedRound(seed = 7): { career: CareerState; record: RoundRecord } {
  const career = resolvePending(playRound(newCareer(seed)));
  const record = career.rounds[career.rounds.length - 1];
  if (!record) throw new Error('A etapa não foi disputada.');
  return { career, record };
}

/** A etapa com um toque em que o outro piloto atacou o jogador. */
function withContact(career: CareerState, record: RoundRecord, playerAttacked: boolean): RoundRecord {
  const other = record.race.entries.find((e) => e.driverId !== career.playerDriverId)?.driverId ?? '';
  const event = playerAttacked
    ? { lap: 3, type: 'collision' as const, driverId: career.playerDriverId, otherDriverId: other, message: 'Toque.' }
    : { lap: 3, type: 'collision' as const, driverId: other, otherDriverId: career.playerDriverId, message: 'Toque.' };
  return { ...record, race: { ...record.race, events: [...record.race.events, event] } };
}

/** O piloto com um traço de nascença revelado (ou escondido). */
function withTrait(career: CareerState, trait: 'hothead' | 'cleanRacer' | 'ironBody', revealed = true): CareerState {
  if (!career.birth) throw new Error('Carreira sem nascimento.');
  const traits = [{ id: trait, revealedSeason: revealed ? 1 : null, revealedRound: revealed ? 1 : null }];
  return { ...career, birth: { ...career.birth, traits } };
}

const withCharisma = (career: CareerState, charisma: number): CareerState =>
  career.birth ? { ...career, birth: { ...career.birth, aptitudes: { ...career.birth.aptitudes, charisma } } } : career;

/** Coloca o cartão na fila e resolve a escolha `choiceId`. */
function choose(career: CareerState, card: PendingEvent, choiceId: string) {
  return resolveEvent({ ...career, pendingEvents: [...career.pendingEvents, card] }, card.id, choiceId);
}

describe('sorteio dos cartões', () => {
  it('de 1 a 3 cartões por etapa, nunca mais que um passo de cadeia, e a pista é a categoria mais comum', () => {
    const perRound = new Map<string, PendingEvent[]>();
    const byCategory = new Map<string, number>();
    for (const seed of [3, 11, 19]) {
      const { cards } = cardsSeen(seed, 6);
      for (const card of cards.filter((c) => isStory(c) && c.round > 0)) {
        const key = `${seed}/${card.season}/${card.round}`;
        perRound.set(key, [...(perRound.get(key) ?? []), card]);
        byCategory.set(card.category, (byCategory.get(card.category) ?? 0) + 1);
      }
    }
    for (const [key, cards] of perRound) {
      expect(cards.length, key).toBeGreaterThanOrEqual(1);
      expect(cards.length, key).toBeLessThanOrEqual(STORY_EVENTS.PER_ROUND.length);
      expect(cards.filter((c) => c.chain && !c.storyKey?.endsWith(`${c.chain.id}:rixa#0`)).length, key).toBeLessThanOrEqual(
        1 + STORY_EVENTS.MAX_CHAIN_STEPS_PER_ROUND,
      );
    }
    const track = byCategory.get('track') ?? 0;
    for (const [category, count] of byCategory) if (category !== 'track') expect(track, category).toBeGreaterThan(count);
    expect(byCategory.get('personal') ?? 0).toBeLessThan(track / 2);
  });

  it('toda etapa disputada ganha pelo menos um cartão em 15 temporadas (o catálogo não seca)', () => {
    for (const seed of [5, 23]) {
      const { cards, career } = cardsSeen(seed, 15);
      const rounds = new Set(cards.filter((c) => isStory(c) && c.round > 0).map((c) => `${c.season}/${c.round}`));
      const played = career.history.reduce((sum, h) => sum + h.rounds.length, 0);
      expect(rounds.size, `semente ${seed}`).toBeGreaterThanOrEqual(played - Math.ceil(played * 0.02));
    }
  });

  it('mesma semente e mesmas escolhas: os mesmos cartões e a mesma memória', () => {
    const a = cardsSeen(31, 3);
    const b = cardsSeen(31, 3);
    expect(a.cards.map((c) => c.storyKey ?? c.id)).toEqual(b.cards.map((c) => c.storyKey ?? c.id));
    expect(a.career.story).toEqual(b.career.story);
  });

  it('os cartões só saem no modo piloto', () => {
    const { career, record } = playedRound();
    const executive = { ...career, mode: 'executive' as const };
    expect(addRoundStoryEvents(executive, record, record.round)).toBe(executive);
    expect(addSeasonStartStoryEvents(executive)).toBe(executive);
  });
});

describe('nenhum texto se repete na carreira', () => {
  it('15 temporadas: nenhuma variante sai duas vezes e nenhum texto de cartão se repete', () => {
    for (const seed of [2, 14, 27, 40]) {
      const { cards, career } = cardsSeen(seed, 15, seed % 2 === 0 ? 0 : 4);
      const story = cards.filter(isStory);
      const keys = story.map((c) => c.storyKey);
      expect(new Set(keys).size, `semente ${seed}: variantes`).toBe(keys.length);
      const texts = story.flatMap(textsOf);
      const repeated = texts.filter((t, i) => texts.indexOf(t) !== i);
      expect(repeated, `semente ${seed}: textos repetidos`).toEqual([]);
      // A memória guarda tudo o que saiu, sem corte.
      expect(storyOf(career).seen.length).toBeGreaterThanOrEqual(new Set(keys).size);
    }
  });

  it('cada perfil de patrocinador aparece no máximo uma vez por carreira', () => {
    const { cards } = cardsSeen(8, 15, 4);
    const offers = cards.filter((c) => c.definitionId.startsWith('story:sponsor:')).map((c) => c.definitionId);
    expect(offers.length).toBeGreaterThan(0);
    expect(new Set(offers).size).toBe(offers.length);
  });
});

describe('memória das histórias', () => {
  it('vai para o save e volta igual', () => {
    const { career } = cardsSeen(12, 3);
    expect(storyOf(career).seen.length).toBeGreaterThan(0);
    const back = importCareer(exportCareer(career, NOW));
    expect(back.story).toEqual(career.story);
    expect(validateCareerIntegrity(back)).toEqual([]);
  });

  it('a cadeia anda pelos passos com prazo: o passo seguinte só sai quando o prazo vence e a condição vale', () => {
    const { career } = playedRound(9);
    const rival = career.drivers.find((d) => !d.isPlayer && d.teamId)!;
    const kart = { ...career, relations: { ...career.relations, rivalries: { [rival.id]: 40 } } };
    const card = storyCardFor(kart, null, 1, 'chain:velho-conhecido:rixa');
    expect(card?.chain).toEqual({ id: 'velho-conhecido', title: 'Velho conhecido' });
    const after = choose(kart, card!, 'encarar').career;
    const chain = storyOf(after).chains.find((c) => c.id === 'velho-conhecido');
    expect(chain).toMatchObject({ status: 'active', next: 'reencontro', steps: [{ step: 'rixa', choice: 'encarar' }] });
    const person = storyOf(after).people.find((p) => p.key === 'rival-kart');
    expect(person).toMatchObject({ driverId: rival.id, firstName: rival.firstName, lastName: rival.lastName, follows: true, chainId: 'velho-conhecido' });
    expect(person!.attitude).toBeLessThan(0);
    // O reencontro é nas fórmulas: no kart, o passo não sai, mesmo vencido o prazo.
    expect(storyCardFor(after, null, 2, 'chain:velho-conhecido:reencontro')).toBeNull();
  });

  it('o rival do kart acompanha a carreira: sobe junto e, se tiver sumido, volta com o mesmo nome e id', () => {
    const { career } = playedRound(9);
    const rival = career.drivers.find((d) => !d.isPlayer && d.teamId && d.age <= 17)!;
    const kart = { ...career, relations: { ...career.relations, rivalries: { [rival.id]: 40 } } };
    const after = choose(kart, storyCardFor(kart, null, 1, 'chain:velho-conhecido:rixa')!, 'encarar').career;
    const f4 = getCategory('f4');
    // Ainda no grid: vem como está.
    const carried = storyFollowers(after, f4, after.season + 1, new Set(), new Set());
    expect(carried.map((d) => d.id)).toEqual([rival.id]);
    // Sumiu do grid (subiu antes, mudou de campeonato): volta com o mesmo id e nome, no nível da categoria nova.
    const gone = { ...after, drivers: after.drivers.filter((d) => d.id !== rival.id) };
    const back = storyFollowers(gone, f4, after.season + 2, new Set(), new Set());
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ id: rival.id, firstName: rival.firstName, lastName: rival.lastName });
    expect(back[0]!.age + 1).toBeGreaterThanOrEqual(f4.field.minAge);
    // Quem não acompanha não volta.
    const released = { ...after, story: { ...after.story, people: after.story.people.map((p) => ({ ...p, follows: false })) } };
    expect(storyFollowers(released, f4, after.season + 1, new Set(), new Set())).toEqual([]);
  });

  it('numa carreira real, o rival marcado está no grid da categoria nova depois da subida', () => {
    let checked = 0;
    for (const seed of [1, 4, 6, 9, 13, 17, 21, 25]) {
      let prev: CareerState | null = null;
      playCareer(botCareer(seed, 6), 8, {}, (c) => {
        if (prev && getCategory(c.categoryId).tier > getCategory(prev.categoryId).tier) {
          const person = storyOf(prev).people.find((p) => p.follows && p.driverId);
          if (person?.driverId) {
            const age = (person.age ?? 0) + (c.season - person.metSeason);
            if (age <= getCategory(c.categoryId).field.maxAge) {
              checked++;
              expect(
                c.drivers.some((d) => d.id === person.driverId),
                `semente ${seed}, temporada ${c.season}`,
              ).toBe(true);
            }
          }
        }
        prev = c;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a sucessão começa uma memória nova; a virada do ano mantém os cartões das histórias sem resposta', () => {
    expect(emptyStory('dyn-1')).toEqual({ driverId: 'dyn-1', seen: [], flags: [], people: [], chains: [] });
    const { career, record } = playedRound(15);
    const withCards = addRoundStoryEvents({ ...career, pendingEvents: [] }, record, record.round);
    expect(withCards.pendingEvents.filter(isStory).length).toBeGreaterThan(0);
    for (const card of withCards.pendingEvents.filter(isStory)) expect(storyOf(withCards).seen.some((s) => s.key === card.storyKey)).toBe(true);
  });
});

describe('talentos e defeitos nos cartões', () => {
  it('o esquentado (revelado) ganha "partir para cima"; escondido, não', () => {
    const { career, record } = playedRound(21);
    const hit = withContact(career, record, false);
    const hot = storyCardFor(withTrait(career, 'hothead'), hit, record.round, 'toque-sofrido');
    const partir = hot?.choices.find((c) => c.id === 'partir');
    expect(partir?.unlock).toEqual({ kind: 'trait', id: 'hothead' });
    expect(partir?.label.toLowerCase()).toContain('partir para cima');
    const hidden = storyCardFor(withTrait(career, 'hothead', false), hit, record.round, 'toque-sofrido');
    expect(hidden?.choices.map((c) => c.id)).toEqual(['conversar', 'criticar']);
  });

  it('o carismático tem uma resposta melhor para a imprensa: desfecho certo e bom para a reputação', () => {
    const { career, record } = playedRound(21);
    const win: RoundRecord = {
      ...record,
      race: {
        ...record.race,
        entries: record.race.entries.map((e) =>
          e.driverId === career.playerDriverId ? { ...e, position: 1, status: 'finished' as const } : e.position === 1 ? { ...e, position: 2 } : e,
        ),
      },
    };
    const charming = storyCardFor(withCharisma(career, 90), win, record.round, 'coletiva-vitoria');
    const press = charming?.choices.find((c) => c.unlock?.id === 'charisma');
    expect(press?.outcomes).toHaveLength(1);
    expect(press?.outcomes[0]?.effects.some((e) => e.type === 'stat' && e.stat === 'reputation' && e.value > 0)).toBe(true);
    const shy = storyCardFor(withCharisma(career, 30), win, record.round, 'coletiva-vitoria');
    expect(shy?.choices.some((c) => c.unlock)).toBe(false);
  });
});

describe('patrocinadores com perfil', () => {
  it('a personalidade muda a tolerância: o paciente perde menos que o impulsivo com o mesmo resultado ruim', () => {
    const base: Sponsor = {
      id: 's',
      name: 'Teste',
      tier: 1,
      perSeason: 10_000,
      podiumBonus: 400,
      endSeason: 2,
      satisfaction: 60,
      targetPosition: 5,
      profileId: 'x',
    };
    const patient = satisfactionAfterRound({ ...base, personality: 'patient' }, 15, null);
    const impulsive = satisfactionAfterRound({ ...base, personality: 'impulsive' }, 15, null);
    const plain = satisfactionAfterRound(base, 15, null);
    expect(patient).toBeGreaterThan(plain);
    expect(impulsive).toBeLessThan(plain);
    expect(60 - patient).toBeCloseTo((60 - plain) * SPONSOR_PROFILE_RULES.PATIENCE.patient, 5);
  });

  it('assinar uma proposta traz o patrocinador com perfil e personalidade', () => {
    const { cards } = cardsSeen(8, 4, 4);
    const offer = cards.find((c) => c.definitionId.startsWith('story:sponsor:'));
    expect(offer).toBeDefined();
    const sign = offer!.choices[0]!;
    const added = sign.outcomes[0]!.effects.find((e) => e.type === 'addSponsor');
    expect(added?.type === 'addSponsor' && added.sponsor.profileId && added.sponsor.personality).toBeTruthy();
  });
});

describe('efeito mostrado depois da escolha', () => {
  it('cada linha diz o que mudou de verdade (o teto não "sobe"), o dinheiro é o saldo e a memória aparece', () => {
    const { career, record } = playedRound(9);
    const rival = career.drivers.find((d) => !d.isPlayer && d.teamId)!;
    const kart = { ...career, relations: { ...career.relations, rivalries: { [rival.id]: 40 } } };
    const card = storyCardFor(kart, record, record.round, 'chain:velho-conhecido:rixa')!;
    const result = choose(kart, card, 'encarar');
    const views = describeEffects(kart, result.career, result.effects);
    expect(views.some((v) => v.kind === 'remember')).toBe(true);
    expect(views.some((v) => v.kind === 'follows')).toBe(true);
    expect(views.some((v) => v.kind === 'chain' && !v.ends)).toBe(true);
    // Indicador no teto: nada a mostrar.
    const full = { ...kart, drivers: kart.drivers.map((d) => (d.isPlayer ? { ...d, condition: { ...d.condition, confidence: 100 } } : d)) };
    const again = choose(full, card, 'encarar');
    expect(describeEffects(full, again.career, again.effects).some((v) => v.kind === 'stat' && v.stat === 'confidence')).toBe(false);
  });
});

describe('cadeias', () => {
  it('o robô, escolhendo sempre a primeira opção, começa e termina cadeias em 15 temporadas', () => {
    const started = new Set<string>();
    const done = new Set<string>();
    for (const seed of [2, 14, 27, 40]) {
      const { career } = cardsSeen(seed, 15, 4);
      for (const c of storyOf(career).chains) {
        started.add(c.id);
        if (c.status === 'done') done.add(c.id);
      }
    }
    expect(started.size).toBeGreaterThanOrEqual(Math.min(5, STORY_CHAINS.length));
    expect(done.size).toBeGreaterThanOrEqual(3);
  });
});

describe('mudança para São Paulo e eventos de família: cada vez, um texto novo', () => {
  /** Primeira semente cujo nascimento cumpre a condição. */
  const seedWhere = (ok: (b: ReturnType<typeof drawBirth>) => boolean) => {
    for (let seed = 1; seed < 500; seed++) if (ok(drawBirth(seed, 0, 'player'))) return seed;
    throw new Error('Nenhuma semente.');
  };

  it('a pergunta da mudança volta com outro texto e, acabadas as variantes, não volta mais', () => {
    let c = newCareer(seedWhere((b) => b.region === 'interior'));
    const seen: PendingEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const event = moveEventFor(c, BIRTH.MOVE_EVENT_ROUND);
      if (!event) break;
      seen.push(event);
      c = markSeen(c, [event.storyKey!], BIRTH.MOVE_EVENT_ROUND);
    }
    expect(seen.length).toBeGreaterThanOrEqual(4);
    const texts = seen.flatMap(textsOf);
    expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([]);
    expect(seen.every((e) => e.choices.map((x) => x.id).join() === 'family,relatives,stay')).toBe(true);
    expect(moveEventFor(c, BIRTH.MOVE_EVENT_ROUND)).toBeNull();
  });

  it('o mesmo tipo de evento de família volta com outro texto', () => {
    const base = newCareer(4);
    const adult = { ...base, drivers: base.drivers.map((d) => (d.isPlayer ? { ...d, age: 26 } : d)) };
    // Uma temporada em que alguém aparece (o sorteio depende da temporada).
    let found: CareerState | null = null;
    for (let season = 1; season < 30 && !found; season++) {
      const c = { ...adult, season };
      if (familySeasonEvents(c).some((e) => e.definitionId === 'family-partner')) found = c;
    }
    expect(found).not.toBeNull();
    const first = familySeasonEvents(found!).find((e) => e.definitionId === 'family-partner')!;
    const again = familySeasonEvents(markSeen(found!, [first.storyKey!], 0)).find((e) => e.definitionId === 'family-partner')!;
    expect(again.storyKey).not.toBe(first.storyKey);
    expect(again.title).not.toBe(first.title);
    expect(again.choices.map((c) => c.label)).not.toEqual(first.choices.map((c) => c.label));
  });
});

describe('correções da revisão', () => {
  it('cartão que passa para a temporada nova perde os efeitos presos ao campeonato que acabou', () => {
    const card: PendingEvent = {
      id: 's1-r10-x',
      definitionId: 'story:x',
      category: 'track',
      season: 1,
      round: 10,
      title: 'T',
      body: 'B',
      storyKey: 'x#0',
      choices: [
        {
          id: 'a',
          label: 'A',
          description: '',
          outcomes: [
            {
              probability: 1,
              text: 'O',
              effects: [
                { type: 'pointsAdjustment', driverId: 'player', points: -10, reason: 'Etapa 10' },
                { type: 'gridPenalty', driverId: 'player', places: 3 },
                { type: 'stat', stat: 'morale', value: 3 },
              ],
            },
          ],
        },
      ],
    };
    const old: PendingEvent = { ...card, id: 'velho', storyKey: undefined };
    const carried = carriedOverCards([card, old]);
    expect(carried.map((e) => e.id)).toEqual(['s1-r10-x']);
    expect(carried[0]!.choices[0]!.outcomes[0]!.effects).toEqual([{ type: 'stat', stat: 'morale', value: 3 }]);
  });

  it('assinar respeita as cotas: com tudo ocupado, o novo só entra no lugar de um menor', () => {
    const base = newCareer(3);
    const s = (id: string, tier: number, perSeason: number): Sponsor => ({
      id,
      name: id,
      tier,
      perSeason,
      podiumBonus: 0,
      endSeason: 2,
      satisfaction: 60,
      targetPosition: 10,
    });
    const full = { ...base, sponsors: [s('a', 1, 5_000), s('b', 2, 30_000), s('c', 2, 40_000)] };
    const sameTier = applyEffects(full, [{ type: 'addSponsor', sponsor: s('d', 1, 9_000) }], 1);
    expect(sameTier.sponsors.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    const bigger = applyEffects(full, [{ type: 'addSponsor', sponsor: s('e', 3, 90_000) }], 1);
    expect(bigger.sponsors.map((x) => x.id)).toEqual(['b', 'c', 'e']);
    const free = applyEffects({ ...base, sponsors: [s('a', 1, 5_000)] }, [{ type: 'addSponsor', sponsor: s('f', 1, 6_000) }], 1);
    expect(free.sponsors.map((x) => x.id)).toEqual(['a', 'f']);
  });

  it('a lista do que mudou mostra o que mudou de fato: rivalidade no teto não sobe, e o divórcio mostra o dinheiro', () => {
    const base = newCareer(3);
    const rival = base.drivers.find((d) => !d.isPlayer)!;
    const capped = { ...base, relations: { ...base.relations, rivalries: { [rival.id]: 100 } } };
    const effects = [{ type: 'rivalry' as const, driverId: rival.id, value: 15 }];
    expect(describeEffects(capped, applyEffects(capped, effects, 1), effects)).toEqual([]);
    const partner = {
      firstName: 'Lia',
      lastName: 'Souza',
      age: 30,
      background: 'health' as const,
      talent: 60,
      relationship: 20,
      married: true,
      sinceSeason: 1,
    };
    const married = { ...base, family: { ...base.family, partner }, finance: { ...base.finance, cash: 100_000 } };
    const divorce = [{ type: 'divorce' as const, share: 0.5 }];
    const views = describeEffects(married, applyEffects(married, divorce, 1), divorce);
    expect(views.some((v) => v.kind === 'cash' && v.value < 0)).toBe(true);
    expect(views.some((v) => v.kind === 'note' && v.text.includes('Lia'))).toBe(true);
  });
});

describe('o rival nascido num lance da Fase 4', () => {
  it('conta como o rival na hora: a cadeia "Velho conhecido" pode começar mesmo com a rivalidade ainda pequena', () => {
    const { career, record } = playedRound(9);
    const rival = career.drivers.find((d) => !d.isPlayer && d.teamId)!;
    const touch = { driverId: rival.id, season: career.season, round: record.round, lap: 3, kind: 'attack' as const, retired: false, fresh: true };
    const small = { ...career, relations: { ...career.relations, rivalries: { [rival.id]: 15 }, rivalryLog: [touch] } };
    const card = storyCardFor(small, record, record.round, 'chain:velho-conhecido:rixa');
    expect(card?.title).toContain(rival.lastName);
    // Sem o toque desta etapa, 15 pontos de rivalidade não bastam.
    const old = { ...small, relations: { ...small.relations, rivalryLog: [] } };
    expect(storyCardFor(old, record, record.round, 'chain:velho-conhecido:rixa')).toBeNull();
  });
});
