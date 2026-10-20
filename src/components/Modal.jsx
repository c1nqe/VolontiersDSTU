import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as m from 'motion/react-m';
import Icon from './Icon.jsx';

const OVERLAY = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } };
const DIALOG = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.14, ease: 'easeIn' } },
};

/**
 * Модальное окно. Закрывается по Esc, по крестику и по клику на затемнение.
 * Окно всегда центрировано и прокручивает только своё содержимое.
 * Появляется «пружиной» и плавно исчезает (motion; закрытие анимирует AnimatePresence в ModalRoot).
 */
export default function Modal({ title, subtitle, icon, iconTone = 'primary', onClose, size = 'md', footer, children, className = '' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <m.div className="modal-overlay" {...OVERLAY} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <m.div
        ref={dialogRef}
        {...DIALOG}
        className={`modal-dialog modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            {icon && <span className={`modal-icon tone-${iconTone}`}><Icon name={icon} /></span>}
            <div>
              <h3>{title}</h3>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="cross" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </m.div>
    </m.div>,
    document.body,
  );
}

/** Модальное окно-форма: тело прокручивается, футер с кнопками прижат вниз. */
export function ModalForm({ onSubmit, footer, children, ...modalProps }) {
  return (
    <Modal {...modalProps}>
      <form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSubmit?.(e); }}>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </form>
    </Modal>
  );
}
