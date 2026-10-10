/**
 * Слой состояния VolontiersDSTU поверх backend (Rust + PostgreSQL).
 *
 * Чтение — синхронное, из кэша, который целиком обновляется одним GraphQL-запросом (hydrate)
 * после входа/выхода и после каждой мутации. Мутации — асинхронные и возвращают
 * { success, message?, ...данные }: решение о праве на действие принимает сервер,
 * поэтому интерфейс просто показывает его ответ.
 *
 * В браузере хранятся только необязательные настройки интерфейса (выбранный раздел,
 * активная организация/волонтёр для администратора) — никаких данных и токенов.
 */
import { createClient, ApiError } from '../api/client.js';
import { MAX_REVIEW_LENGTH } from './constants.js';

export { MAX_MARKER_PHOTOS, MAX_REVIEW_LENGTH } from './constants.js';

const UI_KEY = 'volontiers_ui_v2';

const USER = 'id firstName lastName email role createdAt organizationId volonteerId consentAcceptedAt consentVersion emailVerified';
const EVENT = 'id title description location startDate endDate requiredVolunteers plannedHours status cancelReason organizationId organizationName requestsCount approvedVolunteersCount ratingAvg reviewsCount createdAt';
const ORG = 'id name inn contactPerson email phone description createdAt';
const VOL = 'id fullName firstName lastName email phone birthDate studentId faculty totalConfirmedHours createdAt';
const REQ = 'id volonteerId volonteerName volonteerFaculty volonteerStudentId eventId eventTitle eventDate eventStatus organizationName status requestedHours confirmedHours rejectionReason createdAt updatedAt';
const REVIEW = 'id eventId volonteerId authorName rating text createdAt updatedAt';
const MARKER = `id type status title description lat lng urgency contactPhone lastSeenDate lastSeenLocation photos pendingPhotos
  closureProof { photo note targetStatus submittedBy submittedByName submittedAt approvedAt approvedBy rejectedAt rejectReason }
  createdBy createdByName createdAt`;

export const HYDRATE_QUERY = `query Hydrate {
  me { ${USER} }
  session { expiresAt }
  privacyPolicyVersion
  mailEnabled
  events { ${EVENT} }
  organizations { ${ORG} }
  volonteers { ${VOL} }
  requests { ${REQ} }
  reviews { ${REVIEW} }
  mapMarkers { ${MARKER} }
}`;

const EMPTY = () => ({ user: null, expiresAt: null, policyVersion: null, mailEnabled: false, events: [], organizations: [], volonteers: [], requests: [], reviews: [], markers: [], photoQueue: [] });

function normalizeUser(u) {
  return u ? { ...u, volunteerId: u.volonteerId, orgId: u.organizationId } : null;
}

export class ApiStore {
  constructor({ client, storage = globalThis.localStorage } = {}) {
    this.client = client || createClient();
    this.storage = storage;
    this.listeners = new Set();
    this.version = 0;
    this.cache = new Map();
    this.state = EMPTY();
    this.status = 'idle'; // idle | loading | ready | error
    this.error = null;
    this.ui = this.loadUi();
  }

  // ---------- Подписки (useSyncExternalStore) ----------
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  emit() {
    this.cache.clear();
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  memo(key, compute) {
    if (!this.cache.has(key)) this.cache.set(key, compute());
    return this.cache.get(key);
  }

  // ---------- Настройки интерфейса (не данные) ----------
  loadUi() {
    try {
      const raw = this.storage?.getItem(UI_KEY);
      if (raw) return { currentRole: 'PUBLIC', activeOrgId: null, activeVolunteerId: null, ...JSON.parse(raw) };
    } catch { /* игнорируем */ }
    return { currentRole: 'PUBLIC', activeOrgId: null, activeVolunteerId: null };
  }

  saveUi() {
    try { this.storage?.setItem(UI_KEY, JSON.stringify(this.ui)); } catch { /* приватный режим */ }
    this.emit();
  }

  // ---------- Загрузка данных ----------
  /** Первичная загрузка при старте приложения. */
  async init() {
    this.status = 'loading';
    this.emit();
    return this.refresh();
  }

  async refresh() {
    try {
      const d = await this.client(HYDRATE_QUERY);
      this.state = {
        user: normalizeUser(d.me),
        expiresAt: d.session?.expiresAt || null,
        policyVersion: d.privacyPolicyVersion || null,
        mailEnabled: Boolean(d.mailEnabled),
        events: d.events || [],
        organizations: d.organizations || [],
        volonteers: d.volonteers || [],
        requests: d.requests || [],
        reviews: d.reviews || [],
        markers: d.mapMarkers || [],
      };
      // очередь модерации фото — только для администратора, отдельным запросом
      this.state.photoQueue = [];
      if (this.state.user?.role === 'ADMIN') {
        try {
          const q = await this.client('{ photoModerationQueue { id markerId markerTitle url uploadedByName createdAt } }');
          this.state.photoQueue = q.photoModerationQueue || [];
        } catch { /* очередь не загрузилась — остальное работает */ }
      }
      this.status = 'ready';
      this.error = null;
    } catch (e) {
      this.error = e.message;
      if (this.status !== 'ready') this.status = 'error';
    }
    this.emit();
    return this.status === 'ready';
  }

  /** Выполняет мутацию и обновляет кэш; ошибки сервера превращает в { success: false, message }. */
  async mutate(doc, variables, pick) {
    try {
      const data = await this.client(doc, variables);
      await this.refresh();
      return { success: true, data: pick ? data[pick] : data };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') {
        await this.refresh();
        return { success: false, code: e.code, message: 'Сессия завершена. Войдите в систему заново.' };
      }
      return { success: false, code: e.code, message: e.message };
    }
  }

  // ---------- Аутентификация ----------
  getCurrentUser() { return this.state.user; }
  getSessionExpiry() { return this.state.expiresAt; }

  async login(email, password) {
    const res = await this.mutate(
      `mutation($email:String!,$password:String!){ login(email:$email,password:$password){ user { ${USER} } expiresAt } }`,
      { email: String(email).trim(), password },
      'login',
    );
    return res.success ? { success: true, user: normalizeUser(res.data.user) } : res;
  }

  /** consent — согласие на обработку персональных данных (обязательно); organizationName — только для организатора. */
  async register({ firstName, lastName, email, password, role, consent, organizationName }) {
    if (!consent) return { success: false, message: 'Для регистрации необходимо согласие на обработку персональных данных' };
    const res = await this.mutate(
      `mutation($firstName:String!,$lastName:String!,$email:String!,$password:String!,$role:UserRole!,$consent:Boolean!,$organizationName:String){
        register(firstName:$firstName,lastName:$lastName,email:$email,password:$password,role:$role,consent:$consent,organizationName:$organizationName){ user { ${USER} } expiresAt } }`,
      {
        firstName, lastName, email: String(email).trim(), password, role, consent: true,
        organizationName: role === 'ORGANIZER' ? (String(organizationName || '').trim() || null) : null,
      },
      'register',
    );
    return res.success ? { success: true, user: normalizeUser(res.data.user) } : res;
  }

  async logout() {
    try { await this.client('mutation{ logout }'); } catch { /* cookie всё равно очищается при следующем запросе */ }
    this.ui.currentRole = 'PUBLIC';
    this.saveUi();
    await this.refresh();
  }

  getPolicyVersion() { return this.state.policyVersion; }
  /** Настроена ли на сервере отправка писем (иначе «Забыли пароль?» и подтверждение почты скрыты). */
  isMailEnabled() { return this.state.mailEnabled; }

  /** Все данные пользователя о нём самом (JSON-текст) — право на доступ к данным. */
  async exportMyData() {
    try {
      const d = await this.client('mutation{ exportMyData }');
      return { success: true, json: d.exportMyData, fileName: `moi-dannye-volontery-${new Date().toISOString().slice(0, 10)}.json` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /** Волонтёр правит свой профиль; передаются только изменённые поля (пустая строка очищает факультет и номер билета). */
  updateMyProfile(fields) {
    const v = { firstName: null, lastName: null, phone: null, faculty: null, studentId: null, ...fields };
    return this.mutate(
      'mutation($firstName:String,$lastName:String,$phone:String,$faculty:String,$studentId:String){ updateMyProfile(firstName:$firstName,lastName:$lastName,phone:$phone,faculty:$faculty,studentId:$studentId){ id } }',
      v,
    );
  }

  /** Смена пароля: сервер отзывает старые сессии и выдаёт новую. */
  changePassword(oldPassword, newPassword) {
    return this.mutate('mutation($o:String!,$n:String!){ changePassword(oldPassword:$o,newPassword:$n) }', { o: oldPassword, n: newPassword });
  }

  /** Письмо со ссылкой для нового пароля. Ответ не зависит от того, есть ли такой адрес. */
  requestPasswordReset(email) {
    return this.mutate('mutation($email:String!){ requestPasswordReset(email:$email) }', { email: String(email).trim() });
  }

  /** Новый пароль по токену из письма; после успеха нужно войти заново. */
  resetPassword(token, newPassword) {
    return this.mutate('mutation($token:String!,$password:String!){ resetPassword(token:$token,newPassword:$password) }', { token, password: newPassword });
  }

  verifyEmail(token) {
    return this.mutate('mutation($token:String!){ verifyEmail(token:$token) }', { token });
  }

  resendVerification() {
    return this.mutate('mutation{ resendVerification }', {});
  }

  /** Удаляет учётную запись с немедленным обезличиванием данных; после успеха пользователь — гость. */
  async deleteMyAccount(password) {
    const res = await this.mutate('mutation($password:String!){ deleteMyAccount(password:$password) }', { password });
    if (res.success) {
      this.ui.currentRole = 'PUBLIC';
      this.saveUi();
    }
    return res;
  }

  // ---------- Роли и активные профили (настройки интерфейса) ----------
  getCurrentRole() { return this.ui.currentRole; }

  setCurrentRole(role) {
    if (this.ui.currentRole === role) return;
    this.ui.currentRole = role;
    this.saveUi();
  }

  getActiveVolunteer() {
    const vols = this.getVolunteers();
    const user = this.state.user;
    if (user?.role === 'VOLUNTEER') return vols.find((v) => v.id === user.volonteerId) || vols[0];
    return vols.find((v) => v.id === this.ui.activeVolunteerId) || vols[0];
  }

  setActiveVolunteer(id) { this.ui.activeVolunteerId = id; this.saveUi(); }

  getActiveOrg() {
    const orgs = this.getOrganizations();
    const user = this.state.user;
    if (user?.role === 'ORGANIZER') return orgs.find((o) => o.id === user.organizationId) || orgs[0];
    return orgs.find((o) => o.id === this.ui.activeOrgId) || orgs[0];
  }

  setActiveOrg(id) { this.ui.activeOrgId = id; this.saveUi(); }

  // ---------- Чтение ----------
  getOrganizations() { return this.state.organizations; }
  getVolunteers() { return this.state.volonteers; }
  getEvents() { return this.state.events; }
  getEvent(id) { return this.state.events.find((e) => e.id === id) || null; }
  getRequests() { return this.state.requests; }

  getReviewsByEvent() {
    return this.memo('reviewsByEvent', () => {
      const map = new Map();
      this.state.reviews.forEach((r) => {
        if (!map.has(r.eventId)) map.set(r.eventId, []);
        map.get(r.eventId).push(r);
      });
      return map;
    });
  }

  getEventReviews(eventId) { return this.getReviewsByEvent().get(eventId) || []; }
  getAllReviews() { return this.state.reviews; }

  /** Подсказка для интерфейса; окончательное решение принимает сервер (и триггер БД). */
  canReviewEvent(volonteerId, eventId) {
    if (!volonteerId) return { allowed: false, reason: 'Отзывы оставляют волонтёры — участники мероприятия.' };
    const evt = this.getEvent(eventId);
    if (!evt) return { allowed: false, reason: 'Мероприятие не найдено.' };
    const req = this.state.requests.find((r) => r.volonteerId === volonteerId && r.eventId === eventId);
    const participated = req && (req.status === 'CONFIRMED' || (req.status === 'ACCEPTED' && evt.status === 'CLOSED'));
    if (!participated) {
      return { allowed: false, reason: 'Оставить отзыв можно после участия: организатор должен подтвердить ваши часы или закрыть мероприятие.' };
    }
    const existing = this.state.reviews.find((r) => r.eventId === eventId && r.volonteerId === volonteerId) || null;
    return { allowed: true, existing };
  }

  getMapMarkers(filterType = 'ALL') {
    const markers = this.state.markers;
    if (filterType === 'ALL') return markers;
    if (filterType === 'PENDING_APPROVAL') return markers.filter((m) => m.status === 'PENDING_APPROVAL');
    if (filterType === 'FOUND') return markers.filter((m) => m.status === 'FOUND');
    return markers.filter((m) => m.type === filterType);
  }

  getMarker(id) { return this.state.markers.find((m) => m.id === id) || null; }
  getPendingMarkerApprovals() { return this.state.markers.filter((m) => m.status === 'PENDING_APPROVAL'); }

  /** Выписка формируется на сервере (только CONFIRMED на закрытых событиях). */
  async fetchStatement(volonteerId, startDate, endDate) {
    try {
      const d = await this.client(
        `query($v:ID!,$s:String!,$e:String!){ volonteerStatement(volonteerId:$v,startDate:$s,endDate:$e){
          volunteer { id fullName studentId faculty } startDate endDate generatedAt totalHours closedEventsCount
          items { eventName organizationName eventDate location confirmedHours } } }`,
        { v: volonteerId, s: startDate || '', e: endDate || '' },
      );
      return { success: true, report: d.volonteerStatement };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // ---------- Администратор ----------
  addOrganization(v) {
    return this.mutate(
      `mutation($name:String!,$contactPerson:String!,$email:String!,$phone:String!,$inn:String,$description:String){
        registerOrganization(name:$name,contactPerson:$contactPerson,email:$email,phone:$phone,inn:$inn,description:$description){ id name } }`,
      { name: v.name, contactPerson: v.contactPerson, email: v.email, phone: v.phone, inn: v.inn || null, description: v.description || null },
      'registerOrganization',
    );
  }

  addVolunteer(v) {
    return this.mutate(
      `mutation($fullName:String!,$email:String!,$phone:String!,$studentId:String,$faculty:String,$birthDate:String){
        registerVolonteer(fullName:$fullName,email:$email,phone:$phone,studentId:$studentId,faculty:$faculty,birthDate:$birthDate){ id fullName } }`,
      { fullName: v.fullName, email: v.email, phone: v.phone, studentId: v.studentId || null, faculty: v.faculty || null, birthDate: v.birthDate || null },
      'registerVolonteer',
    );
  }

  moderateEvent(eventId, status) {
    return this.mutate('mutation($eventId:ID!,$status:EventStatus!){ moderateEvent(eventId:$eventId,status:$status){ id status } }', { eventId, status }, 'moderateEvent');
  }

  // ---------- Организатор ----------
  addEvent(e) {
    return this.mutate(
      `mutation($title:String!,$description:String!,$location:String!,$startDate:String!,$endDate:String!,$requiredVolunteers:Int!,$plannedHours:Float!,$organizationId:ID!){
        createEvent(title:$title,description:$description,location:$location,startDate:$startDate,endDate:$endDate,requiredVolunteers:$requiredVolunteers,plannedHours:$plannedHours,organizationId:$organizationId){ id title status } }`,
      {
        title: e.title, description: e.description, location: e.location, startDate: e.startDate, endDate: e.endDate,
        requiredVolunteers: Number(e.requiredVolunteers), plannedHours: Number(e.plannedHours), organizationId: e.organizationId,
      },
      'createEvent',
    );
  }

  /** DRAFT | ACCEPTED → CANCELLED; заявки принятого события сервер отменяет автоматически. */
  cancelEvent(eventId, reason = null) {
    return this.mutate(
      'mutation($eventId:ID!,$reason:String){ cancelEvent(eventId:$eventId,reason:$reason){ id status cancelReason } }',
      { eventId, reason: reason ? String(reason).trim() || null : null },
      'cancelEvent',
    );
  }

  closeEvent(eventId) {
    return this.mutate('mutation($eventId:ID!){ closeEvent(eventId:$eventId){ id status } }', { eventId }, 'closeEvent');
  }

  moderateRequest(requestId, status, rejectionReason = null) {
    return this.mutate(
      'mutation($requestId:ID!,$status:RequestStatus!,$rejectionReason:String){ moderateRequest(requestId:$requestId,status:$status,rejectionReason:$rejectionReason){ id status } }',
      { requestId, status, rejectionReason },
      'moderateRequest',
    );
  }

  confirmRequestHours(requestId, confirmedHours) {
    return this.mutate(
      'mutation($requestId:ID!,$confirmedHours:Float!){ confirmVolunteerWork(requestId:$requestId,confirmedHours:$confirmedHours){ id status confirmedHours } }',
      { requestId, confirmedHours: Number(confirmedHours) },
      'confirmVolunteerWork',
    );
  }

  // ---------- Волонтёр ----------
  submitRequest(volonteerId, eventId) {
    return this.mutate(
      'mutation($volonteerId:ID!,$eventId:ID!){ submitEventRequest(volonteerId:$volonteerId,eventId:$eventId){ id status } }',
      { volonteerId, eventId },
      'submitEventRequest',
    );
  }

  cancelRequest(requestId) {
    return this.mutate('mutation($requestId:ID!){ cancelEventRequest(requestId:$requestId){ id status } }', { requestId }, 'cancelEventRequest');
  }

  async saveEventReview({ eventId, volonteerId, rating, text }) {
    const check = this.canReviewEvent(volonteerId, eventId);
    if (!check.allowed) return { success: false, message: check.reason };
    const numericRating = Math.round(Number(rating));
    if (!(numericRating >= 1 && numericRating <= 5)) return { success: false, message: 'Поставьте оценку от 1 до 5 звёзд.' };
    const clean = String(text || '').trim();
    if (clean.length < 10) return { success: false, message: 'Напишите отзыв хотя бы из 10 символов.' };
    if (clean.length > MAX_REVIEW_LENGTH) return { success: false, message: `Отзыв не должен превышать ${MAX_REVIEW_LENGTH} символов.` };
    const res = await this.mutate(
      'mutation($eventId:ID!,$volonteerId:ID!,$rating:Int!,$text:String!){ submitEventReview(eventId:$eventId,volonteerId:$volonteerId,rating:$rating,text:$text){ id } }',
      { eventId, volonteerId, rating: numericRating, text: clean },
      'submitEventReview',
    );
    return res.success ? { ...res, updated: Boolean(check.existing) } : res;
  }

  deleteEventReview(reviewId) {
    return this.mutate('mutation($reviewId:ID!){ deleteEventReview(reviewId:$reviewId) }', { reviewId });
  }

  // ---------- Карта ----------
  /** Фото — data URL; сервер сам проверяет, перекодирует и кладёт их в PostgreSQL. */
  async addMapMarker(m) {
    const res = await this.mutate(
      `mutation($input:MapMarkerInput!){ createMapMarker(input:$input){ id title lat lng } }`,
      { input: {
        type: m.type, title: m.title, description: m.description, lat: m.lat, lng: m.lng, urgency: m.urgency,
        contactPhone: m.contactPhone || null, lastSeenDate: m.lastSeenDate || null, lastSeenLocation: m.lastSeenLocation || null,
        photos: m.type === 'SEARCH_RESCUE' ? (m.photos || []) : [],
      } },
      'createMapMarker',
    );
    return res.success ? { success: true, marker: res.data } : res;
  }

  requestMarkerClose(markerId, { photo, note, targetStatus }) {
    return this.mutate(
      'mutation($markerId:ID!,$photo:String,$note:String!,$targetStatus:MapMarkerStatus!){ requestMarkerClose(markerId:$markerId,photo:$photo,note:$note,targetStatus:$targetStatus){ id status } }',
      { markerId, photo, note, targetStatus },
      'requestMarkerClose',
    );
  }

  approveMarkerClose(markerId) {
    return this.mutate('mutation($markerId:ID!){ approveMarkerClose(markerId:$markerId){ id status } }', { markerId }, 'approveMarkerClose');
  }

  rejectMarkerClose(markerId, reason) {
    return this.mutate('mutation($markerId:ID!,$reason:String){ rejectMarkerClose(markerId:$markerId,reason:$reason){ id status } }', { markerId, reason }, 'rejectMarkerClose');
  }

  /** Очередь фото меток, ожидающих проверки (заполняется только у администратора). */
  getPhotoQueue() { return this.state.photoQueue; }

  approvePhoto(photoId) {
    return this.mutate('mutation($photoId:ID!){ approvePhoto(photoId:$photoId){ id } }', { photoId }, 'approvePhoto');
  }

  rejectPhoto(photoId, reason) {
    return this.mutate('mutation($photoId:ID!,$reason:String){ rejectPhoto(photoId:$photoId,reason:$reason){ id } }', { photoId, reason }, 'rejectPhoto');
  }

  closeMarker(markerId) {
    return this.mutate('mutation($markerId:ID!){ closeMapMarker(markerId:$markerId){ id status } }', { markerId }, 'closeMapMarker');
  }
}
