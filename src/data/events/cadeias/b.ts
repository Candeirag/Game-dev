/** Cadeias de eventos com memória (Fase 5), parte B. Formato em `src/domain/storyEvents.ts` (veja a parte A). */
import type { StoryChainSpec } from '@/domain/storyEvents';

export const CHAINS_B: readonly StoryChainSpec[] = [
  {
    id: 'jornalista-do-kartodromo',
    title: 'A coluna da Gazeta',
    summary:
      'Quem pede a primeira entrevista no kart vira colunista de peso nas fórmulas e escreve sobre o piloto conforme foi tratado: elogio e documentário, ou farpa e furo.',
    start: 'pedido-de-entrevista',
    steps: [
      {
        id: 'pedido-de-entrevista',
        category: 'career',
        frequency: 'normal',
        when: [
          { c: 'tier', max: 3 },
          { c: 'notRace', tag: 'absent' },
        ],
        choices: [
          {
            id: 'atender',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'repórter iniciante', org: 'Gazeta do Kartódromo', attitude: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'coluna-amiga', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'despachar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'repórter iniciante', org: 'Gazeta do Kartódromo', attitude: -2 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'coluna-azeda', delay: 'whenever' },
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
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'repórter iniciante', org: 'Gazeta do Kartódromo', attitude: 3 },
                  { e: 'stat', stat: 'reputation', size: 2 },
                ],
                next: { step: 'coluna-amiga', delay: 'whenever' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um caderno na saída da balança',
            body: 'Depois da bateria em {pista}, alguém de crachá torto pede uma entrevista: {pessoa:jornalista-gazeta}, da Gazeta do Kartódromo, um jornalzinho que quase ninguém lê. É a primeira matéria de verdade de {primeiro:jornalista-gazeta}.',
            choices: {
              atender: {
                label: 'Responder com calma a todas as perguntas',
                outcomes: [
                  'A conversa dura quase uma hora e toma o seu treino da tarde. {primeiro:jornalista-gazeta} agradece três vezes e promete mandar o recorte.',
                ],
              },
              despachar: {
                label: 'Dizer que agora não dá e correr para o box',
                outcomes: ['{primeiro:jornalista-gazeta} fecha o caderno sem dizer nada. A matéria sai com duas linhas e uma foto sua de costas.'],
              },
              carisma: {
                label: 'Puxar duas cadeiras e contar a sua história',
                outcomes: ['A entrevista vira capa da Gazeta, e {primeiro:jornalista-gazeta} guarda a gravação como quem guarda um troféu.'],
              },
            },
          },
        ],
      },
      {
        id: 'coluna-amiga',
        category: 'career',
        when: [
          { c: 'tier', min: 4 },
          { c: 'attitude', key: 'jornalista-gazeta', level: 'positive' },
        ],
        needs: ['person:jornalista-gazeta'],
        speaker: 'jornalista-gazeta',
        choices: [
          {
            id: 'exclusiva',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'colunista de automobilismo', org: 'Gazeta do Kartódromo' },
                  { e: 'attitude', key: 'jornalista-gazeta', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'documentario', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'assessoria',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'colunista de automobilismo', org: 'Gazeta do Kartódromo' },
                  { e: 'attitude', key: 'jornalista-gazeta', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'furo', delay: 'later' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A coluna de domingo lembra do kart',
            body: '{pessoa:jornalista-gazeta} virou colunista de peso no automobilismo. A coluna de domingo conta a entrevista que você deu no kart, quando ninguém mais parava para ouvir, e termina com um pedido: uma conversa exclusiva.',
            choices: {
              exclusiva: {
                label: 'Dar a exclusiva para {primeiro:jornalista-gazeta}',
                outcomes: [
                  'A entrevista sai em página dupla, com a foto antiga do kart ao lado da nova. A assessoria da {equipe} reclama de não ter sido avisada.',
                ],
              },
              assessoria: {
                label: 'Mandar o pedido para a assessoria da {equipe}',
                outcomes: [
                  'A assessoria oferece dez minutos por telefone. {primeiro:jornalista-gazeta} aceita, mas a coluna seguinte fala de você em uma linha só.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'coluna-azeda',
        category: 'career',
        when: [
          { c: 'tier', min: 4 },
          { c: 'attitude', key: 'jornalista-gazeta', level: 'negative' },
        ],
        needs: ['person:jornalista-gazeta'],
        speaker: 'jornalista-gazeta',
        choices: [
          {
            id: 'ligar',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'colunista de automobilismo', org: 'Gazeta do Kartódromo' },
                  { e: 'attitude', key: 'jornalista-gazeta', size: 2 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: { step: 'documentario', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'colunista de automobilismo', org: 'Gazeta do Kartódromo' },
                  { e: 'attitude', key: 'jornalista-gazeta', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: { step: 'furo', delay: 'later' },
              },
            ],
          },
          {
            id: 'rebater',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'jornalista-gazeta', from: 'stranger', role: 'colunista de automobilismo', org: 'Gazeta do Kartódromo' },
                  { e: 'attitude', key: 'jornalista-gazeta', size: -2 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'furo', delay: 'later' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Duas linhas viraram uma coluna inteira',
            body: 'A coluna de {pessoa:jornalista-gazeta}, hoje lida pelo paddock inteiro, abre com uma lembrança: a entrevista que você negou no kart. “Já chegou com pressa”, diz o texto, que trata a sua carreira como promessa inflada.',
            choices: {
              ligar: {
                label: 'Ligar para {primeiro:jornalista-gazeta} e pedir desculpas pelo kart',
                outcomes: [
                  '{primeiro:jornalista-gazeta} ri do outro lado da linha e admite que também tinha pavio curto. A coluna seguinte é bem mais gentil.',
                  'O pedido de desculpas é aceito com frieza. A coluna seguinte não ataca, mas também não perdoa.',
                ],
              },
              rebater: {
                label: 'Responder à coluna nas redes, com ironia',
                outcomes: ['Os seus fãs adoram a resposta. {primeiro:jornalista-gazeta} guarda o print, e o paddock sabe que a briga só começou.'],
              },
            },
          },
        ],
      },
      {
        id: 'documentario',
        category: 'career',
        when: [],
        needs: ['person:jornalista-gazeta'],
        speaker: 'jornalista-gazeta',
        choices: [
          {
            id: 'gravar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'sponsorMood', who: 'all', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'recusar-cameras',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'attitude', key: 'jornalista-gazeta', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Do kartódromo para as telas',
            body: '{pessoa:jornalista-gazeta} conseguiu dinheiro para um documentário sobre a sua trajetória, do kart até {categoria:the}. Quer câmeras no box durante uma temporada e as fitas antigas da família.',
            choices: {
              gravar: {
                label: 'Abrir o box e o álbum da família às câmeras',
                outcomes: [
                  'O documentário estreia no fim do ano e emociona até o chefe de equipe. A rotina com câmeras, porém, cansa mais do que você previa.',
                ],
              },
              'recusar-cameras': {
                label: 'Recusar as câmeras: a sua história ainda está sendo escrita',
                outcomes: ['{primeiro:jornalista-gazeta} respeita a decisão e guarda o projeto na gaveta. Você ganha sossego, e a história fica para depois.'],
              },
            },
          },
        ],
      },
      {
        id: 'furo',
        category: 'career',
        when: [],
        needs: ['person:jornalista-gazeta'],
        speaker: 'jornalista-gazeta',
        choices: [
          {
            id: 'dar-versao',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'attitude', key: 'jornalista-gazeta', size: 1 },
                ],
                next: 'end',
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'attitude', key: 'jornalista-gazeta', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -2 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'desligar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                  { e: 'attitude', key: 'jornalista-gazeta', size: -1 },
                ],
                next: 'end',
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
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'attitude', key: 'jornalista-gazeta', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A coluna de amanhã fala de você',
            body: '{pessoa:jornalista-gazeta} liga tarde da noite: tem um furo sobre você e a {equipe}, uma conversa de bastidor que vazou da garagem. A coluna fecha em uma hora, e a pergunta é se você quer dar a sua versão.',
            choices: {
              'dar-versao': {
                label: 'Dar a sua versão, com nome e sobrenome',
                outcomes: [
                  'A coluna sai equilibrada, e o paddock elogia a franqueza. {primeiro:jornalista-gazeta} manda uma mensagem curta agradecendo a confiança.',
                  'A sua versão sai inteira, mas ao lado do vazamento. Na {equipe}, ninguém gostou de ler a conversa da garagem no jornal.',
                ],
              },
              desligar: {
                label: 'Negar tudo e desligar o telefone',
                outcomes: ['A coluna sai sem a sua versão e com um título duro. A equipe agradece o silêncio; os leitores, nem tanto.'],
              },
              carisma: {
                label: 'Contar tudo com bom humor e um causo do kart',
                outcomes: ['O furo vira crônica simpática, e a conversa vazada parece coisa pequena. Na {equipe}, todo mundo respira de novo.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: 'mecanico-do-primeiro-kart',
    title: 'A oficina do primeiro kart',
    summary:
      'Quem salvou o kart de graça numa madrugada pede emprego quando o piloto chega às fórmulas; contratado, vê o defeito que ninguém viu e um dia volta para reabrir a oficina.',
    start: 'madrugada-na-oficina',
    steps: [
      {
        id: 'madrugada-na-oficina',
        category: 'track',
        frequency: 'normal',
        when: [{ c: 'tier', max: 3 }],
        choices: [
          {
            id: 'virar-noite',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'mecanico-oficina',
                    from: 'stranger',
                    role: 'chefe da oficina do kartódromo',
                    org: 'oficina do kartódromo',
                    attitude: 2,
                  },
                  { e: 'car', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                  { e: 'flag', flag: 'mecanico-promessa' },
                ],
                next: { step: 'curriculo-no-box', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'pagar-pecas',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'mecanico-oficina',
                    from: 'stranger',
                    role: 'chefe da oficina do kartódromo',
                    org: 'oficina do kartódromo',
                    attitude: 1,
                  },
                  { e: 'car', size: 1 },
                  { e: 'cash', size: -1, cap: true },
                ],
                next: { step: 'curriculo-no-box', delay: 'whenever' },
              },
            ],
          },
          {
            id: 'aprender',
            requires: [{ c: 'trait', trait: 'quickLearner' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'mecanico-oficina',
                    from: 'stranger',
                    role: 'chefe da oficina do kartódromo',
                    org: 'oficina do kartódromo',
                    attitude: 2,
                  },
                  { e: 'attribute', attribute: 'experience', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'curriculo-no-box', delay: 'whenever' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A porta de aço aberta às dez',
            body: 'A uma semana da próxima etapa, o motor do seu kart engasga e morre no treino. {pessoa:mecanico-oficina}, que toca a oficina do kartódromo, levanta a porta de aço, olha o carburador e avisa que não vai cobrar nada.',
            choices: {
              'virar-noite': {
                label: 'Virar a noite na oficina e prometer não esquecer',
                outcomes: [
                  'De madrugada, o motor canta de novo. Entre um café e outro, {primeiro:mecanico-oficina} conta trinta anos de kartódromo, e você jura retribuir um dia.',
                ],
              },
              'pagar-pecas': {
                label: 'Fazer questão de pagar ao menos as peças',
                outcomes: [
                  '{primeiro:mecanico-oficina} aceita o dinheiro das peças a contragosto e devolve o troco em parafusos. O kart volta melhor do que estava.',
                ],
              },
              aprender: {
                label: 'Ficar ao lado aprendendo cada ajuste do motor',
                outcomes: [
                  'Na terceira hora, você já regula o carburador sem ajuda. {primeiro:mecanico-oficina} diz que nunca viu ninguém pegar o jeito tão rápido.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'curriculo-no-box',
        category: 'career',
        when: [
          { c: 'tier', min: 4 },
          { c: 'season', part: 'early' },
        ],
        needs: ['person:mecanico-oficina'],
        speaker: 'mecanico-oficina',
        choices: [
          {
            id: 'contratar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'mecanico-oficina', team: 'current' },
                  { e: 'meet', key: 'mecanico-oficina', from: 'stranger', role: 'integrante do seu box', org: 'oficina do kartódromo' },
                  { e: 'attitude', key: 'mecanico-oficina', size: 2 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'olho-no-defeito', delay: 'soon' },
              },
            ],
          },
          {
            id: 'recusar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'mecanico-oficina', size: -2 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'oficina-sem-voce', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'promessa',
            requires: [{ c: 'flag', flag: 'mecanico-promessa' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'joinTeam', key: 'mecanico-oficina', team: 'current' },
                  { e: 'meet', key: 'mecanico-oficina', from: 'stranger', role: 'integrante do seu box', org: 'oficina do kartódromo' },
                  { e: 'attitude', key: 'mecanico-oficina', size: 3 },
                  { e: 'cash', size: -1, cap: true },
                ],
                next: { step: 'olho-no-defeito', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um currículo com foto do seu kart',
            body: 'Chega uma mensagem de {pessoa:mecanico-oficina}: a oficina do kartódromo fechou as portas. Junto, um currículo e uma foto antiga do seu kart na bancada. A pergunta é direta: tem lugar para mais alguém no box da {equipe}?',
            choices: {
              contratar: {
                label: 'Levar o currículo ao chefe e bancar a indicação',
                outcomes: [
                  'O chefe torce o nariz para indicação, mas aceita um período de teste. Na segunda-feira, {primeiro:mecanico-oficina} chega antes de todo mundo.',
                ],
              },
              recusar: {
                label: 'Explicar que a {equipe} não contrata por indicação',
                outcomes: ['{primeiro:mecanico-oficina} responde com um “entendo” seco. O chefe da {equipe} gosta de saber que você não mistura as coisas.'],
              },
              promessa: {
                label: 'Cumprir a promessa e pagar do bolso os primeiros meses',
                outcomes: [
                  'Você banca o salário até a {equipe} se convencer. No primeiro dia de box, {primeiro:mecanico-oficina} diz que promessa de kartódromo vale mais que contrato.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'olho-no-defeito',
        category: 'track',
        when: [{ c: 'personAtTeam', key: 'mecanico-oficina' }],
        needs: ['person:mecanico-oficina'],
        speaker: 'mecanico-oficina',
        choices: [
          {
            id: 'trocar',
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'car', size: 1 },
                  { e: 'attitude', key: 'mecanico-oficina', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'volta-ao-kartodromo', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'grid', who: 'player', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'volta-ao-kartodromo', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'cronograma',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'attitude', key: 'mecanico-oficina', size: -1 },
                ],
                next: { step: 'volta-ao-kartodromo', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'car', size: -1 },
                  { e: 'attitude', key: 'mecanico-oficina', size: -1 },
                ],
                next: { step: 'volta-ao-kartodromo', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A trinca que só {primeiro:mecanico-oficina} viu',
            body: 'Na véspera da próxima etapa, {pessoa:mecanico-oficina} chama você num canto da garagem: uma trinca fina no braço da suspensão, que ninguém mais notou. Trocar agora atrasa o cronograma do chefe e exige virar a noite.',
            choices: {
              trocar: {
                label: 'Bancar a troca e virar a noite junto',
                outcomes: [
                  'A peça nova entra às quatro da manhã. Na corrida, você passa pelas zebras sem medo, e o chefe quer saber quem viu a trinca.',
                  'A troca atrasa, e o carro sai dos boxes com o grid já formado. O chefe da {equipe} não esconde a irritação.',
                ],
              },
              cronograma: {
                label: 'Seguir o cronograma e correr com a peça original',
                outcomes: [
                  'A peça aguenta a corrida inteira. Depois, {primeiro:mecanico-oficina} desmonta tudo e mostra a trinca maior, em silêncio.',
                  'A suspensão cede numa zebra, e o carro volta torto para os boxes. {primeiro:mecanico-oficina} não diz nada, nem precisa.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'volta-ao-kartodromo',
        category: 'personal',
        when: [],
        needs: ['person:mecanico-oficina'],
        speaker: 'mecanico-oficina',
        choices: [
          {
            id: 'cortar-fita',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'attitude', key: 'mecanico-oficina', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'segurar-no-box',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: -1, cap: true },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'attitude', key: 'mecanico-oficina', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A placa nova da oficina',
            body: 'Depois de um ano no seu box, {pessoa:mecanico-oficina} anuncia a saída: vai reabrir a oficina do kartódromo, agora com placa, alvará e fila de pais. O convite vem junto: quer você cortando a fita na inauguração.',
            choices: {
              'cortar-fita': {
                label: 'Ir ao kartódromo cortar a fita da oficina',
                outcomes: [
                  'A criançada faz fila para tirar foto com você ao lado do kart antigo, pendurado na parede. A viagem custa um dia de treino e vale cada minuto.',
                ],
              },
              'segurar-no-box': {
                label: 'Oferecer um aumento para {primeiro:mecanico-oficina} ficar',
                outcomes: ['O aumento sai do seu bolso, e a oficina fica para depois. No box, ninguém reclama de ter mais um par de olhos bons.'],
              },
            },
          },
        ],
      },
      {
        id: 'oficina-sem-voce',
        category: 'personal',
        when: [],
        needs: ['person:mecanico-oficina'],
        speaker: 'mecanico-oficina',
        choices: [
          {
            id: 'entrar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'mecanico-oficina', size: 2 },
                  { e: 'cash', size: -1, cap: true },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'dar-meia-volta',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: -1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A oficina reaberta sem a sua ajuda',
            body: 'De volta ao kartódromo onde tudo começou, você vê a porta de aço levantada de novo. {pessoa:mecanico-oficina} reabriu a oficina por conta própria e prepara karts para a criançada. Ainda não notou a sua chegada.',
            choices: {
              entrar: {
                label: 'Entrar, pedir desculpas e oferecer ajuda com as peças',
                outcomes: ['O abraço demora, mas vem. Você sai de lá com graxa na camisa, menos dinheiro no bolso e a promessa de voltar mais vezes.'],
              },
              'dar-meia-volta': {
                label: 'Dar meia-volta antes que {primeiro:mecanico-oficina} veja',
                outcomes: ['Você volta para o carro com um nó na garganta. A temporada está aí, e não sobra tempo para olhar para trás.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: 'golpe-da-vaga',
    title: 'O golpe da vaga',
    summary:
      'Um agente de fachada vende uma vaga numa equipe maior, some com o dinheiro e deixa o piloto entre a polícia, um advogado ou o silêncio, até a história virar lição para outras famílias.',
    start: 'proposta-da-vaga',
    steps: [
      {
        id: 'proposta-da-vaga',
        category: 'money',
        frequency: 'normal',
        when: [
          { c: 'tier', max: 5 },
          { c: 'cash', atLeast: 'tight' },
        ],
        choices: [
          {
            id: 'referencias',
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  {
                    e: 'meet',
                    key: 'golpe-vaga-agente',
                    from: 'stranger',
                    role: 'agente de pilotos',
                    org: 'Horizonte Agenciamento Esportivo',
                    attitude: 1,
                  },
                  { e: 'cash', size: -1, cap: true },
                  { e: 'flag', flag: 'golpe-vaga-recibo' },
                ],
                next: { step: 'sumico', delay: 'soon' },
              },
              {
                odds: 'rest',
                effects: [
                  {
                    e: 'meet',
                    key: 'golpe-vaga-agente',
                    from: 'stranger',
                    role: 'agente de pilotos',
                    org: 'Horizonte Agenciamento Esportivo',
                    attitude: 1,
                  },
                  { e: 'cash', size: -2, cap: true },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: { step: 'sumico', delay: 'soon' },
              },
            ],
          },
          {
            id: 'pagar-tudo',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'golpe-vaga-agente',
                    from: 'stranger',
                    role: 'agente de pilotos',
                    org: 'Horizonte Agenciamento Esportivo',
                    attitude: 2,
                  },
                  { e: 'cash', size: -2, cap: true },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'sumico', delay: 'soon' },
              },
            ],
          },
          {
            id: 'investigar',
            requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'golpe-vaga-agente',
                    from: 'stranger',
                    role: 'agente de pilotos',
                    org: 'Horizonte Agenciamento Esportivo',
                    attitude: -1,
                  },
                  { e: 'cash', size: -1, cap: true },
                  { e: 'flag', flag: 'golpe-vaga-recibo' },
                ],
                next: { step: 'sumico', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um contrato com timbre dourado',
            body: '{pessoa:golpe-vaga-agente}, da {org:golpe-vaga-agente}, aparece no box com pasta de couro e fotos ao lado de chefes de equipe. Garante uma vaga de titular numa equipe maior no ano que vem. Só pede adiantada uma parte da comissão.',
            choices: {
              referencias: {
                label: 'Pedir referências antes de soltar qualquer dinheiro',
                outcomes: [
                  'As referências atendem na hora e só têm elogios. Com a dúvida vencida, você paga uma parte e exige um recibo assinado.',
                  'As referências falam tão bem que você paga a comissão inteira de uma vez. O recibo fica para a próxima visita.',
                ],
              },
              'pagar-tudo': {
                label: 'Pagar a comissão inteira para não perder a vaga',
                outcomes: ['O aperto de mão é firme, e o sorriso também. Pela primeira vez, a equipe maior parece estar ao alcance.'],
              },
              investigar: {
                label: 'Pesquisar a agência no celular enquanto finge ler',
                outcomes: [
                  'A agência tem dois meses de vida e nenhum piloto na lista. Você paga um sinal simbólico para não espantar ninguém e guarda cada mensagem.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'sumico',
        category: 'money',
        when: [],
        needs: ['person:golpe-vaga-agente'],
        choices: [
          {
            id: 'delegacia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'golpe-vaga-agente', from: 'stranger', role: 'agente de fachada', org: 'Horizonte Agenciamento Esportivo' },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'prisao', delay: 'later' },
              },
            ],
          },
          {
            id: 'advogado',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'golpe-vaga-agente', from: 'stranger', role: 'agente de fachada', org: 'Horizonte Agenciamento Esportivo' },
                  { e: 'cash', size: -1, cap: true },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'acordo-na-mesa', delay: 'later' },
              },
            ],
          },
          {
            id: 'engolir',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'golpe-vaga-agente', from: 'stranger', role: 'agente de fachada', org: 'Horizonte Agenciamento Esportivo' },
                  { e: 'stat', stat: 'morale', size: -2 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'novo-alvo', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O telefone que só dá caixa postal',
            body: 'Na semana do teste prometido, {pessoa:golpe-vaga-agente} para de atender. A equipe maior nunca ouviu falar da {org:golpe-vaga-agente}, e no grupo do paddock outras três famílias contam a mesma história.',
            choices: {
              delegacia: {
                label: 'Juntar as famílias e registrar queixa na polícia',
                outcomes: [
                  'O boletim de ocorrência ganha quatro páginas e muitas assinaturas. O delegado promete prioridade, e você perde dois treinos entre depoimentos.',
                ],
              },
              advogado: {
                label: 'Contratar um advogado para ir atrás do dinheiro',
                outcomes: ['O escritório cobra um adiantamento e abre o processo no mesmo dia. As palavras “bloqueio de bens” trazem um pouco de esperança.'],
              },
              engolir: {
                label: 'Engolir o prejuízo e não contar a ninguém',
                outcomes: ['Você apaga as mensagens e finge que nada aconteceu. O assunto some do paddock, mas não da sua cabeça.'],
              },
            },
          },
        ],
      },
      {
        id: 'prisao',
        category: 'money',
        when: [],
        needs: ['person:golpe-vaga-agente'],
        choices: [
          {
            id: 'testemunhar',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'cash', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'desistir',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'provas',
            requires: [{ c: 'flag', flag: 'golpe-vaga-recibo' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Algemas na porta da agência',
            body: 'A polícia prende {pessoa:golpe-vaga-agente} com uma pilha de contratos falsos, e o seu está no meio. O promotor quer as vítimas na audiência, e o juiz pode mandar devolver parte do dinheiro.',
            choices: {
              testemunhar: {
                label: 'Testemunhar na audiência, olhando nos olhos de {primeiro:golpe-vaga-agente}',
                outcomes: [
                  'O juiz manda devolver uma parte do que você pagou. Não é tudo, mas o depósito chega com gosto de justiça.',
                  'A condenação sai, mas os bens já sumiram. O dinheiro não volta, e fica a certeza de ter feito a coisa certa.',
                ],
              },
              desistir: {
                label: 'Desistir do processo e virar a página',
                outcomes: ['Você assina a desistência e volta a pensar só em corrida. Algumas famílias não entendem a sua saída.'],
              },
              provas: {
                label: 'Entregar o recibo e as mensagens guardadas ao promotor',
                outcomes: ['O seu recibo vira a prova central do caso. O juiz manda devolver o seu dinheiro primeiro, e as audiências tomam a sua semana.'],
              },
            },
          },
        ],
      },
      {
        id: 'acordo-na-mesa',
        category: 'money',
        when: [],
        needs: ['person:golpe-vaga-agente'],
        choices: [
          {
            id: 'aceitar-acordo',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'julgamento',
            outcomes: [
              {
                odds: 'unlikely',
                effects: [
                  { e: 'cash', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'cash', size: -1, cap: true },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'gravacao',
            requires: [{ c: 'flag', flag: 'golpe-vaga-recibo' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma proposta de acordo por e-mail',
            body: 'A defesa de {pessoa:golpe-vaga-agente} oferece um acordo: devolve uma parte agora, desde que você retire a queixa. O seu advogado acha que no julgamento dá para recuperar mais, ou nada.',
            choices: {
              'aceitar-acordo': {
                label: 'Aceitar o acordo e encerrar o assunto',
                outcomes: [
                  'O dinheiro cai na conta em uma semana, menos do que você perdeu. {primeiro:golpe-vaga-agente} segue livre para procurar outra família.',
                ],
              },
              julgamento: {
                label: 'Recusar e levar o caso até o julgamento',
                outcomes: [
                  'O juiz manda devolver tudo, com correção. O seu advogado chama de vitória rara, e o paddock comenta a sua teimosia.',
                  'O julgamento se arrasta, e os honorários crescem. A sentença sai a seu favor, mas não sobra um centavo para pagar.',
                ],
              },
              gravacao: {
                label: 'Mostrar o recibo assinado e forçar um acordo melhor',
                outcomes: ['Diante do recibo, a defesa dobra a oferta. Você recupera o que pagou sem pisar num tribunal, mas o caso morre ali.'],
              },
            },
          },
        ],
      },
      {
        id: 'novo-alvo',
        category: 'money',
        when: [],
        needs: ['person:golpe-vaga-agente'],
        choices: [
          {
            id: 'avisar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                  { e: 'attitude', key: 'golpe-vaga-agente', size: -2 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'calar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: -2 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
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
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'penaltyPoints', size: 1 },
                  { e: 'attitude', key: 'golpe-vaga-agente', size: -3 },
                ],
                next: { step: 'licao', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O mesmo sorriso, outra família',
            body: 'No paddock, uma cena conhecida: {pessoa:golpe-vaga-agente}, com outro crachá e a mesma pasta de couro, conversa com os pais de um menino que mal alcança os pedais. O garoto olha a pasta como você olhou um dia.',
            choices: {
              avisar: {
                label: 'Chamar a família de lado e contar a sua história',
                outcomes: [
                  'A família agradece com lágrimas nos olhos e chama a segurança. Contar o próprio tombo em voz alta dói, mas tira um peso das costas.',
                ],
              },
              calar: {
                label: 'Fingir que não viu e seguir para o box',
                outcomes: ['Você entra no box sem olhar para trás. Na semana seguinte, outra família conta no grupo que caiu na mesma conversa.'],
              },
              partir: {
                label: 'Arrancar a pasta de couro e expor o golpe',
                outcomes: ['A cena corre as redes: a pasta voa, a família se salva, e a organização adverte você por confusão no paddock.'],
              },
            },
          },
        ],
      },
      {
        id: 'licao',
        category: 'career',
        when: [],
        needs: ['person:golpe-vaga-agente'],
        choices: [
          {
            id: 'palestrar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'recusar-palestra',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma palestra sobre vagas que não existem',
            body: 'A história de {pessoa:golpe-vaga-agente} correu entre pais e pilotos. Uma escola de pilotagem de {cidade} convida você para falar a famílias que sonham com as fórmulas e não sabem em quem confiar.',
            choices: {
              palestrar: {
                label: 'Aceitar e contar tudo, sem esconder o prejuízo',
                outcomes: ['O auditório fica em silêncio do começo ao fim. Na saída, três pais pedem o seu telefone para checar propostas antes de assinar.'],
              },
              'recusar-palestra': {
                label: 'Recusar: essa página já foi virada',
                outcomes: ['A escola chama outro piloto para falar. Você guarda a história para si, e ela pesa um pouco menos a cada corrida.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: 'lesao-no-punho',
    title: 'Lesão no punho',
    summary:
      'Depois de uma batida, o punho dói: esconder piora tudo, o diagnóstico leva à cirurgia ou à tala, a fisioterapia testa a paciência e a volta por cima lembra quem escondeu a dor.',
    start: 'dor-no-volante',
    steps: [
      {
        id: 'dor-no-volante',
        category: 'health',
        frequency: 'normal',
        when: [
          { c: 'race', tag: 'crash' },
          { c: 'lacks', what: 'injury' },
        ],
        choices: [
          {
            id: 'examinar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'form', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'diagnostico', delay: 'next' },
              },
            ],
          },
          {
            id: 'esconder',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'flag', flag: 'punho-escondido' },
                ],
                next: { step: 'piora', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O volante que bateu de volta',
            body: 'Na batida em {pista}, o volante girou sozinho e torceu o seu punho. Dois dias depois, ainda dói para virar a chave de casa, e a próxima etapa está logo ali.',
            choices: {
              examinar: {
                label: 'Fazer um exame antes da próxima etapa',
                outcomes: ['O exame toma a sua semana de treino, mas a equipe gosta de ver que você leva o corpo a sério. O resultado vem logo.'],
              },
              esconder: {
                label: 'Esconder a dor e alinhar assim mesmo',
                outcomes: ['Você aperta a faixa por baixo da luva e sorri para todo mundo no box. Ninguém percebe nada, por enquanto.'],
              },
            },
          },
        ],
      },
      {
        id: 'piora',
        category: 'track',
        when: [{ c: 'notRace', tag: 'absent' }],
        choices: [
          {
            id: 'admitir',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'injury', severity: 'minor', length: 'short', description: 'Punho inflamado por esconder a dor' },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'diagnostico', delay: 'next' },
              },
            ],
          },
          {
            id: 'aguentar',
            outcomes: [
              {
                odds: 'unlikely',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'diagnostico', delay: 'next' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'injury', severity: 'serious', length: 'short', description: 'Punho travado de tanto correr com dor' },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'diagnostico', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Cada freada, uma pontada',
            body: 'Você escondeu a dor e alinhou. Na metade da corrida em {pista}, cada freada mandava uma pontada até o cotovelo. Depois da bandeirada, o punho incha tanto que a luva não sai.',
            choices: {
              admitir: {
                label: 'Mostrar o punho inchado para a {equipe}',
                outcomes: ['O chefe reclama de não ter sabido antes e manda você direto para um especialista. A equipe passa a duvidar das suas respostas.'],
              },
              aguentar: {
                label: 'Tomar um anti-inflamatório e não dizer nada a ninguém',
                outcomes: [
                  'O remédio segura a dor por mais uma etapa, e ninguém desconfia. Mas o inchaço volta toda noite.',
                  'Dois dias depois, o punho trava de vez. Você não consegue fechar a mão nem para segurar o garfo.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'diagnostico',
        category: 'health',
        when: [],
        choices: [
          {
            id: 'operar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'punho-ortopedista',
                    from: 'stranger',
                    role: 'especialista em mão e punho',
                    org: 'Clínica Ortopédica Ponte Alta',
                    attitude: 1,
                  },
                  { e: 'injury', severity: 'serious', length: 'long', description: 'Cirurgia no escafoide do punho' },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'reabilitacao', delay: 'next' },
              },
            ],
          },
          {
            id: 'conservador',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  {
                    e: 'meet',
                    key: 'punho-ortopedista',
                    from: 'stranger',
                    role: 'especialista em mão e punho',
                    org: 'Clínica Ortopédica Ponte Alta',
                    attitude: 1,
                  },
                  { e: 'injury', severity: 'minor', length: 'long', description: 'Punho imobilizado numa tala' },
                ],
                next: { step: 'reabilitacao', delay: 'next' },
              },
              {
                odds: 'rest',
                effects: [
                  {
                    e: 'meet',
                    key: 'punho-ortopedista',
                    from: 'stranger',
                    role: 'especialista em mão e punho',
                    org: 'Clínica Ortopédica Ponte Alta',
                  },
                  { e: 'injury', severity: 'minor', length: 'long', description: 'Fissura no escafoide que teima em não colar' },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'reabilitacao', delay: 'next' },
              },
            ],
          },
          {
            id: 'corpo-de-ferro',
            requires: [{ c: 'trait', trait: 'ironBody' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'punho-ortopedista',
                    from: 'stranger',
                    role: 'especialista em mão e punho',
                    org: 'Clínica Ortopédica Ponte Alta',
                    attitude: 1,
                  },
                  { e: 'injury', severity: 'minor', length: 'short', description: 'Fissura no punho colada em tempo recorde' },
                ],
                next: { step: 'reabilitacao', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma fissura do tamanho de um fio',
            body: '{pessoa:punho-ortopedista}, da {org:punho-ortopedista}, aponta a imagem na tela: uma fissura no escafoide, o ossinho que segura o punho. Dá para operar e voltar mais firme, ou imobilizar e torcer para colar sozinho.',
            choices: {
              operar: {
                label: 'Marcar a cirurgia para esta semana',
                outcomes: ['A cirurgia corre bem: dois parafusos minúsculos e uma tala. Você fica algumas etapas fora, mas o punho volta inteiro.'],
              },
              conservador: {
                label: 'Imobilizar com tala e correr com cuidado',
                outcomes: [
                  'A tala incomoda, mas o osso cola no tempo certo. Você corre algumas etapas sem força total, sem perder nenhuma.',
                  'O osso demora a colar, e cada corrida com a tala é uma batalha. {primeiro:punho-ortopedista} avisa que a cirurgia continua na mesa.',
                ],
              },
              'corpo-de-ferro': {
                label: 'Dispensar a cirurgia: o seu corpo de ferro dá conta',
                outcomes: [
                  'O raio X da semana seguinte surpreende até {primeiro:punho-ortopedista}: a fissura quase sumiu. O seu corpo parece feito de outro material.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'reabilitacao',
        category: 'health',
        when: [],
        needs: ['person:punho-ortopedista'],
        speaker: 'punho-ortopedista',
        choices: [
          {
            id: 'protocolo',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'punho-ortopedista', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'volta-por-cima', delay: 'soon' },
              },
            ],
          },
          {
            id: 'acelerar',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'stat', stat: 'form', size: 1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'attitude', key: 'punho-ortopedista', size: -1 },
                ],
                next: { step: 'volta-por-cima', delay: 'soon' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'injury', severity: 'minor', length: 'short', description: 'Recaída no punho por voltar antes da hora' },
                  { e: 'attitude', key: 'punho-ortopedista', size: -1 },
                ],
                next: { step: 'volta-por-cima', delay: 'soon' },
              },
            ],
          },
          {
            id: 'fragil',
            requires: [{ c: 'trait', trait: 'fragile' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'form', size: -2 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'attitude', key: 'punho-ortopedista', size: 2 },
                ],
                next: { step: 'volta-por-cima', delay: 'later' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Elástico, massinha e paciência',
            body: 'A fisioterapia com {pessoa:punho-ortopedista} é um teste de paciência: apertar massinha, puxar elástico, girar o punho devagar. A {equipe} quer você de volta logo, e a vontade de pular etapas é grande.',
            choices: {
              protocolo: {
                label: 'Seguir o protocolo à risca, sem pular nada',
                outcomes: [
                  '{primeiro:punho-ortopedista} confere cada movimento e libera você no dia marcado. A volta demora, mas o punho chega sem dor, e a cabeça também.',
                ],
              },
              acelerar: {
                label: 'Pedir alta antecipada para não perder mais corridas',
                outcomes: [
                  'A alta antecipada dá certo, e você volta com fome de corrida. {primeiro:punho-ortopedista} só pede que você não conte para ninguém.',
                  'No primeiro treino, a dor volta com tudo. {primeiro:punho-ortopedista} manda você de volta para a tala, sem discussão.',
                ],
              },
              fragil: {
                label: 'Pedir um protocolo mais longo: o corpo frágil já ensinou',
                outcomes: ['Você conhece o caminho das lesões e não tem pressa. A volta demora mais, mas o punho fica mais forte do que antes.'],
              },
            },
          },
        ],
      },
      {
        id: 'volta-por-cima',
        category: 'track',
        when: [{ c: 'lacks', what: 'injury' }],
        needs: ['person:punho-ortopedista'],
        speaker: 'punho-ortopedista',
        choices: [
          {
            id: 'voltar-com-tudo',
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 2 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: 'end',
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'stat', stat: 'confidence', size: -1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'agradecer',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'attitude', key: 'punho-ortopedista', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'confessar',
            requires: [{ c: 'flag', flag: 'punho-escondido' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'teamTrust', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A mão fecha firme de novo',
            body: 'O punho fecha firme no volante pela primeira vez em semanas. Antes da próxima etapa, chega uma mensagem de {pessoa:punho-ortopedista}: “Alta assinada. Agora é com você, só não bata de novo.”',
            choices: {
              'voltar-com-tudo': {
                label: 'Voltar com tudo e responder na pista',
                outcomes: [
                  'Você volta mais rápido do que saiu. A equipe comenta que a lesão deixou a sua pilotagem mais limpa.',
                  'A cabeça ainda freia antes do punho. Você termina a etapa sem brilho e entende que a volta também é mental.',
                ],
              },
              agradecer: {
                label: 'Agradecer a {primeiro:punho-ortopedista} em público antes de correr',
                outcomes: ['O agradecimento corre o paddock, e a clínica ganha fila de pilotos. A semana de entrevistas cansa, mas o coração vai leve.'],
              },
              confessar: {
                label: 'Admitir em público que errou ao esconder a dor',
                outcomes: ['A confissão vira exemplo nas escolinhas de kart. A {equipe} volta a confiar nas suas respostas, mesmo que o orgulho doa.'],
              },
            },
          },
        ],
      },
    ],
  },
];
