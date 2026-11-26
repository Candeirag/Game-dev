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
            outcomes: ['Os mecânicos ouvem a resposta pela transmissão, no caminhão da equipe, e comemoram como se tivessem pilotado.'],
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
            label: 'Agradecer ao time pelo equipamento que entregou',
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
        body: 'Gente da {equipeTopo} acompanhou a sua temporada e convida você para uma avaliação. Na academia, a vaga é paga, mas só vale um patrocinador pessoal, sem investidor nem vaquinha, e é preciso terminar cada temporada entre os {meta} primeiros. Chance de aprovação: {chance}.',
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
            label: 'Dizer que prefere construir o próprio caminho',
            outcomes: ['O diretor respeita a decisão e deixa a porta aberta. A noite de sono vem sem peso.'],
          },
        },
      },
    ],
  },

  /* ---------------- Imprensa ---------------- */

  {
    id: 'imprensa-segundo-degrau-podio',
    category: 'career',
    frequency: 'common',
    when: [
      { c: 'race', tag: 'podium' },
      { c: 'notRace', tag: 'win' },
    ],
    choices: [
      {
        id: 'reconhecer',
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
        id: 'prometer',
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
              { e: 'sponsorMood', who: 'all', size: 2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Champanhe, mas não o do topo',
        body: 'Você subiu ao pódio em {pista}, só que não no degrau mais alto. Na sala de imprensa, o repórter vai direto ao ponto: faltou equipamento ou faltou piloto?',
        choices: {
          reconhecer: {
            label: 'Admitir que o vencedor foi mais rápido hoje',
            outcomes: ['A franqueza agrada a sala, mas a frase fica martelando na sua cabeça até o próximo treino.'],
          },
          prometer: {
            label: 'Garantir que no próximo domingo o degrau é seu',
            outcomes: [
              'A promessa sai firme e a manchete compra a ideia. Você chega à próxima etapa com fome.',
              'A frase vira meme nas redes antes do jantar. Promessa demais, resultado de menos.',
            ],
          },
          carisma: {
            label: 'Responder com uma piada sobre o tamanho do troféu',
            outcomes: ['A sala gargalha, o vídeo roda o país e os patrocinadores adoram o jeito leve de quem sabe perder.'],
          },
        },
      },
      {
        title: 'Câmera ligada no parque fechado',
        body: 'Ainda de capacete na mão, você ganha um microfone na cara. O canal de TV quer saber se o pódio em {pista} muda alguma coisa na briga do campeonato.',
        choices: {
          reconhecer: {
            label: 'Dizer que hoje o resultado possível foi esse',
            outcomes: ['A resposta sensata cai bem com a audiência, mas no caminho para o hotel você se pergunta se não aceitou pouco.'],
          },
          prometer: {
            label: 'Avisar que daqui para a frente ninguém segura você',
            outcomes: [
              'A frase abre o telejornal da noite, e a equipe inteira entra no clima da virada.',
              'A frase abre o telejornal, e os rivais recortam o trecho para colar na parede da oficina deles.',
            ],
          },
          carisma: {
            label: 'Puxar o repórter para a foto com o troféu',
            outcomes: ['A cena descontraída vira a imagem do fim de semana, e os patrocinadores pedem cópia em alta resolução.'],
          },
        },
      },
      {
        title: 'Podcast ao vivo, microfone aberto',
        body: 'Um podcast de automobilismo transmite direto do paddock e chama você para comentar o pódio. O apresentador provoca: pódio sem vitória é prêmio de consolação?',
        choices: {
          reconhecer: {
            label: 'Responder que perder para quem foi melhor faz parte',
            outcomes: ['Os ouvintes elogiam a maturidade nos comentários. Por dentro, a provocação ainda arde.'],
          },
          prometer: {
            label: 'Devolver que a próxima vitória vai ser dedicada a ele',
            outcomes: [
              'O apresentador ri, a audiência dispara e você sai do estúdio improvisado com a sensação de que pode tudo.',
              'A resposta soa arrogante fora de contexto, e o corte que circula não ajuda nada.',
            ],
          },
          carisma: {
            label: 'Virar o jogo e entrevistar o apresentador',
            outcomes: ['Em dois minutos o programa é seu. O episódio bate recorde, e os seus patrocinadores compartilham o trecho o dia inteiro.'],
          },
        },
      },
      {
        title: 'O jornal de {cidade} quer a manchete',
        body: 'O jornal da sua cidade mandou um repórter só para cobrir a corrida em {pista}. Pódio é capa, mas ele quer uma frase forte para acompanhar a foto.',
        choices: {
          reconhecer: {
            label: 'Dar a frase honesta: dava para mais, mas não hoje',
            outcomes: ['A capa sai bonita e sóbria. Na padaria do bairro, comentam que falta um pouco de sangue nos olhos.'],
          },
          prometer: {
            label: 'Prometer à cidade uma vitória ainda neste ano',
            outcomes: [
              'A cidade compra a promessa, e as mensagens de apoio dos vizinhos enchem o seu telefone.',
              'A manchete sai em letras enormes e vira cobrança em cada esquina do bairro.',
            ],
          },
          carisma: {
            label: 'Contar ao repórter a história do primeiro kart',
            outcomes: ['A matéria ocupa duas páginas, emociona a cidade e chega até a mesa dos seus patrocinadores.'],
          },
        },
      },
    ],
  },
  {
    id: 'imprensa-depois-do-abandono',
    category: 'career',
    frequency: 'common',
    when: [{ c: 'race', tag: 'dnf' }],
    choices: [
      {
        id: 'proteger',
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
        id: 'desabafar',
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
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'sponsorMood', who: 'all', size: -1 },
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
        title: 'A corrida acabou cedo em {pista}',
        body: 'O abandono ainda está quente quando a assessoria da {equipe} aponta a fila de jornalistas. Todo mundo quer saber o que deu errado, e as câmeras já estão gravando.',
        choices: {
          proteger: {
            label: 'Assumir a culpa pela equipe, mesmo sem ter certeza',
            outcomes: ['A equipe agradece em silêncio. Você engole a frustração e vai dormir com ela.'],
          },
          desabafar: {
            label: 'Contar com franqueza o que sentiu na pista',
            outcomes: [
              'A sinceridade cai bem: o público vê alguém que sente a corrida de verdade.',
              'A franqueza soa como acusação à equipe, e os patrocinadores pedem mais cuidado nas palavras.',
            ],
          },
          carisma: {
            label: 'Transformar a decepção numa resposta que todo mundo entende',
            outcomes: ['Você fala do abandono com tanta clareza que até os críticos elogiam. O trecho circula a semana toda.'],
          },
        },
      },
      {
        title: 'Um repórter no caminho de volta',
        body: 'Você nem tirou a balaclava e já tem um repórter perguntando se o fim de semana em {pista} foi jogado fora. Atrás dele, o chefe de equipe faz sinal para você medir as palavras.',
        choices: {
          proteger: {
            label: 'Dizer que a equipe acertou e o azar foi seu',
            outcomes: ['O chefe faz um joinha discreto. Por dentro, a raiva continua sem ter para onde ir.'],
          },
          desabafar: {
            label: 'Falar que o fim de semana inteiro foi um desastre',
            outcomes: [
              'A honestidade crua rende elogios: finalmente alguém que não fala em clichê.',
              'A palavra desastre vira manchete, e a equipe passa a semana explicando o que você quis dizer.',
            ],
          },
          carisma: {
            label: 'Fazer graça com o próprio azar e mudar de assunto',
            outcomes: ['A risada desarma a pergunta. No dia seguinte, ninguém fala do abandono, só da sua resposta.'],
          },
        },
      },
      {
        title: 'Coletiva de quem não terminou',
        body: 'A organização chama os pilotos que abandonaram para uma coletiva rápida. Você senta ao lado de gente com a mesma cara de enterro e uma pergunta pronta para cada um.',
        choices: {
          proteger: {
            label: 'Elogiar o trabalho dos mecânicos durante o fim de semana',
            outcomes: ['Os mecânicos ouvem pela transmissão e vêm apertar a sua mão. A dor do abandono, essa, fica.'],
          },
          desabafar: {
            label: 'Admitir que a cabeça ainda está fervendo',
            outcomes: [
              'A frase humana pega bem, e os jornalistas saem falando da sua garra.',
              'O tom passa do ponto, e o recorte que circula mostra só a parte mais amarga.',
            ],
          },
          carisma: {
            label: 'Puxar a conversa para os outros pilotos da mesa',
            outcomes: ['Você vira a pessoa que conduz a coletiva, e a imprensa passa a semana falando do seu jeito de liderar.'],
          },
        },
      },
      {
        title: 'Mensagens dos fãs depois do abandono',
        body: 'O telefone não para: fãs, curiosos e um jornalista que acompanha você desde {cidade} pedem uma palavra sobre o abandono em {pista}. A equipe sugere uma nota curta nas redes.',
        choices: {
          proteger: {
            label: 'Publicar a nota da equipe sem mudar uma vírgula',
            outcomes: ['A nota protege todo mundo, menos o seu humor, que segue no chão até a próxima etapa.'],
          },
          desabafar: {
            label: 'Gravar um vídeo dizendo exatamente o que pensa',
            outcomes: [
              'O vídeo emociona, e os comentários se enchem de gente prometendo torcer ainda mais.',
              'O vídeo é visto como um recado à equipe, e o comercial da {equipe} liga reclamando.',
            ],
          },
          carisma: {
            label: 'Responder aos fãs um por um, com bom humor',
            outcomes: ['As respostas viram uma corrente nas redes. Os patrocinadores repostam e agradecem o carinho com o público.'],
          },
        },
      },
    ],
  },
  {
    id: 'imprensa-fase-ruim',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'stat', stat: 'form', level: 'low' },
      { c: 'notRace', tag: 'podium' },
    ],
    choices: [
      {
        id: 'paciencia',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'all', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'blindar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'sponsorMood', who: 'all', size: -1 },
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
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A pergunta que você não queria ouvir',
        body: 'Faz semanas que nada encaixa, e a imprensa já fala em crise. Na entrevista desta semana, a primeira pergunta é se você ainda merece um lugar {categoria:em}.',
        choices: {
          paciencia: {
            label: 'Pedir paciência e prometer trabalho',
            outcomes: ['Os patrocinadores gostam do tom sereno. Você, nem tanto: a dúvida da pergunta fica rondando.'],
          },
          blindar: {
            label: 'Cancelar as entrevistas até a fase virar',
            outcomes: [
              'Longe dos microfones, você treina em paz e volta a sentir o volante.',
              'O silêncio é lido como fuga, e os patrocinadores reclamam da falta de exposição.',
            ],
          },
          carisma: {
            label: 'Rir da própria fase e contar o pior momento dela',
            outcomes: ['A autocrítica bem-humorada desarma a crise. O paddock passa a torcer pela sua volta por cima.'],
          },
        },
      },
      {
        title: 'Coluna de jornal pede a sua cabeça',
        body: 'Um colunista conhecido escreveu que o seu tempo passou antes mesmo de chegar. A {equipe} recebe pedidos de entrevista o dia inteiro, todos querendo a sua resposta.',
        choices: {
          paciencia: {
            label: 'Responder com números de treino e calma',
            outcomes: ['A resposta técnica acalma quem paga as contas, mas o texto do colunista continua na sua cabeça.'],
          },
          blindar: {
            label: 'Pedir à equipe que recuse todos os pedidos',
            outcomes: [
              'Sem barulho por perto, você se concentra só na pilotagem, e o rendimento começa a voltar.',
              'O colunista escreve uma segunda coluna sobre o seu sumiço, ainda mais dura que a primeira.',
            ],
          },
          carisma: {
            label: 'Convidar o colunista para uma volta no simulador',
            outcomes: ['O colunista sai do simulador suando e escreve uma terceira coluna, desta vez cheia de respeito.'],
          },
        },
      },
      {
        title: 'Entrevista no meio da maré baixa',
        body: 'O programa de rádio da manhã liga ao vivo. O locutor lista os seus últimos resultados em voz alta, devagar, e pergunta o que está acontecendo.',
        choices: {
          paciencia: {
            label: 'Explicar que fase ruim se vira treinando, não falando',
            outcomes: ['A frase pega bem com os patrocinadores, mas ouvir a lista em voz alta deixa marca.'],
          },
          blindar: {
            label: 'Desligar e pedir à assessoria um tempo sem rádio',
            outcomes: [
              'A semana fica silenciosa e produtiva. No treino seguinte, os tempos voltam a aparecer.',
              'O locutor comenta ao vivo que você desligou na cara dele, e a história se espalha.',
            ],
          },
          carisma: {
            label: 'Pedir ao locutor que leia também os seus melhores dias',
            outcomes: ['O locutor ri, lê a lista e encerra desejando boa sorte. Você desliga de alma lavada.'],
          },
        },
      },
    ],
  },
  {
    id: 'imprensa-polemica-punicao',
    category: 'career',
    frequency: 'common',
    when: [{ c: 'race', tag: 'penalized' }],
    choices: [
      {
        id: 'acatar',
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
        id: 'criticar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
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
        title: 'A punição que dividiu o paddock',
        body: 'A punição que você recebeu em {pista} virou assunto. Metade do paddock acha justa, a outra metade acha absurda, e os jornalistas querem saber de que lado você está.',
        choices: {
          acatar: {
            label: 'Aceitar a decisão e dizer que vai aprender com ela',
            outcomes: ['A postura é elogiada até pelos comissários. Por dentro, a sensação de injustiça demora a passar.'],
          },
          criticar: {
            label: 'Dizer que os comissários erraram feio',
            outcomes: [
              'A torcida fica do seu lado, e você sai da coletiva de alma lavada.',
              'Os comissários não gostam do tom e abrem um processo por conduta. Mais pontos na licença.',
            ],
          },
          carisma: {
            label: 'Explicar o lance com bom humor, sem atacar ninguém',
            outcomes: ['Você desmonta a polêmica sem levantar a voz. Os patrocinadores adoram a elegância da resposta.'],
          },
        },
      },
      {
        title: 'Replay em câmera lenta no telão',
        body: 'O canal oficial passou o seu lance punido em câmera lenta, de cinco ângulos. Agora o vídeo está em todo lugar, e a entrevista coletiva começa em dez minutos.',
        choices: {
          acatar: {
            label: 'Ver o replay com os jornalistas e reconhecer o excesso',
            outcomes: ['Reconhecer em público custa caro ao orgulho, mas o paddock passa a respeitar a sua palavra.'],
          },
          criticar: {
            label: 'Mostrar o ângulo que os comissários ignoraram',
            outcomes: [
              'O ângulo novo convence muita gente, e a sua versão ganha força nas redes.',
              'O ângulo novo não convence ninguém, e a direção de prova anota mais uma na sua ficha.',
            ],
          },
          carisma: {
            label: 'Narrar o próprio lance como um locutor empolgado',
            outcomes: ['A narração vira o vídeo mais visto do fim de semana. A polêmica perde força, e a sua imagem ganha.'],
          },
        },
      },
      {
        title: 'Comunicado oficial pede silêncio',
        body: 'A organização soltou um comunicado curto sobre a sua punição em {pista} e pediu que os pilotos não comentem o caso. Os repórteres, claro, comentam por você.',
        choices: {
          acatar: {
            label: 'Respeitar o pedido e falar só da próxima etapa',
            outcomes: ['A organização aprecia a disciplina, mas guardar tudo para si pesa mais do que você imaginava.'],
          },
          criticar: {
            label: 'Furar o silêncio e chamar a punição de absurda',
            outcomes: [
              'A frase corajosa vira bandeira da torcida, e você ganha força para a próxima.',
              'A organização responde com outro comunicado, agora com pontos a mais na sua licença.',
            ],
          },
          carisma: {
            label: 'Comentar a punição só com ironia fina',
            outcomes: ['Todo mundo entende o recado, e ninguém pode reclamar dele. Os patrocinadores riem junto.'],
          },
        },
      },
    ],
  },
  {
    id: 'imprensa-microfone-insistente',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'noPoints' }],
    choices: [
      {
        id: 'cumprir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'all', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'escapar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'franqueza',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'low' }],
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: -2 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O repórter que não larga o osso',
        body: 'Fora dos pontos em {pista}, você tenta passar direto pela zona de entrevistas. Um repórter insistente corre ao seu lado e repete a mesma pergunta pela terceira vez.',
        choices: {
          cumprir: {
            label: 'Parar e responder o básico, sem floreio',
            outcomes: ['A resposta protocolar agrada a assessoria e os patrocinadores. Você chega à equipe com a paciência no fim.'],
          },
          escapar: {
            label: 'Seguir andando e fingir que não ouviu',
            outcomes: ['Você ganha paz, mas a imagem de quem foge das câmeras vai parar no jornal.'],
          },
          franqueza: {
            label: 'Parar, encarar e dizer exatamente o que pensa da pergunta',
            outcomes: [
              'A resposta seca viraliza pelo lado bom: muita gente gosta de quem não enrola.',
              'A resposta seca soa grosseira, e o corte com a sua cara fechada roda o país.',
            ],
          },
        },
      },
      {
        title: 'Zona mista, cara fechada',
        body: 'O regulamento obriga você a passar pela zona mista. Depois de uma corrida sem pontos, falar com doze emissoras seguidas parece pior que mais vinte voltas.',
        choices: {
          cumprir: {
            label: 'Repetir a mesma resposta curta para todas as emissoras',
            outcomes: ['Doze vezes a mesma frase. O comercial da equipe aplaude, e você termina sem vontade de falar com ninguém.'],
          },
          escapar: {
            label: 'Pedir à assessoria para encurtar a fila',
            outcomes: ['A fila encurta, o humor melhora, e três emissoras saem reclamando no ar.'],
          },
          franqueza: {
            label: 'Avisar que hoje a conversa vai ser sem filtro',
            outcomes: [
              'O sem filtro rende o melhor material do fim de semana, e a crítica elogia a autenticidade.',
              'O sem filtro passa do limite na quarta emissora, e a equipe tem de pedir desculpas por você.',
            ],
          },
        },
      },
      {
        title: 'A pergunta sobre o seu futuro',
        body: 'Na saída da pista, uma jornalista de televisão pergunta, com o microfone já ligado, se a {equipe} ainda confia em você depois de mais uma corrida sem pontos.',
        choices: {
          cumprir: {
            label: 'Responder que a confiança é mútua e encerrar ali',
            outcomes: ['A frase pronta resolve o problema da equipe e dos patrocinadores. O seu humor é que paga.'],
          },
          escapar: {
            label: 'Apontar para o relógio e dizer que tem reunião',
            outcomes: ['A desculpa funciona, mas a jornalista comenta no ar que você estava com pressa demais.'],
          },
          franqueza: {
            label: 'Devolver a pergunta: por que ela não pergunta à equipe?',
            outcomes: [
              'A resposta afiada vira assunto, e muita gente aplaude a coragem de não se esconder.',
              'A resposta afiada parece arrogância, e os comentários do vídeo não perdoam.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Rivais ---------------- */

  {
    id: 'rival-provoca-nas-redes',
    category: 'career',
    frequency: 'normal',
    when: [],
    needs: ['rival'],
    choices: [
      {
        id: 'ignorar',
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
        id: 'responder',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'rivalry', who: 'rival', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'rival', size: 2 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'guardar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'rivalry', who: 'rival', size: 2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{rival} posta uma indireta',
        body: 'No meio da semana, {rival} publica um vídeo dele ultrapassando alguém e escreve: "tem gente que só anda rápido no simulador". Ninguém precisa de legenda para saber de quem ele fala.',
        choices: {
          ignorar: {
            label: 'Não responder e deixar a provocação morrer sozinha',
            outcomes: ['A provocação perde força sem resposta, e o paddock elogia a sua elegância. Engolir a resposta é que custa.'],
          },
          responder: {
            label: 'Responder com um vídeo do seu melhor tempo',
            outcomes: [
              'O seu vídeo tem o dobro de visualizações do dele. A torcida adora, e {rival} sente o golpe.',
              'A troca de vídeos vira novela, e os patrocinadores pedem que você saia dessa briga.',
            ],
          },
          guardar: {
            label: 'Salvar o print e prometer responder na pista',
            outcomes: ['O print vai para a tela de bloqueio do seu telefone. Cada vez que você olha, a vontade de passar {rival} aumenta.'],
          },
        },
      },
      {
        title: 'Um comentário atravessado de {rival}',
        body: 'Numa foto sua comemorando, {rival} comenta só três palavras: "sorte de principiante". Em uma hora, o comentário tem mais curtidas que a foto.',
        choices: {
          ignorar: {
            label: 'Apagar a notificação e ir treinar',
            outcomes: ['Você não alimenta a briga, e os jornalistas notam a maturidade. Mas as três palavras ficam rondando.'],
          },
          responder: {
            label: 'Responder com uma foto antiga dele rodando na chuva',
            outcomes: [
              'A resposta é perfeita: o comentário dele vira piada, e você ganha a internet por um dia.',
              'A resposta é vista como baixaria, e um patrocinador manda mensagem pedindo mais classe.',
            ],
          },
          guardar: {
            label: 'Imprimir o comentário e colar na parede do quarto',
            outcomes: ['O papel na parede vira combustível. Toda manhã, antes do treino, você relê as três palavras.'],
          },
        },
      },
      {
        title: 'Live com indireta para você',
        body: 'Numa transmissão ao vivo com fãs, {rival} imita o seu jeito de falar nas entrevistas. O trecho é cortado e chega ao seu telefone por vinte pessoas diferentes.',
        choices: {
          ignorar: {
            label: 'Pedir aos amigos que parem de mandar o vídeo',
            outcomes: ['Os amigos obedecem, a imprensa elogia o seu silêncio, e a imitação continua ecoando na sua cabeça.'],
          },
          responder: {
            label: 'Fazer uma live imitando o jeito dele de pilotar',
            outcomes: [
              'A sua imitação é melhor que a dele. Os fãs escolhem um lado, e é o seu.',
              'As duas lives viram briga de torcida, e a equipe recebe reclamação de um patrocinador.',
            ],
          },
          guardar: {
            label: 'Guardar a resposta para o próximo duelo na pista',
            outcomes: ['Você ri por fora e anota tudo por dentro. No próximo duelo com {rival}, vai ter troco.'],
          },
        },
      },
    ],
  },
  {
    id: 'aposta-com-rival',
    category: 'career',
    frequency: 'normal',
    when: [],
    needs: ['rival'],
    choices: [
      {
        id: 'apostar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'rivalry', who: 'rival', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'recusar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'rival', size: -1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'dobrar',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 3 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -2 },
              { e: 'cash', size: -2, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Desafio no kart de aluguel',
        body: 'Numa noite de folga, {rival} aparece no mesmo kartódromo de aluguel que você. Ele propõe uma aposta: quem perder paga o jantar de todos os mecânicos das duas equipes.',
        choices: {
          apostar: {
            label: 'Topar o desafio na hora',
            outcomes: [
              'Você vence por um décimo, e {rival} paga a conta de cara amarrada. A noite termina perfeita.',
              'Ele vence por um décimo, e a conta do jantar sai do seu bolso. A risada dele dói mais que o preço.',
            ],
          },
          recusar: {
            label: 'Dizer que folga é folga e voltar para o hotel',
            outcomes: ['A tensão entre vocês baixa um pouco, mas alguém comenta que você fugiu do desafio.'],
          },
          dobrar: {
            label: 'Topar e ainda dobrar o valor da aposta',
            outcomes: [
              'Uma vitória esmagadora. {rival} paga a conta dobrada, e a história corre o paddock inteiro.',
              'Você perde feio e paga a conta dobrada. A noite vai ser lembrada, e não do jeito que você queria.',
            ],
          },
        },
      },
      {
        title: 'Quem faz a melhor volta no simulador?',
        body: 'No evento de um patrocinador da categoria, os pilotos disputam voltas num simulador montado num shopping. {rival} chega perto e aposta uma camisa da equipe de cada um.',
        choices: {
          apostar: {
            label: 'Aceitar e pedir a camisa dele já autografada',
            outcomes: [
              'O seu tempo fica no topo do placar. Você sai do shopping com a camisa de {rival} debaixo do braço.',
              'Ele bate o seu tempo na última tentativa, e a sua camisa vai embora com ele. Doeu, e ainda custou uma camisa nova.',
            ],
          },
          recusar: {
            label: 'Dizer que camisa da equipe não se aposta',
            outcomes: ['{rival} desdenha, mas a conversa termina num aperto de mão morno.'],
          },
          dobrar: {
            label: 'Apostar a camisa e o capacete réplica',
            outcomes: [
              'Você crava o melhor tempo do dia. {rival} entrega as duas peças em público, sem graça.',
              'Você erra a última curva e perde as duas peças. O capacete réplica vai para a estante dele.',
            ],
          },
        },
      },
      {
        title: 'Corrida a pé no fim da tarde',
        body: 'Numa corrida de rua beneficente, {rival} se alinha ao seu lado na largada e aposta alto: quem chegar atrás paga a inscrição de todo mundo no ano que vem.',
        choices: {
          apostar: {
            label: 'Apertar a mão dele e sair correndo',
            outcomes: [
              'Você cruza a linha uns passos à frente. {rival} paga as inscrições e ainda posa para a foto.',
              'O fôlego acaba antes da linha, e as inscrições do ano que vem ficam na sua conta.',
            ],
          },
          recusar: {
            label: 'Correr pelo prazer e deixar a aposta para lá',
            outcomes: ['Você termina a prova sem pressão nenhuma. {rival} espalha que você amarelou.'],
          },
          dobrar: {
            label: 'Topar e ainda incluir uma doação em dobro',
            outcomes: [
              'Você vence com sobras, e {rival} faz a doação em dobro diante das câmeras.',
              'Ele vence no sprint final, e a doação em dobro sai do seu bolso. Pelo menos foi por uma boa causa.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'rival-no-aeroporto',
    category: 'career',
    frequency: 'normal',
    when: [],
    needs: ['rival'],
    choices: [
      {
        id: 'conversar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'rivalry', who: 'rival', size: -1 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'alfinetar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'rivalry', who: 'rival', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'rival', size: 2 },
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
              { e: 'rivalry', who: 'rival', size: 3 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'rivalry', who: 'rival', size: 3 },
              { e: 'stat', stat: 'reputation', size: -2 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Mesmo voo, poltronas vizinhas',
        body: 'No portão de embarque para {pista}, você descobre que vai sentar ao lado de {rival}. Três horas de voo, um apoio de braço e nenhum lugar para fugir.',
        choices: {
          conversar: {
            label: 'Puxar conversa como gente civilizada',
            outcomes: [
              'A foto dos dois rindo no avião agrada o paddock. Mas ele conta dos testes da equipe dele, e você desembarca com a pulga atrás da orelha.',
            ],
          },
          alfinetar: {
            label: 'Perguntar se ele trouxe o manual de ultrapassagem',
            outcomes: [
              'Ele fica vermelho e passa o voo de fone. Você desembarca rindo por dentro.',
              'Ele responde à altura, a comissária pede silêncio, e um passageiro filma a discussão.',
            ],
          },
          partir: {
            label: 'Encarar {rival} e cobrar aquela fechada no meio do voo',
            outcomes: [
              'A discussão sobe de tom até ele pedir para trocar de lugar. Você fica com o apoio de braço, e o recado foi dado.',
              'A tripulação chama a segurança, o vídeo vaza, e os seus patrocinadores ligam antes de você pegar a mala.',
            ],
          },
        },
      },
      {
        title: 'Esteira de bagagem, cara a cara',
        body: 'A mala não chega, e quem está do outro lado da esteira esperando a dele? {rival}. Um grupo de fãs reconhece os dois e já saca os telefones.',
        choices: {
          conversar: {
            label: 'Posar para a foto com ele e os fãs',
            outcomes: ['A foto dos rivais sorrindo viraliza. No táxi, um fã comenta que ele parece mais confiante que você.'],
          },
          alfinetar: {
            label: 'Comentar alto que a mala dele atrasa como ele',
            outcomes: [
              'Os fãs caem na gargalhada, e {rival} sai sem a mala e sem resposta.',
              'Ele devolve na hora lembrando a sua última rodada, e os fãs riem da piada errada.',
            ],
          },
          partir: {
            label: 'Atravessar a esteira e tirar a história a limpo',
            outcomes: [
              'Cara a cara, ele recua. Os fãs filmam, mas o que fica é a imagem de quem não abaixa a cabeça.',
              'O bate-boca vira empurra-empurra, e o vídeo chega aos patrocinadores antes da sua mala.',
            ],
          },
        },
      },
      {
        title: 'Sala de espera com {rival}',
        body: 'O voo atrasou duas horas, e a única cadeira livre na sala de espera é ao lado de {rival}. Ele tira os fones quando você se aproxima.',
        choices: {
          conversar: {
            label: 'Sentar e falar de qualquer coisa que não seja corrida',
            outcomes: [
              'Vocês descobrem que torcem pelo mesmo time, e um jornalista que passava elogia a cena. Mais tarde, você percebe que ele arrancou mais do que contou.',
            ],
          },
          alfinetar: {
            label: 'Perguntar se ele vai pedir passagem também no embarque',
            outcomes: [
              'A piada acerta em cheio, e ele passa o resto da espera em silêncio.',
              'A piada não cola: ele responde com calma, e quem fica sem graça é você.',
            ],
          },
          partir: {
            label: 'Cobrar dele, na frente de todos, as fechadas de sempre',
            outcomes: [
              'A sala inteira presta atenção, e ele acaba pedindo desculpas para encerrar o assunto.',
              'A cobrança vira gritaria, a companhia aérea intervém, e um site de fofoca publica tudo.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Companheiro de equipe ---------------- */

  {
    id: 'politica-interna-equipe',
    category: 'career',
    frequency: 'normal',
    when: [],
    needs: ['teammate'],
    choices: [
      {
        id: 'ficar-fora',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: 1 },
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'confrontar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -1 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'jogar-junto',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Conversas nos corredores da oficina',
        body: 'Os mecânicos comentam que {companheiro} almoça toda semana com o chefe e anda pedindo prioridade nas peças novas. Na {equipe}, quem não aparece, desaparece.',
        choices: {
          'ficar-fora': {
            label: 'Ignorar a politicagem e focar na pilotagem',
            outcomes: ['Você roda mais no simulador e melhora. A chefia, porém, nota que você quase não aparece na oficina.'],
          },
          confrontar: {
            label: 'Levar o assunto direto para a reunião técnica',
            outcomes: [
              'A reunião define regras claras de prioridade. {companheiro} fecha a cara, mas a equipe passa a ouvir você.',
              'A reunião vira bate-boca, e você sai com fama de criar problema. {companheiro} sai como vítima.',
            ],
          },
          'jogar-junto': {
            label: 'Pagar o churrasco da turma da oficina na sexta',
            outcomes: ['O churrasco conquista os mecânicos e pesa no seu bolso. {companheiro} percebe a jogada e não gosta nada.'],
          },
        },
      },
      {
        title: 'A reunião sem o seu nome na lista',
        body: 'Você descobre por acaso que {companheiro} e os mecânicos fizeram uma reunião sobre o acerto da próxima etapa. O seu nome não estava na lista de convidados.',
        choices: {
          'ficar-fora': {
            label: 'Deixar para lá e trabalhar com o seu mecânico',
            outcomes: ['Você e o seu mecânico acham um acerto próprio que funciona. A diretoria estranha o seu silêncio.'],
          },
          confrontar: {
            label: 'Exigir participar de todas as reuniões técnicas',
            outcomes: [
              'O pedido é atendido na hora. O chefe deixa claro que ninguém decide nada sem os dois pilotos.',
              'O pedido soa como chilique, e {companheiro} ainda comenta pela equipe que é ciúme seu.',
            ],
          },
          'jogar-junto': {
            label: 'Marcar a sua própria reunião, com pizza para os mecânicos',
            outcomes: ['As pizzas abrem portas: os mecânicos passam a ouvir você. {companheiro} acha que você pegou pesado.'],
          },
        },
      },
      {
        title: 'O contrato do ano que vem',
        body: 'Corre no paddock que a {equipe} só vai renovar com um piloto, e {companheiro} anda espalhando que a vaga já é dele. A disputa saiu da pista e foi para os corredores.',
        choices: {
          'ficar-fora': {
            label: 'Responder só com tempo de volta',
            outcomes: ['Os tempos falam por você nos treinos. Fora da pista, a diretoria sente falta de alguém que defenda o próprio lugar.'],
          },
          confrontar: {
            label: 'Perguntar ao chefe, olho no olho, quem fica',
            outcomes: [
              'O chefe garante que a vaga é decidida na pista e elogia a coragem da pergunta.',
              'O chefe não gosta da pressão e encerra a conversa. {companheiro} fica sabendo de tudo.',
            ],
          },
          'jogar-junto': {
            label: 'Levar a diretoria para jantar no melhor restaurante da cidade',
            outcomes: ['A noite é ótima e a conta é salgada. {companheiro} descobre o jantar pelas redes e fecha a cara.'],
          },
        },
      },
    ],
  },
  {
    id: 'ordem-de-equipe-no-radio',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'tier', min: 4 },
      { c: 'race', tag: 'behindTeammate' },
    ],
    needs: ['teammate'],
    choices: [
      {
        id: 'obedecer',
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
        id: 'reclamar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
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
        id: 'expor',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Mantenha a posição, repito, mantenha',
        body: 'Nas voltas finais em {pista}, o rádio foi claro: nada de atacar {companheiro}. Você obedeceu, mas tinha ritmo para passar. Agora o engenheiro quer conversar.',
        choices: {
          obedecer: {
            label: 'Dizer que entende a ordem: a equipe vem primeiro',
            outcomes: ['A chefia anota a lealdade. Mas rever o replay daquela reta vai doer por alguns dias.'],
          },
          reclamar: {
            label: 'Pedir, em particular, que a ordem não se repita',
            outcomes: [
              'O engenheiro concorda que a ordem foi precipitada. Na próxima, a regra é deixar correr.',
              'A chefia acha que você está se colocando acima do time, e {companheiro} fica sabendo.',
            ],
          },
          expor: {
            label: 'Contar à imprensa que tinha ritmo para vencer {companheiro}',
            outcomes: [
              'A frase mostra ao paddock que você tem ritmo e não aceita papel de coadjuvante. A equipe não gosta nada.',
              'A frase vira crise: a equipe se sente traída, e {companheiro} para de falar com você.',
            ],
          },
        },
      },
      {
        title: 'Escudo de {companheiro} por ordem do box',
        body: 'O chefe mandou você segurar quem vinha atrás para proteger a posição de {companheiro}. O plano funcionou para ele. Para você, sobraram pneus gastos e posições perdidas.',
        choices: {
          obedecer: {
            label: 'Agradecer ao time pela estratégia que deu certo',
            outcomes: ['O chefe agradece de volta, na frente de todos. A frustração você leva para o quarto do hotel.'],
          },
          reclamar: {
            label: 'Pedir ao chefe que a estratégia seja revezada',
            outcomes: [
              'O chefe aceita: na próxima vez que precisar, a proteção vai para o seu carro.',
              'O chefe responde que estratégia não se negocia, e o clima no box pesa.',
            ],
          },
          expor: {
            label: 'Dizer na coletiva que fez o papel de escudo',
            outcomes: [
              'A imprensa compra a sua versão, e o seu valor no paddock sobe. Na {equipe}, as caras são outras.',
              'A coletiva vira um caso. A {equipe} solta uma nota desmentindo você, e {companheiro} ri por último.',
            ],
          },
        },
      },
      {
        title: 'Troca de posições combinada',
        body: 'A {equipe} pediu, antes da largada, que você deixasse {companheiro} passar se ele estivesse mais rápido. Ele estava, você deixou, e a torcida vaiou no fim.',
        choices: {
          obedecer: {
            label: 'Defender a decisão da equipe nas entrevistas',
            outcomes: ['A equipe agradece a postura. A vaia da torcida, essa, demora a sair dos ouvidos.'],
          },
          reclamar: {
            label: 'Exigir que, na próxima, a ordem valha para os dois',
            outcomes: [
              'O acordo fica por escrito. Daqui para a frente, quem estiver mais rápido passa, seja quem for.',
              'O chefe diz que não vai prometer nada, e você sai da sala com a sensação de que a fila tem dono, e não é você.',
            ],
          },
          expor: {
            label: 'Postar que a vaia era para a ordem da equipe',
            outcomes: [
              'A torcida entende o recado e passa a gritar o seu nome. A equipe engole em seco.',
              'A postagem cai mal com todo mundo: equipe, companheiro e até parte da torcida.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'briga-por-atencao-companheiro',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'beatTeammate' }],
    needs: ['teammate'],
    choices: [
      {
        id: 'dividir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: 2 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'disputar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'sponsorMood', who: 'all', size: 1 },
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
        id: 'ceder',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: 1 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O vídeo da equipe só mostra ele',
        body: 'Você terminou à frente de {companheiro} em {pista}, mas o vídeo oficial da {equipe} tem dois minutos dele e oito segundos seus. O pessoal das redes jura que foi sem querer.',
        choices: {
          dividir: {
            label: 'Sugerir que o próximo vídeo seja dos dois juntos',
            outcomes: ['O vídeo dos dois vira o mais visto da equipe, e {companheiro} gosta da ideia. O seu brilho, porém, fica dividido.'],
          },
          disputar: {
            label: 'Exigir um vídeo só seu, por justiça',
            outcomes: [
              'O vídeo sai caprichado, e os patrocinadores adoram aparecer ao seu lado.',
              'O pedido chega aos ouvidos de {companheiro}, que espalha pela equipe que a sua vaidade não cabe no caminhão.',
            ],
          },
          ceder: {
            label: 'Deixar o holofote para ele e ir ao simulador',
            outcomes: ['Longe das câmeras, você acha mais um décimo. Os patrocinadores reclamam que o logo deles sumiu.'],
          },
        },
      },
      {
        title: 'Um só lugar no evento do patrocinador',
        body: 'O principal patrocinador da {equipe} quer um piloto no lançamento do produto novo, e {companheiro} já se ofereceu, como se o domingo não tivesse acontecido.',
        choices: {
          dividir: {
            label: 'Propor que os dois façam o evento juntos',
            outcomes: ['O patrocinador topa a dupla, {companheiro} agradece o gesto, e a foto principal sai com ele no centro.'],
          },
          disputar: {
            label: 'Lembrar ao comercial quem chegou na frente',
            outcomes: [
              'O comercial dá razão a você, e o patrocinador gosta de ter no palco quem está em alta.',
              'A discussão fica feia, {companheiro} se ofende e a chefia pede menos briga por holofote.',
            ],
          },
          ceder: {
            label: 'Abrir mão do evento e aproveitar para treinar',
            outcomes: ['O treino rende. O patrocinador, porém, anota que você não quis aparecer.'],
          },
        },
      },
      {
        title: 'Capa de revista para um só',
        body: 'A revista da categoria quer um piloto da {equipe} na capa da próxima edição. {companheiro} já mandou fotos para a redação, mesmo tendo terminado atrás de você em {pista}.',
        choices: {
          dividir: {
            label: 'Sugerir à revista uma capa com os dois',
            outcomes: ['A capa dupla fica bonita e {companheiro} agradece. Mas a manchete dá a ele o papel de protagonista.'],
          },
          disputar: {
            label: 'Ligar para a redação e defender a sua vez',
            outcomes: [
              'A capa é sua, e os patrocinadores encomendam cem exemplares para distribuir aos clientes.',
              'A redação conta a {companheiro} sobre o telefonema, e a briga vira assunto até na oficina.',
            ],
          },
          ceder: {
            label: 'Deixar a capa para ele e cuidar do acerto',
            outcomes: ['Você usa o tempo para estudar a telemetria e ganha ritmo. Os patrocinadores queriam a capa.'],
          },
        },
      },
    ],
  },

  /* ---------------- Chefe de equipe ---------------- */

  {
    id: 'chefe-cobra-resultado',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'race', tag: 'noPoints' },
      { c: 'standing', out: 'top5' },
    ],
    choices: [
      {
        id: 'pedir-tempo',
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
        id: 'apontar-carro',
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
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'treino-extra',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Portas fechadas no escritório do chefe',
        body: 'Depois de mais uma corrida sem pontos, o chefe da {equipe} chama você para conversar. Sem rodeios: o investimento é alto e os resultados não estão vindo.',
        choices: {
          'pedir-tempo': {
            label: 'Pedir mais algumas etapas para virar o jogo',
            outcomes: ['O chefe concede o prazo, mas o tom da conversa acompanha você até em casa.'],
          },
          'apontar-carro': {
            label: 'Dizer que o problema é o equipamento, não a pilotagem',
            outcomes: [
              'O chefe manda revisar o equipamento inteiro, e os mecânicos acham uma peça trabalhando errado.',
              'O chefe não aceita a desculpa. Você sai da sala com a razão, talvez, mas sem o apoio da chefia.',
            ],
          },
          'treino-extra': {
            label: 'Pagar do próprio bolso um dia extra de simulador',
            outcomes: ['O dia extra rende, e o chefe repara no esforço. O cartão de crédito também repara.'],
          },
        },
      },
      {
        title: 'A planilha vermelha da {equipe}',
        body: 'Na reunião de segunda, o diretor técnico projeta uma planilha com os seus resultados pintados de vermelho. A pergunta vem em seguida: o que você vai fazer para mudar isso?',
        choices: {
          'pedir-tempo': {
            label: 'Prometer que a cor da planilha vai mudar',
            outcomes: ['A promessa acalma a sala, mas o peso dela fica no seu peito até a largada seguinte.'],
          },
          'apontar-carro': {
            label: 'Mostrar nos dados onde o equipamento perde tempo',
            outcomes: [
              'Os dados convencem: a equipe libera uma atualização que estava parada no almoxarifado.',
              'A equipe técnica contesta cada gráfico, e a reunião termina com todo mundo de braços cruzados.',
            ],
          },
          'treino-extra': {
            label: 'Contratar por conta própria um preparador para as próximas semanas',
            outcomes: ['O preparador leva você ao limite, e a equipe nota a mudança. A fatura chega no fim do mês.'],
          },
        },
      },
      {
        title: 'Recado curto pelo mecânico-chefe',
        body: 'O chefe não veio falar com você depois da corrida. Mandou recado pelo mecânico-chefe: quer resultado já, porque tem gente batendo na porta pedindo a sua vaga.',
        choices: {
          'pedir-tempo': {
            label: 'Responder pelo mesmo mecânico que o resultado vem',
            outcomes: ['O recado volta, e o chefe se dá por satisfeito. Já você passa a semana inteira com a frase na cabeça.'],
          },
          'apontar-carro': {
            label: 'Mandar de volta a lista de peças que nunca chegaram',
            outcomes: [
              'A lista surte efeito: as peças aparecem na etapa seguinte, com um pedido de desculpas atrasado.',
              'O chefe lê a lista como afronta e passa a semana sem cumprimentar você na pista.',
            ],
          },
          'treino-extra': {
            label: 'Bancar uma sessão de testes particular antes da próxima etapa',
            outcomes: ['A sessão particular devolve o ritmo e mostra ao chefe que você leva a vaga a sério. Saiu caro.'],
          },
        },
      },
    ],
  },
  {
    id: 'chefe-elogia-trabalho',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'gainedPlaces' }],
    choices: [
      {
        id: 'merito-do-carro',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'pedir-pecas',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
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
        id: 'festa-do-box',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Tapinha nas costas depois da bandeirada',
        body: 'Você largou lá atrás em {pista} e foi ganhando posição atrás de posição. O chefe da {equipe} atravessa o paddock só para dizer que foi a melhor corrida da sua vida.',
        choices: {
          'merito-do-carro': {
            label: 'Dizer que o equipamento é que estava perfeito',
            outcomes: ['O chefe sai repetindo a frase para os mecânicos, cheio de orgulho do time. Você fica se perguntando se não se diminuiu demais.'],
          },
          'pedir-pecas': {
            label: 'Aproveitar o bom humor para pedir peças novas',
            outcomes: [
              'O chefe ri da cara de pau e libera o chassi novo que estava guardado para a outra temporada.',
              'O chefe fecha a cara: elogio não é cheque em branco. O clima bom dura pouco.',
            ],
          },
          'festa-do-box': {
            label: 'Levar os mecânicos para comemorar numa churrascaria',
            outcomes: ['A noite de churrascaria entra para a história da equipe. A conta, para a sua fatura.'],
          },
        },
      },
      {
        title: 'Elogio no grupo da equipe',
        body: 'No grupo de mensagens da {equipe}, o chefe manda um áudio de dois minutos só sobre as suas ultrapassagens em {pista}. Os mecânicos respondem com aplausos e figurinhas.',
        choices: {
          'merito-do-carro': {
            label: 'Responder que o mérito é de quem preparou o equipamento',
            outcomes: ['O grupo explode em comemorações, e a oficina se sente dona da corrida. O elogio, que era seu, se dilui.'],
          },
          'pedir-pecas': {
            label: 'Responder no privado pedindo o motor mais novo',
            outcomes: [
              'O chefe responde com um "fechado". O motor novo estreia na próxima etapa.',
              'O chefe visualiza e não responde. No dia seguinte, o tom na oficina é mais frio.',
            ],
          },
          'festa-do-box': {
            label: 'Encomendar pizza para a turma toda na oficina',
            outcomes: ['A pizzaria atrasa, o refrigerante esquenta, e mesmo assim é a melhor segunda-feira do ano na oficina.'],
          },
        },
      },
      {
        title: 'O chefe fala bem de você na TV',
        body: 'Em entrevista ao canal oficial, o chefe da {equipe} diz que a sua recuperação em {pista} foi coisa de piloto grande. A frase chega ao seu telefone antes de você tirar o macacão.',
        choices: {
          'merito-do-carro': {
            label: 'Devolver o elogio: sem a equipe, nada feito',
            outcomes: ['A troca de gentilezas agrada a oficina inteira. A sua confiança, curiosamente, não acompanha.'],
          },
          'pedir-pecas': {
            label: 'Propor ao chefe um teste com peças novas',
            outcomes: [
              'No embalo da própria entrevista, o chefe aprova o teste, e as peças funcionam.',
              'O chefe diz que o orçamento não permite, e a conversa termina meio sem graça.',
            ],
          },
          'festa-do-box': {
            label: 'Mandar uma caixa de doces de {cidade} para a oficina',
            outcomes: ['Os doces somem em dez minutos, e os mecânicos passam a chamar você pelo nome da sua cidade.'],
          },
        },
      },
    ],
  },
  {
    id: 'chefe-da-bronca',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'race', tag: 'crash' }],
    choices: [
      {
        id: 'ouvir',
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
        id: 'rebater',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
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
        id: 'pagar-conserto',
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
    ],
    variants: [
      {
        title: 'A bronca que a equipe inteira ouviu',
        body: 'O equipamento voltou de {pista} em pedaços, e o chefe da {equipe} não esperou a porta do caminhão fechar. A bronca é alta, e os mecânicos fingem que não estão ouvindo.',
        choices: {
          ouvir: {
            label: 'Ouvir até o fim, sem interromper',
            outcomes: ['O chefe esfria a cabeça e reconhece a sua postura. A vergonha, essa, dura a semana.'],
          },
          rebater: {
            label: 'Lembrar quantos pontos você já trouxe para a equipe',
            outcomes: [
              'O chefe para, pensa e baixa o tom. Você sai de cabeça erguida, mas a chefia não esquece.',
              'A discussão piora tudo. Agora a equipe inteira sabe que o clima entre vocês azedou.',
            ],
          },
          'pagar-conserto': {
            label: 'Oferecer ajuda para pagar o conserto',
            outcomes: ['O chefe recusa parte do dinheiro, aceita o resto e passa a olhar você de outro jeito.'],
          },
        },
      },
      {
        title: 'A conta do conserto na mesa',
        body: 'Na segunda-feira, o chefe da {equipe} coloca na sua frente a conta das peças trocadas depois do acidente em {pista}. Não fala nada. Só espera.',
        choices: {
          ouvir: {
            label: 'Pedir desculpas e garantir que vai aprender com o erro',
            outcomes: ['O chefe guarda a conta na gaveta e aceita as desculpas. O constrangimento acompanha você até o próximo treino.'],
          },
          rebater: {
            label: 'Dizer que acidente faz parte de quem anda no limite',
            outcomes: [
              'O chefe concorda a contragosto: quem não arrisca não vence. Mas a conta continua na mesa.',
              'O chefe quebra o silêncio com uma bronca que a recepção inteira escuta.',
            ],
          },
          'pagar-conserto': {
            label: 'Pegar a conta e dizer que você paga uma parte',
            outcomes: ['O gesto vale mais que o dinheiro. A equipe inteira fica sabendo, e o respeito por você cresce.'],
          },
        },
      },
      {
        title: 'Bronca na frente do patrocinador',
        body: 'O chefe da {equipe} perdeu a paciência com a sua batida em {pista} logo na área de convidados, com o patrocinador principal assistindo. Todo mundo olha para você.',
        choices: {
          ouvir: {
            label: 'Esperar o chefe terminar e pedir para continuar lá dentro',
            outcomes: ['A calma impressiona os convidados, e o chefe se arrepende do lugar que escolheu. O seu dia, porém, acabou ali.'],
          },
          rebater: {
            label: 'Responder na mesma hora, na frente de todos',
            outcomes: [
              'Você sai de cabeça erguida, mas o chefe não gosta nem um pouco de ter a autoridade contestada em público.',
              'A cena constrange todos os convidados, e o chefe passa dias sem olhar na sua cara.',
            ],
          },
          'pagar-conserto': {
            label: 'Anunciar ali mesmo que vai ajudar a cobrir o prejuízo',
            outcomes: ['O patrocinador aplaude o gesto, e o chefe aceita sem graça. O seu extrato bancário sente o golpe.'],
          },
        },
      },
    ],
  },

  /* ---------------- Mercado ---------------- */

  {
    id: 'proposta-equipe-interessada',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [],
    needs: ['interestedTeam'],
    choices: [
      {
        id: 'ouvir-proposta',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'interest', team: 'interested', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'contar-ao-chefe',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'releaseFee', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'reduzir-multa',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'releaseFee', size: -2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'interest', team: 'interested', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um café com a {equipeInteressada}',
        body: 'O diretor esportivo da {equipeInteressada} manda mensagem pedindo um café discreto, longe do paddock. Quer apresentar um projeto para você no ano que vem.',
        choices: {
          'ouvir-proposta': {
            label: 'Ir ao café e ouvir o projeto inteiro',
            outcomes: ['O projeto é sério, e eles saem do café ainda mais interessados. Alguém da sua equipe viu vocês juntos.'],
          },
          'contar-ao-chefe': {
            label: 'Contar ao seu chefe e reafirmar o compromisso',
            outcomes: ['O chefe agradece a lealdade e, para garantir, sobe a multa rescisória do seu contrato.'],
          },
          'reduzir-multa': {
            label: 'Usar a sondagem para pedir uma multa rescisória menor',
            outcomes: [
              'A sua equipe cede para não perder você brigando: a multa cai, e a porta fica mais aberta.',
              'A sua equipe se ofende com a pressão, e a notícia vaza. A {equipeInteressada} gosta ainda mais.',
            ],
          },
        },
      },
      {
        title: 'Ligação de número desconhecido',
        body: 'Do outro lado da linha, o chefe da {equipeInteressada} vai direto ao assunto: acompanham você há meses e querem saber se o seu contrato tem saída.',
        choices: {
          'ouvir-proposta': {
            label: 'Dizer que a conversa interessa e marcar uma reunião',
            outcomes: ['A reunião fica para depois da próxima etapa. Na {equipe}, alguém já desconfia do telefone tocando tanto.'],
          },
          'contar-ao-chefe': {
            label: 'Desligar e avisar o seu chefe na mesma hora',
            outcomes: ['O seu chefe valoriza a transparência e trata de blindar você com uma multa rescisória maior.'],
          },
          'reduzir-multa': {
            label: 'Usar a ligação como argumento para baixar a multa',
            outcomes: [
              'O argumento funciona: a sua equipe reduz a multa para manter o clima bom.',
              'O seu chefe chama aquilo de chantagem. A notícia corre, e a {equipeInteressada} se anima.',
            ],
          },
        },
      },
      {
        title: 'Visita guiada à sede da rival',
        body: 'A {equipeInteressada} convida você para conhecer a sede num dia sem treino, com direito a almoço com a equipe técnica. A conversa sobre o futuro viria depois da sobremesa.',
        choices: {
          'ouvir-proposta': {
            label: 'Aceitar o convite e conhecer a sede',
            outcomes: ['A estrutura impressiona, e você impressiona os anfitriões. Uma foto sua no estacionamento deles chega à sua equipe.'],
          },
          'contar-ao-chefe': {
            label: 'Recusar a visita e contar tudo à {equipe}',
            outcomes: ['A {equipe} reconhece a fidelidade e reforça o contrato com uma multa rescisória mais alta.'],
          },
          'reduzir-multa': {
            label: 'Negociar com a {equipe} uma cláusula de saída mais barata',
            outcomes: [
              'Depois de muita conversa, a cláusula fica mais barata. O futuro está nas suas mãos.',
              'A {equipe} recusa e passa a desconfiar de cada passo seu. A {equipeInteressada} acompanha tudo de perto.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'empresario-oferece-servico',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'tier', min: 2 }],
    needs: ['otherTeam'],
    choices: [
      {
        id: 'contratar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'interest', team: 'other', size: 2 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'dispensar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'experiencia',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'interest', team: 'other', size: 1 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
          { odds: 'rest', effects: [{ e: 'cash', size: -1, cap: true }] },
        ],
      },
    ],
    variants: [
      {
        title: 'Cartão de visita no paddock',
        body: 'Um agente de pilotos bem vestido deixa um cartão com a sua equipe. Diz que cuida de contratos, patrocínio e imprensa, e que já conversou sobre você com gente da {outraEquipe}.',
        choices: {
          contratar: {
            label: 'Contratar o agente e deixar o mercado com ele',
            outcomes: ['Em uma semana, o agente marca uma conversa com a {outraEquipe}. A primeira fatura dele chega junto.'],
          },
          dispensar: {
            label: 'Agradecer e seguir cuidando da carreira com a família',
            outcomes: ['A família comemora a economia. No paddock, porém, quem não tem agente às vezes nem entra na conversa.'],
          },
          experiencia: {
            label: 'Propor três meses de experiência, sem exclusividade',
            outcomes: [
              'O agente topa e trabalha bem: a {outraEquipe} pede informações sobre você, e os seus patrocinadores ganham espaço em duas revistas.',
              'O agente cobra um adiantamento, some por três meses e não atende mais o telefone.',
            ],
          },
        },
      },
      {
        title: 'Uma agência com pacote completo',
        body: 'Uma agência de gerenciamento de carreira oferece pacote completo: contratos, redes sociais e contatos. O representante garante que a {outraEquipe} já perguntou por você.',
        choices: {
          contratar: {
            label: 'Assinar o pacote completo da agência',
            outcomes: ['A agência entra em ação, e a {outraEquipe} passa a acompanhar os seus tempos. A mensalidade, claro, sai do seu caixa.'],
          },
          dispensar: {
            label: 'Dizer que prefere crescer no próprio ritmo',
            outcomes: ['O representante vai embora com educação. Você ganha paz, e o seu nome circula menos nas rodas certas.'],
          },
          experiencia: {
            label: 'Fechar só a parte de contatos, por um período curto',
            outcomes: [
              'Os contatos rendem: a {outraEquipe} manda um olheiro, e os seus patrocinadores ganham visibilidade.',
              'Os contatos eram meia dúzia de números desatualizados. A taxa de adesão não volta.',
            ],
          },
        },
      },
      {
        title: 'O agente que conhece todo mundo',
        body: 'Na área de convidados, um senhor grisalho cumprimenta metade do paddock pelo nome. Ele se apresenta como agente, oferece os seus serviços e cita uma conversa recente com a {outraEquipe}.',
        choices: {
          contratar: {
            label: 'Apertar a mão e fechar com ele ali mesmo',
            outcomes: ['O homem cumpre o que promete: a {outraEquipe} passa a falar de você nas reuniões. A comissão dele é salgada.'],
          },
          dispensar: {
            label: 'Pegar o cartão e nunca ligar',
            outcomes: ['O cartão fica na gaveta e o dinheiro, no bolso. Mas parte do paddock passa a achar a sua carreira meio amadora.'],
          },
          experiencia: {
            label: 'Pedir que ele prove o valor antes de qualquer contrato',
            outcomes: [
              'Ele aceita o desafio e marca duas reuniões que valem ouro. Os seus patrocinadores adoram o novo contato.',
              'Ele cobra uma taxa para provar o valor, e o valor nunca aparece.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Fãs, vitrine e televisão ---------------- */

  {
    id: 'fa-clube-nasce',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'careerSeason', min: 2 }],
    choices: [
      {
        id: 'apoiar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'adiar',
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
        id: 'visitar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
          {
            odds: 'rest',
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
        title: 'Nasce um fã-clube em {cidade}',
        body: 'Um grupo de vizinhos de {cidade} criou um fã-clube com o seu nome. Tem faixa, grupo de mensagens e até camiseta com o seu rosto meio torto. Querem a sua bênção.',
        choices: {
          apoiar: {
            label: 'Mandar bonés e camisetas autografadas para todos',
            outcomes: ['O pacote chega no sábado, e as fotos enchem as redes. Os bonés custaram caro, mas a alegria da turma não tem preço.'],
          },
          adiar: {
            label: 'Pedir que esperem a fase melhorar para fazer festa',
            outcomes: ['O pedido é entendido, e você se concentra no treino. Mas a turma murcha um pouco, e você sente.'],
          },
          visitar: {
            label: 'Passar um domingo inteiro com a turma do fã-clube',
            outcomes: [
              'O domingo vira notícia na TV local, e os seus patrocinadores compartilham as fotos com orgulho.',
              'O domingo é lindo e puxado. Você volta feliz, mas chega ao treino sem fôlego.',
            ],
          },
        },
      },
      {
        title: 'Uma página de fãs só sobre você',
        body: 'Uma estudante de jornalismo criou uma página só sobre a sua carreira, com estatísticas, vídeos antigos e entrevistas traduzidas. Ela pede uma conversa exclusiva para comemorar os seguidores.',
        choices: {
          apoiar: {
            label: 'Dar a entrevista e mandar um kit da equipe',
            outcomes: ['A entrevista vira o post mais lido da página, e o kit vai parar numa moldura. A transportadora cobrou caro.'],
          },
          adiar: {
            label: 'Prometer a entrevista para o fim da temporada',
            outcomes: ['Ela entende e espera. Você ganha tempo para treinar, mas fica a sensação de ter decepcionado alguém.'],
          },
          visitar: {
            label: 'Convidar a dona da página para conhecer os bastidores',
            outcomes: [
              'O dia nos bastidores rende uma reportagem linda, e os patrocinadores pedem para compartilhar.',
              'A visita é ótima, mas toma o dia de treino inteiro, e o acerto fica pela metade.',
            ],
          },
        },
      },
      {
        title: 'Faixa na arquibancada de {pista}',
        body: 'Lá no alto da arquibancada, uma faixa enorme com o seu nome e o desenho do seu capacete. No fim do dia, os autores da faixa esperam na grade pedindo um minuto.',
        choices: {
          apoiar: {
            label: 'Pagar o almoço da turma e tirar foto com todos',
            outcomes: ['A foto com a faixa vira capa do grupo deles. O almoço para trinta pessoas sai do seu bolso, com gosto.'],
          },
          adiar: {
            label: 'Acenar de longe e correr para a reunião técnica',
            outcomes: ['A reunião rende um acerto melhor. A turma da grade, porém, vai embora sem a foto.'],
          },
          visitar: {
            label: 'Passar a tarde com eles do outro lado da grade',
            outcomes: [
              'A cena roda nas redes, e o paddock comenta o carinho. Os patrocinadores adoram.',
              'A tarde é linda, mas a conversa com os mecânicos fica para depois, e o acerto sai incompleto.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'convite-corrida-exibicao',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'tier', min: 2 }],
    choices: [
      {
        id: 'aceitar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'recusar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'sponsorMood', who: 'all', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'encarar',
        requires: [{ c: 'trait', trait: 'debutNerves' }],
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 3 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'confidence', size: -2 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'Corrida de exibição no estádio',
        body: 'Uma produtora monta uma pista de kart dentro de um estádio de futebol para um festival de esportes. Pagam um bom cachê para você participar, com transmissão ao vivo.',
        choices: {
          aceitar: {
            label: 'Aceitar o cachê e fazer a volta de apresentação',
            outcomes: ['O público vibra, o cachê cai na conta e o seu nome aparece na TV. O treino da semana, porém, fica para trás.'],
          },
          recusar: {
            label: 'Recusar e usar o fim de semana para treinar',
            outcomes: ['O treino rende, mas os seus patrocinadores queriam ver o logo no estádio lotado.'],
          },
          encarar: {
            label: 'Largar na bateria principal, mesmo com frio na barriga',
            outcomes: [
              'Na largada, as mãos tremem. Na terceira volta, já não tremem mais. Você vence o medo e a bateria.',
              'O estádio lotado trava você na largada. Fica a lembrança amarga de um medo que ainda manda.',
            ],
          },
        },
      },
      {
        title: 'Festival beneficente no autódromo',
        body: 'Um festival beneficente reúne pilotos e artistas numa corrida de carros iguais no autódromo da capital. A organização convida você e oferece um cachê, além da vitrine.',
        choices: {
          aceitar: {
            label: 'Participar e posar com os artistas no grid',
            outcomes: ['As fotos com os artistas rodam as revistas, e o cachê ajuda nas contas. A semana de preparação vira semana de festa.'],
          },
          recusar: {
            label: 'Agradecer o convite e ficar treinando com a equipe',
            outcomes: ['O treino rende. Os patrocinadores, porém, reclamam de mais uma vitrine perdida.'],
          },
          encarar: {
            label: 'Topar a corrida principal, com os artistas e as câmeras',
            outcomes: [
              'O frio na barriga dura até a primeira curva. Depois, é só diversão, e você termina na frente de todo mundo.',
              'As câmeras e a plateia pesam demais. Você se esconde no meio do pelotão e sai de cabeça baixa.',
            ],
          },
        },
      },
      {
        title: 'Convite para o desafio das lendas',
        body: 'Um evento de exibição junta pilotos jovens e veteranos famosos numa corrida de kart à noite. O convite chega com cachê e a promessa de transmissão em rede nacional.',
        choices: {
          aceitar: {
            label: 'Ir, correr sem compromisso e aproveitar a festa',
            outcomes: ['Você corre ao lado de ídolos de infância e embolsa o cachê. O cansaço da noite atrapalha os treinos da semana.'],
          },
          recusar: {
            label: 'Explicar que o foco agora é o campeonato',
            outcomes: ['A explicação é respeitada, e o foco rende. Mas os patrocinadores queriam o logo em rede nacional.'],
          },
          encarar: {
            label: 'Largar na pole, ao lado do veterano mais famoso',
            outcomes: [
              'O coração quase sai pela boca no grid, mas você segura a ponta até a bandeirada. A noite é sua.',
              'O medo vence antes da largada, e o veterano some na frente. Fica a sensação de ter congelado.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'entrevista-programa-de-tv',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'tier', min: 3 }],
    choices: [
      {
        id: 'ensaiar',
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
        id: 'improvisar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 1 },
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
      {
        id: 'palco',
        requires: [{ c: 'trait', trait: 'bigStage' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Convite para o programa de domingo',
        body: 'Um programa de auditório de domingo quer você no sofá do apresentador, ao vivo, para falar da carreira {categoria:em}. A assessoria avisa: milhões de pessoas assistem.',
        choices: {
          ensaiar: {
            label: 'Passar a semana ensaiando respostas com a assessoria',
            outcomes: ['A entrevista sai redonda e sem tropeço. A semana de ensaios, porém, roubou horas de treino.'],
          },
          improvisar: {
            label: 'Ir sem ensaio e confiar no jeito de falar',
            outcomes: [
              'O improviso funciona: o auditório ri, a audiência sobe e os patrocinadores ligam para comemorar.',
              'O improviso trava na segunda pergunta, e o silêncio ao vivo parece durar uma eternidade.',
            ],
          },
          palco: {
            label: 'Encarar a estreia no programa como quem larga na pole',
            outcomes: ['Luz, câmera e você em casa. O apresentador pede uma segunda visita, e os patrocinadores querem o vídeo inteiro.'],
          },
        },
      },
      {
        title: 'Mesa redonda da noite',
        body: 'A mesa redonda esportiva mais vista da TV quer você ao vivo, entre comentaristas de futebol que mal sabem o que é uma bandeira amarela.',
        choices: {
          ensaiar: {
            label: 'Estudar os comentaristas e preparar respostas curtas',
            outcomes: ['As respostas curtas funcionam, e você não cai em nenhuma armadilha. A preparação comeu dois dias de simulador.'],
          },
          improvisar: {
            label: 'Chegar de improviso e explicar o automobilismo do zero',
            outcomes: [
              'A aula improvisada encanta os comentaristas, e o trecho vira o mais visto da noite.',
              'A explicação embola, um comentarista faz piada, e a piada é o que todo mundo lembra.',
            ],
          },
          palco: {
            label: 'Aproveitar a primeira vez na bancada para roubar a cena',
            outcomes: ['Na primeira vez na bancada, você parece ter nascido ali. O programa convida de novo, e os patrocinadores comemoram.'],
          },
        },
      },
      {
        title: 'Entrevista em programa de culinária',
        body: 'Um programa de culinária na TV aberta convida você para cozinhar ao vivo e contar histórias das pistas. O apresentador promete perguntas leves e uma panela de pressão.',
        choices: {
          ensaiar: {
            label: 'Treinar a receita a semana inteira antes do programa',
            outcomes: ['O prato sai perfeito, e a conversa também. Mas a cozinha ocupou as horas que eram do treino físico.'],
          },
          improvisar: {
            label: 'Chegar sem saber nem fritar um ovo e rir disso',
            outcomes: [
              'O desastre na cozinha vira o momento mais divertido do programa, e o público se apaixona.',
              'O desastre na cozinha é só desastre mesmo, e o vídeo do ovo queimado persegue você por semanas.',
            ],
          },
          palco: {
            label: 'Transformar a estreia na cozinha da TV num show',
            outcomes: ['Você conduz o programa como se fosse seu. O apresentador ri o tempo todo, e os patrocinadores pedem um quadro fixo.'],
          },
        },
      },
    ],
  },

  /* ---------------- Mentor e aprendiz (com memória) ---------------- */

  {
    id: 'mentor-veterano',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'age', to: 'young' },
      { c: 'noPerson', key: 'car-mentor-veterano' },
    ],
    choices: [
      {
        id: 'aceitar-mentoria',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'meet', key: 'car-mentor-veterano', from: 'stranger', role: 'ex-piloto das antigas', org: 'Clube dos Veteranos da Pista', attitude: 1 },
              { e: 'attribute', attribute: 'racecraft', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'dispensar-mentoria',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma lenda das antigas no paddock',
        body: '{pessoa:car-mentor-veterano}, ex-piloto que brilhou décadas atrás, procura você no paddock depois do treino. Viu você andar e oferece, sem cobrar nada, conversas semanais sobre pilotagem.',
        choices: {
          'aceitar-mentoria': {
            label: 'Aceitar as conversas semanais',
            outcomes: [
              '{primeiro:car-mentor-veterano} não alivia: aponta cada erro com uma franqueza que dói. Mas você começa a ler as corridas de outro jeito.',
            ],
          },
          'dispensar-mentoria': {
            label: 'Agradecer e dizer que prefere aprender errando',
            outcomes: ['A recusa reforça a sua confiança no próprio caminho. No paddock, alguém comenta que você recusou ouro.'],
          },
        },
      },
      {
        title: 'Conselho de quem já ganhou tudo',
        body: 'Numa homenagem às lendas da categoria, {pessoa:car-mentor-veterano} pede para falar com você a sós. A proposta é simples: acompanhar a sua carreira de perto, dando conselhos.',
        choices: {
          'aceitar-mentoria': {
            label: 'Aceitar e anotar o telefone na hora',
            outcomes: ['As ligações são longas e duras, cheias de histórias de corrida. Você aprende muito e dorme pouco.'],
          },
          'dispensar-mentoria': {
            label: 'Explicar que já tem gente demais dando palpite',
            outcomes: ['A resposta firme mostra personalidade. Mas fica no ar a impressão de que você fechou uma porta valiosa.'],
          },
        },
      },
      {
        title: 'O telefonema de uma lenda',
        body: 'O telefone toca com um número de {cidade}. É {pessoa:car-mentor-veterano}, que você via correr na TV na infância, oferecendo ajuda para os próximos anos.',
        choices: {
          'aceitar-mentoria': {
            label: 'Aceitar a ajuda e marcar a primeira conversa',
            outcomes: ['A primeira conversa dura quatro horas e termina com uma lista de lições de casa. Você sai com a cabeça doendo e cheia de ideias.'],
          },
          'dispensar-mentoria': {
            label: 'Agradecer o carinho e recusar com educação',
            outcomes: ['A recusa deixa você em paz com as próprias escolhas. Na cidade, comentam que você disse não a uma lenda.'],
          },
        },
      },
    ],
  },
  {
    id: 'mentor-liga-depois-da-corrida',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'attitude', key: 'car-mentor-veterano', level: 'positive' },
      { c: 'race', tag: 'noPoints' },
    ],
    needs: ['person:car-mentor-veterano'],
    speaker: 'car-mentor-veterano',
    choices: [
      {
        id: 'ouvir-licao',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attitude', key: 'car-mentor-veterano', size: 1 },
              { e: 'attribute', attribute: 'focus', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'pedir-espaco',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'attitude', key: 'car-mentor-veterano', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{primeiro:car-mentor-veterano} viu a corrida inteira',
        body: 'Uma hora depois da bandeirada em {pista}, {pessoa:car-mentor-veterano} liga com uma lista de erros anotada volta a volta. Quer repassar tudo agora, antes que você esqueça.',
        choices: {
          'ouvir-licao': {
            label: 'Pegar papel e caneta e ouvir até o fim',
            outcomes: ['A análise é cruel e precisa. Você termina a ligação com a cabeça pesada e uma ideia clara do que mudar.'],
          },
          'pedir-espaco': {
            label: 'Pedir para conversar só depois de dormir',
            outcomes: ['A noite de sono faz bem. {primeiro:car-mentor-veterano} aceita, mas a voz do outro lado esfria um pouco.'],
          },
        },
      },
      {
        title: 'Um áudio longo depois de {pista}',
        body: '{pessoa:car-mentor-veterano} manda um áudio de quinze minutos sobre a sua corrida sem pontos. Começa com "não leve a mal" e piora a partir daí.',
        choices: {
          'ouvir-licao': {
            label: 'Ouvir o áudio duas vezes e responder com perguntas',
            outcomes: ['As perguntas viram uma aula. Dói reconhecer os erros, mas você enxerga onde perdeu a corrida.'],
          },
          'pedir-espaco': {
            label: 'Responder que hoje não dá para ouvir crítica',
            outcomes: ['Você preserva o humor do domingo. A resposta seguinte de {primeiro:car-mentor-veterano} demora dias para chegar.'],
          },
        },
      },
    ],
  },
  {
    id: 'jovem-pede-conselho',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'age', from: 'adult' },
      { c: 'noPerson', key: 'car-jovem-aprendiz' },
    ],
    choices: [
      {
        id: 'dar-atencao',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'meet', key: 'car-jovem-aprendiz', from: 'stranger', role: 'jovem do kart que você aconselha', org: 'Kartódromo Morro Azul', attitude: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'conselho-rapido',
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
        id: 'levar-ao-box',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'meet', key: 'car-jovem-aprendiz', from: 'stranger', role: 'jovem do kart que você aconselha', org: 'Kartódromo Morro Azul', attitude: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma pergunta na saída do autódromo',
        body: 'Na saída do autódromo, {pessoa:car-jovem-aprendiz}, de catorze anos, espera com um capacete de kart debaixo do braço. Pergunta, com a voz tremendo, como você chegou até aqui.',
        choices: {
          'dar-atencao': {
            label: 'Sentar no meio-fio e contar a história inteira',
            outcomes: ['A conversa dura uma hora, faz bem ao coração e termina com o seu telefone anotado no capacete. O treino da noite fica para depois.'],
          },
          'conselho-rapido': {
            label: 'Dar um conselho rápido e uma foto autografada',
            outcomes: ['A foto rende uma postagem simpática sobre você. Mas fica a sensação de que dava para ter feito mais.'],
          },
          'levar-ao-box': {
            label: 'Convidar para conhecer a equipe na próxima etapa',
            outcomes: [
              '{primeiro:car-jovem-aprendiz} passa o dia com a equipe, de olhos arregalados, e posta tudo. Os mecânicos não adoram ter visita no meio do trabalho.',
            ],
          },
        },
      },
      {
        title: 'Mensagem de um kartódromo distante',
        body: 'Chega uma mensagem longa de {pessoa:car-jovem-aprendiz}, que corre no {org:car-jovem-aprendiz}. A família não tem dinheiro, os resultados não vêm, e a pergunta é se vale a pena continuar.',
        choices: {
          'dar-atencao': {
            label: 'Ligar de volta e conversar com calma',
            outcomes: ['A ligação vira uma conversa de duas horas sobre persistência. Faz bem aos dois, mas a sua noite de descanso vai embora.'],
          },
          'conselho-rapido': {
            label: 'Responder com um texto curto e encorajador',
            outcomes: ['O texto vira print e circula nos grupos de kart, com elogios a você. Mesmo assim, a resposta parece pouca.'],
          },
          'levar-ao-box': {
            label: 'Convidar para ver uma corrida dos bastidores',
            outcomes: ['A visita vira o dia mais feliz da vida de {primeiro:car-jovem-aprendiz}. O chefe da equipe torce o nariz para o crachá extra.'],
          },
        },
      },
      {
        title: 'A última pergunta da clínica de kart',
        body: 'Numa clínica de kart para iniciantes, você é a atração principal. No fim, {pessoa:car-jovem-aprendiz}, da última fila, espera todo mundo ir embora para fazer a pergunta mais difícil do dia.',
        choices: {
          'dar-atencao': {
            label: 'Ficar depois do horário e responder com calma',
            outcomes: ['A pergunta difícil vira uma conversa sincera. Você sai de alma leve e com o horário do treino perdido.'],
          },
          'conselho-rapido': {
            label: 'Responder em uma frase e correr para o carro',
            outcomes: ['A frase é boa, e alguém filma. O vídeo agrada, mas o olhar decepcionado da última fila fica com você.'],
          },
          'levar-ao-box': {
            label: 'Oferecer uma visita aos bastidores da {equipe}',
            outcomes: ['A visita vira a melhor história da escola de {primeiro:car-jovem-aprendiz}. Na {equipe}, a chefia pede menos visitas.'],
          },
        },
      },
    ],
  },
  {
    id: 'aprendiz-manda-noticias',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'attitude', key: 'car-jovem-aprendiz', level: 'positive' },
      { c: 'season', part: 'start' },
    ],
    needs: ['person:car-jovem-aprendiz'],
    speaker: 'car-jovem-aprendiz',
    choices: [
      {
        id: 'incentivar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attitude', key: 'car-jovem-aprendiz', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'responder-curto',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'attitude', key: 'car-jovem-aprendiz', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Notícias do kart de {primeiro:car-jovem-aprendiz}',
        body: 'Antes da primeira etapa, chega uma foto de {pessoa:car-jovem-aprendiz} no pódio de um campeonato regional de kart. A legenda diz que tudo começou com aquela conversa com você.',
        choices: {
          incentivar: {
            label: 'Pagar a inscrição da próxima temporada de kart',
            outcomes: ['A resposta chega em áudio, entre lágrimas e risadas. A inscrição pesa no caixa, e o coração fica leve.'],
          },
          'responder-curto': {
            label: 'Mandar parabéns e voltar ao treino de pré-temporada',
            outcomes: ['O treino de pré-temporada rende. A mensagem seguinte de {primeiro:car-jovem-aprendiz} demora um pouco mais para chegar.'],
          },
        },
      },
      {
        title: 'Um troféu dedicado a você',
        body: 'No começo da temporada, {pessoa:car-jovem-aprendiz} manda o vídeo da primeira vitória no kart e dedica o troféu a você. O vídeo já é o mais visto do kartódromo.',
        choices: {
          incentivar: {
            label: 'Mandar um jogo de pneus novos de presente',
            outcomes: ['{primeiro:car-jovem-aprendiz} posta a foto dos pneus como se fossem ouro. O presente custou caro e valeu cada centavo.'],
          },
          'responder-curto': {
            label: 'Curtir o vídeo e seguir a rotina',
            outcomes: ['A rotina não sai do trilho, e o treino agradece. Do outro lado, a curtida parece pouca.'],
          },
        },
      },
    ],
  },

  /* ---------------- Reta final ---------------- */

  {
    id: 'pressao-reta-final',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'season', part: 'late' }],
    choices: [
      {
        id: 'foco-total',
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
        id: 'aliviar',
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
        id: 'assumir-pressao',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Reta final, nervos à flor da pele',
        body: 'Faltam poucas etapas, e cada conversa na {equipe} gira em torno do resultado. Patrocinadores, imprensa e diretoria querem saber a mesma coisa: você entrega ou não entrega?',
        choices: {
          'foco-total': {
            label: 'Cortar tudo o que não for treino',
            outcomes: ['A rotina vira quartel: treino, sono, treino. O rendimento sobe, o humor desce.'],
          },
          aliviar: {
            label: 'Tirar um fim de semana de folga antes da reta',
            outcomes: ['A folga recarrega as baterias e devolve o sorriso. O ritmo de treino, porém, perde um pouco do embalo.'],
          },
          'assumir-pressao': {
            label: 'Dizer em público que vai buscar o resultado',
            outcomes: [
              'A frase pega bem, e você entra na reta final com o destino nas próprias mãos.',
              'A frase vira cobrança em cada entrevista, e a pressão pesa mais do que você esperava.',
            ],
          },
        },
      },
      {
        title: 'A meta da temporada no quadro branco',
        body: 'Na parede da {equipe}, alguém escreveu a meta da temporada num quadro branco, em letras grandes. Faltam poucas corridas, e todo mundo passa pelo quadro olhando para você.',
        choices: {
          'foco-total': {
            label: 'Mudar para perto da equipe até o fim da temporada',
            outcomes: ['Morar ao lado da oficina rende horas extras de treino. A saudade de casa vem junto.'],
          },
          aliviar: {
            label: 'Apagar o quadro e pedir confiança no trabalho',
            outcomes: ['O gesto alivia a equipe inteira e o seu peito também. Sem a cobrança à vista, o ritmo dos treinos afrouxa.'],
          },
          'assumir-pressao': {
            label: 'Escrever o seu nome embaixo da meta, com caneta permanente',
            outcomes: [
              'O gesto vira foto nas redes da equipe, e os patrocinadores adoram a ousadia.',
              'A caneta permanente não sai, e a meta passa a encarar você todo dia. A cada treino ruim, pesa mais.',
            ],
          },
        },
      },
      {
        title: 'O patrocinador conta os dias',
        body: 'O principal patrocinador da {equipe} manda um e-mail curto para todos: a renovação do ano que vem depende do que acontecer nas últimas etapas. Você está em cópia.',
        choices: {
          'foco-total': {
            label: 'Desligar o e-mail do telefone e treinar dobrado',
            outcomes: ['Sem distrações, os treinos rendem como nunca. Mas a tensão de não saber o que chega na caixa de entrada consome você.'],
          },
          aliviar: {
            label: 'Passar uns dias em {cidade} com a família',
            outcomes: ['A comida de casa e as conversas de sempre devolvem a leveza. Na volta, o volante parece um pouco estranho.'],
          },
          'assumir-pressao': {
            label: 'Responder a todos que o resultado vem, e com sobra',
            outcomes: [
              'O patrocinador responde com uma palavra só, "ótimo", e a confiança de todos sobe junto com a sua.',
              'O "com sobra" vira piada interna no comercial da equipe, e cada etapa sem resultado pesa em dobro.',
            ],
          },
        },
      },
    ],
  },
  /* ---------------- O peso do sobrenome (Fase 6) ---------------- */

  {
    id: 'comparacao-com-o-antecessor',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'famousParent' },
      { c: 'race', tag: 'noPoints' },
    ],
    choices: [
      {
        id: 'aceitar-a-comparacao',
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
        id: 'pedir-espaco',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'carisma',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'reputation', size: 2 }] }],
      },
    ],
    variants: [
      {
        title: 'Na sua idade, {antecessor}...',
        body: 'Depois da corrida sem pontos em {pista}, um repórter abre o caderno e lê os números de {antecessor} na mesma idade. A pergunta vem em seguida: o sobrenome {sobrenome} pesa?',
        choices: {
          'aceitar-a-comparacao': {
            label: 'Admitir que a comparação existe e faz parte',
            outcomes: ['A resposta honesta agrada aos jornalistas, mas a frase fica ecoando na sua cabeça a semana inteira.'],
          },
          'pedir-espaco': {
            label: 'Pedir que a comparação fique fora das perguntas',
            outcomes: [
              'O pedido é respeitado, e as matérias seguintes falam só da sua corrida.',
              'O pedido vira manchete sobre o peso do sobrenome, e a equipe pede mais calma nas entrevistas.',
            ],
          },
          carisma: {
            label: 'Brincar que {antecessor} também perdeu muita corrida',
            outcomes: ['A risada é geral, até de quem fez a pergunta. A comparação vira elogio à sua leveza.'],
          },
        },
      },
      {
        title: 'O vídeo lado a lado',
        body: 'Nas redes, alguém montou um vídeo lado a lado: {antecessor} vencendo em {pista}, anos atrás, e você terminando fora dos pontos no mesmo lugar. O vídeo corre o paddock.',
        choices: {
          'aceitar-a-comparacao': {
            label: 'Assistir ao vídeo e guardar a lição',
            outcomes: ['Dói, mas você descobre onde {antecessor} ganhava tempo naquela curva.'],
          },
          'pedir-espaco': {
            label: 'Responder ao vídeo com uma mensagem firme',
            outcomes: [
              'A mensagem é elogiada pela firmeza, e o vídeo some das conversas.',
              'A resposta parece irritação, e o vídeo ganha ainda mais visualizações.',
            ],
          },
          carisma: {
            label: 'Repostar o vídeo com uma legenda bem-humorada',
            outcomes: ['A legenda faz mais sucesso que o vídeo, e até os críticos riem junto.'],
          },
        },
      },
      {
        title: 'A tabela que ninguém pediu',
        body: 'Uma revista publica a tabela das primeiras temporadas de {antecessor} ao lado das suas, e a corrida sem pontos em {pista} entra na conta. O título pergunta se a família {sobrenome} ainda tem o mesmo fôlego.',
        choices: {
          'aceitar-a-comparacao': {
            label: 'Dizer que a tabela é justa e que o jogo é longo',
            outcomes: ['A maturidade da resposta rende elogios, e a revista faz uma matéria mais simpática na edição seguinte.'],
          },
          'pedir-espaco': {
            label: 'Lembrar que cada carreira tem o seu tempo',
            outcomes: [
              'A frase vira bordão no paddock, e a revista corrige o tom.',
              'A frase soa como desculpa depois de uma corrida ruim, e a revista não perdoa.',
            ],
          },
          carisma: {
            label: 'Mandar à revista a sua própria versão da tabela, com notas de rodapé engraçadas',
            outcomes: ['A revista publica a sua versão, e a edição esgota nas bancas.'],
          },
        },
      },
    ],
  },
  {
    id: 'sobrenome-abre-portas',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'has', what: 'famousParent' }],
    needs: ['otherTeam'],
    choices: [
      {
        id: 'aceitar-o-convite',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'interest', team: 'other', size: 2 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'recusar-por-orgulho',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'interest', team: 'other', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um telefonema pelo sobrenome',
        body: 'O chefe da {outraEquipe} liga sem rodeio: trabalhou com {antecessor} anos atrás e quer conhecer quem carrega o sobrenome {sobrenome}. Um café, sem compromisso.',
        choices: {
          'aceitar-o-convite': {
            label: 'Aceitar o café e ouvir',
            outcomes: ['O café vira uma conversa longa sobre o passado e sobre o futuro. A {outraEquipe} passa a acompanhar os seus resultados de perto.'],
          },
          'recusar-por-orgulho': {
            label: 'Responder que prefere uma conversa pelos resultados',
            outcomes: ['A recusa educada esfria o contato, mas a decisão traz uma confiança que nenhum café traria.'],
          },
        },
      },
      {
        title: 'Portas que abrem antes de você bater',
        body: 'Na saída do autódromo, um diretor da {outraEquipe} se apresenta e diz que a família {sobrenome} sempre foi bem-vinda lá. Entrega um cartão e pede uma visita à fábrica.',
        choices: {
          'aceitar-o-convite': {
            label: 'Marcar a visita para a semana seguinte',
            outcomes: ['A visita rende fotos, apertos de mão e um interesse que antes não existia.'],
          },
          'recusar-por-orgulho': {
            label: 'Guardar o cartão e não ligar',
            outcomes: ['O cartão fica na gaveta. Você não quer uma vaga emprestada pelo sobrenome, e a decisão reforça a sua confiança.'],
          },
        },
      },
    ],
  },
  {
    id: 'manchete-com-o-sobrenome',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'famousParent' },
      { c: 'race', tag: 'podium' },
    ],
    choices: [
      { id: 'dividir-o-merito', outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'reputation', size: 1 }] }] },
      {
        id: 'falar-so-da-corrida',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 2 }] },
          { odds: 'rest', effects: [{ e: 'stat', stat: 'reputation', size: -1 }] },
        ],
      },
    ],
    variants: [
      {
        title: 'O sobrenome na manchete',
        body: 'O pódio em {pista} rende a manchete do dia, mas a foto maior é de {antecessor}, de arquivo. O título fala na volta do sobrenome {sobrenome} ao alto do pódio.',
        choices: {
          'dividir-o-merito': {
            label: 'Agradecer a {antecessor} em todas as entrevistas',
            outcomes: ['A gratidão comove os leitores e a reputação sobe junto. Por dentro, fica a vontade de ver a sua foto maior.'],
          },
          'falar-so-da-corrida': {
            label: 'Falar só do seu fim de semana',
            outcomes: [
              'As entrevistas mudam de tom: pela primeira vez, a corrida é sua.',
              'A imprensa lê a resposta como ingratidão, e as matérias seguintes cobram humildade.',
            ],
          },
        },
      },
      {
        title: 'Herança ou talento?',
        body: 'Depois do pódio em {pista}, um colunista escreve que o resultado é metade talento, metade sobrenome. A pergunta corre o paddock.',
        choices: {
          'dividir-o-merito': {
            label: 'Responder que o sobrenome ajuda e que o volante é seu',
            outcomes: ['A resposta equilibrada agrada, e o colunista volta atrás no texto seguinte.'],
          },
          'falar-so-da-corrida': {
            label: 'Ignorar o colunista e comemorar com a equipe',
            outcomes: [
              'A festa com os mecânicos responde melhor do que qualquer frase.',
              'O silêncio é lido como irritação, e a coluna da semana seguinte é ainda mais dura.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'entrevista-sobre-o-antecessor',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'famousParent' },
      { c: 'tier', min: 3 },
    ],
    choices: [
      {
        id: 'contar-historias',
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
        id: 'falar-da-propria-carreira',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A entrevista que não era sobre você',
        body: 'Um programa de esporte convida você para uma entrevista longa. Na hora, metade das perguntas é sobre {antecessor}: as vitórias, as brigas, os bastidores.',
        choices: {
          'contar-historias': {
            label: 'Contar as histórias de família com gosto',
            outcomes: ['O programa bate recorde de audiência. A gravação toma o tempo do simulador, mas o nome {sobrenome} ganha mais brilho.'],
          },
          'falar-da-propria-carreira': {
            label: 'Puxar a conversa para a sua carreira',
            outcomes: ['A produção corta metade das perguntas, e você sai do estúdio com a sensação de ter defendido o próprio espaço.'],
          },
        },
      },
      {
        title: 'Especial de família',
        body: 'Uma emissora prepara um especial sobre a família {sobrenome} e quer você contando como era crescer perto de {antecessor}.',
        choices: {
          'contar-historias': {
            label: 'Abrir o álbum de fotos para as câmeras',
            outcomes: ['As fotos antigas rendem o melhor trecho do especial. A gravação toma dois dias de treino, e a fama da família cresce.'],
          },
          'falar-da-propria-carreira': {
            label: 'Participar só com um depoimento curto',
            outcomes: ['O depoimento curto passa quase despercebido, e você volta ao treino com a cabeça mais leve.'],
          },
        },
      },
    ],
  },
  {
    id: 'torcedores-antigos-da-familia',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'has', what: 'famousParent' }],
    choices: [
      {
        id: 'atender-todo-mundo',
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
        id: 'seguir-para-o-box',
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
    ],
    variants: [
      {
        title: 'Bandeiras antigas na arquibancada',
        body: 'Em {pista}, um grupo de torcedores aparece com bandeiras desbotadas de {antecessor}. Eles esperam por você na saída do box, com fotos para autografar.',
        choices: {
          'atender-todo-mundo': {
            label: 'Parar e atender um por um',
            outcomes: ['Cada foto vem com uma história de {antecessor}. Você chega ao briefing com atraso, mas com o coração cheio.'],
          },
          'seguir-para-o-box': {
            label: 'Acenar e seguir direto para o box',
            outcomes: [
              'O aceno não convence os torcedores antigos, e alguém comenta nas redes que o sobrenome merecia mais. O briefing, ao menos, começa na hora.',
            ],
          },
        },
      },
      {
        title: 'Alguém que viu tudo',
        body: 'Um senhor de boné antigo para você no paddock: viu todas as corridas de {antecessor} e diz que você guia do mesmo jeito. Ele tem uma pergunta e muito tempo.',
        choices: {
          'atender-todo-mundo': {
            label: 'Ouvir a história inteira',
            outcomes: ['A conversa dura meia hora e termina num abraço. A cabeça sai mais leve, e a preparação sai mais curta.'],
          },
          'seguir-para-o-box': {
            label: 'Agradecer e pedir licença para trabalhar',
            outcomes: ['O senhor sorri sem jeito, e a história fica para outro dia. A preparação sai completa, mas a cena circula nas redes.'],
          },
        },
      },
    ],
  },
  {
    id: 'perto-do-recorde-da-familia',
    category: 'career',
    frequency: 'normal',
    when: [
      { c: 'has', what: 'famousParent' },
      { c: 'race', tag: 'fastestLap' },
    ],
    choices: [
      {
        id: 'mirar-o-recorde',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      { id: 'olhar-para-a-frente', outcomes: [{ odds: 'sure', effects: [{ e: 'stat', stat: 'form', size: 1 }] }] },
    ],
    variants: [
      {
        title: 'Perto do recorde da família',
        body: 'A sua volta mais rápida em {pista} fica a um piscar de olhos da marca que {antecessor} deixou ali. A equipe imprime as duas voltas lado a lado.',
        choices: {
          'mirar-o-recorde': {
            label: 'Pendurar a folha na parede do box',
            outcomes: ['A folha vira motivação diária. Cada treino passa a ser uma conversa com o passado.'],
          },
          'olhar-para-a-frente': {
            label: 'Guardar a folha e pensar na próxima etapa',
            outcomes: ['Sem olhar para trás, a preparação para a próxima etapa sai mais limpa.'],
          },
        },
      },
      {
        title: 'Duas voltas, um sobrenome',
        body: 'Os engenheiros sobrepõem a telemetria da sua volta mais rápida em {pista} à de {antecessor}, de anos atrás. Em algumas curvas, a sua linha já ganha tempo.',
        choices: {
          'mirar-o-recorde': {
            label: 'Estudar curva por curva onde ainda dá para ganhar',
            outcomes: ['O estudo rende ideias novas, e a confiança cresce junto com elas.'],
          },
          'olhar-para-a-frente': {
            label: 'Agradecer e voltar ao acerto da próxima corrida',
            outcomes: ['A comparação fica no computador dos engenheiros, e a cabeça fica na próxima corrida.'],
          },
        },
      },
    ],
  },
];
