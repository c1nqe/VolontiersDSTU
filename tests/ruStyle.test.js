import { describe, expect, it } from 'vitest';
import { BORDERS_SOURCE, applyRussianView } from '../src/map/ruStyle.js';
import { resolveMapMode } from '../src/map/tiles.js';
import borders from '../src/map/borders-ru.geojson?raw';

const base = () => ({
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'bg', type: 'background' },
    { id: 'road', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
    { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' },
    { id: 'boundary_disputed', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' },
    { id: 'shield', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': ['to-string', ['get', 'ref']] } },
    { id: 'city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] } },
    { id: 'house', type: 'symbol', source: 'openmaptiles', 'source-layer': 'housenumber', layout: { 'text-field': ['get', 'housenumber'] } },
  ],
});

describe('векторная карта в российской трактовке границ', () => {
  it('убирает все слои границ из стиля поставщика', () => {
    const out = applyRussianView(base(), 'https://x/borders.geojson');
    expect(out.layers.some((l) => l['source-layer'] === 'boundary')).toBe(false);
    expect(out.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['bg', 'road', 'city']));
  });

  it('подписи мест берут name:ru, а при его отсутствии name; номера домов и шильдики дорог не трогает', () => {
    const out = applyRussianView(base(), 'https://x/borders.geojson');
    const get = (id) => out.layers.find((l) => l.id === id).layout['text-field'];
    expect(get('city')).toEqual(['coalesce', ['get', 'name:ru'], ['get', 'name']]);
    expect(get('shield')).toEqual(['to-string', ['get', 'ref']]);
    expect(get('house')).toEqual(['get', 'housenumber']);
  });

  it('добавляет свои границы под подписями и не меняет исходный стиль', () => {
    const src = base();
    const before = JSON.stringify(src);
    const out = applyRussianView(src, 'https://x/borders.geojson');
    expect(JSON.stringify(src)).toBe(before);
    expect(out.sources[BORDERS_SOURCE]).toEqual({ type: 'geojson', data: 'https://x/borders.geojson' });
    const ids = out.layers.map((l) => l.id);
    expect(ids.indexOf('ru-border')).toBeGreaterThan(ids.indexOf('road'));
    expect(ids.indexOf('ru-border')).toBeLessThan(ids.indexOf('shield'));
  });

  it('если подписей в стиле нет, границы ставятся поверх всех слоёв', () => {
    const out = applyRussianView({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background' }] }, 'u');
    expect(out.layers.map((l) => l.id)).toEqual(['bg', 'ru-border-casing', 'ru-border']);
  });
});

describe('файл границ borders-ru.geojson', () => {
  const g = JSON.parse(borders).features[0].geometry;

  // Расстояние (в градусах) от точки до ближайшей линии границы.
  const dist = (lon, lat) => {
    let best = Infinity;
    for (const line of g.coordinates) {
      for (let i = 1; i < line.length; i++) {
        const [x1, y1] = line[i - 1]; const [x2, y2] = line[i];
        const dx = x2 - x1; const dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(lon - (x1 + t * dx), lat - (y1 + t * dy)));
      }
    }
    return best;
  };

  it('это набор линий с достаточной детализацией', () => {
    expect(g.type).toBe('MultiLineString');
    expect(g.coordinates.length).toBeGreaterThan(300);
  });

  it('граница проходит по западным границам новых областей, а не по Перекопу и не по старой границе с Донбассом', () => {
    expect(dist(32.617, 46.635)).toBeGreaterThan(0.1); // центр Херсона внутри
    expect(dist(34.1, 44.95)).toBeGreaterThan(0.5); // Симферополь внутри
    expect(dist(33.6, 46.2)).toBeGreaterThan(0.05); // перешеек: линии Украина—Крым нет
    expect(dist(39.3, 48.6)).toBeGreaterThan(0.5); // Луганск: старой границы с Россией рядом нет
    expect(dist(35.3, 48.2)).toBeLessThan(0.4); // граница Запорожской и Днепропетровской областей: линия есть
  });
});
