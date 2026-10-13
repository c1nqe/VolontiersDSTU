/**
 * Векторная карта в российской трактовке границ.
 *
 * Базовый стиль (OpenFreeMap, схема OpenMapTiles) приходит с границами из данных OpenStreetMap, а они
 * показывают Крым, ДНР, ЛНР, Херсонскую и Запорожскую области иначе, чем принято в России. Поэтому все слои
 * границ стиля удаляются, а поверх рисуются собственные (borders-ru.geojson: Natural Earth в российской
 * трактовке + четыре области). Подписи берутся из name:ru, а при его отсутствии — из name.
 */
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const BORDERS_SOURCE = 'ru-borders';

// Слои схемы OpenMapTiles, у которых есть смысл показывать название по-русски.
const LABEL_LAYERS = new Set(['place', 'water_name', 'waterway', 'transportation_name', 'poi', 'aerodrome_label', 'mountain_peak', 'park']);
const RU_NAME = ['coalesce', ['get', 'name:ru'], ['get', 'name']];

const hasRef = (expr) => JSON.stringify(expr ?? '').includes('"ref"');

export function applyRussianView(style, bordersUrl) {
  const out = JSON.parse(JSON.stringify(style));

  out.layers = out.layers
    .filter((l) => l['source-layer'] !== 'boundary')
    .map((l) => {
      if (l.type === 'symbol' && LABEL_LAYERS.has(l['source-layer']) && l.layout?.['text-field'] && !hasRef(l.layout['text-field'])) {
        return { ...l, layout: { ...l.layout, 'text-field': RU_NAME } };
      }
      return l;
    });

  out.sources = { ...out.sources, [BORDERS_SOURCE]: { type: 'geojson', data: bordersUrl } };

  const borderLayers = [
    {
      id: 'ru-border-casing',
      type: 'line',
      source: BORDERS_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.5, 8, 3, 14, 5] },
    },
    {
      id: 'ru-border',
      type: 'line',
      source: BORDERS_SOURCE,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': '#8e7aa8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.4, 14, 2.2],
        'line-dasharray': [5, 2, 1, 2],
      },
    },
  ];

  // Границы — под подписями, но над дорогами и заливкой.
  const firstSymbol = out.layers.findIndex((l) => l.type === 'symbol');
  if (firstSymbol === -1) out.layers.push(...borderLayers);
  else out.layers.splice(firstSymbol, 0, ...borderLayers);

  return out;
}
