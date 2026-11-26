/**
 * Família e dinastia: parceiro, filhos, linhagem e passagem de comando. Cada filho mostra a
 * personalidade, os talentos e defeitos de nascença (ocultos até o teste no kart e as temporadas
 * de carreira própria revelarem) e o teste no kart. A tela só lê o motor e chama a store.
 */
import { type ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { type BirthTrait, type Child, SUPPORT_LEVELS, type SupportLevel } from '@/domain/schemas';
import { CHILD_STAGE_LABELS, SUPPORT_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
import { HERITAGE } from '@/config/balance';
import { ASSET_RULES } from '@/data/assets';
import { BIRTH_TRAITS } from '@/data/birth';
import { getCategory } from '@/data/categories';
import { FAMILY, PARTNER_BACKGROUND_INFO, getTrait } from '@/data/family';
import { KART_TEST_VERDICT_INFO, type KartTestVerdict } from '@/data/heritage';
import {
  activeBirth,
  canTakeKartTest,
  childScoutReport,
  childSummary,
  familyAnnualCost,
  fullName,
  heritageTraitsFor,
  kartTestVerdict,
  mortalityRisk,
  overallRating,
  partnerMoraleEffect,
} from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, Chip, cx, EmptyState, Meter, PageHeader, Pill, SecretCard, Segmented, Stat, TableWrap, Tabs, td, th } from '@/ui/kit';
import { formatInterval, formatMoney } from '../format';
import { useCareer, useCareerView } from '../hooks/useCareer';
import { DynastyLink } from './DynastyScreen';
import { LifeBackLink } from './life/LifeBackLink';

type FamilyTab = 'family' | 'children' | 'lineage';
const TABS: { value: FamilyTab; label: string }[] = [
  { value: 'family', label: 'Família' },
  { value: 'children', label: 'Filhos' },
  { value: 'lineage', label: 'Linhagem' },
];

/** Linhas compactas das tabelas de leitura. */
const cell = 'px-2 py-2 text-sm';

/** "40%": as frações das tabelas, em porcentagem. */
const percent = (share: number) => `${Math.round(share * 100)}%`;

const stagePill = (stage: Child['stage']) => (
  <Pill tone={stage === 'racing' ? 'good' : stage === 'other' ? 'neutral' : 'warn'}>{CHILD_STAGE_LABELS[stage]}</Pill>
);

/** Nível de apoio da família (nenhum, parcial ou total), pelo seletor do kit. */
function SupportPicker({ value, onChange, label }: { value: SupportLevel; onChange: (v: SupportLevel) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="text-ink-300">{label}</span>
      <Segmented
        label={label.replace(/:$/, '')}
        value={value}
        options={SUPPORT_LEVELS.map((level) => ({ value: level, label: SUPPORT_LABELS[level] }))}
        onChange={onChange}
      />
    </div>
  );
}

/** Como um talento ou defeito oculto deste filho pode aparecer, pela fase em que ele está. */
function hiddenHint(child: Child): string {
  const young = child.stage === 'child' || child.stage === 'karting';
  if (young && child.kartTest === null && child.age < FAMILY.CAREER_START_AGE)
    return `Aparece no teste no kart, aos ${HERITAGE.KART_TEST_AGE} anos, ou nas temporadas de carreira própria.`;
  if (young) return `Pode aparecer nas temporadas de carreira própria, a partir dos ${FAMILY.CAREER_START_AGE} anos.`;
  if (child.stage === 'racing') return 'Pode aparecer a cada temporada de carreira própria.';
  return 'Longe das pistas, fica oculto.';
}

/** Quando e onde um traço foi revelado: no teste no kart ou numa temporada de carreira própria. */
function revealedMeta(child: Child, trait: BirthTrait): string | undefined {
  if (trait.revealedSeason === null) return undefined;
  return `Temporada ${trait.revealedSeason} · ${child.kartTest?.revealed.includes(trait.id) ? 'teste no kart' : 'carreira própria'}`;
}

const VERDICT_TONE: Record<KartTestVerdict, 'good' | 'neutral' | 'attention'> = {
  outstanding: 'good',
  promising: 'good',
  average: 'neutral',
  limited: 'attention',
};

/** O teste no kart: o resultado, se já foi feito, ou quando ele acontece. */
function KartTestLine({ child }: { child: Child }) {
  const test = child.kartTest;
  const cost = HERITAGE.KART_TEST_COST;
  const reveals = HERITAGE.KART_TEST_REVEALS;
  let text: ReactNode;
  if (test) {
    const verdict = kartTestVerdict(test.gap);
    text = (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          <b className="tabular-nums text-ink-100">{formatInterval(test.gap)} s</b> do tempo de referência dos instrutores
        </span>
        <Chip size="sm" tone={VERDICT_TONE[verdict]} icon={null}>
          {KART_TEST_VERDICT_INFO[verdict].label}
        </Chip>
        <span className="text-ink-400">
          Teste {test.depth === 'full' ? 'completo' : 'rápido'}, temporada {test.season}
        </span>
      </span>
    );
  } else if (canTakeKartTest(child)) {
    text = `Na idade do teste: a família decide no começo da temporada, até os ${FAMILY.CAREER_START_AGE - 1} anos. O completo custa ${formatMoney(cost.full)} e revela ${counted(reveals.full, 'talento ou defeito', 'talentos ou defeitos')}; o rápido, ${formatMoney(cost.quick)} e ${counted(reveals.quick, 'talento ou defeito', 'talentos ou defeitos')}.`;
  } else if ((child.stage === 'child' || child.stage === 'karting') && child.age < HERITAGE.KART_TEST_AGE) {
    text = `O teste vem no começo da temporada em que ${child.firstName} tiver ${HERITAGE.KART_TEST_AGE} anos (daqui a ${counted(HERITAGE.KART_TEST_AGE - child.age, 'ano', 'anos')}). O completo custa ${formatMoney(cost.full)} e revela ${counted(reveals.full, 'talento ou defeito', 'talentos ou defeitos')}; o rápido, ${formatMoney(cost.quick)} e ${counted(reveals.quick, 'talento ou defeito', 'talentos ou defeitos')}.`;
  } else {
    text = 'Não fez o teste no kart.';
  }
  return (
    <div className="flex items-start gap-2 text-xs leading-snug text-ink-300">
      <Timer size={16} aria-hidden className="mt-1 shrink-0 text-ink-400" />
      <div className="min-w-0">
        <div className="text-2xs font-medium text-ink-400">Teste no kart</div>
        {text}
      </div>
    </div>
  );
}

/** Talentos e defeitos de nascença: os ocultos com "?" e a dica de como aparecem; os revelados com nome e quando. */
function ChildHeritage({ child }: { child: Child }) {
  const career = useCareer();
  const traits = heritageTraitsFor(career, child);
  const hidden = traits.filter((t) => t.revealedSeason === null).length;
  const hint = hiddenHint(child);
  return (
    <div className="space-y-2 border-ink-800 border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-ink-100">Talentos e defeitos de nascença</h3>
        <span className="text-xs text-ink-400">{hidden > 0 ? counted(hidden, 'oculto', 'ocultos') : 'Todos revelados'}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {traits.map((trait) => {
          const info = BIRTH_TRAITS[trait.id];
          return (
            <SecretCard
              key={trait.id}
              hidden={trait.revealedSeason === null}
              kind={info.kind}
              title={info.name}
              description={info.description}
              meta={revealedMeta(child, trait)}
              hint={hint}
            />
          );
        })}
      </div>
      <KartTestLine child={child} />
    </div>
  );
}

function ChildCard({ child }: { child: Child }) {
  const setKartFunding = useGameStore((s) => s.setKartFunding);
  const setChildSupport = useGameStore((s) => s.setChildSupport);
  const racing = child.stage === 'racing' ? child.racing : null;
  const canKart = (child.stage === 'child' || child.stage === 'karting') && child.age >= FAMILY.KART_START_AGE && child.age < FAMILY.CAREER_START_AGE;
  return (
    <Card title={fullName(child)} action={stagePill(child.stage)} bodyClassName="space-y-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-ink-300">
            {child.age} anos · {childSummary(child)}
          </div>
          {child.stage !== 'other' && (
            <div className="text-sm text-ink-300">
              Avaliação dos treinadores: <b className="text-ink-100">{childScoutReport(child) ?? 'ainda não avaliado'}</b>
            </div>
          )}
          <div>
            <div className="text-2xs font-medium text-ink-400">Personalidade</div>
            <ul className="space-y-1 text-xs leading-snug text-ink-400">
              {child.traits.map((t) => (
                <li key={t}>
                  <b className="text-ink-200">{getTrait(t).name}</b>: {getTrait(t).description}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
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

      <ChildHeritage child={child} />

      {canKart && (
        <div className="space-y-2 border-ink-800 border-t pt-4">
          <SupportPicker label="Investimento no kart:" value={child.kartFunding} onChange={(v) => setKartFunding(child.id, v)} />
          <p className="text-xs leading-snug text-ink-400">
            Parcial: {formatMoney(FAMILY.KART_COST.basic)} por ano (rende {percent(FAMILY.KART_YIELD.basic)}). Total: {formatMoney(FAMILY.KART_COST.full)} por
            ano. Formação acumulada: <b className="text-ink-100">{counted(child.kartYears.toFixed(1).replace('.', ','), 'ano', 'anos')}</b>; cada ano vale cerca
            de {FAMILY.START_PER_KART_YEAR} pontos em todos os atributos na estreia.
          </p>
        </div>
      )}

      {racing && child.driver && (
        <div className="space-y-4 border-ink-800 border-t pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                  'flex min-h-12 w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors focus-visible:outline-offset-[-2px]',
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
  const ownTraits = activeBirth(career) !== null;

  return (
    <div>
      <PageHeader
        title="Família e dinastia"
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LifeBackLink />
            <span>
              Família {career.dynasty.surname} · {career.dynasty.generation}ª geração
            </span>
          </span>
        }
      >
        <Tabs value={tab} options={TABS} onChange={setTab} />
        <DynastyLink />
      </PageHeader>

      {tab === 'family' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title="Vida a dois" bodyClassName="space-y-4">
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
                  : 'Sem relacionamento no momento. A cada começo de temporada há uma chance de conhecer alguém.'}
                {divorces > 0 && ` Separações: ${divorces}.`}
              </p>
            )}
            <p className="text-xs leading-snug text-ink-400">
              A relação muda a cada ano com o padrão de vida, o tamanho do calendário, a intensidade do treino e o tempo em casa. As decisões do casal aparecem
              no painel, no começo de cada temporada.
            </p>
          </Card>

          <Card title="Você" bodyClassName="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Stat label="Idade" value={player.age} hint={career.mode === 'driver' ? 'Piloto em atividade' : 'Aposentado das pistas'} />
              <Stat label="Geração" value={`${career.dynasty.generation}ª`} />
              <Stat label="Filhos" value={children.length} hint={children.length > 0 ? `${formatMoney(cost)} por ano` : `Máximo: ${FAMILY.MAX_CHILDREN}`} />
              <Stat label="Risco anual de morte" value={`${(mortalityRisk(player.age) * 100).toLocaleString('pt-BR')}%`} hint="Cresce com a idade" />
            </div>
            <p className="text-xs leading-snug text-ink-300">
              A carreira é da família. Quando o personagem morre ou passa o comando, alguém da família assume: quem já corre pode continuar nas pistas; quem é
              adulto pode assumir o patrimônio e a equipe. Cada filho herda parte do talento ({percent(FAMILY.TALENT_PARENT)} vem de você,{' '}
              {percent(FAMILY.TALENT_PARTNER)} da outra metade do casal e o resto é acaso) e parte dos talentos e defeitos de nascença:{' '}
              {ownTraits
                ? `cada um dos seus passa para cada filho com ${percent(HERITAGE.INHERIT_CHANCE)} de chance, e o resto é sorteado.`
                : 'como esta carreira não tem nascimento sorteado, os dos filhos são todos sorteados.'}{' '}
              Eles ficam ocultos até o teste no kart, aos {HERITAGE.KART_TEST_AGE} anos, e as temporadas de carreira própria.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button disabled={!canHandOver} onClick={beginHandover}>
                Passar o comando em vida
              </Button>
              <span className="min-w-40 flex-1 text-xs leading-snug text-ink-400">
                {canHandOver
                  ? `Imposto de ${percent(ASSET_RULES.HANDOVER_TAX)} sobre o patrimônio acima de ${formatMoney(ASSET_RULES.INHERITANCE_EXEMPT)} (o de herança é ${percent(ASSET_RULES.INHERITANCE_TAX)}).`
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
