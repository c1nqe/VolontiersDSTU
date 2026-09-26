import { useState } from 'react';
import Icon from './Icon.jsx';
import { pluralize } from '../utils/format.js';

const LABELS = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

/** Отображение рейтинга (только чтение). */
export function StarDisplay({ value = 0, size = 16, className = '' }) {
  return (
    <span className={`star-display ${className}`} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="star-cell" style={{ width: size, height: size }}>
            <Icon name="star" size={size} className="star-empty" />
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
              <Icon name="star" size={size} className="star-full" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Выбор оценки 1–5 (клавиатура: стрелки влево/вправо). */
export function StarInput({ value, onChange, size = 30 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-input">
      <div
        role="radiogroup"
        aria-label="Оценка мероприятия"
        className="star-input-row"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${LABELS[n]}`}
            className={`star-btn ${n <= shown ? 'on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)); }
            }}
          >
            <Icon name="star" size={size} />
          </button>
        ))}
      </div>
      <span className="star-input-label">{shown ? LABELS[shown] : 'Выберите оценку'}</span>
    </div>
  );
}

/** Компактная сводка: ★ 4.5 (2 отзыва) */
export function RatingSummary({ avg, count, onClick }) {
  const content = count > 0 ? (
    <>
      <StarDisplay value={avg} size={14} />
      <strong>{avg.toFixed(1)}</strong>
      <span className="muted">({count} {pluralize(count, 'отзыв', 'отзыва', 'отзывов')})</span>
    </>
  ) : (
    <span className="muted">Отзывов пока нет</span>
  );
  if (!onClick) return <span className="rating-summary">{content}</span>;
  return (
    <button type="button" className="rating-summary rating-summary-btn" onClick={onClick}>
      {content}
    </button>
  );
}
