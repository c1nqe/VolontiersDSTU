import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { formatDate } from '../utils/format.js';

const ROLE_BADGE = {
  ADMIN: { cls: 'badge-accepted', label: 'Администратор сервиса' },
  ORGANIZER: { cls: 'badge-confirmed', label: 'Организатор событий' },
  VOLUNTEER: { cls: 'badge-pending', label: 'Волонтёр ДГТУ' },
};

export default function ProfileModal({ onClose, onLogout }) {
  const store = useStore();
  const user = store.getCurrentUser();
  if (!user) return null;

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
        </div>
      </div>
    </Modal>
  );
}
