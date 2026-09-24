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
  
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerDesc = document.getElementById('bannerDesc');
  const contextControls = document.getElementById('contextControls');
  const toastContainer = document.getElementById('toastContainer');
  const btnResetData = document.getElementById('btnResetData');

  // Modals
  const modalCreateEvent = document.getElementById('modalCreateEvent');
  const btnOpenCreateEventModal = document.getElementById('btnOpenCreateEventModal');

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
    store.setCurrentRole(role);

    roleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    viewAdmin.style.display = role === 'ADMIN' ? 'block' : 'none';
    viewOrganizer.style.display = role === 'ORGANIZER' ? 'block' : 'none';
    viewVolunteer.style.display = role === 'VOLUNTEER' ? 'block' : 'none';

    updateContextBanner(role);
    renderCurrentRoleView();
  }

  function updateContextBanner(role) {
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

  // Initial Load
  setRole(store.getCurrentRole());
});
