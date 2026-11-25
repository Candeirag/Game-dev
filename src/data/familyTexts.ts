/**
 * Textos dos eventos de família (começo de temporada), em variantes (Fase 5).
 *
 * Cada tipo de evento (conhecer alguém, casamento, crise, filho, kart do filho, carreira do filho)
 * tem várias variantes de texto inteiro. A cada vez que o evento aparece para o mesmo personagem,
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

export const FAMILY_EVENT_TEXTS: {
  readonly partner: readonly ((p: PartnerParams) => PartnerText)[];
  readonly wedding: readonly ((p: WeddingParams) => WeddingText)[];
  readonly crisis: readonly ((p: CrisisParams) => CrisisText)[];
  readonly child: readonly ((p: ChildParams) => ChildText)[];
  readonly kart: readonly ((p: KartParams) => KartText)[];
  readonly career: readonly ((p: CareerParams) => ChildCareerText)[];
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
};
