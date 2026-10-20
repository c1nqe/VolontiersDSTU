import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

/**
 * Отмена события. Администратор отменяет сразу (причина необязательна).
 * Организатор снимает черновик сразу, а принятое событие только просит отменить: нужна причина,
 * решение принимает администратор, до него событие и заявки остаются в силе.
 */
export default function CancelEventModal({ onClose, eventId }) {
  const store = useStore();
  const { showToast } = useUI();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const event = store.getEvent(eventId);
  if (!event) return null;
  const isAdmin = store.getCurrentUser()?.role === 'ADMIN';
  const needsApproval = !isAdmin && event.status === 'ACCEPTED';
  const hasRequests = event.status === 'ACCEPTED' && event.requestsCount > 0;

  const submit = async () => {
    if (needsApproval && !reason.trim()) { showToast('Укажите причину отмены — её увидит администратор', 'error'); return; }
    setBusy(true);
    const res = await store.cancelEvent(eventId, reason);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast(needsApproval ? 'Запрос на отмену отправлен администратору. До его решения событие остаётся в силе.' : 'Событие отменено.', 'info');
    onClose();
  };

  return (
    <ModalForm
      title={needsApproval ? 'Запрос на отмену события' : 'Отмена события'}
      subtitle={event.title}
      icon="cross"
      iconTone="danger"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Не отменять</button>
          <button type="submit" className="btn btn-danger" disabled={busy}>{needsApproval ? 'Отправить запрос' : 'Отменить событие'}</button>
        </>
      )}
    >
      {needsApproval && (
        <p className="info-panel">
          Событие уже опубликовано, поэтому отменить его может только администратор. Он получит ваш запрос с причиной;
          если согласует, событие и заявки волонтёров будут отменены.
        </p>
      )}
      {hasRequests && !needsApproval && (
        <p className="info-panel">
          Все открытые и принятые заявки волонтёров ({event.requestsCount}) будут отменены автоматически. Это действие нельзя отменить.
        </p>
      )}
      <Field
        label="Причина отмены"
        required={needsApproval}
        hint={needsApproval ? 'Обязательно. Увидят администратор и, после отмены, волонтёры.' : 'Необязательно. Увидят волонтёры, подавшие заявку.'}
      >
        <textarea className="form-textarea" maxLength={500} required={needsApproval} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: неблагоприятная погода" />
      </Field>
    </ModalForm>
  );
}
