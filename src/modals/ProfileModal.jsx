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
  const { showToast } = useUI();
  const user = store.getCurrentUser();
  if (!user) return null;

  const badge = ROLE_BADGE[user.role] || ROLE_BADGE.VOLUNTEER;
  const token = store.getJWTToken() || '';
  const parts = token.split('.');
  const decoded = store.getDecodedJWT();

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
          <div><strong>Отзывов оставлено:</strong> {(store.data.eventReviews || []).filter((r) => r.volonteerId === vol?.id).length}</div>
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

        <div className="jwt-inspector">
          <div className="jwt-header-bar">
            <span className="jwt-title"><Icon name="lock" /> JWT-токен сессии (RFC 7519)</span>
            <button
              type="button"
              className="jwt-copy"
              onClick={() => navigator.clipboard?.writeText(token).then(() => showToast('JWT-токен скопирован')).catch(() => showToast('Не удалось скопировать токен', 'error'))}
            >
              <Icon name="copy" /> Скопировать
            </button>
          </div>
          <p className="jwt-legend">
            Структура: <span className="jwt-part-header">Header</span>.<span className="jwt-part-payload">Payload</span>.<span className="jwt-part-signature">Signature</span>
          </p>
          <div className="jwt-token-raw">
            {parts.length === 3 ? (
              <><span className="jwt-part-header">{parts[0]}</span>.<span className="jwt-part-payload">{parts[1]}</span>.<span className="jwt-part-signature">{parts[2]}</span></>
            ) : token}
          </div>
          <p className="jwt-legend">Декодированная полезная нагрузка:</p>
          <pre className="jwt-decoded-view">{decoded ? JSON.stringify({ header: decoded.header, payload: decoded.payload }, null, 2) : 'Токен отсутствует'}</pre>
        </div>
      </div>
    </Modal>
  );
}
