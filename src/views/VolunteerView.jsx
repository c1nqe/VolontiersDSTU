import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, StatCard, StatsGrid, Tabs } from '../components/Common.jsx';
import { StarDisplay } from '../components/StarRating.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { REQUEST_STATUS, formatDate } from '../utils/format.js';

const MY_REQUEST_LABEL = {
  PENDING: 'На рассмотрении',
  ACCEPTED: 'Одобрена (готовимся)',
  CANCELLED: 'Отклонена организатором',
};

export default function VolunteerView() {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [tab, setTab] = useState('available');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState({ start: '2026-09-01', end: '2026-10-31' });
  const [statementPeriod, setStatementPeriod] = useState(period);

  const vol = store.getActiveVolunteer();
  if (!vol) return null;

  const events = store.getEvents();
  const q = query.toLowerCase().trim();
  const available = events
    .filter((e) => e.status === 'ACCEPTED')
    .filter((e) => !q || [e.title, e.description, e.location, e.organizationName].some((f) => f.toLowerCase().includes(q)));
  const myRequests = store.getRequests().filter((r) => r.volonteerId === vol.id);
  const myReviews = (store.data.eventReviews || []).filter((r) => r.volonteerId === vol.id);
  const reviewable = myRequests.filter((r) => store.canReviewEvent(vol.id, r.eventId).allowed);
  const awaitingReview = reviewable.filter((r) => !myReviews.some((rv) => rv.eventId === r.eventId));

  const report = store.getVolunteerStatement(vol.id, statementPeriod.start, statementPeriod.end);

  const apply = (eventId) => {
    const res = store.submitRequest(vol.id, eventId);
    showToast(res.success ? 'Заявка на участие отправлена организатору!' : res.message, res.success ? 'success' : 'error');
  };

  const tabs = [
    { id: 'available', label: 'Доступные события', icon: 'star' },
    { id: 'requests', label: 'Мои заявки и отзывы', icon: 'fileText', count: awaitingReview.length },
    { id: 'statement', label: 'Выписка о часах', icon: 'award' },
  ];

  return (
    <div className="role-view">
      <StatsGrid>
        <StatCard label="Подтверждено часов" value={`${vol.totalConfirmedHours} ч`} tone="accent" sub="Официальный стаж ДГТУ" />
        <StatCard label="Мои заявки" value={myRequests.length} sub="Всего подано" />
        <StatCard label="Одобренные события" value={myRequests.filter((r) => r.status === 'ACCEPTED').length} sub="Предстоящие мероприятия" />
        <StatCard label="Мои отзывы" value={myReviews.length} sub={awaitingReview.length ? `Ждут вашего отзыва: ${awaitingReview.length}` : 'Спасибо за обратную связь'} />
      </StatsGrid>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'available' && (
        <>
          <div className="toolbar no-print">
            <div className="search-box">
              <Icon name="search" className="search-icon" />
              <input type="search" className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск событий по названию или месту…" aria-label="Поиск событий" />
            </div>
            <span className="muted small">Показаны события, прошедшие модерацию администратора</span>
          </div>
          {available.length === 0 ? (
            <EmptyState icon="search" title="Доступных событий не найдено">Измените запрос или дождитесь публикации новых событий.</EmptyState>
          ) : (
            <div className="cards-grid">
              {available.map((evt) => {
                const req = myRequests.find((r) => r.eventId === evt.id);
                const labels = { PENDING: 'Заявка на рассмотрении', ACCEPTED: 'Вы приняты', CONFIRMED: `Часы подтверждены (${req?.confirmedHours} ч)`, CANCELLED: 'Заявка отклонена' };
                return (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    footerInfo={<><Icon name="check" /> Одобрено: {evt.approvedVolunteersCount || 0}</>}
                    onShowReviews={(e) => openModal('reviews', { eventId: e.id })}
                    actions={req ? (
                      <span className={`badge ${REQUEST_STATUS[req.status].badge}`}>{labels[req.status]}</span>
                    ) : (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(evt.id)}>Подать заявку</button>
                    )}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Событие</th><th>Организатор</th><th>Дата</th><th>Часы</th><th>Статус</th><th>Отзыв</th></tr></thead>
            <tbody>
              {myRequests.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">Вы пока не подавали заявок на участие</td></tr>
              ) : myRequests.map((r) => {
                const check = store.canReviewEvent(vol.id, r.eventId);
                const mine = myReviews.find((rv) => rv.eventId === r.eventId);
                return (
                  <tr key={r.id}>
                    <td><strong>{r.eventTitle}</strong></td>
                    <td>{r.organizationName}</td>
                    <td>{formatDate(r.eventDate)}</td>
                    <td><strong>{r.status === 'CONFIRMED' ? r.confirmedHours : r.requestedHours} ч</strong></td>
                    <td>
                      <span className={`badge ${REQUEST_STATUS[r.status].badge}`}>
                        {r.status === 'CONFIRMED' ? `Подтверждено (${r.confirmedHours} ч)` : MY_REQUEST_LABEL[r.status]}
                      </span>
                    </td>
                    <td>
                      {mine ? (
                        <div className="review-cell">
                          <StarDisplay value={mine.rating} size={14} />
                          <button type="button" className="link-btn" onClick={() => openModal('reviews', { eventId: r.eventId, compose: true })}>Изменить</button>
                        </div>
                      ) : check.allowed ? (
                        <button type="button" className="btn btn-accent btn-sm" onClick={() => openModal('reviews', { eventId: r.eventId, compose: true })}>
                          <Icon name="star" /> Оставить отзыв
                        </button>
                      ) : (
                        <span className="muted small" title={check.reason}>После участия</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'statement' && (
        <>
          <form
            className="form-card form-card-wide no-print"
            onSubmit={(e) => {
              e.preventDefault();
              setStatementPeriod(period);
              showToast('Выписка об отработанных часах сформирована!');
            }}
          >
            <h3 className="form-card-title">Формирование официальной выписки</h3>
            <p className="form-card-desc">
              В выписку включаются только закрытые мероприятия (<strong>Event = CLOSED</strong>) с подтверждённым фактом работы (<strong>CONFIRMED</strong>).
            </p>
            <div className="form-row form-row-actions">
              <label className="form-group">
                <span className="form-label">С даты</span>
                <input type="date" className="form-input" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">По дату</span>
                <input type="date" className="form-input" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
              </label>
              <div className="form-group btn-row">
                <button type="submit" className="btn btn-primary">Сформировать</button>
                <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                  <Icon name="printer" /> Печать / PDF
                </button>
              </div>
            </div>
          </form>

          {!report || report.items.length === 0 ? (
            <EmptyState icon="fileText" title="Нет закрытых событий с подтверждёнными часами за этот период">
              В выписку попадают события со статусом CLOSED, где организатор подтвердил факт работы.
            </EmptyState>
          ) : (
            <div className="statement-card">
              <div className="statement-header">
                <div className="statement-eyebrow">Донской государственный технический университет</div>
                <h2>Выписка об отработанных часах добровольца</h2>
                <p>Справка о подтверждённой волонтёрской деятельности в закрытых событиях</p>
              </div>
              <div className="statement-details">
                <div>
                  <div className="statement-detail-item"><strong>Волонтёр:</strong> {report.volunteer.fullName}</div>
                  <div className="statement-detail-item"><strong>Студенческий билет:</strong> {report.volunteer.studentId || 'Не указан'}</div>
                  <div className="statement-detail-item"><strong>Факультет:</strong> {report.volunteer.faculty || 'ДГТУ'}</div>
                </div>
                <div>
                  <div className="statement-detail-item"><strong>Период:</strong> с {formatDate(report.startDate)} по {formatDate(report.endDate)}</div>
                  <div className="statement-detail-item"><strong>Дата формирования:</strong> {report.generatedAt}</div>
                  <div className="statement-detail-item"><strong>Закрытых событий:</strong> {report.items.length}</div>
                </div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>№</th><th>Мероприятие</th><th>Организатор</th><th>Дата</th><th>Часы</th></tr></thead>
                  <tbody>
                    {report.items.map((item, idx) => (
                      <tr key={`${item.eventName}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td><strong>{item.eventName}</strong><div className="cell-sub">{item.location}</div></td>
                        <td>{item.organizationName}</td>
                        <td>{formatDate(item.eventDate)}</td>
                        <td><strong className="tone-accent">{item.confirmedHours} ч</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="statement-total-banner">
                <div>
                  <strong>Итого подтверждённых часов за период</strong>
                  <div className="small">Учитывается при начислении повышенной стипендии и в портфолио</div>
                </div>
                <div className="statement-total-val">{report.totalHours} ч</div>
              </div>
              <div className="statement-stamp">
                <div>
                  <div className="muted small">Координатор волонтёрского центра ДГТУ:</div>
                  <div className="statement-sign">/ Смирнова Е. П. / ___________________</div>
                </div>
                <div className="stamp-box">ВОЛОНТЁРСКИЙ ЦЕНТР<br />ДГТУ «ГОРЯЩИЕ СЕРДЦА»<br />ПОДТВЕРЖДЕНО</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
