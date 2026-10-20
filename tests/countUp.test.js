import { describe, expect, it } from 'vitest';
import { formatCount, parseCount } from '../src/components/anim/CountUp.jsx';

describe('CountUp: разбор и формат значений статистики', () => {
  it.each([
    [3, '3'],
    ['24 ч', '24 ч'],
    ['1 200+', '1 200+'],
    ['22+ ч', '22+ ч'],
    ['8,5 ч', '8,5 ч'],
    ['12500', '12 500'],
  ])('%s → %s', (value, shown) => {
    const p = parseCount(value);
    expect(p).not.toBeNull();
    expect(formatCount(p, p.n).replace(/ /g, ' ')).toBe(shown);
  });

  it('промежуточные значения сохраняют префикс, суффикс и точность', () => {
    const p = parseCount('8,5 ч');
    expect(formatCount(p, 4.25)).toBe('4,3 ч');
    expect(formatCount(parseCount('1 200+'), 0)).toBe('0+');
  });

  it('нечисловые значения не анимируются', () => {
    expect(parseCount('—')).toBeNull();
    expect(parseCount('')).toBeNull();
  });
});
