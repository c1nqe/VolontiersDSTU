/**
 * DataSpace Community Edition — GraphQL-клиент.
 *
 * Два режима:
 * 1. Mock (по умолчанию) — операции выполняются локально поверх DataStore;
 * 2. Remote — POST-запросы к инстансу DataSpace CE (например http://localhost:8080/graphql).
 *
 * Исправлено при переносе: мутации проверяются раньше запросов (раньше
 * `createEvent(` перехватывалось веткой `events`), confirmVolunteerWork
 * вызывал несуществующий метод, moderateRequest передавал причину отказа
 * вместо часов.
 */
export class DataSpaceGraphQLClient {
  constructor(store, endpoint = 'http://localhost:8080/graphql') {
    this.store = store;
    this.endpoint = endpoint;
    this.useRemote = false;
  }

  setRemote(enabled, endpoint) {
    this.useRemote = Boolean(enabled);
    if (endpoint) this.endpoint = endpoint;
  }

  async executeQuery(query, variables = {}) {
    if (!this.useRemote) return this.mockExecute(query, variables);
    try {
      const token = this.store?.getJWTToken();
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
      return await response.json();
    } catch (err) {
      console.warn('DataSpace CE недоступен, выполняю запрос локально:', err);
      return this.mockExecute(query, variables);
    }
  }

  mockExecute(query, variables = {}) {
    const store = this.store;
    if (!store) return { errors: [{ message: 'Store is not initialized' }] };
    const has = (name) => new RegExp(`\\b${name}\\s*\\(`).test(query);
    const field = (name) => new RegExp(`\\b${name}\\b`).test(query);
    const fail = (message) => ({ errors: [{ message }] });

    // ---------- Mutations ----------
    if (/^\s*mutation\b/.test(query)) {
      if (has('login')) {
        const res = store.login(variables.email, variables.password);
        return res.success ? { data: { login: { token: res.token, user: res.user } } } : fail(res.message);
      }
      if (has('register')) {
        const res = store.register(variables);
        return res.success ? { data: { register: { token: res.token, user: res.user } } } : fail(res.message);
      }
      if (has('registerOrganization')) return { data: { registerOrganization: store.addOrganization(variables) } };
      if (has('registerVolonteer')) return { data: { registerVolonteer: store.addVolunteer(variables) } };
      if (has('createEvent')) return { data: { createEvent: store.addEvent(variables) } };
      if (has('moderateEvent')) return { data: { moderateEvent: store.updateEventStatus(variables.eventId, variables.status) } };
      if (has('closeEvent')) return { data: { closeEvent: store.updateEventStatus(variables.eventId, 'CLOSED') } };
      if (has('submitEventRequest')) {
        const res = store.submitRequest(variables.volonteerId, variables.eventId);
        return res.success ? { data: { submitEventRequest: res.request } } : fail(res.message);
      }
      if (has('moderateRequest')) return { data: { moderateRequest: store.updateRequestStatus(variables.requestId, variables.status) } };
      if (has('confirmVolunteerWork')) return { data: { confirmVolunteerWork: store.confirmRequestHours(variables.requestId, variables.confirmedHours) } };
      if (has('cancelEventRequest')) return { data: { cancelEventRequest: store.updateRequestStatus(variables.requestId, 'CANCELLED') } };
      if (has('createMapMarker')) {
        const res = store.addMapMarker(variables.input || variables);
        return res.success ? { data: { createMapMarker: res.marker } } : fail(res.message);
      }
      if (has('submitEventReview')) {
        const res = store.saveEventReview(variables);
        return res.success ? { data: { submitEventReview: res.review } } : fail(res.message);
      }
      if (has('deleteEventReview')) {
        store.deleteEventReview(variables.reviewId);
        return { data: { deleteEventReview: true } };
      }
      return fail('Неизвестная мутация');
    }

    // ---------- Queries ----------
    if (has('volonteerStatement')) {
      return { data: { volonteerStatement: store.getVolunteerStatement(variables.volonteerId, variables.startDate, variables.endDate) } };
    }
    if (has('eventReviews')) return { data: { eventReviews: store.getEventReviews(variables.eventId) } };
    if (field('availableEvents')) return { data: { availableEvents: store.getEvents().filter((e) => e.status === 'ACCEPTED') } };
    if (field('mapMarkers')) return { data: { mapMarkers: store.getMapMarkers(variables.type || 'ALL') } };
    if (field('events')) {
      const events = store.getEvents();
      return { data: { events: variables.status ? events.filter((e) => e.status === variables.status) : events } };
    }
    if (field('organizations')) return { data: { organizations: store.getOrganizations() } };
    if (field('volonteers')) return { data: { volonteers: store.getVolunteers() } };
    if (field('requests')) {
      let reqs = store.getRequests();
      if (variables.volonteerId) reqs = reqs.filter((r) => r.volonteerId === variables.volonteerId);
      if (variables.eventId) reqs = reqs.filter((r) => r.eventId === variables.eventId);
      if (variables.status) reqs = reqs.filter((r) => r.status === variables.status);
      return { data: { requests: reqs } };
    }
    if (field('me')) return { data: { me: store.getCurrentUser() } };
    return { data: {} };
  }
}
