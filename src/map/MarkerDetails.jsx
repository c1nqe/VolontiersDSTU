import Icon from '../components/Icon.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { MARKER_STATUS, URGENCY, formatDate } from '../utils/format.js';

/**
 * Содержимое всплывающей карточки метки на карте:
 * описание, фото с места ПСО, фотоотчёт о закрытии и действия.
 */
export default function MarkerDetails({ marker, onAfterAction }) {
  const store = useStore();
  const { openModal, openLightbox, showToast } = useUI();
  const status = MARKER_STATUS[marker.status] || MARKER_STATUS.ACTIVE;
  const urgency = URGENCY[marker.urgency] || URGENCY.LOW;
  const isRescue = marker.type === 'SEARCH_RESCUE';
  const photos = marker.photos || [];
  const proof = marker.closureProof;

  const requireAuth = () => {
    if (store.getCurrentUser()) return true;
    showToast('Чтобы изменить статус метки, войдите в систему', 'info');
    openModal('login');
    return false;
  };

  const finishRescue = (targetStatus) => {
    if (!requireAuth()) return;
    openModal('closeSearch', { markerId: marker.id, targetStatus });
    onAfterAction?.();
  };

  const closeRegular = () => {
    if (!requireAuth()) return;
    store.updateMarkerStatus(marker.id, 'CLOSED');
    showToast('Метка закрыта.');
    onAfterAction?.();
  };

  return (
    <div className="map-popup">
      <div className="row-between">
        <span className="map-popup-status" style={{ color: status.color }}>{status.label}</span>
        <span className={`urgency-badge ${urgency.className}`}>{urgency.label}</span>
      </div>
      <h4>{marker.title}</h4>

      {photos.length > 0 && (
        <div className="popup-gallery">
          <button type="button" className="popup-gallery-cover" onClick={() => openLightbox(photos, { title: marker.title, caption: marker.description })}>
            <img src={photos[0]} alt={`Фото: ${marker.title}`} />
            {photos.length > 1 && <span className="popup-gallery-count"><Icon name="image" /> {photos.length}</span>}
          </button>
          {photos.length > 1 && (
            <div className="popup-gallery-strip">
              {photos.slice(1, 4).map((src, i) => (
                <button key={i} type="button" onClick={() => openLightbox(photos, { index: i + 1, title: marker.title, caption: marker.description })}>
                  <img src={src} alt={`Фото ${i + 2}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p>{marker.description}</p>
      {marker.lastSeenLocation && (
        <div className="popup-last-seen"><strong>Последнее место:</strong> {marker.lastSeenLocation} ({marker.lastSeenDate ? formatDate(marker.lastSeenDate) : 'н/д'})</div>
      )}

      {proof?.photo && (
        <div className="popup-proof">
          <div className="popup-proof-title"><Icon name="camera" /> Фотоотчёт о завершении</div>
          <button type="button" className="popup-proof-photo" onClick={() => openLightbox(proof.photo, { title: marker.title, caption: proof.note })}>
            <img src={proof.photo} alt="Фотоотчёт" />
          </button>
          {proof.note && <div className="popup-proof-note">«{proof.note}»</div>}
        </div>
      )}

      <div className="map-popup-meta">
        <span className={`legend-chip ${isRescue ? 'rescue' : 'regular'}`}>
          <span className={`color-dot ${isRescue ? 'color-dot-rescue' : 'color-dot-regular'}`} />
          {isRescue ? 'Поисково-спасательная' : 'Волонтёрская'}
        </span>
        <div><Icon name="phone" /> {marker.contactPhone || 'Не указан'}</div>
        <div><Icon name="user" /> {marker.createdByName}, {formatDate(marker.createdAt)}</div>
      </div>

      {marker.status === 'ACTIVE' && (isRescue ? (
        <div className="map-popup-actions">
          <button type="button" className="btn btn-accent btn-sm grow" onClick={() => finishRescue('FOUND')}>
            <Icon name="camera" /> Завершить с фото
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => finishRescue('CLOSED')}>Прекратить</button>
        </div>
      ) : (
        <div className="map-popup-actions">
          <button type="button" className="btn btn-outline btn-sm grow" onClick={closeRegular}>Закрыть метку</button>
        </div>
      ))}
      {marker.status === 'PENDING_APPROVAL' && (
        <div className="popup-pending"><Icon name="clock" /> Фотоотчёт у администратора на согласовании</div>
      )}
    </div>
  );
}
