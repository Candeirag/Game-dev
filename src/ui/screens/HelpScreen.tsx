/** Ajuda: tutorial em passos e um resumo de como o jogo funciona, um assunto por vez. */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Check, CircleUser, Flag, Heart, ListChecks, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { RACE_MOMENTS } from '@/config/balance';
import { CATEGORY_NAMES, FIRST_CATEGORY_ID, FIRST_FORMULA_CATEGORY_ID, TOP_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import { capitalize } from '@/domain/text';
import { tutorialSteps } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, cx, PageHeader } from '@/ui/kit';
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
          <li key={step.id} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={cx(
                'mt-1 grid h-5 w-5 shrink-0 place-items-center text-xs font-bold leading-none',
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
      'O nascimento é sorteado: cidade, profissão dos pais e quanto a família pode ajudar (pouco e por poucos anos). Dá para sortear de novo três vezes antes de começar.',
      'Reflexo, físico, inteligência, frieza e carisma mexem nos atributos iniciais; o físico pesa nas provas longas e na chuva, a frieza nas disputas e na última volta, o carisma nos patrocinadores.',
      'Três talentos ou defeitos ficam ocultos ("?" na ficha do piloto) e já agem desde a primeira corrida. A pista revela cada um: o de chuva na primeira corrida molhada, o de toque no primeiro toque.',
      'Quem nasce no interior começa na equipe menor do regional e paga viagens a cada etapa até se mudar para São Paulo.',
    ],
  },
  {
    id: 'fim-de-semana',
    title: 'Fim de semana',
    icon: Flag,
    items: [
      'Treino livre: acerto, simulação de classificação ou ritmo de corrida. Classificação: segura, equilibrada ou ataque total.',
      `${capitalize(categoryRef(FIRST_FORMULA_CATEGORY_ID, 'de'))} em diante há estratégia de pneus, paradas, combustível, safety car e chuva que muda no meio da prova.`,
      'As decisões pendentes (eventos) precisam ser resolvidas antes de abrir o fim de semana.',
      'A corrida é mostrada na pista e anda sozinha: em 1×, uma prova inteira leva poucos minutos. Controle a transmissão com Pausar, 1× a 8× e +1 volta, e escolha entre a câmera geral e a que acompanha o seu carro. Tocar num piloto da classificação (ou num carro) o destaca.',
      `Lances decisivos: de ${RACE_MOMENTS.MIN_PER_RACE} a ${RACE_MOMENTS.MAX_PER_RACE} por corrida, e a largada é sempre um deles (os outros: ataque, defesa, chuva começando, parada e última volta). A corrida para, sem tempo limite, e a tarja mostra cada opção com a chance de dar certo, o tamanho do prejuízo se der errado (perde pouco, perde posição ou pode abandonar), o que se ganha e o que se perde. Toque numa opção e depois em Confirmar. O desfecho aparece na pista, e um toque numa disputa pode virar rivalidade.`,
      'Deixar com o piloto entrega o lance ao estilo dele (cauteloso, equilibrado ou agressivo), que sai dos atributos, da confiança e do ritmo escolhido; o painel Piloto da corrida mostra qual é.',
      'Pneus: o desgaste aparece em porcentagem e em palavra (novo, bom, gasto, no limite, acabado). Cada composto tem o seu penhasco, marcado na barra: passou dali, o pneu perde segundos por volta. A tela mostra o gráfico dos tempos de volta e a janela ideal de parada; no kart, que não troca pneus, a volta em que o pneu cai do penhasco.',
      'O engenheiro fala pelo rádio só quando importa: pneu no limite, janela de parada aberta, rival que parou, carro encostando, chuva chegando.',
      'Ritmo e pedido de parada valem para a volta seguinte à que o líder está fazendo; a tela mostra qual é. Reiniciar visualização só repete as imagens: o que já aconteceu não muda.',
      'Simular até o fim leva direto ao resultado: o piloto decide todos os lances pelo estilo dele e o engenheiro cuida das paradas e do combustível. O resultado lista cada lance da corrida e marca os que o piloto decidiu.',
      `Cada categoria tem o seu veículo, do ${CATEGORY_NAMES[FIRST_CATEGORY_ID].vehicleName.toLowerCase()} ao ${CATEGORY_NAMES[TOP_CATEGORY_ID].vehicleName}. As pistas seguem o traçado de circuitos reais, com nomes fictícios. Autódromos: geometria de bacinger/f1-circuits (licença MIT). Kartódromos: traçados © OpenStreetMap contributors (licença ODbL); só o Circuito do Oásis ainda tem traçado gerado pelo jogo.`,
    ],
  },
  {
    id: 'carreira',
    title: 'Carreira',
    icon: TrendingUp,
    items: [
      `Sete degraus, do kart regional ${categoryRef(TOP_CATEGORY_ID, 'a')}. Para subir: licença, reputação, experiência, idade, dinheiro e uma equipe interessada.`,
      'No fim do ano, as propostas ficam na tela Carreira. Dá para negociar salário, vaga, bônus, função e duração.',
      'Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.',
    ],
  },
  {
    id: 'dinheiro',
    title: 'Dinheiro',
    icon: Wallet,
    items: [
      'Correr custa caro e sobe muito a cada degrau: vaga, viagens, equipamento, treino e, fora do país, o aluguel do polo. A família ajuda pouco e por poucos anos.',
      'Patrocinadores vêm com resultados e em escada: comércio do bairro no kart regional, empresas regionais no Brasileiro, marcas grandes só com título. Quem não vê a meta cumprida rompe no fim do ano.',
      'Sempre existe uma porta: a tela Caminhos (no Painel) mostra quanto falta para a próxima vaga e como estão a academia, a vaquinha da cidade, o investidor (que fica com parte dos seus ganhos para sempre), o trabalho paralelo e a vaga de aluguel.',
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
    // A linha do título fica com a altura dele; a sobra do índice (que ocupa as duas linhas) vai para a de baixo.
    <div className="grid items-start gap-x-4 md:-mb-2 md:grid-cols-[11.5rem_minmax(0,1fr)] md:grid-rows-[auto_1fr]">
      <div className="md:col-start-2 md:row-start-1">
        <PageHeader eyebrow="Ajuda" title="Como jogar" />
      </div>
      <div
        role="tablist"
        aria-label="Assuntos da ajuda"
        className="flex overflow-x-auto bg-ink-900 shadow-frame md:sticky md:top-[calc(4rem+env(safe-area-inset-top))] md:col-start-1 md:row-span-2 md:row-start-1 md:flex-col md:overflow-visible"
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
                'flex min-h-11 shrink-0 items-center gap-2 px-3 text-left text-sm font-semibold transition-colors',
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
            <ul className="max-w-3xl list-disc space-y-2 pl-4 text-sm leading-snug text-ink-300">
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
