/** Заглушка на время загрузки раздела: повторяет сетку статистики, чтобы страница не прыгала. */
export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-stat" />)}
      </div>
      <div className="skeleton skeleton-bar" />
      <div className="skeleton-grid skeleton-grid-cards">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
      <span className="visually-hidden">Загрузка раздела…</span>
    </div>
  );
}
