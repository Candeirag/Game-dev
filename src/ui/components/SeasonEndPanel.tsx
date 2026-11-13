import { useMemo, useState } from 'react';
import { computeSeasonOutcome, fullName, getContractOffers } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, ChoiceCard, Stat } from './ui';
import { useCareerView } from '../hooks/useCareer';

export function SeasonEndPanel() {
  const { career, drivers, teams } = useCareerView();
  const startNextSeason = useGameStore((s) => s.startNextSeason);
  const outcome = useMemo(() => computeSeasonOutcome(career), [career]);
  const offers = useMemo(() => getContractOffers(career), [career]);
  const [choice, setChoice] = useState<string | null>(offers.find((o) => o.isCurrentTeam)?.teamId ?? offers[0]?.teamId ?? null);
  const champion = drivers[outcome.championDriverId];

  return (
    <Card title={`Fim da temporada ${career.year}`} className="border-gold-400/30">
      <div className="mb-5 rounded-lg bg-gradient-to-r from-gold-400/15 to-transparent p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gold-400">Campeão</div>
        <div className="font-display text-2xl font-bold uppercase">{champion ? fullName(champion) : '-'}</div>
        <div className="text-sm text-ink-300">Equipe campeã: {teams[outcome.championTeamId]?.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Sua posição" value={`${outcome.playerPosition}º`} accent />
        <Stat label="Meta" value={`${outcome.target}º`} hint={outcome.objectiveMet ? 'Cumprida' : 'Não cumprida'} />
        <Stat label="Pontos" value={outcome.playerPoints} hint={`${outcome.wins} vitória(s) · ${outcome.podiums} pódio(s)`} />
        <Stat label="Reputação" value={`${outcome.reputationBefore} → ${outcome.reputationAfter}`} />
      </div>
      <h3 className="mt-6 mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-300">Propostas para {career.year + 1}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {offers.map((o) => {
          const team = teams[o.teamId];
          if (!team) return null;
          return (
            <ChoiceCard
              key={o.teamId}
              selected={choice === o.teamId}
              onSelect={() => setChoice(o.teamId)}
              title={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />{team.name}{o.isCurrentTeam && <span className="text-xs text-ink-400">(atual)</span>}</span>}
              description={o.reason}
              meta={`Motor ${team.kart.engine} · Chassi ${team.kart.chassis} · Confiabilidade ${team.kart.reliability}`}
            />
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">Na nova temporada, todos ficam um ano mais velhos e passam pela pré-temporada de treinos. As equipes que superaram a expectativa melhoram o kart; as que decepcionaram perdem verba.</p>
      <Button variant="primary" className="mt-5" disabled={!choice} onClick={() => choice && startNextSeason(choice)}>
        Assinar e começar a temporada {career.year + 1}
      </Button>
    </Card>
  );
}
