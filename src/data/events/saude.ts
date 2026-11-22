/**
 * Eventos de saúde (Fase 5): lesões, virose, treino físico, sono, dieta.
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const HEALTH_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'virose',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      { id: 'descansar', outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'form', size: -1 }] }] },
      {
        id: 'treinar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Virose' },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'resistir',
        requires: [{ c: 'trait', trait: 'ironBody' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'Febre na semana da corrida',
        body: 'Metade da equipe pegou uma virose na viagem, e você acordou com o corpo pesado e trinta e oito graus no termômetro.',
        choices: {
          descansar: { label: 'Ficar dois dias de cama, longe do simulador', outcomes: ['A febre passa, mas o ritmo de treino da semana se perde.'] },
          treinar: {
            label: 'Tomar um remédio e manter a rotina',
            outcomes: ['O corpo aguenta, e você chega à pista sem perder um dia de trabalho.', 'O corpo cobra a conta: a virose volta com mais força.'],
          },
          resistir: { label: 'Confiar no corpo que nunca falha', outcomes: ['Um dia de mal-estar e mais nada. O seu corpo é do tipo que não adoece.'] },
        },
      },
      {
        title: 'O resfriado do caminhão-oficina',
        body: 'O ar-condicionado do caminhão da equipe passou a semana no máximo, e agora metade dos mecânicos espirra. Você sente a garganta arranhar.',
        choices: {
          descansar: { label: 'Faltar ao treino físico e tomar chá com mel', outcomes: ['A garganta melhora, o condicionamento perde uns dias.'] },
          treinar: {
            label: 'Ignorar e ir para a academia como sempre',
            outcomes: [
              'Você sua o resfriado para fora e chega ao fim de semana sem perder nada.',
              'O resfriado vira uma gripe daquelas, e você corre longe do seu melhor.',
            ],
          },
          resistir: { label: 'Dar de ombros: resfriado não pega em você', outcomes: ['Não pega mesmo. Na equipe inteira, só o seu bolso está sem lenço.'] },
        },
      },
    ],
  },
];
