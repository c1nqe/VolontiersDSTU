import { Suspense, lazy } from 'react';
import { useUI } from '../components/UIContext.jsx';

// Модальные окна нужны не на каждом визите — загружаем их при первом открытии.
const REGISTRY = {
  login: lazy(() => import('./AuthModals.jsx').then((m) => ({ default: m.LoginModal }))),
  register: lazy(() => import('./AuthModals.jsx').then((m) => ({ default: m.RegisterModal }))),
  profile: lazy(() => import('./ProfileModal.jsx')),
  createEvent: lazy(() => import('./CreateEventModal.jsx')),
  addMarker: lazy(() => import('./AddMarkerModal.jsx')),
  closeSearch: lazy(() => import('./CloseSearchMarkerModal.jsx')),
  reviews: lazy(() => import('./EventReviewsModal.jsx')),
};

/** Рендерит текущее модальное окно. Одновременно открыто не больше одного. */
export default function ModalRoot({ onAuthenticated, onLogout }) {
  const { modal, closeModal } = useUI();
  if (!modal) return null;
  const Component = REGISTRY[modal.name];
  if (!Component) return null;
  return (
    <Suspense fallback={<div className="modal-overlay"><div className="page-loader-spinner" aria-label="Загрузка" /></div>}>
      <Component
        key={`${modal.name}-${JSON.stringify(modal.props, (k, v) => (typeof v === 'function' ? undefined : v))}`}
        {...modal.props}
        onClose={closeModal}
        onAuthenticated={onAuthenticated}
        onLogout={onLogout}
      />
    </Suspense>
  );
}
