import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalForm } from '../components/Modal.jsx';
import { Field } from '../components/Common.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';
import { PrivacyPolicyText } from '../components/PrivacyPolicy.jsx';

// Демо-профили показываются только в режиме разработки (npm run dev) и в сборках с VITE_DEMO_ACCOUNTS=true.
// Эти учётные записи создаёт `volontiers-server seed`; в production сид запрещён.
const SHOW_DEMO = Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_DEMO_ACCOUNTS === 'true';

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

  const submit = async () => {
    const res = await store.login(email, password);
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
      {SHOW_DEMO && (
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
      )}
    </ModalForm>
  );
}

const ROLES = [
  { role: 'VOLUNTEER', title: 'Волонтёр', subtitle: 'Студент ДГТУ', icon: 'user' },
  { role: 'ORGANIZER', title: 'Организатор', subtitle: 'Создатель событий', icon: 'building' },
];

export function RegisterModal({ onClose, onAuthenticated }) {
  const store = useStore();
  const { showToast, openModal } = useUI();
  const [form, setForm] = useState({ role: 'VOLUNTEER', firstName: '', lastName: '', email: '', password: '', organizationName: '', consent: false });
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const submit = async () => {
    const res = await store.register(form);
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
      {form.role === 'ORGANIZER' && (
        <Field label="Название организации" hint="Оставьте пустым, чтобы указать позже. Организация видна всем в карточках событий.">
          <input className="form-input" maxLength={200} placeholder="Например: Клуб «Добрые руки»" {...bind('organizationName')} />
        </Field>
      )}
      <Field label="Электронная почта" required>
        <input type="email" className="form-input" required placeholder="ivan.petrov@donstu.ru" autoComplete="email" {...bind('email')} />
      </Field>
      <Field label="Пароль" required hint="Не менее 8 символов: буквы и хотя бы одна цифра или спецсимвол">
        <input type="password" className="form-input" minLength={8} maxLength={128} required autoComplete="new-password" {...bind('password')} />
      </Field>
      <label className="consent-row">
        <input type="checkbox" required checked={form.consent} onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} />
        <span>Я даю согласие на обработку моих персональных данных на условиях политики обработки данных (152-ФЗ)</span>
      </label>
      <details className="consent-details">
        <summary>Прочитать условия обработки данных</summary>
        <PrivacyPolicyText version={store.getPolicyVersion()} />
      </details>
    </ModalForm>
  );
}
