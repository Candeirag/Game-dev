import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { CHAMPIONSHIP_NAME } from '@/data/rules';
import { getNextEvent, isSeasonComplete, trackName } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { cx } from '../components/ui';
import { formatDateTime } from '../format';
import { useCareerView } from '../hooks/useCareer';

const NAV = [
  { to: '/dashboard', label: 'Painel', icon: '◧' },
  { to: '/weekend', label: 'Fim de semana', icon: '⚑' },
  { to: '/driver', label: 'Piloto', icon: '◉' },
  { to: '/calendar', label: 'Calendário', icon: '▦' },
  { to: '/standings', label: 'Classificação', icon: '≡' },
  { to: '/history', label: 'Histórico', icon: '↺' },
  { to: '/saves', label: 'Saves', icon: '⛁' },
];

export function CareerLayout() {
  const hasCareer = useGameStore((s) => s.career !== null);
  if (!hasCareer) return <Navigate to="/" replace />;
  return <CareerShell />;
}

function SaveIndicator() {
  const status = useGameStore((s) => s.saveStatus);
  if (status.kind === 'saving') return <span className="text-ink-400">Salvando…</span>;
  if (status.kind === 'saved') return <span className="text-go-400">✓ Salvo {status.slot === 'auto' ? '(automático)' : ''} · {formatDateTime(status.at)}</span>;
  if (status.kind === 'error') return <span className="text-apex-400" title={status.problems?.join('\n')}>⚠ Falha ao salvar: {status.message}</span>;
  return <span className="text-ink-400">Save automático ativo</span>;
}

function CareerShell() {
  const { career, player, team } = useCareerView();
  const notice = useGameStore((s) => s.notice);
  const dismissNotice = useGameStore((s) => s.dismissNotice);
  const next = getNextEvent(career);
  const status = career.weekend
    ? `Etapa ${career.weekend.round} em andamento`
    : isSeasonComplete(career)
      ? 'Temporada encerrada'
      : next
        ? `Próxima: Etapa ${next.round} · ${trackName(next.trackId)}`
        : '';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-ink-800 bg-ink-900/90 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-apex-500 font-display text-lg font-bold text-white">A</div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold uppercase tracking-wide">Apex</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">Motorsport Dynasty</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Navegação principal">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'bg-ink-800 text-ink-100 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100',
                )
              }
            >
              <span aria-hidden className="w-4 text-center text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-ink-800 p-4 lg:block">
          <div className="text-sm font-semibold">{player.firstName} {player.lastName}</div>
          <div className="text-xs text-ink-400">{team.name}</div>
          <button type="button" onClick={() => useGameStore.getState().exitToMenu()} className="mt-3 text-xs font-semibold text-ink-400 hover:text-apex-400">
            ← Menu principal
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 bg-ink-950/80 px-4 py-2.5 text-xs backdrop-blur sm:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-300">
            <span className="font-semibold text-ink-100">{CHAMPIONSHIP_NAME} {career.year}</span>
            <span className="text-ink-600">|</span>
            <span>Temporada {career.season}</span>
            <span className="text-ink-600">|</span>
            <span>{status}</span>
          </div>
          <SaveIndicator />
        </header>
        {notice && (
          <div role="status" className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-400 sm:mx-8">
            <span>{notice}</span>
            <button type="button" onClick={dismissNotice} className="text-ink-300 hover:text-ink-100" aria-label="Fechar aviso">✕</button>
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
