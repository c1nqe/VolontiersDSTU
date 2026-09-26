import { useState } from 'react';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

export default function CreateEventModal({ onClose }) {
  const store = useStore();
  const { showToast } = useUI();
  const [f, setF] = useState({ title: '', description: '', location: '', startDate: '', endDate: '', requiredVolunteers: 10, plannedHours: 6 });
  const bind = (k) => ({ value: f[k], onChange: (e) => setF((s) => ({ ...s, [k]: e.target.value })) });

  const submit = () => {
    const org = store.getActiveOrg();
    if (!org) return;
    if (f.endDate && f.startDate && f.endDate < f.startDate) {
      showToast('Дата окончания не может быть раньше даты начала', 'error');
      return;
    }
    const evt = store.addEvent({
      ...f,
      requiredVolunteers: Number(f.requiredVolunteers),
      plannedHours: Number(f.plannedHours),
      organizationId: org.id,
    });
    showToast(`Событие «${evt.title}» отправлено администратору на модерацию.`);
    onClose();
  };

  return (
    <ModalForm
      title="Новое событие"
      subtitle="После создания событие уходит на модерацию администратору"
      icon="calendar"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary">Отправить на модерацию</button>
        </>
      )}
    >
      <Field label="Название события" required><input className="form-input" required placeholder="Студенческий форум ДГТУ 2026" {...bind('title')} /></Field>
      <Field label="Описание и задачи волонтёров" required><textarea className="form-textarea" required placeholder="Что предстоит делать, требования к участникам, условия…" {...bind('description')} /></Field>
      <Field label="Место проведения" required><input className="form-input" required placeholder="г. Ростов-на-Дону, пл. Гагарина, 1" {...bind('location')} /></Field>
      <div className="form-row">
        <Field label="Дата начала" required><input type="date" className="form-input" required {...bind('startDate')} /></Field>
        <Field label="Дата окончания" required><input type="date" className="form-input" required min={f.startDate || undefined} {...bind('endDate')} /></Field>
      </div>
      <div className="form-row">
        <Field label="Требуется волонтёров" required><input type="number" className="form-input" min="1" required {...bind('requiredVolunteers')} /></Field>
        <Field label="Планируемые часы работы" required><input type="number" className="form-input" min="1" step="0.5" required {...bind('plannedHours')} /></Field>
      </div>
    </ModalForm>
  );
}
