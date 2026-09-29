export default function Modal({ open, title, children, onClose, actions, wide = false }) {
  if (!open) return null;
  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
