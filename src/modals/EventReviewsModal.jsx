import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { EmptyState } from '../components/Common.jsx';
import { StarDisplay, StarInput } from '../components/StarRating.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { MAX_REVIEW_LENGTH } from '../store/DataStore.js';
import { formatDate, pluralize } from '../utils/format.js';

/**
 * Отзывы о мероприятии: сводка оценок, список отзывов и форма
 * для участника (создание или редактирование своего отзыва).
 */
export default function EventReviewsModal({ onClose, eventId, compose = false }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const event = store.getEvents().find((e) => e.id === eventId);
  const user = store.getCurrentUser();
  // Волонтёр пишет от своего профиля; администратор в демо-режиме — от выбранного профиля волонтёра
  const actingVolunteer = user && (user.role === 'VOLUNTEER' || user.role === 'ADMIN') ? store.getActiveVolunteer() : null;
  const eligibility = actingVolunteer ? store.canReviewEvent(actingVolunteer.id, eventId) : null;
  const existing = eligibility?.existing || null;

  const [editing, setEditing] = useState(compose && Boolean(eligibility?.allowed));
  const [rating, setRating] = useState(existing?.rating || 0);
  const [text, setText] = useState(existing?.text || '');

  if (!event) return null;
  const reviews = store.getEventReviews(eventId);
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  const startEditing = () => {
    setRating(existing?.rating || 0);
    setText(existing?.text || '');
    setEditing(true);
  };

  const submit = (e) => {
    e.preventDefault();
    const res = store.saveEventReview({ eventId, volonteerId: actingVolunteer.id, rating, text });
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast(res.updated ? 'Отзыв обновлён' : 'Спасибо! Отзыв опубликован.');
    setEditing(false);
  };

  const remove = (review) => {
    if (!window.confirm('Удалить отзыв? Действие нельзя отменить.')) return;
    store.deleteEventReview(review.id);
    showToast('Отзыв удалён', 'info');
    setEditing(false);
    setRating(0);
    setText('');
  };

  let composer = null;
  if (!user) {
    composer = (
      <div className="review-cta">
        <span>Участвовали в мероприятии? Войдите, чтобы поделиться впечатлениями.</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('login')}><Icon name="login" /> Войти</button>
      </div>
    );
  } else if (actingVolunteer && eligibility?.allowed && !editing) {
    composer = (
      <div className="review-cta">
        <span>{existing ? 'Вы уже оставили отзыв об этом мероприятии.' : 'Вы участвовали в этом мероприятии — расскажите, как всё прошло.'}</span>
        <button type="button" className="btn btn-accent btn-sm" onClick={startEditing}>
          <Icon name="star" /> {existing ? 'Изменить отзыв' : 'Оставить отзыв'}
        </button>
      </div>
    );
  } else if (actingVolunteer && eligibility && !eligibility.allowed) {
    composer = <div className="review-cta review-cta-muted"><Icon name="info" /> {eligibility.reason}</div>;
  }

  return (
    <Modal title="Отзывы о мероприятии" subtitle={event.title} icon="message" size="lg" onClose={onClose}>
      <div className="modal-body">
        <div className="review-summary">
          <div className="review-summary-score">
            <span className="review-score-number">{reviews.length ? event.ratingAvg.toFixed(1) : '—'}</span>
            <StarDisplay value={event.ratingAvg} size={18} />
            <span className="muted small">{reviews.length} {pluralize(reviews.length, 'отзыв', 'отзыва', 'отзывов')}</span>
          </div>
          <div className="review-bars">
            {distribution.map(({ n, count }) => (
              <div key={n} className="review-bar-row">
                <span>{n}</span>
                <Icon name="star" size={12} className="star-full" />
                <div className="review-bar"><div style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : 0 }} /></div>
                <span className="review-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {editing && actingVolunteer ? (
          <form className="review-form" onSubmit={submit}>
            <h4>{existing ? 'Редактирование отзыва' : 'Ваш отзыв'}</h4>
            <StarInput value={rating} onChange={setRating} />
            <label className="form-group">
              <span className="form-label">Что понравилось, что можно улучшить? *</span>
              <textarea
                className="form-textarea"
                value={text}
                maxLength={MAX_REVIEW_LENGTH}
                onChange={(e) => setText(e.target.value)}
                placeholder="Организация, задачи волонтёров, атмосфера, питание, инструктаж…"
                rows={4}
                required
              />
              <span className="form-hint form-hint-right">{text.length} / {MAX_REVIEW_LENGTH}</span>
            </label>
            <div className="review-form-actions">
              {existing && (
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(existing)}>
                  <Icon name="trash" /> Удалить
                </button>
              )}
              <span className="grow" />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!rating}>
                {existing ? 'Сохранить изменения' : 'Опубликовать отзыв'}
              </button>
            </div>
          </form>
        ) : composer}

        {reviews.length === 0 ? (
          <EmptyState icon="message" title="Отзывов пока нет">
            {event.status === 'CLOSED' ? 'Участники ещё не поделились впечатлениями.' : 'Отзывы появятся после проведения мероприятия.'}
          </EmptyState>
        ) : (
          <div className="review-list">
            {reviews.map((r) => {
              const own = actingVolunteer && r.volonteerId === actingVolunteer.id;
              return (
                <article key={r.id} className={`review-item ${own ? 'own' : ''}`}>
                  <div className="review-item-head">
                    <div className="row-gap">
                      <span className="avatar-circle sm">{r.authorName.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>
                      <div>
                        <div className="review-author-name">{r.authorName}{own && <span className="badge badge-confirmed badge-xs">Вы</span>}</div>
                        <div className="review-author">{formatDate(r.createdAt)}{r.updatedAt && ', изменён'}</div>
                      </div>
                    </div>
                    <StarDisplay value={r.rating} />
                  </div>
                  <p className="review-text">{r.text}</p>
                  {user?.role === 'ADMIN' && !own && (
                    <div className="review-item-actions">
                      <button type="button" className="link-btn danger" onClick={() => remove(r)}><Icon name="trash" /> Удалить как модератор</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
