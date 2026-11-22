/**
 * Eventos de pista, lado técnico (Fase 5): peça nova, vistoria técnica, acerto, pneus, chuva,
 * motor, testes e engenheiros. Somam ao peso da categoria pista (STORY_EVENTS.CATEGORY_WEIGHTS).
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 *
 * Memória deste arquivo: a marca `tec-brecha-no-regulamento` é deixada por quem explora a brecha do
 * regulamento técnico (`regulamento-tecnico-novo`) e lida pelo protesto que vem depois
 * (`brecha-denunciada`), que a apaga em qualquer desfecho.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const TRACK_TECH_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'peca-nova-unidade-unica',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 4 }],
    needs: ['teammate'],
    choices: [
      {
        id: 'pedir',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ceder',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'volta',
        requires: [{ c: 'trait', trait: 'qualifyingKing' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma asa nova para dois carros',
        body: 'Chegou da fábrica a asa dianteira nova, mas só uma unidade. O engenheiro-chefe quer saber se ela vai para o seu carro ou para o de {companheiro} na próxima etapa.',
        choices: {
          pedir: {
            label: 'Pedir a asa nova para o seu carro',
            outcomes: [
              'A asa vai para o seu carro. {companheiro} não diz nada, mas passa a almoçar longe de você.',
              'A diretoria decide o contrário e ainda estranha a cobrança. A asa vai para o outro lado do box.',
            ],
          },
          ceder: {
            label: 'Deixar a asa com {companheiro} desta vez',
            outcomes: ['{companheiro} agradece pelo rádio, a equipe registra o gesto e você corre com a peça velha.'],
          },
          volta: {
            label: 'Propor que leve a asa quem fizer a melhor volta',
            outcomes: ['Uma volta lançada resolve a questão a seu favor. {companheiro} reclama, mas não discute com o cronômetro.'],
          },
        },
      },
      {
        title: 'O assoalho que só deu para um',
        body: 'O fornecedor atrasou e só um assoalho novo ficou pronto a tempo. Na reunião de sexta-feira, todos olham para você e para {companheiro}.',
        choices: {
          pedir: {
            label: 'Defender que o assoalho vá para o seu carro',
            outcomes: [
              'Os argumentos convencem: o assoalho é seu. O clima com {companheiro} esfria na mesma hora.',
              'O chefe escuta, agradece e manda o assoalho para o carro de {companheiro}. Você sai da sala de cara fechada.',
            ],
          },
          ceder: {
            label: 'Abrir mão do assoalho pelo bem da equipe',
            outcomes: ['O gesto vira assunto na oficina. {companheiro} fica devendo uma, e você anda com o assoalho antigo.'],
          },
          volta: {
            label: 'Sugerir que a classificação decida quem leva',
            outcomes: ['Você crava a volta que precisava e leva o assoalho. Contra o relógio, ninguém tem argumento.'],
          },
        },
      },
      {
        title: 'Difusor novo, vaga única',
        body: 'Um difusor redesenhado chegou numa caixa de madeira, sem par. Os mecânicos esperam a decisão para saber em qual carro vão trabalhar a madrugada inteira.',
        choices: {
          pedir: {
            label: 'Pedir aos mecânicos que montem o difusor no seu carro',
            outcomes: [
              'Os mecânicos viram a noite no seu carro. {companheiro} fica sabendo pela manhã e não gosta nada.',
              'O chefe desautoriza o pedido na frente de todos: o difusor vai para {companheiro}.',
            ],
          },
          ceder: {
            label: 'Mandar montar o difusor no carro de {companheiro}',
            outcomes: ['{companheiro} estranha a gentileza e depois agradece. No box, o ambiente melhora; na pista, a falta da peça aparece.'],
          },
          volta: {
            label: 'Apostar o difusor num desafio de volta lançada',
            outcomes: ['O desafio dura uma volta e termina com o seu nome no topo da folha de tempos.'],
          },
        },
      },
    ],
  },
  {
    id: 'vistoria-pos-corrida-pontos',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'points' }],
    needs: ['roundPoints'],
    choices: [
      {
        id: 'acompanhar',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'reputation', size: 1 }] },
          {
            odds: 'rest',
            effects: [{ e: 'losePoints' }, { e: 'stat', stat: 'reputation', size: 1 }, { e: 'stat', stat: 'morale', size: -1 }],
          },
        ],
      },
      {
        id: 'contestar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [{ e: 'losePoints' }, { e: 'cash', size: -1, cap: true }, { e: 'stat', stat: 'reputation', size: -1 }],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Seu carro foi lacrado para vistoria',
        body: 'Mal acaba a corrida em {pista} e os fiscais lacram o seu carro para a vistoria técnica. Os {pontos} da etapa ficam pendurados até a medição sair.',
        choices: {
          acompanhar: {
            label: 'Acompanhar a vistoria ao lado do fiscal',
            outcomes: [
              'Tudo dentro do regulamento. O fiscal ainda elogia a organização do box.',
              'Uma peça passa do limite por um fio. Os pontos vão embora, mas o paddock nota a sua postura.',
            ],
          },
          contestar: {
            label: 'Mandar a equipe contestar o método de medição',
            outcomes: [
              'O recurso cola: a medição é refeita e o carro passa. A equipe comemora como se fosse outra vitória.',
              'O recurso afunda, a taxa de protesto fica com a federação e os pontos somem do mesmo jeito.',
            ],
          },
        },
      },
      {
        title: 'Fiscais rondando o seu box',
        body: 'Os comissários técnicos querem desmontar parte do seu equipamento antes de homologar o resultado. Estão em jogo os {pontos} que você acabou de somar.',
        choices: {
          acompanhar: {
            label: 'Entregar as ferramentas e deixar os fiscais trabalharem',
            outcomes: [
              'Duas horas de desmontagem e nenhuma irregularidade. O resultado sai homologado no fim da tarde.',
              'Os fiscais acham uma folga fora da tabela. O resultado cai, mas ninguém pode dizer que você escondeu alguma coisa.',
            ],
          },
          contestar: {
            label: 'Exigir que a desmontagem seja filmada do começo ao fim',
            outcomes: [
              'As imagens mostram um erro do próprio fiscal. O resultado fica, e a equipe ganha moral.',
              'As imagens só comprovam a irregularidade. Você perde os pontos e ainda paga pelo recurso.',
            ],
          },
        },
      },
      {
        title: 'Pesagem extra no fim da tarde',
        body: 'Um fiscal pede para pesar de novo o seu carro, desta vez com você dentro. A balança decide se os {pontos} de hoje continuam na tabela.',
        choices: {
          acompanhar: {
            label: 'Subir na balança sem reclamar',
            outcomes: [
              'O peso bate com folga. Você desce da balança e vai direto para o lanche.',
              'Faltou peso por quase nada. Os pontos ficam pelo caminho, e os fiscais anotam a sua calma.',
            ],
          },
          contestar: {
            label: 'Pedir que calibrem a balança antes da pesagem',
            outcomes: [
              'A balança estava descalibrada, e a nova pesagem confirma o resultado.',
              'A balança estava certa. Além dos pontos, vai embora o dinheiro da taxa de recurso.',
            ],
          },
        },
      },
      {
        title: 'Combustível na mira dos fiscais',
        body: 'Os fiscais recolheram uma amostra do combustível do seu tanque logo depois da bandeirada. Se a análise der errado, os {pontos} conquistados em {pista} vão para o lixo.',
        choices: {
          acompanhar: {
            label: 'Acompanhar a coleta e assinar o termo',
            outcomes: [
              'A análise volta limpa. O resultado fica, e o fiscal-chefe aperta a sua mão.',
              'A amostra acusa uma mistura fora da regra. Ninguém duvida da sua boa-fé, mas os pontos caem.',
            ],
          },
          contestar: {
            label: 'Exigir a contraprova num laboratório independente',
            outcomes: [
              'A contraprova desmente a primeira análise. Os pontos voltam, e a equipe respira aliviada.',
              'A contraprova confirma o problema, e a conta do laboratório chega junto com a punição.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'vistoria-surpresa-no-box',
    category: 'track',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'abrir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'driblar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'grid', who: 'player', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Fiscal na porta do box',
        body: 'Antes do primeiro treino, um fiscal técnico aparece com uma prancheta e uma lista de peças para conferir no seu carro. A sessão começa em meia hora.',
        choices: {
          abrir: {
            label: 'Abrir o carro inteiro para o fiscal',
            outcomes: ['Tudo certo, mas você perde metade do treino com o carro desmontado.'],
          },
          driblar: {
            label: 'Pedir para conferir só depois do treino',
            outcomes: ['O fiscal concorda, e você aproveita a sessão inteira.', 'O fiscal entende o pedido como desaforo e manda você largar mais atrás.'],
          },
        },
      },
      {
        title: 'O lacre que parecia frouxo',
        body: 'A direção técnica sorteou o seu box para conferir os lacres do motor. O chefe dos mecânicos coça a cabeça: um dos lacres parece frouxo.',
        choices: {
          abrir: {
            label: 'Chamar o fiscal e mostrar o lacre frouxo',
            outcomes: ['O fiscal agradece a honestidade, troca o lacre e segue. A troca come o seu tempo de pista.'],
          },
          driblar: {
            label: 'Apertar o lacre antes que alguém pergunte',
            outcomes: [
              'Ninguém repara, e você treina sem perder um minuto.',
              'O fiscal vê o alicate na mão do mecânico. Punição no grid e cochichos no paddock.',
            ],
          },
        },
      },
      {
        title: 'Medidas conferidas na véspera',
        body: 'Os fiscais resolveram conferir as medidas de todos os carros na véspera da prova, e o seu é o primeiro da fila. A equipe tinha planejado mexer no acerto justamente agora.',
        choices: {
          abrir: {
            label: 'Liberar o carro e refazer o planejamento',
            outcomes: ['O carro passa sem problemas, mas o acerto planejado fica para outra vez.'],
          },
          driblar: {
            label: 'Pedir para mexer no acerto antes da medição',
            outcomes: [
              'Os fiscais esperam, e o ajuste fica pronto a tempo.',
              'O pedido irrita a direção técnica, e o seu nome desce algumas posições no grid.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'engenheiro-acerto-experimental',
    category: 'track',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'testar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'conhecido',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'agressivo',
        requires: [{ c: 'trait', trait: 'tyreSaver' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'form', size: -1 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'O engenheiro tem uma ideia maluca',
        body: 'Seu engenheiro passou a noite em claro e chegou com uma folha de acerto que ninguém nunca usou nesta pista. Quer testar no próximo treino, no seu carro.',
        choices: {
          testar: {
            label: 'Topar a experiência no próximo treino',
            outcomes: [
              'A ideia funciona melhor do que ele mesmo esperava, e a equipe guarda o acerto a sete chaves.',
              'O carro fica impossível de guiar e a sessão vai embora desfazendo a ideia. Pelo menos o engenheiro gostou da sua coragem.',
            ],
          },
          conhecido: {
            label: 'Ficar com o acerto que já funciona',
            outcomes: ['Você anda no ritmo de sempre. O engenheiro guarda a folha de volta na pasta, contrariado.'],
          },
          agressivo: {
            label: 'Pedir uma versão ainda mais agressiva, que o pneu aguenta',
            outcomes: [
              'Você segura a borracha como poucos, e o acerto agressivo vira tempo de volta.',
              'Desta vez nem o seu pé leve salva os pneus, e o treino termina com a borracha em frangalhos.',
            ],
          },
        },
      },
      {
        title: 'O engenheiro quer mexer em tudo',
        body: 'Na reunião técnica, o engenheiro propõe mudar a altura, a bitola e a relação de marcha de uma vez só. Ou dá muito certo, ou o treino vai embora.',
        choices: {
          testar: {
            label: 'Deixar o engenheiro mexer em tudo de uma vez',
            outcomes: [
              'Dá muito certo: o carro ganha tração na saída das curvas, e o acerto vai para a pasta da equipe.',
              'Dá errado: são mudanças demais para entender o que piorou. O engenheiro agradece por você ter topado.',
            ],
          },
          conhecido: {
            label: 'Pedir que ele mude uma coisa de cada vez',
            outcomes: ['O treino rende o esperado, sem surpresas. O engenheiro concorda, mas com cara de quem queria mais.'],
          },
          agressivo: {
            label: 'Aceitar desde que o acerto puxe pelos pneus',
            outcomes: [
              'O carro fica arisco, mas quem poupa pneu como você transforma isso em velocidade.',
              'Os pneus não aguentam o castigo, nem com todo o seu cuidado. Fica a lição.',
            ],
          },
        },
      },
      {
        title: 'Teste às cegas no treino livre',
        body: 'A engenheira de pista quer mandar você para a pista sem contar o que mudou no acerto. Assim, diz ela, a sua opinião sai sem vício.',
        choices: {
          testar: {
            label: 'Aceitar guiar sem saber o que mudou',
            outcomes: [
              'Você descreve cada mudança como se tivesse lido a planilha. A engenheira sorri e aproveita tudo.',
              'Você não sente diferença nenhuma, e a sessão termina sem conclusão. Ela anota que você topou o jogo.',
            ],
          },
          conhecido: {
            label: 'Exigir saber o que mudou antes de sair',
            outcomes: ['Ela mostra a planilha, você sai para a pista com a cabeça no lugar e o treino rende. Só a engenheira fica frustrada.'],
          },
          agressivo: {
            label: 'Pedir uma surpresa que castigue os pneus',
            outcomes: [
              'O acerto castiga a borracha, e você administra cada volta sem perder ritmo. A engenheira fica impressionada.',
              'O castigo é demais até para quem sabe poupar pneu, e o treino termina mais cedo.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'pneus-esfarelados',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'notRace', tag: 'dnf' },
      { c: 'notRace', tag: 'absent' },
      { c: 'notRace', tag: 'win' },
    ],
    choices: [
      {
        id: 'estudar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'tyreManagement', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'desculpa',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'assumir',
        requires: [{ c: 'trait', trait: 'tyreEater' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'tyreManagement', size: 2 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Pneus que voltaram em pedaços',
        body: 'Depois da corrida em {pista}, o engenheiro põe os seus pneus na bancada. A borracha está granulada e gasta de um lado só, sinal de quem pediu demais deles.',
        choices: {
          estudar: {
            label: 'Passar a tarde estudando o desgaste com o engenheiro',
            outcomes: ['A tarde de folga vai embora, mas você entende onde estava matando a borracha.'],
          },
          desculpa: {
            label: 'Culpar a calibragem, não o seu pé',
            outcomes: [
              'Os dados confirmam: a calibragem estava errada. A culpa sai das suas costas.',
              'Os dados mostram o contrário, e o engenheiro não esconde a irritação.',
            ],
          },
          assumir: {
            label: 'Admitir que você come pneu e pedir um plano',
            outcomes: ['Dói admitir o defeito em voz alta, mas o engenheiro monta um programa só para você aprender a poupar borracha.'],
          },
        },
      },
      {
        title: 'A borracha pediu socorro',
        body: 'Nas últimas voltas em {pista}, o carro escorregava como sabão. Agora a planilha mostra por quê: você castigou os pneus traseiros desde a largada.',
        choices: {
          estudar: {
            label: 'Rever volta a volta onde a traseira foi embora',
            outcomes: ['Você descobre que acelerava cedo demais em duas curvas. Uma noite de vídeos, uma lição para a vida.'],
          },
          desculpa: {
            label: 'Culpar o lote de pneus, que veio ruim',
            outcomes: [
              'Outros pilotos reclamam do mesmo lote, e a sua tese ganha força.',
              'Ninguém mais reclamou do lote. Fica parecendo desculpa, e a equipe nota.',
            ],
          },
          assumir: {
            label: 'Confessar que a sua tocada sempre castigou os pneus',
            outcomes: ['A equipe agradece a franqueza e monta um treino de economia de borracha. O orgulho arranha, a tocada melhora.'],
          },
        },
      },
      {
        title: 'O desenho do desgaste não mente',
        body: 'O engenheiro mostra a foto da banda de rodagem: gasta por dentro, intacta por fora. Para ele, a culpa é do seu jeito de entrar nas curvas.',
        choices: {
          estudar: {
            label: 'Pedir para treinar um traçado que poupe os pneus',
            outcomes: ['O traçado novo parece lento no começo, mas a borracha passa a durar mais. Você abre mão do sábado para aprender.'],
          },
          desculpa: {
            label: 'Argumentar que foi o acerto, não a sua tocada',
            outcomes: [
              'O engenheiro revê o acerto e acha um erro na cambagem. A razão estava com você.',
              'O acerto estava perfeito, e o engenheiro passa a duvidar das suas desculpas.',
            ],
          },
          assumir: {
            label: 'Assumir o defeito e pedir para trabalhar nele',
            outcomes: ['Você assume que gasta pneu como ninguém. A partir de hoje, cada treino tem um exercício para isso.'],
          },
        },
      },
    ],
  },
  {
    id: 'licoes-da-chuva',
    category: 'track',
    frequency: 'common',
    when: [
      { c: 'race', tag: 'wet' },
      { c: 'notRace', tag: 'dnf' },
      { c: 'notRace', tag: 'absent' },
    ],
    choices: [
      {
        id: 'rever',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'wetSkill', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'secar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'chover',
        requires: [{ c: 'trait', trait: 'rainMaster' }],
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
    ],
    variants: [
      {
        title: 'Lições de um domingo encharcado',
        body: 'A chuva em {pista} transformou a corrida numa loteria. O engenheiro quer rever cada volta no molhado ainda hoje, antes que a memória seque.',
        choices: {
          rever: {
            label: 'Rever as voltas no molhado com o engenheiro',
            outcomes: ['Três horas de vídeo depois, você entende onde a água roubava aderência. A noite de descanso fica para outro dia.'],
          },
          secar: {
            label: 'Secar o macacão e deixar a análise para depois',
            outcomes: ['Você dorme como pedra. O engenheiro faz a análise sem você e não esconde o desânimo.'],
          },
          chover: {
            label: 'Avisar que, se chover de novo, a corrida é sua',
            outcomes: [
              'A frase corre o paddock, e ninguém duvida: na chuva, você anda em outro planeta.',
              'A frase soa como bravata, e a equipe pede menos discurso e mais volta.',
            ],
          },
        },
      },
      {
        title: 'O dilúvio de domingo',
        body: 'Choveu do começo ao fim. Uns rodaram, outros abandonaram, e você terminou com o macacão encharcado e muita coisa para contar à engenharia.',
        choices: {
          rever: {
            label: 'Ficar no box anotando cada poça da pista',
            outcomes: ['Você anota onde a água empoçava e por onde passava o traçado mais seco. Na próxima chuva, vai saber.'],
          },
          secar: {
            label: 'Ir direto para o hotel tomar um banho quente',
            outcomes: ['O banho quente é a melhor parte do dia. A reunião de análise acontece sem você, e a equipe repara.'],
          },
          chover: {
            label: 'Pedir aos mecânicos um acerto de chuva só seu',
            outcomes: [
              'Os mecânicos topam: quem anda assim no molhado merece um acerto sob medida.',
              'O pedido atrapalha o trabalho do box, e o chefe pede menos estrelismo.',
            ],
          },
        },
      },
      {
        title: 'Água, spray e nenhuma visibilidade',
        body: 'Na reta, não se via nada além do spray do carro da frente. Terminar a corrida em {pista} já valeu respeito, e a equipe quer entender como guiar melhor assim.',
        choices: {
          rever: {
            label: 'Estudar a câmera de bordo com a equipe',
            outcomes: ['A câmera mostra que você tirava o pé cedo demais no spray. A lição fica, o cansaço também.'],
          },
          secar: {
            label: 'Pedir um dia de folga para esquecer a chuva',
            outcomes: ['A folga recarrega as energias, mas o engenheiro queria você na reunião e não disfarça.'],
          },
          chover: {
            label: 'Dizer aos jornalistas que reza por chuva toda semana',
            outcomes: [
              'A manchete do dia é sua: quem reza por chuva. Os rivais passam a olhar para o céu.',
              'A manchete pega mal dentro da equipe, que prefere vencer no seco também.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'chuva-na-previsao',
    category: 'track',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'treinar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'wetSkill', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'ignorar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'confessar',
        requires: [{ c: 'trait', trait: 'rainFear' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'wetSkill', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Nuvens carregadas na previsão',
        body: 'A meteorologia promete chuva forte para a próxima etapa. A equipe pergunta se você quer pagar uma tarde de treino com a pista molhada.',
        choices: {
          treinar: {
            label: 'Pagar a tarde de treino no molhado',
            outcomes: ['A tarde custa caro, mas você volta entendendo melhor onde a água engana.'],
          },
          ignorar: {
            label: 'Apostar que a previsão vai errar',
            outcomes: [
              'A previsão erra mesmo, e você ganha uns dias de sossego.',
              'A previsão acerta em cheio, e a dúvida fica martelando a sua cabeça a semana inteira.',
            ],
          },
          confessar: {
            label: 'Contar ao engenheiro que a chuva tira o seu sono',
            outcomes: ['O engenheiro agradece a confiança e monta um plano para o molhado. Dizer em voz alta não foi fácil.'],
          },
        },
      },
      {
        title: 'Radar vermelho para o fim de semana',
        body: 'O radar mostra uma frente fria chegando junto com a próxima corrida. No grupo da equipe, já tem mecânico separando os pneus de chuva.',
        choices: {
          treinar: {
            label: 'Treinar no kartódromo com a pista molhada',
            outcomes: ['Molhar a pista do kartódromo custa uma taxa extra, mas cada volta ensina alguma coisa.'],
          },
          ignorar: {
            label: 'Dizer que chuva é igual para todo mundo',
            outcomes: [
              'A frente fria desvia no último dia. A sua calma parece sabedoria.',
              'A frente fria chega, e você passa a semana olhando para o céu sem saber o que fazer.',
            ],
          },
          confessar: {
            label: 'Pedir ajuda, que o molhado ainda assusta você',
            outcomes: ['O chefe dos mecânicos conta que também tinha medo de chuva no começo. Vocês combinam um treino só para isso.'],
          },
        },
      },
      {
        title: 'A chuva que todo mundo teme',
        body: 'Os meteorologistas já falam em temporal para a próxima etapa. O treinador de pilotagem oferece uma aula particular de pista molhada, cobrada à parte.',
        choices: {
          treinar: {
            label: 'Contratar a aula particular de pista molhada',
            outcomes: ['O treinador corrige a posição das suas mãos no volante e o jeito de frear no molhado. Valeu cada centavo.'],
          },
          ignorar: {
            label: 'Recusar a aula e torcer pelo sol',
            outcomes: [
              'O sol aparece no fim de semana, e você economiza o dinheiro e a aflição.',
              'O temporal chega como prometido, e você só pensa na aula que recusou.',
            ],
          },
          confessar: {
            label: 'Admitir ao treinador que a chuva ainda trava você',
            outcomes: ['O treinador já viu muita gente travar no molhado. Passa exercícios para a semana, e o primeiro passo foi admitir.'],
          },
        },
      },
    ],
  },
  {
    id: 'quebra-na-corrida',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'race', tag: 'mechanical' }],
    choices: [
      {
        id: 'apoiar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'morale', size: -1 },
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
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'bancar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'car', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A quebra que ninguém viu chegando',
        body: 'O carro morreu em {pista} sem aviso, bem quando você brigava por posição. No box, os mecânicos olham para o chão.',
        choices: {
          apoiar: {
            label: 'Consolar os mecânicos e cobrar só em particular',
            outcomes: ['Os mecânicos não esquecem o gesto. A frustração fica guardada para a sua noite de insônia.'],
          },
          cobrar: {
            label: 'Cobrar do chefe uma explicação na frente de todos',
            outcomes: [
              'A bronca surte efeito: a equipe revisa os procedimentos e o carro fica mais confiável.',
              'A bronca pública racha a garagem, e a história vaza para os jornalistas.',
            ],
          },
          bancar: {
            label: 'Pagar do bolso por uma peça de qualidade melhor',
            outcomes: ['A peça nova chega na semana seguinte. O caixa sente, mas o carro agradece.'],
          },
        },
      },
      {
        title: 'Fumaça saindo do motor',
        body: 'Uma nuvem branca saiu da traseira no meio da corrida em {pista}, e acabou ali o seu domingo. O chefe já está na garagem procurando o culpado.',
        choices: {
          apoiar: {
            label: 'Dizer à equipe que quebra faz parte do esporte',
            outcomes: ['A frase acalma a garagem. Ninguém vê o tamanho da sua decepção, e é melhor assim.'],
          },
          cobrar: {
            label: 'Exigir que o culpado seja apontado ainda hoje',
            outcomes: [
              'O mecânico responsável admite o erro, e a equipe aperta os controles de qualidade.',
              'O clima fica pesado, ninguém assume nada, e o seu nome sai arranhado na conversa do paddock.',
            ],
          },
          bancar: {
            label: 'Bancar uma revisão completa do motor por conta própria',
            outcomes: ['O preparador abre tudo e troca o que estava cansado. A conta é sua, a confiança no motor também.'],
          },
        },
      },
      {
        title: 'Uma peça barata, um domingo perdido',
        body: 'A análise sai na segunda-feira: uma peça baratinha cedeu e tirou você da corrida em {pista}. O pior é saber que dava para ter trocado antes.',
        choices: {
          apoiar: {
            label: 'Ligar para cada mecânico e dizer que confia neles',
            outcomes: ['Os mecânicos chegam à oficina na terça com outro ânimo. Você guarda a raiva para o travesseiro.'],
          },
          cobrar: {
            label: 'Mandar um e-mail duro para a diretoria da equipe',
            outcomes: [
              'A diretoria responde com um plano de revisões. O recado foi entendido.',
              'O e-mail circula pela equipe inteira, e a sua fama de quem só reclama corre a garagem.',
            ],
          },
          bancar: {
            label: 'Comprar um estoque de peças de reposição',
            outcomes: ['Agora sobra peça no caminhão. O dinheiro sai do seu bolso, mas a tranquilidade compensa.'],
          },
        },
      },
    ],
  },
  {
    id: 'motor-no-limite',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'season', part: 'late' },
    ],
    choices: [
      {
        id: 'trocar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'grid', who: 'player', size: 1 },
              { e: 'car', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'arriscar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'car', size: -1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'poupar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'consistency', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Motor no limite da quilometragem',
        body: 'A telemetria indica que o motor está no fim da vida útil. Trocar agora significa largar mais atrás na próxima etapa; segurar significa rezar a cada volta.',
        choices: {
          trocar: {
            label: 'Trocar o motor e aceitar a punição no grid',
            outcomes: ['O motor novo empurra forte, mesmo largando lá atrás. A equipe agradece a paciência.'],
          },
          arriscar: {
            label: 'Segurar o motor velho por mais uma corrida',
            outcomes: [
              'O motor velho aguenta firme e ainda entrega um bom ritmo.',
              'O motor velho geme nas retas, perde potência e deixa a equipe de cabelo em pé.',
            ],
          },
          poupar: {
            label: 'Prometer guiar mais leve para poupar o motor',
            outcomes: ['Você troca a marcha mais cedo e alivia nas retas. O ritmo cai, mas a cabeça aprende a ser constante.'],
          },
        },
      },
      {
        title: 'O câmbio está pedindo arrego',
        body: 'As trocas de marcha estão ficando lentas, e o engenheiro desconfia do câmbio. Um câmbio novo resolve, mas o regulamento cobra posições no grid por isso.',
        choices: {
          trocar: {
            label: 'Montar o câmbio novo e largar mais atrás',
            outcomes: ['As marchas entram como faca na manteiga, e você remonta a corrida vindo de trás.'],
          },
          arriscar: {
            label: 'Seguir com o câmbio desgastado',
            outcomes: ['O câmbio range, mas não quebra. Você ganha a aposta.', 'O câmbio solta uma marcha no meio da reta, e o estrago vai além da corrida.'],
          },
          poupar: {
            label: 'Aliviar nas reduções para o câmbio durar mais',
            outcomes: ['Você muda o jeito de reduzir e protege o câmbio. Perde um pouco de tempo, ganha regularidade.'],
          },
        },
      },
      {
        title: 'A embreagem que patina na largada',
        body: 'Nas últimas largadas, a embreagem patinou mais do que deveria. A peça nova custa posições no grid; a velha pode deixar o carro parado no apagar das luzes.',
        choices: {
          trocar: {
            label: 'Pedir a embreagem nova, mesmo com a punição',
            outcomes: ['Com a peça nova, a largada volta a ser limpa, ainda que bem lá do fundo do grid.'],
          },
          arriscar: {
            label: 'Largar com a embreagem velha e torcer',
            outcomes: [
              'A embreagem segura no tranco, e a largada sai boa.',
              'A embreagem patina, o motor afoga, e a equipe precisa desmontar metade da traseira.',
            ],
          },
          poupar: {
            label: 'Treinar largadas mais suaves para poupar a embreagem',
            outcomes: ['Você ensaia largadas com menos rotação. Elas saem mais lentas, mas iguais toda vez.'],
          },
        },
      },
    ],
  },
  {
    id: 'dia-de-testes-particular',
    category: 'track',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'rodar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'experience', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'folga',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'dobrar',
        requires: [{ c: 'trait', trait: 'slowLearner' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'experience', size: 2 },
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um dia inteiro de pista',
        body: 'A equipe conseguiu um dia de testes em {pista} na semana que vem. A gasolina e os pneus ficam por sua conta, mas a pista é toda sua.',
        choices: {
          rodar: {
            label: 'Ir ao teste e rodar até escurecer',
            outcomes: ['Você roda até o sol se pôr e volta com o caderno cheio de anotações. A conta da gasolina chega no dia seguinte.'],
          },
          folga: {
            label: 'Trocar o teste por um dia de descanso',
            outcomes: ['O descanso faz bem à cabeça. O chefe, porém, esperava ver você lá.'],
          },
          dobrar: {
            label: 'Pedir dois dias, que você aprende devagar',
            outcomes: ['O segundo dia é o que vale: é nele que as coisas finalmente fazem sentido. O bolso e o corpo sentem.'],
          },
        },
      },
      {
        title: 'Sobrou uma vaga no teste',
        body: 'Um piloto de outra equipe desistiu do teste particular, e a vaga sobrou para você. É pagar a diária e aparecer na pista às sete da manhã.',
        choices: {
          rodar: {
            label: 'Pagar a diária e chegar antes das sete',
            outcomes: ['O teste rende quilômetros preciosos. Você volta com as mãos calejadas e o caixa mais magro.'],
          },
          folga: {
            label: 'Deixar a vaga para outro e dormir até tarde',
            outcomes: ['O sono põe tudo em dia. No grupo da equipe, alguém comenta que você não apareceu.'],
          },
          dobrar: {
            label: 'Ficar com a vaga e ainda pedir a tarde seguinte',
            outcomes: ['Repetir as mesmas curvas por dois dias faz a ficha cair. Cansa, custa, mas fica.'],
          },
        },
      },
      {
        title: 'Teste coletivo antes da etapa',
        body: 'A organização abriu um dia de testes coletivo antes da próxima etapa. Quem vai roda com os rivais e aprende a pista; quem não vai economiza.',
        choices: {
          rodar: {
            label: 'Fazer a inscrição no teste coletivo',
            outcomes: ['Você roda no meio dos rivais e descobre dois pontos de freada novos. A inscrição não saiu barata.'],
          },
          folga: {
            label: 'Economizar a inscrição e passar o dia longe da pista',
            outcomes: ['Um dia longe dos boxes recarrega as energias. A equipe preferia você no teste.'],
          },
          dobrar: {
            label: 'Fazer a inscrição e pagar sessões extras à tarde',
            outcomes: ['Quando os outros vão embora, você continua rodando. Para quem aprende devagar, as voltas a mais fazem toda a diferença.'],
          },
        },
      },
    ],
  },
  {
    id: 'simulador-da-equipe',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 4 }],
    choices: [
      {
        id: 'sessao',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'consistency', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'pular',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ensaiar',
        requires: [{ c: 'trait', trait: 'qualifyingNerves' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'focus', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Noite no simulador da fábrica',
        body: 'O simulador da equipe está livre na véspera da viagem. O engenheiro sugere uma madrugada inteira decorando a próxima pista, curva por curva.',
        choices: {
          sessao: {
            label: 'Virar a madrugada no simulador',
            outcomes: ['De manhã, você sabe a pista de olhos fechados. O corpo pede cama, mas a cabeça está no lugar.'],
          },
          pular: {
            label: 'Dispensar o simulador e confiar na pista de verdade',
            outcomes: [
              'Você chega com o sono em dia e pega o jeito da pista em poucas voltas.',
              'Você perde o primeiro treino inteiro tentando aprender o traçado, e a equipe nota.',
            ],
          },
          ensaiar: {
            label: 'Ensaiar a volta de classificação até ela sair sem tremer',
            outcomes: ['Na centésima tentativa, a volta sai limpa. O nervosismo não some, mas agora você tem com o que brigar.'],
          },
        },
      },
      {
        title: 'O simulador ganhou uma pista nova',
        body: 'Os engenheiros acabaram de escanear a próxima pista do calendário para o simulador. O convite para estrear o programa antes de todo mundo é seu.',
        choices: {
          sessao: {
            label: 'Estrear o programa e dar o retorno aos engenheiros',
            outcomes: ['Você passa horas apontando onde a pista virtual mente. O trabalho é chato, mas as voltas ficam na memória.'],
          },
          pular: {
            label: 'Recusar e dizer que simulador não é corrida',
            outcomes: [
              'Na pista de verdade, o seu instinto resolve o que o simulador ensinaria.',
              'Na pista de verdade, você erra a mesma curva três vezes, justamente a que o simulador mostraria.',
            ],
          },
          ensaiar: {
            label: 'Usar o simulador para treinar só a classificação',
            outcomes: ['Você repete a volta lançada até as mãos pararem de suar. A classificação deixa de assustar tanto.'],
          },
        },
      },
      {
        title: 'Duas horas reservadas no simulador',
        body: 'A equipe reservou duas horas de simulador para você nesta semana. O programa inclui pista molhada, pneu gasto e uma dúzia de largadas.',
        choices: {
          sessao: {
            label: 'Cumprir o programa inteiro sem pular nada',
            outcomes: ['Você sai do simulador com as mãos doendo de tanto segurar o volante. O ritmo fica mais regular.'],
          },
          pular: {
            label: 'Trocar o simulador por uma corrida de kart com amigos',
            outcomes: [
              'A brincadeira no kart solta a mão e devolve o prazer de correr.',
              'A brincadeira acaba tarde, e você chega à reunião técnica bocejando.',
            ],
          },
          ensaiar: {
            label: 'Pedir para trocar as largadas por voltas de classificação',
            outcomes: ['O engenheiro troca o programa. A cada volta lançada, a tremedeira da sexta-feira diminui um pouco.'],
          },
        },
      },
    ],
  },
  {
    id: 'telemetria-acusa-erro',
    category: 'track',
    frequency: 'normal',
    when: [
      { c: 'notRace', tag: 'absent' },
      { c: 'notRace', tag: 'win' },
    ],
    choices: [
      {
        id: 'aceitar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'consistency', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'negar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'teamTrust', size: -2 }] },
        ],
      },
      {
        id: 'cruzar',
        requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'pace', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A telemetria aponta o dedo',
        body: 'Na reunião depois de {pista}, o engenheiro projeta os gráficos na parede: você freia cedo demais na curva mais lenta, e em cada volta o ponto muda.',
        choices: {
          aceitar: {
            label: 'Aceitar os dados e treinar a freada',
            outcomes: ['Engolir os gráficos dói, mas a freada começa a sair igual em todas as voltas.'],
          },
          negar: {
            label: 'Dizer que a telemetria não mostra tudo',
            outcomes: [
              'Você mostra que o carro saía de traseira ali, e o engenheiro reconhece o ponto.',
              'O engenheiro fecha o computador sem dizer nada. A confiança entre vocês leva um arranhão.',
            ],
          },
          cruzar: {
            label: 'Cruzar os gráficos com o vídeo para achar a causa',
            outcomes: ['Você descobre que freava cedo porque entrava torto na curva anterior. A noite foi longa, e a equipe ficou impressionada.'],
          },
        },
      },
      {
        title: 'O gráfico que não perdoa',
        body: 'O engenheiro sobrepôs a sua melhor volta em {pista} à mais rápida da corrida. Na saída das curvas, a sua linha de acelerador parece um serrote.',
        choices: {
          aceitar: {
            label: 'Admitir que hesita no acelerador e treinar isso',
            outcomes: ['Você passa a semana acelerando com mais decisão. O gráfico fica mais limpo, o ego um pouco menor.'],
          },
          negar: {
            label: 'Culpar o carro, que escorregava na saída',
            outcomes: [
              'Os dados de tração mostram que o carro escorregava mesmo. Ponto para você.',
              'Os dados de tração mostram um carro grudado no chão. O engenheiro não engole a desculpa.',
            ],
          },
          cruzar: {
            label: 'Pedir os dados brutos e estudar a noite inteira',
            outcomes: ['De madrugada, você acha o padrão: a hesitação vem sempre depois da zebra. A equipe adota o seu método de análise.'],
          },
        },
      },
      {
        title: 'Os números da sua freada',
        body: 'A telemetria mostra que a sua pressão no freio muda muito de uma volta para outra. Para a engenheira de dados, é por isso que os tempos oscilam tanto.',
        choices: {
          aceitar: {
            label: 'Pedir exercícios para frear sempre igual',
            outcomes: ['Os exercícios são repetitivos e chatos, mas os tempos começam a ficar mais parecidos.'],
          },
          negar: {
            label: 'Dizer que variar a freada faz parte da sua tocada',
            outcomes: [
              'A engenheira revê os dados e admite que a variação tem lógica.',
              'A engenheira insiste, você insiste, e a reunião termina sem acordo nenhum.',
            ],
          },
          cruzar: {
            label: 'Montar com a engenheira uma planilha por curva',
            outcomes: ['Curva por curva, vocês acham onde a freada muda e por quê. A engenheira passa a chamar você para todas as análises.'],
          },
        },
      },
    ],
  },
  {
    id: 'engenheiro-novo-na-equipe',
    category: 'track',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'tier', min: 4 }],
    choices: [
      {
        id: 'receber',
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
      {
        id: 'resistir',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'absorver',
        requires: [{ c: 'trait', trait: 'quickLearner' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um engenheiro novo no seu carro',
        body: 'A equipe contratou um engenheiro de pista vindo das corridas de turismo. Ele assume o seu carro a partir da próxima etapa e já chegou cheio de métodos novos.',
        choices: {
          receber: {
            label: 'Chamar o engenheiro novo para jantar e ouvir as ideias',
            outcomes: ['O jantar rende uma lista enorme de mudanças. O começo é lento, mas a equipe gosta da sua abertura.'],
          },
          resistir: {
            label: 'Pedir para manter o engenheiro antigo no seu carro',
            outcomes: [
              'A equipe atende, e você segue no ritmo de sempre. Mas o pedido incomoda a diretoria.',
              'A equipe nega o pedido e ainda estranha a resistência. O engenheiro novo começa a relação com o pé atrás.',
            ],
          },
          absorver: {
            label: 'Aprender os métodos novos em poucos dias',
            outcomes: ['Em três treinos, você fala a língua do engenheiro novo. Ele se impressiona, e você paga com noites de estudo.'],
          },
        },
      },
      {
        title: 'Chegou uma engenheira da concorrência',
        body: 'A equipe tirou uma engenheira de pista de uma rival direta. Ela quer mudar a forma como você descreve o carro no rádio, palavra por palavra.',
        choices: {
          receber: {
            label: 'Aceitar o vocabulário novo da engenheira',
            outcomes: ['As primeiras corridas são confusas, mas a comunicação fica mais precisa. A equipe aprova a parceria.'],
          },
          resistir: {
            label: 'Dizer que o seu jeito de falar sempre funcionou',
            outcomes: [
              'Ela cede e adapta o próprio jeito ao seu. O ritmo segue no lugar, mas a diretoria acha estranho.',
              'Ela leva a queixa ao chefe, e você ganha fama de difícil.',
            ],
          },
          absorver: {
            label: 'Decorar o vocabulário novo da noite para o dia',
            outcomes: ['No treino seguinte, você já fala como ela. Os tempos melhoram, e a engenheira passa a defender você nas reuniões.'],
          },
        },
      },
      {
        title: 'Troca na chefia de engenharia',
        body: 'O antigo chefe de engenharia saiu, e quem chega promete reformular o carro do zero. As primeiras reuniões são longas e cheias de planilhas.',
        choices: {
          receber: {
            label: 'Participar de todas as reuniões, por mais longas que sejam',
            outcomes: ['Você vira rosto conhecido nas reuniões. O carro muda tanto que o ritmo demora a voltar, mas a confiança cresce.'],
          },
          resistir: {
            label: 'Pedir que mantenham a base do carro antigo',
            outcomes: [
              'A base antiga fica, e você agradece a estabilidade. A nova chefia anota a resistência.',
              'A nova chefia rejeita o pedido em público. Você sai da reunião sem aliados.',
            ],
          },
          absorver: {
            label: 'Entender a filosofia nova antes de todo mundo',
            outcomes: ['Depois de uma semana sem folga, você entende o carro novo antes dos próprios mecânicos. A nova chefia passa a ouvir você primeiro.'],
          },
        },
      },
    ],
  },
  {
    id: 'pecas-usadas-no-kart',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', max: 3 }],
    choices: [
      {
        id: 'novo',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'car', size: 1 },
              { e: 'cash', size: -2, cap: true },
            ],
          },
        ],
      },
      {
        id: 'remendar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'car', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'usado',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'car', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma trinca no chassi',
        body: 'O mecânico achou uma trinca fina perto da manga de eixo do seu chassi. Pode não ser nada, pode virar uma quebra na pior hora.',
        choices: {
          novo: {
            label: 'Comprar um chassi novo de fábrica',
            outcomes: ['O chassi novo chega embalado e cheirando a tinta. A conta assusta, mas o kart fica na mão.'],
          },
          remendar: {
            label: 'Mandar soldar a trinca e seguir em frente',
            outcomes: ['A solda segura firme, e você economiza um bom dinheiro.', 'A solda cede na terceira corrida, e o chassi fica torto de vez.'],
          },
          usado: {
            label: 'Comprar um chassi usado de outra equipe',
            outcomes: [
              'O chassi usado está inteiro e anda bem. Bom negócio.',
              'O chassi usado tinha mais horas de pista do que o vendedor contou. Dinheiro perdido.',
            ],
          },
        },
      },
      {
        title: 'O motor do kart está cansado',
        body: 'O preparador mediu a compressão e não gostou: o seu motor está no fim da vida. Ainda anda, mas perde rendimento a cada bateria.',
        choices: {
          novo: {
            label: 'Mandar o motor para uma retífica completa',
            outcomes: ['O motor volta da retífica forte como novo. O preparador cobra caro, e com razão.'],
          },
          remendar: {
            label: 'Seguir com o motor cansado até o fim do campeonato',
            outcomes: [
              'O motor velho aguenta mais do que se esperava. Economia no bolso.',
              'O motor perde força a cada corrida, e você vê os rivais escapando nas retas.',
            ],
          },
          usado: {
            label: 'Alugar o motor de um preparador do interior',
            outcomes: ['O motor alugado vem forte e bem acertado. Achado de ouro.', 'O motor alugado é pior que o seu. Pagou caro para andar mais devagar.'],
          },
        },
      },
      {
        title: 'Eixo traseiro empenado',
        body: 'Depois de pular uma zebra alta, o eixo traseiro do seu kart ficou empenado. O mecânico jura que dá para desempenar na prensa.',
        choices: {
          novo: {
            label: 'Comprar um eixo novo e não pensar mais nisso',
            outcomes: ['O eixo novo devolve a tração na saída das curvas. O dinheiro sai, o problema também.'],
          },
          remendar: {
            label: 'Desempenar o eixo na prensa da oficina',
            outcomes: ['A prensa resolve, e o eixo volta reto como régua.', 'O eixo nunca mais fica igual, e o kart passa a puxar para um lado.'],
          },
          usado: {
            label: 'Achar um eixo usado no grupo do kartódromo',
            outcomes: [
              'O eixo usado está em ótimo estado. Negócio fechado no aperto de mão.',
              'O eixo usado chega com uma trinca escondida. Mais dinheiro jogado fora.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'tunel-de-vento',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 4 }],
    choices: [
      {
        id: 'fabrica',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'apostar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'car', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'treinos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Horas contadas no túnel de vento',
        body: 'A equipe conseguiu horas no túnel de vento para testar uma carroceria nova. O chefe pergunta se você quer passar a semana na fábrica acompanhando os ensaios.',
        choices: {
          fabrica: {
            label: 'Passar a semana na fábrica acompanhando os ensaios',
            outcomes: ['Você aprende como o ar passa pelo carro e ganha a simpatia dos aerodinamicistas. A semana sem folga cobra o preço.'],
          },
          apostar: {
            label: 'Testar no túnel só o pacote de curvas rápidas',
            outcomes: [
              'A aposta acerta: o carro ganha pressão aerodinâmica onde mais faltava.',
              'A aposta erra: o pacote novo não funciona, e as horas de túnel vão para o lixo.',
            ],
          },
          treinos: {
            label: 'Ficar treinando e deixar o túnel com os engenheiros',
            outcomes: ['Você mantém a rotina de treinos e chega à etapa com a mão quente. Na fábrica, sentiram a sua falta.'],
          },
        },
      },
      {
        title: 'O modelo em escala na bancada',
        body: 'Os aerodinamicistas montaram um modelo do carro em escala e querem a sua opinião sobre duas asas traseiras. Uma dá velocidade de reta, a outra dá curva.',
        choices: {
          fabrica: {
            label: 'Ir à fábrica e conversar com cada aerodinamicista',
            outcomes: ['A conversa ajuda os engenheiros a escolher o caminho. Você volta tarde para casa, mas com a equipe do seu lado.'],
          },
          apostar: {
            label: 'Escolher a asa de curva sem pensar duas vezes',
            outcomes: [
              'A asa de curva encaixa no seu estilo, e o carro fica mais rápido.',
              'A asa de curva deixa o carro lento demais nas retas, e a equipe perde tempo voltando atrás.',
            ],
          },
          treinos: {
            label: 'Deixar a escolha com os especialistas',
            outcomes: ['Os especialistas decidem sem você, e sobra tempo para treinar. Alguém na fábrica comenta a ausência.'],
          },
        },
      },
      {
        title: 'Madrugada no túnel de vento',
        body: 'A única janela de túnel de vento que sobrou é de madrugada. A equipe quer alguém para acompanhar os ensaios e decidir na hora o que vale testar.',
        choices: {
          fabrica: {
            label: 'Virar a noite acompanhando o túnel de vento',
            outcomes: ['Às quatro da manhã, você ainda está ao lado dos engenheiros. Eles não vão esquecer.'],
          },
          apostar: {
            label: 'Mandar testar a ideia mais ousada do grupo',
            outcomes: [
              'A ideia ousada rende números ótimos e entra no carro na etapa seguinte.',
              'A ideia ousada não se confirma, e a madrugada vai embora sem nada aproveitável.',
            ],
          },
          treinos: {
            label: 'Dormir e confiar nos engenheiros',
            outcomes: ['Você dorme a noite toda e chega com energia ao treino. De manhã, os engenheiros mostram os resultados sem muita vontade de explicar.'],
          },
        },
      },
    ],
  },
  {
    id: 'regulamento-tecnico-novo',
    category: 'track',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'season', part: 'start' }],
    choices: [
      {
        id: 'seguir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'car', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'brecha',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'car', size: 2 },
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'flag', flag: 'tec-brecha-no-regulamento' },
            ],
          },
        ],
      },
      {
        id: 'consultar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'car', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O regulamento técnico mudou',
        body: 'O regulamento técnico da temporada chegou com páginas novas. O engenheiro acha que uma das regras deixa uma brecha que ninguém notou.',
        choices: {
          seguir: {
            label: 'Pedir que a equipe siga o regulamento à risca',
            outcomes: ['A equipe joga limpo e ninguém vai poder apontar o dedo. Mas os rivais mais espertos começam o ano um passo à frente.'],
          },
          brecha: {
            label: 'Apoiar a ideia de explorar a brecha',
            outcomes: ['A peça nova fica pronta antes da primeira etapa e o carro ganha rendimento. Só falta ninguém reparar.'],
          },
          consultar: {
            label: 'Pedir um parecer da direção técnica antes de decidir',
            outcomes: [
              'A direção técnica aprova a interpretação, e o carro ganha rendimento sem nenhum risco.',
              'A direção técnica veta a ideia e, de quebra, avisa as outras equipes. Tempo perdido.',
            ],
          },
        },
      },
      {
        title: 'Uma regra escrita pela metade',
        body: 'Lendo o regulamento novo, o chefe dos mecânicos achou uma frase mal escrita sobre o tamanho de uma peça. Dá para ganhar rendimento, se ninguém contestar.',
        choices: {
          seguir: {
            label: 'Mandar ignorar a frase mal escrita',
            outcomes: ['A equipe deixa a ideia de lado. A consciência fica limpa; o carro, um pouco mais lento que o dos espertos.'],
          },
          brecha: {
            label: 'Mandar fabricar a peça no limite da frase',
            outcomes: ['A peça fica pronta em duas semanas, e o carro ganha tempo de volta. O segredo fica dentro da garagem.'],
          },
          consultar: {
            label: 'Mandar uma consulta formal aos comissários técnicos',
            outcomes: [
              'Os comissários confirmam que a leitura vale. Vantagem legalizada.',
              'Os comissários fecham a brecha numa circular para todas as equipes, e o seu chefe fica furioso.',
            ],
          },
        },
      },
      {
        title: 'Um item esquecido na homologação',
        body: 'A lista de peças homologadas para a temporada saiu, e o engenheiro descobriu um item que quase ninguém vai usar. Ele acha que dá para ir além do que o texto diz.',
        choices: {
          seguir: {
            label: 'Usar o item só como o texto manda',
            outcomes: ['O item entra no carro direitinho, sem invenção. Você começa o ano sem sustos e sem vantagem.'],
          },
          brecha: {
            label: 'Autorizar o engenheiro a ir além do texto',
            outcomes: ['O engenheiro faz mágica com a peça, e o carro estreia mais rápido. Agora é torcer para ninguém olhar de perto.'],
          },
          consultar: {
            label: 'Pedir que a federação esclareça o item',
            outcomes: [
              'A federação responde que pode, e a vantagem vem com carimbo oficial.',
              'A federação responde que não pode e manda a resposta para o grid inteiro. Ideia queimada.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'brecha-denunciada',
    category: 'track',
    frequency: 'common',
    when: [{ c: 'flag', flag: 'tec-brecha-no-regulamento' }],
    needs: ['otherTeam'],
    choices: [
      {
        id: 'retirar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'car', size: -2 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'flag', flag: 'tec-brecha-no-regulamento', clear: true },
            ],
          },
        ],
      },
      {
        id: 'defender',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'flag', flag: 'tec-brecha-no-regulamento', clear: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'grid', who: 'player', size: 2 },
              { e: 'car', size: -2 },
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'flag', flag: 'tec-brecha-no-regulamento', clear: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Protesto contra a sua peça',
        body: 'A equipe {outraEquipe} entrou com um protesto formal contra a peça que a sua equipe criou em cima da brecha do regulamento. Os comissários querem ouvir vocês antes da próxima etapa.',
        choices: {
          retirar: {
            label: 'Retirar a peça antes do julgamento',
            outcomes: ['A peça sai do carro sem alarde. O rendimento cai, mas o paddock respeita a decisão.'],
          },
          defender: {
            label: 'Defender a peça diante dos comissários',
            outcomes: [
              'Os comissários aceitam a interpretação, e a equipe sai do julgamento mais unida do que entrou.',
              'Os comissários dão razão à equipe {outraEquipe}: a peça sai do carro e você ainda larga lá atrás.',
            ],
          },
        },
      },
      {
        title: 'A brecha chegou aos jornais',
        body: 'Um jornalista publicou fotos detalhadas da peça que nasceu da brecha no regulamento. A equipe {outraEquipe} já fala em pedir a sua desclassificação.',
        choices: {
          retirar: {
            label: 'Tirar a peça do carro e encerrar o assunto',
            outcomes: ['O assunto morre em dois dias. O carro perde a vantagem, e a sua imagem sai limpa.'],
          },
          defender: {
            label: 'Dizer à imprensa que a peça é legal e ponto',
            outcomes: [
              'A direção técnica concorda com você, e a equipe {outraEquipe} engole o protesto.',
              'A direção técnica discorda: a peça é proibida, o carro perde o pacote e você perde posições no grid.',
            ],
          },
        },
      },
    ],
  },
];
