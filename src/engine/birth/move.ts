/**
 * Mudança para São Paulo: o evento de quem nasceu no interior.
 *
 * Morar longe custa viagens a cada etapa e um treino com menos estrutura (ver `interiorWeighs`).
 * Cedo na carreira, depois da etapa BIRTH.MOVE_EVENT_ROUND, a família decide: mudar todo mundo
 * (custa mais, a moral sente pouco), mandar o piloto morar com parentes na capital (custa menos,
 * mas a saudade pesa) ou ficar mais um ano (o evento volta na temporada seguinte, enquanto o
 * piloto correr no Brasil). A mudança em si é o efeito `relocate`.
 */
import { BIRTH } from '@/config/balance';
import type { CareerState, PendingEvent } from '@/domain/schemas';
import { HOMETOWNS } from '@/data/birth';
import { money } from '../career/selectors';
import { activeBirth, interiorWeighs } from './effects';

const moveDefinitionId = 'birth-move';

/** O evento da mudança, se ele vale depois desta etapa. */
export function moveEventFor(career: CareerState, round: number): PendingEvent | null {
  const birth = activeBirth(career);
  if (!birth || career.mode !== 'driver' || round !== BIRTH.MOVE_EVENT_ROUND || !interiorWeighs(career)) return null;
  const id = `s${career.season}-r${round}-${moveDefinitionId}`;
  if (career.pendingEvents.some((e) => e.id === id) || career.eventLog.some((e) => e.id === id)) return null;
  const town = HOMETOWNS.find((h) => h.id === birth.hometownId)?.name ?? 'o interior';
  const familyCost = BIRTH.MOVE_WITH_FAMILY_COST;
  const relativesCost = BIRTH.MOVE_WITH_RELATIVES_COST;
  return {
    id,
    definitionId: moveDefinitionId,
    category: 'family',
    season: career.season,
    round,
    title: 'Mudança para São Paulo',
    body: `As viagens de ${town} até os kartódromos estão pesando no bolso e no treino. As equipes, os kartódromos e os patrocinadores estão na capital. A família precisa decidir.`,
    choices: [
      {
        id: 'family',
        label: 'Mudar com a família',
        description: `Todos vão juntos. Custa ${money(career, familyCost)}, mas ninguém fica sozinho.`,
        outcomes: [
          {
            probability: 1,
            text: 'A família aluga uma casa pequena na capital. O começo é difícil, mas vocês estão juntos.',
            effects: [
              { type: 'cash', value: -familyCost, ledger: 'family', label: 'Mudança para São Paulo' },
              { type: 'stat', stat: 'morale', value: BIRTH.MOVE_WITH_FAMILY_MORALE },
              { type: 'relocate' },
            ],
          },
        ],
      },
      {
        id: 'relatives',
        label: 'Morar com parentes',
        description: `Você vai sozinho para a casa dos tios. Custa ${money(career, relativesCost)}; a saudade pesa.`,
        outcomes: [
          {
            probability: 1,
            text: 'Um colchão na sala dos tios, perto dos kartódromos. A saudade de casa aperta.',
            effects: [
              { type: 'cash', value: -relativesCost, ledger: 'family', label: 'Mudança para a casa dos tios' },
              { type: 'stat', stat: 'morale', value: BIRTH.MOVE_WITH_RELATIVES_MORALE },
              { type: 'relocate' },
            ],
          },
        ],
      },
      {
        id: 'stay',
        label: 'Ficar mais um ano',
        description: 'Sem gastar agora. As viagens continuam, e a pergunta volta na próxima temporada.',
        outcomes: [{ probability: 1, text: 'A família fica no interior por enquanto. A estrada continua longa.', effects: [] }],
      },
    ],
  };
}

/** Efeito `relocate`: o piloto passa a morar na capital a partir desta temporada. */
export function relocate(career: CareerState): CareerState {
  const birth = activeBirth(career);
  if (birth?.region !== 'interior' || birth.movedSeason !== null) return career;
  return { ...career, birth: { ...birth, movedSeason: career.season } };
}
