export default function Drawer({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="drawer-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="drawer-panel" onClick={e => e.stopPropagation()}>
        <header className="drawer-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}
