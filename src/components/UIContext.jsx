import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import Icon from './Icon.jsx';

const UIContext = createContext(null);

/**
 * Общие для всего приложения элементы интерфейса:
 * всплывающие уведомления, модальные окна и просмотрщик фотографий.
 */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // { name, props }
  const [lightbox, setLightbox] = useState(null); // { photos, index, title, caption }
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'success') => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  const openModal = useCallback((name, props = {}) => setModal({ name, props }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const openLightbox = useCallback((photos, options = {}) => {
    const list = (Array.isArray(photos) ? photos : [photos]).filter(Boolean);
    if (list.length === 0) return;
    setLightbox({ photos: list, index: options.index || 0, title: options.title || '', caption: options.caption || '' });
  }, []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const value = useMemo(() => ({
    showToast, modal, openModal, closeModal, lightbox, openLightbox, closeLightbox, setLightbox,
  }), [showToast, modal, openModal, closeModal, lightbox, openLightbox, closeLightbox]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              layout
              className={`toast ${t.type}`}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 34 } }}
              exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.18 } }}
            >
              <Icon name={t.type === 'success' ? 'check' : t.type === 'error' ? 'cross' : 'info'} />
              <span>{t.message}</span>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI должен использоваться внутри UIProvider');
  return ctx;
}
