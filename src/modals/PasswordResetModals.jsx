import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

/** Шаг 1: пользователь вводит почту, сервер отправляет ссылку. Ответ одинаков для любого адреса. */
export function ForgotPasswordModal({ onClose }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await store.requestPasswordReset(email);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    setSent(true);
  };

  return (
    <ModalForm
      title="Восстановление пароля"
      icon="lock"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => openModal('login')}>Назад ко входу</button>
          {!sent && <button type="submit" className="btn btn-primary" disabled={busy || !email}>Отправить ссылку</button>}
        </>
      )}
    >
      {sent ? (
        <p data-testid="reset-sent">
          Если адрес <strong>{email.trim()}</strong> зарегистрирован, мы отправили на него письмо со ссылкой.
          Ссылка действует 1 час. Проверьте также папку «Спам».
        </p>
      ) : (
        <Field label="Электронная почта" required hint="Укажите адрес, на который зарегистрирован аккаунт">
          <input type="email" className="form-input" required autoComplete="username" placeholder="name@donstu.ru" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
    </ModalForm>
  );
}

/** Шаг 2: пользователь пришёл по ссылке из письма (?reset=токен) и задаёт новый пароль. */
export function ResetPasswordModal({ onClose, token }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password !== repeat) { showToast('Пароли не совпадают', 'error'); return; }
    setBusy(true);
    const res = await store.resetPassword(token, password);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Пароль изменён. Войдите с новым паролем.');
    openModal('login');
  };

  return (
    <ModalForm
      title="Новый пароль"
      icon="lock"
      onClose={onClose}
      onSubmit={submit}
      footer={<button type="submit" className="btn btn-primary" disabled={busy || !password}>Сохранить пароль</button>}
    >
      <Field label="Новый пароль" required hint="Не менее 8 символов: буквы и хотя бы одна цифра или спецсимвол">
        <input type="password" className="form-input" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Повторите пароль" required>
        <input type="password" className="form-input" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <p className="muted small">После смены пароля все устройства, где вы были авторизованы, выйдут из системы.</p>
    </ModalForm>
  );
}
