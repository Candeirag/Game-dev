/** Ajuda: tutorial em passos e um resumo de como o jogo funciona, um assunto por vez. */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Check, CircleUser, Flag, Heart, ListChecks, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { tutorialSteps } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, PageHeader, cx } from '../components/ui';
import { useCareer } from '../hooks/useCareer';

/**
 * Lista de primeiros passos. No painel (`compact`) aparece até ser concluída ou dispensada, com
 * o texto só do próximo passo; na ajuda mostra todos os textos, em duas colunas no tablet e no computador.
 */
export function TutorialCard({ compact = true }: { compact?: boolean }) {
  const career = useCareer();
  const navigate = useNavigate();
  const dismiss = useGameStore((s) => s.dismissTutorial);
  const steps = tutorialSteps(career);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <Card
      title={`Primeiros passos · ${done} de ${steps.length}`}
      action={
        compact && !career.tutorial.dismissed ? (
          <button type="button" onClick={dismiss} className="-mr-2 min-h-11 px-2 text-xs font-semibold text-ink-400 transition-colors hover:text-ink-100">
            Dispensar
          </button>
        ) : undefined
      }
      bodyClassName={compact ? undefined : 'p-3'}
    >
      <ol className={cx('grid gap-y-2', !compact && 'gap-x-6 lg:grid-cols-2')}>
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-2.5 text-sm">
            <span
              aria-hidden
              className={cx(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center font-display text-sm font-bold leading-none',
                step.done ? 'bg-go-400/20 text-go-400' : step === next ? 'bg-apex-500 text-white' : 'bg-ink-800 text-ink-400',
              )}
            >
              {step.done ? <Check size={12} strokeWidth={3} /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx('font-semibold', step.done ? 'text-ink-400 line-through' : 'text-ink-100')}>{step.title}</div>
              {(!compact || step === next) && <div className={cx('leading-snug', step.done ? 'text-ink-400' : 'text-ink-300')}>{step.text}</div>}
            </div>
            {step === next && (
              <Button className="min-w-11 shrink-0" onClick={() => navigate(step.route)}>
                Ir
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const TOPICS: { id: string; title: string; icon: LucideIcon; items: string[] }[] = [
  {
    id: 'piloto',
    title: 'Piloto',
    icon: CircleUser,
    items: [
      'Nove atributos de 0 a 100. O treino (foco e intensidade) rende a cada etapa, até o limite do potencial.',
      'Fase, confiança e moral mudam com os resultados e com a vida fora das pistas, e mexem no ritmo, nos erros e no aproveitamento do treino.',
      'A partir dos 31 anos, velocidade e reflexos caem um pouco a cada ano.',
    ],
  },
  {
    id: 'fim-de-semana',
    title: 'Fim de semana',
    icon: Flag,
    items: [
      'Treino livre: acerto, simulação de classificação ou ritmo de corrida. Classificação: segura, equilibrada ou ataque total.',
      'Da Fórmula 4 em diante há estratégia de pneus, paradas, combustível, safety car e chuva que muda no meio da prova.',
      'As decisões pendentes (eventos) precisam ser resolvidas antes de abrir o fim de semana.',
      'A corrida é mostrada na pista: toque em Largar, controle a transmissão com Pausar, 1× a 8× e +1 volta, e escolha entre a câmera geral e a que acompanha o seu carro. Tocar num piloto da classificação (ou num carro) o destaca.',
      'Ritmo e pedido de parada valem para a volta seguinte à que o líder está fazendo; a tela mostra qual é. Reiniciar visualização só repete as imagens: o que já aconteceu não muda.',
      'Cada categoria tem o seu veículo, do kart 4 tempos ao Fórmula 1. As pistas seguem o traçado de circuitos reais, com nomes fictícios. Autódromos: geometria de bacinger/f1-circuits (licença MIT). Kartódromos: traçados © OpenStreetMap contributors (licença ODbL); só o Circuito do Oásis ainda tem traçado gerado pelo jogo.',
    ],
  },
  {
    id: 'carreira',
    title: 'Carreira',
    icon: TrendingUp,
    items: [
      'Sete degraus, do kart regional à Fórmula 1. Para subir: licença, reputação, experiência, idade, dinheiro e uma equipe interessada.',
      'No fim do ano, as propostas ficam na tela Carreira. Dá para negociar salário, vaga, bônus, função e duração.',
      'Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.',
    ],
  },
  {
    id: 'dinheiro',
    title: 'Dinheiro',
    icon: Wallet,
    items: [
      'A vaga custa caro nas categorias de base; a família ajuda só nos cinco primeiros anos. Patrocinadores vêm com resultados.',
      'Patrimônio: renda fixa, fundo, ações (preço muda a cada etapa), imóveis, empresas e participações em equipes.',
      'Empréstimo bancário custa 9% ao ano; caixa negativo custa 14%. Imposto de renda progressivo no fim do ano.',
    ],
  },
  {
    id: 'familia',
    title: 'Família e dinastia',
    icon: Heart,
    items: [
      'A partir dos 21 anos você pode conhecer alguém, casar e ter filhos. As decisões aparecem no começo de cada temporada.',
      'Os filhos herdam parte do seu talento. Dos 8 aos 13 anos vem a formação no kart; aos 14, a carreira própria, que você pode bancar.',
      'Quando o personagem morre ou passa o comando, um herdeiro assume: nas pistas ou nos negócios. O save nunca acaba.',
    ],
  },
  {
    id: 'depois',
    title: 'Depois das pistas',
    icon: Briefcase,
    items: [
      'Ao se aposentar, você pode investir, aceitar o comando de uma equipe, comprar uma ou fundar a sua.',
      'Como dirigente, você decide pilotos, equipe técnica, instalações, patrocinadores e a pesquisa do carro, dentro do regulamento de cada categoria.',
      'O chefe contratado vive de salário e pode ser demitido; o dono fica com o lucro, cobre o prejuízo e deixa a equipe aos herdeiros.',
    ],
  },
];

/** O índice: os primeiros passos e, depois, um assunto por entrada. */
const TUTORIAL = { id: 'passos', title: 'Primeiros passos', icon: ListChecks };
const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [TUTORIAL, ...TOPICS];

export function HelpScreen() {
  // O assunto aberto fica no endereço (?tab=...), como as abas das outras telas.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const topic = TOPICS.find((t) => t.id === requested);
  const current = topic?.id ?? TUTORIAL.id;
  const open = (id: string) => setParams(id === TUTORIAL.id ? {} : { tab: id }, { replace: true });

  return (
    // Deitado: índice à esquerda (sempre à vista) e o assunto ao lado. Em pé: o índice vira uma faixa que rola de lado.
    <div className="grid items-start gap-x-4 md:-mb-2 md:grid-cols-[11.5rem_minmax(0,1fr)]">
      <div className="md:col-start-2 md:row-start-1">
        <PageHeader eyebrow="Ajuda" title="Como jogar" />
      </div>
      <div
        role="tablist"
        aria-label="Assuntos da ajuda"
        className="flex overflow-x-auto bg-ink-900 shadow-[inset_0_0_0_1px_var(--color-ink-700)] md:sticky md:top-[calc(4rem+env(safe-area-inset-top))] md:col-start-1 md:row-span-2 md:row-start-1 md:flex-col md:overflow-visible"
      >
        {SECTIONS.map((section) => {
          const selected = section.id === current;
          return (
            <button
              key={section.id}
              role="tab"
              type="button"
              id={`help-tab-${section.id}`}
              aria-selected={selected}
              aria-controls="help-panel"
              onClick={() => open(section.id)}
              className={cx(
                'flex min-h-11 shrink-0 items-center gap-2.5 px-3 text-left text-sm font-semibold transition-colors',
                selected
                  ? 'bg-ink-700 text-ink-100 shadow-[inset_0_-3px_0_0_var(--color-apex-500)] md:shadow-[inset_3px_0_0_0_var(--color-apex-500)]'
                  : 'text-ink-400 hover:text-ink-100',
              )}
            >
              <section.icon size={16} aria-hidden className="shrink-0" />
              {section.title}
            </button>
          );
        })}
      </div>
      <div id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${current}`} className="mt-3 min-w-0 md:col-start-2 md:row-start-2 md:mt-0">
        {topic ? (
          <Card title={topic.title}>
            <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-snug text-ink-300">
              {topic.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ) : (
          <TutorialCard compact={false} />
        )}
      </div>
    </div>
  );
}
