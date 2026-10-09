import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { RatingPicker, ReviewCard, ReviewSummary } from '../components/reviews/ReviewParts.jsx';
import { SORTS } from '../components/reviews/reviewUtils.js';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { MAX_REVIEW_LENGTH } from '../store/constants.js';
import { formatDate } from '../utils/format.js';

/**
 * Отзывы о мероприятии: сводка с фильтром по оценке, сортировка,
 * форма для участника (создание или правка своего отзыва) и лента отзывов.
 */
export default function EventReviewsModal({ onClose, eventId, compose = false }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const event = store.getEvent(eventId);
  const user = store.getCurrentUser();
  // Волонтёр пишет от своего профиля; администратор в демо-режиме — от выбранного профиля волонтёра
  const actingVolunteer = user && (user.role === 'VOLUNTEER' || user.role === 'ADMIN') ? store.getActiveVolunteer() : null;
  const eligibility = actingVolunteer ? store.canReviewEvent(actingVolunteer.id, eventId) : null;
  const existing = eligibility?.existing || null;

  const [editing, setEditing] = useState(compose && Boolean(eligibility?.allowed));
  const [rating, setRating] = useState(existing?.rating || 0);
  const [text, setText] = useState(existing?.text || '');
  const [filter, setFilter] = useState(null);
  const [sort, setSort] = useState('new');

  const reviews = store.getEventReviews(eventId);
  const visible = useMemo(() => {
    const list = filter ? reviews.filter((r) => r.rating === filter) : reviews.slice();
    const sorted = list.sort(SORTS[sort].fn);
    // Свой отзыв всегда первым — его чаще всего ищут, чтобы поправить
    const ownIdx = actingVolunteer ? sorted.findIndex((r) => r.volonteerId === actingVolunteer.id) : -1;
    if (ownIdx > 0) sorted.unshift(sorted.splice(ownIdx, 1)[0]);
    return sorted;
  }, [reviews, filter, sort, actingVolunteer]);

  if (!event) return null;

  const startEditing = () => {
    setRating(existing?.rating || 0);
    setText(existing?.text || '');
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await store.saveEventReview({ eventId, volonteerId: actingVolunteer.id, rating, text });
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast(res.updated ? 'Отзыв обновлён' : 'Спасибо! Отзыв опубликован.');
    setEditing(false);
    setFilter(null);
  };

  const remove = async (review) => {
    if (!window.confirm('Удалить отзыв? Действие нельзя отменить.')) return;
    const res = await store.deleteEventReview(review.id);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Отзыв удалён', 'info');
    setEditing(false);
    setRating(0);
    setText('');
  };

  const textLength = text.trim().length;

  let composer = null;
  if (editing && actingVolunteer) {
    composer = (
      <form className="rv-composer" onSubmit={submit}>
        <div className="rv-composer-head">
          <h4>{existing ? 'Редактирование отзыва' : 'Как прошло мероприятие?'}</h4>
          <span className="muted small">Отзыв увидят все посетители сайта</span>
        </div>
        <RatingPicker value={rating} onChange={setRating} />
        <label className="rv-composer-field">
          <span className="visually-hidden">Текст отзыва</span>
          <textarea
            className="form-textarea"
            value={text}
            maxLength={MAX_REVIEW_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что понравилось, что стоит улучшить: организация, задачи, инструктаж, атмосфера…"
            rows={4}
            required
          />
          <span className={`rv-counter ${textLength > 0 && textLength < 10 ? 'warn' : ''}`}>
            {textLength < 10 ? `Ещё ${10 - textLength} симв. минимум` : `${text.length} / ${MAX_REVIEW_LENGTH}`}
          </span>
        </label>
        <div className="rv-composer-actions">
          {existing && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(existing)}>
              <Icon name="trash" /> Удалить
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Отмена</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!rating || textLength < 10}>
            {existing ? 'Сохранить' : 'Опубликовать'}
          </button>
        </div>
      </form>
    );
  } else if (!user) {
    composer = (
      <div className="rv-cta">
        <Icon name="message" />
        <span>Участвовали? Войдите, чтобы поделиться впечатлениями.</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('login')}>Войти</button>
      </div>
    );
  } else if (actingVolunteer && eligibility?.allowed) {
    composer = (
      <div className="rv-cta rv-cta-accent">
        <Icon name="star" />
        <span>{existing ? 'Ваш отзыв опубликован. Его можно изменить.' : 'Вы участвовали в этом мероприятии. Расскажите, как всё прошло.'}</span>
        <button type="button" className="btn btn-accent btn-sm" onClick={startEditing}>
          {existing ? 'Изменить отзыв' : 'Оставить отзыв'}
        </button>
      </div>
    );
  } else if (actingVolunteer && eligibility && !eligibility.allowed) {
    composer = <div className="rv-cta rv-cta-muted"><Icon name="info" /><span>{eligibility.reason}</span></div>;
  }

  return (
    <Modal
      title="Отзывы участников"
      subtitle={`${event.title}, ${formatDate(event.startDate)}`}
      icon="message"
      size="lg"
      onClose={onClose}
    >
      <div className="modal-body rv-body">
        <ReviewSummary reviews={reviews} avg={event.ratingAvg} filter={filter} onFilter={setFilter} />

        {composer}

        {reviews.length > 0 && (
          <div className="rv-toolbar">
            <span className="rv-toolbar-count">
              {filter ? (
                <button type="button" className="rv-filter-chip" onClick={() => setFilter(null)} aria-label="Сбросить фильтр">
                  Оценка {filter} <Icon name="cross" />
                </button>
              ) : 'Все отзывы'}
            </span>
            <label className="rv-sort">
              <span className="visually-hidden">Сортировка</span>
              <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="rv-empty">
            <Icon name="message" size={28} />
            <strong>Отзывов пока нет</strong>
            <span>{event.status === 'CLOSED' ? 'Участники ещё не поделились впечатлениями.' : 'Отзывы появятся после проведения мероприятия.'}</span>
          </div>
        ) : (
          <div className="rv-list">
            {visible.map((r) => {
              const own = Boolean(actingVolunteer && r.volonteerId === actingVolunteer.id);
              let actions = null;
              if (own && !editing) actions = <button type="button" className="link-btn" onClick={startEditing}>Изменить</button>;
              else if (user?.role === 'ADMIN' && !own) {
                actions = <button type="button" className="link-btn danger" onClick={() => remove(r)}><Icon name="trash" /> Удалить</button>;
              }
              return <ReviewCard key={r.id} review={r} own={own} actions={actions} />;
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
