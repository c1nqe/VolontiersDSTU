import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { MAX_MARKER_PHOTOS } from '../store/DataStore.js';

/**
 * Создание метки на карте. Для поисково-спасательной операции можно
 * прикрепить до 5 фотографий: снимки пропавшего, одежды, места последнего
 * появления — они видны поисковикам в карточке метки.
 */
export default function AddMarkerModal({ onClose, lat, lng, onCreated }) {
  const store = useStore();
  const { showToast } = useUI();
  const [f, setF] = useState({
    type: 'SEARCH_RESCUE',
    title: '',
    description: '',
    lat: lat ?? 47.231,
    lng: lng ?? 39.715,
    urgency: 'HIGH',
    contactPhone: '',
    lastSeenDate: '',
    lastSeenLocation: '',
  });
  const [photos, setPhotos] = useState([]);
  const bind = (k) => ({ value: f[k], onChange: (e) => setF((s) => ({ ...s, [k]: e.target.value })) });
  const isRescue = f.type === 'SEARCH_RESCUE';

  const submit = () => {
    const res = store.addMapMarker({
      type: f.type,
      title: f.title.trim(),
      description: f.description.trim(),
      lat: parseFloat(f.lat),
      lng: parseFloat(f.lng),
      urgency: f.urgency,
      contactPhone: f.contactPhone,
      lastSeenDate: isRescue ? f.lastSeenDate || null : null,
      lastSeenLocation: isRescue ? f.lastSeenLocation || null : null,
      photos: isRescue ? photos : [],
    });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    const photoNote = isRescue && photos.length ? ` с ${photos.length} фото` : '';
    showToast(`${isRescue ? 'Поисковая метка' : 'Метка'} «${res.marker.title}» размещена${photoNote}.`);
    onClose();
    onCreated?.(res.marker);
  };

  return (
    <ModalForm
      title="Новая метка на карте"
      icon="mapPin"
      onClose={onClose}
      onSubmit={submit}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary"><Icon name="plus" /> Разместить метку</button>
        </>
      )}
    >
      <span className="form-label">Категория *</span>
      <div className="segmented" role="radiogroup" aria-label="Категория метки">
        <button type="button" role="radio" aria-checked={isRescue} className={`segmented-item rescue ${isRescue ? 'active' : ''}`} onClick={() => setF((s) => ({ ...s, type: 'SEARCH_RESCUE', urgency: 'HIGH' }))}>
          <span className="color-dot color-dot-rescue" /> Поиск человека (ПСО)
        </button>
        <button type="button" role="radio" aria-checked={!isRescue} className={`segmented-item regular ${!isRescue ? 'active' : ''}`} onClick={() => setF((s) => ({ ...s, type: 'REGULAR', urgency: 'MEDIUM' }))}>
          <span className="color-dot color-dot-regular" /> Волонтёрская помощь
        </button>
      </div>

      <Field label="Заголовок" required>
        <input className="form-input" required maxLength={120} placeholder={isRescue ? 'Поиск: Иванов И. И., 65 лет' : 'Помощь пожилым: разнос продуктов'} {...bind('title')} />
      </Field>
      <Field label="Подробное описание" required>
        <textarea className="form-textarea" required placeholder={isRescue ? 'Приметы, одежда, обстоятельства исчезновения…' : 'Что нужно сделать, сколько людей требуется…'} {...bind('description')} />
      </Field>

      {isRescue && (
        <div className="form-group">
          <span className="form-label">Фотографии для поисковиков</span>
          <PhotoUploader
            photos={photos}
            onChange={setPhotos}
            max={MAX_MARKER_PHOTOS}
            prompt="Добавьте фото пропавшего, его одежды или места, где его видели"
            hint={`Перетащите файлы или нажмите, чтобы выбрать. До ${MAX_MARKER_PHOTOS} снимков, JPG, PNG или WebP`}
          />
        </div>
      )}

      <div className="form-row">
        <Field label="Широта" required><input type="number" className="form-input" step="0.0001" required {...bind('lat')} /></Field>
        <Field label="Долгота" required><input type="number" className="form-input" step="0.0001" required {...bind('lng')} /></Field>
      </div>
      <p className="form-hint form-hint-icon"><Icon name="map" /> Координаты подставляются автоматически, если нажать на нужную точку карты.</p>

      <div className="form-row">
        <Field label="Срочность" required>
          <select className="form-select" {...bind('urgency')}>
            <option value="HIGH">Высокая (срочно)</option>
            <option value="MEDIUM">Средняя</option>
            <option value="LOW">Низкая</option>
          </select>
        </Field>
        <Field label="Контактный телефон"><input type="tel" className="form-input" placeholder="+7 (999) 000-00-00" {...bind('contactPhone')} /></Field>
      </div>

      {isRescue && (
        <div className="form-row">
          <Field label="Дата последнего появления"><input type="date" className="form-input" {...bind('lastSeenDate')} /></Field>
          <Field label="Место последнего появления"><input className="form-input" placeholder="Адрес или ориентир" {...bind('lastSeenLocation')} /></Field>
        </div>
      )}
    </ModalForm>
  );
}
