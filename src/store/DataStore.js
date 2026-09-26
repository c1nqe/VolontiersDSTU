/**
 * Слой состояния VolontiersDSTU.
 * Хранит данные в localStorage и уведомляет подписчиков (React) об изменениях.
 */
import { INITIAL_DATA, STORAGE_KEY } from './initialData.js';
import { generateJWT, decodeJWT } from './jwt.js';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const MAX_MARKER_PHOTOS = 5;
export const MAX_REVIEW_LENGTH = 1000;

export class DataStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.version = 0;
    this.data = this.load();
  }

  // ============================================
  // Подписки (используются хуком useStore)
  // ============================================
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  emit() {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  // ============================================
  // Загрузка / сохранение
  // ============================================
  normalize(parsed) {
    let updated = false;
    if (!parsed.mapMarkers) { parsed.mapMarkers = clone(INITIAL_DATA.mapMarkers); updated = true; }
    if (!parsed.users || parsed.users.length === 0) { parsed.users = clone(INITIAL_DATA.users); updated = true; }
    if (!parsed.eventReviews) { parsed.eventReviews = clone(INITIAL_DATA.eventReviews); updated = true; }
    parsed.mapMarkers.forEach((m) => {
      if (!Array.isArray(m.photos)) { m.photos = []; updated = true; }
    });
    return updated;
  }

  load() {
    try {
      const stored = this.storage?.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.normalize(parsed)) this.persist(parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Ошибка загрузки из localStorage', e);
    }
    const fresh = clone(INITIAL_DATA);
    this.normalize(fresh);
    this.persist(fresh);
    return fresh;
  }

  /** Пишет состояние в хранилище. Возвращает false, если не хватило места. */
  persist(dataToSave = this.data) {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      return true;
    } catch (e) {
      console.error('Ошибка сохранения в localStorage', e);
      return false;
    }
  }

  save() {
    const ok = this.persist();
    this.emit();
    return ok;
  }

  /**
   * Атомарное изменение: если сохранить не удалось (переполнен localStorage),
   * состояние откатывается к снимку.
   */
  commit(mutator) {
    const snapshot = JSON.stringify(this.data);
    const result = mutator(this.data);
    if (!this.persist()) {
      this.data = JSON.parse(snapshot);
      return { ok: false, result: null };
    }
    this.emit();
    return { ok: true, result };
  }

  reset() {
    this.storage?.removeItem(STORAGE_KEY);
    this.data = clone(INITIAL_DATA);
    this.normalize(this.data);
    this.save();
    return this.data;
  }

  // ============================================
  // Аутентификация и JWT
  // ============================================
  getCurrentUser() {
    if (!this.data.currentUserId) return null;
    return this.data.users.find((u) => u.id === this.data.currentUserId) || null;
  }

  getJWTToken() {
    return this.data.jwtToken;
  }

  getDecodedJWT() {
    return this.data.jwtToken ? decodeJWT(this.data.jwtToken) : null;
  }

  issueToken(user) {
    return generateJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }

  login(email, password) {
    const user = this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) return { success: false, message: 'Пользователь с таким email не найден.' };
    if (user.password !== password) return { success: false, message: 'Неверный пароль. Попробуйте снова.' };

    const token = this.issueToken(user);
    this.data.currentUserId = user.id;
    this.data.currentUserRole = user.role;
    this.data.jwtToken = token;
    if (user.volunteerId) this.data.activeVolunteerId = user.volunteerId;
    if (user.orgId) this.data.activeOrgId = user.orgId;
    this.save();
    return { success: true, user, token };
  }

  register({ firstName, lastName, email, password, role }) {
    const cleanEmail = email.toLowerCase().trim();
    if (this.data.users.find((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'Пользователь с таким адресом электронной почты уже зарегистрирован!' };
    }

    const fullName = `${lastName.trim()} ${firstName.trim()}`;
    let linkedVolunteerId = null;
    let linkedOrgId = null;

    if (role === 'VOLUNTEER') {
      const newVol = this.addVolunteer({
        fullName,
        email: cleanEmail,
        phone: '+7 (900) 000-00-00',
        faculty: 'Донской государственный технический университет',
        studentId: `СТ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      });
      linkedVolunteerId = newVol.id;
      this.data.activeVolunteerId = newVol.id;
    } else if (role === 'ORGANIZER') {
      const newOrg = this.addOrganization({
        name: `Организация: ${fullName}`,
        contactPerson: fullName,
        email: cleanEmail,
        phone: '+7 (863) 200-00-00',
        description: 'Новый организатор социально-волонтёрских инициатив',
      });
      linkedOrgId = newOrg.id;
      this.data.activeOrgId = newOrg.id;
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      password,
      role,
      volunteerId: linkedVolunteerId,
      orgId: linkedOrgId,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);

    const token = this.issueToken(newUser);
    this.data.currentUserId = newUser.id;
    this.data.currentUserRole = role;
    this.data.jwtToken = token;
    this.save();
    return { success: true, user: newUser, token };
  }

  logout() {
    this.data.currentUserId = null;
    this.data.jwtToken = null;
    this.data.currentUserRole = 'PUBLIC';
    this.save();
  }

  updateUserProfile(userId, updates) {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    Object.assign(user, updates);
    this.data.jwtToken = this.issueToken(user);
    this.save();
    return user;
  }

  // ============================================
  // Роли и активные профили
  // ============================================
  getCurrentRole() {
    return this.data.currentUserRole;
  }

  setCurrentRole(role) {
    if (this.data.currentUserRole === role) return;
    this.data.currentUserRole = role;
    this.save();
  }

  getActiveVolunteer() {
    return this.getVolunteers().find((v) => v.id === this.data.activeVolunteerId) || this.getVolunteers()[0];
  }

  setActiveVolunteer(id) {
    this.data.activeVolunteerId = id;
    this.save();
  }

  getActiveOrg() {
    return this.data.organizations.find((o) => o.id === this.data.activeOrgId) || this.data.organizations[0];
  }

  setActiveOrg(id) {
    this.data.activeOrgId = id;
    this.save();
  }

  // ============================================
  // Организации и волонтёры
  // ============================================
  getOrganizations() {
    return this.data.organizations;
  }

  addOrganization(orgData) {
    const newOrg = { id: `org-${Date.now()}`, ...orgData };
    this.data.organizations.push(newOrg);
    this.save();
    return newOrg;
  }

  getVolunteers() {
    return this.data.volunteers.map((vol) => {
      const confirmedHours = this.data.requests
        .filter((r) => r.volonteerId === vol.id && r.status === 'CONFIRMED')
        .reduce((sum, r) => sum + (Number(r.confirmedHours) || 0), 0);
      return { ...vol, totalConfirmedHours: confirmedHours };
    });
  }

  addVolunteer(volData) {
    const newVol = { id: `vol-${Date.now()}`, totalConfirmedHours: 0, ...volData };
    this.data.volunteers.push(newVol);
    this.save();
    return newVol;
  }

  // ============================================
  // События
  // ============================================
  getEvents() {
    return this.data.events.map((evt) => {
      const org = this.data.organizations.find((o) => o.id === evt.organizationId);
      const eventRequests = this.data.requests.filter((r) => r.eventId === evt.id);
      const rating = this.getEventRating(evt.id);
      return {
        ...evt,
        organizationName: org ? org.name : 'Неизвестная организация',
        requestsCount: eventRequests.length,
        approvedVolunteersCount: eventRequests.filter((r) => r.status === 'ACCEPTED' || r.status === 'CONFIRMED').length,
        ratingAvg: rating.avg,
        reviewsCount: rating.count,
      };
    });
  }

  addEvent(eventData) {
    const newEvent = { id: `evt-${Date.now()}`, status: 'CREATED', ...eventData };
    this.data.events.unshift(newEvent);
    this.save();
    return newEvent;
  }

  updateEventStatus(eventId, newStatus) {
    const evt = this.data.events.find((e) => e.id === eventId);
    if (!evt) return null;
    evt.status = newStatus;
    this.save();
    return evt;
  }

  // ============================================
  // Заявки
  // ============================================
  getRequests() {
    return this.data.requests.map((req) => {
      const vol = this.data.volunteers.find((v) => v.id === req.volonteerId);
      const evt = this.data.events.find((e) => e.id === req.eventId);
      const org = evt ? this.data.organizations.find((o) => o.id === evt.organizationId) : null;
      return {
        ...req,
        volonteerName: vol ? vol.fullName : 'Неизвестный волонтер',
        volonteerFaculty: vol ? vol.faculty : '',
        volonteerStudentId: vol ? vol.studentId : '',
        eventTitle: evt ? evt.title : 'Неизвестное событие',
        eventDate: evt ? evt.startDate : '',
        eventStatus: evt ? evt.status : '',
        organizationName: org ? org.name : '',
      };
    });
  }

  submitRequest(volonteerId, eventId) {
    if (this.data.requests.find((r) => r.volonteerId === volonteerId && r.eventId === eventId)) {
      return { success: false, message: 'Заявка на это событие уже была подана ранее!' };
    }
    const evt = this.data.events.find((e) => e.id === eventId);
    const newReq = {
      id: `req-${Date.now()}`,
      volonteerId,
      eventId,
      status: 'PENDING',
      requestedHours: evt ? evt.plannedHours : 4,
      confirmedHours: null,
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.data.requests.unshift(newReq);
    this.save();
    return { success: true, request: newReq };
  }

  updateRequestStatus(requestId, newStatus, confirmedHours = null) {
    const req = this.data.requests.find((r) => r.id === requestId);
    if (!req) return null;
    req.status = newStatus;
    if (confirmedHours !== null && confirmedHours !== undefined) req.confirmedHours = Number(confirmedHours);
    this.save();
    return req;
  }

  confirmRequestHours(requestId, hours) {
    return this.updateRequestStatus(requestId, 'CONFIRMED', hours);
  }

  // Выписка об отработанных часах за период
  getVolunteerStatement(volonteerId, startDateStr, endDateStr) {
    const vol = this.getVolunteers().find((v) => v.id === volonteerId);
    if (!vol) return null;

    const startDate = startDateStr ? new Date(startDateStr) : new Date('2020-01-01');
    const endDate = endDateStr ? new Date(endDateStr) : new Date('2030-12-31');
    const items = [];
    let totalHours = 0;

    this.data.requests.forEach((req) => {
      if (req.volonteerId !== volonteerId || req.status !== 'CONFIRMED') return;
      const evt = this.data.events.find((e) => e.id === req.eventId);
      if (!evt || evt.status !== 'CLOSED') return;
      const eventDate = new Date(evt.startDate);
      if (eventDate < startDate || eventDate > endDate) return;
      const org = this.data.organizations.find((o) => o.id === evt.organizationId);
      const hours = Number(req.confirmedHours) || Number(req.requestedHours) || 0;
      totalHours += hours;
      items.push({
        eventName: evt.title,
        organizationName: org ? org.name : 'ДГТУ',
        eventDate: evt.startDate,
        location: evt.location,
        confirmedHours: hours,
      });
    });

    return {
      volunteer: vol,
      startDate: startDateStr,
      endDate: endDateStr,
      generatedAt: new Date().toLocaleDateString('ru-RU'),
      items,
      totalHours,
    };
  }

  // ============================================
  // Отзывы о мероприятиях
  // ============================================
  getEventReviews(eventId) {
    return (this.data.eventReviews || [])
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getEventRating(eventId) {
    const reviews = (this.data.eventReviews || []).filter((r) => r.eventId === eventId);
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
  }

  /**
   * Отзыв может оставить волонтёр, который реально участвовал:
   * его заявка подтверждена (CONFIRMED) или принята на уже закрытое событие.
   */
  canReviewEvent(volonteerId, eventId) {
    if (!volonteerId) return { allowed: false, reason: 'Отзывы оставляют волонтёры — участники мероприятия.' };
    const evt = this.data.events.find((e) => e.id === eventId);
    if (!evt) return { allowed: false, reason: 'Мероприятие не найдено.' };
    const req = this.data.requests.find((r) => r.volonteerId === volonteerId && r.eventId === eventId);
    const participated = req && (req.status === 'CONFIRMED' || (req.status === 'ACCEPTED' && evt.status === 'CLOSED'));
    if (!participated) {
      return { allowed: false, reason: 'Оставить отзыв можно после участия: организатор должен подтвердить ваши часы или закрыть мероприятие.' };
    }
    const existing = (this.data.eventReviews || []).find((r) => r.eventId === eventId && r.volonteerId === volonteerId) || null;
    return { allowed: true, existing };
  }

  /** Создаёт отзыв или обновляет собственный (один отзыв на волонтёра). */
  saveEventReview({ eventId, volonteerId, rating, text }) {
    const check = this.canReviewEvent(volonteerId, eventId);
    if (!check.allowed) return { success: false, message: check.reason };

    const numericRating = Math.round(Number(rating));
    if (!(numericRating >= 1 && numericRating <= 5)) {
      return { success: false, message: 'Поставьте оценку от 1 до 5 звёзд.' };
    }
    const cleanText = String(text || '').trim();
    if (cleanText.length < 10) return { success: false, message: 'Напишите отзыв хотя бы из 10 символов.' };
    if (cleanText.length > MAX_REVIEW_LENGTH) {
      return { success: false, message: `Отзыв не должен превышать ${MAX_REVIEW_LENGTH} символов.` };
    }

    const vol = this.data.volunteers.find((v) => v.id === volonteerId);
    const { ok, result } = this.commit((data) => {
      if (check.existing) {
        const target = data.eventReviews.find((r) => r.id === check.existing.id);
        Object.assign(target, { rating: numericRating, text: cleanText, updatedAt: new Date().toISOString() });
        return target;
      }
      const review = {
        id: `rev-${Date.now()}`,
        eventId,
        volonteerId,
        authorName: vol ? vol.fullName : 'Волонтёр ДГТУ',
        rating: numericRating,
        text: cleanText,
        createdAt: new Date().toISOString(),
      };
      data.eventReviews.unshift(review);
      return review;
    });
    if (!ok) return { success: false, message: 'Не удалось сохранить отзыв: хранилище браузера переполнено.' };
    return { success: true, review: result, updated: Boolean(check.existing) };
  }

  deleteEventReview(reviewId) {
    this.data.eventReviews = (this.data.eventReviews || []).filter((r) => r.id !== reviewId);
    this.save();
  }

  // ============================================
  // Карта и метки
  // ============================================
  getMapMarkers(filterType = 'ALL') {
    const markers = this.data.mapMarkers || [];
    if (filterType === 'ALL') return markers;
    if (filterType === 'PENDING_APPROVAL') return markers.filter((m) => m.status === 'PENDING_APPROVAL');
    if (filterType === 'FOUND') return markers.filter((m) => m.status === 'FOUND');
    return markers.filter((m) => m.type === filterType);
  }

  getMarker(markerId) {
    return (this.data.mapMarkers || []).find((m) => m.id === markerId) || null;
  }

  /**
   * Добавляет метку. Фотографии (data URL) прикрепляются к меткам ПСО.
   * Возвращает { success, marker } или { success: false, message }.
   */
  addMapMarker(markerData) {
    const user = this.getCurrentUser();
    const currentVol = this.getActiveVolunteer();
    const photos = Array.isArray(markerData.photos) ? markerData.photos.slice(0, MAX_MARKER_PHOTOS) : [];

    const { ok, result } = this.commit((data) => {
      if (!data.mapMarkers) data.mapMarkers = [];
      const marker = {
        id: `mark-${Date.now()}`,
        status: 'ACTIVE',
        createdBy: user?.volunteerId || user?.id || currentVol?.id || 'unknown',
        createdByName: user ? `${user.lastName} ${user.firstName}` : (currentVol?.fullName || 'Неизвестный'),
        createdAt: new Date().toISOString(),
        ...markerData,
        photos: markerData.type === 'SEARCH_RESCUE' ? photos : [],
      };
      data.mapMarkers.unshift(marker);
      return marker;
    });

    if (!ok) {
      return {
        success: false,
        message: 'Не удалось сохранить метку: фотографии не поместились в хранилище браузера. Уменьшите их количество.',
      };
    }
    return { success: true, marker: result };
  }

  updateMarkerStatus(markerId, newStatus) {
    const marker = this.getMarker(markerId);
    if (!marker) return null;
    marker.status = newStatus;
    this.save();
    return marker;
  }

  requestMarkerClose(markerId, closureData = {}) {
    const { ok, result } = this.commit((data) => {
      const marker = data.mapMarkers.find((m) => m.id === markerId);
      if (!marker) return null;
      marker.status = 'PENDING_APPROVAL';
      marker.closureProof = {
        photo: closureData.photo || '',
        note: closureData.note || '',
        targetStatus: closureData.targetStatus || 'FOUND',
        submittedBy: closureData.submittedBy || 'unknown',
        submittedByName: closureData.submittedByName || 'Волонтёр отряда',
        submittedAt: new Date().toISOString(),
      };
      return marker;
    });
    return ok ? result : null;
  }

  approveMarkerClose(markerId, adminId = 'adm-1', adminName = 'Администратор сервиса') {
    const marker = this.getMarker(markerId);
    if (!marker) return null;
    marker.status = marker.closureProof?.targetStatus || 'FOUND';
    if (marker.closureProof) {
      Object.assign(marker.closureProof, {
        approvedAt: new Date().toISOString(),
        approvedBy: adminName,
        approvedById: adminId,
      });
    }
    this.save();
    return marker;
  }

  rejectMarkerClose(markerId, reason = 'Недостаточно подтверждающих материалов') {
    const marker = this.getMarker(markerId);
    if (!marker) return null;
    marker.status = 'ACTIVE';
    if (marker.closureProof) {
      marker.closureProof.rejectedAt = new Date().toISOString();
      marker.closureProof.rejectReason = reason;
    }
    this.save();
    return marker;
  }

  getPendingMarkerApprovals() {
    return (this.data.mapMarkers || []).filter((m) => m.status === 'PENDING_APPROVAL');
  }

  deleteMarker(markerId) {
    this.data.mapMarkers = (this.data.mapMarkers || []).filter((m) => m.id !== markerId);
    this.save();
  }
}
