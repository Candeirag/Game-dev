import type { ReactNode } from 'react';
import type { CategoryId } from '@/domain/schemas';
import { VEHICLES } from '@/data/vehicles';
import { cx } from '@/ui/kit';
import { categoryCarUrl } from '../images';

/**
 * A arte do carro da categoria (imagem gerada, importada por `npm run app:images`). Quando a
 * categoria ainda não tem imagem, mostra a reserva: o carro que o jogo já desenhava, com a
 * pintura da equipe. A largura vem do CSS (`className`), fixa, para a imagem não cruzar texto.
 */
export function CategoryCarArt({ categoryId, className, fallback }: { categoryId: CategoryId; className?: string; fallback: ReactNode }) {
  const url = categoryCarUrl(categoryId);
  if (!url) return fallback;
  return <img src={url} alt={VEHICLES[categoryId].name} loading="lazy" decoding="async" className={cx('block h-auto shrink-0', className)} />;
}
