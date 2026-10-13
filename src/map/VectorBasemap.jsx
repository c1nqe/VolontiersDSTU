import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import bordersUrl from './borders-ru.geojson?url';
import { STYLE_URL, applyRussianView } from './ruStyle.js';

// Воркер отдаётся с нашего же адреса, поэтому в CSP достаточно 'self' (blob: не нужен).
setWorkerUrl(new URL(workerUrl, window.location.href).href);

export const VECTOR_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
  'данные <a href="https://www.openstreetmap.org/copyright">Участники OpenStreetMap</a>, границы <a href="https://www.naturalearthdata.com/">Natural Earth</a> | VolontiersDSTU';

/**
 * Векторный слой MapLibre внутри карты Leaflet. Маркеры, попапы и клики остаются на Leaflet.
 * Если стиль не загрузился или нет WebGL — вызывается onFail, и карта переключается на растровые плитки.
 */
export default function VectorBasemap({ onFail }) {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    let cancelled = false;
    let loaded = false;
    const fail = (why) => {
      if (cancelled || loaded) return;
      console.warn('Векторная карта недоступна, включены растровые плитки:', why);
      onFail?.();
    };

    (async () => {
      try {
        const res = await fetch(STYLE_URL, { referrerPolicy: 'strict-origin-when-cross-origin' });
        if (!res.ok) throw new Error(`стиль: HTTP ${res.status}`);
        const style = applyRussianView(await res.json(), new URL(bordersUrl, window.location.href).href);
        if (cancelled) return;
        layer = maplibreGL({ style, interactive: false, attributionControl: { customAttribution: VECTOR_ATTRIBUTION } });
        layer.addTo(map);
        const gl = layer.getMaplibreMap();
        gl.on('load', () => { loaded = true; });
        gl.on('error', (e) => fail(e?.error?.message || 'ошибка загрузки'));
      } catch (e) {
        fail(e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, onFail]);

  return null;
}
