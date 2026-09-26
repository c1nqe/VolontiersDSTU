/**
 * Демонстрационные данные ДГТУ (seed).
 */

export const STORAGE_KEY = 'volontiers_dstu_state_v1';

export const INITIAL_DATA = {
  currentUserRole: 'PUBLIC', // PUBLIC | ADMIN | ORGANIZER | VOLUNTEER
  activeVolunteerId: 'vol-1',
  activeOrgId: 'org-1',
  currentUserId: null, // Не авторизован по умолчанию
  jwtToken: null,

  // Пользователи системы с учетными записями
  users: [
    {
      id: 'usr-admin-1',
      firstName: 'Алексей',
      lastName: 'Координаторов',
      email: 'admin@donstu.ru',
      password: 'admin123',
      role: 'ADMIN',
      createdAt: '2026-09-01T10:00:00Z'
    },
    {
      id: 'usr-org-1',
      firstName: 'Екатерина',
      lastName: 'Смирнова',
      email: 'organizer@donstu.ru',
      password: 'org123',
      role: 'ORGANIZER',
      orgId: 'org-1',
      createdAt: '2026-09-01T11:00:00Z'
    },
    {
      id: 'usr-vol-1',
      firstName: 'Алексей',
      lastName: 'Иванов',
      email: 'volunteer@donstu.ru',
      password: 'vol123',
      role: 'VOLUNTEER',
      volunteerId: 'vol-1',
      createdAt: '2026-09-02T12:00:00Z'
    }
  ],
  
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
  ],

  // Метки на карте: обычные волонтёрские и поисково-спасательные
  mapMarkers: [
    {
      id: 'mark-1',
      lat: 47.2357,
      lng: 39.7128,
      type: 'SEARCH_RESCUE', // Поисково-спасательная
      title: 'Поиск: Михайлов А.Р., 72 года',
      description: 'Пожилой мужчина ушёл из дома утром 22.09, одет в серую куртку и синие брюки. Район поиска — Левобережная зона, ориентир: остановка «Стройгородок».',
      status: 'ACTIVE', // ACTIVE | FOUND | CLOSED
      urgency: 'HIGH', // HIGH | MEDIUM | LOW
      contactPhone: '+7 (863) 267-00-02',
      createdBy: 'vol-3',
      createdByName: 'Сидоров Денис Олегович',
      createdAt: '2026-09-22T08:30:00',
      lastSeenDate: '2026-09-22',
      lastSeenLocation: 'ул. Нансена, 52, Ростов-на-Дону'
    },
    {
      id: 'mark-2',
      lat: 47.2226,
      lng: 39.7189,
      type: 'SEARCH_RESCUE',
      title: 'Поиск: Козлова Е.С., 15 лет',
      description: 'Школьница не вернулась домой после занятий. Последний раз видели возле ТЦ «Горизонт». Рост 163 см, длинные тёмные волосы, школьная форма.',
      status: 'FOUND', // Найдена
      urgency: 'HIGH',
      contactPhone: '+7 (863) 267-00-02',
      createdBy: 'vol-1',
      createdByName: 'Иванов Алексей Дмитриевич',
      createdAt: '2026-09-20T16:00:00',
      lastSeenDate: '2026-09-20',
      lastSeenLocation: 'ТЦ «Горизонт», пр. Стачки, 186'
    },
    {
      id: 'mark-3',
      lat: 47.2383,
      lng: 39.7131,
      type: 'REGULAR', // Обычное волонтёрство
      title: 'Помощь пожилым: разнос продуктов',
      description: 'Нужны 3 волонтёра для развоза продуктовых наборов по адресам одиноких пенсионеров в Ворошиловском районе. Пакеты собраны, нужен транспорт или самовывоз.',
      status: 'ACTIVE',
      urgency: 'MEDIUM',
      contactPhone: '+7 (918) 550-33-21',
      createdBy: 'vol-2',
      createdByName: 'Петрова Мария Викторовна',
      createdAt: '2026-09-23T10:00:00',
      lastSeenDate: null,
      lastSeenLocation: null
    },
    {
      id: 'mark-4',
      lat: 47.2288,
      lng: 39.7450,
      type: 'REGULAR',
      title: 'Уборка территории приюта для животных',
      description: 'Субботник в приюте «Добрые руки». Требуется 5–10 человек для уборки вольеров, выгула собак, починки ограждений. Инвентарь предоставляется.',
      status: 'ACTIVE',
      urgency: 'LOW',
      contactPhone: '+7 (928) 195-77-00',
      createdBy: 'vol-1',
      createdByName: 'Иванов Алексей Дмитриевич',
      createdAt: '2026-09-24T09:00:00',
      lastSeenDate: null,
      lastSeenLocation: null
    },
    {
      id: 'mark-5',
      lat: 47.2157,
      lng: 39.7050,
      type: 'SEARCH_RESCUE',
      title: 'Поиск: Белов В.Н., 83 года',
      description: 'Дедушка с деменцией пропал с территории частного дома на Левенцовке. Приметы: невысокий, седые волосы, ходит с тростью, одет в коричневый пиджак.',
      status: 'PENDING_APPROVAL',
      urgency: 'HIGH',
      contactPhone: '+7 (863) 267-00-02',
      createdBy: 'vol-3',
      createdByName: 'Сидоров Денис Олегович',
      createdAt: '2026-09-24T07:15:00',
      lastSeenDate: '2026-09-24',
      lastSeenLocation: 'мкр. Левенцовский, ул. Ленточная, 8',
      closureProof: {
        photo: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=600&q=80',
        note: 'Мужчина успешно обнаружен патрулём ПСО «Горящие сердца» в лесопарковой зоне у водоёма. Состояние удовлетворительное, передан медикам и родственникам.',
        targetStatus: 'FOUND',
        submittedBy: 'vol-3',
        submittedByName: 'Сидоров Денис Олегович',
        submittedAt: '2026-09-24T18:45:00'
      }
    }
  ],

  // Отзывы волонтёров о проведённых мероприятиях
  eventReviews: [
    {
      id: 'rev-1',
      eventId: 'evt-1',
      volonteerId: 'vol-2',
      authorName: 'Петрова Мария Викторовна',
      rating: 5,
      text: 'Отлично организованный день: у каждого была понятная зона ответственности, координаторы всегда на связи. Абитуриенты благодарили за помощь с навигацией.',
      createdAt: '2026-09-16T12:30:00'
    },
    {
      id: 'rev-2',
      eventId: 'evt-1',
      volonteerId: 'vol-3',
      authorName: 'Сидоров Денис Олегович',
      rating: 4,
      text: 'Всё прошло хорошо, но в первые часы не хватало буклетов на стойке регистрации. В остальном — отличная команда.',
      createdAt: '2026-09-16T18:05:00'
    }
  ]
};
