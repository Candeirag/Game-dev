/** Ajuda: tutorial em passos e um resumo de como o jogo funciona, um assunto por vez. */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Check, CircleUser, Flag, Heart, ListChecks, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { BAD_INVESTMENT, FAMILY_TEAM, HEIR_START, HERITAGE, RACE_MOMENTS, RELATIVES, SURNAME, TRANSITION } from '@/config/balance';
import { TRANSITION_ROLES } from '@/domain/schemas';
import { CATEGORY_NAMES, FIRST_CATEGORY_ID, FIRST_FORMULA_CATEGORY_ID, TOP_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import { capitalize, counted } from '@/domain/text';
import { ASSET_RULES } from '@/data/assets';
import { RELATIVE_PATH_INFO } from '@/data/dynasty';
import { FAMILY } from '@/data/family';
import { TRANSITION_ROLE_INFO } from '@/data/transition';
import { tutorialSteps } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, cx, PageHeader } from '@/ui/kit';
import { formatMoney } from '../format';
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
      bodyClassName={compact ? undefined : 'p-4'}
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

/** "40%": as frações das tabelas, em porcentagem. */
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** "a, b ou c". */
const orList = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} ou ${items[items.length - 1]}` : (items[0] ?? ''));

/** "Mentoria" → "mentoria"; "Comentários na TV" → "comentários na TV" (só a primeira letra). */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Os papéis do ano de transição ("mentoria, comentários na TV ou imagem de uma marca"). */
const transitionRoles = orList(TRANSITION_ROLES.map((role) => lowerFirst(TRANSITION_ROLE_INFO[role].label)));

/** O legado de cada papel ("Mentoria: quem foi acompanhado…"). */
const transitionLegacies = TRANSITION_ROLES.map((role) => `${TRANSITION_ROLE_INFO[role].label}: ${lowerFirst(TRANSITION_ROLE_INFO[role].legacy)}`).join(' ');

/** Os textos de família e dinastia (Fase 6). Os números saem todos das tabelas do jogo. */
function familyItems(): string[] {
  const reveals = HERITAGE.KART_TEST_REVEALS;
  const paths = orList(Object.values(RELATIVE_PATH_INFO).map((info) => info.label.toLowerCase()));
  return [
    `A partir dos ${FAMILY.PARTNER_MIN_AGE} anos você pode conhecer alguém, casar e ter até ${FAMILY.MAX_CHILDREN} filhos. As decisões do casal aparecem no começo de cada temporada, e um filho também pode chegar por um cartão da vida pessoal ao longo do ano.`,
    `Cada filho herda parte do seu talento e nasce com talentos e defeitos de nascença, como você: cada um dos seus passa para cada filho com ${percent(HERITAGE.INHERIT_CHANCE)} de chance, e o resto é sorteado. Eles já agem desde cedo, mas ficam ocultos ("?" na tela Família) até alguém ver a criança pilotar.`,
    `Dos ${FAMILY.KART_START_AGE} aos ${FAMILY.CAREER_START_AGE - 1} anos vem a formação no kart. Aos ${HERITAGE.KART_TEST_AGE}, o teste no kart: o completo revela ${counted(reveals.full, 'talento ou defeito', 'talentos ou defeitos')}, o rápido ${reveals.quick}, e os dois mostram a diferença para o tempo de referência dos instrutores, com três casas. Aos ${FAMILY.CAREER_START_AGE}, a carreira própria, que você pode bancar; cada temporada dela tem ${percent(HERITAGE.SEASON_REVEAL_CHANCE)} de chance de revelar mais um.`,
    `Ao pendurar o capacete, o primeiro ano fora do carro pode ser o ano de transição: um papel à escolha (${transitionRoles}), com cachê por etapa e eventos próprios. Quem para no meio da temporada escolhe logo depois de parar, se ainda houver pelo menos ${percent(TRANSITION.MIDSEASON_MIN_SHARE)} do calendário pela frente; senão, a escolha fica para o fechamento, e o papel vale pela temporada seguinte inteira. Ele não é obrigatório: dá para ir direto para os negócios (aceitar um cargo, comprar ou fundar uma equipe) ou seguir sem equipe. No fechamento do ano de transição, você decide se vira dirigente.`,
    `Cada papel do ano de transição deixa um legado. ${transitionLegacies}`,
    'Quando o personagem morre ou passa o comando em vida, você escolhe quem assume, pelo que se sabe de cada um: talentos e defeitos já revelados, o teste no kart, a avaliação dos treinadores, a categoria e a equipe. Quem corre pode seguir nas pistas; quem é adulto pode assumir os negócios. O save nunca acaba.',
    `A herança paga imposto de ${percent(ASSET_RULES.INHERITANCE_TAX)} sobre o que passa de ${formatMoney(ASSET_RULES.INHERITANCE_EXEMPT)} (${percent(ASSET_RULES.HANDOVER_TAX)} quando o comando passa em vida). Quando quem assume é um dos filhos, os outros levam ${percent(ASSET_RULES.SIBLING_SHARE)} cada (até ${counted(ASSET_RULES.SIBLING_SHARE_MAX, 'irmão', 'irmãos')}).`,
    `Os filhos que não assumem seguem caminho próprio (${paths}) e continuam na árvore da família. A partir dos ${RELATIVES.WORK_FROM_AGE} anos, quem foi para a engenharia ou para a direção esportiva aparece entre os profissionais que a equipe da família pode contratar, por um salário menor, e abre portas em outras equipes; quem foi para os negócios pode patrocinar quem corre.`,
    `Da segunda geração em diante, o sobrenome pesa: quem herda começa com pelo menos ${percent(FAMILY.NAME_PRESTIGE)} da maior reputação da família. Se alguém que veio antes ficou conhecido (reputação máxima acima de ${SURNAME.FAME_FLOOR}), vêm também mais contatos nas equipes, a imprensa compara com essa pessoa e resultado ruim custa mais reputação e moral; quanto maior a fama, maior o peso.`,
    `O patrimônio paga o começo: só quem herda pode comprar uma vaga numa equipe da frente, ${percent(HEIR_START.TOP_SEAT_PREMIUM)} mais cara que a tabela e paga na hora, se a herança cobrir a vaga e uma reserva para viver. Se a família é dona de uma equipe na categoria, dá para correr por ela${FAMILY_TEAM.SEAT_SHARE === 0 ? ', com a vaga paga pela família' : ''}; a imprensa fala em favorecimento, e ficar atrás do companheiro custa moral e reputação.`,
    'Quem passa o comando em vida continua por perto: segue no controle da equipe, cuida das participações da família ou acompanha de longe.',
    `Dinheiro de família tem freio: além do imposto, da segunda geração em diante, quem tem patrimônio de pelo menos ${BAD_INVESTMENT.MIN_WEALTH} vezes o custo de vida de um ano pode receber a proposta de negócio de um conhecido no começo do ano (${percent(BAD_INVESTMENT.CHANCE)} de chance por ano), e ${percent(BAD_INVESTMENT.LOSS_CHANCE)} desses negócios terminam em prejuízo.`,
    'A árvore da família e o placar de cada geração (títulos, vitórias, pódios e equipes) ficam na tela Dinastia, aberta pelo botão "Árvore e placar" em Família.',
  ];
}

/** Os itens de cada assunto; os que têm dinheiro são montados na hora (a moeda de exibição vem do save). */
const TOPICS: { id: string; title: string; icon: LucideIcon; items: readonly string[] | (() => readonly string[]) }[] = [
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
    items: familyItems,
  },
  {
    id: 'depois',
    title: 'Depois das pistas',
    icon: Briefcase,
    items: [
      'Ao se aposentar, o primeiro ano fora do carro pode ser o ano de transição (veja Família e dinastia). Depois dele, ou no lugar dele, você pode investir, aceitar o comando de uma equipe, comprar uma ou fundar a sua.',
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
                'flex min-h-11 shrink-0 items-center gap-2 px-4 text-left text-sm font-semibold transition-colors',
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
      <div id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${current}`} className="mt-4 min-w-0 md:col-start-2 md:row-start-2 md:mt-0">
        {topic ? (
          <Card title={topic.title}>
            <ul className="max-w-3xl list-disc space-y-2 pl-4 text-sm leading-snug text-ink-300">
              {(typeof topic.items === 'function' ? topic.items() : topic.items).map((item) => (
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
