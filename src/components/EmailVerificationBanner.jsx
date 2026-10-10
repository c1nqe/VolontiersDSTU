import { useState } from 'react';
import Icon from './Icon.jsx';
import { useRun, useStore } from '../store/StoreContext.jsx';

/** Напоминание вошедшему пользователю с неподтверждённой почтой (только если на сервере настроена отправка писем). */
export default function EmailVerificationBanner() {
  const store = useStore();
  const run = useRun();
  const [sent, setSent] = useState(false);
  const user = store.getCurrentUser();
  if (!user || user.emailVerified !== false || !store.isMailEnabled()) return null;

  const resend = async () => {
    const res = await run(store.resendVerification(), 'Письмо отправлено. Проверьте почту.');
    if (res.success) setSent(true);
  };

  return (
    <div className="verify-banner" role="status" data-testid="verify-banner">
      <Icon name="mail" />
      <span>Адрес <strong>{user.email}</strong> не подтверждён. Перейдите по ссылке из письма, чтобы подтвердить его и иметь возможность восстановить пароль.</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={resend} disabled={sent}>{sent ? 'Письмо отправлено' : 'Отправить ещё раз'}</button>
    </div>
  );
}
