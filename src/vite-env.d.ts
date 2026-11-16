/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DSN do Sentry. Vazio (o padrão) mantém o relatório de travamentos desligado. */
  readonly VITE_SENTRY_DSN?: string;
  /** Feature flags ligadas só neste build, separadas por vírgula (ver src/config/featureFlags.ts). */
  readonly VITE_FEATURE_FLAGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versão do jogo (package.json), definida no build. */
declare const __APP_VERSION__: string;
