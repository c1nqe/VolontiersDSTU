import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useUI } from './UIContext.jsx';

/** Полноэкранный просмотр фотографий с листанием стрелками. */
export default function PhotoLightbox() {
  const { lightbox, closeLightbox, setLightbox } = useUI();

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!lightbox) return null;
  const { photos, index, title, caption } = lightbox;
  const multiple = photos.length > 1;

  function step(delta) {
    setLightbox((lb) => (lb ? { ...lb, index: (lb.index + delta + lb.photos.length) % lb.photos.length } : lb));
  }

  return createPortal(
    <div className="lightbox-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}>
      <div className="lightbox" role="dialog" aria-modal="true" aria-label={title || 'Просмотр фото'}>
        <div className="lightbox-header">
          <span>{title || 'Фотоматериалы'}{multiple && <span className="lightbox-counter">{index + 1} / {photos.length}</span>}</span>
          <button type="button" onClick={closeLightbox} aria-label="Закрыть просмотр"><Icon name="cross" /></button>
        </div>
        <div className="lightbox-stage">
          {multiple && (
            <button type="button" className="lightbox-nav prev" onClick={() => step(-1)} aria-label="Предыдущее фото">
              <Icon name="chevronLeft" size={26} />
            </button>
          )}
          <img src={photos[index]} alt={title || 'Фото'} />
          {multiple && (
            <button type="button" className="lightbox-nav next" onClick={() => step(1)} aria-label="Следующее фото">
              <Icon name="chevronRight" size={26} />
            </button>
          )}
        </div>
        {multiple && (
          <div className="lightbox-strip">
            {photos.map((src, i) => (
              <button key={i} type="button" className={i === index ? 'active' : ''} onClick={() => setLightbox({ ...lightbox, index: i })}>
                <img src={src} alt={`Миниатюра ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
        {caption && <div className="lightbox-caption">{caption}</div>}
      </div>
    </div>,
    document.body,
  );
}
