/**
 * Comunicação entre as telas e a moldura da carreira (barra superior e navegação).
 *
 * - A tela de corrida avisa quando a barra fixa de comandos está aberta: a moldura esconde a
 *   navegação inferior do celular em pé e reserva o espaço no fim da página.
 * - As telas sabem se a moldura está no formato largo (trilho lateral e barra superior com o
 *   botão de avançar) ou no formato em pé, em que o botão de avançar fica dentro da própria tela.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { CareerState } from '@/domain/schemas';
import { getNextEvent, isSeasonComplete } from '@/engine';

export interface Chrome {
  setRaceBar(open: boolean): void;
  /** Formato largo: celular deitado, tablet ou computador. */
  wide: boolean;
}

export const ChromeContext = createContext<Chrome>({ setRaceBar() {}, wide: true });

/** Enquanto o componente estiver montado com `open`, a moldura abre espaço para a barra de corrida. */
export function useRaceBarSpace(open: boolean): void {
  const { setRaceBar } = useContext(ChromeContext);
  useEffect(() => {
    if (!open) return;
    setRaceBar(true);
    return () => setRaceBar(false);
  }, [open, setRaceBar]);
}

export function useChrome(): Chrome {
  return useContext(ChromeContext);
}

/** O aplicativo é feito para a tela deitada. Vale o trilho lateral a partir de 768 px, ou com o celular deitado. */
export const WIDE_QUERY = '(min-width: 768px), (orientation: landscape) and (min-width: 560px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(query).matches));
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export interface PrimaryAction {
  label: string;
  to: string;
  /** Âmbar quando o próximo passo é resolver uma pendência; vermelho quando é avançar. */
  tone: 'accent' | 'attention';
  /** Elemento da tela de destino para onde rolar (as decisões pendentes, no Painel). */
  anchor?: string;
}

/**
 * O próximo passo da carreira: é o que o botão principal da barra superior faz.
 * Não decide nada do jogo; só aponta para a tela em que o jogador avança.
 */
export function primaryAction(career: CareerState): PrimaryAction | null {
  if (career.succession || career.status === 'retired') return null;
  const pending = career.pendingEvents.length;
  if (career.weekend) return { label: 'Continuar fim de semana', to: '/weekend', tone: 'accent' };
  if (pending > 0)
    return { label: pending === 1 ? 'Resolver decisão' : `Resolver ${pending} decisões`, to: '/dashboard', tone: 'attention', anchor: 'decisoes' };
  if (career.executiveOffseason) return { label: 'Planejar a temporada', to: '/career', tone: 'accent' };
  if (career.offseason) return { label: 'Ver propostas', to: '/career', tone: 'accent' };
  if (isSeasonComplete(career)) return { label: 'Fechar a temporada', to: '/career', tone: 'accent' };
  return getNextEvent(career) ? { label: 'Ir para o fim de semana', to: '/weekend', tone: 'accent' } : null;
}
