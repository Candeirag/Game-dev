/**
 * "O que mudou": a lista de efeitos mostrada depois de uma escolha (Fase 5). Cada linha tem um
 * ícone, o rótulo em texto e, quando há número, a variação (`Delta`: seta, sinal e o texto para o
 * leitor de tela). As linhas sem número (quem vai se lembrar, quem passa a acompanhar a carreira,
 * a história que continua) dizem tudo em palavras. Nada é dito só pela cor.
 *
 * O valor de cada linha é o que de fato mudou na carreira (`describeEffects`, do motor): esta
 * lista só escreve, não calcula nada do jogo.
 */
import {
  Activity,
  Bandage,
  BookOpen,
  Brain,
  Building2,
  Dumbbell,
  FileSignature,
  Flag,
  Footprints,
  Gavel,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  LogOut,
  type LucideIcon,
  Receipt,
  ShieldCheck,
  Smile,
  Star,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { ATTRIBUTE_LABELS } from '@/domain/labels';
import { counted, pluralWord } from '@/domain/text';
import type { StoryEffectView } from '@/engine';
import { formatMoney } from '../format';
import { cx } from './cx';
import { Delta } from './Delta';

type StatKind = Extract<StoryEffectView, { kind: 'stat' }>['stat'];

const STAT: Record<StatKind, { label: string; icon: LucideIcon }> = {
  morale: { label: 'Moral', icon: Smile },
  confidence: { label: 'Confiança', icon: ShieldCheck },
  form: { label: 'Fase', icon: Activity },
  reputation: { label: 'Reputação', icon: Star },
  teamTrust: { label: 'Confiança da equipe', icon: Users },
  teammateRelation: { label: 'Relação com o companheiro', icon: UserRound },
};

const money = (value: number) => <Delta value={value} format={(v) => formatMoney(v)} />;
const whole = (v: number) => Math.round(v).toLocaleString('pt-BR');

function attributeLabel(key: string): string {
  return Object.entries(ATTRIBUTE_LABELS).find(([attribute]) => attribute === key)?.[1] ?? key;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sponsorTarget(position: number): string {
  return position <= 1 ? 'meta: 1º lugar' : `meta: entre os ${position} primeiros`;
}

export interface EffectRowProps {
  icon: LucideIcon;
  /** O que mudou, em palavras ("Moral", "Rivalidade com A. Souza", "A história continua"). */
  label: ReactNode;
  /** Linha de apoio, menor (o valor do patrocínio e a meta, as etapas da lesão). */
  detail?: ReactNode;
  /** A variação, com o `Delta` do kit. Sem número, a linha fica só com o texto. */
  delta?: ReactNode;
}

/** As peças de uma linha para cada tipo de efeito. */
export function effectRowProps(effect: StoryEffectView): EffectRowProps {
  switch (effect.kind) {
    case 'stat':
      return { icon: STAT[effect.stat].icon, label: STAT[effect.stat].label, delta: <Delta value={effect.value} /> };
    case 'cash':
      return { icon: Wallet, label: 'Caixa', delta: money(effect.value) };
    case 'rivalry':
      // Rivalidade maior não é boa nem ruim: a seta diz o sentido, sem cor de juízo.
      return { icon: Swords, label: `Rivalidade com ${effect.name}`, delta: <Delta value={effect.value} goodWhen="none" /> };
    case 'sponsorMood':
      return {
        icon: Handshake,
        label: effect.name ? `Satisfação do patrocinador ${effect.name}` : 'Satisfação dos patrocinadores',
        delta: <Delta value={effect.value} />,
      };
    case 'sponsorAdded':
      return {
        icon: FileSignature,
        label: `Novo patrocinador: ${effect.name}`,
        detail: `${formatMoney(effect.perSeason)} por temporada · ${sponsorTarget(effect.target)}`,
      };
    case 'sponsorRemoved':
      return { icon: LogOut, label: `${effect.name} deixa de patrocinar você` };
    case 'grid': {
      const places = Math.abs(effect.places);
      return {
        icon: Flag,
        label: effect.name ? `Punição no grid para ${effect.name}` : 'Punição no grid',
        // Perder posições é a seta para baixo; para outro piloto, sem juízo de valor.
        delta: (
          <Delta
            value={-effect.places}
            signless
            format={whole}
            suffix={` ${pluralWord(places, 'posição', 'posições')}`}
            goodWhen={effect.name ? 'none' : 'up'}
          />
        ),
      };
    }
    case 'penaltyPoints':
      return { icon: Gavel, label: 'Pontos de punição', delta: <Delta value={effect.value} format={whole} goodWhen="down" /> };
    case 'points':
      return { icon: Trophy, label: 'Pontos no campeonato', delta: <Delta value={effect.value} format={whole} /> };
    case 'interest':
      return { icon: Target, label: `Interesse da equipe ${effect.team}`, delta: <Delta value={effect.value} /> };
    case 'attribute':
      return { icon: Dumbbell, label: attributeLabel(effect.attribute), delta: <Delta value={effect.value} /> };
    case 'injury':
      return {
        icon: Bandage,
        label: `Lesão: ${effect.description}`,
        detail: `${effect.serious ? 'Fora' : 'Rendimento reduzido'} por ${counted(effect.rounds, 'etapa', 'etapas')}`,
      };
    case 'car':
      return { icon: Wrench, label: 'Rendimento do equipamento', delta: <Delta value={effect.value} /> };
    case 'seatCost':
      return { icon: Receipt, label: 'Custo anual da vaga', delta: <Delta value={effect.value} format={(v) => formatMoney(v)} goodWhen="down" /> };
    case 'releaseFee':
      return {
        icon: Receipt,
        label: 'Multa para sair do contrato',
        delta: <Delta value={(effect.factor - 1) * 100} format={whole} suffix="%" goodWhen="down" />,
      };
    case 'relationship':
      return { icon: Heart, label: 'Relacionamento', delta: <Delta value={effect.value} /> };
    case 'academy':
      return { icon: GraduationCap, label: `Você entrou na ${effect.name}` };
    case 'remember':
      return { icon: Brain, label: `${effect.name} vai se lembrar disso`, detail: capitalized(effect.role) };
    case 'attitude':
      return { icon: HeartHandshake, label: `Simpatia de ${effect.name} por você`, delta: <Delta value={effect.value} format={whole} /> };
    case 'follows':
      return { icon: Footprints, label: `${effect.name} vai acompanhar a sua carreira` };
    case 'joinsTeam':
      return { icon: Building2, label: `${effect.name} agora trabalha na equipe ${effect.team}` };
    case 'chain':
      return { icon: BookOpen, label: effect.ends ? 'Fim da história' : 'A história continua' };
    default: {
      const unknown: never = effect;
      return unknown;
    }
  }
}

/** Uma linha da lista: ícone, rótulo (e a linha de apoio) e, à direita, a variação. */
export function EffectRow({ icon: Icon, label, detail, delta }: EffectRowProps) {
  return (
    <li className="flex min-h-10 items-center gap-2 py-1">
      <Icon size={16} aria-hidden className="shrink-0 text-ink-300" />
      <span className="min-w-0 flex-1 text-sm leading-snug text-ink-100">
        {label}
        {detail && <span className="block text-xs text-ink-300">{detail}</span>}
      </span>
      {delta && <span className="shrink-0 text-sm">{delta}</span>}
    </li>
  );
}

export function EffectList({
  effects,
  title = 'O que mudou',
  empty = 'Nada mudou por enquanto.',
  className,
}: {
  effects: readonly StoryEffectView[];
  title?: string;
  /** O que dizer quando a escolha não mudou nada que apareça na lista. */
  empty?: string;
  className?: string;
}) {
  const titleId = useId();
  return (
    <div className={cx('min-w-0', className)}>
      <h4 id={titleId} className="text-2xs font-semibold uppercase tracking-wider text-ink-300">
        {title}
      </h4>
      {effects.length === 0 ? (
        <p className="mt-1 text-sm text-ink-300">{empty}</p>
      ) : (
        <ul aria-labelledby={titleId} className="mt-1 divide-y divide-ink-700">
          {effects.map((effect, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista de um desfecho é fixa (não muda de ordem nem cresce)
            <EffectRow key={`${effect.kind}-${index}`} {...effectRowProps(effect)} />
          ))}
        </ul>
      )}
    </div>
  );
}
