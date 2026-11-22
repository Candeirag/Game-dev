/**
 * Cadeias de eventos com memória (Fase 5), parte A. Formato em `src/domain/storyEvents.ts`.
 *
 * Cada passo diz para onde a história vai em cada desfecho (`next`): o passo seguinte, com prazo,
 * ou o fim. O passo inicial entra no sorteio como um evento comum; os outros saem quando o prazo
 * vence e a condição vale. Uma cadeia acontece no máximo uma vez por personagem. A primeira escolha
 * de cada passo é a que segue a história (o robô do simulador escolhe sempre a primeira).
 */
import type { StoryChainSpec } from '@/domain/storyEvents';

export const CHAINS_A: readonly StoryChainSpec[] = [
  {
    id: 'velho-conhecido',
    title: 'Velho conhecido',
    summary: 'A rivalidade que nasce no kart (inclusive num toque de lance decisivo) segue o piloto, e o rival reaparece no grid das fórmulas.',
    start: 'rixa',
    steps: [
      {
        id: 'rixa',
        category: 'career',
        frequency: 'common',
        when: [{ c: 'tier', max: 3 }],
        needs: ['rival'],
        choices: [
          {
            id: 'encarar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'rival-kart', from: 'rival', role: 'rival dos tempos de kart', attitude: -1 },
                  { e: 'follow', key: 'rival-kart', on: true },
                  { e: 'rivalry', who: 'rival', size: 1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: { step: 'reencontro', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'apaziguar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'rival-kart', from: 'rival', role: 'rival dos tempos de kart', attitude: 1 },
                  { e: 'follow', key: 'rival-kart', on: true },
                  { e: 'flag', flag: 'rival-kart-paz' },
                  { e: 'rivalry', who: 'rival', size: -1 },
                ],
                next: { step: 'reencontro', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'partir',
            requires: [{ c: 'trait', trait: 'hothead' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'rival-kart', from: 'rival', role: 'rival dos tempos de kart', attitude: -3 },
                  { e: 'follow', key: 'rival-kart', on: true },
                  { e: 'rivalry', who: 'rival', size: 3 },
                  { e: 'penaltyPoints', size: 1 },
                ],
                next: { step: 'reencontro', delay: 'whenever' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O nome que você não esquece: {rival}',
            body: 'Corrida após corrida, é sempre {rival} na sua frente ou colado na sua traseira. No kartódromo, já tem gente apostando quem vai chegar primeiro às fórmulas.',
            choices: {
              encarar: {
                label: 'Assumir a rixa e prometer que vai chegar antes',
                outcomes: ['A promessa corre o paddock. A partir de hoje, cada corrida contra {rival} vale mais que os pontos.'],
              },
              apaziguar: {
                label: 'Chamar {rival} para um refrigerante depois da corrida',
                outcomes: ['Vocês riem das fechadas de sempre. Rivais na pista, quase amigos fora dela.'],
              },
              partir: {
                label: 'Partir para cima de {rival} na fila da balança',
                outcomes: ['Os pais separam a confusão, a federação aplica uma advertência, e o kartódromo inteiro ganha uma rivalidade para acompanhar.'],
              },
            },
          },
        ],
      },
      {
        id: 'reencontro',
        category: 'career',
        when: [
          { c: 'tier', min: 4 },
          { c: 'onGrid', key: 'rival-kart' },
        ],
        needs: ['person:rival-kart'],
        speaker: 'rival-kart',
        choices: [
          {
            id: 'cumprimentar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'duelo', delay: 'soon' },
              },
            ],
          },
          {
            id: 'provocar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: -1 },
                  { e: 'rivalry', who: 'person', key: 'rival-kart', size: 2 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: { step: 'duelo', delay: 'soon' },
              },
            ],
          },
          {
            id: 'abracar',
            requires: [{ c: 'flag', flag: 'rival-kart-paz' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: 2 },
                  { e: 'stat', stat: 'morale', size: 2 },
                ],
                next: { step: 'duelo', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Quem está no grid {categoria:de}?',
            body: 'Na reunião de pilotos, uma voz conhecida puxa a cadeira ao lado: {pessoa:rival-kart}, o mesmo dos tempos de kart, agora com macacão de fórmula e o mesmo sorriso de quem não pretende facilitar.',
            choices: {
              cumprimentar: {
                label: 'Estender a mão: quem diria, os dois aqui',
                outcomes: ['{primeiro:rival-kart} aperta a sua mão e lembra da primeira corrida de vocês. O paddock gosta da história.'],
              },
              provocar: {
                label: 'Dizer que no kart ele já ficava atrás',
                outcomes: ['{primeiro:rival-kart} não responde. Só ajusta o capacete e encara a pista: o recado foi entendido.'],
              },
              abracar: {
                label: 'Lembrar do refrigerante depois daquela corrida no kartódromo',
                outcomes: ['{primeiro:rival-kart} cai na risada e conta a história para a sala inteira. Rivais, sim; inimigos, nunca.'],
              },
            },
          },
        ],
      },
      {
        id: 'duelo',
        category: 'track',
        when: [{ c: 'onGrid', key: 'rival-kart' }],
        needs: ['person:rival-kart'],
        speaker: 'rival-kart',
        choices: [
          {
            id: 'respeitar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'acerto', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'apertar',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'rivalry', who: 'person', key: 'rival-kart', size: 2 },
                  { e: 'stat', stat: 'confidence', size: 2 },
                ],
                next: { step: 'acerto', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'rivalry', who: 'person', key: 'rival-kart', size: 2 },
                  { e: 'grid', who: 'player', size: 1 },
                ],
                next: { step: 'acerto', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A transmissão descobriu a história de vocês',
            body: 'O narrador passou a corrida inteira lembrando que você e {pessoa:rival-kart} se enfrentam desde o kart. Na próxima etapa, as câmeras vão estar em cima dos dois.',
            choices: {
              respeitar: {
                label: 'Dizer que {primeiro:rival-kart} é o adversário que mais te fez crescer',
                outcomes: ['A frase emociona até {primeiro:rival-kart}, que repete o elogio na entrevista seguinte.'],
              },
              apertar: {
                label: 'Prometer que, desta vez, não vai deixar espaço nenhum',
                outcomes: [
                  'Você cumpre: uma disputa limpa e dura, roda com roda, que vira o melhor momento da temporada.',
                  'Você cumpre até demais: os comissários acham que a porta fechou tarde.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'acerto',
        category: 'career',
        when: [],
        needs: ['person:rival-kart'],
        speaker: 'rival-kart',
        choices: [
          {
            id: 'brindar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: 2 },
                  { e: 'stat', stat: 'morale', size: 2 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'eterna',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'rival-kart', size: -2 },
                  { e: 'stat', stat: 'confidence', size: 2 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um convite de {pessoa:rival-kart}',
            body: 'Chega uma mensagem de {primeiro:rival-kart}: vai ter uma corrida de kart beneficente em {cidade}, com os pilotos daquela época. Ele quer você no grid, “para ver quem ainda é mais rápido”.',
            choices: {
              brindar: {
                label: 'Aceitar e levar a família para assistir',
                outcomes: ['Vocês dividem o pódio, o almoço e as lembranças. A rivalidade virou história boa de contar.'],
              },
              eterna: {
                label: 'Recusar: rival se enfrenta na pista de verdade',
                outcomes: ['{primeiro:rival-kart} entende o recado. Algumas rivalidades não acabam nunca, e essa é uma delas.'],
              },
            },
          },
        ],
      },
    ],
  },
];
