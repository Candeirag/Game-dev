import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCrashReporting } from './monitoring/crashReporting';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import './index.css';

// Registra os erros que escapam. O envio para fora (Sentry) fica desligado até a publicação.
initCrashReporting();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
