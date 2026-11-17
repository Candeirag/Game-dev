/**
 * Avisos sobre a guarda da carreira: o lembrete de exportar o .json e o alerta
 * de quando o navegador não deixa gravar nada.
 */
import { isNativeApp } from '@/platform/native';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { cx } from './ui';
import { formatDateTime } from '../format';

/** Link de ação dos avisos: área de toque de 44 px. */
const ACTION_LINK =
  'inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold text-ink-100 shadow-[inset_0_0_0_1px_var(--color-ink-600)] hover:bg-ink-800';

/** Lembrete discreto: os saves moram no navegador, que pode apagá-los. */
export function ExportReminder({ link = true, className }: { link?: boolean; className?: string }) {
  const lastExportAt = useGameStore((s) => s.lastExportAt);
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400', className)}>
      <p className="min-w-0 flex-1 basis-64">
        {isNativeApp()
          ? 'Os saves ficam guardados neste aparelho e somem se o aplicativo for desinstalado.'
          : 'Os saves ficam guardados neste navegador e somem se os dados dele forem apagados.'}{' '}
        Exporte a carreira (.json) de tempos em tempos.{' '}
        <span className={lastExportAt ? 'text-ink-300' : 'text-gold-400'}>Última exportação: {lastExportAt ? formatDateTime(lastExportAt) : 'nunca'}.</span>
      </p>
      {link && (
        <Link to="/saves" className={ACTION_LINK}>
          Exportar agora
        </Link>
      )}
    </div>
  );
}

/** Alerta de armazenamento indisponível: nada do que o jogador fizer fica guardado. */
export function StorageWarning({ className, link = true }: { className?: string; link?: boolean }) {
  const kind = useGameStore((s) => s.storage.kind);
  if (kind !== 'memory') return null;
  return (
    <div
      role="alert"
      className={cx(
        'enter flex flex-wrap items-center gap-x-3 gap-y-1 bg-gold-400/10 px-4 py-2 text-sm text-ink-100 shadow-[inset_3px_0_0_0_var(--color-gold-400)]',
        className,
      )}
    >
      <p className="min-w-0 flex-1 basis-64">
        <b className="text-gold-400">{isNativeApp() ? 'O aparelho' : 'O navegador'} não está deixando o jogo gravar.</b> A carreira está só na memória desta
        página: ao fechar ou recarregar, o progresso será perdido. Exporte a carreira (.json) antes de sair.
      </p>
      {link && (
        <Link to="/saves" className={ACTION_LINK}>
          Abrir Saves
        </Link>
      )}
    </div>
  );
}
