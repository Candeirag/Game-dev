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
  ],
  wedding: [
    (p) => ({
      title: 'Casamento em pauta',
      body: `Você e ${p.first} estão juntos há ${p.together} e o assunto casamento apareceu. O casamento dá estabilidade (a relação se desgasta menos), mas, em um divórcio, o cônjuge fica com ${p.share}% do patrimônio.`,
      party: { label: 'Casar com festa', description: `Custa ${p.party}.`, text: `Você e ${p.first} se casaram em uma grande festa.` },
      simple: { label: 'Cerimônia simples', description: `Custa ${p.simple}.`, text: `Você e ${p.first} se casaram em uma cerimônia íntima.` },
      wait: { label: 'Adiar', description: 'A relação esfria um pouco.', text: `${p.first} entendeu, mas ficou frustrado(a).` },
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
  ],
  child: [
    (p) => ({
      title: 'Aumentar a família?',
      body: `Você e ${p.first} conversam sobre ter ${p.firstChild ? 'o primeiro filho' : 'mais um filho'}. Um filho herda parte do seu talento e pode continuar a história da família nas pistas, mas a criação e, mais tarde, a carreira dele custam caro.`,
      yes: { label: 'Ter um filho', description: 'A família cresce.', text: `Nasceu ${p.baby}.` },
      no: { label: 'Ainda não', description: `${p.first} queria; a relação sente.`, text: 'Vocês decidiram esperar.' },
    }),
  ],
  kart: [
    (p) => ({
      title: `${p.child} quer andar de kart`,
      body: `${p.child} fez ${p.age} anos e pede um kart. A formação vai até os ${p.until} anos: cada ano bem feito vale cerca de ${p.perYear} pontos em todos os atributos quando a carreira começar, e mantém a vontade de correr.`,
      full: { label: 'Programa completo', description: `${p.full} por ano: equipe, treinador e campeonatos.`, text: `${p.child} começou um programa completo de kart.` },
      basic: { label: 'Kart de fim de semana', description: `${p.basic} por ano: rende 60% da formação completa.`, text: `${p.child} começou a correr nos fins de semana.` },
      none: { label: 'Agora não', description: 'Sem custo. A vontade de correr diminui a cada ano.', text: `${p.child} ficou decepcionado(a).` },
    }),
  ],
  career: [
    (p) => ({
      title: `${p.child} quer ser piloto`,
      body: `${p.child} tem ${p.age} anos, é ${p.traits} e quer disputar o kart regional. A formação no kart rendeu ${p.base} de base. Uma vaga custa de ${p.seatLow} a ${p.seatHigh} por temporada, e o custo sobe muito nos degraus seguintes. O apoio da família define em que equipe ele começa e se consegue pagar as promoções.`,
      full: { label: 'Bancar a carreira', description: 'A família paga o que os patrocinadores dele não cobrirem.', text: `${p.child} estreia no kart regional com apoio total.` },
      basic: { label: 'Ajudar com metade', description: 'A família paga até metade da vaga.', text: `${p.child} estreia no kart regional com ajuda parcial.` },
      none: { label: 'Que conquiste sozinho', description: 'Sem dinheiro da família: depende de bolsas e patrocinadores.', text: `${p.child} vai tentar a sorte por conta própria.` },
      forbid: { label: 'Proibir', description: 'Ele segue outro caminho. A relação sofre.', text: `${p.child} desistiu das pistas, magoado(a).` },
    }),
  ],
};
