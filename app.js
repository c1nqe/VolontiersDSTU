/**
 * VolontiersDSTU — Основная логика приложения
 * Хакатон ВЕСНА '25 | ДГТУ
 */

document.addEventListener('DOMContentLoaded', () => {
  const store = window.appStore;

  // DOM Elements
  const roleSelector = document.getElementById('roleSelector');
  const roleButtons = roleSelector.querySelectorAll('.role-btn');
  const viewAdmin = document.getElementById('viewAdmin');
  const viewOrganizer = document.getElementById('viewOrganizer');
  const viewVolunteer = document.getElementById('viewVolunteer');
  const viewMap = document.getElementById('viewMap');
  
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerDesc = document.getElementById('bannerDesc');
  const contextControls = document.getElementById('contextControls');
  const toastContainer = document.getElementById('toastContainer');
  const btnResetData = document.getElementById('btnResetData');

  // Modals
  const modalCreateEvent = document.getElementById('modalCreateEvent');
  const btnOpenCreateEventModal = document.getElementById('btnOpenCreateEventModal');
  const modalAddMarker = document.getElementById('modalAddMarker');
  const btnOpenAddMarkerModal = document.getElementById('btnOpenAddMarkerModal');

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
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================
  // 2. Role Switching & Navigation
  // ==========================================
  function setRole(role) {
    store.setCurrentRole(role === 'MAP' ? store.getCurrentRole() : role);

    roleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    viewAdmin.style.display = role === 'ADMIN' ? 'block' : 'none';
    viewOrganizer.style.display = role === 'ORGANIZER' ? 'block' : 'none';
    viewVolunteer.style.display = role === 'VOLUNTEER' ? 'block' : 'none';
    viewMap.style.display = role === 'MAP' ? 'block' : 'none';

    updateContextBanner(role);

    if (role === 'MAP') {
      renderMapView();
    } else {
      renderCurrentRoleView();
    }
  }

  function updateContextBanner(role) {
    document.getElementById('contextBanner').style.display = 'flex';

    if (role === 'ADMIN') {
      bannerTitle.textContent = 'Рабочее место администратора';
      bannerDesc.textContent = 'Регистрация организаторов и волонтёров, согласование и отмена событий';
      contextControls.innerHTML = `
        <span style="font-size: 0.85rem; color: #94a3b8;">Полномочия: Главный координатор</span>
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
            ${orgs.map(o => `<option value="${o.id}" ${o.id === currentOrg.id ? 'selected' : ''}>${o.name}</option>`).join('')}
          </select>
        </div>
      `;

      document.getElementById('selectActiveOrg').addEventListener('change', (e) => {
        store.setActiveOrg(e.target.value);
        showToast(`Выбрана организация: ${store.getActiveOrg().name}`);
        renderOrganizerView();
      });
    } else if (role === 'VOLUNTEER') {
      bannerTitle.textContent = 'Рабочее место волонтёра';
      bannerDesc.textContent = 'Поиск событий, подача заявок и выписка подтверждённых часов';
      
      const vols = store.getVolunteers();
      const currentVol = store.getActiveVolunteer();

      contextControls.innerHTML = `
        <div class="context-selector">
          <label for="selectActiveVol">Профиль:</label>
          <select id="selectActiveVol">
            ${vols.map(v => `<option value="${v.id}" ${v.id === currentVol.id ? 'selected' : ''}>${v.fullName}</option>`).join('')}
          </select>
        </div>
      `;

      document.getElementById('selectActiveVol').addEventListener('change', (e) => {
        store.setActiveVolunteer(e.target.value);
        showToast(`Выбран волонтёр: ${store.getActiveVolunteer().fullName}`);
        renderVolunteerView();
      });
    } else if (role === 'MAP') {
      bannerTitle.textContent = 'Интерактивная карта волонтёров и поисков';
      bannerDesc.textContent = 'Координация поисково-спасательных операций (ПСО) и точек помощи в г. Ростов-на-Дону';
      contextControls.innerHTML = `
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="badge" style="background: rgba(220,38,38,0.2); color: #fca5a5;">🔴 ПСО</span>
          <span class="badge" style="background: rgba(37,99,235,0.2); color: #93c5fd;">🔵 Волонтёрство</span>
        </div>
      `;
    }
  }

  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });

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

  // Reset Data Handler
  btnResetData.addEventListener('click', () => {
    if (confirm('Сбросить данные к исходному демонстрационному состоянию?')) {
      store.reset();
      showToast('Демонстрационные данные успешно сброшены!');
      renderCurrentRoleView();
      updateContextBanner(store.getCurrentRole());
    }
  });

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

    // Moderation List
    const modContainer = document.getElementById('adminModerationList');
    if (pendingEvents.length === 0) {
      modContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🎉</div>
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
              <span style="font-size: 0.8rem; color: #64748b;">${evt.startDate}</span>
            </div>
            <div class="event-title">${evt.title}</div>
            <div class="event-org">🏢 ${evt.organizationName}</div>
            <div class="event-desc">${evt.description}</div>
            <div class="event-meta">
              <div class="event-meta-item">📍 ${evt.location}</div>
              <div class="event-meta-item">⏱️ Плановые часы: <strong>${evt.plannedHours} ч</strong></div>
              <div class="event-meta-item">👥 Требуется волонтёров: <strong>${evt.requiredVolunteers} чел.</strong></div>
            </div>
          </div>
          <div class="event-footer">
            <button class="btn btn-danger btn-sm btn-reject-event" data-id="${evt.id}">
              ✕ Отклонить
            </button>
            <button class="btn btn-accent btn-sm btn-accept-event" data-id="${evt.id}">
              ✓ Согласовать событие
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

    // Registry: Orgs table
    const tableOrgsBody = document.querySelector('#adminTableOrgs tbody');
    tableOrgsBody.innerHTML = orgs.map(o => `
      <tr>
        <td><strong>${o.name}</strong><br><span style="color: #64748b; font-size: 0.8rem;">${o.description || ''}</span></td>
        <td>${o.contactPerson}</td>
        <td>✉️ ${o.email}<br>📞 ${o.phone}</td>
        <td>${o.inn || '—'}</td>
      </tr>
    `).join('');

    // Registry: Vols table
    const tableVolsBody = document.querySelector('#adminTableVols tbody');
    tableVolsBody.innerHTML = vols.map(v => `
      <tr>
        <td><strong>${v.fullName}</strong></td>
        <td><code>${v.studentId || '—'}</code></td>
        <td>${v.faculty || '—'}</td>
        <td>✉️ ${v.email}<br>📞 ${v.phone}</td>
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
          <div class="empty-state-icon">📂</div>
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
                <span style="font-size: 0.8rem; color: #64748b;">${evt.startDate}</span>
              </div>
              <div class="event-title">${evt.title}</div>
              <div class="event-desc">${evt.description}</div>
              <div class="event-meta">
                <div class="event-meta-item">📍 ${evt.location}</div>
                <div class="event-meta-item">👥 Набрано волонтёров: <strong>${evt.approvedVolunteersCount} / ${evt.requiredVolunteers}</strong></div>
                <div class="event-meta-item">⏱️ Длительность: <strong>${evt.plannedHours} ч</strong></div>
              </div>
            </div>
            <div class="event-footer">
              <span style="font-size: 0.8rem; color: #64748b;">Заявок: ${evt.requestsCount}</span>
              ${evt.status === 'ACCEPTED' ? `
                <button class="btn btn-outline btn-sm btn-close-event" data-id="${evt.id}">
                  🔒 Закрыть событие (CLOSED)
                </button>
              ` : evt.status === 'CLOSED' ? `
                <span style="font-size: 0.8rem; color: #047857; font-weight: 600;">✓ Завершено</span>
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
                <button class="btn btn-accent btn-sm btn-confirm-work" data-id="${r.id}">
                  ✓ Подтвердить
                </button>
              </div>
            ` : `
              <span style="font-size: 0.85rem; color: #047857; font-weight: 600;">✓ Часы начислены (${r.confirmedHours} ч)</span>
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
          <div class="empty-state-icon">🔍</div>
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
          if (existingReq.status === 'ACCEPTED') { reqBadge = 'badge-accepted'; reqText = 'Вы приняты!'; }
          else if (existingReq.status === 'CONFIRMED') { reqBadge = 'badge-confirmed'; reqText = `Часы подтверждены (${existingReq.confirmedHours} ч)`; }
          else if (existingReq.status === 'CANCELLED') { reqBadge = 'badge-cancelled'; reqText = 'Заявка отклонена'; }

          actionButtonHtml = `<span class="badge ${reqBadge}">✓ ${reqText}</span>`;
        }

        return `
          <div class="event-card">
            <div>
              <div class="event-header">
                <span class="badge badge-accepted">Набор открыт</span>
                <span style="font-size: 0.8rem; color: #64748b;">${evt.startDate}</span>
              </div>
              <div class="event-title">${evt.title}</div>
              <div class="event-org">🏢 ${evt.organizationName}</div>
              <div class="event-desc">${evt.description}</div>
              <div class="event-meta">
                <div class="event-meta-item">📍 ${evt.location}</div>
                <div class="event-meta-item">⏱️ Опыт: <strong>+${evt.plannedHours} часов</strong></div>
                <div class="event-meta-item">👥 Требуется волонтёров: <strong>${evt.requiredVolunteers} чел.</strong></div>
              </div>
            </div>
            <div class="event-footer">
              <span style="font-size: 0.8rem; color: #64748b;">Одобрено: ${evt.approvedVolunteersCount}</span>
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
          <div class="empty-state-icon">📋</div>
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
            ★ ВЕСНА '25 ★<br>
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
          const latInput = document.getElementById('markerLat');
          const lngInput = document.getElementById('markerLng');
          if (latInput && lngInput) {
            latInput.value = e.latlng.lat.toFixed(4);
            lngInput.value = e.latlng.lng.toFixed(4);
          }
          if (!modalAddMarker.classList.contains('open')) {
            modalAddMarker.classList.add('open');
            showToast('📍 Координаты установлены! Заполните остальные поля метки.', 'info');
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
        <div style="position: absolute; top: 12px; left: 14px; z-index: 10; background: rgba(255,255,255,0.92); backdrop-filter: blur(4px); padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 6px;">
          <span>🗺️</span> <strong>Карта Ростова-на-Дону (ДГТУ)</strong>
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
        <div id="svgMarkerPopup" style="display: none; position: absolute; z-index: 100; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); padding: 16px; width: 280px; border: 1px solid #e2e8f0; pointer-events: auto;"></div>
      </div>
    `;

    // Клик по SVG карте → получение координат и открытие модального окна
    const svg = document.getElementById('svgMapCanvas');
    if (svg) {
      svg.addEventListener('click', (e) => {
        // Если кликнули по самой метке, не открываем модалку создания
        if (e.target.closest('.svg-marker-node')) return;

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
          showToast('📍 Координаты установлены на карте! Заполните данные метки.', 'info');
        }
      });
    }
  }

  function getMarkerColor(marker) {
    if (marker.status === 'FOUND') return '#16a34a';
    if (marker.status === 'CLOSED') return '#6b7280';
    if (marker.type === 'SEARCH_RESCUE') return '#dc2626';
    return '#2563eb';
  }

  function getMarkerRadius(marker) {
    if (marker.type === 'SEARCH_RESCUE' && marker.status === 'ACTIVE') return 12;
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
      markers = markers.filter(m => m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'REGULAR') {
      markers = markers.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'FOUND') {
      markers = markers.filter(m => m.status === 'FOUND');
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
          weight: 2,
          opacity: 1,
          fillOpacity: isActive ? 0.9 : 0.5
        }).addTo(mapMarkerLayer);

        if (m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE' && m.urgency === 'HIGH') {
          L.circleMarker([m.lat, m.lng], {
            radius: radius + 8,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.1
          }).addTo(mapMarkerLayer);
        }

        const typeLabel = m.type === 'SEARCH_RESCUE' ? '🔴 Поисково-спасательная' : '🔵 Обычное волонтёрство';
        let statusLabel = 'Активна';
        let statusColor = color;
        if (m.status === 'FOUND') { statusLabel = '✅ Человек найден'; statusColor = '#16a34a'; }
        else if (m.status === 'CLOSED') { statusLabel = 'Закрыта'; statusColor = '#6b7280'; }

        const urgencyHtml = m.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
          : m.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
          : '<span class="urgency-badge urgency-low">Низкая</span>';

        const lastSeenHtml = m.lastSeenLocation
          ? `<div style="font-size: 0.75rem; margin-top: 0.3rem;"><strong>Последнее место:</strong> ${m.lastSeenLocation} (${m.lastSeenDate})</div>`
          : '';

        let actionsHtml = '';
        if (m.status === 'ACTIVE') {
          if (m.type === 'SEARCH_RESCUE') {
            actionsHtml = `
              <div class="map-popup-actions">
                <button class="btn btn-accent btn-sm" onclick="window._mapMarkFound('${m.id}')">✅ Найден</button>
                <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${m.id}')">Закрыть</button>
              </div>`;
          } else {
            actionsHtml = `
              <div class="map-popup-actions">
                <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${m.id}')">Закрыть метку</button>
              </div>`;
          }
        }

        circle.bindPopup(`
          <div class="map-popup">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
              <span style="font-size: 0.75rem; color: ${statusColor}; font-weight: 700;">${statusLabel}</span>
              ${urgencyHtml}
            </div>
            <h4>${m.title}</h4>
            <p>${m.description}</p>
            ${lastSeenHtml}
            <div class="map-popup-meta">
              <div>${typeLabel}</div>
              <div>📞 ${m.contactPhone || 'Не указан'}</div>
              <div>👤 ${m.createdByName} • ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</div>
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
      const isUrgent = m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE' && m.urgency === 'HIGH';

      return `
        <g class="svg-marker-node" data-id="${m.id}" data-x="${pt.x}" data-y="${pt.y}" style="cursor: pointer;">
          ${isUrgent ? `
            <circle cx="${pt.x}" cy="${pt.y}" r="22" fill="${color}" opacity="0.25">
              <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2s" repeatCount="indefinite"/>
            </circle>
          ` : ''}
          <circle cx="${pt.x}" cy="${pt.y}" r="${m.type === 'SEARCH_RESCUE' ? '12' : '9'}" fill="${color}" stroke="#ffffff" stroke-width="2.5" />
          <text x="${pt.x}" y="${pt.y - 15}" fill="#0f172a" font-size="11" font-weight="700" text-anchor="middle" style="text-shadow: 0 1px 3px rgba(255,255,255,0.9);">
            ${m.type === 'SEARCH_RESCUE' ? '🔴 ' : '🔵 '}${m.title.length > 25 ? m.title.substring(0, 25) + '...' : m.title}
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
    const typeLabel = marker.type === 'SEARCH_RESCUE' ? '🔴 Поисково-спасательная' : '🔵 Обычное волонтёрство';
    let statusLabel = 'Активна';
    if (marker.status === 'FOUND') statusLabel = '✅ Человек найден';
    else if (marker.status === 'CLOSED') statusLabel = 'Закрыта';

    const urgencyHtml = marker.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
      : marker.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
      : '<span class="urgency-badge urgency-low">Низкая</span>';

    const lastSeenHtml = marker.lastSeenLocation
      ? `<div style="font-size: 0.75rem; margin-top: 0.3rem;"><strong>Последнее место:</strong> ${marker.lastSeenLocation} (${marker.lastSeenDate})</div>`
      : '';

    let actionsHtml = '';
    if (marker.status === 'ACTIVE') {
      if (marker.type === 'SEARCH_RESCUE') {
        actionsHtml = `
          <div class="map-popup-actions">
            <button class="btn btn-accent btn-sm" onclick="window._mapMarkFound('${marker.id}')">✅ Найден</button>
            <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${marker.id}')">Закрыть</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="map-popup-actions">
            <button class="btn btn-outline btn-sm" onclick="window._mapCloseMarker('${marker.id}')">Закрыть метку</button>
          </div>`;
      }
    }

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <span style="font-size: 0.75rem; color: ${color}; font-weight: 700;">${statusLabel}</span>
        ${urgencyHtml}
      </div>
      <h4 style="font-size: 0.95rem; margin-bottom: 0.4rem;">${marker.title}</h4>
      <p style="font-size: 0.8rem; color: #475569; margin-bottom: 0.4rem;">${marker.description}</p>
      ${lastSeenHtml}
      <div class="map-popup-meta">
        <div>${typeLabel}</div>
        <div>📞 ${marker.contactPhone || 'Не указан'}</div>
        <div>👤 ${marker.createdByName}</div>
      </div>
      ${actionsHtml}
      <button style="position: absolute; top: 8px; right: 8px; border: none; background: transparent; font-size: 1.1rem; cursor: pointer; color: #94a3b8;" onclick="document.getElementById('svgMarkerPopup').style.display='none'">&times;</button>
    `;

    // Позиционируем попап
    const container = document.getElementById('mapContainer');
    const cWidth = container.offsetWidth || 800;
    const cHeight = container.offsetHeight || 550;
    const relX = (x / 900) * cWidth;
    const relY = (y / 550) * cHeight;

    const left = Math.min(cWidth - 290, Math.max(10, relX - 140));
    const top = Math.min(cHeight - 240, Math.max(10, relY - 180));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.display = 'block';
  }

  function renderMapStats() {
    const all = store.getMapMarkers('ALL');
    const searchActive = all.filter(m => m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE').length;
    const regular = all.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE').length;
    const found = all.filter(m => m.status === 'FOUND').length;

    document.getElementById('mapStatSearchActive').textContent = searchActive;
    document.getElementById('mapStatRegular').textContent = regular;
    document.getElementById('mapStatFound').textContent = found;
    document.getElementById('mapStatTotal').textContent = all.length;
  }

  function renderMapSidebar() {
    let markers = store.getMapMarkers('ALL');

    if (currentMapFilter === 'SEARCH_RESCUE') {
      markers = markers.filter(m => m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'REGULAR') {
      markers = markers.filter(m => m.type === 'REGULAR' && m.status === 'ACTIVE');
    } else if (currentMapFilter === 'FOUND') {
      markers = markers.filter(m => m.status === 'FOUND');
    }

    const listContainer = document.getElementById('mapMarkerList');

    if (markers.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem;">
          Нет меток для выбранного фильтра
        </div>`;
      return;
    }

    listContainer.innerHTML = markers.map(m => {
      const typeClass = m.status === 'FOUND' ? 'found' : m.type === 'SEARCH_RESCUE' ? 'search-rescue' : 'regular';
      const urgencyHtml = m.urgency === 'HIGH' ? '<span class="urgency-badge urgency-high">Срочно</span>'
        : m.urgency === 'MEDIUM' ? '<span class="urgency-badge urgency-medium">Средняя</span>'
        : '<span class="urgency-badge urgency-low">Низкая</span>';
      const statusText = m.status === 'FOUND' ? '✅ Найден' : m.status === 'CLOSED' ? '⬜ Закрыта' : '';

      return `
        <div class="marker-list-card ${typeClass}" data-lat="${m.lat}" data-lng="${m.lng}" data-id="${m.id}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
            ${urgencyHtml}
            <span style="font-size: 0.7rem; color: #94a3b8;">${new Date(m.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
          <div class="marker-list-title">${m.title}</div>
          <div class="marker-list-meta">
            👤 ${m.createdByName} ${statusText}
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

  // Глобальные функции для кнопок в popup
  window._mapMarkFound = function(markerId) {
    store.updateMarkerStatus(markerId, 'FOUND');
    showToast('🎉 Человек найден! Статус метки обновлён.');
    const popup = document.getElementById('svgMarkerPopup');
    if (popup) popup.style.display = 'none';
    renderMapMarkers();
    renderMapStats();
    renderMapSidebar();
  };

  window._mapCloseMarker = function(markerId) {
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
    showToast(`📍 ${typeText} «${newMarker.title}» размещена на карте!`);

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

  // Initial Load
  setRole(store.getCurrentRole());
});
