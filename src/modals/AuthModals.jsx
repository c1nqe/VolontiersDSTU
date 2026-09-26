import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

const DEMO_ACCOUNTS = [
  { email: 'admin@donstu.ru', pass: 'admin123', label: 'Администратор', icon: 'shield' },
  { email: 'organizer@donstu.ru', pass: 'org123', label: 'Организатор', icon: 'building' },
  { email: 'volunteer@donstu.ru', pass: 'vol123', label: 'Волонтёр', icon: 'user' },
];

export function LoginModal({ onClose, onAuthenticated }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    const res = store.login(email, password);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast(`Добро пожаловать, ${res.user.firstName}!`);
    onClose();
    onAuthenticated(res.user.role);
  };

  return (
    <ModalForm
      title="Вход в личный кабинет"
      icon="lock"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-link" onClick={() => openModal('register')}>Нет аккаунта? Зарегистрироваться</button>
          <button type="submit" className="btn btn-primary">Войти</button>
        </>
      )}
    >
      <Field label="Электронная почта" required>
        <input type="email" className="form-input" required autoComplete="username" placeholder="name@donstu.ru" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Пароль" required>
        <input type="password" className="form-input" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="demo-login-box">
        <p>Демо-профили для проверки:</p>
        <div className="demo-chips">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" className="demo-chip" onClick={() => { setEmail(a.email); setPassword(a.pass); }}>
              <Icon name={a.icon} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </ModalForm>
  );
}

const ROLES = [
  { role: 'VOLUNTEER', title: 'Волонтёр', subtitle: 'Студент ДГТУ', icon: 'user' },
  { role: 'ORGANIZER', title: 'Организатор', subtitle: 'Создатель событий', icon: 'building' },
  { role: 'ADMIN', title: 'Администратор', subtitle: 'Координатор', icon: 'shield' },
];

export function RegisterModal({ onClose, onAuthenticated }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [form, setForm] = useState({ role: 'VOLUNTEER', firstName: '', lastName: '', email: '', password: '' });
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const submit = () => {
    const res = store.register(form);
    if (!res.success) { showToast(res.message, 'error'); return; }
    showToast('Аккаунт создан, вы вошли в систему.');
    onClose();
    onAuthenticated(form.role);
  };

  return (
    <ModalForm
      title="Регистрация в сервисе «Волонтёры»"
      icon="userPlus"
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn btn-link" onClick={() => openModal('login')}>Уже есть аккаунт? Войти</button>
          <button type="submit" className="btn btn-primary">Зарегистрироваться</button>
        </>
      )}
    >
      <span className="form-label">Тип учётной записи *</span>
      <div className="role-radio-group" role="radiogroup">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            role="radio"
            aria-checked={form.role === r.role}
            className={`role-radio-card ${form.role === r.role ? 'active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, role: r.role }))}
          >
            <Icon name={r.icon} size={22} />
            <span className="role-title">{r.title}</span>
            <span className="role-subtitle">{r.subtitle}</span>
          </button>
        ))}
      </div>
      <div className="form-row">
        <Field label="Имя" required><input className="form-input" required placeholder="Иван" autoComplete="given-name" {...bind('firstName')} /></Field>
        <Field label="Фамилия" required><input className="form-input" required placeholder="Петров" autoComplete="family-name" {...bind('lastName')} /></Field>
      </div>
      <Field label="Электронная почта" required>
        <input type="email" className="form-input" required placeholder="ivan.petrov@donstu.ru" autoComplete="email" {...bind('email')} />
      </Field>
      <Field label="Пароль" required hint="Минимум 4 символа">
        <input type="password" className="form-input" minLength={4} required autoComplete="new-password" {...bind('password')} />
      </Field>
    </ModalForm>
  );
}
