/**
 * Sucessão: a escolha do herdeiro. Fica no lugar de todas as telas enquanto estiver aberta.
 *
 * Na tela deitada: à esquerda, o que aconteceu (patrimônio e imposto) e a lista de quem pode
 * assumir; à direita, o que se sabe de quem está selecionado (`heirOutlook`), o caminho e, pelas
 * pistas, a vaga da primeira temporada (`heirSeatOptions`). O passo que decide vai na barra do pé.
 * A tela não decide nada: só mostra o que o motor diz e chama a store.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { ArrowRight, CircleHelp, TriangleAlert } from 'lucide-react';
import type { Child, HeirOption } from '@/domain/schemas';
import { SUCCESSION_CAUSE_LABELS } from '@/domain/labels';
import { joinList, pluralWord } from '@/domain/text';
import { FAMILY_TEAM, HEIR_START } from '@/config/balance';
import { ASSET_RULES } from '@/data/assets';
import { getCategory } from '@/data/categories';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { FAMILY, getTrait } from '@/data/family';
import { KART_TEST_VERDICT_INFO } from '@/data/heritage';
import { childSummary, heirOutlook, heirSeatOptions, overallRating, type HeirSeat, type HeirSeatOption } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, Chip, ChoiceCard, cx, PageHeader, Stat } from '@/ui/kit';
import { TraitChip } from '../components/BirthSheet';
import { formatInterval, formatMoney } from '../format';
import { useCareer } from '../hooks/useCareer';
import { ScreenAction } from '../layout/ScreenAction';

type Path = 'driver' | 'executive';

/** "25%": as frações das tabelas, em porcentagem. */
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** O vínculo com quem saiu, sem gênero (o jogo não sabe o de ninguém). */
const KIND_LABELS: Record<HeirOption['kind'], string> = { child: 'Descendente', partner: 'Cônjuge', relative: 'Parente' };

const SEAT_TITLES: Record<HeirSeat, string> = { current: 'Equipe atual', top: 'Equipe da frente', family: 'Equipe da família' };

/** "engenharia, negócios ou direção esportiva": os caminhos de quem não herda a carreira. */
function relativePaths(): string {
  const labels = Object.values(RELATIVE_PATH_INFO).map((info) => info.label.toLowerCase());
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} ou ${labels[labels.length - 1]}` : (labels[0] ?? '');
}

/** O que cada herdeiro pode fazer, em palavras (a lista não diz nada só pela cor). */
function abilityChip(heir: HeirOption) {
  const className = 'shrink-0 whitespace-nowrap';
  if (heir.canDrive && heir.canManage)
    return (
      <Chip size="sm" className={className}>
        Pistas ou negócios
      </Chip>
    );
  if (heir.canDrive)
    return (
      <Chip size="sm" className={className}>
        Pistas
      </Chip>
    );
  if (heir.canManage)
    return (
      <Chip size="sm" className={className}>
        Negócios
      </Chip>
    );
  return (
    <Chip size="sm" tone="attention" className={className}>
      Menor de idade
    </Chip>
  );
}

/**
 * Quem é o herdeiro, em uma frase sem gênero (o jogo não sabe o de ninguém). O filho é descrito pelo
 * que faz e pela personalidade; o cônjuge e os parentes, pelo vínculo com quem saiu.
 */
function heirText(heir: HeirOption, child: Child | undefined, former: string, married: boolean): string {
  if (child) return `${childSummary(child)}. Personalidade: ${child.traits.map((t) => getTrait(t).name.toLowerCase()).join(', ')}.`;
  if (heir.kind === 'partner')
    return `${married ? 'Casamento' : 'Relacionamento'} com ${former}. Pode cuidar dos negócios e dos filhos até alguém da família poder assumir.`;
  if (heir.canDrive) return `Da família de ${former}, promessa do kart. Assume a carreira nas pistas do começo.`;
  return `Da família de ${former}. Não corre, mas pode cuidar do patrimônio e dos negócios da família.`;
}

/** Uma linha do que se sabe do herdeiro: o rótulo à esquerda, o valor à direita. */
function OutlookRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-1 text-2xs font-medium text-ink-400">{label}</dt>
      <dd className="min-w-0 text-sm text-ink-100">{children}</dd>
    </>
  );
}

function HeirDetail({ heir, owner, siblings }: { heir: HeirOption; owner: boolean; siblings: string[] }) {
  const career = useCareer();
  const resolve = useGameStore((s) => s.resolveSuccession);
  const outlook = useMemo(() => heirOutlook(career, heir), [career, heir]);
  const seats = useMemo<HeirSeatOption[]>(() => (heir.canDrive ? heirSeatOptions(career, heir.id) : []), [career, heir]);
  const [path, setPath] = useState<Path | null>(heir.canDrive ? 'driver' : heir.canManage ? 'executive' : null);
  const [seat, setSeat] = useState<HeirSeat>('current');
  const child = heir.childId ? career.family.children.find((c) => c.id === heir.childId) : undefined;
  const driver = child?.driver ?? heir.driver;
  const racing = child?.racing ?? heir.racing;
  const traits = outlook.revealed.length + outlook.hidden;
  const chosenSeat = seats.find((s) => s.id === seat && s.available);
  const first = heir.name.split(' ')[0] ?? heir.name;
  const former = career.succession?.formerName.split(' ')[0] ?? '';

  return (
    <Card title={heir.name} action={<Chip size="sm">{KIND_LABELS[heir.kind]}</Chip>} bodyClassName="space-y-4 p-4">
      <p className="text-sm leading-snug text-ink-300">
        {heir.age} anos. {heirText(heir, child, former, career.family.partner?.married ?? false)}
      </p>

      {/* O que se sabe: talentos e defeitos revelados, teste no kart, treinadores, onde corre. */}
      <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2">
        {traits > 0 && (
          <OutlookRow label="Talentos e defeitos">
            <span className="flex flex-wrap gap-1">
              {outlook.revealed.map((t) => (
                <TraitChip key={t.id} id={t.id} />
              ))}
              {outlook.hidden > 0 && (
                <Chip size="sm" icon={<CircleHelp size={12} aria-hidden className="shrink-0" />}>
                  {outlook.hidden} {pluralWord(outlook.hidden, 'oculto', 'ocultos')}
                </Chip>
              )}
            </span>
          </OutlookRow>
        )}
        {(outlook.kartTest || child) && (
          <OutlookRow label="Teste no kart">
            {outlook.kartTest ? (
              <>
                <b className="tabular-nums">{formatInterval(outlook.kartTest.gap)} s</b> do tempo de referência ·{' '}
                {KART_TEST_VERDICT_INFO[outlook.kartTest.verdict].label} ({outlook.kartTest.depth === 'full' ? 'teste completo' : 'teste rápido'})
              </>
            ) : (
              <span className="text-ink-300">Não fez</span>
            )}
          </OutlookRow>
        )}
        {(outlook.scout || child) && (
          <OutlookRow label="Treinadores">{outlook.scout ?? <span className="text-ink-300">Ninguém viu pilotar ainda</span>}</OutlookRow>
        )}
        {(outlook.categoryId || child) && (
          <OutlookRow label="Corre">
            {outlook.categoryId ? (
              `${getCategory(outlook.categoryId).name}${outlook.teamName ? ` · ${outlook.teamName}` : ''}`
            ) : (
              <span className="text-ink-300">Não corre</span>
            )}
          </OutlookRow>
        )}
        {heir.canDrive && driver && racing && (
          <OutlookRow label="Piloto">
            Nota geral <b className="tabular-nums">{Math.floor(overallRating(driver.attributes))}</b>, potencial{' '}
            <b className="tabular-nums">{Math.floor(driver.potential)}</b>, reputação <b className="tabular-nums">{Math.floor(racing.reputation)}</b>
          </OutlookRow>
        )}
      </dl>

      <div className="space-y-2 border-t border-ink-700 pt-4">
        <h3 className="text-sm font-semibold text-ink-100">Caminho</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard
            selected={path === 'driver'}
            onSelect={() => setPath('driver')}
            disabled={!heir.canDrive}
            title="Nas pistas"
            description={heir.canDrive ? `${first} vira o seu piloto, na categoria em que já corre.` : 'Sem carreira de piloto em andamento.'}
          />
          <ChoiceCard
            selected={path === 'executive'}
            onSelect={() => setPath('executive')}
            disabled={!heir.canManage}
            title="Nos negócios"
            description={
              heir.canManage
                ? `${first} assume o patrimônio${owner ? ' e a equipe da família' : ''}, fora das pistas.`
                : `Só a partir dos ${FAMILY.ADULT_AGE} anos.`
            }
          />
        </div>
      </div>

      {path === 'driver' && seats.length > 0 && (
        <div className="space-y-2 border-t border-ink-700 pt-4">
          <h3 className="text-sm font-semibold text-ink-100">Vaga na primeira temporada</h3>
          <p className="text-xs leading-snug text-ink-300">
            Só quem herda pode usar o dinheiro da família numa equipe da frente: a vaga custa {percent(HEIR_START.TOP_SEAT_PREMIUM)} a mais que a tabela e é
            paga na hora, com a herança.
          </p>
          <div className="grid gap-2 xl:grid-cols-3">
            {seats.map((option) => (
              <SeatChoice key={option.id} option={option} selected={seat === option.id} onSelect={() => setSeat(option.id)} />
            ))}
          </div>
        </div>
      )}

      {path !== null && heir.kind === 'child' && siblings.length > 0 && (
        <p className="border-t border-ink-700 pt-4 text-xs leading-snug text-ink-300">
          {joinList(siblings)} {pluralWord(siblings.length, 'segue', 'seguem')} caminho próprio ({relativePaths()}) e{' '}
          {pluralWord(siblings.length, 'continua', 'continuam')} na árvore da família. Quem vai para a engenharia ou para a direção esportiva pode ser
          contratado pela equipe da família; quem vai para os negócios pode patrocinar quem corre.
        </p>
      )}
      {path !== null && heir.kind !== 'child' && siblings.length > 0 && (
        <p className="border-t border-ink-700 pt-4 text-xs leading-snug text-ink-300">
          {joinList(siblings)} {pluralWord(siblings.length, 'continua', 'continuam')} na família, com {first}.
        </p>
      )}

      {path === null && <p className="text-xs text-gold-400">Ainda não pode assumir. Escolha um tutor (cônjuge ou parente) para cuidar de tudo até lá.</p>}

      {path !== null && (
        <ScreenAction
          onClick={() => (path === 'driver' ? resolve(heir.id, 'driver', chosenSeat ? seat : 'current') : resolve(heir.id, 'executive'))}
          title={path === 'driver' ? (chosenSeat?.teamName ? `${heir.name} · ${chosenSeat.teamName}` : heir.name) : `${heir.name} assume os negócios`}
          className="w-full"
        >
          {path === 'driver' ? 'Continuar nas pistas' : 'Assumir os negócios'}
        </ScreenAction>
      )}
    </Card>
  );
}

/** Uma opção de vaga do herdeiro piloto: equipe, força, custo e, quando não dá, o motivo. */
function SeatChoice({ option, selected, onSelect }: { option: HeirSeatOption; selected: boolean; onSelect: () => void }) {
  const team = option.teamName !== null && option.rank !== null ? `${option.teamName} · ${option.rank + 1}ª força do grid` : null;
  const cost =
    option.seatCost === null
      ? null
      : option.id === 'top'
        ? `Vaga de ${formatMoney(option.seatCost)}, paga na hora`
        : option.seatCost > 0
          ? `Vaga de ${formatMoney(option.seatCost)} na temporada`
          : FAMILY_TEAM.SEAT_SHARE === 0 && option.id === 'family'
            ? 'A família banca a vaga'
            : 'Sem custo de vaga';
  return (
    <ChoiceCard
      selected={selected && option.available}
      onSelect={onSelect}
      disabled={!option.available}
      title={SEAT_TITLES[option.id]}
      description={option.available ? (team ?? '') : (option.reason ?? '')}
      meta={
        option.available ? (
          <span className="flex flex-col gap-1">
            {cost && <span className="tabular-nums">{cost}</span>}
            {option.id === 'family' && (
              <span className="flex items-start gap-1 text-gold-400">
                <TriangleAlert size={12} aria-hidden className="mt-1 shrink-0" />
                Favorecimento: a imprensa vai cobrar, e ficar atrás do companheiro custa moral e reputação.
              </span>
            )}
          </span>
        ) : team ? (
          <span>{team}</span>
        ) : undefined
      }
    />
  );
}

export function SuccessionScreen() {
  const career = useCareer();
  const cancel = useGameStore((s) => s.cancelHandover);
  const succession = career.succession;
  const heirs = succession?.heirs ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!succession) return null;
  const selected = heirs.find((h) => h.id === selectedId) ?? heirs.find((h) => h.canDrive || h.canManage) ?? heirs[0];
  const handover = succession.cause === 'handover';
  const owner = career.management?.position === 'owner';
  const children = career.family.children;
  const siblings = selected ? children.filter((c) => c.id !== selected.childId).map((c) => c.firstName) : [];

  return (
    <div>
      <PageHeader
        eyebrow={`${SUCCESSION_CAUSE_LABELS[succession.cause]} · ${succession.year}`}
        title={handover ? 'Quem assume a família?' : `Adeus, ${succession.formerName}`}
      >
        {handover && (
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
        )}
      </PageHeader>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <Card tone="attention" bodyClassName="p-4">
            <p className="text-sm leading-snug text-ink-300">
              {handover
                ? `${succession.formerName} decidiu passar o comando. `
                : succession.cause === 'accident'
                  ? `${succession.formerName} não resistiu a um acidente em corrida. `
                  : `${succession.formerName} morreu. `}
              A história da família {career.dynasty.surname} continua. Escolha quem assume e por qual caminho: <b className="text-ink-100">nas pistas</b>, a
              pessoa escolhida vira o seu piloto; <b className="text-ink-100">nos negócios</b>, assume o patrimônio{owner ? ' e a equipe da família' : ''}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-700 pt-4">
              <Stat label="Patrimônio" value={formatMoney(succession.estate)} hint={owner ? 'Inclui a equipe' : undefined} />
              <Stat
                label={handover ? 'Imposto sobre a doação' : 'Imposto de herança'}
                value={formatMoney(succession.tax)}
                hint={`${percent(handover ? ASSET_RULES.HANDOVER_TAX : ASSET_RULES.INHERITANCE_TAX)} acima de ${formatMoney(ASSET_RULES.INHERITANCE_EXEMPT)}`}
              />
              <Stat
                label="Geração"
                value={
                  <span className="inline-flex items-center gap-1">
                    {career.dynasty.generation}ª
                    <ArrowRight size={18} strokeWidth={2.5} className="text-ink-400" aria-label="para" />
                    {career.dynasty.generation + 1}ª
                  </span>
                }
              />
              <Stat
                label="Parte dos irmãos"
                value={`${percent(ASSET_RULES.SIBLING_SHARE)} cada`}
                hint="Quando quem assume é um dos filhos (até três recebem)"
              />
            </div>
          </Card>

          <Card title="Quem pode assumir" padded={false}>
            <ul className="divide-y divide-ink-800">
              {heirs.map((heir) => (
                <li key={heir.id}>
                  <button
                    type="button"
                    aria-pressed={heir.id === selected?.id}
                    onClick={() => setSelectedId(heir.id)}
                    className={cx(
                      'flex min-h-12 w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors focus-visible:outline-offset-[-2px]',
                      heir.id === selected?.id ? 'bg-ink-800 shadow-[inset_3px_0_0_0_var(--color-apex-500)]' : 'hover:bg-ink-800',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-100">{heir.name}</span>
                      <span className="block text-xs text-ink-400">
                        {heir.age} anos · {KIND_LABELS[heir.kind]}
                      </span>
                    </span>
                    {abilityChip(heir)}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {selected && <HeirDetail key={selected.id} heir={selected} owner={owner} siblings={siblings} />}
      </div>
    </div>
  );
}
