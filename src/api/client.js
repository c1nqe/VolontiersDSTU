/**
 * Клиент GraphQL для backend на Rust (axum + async-graphql).
 *
 * Сессия живёт в HttpOnly-cookie: JS-код токен не видит и не хранит, браузер сам
 * прикладывает cookie (credentials: 'include'). В dev-режиме Vite проксирует /graphql
 * и /media на сервер, поэтому адрес пустой (тот же origin). Иной адрес — VITE_API_URL.
 */
export const API_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, code = 'ERROR', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function createClient({ baseUrl = API_URL, fetchImpl } = {}) {
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);

  return async function request(query, variables = {}) {
    let res;
    try {
      res = await doFetch(`${baseUrl}/graphql`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ApiError('Сервер недоступен. Проверьте подключение и повторите попытку.', 'NETWORK');
    }
    let json = null;
    try { json = await res.json(); } catch { /* не JSON */ }
    if (!res.ok && !json) {
      throw new ApiError(res.status === 403 ? 'Запрос отклонён сервером' : `Ошибка сервера (${res.status})`, 'HTTP', res.status);
    }
    if (json?.errors?.length) {
      const e = json.errors[0];
      throw new ApiError(e.message, e.extensions?.code || 'ERROR', res.status);
    }
    return json?.data ?? {};
  };
}

/** Адрес фото: сервер отдаёт относительные ссылки /media/photos/{id}. */
export const mediaUrl = (src) => (src && src.startsWith('/media/') ? `${API_URL}${src}` : src);
