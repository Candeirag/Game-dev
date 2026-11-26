/**
 * O ano de transição na interface (Fase 6): o atalho da barra do pé leva à escolha enquanto a janela
 * do meio do ano está aberta, e as telas sabem quando o ano de transição ficou para o fechamento.
 * Quem decide é o motor (`transitionWindow`); aqui só se confere que a tela segue o que ele diz.
 */
import { describe, expect, it } from 'vitest';
import type { CareerState } from '@/domain/schemas';
import { primaryAction } from '@/ui/layout/chrome';
import { transitionWaitsForClosing } from '@/ui/screens/executive/Transition';
import * as engine from './engineApi';
import { newCareer, playExecutiveRound, playRound, playSeason, resolvePending } from './helpers';

function playRounds(career: CareerState, n: number): CareerState {
  let c = career;
  for (let i = 0; i < n; i++) c = c.mode === 'driver' ? playRound(c) : playExecutiveRound(c);
  return c;
}

/** Parou de correr depois de duas etapas: a janela do meio do ano abre. */
const midseason = engine.retireFromDriving(resolvePending(playRounds(newCareer(31), 2)));

describe('ano de transição na interface', () => {
  it('logo depois de parar no meio do ano, o atalho leva à escolha do papel', () => {
    expect(engine.transitionWindow(midseason)).toBe('midseason');
    expect(primaryAction(midseason)).toMatchObject({ label: 'Escolher o ano de transição', to: '/career' });
    expect(transitionWaitsForClosing(midseason)).toBe(false);
  });

  it('com o papel escolhido, o atalho volta a ser o fim de semana', () => {
    const role = engine.transitionOffers(midseason).find((o) => o.available)!.role;
    const started = engine.beginTransition(midseason, role);
    expect(engine.activeTransition(started)).not.toBeNull();
    expect(primaryAction(started)).toMatchObject({ to: '/weekend' });
    expect(transitionWaitsForClosing(started)).toBe(false);
  });

  it('uma etapa sem papel, ou pouco calendário pela frente: o ano de transição fica para o fechamento', () => {
    const skipped = playExecutiveRound(midseason);
    expect(engine.transitionWindow(skipped)).toBeNull();
    expect(transitionWaitsForClosing(skipped)).toBe(true);
    expect(primaryAction(skipped)).toMatchObject({ to: '/weekend' });

    const c = newCareer(31);
    const late = engine.retireFromDriving(resolvePending(playRounds(c, c.calendar.length - 2)));
    expect(engine.transitionWindow(late)).toBeNull();
    expect(transitionWaitsForClosing(late)).toBe(true);
  });

  it('no fechamento, a escolha é a do planejamento da temporada', () => {
    const closing = engine.retireFromDriving(resolvePending(playSeason(newCareer(31))));
    expect(engine.transitionWindow(closing)).toBe('closing');
    expect(primaryAction(closing)).toMatchObject({ label: 'Planejar a temporada', to: '/career' });
    expect(transitionWaitsForClosing(closing)).toBe(false);
  });
});
