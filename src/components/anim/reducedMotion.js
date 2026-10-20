/** Пользователь попросил систему уменьшить анимацию — тогда показываем итоговое состояние сразу. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
