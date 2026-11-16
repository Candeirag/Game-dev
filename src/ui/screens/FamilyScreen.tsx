/** Família e dinastia: parceiro, filhos, linhagem e passagem de comando. */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Child, SUPPORT_LEVELS, type SupportLevel } from '@/domain/schemas';
import { CHILD_STAGE_LABELS, SUPPORT_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
import { getCategory } from '@/data/categories';
import { FAMILY, PARTNER_BACKGROUND_INFO, getTrait } from '@/data/family';
import { childScoutReport, childSummary, familyAnnualCost, fullName, mortalityRisk, overallRating, partnerMoraleEffect } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, EmptyState, Meter, PageHeader, Pill, Stat, TableWrap, Tabs, cx, td, th } from '../components/ui';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { LifeBackLink } from './life/LifeBackLink';

type FamilyTab = 'family' | 'children' | 'lineage';
const TABS: { value: FamilyTab; label: string }[] = [
  { value: 'family', label: 'Família' },
  { value: 'children', label: 'Filhos' },
  { value: 'lineage', label: 'Linhagem' },
];

/** Linhas compactas das tabelas de leitura. */
const cell = 'px-2 py-1.5 text-sm';

const stagePill = (stage: Child['stage']) => (
  <Pill tone={stage === 'racing' ? 'good' : stage === 'other' ? 'neutral' : 'warn'}>{CHILD_STAGE_LABELS[stage]}</Pill>
);

function SupportPicker({ value, onChange, label }: { value: SupportLevel; onChange: (v: SupportLevel) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-ink-300">{label}</span>
      <div className="inline-flex bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)]">
        {SUPPORT_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            className={cx(
              'min-h-11 min-w-11 px-3 text-sm font-semibold transition-colors',
              value === level ? 'bg-ink-700 text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-500)]' : 'text-ink-400 hover:text-ink-100',
            )}
          >
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
    <Card title={fullName(child)} action={stagePill(child.stage)} bodyClassName="space-y-3">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm text-ink-300">
            {child.age} anos · {childSummary(child)}
          </div>
          {child.stage !== 'other' && (
            <div className="text-sm text-ink-300">
              Avaliação dos treinadores: <b className="text-ink-100">{childScoutReport(child) ?? 'ainda não avaliado'}</b>
            </div>
          )}
          <ul className="space-y-0.5 text-xs leading-snug text-ink-400">
            {child.traits.map((t) => (
              <li key={t}>
                <b className="text-ink-200">{getTrait(t).name}</b>: {getTrait(t).description}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <Meter label="Relação com você" value={child.bond} />
          {child.stage !== 'other' && (
            <Meter
              label="Vontade de correr"
              value={child.interest}
              hint={
                child.stage !== 'racing'
                  ? `Ao fazer ${FAMILY.CAREER_START_AGE} anos, pede para correr se a vontade for ${FAMILY.CAREER_INTEREST} ou mais.`
                  : undefined
              }
              tone="neutral"
            />
          )}
        </div>
      </div>

      {canKart && (
        <div className="space-y-2 border-ink-800 border-t pt-3">
          <SupportPicker label="Investimento no kart:" value={child.kartFunding} onChange={(v) => setKartFunding(child.id, v)} />
          <p className="text-xs leading-snug text-ink-400">
            Parcial: {formatMoney(FAMILY.KART_COST.basic)} por ano (rende 60%). Total: {formatMoney(FAMILY.KART_COST.full)} por ano. Formação acumulada:{' '}
            <b className="text-ink-100">{counted(child.kartYears.toFixed(1).replace('.', ','), 'ano', 'anos')}</b>; cada ano vale cerca de{' '}
            {FAMILY.START_PER_KART_YEAR} pontos em todos os atributos na estreia.
          </p>
        </div>
      )}

      {racing && child.driver && (
        <div className="space-y-3 border-ink-800 border-t pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Nota geral" value={Math.floor(overallRating(child.driver.attributes))} hint={`Potencial ${Math.floor(child.driver.potential)}`} />
            <Stat label="Reputação" value={Math.floor(racing.reputation)} />
            <Stat label="Custo para a família" value={formatMoney(racing.familyCost)} hint="por temporada" />
            <Stat label="Academia" value={racing.academy ? 'Sim' : 'Não'} hint={racing.academy ?? 'Sem vínculo'} />
          </div>
          <SupportPicker label="Apoio à carreira:" value={child.support} onChange={(v) => setChildSupport(child.id, v)} />
          {racing.stalled > 0 && (
            <p className="text-sm text-gold-400">
              Sem dinheiro para a vaga: {child.firstName} corre de favor. Sem apoio, a carreira acaba na próxima temporada.
            </p>
          )}
          {racing.seasons.length > 0 && (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Ano</th>
                    <th className={th}>Categoria</th>
                    <th className={th}>Equipe</th>
                    <th className={cx(th, 'text-right')}>Posição</th>
                    <th className={cx(th, 'text-right')}>Vitórias</th>
                  </tr>
                </thead>
                <tbody>
                  {[...racing.seasons]
                    .reverse()
                    .slice(0, 8)
                    .map((s) => (
                      <tr key={s.season} className="border-ink-800 border-t">
                        <td className={cell}>{s.year}</td>
                        <td className={cell}>{getCategory(s.categoryId).shortName}</td>
                        <td className={cx(cell, 'text-ink-300')}>
                          {s.teamName}
                          {s.inWorld ? ' (sua equipe)' : ''}
                        </td>
                        <td className={cx(cell, 'text-right font-semibold')}>{s.position}º</td>
                        <td className={cx(cell, 'text-right')}>{s.wins}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}
    </Card>
  );
}

/** Filhos: a lista à esquerda escolhe quem aparece em detalhe à direita. */
function ChildrenTab({ items, cost }: { items: Child[]; cost: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((c) => c.id === selectedId) ?? items[0];
  if (!selected) return <EmptyState title="Sem filhos">Com um relacionamento firme, a decisão de ter filhos aparece no começo de uma temporada.</EmptyState>;
  return (
    <div className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
      <Card title="Filhos" action={<span className="text-xs text-ink-400">máximo: {FAMILY.MAX_CHILDREN}</span>} padded={false}>
        <ul className="divide-y divide-ink-800">
          {items.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                aria-pressed={child.id === selected.id}
                onClick={() => setSelectedId(child.id)}
                className={cx(
                  'flex min-h-12 w-full items-center justify-between gap-2 px-4 py-1.5 text-left transition-colors focus-visible:outline-offset-[-2px]',
                  child.id === selected.id ? 'bg-ink-800 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-800',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-100">{child.firstName}</span>
                  <span className="block text-xs text-ink-400">{child.age} anos</span>
                </span>
                {stagePill(child.stage)}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-ink-800 border-t px-4 py-2 text-xs text-ink-400">
          Custo anual com os filhos: <b className="text-ink-100">{formatMoney(cost)}</b>
        </p>
      </Card>
      <ChildCard child={selected} />
    </div>
  );
}

export function FamilyScreen() {
  const { career, player } = useCareerView();
  const beginHandover = useGameStore((s) => s.beginHandover);
  // A aba fica no endereço (?tab=...), como em Finanças.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: FamilyTab = TABS.find((t) => t.value === requested)?.value ?? 'family';
  const setTab = (next: FamilyTab) => setParams(next === 'family' ? {} : { tab: next }, { replace: true });
  const { partner, children, divorces } = career.family;
  const morale = partnerMoraleEffect(career.family);
  const cost = familyAnnualCost(career);
  const canHandOver = career.mode === 'executive' && career.executiveOffseason !== null;

  return (
    <div>
      <PageHeader
        title="Família e dinastia"
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <LifeBackLink />
            <span>
              Família {career.dynasty.surname} · {career.dynasty.generation}ª geração
            </span>
          </span>
        }
      >
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </PageHeader>

      {tab === 'family' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title="Vida a dois" bodyClassName="space-y-3">
            {partner ? (
              <>
                <div>
                  <div className="font-display text-xl font-bold uppercase leading-tight">
                    {partner.firstName} {partner.lastName}
                  </div>
                  <div className="text-sm text-ink-400">
                    {partner.age} anos · {partner.married ? 'Casados' : 'Namorando'} · juntos desde a temporada {partner.sinceSeason}
                  </div>
                </div>
                <Meter
                  label="Relação"
                  value={partner.relationship}
                  hint={
                    partner.relationship < FAMILY.CRISIS_RELATIONSHIP
                      ? 'Em crise: tira moral a cada etapa e pode acabar.'
                      : morale > 0
                        ? 'Relação feliz: dá moral a cada etapa.'
                        : 'Estável.'
                  }
                />
                <p className="text-sm leading-snug text-ink-300">
                  <b className="text-ink-100">{PARTNER_BACKGROUND_INFO[partner.background].name}.</b> {PARTNER_BACKGROUND_INFO[partner.background].description}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-300">
                {player.age < FAMILY.PARTNER_MIN_AGE
                  ? `Ainda é cedo. A partir dos ${FAMILY.PARTNER_MIN_AGE} anos, você pode conhecer alguém no começo de uma temporada.`
                  : 'Você está solteiro. A cada começo de temporada há uma chance de conhecer alguém.'}
                {divorces > 0 && ` Separações: ${divorces}.`}
              </p>
            )}
            <p className="text-xs leading-snug text-ink-400">
              A relação muda a cada ano com o padrão de vida, o tamanho do calendário, a intensidade do treino e o tempo em casa. As decisões do casal aparecem
              no painel, no começo de cada temporada.
            </p>
          </Card>

          <Card title="Você" bodyClassName="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Stat label="Idade" value={player.age} hint={career.mode === 'driver' ? 'Piloto em atividade' : 'Aposentado das pistas'} />
              <Stat label="Geração" value={`${career.dynasty.generation}ª`} />
              <Stat label="Filhos" value={children.length} hint={children.length > 0 ? `${formatMoney(cost)} por ano` : `Máximo: ${FAMILY.MAX_CHILDREN}`} />
              <Stat label="Risco anual de morte" value={`${(mortalityRisk(player.age) * 100).toLocaleString('pt-BR')}%`} hint="Cresce com a idade" />
            </div>
            <p className="text-xs leading-snug text-ink-300">
              A carreira é da família. Quando o personagem morre ou passa o comando, um herdeiro assume: um filho que corre continua nas pistas; um herdeiro
              adulto assume o patrimônio e a equipe. Os filhos herdam parte do seu talento (metade vem de você, um quinto do parceiro e o resto é acaso).
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button disabled={!canHandOver} onClick={beginHandover}>
                Passar o comando em vida
              </Button>
              <span className="min-w-40 flex-1 text-xs leading-snug text-ink-400">
                {canHandOver
                  ? 'Imposto de 4% sobre o patrimônio (metade do imposto de herança).'
                  : 'Disponível no fechamento de uma temporada, depois de se aposentar das pistas.'}
              </span>
            </div>
          </Card>
        </div>
      )}

      {tab === 'children' && <ChildrenTab items={children} cost={cost} />}

      {tab === 'lineage' && (
        <Card title="Linhagem" padded={false}>
          <div className="px-4">
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Geração</th>
                    <th className={th}>Nome</th>
                    <th className={th}>Período</th>
                    <th className={th}>Melhor categoria</th>
                    <th className={cx(th, 'text-right')}>Títulos</th>
                    <th className={cx(th, 'text-right')}>Vitórias</th>
                    <th className={cx(th, 'text-right')}>Reputação máx.</th>
                    <th className={cx(th, 'text-right')}>Patrimônio deixado</th>
                  </tr>
                </thead>
                <tbody>
                  {career.dynasty.lineage.map((entry) => (
                    <tr key={`${entry.generation}-${entry.driverId}`} className="border-ink-800 border-t">
                      <td className={td}>{entry.generation}ª</td>
                      <td className={cx(td, 'font-semibold')}>
                        <span className="flex flex-wrap items-center gap-2">
                          {entry.name}
                          {entry.toSeason === null && <Pill tone="accent">Atual</Pill>}
                        </span>
                      </td>
                      <td className={cx(td, 'text-ink-300')}>
                        {entry.bornYear} · T{entry.fromSeason}
                        {entry.toSeason !== null ? ` a T${entry.toSeason}` : ' em diante'}
                        {entry.endReason === 'handover'
                          ? ' (passou o comando)'
                          : entry.endReason === 'accident'
                            ? ' (acidente)'
                            : entry.endReason
                              ? ' (faleceu)'
                              : ''}
                      </td>
                      <td className={td}>{entry.bestCategoryId ? getCategory(entry.bestCategoryId).shortName : '–'}</td>
                      <td className={cx(td, 'text-right')}>{entry.toSeason === null ? '–' : entry.titles}</td>
                      <td className={cx(td, 'text-right')}>{entry.toSeason === null ? '–' : entry.wins}</td>
                      <td className={cx(td, 'text-right')}>{Math.floor(Math.max(entry.peakReputation, entry.toSeason === null ? career.reputation : 0))}</td>
                      <td className={cx(td, 'text-right')}>{entry.netWorthPassed !== null ? formatMoney(entry.netWorthPassed) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>
      )}
    </div>
  );
}
