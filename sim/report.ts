/**
 * Relatório do simulador, em texto puro. Não tem data, hora, duração nem número de versão: duas
 * execuções com os mesmos argumentos dão o mesmo texto, letra por letra, enquanto nenhuma regra
 * do jogo mudar, e dá para comparar o relatório de uma fase com o da anterior num diff.
 */
import { categoryRef } from '@/domain/categoryNames';
import { formatMoney } from '@/domain/money';
import { counted } from '@/domain/text';
import { CATEGORIES, getCategory } from '@/data/categories';
import type { BirthGroupStats, SimSummary } from './run';

const GROUP_LABELS: Readonly<Record<BirthGroupStats['group'], string>> = {
  low: 'Nascença baixa',
  mid: 'Nascença média',
  high: 'Nascença alta',
  capital: 'Capital',
  interior: 'Interior',
  talents: 'Dois talentos',
  defects: 'Dois defeitos',
};

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
/** O simulador cria pilotos brasileiros; a moeda é só apresentação e não muda os números. */
const cash = (value: number) => formatMoney(value, 'BRL', { compact: true });

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

  out.push(
    'APEX MOTORSPORT DYNASTY · SIMULADOR DE CARREIRAS',
    `${counted(summary.careers, 'carreira', 'carreiras')} (${options.seeds === 1 ? `semente ${lastSeed}` : `sementes ${options.firstSeed} a ${lastSeed}`}), ${counted(options.seasons, 'temporada', 'temporadas')} cada: ${counted(summary.seasonsPlayed, 'temporada disputada', 'temporadas disputadas')}`,
    `Política: robô padrão (treino de acerto, classificação e corrida equilibradas, melhor proposta aceitável) · talento ${options.talent}`,
    `Idade média na estreia: ${decimal(summary.averageStartAge)} anos`,
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
    'segurança: a vaga gratuita na equipe mais fraca do degrau de baixo (ou do próprio degrau, para quem já está no',
    'primeiro). O jogo de hoje sempre oferece essa vaga: ninguém fica um ano inteiro sem correr.',
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

  return `${out.join('\n')}\n`;
}
