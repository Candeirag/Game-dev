/**
 * Catálogo de eventos dinâmicos.
 *
 * Cada evento tem uma condição ligada ao estado do jogo (resultado da etapa,
 * rivalidades, finanças, contrato, patrocinadores) e escolhas com
 * consequências reais: os efeitos alteram moral, confiança, reputação,
 * dinheiro, contrato, grid da próxima corrida, pontos do campeonato e mais.
 * Nenhum evento é só texto.
 *
 * - "guaranteed": acontece sempre que a condição vale.
 * - "random": entra no sorteio da etapa, com o peso indicado.
 */
import type { Academy, CareerState, Driver, Effect, EventCategory, EventChoice, PendingEvent, RaceEntryResult, RoundRecord, Team } from '@/domain/schemas';
import type { CategoryDefinition } from '@/data/categories';
import { F1_TEAM_NAMES, f1TeamId } from '@/data/teams';
import { buildSponsor, commercialSponsors, sponsorTierFor, SPONSOR_RULES } from '../career/sponsors';
import { fullName, teamKey } from '../career/selectors';
import { hashSeed } from '../rng';
import { overallRating } from '../simulation/performance';
import { money } from '../career/selectors';

export interface EventContext {
  career: CareerState;
  player: Driver;
  team: Team;
  teammate: Driver | null;
  category: CategoryDefinition;
  /** Etapa recém-disputada (null no início da temporada). */
  record: RoundRecord | null;
  entry: RaceEntryResult | null;
  /** Posição do jogador no campeonato. */
  position: number;
  round: number;
  seed: number;
}

export type EventContent = Pick<PendingEvent, 'title' | 'body' | 'choices'>;

export interface EventDefinition {
  id: string;
  category: EventCategory;
  kind: 'guaranteed' | 'random';
  maxPerSeason: number;
  weight: number;
  /** Devolve o conteúdo do evento, ou null se a condição não vale agora. */
  build(ctx: EventContext): EventContent | null;
}

/* ---------------- Construtores ---------------- */

type Stat = Extract<Effect, { type: 'stat' }>['stat'];
/**
 * A reputação anda devagar (cerca de 10 pontos separam um degrau do seguinte),
 * então os eventos mexem nela pela metade do valor nominal dos outros
 * indicadores.
 */
const REPUTATION_SCALE = 0.5;
const stat = (name: Stat, value: number): Effect => ({ type: 'stat', stat: name, value: name === 'reputation' ? value * REPUTATION_SCALE : value });
const rivalry = (driverId: string, value: number): Effect => ({ type: 'rivalry', driverId, value });
const sponsors = (value: number, sponsorId: string | null = null): Effect => ({ type: 'sponsorSatisfaction', sponsorId, value });
const cash = (value: number, label: string): Effect => ({ type: 'cash', value, ledger: 'event', label });
const sure = (text: string, ...effects: Effect[]): EventChoice['outcomes'] => [{ probability: 1, text, effects }];
const odds = (...items: [probability: number, text: string, effects: Effect[]][]): EventChoice['outcomes'] =>
  items.map(([probability, text, effects]) => ({ probability, text, effects }));
const choice = (id: string, label: string, description: string, outcomes: EventChoice['outcomes']): EventChoice => ({ id, label, description, outcomes });

const nameOf = (ctx: EventContext, id: string) => {
  const d = ctx.career.drivers.find((x) => x.id === id);
  return d ? fullName(d) : 'um rival';
};

/** Outro piloto envolvido em um toque com o jogador nesta corrida. */
function incidentWithPlayer(ctx: EventContext): { otherId: string; playerAttacked: boolean; causedDnf: boolean } | null {
  const id = ctx.player.id;
  for (const e of ctx.record?.race.events ?? []) {
    if (!e.otherDriverId || (e.type !== 'collision' && e.type !== 'dnf')) continue;
    if (e.driverId !== id && e.otherDriverId !== id) continue;
    return {
      otherId: e.driverId === id ? e.otherDriverId : e.driverId,
      playerAttacked: e.type === 'collision' && e.driverId === id,
      causedDnf: e.type === 'dnf',
    };
  }
  return null;
}

function topRival(ctx: EventContext): { id: string; value: number } | null {
  const entries = Object.entries(ctx.career.relations.rivalries).filter(([id]) => ctx.career.drivers.some((d) => d.id === id && d.teamId));
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return top ? { id: top[0], value: top[1] } : null;
}

/* ---------------- Catálogo ---------------- */

export const EVENT_DEFINITIONS: readonly EventDefinition[] = [
  /* ===== Entrevistas ===== */
  {
    id: 'interview-win',
    category: 'interview',
    kind: 'guaranteed',
    maxPerSeason: 3,
    weight: 0,
    build(ctx) {
      if (ctx.entry?.status !== 'finished' || ctx.entry.position !== 1) return null;
      const second = ctx.record?.race.entries[1]?.driverId;
      return {
        title: 'Coletiva do vencedor',
        body: `Você venceu a etapa ${ctx.round}. Na coletiva, perguntam a que você atribui a vitória.`,
        choices: [
          choice(
            'team',
            'Dividir o mérito com a equipe',
            'Fortalece a relação com a equipe e com o companheiro.',
            sure('A equipe agradece o reconhecimento público.', stat('teamTrust', 5), stat('teammateRelation', 2), stat('morale', 2)),
          ),
          choice(
            'bold',
            'Dizer que é só o começo',
            'Mais confiança e visibilidade, mas provoca os rivais.',
            sure(
              'A frase vira manchete e os rivais tomam nota.',
              stat('confidence', 6),
              stat('reputation', 2),
              stat('teamTrust', -1),
              ...(second ? [rivalry(second, 10)] : []),
            ),
          ),
          choice(
            'sponsors',
            'Dedicar aos patrocinadores',
            'Agrada a quem paga a conta.',
            sure('Os patrocinadores ganham destaque na cobertura.', sponsors(8), stat('reputation', 1)),
          ),
        ],
      };
    },
  },
  {
    id: 'interview-slump',
    category: 'interview',
    kind: 'guaranteed',
    maxPerSeason: 2,
    weight: 0,
    build(ctx) {
      if (ctx.round < 3 || ctx.player.condition.form >= 32) return null;
      return {
        title: 'Pressão da imprensa',
        body: 'Depois de uma sequência de resultados abaixo do esperado, um repórter pergunta o que está dando errado.',
        choices: [
          choice(
            'own',
            'Assumir a responsabilidade',
            'A equipe valoriza a postura, mas a autocrítica pesa.',
            sure('A equipe fecha com você, e os patrocinadores gostam do tom.', stat('teamTrust', 5), stat('confidence', -3), sponsors(2)),
          ),
          choice(
            'car',
            'Culpar o equipamento',
            'Preserva a sua confiança, mas expõe a equipe.',
            odds(
              [0.7, 'Os mecânicos não gostaram do que leram.', [stat('teamTrust', -8), stat('confidence', 4)]],
              [0.3, 'A declaração vira manchete e pega mal.', [stat('teamTrust', -8), stat('confidence', 4), stat('reputation', -3)]],
            ),
          ),
          choice(
            'silent',
            'Não comentar',
            'Evita o desgaste, mas passa a imagem de piloto acuado.',
            sure('A imprensa registra o silêncio.', stat('reputation', -1)),
          ),
        ],
      };
    },
  },

  /* ===== Polêmicas ===== */
  {
    id: 'controversy-collision',
    category: 'controversy',
    kind: 'guaranteed',
    maxPerSeason: 3,
    weight: 0,
    build(ctx) {
      const incident = incidentWithPlayer(ctx);
      if (!incident || incident.playerAttacked) return null;
      const other = nameOf(ctx, incident.otherId);
      return {
        title: `Toque com ${other}`,
        body: `${other} se envolveu em um toque com você na etapa ${ctx.round}${incident.causedDnf ? ', e a corrida acabou ali para um dos dois' : ''}. Os microfones estão apontados para você.`,
        choices: [
          choice(
            'attack',
            `Criticar ${other} publicamente`,
            'Alimenta a rivalidade. A reação do público é imprevisível.',
            odds(
              [0.6, 'A torcida fica do seu lado.', [rivalry(incident.otherId, 20), stat('reputation', 2)]],
              [0.4, 'O tom soou exagerado e os patrocinadores não gostaram.', [rivalry(incident.otherId, 20), stat('reputation', -3), sponsors(-5)]],
            ),
          ),
          choice(
            'private',
            'Conversar em particular',
            'Esfria a situação longe das câmeras.',
            sure('Vocês se entendem no motorhome.', rivalry(incident.otherId, -10), stat('teamTrust', 2)),
          ),
          choice('ignore', 'Deixar passar', 'Sem polêmica, mas o incômodo fica.', sure('Você engole a frustração.', stat('confidence', -2))),
        ],
      };
    },
  },
  {
    id: 'controversy-social',
    category: 'controversy',
    kind: 'random',
    maxPerSeason: 1,
    weight: 2,
    build(ctx) {
      if (ctx.career.reputation < 15) return null;
      return {
        title: 'Vídeo polêmico',
        body: 'Um trecho de uma entrevista sua, fora de contexto, viralizou. Parece que você menospreza a categoria em que corre.',
        choices: [
          choice(
            'apologise',
            'Esclarecer e pedir desculpas',
            'Encerra o assunto com pouco dano.',
            sure('O assunto esfria em poucos dias.', stat('reputation', -1), sponsors(3)),
          ),
          choice(
            'ignore',
            'Ignorar',
            'Pode passar sozinho. Ou não.',
            odds([0.5, 'A internet achou outro assunto.', []], [0.5, 'O silêncio foi lido como confirmação.', [stat('reputation', -4), sponsors(-10)]]),
          ),
          choice(
            'double',
            'Dobrar a aposta',
            'Você diz que foi isso mesmo que quis dizer.',
            odds(
              [0.3, 'A sinceridade conquista parte do público.', [stat('confidence', 4), stat('reputation', 4), sponsors(-8)]],
              [0.7, 'A polêmica cresce e os patrocinadores cobram explicações.', [stat('confidence', 4), stat('reputation', -5), sponsors(-14)]],
            ),
          ),
        ],
      };
    },
  },

  /* ===== Rivalidades ===== */
  {
    id: 'rivalry-provocation',
    category: 'rivalry',
    kind: 'random',
    maxPerSeason: 2,
    weight: 5,
    build(ctx) {
      const rival = topRival(ctx);
      if (!rival || rival.value < 35) return null;
      const other = nameOf(ctx, rival.id);
      const fine = ctx.category.economy.living * 0.1;
      return {
        title: `${other} provoca`,
        body: `${other} declarou à imprensa que você "só anda bem quando ninguém aperta". A rivalidade entre vocês já afeta as disputas na pista.`,
        choices: [
          choice(
            'reply',
            'Responder na mesma moeda',
            'Aumenta a tensão. Pode render multa.',
            odds(
              [0.7, 'A troca de farpas esquenta o campeonato.', [rivalry(rival.id, 12), stat('confidence', 4), sponsors(-4)]],
              [
                0.3,
                `Os comissários multam os dois em ${money(ctx.career, fine)} por conduta antidesportiva.`,
                [rivalry(rival.id, 15), stat('reputation', -3), cash(-fine, 'Multa por conduta antidesportiva')],
              ],
            ),
          ),
          choice(
            'track',
            'Responder na pista',
            'Usa a provocação como combustível.',
            sure('Você guarda a resposta para a próxima largada.', stat('confidence', 2), stat('morale', 3), rivalry(rival.id, 4)),
          ),
          choice(
            'truce',
            'Propor uma trégua',
            'Reduz o risco de toques entre vocês.',
            sure('Vocês apertam as mãos diante das câmeras.', rivalry(rival.id, -25), stat('reputation', 2), stat('confidence', -2)),
          ),
        ],
      };
    },
  },
  {
    id: 'rivalry-teammate',
    category: 'rivalry',
    kind: 'guaranteed',
    maxPerSeason: 2,
    weight: 0,
    build(ctx) {
      if (!ctx.teammate) return null;
      const ignoredOrder = ctx.record?.race.teamOrders.some((o) => o.askedDriverId === ctx.player.id && !o.obeyed) ?? false;
      if (!ignoredOrder && ctx.career.relations.teammate >= 25) return null;
      const mate = fullName(ctx.teammate);
      return {
        title: 'Clima pesado nos boxes',
        body: ignoredOrder
          ? `Você ignorou a ordem para deixar ${mate} passar. O chefe de equipe convocou os dois para uma reunião.`
          : `A relação com ${mate} chegou ao limite, e o chefe de equipe convocou os dois para uma reunião.`,
        choices: [
          choice(
            'sorry',
            'Pedir desculpas',
            'Recupera a confiança da equipe, ao custo do orgulho.',
            sure('A equipe considera o assunto encerrado.', stat('teamTrust', 7), stat('teammateRelation', 10), stat('confidence', -3)),
          ),
          choice(
            'stand',
            'Manter a posição',
            '"Estou aqui para vencer, não para abrir caminho."',
            sure(
              'A imprensa adora; a equipe, nem tanto.',
              stat('confidence', 5),
              stat('reputation', 2),
              stat('teamTrust', -7),
              stat('teammateRelation', -10),
              rivalry(ctx.teammate.id, 15),
            ),
          ),
        ],
      };
    },
  },

  /* ===== Investigações ===== */
  {
    id: 'investigation-collision',
    category: 'investigation',
    kind: 'guaranteed',
    maxPerSeason: 3,
    weight: 0,
    build(ctx) {
      const incident = incidentWithPlayer(ctx);
      if (!incident?.playerAttacked) return null;
      const other = nameOf(ctx, incident.otherId);
      return {
        title: 'Convocado pelos comissários',
        body: `Os comissários abriram uma investigação pós-corrida sobre o seu toque em ${other}. A decisão vale para o grid da próxima etapa.`,
        choices: [
          choice(
            'accept',
            'Aceitar a responsabilidade',
            'Punição certa, mas branda.',
            sure(
              'Você perde 3 posições no próximo grid e recebe 1 ponto na licença.',
              { type: 'gridPenalty', driverId: ctx.player.id, places: 3 },
              { type: 'penaltyPoints', value: 1 },
              stat('reputation', 1),
            ),
          ),
          choice(
            'defend',
            'Defender-se na audiência',
            'Pode sair limpo ou piorar a punição.',
            odds(
              [0.45, 'Os comissários aceitam a sua versão: incidente de corrida.', [stat('confidence', 3)]],
              [
                0.55,
                'Os comissários não se convencem: 5 posições no próximo grid e 2 pontos na licença.',
                [
                  { type: 'gridPenalty', driverId: ctx.player.id, places: 5 },
                  { type: 'penaltyPoints', value: 2 },
                ],
              ],
            ),
          ),
          choice(
            'blame',
            `Culpar ${other}`,
            'Arriscado: se não colar, a punição e a rivalidade aumentam.',
            odds(
              [
                0.3,
                `${other} é considerado culpado e perde 3 posições no próximo grid.`,
                [{ type: 'gridPenalty', driverId: incident.otherId, places: 3 }, rivalry(incident.otherId, 18)],
              ],
              [
                0.7,
                'A versão não se sustenta nas imagens: 5 posições no grid, 2 pontos na licença e a imagem arranhada.',
                [
                  { type: 'gridPenalty', driverId: ctx.player.id, places: 5 },
                  { type: 'penaltyPoints', value: 2 },
                  stat('reputation', -3),
                  rivalry(incident.otherId, 12),
                ],
              ],
            ),
          ),
        ],
      };
    },
  },
  {
    id: 'investigation-technical',
    category: 'investigation',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      if (ctx.entry?.status !== 'finished' || ctx.entry.position > 5 || ctx.entry.points <= 0) return null;
      const points = ctx.entry.points;
      const dsq: Effect = { type: 'pointsAdjustment', driverId: ctx.player.id, points: -points, reason: `Irregularidade técnica na etapa ${ctx.round}` };
      return {
        title: 'Vistoria técnica',
        body: `Depois do seu ${ctx.entry.position}º lugar, o ${ctx.category.machine} foi retido para uma vistoria detalhada. A equipe pergunta como você quer se posicionar.`,
        choices: [
          choice(
            'open',
            'Colaborar abertamente',
            'Menor risco, mas a equipe se sente exposta.',
            odds(
              [0.88, 'A vistoria não encontra nada de errado.', [stat('teamTrust', -1)]],
              [0.12, `Uma peça fora da medida custa os ${points} pontos da etapa.`, [dsq, stat('teamTrust', -2)]],
            ),
          ),
          choice(
            'team',
            'Seguir a linha da equipe e negar tudo',
            'A equipe agradece, mas o risco é maior.',
            odds(
              [0.72, 'A vistoria termina sem punição.', [stat('teamTrust', 4)]],
              [
                0.28,
                `Os comissários encontram a irregularidade: você perde os ${points} pontos da etapa, e a postura pega mal.`,
                [dsq, stat('reputation', -4)],
              ],
            ),
          ),
        ],
      };
    },
  },

  /* ===== Protestos ===== */
  {
    id: 'protest-rival',
    category: 'protest',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      const entries = ctx.record?.race.entries ?? [];
      const mine = ctx.entry;
      if (mine?.status !== 'finished' || mine.position < 2) return null;
      const ahead = entries[mine.position - 2];
      if (!ahead || ahead.points <= 0 || ahead.teamId === mine.teamId) return null;
      const other = nameOf(ctx, ahead.driverId);
      const fee = Math.round(ctx.category.economy.living * 0.12);
      return {
        title: 'Protesto contra um rival',
        body: `A equipe desconfia do ${ctx.category.machine} de ${other}, que terminou logo à sua frente, e quer protestar o resultado. A taxa do protesto, de ${money(ctx.career, fee)}, seria dividida com você.`,
        choices: [
          choice(
            'support',
            'Apoiar o protesto',
            `Custa ${money(ctx.career, fee)}. Se for aceito, ${other} perde os pontos da etapa.`,
            odds(
              [
                0.35,
                `Protesto aceito: ${other} perde ${ahead.points} pontos.`,
                [
                  cash(-fee, 'Taxa de protesto'),
                  { type: 'pointsAdjustment', driverId: ahead.driverId, points: -ahead.points, reason: `Protesto aceito na etapa ${ctx.round}` },
                  rivalry(ahead.driverId, 20),
                  stat('teamTrust', 3),
                ],
              ],
              [
                0.65,
                'Protesto rejeitado. A taxa não é devolvida e o paddock não gostou.',
                [cash(-fee, 'Taxa de protesto'), stat('reputation', -3), rivalry(ahead.driverId, 12)],
              ],
            ),
          ),
          choice(
            'decline',
            'Desaconselhar o protesto',
            'Resolve-se na pista.',
            sure('A equipe desiste, um pouco contrariada.', stat('teamTrust', -2), stat('reputation', 1)),
          ),
        ],
      };
    },
  },
  {
    id: 'protest-against',
    category: 'protest',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      const mine = ctx.entry;
      if (mine?.status !== 'finished' || mine.position > 3) return null;
      const behind = ctx.record?.race.entries[mine.position];
      if (!behind) return null;
      const other = nameOf(ctx, behind.driverId);
      const expert = Math.round(ctx.category.economy.living * 0.15);
      const loss: Effect = { type: 'pointsAdjustment', driverId: ctx.player.id, points: -mine.points, reason: `Protesto aceito na etapa ${ctx.round}` };
      return {
        title: 'Seu resultado sob protesto',
        body: `A equipe de ${other} protestou o seu ${mine.position}º lugar, alegando irregularidade no ${ctx.category.machine}. O resultado fica sob análise.`,
        choices: [
          choice(
            'quiet',
            'Confiar na equipe',
            'Sem custo. A decisão fica com os comissários.',
            odds(
              [0.8, 'Protesto rejeitado: o resultado está mantido.', [stat('confidence', 2)]],
              [0.2, `Protesto aceito: você perde os ${mine.points} pontos da etapa.`, [loss, stat('morale', -6)]],
            ),
          ),
          choice(
            'expert',
            'Contratar um perito independente',
            `Custa ${money(ctx.career, expert)}, mas reduz muito o risco.`,
            odds(
              [0.94, 'O laudo do perito encerra o caso a seu favor.', [cash(-expert, 'Perito técnico')]],
              [
                0.06,
                `Mesmo com o laudo, o protesto é aceito: você perde os ${mine.points} pontos.`,
                [cash(-expert, 'Perito técnico'), loss, stat('morale', -6)],
              ],
            ),
          ),
          choice(
            'press',
            'Rebater na imprensa',
            'Não muda a análise, mas marca posição.',
            odds(
              [0.8, 'Protesto rejeitado, e a troca de acusações fica registrada.', [rivalry(behind.driverId, 12), stat('reputation', 1)]],
              [0.2, `Protesto aceito: você perde os ${mine.points} pontos e sai mal na foto.`, [loss, rivalry(behind.driverId, 12), stat('reputation', -3)]],
            ),
          ),
        ],
      };
    },
  },

  /* ===== Problemas contratuais ===== */
  {
    id: 'contract-seat-increase',
    category: 'contract',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      const seat = ctx.career.contract.seatCost;
      if (seat <= 0 || ctx.round < 2 || ctx.round >= ctx.career.calendar.length - 1) return null;
      const extra = Math.round((seat * 0.12) / 100) * 100;
      return {
        title: 'A equipe pede um aporte extra',
        body: `Um patrocinador da ${ctx.team.name} não honrou o contrato. A equipe pede ${money(ctx.career, extra)} a mais para manter o programa de desenvolvimento até o fim do ano.`,
        choices: [
          choice(
            'pay',
            `Pagar ${money(ctx.career, extra)}`,
            'A equipe mantém o desenvolvimento e fica em dívida com você.',
            sure('O aporte garante as atualizações previstas.', cash(-extra, 'Aporte extra à equipe'), stat('teamTrust', 7)),
          ),
          choice(
            'refuse',
            'Recusar',
            'Sem custo agora, mas a equipe pode cortar o desenvolvimento.',
            odds(
              [0.6, 'A equipe aperta o cinto e segue como dá.', [stat('teamTrust', -8)]],
              [
                0.4,
                `Sem dinheiro, a equipe cancela as atualizações: o ${ctx.category.machine} perde rendimento.`,
                [stat('teamTrust', -8), { type: 'carUpgrade', value: -1.5 }],
              ],
            ),
          ),
          choice(
            'split',
            'Propor parcelar no contrato',
            'O custo anual da vaga sobe 8%.',
            sure('A equipe aceita diluir o valor nas próximas parcelas.', { type: 'seatCost', value: seat * 0.08 }, stat('teamTrust', 1)),
          ),
        ],
      };
    },
  },
  {
    id: 'contract-approach',
    category: 'contract',
    kind: 'random',
    maxPerSeason: 1,
    weight: 4,
    build(ctx) {
      if (ctx.round < Math.ceil(ctx.career.calendar.length / 2)) return null;
      const ownKey = teamKey(ctx.career.categoryId, ctx.team.id);
      const best = Object.entries(ctx.career.marketInterest)
        .filter(([key]) => key !== ownKey)
        .sort((a, b) => b[1] - a[1])[0];
      if (!best || best[1] < 60) return null;
      return {
        title: 'Sondagem de outra equipe',
        body: 'O empresário de uma equipe interessada em você pede uma conversa reservada sobre a próxima temporada. A sua equipe atual não sabe.',
        choices: [
          choice(
            'listen',
            'Ouvir a proposta',
            'Aumenta o interesse deles, mas a conversa pode vazar.',
            odds(
              [0.65, 'A conversa foi boa e ficou entre vocês.', [{ type: 'interest', teamKey: best[0], value: 12 }]],
              [
                0.35,
                'A reunião vazou para a imprensa e a sua equipe ficou sabendo.',
                [{ type: 'interest', teamKey: best[0], value: 12 }, stat('teamTrust', -10), stat('teammateRelation', -3)],
              ],
            ),
          ),
          choice(
            'refuse',
            'Recusar e reafirmar o compromisso',
            'A equipe atual valoriza a lealdade.',
            sure('Você avisa o seu chefe de equipe, que agradece a franqueza.', stat('teamTrust', 6), { type: 'interest', teamKey: best[0], value: -10 }),
          ),
          choice(
            'leverage',
            'Usar a sondagem para pressionar a equipe atual',
            'Pode reduzir a sua multa rescisória, ou só irritar a equipe.',
            odds(
              [0.5, 'A equipe cede e corta a multa rescisória pela metade.', [{ type: 'releaseFee', factor: 0.5 }, stat('teamTrust', -4)]],
              [0.5, 'A equipe não gostou da pressão e não cedeu nada.', [stat('teamTrust', -10)]],
            ),
          ),
        ],
      };
    },
  },
  {
    id: 'contract-unhappy',
    category: 'contract',
    kind: 'guaranteed',
    maxPerSeason: 1,
    weight: 0,
    build(ctx) {
      if (ctx.round < 3 || ctx.player.condition.morale >= 30) return null;
      return {
        title: 'Vontade de sair',
        body: `A sua moral está no chão, e o seu empresário pergunta se é hora de pedir para deixar a ${ctx.team.name} no fim do ano.`,
        choices: [
          choice(
            'leave',
            'Pedir a liberação',
            'A equipe libera você da multa rescisória, mas a relação azeda.',
            sure(
              'A equipe concorda em não cobrar a multa se você sair no fim do ano.',
              { type: 'releaseFee', factor: 0 },
              stat('teamTrust', -12),
              stat('morale', 8),
            ),
          ),
          choice(
            'stay',
            'Reafirmar o compromisso',
            'Uma conversa franca com a equipe renova o ânimo.',
            sure('Você e a equipe alinham as expectativas.', stat('morale', 10), stat('teamTrust', 3)),
          ),
        ],
      };
    },
  },

  /* ===== Patrocinadores ===== */
  {
    id: 'sponsor-pressure',
    category: 'sponsor',
    kind: 'guaranteed',
    maxPerSeason: 2,
    weight: 0,
    build(ctx) {
      const unhappy = commercialSponsors(ctx.career.sponsors).find((s) => s.satisfaction < SPONSOR_RULES.PRESSURE_THRESHOLD);
      if (!unhappy) return null;
      return {
        title: `${unhappy.name} cobra resultados`,
        body: `O patrocinador ${unhappy.name} esperava ver você entre os ${unhappy.targetPosition} primeiros do campeonato e ameaça rescindir o contrato de ${money(ctx.career, unhappy.perSeason)} por ano.`,
        choices: [
          choice(
            'promise',
            'Prometer uma reação',
            'Ganha tempo, mas aumenta a pressão sobre você.',
            sure('O patrocinador aceita esperar mais algumas etapas.', sponsors(15, unhappy.id), stat('morale', -4)),
          ),
          choice(
            'pr',
            'Fazer ações extras de marketing',
            'Recupera a satisfação, à custa de descanso e treino.',
            sure('Uma semana de eventos e gravações deixa o patrocinador satisfeito e você, cansado.', sponsors(24, unhappy.id), stat('form', -6)),
          ),
          choice(
            'end',
            'Encerrar o contrato',
            'Perde a receita, mas tira o peso das costas.',
            sure(`${unhappy.name} deixa o seu macacão.`, { type: 'removeSponsor', sponsorId: unhappy.id }, stat('reputation', -1), stat('morale', 2)),
          ),
        ],
      };
    },
  },
  {
    id: 'sponsor-offer',
    category: 'sponsor',
    kind: 'random',
    maxPerSeason: 3,
    weight: 6,
    build(ctx) {
      const current = commercialSponsors(ctx.career.sponsors);
      // Antes da segunda etapa ainda não há tabela: vale a posição da temporada anterior (ou o meio do grid).
      const lastSeason = ctx.career.history[ctx.career.history.length - 1]?.playerPosition ?? 12;
      const tier = sponsorTierFor(ctx.career.reputation, ctx.category, ctx.career.rounds.length >= 2 ? ctx.position : lastSeason);
      // Com as três cotas ocupadas, só interessa um patrocinador maior que o menor atual, que seria substituído.
      const weakest = [...current].sort((a, b) => a.tier - b.tier || a.perSeason - b.perSeason)[0];
      const replaces = current.length >= SPONSOR_RULES.MAX_SPONSORS ? weakest : undefined;
      if (current.length >= SPONSOR_RULES.MAX_SPONSORS && (!weakest || weakest.tier >= tier)) return null;
      const sponsor = buildSponsor(ctx.career, tier, hashSeed(ctx.seed, 'sponsor'));
      const better = { ...sponsor, perSeason: Math.round((sponsor.perSeason * 1.2) / 100) * 100, targetPosition: Math.max(1, sponsor.targetPosition - 1) };
      const swap: Effect[] = replaces ? [{ type: 'removeSponsor', sponsorId: replaces.id }] : [];
      return {
        title: `Proposta de patrocínio: ${sponsor.name}`,
        body: `${sponsor.name} oferece ${money(ctx.career, sponsor.perSeason)} por temporada, mais ${money(ctx.career, sponsor.podiumBonus)} por pódio, até o fim de ${ctx.career.year + (sponsor.endSeason - ctx.career.season)}. Em troca, espera ver você entre os ${sponsor.targetPosition} primeiros do campeonato.${replaces ? ` As suas três cotas estão ocupadas: para assinar, você precisa encerrar o contrato com ${replaces.name} (${money(ctx.career, replaces.perSeason)} por temporada).` : ''}`,
        choices: [
          choice(
            'sign',
            replaces ? `Assinar e dispensar ${replaces.name}` : 'Assinar',
            'Receita garantida em parcelas por etapa.',
            sure(`${sponsor.name} estampa o seu macacão.`, ...swap, { type: 'addSponsor', sponsor }),
          ),
          choice(
            'haggle',
            'Pedir 20% a mais',
            'Pode melhorar o contrato ou espantar o patrocinador.',
            odds(
              [0.5, `${sponsor.name} aceita pagar mais, mas passa a exigir mais também.`, [...swap, { type: 'addSponsor', sponsor: better }]],
              [0.5, `${sponsor.name} agradece e procura outro piloto.`, []],
            ),
          ),
          choice(
            'decline',
            'Recusar',
            replaces ? `Mantém ${replaces.name}.` : 'Mantém a cota livre para uma proposta melhor.',
            sure('Você recusa com educação.'),
          ),
        ],
      };
    },
  },

  /* ===== Inesperados ===== */
  {
    id: 'unexpected-illness',
    category: 'unexpected',
    kind: 'random',
    maxPerSeason: 1,
    weight: 2,
    build(ctx) {
      if (ctx.player.injury) return null;
      return {
        title: 'Virose na semana da corrida',
        body: 'Você acordou com febre a poucos dias da próxima etapa. O preparador físico recomenda parar os treinos.',
        choices: [
          choice(
            'rest',
            'Descansar',
            'Chega inteiro à etapa, mas sem ritmo de treino.',
            sure('Você se recupera a tempo, com menos preparação.', stat('form', -5)),
          ),
          choice(
            'push',
            'Manter a rotina',
            'Pode não dar em nada, ou piorar.',
            odds(
              [0.5, 'A febre passa e a preparação segue normal.', []],
              [
                0.5,
                'O quadro piora: você vai correr debilitado.',
                [{ type: 'injury', injury: { description: 'Virose', severity: 'minor', roundsRemaining: 1 } }, stat('form', -3)],
              ],
            ),
          ),
        ],
      };
    },
  },
  {
    id: 'unexpected-invite',
    category: 'unexpected',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      if (ctx.career.reputation < 18 || ctx.player.injury) return null;
      const cost = Math.round(ctx.category.economy.living * 0.08);
      const nextKeys = Object.keys(ctx.career.marketInterest).filter((key) => !key.startsWith(`${ctx.career.categoryId}:`));
      const interest: Effect[] = nextKeys.slice(0, 6).map((key) => ({ type: 'interest', teamKey: key, value: 4 }));
      return {
        title: 'Convite para uma prova de exibição',
        body: `Você foi convidado para uma corrida de exibição com pilotos de várias categorias. A viagem custa ${money(ctx.career, cost)} e toma uma semana de preparação.`,
        choices: [
          choice(
            'go',
            'Participar',
            'Vitrine para outras equipes, com algum risco.',
            odds(
              [
                0.65,
                'Boa exibição: chefes de equipe de outras categorias anotam o seu nome.',
                [cash(-cost, 'Viagem para prova de exibição'), stat('reputation', 4), { type: 'attribute', key: 'experience', value: 0.8 }, ...interest],
              ],
              [
                0.25,
                'Corrida discreta. Valeu pela quilometragem.',
                [cash(-cost, 'Viagem para prova de exibição'), { type: 'attribute', key: 'experience', value: 0.5 }],
              ],
              [
                0.1,
                'Um toque na largada termina com você no centro médico.',
                [
                  cash(-cost, 'Viagem para prova de exibição'),
                  { type: 'injury', injury: { description: 'Contusão no punho', severity: 'minor', roundsRemaining: 2 } },
                ],
              ],
            ),
          ),
          choice('decline', 'Recusar e focar no campeonato', 'Mais descanso e preparação.', sure('Você usa a semana para se preparar.', stat('form', 3))),
        ],
      };
    },
  },
  {
    id: 'unexpected-academy',
    category: 'unexpected',
    kind: 'guaranteed',
    maxPerSeason: 1,
    weight: 0,
    build(ctx) {
      const { tier } = ctx.category;
      if (ctx.career.academy || tier < 3 || tier > 6 || ctx.player.age > 21 || ctx.round < 4 || ctx.position > 5) return null;
      if (ctx.career.reputation < ctx.category.requirements.minReputation) return null;
      const index = hashSeed(ctx.career.seed, 'academy', ctx.career.season) % F1_TEAM_NAMES.length;
      const f1Name = F1_TEAM_NAMES[index] ?? 'Equipe de F1';
      const academy: Academy = {
        f1TeamId: f1TeamId(index),
        name: `Academia ${f1Name}`,
        joinedSeason: ctx.career.season,
        supportShare: 0.7,
        targetPosition: 6,
        strikes: 0,
      };
      const success = Math.min(
        0.85,
        Math.max(0.2, 0.4 + (overallRating(ctx.player.attributes) - ctx.category.field.driverLevel) / 40 + (ctx.player.potential - 85) / 50),
      );
      return {
        title: `Convite da ${academy.name}`,
        body: `Olheiros da ${f1Name}, da Fórmula 1, acompanham a sua temporada e convidam você para um dia de avaliação. Quem entra na academia tem 70% do custo da vaga pago e a atenção das equipes ligadas a ela; em troca, precisa terminar cada temporada entre os ${academy.targetPosition} primeiros.`,
        choices: [
          choice(
            'accept',
            'Fazer a avaliação',
            `Chance estimada de aprovação: ${Math.round(success * 100)}%.`,
            odds(
              [success, `Aprovado! Você agora é piloto da ${academy.name}.`, [{ type: 'joinAcademy', academy }, stat('reputation', 5), stat('confidence', 5)]],
              [1 - success, 'Os engenheiros agradecem, mas escolhem outro piloto.', [stat('confidence', -4)]],
            ),
          ),
          choice('decline', 'Recusar e seguir independente', 'Sem obrigações com ninguém.', sure('Você prefere manter a liberdade de escolha.')),
        ],
      };
    },
  },
  {
    id: 'unexpected-upgrade',
    category: 'unexpected',
    kind: 'random',
    maxPerSeason: 1,
    weight: 3,
    build(ctx) {
      if (!ctx.teammate || ctx.career.relations.teamTrust < 58 || ctx.round < 2) return null;
      return {
        title: 'Peça nova, uma só',
        body: `A ${ctx.team.name} tem uma atualização promissora, mas só uma unidade ficou pronta. A equipe oferece a peça a você antes de ${fullName(ctx.teammate)}.`,
        choices: [
          choice(
            'take',
            'Aceitar e testar a peça',
            'Pode melhorar o equipamento ou dar errado. O companheiro não vai gostar.',
            odds(
              [
                0.65,
                `A peça funciona, e o ${ctx.category.machine} da equipe ganha rendimento.`,
                [{ type: 'carUpgrade', value: 1.5 }, stat('teammateRelation', -5)],
              ],
              [
                0.35,
                'A peça não entrega o esperado e ainda atrapalha o acerto.',
                [{ type: 'carUpgrade', value: -0.5 }, stat('teammateRelation', -5), stat('confidence', -2)],
              ],
            ),
          ),
          choice(
            'give',
            'Deixar para o companheiro',
            'Gesto de equipe.',
            sure(`${fullName(ctx.teammate)} agradece, e a equipe nota a atitude.`, stat('teammateRelation', 7), stat('teamTrust', 2)),
          ),
        ],
      };
    },
  },
];
