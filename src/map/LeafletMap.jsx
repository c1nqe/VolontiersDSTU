import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerDetails from './MarkerDetails.jsx';
import { getMarkerColor } from '../utils/format.js';

const ROSTOV_CENTER = [47.2313, 39.7233];

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick?.(e.latlng) });
  return null;
}

/** Перелёт к выбранной метке и открытие её карточки. */
function FocusController({ focus, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom || 16, { duration: 0.8 });
    const open = () => markerRefs.current[focus.id]?.openPopup();
    map.once('moveend', open);
    return () => { map.off('moveend', open); };
  }, [focus, map, markerRefs]);
  return null;
}

/** Leaflet при смене раскладки должен пересчитать размер контейнера. */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function LeafletMap({ markers, onMapClick, focus }) {
  const markerRefs = useRef({});

  return (
    <MapContainer center={ROSTOV_CENTER} zoom={13} className="map-canvas" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | VolontiersDSTU'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ClickHandler onMapClick={onMapClick} />
      <FocusController focus={focus} markerRefs={markerRefs} />
      <ResizeWatcher />

      {markers.map((m) => {
        const color = getMarkerColor(m);
        const liveRescue = m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL');
        const radius = liveRescue ? 12 : 9;
        return (
          <FragmentMarker key={m.id} marker={m} color={color} radius={radius} halo={liveRescue && m.urgency === 'HIGH'} markerRefs={markerRefs} />
        );
      })}
    </MapContainer>
  );
}

function FragmentMarker({ marker, color, radius, halo, markerRefs }) {
  const popupRef = useRef(null);
  return (
    <>
      {halo && (
        <CircleMarker
          center={[marker.lat, marker.lng]}
          radius={radius + 8}
          interactive={false}
          pathOptions={{ color, fillColor: color, weight: 1, opacity: 0.35, fillOpacity: 0.12 }}
        />
      )}
      <CircleMarker
        ref={(ref) => { if (ref) markerRefs.current[marker.id] = ref; else delete markerRefs.current[marker.id]; }}
        center={[marker.lat, marker.lng]}
        radius={radius}
        pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: color, fillOpacity: marker.status === 'ACTIVE' ? 0.92 : 0.7 }}
        eventHandlers={{ click: (e) => e.originalEvent?.stopPropagation() }}
        bubblingMouseEvents={false}
      >
        <Popup ref={popupRef} maxWidth={320} minWidth={260}>
          <MarkerDetails marker={marker} onAfterAction={() => popupRef.current?.close()} />
        </Popup>
      </CircleMarker>
    </>
  );
}
