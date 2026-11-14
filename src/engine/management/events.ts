/**
 * Eventos de gestão: decisões de dirigente que surgem depois de uma etapa.
 * Como os demais, cada escolha tem efeitos em dados (caixa da equipe,
 * reputação, pesquisa, equipe técnica e moral dos pilotos).
 */
import type { CareerState, Effect, EventChoice, PendingEvent, RoundRecord } from '@/domain/schemas';
import { TEAM_ECONOMY } from '@/data/management';
import { createRng, hashSeed } from '../rng';
import { money } from '../career/selectors';

/** Chance de um evento de gestão depois de cada etapa. */
export const MANAGEMENT_EVENT_CHANCE = 0.35;

const budget = (value: number, label: string): Effect => ({ type: 'teamBudget', value: Math.round(value), label });
const sure = (text: string, ...effects: Effect[]): EventChoice['outcomes'] => [{ probability: 1, text, effects }];
const choice = (id: string, label: string, description: string, outcomes: EventChoice['outcomes']): EventChoice => ({ id, label, description, outcomes });

type Builder = (career: CareerState, record: RoundRecord) => Pick<PendingEvent, 'title' | 'body' | 'choices'> | null;

const BUILDERS: Readonly<Record<string, Builder>> = {
  activation: (career) => {
    const m = career.management;
    if (!m || m.sponsors.length === 0) return null;
    const sponsor = m.sponsors[0];
    if (!sponsor) return null;
    const fee = sponsor.perSeason * 0.12;
    return {
      title: `${sponsor.name} pede uma ação promocional`,
      body: `O patrocinador ${sponsor.name} quer os dois pilotos em um evento no meio da semana. Paga ${money(career, fee)} a mais, mas tira os pilotos da preparação.`,
      choices: [
        choice('accept', 'Aceitar', 'Entra dinheiro; os pilotos chegam cansados à próxima etapa.', sure('O evento foi um sucesso comercial.', budget(fee, 'Ação promocional'), { type: 'lineupCondition', stat: 'morale', value: -4 })),
        choice('decline', 'Recusar', 'Os pilotos agradecem; o patrocinador, não.', sure('O patrocinador registrou a recusa.', { type: 'teamReputation', value: -1 }, { type: 'lineupCondition', stat: 'morale', value: 2 })),
      ],
    };
  },
  poach: (career) => {
    const m = career.management;
    const director = m?.staff.find((s) => s.role === 'technicalDirector');
    if (!m || !director || director.rating < 55) return null;
    const raise = director.salary * 0.3;
    return {
      title: `Rival sonda ${director.name}`,
      body: `Uma equipe rival fez uma proposta ao seu diretor técnico, ${director.name} (nota ${director.rating}). Ele espera uma resposta.`,
      choices: [
        choice('raise', 'Cobrir a proposta', `Custa ${money(career, raise)} agora.`, sure(`${director.name} fica, motivado.`, budget(-raise, 'Aumento do diretor técnico'), { type: 'staffRating', role: 'technicalDirector', value: 1 })),
        choice('talk', 'Apelar ao projeto', 'Sem custo, mas pode não convencer.', [
          { probability: 0.5, text: `${director.name} acreditou no projeto e fica.`, effects: [] },
          { probability: 0.5, text: `${director.name} fica, mas contrariado: o trabalho dele perde rendimento.`, effects: [{ type: 'staffRating', role: 'technicalDirector', value: -6 }] },
        ]),
        choice('ignore', 'Não responder', 'Ele se sente desvalorizado.', sure(`${director.name} ficou, mas o clima piorou.`, { type: 'staffRating', role: 'technicalDirector', value: -8 })),
      ],
    };
  },
  directive: (career) => {
    const m = career.management;
    if (!m) return null;
    const gains = Object.values(m.development.gains).reduce((a, b) => a + b, 0);
    if (gains < 1) return null;
    const fine = TEAM_ECONOMY[m.categoryId].operations * 0.04;
    return {
      title: 'Diretriz técnica da federação',
      body: 'Os comissários técnicos questionam uma solução usada na última atualização do seu carro. Você pode adaptar a peça ou defender a legalidade dela.',
      choices: [
        choice('comply', 'Adaptar a peça', 'Parte da pesquisa em andamento é refeita.', sure('A equipe redesenhou a peça.', { type: 'devProgress', area: null, value: -2.5 })),
        choice('protest', 'Defender a solução', `Se perder, multa de ${money(career, fine)} e arranhão na reputação.`, [
          { probability: 0.5, text: 'A federação aceitou os argumentos. A equipe ganhou respeito no paddock.', effects: [{ type: 'teamReputation', value: 2 }] },
          { probability: 0.5, text: 'A federação manteve a diretriz e multou a equipe.', effects: [budget(-fine, 'Multa técnica'), { type: 'teamReputation', value: -3 }, { type: 'devProgress', area: null, value: -2.5 }] },
        ]),
      ],
    };
  },
  clash: (career, record) => {
    const m = career.management;
    if (!m) return null;
    const entries = record.race.entries.filter((e) => e.teamId === m.teamId && e.status === 'finished');
    const [a, b] = entries;
    if (!a || !b || Math.abs(a.position - b.position) > 2) return null;
    return {
      title: 'Pilotos se estranham depois da corrida',
      body: 'Os seus dois pilotos disputaram posição até a bandeirada e trocaram acusações no rádio. O clima nos boxes está pesado.',
      choices: [
        choice('talk', 'Reunião franca', 'Costuma resolver; às vezes piora.', [
          { probability: 0.7, text: 'A conversa limpou o ambiente.', effects: [{ type: 'lineupCondition', stat: 'morale', value: 4 }] },
          { probability: 0.3, text: 'A reunião virou discussão.', effects: [{ type: 'lineupCondition', stat: 'morale', value: -4 }] },
        ]),
        choice('rules', 'Impor regras de disputa', 'Ordem na casa; os pilotos perdem um pouco de confiança.', sure('As regras ficaram claras.', { type: 'lineupCondition', stat: 'confidence', value: -3 }, { type: 'teamReputation', value: 1 })),
        choice('ignore', 'Deixar correr', 'Sem intervenção.', sure('O assunto ficou no ar.', { type: 'lineupCondition', stat: 'morale', value: -3 })),
      ],
    };
  },
  factory: (career) => {
    const m = career.management;
    if (!m) return null;
    const overtime = TEAM_ECONOMY[m.categoryId].operations * 0.025;
    return {
      title: 'Atraso na fábrica',
      body: 'Um lote de peças saiu com defeito. Refazê-lo no prazo exige horas extras; sem elas, o desenvolvimento atrasa.',
      choices: [
        choice('overtime', 'Pagar horas extras', `Custa ${money(career, overtime)}.`, sure('As peças ficaram prontas a tempo.', budget(-overtime, 'Horas extras na fábrica'))),
        choice('delay', 'Aceitar o atraso', 'A pesquisa perde parte do progresso.', sure('O cronograma escorregou.', { type: 'devProgress', area: null, value: -2 })),
      ],
    };
  },
  windfall: (career, record) => {
    const m = career.management;
    if (!m) return null;
    const best = record.race.entries.find((e) => e.teamId === m.teamId && e.status === 'finished' && e.position <= 3);
    if (!best) return null;
    const bonus = TEAM_ECONOMY[m.categoryId].operations * 0.03;
    return {
      title: 'Pódio rende bônus',
      body: `O ${best.position}º lugar nesta etapa rendeu um bônus de ${money(career, bonus)} dos patrocinadores. Como usar o dinheiro?`,
      choices: [
        choice('research', 'Investir em pesquisa', 'Acelera o desenvolvimento em curso.', sure('O dinheiro foi para o departamento técnico.', { type: 'devProgress', area: null, value: 2 })),
        choice('staff', 'Premiar a equipe', 'Mecânicos e pilotos mais motivados.', sure('A equipe comemorou o prêmio.', { type: 'staffRating', role: 'chiefMechanic', value: 2 }, { type: 'lineupCondition', stat: 'morale', value: 5 })),
        choice('keep', 'Reforçar o caixa', 'O dinheiro fica na equipe.', sure('O bônus entrou no caixa.', budget(bonus, 'Bônus de pódio'))),
      ],
    };
  },
};

/** Evento de gestão desta etapa, se houver. Cada tipo acontece no máximo uma vez por temporada. */
export function managementRoundEvent(career: CareerState, record: RoundRecord): PendingEvent | null {
  if (!career.management) return null;
  const rng = createRng(hashSeed(career.seed, career.season, record.round, 'management-event'));
  if (rng.next() >= MANAGEMENT_EVENT_CHANCE) return null;
  const used = new Set([...career.eventLog, ...career.pendingEvents].filter((e) => e.season === career.season).map((e) => e.definitionId));
  const candidates = Object.entries(BUILDERS)
    .filter(([id]) => !used.has(`management-${id}`))
    .map(([id, build]) => ({ id, content: build(career, record) }))
    .filter((c): c is { id: string; content: NonNullable<ReturnType<Builder>> } => c.content !== null);
  const picked = candidates[Math.floor(rng.next() * candidates.length)];
  if (!picked) return null;
  return { id: `s${career.season}-r${record.round}-management-${picked.id}`, definitionId: `management-${picked.id}`, category: 'management', season: career.season, round: record.round, ...picked.content };
}
