/**
 * Relatório do simulador, em texto puro. Não tem data, hora, duração nem número de versão: duas
 * execuções com os mesmos argumentos dão o mesmo texto, letra por letra, enquanto nenhuma regra
 * do jogo mudar, e dá para comparar o relatório de uma fase com o da anterior num diff.
 */
import { categoryRef } from '@/domain/categoryNames';
import { EVENT_CATEGORY_LABELS, MOMENT_KIND_LABELS, MOMENT_RISK_LABELS } from '@/domain/labels';
import { formatMoney } from '@/domain/money';
import { RELATIVE_PATHS, TRANSITION_ROLES } from '@/domain/schemas';
import { counted } from '@/domain/text';
import { APTITUDE_INFO, APTITUDE_ORDER, BIRTH_TRAITS } from '@/data/birth';
import { CATEGORIES, getCategory } from '@/data/categories';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { MOMENT_TEXTS } from '@/data/raceMoments';
import { TRANSITION_ROLE_INFO } from '@/data/transition';
import { type DynastyStats, type GenerationStats, type InheritanceStats, PAIRED_MEASURES, type PairedMeasure, SIM_DYNASTY } from './dynasty';
import { BOT_TRANSITION_ORDER, type MomentPolicy } from './policy';
import type { BirthGroupStats, EventCountStats, MomentCountStats, MomentEdgeStats, SimSummary, UnlockSample } from './run';

const GROUP_LABELS: Readonly<Record<BirthGroupStats['group'], string>> = {
  low: 'Nascença baixa',
  mid: 'Nascença média',
  high: 'Nascença alta',
  capital: 'Capital',
  interior: 'Interior',
  talents: 'Dois talentos',
  defects: 'Dois defeitos',
};

const EDGE_LABELS: Readonly<Record<MomentEdgeStats['group'], string>> = { low: 'Baixa', mid: 'Média', high: 'Alta' };

/** A opção que o robô escolhe em todo lance quando a política de lances não é a padrão. */
const MOMENT_POLICY_LABELS: Readonly<Record<Exclude<MomentPolicy, 'style'>, string>> = { safe: 'mais segura', bold: 'mais arriscada' };

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
/** Número com sinal (o de menos tipográfico, como no dinheiro); o que arredonda para zero sai sem sinal. */
const signed = (value: number, digits = 1) => {
  const text = decimal(Math.abs(value), digits);
  return /[1-9]/.test(text) ? `${value < 0 ? '−' : '+'}${text}` : text;
};
/** Quantos textos repetidos o relatório mostra como exemplo. */
const REPEAT_EXAMPLES = 5;

/** Nome e tipo (talento, defeito ou aptidão) de quem libera uma escolha; um id desconhecido sai como veio. */
function unlockLabel(unlock: UnlockSample): { name: string; kind: string } {
  if (unlock.kind === 'trait') {
    const trait = Object.values(BIRTH_TRAITS).find((t) => t.id === unlock.id);
    return { name: trait?.name ?? unlock.id, kind: trait?.kind === 'defect' ? 'Defeito' : 'Talento' };
  }
  const aptitude = APTITUDE_ORDER.find((key) => key === unlock.id);
  const name = aptitude ? APTITUDE_INFO[aptitude].label : unlock.id;
  return { name: unlock.level === 'low' ? `${name} (baixa)` : name, kind: 'Aptidão' };
}

/** O simulador cria pilotos brasileiros; a moeda é só apresentação e não muda os números. */
const cash = (value: number) => formatMoney(value, 'BRL', { compact: true });

/** Quebra um parágrafo em linhas da largura do relatório. */
function paragraph(text: string, width = 120): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return line ? [...lines, line] : lines;
}

type Align = 'left' | 'right';

/** Tabela de colunas alinhadas: a primeira à esquerda, as demais à direita (salvo indicação). */
function table(headers: readonly string[], rows: readonly (readonly string[])[], align: readonly Align[] = []): string[] {
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map((row) => (row[i] ?? '').length)));
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, i) => ((align[i] ?? (i === 0 ? 'left' : 'right')) === 'left' ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
      .join('  ')
      .trimEnd();
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)];
}

export function formatReport(summary: SimSummary): string {
  const { options } = summary;
  const lastSeed = options.firstSeed + options.seeds - 1;
  const out: string[] = [];
  const section = (title: string) => out.push('', title.toUpperCase(), '');
  const careers = counted(summary.careers, 'carreira', 'carreiras');
  const policy = options.moments ?? 'style';

  out.push(
    'APEX MOTORSPORT DYNASTY · SIMULADOR DE CARREIRAS',
    `${counted(summary.careers, 'carreira', 'carreiras')} (${options.seeds === 1 ? `semente ${lastSeed}` : `sementes ${options.firstSeed} a ${lastSeed}`}), ${counted(options.seasons, 'temporada', 'temporadas')} cada: ${counted(summary.seasonsPlayed, 'temporada disputada', 'temporadas disputadas')}`,
    `Política: robô padrão (treino de acerto, classificação e corrida equilibradas, melhor proposta aceitável) · talento ${options.talent}${policy === 'style' ? '' : ` · lances: sempre a opção ${MOMENT_POLICY_LABELS[policy]}`}`,
    `Idade média na estreia: ${decimal(summary.averageStartAge)} anos`,
  );
  if (summary.dynasty)
    out.push(
      `Dinastia: depois das ${counted(options.seasons, 'temporada', 'temporadas')}, cada carreira segue até a 2ª geração (seção 11); as seções 1 a 10 medem só as temporadas pedidas.`,
    );

  section('1. Posição final por categoria');
  out.push(
    ...table(
      ['Categoria', 'Temporadas', 'Carreiras', 'Posição média', 'Mediana', 'Melhor', 'Entre os 3', 'Títulos'],
      summary.byCategory.map((c) => [
        getCategory(c.categoryId).name,
        String(c.seasons),
        String(c.careers),
        decimal(c.averagePosition),
        `${c.medianPosition}º`,
        `${c.bestPosition}º`,
        percent(c.top3Share),
        String(c.titles),
      ]),
    ),
  );

  section('2. Caixa no fim de cada temporada');
  out.push(
    ...table(
      ['Temporada', 'Carreiras', '10% piores', 'Mediana', '10% melhores', 'No vermelho', 'Patrimônio (mediana)'],
      summary.cashBySeason.map((s) => [
        String(s.season),
        String(s.careers),
        cash(s.p10),
        cash(s.median),
        cash(s.p90),
        percent(s.negativeShare),
        cash(s.medianNetWorth),
      ]),
    ),
    '',
    'Caixa: dinheiro na conta depois do fechamento do ano (impostos, juros e rendimentos já lançados).',
    '"10% piores" e "10% melhores" são os percentis 10 e 90; "no vermelho" é a parcela das carreiras com caixa negativo.',
  );

  section('3. Idade ao chegar a cada degrau');
  out.push(
    ...table(
      ['Degrau', 'Categoria', 'Chegaram', 'Das carreiras', 'Idade média', 'Mais novo', 'Mais velho', 'Temporada média'],
      summary.arrivals.map((a) => [
        String(a.tier),
        getCategory(a.categoryId).name,
        String(a.careers),
        percent(a.share),
        decimal(a.averageAge),
        String(a.minAge),
        String(a.maxAge),
        decimal(a.averageSeason),
      ]),
      ['right', 'left'],
    ),
    '',
    'Chegar é subir: conta a primeira temporada no degrau vindo de um degrau mais baixo (ou a estreia). Quem pula um',
    'degrau por um atalho e depois cai nele não entra na linha desse degrau.',
  );

  section('4. Carreiras que chegam ao topo');
  out.push(
    `Chegaram ${categoryRef(summary.top.categoryId, 'a')}: ${summary.top.careers} de ${careers} (${percent(summary.top.share)}).`,
    `Degrau mais alto alcançado: ${CATEGORIES.map((c, i) => `${c.tier}º ${summary.highestTier[i] ?? 0}`).join(' · ')}.`,
  );

  section('5. Títulos por carreira');
  out.push(
    `Média de ${decimal(summary.titles.perCareer, 2)} por carreira (${counted(summary.titles.total, 'título', 'títulos')} no total; o máximo numa carreira foi ${summary.titles.max}).`,
    `Carreiras sem título: ${summary.titles.none} · com um: ${summary.titles.one} · com dois: ${summary.titles.two} · com três ou mais: ${summary.titles.threeOrMore}.`,
  );

  section('6. Temporadas paradas, sem vaga');
  out.push(
    `Sem vaga: ${counted(summary.noSeat.seasons, 'temporada', 'temporadas')} (${decimal(summary.noSeat.perCareer, 2)} por carreira), em ${summary.noSeat.careers} de ${careers} (${percent(summary.noSeat.share)}).`,
    `  Por quê: em ${summary.noSeat.noOffer}, nenhuma equipe fez proposta; em ${summary.noSeat.money}, havia proposta e faltou dinheiro para a vaga; em ${summary.noSeat.requirements}, faltou outro requisito.`,
    `Desceu de degrau: ${counted(summary.demotions.seasons, 'temporada', 'temporadas')} (${decimal(summary.demotions.perCareer, 2)} por carreira), em ${summary.demotions.careers} de ${careers}.`,
    `Maior sequência no mesmo degrau: ${counted(decimal(summary.longestStay), 'temporada', 'temporadas')}, em média.`,
    `Etapas sem correr (lesão ou suspensão): ${decimal(summary.roundsMissedPerSeason, 2)} por temporada.`,
    `Carreiras interrompidas por sucessão (morte ou acidente): ${summary.interrupted}.`,
    '',
    '"Sem vaga" é a temporada em que o piloto não tinha nenhuma proposta que pudesse aceitar e só correu pela rede de',
    'segurança: a vaga de aluguel na equipe mais fraca do degrau de baixo (ou do próprio degrau, para quem já está no',
    'primeiro). O jogo sempre oferece essa vaga: ninguém fica um ano inteiro sem correr. Desde a Fase 3 ela custa dinheiro.',
  );

  section('7. Nascimento');
  const birthRows = (rows: readonly BirthGroupStats[]) =>
    rows.map((g) => [
      GROUP_LABELS[g.group],
      String(g.careers),
      `${decimal(g.averageScore)} (${decimal(g.minScore)} a ${decimal(g.maxScore)})`,
      decimal(g.debutPosition),
      decimal(g.averageHighestTier, 2),
      percent(g.formulaShare),
      percent(g.topShare),
      decimal(g.titlesPerCareer, 2),
      decimal(g.noSeatPerCareer, 2),
    ]);
  const birthHeaders = ['Grupo', 'Carreiras', 'Nota de nascença', 'Posição na estreia', 'Degrau mais alto', 'Monopostos', 'Topo', 'Títulos', 'Sem vaga'];
  out.push(
    ...table(birthHeaders, birthRows(summary.byBirth)),
    '',
    ...table(birthHeaders, birthRows(summary.byOrigin)),
    '',
    'Nota de nascença: a média das cinco aptidões de corpo e mente (reflexo, físico, inteligência, frieza e carisma; 50 é o',
    'piloto comum). As carreiras ficam em três grupos do mesmo tamanho pela nota. "Posição na estreia" é a posição média no',
    'campeonato da primeira temporada; "degrau mais alto", a média do degrau mais alto alcançado; "monopostos" e "topo", a',
    'parcela das carreiras que chegou ao 4º degrau e ao último; "títulos" e "sem vaga", por carreira. A segunda tabela separa',
    'quem nasceu na capital de quem nasceu no interior e quem nasceu com dois talentos de quem nasceu com dois defeitos.',
  );

  section('8. Economia e portas');
  const doors = summary.doors;
  const entryRow = (label: string, e: (typeof doors.juniorEntry)[number]['stats']) => [
    label,
    String(e.careers),
    percent(e.share),
    e.careers ? decimal(e.averageSeason) : '-',
    String(e.own),
    String(e.academy),
    String(e.crowdfund),
    String(e.investor),
  ];
  out.push(
    `Sem nenhuma porta: ${counted(doors.noDoorSeasons, 'temporada', 'temporadas')}, em ${doors.noDoorCareers} de ${careers}. Maior sequência numa carreira: ${counted(doors.longestNoDoorStreak, 'temporada', 'temporadas')} (o limite é 2).`,
    `Investidor de último recurso: apareceu em ${counted(doors.lastResortSeasons, 'fechamento', 'fechamentos')}.`,
    `Vagas por porta: ${doors.used.own} com dinheiro próprio, patrocínio e bolsa · ${doors.used.academy} pela academia · ${doors.used.crowdfund} com a vaquinha · ${doors.used.investor} com investidor · ${doors.used.none} de aluguel.`,
    `Carreiras que terminam com investidor: ${doors.investorCareers} de ${careers} (fatia média de ${percent(doors.investorAverageShare)}; a maior, ${percent(doors.investorMaxShare)}).`,
    `Carreiras que passaram por uma academia: ${doors.academyCareers} de ${careers}. Temporadas com trabalho paralelo: ${doors.sideJobSeasons}.`,
    `Patrocinadores que romperam por meta não cumprida: ${decimal(doors.sponsorsBrokenPerCareer, 2)} por carreira.`,
    '',
    ...table(
      ['Posição final no kart', 'Temporadas', 'Resultado do ano (mediana)'],
      doors.yearResultByPosition.map((b) => [b.label, String(b.seasons), b.seasons ? cash(b.median) : '-']),
      ['left'],
    ),
    '',
    ...table(
      ['Resultado do ano por degrau', 'Temporadas', 'Do 1º ao 10º (mediana)', 'Do 11º em diante (mediana)'],
      doors.yearResultByTier.map((t) => [getCategory(t.categoryId).name, String(t.seasons), cash(t.topHalf), cash(t.bottomHalf)]),
      ['left'],
    ),
    '',
    ...table(
      [`Entrada ${categoryRef('f4', 'em')}`, 'Chegaram', 'Das carreiras', 'Temporada média', 'Patrocínio e bolsa', 'Academia', 'Vaquinha', 'Investidor'],
      doors.juniorEntry.map((row) => entryRow(row.label, row.stats)),
      ['left'],
    ),
    '',
    '"Porta" é uma vaga, fora a de aluguel, que o piloto consegue aceitar de algum jeito: com o que tem (dinheiro, patrocínio',
    'e bolsa), pela academia, com a vaquinha da cidade ou com um investidor. Depois de duas temporadas seguidas sem nenhuma,',
    'o investidor de último recurso aparece (e traz uma vaga, se nenhuma equipe fez proposta). "Resultado do ano" é a soma',
    'de tudo o que entrou e saiu na temporada (vaga, viagens, equipamento, aluguel, treino, patrocínios, apoio da família,',
    'impostos e juros; aportes de investidor e vaquinha entram no ano seguinte ao da assinatura): terminar mal tem de custar',
    'dinheiro. A última tabela mostra como cada grupo pagou a primeira temporada na Fórmula Júnior.',
  );

  section('9. Lances decisivos');
  const moments = summary.moments;
  const share = (count: number, total: number) => (total ? percent(count / total) : '-');
  const countRow = (label: string, c: MomentCountStats) => [
    label,
    String(c.races),
    String(c.completeRaces),
    c.completeRaces ? decimal(c.perRace, 2) : '-',
    share(c.two, c.completeRaces),
    share(c.three, c.completeRaces),
    share(c.four, c.completeRaces),
  ];
  out.push(
    `Lances: ${moments.moments} em ${counted(moments.all.races, 'corrida', 'corridas')} (${counted(moments.all.completeRaces, 'completa', 'completas')}). Corridas completas fora da faixa de 2 a 4 lances: ${moments.all.other}.`,
    `Rivalidades novas: ${moments.freshRivalries} (${decimal(moments.freshRivalriesPerCareer, 2)} por carreira). Toques em lances: ${decimal(moments.contactsPer100)} a cada 100 lances.`,
    '',
    ...table(
      ['Lances por corrida completa', 'Corridas', 'Completas', 'Média', 'Com 2', 'Com 3', 'Com 4'],
      [countRow('Todas as categorias', moments.all), ...moments.byCategory.map((c) => countRow(getCategory(c.categoryId).name, c))],
    ),
    '',
    ...table(
      ['Lance', 'Opção', 'Risco', 'Vezes', 'Deu certo', 'Chance mostrada', 'Rodou', 'Tocou', 'Abandonou', 'Punido'],
      moments.byOption.map((o) => [
        MOMENT_KIND_LABELS[o.kind],
        MOMENT_TEXTS[o.kind].options[o.option]?.label ?? o.option,
        MOMENT_RISK_LABELS[o.risk],
        String(o.times),
        o.times ? percent(o.successShare) : '-',
        o.times ? percent(o.averageChance) : '-',
        String(o.spins),
        String(o.contacts),
        String(o.retired),
        String(o.penalized),
      ]),
      ['left', 'left', 'left'],
    ),
    '',
    ...table(
      [
        'Vantagem sobre o grid',
        'Corridas',
        'Pontos de vantagem',
        'Lances',
        'Chance na opção arriscada',
        'Arriscou',
        'Acerto geral',
        'Arriscados vencidos',
        'Saldo',
      ],
      moments.byEdge.map((g) => [
        EDGE_LABELS[g.group],
        String(g.races),
        `${signed(g.averageEdge)} (${signed(g.minEdge)} a ${signed(g.maxEdge)})`,
        String(g.moments),
        g.riskyOffered ? percent(g.riskyChance) : '-',
        g.riskyOffered ? percent(g.riskyTakenShare) : '-',
        g.moments ? percent(g.successShare) : '-',
        decimal(g.riskyWonPerRace, 2),
        signed(g.balancePerRace, 2),
      ]),
    ),
    '',
    ...paragraph(
      [
        'Só o piloto do jogador tem lances.',
        policy === 'style'
          ? 'O robô não responde a nenhum: quem escolhe a opção é o estilo do piloto, como em "simular até o fim".'
          : `Nesta execução o robô responde a todos, sempre com a opção ${MOMENT_POLICY_LABELS[policy]} (no relatório padrão, quem escolhe é o estilo do piloto).`,
        '"Corrida completa" é a que o piloto termina sem a prova ser encerrada antes por bandeira vermelha: a regra é de 2 a 4',
        'lances por corrida completa, e a largada sempre é um deles (a primeira linha diz quantas ficaram fora da faixa).',
        'Na segunda tabela, "deu certo" é a parcela das vezes em que a opção funcionou e "chance mostrada", a média da chance',
        'que a tela exibia nela: as duas têm de andar juntas. "Rodou", "tocou", "abandonou" e "punido" contam os lances errados',
        'que terminaram assim (o toque que tira o piloto da corrida conta em "tocou" e em "abandonou").',
        'A terceira tabela separa as corridas em três grupos do mesmo tamanho pela vantagem do piloto sobre o grid na hora da',
        'corrida: a nota geral dele menos o nível médio dos pilotos da categoria. "Chance na opção arriscada" é a média da',
        'chance mostrada na opção arriscada dos lances que tinham uma, escolhida ou não; "arriscou", a parcela desses lances em',
        'que o piloto foi nela; "acerto geral", a parcela de todos os lances que deram certo; "arriscados vencidos", os lances',
        'arriscados que deram certo, por corrida; "saldo", os lances vencidos menos os perdidos, por corrida (o registro não diz',
        'quantas posições cada lance valeu). Piloto melhor tem de ver chances maiores e vencer mais lances arriscados.',
        '"Rivalidade nova" é o toque num lance com um piloto que ainda não era rival.',
      ].join(' '),
    ),
  );

  section('10. Eventos');
  const events = summary.events;
  const eventRow = (label: string, c: EventCountStats) => [
    label,
    String(c.rounds),
    c.rounds ? decimal(c.perRound, 2) : '-',
    share(c.zero, c.rounds),
    share(c.one, c.rounds),
    share(c.two, c.rounds),
    share(c.three, c.rounds),
    share(c.more, c.rounds),
    c.starts ? decimal(c.perStart, 2) : '-',
  ];
  const repeatLine = (scope: string, texts: number, withRepeats: number) =>
    `Textos repetidos na mesma carreira, ${scope}: ${texts} (em ${withRepeats} de ${careers}).`;
  out.push(
    `Cartões da Fase 5: ${events.cards} (${events.all.rounds ? decimal(events.all.perRound, 2) : '-'} por etapa; ${events.all.starts ? decimal(events.all.perStart, 2) : '-'} no começo de cada temporada, da segunda em diante). Eventos de família e mudança: ${events.others}.`,
    `Etapas (com e sem o piloto na pista): ${events.all.rounds}. Sem nenhum cartão: ${events.all.zero}. Com mais de 3: ${events.all.more}.`,
    '',
    ...table(
      ['Cartões por etapa', 'Etapas', 'Média', 'Com 0', 'Com 1', 'Com 2', 'Com 3', 'Mais de 3', 'No começo do ano'],
      [eventRow('Todas as temporadas', events.all), ...events.bySeason.map((s) => eventRow(`Temporada ${s.season}`, s))],
    ),
    '',
    ...table(
      ['Categoria', 'Cartões', 'Parcela'],
      events.byCategory.map((c) => [EVENT_CATEGORY_LABELS[c.category], String(c.cards), events.cards ? percent(c.share) : '-']),
    ),
    '',
    `Cadeias por carreira: ${decimal(events.chainsStartedPerCareer, 2)} começadas e ${decimal(events.chainsDonePerCareer, 2)} concluídas, em média.`,
    '',
    ...table(
      ['Cadeia', 'Id', 'Começaram', 'Concluíram'],
      events.chains.map((c) => [c.title, c.id, String(c.started), String(c.done)]),
      ['left', 'left'],
    ),
    '',
    `Escolhas de traço ou aptidão oferecidas: ${events.unlocks} (${decimal(events.unlocksPerCareer, 2)} por carreira), em ${events.unlockCareers} de ${careers}.`,
    '',
    ...table(
      ['Traço ou aptidão', 'Tipo', 'Escolhas no catálogo', 'Oferecidas', 'Carreiras'],
      events.byUnlock.map((u) => {
        const label = unlockLabel(u);
        return [label.name, label.kind, String(u.inCatalog), String(u.times), String(u.careers)];
      }),
      ['left', 'left'],
    ),
    '',
    `Propostas de patrocínio: ${events.sponsorOffers} (${decimal(events.sponsorOffersPerCareer, 2)} por carreira), de ${counted(events.sponsorProfiles, 'perfil diferente', 'perfis diferentes')} (o catálogo tem ${events.sponsorCatalog}). Perfil repetido na mesma carreira: ${events.sponsorRepeated}.`,
    '',
    repeatLine('só nos cartões da Fase 5', events.repeats.story, events.repeats.storyCareers),
    repeatLine('em todos os eventos (com família e mudança)', events.repeats.all, events.repeats.allCareers),
    ...events.repeats.examples
      .slice(0, REPEAT_EXAMPLES)
      .map((r) => `  "${r.text}" (${r.events.join(', ')}): ${counted(r.times, 'vez', 'vezes')}, em ${counted(r.careers, 'carreira', 'carreiras')}.`),
    '',
    ...paragraph(
      [
        'Os cartões da Fase 5 são os eventos encadeados com memória: avulsos, passos de cadeia e propostas de patrocínio; os',
        'de família e a mudança ficam de fora das contas, menos na última linha de textos repetidos. Cada cartão conta quando',
        'aparece, antes da resposta do robô (que fica sempre com a primeira escolha). A regra é de 1 a 3 cartões por etapa:',
        'etapa sem cartão é catálogo sem texto novo para o momento, e uma temporada que perde cartões com o tempo mostra o',
        'catálogo se esgotando. "No começo do ano" é a média de cartões antes da primeira etapa, da segunda temporada em diante.',
        'Uma cadeia começa com o primeiro cartão dela e termina quando um desfecho a encerra. "Escolhas no catálogo" conta as',
        'escolhas que o traço ou a aptidão libera nos dados; "oferecidas", as vezes em que uma delas apareceu num cartão.',
        '"Texto repetido" é um título, corpo, rótulo de escolha ou desfecho que a mesma carreira viu mais de uma vez: o',
        'critério de aceite da fase é zero nos cartões da Fase 5, em 15 temporadas. Os exemplos mostram o começo do texto e de',
        'que eventos ele veio.',
      ].join(' '),
    ),
  );

  if (summary.dynasty) {
    section('11. Dinastia');
    out.push(...dynastySection(summary.dynasty));
  }

  return `${out.join('\n')}\n`;
}

/** Os degraus mais altos de uma geração, no formato da seção 4. */
const tierSpread = (g: GenerationStats) => CATEGORIES.map((c, i) => `${c.tier}º ${g.highestTier[i] ?? 0}`).join(' · ');

const PAIRED_LABELS: Readonly<Record<PairedMeasure, string>> = {
  tier: 'Degrau mais alto',
  titles: 'Títulos',
  wins: 'Vitórias',
  topSeasons: 'Temporadas no topo',
};

/** As medianas da herança de um grupo de sucessões, numa linha. */
function inheritanceLine(label: string, i: InheritanceStats, note = ''): string {
  if (i.successions === 0) return `Herança (medianas), ${label}: nenhuma sucessão.`;
  return `Herança (medianas), ${label} (${counted(i.successions, 'sucessão', 'sucessões')}): patrimônio deixado ${cash(i.estate)} · imposto ${cash(i.tax)} · parte dos irmãos ${cash(i.siblingsShare)}${note} · com o herdeiro ${cash(i.inherited)}.`;
}

/** A seção 11 (Fase 6): as duas gerações de cada carreira, a sucessão e a família. */
function dynastySection(d: DynastyStats): string[] {
  const careers = counted(d.careers, 'carreira', 'carreiras');
  const heirs = d.childHeir + d.relativeHeir;
  const generationRow = (label: string, g: GenerationStats) => {
    const any = g.careers > 0;
    return [
      label,
      String(g.careers),
      any ? decimal(g.seasonsPerCareer) : '-',
      any ? decimal(g.averageStartAge) : '-',
      any ? decimal(g.averageStartTier) : '-',
      any ? decimal(g.averageHighestTier, 2) : '-',
      any ? percent(g.formulaShare) : '-',
      any ? percent(g.topShare) : '-',
      decimal(g.titlesPerCareer, 2),
      decimal(g.winsPerCareer),
      String(g.maxTitles),
      percent(g.titleSeasonShare),
    ];
  };
  const transitionOrder = [...BOT_TRANSITION_ORDER, ...TRANSITION_ROLES.filter((role) => !BOT_TRANSITION_ORDER.some((r) => r === role))];
  const share = (count: number, total: number) => (total ? ` (${percent(count / total)})` : '');
  const childCurrent = d.seats.current - d.seats.relativeCurrent;
  return [
    `Chegaram à 2ª geração: ${d.reached} de ${careers}. Herdeiro piloto: um filho ou uma filha que já corria em ${d.childHeir}; sem filho piloto, o parente jovem em ${d.relativeHeir}${d.relativeOverRacingChild ? ` (com um filho piloto preterido: ${d.relativeOverRacingChild})` : ''}.`,
    `Como a 1ª geração passou a família adiante: em vida, ${d.causes.handover} · por morte, ${d.causes.death} · por acidente, ${d.causes.accident}${heirs ? ` (aos ${decimal(d.averageFormerAge)} anos, em média)` : ''}.`,
    '',
    ...table(
      [
        'Geração',
        'Carreiras',
        'Temporadas',
        'Idade de estreia',
        'Degrau de estreia',
        'Degrau mais alto',
        'Monopostos',
        'Topo',
        'Títulos',
        'Vitórias',
        'Máximo de títulos',
        'Temporadas com título',
      ],
      [
        generationRow('1ª geração', d.gen1),
        generationRow('2ª geração', d.gen2),
        generationRow('2ª: filho herdeiro', d.gen2ByHeir.child),
        generationRow('2ª: parente jovem', d.gen2ByHeir.relative),
      ],
    ),
    '',
    `Degrau mais alto, 1ª geração: ${tierSpread(d.gen1)}.`,
    `Degrau mais alto, 2ª geração: ${tierSpread(d.gen2)}.`,
    '',
    ...table(
      ['Pela semente (2ª contra a 1ª)', 'Mais', 'Igual', 'Menos', 'Filho herdeiro: mais', 'Igual', 'Menos'],
      PAIRED_MEASURES.map((m) => [
        PAIRED_LABELS[m],
        String(d.paired[m].more),
        String(d.paired[m].same),
        String(d.paired[m].less),
        String(d.pairedChild[m].more),
        String(d.pairedChild[m].same),
        String(d.pairedChild[m].less),
      ]),
    ),
    '',
    `Não ganha tudo: a 2ª geração foi campeã em ${percent(d.gen2.titleSeasonShare)} das temporadas; o máximo numa carreira foi ${counted(d.gen2.maxTitles, 'título', 'títulos')}.`,
    '',
    inheritanceLine('filho herdeiro', d.inheritance.child),
    inheritanceLine('parente jovem', d.inheritance.relative, ' (os filhos não recebem parte quando o parente herda)'),
    `Vaga do herdeiro: a equipe em que já corria em ${childCurrent} · uma equipe do kart regional (o parente jovem, que não corria) em ${d.seats.relativeCurrent} · uma equipe da frente, paga pela família, em ${d.seats.top} · a equipe da família em ${d.seats.family}. A da frente estava ao alcance em ${counted(d.seats.topAvailable, 'sucessão', 'sucessões')}; a da família, em ${d.seats.familyAvailable}.`,
    `Filho herdeiro na escolha (médias): ${decimal(d.heir.age)} anos, degrau ${decimal(d.heir.tier)}, ${counted(decimal(d.heir.ownSeasons), 'temporada', 'temporadas')} de carreira própria; ${decimal(d.heir.revealed)} traços de nascença revelados e ${decimal(d.heir.hidden)} ocultos. Fez o teste no kart: ${d.heir.kartTested} de ${d.heir.heirs}.`,
    `Família na sucessão: ${decimal(d.family.childrenPerFamily)} filhos por família (sem filhos: ${d.family.childless}); com carreira de piloto, ${decimal(d.family.racingChildrenPerFamily)} por família. Fizeram o teste no kart: ${d.family.kartTests} de ${counted(d.family.children, 'filho', 'filhos')}. Traços de nascença dos filhos já revelados na escolha: ${d.family.traitsRevealed} de ${d.family.traits}${share(d.family.traitsRevealed, d.family.traits)}.`,
    `Parentes por caminho (os filhos que não herdaram): ${RELATIVE_PATHS.map((path) => `${RELATIVE_PATH_INFO[path].label}: ${d.relatives[path]}`).join(' · ')}.`,
    `Ano de transição da 1ª geração: ${transitionOrder.map((role) => `${TRANSITION_ROLE_INFO[role].label}: ${d.transition[role]}`).join(' · ')} · sem ano de transição: ${d.transition.none}.`,
    `Depois de parar de correr (1ª geração, temporadas por carreira): ano de transição: ${decimal(d.afterDriving.transition, 2)} · equipe própria: ${decimal(d.afterDriving.owner, 2)} · cargo de chefe de equipe: ${decimal(d.afterDriving.principal, 2)} · sem equipe: ${decimal(d.afterDriving.none, 2)}.`,
    `Equipe da família: a 2ª geração correu por ela em ${counted(d.familyTeam.seasons, 'temporada', 'temporadas')}, em ${d.familyTeam.careers} de ${counted(d.gen2.careers, 'carreira', 'carreiras')}.`,
    '',
    ...paragraph(
      [
        'Cada carreira continua depois das temporadas da amostra, com o mesmo robô.',
        `A 1ª geração corre até os ${SIM_DYNASTY.RETIRE_AGE} anos, faz o ano de transição (o primeiro papel ao alcance, na ordem da linha do ano de transição),`,
        'vira dirigente (compra uma equipe se o preço couber no caixa com folga, senão aceita um cargo, senão acompanha de fora) e',
        `passa o comando em vida quando um filho com carreira de piloto chega aos ${SIM_DYNASTY.HEIR_RACING_AGE} anos, mas espera enquanto um filho`,
        'mais novo, que já corre ou quer correr, parecer mais promissor (pela avaliação dos treinadores, pelo teste no kart e pelos',
        `talentos e defeitos revelados). Aos ${SIM_DYNASTY.HANDOVER_AGE} anos, a espera acaba: passa o comando ao filho piloto ou, sem filho`,
        'piloto, ao parente jovem. Morrer antes também abre a sucessão. O robô escolhe o herdeiro entre os filhos que já correm,',
        'sobretudo pela avaliação dos treinadores e pelo teste no kart (o degrau em que corre, os talentos e defeitos revelados e a',
        'idade também contam); o parente jovem só herda quando nenhum filho corre. A vaga: uma equipe da frente, se o patrimônio herdado cobrir;',
        'senão, a da família; senão, a equipe em que o herdeiro já corria. A 2ª geração corre até os',
        `${SIM_DYNASTY.RETIRE_AGE} anos ou ${SIM_DYNASTY.GEN2_MAX_SEASONS} temporadas e, no fim de cada uma, fica com a proposta da equipe da família quando ela está`,
        'no degrau mais alto ao alcance (senão, a equipe mais forte, como sempre). Aqui a 1ª geração conta a vida de piloto',
        'inteira: as temporadas da amostra e as que vieram até parar (as seções 1 a 10 contam só as da amostra). "Temporadas"',
        'são as completas como piloto da família, em média; "idade de estreia" e "degrau de estreia", os da primeira temporada',
        'como piloto da família (o herdeiro já vinha de uma carreira própria, que aparece na linha do filho herdeiro na',
        'escolha); "degrau mais alto" conta o da estreia; "monopostos" e "topo", a parcela que chegou ao 4º degrau e ao último.',
        'As linhas "filho herdeiro" e "parente jovem" separam a 2ª geração por quem herdou: o parente jovem nasce na sucessão,',
        'com potencial próprio, sem herança de traços nem teste no kart, e só os filhos medem as regras da dinastia. A tabela',
        'pela semente põe lado a lado as duas gerações da mesma carreira em quatro medidas (com o talento alto, quase todas as',
        'carreiras chegam ao topo e o degrau mais alto empata: aí valem os títulos, as vitórias e as temporadas no topo); as',
        'três últimas colunas contam só as carreiras em que um filho herdou. A herança é o patrimônio de quem passou a família',
        'adiante (com a equipe própria, se houver), o imposto, a parte dos irmãos e o que ficou com o herdeiro. O bônus de',
        'talento vale para o piloto de cada geração: o herdeiro o recebe ao assumir o carro, como o piloto da semente na criação.',
      ].join(' '),
    ),
  ];
}
