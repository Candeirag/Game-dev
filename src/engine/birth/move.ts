/**
 * Mudança para São Paulo: o evento de quem nasceu no interior.
 *
 * Morar longe custa viagens a cada etapa e um treino com menos estrutura (ver `interiorWeighs`).
 * Cedo na carreira, depois da etapa BIRTH.MOVE_EVENT_ROUND, a família decide: mudar todo mundo
 * (custa mais, a moral sente pouco), mandar o piloto morar com parentes na capital (custa menos,
 * mas a saudade pesa) ou ficar mais um ano (o evento volta na temporada seguinte, enquanto o
 * piloto correr no Brasil). A mudança em si é o efeito `relocate`.
 */
import { BIRTH } from '@/config/balance';
import type { CareerState, PendingEvent } from '@/domain/schemas';
import { HOMETOWNS } from '@/data/birth';
import { money } from '../career/selectors';
import { storyOf } from '../story/memory';
import { activeBirth, interiorWeighs } from './effects';

const moveDefinitionId = 'birth-move';

/**
 * Os textos da mudança. A pergunta volta a cada temporada em que a família decide ficar, e cada vez
 * com um texto novo (Fase 5: nenhum texto se repete na carreira). Depois da última variante, a
 * família para de perguntar: ficar no interior virou a escolha da casa.
 */
interface MoveText {
  title: string;
  body: (town: string) => string;
  family: { label: string; description: (cost: string) => string; text: string };
  relatives: { label: string; description: (cost: string) => string; text: string };
  stay: { label: string; description: string; text: string };
}

const moveTexts: readonly MoveText[] = [
  {
    title: 'Mudança para São Paulo',
    body: (town) =>
      `As viagens de ${town} até os kartódromos estão pesando no bolso e no treino. As equipes, os kartódromos e os patrocinadores estão na capital. A família precisa decidir.`,
    family: {
      label: 'Mudar com a família',
      description: (cost) => `Todos vão juntos. Custa ${cost}, mas ninguém fica sozinho.`,
      text: 'A família aluga uma casa pequena na capital. O começo é difícil, mas vocês estão juntos.',
    },
    relatives: {
      label: 'Morar com parentes',
      description: (cost) => `Só você vai, para a casa dos tios. Custa ${cost}; a saudade pesa.`,
      text: 'Um colchão na sala dos tios, perto dos kartódromos. A saudade de casa aperta.',
    },
    stay: {
      label: 'Ficar mais um ano',
      description: 'Sem gastar agora. As viagens continuam, e a pergunta volta na próxima temporada.',
      text: 'A família fica no interior por enquanto. A estrada continua longa.',
    },
  },
  {
    title: 'A estrada de novo na mesa do jantar',
    body: (town) =>
      `Mais um ano de madrugadas na estrada entre ${town} e a capital. O carro da família já passou da revisão duas vezes, e a conversa sobre a mudança volta junto com a sobremesa.`,
    family: {
      label: 'Fechar a casa do interior e ir todo mundo',
      description: (cost) => `A família inteira muda. Custa ${cost}, e a casa antiga fica para alugar.`,
      text: 'O caminhão de mudança sai num domingo de manhã. Na capital, a casa é menor, mas o kartódromo fica a vinte minutos.',
    },
    relatives: {
      label: 'Aceitar o quarto que a madrinha ofereceu',
      description: (cost) => `Você vai na frente, para a casa da madrinha. Custa ${cost}; a família fica no interior.`,
      text: 'A madrinha arruma o quarto dos fundos e cola um pôster de kart na porta. O telefone com a família vira rotina de toda noite.',
    },
    stay: {
      label: 'Encarar mais uma temporada de estrada',
      description: 'A estrada continua. A pergunta volta no ano que vem.',
      text: 'O pai troca o óleo do carro e compra uma garrafa térmica maior. Mais um ano de estrada.',
    },
  },
  {
    title: 'O chefe da equipe pergunta pela mudança',
    body: (town) =>
      `Na reunião de começo de ano, o chefe da equipe é direto: quem mora em ${town} perde treino toda semana. A família ouve calada e promete dar uma resposta até o fim do mês.`,
    family: {
      label: 'Dizer ao chefe que a família inteira vem para a capital',
      description: (cost) => `A mudança de todos custa ${cost}. A equipe promete ajudar a achar uma casa.`,
      text: 'O mecânico-chefe indica um apartamento perto da oficina. Em um mês, a família inteira já está acomodada.',
    },
    relatives: {
      label: 'Topar morar com o primo que trabalha na capital',
      description: (cost) => `Você divide o apartamento com o primo. Custa ${cost}; a família continua longe.`,
      text: 'O apartamento do primo tem um quarto só, e o sofá vira a sua cama. Mas o treino agora é todo dia.',
    },
    stay: {
      label: 'Pedir ao chefe paciência por mais um ano',
      description: 'A equipe aceita, sem muita alegria. A pergunta ainda volta mais uma vez.',
      text: 'O chefe da equipe aceita, mas avisa que a paciência tem limite. A família respira e volta para a estrada.',
    },
  },
  {
    title: 'A última conversa sobre a capital',
    body: (town) =>
      `A família senta para decidir de uma vez. Ficar em ${town} é a escolha de quem já se acostumou com a estrada; ir para a capital é a de quem quer treinar mais. Desta vez, a decisão vale para sempre.`,
    family: {
      label: 'Arrumar as malas da família de uma vez por todas',
      description: (cost) => `Todos vão juntos, finalmente. Custa ${cost}.`,
      text: 'Depois de tantos anos de estrada, a família chega à capital. A primeira noite na casa nova tem cheiro de pizza e de alívio.',
    },
    relatives: {
      label: 'Ir morar com a tia avó na capital',
      description: (cost) => `A tia avó recebe você na capital. Custa ${cost}; o resto da família fica.`,
      text: 'A tia avó faz bolo de fubá toda tarde e não perde uma corrida pela televisão. A saudade de casa é menor do que você imaginava.',
    },
    stay: {
      label: 'Ficar de vez no interior',
      description: 'A família não toca mais no assunto: a estrada fica sendo parte da vida.',
      text: 'A decisão está tomada: a casa fica no interior, e a estrada vira parte da carreira.',
    },
  },
];

/** Quantas vezes a pergunta da mudança já apareceu para este personagem. */
function moveAsked(career: CareerState): number {
  return storyOf(career).seen.filter((s) => s.key.startsWith(`${moveDefinitionId}#`)).length;
}

/** O evento da mudança, se ele vale depois desta etapa. */
export function moveEventFor(career: CareerState, round: number): PendingEvent | null {
  const birth = activeBirth(career);
  if (!birth || career.mode !== 'driver' || round !== BIRTH.MOVE_EVENT_ROUND || !interiorWeighs(career)) return null;
  const id = `s${career.season}-r${round}-${moveDefinitionId}`;
  if (career.pendingEvents.some((e) => e.id === id) || career.eventLog.some((e) => e.id === id)) return null;
  const variant = moveAsked(career);
  const words = moveTexts[variant];
  if (!words) return null;
  const town = HOMETOWNS.find((h) => h.id === birth.hometownId)?.name ?? 'o interior';
  const familyCost = BIRTH.MOVE_WITH_FAMILY_COST;
  const relativesCost = BIRTH.MOVE_WITH_RELATIVES_COST;
  return {
    id,
    definitionId: moveDefinitionId,
    category: 'family',
    season: career.season,
    round,
    title: words.title,
    body: words.body(town),
    storyKey: `${moveDefinitionId}#${variant}`,
    choices: [
      {
        id: 'family',
        label: words.family.label,
        description: words.family.description(money(career, familyCost)),
        outcomes: [
          {
            probability: 1,
            text: words.family.text,
            effects: [
              { type: 'cash', value: -familyCost, ledger: 'family', label: 'Mudança para São Paulo' },
              { type: 'stat', stat: 'morale', value: BIRTH.MOVE_WITH_FAMILY_MORALE },
              { type: 'relocate' },
            ],
          },
        ],
      },
      {
        id: 'relatives',
        label: words.relatives.label,
        description: words.relatives.description(money(career, relativesCost)),
        outcomes: [
          {
            probability: 1,
            text: words.relatives.text,
            effects: [
              { type: 'cash', value: -relativesCost, ledger: 'family', label: 'Mudança para a casa dos tios' },
              { type: 'stat', stat: 'morale', value: BIRTH.MOVE_WITH_RELATIVES_MORALE },
              { type: 'relocate' },
            ],
          },
        ],
      },
      {
        id: 'stay',
        label: words.stay.label,
        description: words.stay.description,
        outcomes: [{ probability: 1, text: words.stay.text, effects: [] }],
      },
    ],
  };
}

/** Efeito `relocate`: o piloto passa a morar na capital a partir desta temporada. */
export function relocate(career: CareerState): CareerState {
  const birth = activeBirth(career);
  if (birth?.region !== 'interior' || birth.movedSeason !== null) return career;
  return { ...career, birth: { ...birth, movedSeason: career.season } };
}
