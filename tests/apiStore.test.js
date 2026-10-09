import { describe, expect, it, vi } from 'vitest';
import { ApiStore, HYDRATE_QUERY } from '../src/store/ApiStore.js';
import { ApiError, createClient } from '../src/api/client.js';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};

const SNAPSHOT = {
  me: { id: 'u1', firstName: 'Алексей', lastName: 'Иванов', email: 'volunteer@donstu.ru', role: 'VOLUNTEER', createdAt: '2026-09-02T12:00:00Z', organizationId: null, volonteerId: 'v1' },
  session: { expiresAt: '2026-10-10T12:00:00Z' },
  events: [
    { id: 'e1', title: 'Закрытое', status: 'CLOSED', organizationId: 'o1', organizationName: 'Центр', startDate: '2026-09-15', endDate: '2026-09-15', plannedHours: 8, requiredVolunteers: 5, requestsCount: 1, approvedVolunteersCount: 1, ratingAvg: 4.5, reviewsCount: 1 },
    { id: 'e2', title: 'Открытое', status: 'ACCEPTED', organizationId: 'o1', organizationName: 'Центр', startDate: '2026-10-20', endDate: '2026-10-20', plannedHours: 4, requiredVolunteers: 5, requestsCount: 0, approvedVolunteersCount: 0, ratingAvg: null, reviewsCount: 0 },
  ],
  organizations: [{ id: 'o1', name: 'Центр' }, { id: 'o2', name: 'Клуб' }],
  volonteers: [{ id: 'v1', fullName: 'Иванов Алексей', totalConfirmedHours: 8 }],
  requests: [{ id: 'r1', volonteerId: 'v1', eventId: 'e1', status: 'CONFIRMED', confirmedHours: 8, requestedHours: 8 }],
  reviews: [{ id: 'rv1', eventId: 'e1', volonteerId: 'v1', rating: 5, text: 'Отлично организовано, спасибо', createdAt: '2026-09-16T10:00:00Z' }],
  mapMarkers: [
    { id: 'm1', type: 'SEARCH_RESCUE', status: 'ACTIVE', title: 'Поиск', photos: ['/media/photos/p1'] },
    { id: 'm2', type: 'REGULAR', status: 'FOUND', title: 'Помощь', photos: [] },
  ],
};

/** Клиент-заглушка: отвечает на hydrate снимком, остальное — по сценарию. */
function fakeClient(handlers = {}) {
  const calls = [];
  const client = vi.fn(async (query, variables) => {
    calls.push({ query, variables });
    if (query === HYDRATE_QUERY) return structuredClone(SNAPSHOT);
    for (const [needle, fn] of Object.entries(handlers)) if (query.includes(needle)) return fn(variables);
    return {};
  });
  client.calls = calls;
  return client;
}

describe('ApiStore: загрузка и чтение', () => {
  it('загружает данные одним запросом и отдаёт их синхронно', async () => {
    const client = fakeClient();
    const store = new ApiStore({ client, storage: memoryStorage() });
    expect(store.status).toBe('idle');
    await store.init();
    expect(store.status).toBe('ready');
    expect(client).toHaveBeenCalledTimes(1);
    expect(store.getCurrentUser().role).toBe('VOLUNTEER');
    expect(store.getCurrentUser().volunteerId).toBe('v1');
    expect(store.getEvents()).toHaveLength(2);
    expect(store.getEvent('e2').title).toBe('Открытое');
    expect(store.getActiveVolunteer().id).toBe('v1');
    expect(store.getEventReviews('e1')).toHaveLength(1);
    expect(store.getSessionExpiry()).toBe('2026-10-10T12:00:00Z');
  });

  it('фильтрует метки карты', async () => {
    const store = new ApiStore({ client: fakeClient(), storage: memoryStorage() });
    await store.init();
    expect(store.getMapMarkers('ALL')).toHaveLength(2);
    expect(store.getMapMarkers('SEARCH_RESCUE').map((m) => m.id)).toEqual(['m1']);
    expect(store.getMapMarkers('FOUND').map((m) => m.id)).toEqual(['m2']);
  });

  it('при недоступном сервере переходит в состояние error и умеет повторить', async () => {
    let up = false;
    const client = vi.fn(async () => {
      if (!up) throw new ApiError('Сервер недоступен', 'NETWORK');
      return structuredClone(SNAPSHOT);
    });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    expect(store.status).toBe('error');
    expect(store.error).toContain('недоступен');
    up = true;
    await store.init();
    expect(store.status).toBe('ready');
  });

  it('уведомляет подписчиков при обновлении', async () => {
    const store = new ApiStore({ client: fakeClient(), storage: memoryStorage() });
    const listener = vi.fn();
    store.subscribe(listener);
    const v0 = store.getVersion();
    await store.init();
    expect(listener).toHaveBeenCalled();
    expect(store.getVersion()).toBeGreaterThan(v0);
  });
});

describe('ApiStore: мутации идут на сервер', () => {
  it('успешная мутация обновляет кэш', async () => {
    const client = fakeClient({ submitEventRequest: () => ({ submitEventRequest: { id: 'r2', status: 'OPEN' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.submitRequest('v1', 'e2');
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('OPEN');
    const mutation = client.calls.find((c) => c.query.includes('submitEventRequest'));
    expect(mutation.variables).toEqual({ volonteerId: 'v1', eventId: 'e2' });
    expect(client.calls.at(-1).query).toBe(HYDRATE_QUERY); // после мутации кэш перечитан
  });

  it('ошибка сервера превращается в { success: false, message } без исключения', async () => {
    const client = fakeClient({ moderateEvent: () => { throw new ApiError('Недостаточно прав для этого действия', 'FORBIDDEN'); } });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.moderateEvent('e2', 'ACCEPTED');
    expect(res).toMatchObject({ success: false, code: 'FORBIDDEN', message: 'Недостаточно прав для этого действия' });
  });

  it('при истёкшей сессии пользователь становится гостем', async () => {
    let guest = false;
    const client = vi.fn(async (query) => {
      if (query === HYDRATE_QUERY) return guest ? { ...structuredClone(SNAPSHOT), me: null, session: null } : structuredClone(SNAPSHOT);
      guest = true;
      throw new ApiError('Требуется вход в систему', 'UNAUTHENTICATED');
    });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.closeEvent('e2');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Войдите');
    expect(store.getCurrentUser()).toBeNull();
  });

  it('вход не хранит токен в браузере', async () => {
    const storage = memoryStorage();
    const client = fakeClient({ login: () => ({ login: { user: SNAPSHOT.me, expiresAt: 'x' } }) });
    const store = new ApiStore({ client, storage });
    await store.init();
    const res = await store.login(' volunteer@donstu.ru ', 'vol123');
    expect(res.success).toBe(true);
    expect(res.user.volunteerId).toBe('v1');
    expect(client.calls.find((c) => c.query.includes('login(')).variables.email).toBe('volunteer@donstu.ru');
    store.setCurrentRole('VOLUNTEER');
    const saved = [...Array(1)].map(() => storage.getItem('volontiers_ui_v2')).join('');
    expect(saved).not.toMatch(/token|password|jwt/i);
  });

  it('метки: фото уходят на сервер только у ПСО', async () => {
    const client = fakeClient({ createMapMarker: () => ({ createMapMarker: { id: 'm9', title: 'T', lat: 1, lng: 2 } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    await store.addMapMarker({ type: 'REGULAR', title: 'Помощь', description: 'd', lat: 1, lng: 2, urgency: 'LOW', photos: ['data:image/png;base64,AAAA'] });
    await store.addMapMarker({ type: 'SEARCH_RESCUE', title: 'Поиск', description: 'd', lat: 1, lng: 2, urgency: 'HIGH', photos: ['data:image/png;base64,AAAA'] });
    const sent = client.calls.filter((c) => c.query.includes('createMapMarker')).map((c) => c.variables.input.photos.length);
    expect(sent).toEqual([0, 1]);
  });
});

describe('ApiStore: отмена, регистрация и персональные данные', () => {
  it('отмена события уходит на сервер вместе с причиной', async () => {
    const client = fakeClient({ cancelEvent: () => ({ cancelEvent: { id: 'e2', status: 'CANCELLED', cancelReason: 'Погода' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.cancelEvent('e2', '  Погода ');
    expect(res.success).toBe(true);
    expect(client.calls.find((c) => c.query.includes('cancelEvent(')).variables).toEqual({ eventId: 'e2', reason: 'Погода' });
    await store.cancelEvent('e2');
    expect(client.calls.filter((c) => c.query.includes('cancelEvent(')).at(-1).variables.reason).toBeNull();
  });

  it('регистрация без согласия на обработку данных не отправляется', async () => {
    const client = fakeClient({ register: () => ({ register: { user: SNAPSHOT.me, expiresAt: 'x' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.register({ firstName: 'А', lastName: 'Б', email: 'a@b.ru', password: 'Str0ng-pass', role: 'VOLUNTEER', consent: false });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/согласие/);
    expect(client.calls.some((c) => c.query.includes('register('))).toBe(false);
  });

  it('регистрация организатора передаёт название организации, волонтёра — нет', async () => {
    const client = fakeClient({ register: () => ({ register: { user: SNAPSHOT.me, expiresAt: 'x' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const base = { firstName: 'А', lastName: 'Б', email: 'a@b.ru', password: 'Str0ng-pass', consent: true, organizationName: ' Клуб ' };
    await store.register({ ...base, role: 'ORGANIZER' });
    await store.register({ ...base, role: 'VOLUNTEER' });
    const sent = client.calls.filter((c) => c.query.includes('register(')).map((c) => c.variables);
    expect(sent[0]).toMatchObject({ role: 'ORGANIZER', consent: true, organizationName: 'Клуб' });
    expect(sent[1]).toMatchObject({ role: 'VOLUNTEER', consent: true, organizationName: null });
  });

  it('выгрузка данных возвращает JSON-текст и имя файла', async () => {
    const client = fakeClient({ exportMyData: () => ({ exportMyData: '{"account":{}}' }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.exportMyData();
    expect(res.success).toBe(true);
    expect(JSON.parse(res.json)).toEqual({ account: {} });
    expect(res.fileName).toMatch(/^moi-dannye-volontery-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('редактирование профиля отправляет только заданные поля, остальные — null', async () => {
    const client = fakeClient({ updateMyProfile: () => ({ updateMyProfile: { id: 'v1' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    const res = await store.updateMyProfile({ phone: '+7 900 000-00-00', faculty: '' });
    expect(res.success).toBe(true);
    const call = client.calls.find((c) => c.query.includes('updateMyProfile'));
    expect(call.variables).toEqual({ firstName: null, lastName: null, phone: '+7 900 000-00-00', faculty: '', studentId: null });
  });

  it('смена пароля передаёт старый и новый пароль; ошибка сервера возвращается как сообщение', async () => {
    const client = fakeClient({ changePassword: (v) => { if (v.o === 'bad') throw Object.assign(new Error('Текущий пароль указан неверно'), { code: 'BAD_USER_INPUT' }); return { changePassword: true }; } });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    expect((await store.changePassword('vol123', 'Новый-пароль-2026')).success).toBe(true);
    const bad = await store.changePassword('bad', 'Новый-пароль-2026');
    expect(bad.success).toBe(false);
    expect(bad.message).toMatch(/неверно/);
  });

  it('удаление аккаунта: пароль уходит на сервер, роль интерфейса сбрасывается', async () => {
    let deleted = false;
    const client = vi.fn(async (query, variables) => {
      if (query === HYDRATE_QUERY) return deleted ? { ...structuredClone(SNAPSHOT), me: null, session: null } : structuredClone(SNAPSHOT);
      deleted = true;
      client.last = variables;
      return { deleteMyAccount: true };
    });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    store.setCurrentRole('VOLUNTEER');
    const res = await store.deleteMyAccount('vol123');
    expect(res.success).toBe(true);
    expect(client.last).toEqual({ password: 'vol123' });
    expect(store.getCurrentUser()).toBeNull();
    expect(store.getCurrentRole()).toBe('PUBLIC');
  });
});

describe('ApiStore: проверки до отправки', () => {
  it('отзыв: оценка, длина и право участвовать', async () => {
    const client = fakeClient({ submitEventReview: () => ({ submitEventReview: { id: 'rv2' } }) });
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    expect((await store.saveEventReview({ eventId: 'e2', volonteerId: 'v1', rating: 5, text: 'Очень хорошо всё прошло' })).message).toMatch(/после участия/);
    expect((await store.saveEventReview({ eventId: 'e1', volonteerId: 'v1', rating: 7, text: 'Очень хорошо всё прошло' })).message).toMatch(/от 1 до 5/);
    expect((await store.saveEventReview({ eventId: 'e1', volonteerId: 'v1', rating: 5, text: 'коротко' })).message).toMatch(/10 символов/);
    const ok = await store.saveEventReview({ eventId: 'e1', volonteerId: 'v1', rating: 5, text: 'Очень хорошо всё прошло' });
    expect(ok.success).toBe(true);
    expect(ok.updated).toBe(true); // отзыв уже был — это правка
  });

  it('активная организация организатора — только своя', async () => {
    const client = vi.fn(async (q) => (q === HYDRATE_QUERY ? { ...structuredClone(SNAPSHOT), me: { ...SNAPSHOT.me, role: 'ORGANIZER', organizationId: 'o2', volonteerId: null } } : {}));
    const store = new ApiStore({ client, storage: memoryStorage() });
    await store.init();
    store.setActiveOrg('o1'); // попытка «переключиться» игнорируется для организатора
    expect(store.getActiveOrg().id).toBe('o2');
  });
});

describe('клиент GraphQL', () => {
  it('отправляет cookie и разбирает ошибки с кодом', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'Нельзя', extensions: { code: 'FORBIDDEN' } }] }) }));
    const request = createClient({ baseUrl: '', fetchImpl });
    await expect(request('{ me { id } }')).rejects.toMatchObject({ message: 'Нельзя', code: 'FORBIDDEN' });
    expect(fetchImpl.mock.calls[0][1].credentials).toBe('include');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('сетевая ошибка → понятное сообщение', async () => {
    const request = createClient({ baseUrl: '', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    await expect(request('{ me { id } }')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
