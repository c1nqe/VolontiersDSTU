/**
 * Имитационная база данных и слой состояния для VolontiersDSTU
 * Хранит данные в localStorage, инициализирует реалистичные тестовые данные ДГТУ
 */

const STORAGE_KEY = 'volontiers_dstu_state_v1';

const INITIAL_DATA = {
  currentUserRole: 'ADMIN', // ADMIN | ORGANIZER | VOLUNTEER
  activeVolunteerId: 'vol-1',
  activeOrgId: 'org-1',
  
  organizations: [
    {
      id: 'org-1',
      name: 'Волонтёрский центр ДГТУ «Горящие сердца»',
      inn: '6165033140',
      contactPerson: 'Смирнова Екатерина Павловна',
      email: 'hearts@donstu.ru',
      phone: '+7 (863) 273-84-90',
      description: 'Центр координации ключевых социально-значимых и культурных инициатив университета.'
    },
    {
      id: 'org-2',
      name: 'Спортивный клуб «Донские Соколы»',
      inn: '6165044231',
      contactPerson: 'Ковалев Артем Сергеевич',
      email: 'sport@donstu.ru',
      phone: '+7 (863) 238-15-20',
      description: 'Организация студенческих спартакиад, легкоатлетических марафонов и турниров.'
    },
    {
      id: 'org-3',
      name: 'АНО «Эко-Дон»',
      inn: '6164998212',
      contactPerson: 'Васильева Анна Игоревна',
      email: 'eco.don@mail.ru',
      phone: '+7 (918) 555-12-34',
      description: 'Городские экологические субботники, посадка деревьев и раздельный сбор отходов.'
    }
  ],

  volunteers: [
    {
      id: 'vol-1',
      fullName: 'Иванов Алексей Дмитриевич',
      email: 'alex.ivanov@edu.donstu.ru',
      phone: '+7 (909) 400-11-22',
      studentId: 'СТ-2022-4192',
      faculty: 'Информатика и вычислительная техника',
      birthDate: '2004-05-14',
      totalConfirmedHours: 16
    },
    {
      id: 'vol-2',
      fullName: 'Петрова Мария Викторовна',
      email: 'masha.petrova@edu.donstu.ru',
      phone: '+7 (951) 820-33-44',
      studentId: 'СТ-2023-1108',
      faculty: 'Медиакоммуникации и мультимедийные технологии',
      birthDate: '2005-08-22',
      totalConfirmedHours: 8
    },
    {
      id: 'vol-3',
      fullName: 'Сидоров Денис Олегович',
      email: 'denis.sid@edu.donstu.ru',
      phone: '+7 (928) 111-99-88',
      studentId: 'СТ-2021-0854',
      faculty: 'Авиастроение',
      birthDate: '2003-11-03',
      totalConfirmedHours: 24
    }
  ],

  events: [
    {
      id: 'evt-1',
      title: 'День открытых дверей ДГТУ — Осень 2026',
      description: 'Помощь в навигации абитуриентов, регистрация гостей в главном корпусе, работа в фотозоне и раздача информационных буклетов.',
      location: 'г. Ростов-на-Дону, пл. Гагарина, 1 (Главный корпус ДГТУ)',
      startDate: '2026-09-15',
      endDate: '2026-09-15',
      plannedHours: 8,
      requiredVolunteers: 25,
      status: 'CLOSED', // Закрыто организатором
      organizationId: 'org-1'
    },
    {
      id: 'evt-2',
      title: 'Всероссийский студенческий хакатон «ВЕСНА ’25»',
      description: 'Координация команд, встреча экспертов и менторов Сбера, помощь в организации кофе-брейков и контроль тайминга питч-сессий.',
      location: 'ДГТУ, Коворкинг «Gagarin», 7 корпус',
      startDate: '2026-09-28',
      endDate: '2026-09-30',
      plannedHours: 16,
      requiredVolunteers: 15,
      status: 'ACCEPTED', // Одобрено админом, доступно волонтерам
      organizationId: 'org-1'
    },
    {
      id: 'evt-3',
      title: 'Осенний благотворительный забег «Ростов Бежит»',
      description: 'Дежурство на точках гидратации, выдача стартовых пакетов участникам забега, награждение финишеров памятными медалями.',
      location: 'Парк культуры и отдыха им. Островского',
      startDate: '2026-10-04',
      endDate: '2026-10-04',
      plannedHours: 6,
      requiredVolunteers: 30,
      status: 'ACCEPTED', // Одобрено админом
      organizationId: 'org-2'
    },
    {
      id: 'evt-4',
      title: 'Экологическая акция «Чистый берег Дона»',
      description: 'Уборка прибрежной полосы реки Дон от пластика и стекла, сортировка собранного вторсырья для дальнейшей переработки.',
      location: 'Набережная р. Дон, сбор у памятника Шолохову',
      startDate: '2026-10-10',
      endDate: '2026-10-10',
      plannedHours: 5,
      requiredVolunteers: 40,
      status: 'CREATED', // Новое событие, ждет модерации администратора
      organizationId: 'org-3'
    },
    {
      id: 'evt-5',
      title: 'Киберспортивный турнир ДГТУ по Dota 2 & CS',
      description: 'Техническая поддержка стрим-зоны, регистрация киберспортсменов, контроль посадки зрителей в актовом зале.',
      location: 'ДГТУ, Студенческий кампус, медиа-центр',
      startDate: '2026-10-18',
      endDate: '2026-10-19',
      plannedHours: 10,
      requiredVolunteers: 12,
      status: 'CREATED', // Новое событие, ждет модерации
      organizationId: 'org-2'
    }
  ],

  requests: [
    {
      id: 'req-1',
      volonteerId: 'vol-1',
      eventId: 'evt-1',
      status: 'CONFIRMED', // Подтверждено, часы зачислены
      requestedHours: 8,
      confirmedHours: 8,
      createdAt: '2026-09-02'
    },
    {
      id: 'req-2',
      volonteerId: 'vol-2',
      eventId: 'evt-1',
      status: 'CONFIRMED',
      requestedHours: 8,
      confirmedHours: 8,
      createdAt: '2026-09-03'
    },
    {
      id: 'req-3',
      volonteerId: 'vol-3',
      eventId: 'evt-1',
      status: 'CONFIRMED',
      requestedHours: 8,
      confirmedHours: 8,
      createdAt: '2026-09-01'
    },
    {
      id: 'req-4',
      volonteerId: 'vol-1',
      eventId: 'evt-2',
      status: 'ACCEPTED', // Принята организатором
      requestedHours: 16,
      confirmedHours: null,
      createdAt: '2026-09-20'
    },
    {
      id: 'req-5',
      volonteerId: 'vol-2',
      eventId: 'evt-2',
      status: 'PENDING', // Ожидает решения организатора
      requestedHours: 16,
      confirmedHours: null,
      createdAt: '2026-09-22'
    }
  ]
};

class DataStore {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Ошибка загрузки из localStorage', e);
    }
    this.save(INITIAL_DATA);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  save(dataToSave = this.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Ошибка сохранения в localStorage', e);
    }
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.save();
    return this.data;
  }

  // Роли и пользователи
  getCurrentRole() {
    return this.data.currentUserRole;
  }

  setCurrentRole(role) {
    this.data.currentUserRole = role;
    this.save();
  }

  getActiveVolunteer() {
    return this.data.volunteers.find(v => v.id === this.data.activeVolunteerId) || this.data.volunteers[0];
  }

  setActiveVolunteer(id) {
    this.data.activeVolunteerId = id;
    this.save();
  }

  getActiveOrg() {
    return this.data.organizations.find(o => o.id === this.data.activeOrgId) || this.data.organizations[0];
  }

  setActiveOrg(id) {
    this.data.activeOrgId = id;
    this.save();
  }

  // Организации
  getOrganizations() {
    return this.data.organizations;
  }

  addOrganization(orgData) {
    const newOrg = {
      id: 'org-' + Date.now(),
      ...orgData
    };
    this.data.organizations.push(newOrg);
    this.save();
    return newOrg;
  }

  // Волонтёры
  getVolunteers() {
    // Пересчитываем суммарные подтвержденные часы
    return this.data.volunteers.map(vol => {
      const confirmedHours = this.data.requests
        .filter(r => r.volonteerId === vol.id && r.status === 'CONFIRMED')
        .reduce((sum, r) => sum + (Number(r.confirmedHours) || 0), 0);
      return { ...vol, totalConfirmedHours: confirmedHours };
    });
  }

  addVolunteer(volData) {
    const newVol = {
      id: 'vol-' + Date.now(),
      totalConfirmedHours: 0,
      ...volData
    };
    this.data.volunteers.push(newVol);
    this.save();
    return newVol;
  }

  // События
  getEvents() {
    return this.data.events.map(evt => {
      const org = this.data.organizations.find(o => o.id === evt.organizationId);
      const reqCount = this.data.requests.filter(r => r.eventId === evt.id).length;
      const approvedCount = this.data.requests.filter(r => r.eventId === evt.id && (r.status === 'ACCEPTED' || r.status === 'CONFIRMED')).length;
      return {
        ...evt,
        organizationName: org ? org.name : 'Неизвестная организация',
        requestsCount: reqCount,
        approvedVolunteersCount: approvedCount
      };
    });
  }

  addEvent(eventData) {
    const newEvent = {
      id: 'evt-' + Date.now(),
      status: 'CREATED', // Исходный статус
      ...eventData
    };
    this.data.events.unshift(newEvent);
    this.save();
    return newEvent;
  }

  updateEventStatus(eventId, newStatus) {
    const evt = this.data.events.find(e => e.id === eventId);
    if (evt) {
      evt.status = newStatus;
      this.save();
      return evt;
    }
    return null;
  }

  // Заявки
  getRequests() {
    return this.data.requests.map(req => {
      const vol = this.data.volunteers.find(v => v.id === req.volonteerId);
      const evt = this.data.events.find(e => e.id === req.eventId);
      const org = evt ? this.data.organizations.find(o => o.id === evt.organizationId) : null;
      return {
        ...req,
        volonteerName: vol ? vol.fullName : 'Неизвестный волонтер',
        volonteerFaculty: vol ? vol.faculty : '',
        volonteerStudentId: vol ? vol.studentId : '',
        eventTitle: evt ? evt.title : 'Неизвестное событие',
        eventDate: evt ? evt.startDate : '',
        eventStatus: evt ? evt.status : '',
        organizationName: org ? org.name : ''
      };
    });
  }

  submitRequest(volonteerId, eventId) {
    // Проверка, есть ли уже заявка
    const existing = this.data.requests.find(r => r.volonteerId === volonteerId && r.eventId === eventId);
    if (existing) {
      return { success: false, message: 'Заявка на это событие уже была подана ранее!' };
    }

    const evt = this.data.events.find(e => e.id === eventId);
    const newReq = {
      id: 'req-' + Date.now(),
      volonteerId,
      eventId,
      status: 'PENDING',
      requestedHours: evt ? evt.plannedHours : 4,
      confirmedHours: null,
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.data.requests.unshift(newReq);
    this.save();
    return { success: true, request: newReq };
  }

  updateRequestStatus(requestId, newStatus, confirmedHours = null) {
    const req = this.data.requests.find(r => r.id === requestId);
    if (req) {
      req.status = newStatus;
      if (confirmedHours !== null) {
        req.confirmedHours = Number(confirmedHours);
      }
      this.save();
      return req;
    }
    return null;
  }

  // Выписка об отработанных часах (Volunteer Statement Report)
  getVolunteerStatement(volonteerId, startDateStr, endDateStr) {
    const vol = this.data.volunteers.find(v => v.id === volonteerId);
    if (!vol) return null;

    const startDate = startDateStr ? new Date(startDateStr) : new Date('2020-01-01');
    const endDate = endDateStr ? new Date(endDateStr) : new Date('2030-12-31');

    // Критерии из презентации:
    // "Получает выписку об отработанных часах на закрытых событиях (VolonteerEventRequest = CONFIRMED) за период"
    const validItems = [];
    let totalHours = 0;

    this.data.requests.forEach(req => {
      if (req.volonteerId === volonteerId && req.status === 'CONFIRMED') {
        const evt = this.data.events.find(e => e.id === req.eventId);
        if (evt && evt.status === 'CLOSED') {
          const eventDate = new Date(evt.startDate);
          if (eventDate >= startDate && eventDate <= endDate) {
            const org = this.data.organizations.find(o => o.id === evt.organizationId);
            const hours = Number(req.confirmedHours) || Number(req.requestedHours) || 0;
            totalHours += hours;
            validItems.push({
              eventName: evt.title,
              organizationName: org ? org.name : 'ДГТУ',
              eventDate: evt.startDate,
              location: evt.location,
              confirmedHours: hours
            });
          }
        }
      }
    });

    return {
      volunteer: vol,
      startDate: startDateStr,
      endDate: endDateStr,
      generatedAt: new Date().toLocaleDateString('ru-RU'),
      items: validItems,
      totalHours
    };
  }
}

// Экспортируем глобальный экземпляр
window.appStore = new DataStore();
