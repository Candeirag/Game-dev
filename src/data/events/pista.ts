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
            label: 'Reclamar dele ao vivo, na entrevista para a transmissão',
            outcomes: [
              'O desabafo vai ao ar e a torcida compra a sua versão.',
              'O palavrão escapa ao vivo, e o departamento comercial da equipe passa a semana pedindo desculpas.',
            ],
          },
          partir: {
            label: 'Esperar por ele no paddock para tirar satisfação',
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
        title: 'Convocação para a sala dos comissários',
        body: 'Os comissários de {pista} querem ouvir a sua versão do toque em {outro}. A decisão vale para o grid da próxima etapa.',
        choices: {
          assumir: { label: 'Admitir que errou o ponto de freada', outcomes: ['A punição vem, mas branda. Os comissários anotam a honestidade.'] },
          defender: {
            label: 'Mostrar a telemetria e dizer que foi incidente de corrida',
            outcomes: ['Os comissários aceitam a explicação: incidente de corrida, sem punição.', 'Os comissários não se convencem e pesam a mão.'],
          },
          calma: {
            label: 'Lembrar que jogo sujo nunca entrou na sua ficha',
            outcomes: ['O histórico limpo fala por você: só uma advertência.', 'Histórico não apaga imagem: a punição vem, ainda que leve.'],
          },
        },
      },
      {
        title: 'Investigação depois da bandeirada',
        body: 'A direção de prova abriu uma investigação sobre a sua manobra em cima de {outro}. Você tem quinze minutos para se apresentar.',
        choices: {
          assumir: {
            label: 'Pedir desculpas a {outro} diante de todos na sala',
            outcomes: ['Você perde posições no grid, mas sai da sala com o respeito do paddock.'],
          },
          defender: {
            label: 'Levar o engenheiro e as imagens da câmera de bordo',
            outcomes: ['As imagens mostram que ele fechou a porta tarde. Caso arquivado.', 'As imagens mostram o contrário do que você queria mostrar.'],
          },
          calma: {
            label: 'Explicar a manobra com a calma de quem corre limpo',
            outcomes: ['Os comissários conhecem a sua fama e aceitam a explicação.', 'Desta vez a fama de jogo limpo não basta.'],
          },
        },
      },
    ],
  },
  {
    id: 'fechada-na-largada',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'contactVictim' }],
    needs: ['other'],
    choices: [
      {
        id: 'relevar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'cobrar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'grid', who: 'other', size: 1 },
              { e: 'rivalry', who: 'other', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
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
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma largada espremida contra o muro',
        body: 'Mal as luzes apagaram em {pista}, {outro} puxou o carro para o seu lado e não deixou espaço. Você escapou do muro por centímetros e perdeu todo o embalo da primeira curva.',
        choices: {
          relevar: {
            label: 'Engolir a raiva e pensar na próxima etapa',
            outcomes: ['Você não dá entrevista sobre o assunto. No paddock, o silêncio conta a seu favor, mas a fechada fica martelando na cabeça.'],
          },
          cobrar: {
            label: 'Pedir à direção de prova que reveja a largada',
            outcomes: [
              'A direção revê as imagens e pune {outro} no grid da próxima etapa. Ele não gostou nem um pouco.',
              'A direção considera lance normal de largada. {outro} ri da reclamação, e a equipe acha que você perdeu tempo com isso.',
            ],
          },
          partir: {
            label: 'Partir para cima dele assim que ele tirar o capacete',
            outcomes: [
              'Você diz tudo na cara dele, com o paddock inteiro olhando. Ele baixa os olhos e vai embora sem responder.',
              'O dedo na cara vira empurrão, o empurrão vira vídeo, e os comissários anotam o seu número.',
            ],
          },
        },
      },
      {
        title: '{outro} mudou de linha duas vezes',
        body: 'Na arrancada para a primeira curva, {outro} ziguezagueou na sua frente e quase levou a sua roda dianteira junto. A regra permite uma mudança de traçado. Ele usou duas.',
        choices: {
          relevar: {
            label: 'Deixar a regra de lado e guardar o lance',
            outcomes: ['Você anota o jeito dele largar e segue a vida. Quem viu de fora elogiou a maturidade; por dentro, a confiança balançou.'],
          },
          cobrar: {
            label: 'Levar o vídeo da largada à direção de prova',
            outcomes: [
              'Duas mudanças de linha, três comissários de acordo: {outro} perde posições no próximo grid e fecha a cara.',
              'Os comissários entendem que a segunda mudança foi para se defender de outro carro. Caso encerrado, e a sua equipe torce o nariz.',
            ],
          },
          partir: {
            label: 'Ir tirar satisfação na tenda da equipe dele',
            outcomes: [
              'Você entra, fala o que tinha para falar e sai. A equipe dele fica muda, e você volta de alma lavada.',
              'Os mecânicos dele fecham a tenda na sua cara, e a confusão na entrada acaba no relatório dos comissários.',
            ],
          },
        },
      },
      {
        title: 'A primeira curva virou emboscada',
        body: 'Você largou bem em {pista}, mas {outro} freou tarde por dentro e jogou você para fora da pista. Quando você conseguiu voltar, metade do pelotão já tinha passado.',
        choices: {
          relevar: {
            label: 'Reconhecer que largada é assim e virar a página',
            outcomes: ['A frase sai bonita na transmissão. Na semana, porém, você se pega revendo a largada mais vezes do que gostaria.'],
          },
          cobrar: {
            label: 'Reclamar formalmente da manobra aos comissários',
            outcomes: [
              'Os comissários concordam que a manobra foi exagerada, e {outro} paga no grid. Agora ele também tem uma conta com você.',
              'A reclamação é arquivada sem conversa. Na saída, {outro} passa com um sorrisinho, e o chefe de equipe pede foco.',
            ],
          },
          partir: {
            label: 'Emparelhar com ele na volta de desaceleração e encarar',
            outcomes: [
              'Você emparelha, aponta o dedo e segue em frente. O recado é entendido pelo pelotão inteiro.',
              'A encarada na volta lenta aparece na câmera aérea, e os comissários tratam o caso como direção perigosa.',
            ],
          },
        },
      },
      {
        title: 'Sem espaço entre {outro} e a grama',
        body: '{outro} largou mal, viu você passando e simplesmente fechou a porta. Duas rodas na grama, o carro dançando de lado e um susto que a equipe inteira acompanhou pelo monitor.',
        choices: {
          relevar: {
            label: 'Agradecer por ter salvado o carro e seguir em frente',
            outcomes: ['A calma impressiona os mecânicos. Mas fica a pergunta: até quando você vai deixar a porta ser fechada na sua cara?'],
          },
          cobrar: {
            label: 'Mandar o engenheiro levar a telemetria aos comissários',
            outcomes: [
              'A telemetria mostra a guinada de {outro} no meio da arrancada. A punição vem, e ele passa a olhar você de lado.',
              'A telemetria não convence: para os comissários, cada um defendeu o seu espaço. O engenheiro volta da sala de mãos vazias e de cara fechada.',
            ],
          },
          partir: {
            label: 'Partir para cima de {outro} na balança, depois da prova',
            outcomes: [
              'Na balança, você fala tão alto que os outros pilotos param para ouvir. O recado chega a todos de uma vez.',
              'Um fiscal precisa se meter entre vocês dois na balança. O caso sobe para os comissários, e a imprensa adora.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'toque-por-tras',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'contactCulprit' }],
    needs: ['other'],
    choices: [
      {
        id: 'desculpas',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'other', size: -1 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'incidente',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'rivalry', who: 'other', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'limpo',
        requires: [{ c: 'trait', trait: 'cleanRacer' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'rivalry', who: 'other', size: -2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Você mergulhou, e {outro} rodou',
        body: 'A tentativa de ultrapassagem em {pista} chegou um metro atrasada. A sua roda dianteira acertou a traseira de {outro}, que rodou e caiu para o fim do pelotão.',
        choices: {
          desculpas: {
            label: 'Procurar {outro} depois da prova e pedir desculpas',
            outcomes: ['Ele aceita o aperto de mão, ainda bufando. O paddock registra o gesto, mas você passa a noite revendo a freada.'],
          },
          incidente: {
            label: 'Dizer à imprensa que foi incidente de corrida',
            outcomes: [
              'A versão cola: nos programas de domingo, o lance vira só mais uma briga dura de corrida.',
              'Ninguém compra a versão. {outro} mostra o carro amassado para as câmeras, e a sua imagem sai arranhada.',
            ],
          },
          limpo: {
            label: 'Explicar o erro com a franqueza de quem joga limpo',
            outcomes: [
              'Quem conhece o seu jeito de correr acredita no erro honesto. Até {outro} acaba aliviando.',
              'Desta vez a sua fama no paddock não convence {outro}, e o assunto fica mal resolvido.',
            ],
          },
        },
      },
      {
        title: 'A freada que passou do ponto',
        body: 'Você tentou o lado de dentro no fim da reta e travou as rodas. {outro} não tinha para onde ir: os carros se tocaram, e quem levou a pior foi ele.',
        choices: {
          desculpas: {
            label: 'Ir até a equipe de {outro} e assumir a culpa',
            outcomes: ['O chefe dele agradece a franqueza. A culpa assumida pesa no peito, mas abre portas no paddock.'],
          },
          incidente: {
            label: 'Alegar que ele fechou a porta tarde demais',
            outcomes: [
              'As imagens são ambíguas, e muita gente fica do seu lado. Você deixa o fim de semana de cabeça erguida.',
              'A câmera de bordo dele desmente você em rede nacional, e cola a fama de quem não assume os erros.',
            ],
          },
          limpo: {
            label: 'Lembrar que é o primeiro toque seu em muito tempo',
            outcomes: [
              'O argumento convence até {outro}, que admite que também podia ter deixado espaço.',
              'Ele não quer saber de histórico: diz que basta uma vez, e a sua confiança sente o golpe.',
            ],
          },
        },
      },
      {
        title: 'O toque que tirou {outro} da prova',
        body: '{outro} vinha para um bom resultado até você encostar na roda traseira dele na chicane. Ele abandonou ali. O seu carro ficou com o bico torto, e a consciência pesou.',
        choices: {
          desculpas: {
            label: 'Publicar um pedido de desculpas a {outro} nas redes',
            outcomes: ['A mensagem é bem recebida pela torcida, e ele responde com um seco "tudo bem". Ainda assim, a história mexe com você.'],
          },
          incidente: {
            label: 'Responder que corrida tem contato e que a vida segue',
            outcomes: [
              'Os veteranos do paddock concordam: chicane é lugar de briga. A sua confiança continua em dia.',
              'A torcida dele inunda as suas redes de críticas, e o assunto não morre a semana inteira.',
            ],
          },
          limpo: {
            label: 'Ligar para {outro} e explicar o lance, sem rodeios',
            outcomes: [
              'A conversa é franca, e ele reconhece que você não é de fazer jogo sujo.',
              'Ele atende, ouve e desliga sem dizer muito. A ligação não resolve, e você fica remoendo o lance.',
            ],
          },
        },
      },
      {
        title: 'Um toque em cheio na traseira de {outro}',
        body: 'No meio do pelotão, você calculou mal a aproximação e acertou {outro} em cheio no fim da reta. Ele terminou na brita; você, com o coração na boca e o carro chiando.',
        choices: {
          desculpas: {
            label: 'Assumir o erro ao vivo, ainda na entrevista de pista',
            outcomes: ['A frase vai ao ar e surpreende os narradores. O respeito cresce, mas admitir em público custa um pouco de confiança.'],
          },
          incidente: {
            label: 'Culpar {outro} por ter freado cedo demais',
            outcomes: [
              'A tese do freio adiantado ganha força entre os comentaristas, e você deixa o circuito com a consciência leve.',
              'Os dados mostram que ele freou no ponto de sempre. A desculpa vira piada no paddock.',
            ],
          },
          limpo: {
            label: 'Pedir para ver as imagens com ele, sem plateia',
            outcomes: [
              'Assistindo juntos, vocês dois riem do susto. O caso acaba ali.',
              'Ele aceita ver as imagens, mas sai da sala convencido de que você exagerou.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'roda-com-roda',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'contact' }],
    needs: ['other'],
    choices: [
      {
        id: 'rever',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'racecraft', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'seguir',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'rivalry', who: 'other', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'frieza',
        requires: [{ c: 'aptitude', aptitude: 'composure', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'other', size: -1 },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Roda com roda com {outro}',
        body: 'Vocês dividiram três curvas seguidas em {pista}, lado a lado, até as rodas se tocarem na saída da última. Os dois seguiram, com os carros avariados e o sangue fervendo.',
        choices: {
          rever: {
            label: 'Rever o lance quadro a quadro com o engenheiro',
            outcomes: ['Você descobre onde deixou a porta aberta. A lição fica, e uma pontinha de dúvida também.'],
          },
          seguir: {
            label: 'Dar de ombros: briga de pista se resolve na pista',
            outcomes: [
              'A atitude agrada quem gosta de corrida de verdade, e a confiança sai em alta. {outro} anotou o recado.',
              '{outro} leva a frase para o lado pessoal, e a troca de provocações tira o seu foco na semana.',
            ],
          },
          frieza: {
            label: 'Cumprimentar {outro} pela briga e elogiar a disputa',
            outcomes: ['O elogio desarma qualquer clima ruim, e a semana começa leve, com a pilotagem no lugar.'],
          },
        },
      },
      {
        title: 'O lance que ninguém soube julgar',
        body: 'Na briga com {outro}, os carros se encostaram no meio da curva. Os comissários olharam, conversaram e não decidiram nada. Cada equipe tem a sua versão.',
        choices: {
          rever: {
            label: 'Pedir ao engenheiro um relatório honesto do lance',
            outcomes: ['O relatório aponta erro dos dois. Você aprende algo sobre espaço na curva, mas não gosta do que lê.'],
          },
          seguir: {
            label: 'Manter a sua versão e encerrar o assunto na imprensa',
            outcomes: [
              'A sua versão prevalece nas conversas do paddock, e a confiança agradece.',
              '{outro} contesta em público, os comentaristas tomam partido, e o seu desempenho na semana sofre com o barulho.',
            ],
          },
          frieza: {
            label: 'Admitir a sua parte e propor esquecer o lance',
            outcomes: ['A franqueza tranquila surpreende {outro}, que faz o mesmo. A rivalidade esfria antes de esquentar.'],
          },
        },
      },
      {
        title: 'Borracha alheia no seu pneu',
        body: 'Depois da corrida, o mecânico mostra a lateral do seu pneu: uma faixa preta, lembrança da encostada de {outro} na metade da prova. Por pouco não furou.',
        choices: {
          rever: {
            label: 'Estudar onde dava para ter evitado a encostada',
            outcomes: ['A análise mostra que você podia ter cedido meio carro. Fica a lição, fica a irritação.'],
          },
          seguir: {
            label: 'Postar a foto do pneu e brincar com o assunto',
            outcomes: [
              'A foto viraliza com bom humor, e até a torcida de {outro} ri. Você sai por cima.',
              '{outro} não acha graça e responde com ironia. A troca de farpas toma a cabeça que devia estar nos treinos.',
            ],
          },
          frieza: {
            label: 'Guardar o pneu como lembrança e não comentar mais',
            outcomes: ['O silêncio diz mais que qualquer entrevista. Você chega à próxima etapa com a cabeça fria e a pilotagem afiada.'],
          },
        },
      },
      {
        title: 'Dois carros e uma curva só',
        body: '{outro} e você chegaram juntos à freada, e ninguém quis tirar o pé. O toque foi leve, mas custou tempo aos dois, e quem vinha atrás agradeceu.',
        choices: {
          rever: {
            label: 'Assumir que faltou paciência e treinar a aproximação',
            outcomes: ['Você passa a semana repetindo a freada no simulador. O ganho é real, mas a cabeça fica cheia de dúvidas.'],
          },
          seguir: {
            label: 'Dizer que faria tudo de novo, sem pensar duas vezes',
            outcomes: [
              'A frase vira lema na torcida, e a confiança sobe. {outro} entende que a briga vai continuar.',
              '{outro} jura que a próxima vai ser diferente, e a ameaça fica rondando a sua cabeça a semana toda.',
            ],
          },
          frieza: {
            label: 'Ir até a equipe dele combinar respeito na freada',
            outcomes: ['Vocês combinam deixar espaço um para o outro. O acordo tira um peso, e a pilotagem flui melhor.'],
          },
        },
      },
    ],
  },
  {
    id: 'carenagem-empurrada',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'tier', max: 3 },
      { c: 'race', tag: 'penalized' },
      { c: 'race', tag: 'contact' },
    ],
    choices: [
      {
        id: 'aceitar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'recorrer',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'treinar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A carenagem que entregou você',
        body: 'Você terminou a prova em {pista} com a carenagem dianteira fora do lugar, sinal de que empurrou alguém. A regra do kart não perdoa: punição de tempo depois da bandeirada.',
        choices: {
          aceitar: {
            label: 'Aceitar a punição e aprender a pressionar sem encostar',
            outcomes: ['O resultado escorrega na classificação, mas os fiscais elogiam a postura, e a lição fica.'],
          },
          recorrer: {
            label: 'Pagar a taxa e recorrer da decisão',
            outcomes: [
              'Os fiscais reveem as imagens: a carenagem saiu num toque recebido, não dado. A punição cai, e a taxa valeu a pena.',
              'O recurso é negado em cinco minutos. Além da taxa perdida, o chefe da equipe reclama do papelão.',
            ],
          },
          treinar: {
            label: 'Alugar a pista na semana para treinar a aproximação',
            outcomes: ['O aluguel aperta o orçamento, mas você aprende a colar no kart da frente sem tocar nele.'],
          },
        },
      },
      {
        title: 'Punição pelo bico recuado',
        body: 'Na última volta, você encostou no kart da frente para forçar a passagem. Ganhou a posição, mas a carenagem recuou e os fiscais viram. A posição vai embora com a punição.',
        choices: {
          aceitar: {
            label: 'Assinar a súmula sem reclamar',
            outcomes: ['Você assina sem uma palavra. Dói ver a posição perdida, mas o paddock do kart nota a sua postura.'],
          },
          recorrer: {
            label: 'Recorrer, alegando que o toque veio de trás',
            outcomes: [
              'As imagens mostram o kart de trás empurrando o seu. A punição é retirada, e a confiança volta junto.',
              'Ninguém vê empurrão nenhum vindo de trás. O recurso morre ali, e a equipe se irrita com o dinheiro jogado fora.',
            ],
          },
          treinar: {
            label: 'Pagar uma tarde com o instrutor para ensaiar ultrapassagem limpa',
            outcomes: ['A aula custa o que o caixa mal tinha, mas você volta sabendo passar sem precisar tocar em ninguém.'],
          },
        },
      },
      {
        title: 'O gabarito do fiscal',
        body: 'No parque fechado de {pista}, o fiscal se abaixa, mede a carenagem do seu kart com o gabarito e balança a cabeça. Mais uma corrida que termina na mesa da direção de prova.',
        choices: {
          aceitar: {
            label: 'Ouvir a explicação do fiscal e agradecer o aviso',
            outcomes: ['O fiscal explica com paciência como a carenagem denuncia o toque. A punição fica, mas o respeito do paddock por você cresce.'],
          },
          recorrer: {
            label: 'Contestar a medição feita com o gabarito',
            outcomes: [
              'Uma nova medição dá diferença dentro da tolerância. A punição é revista, e você comemora como vitória.',
              'A segunda medição confirma a primeira. A taxa vai embora, e a paciência da equipe também.',
            ],
          },
          treinar: {
            label: 'Reservar treino extra para atacar sem encostar',
            outcomes: ['O treino extra pesa no caixa, mas a sua tocada fica mais limpa, e o kart deixa de voltar com a carenagem torta.'],
          },
        },
      },
    ],
  },
  {
    id: 'punicao-na-corrida',
    category: 'track',
    frequency: 'common',
    when: [
      { c: 'race', tag: 'penalized' },
      { c: 'notRace', tag: 'contact' },
    ],
    choices: [
      {
        id: 'cumprir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'recorrer',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'grid', who: 'player', size: 1 },
              { e: 'penaltyPoints', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'desabafar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'penaltyPoints', size: 1 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Punição de tempo no meio da prova',
        body: 'Os comissários entenderam que você saiu da pista para ganhar vantagem em {pista} e aplicaram punição de tempo. O resultado escorregou, e o caso ainda rende pontos na licença.',
        choices: {
          cumprir: {
            label: 'Aceitar a decisão e não alimentar polêmica',
            outcomes: ['Os pontos na licença entram na ficha, mas o paddock percebe que você não faz drama.'],
          },
          recorrer: {
            label: 'Entrar com recurso e pedir nova análise',
            outcomes: [
              'A nova análise dá razão a você: a vantagem não existiu. A punição cai, e o ânimo sobe.',
              'O recurso é negado, e os comissários acham que você desafiou a decisão: a conta chega também no próximo grid.',
            ],
          },
          desabafar: {
            label: 'Dizer na TV que os comissários tiram cara ou coroa',
            outcomes: [
              'A frase vira meme e a torcida aplaude, mas no paddock pega mal desafiar a direção de prova.',
              'A frase chega aos comissários, que não acham graça nenhuma. Mais pontos na licença, e os patrocinadores pedem calma.',
            ],
          },
        },
      },
      {
        title: 'Largada queimada, punição na conta',
        body: 'O sensor não perdoou: o seu carro se mexeu antes de as luzes apagarem em {pista}. Segundos somados ao tempo final, uma advertência na ficha e a direção de prova de olho em você.',
        choices: {
          cumprir: {
            label: 'Admitir a ansiedade e treinar a largada',
            outcomes: ['Você admite que se adiantou. Os pontos vão para a licença, mas cresce a fama de quem sabe perder.'],
          },
          recorrer: {
            label: 'Pedir os dados do sensor de largada',
            outcomes: [
              'Os dados mostram um tranco do carro parado, não uma largada antecipada. Os comissários retiram a punição.',
              'Os dados confirmam a queima, e os comissários não gostam da insistência: o próximo grid também paga.',
            ],
          },
          desabafar: {
            label: 'Desabafar com a equipe na frente das câmeras',
            outcomes: [
              'O desabafo vai ao ar, e quem gosta de garra adora o que vê. Os mais antigos do paddock torcem o nariz.',
              'O desabafo vai ao ar, e a direção de prova ouve cada palavra. Mais pontos na licença, e os patrocinadores ligam preocupados.',
            ],
          },
        },
      },
      {
        title: 'Bandeira de advertência, depois punição',
        body: 'Você recebeu a bandeira preta e branca por abusar dos limites de pista e continuou forçando. Na terceira vez, veio a punição. O engenheiro ainda não se conformou.',
        choices: {
          cumprir: {
            label: 'Reconhecer o exagero e treinar o traçado',
            outcomes: ['Você assume o erro diante da equipe. Os pontos na licença doem, mas a sua palavra passa a valer mais entre os mecânicos.'],
          },
          recorrer: {
            label: 'Questionar onde exatamente estava a linha branca',
            outcomes: [
              'A organização admite que a marcação estava apagada naquele trecho. Punição anulada, ânimo renovado.',
              'A linha estava lá, pintada e visível. O recurso piora tudo, e a direção de prova também mexe no seu grid.',
            ],
          },
          desabafar: {
            label: 'Reclamar que a pista é mal sinalizada',
            outcomes: [
              'Outros pilotos concordam em público, e você vira porta-voz da reclamação. A direção de prova não gosta nada.',
              'A reclamação soa como desculpa. Os comissários somam pontos na licença, e os patrocinadores pedem menos choro e mais resultado.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'pole-position',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'pole' }],
    choices: [
      {
        id: 'foco',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'comemorar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'arranque',
        requires: [{ c: 'trait', trait: 'bornStarter' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A pole que todo mundo viu',
        body: 'Você largou na frente de todo mundo em {pista}. O tempo da classificação ficou na tela da transmissão o fim de semana inteiro, e o paddock quer saber se foi sorte ou se veio para ficar.',
        choices: {
          foco: {
            label: 'Dispensar a festa e estudar a largada com o engenheiro',
            outcomes: ['Enquanto os outros comemoram, você revê cada arrancada. A semana fica sem graça, mas a próxima largada já está estudada.'],
          },
          comemorar: {
            label: 'Aproveitar os holofotes e dar todas as entrevistas',
            outcomes: [
              'As entrevistas rendem, e os patrocinadores adoram ver a marca na foto da pole.',
              'As entrevistas tomam a semana inteira, e o treino fica para depois. A fama cresce; o ritmo, nem tanto.',
            ],
          },
          arranque: {
            label: 'Confiar no seu arranque e pular o treino de largada',
            outcomes: ['Você sabe que larga bem e não precisa provar nada. A confiança vai lá no alto, mas o engenheiro não gosta do treino pulado.'],
          },
        },
      },
      {
        title: 'O primeiro lugar no grid de {pista}',
        body: 'A volta da classificação saiu perfeita: nenhum erro, todas as zebras no lugar. Na foto oficial, o seu carro aparece na frente do pelotão inteiro. Agora é transformar isso em costume.',
        choices: {
          foco: {
            label: 'Guardar a foto e voltar ao trabalho na segunda',
            outcomes: ['Você trata a pole como dever cumprido. Falta a resenha com os amigos, mas sobra concentração.'],
          },
          comemorar: {
            label: 'Postar a foto do grid com uma legenda provocativa',
            outcomes: [
              'A legenda pega bem: a torcida cresce, e um patrocinador repassa a postagem.',
              'A legenda provoca demais, e você passa a semana respondendo comentários em vez de treinar.',
            ],
          },
          arranque: {
            label: 'Avisar a equipe que a largada é com você',
            outcomes: ['Ninguém duvida: os mecânicos já viram você largar. Só o engenheiro, que queria ensaiar, fica de cara amarrada.'],
          },
        },
      },
      {
        title: 'Pole, e o peso de largar na frente',
        body: 'Largar na frente tem um lado que ninguém conta: o pelotão inteiro mira você na primeira curva. A pole de {pista} foi linda, mas a equipe quer conversar sobre o que vem depois das luzes.',
        choices: {
          foco: {
            label: 'Pedir uma reunião para treinar defesa na primeira curva',
            outcomes: ['A reunião vira aula de defesa. Você perde o fim de semana livre, mas ganha um plano para a próxima pole.'],
          },
          comemorar: {
            label: 'Levar a equipe para jantar e brindar a pole',
            outcomes: [
              'O jantar vira notícia, e os patrocinadores adoram as fotos da equipe brindando a pole.',
              'A festa rende foto, mas avança pela madrugada. A segunda-feira começa atrasada, e o treino sofre.',
            ],
          },
          arranque: {
            label: 'Lembrar que largar bem é o seu forte',
            outcomes: ['Você nem cogita perder a ponta na largada. A certeza impressiona, embora o engenheiro preferisse ensaiar mesmo assim.'],
          },
        },
      },
    ],
  },
  {
    id: 'largada-travada',
    category: 'track',
    frequency: 'common',
    when: [
      { c: 'trait', trait: 'slowStarter' },
      { c: 'race', tag: 'lostPlaces' },
    ],
    choices: [
      {
        id: 'treinar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'focus', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'aceitar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'relacao',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A largada travou de novo',
        body: 'Luzes apagadas em {pista} e, mais uma vez, o seu carro saiu como se pensasse antes de andar. Até a primeira curva, já tinha gente demais na sua frente.',
        choices: {
          treinar: {
            label: 'Contratar sessões de treino de reação',
            outcomes: ['As sessões custam caro, mas o reflexo melhora um pouco a cada dia. A primeira curva vai ficar menos cheia.'],
          },
          aceitar: {
            label: 'Aceitar o defeito e caprichar no ritmo de corrida',
            outcomes: ['Você faz as pazes com a largada ruim e foca no resto. Dorme melhor, mas a dúvida continua sentada no banco do carro.'],
          },
          relacao: {
            label: 'Testar outra relação de marcha para ganhar arrancada',
            outcomes: [
              'O teste encontra uma relação que ajuda o carro a sair do lugar. Dinheiro bem gasto.',
              'A relação nova não muda nada na largada e ainda deixa o carro sem velocidade na reta.',
            ],
          },
        },
      },
      {
        title: 'O grid inteiro passou por você',
        body: 'Em {pista}, a arrancada foi lenta outra vez, e o pelotão aproveitou. Quando a corrida assentou, o resultado já estava comprometido. Não é azar: é padrão.',
        choices: {
          treinar: {
            label: 'Treinar largadas até cansar, com cronômetro na mão',
            outcomes: ['Os treinos pesam no bolso e nos braços, mas o tempo de reação cai. A melhora é pequena, e real.'],
          },
          aceitar: {
            label: 'Assumir que a sua força está no meio da corrida',
            outcomes: ['A ideia tira um peso das costas. A próxima etapa chega mais leve, embora largar ainda dê frio na barriga.'],
          },
          relacao: {
            label: 'Pedir aos mecânicos uma relação de marcha mais curta',
            outcomes: [
              'A relação nova faz o carro pular na largada. Custou peças, mas valeu.',
              'A relação mais curta ajuda na largada e atrapalha no resto da volta. Gasto à toa.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'corrida-de-recuperacao',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'gainedPlaces' }],
    choices: [
      {
        id: 'dividir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'holofote',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'classificacao',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'pace', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A corrida de recuperação em {pista}',
        body: 'Você largou lá atrás e foi passando um por um, volta após volta. Na bandeirada, a equipe inteira pulava na beira da pista, e o narrador já chamava a prova de recuperação do ano.',
        choices: {
          dividir: {
            label: 'Agradecer o carro que a equipe preparou',
            outcomes: ['O chefe de equipe estufa o peito na entrevista. A manchete fala mais do carro que de você, mas os mecânicos fecham com você.'],
          },
          holofote: {
            label: 'Dizer que foi na raça, ultrapassagem por ultrapassagem',
            outcomes: [
              'Os vídeos das ultrapassagens circulam, e o seu nome cresce. A equipe acha que faltou um agradecimento.',
              'O discurso cola, mas os mecânicos ficam magoados: sem o acerto que eles montaram, nada daquilo teria acontecido.',
            ],
          },
          classificacao: {
            label: 'Avisar que o próximo passo é largar mais na frente',
            outcomes: ['Você pede treino de volta lançada e passa a semana no simulador. Cansa, mas a velocidade pura agradece.'],
          },
        },
      },
      {
        title: 'Ultrapassagens que ninguém esperava',
        body: 'Com o carro acertado para a corrida, você transformou uma classificação ruim numa tarde de ultrapassagens em {pista}. A cada volta, um adversário a menos na sua frente.',
        choices: {
          dividir: {
            label: 'Elogiar o acerto de corrida que os mecânicos fizeram',
            outcomes: ['Os mecânicos guardam a frase. Na foto do jornal, eles aparecem mais que você, e está tudo bem.'],
          },
          holofote: {
            label: 'Mandar um recado: quem largar na frente que se cuide',
            outcomes: [
              'O recado vira chamada na transmissão, e a sua fama de quem ataca se espalha. Na equipe, alguns acharam exagero.',
              'O recado soa arrogante dentro da equipe, que trabalhou dobrado no acerto. O clima esfria.',
            ],
          },
          classificacao: {
            label: 'Pedir para trabalhar a classificação antes do acerto de corrida',
            outcomes: ['A equipe topa, e as voltas lançadas tomam a semana. O cansaço bate, mas a velocidade pura aparece.'],
          },
        },
      },
      {
        title: 'A tarde em que nada segurou você',
        body: 'Um começo ruim, um pelotão embolado e, mesmo assim, você atravessou o grid de {pista} com freadas que fizeram a torcida levantar. A equipe nunca viu tantas ultrapassagens numa prova só.',
        choices: {
          dividir: {
            label: 'Dedicar a corrida aos mecânicos da equipe',
            outcomes: ['A dedicatória emociona os mecânicos. A imprensa, que queria uma frase sua, fica com a do chefe.'],
          },
          holofote: {
            label: 'Lembrar a todos quem fez as ultrapassagens',
            outcomes: [
              'A frase confirma o que todo mundo viu, e o seu nome sobe no paddock. A equipe sente falta de um obrigado.',
              'A frase passa do ponto. Os engenheiros, que viraram a noite no acerto, se sentem esquecidos.',
            ],
          },
          classificacao: {
            label: 'Combinar com o engenheiro um plano para a classificação',
            outcomes: ['O plano exige noites de estudo e voltas sem fim no simulador. O corpo reclama, o tempo de volta melhora.'],
          },
        },
      },
    ],
  },
  {
    id: 'domingo-para-esquecer',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'lostPlaces' }],
    choices: [
      {
        id: 'analisar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'desligar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'culpar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um domingo para esquecer em {pista}',
        body: 'Nada encaixou: o ritmo sumiu, os pneus não aguentaram e, volta a volta, os adversários foram passando. Você cruzou a linha bem atrás de onde largou.',
        choices: {
          analisar: {
            label: 'Ficar com a equipe até entender cada volta perdida',
            outcomes: ['Você deixa o circuito de madrugada, com o humor no chão. Mas a equipe vê quem fica para resolver.'],
          },
          desligar: {
            label: 'Desligar o telefone e passar o dia longe das pistas',
            outcomes: ['Um dia longe de tudo recarrega a cabeça, ainda que a semana de trabalho comece um passo atrás.'],
          },
          culpar: {
            label: 'Dizer que o carro estava impossível de guiar',
            outcomes: [
              'A frase protege a sua confiança, mas a equipe inteira escuta e não gosta.',
              'A frase vaza, o chefe de equipe responde em público, e quem sai mal é você.',
            ],
          },
        },
      },
      {
        title: 'Ladeira abaixo, do grid à bandeirada',
        body: 'A largada foi boa, a primeira volta também. Depois, o carro começou a escorregar, e cada ultrapassagem sofrida doía mais que a anterior. Uma tarde longa em {pista}.',
        choices: {
          analisar: {
            label: 'Pedir a telemetria e procurar o erro com os engenheiros',
            outcomes: ['Os gráficos mostram o desgaste antes do previsto. Achar o problema não alivia a decepção, mas aproxima vocês.'],
          },
          desligar: {
            label: 'Ir para casa e não falar de corrida até quarta',
            outcomes: ['O descanso faz bem à cabeça. Na quarta, você descobre que a equipe já trabalhou dois dias sem você.'],
          },
          culpar: {
            label: 'Reclamar do acerto que a equipe escolheu',
            outcomes: [
              'A reclamação tira o peso dos seus ombros, mas os engenheiros fecham a cara.',
              'A reclamação cai mal: os engenheiros mostram que foi você quem pediu aquele acerto. Constrangimento geral.',
            ],
          },
        },
      },
      {
        title: 'A cada volta, uma posição a menos',
        body: 'Você viu o pelotão passar como quem assiste a um filme ruim. Nada de quebra, nada de toque: simplesmente faltou ritmo. No caminho de volta, ninguém da equipe falou nada.',
        choices: {
          analisar: {
            label: 'Quebrar o silêncio e chamar a equipe para conversar',
            outcomes: ['A conversa é dura e longa. No fim, todos saem com tarefas para a semana, e você com o peso da derrota.'],
          },
          desligar: {
            label: 'Esfriar a cabeça numa pelada com os amigos',
            outcomes: ['A pelada com os amigos devolve o sorriso. A preparação para a próxima etapa, essa, fica um pouco atrasada.'],
          },
          culpar: {
            label: 'Apontar os pneus como culpados na entrevista',
            outcomes: [
              'Os pneus não dão entrevista, e a sua confiança sai intacta. Os mecânicos acham a explicação cômoda demais.',
              'O fornecedor de pneus mostra que os outros carros não tiveram problema. Você fica sem desculpa.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'abandono-por-erro',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'crash' }],
    choices: [
      {
        id: 'assumir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'minimizar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ajudar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A longa caminhada de volta',
        body: 'O erro foi seu, e a corrida em {pista} acabou ali. Você volta a pé pela beira da pista, capacete na mão, ouvindo a torcida vaiar e aplaudir ao mesmo tempo.',
        choices: {
          assumir: {
            label: 'Chegar à equipe e pedir desculpas aos mecânicos',
            outcomes: ['Os mecânicos aceitam as desculpas com um tapinha nas costas. A confiança deles sobe; a sua, nem tanto.'],
          },
          minimizar: {
            label: 'Dizer que quem não arrisca não vence',
            outcomes: [
              'A frase soa como garra, e você sai de cabeça erguida. Entre os mecânicos, ninguém achou graça.',
              'A frase soa como descaso. A equipe se irrita, e um patrocinador liga para saber o que houve.',
            ],
          },
          ajudar: {
            label: 'Passar a noite na oficina ajudando a preparar o carro',
            outcomes: ['Você aprende o nome de cada peça e ganha o respeito dos mecânicos. O sono perdido cobra o preço nos treinos.'],
          },
        },
      },
      {
        title: 'Um descuido, e fim de prova',
        body: 'Bastou um momento de descuido em {pista} para jogar fora a corrida inteira. O carro parado fora do traçado resume o domingo, e a equipe ainda nem sabe o que dizer.',
        choices: {
          assumir: {
            label: 'Assumir a culpa com o chefe antes de qualquer pergunta',
            outcomes: ['A franqueza desarma o chefe, que só responde: "acontece, vamos em frente". Mas a cabeça fica pesada.'],
          },
          minimizar: {
            label: 'Culpar o azar e mudar de assunto',
            outcomes: [
              'A desculpa passa sem muito barulho, e a confiança continua firme.',
              'Ninguém acredita em azar. A equipe acha que você não aprendeu nada, e a notícia chega torta aos patrocinadores.',
            ],
          },
          ajudar: {
            label: 'Ficar com os mecânicos até o carro ficar pronto',
            outcomes: ['Madrugada adentro, você segura lanterna e passa ferramenta. A equipe não esquece, mas o corpo sente na semana.'],
          },
        },
      },
      {
        title: 'Ninguém para culpar além de você',
        body: 'Nenhum adversário por perto, nenhuma quebra: o abandono em {pista} foi erro seu, do começo ao fim. O chefe de equipe passa por você sem dizer uma palavra.',
        choices: {
          assumir: {
            label: 'Procurar o chefe e assumir o erro olho no olho',
            outcomes: ['A conversa é curta e dura. O chefe respeita a atitude, mas a sua confiança sai em frangalhos.'],
          },
          minimizar: {
            label: 'Lembrar que todo mundo erra e seguir para o hotel',
            outcomes: [
              'Uma boa noite de sono resolve para você. Para a equipe, que ficou desmontando o carro, nem tanto.',
              'A saída apressada é notada por todos. No dia seguinte, o clima na equipe está frio, e um patrocinador pede explicações.',
            ],
          },
          ajudar: {
            label: 'Pegar no pesado com os mecânicos no fim do dia',
            outcomes: ['Você desmonta, limpa e remonta junto com eles. A equipe vê, e o cansaço também aparece.'],
          },
        },
      },
    ],
  },
  {
    id: 'a-frente-do-companheiro',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'beatTeammate' }],
    needs: ['teammate'],
    choices: [
      {
        id: 'dados',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: 2 },
              { e: 'stat', stat: 'confidence', size: -1 },
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
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: -2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'hierarquia',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Na frente de {companheiro} em {pista}',
        body: 'Mesmo carro, mesma equipe, e você terminou na frente de {companheiro}. Na reunião técnica, os engenheiros olham os seus dados com interesse, e ele olha para o chão.',
        choices: {
          dados: {
            label: 'Abrir os seus dados para {companheiro} sem esconder nada',
            outcomes: ['Ele estuda cada curva e agradece de verdade. A dupla fica mais forte, mas você sente que entregou um segredo.'],
          },
          provocar: {
            label: 'Fazer piada do tempo dele na frente da equipe',
            outcomes: [
              'A equipe ri, você sai por cima, e {companheiro} engole em seco.',
              'Ninguém ri. {companheiro} fecha a cara, e o chefe pede que a disputa fique na pista.',
            ],
          },
          hierarquia: {
            label: 'Pedir prioridade nas estratégias a partir de agora',
            outcomes: [
              'O chefe promete pensar no assunto. Você sai da sala com a confiança lá em cima; {companheiro}, desconfiado.',
              'O chefe acha cedo para isso, e {companheiro} fica sabendo do pedido. Clima ruim dos dois lados.',
            ],
          },
        },
      },
      {
        title: 'O duelo interno ficou com você',
        body: 'Na equipe, a comparação é diária, e em {pista} ela ficou com você. {companheiro} foi embora sem falar com ninguém, e os engenheiros já marcaram reunião para entender a diferença.',
        choices: {
          dados: {
            label: 'Chamar {companheiro} para comparar as duas corridas',
            outcomes: ['Vocês comparam as duas corridas curva por curva. Ele sai mais próximo de você, e mais perto do seu tempo também.'],
          },
          provocar: {
            label: 'Postar o resultado com uma legenda irônica sobre ele',
            outcomes: [
              'A postagem faz sucesso, e você se sente imbatível. Ele não curte, nem compartilha.',
              'A postagem chega à diretoria, que não gosta de ver a equipe exposta. {companheiro} reclama com o chefe.',
            ],
          },
          hierarquia: {
            label: 'Sugerir que a equipe aposte as fichas em você',
            outcomes: [
              'A ideia fica na mesa do chefe, e só de ter falado você ganha confiança. {companheiro} percebe o movimento.',
              'O chefe corta o assunto: ali não existe primeiro piloto. {companheiro} fica sabendo, e a temperatura sobe.',
            ],
          },
        },
      },
      {
        title: 'Os números contra {companheiro}',
        body: 'Na tabela interna da equipe, você está na frente de {companheiro} em quase tudo depois de {pista}. O assunto chega aos jornais, que adoram uma briga de garagem.',
        choices: {
          dados: {
            label: 'Dizer aos jornais que a dupla trabalha junta, e provar',
            outcomes: ['A frase é sincera: você ajuda {companheiro} com o acerto. A dupla funciona, mas a sua vantagem encolhe.'],
          },
          provocar: {
            label: 'Confirmar aos jornais quem é a referência da casa',
            outcomes: [
              'A manchete sai do jeito que você queria. {companheiro} lê no café da manhã.',
              'A manchete sai, e {companheiro} responde com outra. O chefe precisa apagar o incêndio.',
            ],
          },
          hierarquia: {
            label: 'Conversar com o chefe sobre quem lidera a equipe',
            outcomes: [
              'O chefe ouve com atenção e não diz não. Você sai da conversa de cabeça erguida.',
              'O chefe não gosta da conversa, e {companheiro} acaba sabendo dela pelos corredores.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'atras-do-companheiro',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'race', tag: 'behindTeammate' },
      { c: 'notRace', tag: 'dnf' },
    ],
    needs: ['teammate'],
    choices: [
      {
        id: 'aprender',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'pace', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'equipamento',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
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
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: -2 },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{companheiro} foi mais rápido em {pista}',
        body: 'Mesmo equipamento, mesmos mecânicos, e {companheiro} cruzou a linha na sua frente. Na reunião, o engenheiro projeta os dados dos dois lado a lado. A diferença está toda na saída das curvas.',
        choices: {
          aprender: {
            label: 'Pedir para estudar os dados dele, curva por curva',
            outcomes: ['Engolir o orgulho dói, mas a lição vale. Você descobre onde ele acelera antes, e o seu tempo melhora.'],
          },
          equipamento: {
            label: 'Perguntar se os dois carros estão mesmo iguais',
            outcomes: [
              'Os mecânicos refazem as medições e acham um ajuste diferente. A dúvida tinha fundamento, e a oficina fica sem graça.',
              'Tudo igual, peça por peça. A pergunta ofende os mecânicos e deixa {companheiro} na defensiva.',
            ],
          },
          partir: {
            label: 'Partir para cima de {companheiro} na reunião técnica',
            outcomes: [
              'Você bate na mesa e exige o mesmo tratamento. Ele se encolhe, e você sai de lá com fome de corrida.',
              'A discussão escala, portas batem, e o chefe precisa apartar a briga dentro da própria equipe.',
            ],
          },
        },
      },
      {
        title: 'Atrás de {companheiro} na bandeirada',
        body: 'Na tabela da equipe, {companheiro} terminou na sua frente em {pista}. Todos comemoram o resultado da dupla, mas ninguém pergunta o que faltou para você.',
        choices: {
          aprender: {
            label: 'Cumprimentar {companheiro} e pedir uma conversa técnica',
            outcomes: ['Ele explica, sem esconder nada, onde ganhou tempo. A lição melhora o seu ritmo, embora o orgulho saia arranhado.'],
          },
          equipamento: {
            label: 'Reclamar que o carro dele recebeu as peças novas primeiro',
            outcomes: [
              'O chefe confirma que as peças novas foram para o carro dele. Você tinha razão, e a equipe fica sem jeito.',
              'A lista de peças mostra tudo igual para os dois carros. A reclamação pega mal, e {companheiro} fica com o pé atrás.',
            ],
          },
          partir: {
            label: 'Encarar {companheiro} na frente dos mecânicos',
            outcomes: [
              'Vocês ficam cara a cara, e é ele quem desvia o olhar. A mensagem foi entregue.',
              'Os mecânicos precisam apartar, e o chefe chama vocês para uma conversa que ninguém queria ter.',
            ],
          },
        },
      },
      {
        title: 'O companheiro levou a melhor',
        body: 'Depois de {pista}, a tabela interna mostra {companheiro} à sua frente, e o paddock repara. O chefe de equipe não diz nada, mas hoje o primeiro cumprimento foi para ele.',
        choices: {
          aprender: {
            label: 'Dobrar as horas no simulador para recuperar o terreno',
            outcomes: ['As horas extras viram décimos na tela. O cansaço bate, e a confiança demora a voltar.'],
          },
          equipamento: {
            label: 'Pedir para trocar de chassi com o carro dele',
            outcomes: [
              'A equipe aceita a troca, e você descobre que o problema não era só seu. Alívio, e uma oficina constrangida.',
              'A troca é feita e nada muda. A equipe fica com a impressão de que você procura desculpas, e ele também.',
            ],
          },
          partir: {
            label: 'Partir para cima dele com um recado nas redes',
            outcomes: [
              'O recado é curto e afiado. A torcida adora a briga, e você sente o sangue voltar a ferver.',
              'O recado vira crise na equipe, e o chefe ameaça tirar você das próximas reuniões técnicas.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'manobra-arriscada',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'momentWon' }],
    choices: [
      {
        id: 'estudar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'overtaking', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'vender',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'frieza',
        requires: [{ c: 'aptitude', aptitude: 'composure', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O lance que podia dar errado',
        body: 'A chance era pequena, e você foi assim mesmo. A manobra em {pista} deu certo por centímetros, e a transmissão repetiu o lance de três ângulos diferentes.',
        choices: {
          estudar: {
            label: 'Rever o lance e entender por que deu certo',
            outcomes: ['O replay mostra o quanto foi por pouco. Você aprende o ponto exato da freada, e um frio na espinha vem junto.'],
          },
          vender: {
            label: 'Dizer à imprensa que estava tudo calculado',
            outcomes: [
              'A frase cai bem, e o seu nome cresce como o de quem não tem medo de arriscar.',
              'O chefe de equipe lê a entrevista e lembra, em particular, que o tal cálculo quase virou batida.',
            ],
          },
          frieza: {
            label: 'Contar o lance como quem fez o óbvio',
            outcomes: ['A tranquilidade impressiona mais que a manobra. No paddock, começam a dizer que nada abala você.'],
          },
        },
      },
      {
        title: 'Tudo ou nada, e deu tudo',
        body: 'Você viu a brecha, sabia do risco e foi. O adversário não esperava, a equipe também não. Em {pista}, a aposta valeu, e os mecânicos ainda estão tentando respirar.',
        choices: {
          estudar: {
            label: 'Sentar com o engenheiro e medir o risco que correu',
            outcomes: ['Os números assustam: a margem era mínima. Você sai sabendo mais sobre ultrapassagem e com menos certeza do próprio limite.'],
          },
          vender: {
            label: 'Prometer repetir a dose sempre que der',
            outcomes: [
              'A promessa empolga a torcida e assusta os adversários. A confiança vai às alturas.',
              'A promessa assusta mais a sua equipe que os adversários. O chefe pede juízo.',
            ],
          },
          frieza: {
            label: 'Explicar que leu o adversário e soube a hora certa',
            outcomes: ['A explicação, feita sem euforia, mostra que não foi sorte. A sua fama de cabeça fria se espalha.'],
          },
        },
      },
      {
        title: 'A manobra de que todos falam',
        body: 'No grupo dos mecânicos, nas redes, no café do paddock: só se fala do lance arriscado que você ganhou em {pista}. Uns chamam de genial; outros, de loucura.',
        choices: {
          estudar: {
            label: 'Fugir do barulho e analisar a manobra em silêncio',
            outcomes: ['Longe do barulho, você entende o que fez certo. A cabeça aprende, mas o coração ainda dispara ao lembrar.'],
          },
          vender: {
            label: 'Entrar no assunto e alimentar a lenda do lance',
            outcomes: [
              'A lenda cresce a cada repostagem, e você surfa a onda com gosto.',
              'A lenda cresce, mas a equipe acha que você está brincando com fogo e com o carro dela.',
            ],
          },
          frieza: {
            label: 'Responder que só fez o que o momento pedia',
            outcomes: ['A resposta seca vira citação. Ninguém duvida que você faria tudo de novo, sem perder a calma.'],
          },
        },
      },
    ],
  },
  {
    id: 'volta-mais-rapida',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'fastestLap' }],
    choices: [
      {
        id: 'regularidade',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'consistency', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'divulgar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'sponsorMood', who: 'all', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A volta mais rápida de {pista}',
        body: 'No meio da corrida, você cravou a melhor volta do fim de semana. O tempo ficou na tela por voltas e voltas, e a pergunta na equipe é uma só: por que esse ritmo não apareceu sempre?',
        choices: {
          regularidade: {
            label: 'Pagar um treinador para trabalhar a regularidade',
            outcomes: ['O treinador cobra caro e não perdoa erro. Mas, volta a volta, o seu ritmo fica mais parecido com aquela volta.'],
          },
          divulgar: {
            label: 'Transformar a volta mais rápida em vídeo para as redes',
            outcomes: [
              'O vídeo da volta roda o país, e os patrocinadores pedem mais conteúdo assim.',
              'O vídeo roda bem, mas o engenheiro lembra que aquela volta comeu os pneus que faltaram no fim.',
            ],
          },
        },
      },
      {
        title: 'Uma volta melhor que a de todo mundo',
        body: 'O cronômetro não mente: em {pista}, ninguém fez uma volta tão boa quanto a sua. O resto da corrida, porém, não acompanhou. A equipe quer transformar o lampejo em rotina.',
        choices: {
          regularidade: {
            label: 'Montar um programa de treino de ritmo com a equipe',
            outcomes: ['As sessões custam horas e dinheiro, mas o seu ritmo fica mais estável a cada semana.'],
          },
          divulgar: {
            label: 'Divulgar a volta com as marcas do carro em destaque',
            outcomes: [
              'O vídeo vai parar até em vitrine de loja, e as marcas do carro aparecem para todo lado.',
              'O vídeo sai, mas os mecânicos se incomodam: o pedido era poupar o carro, não caçar volta rápida.',
            ],
          },
        },
      },
      {
        title: 'A volta que ninguém conseguiu bater',
        body: 'Com a pista limpa e o carro no ponto, você arrancou uma volta que ninguém igualou em {pista}. Os engenheiros adversários passaram a noite estudando o seu traçado.',
        choices: {
          regularidade: {
            label: 'Investir em sessões para repetir aquela volta sempre',
            outcomes: ['O investimento pesa no caixa, mas as voltas boas deixam de ser exceção.'],
          },
          divulgar: {
            label: 'Exibir a volta nas redes com o traçado desenhado',
            outcomes: [
              'O vídeo didático faz sucesso, e os patrocinadores adoram aparecer junto.',
              'O vídeo ensina demais: os adversários agradecem a aula, e a equipe não gosta nada disso.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'protesto-contra-a-frente',
    category: 'track',
    frequency: 'rare',
    when: [{ c: 'race', tag: 'points' }],
    needs: ['ahead'],
    choices: [
      {
        id: 'deixar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'protestar',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'grid', who: 'other', size: 2 },
              { e: 'rivalry', who: 'other', size: 2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'other', size: 2 },
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'insinuar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'rivalry', who: 'other', size: 1 },
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
    ],
    variants: [
      {
        title: 'Protesto contra o carro de {outro}?',
        body: '{outro} cruzou a linha logo à sua frente em {pista}, e o seu mecânico jura que o carro dele estava baixo demais. Dá tempo de entrar com protesto, mas protesto custa dinheiro e pode custar imagem.',
        choices: {
          deixar: {
            label: 'Cumprimentar {outro} e esquecer a desconfiança',
            outcomes: ['Você aperta a mão dele no parque fechado. Fica a imagem de esportividade, e a pulga atrás da orelha.'],
          },
          protestar: {
            label: 'Pagar a taxa e protestar contra o carro de {outro}',
            outcomes: [
              'A vistoria acha o carro dele abaixo da altura mínima. {outro} é punido no grid e jura que não esquece.',
              'A vistoria não encontra nada. Você perde a taxa, ganha um inimigo e vira assunto pelos motivos errados.',
            ],
          },
          insinuar: {
            label: 'Insinuar na entrevista que o carro dele é suspeito',
            outcomes: [
              'A insinuação planta a dúvida, e {outro} passa a semana se explicando. Você sai por cima.',
              '{outro} responde à altura, e os patrocinadores não gostam de ver você em polêmica sem prova.',
            ],
          },
        },
      },
      {
        title: 'A dúvida sobre o carro de {outro}',
        body: 'Você terminou logo atrás de {outro}, e ele andou demais na reta. No paddock, já tem gente cochichando sobre o assoalho do carro dele. O prazo para protestar acaba em meia hora.',
        choices: {
          deixar: {
            label: 'Deixar a suspeita de lado e focar no próprio carro',
            outcomes: ['Você prefere gastar energia com o seu acerto. A elegância é notada, embora a dúvida ainda incomode.'],
          },
          protestar: {
            label: 'Assinar o protesto antes que o prazo acabe',
            outcomes: [
              'Os fiscais desmontam o carro dele e acham uma peça fora da regra. Punição no grid, e um inimigo para a vida toda.',
              'O carro dele está dentro da regra, peça por peça. O dinheiro da taxa vai embora, junto com um pouco da sua reputação.',
            ],
          },
          insinuar: {
            label: 'Comentar no paddock que o assoalho dele é estranho',
            outcomes: [
              'O comentário corre, e {outro} passa o fim de semana na defensiva.',
              'O comentário chega a {outro}, que responde na imprensa, e um patrocinador seu pede que você pare com isso.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'bandeira-azul',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'race', tag: 'noPoints' },
    ],
    choices: [
      {
        id: 'ceder',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'defender',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
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
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Bandeira azul e a reclamação do líder',
        body: 'Você brigava por posição no fim do pelotão em {pista} quando a bandeira azul apareceu. A passagem só foi aberta duas curvas depois, e quem vinha na ponta reclamou no rádio do tempo perdido.',
        choices: {
          ceder: {
            label: 'Pedir desculpas ao líder da prova e rever o procedimento',
            outcomes: ['As desculpas são aceitas, e a direção de prova nem precisa intervir. Mas tomar volta dói no orgulho.'],
          },
          defender: {
            label: 'Explicar que você também disputava posição',
            outcomes: [
              'Os comissários entendem a situação e não fazem nada. Você sai com a sensação de ter defendido o seu espaço.',
              'Os comissários entendem que você demorou demais. Advertência e pontos na licença.',
            ],
          },
          partir: {
            label: 'Partir para cima: bandeira azul não é tapete vermelho',
            outcomes: [
              'A frase viraliza, e a turma do fundo do grid adota você como porta-voz. Os grandes da categoria torcem o nariz.',
              'A frase chega à direção de prova junto com a telemetria. Pontos na licença, e um sermão de quebra.',
            ],
          },
        },
      },
      {
        title: 'Tomando volta em {pista}',
        body: 'As bandeiras azuis apareceram cedo demais para o seu gosto. Você passou boa parte da prova olhando o retrovisor e abrindo caminho, e o box quer saber o que dá para mudar.',
        choices: {
          ceder: {
            label: 'Reconhecer que faltou ritmo e trabalhar nisso',
            outcomes: ['A humildade é bem vista no paddock. O ritmo vai melhorar com trabalho, mas a confiança sai arranhada.'],
          },
          defender: {
            label: 'Reclamar que abrir passagem tanto acabou com o seu ritmo',
            outcomes: [
              'A reclamação faz sentido para quem viu a prova, e você sai de cabeça em pé.',
              'A reclamação soa como desculpa, e a direção de prova lembra que você demorou em duas bandeiras azuis.',
            ],
          },
          partir: {
            label: 'Avisar no rádio que, na próxima, ninguém passa fácil',
            outcomes: [
              'O rádio vai ao ar, e a garra agrada quem gosta de briga. Os líderes, nem tanto.',
              'O rádio vai ao ar, e os comissários anotam a ameaça. Pontos na licença, só para lembrar.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'retardatarios',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'race', tag: 'podium' },
      { c: 'notRace', tag: 'win' },
    ],
    choices: [
      {
        id: 'relevar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'reclamar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O retardatário que não abriu',
        body: 'Você vinha para o pódio em {pista} quando um retardatário ignorou a bandeira azul por quase uma volta inteira. O tempo perdido não mudou o resultado, mas mudou o seu humor.',
        choices: {
          relevar: {
            label: 'Deixar para lá: o pódio está garantido',
            outcomes: ['Você comemora o pódio e deixa a reclamação para os comissários. O paddock elogia; a raiva fica guardada.'],
          },
          reclamar: {
            label: 'Cobrar em público a direção de prova pela bandeira azul',
            outcomes: [
              'A cobrança encontra eco entre os pilotos da frente, e você ganha voz no paddock.',
              'A cobrança soa arrogante para quem está no fundo do grid. Metade do pelotão passa a torcer contra você.',
            ],
          },
        },
      },
      {
        title: 'Trânsito na hora errada',
        body: 'Os retardatários surgiram justo quando você atacava a posição da frente em {pista}. Um hesitou, outro trocou de traçado, e a chance de subir mais um degrau no pódio evaporou.',
        choices: {
          relevar: {
            label: 'Aceitar que trânsito faz parte da corrida',
            outcomes: ['Você fala do pódio, não do trânsito. A postura agrada, mas a chance perdida volta à cabeça à noite.'],
          },
          reclamar: {
            label: 'Dizer que a categoria precisa punir quem não abre caminho',
            outcomes: [
              'Outros pilotos da ponta assinam embaixo, e a sua opinião ganha peso.',
              'A frase soa como desculpa de quem não soube passar. Os comentaristas não perdoam.',
            ],
          },
        },
      },
      {
        title: 'Passar retardatário também é arte',
        body: 'Em {pista}, você colocou volta em vários adversários e terminou no pódio. O engenheiro mostra que você perdeu mais tempo no trânsito que os rivais diretos, e quer conversar sobre isso.',
        choices: {
          relevar: {
            label: 'Ouvir a crítica do engenheiro sem culpar os retardatários',
            outcomes: ['A imprensa elogia quem ouve crítica com o troféu na mão. A festa, porém, perde um pouco da graça.'],
          },
          reclamar: {
            label: 'Culpar os retardatários pelo tempo perdido',
            outcomes: [
              'Os dados da direção de prova mostram dois retardatários lentos para abrir. Você tinha razão, e todo mundo fica sabendo.',
              'Os dados mostram que os outros passaram pelos mesmos retardatários sem drama. A reclamação pega mal.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'vacuo-na-reta',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'race', tag: 'points' },
    ],
    choices: [
      {
        id: 'treinar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'overtaking', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'acerto',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'form', size: -1 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'O vácuo que valeu a ultrapassagem',
        body: 'Na reta mais longa de {pista}, você grudou na traseira do carro da frente, pegou o vácuo e saiu de lado na freada. O engenheiro viu potencial ali e quer explorar mais.',
        choices: {
          treinar: {
            label: 'Passar horas no simulador estudando o vácuo',
            outcomes: ['As horas no simulador custam, mas você aprende a hora exata de sair do vácuo. A próxima reta já não será igual.'],
          },
          acerto: {
            label: 'Pedir menos asa para chegar mais forte na freada',
            outcomes: [
              'O carro vira uma flecha na reta e ainda segura bem nas curvas. Aposta certa.',
              'O carro voa na reta, mas escorrega nas curvas. O que se ganha num lugar se perde no outro.',
            ],
          },
        },
      },
      {
        title: 'A reta, o vácuo e a freada',
        body: 'A corrida em {pista} mostrou que você sabe usar o vácuo: duas ultrapassagens no fim da reta, as duas iguais. Os rivais já perceberam, e na próxima vão se defender por dentro.',
        choices: {
          treinar: {
            label: 'Treinar outras formas de sair do vácuo',
            outcomes: ['O treino extra pesa no orçamento, mas agora você tem mais de um jeito de atacar no fim da reta.'],
          },
          acerto: {
            label: 'Apostar num acerto de pouca pressão aerodinâmica',
            outcomes: [
              'A aposta funciona, e o carro chega embalado ao fim de cada reta.',
              'A aposta não funciona: sem pressão aerodinâmica, o carro sai de traseira nas curvas lentas.',
            ],
          },
        },
      },
      {
        title: 'Caçando vácuo na reta principal',
        body: 'Você passou a corrida em {pista} caçando o vácuo de quem estivesse na frente. Funcionou mais de uma vez, e o engenheiro quer saber se dá para transformar isso numa arma.',
        choices: {
          treinar: {
            label: 'Pedir ao engenheiro um estudo de cada reta do calendário',
            outcomes: ['O estudo consome horas pagas de simulador, mas você passa a saber onde o vácuo rende mais em cada pista.'],
          },
          acerto: {
            label: 'Testar uma asa traseira mais baixa na próxima etapa',
            outcomes: [
              'Com menos asa, o carro ganha velocidade final sem perder muito nas curvas. Arma pronta.',
              'Menos asa, mais velocidade de reta, e um carro nervoso demais nas curvas rápidas.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'recado-do-lider',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'standing', in: 'top5', out: 'leader' }],
    needs: ['leader'],
    choices: [
      {
        id: 'ignorar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'leader', size: 1 },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'responder',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'rivalry', who: 'leader', size: 2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'leader', size: 2 },
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
              { e: 'rivalry', who: 'leader', size: 3 },
              { e: 'stat', stat: 'confidence', size: 2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'leader', size: 3 },
              { e: 'penaltyPoints', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O líder mandou um recado',
        body: 'Na coletiva, perguntaram a {lider} sobre você. Ele sorriu, disse que respeita todo mundo, mas que campeonato se ganha com regularidade, não com uma corrida boa de vez em quando.',
        choices: {
          ignorar: {
            label: 'Avisar que a resposta virá na pista',
            outcomes: ['A frase curta corre o paddock. A provocação vira combustível nos treinos, e {lider} entende que a briga é séria.'],
          },
          responder: {
            label: 'Lembrar a todos as corridas que ele jogou fora',
            outcomes: [
              'A resposta afiada faz sucesso, e você entra de vez na briga pelo título. {lider} sente o golpe.',
              'A troca de farpas vira novela, e os patrocinadores pedem menos boca e mais resultado.',
            ],
          },
          partir: {
            label: 'Partir para cima de {lider} no corredor do paddock',
            outcomes: [
              'Você para na frente dele e fala olho no olho. Ele gagueja, e o paddock inteiro fica sabendo quem não tem medo de quem.',
              'O bate-boca vira empurrão, e os comissários convocam os dois. Para você, sobra a parte mais pesada.',
            ],
          },
        },
      },
      {
        title: '{lider} duvida de você na briga pelo título',
        body: 'Em entrevista a um canal de esportes, {lider} disse que você tem velocidade, mas ainda não sabe brigar por título. A frase está em todo lugar, inclusive no grupo da sua equipe.',
        choices: {
          ignorar: {
            label: 'Deixar a frase sem resposta e treinar em dobro',
            outcomes: ['O silêncio irrita {lider} mais que qualquer resposta. Você ganha ritmo nos treinos, e a briga fica mais pessoal.'],
          },
          responder: {
            label: 'Responder que ele está com medo de perder a liderança',
            outcomes: [
              'A resposta vira manchete, e a torcida adora. {lider} perde a pose de favorito.',
              'A resposta soa como provocação barata, e um patrocinador liga pedindo cuidado com a imagem.',
            ],
          },
          partir: {
            label: 'Ir até a equipe de {lider} tirar satisfação pessoalmente',
            outcomes: [
              'A visita surpresa deixa {lider} sem resposta. A mensagem chega ao paddock inteiro.',
              'A visita termina em discussão aos gritos. A direção de prova fica sabendo, e a punição sobra para você.',
            ],
          },
        },
      },
      {
        title: 'Guerra fria com o líder do campeonato',
        body: '{lider} parou de cumprimentar você no paddock e passou a se defender com dureza sempre que os dois se encontram na pista. A briga pelo campeonato virou coisa pessoal.',
        choices: {
          ignorar: {
            label: 'Manter o cumprimento, mesmo sem resposta',
            outcomes: ['Você segue estendendo a mão. Ele segue ignorando, e cada recusa vira motivação no seu treino.'],
          },
          responder: {
            label: 'Contar aos jornalistas que {lider} não cumprimenta mais ninguém',
            outcomes: [
              'A história pega, e {lider} passa a ser visto como mau perdedor. Você sobe na conversa.',
              'A história pega, mas contra você: parece fofoca, e os patrocinadores torcem o nariz.',
            ],
          },
          partir: {
            label: 'Encarar {lider} no briefing dos pilotos',
            outcomes: [
              'Na frente de todo o grid, você pergunta qual é o problema. Ele não responde, e o recado está dado.',
              'O briefing vira bate-boca, e o diretor de prova pune quem começou: você.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'estreia-na-categoria',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'categoryDebut' }, { c: 'season', part: 'early' }],
    choices: [
      {
        id: 'ouvir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'experience', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ousar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'palco',
        requires: [{ c: 'trait', trait: 'bigStage' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Primeiras corridas {categoria:em}',
        body: 'Tudo é novo: o equipamento, o paddock, os adversários que já sabem o nome de todos os fiscais. Depois de {pista}, um mecânico experiente puxa você de lado para dar um conselho.',
        choices: {
          ouvir: {
            label: 'Ouvir o conselho do mecânico com atenção',
            outcomes: ['O conselho é simples: menos pressa, mais quilometragem. Você aprende rápido, mesmo com a sensação de estar sempre um passo atrás.'],
          },
          ousar: {
            label: 'Agradecer e dizer que veio para brigar lá na frente',
            outcomes: [
              'A frase chega aos ouvidos certos, e o paddock passa a olhar você com outros olhos.',
              'A frase soa arrogante para quem está ali há anos. Os mecânicos trocam olhares, e a confiança balança.',
            ],
          },
          palco: {
            label: 'Dizer que estreia sempre foi o seu palco favorito',
            outcomes: ['Você trata a novidade como festa, e o carro responde. No paddock, já perguntam de onde saiu esse talento.'],
          },
        },
      },
      {
        title: 'Novidade no paddock {categoria:de}',
        body: 'Ninguém sabe muito sobre você ainda. Em {pista}, os adversários testaram os seus limites na pista e na conversa. Os primeiros meses vão definir como o paddock vai enxergar você.',
        choices: {
          ouvir: {
            label: 'Observar os veteranos antes de falar qualquer coisa',
            outcomes: ['Você passa as primeiras etapas mais de ouvido que de boca. Aprende muito, embora alguns confundam a discrição com timidez.'],
          },
          ousar: {
            label: 'Chegar chegando e brigar por cada centímetro desde já',
            outcomes: [
              'Os adversários aprendem logo que você não cede espaço, e o respeito vem rápido.',
              'Brigar com todo mundo cobra o seu preço: a equipe pede calma, e os resultados não ajudam.',
            ],
          },
          palco: {
            label: 'Aproveitar a estreia para mostrar do que é capaz',
            outcomes: ['A estreia acende algo em você. Os tempos aparecem, e o paddock anota o seu nome.'],
          },
        },
      },
      {
        title: 'Tudo novo, menos a vontade',
        body: 'Primeira temporada {categoria:em}, e cada etapa traz uma lição. Depois de {pista}, o engenheiro sugere ir com calma; o seu instinto diz o contrário.',
        choices: {
          ouvir: {
            label: 'Seguir o engenheiro e somar quilometragem',
            outcomes: ['Volta a volta, a experiência chega. Falta um pouco de brilho, mas sobra base para o resto do ano.'],
          },
          ousar: {
            label: 'Seguir o instinto e atacar desde a primeira volta',
            outcomes: [
              'O instinto estava certo: você surpreende e chama a atenção de quem importa.',
              'O instinto engana: os erros se acumulam, e o engenheiro passa a duvidar das suas decisões.',
            ],
          },
          palco: {
            label: 'Confiar que as estreias sempre tiraram o seu melhor',
            outcomes: ['Como sempre, a novidade puxa o seu melhor. A confiança dispara, e o paddock começa a falar de você.'],
          },
        },
      },
    ],
  },
  /* ---------------- Correndo pela equipe da família (Fase 6) ---------------- */

  {
    id: 'companheiro-reclama-de-favorecimento',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'familyTeam' },
      { c: 'race', tag: 'beatTeammate' },
    ],
    needs: ['teammate'],
    choices: [
      {
        id: 'abrir-os-dados',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: 2 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'responder-na-pista',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Carro igual?',
        body: '{companheiro} terminou atrás de você em {pista} e reclamou no rádio, para quem quisesse ouvir, que o carro da família não é igual para os dois.',
        choices: {
          'abrir-os-dados': {
            label: 'Oferecer a {companheiro} acesso a todos os seus dados',
            outcomes: ['Os dados mostram carros iguais e uma diferença de pilotagem. A relação melhora, mas a dúvida fica na sua cabeça.'],
          },
          'responder-na-pista': {
            label: 'Dizer que a resposta vem na pista',
            outcomes: ['A frase rende manchete e confiança, mas {companheiro} passa a evitar você no box.'],
          },
        },
      },
      {
        title: 'Suspeita no box',
        body: 'Depois da corrida em {pista}, {companheiro} pede uma reunião para conferir se as peças novas foram só para o seu carro. A equipe é da sua família, e a suspeita pega mal.',
        choices: {
          'abrir-os-dados': {
            label: 'Pedir aos engenheiros que mostrem tudo a {companheiro}',
            outcomes: ['A transparência acalma o box. A reunião termina sem argumento contra você, e com a sensação de ter que provar algo a cada etapa.'],
          },
          'responder-na-pista': {
            label: 'Deixar a reunião acontecer sem você',
            outcomes: ['A reunião termina sem conclusão. A confiança no seu ritmo aumenta, e o clima com {companheiro} esfria.'],
          },
        },
      },
    ],
  },
  {
    id: 'atras-do-companheiro-na-equipe-da-familia',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'familyTeam' },
      { c: 'race', tag: 'behindTeammate' },
    ],
    needs: ['teammate'],
    choices: [
      {
        id: 'admitir-o-dia-ruim',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'culpar-o-acerto',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Atrás do companheiro, na equipe da família',
        body: '{companheiro} terminou na sua frente em {pista}. Na equipe que é da sua família, o resultado vira pergunta: quem está ali por mérito?',
        choices: {
          'admitir-o-dia-ruim': {
            label: 'Admitir que {companheiro} andou melhor hoje',
            outcomes: ['A sinceridade ganha pontos com a imprensa, mas engolir a derrota em casa custa caro por dentro.'],
          },
          'culpar-o-acerto': {
            label: 'Dizer que o seu acerto não estava bom',
            outcomes: [
              'Os engenheiros encontram de fato um problema no acerto, e a explicação convence.',
              'A desculpa soa conveniente na equipe da família, e os mecânicos não gostam de levar a culpa.',
            ],
          },
        },
      },
      {
        title: 'O placar interno',
        body: 'O quadro de tempos no box mostra {companheiro} à frente em {pista}. Alguém da imprensa pergunta se a escalação da equipe da família seria a mesma com um chefe de fora.',
        choices: {
          'admitir-o-dia-ruim': {
            label: 'Responder que escalação se discute com resultado',
            outcomes: ['A resposta honesta é bem recebida, e a pressão passa a ser sua de vez.'],
          },
          'culpar-o-acerto': {
            label: 'Apontar a estratégia de pneus como o problema',
            outcomes: [
              'A análise mostra que a estratégia pesou mesmo, e a conversa muda de rumo.',
              'A estratégia era igual para os dois carros, e a imprensa não perdoa a desculpa.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'box-dividido-na-equipe-da-familia',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'has', what: 'familyTeam' }],
    needs: ['teammate'],
    choices: [
      {
        id: 'juntar-o-box',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'manter-distancia',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O box dividido',
        body: 'Na equipe da família, os mecânicos cochicham: uns acham que você manda mais do que devia, outros acham que você nem precisava estar ali. {companheiro} finge que não ouve.',
        choices: {
          'juntar-o-box': {
            label: 'Pagar um jantar para todo o box e conversar',
            outcomes: ['O jantar quebra o gelo. As piadas sobre o sobrenome viram brincadeira de verdade, e a conta fica com você.'],
          },
          'manter-distancia': {
            label: 'Manter a distância e deixar o volante falar',
            outcomes: ['O foco no carro traz confiança, mas o cochicho no box não para.'],
          },
        },
      },
      {
        title: 'Quem manda no box?',
        body: 'Um mecânico antigo da equipe da família pergunta, meio de brincadeira, se agora precisa pedir autorização a você para trocar um pneu. O box inteiro ri, menos {companheiro}.',
        choices: {
          'juntar-o-box': {
            label: 'Rir junto e chamar todo mundo para um churrasco',
            outcomes: ['O churrasco aproxima o box, e até {companheiro} aparece no fim. O carvão e a carne saem do seu bolso.'],
          },
          'manter-distancia': {
            label: 'Responder que manda só no próprio carro',
            outcomes: ['A resposta encerra a brincadeira e reforça a sua confiança. O box, porém, fica mais frio.'],
          },
        },
      },
    ],
  },
];
