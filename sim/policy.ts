/**
 * O robô: a política simples que joga carreiras no lugar do jogador.
 *
 * É a mesma para o simulador (`npm run sim`), para os testes (`tests/helpers.ts`) e para os
 * relatórios de `npm run calibrate`. Ele só chama a API pública do motor, como a interface faz,
 * e nunca sorteia nada: com a mesma semente e a mesma política, a carreira é sempre igual.
 *
 * Mexer em qualquer decisão daqui muda os valores gravados em `tests/golden/simulation.json`
 * e a linha de base do simulador. Se for de propósito, regrave e explique no PR.
 */
import type { CareerState, Child, MomentRecord, PracticeProgram, QualifyingApproach, RaceMode } from '@/domain/schemas';
import { BIRTH_TRAITS } from '@/data/birth';
import { getCategory } from '@/data/categories';
import { FAMILY } from '@/data/family';
import * as engine from '@/engine';

export interface Choices {
  program?: PracticeProgram;
  approach?: QualifyingApproach;
  mode?: RaceMode;
  /** Índice da escolha em cada evento pendente (padrão: a primeira). */
  eventChoice?: number;
  /**
   * Como o robô responde aos lances decisivos (Fase 4). O padrão é 'style': ele não responde, e o
   * motor decide pelo estilo do piloto, como em "simular até o fim". 'safe' escolhe sempre a opção
   * menos arriscada e 'bold', sempre a mais arriscada: servem para medir quanto vale cada postura.
   */
  moments?: MomentPolicy;
}

export type MomentPolicy = 'style' | 'safe' | 'bold';

/** A opção de um lance pela política do robô: a menos ou a mais arriscada (na dúvida, a de maior chance). */
export function botMomentChoice(moment: engine.RaceMoment, policy: Exclude<MomentPolicy, 'style'>): engine.MomentChoice {
  const sign = policy === 'bold' ? 1 : -1;
  const pick = [...moment.options].sort((a, b) => sign * (b.risk - a.risk) || b.chance - a.chance)[0]!;
  return { option: pick.id, ...(moment.suggestedCompound ? { compound: moment.suggestedCompound } : {}) };
}

/**
 * Quem acompanha a corrida do robô por dentro. É o que o simulador usa para medir os lances (a
 * seção 9 do relatório): o registro gravado no resultado diz só a opção escolhida, e é o lance
 * pendente que traz as chances de todas as opções oferecidas. Acompanhar não muda a corrida.
 */
export interface RaceWatch {
  /** A cada lance do piloto: como foi oferecido (opções e chances) e como terminou. */
  onMoment?: (moment: engine.RaceMoment, record: MomentRecord) => void;
  /** A corrida terminada, antes de virar resultado (`career` é o fim de semana que a disputou). */
  onRace?: (race: engine.RaceSimState, career: CareerState) => void;
}

/**
 * Corre a etapa até a bandeirada com o engenheiro automático e a política de lances dada. Com a
 * política padrão o robô não responde a lance nenhum: o estilo do piloto decide, e a corrida é a
 * mesma de `simulateRemainingRace` ("simular até o fim"), com ou sem alguém acompanhando.
 */
export function botRace(career: CareerState, choices: Choices = {}, watch?: RaceWatch): engine.RaceSimState {
  const context = engine.buildRaceContext(career);
  const mode = choices.mode ?? 'balanced';
  const policy = choices.moments ?? 'style';
  let race = engine.createWeekendRace(career);
  if (policy === 'style' && !watch) return engine.simulateRemainingRace(race, context, { mode, auto: true });
  // Volta a volta: para responder aos lances (política própria) ou para mostrá-los a quem acompanha.
  // O resto continua com o engenheiro automático.
  while (!engine.isRaceFinished(race)) {
    const moment = race.pendingMoment;
    const resolved = race.moments.length;
    race = engine.stepRaceLap(race, context, { mode, pit: null, auto: true, moment: moment && policy !== 'style' ? botMomentChoice(moment, policy) : null });
    // Só conta o lance que o motor registrou nesta volta (o registro é o que vai para o resultado).
    const record = race.moments[resolved];
    if (moment && record) watch?.onMoment?.(moment, record);
  }
  watch?.onRace?.(race, career);
  return race;
}

/**
 * Bônus de talento: pontos somados a todos os atributos treináveis (e metade disso ao
 * potencial) do piloto do jogador. Representa um jogador que decide melhor que o robô:
 * 0 = mediano, 4 = bom, 8 = excelente.
 */
export function withTalent(career: CareerState, talent: number): CareerState {
  if (talent === 0) return career;
  const drivers = career.drivers.map((d) => {
    if (!d.isPlayer) return d;
    const attributes = { ...d.attributes };
    for (const key of engine.TRAINABLE_ATTRIBUTES) attributes[key] = Math.min(99, attributes[key] + talent);
    return { ...d, attributes, potential: Math.min(99, d.potential + talent / 2) };
  });
  return { ...career, drivers, playerSeasonStartAttributes: { ...drivers.find((d) => d.isPlayer)!.attributes } };
}

/** Resolve todos os eventos pendentes com a escolha de índice dado. */
export function resolvePending(career: CareerState, choiceIndex = 0): CareerState {
  let c = career;
  while (c.pendingEvents.length > 0) {
    const event = c.pendingEvents[0]!;
    const choice = event.choices[Math.min(choiceIndex, event.choices.length - 1)]!;
    c = engine.resolveEvent(c, event.id, choice.id).career;
  }
  return c;
}

/** Joga uma etapa inteira com o piloto automático. `watch` acompanha a corrida, se o piloto correr. */
export function playRound(career: CareerState, choices: Choices = {}, watch?: RaceWatch): CareerState {
  let c = engine.startWeekend(resolvePending(career, choices.eventChoice));
  if (!c.weekend!.playerParticipates) return engine.simulateAbsentWeekend(c);
  c = engine.runPractice(c, choices.program ?? 'setup');
  c = engine.runQualifying(c, choices.approach ?? 'balanced');
  return engine.completeWeekend(c, botRace(c, choices, watch));
}

export function playSeason(career: CareerState, choices: Choices = {}): CareerState {
  let c = career;
  while (c.nextRoundIndex < c.calendar.length) c = playRound(c, choices);
  return c;
}

/** Preferências do robô na escolha da proposta (Fase 6). Sem nenhuma, vale a escolha de sempre. */
export interface OfferPreference {
  /**
   * Fica com a proposta da equipe da família (`isFamilyTeamOffer`) quando ela está na categoria mais
   * alta entre as que o robô aceitaria, no lugar da equipe mais forte dessa categoria. Só a dinastia
   * do simulador usa: os testes, as receitas dos saves e o golden seguem com a escolha de sempre.
   */
  familyTeam?: boolean;
}

/**
 * Política do robô para o fim de temporada: aceita a melhor proposta que
 * consegue cumprir. Prefere a categoria mais alta e, dentro dela, a equipe
 * mais forte (ou a da família, com `preference.familyTeam`).
 */
export function pickBestOffer(career: CareerState, preference: OfferPreference = {}): string {
  const offers = (career.offseason?.offers ?? []).filter((o) => engine.canAcceptOffer(career, o));
  if (offers.length === 0) throw new Error('Nenhuma proposta aceitável (a rede de segurança deveria existir).');
  const strength = (categoryId: CareerState['categoryId'], teamId: string) => {
    const ranked = engine.rankTeams(engine.teamsOfCategory(career, categoryId));
    return ranked.length - ranked.findIndex((t) => t.id === teamId);
  };
  // Dentro da categoria, a equipe mais forte entre as que querem mesmo o piloto (interesse ≥ 60);
  // sem nenhuma assim, a de maior interesse. Evita assinar com uma equipe exigente demais.
  const keen = (o: (typeof offers)[number]) => (o.interest >= 60 || o.kind === 'continue' ? 1 : 0);
  // Antes de tudo, as contas: o robô prefere uma vaga que não o deixe devendo no fim do ano
  // (ou o contrato que já tem) a uma melhor que o endivide.
  const sound = (o: (typeof offers)[number]) => (o.kind === 'continue' || engine.financeProjection(career, o).projected >= 0 ? 1 : 0);
  const family = (o: (typeof offers)[number]) => (preference.familyTeam && engine.isFamilyTeamOffer(career, o) ? 1 : 0);
  offers.sort(
    (a, b) =>
      sound(b) - sound(a) ||
      getCategory(b.categoryId).tier - getCategory(a.categoryId).tier ||
      family(b) - family(a) ||
      keen(b) - keen(a) ||
      (keen(a) ? strength(b.categoryId, b.teamId) - strength(a.categoryId, a.teamId) : b.interest - a.interest),
  );
  return offers[0]!.id;
}

/** Como o robô conseguiu a vaga escolhida: com o que tinha ou por uma das portas (Fase 3). */
export type BotDoor = engine.DoorKey | 'none';

/**
 * Portas no fim do ano: o robô fica com a melhor proposta que consegue aceitar sozinho
 * (`pickBestOffer`), a não ser que uma porta paga (academia, vaquinha ou investidor, nesta ordem
 * de preço) abra uma vaga num degrau acima dela, ou qualquer vaga de verdade quando só sobrou a
 * de aluguel. Devolve a carreira com a porta já aberta e a proposta a assinar. `preference` vai para
 * `pickBestOffer`.
 */
export function botOffseason(career: CareerState, preference: OfferPreference = {}): { career: CareerState; offerId: string; door: BotDoor } {
  const strength = (categoryId: CareerState['categoryId'], teamId: string) => {
    const ranked = engine.rankTeams(engine.teamsOfCategory(career, categoryId));
    return ranked.length - ranked.findIndex((t) => t.id === teamId);
  };
  const best = pickBestOffer(career, preference);
  const bestTier = getCategory(career.offseason?.offers.find((o) => o.id === best)?.categoryId ?? career.categoryId).tier;
  const fallbackOnly = career.offseason?.offers.find((o) => o.id === best)?.kind === 'fallback';
  // Só vale abrir uma porta paga por uma vaga melhor do que a que o robô já consegue sozinho: um
  // degrau acima, ou qualquer vaga de verdade quando só sobrou a de aluguel.
  const wanted = engine
    .realOffers(career)
    .filter((o) => !engine.canAcceptOffer(career, o) && (fallbackOnly || getCategory(o.categoryId).tier > bestTier))
    .sort((a, b) => getCategory(b.categoryId).tier - getCategory(a.categoryId).tier || strength(b.categoryId, b.teamId) - strength(a.categoryId, a.teamId));
  // Dentro do degrau mais alto que abre, a porta mais barata: academia, vaquinha e, por último, investidor.
  const cost: Record<engine.DoorKey, number> = { own: 0, academy: 1, crowdfund: 2, investor: 3 };
  const options = wanted.flatMap((offer) => {
    const door = engine.doorFor(career, offer);
    return door === null ? [] : [{ offer, door }];
  });
  const topTier = Math.max(0, ...options.map((o) => getCategory(o.offer.categoryId).tier));
  const choice = options.filter((o) => getCategory(o.offer.categoryId).tier === topTier).sort((a, b) => cost[a.door] - cost[b.door])[0];
  if (choice) return { career: engine.openDoor(career, choice.offer, choice.door), offerId: choice.offer.id, door: choice.door };
  return { career, offerId: best, door: fallbackOnly ? 'none' : 'own' };
}

/**
 * Trabalho paralelo do robô: dá aulas de kart enquanto o caixa não cobre um ano de custos de
 * correr no campeonato atual (e a agenda deixa); com folga, só treina.
 */
export function botSideJob(career: CareerState): CareerState {
  if (career.mode !== 'driver') return career;
  const category = getCategory(career.categoryId);
  const yearCosts = engine.seasonRunningCosts(category.id, career.hub.id).total + category.economy.living + career.contract.seatCost;
  const job = engine.sideJobAllowed(category.id) && career.finance.cash < yearCosts ? 'instructor' : 'none';
  return job === career.sideJob ? career : engine.setSideJob(career, job);
}

/**
 * Política de treino do robô: velocidade enquanto houver margem (mais de 4
 * pontos até o potencial); depois, o grupo de atributos mais fraco. No começo
 * de cada temporada ele decide também o trabalho paralelo (`botSideJob`).
 */
export function botTraining(start: CareerState): CareerState {
  const career = botSideJob(start);
  const p = engine.getPlayer(career);
  const a = p.attributes;
  if (p.potential - a.pace > 4) return engine.setTrainingFocus(career, 'speed');
  const groups = {
    racecraft: (a.racecraft + a.defending + a.overtaking) / 3,
    consistency: (a.consistency + a.focus) / 2,
    tyres: a.tyreManagement,
    wet: a.wetSkill,
  } as const;
  const weakest = (Object.entries(groups) as [keyof typeof groups, number][]).sort((x, y) => x[1] - y[1])[0]![0];
  return engine.setTrainingFocus(career, weakest);
}

/** Joga uma carreira por várias temporadas com o robô. Chama `onSeasonEnd` no fechamento de cada uma. */
export function playCareer(career: CareerState, seasons: number, choices: Choices = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  for (let i = 0; i < seasons; i++) {
    c = playSeason(botTraining(c), choices);
    onSeasonEnd?.(c);
    const next = botOffseason(c);
    c = engine.startNextSeason(next.career, next.offerId);
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Vida inteira (piloto → dirigente → sucessão)                        */
/* ------------------------------------------------------------------ */

export interface LifePolicy {
  /** Idade em que o robô pendura o capacete. */
  retireAge?: number;
  /** Na sucessão, prefere um herdeiro que corra (padrão) ou um que só administre. */
  heir?: 'driver' | 'executive';
  /** Compra uma equipe se o dinheiro em caixa cobrir o preço com folga. */
  buyTeam?: boolean;
  /** Como dirigente, passa o comando em vida ao chegar a esta idade. */
  handoverAge?: number;
  /**
   * Como dirigente, passa o comando em vida assim que um filho com carreira de piloto chega a esta
   * idade (Fase 6). Com `transitionFirst`, espera o ano de transição, enquanto ele estiver ao alcance.
   */
  handoverHeirAge?: number;
  /**
   * No primeiro fechamento depois de parar de correr, faz o ano de transição antes de pensar em
   * comprar equipe ou aceitar cargo (Fase 6). Sem isto, o ano de transição só fica no lugar do ano
   * sem cargo: quando não há equipe ao alcance nem proposta.
   */
  transitionFirst?: boolean;
  /**
   * Como o robô escolhe quem herda as pistas: 'first' (o padrão de sempre) fica com o primeiro filho
   * que corre; 'outlook' (Fase 6) pontua quem pode correr pelo que se vê (`botChooseHeir`) e escolhe
   * também a vaga do herdeiro. Vale só com `heir: 'driver'` (o padrão).
   */
  heirChoice?: 'first' | 'outlook';
  /** No fim de cada temporada de piloto, prefere a equipe da família (`OfferPreference.familyTeam`). */
  familyTeamFirst?: boolean;
  choices?: Choices;
}

/** A ordem em que o robô escolhe o papel do ano de transição (o primeiro disponível). */
export const BOT_TRANSITION_ORDER = ['commentator', 'ambassador', 'mentor'] as const;

/**
 * Quanto o robô dá a cada coisa que se sabe de um herdeiro que pode correr (`heirOutlook`), na
 * escolha pelo que se vê (`botChooseHeir`). É política do robô, não regra do jogo.
 */
export const BOT_HEIR_SCORE = {
  /**
   * Por degrau da categoria em que o herdeiro corre (quem não corre, nada). Pesa menos que a
   * avaliação dos treinadores: o degrau de agora diz onde o filho está; a avaliação, até onde ele vai.
   */
  TIER: 4,
  /** Pelo veredito do teste no kart (sem teste, nada). */
  KART_TEST: { outstanding: 6, promising: 3, average: 0, limited: -4 },
  /** Pela avaliação dos treinadores, pelo rótulo que ela mostra (sem avaliação, nada). */
  SCOUT: { 'Fora de série': 12, 'Muito promissor': 8, Promissor: 4, Mediano: 0, Limitado: -6 } as Readonly<Record<string, number>>,
  /** Por talento revelado; cada defeito revelado tira o mesmo. */
  TRAIT: 3,
  /** Por ano de idade acima de YOUTH_AGE: quem é mais velho tem menos temporadas pela frente. */
  AGE: 1,
  YOUTH_AGE: 18,
} as const;

/** A ordem em que o robô escolhe a vaga do herdeiro piloto (a primeira disponível). */
export const BOT_HEIR_SEAT_ORDER = ['top', 'family', 'current'] as const satisfies readonly engine.HeirSeat[];

/** A pontuação que o robô dá a um herdeiro pelo que se sabe dele (`BOT_HEIR_SCORE`). */
export function botHeirScore(outlook: engine.HeirOutlook): number {
  const score = BOT_HEIR_SCORE;
  const talents = outlook.revealed.filter((t) => t.kind === 'talent').length;
  const defects = outlook.revealed.length - talents;
  return (
    (outlook.tier ?? 0) * score.TIER +
    (outlook.kartTest ? score.KART_TEST[outlook.kartTest.verdict] : 0) +
    (outlook.scout ? (score.SCOUT[outlook.scout] ?? 0) : 0) +
    (talents - defects) * score.TRAIT -
    Math.max(0, outlook.age - score.YOUTH_AGE) * score.AGE
  );
}

/**
 * Escolha do herdeiro piloto pelo que se vê (Fase 6): entre os filhos que já correm, o de maior
 * pontuação (`botHeirScore`; no empate, a ordem da sucessão), e a vaga pela ordem BOT_HEIR_SEAT_ORDER
 * entre as disponíveis (`heirSeatOptions`). O parente jovem só herda quando nenhum filho pode correr:
 * é a mesma condição da passagem de comando (`botWantsHandover`, que dispara quando um filho piloto
 * cresce), e sem ela ele ganharia de todo filho com um defeito revelado, porque dele não se sabe nada.
 * null se ninguém pode correr.
 */
export function botChooseHeir(career: CareerState): { heirId: string; seat: engine.HeirSeat } | null {
  const drivers = (career.succession?.heirs ?? []).filter((heir) => heir.canDrive);
  const children = drivers.filter((heir) => heir.kind === 'child');
  const scored = (children.length > 0 ? children : drivers)
    .map((heir, order) => ({ heir, order, score: botHeirScore(engine.heirOutlook(career, heir)) }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const best = scored[0];
  if (!best) return null;
  const options = engine.heirSeatOptions(career, best.heir.id);
  const seat = BOT_HEIR_SEAT_ORDER.find((id) => options.some((o) => o.id === id && o.available)) ?? 'current';
  return { heirId: best.heir.id, seat };
}

/**
 * O que se vê de um filho antes de ele correr, na escala de `botHeirScore` sem o degrau e a idade:
 * a avaliação dos treinadores, o teste no kart e os talentos e defeitos já revelados.
 */
export function botChildProspect(child: Child): number {
  const score = BOT_HEIR_SCORE;
  const scout = engine.childScoutReport(child);
  const verdict = child.kartTest ? engine.kartTestVerdict(child.kartTest.gap) : null;
  const revealed = child.birthTraits.filter((t) => t.revealedSeason !== null);
  const talents = revealed.filter((t) => BIRTH_TRAITS[t.id].kind === 'talent').length;
  return (scout ? (score.SCOUT[scout] ?? 0) : 0) + (verdict ? score.KART_TEST[verdict] : 0) + (talents - (revealed.length - talents)) * score.TRAIT;
}

/**
 * O robô dirigente passa o comando em vida neste fechamento? Aos `handoverAge` anos ou, com
 * `handoverHeirAge`, assim que um filho com carreira de piloto chega a essa idade. Com
 * `transitionFirst`, espera o ano de transição enquanto algum papel estiver ao alcance. Com
 * `heirChoice: 'outlook'`, espera também enquanto um irmão mais novo, que ainda não corre mas quer
 * correr, parecer mais promissor que todos os filhos já prontos (como faria quem escolhe o herdeiro
 * pelo que vê); a idade `handoverAge` encerra a espera.
 */
export function botWantsHandover(career: CareerState, policy: LifePolicy): boolean {
  if (career.mode !== 'executive' || !career.executiveOffseason) return false;
  if (policy.transitionFirst && engine.transitionOffers(career).some((o) => o.available)) return false;
  if (policy.handoverAge !== undefined && engine.getPlayer(career).age >= policy.handoverAge) return true;
  const heirAge = policy.handoverHeirAge;
  if (heirAge === undefined) return false;
  const children = career.family.children;
  const ready = children.filter((k) => k.stage === 'racing' && k.driver !== null && k.racing !== null && k.age >= heirAge);
  if (ready.length === 0) return false;
  if (policy.heirChoice !== 'outlook') return true;
  const best = Math.max(...ready.map(botChildProspect));
  // Um irmão que corre mas ainda não tem a idade, ou que ainda vai começar (quer correr), e parece melhor.
  const coming = children.some(
    (k) =>
      !ready.includes(k) &&
      (k.stage === 'racing' || ((k.stage === 'child' || k.stage === 'karting') && k.interest >= FAMILY.CAREER_INTEREST)) &&
      botChildProspect(k) > best,
  );
  return !coming;
}

/** O ano de transição no primeiro papel disponível na ordem do robô, ou null fora da janela. */
function botTransition(career: CareerState): CareerState | null {
  const offers = engine.transitionOffers(career);
  const role = BOT_TRANSITION_ORDER.find((r) => offers.some((o) => o.role === r && o.available));
  return role ? engine.startExecutiveSeason(career, { kind: 'transition', role }) : null;
}

/** Joga uma etapa no modo dirigente (o jogador não corre). */
export function playExecutiveRound(career: CareerState, choices: Choices = {}): CareerState {
  const c = engine.startWeekend(resolvePending(career, choices.eventChoice));
  return engine.simulateAbsentWeekend(c, { program: choices.program ?? 'setup', approach: choices.approach ?? 'balanced' });
}

/** Decisão do robô no fechamento de uma temporada como dirigente. */
export function botExecutiveOffseason(career: CareerState, policy: LifePolicy = {}): CareerState {
  let c = resolvePending(career, policy.choices?.eventChoice);
  const off = c.executiveOffseason;
  if (!off) throw new Error('Sem fechamento de dirigente.');
  if (c.management && !off.dismissed) {
    // Preenche as cotas de patrocínio com as propostas mais altas.
    for (const offer of [...off.sponsorOffers].sort((a, b) => b.perSeason - a.perSeason)) {
      if ((c.management?.sponsors.length ?? 3) < 3) c = engine.acceptTeamSponsor(c, offer.id);
    }
    return engine.startExecutiveSeason(c, { kind: 'continue' });
  }
  if (policy.transitionFirst) {
    const transition = botTransition(c);
    if (transition) return transition;
  }
  if (policy.buyTeam) {
    const affordable = off.listings.filter((l) => l.price <= c.finance.cash * 0.6).sort((a, b) => b.price - a.price)[0];
    if (affordable) return engine.startExecutiveSeason(c, { kind: 'buy', listingId: affordable.id });
  }
  const job = off.jobOffers[0];
  if (job) return engine.startExecutiveSeason(c, { kind: 'job', offerId: job.id });
  // Sem equipe comprada nem cargo aceito: o ano de transição no lugar do ano sem cargo (Fase 6).
  return botTransition(c) ?? engine.startExecutiveSeason(c, { kind: 'spectate' });
}

/**
 * Escolha do robô em uma sucessão. Com `heirChoice: 'outlook'`, quem herda as pistas e a vaga dele
 * saem de `botChooseHeir`; senão, vale a escolha de sempre (o primeiro filho que corre, na equipe em
 * que já corria), que os testes e as receitas dos saves de exemplo usam.
 */
export function botSuccession(career: CareerState, policy: LifePolicy = {}): CareerState {
  const heirs = career.succession?.heirs ?? [];
  const preferDriver = (policy.heir ?? 'driver') === 'driver';
  if (preferDriver && policy.heirChoice === 'outlook') {
    const choice = botChooseHeir(career);
    if (choice) return engine.resolveSuccession(career, choice.heirId, 'driver', choice.seat);
  }
  const driver = heirs.find((h) => h.kind === 'child' && h.canDrive) ?? heirs.find((h) => h.canDrive);
  const manager = heirs.find((h) => h.kind === 'child' && h.canManage) ?? heirs.find((h) => h.kind === 'partner') ?? heirs.find((h) => h.canManage);
  const pick = preferDriver ? (driver ?? manager) : (manager ?? driver);
  if (!pick) throw new Error('Sucessão sem herdeiro.');
  return engine.resolveSuccession(
    career,
    pick.id,
    pick === driver && (preferDriver || !manager) ? 'driver' : pick.canManage && !(preferDriver && pick.canDrive) ? 'executive' : 'driver',
  );
}

/**
 * Joga uma temporada completa de uma "vida": corre enquanto é piloto,
 * aposenta-se na idade definida, dirige ou acompanha depois, e resolve as
 * sucessões que aparecerem. Devolve o estado no começo da temporada seguinte.
 */
export function playLifeSeason(career: CareerState, policy: LifePolicy = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  if (c.succession) return botSuccession(c, policy);
  if (c.mode === 'driver') {
    c = botTraining(c);
    while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playRound(c, policy.choices);
    onSeasonEnd?.(c);
    if (c.succession) return botSuccession(c, policy);
    // Primeiro as decisões pendentes, depois a proposta: o desfecho de um evento pode tirar o
    // dinheiro ou a reputação que a proposta escolhida antes exigia.
    const settled = resolvePending(c);
    if (engine.getPlayer(settled).age >= (policy.retireAge ?? 36)) return engine.retireFromDriving(settled);
    const next = botOffseason(settled, { familyTeam: policy.familyTeamFirst });
    return engine.startNextSeason(next.career, next.offerId);
  }
  while (c.nextRoundIndex < c.calendar.length && !c.succession) c = playExecutiveRound(c, policy.choices);
  onSeasonEnd?.(c);
  if (c.succession) return botSuccession(c, policy);
  if (botWantsHandover(c, policy)) return botSuccession(engine.beginHandover(resolvePending(c)), policy);
  return botExecutiveOffseason(c, policy);
}

export function playLife(career: CareerState, seasons: number, policy: LifePolicy = {}, onSeasonEnd?: (c: CareerState) => void): CareerState {
  let c = career;
  // Cada chamada avança no máximo uma temporada; sucessões e aposentadorias são passos extras.
  for (let guard = 0; guard < seasons * 3 && c.season < career.season + seasons; guard++) c = playLifeSeason(c, policy, onSeasonEnd);
  return c;
}
