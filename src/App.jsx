import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import Header, { getNavItems } from './components/Header.jsx';
import PhotoLightbox from './components/PhotoLightbox.jsx';
import { useUI } from './components/UIContext.jsx';
import { useStore } from './store/StoreContext.jsx';
import ContextBanner from './views/ContextBanner.jsx';
import PublicView from './views/PublicView.jsx';
import ModalRoot from './modals/ModalRoot.jsx';
import PageLoader from './components/PageLoader.jsx';
import { EmptyState } from './components/Common.jsx';

// Витрина грузится сразу (её видит каждый гость), кабинеты и карта — по требованию.
// Карта тянет Leaflet (~150 КБ), поэтому вынесена в отдельный чанк.
const loadAdmin = () => import('./views/AdminView.jsx');
const loadOrganizer = () => import('./views/OrganizerView.jsx');
const loadVolunteer = () => import('./views/VolunteerView.jsx');
const loadMap = () => import('./views/MapView.jsx');
const AdminView = lazy(loadAdmin);
const OrganizerView = lazy(loadOrganizer);
const VolunteerView = lazy(loadVolunteer);
const MapView = lazy(loadMap);

/** Предзагрузка чанка при наведении на пункт меню — переход ощущается мгновенным. */
export const PRELOAD = { ADMIN: loadAdmin, ORGANIZER: loadOrganizer, VOLUNTEER: loadVolunteer, MAP: loadMap };

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

  const [view, setViewState] = useState('PUBLIC');

  // Когда сервер ответил в первый раз, возвращаем пользователя в раздел, где он был (если он ему доступен)
  const restored = useRef(false);
  useEffect(() => {
    if (store.status !== 'ready' || restored.current) return;
    restored.current = true;
    const saved = store.getCurrentRole();
    if (isAllowed(store.getCurrentUser(), saved)) setViewState(saved);
  }, [store, store.status, user]);

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

  const logout = async () => {
    await store.logout();
    showToast('Вы вышли из учётной записи', 'info');
    setViewState('PUBLIC');
  };

  const View = VIEWS[view] || PublicView;

  return (
    <>
      <Header view={view} onNavigate={navigate} onLogout={logout} onPreload={(v) => PRELOAD[v]?.()} />
      <main className="main-content" id="main">
        {store.status === 'error' ? (
          <EmptyState icon="cross" title="Сервер недоступен">
            <p>{store.error || 'Не удалось получить данные.'}</p>
            <button type="button" className="btn btn-primary" onClick={() => store.init()}>Повторить попытку</button>
          </EmptyState>
        ) : store.status !== 'ready' ? (
          <PageLoader />
        ) : (
          <>
            {view !== 'PUBLIC' && <ContextBanner view={view} />}
            <Suspense fallback={<PageLoader />}>
              <View />
            </Suspense>
          </>
        )}
      </main>
      <footer className="app-footer no-print">
        <div className="footer-inner">
          <span>Волонтёрский центр ДГТУ «Горящие сердца»</span>
          <span>Хакатон ВЕСНА '25. Данные хранятся на сервере в PostgreSQL</span>
        </div>
      </footer>
      <ModalRoot onAuthenticated={(role) => navigate(role)} onLogout={logout} />
      <PhotoLightbox />
    </>
  );
}
