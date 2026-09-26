import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, Field, SectionHeader, StatCard, StatsGrid, Tabs } from '../components/Common.jsx';
import { StarDisplay } from '../components/StarRating.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { formatDate, pluralize } from '../utils/format.js';

const EMPTY_ORG = { name: '', contactPerson: '', inn: '', email: '', phone: '', description: '' };
const EMPTY_VOL = { fullName: '', studentId: '', faculty: '', email: '', phone: '', birthDate: '' };

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (key) => ({ value: values[key], onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })) });
  return { values, bind, reset: () => setValues(initial) };
}

export default function AdminView() {
  const store = useStore();
  const { showToast, openModal, openLightbox } = useUI();
  const [tab, setTab] = useState('moderation');
  const orgForm = useForm(EMPTY_ORG);
  const volForm = useForm(EMPTY_VOL);

  const orgs = store.getOrganizations();
  const vols = store.getVolunteers();
  const events = store.getEvents();
  const pendingEvents = events.filter((e) => e.status === 'CREATED');
  const pendingMarkers = store.getPendingMarkerApprovals();
  const allReviews = (store.data.eventReviews || []).slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const eventTitle = (id) => events.find((e) => e.id === id)?.title || 'Мероприятие удалено';
  const admin = store.getCurrentUser();

  const tabs = [
    { id: 'moderation', label: 'Модерация событий', icon: 'shield', count: pendingEvents.length },
    { id: 'markers', label: 'Закрытие ПСО', icon: 'camera', count: pendingMarkers.length },
    { id: 'reviews', label: 'Отзывы', icon: 'message' },
    { id: 'reg-org', label: 'Новый организатор', icon: 'building' },
    { id: 'reg-vol', label: 'Новый волонтёр', icon: 'user' },
    { id: 'registry', label: 'Общий реестр', icon: 'fileText' },
  ];

  const approveMarker = (m) => {
    store.approveMarkerClose(m.id, admin?.id || 'adm-1', admin ? `${admin.firstName} ${admin.lastName}` : 'Администратор сервиса');
    showToast('Завершение поисковой операции одобрено, статус метки обновлён.');
  };

  const rejectMarker = (m) => {
    const reason = window.prompt('Укажите причину отклонения заявки на закрытие ПСО:', 'Недостаточно подтверждающих материалов / требуется повторный выезд');
    if (reason === null) return;
    store.rejectMarkerClose(m.id, reason);
    showToast('Заявка на закрытие отклонена. Метка снова в активном поиске.', 'error');
  };

  return (
    <div className="role-view">
      <StatsGrid>
        <StatCard label="Организаций" value={orgs.length} sub="Зарегистрировано в системе" />
        <StatCard label="Волонтёров" value={vols.length} sub="Студентов ДГТУ в базе" />
        <StatCard label="Ожидают модерации" value={pendingEvents.length} tone="warning" sub="События со статусом CREATED" />
        <StatCard label="Всего событий" value={events.length} sub="Одобрено, закрыто или отменено" />
      </StatsGrid>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'moderation' && (
        <>
          <SectionHeader title="Заявки на проведение событий">
            <span className="badge badge-created">{pendingEvents.length} на рассмотрении</span>
          </SectionHeader>
          {pendingEvents.length === 0 ? (
            <EmptyState icon="check" tone="accent" title="Все события согласованы">В очереди нет новых событий, ожидающих решения администратора.</EmptyState>
          ) : (
            <div className="cards-grid">
              {pendingEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  meta="admin"
                  actions={(
                    <>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => { store.updateEventStatus(evt.id, 'CANCELLED'); showToast('Событие отклонено (CANCELLED)', 'error'); }}>
                        <Icon name="cross" /> Отклонить
                      </button>
                      <button type="button" className="btn btn-accent btn-sm" onClick={() => { store.updateEventStatus(evt.id, 'ACCEPTED'); showToast('Событие согласовано и доступно волонтёрам.'); }}>
                        <Icon name="check" /> Согласовать
                      </button>
                    </>
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'markers' && (
        <>
          <SectionHeader
            title="Заявки на закрытие поисково-спасательных операций"
            description="Проверьте фотоотчёт поисковой группы, прежде чем менять статус на «Найден»."
          >
            <span className="badge badge-pending">{pendingMarkers.length} {pluralize(pendingMarkers.length, 'заявка', 'заявки', 'заявок')}</span>
          </SectionHeader>
          {pendingMarkers.length === 0 ? (
            <EmptyState icon="check" tone="accent" title="Все заявки на закрытие ПСО рассмотрены">Нет операций, ожидающих решения администратора.</EmptyState>
          ) : (
            <div className="cards-grid cards-grid-wide">
              {pendingMarkers.map((m) => {
                const proof = m.closureProof || {};
                return (
                  <article key={m.id} className="admin-approval-card">
                    <button
                      type="button"
                      className="admin-approval-photo-box"
                      onClick={() => openLightbox([proof.photo, ...(m.photos || [])], { title: m.title, caption: proof.note })}
                    >
                      <img src={proof.photo} alt="Фотоотчёт" className="admin-approval-photo" />
                      <span className="admin-approval-zoom-hint"><Icon name="search" /> Увеличить фото</span>
                    </button>
                    <div className="admin-approval-content">
                      <div className="row-between">
                        <span className="badge badge-pending">На согласовании</span>
                        <span className="urgency-badge urgency-high">ПСО</span>
                      </div>
                      <h4 className="card-title">{m.title}</h4>
                      <ul className="meta-list">
                        <li><Icon name="mapPin" /> {m.lastSeenLocation || `${m.lat}, ${m.lng}`}</li>
                        <li><Icon name="user" /> Подал: <strong>{proof.submittedByName || m.createdByName}</strong></li>
                        <li><Icon name="award" /> Итог: <strong>{proof.targetStatus === 'CLOSED' ? 'Поиск прекращён' : 'Человек найден (жив)'}</strong></li>
                        {m.photos?.length > 0 && <li><Icon name="image" /> Фото при создании метки: {m.photos.length}</li>}
                      </ul>
                      <div className="admin-approval-report">
                        <strong>Рапорт поисковой группы</strong>
                        {proof.note || 'Комментарий не указан'}
                      </div>
                      <div className="admin-approval-actions">
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => rejectMarker(m)}>
                          <Icon name="cross" /> Отклонить
                        </button>
                        <button type="button" className="btn btn-accent btn-sm grow" onClick={() => approveMarker(m)}>
                          <Icon name="check" /> Одобрить
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'reviews' && (
        <>
          <SectionHeader title="Отзывы о мероприятиях" description="Удаляйте отзывы, нарушающие правила сообщества: оскорбления, спам, персональные данные." />
          {allReviews.length === 0 ? (
            <EmptyState icon="message" title="Отзывов пока нет">Они появятся, когда участники закрытых мероприятий поделятся впечатлениями.</EmptyState>
          ) : (
            <div className="review-list">
              {allReviews.map((r) => (
                <article key={r.id} className="review-item">
                  <div className="review-item-head">
                    <div>
                      <button type="button" className="link-btn" onClick={() => openModal('reviews', { eventId: r.eventId })}>{eventTitle(r.eventId)}</button>
                      <div className="review-author">{r.authorName}, {formatDate(r.createdAt)}</div>
                    </div>
                    <StarDisplay value={r.rating} />
                  </div>
                  <p className="review-text">{r.text}</p>
                  <div className="review-item-actions">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => {
                        if (window.confirm('Удалить этот отзыв? Действие нельзя отменить.')) {
                          store.deleteEventReview(r.id);
                          showToast('Отзыв удалён', 'info');
                        }
                      }}
                    >
                      <Icon name="trash" /> Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'reg-org' && (
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            const org = store.addOrganization(orgForm.values);
            showToast(`Организация «${org.name}» зарегистрирована!`);
            orgForm.reset();
          }}
        >
          <h3 className="form-card-title">Регистрация новой организации</h3>
          <Field label="Наименование организации / центра" required>
            <input className="form-input" required placeholder="Например: Волонтёрский отряд факультета ИВТ" {...orgForm.bind('name')} />
          </Field>
          <div className="form-row">
            <Field label="Контактное лицо" required><input className="form-input" required placeholder="ФИО координатора" {...orgForm.bind('contactPerson')} /></Field>
            <Field label="ИНН / ОГРН"><input className="form-input" placeholder="6165033140" {...orgForm.bind('inn')} /></Field>
          </div>
          <div className="form-row">
            <Field label="Email для связи" required><input type="email" className="form-input" required placeholder="volunteers@donstu.ru" {...orgForm.bind('email')} /></Field>
            <Field label="Телефон" required><input type="tel" className="form-input" required placeholder="+7 (863) 273-84-00" {...orgForm.bind('phone')} /></Field>
          </div>
          <Field label="Краткое описание деятельности">
            <textarea className="form-textarea" placeholder="Направления работы, аудитория, ключевые проекты…" {...orgForm.bind('description')} />
          </Field>
          <div className="form-actions"><button type="submit" className="btn btn-primary">Зарегистрировать организатора</button></div>
        </form>
      )}

      {tab === 'reg-vol' && (
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            const vol = store.addVolunteer(volForm.values);
            showToast(`Волонтёр ${vol.fullName} зарегистрирован!`);
            volForm.reset();
          }}
        >
          <h3 className="form-card-title">Регистрация нового волонтёра</h3>
          <Field label="ФИО волонтёра полностью" required>
            <input className="form-input" required placeholder="Николаев Максим Сергеевич" {...volForm.bind('fullName')} />
          </Field>
          <div className="form-row">
            <Field label="Номер студенческого билета"><input className="form-input" placeholder="СТ-2024-5510" {...volForm.bind('studentId')} /></Field>
            <Field label="Факультет / институт ДГТУ" required><input className="form-input" required placeholder="Информатика и ВТ" {...volForm.bind('faculty')} /></Field>
          </div>
          <div className="form-row">
            <Field label="Email" required><input type="email" className="form-input" required placeholder="m.nikolaev@edu.donstu.ru" {...volForm.bind('email')} /></Field>
            <Field label="Телефон" required><input type="tel" className="form-input" required placeholder="+7 (999) 000-11-22" {...volForm.bind('phone')} /></Field>
          </div>
          <Field label="Дата рождения"><input type="date" className="form-input" {...volForm.bind('birthDate')} /></Field>
          <div className="form-actions"><button type="submit" className="btn btn-accent">Зарегистрировать волонтёра</button></div>
        </form>
      )}

      {tab === 'registry' && (
        <>
          <SectionHeader title="Организаторы в системе" />
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Организация</th><th>Контактное лицо</th><th>Контакты</th><th>ИНН</th></tr></thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.name}</strong><div className="cell-sub">{o.description}</div></td>
                    <td>{o.contactPerson}</td>
                    <td><div className="cell-icon"><Icon name="mail" /> {o.email}</div><div className="cell-icon"><Icon name="phone" /> {o.phone}</div></td>
                    <td>{o.inn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionHeader title="Волонтёры в системе" />
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>ФИО</th><th>Студ. билет</th><th>Факультет</th><th>Контакты</th><th>Подтверждено</th></tr></thead>
              <tbody>
                {vols.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.fullName}</strong></td>
                    <td><code>{v.studentId || '—'}</code></td>
                    <td>{v.faculty || '—'}</td>
                    <td><div className="cell-icon"><Icon name="mail" /> {v.email}</div><div className="cell-icon"><Icon name="phone" /> {v.phone}</div></td>
                    <td><strong className="tone-accent">{v.totalConfirmedHours} ч</strong></td>
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
