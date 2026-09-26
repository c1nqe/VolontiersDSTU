import { beforeEach, describe, expect, it } from 'vitest';
import { DataStore, MAX_MARKER_PHOTOS } from '../src/store/DataStore.js';
import { DataSpaceGraphQLClient } from '../src/api/graphqlClient.js';
import { decodeJWT } from '../src/store/jwt.js';

/** Хранилище в памяти с настраиваемым лимитом (имитация QuotaExceededError). */
function memoryStorage(limitChars = Infinity) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > limitChars) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
}

const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(200);

describe('авторизация и JWT', () => {
  it('выдаёт токен с ролью пользователя при входе', () => {
    const store = new DataStore(memoryStorage());
    const res = store.login('volunteer@donstu.ru', 'vol123');
    expect(res.success).toBe(true);
    const decoded = decodeJWT(res.token);
    expect(decoded.payload.role).toBe('VOLUNTEER');
    expect(decoded.payload.firstName).toBe('Алексей');
    expect(decoded.isExpired).toBe(false);
  });

  it('отклоняет неверный пароль', () => {
    const store = new DataStore(memoryStorage());
    expect(store.login('admin@donstu.ru', 'nope').success).toBe(false);
  });
});

describe('подписка на изменения', () => {
  it('уведомляет подписчиков при сохранении', () => {
    const store = new DataStore(memoryStorage());
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    store.updateEventStatus('evt-4', 'ACCEPTED');
    unsubscribe();
    store.updateEventStatus('evt-5', 'ACCEPTED');
    expect(calls).toBe(1);
  });
});

describe('метки ПСО с фотографиями', () => {
  let store;
  beforeEach(() => {
    store = new DataStore(memoryStorage());
    store.login('volunteer@donstu.ru', 'vol123');
  });

  it('сохраняет фото у поисково-спасательной метки', () => {
    const res = store.addMapMarker({ type: 'SEARCH_RESCUE', title: 'Поиск', description: 'Описание', lat: 47.2, lng: 39.7, urgency: 'HIGH', photos: [PHOTO, PHOTO] });
    expect(res.success).toBe(true);
    expect(store.getMarker(res.marker.id).photos).toHaveLength(2);
    expect(res.marker.createdByName).toBe('Иванов Алексей');
  });

  it('ограничивает число фото', () => {
    const photos = Array.from({ length: MAX_MARKER_PHOTOS + 3 }, () => PHOTO);
    const res = store.addMapMarker({ type: 'SEARCH_RESCUE', title: 'Поиск', description: 'x', lat: 47.2, lng: 39.7, urgency: 'HIGH', photos });
    expect(res.marker.photos).toHaveLength(MAX_MARKER_PHOTOS);
  });

  it('не прикрепляет фото к обычной волонтёрской метке', () => {
    const res = store.addMapMarker({ type: 'REGULAR', title: 'Помощь', description: 'x', lat: 47.2, lng: 39.7, urgency: 'LOW', photos: [PHOTO] });
    expect(res.marker.photos).toEqual([]);
  });

  it('откатывает изменения, если фото не помещаются в хранилище', () => {
    const tight = new DataStore(memoryStorage(40_000));
    const before = tight.getMapMarkers().length;
    const huge = 'data:image/jpeg;base64,' + 'B'.repeat(60_000);
    const res = tight.addMapMarker({ type: 'SEARCH_RESCUE', title: 'Поиск', description: 'x', lat: 47.2, lng: 39.7, urgency: 'HIGH', photos: [huge] });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/хранилище/);
    expect(tight.getMapMarkers().length).toBe(before);
  });

  it('добавляет пустой список фото к старым сохранённым меткам', () => {
    const storage = memoryStorage();
    const legacy = new DataStore(storage);
    legacy.data.mapMarkers.forEach((m) => { delete m.photos; });
    delete legacy.data.eventReviews;
    legacy.persist();
    const reloaded = new DataStore(storage);
    expect(reloaded.getMapMarkers().every((m) => Array.isArray(m.photos))).toBe(true);
    expect(Array.isArray(reloaded.data.eventReviews)).toBe(true);
  });

  it('проводит закрытие ПСО через согласование администратора', () => {
    store.requestMarkerClose('mark-1', { photo: PHOTO, note: 'Найден', targetStatus: 'FOUND' });
    expect(store.getMarker('mark-1').status).toBe('PENDING_APPROVAL');
    store.approveMarkerClose('mark-1');
    expect(store.getMarker('mark-1').status).toBe('FOUND');
  });
});

describe('отзывы о мероприятиях', () => {
  let store;
  beforeEach(() => { store = new DataStore(memoryStorage()); });

  it('считает средний рейтинг и количество отзывов', () => {
    const evt = store.getEvents().find((e) => e.id === 'evt-1');
    expect(evt.reviewsCount).toBe(2);
    expect(evt.ratingAvg).toBe(4.5);
  });

  it('разрешает отзыв только участникам с подтверждённой работой', () => {
    expect(store.canReviewEvent('vol-1', 'evt-1').allowed).toBe(true); // CONFIRMED
    expect(store.canReviewEvent('vol-1', 'evt-2').allowed).toBe(false); // ACCEPTED, событие не закрыто
    expect(store.canReviewEvent('vol-3', 'evt-3').allowed).toBe(false); // не подавал заявку
  });

  it('разрешает отзыв принятому участнику после закрытия события', () => {
    store.updateEventStatus('evt-2', 'CLOSED');
    expect(store.canReviewEvent('vol-1', 'evt-2').allowed).toBe(true);
  });

  it('создаёт отзыв, а повторная отправка обновляет его', () => {
    const first = store.saveEventReview({ eventId: 'evt-1', volonteerId: 'vol-1', rating: 5, text: 'Отличная организация и команда!' });
    expect(first.success).toBe(true);
    expect(first.updated).toBe(false);
    const second = store.saveEventReview({ eventId: 'evt-1', volonteerId: 'vol-1', rating: 3, text: 'Передумал: было жарко и мало воды.' });
    expect(second.updated).toBe(true);
    const mine = store.getEventReviews('evt-1').filter((r) => r.volonteerId === 'vol-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].rating).toBe(3);
    expect(store.getEventRating('evt-1')).toEqual({ avg: 4, count: 3 });
  });

  it('валидирует оценку и текст', () => {
    expect(store.saveEventReview({ eventId: 'evt-1', volonteerId: 'vol-1', rating: 0, text: 'Нормальный текст отзыва' }).success).toBe(false);
    expect(store.saveEventReview({ eventId: 'evt-1', volonteerId: 'vol-1', rating: 5, text: 'коротко' }).success).toBe(false);
    expect(store.saveEventReview({ eventId: 'evt-1', volonteerId: 'vol-1', rating: 5, text: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('не даёт оставить отзыв тому, кто не участвовал', () => {
    const res = store.saveEventReview({ eventId: 'evt-3', volonteerId: 'vol-2', rating: 5, text: 'Я там не был, но всё супер' });
    expect(res.success).toBe(false);
  });

  it('удаляет отзыв', () => {
    store.deleteEventReview('rev-1');
    expect(store.getEventRating('evt-1').count).toBe(1);
  });
});

describe('GraphQL-клиент (mock-режим)', () => {
  it('создаёт событие мутацией, а не возвращает список событий', async () => {
    const store = new DataStore(memoryStorage());
    const client = new DataSpaceGraphQLClient(store);
    const res = await client.executeQuery('mutation CreateEvent($title: String!) { createEvent(title: $title) { id status } }', {
      title: 'Тест', description: 'd', location: 'l', startDate: '2026-11-01', endDate: '2026-11-01', requiredVolunteers: 1, plannedHours: 2, organizationId: 'org-1',
    });
    expect(res.data.createEvent.status).toBe('CREATED');
    expect(store.getEvents()[0].title).toBe('Тест');
  });

  it('подтверждает часы волонтёра', async () => {
    const store = new DataStore(memoryStorage());
    const client = new DataSpaceGraphQLClient(store);
    await client.executeQuery('mutation { confirmVolunteerWork(requestId: $r, confirmedHours: $h) { id } }', { requestId: 'req-4', confirmedHours: 12 });
    const req = store.getRequests().find((r) => r.id === 'req-4');
    expect(req.status).toBe('CONFIRMED');
    expect(req.confirmedHours).toBe(12);
  });

  it('публикует и читает отзывы', async () => {
    const store = new DataStore(memoryStorage());
    const client = new DataSpaceGraphQLClient(store);
    const created = await client.executeQuery('mutation { submitEventReview(eventId: $e) { id } }', { eventId: 'evt-1', volonteerId: 'vol-1', rating: 4, text: 'Хороший опыт, пойду ещё' });
    expect(created.data.submitEventReview.id).toBeTruthy();
    const list = await client.executeQuery('query { eventReviews(eventId: $e) { id } }', { eventId: 'evt-1' });
    expect(list.data.eventReviews).toHaveLength(3);
  });
});
