/**
 * Eventos de dinheiro (Fase 5): dívidas, investimentos, patrocinador cobrando, golpes, aportes.
 * As propostas de patrocínio não estão aqui: saem dos perfis de `patrocinadores.ts`.
 *
 * Formato em `src/domain/storyEvents.ts`. Só palavras e chaves: tamanhos, chances e faixas têm nome
 * e os números estão em `src/config/balance.ts`. A primeira escolha de cada evento é a "natural"
 * (é a que o robô do simulador escolhe). Acrescente eventos no fim da lista.
 */
import type { StoryEventSpec } from '@/domain/storyEvents';

export const MONEY_EVENTS: readonly StoryEventSpec[] = [
  {
    id: 'aporte-extra',
    category: 'money',
    frequency: 'normal',
    oncePerSeason: true,
    when: [],
    needs: ['cashCall'],
    choices: [
      { id: 'pagar', outcomes: [{ odds: 'sure', effects: [{ e: 'payCashCall' }, { e: 'stat', stat: 'teamTrust', size: 2 }] }] },
      {
        id: 'recusar',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'teamTrust', size: -2 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: -2 },
              { e: 'car', size: -2 },
            ],
          },
        ],
      },
      { id: 'parcelar', outcomes: [{ odds: 'sure', effects: [{ e: 'splitCashCall' }] }] },
    ],
    variants: [
      {
        title: 'O patrocinador que sumiu da {equipe}',
        body: 'Um patrocinador da {equipe} parou de pagar no meio do ano. O chefe pede {valor} a você para manter as peças novas chegando até o fim da temporada.',
        choices: {
          pagar: { label: 'Pagar {valor} e manter o programa', outcomes: ['O dinheiro garante as atualizações, e a equipe fica devendo uma a você.'] },
          recusar: {
            label: 'Dizer que não tem de onde tirar',
            outcomes: [
              'A equipe aperta o cinto e segue como dá, mas o clima esfria.',
              'Sem dinheiro, as peças novas ficam na prateleira do fornecedor e o equipamento perde rendimento.',
            ],
          },
          parcelar: {
            label: 'Propor diluir o valor nas próximas parcelas da vaga',
            outcomes: ['A equipe topa: o aporte entra no contrato, um pouco por etapa.'],
          },
        },
      },
      {
        title: 'A conta das peças chegou antes',
        body: 'O fornecedor de motores da {equipe} antecipou a cobrança, e o caixa da equipe não fecha. Pedem {valor} a você como adiantamento.',
        choices: {
          pagar: {
            label: 'Transferir {valor} hoje mesmo',
            outcomes: ['O motor revisado chega a tempo, e o chefe faz questão de agradecer na frente de todos.'],
          },
          recusar: {
            label: 'Recusar e lembrar que o contrato não prevê isso',
            outcomes: [
              'O contrato está do seu lado, mas a boa vontade da equipe não.',
              'O motor revisado não vem, e você sente a diferença já na próxima reta.',
            ],
          },
          parcelar: {
            label: 'Aceitar que o valor entre no custo da vaga',
            outcomes: ['O valor vai para o contrato, e a conversa termina com um aperto de mão.'],
          },
        },
      },
    ],
  },
  {
    id: 'patrocinador-cobra',
    category: 'money',
    frequency: 'common',
    when: [],
    needs: ['unhappySponsor'],
    choices: [
      {
        id: 'prometer',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'acoes',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 3 },
              { e: 'stat', stat: 'form', size: -2 },
            ],
          },
        ],
      },
      {
        id: 'encerrar',
        outcomes: [
          {
            odds: 'sure',
            effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'morale', size: 1 }, { e: 'stat', stat: 'reputation', size: -1 }],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{patrocinador} quer explicações',
        body: 'Domingo à noite, liga o gerente de marketing do patrocinador {patrocinador}. Os resultados não vêm, o logo não aparece na TV e a diretoria fala em rescindir.',
        choices: {
          prometer: { label: 'Prometer uma reação nas próximas etapas', outcomes: ['Ele aceita esperar, mas deixa claro que é a última conversa amigável.'] },
          acoes: {
            label: 'Oferecer uma semana de gravações e visitas a clientes',
            outcomes: ['A agenda mata o seu descanso, mas a diretoria sai satisfeita das fotos.'],
          },
          encerrar: {
            label: 'Romper antes que o patrocinador rompa',
            outcomes: ['Você tira um peso das costas, e o paddock comenta que você pulou fora antes da demissão.'],
          },
        },
      },
      {
        title: 'Convocação às oito da manhã',
        body: '{patrocinador} convoca você para uma reunião na sede, logo cedo. Na mesa, um gráfico com a sua posição no campeonato e uma linha vermelha bem acima dela.',
        choices: {
          prometer: {
            label: 'Garantir que a linha do gráfico vai ser alcançada',
            outcomes: ['Os diretores anotam a promessa em ata. Agora é com você.'],
          },
          acoes: {
            label: 'Propor um dia inteiro de ações com os funcionários deles',
            outcomes: ['Você tira foto com o setor inteiro de logística e volta para casa sem voz.'],
          },
          encerrar: {
            label: 'Agradecer o apoio e propor um fim amigável',
            outcomes: ['A reunião termina antes do café, com apertos de mão educados e um contrato a menos.'],
          },
        },
      },
    ],
  },

  /* ---------------- Dívidas e aperto ---------------- */

  {
    id: 'cobranca-do-banco',
    category: 'money',
    frequency: 'common',
    oncePerSeason: true,
    when: [
      { c: 'has', what: 'debt' },
      { c: 'age', from: 'young' },
    ],
    choices: [
      {
        id: 'renegociar',
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
        id: 'familia',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'ignorar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'form', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O gerente do banco não para de ligar',
        body: 'Cinco chamadas perdidas antes do almoço, todas da agência. A conta da carreira está no vermelho, e o gerente quer uma conversa ainda nesta semana.',
        choices: {
          renegociar: {
            label: 'Sentar com o gerente e alongar a dívida',
            outcomes: ['A parcela cabe no bolso, mas a manhã inteira na agência rouba o treino do dia.'],
          },
          familia: {
            label: 'Pedir socorro em casa para cobrir o rombo',
            outcomes: ['A família dá um jeito e cobre parte do buraco. O silêncio no jantar diz o resto.'],
          },
          ignorar: {
            label: 'Deixar o celular no silencioso até a corrida',
            outcomes: [
              'O banco espera, e você corre com a cabeça só na pista.',
              'O gerente descobre o telefone da equipe e liga para lá. O chefe não gosta nada.',
            ],
          },
        },
      },
      {
        title: 'Carta registrada na caixa de correio',
        body: 'O envelope tem o carimbo do banco e a palavra “urgente” em vermelho. O saldo negativo da carreira virou assunto do departamento de cobrança.',
        choices: {
          renegociar: {
            label: 'Ligar para a cobrança e propor um acordo',
            outcomes: ['O acordo sai depois de uma tarde inteira de espera ao telefone. A dívida fica, mas agora tem prazo.'],
          },
          familia: {
            label: 'Mostrar a carta em casa e pedir ajuda',
            outcomes: ['Alguém da família faz uma transferência sem dizer nada. Ajuda, mas o orgulho sai arranhado.'],
          },
          ignorar: {
            label: 'Jogar o envelope na gaveta e ir treinar',
            outcomes: [
              'A gaveta segura o problema por mais um tempo, e o treino rende.',
              'A cobrança chega também ao escritório da {equipe}, e o assunto vira fofoca na oficina.',
            ],
          },
        },
      },
      {
        title: 'O cartão recusado na frente do mecânico',
        body: 'Na hora de pagar o almoço da equipe, a maquininha apita: cartão recusado. O mecânico finge que não viu. O banco bloqueou o limite por causa do saldo negativo.',
        choices: {
          renegociar: {
            label: 'Ir à agência e negociar o desbloqueio',
            outcomes: ['O limite volta, com parcelas pequenas. Você perde o treino da tarde, mas recupera o sono.'],
          },
          familia: {
            label: 'Ligar para casa antes que a notícia chegue lá',
            outcomes: ['A transferência cai no mesmo dia, junto com uma longa conversa sobre gastos.'],
          },
          ignorar: {
            label: 'Pagar com o dinheiro do bolso e esquecer o assunto',
            outcomes: [
              'Ninguém toca no assunto, e você foca no fim de semana.',
              'O mecânico comenta com outro, que comenta com o chefe. Ninguém quer dívida de piloto respingando na equipe.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'venda-de-emergencia',
    category: 'money',
    frequency: 'normal',
    when: [{ c: 'cash', atMost: 'tight' }],
    choices: [
      {
        id: 'vender',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'segurar',
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
    ],
    variants: [
      {
        title: 'O chassi velho encostado na garagem',
        body: 'O primeiro chassi que você pilotou pega poeira na garagem. Um pai do kartódromo quer comprar para o filho que está começando. As contas do mês não fecham sem algum dinheiro extra.',
        choices: {
          vender: {
            label: 'Vender o chassi para o menino que está começando',
            outcomes: ['O chassi vai embora numa caminhonete, com um aperto no peito. As contas do mês fecham.'],
          },
          segurar: {
            label: 'Guardar a lembrança e cortar os treinos extras',
            outcomes: ['O chassi fica na garagem. Você treina menos neste mês, mas olha para ele com carinho.'],
          },
        },
      },
      {
        title: 'O simulador da sala vale dinheiro',
        body: 'O volante, os pedais e o banco do simulador caseiro têm comprador certo num grupo de corrida virtual. O caixa está apertado, e a oferta é boa.',
        choices: {
          vender: {
            label: 'Desmontar o simulador e entregar ao comprador',
            outcomes: ['A sala fica vazia, e o caixa respira. As noites de corrida virtual ficam para depois.'],
          },
          segurar: {
            label: 'Manter o simulador e economizar em outra coisa',
            outcomes: ['Você corta os treinos pagos na pista e passa as noites no simulador. Não é a mesma coisa.'],
          },
        },
      },
      {
        title: 'O capacete autografado na estante',
        body: 'Na estante, o capacete que um campeão das antigas autografou para você na infância. Um colecionador oferece um bom dinheiro, e o caixa não chega ao fim do mês.',
        choices: {
          vender: {
            label: 'Aceitar a oferta do colecionador',
            outcomes: ['O capacete vai para a vitrine de um colecionador. O dinheiro paga o mês, e a estante fica com um buraco.'],
          },
          segurar: {
            label: 'Dizer que lembrança de infância não está à venda',
            outcomes: ['Você recusa a oferta e aperta o cinto: menos treino pago até a situação melhorar.'],
          },
        },
      },
    ],
  },

  /* ---------------- Investimentos ---------------- */

  {
    id: 'lava-rapido-do-amigo',
    category: 'money',
    frequency: 'normal',
    when: [
      { c: 'cash', atLeast: 'comfortable' },
      { c: 'age', from: 'young' },
      { c: 'noPerson', key: 'dinheiro-amigo-lava-rapido' },
    ],
    choices: [
      {
        id: 'entrar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              {
                e: 'meet',
                key: 'dinheiro-amigo-lava-rapido',
                from: 'stranger',
                role: 'amizade de infância',
                org: 'Lava-Rápido Espuma Azul',
                attitude: 2,
              },
              { e: 'flag', flag: 'dinheiro-socio-lava-rapido' },
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'morale', size: 1 },
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
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um lava-rápido em {cidade}',
        body: '{pessoa:dinheiro-amigo-lava-rapido}, da sua turma de infância em {cidade}, vai abrir um lava-rápido perto do kartódromo e procura quem entre na sociedade: uma parte pequena do negócio e o seu nome na fachada.',
        choices: {
          entrar: {
            label: 'Entrar na sociedade com uma parte pequena',
            outcomes: ['Vocês brindam com refrigerante no terreno ainda vazio. {primeiro:dinheiro-amigo-lava-rapido} promete mandar notícias todo mês.'],
          },
          recusar: {
            label: 'Explicar que todo dinheiro vai para a pista',
            outcomes: ['{primeiro:dinheiro-amigo-lava-rapido} entende, mas a conversa esfria. Pelo menos a sua cabeça segue inteira na próxima corrida.'],
          },
        },
      },
      {
        title: 'Proposta de sociedade por mensagem de voz',
        body: 'Uma mensagem de voz de sete minutos: {pessoa:dinheiro-amigo-lava-rapido}, que cresceu na sua rua, achou o ponto perfeito para um lava-rápido. Só falta alguém para entrar na sociedade e fechar o aluguel.',
        choices: {
          entrar: {
            label: 'Responder com um áudio ainda mais longo: estou dentro',
            outcomes: ['O contrato chega por e-mail no dia seguinte. O lava-rápido abre com uma bandeira quadriculada pintada na parede.'],
          },
          recusar: {
            label: 'Agradecer a lembrança e dizer que agora não dá',
            outcomes: ['A resposta demora a chegar e vem curta. A amizade fica arranhada, mas o foco no treino continua intacto.'],
          },
        },
      },
      {
        title: 'O plano de negócios no guardanapo',
        body: 'Num churrasco em {cidade}, {pessoa:dinheiro-amigo-lava-rapido} desenha num guardanapo o plano de um lava-rápido para carros de corrida e de rua. Falta pouco dinheiro, e a turma toda olha para você.',
        choices: {
          entrar: {
            label: 'Assinar o guardanapo e entrar no negócio',
            outcomes: ['O guardanapo vira contrato de verdade na semana seguinte. A turma comemora a sociedade até tarde.'],
          },
          recusar: {
            label: 'Dizer que churrasco não é lugar de fechar negócio',
            outcomes: ['A turma ri, {primeiro:dinheiro-amigo-lava-rapido} não. Você vai embora cedo e acorda com a cabeça no treino.'],
          },
        },
      },
    ],
  },
  {
    id: 'balanco-do-lava-rapido',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'flag', flag: 'dinheiro-socio-lava-rapido' }],
    needs: ['person:dinheiro-amigo-lava-rapido'],
    speaker: 'dinheiro-amigo-lava-rapido',
    choices: [
      {
        id: 'manter',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'attitude', key: 'dinheiro-amigo-lava-rapido', size: 1 },
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
        id: 'vender',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'flag', flag: 'dinheiro-socio-lava-rapido', clear: true },
              { e: 'attitude', key: 'dinheiro-amigo-lava-rapido', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O primeiro balanço do lava-rápido',
        body: '{primeiro:dinheiro-amigo-lava-rapido} manda as contas do {org:dinheiro-amigo-lava-rapido}: fila na porta aos sábados, mas a máquina de alta pressão vive quebrando. Quer saber se você continua na sociedade.',
        choices: {
          manter: {
            label: 'Continuar na sociedade e confiar no negócio',
            outcomes: [
              'A máquina nova chega, a fila cresce e a sua parte do lucro cai na conta.',
              'A máquina quebra de novo, e a sua parte vai para o conserto em vez de voltar para você.',
            ],
          },
          vender: {
            label: 'Vender a sua parte de volta para {primeiro:dinheiro-amigo-lava-rapido}',
            outcomes: ['O pagamento sai à vista, mas a despedida da sociedade fica meio sem graça.'],
          },
        },
      },
      {
        title: 'Notícias do {org:dinheiro-amigo-lava-rapido}',
        body: 'Chega uma foto: o lava-rápido lotado de carros de passeio, com um kart de aluguel no meio, de enfeite. {primeiro:dinheiro-amigo-lava-rapido} pergunta se você topa reinvestir a sua parte numa segunda unidade.',
        choices: {
          manter: {
            label: 'Topar a segunda unidade e deixar o dinheiro trabalhando',
            outcomes: [
              'A segunda unidade abre com fila, e o primeiro lucro de verdade aparece no extrato.',
              'A segunda unidade demora a pegar, e a sua parte some no aluguel do ponto novo.',
            ],
          },
          vender: {
            label: 'Pedir para sair do negócio enquanto ele vai bem',
            outcomes: ['{primeiro:dinheiro-amigo-lava-rapido} compra a sua parte e deseja sorte nas pistas. Negócio é negócio.'],
          },
        },
      },
    ],
  },
  {
    id: 'aplicacao-arriscada',
    category: 'money',
    frequency: 'normal',
    when: [
      { c: 'cash', atLeast: 'comfortable' },
      { c: 'age', from: 'young' },
    ],
    choices: [
      {
        id: 'pouco',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'cash', size: 1 }] },
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
        id: 'tudo',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'cash', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'morale', size: -2 },
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
              { e: 'stat', stat: 'morale', size: 1 },
              { e: 'stat', stat: 'confidence', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O gerente de investimentos tem uma dica',
        body: 'O gerente do banco liga animado: um fundo novo, ligado a empresas de tecnologia, promete render muito acima da poupança. O risco, ele admite baixinho, também é alto.',
        choices: {
          pouco: {
            label: 'Aplicar só uma parte pequena do caixa',
            outcomes: [
              'O fundo sobe por três meses seguidos, e o pouco que você pôs rende um extra bem-vindo.',
              'O fundo despenca na primeira crise, e a parte pequena encolhe ainda mais.',
            ],
          },
          tudo: {
            label: 'Colocar uma boa fatia e torcer pelo melhor',
            outcomes: [
              'A aposta acerta em cheio. Você confere o extrato duas vezes para acreditar.',
              'O fundo derrete em semanas. A fatia que você pôs vira uma lição cara.',
            ],
          },
          recusar: {
            label: 'Agradecer e deixar tudo na poupança',
            outcomes: ['O dinheiro segue parado e seguro. De vez em quando bate a curiosidade de saber quanto teria rendido.'],
          },
        },
      },
      {
        title: 'Ações de uma fábrica de borracha do interior',
        body: 'Um mecânico da {equipe} jura que uma pequena fábrica de borracha do interior vai fechar um contrato grande e que as ações vão disparar. Ele já comprou. Você pode entrar também.',
        choices: {
          pouco: {
            label: 'Comprar umas poucas ações para acompanhar',
            outcomes: [
              'O contrato sai e as ações sobem. O mecânico ganha fama de vidente na oficina.',
              'O contrato não sai, e as ações caem até o mecânico parar de falar no assunto.',
            ],
          },
          tudo: {
            label: 'Seguir o palpite do mecânico com força',
            outcomes: [
              'As ações disparam como prometido. Você paga a pizza da equipe na sexta-feira.',
              'As ações afundam junto com a fábrica. O mecânico evita o seu olhar por semanas.',
            ],
          },
          recusar: {
            label: 'Dizer que prefere investir só no próprio acerto',
            outcomes: ['O mecânico dá de ombros e volta para o motor. Você fica com a dúvida e com o dinheiro.'],
          },
        },
      },
      {
        title: 'Moeda digital no grupo da família',
        body: 'Um primo manda no grupo da família o gráfico de uma moeda digital que só sobe. Todo mundo está comprando, garante ele, e quem ficar de fora vai se arrepender.',
        choices: {
          pouco: {
            label: 'Comprar um pouquinho, só para não ficar de fora',
            outcomes: [
              'A moeda sobe mais um pouco, e você vende no topo sem saber que era o topo.',
              'A moeda despenca numa madrugada, e o pouquinho vira quase nada.',
            ],
          },
          tudo: {
            label: 'Entrar pesado antes que fique caro demais',
            outcomes: [
              'A moeda dispara, e você sai a tempo. O primo pede para contar a história no Natal.',
              'A moeda some do mapa numa semana. O grupo da família fica em silêncio.',
            ],
          },
          recusar: {
            label: 'Silenciar o grupo e seguir a vida',
            outcomes: ['O grupo ferve sem você. Às vezes bate a dúvida, mas o celular fica em paz.'],
          },
        },
      },
    ],
  },
  {
    id: 'sala-comercial-a-venda',
    category: 'money',
    frequency: 'normal',
    when: [
      { c: 'cash', atLeast: 'rich' },
      { c: 'age', from: 'young' },
      { c: 'noFlag', flag: 'dinheiro-imovel-alugado' },
    ],
    choices: [
      {
        id: 'comprar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'flag', flag: 'dinheiro-imovel-alugado' },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'treino',
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
        title: 'Uma sala comercial perto do autódromo',
        body: 'Um corretor oferece uma sala comercial a duas quadras do autódromo, já com inquilino interessado. É dinheiro parado virando aluguel todo mês, diz ele.',
        choices: {
          comprar: {
            label: 'Comprar a sala e alugar para o interessado',
            outcomes: ['A escritura fica pronta em um mês. O caixa encolhe, e a primeira chave de imóvel da sua vida pesa no bolso.'],
          },
          treino: {
            label: 'Gastar o dinheiro em horas de simulador profissional',
            outcomes: ['Em vez de tijolo, voltas virtuais: o simulador profissional cobra caro e devolve em ritmo.'],
          },
        },
      },
      {
        title: 'O imóvel que o chefe da equipe indicou',
        body: 'O chefe da {equipe} conta, entre um café e outro, que um prédio novo vai vender salas perto da sede, e jura que quem compra na planta aluga fácil depois.',
        choices: {
          comprar: {
            label: 'Fechar a compra de uma sala na planta',
            outcomes: ['Você assina o contrato no estande de vendas. O corretor promete inquilino antes da entrega.'],
          },
          treino: {
            label: 'Investir em preparador físico e simulador em vez disso',
            outcomes: ['O dinheiro vai para o preparador e o simulador. Nada de aluguel, mas o corpo e o ritmo agradecem.'],
          },
        },
      },
      {
        title: 'Leilão de imóveis em {cidade}',
        body: 'Um advogado conhecido da família avisa de um leilão em {cidade}: uma loja de esquina com preço abaixo do mercado. É preciso decidir até sexta.',
        choices: {
          comprar: {
            label: 'Dar o lance e arrematar a loja',
            outcomes: ['O martelo bate a seu favor. A loja ganha uma placa de aluga-se no mesmo dia.'],
          },
          treino: {
            label: 'Deixar o leilão para lá e pagar mais treino',
            outcomes: ['Outro lance leva a loja. O seu dinheiro vira sessões extras de simulador, e o ritmo melhora.'],
          },
        },
      },
    ],
  },
  {
    id: 'inquilino-da-sala-comercial',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'flag', flag: 'dinheiro-imovel-alugado' }],
    choices: [
      {
        id: 'paciencia',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'cash', size: 1 }] },
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
        id: 'vender',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'flag', flag: 'dinheiro-imovel-alugado', clear: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O aluguel do imóvel não caiu na conta',
        body: 'Este mês, o extrato chega sem o depósito do aluguel. Quem alugou pede mais um mês de prazo e jura que o movimento vai voltar.',
        choices: {
          paciencia: {
            label: 'Dar o prazo e manter o contrato',
            outcomes: [
              'O movimento volta, e o aluguel atrasado chega junto com o do mês.',
              'O prazo vira calote. O imóvel fica vazio e ainda pede uma pintura antes do próximo inquilino.',
            ],
          },
          vender: {
            label: 'Vender o imóvel e acabar com a dor de cabeça',
            outcomes: ['Um vizinho compra o imóvel com desconto. Menos um patrimônio, menos uma preocupação.'],
          },
        },
      },
      {
        title: 'Infiltração no imóvel alugado',
        body: 'O síndico liga: o vazamento do andar de cima chegou ao seu imóvel, e quem aluga ameaça sair. O encanador garante que um conserto rápido resolve. Ninguém confia em conserto rápido.',
        choices: {
          paciencia: {
            label: 'Resolver o vazamento e segurar o inquilino',
            outcomes: [
              'O conserto sai barato, o inquilino renova e o aluguel ainda vem com reajuste.',
              'O vazamento volta na primeira chuva forte, e o segundo conserto sai bem mais caro.',
            ],
          },
          vender: {
            label: 'Vender o imóvel do jeito que está',
            outcomes: ['Um comprador de imóveis com defeito leva tudo, infiltração inclusa. O dinheiro volta, com desconto.'],
          },
        },
      },
    ],
  },

  /* ---------------- Golpes ---------------- */

  {
    id: 'clube-de-investimento-milagroso',
    category: 'money',
    frequency: 'normal',
    when: [
      { c: 'cash', atLeast: 'tight' },
      { c: 'age', from: 'young' },
      { c: 'noFlag', flag: 'dinheiro-entrou-na-piramide' },
    ],
    choices: [
      {
        id: 'recusar',
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
        id: 'entrar',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'flag', flag: 'dinheiro-entrou-na-piramide' },
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
        id: 'contas',
        requires: [{ c: 'aptitude', aptitude: 'intelligence', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'reputation', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O clube de investimento do paddock',
        body: 'O pai de um piloto do grid vive de bermuda e relógio de ouro. Ele chama você para um “clube de investimento”: rendimento garantido todo mês, desde que você traga mais gente.',
        choices: {
          recusar: {
            label: 'Recusar e avisar os outros pilotos da conversa',
            outcomes: ['O homem do relógio de ouro deixa de cumprimentar você. Em compensação, metade do paddock agradece o aviso.'],
          },
          entrar: {
            label: 'Entrar com pouco, só para ver se é verdade',
            outcomes: [
              'O primeiro rendimento cai certinho na conta. Parece bom demais para ser verdade.',
              'O aplicativo do clube sai do ar na semana seguinte, levando junto o que você pôs.',
            ],
          },
          contas: {
            label: 'Fazer as contas e mostrar que a pirâmide não fecha',
            outcomes: ['A conta no guardanapo cala a roda inteira. Quem estava quase entrando agradece a você no fim do dia.'],
          },
        },
      },
      {
        title: 'Rendimento garantido, diz o vídeo',
        body: 'Um mecânico de outra equipe mostra no celular o vídeo de um rapaz numa lancha: entre no grupo, indique amigos e ganhe todo mês. Ele já está dentro e jura que paga.',
        choices: {
          recusar: {
            label: 'Dizer que lancha de vídeo não paga conta de ninguém',
            outcomes: ['O mecânico se ofende e passa a evitar você. Mas a frase corre, e mais de um colega desiste de entrar.'],
          },
          entrar: {
            label: 'Pagar a entrada mínima e ver no que dá',
            outcomes: [
              'O grupo paga o primeiro mês com festa e figurinha. Você começa a acreditar.',
              'O grupo é apagado do aplicativo no dia seguinte ao seu pagamento.',
            ],
          },
          contas: {
            label: 'Calcular quantos novatos o esquema precisa por mês',
            outcomes: ['A conta mostra que, em um ano, o país inteiro teria de entrar. O mecânico sai do grupo na mesma hora.'],
          },
        },
      },
      {
        title: 'A palestra no salão do hotel',
        body: 'Num hotel perto de {pista}, um palestrante de terno brilhante promete liberdade financeira para atletas. A entrada no “programa” é barata, e quem entra primeiro ganha mais.',
        choices: {
          recusar: {
            label: 'Sair no intervalo e contar tudo no grupo dos pilotos',
            outcomes: ['Um assistente do palestrante segue você até o estacionamento, com cara feia. No grupo dos pilotos, o alerta salva mais de um bolso.'],
          },
          entrar: {
            label: 'Assinar a ficha de entrada no fim da palestra',
            outcomes: [
              'O primeiro bônus chega no prazo, e o palestrante cita o seu nome no vídeo seguinte.',
              'O “programa” troca de nome uma semana depois e para de responder às mensagens.',
            ],
          },
          contas: {
            label: 'Perguntar em voz alta de onde sai o rendimento',
            outcomes: ['O palestrante gagueja, metade da plateia levanta junto com você, e a história chega à imprensa como exemplo.'],
          },
        },
      },
    ],
  },
  {
    id: 'piramide-desmorona',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'flag', flag: 'dinheiro-entrou-na-piramide' }],
    choices: [
      {
        id: 'denunciar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'reputation', size: 1 },
              { e: 'flag', flag: 'dinheiro-entrou-na-piramide', clear: true },
            ],
          },
        ],
      },
      {
        id: 'sacar',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'cash', size: 1 },
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'flag', flag: 'dinheiro-entrou-na-piramide', clear: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'morale', size: -1 },
              { e: 'flag', flag: 'dinheiro-entrou-na-piramide', clear: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O rendimento deste mês não veio',
        body: 'O rendimento do esquema não caiu, o organizador sumiu das mensagens e o grupo virou um muro de reclamações. Ainda dá para tentar resgatar alguma coisa.',
        choices: {
          denunciar: {
            label: 'Juntar as outras vítimas e registrar queixa na delegacia',
            outcomes: ['O dinheiro não volta, mas o seu depoimento ajuda a polícia. O paddock vê quem enfrentou o golpe de frente.'],
          },
          sacar: {
            label: 'Correr para sacar antes de todo mundo',
            outcomes: [
              'Você resgata uma parte antes de o aplicativo sair do ar. Os outros não perdoam a pressa.',
              'O pedido de saque fica “em análise” para sempre, junto com o resto do dinheiro.',
            ],
          },
        },
      },
      {
        title: 'Polícia na porta do esquema',
        body: 'O telejornal mostra a polícia na sede do esquema em que você entrou. Os organizadores fugiram, e um advogado já monta uma lista de vítimas.',
        choices: {
          denunciar: {
            label: 'Entrar na lista de vítimas e dar entrevista',
            outcomes: ['O dinheiro fica preso no processo por anos. A sua entrevista sincera, porém, rende respeito com o público.'],
          },
          sacar: {
            label: 'Ligar para um organizador que ainda atende',
            outcomes: [
              'Alguém atende e devolve uma parte, desde que você não conte nada. Você não conta, mas o assunto vaza.',
              'O número que atendia também é desligado. O que você pôs no esquema não volta.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'empresario-de-fachada',
    category: 'money',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'checar',
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
        id: 'pagar',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'expor',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'reputation', size: 2 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O empresário que promete patrocínio grande',
        body: 'Terno caro, cartão dourado e uma lista de marcas “amigas”. O homem garante um patrocínio enorme ainda nesta temporada. Só pede, antes, uma taxa de cadastro.',
        choices: {
          checar: {
            label: 'Pedir contrato, referências e nenhum pagamento adiantado',
            outcomes: ['O empresário some antes de mandar qualquer papel. Nada de patrocínio, mas fica a fama de quem não cai em conversa.'],
          },
          pagar: {
            label: 'Pagar a taxa de cadastro e esperar o contrato',
            outcomes: [
              'O patrocínio enorme nunca vem, mas o homem ao menos apresenta você a uns lojistas. A taxa vira um cartão de visitas caro.',
              'O número do empresário deixa de existir no dia seguinte ao pagamento. O cartão dourado vai para o lixo.',
            ],
          },
          expor: {
            label: 'Postar o cartão dele com um alerta para outros pilotos',
            outcomes: [
              'O post corre o paddock, e outros pilotos contam que receberam a mesma proposta. Você vira referência no assunto.',
              'O empresário manda uma notificação de advogado, e você precisa pagar outro advogado para responder.',
            ],
          },
        },
      },
      {
        title: 'Agente com contatos no mundo inteiro',
        body: 'Um agente de sotaque carregado diz ter levado vários brasileiros às equipes mais fortes do mundo. Para pôr você na carteira, cobra só uma taxa de avaliação. Nenhum dos nomes que ele cita aparece numa busca.',
        choices: {
          checar: {
            label: 'Pedir o contato de um piloto que ele agenciou',
            outcomes: ['O contato prometido nunca chega. A esperança murcha, mas a sua história vira um alerta útil no paddock.'],
          },
          pagar: {
            label: 'Pagar a avaliação e mandar o currículo',
            outcomes: [
              'A avaliação vira um vídeo genérico com o seu nome. Pelo menos dois olheiros de verdade acabam vendo.',
              'A taxa some junto com o agente, o sotaque e a página na internet.',
            ],
          },
          expor: {
            label: 'Denunciar o agente no grupo de pais e pilotos',
            outcomes: [
              'A denúncia junta outras vítimas, e o agente desaparece do mapa. O seu nome sai como o de quem teve coragem.',
              'O agente revida com ameaça de processo, e o advogado para responder sai do seu bolso.',
            ],
          },
        },
      },
      {
        title: 'Uma reunião num escritório alugado por hora',
        body: 'O escritório é bonito demais e vazio demais. O homem atrás da mesa promete um teste numa equipe grande, desde que você deposite hoje a “reserva” da vaga.',
        choices: {
          checar: {
            label: 'Levantar e pedir tudo por escrito antes de depositar',
            outcomes: ['A recepcionista conta que a sala é alugada por hora. A vaga não existe, e a história rende risadas e respeito no paddock.'],
          },
          pagar: {
            label: 'Depositar a reserva para não perder a chance',
            outcomes: [
              'O teste existe, mas é uma tarde num kartódromo de aluguel. Serve para tirar foto, não muito mais.',
              'O depósito é a última coisa que você vê daquele escritório. Na semana seguinte, a sala está para alugar.',
            ],
          },
          expor: {
            label: 'Gravar a conversa e levar para a imprensa',
            outcomes: [
              'A reportagem sai com o seu áudio, e o golpista vira notícia. O paddock aplaude a coragem.',
              'A gravação não prova muita coisa, e rebater a resposta do advogado dele custa caro.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'transferencia-urgente-falsa',
    category: 'money',
    frequency: 'normal',
    when: [{ c: 'cash', atLeast: 'tight' }],
    choices: [
      {
        id: 'confirmar',
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
        id: 'transferir',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'stat', stat: 'teamTrust', size: 2 },
              { e: 'cash', size: -1, cap: true },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Pedido urgente com a foto do mecânico',
        body: 'Um número desconhecido, com a foto do chefe dos mecânicos, pede uma transferência na hora: o fornecedor só libera os pneus da corrida com pagamento hoje. A mensagem tem erros de digitação.',
        choices: {
          confirmar: {
            label: 'Ligar para o chefe dos mecânicos antes de pagar',
            outcomes: ['Ele nunca trocou de número. O susto passa, e a equipe gosta de saber que você desconfiou.'],
          },
          transferir: {
            label: 'Transferir logo para não atrasar a equipe',
            outcomes: [
              'Era ele mesmo, com o celular novo. Os pneus chegam a tempo, e a equipe agradece a rapidez.',
              'O número some depois da transferência. O chefe dos mecânicos nunca pediu nada.',
            ],
          },
        },
      },
      {
        title: 'O assessor pede o dinheiro do hotel',
        body: 'Uma mensagem com o nome do assessor da {equipe} pede que você pague o hotel da etapa direto numa conta nova: a reserva cai em uma hora. O tom é estranhamente formal.',
        choices: {
          confirmar: {
            label: 'Mandar um áudio ao assessor e esperar a resposta',
            outcomes: ['A resposta vem em letras maiúsculas: golpe. A equipe espalha o alerta e elogia o seu cuidado.'],
          },
          transferir: {
            label: 'Pagar a reserva para não dormir na rua',
            outcomes: [
              'A conta nova era mesmo do hotel. O assessor agradece por você ter adiantado.',
              'A reserva nunca existiu. O assessor só descobre tudo quando você chega ao hotel pedindo a chave.',
            ],
          },
        },
      },
      {
        title: 'O fornecedor mudou de conta, diz o boleto',
        body: 'Chega por e-mail um boleto do fornecedor de peças da {equipe}, com uma conta nova e desconto para pagamento hoje. O logotipo está um pouco torto.',
        choices: {
          confirmar: {
            label: 'Encaminhar o boleto para o financeiro da equipe',
            outcomes: ['O financeiro confirma a fraude em minutos. O frio na barriga demora a passar, mas a equipe agradece o aviso.'],
          },
          transferir: {
            label: 'Pagar o boleto e garantir o desconto',
            outcomes: [
              'O fornecedor tinha mesmo trocado de banco. A peça chega antes, e o financeiro anota a sua boa vontade.',
              'O dinheiro cai numa conta fantasma. O fornecedor de verdade ainda cobra a peça na semana seguinte.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'chassi-usado-barato',
    category: 'money',
    frequency: 'normal',
    when: [
      { c: 'tier', max: 3 },
      { c: 'cash', atLeast: 'tight' },
    ],
    choices: [
      {
        id: 'ver',
        outcomes: [
          {
            odds: 'likely',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'sinal',
        outcomes: [
          {
            odds: 'unlikely',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'form', size: 2 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'cash', size: -2, cap: true },
              { e: 'stat', stat: 'morale', size: -2 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Um chassi quase novo, barato demais',
        body: 'Num grupo de vendas, um chassi de ponta da temporada passada aparece por preço de chassi velho. O vendedor mora longe, tem pressa e pede um sinal para segurar a peça.',
        choices: {
          ver: {
            label: 'Viajar para ver o chassi antes de pagar',
            outcomes: [
              'O chassi existe e está inteiro. Você negocia no próprio galpão e volta com ele na carroceria.',
              'O endereço é um terreno baldio. A viagem custa um dia de treino e muita raiva.',
            ],
          },
          sinal: {
            label: 'Mandar o sinal para garantir o negócio',
            outcomes: [
              'O chassi chega bem embalado e melhor do que nas fotos. A sorte existe.',
              'O vendedor bloqueia o seu número assim que o sinal cai. O chassi nunca existiu.',
            ],
          },
        },
      },
      {
        title: 'Motor de kart com garantia de fábrica',
        body: 'Um anúncio oferece um motor lacrado, com nota e garantia, bem abaixo do preço da loja. O vendedor diz que ganhou num sorteio e precisa de dinheiro rápido.',
        choices: {
          ver: {
            label: 'Marcar de ver o motor no kartódromo',
            outcomes: [
              'O motor é de verdade, só um pouco mais rodado do que o anúncio dizia. Você fecha com desconto.',
              'O vendedor não aparece no kartódromo e apaga o anúncio. A tarde de treino foi perdida.',
            ],
          },
          sinal: {
            label: 'Pagar metade adiantado, como o vendedor pede',
            outcomes: [
              'O motor chega lacrado, com nota e tudo. A desconfiança fica, mas ele empurra forte.',
              'O lacre era adesivo de papelaria, e o motor, uma carcaça vazia. O vendedor sumiu.',
            ],
          },
        },
      },
      {
        title: 'Jogo de pneus de chuva em liquidação',
        body: 'Um perfil novo nas redes vende pneus de chuva do fornecedor oficial do campeonato por um preço de liquidação. As fotos parecem tiradas de um catálogo.',
        choices: {
          ver: {
            label: 'Pedir para buscar os pneus pessoalmente',
            outcomes: [
              'Os pneus existem, guardados num depósito. Estão bons, e o preço cobre a viagem.',
              'O vendedor inventa desculpa atrás de desculpa e some. O dia de treino vai embora no trânsito.',
            ],
          },
          sinal: {
            label: 'Pagar pelo aplicativo e esperar a entrega',
            outcomes: [
              'Os pneus chegam na véspera da etapa, novinhos. Desta vez, a liquidação era de verdade.',
              'A entrega nunca sai do status “em separação”. O perfil desaparece das redes.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Patrocinador cobrando ---------------- */

  {
    id: 'notificacao-do-patrocinador',
    category: 'money',
    frequency: 'common',
    when: [],
    needs: ['unhappySponsor'],
    choices: [
      {
        id: 'cumprir',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
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
              { e: 'sponsorMood', who: 'bound', size: -1 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [{ e: 'dropSponsor' }, { e: 'cash', size: -1, cap: true }],
          },
        ],
      },
      {
        id: 'distrato',
        outcomes: [{ odds: 'sure', effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'morale', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: 'Notificação extrajudicial do patrocinador',
        body: 'O jurídico do patrocinador {patrocinador} manda uma notificação de quatro páginas: cláusulas de exposição descumpridas, logo pequeno demais no macacão e um prazo curto para corrigir tudo.',
        choices: {
          cumprir: {
            label: 'Cumprir cada item da notificação, por menor que seja',
            outcomes: ['Macacão novo, logo maior, relatório semanal. O jurídico arquiva o caso, e os treinos perdem espaço na agenda.'],
          },
          contestar: {
            label: 'Responder com um advogado, cláusula por cláusula',
            outcomes: [
              'O advogado acha furos na notificação. O patrocínio continua, num clima de geladeira.',
              'A briga jurídica termina em rescisão, e a conta do advogado chega antes do último pagamento.',
            ],
          },
          distrato: {
            label: 'Propor um distrato amigável e virar a página',
            outcomes: ['Duas assinaturas e um aperto de mão frio. Sem o peso da cobrança, você volta a dormir bem.'],
          },
        },
      },
      {
        title: 'Um e-mail cheio de cláusulas em negrito',
        body: '{patrocinador} manda um e-mail com cópia para três advogados. Cita a cláusula de desempenho, a de imagem e a de exclusividade, sempre em negrito, e termina pedindo “providências imediatas”.',
        choices: {
          cumprir: {
            label: 'Responder com um plano de providências, item por item',
            outcomes: ['O plano agrada aos advogados. A diretoria segura o contrato, e você passa as noites preenchendo relatórios.'],
          },
          contestar: {
            label: 'Devolver o contrato com as cláusulas que eles descumpriram',
            outcomes: [
              'O recado funciona: eles recuam, mas a relação fica gelada.',
              'A resposta ofende a diretoria, que rompe o contrato. O seu advogado ainda cobra pela troca de e-mails.',
            ],
          },
          distrato: {
            label: 'Responder que aceita encerrar o contrato',
            outcomes: ['O distrato chega assinado na mesma tarde. A caixa de entrada fica mais leve, e a sua cabeça também.'],
          },
        },
      },
      {
        title: 'Reunião com o jurídico do patrocinador',
        body: 'Na sala de reuniões do patrocinador {patrocinador}, não há ninguém do marketing, só duas advogadas e um advogado com o contrato marcado em amarelo. O assunto é a meta de resultados, que ficou para trás.',
        choices: {
          cumprir: {
            label: 'Assinar um aditivo com novas obrigações de imagem',
            outcomes: ['O aditivo salva o contrato e enche a agenda de gravações nas semanas de corrida.'],
          },
          contestar: {
            label: 'Pedir tempo e levar o contrato ao seu advogado',
            outcomes: [
              'O seu advogado encontra uma brecha. O contrato fica, mas ninguém mais sorri nas reuniões.',
              'Enquanto o seu advogado estuda o caso, {patrocinador} rescinde. A consulta ainda precisa ser paga.',
            ],
          },
          distrato: {
            label: 'Encerrar a reunião propondo o fim do contrato',
            outcomes: ['Os advogados guardam as canetas com cara de alívio. Ninguém precisa brigar, e o peso sai das suas costas.'],
          },
        },
      },
    ],
  },
  {
    id: 'dono-do-patrocinador-explode',
    category: 'money',
    frequency: 'common',
    when: [],
    needs: ['unhappySponsor'],
    choices: [
      {
        id: 'acalmar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'encerrar',
        outcomes: [{ odds: 'sure', effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'confidence', size: 1 }] }],
      },
      {
        id: 'gritar',
        requires: [{ c: 'trait', trait: 'hothead' }],
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'confidence', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'reputation', size: -1 }],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{patrocinador}: o dono liga de madrugada',
        body: 'Uma da manhã, o celular toca. É o dono da empresa que patrocina você, falando alto e com barulho de bar ao fundo: quer saber para que serve o dinheiro dele e ameaça tirar tudo amanhã cedo.',
        choices: {
          acalmar: {
            label: 'Ouvir tudo e convidar para um almoço na semana',
            outcomes: ['No almoço, ele pede sobremesa e esquece a ameaça. Você perdeu a noite de sono, mas o contrato fica.'],
          },
          encerrar: {
            label: 'Dizer que ele pode tirar o dinheiro, então',
            outcomes: ['Ele desliga sem responder, e o pagamento seguinte não vem. Dói, mas o telefone deixa de dar medo.'],
          },
          gritar: {
            label: 'Subir o tom e responder no mesmo volume dele',
            outcomes: [
              'Do outro lado, um silêncio e uma gargalhada: ele gosta de gente de sangue quente. O contrato segue.',
              'Ele desliga e manda cancelar tudo de manhã. No dia seguinte, a gritaria já circula no paddock.',
            ],
          },
        },
      },
      {
        title: '{patrocinador}: o dono invade o treino',
        body: 'Sem credencial e sem aviso, o dono da empresa aparece na área da equipe na hora do treino e cobra resultados na frente dos mecânicos. Ele investiu, diz, e quer ver o retorno agora.',
        choices: {
          acalmar: {
            label: 'Levar o homem para um canto e explicar o plano',
            outcomes: ['Com um café na mão, ele se acalma e até pede foto. Você volta à pista com a cabeça quente.'],
          },
          encerrar: {
            label: 'Pedir que ele se retire e procure outro piloto',
            outcomes: ['Ele sai pisando duro e cumpre a promessa: o adesivo sai do macacão na mesma semana. Os mecânicos aplaudem baixinho.'],
          },
          gritar: {
            label: 'Encarar o homem e devolver a bronca em público',
            outcomes: [
              'Ele recua, pede desculpas e dobra a aposta em você. Os mecânicos não acreditam.',
              'A discussão termina com o contrato rasgado em cima da bancada e um vídeo que roda o paddock.',
            ],
          },
        },
      },
      {
        title: '{patrocinador}: áudios em sequência',
        body: 'Seis áudios seguidos do dono da empresa, cada um mais alto que o outro. No último, ele promete trocar você por um piloto mais jovem e mais barato até o fim do mês.',
        choices: {
          acalmar: {
            label: 'Responder com calma e convidar para a próxima corrida',
            outcomes: ['Ele aceita o convite. Você passa o fim de semana cuidando do humor dele em vez do seu, mas o contrato fica.'],
          },
          encerrar: {
            label: 'Responder por escrito que o contrato pode acabar ali',
            outcomes: ['A resposta dele é um áudio de um segundo, só um bufo. O contrato acaba, e você silencia a conversa.'],
          },
          gritar: {
            label: 'Mandar um áudio ainda mais alto de volta',
            outcomes: [
              'Ele responde com risadas e um “gostei”. Pelo visto, era só um teste de nervos.',
              'O áudio vaza para um grupo de empresários, e o contrato vai embora junto com a sua compostura.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'patrocinador-esfria',
    category: 'money',
    frequency: 'common',
    when: [],
    needs: ['unhappySponsor'],
    choices: [
      {
        id: 'relatorio',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'visita',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'morale', size: 1 },
            ],
          },
          {
            odds: 'rest',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: -1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'liberar',
        outcomes: [{ odds: 'sure', effects: [{ e: 'dropSponsor' }, { e: 'stat', stat: 'form', size: 1 }] }],
      },
    ],
    variants: [
      {
        title: '{patrocinador} parou de responder',
        body: 'Há semanas, nenhuma resposta do patrocinador. Os convites para as corridas voltam sem confirmação, e quem cuidava da conta saiu da empresa sem avisar.',
        choices: {
          relatorio: {
            label: 'Mandar um relatório caprichado com fotos e audiência',
            outcomes: ['O relatório chega à mesa certa, e uma resposta curta mostra que ainda há interesse. Montar tudo custou noites de treino.'],
          },
          visita: {
            label: 'Aparecer na sede sem marcar horário',
            outcomes: [
              'A recepção chama a diretora comercial, que adora a surpresa e dá novo fôlego ao contrato.',
              'Ninguém recebe você, e a visita sem aviso vira comentário pouco elegante nos corredores.',
            ],
          },
          liberar: {
            label: 'Mandar uma mensagem liberando o espaço no macacão',
            outcomes: ['{patrocinador} agradece em uma linha. O espaço vazio no macacão traz menos compromissos e mais tempo de pista.'],
          },
        },
      },
      {
        title: '{patrocinador} quer o logo menor',
        body: 'Um e-mail seco do patrocinador pede que o logo diminua no macacão e suma do capacete na próxima etapa. Ninguém explica o motivo, ninguém atende o telefone.',
        choices: {
          relatorio: {
            label: 'Responder com números de exposição e um plano',
            outcomes: ['Os números convencem alguém lá dentro: o logo fica onde está. O plano, porém, come as tardes de treino.'],
          },
          visita: {
            label: 'Ir até a empresa e pedir uma conversa franca',
            outcomes: [
              'A conversa franca destrava tudo: era só um diretor novo querendo cortar custos. Ele sai convencido.',
              'O segurança não deixa você passar da catraca. A história chega à diretoria como insistência.',
            ],
          },
          liberar: {
            label: 'Tirar o logo de vez e encerrar a parceria',
            outcomes: ['O adesivo sai inteiro, sem rasgar. Menos uma obrigação de imagem, mais tempo para o que importa.'],
          },
        },
      },
      {
        title: 'Silêncio constrangedor na festa do patrocinador',
        body: 'Na confraternização do patrocinador {patrocinador}, ninguém da diretoria vem falar com você, e a sua foto sumiu do painel da entrada. O recado está dado, mesmo sem palavras.',
        choices: {
          relatorio: {
            label: 'Mandar no dia seguinte um resumo da temporada com fotos',
            outcomes: ['O resumo circula entre os diretores, e a sua foto volta ao painel. O trabalho de montar tudo pesa na semana.'],
          },
          visita: {
            label: 'Atravessar o salão e cumprimentar o presidente',
            outcomes: [
              'O presidente se surpreende, ri e apresenta você aos convidados. A noite vira a seu favor.',
              'O presidente responde com um aceno frio e vira as costas. Quem viu, comenta.',
            ],
          },
          liberar: {
            label: 'Sair da festa e escrever pedindo o fim do contrato',
            outcomes: ['A resposta chega no dia seguinte, rápida e com cara de alívio. Sem festas constrangedoras, sobra tempo para a pista.'],
          },
        },
      },
    ],
  },
  {
    id: 'patrocinador-quer-acao',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'lacks', what: 'unhappySponsor' }],
    needs: ['sponsor'],
    choices: [
      {
        id: 'topar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 2 },
              { e: 'stat', stat: 'form', size: -1 },
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
              { e: 'sponsorMood', who: 'bound', size: -1 },
              { e: 'stat', stat: 'form', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'show',
        requires: [{ c: 'aptitude', aptitude: 'charisma', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'sponsorMood', who: 'bound', size: 3 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: '{patrocinador} quer você numa loja',
        body: 'Satisfeito com a parceria, o patrocinador {patrocinador} quer você numa tarde de autógrafos na loja principal, com o seu macacão exposto e fila de clientes. A data cai no meio da semana de corrida.',
        choices: {
          topar: {
            label: 'Topar a tarde de autógrafos, mesmo na semana da corrida',
            outcomes: ['A fila dobra a esquina, e o gerente posta fotos o dia inteiro. O treino da semana fica mais curto.'],
          },
          adiar: {
            label: 'Pedir para mudar a data para depois da etapa',
            outcomes: ['O marketing aceita a nova data, mas sem o mesmo entusiasmo. Você chega à corrida com a semana inteira de treino.'],
          },
          show: {
            label: 'Transformar a sessão de autógrafos num show para a fila',
            outcomes: ['Você narra corridas de carrinho com as crianças da fila. O vídeo vira campanha publicitária do patrocinador.'],
          },
        },
      },
      {
        title: '{patrocinador} prepara um comercial',
        body: 'O patrocinador quer você no comercial novo da marca. São dois dias de estúdio, figurino e texto decorado, logo antes da próxima corrida.',
        choices: {
          topar: {
            label: 'Encarar os dois dias de estúdio',
            outcomes: ['O comercial fica bom e passa no intervalo do jornal. Você chega à corrida com sono e falas na cabeça.'],
          },
          adiar: {
            label: 'Propor gravar só depois do fim da temporada',
            outcomes: ['O diretor de marketing respira fundo e aceita. A agenda de treino fica intacta, e a empolgação deles esfria um pouco.'],
          },
          show: {
            label: 'Improvisar o roteiro e fazer o estúdio inteiro rir',
            outcomes: ['O diretor joga o roteiro fora e grava o improviso. O patrocinador manda flores para a equipe no dia da estreia.'],
          },
        },
      },
      {
        title: 'Convite para a convenção de vendas',
        body: '{patrocinador} quer você no palco da convenção anual de vendedores, contando como é correr {categoria:em}. São mil pessoas, um microfone e um dia inteiro longe do treino.',
        choices: {
          topar: {
            label: 'Subir ao palco e contar a sua história',
            outcomes: ['Os vendedores aplaudem de pé e tiram fotos até a noite. O dia longe do treino pesa no fim de semana.'],
          },
          adiar: {
            label: 'Mandar um vídeo gravado no lugar da presença',
            outcomes: ['O vídeo passa no telão, sem o mesmo efeito. O patrocinador entende, mas anota a ausência.'],
          },
          show: {
            label: 'Levar o capacete e transformar a palestra num espetáculo',
            outcomes: ['A plateia sobe ao palco para tirar foto com o capacete. A diretoria do patrocinador já pede bis para o ano que vem.'],
          },
        },
      },
    ],
  },

  /* ---------------- Multas e taxas ---------------- */

  {
    id: 'multa-da-federacao',
    category: 'money',
    frequency: 'normal',
    when: [],
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
        id: 'recorrer',
        outcomes: [
          {
            odds: 'even',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'confidence', size: 1 },
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
    ],
    variants: [
      {
        title: 'Multa por inscrição fora do prazo',
        body: 'A federação manda a cobrança: a sua inscrição para a etapa chegou depois do prazo. A multa vem com juros e com um carimbo de “pagamento obrigatório”.',
        choices: {
          pagar: {
            label: 'Pagar a multa e não pensar mais nisso',
            outcomes: ['A multa é paga no mesmo dia. Dói no bolso, mas a cabeça fica livre para a corrida.'],
          },
          recorrer: {
            label: 'Recorrer, com o comprovante do envio em mãos',
            outcomes: [
              'O recurso é aceito: o sistema da federação tinha caído naquele dia. A papelada tomou a semana.',
              'O recurso é negado, a multa dobra e o caso aparece no boletim oficial da federação.',
            ],
          },
        },
      },
      {
        title: 'O escapamento barulhento no treino livre',
        body: 'O fiscal de ruído mediu o seu escapamento acima do limite no treino livre. A federação aplica uma multa e avisa que, na próxima vez, a punição é na pista.',
        choices: {
          pagar: {
            label: 'Pagar e trocar o abafador antes da corrida',
            outcomes: ['A multa é paga e o abafador novo chega a tempo. Ninguém mais mede o seu barulho.'],
          },
          recorrer: {
            label: 'Contestar a medição do fiscal',
            outcomes: [
              'O aparelho do fiscal estava descalibrado, e a multa é anulada. Foram dias de papel, mas a causa é sua.',
              'A nova medição confirma o barulho. A multa sobe e o seu nome sai na lista de infratores.',
            ],
          },
        },
      },
      {
        title: 'Macacão sem o selo da temporada',
        body: 'Na vistoria de segurança, o fiscal nota que o seu macacão não tem o selo de homologação da temporada. A federação deixa você correr, mas manda a multa por e-mail.',
        choices: {
          pagar: {
            label: 'Pagar a multa e pedir o selo novo',
            outcomes: ['O selo chega pelo correio junto com o recibo da multa. Assunto encerrado.'],
          },
          recorrer: {
            label: 'Provar que o macacão foi comprado dentro das regras',
            outcomes: [
              'A nota fiscal resolve: o erro era do fabricante. A multa cai, mas a tarde ficou no cartório.',
              'A federação não aceita a nota fiscal. A multa aumenta, e o caso vai parar no boletim.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'equipamento-na-alfandega',
    category: 'money',
    frequency: 'normal',
    when: [{ c: 'tier', min: 3 }],
    choices: [
      {
        id: 'pagar',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'cash', size: -1, cap: true },
              { e: 'stat', stat: 'teamTrust', size: 1 },
            ],
          },
        ],
      },
      {
        id: 'esperar',
        outcomes: [
          { odds: 'even', effects: [{ e: 'stat', stat: 'confidence', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'teamTrust', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'Equipamento retido na alfândega',
        body: 'A caixa com os seus capacetes, macacões e o banco moldado ficou retida na alfândega. O fiscal quer uma taxa de importação temporária, e a corrida é no fim de semana.',
        choices: {
          pagar: {
            label: 'Pagar a taxa e liberar a caixa hoje',
            outcomes: ['A caixa chega ao autódromo antes dos mecânicos. A equipe nem fica sabendo do susto e elogia a organização.'],
          },
          esperar: {
            label: 'Esperar a liberação sem pagar nada',
            outcomes: [
              'O fiscal muda de turno, e o colega dele libera a caixa sem taxa nenhuma. Sorte pura.',
              'A caixa só sai na segunda-feira. Você corre com macacão emprestado, e a equipe não esconde a irritação.',
            ],
          },
        },
      },
      {
        title: 'Excesso de bagagem no balcão do aeroporto',
        body: 'No balcão do aeroporto, a balança não perdoa: capacete reserva, dois macacões, luvas, sapatilhas e o kit de ferramentas passam muito do limite. A atendente aponta para a tabela de excesso.',
        choices: {
          pagar: {
            label: 'Pagar o excesso e embarcar com tudo',
            outcomes: ['Tudo embarca, e você chega ao autódromo com o equipamento completo. O chefe da equipe nota e aprova.'],
          },
          esperar: {
            label: 'Levar só o essencial e despachar o resto depois',
            outcomes: [
              'A transportadora entrega antes do treino livre, e ainda sai mais barato. Que sorte.',
              'A transportadora atrasa, e o capacete reserva fica no depósito. A equipe precisa improvisar no fim de semana.',
            ],
          },
        },
      },
      {
        title: 'O capacete novo parado na fiscalização',
        body: 'O capacete com a pintura nova, feito sob medida no Brasil, chegou ao país da etapa e parou na fiscalização. Para liberar, só pagando uma taxa que ninguém tinha previsto.',
        choices: {
          pagar: {
            label: 'Pagar a taxa e buscar o capacete pessoalmente',
            outcomes: ['O capacete chega a tempo da foto oficial, e a equipe usa a pintura nova nas redes da temporada.'],
          },
          esperar: {
            label: 'Correr com o capacete antigo e esperar a liberação',
            outcomes: [
              'A liberação sai sem custo dois dias depois. O capacete velho ainda deu conta do recado.',
              'A liberação leva semanas. A foto oficial sai com o capacete velho, e o marketing da equipe reclama.',
            ],
          },
        },
      },
    ],
  },

  /* ---------------- Custo de vida no polo ---------------- */

  {
    id: 'aluguel-na-italia',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'hub', hub: 'italia' }],
    choices: [
      {
        id: 'pagar',
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
        id: 'dividir',
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
    ],
    variants: [
      {
        title: 'A senhoria aumentou o aluguel',
        body: 'A senhoria do seu apartamento na Itália avisa, num italiano rápido demais, que o aluguel sobe no mês que vem. Perto do kartódromo, não há nada mais barato.',
        choices: {
          pagar: {
            label: 'Pagar o aumento e continuar a cinco minutos da pista',
            outcomes: ['Você paga sem discutir. Morar perto da pista vale cada treino extra de manhã cedo.'],
          },
          dividir: {
            label: 'Dividir o apartamento com dois mecânicos da equipe',
            outcomes: ['A conta fica leve, mas a privacidade some. Em compensação, os mecânicos passam a cuidar do seu kart como se fosse deles.'],
          },
        },
      },
      {
        title: 'O aquecedor quebrou em pleno inverno',
        body: 'O aquecedor do apartamento pifou, e o dono do imóvel diz que o conserto é por sua conta. Lá fora, a neblina cobre o vale; aqui dentro, dá para ver a própria respiração.',
        choices: {
          pagar: {
            label: 'Pagar o técnico e dormir no quentinho',
            outcomes: ['O técnico conserta em uma hora e cobra como se fossem dez. Pelo menos as noites voltam a render descanso.'],
          },
          dividir: {
            label: 'Aceitar o sofá-cama na casa do chefe dos mecânicos',
            outcomes: ['A casa é quente e a comida é ótima, mas o sofá-cama range a noite toda. A equipe adora ter você por perto.'],
          },
        },
      },
      {
        title: 'Contas italianas em cima da mesa',
        body: 'Luz, gás, internet, taxa do lixo, seguro do apartamento: as contas chegam em italiano e com multa por atraso. Viver perto das fábricas de kart custa mais do que dizia a planilha.',
        choices: {
          pagar: {
            label: 'Pagar tudo e manter o apartamento perto da pista',
            outcomes: ['As contas ficam em dia, e o caminho até a pista continua curto. O treino agradece.'],
          },
          dividir: {
            label: 'Mudar para o quartinho em cima da oficina da equipe',
            outcomes: ['O quartinho cheira a gasolina e tem o compressor como despertador, mas os mecânicos viram a sua segunda família.'],
          },
        },
      },
    ],
  },
  {
    id: 'custo-de-vida-na-inglaterra',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'hub', hub: 'inglaterra' }],
    choices: [
      {
        id: 'pagar',
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
        id: 'dividir',
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
        title: 'O aluguel perto das fábricas dispara',
        body: 'O contrato do apartamento na Inglaterra vence, e a imobiliária pede um reajuste salgado. Perto das fábricas das equipes, todo mundo quer morar, e o preço sabe disso.',
        choices: {
          pagar: {
            label: 'Renovar o contrato e continuar perto da fábrica',
            outcomes: ['Você renova e segue a dez minutos do simulador da equipe. As sessões extras de manhã continuam possíveis.'],
          },
          dividir: {
            label: 'Dividir uma casa com outros brasileiros que correm por aqui',
            outcomes: ['A casa vira uma pequena embaixada: feijão no domingo, saudade dividida. O sono, porém, nunca foi tão curto.'],
          },
        },
      },
      {
        title: 'A conta de aquecimento do inverno inglês',
        body: 'A primeira conta de aquecimento do inverno chega e assusta. O apartamento é antigo, as janelas deixam passar o vento e a chuva fina não para há duas semanas.',
        choices: {
          pagar: {
            label: 'Pagar a conta e manter a casa aquecida',
            outcomes: ['A casa fica quente, o corpo descansa e as sessões de treino físico rendem como devem.'],
          },
          dividir: {
            label: 'Deixar o apartamento e dividir a casa de outro brasileiro',
            outcomes: ['Na casa nova, há sempre alguém para conversar em português. Há também festa na sala em noite de véspera.'],
          },
        },
      },
      {
        title: 'Trem atrasado, treino perdido',
        body: 'Os trens até a fábrica da {equipe} atrasam toda semana, e um carro na Inglaterra custa seguro, estacionamento e paciência. A saída é morar perto ou dividir o caminho.',
        choices: {
          pagar: {
            label: 'Alugar um quarto ao lado da fábrica',
            outcomes: ['O quarto é pequeno e caro, mas você chega à fábrica antes de todo mundo.'],
          },
          dividir: {
            label: 'Rachar o carro e as caronas com um colega brasileiro',
            outcomes: ['As caronas viram as melhores conversas da semana. O horário do colega, porém, nem sempre bate com o seu treino.'],
          },
        },
      },
    ],
  },

  /* ---------------- Trabalho paralelo, torcida e prêmios ---------------- */

  {
    id: 'hora-extra-no-trabalho-paralelo',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'has', what: 'sideJob' }],
    choices: [
      {
        id: 'treinar',
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
        id: 'plantao',
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
    ],
    variants: [
      {
        title: 'O turno de sábado no trabalho paralelo',
        body: 'O seu chefe no trabalho paralelo pede que você cubra o turno de sábado, porque um colega ficou doente. Paga bem. Só que sábado é dia do treino que você mais precisa.',
        choices: {
          treinar: {
            label: 'Dizer não e manter o treino de sábado',
            outcomes: ['O chefe fecha a cara, mas o treino rende como há tempos não rendia.'],
          },
          plantao: {
            label: 'Cobrir o turno e embolsar o extra',
            outcomes: ['O dinheiro extra cai na sexta seguinte. O treino perdido aparece na corrida.'],
          },
        },
      },
      {
        title: 'Cliente grande quer o seu fim de semana',
        body: 'No trabalho paralelo, um cliente grande pede atendimento exclusivo no único fim de semana livre da agenda. O dinheiro ajudaria. O descanso e o treino, nem tanto.',
        choices: {
          treinar: {
            label: 'Recusar o cliente e guardar o fim de semana',
            outcomes: ['O cliente vai para outro, e o seu chefe nota. O descanso e o treino, porém, fazem diferença na pista.'],
          },
          plantao: {
            label: 'Aceitar o cliente e trabalhar o fim de semana inteiro',
            outcomes: ['O cliente paga bem e ainda deixa gorjeta. Na segunda-feira, o corpo reclama de cada hora.'],
          },
        },
      },
      {
        title: 'Mais horas no trabalho, por um tempo',
        body: 'O trabalho paralelo oferece mais horas fixas por algumas semanas, com pagamento melhor. A proposta é boa para o caixa e péssima para a agenda de treinos.',
        choices: {
          treinar: {
            label: 'Agradecer e continuar com as horas de sempre',
            outcomes: ['Você mantém a rotina de treino. O chefe diz que entende, sem parecer entender.'],
          },
          plantao: {
            label: 'Aceitar as horas extras por algumas semanas',
            outcomes: ['O caixa engorda um pouco, e o tempo de pista emagrece na mesma proporção.'],
          },
        },
      },
    ],
  },
  {
    id: 'vaquinha-da-torcida',
    category: 'money',
    frequency: 'rare',
    when: [
      { c: 'cash', atMost: 'tight' },
      { c: 'tier', max: 4 },
    ],
    choices: [
      {
        id: 'aceitar',
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
        id: 'doar',
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
    ],
    variants: [
      {
        title: 'A rifa da torcida de {cidade}',
        body: 'Um grupo de torcedores de {cidade} organizou uma rifa para ajudar nos custos da sua temporada. O sorteio é no salão da igreja, e todo mundo espera que você apareça.',
        choices: {
          aceitar: {
            label: 'Ir ao sorteio e aceitar a ajuda com gratidão',
            outcomes: ['O salão lota, a rifa rende bem e você tira foto com o bairro inteiro. O dia de treino fica para depois.'],
          },
          doar: {
            label: 'Doar a arrecadação para a escolinha de kart do bairro',
            outcomes: ['A escolinha ganha karts novos com o seu nome na placa. O bairro vai contar essa história por anos.'],
          },
        },
      },
      {
        title: 'Uma vaquinha na internet com o seu nome',
        body: 'Sem você saber, fãs abriram uma vaquinha na internet para ajudar na sua temporada. Em poucos dias, o objetivo foi batido. Agora querem uma transmissão ao vivo de agradecimento.',
        choices: {
          aceitar: {
            label: 'Fazer a transmissão e aceitar o dinheiro da vaquinha',
            outcomes: ['A transmissão dura três horas, com perguntas sobre tudo. O dinheiro entra, e o treino daquela noite não acontece.'],
          },
          doar: {
            label: 'Repassar o valor para um hospital infantil de {cidade}',
            outcomes: ['O hospital manda uma foto das crianças com desenhos do seu capacete. A notícia corre o estado.'],
          },
        },
      },
      {
        title: 'O almoço beneficente do kartódromo',
        body: 'O dono do kartódromo onde você começou organiza um almoço beneficente em seu nome. A comida é por conta dele; o que entrar vai para a sua carreira.',
        choices: {
          aceitar: {
            label: 'Ir ao almoço e aceitar o dinheiro arrecadado',
            outcomes: ['Você serve feijoada, conta histórias e sai com um envelope e a barriga cheia. O treino da tarde fica para outro dia.'],
          },
          doar: {
            label: 'Pedir que a arrecadação pague aulas para crianças sem dinheiro',
            outcomes: ['O kartódromo cria uma turma gratuita com o seu nome. As famílias da turma viram a sua torcida mais fiel.'],
          },
        },
      },
    ],
  },
  {
    id: 'premio-inesperado',
    category: 'money',
    frequency: 'rare',
    when: [{ c: 'careerSeason', min: 2 }],
    choices: [
      {
        id: 'guardar',
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
        id: 'repartir',
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
        title: 'Prêmio de atleta do ano em {cidade}',
        body: 'A câmara de vereadores de {cidade} escolheu você como atleta do ano. Além da placa, há um prêmio em dinheiro e uma cerimônia que cai bem no dia do treino.',
        choices: {
          guardar: {
            label: 'Ir à cerimônia e guardar o prêmio no caixa',
            outcomes: ['Discurso curto, foto com o prefeito e um cheque que alivia as contas. O treino fica para o dia seguinte.'],
          },
          repartir: {
            label: 'Dividir o prêmio com os mecânicos da {equipe}',
            outcomes: ['Os mecânicos ganham um churrasco e um envelope cada. Na etapa seguinte, o equipamento vem impecável.'],
          },
        },
      },
      {
        title: 'A ultrapassagem mais votada do ano',
        body: 'Uma votação na internet escolheu uma ultrapassagem sua como a mais bonita do ano no automobilismo nacional. O prêmio é em dinheiro, entregue num evento em outra cidade.',
        choices: {
          guardar: {
            label: 'Viajar para o evento e receber o prêmio',
            outcomes: ['Você sobe ao palco, agradece e guarda o dinheiro. A viagem custa um dia de treino.'],
          },
          repartir: {
            label: 'Dedicar o prêmio à equipe e dividir tudo',
            outcomes: ['A equipe ouve a dedicatória ao vivo e comemora na oficina. O dinheiro vira jantar e lembrança.'],
          },
        },
      },
      {
        title: 'O prêmio de estreante que nunca chegou',
        body: 'A organização de um torneio antigo descobre que nunca pagou o seu prêmio de estreante. Pede desculpas e marca a entrega numa festa com os patrocinadores dela.',
        choices: {
          guardar: {
            label: 'Ir à festa e receber o prêmio atrasado',
            outcomes: ['O prêmio chega com juros de constrangimento e um bolo. A festa vai até tarde, e o treino seguinte sofre.'],
          },
          repartir: {
            label: 'Repassar o prêmio aos mecânicos que trabalham com você hoje',
            outcomes: ['Os mecânicos da {equipe} recebem o dinheiro com surpresa. A história do prêmio atrasado vira piada interna na oficina.'],
          },
        },
      },
    ],
  },

  /* ---------------- Investidor e equipamento ---------------- */

  {
    id: 'investidor-pede-satisfacao',
    category: 'money',
    frequency: 'common',
    when: [{ c: 'has', what: 'investor' }],
    choices: [
      {
        id: 'plano',
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'form', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'contrato',
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
              { e: 'stat', stat: 'reputation', size: -1 },
              { e: 'stat', stat: 'morale', size: -1 },
            ],
          },
        ],
      },
      {
        id: 'calma',
        requires: [{ c: 'aptitude', aptitude: 'composure', level: 'high' }],
        outcomes: [
          {
            odds: 'sure',
            effects: [
              { e: 'stat', stat: 'confidence', size: 1 },
              { e: 'stat', stat: 'reputation', size: 1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O fundo que investe em você quer números',
        body: 'O analista do fundo que banca parte da sua carreira manda uma planilha com perguntas: por que os resultados não aparecem, quanto custa cada etapa, quando vem o retorno.',
        choices: {
          plano: {
            label: 'Responder a planilha inteira, com um plano para a temporada',
            outcomes: ['O analista elogia o capricho e encerra a cobrança. Responder tudo custou dois dias longe do treino.'],
          },
          contrato: {
            label: 'Lembrar que o acordo é de longo prazo',
            outcomes: [
              'O analista concorda, pede desculpas pela pressa e some por um bom tempo.',
              'O fundo não gosta do tom, e um sócio comenta no paddock que você não presta contas.',
            ],
          },
          calma: {
            label: 'Ligar para o analista e explicar tudo sem se alterar',
            outcomes: ['A conversa serena desarma o analista, que passa a defender você nas reuniões do fundo.'],
          },
        },
      },
      {
        title: 'Reunião com os sócios do fundo',
        body: 'Os sócios do fundo que investe na sua carreira marcam uma reunião numa sala envidraçada. Querem ouvir de você, cara a cara, por que deveriam continuar apostando.',
        choices: {
          plano: {
            label: 'Apresentar metas claras para as próximas etapas',
            outcomes: ['Os sócios anotam tudo e saem convencidos. A preparação da apresentação come a semana de treino.'],
          },
          contrato: {
            label: 'Dizer que carreira de piloto não é ação da bolsa',
            outcomes: [
              'A frase arranca risos e respeito. Os sócios saem da sala mais pacientes.',
              'Os sócios não acham graça, e a frase vira piada em outras mesas de negócio.',
            ],
          },
          calma: {
            label: 'Ouvir as críticas em silêncio antes de responder',
            outcomes: ['Você deixa todo mundo falar e responde ponto a ponto, sem pressa. A sala inteira sai impressionada.'],
          },
        },
      },
      {
        title: 'O fundo leu a matéria do jornal',
        body: 'Uma matéria de jornal questiona a sua fase, e o fundo que banca a sua carreira manda um e-mail curto: quer explicações até sexta-feira.',
        choices: {
          plano: {
            label: 'Mandar um relatório com a evolução volta a volta',
            outcomes: ['O relatório convence o fundo e ainda vira material para a imprensa. As noites de planilha cobram o preço na pista.'],
          },
          contrato: {
            label: 'Responder que matéria de jornal não muda o contrato',
            outcomes: [
              'O fundo aceita a resposta seca e não toca mais no assunto.',
              'O fundo encaminha o seu e-mail ao jornalista como exemplo de arrogância. A segunda matéria é pior.',
            ],
          },
          calma: {
            label: 'Ligar para o diretor do fundo e conversar com franqueza',
            outcomes: ['O diretor gosta da franqueza e da calma. A matéria vira página virada nas reuniões do fundo.'],
          },
        },
      },
    ],
  },
  {
    id: 'equipamento-de-seguranca-novo',
    category: 'money',
    frequency: 'normal',
    when: [],
    choices: [
      {
        id: 'comprar',
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
        id: 'arriscar',
        outcomes: [
          { odds: 'likely', effects: [{ e: 'stat', stat: 'morale', size: 1 }] },
          {
            odds: 'rest',
            effects: [
              { e: 'stat', stat: 'form', size: -1 },
              { e: 'stat', stat: 'reputation', size: -1 },
            ],
          },
        ],
      },
    ],
    variants: [
      {
        title: 'O selo do capacete venceu',
        body: 'O fiscal da vistoria avisa: o selo de validade do seu capacete vence antes da próxima etapa. Capacete novo, com a pintura de sempre, não sai barato.',
        choices: {
          comprar: {
            label: 'Encomendar um capacete novo com a pintura de sempre',
            outcomes: ['O capacete novo encaixa como uma luva. Na primeira volta, a confiança vem junto.'],
          },
          arriscar: {
            label: 'Usar o antigo até o fiscal reclamar',
            outcomes: [
              'O fiscal tem outras preocupações e não reclama. O caixa agradece.',
              'O fiscal barra o capacete na vistoria. Você perde o treino livre correndo atrás de um emprestado.',
            ],
          },
        },
      },
      {
        title: 'Um furo chamuscado no macacão',
        body: 'Um encosto no escapamento quente deixou um buraco chamuscado na perna do seu macacão. Remendo não passa na vistoria, dizem os veteranos da equipe.',
        choices: {
          comprar: {
            label: 'Comprar um macacão novo antes da próxima etapa',
            outcomes: ['O macacão novo veste como uma segunda pele. Você volta à pista sem pensar em fogo.'],
          },
          arriscar: {
            label: 'Costurar um remendo caprichado e seguir',
            outcomes: [
              'O remendo passa despercebido na vistoria, e ninguém fala mais nisso.',
              'O fiscal vê o remendo de longe e manda trocar. O fim de semana começa com correria e bronca.',
            ],
          },
        },
      },
      {
        title: 'O protetor de pescoço rachado',
        body: 'Ao guardar o equipamento, você nota uma rachadura no protetor de pescoço. Talvez ainda segure. Um novo custa o mesmo que um jogo de pneus.',
        choices: {
          comprar: {
            label: 'Trocar o protetor de pescoço por um novo',
            outcomes: ['Com o protetor novo, você ataca as zebras sem medo de nada.'],
          },
          arriscar: {
            label: 'Colar a rachadura com fita e torcer',
            outcomes: [
              'A fita aguenta o fim de semana inteiro, e o dinheiro fica no bolso.',
              'A fita solta no treino livre, e um fotógrafo registra o remendo. A foto rende piadas e pouco treino.',
            ],
          },
        },
      },
    ],
  },
];
