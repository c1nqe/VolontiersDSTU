import Icon from './Icon.jsx';

/** Отображение рейтинга (только чтение). */
export function StarDisplay({ value = 0, size = 16, className = '' }) {
  return (
    <span className={`star-display ${className}`} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="star-cell" style={{ width: size, height: size }}>
            <Icon name="star" size={size} className="star-empty" />
            <span className="star-fill" style={{ width: `${fill * 100}%` }}>
              <Icon name="star" size={size} className="star-full" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
