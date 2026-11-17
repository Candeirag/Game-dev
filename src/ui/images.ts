/**
 * Imagens geradas (carros por categoria e retratos), importadas por `npm run app:images` para
 * `src/assets/generated/`. O jogo funciona sem nenhuma delas: quando falta uma imagem, as telas
 * usam o que já existia (o carro desenhado pelo jogo, a placa com o número do piloto).
 */
import type { CategoryId } from '@/domain/schemas';
import { textHash } from '@/engine';

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.webp$/, '');
const byName = (found: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(found).map(([path, url]) => [fileName(path), url]));

const CARS = byName(import.meta.glob<string>('../assets/generated/carros/*.webp', { eager: true, query: '?url', import: 'default' }));
const PORTRAITS = byName(import.meta.glob<string>('../assets/generated/retratos/*.webp', { eager: true, query: '?url', import: 'default' }));

/** Nome reservado para o retrato do piloto do jogador. */
export const PLAYER_PORTRAIT = 'jogador';

/**
 * Qual retrato cabe a cada pessoa: o jogador usa "jogador", se existir; os demais recebem um do
 * elenco, sempre o mesmo para a mesma pessoa (pelo hash de aparência do id, que não entra em
 * nenhum sorteio do jogo). Sem retratos, devolve null e a tela usa a reserva.
 */
export function selectPortrait(names: readonly string[], personId: string, isPlayer: boolean): string | null {
  if (isPlayer) return names.includes(PLAYER_PORTRAIT) ? PLAYER_PORTRAIT : null;
  const pool = names.filter((name) => name !== PLAYER_PORTRAIT).sort();
  return pool.length > 0 ? (pool[textHash(personId) % pool.length] ?? null) : null;
}

/** Endereço do retrato de uma pessoa, ou null se não houver (a tela usa a placa com o número). */
export function portraitUrl(personId: string, isPlayer: boolean): string | null {
  const name = selectPortrait(Object.keys(PORTRAITS), personId, isPlayer);
  return name ? (PORTRAITS[name] ?? null) : null;
}

/** Endereço da imagem do carro de uma categoria, ou null se não houver (a tela usa o carro desenhado pelo jogo). */
export function categoryCarUrl(categoryId: CategoryId): string | null {
  return CARS[categoryId] ?? null;
}
