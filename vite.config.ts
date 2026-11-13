/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // `npm run calibrate` define CALIBRATE=1 para rodar o relatório de balanceamento.
    include: process.env.CALIBRATE ? ['tests/calibration/**/*.calib.ts'] : ['tests/**/*.test.ts'],
  },
});
