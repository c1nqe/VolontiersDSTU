/**
 * GraphQL Client для DataSpace Community Edition
 * Поддерживает как локальный mock-режим, так и работу с удаленным GraphQL сервером DataSpace CE
 */

class DataSpaceGraphQLClient {
  constructor(endpoint = 'http://localhost:8080/graphql') {
    this.endpoint = endpoint;
    this.useRemote = false; // Переключить на true при запуске DataSpace CE
  }

  async executeQuery(query, variables = {}) {
    if (this.useRemote) {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });
      return await response.json();
    } else {
      // Локальный mock-провайдер через DataStore
      return this.mockExecute(query, variables);
    }
  }

  mockExecute(query, variables) {
    const store = window.appStore;
    
    if (query.includes('availableEvents')) {
      return { data: { availableEvents: store.getEvents().filter(e => e.status === 'ACCEPTED') } };
    }
    if (query.includes('events')) {
      return { data: { events: store.getEvents() } };
    }
    if (query.includes('organizations')) {
      return { data: { organizations: store.getOrganizations() } };
    }
    if (query.includes('volonteers')) {
      return { data: { volonteers: store.getVolunteers() } };
    }
    if (query.includes('volonteerStatement')) {
      return { data: { volonteerStatement: store.getVolunteerStatement(variables.volonteerId, variables.startDate, variables.endDate) } };
    }
    return { data: {} };
  }
}

window.dsGqlClient = new DataSpaceGraphQLClient();
