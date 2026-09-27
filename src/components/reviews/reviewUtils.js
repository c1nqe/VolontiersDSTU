import { formatDate, pluralize } from '../../utils/format.js';

export const RATING_LABELS = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

/** Тон оценки: 4–5 — хорошо, 3 — средне, 1–2 — плохо. */
export function ratingTone(value) {
  if (value >= 4) return 'good';
  if (value >= 3) return 'mid';
  if (value > 0) return 'low';
  return 'none';
}

/** «сегодня», «вчера», «3 дня назад», иначе дата. */
export function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days > 1 && days < 7) return `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
  return formatDate(value);
}

const HUES = [214, 162, 262, 24, 338, 190];

/** Стабильный цвет аватара по имени автора. */
export function avatarStyle(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = HUES[Math.abs(hash) % HUES.length];
  return { background: `hsl(${hue} 70% 94%)`, color: `hsl(${hue} 60% 32%)` };
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** «Петрова Мария Викторовна» → «Мария П.» */
export function shortName(fullName = '') {
  const [last, first] = fullName.split(/\s+/);
  if (!first) return fullName;
  return `${first} ${last[0]}.`;
}

export const SORTS = {
  new: { label: 'Сначала новые', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  high: { label: 'Сначала высокие оценки', fn: (a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt) },
  low: { label: 'Сначала низкие оценки', fn: (a, b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt) },
};
