/**
 * Relatório de travamentos. PREPARADO, MAS DESLIGADO.
 *
 * Hoje nada sai do aparelho: os erros ficam só numa lista em memória (para a tela de erro
 * mostrar os detalhes) e, em desenvolvimento, no console. Não há SDK instalado.
 *
 * Para ativar o Sentry quando o aplicativo for publicado:
 *
 * 1. Instale o SDK: `npm install @sentry/react` (web) ou `@sentry/capacitor @sentry/react`
 *    (aplicativo Android/iOS).
 * 2. Crie o projeto no Sentry e ponha o DSN em `VITE_SENTRY_DSN` (ver `.env.example`).
 *    Sem DSN, o relatório continua desligado.
 * 3. Em `connect()` abaixo, troque o corpo pelo trecho comentado: ele carrega o SDK só quando
 *    há DSN e entrega um `CrashReporter` a `setCrashReporter`.
 * 4. Avise o jogador (política de privacidade e, se a loja exigir, consentimento) antes de
 *    ligar: relatórios de erro são dados que saem do aparelho.
 *
 * O que nunca deve ser enviado: o conteúdo do save nem o nome do piloto. O contexto de cada
 * relatório se limita à versão do jogo, à tela e ao ponto da carreira (categoria e etapa).
 */

export interface CrashContext {
  /** Onde o erro aconteceu: 'render', 'window.onerror', 'promise' ou o nome de uma ação. */
  source: string;
  /** Tela aberta (rota), versão do jogo e ponto da carreira, quando conhecidos. */
  extra?: Readonly<Record<string, string | number | boolean | null>>;
}

/** O que um serviço de relatório precisa oferecer. O Sentry atende a esta interface com um adaptador de três linhas. */
export interface CrashReporter {
  captureException(error: unknown, context: CrashContext): void;
}

export interface RecordedError {
  at: string;
  message: string;
  stack: string | null;
  source: string;
}

const DSN: string = import.meta.env?.VITE_SENTRY_DSN ?? '';
const MAX_RECORDED = 20;

let reporter: CrashReporter | null = null;
const recorded: RecordedError[] = [];

/** Liga um serviço de relatório. Só é chamado por `connect()`, quando o Sentry for ativado. */
export function setCrashReporter(next: CrashReporter | null): void {
  reporter = next;
}

/** O relatório remoto está ligado? (Hoje, nunca.) */
export function crashReportingEnabled(): boolean {
  return reporter !== null;
}

/** Erros desta sessão, do mais recente para o mais antigo. Ficam só na memória. */
export function recentErrors(): readonly RecordedError[] {
  return recorded;
}

/** Registra um erro: guarda na lista da sessão e, se houver serviço ligado, envia. Nunca lança. */
export function reportError(error: unknown, context: CrashContext): void {
  try {
    const problem = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erro desconhecido');
    recorded.unshift({ at: new Date().toISOString(), message: problem.message, stack: problem.stack ?? null, source: context.source });
    recorded.length = Math.min(recorded.length, MAX_RECORDED);
    if (import.meta.env?.DEV) console.error(`[${context.source}]`, error);
    reporter?.captureException(error, context);
  } catch {
    // O relatório de erros não pode ser, ele mesmo, uma fonte de erro.
  }
}

async function connect(): Promise<void> {
  if (!DSN) return;
  // Ao ativar, instale o SDK e use:
  //
  // const Sentry = await import('@sentry/react');
  // Sentry.init({ dsn: DSN, release: `apex@${__APP_VERSION__}`, sendDefaultPii: false, tracesSampleRate: 0 });
  // setCrashReporter({
  //   captureException: (error, context) => Sentry.captureException(error, { tags: { source: context.source }, extra: { ...context.extra } }),
  // });
}

let installed = false;

/**
 * Chamado uma vez, na abertura do jogo: passa a registrar erros que escapam (exceções não
 * tratadas e promessas rejeitadas) e, se o relatório remoto estiver configurado, liga-o.
 */
export function initCrashReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, { source: 'window.onerror' }));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, { source: 'promise' }));
  void connect();
}
