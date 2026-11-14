/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // `npm run calibrate` (CALIBRATE=1) roda o relatório de balanceamento;
    // `npm run bench` (BENCH=1) roda as medições de desempenho.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    include: process.env.BENCH ? ['tests/bench/**/*.bench.ts'] : process.env.CALIBRATE ? ['tests/calibration/**/*.calib.ts'] : ['tests/**/*.test.ts'],
  },
});
