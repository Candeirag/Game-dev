/**
 * Eventos de vida pessoal (Fase 5): escola, família, amizades, namoro, filhos. Peso baixo no
 * sorteio (STORY_EVENTS.CATEGORY_WEIGHTS): o foco do jogo é a pista.
 *
 * Namoro adolescente não usa o efeito de parceiro (que cria um cônjuge de verdade, com herança e
 * filhos): fica nas marcas e nos indicadores. Formato em `src/domain/storyEvents.ts`. A primeira
 * escolha de cada evento é a "natural" (é a que o robô do simulador escolhe). Acrescente eventos no
 * fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const PERSONAL_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'prova-escola',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'teen' }],
    choices: [
      {
        id: 'estudar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'pista',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Prova de matemática na sexta-feira',
        body: 'A professora marcou a prova bimestral para o mesmo dia do treino livre. Sua mãe já avisou que, se a nota vier vermelha, o kart fica na garagem.',
        choices: {
          estudar: {
            label: 'Fazer a prova e chegar atrasado ao treino',
            outcomes: ['Nota oito e meio. O treino você recupera no sábado, a paz em casa não teria volta.'],
          },
          pista: {
            label: 'Pedir para fazer a prova de segunda chamada',
            outcomes: ['A escola aceita, e você roda o treino inteiro sem culpa.', 'A escola aceita, mas a bronca em casa dura a semana inteira.'],
          },
        },
      },
      {
        title: 'Trabalho em grupo no fim de semana',
        body: 'O grupo da feira de ciências marcou de montar o vulcão de bicarbonato no sábado, dia de corrida. Os colegas contam com você.',
        choices: {
          estudar: {
            label: 'Montar o vulcão na quinta à noite, virando a madrugada',
            outcomes: ['O vulcão funciona, os colegas agradecem e você chega à pista com sono, mas de consciência leve.'],
          },
          pista: {
            label: 'Dizer ao grupo que a corrida vem primeiro',
            outcomes: [
              'O grupo entende: no fim, colocam o seu nome no cartaz mesmo assim.',
              'O grupo não entende, e a segunda-feira na escola fica bem mais fria.',
            ],
          },
        },
      },
    ],
  },
];
