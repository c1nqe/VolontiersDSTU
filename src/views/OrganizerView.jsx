import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, StatCard, StatsGrid, Tabs } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { REQUEST_STATUS, formatDate } from '../utils/format.js';

const ORG_EVENT_LABEL = {
  CREATED: 'Ожидает модерации',
  ACCEPTED: 'Одобрено, идёт набор',
  CLOSED: 'Событие закрыто',
  CANCELLED: 'Отменено',
};

export default function OrganizerView() {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [tab, setTab] = useState('events');
  const [hoursDraft, setHoursDraft] = useState({});

  const org = store.getActiveOrg();
  if (!org) return null;

  const myEvents = store.getEvents().filter((e) => e.organizationId === org.id);
  const myEventIds = new Set(myEvents.map((e) => e.id));
  const myRequests = store.getRequests().filter((r) => myEventIds.has(r.eventId));
  const pending = myRequests.filter((r) => r.status === 'PENDING');
  const approved = myRequests.filter((r) => r.status === 'ACCEPTED' || r.status === 'CONFIRMED');
  const confirmedHours = myRequests.filter((r) => r.status === 'CONFIRMED').reduce((s, r) => s + (Number(r.confirmedHours) || 0), 0);
  const reviewsTotal = myEvents.reduce((s, e) => s + e.reviewsCount, 0);

  const closeEvent = (evt) => {
    if (!window.confirm('Закрыть событие? После закрытия волонтёры смогут получить выписку о часах и оставить отзыв.')) return;
    store.updateEventStatus(evt.id, 'CLOSED');
    showToast('Событие закрыто. Участники могут оставить отзывы.');
  };

  const confirmWork = (req) => {
    const hours = Number(hoursDraft[req.id] ?? req.requestedHours) || 0;
    if (hours <= 0) {
      showToast('Укажите корректное количество отработанных часов', 'error');
      return;
    }
    store.confirmRequestHours(req.id, hours);
    showToast(`Факт работы подтверждён: начислено ${hours} ч.`);
  };

  const tabs = [
    { id: 'events', label: 'Мои события', icon: 'calendar' },
    { id: 'requests', label: 'Заявки волонтёров', icon: 'users', count: pending.length },
    { id: 'confirm', label: 'Подтверждение часов', icon: 'clock' },
  ];

  return (
    <div className="role-view">
      <StatsGrid>
        <StatCard label="Мои события" value={myEvents.length} sub="Создано организацией" />
        <StatCard label="Входящие заявки" value={pending.length} tone="warning" sub="Ожидают вашего решения" />
        <StatCard label="Одобрено волонтёров" value={approved.length} sub="Готовы к работе" />
        <StatCard label="Подтверждено часов" value={`${confirmedHours} ч`} tone="accent" sub={`Отзывов о ваших событиях: ${reviewsTotal}`} />
      </StatsGrid>

      <div className="tabs-with-action">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <button type="button" className="btn btn-primary" onClick={() => openModal('createEvent')}>
          <Icon name="plus" /> Создать событие
        </button>
      </div>

      {tab === 'events' && (myEvents.length === 0 ? (
        <EmptyState icon="fileText" title="У вашей организации пока нет событий">Нажмите «Создать событие», чтобы открыть набор волонтёров.</EmptyState>
      ) : (
        <div className="cards-grid">
          {myEvents.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              showOrg={false}
              meta="organizer"
              statusLabel={ORG_EVENT_LABEL[evt.status]}
              footerInfo={`Заявок: ${evt.requestsCount}`}
              onShowReviews={(e) => openModal('reviews', { eventId: e.id })}
              actions={
                evt.status === 'ACCEPTED' ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => closeEvent(evt)}>Закрыть событие</button>
                ) : evt.status === 'CLOSED' ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal('reviews', { eventId: evt.id })}>
                    <Icon name="message" /> Отзывы ({evt.reviewsCount})
                  </button>
                ) : evt.status === 'CREATED' ? (
                  <span className="text-warning">На модерации</span>
                ) : null
              }
            />
          ))}
        </div>
      ))}

      {tab === 'requests' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Событие</th><th>Волонтёр</th><th>Факультет</th><th>Дата подачи</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {myRequests.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">Заявок от волонтёров пока нет</td></tr>
              ) : myRequests.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.eventTitle}</strong></td>
                  <td><strong>{r.volonteerName}</strong></td>
                  <td>{r.volonteerFaculty}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td><span className={`badge ${REQUEST_STATUS[r.status].badge}`}>{REQUEST_STATUS[r.status].label}</span></td>
                  <td>
                    {r.status === 'PENDING' ? (
                      <div className="btn-row">
                        <button type="button" className="btn btn-accent btn-sm" onClick={() => { store.updateRequestStatus(r.id, 'ACCEPTED'); showToast('Заявка волонтёра принята!'); }}>Принять</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => { store.updateRequestStatus(r.id, 'CANCELLED'); showToast('Заявка отклонена', 'error'); }}>Отклонить</button>
                      </div>
                    ) : r.status === 'ACCEPTED' ? (
                      <span className="text-info">Ожидает подтверждения часов</span>
                    ) : (
                      <span className="muted">Обработано</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'confirm' && (
        <>
          <p className="section-note">
            Здесь отображаются принятые волонтёры (статус <strong>ACCEPTED</strong>). Подтвердите факт их работы по итогам события, указав фактические часы.
          </p>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Событие</th><th>Волонтёр</th><th>План</th><th>Статус</th><th>Подтвердить часы</th></tr></thead>
              <tbody>
                {approved.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Нет волонтёров, ожидающих подтверждения часов</td></tr>
                ) : approved.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.eventTitle}</strong><div className="cell-sub">Статус события: {r.eventStatus}</div></td>
                    <td><strong>{r.volonteerName}</strong><div className="cell-sub">{r.volonteerStudentId}</div></td>
                    <td>{r.requestedHours} ч</td>
                    <td>
                      <span className={`badge ${r.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-accepted'}`}>
                        {r.status === 'CONFIRMED' ? `Подтверждено (${r.confirmedHours} ч)` : 'Одобрен к работе'}
                      </span>
                    </td>
                    <td>
                      {r.status === 'ACCEPTED' ? (
                        <div className="btn-row">
                          <input
                            type="number"
                            className="form-input input-hours"
                            min="0.5"
                            step="0.5"
                            aria-label="Отработанные часы"
                            value={hoursDraft[r.id] ?? r.requestedHours}
                            onChange={(e) => setHoursDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                          />
                          <button type="button" className="btn btn-accent btn-sm" onClick={() => confirmWork(r)}>
                            <Icon name="check" /> Подтвердить
                          </button>
                        </div>
                      ) : (
                        <span className="text-success"><Icon name="check" /> Часы начислены</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
