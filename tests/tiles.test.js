import { describe, expect, it } from 'vitest';
import { DEFAULT_ATTRIBUTION, DEFAULT_TILE_URL, TRACESTRACK_ATTRIBUTION, resolveTileConfig } from '../src/map/tiles.js';

describe('источник плиток карты', () => {
  it('по умолчанию — стандартная карта OpenStreetMap', () => {
    const c = resolveTileConfig({});
    expect(c.url).toBe(DEFAULT_TILE_URL);
    expect(c.attribution).toBe(DEFAULT_ATTRIBUTION);
    expect(c.maxZoom).toBe(19);
  });

  it('принимает свой https-адрес с {z}/{x}/{y}, подпись и максимальный масштаб', () => {
    const c = resolveTileConfig({ VITE_TILE_URL: 'https://tiles.donstu.ru/{z}/{x}/{y}.png', VITE_TILE_ATTRIBUTION: '© ДГТУ', VITE_TILE_MAX_ZOOM: '18' });
    expect(c).toEqual({ url: 'https://tiles.donstu.ru/{z}/{x}/{y}.png', attribution: '© ДГТУ', maxZoom: 18 });
  });

  it('отвергает http и адреса без {z}/{x}/{y}', () => {
    expect(resolveTileConfig({ VITE_TILE_URL: 'http://tiles.example.org/{z}/{x}/{y}.png' }).url).toBe(DEFAULT_TILE_URL);
    expect(resolveTileConfig({ VITE_TILE_URL: 'https://tiles.example.org/tile.png' }).url).toBe(DEFAULT_TILE_URL);
  });

  it('при неверном адресе не берёт чужую подпись и игнорирует неверный масштаб', () => {
    const c = resolveTileConfig({ VITE_TILE_URL: 'ftp://x', VITE_TILE_ATTRIBUTION: 'чужая', VITE_TILE_MAX_ZOOM: '99' });
    expect(c.attribution).toBe(DEFAULT_ATTRIBUTION);
    expect(c.maxZoom).toBe(19);
  });

  it('пресет tracestrack-ru: русские подписи, ключ в адресе, подпись источника', () => {
    const c = resolveTileConfig({ VITE_TILE_PROVIDER: 'tracestrack-ru', VITE_TILE_KEY: 'abc123_DEF-456' });
    expect(c.url).toBe('https://tile.tracestrack.com/ru/{z}/{x}/{y}.webp?key=abc123_DEF-456');
    expect(c.attribution).toBe(TRACESTRACK_ATTRIBUTION);
    expect(c.maxZoom).toBe(18);
  });

  it('пресет без ключа или с неверным ключом возвращает стандартную карту', () => {
    expect(resolveTileConfig({ VITE_TILE_PROVIDER: 'tracestrack-ru' }).url).toBe(DEFAULT_TILE_URL);
    expect(resolveTileConfig({ VITE_TILE_PROVIDER: 'tracestrack-ru', VITE_TILE_KEY: 'x&y=1' }).url).toBe(DEFAULT_TILE_URL);
  });

  it('явный VITE_TILE_URL важнее пресета', () => {
    const c = resolveTileConfig({ VITE_TILE_PROVIDER: 'tracestrack-ru', VITE_TILE_KEY: 'abcdefgh1', VITE_TILE_URL: 'https://tiles.donstu.ru/{z}/{x}/{y}.png' });
    expect(c.url).toBe('https://tiles.donstu.ru/{z}/{x}/{y}.png');
  });
});
