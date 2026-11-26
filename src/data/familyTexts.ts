/**
 * Textos dos eventos de família (começo de temporada), em variantes (Fase 5).
 *
 * Cada tipo de evento (conhecer alguém, casamento, crise, filho, kart do filho, carreira do filho e,
 * desde a Fase 6, o teste no kart do filho) tem várias variantes de texto inteiro. A cada vez que o evento aparece para o mesmo personagem,
 * sai a variante seguinte (a memória das histórias guarda quais já saíram): nenhum texto se repete
 * na carreira. Quando as variantes acabam, o evento deixa de aparecer para aquele personagem.
 *
 * Só palavras: os valores (custos, partilha do divórcio, idades) chegam prontos nos parâmetros e os
 * números de equilíbrio estão em FAMILY (`src/data/family.ts`). Acrescente variantes no fim de cada
 * lista. O jogo não sabe o gênero do piloto nem do parceiro: as variantes novas evitam adjetivo com
 * gênero para "você" e para o parceiro.
 */

export interface FamilyChoiceText {
  label: string;
  description: string;
}

/** Conhecer alguém. */
export interface PartnerParams {
  first: string;
  full: string;
  age: number;
  /** Profissão ou origem, em minúsculas ("médica", "arquiteto"), e a frase que a explica. */
  background: string;
  description: string;
}
export interface PartnerText {
  title: string;
  body: string;
  date: FamilyChoiceText & { text: string };
  focus: FamilyChoiceText & { text: string };
}

/** Casamento em pauta. */
export interface WeddingParams {
  first: string;
  /** "3 temporadas". */
  together: string;
  /** Partilha do divórcio, em %. */
  share: number;
  party: string;
  simple: string;
}
export interface WeddingText {
  title: string;
  body: string;
  party: FamilyChoiceText & { text: string };
  simple: FamilyChoiceText & { text: string };
  wait: FamilyChoiceText & { text: string };
}

/** Crise no relacionamento. */
export interface CrisisParams {
  first: string;
  married: boolean;
  share: number;
  therapy: string;
  trip: string;
}
export interface CrisisText {
  title: string;
  body: string;
  therapy: FamilyChoiceText & { better: string; partial: string };
  trip: FamilyChoiceText & { text: string };
  ignore: FamilyChoiceText & { broke: string; distant: string };
}

/** Aumentar a família. */
export interface ChildParams {
  first: string;
  firstChild: boolean;
  baby: string;
}
export interface ChildText {
  title: string;
  body: string;
  yes: FamilyChoiceText & { text: string };
  no: FamilyChoiceText & { text: string };
}

/** O filho quer andar de kart. */
export interface KartParams {
  child: string;
  age: number;
  until: number;
  perYear: number;
  full: string;
  basic: string;
}
export interface KartText {
  title: string;
  body: string;
  full: FamilyChoiceText & { text: string };
  basic: FamilyChoiceText & { text: string };
  none: FamilyChoiceText & { text: string };
}

/** O filho quer ser piloto. */
export interface CareerParams {
  child: string;
  age: number;
  traits: string;
  /** "3,0 anos". */
  base: string;
  seatLow: string;
  seatHigh: string;
}
export interface ChildCareerText {
  title: string;
  body: string;
  full: FamilyChoiceText & { text: string };
  basic: FamilyChoiceText & { text: string };
  none: FamilyChoiceText & { text: string };
  forbid: FamilyChoiceText & { text: string };
}

/** O teste no kart da adolescência (Fase 6). */
export interface KartTestParams {
  child: string;
  age: number;
  /** Custos do teste completo e do rápido, já formatados. */
  full: string;
  quick: string;
}
export interface KartTestText {
  title: string;
  body: string;
  full: FamilyChoiceText & { text: string };
  quick: FamilyChoiceText & { text: string };
  skip: FamilyChoiceText & { text: string };
}

export const FAMILY_EVENT_TEXTS: {
  readonly partner: readonly ((p: PartnerParams) => PartnerText)[];
  readonly wedding: readonly ((p: WeddingParams) => WeddingText)[];
  readonly crisis: readonly ((p: CrisisParams) => CrisisText)[];
  readonly child: readonly ((p: ChildParams) => ChildText)[];
  readonly kart: readonly ((p: KartParams) => KartText)[];
  readonly career: readonly ((p: CareerParams) => ChildCareerText)[];
  readonly kartTest: readonly ((p: KartTestParams) => KartTestText)[];
} = {
  partner: [
    (p) => ({
      title: `Você conheceu ${p.first}`,
      body: `Em um evento fora das pistas, você conheceu ${p.full}, ${p.age} anos (${p.background}). ${p.description} Um relacionamento toma tempo e atenção, mas quem tem a vida pessoal em ordem corre com a cabeça mais leve.`,
      date: {
        label: 'Investir no relacionamento',
        description: 'Vocês começam a namorar. Menos tempo livre: a fase cai um pouco agora.',
        text: `Você e ${p.first} estão juntos.`,
      },
      focus: { label: 'Focar só na carreira', description: 'Nada muda na rotina.', text: 'Você preferiu não se envolver agora.' },
    }),
    (p) => ({
      title: `${p.first} cruzou o seu caminho`,
      body: `Numa escala de voo depois de uma corrida, você puxou conversa com ${p.full}, ${p.age} anos, da área de ${p.background}. ${p.description} O papo durou o atraso inteiro. Namorar com o calendário cheio exige jogo de cintura.`,
      date: {
        label: 'Marcar um segundo encontro',
        description: 'O namoro começa. Sobra menos tempo para treinar, e a fase cai um pouco de imediato.',
        text: `${p.first} aceitou, e o namoro começou.`,
      },
      focus: { label: 'Deixar o telefone guardado', description: 'A rotina segue igual.', text: 'O número ficou na agenda, sem mensagem.' },
    }),
    (p) => ({
      title: 'Visita inesperada no box',
      body: `No fim de um treino, ${p.full}, ${p.age} anos, apareceu no box com um amigo em comum. Trabalha com ${p.background}. ${p.description} Vocês trocaram telefone na saída do autódromo. A temporada é longa, e a saudade de casa também.`,
      date: {
        label: 'Convidar para jantar',
        description: 'Começa um namoro. A agenda aperta, e a fase baixa um pouco já no começo da temporada.',
        text: `O jantar virou namoro: você e ${p.first} formam um casal.`,
      },
      focus: { label: 'Voltar cedo para o hotel', description: 'Tudo continua como antes.', text: 'O telefone ficou sem resposta.' },
    }),
    (p) => ({
      title: `Reencontro com ${p.first}`,
      body: `Nas férias entre temporadas, de volta à sua cidade, você reencontrou ${p.full}, ${p.age} anos, que morava a duas ruas da sua casa. Hoje trabalha com ${p.background}. ${p.description} Parece que o tempo não passou.`,
      date: {
        label: 'Retomar o contato',
        description: 'Vocês começam a namorar. O tempo dividido custa um pouco de fase agora.',
        text: `Entre uma viagem e outra, você e ${p.first} começaram a namorar.`,
      },
      focus: {
        label: 'Deixar como lembrança',
        description: 'Nada se altera na sua rotina.',
        text: `Foi bom rever ${p.first}, mas ficou só na lembrança.`,
      },
    }),
    (p) => ({
      title: `${p.first} chamou a sua atenção`,
      body: `Numa corrida beneficente de kart, ${p.full}, ${p.age} anos, terminou na sua frente e não deixou barato na premiação. Atua na área de ${p.background}. ${p.description} Vocês riram a tarde toda. Há meses a sua vida é só pista e hotel.`,
      date: {
        label: 'Pedir revanche num jantar',
        description: 'Começa o namoro. Com a cabeça longe do carro, a fase recua um pouco por enquanto.',
        text: `A revanche ficou para depois: você e ${p.first} agora namoram.`,
      },
      focus: { label: 'Agradecer e ir embora', description: 'Sua semana segue sem mudança.', text: 'Você voltou para os treinos sem olhar para trás.' },
    }),
    (p) => ({
      title: `Alguém especial: ${p.first}`,
      body: `No aniversário de um mecânico da equipe, você dividiu a mesa com ${p.full}, ${p.age} anos, que trabalha com ${p.background}. ${p.description} A noite passou rápido demais. Só que a próxima corrida é do outro lado do país.`,
      date: {
        label: 'Ligar no dia seguinte',
        description: 'Nasce um namoro, e a atenção se divide: a fase perde um pouco neste começo.',
        text: `A ligação virou rotina: você e ${p.first} assumiram o namoro.`,
      },
      focus: { label: 'Pensar só na próxima corrida', description: 'Nenhuma mudança por enquanto.', text: 'Você embarcou para a próxima etapa sem ligar.' },
    }),
  ],
  wedding: [
    (p) => ({
      title: 'Casamento em pauta',
      body: `Você e ${p.first} estão juntos há ${p.together} e o assunto casamento apareceu. O casamento dá estabilidade (a relação se desgasta menos), mas, em um divórcio, o cônjuge fica com ${p.share}% do patrimônio.`,
      party: { label: 'Casar com festa', description: `Custa ${p.party}.`, text: `Você e ${p.first} se casaram em uma grande festa.` },
      simple: { label: 'Cerimônia simples', description: `Custa ${p.simple}.`, text: `Você e ${p.first} se casaram em uma cerimônia íntima.` },
      wait: { label: 'Adiar', description: 'A relação esfria um pouco.', text: `${p.first} entendeu, mas a frustração ficou no ar.` },
    }),
    (p) => ({
      title: 'Hora de oficializar?',
      body: `Depois de ${p.together} entre aeroportos e autódromos, ${p.first} quer saber se vocês vão oficializar. Casar traz estabilidade: o desgaste do dia a dia pesa menos. O outro lado: num divórcio, ${p.share}% do patrimônio iria para ${p.first}.`,
      party: {
        label: 'Festa para a família toda',
        description: `Casamento com festa e convidados: custa ${p.party}.`,
        text: `O casamento com ${p.first} lotou o salão, e a pista de dança foi até o amanhecer.`,
      },
      simple: {
        label: 'Só os mais próximos',
        description: `Cerimônia pequena no cartório e almoço em família: custa ${p.simple}.`,
        text: `No cartório, com poucos convidados, você e ${p.first} disseram sim.`,
      },
      wait: {
        label: 'Esperar o fim da temporada',
        description: 'Adiar o casamento esfria um pouco a relação.',
        text: `${p.first} disse que espera, mas a resposta saiu baixinho.`,
      },
    }),
    (p) => ({
      title: `${p.first} e o futuro a dois`,
      body: `Num domingo raro em casa, ${p.first} puxou o assunto: depois de ${p.together}, por que não casar? O casamento deixa a relação mais firme. Mas, se um dia acabar, ${p.share}% do seu patrimônio fica com ${p.first}.`,
      party: {
        label: 'Celebrar em grande estilo',
        description: `Festão com banda e pista de dança: custa ${p.party}.`,
        text: `Com banda, bolo enorme e a equipe inteira, você e ${p.first} oficializaram a união.`,
      },
      simple: {
        label: 'Casar no quintal de casa',
        description: `Cerimônia simples no quintal, só com a família: custa ${p.simple}.`,
        text: `Debaixo das árvores do quintal, você e ${p.first} trocaram alianças.`,
      },
      wait: {
        label: 'Pedir mais tempo',
        description: 'Fica para depois. A relação perde um pouco de calor.',
        text: `${p.first} aceitou esperar, mas o domingo terminou em silêncio.`,
      },
    }),
  ],
  crisis: [
    (p) => ({
      title: 'Crise no relacionamento',
      body: `A relação com ${p.first} vai mal: muitas viagens, pouca presença. Enquanto isso durar, a sua moral cai a cada etapa.${p.married ? ` Um divórcio custaria ${p.share}% do seu patrimônio.` : ''}`,
      therapy: {
        label: 'Dedicar tempo ao casal',
        description: `Terapia e mais dias em casa: custa ${p.therapy} e um pouco de fase.`,
        better: 'O esforço deu resultado: a relação melhorou muito.',
        partial: 'Houve alguma melhora, mas o problema continua.',
      },
      trip: { label: 'Viagem a dois', description: `Custa ${p.trip}.`, text: 'A viagem fez bem aos dois.' },
      ignore: {
        label: 'Deixar como está',
        description: 'Arriscado: a relação pode acabar.',
        broke: p.married ? `${p.first} pediu o divórcio.` : `${p.first} terminou o relacionamento.`,
        distant: 'Vocês seguem juntos, cada vez mais distantes.',
      },
    }),
    (p) => ({
      title: `${p.first} anda distante`,
      body: `As ligações com ${p.first} ficaram curtas, e as brigas, longas. A cada corrida fora, a distância cresce. Enquanto a crise durar, a moral cai etapa após etapa.${p.married ? ` Se terminar em divórcio, ${p.share}% do patrimônio vai embora.` : ''}`,
      therapy: {
        label: 'Procurar terapia de casal',
        description: `Sessões de terapia e folgas em casa: custa ${p.therapy}, e a fase sente um pouco.`,
        better: 'As sessões destravaram conversas antigas, e a relação ganhou fôlego novo.',
        partial: 'Algumas feridas fecharam, outras seguem abertas.',
      },
      trip: {
        label: 'Fugir uns dias a dois',
        description: `Uma viagem só de vocês: custa ${p.trip}.`,
        text: 'Longe do celular e do autódromo, vocês voltaram a dar risada.',
      },
      ignore: {
        label: 'Esperar a poeira baixar',
        description: 'Arriscado: pode ser o fim da relação.',
        broke: p.married ? `${p.first} saiu de casa e pediu o divórcio.` : `${p.first} pôs um ponto final no namoro.`,
        distant: 'A crise não explodiu, mas a casa ficou mais silenciosa.',
      },
    }),
    (p) => ({
      title: 'A casa ficou fria',
      body: `Você passa mais noites em hotel do que em casa, e ${p.first} cansou de jantar com o celular. Cada conversa vira cobrança. Enquanto não houver solução, a sua moral desce a cada etapa.${p.married ? ` Um divórcio levaria ${p.share}% do que você construiu.` : ''}`,
      therapy: {
        label: 'Pausar e cuidar da relação',
        description: `Terapia e uma pausa longa em casa: custa ${p.therapy} e tira um pouco da fase.`,
        better: `Com ajuda e presença, ${p.first} voltou a sorrir quando você chega.`,
        partial: 'As cobranças diminuíram, mas ainda pesam.',
      },
      trip: {
        label: `Levar ${p.first} para a praia`,
        description: `Uma semana a dois no litoral: custa ${p.trip}.`,
        text: 'O mar fez o que as palavras não faziam.',
      },
      ignore: {
        label: 'Seguir a rotina de viagens',
        description: 'Arriscado: a relação pode não resistir.',
        broke: p.married ? `A papelada chegou: ${p.first} quer o divórcio.` : `${p.first} decidiu que o namoro acabou.`,
        distant: 'Ninguém saiu de casa, mas as conversas quase sumiram.',
      },
    }),
    (p) => ({
      title: `Briga feia com ${p.first}`,
      body: `Foi uma briga daquelas, por telefone, na véspera de uma corrida. ${p.first} diz que a pista sempre vem primeiro. Enquanto a crise seguir, a moral baixa em toda etapa.${p.married ? ` Se o casamento acabar, ${p.first} fica com ${p.share}% do patrimônio.` : ''}`,
      therapy: {
        label: 'Prometer presença e terapia',
        description: `Terapia de casal e mais noites em casa: custa ${p.therapy} e derruba um pouco a fase.`,
        better: 'A promessa foi cumprida, e a confiança voltou inteira.',
        partial: `${p.first} percebe o esforço, mas ainda desconfia.`,
      },
      trip: {
        label: 'Uma viagem para recomeçar',
        description: `Dias a dois longe das pistas: custa ${p.trip}.`,
        text: 'Na volta da viagem, a briga já parecia coisa do passado.',
      },
      ignore: {
        label: 'Pôr o capacete e seguir',
        description: 'Arriscado: o relacionamento pode terminar.',
        broke: p.married ? `Sem conversa, ${p.first} entrou com o pedido de divórcio.` : `Sem conversa, o namoro com ${p.first} chegou ao fim.`,
        distant: 'A briga esfriou, mas a distância entre vocês aumentou.',
      },
    }),
  ],
  child: [
    (p) => ({
      title: 'Aumentar a família?',
      body: `Você e ${p.first} conversam sobre ter ${p.firstChild ? 'o primeiro filho' : 'mais um filho'}. Um filho herda parte do seu talento e pode continuar a história da família nas pistas, mas a criação e, mais tarde, a carreira dele custam caro.`,
      yes: { label: 'Ter um filho', description: 'A família cresce.', text: `Nasceu ${p.baby}.` },
      no: { label: 'Ainda não', description: `${p.first} queria; a relação sente.`, text: 'Vocês decidiram esperar.' },
    }),
    (p) => ({
      title: 'Um bebê nos planos?',
      body: `${p.first} mostra um macacão de corrida minúsculo, presente da equipe, e pergunta se é hora de ${p.firstChild ? 'ter o primeiro bebê' : 'ter mais um bebê'}. Uma criança pode herdar o seu talento e levar o nome da família às pistas. Criar, porém, custa caro.`,
      yes: { label: 'Começar o enxoval', description: 'A família ganha mais alguém.', text: `${p.baby} nasceu e já estreou o macacão.` },
      no: {
        label: 'Guardar o macacão por enquanto',
        description: `Esperar mais um pouco. ${p.first} sonhava com isso, e a relação sente.`,
        text: 'O macacão voltou para a gaveta, à espera.',
      },
    }),
    (p) => ({
      title: 'Conversa na varanda',
      body: `Na varanda, depois de um churrasco com a equipe, ${p.first} fala ${p.firstChild ? 'em ter uma criança' : 'em mais uma criança'}. Alguém para herdar o seu dom e, quem sabe, correr um dia. Só que fraldas, escola e, depois, kart pesam no bolso.`,
      yes: { label: 'Começar a lista de nomes', description: 'Chega mais alguém para a família.', text: `${p.baby} nasceu numa madrugada de chuva.` },
      no: {
        label: 'Deixar para outra fase da vida',
        description: `Vocês esperam. ${p.first} queria agora, e o adiamento pesa na relação.`,
        text: 'A conversa terminou com um "mais para frente".',
      },
    }),
    (p) => ({
      title: 'A família pode crescer',
      body: `Do outro lado do telefone, ${p.first} conta que sonhou com ${p.firstChild ? 'uma criança' : 'mais uma criança'} correndo pela casa. Talento passa de geração em geração, e a história da família pode seguir nas pistas. Só que a conta da criação vem junto.`,
      yes: { label: 'Realizar o sonho', description: 'A família ganha um bebê.', text: `${p.baby} veio ao mundo, e o sonho virou fralda e noite em claro.` },
      no: { label: 'Pedir para esperar', description: `Fica para depois. ${p.first} sente, e a relação também.`, text: 'Vocês combinaram adiar o sonho.' },
    }),
    (p) => ({
      title: 'Quarto vazio',
      body: `A casa tem um quarto sem uso, e ${p.first} já imagina ${p.firstChild ? 'um berço ali' : 'outro berço ali'}. Uma criança pode puxar o seu talento ao volante, mas viagens, saudade e despesas vêm no pacote.`,
      yes: { label: 'Montar o berço', description: 'A família vai ganhar mais um membro.', text: `${p.baby} nasceu, e o quarto vazio ganhou choro e risada.` },
      no: {
        label: 'Manter o quarto como escritório',
        description: `Por ora, nada de bebê. ${p.first} queria, e a relação sofre um pouco.`,
        text: 'O quarto continua com a mesa e os troféus.',
      },
    }),
    (p) => ({
      title: 'Mais alguém na família?',
      body: `No almoço de domingo, a família pergunta, de novo, quando vem ${p.firstChild ? 'a primeira criança' : 'a próxima criança'}. ${p.first} olha para você e sorri. Ter alguém para passar o capacete adiante seria lindo, mas a criação exige tempo e dinheiro.`,
      yes: { label: 'Responder com um anúncio', description: 'A família aumenta.', text: `Meses depois, ${p.baby} nasceu e roubou a cena no almoço.` },
      no: {
        label: 'Mudar de assunto',
        description: `Não por agora. ${p.first} esperava outra resposta, e a relação se ressente.`,
        text: 'O almoço seguiu, e o assunto ficou no ar.',
      },
    }),
  ],
  kart: [
    (p) => ({
      title: `${p.child} quer andar de kart`,
      body: `${p.child} fez ${p.age} anos e pede um kart. A formação vai até os ${p.until} anos: cada ano bem feito vale cerca de ${p.perYear} pontos em todos os atributos quando a carreira começar, e mantém a vontade de correr.`,
      full: {
        label: 'Programa completo',
        description: `${p.full} por ano: equipe, treinador e campeonatos.`,
        text: `${p.child} começou um programa completo de kart.`,
      },
      basic: {
        label: 'Kart de fim de semana',
        description: `${p.basic} por ano: rende 60% da formação completa.`,
        text: `${p.child} começou a correr nos fins de semana.`,
      },
      none: { label: 'Agora não', description: 'Sem custo. A vontade de correr diminui a cada ano.', text: `A decepção de ${p.child} durou a semana inteira.` },
    }),
    (p) => ({
      title: `${p.child} não sai do kartódromo`,
      body: `Desde que fez ${p.age} anos, ${p.child} pede para ir ao kartódromo todo fim de semana. Há tempo de formação até os ${p.until} anos. Cada temporada bem aproveitada soma uns ${p.perYear} pontos a cada atributo na estreia e mantém acesa a vontade de correr.`,
      full: {
        label: 'Equipe, treinador e campeonato',
        description: `Formação completa por ${p.full} ao ano: estrutura de equipe e calendário cheio.`,
        text: `${p.child} ganhou macacão, equipe e um treinador só seu.`,
      },
      basic: {
        label: 'Treinar só aos sábados',
        description: `${p.basic} ao ano, com treinos aos sábados: rende menos que a formação completa.`,
        text: `Todo sábado, ${p.child} vai treinar no kartódromo.`,
      },
      none: {
        label: 'Ainda não comprar o kart',
        description: 'Nada se gasta, mas a vontade de correr esfria a cada ano.',
        text: `${p.child} entendeu o não, mas a decepção ficou no rosto.`,
      },
    }),
    (p) => ({
      title: `O pedido de ${p.child}`,
      body: `No aniversário de ${p.age} anos, ${p.child} assoprou as velas e pediu um kart. Dá para treinar até os ${p.until} anos, e cada ano bem treinado vale perto de ${p.perYear} pontos por atributo no começo da carreira, além de manter a paixão pelas pistas.`,
      full: {
        label: 'Montar um programa de verdade',
        description: `${p.full} anuais com equipe, treinador e todas as provas do ano.`,
        text: `${p.child} entrou numa equipe de kart, com treinador e calendário completo.`,
      },
      basic: {
        label: 'Kart só aos domingos',
        description: `${p.basic} anuais, com corridas aos domingos. Rende menos que o programa completo.`,
        text: `${p.child} agora acorda cedo todo domingo para andar de kart.`,
      },
      none: {
        label: 'Trocar o kart por outro presente',
        description: 'Sai de graça, mas a vontade de correr enfraquece com os anos.',
        text: `${p.child} abriu outro presente, mas a vontade era o kart.`,
      },
    }),
    (p) => ({
      title: `${p.child} sonha com um kart`,
      body: `${p.child}, ${p.age} anos, assiste às suas corridas com o nariz na tela e já pede um kart. Até os ${p.until} anos, cada ano de treino sério rende por volta de ${p.perYear} pontos em cada atributo quando chegar a hora de estrear. E a vontade de correr continua viva.`,
      full: {
        label: 'Investir na formação inteira',
        description: `${p.full} por temporada: equipe, treinador e campeonatos regionais.`,
        text: `${p.child} já tem equipe, treinador e um número na carenagem.`,
      },
      basic: {
        label: 'Kart de lazer nos fins de semana',
        description: `${p.basic} por temporada, só nos fins de semana: rende menos que a formação inteira.`,
        text: `${p.child} passou a correr de kart aos sábados e domingos.`,
      },
      none: {
        label: 'Adiar o kart',
        description: 'Nenhum gasto. A cada ano, cai a vontade de correr.',
        text: `${p.child} guardou o capacete de brinquedo no fundo do armário.`,
      },
    }),
  ],
  career: [
    (p) => ({
      title: `${p.child} quer ser piloto`,
      body: `${p.child} tem ${p.age} anos, é ${p.traits} e quer disputar o kart regional. A formação no kart rendeu ${p.base} de base. Uma vaga custa de ${p.seatLow} a ${p.seatHigh} por temporada, e o custo sobe muito nos degraus seguintes. O apoio da família define em que equipe ele começa e se consegue pagar as promoções.`,
      full: {
        label: 'Bancar a carreira',
        description: 'A família paga o que os patrocinadores dele não cobrirem.',
        text: `${p.child} estreia no kart regional com apoio total.`,
      },
      basic: { label: 'Ajudar com metade', description: 'A família paga até metade da vaga.', text: `${p.child} estreia no kart regional com ajuda parcial.` },
      none: {
        label: 'Que conquiste por conta própria',
        description: 'Sem dinheiro da família: depende de bolsas e patrocinadores.',
        text: `${p.child} vai tentar a sorte por conta própria.`,
      },
      forbid: { label: 'Proibir', description: `${p.child} segue outro caminho. A relação sofre.`, text: `${p.child} desistiu das pistas, com mágoa.` },
    }),
    (p) => ({
      title: `${p.child} quer correr de verdade`,
      body: `Aos ${p.age} anos, ${p.child} pede uma vaga no kart regional. Na ficha dos técnicos: ${p.traits}. Base de kart: ${p.base}. A vaga sai de ${p.seatLow} a ${p.seatHigh} por temporada e encarece a cada degrau. O apoio da família decide a equipe da estreia e se dá para subir.`,
      full: {
        label: 'Assumir os custos',
        description: 'A família cobre tudo o que os patrocinadores não pagarem.',
        text: `${p.child} chega ao kart regional com a família bancando cada etapa.`,
      },
      basic: {
        label: 'Pagar metade da vaga',
        description: 'A família entra com até metade do valor da vaga.',
        text: `Com metade da vaga paga pela família, ${p.child} faz a estreia no kart regional.`,
      },
      none: {
        label: 'Sem ajuda da família',
        description: 'Nenhum dinheiro de casa: só bolsas e patrocinadores.',
        text: `${p.child} vai bater de porta em porta atrás de patrocínio.`,
      },
      forbid: {
        label: 'Vetar a carreira',
        description: `Outro caminho para ${p.child}, longe das pistas. A relação fica abalada.`,
        text: `${p.child} largou o capacete e não fala mais de corrida. A mágoa ficou.`,
      },
    }),
    (p) => ({
      title: `O sonho de ${p.child}`,
      body: `${p.child} completou ${p.age} anos e quer estrear no kart regional. No caderno do treinador: ${p.traits}. O kart deixou ${p.base} de base. Cada temporada custa de ${p.seatLow} a ${p.seatHigh}, e os degraus seguintes, bem mais. A ajuda da família define a equipe da estreia e o fôlego para subir.`,
      full: {
        label: 'Apostar tudo no sonho',
        description: 'O que os patrocinadores não cobrirem sai do caixa da família.',
        text: `Sem se preocupar com a conta, ${p.child} vai para a primeira temporada no kart regional.`,
      },
      basic: {
        label: 'Dividir a vaga meio a meio',
        description: 'A família arca com até metade da vaga.',
        text: `${p.child} vai para o kart regional dividindo a conta com a família.`,
      },
      none: {
        label: 'Correr atrás do próprio patrocínio',
        description: 'Nenhum centavo da família: a vaga depende de bolsas e patrocínio.',
        text: `${p.child} montou uma pasta com fotos e resultados e saiu atrás de patrocinadores.`,
      },
      forbid: {
        label: 'Proibir as pistas',
        description: `${p.child} terá de seguir outro rumo. O laço com você enfraquece.`,
        text: `${p.child} obedeceu, mas evita falar com você sobre corridas.`,
      },
    }),
    (p) => ({
      title: `${p.child} pede uma vaga`,
      body: `${p.child}, ${p.age} anos, sentou com você na garagem e pediu para correr o kart regional. Perfil de pista: ${p.traits}. Kart na bagagem: ${p.base}. A vaga varia entre ${p.seatLow} e ${p.seatHigh} por temporada; depois, tudo encarece. A ajuda de casa decide a equipe e as promoções.`,
      full: {
        label: 'Dar respaldo total',
        description: 'Tudo o que faltar depois dos patrocinadores, a família paga.',
        text: `${p.child} assina a primeira ficha no kart regional com a família por trás.`,
      },
      basic: {
        label: 'Cobrir parte da vaga',
        description: 'Até a metade da vaga sai do bolso da família.',
        text: `${p.child} entra no kart regional com meia vaga paga pela família.`,
      },
      none: {
        label: 'Nada de dinheiro de casa',
        description: 'A família não põe dinheiro: tudo depende de bolsas e patrocinadores.',
        text: `${p.child} aceita o desafio de achar quem pague a vaga.`,
      },
      forbid: {
        label: 'Não deixar correr',
        description: `${p.child} vai buscar outro futuro. O vínculo entre vocês sai abalado.`,
        text: `${p.child} arquivou o sonho de correr e se afastou um pouco de você.`,
      },
    }),
  ],
  kartTest: [
    (p) => ({
      title: `Teste no kart para ${p.child}`,
      body: `${p.child} fez ${p.age} anos, e uma escola de pilotagem oferece um dia de teste com instrutores, cronômetro e telemetria. É a primeira vez que alguém de fora vai medir o que a criança traz de nascença: talentos e defeitos que ninguém viu ainda.`,
      full: {
        label: 'Teste completo',
        description: `Um dia inteiro com os instrutores: custa ${p.full} e mostra mais.`,
        text: `${p.child} passou o dia no kartódromo com os instrutores.`,
      },
      quick: {
        label: 'Só uma tarde',
        description: `Uma tarde de voltas cronometradas: custa ${p.quick} e mostra menos.`,
        text: `${p.child} fez uma tarde de voltas cronometradas.`,
      },
      skip: { label: 'Deixar para lá', description: 'Sem custo, mas a decepção pesa no vínculo.', text: `${p.child} ficou em casa, de cara amarrada.` },
    }),
    (p) => ({
      title: `O cronômetro espera por ${p.child}`,
      body: `Um instrutor conhecido da família ligou: quer ver ${p.child}, ${p.age} anos, numa sessão de avaliação no kartódromo. Ninguém sabe ainda se a criança tem jeito para a chuva, para largar ou para poupar pneus; um teste de verdade começa a responder.`,
      full: {
        label: 'Avaliação de um dia inteiro',
        description: `Instrutores, telemetria e várias baterias: ${p.full}. Revela mais coisas.`,
        text: `Do café da manhã ao pôr do sol, ${p.child} acelerou sob o olhar dos instrutores.`,
      },
      quick: {
        label: 'Uma bateria rápida',
        description: `Poucas voltas e uma conversa no fim: ${p.quick}. Revela menos.`,
        text: `${p.child} fez uma bateria curta e voltou para casa sem parar de falar.`,
      },
      skip: {
        label: 'Agradecer e recusar',
        description: `Nada a pagar. ${p.child} esperava ir, e o vínculo sente.`,
        text: `O instrutor ficou sem resposta, e ${p.child} ficou sem o teste.`,
      },
    }),
    (p) => ({
      title: 'Dia de avaliação no kartódromo',
      body: `A associação de kart da região abriu um dia de avaliação para quem tem ${p.age} anos, e ${p.child} quer muito ir. Os instrutores medem o tempo de volta e anotam tudo: a reação na largada, o jeito de guiar no molhado, o cuidado com o equipamento.`,
      full: {
        label: 'Fazer a avaliação inteira',
        description: `Todas as baterias e o relatório escrito: ${p.full}. Mais respostas.`,
        text: `${p.child} correu todas as baterias e saiu com o relatório debaixo do braço.`,
      },
      quick: {
        label: 'Fazer só a primeira bateria',
        description: `Uma bateria e uma conversa rápida: ${p.quick}. Menos respostas.`,
        text: `${p.child} fez a primeira bateria e ouviu os comentários dos instrutores.`,
      },
      skip: {
        label: 'Não fazer a inscrição',
        description: `Sem custo. ${p.child} vai sentir a ausência, e o vínculo também.`,
        text: `A inscrição não foi feita, e ${p.child} passou o sábado olhando pela janela.`,
      },
    }),
    (p) => ({
      title: `${p.child} contra o relógio`,
      body: `Aos ${p.age} anos, ${p.child} pergunta quando vai poder andar num kart de verdade, com tempo marcado. Um treinador oferece um teste: é o jeito de descobrir, antes da carreira, o que vem de nascença e o que vai ser preciso treinar.`,
      full: {
        label: 'Teste com todos os exercícios',
        description: `Largadas, pista molhada e voltas longas: ${p.full}. Mostra mais.`,
        text: `${p.child} encarou largadas, pista molhada e voltas longas no mesmo dia.`,
      },
      quick: {
        label: 'Teste só de volta rápida',
        description: `Algumas voltas lançadas: ${p.quick}. Mostra menos.`,
        text: `${p.child} fez as voltas lançadas e quis mais.`,
      },
      skip: {
        label: 'Esperar mais um pouco',
        description: `Não custa nada, mas ${p.child} esperava esse dia, e o vínculo sente.`,
        text: `${p.child} ouviu o "mais para frente" e não insistiu.`,
      },
    }),
    (p) => ({
      title: `Convite para ${p.child}`,
      body: `Uma equipe de kart que procura talentos convidou ${p.child}, ${p.age} anos, para uma tarde de testes. O cronômetro não mente: é ali que aparecem os primeiros talentos e defeitos de quem ainda nem começou a correr.`,
      full: {
        label: 'Aceitar o teste completo',
        description: `Equipe, instrutores e um dia inteiro de pista: ${p.full}. Revela mais.`,
        text: `${p.child} passou o dia no box da equipe, de capacete na mão entre uma bateria e outra.`,
      },
      quick: {
        label: 'Aceitar só a tarde de voltas',
        description: `Uma tarde de pista: ${p.quick}. Revela menos.`,
        text: `${p.child} deu as voltas da tarde e voltou com o macacão sujo de borracha.`,
      },
      skip: {
        label: 'Recusar o convite',
        description: `Sem custo. ${p.child} queria ir, e o vínculo se ressente.`,
        text: `O convite ficou sem resposta, e ${p.child} guardou a mágoa.`,
      },
    }),
    (p) => ({
      title: `Hora de medir ${p.child}`,
      body: `${p.child} vive falando de kart, mas ninguém mediu o ritmo com seriedade. Com ${p.age} anos, é a idade certa para um teste com instrutores: dá para saber se há talento escondido, ou um defeito que vai custar caro lá na frente.`,
      full: {
        label: 'Pagar o teste completo',
        description: `Dia inteiro, com relatório e conversa com a família: ${p.full}. Mais detalhes.`,
        text: `${p.child} fez o teste completo, e a família ganhou um relatório de várias páginas.`,
      },
      quick: {
        label: 'Pagar a versão curta',
        description: `Uma tarde, com uma conversa no fim: ${p.quick}. Menos detalhes.`,
        text: `${p.child} fez a versão curta, e os instrutores resumiram tudo numa conversa de corredor.`,
      },
      skip: {
        label: 'Deixar o ritmo sem medida',
        description: `Sem gasto. ${p.child} se decepciona, e o vínculo cai um pouco.`,
        text: `${p.child} seguiu dando voltas por diversão, sem ninguém cronometrar.`,
      },
    }),
    (p) => ({
      title: `${p.child} pede um teste de verdade`,
      body: `No jantar, ${p.child}, ${p.age} anos, mostrou um anúncio: um centro de treinamento faz testes de pilotagem para adolescentes. A pergunta é uma só: leva jeito ou não? Um bom teste revela o que vem de berço, para o bem e para o mal.`,
      full: {
        label: 'Marcar o pacote completo',
        description: `Simulador, kart e avaliação física: ${p.full}. O retrato mais completo.`,
        text: `${p.child} passou pelo simulador, pelo kart e pela avaliação física num dia só.`,
      },
      quick: {
        label: 'Marcar só a parte do kart',
        description: `Só as voltas no kart: ${p.quick}. Um retrato parcial.`,
        text: `${p.child} fez só a parte do kart e saiu pedindo revanche contra o cronômetro.`,
      },
      skip: {
        label: 'Dizer que não é o momento',
        description: `Sem custo. ${p.child} esperava um sim, e o vínculo sofre.`,
        text: `${p.child} guardou o anúncio na gaveta.`,
      },
    }),
    (p) => ({
      title: `Primeiro teste de ${p.child}`,
      body: `O kartódromo da cidade vai receber instrutores de fora por um fim de semana. Eles testam jovens de ${p.age} anos e contam às famílias o que viram: quem nasce com talento costuma aparecer ali, e os defeitos também. ${p.child} já separou o macacão.`,
      full: {
        label: 'Inscrever para os dois dias',
        description: `Sábado e domingo com os instrutores: ${p.full}. Eles veem mais.`,
        text: `${p.child} passou o fim de semana inteiro com os instrutores.`,
      },
      quick: {
        label: 'Inscrever só para a tarde de sábado',
        description: `Algumas horas com os instrutores: ${p.quick}. Eles veem menos.`,
        text: `${p.child} andou na tarde de sábado e assistiu ao resto da arquibancada.`,
      },
      skip: {
        label: 'Pular o fim de semana dos instrutores',
        description: `Nada a pagar. ${p.child} vai ver os colegas irem, e o vínculo sente.`,
        text: `${p.child} viu os colegas irem ao teste e ficou em casa.`,
      },
    }),
  ],
};
