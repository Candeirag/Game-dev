/**
 * Catálogo do sistema de design: os tokens e os componentes base numa tela só, para conferir o
 * visual de uma vez. Só existe no servidor de desenvolvimento (`npm run dev`, `#/dev/catalogo`):
 * a rota não é registrada no build de produção e este arquivo não entra no pacote.

 */
import { ArrowLeft, CircleCheck, Flag, Headset, Play, Trash2, TriangleAlert, Trophy, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TYRE_COMPOUNDS } from '@/domain/schemas';
import {
  advanceButtonClass,
  Button,
  Card,
  ChanceOption,
  Check,
  Chip,
  ChoiceCard,
  DecisionBar,
  Delta,
  EmptyState,
  Gauge,
  LockedCard,
  LowerThird,
  Meter,
  NumberPlate,
  PageHeader,
  Portrait,
  PositionBadge,
  ProgressBar,
  ResultChips,
  RevealItem,
  Ring,
  SecretCard,
  Segmented,
  Slider,
  Sparkline,
  Stat,
  Switch,
  Tabs,
  td,
  th,
  Tower,
  type TowerRow,
  TyreBadge,
  TyreGauge,
  TyreLegend,
  TyreWearBar,
  useRevealSequence,
  WholeRows,
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

/** A revelação em sequência, com um botão para recomeçar. */
function RevealDemo() {
  const [round, setRound] = useState(0);
  const sequence = useRevealSequence(round);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-4">
        {['Reflexo 72', 'Físico 48', 'Frieza 61', 'Carisma 35'].map((text, i) => (
          <RevealItem key={text} index={i} sequence={sequence}>
            <div className="bg-ink-850 p-2 text-sm text-ink-100 shadow-frame">{text}</div>
          </RevealItem>
        ))}
      </div>
      <Button onClick={() => setRound((r) => r + 1)}>Revelar de novo</Button>
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
  const [option, setOption] = useState<string | null>('fora');
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1500px] pb-[calc(1.5rem+var(--safe-bottom))] pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))] pt-[calc(1rem+var(--safe-top))]">
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-2 pr-4 text-sm font-semibold text-ink-200 hover:text-ink-100">
        <ArrowLeft size={18} aria-hidden />
        Menu principal
      </Link>
      <PageHeader title="Catálogo" eyebrow='Sistema de design "muro dos boxes" · títulos em Barlow Condensed, texto em Inter' />
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

        <Section title="Retratos">
          <div className="flex flex-wrap items-end gap-4">
            <Portrait src={null} name="Ana Teste" color="#d93826" size="sm" />
            <Portrait src={null} name="Marcos Rocha" color="#f2b33d" />
            <Portrait src={null} name="Lia Alves" color="#4f8df7" size="lg" />
          </div>
          <p className="text-xs text-ink-400">Moldura padrão (4:5, chanfro e a cor da equipe na base). Sem imagem importada, aparecem as iniciais.</p>
        </Section>

        <Section title="Pneus">
          <div className="flex flex-wrap items-center gap-4">
            {TYRE_COMPOUNDS.map((compound) => (
              <TyreBadge key={compound} compound={compound} size="md" withLabel />
            ))}
          </div>
          <TyreLegend compounds={TYRE_COMPOUNDS} />
          <p className="text-xs text-ink-400">
            Cada composto tem a cor do anel e a letra das transmissões (S, M, H, I, W); o nome em português vai no texto de apoio e na legenda.
          </p>
        </Section>

        <Section title="Medidor de pneu">
          <TyreGauge compound="medium" wear={0.08} />
          <TyreGauge compound="medium" wear={0.52} />
          <TyreGauge
            compound="soft"
            wear={0.66}
            trailing={
              <Sparkline values={[83.1, 83.0, 83.2, 83.5, 84.1]} label="Tempo de volta nas últimas 5 voltas: de 1:23.100 a 1:24.100" width={40} height={14} />
            }
          />
          <TyreGauge compound="hard" wear={0.93} caption />
          <div className="flex items-center gap-4 text-xs text-ink-300">
            Só a barra, para listas:
            <TyreWearBar compound="medium" wear={0.2} className="w-8" />
            <TyreWearBar compound="medium" wear={0.6} className="w-8" />
            <TyreWearBar compound="medium" wear={0.9} className="w-8" />
          </div>
          <p className="text-xs text-ink-400">
            A barra enche conforme o pneu gasta; o risco claro é o penhasco do composto. O estado vem sempre em número e em palavra (novo, bom, gasto, no
            limite, acabado), com o triângulo perto do fim: a cor só acompanha. Os limites são os do motor, os mesmos do rádio do engenheiro.
          </p>
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
          {/* Com WholeRows, a torre mostra só linhas inteiras e assenta no começo de uma linha ao parar de rolar. */}
          <div className="flex h-[7.5rem] max-w-xs flex-col bg-ink-900 shadow-frame">
            <WholeRows>
              <Tower label="Exemplo de torre" rows={TOWER} />
              <TyreLegend compounds={['medium', 'soft', 'hard', 'intermediate', 'wet']} className="border-t border-ink-700 px-2 py-2" />
            </WholeRows>
          </div>
          <p className="text-xs text-ink-400">
            Faixa vermelha e nome em vermelho: o jogador. Moldura clara: os dois pilotos da disputa em foco. A lista (WholeRows) mostra só linhas inteiras: role
            para ver as outras.
          </p>
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

        <Section title="Revelação, segredos e opções bloqueadas" wide>
          <RevealDemo />
          <div className="grid gap-2 md:grid-cols-3">
            <SecretCard hidden hint="Talento ou defeito" />
            <SecretCard
              hidden={false}
              kind="talent"
              title="Gênio na chuva"
              description="Mais rápido e mais seguro com a pista molhada."
              meta="Temporada 1, etapa 4"
            />
            <SecretCard
              hidden={false}
              kind="defect"
              title="Esquentado"
              description="Ataca com vontade demais: mais toques nas disputas."
              meta="Temporada 2, etapa 1"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LockedCard title="Filho de ex-piloto" summary="O sobrenome abre portas no paddock.">
              <span className="text-xs text-ink-300">O que a opção daria, sem botão de compra.</span>
            </LockedCard>
          </div>
          <p className="text-xs text-ink-400">
            A revelação entra item por item (cada um em 300 ms, só o atraso cresce); com menos movimento, tudo aparece de uma vez. O segredo escondido mostra só
            o "?"; revelado, talento e defeito vêm com ícone e palavra, nunca só com a cor.
          </p>
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
          <div data-overlay-ok className="relative h-56 overflow-hidden bg-[#13231b] shadow-frame">
            <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(110deg,#1b3326_0_40px,#16291f_40px_80px)]" />
            <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-end gap-2">
              <LowerThird
                tone="good"
                kicker="Lance · Ataque"
                title="Deu certo"
                detail="No vácuo da reta, você passa M. Rocha antes da freada."
                icon={<CircleCheck size={20} aria-hidden className="shrink-0 text-go-400" />}
                wrap
              />
              <LowerThird
                tone="attention"
                kicker="Lance · Defesa"
                title="Deu errado"
                detail="Você fechou tarde: M. Rocha passou e ainda levou você para fora."
                icon={<TriangleAlert size={20} aria-hidden className="shrink-0 text-gold-400" />}
                wrap
              />
              <LowerThird
                kicker="Rádio · engenheiro"
                title="A janela de parada abriu: voltas 18 a 21."
                icon={<Headset size={18} aria-hidden className="shrink-0 text-ink-200" />}
                compact
              />
            </div>
          </div>
          <p className="text-xs text-ink-400">
            Fundo translúcido e sombra, para a pista continuar aparecendo. Na corrida, a tarja mostra o desfecho de cada lance decisivo (com `wrap`, a frase
            quebra em duas linhas) e o rádio do engenheiro (`compact`: uma frase em texto corrido). Verde com o visto quando dá certo; âmbar com o triângulo
            quando dá errado. Nada de vermelho para "ruim".
          </p>
        </Section>

        <Section title="Tarja de decisão (lance decisivo)" wide>
          <div data-overlay-ok className="relative overflow-hidden bg-[#13231b] pt-16 shadow-frame">
            <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(110deg,#1b3326_0_40px,#16291f_40px_80px)]" />
            <DecisionBar
              label="Lance decisivo: Largada (exemplo do catálogo)"
              kicker="Largada · volta 1"
              title="As luzes vão apagar. Como você larga?"
              className="relative"
              detail={
                option ? (
                  <span>
                    <b className="font-semibold text-ink-100">Se der certo:</b> ganha uma posição, sem risco de toque.{' '}
                    <b className="font-semibold text-ink-100">Se der errado:</b> abre demais e perde tempo.{' '}
                    <b className="font-semibold text-ink-100">Pesa na chance:</b> Piloto <Delta value={6} format={(v) => String(Math.round(v))} /> Pista{' '}
                    <Delta value={-4} format={(v) => String(Math.round(v))} />
                  </span>
                ) : (
                  <span className="text-ink-300">Toque numa opção para ver o que se ganha, o que se perde e o que pesa na chance.</span>
                )
              }
              actions={
                <>
                  <Button onClick={() => setOption(null)}>Deixar com o piloto</Button>
                  <Button variant="primary" disabled={!option}>
                    Confirmar
                  </Button>
                </>
              }
            >
              <div role="radiogroup" aria-label="Opções do lance (exemplo)" className="grid min-w-0 gap-2 md:grid-cols-3">
                <ChanceOption label="Arriscar por dentro" chance={0.31} risk={2} selected={option === 'dentro'} onSelect={() => setOption('dentro')} />
                <ChanceOption label="Ir por fora" chance={0.58} risk={1} selected={option === 'fora'} onSelect={() => setOption('fora')} />
                <ChanceOption
                  label="Segurar a posição"
                  chance={0.84}
                  risk={0}
                  selected={option === 'segurar'}
                  onSelect={() => setOption('segurar')}
                  badgeLabel="escolha do piloto"
                  seal={
                    <Chip size="sm" icon={<UserRound size={12} aria-hidden className="shrink-0" />} className="shadow-ring">
                      Piloto
                    </Chip>
                  }
                />
              </div>
            </DecisionBar>
          </div>
          <p className="text-xs text-ink-400">
            A pergunta que para a corrida, sem tempo limite: rótulo, pergunta, opções, o detalhe da opção escolhida e as ações (a principal embaixo, à direita).
            Cada opção mostra a chance em número e em barra e o risco em palavra, com ícone: seguro é verde, moderado é neutro e arriscado é âmbar. Tocar
            seleciona; "Confirmar" envia. O selo marca a opção que o piloto escolheria.
          </p>
        </Section>
      </div>
    </main>
  );
}
