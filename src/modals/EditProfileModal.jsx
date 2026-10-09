import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

export default function EditProfileModal({ onClose }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const vol = store.getActiveVolunteer();
  const [form, setForm] = useState({
    firstName: vol?.firstName || '',
    lastName: vol?.lastName || '',
    phone: vol?.phone || '',
    faculty: vol?.faculty || '',
    studentId: vol?.studentId || '',
  });
  const [busy, setBusy] = useState(false);
  if (!vol) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    const res = await store.updateMyProfile({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      phone: form.phone.trim(), faculty: form.faculty.trim(), studentId: form.studentId.trim(),
    });
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Профиль обновлён.');
    openModal('profile');
  };

  return (
    <ModalForm
      title="Редактирование профиля"
      icon="user"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => openModal('profile')}>Назад в кабинет</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Сохранить</button>
        </>
      )}
    >
      <div className="form-row">
        <Field label="Имя" required><input className="form-input" required maxLength={100} value={form.firstName} onChange={set('firstName')} /></Field>
        <Field label="Фамилия" required><input className="form-input" required maxLength={100} value={form.lastName} onChange={set('lastName')} /></Field>
      </div>
      <Field label="Телефон"><input className="form-input" type="tel" maxLength={40} value={form.phone} onChange={set('phone')} /></Field>
      <Field label="Факультет"><input className="form-input" maxLength={200} value={form.faculty} onChange={set('faculty')} /></Field>
      <Field label="Номер студенческого билета"><input className="form-input" maxLength={40} value={form.studentId} onChange={set('studentId')} /></Field>
      <p className="muted small">Электронную почту и дату рождения меняет администратор.</p>
    </ModalForm>
  );
}
