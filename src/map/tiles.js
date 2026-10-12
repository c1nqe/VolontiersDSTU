/**
 * Источник плиток карты. По умолчанию — стандартная карта OpenStreetMap: подписи на ней берутся из
 * тега name, то есть для России они на русском. Источник можно заменить при сборке (VITE_TILE_URL,
 * VITE_TILE_ATTRIBUTION, VITE_TILE_MAX_ZOOM). Тот же адрес нужно добавить на сервере в MAP_TILE_HOSTS,
 * иначе политика CSP не даст браузеру загрузить плитки.
 */
export const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">Участники OpenStreetMap</a> | VolontiersDSTU';

/** Адрес должен быть https и содержать {z}, {x}, {y}; иначе используется стандартный. */
export function resolveTileConfig(env = {}) {
  const url = String(env.VITE_TILE_URL || '').trim();
  const valid = /^https:\/\//.test(url) && ['{z}', '{x}', '{y}'].every((p) => url.includes(p));
  const maxZoom = Number(env.VITE_TILE_MAX_ZOOM);
  return {
    url: valid ? url : DEFAULT_TILE_URL,
    attribution: valid ? (String(env.VITE_TILE_ATTRIBUTION || '').trim() || DEFAULT_ATTRIBUTION) : DEFAULT_ATTRIBUTION,
    maxZoom: Number.isInteger(maxZoom) && maxZoom >= 1 && maxZoom <= 22 ? maxZoom : 19,
  };
}

export const TILES = resolveTileConfig(import.meta.env);
