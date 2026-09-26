import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { compressImage } from '../utils/image.js';
import { useUI } from './UIContext.jsx';

/**
 * Загрузка фотографий: выбор файлов, перетаскивание, вставка из буфера,
 * превью с удалением. Снимки сжимаются перед сохранением.
 *
 * photos   — массив data URL (или ссылок)
 * onChange — (nextPhotos) => void
 * max      — максимум фото (1 — режим одиночного снимка)
 */
export default function PhotoUploader({ photos, onChange, max = 5, hint, prompt, invalid = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const { showToast, openLightbox } = useUI();
  const remaining = max - photos.length;
  const single = max === 1;

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    const allowed = single ? files.slice(0, 1) : files.slice(0, Math.max(0, remaining));
    if (!single && files.length > remaining) {
      showToast(`Можно прикрепить не больше ${max} фото — лишние файлы пропущены.`, 'info');
    }
    setBusy(true);
    const results = [];
    for (const file of allowed) {
      try {
        results.push(await compressImage(file));
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    setBusy(false);
    if (results.length) onChange(single ? results.slice(0, 1) : [...photos, ...results].slice(0, max));
    if (inputRef.current) inputRef.current.value = '';
  }

  const removeAt = (idx) => onChange(photos.filter((_, i) => i !== idx));

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); },
    onPaste: (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) { e.preventDefault(); addFiles(files); }
    },
  };

  const canAddMore = single ? photos.length === 0 : remaining > 0;

  return (
    <div className="photo-uploader" {...dropProps}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={!single}
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <div className={`photo-grid ${single ? 'photo-grid-single' : ''}`}>
          {photos.map((src, idx) => (
            <figure key={`${idx}-${src.slice(-24)}`} className="photo-thumb">
              <button
                type="button"
                className="photo-thumb-open"
                onClick={() => openLightbox(photos, { index: idx, title: 'Предпросмотр фото' })}
                aria-label={`Открыть фото ${idx + 1}`}
              >
                <img src={src} alt={`Прикреплённое фото ${idx + 1}`} />
              </button>
              <button type="button" className="photo-thumb-remove" onClick={() => removeAt(idx)} aria-label={`Удалить фото ${idx + 1}`}>
                <Icon name="cross" />
              </button>
              {idx === 0 && !single && <figcaption>Обложка</figcaption>}
            </figure>
          ))}
          {!single && canAddMore && (
            <button type="button" className="photo-thumb photo-thumb-add" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Icon name="plus" size={22} />
              <span>Ещё фото</span>
            </button>
          )}
        </div>
      )}

      {photos.length === 0 && (
        <button
          type="button"
          className={`photo-upload-zone ${dragOver ? 'dragover' : ''} ${invalid ? 'invalid' : ''}`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Icon name={busy ? 'refresh' : 'upload'} size={28} className={busy ? 'spin' : ''} />
          <strong>{busy ? 'Обрабатываем снимки…' : (prompt || 'Выберите фото или перетащите их сюда')}</strong>
          <span>{hint || `JPG, PNG или WebP, до ${max} ${single ? 'снимка' : 'снимков'}`}</span>
        </button>
      )}

      {single && photos.length > 0 && (
        <div className="photo-single-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="refresh" /> Заменить фото
          </button>
        </div>
      )}

      {!single && photos.length > 0 && (
        <p className="form-hint">Прикреплено {photos.length} из {max}. Первое фото показывается на карте как обложка.</p>
      )}
    </div>
  );
}
