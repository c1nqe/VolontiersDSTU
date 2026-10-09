import { useLayoutEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from './UIContext.jsx';

const ROLE_CHIP = {
  ADMIN: { badge: 'badge-accepted', label: 'Админ' },
  ORGANIZER: { badge: 'badge-confirmed', label: 'Организатор' },
  VOLUNTEER: { badge: 'badge-pending', label: 'Волонтёр' },
};

/** Пункты меню для роли. short — подпись в нижней панели на телефоне. */
export function getNavItems(user) {
  if (!user) {
    return [
      { view: 'PUBLIC', label: 'События', short: 'События', icon: 'calendar' },
      { view: 'MAP', label: 'Карта Ростова', short: 'Карта', icon: 'map' },
    ];
  }
  if (user.role === 'ADMIN') {
    return [
      { view: 'ADMIN', label: 'Администрирование', short: 'Админ', icon: 'shield' },
      { view: 'ORGANIZER', label: 'Организатор', short: 'Орг.', icon: 'building' },
      { view: 'VOLUNTEER', label: 'Волонтёр', short: 'Волонтёр', icon: 'user' },
      { view: 'PUBLIC', label: 'Все события', short: 'События', icon: 'calendar' },
      { view: 'MAP', label: 'Карта', short: 'Карта', icon: 'map' },
    ];
  }
  if (user.role === 'ORGANIZER') {
    return [
      { view: 'ORGANIZER', label: 'Мои события', short: 'Кабинет', icon: 'building' },
      { view: 'PUBLIC', label: 'Все события', short: 'События', icon: 'calendar' },
      { view: 'MAP', label: 'Карта', short: 'Карта', icon: 'map' },
    ];
  }
  return [
    { view: 'VOLUNTEER', label: 'Мой кабинет', short: 'Кабинет', icon: 'user' },
    { view: 'PUBLIC', label: 'События', short: 'События', icon: 'calendar' },
    { view: 'MAP', label: 'Карта', short: 'Карта', icon: 'map' },
  ];
}

const MODES = ['full', 'compact', 'stacked'];

/**
 * Подбирает раскладку шапки по фактической ширине содержимого:
 * full → compact (без имени в плашке) → stacked (меню второй строкой).
 * Работает без лишних перерисовок React: режим пишется в data-атрибут.
 */
function useHeaderFit(containerRef, deps) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const nav = el.querySelector('.role-bar');

    const overflows = () => {
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 0;
      const content = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const brand = el.querySelector('.brand');
      const actions = el.querySelector('.header-actions');
      // Меню в нижней панели (телефон) не участвует в раскладке шапки
      const navInFlow = nav && getComputedStyle(nav).position !== 'fixed';
      const needed = brand.offsetWidth + actions.offsetWidth + gap + (navInFlow ? nav.scrollWidth + gap : 0);
      return needed > content + 0.5;
    };

    const fit = () => {
      for (const mode of MODES) {
        el.dataset.mode = mode;
        if (mode === 'stacked' || !overflows()) break;
      }
    };

    // Слушаем окно, а не сам контейнер: смена режима меняет высоту шапки,
    // и ResizeObserver на ней самой зациклился бы.
    let frame = 0;
    const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Header({ view, onNavigate, onLogout, onPreload }) {
  const store = useStore();
  const { openModal } = useUI();
  const containerRef = useRef(null);
  const user = store.getCurrentUser();
  const items = getNavItems(user);
  const chip = user ? ROLE_CHIP[user.role] || ROLE_CHIP.VOLUNTEER : null;

  useHeaderFit(containerRef, [user?.id, items.length]);

  // Активный пункт всегда в зоне видимости, если меню прокручивается
  useLayoutEffect(() => {
    const nav = containerRef.current?.querySelector('.role-bar');
    const btn = nav?.querySelector('.role-btn.active');
    if (nav && btn && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, btn.offsetLeft - nav.offsetLeft - 16);
    }
  }, [view]);

  return (
    <header className="app-header no-print">
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <div className="header-container" ref={containerRef} data-mode="full">
        <button type="button" className="brand" onClick={() => onNavigate(user ? user.role : 'PUBLIC')} title="Волонтёры ДГТУ — на главную">
          <span className="brand-icon"><Icon name="heart" size={22} /></span>
          <span className="brand-text">
            <span className="brand-title">Волонтёры ДГТУ</span>
            <span className="brand-badge">Донской государственный технический университет</span>
          </span>
        </button>

        <nav className="role-bar" aria-label="Разделы" data-count={items.length}>
          {items.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`role-btn ${view === item.view ? 'active' : ''}`}
              aria-current={view === item.view ? 'page' : undefined}
              onClick={() => onNavigate(item.view)}
              onPointerEnter={() => onPreload?.(item.view)}
              onFocus={() => onPreload?.(item.view)}
            >
              <Icon name={item.icon} />
              <span className="role-btn-label">{item.label}</span>
              <span className="role-btn-short" aria-hidden="true">{item.short}</span>
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <button type="button" className="user-chip" onClick={() => openModal('profile')} title={`${user.lastName} ${user.firstName}: личный кабинет`}>
                <span className="avatar-circle">{(user.firstName[0] + user.lastName[0]).toUpperCase()}</span>
                <span className="user-chip-name">{user.lastName} {user.firstName[0]}.</span>
                <span className={`badge ${chip.badge}`}>{chip.label}</span>
              </button>
              <button type="button" className="btn-icon" onClick={onLogout} title="Выйти из учётной записи" aria-label="Выйти">
                <Icon name="logout" />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('login')}>
                <Icon name="login" /> <span>Войти</span>
              </button>
              <button type="button" className="btn btn-accent btn-sm header-register" onClick={() => openModal('register')}>
                <Icon name="userPlus" /> <span>Регистрация</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
