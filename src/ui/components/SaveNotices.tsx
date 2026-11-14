/**
 * Avisos sobre a guarda da carreira: o lembrete de exportar o .json e o alerta
 * de quando o navegador não deixa gravar nada.
 */
import { Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { cx } from './ui';
import { formatDateTime } from '../format';

/** Lembrete discreto: os saves moram no navegador, que pode apagá-los. */
export function ExportReminder({ link = true, className }: { link?: boolean; className?: string }) {
  const lastExportAt = useGameStore((s) => s.lastExportAt);
  return (
    <p className={cx('text-xs text-ink-400', className)}>
      Os saves ficam guardados neste navegador e somem se os dados dele forem apagados. Exporte a carreira (.json) de tempos em tempos.{' '}
      <span className={lastExportAt ? 'text-ink-300' : 'text-gold-400'}>Última exportação: {lastExportAt ? formatDateTime(lastExportAt) : 'nunca'}.</span>
      {link && <> <Link to="/saves" className="font-semibold text-ink-200 underline underline-offset-2 hover:text-ink-100">Exportar agora</Link></>}
    </p>
  );
}

/** Alerta de armazenamento indisponível: nada do que o jogador fizer fica guardado. */
export function StorageWarning({ className, link = true }: { className?: string; link?: boolean }) {
  const kind = useGameStore((s) => s.storage.kind);
  if (kind !== 'memory') return null;
  return (
    <div role="alert" className={cx('rounded-lg border border-apex-500/60 bg-apex-500/15 px-4 py-3 text-sm text-ink-100', className)}>
      <b className="text-apex-400">O navegador não está deixando o jogo gravar.</b> A carreira está só na memória desta página: ao fechar ou recarregar, o progresso será perdido.
      {' '}Exporte a carreira (.json) antes de sair{link ? <>, na tela <Link to="/saves" className="font-semibold underline underline-offset-2">Saves</Link></> : ''}.
    </div>
  );
}
