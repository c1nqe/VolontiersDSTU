import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { formatDate } from '../utils/format.js';

const ROLE_BADGE = {
  ADMIN: { cls: 'badge-accepted', label: 'Администратор сервиса' },
  ORGANIZER: { cls: 'badge-confirmed', label: 'Организатор событий' },
  VOLUNTEER: { cls: 'badge-pending', label: 'Волонтёр ДГТУ' },
};

export default function ProfileModal({ onClose, onLogout }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [exporting, setExporting] = useState(false);
  const user = store.getCurrentUser();
  if (!user) return null;

  const downloadData = async () => {
    setExporting(true);
    const res = await store.exportMyData();
    setExporting(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    const url = URL.createObjectURL(new Blob([res.json], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Файл с вашими данными скачан.');
  };

  const badge = ROLE_BADGE[user.role] || ROLE_BADGE.VOLUNTEER;
  const expires = store.getSessionExpiry();

  let details;
  if (user.role === 'VOLUNTEER') {
    const vol = store.getActiveVolunteer();
    details = (
      <div className="info-panel">
        <div className="info-panel-title">Электронная волонтёрская книжка</div>
        <div className="info-grid">
          <div><strong>Студенческий билет:</strong> {vol?.studentId}</div>
          <div><strong>Факультет:</strong> {vol?.faculty}</div>
          <div><strong>Подтверждённых часов:</strong> <span className="tone-accent strong">{vol?.totalConfirmedHours} ч</span></div>
          <div><strong>Отзывов оставлено:</strong> {store.getAllReviews().filter((r) => r.volonteerId === vol?.id).length}</div>
        </div>
      </div>
    );
  } else if (user.role === 'ORGANIZER') {
    const org = store.getActiveOrg();
    const orgEvents = store.getEvents().filter((e) => e.organizationId === org?.id);
    details = (
      <div className="info-panel">
        <div className="info-panel-title">Профиль организации</div>
        <div className="info-grid">
          <div><strong>Организация:</strong> {org?.name}</div>
          <div><strong>Контактное лицо:</strong> {org?.contactPerson}</div>
          <div><strong>ИНН:</strong> {org?.inn || '—'}</div>
          <div><strong>Создано событий:</strong> {orgEvents.length}</div>
        </div>
      </div>
    );
  } else {
    details = (
      <div className="info-panel">
        <div className="info-panel-title">Полномочия администратора</div>
        <p>Модерация событий и отзывов, согласование фотоотчётов ПСО, регистрация организаций и волонтёров, экспорт выписок.</p>
      </div>
    );
  }

  return (
    <Modal
      title="Личный кабинет"
      icon="user"
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => { onClose(); onLogout(); }}>
            <Icon name="logout" /> Выйти из аккаунта
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>Закрыть</button>
        </>
      )}
    >
      <div className="modal-body">
        <div className="profile-hero">
          <div className="avatar-circle lg">{(user.firstName[0] + user.lastName[0]).toUpperCase()}</div>
          <div className="profile-hero-info">
            <h4>{user.lastName} {user.firstName}</h4>
            <p>{user.email}</p>
            <div className="row-gap">
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
              <span className="muted small">Зарегистрирован: {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>

        {details}

        <div className="info-panel">
          <div className="info-panel-title"><Icon name="lock" /> Безопасность сессии</div>
          <div className="info-grid">
            <div><strong>Действует до:</strong> {expires ? new Date(expires).toLocaleString('ru-RU') : '—'}</div>
            <div><strong>Хранение токена:</strong> HttpOnly-cookie (недоступна скриптам страницы)</div>
            <div><strong>Пароль:</strong> на сервере хранится только хэш Argon2id</div>
            <div><strong>Выход:</strong> завершает сессию на всех устройствах</div>
          </div>
          <div className="btn-row-wrap" style={{ marginTop: '0.7rem' }}>
            {user.role === 'VOLUNTEER' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal('editProfile')}>
                <Icon name="user" /> Редактировать профиль
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal('changePassword')}>
              <Icon name="lock" /> Сменить пароль
            </button>
          </div>
        </div>

        <div className="info-panel">
          <div className="info-panel-title"><Icon name="shield" /> Мои данные и приватность</div>
          <div className="info-grid">
            <div><strong>Согласие на обработку данных:</strong> {user.consentAcceptedAt ? `${formatDate(user.consentAcceptedAt)} (политика ${user.consentVersion})` : 'не зафиксировано'}</div>
          </div>
          <div className="btn-row-wrap" style={{ marginTop: '0.7rem' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={downloadData} disabled={exporting}>
              <Icon name="download" /> Скачать мои данные
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openModal('privacy')}>
              <Icon name="fileText" /> Политика обработки данных
            </button>
            {user.role !== 'ADMIN' && (
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => openModal('deleteAccount')}>
                <Icon name="cross" /> Удалить аккаунт
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
