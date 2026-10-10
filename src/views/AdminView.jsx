import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, Field, SectionHeader, StatCard, StatsGrid, Tabs } from '../components/Common.jsx';
import { ReviewCard } from '../components/reviews/ReviewParts.jsx';
import { useRun, useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { pluralize } from '../utils/format.js';

const EMPTY_ORG = { name: '', contactPerson: '', inn: '', email: '', phone: '', description: '' };
const EMPTY_VOL = { fullName: '', studentId: '', faculty: '', email: '', phone: '', birthDate: '' };

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (key) => ({ value: values[key], onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })) });
  return { values, bind, reset: () => setValues(initial) };
}

export default function AdminView() {
  const store = useStore();
  const { openModal, openLightbox } = useUI();
  const run = useRun();
  const [tab, setTab] = useState('moderation');
  const orgForm = useForm(EMPTY_ORG);
  const volForm = useForm(EMPTY_VOL);

  const orgs = store.getOrganizations();
  const vols = store.getVolunteers();
  const events = store.getEvents();
  const pendingEvents = events.filter((e) => e.status === 'DRAFT');
  const activeEvents = events.filter((e) => e.status === 'ACCEPTED');
  const pendingMarkers = store.getPendingMarkerApprovals();
  const photoQueue = store.getPhotoQueue();
  const allReviews = store.getAllReviews();
  const eventTitle = (id) => events.find((e) => e.id === id)?.title || 'Мероприятие удалено';

  const tabs = [
    { id: 'moderation', label: 'Модерация событий', icon: 'shield', count: pendingEvents.length },
    { id: 'markers', label: 'Закрытие ПСО', icon: 'camera', count: pendingMarkers.length },
    { id: 'photos', label: 'Фото меток', icon: 'image', count: photoQueue.length },
    { id: 'reviews', label: 'Отзывы', icon: 'message', count: 0 },
    { id: 'reg-org', label: 'Новый организатор', icon: 'building' },
    { id: 'reg-vol', label: 'Новый волонтёр', icon: 'user' },
    { id: 'registry', label: 'Общий реестр', icon: 'fileText' },
  ];

  const approveMarker = (m) => run(store.approveMarkerClose(m.id), 'Завершение поисковой операции одобрено. Метка, фото и отчёт удалены из системы.');

  const rejectMarker = async (m) => {
    const reason = window.prompt('Укажите причину отклонения заявки на закрытие ПСО:', 'Недостаточно подтверждающих материалов / требуется повторный выезд');
    if (reason === null) return;
    await run(store.rejectMarkerClose(m.id, reason), 'Заявка на закрытие отклонена. Метка снова в активном поиске.', 'error');
  };

  const approvePhoto = (p) => run(store.approvePhoto(p.id), 'Фото одобрено и теперь видно на карте.');
  const rejectPhoto = async (p) => {
    const reason = window.prompt('Причина отклонения фото (фото будет удалено):', 'Не соответствует правилам размещения');
    if (reason === null) return;
    await run(store.rejectPhoto(p.id, reason), 'Фото отклонено и удалено.', 'error');
  };

  return (
    <div className="role-view">
      <StatsGrid>
        <StatCard label="Организаций" value={orgs.length} sub="Зарегистрировано в системе" />
        <StatCard label="Волонтёров" value={vols.length} sub="Студентов ДГТУ в базе" />
        <StatCard label="Ожидают модерации" value={pendingEvents.length} tone="warning" sub="События со статусом DRAFT" />
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
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => run(store.moderateEvent(evt.id, 'CANCELLED'), 'Событие отклонено (CANCELLED)', 'error')}>
                        <Icon name="cross" /> Отклонить
                      </button>
                      <button type="button" className="btn btn-accent btn-sm" onClick={() => run(store.moderateEvent(evt.id, 'ACCEPTED'), 'Событие согласовано и доступно волонтёрам.')}>
                        <Icon name="check" /> Согласовать
                      </button>
                    </>
                  )}
                />
              ))}
            </div>
          )}

          {activeEvents.length > 0 && (
            <>
              <SectionHeader title="Согласованные события" description="Принятое событие можно отменить: заявки волонтёров будут отменены автоматически.">
                <span className="badge badge-accepted">{activeEvents.length}</span>
              </SectionHeader>
              <div className="cards-grid">
                {activeEvents.map((evt) => (
                  <EventCard
                    key={evt.id}
                    event={evt}
                    meta="admin"
                    footerInfo={`Заявок: ${evt.requestsCount}`}
                    actions={(
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => openModal('cancelEvent', { eventId: evt.id })}>
                        <Icon name="cross" /> Отменить
                      </button>
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'markers' && (
        <>
          <SectionHeader
            title="Заявки на закрытие поисково-спасательных операций"
            description="Проверьте фотоотчёт поисковой группы. После одобрения метка, фотографии и отчёт удаляются из системы."
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
                      <img loading="lazy" decoding="async" src={proof.photo} alt="Фотоотчёт" className="admin-approval-photo" />
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

      {tab === 'photos' && (
        <>
          <SectionHeader
            title="Фотографии меток на проверке"
            description="Фото к меткам поисково-спасательных операций публикуются только после вашей проверки. Отклонённое фото удаляется без возможности восстановления."
          >
            <span className="badge badge-pending">{photoQueue.length} фото</span>
          </SectionHeader>
          {photoQueue.length === 0 ? (
            <EmptyState icon="check" tone="accent" title="Новых фотографий нет">Все загруженные фото проверены.</EmptyState>
          ) : (
            <div className="cards-grid cards-grid-wide">
              {photoQueue.map((p) => (
                <article key={p.id} className="admin-approval-card" data-testid="photo-queue-item">
                  <button type="button" className="admin-approval-photo-box" onClick={() => openLightbox([p.url], { title: p.markerTitle })}>
                    <img loading="lazy" decoding="async" src={p.url} alt={`Фото к метке «${p.markerTitle}»`} className="admin-approval-photo" />
                    <span className="admin-approval-zoom-hint"><Icon name="search" /> Увеличить фото</span>
                  </button>
                  <div className="admin-approval-content">
                    <h4 className="card-title">{p.markerTitle}</h4>
                    <ul className="meta-list">
                      <li><Icon name="user" /> Загрузил: <strong>{p.uploadedByName || 'аккаунт удалён'}</strong></li>
                    </ul>
                    <div className="admin-approval-actions">
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => rejectPhoto(p)}>
                        <Icon name="cross" /> Отклонить
                      </button>
                      <button type="button" className="btn btn-accent btn-sm grow" onClick={() => approvePhoto(p)}>
                        <Icon name="check" /> Одобрить
                      </button>
                    </div>
                  </div>
                </article>
              ))}
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
            <div className="rv-grid">
              {allReviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  eventTitle={eventTitle(r.eventId)}
                  onEventClick={() => openModal('reviews', { eventId: r.eventId })}
                  actions={(
                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={() => {
                        if (window.confirm('Удалить этот отзыв? Действие нельзя отменить.')) run(store.deleteEventReview(r.id), 'Отзыв удалён', 'info');
                      }}
                    >
                      <Icon name="trash" /> Удалить
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'reg-org' && (
        <form
          className="form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await run(store.addOrganization(orgForm.values), (r) => `Организация «${r.data.name}» зарегистрирована!`);
            if (res.success) orgForm.reset();
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
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await run(store.addVolunteer(volForm.values), (r) => `Волонтёр ${r.data.fullName} зарегистрирован!`);
            if (res.success) volForm.reset();
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
