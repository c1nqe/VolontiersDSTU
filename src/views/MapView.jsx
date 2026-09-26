import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { StatCard, StatsGrid } from '../components/Common.jsx';
import LeafletMap from '../map/LeafletMap.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { URGENCY, filterMarkers, formatDate } from '../utils/format.js';

const FILTERS = [
  { id: 'ALL', label: 'Все метки' },
  { id: 'SEARCH_RESCUE', label: 'Поисково-спасательные', dot: 'rescue', activeClass: 'active-danger' },
  { id: 'REGULAR', label: 'Волонтёрская помощь', dot: 'regular' },
  { id: 'PENDING_APPROVAL', label: 'На проверке', dot: 'pending' },
  { id: 'FOUND', label: 'Завершены / найдены', dot: 'found', activeClass: 'active-accent' },
];

const LEGEND = [
  { cls: 'panel-rescue', name: 'Поисково-спасательная (ПСО)', hint: 'Срочный поиск пропавших людей' },
  { cls: 'panel-regular', name: 'Волонтёрская помощь', hint: 'Субботники, шефство, развоз' },
  { cls: 'panel-pending', name: 'Ожидает согласования', hint: 'Прикреплено фото, рапорт у админа' },
  { cls: 'panel-found', name: 'Человек найден / завершено', hint: 'Успешное завершение операции' },
];

export default function MapView() {
  const store = useStore();
  const { openModal, showToast } = useUI();
  const [filter, setFilter] = useState('ALL');
  const [focus, setFocus] = useState(null);

  const all = store.getMapMarkers('ALL');
  const markers = filterMarkers(all, filter);
  const count = (fn) => all.filter(fn).length;

  const openAddMarker = (coords) => {
    if (!store.getCurrentUser()) {
      showToast('Чтобы поставить метку, войдите в систему', 'info');
      openModal('login');
      return;
    }
    openModal('addMarker', {
      ...coords,
      onCreated: (m) => {
        setFilter('ALL');
        setFocus({ id: m.id, lat: m.lat, lng: m.lng, zoom: 15, ts: Date.now() });
      },
    });
    if (coords) showToast('Координаты подставлены из точки на карте', 'info');
  };

  return (
    <div className="role-view">
      <StatsGrid>
        <StatCard marker="rescue" label="Активные поиски" value={count((m) => m.type === 'SEARCH_RESCUE' && m.status === 'ACTIVE')} tone="rescue" sub="Поисково-спасательные операции" />
        <StatCard marker="regular" label="Волонтёрская помощь" value={count((m) => m.type === 'REGULAR' && m.status === 'ACTIVE')} tone="regular" sub="Точки социальной поддержки" />
        <StatCard marker="pending" label="На согласовании" value={count((m) => m.status === 'PENDING_APPROVAL')} tone="warning" sub="Отчёты с фото на проверке" />
        <StatCard marker="found" label="Успешно найдены" value={count((m) => m.status === 'FOUND')} tone="accent" sub="Люди возвращены домой" />
      </StatsGrid>

      <div className="toolbar no-print">
        <div className="map-filter-pills" role="group" aria-label="Фильтр меток">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-pill ${filter === f.id ? (f.activeClass || 'active') : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.dot && <span className={`color-dot color-dot-${f.dot}`} />}
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openAddMarker()}>
          <Icon name="mapPin" /> Поставить метку
        </button>
      </div>

      <div className="map-layout">
        <div className="map-frame">
          <LeafletMap
            markers={markers}
            focus={focus}
            onMapClick={(latlng) => openAddMarker({ lat: Number(latlng.lat.toFixed(4)), lng: Number(latlng.lng.toFixed(4)) })}
          />
          <div className="map-hint"><Icon name="info" /> Нажмите на карту, чтобы поставить метку в этой точке</div>
        </div>

        <aside className="map-sidebar">
          <div className="map-legend">
            <div className="legend-header-row"><Icon name="map" /><h4>Категории операций</h4></div>
            <div className="legend-panels-list">
              {LEGEND.map((l) => (
                <div key={l.cls} className={`legend-panel-item ${l.cls}`}>
                  <span className="panel-swatch" />
                  <div className="panel-info">
                    <div className="panel-name">{l.name}</div>
                    <div className="panel-hint">{l.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {markers.length === 0 ? (
            <div className="sidebar-empty"><Icon name="mapPin" size={28} /> Нет меток для выбранного фильтра</div>
          ) : markers.map((m) => {
            const isPending = m.status === 'PENDING_APPROVAL';
            const isFound = m.status === 'FOUND';
            const border = isPending ? 'pending' : isFound ? 'found' : m.type === 'SEARCH_RESCUE' ? 'search-rescue' : 'regular';
            const urgency = URGENCY[m.urgency] || URGENCY.LOW;
            const photoCount = (m.photos?.length || 0) + (m.closureProof?.photo ? 1 : 0);
            return (
              <button
                key={m.id}
                type="button"
                className={`marker-list-card ${border}`}
                onClick={() => setFocus({ id: m.id, lat: m.lat, lng: m.lng, ts: Date.now() })}
              >
                {m.photos?.[0] && <img className="marker-list-thumb" src={m.photos[0]} alt="" />}
                <div className="marker-list-body">
                  <div className="row-between">
                    <div className="row-gap">
                      <span className={`urgency-badge ${urgency.className}`}>{urgency.label}</span>
                      {isPending && <span className="badge badge-pending badge-xs">Проверка фото</span>}
                      {isFound && <span className="badge badge-accepted badge-xs">Найден</span>}
                      {m.status === 'CLOSED' && <span className="badge badge-closed badge-xs">Закрыта</span>}
                    </div>
                    <span className="marker-list-date">{formatDate(m.createdAt)}</span>
                  </div>
                  <div className="marker-list-title">{m.title}</div>
                  <div className="marker-list-meta">
                    <Icon name="user" /> <span>{m.createdByName}</span>
                    {photoCount > 0 && <span className="marker-list-photos"><Icon name="camera" /> {photoCount}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
