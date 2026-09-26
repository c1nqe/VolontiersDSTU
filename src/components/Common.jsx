import Icon from './Icon.jsx';

export function StatCard({ label, value, sub, tone, marker }) {
  return (
    <div className={`stat-card ${marker ? `stat-card-${marker}` : ''}`}>
      <div className="stat-header-flex">
        {marker && <span className={`color-badge-panel ${marker}`} />}
        <span className="stat-label">{label}</span>
      </div>
      <span className={`stat-val ${tone ? `tone-${tone}` : ''}`}>{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function StatsGrid({ children }) {
  return <div className="stats-grid">{children}</div>;
}

export function EmptyState({ icon = 'search', title, children, tone }) {
  return (
    <div className="empty-state">
      <div className={`empty-state-icon ${tone ? `tone-${tone}` : ''}`}><Icon name={icon} size={36} /></div>
      <h4>{title}</h4>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Badge({ className = '', children, icon }) {
  return (
    <span className={`badge ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

/**
 * Вкладки внутри рабочего места. tabs: [{ id, label, icon, count }]
 */
export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`tab-navigation no-print ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`tab-btn ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} />}
          <span>{t.label}</span>
          {t.count > 0 && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, description, children }) {
  return (
    <div className="section-header">
      <div className="section-header-text">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="section-header-actions">{children}</div>}
    </div>
  );
}

export function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`form-group ${className}`}>
      <span className="form-label">{label}{required && ' *'}</span>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </label>
  );
}
