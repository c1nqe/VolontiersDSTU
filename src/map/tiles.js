/**
 * Источник плиток карты. По умолчанию — стандартная карта OpenStreetMap: подписи на ней берутся из
 * тега name, то есть для России они на русском. Источник можно заменить при сборке (VITE_TILE_URL,
 * VITE_TILE_ATTRIBUTION, VITE_TILE_MAX_ZOOM). Тот же адрес нужно добавить на сервере в MAP_TILE_HOSTS,
 * иначе политика CSP не даст браузеру загрузить плитки.
 *
 * Готовый вариант с подписями на русском: VITE_TILE_PROVIDER=tracestrack-ru и VITE_TILE_KEY=<ключ с
 * tracestrack.com>. Без ключа или при неверном ключе остаётся стандартная карта OpenStreetMap.
 */
export const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">Участники OpenStreetMap</a> | VolontiersDSTU';

export const TRACESTRACK_ATTRIBUTION = '&copy; <a href="https://www.tracestrack.com/">Tracestrack</a>, &copy; <a href="https://www.openstreetmap.org/copyright">Участники OpenStreetMap</a> | VolontiersDSTU';

function providerConfig(env) {
  const key = String(env.VITE_TILE_KEY || '').trim();
  if (String(env.VITE_TILE_PROVIDER || '').trim() === 'tracestrack-ru' && /^[A-Za-z0-9_-]{8,128}$/.test(key)) {
    return { url: `https://tile.tracestrack.com/ru/{z}/{x}/{y}.webp?key=${key}`, attribution: TRACESTRACK_ATTRIBUTION, maxZoom: 18 };
  }
  return null;
}

/** Адрес должен быть https и содержать {z}, {x}, {y}; иначе используется стандартный. */
export function resolveTileConfig(env = {}) {
  const preset = String(env.VITE_TILE_URL || '').trim() ? null : providerConfig(env);
  if (preset) {
    const z = Number(env.VITE_TILE_MAX_ZOOM);
    return { ...preset, maxZoom: Number.isInteger(z) && z >= 1 && z <= 22 ? z : preset.maxZoom };
  }
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
