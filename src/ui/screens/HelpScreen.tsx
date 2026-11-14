/** Ajuda: tutorial em passos e um resumo de como o jogo funciona. */
import { useNavigate } from 'react-router-dom';
import { tutorialSteps } from '@/engine';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, PageHeader, cx } from '../components/ui';
import { useCareer } from '../hooks/useCareer';

/** Lista de primeiros passos. Aparece no painel até ser concluída ou dispensada. */
export function TutorialCard({ compact = true }: { compact?: boolean }) {
  const career = useCareer();
  const navigate = useNavigate();
  const dismiss = useGameStore((s) => s.dismissTutorial);
  const steps = tutorialSteps(career);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <Card title={<span className="text-sky-300">Primeiros passos · {done} de {steps.length}</span>} action={compact && !career.tutorial.dismissed ? <button type="button" onClick={dismiss} className="text-xs font-semibold text-ink-400 hover:text-ink-100">Dispensar</button> : undefined} className="border-sky-400/30">
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 text-sm">
            <span aria-hidden className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold', step.done ? 'bg-go-400/20 text-go-400' : step === next ? 'bg-sky-400 text-ink-950' : 'bg-ink-800 text-ink-400')}>{step.done ? '✓' : steps.indexOf(step) + 1}</span>
            <div className="min-w-0 flex-1">
              <div className={cx('font-semibold', step.done ? 'text-ink-400 line-through' : 'text-ink-100')}>{step.title}</div>
              {(!compact || step === next) && <div className="text-ink-300">{step.text}</div>}
            </div>
            {step === next && <Button onClick={() => navigate(step.route)}>Ir</Button>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const TOPICS: { title: string; items: string[] }[] = [
  {
    title: 'Piloto',
    items: [
      'Nove atributos de 0 a 100. O treino (foco e intensidade) rende a cada etapa, até o limite do potencial.',
      'Fase, confiança e moral mudam com os resultados e com a vida fora das pistas, e mexem no ritmo, nos erros e no aproveitamento do treino.',
      'A partir dos 31 anos, velocidade e reflexos caem um pouco a cada ano.',
    ],
  },
  {
    title: 'Fim de semana',
    items: [
      'Treino livre: acerto, simulação de classificação ou ritmo de corrida. Classificação: segura, equilibrada ou ataque total.',
      'Da Fórmula 4 em diante há estratégia de pneus, paradas, combustível, safety car e chuva que muda no meio da prova.',
      'As decisões pendentes (eventos) precisam ser resolvidas antes de abrir o fim de semana.',
      'A corrida é mostrada na pista: toque em Largar, controle a transmissão com Pausar, 1× a 8× e +1 volta, e escolha entre a câmera geral e a que acompanha o seu carro. Tocar num piloto da classificação (ou num carro) o destaca.',
      'Ritmo e pedido de parada valem para a volta seguinte à que o líder está fazendo; a tela mostra qual é. Reiniciar visualização só repete as imagens: o que já aconteceu não muda.',
      'Cada categoria tem o seu veículo, do kart 4 tempos ao Fórmula 1. Os autódromos seguem o traçado de pistas reais, com nomes fictícios (geometria: bacinger/f1-circuits, licença MIT).',
    ],
  },
  {
    title: 'Carreira',
    items: [
      'Sete degraus, do kart regional à Fórmula 1. Para subir: licença, reputação, experiência, idade, dinheiro e uma equipe interessada.',
      'No fim do ano, as propostas ficam na tela Carreira. Dá para negociar salário, vaga, bônus, função e duração.',
      'Terminar entre os três primeiros dá bolsa na vaga do degrau de cima.',
    ],
  },
  {
    title: 'Dinheiro',
    items: [
      'A vaga custa caro nas categorias de base; a família ajuda só nos cinco primeiros anos. Patrocinadores vêm com resultados.',
      'Patrimônio: renda fixa, fundo, ações (preço muda a cada etapa), imóveis, empresas e participações em equipes.',
      'Empréstimo bancário custa 9% ao ano; caixa negativo custa 14%. Imposto de renda progressivo no fim do ano.',
    ],
  },
  {
    title: 'Família e dinastia',
    items: [
      'A partir dos 21 anos você pode conhecer alguém, casar e ter filhos. As decisões aparecem no começo de cada temporada.',
      'Os filhos herdam parte do seu talento. Dos 8 aos 13 anos vem a formação no kart; aos 14, a carreira própria, que você pode bancar.',
      'Quando o personagem morre ou passa o comando, um herdeiro assume: nas pistas ou nos negócios. O save nunca acaba.',
    ],
  },
  {
    title: 'Depois das pistas',
    items: [
      'Ao se aposentar, você pode investir, aceitar o comando de uma equipe, comprar uma ou fundar a sua.',
      'Como dirigente, você decide pilotos, equipe técnica, instalações, patrocinadores e a pesquisa do carro, dentro do regulamento de cada categoria.',
      'O chefe contratado vive de salário e pode ser demitido; o dono fica com o lucro, cobre o prejuízo e deixa a equipe aos herdeiros.',
    ],
  },
];

export function HelpScreen() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Ajuda" title="Como jogar" />
      <TutorialCard compact={false} />
      <div className="grid gap-6 lg:grid-cols-2">
        {TOPICS.map((topic) => (
          <Card key={topic.title} title={topic.title}>
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-300">{topic.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
