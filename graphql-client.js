/**
 * DataSpace Community Edition — GraphQL Client & Mock Engine
 * VolontiersDSTU | Хакатон ВЕСНА '25 (ДГТУ)
 * 
 * Поддерживает два режима работы:
 * 1. Mock-режим (по умолчанию) — автономная работа поверх localStorage / appStore
 * 2. Remote-режим — прямые HTTP POST запросы к инстансу DataSpace CE (например http://localhost:8080/graphql)
 */

class DataSpaceGraphQLClient {
  constructor(endpoint = 'http://localhost:8080/graphql') {
    this.endpoint = endpoint;
    this.useRemote = false; // Установите true для соединения с живым сервером DataSpace CE
  }

  setRemote(enabled, endpoint) {
    this.useRemote = Boolean(enabled);
    if (endpoint) this.endpoint = endpoint;
  }

  async executeQuery(query, variables = {}) {
    if (this.useRemote) {
      try {
        const token = window.appStore ? window.appStore.getJWTToken() : null;
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables })
        });
        return await response.json();
      } catch (err) {
        console.warn('DataSpace CE Remote connection failed, falling back to local engine:', err);
        return this.mockExecute(query, variables);
      }
    } else {
      return this.mockExecute(query, variables);
    }
  }

  mockExecute(query, variables = {}) {
    const store = window.appStore;
    if (!store) {
      return { errors: [{ message: 'Store is not initialized' }] };
    }

    // Queries
    if (query.includes('availableEvents')) {
      return { data: { availableEvents: store.getEvents().filter(e => e.status === 'ACCEPTED') } };
    }
    if (query.includes('events')) {
      let events = store.getEvents();
      if (variables.status) {
        events = events.filter(e => e.status === variables.status);
      }
      return { data: { events } };
    }
    if (query.includes('organizations')) {
      return { data: { organizations: store.getOrganizations() } };
    }
    if (query.includes('volonteers')) {
      return { data: { volonteers: store.getVolunteers() } };
    }
    if (query.includes('requests')) {
      let reqs = store.getRequests();
      if (variables.volonteerId) reqs = reqs.filter(r => r.volonteerId === variables.volonteerId);
      if (variables.eventId) reqs = reqs.filter(r => r.eventId === variables.eventId);
      if (variables.status) reqs = reqs.filter(r => r.status === variables.status);
      return { data: { requests: reqs } };
    }
    if (query.includes('volonteerStatement')) {
      return { 
        data: { 
          volonteerStatement: store.getVolunteerStatement(variables.volonteerId, variables.startDate, variables.endDate) 
        } 
      };
    }
    if (query.includes('me')) {
      return { data: { me: store.getCurrentUser() } };
    }

    // Mutations
    if (query.includes('login(')) {
      const res = store.login(variables.email, variables.password);
      if (res.success) {
        return { data: { login: { token: res.token, user: res.user } } };
      }
      return { errors: [{ message: res.message }] };
    }
    if (query.includes('register(')) {
      const res = store.register(variables);
      if (res.success) {
        return { data: { register: { token: res.token, user: res.user } } };
      }
      return { errors: [{ message: res.message }] };
    }
    if (query.includes('createEvent(')) {
      const newEvt = store.addEvent(variables);
      return { data: { createEvent: newEvt } };
    }
    if (query.includes('moderateEvent(')) {
      store.updateEventStatus(variables.eventId, variables.status);
      return { data: { moderateEvent: { id: variables.eventId, status: variables.status } } };
    }
    if (query.includes('closeEvent(')) {
      store.updateEventStatus(variables.eventId, 'CLOSED');
      return { data: { closeEvent: { id: variables.eventId, status: 'CLOSED' } } };
    }
    if (query.includes('submitEventRequest(')) {
      const res = store.submitRequest(variables.volonteerId, variables.eventId);
      if (res.success) {
        return { data: { submitEventRequest: res.request } };
      }
      return { errors: [{ message: res.message }] };
    }
    if (query.includes('moderateRequest(')) {
      store.updateRequestStatus(variables.requestId, variables.status, variables.rejectionReason);
      return { data: { moderateRequest: { id: variables.requestId, status: variables.status } } };
    }
    if (query.includes('confirmVolunteerWork(')) {
      store.confirmRequestHours(variables.requestId, variables.confirmedHours);
      return { data: { confirmVolunteerWork: { id: variables.requestId, status: 'CONFIRMED', confirmedHours: variables.confirmedHours } } };
    }

    return { data: {} };
  }
}

window.dsGqlClient = new DataSpaceGraphQLClient();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataSpaceGraphQLClient };
}
