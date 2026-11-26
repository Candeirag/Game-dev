/**
 * Verificações de integridade que o schema sozinho não cobre: referências
 * entre entidades, unicidade e coerência entre calendário, resultados,
 * contrato e progresso da temporada.
 */
import type { CareerState } from '@/domain/schemas';
import { BIRTH_TRAITS, HOMETOWNS } from '@/data/birth';
import { CATEGORIES } from '@/data/categories';
import { TRACKS } from '@/data/tracks';
import { TRANSITION_EVENTS } from '@/data/transition';

export function validateCareerIntegrity(career: CareerState): string[] {
  const problems: string[] = [];
  const teamIds = new Set(career.teams.map((t) => t.id));
  const driverIds = new Set(career.drivers.map((d) => d.id));
  const trackIds = new Set(TRACKS.map((t) => t.id));
  const category = CATEGORIES.find((c) => c.id === career.categoryId);

  if (teamIds.size !== career.teams.length) problems.push('Equipes com id duplicado.');
  if (driverIds.size !== career.drivers.length) problems.push('Pilotos com id duplicado.');

  const players = career.drivers.filter((d) => d.isPlayer);
  const player = players[0];
  if (players.length !== 1 || player?.id !== career.playerDriverId) problems.push('Deve existir exatamente um piloto do jogador.');
  // Como piloto, o jogador tem uma vaga de titular (salvo durante uma sucessão aberta no meio da temporada).
  const driving = career.mode === 'driver' && !(career.succession && !career.offseason);
  if (driving) {
    if (!player?.teamId) problems.push('O jogador precisa ter equipe.');
    if (player && player.role !== 'first' && player.role !== 'second') problems.push('O jogador precisa ser piloto titular.');
  } else if (player?.teamId) {
    problems.push('Fora das pistas, o personagem do jogador não ocupa vaga em equipe.');
  }

  for (const d of career.drivers) {
    if (d.teamId !== null && !teamIds.has(d.teamId)) problems.push(`Piloto ${d.id} aponta para equipe inexistente ${d.teamId}.`);
    if ((d.teamId === null) !== (d.role === null)) problems.push(`Piloto ${d.id} tem equipe e papel incoerentes.`);
  }
  for (const t of career.teams) {
    const lineup = career.drivers.filter((d) => d.teamId === t.id);
    const race = lineup.filter((d) => d.role !== 'reserve').length;
    const reserves = lineup.length - race;
    if (race !== 2) problems.push(`Equipe ${t.id} tem ${race} pilotos titulares (esperado: 2).`);
    if (reserves > 1) problems.push(`Equipe ${t.id} tem ${reserves} reservas (máximo: 1).`);
  }

  // Contrato do jogador.
  if (driving) {
    if (player && career.contract.teamId !== player.teamId) problems.push('O contrato não corresponde à equipe do jogador.');
    if (career.contract.categoryId !== career.categoryId) problems.push('O contrato não corresponde à categoria atual.');
    if (player && career.contract.role !== player.role) problems.push('O papel do jogador não corresponde ao contrato.');
  }
  if (career.contract.endSeason < career.contract.startSeason) problems.push('Contrato com datas invertidas.');

  if (!category) problems.push(`Categoria desconhecida: ${career.categoryId}.`);
  else if (career.calendar.length !== category.rounds) problems.push('Calendário com número de etapas diferente do da categoria.');
  career.calendar.forEach((e, i) => {
    if (e.round !== i + 1) problems.push(`Etapa fora de ordem no calendário: ${e.round}.`);
    if (!trackIds.has(e.trackId)) problems.push(`Pista desconhecida no calendário: ${e.trackId}.`);
  });

  if (career.nextRoundIndex > career.calendar.length) problems.push('Progresso da temporada além do calendário.');
  if (career.rounds.length !== career.nextRoundIndex) problems.push('Número de resultados não bate com o progresso da temporada.');
  career.rounds.forEach((r, i) => {
    if (r.round !== i + 1) problems.push(`Resultado da etapa ${r.round} fora de ordem.`);
    if (r.season !== career.season) problems.push(`Resultado da etapa ${r.round} pertence a outra temporada.`);
    const positions = r.race.entries.map((e) => e.position);
    if (new Set(positions).size !== positions.length) problems.push(`Posições duplicadas na etapa ${r.round}.`);
    for (const e of r.race.entries) {
      if (!driverIds.has(e.driverId)) problems.push(`Resultado da etapa ${r.round} com piloto inexistente ${e.driverId}.`);
      if (!teamIds.has(e.teamId)) problems.push(`Resultado da etapa ${r.round} com equipe inexistente ${e.teamId}.`);
    }
  });

  if (career.weekend) {
    const expectedRound = career.calendar[career.nextRoundIndex]?.round;
    if (career.weekend.round !== expectedRound) problems.push('Fim de semana em andamento não corresponde à próxima etapa.');
    if (career.weekend.phase !== 'practice' && !career.weekend.practice) problems.push('Fim de semana sem resultado de treino.');
    if (career.weekend.phase === 'race' && !career.weekend.qualifying) problems.push('Fim de semana sem classificação.');
    for (const e of career.weekend.entrants) {
      if (!driverIds.has(e.driverId) || !teamIds.has(e.teamId)) problems.push('Fim de semana com inscrito inexistente.');
    }
    if (career.offseason || career.executiveOffseason) problems.push('Fim de semana em andamento durante o fechamento da temporada.');
    if (career.succession) problems.push('Fim de semana em andamento durante uma sucessão.');
  }

  // Fechamento: existe exatamente quando a temporada acabou.
  const seasonOver = career.nextRoundIndex >= career.calendar.length && career.weekend === null;
  const closing = career.mode === 'driver' ? career.offseason : career.executiveOffseason;
  if (career.status === 'active' && seasonOver !== (closing !== null)) problems.push('Fechamento de temporada incoerente com o progresso.');
  if (career.mode === 'driver' && (career.executiveOffseason || career.management)) problems.push('Dados de dirigente em uma carreira de piloto.');
  if (career.mode === 'executive' && career.offseason) problems.push('Fechamento de piloto em uma carreira de dirigente.');

  // Gestão de equipe.
  const m = career.management;
  if (m) {
    if (!teamIds.has(m.teamId)) problems.push('A equipe administrada não existe no campeonato.');
    if (m.categoryId !== career.categoryId) problems.push('A equipe administrada é de outra categoria.');
    const allocation = Object.values(m.development.allocation).reduce((sum, v) => sum + v, 0);
    if (Math.abs(allocation - 1) > 0.01) problems.push('A distribuição da pesquisa não soma 100%.');
    if (new Set(m.staff.map((s) => s.role)).size !== m.staff.length) problems.push('Duas pessoas na mesma função da equipe técnica.');
    if (!Number.isFinite(m.budget)) problems.push('Caixa da equipe inválido.');
  }
  const off = career.executiveOffseason;
  if (off) {
    for (const id of off.lineup) if (!off.candidates.some((c) => c.driverId === id)) problems.push('Piloto escalado que não está entre os candidatos.');
  }

  // Família e dinastia.
  const childIds = new Set(career.family.children.map((c) => c.id));
  if (childIds.size !== career.family.children.length) problems.push('Filhos com id duplicado.');
  for (const child of career.family.children) {
    if (child.stage === 'racing' && (!child.driver || !child.racing)) problems.push(`Filho ${child.id} corre, mas não tem dados de piloto.`);
    if (child.driver?.isPlayer) problems.push(`Filho ${child.id} marcado como jogador.`);
    // Herança (Fase 6): traços de nascença sem repetição nem par oposto; o teste no kart só revela
    // traços que o filho tem, e eles ficam marcados como revelados.
    const traitIds = child.birthTraits.map((t) => t.id);
    if (new Set(traitIds).size !== traitIds.length) problems.push(`Filho ${child.id} com traço de nascença repetido.`);
    if (traitIds.some((id) => traitIds.includes(BIRTH_TRAITS[id].opposite))) problems.push(`Filho ${child.id} com traços de nascença opostos.`);
    for (const id of child.kartTest?.revealed ?? []) {
      if (!child.birthTraits.some((t) => t.id === id && t.revealedSeason !== null))
        problems.push(`Teste no kart de ${child.id} revelou um traço fora dos traços de nascença.`);
    }
  }
  const lineage = career.dynasty.lineage;
  const current = lineage[lineage.length - 1];
  if (!current || current.driverId !== career.playerDriverId) problems.push('A linhagem não termina no personagem atual.');
  if (current && current.generation !== career.dynasty.generation) problems.push('Geração da dinastia incoerente com a linhagem.');
  if (career.succession && !career.succession.heirs.some((h) => h.canDrive || h.canManage)) problems.push('Sucessão sem herdeiro que possa assumir.');
  // Dinastia (Fase 6): os parentes têm id único, diferente do de qualquer filho, e são de uma geração
  // anterior à atual; cada um dos que passaram o comando em vida aparece uma vez só e é um personagem
  // anterior da linhagem que saiu por uma passagem de comando (não morreu); os traços de nascença
  // gravados na linhagem não se repetem nem trazem os dois lados de um par.
  const relativeIds = career.dynasty.relatives.map((r) => r.id);
  if (new Set(relativeIds).size !== relativeIds.length) problems.push('Parentes com id duplicado.');
  if (relativeIds.some((id) => childIds.has(id))) problems.push('Parente com o mesmo id de um filho.');
  for (const relative of career.dynasty.relatives)
    if (relative.generation >= career.dynasty.generation) problems.push(`Parente ${relative.id} de geração igual ou maior que a atual.`);
  const elderIds = career.dynasty.elders.map((e) => e.driverId);
  if (new Set(elderIds).size !== elderIds.length) problems.push('Quem passou o comando em vida aparece duas vezes.');
  for (const elder of career.dynasty.elders) {
    if (elder.generation >= career.dynasty.generation)
      problems.push(`Quem passou o comando em vida (${elder.driverId}) é de geração igual ou maior que a atual.`);
    const entry = lineage.find((l) => l.driverId === elder.driverId);
    if (elder.driverId === career.playerDriverId || !entry)
      problems.push(`Quem passou o comando em vida (${elder.driverId}) não é um personagem anterior da linhagem.`);
    else if (entry.endReason !== 'handover') problems.push(`Quem passou o comando em vida (${elder.driverId}) não saiu por uma passagem de comando.`);
  }
  for (const entry of lineage) {
    const ids = entry.traits.map((t) => t.id);
    if (new Set(ids).size !== ids.length) problems.push(`Traço de nascença repetido na linhagem (${entry.driverId}).`);
    if (ids.some((id) => ids.includes(BIRTH_TRAITS[id].opposite))) problems.push(`Traços de nascença opostos na linhagem (${entry.driverId}).`);
  }

  // Ano de transição (Fase 6): só de quem parou de correr, na temporada da aposentadoria ou na
  // seguinte; em andamento, só na temporada dele, fora das pistas, sem equipe e antes do fechamento;
  // a mentoria tem quem acompanhar e a imagem de marca tem a marca; os eventos vistos são do papel e
  // não se repetem.
  if (career.retiredSeason !== null && career.mode === 'driver') problems.push('Piloto em atividade com temporada de aposentadoria.');
  if (career.retiredSeason !== null && career.retiredSeason > career.season) problems.push('Aposentadoria numa temporada futura.');
  const transition = career.transition;
  if (transition) {
    if (career.retiredSeason === null || (transition.season !== career.retiredSeason && transition.season !== career.retiredSeason + 1))
      problems.push('Ano de transição fora da temporada da aposentadoria e da seguinte.');
    if (transition.season > career.season) problems.push('Ano de transição numa temporada futura.');
    if (!transition.done && (transition.season !== career.season || career.mode !== 'executive' || career.management || career.executiveOffseason))
      problems.push('Ano de transição em andamento fora da temporada dele ou com equipe.');
    if ((transition.role === 'mentor') !== (transition.protegeId !== null)) problems.push('Ano de transição: só a mentoria tem pupilo, e ela precisa de um.');
    if ((transition.role === 'ambassador') !== (transition.brand !== null))
      problems.push('Ano de transição: só a imagem de marca tem marca, e ela precisa de uma.');
    if (new Set(transition.seen).size !== transition.seen.length) problems.push('Evento do ano de transição visto duas vezes.');
    if (transition.seen.some((id) => !TRANSITION_EVENTS.some((e) => e.id === id && e.role === transition.role)))
      problems.push('Evento do ano de transição desconhecido ou de outro papel.');
  }

  // Nascimento: de um personagem da linhagem, com traços sem repetição e sem os dois lados de um par.
  if (career.birth) {
    const birth = career.birth;
    if (!lineage.some((entry) => entry.driverId === birth.driverId)) problems.push('O nascimento é de um personagem fora da linhagem.');
    const ids = birth.traits.map((t) => t.id);
    if (new Set(ids).size !== ids.length) problems.push('Traço de nascimento repetido.');
    if (ids.some((id) => ids.includes(BIRTH_TRAITS[id].opposite))) problems.push('Traços de nascimento opostos no mesmo piloto.');
    if (!HOMETOWNS.some((h) => h.id === birth.hometownId && h.region === birth.region)) problems.push('Cidade de nascimento desconhecida.');
    if (birth.movedSeason !== null && birth.region !== 'interior') problems.push('Mudança para a capital de quem já nasceu nela.');
  }

  // Patrimônio.
  for (const holding of career.finance.stocks) if (!(holding.stockId in career.finance.stockPrices)) problems.push(`Ação sem cotação: ${holding.stockId}.`);
  if (new Set(career.finance.stocks.map((h) => h.stockId)).size !== career.finance.stocks.length) problems.push('Ação repetida na carteira.');

  // Memória das histórias (Fase 5): do personagem atual, sem chave repetida.
  const story = career.story;
  if (story.driverId !== career.playerDriverId && !career.succession) problems.push('A memória das histórias é de outro personagem.');
  if (new Set(story.seen.map((s) => s.key)).size !== story.seen.length) problems.push('Texto marcado como visto duas vezes na memória.');
  if (new Set(story.people.map((p) => p.key)).size !== story.people.length) problems.push('Pessoa repetida na memória.');
  if (new Set(story.chains.map((c) => c.id)).size !== story.chains.length) problems.push('Cadeia repetida na memória.');
  if (new Set(story.flags.map((f) => f.id)).size !== story.flags.length) problems.push('Marca repetida na memória.');
  for (const chain of story.chains) if ((chain.status === 'active') !== (chain.next !== null)) problems.push(`Cadeia ${chain.id} com estado incoerente.`);
  const pendingKeys = career.pendingEvents.flatMap((e) => (e.storyKey ? [e.storyKey] : []));
  if (new Set(pendingKeys).size !== pendingKeys.length) problems.push('Dois cartões pendentes com o mesmo texto.');

  for (const event of career.pendingEvents) {
    for (const choice of event.choices) {
      const total = choice.outcomes.reduce((sum, o) => sum + o.probability, 0);
      if (Math.abs(total - 1) > 0.001) problems.push(`Evento ${event.id}: as probabilidades da escolha "${choice.id}" não somam 1.`);
    }
  }

  for (const value of [career.finance.cash, career.finance.fixedIncome, career.finance.equityFund, career.reputation]) {
    if (!Number.isFinite(value)) problems.push('Valor numérico inválido nas finanças ou na reputação.');
  }

  career.history.forEach((h, i) => {
    if (h.season !== i + 1) problems.push(`Histórico de temporadas fora de ordem: ${h.season}.`);
  });
  if (career.history.length !== career.season - 1) problems.push('Histórico de temporadas incompleto.');

  return problems;
}
