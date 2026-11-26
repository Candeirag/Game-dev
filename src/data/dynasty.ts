/**
 * Textos da dinastia (Fase 6): os caminhos dos filhos que não herdaram a carreira e o papel do
 * personagem anterior que passou o comando em vida. Só palavras; os números estão em RELATIVES
 * (`src/config/balance.ts`) e as regras em `src/engine/dynasty/relatives.ts`.
 */
import type { Elder, RelativePath } from '@/domain/schemas';

export interface RelativePathInfo {
  /** Nome do caminho, para a árvore da família e as mensagens. */
  label: string;
  /** O que a pessoa faz nesse caminho, numa frase sem gênero. */
  description: string;
}

export const RELATIVE_PATH_INFO: Readonly<Record<RelativePath, RelativePathInfo>> = {
  engineer: { label: 'Engenharia', description: 'Trabalha com o carro: pode ir para os boxes de uma equipe.' },
  business: { label: 'Negócios', description: 'Cuida de empresas: pode patrocinar quem corre pela família.' },
  sportingDirector: { label: 'Direção esportiva', description: 'Conhece pilotos e contratos: pode dirigir o esporte de uma equipe.' },
};

/** O papel de quem passou o comando em vida, numa expressão sem gênero. */
export const ELDER_ROLE_INFO: Readonly<Record<Elder['role'], { label: string }>> = {
  owner: { label: 'No controle da equipe' },
  investor: { label: 'Cuida das participações' },
  retired: { label: 'Longe das pistas' },
};

/** O que a imprensa diz quando compara o herdeiro com quem veio antes (Fase 6). */
export interface SurnamePressParams {
  /** Nome de quem veio antes. */
  predecessor: string;
  /** O que essa pessoa fazia na mesma idade, já montado ("corria na Fórmula Júnior e terminou o ano em 3º"). */
  past: string;
  /** O resultado desta etapa foi bom (entre os primeiros, sem abandono)? */
  good: boolean;
}

/**
 * A imprensa comparando com quem veio antes. Uma variante por mensagem, sorteada; o jogo não sabe
 * o gênero do piloto nem o de quem veio antes, então nenhuma frase usa adjetivo com gênero para os
 * dois.
 */
export const SURNAME_PRESS_TEXTS: readonly ((p: SurnamePressParams) => { title: string; body: string })[] = [
  (p) => ({
    title: 'A imprensa compara',
    body: `Na transmissão, o comentarista lembra que, na sua idade, ${p.predecessor} ${p.past}. ${p.good ? 'Desta vez, a comparação soa como elogio.' : 'Desta vez, a comparação pesa.'}`,
  }),
  (p) => ({
    title: 'O sobrenome nas manchetes',
    body: `Um jornal monta a tabela lado a lado: na sua idade, ${p.predecessor} ${p.past}. ${p.good ? 'O texto termina dizendo que a família está bem representada.' : 'O texto termina perguntando se o sobrenome não pesa demais.'}`,
  }),
  (p) => ({
    title: 'Pergunta de sempre na zona de entrevistas',
    body: `Mal você tira o capacete, alguém lembra que, na sua idade, ${p.predecessor} ${p.past}. ${p.good ? 'Com o resultado de hoje, dá para responder sorrindo.' : 'Com o resultado de hoje, a resposta sai curta.'}`,
  }),
  (p) => ({
    title: 'Comparação no programa de esporte',
    body: `O programa de domingo mostra imagens antigas: na sua idade, ${p.predecessor} ${p.past}. ${p.good ? 'Os convidados acham que a história se repete.' : 'Os convidados acham que ainda falta muito.'}`,
  }),
];

/** O que a imprensa diz quando quem corre pela equipe da família fica atrás do companheiro. */
export interface FavoritismPressParams {
  /** Nome de quem corre pela equipe da família. */
  driver: string;
  team: string;
  teammate: string;
}

export const FAVORITISM_PRESS_TEXTS: readonly ((p: FavoritismPressParams) => { title: string; body: string })[] = [
  (p) => ({
    title: 'Favorecimento?',
    body: `${p.teammate} terminou à frente de ${p.driver} nesta etapa, e a imprensa pergunta se a vaga na ${p.team} é de quem anda mais ou de quem tem o sobrenome certo.`,
  }),
  (p) => ({
    title: 'Conversa no paddock',
    body: `No paddock, o assunto é a ${p.team}: com ${p.teammate} na frente, há quem diga que ${p.driver} só está lá por ser da família.`,
  }),
  (p) => ({
    title: 'A equipe da família na berlinda',
    body: `Um colunista lembra que a ${p.team} é da família e que ${p.teammate} vem batendo ${p.driver}. A pergunta do texto é se a escalação resistiria a um chefe de fora.`,
  }),
];
