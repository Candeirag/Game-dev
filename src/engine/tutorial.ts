/**
 * Tutorial: uma lista de primeiros passos, mostrada no painel.
 *
 * Cada passo é concluído por algo que o jogador realmente fez. A maioria é
 * deduzida do próprio estado da carreira (disputou uma etapa, resolveu um
 * evento, fechou uma temporada); os passos de "conhecer uma tela" são
 * marcados quando a tela é aberta.
 */
import type { CareerState } from '@/domain/schemas';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** Tela em que o passo é cumprido. */
  route: string;
  done: boolean;
}

interface StepDefinition extends Omit<TutorialStep, 'done'> {
  /** Condição deduzida do estado; se ausente, o passo é marcado ao visitar a tela. */
  derived?: (career: CareerState) => boolean;
}

const STEPS: readonly StepDefinition[] = [
  { id: 'driver', title: 'Conheça o seu piloto', text: 'Veja os nove atributos, o potencial e escolha o foco e a intensidade do treino. O treino rende a cada etapa.', route: '/driver' },
  { id: 'race', title: 'Dispute a primeira etapa', text: 'Abra o fim de semana: treino livre, classificação e corrida. Cada escolha muda o resultado.', route: '/weekend', derived: (c) => c.rounds.length > 0 || c.history.length > 0 },
  { id: 'event', title: 'Tome uma decisão', text: 'Depois das corridas surgem entrevistas, propostas e problemas. As decisões pendentes aparecem no painel e têm consequências.', route: '/dashboard', derived: (c) => c.eventLog.length > 0 },
  { id: 'team', title: 'Veja o que a equipe pensa de você', text: 'A tela Equipe mostra a confiança da equipe, o companheiro e as rivalidades. Confiança baixa custa o contrato.', route: '/team' },
  { id: 'finance', title: 'Cuide do dinheiro', text: 'A vaga custa caro e a família só ajuda por cinco anos. Em Finanças estão o extrato, os investimentos, os imóveis e os empréstimos.', route: '/finance' },
  { id: 'career', title: 'Planeje a subida', text: 'A tela Carreira mostra os requisitos do próximo degrau: licença, reputação, experiência e idade.', route: '/career' },
  { id: 'season', title: 'Feche uma temporada', text: 'No fim do ano, veja as propostas na tela Carreira, negocie e assine para a temporada seguinte.', route: '/career', derived: (c) => c.history.length > 0 },
  { id: 'family', title: 'Pense na dinastia', text: 'A tela Família acompanha o parceiro, os filhos e a linhagem. Um dia, um herdeiro continua a sua história.', route: '/family' },
];

export function tutorialSteps(career: CareerState): TutorialStep[] {
  return STEPS.map(({ derived, ...step }) => ({ ...step, done: career.tutorial.done.includes(step.id) || (derived ? derived(career) : false) }));
}

/** O tutorial acompanha a carreira de piloto; no modo dirigente, ele não aparece. */
export function tutorialActive(career: CareerState): boolean {
  return career.mode === 'driver' && !career.tutorial.dismissed && tutorialSteps(career).some((s) => !s.done);
}

/** Marca os passos de "conhecer a tela" quando a rota é aberta. */
export function visitTutorialRoute(career: CareerState, route: string): CareerState {
  if (career.tutorial.dismissed) return career;
  const ids = STEPS.filter((s) => !s.derived && s.route === route && !career.tutorial.done.includes(s.id)).map((s) => s.id);
  return ids.length > 0 ? { ...career, tutorial: { ...career.tutorial, done: [...career.tutorial.done, ...ids] } } : career;
}

export function dismissTutorial(career: CareerState): CareerState {
  return { ...career, tutorial: { ...career.tutorial, dismissed: true } };
}
