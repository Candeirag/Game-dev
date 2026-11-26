/**
 * Dinastia: a árvore da família (cada geração, com o parceiro, os filhos atuais e os parentes que
 * seguiram outro caminho) e o placar (títulos, vitórias, pódios e equipes de cada geração, com o
 * total da família). Chega-se a ela por Vida e por Família. Só lê o motor: `familyTree`,
 * `generationRecords` e `dynastyTotals`.
 */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, CircleHelp, Flag, Heart, HeartPulse, Network, Sparkles, Sprout, TriangleAlert } from 'lucide-react';
import type { BirthTrait, Elder, LineageEntry, TraitId } from '@/domain/schemas';
import { CHILD_STAGE_LABELS } from '@/domain/labels';
import { counted } from '@/domain/text';
import { BIRTH_TRAITS } from '@/data/birth';
import { getCategory } from '@/data/categories';
import { ELDER_ROLE_INFO, RELATIVE_PATH_INFO } from '@/data/dynasty';
import {
  dynastyTotals,
  familyTree,
  familyYear,
  generationRecords,
  type FamilyTreeChild,
  type FamilyTreeGeneration,
  type FamilyTreeRelative,
  type GenerationRecord,
} from '@/engine';
import { Card, Chip, cx, GenerationTree, PageHeader, Pill, TableWrap, Tabs, TreeBranch, TreeBranches, TreeGeneration, td, th } from '@/ui/kit';
import { formatMoney } from '../format';
import { useCareerView } from '../hooks/useCareer';
import { commandPeriod, endLabel, generationLife, lifeYears, racedToText, takeoverLabel, teamsText, type GenerationLife } from './dynasty/dynastyText';
import { LifeBackLink } from './life/LifeBackLink';

type DynastyTab = 'arvore' | 'placar';
const TABS: { value: DynastyTab; label: string }[] = [
  { value: 'arvore', label: 'Árvore' },
  { value: 'placar', label: 'Placar' },
];

/** Atalho para esta tela, no cabeçalho de Família. */
export function DynastyLink() {
  return (
    <Link
      to="/dinastia"
      className="chamfer-br inline-flex min-h-11 items-center gap-2 bg-ink-800 px-4 text-sm font-semibold text-ink-100 shadow-ring transition-colors hover:bg-ink-700"
    >
      <Network size={16} aria-hidden className="shrink-0" />
      Árvore e placar
    </Link>
  );
}

/** Um talento ou defeito revelado: a palavra e o ícone vão junto com a cor. */
function TraitChip({ id, kind }: { id: TraitId; kind: 'talent' | 'defect' }) {
  const talent = kind === 'talent';
  return (
    <Chip
      size="sm"
      tone={talent ? 'good' : 'attention'}
      icon={talent ? <Sparkles size={12} aria-hidden className="shrink-0" /> : <TriangleAlert size={12} aria-hidden className="shrink-0" />}
    >
      {talent ? 'Talento' : 'Defeito'}: {BIRTH_TRAITS[id].name}
    </Chip>
  );
}

/** Quantos talentos e defeitos ainda estão ocultos. */
function HiddenChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Chip size="sm" icon={<CircleHelp size={12} aria-hidden className="shrink-0" />}>
      {counted(count, 'traço oculto', 'traços ocultos')}
    </Chip>
  );
}

const revealedOf = (traits: readonly BirthTrait[]) => traits.filter((t) => t.revealedSeason !== null).map((t) => ({ id: t.id, kind: BIRTH_TRAITS[t.id].kind }));

const TAKEOVER_ICON: Record<'founder' | NonNullable<LineageEntry['path']>, typeof Flag> = { founder: Sprout, driver: Flag, executive: Briefcase };

function ChildBranch({ child }: { child: FamilyTreeChild }) {
  return (
    <TreeBranch>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold text-ink-100">{child.name}</span>
        <span className="text-xs text-ink-300">
          {counted(child.age, 'ano', 'anos')} · {CHILD_STAGE_LABELS[child.stage]}
        </span>
      </div>
      {(child.revealed.length > 0 || child.hidden > 0) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {child.revealed.map((t) => (
            <TraitChip key={t.id} id={t.id} kind={t.kind} />
          ))}
          <HiddenChip count={child.hidden} />
        </div>
      )}
    </TreeBranch>
  );
}

function RelativeBranch({ relative }: { relative: FamilyTreeRelative }) {
  return (
    <TreeBranch>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold text-ink-100">{relative.name}</span>
        <span className="text-xs text-ink-300">{counted(relative.age, 'ano', 'anos')}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-300">
        <Chip size="sm">{RELATIVE_PATH_INFO[relative.path].label}</Chip>
        <span>Nível no ofício: {Math.floor(relative.skill)}</span>
        <span>{racedToText(relative.racedTo)}</span>
      </div>
    </TreeBranch>
  );
}

function GenerationContent({
  node,
  record,
  life,
  elder,
  surname,
}: {
  node: FamilyTreeGeneration;
  record: GenerationRecord;
  life: GenerationLife;
  elder: Elder | null;
  surname: string;
}) {
  const takeover = takeoverLabel(node.generation, node.path);
  const TakeoverIcon = TAKEOVER_ICON[node.generation === 1 ? 'founder' : (node.path ?? 'driver')];
  const end = endLabel(life);
  const revealed = revealedOf(record.traits);
  const hidden = record.traits.length - revealed.length;
  const hasBranches = node.children.length > 0 || node.relatives.length > 0 || node.current;
  return (
    <div className={cx('grid gap-x-6 gap-y-2', hasBranches && 'md:grid-cols-2')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-xl font-bold uppercase leading-tight text-ink-100">{node.name}</h3>
          {takeover && (
            <Chip size="sm" icon={<TakeoverIcon size={12} aria-hidden className="shrink-0" />}>
              {takeover}
            </Chip>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-300">{lifeYears(life)}</p>
        <p className="text-sm text-ink-300">{commandPeriod(life)}</p>
        {end && <p className="text-sm text-ink-300">{end}</p>}
        {(elder || revealed.length > 0 || hidden > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {elder && (
              <>
                <Chip size="sm" tone="good" icon={<HeartPulse size={12} aria-hidden className="shrink-0" />}>
                  Em vida
                </Chip>
                <Chip size="sm">
                  {ELDER_ROLE_INFO[elder.role].label}
                  {elder.teamName ? ` · ${elder.teamName}` : ''}
                </Chip>
              </>
            )}
            {revealed.map((t) => (
              <TraitChip key={t.id} id={t.id} kind={t.kind} />
            ))}
            <HiddenChip count={hidden} />
          </div>
        )}
        {node.partnerName && (
          <p className="mt-2 flex items-center gap-1 text-xs text-ink-300">
            <Heart size={14} aria-hidden className="shrink-0 text-ink-400" />
            Vida a dois com {node.partnerName}
          </p>
        )}
      </div>
      {hasBranches && (
        <div className="min-w-0 space-y-2">
          {/* "Próxima geração", e não "Filhos": quando o herdeiro foi o parceiro ou um parente, os filhos de quem
              saiu seguem na família de quem os cria, e o motor ainda não diz de quem cada criança é. */}
          {node.children.length > 0 && (
            <TreeBranches title="Próxima geração" label={`Próxima geração da família ${surname}`}>
              {node.children.map((child) => (
                <ChildBranch key={child.id} child={child} />
              ))}
            </TreeBranches>
          )}
          {node.current && node.children.length === 0 && <p className="text-xs text-ink-400">Ainda sem filhos.</p>}
          {node.relatives.length > 0 && (
            <TreeBranches title="Seguiram outro caminho" label={`Parentes da ${node.generation}ª geração que seguiram outro caminho`}>
              {node.relatives.map((relative) => (
                <RelativeBranch key={relative.id} relative={relative} />
              ))}
            </TreeBranches>
          )}
        </div>
      )}
    </div>
  );
}

function TreeTab() {
  const { career, player } = useCareerView();
  const { tree, records } = useMemo(() => ({ tree: familyTree(career), records: generationRecords(career) }), [career]);
  const year = familyYear(career);
  return (
    <Card title={`Árvore da família ${tree.surname}`}>
      <GenerationTree label={`Gerações da família ${tree.surname}`}>
        {tree.generations.map((node, index) => {
          const record = records[index];
          if (!record) return null;
          const elder = tree.elders.find((e) => e.driverId === node.driverId) ?? null;
          const life = generationLife(node, record, { playerAge: player.age, elder, year });
          return (
            <TreeGeneration
              key={`${node.generation}-${node.driverId}`}
              marker={`${node.generation}ª`}
              markerLabel={`${node.generation}ª geração`}
              current={node.current}
            >
              <GenerationContent node={node} record={record} life={life} elder={elder} surname={tree.surname} />
            </TreeGeneration>
          );
        })}
      </GenerationTree>
    </Card>
  );
}

/**
 * Coluna fixa do nome: fica à vista quando a tabela rola para o lado. A rolagem (`TableWrap`) tem 16 px
 * de margem por dentro e a célula fixa para na borda dessa margem; com `-left-4`, ela encosta na borda
 * da caixa e cobre a faixa por onde as colunas roladas apareceriam.
 */
const sticky = 'sticky -left-4 z-10 bg-ink-900';
const num = cx(td, 'whitespace-nowrap text-right');
const numHead = cx(th, 'text-right');

function ScoreTab() {
  const { career } = useCareerView();
  const { records, totals } = useMemo(() => ({ records: generationRecords(career), totals: dynastyTotals(career) }), [career]);
  const peak = Math.max(...records.map((r) => r.peakReputation));
  return (
    <div className="space-y-4">
      <Card title="Placar da dinastia" padded={false}>
        <div className="px-4">
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={cx(th, sticky)}>Geração</th>
                  <th className={numHead}>Títulos</th>
                  <th className={numHead}>Vitórias</th>
                  <th className={numHead}>Pódios</th>
                  <th className={th}>Melhor categoria</th>
                  <th className={numHead}>Temporadas de piloto</th>
                  <th className={numHead}>Temporadas de dirigente</th>
                  <th className={numHead}>Reputação máxima</th>
                  <th className={numHead}>Patrimônio deixado</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={`${r.generation}-${r.driverId}`} className="border-ink-800 border-t">
                    <td className={cx(td, sticky)}>
                      <span className="block whitespace-nowrap">
                        <span className="text-ink-300">{r.generation}ª</span> <span className="font-semibold text-ink-100">{r.name}</span>
                      </span>
                      {r.current && (
                        <span className="mt-1 block">
                          <Pill tone="accent">Atual</Pill>
                        </span>
                      )}
                    </td>
                    <td className={num}>{r.titles}</td>
                    <td className={num}>{r.wins}</td>
                    <td className={num}>{r.podiums}</td>
                    <td className={cx(td, 'whitespace-nowrap')}>{r.bestCategoryId ? getCategory(r.bestCategoryId).shortName : '–'}</td>
                    <td className={num}>{r.driverSeasons}</td>
                    <td className={num}>{r.executiveSeasons}</td>
                    <td className={num}>{Math.floor(r.peakReputation)}</td>
                    <td className={num}>{r.netWorthPassed !== null ? formatMoney(r.netWorthPassed) : '–'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-ink-600 border-t-2 font-semibold">
                  <td className={cx(td, sticky)}>
                    <span className="block whitespace-nowrap text-ink-100">Família {career.dynasty.surname}</span>
                    <span className="block text-xs font-normal text-ink-300">{counted(totals.generations, 'geração', 'gerações')}</span>
                  </td>
                  <td className={num}>{totals.titles}</td>
                  <td className={num}>{totals.wins}</td>
                  <td className={num}>{totals.podiums}</td>
                  <td className={cx(td, 'whitespace-nowrap')}>{totals.bestCategoryId ? getCategory(totals.bestCategoryId).shortName : '–'}</td>
                  <td className={num}>{totals.driverSeasons}</td>
                  <td className={num}>{totals.executiveSeasons}</td>
                  <td className={num}>{Math.floor(peak)}</td>
                  <td className={num}>–</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </div>
      </Card>

      <Card
        title="Equipes de cada geração"
        action={<span className="text-xs text-ink-300">{counted(totals.teams, 'equipe diferente', 'equipes diferentes')}</span>}
        padded={false}
      >
        <ul className="divide-y divide-ink-800">
          {records.map((r) => (
            <li key={`${r.generation}-${r.driverId}`} className="grid items-start gap-x-6 gap-y-1 px-4 py-2 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-ink-300">{r.generation}ª</span>
                <span className="font-semibold text-ink-100">{r.name}</span>
                {r.current && <Pill tone="accent">Atual</Pill>}
              </span>
              <span className="text-sm text-ink-300">
                <span className="text-ink-400">Correu por: </span>
                {teamsText(r.drivenTeams, 'nenhuma equipe')}
              </span>
              <span className="text-sm text-ink-300">
                <span className="text-ink-400">Dirigiu: </span>
                {teamsText(r.managedTeams, 'nenhuma equipe')}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function DynastyScreen() {
  const { career } = useCareerView();
  // A aba fica no endereço (?tab=placar); a árvore é a padrão, sem ?tab.
  const [params, setParams] = useSearchParams();
  const tab: DynastyTab = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'arvore';
  const setTab = (next: DynastyTab) => setParams(next === 'arvore' ? {} : { tab: next }, { replace: true });
  const { generation, surname } = career.dynasty;

  return (
    <div>
      <PageHeader
        title="Dinastia"
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <LifeBackLink />
            <span>
              Família {surname} · {generation}ª geração
            </span>
          </span>
        }
      >
        <Tabs value={tab} options={TABS} onChange={setTab} />
      </PageHeader>
      {tab === 'arvore' ? <TreeTab /> : <ScoreTab />}
    </div>
  );
}
