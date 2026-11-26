/**
 * Eventos de família, gerados no começo de cada temporada.
 *
 * Seguem a mesma regra dos demais eventos: cada escolha tem efeitos em dados,
 * aplicados por events/effects.ts. Desde a Fase 5, os textos estão em variantes
 * (`src/data/familyTexts.ts`): cada vez que um tipo de evento aparece para o mesmo
 * personagem, sai uma variante nova; acabadas as variantes, o evento não aparece mais. Conhecer alguém, casar, ter filhos, lidar
 * com uma crise e decidir a formação dos filhos mexem com moral, fase,
 * dinheiro, patrimônio e, mais tarde, com a sucessão. Desde a Fase 6, o teste no
 * kart da adolescência revela talentos e defeitos de nascença dos filhos, e quem herdou dinheiro
 * atrai negócios de conhecidos (maus investimentos, da segunda geração em diante).
 */
import type { CareerState, Effect, EventChoice, PendingEvent } from '@/domain/schemas';
import { LIFESTYLE_RULES } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { FAMILY, PARTNER_BACKGROUND_INFO, getTrait } from '@/data/family';
import { getPlayer } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import { livingCostBase } from '../management/executive';
import { netWorth } from '../career/economy';
import { generateChild, generatePartner, roomForChild } from './family';
import { money } from '../career/selectors';
import { counted } from '@/domain/text';
import { FAMILY_EVENT_TEXTS } from '@/data/familyTexts';
import { markSeen, storyOf } from '../story/memory';
import { BAD_INVESTMENT, HERITAGE } from '@/config/balance';
import { canTakeKartTest, ensureHeritage } from './heritage';

const stat = (name: Extract<Effect, { type: 'stat' }>['stat'], value: number): Effect => ({ type: 'stat', stat: name, value });
const cash = (value: number, label: string): Effect => ({ type: 'cash', value, ledger: 'family', label });
const sure = (text: string, ...effects: Effect[]): EventChoice['outcomes'] => [{ probability: 1, text, effects }];
const choice = (id: string, label: string, description: string, outcomes: EventChoice['outcomes']): EventChoice => ({ id, label, description, outcomes });

/** Eventos de família que valem para a temporada que está começando. */
export function familySeasonEvents(career: CareerState): PendingEvent[] {
  const events: PendingEvent[] = [];
  const player = getPlayer(career);
  const { partner, children } = career.family;
  const living = livingCostBase(career) * LIFESTYLE_RULES[career.finance.lifestyle].cost;
  const rng = createRng(hashSeed(career.seed, career.season, 'family-events'));
  const partnerRoll = rng.next();
  const childRoll = rng.next();
  // Fase 5: cada tipo de evento tem variantes de texto; sai a próxima que este personagem ainda não viu.
  const story = storyOf(career);
  const used: Record<string, number> = {};
  const nextVariant = (group: keyof typeof FAMILY_EVENT_TEXTS): number => {
    const seen = story.seen.filter((x) => x.key.startsWith(`family-${group}#`)).length;
    return seen + (used[group] ?? 0);
  };
  const add = (kind: string, group: keyof typeof FAMILY_EVENT_TEXTS, variant: number, title: string, body: string, choices: EventChoice[]) => {
    used[group] = (used[group] ?? 0) + 1;
    events.push({
      id: `s${career.season}-family-${kind}`,
      definitionId: `family-${kind}`,
      category: 'family',
      season: career.season,
      round: 0,
      title,
      body,
      choices,
      storyKey: `family-${group}#${variant}`,
    });
  };

  const partnerText = FAMILY_EVENT_TEXTS.partner[nextVariant('partner')];
  if (!partner && partnerText && player.age >= FAMILY.PARTNER_MIN_AGE && partnerRoll < FAMILY.PARTNER_CHANCE) {
    const candidate = generatePartner(hashSeed(career.seed, career.season, 'partner'), player.age, career.season);
    const info = PARTNER_BACKGROUND_INFO[candidate.background];
    const t = partnerText({
      first: candidate.firstName,
      full: `${candidate.firstName} ${candidate.lastName}`,
      age: candidate.age,
      background: info.name.toLowerCase(),
      description: info.description,
    });
    add('partner', 'partner', nextVariant('partner'), t.title, t.body, [
      choice('date', t.date.label, t.date.description, sure(t.date.text, { type: 'partner', partner: candidate }, stat('form', -3), stat('morale', 6))),
      choice('focus', t.focus.label, t.focus.description, sure(t.focus.text, stat('morale', -2))),
    ]);
  }

  const weddingText = FAMILY_EVENT_TEXTS.wedding[nextVariant('wedding')];
  const crisisText = FAMILY_EVENT_TEXTS.crisis[nextVariant('crisis')];
  if (partner && !partner.married && partner.relationship >= FAMILY.MARRIAGE_RELATIONSHIP && career.season > partner.sinceSeason) {
    const party = Math.round(living * FAMILY.WEDDING_COST);
    const t = weddingText?.({
      first: partner.firstName,
      together: counted(career.season - partner.sinceSeason, 'temporada', 'temporadas'),
      share: Math.round(FAMILY.DIVORCE_SHARE * 100),
      party: money(career, party),
      simple: money(career, party * 0.2),
    });
    if (t)
      add('wedding', 'wedding', nextVariant('wedding'), t.title, t.body, [
        choice(
          'party',
          t.party.label,
          t.party.description,
          sure(t.party.text, { type: 'marry' }, cash(-party, 'Festa de casamento'), { type: 'relationship', value: 10 }, stat('morale', 8)),
        ),
        choice(
          'simple',
          t.simple.label,
          t.simple.description,
          sure(t.simple.text, { type: 'marry' }, cash(-party * 0.2, 'Casamento'), { type: 'relationship', value: 4 }, stat('morale', 5)),
        ),
        choice('wait', t.wait.label, t.wait.description, sure(t.wait.text, { type: 'relationship', value: -8 })),
      ]);
  } else if (partner && partner.relationship < FAMILY.CRISIS_RELATIONSHIP) {
    const t = crisisText?.({
      first: partner.firstName,
      married: partner.married,
      share: Math.round(FAMILY.DIVORCE_SHARE * 100),
      therapy: money(career, living * 0.3),
      trip: money(career, living * 0.6),
    });
    if (t)
      add('crisis', 'crisis', nextVariant('crisis'), t.title, t.body, [
        choice('therapy', t.therapy.label, t.therapy.description, [
          {
            probability: 0.7,
            text: t.therapy.better,
            effects: [cash(-living * 0.3, 'Terapia de casal'), stat('form', -4), { type: 'relationship', value: 20 }],
          },
          {
            probability: 0.3,
            text: t.therapy.partial,
            effects: [cash(-living * 0.3, 'Terapia de casal'), stat('form', -4), { type: 'relationship', value: 7 }],
          },
        ]),
        choice('trip', t.trip.label, t.trip.description, sure(t.trip.text, cash(-living * 0.6, 'Viagem em família'), { type: 'relationship', value: 14 })),
        choice('ignore', t.ignore.label, t.ignore.description, [
          {
            probability: 0.5,
            text: t.ignore.broke,
            effects: [{ type: 'divorce', share: partner.married ? FAMILY.DIVORCE_SHARE : 0 }, stat('morale', -15), stat('confidence', -5)],
          },
          { probability: 0.5, text: t.ignore.distant, effects: [{ type: 'relationship', value: -5 }, stat('morale', -6)] },
        ]),
      ]);
  }

  const childText = FAMILY_EVENT_TEXTS.child[nextVariant('child')];
  if (partner && childText && roomForChild(career) && childRoll < FAMILY.CHILD_CHANCE) {
    const baby = generateChild(career, hashSeed(career.seed, career.season, 'child'));
    const t = childText({ first: partner.firstName, firstChild: children.length === 0, baby: `${baby.firstName} ${baby.lastName}` });
    add('child', 'child', nextVariant('child'), t.title, t.body, [
      choice('yes', t.yes.label, t.yes.description, sure(t.yes.text, { type: 'child', child: baby }, { type: 'relationship', value: 6 }, stat('morale', 8))),
      choice('no', t.no.label, t.no.description, sure(t.no.text, { type: 'relationship', value: -5 })),
    ]);
  }

  // Fase 6: maus investimentos. Da segunda geração em diante, quem herdou dinheiro atrai propostas
  // de negócio (sorteio próprio, que não existe na primeira geração).
  const investText = FAMILY_EVENT_TEXTS.badInvestment[nextVariant('badInvestment')];
  const stake = investText ? badInvestmentStake(career) : 0;
  if (investText && stake > 0) {
    const loss = Math.round((stake * BAD_INVESTMENT.LOSS_SHARE) / 100) * 100;
    const gain = Math.round((stake * BAD_INVESTMENT.GAIN_SHARE) / 100) * 100;
    const t = investText({ stake: money(career, stake), loss: money(career, loss), gain: money(career, gain) });
    const label = 'Negócio de um conhecido';
    add('bad-investment', 'badInvestment', nextVariant('badInvestment'), t.title, t.body, [
      choice('invest', t.invest.label, t.invest.description, [
        {
          probability: BAD_INVESTMENT.LOSS_CHANCE,
          text: t.invest.lost,
          effects: [{ type: 'cash', value: -loss, ledger: 'investment', label }],
        },
        { probability: 1 - BAD_INVESTMENT.LOSS_CHANCE, text: t.invest.won, effects: [{ type: 'cash', value: gain, ledger: 'investment', label }] },
      ]),
      choice('refuse', t.refuse.label, t.refuse.description, sure(t.refuse.text)),
    ]);
  }

  for (const child of children) {
    // Fase 6: o teste no kart da adolescência revela talentos e defeitos de nascença.
    const testText = FAMILY_EVENT_TEXTS.kartTest[nextVariant('kartTest')];
    if (testText && canTakeKartTest(child)) {
      const cost = HERITAGE.KART_TEST_COST;
      const t = testText({ child: child.firstName, age: child.age, full: money(career, cost.full), quick: money(career, cost.quick) });
      add(`kart-test-${child.id}`, 'kartTest', nextVariant('kartTest'), t.title, t.body, [
        choice(
          'full',
          t.full.label,
          t.full.description,
          sure(t.full.text, { type: 'kartTest', childId: child.id, depth: 'full' }, cash(-cost.full, 'Teste no kart')),
        ),
        choice(
          'quick',
          t.quick.label,
          t.quick.description,
          sure(t.quick.text, { type: 'kartTest', childId: child.id, depth: 'quick' }, cash(-cost.quick, 'Teste no kart')),
        ),
        choice(
          'skip',
          t.skip.label,
          t.skip.description,
          sure(t.skip.text, { type: 'childStat', childId: child.id, stat: 'bond', value: -HERITAGE.KART_TEST_SKIP_BOND }),
        ),
      ]);
    }
    const kartText = FAMILY_EVENT_TEXTS.kart[nextVariant('kart')];
    if (
      kartText &&
      child.stage === 'child' &&
      child.age >= FAMILY.KART_START_AGE &&
      child.age < FAMILY.CAREER_START_AGE &&
      child.kartYears === 0 &&
      child.age === FAMILY.KART_START_AGE
    ) {
      const t = kartText({
        child: child.firstName,
        age: child.age,
        until: FAMILY.CAREER_START_AGE - 1,
        perYear: FAMILY.START_PER_KART_YEAR,
        full: money(career, FAMILY.KART_COST.full),
        basic: money(career, FAMILY.KART_COST.basic),
      });
      add(`kart-${child.id}`, 'kart', nextVariant('kart'), t.title, t.body, [
        choice(
          'full',
          t.full.label,
          t.full.description,
          sure(t.full.text, { type: 'childKart', childId: child.id, funding: 'full' }, { type: 'childStat', childId: child.id, stat: 'bond', value: 5 }),
        ),
        choice(
          'basic',
          t.basic.label,
          t.basic.description,
          sure(t.basic.text, { type: 'childKart', childId: child.id, funding: 'basic' }, { type: 'childStat', childId: child.id, stat: 'bond', value: 3 }),
        ),
        choice(
          'none',
          t.none.label,
          t.none.description,
          sure(t.none.text, { type: 'childKart', childId: child.id, funding: 'none' }, { type: 'childStat', childId: child.id, stat: 'bond', value: -6 }),
        ),
      ]);
    }
    const careerText = FAMILY_EVENT_TEXTS.career[nextVariant('career')];
    if (
      careerText &&
      (child.stage === 'child' || child.stage === 'karting') &&
      child.age >= FAMILY.CAREER_START_AGE &&
      child.interest >= FAMILY.CAREER_INTEREST
    ) {
      const seat = getCategory('kart-regional').economy.seatCost;
      const t = careerText({
        child: child.firstName,
        age: child.age,
        traits: child.traits.map((x) => getTrait(x).name.toLowerCase()).join(' e '),
        base: counted(child.kartYears.toFixed(1).replace('.', ','), 'ano', 'anos'),
        seatLow: money(career, seat[1]),
        seatHigh: money(career, seat[0]),
      });
      add(`career-${child.id}`, 'career', nextVariant('career'), t.title, t.body, [
        choice(
          'full',
          t.full.label,
          t.full.description,
          sure(t.full.text, { type: 'childCareer', childId: child.id, support: 'full' }, { type: 'childStat', childId: child.id, stat: 'bond', value: 8 }),
        ),
        choice(
          'basic',
          t.basic.label,
          t.basic.description,
          sure(t.basic.text, { type: 'childCareer', childId: child.id, support: 'basic' }, { type: 'childStat', childId: child.id, stat: 'bond', value: 3 }),
        ),
        choice(
          'none',
          t.none.label,
          t.none.description,
          sure(t.none.text, { type: 'childCareer', childId: child.id, support: 'none' }, { type: 'childStat', childId: child.id, stat: 'bond', value: -6 }),
        ),
        choice(
          'forbid',
          t.forbid.label,
          t.forbid.description,
          sure(
            t.forbid.text,
            { type: 'childStat', childId: child.id, stat: 'interest', value: -100 },
            { type: 'childStat', childId: child.id, stat: 'bond', value: -20 },
          ),
        ),
      ]);
    }
  }
  return events;
}

/**
 * Quanto o negócio de um conhecido pede neste começo de ano (0: não há proposta). Só da segunda
 * geração em diante, com patrimônio líquido de pelo menos BAD_INVESTMENT.MIN_WEALTH custos de vida
 * de referência e com a chance BAD_INVESTMENT.CHANCE (sorteio 'bad-investment', que não acontece na
 * primeira geração). O negócio pede BAD_INVESTMENT.STAKE_SHARE do caixa: a aposta sai da conta, e a
 * perda (uma parte dela) também, sem limite, para bater com o que o texto diz.
 */
export function badInvestmentStake(career: CareerState): number {
  if (career.dynasty.generation < 2) return 0;
  if (netWorth(career.finance) < livingCostBase(career) * BAD_INVESTMENT.MIN_WEALTH) return 0;
  if (createRng(hashSeed(career.seed, career.season, 'bad-investment')).next() >= BAD_INVESTMENT.CHANCE) return 0;
  return Math.round((Math.max(0, career.finance.cash) * BAD_INVESTMENT.STAKE_SHARE) / 100) * 100;
}

/**
 * Começo de temporada da família: dá os traços de nascença a quem ainda não tem (saves antigos),
 * define o caminho dos filhos e põe na fila os eventos do ano.
 */
export function beginSeasonFamily(career: CareerState): CareerState {
  const settled = settleChildPaths(ensureHeritage(career));
  const known = new Set(settled.pendingEvents.map((e) => e.id));
  const events = familySeasonEvents(settled).filter((e) => !known.has(e.id));
  if (events.length === 0) return settled;
  // Fase 5: o texto de cada evento entra na memória das histórias (não volta para este personagem).
  return markSeen(
    { ...settled, pendingEvents: [...settled.pendingEvents, ...events] },
    events.flatMap((e) => (e.storyKey ? [e.storyKey] : [])),
    0,
  );
}

/**
 * Filhos que chegaram aos 14 anos sem vontade de correr seguem outro caminho.
 * Roda no começo da temporada, antes dos eventos.
 */
export function settleChildPaths(career: CareerState): CareerState {
  const children = career.family.children.map((c) =>
    (c.stage === 'child' || c.stage === 'karting') && c.age >= FAMILY.CAREER_START_AGE && c.interest < FAMILY.CAREER_INTEREST
      ? { ...c, stage: 'other' as const }
      : c,
  );
  return { ...career, family: { ...career.family, children } };
}
