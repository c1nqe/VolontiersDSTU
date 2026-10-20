import { useLayoutEffect, useRef } from 'react';
import { animate } from 'animejs';
import { prefersReducedMotion } from './reducedMotion.js';

/** «1 200+», «24 ч», «8,5 ч», 3 → префикс, число, суффикс. Нечисловые значения не анимируются. */
export function parseCount(value) {
  const m = String(value ?? '').match(/^(\D*?)(\d{1,3}(?:[\s ]\d{3})+|\d+)(?:[.,](\d+))?(.*)$/);
  if (!m) return null;
  const whole = m[2].replace(/[\s ]/g, '');
  const decimals = (m[3] || '').length;
  const n = Number(decimals ? `${whole}.${m[3]}` : whole);
  return { pre: m[1], n, post: m[4], decimals, grouped: whole !== m[2] || n >= 10000 };
}

export function formatCount(p, x) {
  const num = p.decimals
    ? x.toFixed(p.decimals).replace('.', ',')
    : (p.grouped ? Math.round(x).toLocaleString('ru-RU') : String(Math.round(x)));
  return `${p.pre}${num}${p.post}`;
}

/**
 * Число, которое «досчитывает» до значения (anime.js). При смене значения анимация идёт от прежнего.
 * Скринридеры читают итоговое значение сразу, анимируемый текст от них скрыт.
 */
export default function CountUp({ value, duration = 1100 }) {
  const ref = useRef(null);
  const shown = useRef(0);
  const parsed = parseCount(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !parsed) return undefined;
    if (prefersReducedMotion()) {
      el.textContent = formatCount(parsed, parsed.n);
      shown.current = parsed.n;
      return undefined;
    }
    const state = { v: shown.current };
    el.textContent = formatCount(parsed, state.v);
    const anim = animate(state, {
      v: parsed.n,
      duration,
      ease: 'outExpo',
      onUpdate: () => { el.textContent = formatCount(parsed, state.v); },
      onComplete: () => { el.textContent = formatCount(parsed, parsed.n); },
    });
    shown.current = parsed.n;
    return () => anim.pause();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!parsed) return <>{value}</>;
  return (
    <>
      <span className="visually-hidden">{String(value)}</span>
      <span ref={ref} aria-hidden="true" className="count-up" />
    </>
  );
}
