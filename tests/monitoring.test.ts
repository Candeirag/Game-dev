/** Relatório de travamentos: preparado e desligado. Nada sai do aparelho sem um serviço ligado. */
import { afterEach, describe, expect, it } from 'vitest';
import { crashReportingEnabled, recentErrors, reportError, setCrashReporter, type CrashContext } from '@/monitoring/crashReporting';

afterEach(() => setCrashReporter(null));

describe('relatório de travamentos', () => {
  it('vem desligado e só guarda os erros na memória da sessão', () => {
    expect(crashReportingEnabled()).toBe(false);
    reportError(new Error('falha de teste'), { source: 'teste' });
    expect(recentErrors()[0]).toMatchObject({ message: 'falha de teste', source: 'teste' });
  });

  it('entrega o erro ao serviço quando um for ligado, e nunca lança', () => {
    const sent: { error: unknown; context: CrashContext }[] = [];
    setCrashReporter({ captureException: (error, context) => void sent.push({ error, context }) });
    expect(crashReportingEnabled()).toBe(true);
    reportError('texto solto', { source: 'promise', extra: { route: '#/weekend' } });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.context).toEqual({ source: 'promise', extra: { route: '#/weekend' } });
    setCrashReporter({
      captureException: () => {
        throw new Error('o serviço caiu');
      },
    });
    expect(() => reportError(new Error('outro'), { source: 'render' })).not.toThrow();
  });

  it('guarda no máximo os 20 erros mais recentes', () => {
    for (let i = 0; i < 30; i++) reportError(new Error(`erro ${i}`), { source: 'teste' });
    expect(recentErrors()).toHaveLength(20);
    expect(recentErrors()[0]?.message).toBe('erro 29');
  });
});
