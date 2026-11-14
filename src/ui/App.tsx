import { useEffect, type ReactNode } from 'react';
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
import { MainMenuScreen } from './screens/MainMenuScreen';
import { ManagementScreen } from './screens/ManagementScreen';
import { NewCareerScreen } from './screens/NewCareerScreen';
import { SavesScreen } from './screens/SavesScreen';
import { StandingsScreen } from './screens/StandingsScreen';
import { TeamScreen } from './screens/TeamScreen';
import { WeekendScreen } from './screens/WeekendScreen';

// A interface escreve os valores na moeda da carreira aberta. A assinatura é feita antes de qualquer
// componente, então a moeda já está certa quando as telas redesenham.
const syncCurrency = (career: ReturnType<typeof useGameStore.getState>['career']) => setDisplayCurrency(career ? careerCurrency(career) : 'BRL');
syncCurrency(useGameStore.getState().career);
useGameStore.subscribe((state) => syncCurrency(state.career));

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
        <Route element={<CareerLayout />}>
          <Route path="/dashboard" element={<ByMode driver={<DashboardScreen />} executive={<ExecutiveDashboardScreen />} />} />
          <Route path="/weekend" element={<ByMode driver={<WeekendScreen />} executive={<ExecutiveWeekendScreen />} />} />
          <Route path="/driver" element={<ByMode driver={<DriverScreen />} executive={<Navigate to="/dashboard" replace />} />} />
          <Route path="/team" element={<ByMode driver={<TeamScreen />} executive={<ManagementScreen />} />} />
          <Route path="/career" element={<ByMode driver={<CareerScreen />} executive={<ExecutiveCareerScreen />} />} />
          <Route path="/finance" element={<FinanceScreen />} />
          <Route path="/family" element={<FamilyScreen />} />
          <Route path="/help" element={<HelpScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/standings" element={<StandingsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/saves" element={<SavesScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
