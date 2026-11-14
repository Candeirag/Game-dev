/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DSN do Sentry. Vazio (o padrão) mantém o relatório de travamentos desligado. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versão do jogo (package.json), definida no build. */
declare const __APP_VERSION__: string;
