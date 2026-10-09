import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

export default function ChangePasswordModal({ onClose }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (newPassword !== repeat) { showToast('Новые пароли не совпадают', 'error'); return; }
    setBusy(true);
    const res = await store.changePassword(oldPassword, newPassword);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Пароль изменён. Другие устройства выйдут из системы.');
    openModal('profile');
  };

  return (
    <ModalForm
      title="Смена пароля"
      icon="lock"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => openModal('profile')}>Назад в кабинет</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !oldPassword || !newPassword}>Изменить пароль</button>
        </>
      )}
    >
      <Field label="Текущий пароль" required>
        <input type="password" className="form-input" required autoComplete="current-password" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
      </Field>
      <Field label="Новый пароль" required hint="Не менее 8 символов: буквы и хотя бы одна цифра или спецсимвол">
        <input type="password" className="form-input" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
      </Field>
      <Field label="Повторите новый пароль" required>
        <input type="password" className="form-input" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
    </ModalForm>
  );
}
