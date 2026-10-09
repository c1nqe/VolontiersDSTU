import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

/** Завершение ПСО: фотоотчёт и рапорт уходят администратору на согласование. */
export default function CloseSearchMarkerModal({ onClose, markerId, targetStatus = 'FOUND' }) {
  const store = useStore();
  const { showToast } = useUI();
  const marker = store.getMarker(markerId);
  const [status, setStatus] = useState(targetStatus);
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [triedSubmit, setTriedSubmit] = useState(false);
  if (!marker) return null;

  const submit = async () => {
    setTriedSubmit(true);
    if (!photos[0]) { showToast('Прикрепите подтверждающую фотографию', 'error'); return; }
    const res = await store.requestMarkerClose(markerId, { photo: photos[0], note: note.trim(), targetStatus: status });
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Отчёт с фото направлен администратору. После одобрения метка и фото будут удалены.');
    onClose();
  };

  return (
    <ModalForm
      title="Завершение поисково-спасательной работы"
      subtitle="Отчёт с фото будет направлен администратору на согласование"
      icon="camera"
      iconTone="danger"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary"><Icon name="check" /> Отправить на согласование</button>
        </>
      )}
    >
      <div className="marker-target-card">
        <span className="legend-chip rescue"><span className="color-dot color-dot-rescue" /> ПСО</span>
        <div>
          <div className="strong">{marker.title}</div>
          <div className="muted small">
            {marker.lastSeenLocation && <>Последнее место: <strong>{marker.lastSeenLocation}</strong>. </>}
            Координаты: {Number(marker.lat).toFixed(4)}, {Number(marker.lng).toFixed(4)}
          </div>
        </div>
      </div>

      <Field label="Результат операции" required>
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="FOUND">Человек найден (жив), операция завершена</option>
          <option value="CLOSED">Поиск прекращён</option>
        </select>
      </Field>

      <div className="form-group">
        <span className="form-label">Подтверждающее фото с места операции *</span>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          max={1}
          invalid={triedSubmit && !photos[0]}
          prompt="Выберите снимок с камеры или из галереи"
          hint="JPG, PNG или WebP — фотофиксация завершения поиска"
        />
      </div>

      <Field label="Обстоятельства обнаружения / рапорт" required>
        <textarea className="form-textarea" rows={3} required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Где и кем найден человек, состояние здоровья, кому передан…" />
      </Field>
    </ModalForm>
  );
}
