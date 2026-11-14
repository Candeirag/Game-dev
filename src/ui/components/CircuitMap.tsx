import { useMemo } from 'react';
import type { Track } from '@/domain/schemas';
import { CIRCUIT, buildCircuit, pitLateralAt, poseAt, type CircuitStyle } from '@/engine';
import { cx } from './ui';

/**
 * Mapa do circuito: o mesmo traçado em que a corrida acontece, desenhado como miniatura.
 * Mostra a pista, o pit lane, a linha de largada e o sentido da corrida.
 */
export function CircuitMap({ track, style, className, detailed = false }: { track: Track; style: CircuitStyle; className?: string; detailed?: boolean }) {
  const map = useMemo(() => {
    const circuit = buildCircuit(track, style);
    const stride = Math.max(1, Math.floor(circuit.count / 600));
    const points: string[] = [];
    for (let i = 0; i < circuit.count; i += stride) points.push(`${(circuit.x[i] ?? 0).toFixed(1)},${(circuit.y[i] ?? 0).toFixed(1)}`);
    const pit: string[] = [];
    for (let k = Math.floor(circuit.pit.entry * circuit.count); k <= Math.ceil((1 + circuit.pit.exit) * circuit.count); k += 2) {
      const s = k / circuit.count;
      const p = poseAt(circuit, s, pitLateralAt(circuit, s));
      pit.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    const half = CIRCUIT.TRACK_WIDTH / 2;
    const a = poseAt(circuit, 0, -half * 1.8);
    const b = poseAt(circuit, 0, half * 1.8);
    // Seta do sentido da corrida, logo depois da largada.
    const tip = poseAt(circuit, 46 / circuit.length);
    return { circuit, points: points.join(' '), pit: pit.join(' '), line: { a, b }, tip };
  }, [track, style]);
  const { circuit } = map;
  // Nas miniaturas a pista é desenhada mais larga do que na corrida, para continuar visível.
  const stroke = detailed ? CIRCUIT.TRACK_WIDTH : Math.max(CIRCUIT.TRACK_WIDTH, circuit.width / 46);
  const arrow = stroke * 1.5;
  return (
    <svg
      viewBox={`0 0 ${circuit.width} ${circuit.height}`}
      role="img"
      aria-label={`Traçado de ${track.name}, sentido ${circuit.clockwise ? 'horário' : 'anti-horário'}`}
      className={cx('block', className)}
    >
      {detailed && <polyline points={map.pit} fill="none" stroke="#3a4253" strokeWidth={CIRCUIT.PIT_WIDTH} strokeLinejoin="round" />}
      <polygon
        points={map.points}
        fill="none"
        stroke="#e6ebf3"
        strokeOpacity={0.16}
        strokeWidth={stroke + (detailed ? 8 : stroke * 0.5)}
        strokeLinejoin="round"
      />
      <polygon points={map.points} fill="none" stroke="#97a3b8" strokeWidth={stroke} strokeLinejoin="round" />
      <line x1={map.line.a.x} y1={map.line.a.y} x2={map.line.b.x} y2={map.line.b.y} stroke="#ef3b2d" strokeWidth={stroke * 0.55} />
      <polygon
        points={`${arrow},0 ${-arrow * 0.7},${-arrow * 0.75} ${-arrow * 0.7},${arrow * 0.75}`}
        fill="#ef3b2d"
        transform={`translate(${map.tip.x.toFixed(1)} ${map.tip.y.toFixed(1)}) rotate(${((map.tip.heading * 180) / Math.PI).toFixed(1)})`}
      />
    </svg>
  );
}
