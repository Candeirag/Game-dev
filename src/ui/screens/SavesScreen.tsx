import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPaste, Copy, Download, FileUp } from 'lucide-react';
import { CATEGORY_NAMES, FIRST_CATEGORY_ID } from '@/domain/categoryNames';
import { SAVE_SLOTS, type SaveSlotId } from '@/persistence/saveService';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, PageHeader, cx } from '../components/ui';
import { ExportReminder } from '../components/SaveNotices';
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
    <div className="space-y-4">
      <PageHeader eyebrow="Persistência" title="Saves">
        <span className="text-xs text-ink-400">Armazenamento: {STORAGE_LABELS[storage.kind]}</span>
      </PageHeader>

      {message && (
        <div
          role="status"
          className={cx(
            'border px-3 py-2 text-sm',
            message.tone === 'ok' ? 'border-go-400/40 bg-go-400/10 text-go-400' : 'border-gold-400/60 bg-gold-400/10 text-gold-400',
          )}
        >
          {message.text}
        </div>
      )}

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Slots" padded={false}>
          <ul className="divide-y divide-ink-800">
            {SAVE_SLOTS.map((id) => {
              const slot = slots.find((s) => s.slot === id);
              const empty = !slot || slot.status === 'empty';
              const summary = slot?.status === 'ok' ? slot.summary : undefined;
              return (
                // Slot vazio cabe numa linha; com carreira, o resumo fica em cima e os botões embaixo (ou ao lado, quando há largura).
                <li key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2">
                  <div className={cx('min-w-0 flex-1', empty ? 'basis-16' : 'basis-72')}>
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 text-sm font-semibold">{SLOT_LABELS[id]}</span>
                      {slot?.status === 'ok' && slot.savedAt && <span className="truncate text-xs text-ink-400">{formatDateTime(slot.savedAt)}</span>}
                    </div>
                    <div className="text-xs text-ink-300">
                      {empty && <span className="text-ink-500">Vazio</span>}
                      {summary && (
                        <>
                          {summary.playerName} · {summary.categoryName ?? CATEGORY_NAMES[FIRST_CATEGORY_ID].shortName} · {summary.teamName} · {summary.year} ·{' '}
                          {summary.roundsCompleted}/{summary.totalRounds} etapas
                          {summary.championshipPosition && ` · ${summary.championshipPosition}º no campeonato`}
                        </>
                      )}
                      {slot?.status === 'corrupted' && <span className="text-gold-400">Danificado: {slot.error}</span>}
                      {slot?.status === 'newer' && <span className="text-gold-400">{slot.error}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {id !== 'auto' && <Button onClick={() => void run(() => saveToSlot(id), `Carreira salva em ${SLOT_LABELS[id]}.`)}>Salvar aqui</Button>}
                    <Button
                      disabled={empty || slot?.status === 'newer'}
                      onClick={() =>
                        void run(async () => {
                          await loadSlot(id);
                          navigate('/dashboard');
                        }, 'Carreira carregada.')
                      }
                    >
                      Carregar
                    </Button>
                    {confirmDelete === id ? (
                      <Button
                        variant="danger"
                        onClick={() =>
                          void run(async () => {
                            await removeSlot(id);
                            setConfirmDelete(null);
                          }, `${SLOT_LABELS[id]} apagado.`)
                        }
                      >
                        Confirmar exclusão
                      </Button>
                    ) : (
                      <Button variant="ghost" disabled={empty} onClick={() => setConfirmDelete(id)}>
                        Apagar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-ink-800 px-3 py-2 text-xs text-ink-400">
            O jogo salva sozinho depois de cada sessão e a cada mudança de treino. Toda gravação guarda a anterior como cópia de segurança e é validada
            (estrutura, consistência e checksum).
          </p>
        </Card>

        <Card title="Exportar e importar" bodyClassName="p-3">
          <ExportReminder link={false} className="mb-3" />
          <div className="grid gap-2">
            <Button onClick={download}>
              <Download size={16} aria-hidden className="shrink-0" />
              Exportar carreira (.json)
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    await importJson(await file.text());
                    navigate('/dashboard');
                  }, 'Carreira importada.');
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileInput.current?.click()}>
              <FileUp size={16} aria-hidden className="shrink-0" />
              Importar arquivo
            </Button>
            <Button disabled={!career} onClick={() => void copy()}>
              <Copy size={16} aria-hidden className="shrink-0" />
              Copiar carreira como texto
            </Button>
            <Button aria-expanded={transfer?.mode === 'paste'} onClick={() => setTransfer(transfer?.mode === 'paste' ? null : { mode: 'paste', text: '' })}>
              <ClipboardPaste size={16} aria-hidden className="shrink-0" />
              Colar carreira
            </Button>
          </div>
          {transfer && (
            <div className="mt-3 space-y-2">
              <label htmlFor="save-transfer" className="block text-sm text-ink-300">
                {transfer.mode === 'copy'
                  ? 'O navegador não liberou a área de transferência. Selecione todo o texto abaixo e copie.'
                  : 'Cole aqui o texto de uma carreira exportada.'}
              </label>
              <textarea
                id="save-transfer"
                rows={4}
                readOnly={transfer.mode === 'copy'}
                value={transfer.text}
                onChange={(e) => setTransfer({ mode: 'paste', text: e.target.value })}
                onFocus={(e) => {
                  if (transfer.mode === 'copy') e.target.select();
                }}
                spellCheck={false}
                className="block w-full border border-ink-700 bg-ink-850 px-3 py-2 font-mono text-xs text-ink-100 transition-colors focus:border-apex-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {transfer.mode === 'paste' && (
                  <Button
                    variant="primary"
                    disabled={!transfer.text.trim()}
                    onClick={() =>
                      void run(async () => {
                        await importJson(transfer.text);
                        setTransfer(null);
                        navigate('/dashboard');
                      }, 'Carreira importada.')
                    }
                  >
                    Importar texto
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setTransfer(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-400">
            Serve de backup e para levar a carreira a outro aparelho. Se o download não começar (há aplicativos e páginas que bloqueiam arquivos baixados),
            copie a carreira como texto. Saves alterados à mão são recusados pelo checksum.
          </p>
        </Card>
      </div>
    </div>
  );
}
