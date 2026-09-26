export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU');
};

export const EVENT_STATUS = {
  CREATED: { badge: 'badge-created', label: 'Ожидает модерации' },
  ACCEPTED: { badge: 'badge-accepted', label: 'Набор открыт' },
  CLOSED: { badge: 'badge-closed', label: 'Событие завершено' },
  CANCELLED: { badge: 'badge-cancelled', label: 'Отменено' },
};

export const REQUEST_STATUS = {
  PENDING: { badge: 'badge-pending', label: 'На рассмотрении' },
  ACCEPTED: { badge: 'badge-accepted', label: 'Одобрена' },
  CONFIRMED: { badge: 'badge-confirmed', label: 'Часы подтверждены' },
  CANCELLED: { badge: 'badge-cancelled', label: 'Отклонена' },
};

export const URGENCY = {
  HIGH: { className: 'urgency-high', label: 'Срочно' },
  MEDIUM: { className: 'urgency-medium', label: 'Средняя' },
  LOW: { className: 'urgency-low', label: 'Низкая' },
};

export const MARKER_STATUS = {
  ACTIVE: { label: 'Активна', color: '#2563eb' },
  FOUND: { label: 'Человек найден', color: '#10b981' },
  PENDING_APPROVAL: { label: 'На согласовании у администратора', color: '#f59e0b' },
  CLOSED: { label: 'Закрыта', color: '#64748b' },
};

export function getMarkerColor(marker) {
  if (marker.status === 'PENDING_APPROVAL') return '#f59e0b';
  if (marker.status === 'FOUND') return '#10b981';
  if (marker.status === 'CLOSED') return '#64748b';
  if (marker.type === 'SEARCH_RESCUE') return '#dc2626';
  return '#2563eb';
}

/** Фильтр меток карты по выбранной «пилюле». */
export function filterMarkers(markers, filter) {
  switch (filter) {
    case 'SEARCH_RESCUE':
      return markers.filter((m) => m.type === 'SEARCH_RESCUE' && (m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL'));
    case 'REGULAR':
      return markers.filter((m) => m.type === 'REGULAR' && m.status === 'ACTIVE');
    case 'FOUND':
      return markers.filter((m) => m.status === 'FOUND');
    case 'PENDING_APPROVAL':
      return markers.filter((m) => m.status === 'PENDING_APPROVAL');
    default:
      return markers;
  }
}

export const pluralize = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
