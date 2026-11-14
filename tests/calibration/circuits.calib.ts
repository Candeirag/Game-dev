/**
 * Folha de conferência dos circuitos: gera todos os traçados e imprime as
 * medidas de cada um. Com CIRCUIT_DUMP=<arquivo>, grava a geometria em JSON
 * para desenhar uma folha de contato (scripts de apoio, fora do repositório).
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BR_KART_TRACKS, CIRCUITS, WORLD_KART_TRACKS } from '@/data/tracks';
import { buildCircuit, type CircuitStyle } from '@/engine';

describe('circuitos', () => {
  it('gera os 34 traçados', () => {
    const all = [
      ...[...BR_KART_TRACKS, ...WORLD_KART_TRACKS].map((track) => ({ track, style: 'kart' as CircuitStyle })),
      ...CIRCUITS.map((track) => ({ track, style: 'formula' as CircuitStyle })),
    ];
    const dump: unknown[] = [];
    console.log('pista                 sentido  compr.  curvas  reta dos boxes  vel. mín.  vel. máx./média  área de desenho');
    for (const { track, style } of all) {
      const c = buildCircuit(track, style);
      const paces = c.tau.slice(1).map((v, i) => 1 / c.count / (v - (c.tau[i] ?? 0)));
      const straight = (c.pit.exit + (1 - c.pit.entry)) * c.length;
      console.log(`${track.id.padEnd(20)}  ${c.clockwise ? 'horário ' : 'anti-h. '} ${c.length.toFixed(0).padStart(5)}  ${String(c.corners.length).padStart(5)}  ${straight.toFixed(0).padStart(12)}  ${Math.min(...paces).toFixed(2).padStart(9)}  ${Math.max(...paces).toFixed(2).padStart(9)}  ${c.real ? `real ×${(c.width / 1000).toFixed(2)}` : 'gerado'}`);
      expect(c.count).toBeGreaterThan(400);
      dump.push({ id: track.id, name: track.name, style, width: c.width, height: c.height, real: c.real, bridges: c.bridges, zones: c.zones, unitsPerMetre: c.unitsPerMetre, x: c.x.map((v) => Math.round(v * 10) / 10), y: c.y.map((v) => Math.round(v * 10) / 10), corners: c.corners, pit: c.pit, heading0: c.heading[0], insideSign: c.insideSign, clockwise: c.clockwise });
    }
    if (process.env.CIRCUIT_DUMP) writeFileSync(process.env.CIRCUIT_DUMP, JSON.stringify(dump));
  });
});
