import { useMemo } from 'react';
import type { CareerState } from '@/domain/schemas';
import { driverMap, driverStandings, getPlayer, getPlayerTeam, teamMap, teamStandings } from '@/engine';
import { useGameStore } from '@/store/gameStore';

/** Carreira ativa. Só use em telas protegidas pelo layout de carreira. */
export function useCareer(): CareerState {
  const career = useGameStore((s) => s.career);
  if (!career) throw new Error('Nenhuma carreira carregada.');
  return career;
}

/** Dados derivados mais usados, memorizados por carreira. */
export function useCareerView() {
  const career = useCareer();
  return useMemo(
    () => ({
      career,
      player: getPlayer(career),
      team: getPlayerTeam(career),
      drivers: driverMap(career),
      teams: teamMap(career),
      driverStandings: driverStandings(career),
      teamStandings: teamStandings(career),
    }),
    [career],
  );
}
