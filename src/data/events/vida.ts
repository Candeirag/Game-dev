/**
 * Eventos de vida pessoal (Fase 5): escola, família, amizades, namoro, filhos. Peso baixo no
 * sorteio (STORY_EVENTS.CATEGORY_WEIGHTS): o foco do jogo é a pista.
 *
 * Namoro adolescente não usa o efeito de parceiro (que cria um cônjuge de verdade, com herança e
 * filhos): fica nas marcas e nos indicadores. Formato em `src/domain/storyEvents.ts`. A primeira
 * escolha de cada evento é a "natural" (é a que o robô do simulador escolhe). Acrescente eventos no
 * fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const PERSONAL_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'prova-escola',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'teen' }],
    choices: [
      {
        id: 'estudar',
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
        id: 'pista',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Prova de matemática na sexta-feira',
        body: 'A professora marcou a prova bimestral para o mesmo dia do treino livre. Sua mãe já avisou que, se a nota vier vermelha, o kart fica na garagem.',
        choices: {
          estudar: {
            label: 'Fazer a prova e chegar ao treino com atraso',
            outcomes: ['Nota oito e meio. O treino você recupera no sábado, a paz em casa não teria volta.'],
          },
          pista: {
            label: 'Pedir para fazer a prova de segunda chamada',
            outcomes: ['A escola aceita, e você roda o treino inteiro sem culpa.', 'A escola aceita, mas a bronca em casa dura a semana inteira.'],
          },
        },
      },
      {
        title: 'Trabalho em grupo no fim de semana',
        body: 'O grupo da feira de ciências marcou de montar o vulcão de bicarbonato no sábado, dia de corrida. Os colegas contam com você.',
        choices: {
          estudar: {
            label: 'Montar o vulcão na quinta à noite, virando a madrugada',
            outcomes: ['O vulcão funciona, os colegas agradecem e você chega à pista com sono, mas de consciência leve.'],
          },
          pista: {
            label: 'Dizer ao grupo que a corrida vem primeiro',
            outcomes: [
              'O grupo entende: no fim, colocam o seu nome no cartaz mesmo assim.',
              'O grupo não entende, e a segunda-feira na escola fica bem mais fria.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Escola ---------------- */

  {
    id: 'festa-de-formatura',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'teen' }],
    choices: [
      {
        id: 'ir-festa',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'dormir-cedo',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
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
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Formatura do nono ano no sábado',
        body: 'A turma alugou um salão com DJ e tudo para a formatura do nono ano. É a mesma noite da véspera da corrida, e o pessoal jura que sem você não tem graça.',
        choices: {
          'ir-festa': {
            label: 'Ir à formatura e voltar antes da meia-noite',
            outcomes: ['Você dança, tira foto com a turma toda e acorda no domingo com olheira e um sorriso que não sai do rosto.'],
          },
          'dormir-cedo': {
            label: 'Ficar em casa e deitar cedo antes da corrida',
            outcomes: [
              'A noite bem dormida aparece no cronômetro, mesmo com as fotos da festa pipocando no celular.',
              'O sono vem, mas a cada foto da festa no grupo da turma bate um aperto no peito.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Dançar até tarde e acordar com energia de sobra',
            outcomes: ['Duas horas de sono bastam: o seu corpo parece não conhecer cansaço, e a turma não acredita.'],
          },
        },
      },
      {
        title: 'O baile do terceiro ano',
        body: 'O baile de formatura do terceiro ano é o assunto da escola há meses. A data caiu no fim de semana de corrida, e o traje já está pendurado no armário.',
        choices: {
          'ir-festa': {
            label: 'Vestir o traje de gala e aproveitar o baile',
            outcomes: ['A valsa, os amigos chorando, a foto com os professores: você chega à pista com sono, mas com a memória cheia.'],
          },
          'dormir-cedo': {
            label: 'Trocar o baile por uma noite inteira de sono',
            outcomes: [
              'Você corre com a cabeça leve e o corpo no lugar. O baile, só pelos vídeos dos amigos.',
              'Descanso não falta, mas os vídeos do baile deixam um gosto de coisa perdida que dura dias.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Ir ao baile e ainda largar no domingo cedo',
            outcomes: ['O baile vai até o sol nascer e, ainda assim, você coloca o capacete com a disposição de quem dormiu dez horas.'],
          },
        },
      },
    ],
  },
  {
    id: 'recuperacao-escolar',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'teen' }],
    choices: [
      {
        id: 'reforco',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'estudar-viajando',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'inteligencia',
        requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Recuperação em química',
        body: 'A nota de química veio vermelha, e a coordenação marcou a prova de recuperação para daqui a duas semanas. Em casa, a regra é clara: sem nota azul, sem pista.',
        choices: {
          reforco: {
            label: 'Pagar aulas de reforço com a professora do bairro',
            outcomes: ['Três tardes por semana de fórmulas e tabela periódica. A nota sobe, o treino encolhe e a casa respira aliviada.'],
          },
          'estudar-viajando': {
            label: 'Levar a apostila e estudar entre uma sessão e outra',
            outcomes: [
              'Os mecânicos viram professores improvisados, e a recuperação passa com folga.',
              'A apostila volta para casa suja de graxa e quase intocada. A prova não perdoa, e a bronca também não.',
            ],
          },
          inteligencia: {
            label: 'Resolver todos os exercícios numa única noite',
            outcomes: ['Você enxerga a lógica da matéria de uma vez e tira a melhor nota da recuperação.'],
          },
        },
      },
      {
        title: 'Bilhete da coordenação na mochila',
        body: 'As faltas por causa das corridas pesaram: são três matérias em recuperação. A coordenadora quer uma reunião com a família e já fala em repetir o ano.',
        choices: {
          reforco: {
            label: 'Contratar um professor particular para as três matérias',
            outcomes: ['O professor cobra caro e não alivia, mas as três notas saem do vermelho antes do fim do bimestre.'],
          },
          'estudar-viajando': {
            label: 'Estudar no banco de trás do carro nas viagens',
            outcomes: [
              'As horas de estrada viram horas de estudo, e a recuperação passa sem drama.',
              'O carro balança, o sono vence e o boletim volta com duas notas vermelhas.',
            ],
          },
          inteligencia: {
            label: 'Montar um plano de estudo e cumprir à risca',
            outcomes: ['Organização de engenharia: em dez dias você domina as três matérias e ainda ajuda um colega.'],
          },
        },
      },
      {
        title: 'Inglês abaixo da média',
        body: 'Ironia: logo a matéria que você mais vai precisar se quiser correr fora do país. A professora oferece uma prova substitutiva na semana da próxima etapa.',
        choices: {
          reforco: {
            label: 'Pagar um curso intensivo de conversação',
            outcomes: ['Um mês de aulas puxadas e frases repetidas no espelho. A nota sobe, e o sonho de correr lá fora fica mais perto.'],
          },
          'estudar-viajando': {
            label: 'Treinar o inglês vendo transmissões de corridas estrangeiras',
            outcomes: [
              'Entre uma transmissão e outra, você aprende o vocabulário do paddock e passa na prova.',
              'Você decora termos de box, mas a prova cobra verbos irregulares. Nota baixa de novo.',
            ],
          },
          inteligencia: {
            label: 'Pedir o material e aprender por conta própria',
            outcomes: ['Duas semanas lendo tudo o que aparece pela frente, e a nota mais alta da sala é sua.'],
          },
        },
      },
    ],
  },
  {
    id: 'vestibular-na-reta-final',
    category: 'personal',
    frequency: 'normal',
    when: [
      { c: 'age', to: 'teen' },
      { c: 'careerSeason', min: 3 },
    ],
    choices: [
      {
        id: 'fazer-prova',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'morale', size: -1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'adiar-estudos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Vestibular no sábado da etapa',
        body: 'A primeira fase do vestibular caiu no sábado da próxima etapa, bem na hora do treino livre. Seus pais pagaram a inscrição; a equipe conta com você na pista.',
        choices: {
          'fazer-prova': {
            label: 'Fazer a prova e chegar só para a classificação',
            outcomes: [
              'A prova vai bem, e a cabeça chega leve ao autódromo, mesmo sem o treino.',
              'A prova foi mais difícil que o esperado, e sem o treino livre a classificação vira loteria.',
            ],
          },
          'adiar-estudos': {
            label: 'Deixar o vestibular para o ano que vem',
            outcomes: ['A equipe vê o compromisso e retribui com atenção. Em casa, o silêncio no jantar diz o resto.'],
          },
        },
      },
      {
        title: 'Cursinho ou pista?',
        body: 'Seus pais querem matricular você no cursinho pré-vestibular, com aulas aos sábados. Isso significa menos dias de treino justamente na fase mais importante do campeonato.',
        choices: {
          'fazer-prova': {
            label: 'Topar o cursinho e encaixar os treinos no domingo',
            outcomes: [
              'Você descobre que gosta de estudar física: tudo o que acontece numa curva agora tem explicação.',
              'Os sábados de aula pesam, as notas não aparecem e os treinos de domingo parecem curtos demais.',
            ],
          },
          'adiar-estudos': {
            label: 'Pedir um ano só para a pista antes do cursinho',
            outcomes: ['Os pais aceitam, a contragosto. Com mais horas de treino, até o chefe de equipe nota a diferença.'],
          },
        },
      },
      {
        title: 'A entrevista da bolsa de estudos',
        body: 'Você passou na prova de bolsa de uma faculdade, e a entrevista final é no sábado da corrida. Uma bolsa integral não aparece duas vezes.',
        choices: {
          'fazer-prova': {
            label: 'Ir à entrevista com a melhor roupa do armário',
            outcomes: [
              'A entrevista flui, a bolsa sai, e você chega ao autódromo com a sensação de ter um plano B.',
              'A banca pergunta sobre o futuro, e a resposta trava. Nem bolsa nem treino: o sábado escorre pelas mãos.',
            ],
          },
          'adiar-estudos': {
            label: 'Abrir mão da bolsa e passar o sábado na equipe',
            outcomes: ['A equipe agradece a dedicação com o melhor acerto do ano. Em casa, ninguém fala da bolsa, e esse silêncio pesa.'],
          },
        },
      },
    ],
  },

  /* ---------------- Família ---------------- */

  {
    id: 'aniversario-da-avo',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'adult' }],
    choices: [
      {
        id: 'ir-familia',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ficar-pista',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Noventa anos da vó',
        body: 'A família inteira vai se reunir para os noventa anos da sua avó, com bolo e primos de outros estados. A festa é no sábado à noite, véspera da corrida.',
        choices: {
          'ir-familia': {
            label: 'Passar na festa e pegar a estrada de madrugada',
            outcomes: ['A vó chora no parabéns e segura a sua mão por um minuto inteiro. O sono no grid vale cada segundo.'],
          },
          'ficar-pista': {
            label: 'Mandar um vídeo e dormir cedo no hotel',
            outcomes: [
              'A vó assiste ao vídeo dez vezes e manda um áudio de bênção. Você entra na pista com a cabeça no lugar.',
              'O vídeo chega, mas a foto da família reunida sem você dói mais do que você esperava.',
            ],
          },
        },
      },
      {
        title: 'A vó quer ver uma corrida ao vivo',
        body: 'Depois de anos acompanhando pelo rádio, a sua avó decidiu: quer ver uma corrida de perto. O tio vai levá-la ao autódromo na próxima etapa, com cadeira de praia e marmita.',
        choices: {
          'ir-familia': {
            label: 'Levar a vó para conhecer o box e o carro',
            outcomes: ['Ela senta no carro, pergunta para que serve cada botão e conta ao paddock histórias da sua infância. A concentração fica para depois.'],
          },
          'ficar-pista': {
            label: 'Acenar da pista e manter a rotina de corrida',
            outcomes: [
              'Da arquibancada, a vó vibra a cada volta. Você mantém o foco e dedica o resultado a ela.',
              'A rotina fica intacta, mas o tio conta depois que ela esperou a tarde toda por um abraço que não veio.',
            ],
          },
        },
      },
      {
        title: 'Uma ligação do hospital',
        body: 'A sua avó vai passar por uma cirurgia simples, mas pede para ver você antes. O hospital fica a horas de viagem, e a próxima etapa é logo ali.',
        choices: {
          'ir-familia': {
            label: 'Pegar o primeiro ônibus e passar a tarde no hospital',
            outcomes: ['A cirurgia corre bem, e a vó acorda com você do lado. O treino da semana ficou pela metade, mas a cabeça está em paz.'],
          },
          'ficar-pista': {
            label: 'Ligar por vídeo e prometer uma visita depois da corrida',
            outcomes: [
              'A vó entende tudo e manda você correr. Ela vê a corrida da cama, com o volume no máximo.',
              'A ligação cai duas vezes, e a voz fraca da vó fica ecoando na sua cabeça o fim de semana inteiro.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'pais-brigam-por-dinheiro',
    category: 'personal',
    frequency: 'normal',
    // Pais sem dinheiro e anônimos: não serve para quem herdou o sobrenome (Fase 6).
    when: [
      { c: 'age', to: 'young' },
      { c: 'cash', atMost: 'tight' },
      { c: 'generation', max: 1 },
    ],
    choices: [
      {
        id: 'cortar-gastos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'conversar-com-os-pais',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'morale', size: 2 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'morale', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Vozes altas na cozinha',
        body: 'Você chega mais cedo e ouve os seus pais discutindo na cozinha. O assunto é o boleto da equipe, de novo, e a palavra "loucura" aparece mais de uma vez.',
        choices: {
          'cortar-gastos': {
            label: 'Propor cortar os treinos extras até o fim do ano',
            outcomes: ['A tensão em casa diminui e sobra algum dinheiro no fim do mês. Na pista, a falta de treino aparece.'],
          },
          'conversar-com-os-pais': {
            label: 'Entrar na cozinha e pedir para conversar com os dois',
            outcomes: [
              'A conversa é difícil, mas termina num abraço de três. Pela primeira vez, vocês decidem juntos.',
              'A conversa vira briga a três, e você sai da cozinha com a impressão de ser o motivo de tudo.',
            ],
          },
        },
      },
      {
        title: 'O carro da família à venda',
        body: 'Seu pai colocou o carro da família à venda para pagar a próxima etapa. Sua mãe acha que é passar do limite e não fala com ele há dois dias.',
        choices: {
          'cortar-gastos': {
            label: 'Segurar a venda e abrir mão de um teste',
            outcomes: ['O carro fica na garagem, o casal volta a se falar e o teste particular fica para outra hora.'],
          },
          'conversar-com-os-pais': {
            label: 'Reunir a família na sala para decidir em conjunto',
            outcomes: [
              'Cada um fala, ninguém grita, e a família sai da sala mais unida do que entrou.',
              'A reunião desanda logo nos primeiros minutos, e a casa fica num silêncio pesado a semana inteira.',
            ],
          },
        },
      },
      {
        title: 'Hora extra demais em casa',
        body: 'Sua mãe está pegando plantões extras e seu pai faz bico aos domingos. Os dois vivem exaustos, e qualquer conta nova vira discussão no jantar.',
        choices: {
          'cortar-gastos': {
            label: 'Trocar os pneus novos por usados nas próximas etapas',
            outcomes: ['O orçamento respira e os plantões diminuem. Na pista, os pneus usados cobram o preço em cada curva.'],
          },
          'conversar-com-os-pais': {
            label: 'Agradecer aos dois, de verdade, numa noite sem pressa',
            outcomes: [
              'Seu pai disfarça a emoção, sua mãe nem tenta. O cansaço continua, mas agora tem sentido.',
              'O agradecimento soa como despedida, e a sua mãe desaba. A noite termina em lágrimas, e não das boas.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'irmao-quer-correr',
    category: 'personal',
    frequency: 'normal',
    // A família mal paga uma carreira: não serve para quem herdou o sobrenome (Fase 6).
    when: [
      { c: 'age', to: 'young' },
      { c: 'generation', max: 1 },
    ],
    choices: [
      {
        id: 'ensinar-o-cacula',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'attribute', attribute: 'experience', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'pedir-para-esperar',
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
    ],
    variants: [
      {
        title: 'O caçula também quer correr',
        body: 'Seu irmão mais novo passou o fim de semana inteiro no kartódromo e voltou decidido: quer um kart também. Seus pais olham para você, como quem pede uma opinião.',
        choices: {
          'ensinar-o-cacula': {
            label: 'Ensinar o caçula no seu kart antigo',
            outcomes: ['Explicar o traçado para ele faz você entender coisas que fazia sem pensar. As peças trocadas saem do seu bolso.'],
          },
          'pedir-para-esperar': {
            label: 'Sugerir que ele espere a sua carreira deslanchar',
            outcomes: ['O caçula fica de cara amarrada, mas a família segue bancando uma carreira só e você treina sem dividir atenção.'],
          },
        },
      },
      {
        title: 'Seu irmão anda rápido demais',
        body: 'Numa brincadeira no kart de aluguel, seu irmão caçula fez um tempo melhor que o seu de quando você tinha a idade dele. O kartódromo inteiro comentou.',
        choices: {
          'ensinar-o-cacula': {
            label: 'Levar o caçula a sério e dar dicas de traçado',
            outcomes: ['Em duas tardes ele já freia no ponto certo, e você relembra o básico que tinha esquecido. O aluguel da pista fica por sua conta.'],
          },
          'pedir-para-esperar': {
            label: 'Rir da história e voltar ao seu próprio treino',
            outcomes: ['Você se concentra no que importa agora, mas a pontinha de ciúme demora a passar.'],
          },
        },
      },
      {
        title: 'Pedido na mesa do jantar',
        body: 'No meio do jantar, seu irmão mais novo anuncia que vai pedir um kart de Natal. Todo mundo sabe que o dinheiro da família mal dá para uma carreira.',
        choices: {
          'ensinar-o-cacula': {
            label: 'Prometer ensinar o caçula com o equipamento que sobrou',
            outcomes: ['O macacão velho fica enorme nele e o capacete novo sai do seu bolso, mas o sorriso compensa. Ensinar organiza as suas ideias.'],
          },
          'pedir-para-esperar': {
            label: 'Explicar com calma que agora não dá',
            outcomes: ['Ele entende do jeito dele, chorando um pouco. O orçamento continua inteiro na sua carreira.'],
          },
        },
      },
    ],
  },

  /* ---------------- Amizades ---------------- */

  {
    id: 'amigos-do-bairro',
    category: 'personal',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'aparecer',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'meet', key: 'vida-amigo-bairro', from: 'stranger', role: 'amizade do bairro', org: 'Bicicletaria da Praça', attitude: 2 },
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ficar-no-treino',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'meet', key: 'vida-amigo-bairro', from: 'stranger', role: 'amizade do bairro', org: 'Bicicletaria da Praça', attitude: -1 },
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Churrasco da turma em {cidade}',
        body: 'A turma da rua em {cidade} marcou um churrasco no feriado. {pessoa:vida-amigo-bairro}, amizade desde os tempos do carrinho de rolimã, mandou mensagem: "Se não vier, nem precisa voltar."',
        choices: {
          aparecer: {
            label: 'Ir ao churrasco e matar a saudade da turma',
            outcomes: ['Futebol na rua, causos antigos e muita risada. {primeiro:vida-amigo-bairro} faz questão de tirar foto com o seu macacão.'],
          },
          'ficar-no-treino': {
            label: 'Ficar no treino físico e mandar um áudio',
            outcomes: ['O treino rende, mas {primeiro:vida-amigo-bairro} responde só com um "ok". Seco.'],
          },
        },
      },
      {
        title: 'Telão numa garagem de {cidade}',
        body: 'Seus amigos de {cidade} vão montar um telão numa garagem para ver a próxima corrida juntos. {pessoa:vida-amigo-bairro} quer que você grave um recado para passar antes da largada.',
        choices: {
          aparecer: {
            label: 'Gravar um recado caprichado e ligar ao vivo depois',
            outcomes: ['A garagem explode quando o seu rosto aparece no telão. {primeiro:vida-amigo-bairro} manda vídeos da festa até tarde da noite.'],
          },
          'ficar-no-treino': {
            label: 'Mandar um recado curto e se fechar na concentração',
            outcomes: ['Você entra na corrida com a cabeça só nela. Na garagem, o recado de dez segundos decepciona a turma.'],
          },
        },
      },
      {
        title: 'Aniversário na laje de sempre',
        body: 'É aniversário de {pessoa:vida-amigo-bairro}, e a festa vai ser na laje de sempre, em {cidade}. Faz tempo que você não aparece por lá, e a turma já começou a reparar.',
        choices: {
          aparecer: {
            label: 'Aparecer de surpresa na laje com um bolo',
            outcomes: ['{primeiro:vida-amigo-bairro} quase derruba o bolo de tanto pular. A noite termina tarde, com histórias que só a turma entende.'],
          },
          'ficar-no-treino': {
            label: 'Mandar um presente pelo correio e ficar na equipe',
            outcomes: ['O presente chega, mas a laje cheia nas fotos sem você deixa um gosto amargo dos dois lados.'],
          },
        },
      },
    ],
  },
  {
    id: 'amigo-que-sumiu',
    category: 'personal',
    frequency: 'normal',
    when: [],
    needs: ['person:vida-amigo-bairro'],
    speaker: 'vida-amigo-bairro',
    choices: [
      {
        id: 'ir-atras',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attitude', key: 'vida-amigo-bairro', size: 2 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'dar-espaco',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'attitude', key: 'vida-amigo-bairro', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Mensagens sem resposta',
        body: 'Faz um mês que {pessoa:vida-amigo-bairro} não responde nada: nem mensagem, nem ligação, nem foto da corrida. Alguém da turma diz que as coisas em casa não andam bem.',
        choices: {
          'ir-atras': {
            label: 'Ir até {cidade} bater na porta de {primeiro:vida-amigo-bairro}',
            outcomes: ['A porta abre devagar. Vocês conversam até tarde, e no fim {primeiro:vida-amigo-bairro} diz que precisava só disso.'],
          },
          'dar-espaco': {
            label: 'Mandar uma última mensagem e respeitar o silêncio',
            outcomes: [
              'Você segue a rotina de treino com a preocupação no fundo da cabeça, esperando um sinal que não chega.',
              'Meses depois, alguém conta que {primeiro:vida-amigo-bairro} esperava você aparecer. A amizade esfria de vez.',
            ],
          },
        },
      },
      {
        title: 'Mudança sem despedida',
        body: '{pessoa:vida-amigo-bairro} saiu de {cidade} sem avisar ninguém. Deixou só um recado na rede social: "Precisava recomeçar". O número antigo não existe mais.',
        choices: {
          'ir-atras': {
            label: 'Pedir o contato novo à família de {primeiro:vida-amigo-bairro}',
            outcomes: ['A família passa o número, e a primeira ligação dura duas horas. A distância mudou o endereço, não a amizade.'],
          },
          'dar-espaco': {
            label: 'Deixar um comentário de apoio e não insistir',
            outcomes: [
              'A temporada segue, e de vez em quando você relê aquele recado tentando entender o que perdeu.',
              'O comentário fica sem resposta. Com o tempo, {primeiro:vida-amigo-bairro} vira só uma lembrança da infância.',
            ],
          },
        },
      },
      {
        title: 'Encontro por acaso na estrada',
        body: 'Na volta de uma corrida, numa parada de estrada, você reconhece {pessoa:vida-amigo-bairro} na fila do café. Faz anos que vocês não se falam, e o olhar foge do seu.',
        choices: {
          'ir-atras': {
            label: 'Puxar conversa e oferecer um café',
            outcomes: ['O café vira almoço. {primeiro:vida-amigo-bairro} conta tudo o que passou e promete aparecer na próxima corrida.'],
          },
          'dar-espaco': {
            label: 'Cumprimentar de longe e seguir viagem',
            outcomes: [
              'Você volta para a estrada com aquela imagem na cabeça. O treino da semana sai meio no automático.',
              'Pelo retrovisor, você vê {primeiro:vida-amigo-bairro} acenando tarde demais. A chance passou.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'casamento-de-amigo',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', from: 'young' }],
    choices: [
      {
        id: 'ir-ao-casamento',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'mandar-lembranca',
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
        id: 'carisma',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Convite para ser testemunha',
        body: 'Seu amigo mais antigo vai se casar e quer você como testemunha no altar. A cerimônia é na sexta à noite, véspera dos treinos, a quatro horas do autódromo.',
        choices: {
          'ir-ao-casamento': {
            label: 'Assinar como testemunha e pegar a estrada depois da festa',
            outcomes: ['Você assina o livro, chora no discurso e dança uma música só. A estrada de madrugada cobra no treino de sábado.'],
          },
          'mandar-lembranca': {
            label: 'Mandar um presente e um vídeo emocionado',
            outcomes: ['O vídeo passa no telão da festa e arranca lágrimas. Você dorme cedo no hotel, mas com um vazio no peito.'],
          },
          carisma: {
            label: 'Ir e fazer o discurso que ninguém vai esquecer',
            outcomes: ['Cinco minutos de microfone, o salão inteiro rindo e chorando. Os vídeos rodam as redes, e o paddock comenta.'],
          },
        },
      },
      {
        title: 'Casamento pé na areia',
        body: 'Uma amiga de infância vai se casar na praia, num domingo de folga. O problema: a viagem toma três dias da semana de preparação para a próxima etapa.',
        choices: {
          'ir-ao-casamento': {
            label: 'Viajar para a praia e voltar na véspera do treino',
            outcomes: ['Sol, areia e uma festa que vai até o amanhecer. A semana de preparação vira lembrança, e o hotel da praia sai caro.'],
          },
          'mandar-lembranca': {
            label: 'Ficar e mandar uma lembrança pelos padrinhos',
            outcomes: ['A noiva manda um áudio agradecendo. Você treina a semana inteira, mas vê os vídeos da festa com um nó na garganta.'],
          },
          carisma: {
            label: 'Ir e animar a festa com um brinde inesquecível',
            outcomes: ['O brinde vira o momento da noite, e o vídeo circula entre os convidados. Até o tio que não gosta de corrida pede uma foto.'],
          },
        },
      },
      {
        title: 'O mecânico mais antigo vai casar',
        body: 'O mecânico mais antigo da equipe vai se casar e convidou o box inteiro. A festa é numa chácara longe de tudo, na semana mais apertada do calendário.',
        choices: {
          'ir-ao-casamento': {
            label: 'Ir à festa na chácara com a equipe toda',
            outcomes: ['Você dança forró com o chefe de equipe e ganha um abraço apertado do noivo. O presente custou e a semana encurtou, mas valeu.'],
          },
          'mandar-lembranca': {
            label: 'Mandar um cartão carinhoso e treinar no simulador',
            outcomes: ['O cartão é lido em voz alta na festa. No simulador, as voltas são boas, mas o box parece mais distante.'],
          },
          carisma: {
            label: 'Ir e fazer o discurso em nome dos pilotos',
            outcomes: ['Você fala dos anos de trabalho do mecânico, e o vídeo do discurso roda o paddock inteiro.'],
          },
        },
      },
    ],
  },

  /* ---------------- Namoro e relacionamento ---------------- */

  {
    id: 'namoro-de-escola',
    category: 'personal',
    frequency: 'normal',
    when: [
      { c: 'age', to: 'teen' },
      { c: 'lacks', what: 'partner' },
      { c: 'noFlag', flag: 'vida-namoro-escola' },
    ],
    choices: [
      {
        id: 'assumir-namoro',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'flag', flag: 'vida-namoro-escola' },
            ],
          },
        ],
      },
      {
        id: 'foco-na-pista',
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
    ],
    variants: [
      {
        title: 'Bilhete dobrado na carteira',
        body: 'Alguém da sala ao lado deixou um bilhete dobrado na sua carteira, com um convite para o cinema no sábado. Sábado é dia de treino, mas o coração disparou mais que na largada.',
        choices: {
          'assumir-namoro': {
            label: 'Aceitar o cinema e trocar o treino pelo domingo',
            outcomes: ['Do filme, ninguém lembra. Da mão dada na saída, você vai lembrar por muito tempo.'],
          },
          'foco-na-pista': {
            label: 'Responder que só dá depois do fim da temporada',
            outcomes: ['O treino de sábado sai perfeito, mas o bilhete fica guardado na capinha do celular.'],
          },
        },
      },
      {
        title: 'Par na quadrilha da festa junina',
        body: 'Na festa junina da escola, sobrou um par na quadrilha, e é justamente quem você vive olhando no intervalo. O ensaio é no horário do treino.',
        choices: {
          'assumir-namoro': {
            label: 'Dançar a quadrilha e assumir o namoro no arraial',
            outcomes: ['Vocês erram metade dos passos e riem da outra metade. No fim da festa, a escola inteira já sabe.'],
          },
          'foco-na-pista': {
            label: 'Faltar ao ensaio e deixar o par para outra pessoa',
            outcomes: ['O treino rende, mas na festa você assiste de longe, com um pastel na mão e um nó na garganta.'],
          },
        },
      },
      {
        title: 'Mensagem às duas da manhã',
        body: 'Depois de semanas trocando figurinhas e memes, chega a pergunta direta: "A gente está namorando ou não?". A corrida é daqui a três dias.',
        choices: {
          'assumir-namoro': {
            label: 'Responder que sim, com todas as letras',
            outcomes: ['A resposta sai, o coração sossega e você dorme sorrindo. Concentrar no treino é que ficou mais difícil.'],
          },
          'foco-na-pista': {
            label: 'Pedir um tempo para pensar até depois da corrida',
            outcomes: ['A corrida ganha toda a sua atenção, mas a conversa em suspenso volta à cabeça em cada reta.'],
          },
        },
      },
    ],
  },
  {
    id: 'namoro-cobra-atencao',
    category: 'personal',
    frequency: 'normal',
    when: [
      { c: 'age', to: 'teen' },
      { c: 'flag', flag: 'vida-namoro-escola' },
    ],
    choices: [
      {
        id: 'incluir-namoro',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'terminar-namoro',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
              { e: 'flag', flag: 'vida-namoro-escola', clear: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Você só pensa em corrida',
        body: 'O namoro anda tremido: são três fins de semana seguidos sem cinema, sem praça, sem nada. A última mensagem foi curta: "Você só pensa em corrida".',
        choices: {
          'incluir-namoro': {
            label: 'Convidar para assistir à próxima corrida do box',
            outcomes: ['Do box, o cheiro de pneu e a tensão da largada explicam o que nenhuma mensagem explicava. O namoro sai mais forte.'],
          },
          'terminar-namoro': {
            label: 'Terminar antes que a coisa machuque mais',
            outcomes: ['O término dói, mas a cabeça fica livre para a pista. As músicas tristes duram umas duas semanas.'],
          },
        },
      },
      {
        title: 'Ciúme da sua equipe',
        body: 'Uma foto da comemoração no box, cheia de abraços com o pessoal da equipe, rodou no grupo da escola. Do outro lado do namoro, o ciúme veio rápido.',
        choices: {
          'incluir-namoro': {
            label: 'Apresentar o namoro para o pessoal da equipe',
            outcomes: ['Os mecânicos adotam o casal na hora, e o ciúme vira piada interna. Só a semana de treino ficou para trás.'],
          },
          'terminar-namoro': {
            label: 'Dizer que não dá para viver dando explicação',
            outcomes: ['A conversa termina em término. No domingo, sem celular apitando, você pilota com a cabeça vazia.'],
          },
        },
      },
      {
        title: 'Três meses de namoro e um treino',
        body: 'Três meses de namoro, comemoração marcada na pizzaria, e o chefe de equipe acaba de remarcar o treino para a mesma noite. Uma das duas promessas vai ficar pelo caminho.',
        choices: {
          'incluir-namoro': {
            label: 'Levar a pizza para a pista e comemorar no box',
            outcomes: ['Pizza fria em cima da bancada, velinha espetada num parafuso. O namoro sai mais forte, o acerto nem tanto.'],
          },
          'terminar-namoro': {
            label: 'Assumir que a pista vem primeiro e encerrar o namoro',
            outcomes: ['Um término por mensagem, que você vai lembrar com vergonha. O treino daquela noite, porém, sai redondo.'],
          },
        },
      },
    ],
  },
  {
    id: 'relacionamento-cobra-presenca',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'has', what: 'partner' }],
    choices: [
      {
        id: 'priorizar-relacao',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'relationship', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'explicar-temporada',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'relationship', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'relationship', size: -2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'viajar-juntos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'relationship', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Data especial no sábado da classificação',
        body: 'O aniversário do relacionamento cai no sábado da classificação. Do outro lado da mesa do café, a pergunta vem sem rodeio: "Desta vez você vai estar aqui?"',
        choices: {
          'priorizar-relacao': {
            label: 'Reservar o jantar e pedir à equipe para sair cedo',
            outcomes: ['O jantar é perfeito, a conversa vai longe. No dia seguinte, a cabeça demora a entrar no ritmo da pista.'],
          },
          'explicar-temporada': {
            label: 'Explicar que a temporada está num momento decisivo',
            outcomes: [
              'A resposta é um suspiro e um "boa corrida". Você foca na pista, mas sabe que ficou devendo.',
              'O café termina em silêncio, e o silêncio dura até a corrida. Nada pior para a concentração.',
            ],
          },
          'viajar-juntos': {
            label: 'Levar seu amor para o fim de semana da corrida',
            outcomes: ['Hotel, box e pôr do sol no autódromo: vira uma viagem a dois no meio do trabalho. A conta do quarto extra chega depois.'],
          },
        },
      },
      {
        title: 'A mala que nunca se desfaz',
        body: 'Quem divide a vida com você faz as contas: foram quatro fins de semana fora no último mês. "Às vezes parece que eu moro com uma mala, não com uma pessoa."',
        choices: {
          'priorizar-relacao': {
            label: 'Cancelar o simulador e passar o domingo em casa',
            outcomes: ['Um domingo inteiro sem cronômetro, filme no sofá e comida caseira. A relação respira; o tempo de volta, nem tanto.'],
          },
          'explicar-temporada': {
            label: 'Mostrar o calendário e combinar as folgas do ano',
            outcomes: [
              'O calendário na porta da geladeira ajuda, mas não convence de todo. Pelo menos a pista segue no ritmo.',
              'O calendário vira motivo de discussão: cada folga parece pouca. A semana fica pesada.',
            ],
          },
          'viajar-juntos': {
            label: 'Convidar para a próxima viagem da equipe',
            outcomes: ['Pela primeira vez, a viagem tem companhia. O paddock ganha um rosto novo, e o cartão de crédito sente.'],
          },
        },
      },
      {
        title: 'Uma proposta de emprego longe daqui',
        body: 'Seu amor recebeu uma proposta de trabalho em outra cidade, o sonho de uma carreira inteira. Aceitar significa ver você ainda menos, e a decisão está sendo discutida há dias.',
        choices: {
          'priorizar-relacao': {
            label: 'Apoiar sem condições e reorganizar a sua agenda',
            outcomes: ['A proposta é aceita com a sua bênção. Você troca treinos por viagens de visita, e o casal sai mais firme.'],
          },
          'explicar-temporada': {
            label: 'Dizer que agora a sua carreira precisa de estabilidade',
            outcomes: [
              'A proposta é recusada, e você ganha a rotina de volta. Mas a frase "eu abri mão" vai aparecer de novo.',
              'A proposta é recusada sem conversa, e o ressentimento se instala em casa. Nem a pista distrai.',
            ],
          },
          'viajar-juntos': {
            label: 'Prometer ir para lá em toda folga do calendário',
            outcomes: ['As passagens pesam no bolso, mas cada folga vira uma pequena lua de mel. A distância encolhe.'],
          },
        },
      },
      {
        title: 'Férias que nunca saem',
        body: 'As férias a dois foram adiadas três vezes por causa de testes, eventos e patrocinador. Hoje a agência ligou: a promoção acaba no fim da semana.',
        choices: {
          'priorizar-relacao': {
            label: 'Bloquear uma semana do calendário só para vocês',
            outcomes: ['A semana sem corrida é bloqueada a caneta. Só a promessa já muda o clima em casa, mas a preparação perde ritmo.'],
          },
          'explicar-temporada': {
            label: 'Pedir mais um adiamento até o fim do campeonato',
            outcomes: [
              'O adiamento é aceito com um sorriso amarelo. A preparação segue intacta; a confiança em casa, nem tanto.',
              'O "de novo?" sai alto, a porta bate e a viagem vira ferida aberta. A semana de treino rende pouco.',
            ],
          },
          'viajar-juntos': {
            label: 'Juntar as férias com a viagem da próxima corrida',
            outcomes: ['Três dias de passeio antes da etapa, com hotel melhor e jantar fora. O orçamento sente, o relacionamento agradece.'],
          },
        },
      },
    ],
  },

  /* ---------------- Filhos ---------------- */

  {
    id: 'compromisso-da-crianca',
    category: 'personal',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'children' },
      { c: 'age', to: 'adult' },
    ],
    choices: [
      {
        id: 'estar-presente',
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
        id: 'acompanhar-de-longe',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'morale', size: -2 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'Apresentação de fim de ano na escola',
        body: 'A escola manda o convite: apresentação de fim de ano, com a criança no papel principal da peça. Na mesma tarde, a equipe marcou a reunião de engenharia da próxima etapa.',
        choices: {
          'estar-presente': {
            label: 'Faltar à reunião e sentar na primeira fila',
            outcomes: ['Você grava tudo, aplaude de pé e chora no final. A equipe resolve o acerto sem você e não esconde o incômodo.'],
          },
          'acompanhar-de-longe': {
            label: 'Ficar na reunião e pedir para filmarem a peça',
            outcomes: [
              'A reunião rende um bom acerto. À noite, você assiste ao vídeo três vezes, com um aperto no peito.',
              'O vídeo chega tremido, e a primeira pergunta em casa é "por que você não veio?". Difícil de responder.',
            ],
          },
        },
      },
      {
        title: 'Festa de aniversário com tema de corrida',
        body: 'A criança faz aniversário e escolheu o tema: corrida, com bolo em forma de pista e o seu capacete na mesa. A festa cai na véspera da viagem para a próxima etapa.',
        choices: {
          'estar-presente': {
            label: 'Adiar a viagem e ficar até o último convidado',
            outcomes: [
              'Você ajuda a soprar as velas, corre de carrinho de pedal com a criançada e embarca no último voo. A equipe torce o nariz para o atraso.',
            ],
          },
          'acompanhar-de-longe': {
            label: 'Passar uma hora na festa e embarcar no horário',
            outcomes: [
              'A hora vale ouro: parabéns, foto e abraço. Você chega à pista no horário combinado.',
              'Você sai antes do bolo, e o choro na porta acompanha você até o aeroporto.',
            ],
          },
        },
      },
      {
        title: 'Um bilhete da professora',
        body: 'A professora pediu uma conversa: a criança anda distraída e conta para os colegas que você nunca está em casa. A reunião é na quinta, dia de simulador.',
        choices: {
          'estar-presente': {
            label: 'Ir à reunião e cancelar o simulador',
            outcomes: ['A conversa abre os seus olhos, e a criança vê você na porta da escola. A equipe reagenda o simulador de má vontade.'],
          },
          'acompanhar-de-longe': {
            label: 'Pedir para a reunião ser por chamada de vídeo',
            outcomes: [
              'A professora topa a chamada e dá ótimas dicas. O simulador segue no horário.',
              'A chamada é educada, mas fria. Na saída da escola, a criança procura você e não acha.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'primeira-volta-de-kart-da-crianca',
    category: 'personal',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'children' },
      { c: 'age', to: 'adult' },
    ],
    choices: [
      {
        id: 'levar-a-pista',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'deixar-para-depois',
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
    ],
    variants: [
      {
        title: 'Primeira volta num kart de aluguel',
        body: 'A criança passou a semana pedindo: quer dar uma volta de kart, igual a você. O kartódromo do bairro aluga karts infantis aos domingos.',
        choices: {
          'levar-a-pista': {
            label: 'Levar a criança e correr ao lado na pista',
            outcomes: ['Capacete grande demais, sorriso maior ainda. Você corre do lado, de olho em cada curva, e o jantar ganha assunto para a semana.'],
          },
          'deixar-para-depois': {
            label: 'Prometer a volta para depois do campeonato',
            outcomes: ['A promessa fica anotada na geladeira, com desenho e tudo. Você treina sem distração, mas com um pouco de culpa.'],
          },
        },
      },
      {
        title: 'Um kart infantil de presente',
        body: 'Um mecânico da equipe tem um kart infantil encostado na garagem e oferece de presente. Falta só o capacete, o macacão e alguém com paciência para ensinar.',
        choices: {
          'levar-a-pista': {
            label: 'Comprar o equipamento e dar a primeira aula no domingo',
            outcomes: ['A criança roda devagar, depois um pouco menos devagar. Você nunca torceu tanto por uma volta tão lenta.'],
          },
          'deixar-para-depois': {
            label: 'Guardar o kart até a criança crescer mais um pouco',
            outcomes: ['O kart fica coberto com uma lona na garagem. A criança passa por ele todo dia e pergunta quando vai ser.'],
          },
        },
      },
      {
        title: 'Cockpit de papelão na sala',
        body: 'Depois de ver você na televisão, a criança montou um cockpit de caixas de papelão na sala e anunciou: "Agora é a minha vez de pilotar de verdade".',
        choices: {
          'levar-a-pista': {
            label: 'Marcar uma tarde no kartódromo, só com a criança',
            outcomes: ['Fila de espera, capacete emprestado e uma volta inteira de gritos de alegria. O dia mais caro e mais barato do ano.'],
          },
          'deixar-para-depois': {
            label: 'Prometer que a pista de verdade fica para as férias',
            outcomes: ['O cockpit de papelão vira o brinquedo favorito da casa. Você volta para o treino com o coração dividido.'],
          },
        },
      },
    ],
  },

  /* ---------------- Morar fora e mudar de casa ---------------- */

  {
    id: 'saudade-de-casa-na-italia',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'hub', hub: 'italia' }],
    choices: [
      {
        id: 'ligar-para-casa',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'visitar-o-brasil',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 3 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -2, cap: true },
            ],
          },
        ],
      },
      {
        id: 'mergulhar-no-trabalho',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Saudade do feijão de casa',
        body: 'A massa daqui é ótima, mas faz três meses que você não come um feijão de verdade. No mercado, nem farinha de mandioca se acha. A saudade aperta à noite.',
        choices: {
          'ligar-para-casa': {
            label: 'Fazer chamada de vídeo no almoço de domingo da família',
            outcomes: ['A família vira o celular para a panela de feijão, todo mundo fala ao mesmo tempo, e a saudade aperta e alivia de uma vez.'],
          },
          'visitar-o-brasil': {
            label: 'Comprar passagem e passar a folga no Brasil',
            outcomes: ['Dez dias de colo, comida caseira e a cama de sempre. A passagem dói no bolso, e a volta ao ritmo de treino demora.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Afogar a saudade em horas extras na oficina da equipe',
            outcomes: ['Os mecânicos se acostumam com você na oficina até tarde. O kart melhora, e a saudade só se esconde.'],
          },
        },
      },
      {
        title: 'Feriado longe de todo mundo',
        body: 'Feriado prolongado: a equipe fechou a oficina e cada italiano foi para a casa da família. No seu apartamento, só o barulho da geladeira e as fotos no celular.',
        choices: {
          'ligar-para-casa': {
            label: 'Passar o feriado em chamada de vídeo com a família',
            outcomes: ['O almoço de lá vira o seu jantar daqui. Você ri das piadas do tio, com o fuso atrapalhando, e o feriado fica mais curto.'],
          },
          'visitar-o-brasil': {
            label: 'Pegar o último voo do dia para o Brasil',
            outcomes: ['Você aterrissa a tempo do almoço de domingo, com a família inteira no aeroporto. A fatura do cartão chega depois.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Treinar no feriado com o kartódromo vazio',
            outcomes: ['Voltas e mais voltas num silêncio que nenhum motor preenche. O tempo de volta cai; o ânimo, também.'],
          },
        },
      },
      {
        title: 'O italiano que não entra',
        body: 'No box, todo mundo fala rápido demais, e as piadas passam por cima de você. Na reunião técnica, você entende metade e finge entender o resto.',
        choices: {
          'ligar-para-casa': {
            label: 'Desabafar com a família por mensagem de voz',
            outcomes: ['Sua mãe manda um áudio de seis minutos com conselho, reza e receita de bolo. Funciona melhor que qualquer curso.'],
          },
          'visitar-o-brasil': {
            label: 'Tirar uns dias no Brasil para recarregar',
            outcomes: ['Em casa, ninguém pede para você repetir nada. Você volta com energia e com a carteira bem mais leve.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Ficar depois do expediente para aprender as palavras do box',
            outcomes: ['Os mecânicos viram professores de italiano de oficina. A reunião técnica começa a fazer sentido, mas a solidão continua lá.'],
          },
        },
      },
    ],
  },
  {
    id: 'saudade-de-casa-na-inglaterra',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'hub', hub: 'inglaterra' }],
    choices: [
      {
        id: 'ligar-para-casa',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'visitar-o-brasil',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 3 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -2, cap: true },
            ],
          },
        ],
      },
      {
        id: 'mergulhar-no-trabalho',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Três semanas de céu cinza',
        body: 'Faz três semanas que o sol não aparece. Às quatro da tarde já é noite, e o casaco não sai do corpo. Você abre a foto da praia no celular mais vezes do que admite.',
        choices: {
          'ligar-para-casa': {
            label: 'Ligar para casa e pedir para ver o sol',
            outcomes: ['Do outro lado, um céu azul de doer e a família de bermuda no quintal. A inveja e o carinho chegam juntos.'],
          },
          'visitar-o-brasil': {
            label: 'Usar a folga do calendário para tomar sol no Brasil',
            outcomes: ['Uma semana de calor, pé na areia e pastel de feira. A passagem pesa, e o frio na volta parece ainda pior.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Passar as tardes escuras no simulador da fábrica',
            outcomes: ['Horas no simulador enquanto chove lá fora. Os engenheiros elogiam a dedicação; o espelho mostra outra coisa.'],
          },
        },
      },
      {
        title: 'Churrasco dos brasileiros da região',
        body: 'Um grupo de brasileiros que mora na região marcou um churrasco num parque, com pagode e farofa. É no domingo de folga, e você não conhece ninguém.',
        choices: {
          'ligar-para-casa': {
            label: 'Ir ao churrasco dos brasileiros e matar a saudade',
            outcomes: ['Pagode, picanha e sotaques de todo canto do Brasil. Você volta para casa sem voz e com cinco números novos no celular.'],
          },
          'visitar-o-brasil': {
            label: 'Desistir do churrasco e comprar logo a passagem para casa',
            outcomes: ['Só de pensar no churrasco a saudade cresceu. Você embarca na mesma semana, e o cartão de crédito reclama.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Recusar o convite e estudar a telemetria da última corrida',
            outcomes: ['Os dados mostram onde você perde tempo, e a equipe nota o empenho. O domingo, porém, foi longo e silencioso.'],
          },
        },
      },
      {
        title: 'Aniversário pelo celular',
        body: 'É o seu aniversário, e a festa vai ser lá no Brasil, sem você. A família montou a mesa com bolo e tudo, e vai ligar na hora do parabéns.',
        choices: {
          'ligar-para-casa': {
            label: 'Cantar parabéns por vídeo com a família inteira',
            outcomes: ['Você sopra uma vela num bolinho de mercado enquanto todo mundo canta do outro lado do oceano. Dá para rir e chorar ao mesmo tempo.'],
          },
          'visitar-o-brasil': {
            label: 'Fazer surpresa e aparecer na festa',
            outcomes: ['A porta abre e a festa para. Sua mãe derruba o copo, seu pai finge que não chorou. Nenhum dinheiro foi mais bem gasto.'],
          },
          'mergulhar-no-trabalho': {
            label: 'Trabalhar o dia todo para não pensar na data',
            outcomes: ['A equipe nem sabia do aniversário, e você não contou. O trabalho rende, e a ligação perdida dói à noite.'],
          },
        },
      },
    ],
  },
  {
    id: 'mudanca-de-casa',
    category: 'personal',
    frequency: 'normal',
    // Os pais vendem a casa para um apartamento menor: não serve para quem herdou o sobrenome (Fase 6).
    when: [
      { c: 'age', from: 'young' },
      { c: 'generation', max: 1 },
    ],
    choices: [
      {
        id: 'encarar-a-mudanca',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'manter-a-rotina',
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
    ],
    variants: [
      {
        title: 'A casa da infância vai ser vendida',
        body: 'Seus pais decidiram vender a casa de {cidade} e ir para um apartamento menor. O quarto onde você colava pôster de corrida vai ser de outra família.',
        choices: {
          'encarar-a-mudanca': {
            label: 'Voltar a {cidade} para ajudar a encaixotar tudo',
            outcomes: ['Caixas, poeira e um capacete de brinquedo achado no fundo do armário. Você paga o caminhão e se despede da casa como ela merece.'],
          },
          'manter-a-rotina': {
            label: 'Pedir que guardem as suas coisas e seguir a rotina',
            outcomes: ['Você não perde nenhum treino. Semanas depois, a foto da casa vazia chega no grupo da família e pega você de surpresa.'],
          },
        },
      },
      {
        title: 'Vizinho de cima com bateria',
        body: 'O apartamento novo parecia perfeito, até o vizinho de cima revelar a paixão: bateria, todas as noites, das dez à meia-noite. Dormir antes de corrida virou missão impossível.',
        choices: {
          'encarar-a-mudanca': {
            label: 'Procurar outro apartamento e encarar mais uma mudança',
            outcomes: ['Mais uma mudança, mais uma caução, mais caixas. Mas o quarto novo é silencioso como um box de madrugada.'],
          },
          'manter-a-rotina': {
            label: 'Comprar protetor de ouvido e aguentar firme',
            outcomes: ['O protetor resolve quase tudo. As noites continuam curtas, mas o treino segue sem interrupção.'],
          },
        },
      },
      {
        title: 'Dividir apartamento com um mecânico',
        body: 'O aluguel subiu, e um mecânico da equipe propõe dividir um apartamento perto da oficina. Ele ronca, cozinha bem e acorda às cinco da manhã.',
        choices: {
          'encarar-a-mudanca': {
            label: 'Topar dividir e fazer a mudança no fim de semana',
            outcomes: ['A mudança custa um fim de semana e o frete, mas a convivência rende risadas e conversas sobre o carro até tarde.'],
          },
          'manter-a-rotina': {
            label: 'Agradecer e continuar no apartamento de sempre',
            outcomes: ['Você mantém a sua rotina e o seu silêncio. O mecânico entende, mas no box o papo fica mais curto.'],
          },
        },
      },
    ],
  },

  /* ---------------- Fama, redes e bichos ---------------- */

  {
    id: 'fama-na-escola',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'age', to: 'teen' }],
    choices: [
      {
        id: 'abrir-o-jogo',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ficar-na-sua',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
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
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Seu vídeo rodou a escola inteira',
        body: 'Um vídeo da sua ultrapassagem na última corrida caiu nos grupos da escola. No intervalo, gente que nunca falou com você quer foto, e até o diretor comentou.',
        choices: {
          'abrir-o-jogo': {
            label: 'Abrir um perfil de piloto e postar os bastidores',
            outcomes: ['Os seguidores chegam aos montes, e o celular não para. A atenção é boa; o tempo que ela come, nem tanto.'],
          },
          'ficar-na-sua': {
            label: 'Agradecer a todo mundo e não alimentar a onda',
            outcomes: ['A onda passa em uma semana, e a fila da cantina volta a ser só uma fila. A cabeça agradece.'],
          },
          carisma: {
            label: 'Fazer uma transmissão ao vivo respondendo à escola toda',
            outcomes: ['Duas horas de perguntas, risadas e histórias de corrida. Os patrocinadores descobrem a transmissão e pedem mais.'],
          },
        },
      },
      {
        title: 'Convite do grêmio estudantil',
        body: 'O grêmio da escola quer que você fale na semana das profissões, no auditório, para todas as turmas. A preparação da palestra toma justamente as tardes de treino.',
        choices: {
          'abrir-o-jogo': {
            label: 'Aceitar e preparar uma palestra com vídeos das corridas',
            outcomes: ['O auditório lota, e as fotos rodam as redes da escola. O treino da semana, porém, ficou pela metade.'],
          },
          'ficar-na-sua': {
            label: 'Recusar com educação e indicar outro colega',
            outcomes: ['O colega dá conta do recado, e você treina a semana inteira. Na escola, há quem ache que a fama subiu à cabeça.'],
          },
          carisma: {
            label: 'Subir ao palco sem papel e improvisar',
            outcomes: ['Sem roteiro, você conta a corrida como quem narra uma final de campeonato. Aplausos de pé e professores pedindo autógrafo.'],
          },
        },
      },
      {
        title: 'Meme com o seu nome',
        body: 'Um colega transformou a sua foto de capacete torto num meme, e agora todo mundo da escola compartilha. Uns riem com você, outros riem de você.',
        choices: {
          'abrir-o-jogo': {
            label: 'Entrar na brincadeira e postar a foto original',
            outcomes: ['Rir junto desarma a piada: o meme vira mascote da torcida da escola. Só o treino perdeu umas horas.'],
          },
          'ficar-na-sua': {
            label: 'Ignorar o meme e esperar a poeira baixar',
            outcomes: ['Sem dar trela, você treina em paz, e o meme morre em duas semanas, levando junto um pouco da sua fama.'],
          },
          carisma: {
            label: 'Gravar um vídeo engraçado respondendo ao meme',
            outcomes: ['A resposta é tão boa que passa o meme em visualizações. Até gente de outras escolas pede para torcer por você.'],
          },
        },
      },
    ],
  },
  {
    id: 'bicho-de-estimacao',
    category: 'personal',
    frequency: 'normal',
    // Os pais não têm como pagar o veterinário: não serve para quem herdou o sobrenome (Fase 6).
    when: [{ c: 'generation', max: 1 }],
    choices: [
      {
        id: 'cuidar-do-bicho',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 2 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'seguir-o-treino',
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
    ],
    variants: [
      {
        title: 'Um vira-lata no paddock',
        body: 'Um vira-lata magrinho apareceu no paddock e passou o fim de semana deitado ao lado do seu equipamento. Na hora de ir embora, ele senta na porta do carro e não sai.',
        choices: {
          'cuidar-do-bicho': {
            label: 'Adotar o vira-lata do paddock',
            outcomes: ['Vacina, ração, coleira nova e um companheiro que espera você na porta depois de cada corrida. Melhor torcida não há.'],
          },
          'seguir-o-treino': {
            label: 'Pedir ao pessoal do autódromo para cuidar dele',
            outcomes: ['O cachorro fica com o zelador do autódromo. Você segue a rotina sem bicho para cuidar, mas pensa no vira-lata mais do que gostaria.'],
          },
        },
      },
      {
        title: 'O cachorro velho da família',
        body: 'O cachorro que cresceu junto com você está doente, e o veterinário fala em exames caros. Seus pais dizem que dão um jeito, mas a voz deles não convence.',
        choices: {
          'cuidar-do-bicho': {
            label: 'Pagar os exames e ir junto ao veterinário',
            outcomes: ['Os exames trazem boa notícia: é tratável. O rabo abana fraquinho quando você chega, e isso basta.'],
          },
          'seguir-o-treino': {
            label: 'Deixar a família resolver e manter o foco nos treinos',
            outcomes: ['A família cuida de tudo e você não perde treino. Mas cada foto dele no grupo da família aperta o peito.'],
          },
        },
      },
      {
        title: 'O gato que dorme no capacete',
        body: 'O gato da casa decidiu que o seu capacete é a cama oficial dele. Agora, na semana da corrida, ele derrubou o capacete da prateleira e a viseira trincou.',
        choices: {
          'cuidar-do-bicho': {
            label: 'Comprar viseira nova e uma caminha só para o gato',
            outcomes: ['A caminha é ignorada, claro: ele dorme na caixa da viseira. A conta dói, mas a foto faz sucesso no grupo da equipe.'],
          },
          'seguir-o-treino': {
            label: 'Fechar a porta do quarto e esconder o equipamento',
            outcomes: ['O equipamento fica a salvo, e a sua concentração também, apesar do miado indignado na porta toda noite.'],
          },
        },
      },
    ],
  },
  /* ---------------- Filhos que nascem pela vida pessoal (Fase 6) ---------------- */

  {
    id: 'conversa-sobre-um-filho',
    category: 'personal',
    frequency: 'common',
    when: [
      { c: 'has', what: 'roomForChild' },
      { c: 'age', from: 'young' },
    ],
    choices: [
      {
        id: 'aumentar-a-familia',
        outcomes: [
          {
            odds: 'sure',
            effects: [{ e: 'child' }, { e: 'relationship', size: 1 }, { e: 'stat', stat: 'morale', size: 2 }],
          },
        ],
      },
      { id: 'esperar-mais-um-pouco', outcomes: [{ odds: 'sure', effects: [{ e: 'relationship', size: -1 }] }] },
    ],
    variants: [
      {
        title: 'A conversa que faltava',
        body: 'Numa noite sem treino nem viagem, a conversa em casa chega aonde vinha rondando faz tempo: um filho. A agenda da temporada está aberta em cima da mesa, e ninguém olha para ela.',
        choices: {
          'aumentar-a-familia': {
            label: 'Dizer que sim, com o calendário e tudo',
            outcomes: ['Meses depois, {bebe} chega ao mundo no meio de uma semana de corrida. O cansaço vem, e a alegria vem junto.'],
          },
          'esperar-mais-um-pouco': {
            label: 'Pedir para esperar a temporada acabar',
            outcomes: ['O assunto volta para a gaveta, mas deixa um silêncio estranho na mesa do jantar.'],
          },
        },
      },
      {
        title: 'O quarto dos capacetes',
        body: 'O quarto de hóspedes vive cheio de capacetes e caixas de peças. Hoje a pergunta veio meio de brincadeira, meio a sério: e se ele virasse um quarto de bebê?',
        choices: {
          'aumentar-a-familia': {
            label: 'Começar a esvaziar o quarto naquele mesmo dia',
            outcomes: ['{bebe} nasce num domingo de corrida, e o quarto dos capacetes ganha um berço. A coleção vai para a garagem sem reclamação.'],
          },
          'esperar-mais-um-pouco': {
            label: 'Responder que ainda não é a hora',
            outcomes: ['As caixas de peças continuam no quarto, e a conversa termina mais curta do que começou.'],
          },
        },
      },
      {
        title: 'Contas que não são de corrida',
        body: 'Entre uma viagem e outra, vocês passam uma tarde fazendo contas que não são de vaga nem de patrocínio: escola, pediatra, quem fica em casa nas semanas de corrida.',
        choices: {
          'aumentar-a-familia': {
            label: 'Fechar as contas e decidir que vale a pena',
            outcomes: ['As contas não fecham com perfeição, mas {bebe} chega e faz todas elas parecerem pequenas.'],
          },
          'esperar-mais-um-pouco': {
            label: 'Deixar as contas para o ano que vem',
            outcomes: ['As planilhas voltam para a pasta. O assunto fica, à espera de uma temporada mais calma.'],
          },
        },
      },
    ],
  },
  {
    id: 'bebe-a-caminho',
    category: 'personal',
    frequency: 'common',
    when: [
      { c: 'has', what: 'roomForChild' },
      { c: 'age', from: 'young' },
    ],
    choices: [
      {
        id: 'contar-para-a-equipe',
        outcomes: [
          {
            odds: 'sure',
            effects: [{ e: 'child' }, { e: 'stat', stat: 'teamTrust', size: 1 }, { e: 'stat', stat: 'morale', size: 1 }],
          },
        ],
      },
      {
        id: 'guardar-a-noticia',
        outcomes: [
          {
            odds: 'sure',
            effects: [{ e: 'child' }, { e: 'relationship', size: 2 }, { e: 'stat', stat: 'form', size: -1 }],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Notícia boa no meio da semana',
        body: 'O telefone toca entre dois treinos no simulador: a família vai crescer. Do outro lado da linha, uma voz que mistura riso e choro.',
        choices: {
          'contar-para-a-equipe': {
            label: 'Contar para todo mundo na equipe',
            outcomes: ['A equipe faz festa no box, e meses depois {bebe} ganha um macacão minúsculo com o número do seu carro.'],
          },
          'guardar-a-noticia': {
            label: 'Guardar a notícia só para a família por enquanto',
            outcomes: [
              'O segredo dura até o nascimento de {bebe}. Em casa, os meses de espera aproximam ainda mais a família, e os treinos ficam em segundo plano.',
            ],
          },
        },
      },
      {
        title: 'Um exame que muda o ano',
        body: 'O resultado do exame chega por mensagem, com três pontos de exclamação: vem um bebê aí. A temporada inteira ganha outro sentido.',
        choices: {
          'contar-para-a-equipe': {
            label: 'Espalhar a novidade no grupo da equipe',
            outcomes: ['O grupo da equipe explode em mensagens. No dia em que {bebe} nasce, os mecânicos mandam um vídeo cantando parabéns.'],
          },
          'guardar-a-noticia': {
            label: 'Esperar o momento certo para contar',
            outcomes: [
              'Só a família sabe até o fim. {bebe} nasce numa semana sem corrida, como quem escolhe a data, e o ritmo dos treinos sente os meses de espera.',
            ],
          },
        },
      },
      {
        title: 'Vem aí mais alguém',
        body: 'A família recebe a notícia num jantar comum, entre o arroz e a salada: vem aí um bebê. Ninguém termina o prato.',
        choices: {
          'contar-para-a-equipe': {
            label: 'Brindar na hora e avisar a equipe no dia seguinte',
            outcomes: ['O brinde vira tradição de jantar até a chegada de {bebe}, e a equipe manda flores para a maternidade.'],
          },
          'guardar-a-noticia': {
            label: 'Combinar de contar só depois de alguns meses',
            outcomes: ['O segredo pesa e alegra ao mesmo tempo. Quando {bebe} chega, a notícia corre mais rápido que qualquer volta lançada.'],
          },
        },
      },
    ],
  },
];
