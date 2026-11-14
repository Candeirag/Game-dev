import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, CircleHelp, CircleUser, Ellipsis, Flag, Heart, History, LayoutDashboard, ListOrdered, LoaderCircle, LogOut, Save, Star, TrendingUp, TriangleAlert, Trophy, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { getNextEvent, isSeasonComplete, managedTeam, trackName } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, cx } from '../components/ui';
import { StorageWarning } from '../components/SaveNotices';
import { formatDate, formatDateTime, formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { SuccessionScreen } from '../screens/SuccessionScreen';
import { ChromeContext, WIDE_QUERY, primaryAction, useMediaQuery, type PrimaryAction } from './chrome';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  modes: 'both' | 'driver' | 'executive';
}

/** Um único conjunto de ícones (Lucide) para toda a navegação. */
const NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'Painel', icon: LayoutDashboard, modes: 'both' },
  { to: '/weekend', label: 'Fim de semana', icon: Flag, modes: 'both' },
  { to: '/driver', label: 'Piloto', icon: CircleUser, modes: 'driver' },
  { to: '/team', label: 'Equipe', icon: Users, modes: 'driver' },
  { to: '/team', label: 'Gestão', icon: Users, modes: 'executive' },
  { to: '/career', label: 'Carreira', icon: TrendingUp, modes: 'both' },
  { to: '/finance', label: 'Finanças', icon: Wallet, modes: 'both' },
  { to: '/family', label: 'Família', icon: Heart, modes: 'both' },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays, modes: 'both' },
  { to: '/standings', label: 'Classificação', icon: ListOrdered, modes: 'both' },
  { to: '/history', label: 'Histórico', icon: History, modes: 'both' },
  { to: '/saves', label: 'Saves', icon: Save, modes: 'both' },
  { to: '/help', label: 'Como jogar', icon: CircleHelp, modes: 'both' },
];

/** Áreas principais, por formato e por modo de carreira; as demais ficam em "Mais". */
const MAIN: Record<'wide' | 'tall', Record<'driver' | 'executive', readonly string[]>> = {
  wide: { driver: ['/dashboard', '/weekend', '/driver', '/team', '/career'], executive: ['/dashboard', '/weekend', '/team', '/career'] },
  // Em pé cabem quatro áreas e o "Mais".
  tall: { driver: ['/dashboard', '/weekend', '/driver', '/career'], executive: ['/dashboard', '/weekend', '/team', '/career'] },
};

export function CareerLayout() {
  const hasCareer = useGameStore((s) => s.career !== null);
  if (!hasCareer) return <Navigate to="/" replace />;
  return <CareerShell />;
}

function SaveIndicator() {
  const status = useGameStore((s) => s.saveStatus);
  if (status.kind === 'error') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-400" title={[status.message, ...(status.problems ?? [])].join('\n')}>
        <TriangleAlert size={16} aria-hidden /> Falha ao salvar
      </span>
    );
  }
  const label = status.kind === 'saving' ? 'Salvando' : status.kind === 'saved' ? `Salvo em ${formatDateTime(status.at)}` : 'Save automático ativo';
  const Icon = status.kind === 'saving' ? LoaderCircle : Check;
  return (
    <span role="img" aria-label={label} title={label} className={cx('grid h-8 w-8 shrink-0 place-items-center', status.kind === 'saved' ? 'text-go-400' : 'text-ink-400')}>
      <Icon size={16} aria-hidden className={status.kind === 'saving' ? 'animate-spin' : undefined} />
    </span>
  );
}

/** Um número da barra superior: ícone, rótulo curto e valor. */
function TopStat({ icon: Icon, label, value, attention = false }: { icon: LucideIcon; label: string; value: ReactNode; attention?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2" title={label}>
      <Icon size={16} aria-hidden className="text-ink-400" />
      <div className="leading-none">
        <div className="text-[10px] font-medium text-ink-400">{label}</div>
        <div className={cx('mt-0.5 font-display text-lg font-semibold leading-none', attention ? 'text-gold-400' : 'text-ink-100')}>{value}</div>
      </div>
    </div>
  );
}

/** O botão principal: leva ao próximo passo da carreira. */
function AdvanceButton({ action, className }: { action: PrimaryAction; className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = () => {
    if (location.pathname !== action.to) navigate(action.to);
    const anchor = action.anchor;
    if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  return (
    <button
      type="button"
      onClick={go}
      className={cx(
        'chamfer-br flex min-h-11 shrink-0 items-center gap-1.5 pl-4 pr-3 font-display text-lg font-semibold uppercase leading-none tracking-wide transition-colors [--chamfer:10px]',
        action.tone === 'attention' ? 'bg-gold-400 text-ink-950 hover:brightness-110' : 'bg-apex-500 text-white hover:bg-apex-400',
        className,
      )}
    >
      {action.label}
      <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
    </button>
  );
}

function CareerShell() {
  const { career, player, team, category, driverStandings, teamStandings } = useCareerView();
  const location = useLocation();
  const visit = useGameStore((s) => s.visit);
  const retire = useGameStore((s) => s.retire);
  // O tutorial marca as telas que o jogador já conheceu.
  useEffect(() => { visit(location.pathname); }, [location.pathname, visit]);
  const executive = career.mode === 'executive';
  const managed = managedTeam(career);
  const teamLabel = executive ? (managed?.name ?? 'Sem equipe') : team.name;
  const pending = career.pendingEvents.length;
  const offers = career.offseason !== null || career.executiveOffseason !== null;
  const notice = useGameStore((s) => s.notice);
  const dismissNotice = useGameStore((s) => s.dismissNotice);
  const next = getNextEvent(career);
  const current = career.weekend ? career.calendar.find((e) => e.round === career.weekend?.round) : next;
  const stage = career.succession
    ? 'Sucessão em aberto'
    : career.status === 'retired'
      ? 'Carreira encerrada'
      : isSeasonComplete(career)
        ? 'Temporada encerrada'
        : current
          ? `Etapa ${current.round} de ${career.calendar.length} · ${formatDate(current.date)}`
          : '';
  const stageLong = current && !isSeasonComplete(career) ? `${career.weekend ? 'Em andamento' : 'Próxima'}: ${trackName(current.trackId)}` : stage;

  // Posição no campeonato: a do piloto; fora das pistas, a da equipe que ele comanda.
  const standing = executive
    ? managed ? teamStandings.find((row) => row.teamId === managed.id)?.position : undefined
    : driverStandings.find((row) => row.driverId === player.id)?.position;
  const position = career.rounds.length > 0 && standing ? `${standing}º` : '–';

  const wide = useMediaQuery(WIDE_QUERY);
  // A barra de comandos da corrida ocupa o rodapé: sai a navegação inferior e a página ganha espaço no fim.
  const [raceBar, setRaceBar] = useState(false);
  const chrome = useMemo(() => ({ setRaceBar, wide }), [wide]);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [location.pathname, wide]);
  // Cada tela abre do começo (a navegação por áreas não zera a rolagem sozinha).
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);
  // A barra fixa da corrida (desenhada fora da moldura) começa onde o trilho termina.
  useEffect(() => {
    document.documentElement.style.setProperty('--rail-w', wide ? 'calc(5rem + env(safe-area-inset-left))' : '0px');
    return () => { document.documentElement.style.removeProperty('--rail-w'); };
  }, [wide]);

  const items = NAV.filter((item) => item.modes === 'both' || item.modes === career.mode);
  const mainRoutes = MAIN[wide ? 'wide' : 'tall'][career.mode];
  const primary = items.filter((item) => mainRoutes.includes(item.to));
  const secondary = items.filter((item) => !mainRoutes.includes(item.to));
  const inSecondary = secondary.some((item) => location.pathname.startsWith(item.to));
  const action = primaryAction(career);
  // Na própria tela de destino o botão não precisa aparecer (a não ser quando rola até as decisões).
  const showAction = action !== null && (action.anchor !== undefined || location.pathname !== action.to);
  const badge = (to: string) => (
    <>
      {to === '/dashboard' && pending > 0 && <span className="grid h-4 min-w-4 place-items-center bg-gold-400 px-1 font-display text-xs font-bold leading-none text-ink-950" aria-label={`${pending} pendentes`}>{pending}</span>}
      {to === '/career' && offers && <span className="h-2 w-2 bg-apex-500" aria-label="Há propostas" />}
    </>
  );
  const who = (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold">{player.firstName} {player.lastName}</div>
      <div className="truncate text-xs text-ink-400">{teamLabel}{career.dynasty.generation > 1 ? ` · ${career.dynasty.generation}ª geração` : ''}</div>
    </div>
  );
  const moreLinks = (
    <>
      <div className="grid grid-cols-2 gap-2">
        {secondary.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) => cx('flex min-h-11 items-center gap-3 border px-3 text-sm font-semibold', isActive ? 'border-apex-500 bg-apex-500/15 text-ink-100' : 'border-ink-700 text-ink-200 hover:border-ink-500')}
          >
            <item.icon size={18} aria-hidden className="shrink-0 text-ink-400" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <button type="button" onClick={() => useGameStore.getState().exitToMenu()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-ink-700 text-sm font-semibold text-ink-300 hover:border-ink-500">
        <LogOut size={16} aria-hidden /> Menu principal
      </button>
    </>
  );

  const content = (
    <>
      <StorageWarning className="mx-4 mt-4 lg:mx-6" />
      {notice && (
        <div role="status" className="mx-4 mt-4 flex items-start justify-between gap-3 border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-400 lg:mx-6">
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} className="-m-2 grid h-9 w-9 shrink-0 place-items-center text-ink-300 hover:text-ink-100" aria-label="Fechar aviso"><X size={16} aria-hidden /></button>
        </div>
      )}
      <main
        className={cx(
          'mx-auto w-full max-w-[1500px] flex-1 px-4 pt-4 lg:px-6',
          wide ? (raceBar ? 'pb-28' : 'pb-6') : raceBar ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {career.status === 'retired' && !career.succession && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-ink-100">
            <span>Esta carreira foi encerrada em uma versão anterior do jogo. Agora a aposentadoria das pistas não é o fim: você pode continuar como dirigente.</span>
            <Button variant="primary" disabled={career.weekend !== null} onClick={retire}>Continuar como dirigente</Button>
          </div>
        )}
        {career.succession ? <SuccessionScreen /> : <Outlet />}
      </main>
    </>
  );

  if (wide) {
    return (
      <ChromeContext.Provider value={chrome}>
        <div className="flex min-h-dvh">
          {/* Trilho lateral: as áreas principais, com ícone e nome, e o "Mais" para o resto. */}
          <nav aria-label="Navegação principal" className="sticky top-0 z-40 flex h-dvh w-[calc(5rem+env(safe-area-inset-left))] shrink-0 flex-col border-r border-ink-700 bg-ink-900 pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]">
            <div className="flex h-12 shrink-0 items-center justify-center border-b border-ink-700">
              <span aria-label="Apex Motorsport Dynasty" className="chamfer grid h-8 w-8 place-items-center bg-apex-500 font-display text-xl font-bold italic text-white [--chamfer:7px]">A</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {primary.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cx(
                      'relative flex min-h-[3.25rem] shrink-0 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold leading-[1.1] transition-colors',
                      isActive ? 'bg-ink-800 text-ink-100 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100',
                    )
                  }
                >
                  <item.icon size={20} strokeWidth={1.75} aria-hidden />
                  {item.label}
                  <span className="absolute right-2 top-1.5 flex items-center">{badge(item.to)}</span>
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cx(
                  'mt-auto flex min-h-[3.25rem] shrink-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold leading-[1.1] transition-colors',
                  inSecondary || moreOpen ? 'bg-ink-800 text-ink-100 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100',
                )}
              >
                <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
                Mais
              </button>
            </div>
          </nav>
          {moreOpen && (
            <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Mais telas">
              <button type="button" aria-label="Fechar" className="absolute inset-0 h-full w-full bg-black/50" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-0 left-[var(--rail-w)] top-0 flex w-[min(26rem,calc(100vw-var(--rail-w)))] flex-col gap-3 overflow-y-auto border-r border-ink-700 bg-ink-900 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
                <div className="flex items-start justify-between gap-3">
                  {who}
                  <button type="button" onClick={() => setMoreOpen(false)} className="-m-2 grid h-11 w-11 shrink-0 place-items-center text-ink-300 hover:text-ink-100" aria-label="Fechar"><X size={18} aria-hidden /></button>
                </div>
                <div>{moreLinks}</div>
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Barra superior: onde a carreira está e o botão que a faz avançar, sempre à direita. */}
            <header className="sticky top-0 z-20 flex min-h-12 items-center gap-4 border-b border-ink-700 bg-ink-900/95 pl-4 pr-[calc(0.75rem+env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] backdrop-blur lg:pl-6">
              <div className="min-w-0 flex-1 leading-none">
                <div className="truncate font-display text-lg font-semibold uppercase leading-none tracking-wide">{category.shortName} {career.year}</div>
                <div className="mt-1 truncate text-xs text-ink-400">{stage}<span className="hidden xl:inline">{stageLong !== stage ? ` · ${stageLong}` : ''}</span></div>
              </div>
              <TopStat icon={Wallet} label="Caixa" value={formatMoney(career.finance.cash)} attention={career.finance.cash < 0} />
              <TopStat icon={Star} label="Reputação" value={Math.floor(career.reputation)} />
              <TopStat icon={Trophy} label={executive ? 'Equipes' : 'Campeonato'} value={position} />
              <SaveIndicator />
              {showAction && action && <AdvanceButton action={action} />}
            </header>
            {content}
          </div>
        </div>
      </ChromeContext.Provider>
    );
  }

  // Tela em pé (navegador no celular): cabeçalho de uma linha, botão de avançar e navegação inferior.
  return (
    <ChromeContext.Provider value={chrome}>
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-xs">
          <span aria-hidden className="chamfer grid h-7 w-7 shrink-0 place-items-center bg-apex-500 font-display text-base font-bold italic text-white [--chamfer:6px]">A</span>
          <div className="min-w-0 flex-1 leading-none">
            <div className="truncate font-display text-base font-semibold uppercase leading-none tracking-wide">{category.shortName} {career.year}</div>
            <div className="mt-0.5 truncate text-[11px] text-ink-400">{stage}</div>
          </div>
          <span className={cx('shrink-0 font-display text-base font-semibold', career.finance.cash < 0 ? 'text-gold-400' : 'text-ink-100')}>{formatMoney(career.finance.cash)}</span>
          <SaveIndicator />
        </header>
        {content}

        {!raceBar && (
          <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            {primary.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) => cx('relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold leading-[1.05]', isActive ? 'text-ink-100 shadow-[inset_0_3px_0_0_var(--color-apex-500)]' : 'text-ink-400')}
              >
                <item.icon size={20} strokeWidth={1.75} aria-hidden />
                {item.label}
                <span className="absolute right-[calc(50%-1.6rem)] top-1.5 flex items-center">{badge(item.to)}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cx('flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold leading-[1.05]', inSecondary || moreOpen ? 'text-ink-100 shadow-[inset_0_3px_0_0_var(--color-apex-500)]' : 'text-ink-400')}
            >
              <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
              Mais
            </button>
          </nav>
        )}
        {moreOpen && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Mais telas">
            <button type="button" aria-label="Fechar" className="absolute inset-0 h-full w-full bg-black/60" onClick={() => setMoreOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t border-ink-700 bg-ink-900 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="mb-2 flex items-start justify-between gap-3">
                {who}
                <button type="button" onClick={() => setMoreOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center text-ink-300 hover:text-ink-100" aria-label="Fechar"><X size={18} aria-hidden /></button>
              </div>
              {moreLinks}
            </div>
          </div>
        )}
      </div>
    </ChromeContext.Provider>
  );
}
