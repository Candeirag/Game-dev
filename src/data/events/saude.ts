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
  {
    id: 'pescoco-forca-g',
    category: 'health',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'lacks', what: 'injury' },
    ],
    choices: [
      {
        id: 'reforcar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'attribute', attribute: 'consistency', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'aguentar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Torcicolo de força G' },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'pescoco-forte',
        requires: [{ c: 'aptitude', aptitude: 'physique', level: 'high' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'O pescoço sente cada curva rápida',
        body: 'No carro {categoria:de}, as curvas de alta pesam na cabeça como chumbo. Depois da última sessão, você mal consegue virar o pescoço para olhar o retrovisor.',
        choices: {
          reforcar: {
            label: 'Pagar sessões de reforço com um fisioterapeuta particular',
            outcomes: ['As sessões pesam no bolso, mas o pescoço passa a segurar as curvas sem tremer.'],
          },
          aguentar: {
            label: 'Tomar um anti-inflamatório e seguir a programação',
            outcomes: [
              'A dor fica no fundo, e você completa o fim de semana de cabeça erguida.',
              'Na terceira volta rápida, o pescoço trava de vez. Você termina o treino olhando torto para a reta.',
            ],
          },
          'pescoco-forte': {
            label: 'Confiar na musculatura de quem nasceu forte',
            outcomes: ['Dois dias de gelo e o pescoço volta ao normal. O preparador nunca viu recuperação tão rápida.'],
          },
        },
      },
      {
        title: 'Força lateral demais para um pescoço só',
        body: 'O carro gruda no chão como nenhum outro que você já pilotou. O engenheiro mostra a telemetria: nas curvas rápidas, o seu capacete tomba para fora.',
        choices: {
          reforcar: {
            label: 'Bancar um programa de pescoço com elásticos e capacete pesado',
            outcomes: ['Semanas de faixa elástica presa ao capacete e uma conta mensal nova. O capacete para de tombar.'],
          },
          aguentar: {
            label: 'Dizer que é questão de costume e acelerar mesmo assim',
            outcomes: [
              'O corpo se acostuma na marra, e os mecânicos admiram quem não reclama.',
              'O costume não vem: uma fisgada na nuca tira você do ritmo no meio da corrida.',
            ],
          },
          'pescoco-forte': {
            label: 'Mostrar que o seu pescoço aguenta, como sempre aguentou',
            outcomes: ['Mais uma sessão e o tombo do capacete some da telemetria. Tem corpo que já nasce pronto para isso.'],
          },
        },
      },
      {
        title: 'A nuca que trava depois da classificação',
        body: 'Você sai do carro depois da volta lançada com a nuca dura como pedra. O médico do autódromo aperta o ponto, você faz careta, e o diagnóstico vem na hora: excesso de força G.',
        choices: {
          reforcar: {
            label: 'Trocar a academia por um fisioterapeuta, mesmo pagando caro',
            outcomes: ['O tratamento sai do seu bolso, a nuca agradece, e as voltas rápidas ficam mais regulares.'],
          },
          aguentar: {
            label: 'Esconder a dor da equipe e alinhar no grid',
            outcomes: [
              'Ninguém percebe nada, e você larga com a confiança de quem venceu o próprio corpo.',
              'No meio da prova, a cabeça já não aguenta as curvas, e o rádio entrega a sua voz falhando.',
            ],
          },
          'pescoco-forte': {
            label: 'Pedir só uma massagem: esse pescoço é de aço',
            outcomes: ['Meia hora de massagem resolve. O médico relê a ficha sem entender de onde vem tanta resistência.'],
          },
        },
      },
    ],
  },
  {
    id: 'punho-maos-kart',
    category: 'health',
    frequency: 'normal',
    when: [
      { c: 'tier', max: 3 },
      { c: 'lacks', what: 'injury' },
    ],
    choices: [
      {
        id: 'proteger',
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
        id: 'ignorar-dor',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Tendinite no punho' },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'maos-de-ferro',
        requires: [{ c: 'trait', trait: 'ironBody' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'Bolhas nas palmas depois do treino livre',
        body: 'O volante do kart não tem direção assistida, e as suas mãos mostram: bolhas abertas nas duas palmas. A próxima etapa vem aí, com baterias longas.',
        choices: {
          proteger: {
            label: 'Enfaixar as mãos e pular os treinos da semana',
            outcomes: ['As bolhas fecham a tempo e a cabeça descansa, mas você chega à etapa com menos voltas que os outros.'],
          },
          'ignorar-dor': {
            label: 'Calçar as luvas por cima e ir para a pista',
            outcomes: [
              'As luvas seguram o estrago, e você faz todas as voltas de que precisava.',
              'Na metade da bateria, o punho começa a latejar. A semana termina com gelo e tala.',
            ],
          },
          'maos-de-ferro': {
            label: 'Passar esparadrapo e esquecer: a sua pele aguenta tudo',
            outcomes: ['Uma noite e as bolhas viram calo. O pessoal do box jura que nunca viu pele tão dura.'],
          },
        },
      },
      {
        title: 'O punho que estala no volante',
        body: 'Cada zebra de {pista} subiu direto pelo volante até o seu punho. Na hora de assinar a ficha da próxima inscrição, a caneta treme na sua mão.',
        choices: {
          proteger: {
            label: 'Usar a munhequeira do fisioterapeuta e treinar menos',
            outcomes: ['A munhequeira resolve e o humor melhora, mas o treino da semana fica pela metade.'],
          },
          'ignorar-dor': {
            label: 'Enrolar fita no punho e seguir como se nada fosse',
            outcomes: [
              'A fita segura, e o kart responde do jeito que você queria.',
              'O punho incha na manhã da corrida. Você alinha, mas o volante pesa uma tonelada.',
            ],
          },
          'maos-de-ferro': {
            label: 'Rir do estalo: esse punho já aguentou coisa pior',
            outcomes: ['O estalo some no primeiro treino, e a fama do seu corpo de ferro chega ao box vizinho.'],
          },
        },
      },
      {
        title: 'Luva rasgada e kart pesado',
        body: 'Você treinou a semana toda num kart mais duro de esterçar, e a luva rasgou bem na palma. O mecânico olha as suas mãos vermelhas e faz careta.',
        choices: {
          proteger: {
            label: 'Dar dois dias de folga às mãos, com gelo',
            outcomes: ['Dois dias longe da pista acalmam as mãos e a cabeça. O ritmo, esse, esfria.'],
          },
          'ignorar-dor': {
            label: 'Remendar a luva com fita e treinar até escurecer',
            outcomes: [
              'O remendo aguenta, e você sai do kartódromo com a sensação de ter achado o limite do kart.',
              'O remendo cede, a palma abre, e o punho reclama a semana inteira.',
            ],
          },
          'maos-de-ferro': {
            label: 'Dispensar o curativo: as suas mãos se viram sozinhas',
            outcomes: ['No dia seguinte já não tem nada na palma. Corpo de ferro também vale para as mãos.'],
          },
        },
      },
    ],
  },
  {
    id: 'treino-fisico-preparador',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      {
        id: 'planilha',
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
      {
        id: 'dobrar-carga',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'attribute', attribute: 'focus', size: 1 },
              { e: 'attribute', attribute: 'consistency', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Distensão na coxa' },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'pegar-leve',
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
        title: 'A planilha nova do preparador físico',
        body: 'O preparador chega com uma planilha pintada de vermelho: corrida, bicicleta, exercícios de reação. Promete uma transformação em um mês, se ninguém pular treino.',
        choices: {
          planilha: {
            label: 'Cumprir cada linha da planilha, sem pular nada',
            outcomes: ['As pernas doem até para descer da cama, mas o corpo passa a durar a corrida inteira.'],
          },
          'dobrar-carga': {
            label: 'Fazer o dobro do que está escrito',
            outcomes: [
              'O excesso dá certo: o fôlego sobra no fim das provas e a cabeça fica fria até a bandeirada.',
              'A coxa fisga no meio de um tiro de corrida, e o preparador manda você direto para a maca.',
            ],
          },
          'pegar-leve': {
            label: 'Fazer metade e guardar energia para a pista',
            outcomes: ['A energia sobra nos treinos de pista, e o preparador risca o seu nome do quadro de elogios.'],
          },
        },
      },
      {
        title: 'Bicicleta na serra antes do sol',
        body: 'O preparador marcou treino de bicicleta na serra, todo dia antes do sol nascer. A {equipe} quer pilotos que não percam o fio na reta final das corridas.',
        choices: {
          planilha: {
            label: 'Pôr o despertador e encarar a serra todo dia',
            outcomes: ['O sono sofre e os treinos de pista também, mas no fim do mês o coração mal acelera nas voltas finais.'],
          },
          'dobrar-carga': {
            label: 'Subir a serra duas vezes por manhã',
            outcomes: [
              'Duas subidas por dia, e a cabeça fica no lugar até a última volta. O preparador anota tudo.',
              'Na segunda subida do terceiro dia, a coxa fisga e não solta mais. Gelo e repouso.',
            ],
          },
          'pegar-leve': {
            label: 'Trocar a serra pela bicicleta ergométrica de casa',
            outcomes: ['Mais sono, mais disposição na pista. O preparador, porém, não esconde a decepção.'],
          },
        },
      },
      {
        title: 'Teste de fôlego no laboratório',
        body: 'A equipe levou os pilotos a um laboratório do esporte. Esteira, máscara e eletrodos: o resultado diz que o seu fôlego acaba antes do fim de uma corrida longa.',
        choices: {
          planilha: {
            label: 'Aceitar o programa que o laboratório montou',
            outcomes: ['O programa tira o brilho dos seus treinos de pista, mas o teste seguinte mostra o fôlego indo até a bandeirada.'],
          },
          'dobrar-carga': {
            label: 'Treinar em dobro para refazer o teste antes dos outros',
            outcomes: [
              'O segundo teste surpreende o laboratório: fôlego e atenção lá em cima.',
              'A pressa cobra o preço: uma distensão na coxa tira você da esteira e dos treinos.',
            ],
          },
          'pegar-leve': {
            label: 'Dizer que fôlego se ganha pilotando, não na esteira',
            outcomes: ['Você pilota mais e ganha ritmo, mas o relatório do laboratório vai parar na mesa do chefe.'],
          },
        },
      },
      {
        title: 'Luzes piscando na academia da equipe',
        body: 'O preparador montou um circuito na academia: tiros curtos em zigue-zague e um painel de luzes que pede um tapa a cada piscada. Os outros pilotos já fazem há semanas.',
        choices: {
          planilha: {
            label: 'Entrar no circuito no mesmo horário dos outros',
            outcomes: ['O circuito suga a energia que sobraria para a pista, mas a sua atenção fica estável volta após volta.'],
          },
          'dobrar-carga': {
            label: 'Ficar depois do horário batendo nas luzes',
            outcomes: [
              'As horas extras no painel deixam a sua cabeça mais rápida e mais firme.',
              'Num dos tiros em zigue-zague, a coxa fisga. O preparador desliga as luzes e chama o fisioterapeuta.',
            ],
          },
          'pegar-leve': {
            label: 'Fazer o circuito só nos dias sem pista',
            outcomes: ['Os dias de pista rendem mais. Os de academia, quase nada, e o preparador percebe.'],
          },
        },
      },
    ],
  },
  {
    id: 'balanca-peso-piloto',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      {
        id: 'nutricionista',
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
      {
        id: 'dieta-radical',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Tontura por dieta radical' },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'manter-peso',
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
    ],
    variants: [
      {
        title: 'O ponteiro que a equipe não quer ver',
        body: 'Na pesagem oficial {categoria:de}, piloto e máquina sobem juntos na balança. O engenheiro faz as contas: cada grama que sobra em você é lastro que sai do lugar certo.',
        choices: {
          nutricionista: {
            label: 'Pagar acompanhamento com nutricionista do esporte',
            outcomes: ['A conta pesa no bolso, mas o cardápio novo tira o excesso sem roubar a sua energia.'],
          },
          'dieta-radical': {
            label: 'Cortar quase tudo do prato até a próxima etapa',
            outcomes: [
              'O ponteiro desce a tempo, e o engenheiro põe o lastro exatamente onde queria.',
              'O ponteiro desce, a glicose também: uma tontura forte quase derruba você no meio do treino.',
            ],
          },
          'manter-peso': {
            label: 'Manter a comida de casa e encarar a balança',
            outcomes: ['Você come bem e treina feliz. O engenheiro, nem tanto, e deixa isso claro na reunião.'],
          },
        },
      },
      {
        title: 'Churrasco de domingo, balança de segunda',
        body: 'A {equipe} pesa os pilotos toda segunda-feira, e o seu número subiu depois de um mês de festas e churrascos de família. O chefe pede atenção à pesagem da próxima etapa.',
        choices: {
          nutricionista: {
            label: 'Montar um cardápio com acompanhamento profissional',
            outcomes: ['A marmita regrada custa caro e não tem graça nenhuma, mas a pesagem de segunda volta ao normal.'],
          },
          'dieta-radical': {
            label: 'Viver de salada e água até a pesagem',
            outcomes: [
              'Funciona: o número volta, e o chefe nem toca mais no assunto.',
              'Na sexta, uma tontura no box assusta os mecânicos. Jejum e corrida não combinam.',
            ],
          },
          'manter-peso': {
            label: 'Prometer cuidar disso depois da temporada',
            outcomes: ['O churrasco continua, e o bom humor também. A promessa, o chefe anota com cara fechada.'],
          },
        },
      },
      {
        title: 'Sauna, plástico e nada de água',
        body: 'A sua ficha mostra peso acima do previsto para a próxima etapa. Um mecânico veterano sugere a velha receita do paddock: sauna, roupa de plástico e nada de água até a pesagem.',
        choices: {
          nutricionista: {
            label: 'Recusar a sauna e procurar orientação de nutrição',
            outcomes: ['Mais lento e mais caro, mas o peso cai sem você perder força no volante.'],
          },
          'dieta-radical': {
            label: 'Seguir a receita do mecânico à risca',
            outcomes: [
              'A sauna resolve na véspera: peso certo, e o lastro vai para onde o engenheiro sonhava.',
              'A desidratação chega antes da pesagem: tontura, mãos tremendo e a vista escurecendo no box.',
            ],
          },
          'manter-peso': {
            label: 'Aceitar o lastro mal colocado e focar na pilotagem',
            outcomes: ['O equilíbrio sai um pouco torto, mas a semana passa com cabeça leve e estômago cheio.'],
          },
        },
      },
    ],
  },
  {
    id: 'fuso-horario-viagem',
    category: 'health',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 3 },
      { c: 'lacks', what: 'injury' },
    ],
    choices: [
      {
        id: 'adaptar',
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
      {
        id: 'remedio-sono',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'form', size: -2 }] },
        ],
      },
      {
        id: 'relogio-de-casa',
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
    ],
    variants: [
      {
        title: 'O corpo ainda está no fuso de casa',
        body: 'Doze horas de voo, duas conexões e um fuso que vira o dia do avesso. A próxima etapa começa na quinta, e às três da manhã você está de olho aberto no hotel.',
        choices: {
          adaptar: {
            label: 'Pagar a diferença e embarcar dois dias antes',
            outcomes: ['A passagem antecipada custa caro, mas quando o treino começa o seu relógio já virou.'],
          },
          'remedio-sono': {
            label: 'Tomar um comprimido para dormir no voo',
            outcomes: [
              'Você apaga na decolagem e acorda no destino com o corpo no horário certo.',
              'O comprimido derruba você e não solta: dois dias de cabeça pesada e reflexo lento.',
            ],
          },
          'relogio-de-casa': {
            label: 'Manter o horário de casa e dormir quando der',
            outcomes: ['Você acha graça em jantar na hora do café da manhã, mas os treinos matinais saem arrastados.'],
          },
        },
      },
      {
        title: 'Hotel colado na pista de pouso',
        body: 'A agência de viagens da equipe economizou: hotel ao lado do aeroporto, avião passando de hora em hora e uma cortina que não fecha. A noite promete ser longa.',
        choices: {
          adaptar: {
            label: 'Mudar por conta própria para um hotel silencioso',
            outcomes: ['O quarto novo pesa no bolso, mas o sono vem inteiro e você acorda com outra cara.'],
          },
          'remedio-sono': {
            label: 'Pedir ao médico da equipe algo para apagar',
            outcomes: [
              'O remédio vence os aviões, e o descanso vem completo.',
              'O remédio funciona até demais: você chega ao treino com a cabeça em câmera lenta.',
            ],
          },
          'relogio-de-casa': {
            label: 'Pôr o fone de ouvido e torcer pelo melhor',
            outcomes: ['O fone ajuda pouco. O humor resiste, o corpo nem tanto.'],
          },
        },
      },
      {
        title: 'Madrugada no saguão do aeroporto',
        body: 'O voo atrasou, a conexão foi perdida e a equipe passa a noite no saguão de um aeroporto estrangeiro. Amanhã cedo tem simulador e reunião técnica.',
        choices: {
          adaptar: {
            label: 'Pagar uma sala de descanso no próprio aeroporto',
            outcomes: ['Uma poltrona que reclina, um banho quente e algumas horas de sono que valem cada centavo.'],
          },
          'remedio-sono': {
            label: 'Engolir um calmante e dormir no banco mesmo',
            outcomes: [
              'O banco é duro, mas o sono vem fundo e você embarca de manhã com energia.',
              'Você acorda no banco com o pescoço torto e a cabeça zonza, quase perdendo o embarque.',
            ],
          },
          'relogio-de-casa': {
            label: 'Virar a noite ouvindo as histórias dos mecânicos',
            outcomes: ['As histórias de oficina rendem boas risadas, e o simulador do dia seguinte rende quase nada.'],
          },
        },
      },
    ],
  },
  {
    id: 'calor-no-cockpit',
    category: 'health',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'lacks', what: 'injury' },
    ],
    choices: [
      {
        id: 'hidratar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'aguentar-calor',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Exaustão pelo calor' },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'avisar-limite',
        requires: [{ c: 'trait', trait: 'fragile' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Cinquenta graus dentro do macacão',
        body: 'A previsão para a próxima etapa fala em sol a pino e asfalto fervendo. Com macacão antichamas e capacete, a temperatura dentro do carro vai passar do suportável.',
        choices: {
          hidratar: {
            label: 'Comprar colete de gelo e canudo de isotônico',
            outcomes: ['O equipamento extra sai do seu bolso, mas você termina a corrida com a cabeça fria.'],
          },
          'aguentar-calor': {
            label: 'Dispensar o colete e confiar no preparo físico',
            outcomes: [
              'Você aguenta a fornalha até a bandeirada, e o paddock comenta a sua resistência.',
              'Na volta final, a vista escurece e as mãos formigam. Exaustão pelo calor, diz o médico.',
            ],
          },
          'avisar-limite': {
            label: 'Avisar a equipe que o calor pega você antes',
            outcomes: ['A equipe ajusta a ventilação e corta as suas voltas de treino. Menos pista, mais gente cuidando de você.'],
          },
        },
      },
      {
        title: 'O canudo de água que entupiu',
        body: 'Na última corrida, o canudo da garrafa entupiu e você passou a prova inteira sem uma gota. A próxima etapa promete ainda mais calor.',
        choices: {
          hidratar: {
            label: 'Exigir garrafa nova e pagar um plano de hidratação',
            outcomes: ['O sistema novo sai do seu bolso, e nunca mais você fica a seco dentro do carro.'],
          },
          'aguentar-calor': {
            label: 'Treinar na sauna para se acostumar com o forno',
            outcomes: [
              'A sauna funciona: o calor do carro vira detalhe, e você ganha fama de casca grossa.',
              'A sauna passa do ponto. Exaustão, soro na veia e um fim de semana longe do seu melhor.',
            ],
          },
          'avisar-limite': {
            label: 'Pedir ao engenheiro uma entrada de ar extra no cockpit',
            outcomes: ['A entrada de ar custa aerodinâmica e tempo de acerto, mas a equipe passa a olhar por você.'],
          },
        },
      },
      {
        title: 'Ventiladores espalhados pelo box',
        body: 'O termômetro da pista bate recorde, a borracha gruda no asfalto e os médicos espalham ventiladores pelo box. Os pilotos mais experientes já se enchem de gelo antes de entrar no carro.',
        choices: {
          hidratar: {
            label: 'Encomendar um colete refrigerado igual ao dos veteranos',
            outcomes: ['O colete chega na véspera e não sai barato, mas a cabeça fica no lugar até a última volta.'],
          },
          'aguentar-calor': {
            label: 'Correr do jeito de sempre e beber água no grid',
            outcomes: [
              'Garrafa no grid, calor na pista e nenhuma volta ruim. O corpo deu conta.',
              'Da metade em diante, as freadas atrasam e a vista turva. O calor venceu desta vez.',
            ],
          },
          'avisar-limite': {
            label: 'Treinar menos e poupar o corpo para a corrida',
            outcomes: ['Menos voltas no treino livre, mais corpo para a corrida. A equipe respeita a franqueza.'],
          },
        },
      },
    ],
  },
  {
    id: 'ansiedade-pre-corrida',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      {
        id: 'psicologo',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              {
                e: 'meet',
                key: 'saude-psicologo',
                from: 'stranger',
                role: 'especialista em psicologia do esporte',
                org: 'Clínica Ponto de Equilíbrio',
                attitude: 1,
              },
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'na-marra',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'morale', size: -2 }] },
        ],
      },
      {
        id: 'sangue-frio',
        requires: [{ c: 'aptitude', aptitude: 'composure', level: 'high' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'Estômago embrulhado antes da largada',
        body: 'Nas últimas corridas, o nervoso começa na véspera: você não dorme, não come e chega ao grid com as mãos suando dentro das luvas. Alguém na equipe percebeu.',
        choices: {
          psicologo: {
            label: 'Marcar consulta com especialista em psicologia do esporte',
            outcomes: ['As sessões custam caro, mas {primeiro:saude-psicologo} ensina um ritual de respiração que funciona até no grid.'],
          },
          'na-marra': {
            label: 'Não contar a ninguém e resolver na marra',
            outcomes: [
              'Na marra funciona: a largada sai limpa e o nó no estômago se desfaz na primeira curva.',
              'O nó não se desfaz. Você passa a semana remoendo cada corrida, sem conseguir desligar.',
            ],
          },
          'sangue-frio': {
            label: 'Transformar o frio na barriga em combustível, como sempre',
            outcomes: ['O ritual de sempre funciona: dois minutos de olhos fechados antes da largada e o coração desacelera.'],
          },
        },
      },
      {
        title: 'O peso das câmeras no grid',
        body: '{^categoria:the} trouxe mais público, mais câmeras e mais cobrança. Desde a última etapa, a sua cabeça não para: cada erro vira um filme que se repete à noite.',
        choices: {
          psicologo: {
            label: 'Aceitar a indicação de uma clínica de psicologia do esporte',
            outcomes: ['A primeira sessão com {primeiro:saude-psicologo} sai cara e estranha. Na terceira, os filmes da noite já passam mais curtos.'],
          },
          'na-marra': {
            label: 'Ocupar a cabeça com mais horas de simulador',
            outcomes: [
              'O simulador ocupa a mente e devolve a confiança volta a volta.',
              'Mais simulador, mais erro repetido na cabeça. O cansaço mental vira mau humor.',
            ],
          },
          'sangue-frio': {
            label: 'Desligar o celular e confiar no próprio sangue-frio',
            outcomes: ['Celular na gaveta, cabeça no lugar. O sangue-frio que trouxe você até aqui não foi embora.'],
          },
        },
      },
      {
        title: 'A insônia que voltou com tudo',
        body: 'Você acorda às três da manhã repassando a curva onde errou no domingo. Já é a quarta noite seguida, e o chefe da equipe comentou que a sua voz anda tensa nas reuniões.',
        choices: {
          psicologo: {
            label: 'Pedir à equipe o contato de quem cuida da mente',
            outcomes: ['O contato de {pessoa:saude-psicologo} vem rápido, e a conta também. Em poucas conversas, a curva do domingo vira só uma curva.'],
          },
          'na-marra': {
            label: 'Tomar um chá e fingir que está tudo bem',
            outcomes: [
              'O chá e o cansaço vencem a insônia, e você chega à pista mais leve do que esperava.',
              'Fingir não funciona: a tensão aparece nas reuniões, na largada e no humor do box.',
            ],
          },
          'sangue-frio': {
            label: 'Anotar o erro num caderno e dormir em seguida',
            outcomes: ['Erro anotado, assunto encerrado. Você dorme como pedra e acorda pensando na próxima curva.'],
          },
        },
      },
    ],
  },
  {
    id: 'concussao-apos-batida',
    category: 'health',
    frequency: 'normal',
    when: [
      { c: 'race', tag: 'crash' },
      { c: 'lacks', what: 'injury' },
    ],
    choices: [
      {
        id: 'exames',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'serious', length: 'short', description: 'Concussão leve' },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'esconder-sintomas',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'serious', length: 'long', description: 'Concussão agravada' },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'cabeca-de-aco',
        requires: [{ c: 'trait', trait: 'ironBody' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'Zumbido depois da batida',
        body: 'A batida contra a barreira em {pista} foi forte. No centro médico, você diz que está tudo bem, mas a luz da lanterna incomoda e um zumbido não sai do ouvido.',
        choices: {
          exames: {
            label: 'Pedir a bateria completa de exames neurológicos',
            outcomes: [
              'Os exames saem limpos. Você perde dias de treino em salas de espera, mas a equipe gosta da responsabilidade.',
              'A tomografia confirma uma concussão. O médico veta a próxima etapa, e a equipe apoia a decisão.',
            ],
          },
          'esconder-sintomas': {
            label: 'Dizer que foi só o susto e voltar ao simulador',
            outcomes: [
              'O zumbido some em dois dias, e ninguém fica sabendo de nada.',
              'No simulador, a tela começa a girar. A concussão piorou, e o afastamento agora é longo.',
            ],
          },
          'cabeca-de-aco': {
            label: 'Fazer os exames confiando no corpo que sempre volta',
            outcomes: ['Exames perfeitos, reflexos em dia. O médico confere duas vezes e libera você com um sorriso.'],
          },
        },
      },
      {
        title: 'O capacete rachado na lateral',
        body: 'Os mecânicos trazem o seu capacete da pista: uma rachadura na lateral, bem na altura da têmpora. Você não lembra direito da última curva antes da batida.',
        choices: {
          exames: {
            label: 'Seguir direto para o hospital com o médico da prova',
            outcomes: [
              'Noite em observação e nenhuma lesão. A equipe agradece por você não ter brincado com a sorte.',
              'O diagnóstico é concussão. Uma etapa de fora, por ordem médica, sem discussão.',
            ],
          },
          'esconder-sintomas': {
            label: 'Guardar o capacete no armário e não falar mais disso',
            outcomes: [
              'A memória da curva volta aos poucos, e a vida segue sem alarde.',
              'Uma semana depois, a dor de cabeça não passa e a vista embaralha. O médico afasta você por várias etapas.',
            ],
          },
          'cabeca-de-aco': {
            label: 'Passar no exame com a tranquilidade de sempre',
            outcomes: ['O neurologista não acha nada. Corpo de ferro, cabeça também, brinca o chefe de equipe.'],
          },
        },
      },
      {
        title: 'Enjoo no caminho do box',
        body: 'Depois do abandono em {pista}, você sai andando dos destroços, mas no caminho do box o estômago vira e a luz do sol parece forte demais.',
        choices: {
          exames: {
            label: 'Chamar o médico antes de qualquer entrevista',
            outcomes: [
              'O médico descarta concussão: foi o calor e o susto. Você descansa, e a equipe respira aliviada.',
              'O médico reconhece os sinais na hora. Concussão, e a próxima etapa fica com o reserva.',
            ],
          },
          'esconder-sintomas': {
            label: 'Atender a imprensa e deitar no hotel depois',
            outcomes: [
              'Uma boa noite de sono resolve. No dia seguinte, só fica a lembrança do susto.',
              'O enjoo volta pior de madrugada. Concussão agravada, e o afastamento vai longe.',
            ],
          },
          'cabeca-de-aco': {
            label: 'Encarar os exames sabendo que o seu corpo aguenta pancada',
            outcomes: ['Nada na tomografia, nada no teste de equilíbrio. O médico da prova diz que você tem cabeça de aço.'],
          },
        },
      },
    ],
  },
  {
    id: 'recuperacao-lesao-pressa',
    category: 'health',
    frequency: 'common',
    when: [{ c: 'has', what: 'injury' }],
    choices: [
      {
        id: 'respeitar-medico',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'acelerar-volta',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Dor residual da lesão' },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'serious', length: 'long', description: 'Recaída da lesão' },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'fisioterapia-intensiva',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'injury', severity: 'minor', length: 'short', description: 'Lesão em fase final' },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O médico pede mais paciência',
        body: 'A lesão melhora dia a dia, mas o médico da equipe quer mais tempo antes de liberar treino forte. Você olha o calendário e conta as etapas que estão escapando.',
        choices: {
          'respeitar-medico': {
            label: 'Seguir à risca o prazo do médico',
            outcomes: ['A espera dói mais que a lesão, mas a equipe vê alguém que pensa na temporada inteira.'],
          },
          'acelerar-volta': {
            label: 'Antecipar a volta e testar o corpo na pista',
            outcomes: [
              'O corpo responde melhor do que o médico previa: sobra só uma dor chata para administrar.',
              'Na primeira freada forte, a dor volta lá do fundo. Recaída, e o prazo agora é bem maior.',
            ],
          },
          'fisioterapia-intensiva': {
            label: 'Pagar fisioterapia intensiva, de manhã e de noite',
            outcomes: ['Duas sessões por dia e uma conta salgada. Em compensação, a lesão entra na reta final bem antes do previsto.'],
          },
        },
      },
      {
        title: 'Sofá, gelo e corrida na televisão',
        body: 'Você assiste aos treinos pela televisão, com gelo em cima da lesão. O preparador físico manda mensagem: dá para encurtar a recuperação, mas o risco é todo seu.',
        choices: {
          'respeitar-medico': {
            label: 'Responder que vai esperar a liberação oficial',
            outcomes: ['O sofá testa a paciência, mas o médico elogia: recuperação sem atalho é recuperação sem susto.'],
          },
          'acelerar-volta': {
            label: 'Topar o plano acelerado do preparador',
            outcomes: [
              'O plano funciona, e você volta a treinar antes do que todo mundo esperava.',
              'O atalho cobra caro: a lesão abre de novo, e o sofá vira a sua casa por mais tempo.',
            ],
          },
          'fisioterapia-intensiva': {
            label: 'Contratar uma clínica para tratar a lesão todo dia',
            outcomes: ['A clínica custa o que custa, mas cada sessão encurta o caminho de volta à pista.'],
          },
        },
      },
      {
        title: 'Liberação parcial na mão',
        body: 'O médico assinou uma liberação parcial: dá para correr, mas sem forçar. Na equipe, ninguém quer decidir por você o quanto é forçar demais.',
        choices: {
          'respeitar-medico': {
            label: 'Pilotar no limite do papel e deixar o corpo mandar',
            outcomes: ['Você poupa o corpo e engole a frustração, mas a equipe passa a confiar no seu juízo.'],
          },
          'acelerar-volta': {
            label: 'Ignorar o papel e pilotar como se nada tivesse acontecido',
            outcomes: [
              'Na pista, a lesão quase não aparece, e a confiança volta a cada volta rápida.',
              'Uma zebra mais alta e a lesão grita. Recaída, e o papel de liberação vai para o lixo.',
            ],
          },
          'fisioterapia-intensiva': {
            label: 'Levar um fisioterapeuta particular para o autódromo',
            outcomes: ['O fisioterapeuta trabalha entre as sessões e não sai barato. A lesão agradece e encolhe a cada dia.'],
          },
        },
      },
    ],
  },
  {
    id: 'check-up-pre-temporada',
    category: 'health',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'season', part: 'start' }],
    choices: [
      {
        id: 'exames-completos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'exame-basico',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Anemia descoberta tarde' },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'historico-fragil',
        requires: [{ c: 'trait', trait: 'fragile' }],
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
        title: 'Fila do exame médico da pré-temporada',
        body: 'Sem atestado médico, {categoria:the} não aceita a inscrição. A clínica credenciada oferece o pacote completo, com esteira e exame de sangue, ou só o básico que o regulamento exige.',
        choices: {
          'exames-completos': {
            label: 'Fazer o pacote completo, do sangue à esteira',
            outcomes: ['O pacote custa caro, mas você começa o ano sabendo exatamente como está o seu corpo.'],
          },
          'exame-basico': {
            label: 'Pegar o atestado básico e voltar aos treinos',
            outcomes: [
              'Carimbo, assinatura e pronto: a temporada começa sem perder um dia.',
              'O cansaço aparece logo nos primeiros treinos, e um exame tardio acusa anemia.',
            ],
          },
          'historico-fragil': {
            label: 'Pedir exames extras, porque você conhece o seu histórico',
            outcomes: ['Os exames extras pegam um problema no início, e o tratamento resolve antes da primeira largada.'],
          },
        },
      },
      {
        title: 'Atestado novo para a temporada de {ano}',
        body: 'O médico da federação quer todos os pilotos avaliados antes da primeira etapa. A sua agenda de pré-temporada já está lotada de testes e compromissos.',
        choices: {
          'exames-completos': {
            label: 'Abrir espaço na agenda para a avaliação inteira',
            outcomes: ['Um dia inteiro entre agulhas e aparelhos, e uma conta para pagar. O laudo sai impecável.'],
          },
          'exame-basico': {
            label: 'Encaixar a consulta mais rápida possível',
            outcomes: [
              'Quinze minutos de consulta, e o atestado sai. Agenda salva.',
              'A consulta corrida deixa passar uma anemia, que aparece no primeiro fim de semana de pista.',
            ],
          },
          'historico-fragil': {
            label: 'Levar a pasta de exames antigos e pedir uma revisão',
            outcomes: ['O médico cruza os exames antigos com os novos e corrige a sua suplementação antes que vire problema.'],
          },
        },
      },
      {
        title: 'Exames por conta própria',
        body: 'A {equipe} exige uma bateria de exames antes da temporada, mas cada um paga a sua conta. Tem clínica cara e completa, e tem posto de saúde com fila.',
        choices: {
          'exames-completos': {
            label: 'Ir à clínica cara e fazer tudo de uma vez',
            outcomes: ['Tudo feito numa manhã, conta paga à vista. Você entra na temporada com a ficha médica em ordem.'],
          },
          'exame-basico': {
            label: 'Encarar a fila do posto e fazer só o obrigatório',
            outcomes: [
              'A fila é longa, mas o atestado sai e o bolso agradece.',
              'No posto, ninguém pede exame de sangue. A anemia só aparece quando as pernas falham no primeiro treino.',
            ],
          },
          'historico-fragil': {
            label: 'Pedir um acompanhamento mais de perto ao médico de confiança',
            outcomes: ['O acompanhamento de perto acerta a suplementação e evita o susto que costuma vir no meio do ano.'],
          },
        },
      },
    ],
  },
  {
    id: 'reacao-alimentar',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      {
        id: 'repouso',
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
        id: 'remedio-e-trabalho',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'injury', severity: 'minor', length: 'short', description: 'Reação alimentar' },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O camarão da festa da equipe',
        body: 'A festa de fim de etapa teve frutos do mar, e às quatro da manhã você descobre que algo não caiu bem. Os compromissos da semana começam daqui a pouco.',
        choices: {
          repouso: {
            label: 'Ficar de cama, com soro e caldo de galinha',
            outcomes: ['O estômago se acalma e o humor também, mas o corpo chega fraco aos primeiros treinos.'],
          },
          'remedio-e-trabalho': {
            label: 'Tomar remédio e não faltar a nenhum compromisso',
            outcomes: [
              'Remédio na mochila e nenhuma ausência. A equipe nota o compromisso.',
              'O remédio segura até a primeira sessão. Depois, é uma corrida entre o box e o banheiro.',
            ],
          },
        },
      },
      {
        title: 'Alergia que ninguém conhecia',
        body: 'Um molho diferente no restaurante do autódromo e, meia hora depois, o rosto incha e a pele coça inteira. O médico de plantão pede calma e prepara a injeção.',
        choices: {
          repouso: {
            label: 'Tomar o antialérgico e dormir o resto do dia',
            outcomes: ['O inchaço some depois de um sono pesado. Perde-se um dia de treino, ganha-se um susto a menos.'],
          },
          'remedio-e-trabalho': {
            label: 'Tomar o antialérgico e voltar direto para o box',
            outcomes: [
              'O remédio age rápido, e você volta à pista antes do fim da sessão. O box aplaude.',
              'O antialérgico dá um sono que não passa, e a reação ainda volta à noite.',
            ],
          },
        },
      },
      {
        title: 'A marmita esquecida no caminhão',
        body: 'Faltou almoço no box, e você comeu a marmita que estava desde cedo no caminhão da equipe. À tarde, o estômago dá o primeiro aviso.',
        choices: {
          repouso: {
            label: 'Cancelar o resto do dia e ir para o hotel',
            outcomes: ['Uma tarde de cama resolve o estômago. A agenda fica para trás, a cabeça descansa.'],
          },
          'remedio-e-trabalho': {
            label: 'Tomar sal de frutas e fingir que não foi nada',
            outcomes: [
              'Não foi nada mesmo: o estômago assenta, e a tarde de trabalho rende.',
              'O aviso vira tempestade. Você passa a noite em claro e a semana sem forças.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'visao-e-reflexos',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'lacks', what: 'injury' }],
    choices: [
      {
        id: 'especialista',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'attribute', attribute: 'focus', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'deixar-para-la',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'reflexos',
        requires: [{ c: 'aptitude', aptitude: 'reflexes', level: 'high' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'As placas de freada ficaram borradas',
        body: 'Nos últimos treinos, você passou a enxergar as placas de distância um pouco tarde. Pode ser cansaço, pode ser a vista. O oftalmologista da cidade tem horário amanhã.',
        choices: {
          especialista: {
            label: 'Fazer o exame de vista e encomendar lentes de contato',
            outcomes: ['As lentes custam caro e coçam na primeira semana, mas as placas voltam a aparecer nítidas e cedo.'],
          },
          'deixar-para-la': {
            label: 'Culpar o cansaço e esperar passar',
            outcomes: [
              'Uma semana dormindo direito e a vista volta ao normal. Era cansaço mesmo.',
              'Não era cansaço. Você erra duas freadas no treino, e a confiança vai junto.',
            ],
          },
          reflexos: {
            label: 'Compensar com os reflexos de sempre até a próxima folga',
            outcomes: ['Os reflexos cobrem a diferença com sobra, e o exame fica para as férias, sem pressa.'],
          },
        },
      },
      {
        title: 'O aparelho que mede o tempo de reação',
        body: 'O engenheiro de desempenho trouxe um aparelho que mede o tempo de reação. O seu resultado ficou abaixo do esperado, e a sugestão é procurar um especialista em visão esportiva.',
        choices: {
          especialista: {
            label: 'Pagar o programa do especialista em visão esportiva',
            outcomes: ['Exercícios de olho, telas piscando e uma conta salgada. No novo teste, o número melhora e a pilotagem fica mais atenta.'],
          },
          'deixar-para-la': {
            label: 'Dizer que aparelho nenhum mede piloto de verdade',
            outcomes: [
              'A frase vira piada no box, e você prova na pista que o número não diz tudo.',
              'Na corrida seguinte, a largada sai atrasada, e o engenheiro mostra o gráfico sem dizer nada.',
            ],
          },
          reflexos: {
            label: 'Repetir o teste e mostrar do que é capaz',
            outcomes: ['Na segunda tentativa, o aparelho marca o melhor tempo da equipe. O engenheiro guarda o aparelho, meio sem graça.'],
          },
        },
      },
      {
        title: 'Sol baixo na reta, vista ofuscada',
        body: 'No fim da tarde, o sol bate de frente na reta principal, e você perde a referência da freada por um instante. O médico sugere uma avaliação de vista antes da próxima corrida.',
        choices: {
          especialista: {
            label: 'Fazer a avaliação e trocar por uma viseira com filtro',
            outcomes: ['Avaliação feita, viseira nova comprada. O sol continua lá, mas a referência da freada não some mais.'],
          },
          'deixar-para-la': {
            label: 'Baixar a viseira escura e seguir em frente',
            outcomes: [
              'A viseira escura resolve o sol, e você nem pensa mais nisso.',
              'A viseira escura resolve o sol e atrapalha na sombra. Você erra a freada justo onde não podia.',
            ],
          },
          reflexos: {
            label: 'Confiar no reflexo para achar a freada no último instante',
            outcomes: ['O reflexo acha a freada todas as vezes. O médico desiste de insistir.'],
          },
        },
      },
    ],
  },
  {
    id: 'retorno-psicologia-esporte',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'noPoints' }],
    needs: ['person:saude-psicologo'],
    speaker: 'saude-psicologo',
    choices: [
      {
        id: 'voltar-sessoes',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'attitude', key: 'saude-psicologo', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'dispensar-sessoes',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'attitude', key: 'saude-psicologo', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -2 },
              { e: 'attitude', key: 'saude-psicologo', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Mensagem de {primeiro:saude-psicologo}',
        body: '{pessoa:saude-psicologo}, da {org:saude-psicologo}, viu o resultado de domingo e manda mensagem: tem um horário livre na terça, se você quiser conversar sobre a corrida.',
        choices: {
          'voltar-sessoes': {
            label: 'Marcar a terça e levar a corrida para a sessão',
            outcomes: ['A conversa desmonta o domingo peça por peça. Sai cara, mas você volta à pista com outra cabeça.'],
          },
          'dispensar-sessoes': {
            label: 'Agradecer e dizer que desta vez resolve por conta própria',
            outcomes: [
              'Você dá conta mesmo: o domingo fica para trás mais rápido do que imaginava.',
              'Sem a conversa, o domingo ruim gruda na cabeça e contamina a semana inteira de treinos.',
            ],
          },
        },
      },
      {
        title: 'A porta aberta da clínica',
        body: 'Faz tempo que você não aparece na {org:saude-psicologo}. Depois de mais um domingo sem pontos, {primeiro:saude-psicologo} liga para lembrar que a porta continua aberta.',
        choices: {
          'voltar-sessoes': {
            label: 'Voltar às sessões semanais com {primeiro:saude-psicologo}',
            outcomes: ['O hábito volta, e a conta também. Em poucas semanas, os domingos ruins pesam menos.'],
          },
          'dispensar-sessoes': {
            label: 'Responder que agora o trabalho é na pista',
            outcomes: [
              'A franqueza é aceita sem drama, e você acha o seu próprio jeito de virar a página.',
              'A página não vira. O resultado ruim volta à cabeça em cada freada da semana.',
            ],
          },
        },
      },
      {
        title: 'Lição de casa depois de um domingo ruim',
        body: '{primeiro:saude-psicologo} manda pelo celular um exercício para depois de corridas ruins: escrever três coisas que deram certo no domingo. Você olha a tela e hesita.',
        choices: {
          'voltar-sessoes': {
            label: 'Fazer o exercício e marcar a próxima consulta',
            outcomes: ['As três coisas aparecem mais fácil do que parecia. A consulta seguinte transforma a lista num plano.'],
          },
          'dispensar-sessoes': {
            label: 'Deixar a mensagem sem resposta por enquanto',
            outcomes: [
              'Sem resposta e sem drama: um treino bom na quarta resolve o que a lista resolveria.',
              'A mensagem fica lá, sem resposta, e o domingo ruim fica junto, ocupando espaço.',
            ],
          },
        },
      },
    ],
  },
];
