/**
 * Retorno ao jogador: o módulo único que decide a vibração e o som de cada acontecimento. As
 * telas dizem o que aconteceu (`feedback('victory')`); a tabela abaixo diz o que o aparelho faz.
 * Assim o mesmo acontecimento vibra e soa sempre igual, e nada vibra a cada toque.
 *
 * Vibração e som saem na mesma chamada, que as telas fazem no mesmo instante em que mostram o
 * acontecimento (a animação de entrada começa no mesmo quadro). Nenhum dos dois é o único aviso:
 * o que aconteceu está sempre escrito na tela.
 */
import { vibrate, type HapticPattern } from '@/platform/haptics';
import { getSettings } from '../settings/settings';
import { playSound } from './audio';
import type { SoundId } from './sounds';

export interface FeedbackSpec {
  haptic: HapticPattern | null;
  sound: SoundId | null;
}

export const FEEDBACK = {
  // Sucesso: vitória, pódio, título, contrato assinado.
  victory: { haptic: 'success', sound: 'podium' },
  podium: { haptic: 'success', sound: 'podium' },
  title: { haptic: 'success', sound: 'title' },
  contractSigned: { haptic: 'success', sound: null },
  // Erro: toque, abandono, punição (os do carro do jogador).
  contact: { haptic: 'error', sound: null },
  retirement: { haptic: 'error', sound: null },
  penalty: { haptic: 'error', sound: null },
  // Alerta: o jogo pede a confirmação de uma decisão arriscada.
  riskyDecision: { haptic: 'warning', sound: null },
  // Seleção leve: trocar o ritmo, escolher o pneu.
  paceChange: { haptic: 'selection', sound: null },
  tyreChoice: { haptic: 'selection', sound: null },
  // Momentos marcantes só com som.
  chequeredFlag: { haptic: null, sound: 'chequered' },
  offerArrived: { haptic: null, sound: 'offer' },
} as const satisfies Readonly<Record<string, FeedbackSpec>>;

export type FeedbackEvent = keyof typeof FEEDBACK;

const done = new Set<string>();

/**
 * O mesmo, uma vez só por chave enquanto o jogo estiver aberto: reabrir a tela do resultado ou do
 * fechamento da temporada não comemora de novo.
 */
export function feedbackOnce(key: string, event: FeedbackEvent): void {
  if (done.has(key)) return;
  done.add(key);
  feedback(event);
}

export function feedback(event: FeedbackEvent): void {
  const spec: FeedbackSpec = FEEDBACK[event];
  if (spec.haptic && getSettings().haptics) vibrate(spec.haptic);
  if (spec.sound) playSound(spec.sound);
}
