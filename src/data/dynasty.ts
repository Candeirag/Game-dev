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
