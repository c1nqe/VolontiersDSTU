import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, SectionHeader } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { REQUEST_STATUS, pluralize } from '../utils/format.js';

const matches = (e, q) => !q || [e.title, e.description, e.location, e.organizationName]
  .some((field) => (field || '').toLowerCase().includes(q));

export default function PublicView() {
  const store = useStore();
  const { openModal, showToast } = useUI();
  const [query, setQuery] = useState('');
  const user = store.getCurrentUser();
  const volunteer = user?.role === 'VOLUNTEER' ? store.getActiveVolunteer() : null;
  const myRequests = volunteer ? store.getRequests().filter((r) => r.volonteerId === volunteer.id) : [];

  const events = store.getEvents();
  const accepted = events.filter((e) => e.status === 'ACCEPTED');
  const closed = events.filter((e) => e.status === 'CLOSED');
  const q = query.toLowerCase().trim();
  const filtered = accepted.filter((e) => matches(e, q));
  const filteredClosed = closed.filter((e) => matches(e, q));
  const totalHours = accepted.reduce((acc, e) => acc + (e.plannedHours || 0), 0);

  const apply = (eventId) => {
    if (!user) {
      showToast('Для подачи заявки войдите в систему или зарегистрируйтесь', 'info');
      openModal('login');
      return;
    }
    const res = store.submitRequest(volunteer.id, eventId);
    showToast(res.success ? 'Заявка на участие отправлена организатору!' : res.message, res.success ? 'success' : 'error');
  };

  const actionFor = (evt) => {
    if (!user) return <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(evt.id)}>Подать заявку</button>;
    if (user.role !== 'VOLUNTEER') return <span className="badge badge-accepted">Активно</span>;
    const req = myRequests.find((r) => r.eventId === evt.id);
    if (!req) return <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(evt.id)}>Подать заявку</button>;
    const labels = { ACCEPTED: 'Вы приняты!', CONFIRMED: `Часы: ${req.confirmedHours} ч`, CANCELLED: 'Отклонена', PENDING: 'Заявка на рассмотрении' };
    return <span className={`badge ${REQUEST_STATUS[req.status].badge}`}>{labels[req.status]}</span>;
  };

  return (
    <div className="role-view">
      <section className="guest-hero-banner">
        <div className="hero-content">
          <div className="hero-badge"><Icon name="shield" /> <span>Волонтёрский центр ДГТУ «Горящие сердца»</span></div>
          <h2 className="hero-title">Делай добрые дела вместе с опорным университетом</h2>
          <p className="hero-subtitle">
            Единая платформа волонтёрских событий, спасательных операций и верифицированного учёта часов для портфолио и повышенной стипендии.
          </p>
          {!user && (
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={() => openModal('register')}>
                <Icon name="userPlus" /> Стать волонтёром
              </button>
              <button type="button" className="btn btn-ghost-light" onClick={() => openModal('login')}>
                <Icon name="login" /> Войти в кабинет
              </button>
            </div>
          )}
        </div>
        <div className="hero-stats">
          <div className="hero-stat-item"><span className="stat-number">{accepted.length}</span><span className="stat-caption">Активных событий</span></div>
          <div className="hero-stat-item"><span className="stat-number">1 200+</span><span className="stat-caption">Волонтёров ДГТУ</span></div>
          <div className="hero-stat-item"><span className="stat-number">14</span><span className="stat-caption">Организаций</span></div>
          <div className="hero-stat-item"><span className="stat-number">{totalHours}+ ч</span><span className="stat-caption">Часов помощи</span></div>
        </div>
      </section>

      <div className="toolbar no-print">
        <div className="search-box">
          <Icon name="search" className="search-icon" />
          <input
            type="search"
            className="form-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, организации или месту…"
            aria-label="Поиск мероприятий"
          />
        </div>
        <span className="badge badge-accepted">
          {filtered.length} {pluralize(filtered.length, 'доступное событие', 'доступных события', 'доступных событий')}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="Событий не найдено">Попробуйте изменить поисковый запрос или загляните позже.</EmptyState>
      ) : (
        <div className="cards-grid">
          {filtered.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              footerInfo={<><Icon name="check" /> Одобрено: {evt.approvedVolunteersCount || 0}</>}
              actions={actionFor(evt)}
              onShowReviews={(e) => openModal('reviews', { eventId: e.id })}
            />
          ))}
        </div>
      )}

      {filteredClosed.length > 0 && (
        <section className="page-section">
          <SectionHeader
            title="Прошедшие мероприятия"
            description="Отзывы участников помогают организаторам делать события лучше, а новичкам — выбрать своё."
          />
          <div className="cards-grid">
            {filteredClosed.map((evt) => (
              <EventCard
                key={evt.id}
                event={evt}
                footerInfo={<><Icon name="users" /> Участвовали: {evt.approvedVolunteersCount || 0}</>}
                actions={(
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal('reviews', { eventId: evt.id })}>
                    <Icon name="message" /> Отзывы
                  </button>
                )}
                onShowReviews={(e) => openModal('reviews', { eventId: e.id })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
