import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCrashReporting } from './monitoring/crashReporting';
import { prepareApp } from './platform/boot';
import { initSettings } from './ui/settings/settings';
import './index.css';

// Registra os erros que escapam. O envio para fora (Sentry) fica desligado até a publicação.
initCrashReporting();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado.');

// No aplicativo, as anotações guardadas no aparelho voltam antes de o jogo ler qualquer uma delas;
// por isso as telas só são carregadas depois.
async function start(container: HTMLElement): Promise<void> {
  try {
    await prepareApp();
  } catch (error) {
    // Sem a preparação o jogo abre do mesmo jeito, com o armazenamento do navegador.
    console.error(error);
  }
  // Tamanho do texto, modo para daltônicos e "menos movimento" valem antes do primeiro desenho.
  initSettings();
  const [{ App }, { ErrorBoundary }] = await Promise.all([import('./ui/App'), import('./ui/components/ErrorBoundary')]);
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void start(root);
