/**
 * Cadeias de eventos com memória (Fase 5), parte C. Formato em `src/domain/storyEvents.ts` (veja a parte A).
 *
 * As pessoas guardadas aqui (a amizade do bairro, quem trabalha na direção de prova, a chefia da
 * equipe no caso da peça e a coordenação da escola) podem ser homens ou mulheres: nenhum texto usa
 * pronome ou adjetivo com gênero para elas, nem para o piloto do jogador. As marcas e as pessoas
 * levam o prefixo do tema (`amigo-infancia-`, `comissario-olho-`, `peca-medida-`, `vestibular-`) e
 * só são lidas dentro da própria cadeia. A primeira escolha de cada passo é a que segue a história.
 */
import type { StoryChainSpec } from '@/domain/storyEvents';

export const CHAINS_C: readonly StoryChainSpec[] = [
  {
    // O empréstimo decide o caminho: quem empresta tem boa chance de receber de volta (e chega à
    // inauguração da oficina); quem nega, ou dá azar, vê a amizade sumir e reaparecer anos depois.
    // As marcas `amigo-infancia-emprestou` e `amigo-infancia-negou` abrem a escolha extra do sumiço
    // e da volta; a atitude "fiel" abre a escolha extra da inauguração.
    id: 'amigo-de-infancia',
    title: 'Amizade de infância, dívida de adulto',
    summary:
      'A amizade da rua em que você cresceu reaparece no kartódromo, pede dinheiro emprestado quando você chega às fórmulas e, conforme a sua resposta, retribui ou some, e a história fecha pelo que ficou entre vocês.',
    start: 'arquibancada-do-kart',
    steps: [
      {
        id: 'arquibancada-do-kart',
        category: 'personal',
        frequency: 'normal',
        when: [{ c: 'tier', max: 3 }],
        choices: [
          {
            id: 'levar-ao-box',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'amigo-infancia', from: 'stranger', org: 'turma do bairro', role: 'amizade de infância', attitude: 2 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'pedido-de-emprestimo', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'aceno-de-longe',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'amigo-infancia', from: 'stranger', org: 'turma do bairro', role: 'amizade de infância', attitude: -1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'pedido-de-emprestimo', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma voz conhecida na grade do kartódromo',
            body: 'Entre os pais na grade, alguém grita o seu apelido de infância. É {pessoa:amigo-infancia}, da turma do bairro em {cidade}, que pegou dois ônibus só para ver você correr.',
            choices: {
              'levar-ao-box': {
                label: 'Levar {primeiro:amigo-infancia} para conhecer o box',
                outcomes: [
                  'Vocês passam a tarde entre pneus e ferramentas, rindo das histórias da rua. A cabeça sai um pouco da corrida, mas o coração volta cheio.',
                ],
              },
              'aceno-de-longe': {
                label: 'Acenar de longe e manter a concentração',
                outcomes: ['A corrida sai focada. Na saída, {primeiro:amigo-infancia} já tinha ido embora, sem se despedir.'],
              },
            },
          },
        ],
      },
      {
        id: 'pedido-de-emprestimo',
        category: 'money',
        when: [{ c: 'tier', min: 4 }],
        needs: ['person:amigo-infancia'],
        speaker: 'amigo-infancia',
        choices: [
          {
            id: 'emprestar',
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'cash', size: -2, cap: true },
                  { e: 'attitude', key: 'amigo-infancia', size: 2 },
                  { e: 'flag', flag: 'amigo-infancia-emprestou' },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'acerto-de-contas', delay: 'later' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'cash', size: -2, cap: true },
                  { e: 'attitude', key: 'amigo-infancia', size: 1 },
                  { e: 'flag', flag: 'amigo-infancia-emprestou' },
                ],
                next: { step: 'sumico', delay: 'later' },
              },
            ],
          },
          {
            id: 'negar',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: -2 },
                  { e: 'flag', flag: 'amigo-infancia-negou' },
                  { e: 'stat', stat: 'form', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'sumico', delay: 'later' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um pedido difícil de {primeiro:amigo-infancia}',
            body: 'Chega uma mensagem longa de {pessoa:amigo-infancia}: o emprego acabou, o aluguel venceu e a turma do bairro já ajudou o que podia. O pedido vem no fim, com vergonha: um empréstimo, para devolver até o fim da temporada.',
            choices: {
              emprestar: {
                label: 'Fazer a transferência sem pensar duas vezes',
                outcomes: [
                  'Chega um áudio com a voz embargada e uma promessa: cada centavo vai voltar, com juros de amizade.',
                  'O dinheiro sai na hora. A resposta de {primeiro:amigo-infancia} é um “valeu” curto, e as suas mensagens seguintes nem chegam a ser lidas.',
                ],
              },
              negar: {
                label: 'Explicar que o seu caixa também está no limite',
                outcomes: [
                  'Do outro lado, só um “entendi”. A conversa termina ali, e a foto de vocês no kartódromo some do perfil de {primeiro:amigo-infancia}.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'acerto-de-contas',
        category: 'money',
        when: [],
        needs: ['person:amigo-infancia'],
        speaker: 'amigo-infancia',
        choices: [
          {
            id: 'aceitar-devolucao',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: 2 },
                  { e: 'attitude', key: 'amigo-infancia', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'inauguracao-da-oficina', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'perdoar-divida',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 2 },
                  { e: 'stat', stat: 'morale', size: 1 },
                ],
                next: { step: 'inauguracao-da-oficina', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Um envelope com o seu nome',
            body: '{pessoa:amigo-infancia} arrumou trabalho numa oficina de {cidade} e manda avisar: no próximo fim de semana de corrida, vai aparecer no autódromo para devolver o empréstimo, nota por nota, num envelope com o seu nome.',
            choices: {
              'aceitar-devolucao': {
                label: 'Receber o envelope e agradecer a palavra cumprida',
                outcomes: [
                  'O envelope vem com um bilhete dobrado: “Amizade de rua não se esquece.” {primeiro:amigo-infancia} passa o fim de semana no box, e a concentração sofre um pouco.',
                ],
              },
              'perdoar-divida': {
                label: 'Dizer que a dívida virou presente de amizade',
                outcomes: [
                  'Depois de muita insistência dos dois lados, o envelope volta para o bolso de onde saiu. Na oficina, a sua foto ganha moldura nova.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'sumico',
        category: 'personal',
        when: [],
        needs: ['person:amigo-infancia'],
        choices: [
          {
            id: 'procurar-no-bairro',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'volta-do-sumico', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'deixar-para-la',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'volta-do-sumico', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'cobrar-da-familia',
            requires: [{ c: 'flag', flag: 'amigo-infancia-emprestou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: 1 },
                  { e: 'attitude', key: 'amigo-infancia', size: -3 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'volta-do-sumico', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Ninguém na turma sabe de {primeiro:amigo-infancia}',
            body: 'Faz meses que {pessoa:amigo-infancia} não dá sinal de vida. O número não chama, a casa da família em {cidade} está de portão fechado, e na turma do bairro cada um conta uma versão diferente.',
            choices: {
              'procurar-no-bairro': {
                label: 'Passar um dia em {cidade} perguntando de porta em porta',
                outcomes: [
                  'Uma vizinha conta que {primeiro:amigo-infancia} foi tentar a vida em outro estado. Você deixa um bilhete com ela e volta para o treino com um dia a menos.',
                ],
              },
              'deixar-para-la': {
                label: 'Aceitar que cada um segue o seu caminho',
                outcomes: [
                  'Você apaga a conversa antiga e volta a pensar só em corrida. Na pista, funciona; fora dela, a rua de {cidade} ainda volta à memória.',
                ],
              },
              'cobrar-da-familia': {
                label: 'Cobrar o empréstimo da família de {primeiro:amigo-infancia}',
                outcomes: ['A família paga uma parte, sem olhar nos seus olhos. Em {cidade}, a história da cobrança corre mais rápido que o dinheiro.'],
              },
            },
          },
        ],
      },
      {
        id: 'inauguracao-da-oficina',
        category: 'personal',
        when: [],
        needs: ['person:amigo-infancia'],
        speaker: 'amigo-infancia',
        choices: [
          {
            id: 'ir-a-inauguracao',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 1 },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'mandar-video',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: -1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'nome-na-fachada',
            requires: [{ c: 'attitude', key: 'amigo-infancia', level: 'loyal' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'sponsorMood', who: 'all', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A oficina abriu as portas em {cidade}',
            body: '{pessoa:amigo-infancia} juntou as economias e abriu uma oficina própria em {cidade}. A inauguração é no domingo, com churrasco na calçada, e o convite veio escrito à mão: “Sem você, não teria nem a primeira chave.”',
            choices: {
              'ir-a-inauguracao': {
                label: 'Ir à inauguração e cortar a fita com a turma',
                outcomes: ['A rua inteira aparece, e a fita é cortada com uma chave de roda. A semana de treino fica mais curta, mas valeu cada minuto.'],
              },
              'mandar-video': {
                label: 'Mandar um vídeo de parabéns e ficar no simulador',
                outcomes: ['O vídeo passa de celular em celular na calçada. {primeiro:amigo-infancia} agradece, mas a cadeira guardada para você fica vazia.'],
              },
              'nome-na-fachada': {
                label: 'Deixar a oficina usar o seu nome na fachada',
                outcomes: [
                  'A placa nova vira ponto de foto em {cidade}. Os patrocinadores torcem o nariz para a propaganda de graça, mas a turma do bairro não fala de outra coisa.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'volta-do-sumico',
        category: 'personal',
        when: [],
        needs: ['person:amigo-infancia'],
        speaker: 'amigo-infancia',
        choices: [
          {
            id: 'ouvir-ate-o-fim',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 2 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'seguir-para-o-carro',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: -2 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'pedir-desculpas-tambem',
            requires: [{ c: 'flag', flag: 'amigo-infancia-negou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'amigo-infancia', size: 3 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Quem sumiu voltou sem avisar',
            body: 'Depois de tanto tempo sem notícia, {pessoa:amigo-infancia} aparece na saída do autódromo, de boné baixo, querendo conversar. Diz que sumiu por vergonha e que a vida, agora, começa a entrar nos eixos.',
            choices: {
              'ouvir-ate-o-fim': {
                label: 'Sentar no meio-fio e ouvir a história inteira',
                outcomes: ['A conversa vai até escurecer no estacionamento. Não resolve tudo, mas a amizade de rua volta a respirar.'],
              },
              'seguir-para-o-carro': {
                label: 'Dizer que está sem tempo e seguir para o carro',
                outcomes: [
                  'Você passa reto, com a desculpa do horário. Pelo retrovisor, dá para ver {primeiro:amigo-infancia} no mesmo lugar, de mãos no bolso.',
                ],
              },
              'pedir-desculpas-tambem': {
                label: 'Pedir desculpas por ter negado ajuda naquela hora',
                outcomes: ['As desculpas saem ao mesmo tempo, dos dois lados, e viram risada. Fica combinado um churrasco em {cidade} nas próximas férias.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    // A punição por um toque no kart vira memória: a mesma pessoa da direção de prova volta no
    // painel das fórmulas. Desculpas levam direto ao fechamento; recurso ou acusação (só o
    // esquentado) passam pelo tribunal. O protesto do kart (`comissario-olho-protesto`) abre uma
    // saída no tribunal, e a acusação de perseguição (`comissario-olho-acusou`), uma no fechamento.
    id: 'comissario-de-olho',
    title: 'Um rosto conhecido na sala dos comissários',
    summary:
      'Quem puniu você por um toque no kart reaparece no painel de comissários das fórmulas; desculpas, recurso ou explosão decidem como essa história termina.',
    start: 'punicao-no-kart',
    steps: [
      {
        id: 'punicao-no-kart',
        category: 'track',
        frequency: 'normal',
        when: [
          { c: 'tier', max: 3 },
          { c: 'race', tag: 'contactCulprit' },
        ],
        needs: ['other'],
        choices: [
          {
            id: 'acatar-punicao',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'comissario-olho', from: 'stranger', org: 'direção de prova', role: 'integrante da direção de prova', attitude: 1 },
                  { e: 'grid', who: 'player', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'mesma-sala', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'protestar-na-torre',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'comissario-olho', from: 'stranger', org: 'direção de prova', role: 'integrante da direção de prova', attitude: -2 },
                  { e: 'flag', flag: 'comissario-olho-protesto' },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'mesma-sala', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'historico-limpo',
            requires: [{ c: 'trait', trait: 'cleanRacer' }],
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'meet', key: 'comissario-olho', from: 'stranger', org: 'direção de prova', role: 'integrante da direção de prova', attitude: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'mesma-sala', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'meet', key: 'comissario-olho', from: 'stranger', org: 'direção de prova', role: 'integrante da direção de prova', attitude: 1 },
                  { e: 'grid', who: 'player', size: 1 },
                ],
                next: { step: 'mesma-sala', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Punição na torre do kartódromo',
            body: 'Depois do toque em {outro}, a direção de prova chama você à torre. Atrás da mesa, {pessoa:comissario-olho} assiste ao vídeo três vezes e anuncia a punição sem tirar os olhos do papel.',
            choices: {
              'acatar-punicao': {
                label: 'Aceitar a punição e pedir desculpas a {outro}',
                outcomes: [
                  'Você perde posições no próximo grid, mas sai da torre de cabeça erguida. {primeiro:comissario-olho} anota alguma coisa numa prancheta.',
                ],
              },
              'protestar-na-torre': {
                label: 'Protestar: {outro} freou cedo demais de propósito',
                outcomes: [
                  'A discussão sobe de tom até os pais de outros pilotos espiarem pela janela. {primeiro:comissario-olho} encerra a conversa e guarda o seu número na memória.',
                ],
              },
              'historico-limpo': {
                label: 'Mostrar a ficha limpa e pedir para rever as imagens',
                outcomes: [
                  'Vocês repassam o lance quadro a quadro até tarde. {primeiro:comissario-olho} troca a punição por uma advertência e elogia a sua postura.',
                  'A ficha limpa ajuda, mas não apaga o toque. A punição fica, um pouco mais leve, e {primeiro:comissario-olho} agradece a educação.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'mesma-sala',
        category: 'track',
        when: [
          { c: 'tier', min: 4 },
          { c: 'race', tag: 'contact' },
        ],
        needs: ['person:comissario-olho', 'other'],
        speaker: 'comissario-olho',
        choices: [
          {
            id: 'pedir-desculpas-na-sala',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'grid', who: 'player', size: 1 },
                  { e: 'attitude', key: 'comissario-olho', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'despedida-da-torre', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'entrar-com-recurso',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: { step: 'tribunal-da-categoria', delay: 'next' },
              },
            ],
          },
          {
            id: 'acusar-perseguicao',
            requires: [{ c: 'trait', trait: 'hothead' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: -3 },
                  { e: 'flag', flag: 'comissario-olho-acusou' },
                  { e: 'penaltyPoints', size: 1 },
                  { e: 'stat', stat: 'confidence', size: 2 },
                ],
                next: { step: 'tribunal-da-categoria', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O mesmo olhar, agora {categoria:em}',
            body: 'O toque com {outro} leva você à sala dos comissários. No meio do painel, um rosto do kartódromo: {pessoa:comissario-olho}, que agora trabalha {categoria:em}. A punição já está impressa, só esperando a sua assinatura.',
            choices: {
              'pedir-desculpas-na-sala': {
                label: 'Assinar e pedir desculpas pelo lance com {outro}',
                outcomes: [
                  'A punição fica, mas {primeiro:comissario-olho} comenta com o painel que você amadureceu desde o kart. O elogio corre o paddock antes do jantar.',
                ],
              },
              'entrar-com-recurso': {
                label: 'Recusar a assinatura e entrar com recurso',
                outcomes: ['O caso vai para o tribunal da categoria. {primeiro:comissario-olho} só recolhe o papel e avisa: “Nos vemos lá.”'],
              },
              'acusar-perseguicao': {
                label: 'Bater na mesa e acusar {primeiro:comissario-olho} de perseguição',
                outcomes: [
                  'A acusação vira manchete, e a direção de prova abre um processo disciplinar. Você sai da sala com o sangue fervendo e a licença mais carregada.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'tribunal-da-categoria',
        category: 'track',
        when: [],
        needs: ['person:comissario-olho'],
        speaker: 'comissario-olho',
        choices: [
          {
            id: 'apresentar-imagens',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 2 },
                ],
                next: { step: 'despedida-da-torre', delay: 'nextSeason' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: -1 },
                  { e: 'grid', who: 'player', size: 2 },
                  { e: 'penaltyPoints', size: 1 },
                ],
                next: { step: 'despedida-da-torre', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'retirar-o-recurso',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: 1 },
                  { e: 'grid', who: 'player', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: { step: 'despedida-da-torre', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'admitir-protesto-antigo',
            requires: [{ c: 'flag', flag: 'comissario-olho-protesto' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: 2 },
                  { e: 'grid', who: 'player', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'despedida-da-torre', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Audiência no tribunal da categoria',
            body: 'Sala fria, três juízes e uma tela com o seu lance em câmera lenta. {pessoa:comissario-olho} depõe com calma e lembra, para quem quiser ouvir, que acompanha você desde o kart.',
            choices: {
              'apresentar-imagens': {
                label: 'Apresentar a câmera de bordo e a telemetria',
                outcomes: [
                  'As imagens mostram a porta fechando tarde. O tribunal anula a punição, e {primeiro:comissario-olho} deixa a sala sem cumprimentar ninguém.',
                  'Os juízes enxergam nas imagens o contrário do que você queria mostrar. A punição aumenta, e a licença também sente.',
                ],
              },
              'retirar-o-recurso': {
                label: 'Retirar o recurso antes do fim do depoimento',
                outcomes: ['Você cumpre a punição original. {primeiro:comissario-olho} acena da porta, e o tribunal registra o gesto de bom senso.'],
              },
              'admitir-protesto-antigo': {
                label: 'Admitir que passou do ponto naquele protesto no kartódromo',
                outcomes: ['O depoimento muda de tom. {primeiro:comissario-olho} reconhece que também errou naquele dia, e a punição fica no mínimo possível.'],
              },
            },
          },
        ],
      },
      {
        id: 'despedida-da-torre',
        category: 'career',
        when: [],
        needs: ['person:comissario-olho'],
        speaker: 'comissario-olho',
        choices: [
          {
            id: 'ir-a-despedida',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'ignorar-o-convite',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'retirar-acusacao',
            requires: [{ c: 'flag', flag: 'comissario-olho-acusou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'comissario-olho', size: 2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -2 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Última temporada na direção de prova',
            body: '{pessoa:comissario-olho} anuncia a aposentadoria depois de décadas na direção de prova. Na festa de despedida, entre bandeiras e fotos antigas, um painel mostra a sua punição no kart. O convite chegou com o seu nome.',
            choices: {
              'ir-a-despedida': {
                label: 'Ir à festa e posar ao lado do painel',
                outcomes: [
                  'A foto do kart arranca gargalhadas, e {primeiro:comissario-olho} conta a história para o salão inteiro. Um dia de treino a menos, uma lembrança a mais.',
                ],
              },
              'ignorar-o-convite': {
                label: 'Deixar o convite da festa sem resposta',
                outcomes: ['A festa acontece sem você. No paddock, há quem leia a ausência como mágoa antiga, e há quem leia como foco.'],
              },
              'retirar-acusacao': {
                label: 'Pedir desculpas em público pela acusação de perseguição',
                outcomes: ['O discurso é curto e sincero. {primeiro:comissario-olho} aperta a sua mão diante das câmeras, e o assunto enfim morre.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    // A atitude diante do boato fica marcada (`peca-medida-cobrou`, `-calou`, `-denunciou`) e cada
    // marca abre uma escolha num passo seguinte. A vistoria sorteia o caminho: peça aprovada leva ao
    // desmentido; peça fora da medida, à punição da equipe. Do segundo passo em diante, a chefia
    // precisa estar na equipe atual do piloto (`personAtTeam`): se ele trocou de equipe, a cadeia
    // adormece em vez de falar de um carro que não é mais o dele.
    id: 'peca-fora-da-medida',
    title: 'A peça que ninguém queria medir',
    summary:
      'Um boato de peça irregular no carro da sua equipe obriga você a cobrar a chefia, ficar calado ou denunciar; a vistoria decide o resto, e a chefia lembra de que lado você ficou.',
    start: 'boato-da-peca',
    steps: [
      {
        id: 'boato-da-peca',
        category: 'track',
        frequency: 'normal',
        when: [{ c: 'tier', min: 4 }],
        choices: [
          {
            id: 'cobrar-a-chefia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'peca-medida-chefe', from: 'teamBoss', role: 'chefe de equipe no caso da peça', attitude: -1 },
                  { e: 'flag', flag: 'peca-medida-cobrou' },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'vistoria-da-peca', delay: 'soon' },
              },
            ],
          },
          {
            id: 'nao-tocar-no-assunto',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'peca-medida-chefe', from: 'teamBoss', role: 'chefe de equipe no caso da peça', attitude: 1 },
                  { e: 'flag', flag: 'peca-medida-calou' },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'vistoria-da-peca', delay: 'soon' },
              },
            ],
          },
          {
            id: 'denunciar-aos-fiscais',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'meet', key: 'peca-medida-chefe', from: 'teamBoss', role: 'chefe de equipe no caso da peça' },
                  { e: 'flag', flag: 'peca-medida-denunciou' },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'confidence', size: -1 },
                ],
                next: { step: 'vistoria-da-peca', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Boato de peça irregular no seu carro',
            body: 'No café do paddock, um mecânico de outra equipe jura que o assoalho do carro da {equipe} está fora da medida. A peça mudou de desenho na última etapa, sem explicação de {pessoa:peca-medida-chefe}, que comanda o time.',
            choices: {
              'cobrar-a-chefia': {
                label: 'Cobrar uma explicação de {primeiro:peca-medida-chefe}, olho no olho',
                outcomes: [
                  '{primeiro:peca-medida-chefe} garante que está tudo dentro da regra, mas não gosta da pergunta. No box, a notícia de que você cobrou a chefia corre rápido.',
                ],
              },
              'nao-tocar-no-assunto': {
                label: 'Fingir que não ouviu nada e cuidar do seu trabalho',
                outcomes: ['A equipe agradece a discrição com sorrisos no box. Por dentro, a dúvida vai junto em cada volta.'],
              },
              'denunciar-aos-fiscais': {
                label: 'Mandar uma denúncia anônima aos fiscais técnicos',
                outcomes: ['O e-mail sai de uma conta criada na hora. A consciência fica mais leve; o medo de alguém descobrir, nem tanto.'],
              },
            },
          },
        ],
      },
      {
        id: 'vistoria-da-peca',
        category: 'track',
        when: [{ c: 'personAtTeam', key: 'peca-medida-chefe' }],
        needs: ['person:peca-medida-chefe', 'roundPoints'],
        speaker: 'peca-medida-chefe',
        choices: [
          {
            id: 'acompanhar-a-medicao',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'boato-desmentido', delay: 'next' },
              },
              {
                odds: 'rest',
                effects: [{ e: 'losePoints' }, { e: 'car', size: -1 }, { e: 'stat', stat: 'reputation', size: -1 }],
                next: { step: 'equipe-punida', delay: 'next' },
              },
            ],
          },
          {
            id: 'esperar-no-motorhome',
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'attitude', key: 'peca-medida-chefe', size: 1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'boato-desmentido', delay: 'next' },
              },
              {
                odds: 'rest',
                effects: [{ e: 'losePoints' }, { e: 'car', size: -1 }, { e: 'stat', stat: 'teamTrust', size: -1 }],
                next: { step: 'equipe-punida', delay: 'next' },
              },
            ],
          },
          {
            id: 'conferir-o-regulamento',
            requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                ],
                next: { step: 'boato-desmentido', delay: 'next' },
              },
              {
                odds: 'rest',
                effects: [{ e: 'losePoints' }, { e: 'car', size: -1 }],
                next: { step: 'equipe-punida', delay: 'next' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Fiscais levam a peça para medir',
            body: 'Na chegada aos boxes em {pista}, os fiscais técnicos desmontam justamente o assoalho do boato. {pessoa:peca-medida-chefe} cruza os braços na porta do box. Os seus {pontos} de hoje dependem de uma régua e de um laudo.',
            choices: {
              'acompanhar-a-medicao': {
                label: 'Acompanhar a medição ao lado dos fiscais',
                outcomes: [
                  'A peça passa raspando na tolerância. Os fiscais assinam o laudo, e você deixa o box com a cabeça leve.',
                  'A régua não mente: a peça está fora da medida. Os pontos da etapa vão embora, e o carro volta à versão antiga.',
                ],
              },
              'esperar-no-motorhome': {
                label: 'Deixar a equipe cuidar disso e esperar no motorhome',
                outcomes: [
                  'Uma hora depois, {primeiro:peca-medida-chefe} bate na porta com o laudo liberado e um agradecimento pela confiança.',
                  'Pela janela do motorhome, a peça passa embalada como prova. A notícia da desclassificação chega antes de qualquer explicação.',
                ],
              },
              'conferir-o-regulamento': {
                label: 'Conferir o regulamento técnico linha por linha com os fiscais',
                outcomes: [
                  'Você acha a tolerância numa nota de rodapé que nem os fiscais lembravam. Laudo liberado, e o paddock comenta a aula de regulamento.',
                  'Linha por linha, você chega à mesma conclusão dos fiscais: não há brecha. Pelo menos ninguém pode dizer que faltou tentar.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'boato-desmentido',
        category: 'career',
        when: [{ c: 'personAtTeam', key: 'peca-medida-chefe' }],
        needs: ['person:peca-medida-chefe', 'otherTeam'],
        speaker: 'peca-medida-chefe',
        choices: [
          {
            id: 'laudo-fala-por-si',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'peca-medida-chefe', size: -1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
          {
            id: 'atacar-a-outra-equipe',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'peca-medida-chefe', size: 2 },
                  { e: 'interest', team: 'other', size: -2 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
          {
            id: 'confessar-a-denuncia',
            requires: [{ c: 'flag', flag: 'peca-medida-denunciou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'peca-medida-chefe', size: -3 },
                  { e: 'stat', stat: 'teamTrust', size: -2 },
                  { e: 'stat', stat: 'reputation', size: 2 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Laudo limpo, paddock desconfiado',
            body: 'Com o laudo na mão, {pessoa:peca-medida-chefe} quer saber quem espalhou o boato. As suspeitas apontam para a {outraEquipe}, e os jornalistas esperam a sua opinião na saída do box.',
            choices: {
              'laudo-fala-por-si': {
                label: 'Dizer aos jornalistas que o laudo fala por si',
                outcomes: [
                  'A resposta elegante agrada o paddock. {primeiro:peca-medida-chefe} esperava uma defesa mais firme e deixa isso claro na reunião seguinte.',
                ],
              },
              'atacar-a-outra-equipe': {
                label: 'Acusar a {outraEquipe} de jogo sujo nos microfones',
                outcomes: [
                  'A frase vira manchete. {primeiro:peca-medida-chefe} adora a defesa; na {outraEquipe}, o seu nome sai de qualquer lista para o futuro.',
                ],
              },
              'confessar-a-denuncia': {
                label: 'Contar a {primeiro:peca-medida-chefe} que a denúncia anônima foi sua',
                outcomes: [
                  'O silêncio na sala parece não ter fim. {primeiro:peca-medida-chefe} agradece a franqueza com a voz seca, e o box passa a cochichar quando você chega.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'equipe-punida',
        category: 'track',
        when: [{ c: 'personAtTeam', key: 'peca-medida-chefe' }],
        needs: ['person:peca-medida-chefe'],
        speaker: 'peca-medida-chefe',
        choices: [
          {
            id: 'defender-a-equipe',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'grid', who: 'player', size: 2 },
                  { e: 'attitude', key: 'peca-medida-chefe', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 2 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
          {
            id: 'criticar-a-chefia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'grid', who: 'player', size: 2 },
                  { e: 'attitude', key: 'peca-medida-chefe', size: -2 },
                  { e: 'stat', stat: 'teamTrust', size: -2 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
          {
            id: 'admitir-que-sabia',
            requires: [{ c: 'flag', flag: 'peca-medida-calou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'grid', who: 'player', size: 2 },
                  { e: 'attitude', key: 'peca-medida-chefe', size: -1 },
                  { e: 'stat', stat: 'reputation', size: -2 },
                  { e: 'stat', stat: 'morale', size: 2 },
                ],
                next: { step: 'conversa-no-motorhome', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Punição para a equipe inteira',
            body: 'A direção de prova confirma: além dos pontos perdidos, você vai largar mais atrás na próxima etapa. {pessoa:peca-medida-chefe} reúne o time e pede que você defenda a {equipe} na entrevista coletiva.',
            choices: {
              'defender-a-equipe': {
                label: 'Defender a {equipe} diante dos microfones',
                outcomes: ['Você fala em erro de interpretação e em trabalho honesto. A equipe fecha com você; parte da imprensa torce o nariz.'],
              },
              'criticar-a-chefia': {
                label: 'Dizer que a decisão da peça não passou por você',
                outcomes: [
                  'A frase protege o seu nome lá fora e incendeia o box por dentro. {primeiro:peca-medida-chefe} assiste à coletiva de braços cruzados.',
                ],
              },
              'admitir-que-sabia': {
                label: 'Admitir na coletiva que ouviu o boato e se calou',
                outcomes: ['A sinceridade pesa na reputação, mas tira um peso das costas. {primeiro:peca-medida-chefe} não esperava ouvir aquilo em público.'],
              },
            },
          },
        ],
      },
      {
        id: 'conversa-no-motorhome',
        category: 'career',
        when: [{ c: 'personAtTeam', key: 'peca-medida-chefe' }],
        needs: ['person:peca-medida-chefe'],
        speaker: 'peca-medida-chefe',
        choices: [
          {
            id: 'renovar-a-confianca',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'interest', team: 'person', key: 'peca-medida-chefe', size: 2 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'reputation', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'ouvir-o-mercado',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'interest', team: 'person', key: 'peca-medida-chefe', size: -2 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                  { e: 'stat', stat: 'confidence', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'exigir-transparencia',
            requires: [{ c: 'flag', flag: 'peca-medida-cobrou' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'car', size: 1 },
                  { e: 'attitude', key: 'peca-medida-chefe', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma conversa franca no motorhome',
            body: 'Passada a poeira, {pessoa:peca-medida-chefe} chama você para uma conversa a portas fechadas. Diz que o caso da peça mostrou quem é quem dentro da {org:peca-medida-chefe} e quer saber se pode contar com você no ano que vem.',
            choices: {
              'renovar-a-confianca': {
                label: 'Apertar a mão e prometer mais um ano de parceria',
                outcomes: ['O aperto de mão vale contrato. Lá fora, há quem ainda ligue o seu nome à peça; aqui dentro, você virou peça-chave.'],
              },
              'ouvir-o-mercado': {
                label: 'Dizer que vai ouvir outras propostas antes de decidir',
                outcomes: ['{primeiro:peca-medida-chefe} respeita a resposta, mas o clima esfria. No box, os mecânicos já falam de você no passado.'],
              },
              'exigir-transparencia': {
                label: 'Topar, desde que você acompanhe cada peça nova do carro',
                outcomes: ['A chefia aceita a condição. Daqui em diante, nenhuma peça entra no carro sem passar pelos seus olhos, e o rendimento agradece.'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    // A escolha da escola deixa marcas que mudam os passos seguintes: o curso mais disputado (só com
    // inteligência alta) abre a maratona de estudo no autódromo; a aprovação abre a matrícula
    // trancada; e estudar à noite (`vestibular-faculdade`) muda o último passo, anos depois, com a
    // conversa de engenharia com a equipe. Quem larga os estudos pula a prova e vai direto à mesa do
    // jantar.
    id: 'vestibular',
    title: 'O ano do vestibular',
    summary:
      'A escola cobra o vestibular, a prova cai no fim de semana de uma etapa decisiva, e a escolha entre estudo e pista deixa uma marca que volta anos depois, na conversa com a equipe.',
    start: 'escola-cobra-o-vestibular',
    steps: [
      {
        id: 'escola-cobra-o-vestibular',
        category: 'personal',
        frequency: 'normal',
        when: [
          { c: 'age', to: 'teen' },
          { c: 'careerSeason', min: 2 },
        ],
        choices: [
          {
            id: 'escolher-engenharia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'vestibular-coordenacao',
                    from: 'stranger',
                    org: 'Escola Estadual Jardim Aurora',
                    role: 'coordenação pedagógica da escola',
                    attitude: 1,
                  },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'prova-e-corrida', delay: 'soon' },
              },
            ],
          },
          {
            id: 'largar-os-estudos',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'vestibular-coordenacao',
                    from: 'stranger',
                    org: 'Escola Estadual Jardim Aurora',
                    role: 'coordenação pedagógica da escola',
                    attitude: -2,
                  },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
            ],
          },
          {
            id: 'curso-mais-disputado',
            requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  {
                    e: 'meet',
                    key: 'vestibular-coordenacao',
                    from: 'stranger',
                    org: 'Escola Estadual Jardim Aurora',
                    role: 'coordenação pedagógica da escola',
                    attitude: 2,
                  },
                  { e: 'flag', flag: 'vestibular-curso-disputado' },
                  { e: 'stat', stat: 'confidence', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'prova-e-corrida', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'A escola quer saber do seu futuro',
            body: '{pessoa:vestibular-coordenacao}, da coordenação da {org:vestibular-coordenacao}, chama você e a família para uma conversa: a inscrição do vestibular fecha em breve, e a sua ficha é a única da turma ainda em branco.',
            choices: {
              'escolher-engenharia': {
                label: 'Escolher engenharia mecânica, para entender o carro por dentro',
                outcomes: [
                  '{primeiro:vestibular-coordenacao} sorri pela primeira vez na reunião. A apostila chega pesada, e as noites de estudo começam a roubar horas do treino físico.',
                ],
              },
              'largar-os-estudos': {
                label: 'Recusar o vestibular: o futuro é a pista',
                outcomes: [
                  'A reunião termina num silêncio constrangedor. Na equipe, a notícia de que a pista terá toda a sua atenção é recebida com tapinhas nas costas.',
                ],
              },
              'curso-mais-disputado': {
                label: 'Mirar o curso mais disputado do estado, com bolsa integral',
                outcomes: [
                  '{primeiro:vestibular-coordenacao} arregala os olhos e promete ajuda com as matérias. Na sala dos professores, o seu nome vira a aposta da escola.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'prova-e-corrida',
        category: 'personal',
        when: [],
        needs: ['person:vestibular-coordenacao'],
        choices: [
          {
            id: 'fazer-a-prova',
            outcomes: [
              {
                odds: 'likely',
                effects: [
                  { e: 'flag', flag: 'vestibular-aprovacao' },
                  { e: 'stat', stat: 'morale', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'stat', stat: 'morale', size: -2 },
                  { e: 'stat', stat: 'form', size: -1 },
                  { e: 'stat', stat: 'teamTrust', size: -1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
            ],
          },
          {
            id: 'ficar-com-a-corrida',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'vestibular-coordenacao', size: -2 },
                  { e: 'stat', stat: 'teamTrust', size: 1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
            ],
          },
          {
            id: 'estudar-no-autodromo',
            requires: [{ c: 'flag', flag: 'vestibular-curso-disputado' }],
            outcomes: [
              {
                odds: 'even',
                effects: [
                  { e: 'flag', flag: 'vestibular-aprovacao' },
                  { e: 'stat', stat: 'confidence', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
              {
                odds: 'rest',
                effects: [
                  { e: 'stat', stat: 'morale', size: -2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'mesa-do-jantar', delay: 'soon' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Prova no sábado, etapa no domingo',
            body: 'A data saiu: a prova do vestibular cai no sábado da próxima etapa, uma das que mais pesam no campeonato. A equipe conta com você no treino; {pessoa:vestibular-coordenacao} avisa que não existe segunda chamada.',
            choices: {
              'fazer-a-prova': {
                label: 'Fazer a prova e chegar ao autódromo só no domingo',
                outcomes: [
                  'A caneta corre solta, e a prova parece feita sob medida: a aprovação é questão de tempo. No domingo, sem treino, você larga no escuro, mas sorrindo.',
                  'A prova trava na metade, e o domingo sem treino vira sofrimento. Duas derrotas no mesmo fim de semana.',
                ],
              },
              'ficar-com-a-corrida': {
                label: 'Abrir mão da prova e ficar com a equipe',
                outcomes: [
                  'O carro sai redondo do treino, e os mecânicos notam a dedicação. Na escola, {primeiro:vestibular-coordenacao} risca o seu nome da lista.',
                ],
              },
              'estudar-no-autodromo': {
                label: 'Levar os livros ao autódromo e encarar tudo',
                outcomes: [
                  'Entre um treino e outro, você revisa física no motorhome, e a cabeça chega afiada à prova. O seu nome sai entre os melhores do estado.',
                  'Os livros no motorhome não bastam: a prova do curso mais disputado cobra cada página que ficou para trás, e o domingo também sai pela metade.',
                ],
              },
            },
          },
        ],
      },
      {
        id: 'mesa-do-jantar',
        category: 'personal',
        when: [],
        needs: ['person:vestibular-coordenacao'],
        choices: [
          {
            id: 'tudo-pela-pista',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'stat', stat: 'form', size: 1 },
                  { e: 'stat', stat: 'morale', size: -1 },
                ],
                next: { step: 'pergunta-no-briefing', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'estudar-a-noite',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'flag', flag: 'vestibular-faculdade' },
                  { e: 'attitude', key: 'vestibular-coordenacao', size: 1 },
                  { e: 'stat', stat: 'morale', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: { step: 'pergunta-no-briefing', delay: 'nextSeason' },
              },
            ],
          },
          {
            id: 'garantir-a-vaga',
            requires: [{ c: 'flag', flag: 'vestibular-aprovacao' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'cash', size: -1, cap: true },
                  { e: 'stat', stat: 'morale', size: 2 },
                ],
                next: { step: 'pergunta-no-briefing', delay: 'nextSeason' },
              },
            ],
          },
        ],
        variants: [
          {
            title: 'O futuro na mesa do jantar',
            body: 'O ano escolar acaba, e a conversa sobre o futuro chega à mesa do jantar. {pessoa:vestibular-coordenacao} mandou um recado para a sua família: ainda dá tempo de escolher um caminho sem fechar nenhuma porta.',
            choices: {
              'tudo-pela-pista': {
                label: 'Dizer que o próximo ano é todo da pista',
                outcomes: ['A família aceita, com um aperto no peito. Sem provas nem apostilas, as manhãs vão para a academia e as tardes para o simulador.'],
              },
              'estudar-a-noite': {
                label: 'Estudar à noite e treinar de dia',
                outcomes: ['Os cadernos dividem a mochila com o capacete. O sono encurta, mas a família dorme tranquila e a escola manda parabéns.'],
              },
              'garantir-a-vaga': {
                label: 'Garantir a matrícula e trancar o curso por enquanto',
                outcomes: ['A taxa da matrícula pesa no bolso, mas a vaga fica guardada. Na mesa do jantar, pela primeira vez no ano, todo mundo concorda.'],
              },
            },
          },
        ],
      },
      {
        id: 'pergunta-no-briefing',
        category: 'career',
        when: [{ c: 'age', from: 'young' }],
        needs: ['person:vestibular-coordenacao'],
        choices: [
          {
            id: 'contar-a-historia',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'vestibular-coordenacao', size: 1 },
                  { e: 'stat', stat: 'reputation', size: 1 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'mudar-de-assunto',
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'attitude', key: 'vestibular-coordenacao', size: -1 },
                  { e: 'stat', stat: 'form', size: 1 },
                ],
                next: 'end',
              },
            ],
          },
          {
            id: 'falar-de-engenharia',
            requires: [{ c: 'flag', flag: 'vestibular-faculdade' }],
            outcomes: [
              {
                odds: 'sure',
                effects: [
                  { e: 'car', size: 1 },
                  { e: 'stat', stat: 'teamTrust', size: 2 },
                  { e: 'stat', stat: 'form', size: -1 },
                ],
                next: 'end',
              },
            ],
          },
        ],
        variants: [
          {
            title: 'Uma pergunta no briefing de sexta',
            body: 'No briefing de sexta, o engenheiro solta uma pergunta que ninguém esperava: “Você fez faculdade?” No mesmo dia, chega um e-mail de {pessoa:vestibular-coordenacao}: a escola quer a sua história no mural dos ex-alunos.',
            choices: {
              'contar-a-historia': {
                label: 'Contar a história inteira, do vestibular à pista',
                outcomes: [
                  'O mural da escola ganha a sua foto de macacão, e o engenheiro passa a ver você com outros olhos. Só o treino da tarde atrasa um pouco.',
                ],
              },
              'mudar-de-assunto': {
                label: 'Desconversar e voltar aos dados da telemetria',
                outcomes: ['O engenheiro entende o recado e volta aos gráficos. O e-mail da escola fica sem resposta, esquecido entre as mensagens da equipe.'],
              },
              'falar-de-engenharia': {
                label: 'Discutir o acerto com o que aprendeu nas aulas',
                outcomes: [
                  'Você desenha a suspensão no quadro com as fórmulas das aulas noturnas. O engenheiro fica impressionado, e a equipe testa a sua ideia no carro.',
                ],
              },
            },
          },
        ],
      },
    ],
  },
];
