/**
 * Licenças e requisitos de acesso às categorias.
 *
 * Cada temporada rende pontos de licença pela posição final. Para entrar em
 * uma categoria, o piloto precisa da soma mínima nas últimas três temporadas,
 * além de idade, reputação e experiência mínimas.
 */
import type { CareerState, CategoryId, License } from '@/domain/schemas';
import { LICENSE_WINDOW_SEASONS, getCategory } from '@/data/categories';
import { getPlayer } from './selectors';

export function licensePointsFor(categoryId: CategoryId, position: number): number {
  return getCategory(categoryId).licensePoints[position - 1] ?? 0;
}

/** Soma dos pontos de licença nas últimas temporadas (janela de três). */
export function licensePointsTotal(license: License, currentSeason: number): number {
  return license.history.filter((h) => h.season > currentSeason - LICENSE_WINDOW_SEASONS).reduce((sum, h) => sum + h.points, 0);
}

export interface Requirement {
  key: 'license' | 'age' | 'reputation' | 'experience' | 'finance';
  label: string;
  detail: string;
  met: boolean;
}

/**
 * Requisitos esportivos para disputar uma categoria na próxima temporada.
 * `nextSeason` indica que a idade considerada é a do ano seguinte.
 */
export function categoryRequirements(
  career: CareerState,
  categoryId: CategoryId,
  options: { nextSeason: boolean; reputation?: number } = { nextSeason: true },
): Requirement[] {
  const category = getCategory(categoryId);
  const req = category.requirements;
  const player = getPlayer(career);
  const age = player.age + (options.nextSeason ? 1 : 0);
  const points = licensePointsTotal(career.license, career.season);
  const reputation = options.reputation ?? career.reputation;
  const experience = Math.floor(player.attributes.experience);
  return [
    { key: 'license', label: req.licenseName, detail: `${points} de ${req.licensePoints} pontos de licença`, met: points >= req.licensePoints },
    { key: 'age', label: 'Idade mínima', detail: `${age} de ${req.minAge} anos`, met: age >= req.minAge },
    { key: 'reputation', label: 'Reputação', detail: `${Math.floor(reputation)} de ${req.minReputation}`, met: reputation >= req.minReputation },
    { key: 'experience', label: 'Experiência', detail: `${experience} de ${req.minExperience}`, met: experience >= req.minExperience },
  ];
}
