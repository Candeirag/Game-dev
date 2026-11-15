import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração do aplicativo (Android e iOS). O conteúdo é o build de produção (`dist/`),
 * servido de dentro do aplicativo: nada vem da rede.
 *
 * O identificador abaixo é provisório. Ele tem de ser definitivo antes da primeira publicação:
 * depois que o aplicativo entra numa loja, não dá mais para trocar.
 */
const config: CapacitorConfig = {
  appId: 'com.apexmotorsportdynasty.app',
  appName: 'Apex Motorsport Dynasty',
  webDir: 'dist',
  backgroundColor: '#15181d',
  android: { backgroundColor: '#15181d' },
  ios: { backgroundColor: '#15181d', contentInset: 'never' },
  plugins: {
    // Jogo em tela cheia: sem barra de status nem de navegação. As áreas seguras (recorte da
    // câmera, barra de gestos) chegam ao CSS por env(safe-area-inset-*).
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK', hidden: true },
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#15181d', showSpinner: false },
  },
};

export default config;
