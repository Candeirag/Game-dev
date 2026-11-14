/**
 * Comunicação entre as telas e a moldura da carreira (cabeçalho e navegação).
 * A tela de corrida avisa quando a barra fixa de comandos está aberta: a moldura
 * esconde a navegação inferior do celular e reserva o espaço no fim da página.
 */
import { createContext, useContext, useEffect } from 'react';

export interface Chrome {
  setRaceBar(open: boolean): void;
}

export const ChromeContext = createContext<Chrome>({ setRaceBar() {} });

/** Enquanto o componente estiver montado com `open`, a moldura abre espaço para a barra de corrida. */
export function useRaceBarSpace(open: boolean): void {
  const { setRaceBar } = useContext(ChromeContext);
  useEffect(() => {
    if (!open) return;
    setRaceBar(true);
    return () => setRaceBar(false);
  }, [open, setRaceBar]);
}
