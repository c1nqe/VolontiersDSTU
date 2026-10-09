import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

/** Отмена события (DRAFT или ACCEPTED) с необязательной причиной, которую увидят участники. */
export default function CancelEventModal({ onClose, eventId }) {
  const store = useStore();
  const { showToast } = useUI();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const event = store.getEvent(eventId);
  if (!event) return null;
  const hasRequests = event.status === 'ACCEPTED' && event.requestsCount > 0;

  const submit = async () => {
    setBusy(true);
    const res = await store.cancelEvent(eventId, reason);
    setBusy(false);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Событие отменено.', 'info');
    onClose();
  };

  return (
    <ModalForm
      title="Отмена события"
      subtitle={event.title}
      icon="cross"
      iconTone="danger"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Не отменять</button>
          <button type="submit" className="btn btn-danger" disabled={busy}>Отменить событие</button>
        </>
      )}
    >
      {hasRequests && (
        <p className="info-panel">
          Все открытые и принятые заявки волонтёров ({event.requestsCount}) будут отменены автоматически. Это действие нельзя отменить.
        </p>
      )}
      <Field label="Причина отмены" hint="Необязательно. Увидят волонтёры, подавшие заявку.">
        <textarea className="form-textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: неблагоприятная погода" />
      </Field>
    </ModalForm>
  );
}
