import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAVE_SLOTS, type SaveSlotId } from '@/persistence/saveService';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, PageHeader, cx } from '../components/ui';
import { ExportReminder, StorageWarning } from '../components/SaveNotices';
import { formatDateTime } from '../format';

const SLOT_LABELS: Record<SaveSlotId, string> = { auto: 'Save automático', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };
const STORAGE_LABELS = { indexeddb: 'IndexedDB do navegador', localstorage: 'localStorage do navegador', memory: 'Memória (não persistente)' };

export function SavesScreen() {
  const { slots, storage, refreshSlots, saveToSlot, loadSlot, removeSlot, exportJson, importJson, markExported, career } = useGameStore();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SaveSlotId | null>(null);
  // Caixa de texto para levar a carreira como texto: 'copy' mostra o save para copiar à mão
  // (quando o navegador recusa a área de transferência), 'paste' recebe um save colado.
  const [transfer, setTransfer] = useState<{ mode: 'copy' | 'paste'; text: string } | null>(null);

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  async function run(action: () => Promise<void>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'ok', text: success });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  }

  function download() {
    const json = exportJson();
    if (!json || !career) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-carreira-${career.year}-etapa-${career.rounds.length}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
  }

  /** Alternativa ao download: há páginas e aplicativos que bloqueiam arquivos baixados. */
  async function copy() {
    const json = exportJson();
    if (!json) return;
    setMessage(null);
    try {
      await navigator.clipboard.writeText(json);
      markExported();
      setTransfer(null);
      setMessage({ tone: 'ok', text: 'Carreira copiada. Cole o texto em uma nota ou em um arquivo para guardar.' });
    } catch {
      setTransfer({ mode: 'copy', text: json });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Persistência" title="Saves">
        <span className="text-sm text-ink-400">Armazenamento: {STORAGE_LABELS[storage.kind]}</span>
      </PageHeader>

      <StorageWarning link={false} />

      {message && (
        <div role="status" className={cx('rounded-lg border px-4 py-3 text-sm', message.tone === 'ok' ? 'border-go-400/30 bg-go-400/10 text-go-400' : 'border-apex-600/50 bg-apex-600/10 text-apex-400')}>
          {message.text}
        </div>
      )}

      <Card title="Slots">
        <ul className="space-y-3">
          {SAVE_SLOTS.map((id) => {
            const slot = slots.find((s) => s.slot === id);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-800 p-3">
                <div className="min-w-0">
                  <div className="font-semibold">{SLOT_LABELS[id]}</div>
                  <div className="text-sm text-ink-400">
                    {!slot || slot.status === 'empty' ? 'Vazio' : null}
                    {slot?.status === 'ok' && slot.summary && (
                      <>
                        {slot.summary.playerName} · {slot.summary.categoryName ?? 'Kart Regional'} · {slot.summary.teamName} · {slot.summary.year} · {slot.summary.roundsCompleted}/{slot.summary.totalRounds} etapas
                        {slot.summary.championshipPosition && ` · ${slot.summary.championshipPosition}º no campeonato`} · {slot.savedAt && formatDateTime(slot.savedAt)}
                      </>
                    )}
                    {slot?.status === 'corrupted' && <span className="text-apex-400">Danificado: {slot.error}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {id !== 'auto' && <Button onClick={() => void run(() => saveToSlot(id), `Carreira salva em ${SLOT_LABELS[id]}.`)}>Salvar aqui</Button>}
                  <Button disabled={!slot || slot.status === 'empty'} onClick={() => void run(async () => { await loadSlot(id); navigate('/dashboard'); }, 'Carreira carregada.')}>Carregar</Button>
                  {confirmDelete === id ? (
                    <Button variant="danger" onClick={() => void run(async () => { await removeSlot(id); setConfirmDelete(null); }, `${SLOT_LABELS[id]} apagado.`)}>Confirmar exclusão</Button>
                  ) : (
                    <Button variant="ghost" disabled={!slot || slot.status === 'empty'} onClick={() => setConfirmDelete(id)}>Apagar</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-ink-400">
          O jogo salva sozinho depois de cada sessão e a cada mudança de treino. Toda gravação guarda a versão anterior como cópia de segurança, e cada save é validado (estrutura, consistência e checksum) antes de ser gravado e ao ser carregado.
        </p>
      </Card>

      <Card title="Exportar e importar">
        <ExportReminder link={false} className="mb-3" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>Exportar carreira (.json)</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void run(async () => { await importJson(await file.text()); navigate('/dashboard'); }, 'Carreira importada.');
            e.target.value = '';
          }} />
          <Button variant="ghost" onClick={() => fileInput.current?.click()}>Importar arquivo</Button>
          <Button disabled={!career} onClick={() => void copy()}>Copiar carreira como texto</Button>
          <Button variant="ghost" onClick={() => setTransfer(transfer?.mode === 'paste' ? null : { mode: 'paste', text: '' })}>Colar carreira</Button>
        </div>
        {transfer && (
          <div className="mt-4 space-y-2">
            <label htmlFor="save-transfer" className="block text-sm text-ink-300">
              {transfer.mode === 'copy' ? 'O navegador não liberou a área de transferência. Selecione todo o texto abaixo e copie.' : 'Cole aqui o texto de uma carreira exportada.'}
            </label>
            <textarea
              id="save-transfer"
              rows={6}
              readOnly={transfer.mode === 'copy'}
              value={transfer.text}
              onChange={(e) => setTransfer({ mode: 'paste', text: e.target.value })}
              onFocus={(e) => { if (transfer.mode === 'copy') e.target.select(); }}
              spellCheck={false}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 font-mono text-xs text-ink-100 focus:border-apex-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {transfer.mode === 'paste' && (
                <Button variant="primary" disabled={!transfer.text.trim()} onClick={() => void run(async () => { await importJson(transfer.text); setTransfer(null); navigate('/dashboard'); }, 'Carreira importada.')}>Importar texto</Button>
              )}
              <Button variant="ghost" onClick={() => setTransfer(null)}>Fechar</Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-400">Use para fazer backup fora do navegador ou levar a carreira para outro computador. Se o download não começar (alguns aplicativos e páginas bloqueiam arquivos baixados), copie a carreira como texto. Saves alterados à mão são recusados pelo checksum.</p>
      </Card>
    </div>
  );
}
