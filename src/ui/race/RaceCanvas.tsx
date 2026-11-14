import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Driver, Team } from '@/domain/schemas';
import { vehicleFor } from '@/data/vehicles';
import type { Circuit, RaceTimeline } from '@/engine';
import { cx } from '../components/ui';
import { loadCarSprites } from './liveries';
import { createSceneMemory, drawScene, type CameraMode, type SceneInput } from './raceScene';
import { buildTrackArt, loadScenery } from './trackPainter';

interface Props {
  timeline: RaceTimeline;
  circuit: Circuit;
  teams: Readonly<Record<string, Team>>;
  drivers: Readonly<Record<string, Driver>>;
  timeRef: MutableRefObject<number>;
  camera: CameraMode;
  focusId: string;
  mineIds: ReadonlySet<string>;
  lights: number | null;
  onSelect(driverId: string): void;
  className?: string;
}

/** Canvas da corrida: pista e carros, redesenhados a cada quadro a partir do tempo da reprodução. */
export function RaceCanvas({ timeline, circuit, teams, drivers, timeRef, camera, focusId, mineIds, lights, onSelect, className }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const memory = useRef(createSceneMemory());

  // Cores das equipes na ordem dos boxes (a mesma ordem usada pela linha do tempo).
  const boxColors = useMemo(() => {
    const byBox = Object.values(timeline.cars).sort((a, b) => a.boxIndex - b.boxIndex);
    const colors: string[] = [];
    for (const car of byBox) colors[car.boxIndex] = teams[car.teamId]?.color ?? '#9aa3b2';
    return colors;
    // A ordem dos boxes é fixada na largada; por isso basta a referência de `cars` daquela corrida.
  }, [timeline.cars, teams]);
  const art = useMemo(() => buildTrackArt(circuit, boxColors, timeline.order.length), [circuit, boxColors, timeline.order.length]);

  // O laço de desenho lê sempre os dados mais recentes, sem ser recriado a cada atualização.
  const latest = useRef<Omit<SceneInput, 'time'>>({ timeline, circuit, art, teams, drivers, camera, focusId, mineIds, lights });
  latest.current = { timeline, circuit, art, teams, drivers, camera, focusId, mineIds, lights };

  const vehicle = vehicleFor(timeline.categoryId);
  useEffect(() => {
    void loadCarSprites(vehicle.categoryId);
    loadScenery();
  }, [vehicle.categoryId]);

  useEffect(() => {
    const element = canvas.current;
    const box = wrapper.current;
    const context = element?.getContext('2d');
    if (!element || !box || !context) return;
    let width = 0;
    let height = 0;
    let ratio = 1;
    const resize = () => {
      const rect = box.getBoundingClientRect();
      ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawScene(context, { ...latest.current, time: timeRef.current }, memory.current, width, height, now);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [timeRef]);

  // Nova corrida: a câmera e as suavizações recomeçam.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara quando a pista ou o circuito mudam, mesmo sem usá-los no corpo
  useEffect(() => {
    memory.current = createSceneMemory();
  }, [timeline.trackId, circuit]);

  return (
    <div ref={wrapper} className={cx('relative overflow-hidden bg-[#13231b]', className)}>
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full cursor-pointer"
        role="img"
        aria-label="Corrida ao vivo: circuito visto de cima com os carros em movimento"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          let best: { driverId: string; distance: number } | null = null;
          for (const hit of memory.current.hits) {
            const distance = Math.hypot(hit.x - x, hit.y - y);
            if (distance < 30 && (!best || distance < best.distance)) best = { driverId: hit.driverId, distance };
          }
          if (best) onSelect(best.driverId);
        }}
      />
    </div>
  );
}
