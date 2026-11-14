import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { getNextEvent, isSeasonComplete, managedTeam, trackName } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { cx } from '../components/ui';
import { formatDateTime, formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { SuccessionScreen } from '../screens/SuccessionScreen';
import { Button } from '../components/ui';
import { ChromeContext } from './chrome';

const NAV = [
  { to: '/dashboard', label: 'Painel', icon: '◧', modes: 'both' },
  { to: '/weekend', label: 'Fim de semana', icon: '⚑', modes: 'both' },
  { to: '/driver', label: 'Piloto', icon: '◉', modes: 'driver' },
  { to: '/team', label: 'Equipe', icon: '⛭', modes: 'driver' },
  { to: '/team', label: 'Gestão', icon: '⛭', modes: 'executive' },
  { to: '/career', label: 'Carreira', icon: '▲', modes: 'both' },
  { to: '/finance', label: 'Finanças', icon: '€', modes: 'both' },
  { to: '/family', label: 'Família', icon: '♥', modes: 'both' },
  { to: '/calendar', label: 'Calendário', icon: '▦', modes: 'both' },
  { to: '/standings', label: 'Classificação', icon: '≡', modes: 'both' },
  { to: '/history', label: 'Histórico', icon: '↺', modes: 'both' },
  { to: '/saves', label: 'Saves', icon: '⛁', modes: 'both' },
  { to: '/help', label: 'Como jogar', icon: '?', modes: 'both' },
] as const;

/** Abas que ficam na barra inferior do celular, por modo de carreira; as demais vão para a folha "Mais". */
const PRIMARY: Record<'driver' | 'executive', readonly string[]> = {
  driver: ['/dashboard', '/weekend', '/driver', '/career'],
  executive: ['/dashboard', '/weekend', '/team', '/career'],
};

export function CareerLayout() {
  const hasCareer = useGameStore((s) => s.career !== null);
  if (!hasCareer) return <Navigate to="/" replace />;
  return <CareerShell />;
}

function SaveIndicator({ compact = false }: { compact?: boolean }) {
  const status = useGameStore((s) => s.saveStatus);
  if (status.kind === 'error') return <span className="shrink-0 text-apex-400" title={status.problems?.join('\n')}>⚠ Falha ao salvar{compact ? '' : `: ${status.message}`}</span>;
  if (compact) {
    const label = status.kind === 'saving' ? 'Salvando' : status.kind === 'saved' ? `Salvo em ${formatDateTime(status.at)}` : 'Save automático ativo';
    return <span role="img" aria-label={label} title={label} className={cx('shrink-0', status.kind === 'saved' ? 'text-go-400' : 'text-ink-400')}>{status.kind === 'saving' ? '…' : '✓'}</span>;
  }
  if (status.kind === 'saving') return <span className="text-ink-400">Salvando…</span>;
  if (status.kind === 'saved') return <span className="text-go-400">✓ Salvo {status.slot === 'auto' ? '(automático)' : ''} · {formatDateTime(status.at)}</span>;
  return <span className="text-ink-400">Save automático ativo</span>;
}

function CareerShell() {
  const { career, player, team, category } = useCareerView();
  const location = useLocation();
  const visit = useGameStore((s) => s.visit);
  const retire = useGameStore((s) => s.retire);
  // O tutorial marca as telas que o jogador já conheceu.
  useEffect(() => { visit(location.pathname); }, [location.pathname, visit]);
  const executive = career.mode === 'executive';
  const teamLabel = executive ? (managedTeam(career)?.name ?? 'Sem equipe') : team.name;
  const pending = career.pendingEvents.length;
  const offers = career.offseason !== null || career.executiveOffseason !== null;
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
  const statusText = career.succession ? 'Sucessão em aberto' : career.status === 'retired' ? 'Carreira encerrada' : status;

  // A barra de comandos da corrida ocupa o rodapé: sai a navegação inferior e a página ganha espaço no fim.
  const [raceBar, setRaceBar] = useState(false);
  const chrome = useMemo(() => ({ setRaceBar }), []);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const items = NAV.filter((item) => item.modes === 'both' || item.modes === career.mode);
  const primaryRoutes = PRIMARY[career.mode];
  const primary = items.filter((item) => primaryRoutes.includes(item.to));
  const secondary = items.filter((item) => !primaryRoutes.includes(item.to));
  const inSecondary = secondary.some((item) => location.pathname.startsWith(item.to));
  const badge = (to: string) => (
    <>
      {to === '/dashboard' && pending > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-ink-950">{pending}</span>}
      {to === '/career' && offers && <span className="h-2 w-2 rounded-full bg-apex-500" aria-label="Há propostas" />}
    </>
  );

  return (
    <ChromeContext.Provider value={chrome}>
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Tablet e computador: marca e abas (faixa no topo até 1023 px, barra lateral a partir daí). */}
      <aside className="hidden border-b border-ink-800 bg-ink-900/90 md:block lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-apex-500 font-display text-lg font-bold text-white">A</div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold uppercase tracking-wide">Apex</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">Motorsport Dynasty</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Navegação principal">
          {items.map((item) => (
            <NavLink
              key={item.label}
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
              <span className="ml-auto flex items-center">{badge(item.to)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-ink-800 p-4 lg:block">
          <div className="text-sm font-semibold">{player.firstName} {player.lastName}</div>
          <div className="text-xs text-ink-400">{teamLabel}{career.dynasty.generation > 1 ? ` · ${career.dynasty.generation}ª geração` : ''}</div>
          <button type="button" onClick={() => useGameStore.getState().exitToMenu()} className="mt-3 text-xs font-semibold text-ink-400 hover:text-apex-400">
            ← Menu principal
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* No celular o cabeçalho é uma linha só: marca, campeonato, etapa, caixa e o estado do save. */}
        <header className="flex items-center gap-2 border-b border-ink-800 bg-ink-950/80 px-3 py-2 text-xs backdrop-blur md:flex-wrap md:justify-between md:px-8 md:py-2.5">
          <div aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-apex-500 font-display text-sm font-bold text-white md:hidden">A</div>
          <div className="flex min-w-0 flex-1 items-center gap-x-2 whitespace-nowrap text-ink-300 md:flex-none md:flex-wrap md:gap-x-3 md:gap-y-1 md:whitespace-normal">
            <span className="font-semibold text-ink-100 md:hidden">{category.shortName} {career.year}</span>
            <span className="hidden font-semibold text-ink-100 md:inline">{category.name} {career.year}</span>
            <span className="hidden text-ink-600 md:inline">|</span>
            <span className="hidden md:inline">Temporada {career.season}</span>
            <span className="text-ink-600">|</span>
            <span className="min-w-0 truncate">{statusText}</span>
            <span className="text-ink-600">|</span>
            <span className={cx('shrink-0', career.finance.cash < 0 && 'text-apex-400')}><span className="hidden md:inline">Caixa </span>{formatMoney(career.finance.cash)}</span>
          </div>
          <span className="md:hidden"><SaveIndicator compact /></span>
          <span className="hidden md:inline"><SaveIndicator /></span>
        </header>
        {notice && (
          <div role="status" className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-400 sm:mx-8">
            <span>{notice}</span>
            <button type="button" onClick={dismissNotice} className="text-ink-300 hover:text-ink-100" aria-label="Fechar aviso">✕</button>
          </div>
        )}
        <main
          className={cx(
            'mx-auto w-full max-w-7xl flex-1 px-4 pt-5 sm:px-8 sm:pt-8',
            raceBar ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-28' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8',
          )}
        >
          {career.status === 'retired' && !career.succession && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-ink-100">
              <span>Esta carreira foi encerrada em uma versão anterior do jogo. Agora a aposentadoria das pistas não é o fim: você pode continuar como dirigente.</span>
              <Button variant="primary" disabled={career.weekend !== null} onClick={retire}>Continuar como dirigente</Button>
            </div>
          )}
          {career.succession ? <SuccessionScreen /> : <Outlet />}
        </main>
      </div>

      {/* Celular: navegação inferior com as telas mais usadas; as outras ficam em "Mais". */}
      {!raceBar && (
        <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {primary.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => cx('relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold', isActive ? 'text-ink-100 shadow-[inset_0_3px_0_0_var(--color-apex-500)]' : 'text-ink-400')}
            >
              <span aria-hidden className="text-lg leading-none">{item.icon}</span>
              <span className="text-center leading-[1.05]">{item.label}</span>
              <span className="absolute right-[calc(50%-1.6rem)] top-1.5 flex items-center">{badge(item.to)}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cx('flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold', inSecondary || moreOpen ? 'text-ink-100 shadow-[inset_0_3px_0_0_var(--color-apex-500)]' : 'text-ink-400')}
          >
            <span aria-hidden className="text-lg leading-none">⋯</span>
            <span className="leading-none">Mais</span>
          </button>
        </nav>
      )}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais telas">
          <button type="button" aria-label="Fechar" className="absolute inset-0 h-full w-full bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink-700 bg-ink-900 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.5)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-600" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{player.firstName} {player.lastName}</div>
                <div className="truncate text-xs text-ink-400">{teamLabel}{career.dynasty.generation > 1 ? ` · ${career.dynasty.generation}ª geração` : ''}</div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-ink-800" aria-label="Fechar">✕</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {secondary.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => cx('flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm font-semibold', isActive ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-200')}
                >
                  <span aria-hidden className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button type="button" onClick={() => useGameStore.getState().exitToMenu()} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-lg border border-ink-700 text-sm font-semibold text-ink-300">
              ← Menu principal
            </button>
          </div>
        </div>
      )}
    </div>
    </ChromeContext.Provider>
  );
}
