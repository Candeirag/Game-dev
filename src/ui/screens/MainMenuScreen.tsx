import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CHAMPIONSHIP_NAME } from '@/data/rules';
import type { SaveSlotId, SlotInfo } from '@/persistence/saveService';
import { useGameStore } from '@/store/gameStore';
import { Button, cx } from '../components/ui';
import { formatDateTime } from '../format';

const SLOT_LABELS: Record<SaveSlotId, string> = { auto: 'Save automático', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };

export function MainMenuScreen() {
  const career = useGameStore((s) => s.career);
  const slots = useGameStore((s) => s.slots);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const importJson = useGameStore((s) => s.importJson);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (career) return <Navigate to="/dashboard" replace />;

  const auto = slots.find((s) => s.slot === 'auto' && s.status === 'ok');

  async function load(slot: SaveSlotId) {
    setError(null);
    try {
      await loadSlot(slot);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onImport(file: File) {
    setError(null);
    try {
      await importJson(await file.text());
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,59,45,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(96,165,250,0.08),transparent_50%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-0 h-full w-[60%] -skew-x-12 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_38px,rgba(255,255,255,0.025)_38px,rgba(255,255,255,0.025)_40px)]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-apex-500/40 bg-apex-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-apex-400">
            Fase 2 · Carreira completa
          </div>
          <h1 className="font-display text-6xl font-bold uppercase leading-[0.9] tracking-tight sm:text-7xl">
            Apex
            <br />
            <span className="text-apex-500">Motorsport</span>
            <br />
            Dynasty
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink-300">
            Comece no {CHAMPIONSHIP_NAME}, em uma equipe modesta, e suba a escada até a Fórmula 1: sete categorias, contratos, patrocinadores, finanças, rivalidades e corridas decididas volta a volta.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3">
            <Button variant="primary" className="h-14 text-base" onClick={() => navigate('/new')}>
              Nova carreira
            </Button>
            {auto && (
              <Button className="h-14 text-base" onClick={() => void load('auto')}>
                Continuar: {auto.summary?.playerName} · {auto.summary?.categoryName ?? 'Kart Regional'} {auto.summary?.year} · Etapa {auto.summary?.roundsCompleted}/{auto.summary?.totalRounds}
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-ink-700/70 bg-ink-900/80 p-4">
            <div className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-300">Carregar carreira</div>
            <ul className="space-y-2">
              {slots.map((slot) => (
                <SlotRow key={slot.slot} slot={slot} onLoad={() => void load(slot.slot)} />
              ))}
              {slots.length === 0 && <li className="text-sm text-ink-400">Verificando saves…</li>}
            </ul>
            <div className="mt-4 border-t border-ink-800 pt-4">
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])} />
              <Button variant="ghost" className="w-full" onClick={() => fileInput.current?.click()}>
                Importar save (.json)
              </Button>
            </div>
          </div>
          {error && <div role="alert" className="rounded-lg border border-apex-600/50 bg-apex-600/10 px-4 py-3 text-sm text-apex-400">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function SlotRow({ slot, onLoad }: { slot: SlotInfo; onLoad: () => void }) {
  return (
    <li className={cx('flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5', slot.status === 'corrupted' ? 'border-apex-600/40' : 'border-ink-800')}>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{SLOT_LABELS[slot.slot]}</div>
        {slot.status === 'ok' && slot.summary && (
          <div className="truncate text-xs text-ink-400">
            {slot.summary.playerName} · {slot.summary.categoryName ?? 'Kart Regional'} · {slot.summary.teamName} · {slot.summary.year} · {slot.summary.roundsCompleted}/{slot.summary.totalRounds} etapas · {slot.savedAt && formatDateTime(slot.savedAt)}
          </div>
        )}
        {slot.status === 'empty' && <div className="text-xs text-ink-500">Vazio</div>}
        {slot.status === 'corrupted' && <div className="text-xs text-apex-400">Danificado: tentaremos a cópia de segurança</div>}
      </div>
      <Button className="px-3 py-1.5" disabled={slot.status === 'empty'} onClick={onLoad}>
        Carregar
      </Button>
    </li>
  );
}
