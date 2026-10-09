import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

export default function DeleteAccountModal({ onClose }) {
  const store = useStore();
  const { showToast } = useUI();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const user = store.getCurrentUser();
  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    const res = await store.deleteMyAccount(password);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Аккаунт удалён, личные данные обезличены.', 'info');
    onClose();
  };

  return (
    <ModalForm
      title="Удаление аккаунта"
      icon="cross"
      iconTone="danger"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Оставить аккаунт</button>
          <button type="submit" className="btn btn-danger" disabled={busy || !password}>Удалить навсегда</button>
        </>
      )}
    >
      <div className="info-panel">
        <div className="info-panel-title">Что произойдёт</div>
        <ul className="policy-list">
          <li>Имя, почта, телефон, факультет, номер студенческого и дата рождения будут обезличены сразу.</li>
          <li>Ваши отзывы удалятся, активные заявки отменятся, контакты в ваших метках на карте будут скрыты.</li>
          <li>Подтверждённые часы останутся у организатора без вашего имени — они нужны для отчётности.</li>
          {user.role === 'ORGANIZER' && <li>Сначала отмените или закройте активные события организации; черновики отменятся автоматически.</li>}
          <li>Войти в этот аккаунт снова будет нельзя. Перед удалением можно скачать свои данные в личном кабинете.</li>
        </ul>
      </div>
      <Field label="Подтвердите паролем" required>
        <input type="password" className="form-input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </ModalForm>
  );
}
