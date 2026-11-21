/**
 * Textos dos lances decisivos e do rádio do engenheiro (Fase 4). Aqui só há palavras: as chances,
 * os ganhos e as perdas em número ficam em `RACE_MOMENTS`, em `src/config/balance.ts`, e as regras,
 * em `src/engine/simulation/race/moments.ts`.
 *
 * Cada texto recebe o nome curto do rival ("A. Sobrenome") quando o lance tem um; nos lances sem
 * rival o argumento vem vazio e o texto não o usa.
 */
import type { MomentKind } from '@/domain/schemas';

export interface MomentOptionText {
  label: string;
  /** O que se ganha se der certo e o que se perde se der errado: uma linha curta cada. */
  gain: (rival: string) => string;
  loss: (rival: string) => string;
  /** Frase do resultado, quando dá certo e quando dá errado. */
  won: (rival: string) => string;
  lost: (rival: string) => string;
}

export interface MomentText {
  title: string;
  question: (rival: string) => string;
  options: Readonly<Record<string, MomentOptionText>>;
}

export const MOMENT_TEXTS: Readonly<Record<MomentKind, MomentText>> = {
  start: {
    title: 'Largada',
    question: () => 'As luzes vão apagar. Como você larga?',
    options: {
      inside: {
        label: 'Arriscar por dentro',
        gain: () => 'Ganha até 2 posições na primeira curva',
        loss: () => 'Perde tempo; pode tocar em alguém e ser punido',
        won: () => 'Por dentro, no limite: você ganha terreno na primeira curva.',
        lost: () => 'Você ficou espremido por dentro e perdeu tempo.',
      },
      outside: {
        label: 'Ir por fora',
        gain: () => 'Ganha 1 posição, sem risco de toque',
        loss: () => 'Abre demais e perde tempo',
        won: () => 'Por fora, com espaço: boa largada.',
        lost: () => 'Por fora faltou aderência: você abriu e perdeu tempo.',
      },
      hold: {
        label: 'Segurar a posição',
        gain: () => 'Defende a posição na primeira volta',
        loss: () => 'No pior caso, patina e perde um pouco',
        won: () => 'Largada limpa: posição defendida.',
        lost: () => 'As rodas patinaram e você perdeu um pouco na saída.',
      },
    },
  },
  attack: {
    title: 'Ataque',
    question: (rival) => `Você está colado em ${rival}. Como atacar?`,
    options: {
      dive: {
        label: 'Mergulhar na freada',
        gain: (rival) => `Passa ${rival} já nesta volta`,
        loss: () => 'Perde a linha; pode haver toque, punição ou abandono',
        won: (rival) => `Mergulho na freada: ${rival} ficou para trás.`,
        lost: (rival) => `${rival} fechou a porta e você perdeu a linha.`,
      },
      wait: {
        label: 'Esperar o erro do rival',
        gain: (rival) => `Passa sem risco se ${rival} errar`,
        loss: () => 'Nada: segue atrás e poupa pneu',
        won: (rival) => `${rival} errou sob pressão e abriu a porta.`,
        lost: (rival) => `${rival} não errou: você segue atrás, com o pneu poupado.`,
      },
      slipstream: {
        label: 'Usar o vácuo',
        gain: (rival) => `Passa ${rival} na reta, sem toque`,
        loss: () => 'Perde um pouco de tempo se não der',
        won: (rival) => `No vácuo, você emparelhou e passou ${rival} na reta.`,
        lost: (rival) => `O vácuo não bastou: ${rival} segurou na freada.`,
      },
    },
  },
  defense: {
    title: 'Defesa',
    question: (rival) => `${rival} chegou e está mais rápido. O que você faz?`,
    options: {
      block: {
        label: 'Fechar a porta',
        gain: () => 'Segura a posição nesta volta',
        loss: () => 'Perde a posição; pode haver toque e punição',
        won: (rival) => `Porta fechada: ${rival} teve de tirar o pé.`,
        lost: (rival) => `${rival} achou o espaço e passou.`,
      },
      yield: {
        label: 'Ceder para não bater',
        gain: () => 'Não perde tempo e poupa o pneu e o carro',
        loss: () => 'Entrega a posição',
        won: (rival) => `Você cedeu a posição a ${rival} sem perder tempo.`,
        lost: (rival) => `Você cedeu a posição a ${rival}.`,
      },
    },
  },
  rain: {
    title: 'Chuva começando',
    question: () => 'A pista começa a molhar. Parar ou ficar?',
    options: {
      pit: {
        label: 'Parar para trocar o pneu',
        gain: () => 'Pneu certo para a pista molhada, já',
        loss: () => 'Só perde se a parada sair lenta',
        won: () => 'Parada limpa: você volta com o pneu certo.',
        lost: () => 'A parada saiu lenta e custou tempo.',
      },
      stay: {
        label: 'Arriscar na pista',
        gain: () => 'Ganha tempo e posição enquanto os outros param',
        loss: () => 'Com pneu de seco, pode rodar ou bater',
        won: () => 'Você segura o carro na pista molhada e ganha tempo.',
        lost: () => 'Sem aderência: o carro escapou.',
      },
    },
  },
  lastLap: {
    title: 'Última volta',
    question: (rival) => (rival ? `Última volta, com ${rival} ao alcance. Tudo ou nada?` : 'Última volta. Tudo ou nada?'),
    options: {
      allIn: {
        label: 'Tudo ou nada',
        gain: (rival) => (rival ? `Passa ${rival} antes da bandeirada` : 'Ganha tempo e pode cravar a melhor volta'),
        loss: () => 'Pode rodar, tocar ou abandonar sem pontos',
        won: (rival) => (rival ? `Tudo ou nada: você passou ${rival} na última volta.` : 'Volta no limite até a bandeirada.'),
        lost: () => 'Você passou do ponto na última volta.',
      },
      secure: {
        label: 'Garantir os pontos',
        gain: () => 'Defende a posição até a bandeirada',
        loss: () => 'No pior caso, um erro pequeno',
        won: () => 'Carro em casa: posição garantida.',
        lost: () => 'Um erro pequeno na última volta custou tempo.',
      },
    },
  },
  pit: {
    title: 'Parada',
    question: () => 'A janela de parada abriu. Parar agora ou esticar?',
    options: {
      undercut: {
        label: 'Parar agora (undercut)',
        gain: () => 'Pneu novo antes dos rivais e voltas de saída rápidas',
        loss: () => 'Só perde se a parada sair lenta',
        won: () => 'Undercut: parada limpa e voltas de saída voando.',
        lost: () => 'A parada saiu lenta e o undercut não funcionou.',
      },
      overcut: {
        label: 'Esticar (overcut)',
        gain: () => 'Mais voltas com pista livre e pneu poupado',
        loss: () => 'O pneu pode cair do penhasco antes da parada',
        won: () => 'Overcut: o pneu aguentou e a pista estava livre.',
        lost: () => 'O pneu acabou antes da hora: voltas lentas até a parada.',
      },
    },
  },
};

/** O que se acrescenta à frase do resultado quando o erro tem consequência. */
export const MOMENT_CONSEQUENCE_TEXTS = {
  spin: () => ' Você rodou.',
  crash: () => ' Você bateu e está fora da corrida.',
  touch: (rival: string) => ` Houve toque com ${rival}.`,
  retired: (rival: string) => ` O toque com ${rival} tirou você da corrida.`,
  rivalRetired: (rival: string) => ` O toque tirou ${rival} da corrida.`,
  penalty: (seconds: number) => ` Punição de ${seconds} s.`,
} as const;

/**
 * Rádio do engenheiro: frases curtas, para caber numa linha da tarja. O pneu citado no aviso de
 * desgaste é o mais exigido de cada pista (escolhido pelo id dela, sempre o mesmo); o modelo tem
 * um desgaste só por carro.
 */
export const RADIO_TEXTS = {
  corners: ['Dianteiro esquerdo', 'Dianteiro direito', 'Traseiro esquerdo', 'Traseiro direito'],
  tyresLimit: (corner: string) => `${corner} no limite.`,
  tyresLimitWindow: (corner: string, from: number, to: number) => `${corner} no limite. Janela de parada: voltas ${from} a ${to}.`,
  tyresGone: (loss: string) => `O pneu acabou: estamos perdendo ${loss} s por volta.`,
  rivalPittedAhead: (rival: string) => `${rival} parou. Dá para tentar o undercut.`,
  rivalPittedBehind: (rival: string) => `${rival} parou atrás de nós. Cuidado com o undercut.`,
  rain: (laps: number) => (laps <= 1 ? 'Chuva chegando na próxima volta.' : `Chuva prevista em ${laps} voltas.`),
  closing: (rival: string, gap: string) => `${rival} chegando: ${gap} s atrás.`,
  pitWindow: (from: number, to: number) => (from === to ? `Janela de parada: volta ${from}.` : `Janela de parada aberta: voltas ${from} a ${to}.`),
} as const;
