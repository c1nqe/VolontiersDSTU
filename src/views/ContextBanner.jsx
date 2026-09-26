import Icon from '../components/Icon.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { useUI } from '../components/UIContext.jsx';

const TEXT = {
  ADMIN: {
    title: 'Рабочее место администратора',
    desc: 'Регистрация организаторов и волонтёров, согласование и отмена событий',
  },
  ORGANIZER: {
    title: 'Личный кабинет организатора событий',
    desc: 'Создание событий, отбор волонтёров и подтверждение часов работы',
  },
  VOLUNTEER: {
    title: 'Рабочее место волонтёра',
    desc: 'Поиск событий, подача заявок, отзывы и выписка подтверждённых часов',
  },
  MAP: {
    title: 'Интерактивная карта волонтёров и поисков',
    desc: 'Координация поисково-спасательных операций (ПСО) и точек помощи в Ростове-на-Дону',
  },
};

export default function ContextBanner({ view }) {
  const store = useStore();
  const { showToast } = useUI();
  const text = TEXT[view];
  if (!text) return null;

  let controls = null;
  if (view === 'ADMIN') {
    controls = <span className="context-note"><Icon name="shield" /> Главный координатор ВЦ ДГТУ</span>;
  } else if (view === 'ORGANIZER') {
    const current = store.getActiveOrg();
    controls = (
      <label className="context-selector">
        <span>Организация:</span>
        <select
          value={current?.id || ''}
          onChange={(e) => {
            store.setActiveOrg(e.target.value);
            showToast(`Выбрана организация: ${store.getActiveOrg().name}`);
          }}
        >
          {store.getOrganizations().map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
    );
  } else if (view === 'VOLUNTEER') {
    const current = store.getActiveVolunteer();
    controls = (
      <label className="context-selector">
        <span>Профиль:</span>
        <select
          value={current?.id || ''}
          onChange={(e) => {
            store.setActiveVolunteer(e.target.value);
            showToast(`Выбран волонтёр: ${store.getActiveVolunteer().fullName}`);
          }}
        >
          {store.getVolunteers().map((v) => <option key={v.id} value={v.id}>{v.fullName}</option>)}
        </select>
      </label>
    );
  } else if (view === 'MAP') {
    controls = (
      <div className="context-legend">
        <span className="legend-chip rescue"><span className="color-dot color-dot-rescue" /> Поисково-спасательные</span>
        <span className="legend-chip regular"><span className="color-dot color-dot-regular" /> Волонтёрская помощь</span>
      </div>
    );
  }

  return (
    <section className="context-banner no-print">
      <div className="context-info">
        <h2>{text.title}</h2>
        <p>{text.desc}</p>
      </div>
      <div className="context-controls">{controls}</div>
    </section>
  );
}
