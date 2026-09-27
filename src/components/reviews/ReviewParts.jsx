import { useLayoutEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { StarDisplay } from '../StarRating.jsx';
import { pluralize } from '../../utils/format.js';
import { RATING_LABELS, avatarStyle, formatRelative, initials, ratingTone } from './reviewUtils.js';

/** Цветная плашка оценки: ★ 4.5 */
export function RatingPill({ value, size = 'md', title }) {
  const tone = ratingTone(value);
  const text = value ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '—';
  return (
    <span className={`rating-pill rating-pill-${size} tone-${tone}`} title={title || (value ? `Оценка ${text} из 5` : 'Оценок пока нет')}>
      <Icon name="star" /> {text}
    </span>
  );
}

/** Сводка: крупная оценка + распределение, строки распределения — фильтры. */
export function ReviewSummary({ reviews, avg, filter, onFilter }) {
  const total = reviews.length;
  return (
    <section className="rv-summary" aria-label="Сводка оценок">
      <div className="rv-score">
        <span className="rv-score-value">{total ? avg.toFixed(1) : '—'}</span>
        <StarDisplay value={avg} size={16} className="rv-score-stars" />
        <span className="rv-score-count">
          {total ? `${total} ${pluralize(total, 'отзыв', 'отзыва', 'отзывов')}` : 'Пока без оценок'}
        </span>
      </div>
      <div className="rv-dist">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = reviews.filter((r) => r.rating === n).length;
          const active = filter === n;
          return (
            <button
              key={n}
              type="button"
              className={`rv-dist-row ${active ? 'active' : ''}`}
              aria-pressed={active}
              disabled={!count && !active}
              onClick={() => onFilter(active ? null : n)}
              title={count ? `Показать отзывы с оценкой ${n}` : `Отзывов с оценкой ${n} нет`}
            >
              <span className="rv-dist-label">{n} <Icon name="star" /></span>
              <span className="rv-dist-bar"><span style={{ width: total ? `${(count / total) * 100}%` : 0 }} /></span>
              <span className="rv-dist-count">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Карточка отзыва в виде цитаты. Длинный текст сворачивается.
 * eventTitle/onEventClick — для общего списка у администратора.
 */
export function ReviewCard({ review, own = false, eventTitle, onEventClick, actions }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 2);
  }, [review.text, expanded]);

  return (
    <article className={`rv-card ${own ? 'own' : ''}`}>
      {eventTitle && (
        <button type="button" className="rv-card-event" onClick={onEventClick}>
          <Icon name="calendar" /> {eventTitle}
        </button>
      )}
      <div className="rv-card-top">
        <RatingPill value={review.rating} size="sm" />
        <span className="rv-card-verdict">{RATING_LABELS[review.rating]}</span>
        {own && <span className="rv-own-label">Ваш отзыв</span>}
      </div>
      <blockquote className="rv-card-quote">
        <p ref={textRef} className={`rv-card-text ${expanded ? 'expanded' : ''}`}>{review.text}</p>
      </blockquote>
      {(clamped || expanded) && (
        <button type="button" className="link-btn rv-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Свернуть' : 'Читать полностью'}
        </button>
      )}
      <footer className="rv-card-footer">
        <span className="rv-avatar" style={avatarStyle(review.authorName)} aria-hidden="true">{initials(review.authorName)}</span>
        <span className="rv-author">
          <span className="rv-author-name">{review.authorName}</span>
          <span className="rv-author-meta">
            Участник, {formatRelative(review.createdAt)}{review.updatedAt ? ', изменён' : ''}
          </span>
        </span>
        {actions && <span className="rv-card-actions">{actions}</span>}
      </footer>
    </article>
  );
}

/** Выбор оценки: пять крупных кнопок с подписью. */
export function RatingPicker({ value, onChange }) {
  return (
    <div className="rv-picker" role="radiogroup" aria-label="Оценка мероприятия">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`rv-picker-item tone-${ratingTone(n)} ${value === n ? 'selected' : ''} ${value && n <= value ? 'filled' : ''}`}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
          }}
        >
          <span className="rv-picker-num">{n} <Icon name="star" /></span>
          <span className="rv-picker-label">{RATING_LABELS[n]}</span>
        </button>
      ))}
    </div>
  );
}
