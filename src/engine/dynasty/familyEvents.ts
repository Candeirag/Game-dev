/**
 * Eventos de família, gerados no começo de cada temporada.
 *
 * Seguem a mesma regra dos demais eventos: cada escolha tem efeitos em dados,
 * aplicados por events/effects.ts. Conhecer alguém, casar, ter filhos, lidar
 * com uma crise e decidir a formação dos filhos mexem com moral, fase,
 * dinheiro, patrimônio e, mais tarde, com a sucessão.
 */
import type { CareerState, Effect, EventChoice, PendingEvent } from '@/domain/schemas';
import { LIFESTYLE_RULES } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { FAMILY, PARTNER_BACKGROUND_INFO, getTrait } from '@/data/family';
import { getPlayer } from '../career/selectors';
import { createRng, hashSeed } from '../rng';
import { livingCostBase } from '../management/executive';
import { generateChild, generatePartner } from './family';
import { money } from '../career/selectors';
import { counted } from '@/domain/text';

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
  const add = (kind: string, title: string, body: string, choices: EventChoice[]) =>
    events.push({
      id: `s${career.season}-family-${kind}`,
      definitionId: `family-${kind}`,
      category: 'family',
      season: career.season,
      round: 0,
      title,
      body,
      choices,
    });

  if (!partner && player.age >= FAMILY.PARTNER_MIN_AGE && partnerRoll < FAMILY.PARTNER_CHANCE) {
    const candidate = generatePartner(hashSeed(career.seed, career.season, 'partner'), player.age, career.season);
    const info = PARTNER_BACKGROUND_INFO[candidate.background];
    add(
      'partner',
      `Você conheceu ${candidate.firstName}`,
      `Em um evento fora das pistas, você conheceu ${candidate.firstName} ${candidate.lastName}, ${candidate.age} anos (${info.name.toLowerCase()}). ${info.description} Um relacionamento toma tempo e atenção, mas quem tem a vida pessoal em ordem corre com a cabeça mais leve.`,
      [
        choice(
          'date',
          'Investir no relacionamento',
          'Vocês começam a namorar. Menos tempo livre: a fase cai um pouco agora.',
          sure(`Você e ${candidate.firstName} estão juntos.`, { type: 'partner', partner: candidate }, stat('form', -3), stat('morale', 6)),
        ),
        choice('focus', 'Focar só na carreira', 'Nada muda na rotina.', sure('Você preferiu não se envolver agora.', stat('morale', -2))),
      ],
    );
  }

  if (partner && !partner.married && partner.relationship >= FAMILY.MARRIAGE_RELATIONSHIP && career.season > partner.sinceSeason) {
    const party = Math.round(living * FAMILY.WEDDING_COST);
    add(
      'wedding',
      'Casamento em pauta',
      `Você e ${partner.firstName} estão juntos há ${counted(career.season - partner.sinceSeason, 'temporada', 'temporadas')} e o assunto casamento apareceu. O casamento dá estabilidade (a relação se desgasta menos), mas, em um divórcio, o cônjuge fica com ${Math.round(FAMILY.DIVORCE_SHARE * 100)}% do patrimônio.`,
      [
        choice(
          'party',
          'Casar com festa',
          `Custa ${money(career, party)}.`,
          sure(
            `Você e ${partner.firstName} se casaram em uma grande festa.`,
            { type: 'marry' },
            cash(-party, 'Festa de casamento'),
            { type: 'relationship', value: 10 },
            stat('morale', 8),
          ),
        ),
        choice(
          'simple',
          'Cerimônia simples',
          `Custa ${money(career, party * 0.2)}.`,
          sure(
            `Você e ${partner.firstName} se casaram em uma cerimônia íntima.`,
            { type: 'marry' },
            cash(-party * 0.2, 'Casamento'),
            { type: 'relationship', value: 4 },
            stat('morale', 5),
          ),
        ),
        choice(
          'wait',
          'Adiar',
          'A relação esfria um pouco.',
          sure(`${partner.firstName} entendeu, mas ficou frustrado(a).`, { type: 'relationship', value: -8 }),
        ),
      ],
    );
  } else if (partner && partner.relationship < FAMILY.CRISIS_RELATIONSHIP) {
    const breakText = partner.married ? `${partner.firstName} pediu o divórcio.` : `${partner.firstName} terminou o relacionamento.`;
    add(
      'crisis',
      'Crise no relacionamento',
      `A relação com ${partner.firstName} vai mal: muitas viagens, pouca presença. Enquanto isso durar, a sua moral cai a cada etapa.${partner.married ? ` Um divórcio custaria ${Math.round(FAMILY.DIVORCE_SHARE * 100)}% do seu patrimônio.` : ''}`,
      [
        choice('therapy', 'Dedicar tempo ao casal', `Terapia e mais dias em casa: custa ${money(career, living * 0.3)} e um pouco de fase.`, [
          {
            probability: 0.7,
            text: 'O esforço deu resultado: a relação melhorou muito.',
            effects: [cash(-living * 0.3, 'Terapia de casal'), stat('form', -4), { type: 'relationship', value: 20 }],
          },
          {
            probability: 0.3,
            text: 'Houve alguma melhora, mas o problema continua.',
            effects: [cash(-living * 0.3, 'Terapia de casal'), stat('form', -4), { type: 'relationship', value: 7 }],
          },
        ]),
        choice(
          'trip',
          'Viagem a dois',
          `Custa ${money(career, living * 0.6)}.`,
          sure('A viagem fez bem aos dois.', cash(-living * 0.6, 'Viagem em família'), { type: 'relationship', value: 14 }),
        ),
        choice('ignore', 'Deixar como está', 'Arriscado: a relação pode acabar.', [
          {
            probability: 0.5,
            text: breakText,
            effects: [{ type: 'divorce', share: partner.married ? FAMILY.DIVORCE_SHARE : 0 }, stat('morale', -15), stat('confidence', -5)],
          },
          { probability: 0.5, text: 'Vocês seguem juntos, cada vez mais distantes.', effects: [{ type: 'relationship', value: -5 }, stat('morale', -6)] },
        ]),
      ],
    );
  }

  const youngest = children.reduce((min, c) => Math.min(min, c.age), 99);
  if (
    partner &&
    partner.relationship >= 55 &&
    player.age <= FAMILY.CHILD_MAX_PARENT_AGE &&
    partner.age <= 45 &&
    children.length < FAMILY.MAX_CHILDREN &&
    youngest >= 1 &&
    childRoll < FAMILY.CHILD_CHANCE
  ) {
    const baby = generateChild(career, hashSeed(career.seed, career.season, 'child'));
    add(
      'child',
      'Aumentar a família?',
      `Você e ${partner.firstName} conversam sobre ter ${children.length === 0 ? 'o primeiro filho' : 'mais um filho'}. Um filho herda parte do seu talento e pode continuar a história da família nas pistas, mas a criação e, mais tarde, a carreira dele custam caro.`,
      [
        choice(
          'yes',
          'Ter um filho',
          'A família cresce.',
          sure(`Nasceu ${baby.firstName} ${baby.lastName}.`, { type: 'child', child: baby }, { type: 'relationship', value: 6 }, stat('morale', 8)),
        ),
        choice('no', 'Ainda não', `${partner.firstName} queria; a relação sente.`, sure('Vocês decidiram esperar.', { type: 'relationship', value: -5 })),
      ],
    );
  }

  for (const child of children) {
    if (
      child.stage === 'child' &&
      child.age >= FAMILY.KART_START_AGE &&
      child.age < FAMILY.CAREER_START_AGE &&
      child.kartYears === 0 &&
      child.age === FAMILY.KART_START_AGE
    ) {
      add(
        `kart-${child.id}`,
        `${child.firstName} quer andar de kart`,
        `${child.firstName} fez ${child.age} anos e pede um kart. A formação vai até os ${FAMILY.CAREER_START_AGE - 1} anos: cada ano bem feito vale cerca de ${FAMILY.START_PER_KART_YEAR} pontos em todos os atributos quando a carreira começar, e mantém a vontade de correr.`,
        [
          choice(
            'full',
            'Programa completo',
            `${money(career, FAMILY.KART_COST.full)} por ano: equipe, treinador e campeonatos.`,
            sure(
              `${child.firstName} começou um programa completo de kart.`,
              { type: 'childKart', childId: child.id, funding: 'full' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: 5 },
            ),
          ),
          choice(
            'basic',
            'Kart de fim de semana',
            `${money(career, FAMILY.KART_COST.basic)} por ano: rende 60% da formação completa.`,
            sure(
              `${child.firstName} começou a correr nos fins de semana.`,
              { type: 'childKart', childId: child.id, funding: 'basic' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: 3 },
            ),
          ),
          choice(
            'none',
            'Agora não',
            'Sem custo. A vontade de correr diminui a cada ano.',
            sure(
              `${child.firstName} ficou decepcionado(a).`,
              { type: 'childKart', childId: child.id, funding: 'none' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: -6 },
            ),
          ),
        ],
      );
    }
    if ((child.stage === 'child' || child.stage === 'karting') && child.age >= FAMILY.CAREER_START_AGE && child.interest >= FAMILY.CAREER_INTEREST) {
      const traits = child.traits.map((t) => getTrait(t).name.toLowerCase()).join(' e ');
      const seat = getCategory('kart-regional').economy.seatCost;
      add(
        `career-${child.id}`,
        `${child.firstName} quer ser piloto`,
        `${child.firstName} tem ${child.age} anos, é ${traits} e quer disputar o kart regional. A formação no kart rendeu ${counted(child.kartYears.toFixed(1), 'ano', 'anos')} de base. Uma vaga custa de ${money(career, seat[1])} a ${money(career, seat[0])} por temporada, e o custo sobe muito nos degraus seguintes. O apoio da família define em que equipe ele começa e se consegue pagar as promoções.`,
        [
          choice(
            'full',
            'Bancar a carreira',
            'A família paga o que os patrocinadores dele não cobrirem.',
            sure(
              `${child.firstName} estreia no kart regional com apoio total.`,
              { type: 'childCareer', childId: child.id, support: 'full' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: 8 },
            ),
          ),
          choice(
            'basic',
            'Ajudar com metade',
            'A família paga até metade da vaga.',
            sure(
              `${child.firstName} estreia no kart regional com ajuda parcial.`,
              { type: 'childCareer', childId: child.id, support: 'basic' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: 3 },
            ),
          ),
          choice(
            'none',
            'Que conquiste sozinho',
            'Sem dinheiro da família: depende de bolsas e patrocinadores.',
            sure(
              `${child.firstName} vai tentar a sorte por conta própria.`,
              { type: 'childCareer', childId: child.id, support: 'none' },
              { type: 'childStat', childId: child.id, stat: 'bond', value: -6 },
            ),
          ),
          choice(
            'forbid',
            'Proibir',
            'Ele segue outro caminho. A relação sofre.',
            sure(
              `${child.firstName} desistiu das pistas, magoado(a).`,
              { type: 'childStat', childId: child.id, stat: 'interest', value: -100 },
              { type: 'childStat', childId: child.id, stat: 'bond', value: -20 },
            ),
          ),
        ],
      );
    }
  }
  return events;
}

/** Começo de temporada da família: define o caminho dos filhos e põe na fila os eventos do ano. */
export function beginSeasonFamily(career: CareerState): CareerState {
  const settled = settleChildPaths(career);
  const known = new Set(settled.pendingEvents.map((e) => e.id));
  const events = familySeasonEvents(settled).filter((e) => !known.has(e.id));
  return events.length > 0 ? { ...settled, pendingEvents: [...settled.pendingEvents, ...events] } : settled;
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
