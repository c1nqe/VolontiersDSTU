// Преобразует демо-данные прежней версии фронта (src/store/initialData.js) в backend/seed/demo.json.
// Запуск (из корня репозитория): node backend/seed/make-demo.mjs
// Пароли здесь только демонстрационные; сервер хэширует их argon2id при `seed`.
import { INITIAL_DATA as D } from '../../src/store/initialData.js';
import { writeFileSync } from 'node:fs';

const evStatus = { CREATED: 'DRAFT', ACCEPTED: 'ACCEPTED', CANCELLED: 'CANCELLED', CLOSED: 'CLOSED' };
const rqStatus = { PENDING: 'OPEN', ACCEPTED: 'ACCEPTED', CANCELLED: 'CANCELLED', CONFIRMED: 'CONFIRMED' };

const out = {
  users: D.users.map((u) => ({ key: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, password: u.password, role: u.role, org: u.orgId || null, vol: u.volunteerId || null, createdAt: u.createdAt })),
  organizations: D.organizations.map((o) => ({ key: o.id, name: o.name, inn: o.inn, contactPerson: o.contactPerson, email: o.email, phone: o.phone, description: o.description })),
  volonteers: D.volunteers.map((v) => ({ key: v.id, fullName: v.fullName, email: v.email, phone: v.phone, studentId: v.studentId, faculty: v.faculty, birthDate: v.birthDate })),
  events: D.events.map((e, i) => ({ key: e.id, org: e.organizationId, title: e.title, description: e.description, location: e.location, startDate: e.startDate, endDate: e.endDate, requiredVolunteers: e.requiredVolunteers, plannedHours: e.plannedHours, status: evStatus[e.status], ageDays: i })),
  requests: D.requests.map((r) => ({ key: r.id, vol: r.volonteerId, event: r.eventId, status: rqStatus[r.status], requestedHours: r.requestedHours, confirmedHours: r.confirmedHours, createdAt: r.createdAt })),
  reviews: D.eventReviews.map((r) => ({ key: r.id, event: r.eventId, vol: r.volonteerId, rating: r.rating, text: r.text, createdAt: r.createdAt })),
  markers: D.mapMarkers.map((m, i) => ({
    key: m.id, type: m.type, status: m.status, title: m.title, description: m.description, lat: m.lat, lng: m.lng, urgency: m.urgency,
    contactPhone: m.contactPhone, lastSeenDate: m.lastSeenDate, lastSeenLocation: m.lastSeenLocation, createdByVol: m.createdBy, createdByName: m.createdByName, createdAt: m.createdAt,
    demoPhotos: m.type === 'SEARCH_RESCUE' && i < 2 ? 2 : 0,
    closure: m.closureProof ? { note: m.closureProof.note, targetStatus: m.closureProof.targetStatus, submittedBy: m.closureProof.submittedBy, submittedByName: m.closureProof.submittedByName, submittedAt: m.closureProof.submittedAt } : null,
  })),
};
writeFileSync(new URL('./demo.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('demo.json:', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
