/**
 * Identidade visual da escada: um veículo por categoria e números de carro estáveis.
 * (O desenho em si depende de canvas e é conferido no navegador; aqui ficam os dados e as regras.)
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '@/domain/schemas';
import { CATEGORIES } from '@/data/categories';
import { VEHICLES, vehicleFor } from '@/data/vehicles';
import { CIRCUIT, assignCarNumbers, buildRaceContext, createRaceTimeline, createWeekendRace, runPractice, runQualifying, startWeekend } from './engineApi';
import { newCareer, playRound, resolvePending } from './helpers';

describe('veículo de cada categoria', () => {
  it('toda categoria do jogo tem o seu veículo, com sprite próprio, e nenhuma foi criada ou removida', () => {
    expect(Object.keys(VEHICLES).sort()).toEqual([...CATEGORY_IDS].sort());
    expect(CATEGORIES.map((c) => c.id)).toEqual(['kart-regional', 'kart-national', 'kart-international', 'f4', 'f3', 'f2', 'f1']);
    const names = new Set<string>();
    for (const category of CATEGORIES) {
      const vehicle = VEHICLES[category.id];
      expect(vehicle.categoryId).toBe(category.id);
      // Kart nas categorias de kart, monoposto nas demais: a mesma divisão das regras.
      expect(vehicle.kind, category.id).toBe(category.vehicle);
      expect(existsSync(`src/assets/race/vehicles/${category.id}.webp`), category.id).toBe(true);
      names.add(vehicle.name);
      expect(vehicle.description.length).toBeGreaterThan(30);
    }
    expect(names.size).toBe(CATEGORIES.length);
  });

  it('a progressão é visível: cada degrau tem um veículo maior que o anterior, e todos cabem lado a lado na pista', () => {
    const ladder = [...CATEGORIES].sort((a, b) => a.tier - b.tier).map((c) => VEHICLES[c.id]);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!.length, ladder[i]!.categoryId).toBeGreaterThan(ladder[i - 1]!.length);
    // O F1 é bem maior que o kart de entrada, mas a proporção continua plausível (um F1 real tem quase três vezes um kart).
    expect(VEHICLES.f1.length / VEHICLES['kart-regional'].length).toBeGreaterThan(1.6);
    expect(VEHICLES.f1.length / VEHICLES['kart-regional'].length).toBeLessThan(3);
    for (const vehicle of ladder) {
      // Dois carros lado a lado, cada um na sua faixa, cabem na largura da pista.
      expect(vehicle.width * 2 + 2, vehicle.categoryId).toBeLessThan(CIRCUIT.TRACK_WIDTH);
      // Na mesma fila do grid, um carro não encosta no da frente.
      expect(vehicle.length * 1.08, vehicle.categoryId).toBeLessThan(CIRCUIT.GRID_SLOT * 2);
      expect(vehicle.length / vehicle.width).toBeGreaterThan(vehicle.kind === 'kart' ? 1.4 : 2.1);
    }
    expect(vehicleFor('f3')).toBe(VEHICLES.f3);
    expect(vehicleFor('categoria-desconhecida')).toBe(VEHICLES.f1);
  });
});

describe('número do carro', () => {
  it('é único no campeonato, não depende da ordem e é o mesmo na garagem e na corrida', () => {
    let career = playRound(newCareer(909));
    const ids = career.drivers.map((d) => d.id);
    const numbers = assignCarNumbers(ids);
    expect(Object.keys(numbers)).toHaveLength(ids.length);
    expect(new Set(Object.values(numbers)).size).toBe(ids.length);
    for (const n of Object.values(numbers)) {
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(99);
    }
    expect(assignCarNumbers([...ids].reverse())).toEqual(numbers);
    expect(assignCarNumbers([...ids, ...ids])).toEqual(numbers);

    // Na corrida, o número de cada carro é o da garagem, em qualquer etapa.
    career = runQualifying(runPractice(startWeekend(resolvePending(career)), 'setup'), 'balanced');
    const timeline = createRaceTimeline(createWeekendRace(career), buildRaceContext(career));
    for (const car of Object.values(timeline.cars)) expect(car.number, car.driverId).toBe(numbers[car.driverId]);
    expect(timeline.cars[career.playerDriverId]!.number).toBe(numbers[career.playerDriverId]);
  });

  it('com mais pilotos do que números, não trava (aceita repetição)', () => {
    const many = Array.from({ length: 140 }, (_, i) => `piloto-${i}`);
    const numbers = assignCarNumbers(many);
    expect(Object.keys(numbers)).toHaveLength(140);
    expect(new Set(Object.values(numbers)).size).toBe(98);
  });
});
