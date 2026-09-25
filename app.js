/**
 * VolontiersDSTU — Основная логика приложения
 * Хакатон ВЕСНА '25 | ДГТУ
 */

document.addEventListener('DOMContentLoaded', () => {
  const store = window.appStore;

  // SVG Icon helper set (vector icons instead of emojis)
  const ICONS = {
    calendar: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    clock: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    mapPin: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    users: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    user: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    building: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path></svg>`,
    shield: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    map: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>`,
    check: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    award: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`,
    search: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    lock: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    logout: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    plus: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    cross: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    camera: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
    image: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
    upload: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    refresh: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
    copy: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    mail: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    phone: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    printer: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
    fileText: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    sparkles: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
  };

  // DOM Elements
  const roleSelector = document.getElementById('roleSelector');
  const viewPublic = document.getElementById('viewPublic');
  const viewAdmin = document.getElementById('viewAdmin');
  const viewOrganizer = document.getElementById('viewOrganizer');
  const viewVolunteer = document.getElementById('viewVolunteer');
  const viewMap = document.getElementById('viewMap');
  
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerDesc = document.getElementById('bannerDesc');
  const contextControls = document.getElementById('contextControls');
  const toastContainer = document.getElementById('toastContainer');
  const authHeaderArea = document.getElementById('authHeaderArea');

  // Modals
  const modalCreateEvent = document.getElementById('modalCreateEvent');
  const btnOpenCreateEventModal = document.getElementById('btnOpenCreateEventModal');
  const modalAddMarker = document.getElementById('modalAddMarker');
  const btnOpenAddMarkerModal = document.getElementById('btnOpenAddMarkerModal');
  const modalLogin = document.getElementById('modalLogin');
  const modalRegister = document.getElementById('modalRegister');
  const modalProfile = document.getElementById('modalProfile');

  // Map state
  let leafletMap = null;
  let mapMarkerLayer = null;
  let currentMapFilter = 'ALL';

  // ==========================================
  // 1. Toast Notifications
  // ==========================================
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? ICONS.check : type === 'error' ? ICONS.cross : ICONS.lock;
    toast.innerHTML = `<span style="display: flex; align-items: center;">${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================
  // 2. Role Switching & Dynamic Navigation
  // ==========================================
  function renderRoleSelector(activeRole) {
    if (!roleSelector) return;
    const user = store.getCurrentUser();

    let items = [];
    if (!user) {
      // Unauthenticated guest: Only Public Events and Map
      items = [
        { role: 'PUBLIC', label: 'События', icon: ICONS.calendar },
        { role: 'MAP', label: 'Карта Ростова', icon: ICONS.map }
      ];
    } else if (user.role === 'ADMIN') {
      items = [
        { role: 'ADMIN', label: 'Администрирование', icon: ICONS.shield },
        { role: 'ORGANIZER', label: 'Организатор', icon: ICONS.building },
        { role: 'VOLUNTEER', label: 'Волонтёр', icon: ICONS.user },
        { role: 'PUBLIC', label: 'Все события', icon: ICONS.calendar },
        { role: 'MAP', label: 'Карта', icon: ICONS.map }
      ];
    } else if (user.role === 'ORGANIZER') {
      items = [
        { role: 'ORGANIZER', label: 'Мои события', icon: ICONS.building },
        { role: 'PUBLIC', label: 'Все события', icon: ICONS.calendar },
        { role: 'MAP', label: 'Карта', icon: ICONS.map }
      ];
    } else { // VOLUNTEER
      items = [
        { role: 'VOLUNTEER', label: 'Мой кабинет', icon: ICONS.user },
        { role: 'PUBLIC', label: 'События', icon: ICONS.calendar },
        { role: 'MAP', label: 'Карта', icon: ICONS.map }
      ];
    }

    roleSelector.innerHTML = items.map(item => `
      <button class="role-btn ${item.role === activeRole ? 'active' : ''}" data-role="${item.role}">
        ${item.icon}
        <span>${item.label}</span>
      </button>
    `).join('');

    roleSelector.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => setRole(btn.dataset.role));
    });
  }

  function setRole(role) {
    const user = store.getCurrentUser();

    // Guard: guests can only access PUBLIC and MAP
    if (!user && role !== 'PUBLIC' && role !== 'MAP') {
      showToast('Для доступа к кабинету необходимо авторизоваться', 'info');
      modalLogin.classList.add('open');
      role = 'PUBLIC';
    }

    store.setCurrentRole(role === 'MAP' ? store.getCurrentRole() : role);

    renderRoleSelector(role);

    if (viewPublic) viewPublic.style.display = role === 'PUBLIC' ? 'block' : 'none';
    viewAdmin.style.display = role === 'ADMIN' ? 'block' : 'none';
    viewOrganizer.style.display = role === 'ORGANIZER' ? 'block' : 'none';
    viewVolunteer.style.display = role === 'VOLUNTEER' ? 'block' : 'none';
    viewMap.style.display = role === 'MAP' ? 'block' : 'none';

    updateContextBanner(role);

    if (role === 'MAP') {
      renderMapView();
    } else if (role === 'PUBLIC') {
      renderPublicEventsView();
    } else {
      renderCurrentRoleView();
    }
  }

  function updateContextBanner(role) {
    const banner = document.getElementById('contextBanner');
    if (!banner) return;

    // In PUBLIC mode, hero banner is displayed in viewPublic, so contextBanner is hidden
    if (role === 'PUBLIC') {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';

    if (role === 'ADMIN') {
      bannerTitle.textContent = 'Рабочее место администратора';
      bannerDesc.textContent = 'Регистрация организаторов и волонтёров, согласование и отмена событий';
      contextControls.innerHTML = `
        <span style="font-size: 0.85rem; color: #94a3b8; display: flex; align-items: center; gap: 0.4rem;">
          ${ICONS.shield} Главный координатор ВЦ ДГТУ
        </span>
      `;
    } else if (role === 'ORGANIZER') {
      bannerTitle.textContent = 'Личный кабинет организатора событий';
      bannerDesc.textContent = 'Создание событий, отбор волонтёров и подтверждение часов работы';
      
      const orgs = store.getOrganizations();
      const currentOrg = store.getActiveOrg();
      
      contextControls.innerHTML = `
        <div class="context-selector">
          <label for="selectActiveOrg">Организация:</label>
          <select id="selectActiveOrg">
            ${orgs.map(o => `<option value="${o.id}" ${currentOrg && o.id === currentOrg.id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select>
        </div>
      `;

      const selectOrgEl = document.getElementById('selectActiveOrg');
      if (selectOrgEl) {
        selectOrgEl.addEventListener('change', (e) => {
          store.setActiveOrg(e.target.value);
          showToast(`Выбрана организация: ${store.getActiveOrg().name}`);
          renderOrganizerView();
        });
      }
    } else if (role === 'VOLUNTEER') {
      bannerTitle.textContent = 'Рабочее место волонтёра';
      bannerDesc.textContent = 'Поиск событий, подача заявок и выписка подтверждённых часов';
      
      const vols = store.getVolunteers();
      const currentVol = store.getActiveVolunteer();

      contextControls.innerHTML = `
        <div class="context-selector">
          <label for="selectActiveVol">Профиль:</label>
          <select id="selectActiveVol">
            ${vols.map(v => `<option value="${v.id}" ${currentVol && v.id === currentVol.id ? 'selected' : ''}>${v.fullName}</option>`).join('')}
          </select>
        </div>
      `;

      const selectVolEl = document.getElementById('selectActiveVol');
      if (selectVolEl) {
        selectVolEl.addEventListener('change', (e) => {
          store.setActiveVolunteer(e.target.value);
          showToast(`Выбран волонтёр: ${store.getActiveVolunteer().fullName}`);
          renderVolunteerView();
        });
      }
    } else if (role === 'MAP') {
      bannerTitle.textContent = 'Интерактивная карта волонтёров и поисков';
      bannerDesc.textContent = 'Координация поисково-спасательных операций (ПСО) и точек помощи в г. Ростов-на-Дону';
      contextControls.innerHTML = `
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="badge" style="background: rgba(239,68,68,0.12); color: #dc2626; border: 1px solid rgba(239,68,68,0.25); display: flex; align-items: center; gap: 6px;">
            <span class="color-dot color-dot-rescue"></span> Поисково-спасательные
          </span>
          <span class="badge" style="background: rgba(37,99,235,0.12); color: #2563eb; border: 1px solid rgba(37,99,235,0.25); display: flex; align-items: center; gap: 6px;">
            <span class="color-dot color-dot-regular"></span> Волонтёрская помощь
          </span>
        </div>
      `;
    }
  }

  // Tab switching within each view
  document.querySelectorAll('.tab-navigation .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const container = e.target.closest('.role-view');
      const targetTabId = e.target.dataset.tab;

      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      container.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Hero Section Buttons
  const btnHeroRegister = document.getElementById('btnHeroRegister');
  if (btnHeroRegister) {
    btnHeroRegister.addEventListener('click', () => {
      modalRegister.classList.add('open');
    });
  }
  const btnHeroLogin = document.getElementById('btnHeroLogin');
  if (btnHeroLogin) {
    btnHeroLogin.addEventListener('click', () => {
      modalLogin.classList.add('open');
    });
  }

  // Public Search Filter
  const publicSearchInput = document.getElementById('publicSearchInput');
  if (publicSearchInput) {
    publicSearchInput.addEventListener('input', () => {
      renderPublicEventsView();
    });
  }

  // ==========================================
  // 2.1 PUBLIC EVENTS VIEW IMPLEMENTATION
  // ==========================================
  function renderPublicEventsView() {
    const container = document.getElementById('publicEventsList');
    if (!container) return;

    const allEvents = store.getEvents();
    const acceptedEvents = allEvents.filter(e => e.status === 'ACCEPTED');
    const user = store.getCurrentUser();
    const volunteer = user && user.role === 'VOLUNTEER' ? store.getActiveVolunteer() : null;
    const myRequests = volunteer ? store.getRequests().filter(r => r.volonteerId === volunteer.id) : [];

    // Hero stats
    const statEventsEl = document.getElementById('publicStatEvents');
    if (statEventsEl) statEventsEl.textContent = acceptedEvents.length;
    const statHoursEl = document.getElementById('publicStatHours');
    if (statHoursEl) {
      const totalHours = acceptedEvents.reduce((acc, cur) => acc + (cur.plannedHours || 0), 0);
      statHoursEl.textContent = `${totalHours}+ ч`;
    }

    const searchQuery = (publicSearchInput ? publicSearchInput.value : '').toLowerCase().trim();
    const filteredEvents = acceptedEvents.filter(e =>
      e.title.toLowerCase().includes(searchQuery) ||
      e.description.toLowerCase().includes(searchQuery) ||
      e.location.toLowerCase().includes(searchQuery) ||
      e.organizationName.toLowerCase().includes(searchQuery)
    );

    const countBadge = document.getElementById('publicEventsCount');
    if (countBadge) {
      countBadge.textContent = `${filteredEvents.length} доступных событий`;
    }

    if (filteredEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">${ICONS.search}</div>
          <h4>Событий не найдено</h4>
          <p>Попробуйте изменить поисковый запрос или загляните позже.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredEvents.map(evt => {
      let actionBtnHtml = '';
      if (!user) {
        actionBtnHtml = `
          <button class="btn btn-primary btn-sm btn-guest-apply" data-id="${evt.id}">
            Подать заявку
          </button>
        `;
      } else if (user.role === 'VOLUNTEER') {
        const existingReq = myRequests.find(r => r.eventId === evt.id);
        if (!existingReq) {
          actionBtnHtml = `
            <button class="btn btn-primary btn-sm btn-vol-apply" data-id="${evt.id}">
              Подать заявку
            </button>
          `;
        } else {
          let reqBadge = 'badge-pending';
          let reqText = 'Заявка на рассмотрении';
          if (existingReq.status === 'ACCEPTED') { reqBadge = 'badge-accepted'; reqText = 'Вы приняты!'; }
          else if (existingReq.status === 'CONFIRMED') { reqBadge = 'badge-confirmed'; reqText = `Часы: ${existingReq.confirmedHours} ч`; }
          else if (existingReq.status === 'CANCELLED') { reqBadge = 'badge-cancelled'; reqText = 'Отклонена'; }
          actionBtnHtml = `<span class="badge ${reqBadge}">${reqText}</span>`;
        }
      } else {
        actionBtnHtml = `<span class="badge badge-accepted">Активно</span>`;
      }

      return `
        <div class="event-card">
          <div>
            <div class="event-header">
              <span class="badge badge-accepted">Набор открыт</span>
              <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
                ${ICONS.calendar} ${evt.startDate}
              </span>
            </div>
            <div class="event-title">${evt.title}</div>
            <div class="event-org" style="display: flex; align-items: center; gap: 0.35rem;">
              ${ICONS.building} ${evt.organizationName}
            </div>
            <div class="event-desc">${evt.description}</div>
            <div class="event-meta">
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.mapPin} ${evt.location}
              </div>
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.clock} Опыт: <strong>+${evt.plannedHours} ч</strong>
              </div>
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.users} Требуется: <strong>${evt.requiredVolunteers} чел.</strong>
              </div>
            </div>
          </div>
          <div class="event-footer">
            <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
              ${ICONS.check} Одобрено: ${evt.approvedVolunteersCount || 0}
            </span>
            ${actionBtnHtml}
          </div>
        </div>
      `;
    }).join('');

    // Guest apply click → modal login
    container.querySelectorAll('.btn-guest-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        showToast('Для подачи заявки необходимо войти в систему или зарегистрироваться', 'info');
        modalLogin.classList.add('open');
      });
    });

    // Volunteer apply click
    container.querySelectorAll('.btn-vol-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!volunteer) return;
        const res = store.submitRequest(volunteer.id, btn.dataset.id);
        if (res.success) {
          showToast('Заявка на участие успешно отправлена организатору!');
          renderPublicEventsView();
        } else {
          showToast(res.message, 'error');
        }
      });
    });
  }

  function renderCurrentRoleView() {
    const role = store.getCurrentRole();
    if (role === 'ADMIN') renderAdminView();
    else if (role === 'ORGANIZER') renderOrganizerView();
    else if (role === 'VOLUNTEER') renderVolunteerView();
  }

  // ==========================================
  // 3. ADMIN VIEW IMPLEMENTATION
  // ==========================================
  function renderAdminView() {
    const orgs = store.getOrganizations();
    const vols = store.getVolunteers();
    const events = store.getEvents();
    const pendingEvents = events.filter(e => e.status === 'CREATED');

    // Stats
    document.getElementById('adminStatOrgs').textContent = orgs.length;
    document.getElementById('adminStatVols').textContent = vols.length;
    document.getElementById('adminStatPendingEvents').textContent = pendingEvents.length;
    document.getElementById('adminStatTotalEvents').textContent = events.length;
    document.getElementById('adminPendingBadge').textContent = `${pendingEvents.length} на рассмотрении`;

    // 1. Moderation List (Events)
    const modContainer = document.getElementById('adminModerationList');
    if (pendingEvents.length === 0) {
      modContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon" style="color: var(--accent);">${ICONS.check}</div>
          <h4>Все события согласованы!</h4>
          <p>В очереди нет новых событий, ожидающих решения администратора.</p>
        </div>
      `;
    } else {
      modContainer.innerHTML = pendingEvents.map(evt => `
        <div class="event-card">
          <div>
            <div class="event-header">
              <span class="badge badge-created">Ожидает модерации</span>
              <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
                ${ICONS.calendar} ${evt.startDate}
              </span>
            </div>
            <div class="event-title">${evt.title}</div>
            <div class="event-org" style="display: flex; align-items: center; gap: 0.35rem;">
              ${ICONS.building} ${evt.organizationName}
            </div>
            <div class="event-desc">${evt.description}</div>
            <div class="event-meta">
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.mapPin} ${evt.location}
              </div>
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.clock} Плановые часы: <strong>${evt.plannedHours} ч</strong>
              </div>
              <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.users} Требуется: <strong>${evt.requiredVolunteers} чел.</strong>
              </div>
            </div>
          </div>
          <div class="event-footer">
            <button class="btn btn-danger btn-sm btn-reject-event" data-id="${evt.id}">
              ${ICONS.cross} <span>Отклонить</span>
            </button>
            <button class="btn btn-accent btn-sm btn-accept-event" data-id="${evt.id}">
              ${ICONS.check} <span>Согласовать</span>
            </button>
          </div>
        </div>
      `).join('');

      modContainer.querySelectorAll('.btn-accept-event').forEach(btn => {
        btn.addEventListener('click', () => {
          store.updateEventStatus(btn.dataset.id, 'ACCEPTED');
          showToast('Событие успешно согласовано (Event = ACCEPTED)! Теперь оно доступно волонтёрам.');
          renderAdminView();
        });
      });

      modContainer.querySelectorAll('.btn-reject-event').forEach(btn => {
        btn.addEventListener('click', () => {
          store.updateEventStatus(btn.dataset.id, 'CANCELLED');
          showToast('Событие отклонено (Event = CANCELLED)', 'error');
          renderAdminView();
        });
      });
    }

    // 2. ПСО Marker Closures Moderation (с подтверждающим фото)
    const pendingMarkers = store.getPendingMarkerApprovals();
    const badgeClosuresTab = document.getElementById('badgePendingMarkerClosures');
    const badgeClosuresHeader = document.getElementById('adminPendingMarkersBadge');
    if (badgeClosuresTab) {
      if (pendingMarkers.length > 0) {
        badgeClosuresTab.style.display = 'inline-block';
        badgeClosuresTab.textContent = pendingMarkers.length;
      } else {
        badgeClosuresTab.style.display = 'none';
      }
    }
    if (badgeClosuresHeader) {
      badgeClosuresHeader.textContent = `${pendingMarkers.length} заявок`;
    }

    const pendingMarkersContainer = document.getElementById('adminPendingMarkersList');
    if (pendingMarkersContainer) {
      if (pendingMarkers.length === 0) {
        pendingMarkersContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon" style="color: var(--accent);">${ICONS.check}</div>
            <h4>Все заявки на закрытие ПСО согласованы</h4>
            <p>Нет меток поисково-спасательных операций, ожидающих решения администратора.</p>
          </div>
        `;
      } else {
        pendingMarkersContainer.innerHTML = pendingMarkers.map(m => {
          const proof = m.closureProof || {};
          const photoUrl = proof.photo || '';
          const targetStatusLabel = proof.targetStatus === 'CLOSED' ? 'Закрытие поиска' : 'Человек найден (Жив)';

          return `
            <div class="admin-approval-card" data-id="${m.id}">
              <div class="admin-approval-photo-box" onclick="window._zoomPhoto('${encodeURIComponent(photoUrl)}', '${encodeURIComponent(m.title)}', '${encodeURIComponent(proof.note || '')}')">
                <img src="${photoUrl}" alt="Фотоотчёт" class="admin-approval-photo">
                <div class="admin-approval-zoom-hint">
                  ${ICONS.search} <span>Увеличить фото</span>
                </div>
              </div>
              <div class="admin-approval-content">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                  <span class="badge badge-pending">На согласовании</span>
                  <span class="urgency-badge urgency-high">ПСО</span>
                </div>
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--slate-900); margin-top: 2px;">
                  ${m.title}
                </div>
                <div style="font-size: 0.75rem; color: var(--slate-500); display: flex; flex-direction: column; gap: 3px;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    ${ICONS.mapPin} <span>${m.lastSeenLocation || (m.lat + ', ' + m.lng)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    ${ICONS.user} <span>Подал: <strong>${proof.submittedByName || m.createdByName}</strong></span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    ${ICONS.award} <span>Целевой статус: <strong>${targetStatusLabel}</strong></span>
                  </div>
                </div>

                <div class="admin-approval-report">
                  <div style="font-weight: 700; font-size: 0.75rem; color: #92400e; margin-bottom: 2px;">Рапорт поисковой группы:</div>
                  ${proof.note || 'Комментарий не указан'}
                </div>

                <div class="admin-approval-actions">
                  <button class="btn btn-outline btn-sm btn-reject-marker" data-id="${m.id}" style="color: #dc2626; border-color: #fca5a5;">
                    ${ICONS.cross} <span>Отклонить</span>
                  </button>
                  <button class="btn btn-accent btn-sm btn-approve-marker" data-id="${m.id}" style="flex: 1;">
                    ${ICONS.check} <span>Одобрить (Approve)</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        pendingMarkersContainer.querySelectorAll('.btn-approve-marker').forEach(btn => {
          btn.addEventListener('click', () => {
            const markerId = btn.dataset.id;
            const currentAdmin = store.getCurrentUser();
            store.approveMarkerClose(
              markerId,
              currentAdmin ? currentAdmin.id : 'adm-1',
              currentAdmin ? `${currentAdmin.firstName} ${currentAdmin.lastName}` : 'Администратор сервиса'
            );
            showToast('Завершение поисковой операции одобрено! Статус обновлён на «Найден».');
            renderAdminView();
            renderMapMarkers();
            renderMapStats();
            renderMapSidebar();
          });
        });

        pendingMarkersContainer.querySelectorAll('.btn-reject-marker').forEach(btn => {
          btn.addEventListener('click', () => {
            const markerId = btn.dataset.id;
            const reason = prompt(
              'Укажите причину отклонения заявки на закрытие ПСО:',
              'Недостаточно подтверждающих материалов / требуется повторный выезд'
            );
            if (reason === null) return;
            store.rejectMarkerClose(markerId, reason);
            showToast('Заявка на закрытие отклонена. Метка возвращена в статус активного поиска.', 'error');
            renderAdminView();
            renderMapMarkers();
            renderMapStats();
            renderMapSidebar();
          });
        });
      }
    }

    // 3. Registry: Orgs table
    const tableOrgsBody = document.querySelector('#adminTableOrgs tbody');
    tableOrgsBody.innerHTML = orgs.map(o => `
      <tr>
        <td><strong>${o.name}</strong><br><span style="color: #64748b; font-size: 0.8rem;">${o.description || ''}</span></td>
        <td>${o.contactPerson}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">${ICONS.mail} ${o.email}</div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">${ICONS.phone} ${o.phone}</div>
        </td>
        <td>${o.inn || '—'}</td>
      </tr>
    `).join('');

    // 4. Registry: Vols table
    const tableVolsBody = document.querySelector('#adminTableVols tbody');
    tableVolsBody.innerHTML = vols.map(v => `
      <tr>
        <td><strong>${v.fullName}</strong></td>
        <td><code>${v.studentId || '—'}</code></td>
        <td>${v.faculty || '—'}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">${ICONS.mail} ${v.email}</div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">${ICONS.phone} ${v.phone}</div>
        </td>
        <td><strong style="color: var(--accent);">${v.totalConfirmedHours} ч</strong></td>
      </tr>
    `).join('');
  }

  // Admin Forms
  document.getElementById('formRegisterOrg').addEventListener('submit', (e) => {
    e.preventDefault();
    const newOrg = store.addOrganization({
      name: document.getElementById('orgName').value,
      contactPerson: document.getElementById('orgContact').value,
      inn: document.getElementById('orgInn').value,
      email: document.getElementById('orgEmail').value,
      phone: document.getElementById('orgPhone').value,
      description: document.getElementById('orgDesc').value
    });
    showToast(`Организация «${newOrg.name}» успешно зарегистрирована!`);
    e.target.reset();
    renderAdminView();
    updateContextBanner(store.getCurrentRole());
  });

  document.getElementById('formRegisterVol').addEventListener('submit', (e) => {
    e.preventDefault();
    const newVol = store.addVolunteer({
      fullName: document.getElementById('volFullName').value,
      studentId: document.getElementById('volStudentId').value,
      faculty: document.getElementById('volFaculty').value,
      email: document.getElementById('volEmail').value,
      phone: document.getElementById('volPhone').value,
      birthDate: document.getElementById('volBirthDate').value
    });
    showToast(`Волонтёр ${newVol.fullName} успешно зарегистрирован!`);
    e.target.reset();
    renderAdminView();
    updateContextBanner(store.getCurrentRole());
  });

  // ==========================================
  // 4. ORGANIZER VIEW IMPLEMENTATION
  // ==========================================
  function renderOrganizerView() {
    const currentOrg = store.getActiveOrg();
    if (!currentOrg) return;

    const allEvents = store.getEvents();
    const myEvents = allEvents.filter(e => e.organizationId === currentOrg.id);
    const myEventIds = myEvents.map(e => e.id);

    const allRequests = store.getRequests();
    const myRequests = allRequests.filter(r => myEventIds.includes(r.eventId));
    const pendingRequests = myRequests.filter(r => r.status === 'PENDING');
    const approvedRequests = myRequests.filter(r => r.status === 'ACCEPTED' || r.status === 'CONFIRMED');
    const confirmedHours = myRequests
      .filter(r => r.status === 'CONFIRMED')
      .reduce((sum, r) => sum + (Number(r.confirmedHours) || 0), 0);

    // Stats
    document.getElementById('orgStatEvents').textContent = myEvents.length;
    document.getElementById('orgStatPendingRequests').textContent = pendingRequests.length;
    document.getElementById('orgStatApprovedRequests').textContent = approvedRequests.length;
    document.getElementById('orgStatConfirmedHours').textContent = `${confirmedHours} ч`;

    // My Events Cards
    const eventsContainer = document.getElementById('orgEventsList');
    if (myEvents.length === 0) {
      eventsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon" style="color: var(--slate-400);">${ICONS.fileText}</div>
          <h4>У вашей организации пока нет событий</h4>
          <p>Нажмите «Создать событие», чтобы запустить регистрацию волонтеров.</p>
        </div>
      `;
    } else {
      eventsContainer.innerHTML = myEvents.map(evt => {
        let badgeClass = 'badge-created';
        let badgeText = 'Ожидает модерации';
        if (evt.status === 'ACCEPTED') { badgeClass = 'badge-accepted'; badgeText = 'Одобрено (Идёт сбор)'; }
        else if (evt.status === 'CLOSED') { badgeClass = 'badge-closed'; badgeText = 'Событие закрыто'; }
        else if (evt.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; badgeText = 'Отменено'; }

        return `
          <div class="event-card">
            <div>
              <div class="event-header">
                <span class="badge ${badgeClass}">${badgeText}</span>
                <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
                  ${ICONS.calendar} ${evt.startDate}
                </span>
              </div>
              <div class="event-title">${evt.title}</div>
              <div class="event-desc">${evt.description}</div>
              <div class="event-meta">
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.mapPin} ${evt.location}
                </div>
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.users} Набрано: <strong>${evt.approvedVolunteersCount} / ${evt.requiredVolunteers}</strong>
                </div>
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.clock} Длительность: <strong>${evt.plannedHours} ч</strong>
                </div>
              </div>
            </div>
            <div class="event-footer">
              <span style="font-size: 0.8rem; color: #64748b;">Заявок: ${evt.requestsCount}</span>
              ${evt.status === 'ACCEPTED' ? `
                <button class="btn btn-outline btn-sm btn-close-event" data-id="${evt.id}">
                  Закрыть событие
                </button>
              ` : evt.status === 'CLOSED' ? `
                <span style="font-size: 0.8rem; color: #047857; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                  ${ICONS.check} <span>Завершено</span>
                </span>
              ` : `
                <span style="font-size: 0.8rem; color: #b45309;">На модерации</span>
              `}
            </div>
          </div>
        `;
      }).join('');

      eventsContainer.querySelectorAll('.btn-close-event').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Закрыть событие? После закрытия волонтеры смогут получить выписку о подтвержденных часах.')) {
            store.updateEventStatus(btn.dataset.id, 'CLOSED');
            showToast('Событие успешно закрыто (Event = CLOSED)!');
            renderOrganizerView();
          }
        });
      });
    }

    // Requests Table
    const reqTableBody = document.querySelector('#orgRequestsTable tbody');
    if (myRequests.length === 0) {
      reqTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">Заявок от волонтёров пока нет</td></tr>`;
    } else {
      reqTableBody.innerHTML = myRequests.map(r => {
        let badgeClass = 'badge-pending';
        let badgeText = 'На рассмотрении';
        if (r.status === 'ACCEPTED') { badgeClass = 'badge-accepted'; badgeText = 'Одобрена'; }
        else if (r.status === 'CONFIRMED') { badgeClass = 'badge-confirmed'; badgeText = 'Часы подтверждены'; }
        else if (r.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; badgeText = 'Отклонена'; }

        return `
          <tr>
            <td><strong>${r.eventTitle}</strong></td>
            <td><strong>${r.volonteerName}</strong></td>
            <td>${r.volonteerFaculty}</td>
            <td>${r.createdAt}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
              ${r.status === 'PENDING' ? `
                <div style="display: flex; gap: 0.4rem;">
                  <button class="btn btn-accent btn-sm btn-req-accept" data-id="${r.id}">Принять</button>
                  <button class="btn btn-danger btn-sm btn-req-reject" data-id="${r.id}">Отклонить</button>
                </div>
              ` : r.status === 'ACCEPTED' ? `
                <span style="font-size: 0.8rem; color: #0284c7;">Ожидает подтверждения часов</span>
              ` : `
                <span style="font-size: 0.8rem; color: #64748b;">Обработано</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      reqTableBody.querySelectorAll('.btn-req-accept').forEach(btn => {
        btn.addEventListener('click', () => {
          store.updateRequestStatus(btn.dataset.id, 'ACCEPTED');
          showToast('Заявка волонтера принята (VolonteerEventRequest = ACCEPTED)!');
          renderOrganizerView();
        });
      });

      reqTableBody.querySelectorAll('.btn-req-reject').forEach(btn => {
        btn.addEventListener('click', () => {
          store.updateRequestStatus(btn.dataset.id, 'CANCELLED');
          showToast('Заявка отклонена (CANCELLED)', 'error');
          renderOrganizerView();
        });
      });
    }

    // Confirm Hours Table
    const confirmTableBody = document.querySelector('#orgConfirmHoursTable tbody');
    const eligibleForConfirm = myRequests.filter(r => r.status === 'ACCEPTED' || r.status === 'CONFIRMED');

    if (eligibleForConfirm.length === 0) {
      confirmTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #64748b;">Нет волонтёров, ожидающих подтверждения часов</td></tr>`;
    } else {
      confirmTableBody.innerHTML = eligibleForConfirm.map(r => `
        <tr>
          <td><strong>${r.eventTitle}</strong><br><span style="font-size: 0.8rem; color: #64748b;">Статус события: ${r.eventStatus}</span></td>
          <td><strong>${r.volonteerName}</strong> (${r.volonteerStudentId})</td>
          <td>${r.requestedHours} ч</td>
          <td>
            <span class="badge ${r.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-accepted'}">
              ${r.status === 'CONFIRMED' ? `Подтверждено (${r.confirmedHours} ч)` : 'Одобрен к работе'}
            </span>
          </td>
          <td>
            ${r.status === 'ACCEPTED' ? `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="number" class="form-input" style="width: 80px; padding: 0.35rem 0.5rem;" id="hours_${r.id}" value="${r.requestedHours}" min="1" step="0.5">
                <button class="btn btn-accent btn-sm btn-confirm-work" data-id="${r.id}" style="display: inline-flex; align-items: center; gap: 4px;">
                  ${ICONS.check} <span>Подтвердить</span>
                </button>
              </div>
            ` : `
              <span style="font-size: 0.85rem; color: #047857; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                ${ICONS.check} <span>Часы начислены (${r.confirmedHours} ч)</span>
              </span>
            `}
          </td>
        </tr>
      `).join('');

      confirmTableBody.querySelectorAll('.btn-confirm-work').forEach(btn => {
        btn.addEventListener('click', () => {
          const reqId = btn.dataset.id;
          const input = document.getElementById(`hours_${reqId}`);
          const hours = Number(input.value) || 0;
          if (hours <= 0) {
            alert('Укажите корректное количество отработанных часов!');
            return;
          }
          store.updateRequestStatus(reqId, 'CONFIRMED', hours);
          showToast(`Факт работы подтверждён: начислено ${hours} ч (VolonteerEventRequest = CONFIRMED)!`);
          renderOrganizerView();
        });
      });
    }
  }

  // Create Event Modal & Form
  btnOpenCreateEventModal.addEventListener('click', () => {
    modalCreateEvent.classList.add('open');
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalCreateEvent.classList.remove('open');
    });
  });

  modalCreateEvent.addEventListener('click', (e) => {
    if (e.target === modalCreateEvent) modalCreateEvent.classList.remove('open');
  });

  document.getElementById('formCreateEvent').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentOrg = store.getActiveOrg();
    if (!currentOrg) return;

    const newEvt = store.addEvent({
      title: document.getElementById('newEventTitle').value,
      description: document.getElementById('newEventDesc').value,
      location: document.getElementById('newEventLocation').value,
      startDate: document.getElementById('newEventStartDate').value,
      endDate: document.getElementById('newEventEndDate').value,
      requiredVolunteers: Number(document.getElementById('newEventVolunteers').value),
      plannedHours: Number(document.getElementById('newEventHours').value),
      organizationId: currentOrg.id
    });

    modalCreateEvent.classList.remove('open');
    e.target.reset();
    showToast(`Событие «${newEvt.title}» создано и отправлено администратору на модерацию (статус CREATED)!`);
    renderOrganizerView();
  });

  // ==========================================
  // 5. VOLUNTEER VIEW IMPLEMENTATION
  // ==========================================
  function renderVolunteerView() {
    const currentVol = store.getActiveVolunteer();
    if (!currentVol) return;

    // Recalculate volunteer confirmed hours
    const allVols = store.getVolunteers();
    const freshVol = allVols.find(v => v.id === currentVol.id) || currentVol;

    const allEvents = store.getEvents();
    const availableEvents = allEvents.filter(e => e.status === 'ACCEPTED');

    const allRequests = store.getRequests();
    const myRequests = allRequests.filter(r => r.volonteerId === freshVol.id);
    const myAccepted = myRequests.filter(r => r.status === 'ACCEPTED');
    const myClosedEvents = myRequests.filter(r => r.status === 'CONFIRMED' && r.eventStatus === 'CLOSED');

    // Stats
    document.getElementById('volStatHours').textContent = `${freshVol.totalConfirmedHours} ч`;
    document.getElementById('volStatRequests').textContent = myRequests.length;
    document.getElementById('volStatAccepted').textContent = myAccepted.length;
    document.getElementById('volStatClosed').textContent = myClosedEvents.length;

    // Available Events Catalog with search
    const searchQuery = (document.getElementById('volEventSearch').value || '').toLowerCase().trim();
    const filteredEvents = availableEvents.filter(e => 
      e.title.toLowerCase().includes(searchQuery) ||
      e.description.toLowerCase().includes(searchQuery) ||
      e.location.toLowerCase().includes(searchQuery) ||
      e.organizationName.toLowerCase().includes(searchQuery)
    );

    const catalogContainer = document.getElementById('volAvailableEventsList');
    if (filteredEvents.length === 0) {
      catalogContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon" style="color: var(--slate-400);">${ICONS.search}</div>
          <h4>Доступных событий не найдено</h4>
          <p>Попробуйте изменить поисковый запрос или дождитесь публикации новых событий организаторами.</p>
        </div>
      `;
    } else {
      catalogContainer.innerHTML = filteredEvents.map(evt => {
        const existingReq = myRequests.find(r => r.eventId === evt.id);
        
        let actionButtonHtml = '';
        if (!existingReq) {
          actionButtonHtml = `
            <button class="btn btn-primary btn-sm btn-apply-event" data-id="${evt.id}">
              Подать заявку на участие
            </button>
          `;
        } else {
          let reqBadge = 'badge-pending';
          let reqText = 'Заявка на рассмотрении';
          if (existingReq.status === 'ACCEPTED') { reqBadge = 'badge-accepted'; reqText = 'Вы приняты'; }
          else if (existingReq.status === 'CONFIRMED') { reqBadge = 'badge-confirmed'; reqText = `Часы подтверждены (${existingReq.confirmedHours} ч)`; }
          else if (existingReq.status === 'CANCELLED') { reqBadge = 'badge-cancelled'; reqText = 'Заявка отклонена'; }

          actionButtonHtml = `<span class="badge ${reqBadge}" style="display: inline-flex; align-items: center; gap: 4px;">${existingReq.status === 'ACCEPTED' || existingReq.status === 'CONFIRMED' ? ICONS.check : ''} <span>${reqText}</span></span>`;
        }

        return `
          <div class="event-card">
            <div>
              <div class="event-header">
                <span class="badge badge-accepted">Набор открыт</span>
                <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
                  ${ICONS.calendar} ${evt.startDate}
                </span>
              </div>
              <div class="event-title">${evt.title}</div>
              <div class="event-org" style="display: flex; align-items: center; gap: 0.35rem;">
                ${ICONS.building} ${evt.organizationName}
              </div>
              <div class="event-desc">${evt.description}</div>
              <div class="event-meta">
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.mapPin} ${evt.location}
                </div>
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.clock} Опыт: <strong>+${evt.plannedHours} ч</strong>
                </div>
                <div class="event-meta-item" style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.users} Требуется: <strong>${evt.requiredVolunteers} чел.</strong>
                </div>
              </div>
            </div>
            <div class="event-footer">
              <span style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 0.25rem;">
                ${ICONS.check} Одобрено: ${evt.approvedVolunteersCount || 0}
              </span>
              ${actionButtonHtml}
            </div>
          </div>
        `;
      }).join('');

      catalogContainer.querySelectorAll('.btn-apply-event').forEach(btn => {
        btn.addEventListener('click', () => {
          const res = store.submitRequest(freshVol.id, btn.dataset.id);
          if (res.success) {
            showToast('Заявка на участие успешно отправлена организатору!');
            renderVolunteerView();
          } else {
            showToast(res.message, 'error');
          }
        });
      });
    }

    // My Requests Table
    const volReqTableBody = document.querySelector('#volRequestsTable tbody');
    if (myRequests.length === 0) {
      volReqTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #64748b;">Вы пока не подавали заявок на участие</td></tr>`;
    } else {
      volReqTableBody.innerHTML = myRequests.map(r => {
        let badgeClass = 'badge-pending';
        let badgeText = 'На рассмотрении';
        if (r.status === 'ACCEPTED') { badgeClass = 'badge-accepted'; badgeText = 'Одобрена (готовимся)'; }
        else if (r.status === 'CONFIRMED') { badgeClass = 'badge-confirmed'; badgeText = `Подтверждено (${r.confirmedHours} ч)`; }
        else if (r.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; badgeText = 'Отклонена организатором'; }

        return `
          <tr>
            <td><strong>${r.eventTitle}</strong></td>
            <td>${r.organizationName}</td>
            <td>${r.eventDate}</td>
            <td><strong>${r.status === 'CONFIRMED' ? r.confirmedHours : r.requestedHours} ч</strong></td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Render Initial Statement
    renderVolunteerStatement(freshVol);
  }

  document.getElementById('volEventSearch').addEventListener('input', () => {
    renderVolunteerView();
  });

  // Statement Generation
  document.getElementById('btnGenerateStatement').addEventListener('click', () => {
    const currentVol = store.getActiveVolunteer();
    renderVolunteerStatement(currentVol);
    showToast('Официальная выписка об отработанных часах сформирована!');
  });

  function renderVolunteerStatement(volunteer) {
    const startDate = document.getElementById('statementStartDate').value;
    const endDate = document.getElementById('statementEndDate').value;

    const report = store.getVolunteerStatement(volunteer.id, startDate, endDate);
    const container = document.getElementById('statementContainer');

    if (!report || report.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" style="color: var(--slate-400);">${ICONS.fileText}</div>
          <h4>Нет закрытых событий с подтверждёнными часами за указанный период</h4>
          <p>В выписку попадают только события со статусом <strong>CLOSED</strong>, где организатор подтвердил факт работы (<strong>CONFIRMED</strong>).</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="statement-card">
        <div class="statement-header">
          <div style="font-size: 0.85rem; font-weight: 700; color: #0284c7; letter-spacing: 0.08em; margin-bottom: 0.25rem;">
            ДОНСКОЙ ГОСУДАРСТВЕННЫЙ ТЕХНИЧЕСКИЙ УНИВЕРСИТЕТ • ВЕСНА '25
          </div>
          <h2>Выписка об отработанных часах добровольца</h2>
          <p>Справка о подтверждённой волонтёрской (добровольческой) деятельности в закрытых событиях</p>
        </div>

        <div class="statement-details">
          <div>
            <div class="statement-detail-item"><strong>Волонтёр:</strong> ${report.volunteer.fullName}</div>
            <div class="statement-detail-item"><strong>Студенческий билет:</strong> ${report.volunteer.studentId || 'Не указан'}</div>
            <div class="statement-detail-item"><strong>Факультет:</strong> ${report.volunteer.faculty || 'ДГТУ'}</div>
          </div>
          <div>
            <div class="statement-detail-item"><strong>Период выборки:</strong> с ${report.startDate} по ${report.endDate}</div>
            <div class="statement-detail-item"><strong>Дата формирования:</strong> ${report.generatedAt}</div>
            <div class="statement-detail-item"><strong>Количество закрытых событий:</strong> ${report.items.length}</div>
          </div>
        </div>

        <div class="table-container" style="border-radius: 4px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Наименование закрытого события</th>
                <th>Организатор</th>
                <th>Дата</th>
                <th>Подтверждённые часы</th>
              </tr>
            </thead>
            <tbody>
              ${report.items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.eventName}</strong><br><span style="font-size: 0.8rem; color: #64748b;">${item.location}</span></td>
                  <td>${item.organizationName}</td>
                  <td>${item.eventDate}</td>
                  <td><strong style="color: #15803d;">${item.confirmedHours} ч</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="statement-total-banner">
          <div>
            <strong>ИТОГО ПОДТВЕРЖДЁННЫХ ЧАСОВ ЗА ПЕРИОД:</strong>
            <div style="font-size: 0.8rem; color: #166534;">Учитывается при начислении повышенной государственной стипендии и в портфолио</div>
          </div>
          <div class="statement-total-val">${report.totalHours} академических часов</div>
        </div>

        <div class="statement-stamp">
          <div>
            <div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem;">Координатор волонтёрского центра ДГТУ:</div>
            <div style="font-size: 0.95rem; font-weight: 600;">/ Смирнова Е. П. / ___________________</div>
          </div>
          <div class="stamp-box">
            ВОЛОНТЁРСКИЙ ЦЕНТР<br>
            ДГТУ «ГОРЯЩИЕ СЕРДЦА»<br>
            ВЕСНА '25<br>
            ПОДТВЕРЖДЕНО
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // 6. MAP VIEW — Интерактивная карта
  // ==========================================
  let isSvgFallback = false;

  function initMap() {
    if (leafletMap || isSvgFallback) return;

    const container = document.getElementById('mapContainer');
    if (!container) return;

    if (typeof L !== 'undefined' && typeof L.map === 'function') {
      try {
        leafletMap = L.map('mapContainer').setView([47.2313, 39.7233], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap | VolontiersDSTU',
          maxZoom: 19
        }).addTo(leafletMap);

        mapMarkerLayer = L.layerGroup().addTo(leafletMap);

        leafletMap.on('click', (e) => {
          if (!store.getCurrentUser()) {
            showToast('Для добавления меток на карту необходимо авторизоваться', 'info');
            modalLogin.classList.add('open');
            return;
          }
          const latInput = document.getElementById('markerLat');
          const lngInput = document.getElementById('markerLng');
          if (latInput && lngInput) {
            latInput.value = e.latlng.lat.toFixed(4);
            lngInput.value = e.latlng.lng.toFixed(4);
          }
          if (!modalAddMarker.classList.contains('open')) {
            modalAddMarker.classList.add('open');
            showToast('Координаты установлены! Заполните остальные поля метки.', 'info');
          }
        });
        return;
      } catch (e) {
        console.warn('Leaflet map error, switching to interactive vector map:', e);
      }
    }

    // Если Leaflet недоступен (офлайн/прокси), запускаем интерактивную векторную карту Ростова-на-Дону
    initSvgFallbackMap();
  }

  // Проекция координат Ростова-на-Дону для интерактивной векторной карты
  function projectToSvg(lat, lng) {
    const minLat = 47.1950, maxLat = 47.2600;
    const minLng = 39.6700, maxLng = 39.7700;
    const x = ((lng - minLng) / (maxLng - minLng)) * 900;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 550;
    return { x: Math.max(30, Math.min(870, x)), y: Math.max(30, Math.min(520, y)) };
  }

  function unprojectFromSvg(x, y) {
    const minLat = 47.1950, maxLat = 47.2600;
    const minLng = 39.6700, maxLng = 39.7700;
    const lng = minLng + (x / 900) * (maxLng - minLng);
    const lat = maxLat - (y / 550) * (maxLat - minLat);
    return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
  }

  function initSvgFallbackMap() {
    isSvgFallback = true;
    const container = document.getElementById('mapContainer');
    if (!container) return;

    container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; background: #e2e8f0; overflow: hidden; user-select: none;">
        <div style="position: absolute; top: 12px; left: 14px; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(6px); padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--primary); display: flex; align-items: center;">${ICONS.map}</span>
          <strong>Карта Ростова-на-Дону (ДГТУ)</strong>
          <span style="color: #64748b; font-weight: normal; font-size: 0.75rem;">• Кликните в любое место, чтобы поставить метку</span>
        </div>
        <svg id="svgMapCanvas" viewBox="0 0 900 550" style="width: 100%; height: 100%; cursor: crosshair;">
          <!-- Сетка и фон города -->
          <rect width="900" height="550" fill="#f1f5f9" />
          
          <!-- Река Дон -->
          <path d="M 0 460 Q 220 480 450 445 T 900 475 L 900 550 L 0 550 Z" fill="#93c5fd" />
          <path d="M 0 460 Q 220 480 450 445 T 900 475" stroke="#60a5fa" stroke-width="3" fill="none" />
          <text x="450" y="505" fill="#1e40af" font-size="14" font-weight="700" opacity="0.65" text-anchor="middle">р. ДОН (Левобережная набережная)</text>

          <!-- Зелёные зоны и парки -->
          <rect x="370" y="160" width="130" height="85" rx="10" fill="#bbf7d0" stroke="#86efac" />
          <text x="435" y="205" fill="#15803d" font-size="10" font-weight="700" text-anchor="middle">Парк ДГТУ</text>

          <rect x="630" y="170" width="140" height="110" rx="10" fill="#bbf7d0" stroke="#86efac" />
          <text x="700" y="230" fill="#15803d" font-size="11" font-weight="700" text-anchor="middle">Парк Островского</text>

          <rect x="310" y="320" width="105" height="70" rx="8" fill="#bbf7d0" stroke="#86efac" />
          <text x="362" y="360" fill="#15803d" font-size="10" font-weight="700" text-anchor="middle">Парк Горького</text>

          <rect x="520" y="330" width="110" height="75" rx="8" fill="#bbf7d0" stroke="#86efac" />
          <text x="575" y="372" fill="#15803d" font-size="10" font-weight="700" text-anchor="middle">Парк Революции</text>

          <!-- Основные проспекты и магистрали -->
          <line x1="390" y1="0" x2="390" y2="460" stroke="#ffffff" stroke-width="12" />
          <line x1="390" y1="0" x2="390" y2="460" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8 6" />

          <line x1="490" y1="0" x2="490" y2="460" stroke="#ffffff" stroke-width="14" />
          <line x1="490" y1="0" x2="490" y2="460" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8 6" />

          <!-- Большая Садовая -->
          <line x1="0" y1="385" x2="900" y2="385" stroke="#ffffff" stroke-width="14" />
          <line x1="0" y1="385" x2="900" y2="385" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8 6" />

          <!-- ул. Текучёва -->
          <line x1="0" y1="215" x2="900" y2="215" stroke="#ffffff" stroke-width="10" />

          <!-- Мосты через Дон -->
          <line x1="490" y1="445" x2="490" y2="530" stroke="#475569" stroke-width="8" />
          <line x1="390" y1="460" x2="390" y2="530" stroke="#475569" stroke-width="8" />

          <!-- Ключевые узлы -->
          <!-- пл. Гагарина (ДГТУ) -->
          <circle cx="490" cy="215" r="22" fill="#dbeafe" stroke="#2563eb" stroke-width="4" />
          <text x="490" y="205" fill="#1e3a8a" font-size="9" font-weight="800" text-anchor="middle">ДГТУ</text>
          <text x="490" y="235" fill="#1d4ed8" font-size="10" font-weight="700" text-anchor="middle">пл. Гагарина, 1</text>

          <!-- Подписи улиц -->
          <text x="496" y="80" fill="#64748b" font-size="10" font-weight="700">пр. М. Нагибина →</text>
          <text x="496" y="280" fill="#64748b" font-size="10" font-weight="700">пр. Ворошиловский</text>
          <text x="396" y="280" fill="#64748b" font-size="10" font-weight="700">пр. Будённовский</text>
          <text x="180" y="380" fill="#64748b" font-size="10" font-weight="700">ул. Большая Садовая →</text>
          <text x="180" y="210" fill="#64748b" font-size="10" font-weight="700">ул. Текучёва →</text>

          <!-- Контейнер для динамических меток -->
          <g id="svgMarkerGroup"></g>
        </svg>

        <!-- Popover карточки метки при клике на SVG -->
        <div id="svgMarkerPopup" style="display: none; position: absolute; z-index: 100; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); padding: 16px; width: 300px; border: 1px solid #e2e8f0; pointer-events: auto;"></div>
      </div>
    `;

    // Клик по SVG карте → получение координат и открытие модального окна
    const svg = document.getElementById('svgMapCanvas');
    if (svg) {
      svg.addEventListener('click', (e) => {
        // Если кликнули по самой метке, не открываем модалку создания
        if (e.target.closest('.svg-marker-node')) return;

        if (!store.getCurrentUser()) {
          showToast('Для добавления меток на карту необходимо авторизоваться', 'info');
          modalLogin.classList.add('open');
          return;
        }

        const rect = svg.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * 900;
        const clickY = ((e.clientY - rect.top) / rect.height) * 550;

        const coords = unprojectFromSvg(clickX, clickY);
        const latInput = document.getElementById('markerLat');
        const lngInput = document.getElementById('markerLng');
        if (latInput && lngInput) {
          latInput.value = coords.lat.toFixed(4);
          lngInput.value = coords.lng.toFixed(4);
        }

        // Закрываем попап если был открыт
        const popup = document.getElementById('svgMarkerPopup');
        if (popup) popup.style.display = 'none';

        if (!modalAddMarker.classList.contains('open')) {
          modalAddMarker.classList.add('open');
          showToast('Координаты установлены на карте! Заполните данные метки.', 'info');
        }
      });
    }
  }

  function getMarkerColor(marker) {
    if (marker.status === 'PENDING_APPROVAL') return '#f59e0b';
    if (marker.status === 'FOUND') return '#10b981';
    if (marker.status === 'CLOSED') return '#64748b';
    if (marker.type === 'SEARCH_RESCUE') return '#dc2626';
    return '#2563eb';
  }

  function getMarkerRadius(marker) {
    if (marker.type === 'SEARCH_RESCUE' && (marker.status === 'ACTIVE' || marker.status === 'PENDING_APPROVAL')) return 12;
    return 9;
  }

  function renderMapView() {
    renderMapStats();
    renderMapSidebar();

    setTimeout(() => {
      initMap();
      if (leafletMap && typeof leafletMap.invalidateSize === 'function') {
        leafletMap.invalidateSize();
      }
      renderMapMarkers();
    }, 80);
  }

  function renderMapMarkers() {
    let markers = store.getMapMarkers('ALL');

    // Применяем фильтр
    if (currentMapFilter === 'SEARCH_RESCUE') {
      markers = markers.filter(m => m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL'));
    } else if (currentMapFilter === 'REGULAR') {
      markers = markers.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'FOUND') {
      markers = markers.filter(m => m.status === 'FOUND');
    } else if (currentMapFilter === 'PENDING') {
      markers = markers.filter(m => m.status === 'PENDING_APPROVAL');
    }

    // Режим Leaflet
    if (leafletMap && mapMarkerLayer) {
      mapMarkerLayer.clearLayers();

      markers.forEach(m => {
        const color = getMarkerColor(m);
        const radius = getMarkerRadius(m);
        const isActive = m.status === 'ACTIVE';

        const circle = L.circleMarker([m.lat, m.lng], {
          radius: radius,
          fillColor: color,
          color: '#ffffff',
          weight: 2.5,
          opacity: 1,
          fillOpacity: isActive ? 0.92 : 0.65
        }).addTo(mapMarkerLayer);

        if (m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL') && m.urgency === 'HIGH') {
          L.circleMarker([m.lat, m.lng], {
            radius: radius + 8,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.35,
            fillOpacity: 0.12
          }).addTo(mapMarkerLayer);
        }

        const typeLabel = m.type === 'SEARCH_RESCUE'
          ? '<span class="color-badge-panel rescue" style="font-size:0.75rem; padding: 2px 7px;"><span class="color-dot-rescue"></span> Поисково-спасательная</span>'
          : '<span class="color-badge-panel regular" style="font-size:0.75rem; padding: 2px 7px;"><span class="color-dot-regular"></span> Волонтёрская</span>';

        let statusLabel = 'Активна';
        let statusColor = '#2563eb';
        if (m.status === 'FOUND') { statusLabel = 'Человек найден'; statusColor = '#10b981'; }
        else if (m.status === 'PENDING_APPROVAL') { statusLabel = 'На согласовании у администратора'; statusColor = '#f59e0b'; }
        else if (m.status === 'CLOSED') { statusLabel = 'Закрыта'; statusColor = '#64748b'; }

        const urgencyHtml = m.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
          : m.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
          : '<span class="urgency-badge urgency-low">Низкая</span>';

        const lastSeenHtml = m.lastSeenLocation
          ? `<div style="font-size: 0.75rem; margin-top: 0.35rem; color: #334155;"><strong>Последнее место:</strong> ${m.lastSeenLocation} (${m.lastSeenDate || 'н/д'})</div>`
          : '';

        let proofPhotoHtml = '';
        if (m.closureProof && m.closureProof.photo) {
          const proofUrl = m.closureProof.photo;
          proofPhotoHtml = `
            <div style="margin-top: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px;">
              <div style="font-size: 0.72rem; font-weight: 700; color: #475569; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                ${ICONS.camera} Фотоотчёт операции:
              </div>
              <div style="position: relative; border-radius: 4px; overflow: hidden; max-height: 110px; cursor: pointer;" onclick="window._zoomPhoto('${encodeURIComponent(proofUrl)}', '${encodeURIComponent(m.title)}', '${encodeURIComponent(m.closureProof.note || '')}')">
                <img src="${proofUrl}" alt="Фотоотчёт" style="width: 100%; height: 95px; object-fit: cover;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.65); color: white; font-size: 0.65rem; text-align: center; padding: 2px;">
                  Нажмите для увеличения
                </div>
              </div>
              ${m.closureProof.note ? `<div style="font-size: 0.7rem; color: #64748b; margin-top: 4px; font-style: italic;">«${m.closureProof.note}»</div>` : ''}
            </div>
          `;
        }

        let actionsHtml = '';
        if (m.status === 'ACTIVE') {
          if (m.type === 'SEARCH_RESCUE') {
            actionsHtml = `
              <div class="map-popup-actions" style="margin-top: 0.6rem; display: flex; gap: 0.4rem;">
                <button class="btn btn-accent btn-sm" onclick="window._mapMarkFound('${m.id}')" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                  ${ICONS.camera} <span>Завершить (с фото)</span>
                </button>
                <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${m.id}')">
                  <span>Закрыть</span>
                </button>
              </div>`;
          } else {
            actionsHtml = `
              <div class="map-popup-actions" style="margin-top: 0.6rem;">
                <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${m.id}')" style="width: 100%;">
                  <span>Закрыть метку</span>
                </button>
              </div>`;
          }
        } else if (m.status === 'PENDING_APPROVAL') {
          actionsHtml = `
            <div style="margin-top: 0.6rem; padding: 6px 10px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; font-size: 0.72rem; color: #92400e; display: flex; align-items: center; gap: 6px;">
              ${ICONS.clock} <span>Фотоотчёт направлен администратору на согласование</span>
            </div>
          `;
        }

        circle.bindPopup(`
          <div class="map-popup">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-size: 0.75rem; color: ${statusColor}; font-weight: 700;">${statusLabel}</span>
              ${urgencyHtml}
            </div>
            <h4 style="font-size: 0.95rem; margin: 0 0 0.25rem 0;">${m.title}</h4>
            <p style="font-size: 0.8rem; color: #475569; margin: 0 0 0.35rem 0;">${m.description}</p>
            ${lastSeenHtml}
            ${proofPhotoHtml}
            <div class="map-popup-meta" style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; display: flex; flex-direction: column; gap: 3px;">
              <div>${typeLabel}</div>
              <div style="display: flex; align-items: center; gap: 4px;">${ICONS.phone} <span>${m.contactPhone || 'Не указан'}</span></div>
              <div style="display: flex; align-items: center; gap: 4px;">${ICONS.user} <span>${m.createdByName} • ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</span></div>
            </div>
            ${actionsHtml}
          </div>
        `);
      });
      return;
    }

    // Режим Интерактивного SVG
    const svgGroup = document.getElementById('svgMarkerGroup');
    if (!svgGroup) return;

    svgGroup.innerHTML = markers.map(m => {
      const pt = projectToSvg(m.lat, m.lng);
      const color = getMarkerColor(m);
      const isUrgent = m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL') && m.urgency === 'HIGH';
      const isPending = m.status === 'PENDING_APPROVAL';

      return `
        <g class="svg-marker-node" data-id="${m.id}" data-x="${pt.x}" data-y="${pt.y}" style="cursor: pointer;">
          ${isUrgent ? `
            <circle cx="${pt.x}" cy="${pt.y}" r="22" fill="${color}" opacity="0.25">
              <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2s" repeatCount="indefinite"/>
            </circle>
          ` : ''}
          <circle cx="${pt.x}" cy="${pt.y}" r="${m.type === 'SEARCH_RESCUE' ? '12' : '9'}" fill="${color}" stroke="#ffffff" stroke-width="2.5" />
          ${isPending ? `<circle cx="${pt.x + 8}" cy="${pt.y - 8}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />` : ''}
          <text x="${pt.x}" y="${pt.y - 15}" fill="#0f172a" font-size="11" font-weight="700" text-anchor="middle" style="text-shadow: 0 1px 3px rgba(255,255,255,0.9);">
            ${m.title.length > 25 ? m.title.substring(0, 25) + '...' : m.title}
          </text>
        </g>
      `;
    }).join('');

    // Обработчик клика по меткам на SVG
    svgGroup.querySelectorAll('.svg-marker-node').forEach(node => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const markerId = node.dataset.id;
        openSvgMarkerPopup(markerId, parseFloat(node.dataset.x), parseFloat(node.dataset.y));
      });
    });
  }

  function openSvgMarkerPopup(markerId, x, y) {
    const marker = (store.getMapMarkers('ALL') || []).find(m => m.id === markerId);
    const popup = document.getElementById('svgMarkerPopup');
    if (!marker || !popup) return;

    const color = getMarkerColor(marker);
    const typeLabel = marker.type === 'SEARCH_RESCUE'
      ? '<span class="color-badge-panel rescue" style="font-size:0.75rem; padding: 2px 7px;"><span class="color-dot-rescue"></span> Поисково-спасательная</span>'
      : '<span class="color-badge-panel regular" style="font-size:0.75rem; padding: 2px 7px;"><span class="color-dot-regular"></span> Волонтёрская</span>';

    let statusLabel = 'Активна';
    if (marker.status === 'FOUND') statusLabel = 'Человек найден';
    else if (marker.status === 'PENDING_APPROVAL') statusLabel = 'На согласовании у администратора';
    else if (marker.status === 'CLOSED') statusLabel = 'Закрыта';

    const urgencyHtml = marker.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
      : marker.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
      : '<span class="urgency-badge urgency-low">Низкая</span>';

    const lastSeenHtml = marker.lastSeenLocation
      ? `<div style="font-size: 0.75rem; margin-top: 0.35rem; color: #334155;"><strong>Последнее место:</strong> ${marker.lastSeenLocation} (${marker.lastSeenDate || 'н/д'})</div>`
      : '';

    let proofPhotoHtml = '';
    if (marker.closureProof && marker.closureProof.photo) {
      const proofUrl = marker.closureProof.photo;
      proofPhotoHtml = `
        <div style="margin-top: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #475569; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            ${ICONS.camera} Фотоотчёт операции:
          </div>
          <div style="position: relative; border-radius: 4px; overflow: hidden; max-height: 100px; cursor: pointer;" onclick="window._zoomPhoto('${encodeURIComponent(proofUrl)}', '${encodeURIComponent(marker.title)}', '${encodeURIComponent(marker.closureProof.note || '')}')">
            <img src="${proofUrl}" alt="Фотоотчёт" style="width: 100%; height: 90px; object-fit: cover;">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.65); color: white; font-size: 0.65rem; text-align: center; padding: 2px;">
              Нажмите для увеличения
            </div>
          </div>
          ${marker.closureProof.note ? `<div style="font-size: 0.7rem; color: #64748b; margin-top: 4px; font-style: italic;">«${marker.closureProof.note}»</div>` : ''}
        </div>
      `;
    }

    let actionsHtml = '';
    if (marker.status === 'ACTIVE') {
      if (marker.type === 'SEARCH_RESCUE') {
        actionsHtml = `
          <div class="map-popup-actions" style="margin-top: 0.6rem; display: flex; gap: 0.4rem;">
            <button class="btn btn-accent btn-sm" onclick="window._mapMarkFound('${marker.id}')" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
              ${ICONS.camera} <span>Завершить (с фото)</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${marker.id}')">
              <span>Закрыть</span>
            </button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="map-popup-actions" style="margin-top: 0.6rem;">
            <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${marker.id}')" style="width: 100%;">
              <span>Закрыть метку</span>
            </button>
          </div>`;
      }
    } else if (marker.status === 'PENDING_APPROVAL') {
      actionsHtml = `
        <div style="margin-top: 0.6rem; padding: 6px 10px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; font-size: 0.72rem; color: #92400e; display: flex; align-items: center; gap: 6px;">
          ${ICONS.clock} <span>Фотоотчёт направлен администратору на согласование</span>
        </div>
      `;
    }

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <span style="font-size: 0.75rem; color: ${color}; font-weight: 700;">${statusLabel}</span>
        ${urgencyHtml}
      </div>
      <h4 style="font-size: 0.95rem; margin-bottom: 0.4rem;">${marker.title}</h4>
      <p style="font-size: 0.8rem; color: #475569; margin-bottom: 0.4rem;">${marker.description}</p>
      ${lastSeenHtml}
      ${proofPhotoHtml}
      <div class="map-popup-meta" style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; display: flex; flex-direction: column; gap: 3px;">
        <div>${typeLabel}</div>
        <div style="display: flex; align-items: center; gap: 4px;">${ICONS.phone} <span>${marker.contactPhone || 'Не указан'}</span></div>
        <div style="display: flex; align-items: center; gap: 4px;">${ICONS.user} <span>${marker.createdByName}</span></div>
      </div>
      ${actionsHtml}
      <button style="position: absolute; top: 8px; right: 8px; border: none; background: transparent; font-size: 1.25rem; cursor: pointer; color: #94a3b8; line-height: 1;" onclick="document.getElementById('svgMarkerPopup').style.display='none'">&times;</button>
    `;

    // Позиционируем попап
    const container = document.getElementById('mapContainer');
    const cWidth = container.offsetWidth || 800;
    const cHeight = container.offsetHeight || 550;
    const relX = (x / 900) * cWidth;
    const relY = (y / 550) * cHeight;

    const left = Math.min(cWidth - 310, Math.max(10, relX - 150));
    const top = Math.min(cHeight - 270, Math.max(10, relY - 190));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.display = 'block';
  }

  function renderMapStats() {
    const all = store.getMapMarkers('ALL');
    const searchActive = all.filter(m => m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE').length;
    const regular = all.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE').length;
    const found = all.filter(m => m.status === 'FOUND').length;
    const pending = all.filter(m => m.status === 'PENDING_APPROVAL').length;

    const elSearch = document.getElementById('mapStatSearchActive');
    const elReg = document.getElementById('mapStatRegular');
    const elFound = document.getElementById('mapStatFound');
    const elPending = document.getElementById('mapStatPending');
    const elTotal = document.getElementById('mapStatTotal');

    if (elSearch) elSearch.textContent = searchActive;
    if (elReg) elReg.textContent = regular;
    if (elFound) elFound.textContent = found;
    if (elPending) elPending.textContent = pending;
    if (elTotal) elTotal.textContent = all.length;
  }

  function renderMapSidebar() {
    let markers = store.getMapMarkers('ALL');

    if (currentMapFilter === 'SEARCH_RESCUE') {
      markers = markers.filter(m => m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL'));
    } else if (currentMapFilter === 'REGULAR') {
      markers = markers.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'FOUND') {
      markers = markers.filter(m => m.status === 'FOUND');
    } else if (currentMapFilter === 'PENDING') {
      markers = markers.filter(m => m.status === 'PENDING_APPROVAL');
    }

    const listContainer = document.getElementById('mapMarkerList');
    if (!listContainer) return;

    if (markers.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem;">
          <div style="margin-bottom: 0.5rem; opacity: 0.4;">${ICONS.mapPin}</div>
          Нет меток для выбранного фильтра
        </div>`;
      return;
    }

    listContainer.innerHTML = markers.map(m => {
      const isPending = m.status === 'PENDING_APPROVAL';
      const isFound = m.status === 'FOUND';
      const isRescue = m.type === 'SEARCH_RESCUE';

      let cardBorderClass = isPending ? 'pending' : isFound ? 'found' : isRescue ? 'search-rescue' : 'regular';

      const urgencyHtml = m.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
        : m.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
        : '<span class="urgency-badge urgency-low">Низкая</span>';

      let statusBadge = '';
      if (isPending) {
        statusBadge = '<span class="badge badge-pending" style="font-size: 0.65rem;">Согласование фото</span>';
      } else if (isFound) {
        statusBadge = '<span class="badge badge-accepted" style="font-size: 0.65rem;">Найден</span>';
      } else if (m.status === 'CLOSED') {
        statusBadge = '<span class="badge" style="background:#e2e8f0; color:#475569; font-size: 0.65rem;">Закрыта</span>';
      }

      return `
        <div class="marker-list-card ${cardBorderClass}" data-lat="${m.lat}" data-lng="${m.lng}" data-id="${m.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              ${urgencyHtml}
              ${statusBadge}
            </div>
            <span style="font-size: 0.7rem; color: #94a3b8;">${new Date(m.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
          <div class="marker-list-title">${m.title}</div>
          <div class="marker-list-meta" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
            ${ICONS.user}
            <span>${m.createdByName}</span>
            ${m.closureProof && m.closureProof.photo ? `<span style="margin-left: auto; color: #f59e0b; display: flex; align-items: center; gap: 3px; font-size: 0.7rem;">${ICONS.camera} Фото</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Клик по карточке → полететь к метке на карте
    listContainer.querySelectorAll('.marker-list-card').forEach(card => {
      card.addEventListener('click', () => {
        const markerId = card.dataset.id;
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);

        if (leafletMap) {
          leafletMap.flyTo([lat, lng], 16, { duration: 0.8 });
          mapMarkerLayer.eachLayer(layer => {
            if (layer.getLatLng && Math.abs(layer.getLatLng().lat - lat) < 0.0001 && Math.abs(layer.getLatLng().lng - lng) < 0.0001) {
              layer.openPopup();
            }
          });
        } else if (isSvgFallback) {
          const pt = projectToSvg(lat, lng);
          openSvgMarkerPopup(markerId, pt.x, pt.y);
        }
      });
    });
  }

  // ==========================================
  // МОДАЛЬНОЕ ОКНО ЗАКРЫТИЯ МЕТКИ ПСО С ФОТООТЧЁТОМ
  // ==========================================
  function openCloseSearchMarkerModal(markerId, targetStatus = 'FOUND') {
    const user = store.getCurrentUser();
    if (!user) {
      showToast('Для отправки отчёта о завершении поиска необходимо авторизоваться', 'info');
      modalLogin.classList.add('open');
      return;
    }

    const marker = (store.getMapMarkers('ALL') || []).find(m => m.id === markerId);
    if (!marker) return;

    const modal = document.getElementById('modalCloseSearchMarker');
    const summaryBox = document.getElementById('closeMarkerSummary');
    const markerIdInput = document.getElementById('closeMarkerId');
    const targetStatusInput = document.getElementById('closeMarkerTargetStatus');
    const photoDataInput = document.getElementById('closeMarkerPhotoData');
    const photoFile = document.getElementById('closeMarkerPhotoFile');
    const photoUploadPrompt = document.getElementById('photoUploadPrompt');
    const photoPreviewWrap = document.getElementById('photoPreviewWrap');
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    const noteInput = document.getElementById('closeMarkerNote');

    if (!modal) return;

    markerIdInput.value = markerId;
    if (targetStatusInput) targetStatusInput.value = targetStatus;
    if (photoDataInput) photoDataInput.value = '';
    if (photoFile) photoFile.value = '';
    if (photoUploadPrompt) photoUploadPrompt.style.display = 'block';
    if (photoPreviewWrap) photoPreviewWrap.style.display = 'none';
    if (photoPreviewImg) photoPreviewImg.src = '';
    if (noteInput) noteInput.value = '';

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
          <div class="color-badge-panel rescue" style="padding: 0.4rem 0.65rem; border-radius: 8px;">
            <span class="color-dot-rescue"></span>
            <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626;">ПСО</span>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">${marker.title}</div>
            <div style="font-size: 0.8rem; color: var(--slate-500); margin-top: 3px;">
              ${marker.lastSeenLocation ? `Последнее место: <strong>${marker.lastSeenLocation}</strong> (${marker.lastSeenDate || 'н/д'}) • ` : ''}
              Координаты: ${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}
            </div>
          </div>
        </div>
      `;
    }

    // Закрываем SVG popup если открыт
    const popup = document.getElementById('svgMarkerPopup');
    if (popup) popup.style.display = 'none';

    modal.classList.add('open');
  }

  // Настройка Drag-and-Drop и загрузки фото
  function initModalCloseSearchMarker() {
    const photoDropZone = document.getElementById('photoDropZone');
    const photoFile = document.getElementById('closeMarkerPhotoFile');
    const photoDataInput = document.getElementById('closeMarkerPhotoData');
    const photoUploadPrompt = document.getElementById('photoUploadPrompt');
    const photoPreviewWrap = document.getElementById('photoPreviewWrap');
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    const btnReplacePhoto = document.getElementById('btnReplacePhoto');
    const btnRemovePhoto = document.getElementById('btnRemovePhoto');
    const btnUseDemoPhoto = document.getElementById('btnUseDemoPhoto');
    const formCloseSearch = document.getElementById('formCloseSearchMarker');
    const modalCloseSearch = document.getElementById('modalCloseSearchMarker');

    function setPhotoPreview(dataUrl) {
      if (photoDataInput) photoDataInput.value = dataUrl;
      if (photoPreviewImg) photoPreviewImg.src = dataUrl;
      if (photoUploadPrompt) photoUploadPrompt.style.display = 'none';
      if (photoPreviewWrap) photoPreviewWrap.style.display = 'block';
    }

    function clearPhotoPreview() {
      if (photoDataInput) photoDataInput.value = '';
      if (photoFile) photoFile.value = '';
      if (photoPreviewImg) photoPreviewImg.src = '';
      if (photoPreviewWrap) photoPreviewWrap.style.display = 'none';
      if (photoUploadPrompt) photoUploadPrompt.style.display = 'block';
    }

    if (photoDropZone && photoFile) {
      photoDropZone.addEventListener('click', (e) => {
        if (e.target.closest('#btnReplacePhoto') || e.target.closest('#btnRemovePhoto')) return;
        if (photoPreviewWrap && photoPreviewWrap.style.display === 'block') return;
        photoFile.click();
      });

      photoFile.addEventListener('change', () => {
        const file = photoFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setPhotoPreview(e.target.result);
        reader.readAsDataURL(file);
      });

      photoDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        photoDropZone.classList.add('dragover');
      });

      photoDropZone.addEventListener('dragleave', () => {
        photoDropZone.classList.remove('dragover');
      });

      photoDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        photoDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => setPhotoPreview(ev.target.result);
          reader.readAsDataURL(file);
        }
      });
    }

    if (btnReplacePhoto && photoFile) {
      btnReplacePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        photoFile.click();
      });
    }

    if (btnRemovePhoto) {
      btnRemovePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPhotoPreview();
      });
    }

    if (btnUseDemoPhoto) {
      btnUseDemoPhoto.addEventListener('click', () => {
        const demoPhoto = 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&w=800&q=80';
        setPhotoPreview(demoPhoto);
        showToast('Прикреплена демонстрационная фотография отряда ПСО', 'info');
      });
    }

    if (formCloseSearch) {
      formCloseSearch.addEventListener('submit', (e) => {
        e.preventDefault();
        const markerId = document.getElementById('closeMarkerId').value;
        const targetStatus = document.getElementById('closeMarkerTargetStatus').value;
        const photoData = document.getElementById('closeMarkerPhotoData').value;
        const note = document.getElementById('closeMarkerNote').value.trim();

        if (!photoData) {
          showToast('Пожалуйста, прикрепите подтверждающую фотографию', 'error');
          return;
        }

        const user = store.getCurrentUser();
        store.requestMarkerClose(markerId, {
          photo: photoData,
          note: note,
          targetStatus: targetStatus,
          submittedBy: user ? user.id : 'vol-1',
          submittedByName: user ? `${user.firstName} ${user.lastName}` : 'Волонтёр отряда'
        });

        modalCloseSearch.classList.remove('open');
        formCloseSearch.reset();
        clearPhotoPreview();

        showToast('Отчёт с фото направлен администратору на согласование!');
        renderMapMarkers();
        renderMapStats();
        renderMapSidebar();
        if (store.getCurrentRole() === 'ADMIN') {
          renderAdminView();
        }
      });
    }

    document.querySelectorAll('[data-close-modal-search]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (modalCloseSearch) modalCloseSearch.classList.remove('open');
      });
    });

    if (modalCloseSearch) {
      modalCloseSearch.addEventListener('click', (e) => {
        if (e.target === modalCloseSearch) modalCloseSearch.classList.remove('open');
      });
    }
  }

  // ==========================================
  // МОДАЛЬНОЕ ОКНО ПРОСМОТРА ФОТО В ПОЛНОМ РАЗМЕРЕ
  // ==========================================
  window._zoomPhoto = function(photoUrl, title, caption) {
    const modal = document.getElementById('modalPhotoZoom');
    const img = document.getElementById('zoomPhotoImg');
    const titleEl = document.getElementById('zoomPhotoTitle');
    const captionEl = document.getElementById('zoomPhotoCaption');

    if (!modal || !img) return;

    try {
      img.src = decodeURIComponent(photoUrl);
    } catch(e) {
      img.src = photoUrl;
    }

    if (titleEl) {
      try {
        titleEl.textContent = decodeURIComponent(title);
      } catch(e) {
        titleEl.textContent = title || 'Фотоотчёт поисково-спасательной работы';
      }
    }

    if (captionEl) {
      let decodedCaption = '';
      try {
        decodedCaption = decodeURIComponent(caption);
      } catch(e) {
        decodedCaption = caption || '';
      }
      captionEl.textContent = decodedCaption || 'Подтверждающий фотоотчёт добровольческого поискового отряда.';
    }

    modal.classList.add('open');
  };

  const btnClosePhotoZoom = document.getElementById('btnClosePhotoZoom');
  const modalPhotoZoom = document.getElementById('modalPhotoZoom');
  if (btnClosePhotoZoom && modalPhotoZoom) {
    btnClosePhotoZoom.addEventListener('click', () => modalPhotoZoom.classList.remove('open'));
    modalPhotoZoom.addEventListener('click', (e) => {
      if (e.target === modalPhotoZoom) modalPhotoZoom.classList.remove('open');
    });
  }

  // Глобальные функции для кнопок в popup
  window._mapMarkFound = function(markerId) {
    const m = (store.getMapMarkers('ALL') || []).find(x => x.id === markerId);
    if (m && m.type === 'SEARCH_RESCUE') {
      openCloseSearchMarkerModal(markerId, 'FOUND');
      return;
    }
    store.updateMarkerStatus(markerId, 'FOUND');
    showToast('Человек найден! Статус метки обновлён.');
    const popup = document.getElementById('svgMarkerPopup');
    if (popup) popup.style.display = 'none';
    renderMapMarkers();
    renderMapStats();
    renderMapSidebar();
  };

  window._mapCloseMarker = function(markerId) {
    const m = (store.getMapMarkers('ALL') || []).find(x => x.id === markerId);
    if (m && m.type === 'SEARCH_RESCUE') {
      openCloseSearchMarkerModal(markerId, 'CLOSED');
      return;
    }
    store.updateMarkerStatus(markerId, 'CLOSED');
    showToast('Метка закрыта.');
    const popup = document.getElementById('svgMarkerPopup');
    if (popup) popup.style.display = 'none';
    renderMapMarkers();
    renderMapStats();
    renderMapSidebar();
  };

  // Filter Pills
  document.getElementById('mapFilterPills').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;

    document.querySelectorAll('#mapFilterPills .filter-pill').forEach(p => {
      p.classList.remove('active', 'active-danger', 'active-accent');
    });

    currentMapFilter = pill.dataset.filter;

    if (currentMapFilter === 'SEARCH_RESCUE') pill.classList.add('active-danger');
    else if (currentMapFilter === 'FOUND') pill.classList.add('active-accent');
    else pill.classList.add('active');

    renderMapMarkers();
    renderMapSidebar();
  });

  // Add Marker Modal
  btnOpenAddMarkerModal.addEventListener('click', () => {
    if (!store.getCurrentUser()) {
      showToast('Для добавления меток на карту необходимо авторизоваться', 'info');
      modalLogin.classList.add('open');
      return;
    }
    modalAddMarker.classList.add('open');
  });

  document.querySelectorAll('[data-close-modal-marker]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalAddMarker.classList.remove('open');
    });
  });

  modalAddMarker.addEventListener('click', (e) => {
    if (e.target === modalAddMarker) modalAddMarker.classList.remove('open');
  });

  // Toggle search-rescue specific fields
  document.getElementById('markerType').addEventListener('change', (e) => {
    document.getElementById('searchRescueFields').style.display =
      e.target.value === 'SEARCH_RESCUE' ? 'block' : 'none';
  });

  // Submit new marker
  document.getElementById('formAddMarker').addEventListener('submit', (e) => {
    e.preventDefault();

    const type = document.getElementById('markerType').value;
    const newMarker = store.addMapMarker({
      lat: parseFloat(document.getElementById('markerLat').value),
      lng: parseFloat(document.getElementById('markerLng').value),
      type: type,
      title: document.getElementById('markerTitle').value,
      description: document.getElementById('markerDescription').value,
      urgency: document.getElementById('markerUrgency').value,
      contactPhone: document.getElementById('markerPhone').value,
      lastSeenDate: type === 'SEARCH_RESCUE' ? document.getElementById('markerLastSeenDate').value : null,
      lastSeenLocation: type === 'SEARCH_RESCUE' ? document.getElementById('markerLastSeenLocation').value : null
    });

    modalAddMarker.classList.remove('open');
    e.target.reset();

    const typeText = type === 'SEARCH_RESCUE' ? 'Поисково-спасательная метка' : 'Волонтёрская метка';
    showToast(`${typeText} «${newMarker.title}» размещена на карте!`);

    // Обновляем карту и летим к новой метке
    renderMapMarkers();
    renderMapStats();
    renderMapSidebar();
    if (leafletMap) {
      leafletMap.flyTo([newMarker.lat, newMarker.lng], 15, { duration: 0.8 });
    } else if (isSvgFallback) {
      const pt = projectToSvg(newMarker.lat, newMarker.lng);
      openSvgMarkerPopup(newMarker.id, pt.x, pt.y);
    }
  });

  // Initialize Search Marker modal handlers
  initModalCloseSearchMarker();

  // ==========================================
  // 7. AUTH & PERSONAL ACCOUNT (ЛИЧНЫЙ КАБИНЕТ)
  // ==========================================
  function renderAuthHeader() {
    if (!authHeaderArea) return;
    const user = store.getCurrentUser();

    if (user) {
      const initials = (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
      let roleBadgeClass = 'badge-pending';
      let roleText = 'Волонтёр';
      if (user.role === 'ADMIN') { roleBadgeClass = 'badge-accepted'; roleText = 'Админ'; }
      else if (user.role === 'ORGANIZER') { roleBadgeClass = 'badge-confirmed'; roleText = 'Организатор'; }

      authHeaderArea.innerHTML = `
        <div class="user-chip" id="btnUserChip" title="Открыть личный кабинет">
          <div class="avatar-circle">${initials}</div>
          <span>${user.lastName} ${user.firstName.charAt(0)}.</span>
          <span class="badge ${roleBadgeClass}" style="font-size: 0.65rem;">${roleText}</span>
        </div>
        <button class="btn-secondary-sm" id="btnHeaderProfile">
          ${ICONS.user} <span>Кабинет</span>
        </button>
        <button class="btn-secondary-sm" id="btnLogout" title="Выйти из учётной записи">
          ${ICONS.logout} <span>Выйти</span>
        </button>
        <button class="btn-secondary-sm" id="btnResetData" title="Сбросить к исходным демонстрационным данным">
          ${ICONS.refresh} <span>Сброс</span>
        </button>
      `;

      document.getElementById('btnUserChip').addEventListener('click', openProfileModal);
      document.getElementById('btnHeaderProfile').addEventListener('click', openProfileModal);
      document.getElementById('btnLogout').addEventListener('click', () => {
        store.logout();
        showToast('Вы вышли из учётной записи', 'info');
        renderAuthHeader();
        setRole('PUBLIC');
      });
    } else {
      authHeaderArea.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btnOpenLogin">
          ${ICONS.lock} <span>Войти</span>
        </button>
        <button class="btn btn-accent btn-sm" id="btnOpenRegister">
          ${ICONS.plus} <span>Регистрация</span>
        </button>
        <button class="btn-secondary-sm" id="btnResetData" title="Сбросить к исходным демонстрационным данным">
          ${ICONS.refresh} <span>Сброс</span>
        </button>
      `;

      document.getElementById('btnOpenLogin').addEventListener('click', () => {
        modalLogin.classList.add('open');
      });
      document.getElementById('btnOpenRegister').addEventListener('click', () => {
        modalRegister.classList.add('open');
      });
    }

    const resetBtn = document.getElementById('btnResetData');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Сбросить все данные к исходным демонстрационным?')) {
          store.reset();
          showToast('Данные успешно сброшены к начальным!');
          renderAuthHeader();
          setRole(store.getCurrentRole());
        }
      });
    }

    renderRoleSelector(store.getCurrentRole());
  }

  function openProfileModal() {
    const user = store.getCurrentUser();
    if (!user) {
      modalLogin.classList.add('open');
      return;
    }

    const initials = (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
    document.getElementById('profileAvatarLg').textContent = initials;
    document.getElementById('profileFullName').textContent = `${user.lastName} ${user.firstName}`;
    document.getElementById('profileEmail').textContent = user.email;

    const roleBadge = document.getElementById('profileRoleBadge');
    if (user.role === 'ADMIN') {
      roleBadge.className = 'badge badge-accepted';
      roleBadge.textContent = 'Администратор сервиса';
    } else if (user.role === 'ORGANIZER') {
      roleBadge.className = 'badge badge-confirmed';
      roleBadge.textContent = 'Организатор событий';
    } else {
      roleBadge.className = 'badge badge-pending';
      roleBadge.textContent = 'Волонтёр ДГТУ';
    }

    document.getElementById('profileCreatedAt').textContent =
      `Зарегистрирован: ${new Date(user.createdAt || Date.now()).toLocaleDateString('ru-RU')}`;

    // Role-specific details
    const detailsBox = document.getElementById('profileRoleDetails');
    if (user.role === 'VOLUNTEER') {
      const vol = store.getActiveVolunteer();
      detailsBox.innerHTML = `
        <div style="background: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; font-size: 0.85rem;">
          <div style="font-weight: 700; color: var(--slate-900); margin-bottom: 0.4rem;">Электронная волонтёрская книжка ДГТУ</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; color: var(--slate-600);">
            <div><strong>Студенческий билет:</strong> ${vol ? vol.studentId : 'СТ-2025-1042'}</div>
            <div><strong>Факультет:</strong> ${vol ? vol.faculty : 'ИиВТ'}</div>
            <div><strong>Подтверждённых часов:</strong> <span style="color: #16a34a; font-weight: 800;">${vol ? vol.totalConfirmedHours : 8} ч.</span></div>
            <div><strong>Статус верификации:</strong> <span style="color: #2563eb; font-weight: 700;">Подтверждён ВЦ ДГТУ</span></div>
          </div>
        </div>
      `;
    } else if (user.role === 'ORGANIZER') {
      const org = store.getActiveOrg();
      const eventsCount = store.getEvents().filter(e => e.organizationId === (org ? org.id : '')).length;
      detailsBox.innerHTML = `
        <div style="background: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; font-size: 0.85rem;">
          <div style="font-weight: 700; color: var(--slate-900); margin-bottom: 0.4rem;">Профиль аккредитованной организации</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; color: var(--slate-600);">
            <div><strong>Организация:</strong> ${org ? org.name : 'Волонтёрский центр'}</div>
            <div><strong>Контактное лицо:</strong> ${org ? org.contactPerson : user.lastName + ' ' + user.firstName}</div>
            <div><strong>ИНН:</strong> ${org ? (org.inn || '6165033140') : '6165033140'}</div>
            <div><strong>Создано событий:</strong> <span style="color: #2563eb; font-weight: 800;">${eventsCount}</span></div>
          </div>
        </div>
      `;
    } else {
      detailsBox.innerHTML = `
        <div style="background: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; font-size: 0.85rem;">
          <div style="font-weight: 700; color: var(--slate-900); margin-bottom: 0.4rem;">Полномочия Администратора платформы</div>
          <div style="color: var(--slate-600); line-height: 1.5;">
            Главный координатор волонтёрских инициатив университета. Доступны: модерация событий, согласование фотоотчётов ПСО, регистрация организаций и волонтёров, системный аудит и экспорт выписок.
          </div>
        </div>
      `;
    }

    // JWT Token Inspector
    const rawToken = store.getJWTToken() || '';
    const tokenParts = rawToken.split('.');
    const displayEl = document.getElementById('jwtTokenDisplay');
    if (tokenParts.length === 3) {
      displayEl.innerHTML = `
        <span class="jwt-part-header">${tokenParts[0]}</span>.<span class="jwt-part-payload">${tokenParts[1]}</span>.<span class="jwt-part-signature">${tokenParts[2]}</span>
      `;
    } else {
      displayEl.textContent = rawToken;
    }

    const decoded = store.getDecodedJWT();
    document.getElementById('jwtDecodedDisplay').textContent =
      decoded ? JSON.stringify({ header: decoded.header, payload: decoded.payload }, null, 2) : 'Токен отсутствует';

    modalProfile.classList.add('open');
  }

  // Copy JWT Token to clipboard
  const btnCopyJWT = document.getElementById('btnCopyJWT');
  if (btnCopyJWT) {
    btnCopyJWT.addEventListener('click', () => {
      const token = store.getJWTToken();
      if (token) {
        navigator.clipboard.writeText(token).then(() => {
          showToast('JWT токен скопирован в буфер обмена!');
        }).catch(() => {
          showToast('Токен: ' + token.substring(0, 20) + '...', 'info');
        });
      }
    });
  }

  // Logout from profile modal
  const btnProfileLogout = document.getElementById('btnProfileLogout');
  if (btnProfileLogout) {
    btnProfileLogout.addEventListener('click', () => {
      store.logout();
      modalProfile.classList.remove('open');
      showToast('Вы вышли из личного кабинета', 'info');
      renderAuthHeader();
    });
  }

  // Registration: Role card selector
  document.querySelectorAll('#regRoleSelector .role-radio-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#regRoleSelector .role-radio-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      document.getElementById('regSelectedRole').value = card.dataset.role;
    });
  });

  // Registration Form Submission
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();

      const role = document.getElementById('regSelectedRole').value;
      const firstName = document.getElementById('regFirstName').value.trim();
      const lastName = document.getElementById('regLastName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;

      const res = store.register({ firstName, lastName, email, password, role });
      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }

      modalRegister.classList.remove('open');
      formRegister.reset();

      const roleRu = role === 'ADMIN' ? 'Администратора' : role === 'ORGANIZER' ? 'Организатора' : 'Волонтёра';
      showToast(`Аккаунт ${roleRu} успешно создан! JWT токен выдан.`);

      renderAuthHeader();
      setRole(role);
    });
  }

  // Login Form Submission
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      const res = store.login(email, password);
      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }

      modalLogin.classList.remove('open');
      formLogin.reset();

      showToast(`Добро пожаловать, ${res.user.firstName}! Авторизация по JWT успешна.`);

      renderAuthHeader();
      setRole(res.user.role);
    });
  }

  // Demo chips in Login modal
  document.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('loginEmail').value = chip.dataset.demoEmail;
      document.getElementById('loginPassword').value = chip.dataset.demoPass;
      showToast('Данные аккаунта подставлены! Нажмите «Войти».', 'info');
    });
  });

  // Modal switching links
  const btnSwitchToRegister = document.getElementById('btnSwitchToRegister');
  if (btnSwitchToRegister) {
    btnSwitchToRegister.addEventListener('click', () => {
      modalLogin.classList.remove('open');
      modalRegister.classList.add('open');
    });
  }

  const btnSwitchToLogin = document.getElementById('btnSwitchToLogin');
  if (btnSwitchToLogin) {
    btnSwitchToLogin.addEventListener('click', () => {
      modalRegister.classList.remove('open');
      modalLogin.classList.add('open');
    });
  }

  // Close modal buttons
  document.querySelectorAll('[data-close-modal-login]').forEach(btn => {
    btn.addEventListener('click', () => modalLogin.classList.remove('open'));
  });
  document.querySelectorAll('[data-close-modal-register]').forEach(btn => {
    btn.addEventListener('click', () => modalRegister.classList.remove('open'));
  });
  document.querySelectorAll('[data-close-modal-profile]').forEach(btn => {
    btn.addEventListener('click', () => modalProfile.classList.remove('open'));
  });

  // Click outside to close modals
  [modalLogin, modalRegister, modalProfile].forEach(m => {
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    }
  });

  // Initial Load
  renderAuthHeader();
  setRole(store.getCurrentRole());
});
