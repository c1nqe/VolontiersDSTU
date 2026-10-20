import { useLayoutEffect } from 'react';
import { animate, stagger } from 'animejs';
import { prefersReducedMotion } from './reducedMotion.js';

/**
 * Появление приветственного блока (anime.js): текст поднимается по очереди, плитки статистики
 * «всплывают» с небольшим опозданием. Срабатывает один раз при монтировании блока.
 */
export default function useHeroIntro(ref) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return undefined;
    const text = root.querySelectorAll('.hero-badge, .hero-title, .hero-subtitle, .hero-actions');
    const tiles = root.querySelectorAll('.hero-stat-item');
    const a = animate(text, {
      opacity: { from: 0 },
      y: { from: 22 },
      duration: 750,
      delay: stagger(90),
      ease: 'outCubic',
    });
    const b = animate(tiles, {
      opacity: { from: 0 },
      scale: { from: 0.86 },
      y: { from: 14 },
      duration: 650,
      delay: stagger(80, { start: 260 }),
      ease: 'outBack(1.4)',
    });
    return () => { a.revert(); b.revert(); };
  }, [ref]);
}
