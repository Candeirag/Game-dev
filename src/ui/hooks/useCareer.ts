import { useMemo } from 'react';
import type { CareerState } from '@/domain/schemas';
import { getCategory } from '@/data/categories';
import { driverMap, driverStandings, getPlayer, getTeammate, managedTeam, teamMap, teamStandings } from '@/engine';
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
  return useMemo(() => {
    const player = getPlayer(career);
    // Como piloto, a equipe é a do contrato. Fora das pistas, é a que ele dirige; sem cargo, a
    // primeira do campeonato serve só de referência visual (as telas de piloto não aparecem nesse modo).
    const team = career.teams.find((t) => t.id === player.teamId) ?? managedTeam(career) ?? career.teams[0];
    if (!team) throw new Error('Campeonato sem equipes.');
    return {
      career,
      player,
      team,
      teammate: player.teamId ? getTeammate(career) : null,
      category: getCategory(career.categoryId),
      drivers: driverMap(career),
      teams: teamMap(career),
      driverStandings: driverStandings(career),
      teamStandings: teamStandings(career),
    };
  }, [career]);
}
