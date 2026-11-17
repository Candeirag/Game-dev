import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FileUp, LoaderCircle, Play, Plus, Settings } from 'lucide-react';
import { CATEGORY_NAMES, FIRST_CATEGORY_ID, TOP_CATEGORY_ID, categoryRef } from '@/domain/categoryNames';
import { capitalize } from '@/domain/text';
import type { SaveSlotId, SlotInfo } from '@/persistence/saveService';
import { useGameStore } from '@/store/gameStore';
import { Button, Card, cx } from '@/ui/kit';
import { formatDateTime } from '../format';
import { StorageWarning } from '../components/SaveNotices';
import { WIDE_QUERY, useMediaQuery } from '../layout/chrome';

const SLOT_LABELS: Record<SaveSlotId, string> = { auto: 'Save automático', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };
/** Saves da primeira versão não guardavam a categoria no resumo: eram todos do primeiro degrau. */
const FIRST_CATEGORY_LABEL = CATEGORY_NAMES[FIRST_CATEGORY_ID].shortName;

export function MainMenuScreen() {
  const career = useGameStore((s) => s.career);
  const slots = useGameStore((s) => s.slots);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const importJson = useGameStore((s) => s.importJson);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // O mesmo corte da moldura da carreira: tela deitada (ou larga) divide o menu em duas colunas.
  const wide = useMediaQuery(WIDE_QUERY);

  // Abrir um save é espera de verdade (leitura do armazenamento, validação e migração): o botão
  // mostra o progresso e os outros ficam travados até terminar.
  const [opening, setOpening] = useState<SaveSlotId | 'file' | null>(null);

  if (career) return <Navigate to="/dashboard" replace />;

  const auto = slots.find((s) => s.slot === 'auto' && s.status === 'ok');

  async function load(slot: SaveSlotId) {
    setError(null);
    setOpening(slot);
    try {
      await loadSlot(slot);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
    }
  }

  async function onImport(file: File) {
    setError(null);
    setOpening('file');
    try {
      await importJson(await file.text());
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
    }
  }

  const autoDetail = auto
    ? `${auto.summary?.playerName} · ${auto.summary?.categoryName ?? FIRST_CATEGORY_LABEL} ${auto.summary?.year} · Etapa ${auto.summary?.roundsCompleted}/${auto.summary?.totalRounds}`
    : '';

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--color-apex-500)_18%,transparent),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-full w-[60%] -skew-x-12 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_38px,rgba(255,255,255,0.025)_38px,rgba(255,255,255,0.025)_40px)]"
      />
      {/* As margens respeitam as áreas seguras: deitado, o recorte da câmera fica num dos lados. */}
      <div
        className={cx(
          'relative mx-auto grid min-h-dvh w-full max-w-6xl gap-x-8 gap-y-5',
          'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          wide
            ? 'grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]'
            : 'content-start pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]',
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="chamfer grid h-7 w-7 shrink-0 place-items-center bg-apex-500 font-display text-lg font-bold italic leading-none text-white [--chamfer:6px]"
            >
              A
            </span>
            <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-apex-400">Carreira e gestão no automobilismo</span>
          </div>
          {/* O tamanho acompanha a altura e a largura da tela: o nome cabe em três linhas no celular deitado, e "Motorsport" cabe numa linha mesmo com a fonte reserva, que é mais larga. */}
          <h1 className="mt-2 font-display text-[clamp(2rem,min(12vh,11.5vw),4.5rem)] font-bold uppercase leading-[0.9] tracking-tight [overflow-wrap:anywhere]">
            Apex
            <br />
            <span className="text-apex-500">Motorsport</span>
            <br />
            Dynasty
          </h1>
          <p className="mt-2.5 max-w-md text-sm leading-snug text-ink-300 lg:mt-4 lg:text-base">
            {capitalize(categoryRef(FIRST_CATEGORY_ID, 'de'))} {categoryRef(TOP_CATEGORY_ID, 'a')}: sete categorias, contratos, patrocinadores, finanças,
            rivalidades e corridas decididas volta a volta.
          </p>

          <div className="mt-3 grid max-w-md gap-2 lg:mt-6">
            {auto && (
              <Button
                variant="primary"
                className="min-h-12 justify-start text-left"
                disabled={opening !== null}
                aria-busy={opening === 'auto'}
                aria-label={`Continuar: ${autoDetail}`}
                onClick={() => void load('auto')}
              >
                {opening === 'auto' ? (
                  <LoaderCircle size={20} aria-hidden className="shrink-0 animate-spin" />
                ) : (
                  <Play size={20} aria-hidden className="shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block font-display text-xl font-semibold uppercase leading-none tracking-wide">Continuar</span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-white">{autoDetail}</span>
                </span>
              </Button>
            )}
            <Button variant={auto ? 'secondary' : 'primary'} className={cx('justify-start', !auto && 'min-h-12')} onClick={() => navigate('/new')}>
              <Plus size={20} aria-hidden className="shrink-0" />
              <span className={cx('font-display font-semibold uppercase leading-none tracking-wide', auto ? 'text-lg' : 'text-xl')}>Nova carreira</span>
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <StorageWarning link={false} />
          {error && (
            <div role="alert" className="border border-gold-400/60 bg-gold-400/10 px-3 py-2 text-sm text-gold-400">
              {error}
            </div>
          )}
          <Card title="Carregar carreira" padded={false}>
            <ul className="divide-y divide-ink-800">
              {slots.map((slot) => (
                <SlotRow key={slot.slot} slot={slot} busy={opening === slot.slot} disabled={opening !== null} onLoad={() => void load(slot.slot)} />
              ))}
              {slots.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">Verificando saves…</li>}
            </ul>
            <div className="flex gap-2 border-t border-ink-700 p-2">
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])}
              />
              <Button className="min-w-0 flex-1" disabled={opening !== null} aria-busy={opening === 'file'} onClick={() => fileInput.current?.click()}>
                {opening === 'file' ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <FileUp size={16} aria-hidden />}
                {opening === 'file' ? 'Abrindo o save…' : 'Importar save (.json)'}
              </Button>
              <Button onClick={() => navigate('/ajustes')}>
                <Settings size={16} aria-hidden />
                Ajustes
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SlotRow({ slot, busy, disabled, onLoad }: { slot: SlotInfo; busy: boolean; disabled: boolean; onLoad: () => void }) {
  const summary = slot.status === 'ok' ? slot.summary : undefined;
  return (
    <li className="flex min-h-13 items-center justify-between gap-3 py-1 pl-4 pr-2">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-sm font-semibold">{SLOT_LABELS[slot.slot]}</span>
          {slot.status === 'ok' && slot.savedAt && <span className="truncate text-xs text-ink-400">{formatDateTime(slot.savedAt)}</span>}
        </div>
        {summary && (
          <div className="truncate text-xs text-ink-300">
            {summary.playerName} · {summary.categoryName ?? FIRST_CATEGORY_LABEL} {summary.year} · {summary.roundsCompleted}/{summary.totalRounds} etapas ·{' '}
            {summary.teamName}
          </div>
        )}
        {slot.status === 'empty' && <div className="text-xs text-ink-400">Vazio</div>}
        {slot.status === 'corrupted' && <div className="truncate text-xs text-gold-400">Danificado: tentaremos a cópia de segurança</div>}
        {slot.status === 'newer' && <div className="truncate text-xs text-gold-400">De uma versão mais nova do jogo: atualize para abrir</div>}
      </div>
      <Button className="shrink-0" disabled={slot.status === 'empty' || slot.status === 'newer' || disabled} aria-busy={busy} onClick={onLoad}>
        {busy && <LoaderCircle size={16} aria-hidden className="animate-spin" />}
        {busy ? 'Abrindo…' : 'Carregar'}
      </Button>
    </li>
  );
}
