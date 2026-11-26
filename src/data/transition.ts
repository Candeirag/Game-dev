/**
 * Textos do ano de transição (Fase 6): os três papéis do primeiro ano fora do carro, as marcas que o
 * personagem pode representar, as mensagens de cada etapa e os eventos do ano.
 *
 * Só palavras e chaves. Os cachês, as chances e o tamanho de cada efeito estão em TRANSITION
 * (`src/config/balance.ts`); o tamanho de um efeito aqui é um degrau (1 a 3, com sinal) que escolhe a
 * posição na lista EVENT_* daquela tabela, e as chances de um desfecho têm nome (as mesmas dos
 * cartões da Fase 5, em STORY_EVENTS.ODDS). A regra está em `src/engine/dynasty/transition.ts`.
 *
 * Os textos não têm gênero para "você", para quem é acompanhado na mentoria nem para o parceiro:
 * o jogo não sabe o gênero de ninguém. Marcadores: `{pupilo}` (o nome de quem é acompanhado, só nos
 * eventos de mentoria) e `{marca}` (a marca representada, só nos de imagem de marca).
 */
import type { TransitionRole } from '@/domain/schemas';
import type { StoryOdds, StorySize } from '@/domain/storyEvents';

export interface TransitionRoleInfo {
  /** Nome do papel, para a escolha e o painel do ano. */
  label: string;
  /** O que o papel faz, numa frase. */
  description: string;
  /** O legado que fica depois do ano, numa frase. */
  legacy: string;
}

export const TRANSITION_ROLE_INFO: Readonly<Record<TransitionRole, TransitionRoleInfo>> = {
  mentor: {
    label: 'Mentoria',
    description: 'Acompanhar um jovem piloto de perto: treinos, corridas e as conversas depois da bandeirada.',
    legacy: 'Quem foi acompanhado não esquece: aceita correr pela sua equipe com mais facilidade.',
  },
  commentator: {
    label: 'Comentários na TV',
    description: 'Comentar as corridas na transmissão, da cabine do autódromo, com o nome em evidência.',
    legacy: 'O rosto conhecido da TV abre portas no mercado de dirigentes.',
  },
  ambassador: {
    label: 'Imagem de uma marca',
    description: 'Representar uma marca em campanhas, eventos e no paddock, com a agenda cheia de viagens.',
    legacy: 'A marca promete patrocinar quem da família herdar a carreira nas pistas.',
  },
};

/** Marcas inventadas que o personagem pode representar (nenhuma existe de verdade). */
export const TRANSITION_BRANDS: readonly string[] = [
  'Relógios Ponteiro Fino',
  'Cafés Serra do Orvalho',
  'Bebidas Maré Mansa',
  'Lubrificantes Trilha Quente',
  'Calçados Passo Largo',
  'Seguros Vela Branca',
  'Cosméticos Ipê Dourado',
  'Óculos Horizonte Claro',
];

/** O que entra nas mensagens do ano: valores já formatados pelo motor. */
export interface TransitionTextParams {
  round: number;
  /** Nome do vencedor da etapa. */
  winner: string;
  /** Cachê da etapa, já formatado. */
  fee: string;
  /** O campeonato acompanhado, com artigo ("o Campeonato…", "a Fórmula…"). */
  championship: string;
  brand: string;
  pupil: string;
  /** Como foi a etapa de quem é acompanhado ("terminou em 4º", "abandonou"), ou null fora do campeonato. */
  pupilResult: string | null;
}

/** A mensagem de cada etapa do ano de transição, por papel. */
export const TRANSITION_ROUND_TEXTS: Readonly<Record<TransitionRole, (p: TransitionTextParams) => string>> = {
  mentor: (p) =>
    p.pupilResult
      ? `${p.pupil} ${p.pupilResult}. Você acompanhou o fim de semana inteiro nos boxes. Vencedor: ${p.winner}. Ajuda de custo da mentoria: ${p.fee}.`
      : `Você passou o fim de semana acompanhando ${p.pupil} na carreira própria. Vencedor da etapa: ${p.winner}. Ajuda de custo da mentoria: ${p.fee}.`,
  commentator: (p) => `Da cabine, você comentou a vitória de ${p.winner} para todo o país. Cachê da transmissão: ${p.fee}.`,
  ambassador: (p) => `Um dia inteiro no paddock com os convidados da ${p.brand}, entre fotos e autógrafos. Vencedor: ${p.winner}. Cachê: ${p.fee}.`,
};

/** A mensagem do começo do ano de transição, por papel. */
export const TRANSITION_START_TEXTS: Readonly<Record<TransitionRole, (p: TransitionTextParams) => string>> = {
  mentor: (p) => `Ano de transição: você passa a acompanhar ${p.pupil} de perto, nos treinos e nas corridas. A ajuda de custo sai a cada etapa.`,
  commentator: (p) => `Ano de transição: você passa a comentar ${p.championship} na TV. O cachê sai a cada etapa, e a cabine deixa o seu nome em evidência.`,
  ambassador: (p) => `Ano de transição: você passa a representar a ${p.brand} em campanhas e eventos. O cachê sai a cada etapa, e a agenda é cheia de viagens.`,
};

/* ------------------------------------------------------------------ */
/* Eventos do ano                                                      */
/* ------------------------------------------------------------------ */

/** Quem o evento pressupõe (sem essa pessoa, ele não sai). */
export type TransitionNeed = 'partner' | 'children';

/**
 * Um efeito de um desfecho: dinheiro, reputação, moral, relação com o parceiro ou vínculo de todos os
 * filhos, no degrau dado (o sinal diz se ganha ou perde).
 */
export interface TransitionEffectSpec {
  e: 'cash' | 'reputation' | 'morale' | 'relationship' | 'bond';
  size: StorySize;
}

export interface TransitionOutcomeSpec {
  odds: Exclude<StoryOdds, 'academy'>;
  text: string;
  effects: readonly TransitionEffectSpec[];
}

export interface TransitionChoiceSpec {
  id: string;
  label: string;
  description: string;
  outcomes: readonly TransitionOutcomeSpec[];
}

export interface TransitionEventSpec {
  id: string;
  role: TransitionRole;
  needs?: TransitionNeed;
  title: string;
  body: string;
  /** De duas a três; a primeira é a natural (a que o robô escolhe). */
  choices: readonly TransitionChoiceSpec[];
}

const sure = (text: string, ...effects: TransitionEffectSpec[]): TransitionOutcomeSpec[] => [{ odds: 'sure', text, effects }];
const fx = (e: TransitionEffectSpec['e'], size: StorySize): TransitionEffectSpec => ({ e, size });

export const TRANSITION_EVENTS: readonly TransitionEventSpec[] = [
  /* ---------------- Comentários na TV ---------------- */
  {
    id: 'frase-vazada',
    role: 'commentator',
    title: 'Microfone aberto',
    body: 'No intervalo comercial, um comentário seu sobre a direção de prova vazou no ar. A emissora pergunta como você quer lidar com a repercussão.',
    choices: [
      {
        id: 'pedir-desculpas',
        label: 'Pedir desculpas no ar',
        description: 'Encerra o assunto, ao custo de um pouco de brilho.',
        outcomes: sure('O pedido de desculpas acalmou a federação, e o assunto morreu no dia seguinte.', fx('reputation', -1)),
      },
      {
        id: 'sustentar',
        label: 'Sustentar o que disse',
        description: 'O público adora franqueza; os comissários, nem tanto.',
        outcomes: [
          { odds: 'even', text: 'A frase virou bordão nas arquibancadas, e a audiência subiu.', effects: [fx('reputation', 2)] },
          { odds: 'rest', text: 'A federação reclamou com a emissora, e a frase pegou mal no paddock.', effects: [fx('reputation', -2)] },
        ],
      },
    ],
  },
  {
    id: 'serie-de-bastidores',
    role: 'commentator',
    title: 'Série de bastidores',
    body: 'Um canal de entrevistas na internet quer gravar com você uma série sobre os bastidores das pistas. Paga bem, mas ocupa as noites livres da temporada.',
    choices: [
      {
        id: 'gravar-serie',
        label: 'Gravar a série',
        description: 'Dinheiro extra e noites curtas.',
        outcomes: sure('A série fez sucesso, e as noites de gravação cobraram o preço no cansaço.', fx('cash', 2), fx('morale', -1)),
      },
      {
        id: 'guardar-as-noites',
        label: 'Guardar as noites livres',
        description: 'Sem dinheiro extra, com mais descanso.',
        outcomes: sure('As noites livres renderam descanso e boas conversas longe do automobilismo.', fx('morale', 1)),
      },
    ],
  },
  {
    id: 'entrevista-exclusiva',
    role: 'commentator',
    title: 'Entrevista exclusiva',
    body: 'A emissora conseguiu uma entrevista exclusiva com o líder do campeonato e quer você na condução. A preparação toma a semana inteira.',
    choices: [
      {
        id: 'conduzir',
        label: 'Conduzir a entrevista',
        description: 'Uma semana de estudo por uma conversa que pode marcar época.',
        outcomes: [
          { odds: 'likely', text: 'A entrevista repercutiu em todos os jornais esportivos.', effects: [fx('reputation', 2)] },
          { odds: 'rest', text: 'O entrevistado respondeu com evasivas, e a conversa rendeu pouco.', effects: [fx('morale', -1)] },
        ],
      },
      {
        id: 'indicar-colega',
        label: 'Indicar outro comentarista',
        description: 'Menos trabalho, menos holofote.',
        outcomes: sure('O colega conduziu a conversa, e você aproveitou a semana de folga.', fx('morale', 1)),
      },
    ],
  },
  {
    id: 'visita-a-cabine',
    role: 'commentator',
    needs: 'children',
    title: 'Visita à cabine',
    body: 'A emissora abre a cabine de transmissão para a família assistir a uma corrida ao seu lado. As crianças não falam de outra coisa.',
    choices: [
      {
        id: 'levar-a-familia',
        label: 'Levar a família',
        description: 'Um dia de festa, com a produção de olho no barulho.',
        outcomes: sure('Ninguém em casa esquece a tarde na cabine, nem os gritos na largada.', fx('bond', 2)),
      },
      {
        id: 'cabine-de-trabalho',
        label: 'Manter a cabine só para o trabalho',
        description: 'Concentração total, e crianças decepcionadas.',
        outcomes: sure('A transmissão saiu impecável; em casa, a decepção durou a semana.', fx('reputation', 1), fx('bond', -1)),
      },
    ],
  },
  {
    id: 'nome-trocado',
    role: 'commentator',
    title: 'Nome trocado ao vivo',
    body: 'Na narração de uma ultrapassagem decisiva, você trocou o nome dos dois pilotos, e o trecho se espalhou pelas redes.',
    choices: [
      {
        id: 'rir-do-erro',
        label: 'Rir do próprio erro nas redes',
        description: 'Bom humor costuma desarmar a piada.',
        outcomes: [
          { odds: 'likely', text: 'O vídeo em que você ri do próprio erro fez mais sucesso que o erro.', effects: [fx('reputation', 1)] },
          { odds: 'rest', text: 'A brincadeira não colou, e a piada durou semanas.', effects: [fx('morale', -2)] },
        ],
      },
      {
        id: 'deixar-passar',
        label: 'Deixar passar',
        description: 'Sem resposta, a piada costuma morrer logo.',
        outcomes: sure('A piada morreu em poucos dias, mas incomodou o tempo todo.', fx('morale', -1)),
      },
    ],
  },
  {
    id: 'bonus-de-exclusividade',
    role: 'commentator',
    title: 'Bônus de exclusividade',
    body: 'A emissora oferece um bônus para você comentar só para ela até o fim do ano, sem entrevistas a outros veículos.',
    choices: [
      {
        id: 'assinar-exclusividade',
        label: 'Assinar a exclusividade',
        description: 'Dinheiro garantido, menos exposição fora da emissora.',
        outcomes: sure('O bônus caiu na conta, e as outras redações pararam de ligar.', fx('cash', 2)),
      },
      {
        id: 'manter-a-liberdade',
        label: 'Manter a liberdade',
        description: 'Sem bônus, com o nome em todos os veículos.',
        outcomes: sure('Você seguiu falando a quem quisesse ouvir, e o seu nome circulou mais.', fx('reputation', 1)),
      },
    ],
  },

  /* ---------------- Imagem de uma marca ---------------- */
  {
    id: 'campanha-nacional',
    role: 'ambassador',
    title: 'Campanha nacional',
    body: 'A {marca} quer gravar uma campanha nacional com você: dias seguidos de estúdio e uma verba extra generosa.',
    choices: [
      {
        id: 'gravar-campanha',
        label: 'Gravar a campanha',
        description: 'Verba extra, agenda apertada.',
        outcomes: sure('A campanha ficou bonita, e a maratona de gravação deixou marcas no humor.', fx('cash', 2), fx('morale', -1)),
      },
      {
        id: 'pedir-menos-dias',
        label: 'Pedir menos dias de gravação',
        description: 'A marca pode topar, ou não gostar da exigência.',
        outcomes: [
          { odds: 'even', text: 'A marca topou, com uma verba menor.', effects: [fx('cash', 1)] },
          { odds: 'rest', text: 'A marca cedeu de má vontade e reclamou com quem cuida da sua agenda.', effects: [fx('reputation', -1)] },
        ],
      },
    ],
  },
  {
    id: 'lote-com-defeito',
    role: 'ambassador',
    title: 'Lote com defeito',
    body: 'Um lote de produtos da {marca} deu problema, e a imprensa quer saber o que você pensa disso.',
    choices: [
      {
        id: 'defender-a-marca',
        label: 'Defender a marca',
        description: 'A marca agradece; parte do público, não.',
        outcomes: sure('A {marca} agradeceu a lealdade com um bônus, e parte do público torceu o nariz.', fx('cash', 1), fx('reputation', -1)),
      },
      {
        id: 'tomar-distancia',
        label: 'Tomar distância do assunto',
        description: 'O público aprova; a marca, nem tanto.',
        outcomes: sure('A resposta franca agradou ao público, e a {marca} cortou um bônus.', fx('reputation', 1), fx('cash', -1)),
      },
    ],
  },
  {
    id: 'turne-de-lojas',
    role: 'ambassador',
    title: 'Turnê de lojas',
    body: 'A {marca} organiza uma turnê por lojas do interior, com fila de fãs em cada parada.',
    choices: [
      {
        id: 'fazer-a-turne',
        label: 'Fazer a turnê',
        description: 'Estrada, autógrafos e fotos sem fim.',
        outcomes: sure('As filas deram a volta no quarteirão, e cada parada saiu no jornal da cidade.', fx('reputation', 1), fx('morale', 1)),
      },
      {
        id: 'mandar-um-video',
        label: 'Mandar um vídeo no lugar',
        description: 'Poupa a estrada, frustra os fãs.',
        outcomes: sure('O vídeo passou nas telas das lojas, e os fãs reclamaram da ausência.', fx('reputation', -1)),
      },
    ],
  },
  {
    id: 'aniversario-no-dia-do-evento',
    role: 'ambassador',
    needs: 'children',
    title: 'Aniversário no dia do evento',
    body: 'O maior evento do ano da {marca} caiu no mesmo dia do aniversário de uma das crianças.',
    choices: [
      {
        id: 'ir-ao-evento',
        label: 'Ir ao evento',
        description: 'Compromisso cumprido; festa sem você.',
        outcomes: sure('O evento rendeu um bônus, e a festa ficou com uma cadeira vazia.', fx('cash', 1), fx('bond', -2)),
      },
      {
        id: 'ficar-na-festa',
        label: 'Ficar na festa',
        description: 'A família agradece; a marca anota.',
        outcomes: sure('Você saiu na foto do bolo, e a {marca} mandou um recado seco no dia seguinte.', fx('bond', 2), fx('reputation', -1)),
      },
    ],
  },
  {
    id: 'proposta-da-concorrencia',
    role: 'ambassador',
    title: 'Proposta da concorrência',
    body: 'Uma concorrente da {marca} oferece mais dinheiro para você mudar de lado no ano que vem.',
    choices: [
      {
        id: 'manter-a-palavra',
        label: 'Manter a palavra',
        description: 'Lealdade costuma ser lembrada.',
        outcomes: sure('A {marca} soube da recusa e retribuiu com um elogio público.', fx('reputation', 1)),
      },
      {
        id: 'usar-na-negociacao',
        label: 'Usar a proposta para negociar',
        description: 'Pode render um reajuste, ou vazar.',
        outcomes: [
          { odds: 'even', text: 'A {marca} cobriu a proposta e reajustou o cachê.', effects: [fx('cash', 2)] },
          {
            odds: 'rest',
            text: 'A negociação vazou, e o mercado passou a ver em você alguém que troca de lado por dinheiro.',
            effects: [fx('reputation', -2)],
          },
        ],
      },
    ],
  },
  {
    id: 'publicacao-forcada',
    role: 'ambassador',
    title: 'Publicação forçada',
    body: 'Uma publicação patrocinada sua recebeu uma enxurrada de críticas por parecer anúncio demais.',
    choices: [
      {
        id: 'apagar-publicacao',
        label: 'Apagar e seguir em frente',
        description: 'O assunto morre rápido.',
        outcomes: sure('A publicação sumiu, e o assunto foi junto.', fx('reputation', -1)),
      },
      {
        id: 'explicar-a-parceria',
        label: 'Explicar a parceria em vídeo',
        description: 'Sinceridade pode virar o jogo.',
        outcomes: [
          { odds: 'unlikely', text: 'O vídeo sincero virou exemplo de publicidade sem enganar ninguém.', effects: [fx('reputation', 2)] },
          { odds: 'rest', text: 'O vídeo só reacendeu as críticas.', effects: [fx('reputation', -1), fx('morale', -1)] },
        ],
      },
    ],
  },
  {
    id: 'convite-para-dois',
    role: 'ambassador',
    needs: 'partner',
    title: 'Convite para dois',
    body: 'A {marca} convida você e quem divide a vida com você para um lançamento numa praia famosa.',
    choices: [
      {
        id: 'aceitar-o-convite',
        label: 'Aceitar o convite',
        description: 'Uns dias de trabalho com cara de férias.',
        outcomes: sure('Entre um painel e outro, sobrou tempo para passear a dois.', fx('relationship', 2)),
      },
      {
        id: 'ir-sem-companhia',
        label: 'Ir sem companhia',
        description: 'Mais tempo para os contatos da marca.',
        outcomes: sure('Os contatos renderam um bônus, e em casa ficou um silêncio estranho.', fx('cash', 1), fx('relationship', -1)),
      },
    ],
  },

  /* ---------------- Mentoria ---------------- */
  {
    id: 'conselho-na-vespera',
    role: 'mentor',
    title: 'Conselho na véspera',
    body: 'Na véspera da corrida, {pupilo} liga pedindo uma opinião sobre o acerto do carro.',
    choices: [
      {
        id: 'rever-os-dados',
        label: 'Passar a noite revendo os dados',
        description: 'Cansa, mas mostra presença.',
        outcomes: sure('A sugestão funcionou, e o paddock comentou de quem tinha sido a ideia.', fx('reputation', 1), fx('morale', -1)),
      },
      {
        id: 'deixar-a-decisao',
        label: 'Deixar a decisão com {pupilo}',
        description: 'Aprender a decidir também é treino.',
        outcomes: [
          { odds: 'even', text: 'A escolha deu certo, e a confiança de {pupilo} cresceu a olhos vistos.', effects: [fx('morale', 2)] },
          { odds: 'rest', text: 'O acerto não funcionou, e a conversa do dia seguinte foi longa.', effects: [fx('morale', -1)] },
        ],
      },
    ],
  },
  {
    id: 'atrito-nos-boxes',
    role: 'mentor',
    title: 'Atrito nos boxes',
    body: '{pupilo} discutiu com o engenheiro da equipe, e o chefe pede a sua ajuda para esfriar os ânimos.',
    choices: [
      {
        id: 'mediar',
        label: 'Mediar a conversa',
        description: 'Paciência dos dois lados.',
        outcomes: sure('A conversa a três desfez o mal-entendido, e o chefe agradeceu.', fx('reputation', 1)),
      },
      {
        id: 'tomar-partido',
        label: 'Tomar o partido de {pupilo}',
        description: 'Lealdade a quem você acompanha, contra a equipe.',
        outcomes: [
          { odds: 'even', text: 'O engenheiro reconheceu o erro, e a equipe passou a ouvir mais {pupilo}.', effects: [fx('reputation', 1), fx('morale', 1)] },
          { odds: 'rest', text: 'A equipe não gostou da interferência, e o clima azedou.', effects: [fx('reputation', -2)] },
        ],
      },
    ],
  },
  {
    id: 'nome-emprestado',
    role: 'mentor',
    title: 'Nome emprestado',
    body: 'Uma empresa conhecida sua toparia patrocinar {pupilo}, se você aparecer na campanha.',
    choices: [
      {
        id: 'aparecer-na-campanha',
        label: 'Aparecer na campanha',
        description: 'O seu nome ajuda quem está começando.',
        outcomes: sure('A campanha saiu, e o seu nome ficou ligado a uma promessa das pistas.', fx('reputation', 1)),
      },
      {
        id: 'nao-misturar',
        label: 'Não misturar as coisas',
        description: 'A mentoria fica longe dos anúncios.',
        outcomes: sure('A empresa procurou outro rosto, e a oportunidade escapou.', fx('morale', -1)),
      },
    ],
  },
  {
    id: 'vontade-de-largar-tudo',
    role: 'mentor',
    title: 'Vontade de largar tudo',
    body: 'Depois de uma sequência ruim, {pupilo} fala em largar as pistas.',
    choices: [
      {
        id: 'conversar-a-noite-toda',
        label: 'Conversar a noite toda',
        description: 'Uma boa conversa pode mudar a cabeça de quem está no fundo do poço.',
        outcomes: [
          { odds: 'likely', text: 'A conversa entrou pela madrugada, e {pupilo} voltou à pista com outra cabeça.', effects: [fx('reputation', 1)] },
          { odds: 'rest', text: 'Nada do que você disse pareceu adiantar, e a noite em claro cobrou o preço.', effects: [fx('morale', -2)] },
        ],
      },
      {
        id: 'dar-um-tempo',
        label: 'Dar um tempo para a poeira baixar',
        description: 'Às vezes, o silêncio ajuda mais.',
        outcomes: sure('{pupilo} passou uns dias longe de tudo e voltou sem tocar no assunto.', fx('morale', 1)),
      },
    ],
  },
  {
    id: 'mais-uma-viagem',
    role: 'mentor',
    needs: 'partner',
    title: 'Mais uma viagem',
    body: 'A temporada de {pupilo} pede mais viagens do que o combinado, e em casa a sua ausência começa a pesar.',
    choices: [
      {
        id: 'viajar-de-novo',
        label: 'Viajar de novo',
        description: 'O trabalho primeiro.',
        outcomes: sure('Você esteve no box em todas as corridas, e as ligações para casa ficaram mais curtas.', fx('reputation', 1), fx('relationship', -2)),
      },
      {
        id: 'acompanhar-pela-tv',
        label: 'Acompanhar desta vez pela TV',
        description: 'A casa agradece; o box sente falta.',
        outcomes: sure('O fim de semana em casa fez bem a todos, e {pupilo} mandou mensagem a cada sessão.', fx('relationship', 2), fx('morale', 1)),
      },
    ],
  },
  {
    id: 'a-imprensa-descobriu',
    role: 'mentor',
    title: 'A imprensa descobriu',
    body: 'Jornalistas descobriram quanto tempo você passa com {pupilo} e querem uma entrevista sobre a mentoria.',
    choices: [
      {
        id: 'dar-a-entrevista',
        label: 'Dar a entrevista',
        description: 'Holofote para os dois.',
        outcomes: sure('A reportagem mostrou o trabalho silencioso por trás dos resultados de {pupilo}.', fx('reputation', 2)),
      },
      {
        id: 'manter-a-discricao',
        label: 'Manter a discrição',
        description: 'O trabalho continua longe das câmeras.',
        outcomes: sure('Você recusou com educação, e os treinos seguiram em paz.', fx('morale', 1)),
      },
    ],
  },
  {
    id: 'ciumes-em-casa',
    role: 'mentor',
    needs: 'children',
    title: 'Ciúmes em casa',
    body: 'As crianças reclamam que você passa mais tempo com {pupilo} do que com o resto da família.',
    choices: [
      {
        id: 'levar-as-criancas',
        label: 'Levar as crianças a um treino',
        description: 'Um dia de pista para todo mundo.',
        outcomes: sure('As crianças passaram o dia no box e voltaram falando de corrida sem parar.', fx('bond', 2)),
      },
      {
        id: 'explicar-que-e-trabalho',
        label: 'Explicar que é trabalho',
        description: 'Um dia elas vão entender.',
        outcomes: sure('A explicação foi aceita, mas sem muito entusiasmo.', fx('bond', -1)),
      },
    ],
  },
];
