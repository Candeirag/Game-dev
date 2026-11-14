import { useEffect, useRef, type CSSProperties } from 'react';
import type { CategoryId } from '@/domain/schemas';
import { VEHICLES } from '@/data/vehicles';
import { accentFor, drawVectorCar, helmetFor, liveryFor, loadCarSprites, spriteAspect } from '../race/liveries';
import { cx } from './ui';

interface Props {
  categoryId: CategoryId;
  teamId: string;
  color: string;
  /** Piloto (define a cor do capacete). Sem piloto, o capacete fica neutro. */
  driverId?: string;
  /** Número do carro, pintado no bico. */
  number?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Veículo de uma categoria visto de cima, com a pintura da equipe: o mesmo desenho usado na
 * corrida. A largura vem do CSS (className); a altura segue a proporção do veículo.
 */
export function CarSprite({ categoryId, teamId, color, driverId = 'neutro', number, className, style, title }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vehicle = VEHICLES[categoryId];

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const element = canvas.current;
      const g = element?.getContext('2d');
      if (cancelled || !element || !g) return;
      const sprite = liveryFor(categoryId, teamId, color, driverId, number);
      if (sprite) {
        element.width = sprite.width;
        element.height = sprite.height;
        g.drawImage(sprite, 0, 0);
        return;
      }
      // Sem a imagem (ainda carregando ou indisponível): desenho em vetor, na mesma proporção.
      element.width = 320;
      element.height = Math.round(320 / spriteAspect(categoryId));
      g.clearRect(0, 0, element.width, element.height);
      g.save();
      g.translate(element.width / 2, element.height / 2);
      drawVectorCar(g, vehicle.kind, element.width * 0.96, element.height * 0.92, color, accentFor(teamId, color), helmetFor(driverId));
      g.restore();
    };
    draw();
    void loadCarSprites(categoryId).then(draw);
    return () => {
      cancelled = true;
    };
  }, [categoryId, teamId, color, driverId, number, vehicle.kind]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={title ?? vehicle.name}
      title={title ?? vehicle.name}
      className={cx('block h-auto', className)}
      style={{ aspectRatio: String(spriteAspect(categoryId)), ...style }}
    />
  );
}
