import { useUI } from '../components/UIContext.jsx';
import { LoginModal, RegisterModal } from './AuthModals.jsx';
import ProfileModal from './ProfileModal.jsx';
import CreateEventModal from './CreateEventModal.jsx';
import AddMarkerModal from './AddMarkerModal.jsx';
import CloseSearchMarkerModal from './CloseSearchMarkerModal.jsx';
import EventReviewsModal from './EventReviewsModal.jsx';

const REGISTRY = {
  login: LoginModal,
  register: RegisterModal,
  profile: ProfileModal,
  createEvent: CreateEventModal,
  addMarker: AddMarkerModal,
  closeSearch: CloseSearchMarkerModal,
  reviews: EventReviewsModal,
};

/** Рендерит текущее модальное окно. Одновременно открыто не больше одного. */
export default function ModalRoot({ onAuthenticated, onLogout }) {
  const { modal, closeModal } = useUI();
  if (!modal) return null;
  const Component = REGISTRY[modal.name];
  if (!Component) return null;
  return (
    <Component
      key={`${modal.name}-${JSON.stringify(modal.props, (k, v) => (typeof v === 'function' ? undefined : v))}`}
      {...modal.props}
      onClose={closeModal}
      onAuthenticated={onAuthenticated}
      onLogout={onLogout}
    />
  );
}
