import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { CareerLayout } from './layout/CareerLayout';
import { CalendarScreen } from './screens/CalendarScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { DriverScreen } from './screens/DriverScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { NewCareerScreen } from './screens/NewCareerScreen';
import { SavesScreen } from './screens/SavesScreen';
import { StandingsScreen } from './screens/StandingsScreen';
import { WeekendScreen } from './screens/WeekendScreen';

export function App() {
  const refreshSlots = useGameStore((s) => s.refreshSlots);
  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainMenuScreen />} />
        <Route path="/new" element={<NewCareerScreen />} />
        <Route element={<CareerLayout />}>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/weekend" element={<WeekendScreen />} />
          <Route path="/driver" element={<DriverScreen />} />
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
