/**
 * Catálogo do sistema de design: os tokens e os componentes base numa tela só, para conferir o
 * visual de uma vez. Só existe no servidor de desenvolvimento (`npm run dev`, `#/dev/catalogo`):
 * a rota não é registrada no build de produção e este arquivo não entra no pacote.
 *
 * Com `VITE_FEATURE_FLAGS=sairaTitles npm run dev`, os títulos aparecem em Saira Condensed.
 */
import { ArrowLeft, Flag, Play, Trash2, Trophy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isFeatureEnabled } from '@/config/featureFlags';
import { TYRE_COMPOUNDS } from '@/domain/schemas';
import {
  Button,
  Card,
  Check,
  Chip,
  ChoiceCard,
  Delta,
  EmptyState,
  Gauge,
  LowerThird,
  Meter,
  NumberPlate,
  PageHeader,
  PositionBadge,
  ProgressBar,
  ResultChips,
  Ring,
  Segmented,
  Slider,
  Sparkline,
  Stat,
  Switch,
  Tabs,
  Tower,
  TyreBadge,
  advanceButtonClass,
  td,
  th,
  type TowerRow,
} from '@/ui/kit';
import { formatInterval, formatMoneyAs } from '../format';

const INK = ['950', '900', '850', '800', '700', '600', '500', '400', '300', '200', '100'] as const;
const INK_ROLE: Record<(typeof INK)[number], string> = {
  '950': 'fundo',
  '900': 'chapa',
  '850': 'chapa realçada',
  '800': 'chapa alta',
  '700': 'linha',
  '600': 'linha forte',
  '500': 'contorno',
  '400': 'texto apagado',
  '300': 'texto secundário',
  '200': 'texto de apoio',
  '100': 'texto principal',
};
const SIGNAL = [
  ['apex-500', 'ação principal'],
  ['apex-400', 'vermelho em texto'],
  ['apex-600', 'pressionado'],
  ['go-400', 'bom'],
  ['gold-400', 'atenção'],
  ['rain-400', 'pista molhada'],
] as const;
const TYPE = [
  ['text-2xs', '11 px', 'Rótulo mínimo'],
  ['text-xs', '12 px', 'Legenda e tabela densa'],
  ['text-sm', '14 px', 'Texto corrido'],
  ['text-base', '16 px', 'Texto de destaque'],
  ['text-lg', '18 px', 'Subtítulo'],
  ['text-xl', '20 px', 'Número médio'],
  ['text-2xl', '24 px', 'Número grande'],
  ['text-title', '28 px', 'Título de tela'],
] as const;
const SPACE = [
  ['1', '4 px', 'meio passo'],
  ['2', '8 px', ''],
  ['4', '16 px', ''],
  ['6', '24 px', ''],
  ['8', '32 px', ''],
  ['12', '48 px', ''],
] as const;

function Swatch({ token, role }: { token: string; role: string }) {
  return (
    <div className="min-w-0">
      <div className="h-10 shadow-frame" style={{ background: `var(--color-${token})` }} />
      <div className="mt-1 truncate text-xs font-semibold text-ink-100">{token}</div>
      <div className="truncate text-2xs text-ink-400">{role}</div>
    </div>
  );
}

function Section({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <Card title={title} className={wide ? 'md:col-span-2' : undefined} bodyClassName="space-y-4 p-4">
      {children}
    </Card>
  );
}

const TOWER: TowerRow[] = [
  { id: 'a', position: 1, color: '#4f8df7', name: 'ALV', team: 'Azure Motorsport', value: 'Líder', tyre: <TyreBadge compound="medium" /> },
  {
    id: 'b',
    position: 2,
    color: '#f2b33d',
    name: 'ROC',
    team: 'Castilla Racing',
    value: formatInterval(1.204),
    tyre: <TyreBadge compound="soft" />,
    battle: true,
    marks: <Delta value={2} signless className="text-2xs" />,
  },
  {
    id: 'c',
    position: 3,
    color: '#d93826',
    name: 'VOC',
    team: 'Sua equipe',
    value: formatInterval(1.538),
    tyre: <TyreBadge compound="hard" />,
    mine: true,
    battle: true,
  },
  {
    id: 'd',
    position: 4,
    color: '#3ecf8e',
    name: 'MEN',
    team: 'Stallion Autosport',
    value: 'BOX',
    tyre: <TyreBadge compound="intermediate" />,
    marks: <Delta value={-1} signless className="text-2xs" />,
  },
  { id: 'e', position: '–', color: '#9aa3b2', name: 'SIL', team: 'Vortex Racing', value: 'Quebra', tyre: <TyreBadge compound="wet" />, out: true },
];

export default function CatalogScreen() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [choice, setChoice] = useState(0);
  const [on, setOn] = useState(true);
  const [size, setSize] = useState<'p' | 'm' | 'g'>('m');
  const [volume, setVolume] = useState(60);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1500px] pb-[calc(1.5rem+var(--safe-bottom))] pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))] pt-[calc(1rem+var(--safe-top))]">
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-2 pr-4 text-sm font-semibold text-ink-200 hover:text-ink-100">
        <ArrowLeft size={18} aria-hidden />
        Menu principal
      </Link>
      <PageHeader
        title="Catálogo"
        eyebrow={`Sistema de design "muro dos boxes" · títulos em ${isFeatureEnabled('sairaTitles') ? 'Saira Condensed (comparativo)' : 'Barlow Condensed (padrão)'}`}
      />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Section title="Cores" wide>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {INK.map((step) => (
              <Swatch key={step} token={`ink-${step}`} role={INK_ROLE[step]} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SIGNAL.map(([token, role]) => (
              <Swatch key={token} token={token} role={role} />
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <div>
            <div className="font-display text-4xl font-bold uppercase leading-none tracking-wide">Grande Prêmio 2031</div>
            <div className="mt-1 text-xs text-ink-400">Título (fonte condensada): títulos, nomes e números grandes, a partir de 16 px.</div>
          </div>
          <ul className="space-y-1">
            {TYPE.map(([cls, px, use]) => (
              <li key={cls} className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 text-2xs text-ink-400">{px}</span>
                <span className={cls}>{use} 0123456789</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-400">Texto em Inter. Números com largura fixa: 1:23.456 · +0.234 · R$ 1.250.000</p>
        </Section>

        <Section title="Espaçamento, cantos e sombras">
          <ul className="space-y-1">
            {SPACE.map(([step, px, note]) => (
              <li key={step} className="flex items-center gap-4 text-xs">
                <span className="w-24 shrink-0 text-ink-300">
                  passo {step} · {px}
                </span>
                <span className="h-2 bg-apex-400" style={{ width: `calc(var(--spacing) * ${step})` }} />
                <span className="text-ink-400">{note}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <div
                key={s}
                className="chamfer grid h-14 w-24 place-items-center bg-ink-700 text-xs text-ink-100"
                style={{ ['--chamfer' as string]: `var(--chamfer-${s})` }}
              >
                chanfro {s}
              </div>
            ))}
            <div className="grid h-14 w-24 place-items-center bg-ink-800 text-xs text-ink-100 shadow-ring">contorno</div>
            <div className="grid h-14 w-24 place-items-center bg-ink-800 text-xs text-ink-100 shadow-pop">flutuante</div>
            <div className="overlay grid h-14 w-24 place-items-center text-xs text-ink-100">camada</div>
          </div>
        </Section>

        <Section title="Botões">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">
              <Play size={16} aria-hidden />
              Primário
            </Button>
            <Button>Secundário</Button>
            <Button variant="danger">
              <Trash2 size={16} aria-hidden />
              Perigo
            </Button>
            <Button variant="ghost">Discreto</Button>
            <Button disabled>Desativado</Button>
            <Button variant="primary" disabled>
              Primário desativado
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={advanceButtonClass('accent')}>
              Ir para a largada
            </button>
            <button type="button" className={advanceButtonClass('attention')}>
              Resolver decisão
            </button>
            <button type="button" disabled className={advanceButtonClass('accent')}>
              Avançar (desativado)
            </button>
          </div>
        </Section>

        <Section title="Chips, variação e posição">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>Neutro</Chip>
            <Chip tone="good">Na meta</Chip>
            <Chip tone="attention">Lesionado</Chip>
            <Chip tone="accent" icon={<Flag size={12} aria-hidden />}>
              Você
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Delta value={2} signless suffix=" posições" />
            <Delta value={-1} signless suffix=" posição" />
            <Delta value={3.4} />
            <Delta value={-4000} format={(v) => formatMoneyAs(v, 'BRL')} />
            <Delta value={0} showZero />
            <Delta value={-0.234} goodWhen="down" format={(v) => v.toFixed(3)} suffix=" s" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PositionBadge position={1} />
            <PositionBadge position={7} />
            <PositionBadge position={14} />
            <PositionBadge position={20} dnf />
            <ResultChips
              results={[
                { round: 1, position: 2, dnf: false },
                { round: 2, position: 9, dnf: false },
                { round: 3, position: 15, dnf: true },
                { round: 4, position: null, dnf: false },
              ]}
            />
            <NumberPlate number={27} color="#d93826" />
          </div>
        </Section>

        <Section title="Pneus">
          <div className="flex flex-wrap items-center gap-4">
            {TYRE_COMPOUNDS.map((compound) => (
              <TyreBadge key={compound} compound={compound} size="md" withLabel />
            ))}
          </div>
          <p className="text-xs text-ink-400">Cada composto tem a cor do anel e uma letra só dele.</p>
        </Section>

        <Section title="Barras e medidores">
          <ProgressBar value={62} label="Progresso: 62 de 100" />
          <ProgressBar value={74} previous={68} label="Atributo: 74, eram 68" />
          <Meter label="Moral" value={82} />
          <Meter label="Condição física" value={34} hint="Abaixo de 40 pede atenção." />
          <Gauge label="Motor" value={71} />
          <div className="flex items-center gap-4">
            <Ring value="68" label="Geral" fraction={0.68} tone="accent" />
            <Ring value="3º" label="Camp." fraction={0.85} tone="good" />
            <Stat label="Caixa" value={formatMoneyAs(1_250_000, 'BRL', { compact: true })} hint={formatMoneyAs(1_250_000, 'BRL', { compact: false })} />
          </div>
        </Section>

        <Section title="Gráficos pequenos">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkline values={[52, 55, 59, 61, 66, 68]} label="Geral por temporada: de 52 a 68 em 6 temporadas" tone="good" />
              <span className="text-sm">
                68 <Delta value={16} className="text-xs" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkline values={[35, 44, 20, -12, 8, 31]} label="Caixa por temporada: de R$ 35 mil a R$ 31 mil em 6 temporadas" tone="attention" zeroLine />
              <span className="text-sm">R$ 31 mil</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkline values={[40]} label="Ainda sem histórico" />
              <span className="text-xs text-ink-400">sem histórico</span>
            </div>
          </div>
        </Section>

        <Section title="Torre de classificação">
          <div className="max-w-xs bg-ink-900 shadow-frame">
            <Tower label="Exemplo de torre" rows={TOWER} />
          </div>
          <p className="text-xs text-ink-400">Faixa vermelha e nome em vermelho: o jogador. Moldura clara: os dois pilotos da disputa em foco.</p>
        </Section>

        <Section title="Tabela">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Pos.</th>
                <th className={th}>Piloto</th>
                <th className={`${th} text-right`}>Pontos</th>
                <th className={`${th} text-right`}>Dif.</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1', 'A. Alves', '186', '–'],
                ['2', 'M. Rocha', '171', '−15'],
                ['3', 'Você', '164', '−22'],
              ].map(([pos, name, points, gap]) => (
                <tr key={pos} className="border-t border-ink-700">
                  <td className={td}>{pos}</td>
                  <td className={td}>{name}</td>
                  <td className={`${td} text-right`}>{points}</td>
                  <td className={`${td} text-right`}>{gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Abas, escolhas e controles">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'a', label: 'Resumo' },
              { value: 'b', label: 'Contrato' },
              { value: 'c', label: 'Pilotos' },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard selected={choice === 0} onSelect={() => setChoice(0)} title="Conservador" description="Poupa pneus e combustível." meta="Risco baixo" />
            <ChoiceCard selected={choice === 1} onSelect={() => setChoice(1)} title="Agressivo" description="Ataca desde a largada." meta="Risco alto" />
          </div>
          <Segmented
            label="Tamanho"
            value={size}
            onChange={setSize}
            options={[
              { value: 'p', label: 'Pequeno' },
              { value: 'm', label: 'Padrão' },
              { value: 'g', label: 'Grande' },
            ]}
          />
          <Switch label="Interruptor" hint="O estado aparece na posição, no visto e no texto." checked={on} onChange={setOn} />
          <Switch label="Interruptor desativado" checked={false} onChange={() => {}} disabled />
          <Slider label="Volume" value={volume} onChange={setVolume} />
        </Section>

        <Section title="Requisitos e estado vazio">
          <ul className="space-y-1">
            <Check met>Licença nacional (você tem)</Check>
            <Check met={false}>Reputação 40 (você tem 31)</Check>
          </ul>
          <EmptyState title="Nenhuma proposta">As propostas chegam no fim da temporada.</EmptyState>
        </Section>

        <Section title="Tarja inferior (transmissão)" wide>
          <div data-overlay-ok className="relative h-40 overflow-hidden bg-[#13231b] shadow-frame">
            <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(110deg,#1b3326_0_40px,#16291f_40px_80px)]" />
            <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
              <LowerThird
                tone="accent"
                kicker="Volta 12 de 22 · disputa pela 3ª posição"
                title="Você × M. Rocha"
                detail="Diferença de +0.412 e caindo"
                icon={<Trophy size={20} aria-hidden className="shrink-0 text-gold-400" />}
              />
              <LowerThird tone="attention" kicker="Direção de prova" title="Safety car" />
            </div>
          </div>
          <p className="text-xs text-ink-400">
            Fundo translúcido e sombra, para a pista continuar aparecendo. O lugar da tarja na tela de corrida já existe; os lances decisivos que a preenchem
            são da Fase 4.
          </p>
        </Section>
      </div>
    </main>
  );
}
