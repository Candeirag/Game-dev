/**
 * Eventos de pista (Fase 5): toques, comissários, peça nova, vistoria técnica, acerto, largada.
 * É a categoria de maior peso no sorteio (STORY_EVENTS.CATEGORY_WEIGHTS).
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const TRACK_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'toque-sofrido',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'contactVictim' }],
    needs: ['other'],
    choices: [
      {
        id: 'conversar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'other', size: -1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'criticar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'partir',
        requires: [{ c: 'trait', trait: 'hothead' }],
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'rivalry', who: 'other', size: 3 },
              { e: 'stat', stat: 'confidence', size: 2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 3 },
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A porta fechada de {outro}',
        body: '{outro} mudou de traçado na freada e mandou você para a grama em {pista}. No parque fechado, ele passa reto, de capacete ainda na mão.',
        choices: {
          conversar: {
            label: 'Ir até ele e conversar de cabeça fria',
            outcomes: ['Vocês assistem ao replay juntos. Ele admite que errou o ponto de freada, e a imprensa elogia a sua calma.'],
          },
          criticar: {
            label: 'Dizer aos jornalistas que ele não sabe perder',
            outcomes: [
              'A frase vira assunto na semana, e você sai dela como quem não leva desaforo para casa.',
              'A frase pega mal: os patrocinadores pedem que você deixe as brigas dentro da pista.',
            ],
          },
          partir: {
            label: 'Partir para cima dele ali mesmo, no parque fechado',
            outcomes: [
              'Os fiscais separam vocês antes de qualquer empurrão. Ninguém mais vai fechar a porta em você tão cedo.',
              'O empurrão é filmado de três ângulos. Os comissários anotam o seu nome, e a cena roda o país.',
            ],
          },
        },
      },
      {
        title: 'O retrovisor que {outro} não olhou',
        body: 'Na saída da curva, {outro} veio para cima sem olhar e encostou na sua roda traseira. Você terminou a volta com o carro torto e a paciência no limite.',
        choices: {
          conversar: {
            label: 'Mandar uma mensagem pedindo para os dois se acertarem',
            outcomes: ['Ele responde no fim da noite, sem rodeios: foi mal. O episódio morre ali.'],
          },
          criticar: {
            label: 'Reclamar dele no rádio, que vai ao ar na transmissão',
            outcomes: [
              'O desabafo vai ao ar e a torcida compra a sua versão.',
              'O palavrão escapa ao vivo, e o departamento comercial da equipe passa a semana pedindo desculpas.',
            ],
          },
          partir: {
            label: 'Esperar por ele na saída do box para tirar satisfação',
            outcomes: [
              'A conversa sobe de tom, mas termina num aperto de mão desconfiado. O recado foi dado.',
              'A discussão vira empurra-empurra na frente das câmeras, e a direção de prova não deixa passar.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'comissarios-convocam',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'contactCulprit' }],
    needs: ['other'],
    choices: [
      {
        id: 'assumir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'grid', who: 'player', size: 1 },
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'defender',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'grid', who: 'player', size: 2 },
              { e: 'penaltyPoints', size: 2 },
            ],
          },
        ],
      },
      {
        id: 'calma',
        requires: [{ c: 'trait', trait: 'cleanRacer' }],
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'reputation', size: 1 }] },
          { odds: 'rest', effects: [{ e: 'grid', who: 'player', size: 1 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'Chamado à sala dos comissários',
        body: 'Os comissários querem ouvir a sua versão do toque em {outro} em {pista}. A decisão vale para o grid da próxima etapa.',
        choices: {
          assumir: { label: 'Admitir que errou o ponto de freada', outcomes: ['A punição vem, mas branda. Os comissários anotam a honestidade.'] },
          defender: {
            label: 'Mostrar a telemetria e dizer que foi incidente de corrida',
            outcomes: ['Os comissários aceitam a explicação: incidente de corrida, sem punição.', 'Os comissários não se convencem e pesam a mão.'],
          },
          calma: {
            label: 'Lembrar que você nunca foi punido por jogo sujo',
            outcomes: ['O histórico limpo fala por você: só uma advertência.', 'Histórico não apaga imagem: a punição vem, ainda que leve.'],
          },
        },
      },
      {
        title: 'Investigação depois da bandeirada',
        body: 'A direção de prova abriu uma investigação sobre a sua manobra em cima de {outro}. Você tem quinze minutos para se apresentar.',
        choices: {
          assumir: {
            label: 'Entrar na sala e pedir desculpas a ele na frente de todos',
            outcomes: ['Você perde posições no grid, mas sai da sala com o respeito do paddock.'],
          },
          defender: {
            label: 'Levar o engenheiro e as imagens da câmera de bordo',
            outcomes: ['As imagens mostram que ele fechou a porta tarde. Caso arquivado.', 'As imagens mostram o contrário do que você queria mostrar.'],
          },
          calma: {
            label: 'Explicar a manobra com a calma de quem corre limpo',
            outcomes: ['Os comissários conhecem a sua fama e aceitam a explicação.', 'Desta vez a fama de piloto limpo não basta.'],
          },
        },
      },
    ],
  },
];
