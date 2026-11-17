/**
 * Apoio aos testes: carreiras prontas com semente fixa. As decisões do robô (treino, etapa,
 * propostas, vida de dirigente, sucessão) moram em `sim/policy.ts`, a mesma política usada pelo
 * simulador (`npm run sim`), e são reexportadas daqui.
 */
import type { CareerState } from '@/domain/schemas';
import { withTalent } from '../sim/policy';
import { createCareer, setTrainingFocus, type NewCareerInput } from './engineApi';

export {
  botExecutiveOffseason,
  botSuccession,
  botTraining,
  pickBestOffer,
  playCareer,
  playExecutiveRound,
  playLife,
  playLifeSeason,
  playRound,
  playSeason,
  resolvePending,
  type Choices,
  type LifePolicy,
} from '../sim/policy';

export const NOW = '2026-11-13T12:00:00.000Z';

export const DEFAULT_INPUT: NewCareerInput = {
  firstName: 'Ana',
  lastName: 'Teste',
  nationality: 'BR',
  age: 15,
  background: 'natural',
  bonus: { pace: 4, consistency: 4 },
  teamId: 'cerrado',
};

export function newCareer(seed = 12345, input: Partial<NewCareerInput> = {}): CareerState {
  return createCareer({ ...DEFAULT_INPUT, ...input }, seed, NOW);
}

/**
 * Carreira para simulações longas: foco de treino em velocidade e, opcionalmente,
 * um bônus de talento (pontos somados a todos os atributos treináveis e ao
 * potencial), que representa um jogador que decide melhor que o robô.
 */
export function botCareer(seed: number, talent = 0, input: Partial<NewCareerInput> = {}): CareerState {
  return withTalent(setTrainingFocus(newCareer(seed, input), 'speed'), talent);
}
