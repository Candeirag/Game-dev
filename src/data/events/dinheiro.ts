/**
 * Eventos de dinheiro (Fase 5): dívidas, investimentos, patrocinador cobrando, golpes, aportes.
 * As propostas de patrocínio não estão aqui: saem dos perfis de `patrocinadores.ts`.
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const MONEY_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'aporte-extra',
    category: 'money',
    frequency: 'normal',
    oncePerSeason: true,
    when: [],
    needs: ['cashCall'],
    choices: [
      { id: 'pagar', outcomes: [{ odds: 'sure', effects: [{ e: 'payCashCall' }, { e: 'stat', stat: 'teamTrust', size: 2 }] }] },
      {
        id: 'recusar',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'teamTrust', size: -2 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'car', size: -2 },
            ],
          },
        ],
      },
      { id: 'parcelar', outcomes: [{ odds: 'sure', effects: [{ e: 'splitCashCall' }] }] },
    ],
    variants: [
      {
        title: 'O patrocinador que sumiu da {equipe}',
        body: 'Um patrocinador da {equipe} parou de pagar no meio do ano. O chefe pede {valor} a você para manter as peças novas chegando até o fim da temporada.',
        choices: {
          pagar: { label: 'Pagar {valor} e manter o programa', outcomes: ['O dinheiro garante as atualizações, e a equipe fica devendo uma a você.'] },
          recusar: {
            label: 'Dizer que não tem de onde tirar',
            outcomes: [
              'A equipe aperta o cinto e segue como dá, mas o clima esfria.',
              'Sem dinheiro, as peças novas ficam na prateleira do fornecedor e o carro perde rendimento.',
            ],
          },
          parcelar: {
            label: 'Propor diluir o valor nas próximas parcelas da vaga',
            outcomes: ['A equipe topa: o aporte entra no contrato, um pouco por etapa.'],
          },
        },
      },
      {
        title: 'A conta das peças chegou antes',
        body: 'O fornecedor de motores da {equipe} antecipou a cobrança, e o caixa da equipe não fecha. Pedem {valor} a você como adiantamento.',
        choices: {
          pagar: {
            label: 'Transferir {valor} hoje mesmo',
            outcomes: ['O motor revisado chega a tempo, e o chefe faz questão de agradecer na frente de todos.'],
          },
          recusar: {
            label: 'Recusar e lembrar que o contrato não prevê isso',
            outcomes: [
              'O contrato está do seu lado, mas a boa vontade da equipe não.',
              'O motor revisado não vem, e você sente a diferença já na próxima reta.',
            ],
          },
          parcelar: {
            label: 'Aceitar que o valor entre no custo da vaga',
            outcomes: ['O valor vai para o contrato, e a conversa termina com um aperto de mão.'],
          },
        },
      },
    ],
  },
  {
    id: 'patrocinador-cobra',
    category: 'money',
    frequency: 'common',
    when: [],
    needs: ['unhappySponsor'],
    choices: [
      {
        id: 'prometer',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'acoes',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 3 },
              { e: 'stat', stat: 'form', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'encerrar',
        outcomes: [
          {
            odds: 'sure',
            effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'morale', size: 1 }, { e: 'stat', stat: 'reputation', size: -1 }],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{patrocinador} quer explicações',
        body: 'O gerente de marketing da {patrocinador} liga no domingo à noite. Os resultados não aparecem, o logo não aparece na TV e a diretoria fala em rescindir.',
        choices: {
          prometer: { label: 'Prometer uma reação nas próximas etapas', outcomes: ['Ele aceita esperar, mas deixa claro que é a última conversa amigável.'] },
          acoes: {
            label: 'Oferecer uma semana de gravações e visitas a clientes',
            outcomes: ['A agenda mata o seu descanso, mas a diretoria sai satisfeita das fotos.'],
          },
          encerrar: {
            label: 'Encerrar o contrato antes que ele encerre',
            outcomes: ['Você tira um peso das costas, e o paddock comenta que você saiu antes de ser demitido.'],
          },
        },
      },
      {
        title: 'Reunião marcada na sede da {patrocinador}',
        body: 'A {patrocinador} convoca você para uma reunião às oito da manhã. Na mesa, um gráfico com a sua posição no campeonato e uma linha vermelha bem acima dela.',
        choices: {
          prometer: {
            label: 'Olhar o gráfico e garantir que a linha vai ser alcançada',
            outcomes: ['Os diretores anotam a promessa em ata. Agora é com você.'],
          },
          acoes: {
            label: 'Propor um dia inteiro de ações com os funcionários deles',
            outcomes: ['Você tira foto com o setor inteiro de logística e volta para casa sem voz.'],
          },
          encerrar: {
            label: 'Agradecer o apoio e propor um fim amigável',
            outcomes: ['A reunião termina antes do café, com apertos de mão educados e um contrato a menos.'],
          },
        },
      },
    ],
  },
];
