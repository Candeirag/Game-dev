import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { careerCurrency } from '@/engine';
import { setDisplayCurrency } from './format';
import { CareerLayout } from './layout/CareerLayout';
import { CalendarScreen } from './screens/CalendarScreen';
import { CareerScreen } from './screens/CareerScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { DriverScreen } from './screens/DriverScreen';
import { ExecutiveCareerScreen, ExecutiveDashboardScreen, ExecutiveWeekendScreen } from './screens/ExecutiveScreens';
import { FamilyScreen } from './screens/FamilyScreen';
import { FinanceScreen } from './screens/FinanceScreen';
import { HelpScreen } from './screens/HelpScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LifeScreen } from './screens/LifeScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { ManagementScreen } from './screens/ManagementScreen';
import { NewCareerScreen } from './screens/NewCareerScreen';
import { SavesScreen } from './screens/SavesScreen';
import { MenuSettingsScreen, SettingsScreen } from './screens/SettingsScreen';
import { StandingsScreen } from './screens/StandingsScreen';
import { TeamScreen } from './screens/TeamScreen';
import { WeekendScreen } from './screens/WeekendScreen';

// A interface escreve os valores na moeda da carreira aberta. A assinatura é feita antes de qualquer
// componente, então a moeda já está certa quando as telas redesenham.
const syncCurrency = (career: ReturnType<typeof useGameStore.getState>['career']) => setDisplayCurrency(career ? careerCurrency(career) : 'BRL');
syncCurrency(useGameStore.getState().career);
useGameStore.subscribe((state) => syncCurrency(state.career));

/**
 * Catálogo dos componentes: só existe no servidor de desenvolvimento (`npm run dev`, em
 * `#/dev/catalogo`). No build de produção a condição é falsa, a rota não é registrada e o
 * arquivo nem entra no pacote.
 */
const Catalog = import.meta.env.DEV ? lazy(() => import('./dev/CatalogScreen')) : null;

/** Escolhe a tela pelo modo da carreira: piloto ou dirigente. */
function ByMode({ driver, executive }: { driver: ReactNode; executive: ReactNode }) {
  const mode = useGameStore((s) => s.career?.mode);
  return <>{mode === 'executive' ? executive : driver}</>;
}

export function App() {
  const initStorage = useGameStore((s) => s.initStorage);
  useEffect(() => {
    void initStorage();
  }, [initStorage]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainMenuScreen />} />
        <Route path="/new" element={<NewCareerScreen />} />
        <Route path="/ajustes" element={<MenuSettingsScreen />} />
        {Catalog && (
          <Route
            path="/dev/catalogo"
            element={
              <Suspense fallback={null}>
                <Catalog />
              </Suspense>
            }
          />
        )}
        <Route element={<CareerLayout />}>
          <Route path="/dashboard" element={<ByMode driver={<DashboardScreen />} executive={<ExecutiveDashboardScreen />} />} />
          <Route path="/weekend" element={<ByMode driver={<WeekendScreen />} executive={<ExecutiveWeekendScreen />} />} />
          <Route path="/driver" element={<ByMode driver={<DriverScreen />} executive={<Navigate to="/dashboard" replace />} />} />
          <Route path="/team" element={<ByMode driver={<TeamScreen />} executive={<ManagementScreen />} />} />
          <Route path="/career" element={<ByMode driver={<CareerScreen />} executive={<ExecutiveCareerScreen />} />} />
          <Route path="/life" element={<LifeScreen />} />
          <Route path="/finance" element={<FinanceScreen />} />
          <Route path="/family" element={<FamilyScreen />} />
          <Route path="/help" element={<HelpScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/standings" element={<StandingsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/saves" element={<SavesScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
