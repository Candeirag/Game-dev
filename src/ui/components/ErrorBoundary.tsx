/**
 * Tela de erro: se um erro derruba a interface, o jogador vê o que aconteceu e tem duas
 * saídas, recarregar o jogo ou levar o save embora. O erro é registrado pelo relatório de
 * travamentos (hoje, só na memória da sessão; ver src/monitoring/crashReporting.ts).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/monitoring/crashReporting';
import { useGameStore } from '@/store/gameStore';

interface State {
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportError(error, { source: 'render', extra: { route: window.location.hash, component: info.componentStack?.split('\n')[1]?.trim() ?? null } });
  }

  private copySave = async (): Promise<void> => {
    const json = useGameStore.getState().exportJson();
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      this.setState({ copied: true });
    } catch {
      // Sem área de transferência: baixa o arquivo.
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'apex-carreira.json';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  override render(): ReactNode {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const hasCareer = useGameStore.getState().career !== null;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-10">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">O jogo encontrou um erro</h1>
        <p className="text-sm leading-relaxed text-ink-300">
          A tela não pôde ser mostrada. A sua carreira está guardada no save automático da última sessão concluída; recarregar o jogo costuma resolver.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="chamfer-br min-h-11 bg-apex-500 px-5 font-display text-lg font-semibold uppercase tracking-wide text-white hover:bg-apex-400"
          >
            Recarregar o jogo
          </button>
          {hasCareer && (
            <button
              type="button"
              onClick={() => void this.copySave()}
              className="min-h-11 border border-ink-600 px-4 text-sm font-semibold text-ink-100 hover:border-ink-400"
            >
              {copied ? 'Save copiado' : 'Copiar o save'}
            </button>
          )}
        </div>
        <details className="text-xs text-ink-400">
          <summary className="flex min-h-11 cursor-pointer items-center">Detalhes do erro</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border border-ink-700 bg-ink-900 p-3">{error.stack ?? error.message}</pre>
        </details>
      </div>
    );
  }
}
