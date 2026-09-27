import { describe, expect, it } from 'vitest';
import { avatarStyle, formatRelative, initials, ratingTone, shortName, SORTS } from '../src/components/reviews/reviewUtils.js';

describe('утилиты отзывов', () => {
  it('определяет тон оценки', () => {
    expect(ratingTone(5)).toBe('good');
    expect(ratingTone(4.5)).toBe('good');
    expect(ratingTone(3)).toBe('mid');
    expect(ratingTone(1)).toBe('low');
    expect(ratingTone(0)).toBe('none');
  });

  it('форматирует дату относительно сегодняшнего дня', () => {
    const now = new Date();
    expect(formatRelative(now.toISOString())).toBe('сегодня');
    expect(formatRelative(new Date(now.getTime() - 86_400_000).toISOString())).toBe('вчера');
    expect(formatRelative(new Date(now.getTime() - 3 * 86_400_000).toISOString())).toBe('3 дня назад');
    expect(formatRelative('2020-01-15T10:00:00')).toBe('15.01.2020');
  });

  it('строит имя и инициалы', () => {
    expect(shortName('Петрова Мария Викторовна')).toBe('Мария П.');
    expect(initials('Петрова Мария Викторовна')).toBe('ПМ');
  });

  it('даёт одному автору один и тот же цвет', () => {
    expect(avatarStyle('Иванов Алексей')).toEqual(avatarStyle('Иванов Алексей'));
  });

  it('сортирует по оценке', () => {
    const list = [{ rating: 3, createdAt: '2026-01-01' }, { rating: 5, createdAt: '2026-01-02' }, { rating: 1, createdAt: '2026-01-03' }];
    expect(list.slice().sort(SORTS.high.fn).map((r) => r.rating)).toEqual([5, 3, 1]);
    expect(list.slice().sort(SORTS.low.fn).map((r) => r.rating)).toEqual([1, 3, 5]);
    expect(list.slice().sort(SORTS.new.fn).map((r) => r.rating)).toEqual([1, 5, 3]);
  });
});
