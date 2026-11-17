/** Junta classes, ignorando o que for falso. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Tom de um componente. A cor de cada um é fixa em todo o jogo: neutro; verde é bom; âmbar pede
 * atenção; vermelho é a ação principal e o jogador. Nenhum deles carrega a informação sozinho:
 * há sempre um texto, uma seta ou um ícone junto.
 */
export type Tone = 'neutral' | 'good' | 'attention' | 'accent';
