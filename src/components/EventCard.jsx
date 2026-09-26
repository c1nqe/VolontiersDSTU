import Icon from './Icon.jsx';
import { RatingSummary } from './StarRating.jsx';
import { EVENT_STATUS, formatDate } from '../utils/format.js';

/**
 * Карточка мероприятия. Одинаковая структура во всех кабинетах:
 * шапка (статус + дата), содержимое, мета-данные и футер с действиями,
 * прижатый к низу карточки, чтобы кнопки в сетке стояли на одной линии.
 */
export default function EventCard({
  event,
  statusLabel,
  showOrg = true,
  meta = 'public',
  footerInfo,
  actions,
  onShowReviews,
}) {
  const status = EVENT_STATUS[event.status] || EVENT_STATUS.CREATED;
  const showRating = onShowReviews && (event.status === 'CLOSED' || event.reviewsCount > 0);

  return (
    <article className="event-card">
      <header className="event-header">
        <span className={`badge ${status.badge}`}>{statusLabel || status.label}</span>
        <span className="event-date"><Icon name="calendar" /> {formatDate(event.startDate)}
          {event.endDate && event.endDate !== event.startDate && <> – {formatDate(event.endDate)}</>}
        </span>
      </header>

      <h4 className="event-title">{event.title}</h4>
      {showOrg && (
        <div className="event-org"><Icon name="building" /> <span>{event.organizationName}</span></div>
      )}
      <p className="event-desc">{event.description}</p>

      <ul className="event-meta">
        <li><Icon name="mapPin" /> <span>{event.location}</span></li>
        {meta === 'organizer' ? (
          <>
            <li><Icon name="users" /> <span>Набрано: <strong>{event.approvedVolunteersCount} / {event.requiredVolunteers}</strong></span></li>
            <li><Icon name="clock" /> <span>Длительность: <strong>{event.plannedHours} ч</strong></span></li>
          </>
        ) : (
          <>
            <li><Icon name="clock" /> <span>{meta === 'admin' ? 'Плановые часы' : 'Опыт'}: <strong>{meta === 'admin' ? '' : '+'}{event.plannedHours} ч</strong></span></li>
            <li><Icon name="users" /> <span>Требуется: <strong>{event.requiredVolunteers} чел.</strong></span></li>
          </>
        )}
      </ul>

      {showRating && (
        <div className="event-rating">
          <RatingSummary avg={event.ratingAvg} count={event.reviewsCount} onClick={() => onShowReviews(event)} />
        </div>
      )}

      <footer className="event-footer">
        <span className="event-footer-info">{footerInfo}</span>
        <div className="event-footer-actions">{actions}</div>
      </footer>
    </article>
  );
}
