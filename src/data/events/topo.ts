/**
 * Eventos do topo da escada (Fase 5): só para os degraus 6 e 7, as duas últimas fórmulas. Quem passa
 * muitas temporadas lá em cima esgota o catálogo geral; estes cartões contam o dia a dia do topo:
 * simulador de fábrica, pacote de atualização, estratégia, pneus em teste, diretor de prova,
 * companheiro campeão, corrida noturna, circuito de rua, imprensa internacional, renovação,
 * documentário, assessor financeiro, contrato de imagem, imposto no exterior, fusos, calor tropical
 * e a vida longe de casa.
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Sem marcas nem pessoas da memória: cada cartão vale
 * sozinho. Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const TOP_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'sessao-no-simulador-de-fabrica',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'programa-completo',
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
        id: 'encurtar',
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
        id: 'aprendiz',
        requires: [{ c: 'trait', trait: 'quickLearner' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'attribute', attribute: 'pace', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
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
        title: 'O simulador que custa mais que o carro',
        body: 'A fábrica da {equipe} abriu para você o simulador de última geração. O programa da semana tem trezentas voltas, três acertos diferentes e um engenheiro anotando cada respiro.',
        choices: {
          'programa-completo': {
            label: 'Cumprir as trezentas voltas sem reclamar',
            outcomes: ['Na volta duzentos você já sabe onde cada zebra treme. A cabeça sai da sessão pesada, mas a pilotagem sai mais regular.'],
          },
          encurtar: {
            label: 'Encurtar a sessão e guardar energia para a pista',
            outcomes: ['Você chega à pista com a cabeça leve, mas os engenheiros anotam que o programa ficou pela metade.'],
          },
          aprendiz: {
            label: 'Absorver os três acertos numa tarde só',
            outcomes: [
              'Na terceira hora você já corrige o acerto antes de o engenheiro pedir. A fábrica comenta o seu ritmo de aprendizado.',
              'Você pega o jeito de dois acertos, mas o terceiro não entra. Sai da fábrica com o ritmo melhor e o humor pior.',
            ],
          },
        },
      },
      {
        title: 'A plataforma que dá enjoo',
        body: 'A plataforma nova do simulador da {equipe} balança tanto quanto o carro de verdade. Na primeira hora, metade dos pilotos de teste saiu de lá pálida. Agora é a sua vez.',
        choices: {
          'programa-completo': {
            label: 'Aguentar o enjoo até o corpo se acostumar',
            outcomes: ['Na segunda hora o estômago desiste de reclamar. Você sai de lá com as frenagens decoradas e uma vontade enorme de deitar.'],
          },
          encurtar: {
            label: 'Pedir que desliguem a plataforma e treinar sem balanço',
            outcomes: ['Sem o balanço, o treino fica confortável e pouco útil. O engenheiro de simulação faz cara de quem já viu isso antes.'],
          },
          aprendiz: {
            label: 'Ajustar o corpo ao balanço logo nas primeiras voltas',
            outcomes: [
              'Em vinte minutos você esquece que está numa sala fechada. Os dados da tarde vão direto para o acerto do fim de semana.',
              'O corpo se acostuma rápido, a cabeça nem tanto. As voltas melhoram, mas o mal-estar vai com você até o hotel.',
            ],
          },
        },
      },
      {
        title: 'Corrida inteira numa sala sem janela',
        body: 'O engenheiro quer simular a próxima prova de ponta a ponta, com paradas, pneus gastando e tráfego. São quase duas horas sem sair do cockpit virtual.',
        choices: {
          'programa-completo': {
            label: 'Fazer a corrida simulada do início ao fim',
            outcomes: ['Você erra a segunda parada, corrige na terceira e decora o desgaste volta a volta. O cansaço é de domingo, sem o troféu.'],
          },
          encurtar: {
            label: 'Fazer só a primeira metade e pular as paradas',
            outcomes: ['Metade da prova basta para o ritmo, não para a estratégia. A equipe fecha o relatório com um ponto de interrogação.'],
          },
          aprendiz: {
            label: 'Decorar a prova simulada numa única tentativa',
            outcomes: [
              'Na primeira tentativa você acerta o ponto de parada que a fábrica levou um mês para calcular. O chefe pede uma cópia dos dados.',
              'A prova entra na cabeça de primeira, mas o corpo não acompanha: as duas horas viram três de dor nas costas.',
            ],
          },
        },
      },
      {
        title: 'A referência dos pilotos de teste',
        body: 'Na fila do simulador da fábrica, os pilotos de teste da {equipe} já marcaram tempos que você nunca viu. O engenheiro pede que você bata a referência deles antes da próxima etapa.',
        choices: {
          'programa-completo': {
            label: 'Repetir a volta até encostar no tempo deles',
            outcomes: ['Na volta oitenta você encosta na referência. O tempo não sai bonito, mas a regularidade impressiona a sala de dados.'],
          },
          encurtar: {
            label: 'Dizer que referência de simulador não ganha corrida',
            outcomes: ['A frase arranca risada dos mecânicos e um silêncio comprido do engenheiro de simulação. Você sai cedo e janta com calma.'],
          },
          aprendiz: {
            label: 'Estudar a telemetria deles e copiar o que funciona',
            outcomes: [
              'Duas voltas de estudo bastam: você bate a referência, e agora são os pilotos de teste que vão estudar a sua telemetria.',
              'Você copia a frenagem deles com facilidade, mas a saída de curva não encaixa. O dia rende, o humor nem tanto.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'pacote-de-atualizacao-do-meio-do-ano',
    category: 'track',
    frequency: 'normal',
    oncePerSeason: true,
    when: [
      { c: 'tier', min: 6 },
      { c: 'season', part: 'middle' },
    ],
    choices: [
      {
        id: 'montar-tudo',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'carro-conhecido',
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
      {
        id: 'leitura-tecnica',
        requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'car', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A asa nova chegou de avião',
        body: 'O pacote de meio de temporada da {equipe} desembarcou de madrugada: asa dianteira, assoalho e uma tampa de motor redesenhada. Só há um treino livre para descobrir se funciona.',
        choices: {
          'montar-tudo': {
            label: 'Montar o pacote inteiro já no primeiro treino',
            outcomes: [
              'O assoalho novo cola o carro no chão nas curvas rápidas. A equipe comemora como se fosse vitória.',
              'Nada encaixa no primeiro treino, e você passa a sessão brigando com um carro desconhecido. Os engenheiros, ao menos, agradecem os dados.',
            ],
          },
          'carro-conhecido': {
            label: 'Pedir para correr com a versão que você já conhece',
            outcomes: ['Você vai para a pista com o carro de sempre e a cabeça tranquila. Na fábrica, alguém resmunga que o investimento ficou no caminhão.'],
          },
          'leitura-tecnica': {
            label: 'Sentar com os aerodinamicistas e entender cada peça',
            outcomes: ['Você entende o que a asa nova quer e pilota para ela. A conversa entra pela noite, e o carro agradece no treino.'],
          },
        },
      },
      {
        title: 'O pacote que brilhou no túnel',
        body: 'Os números do túnel de vento prometem um carro bem mais rápido nas curvas de alta. O problema é que ninguém ainda andou com o pacote novo numa pista de verdade.',
        choices: {
          'montar-tudo': {
            label: 'Ser a primeira pessoa a levar o pacote para a pista',
            outcomes: [
              'O carro faz na pista o que fez no túnel. O engenheiro-chefe manda uma mensagem curta: era isso.',
              'Na pista, o vento sopra diferente do túnel. O pacote fica no carro, mas o seu sábado vira um quebra-cabeça.',
            ],
          },
          'carro-conhecido': {
            label: 'Esperar mais dados antes de mexer no carro',
            outcomes: ['Você corre com o carro de sempre e dorme sem susto. A fábrica, que trabalhou dobrado, não esconde a decepção.'],
          },
          'leitura-tecnica': {
            label: 'Cruzar os números do túnel com a sua telemetria',
            outcomes: [
              'Você acha a curva em que o túnel e a pista discordam e ajusta o acerto antes do treino. Os engenheiros passam a chamar você para as reuniões.',
            ],
          },
        },
      },
      {
        title: 'Peças com a tinta ainda fresca',
        body: 'As peças novas da {equipe} chegaram sem nenhuma volta de teste. O diretor técnico jura que o carro ficou outro. Os mecânicos, que montaram tudo de madrugada, não juram nada.',
        choices: {
          'montar-tudo': {
            label: 'Confiar no diretor técnico e montar tudo',
            outcomes: [
              'O carro ficou outro mesmo, e para melhor. Os mecânicos pagam o café da equipe inteira.',
              'Uma das peças vibra em alta velocidade, e você termina o treino com o carro e a confiança balançando.',
            ],
          },
          'carro-conhecido': {
            label: 'Ficar com o carro velho até as peças provarem algo',
            outcomes: ['O carro velho não surpreende, para o bem e para o mal. O diretor técnico passa por você no box sem dar bom-dia.'],
          },
          'leitura-tecnica': {
            label: 'Pedir os relatórios de projeto e ler a noite toda',
            outcomes: ['De madrugada você acha o detalhe que ninguém tinha visto na fixação da asa. De manhã, o pacote funciona e o crédito é seu.'],
          },
        },
      },
    ],
  },
  {
    id: 'estrategia-contra-o-engenheiro',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'seguir-o-plano',
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
        id: 'impor',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'poupar',
        requires: [{ c: 'trait', trait: 'tyreSaver' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 2 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma parada ou duas?',
        body: 'Na reunião de estratégia, o engenheiro de corrida desenha duas paradas no quadro branco. Você tem certeza de que o carro aguenta uma só. A discussão já dura meia hora.',
        choices: {
          'seguir-o-plano': {
            label: 'Apagar a sua ideia e assinar o plano dele',
            outcomes: ['O plano de duas paradas funciona sem brilho. O engenheiro agradece a confiança, e você engole a dúvida até o hotel.'],
          },
          impor: {
            label: 'Bater o pé pela estratégia de uma parada',
            outcomes: [
              'A sua aposta funciona e vira assunto no paddock. O engenheiro admite, de cara fechada, que você tinha razão.',
              'Os pneus acabam três voltas antes do previsto e a aposta desaba. O engenheiro nem precisa dizer nada.',
            ],
          },
          poupar: {
            label: 'Garantir que você faz o pneu durar a prova inteira',
            outcomes: [
              'Você estica o pneu como prometeu, volta após volta. O engenheiro risca as duas paradas do quadro e escreve o seu nome.',
              'O pneu dura, mas a conta fica no limite, e você passa a corrida inteira com o coração na mão.',
            ],
          },
        },
      },
      {
        title: 'Pneu duro ou macio na largada',
        body: 'O engenheiro de corrida quer largar com pneu duro e segurar posição. Você quer o macio para atacar nas primeiras voltas. Na véspera da corrida, ninguém cede.',
        choices: {
          'seguir-o-plano': {
            label: 'Largar de pneu duro, como o engenheiro quer',
            outcomes: ['A largada é conservadora e a corrida, previsível. A equipe elogia a disciplina; você guarda a frustração.'],
          },
          impor: {
            label: 'Exigir o macio e assumir a responsabilidade',
            outcomes: [
              'O macio rende o que você prometeu, e as primeiras voltas viram um espetáculo.',
              'O macio esfarela antes do esperado, e o carro vira presa fácil no meio do pelotão.',
            ],
          },
          poupar: {
            label: 'Propor o macio e jurar que ele vai durar',
            outcomes: [
              'Você cuida do macio como de um copo de cristal e ainda ataca no fim. O engenheiro anota a lição.',
              'O macio aguenta, por pouco. Você termina a corrida com a sensação de ter pilotado na ponta dos pés.',
            ],
          },
        },
      },
      {
        title: 'O primeiro pingo de chuva',
        body: 'A previsão aponta chuva para o meio da prova. O engenheiro de corrida quer esperar o primeiro pingo para chamar você ao box. Você prefere antecipar a troca e ganhar no risco.',
        choices: {
          'seguir-o-plano': {
            label: 'Esperar o primeiro pingo, como manda o plano',
            outcomes: ['O box chama na hora certa, e você não perde nada, nem ganha. A equipe gosta da sintonia; você queria mais.'],
          },
          impor: {
            label: 'Avisar que vai antecipar a troca de qualquer jeito',
            outcomes: [
              'A chuva cai na volta exata que você previu. Você vira destaque da transmissão e pesadelo do engenheiro.',
              'A chuva atrasa, você roda no seco com pneu de chuva e perde tudo o que tinha ganhado.',
            ],
          },
          poupar: {
            label: 'Prometer esticar o pneu seco até a chuva apertar',
            outcomes: [
              'Você segura o pneu seco até o último momento possível e troca na volta perfeita.',
              'O pneu seco aguenta, mas a chuva chega antes da troca, e você atravessa duas voltas no susto.',
            ],
          },
        },
      },
      {
        title: 'O engenheiro não muda de ideia',
        body: 'Mais uma vez, o engenheiro de corrida desenha uma estratégia conservadora para você. Ele diz que os números mandam. Você acha que os números não sentem o carro.',
        choices: {
          'seguir-o-plano': {
            label: 'Confiar nos números mais uma vez',
            outcomes: ['Os números entregam uma corrida segura e sem susto. A confiança no box sobe; a sua paciência, nem tanto.'],
          },
          impor: {
            label: 'Pedir ao chefe para mudar a estratégia por cima dele',
            outcomes: [
              'O chefe dá razão a você, e a estratégia agressiva rende o melhor domingo do mês.',
              'O chefe aceita, a estratégia falha, e o engenheiro passa a falar com você só pelo rádio.',
            ],
          },
          poupar: {
            label: 'Mostrar que, poupando pneu, dá para ousar mais',
            outcomes: [
              'Você prova no treino que o pneu aguenta o ritmo que você quer. O engenheiro, convencido, refaz as contas.',
              'O treino convence pela metade. O engenheiro topa um meio-termo, e você topa sem sorrir.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'pneu-de-outra-fornecedora',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'dar-retorno',
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
        id: 'buscar-tempo',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -2 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'come-pneu',
        requires: [{ c: 'trait', trait: 'tyreEater' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'attribute', attribute: 'tyreManagement', size: 1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Borracha nova, fornecedora nova',
        body: 'A categoria vai trocar de fornecedora de pneus, e a {equipe} foi escolhida para o teste. A borracha nova esquenta devagar e escorrega no frio. Ninguém sabe ainda como ela envelhece.',
        choices: {
          'dar-retorno': {
            label: 'Rodar com calma e anotar tudo para os engenheiros',
            outcomes: ['Você passa o dia descrevendo cada escorregada. O relatório fica enorme, e você entende pneu como nunca tinha entendido.'],
          },
          'buscar-tempo': {
            label: 'Buscar o tempo mais rápido do teste',
            outcomes: [
              'O tempo do dia é seu, e a fornecedora pede uma foto com você ao lado do carro.',
              'O pneu frio escapa na primeira curva e o carro dá uma volta inteira na brita. Fim de teste mais cedo.',
            ],
          },
          'come-pneu': {
            label: 'Avisar que você gasta pneu e pedir o composto mais duro',
            outcomes: [
              'O composto duro esconde o seu defeito e ainda ensina a poupar a traseira. A fornecedora anota a sugestão.',
              'O composto duro ajuda pouco, e você volta ao box com a borracha em farrapos. Pelo menos a franqueza foi elogiada.',
            ],
          },
        },
      },
      {
        title: 'Pneus sem nome no teste fechado',
        body: 'Os pneus do teste chegam pintados de preto fosco, sem marca nem código. A fornecedora candidata quer saber se o desgaste é linear. Os engenheiros querem saber se você confia neles.',
        choices: {
          'dar-retorno': {
            label: 'Fazer stints longos e repetir cada volta igual',
            outcomes: ['Cada volta parece a anterior, de propósito. O teste é chato, e o aprendizado sobre desgaste fica para sempre.'],
          },
          'buscar-tempo': {
            label: 'Pôr o pneu no limite e ver onde ele quebra',
            outcomes: [
              'O pneu aguenta mais do que todos esperavam, e você também. O tempo de volta impressiona.',
              'O pneu solta a banda de rodagem em plena reta. O susto é grande, e a equipe encerra o teste.',
            ],
          },
          'come-pneu': {
            label: 'Mostrar onde o seu estilo destrói a borracha',
            outcomes: [
              'Os dados do seu estilo agressivo viram ouro para a fornecedora. E você aprende onde aliviar.',
              'Você destrói três jogos antes do almoço, e a fornecedora pede, com educação, que outro piloto assuma à tarde.',
            ],
          },
        },
      },
      {
        title: 'Teste de pneus a dez graus',
        body: 'Dez graus no termômetro e o teste da fornecedora nova marcado para as oito da manhã. Os mecânicos aquecem as mãos no escapamento. A borracha não aquece de jeito nenhum.',
        choices: {
          'dar-retorno': {
            label: 'Esperar o sol e rodar com método',
            outcomes: ['Você espera o asfalto esquentar e entrega uma tarde de dados limpos. O frio passa; o aprendizado fica.'],
          },
          'buscar-tempo': {
            label: 'Sair às oito em ponto e forçar o aquecimento',
            outcomes: [
              'Você acerta o ritual de aquecimento antes de todo mundo e lidera a manhã.',
              'A borracha fria trai na primeira freada forte. O carro fica parado na barreira de pneus até o almoço.',
            ],
          },
          'come-pneu': {
            label: 'Usar o seu jeito bruto para aquecer a borracha mais rápido',
            outcomes: [
              'Pela primeira vez, gastar pneu é vantagem: em duas voltas a borracha está pronta, e você aprende a dosar.',
              'O pneu esquenta rápido e acaba mais rápido ainda. A equipe ri do paradoxo; você, nem tanto.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'briefing-do-diretor-de-prova',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'ouvir',
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
        id: 'questionar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
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
        id: 'ficha-limpa',
        requires: [{ c: 'trait', trait: 'cleanRacer' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Limites de pista, de novo',
        body: 'No briefing dos pilotos, o diretor de prova avisa que vai punir quem passar das linhas brancas na curva final. Metade do grid reclama baixinho. A outra metade olha para você.',
        choices: {
          ouvir: {
            label: 'Anotar a regra e não abrir a boca',
            outcomes: ['Você sai do briefing com a regra decorada e o tédio estampado no rosto. Ninguém vai pegar você nessa curva.'],
          },
          questionar: {
            label: 'Perguntar por que a regra mudou em cima da hora',
            outcomes: [
              'A pergunta era a de todos, e os pilotos agradecem. O diretor de prova promete revisar.',
              'O diretor de prova responde seco, diante de todos, e a sua equipe recebe um telefonema desconfortável.',
            ],
          },
          'ficha-limpa': {
            label: 'Lembrar que a sua ficha não tem punição por limite de pista',
            outcomes: [
              'O diretor de prova sorri e cita o seu nome como exemplo. O grid inteiro ouve.',
              'O diretor agradece o histórico, mas avisa que a regra vale para todos. O elogio chega sem graça.',
            ],
          },
        },
      },
      {
        title: 'A relargada que quase deu errado',
        body: 'O diretor de prova convoca todos os pilotos para revisar a relargada depois do carro de segurança. Na última etapa, três carros quase se tocaram na reta. Ele quer nomes.',
        choices: {
          ouvir: {
            label: 'Escutar e guardar a sua opinião para depois',
            outcomes: ['Você ouve as regras novas sem se meter. Na pista, sabe exatamente onde acelerar, mas a reunião rendeu um bocejo atrás do outro.'],
          },
          questionar: {
            label: 'Defender que a relargada precisa de mais espaço',
            outcomes: [
              'Os veteranos apoiam a ideia, e o diretor muda o procedimento. O paddock percebe quem falou primeiro.',
              'A proposta soa como reclamação de quem quase bateu. Os comissários anotam o tom.',
            ],
          },
          'ficha-limpa': {
            label: 'Explicar a relargada certa com a calma de quem corre limpo',
            outcomes: [
              'O diretor pede que você repita a explicação para os estreantes. Você vira referência na sala.',
              'A explicação é boa, mas ninguém gosta de aula de colega. O silêncio na sala fica pesado.',
            ],
          },
        },
      },
      {
        title: 'O seu lance no telão do briefing',
        body: 'No meio do briefing, o diretor de prova projeta na tela uma manobra sua. Não houve punição, mas ele quer que todo o grid veja o lance. O silêncio é total.',
        choices: {
          ouvir: {
            label: 'Assistir ao vídeo sem se defender',
            outcomes: ['Você engole o orgulho e assiste até o fim. Na saída, dois veteranos batem no seu ombro.'],
          },
          questionar: {
            label: 'Pedir que mostrem também o que o outro piloto fez',
            outcomes: [
              'O segundo vídeo muda o clima da sala. O diretor encerra o assunto, e você sai com a razão.',
              'O segundo vídeo não ajuda em nada. A sala ri, e a risada vai junto para a imprensa.',
            ],
          },
          'ficha-limpa': {
            label: 'Dizer que a manobra foi limpa e que a ficha prova isso',
            outcomes: [
              'O diretor concorda: o vídeo era exemplo do que fazer, não do que evitar.',
              'O diretor aceita, mas avisa que vai olhar de perto. A fama de jogo limpo segue, arranhada.',
            ],
          },
        },
      },
      {
        title: 'Briefing de duas horas na véspera',
        body: 'O diretor de prova estica o briefing com regras de bandeira, saída dos boxes e largada. Já passa das nove da noite, e o seu engenheiro manda mensagens chamando para a reunião técnica.',
        choices: {
          ouvir: {
            label: 'Ficar até o fim e perder a reunião técnica',
            outcomes: ['Você ouve cada regra, mas chega ao box com os mecânicos já guardando as ferramentas.'],
          },
          questionar: {
            label: 'Pedir ao diretor que acelere o briefing',
            outcomes: [
              'O grid inteiro aplaude baixinho, e o diretor corta pela metade. Você ganha uma hora e alguns amigos.',
              'O diretor não gosta da pressa e manda a sua equipe ler o regulamento esportivo inteiro em voz alta.',
            ],
          },
          'ficha-limpa': {
            label: 'Sair mais cedo, já que nunca precisou dessas advertências',
            outcomes: [
              'O diretor libera você com um aceno: quem corre limpo pode ir. A reunião técnica rende.',
              'O diretor libera, mas a saída antecipada vira comentário no paddock. Você ganha a reunião e perde um pouco de sono.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'companheiro-campeao-pressiona',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    needs: ['teammate'],
    choices: [
      {
        id: 'aprender',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'attribute', attribute: 'racecraft', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'responder',
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
            effects: [
              { e: 'stat', stat: 'confidence', size: -2 },
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
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'stat', stat: 'teammateRelation', size: -2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teammateRelation', size: -3 },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O campeão do outro lado do box',
        body: '{companheiro} já foi campeão e faz questão de lembrar. No treino, ele pede à equipe para ver a sua telemetria, mas esconde a dele. Os mecânicos fingem que não perceberam.',
        choices: {
          aprender: {
            label: 'Deixar que ele veja e estudar como ele pilota',
            outcomes: ['Você mostra tudo e aprende o dobro só de observar como ele trabalha. Ele estranha a falta de briga.'],
          },
          responder: {
            label: 'Fechar a sua telemetria e responder no cronômetro',
            outcomes: [
              'Você fecha o treino à frente dele. {companheiro} pede de novo para ver a sua telemetria, agora sem a pose de campeão.',
              'Ele responde com uma volta que você não alcança. Na saída do box, nem precisa olhar para você.',
            ],
          },
          partir: {
            label: 'Ir para cima dele na primeira curva, sem esperar ordem',
            outcomes: [
              'A ultrapassagem por fora sai perfeita, e o box inteiro prende a respiração. O campeão agora sabe com quem divide a garagem.',
              'As rodas se tocam, os dois carros escapam, e o chefe convoca uma reunião a portas fechadas.',
            ],
          },
        },
      },
      {
        title: 'Conselho de campeão, com veneno',
        body: 'Na frente dos jornalistas, {companheiro} diz que você tem talento, mas ainda pilota como quem quer provar alguma coisa. A frase parece elogio. Não é.',
        choices: {
          aprender: {
            label: 'Agradecer o conselho e pedir uma conversa a sós',
            outcomes: ['A conversa a sós é sincera, para surpresa dos dois. Você sai com duas dicas de frenagem e um colega menos hostil.'],
          },
          responder: {
            label: 'Responder que provar é com o capacete na cabeça',
            outcomes: [
              'No domingo, você termina à frente dele, e a frase volta para quem a disse.',
              'No domingo, ele termina na sua frente, e a frase dele vira manchete da semana.',
            ],
          },
          partir: {
            label: 'Encarar o campeão diante das câmeras e devolver na mesma moeda',
            outcomes: [
              'Os jornalistas adoram, a torcida também. Você deixa claro que não vai pedir licença para ninguém.',
              'A troca de farpas vira bate-boca, e a assessoria da equipe precisa encerrar a coletiva às pressas.',
            ],
          },
        },
      },
      {
        title: 'O campeão escolhe primeiro',
        body: 'A equipe decidiu que {companheiro}, o campeão da casa, escolhe primeiro a estratégia em todas as etapas. Você recebe o que sobrar, inclusive a hora da parada.',
        choices: {
          aprender: {
            label: 'Aceitar e copiar o que ele faz de melhor',
            outcomes: ['Você vira a sombra dele nos treinos e aprende como um campeão administra uma corrida inteira.'],
          },
          responder: {
            label: 'Pedir ao chefe a mesma prioridade no fim de semana',
            outcomes: [
              'O chefe cede numa etapa, e você aproveita como se fosse a última chance.',
              'O chefe recusa, e {companheiro} fica sabendo do pedido antes do jantar.',
            ],
          },
          partir: {
            label: 'Ignorar a ordem do box e parar quando quiser',
            outcomes: [
              'Você para antes dele, sai na frente e ainda segura a posição. O box fica entre a bronca e o aplauso.',
              'A parada fora de hora atrapalha os dois carros. O chefe deixa claro que isso não se repete.',
            ],
          },
        },
      },
      {
        title: 'O campeão quer o seu engenheiro',
        body: '{companheiro} pediu à direção da {equipe} para trocar de engenheiro e escolheu justamente o seu. A decisão sai amanhã cedo. Até lá, todo mundo no box evita o assunto.',
        choices: {
          aprender: {
            label: 'Aceitar a troca e conhecer o engenheiro dele',
            outcomes: ['O engenheiro novo traz o método do campeão junto. Você perde um aliado e ganha um caderno de segredos.'],
          },
          responder: {
            label: 'Ir ao chefe e defender que o engenheiro fique',
            outcomes: [
              'O chefe mantém a dupla, e o seu engenheiro passa a defender você com unhas e dentes.',
              'O chefe atende o campeão. Você passa a semana montando uma parceria do zero.',
            ],
          },
          partir: {
            label: 'Bater na porta do motorhome dele e tirar tudo a limpo',
            outcomes: [
              'A conversa é dura, mas {companheiro} recua. No dia seguinte, ninguém fala mais em troca.',
              'A discussão escapa do motorhome e chega aos ouvidos do chefe. O clima no box congela.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'corrida-sob-refletores',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'adaptar',
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
        id: 'rotina',
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
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'reflexos',
        requires: [{ c: 'aptitude', aptitude: 'reflexes', level: 'high' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Largada às dez da noite',
        body: 'A próxima etapa é noturna: treino à meia-noite, classificação de madrugada e corrida com largada às dez. O corpo vai precisar acreditar que a noite é dia.',
        choices: {
          adaptar: {
            label: 'Dormir de dia e treinar de noite a semana inteira',
            outcomes: ['Em três dias o corpo vira morcego. Na largada, a cabeça está desperta, e o bom humor ficou em algum lugar da tarde.'],
          },
          rotina: {
            label: 'Manter os horários normais e confiar no café',
            outcomes: [
              'O café dá conta, e a adrenalina da largada faz o resto. Você nem sente a madrugada.',
              'Na volta trinta, o corpo lembra que é madrugada. Os reflexos chegam um instante atrasados até a bandeirada.',
            ],
          },
          reflexos: {
            label: 'Treinar as frenagens com a pista quase às escuras',
            outcomes: [
              'Você enxerga os pontos de freada pela sombra dos refletores. Os outros tateiam; você ataca.',
              'Os reflexos ajudam, mas os olhos ardem depois de horas de treino no escuro.',
            ],
          },
        },
      },
      {
        title: 'O refletor que ofusca a curva três',
        body: 'No reconhecimento da pista noturna, você percebe que um refletor bate direto na sua viseira na entrada da curva três. Os engenheiros dizem que não há o que fazer.',
        choices: {
          adaptar: {
            label: 'Treinar a curva até frear de olhos semicerrados',
            outcomes: ['Depois de cem voltas no simulador com o brilho reproduzido, a curva vira rotina. O pescoço reclama do esforço.'],
          },
          rotina: {
            label: 'Pedir uma viseira mais escura e esquecer o assunto',
            outcomes: [
              'A viseira escura resolve a curva três. As outras curvas, por sorte, nem precisavam dela.',
              'A viseira escura resolve a curva três e escurece todas as outras. Você corre meio às cegas.',
            ],
          },
          reflexos: {
            label: 'Usar o brilho do refletor como referência de freada',
            outcomes: [
              'O que cega os outros vira o seu marcador. Você freia no clarão e ganha posições ali.',
              'A ideia funciona no treino e falha uma vez na corrida, num susto que deixa as mãos tremendo.',
            ],
          },
        },
      },
      {
        title: 'Jantar ao nascer do sol',
        body: 'Na semana da corrida noturna, a equipe inverteu tudo: café da manhã às quatro da tarde, jantar ao nascer do sol. O nutricionista distribui cardápios, e alguns mecânicos já trocaram o dia pela noite.',
        choices: {
          adaptar: {
            label: 'Seguir o cardápio invertido à risca',
            outcomes: ['O corpo estranha o feijão ao nascer do sol, mas obedece. No fim de semana, você está no fuso da corrida, ainda que sem paciência.'],
          },
          rotina: {
            label: 'Comer nos horários de sempre e cochilar à tarde',
            outcomes: [
              'O cochilo da tarde funciona. À noite, a energia está lá, intacta, e o humor também.',
              'O corpo não entende o que está acontecendo, e a fome aparece na volta vinte, junto com o cansaço.',
            ],
          },
          reflexos: {
            label: 'Confiar que os reflexos aguentam qualquer horário',
            outcomes: [
              'Madrugada ou meio-dia, as mãos respondem igual. A corrida noturna parece feita para você.',
              'Os reflexos aguentam; a paciência com o horário maluco, nem tanto.',
            ],
          },
        },
      },
      {
        title: 'Nuvem de insetos sob os refletores',
        body: 'Os refletores da pista noturna atraem nuvens de insetos, e a viseira fica salpicada em duas voltas. Os veteranos dizem que a solução é paciência e uma película extra.',
        choices: {
          adaptar: {
            label: 'Treinar a troca de película a cada parada',
            outcomes: ['Você ensaia o gesto até ele virar automático. É cansativo, mas na corrida a visão fica limpa.'],
          },
          rotina: {
            label: 'Confiar na película padrão e torcer',
            outcomes: [
              'Os insetos dão uma folga justo na sua corrida. Você nem precisa da película extra.',
              'Na metade da prova, a viseira parece um para-brisa de estrada. Você pilota adivinhando as zebras.',
            ],
          },
          reflexos: {
            label: 'Pilotar no reflexo, mesmo com a visão salpicada',
            outcomes: [
              'Você enxerga pouco e reage rápido, e é o suficiente. Os insetos atrapalham mais os outros.',
              'Os reflexos salvam duas freadas, mas pilotar sem ver drena toda a energia da noite.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'circuito-de-rua-sem-erro',
    category: 'track',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'aos-poucos',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'raspar-o-muro',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'confidence', size: 2 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'confidence', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'volta-perfeita',
        requires: [{ c: 'trait', trait: 'qualifyingKing' }],
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
        title: 'Muros a um palmo da roda',
        body: 'A próxima etapa é num circuito de rua, entre prédios, bueiros e guard-rails. Não há área de escape: um erro de meio metro termina a corrida antes de ela começar.',
        choices: {
          'aos-poucos': {
            label: 'Começar devagar e ganhar confiança volta a volta',
            outcomes: ['Você chega ao limite aos poucos e termina os treinos sem um arranhão. O tempo é bom, não brilhante.'],
          },
          'raspar-o-muro': {
            label: 'Raspar o muro desde a primeira volta',
            outcomes: [
              'Você beija o muro em todas as saídas, e as câmeras amam. O tempo vem junto.',
              'Um beijo a mais no muro, e a roda dianteira vai embora. Os mecânicos passam a noite trocando suspensão.',
            ],
          },
          'volta-perfeita': {
            label: 'Guardar tudo para uma volta perfeita na classificação',
            outcomes: [
              'A volta da classificação é uma obra de arte entre os muros. Numa pista onde ninguém ultrapassa, você larga onde queria.',
              'A volta sai perfeita até a última curva, onde o pneu traseiro raspa o guard-rail. A equipe engole o susto.',
            ],
          },
        },
      },
      {
        title: 'Faixas pintadas e trilhos de bonde',
        body: 'O circuito de rua da próxima etapa passa por cima de trilhos de bonde e faixas de pedestre pintadas. Com a garoa da manhã, a tinta vira sabão. Os engenheiros pedem cautela.',
        choices: {
          'aos-poucos': {
            label: 'Decorar onde estão cada faixa e cada trilho',
            outcomes: ['Você anda a pé pelo traçado e marca cada armadilha no caderno. Na pista, nenhuma pega você.'],
          },
          'raspar-o-muro': {
            label: 'Ignorar a tinta e frear sempre no mesmo ponto',
            outcomes: [
              'A tinta escorrega, mas você segura. O tempo de volta espanta o box.',
              'A faixa pintada escapa sob a roda, e o carro escorrega até o guard-rail. O bico fica em pedaços.',
            ],
          },
          'volta-perfeita': {
            label: 'Esperar a pista secar e acertar uma volta só',
            outcomes: [
              'Na última tentativa, com a pista já seca, você encaixa a volta da vida.',
              'A pista seca tarde demais para a volta perfeita, e o engenheiro reclama do tempo perdido esperando.',
            ],
          },
        },
      },
      {
        title: 'A cidade fechou as ruas para a corrida',
        body: 'Arquibancadas montadas em praças, prédios cobertos de faixas e moradores nas janelas: o circuito de rua é a festa do ano. Na volta de reconhecimento, os muros parecem mais perto do que nos vídeos.',
        choices: {
          'aos-poucos': {
            label: 'Respeitar os muros e pensar no domingo',
            outcomes: ['Você trata o traçado com respeito e não arrisca nada na sexta. No domingo, o carro está inteiro e pronto para brigar.'],
          },
          'raspar-o-muro': {
            label: 'Dar um show para as janelas desde a sexta',
            outcomes: [
              'As janelas aplaudem a cada passagem. O tempo da sexta é seu, e a cidade grita o seu nome.',
              'O show termina contra o muro da praça principal, diante de milhares de celulares.',
            ],
          },
          'volta-perfeita': {
            label: 'Esconder o jogo até a última volta de classificação',
            outcomes: [
              'Você esconde o ritmo a sexta inteira e mostra tudo no sábado. Na rua, largar na frente vale ouro.',
              'O jogo escondido sai caro: no sábado, uma bandeira amarela estraga a sua única volta rápida.',
            ],
          },
        },
      },
      {
        title: 'O guard-rail que mudou de lugar',
        body: 'Na madrugada, os organizadores moveram um guard-rail da chicane para alargar a área de escape. O traçado que você decorou no simulador mudou alguns centímetros. Ninguém avisou os pilotos.',
        choices: {
          'aos-poucos': {
            label: 'Reaprender a chicane com calma no primeiro treino',
            outcomes: ['Você gasta o primeiro treino só na chicane nova. O tempo não aparece, mas o traçado entra na cabeça.'],
          },
          'raspar-o-muro': {
            label: 'Atacar a chicane nova como se nada tivesse mudado',
            outcomes: [
              'O espaço extra vira vantagem: você corta mais fundo que todo mundo e lidera o treino.',
              'O guard-rail está mais perto do que a memória jura. A lateral do carro deixa tinta nele.',
            ],
          },
          'volta-perfeita': {
            label: 'Usar a chicane nova para ensaiar a volta de classificação',
            outcomes: [
              'Você descobre na chicane nova um traçado que ninguém viu. A volta de classificação sai redonda.',
              'A chicane nova encaixa, mas o ensaio gasta pneus que a equipe guardava para o sábado.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'imprensa-internacional',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'resposta-pronta',
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
        id: 'sem-filtro',
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
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Perguntas em três idiomas',
        body: 'A coletiva de pré-etapa reúne jornalistas de meio mundo. Um pergunta em inglês, outro em espanhol, um terceiro arrisca um português de Portugal. Todos querem saber a sua história, desde o primeiro kart.',
        choices: {
          'resposta-pronta': {
            label: 'Responder no inglês ensaiado com a assessoria',
            outcomes: ['As respostas saem corretas e esquecíveis. A equipe agradece a disciplina, e você sai da sala sem graça.'],
          },
          'sem-filtro': {
            label: 'Contar a sua história do jeito que ela foi',
            outcomes: [
              'A história do kart de {cidade} roda as redações estrangeiras e vira reportagem de capa.',
              'Um detalhe da sua história sai distorcido na tradução, e a assessoria passa o dia desmentindo.',
            ],
          },
          carisma: {
            label: 'Trocar de idioma a cada pergunta, sempre com uma piada',
            outcomes: ['A sala ri em três línguas. No dia seguinte, os vídeos circulam em países onde a categoria nem passa na TV.'],
          },
        },
      },
      {
        title: 'A revista estrangeira quer um perfil',
        body: 'Uma revista de esporte de outro continente quer passar dois dias com você para um perfil longo. A assessoria da {equipe} pede cuidado: a repórter é conhecida por arrancar frases que viram polêmica.',
        choices: {
          'resposta-pronta': {
            label: 'Receber a repórter com a assessoria do lado',
            outcomes: ['O perfil sai bonito e sem sal. A equipe gosta; você nem se reconhece na reportagem.'],
          },
          'sem-filtro': {
            label: 'Abrir a sua rotina sem filtro nenhum',
            outcomes: [
              'O perfil é honesto e emocionante, e você ganha fãs em lugares que nem sabia apontar no mapa.',
              'Uma frase solta sobre a equipe vira o título da reportagem. O chefe lê antes de você.',
            ],
          },
          carisma: {
            label: 'Conquistar a repórter com a sua conversa de paddock',
            outcomes: ['Ela sai dos dois dias encantada, e o perfil vira o texto mais lido da revista no mês.'],
          },
        },
      },
      {
        title: 'Microfones de todas as cores',
        body: 'Na zona mista depois do treino, há microfones de canais que você nunca viu. Um repórter pergunta, em tom de provocação, se alguém vindo do Brasil aguenta a pressão do topo.',
        choices: {
          'resposta-pronta': {
            label: 'Desviar com a resposta que a assessoria ensinou',
            outcomes: ['Você desvia com elegância, e a equipe aprova. Mas a provocação fica ecoando até a hora de dormir.'],
          },
          'sem-filtro': {
            label: 'Responder à provocação com a sua trajetória',
            outcomes: [
              'A resposta corta o repórter no ar e vira o trecho mais compartilhado do dia.',
              'A resposta sai atravessada e soa arrogante na tradução. Os comentários não perdoam.',
            ],
          },
          carisma: {
            label: 'Rir da pergunta e convidar o repórter para um churrasco',
            outcomes: ['O repórter aceita o convite, ao vivo. A cena vira a coisa mais simpática do fim de semana.'],
          },
        },
      },
      {
        title: 'O podcast que o paddock inteiro escuta',
        body: 'O podcast de automobilismo mais ouvido do paddock internacional convida você para uma hora de conversa. Os apresentadores são ex-pilotos e não costumam aliviar para ninguém.',
        choices: {
          'resposta-pronta': {
            label: 'Ir com respostas preparadas e não sair do roteiro',
            outcomes: ['Uma hora sem tropeço e sem brilho. No fim, os apresentadores comentam que você parece ter medo do microfone.'],
          },
          'sem-filtro': {
            label: 'Topar qualquer assunto, inclusive os espinhosos',
            outcomes: [
              'A conversa vira um dos episódios mais ouvidos da temporada. Você fala do topo sem pose.',
              'Num assunto espinhoso, você fala demais sobre o carro da equipe. Os engenheiros escutam o episódio inteiro.',
            ],
          },
          carisma: {
            label: 'Transformar a entrevista numa conversa de bar',
            outcomes: ['Os ex-pilotos se divertem, contam as histórias deles e pedem a sua volta. Os patrocinadores compartilham o episódio.'],
          },
        },
      },
    ],
  },
  {
    id: 'fa-clube-no-exterior',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'encontro',
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
        id: 'foco-no-treino',
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
        id: 'brindes',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'all', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Uma bandeira do Brasil na arquibancada estrangeira',
        body: 'Num país onde você nunca morou, um grupo de fãs fundou um fã-clube com o seu nome. Eles levam faixas para todas as etapas e pedem um encontro antes da próxima corrida.',
        choices: {
          encontro: {
            label: 'Marcar o encontro e pagar o lanche de todos',
            outcomes: ['Os fãs aparecem com camisetas feitas em casa e um bolo com o seu capacete desenhado. Você volta para o box com o coração cheio.'],
          },
          'foco-no-treino': {
            label: 'Gravar um vídeo de agradecimento e focar na corrida',
            outcomes: ['O vídeo emociona o fã-clube, e você ganha uma tarde inteira de preparação. Mas o encontro que não houve pesa um pouco.'],
          },
          brindes: {
            label: 'Mandar luvas autografadas e um capacete usado',
            outcomes: ['O capacete vira relíquia na sede do fã-clube. Os patrocinadores adoram ver a marca exposta tão longe de casa.'],
          },
        },
      },
      {
        title: 'O fã-clube que canta em outra língua',
        body: 'Na arquibancada da reta, um grupo estrangeiro canta uma música inventada sobre você, numa língua que você não entende. O vídeo já roda o paddock. Eles querem conhecer você.',
        choices: {
          encontro: {
            label: 'Descer até a arquibancada e cantar junto',
            outcomes: ['Você erra a letra inteira, e ninguém se importa. O vídeo do coro com você no meio vira o momento do fim de semana.'],
          },
          'foco-no-treino': {
            label: 'Acenar do box e guardar a energia para o treino',
            outcomes: ['O aceno basta para a arquibancada explodir. O treino rende, mas fica a vontade de ter descido.'],
          },
          brindes: {
            label: 'Mandar bonés da equipe para a arquibancada inteira',
            outcomes: ['Os bonés chegam antes da largada, e a arquibancada vira um mar com as cores da {equipe}.'],
          },
        },
      },
      {
        title: 'Carta de um fã de outro continente',
        body: 'Uma carta escrita à mão chega à fábrica da {equipe}. É de um menino que aprendeu português só para escrever para você, em nome de um fã-clube de duzentas pessoas.',
        choices: {
          encontro: {
            label: 'Convidar o fã-clube para conhecer o box',
            outcomes: ['O menino passa a visita inteira de boca aberta. Você ganha um amigo para a vida e um desenho para pendurar no motorhome.'],
          },
          'foco-no-treino': {
            label: 'Responder com um bilhete curto e voltar ao treino',
            outcomes: ['Você responde em poucas linhas e volta para o simulador. O treino rende, mas a carta continua na mesa, pedindo mais.'],
          },
          brindes: {
            label: 'Mandar uma caixa de lembranças autografadas',
            outcomes: ['A caixa chega cheia de bonés, fotos e uma luva usada. O fã-clube posta tudo, e os patrocinadores repostam.'],
          },
        },
      },
    ],
  },
  {
    id: 'conversa-sobre-renovacao',
    category: 'career',
    frequency: 'normal',
    oncePerSeason: true,
    when: [
      { c: 'tier', min: 6 },
      { c: 'season', part: 'late' },
    ],
    choices: [
      {
        id: 'renovar',
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
        id: 'ouvir-o-mercado',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'releaseFee', size: -1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'frieza',
        requires: [{ c: 'aptitude', aptitude: 'composure', level: 'high' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'releaseFee', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O chefe chama para um café',
        body: 'Faltando poucas etapas para o fim do ano, o chefe da {equipe} chama você para um café fora do paddock. Ele quer saber se você fica. Ainda não há papel na mesa.',
        choices: {
          renovar: {
            label: 'Dizer que quer ficar e apertar a mão do chefe',
            outcomes: ['O aperto de mão vale contrato. A equipe respira aliviada, e o seu nome já aparece no planejamento do ano que vem.'],
          },
          'ouvir-o-mercado': {
            label: 'Pedir tempo para ouvir o mercado',
            outcomes: [
              'O chefe entende o recado e melhora as condições de saída para segurar você.',
              'O chefe agradece a sinceridade e sai do café em silêncio. A conversa fica fria até o fim da temporada.',
            ],
          },
          frieza: {
            label: 'Negociar sem pressa, sem mostrar o que você quer',
            outcomes: [
              'Você deixa o chefe falar primeiro e sai do café com um contrato mais flexível e o respeito dele.',
              'A conversa termina sem acordo, mas cordial. A noite de sono, essa, não vem fácil.',
            ],
          },
        },
      },
      {
        title: 'A renovação já impressa na gaveta',
        body: 'O chefe da {equipe} abre a gaveta e mostra uma proposta de renovação já impressa: duas temporadas, cláusula de saída dura e a promessa de prioridade no desenvolvimento do carro.',
        choices: {
          renovar: {
            label: 'Assinar ali mesmo, com a caneta do chefe',
            outcomes: ['A caneta falha na primeira tentativa, e os dois riem. Na segunda, o contrato está assinado.'],
          },
          'ouvir-o-mercado': {
            label: 'Levar a proposta para ler com calma em casa',
            outcomes: [
              'Com calma, você acha a cláusula que prendia demais e consegue afrouxá-la.',
              'A demora irrita o chefe, que começa a conversar com outros pilotos no paddock.',
            ],
          },
          frieza: {
            label: 'Ler na frente dele e riscar a cláusula de saída',
            outcomes: [
              'O chefe olha a cláusula riscada, pensa um minuto e rubrica a mudança.',
              'O chefe aceita a mudança, mas a sala esfria. Você sai com o contrato melhor e o estômago embrulhado.',
            ],
          },
        },
      },
      {
        title: 'Boatos sobre o seu futuro',
        body: 'Restam poucas corridas, e a imprensa já especula sobre o seu futuro. O chefe da {equipe} quer anunciar a renovação antes da próxima etapa, para acabar com os boatos.',
        choices: {
          renovar: {
            label: 'Topar o anúncio e encerrar os boatos',
            outcomes: ['O anúncio sai numa foto com o chefe e o carro. Os boatos morrem, e a equipe trabalha em paz.'],
          },
          'ouvir-o-mercado': {
            label: 'Pedir para anunciar só depois da última etapa',
            outcomes: [
              'O adiamento valoriza o seu passe, e o contrato chega melhor na reta final.',
              'O adiamento alimenta os boatos, e a equipe passa a desconfiar das suas conversas no paddock.',
            ],
          },
          frieza: {
            label: 'Deixar os boatos correrem e negociar com calma',
            outcomes: [
              'Com os boatos ajudando, o chefe melhora a oferta sem você pedir nada.',
              'Os boatos ajudam na mesa, mas cansam fora dela. O mês termina com a renovação feita e a paciência no fim.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'documentario-sobre-a-carreira',
    category: 'career',
    frequency: 'normal',
    when: [{ c: 'tier', min: 7 }],
    choices: [
      {
        id: 'abrir-as-portas',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'limitar',
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
        id: 'carisma',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 3 },
              { e: 'sponsorMood', who: 'all', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Câmeras no box a temporada inteira',
        body: 'Uma produtora quer filmar a sua temporada para um documentário em episódios. As câmeras estariam no box, no hotel e até no carro da equipe a caminho da pista.',
        choices: {
          'abrir-as-portas': {
            label: 'Abrir as portas e deixar filmarem tudo',
            outcomes: ['As câmeras viram parte da mobília. O documentário promete, mas uma lente sempre por perto cobra a concentração.'],
          },
          limitar: {
            label: 'Liberar só os dias de corrida',
            outcomes: ['A produtora aceita, sem entusiasmo. Você preserva a rotina, e os patrocinadores reclamam da exposição menor.'],
          },
          carisma: {
            label: 'Virar quem narra a própria história',
            outcomes: ['Você conduz as câmeras como quem conduz uma conversa. O trailer do documentário vira assunto antes da estreia.'],
          },
        },
      },
      {
        title: 'O diretor do documentário quer drama',
        body: 'O diretor do documentário reclama que as cenas estão calmas demais. Ele pede acesso às reuniões técnicas e às conversas com o chefe, de preferência as tensas.',
        choices: {
          'abrir-as-portas': {
            label: 'Liberar as reuniões, até as difíceis',
            outcomes: ['As cenas de bastidor ficam fortes e verdadeiras. Mas falar de estratégia com uma câmera ligada não é a mesma coisa.'],
          },
          limitar: {
            label: 'Proteger as reuniões e oferecer outra coisa',
            outcomes: ['Você oferece a sua rotina de treino no lugar. O diretor aceita a contragosto, e o episódio sai morno.'],
          },
          carisma: {
            label: 'Dar ao diretor o drama do tipo bom, contando histórias',
            outcomes: ['Você conta a sua trajetória com tanta graça que o diretor esquece as reuniões. O episódio vira o favorito do público.'],
          },
        },
      },
      {
        title: 'Um documentário que começa em {cidade}',
        body: 'Um canal de streaming quer contar a sua história desde o kart, com gravações em {cidade}, entrevistas com a família e cenas no paddock. As filmagens cairiam no meio da temporada.',
        choices: {
          'abrir-as-portas': {
            label: 'Topar e levar a equipe de filmagem até {cidade}',
            outcomes: ['A cidade inteira quer aparecer no documentário. As filmagens emocionam, mas a viagem extra cobra o preço na pista.'],
          },
          limitar: {
            label: 'Topar só depois do fim da temporada',
            outcomes: ['O canal aceita esperar, com menos entusiasmo. A cabeça fica na pista, e os patrocinadores perdem a vitrine deste ano.'],
          },
          carisma: {
            label: 'Conduzir pessoalmente as entrevistas em {cidade}',
            outcomes: ['Você entrevista a antiga professora, o dono do kartódromo e a família. O resultado é tão bom que o canal antecipa a estreia.'],
          },
        },
      },
    ],
  },
  {
    id: 'assessor-financeiro',
    category: 'money',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'contratar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'por-conta-propria',
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
        id: 'conferir',
        requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'cash', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O assessor das planilhas coloridas',
        body: 'Um assessor financeiro que cuida do dinheiro de atletas de vários esportes oferece os serviços. Ele promete organizar impostos, investimentos e gastos. A taxa dele não é pequena.',
        choices: {
          contratar: {
            label: 'Contratar o assessor e entregar as contas',
            outcomes: [
              'Em um mês ele acha gastos esquecidos e um investimento parado. As contas respiram, e você também.',
              'O assessor organiza tudo, mas a taxa dele come o que ele economizou. As planilhas são lindas; o saldo, nem tanto.',
            ],
          },
          'por-conta-propria': {
            label: 'Seguir cuidando das contas por conta própria',
            outcomes: ['Você economiza a taxa, mas passa as noites de hotel com extratos em vez de telemetria.'],
          },
          conferir: {
            label: 'Contratar o assessor e conferir cada cálculo dele',
            outcomes: [
              'Você acha dois erros nas contas do próprio assessor e corrige tudo. O saldo agradece; o treino daquela semana, nem tanto.',
              'As contas batem, mas conferir tudo toma as madrugadas. O dinheiro rende, a paciência acaba.',
            ],
          },
        },
      },
      {
        title: 'Um conselho de quem cuida de fortunas',
        body: 'O pai de um colega de grid apresenta você a uma assessora que cuida do patrimônio de famílias ricas. Ela diz que piloto no topo costuma ganhar muito e guardar pouco.',
        choices: {
          contratar: {
            label: 'Aceitar a assessora e seguir o plano dela',
            outcomes: [
              'O plano dela é simples e funciona: gastar menos com o que não aparece e investir o resto. O saldo cresce.',
              'O plano é bom, mas o primeiro investimento cai junto com a bolsa. A assessora pede paciência.',
            ],
          },
          'por-conta-propria': {
            label: 'Agradecer e manter o dinheiro onde está',
            outcomes: ['O dinheiro fica parado e seguro, e a sua cabeça, ocupada com ele. Duas reuniões técnicas passam sem a sua atenção total.'],
          },
          conferir: {
            label: 'Montar o plano junto com ela, número por número',
            outcomes: [
              'Lado a lado, vocês montam um plano que ela mesma diz ser melhor que o dela. O resultado aparece rápido, e o treino espera.',
              'O plano sai bom, mas cada reunião dura três horas. O dinheiro rende; o sono, não.',
            ],
          },
        },
      },
      {
        title: 'O extrato que ninguém lia',
        body: 'Depois de anos subindo de categoria, as suas contas viraram um emaranhado de patrocínios, prêmios e despesas de viagem. Um assessor financeiro recomendado pela {equipe} se oferece para desatar o nó.',
        choices: {
          contratar: {
            label: 'Deixar o assessor da equipe desatar o nó',
            outcomes: [
              'O assessor encontra prêmios que nunca tinham sido cobrados. O dinheiro entra, e o nó se desfaz.',
              'O nó se desfaz devagar, e a primeira fatura do assessor chega antes de qualquer economia.',
            ],
          },
          'por-conta-propria': {
            label: 'Passar uma semana desembaraçando tudo por conta própria',
            outcomes: ['Você economiza a taxa e aprende para onde vai cada centavo. A semana de contas, porém, rouba a de treino.'],
          },
          conferir: {
            label: 'Criar a sua própria planilha e pedir só uma revisão',
            outcomes: [
              'A sua planilha surpreende o assessor, que cobra só pela revisão. O saldo melhora, mesmo com as noites de treino trocadas por contas.',
              'A planilha funciona, mas levou noites demais. O resultado é bom; o humor, nem tanto.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'contrato-de-imagem',
    category: 'money',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'assinar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'recusar-campanha',
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
        id: 'carisma',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 2 },
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O seu rosto num outdoor de rodovia',
        body: 'Uma fabricante de bebidas esportivas quer comprar o direito de usar a sua imagem por dois anos: comerciais, embalagens e outdoors. A agenda de gravações cai nas semanas de corrida.',
        choices: {
          assinar: {
            label: 'Assinar e encaixar as gravações na agenda',
            outcomes: ['O dinheiro entra, e o seu rosto aparece em latas pelo país inteiro. As gravações, porém, invadem dias que eram de treino.'],
          },
          'recusar-campanha': {
            label: 'Recusar para não perder dias de preparação',
            outcomes: ['Você protege a agenda e chega às etapas com tudo em dia. Os patrocinadores atuais acham que você deixou dinheiro na mesa.'],
          },
          carisma: {
            label: 'Assinar e improvisar o roteiro do comercial',
            outcomes: ['O seu improviso vira o comercial oficial. A campanha dobra de tamanho, e o vídeo vira piada boa nas redes.'],
          },
        },
      },
      {
        title: 'O jogo de corrida quer o seu rosto',
        body: 'Um estúdio de videogame quer escanear o seu rosto e o seu capacete para o próximo jogo de corrida. O contrato de imagem paga bem e exige três dias de captura em outro país.',
        choices: {
          assinar: {
            label: 'Topar os três dias de captura',
            outcomes: ['Três dias com o corpo cheio de sensores rendem um bom dinheiro e um avatar idêntico a você. O treino daquela semana fica para trás.'],
          },
          'recusar-campanha': {
            label: 'Recusar e ceder só o desenho do capacete',
            outcomes: ['O capacete entra no jogo sem você. Sobra tempo para treinar, e o patrocinador lamenta a vitrine perdida.'],
          },
          carisma: {
            label: 'Topar e gravar também as falas do seu personagem',
            outcomes: ['As suas falas no jogo viram bordão entre os jogadores. O estúdio paga a mais, e o seu nome chega a quem nunca viu uma corrida.'],
          },
        },
      },
      {
        title: 'Uma grife quer você na passarela',
        body: 'Uma grife de roupas de luxo, sem nenhuma ligação com o automobilismo, oferece um contrato de imagem: desfiles, sessões de foto e uma festa de lançamento na semana de uma etapa.',
        choices: {
          assinar: {
            label: 'Aceitar o contrato e desfilar na festa',
            outcomes: ['As fotos ficam ótimas e o depósito chega rápido. A festa, na véspera da etapa, nem tanto.'],
          },
          'recusar-campanha': {
            label: 'Recusar e dizer que a sua passarela é o grid',
            outcomes: ['A frase arranca risadas no paddock. O dinheiro fica com outro atleta, e os patrocinadores torcem o nariz.'],
          },
          carisma: {
            label: 'Aceitar e conquistar a festa com o seu jeito',
            outcomes: ['Você desfila rindo de si e conquista até os estilistas. A sua imagem chega a revistas que nunca falaram de corrida.'],
          },
        },
      },
    ],
  },
  {
    id: 'imposto-no-exterior',
    category: 'money',
    frequency: 'normal',
    oncePerSeason: true,
    when: [{ c: 'tier', min: 7 }],
    choices: [
      {
        id: 'pagar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'contestar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'mudar-residencia',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'A carta da receita estrangeira',
        body: 'Um país que recebe três etapas do calendário cobra imposto sobre o que você ganhou correndo lá. A carta chega em outra língua, com prazo curto e uma multa já calculada.',
        choices: {
          pagar: {
            label: 'Pagar a conta e dormir em paz',
            outcomes: ['O dinheiro sai, a multa nem chega a nascer, e a carta vai para a gaveta com o carimbo de quitada.'],
          },
          contestar: {
            label: 'Contratar advogados locais e contestar a cobrança',
            outcomes: [
              'Os advogados acham um acordo entre os dois países, e boa parte do valor volta. Os meses de papelada, porém, cansam.',
              'A contestação perde, a multa cresce, e os jornais de lá publicam que você tentou fugir do imposto.',
            ],
          },
          'mudar-residencia': {
            label: 'Mudar a residência fiscal para um país mais barato',
            outcomes: ['A mudança economiza no imposto e afasta você de casa. O apartamento novo tem vista bonita e nenhum amigo por perto.'],
          },
        },
      },
      {
        title: 'Imposto por dia de trabalho',
        body: 'O contador descobre que alguns países do calendário cobram imposto por dia trabalhado lá, inclusive dias de teste e de evento de patrocinador. A lista de cobranças é longa.',
        choices: {
          pagar: {
            label: 'Pedir ao contador que pague tudo de uma vez',
            outcomes: ['O contador quita a lista inteira numa tarde. O saldo diminui, e a sua cabeça fica leve.'],
          },
          contestar: {
            label: 'Contestar os dias de evento, que não eram trabalho de pista',
            outcomes: [
              'O argumento convence: os dias de evento saem da conta. O processo, porém, consome semanas de e-mails.',
              'O argumento não convence, e os dias contestados voltam com juros e uma nota no jornal.',
            ],
          },
          'mudar-residencia': {
            label: 'Passar o inverno num país que não cobra nada',
            outcomes: ['O inverno fora de casa economiza imposto e custa saudade. Os almoços de domingo viram videochamadas.'],
          },
        },
      },
      {
        title: 'O contador liga de madrugada',
        body: 'Pelo fuso, é madrugada quando o contador liga: uma etapa da temporada passada gerou uma cobrança de imposto que ninguém tinha previsto. O prazo para responder termina esta semana.',
        choices: {
          pagar: {
            label: 'Autorizar o pagamento antes de voltar a dormir',
            outcomes: ['Você autoriza de pijama e volta para a cama. De manhã, o problema não existe mais, e aquele dinheiro também não.'],
          },
          contestar: {
            label: 'Mandar o contador brigar pela cobrança',
            outcomes: [
              'O contador encontra o erro no cálculo, e a cobrança cai pela metade. Você perde algumas noites de sono no caminho.',
              'A briga se arrasta, a cobrança cresce, e o caso vira nota numa revista de economia.',
            ],
          },
          'mudar-residencia': {
            label: 'Aproveitar e transferir a residência fiscal de vez',
            outcomes: ['A papelada da mudança resolve o imposto deste ano e dos próximos. A casa nova parece um hotel bonito e vazio.'],
          },
        },
      },
    ],
  },
  {
    id: 'maratona-de-voos-e-fusos',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'protocolo',
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
        id: 'na-raca',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [{ e: 'injury', severity: 'minor', length: 'short', description: 'Exaustão acumulada por voos longos e fusos seguidos' }],
          },
        ],
      },
      {
        id: 'corpo-de-ferro',
        requires: [{ c: 'trait', trait: 'ironBody' }],
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
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
        title: 'Três continentes em dez dias',
        body: 'O calendário empilhou duas etapas seguidas em continentes diferentes, com um evento de patrocinador no meio. São três voos longos, dois fusos e quase nenhuma noite inteira na mesma cama.',
        choices: {
          protocolo: {
            label: 'Seguir o protocolo de luz e sono do médico',
            outcomes: ['Óculos escuros no voo, sol no rosto ao chegar, cochilo cronometrado. É chato, mas o corpo chega no horário certo.'],
          },
          'na-raca': {
            label: 'Ignorar o fuso e emendar tudo na raça',
            outcomes: [
              'A adrenalina segura as pontas, e a maratona passa sem cobrar a conta.',
              'Na segunda etapa, o corpo apresenta a conta: dor de cabeça, enjoo e reflexo lento dentro do carro.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Confiar no corpo de ferro e treinar até no hotel',
            outcomes: [
              'O corpo nem percebe a troca de fuso. Você treina no quarto do hotel enquanto os outros dormem no saguão.',
              'O corpo aguenta, como sempre, mas a cabeça sente as noites curtas.',
            ],
          },
        },
      },
      {
        title: 'Doze horas de fuso em quatro dias',
        body: 'Entre a última etapa e a próxima há doze horas de diferença de fuso e só quatro dias de intervalo. O médico da {equipe} entrega um plano de sono detalhado, com horário até para o café.',
        choices: {
          protocolo: {
            label: 'Cumprir o plano de sono minuto a minuto',
            outcomes: ['O despertador toca em horas absurdas, mas na quinta-feira o corpo já vive no fuso novo.'],
          },
          'na-raca': {
            label: 'Dormir quando der e acordar quando quiser',
            outcomes: [
              'O corpo se acerta por conta própria, e você chega ao treino de bom humor.',
              'O corpo não se acerta, e você passa o treino bocejando dentro do capacete.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Pular o plano e treinar pesado no primeiro dia',
            outcomes: [
              'O treino pesado derruba você na hora certa, e o fuso some numa noite só.',
              'O treino pesado funciona para o corpo, mas a cabeça demora mais um dia para chegar.',
            ],
          },
        },
      },
      {
        title: 'Quinze voos longos em poucos meses',
        body: 'O preparador físico fez as contas: foram quinze voos longos nos últimos meses. O corpo dá sinais, como sono picado, apetite estranho e costas travadas depois de cada viagem.',
        choices: {
          protocolo: {
            label: 'Montar uma rotina de alongamento e sono para os voos',
            outcomes: ['Alongamento no corredor do avião, máscara nos olhos e nada de café depois do almoço. As viagens doem menos, e o tédio aumenta.'],
          },
          'na-raca': {
            label: 'Seguir como está e descansar só nas férias',
            outcomes: [
              'As férias estão perto, e o corpo aguenta até lá sem reclamar alto.',
              'O corpo reclama antes das férias: as costas travam na véspera da corrida.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Dobrar o treino físico para o corpo aguentar mais',
            outcomes: [
              'O treino dobrado deixa as viagens leves. O preparador se impressiona com a sua recuperação.',
              'O corpo responde bem ao treino, mas o sono picado continua roubando energia.',
            ],
          },
        },
      },
      {
        title: 'Carona no jatinho às duas da manhã',
        body: 'Um empresário amigo da {equipe} oferece carona no jatinho dele para a próxima etapa, desde que você participe de um jantar com clientes a bordo. O voo sai às duas da manhã.',
        choices: {
          protocolo: {
            label: 'Recusar a carona e seguir o plano de sono da equipe',
            outcomes: ['Você voa no horário do plano, dorme o que precisa e chega à pista no fuso certo. O jantar fica para outra vez.'],
          },
          'na-raca': {
            label: 'Aceitar a carona e o jantar a bordo',
            outcomes: [
              'O jantar é divertido e o voo, curto. Você cochila no carro até o hotel e acorda bem.',
              'O jantar se estende até o pouso. Você chega à pista sem ter fechado os olhos.',
            ],
          },
          'corpo-de-ferro': {
            label: 'Aceitar a carona e treinar assim que pousar',
            outcomes: [
              'Você janta, pousa e vai direto para a academia do hotel. O corpo nem sente a madrugada.',
              'O corpo aguenta a maratona, mas a cabeça pede silêncio o fim de semana inteiro.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'preparo-para-o-calor-tropical',
    category: 'health',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'chegar-antes',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'form', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
      {
        id: 'atalho',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [{ e: 'injury', severity: 'minor', length: 'short', description: 'Desidratação no calor úmido de uma etapa tropical' }],
          },
        ],
      },
      {
        id: 'condicionamento',
        requires: [{ c: 'aptitude', aptitude: 'physique', level: 'high' }],
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'form', size: 2 }] },
          {
            odds: 'rest',
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
        title: 'Umidade de sauna na próxima etapa',
        body: 'A próxima etapa é num país tropical, com trinta e cinco graus e umidade de banheiro depois do banho. Os médicos avisam que um piloto perde até três quilos numa corrida dessas.',
        choices: {
          'chegar-antes': {
            label: 'Viajar uma semana antes para o corpo se acostumar',
            outcomes: ['Uma semana de calor antes da corrida custa hotel e diária, mas no domingo o corpo trata o forno como casa.'],
          },
          atalho: {
            label: 'Treinar na sauna em casa e viajar em cima da hora',
            outcomes: [
              'A sauna faz o serviço: na corrida, o calor incomoda, mas não derruba.',
              'A sauna exagerada cobra no fim de semana: o corpo chega à pista já sem água, antes mesmo de entrar no carro.',
            ],
          },
          condicionamento: {
            label: 'Confiar no preparo físico e manter a rotina',
            outcomes: [
              'O corpo treinado nem estranha a umidade. Você termina a prova pedindo mais voltas.',
              'O físico aguenta o calor, mas a umidade rouba o seu fôlego nas entrevistas.',
            ],
          },
        },
      },
      {
        title: 'Asfalto a cinquenta graus na largada',
        body: 'Na etapa tropical, o asfalto passa dos cinquenta graus na hora da largada. A equipe instala um ar-condicionado portátil no box e pergunta como você quer se preparar.',
        choices: {
          'chegar-antes': {
            label: 'Pedir para chegar antes e treinar no calor local',
            outcomes: ['Você corre no calçadão da cidade ao meio-dia, sob olhares espantados. O corpo se acostuma, e a conta do hotel aumenta.'],
          },
          atalho: {
            label: 'Fazer o treino de calor em casa, com roupa térmica',
            outcomes: [
              'O treino em casa funciona: no domingo, o forno do cockpit parece só mais uma sessão.',
              'Você exagera na roupa térmica e passa mal na véspera da viagem. O corpo chega fraco à etapa.',
            ],
          },
          condicionamento: {
            label: 'Usar o seu fôlego de atleta para encarar o forno',
            outcomes: [
              'Enquanto o grid sofre, você mantém o ritmo até a última volta. Os médicos da categoria pedem os seus dados.',
              'Você aguenta o calor melhor que todos, mas termina a prova com cãibras nas pernas.',
            ],
          },
        },
      },
      {
        title: 'Chuva quente e sol de rachar',
        body: 'O fim de semana tropical alterna pancadas de chuva quente e sol de rachar. A umidade não baixa nunca. O preparador físico sugere um plano de hidratação que começa três dias antes.',
        choices: {
          'chegar-antes': {
            label: 'Seguir o plano desde o primeiro dia, no próprio país',
            outcomes: ['Três dias de garrafa na mão e banho gelado programado. A conta do hotel sobe, mas o corpo responde.'],
          },
          atalho: {
            label: 'Pular o plano e se hidratar só no dia da corrida',
            outcomes: [
              'Por sorte, a chuva refresca a corrida, e a hidratação de última hora basta.',
              'A chuva não vem, o sol racha o asfalto e a hidratação de última hora não basta. A cabeça gira na volta quarenta.',
            ],
          },
          condicionamento: {
            label: 'Apostar no seu condicionamento para aguentar a umidade',
            outcomes: [
              'O condicionamento faz a diferença: você termina a prova com a respiração em ordem e o ritmo intacto.',
              'O condicionamento segura o ritmo, mas a umidade cobra depois da corrida, com uma noite de dor de cabeça.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'vida-longe-de-casa',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'visitar',
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
        id: 'ficar',
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
      {
        id: 'trazer-casa',
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
    ],
    variants: [
      {
        title: 'O apartamento vazio perto da fábrica',
        body: 'A temporada no topo obriga você a morar perto da fábrica da {equipe}, num país onde o almoço sai às onze e escurece às quatro. O apartamento é bom. O silêncio, nem tanto.',
        choices: {
          visitar: {
            label: 'Pegar o voo para casa no intervalo entre etapas',
            outcomes: ['O almoço de domingo em {cidade} recarrega a bateria inteira. A volta, com fuso trocado, atrasa a semana de treinos.'],
          },
          ficar: {
            label: 'Ficar e passar o intervalo na fábrica',
            outcomes: ['Você vira figura fixa na fábrica, e os engenheiros adoram. À noite, o apartamento continua mudo.'],
          },
          'trazer-casa': {
            label: 'Pagar as passagens para a família visitar você',
            outcomes: ['O apartamento se enche de vozes por uma semana. O cartão de crédito sente, e você sorri o tempo todo.'],
          },
        },
      },
      {
        title: 'Saudade com gosto de feijão',
        body: 'No mercado perto do seu apartamento no exterior não há nada que lembre a comida de casa. Um mecânico brasileiro da {equipe} conta que a saudade aperta mais no segundo ano.',
        choices: {
          visitar: {
            label: 'Marcar uma ida rápida a {cidade} na próxima folga',
            outcomes: ['Dois dias em casa valem um mês de terapia. O cansaço da viagem vem junto na mala.'],
          },
          ficar: {
            label: 'Aprender a cozinhar e encarar a saudade no exterior',
            outcomes: ['O primeiro feijão sai empapado; o terceiro, razoável. Sobra tempo para a fábrica, e falta alguém para dividir a panela.'],
          },
          'trazer-casa': {
            label: 'Pagar o frete de uma caixa de comida de casa',
            outcomes: ['A caixa chega com doce de leite, farinha e um bilhete da família. O frete custou caro, e valeu cada grama.'],
          },
        },
      },
      {
        title: 'Aniversário pela tela do celular',
        body: 'É aniversário de alguém da família em {cidade}, e a festa vai ser no sábado da classificação. Você assiste a tudo pela tela do celular, num quarto de hotel do outro lado do mundo.',
        choices: {
          visitar: {
            label: 'Voar para casa logo depois da corrida',
            outcomes: ['Você chega um dia depois da festa, mas a família guarda bolo e abraço. O voo de volta pesa nas pernas.'],
          },
          ficar: {
            label: 'Mandar um áudio e voltar para a reunião técnica',
            outcomes: ['O áudio faz todo mundo chorar de rir na festa. Você volta para a reunião técnica com um nó na garganta.'],
          },
          'trazer-casa': {
            label: 'Comprar passagem para a família ver a próxima corrida',
            outcomes: ['A família inteira aparece no box na etapa seguinte, de camiseta da equipe. A conta é salgada; a foto, impagável.'],
          },
        },
      },
    ],
  },
  {
    id: 'amigos-de-infancia-na-tv',
    category: 'personal',
    frequency: 'normal',
    when: [{ c: 'tier', min: 6 }],
    choices: [
      {
        id: 'ligar',
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
        id: 'convidar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
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
    ],
    variants: [
      {
        title: 'O bar da esquina parou para ver você',
        body: 'Os amigos de infância mandam um vídeo: o bar da esquina em {cidade} lotado, todo mundo de olho na TV durante a sua última corrida. No fundo, alguém segura uma faixa escrita à mão.',
        choices: {
          ligar: {
            label: 'Fazer uma chamada de vídeo com o bar inteiro',
            outcomes: ['Você aparece no telão do bar, e o lugar vem abaixo. A noite de comemoração invade o sono antes do voo.'],
          },
          convidar: {
            label: 'Convidar a turma para assistir de perto na próxima etapa',
            outcomes: ['A turma chega de camiseta igual e grita mais que a arquibancada inteira. As passagens doem no bolso; as fotos rodam as redes.'],
          },
          foco: {
            label: 'Responder com um coração e voltar ao briefing',
            outcomes: ['O coração basta para a turma, que entende. Você volta ao briefing, mas a cabeça fica um pouco no bar.'],
          },
        },
      },
      {
        title: 'A turma da rua acordou de madrugada',
        body: 'Por causa do fuso, a sua última corrida passou às quatro da manhã no Brasil. Mesmo assim, os amigos da rua em {cidade} se juntaram numa garagem, com café e pão de queijo, para assistir.',
        choices: {
          ligar: {
            label: 'Ligar para a garagem assim que sair do carro',
            outcomes: ['A garagem atende aos gritos, de pijama e cara amassada. Você ri tanto que perde a hora da reunião com os engenheiros.'],
          },
          convidar: {
            label: 'Prometer à turma um fim de semana inteiro no paddock',
            outcomes: ['Na etapa seguinte, a turma ocupa o motorhome como se fosse a garagem. A conta fica com você, e a turma posta cada minuto.'],
          },
          foco: {
            label: 'Mandar um obrigado curto e dormir cedo',
            outcomes: ['O obrigado curto chega bem, mas um amigo comenta que você mudou. A frase fica na cabeça.'],
          },
        },
      },
      {
        title: 'O amigo que narra as suas corridas',
        body: 'Um amigo de infância começou a narrar as suas corridas numa transmissão caseira, para quem ficou em {cidade}. O canal já tem milhares de seguidores, e ele quer uma entrevista exclusiva.',
        choices: {
          ligar: {
            label: 'Dar a entrevista exclusiva para o canal do amigo',
            outcomes: ['A entrevista vira um papo de calçada, cheio de histórias da infância. O canal explode, e você dorme tarde de tanto rir.'],
          },
          convidar: {
            label: 'Credenciar o amigo para narrar de dentro do paddock',
            outcomes: ['Ele narra uma etapa inteira de dentro do paddock, emocionado do começo ao fim. A credencial custou caro; a audiência dele dobrou.'],
          },
          foco: {
            label: 'Pedir para deixar a entrevista para as férias',
            outcomes: ['O amigo entende, mas a decepção aparece na voz. O fim de semana rende, sem distração.'],
          },
        },
      },
    ],
  },
];
