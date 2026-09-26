import Icon from './Icon.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from './UIContext.jsx';

const ROLE_CHIP = {
  ADMIN: { badge: 'badge-accepted', label: 'Админ' },
  ORGANIZER: { badge: 'badge-confirmed', label: 'Организатор' },
  VOLUNTEER: { badge: 'badge-pending', label: 'Волонтёр' },
};

export function getNavItems(user) {
  if (!user) {
    return [
      { view: 'PUBLIC', label: 'События', icon: 'calendar' },
      { view: 'MAP', label: 'Карта Ростова', icon: 'map' },
    ];
  }
  if (user.role === 'ADMIN') {
    return [
      { view: 'ADMIN', label: 'Администрирование', icon: 'shield' },
      { view: 'ORGANIZER', label: 'Организатор', icon: 'building' },
      { view: 'VOLUNTEER', label: 'Волонтёр', icon: 'user' },
      { view: 'PUBLIC', label: 'Все события', icon: 'calendar' },
      { view: 'MAP', label: 'Карта', icon: 'map' },
    ];
  }
  if (user.role === 'ORGANIZER') {
    return [
      { view: 'ORGANIZER', label: 'Мои события', icon: 'building' },
      { view: 'PUBLIC', label: 'Все события', icon: 'calendar' },
      { view: 'MAP', label: 'Карта', icon: 'map' },
    ];
  }
  return [
    { view: 'VOLUNTEER', label: 'Мой кабинет', icon: 'user' },
    { view: 'PUBLIC', label: 'События', icon: 'calendar' },
    { view: 'MAP', label: 'Карта', icon: 'map' },
  ];
}

export default function Header({ view, onNavigate, onLogout, onReset }) {
  const store = useStore();
  const { openModal } = useUI();
  const user = store.getCurrentUser();
  const items = getNavItems(user);
  const chip = user ? ROLE_CHIP[user.role] || ROLE_CHIP.VOLUNTEER : null;

  return (
    <header className="app-header no-print">
      <div className="header-container">
        <button type="button" className="brand" onClick={() => onNavigate(user ? user.role : 'PUBLIC')}>
          <span className="brand-icon"><Icon name="heart" size={22} /></span>
          <span className="brand-text">
            <span className="brand-title">Волонтёры ДГТУ</span>
            <span className="brand-badge">Донской государственный технический университет</span>
          </span>
        </button>

        <nav className="role-bar" aria-label="Разделы">
          {items.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`role-btn ${view === item.view ? 'active' : ''}`}
              aria-current={view === item.view ? 'page' : undefined}
              onClick={() => onNavigate(item.view)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <button type="button" className="user-chip" onClick={() => openModal('profile')} title="Открыть личный кабинет">
                <span className="avatar-circle">{(user.firstName[0] + user.lastName[0]).toUpperCase()}</span>
                <span className="user-chip-name">{user.lastName} {user.firstName[0]}.</span>
                <span className={`badge ${chip.badge}`}>{chip.label}</span>
              </button>
              <button type="button" className="btn-secondary-sm" onClick={onLogout} title="Выйти из учётной записи">
                <Icon name="logout" /> <span>Выйти</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('login')}>
                <Icon name="login" /> <span>Войти</span>
              </button>
              <button type="button" className="btn btn-accent btn-sm" onClick={() => openModal('register')}>
                <Icon name="userPlus" /> <span>Регистрация</span>
              </button>
            </>
          )}
          <button type="button" className="btn-icon" onClick={onReset} title="Сбросить к исходным демонстрационным данным" aria-label="Сбросить демо-данные">
            <Icon name="refresh" />
          </button>
        </div>
      </div>
    </header>
  );
}
