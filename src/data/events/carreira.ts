/**
 * Eventos de carreira (Fase 5): propostas, rivais, imprensa, chefe de equipe, academias.
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const CAREER_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'coletiva-vitoria',
    category: 'career',
    frequency: 'common',
    when: [{ c: 'race', tag: 'win' }],
    choices: [
      {
        id: 'equipe',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'provocar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'carisma',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 3 },
              { e: 'sponsorMood', who: 'all', size: 2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Microfones depois da bandeirada',
        body: 'Você venceu em {pista}. Na sala de imprensa, a primeira pergunta é a de sempre: a que você atribui a vitória?',
        choices: {
          equipe: {
            label: 'Dividir o troféu com os mecânicos',
            outcomes: ['Os mecânicos ouvem a resposta pelo rádio do caminhão e comemoram como se tivessem pilotado.'],
          },
          provocar: {
            label: 'Avisar que isso é só o começo',
            outcomes: [
              'A frase vira manchete, e você dorme com a sensação de que pode tudo.',
              'A frase vira manchete e a equipe torce o nariz: ninguém gosta de soberba antes da hora.',
            ],
          },
          carisma: {
            label: 'Contar a história da corrida como quem conta um causo',
            outcomes: ['A sala ri, os vídeos circulam e os patrocinadores pedem o trecho para usar em propaganda.'],
          },
        },
      },
      {
        title: 'O pódio mais alto de {pista}',
        body: 'O champanhe ainda escorre do macacão quando o assessor puxa você para a coletiva. Há câmeras de canais que nunca tinham aparecido.',
        choices: {
          equipe: {
            label: 'Agradecer ao time pelo carro que entregou',
            outcomes: ['O chefe de equipe aparece na foto com você e manda imprimir o recorte do jornal.'],
          },
          provocar: {
            label: 'Mandar um recado para quem duvidou',
            outcomes: [
              'O recado chega a quem tinha de chegar, e a sua confiança vai lá em cima.',
              'O recado chega também à sua equipe, que não gostou de ser incluída entre os que duvidaram.',
            ],
          },
          carisma: {
            label: 'Responder às perguntas com bom humor e uma piada pronta',
            outcomes: ['Você vira o assunto mais comentado do fim de semana, e não só pelo resultado.'],
          },
        },
      },
    ],
  },
  {
    id: 'convite-academia',
    category: 'career',
    frequency: 'common',
    oncePerSeason: true,
    when: [],
    needs: ['academy'],
    choices: [
      {
        id: 'avaliacao',
        outcomes: [
          {
            odds: 'academy',
            effects: [{ e: 'joinAcademy' }, { e: 'stat', stat: 'reputation', size: 3 }, { e: 'stat', stat: 'confidence', size: 2 }],
          },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'confidence', size: -1 }] },
        ],
      },
      { id: 'recusar', outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'morale', size: 1 }] }] },
    ],
    variants: [
      {
        title: 'Olheiros da {academia}',
        body: 'Gente da {equipeTopo} acompanhou a sua temporada e convida você para um dia de avaliação. Quem entra na academia tem a vaga paga, mas aceita um patrocinador pessoal só, nada de investidor nem vaquinha, e precisa terminar cada temporada entre os {meta} primeiros. Chance estimada de aprovação: {chance}.',
        choices: {
          avaliacao: {
            label: 'Fazer a avaliação',
            outcomes: [
              'A aprovação sai na hora: a partir de agora você veste as cores da {academia}.',
              'Os engenheiros agradecem, mas escolhem outro piloto desta vez.',
            ],
          },
          recusar: { label: 'Agradecer e seguir independente', outcomes: ['Você prefere não dever nada a ninguém. A liberdade tem preço, e você topa pagar.'] },
        },
      },
      {
        title: 'Um telefonema da {equipeTopo}',
        body: 'O diretor da {academia} liga pessoalmente: querem ver você no simulador da fábrica. Os aprovados não pagam a vaga, mas devem exclusividade e resultado, entre os {meta} primeiros todo ano. Chance estimada de aprovação: {chance}.',
        choices: {
          avaliacao: {
            label: 'Pegar o primeiro voo para a fábrica',
            outcomes: [
              'Três dias de testes e uma assinatura: você entra para a {academia}.',
              'O simulador não perdoa. Não foi desta vez, mas o seu nome ficou anotado.',
            ],
          },
          recusar: {
            label: 'Dizer que prefere construir o caminho sozinho',
            outcomes: ['O diretor respeita a decisão e deixa a porta aberta. Você dorme tranquilo.'],
          },
        },
      },
    ],
  },
];
