/** Família e dinastia: parceiro, filhos, linhagem e passagem de comando. */
import { SUPPORT_LEVELS, type Child, type SupportLevel } from '@/domain/schemas';
import { CHILD_STAGE_LABELS, SUPPORT_LABELS } from '@/domain/labels';
import { getCategory } from '@/data/categories';
import { FAMILY, PARTNER_BACKGROUND_INFO, getTrait } from '@/data/family';
import { childScoutReport, childSummary, familyAnnualCost, fullName, mortalityRisk, overallRating, partnerMoraleEffect } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, EmptyState, Meter, PageHeader, Pill, Stat, TableWrap, cx, td, th } from '../components/ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';

function SupportPicker({ value, onChange, label }: { value: SupportLevel; onChange: (v: SupportLevel) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-400">{label}</span>
      <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
        {SUPPORT_LEVELS.map((level) => (
          <button key={level} type="button" aria-pressed={value === level} onClick={() => onChange(level)} className={cx('rounded-md px-2.5 py-1 text-xs font-semibold', value === level ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100')}>
            {SUPPORT_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChildCard({ child }: { child: Child }) {
  const setKartFunding = useGameStore((s) => s.setKartFunding);
  const setChildSupport = useGameStore((s) => s.setChildSupport);
  const racing = child.stage === 'racing' ? child.racing : null;
  const canKart = (child.stage === 'child' || child.stage === 'karting') && child.age >= FAMILY.KART_START_AGE && child.age < FAMILY.CAREER_START_AGE;
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold uppercase leading-tight">{fullName(child)}</div>
          <div className="text-sm text-ink-400">{child.age} anos · {childSummary(child)}</div>
          {child.stage !== 'other' && <div className="text-sm text-ink-300">Avaliação dos treinadores: <b className="text-ink-100">{childScoutReport(child) ?? 'ainda não avaliado'}</b></div>}
        </div>
        <Pill tone={child.stage === 'racing' ? 'good' : child.stage === 'other' ? 'neutral' : 'warn'}>{CHILD_STAGE_LABELS[child.stage]}</Pill>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {child.traits.map((t) => (
          <span key={t} title={getTrait(t).description} className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-300"><b className="text-ink-100">{getTrait(t).name}</b>: {getTrait(t).description}</span>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter label="Relação com você" value={child.bond} />
        {child.stage !== 'other' && <Meter label="Vontade de correr" value={child.interest} hint={child.stage !== 'racing' ? `Precisa de ${FAMILY.CAREER_INTEREST} aos ${FAMILY.CAREER_START_AGE} anos para querer a carreira.` : undefined} tone="neutral" />}
      </div>

      {canKart && (
        <div className="mt-4 rounded-lg border border-ink-800 p-3">
          <SupportPicker label="Investimento no kart:" value={child.kartFunding} onChange={(v) => setKartFunding(child.id, v)} />
          <p className="mt-2 text-xs text-ink-400">
            Parcial: {formatMoney(FAMILY.KART_COST.basic)} por ano (rende 60%). Total: {formatMoney(FAMILY.KART_COST.full)} por ano. Formação acumulada: <b className="text-ink-100">{child.kartYears.toFixed(1)} ano(s)</b>; cada ano vale cerca de {FAMILY.START_PER_KART_YEAR} pontos em todos os atributos na estreia.
          </p>
        </div>
      )}

      {racing && child.driver && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Nota geral" value={Math.floor(overallRating(child.driver.attributes))} hint={`Potencial ${Math.floor(child.driver.potential)}`} />
            <Stat label="Reputação" value={Math.floor(racing.reputation)} />
            <Stat label="Custo para a família" value={formatMoney(racing.familyCost)} hint="por temporada" />
            <Stat label="Academia" value={racing.academy ? 'Sim' : 'Não'} hint={racing.academy ?? 'Sem vínculo'} />
          </div>
          <SupportPicker label="Apoio à carreira:" value={child.support} onChange={(v) => setChildSupport(child.id, v)} />
          {racing.stalled > 0 && <p className="text-sm text-apex-400">Sem dinheiro para a vaga: {child.firstName} corre de favor. Sem apoio, a carreira acaba na próxima temporada.</p>}
          {racing.seasons.length > 0 && (
            <TableWrap>
              <table className="w-full">
                <thead><tr><th className={th}>Ano</th><th className={th}>Categoria</th><th className={th}>Equipe</th><th className={cx(th, 'text-right')}>Posição</th><th className={cx(th, 'text-right')}>Vitórias</th></tr></thead>
                <tbody>
                  {[...racing.seasons].reverse().slice(0, 8).map((s) => (
                    <tr key={s.season} className="border-t border-ink-800">
                      <td className={cx(td, 'tabular')}>{s.year}</td>
                      <td className={td}>{getCategory(s.categoryId).shortName}</td>
                      <td className={cx(td, 'text-ink-300')}>{s.teamName}{s.inWorld ? ' (sua equipe)' : ''}</td>
                      <td className={cx(td, 'text-right font-semibold tabular')}>{s.position}º</td>
                      <td className={cx(td, 'text-right tabular')}>{s.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}
    </div>
  );
}

export function FamilyScreen() {
  const { career, player } = useCareerView();
  const beginHandover = useGameStore((s) => s.beginHandover);
  const { partner, children, divorces } = career.family;
  const morale = partnerMoraleEffect(career.family);
  const cost = familyAnnualCost(career);
  const canHandOver = career.mode === 'executive' && career.executiveOffseason !== null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Família ${career.dynasty.surname} · ${career.dynasty.generation}ª geração`} title="Família e dinastia">
        <span className="text-sm text-ink-400">Custo anual com os filhos: <b className="tabular text-ink-100">{formatMoney(cost)}</b></span>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Vida a dois" className="xl:col-span-1">
          {partner ? (
            <div className="space-y-4">
              <div>
                <div className="font-display text-xl font-bold uppercase leading-tight">{partner.firstName} {partner.lastName}</div>
                <div className="text-sm text-ink-400">{partner.age} anos · {partner.married ? 'Casados' : 'Namorando'} desde a temporada {partner.sinceSeason}</div>
              </div>
              <Meter label="Relação" value={partner.relationship} hint={partner.relationship < FAMILY.CRISIS_RELATIONSHIP ? 'Em crise: tira moral a cada etapa e pode acabar.' : morale > 0 ? 'Relação feliz: dá moral a cada etapa.' : 'Estável.'} />
              <p className="text-sm text-ink-300"><b className="text-ink-100">{PARTNER_BACKGROUND_INFO[partner.background].name}.</b> {PARTNER_BACKGROUND_INFO[partner.background].description}</p>
              <p className="text-xs text-ink-400">A relação muda a cada ano com o padrão de vida, o tamanho do calendário, a intensidade do treino e o tempo em casa. As decisões do casal aparecem no painel, no começo de cada temporada.</p>
            </div>
          ) : (
            <p className="text-sm text-ink-400">
              {player.age < FAMILY.PARTNER_MIN_AGE ? `Ainda é cedo. A partir dos ${FAMILY.PARTNER_MIN_AGE} anos, você pode conhecer alguém no começo de uma temporada.` : 'Você está solteiro. A cada começo de temporada há uma chance de conhecer alguém.'}
              {divorces > 0 && ` Separações: ${divorces}.`}
            </p>
          )}
        </Card>

        <Card title="Você" className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Idade" value={player.age} hint={career.mode === 'driver' ? 'Piloto em atividade' : 'Aposentado das pistas'} />
            <Stat label="Geração" value={`${career.dynasty.generation}ª`} />
            <Stat label="Filhos" value={children.length} hint={`Máximo: ${FAMILY.MAX_CHILDREN}`} />
            <Stat label="Risco anual de morte" value={`${(mortalityRisk(player.age) * 100).toLocaleString('pt-BR')}%`} hint="Cresce com a idade" />
          </div>
          <p className="mt-4 text-sm text-ink-300">
            A carreira é da família. Quando o personagem morre ou passa o comando, um herdeiro assume: um filho que corre continua nas pistas; um herdeiro adulto assume o patrimônio e a equipe. Os filhos herdam parte do seu talento (metade vem de você, um quinto do parceiro e o resto é acaso).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!canHandOver} onClick={beginHandover}>Passar o comando em vida</Button>
            <span className="text-xs text-ink-400">{canHandOver ? 'Imposto de 4% sobre o patrimônio (metade do imposto de herança).' : 'Disponível no fechamento de uma temporada, depois de se aposentar das pistas.'}</span>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-display text-[15px] font-semibold uppercase tracking-wider text-ink-300">Filhos</h2>
        {children.length === 0 ? (
          <EmptyState title="Sem filhos">Com um relacionamento firme, a decisão de ter filhos aparece no começo de uma temporada.</EmptyState>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">{children.map((child) => <ChildCard key={child.id} child={child} />)}</div>
        )}
      </div>

      <Card title="Linhagem" padded={false}>
        <div className="px-4">
          <TableWrap>
            <table className="w-full">
              <thead><tr><th className={th}>Geração</th><th className={th}>Nome</th><th className={th}>Período</th><th className={th}>Melhor categoria</th><th className={cx(th, 'text-right')}>Títulos</th><th className={cx(th, 'text-right')}>Vitórias</th><th className={cx(th, 'text-right')}>Reputação máx.</th><th className={cx(th, 'text-right')}>Patrimônio deixado</th></tr></thead>
              <tbody>
                {career.dynasty.lineage.map((entry) => (
                  <tr key={`${entry.generation}-${entry.driverId}`} className="border-t border-ink-800">
                    <td className={cx(td, 'tabular')}>{entry.generation}ª</td>
                    <td className={cx(td, 'font-semibold')}>{entry.name}{entry.toSeason === null && <span className="ml-2"><Pill tone="accent">Atual</Pill></span>}</td>
                    <td className={cx(td, 'tabular text-ink-300')}>{entry.bornYear} · T{entry.fromSeason}{entry.toSeason !== null ? ` a T${entry.toSeason}` : ' em diante'}{entry.endReason === 'handover' ? ' (passou o comando)' : entry.endReason ? ' (†)' : ''}</td>
                    <td className={td}>{entry.bestCategoryId ? getCategory(entry.bestCategoryId).shortName : '-'}</td>
                    <td className={cx(td, 'text-right tabular')}>{entry.toSeason === null ? '-' : entry.titles}</td>
                    <td className={cx(td, 'text-right tabular')}>{entry.toSeason === null ? '-' : entry.wins}</td>
                    <td className={cx(td, 'text-right tabular')}>{Math.floor(Math.max(entry.peakReputation, entry.toSeason === null ? career.reputation : 0))}</td>
                    <td className={cx(td, 'text-right tabular')}>{entry.netWorthPassed !== null ? formatMoney(entry.netWorthPassed) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </Card>
    </div>
  );
}
