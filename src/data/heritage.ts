/**
 * Textos da herança (Fase 6): o veredito dos instrutores no teste no kart. Só palavras; as faixas
 * de cada veredito (em segundos) estão em HERITAGE.KART_TEST_VERDICTS, em `src/config/balance.ts`,
 * e a regra em `src/engine/dynasty/heritage.ts`.
 */

/** O veredito dos instrutores, do melhor para o pior. */
export const KART_TEST_VERDICT_IDS = ['outstanding', 'promising', 'average', 'limited'] as const;
export type KartTestVerdict = (typeof KART_TEST_VERDICT_IDS)[number];

export interface KartTestVerdictInfo {
  /** Rótulo curto, para a ficha do filho e a tela da sucessão. */
  label: string;
  /** O que os instrutores disseram, para a mensagem do teste. */
  comment: string;
}

export const KART_TEST_VERDICT_INFO: Readonly<Record<KartTestVerdict, KartTestVerdictInfo>> = {
  outstanding: {
    label: 'Impressionante',
    comment: 'Os instrutores conferiram o cronômetro duas vezes e pediram o telefone da família.',
  },
  promising: {
    label: 'Promissor',
    comment: 'Os instrutores gostaram do que viram: com treino, dá para pensar em carreira.',
  },
  average: {
    label: 'Dentro da média',
    comment: 'Os instrutores viram uma criança como tantas outras no kartódromo: vai depender de muito treino.',
  },
  limited: {
    label: 'Ainda longe',
    comment: 'Os instrutores foram sinceros: o ritmo ainda está longe do de quem segue carreira.',
  },
};
