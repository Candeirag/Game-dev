import { defineConfig } from '@playwright/test';

/**
 * Testes no navegador (pasta e2e): o fluxo principal do jogo e a conferência visual das telas.
 *
 * Rodam contra o build de produção servido pelo `vite preview`, que é o que vai para o aplicativo.
 * Os prints das telas ficam em test-results/telas (fora do repositório).
 */
const PORT = 4317;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Gravar rastro de tudo custa caro; para depurar uma falha, rode o teste de novo com --trace on.
    trace: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
