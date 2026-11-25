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
  {
    // A chefia do kart que volta nas fórmulas. A pessoa pode ser homem ou mulher: nenhum texto usa
    // pronome ou adjetivo com gênero para ela. O caminho depende da primeira escolha (brigar ou
    // engolir) e as escolhas extras dependem da atitude acumulada (positiva no veto e na proposta,
    // negativa no fechamento). O interesse pela equipe da pessoa (`team: 'person'`) só entra depois
    // do passo em que ela muda de equipe: no mesmo desfecho, o vínculo ainda aponta para a equipe do
    // kart; ali o interesse vai para `{outraEquipe}`, que é a mesma equipe do `joinTeam`.
    id: 'chefe-nao-esquece',
    title: 'A bronca que ninguém esqueceu',
    summary:
      'Uma briga com a chefia da equipe no kart volta anos depois, quando a mesma pessoa assume a direção de uma equipe das fórmulas e decide se abre ou fecha a porta.',
    start: 'bronca',
    steps: [
      {
        id: 'bronca',
        category: 'career',
        frequency: 'normal',
        when: [
          { c: 'tier', max: 3 },
          { c: 'race', tag: 'behindTeammate' },
        ],
        needs: ['teammate'],
        choices: [
          {
            id: 'brigar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'chefe-kart', from: 'teamBoss', role: 'chefe de equipe dos tempos de kart', attitude: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'rancor', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'engolir',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'chefe-kart', from: 'teamBoss', role: 'chefe de equipe dos tempos de kart', attitude: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'gratidao', delay: 'whenever' },
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
                  { e: 'meet', key: 'chefe-kart', from: 'teamBoss', role: 'chefe de equipe dos tempos de kart', attitude: -3 },
                  { e: 'stat', stat: 'teamTrust', size: -2 },
                  { e: 'stat', stat: 'confidence', size: 2 },
                ],
                next: { step: 'rancor', delay: 'whenever' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Bronca na frente de todo mundo',
            body: '{pessoa:chefe-kart}, que comanda a {equipe}, junta os mecânicos e pergunta em voz alta por que {companheiro}, com o mesmo kart, terminou na sua frente. Os pais dos outros pilotos fingem que não estão ouvindo.',
            choices: {
              brigar: {
                label: 'Rebater na hora: o seu kart veio mal acertado',
                outcomes: [
                  'O bate-boca vira o assunto do kartódromo. {primeiro:chefe-kart} encerra a conversa com um “isso não vai ficar assim” e sai pisando duro.',
                ],
              },
              engolir: {
                label: 'Ouvir sem retrucar e pedir os dados para estudar',
                outcomes: [
                  'Você passa a noite comparando as suas voltas com as de {companheiro}. No dia seguinte, {primeiro:chefe-kart} percebe o esforço, mesmo sem dizer nada.',
                ],
              },
              partir: {
                label: 'Jogar o capacete no chão e encarar {primeiro:chefe-kart}',
                outcomes: [
                  'Um mecânico entra no meio antes que piore. O kartódromo comenta a cena por semanas, e {primeiro:chefe-kart} jura que não vai esquecer.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'rancor',
        category: 'career',
        when: [{ c: 'tier', min: 4 }],
        needs: ['person:chefe-kart', 'otherTeam'],
        speaker: 'chefe-kart',
        choices: [
          {
            id: 'desculpar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'chefe-kart', team: 'other' },
                  { e: 'attitude', key: 'chefe-kart', size: 1 },
                  { e: 'interest', team: 'other', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'veto', delay: 'soon' },
              },
            ],
          },
          {
            id: 'ignorar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'chefe-kart', team: 'other' },
                  { e: 'attitude', key: 'chefe-kart', size: -1 },
                  { e: 'interest', team: 'other', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: { step: 'veto', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Quem gritou no kart agora manda aqui',
            body: 'Corre a notícia no paddock: {pessoa:chefe-kart}, que comandava a {org:chefe-kart} nos tempos do bate-boca no kart, assumiu a direção da {outraEquipe}. No primeiro encontro, o aperto de mão vem seco, e o olhar, mais seco ainda.',
            choices: {
              desculpar: {
                label: 'Pedir desculpas pelo bate-boca daquele dia',
                outcomes: ['{primeiro:chefe-kart} escuta até o fim, balança a cabeça e diz que vai pensar. Não é perdão, mas também não é porta fechada.'],
              },
              ignorar: {
                label: 'Passar reto, como se nunca tivessem se visto',
                outcomes: ['Você segue de queixo erguido. Da janela do motorhome da {outraEquipe}, {primeiro:chefe-kart} acompanha cada passo seu.'],
              },
            },
          },
        ],
      },
      {
        id: 'gratidao',
        category: 'career',
        when: [{ c: 'tier', min: 4 }],
        needs: ['person:chefe-kart', 'otherTeam'],
        speaker: 'chefe-kart',
        choices: [
          {
            id: 'agradecer',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'chefe-kart', team: 'other' },
                  { e: 'attitude', key: 'chefe-kart', size: 1 },
                  { e: 'interest', team: 'other', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'proposta', delay: 'soon' },
              },
            ],
          },
          {
            id: 'distancia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'chefe-kart', team: 'other' },
                  { e: 'attitude', key: 'chefe-kart', size: -2 },
                  { e: 'interest', team: 'other', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'proposta', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma lembrança boa dos tempos de kart',
            body: '{pessoa:chefe-kart}, que comandava a {org:chefe-kart} nos seus tempos de kart, assumiu a direção da {outraEquipe} e aparece no seu box: “Lembro de quem ouviu a bronca sem retrucar e voltou mais rápido.”',
            choices: {
              agradecer: {
                label: 'Agradecer pela lição daquele dia no kart',
                outcomes: [
                  '{primeiro:chefe-kart} ri e diz que a lição saiu de graça; a próxima conversa pode ser de negócios. Da sua equipe, alguém viu tudo.',
                ],
              },
              distancia: {
                label: 'Cumprimentar rápido e voltar para o seu box',
                outcomes: [
                  '{primeiro:chefe-kart} esperava mais que um aperto de mão apressado e sai sem disfarçar o incômodo. A sua equipe, pelo menos, gostou da discrição.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'veto',
        category: 'career',
        when: [],
        needs: ['person:chefe-kart'],
        choices: [
          {
            id: 'responder-pista',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 2 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: -1 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'portas-fechadas',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'chefe-kart', size: 1 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'lembrar-desculpas',
            requires: [{ c: 'attitude', key: 'chefe-kart', level: 'positive' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'chefe-kart', size: 2 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: 2 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um nome riscado da lista',
            body: 'Um mecânico da {org:chefe-kart} conta baixinho: o seu nome estava na lista para o ano que vem, até {pessoa:chefe-kart} riscar com caneta vermelha na reunião. O motivo, segundo quem estava na sala, foi “aquele dia no kart”.',
            choices: {
              'responder-pista': {
                label: 'Responder do único jeito que importa: na pista',
                outcomes: ['Você treina em dobro e larga com sangue nos olhos. A {org:chefe-kart} continua de porta fechada, mas cada volta sua é um recado.'],
              },
              'portas-fechadas': {
                label: 'Pedir uma conversa de portas fechadas com {primeiro:chefe-kart}',
                outcomes: ['A conversa é tensa e curta. Ninguém pede desculpas, mas {primeiro:chefe-kart} admite que talvez tenha exagerado no veto.'],
              },
              'lembrar-desculpas': {
                label: 'Lembrar que você já pediu desculpas, olho no olho',
                outcomes: [
                  '{primeiro:chefe-kart} fica em silêncio, depois pega a caneta e tira o risco da lista. Na sua equipe, a reaproximação não pega bem.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'proposta',
        category: 'career',
        when: [],
        needs: ['person:chefe-kart'],
        speaker: 'chefe-kart',
        choices: [
          {
            id: 'por-escrito',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: 2 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'ficar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'teamTrust', size: 2 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: -1 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'aperto',
            requires: [{ c: 'attitude', key: 'chefe-kart', level: 'positive' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: 3 },
                  { e: 'attitude', key: 'chefe-kart', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -2 },
                ],
                next: { step: 'ultima-palavra', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um café no motorhome da {org:chefe-kart}',
            body: '{pessoa:chefe-kart} chama você para um café no motorhome da {org:chefe-kart}. Relembra a bronca no kart, elogia o quanto você cresceu e solta, como quem não quer nada: vai abrir uma vaga para o ano que vem.',
            choices: {
              'por-escrito': {
                label: 'Pedir a proposta por escrito para estudar com calma',
                outcomes: ['A proposta chega no dia seguinte, e a notícia vaza junto. Na {equipe}, a chefia passa a olhar você de canto.'],
              },
              ficar: {
                label: 'Agradecer e dizer que o seu lugar é na {equipe}',
                outcomes: ['{primeiro:chefe-kart} respeita a lealdade, mas avisa que a porta não fica aberta para sempre. A sua equipe fica sabendo e gosta.'],
              },
              aperto: {
                label: 'Selar o compromisso num aperto de mão, à moda do kart',
                outcomes: [
                  'Sem papel, sem empresário: só a palavra, como no kartódromo. A {org:chefe-kart} passa a tratar você como piloto da casa, e a sua equipe desconfia.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'ultima-palavra',
        category: 'career',
        when: [],
        needs: ['person:chefe-kart'],
        speaker: 'chefe-kart',
        choices: [
          {
            id: 'brindar-kart',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'chefe-kart', size: 2 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'recusar-taca',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'chefe-kart', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'desabafar',
            requires: [{ c: 'attitude', key: 'chefe-kart', level: 'negative' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'chefe-kart', size: -2 },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'interest', team: 'person', key: 'chefe-kart', size: -2 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Duas taças e uma conversa sem plateia',
            body: 'Num jantar de patrocinadores da categoria, {pessoa:chefe-kart} atravessa o salão com duas taças na mão. Desde aquela bronca no kart, a história de vocês deu muitas voltas. Desta vez, ninguém está olhando.',
            choices: {
              'brindar-kart': {
                label: 'Aceitar a taça e brindar aos tempos de kart',
                outcomes: ['Vocês riem da bronca, da resposta e de tudo o que veio depois. Do outro lado do salão, a sua equipe observa, sem achar graça.'],
              },
              'recusar-taca': {
                label: 'Agradecer, recusar a taça e voltar para a sua mesa',
                outcomes: ['{primeiro:chefe-kart} entende o recado, ergue a taça na sua direção e bebe assim mesmo. Página virada, cada um do seu lado.'],
              },
              desabafar: {
                label: 'Dizer, enfim, tudo o que ficou entalado desde o kart',
                outcomes: [
                  'Sai tudo: a bronca, os olhares no paddock, os anos de silêncio. {primeiro:chefe-kart} escuta sem piscar. A alma fica leve; a ponte, queimada.',
                ],
              },
            },
          },
        ],
      },
    ],
  },
  {
    // A padaria da cidade natal. Quem toca a padaria pode ser homem ou mulher: nenhum texto usa
    // pronome ou adjetivo com gênero para essa pessoa. O perfil de patrocinador é o
    // `padaria-pao-da-vila`, só de cadeia. A atitude decide a escolha extra do desfecho: no orgulho,
    // só quem foi à festa da vitrine chega a "fiel"; na fofoca, só quem foi à festa ainda tem
    // atitude positiva depois de esquecer a carta.
    id: 'pao-da-vila',
    title: 'A padaria que acreditou primeiro',
    summary:
      'A padaria do bairro patrocina o kart na adolescência, comemora cada subida e, na chegada ao topo, pede uma retribuição que a cidade inteira vai comentar.',
    start: 'balcao',
    steps: [
      {
        id: 'balcao',
        category: 'money',
        frequency: 'common',
        when: [
          { c: 'tier', max: 2 },
          { c: 'age', to: 'teen' },
          { c: 'has', what: 'freeSponsorSlot' },
        ],
        choices: [
          {
            id: 'aceitar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'sponsor', profile: 'padaria-pao-da-vila' },
                  { e: 'meet', key: 'padaria', from: 'stranger', org: 'Padaria Pão da Vila', role: 'responsável pela padaria do bairro', attitude: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: { step: 'vitrine', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'recusar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Patrocínio com cheiro de pão quente',
            body: '{pessoa:padaria}, que toca a Padaria Pão da Vila há décadas em {cidade}, acompanha as suas corridas pelo grupo do bairro. Hoje, entre um pão na chapa e outro, oferece um patrocínio: o nome da padaria no seu kart.',
            choices: {
              aceitar: {
                label: 'Apertar a mão de {primeiro:padaria} por cima do balcão',
                outcomes: ['O adesivo de um pão francês sorridente vai para o bico do kart. Os outros pilotos riem, mas o patrocínio paga os pneus do mês.'],
              },
              recusar: {
                label: 'Agradecer e dizer que ainda é cedo para patrocínio',
                outcomes: ['{primeiro:padaria} entende e embrulha um sonho de creme para a viagem. No bairro, tem quem ache a recusa meio esnobe.'],
              },
            },
          },
        ],
      },
      {
        id: 'vitrine',
        category: 'personal',
        when: [{ c: 'tier', min: 3 }],
        needs: ['person:padaria'],
        speaker: 'padaria',
        choices: [
          {
            id: 'festa',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 1 },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'retribuicao', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'video',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: -1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'retribuicao', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'discurso',
            requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'retribuicao', delay: 'whenever' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A sua foto foi parar na vitrine',
            body: 'Em {cidade}, a Pão da Vila tirou o bolo de fubá da vitrine para pôr a sua foto de macacão. {primeiro:padaria} encomendou um bolo com o seu número e chamou o bairro para comemorar a sua chegada {categoria:a}.',
            choices: {
              festa: {
                label: 'Pegar a estrada e cortar o bolo com o bairro',
                outcomes: [
                  'Tem fila para foto, discurso de vizinho e criança de capacete de papelão. Você volta tarde, com a voz falhando, e o treino da semana fica para trás.',
                ],
              },
              video: {
                label: 'Gravar um vídeo de agradecimento e seguir no treino',
                outcomes: ['{primeiro:padaria} passa o vídeo na televisão do balcão o dia inteiro, mas o bairro sente a sua falta na festa.'],
              },
              discurso: {
                label: 'Ir à festa e emocionar o bairro com um discurso',
                outcomes: [
                  'Você agradece a cada vizinho pelo nome e termina falando de {primeiro:padaria}. O vídeo do discurso roda a cidade antes de o bolo acabar.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'retribuicao',
        category: 'money',
        when: [{ c: 'tier', min: 7 }],
        needs: ['person:padaria'],
        speaker: 'padaria',
        choices: [
          {
            id: 'capacete',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 2 },
                  { e: 'sponsorMood', who: 'all', size: -2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'orgulho', delay: 'soon' },
              },
            ],
          },
          {
            id: 'reforma',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: -2, cap: true },
                  { e: 'attitude', key: 'padaria', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'orgulho', delay: 'soon' },
              },
            ],
          },
          {
            id: 'esquecer',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: -2 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'fofoca', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma carta com cheiro de forno',
            body: '{primeiro:padaria} escreve de {cidade}: o forno da Pão da Vila não aguenta mais, e a reforma não sai sem ajuda. No fim, um pedido tímido: o nome da padaria no seu capacete, no ano de estreia {categoria:em}.',
            choices: {
              capacete: {
                label: 'Estampar a padaria no capacete, entre as marcas grandes',
                outcomes: [
                  'O pão francês sorridente aparece na transmissão para o mundo inteiro. Os patrocinadores grandes reclamam do espaço; em {cidade}, a fila dobra a esquina.',
                ],
              },
              reforma: {
                label: 'Mandar dinheiro para a reforma do forno',
                outcomes: ['Chega a foto do forno novo, com um bilhete de {primeiro:padaria}: a primeira fornada saiu com o seu nome escrito na massa.'],
              },
              esquecer: {
                label: 'Guardar a carta na gaveta e pensar só nas corridas',
                outcomes: ['A carta fica sem resposta. A cabeça agradece, livre para as corridas; o coração de {cidade}, nem tanto.'],
              },
            },
          },
        ],
      },
      {
        id: 'orgulho',
        category: 'personal',
        when: [],
        needs: ['person:padaria'],
        speaker: 'padaria',
        choices: [
          {
            id: 'visita',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 1 },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'radio',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: 1 },
                  { e: 'attitude', key: 'padaria', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'balcao',
            requires: [{ c: 'attitude', key: 'padaria', level: 'loyal' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Em {cidade}, o assunto é um só',
            body: 'Na Pão da Vila, as suas corridas passam num telão improvisado, e o cafezinho sai de graça a cada ultrapassagem. {primeiro:padaria} avisa: a escola do bairro quer uma visita sua, e a rádio da cidade quer entrevista.',
            choices: {
              visita: {
                label: 'Visitar a escola do bairro nas férias',
                outcomes: ['Você fala de kart, de estudo e de pão na chapa para um ginásio lotado. As férias encurtam, mas a alma volta cheia.'],
              },
              radio: {
                label: 'Dar a entrevista para a rádio por telefone',
                outcomes: ['A entrevista dura o tempo de um café. A cidade gosta, mas {primeiro:padaria} esperava ver você de perto desta vez.'],
              },
              balcao: {
                label: 'Passar uma tarde atrás do balcão, servindo o bairro',
                outcomes: [
                  'Você serve pão na chapa, tira foto com cada freguês e erra todos os trocos. {primeiro:padaria} diz que foi o melhor dia da padaria em décadas.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'fofoca',
        category: 'personal',
        when: [],
        needs: ['person:padaria'],
        choices: [
          {
            id: 'telefonar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'deixar-falar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                  { e: 'attitude', key: 'padaria', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'surpresa',
            requires: [{ c: 'attitude', key: 'padaria', level: 'positive' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'padaria', size: 2 },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O bairro comenta, e não é elogio',
            body: 'Em {cidade}, o assunto é que você chegou ao topo e esqueceu quem pagou os primeiros pneus. Na Pão da Vila, {primeiro:padaria} não fala mal de ninguém, mas também não desmente.',
            choices: {
              telefonar: {
                label: 'Ligar para a padaria e explicar a correria do topo',
                outcomes: ['{primeiro:padaria} atende sem muita conversa, escuta tudo e deseja boa sorte. Não conserta o passado, mas o falatório diminui.'],
              },
              'deixar-falar': {
                label: 'Deixar o bairro falar e seguir em frente',
                outcomes: ['O falatório passa com o tempo. A sua foto, não: na vitrine da Pão da Vila, agora só tem bolo de cenoura.'],
              },
              surpresa: {
                label: 'Aparecer de surpresa no balcão, como nos tempos do kart',
                outcomes: [
                  'O bairro inteiro vê você entrar. {primeiro:padaria} segura o choro, serve o pão na chapa de sempre, e a sua foto volta para a vitrine.',
                ],
              },
            },
          },
        ],
      },
    ],
  },
];
