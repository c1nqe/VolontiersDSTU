import { useCallback, useEffect, useState } from 'react';
import Header, { getNavItems } from './components/Header.jsx';
import PhotoLightbox from './components/PhotoLightbox.jsx';
import { useUI } from './components/UIContext.jsx';
import { useStore } from './store/StoreContext.jsx';
import ContextBanner from './views/ContextBanner.jsx';
import PublicView from './views/PublicView.jsx';
import AdminView from './views/AdminView.jsx';
import OrganizerView from './views/OrganizerView.jsx';
import VolunteerView from './views/VolunteerView.jsx';
import MapView from './views/MapView.jsx';
import ModalRoot from './modals/ModalRoot.jsx';

const VIEWS = {
  PUBLIC: PublicView,
  ADMIN: AdminView,
  ORGANIZER: OrganizerView,
  VOLUNTEER: VolunteerView,
  MAP: MapView,
};

/** Разрешён ли раздел текущему пользователю. */
function isAllowed(user, view) {
  return getNavItems(user).some((item) => item.view === view);
}

export default function App() {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const user = store.getCurrentUser();

  const [view, setViewState] = useState(() => {
    const saved = store.getCurrentRole();
    return isAllowed(store.getCurrentUser(), saved) ? saved : 'PUBLIC';
  });

  const navigate = useCallback((next) => {
    const currentUser = store.getCurrentUser();
    if (!isAllowed(currentUser, next)) {
      if (!currentUser) {
        showToast('Для доступа к кабинету войдите в систему', 'info');
        openModal('login');
      }
      setViewState('PUBLIC');
      return;
    }
    if (next !== 'MAP') store.setCurrentRole(next);
    setViewState(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [store, showToast, openModal]);

  // Если пользователь вышел или сменился, а раздел ему недоступен — возвращаем на витрину
  useEffect(() => {
    if (!isAllowed(user, view)) setViewState('PUBLIC');
  }, [user, view]);

  const logout = () => {
    store.logout();
    showToast('Вы вышли из учётной записи', 'info');
    setViewState('PUBLIC');
  };

  const reset = () => {
    if (!window.confirm('Сбросить все данные к исходным демонстрационным?')) return;
    store.reset();
    setViewState('PUBLIC');
    showToast('Демо-данные восстановлены');
  };

  const View = VIEWS[view] || PublicView;

  return (
    <>
      <Header view={view} onNavigate={navigate} onLogout={logout} onReset={reset} />
      <main className="main-content">
        {view !== 'PUBLIC' && <ContextBanner view={view} />}
        <View />
      </main>
      <footer className="app-footer no-print">
        <div className="footer-inner">
          <span>Волонтёрский центр ДГТУ «Горящие сердца»</span>
          <span>Хакатон ВЕСНА '25. Демо-данные хранятся в вашем браузере</span>
        </div>
      </footer>
      <ModalRoot onAuthenticated={(role) => navigate(role)} onLogout={logout} />
      <PhotoLightbox />
    </>
  );
}
