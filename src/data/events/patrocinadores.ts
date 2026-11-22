/**
 * Perfis de patrocinador (Fase 5). Cada perfil tem nome inventado, ramo, porte, faixa de valor,
 * exigência e personalidade, e escreve a proposta na própria voz. Cada perfil aparece no máximo uma
 * vez por personagem: nada de "mesmo patrocinador" em temporadas diferentes.
 *
 * Nenhuma marca real. Valores e metas por nome: os números estão em SPONSOR_PROFILE_RULES e
 * SPONSOR_RULES. Marcadores das propostas: `{patrocinador}`, `{valor}` (por temporada), `{bonus}`
 * (por pódio), `{meta}` (posição no campeonato) e `{ate}` (último ano do contrato), além dos de
 * sempre (`{nome}`, `{categoria}`, `{cidade}`…). Acrescente perfis no fim da lista.
 */
import type { SponsorProfile } from '@/domain/storyEvents';

export const SPONSOR_PROFILES: readonly SponsorProfile[] = [
  {
    // Só de cadeia: a padaria da cidade natal, que patrocina o piloto adolescente no kart.
    id: 'padaria-pao-da-vila',
    name: 'Padaria Pão da Vila',
    sector: 'padaria',
    tier: 1,
    value: 'low',
    demand: 'easy',
    personality: 'loyal',
    chainOnly: true,
    pitch: {
      title: 'O pão quentinho da Pão da Vila',
      body: 'A padaria da esquina de casa, em {cidade}, oferece {valor} por temporada e {bonus} por pódio, até {ate}, para pôr o nome no seu kart. A meta é modesta: terminar entre os {meta} primeiros.',
      sign: 'Aceitar o patrocínio da padaria do bairro',
      haggle: 'Pedir um pouco mais à padaria',
      refuse: 'Recusar o pão de cada dia',
      signed: 'O adesivo da padaria vai para o bico do kart, e o balcão ganha uma foto sua.',
      haggleWon: 'O dono da padaria tira mais um pouco do caixa, de coração.',
      haggleLost: 'Padaria de bairro não tem esse dinheiro: a conversa termina num cafezinho.',
      refused: 'Na padaria, ninguém fica chateado: o pão continua saindo quentinho para a sua família.',
    },
  },
  {
    id: 'oficina-irmaos-correia',
    name: 'Oficina Irmãos Correia',
    sector: 'oficina mecânica',
    tier: 1,
    value: 'fair',
    demand: 'easy',
    personality: 'loyal',
    pitch: {
      title: 'Os irmãos da oficina da esquina',
      body: 'Os irmãos Correia consertam carro em {cidade} há trinta anos e querem o nome da oficina no seu macacão: {valor} por temporada, {bonus} por pódio, até {ate}. “Basta terminar entre os {meta} primeiros.”',
      sign: 'Fechar com um aperto de mão de graxa',
      haggle: 'Pedir um pouco mais pelos irmãos Correia',
      refuse: 'Agradecer e esperar uma proposta maior',
      signed: 'O adesivo da oficina vai para o macacão, e os irmãos penduram a sua foto atrás do balcão.',
      haggleWon: 'Os dois cochicham no fundo da oficina e voltam com um valor melhor, e uma meta um pouco mais dura.',
      haggleLost: 'O irmão mais velho coça a cabeça: oficina de bairro não tem esse dinheiro. Fica para a próxima.',
      refused: 'Os irmãos entendem e deixam a porta aberta: “quando precisar de um parafuso, é só chegar”.',
    },
  },
  {
    id: 'cooperativa-vale-verde',
    name: 'Cooperativa Vale Verde',
    sector: 'cooperativa agrícola',
    tier: 2,
    value: 'high',
    demand: 'normal',
    personality: 'discreet',
    pitch: {
      title: 'Os produtores da Cooperativa Vale Verde',
      body: 'Uma cooperativa de produtores de café quer associar a marca a um piloto da terra: {valor} por temporada e {bonus} por pódio, até {ate}. Pedem pouca propaganda e uma coisa só: terminar entre os {meta} primeiros.',
      sign: 'Assinar com a Vale Verde',
      haggle: 'Pedir um valor maior à cooperativa',
      refuse: 'Recusar a proposta dos cafeicultores',
      signed: 'Sem festa nem coletiva: o contrato chega pelo correio, assinado pelo conselho inteiro.',
      haggleWon: 'O conselho vota e aprova o aumento, com a meta ajustada em uma posição.',
      haggleLost: 'A assembleia não aprova o valor, e a cooperativa procura outro piloto da região.',
      refused: 'A cooperativa agradece por carta, em papel timbrado, e deseja boa sorte na temporada.',
    },
  },
  {
    id: 'aerolinhas-austral',
    name: 'Aerolinhas Austral',
    sector: 'companhia aérea',
    tier: 3,
    value: 'premium',
    demand: 'hard',
    personality: 'vain',
    pitch: {
      title: 'A Aerolinhas Austral quer o seu rosto',
      body: 'A companhia aérea quer você nos aviões, nos aeroportos e no macacão: {valor} por temporada e {bonus} por pódio, até {ate}. Em troca, exige brilho: terminar entre os {meta} primeiros e aparecer bem na foto.',
      sign: 'Assinar e posar para a campanha',
      haggle: 'Pedir um valor de estrela à Austral',
      refuse: 'Recusar o contrato da companhia aérea',
      signed: 'Na semana seguinte, o seu rosto está em todos os cartões de embarque da Austral.',
      haggleWon: 'O diretor de marketing sorri: estrela cobra caro. Ele paga, e passa a cobrar como estrela.',
      haggleLost: 'A Austral encerra a conversa com um e-mail de duas linhas e escolhe outro rosto.',
      refused: 'A companhia aérea recolhe o material da campanha, e o seu rosto some dos cartazes antes de aparecer.',
    },
  },
];
