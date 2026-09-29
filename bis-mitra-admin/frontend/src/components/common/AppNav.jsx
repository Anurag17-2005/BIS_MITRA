export default function AppNav({
  active,
  onClusters,
  onAutofetch,
  onTransform,
  onAgent,
  onRules,
  onUserPortal,
  onSignOut,
}) {
  return (
    <nav className="app-nav">
      <span className="app-nav-brand">BIS MITRA · Maintainer</span>
      <button type="button" className={active === 'clusters' ? 'active' : ''} onClick={onClusters}>
        Clusters
      </button>
      <button type="button" className={active === 'autofetch' ? 'active' : ''} onClick={onAutofetch}>
        Autofetch
      </button>
      <button type="button" className={active === 'transform' ? 'active' : ''} onClick={onTransform}>
        Transform
      </button>
      <button type="button" className={active === 'rules' ? 'active' : ''} onClick={onRules}>
        Rules
      </button>
      <button type="button" className={active === 'agent' ? 'active' : ''} onClick={onAgent}>
        Agent preview
      </button>
      {onUserPortal && (
        <button type="button" className="app-nav-portal" onClick={onUserPortal}>
          User portal ↗
        </button>
      )}
      {onSignOut && (
        <button type="button" className="app-nav-signout" onClick={onSignOut}>Sign out</button>
      )}
    </nav>
  );
}
